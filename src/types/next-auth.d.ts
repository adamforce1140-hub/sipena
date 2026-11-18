import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: "STAFF" | "SUPERVISOR";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "STAFF" | "SUPERVISOR";
  }
}
