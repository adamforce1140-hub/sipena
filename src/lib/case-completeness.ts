/**
 * Kelengkapan data kasus untuk kebutuhan verifikasi Supervisor.
 *
 * Staf boleh mengirim kasus walau datanya belum lengkap (sesuai alur kerja
 * lapangan). Helper ini dipakai di UI agar Supervisor langsung tahu bagian
 * mana yang masih kosong saat memutuskan verifikasi / penolakan.
 * Tidak memblokir pengiriman kasus.
 */

/** CIF sementara yang dibuat otomatis saat Staf belum mengisi Nomor CIF. */
export const PLACEHOLDER_CIF_PREFIX = "TMP-CIF-";

export type CompletenessInput = {
  customer: {
    cifNumber: string;
    fullName: string;
    nik: string;
    phone: string;
    address: string;
  };
  productType: string;
  principalAmount: number;
  outstandingBalance: number;
  collateralType?: string | null;
};

export type CompletenessResult = {
  complete: boolean;
  percent: number;
  missing: string[];
  filled: number;
  total: number;
};

/** Nilai kosong atau penanda sementara ("-") dianggap belum diisi. */
const blank = (v: string | null | undefined) => !v || !v.trim() || v.trim() === "-";

/** Daftar field yang dinilai saat Supervisor memverifikasi kelengkapan data. */
const CHECKS: {
  label: string;
  ok: (c: CompletenessInput) => boolean;
}[] = [
  {
    label: "Nomor CIF",
    ok: (c) =>
      !blank(c.customer.cifNumber) && !c.customer.cifNumber.startsWith(PLACEHOLDER_CIF_PREFIX),
  },
  { label: "Nama lengkap", ok: (c) => !blank(c.customer.fullName) },
  { label: "NIK", ok: (c) => !blank(c.customer.nik) },
  { label: "No. telepon", ok: (c) => !blank(c.customer.phone) },
  { label: "Alamat", ok: (c) => !blank(c.customer.address) },
  { label: "Akad pembiayaan", ok: (c) => !blank(c.productType) },
  { label: "Plafon pembiayaan", ok: (c) => c.principalAmount > 0 },
  { label: "Sisa kewajiban pokok", ok: (c) => c.outstandingBalance > 0 },
  { label: "Jenis agunan", ok: (c) => !blank(c.collateralType) },
];

export function checkCaseCompleteness(c: CompletenessInput): CompletenessResult {
  const missing = CHECKS.filter((check) => !check.ok(c)).map((check) => check.label);
  const total = CHECKS.length;
  const filled = total - missing.length;
  return {
    complete: missing.length === 0,
    percent: Math.round((filled / total) * 100),
    missing,
    filled,
    total,
  };
}
