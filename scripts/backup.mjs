import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Backup harian SIPENA: dump database MySQL + salin folder bukti upload.
 *
 * Pemakaian:
 *   npm run db:backup
 *
 * Variabel opsional:
 *   BACKUP_DIR              folder tujuan (default: ./backups)
 *   BACKUP_RETENTION_DAYS   jumlah hari backup disimpan (default: 14)
 *   MYSQLDUMP_PATH          path mysqldump.exe bila tidak terdeteksi otomatis
 *   STORAGE_DIR             folder bukti bila dipindah dari storage/uploads
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupRoot = path.resolve(root, process.env.BACKUP_DIR ?? "backups");
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
const uploadDir = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(root, "storage", "uploads");

/** Baca DATABASE_URL dari environment atau file .env. */
async function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { readFile } = await import("node:fs/promises");
  const env = await readFile(path.join(root, ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL tidak ditemukan di environment maupun .env");
  return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
}

/** Cari mysqldump: env, lalu instalasi Laragon, lalu PATH. */
async function mysqldumpPath() {
  if (process.env.MYSQLDUMP_PATH) return process.env.MYSQLDUMP_PATH;

  const laragonMysql = "C:\\laragon\\bin\\mysql";
  try {
    const versions = await readdir(laragonMysql);
    for (const version of versions) {
      const candidate = path.join(laragonMysql, version, "bin", "mysqldump.exe");
      try {
        await stat(candidate);
        return candidate;
      } catch {
        // lanjut ke versi berikutnya
      }
    }
  } catch {
    // Laragon tidak ada; pakai PATH
  }
  return "mysqldump";
}

function timestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(
    date.getHours()
  )}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/** Hapus backup yang lebih tua dari masa retensi. */
async function prune(dir, isDir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }
  const limit = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry);
    try {
      const info = await stat(full);
      if (info.mtimeMs >= limit) continue;
      if (isDir) await rm(full, { recursive: true, force: true });
      else await unlink(full);
      removed += 1;
    } catch {
      // lewati entri yang gagal diperiksa
    }
  }
  return removed;
}

async function main() {
  const url = new URL(await databaseUrl());
  const dbName = url.pathname.replace(/^\//, "");
  const dumpPath = await mysqldumpPath();
  const stamp = timestamp();

  const dbDir = path.join(backupRoot, "db");
  const filesDir = path.join(backupRoot, "uploads");
  await mkdir(dbDir, { recursive: true });
  await mkdir(filesDir, { recursive: true });

  const target = path.join(dbDir, `${dbName}-${stamp}.sql`);
  const args = [
    `--host=${url.hostname}`,
    `--port=${url.port || "3306"}`,
    `--user=${decodeURIComponent(url.username)}`,
    "--single-transaction",
    "--no-tablespaces",
    "--default-character-set=utf8mb4",
    `--result-file=${target}`,
    dbName,
  ];

  const result = spawnSync(dumpPath, args, {
    env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `mysqldump gagal (${dumpPath}). ${result.error?.message ?? result.stderr ?? ""}`.trim()
    );
  }

  const dbSize = (await stat(target)).size;
  console.log(`[backup] database  : ${target} (${(dbSize / 1024).toFixed(1)} KB)`);

  // Salin bukti upload bila folder sumbernya ada.
  try {
    await stat(uploadDir);
    const filesTarget = path.join(filesDir, stamp);
    await cp(uploadDir, filesTarget, { recursive: true });
    console.log(`[backup] lampiran  : ${filesTarget}`);
  } catch {
    console.log(`[backup] lampiran  : dilewati (folder ${uploadDir} tidak ada)`);
  }

  const removedDb = await prune(dbDir, false);
  const removedFiles = await prune(filesDir, true);
  console.log(
    `[backup] retensi   : ${retentionDays} hari, ${removedDb} dump & ${removedFiles} folder lampiran lama dihapus`
  );
}

main().catch((e) => {
  console.error(`[backup] GAGAL: ${e.message}`);
  process.exit(1);
});
