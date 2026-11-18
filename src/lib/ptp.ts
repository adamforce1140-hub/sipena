import { prisma } from "@/lib/prisma";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Log penagihan terbaru per kasus yang memuat janji bayar (PTP).
 * Hanya log terbaru yang dipakai agar janji bayar lama yang sudah ditindaklanjuti
 * tidak terus muncul sebagai tunggakan.
 */
async function latestPtpLogs() {
  return prisma.collectionLog.findMany({
    where: {
      ptpDate: { not: null },
      financing: { caseStatus: { not: "CLOSED" } },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["financingId"],
    select: {
      financingId: true,
      ptpDate: true,
      ptpAmount: true,
      financing: {
        select: {
          id: true,
          contractNumber: true,
          customer: { select: { fullName: true } },
        },
      },
    },
  });
}

/** Kasus berjalan (belum CLOSED) yang PTP terakhirnya sudah lewat dari hari ini. */
export async function findOverduePtpCases() {
  const todayStart = startOfToday();
  const latest = await latestPtpLogs();
  return latest.filter((log) => log.ptpDate !== null && log.ptpDate < todayStart);
}

/** Kasus berjalan (belum CLOSED) yang PTP terakhirnya jatuh tempo hari ini. */
export async function findTodayPtpCases() {
  const todayStart = startOfToday();
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const latest = await latestPtpLogs();
  return latest.filter(
    (log) => log.ptpDate !== null && log.ptpDate >= todayStart && log.ptpDate < tomorrow
  );
}
