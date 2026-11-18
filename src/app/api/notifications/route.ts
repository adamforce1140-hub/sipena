import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePtpReminders, getNotifications } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Pengingat PTP dibuat paling sering setiap 10 menit, bukan setiap request. */
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
let lastSyncAt = 0;

async function syncReminders() {
  if (Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return;
  lastSyncAt = Date.now();
  try {
    await generatePtpReminders();
  } catch (e) {
    // Kegagalan job pengingat tidak boleh menggagalkan pemuatan notifikasi.
    console.error("Gagal membuat pengingat PTP:", e);
    lastSyncAt = 0;
  }
}

/** GET /api/notifications — daftar notifikasi pengguna yang sedang login. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    await syncReminders();

    const data = await getNotifications(session.user.id);
    return NextResponse.json(data);
  } catch (e) {
    return handleApiError(e);
  }
}

const patchSchema = z.object({
  id: z.string().min(1).optional(),
  all: z.boolean().optional(),
});

/** PATCH /api/notifications — tandai satu notifikasi (atau semua) sudah dibaca. */
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    const body = patchSchema.parse(await req.json());
    if (!body.all && !body.id) {
      throw Object.assign(new Error("Tentukan id notifikasi atau gunakan all=true."), {
        status: 422,
      });
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        readAt: null,
        ...(body.all ? {} : { id: body.id }),
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ updated: result.count });
  } catch (e) {
    return handleApiError(e);
  }
}
