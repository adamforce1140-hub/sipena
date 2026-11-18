import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { StatusStepper } from "@/components/status-stepper";
import { StatusBadge, CollectibilityBadge, formatRupiah } from "@/lib/ui";
import { productLabel, SHARIAH_TERM } from "@/lib/shariah";
import { CaseDetailClient } from "./case-detail-client";
import type { SerializedCase } from "./types";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const session = await auth();
  const role = session!.user.role;

  const financing = await prisma.financing.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      collectionLogs: {
        orderBy: { createdAt: "desc" },
        include: { staff: { select: { name: true } } },
      },
      solutions: {
        orderBy: { createdAt: "desc" },
        include: {
          proposedBy: { select: { id: true, name: true, role: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      gateHistory: {
        orderBy: { createdAt: "desc" },
        include: { supervisor: { select: { id: true, name: true } } },
      },
    },
  });

  if (!financing) notFound();

  const data: SerializedCase = {
    ...financing,
    principalAmount: Number(financing.principalAmount),
    outstandingBalance: Number(financing.outstandingBalance),
    arrearsMargin: Number(financing.arrearsMargin),
    penaltyAmount: Number(financing.penaltyAmount),
    collateralValue: financing.collateralValue === null ? null : Number(financing.collateralValue),
    createdAt: financing.createdAt.toISOString(),
    updatedAt: financing.updatedAt.toISOString(),
    collectionLogs: financing.collectionLogs.map((l) => ({
      ...l,
      ptpDate: l.ptpDate?.toISOString() ?? null,
      ptpAmount: l.ptpAmount === null ? null : Number(l.ptpAmount),
      createdAt: l.createdAt.toISOString(),
    })),
    solutions: financing.solutions.map((s) => ({
      ...s,
      proposedAmount: s.proposedAmount === null ? null : Number(s.proposedAmount),
      reviewedAt: s.reviewedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    payments: financing.payments.map((p) => ({
      ...p,
      paymentAmount: Number(p.paymentAmount),
      principalPortion: Number(p.principalPortion),
      marginPortion: Number(p.marginPortion),
      penaltyPortion: Number(p.penaltyPortion),
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    gateHistory: financing.gateHistory.map((g) => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
    })),
  };

  // Ta'zir tidak dijumlahkan ke kewajiban pokok+margin karena bukan pendapatan bank.
  const totalKewajiban = data.outstandingBalance + data.arrearsMargin;

  return (
    <AppShell active="cases">
      <div className="mb-4">
        <Link href="/cases" className="text-xs text-gray-500 hover:underline">
          ← Kembali ke daftar kasus
        </Link>
      </div>

      <div className="mb-5 rounded border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{data.customer.fullName}</h1>
              <StatusBadge status={data.caseStatus} />
              <CollectibilityBadge value={data.collectibility} />
              {data.needsRevision && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Perlu revisi
                </span>
              )}
              {data.isLocked && (
                <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-white">
                  TERKUNCI
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {data.contractNumber} · Akad {productLabel(data.productType)} · CIF {data.customer.cifNumber}
            </p>
          </div>
          <div className="text-left sm:text-right">
            {role === "STAFF" && (data.caseStatus === "DRAFT" || data.needsRevision) && (
              <Link
                href={`/cases/${data.id}/edit`}
                className="mb-2 inline-block rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Edit Kasus
              </Link>
            )}
            {role === "STAFF" && data.caseStatus !== "DRAFT" && !data.needsRevision && (
              <p className="mb-2 text-xs text-gray-500">
                Data hanya dapat diedit saat status Draft atau setelah kasus dikembalikan Supervisor.
              </p>
            )}
            <p className="text-xs text-gray-500">Total Kewajiban (Pokok + Margin)</p>
            <p className="text-lg font-bold">{formatRupiah(totalKewajiban)}</p>
            <p className="text-xs text-gray-500">
              {SHARIAH_TERM.outstanding} {formatRupiah(data.outstandingBalance)} · {"Ta'zir"}{" "}
              {formatRupiah(data.penaltyAmount)} · DPD {data.dpd} hari
            </p>
          </div>
        </div>
        <div className="mt-4 border-t pt-4">
          <StatusStepper current={data.caseStatus} />
        </div>
      </div>

      <CaseDetailClient data={data} role={role} initialTab={searchParams.tab} />
    </AppShell>
  );
}
