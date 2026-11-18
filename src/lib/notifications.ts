import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOverduePtpCases, findTodayPtpCases } from "@/lib/ptp";
import { formatDate, formatRupiah } from "@/lib/ui";

/** Kunci tanggal lokal (YYYY-MM-DD) agar satu pengingat hanya dibuat sekali per hari. */
function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Membuat notifikasi pengingat PTP untuk seluruh pengguna aktif.
 * - PTP hari ini  : staf menindaklanjuti, supervisor memantau.
 * - PTP terlewat  : eskalasi karena janji bayar tidak ditepati.
 *
 * Idempoten: `dedupeKey` unik membuat job boleh dijalankan berkali-kali sehari
 * tanpa menghasilkan notifikasi ganda.
 */
export async function generatePtpReminders() {
  const [todayCases, overdueCases, recipients] = await Promise.all([
    findTodayPtpCases(),
    findOverduePtpCases(),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);

  const key = dayKey(new Date());
  const rows: Prisma.NotificationCreateManyInput[] = [];

  for (const log of todayCases) {
    const amount =
      log.ptpAmount === null ? "" : ` sebesar ${formatRupiah(Number(log.ptpAmount))}`;
    for (const user of recipients) {
      rows.push({
        userId: user.id,
        type: "PTP_TODAY",
        title: "PTP jatuh tempo hari ini",
        message: `${log.financing.customer.fullName} (${log.financing.contractNumber}) berjanji membayar${amount} hari ini. Pastikan dana masuk atau catat hasil penagihan.`,
        link: `/cases/${log.financingId}?tab=collection`,
        dedupeKey: `PTP_TODAY:${log.financingId}:${user.id}:${key}`,
      });
    }
  }

  for (const log of overdueCases) {
    for (const user of recipients) {
      rows.push({
        userId: user.id,
        type: "PTP_OVERDUE",
        title: "PTP terlewat",
        message: `${log.financing.customer.fullName} (${log.financing.contractNumber}) berjanji membayar pada ${formatDate(
          log.ptpDate
        )}, tetapi belum ada catatan penagihan baru. Segera tindak lanjuti.`,
        link: `/cases/${log.financingId}?tab=collection`,
        dedupeKey: `PTP_OVERDUE:${log.financingId}:${user.id}:${key}`,
      });
    }
  }

  if (rows.length === 0) {
    return { created: 0, today: todayCases.length, overdue: overdueCases.length };
  }

  const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  return { created: result.count, today: todayCases.length, overdue: overdueCases.length };
}

/**
 * Notifikasi antrean pekerjaan harian — setiap kasus yang ada giliran tindakan
 * diberitahukan ke peran yang berwenang:
 * - STAF       : kasus perlu revisi, kasus aktif (catat penagihan),
 *                eksekusi (unggah bukti pembayaran).
 * - SUPERVISOR : kasus menunggu Gate 1 (verifikasi), Gate 2 (keputusan solusi),
 *                Gate 3 (penutupan).
 *
 * Idempoten per hari per kasus per pengguna (dedupeKey).
 */
export async function generateWorkQueueReminders() {
  const [staffUsers, supervisorUsers] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, role: "STAFF" }, select: { id: true } }),
    prisma.user.findMany({
      where: { isActive: true, role: "SUPERVISOR" },
      select: { id: true },
    }),
  ]);
  const key = dayKey(new Date());
  const rows: Prisma.NotificationCreateManyInput[] = [];

  const base = {
    select: {
      id: true,
      contractNumber: true,
      customer: { select: { fullName: true } },
    },
  };

  // ---- Untuk STAF ----
  const [revisionCases, activeCases, executionCases] = await Promise.all([
    prisma.financing.findMany({
      where: { caseStatus: { not: "CLOSED" }, needsRevision: true },
      ...base,
    }),
    prisma.financing.findMany({ where: { caseStatus: "ACTIVE" }, ...base }),
    prisma.financing.findMany({ where: { caseStatus: "IN_EXECUTION" }, ...base }),
  ]);

  const pushTo = (
    users: { id: string }[],
    financing: { id: string; contractNumber: string; customer: { fullName: string } },
    title: string,
    message: string,
    link: string
  ) => {
    for (const user of users) {
      rows.push({
        userId: user.id,
        type: "WORK_QUEUE",
        title,
        message,
        link,
        dedupeKey: `WORK_QUEUE:${financing.id}:${user.id}:${key}`,
      });
    }
  };

  for (const c of revisionCases) {
    pushTo(
      staffUsers,
      c,
      "Perlu revisi Anda",
      `Kasus ${c.contractNumber} atas nama ${c.customer.fullName} dikembalikan Supervisor. Perbaiki lalu kirim ulang.`,
      `/cases/${c.id}`
    );
  }
  for (const c of activeCases) {
    pushTo(
      staffUsers,
      c,
      "Tugas penagihan menunggu",
      `Kasus ${c.contractNumber} atas nama ${c.customer.fullName} aktif — catat hasil penagihan atau atur PTP.`,
      `/cases/${c.id}?tab=collection`
    );
  }
  for (const c of executionCases) {
    pushTo(
      staffUsers,
      c,
      "Eksekusi menunggu bukti",
      `Kasus ${c.contractNumber} atas nama ${c.customer.fullName} dalam eksekusi — unggah bukti pembayaran untuk lanjut ke Gate 3.`,
      `/cases/${c.id}?tab=payments`
    );
  }

  // ---- Untuk SUPERVISOR ----
  const [gate1Cases, gate2Cases, gate3Cases] = await Promise.all([
    prisma.financing.findMany({ where: { caseStatus: "PENDING_SOLUTION" }, ...base }),
    prisma.financing.findMany({ where: { caseStatus: "IN_EXECUTION" }, ...base }),
    prisma.financing.findMany({ where: { caseStatus: "PENDING_CLOSURE" }, ...base }),
  ]);

  for (const c of gate1Cases) {
    pushTo(
      supervisorUsers,
      c,
      "Gate 1 menunggu keputusan Anda",
      `Kasus ${c.contractNumber} atas nama ${c.customer.fullName} menunggu verifikasi Anda pada Gate 1.`,
      `/cases/${c.id}`
    );
  }
  for (const c of gate2Cases) {
    pushTo(
      supervisorUsers,
      c,
      "Gate 2 menunggu keputusan Anda",
      `Kasus ${c.contractNumber} atas nama ${c.customer.fullName} menunggu keputusan solusi Anda pada Gate 2.`,
      `/cases/${c.id}`
    );
  }
  for (const c of gate3Cases) {
    pushTo(
      supervisorUsers,
      c,
      "Gate 3 menunggu keputusan Anda",
      `Kasus ${c.contractNumber} atas nama ${c.customer.fullName} siap ditutup — berikan keputusan pada Gate 3.`,
      `/cases/${c.id}`
    );
  }

  if (rows.length === 0) {
    return { created: 0, staff: staffUsers.length, supervisor: supervisorUsers.length };
  }
  const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  return { created: result.count, staff: staffUsers.length, supervisor: supervisorUsers.length };
}

/** Notifikasi terbaru milik satu pengguna + jumlah yang belum dibaca. */
export async function getNotifications(userId: string, limit = 20) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { items, unreadCount };
}

/**
 * Notifikasi keputusan Gate untuk pihak yang bersangkutan — dibuat langsung
 * pada saat keputusan terjadi (bukan job harian):
 * - Gate 1/2 REJECT    : NEEDS_REVISION ke STAF (perbaiki lalu kirim ulang).
 * - Gate 1/2 APPROVE   : GATE_READY ke SUPERVISOR (antrean gate berikutnya).
 * - Gate 3 REJECT      : NEEDS_REVISION ke STAF (lengkapi bukti eksekusi).
 * - Gate 3 APPROVE     : pemberitahuan penutupan ke STAF (kasus selesai).
 */
const GATE_LABEL: Record<string, string> = {
  GATE_1_VERIFY: "Gate 1",
  GATE_2_SOLUTION: "Gate 2",
  GATE_3_CLOSE: "Gate 3",
};

export async function notifyGateDecision(params: {
  financingId: string;
  contractNumber: string;
  customerName: string;
  decision: "APPROVED" | "REJECTED";
  gateStep: "GATE_1_VERIFY" | "GATE_2_SOLUTION" | "GATE_3_CLOSE";
}) {
  const { financingId, contractNumber, customerName, decision, gateStep } = params;
  const gateLabel = GATE_LABEL[gateStep];

  // Staf perlu tahu bila kasus dikembalikan (semua gate) atau telah ditutup (Gate 3 approve).
  const toStaff = decision === "REJECTED" || gateStep === "GATE_3_CLOSE";
  const role = toStaff ? "STAFF" : "SUPERVISOR";

  let title: string;
  let message: string;
  if (decision === "REJECTED") {
    title = "Kasus dikembalikan untuk revisi";
    message = `Kasus ${contractNumber} atas nama ${customerName} ditolak Supervisor pada ${gateLabel}. Perbaiki lalu kirimkan kembali untuk persetujuan.`;
  } else if (gateStep === "GATE_3_CLOSE") {
    title = "Kasus selesai";
    message = `Kasus ${contractNumber} atas nama ${customerName} telah ditutup dan dikunci (${gateLabel} disetujui).`;
  } else {
    title = gateStep === "GATE_1_VERIFY" ? "Kasus menunggu verifikasi Anda" : "Solusi menunggu persetujuan Anda";
    message =
      gateStep === "GATE_1_VERIFY"
        ? `Kasus baru ${contractNumber} atas nama ${customerName} menunggu verifikasi Anda pada Gate 1.`
        : `Usulan solusi untuk kasus ${contractNumber} atas nama ${customerName} menunggu keputusan Anda pada Gate 2.`;
  }
  const type = decision === "REJECTED" ? "NEEDS_REVISION" : toStaff ? "WORK_QUEUE" : "GATE_READY";

  // Penerima: semua pengguna aktif dengan peran yang sesuai arah keputusan.
  const recipients = await prisma.user.findMany({
    where: { isActive: true, role },
    select: { id: true },
  });
  if (recipients.length === 0) return { created: 0 };

  const stamp = Date.now().toString(36);
  await prisma.notification.createMany({
    data: recipients.map((user) => ({
      userId: user.id,
      type,
      title,
      message,
      link: `/cases/${financingId}`,
      dedupeKey: `${type}:${gateStep}:${decision}:${financingId}:${stamp}`,
    })),
  });
  return { created: recipients.length };
}
