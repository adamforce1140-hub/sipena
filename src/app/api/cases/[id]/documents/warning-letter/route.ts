import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-response";
import { loadCaseDocumentData } from "@/lib/document-data";
import { renderWarningLetter, warningLevelFromSolution } from "@/lib/pdf/documents";

export const runtime = "nodejs";

/**
 * GET /api/cases/:id/documents/warning-letter?level=1|2|3
 * Cetak PDF Surat Peringatan (SP 1–3). Hanya tersedia setelah solusi disetujui
 * Supervisor pada Gate 2.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    const data = await loadCaseDocumentData(params.id);
    if (!data) {
      return NextResponse.json({ error: "Kasus tidak ditemukan." }, { status: 404 });
    }

    if (!data.approvedSolution) {
      return NextResponse.json(
        {
          error:
            "Surat Peringatan hanya dapat dicetak setelah usulan solusi disetujui Supervisor (Gate 2).",
        },
        { status: 409 }
      );
    }

    const requested = Number(new URL(req.url).searchParams.get("level") ?? "");
    const fallback = warningLevelFromSolution(data.approvedSolution.solutionType);
    const level =
      Number.isInteger(requested) && requested >= 1 && requested <= 3
        ? requested
        : data.approvedSolution.solutionType.startsWith("WARNING_LETTER_SP")
          ? fallback
          : 1;

    const pdf = await renderWarningLetter(data, level);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PRINT_WARNING_LETTER",
        entity: "Financing",
        entityId: data.id,
        newData: { level, documentNumber: `SP-${level}/${data.contractNumber}` },
      },
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="SP${level}-${data.contractNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
