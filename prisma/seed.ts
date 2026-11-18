// Seed NPF Management System
// 2 akun default (STAFF & SUPERVISOR) + 5 nasabah bermasalah contoh

import { PrismaClient, Role, CaseStatus, Collectibility, ActivityType, SolutionType } from "@prisma/client";
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

  // --- 5 nasabah bermasalah contoh ---
  const customers = [
    {
      cifNumber: "CIF-0001",
      fullName: "Ahmad Wijaya",
      nik: "3175010101900001",
      phone: "081234567801",
      emergencyContact: "Istri - 081234567811",
      address: "Jl. Merdeka No. 10, Jakarta Timur",
      financing: {
        contractNumber: "FKT-2024-0001",
        productType: "MURABAHAH",
        principalAmount: 50000000,
        outstandingBalance: 38500000,
        arrearsMargin: 4200000,
        penaltyAmount: 850000,
        dpd: 62,
        collectibility: Collectibility.KOL_3,
        collateralType: "BPKB Motor",
        collateralValue: 15000000,
        caseStatus: CaseStatus.DRAFT,
      },
    },
    {
      cifNumber: "CIF-0002",
      fullName: "Siti Rahmawati",
      nik: "3175020202910002",
      phone: "081234567802",
      emergencyContact: "Suami - 081234567812",
      address: "Jl. Sudirman No. 25, Jakarta Pusat",
      financing: {
        contractNumber: "FKT-2024-0002",
        productType: "IMBT",
        principalAmount: 25000000,
        outstandingBalance: 21000000,
        arrearsMargin: 3100000,
        penaltyAmount: 620000,
        dpd: 95,
        collectibility: Collectibility.KOL_4,
        collateralType: "Sertifikat Rumah",
        collateralValue: 180000000,
        caseStatus: CaseStatus.ACTIVE,
      },
    },
    {
      cifNumber: "CIF-0003",
      fullName: "Budi Santoso",
      nik: "3175030303920003",
      phone: "081234567803",
      emergencyContact: null,
      address: "Jl. Gatot Subroto No. 8, Jakarta Selatan",
      financing: {
        contractNumber: "FKT-2024-0003",
        productType: "MMQ",
        principalAmount: 75000000,
        outstandingBalance: 61000000,
        arrearsMargin: 7800000,
        penaltyAmount: 1550000,
        dpd: 128,
        collectibility: Collectibility.KOL_5,
        collateralType: "BPKB Mobil",
        collateralValue: 95000000,
        caseStatus: CaseStatus.PENDING_SOLUTION,
      },
    },
    {
      cifNumber: "CIF-0004",
      fullName: "Dewi Lestari",
      nik: "3175040404930004",
      phone: "081234567804",
      emergencyContact: "Orang Tua - 081234567814",
      address: "Jl. Diponegoro No. 40, Jakarta Pusat",
      financing: {
        contractNumber: "FKT-2024-0004",
        productType: "MURABAHAH",
        principalAmount: 40000000,
        outstandingBalance: 32000000,
        arrearsMargin: 3900000,
        penaltyAmount: 780000,
        dpd: 71,
        collectibility: Collectibility.KOL_3,
        collateralType: null,
        collateralValue: null,
        caseStatus: CaseStatus.IN_EXECUTION,
      },
    },
    {
      cifNumber: "CIF-0005",
      fullName: "Rudi Hartono",
      nik: "3175050505940005",
      phone: "081234567805",
      emergencyContact: "Saudara - 081234567815",
      address: "Jl. Thamrin No. 15, Jakarta Pusat",
      financing: {
        contractNumber: "FKT-2024-0005",
        productType: "IMBT",
        principalAmount: 30000000,
        outstandingBalance: 24000000,
        arrearsMargin: 2800000,
        penaltyAmount: 560000,
        dpd: 88,
        collectibility: Collectibility.KOL_4,
        collateralType: "BPKB Motor",
        collateralValue: 22000000,
        caseStatus: CaseStatus.PENDING_CLOSURE,
      },
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { cifNumber: c.cifNumber },
      update: {},
      create: {
        cifNumber: c.cifNumber,
        fullName: c.fullName,
        nik: c.nik,
        phone: c.phone,
        emergencyContact: c.emergencyContact,
        address: c.address,
        financings: { create: c.financing },
      },
    });
  }

  // --- Contoh log penagihan & solusi untuk kasus yang relevan ---
  const fkt2 = await prisma.financing.findUnique({ where: { contractNumber: "FKT-2024-0002" } });
  const fkt3 = await prisma.financing.findUnique({ where: { contractNumber: "FKT-2024-0003" } });

  if (fkt2) {
    await prisma.collectionLog.create({
      data: {
        financingId: fkt2.id,
        staffId: staff.id,
        activityType: ActivityType.CALL,
        notes: "Nasabah berjanji membayar sebagian akhir bulan ini.",
        ptpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ptpAmount: 2000000,
      },
    });
  }

  if (fkt3) {
    await prisma.caseSolution.create({
      data: {
        financingId: fkt3.id,
        proposedById: staff.id,
        solutionType: SolutionType.RESTRUCTURE,
        proposalSummary: "Restrukturisasi tenor dari 36 menjadi 60 bulan dengan penurunan angsuran.",
        proposedAmount: 61000000,
        status: "PENDING",
      },
    });
  }

  console.log("Seed selesai:");
  console.log("  staff@npf.local / password123");
  console.log("  supervisor@npf.local / password123");
  console.log("  5 nasabah bermasalah + 1 collection log + 1 solusi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
