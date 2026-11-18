import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff, assertCaseNotLocked } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { assertCanUploadPayment, TransitionError } from "@/lib/state-machine";
import { CaseStatus } from "@prisma/client";

/**
 * Pembayaran nasabah dialokasikan per komponen syariah:
 * - marginPortion  : tunggakan margin
 * - principalPortion: sisa kewajiban pokok (plafon)
 * - penaltyPortion : ta'zir, tidak menjadi pendapatan bank (dana kebajikan)
 */
const schema = z.object({
  principalPortion: z.coerce.number().min(0, "Alokasi pokok tidak boleh negatif").default(0),
  marginPortion: z.coerce.number().min(0, "Alokasi margin tidak boleh negatif").default(0),
  penaltyPortion: z.coerce.number().min(0, "Alokasi ta'zir tidak boleh negatif").default(0),
  paymentDate: z.coerce.date({ message: "Tanggal pembayaran tidak valid" }),
  receiptUrl: z.string().min(1, "Bukti pembayaran wajib diunggah"),
  notes: z.string().optional().nullable(),
});

const EPSILON = 0.005;

/**
 * POST /api/cases/:id/payments — catat pembayaran nasabah (STAFF).
 * Mengurangi sisa kewajiban pokok & tunggakan margin sesuai alokasi.
 * Status menjadi PENDING_CLOSURE hanya bila pokok, margin, dan ta'zir sudah lunas.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertStaff();
    await assertCaseNotLocked(params.id);
    const body = schema.parse(await req.json());

    const total = body.principalPortion + body.marginPortion + body.penaltyPortion;
    if (total <= 0) {
      throw new TransitionError("Total pembayaran harus lebih dari 0.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const financing = await tx.financing.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          caseStatus: true,
          outstandingBalance: true,
          arrearsMargin: true,
          penaltyAmount: true,
          needsRevision: true,
        },
      });
      if (!financing) {
        throw Object.assign(new Error("Kasus tidak ditemukan."), { status: 404 });
      }
      // Kasus yang dikembalikan Supervisor harus direvisi dulu; mencatat pembayaran
      // akan mereset flag revisi tanpa perbaikan data.
      if (financing.needsRevision) {
        throw new TransitionError(
          "Kasus sedang menunggu revisi Staf. Simpan perbaikan data terlebih dahulu sebelum mencatat pembayaran."
        );
      }
      assertCanUploadPayment(financing.caseStatus);

      // Cegah pencatatan ganda: bukti pembayaran yang sama tidak boleh disimpan dua kali.
      const duplicate = await tx.casePayment.findFirst({
        where: { financingId: params.id, receiptUrl: body.receiptUrl },
        select: { id: true },
      });
      if (duplicate) {
        throw new TransitionError(
          "Bukti pembayaran ini sudah pernah dicatat. Pembayaran ganda tidak disimpan."
        );
      }

      const outstanding = Number(financing.outstandingBalance);
      const arrearsMargin = Number(financing.arrearsMargin);
      const penalty = Number(financing.penaltyAmount);

      if (body.principalPortion - outstanding > EPSILON) {
        throw new TransitionError(
          `Alokasi pokok melebihi sisa kewajiban pokok (Rp ${outstanding.toLocaleString("id-ID")}).`
        );
      }
      if (body.marginPortion - arrearsMargin > EPSILON) {
        throw new TransitionError(
          `Alokasi margin melebihi tunggakan margin (Rp ${arrearsMargin.toLocaleString("id-ID")}).`
        );
      }
      if (body.penaltyPortion - penalty > EPSILON) {
        throw new TransitionError(
          `Alokasi ta'zir melebihi ta'zir tercatat (Rp ${penalty.toLocaleString("id-ID")}).`
        );
      }

      const newOutstanding = Math.max(0, outstanding - body.principalPortion);
      const newArrearsMargin = Math.max(0, arrearsMargin - body.marginPortion);
      const newPenalty = Math.max(0, penalty - body.penaltyPortion);
      // Ta'zir ikut menjadi syarat lunas: Gate 3 mengunci kasus permanen, sehingga
      // sisa ta'zir yang belum tertagih tidak boleh ikut terkunci.
      const isSettled =
        newOutstanding <= EPSILON &&
        newArrearsMargin <= EPSILON &&
        newPenalty <= EPSILON;
      const nextStatus = isSettled ? CaseStatus.PENDING_CLOSURE : CaseStatus.IN_EXECUTION;

      const payment = await tx.casePayment.create({
        data: {
          financingId: params.id,
          uploadedById: session.user.id,
          paymentAmount: total,
          principalPortion: body.principalPortion,
          marginPortion: body.marginPortion,
          penaltyPortion: body.penaltyPortion,
          paymentDate: body.paymentDate,
          receiptUrl: body.receiptUrl,
          notes: body.notes || null,
        },
      });

      await tx.financing.update({
        where: { id: params.id },
        data: {
          outstandingBalance: newOutstanding,
          arrearsMargin: newArrearsMargin,
          penaltyAmount: newPenalty,
          caseStatus: nextStatus,
          // Bukti pembayaran baru → kasus kembali ke antrean Gate 3 (bila lunas).
          needsRevision: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPLOAD_PAYMENT",
          entity: "CasePayment",
          entityId: payment.id,
          oldData: {
            caseStatus: financing.caseStatus,
            outstandingBalance: outstanding,
            arrearsMargin,
            penaltyAmount: penalty,
          },
          newData: {
            caseStatus: nextStatus,
            paymentAmount: total,
            principalPortion: body.principalPortion,
            marginPortion: body.marginPortion,
            penaltyPortion: body.penaltyPortion,
            outstandingBalance: newOutstanding,
            arrearsMargin: newArrearsMargin,
            penaltyAmount: newPenalty,
          },
        },
      });

      return { payment, isSettled };
    });

    return NextResponse.json(
      {
        payment: result.payment,
        isSettled: result.isSettled,
        message: result.isSettled
          ? "Kewajiban pokok, margin & ta'zir lunas. Kasus menunggu verifikasi Gate 3."
          : "Pembayaran tercatat. Sisa kewajiban masih ada; kasus tetap dalam eksekusi.",
      },
      { status: 201 }
    );
  } catch (e) {
    return handleApiError(e);
  }
}
