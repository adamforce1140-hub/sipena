"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FINANCING_PRODUCTS, SHARIAH_TERM } from "@/lib/shariah";
import { checkCaseCompleteness } from "@/lib/case-completeness";
import { CaseCompletenessPanel } from "@/components/case-completeness-panel";
import { Collectibility } from "@prisma/client";

const inputCls =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-gray-700";

const NUMERIC_FIELDS = [
  "principalAmount",
  "outstandingBalance",
  "arrearsMargin",
  "penaltyAmount",
  "dpd",
  "collateralValue",
];

export type EditableCase = {
  id: string;
  contractNumber: string;
  productType: string;
  principalAmount: number;
  outstandingBalance: number;
  arrearsMargin: number;
  penaltyAmount: number;
  dpd: number;
  collectibility: Collectibility;
  collateralType: string | null;
  collateralValue: number | null;
  customer: {
    cifNumber: string;
    fullName: string;
    nik: string;
    phone: string;
    emergencyContact: string | null;
    address: string;
  };
};

export function EditCaseForm({ data }: { data: EditableCase }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({
    cifNumber: data.customer.cifNumber,
    fullName: data.customer.fullName,
    nik: data.customer.nik,
    phone: data.customer.phone,
    address: data.customer.address,
    productType: data.productType,
    principalAmount: String(data.principalAmount || ""),
    outstandingBalance: String(data.outstandingBalance || ""),
    collateralType: data.collateralType ?? "",
  });

  // Kelengkapan data dipantau langsung saat mengetik; tidak menghalangi simpan.
  const completeness = checkCaseCompleteness({
    customer: {
      cifNumber: values.cifNumber ?? "",
      fullName: values.fullName ?? "",
      nik: values.nik ?? "",
      phone: values.phone ?? "",
      address: values.address ?? "",
    },
    productType: values.productType ?? "",
    principalAmount: Number(values.principalAmount || 0),
    outstandingBalance: Number(values.outstandingBalance || 0),
    collateralType: values.collateralType ?? "",
  });

  function syncValues(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    setValues(Object.fromEntries(fd.entries()) as Record<string, string>);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    // Hanya field yang diisi yang dikirim, sehingga data lama tidak terhapus
    // saat Staf melengkapi sebagian field saja.
    const payload: Record<string, string | number> = {};
    for (const [key, value] of Array.from(fd.entries())) {
      const text = String(value).trim();
      if (text === "") continue;
      payload[key] = NUMERIC_FIELDS.includes(key) ? Number(text) : text;
    }

    try {
      await apiFetch(`/api/cases/${data.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      router.push(`/cases/${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={syncValues} className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <CaseCompletenessPanel result={completeness} />

      <section className="rounded border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Data Nasabah</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="edit-cifNumber" className={labelCls}>
              Nomor CIF <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-cifNumber"
              name="cifNumber"
              defaultValue={data.customer.cifNumber}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-fullName" className={labelCls}>
              Nama Lengkap *
            </label>
            <input
              id="edit-fullName"
              name="fullName"
              autoComplete="name"
              defaultValue={data.customer.fullName}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-nik" className={labelCls}>
              NIK <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-nik"
              name="nik"
              autoComplete="off"
              defaultValue={data.customer.nik === "-" ? "" : data.customer.nik}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-phone" className={labelCls}>
              No. Telepon <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={data.customer.phone === "-" ? "" : data.customer.phone}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-emergencyContact" className={labelCls}>
              Kontak Darurat <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-emergencyContact"
              name="emergencyContact"
              autoComplete="off"
              defaultValue={data.customer.emergencyContact ?? ""}
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="edit-address" className={labelCls}>
              Alamat Lengkap <span className="text-gray-400">(opsional)</span>
            </label>
            <textarea
              id="edit-address"
              name="address"
              autoComplete="street-address"
              defaultValue={data.customer.address === "-" ? "" : data.customer.address}
              rows={2}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <section className="rounded border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Data Pembiayaan</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="edit-contractNumber" className={labelCls}>
              Nomor Akad
            </label>
            <input
              id="edit-contractNumber"
              value={data.contractNumber}
              readOnly
              disabled
              className={`${inputCls} bg-gray-100 text-gray-500`}
            />
          </div>
          <div>
            <label htmlFor="edit-productType" className={labelCls}>
              Akad Pembiayaan <span className="text-gray-400">(opsional)</span>
            </label>
            <select
              id="edit-productType"
              name="productType"
              defaultValue={data.productType}
              className={inputCls}
            >
              <option value="">-- Pilih Akad --</option>
              {!FINANCING_PRODUCTS.some((p) => p.value === data.productType) &&
                data.productType !== "" && (
                  <option value={data.productType}>
                    {data.productType} (belum sesuai akad - mohon ganti)
                  </option>
                )}
              {FINANCING_PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-principalAmount" className={labelCls}>
              {SHARIAH_TERM.principal} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-principalAmount"
              name="principalAmount"
              type="number"
              step="0.01"
              defaultValue={data.principalAmount || ""}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-outstandingBalance" className={labelCls}>
              {SHARIAH_TERM.outstanding} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-outstandingBalance"
              name="outstandingBalance"
              type="number"
              step="0.01"
              defaultValue={data.outstandingBalance || ""}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-arrearsMargin" className={labelCls}>
              {SHARIAH_TERM.margin} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-arrearsMargin"
              name="arrearsMargin"
              type="number"
              step="0.01"
              defaultValue={data.arrearsMargin}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-penaltyAmount" className={labelCls}>
              {SHARIAH_TERM.penalty} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-penaltyAmount"
              name="penaltyAmount"
              type="number"
              step="0.01"
              defaultValue={data.penaltyAmount}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-500">{SHARIAH_TERM.penaltyNote}</p>
          </div>
          <div>
            <label htmlFor="edit-dpd" className={labelCls}>
              DPD (hari) <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-dpd"
              name="dpd"
              type="number"
              min="0"
              defaultValue={data.dpd}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-collectibility" className={labelCls}>
              Kolektibilitas <span className="text-gray-400">(opsional)</span>
            </label>
            <select
              id="edit-collectibility"
              name="collectibility"
              defaultValue={data.collectibility}
              className={inputCls}
            >
              {Object.values(Collectibility).map((c) => (
                <option key={c} value={c}>
                  {c.replace("KOL_", "KOL ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-collateralType" className={labelCls}>
              Jenis Agunan <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-collateralType"
              name="collateralType"
              defaultValue={data.collateralType ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-collateralValue" className={labelCls}>
              Nilai Agunan (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input
              id="edit-collateralValue"
              name="collateralValue"
              type="number"
              step="0.01"
              defaultValue={data.collateralValue ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/cases/${data.id}`)}
          className="rounded border px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Batal
        </button>
        <p className="text-xs text-gray-500">
          Data boleh disimpan walau belum lengkap — kasus tetap bisa diverifikasi Supervisor.
        </p>
      </div>
    </form>
  );
}
