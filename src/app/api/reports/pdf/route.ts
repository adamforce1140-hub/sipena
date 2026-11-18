import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-response";
import { filterLabel, loadNpfCases, parseNpfFilter } from "@/lib/npf-report";
import { renderNpfReport } from "@/lib/pdf/documents";

export const runtime = "nodejs";

/**
 * GET /api/reports/pdf?status=&collectibility=&q=
 * Export rekapitulasi NPF ke file PDF.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    const sp = new URL(req.url).searchParams;
    const filter = parseNpfFilter({
      status: sp.get("status") ?? undefined,
      collectibility: sp.get("collectibility") ?? undefined,
      q: sp.get("q") ?? undefined,
    });

    const cases = await loadNpfCases(filter);

    const pdf = await renderNpfReport(
      cases.map((c) => ({
        cifNumber: c.customer.cifNumber,
        fullName: c.customer.fullName,
        contractNumber: c.contractNumber,
        productType: c.productType,
        collectibility: c.collectibility,
        dpd: c.dpd,
        outstandingBalance: Number(c.outstandingBalance),
        arrearsMargin: Number(c.arrearsMargin),
        penaltyAmount: Number(c.penaltyAmount),
        caseStatus: c.caseStatus,
      })),
      filterLabel(filter),
      session.user.name ?? "-"
    );

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXPORT_NPF_PDF",
        entity: "Report",
        entityId: "npf-recap",
        newData: { filter: filterLabel(filter), rows: cases.length },
      },
    });

    const filename = `rekap-npf-${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
