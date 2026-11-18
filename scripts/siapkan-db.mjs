// Membuat semua tabel SIPENA di PostgreSQL Supabase (setara schema.prisma).
// Pemakaian: node scripts/siapkan-db.mjs "<DATABASE_URL>"
import pg from "pg";

const url = process.argv[2];
if (!url) { console.error("pemakaian: node scripts/siapkan-db.mjs <connection-string>"); process.exit(1); }

const DDL = `
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('STAFF','SUPERVISOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CaseStatus" AS ENUM ('DRAFT','ACTIVE','PENDING_SOLUTION','IN_EXECUTION','PENDING_CLOSURE','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "Collectibility" AS ENUM ('KOL_3','KOL_4','KOL_5');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ActivityType" AS ENUM ('CALL','WHATSAPP','VISIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SolutionType" AS ENUM ('RESTRUCTURE','PENALTY_WAIVER','WARNING_LETTER_SP1','WARNING_LETTER_SP2','WARNING_LETTER_SP3','COLLATERAL_EXECUTION','WRITE_OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "GateStep" AS ENUM ('GATE_1_VERIFY','GATE_2_SOLUTION','GATE_3_CLOSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SolutionStatus" AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "GateDecision" AS ENUM ('APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('PTP_TODAY','PTP_OVERDUE','NEEDS_REVISION','GATE_READY','WORK_QUEUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role "Role" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Customer" (
  id TEXT PRIMARY KEY,
  "cifNumber" TEXT NOT NULL UNIQUE,
  "fullName" TEXT NOT NULL,
  nik TEXT NOT NULL,
  phone TEXT NOT NULL,
  "emergencyContact" TEXT,
  address TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Financing" (
  id TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL REFERENCES "Customer"(id),
  "contractNumber" TEXT NOT NULL UNIQUE,
  "productType" TEXT NOT NULL,
  "principalAmount" DECIMAL(18,2) NOT NULL,
  "outstandingBalance" DECIMAL(18,2) NOT NULL,
  "arrearsMargin" DECIMAL(18,2) NOT NULL,
  "penaltyAmount" DECIMAL(18,2) NOT NULL,
  dpd INTEGER NOT NULL,
  collectibility "Collectibility" NOT NULL,
  "collateralType" TEXT,
  "collateralValue" DECIMAL(18,2),
  "caseStatus" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "needsRevision" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Financing_caseStatus_needsRevision_updatedAt_idx" ON "Financing"("caseStatus","needsRevision","updatedAt");
CREATE INDEX IF NOT EXISTS "Financing_collectibility_idx" ON "Financing"("collectibility");

CREATE TABLE IF NOT EXISTS "CollectionLog" (
  id TEXT PRIMARY KEY,
  "financingId" TEXT NOT NULL REFERENCES "Financing"(id),
  "staffId" TEXT NOT NULL REFERENCES "User"(id),
  "activityType" "ActivityType" NOT NULL,
  notes TEXT NOT NULL,
  "ptpDate" TIMESTAMPTZ,
  "ptpAmount" DECIMAL(18,2),
  "evidenceUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CollectionLog_ptpDate_idx" ON "CollectionLog"("ptpDate");

CREATE TABLE IF NOT EXISTS "CaseSolution" (
  id TEXT PRIMARY KEY,
  "financingId" TEXT NOT NULL REFERENCES "Financing"(id),
  "proposedById" TEXT NOT NULL REFERENCES "User"(id),
  "solutionType" "SolutionType" NOT NULL,
  "proposalSummary" TEXT NOT NULL,
  "proposedAmount" DECIMAL(18,2),
  "supportingUrl" TEXT,
  status "SolutionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT REFERENCES "User"(id),
  "supervisorNotes" TEXT,
  "reviewedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "CasePayment" (
  id TEXT PRIMARY KEY,
  "financingId" TEXT NOT NULL REFERENCES "Financing"(id),
  "uploadedById" TEXT NOT NULL REFERENCES "User"(id),
  "paymentAmount" DECIMAL(18,2) NOT NULL,
  "principalPortion" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "marginPortion" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "penaltyPortion" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "paymentDate" TIMESTAMPTZ NOT NULL,
  "receiptUrl" TEXT NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "SupervisorGate" (
  id TEXT PRIMARY KEY,
  "financingId" TEXT NOT NULL REFERENCES "Financing"(id),
  "supervisorId" TEXT NOT NULL REFERENCES "User"(id),
  "gateStep" "GateStep" NOT NULL,
  decision "GateDecision" NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "oldData" JSONB,
  "newData" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "Notification" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type "NotificationType" NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  "dedupeKey" TEXT NOT NULL UNIQUE,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId","readAt","createdAt");
`;

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20000 });
try {
  await client.connect();
  await client.query(DDL);
  const t = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log("BERHASIL. Tabel di Supabase:", t.rows.map((r) => r.table_name).join(", "));
} catch (e) {
  console.error("GAGAL:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
