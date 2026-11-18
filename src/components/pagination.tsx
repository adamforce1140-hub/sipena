import Link from "next/link";

/**
 * Navigasi halaman untuk daftar server-side. Filter aktif ikut dibawa ke setiap
 * tautan agar perpindahan halaman tidak menghapus filter pengguna.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  // Tabel sudah menampilkan pesan "tidak ada data"; ringkasan halaman tidak perlu.
  if (total === 0) return null;

  function href(target: number) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "page" && value) sp.set(key, value);
    }
    if (target > 1) sp.set("page", String(target));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
      <span>
        Menampilkan {start}–{end} dari {total} data
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {current > 1 ? (
            <Link href={href(current - 1)} className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50">
              ← Sebelumnya
            </Link>
          ) : (
            <span className="rounded border px-3 py-1.5 text-gray-400">← Sebelumnya</span>
          )}
          <span className="px-1">
            Halaman {current} / {totalPages}
          </span>
          {current < totalPages ? (
            <Link href={href(current + 1)} className="rounded border bg-white px-3 py-1.5 hover:bg-gray-50">
              Berikutnya →
            </Link>
          ) : (
            <span className="rounded border px-3 py-1.5 text-gray-400">Berikutnya →</span>
          )}
        </div>
      )}
    </div>
  );
}
