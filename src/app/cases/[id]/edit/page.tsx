import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { EditCaseForm } from "./edit-case-form";
import { CaseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function EditCasePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (session!.user.role !== "STAFF") {
    redirect(`/cases/${params.id}`);
  }

  const financing = await prisma.financing.findUnique({
    where: { id: params.id },
    include: { customer: true },
  });
  if (!financing) notFound();

  // Boleh diedit saat DRAFT, atau saat kasus dikembalikan Supervisor untuk revisi.
  if (financing.caseStatus !== CaseStatus.DRAFT && !financing.needsRevision) {
    redirect(`/cases/${params.id}`);
  }

  return (
    <AppShell active="cases">
      <div className="mb-4">
        <Link href={`/cases/${params.id}`} className="text-xs text-gray-500 hover:underline">
          ← Kembali ke detail kasus
        </Link>
        <h1 className="mt-2 text-xl font-bold">Edit Kasus — {financing.contractNumber}</h1>
        <p className="text-sm text-gray-500">
          {financing.needsRevision
            ? "Kasus dikembalikan Supervisor. Perbaiki data lalu simpan agar masuk kembali ke antrean Gate."
            : "Data hanya dapat diedit selagi kasus berstatus Draft."}
        </p>
      </div>

      <EditCaseForm
        data={{
          id: financing.id,
          contractNumber: financing.contractNumber,
          productType: financing.productType,
          principalAmount: Number(financing.principalAmount),
          outstandingBalance: Number(financing.outstandingBalance),
          arrearsMargin: Number(financing.arrearsMargin),
          penaltyAmount: Number(financing.penaltyAmount),
          dpd: financing.dpd,
          collectibility: financing.collectibility,
          collateralType: financing.collateralType,
          collateralValue:
            financing.collateralValue === null ? null : Number(financing.collateralValue),
          customer: {
            cifNumber: financing.customer.cifNumber,
            fullName: financing.customer.fullName,
            nik: financing.customer.nik,
            phone: financing.customer.phone,
            emergencyContact: financing.customer.emergencyContact,
            address: financing.customer.address,
          },
        }}
      />
    </AppShell>
  );
}
