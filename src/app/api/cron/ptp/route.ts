import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePtpReminders, generateWorkQueueReminders } from "@/lib/notifications";
import { handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/ptp — job pengingat PTP harian.
 *
 * Dipanggil oleh penjadwal (Task Scheduler / cron) dengan header:
 *   Authorization: Bearer <CRON_SECRET>
 * Supervisor juga boleh memicu manual dari sesi yang sedang login.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const authorization = req.headers.get("authorization");
    const bySecret = Boolean(secret) && authorization === `Bearer ${secret}`;

    if (!bySecret) {
      const session = await auth();
      if (session?.user?.role !== "SUPERVISOR") {
        return NextResponse.json(
          { error: "Tidak berwenang menjalankan job pengingat." },
          { status: 401 }
        );
      }
    }

    const [ptp, queue] = await Promise.all([
      generatePtpReminders(),
      generateWorkQueueReminders(),
    ]);
    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      ptp,
      queue,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
