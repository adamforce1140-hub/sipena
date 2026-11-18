import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import {
  CollectibilityBadge,
  StatusBadge,
  formatDate,
  formatRupiah,
} from "@/lib/ui";
import { SHARIAH_TERM } from "@/lib/shariah";
import { findOverduePtpCases } from "@/lib/ptp";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const role = session!.user.role;
  const name = session!.user.name;

  if (role === "STAFF") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [activeCases, ptpToday, needRevision, worklist, overduePtp] = await Promise.all([
      // Kasus yang sudah dikembalikan Supervisor dihitung di kartu "Perlu Revisi",
      // bukan di tugas penagihan aktif (agar satu kasus tidak terhitung dua kali).
      prisma.financing.count({
        where: { caseStatus: { in: ["ACTIVE", "IN_EXECUTION"] }, needsRevision: false },
      }),
      prisma.collectionLog.count({
        where: {
          ptpDate: { gte: todayStart, lt: todayEnd },
          financing: { caseStatus: { not: "CLOSED" } },
        },
      }),
      // Kasus yang dikembalikan Supervisor dan menunggu revisi Staf.
      prisma.financing.count({ where: { needsRevision: true } }),
      prisma.financing.findMany({
        where: {
          OR: [
            { caseStatus: { in: ["ACTIVE", "IN_EXECUTION"] } },
            { needsRevision: true },
          ],
        },
        include: {
          customer: { select: { fullName: true, cifNumber: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      findOverduePtpCases(),
    ]);

    const cards = [
      {
        label: "Tugas Penagihan Aktif",
        value: String(activeCases),
        hint: "Kasus berstatus Aktif / Eksekusi yang belum dikembalikan",
        href: "/cases?status=ACTIVE,IN_EXECUTION&revisi=0",
        accent: "text-blue-700",
      },
      {
        label: "PTP Jatuh Tempo Hari Ini",
        value: String(ptpToday),
        hint: "Janji bayar nasabah pada tanggal ini",
        href: "/cases?ptp=today",
        accent: "text-amber-600",
      },
      {
        label: "PTP Terlewat",
        value: String(overduePtp.length),
        hint: "Janji bayar terakhir sudah lewat, belum ada log penagihan baru",
        href: "/cases?ptp=overdue",
        accent: "text-red-600",
      },
      {
        label: "Kasus Dikembalikan / Perlu Revisi",
        value: String(needRevision),
        hint: "Ditolak Supervisor pada gate, menunggu perbaikan Anda",
        href: "/cases?revisi=1",
        accent: "text-red-600",
      },
    ];

    return (
      <AppShell active="dashboard">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Dashboard Staf</h1>
          <p className="text-sm text-gray-500">
            Selamat datang, {name}. Fokus pada tugas penagihan dan pengajuan solusi berikut.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href} className="rounded border bg-white p-5 hover:border-blue-300">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{c.label}</p>
              <p className={`mt-2 text-3xl font-bold ${c.accent}`}>{c.value}</p>
              <p className="mt-1 text-xs text-gray-500">{c.hint}</p>
            </Link>
          ))}
        </div>

        <section className="rounded border bg-white">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-base font-semibold">Kasus Aktif, Eksekusi &amp; Perlu Revisi</h2>
            <Link href="/cases" className="text-xs text-blue-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">No. Akad</th>
                  <th className="px-3 py-2">Nasabah</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Kolekt.</th>
                  <th className="px-3 py-2 text-right">{SHARIAH_TERM.outstanding}</th>
                  <th className="px-3 py-2 text-right">DPD</th>
                  <th className="px-3 py-2">Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {worklist.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                      Tidak ada kasus aktif. Semua tugas penagihan sudah selesai.
                    </td>
                  </tr>
                )}
                {worklist.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{c.contractNumber}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {c.customer.fullName}
                      </Link>
                      <div className="text-xs text-gray-500">{c.customer.cifNumber}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={c.caseStatus} />
                        {c.needsRevision && (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Perlu revisi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <CollectibilityBadge value={c.collectibility} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatRupiah(Number(c.outstandingBalance))}
                    </td>
                    <td className="px-3 py-2 text-right">{c.dpd}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {c.needsRevision ? (
                          <Link
                            href={`/cases/${c.id}/edit`}
                            className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          >
                            Revisi Kasus
                          </Link>
                        ) : (
                          <>
                            <Link
                              href={`/cases/${c.id}?tab=collection`}
                              className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            >
                              + Log Penagihan
                            </Link>
                            {c.caseStatus === "ACTIVE" && (
                              <Link
                                href={`/cases/${c.id}?tab=solution`}
                                className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                              >
                                + Ajukan Solusi
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
        </section>
      </AppShell>
    );
  }

  const [totalOutstanding, recovery, byCollectibility, gateQueue] = await Promise.all([
    // Portofolio NPF hanya kasus yang masih berjalan; kasus selesai/terkunci dikeluarkan.
    prisma.financing.aggregate({
      where: { caseStatus: { not: "CLOSED" } },
      _sum: { outstandingBalance: true },
    }),
    prisma.casePayment.aggregate({ _sum: { paymentAmount: true, penaltyPortion: true } }),
    prisma.financing.groupBy({
      by: ["collectibility"],
      where: { caseStatus: { not: "CLOSED" } },
      _count: { _all: true },
      _sum: { outstandingBalance: true },
    }),
    prisma.financing.findMany({
      // Kasus yang sudah ditolak Supervisor (needsRevision) sedang menunggu revisi Staf,
      // sehingga tidak lagi dihitung sebagai antrean tindakan Supervisor.
      where: {
        caseStatus: { in: ["DRAFT", "PENDING_SOLUTION", "PENDING_CLOSURE"] },
        isLocked: false,
        needsRevision: false,
      },
      include: { customer: { select: { fullName: true } } },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  const gate1 = gateQueue.filter((c) => c.caseStatus === "DRAFT").length;
  const gate2 = gateQueue.filter((c) => c.caseStatus === "PENDING_SOLUTION").length;
  const gate3 = gateQueue.filter((c) => c.caseStatus === "PENDING_CLOSURE").length;

  const outstanding = Number(totalOutstanding._sum.outstandingBalance ?? 0);
  // Ta'zir tidak termasuk dana pulih karena wajib disalurkan ke dana kebajikan.
  // Dihitung dari nominal pembayaran dikurangi porsi ta'zir agar pembayaran lama
  // yang belum menyimpan alokasi pokok/margin tetap terhitung.
  const totalRecovery =
    Number(recovery._sum.paymentAmount ?? 0) - Number(recovery._sum.penaltyPortion ?? 0);

  const gateCards = [
    {
      label: "Menunggu Verifikasi Awal (Gate 1)",
      value: gate1,
      href: "/cases?status=DRAFT",
      style: "border-gray-300 bg-gray-50 text-gray-800",
      badge: "bg-gray-800 text-white",
    },
    {
      label: "Menunggu Persetujuan Solusi (Gate 2)",
      value: gate2,
      href: "/cases?status=PENDING_SOLUTION",
      style: "border-amber-300 bg-amber-50 text-amber-900",
      badge: "bg-amber-600 text-white",
    },
    {
      label: "Siap Ditutup / Finalisasi (Gate 3)",
      value: gate3,
      href: "/cases?status=PENDING_CLOSURE",
      style: "border-orange-300 bg-orange-50 text-orange-900",
      badge: "bg-orange-600 text-white",
    },
  ];

  const collectibilityRows = (["KOL_3", "KOL_4", "KOL_5"] as const).map((key) => {
    const row = byCollectibility.find((g) => g.collectibility === key);
    return {
      key,
      count: row?._count._all ?? 0,
      outstanding: Number(row?._sum.outstandingBalance ?? 0),
    };
  });
  const maxCount = Math.max(...collectibilityRows.map((r) => r.count), 1);

  return (
    <AppShell active="dashboard">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard Supervisor</h1>
        <p className="text-sm text-gray-500">
          Selamat datang, {name}. Tinjau antrean gate dan pantau kinerja portofolio NPF.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {gateCards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`flex items-start justify-between rounded border p-5 ${c.style}`}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">{c.label}</p>
              <p className="mt-1 text-xs text-gray-700">Klik untuk membuka antrean</p>
            </div>
            <span
              className={`ml-3 inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-base font-bold ${c.badge}`}
            >
              {c.value}
            </span>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total {SHARIAH_TERM.outstanding} NPF
          </p>
          <p className="mt-2 text-2xl font-bold">{formatRupiah(outstanding)}</p>
          <p className="mt-1 text-xs text-gray-500">
            Sisa kewajiban pokok kasus NPF berjalan (kasus selesai tidak dihitung)
          </p>
        </div>
        <div className="rounded border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total Dana Pulih (Akumulasi Pokok + Margin)
          </p>
          <p className="mt-2 text-2xl font-bold text-green-700">{formatRupiah(totalRecovery)}</p>
          <p className="mt-1 text-xs text-gray-500">
            Seluruh pembayaran yang tercatat tanpa batas periode; {"ta'zir"} tidak dihitung sebagai
            pendapatan bank
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded border bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Distribusi Kolektibilitas</h2>
          <ul className="space-y-4">
            {collectibilityRows.map((r) => (
              <li key={r.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CollectibilityBadge value={r.key} />
                    <span className="text-gray-500">{r.count} kasus</span>
                  </div>
                  <span className="font-medium">{formatRupiah(r.outstanding)}</span>
                </div>
                <div className="h-2 w-full rounded bg-gray-100">
                  <div
                    className="h-2 rounded bg-blue-600"
                    style={{ width: `${(r.count / maxCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border bg-white">
          <div className="border-b px-5 py-3">
            <h2 className="text-base font-semibold">Antrean Menunggu Tindakan Anda</h2>
            <p className="text-xs text-gray-500">{gateQueue.length} kasus menunggu Gate</p>
          </div>
          <ul className="divide-y">
            {gateQueue.length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-gray-500">
                Tidak ada antrean. Semua kasus sudah diproses.
              </li>
            )}
            {gateQueue.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50"
                >
                  <span>
                    <span className="font-medium">{c.customer.fullName}</span>
                    <span className="ml-2 font-mono text-xs text-gray-500">{c.contractNumber}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      diperbarui {formatDate(c.updatedAt)}
                    </span>
                  </span>
                  <StatusBadge status={c.caseStatus} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
