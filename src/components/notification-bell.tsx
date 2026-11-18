"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/ui";

type NotificationItem = {
  id: string;
  type: "PTP_TODAY" | "PTP_OVERDUE";
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/**
 * Lonceng notifikasi di header. Memuat ulang setiap 60 detik agar pengingat PTP
 * tetap terlihat tanpa perlu me-refresh halaman.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: NotificationItem[];
        unreadCount: number;
      };
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // Notifikasi bersifat pelengkap; kegagalan muat tidak perlu mengganggu UI.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  // Real-time: server mendorong jumlah belum-dibaca terbaru via SSE.
  // Ketika stream mati/terputus (mis. server restart), polling 60 detik di atas tetap jalan.
  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("unread", (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { unreadCount: number };
      setUnreadCount(data.unreadCount);
      setLoaded(true);
      // isi daftar juga diperbarui agar dropdown selalu menampilkan notifikasi baru
      load();
    });
    source.onerror = () => {
      // stream putus — polling 60 detik tetap menutup celahnya
    };
    return () => source.close();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(payload: { id?: string; all?: boolean }) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await load();
    } catch {
      // abaikan; pengguna dapat mencoba lagi
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifikasi"
        className="relative rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Di layar sempit header turun baris dan posisi lonceng bergeser, sehingga panel
        // dipasang fixed selebar layar agar tidak terpotong; di layar lebar menempel tombol.
        <div className="fixed inset-x-4 top-24 z-50 overflow-hidden rounded border bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-2rem)]">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-semibold">Notifikasi</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markRead({ all: true })}
                className="text-xs text-blue-600 hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded && <p className="px-4 py-6 text-center text-sm text-gray-500">Memuat...</p>}
            {loaded && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Tidak ada notifikasi.</p>
            )}
            {items.map((item) => {
              const content = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        item.type === "PTP_OVERDUE" ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {item.title}
                    </span>
                    {!item.readAt && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">{item.message}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(item.createdAt)}</p>
                </>
              );

              return item.link ? (
                <Link
                  key={item.id}
                  href={item.link}
                  onClick={() => {
                    if (!item.readAt) markRead({ id: item.id });
                    setOpen(false);
                  }}
                  className={`block border-b px-4 py-3 last:border-b-0 hover:bg-gray-50 ${
                    item.readAt ? "" : "bg-blue-50/50"
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <div key={item.id} className="border-b px-4 py-3 last:border-b-0">
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
