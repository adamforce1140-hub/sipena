import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff, assertCaseNotLocked } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { assertCanRevise, assertEditableByStaff } from "@/lib/state-machine";
import { isShariahProduct } from "@/lib/shariah";
import { deleteUpload, uploadedFileName } from "@/lib/storage";
import { Collectibility } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const financing = await prisma.financing.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        collectionLogs: { orderBy: { createdAt: "desc" }, include: { staff: { select: { name: true } } } },
        solutions: {
          orderBy: { createdAt: "desc" },
          include: {
            proposedBy: { select: { id: true, name: true, role: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { id: true, name: true } } },
        },
        gateHistory: {
          orderBy: { createdAt: "desc" },
          include: { supervisor: { select: { id: true, name: true } } },
        },
      },
    });

    if (!financing) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      financing: {
        ...financing,
        principalAmount: Number(financing.principalAmount),
        outstandingBalance: Number(financing.outstandingBalance),
        arrearsMargin: Number(financing.arrearsMargin),
        penaltyAmount: Number(financing.penaltyAmount),
        collateralValue: financing.collateralValue === null ? null : Number(financing.collateralValue),
        collectionLogs: financing.collectionLogs.map((l) => ({
          ...l,
          ptpAmount: l.ptpAmount === null ? null : Number(l.ptpAmount),
        })),
        solutions: financing.solutions.map((s) => ({
          ...s,
          proposedAmount: s.proposedAmount === null ? null : Number(s.proposedAmount),
        })),
        payments: financing.payments.map((p) => ({
          ...p,
          paymentAmount: Number(p.paymentAmount),
        })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  nik: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  emergencyContact: z.string().nullable().optional(),
  address: z.string().min(1).optional(),
  productType: z
    .string()
    .min(1)
    .refine(isShariahProduct, "Akad pembiayaan harus dipilih dari daftar akad syariah")
    .optional(),
  principalAmount: z.coerce.number().positive().optional(),
  outstandingBalance: z.coerce.number().min(0).optional(),
  arrearsMargin: z.coerce.number().min(0).optional(),
  penaltyAmount: z.coerce.number().min(0).optional(),
  dpd: z.coerce.number().int().min(0).optional(),
  collectibility: z.nativeEnum(Collectibility).optional(),
  collateralType: z.string().nullable().optional(),
  collateralValue: z.coerce.number().min(0).nullable().optional(),
});

/**
 * PATCH /api/cases/:id — edit data kasus.
 * Boleh saat DRAFT, atau saat kasus dikembalikan Supervisor untuk revisi.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertStaff();
    await assertCaseNotLocked(params.id);
    const body = updateSchema.parse(await req.json());

    const current = await prisma.financing.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }
    assertCanRevise(current.caseStatus, current.needsRevision);

    // Sisa kewajiban tidak boleh melebihi plafon, termasuk setelah perubahan parsial.
    const effectivePrincipal = body.principalAmount ?? Number(current.principalAmount);
    const effectiveOutstanding = body.outstandingBalance ?? Number(current.outstandingBalance);
    if (effectiveOutstanding - effectivePrincipal > 0.005) {
      throw Object.assign(
        new Error("Sisa kewajiban pokok tidak boleh melebihi plafon pembiayaan."),
        { status: 422 }
      );
    }

    const customerFields = {
      fullName: body.fullName,
      nik: body.nik,
      phone: body.phone,
      emergencyContact: body.emergencyContact,
      address: body.address,
    };
    const hasCustomerUpdate = Object.values(customerFields).some((v) => v !== undefined);

    const financingFields = {
      productType: body.productType,
      principalAmount: body.principalAmount,
      outstandingBalance: body.outstandingBalance,
      arrearsMargin: body.arrearsMargin,
      penaltyAmount: body.penaltyAmount,
      dpd: body.dpd,
      collectibility: body.collectibility,
      collateralType: body.collateralType,
      collateralValue: body.collateralValue,
    };
    const hasFinancingUpdate = Object.values(financingFields).some((v) => v !== undefined);

    const updated = await prisma.$transaction(async (tx) => {
      if (hasCustomerUpdate) {
        await tx.customer.update({
          where: { id: current.customerId },
          data: Object.fromEntries(
            Object.entries(customerFields).filter(([, v]) => v !== undefined)
          ),
        });
      }
      if (!hasFinancingUpdate && !hasCustomerUpdate) {
        return tx.financing.findUniqueOrThrow({
          where: { id: params.id },
          include: { customer: true },
        });
      }
      return tx.financing.update({
        where: { id: params.id },
        // Staf menyimpan perbaikan → kasus kembali ke antrean Supervisor.
        data: {
          ...Object.fromEntries(Object.entries(financingFields).filter(([, v]) => v !== undefined)),
          needsRevision: false,
        },
        include: { customer: true },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_CASE",
        entity: "Financing",
        entityId: params.id,
        oldData: { customer: current.customer, financing: current },
        newData: { customer: updated.customer, financing: updated },
      },
    });

    return NextResponse.json({ financing: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/cases/:id — hapus kasus yang masih DRAFT (STAFF). */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertStaff();
    const financing = await prisma.financing.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        collectionLogs: { select: { evidenceUrl: true } },
        solutions: { select: { supportingUrl: true } },
        payments: { select: { receiptUrl: true } },
      },
    });
    if (!financing) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }
    assertEditableByStaff(financing.caseStatus);

    const otherCases = await prisma.financing.count({
      where: { customerId: financing.customerId, id: { not: financing.id } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.financing.delete({ where: { id: params.id } });
      if (otherCases === 0) {
        await tx.customer.delete({ where: { id: financing.customerId } });
      }
    });

    // Bersihkan file bukti milik kasus ini agar tidak menjadi file yatim.
    const files = [
      ...financing.collectionLogs.map((l) => l.evidenceUrl),
      ...financing.solutions.map((s) => s.supportingUrl),
      ...financing.payments.map((p) => p.receiptUrl),
    ]
      .map(uploadedFileName)
      .filter((f): f is string => Boolean(f));
    await Promise.all(files.map((f) => deleteUpload(f)));

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_CASE",
        entity: "Financing",
        entityId: params.id,
        oldData: { contractNumber: financing.contractNumber, cifNumber: financing.customer.cifNumber },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
