import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/ui";
import { NotificationBell } from "@/components/notification-bell";

export async function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "dashboard" | "cases" | "reports" | "audit-logs" | "users";
}) {
  const session = await auth();
  const role = session!.user.role;

  const nav = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", show: true },
    { key: "cases", href: "/cases", label: "Kasus NPF", show: true },
    { key: "reports", href: "/reports", label: "Laporan", show: true },
    { key: "audit-logs", href: "/audit-logs", label: "Audit Logs", show: role === "SUPERVISOR" },
    { key: "users", href: "/users", label: "Pengguna", show: role === "SUPERVISOR" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6 lg:flex-nowrap">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="shrink-0 text-base font-bold text-blue-700 sm:text-lg">
              SIPENA
            </Link>
            <span className="truncate text-sm text-gray-600">
              {session!.user.name}
              <span className="ml-2 hidden rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium sm:inline">
                {ROLE_LABEL[role] ?? role}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <NotificationBell />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 hover:underline"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Nav bisa digeser horizontal di layar sempit */}
      <div className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:hidden">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-sm ${
                  active === n.key
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {n.label}
              </Link>
            ))}
        </nav>

        {/* Nav desktop tetap tampil normal */}
        <nav className="mx-auto hidden max-w-7xl gap-8 px-6 py-2 sm:flex">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className={`text-sm ${
                  active === n.key
                    ? "font-semibold text-blue-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {n.label}
              </Link>
            ))}
        </nav>
      </div>

      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">{children}</main>
    </div>
  );
}
