import Link from "next/link";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CaseStatus, Collectibility } from "@prisma/client";
import {
  buildFilterQuery,
  filterLabel,
  loadNpfCases,
  parseNpfFilter,
} from "@/lib/npf-report";
import {
  CollectibilityBadge,
  ROLE_LABEL,
  STATUS_LABEL,
  StatusBadge,
  formatRupiah,
} from "@/lib/ui";
import { SHARIAH_TERM } from "@/lib/shariah";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { status?: string; collectibility?: string; q?: string };
}) {
  const session = await auth();
  const filter = parseNpfFilter(searchParams);
  const cases = await loadNpfCases(filter);
  const qs = buildFilterQuery(filter);

  const totals = cases.reduce(
    (acc, c) => {
      acc.outstanding += Number(c.outstandingBalance);
      acc.arrears += Number(c.arrearsMargin);
      acc.penalty += Number(c.penaltyAmount);
      acc.byCollectibility[c.collectibility] += 1;
      return acc;
    },
    {
      outstanding: 0,
      arrears: 0,
      penalty: 0,
      byCollectibility: { KOL_3: 0, KOL_4: 0, KOL_5: 0 },
    }
  );

  const summary = [
    { label: "Jumlah Kasus", value: String(cases.length), hint: filterLabel(filter) },
    {
      label: `Total ${SHARIAH_TERM.outstanding}`,
      value: formatRupiah(totals.outstanding),
      hint: "Sisa kewajiban pokok pada kasus yang ditampilkan",
    },
    {
      label: "Total Tunggakan Margin",
      value: formatRupiah(totals.arrears),
      hint: "Margin tertunggak yang menjadi hak bank",
    },
    {
      label: "Sisa Ta'zir Belum Dibayar",
      value: formatRupiah(totals.penalty),
      hint: "Ta'zir yang masih tercatat; disalurkan ke dana kebajikan, bukan pendapatan bank",
    },
  ];

  return (
    <AppShell active="reports">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Laporan Rekapitulasi NPF</h1>
          <p className="text-sm text-gray-500">
            Filter data lalu unduh sebagai Excel atau PDF. Setiap ekspor tercatat di audit trail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/reports/xlsx${qs}`}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Export Excel (.xlsx)
          </a>
          <a
            href={`/api/reports/pdf${qs}`}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Export PDF
          </a>
        </div>
      </div>

      <form method="GET" className="mb-4 flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <div className="flex flex-col">
          <label htmlFor="report-q" className="mb-1 text-xs font-medium text-gray-600">Cari</label>
          <input
            id="report-q"
            name="q"
            defaultValue={filter.q}
            placeholder="Nama / NIK / No. Akad"
            className="w-64 rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="report-status" className="mb-1 text-xs font-medium text-gray-600">
            Status Kasus
          </label>
          <select
            id="report-status"
            name="status"
            defaultValue={filter.status ?? ""}
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
          <label htmlFor="report-collectibility" className="mb-1 text-xs font-medium text-gray-600">
            Kolektibilitas
          </label>
          <select
            id="report-collectibility"
            name="collectibility"
            defaultValue={filter.collectibility ?? ""}
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
        {(filter.q || filter.status || filter.collectibility) && (
          <Link href="/reports" className="px-2 py-2 text-sm text-gray-600 hover:underline">
            Reset
          </Link>
        )}
      </form>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summary.map((c) => (
          <div key={c.label} className="rounded border bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-gray-500">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Object.entries(totals.byCollectibility).map(([key, count]) => (
          <div key={key} className="flex items-center justify-between rounded border bg-white px-4 py-3">
            <CollectibilityBadge value={key} />
            <span className="text-lg font-bold">{count}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">No. Akad</th>
              <th className="px-3 py-2">Nasabah</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Kolekt.</th>
              <th className="px-3 py-2 text-right">DPD</th>
              <th className="px-3 py-2 text-right">{SHARIAH_TERM.outstanding}</th>
              <th className="px-3 py-2 text-right">Tunggakan Margin</th>
              <th className="px-3 py-2 text-right">Ta&apos;zir</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-500">
                  Tidak ada kasus yang cocok dengan filter.
                </td>
              </tr>
            )}
            {cases.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{c.contractNumber}</td>
                <td className="px-3 py-2">
                  <Link href={`/cases/${c.id}`} className="font-medium text-blue-700 hover:underline">
                    {c.customer.fullName}
                  </Link>
                  <div className="text-xs text-gray-500">{c.customer.cifNumber}</div>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={c.caseStatus} />
                </td>
                <td className="px-3 py-2">
                  <CollectibilityBadge value={c.collectibility} />
                </td>
                <td className="px-3 py-2 text-right">{c.dpd}</td>
                <td className="px-3 py-2 text-right">{formatRupiah(Number(c.outstandingBalance))}</td>
                <td className="px-3 py-2 text-right">{formatRupiah(Number(c.arrearsMargin))}</td>
                <td className="px-3 py-2 text-right">{formatRupiah(Number(c.penaltyAmount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Dicetak oleh {session!.user.name} ({ROLE_LABEL[session!.user.role] ?? session!.user.role}).
      </p>
    </AppShell>
  );
}
