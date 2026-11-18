import { NextResponse } from "next/server";
import path from "path";
import { auth } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

/**
 * GET /api/files/:name — sajikan file bukti hanya untuk pengguna terautentikasi.
 * Ini yang memenuhi requirement "proteksi endpoint" untuk penyimpanan lokal.
 */
export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const name = path.basename(params.name);
  const ext = path.extname(name).toLowerCase();
  const contentType = MIME[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Tipe file tidak didukung." }, { status: 400 });
  }

  try {
    const buffer = await readUpload(name);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }
}
