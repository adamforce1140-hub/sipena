import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { formatDateTime, ROLE_LABEL } from "@/lib/ui";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ACTION_LABEL: Record<string, string> = {
  CREATE_CASE: "Buat Kasus",
  UPDATE_CASE: "Ubah Kasus",
  DELETE_CASE: "Hapus Kasus",
  CREATE_COLLECTION_LOG: "Log Penagihan",
  PROPOSE_SOLUTION: "Ajukan Solusi",
  UPLOAD_PAYMENT: "Unggah Pembayaran",
  GATE_1_APPROVE: "Gate 1 — Verifikasi Disetujui",
  GATE_1_REJECT: "Gate 1 — Verifikasi Ditolak",
  GATE_2_APPROVE: "Gate 2 — Solusi Disetujui",
  GATE_2_REJECT: "Gate 2 — Solusi Ditolak",
  GATE_3_CLOSE: "Gate 3 — Kasus Ditutup",
  GATE_3_REJECT: "Gate 3 — Penutupan Ditolak",
  PRINT_WARNING_LETTER: "Cetak Surat Peringatan",
  PRINT_BERITA_ACARA: "Cetak Berita Acara",
  EXPORT_NPF_EXCEL: "Export Laporan Excel",
  EXPORT_NPF_PDF: "Export Laporan PDF",
  UPDATE_USER_STATUS: "Ubah Status Pengguna",
  RESET_USER_PASSWORD: "Reset Kata Sandi Pengguna",
};

function JsonBlock({ label, value }: { label: string; value: Prisma.JsonValue | null }) {
  if (value === null || value === undefined) {
    return (
      <p className="text-xs text-gray-500">
        {label}: -
      </p>
    );
  }
  return (
    <div>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <pre className="mt-1 max-h-48 max-w-md overflow-auto rounded bg-gray-50 p-2 text-[10px] leading-snug text-gray-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: { q?: string; action?: string; page?: string };
}) {
  const q = searchParams.q?.trim() ?? "";
  const action = searchParams.action?.trim() ?? "";

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { entityId: { contains: q } },
            { entity: { contains: q } },
            { user: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number(searchParams.page) || 1, 1), totalPages);

  const [logs, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { user: { select: { name: true, role: true } } },
    }),
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);

  return (
    <AppShell active="audit-logs">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Audit Logs</h1>
        <p className="text-sm text-gray-500">
          Jejak seluruh aktivitas kritis, termasuk eksekusi 3 Gate Supervisor dan cetak dokumen. Hanya dapat diakses
          oleh SUPERVISOR.
        </p>
      </div>

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div className="flex flex-col">
          <label htmlFor="log-q" className="mb-1 text-xs font-medium text-gray-600">
            Cari
          </label>
          <input
            id="log-q"
            name="q"
            defaultValue={q}
            placeholder="User / Entity / Entity ID"
            className="w-64 rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="log-action" className="mb-1 text-xs font-medium text-gray-600">
            Aksi
          </label>
          <select
            id="log-action"
            name="action"
            defaultValue={action}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Semua Aksi</option>
            {actions.map((a) => (
              <option key={a.action} value={a.action}>
                {ACTION_LABEL[a.action] ?? a.action}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-sm text-white">
          Terapkan
        </button>
        {(q || action) && (
          <Link href="/audit-logs" className="px-2 py-2 text-sm text-gray-600 hover:underline">
            Reset
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Waktu</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Aksi</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Entity ID</th>
              <th className="px-3 py-2">Perubahan Data</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                  Tidak ada audit log yang cocok dengan filter.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t align-top">
                <td className="px-3 py-2 text-xs text-gray-600">{formatDateTime(log.createdAt)}</td>
                <td className="px-3 py-2">
                  {log.user.name}{" "}
                  <span className="text-xs text-gray-500">
                    ({ROLE_LABEL[log.user.role] ?? log.user.role})
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium">{ACTION_LABEL[log.action] ?? log.action}</span>
                  <div className="font-mono text-[10px] text-gray-500">{log.action}</div>
                </td>
                <td className="px-3 py-2">{log.entity}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{log.entityId}</td>
                <td className="px-3 py-2">
                  {log.oldData === null && log.newData === null ? (
                    <span className="text-xs text-gray-500">-</span>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-xs text-blue-600">Lihat detail</summary>
                      <div className="mt-2 space-y-2">
                        <JsonBlock label="Sebelum" value={log.oldData} />
                        <JsonBlock label="Sesudah" value={log.newData} />
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/audit-logs"
        params={{ q, action }}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </AppShell>
  );
}
