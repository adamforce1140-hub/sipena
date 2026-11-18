import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertStaff } from "@/lib/guards";
import { handleApiError } from "@/lib/api-response";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const bodySchema = z.object({
  financingId: z.string().min(1, "financingId wajib diisi"),
});

/**
 * POST /api/upload — unggah bukti (foto penagihan / surat peringatan / bukti bayar).
 * File disimpan di storage/uploads dan hanya dapat diakses melalui /api/files/:name.
 */
export async function POST(req: Request) {
  try {
    await assertStaff();

    const form = await req.formData();
    const file = form.get("file");
    const financingId = String(form.get("financingId") ?? "");

    bodySchema.parse({ financingId });

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diunggah." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipe file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ukuran file maksimal 5 MB." }, { status: 400 });
    }

    const financing = await prisma.financing.findUnique({
      where: { id: financingId },
      select: { id: true, caseStatus: true, isLocked: true },
    });
    if (!financing) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }
    // Kasus yang sudah ditutup & dikunci permanen tidak boleh menerima bukti baru.
    if (financing.isLocked || financing.caseStatus === "CLOSED") {
      return NextResponse.json(
        { error: "Kasus telah ditutup & dikunci permanen. Bukti tidak dapat diunggah." },
        { status: 423 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const safeExt = /^[a-z0-9]{1,5}$/.test(ext) ? ext : "bin";
    const filename = `${financingId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    // Disimpan di luar /public dan hanya dapat diakses lewat /api/files/:name.
    await saveUpload(filename, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ url: `/api/files/${filename}`, size: file.size }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
