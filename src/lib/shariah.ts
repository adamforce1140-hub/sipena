/**
 * Modul akad & terminologi pembiayaan syariah.
 *
 * Sistem ini tidak mengenal produk pinjaman konvensional (KUR, kredit,
 * kartu kredit, multiguna). Setiap pembiayaan harus terikat pada akad
 * syariah yang sah, sehingga daftar di bawah ini dipakai pada form input
 * maupun saat menampilkan data.
 */

export type FinancingProduct = {
  /** Nilai yang disimpan pada kolom `Financing.productType`. */
  value: string;
  /** Nama akad. */
  label: string;
  /** Skema akad untuk membantu staf memilih. */
  scheme: string;
};

export const FINANCING_PRODUCTS: FinancingProduct[] = [
  { value: "MURABAHAH", label: "Murabahah", scheme: "Jual beli angsuran dengan margin" },
  {
    value: "MURABAHAH_BIL_WAKALAH",
    label: "Murabahah bil Wakalah",
    scheme: "Jual beli dengan wakalah pengadaan barang",
  },
  { value: "SALAM", label: "Salam", scheme: "Jual beli pesanan dengan pembayaran di muka" },
  { value: "ISTISHNA", label: "Istishna", scheme: "Jual beli pesanan barang manufaktur" },
  { value: "IJARAH", label: "Ijarah", scheme: "Sewa manfaat atas aset" },
  {
    value: "IMBT",
    label: "Ijarah Muntahiya Bittamlik (IMBT)",
    scheme: "Sewa yang diakhiri pengalihan kepemilikan",
  },
  { value: "MUDHARABAH", label: "Mudharabah", scheme: "Bagi hasil usaha (modal dari bank)" },
  { value: "MUSYARAKAH", label: "Musyarakah", scheme: "Kemitraan modal bersama" },
  {
    value: "MMQ",
    label: "Musyarakah Mutanaqishah (MMQ)",
    scheme: "Kemitraan dengan kepemilikan bank menurun",
  },
  { value: "QARDH", label: "Qardh", scheme: "Pinjaman kebajikan tanpa imbalan" },
  { value: "RAHN", label: "Rahn", scheme: "Gadai emas / jaminan" },
  { value: "HAWALAH", label: "Hawalah", scheme: "Pengalihan utang (talangan haji/umrah)" },
];

/** Label tampilan untuk nilai `productType` (termasuk data lama non-akad). */
export function productLabel(value: string): string {
  const found = FINANCING_PRODUCTS.find((p) => p.value === value);
  return found ? found.label : value;
}

/** Skema akad untuk ditampilkan sebagai keterangan. */
export function productScheme(value: string): string | null {
  return FINANCING_PRODUCTS.find((p) => p.value === value)?.scheme ?? null;
}

/** True bila nilai `productType` merupakan akad syariah yang terdaftar. */
export function isShariahProduct(value: string): boolean {
  return FINANCING_PRODUCTS.some((p) => p.value === value);
}

/** Istilah baku yang dipakai konsisten di UI, PDF, dan Excel. */
export const SHARIAH_TERM = {
  principal: "Plafon Pembiayaan",
  outstanding: "Sisa Kewajiban Pokok",
  margin: "Tunggakan Margin",
  penalty: "Ta'zir (Denda Syariah)",
  penaltyNote:
    "Ta'zir tidak menjadi pendapatan bank; dana disalurkan ke dana kebajikan dan dapat diusulkan penghapusannya.",
} as const;
