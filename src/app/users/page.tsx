import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell";
import { UsersTable } from "./users-table";
import { NewUserForm } from "./new-user-form";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { collectionLogs: true, payments: true } },
    },
  });

  return (
    <AppShell active="users">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Manajemen Pengguna</h1>
        <p className="text-sm text-gray-500">
          Kelola akses akun Staf dan Supervisor. Akun nonaktif tidak dapat login, namun riwayat
          aktivitasnya tetap tersimpan.
        </p>
      </div>

      <NewUserForm />

      <UsersTable
        currentUserId={session!.user.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
          collectionLogs: u._count.collectionLogs,
          payments: u._count.payments,
        }))}
      />
    </AppShell>
  );
}
