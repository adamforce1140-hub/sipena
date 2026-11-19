import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CaseDocumentData } from "@/lib/document-data";
import { productLabel, SHARIAH_TERM } from "@/lib/shariah";
import type { CaseStatus, SolutionType } from "@prisma/client";

const BRAND = "#14532d";

/* Identitas lembaga (BPRS Bali Sagara Bahari). */
const BANK = {
  name: "PT Bank Perekonomian Rakyat Syariah",
  nameBold: "BANGKA BELITUNG",
  tagline: "BPRS Bangka Belitung — beroperasi berdasarkan prinsip syariah",
  address:
    "Ruko TJ Tower Blok 21–22, Jl. Kampung Melayu, Kel. Bukit Merapin, Kec. Gerunggang, Kota Pangkalpinang, Kepulauan Bangka Belitung 33172",
  tel: "Telp. (0717) 9103567 · Email: customercare@bprsbabel.id · Website: www.bprsbabel.id",
  licensed: "Lembaga berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) · Peserta penjaminan LPS",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 48,
    paddingHorizontal: 54,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#1f2937",
    lineHeight: 1.4,
  },
  letterhead: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 8,
    marginBottom: 14,
    alignItems: "center",
  },
  brand: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: "#111827", textAlign: "center" },
  brandAccent: { color: BRAND, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 7.5, color: "#4b5563", marginTop: 2, textAlign: "center" },
  title: { fontSize: 12.5, fontFamily: "Helvetica-Bold", color: BRAND, textAlign: "center" },
  subtitle: { fontSize: 9, textAlign: "center", marginTop: 2, color: "#374151" },
  rule: {
    borderBottomWidth: 0.75,
    borderBottomColor: "#9ca3af",
    width: "100%",
    marginTop: 6,
    marginBottom: 12,
  },
  paragraph: { marginBottom: 7, textAlign: "justify" },
  row: { flexDirection: "row", marginBottom: 2.5 },
  label: { width: 130, color: "#4b5563" },
  value: { flex: 1 },
  sectionTitle: { fontFamily: "Helvetica-Bold", color: BRAND, marginTop: 8, marginBottom: 3 },
  table: { borderWidth: 0.75, borderColor: "#9ca3af", marginTop: 4, marginBottom: 8 },
  tableRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#d1d5db" },
  tableHead: { backgroundColor: "#e6eee8", borderTopWidth: 0 },
  cell: { padding: 3.5, fontSize: 8.5 },
  cellHead: { fontFamily: "Helvetica-Bold", color: BRAND },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  signBox: { width: "44%", alignItems: "center" },
  signDate: { fontSize: 9, marginBottom: 40 },
  signName: {
    borderTopWidth: 0.75,
    borderTopColor: "#111827",
    paddingTop: 3,
    width: "100%",
    textAlign: "center",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  signRole: { fontSize: 8, color: "#4b5563", marginTop: 1 },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 54,
    right: 54,
    fontSize: 7,
    color: "#6b7280",
    textAlign: "center",
  },
  note: {
    marginTop: 8,
    padding: 6,
    backgroundColor: "#f5f7f5",
    borderLeftWidth: 2,
    borderLeftColor: BRAND,
    fontSize: 8.5,
    color: "#374151",
  },
  reportPage: {
    paddingTop: 22,
    paddingBottom: 32,
    paddingHorizontal: 22,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  reportFooter: {
    position: "absolute",
    bottom: 14,
    left: 22,
    right: 22,
    fontSize: 7,
    color: "#6b7280",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

const STATUS_LABEL: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Aktif",
  PENDING_SOLUTION: "Review Solusi",
  IN_EXECUTION: "Eksekusi",
  PENDING_CLOSURE: "Review Tutup",
  CLOSED: "Selesai / Terkunci",
};

const GATE_LABEL: Record<string, string> = {
  GATE_1_VERIFY: "Gate 1 — Verifikasi Kasus",
  GATE_2_SOLUTION: "Gate 2 — Keputusan Solusi",
  GATE_3_CLOSE: "Gate 3 — Penutupan Kasus",
};

const COLLECTIBILITY_LABEL: Record<string, string> = {
  KOL_3: "KOL 3",
  KOL_4: "KOL 4",
  KOL_5: "KOL 5",
};

function formatRupiah(value: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  )}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(
    Math.round(value)
  );
}

function formatLongDate(value: Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(value: Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Level SP (1–3) mengikuti jenis solusi yang disetujui Supervisor bila ada. */
export function warningLevelFromSolution(solutionType: SolutionType | undefined): number {
  switch (solutionType) {
    case "WARNING_LETTER_SP3":
      return 3;
    case "WARNING_LETTER_SP2":
      return 2;
    default:
      return 1;
  }
}

function Letterhead() {
  return (
    <View style={styles.letterhead}>
      <Text style={styles.brand}>
        {BANK.name} <Text style={styles.brandAccent}>{BANK.nameBold}</Text>
      </Text>
      <Text style={styles.brandSub}>{BANK.tagline}</Text>
      <Text style={styles.brandSub}>{BANK.address}</Text>
      <Text style={styles.brandSub}>
        {BANK.tel} · {BANK.licensed}
      </Text>
    </View>
  );
}

function Footer({ text }: { text: string }) {
  return <Text style={styles.footer}>{text}</Text>;
}

/* ------------------------------------------------------------------ */
/*  Surat Peringatan (SP 1–3)                                          */
/* ------------------------------------------------------------------ */

function WarningLetterDocument({
  data,
  level,
}: {
  data: CaseDocumentData;
  level: number;
}) {
  const now = new Date();
  const documentNumber = `SP-${level}/${data.contractNumber}/${now.getFullYear()}`;
  // Ta'zir tidak digabung ke kewajiban pokok+margin karena bukan pendapatan bank.
  const totalKewajiban = data.outstandingBalance + data.arrearsMargin;
  const supervisorName = data.approvedSolution?.reviewedBy?.name ?? "Supervisor";

  return (
    <Document
      title={`Surat Peringatan ${level} - ${data.contractNumber}`}
      author="SIPENA"
      subject="Surat Peringatan Pembiayaan Bermasalah"
    >
      <Page size="A4" style={styles.page}>
        <Letterhead />

        <Text style={styles.title}>SURAT PERINGATAN {level === 1 ? "PERTAMA" : level === 2 ? "KEDUA" : "KETIGA"}</Text>
        <Text style={styles.subtitle}>Nomor: {documentNumber}</Text>
        <View style={styles.rule} />

        <Text style={styles.paragraph} wrap={false}>
          {`Kepada Yth.\nBapak/Ibu Saudara/i`}{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.customer.fullName}</Text>
          {"\n"}
          {data.customer.address}
        </Text>

        <Text style={styles.paragraph}>
          Dengan hormat, sehubungan dengan akad {productLabel(data.productType)} berdasarkan akad nomor{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.contractNumber}</Text>, berdasarkan catatan kami
          terdapat tunggakan pembayaran yang telah melewati jatuh tempo dengan rincian sebagai berikut:
        </Text>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.cell, styles.cellHead, { flex: 3 }]}>Uraian</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2, textAlign: "right" }]}>Jumlah</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Nomor CIF</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{data.customer.cifNumber}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>{SHARIAH_TERM.outstanding}</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.outstandingBalance)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Tunggakan Margin</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.arrearsMargin)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>{SHARIAH_TERM.penalty}</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.penaltyAmount)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellHead, { flex: 3 }]}>Total Kewajiban (Pokok + Margin)</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2, textAlign: "right" }]}>{formatRupiah(totalKewajiban)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Tunggakan (DPD)</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{data.dpd} hari</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Kolektibilitas</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>
              {COLLECTIBILITY_LABEL[data.collectibility] ?? data.collectibility}
            </Text>
          </View>
        </View>

        <Text style={styles.note}>{SHARIAH_TERM.penaltyNote}</Text>

        <Text style={styles.paragraph}>
          Berdasarkan hal tersebut, kami memberikan <Text style={{ fontFamily: "Helvetica-Bold" }}>Surat Peringatan {level === 1 ? "Pertama" : level === 2 ? "Kedua" : "Ketiga"}</Text>{" "}
          kepada Saudara/i untuk segera melakukan pembayaran atas tunggakan tersebut paling lambat{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>7 (tujuh) hari kalender</Text> sejak tanggal surat ini
          diterbitkan.
        </Text>

        <Text style={styles.paragraph}>
          Apabila sampai batas waktu tersebut kewajiban belum diselesaikan, maka sesuai dengan ketentuan akad dan
          peraturan perundang-undangan yang berlaku, kami akan melakukan tindakan penyelesaian pembiayaan bermasalah,
          termasuk namun tidak terbatas pada penyelesaian melalui agunan.
        </Text>

        {data.approvedSolution && (
          <Text style={styles.note}>
            Skema penyelesaian yang telah disetujui Supervisor:{" "}
            {data.approvedSolution.proposalSummary}
          </Text>
        )}

        <Text style={[styles.paragraph, { marginTop: 10 }]}>
          Demikian surat peringatan ini kami sampaikan untuk menjadi perhatian. Atas perhatian dan kerja sama
          Saudara/i, kami sampaikan terima kasih.
        </Text>

        <Text style={[styles.paragraph, { textAlign: "right", marginTop: 14 }]}>
          Bangka Belitung, {formatLongDate(now)}
          {"\n"}
          Bank Pembiayaan Rakyat Syariah
          {"\n"}
          Bangka Belitung
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signName}>{supervisorName}</Text>
            <Text style={styles.signRole}>Supervisor Pembiayaan</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signName}>{data.customer.fullName}</Text>
            <Text style={styles.signRole}>Nasabah / Penerima Surat</Text>
          </View>
        </View>

        <Footer
          text={`Dokumen ini dihasilkan otomatis oleh SIPENA pada ${formatShortDate(now)} · ${documentNumber}`}
        />
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Berita Acara Penyelesaian                                          */
/* ------------------------------------------------------------------ */

function BeritaAcaraDocument({ data }: { data: CaseDocumentData }) {
  const now = new Date();
  const documentNumber = `BA/${data.contractNumber}/${now.getFullYear()}`;
  // Ta'zir tidak digabung ke kewajiban pokok+margin karena bukan pendapatan bank.
  const totalKewajiban = data.outstandingBalance + data.arrearsMargin;
  const totalRealisasi = data.payments.reduce((sum, p) => sum + p.paymentAmount, 0);
  const gate3 = [...data.gates].reverse().find((g) => g.gateStep === "GATE_3_CLOSE");
  const supervisorName = gate3?.supervisor.name ?? data.approvedSolution?.reviewedBy?.name ?? "Supervisor";

  return (
    <Document
      title={`Berita Acara ${data.contractNumber}`}
      author="SIPENA"
      subject="Berita Acara Penyelesaian Pembiayaan Bermasalah"
    >
      <Page size="A4" style={styles.page}>
        <Letterhead />

        <Text style={styles.title}>BERITA ACARA PENYELESAIAN PEMBIAYAAN BERMASALAH</Text>
        <Text style={styles.subtitle}>Nomor: {documentNumber}</Text>
        <View style={styles.rule} />

        <Text style={styles.paragraph}>
          Pada hari ini, {formatLongDate(now)}, telah dilaksanakan penutupan kasus pembiayaan bermasalah atas nama
          nasabah berikut:
        </Text>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.cell, styles.cellHead, { flex: 3 }]}>Data Nasabah</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 4 }]}>Keterangan</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Nama Lengkap</Text>
            <Text style={[styles.cell, { flex: 4 }]}>{data.customer.fullName}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Nomor CIF / NIK</Text>
            <Text style={[styles.cell, { flex: 4 }]}>
              {data.customer.cifNumber} / {data.customer.nik}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Nomor Akad / Akad Pembiayaan</Text>
            <Text style={[styles.cell, { flex: 4 }]}>
              {data.contractNumber} / {productLabel(data.productType)}
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Agunan</Text>
            <Text style={[styles.cell, { flex: 4 }]}>
              {data.collateralType ?? "-"}
              {data.collateralValue !== null ? ` (${formatRupiah(data.collateralValue)})` : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Rincian Kewajiban & Realisasi</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.cell, styles.cellHead, { flex: 3 }]}>Uraian</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2, textAlign: "right" }]}>Jumlah</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Plafon Pembiayaan</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.principalAmount)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>{SHARIAH_TERM.outstanding}</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.outstandingBalance)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>Tunggakan Margin</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.arrearsMargin)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, { flex: 3 }]}>{SHARIAH_TERM.penalty}</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatRupiah(data.penaltyAmount)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellHead, { flex: 3 }]}>Total Kewajiban (Pokok + Margin)</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2, textAlign: "right" }]}>{formatRupiah(totalKewajiban)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellHead, { flex: 3 }]}>Realisasi Pembayaran</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2, textAlign: "right" }]}>{formatRupiah(totalRealisasi)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Kronologi Penyelesaian</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <Text style={[styles.cell, styles.cellHead, { flex: 2 }]}>Tanggal</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 4 }]}>Tahapan</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2 }]}>Keputusan</Text>
          </View>
          {data.gates.map((gate, index) => (
            <View style={styles.tableRow} key={`${gate.gateStep}-${index}`}>
              <Text style={[styles.cell, { flex: 2 }]}>{formatShortDate(gate.createdAt)}</Text>
              <Text style={[styles.cell, { flex: 4 }]}>{GATE_LABEL[gate.gateStep] ?? gate.gateStep}</Text>
              <Text style={[styles.cell, { flex: 2 }]}>
                {gate.decision === "APPROVED" ? "Disetujui" : "Ditolak"} ({gate.supervisor.name})
              </Text>
            </View>
          ))}
          {data.payments.map((payment, index) => (
            <View style={styles.tableRow} key={`payment-${index}`}>
              <Text style={[styles.cell, { flex: 2 }]}>{formatShortDate(payment.paymentDate)}</Text>
              <Text style={[styles.cell, { flex: 4 }]}>Realisasi pembayaran</Text>
              <Text style={[styles.cell, { flex: 2 }]}>{formatRupiah(payment.paymentAmount)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.paragraph}>
          Berdasarkan hasil verifikasi Gate 3, kasus pembiayaan bermasalah ini dinyatakan{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {data.caseStatus === "CLOSED" ? "SELESAI dan DITUTUP" : "diajukan untuk penutupan"}
          </Text>
          . Seluruh data kasus telah dikunci secara permanen dan tidak dapat diubah kembali.
        </Text>

        <Text style={styles.paragraph}>
          Demikian berita acara ini dibuat dengan sebenarnya, dalam keadaan sadar tanpa paksaan dari pihak mana pun,
          untuk dipergunakan sebagaimana mestinya.
        </Text>

        <Text style={[styles.paragraph, { textAlign: "right", marginTop: 14 }]}>
          Bangka Belitung, {formatLongDate(now)}
        </Text>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signName}>{data.customer.fullName}</Text>
            <Text style={styles.signRole}>Nasabah</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signName}>{supervisorName}</Text>
            <Text style={styles.signRole}>Supervisor Pembiayaan</Text>
          </View>
        </View>

        <Footer
          text={`Dokumen ini dihasilkan otomatis oleh SIPENA pada ${formatShortDate(now)} · ${documentNumber}`}
        />
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Laporan Rekapitulasi NPF (PDF)                                     */
/* ------------------------------------------------------------------ */

export type NpfReportRow = {
  cifNumber: string;
  fullName: string;
  contractNumber: string;
  productType: string;
  collectibility: string;
  dpd: number;
  outstandingBalance: number;
  arrearsMargin: number;
  penaltyAmount: number;
  caseStatus: CaseStatus;
};

function ReportDocument({
  rows,
  filterLabel,
  generatedBy,
}: {
  rows: NpfReportRow[];
  filterLabel: string;
  generatedBy: string;
}) {
  const now = new Date();
  const totalOutstanding = rows.reduce((s, r) => s + r.outstandingBalance, 0);
  const totalTunggakan = rows.reduce((s, r) => s + r.arrearsMargin, 0);
  const totalTazir = rows.reduce((s, r) => s + r.penaltyAmount, 0);

  return (
    <Document title="Laporan Rekapitulasi NPF" author="SIPENA" subject="Rekapitulasi NPF">
      <Page size="A4" orientation="landscape" style={styles.reportPage}>
        <View style={[styles.letterhead, { marginBottom: 8 }]}>
          <Text style={styles.brand}>
            {BANK.name} <Text style={styles.brandAccent}>{BANK.nameBold}</Text>
          </Text>
          <Text style={styles.brandSub}>Laporan Rekapitulasi NPF (Non Performing Financing) · SIPENA</Text>
          <Text style={styles.brandSub}>
            Dicetak {formatLongDate(now)} oleh {generatedBy} · Filter: {filterLabel}
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 8, borderWidth: 0.75, borderColor: "#9ca3af" }}>
          <Text style={[styles.cell, { flex: 1, fontFamily: "Helvetica-Bold" }]}>Jumlah Kasus: {rows.length}</Text>
          <Text style={[styles.cell, { flex: 1.4, fontFamily: "Helvetica-Bold" }]}>
            Total {SHARIAH_TERM.outstanding}: {formatRupiah(totalOutstanding)}
          </Text>
          <Text style={[styles.cell, { flex: 1.4, fontFamily: "Helvetica-Bold" }]}>
            Total Tunggakan Margin: {formatRupiah(totalTunggakan)}
          </Text>
          <Text style={[styles.cell, { flex: 1.2, fontFamily: "Helvetica-Bold" }]}>
            {"Total Ta'zir: "}{formatRupiah(totalTazir)}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]} fixed>
            <Text style={[styles.cell, styles.cellHead, { flex: 0.4 }]}>No</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 1.2 }]}>CIF</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 2.2 }]}>Nama Nasabah</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 1.6 }]}>No. Akad</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 1.4 }]}>Akad</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 0.8 }]}>KOL</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 0.6 }]}>DPD</Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 1.3, textAlign: "right" }]}>
              {SHARIAH_TERM.outstanding}
            </Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 1.2, textAlign: "right" }]}>
              Tunggakan Margin
            </Text>
            <Text style={[styles.cell, styles.cellHead, { flex: 1.3 }]}>Status</Text>
          </View>
          {rows.map((row, index) => (
            <View style={styles.tableRow} key={`${row.contractNumber}-${index}`}>
              <Text style={[styles.cell, { flex: 0.4 }]}>{index + 1}</Text>
              <Text style={[styles.cell, { flex: 1.2 }]}>{row.cifNumber}</Text>
              <Text style={[styles.cell, { flex: 2.2 }]}>{row.fullName}</Text>
              <Text style={[styles.cell, { flex: 1.6 }]}>{row.contractNumber}</Text>
              <Text style={[styles.cell, { flex: 1.4 }]}>{productLabel(row.productType)}</Text>
              <Text style={[styles.cell, { flex: 0.8 }]}>
                {COLLECTIBILITY_LABEL[row.collectibility] ?? row.collectibility}
              </Text>
              <Text style={[styles.cell, { flex: 0.6 }]}>{row.dpd}</Text>
              <Text style={[styles.cell, { flex: 1.3, textAlign: "right" }]}>
                {formatNumber(row.outstandingBalance)}
              </Text>
              <Text style={[styles.cell, { flex: 1.2, textAlign: "right" }]}>
                {formatNumber(row.arrearsMargin)}
              </Text>
              <Text style={[styles.cell, { flex: 1.3 }]}>{STATUS_LABEL[row.caseStatus]}</Text>
            </View>
          ))}
          {rows.length === 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 1 }]}>Tidak ada data pada filter ini.</Text>
            </View>
          )}
        </View>

        <View style={styles.reportFooter} fixed>
          <Text>SIPENA · Laporan dihasilkan otomatis pada {formatShortDate(now)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} dari ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Renderer                                                           */
/* ------------------------------------------------------------------ */

export function renderWarningLetter(data: CaseDocumentData, level: number) {
  return renderToBuffer(<WarningLetterDocument data={data} level={level} />);
}

export function renderBeritaAcara(data: CaseDocumentData) {
  return renderToBuffer(<BeritaAcaraDocument data={data} />);
}

export function renderNpfReport(
  rows: NpfReportRow[],
  filterLabel: string,
  generatedBy: string
) {
  return renderToBuffer(
    <ReportDocument rows={rows} filterLabel={filterLabel} generatedBy={generatedBy} />
  );
}
