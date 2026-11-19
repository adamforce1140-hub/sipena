import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { isShariahProduct } from "@/lib/shariah";
import { PLACEHOLDER_CIF_PREFIX } from "@/lib/case-completeness";
import { CaseStatus, Collectibility } from "@prisma/client";

/**
 * Staf lapangan sering mengirim kasus lebih dulu, lalu melengkapi data
 * administrasi belakangan. Karena itu hanya Nomor Akad & Nama yang wajib;
 * field lain opsional dan diberi nilai aman. Kelengkapan data ditampilkan
 * ke Supervisor sebagai checklist, bukan dijadikan penghalang pengiriman.
 */
const createCaseSchema = z
  .object({
    // Nasabah (boleh dibuat baru dalam form yang sama)
    cifNumber: z.string().trim().optional().nullable(),
    fullName: z.string().trim().min(1, "Nama lengkap wajib diisi"),
    nik: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    emergencyContact: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
    // Pembiayaan
    contractNumber: z.string().trim().min(1, "Nomor akad wajib diisi"),
    productType: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (v) => !v || isShariahProduct(v),
        "Akad pembiayaan harus dipilih dari daftar akad syariah"
      ),
    principalAmount: z.coerce.number().min(0, "Plafon pembiayaan tidak boleh negatif").optional(),
    outstandingBalance: z.coerce
      .number()
      .min(0, "Sisa kewajiban pokok tidak boleh negatif")
      .optional(),
    arrearsMargin: z.coerce.number().min(0, "Tunggakan margin tidak boleh negatif").optional(),
    penaltyAmount: z.coerce.number().min(0, "Ta'zir tidak boleh negatif").optional(),
    dpd: z.coerce.number().int().min(0, "DPD tidak boleh negatif").optional(),
    collectibility: z
      .nativeEnum(Collectibility, { message: "Kolektibilitas tidak valid" })
      .optional(),
    collateralType: z.string().trim().optional().nullable(),
    collateralValue: z.coerce.number().min(0).optional().nullable(),
  })
  // Sisa kewajiban tidak mungkin melebihi plafon — hanya dicek bila plafon
  // sudah diisi, agar pengiriman data belum lengkap tidak ikut terblokir.
  .refine((d) => !d.principalAmount || (d.outstandingBalance ?? 0) <= d.principalAmount, {
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

    // CIF boleh kosong saat pengiriman awal — pakai penanda sementara agar
    // Supervisor melihat bahwa data ini masih perlu dilengkapi Staf.
    const cifNumber = body.cifNumber?.trim() || `${PLACEHOLDER_CIF_PREFIX}${Date.now()}`;

    if (body.cifNumber?.trim()) {
      const dupCif = await prisma.customer.findUnique({ where: { cifNumber } });
      if (dupCif) {
        return NextResponse.json(
          { error: `CIF ${cifNumber} sudah terdaftar. Gunakan fitur edit untuk menambahkan kasus baru.` },
          { status: 409 }
        );
      }
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
        // Nilai aman untuk kolom wajib di database saat data belum lengkap.
        productType: body.productType?.trim() || "",
        principalAmount: body.principalAmount ?? 0,
        outstandingBalance: body.outstandingBalance ?? 0,
        arrearsMargin: body.arrearsMargin ?? 0,
        penaltyAmount: body.penaltyAmount ?? 0,
        dpd: body.dpd ?? 0,
        collectibility: body.collectibility ?? Collectibility.KOL_3,
        collateralType: body.collateralType?.trim() || null,
        collateralValue: body.collateralValue ?? null,
        caseStatus: CaseStatus.DRAFT,
        customer: {
          create: {
            cifNumber,
            fullName: body.fullName,
            nik: body.nik?.trim() || "-",
            phone: body.phone?.trim() || "-",
            emergencyContact: body.emergencyContact?.trim() || null,
            address: body.address?.trim() || "-",
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
          cifNumber,
          caseStatus: CaseStatus.DRAFT,
        },
      },
    });

    return NextResponse.json({ financing }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
