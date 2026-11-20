import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Penyimpanan bukti:
 * - Disk `storage/uploads` (Laragon/dev) atau `STORAGE_DIR` (volume persisten).
 * - URL absolut tetap dibaca lewat HTTP, sehingga penyimpanan objek eksternal
 *   (S3/R2) bisa dipakai tanpa perubahan kode.
 */

export const UPLOAD_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage", "uploads");

/** Simpan file; mengembalikan URL publik/relatif untuk diakses ulang. */
export async function saveUpload(name: string, data: Buffer): Promise<string> {
  const safe = safeUploadName(name);
  if (!safe) throw Object.assign(new Error("Nama file tidak valid."), { status: 400 });
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, safe), data);
  return `/api/files/${safe}`;
}

/** Baca file dari URL absolut (HTTP) atau dari disk lokal. */
export async function readUpload(nameOrUrl: string): Promise<Buffer> {
  if (/^https?:\/\//.test(nameOrUrl)) {
    const res = await fetch(nameOrUrl);
    if (!res.ok) {
      throw Object.assign(new Error("File tidak ditemukan di penyimpanan."), { status: 404 });
    }
    return Buffer.from(await res.arrayBuffer());
  }
  const safe = safeUploadName(nameOrUrl);
  if (!safe) throw Object.assign(new Error("Nama file tidak valid."), { status: 400 });
  return readFile(path.join(UPLOAD_DIR, safe));
}

/** Hapus file dari URL absolut atau disk lokal (jika nama saja). */
export async function deleteUpload(nameOrUrl: string): Promise<boolean> {
  try {
    if (/^https?:\/\//.test(nameOrUrl)) {
      const res = await fetch(nameOrUrl, { method: "DELETE" });
      return res.ok;
    }
    const safe = safeUploadName(nameOrUrl);
    if (!safe) return false;
    await unlink(path.join(UPLOAD_DIR, safe));
    return true;
  } catch {
    return false;
  }
}

/** Nama file yang aman: tanpa folder, tanpa karakter aneh, tidak diawali titik. */
export function safeUploadName(name: string): string | null {
  const base = path.basename(name);
  return /^[A-Za-z0-9._-]+$/.test(base) && !base.startsWith(".") ? base : null;
}

/** Ambil nama file dari URL bukti `/api/files/<name>`; null bila bukan format itu. */
export function uploadedFileName(url: string | null | undefined): string | null {
  if (!url) return null;
  return safeUploadName(url.split("/").pop() ?? "");
}
