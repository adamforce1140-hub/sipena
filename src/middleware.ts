import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";

/**
 * Middleware proteksi rute berbasis role.
 * - Rute publik: /login, /api/auth/*
 * - STAFF diblokir dari /audit-logs (403)
 * - Pengunjung belum login diarahkan ke /login
 *
 * Middleware berjalan di Edge Runtime, sehingga hanya memakai authConfig
 * (tanpa Prisma/bcrypt).
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user.role as Role | undefined;

  const isAuthPage = nextUrl.pathname.startsWith("/login");
  const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

  if (isAuthApi) return NextResponse.next();

  // Job terjadwal mengautentikasi dirinya dengan CRON_SECRET di route handler,
  // sehingga tidak boleh dialihkan ke halaman login.
  if (nextUrl.pathname.startsWith("/api/cron")) return NextResponse.next();

  if (isAuthPage) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", nextUrl));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // SUPERVISOR-only routes
  if (nextUrl.pathname.startsWith("/audit-logs") && role !== "SUPERVISOR") {
    return new NextResponse("403 Forbidden: Hanya SUPERVISOR yang dapat mengakses audit log.", {
      status: 403,
    });
  }
  if (nextUrl.pathname.startsWith("/users") && role !== "SUPERVISOR") {
    return new NextResponse("403 Forbidden: Hanya SUPERVISOR yang dapat mengelola pengguna.", {
      status: 403,
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
