"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { FINANCING_PRODUCTS, productScheme, SHARIAH_TERM } from "@/lib/shariah";
import { checkCaseCompleteness } from "@/lib/case-completeness";
import { CaseCompletenessPanel } from "@/components/case-completeness-panel";
import { Collectibility } from "@prisma/client";

const inputCls =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-gray-700";

export function NewCaseForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [productType, setProductType] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  // Indikator kelengkapan realtime: hanya Nomor Akad & Nama yang wajib,
  // sisanya boleh menyusul dan tidak menghalangi pengiriman ke Supervisor.
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
    setFieldErrors({});
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    // Field opsional yang kosong tidak dikirim, agar API memakai nilai aman.
    const payload = Object.fromEntries(
      Object.entries(Object.fromEntries(fd.entries())).filter(
        ([, v]) => String(v).trim() !== ""
      )
    );

    try {
      const { financing } = await apiFetch<{ financing: { id: string } }>("/api/cases", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/cases/${financing.id}`);
      router.refresh();
    } catch (err) {
      const e2 = err as Error & { fields?: { path: string; message: string }[] };
      setError(e2.message);
      if (e2.fields) {
        setFieldErrors(Object.fromEntries(e2.fields.map((f) => [f.path, f.message])));
      }
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

      <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Hanya <strong>Nomor Akad</strong> dan <strong>Nama Lengkap</strong> yang wajib. Field lain
        boleh dikosongkan dan dilengkapi menyusul — kasus tetap bisa dikirim ke Supervisor.
      </div>

      <CaseCompletenessPanel result={completeness} />

      <section className="rounded border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Data Nasabah</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="cifNumber">
              Nomor CIF <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="cifNumber" name="cifNumber" className={inputCls} placeholder="CIF-2024-0001" />
            {fieldErrors.cifNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.cifNumber}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="fullName">Nama Lengkap *</label>
            <input id="fullName" name="fullName" autoComplete="name" required className={inputCls} />
            {fieldErrors.fullName && <p className="mt-1 text-xs text-red-600">{fieldErrors.fullName}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="nik">
              NIK <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="nik" name="nik" autoComplete="off" className={inputCls} placeholder="16 digit NIK" />
            {fieldErrors.nik && <p className="mt-1 text-xs text-red-600">{fieldErrors.nik}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="phone">
              No. Telepon <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputCls} placeholder="08xxxxxxxxxx" />
            {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="emergencyContact">
              Kontak Darurat <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="emergencyContact" name="emergencyContact" autoComplete="off" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="address">
              Alamat Lengkap <span className="text-gray-400">(opsional)</span>
            </label>
            <textarea id="address" name="address" autoComplete="street-address" rows={2} className={inputCls} />
            {fieldErrors.address && <p className="mt-1 text-xs text-red-600">{fieldErrors.address}</p>}
          </div>
        </div>
      </section>

      <section className="rounded border bg-white p-5">
        <h2 className="mb-4 text-base font-semibold">Data Pembiayaan</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="contractNumber">Nomor Akad *</label>
            <input id="contractNumber" name="contractNumber" required className={inputCls} placeholder="FKT-2024-0001" />
            {fieldErrors.contractNumber && <p className="mt-1 text-xs text-red-600">{fieldErrors.contractNumber}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="productType">
              Akad Pembiayaan <span className="text-gray-400">(opsional)</span>
            </label>
            <select
              id="productType"
              name="productType"
              className={inputCls}
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
            >
              <option value="">-- Pilih Akad --</option>
              {FINANCING_PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {productScheme(productType) && (
              <p className="mt-1 text-xs text-gray-500">{productScheme(productType)}</p>
            )}
            {fieldErrors.productType && <p className="mt-1 text-xs text-red-600">{fieldErrors.productType}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="principalAmount">
              {SHARIAH_TERM.principal} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="principalAmount" name="principalAmount" type="number" step="0.01" className={inputCls} />
            {fieldErrors.principalAmount && <p className="mt-1 text-xs text-red-600">{fieldErrors.principalAmount}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="outstandingBalance">
              {SHARIAH_TERM.outstanding} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="outstandingBalance" name="outstandingBalance" type="number" step="0.01" className={inputCls} />
            {fieldErrors.outstandingBalance && <p className="mt-1 text-xs text-red-600">{fieldErrors.outstandingBalance}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="arrearsMargin">
              {SHARIAH_TERM.margin} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="arrearsMargin" name="arrearsMargin" type="number" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="penaltyAmount">
              {SHARIAH_TERM.penalty} (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="penaltyAmount" name="penaltyAmount" type="number" step="0.01" className={inputCls} />
            <p className="mt-1 text-xs text-gray-500">{SHARIAH_TERM.penaltyNote}</p>
          </div>
          <div>
            <label className={labelCls} htmlFor="dpd">
              DPD (hari) <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="dpd" name="dpd" type="number" min="0" className={inputCls} />
            {fieldErrors.dpd && <p className="mt-1 text-xs text-red-600">{fieldErrors.dpd}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="collectibility">
              Kolektibilitas <span className="text-gray-400">(opsional)</span>
            </label>
            <select id="collectibility" name="collectibility" className={inputCls}>
              {Object.values(Collectibility).map((c) => (
                <option key={c} value={c}>
                  {c.replace("KOL_", "KOL ")}
                </option>
              ))}
            </select>
            {fieldErrors.collectibility && <p className="mt-1 text-xs text-red-600">{fieldErrors.collectibility}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="collateralType">
              Jenis Agunan <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="collateralType" name="collateralType" className={inputCls} placeholder="Sertifikat Tanah / Motor" />
          </div>
          <div>
            <label className={labelCls} htmlFor="collateralValue">
              Nilai Agunan (Rp) <span className="text-gray-400">(opsional)</span>
            </label>
            <input id="collateralValue" name="collateralValue" type="number" step="0.01" className={inputCls} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan & Buat Kasus"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded border px-5 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Batal
        </button>
        <p className="text-xs text-gray-500">
          Kasus baru dibuat dengan status <strong>Draft</strong> dan menunggu verifikasi Supervisor (Gate 1).
        </p>
      </div>
    </form>
  );
}
