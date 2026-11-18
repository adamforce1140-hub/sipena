import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/stream — Server-Sent Events untuk notifikasi real-time.
 * Server memeriksa basis data tiap 3 detik dan hanya mengirim pesan ketika
 * jumlah notifikasi belum dibaca berubah, sehingga lonceng dan dropdown
 * diperbarui tanpa menunggu polling dari browser.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Tidak terautentikasi.", { status: 401 });
  }
  const userId = session.user.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastUnread: number | null = null;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const tick = async () => {
        if (closed) return;
        try {
          const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
          if (unreadCount !== lastUnread) {
            send("unread", { unreadCount });
            lastUnread = unreadCount;
          } else {
            // komentar sebagai keep-alive agar koneksi tidak dianggap mati
            if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
          }
        } catch {
          // kegagalan satu siklus tidak menghentikan stream
        }
      };

      const interval = setInterval(tick, 3_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      };
      req.signal?.addEventListener("abort", cleanup);

      send("ready", { userId });
      await tick();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
