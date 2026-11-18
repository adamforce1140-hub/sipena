// Seed data awal SIPENA di PostgreSQL Supabase via pg murni
// (setara prisma/seed.ts — akun default + 5 nasabah + 1 log + 1 solusi)
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const url = process.argv[2];
if (!url) { console.error("pemakaian: node scripts/seed-pg.mjs <connection-string>"); process.exit(1); }

const cuid = () => "c" + randomBytes(12).toString("hex");
const D = (n) => n.toFixed(2);

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 20000 });
await client.connect();

try {
  await client.query("BEGIN");

  const passwordHash = await bcrypt.hash("password123", 10);

  const upsertUser = async (name, email, role) => {
    const r = await client.query(
      `INSERT INTO "User" (id,name,email,"passwordHash",role) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [cuid(), name, email, passwordHash, role]
    );
    return r.rows[0].id;
  };
  const staffId = await upsertUser("Staf Operasional", "staff@npf.local", "STAFF");
  const supId = await upsertUser("Supervisor", "supervisor@npf.local", "SUPERVISOR");

  const customers = [
    { cif: "CIF-0001", nama: "Ahmad Wijaya", nik: "3175010101900001", phone: "081234567801", em: "Istri - 081234567811", addr: "Jl. Merdeka No. 10, Jakarta Timur",
      f: { kontrak: "FKT-2024-0001", produk: "MURABAHAH", pokok: 50000000, outstanding: 38500000, margin: 4200000, denda: 850000, dpd: 62, kol: "KOL_3", colType: "BPKB Motor", colVal: 15000000, status: "DRAFT" } },
    { cif: "CIF-0002", nama: "Siti Rahmawati", nik: "3175020202910002", phone: "081234567802", em: "Suami - 081234567812", addr: "Jl. Sudirman No. 25, Jakarta Pusat",
      f: { kontrak: "FKT-2024-0002", produk: "IMBT", pokok: 25000000, outstanding: 21000000, margin: 3100000, denda: 620000, dpd: 95, kol: "KOL_4", colType: "Sertifikat Rumah", colVal: 180000000, status: "ACTIVE" } },
    { cif: "CIF-0003", nama: "Budi Santoso", nik: "3175030303920003", phone: "081234567803", em: null, addr: "Jl. Gatot Subroto No. 8, Jakarta Selatan",
      f: { kontrak: "FKT-2024-0003", produk: "MMQ", pokok: 75000000, outstanding: 61000000, margin: 7800000, denda: 1550000, dpd: 128, kol: "KOL_5", colType: "BPKB Mobil", colVal: 95000000, status: "PENDING_SOLUTION" } },
    { cif: "CIF-0004", nama: "Dewi Lestari", nik: "3175040404930004", phone: "081234567804", em: "Orang Tua - 081234567814", addr: "Jl. Diponegoro No. 40, Jakarta Pusat",
      f: { kontrak: "FKT-2024-0004", produk: "MURABAHAH", pokok: 40000000, outstanding: 32000000, margin: 3900000, denda: 780000, dpd: 71, kol: "KOL_3", colType: null, colVal: null, status: "IN_EXECUTION" } },
    { cif: "CIF-0005", nama: "Rudi Hartono", nik: "3175050505940005", phone: "081234567805", em: "Saudara - 081234567815", addr: "Jl. Thamrin No. 15, Jakarta Pusat",
      f: { kontrak: "FKT-2024-0005", produk: "IMBT", pokok: 30000000, outstanding: 24000000, margin: 2800000, denda: 560000, dpd: 88, kol: "KOL_4", colType: "BPKB Motor", colVal: 22000000, status: "PENDING_CLOSURE" } },
  ];

  const finIds = {};
  for (const c of customers) {
    const cr = await client.query(
      `INSERT INTO "Customer" (id,"cifNumber","fullName",nik,phone,"emergencyContact",address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT ("cifNumber") DO UPDATE SET "fullName"=EXCLUDED."fullName" RETURNING id`,
      [cuid(), c.cif, c.nama, c.nik, c.phone, c.em, c.addr]
    );
    const cid = cr.rows[0].id;
    const fr = await client.query(
      `INSERT INTO "Financing" (id,"customerId","contractNumber","productType","principalAmount","outstandingBalance",
        "arrearsMargin","penaltyAmount",dpd,collectibility,"collateralType","collateralValue","caseStatus")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT ("contractNumber") DO UPDATE SET "outstandingBalance"=EXCLUDED."outstandingBalance" RETURNING id`,
      [cuid(), cid, c.f.kontrak, c.f.produk, D(c.f.pokok), D(c.f.outstanding), D(c.f.margin), D(c.f.denda),
        c.f.dpd, c.f.kol, c.f.colType, c.f.colVal ? D(c.f.colVal) : null, c.f.status]
    );
    finIds[c.f.kontrak] = fr.rows[0].id;
  }

  // 1 collection log (PTP 7 hari ke depan, FKT-2024-0002)
  const existing = await client.query(`SELECT COUNT(*)::int AS n FROM "CollectionLog" WHERE "financingId"=$1`, [finIds["FKT-2024-0002"]]);
  if (existing.rows[0].n === 0) {
    await client.query(
      `INSERT INTO "CollectionLog" (id,"financingId","staffId","activityType",notes,"ptpDate","ptpAmount")
       VALUES ($1,$2,$3,'CALL',$4,now() + interval '7 days',$5)`,
      [cuid(), finIds["FKT-2024-0002"], staffId, "Nasabah berjanji membayar sebagian akhir bulan ini.", D(2000000)]
    );
  }

  // 1 solusi pending (restrukturisasi, FKT-2024-0003)
  const sol = await client.query(`SELECT COUNT(*)::int AS n FROM "CaseSolution" WHERE "financingId"=$1`, [finIds["FKT-2024-0003"]]);
  if (sol.rows[0].n === 0) {
    await client.query(
      `INSERT INTO "CaseSolution" (id,"financingId","proposedById","solutionType","proposalSummary","proposedAmount",status)
       VALUES ($1,$2,$3,'RESTRUCTURE',$4,$5,'PENDING')`,
      [cuid(), finIds["FKT-2024-0003"], staffId, "Restrukturisasi tenor dari 36 menjadi 60 bulan dengan penurunan angsuran.", D(61000000)]
    );
  }

  await client.query("COMMIT");
  console.log("Seed selesai: staff@npf.local / supervisor@npf.local (password123), 5 nasabah");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("GAGAL:", e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
