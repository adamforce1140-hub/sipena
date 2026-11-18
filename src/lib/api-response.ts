import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Wrapper untuk error API agar konsisten:
 * - ZodError -> 422 dengan daftar pesan per field
 * - Error bertanda `status` (dari guards) -> status tersebut
 * - Selainnya -> 500
 */
export function handleApiError(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Data yang dikirim tidak valid.",
        fields: e.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 }
    );
  }

  const err = e as { status?: number; message?: string };
  const status = err?.status ?? 500;
  const message =
    status === 500 ? "Terjadi kesalahan pada server." : (err?.message ?? "Terjadi kesalahan.");

  return NextResponse.json({ error: message }, { status });
}
