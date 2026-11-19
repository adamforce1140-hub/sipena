"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah, formatDate, formatDateTime, STATUS_LABEL } from "@/lib/ui";
import { productLabel, productScheme, SHARIAH_TERM } from "@/lib/shariah";
import { ActivityType, SolutionType, CaseStatus } from "@prisma/client";
import type { CompletenessResult } from "@/lib/case-completeness";
import type {
  SerializedCase,
  SerializedCollectionLog,
  SerializedSolution,
  SerializedPayment,
} from "./types";

const inputCls =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-gray-700";

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = async (fn: () => Promise<string>, onDone?: () => void) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const msg = await fn();
      setSuccess(msg);
      onDone?.();
    } catch (e) {
      // Sertakan detail per-field dari validasi server agar pengguna tahu
      // bagian mana yang perlu diperbaiki, bukan hanya pesan generik.
      const err = e as Error & { fields?: { path: string; message: string }[] };
      const detail = (err.fields ?? [])
        .map((f) => f.message)
        .filter(Boolean)
        .join(" ");
      setError(detail ? `${err.message} ${detail}` : err.message);
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, success, run, setError };
}

/* ------------------------------------------------------------------ */
/*  Form Log Penagihan                                                  */
/* ------------------------------------------------------------------ */

function CollectionLogForm({
  financingId,
  onDone,
}: {
  financingId: string;
  onDone: () => void;
}) {
  const { busy, error, success, run } = useAction();
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("financingId", financingId);
      const { url } = await apiFetch<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setEvidenceUrl(url);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
          activityType: String(fd.get("activityType")),
          notes: String(fd.get("notes")),
          ptpDate: fd.get("ptpDate") ? String(fd.get("ptpDate")) : null,
          ptpAmount: fd.get("ptpAmount") ? Number(fd.get("ptpAmount")) : null,
          evidenceUrl: evidenceUrl ?? "",
        };
        run(async () => {
          await apiFetch(`/api/cases/${financingId}/collection-logs`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          (e.target as HTMLFormElement).reset();
          setEvidenceUrl(null);
          onDone();
          return "Log penagihan tersimpan.";
        });
      }}
      className="space-y-3 rounded border bg-white p-4"
    >
      <h3 className="text-sm font-semibold">Catat Aktivitas Penagihan</h3>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">{success}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="log-activityType" className={labelCls}>
            Jenis Aktivitas
          </label>
          <select id="log-activityType" name="activityType" className={inputCls} required>
            {Object.values(ActivityType).map((a) => (
              <option key={a} value={a}>
                {a === "CALL" ? "Telepon" : a === "WHATSAPP" ? "WhatsApp" : "Kunjungan"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="log-ptpDate" className={labelCls}>
            Janji Bayar (PTP)
          </label>
          <input id="log-ptpDate" type="date" name="ptpDate" className={inputCls} />
        </div>
        <div>
          <label htmlFor="log-ptpAmount" className={labelCls}>
            Nominal PTP (Rp)
          </label>
          <input id="log-ptpAmount" type="number" step="0.01" name="ptpAmount" className={inputCls} />
        </div>
        <div>
          <label htmlFor="log-evidence" className={labelCls}>
            Bukti (JPG/PNG/PDF)
          </label>
          <input
            id="log-evidence"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            className="w-full text-xs"
          />
          {uploading && <p className="mt-1 text-xs text-gray-500">Mengunggah...</p>}
          {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
          {evidenceUrl && (
            <a href={evidenceUrl} target="_blank" className="mt-1 block text-xs text-blue-600 underline">
              Bukti terunggah ✓
            </a>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="log-notes" className={labelCls}>
          Catatan
        </label>
        <textarea id="log-notes" name="notes" required rows={2} className={inputCls} />
      </div>
      <button
        type="submit"
        disabled={busy || uploading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Menyimpan..." : "Simpan Log"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Pengajuan Solusi                                              */
/* ------------------------------------------------------------------ */

function SolutionForm({
  financingId,
  onDone,
}: {
  financingId: string;
  onDone: () => void;
}) {
  const { busy, error, success, run, setError } = useAction();
  const [supportingUrl, setSupportingUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("financingId", financingId);
      const { url } = await apiFetch<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setSupportingUrl(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload = {
          solutionType: String(fd.get("solutionType")),
          proposalSummary: String(fd.get("proposalSummary")),
          proposedAmount: fd.get("proposedAmount") ? Number(fd.get("proposedAmount")) : null,
          supportingUrl: supportingUrl ?? "",
        };
        run(async () => {
          await apiFetch(`/api/cases/${financingId}/solutions`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          (e.target as HTMLFormElement).reset();
          setSupportingUrl(null);
          onDone();
          return "Usulan solusi diajukan. Kasus menunggu Gate 2.";
        });
      }}
      className="space-y-3 rounded border bg-white p-4"
    >
      <h3 className="text-sm font-semibold">Ajukan Usulan Solusi</h3>
      <p className="text-xs text-gray-500">
        Pengajuan akan mengubah status kasus menjadi <strong>Review Solusi</strong> dan menunggu keputusan Supervisor.
      </p>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">{success}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="solution-type" className={labelCls}>
            Jenis Solusi
          </label>
          <select id="solution-type" name="solutionType" className={inputCls} required>
            {Object.values(SolutionType).map((s) => (
              <option key={s} value={s}>
                {SOLUTION_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="solution-amount" className={labelCls}>
            Nominal Usulan (Rp)
          </label>
          <input
            id="solution-amount"
            type="number"
            step="0.01"
            name="proposedAmount"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label htmlFor="solution-summary" className={labelCls}>
          Ringkasan Usulan
        </label>
        <textarea id="solution-summary" name="proposalSummary" required rows={3} className={inputCls} />
      </div>
      <div>
        <label htmlFor="solution-document" className={labelCls}>
          Dokumen Pendukung
        </label>
        <input
          id="solution-document"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          className="w-full text-xs"
        />
        {uploading && <p className="mt-1 text-xs text-gray-500">Mengunggah...</p>}
        {supportingUrl && (
          <a href={supportingUrl} target="_blank" className="mt-1 block text-xs text-blue-600 underline">
            Dokumen terunggah ✓
          </a>
        )}
      </div>
      <button
        type="submit"
        disabled={busy || uploading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Mengirim..." : "Ajukan Solusi"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Upload Bukti Pembayaran                                       */
/* ------------------------------------------------------------------ */

function PaymentForm({
  financingId,
  outstandingBalance,
  arrearsMargin,
  penaltyAmount,
  onDone,
}: {
  financingId: string;
  outstandingBalance: number;
  arrearsMargin: number;
  penaltyAmount: number;
  onDone: () => void;
}) {
  const { busy, error, success, run, setError } = useAction();
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [principal, setPrincipal] = useState("");
  const [margin, setMargin] = useState("");
  const [penalty, setPenalty] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const total = (Number(principal) || 0) + (Number(margin) || 0) + (Number(penalty) || 0);
  const sisaPokok = Math.max(0, outstandingBalance - (Number(principal) || 0));
  const sisaMargin = Math.max(0, arrearsMargin - (Number(margin) || 0));
  const sisaTaZir = Math.max(0, penaltyAmount - (Number(penalty) || 0));
  // Ta'zir ikut menjadi syarat lunas, sama seperti perhitungan isSettled di API.
  const lunas = sisaPokok <= 0 && sisaMargin <= 0 && sisaTaZir <= 0;

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("financingId", financingId);
      const { url } = await apiFetch<{ url: string }>("/api/upload", { method: "POST", body: fd });
      setReceiptUrl(url);
      setValidationError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      noValidate
      onInput={() => validationError && setValidationError(null)}
      onSubmit={(e) => {
        e.preventDefault();
        setValidationError(null);
        const fd = new FormData(e.currentTarget);
        // Tombol sengaja tidak dinonaktifkan agar pengguna tetap mendapat pesan
        // peringatan yang jelas saat syarat pembayaran belum terpenuhi.
        const missing: string[] = [];
        if (!fd.get("paymentDate")) missing.push("tanggal pembayaran belum diisi");
        if (total <= 0) missing.push("nominal pembayaran (pokok/margin/ta'zir) belum diisi");
        if ((Number(principal) || 0) > outstandingBalance)
          missing.push(
            `alokasi pokok melebihi sisa kewajiban (maksimal ${formatRupiah(outstandingBalance)})`
          );
        if ((Number(margin) || 0) > arrearsMargin)
          missing.push(
            `alokasi margin melebihi tunggakan (maksimal ${formatRupiah(arrearsMargin)})`
          );
        if ((Number(penalty) || 0) > penaltyAmount)
          missing.push(`alokasi ta'zir melebihi tunggakan (maksimal ${formatRupiah(penaltyAmount)})`);
        if (!receiptUrl) missing.push("bukti transfer/pelunasan belum diunggah");
        if (missing.length > 0) {
          const listText =
            missing.length > 1
              ? `${missing.slice(0, -1).join(", ")}, dan ${missing[missing.length - 1]}`
              : missing[0];
          setValidationError(`Pembayaran belum dapat disimpan: ${listText}.`);
          return;
        }
        const payload = {
          principalPortion: Number(principal) || 0,
          marginPortion: Number(margin) || 0,
          penaltyPortion: Number(penalty) || 0,
          paymentDate: String(fd.get("paymentDate")),
          receiptUrl: receiptUrl ?? "",
          notes: fd.get("notes") ? String(fd.get("notes")) : null,
        };
        run(async () => {
          const res = await apiFetch<{ message: string }>(`/api/cases/${financingId}/payments`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          (e.target as HTMLFormElement).reset();
          setReceiptUrl(null);
          setPrincipal("");
          setMargin("");
          setPenalty("");
          onDone();
          return res.message;
        });
      }}
      className="space-y-3 rounded border bg-white p-4"
    >
      <h3 className="text-sm font-semibold">Catat Pembayaran Nasabah</h3>
      <p className="text-xs text-gray-500">
        Pembayaran dialokasikan ke tunggakan margin dan {SHARIAH_TERM.outstanding.toLowerCase()}.
        Status berubah menjadi <strong>Review Tutup</strong> hanya bila pokok, margin &amp; ta&apos;zir lunas.
      </p>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded bg-green-50 px-3 py-2 text-xs text-green-700">{success}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="pay-margin" className={labelCls}>
            {SHARIAH_TERM.margin} (Rp)
          </label>
          <input
            id="pay-margin"
            name="marginPortion"
            type="number"
            step="0.01"
            min="0"
            max={arrearsMargin}
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-500">Tercatat {formatRupiah(arrearsMargin)}</p>
        </div>
        <div>
          <label htmlFor="pay-principal" className={labelCls}>
            {SHARIAH_TERM.outstanding} (Rp)
          </label>
          <input
            id="pay-principal"
            name="principalPortion"
            type="number"
            step="0.01"
            min="0"
            max={outstandingBalance}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-500">Tercatat {formatRupiah(outstandingBalance)}</p>
        </div>
        <div>
          <label htmlFor="pay-penalty" className={labelCls}>
            {SHARIAH_TERM.penalty} (Rp)
          </label>
          <input
            id="pay-penalty"
            name="penaltyPortion"
            type="number"
            step="0.01"
            min="0"
            max={penaltyAmount}
            value={penalty}
            onChange={(e) => setPenalty(e.target.value)}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-gray-500">Tercatat {formatRupiah(penaltyAmount)}</p>
        </div>
        <div>
          <label htmlFor="pay-date" className={labelCls}>
            Tanggal Pembayaran
          </label>
          <input id="pay-date" type="date" name="paymentDate" className={inputCls} />
        </div>
      </div>
      <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Total pembayaran: <strong>{formatRupiah(total)}</strong> · Sisa pokok {formatRupiah(sisaPokok)} ·
        Sisa margin {formatRupiah(sisaMargin)} · Sisa ta&apos;zir {formatRupiah(sisaTaZir)} ·{" "}
        {lunas ? "Kewajiban pokok, margin & ta'zir lunas" : "Belum lunas"}
      </div>
      <div>
        <label htmlFor="pay-receipt" className={labelCls}>
          Bukti Transfer / Pelunasan *
        </label>
        <input
          id="pay-receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          className="w-full text-xs"
        />
        {uploading && <p className="mt-1 text-xs text-gray-500">Mengunggah...</p>}
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" className="mt-1 block text-xs text-blue-600 underline">
            Bukti terunggah ✓
          </a>
        )}
      </div>
      <div>
        <label htmlFor="pay-notes" className={labelCls}>
          Catatan
        </label>
        <textarea id="pay-notes" name="notes" rows={2} className={inputCls} />
      </div>
      {validationError && (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{validationError}</p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy || uploading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Menyimpan..." : "Simpan Pembayaran"}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          {busy
            ? "Menyimpan pembayaran, mohon tunggu..."
            : uploading
              ? "Menunggu unggahan bukti selesai..."
              : "Pembayaran dapat disimpan setelah tanggal, nominal, dan bukti transfer dilengkapi."}
        </p>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Action Panel Supervisor (3 Gate)                                   */
/* ------------------------------------------------------------------ */

function SupervisorGatePanel({
  financingId,
  caseStatus,
  needsRevision,
  completeness,
  onDone,
}: {
  financingId: string;
  caseStatus: CaseStatus;
  needsRevision: boolean;
  completeness: CompletenessResult;
  onDone: () => void;
}) {
  const { busy, error, success, run } = useAction();
  const [notes, setNotes] = useState("");

  const gate = (() => {
    switch (caseStatus) {
      case "DRAFT":
        return {
          step: "Tindakan 1: Verifikasi Kasus",
          endpoint: "gate-1",
          approveLabel: "Verifikasi & Aktifkan",
          rejectLabel: "Tolak untuk Revisi",
        };
      case "PENDING_SOLUTION":
        return {
          step: "Tindakan 2: Keputusan Solusi",
          endpoint: "gate-2",
          approveLabel: "Approve Solusi",
          rejectLabel: "Reject Solusi",
        };
      case "PENDING_CLOSURE":
        return {
          step: "Tindakan 3: Penutupan Kasus",
          endpoint: "gate-3",
          approveLabel: "Sahkan & Kunci Kasus",
          rejectLabel: "Kembalikan ke Eksekusi",
        };
      default:
        return null;
    }
  })();

  if (!gate) {
    if (caseStatus === "CLOSED") {
      return (
        <div className="rounded border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-semibold text-green-800">Kasus Telah Ditutup & Dikunci Permanen</p>
          <p className="mt-1 text-xs text-green-700">
            Kasus ditutup oleh Supervisor. Data tidak dapat diubah lagi.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Tidak ada tindakan Supervisor yang tersedia pada status saat ini. Anda akan diberi notifikasi saat kasus
          masuk antrean Gate.
        </p>
      </div>
    );
  }

  // Keputusan pada tahap ini sudah dikembalikan ke Staf; jangan tawarkan tombol lagi
  // agar keputusan tidak tercatat dua kali.
  if (needsRevision) {
    return (
      <div className="rounded border border-blue-300 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">Menunggu Revisi Staf</p>
        <p className="mt-1 text-xs text-blue-800">
          Kasus sudah Anda kembalikan untuk revisi. Kasus akan muncul kembali di antrean Gate setelah
          Staf menyimpan perbaikan data.
        </p>
      </div>
    );
  }

  const decide = (decision: "APPROVE" | "REJECT") => {
    // Cegah klik ganda yang membuat keputusan tercatat dua kali.
    if (busy) return;
    return run(async () => {
      await apiFetch(`/api/cases/${financingId}/${gate.endpoint}`, {
        method: "POST",
        body: JSON.stringify({ decision, notes: notes || null }),
      });
      setNotes("");
      onDone();
      return decision === "APPROVE" ? "Keputusan tersimpan." : "Kasus dikembalikan untuk revisi.";
    });
  };

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">{gate.step}</p>
      <p className="mt-1 text-xs text-amber-800">
        Anda sebagai Supervisor memverifikasi kelengkapan data, kelayakan solusi, dan hasil eksekusi sebelum kasus
        lanjut ke tahap berikutnya.
      </p>

      {/* Ringkasan kelengkapan sebagai bahan verifikasi — tidak memblokir keputusan. */}
      <div className="mt-3 rounded border border-amber-200 bg-white/70 p-3">
        <p className="text-xs font-semibold text-gray-800">
          Kelengkapan data: {completeness.filled}/{completeness.total} ({completeness.percent}%)
        </p>
        {completeness.missing.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-gray-600">Belum terisi:</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {completeness.missing.map((label) => (
                <li key={label} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              Data belum lengkap tetap dapat diverifikasi; kekurangan menjadi catatan revisi untuk Staf.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-green-700">Seluruh data utama sudah terisi.</p>
        )}
      </div>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="mt-3 rounded bg-green-50 px-3 py-2 text-xs text-green-700">{success}</p>}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Catatan Supervisor (opsional)"
        className="mt-3 w-full rounded border border-amber-300 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decide("APPROVE")}
          disabled={busy}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "Memproses..." : gate.approveLabel}
        </button>
        <button
          onClick={() => decide("REJECT")}
          disabled={busy}
          className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {gate.rejectLabel}
        </button>
      </div>
      {busy && (
        <p className="mt-2 text-xs text-amber-800">Sedang memproses keputusan, mohon tunggu...</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab contents                                                        */
/* ------------------------------------------------------------------ */

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

const SOLUTION_LABEL: Record<SolutionType, string> = {
  RESTRUCTURE: "Restrukturisasi Akad",
  PENALTY_WAIVER: "Penghapusan Ta'zir",
  WARNING_LETTER_SP1: "Surat Peringatan SP1",
  WARNING_LETTER_SP2: "Surat Peringatan SP2",
  WARNING_LETTER_SP3: "Surat Peringatan SP3",
  COLLATERAL_EXECUTION: "Eksekusi Jaminan (Rahn)",
  WRITE_OFF: "Hapus Buku",
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  CALL: "Telepon",
  WHATSAPP: "WhatsApp",
  VISIT: "Kunjungan",
};

const SOLUTION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Keputusan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

/** Peringatan (bukan penghalang) pada kasus yang dikembalikan Supervisor. */
function RevisionNotice({ financingId }: { financingId: string }) {
  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Supervisor meminta revisi data.</strong> Anda tetap bisa mencatat aktivitas lapangan seperti
      biasa.{" "}
      <a href={`/cases/${financingId}/edit`} className="font-semibold underline">
        Lengkapi / perbaiki data kasus
      </a>
      .
    </div>
  );
}

export function CaseTabs({
  data,
  role,
  onRefresh,
  initialTab,
}: {
  data: SerializedCase;
  role: string;
  onRefresh: () => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState<"profile" | "collection" | "solution" | "payment">(() =>
    initialTab === "collection" || initialTab === "solution" || initialTab === "payment"
      ? initialTab
      : "profile"
  );

  // Simpan tab aktif ke URL agar refresh / bookmark / tombol kembali tidak
  // selalu memaksa pengguna kembali ke tab Profil.
  const selectTab = (next: "profile" | "collection" | "solution" | "payment") => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "profile") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", next);
    }
    window.history.replaceState(null, "", url.toString());
  };

  // Supervisor hanya memverifikasi & memberi keputusan. Staf tetap boleh
  // mencatat penagihan/solusi/pembayaran walau kasus sedang dikembalikan
  // untuk revisi — status kasus yang menjadi satu-satunya syarat.
  const canLog =
    role === "STAFF" && (data.caseStatus === "ACTIVE" || data.caseStatus === "IN_EXECUTION");
  const canPropose = role === "STAFF" && data.caseStatus === "ACTIVE";
  const canPay = role === "STAFF" && data.caseStatus === "IN_EXECUTION";

  const approvedSolution = data.solutions.find((s) => s.status === "APPROVED") ?? null;
  const warningLevel =
    approvedSolution?.solutionType === "WARNING_LETTER_SP3"
      ? 3
      : approvedSolution?.solutionType === "WARNING_LETTER_SP2"
        ? 2
        : 1;
  const canPrintBeritaAcara =
    data.caseStatus === "PENDING_CLOSURE" || data.caseStatus === "CLOSED";

  const tabs = [
    { key: "profile" as const, label: "Profil Nasabah & Agunan" },
    { key: "collection" as const, label: `Riwayat Penagihan (${data.collectionLogs.length})` },
    { key: "solution" as const, label: `Skema Solusi (${data.solutions.length})` },
    { key: "payment" as const, label: `Bukti Pembayaran (${data.payments.length})` },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="py-5">
        {tab === "profile" && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded border bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold">Data Nasabah</h3>
              <InfoRow label="Nomor CIF" value={data.customer.cifNumber} />
              <InfoRow label="Nama Lengkap" value={data.customer.fullName} />
              <InfoRow label="NIK" value={data.customer.nik} />
              <InfoRow label="No. Telepon" value={data.customer.phone} />
              <InfoRow
                label="Kontak Darurat"
                value={data.customer.emergencyContact ?? "-"}
              />
              <InfoRow label="Alamat" value={data.customer.address} />
            </div>
            <div className="rounded border bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold">Data Pembiayaan & Agunan</h3>
              <InfoRow label="Nomor Akad" value={data.contractNumber} />
              <InfoRow
                label="Akad Pembiayaan"
                value={`${productLabel(data.productType)}${
                  productScheme(data.productType) ? ` — ${productScheme(data.productType)}` : ""
                }`}
              />
              <InfoRow label={SHARIAH_TERM.principal} value={formatRupiah(data.principalAmount)} />
              <InfoRow label={SHARIAH_TERM.outstanding} value={formatRupiah(data.outstandingBalance)} />
              <InfoRow label={SHARIAH_TERM.margin} value={formatRupiah(data.arrearsMargin)} />
              <InfoRow label={SHARIAH_TERM.penalty} value={formatRupiah(data.penaltyAmount)} />
              <InfoRow label="DPD" value={`${data.dpd} hari`} />
              <InfoRow label="Kolektibilitas" value={data.collectibility.replace("KOL_", "KOL ")} />
              <InfoRow label="Jenis Agunan" value={data.collateralType ?? "-"} />
              <InfoRow
                label="Nilai Agunan"
                value={data.collateralValue === null ? "-" : formatRupiah(data.collateralValue)}
              />
            </div>
          </div>
        )}

        {tab === "collection" && (
          <div className="space-y-4">
            {role === "STAFF" && data.needsRevision && <RevisionNotice financingId={data.id} />}
            {canLog && <CollectionLogForm financingId={data.id} onDone={onRefresh} />}
            {!canLog && role === "STAFF" && (
              <p className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Form log penagihan hanya tersedia pada status Aktif atau Eksekusi. Status saat ini:{" "}
                <strong>{STATUS_LABEL[data.caseStatus]}</strong>.
              </p>
            )}
            {data.collectionLogs.length === 0 ? (
              <p className="rounded border bg-white px-4 py-8 text-center text-sm text-gray-500">
                Belum ada aktivitas penagihan tercatat.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.collectionLogs.map((log: SerializedCollectionLog) => (
                  <li key={log.id} className="rounded border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
                        {ACTIVITY_LABEL[log.activityType]}
                      </span>
                      <span className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm">{log.notes}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      oleh {log.staff.name}
                      {log.ptpDate && ` · PTP ${formatDate(log.ptpDate)}`}
                      {log.ptpAmount !== null && ` (${formatRupiah(log.ptpAmount)})`}
                    </p>
                    {log.evidenceUrl && (
                      <a
                        href={log.evidenceUrl}
                        target="_blank"
                        className="mt-2 inline-block text-xs text-blue-600 underline"
                      >
                        Lihat Bukti
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "solution" && (
          <div className="space-y-4">
            {approvedSolution && (
              <div className="rounded border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-900">Dokumen Surat Peringatan</h3>
                <p className="mt-1 text-xs text-blue-800">
                  Usulan solusi <strong>{SOLUTION_LABEL[approvedSolution.solutionType]}</strong> telah disetujui
                  Supervisor. Tingkat SP yang disarankan: <strong>SP{warningLevel}</strong>.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[1, 2, 3].map((level) => (
                    <a
                      key={level}
                      href={`/api/cases/${data.id}/documents/warning-letter?level=${level}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`rounded px-4 py-2 text-sm font-medium text-white ${
                        level === warningLevel
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-blue-400 hover:bg-blue-500"
                      }`}
                    >
                      Cetak SP {level}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {!approvedSolution && (
              <p className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Tombol cetak Surat Peringatan tersedia setelah usulan solusi disetujui Supervisor (Gate 2).
              </p>
            )}
            {role === "STAFF" && data.needsRevision && <RevisionNotice financingId={data.id} />}
            {canPropose && <SolutionForm financingId={data.id} onDone={onRefresh} />}
            {!canPropose && role === "STAFF" && (
              <p className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Pengajuan solusi hanya dapat dilakukan saat status <strong>Aktif</strong>. Status saat
                ini: <strong>{STATUS_LABEL[data.caseStatus]}</strong>.
              </p>
            )}
            {data.solutions.length === 0 ? (
              <p className="rounded border bg-white px-4 py-8 text-center text-sm text-gray-500">
                Belum ada usulan solusi.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.solutions.map((s: SerializedSolution) => (
                  <li key={s.id} className="rounded border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{SOLUTION_LABEL[s.solutionType]}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : s.status === "REJECTED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {SOLUTION_STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{s.proposalSummary}</p>
                    {s.proposedAmount !== null && (
                      <p className="mt-1 text-sm font-medium">Nominal: {formatRupiah(s.proposedAmount)}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      diajukan {s.proposedBy.name} · {formatDateTime(s.createdAt)}
                      {s.reviewedBy && ` · ditinjau ${s.reviewedBy.name}`}
                    </p>
                    {s.supervisorNotes && (
                      <p className="mt-2 rounded bg-gray-50 px-3 py-2 text-xs">
                        Catatan Supervisor: {s.supervisorNotes}
                      </p>
                    )}
                    {s.supportingUrl && (
                      <a
                        href={s.supportingUrl}
                        target="_blank"
                        className="mt-2 inline-block text-xs text-blue-600 underline"
                      >
                        Lihat Dokumen Pendukung
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "payment" && (
          <div className="space-y-4">
            {canPrintBeritaAcara && (
              <div className="rounded border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-sm font-semibold text-blue-900">Berita Acara Penyelesaian</h3>
                <p className="mt-1 text-xs text-blue-800">
                  Kasus telah dieksekusi. Cetak berita acara sebagai bukti penyelesaian pembiayaan.
                </p>
                <a
                  href={`/api/cases/${data.id}/documents/berita-acara`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Cetak Berita Acara
                </a>
              </div>
            )}
            {role === "STAFF" && data.needsRevision && <RevisionNotice financingId={data.id} />}
            {canPay && (
              <PaymentForm
                financingId={data.id}
                outstandingBalance={data.outstandingBalance}
                arrearsMargin={data.arrearsMargin}
                penaltyAmount={data.penaltyAmount}
                onDone={onRefresh}
              />
            )}
            {!canPay && role === "STAFF" && (
              <p className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Upload bukti pembayaran hanya dapat dilakukan saat status <strong>Eksekusi</strong>.
              </p>
            )}
            {data.payments.length === 0 ? (
              <p className="rounded border bg-white px-4 py-8 text-center text-sm text-gray-500">
                Belum ada bukti pembayaran.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.payments.map((p: SerializedPayment) => (
                  <li key={p.id} className="rounded border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{formatRupiah(p.paymentAmount)}</span>
                      <span className="text-xs text-gray-500">{formatDate(p.paymentDate)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      {p.principalPortion + p.marginPortion + p.penaltyPortion > 0 ? (
                        <>
                          Pokok {formatRupiah(p.principalPortion)} · Margin {formatRupiah(p.marginPortion)}{" "}
                          · Ta&apos;zir {formatRupiah(p.penaltyPortion)} (dana kebajikan)
                        </>
                      ) : (
                        "Pembayaran lama (alokasi pokok/margin belum tercatat)"
                      )}
                    </p>
                    {p.notes && <p className="mt-2 text-sm">{p.notes}</p>}
                    <p className="mt-1 text-xs text-gray-500">diunggah {p.uploadedBy.name}</p>
                    <a
                      href={p.receiptUrl}
                      target="_blank"
                      className="mt-2 inline-block text-xs text-blue-600 underline"
                    >
                      Lihat Bukti Transfer
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { SupervisorGatePanel };
