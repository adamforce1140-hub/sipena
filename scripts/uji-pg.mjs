// Uji koneksi PostgreSQL Supabase dengan pg murni (lewat pooler)
import pg from "pg";

const url = process.argv[2];
if (!url) { console.error("pemakaian: node scripts/uji-pg.mjs <connection-string>"); process.exit(1); }

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const r = await client.query("select version() as v");
  console.log("TERSAMBUNG:", r.rows[0].v.slice(0, 60));
} catch (e) {
  console.error("GAGAL:", e.code ?? "-", e.message?.slice(0, 200));
} finally {
  await client.end().catch(() => {});
}
