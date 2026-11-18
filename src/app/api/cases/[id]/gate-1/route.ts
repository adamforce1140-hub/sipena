import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupervisor } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { transitionCase } from "@/lib/state-machine";
import { notifyGateDecision } from "@/lib/notifications";
import { CaseStatus } from "@prisma/client";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"], { message: "Keputusan harus APPROVE atau REJECT" }),
  notes: z.string().optional().nullable(),
});

/**
 * POST /api/cases/:id/gate-1 — Gate 1: Verifikasi Kelengkapan Kasus (SUPERVISOR).
 * APPROVE -> DRAFT menjadi ACTIVE.
 * REJECT  -> tetap DRAFT, dikembalikan ke STAFF untuk revisi.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertSupervisor();
    const body = schema.parse(await req.json());

    const from = await prisma.financing.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        caseStatus: true,
        isLocked: true,
        contractNumber: true,
        customer: { select: { fullName: true } },
      },
    });
    if (!from) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }

    const approve = body.decision === "APPROVE";

    const financing = await transitionCase({
      financingId: params.id,
      from: [CaseStatus.DRAFT],
      to: approve ? CaseStatus.ACTIVE : CaseStatus.DRAFT,
      action: "Gate 1 — Verifikasi Kasus",
      gateStep: "GATE_1_VERIFY",
      decision: approve ? "APPROVED" : "REJECTED",
      supervisorId: session.user.id,
      notes: body.notes || null,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: approve ? "GATE_1_APPROVE" : "GATE_1_REJECT",
        entity: "Financing",
        entityId: params.id,
        oldData: { caseStatus: from.caseStatus },
        newData: { caseStatus: financing.caseStatus, decision: body.decision },
      },
    });

    if (!approve) {
      await notifyGateDecision({
        financingId: params.id,
        contractNumber: from.contractNumber,
        customerName: from.customer.fullName,
        decision: "REJECTED",
        gateStep: "GATE_1_VERIFY",
      });
    }

    return NextResponse.json({ financing });
  } catch (e) {
    return handleApiError(e);
  }
}
