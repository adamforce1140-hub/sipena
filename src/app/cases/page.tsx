import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import {
  StatusBadge,
  CollectibilityBadge,
  formatRupiah,
  formatDate,
  STATUS_LABEL,
} from "@/lib/ui";
import { SHARIAH_TERM } from "@/lib/shariah";
import { CaseStatus, Collectibility } from "@prisma/client";
import { Pagination } from "@/components/pagination";
import { findOverduePtpCases } from "@/lib/ptp";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    collectibility?: string;
    q?: string;
    revisi?: string;
    ptp?: string;
    page?: string;
  };
}) {
  const session = await auth();
  const role = session!.user.role;

  // Status bisa lebih dari satu, dipisah koma (mis. "ACTIVE,IN_EXECUTION"),
  // agar jumlah pada kartu dashboard sama dengan isi daftar saat diklik.
  const rawStatus = searchParams.status ?? "";
  const statusList = rawStatus
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is CaseStatus => Object.values(CaseStatus).includes(s as CaseStatus));

  const collectibility = searchParams.collectibility as Collectibility | undefined;
  const q = searchParams.q?.trim() ?? "";
  const showRevisionOnly = searchParams.revisi === "1";
  const hideRevision = searchParams.revisi === "0";
  const ptpToday = searchParams.ptp === "today";
  const ptpOverdue = searchParams.ptp === "overdue";

  const overdueIds = ptpOverdue
    ? (await findOverduePtpCases()).map((log) => log.financingId)
    : [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Supervisor hanya melihat kasus yang masih menunggu keputusannya.
  // Kasus yang sudah dikembalikan (menunggu revisi Staf) tidak lagi tampil di antrean gate.
  const revisionFilter = showRevisionOnly
    ? { needsRevision: true }
    : hideRevision || role === "SUPERVISOR"
      ? { needsRevision: false }
      : {};

  const where = {
    ...revisionFilter,
    ...(statusList.length > 0 ? { caseStatus: { in: statusList } } : {}),
    ...(ptpToday
      ? {
          AND: [
            { collectionLogs: { some: { ptpDate: { gte: todayStart, lt: todayEnd } } } },
            // Samakan dengan hitungan kartu dashboard: kasus selesai tidak dihitung.
            { caseStatus: { not: "CLOSED" as const } },
          ],
        }
      : {}),
    ...(ptpOverdue ? { id: { in: overdueIds } } : {}),
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
  };

  // Paginasi server-side: hanya satu halaman data yang dikirim ke browser.
  const total = await prisma.financing.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number(searchParams.page) || 1, 1), totalPages);

  const cases = await prisma.financing.findMany({
    where,
    include: {
      customer: { select: { cifNumber: true, fullName: true, nik: true } },
      _count: { select: { collectionLogs: true, solutions: true, payments: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });

  const revisionCount =
    role === "SUPERVISOR" && !showRevisionOnly
      ? await prisma.financing.count({ where: { needsRevision: true } })
      : 0;

  return (
    <AppShell active="cases">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Daftar Pembiayaan Bermasalah</h1>
          <p className="text-sm text-gray-500">{total} kasus ditampilkan</p>
        </div>
        {role === "STAFF" && (
          <Link
            href="/cases/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Tambah Kasus
          </Link>
        )}
      </div>

      {/* Filter */}
      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        {/* Pertahankan filter khusus saat "Terapkan" ditekan agar tidak hilang. */}
        {showRevisionOnly && <input type="hidden" name="revisi" value="1" />}
        {hideRevision && <input type="hidden" name="revisi" value="0" />}
        {ptpToday && <input type="hidden" name="ptp" value="today" />}
        {ptpOverdue && <input type="hidden" name="ptp" value="overdue" />}
        <div className="flex flex-col">
          <label htmlFor="case-q" className="mb-1 text-xs font-medium text-gray-600">
            Cari
          </label>
          <input
            id="case-q"
            name="q"
            defaultValue={q}
            placeholder="Nama / NIK / No. Akad"
            className="w-64 rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="case-status" className="mb-1 text-xs font-medium text-gray-600">
            Status Kasus
          </label>
          <select
            id="case-status"
            name="status"
            defaultValue={statusList.length === 1 ? statusList[0] : ""}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Semua Status</option>
            {Object.values(CaseStatus).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label htmlFor="case-collectibility" className="mb-1 text-xs font-medium text-gray-600">
            Kolektibilitas
          </label>
          <select
            id="case-collectibility"
            name="collectibility"
            defaultValue={collectibility ?? ""}
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">Semua</option>
            {Object.values(Collectibility).map((c) => (
              <option key={c} value={c}>
                {c.replace("KOL_", "KOL ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-gray-800 px-4 py-2 text-sm text-white">
          Terapkan
        </button>
        {(q || rawStatus || collectibility || showRevisionOnly || ptpToday || ptpOverdue) && (
          <Link href="/cases" className="px-2 py-2 text-sm text-gray-600 hover:underline">
            Reset
          </Link>
        )}
      </form>

      {ptpToday && (
        <div className="mb-4 flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Menampilkan kasus dengan PTP (janji bayar) jatuh tempo hari ini.</span>
          <Link href="/cases" className="font-medium text-amber-800 hover:underline">
            ← Hapus filter
          </Link>
        </div>
      )}
      {ptpOverdue && (
        <div className="mb-4 flex items-center justify-between rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>Menampilkan kasus dengan PTP (janji bayar) yang sudah terlewat.</span>
          <Link href="/cases" className="font-medium text-red-800 hover:underline">
            ← Hapus filter
          </Link>
        </div>
      )}
      {statusList.length > 1 && (
        <div className="mb-4 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Filter status: {statusList.map((s) => STATUS_LABEL[s]).join(" + ")}.
        </div>
      )}

      {role === "SUPERVISOR" && showRevisionOnly && (
        <div className="mb-4 flex items-center justify-between rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <span>Menampilkan kasus yang sudah Anda kembalikan dan sedang menunggu revisi Staf.</span>
          <Link href="/cases" className="font-medium text-blue-700 hover:underline">
            ← Kembali ke antrean gate
          </Link>
        </div>
      )}
      {role === "SUPERVISOR" && !showRevisionOnly && revisionCount > 0 && (
        <div className="mb-4 rounded border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {revisionCount} kasus sudah dikembalikan dan menunggu revisi Staf — tidak ditampilkan di
          antrean gate.{" "}
          <Link href="/cases?revisi=1" className="font-medium text-blue-700 hover:underline">
            Lihat daftar
          </Link>
        </div>
      )}

      {/* Tabel */}
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">No. Akad</th>
              <th className="px-3 py-2">Nasabah</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Kolekt.</th>
              <th className="px-3 py-2 text-right">{SHARIAH_TERM.outstanding}</th>
              <th className="px-3 py-2 text-right">DPD</th>
              <th className="px-3 py-2">Aktivitas</th>
              <th className="px-3 py-2">Diperbarui</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-gray-500">
                  Tidak ada kasus yang cocok dengan filter.
                </td>
              </tr>
            )}
            {cases.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/cases/${c.id}`}
                    className="text-blue-700 hover:underline"
                    title="Buka detail kasus"
                  >
                    {c.contractNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/cases/${c.id}`} className="font-medium text-blue-700 hover:underline">
                    {c.customer.fullName}
                  </Link>
                  <div className="text-xs text-gray-500">{c.customer.cifNumber}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/cases?status=${c.caseStatus}`}
                      title={`Tampilkan semua kasus berstatus ${STATUS_LABEL[c.caseStatus]}`}
                      className="hover:opacity-80"
                    >
                      <StatusBadge status={c.caseStatus} />
                    </Link>
                    {c.needsRevision && (
                      <Link
                        href="/cases?revisi=1"
                        className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                        title="Tampilkan semua kasus yang menunggu revisi"
                      >
                        Menunggu revisi
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/cases?collectibility=${c.collectibility}`}
                    title={`Tampilkan semua kasus ${c.collectibility.replace("KOL_", "KOL ")}`}
                    className="inline-block hover:opacity-80"
                  >
                    <CollectibilityBadge value={c.collectibility} />
                  </Link>
                </td>
                <td className="px-3 py-2 text-right">{formatRupiah(Number(c.outstandingBalance))}</td>
                <td className="px-3 py-2 text-right">{c.dpd}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {c._count.collectionLogs} log · {c._count.solutions} solusi · {c._count.payments} bayar
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{formatDate(c.updatedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {c.needsRevision ? (
                      <Link
                        href={`/cases/${c.id}/edit`}
                        className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Revisi Kasus
                      </Link>
                    ) : (
                      <>
                        {(c.caseStatus === "ACTIVE" || c.caseStatus === "IN_EXECUTION") && (
                          <Link
                            href={`/cases/${c.id}?tab=collection`}
                            className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            + Log Penagihan
                          </Link>
                        )}
                        {c.caseStatus === "ACTIVE" && (
                          <Link
                            href={`/cases/${c.id}?tab=solution`}
                            className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                          >
                            + Ajukan Solusi
                          </Link>
                        )}
                        {c.caseStatus === "IN_EXECUTION" && (
                          <Link
                            href={`/cases/${c.id}?tab=payment`}
                            className="rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                          >
                            + Bayar
                          </Link>
                        )}
                        {c.caseStatus !== "ACTIVE" && c.caseStatus !== "IN_EXECUTION" && (
                          <Link
                            href={`/cases/${c.id}`}
                            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Tinjau
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/cases"
        params={{
          status: rawStatus,
          collectibility,
          q,
          revisi: searchParams.revisi,
          ptp: searchParams.ptp,
        }}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />

      {role === "SUPERVISOR" && (
        <p className="mt-4 text-xs text-gray-500">
          Mode Supervisor: Anda dapat membuka detail kasus untuk memproses antrean Gate 1, Gate 2, dan Gate 3.
        </p>
      )}
    </AppShell>
  );
}
