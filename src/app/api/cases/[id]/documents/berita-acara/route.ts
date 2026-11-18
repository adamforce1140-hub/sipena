import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-response";
import { loadCaseDocumentData } from "@/lib/document-data";
import { renderBeritaAcara } from "@/lib/pdf/documents";

export const runtime = "nodejs";

const ALLOWED_STATUS = ["PENDING_CLOSURE", "CLOSED"];

/**
 * GET /api/cases/:id/documents/berita-acara
 * Cetak PDF Berita Acara Penyelesaian. Tersedia saat kasus masuk Review Tutup
 * (Gate 3) atau sudah CLOSED.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    const data = await loadCaseDocumentData(params.id);
    if (!data) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }

    if (!ALLOWED_STATUS.includes(data.caseStatus)) {
      return NextResponse.json(
        {
          error:
            "Berita Acara hanya dapat dicetak saat kasus berstatus Review Tutup atau sudah ditutup.",
        },
        { status: 409 }
      );
    }

    const pdf = await renderBeritaAcara(data);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PRINT_BERITA_ACARA",
        entity: "Financing",
        entityId: data.id,
        newData: { documentNumber: `BA/${data.contractNumber}` },
      },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="BA-${data.contractNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
