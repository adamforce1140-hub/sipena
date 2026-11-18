import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Helper guard: pastikan request berasal dari SUPERVISOR.
 * Throw Error dengan status yang bisa ditangkap API route.
 */
export async function assertSupervisor() {
  const session = await auth();
  if (!session?.user) {
    throw Object.assign(new Error("Tidak terautentikasi."), { status: 401 });
  }
  if (session.user.role !== "SUPERVISOR") {
    throw Object.assign(new Error("403 Forbidden: Aksi ini hanya untuk SUPERVISOR."), {
      status: 403,
    });
  }
  return session;
}

/**
 * Helper guard: pastikan request berasal dari STAFF.
 */
export async function assertStaff() {
  const session = await auth();
  if (!session?.user) {
    throw Object.assign(new Error("Tidak terautentikasi."), { status: 401 });
  }
  if (session.user.role !== "STAFF") {
    throw Object.assign(new Error("403 Forbidden: Aksi ini hanya untuk STAFF."), {
      status: 403,
    });
  }
  return session;
}

/**
 * Helper guard: pastikan kasus (Financing) belum terkunci permanen.
 */
export async function assertCaseNotLocked(financingId: string) {
  const financing = await prisma.financing.findUnique({
    where: { id: financingId },
    select: { id: true, isLocked: true },
  });
  if (!financing) {
    throw Object.assign(new Error("Kasus tidak ditemukan."), { status: 404 });
  }
  if (financing.isLocked) {
    throw Object.assign(new Error("Kasus telah ditutup & dikunci permanen."), { status: 423 });
  }
  return financing;
}
