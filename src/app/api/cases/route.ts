import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { isShariahProduct } from "@/lib/shariah";
import { CaseStatus, Collectibility } from "@prisma/client";

const createCaseSchema = z
  .object({
    // Nasabah (boleh dibuat baru dalam form yang sama)
    cifNumber: z.string().min(1, "Nomor CIF wajib diisi"),
    fullName: z.string().min(1, "Nama lengkap wajib diisi"),
    nik: z.string().min(1, "NIK wajib diisi"),
    phone: z.string().min(1, "Nomor telepon wajib diisi"),
    emergencyContact: z.string().optional().nullable(),
    address: z.string().min(1, "Alamat wajib diisi"),
    // Pembiayaan
    contractNumber: z.string().min(1, "Nomor akad wajib diisi"),
    productType: z
      .string()
      .min(1, "Akad pembiayaan wajib diisi")
      .refine(isShariahProduct, "Akad pembiayaan harus dipilih dari daftar akad syariah"),
    principalAmount: z.coerce.number().positive("Plafon pembiayaan harus lebih dari 0"),
    outstandingBalance: z.coerce.number().min(0, "Sisa kewajiban pokok tidak boleh negatif"),
    arrearsMargin: z.coerce.number().min(0, "Tunggakan margin tidak boleh negatif"),
    penaltyAmount: z.coerce.number().min(0, "Ta'zir tidak boleh negatif"),
    dpd: z.coerce.number().int().min(0, "DPD tidak boleh negatif"),
    collectibility: z.nativeEnum(Collectibility, { message: "Kolektibilitas tidak valid" }),
    collateralType: z.string().optional().nullable(),
    collateralValue: z.coerce.number().min(0).optional().nullable(),
  })
  // Sisa kewajiban tidak mungkin melebihi plafon yang disepakati dalam akad.
  .refine((d) => d.outstandingBalance <= d.principalAmount, {
    message: "Sisa kewajiban pokok tidak boleh melebihi plafon pembiayaan",
    path: ["outstandingBalance"],
  });

/** GET /api/cases — daftar kasus dengan filter status, kolektibilitas, dan pencarian. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") as CaseStatus | null;
    const collectibility = sp.get("collectibility") as Collectibility | null;
    const q = sp.get("q")?.trim() ?? "";

    const cases = await prisma.financing.findMany({
      where: {
        ...(status && Object.values(CaseStatus).includes(status) ? { caseStatus: status } : {}),
        ...(collectibility && Object.values(Collectibility).includes(collectibility)
          ? { collectibility }
          : {}),
        ...(q
          ? {
              OR: [
                { contractNumber: { contains: q } },
                { customer: { fullName: { contains: q } } },
                { customer: { nik: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, cifNumber: true, fullName: true, nik: true, phone: true } },
        _count: { select: { collectionLogs: true, solutions: true, payments: true } },
      },
      orderBy: [{ caseStatus: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      cases: cases.map((c) => ({
        ...c,
        principalAmount: Number(c.principalAmount),
        outstandingBalance: Number(c.outstandingBalance),
        arrearsMargin: Number(c.arrearsMargin),
        penaltyAmount: Number(c.penaltyAmount),
        collateralValue: c.collateralValue === null ? null : Number(c.collateralValue),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/cases — buat kasus baru berstatus DRAFT (STAFF). */
export async function POST(req: Request) {
  try {
    const session = await assertStaff();
    const body = createCaseSchema.parse(await req.json());

    const dupCif = await prisma.customer.findUnique({ where: { cifNumber: body.cifNumber } });
    if (dupCif) {
      return NextResponse.json(
        { error: `CIF ${body.cifNumber} sudah terdaftar. Gunakan fitur edit untuk menambahkan kasus baru.` },
        { status: 409 }
      );
    }

    const dupContract = await prisma.financing.findUnique({
      where: { contractNumber: body.contractNumber },
    });
    if (dupContract) {
      return NextResponse.json({ error: `Nomor akad ${body.contractNumber} sudah terdaftar.` }, { status: 409 });
    }

    const financing = await prisma.financing.create({
      data: {
        contractNumber: body.contractNumber,
        productType: body.productType,
        principalAmount: body.principalAmount,
        outstandingBalance: body.outstandingBalance,
        arrearsMargin: body.arrearsMargin,
        penaltyAmount: body.penaltyAmount,
        dpd: body.dpd,
        collectibility: body.collectibility,
        collateralType: body.collateralType || null,
        collateralValue: body.collateralValue ?? null,
        caseStatus: CaseStatus.DRAFT,
        customer: {
          create: {
            cifNumber: body.cifNumber,
            fullName: body.fullName,
            nik: body.nik,
            phone: body.phone,
            emergencyContact: body.emergencyContact || null,
            address: body.address,
          },
        },
      },
      include: { customer: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_CASE",
        entity: "Financing",
        entityId: financing.id,
        newData: {
          contractNumber: financing.contractNumber,
          cifNumber: body.cifNumber,
          caseStatus: CaseStatus.DRAFT,
        },
      },
    });

    return NextResponse.json({ financing }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
