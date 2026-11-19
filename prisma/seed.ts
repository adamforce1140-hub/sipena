// Seed NPF Management System
// 2 akun default (STAFF & SUPERVISOR).
// Data nasabah sengaja tidak disertakan agar sistem siap dipakai dengan data internal.

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // --- 2 akun default ---
  const staff = await prisma.user.upsert({
    where: { email: "staff@npf.local" },
    update: {},
    create: {
      name: "Staf Operasional",
      email: "staff@npf.local",
      passwordHash,
      role: Role.STAFF,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@npf.local" },
    update: {},
    create: {
      name: "Supervisor",
      email: "supervisor@npf.local",
      passwordHash,
      role: Role.SUPERVISOR,
    },
  });

  console.log("Seed selesai:");
  console.log("  staff@npf.local / password123");
  console.log("  supervisor@npf.local / password123");
  console.log(`  total akun: ${await prisma.user.count()} (staf=${staff.email}, supervisor=${supervisor.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
