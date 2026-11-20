import path from "path";
import { supabase, STORAGE_BUCKET } from "./supabase";

/**
 * Penyimpanan bukti menggunakan Supabase Storage (kompatibel Vercel serverless).
 * - File disimpan di bucket Supabase Storage
 * - URL absolut bisa dari storage eksternal lain (S3/R2)
 */

/** Simpan file ke Supabase Storage; mengembalikan URL relatif untuk diakses ulang. */
export async function saveUpload(name: string, data: Buffer): Promise<string> {
  const safe = safeUploadName(name);
  if (!safe) throw Object.assign(new Error("Nama file tidak valid."), { status: 400 });

  // Generate unique filename dengan timestamp
  const timestamp = Date.now();
  const storagePath = `${timestamp}-${safe}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, data, {
      contentType: getContentType(safe),
      upsert: false,
    });

  if (error) {
    console.error("Supabase Storage upload error:", error);
    throw Object.assign(new Error("Gagal menyimpan file."), { status: 500 });
  }

  return `/api/files/${storagePath}`;
}

/** Baca file dari URL absolut (HTTP) atau dari Supabase Storage. */
export async function readUpload(nameOrUrl: string): Promise<Buffer> {
  if (/^https?:\/\//.test(nameOrUrl)) {
    const res = await fetch(nameOrUrl);
    if (!res.ok) {
      throw Object.assign(new Error("File tidak ditemukan di penyimpanan."), { status: 404 });
    }
    return Buffer.from(await res.arrayBuffer());
  }

  const safe = safeUploadName(path.basename(nameOrUrl));
  if (!safe) throw Object.assign(new Error("Nama file tidak valid."), { status: 400 });

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(safe);

  if (error) {
    console.error("Supabase Storage download error:", error);
    throw Object.assign(new Error("File tidak ditemukan di penyimpanan."), { status: 404 });
  }

  return Buffer.from(await data.arrayBuffer());
}

/** Hapus file dari Supabase Storage. */
export async function deleteUpload(nameOrUrl: string): Promise<boolean> {
  try {
    const filePath = path.basename(nameOrUrl);
    const safe = safeUploadName(filePath);
    if (!safe) return false;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([safe]);

    if (error) {
      console.error("Supabase Storage delete error:", error);
      return false;
    }
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

/** Helper: dapatkan Content-Type dari ekstensi file. */
function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };
  return types[ext] || "application/octet-stream";
}
