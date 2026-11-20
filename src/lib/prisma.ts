import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Error koneksi yang sifatnya sementara (jaringan / pooler Supabase sibuk). */
const RETRYABLE_CODES = new Set(["P1001", "P1017", "P2024"]);
const RETRYABLE_MESSAGES = ["EMAXCONN", "EMAXCONNSESSION"];
const MAX_RETRY = 2;

function isRetryable(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && RETRYABLE_CODES.has(code)) return true;
  const msg = String((error as { message?: unknown } | null)?.message ?? "");
  return RETRYABLE_MESSAGES.some((m) => msg.includes(m));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Normalisasi URL Supabase.
 *
 * Serverless (Vercel/Lambda): pakai transaction pooler (port 6543) dengan
 * `pgbouncer=true` agar Prisma tidak mengirim prepared statements (tidak
 * kompatibel dengan transaction mode). Transaction pooler dirancang untuk
 * ratusan koneksi konkuren — cocok untuk serverless.
 *
 * Lokal: pakai session pooler (port 5432) agar prepared statements aktif
 * dan query lebih cepat (~5x).
 */
function normalizeDatabaseUrl(raw: string | undefined) {
  if (!raw) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (url.hostname.endsWith("pooler.supabase.com")) {
    if (isServerless) {
      // Serverless: paksa transaction pooler + pgbouncer mode
      url.port = "6543";
      url.searchParams.set("pgbouncer", "true");
    } else {
      // Lokal: paksa session pooler untuk prepared statements
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
  }

  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "20");

  // Batasi 1 koneksi per instance di serverless agar tidak membebani pooler
  const poolMax = process.env.DB_POOL_MAX || (isServerless ? "1" : "5");
  url.searchParams.set("connection_limit", poolMax);

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
