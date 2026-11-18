import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Lokasi penyimpanan bukti. Default `storage/uploads` di root proyek.
 * Set `STORAGE_DIR` bila ingin menaruh file di volume/disk terpisah
 * (mis. D:\sipena-storage) agar tidak ikut hilang saat aplikasi di-redeploy.
 */
export const UPLOAD_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage", "uploads");

/** Nama file yang aman: tanpa folder, tanpa karakter aneh, tidak diawali titik. */
export function safeUploadName(name: string): string | null {
  const base = path.basename(name);
  return /^[A-Za-z0-9._-]+$/.test(base) && !base.startsWith(".") ? base : null;
}

export async function saveUpload(name: string, data: Buffer) {
  const safe = safeUploadName(name);
  if (!safe) throw Object.assign(new Error("Nama file tidak valid."), { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, safe), data);
  return safe;
}

export async function readUpload(name: string): Promise<Buffer> {
  const safe = safeUploadName(name);
  if (!safe) throw Object.assign(new Error("Nama file tidak valid."), { status: 400 });
  return readFile(path.join(UPLOAD_DIR, safe));
}

/** Hapus file; mengembalikan false bila file sudah tidak ada. */
export async function deleteUpload(name: string): Promise<boolean> {
  const safe = safeUploadName(name);
  if (!safe) return false;
  try {
    await unlink(path.join(UPLOAD_DIR, safe));
    return true;
  } catch {
    return false;
  }
}

/** Ambil nama file dari URL bukti `/api/files/<name>`; null bila bukan format itu. */
export function uploadedFileName(url: string | null | undefined): string | null {
  if (!url) return null;
  return safeUploadName(url.split("/").pop() ?? "");
}
