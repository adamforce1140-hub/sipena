import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSupervisor } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { transitionCase, TransitionError } from "@/lib/state-machine";
import { notifyGateDecision } from "@/lib/notifications";
import { CaseStatus } from "@prisma/client";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"], { message: "Keputusan harus APPROVE atau REJECT" }),
  notes: z.string().optional().nullable(),
  // Bila dikirim, hanya solusi ini yang diputuskan. Jika kosong dipakai solusi PENDING terbaru.
  solutionId: z.string().optional().nullable(),
});

/**
 * POST /api/cases/:id/gate-2 — Gate 2: Persetujuan Solusi (SUPERVISOR).
 * APPROVE -> PENDING_SOLUTION menjadi IN_EXECUTION, solusi disetujui.
 * REJECT  -> kembali ke ACTIVE, solusi ditolak & staf diminta menyusun ulang.
 *
 * Transisi status kasus, keputusan solusi, dan audit log dijalankan dalam satu
 * transaksi agar status kasus tidak pernah berubah tanpa status solusinya.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertSupervisor();
    const body = schema.parse(await req.json());
    const approve = body.decision === "APPROVE";

    const to = await prisma.$transaction(async (tx) => {
      const from = await tx.financing.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          caseStatus: true,
          contractNumber: true,
          customer: { select: { fullName: true } },
        },
      });
      if (!from) {
        throw Object.assign(new Error("Kasus tidak ditemukan."), { status: 404 });
      }

      // Satu keputusan hanya untuk satu solusi. Tanpa ini seluruh solusi PENDING
      // ikut berubah status dengan satu klik Supervisor.
      const target = await tx.caseSolution.findFirst({
        where: {
          financingId: params.id,
          status: "PENDING",
          ...(body.solutionId ? { id: body.solutionId } : {}),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (!target) {
        throw new TransitionError("Tidak ada solusi yang menunggu keputusan Gate 2.");
      }

      const updated = await transitionCase(
        {
          financingId: params.id,
          from: [CaseStatus.PENDING_SOLUTION],
          to: approve ? CaseStatus.IN_EXECUTION : CaseStatus.ACTIVE,
          action: "Gate 2 — Persetujuan Solusi",
          gateStep: "GATE_2_SOLUTION",
          decision: approve ? "APPROVED" : "REJECTED",
          supervisorId: session.user.id,
          notes: body.notes || null,
        },
        tx
      );

      await tx.caseSolution.update({
        where: { id: target.id },
        data: {
          status: approve ? "APPROVED" : "REJECTED",
          reviewedById: session.user.id,
          supervisorNotes: body.notes || null,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: approve ? "GATE_2_APPROVE" : "GATE_2_REJECT",
          entity: "Financing",
          entityId: params.id,
          oldData: { caseStatus: from.caseStatus, contractNumber: from.contractNumber },
          newData: {
            caseStatus: updated.caseStatus,
            decision: body.decision,
            solutionId: target.id,
          },
        },
      });

      return { updated, contractNumber: from.contractNumber, customerName: from.customer.fullName };
    });
    // Gate 2 approve = keputusan berpindah ke Supervisor (Gate 3);
    // Gate 2 reject = kasus kembali ke Staf untuk revisi.
    await notifyGateDecision({
      financingId: params.id,
      contractNumber: to.contractNumber,
      customerName: to.customerName,
      decision: approve ? "APPROVED" : "REJECTED",
      gateStep: "GATE_2_SOLUTION",
    });

    return NextResponse.json({ financing: to });
  } catch (e) {
    return handleApiError(e);
  }
}
