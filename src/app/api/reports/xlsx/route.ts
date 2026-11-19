import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-response";
import { filterLabel, loadNpfCases, parseNpfFilter } from "@/lib/npf-report";
import { productLabel, SHARIAH_TERM } from "@/lib/shariah";
import { STATUS_LABEL } from "@/lib/ui";

export const runtime = "nodejs";

/**
 * GET /api/reports/xlsx?status=&collectibility=&q=
 * Export rekapitulasi NPF ke file Excel (.xlsx).
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

    const rows = cases.map((c, index) => ({
      No: index + 1,
      CIF: c.customer.cifNumber,
      "Nama Nasabah": c.customer.fullName,
      NIK: c.customer.nik,
      "No. Akad": c.contractNumber,
      "Akad Pembiayaan": productLabel(c.productType),
      Kolektibilitas: c.collectibility.replace("_", " "),
      "DPD (hari)": c.dpd,
      [SHARIAH_TERM.principal]: Number(c.principalAmount),
      [SHARIAH_TERM.outstanding]: Number(c.outstandingBalance),
      "Tunggakan Margin": Number(c.arrearsMargin),
      "Ta'zir (Denda Syariah)": Number(c.penaltyAmount),
      "Total Kewajiban (Pokok + Margin)":
        Number(c.outstandingBalance) + Number(c.arrearsMargin),
      Status: STATUS_LABEL[c.caseStatus],
      Terkunci: c.isLocked ? "Ya" : "Tidak",
      "Tanggal Input": c.createdAt.toISOString().slice(0, 10),
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 26 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 16 },
      { wch: 13 },
      { wch: 15 },
      { wch: 18 },
      { wch: 9 },
      { wch: 13 },
    ];

    const lastRef = sheet["!ref"];
    if (lastRef) {
      sheet["!autofilter"] = { ref: lastRef };
    }
    // Margin sempit agar tabel muat di A4 landscape tanpa halaman tambahan.
    sheet["!margins"] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Rekap NPF");

    const info = XLSX.utils.aoa_to_sheet([
      ["PT Bank Perekonomian Rakyat Syariah BANGKA BELITUNG"],
      ["Sistem Informasi Penanganan Pembiayaan Bermasalah (SIPENA)"],
      [],
      ["LAPORAN REKAPITULASI NPF (NON PERFORMING FINANCING)"],
      [],
      ["Filter", filterLabel(filter)],
      ["Dicetak oleh", session.user.name ?? "-"],
      ["Tanggal cetak", new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })],
      ["Instansi", "PT Bank Perekonomian Rakyat Syariah Bangka Belitung"],
      ["Alamat", "Ruko TJ Tower Blok 21–22, Jl. Kampung Melayu, Kel. Bukit Merapin, Kec. Gerunggang, Kota Pangkalpinang, Kepulauan Bangka Belitung 33172"],
      ["Kontak", "Telp. (0717) 9103567 · Email: customercare@bprsbabel.id"],
      [],
      ["Catatan Syariah", SHARIAH_TERM.penaltyNote],
    ]);
    info["!cols"] = [{ wch: 18 }, { wch: 60 }];
    info["!margins"] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 };
    info["A1"].s = { font: { bold: true, sz: 14 } };
    info["A4"].s = { font: { bold: true, sz: 12 } };
    for (const cell of ["A2", "A7", "A8", "A9", "A10", "A13"]) {
      if (info[cell]) info[cell].s = { font: { bold: true } };
    }
    XLSX.utils.book_append_sheet(workbook, info, "Info Laporan");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXPORT_NPF_EXCEL",
        entity: "Report",
        entityId: "npf-recap",
        newData: { filter: filterLabel(filter), rows: rows.length },
      },
    });

    const filename = `rekap-npf-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
