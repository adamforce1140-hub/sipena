import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";

const customerSchema = z.object({
  cifNumber: z.string().min(1, "Nomor CIF wajib diisi"),
  fullName: z.string().min(1, "Nama lengkap wajib diisi"),
  nik: z.string().min(1, "NIK wajib diisi"),
  phone: z.string().min(1, "Nomor telepon wajib diisi"),
  emergencyContact: z.string().optional().nullable(),
  address: z.string().min(1, "Alamat wajib diisi"),
});

/** GET /api/customers?q=... — pencarian nasabah (untuk form kasus baru). */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

    const customers = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { nik: { contains: q } },
              { cifNumber: { contains: q } },
            ],
          }
        : undefined,
      include: { financings: { select: { id: true, contractNumber: true, caseStatus: true } } },
      orderBy: { fullName: "asc" },
      take: 50,
    });

    return NextResponse.json({ customers });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/customers — buat nasabah baru (STAFF). */
export async function POST(req: Request) {
  try {
    await assertStaff();
    const body = customerSchema.parse(await req.json());

    const [dupCif, dupNik] = await Promise.all([
      prisma.customer.findUnique({ where: { cifNumber: body.cifNumber } }),
      prisma.customer.findFirst({ where: { nik: body.nik } }),
    ]);
    if (dupCif) {
      return NextResponse.json({ error: `CIF ${body.cifNumber} sudah terdaftar.` }, { status: 409 });
    }
    if (dupNik) {
      return NextResponse.json(
        { error: `NIK ${body.nik} sudah terdaftar atas nama ${dupNik.fullName}.` },
        { status: 409 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        cifNumber: body.cifNumber,
        fullName: body.fullName,
        nik: body.nik,
        phone: body.phone,
        emergencyContact: body.emergencyContact || null,
        address: body.address,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
