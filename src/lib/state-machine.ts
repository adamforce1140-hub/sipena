import { CaseStatus, Prisma } from "@prisma/client";

/**
 * State Machine NPF sesuai PRD Section 2.2.
 *
 *   DRAFT ──(Gate 1 Verify)──► ACTIVE ──(Staff ajukan solusi)──► PENDING_SOLUTION
 *     ▲                            ▲                                    │
 *     └──(Gate 1 Reject)───────────┘                                    │
 *                                        (Gate 2 Approve)                ▼
 *                                                                  IN_EXECUTION
 *                                               ▲                          │
 *                                               │(Gate 2 Reject)           │(Staff upload bukti)
 *                                               │                          ▼
 *                                          ACTIVE                   PENDING_CLOSURE
 *                                                                          │
 *                                                       (Gate 3 Close)    ▼
 *                                                                    CLOSED (LOCKED)
 */

export const STATUS_LABEL: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Aktif",
  PENDING_SOLUTION: "Review Solusi",
  IN_EXECUTION: "Eksekusi",
  PENDING_CLOSURE: "Review Tutup",
  CLOSED: "Selesai / Terkunci",
};

export const STATUS_ORDER: CaseStatus[] = [
  "DRAFT",
  "ACTIVE",
  "PENDING_SOLUTION",
  "IN_EXECUTION",
  "PENDING_CLOSURE",
  "CLOSED",
];

export class TransitionError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

/** Status di mana staf boleh mencatat log penagihan. */
export const COLLECTION_LOG_ALLOWED: CaseStatus[] = [CaseStatus.ACTIVE, CaseStatus.IN_EXECUTION];

export function assertStatus(
  current: CaseStatus,
  allowed: CaseStatus[],
  action: string
): void {
  if (!allowed.includes(current)) {
    throw new TransitionError(
      `Aksi "${action}" tidak valid pada status ${STATUS_LABEL[current]}. ` +
        `Status yang diperbolehkan: ${allowed.map((s) => STATUS_LABEL[s]).join(", ")}.`
    );
  }
}

/** Status di mana staf boleh mengajukan solusi. */
export function assertCanProposeSolution(current: CaseStatus): void {
  assertStatus(current, [CaseStatus.ACTIVE], "Ajukan Solusi");
}

/** Status di mana staf boleh mengunggah bukti pelunasan. */
export function assertCanUploadPayment(current: CaseStatus): void {
  assertStatus(current, [CaseStatus.IN_EXECUTION], "Upload Bukti Pembayaran");
}

/** Gate 1: Supervisor memverifikasi kasus DRAFT -> ACTIVE. */
export function assertGate1(current: CaseStatus): void {
  assertStatus(current, [CaseStatus.DRAFT], "Gate 1 — Verifikasi Kasus");
}

/** Gate 2: Supervisor memutuskan solusi PENDING_SOLUTION -> IN_EXECUTION / ACTIVE. */
export function assertGate2(current: CaseStatus): void {
  assertStatus(current, [CaseStatus.PENDING_SOLUTION], "Gate 2 — Persetujuan Solusi");
}

/** Gate 3: Supervisor menutup kasus PENDING_CLOSURE -> CLOSED (locked). */
export function assertGate3(current: CaseStatus): void {
  assertStatus(current, [CaseStatus.PENDING_CLOSURE], "Gate 3 — Penutupan Kasus");
}

/** Kasus hanya boleh diedit staf ketika masih DRAFT. */
export function assertEditableByStaff(current: CaseStatus): void {
  assertStatus(current, [CaseStatus.DRAFT], "Edit Data Kasus");
}

/**
 * Staf boleh memperbaiki data ketika kasus masih DRAFT, atau ketika Supervisor
 * mengembalikan kasus untuk revisi (Gate 1/2/3 reject). Tanpa ini tombol
 * "Revisi Kasus" di dashboard akan selalu gagal 409.
 */
export function assertCanRevise(current: CaseStatus, needsRevision: boolean): void {
  if (needsRevision) {
    assertStatus(
      current,
      [CaseStatus.DRAFT, CaseStatus.ACTIVE, CaseStatus.IN_EXECUTION],
      "Revisi Data Kasus"
    );
    return;
  }
  assertEditableByStaff(current);
}

export type TransitionParams = {
  financingId: string;
  from: CaseStatus[];
  to: CaseStatus;
  action: string;
  gateStep?: "GATE_1_VERIFY" | "GATE_2_SOLUTION" | "GATE_3_CLOSE";
  decision?: "APPROVED" | "REJECTED";
  supervisorId?: string;
  notes?: string | null;
  lock?: boolean;
};

/** Inti transisi; dipakai baik di dalam transaksi milik pemanggil maupun sendiri. */
async function runTransition(tx: Prisma.TransactionClient, params: TransitionParams) {
  const financing = await tx.financing.findUnique({
    where: { id: params.financingId },
    select: { id: true, caseStatus: true, isLocked: true, needsRevision: true },
  });

  if (!financing) {
    throw Object.assign(new Error("Kasus tidak ditemukan."), { status: 404 });
  }
  if (financing.isLocked) {
    throw Object.assign(new Error("Kasus telah ditutup & dikunci permanen."), { status: 423 });
  }
  assertStatus(financing.caseStatus, params.from, params.action);

  // Cegah keputusan gate tercatat ganda: kasus yang sudah dikembalikan Supervisor
  // (menunggu revisi Staf) tidak boleh diputuskan lagi pada tahap yang sama.
  // Flag needsRevision dikosongkan otomatis ketika Staf menyimpan revisi.
  if (params.gateStep && params.supervisorId && financing.needsRevision) {
    throw Object.assign(
      new Error(
        "Kasus sudah dikembalikan dan sedang menunggu revisi Staf. " +
          "Keputusan ganda tidak disimpan."
      ),
      { status: 409 }
    );
  }

  const updated = await tx.financing.update({
    where: { id: params.financingId },
    data: {
      caseStatus: params.to,
      ...(params.lock ? { isLocked: true } : {}),
      // Reject menandai kasus menunggu revisi; approve mengembalikannya ke alur normal.
      ...(params.gateStep
        ? { needsRevision: (params.decision ?? "APPROVED") === "REJECTED" }
        : {}),
    },
  });

  if (params.gateStep && params.supervisorId) {
    await tx.supervisorGate.create({
      data: {
        financingId: params.financingId,
        supervisorId: params.supervisorId,
        gateStep: params.gateStep,
        decision: params.decision ?? "APPROVED",
        notes: params.notes,
      },
    });
  }

  return updated;
}

/**
 * Transisi status + pencatatan gate dalam satu transaksi atomik.
 * Menjamin konsistensi state machine dan jejak audit SupervisorGate.
 *
 * Bila `client` diberikan, transisi ikut transaksi milik pemanggil sehingga
 * perubahan status kasus dan data terkait (mis. status solusi) tidak terpisah.
 */
export async function transitionCase(
  params: TransitionParams,
  client?: Prisma.TransactionClient
) {
  if (client) {
    return runTransition(client, params);
  }
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction((tx) => runTransition(tx, params));
}
