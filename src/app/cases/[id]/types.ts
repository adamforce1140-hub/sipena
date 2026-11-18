import { CaseStatus, Collectibility, ActivityType, SolutionType, GateStep, Role } from "@prisma/client";

export type SerializedCollectionLog = {
  id: string;
  activityType: ActivityType;
  notes: string;
  ptpDate: string | null;
  ptpAmount: number | null;
  evidenceUrl: string | null;
  createdAt: string;
  staff: { name: string };
};

export type SerializedSolution = {
  id: string;
  solutionType: SolutionType;
  proposalSummary: string;
  proposedAmount: number | null;
  supportingUrl: string | null;
  status: string;
  supervisorNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  proposedBy: { id: string; name: string; role: Role };
  reviewedBy: { id: string; name: string } | null;
};

export type SerializedPayment = {
  id: string;
  paymentAmount: number;
  principalPortion: number;
  marginPortion: number;
  penaltyPortion: number;
  paymentDate: string;
  receiptUrl: string;
  notes: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

export type SerializedGate = {
  id: string;
  gateStep: GateStep;
  decision: string;
  notes: string | null;
  createdAt: string;
  supervisor: { id: string; name: string };
};

export type SerializedCase = {
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
  needsRevision: boolean;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    cifNumber: string;
    fullName: string;
    nik: string;
    phone: string;
    emergencyContact: string | null;
    address: string;
  };
  collectionLogs: SerializedCollectionLog[];
  solutions: SerializedSolution[];
  payments: SerializedPayment[];
  gateHistory: SerializedGate[];
};
