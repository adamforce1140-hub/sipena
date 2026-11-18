import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Konfigurasi auth tanpa dependensi Node (Prisma/bcrypt).
 * Dipakai oleh middleware yang berjalan di Edge Runtime.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
