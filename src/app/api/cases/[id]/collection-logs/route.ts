import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff, assertCaseNotLocked } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { assertStatus, COLLECTION_LOG_ALLOWED, TransitionError } from "@/lib/state-machine";
import { ActivityType } from "@prisma/client";

const schema = z
  .object({
    activityType: z.nativeEnum(ActivityType, { message: "Jenis aktivitas tidak valid" }),
    notes: z.string().min(3, "Catatan wajib diisi minimal 3 karakter"),
    ptpDate: z.coerce.date().nullable().optional(),
    ptpAmount: z.coerce.number().min(0).nullable().optional(),
    evidenceUrl: z.string().optional().nullable(),
  })
  // Janji bayar selalu untuk tanggal yang akan datang; PTP di masa lalu akan
  // menggelembungkan kartu "PTP jatuh tempo hari ini" dengan data yang sudah lewat.
  .refine(
    (d) => {
      if (!d.ptpDate) return true;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return d.ptpDate.getTime() >= startOfToday.getTime();
    },
    { message: "Tanggal janji bayar (PTP) tidak boleh di masa lalu", path: ["ptpDate"] }
  )
  // Nominal PTP tanpa tanggal tidak bisa ditindaklanjuti.
  .refine((d) => !d.ptpAmount || Boolean(d.ptpDate), {
    message: "Nominal janji bayar membutuhkan tanggal PTP",
    path: ["ptpDate"],
  });

/**
 * POST /api/cases/:id/collection-logs — catat penagihan (STAFF).
 * Hanya bisa saat status ACTIVE atau IN_EXECUTION.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await assertStaff();
    await assertCaseNotLocked(params.id);
    const body = schema.parse(await req.json());

    const financing = await prisma.financing.findUnique({
      where: { id: params.id },
      select: { id: true, caseStatus: true, contractNumber: true, needsRevision: true },
    });
    if (!financing) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }
    // Kasus yang dikembalikan Supervisor harus direvisi dulu, bukan ditagih lagi,
    // agar flag needsRevision tidak menggantung tanpa perbaikan.
    if (financing.needsRevision) {
      throw new TransitionError(
        "Kasus sedang menunggu revisi Staf. Simpan perbaikan data terlebih dahulu sebelum mencatat penagihan."
      );
    }
    assertStatus(financing.caseStatus, COLLECTION_LOG_ALLOWED, "Catat Penagihan");

    const log = await prisma.collectionLog.create({
      data: {
        financingId: params.id,
        staffId: session.user.id,
        activityType: body.activityType,
        notes: body.notes,
        ptpDate: body.ptpDate ?? null,
        ptpAmount: body.ptpAmount ?? null,
        evidenceUrl: body.evidenceUrl || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_COLLECTION_LOG",
        entity: "CollectionLog",
        entityId: log.id,
        newData: { financingId: params.id, activityType: body.activityType },
      },
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
