"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FINANCING_PRODUCTS, SHARIAH_TERM } from "@/lib/shariah";
import { Collectibility } from "@prisma/client";

const inputCls =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-gray-700";

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      fullName: String(fd.get("fullName")),
      nik: String(fd.get("nik")),
      phone: String(fd.get("phone")),
      emergencyContact: fd.get("emergencyContact") ? String(fd.get("emergencyContact")) : null,
      address: String(fd.get("address")),
      productType: String(fd.get("productType")),
      principalAmount: Number(fd.get("principalAmount")),
      outstandingBalance: Number(fd.get("outstandingBalance")),
      arrearsMargin: Number(fd.get("arrearsMargin")),
      penaltyAmount: Number(fd.get("penaltyAmount")),
      dpd: Number(fd.get("dpd")),
      collectibility: String(fd.get("collectibility")),
      collateralType: fd.get("collateralType") ? String(fd.get("collateralType")) : null,
      collateralValue: fd.get("collateralValue") ? Number(fd.get("collateralValue")) : null,
    };

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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Data Nasabah</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="edit-fullName" className={labelCls}>
              Nama Lengkap
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
              NIK
            </label>
            <input
              id="edit-nik"
              name="nik"
              autoComplete="off"
              defaultValue={data.customer.nik}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-phone" className={labelCls}>
              No. Telepon
            </label>
            <input
              id="edit-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={data.customer.phone}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-emergencyContact" className={labelCls}>
              Kontak Darurat
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
              Alamat Lengkap
            </label>
            <textarea
              id="edit-address"
              name="address"
              autoComplete="street-address"
              defaultValue={data.customer.address}
              required
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
              Akad Pembiayaan
            </label>
            <select
              id="edit-productType"
              name="productType"
              defaultValue={data.productType}
              className={inputCls}
              required
            >
              {!FINANCING_PRODUCTS.some((p) => p.value === data.productType) && (
                <option value={data.productType}>{data.productType} (belum sesuai akad - mohon ganti)</option>
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
              {SHARIAH_TERM.principal} (Rp)
            </label>
            <input
              id="edit-principalAmount"
              name="principalAmount"
              type="number"
              step="0.01"
              defaultValue={data.principalAmount}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-outstandingBalance" className={labelCls}>
              {SHARIAH_TERM.outstanding} (Rp)
            </label>
            <input
              id="edit-outstandingBalance"
              name="outstandingBalance"
              type="number"
              step="0.01"
              defaultValue={data.outstandingBalance}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-arrearsMargin" className={labelCls}>
              {SHARIAH_TERM.margin} (Rp)
            </label>
            <input
              id="edit-arrearsMargin"
              name="arrearsMargin"
              type="number"
              step="0.01"
              defaultValue={data.arrearsMargin}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-penaltyAmount" className={labelCls}>
              {SHARIAH_TERM.penalty} (Rp)
            </label>
            <input
              id="edit-penaltyAmount"
              name="penaltyAmount"
              type="number"
              step="0.01"
              defaultValue={data.penaltyAmount}
              required
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-500">{SHARIAH_TERM.penaltyNote}</p>
          </div>
          <div>
            <label htmlFor="edit-dpd" className={labelCls}>
              DPD (hari)
            </label>
            <input
              id="edit-dpd"
              name="dpd"
              type="number"
              min="0"
              defaultValue={data.dpd}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-collectibility" className={labelCls}>
              Kolektibilitas
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
              Jenis Agunan
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
              Nilai Agunan (Rp)
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

      <div className="flex items-center gap-3">
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
      </div>
    </form>
  );
}
