import { prisma } from "@/lib/prisma";
import type { CaseStatus, Collectibility, GateStep, SolutionType } from "@prisma/client";

export type CaseDocumentData = {
  id: string;
  contractNumber: string;
  productType: string;
  principalAmount: number;
  outstandingBalance: number;
  arrearsMargin: number;
  penaltyAmount: number;
  dpd: number;
  collectibility: Collectibility;
  collateralType: string | null;
  collateralValue: number | null;
  caseStatus: CaseStatus;
  isLocked: boolean;
  createdAt: Date;
  customer: {
    cifNumber: string;
    fullName: string;
    nik: string;
    phone: string;
    address: string;
  };
  payments: {
    paymentAmount: number;
    paymentDate: Date;
    notes: string | null;
  }[];
  gates: {
    gateStep: GateStep;
    decision: string;
    notes: string | null;
    createdAt: Date;
    supervisor: { name: string };
  }[];
  approvedSolution: {
    solutionType: SolutionType;
    proposalSummary: string;
    proposedAmount: number | null;
    reviewedAt: Date | null;
    reviewedBy: { name: string } | null;
  } | null;
};

/**
 * Mengambil data kasus yang dibutuhkan untuk mencetak dokumen resmi
 * (Surat Peringatan / Berita Acara) dalam bentuk angka & Date murni.
 */
export async function loadCaseDocumentData(id: string): Promise<CaseDocumentData | null> {
  const financing = await prisma.financing.findUnique({
    where: { id },
    include: {
      customer: true,
      payments: { orderBy: { paymentDate: "asc" } },
      gateHistory: {
        orderBy: { createdAt: "asc" },
        include: { supervisor: { select: { name: true } } },
      },
      solutions: {
        where: { status: "APPROVED" },
        orderBy: { reviewedAt: "desc" },
        take: 1,
        include: { reviewedBy: { select: { name: true } } },
      },
    },
  });

  if (!financing) return null;

  const approved = financing.solutions[0];

  return {
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
    caseStatus: financing.caseStatus,
    isLocked: financing.isLocked,
    createdAt: financing.createdAt,
    customer: {
      cifNumber: financing.customer.cifNumber,
      fullName: financing.customer.fullName,
      nik: financing.customer.nik,
      phone: financing.customer.phone,
      address: financing.customer.address,
    },
    payments: financing.payments.map((p) => ({
      paymentAmount: Number(p.paymentAmount),
      paymentDate: p.paymentDate,
      notes: p.notes,
    })),
    gates: financing.gateHistory.map((g) => ({
      gateStep: g.gateStep,
      decision: g.decision,
      notes: g.notes,
      createdAt: g.createdAt,
      supervisor: { name: g.supervisor.name },
    })),
    approvedSolution: approved
      ? {
          solutionType: approved.solutionType,
          proposalSummary: approved.proposalSummary,
          proposedAmount:
            approved.proposedAmount === null ? null : Number(approved.proposedAmount),
          reviewedAt: approved.reviewedAt,
          reviewedBy: approved.reviewedBy,
        }
      : null,
  };
}
