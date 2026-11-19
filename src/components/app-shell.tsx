import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL } from "@/lib/ui";
import { CaseStatus } from "@prisma/client";
import { NotificationBell } from "@/components/notification-bell";

type NavKey = "dashboard" | "cases" | "reports" | "audit-logs" | "users";

type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  show: boolean;
  badge?: number;
};

export async function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: NavKey;
}) {
  const session = await auth();
  const role = session!.user.role;

  // Jumlah antrean per peran — dipakai sebagai badge agar Staf/Supervisor tahu
  // ada berapa kasus yang menunggu tindakan tanpa harus membuka halaman.
  const queueCount =
    role === "SUPERVISOR"
      ? await prisma.financing.count({
          where: {
            needsRevision: false,
            caseStatus: {
              in: [CaseStatus.DRAFT, CaseStatus.PENDING_SOLUTION, CaseStatus.PENDING_CLOSURE],
            },
          },
        })
      : await prisma.financing.count({
          where: { needsRevision: true, isLocked: false },
        });

  const nav: NavItem[] = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard", show: true },
    { key: "cases", href: "/cases", label: "Kasus NPF", show: true, badge: queueCount },
    { key: "reports", href: "/reports", label: "Laporan", show: true },
    { key: "audit-logs", href: "/audit-logs", label: "Audit Logs", show: role === "SUPERVISOR" },
    { key: "users", href: "/users", label: "Pengguna", show: role === "SUPERVISOR" },
  ];

  const visibleNav = nav.filter((n) => n.show);
  const badgeLabel = (n: NavItem) =>
    n.badge && n.badge > 0 ? (n.badge > 99 ? "99+" : String(n.badge)) : null;

  const renderLink = (n: NavItem, variant: "mobile" | "desktop") => {
    const badge = badgeLabel(n);
    const isActive = active === n.key;
    const base =
      variant === "mobile"
        ? "whitespace-nowrap rounded px-3 py-1.5 text-sm"
        : "text-sm";
    const state =
      variant === "mobile"
        ? isActive
          ? "bg-blue-50 font-semibold text-blue-700"
          : "text-gray-600 hover:text-gray-900"
        : isActive
          ? "font-semibold text-blue-700"
          : "text-gray-600 hover:text-gray-900";

    return (
      <Link key={n.key} href={n.href} className={`${base} ${state} flex items-center gap-1.5`}>
        {n.label}
        {badge && (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red-700">
            {badge}
          </span>
        )}
      </Link>
    );
  };


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
        <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 py-2 sm:hidden">
          {visibleNav.map((n) => renderLink(n, "mobile"))}
          {role === "STAFF" && (
            <Link
              href="/cases/new"
              className="ml-auto whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              + Kasus
            </Link>
          )}
        </nav>

        {/* Nav desktop tetap tampil normal */}
        <nav className="mx-auto hidden max-w-7xl items-center gap-8 px-6 py-2 sm:flex">
          {visibleNav.map((n) => renderLink(n, "desktop"))}
          {role === "STAFF" && (
            <Link
              href="/cases/new"
              className="ml-auto rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Kasus Baru
            </Link>
          )}
        </nav>
      </div>

      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-6">{children}</main>
    </div>
  );
}
