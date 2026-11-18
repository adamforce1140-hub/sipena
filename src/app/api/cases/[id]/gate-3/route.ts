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
 * POST /api/cases/:id/gate-3 — Gate 3: Penutupan Kasus (SUPERVISOR).
 * APPROVE -> PENDING_CLOSURE menjadi CLOSED dan kasus dikunci permanen (isLocked).
 * REJECT  -> kembali ke IN_EXECUTION agar staf melengkapikan bukti.
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
      from: [CaseStatus.PENDING_CLOSURE],
      to: approve ? CaseStatus.CLOSED : CaseStatus.IN_EXECUTION,
      action: "Gate 3 — Penutupan Kasus",
      gateStep: "GATE_3_CLOSE",
      decision: approve ? "APPROVED" : "REJECTED",
      supervisorId: session.user.id,
      notes: body.notes || null,
      lock: approve,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: approve ? "GATE_3_CLOSE" : "GATE_3_REJECT",
        entity: "Financing",
        entityId: params.id,
        oldData: { caseStatus: from.caseStatus },
        newData: { caseStatus: financing.caseStatus, isLocked: financing.isLocked },
      },
    });

    // Bila dikembalikan (reject), notifikasi juga diterima Staf agar tahu kasus
    // kembali ke status Eksekusi untuk dilengkapi.
    await notifyGateDecision({
      financingId: params.id,
      contractNumber: from.contractNumber,
      customerName: from.customer.fullName,
      decision: approve ? "APPROVED" : "REJECTED",
      gateStep: "GATE_3_CLOSE",
    });

    return NextResponse.json({ financing });
  } catch (e) {
    return handleApiError(e);
  }
}
