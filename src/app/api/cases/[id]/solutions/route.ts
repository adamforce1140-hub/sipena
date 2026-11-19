import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff, assertCaseNotLocked } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { assertCanProposeSolution, TransitionError } from "@/lib/state-machine";
import { CaseStatus, SolutionType } from "@prisma/client";

const schema = z.object({
  solutionType: z.nativeEnum(SolutionType, { message: "Jenis solusi tidak valid" }),
  proposalSummary: z.string().min(10, "Ringkasan usulan minimal 10 karakter"),
  proposedAmount: z.coerce.number().min(0).nullable().optional(),
  supportingUrl: z.string().optional().nullable(),
});

/**
 * POST /api/cases/:id/solutions — ajukan solusi (STAFF).
 * Memicu transisi ACTIVE -> PENDING_SOLUTION (menunggu Gate 2).
 * Pengecekan status dilakukan di dalam transaksi agar dua request bersamaan
 * tidak sama-sama lolos dan menumpuk solusi PENDING.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertStaff();
    await assertCaseNotLocked(params.id);
    const body = schema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const financing = await tx.financing.findUnique({
        where: { id: params.id },
        select: { id: true, caseStatus: true },
      });
      if (!financing) {
        throw Object.assign(new Error("Kasus tidak ditemukan."), { status: 404 });
      }
      // Solusi tetap boleh diajukan walau kasus sedang menunggu revisi —
      // Supervisor yang memutuskan, Staf tidak perlu menunggu.
      assertCanProposeSolution(financing.caseStatus);

      // Satu kasus hanya boleh punya satu solusi yang menunggu keputusan.
      const pending = await tx.caseSolution.count({
        where: { financingId: params.id, status: "PENDING" },
      });
      if (pending > 0) {
        throw new TransitionError(
          "Masih ada solusi yang menunggu keputusan Supervisor. " +
            "Tunggu hasil Gate 2 sebelum mengajukan solusi baru."
        );
      }

      const solution = await tx.caseSolution.create({
        data: {
          financingId: params.id,
          proposedById: session.user.id,
          solutionType: body.solutionType,
          proposalSummary: body.proposalSummary,
          proposedAmount: body.proposedAmount ?? null,
          supportingUrl: body.supportingUrl || null,
          status: "PENDING",
        },
      });

      const updated = await tx.financing.update({
        where: { id: params.id },
        // Solusi baru dikirim → kasus masuk kembali ke antrean Gate 2.
        data: { caseStatus: CaseStatus.PENDING_SOLUTION, needsRevision: false },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "PROPOSE_SOLUTION",
          entity: "CaseSolution",
          entityId: solution.id,
          oldData: { caseStatus: financing.caseStatus },
          newData: { caseStatus: CaseStatus.PENDING_SOLUTION, solutionType: body.solutionType },
        },
      });

      return { solution, updated };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
