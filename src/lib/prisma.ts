import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Error koneksi yang sifatnya sementara (jaringan / pooler Supabase sibuk). */
const RETRYABLE_CODES = new Set(["P1001", "P1017", "P2024"]);
const MAX_RETRY = 2;

function isRetryable(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && RETRYABLE_CODES.has(code);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalisasi URL Supabase.
 *
 * Transaction pooler (port 6543 + `pgbouncer=true`) mematikan prepared statement,
 * sehingga setiap query menjadi ~5x lebih lambat (terukur 1,2 detik vs 0,24 detik
 * dari Indonesia ke Sydney). Session pooler (port 5432) tetap mendukung prepared
 * statement dan tetap bisa diakses lewat IPv4, jadi URL otomatis diarahkan ke sana.
 *
 * Di serverless (Vercel) koneksi dibatasi 1 per instance agar kuota session
 * pooler Supabase tidak habis saat fungsi dijalankan paralel.
 */
function normalizeDatabaseUrl(raw: string | undefined) {
  if (!raw) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  if (url.hostname.endsWith("pooler.supabase.com") && url.port === "6543") {
    url.port = "5432";
    url.searchParams.delete("pgbouncer");
  }

  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "20");
  if (process.env.VERCEL) url.searchParams.set("connection_limit", "1");

  return url.toString();
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

/**
 * Database berada di Sydney, sehingga koneksi sesekali gagal sesaat
 * ("Can't reach database server"). Query diulang maksimal 2x sebelum
 * benar-benar menyerah, agar halaman tidak menampilkan error runtime.
 */
function createClient(): PrismaClient {
  const base = new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  const extended = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        let attempt = 0;
        for (;;) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt >= MAX_RETRY || !isRetryable(error)) throw error;
            attempt += 1;
            await sleep(300 * attempt);
          }
        }
      },
    },
  });

  // Tipe dikembalikan sebagai PrismaClient biasa agar tetap cocok dengan
  // parameter bertipe TransactionClient di modul lain.
  return extended as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
