"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { checkCaseCompleteness } from "@/lib/case-completeness";
import { CaseTabs, SupervisorGatePanel } from "./case-tabs";
import type { SerializedCase } from "./types";

export function CaseDetailClient({
  data,
  role,
  initialTab,
}: {
  data: SerializedCase;
  role: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const completeness = checkCaseCompleteness({
    customer: data.customer,
    productType: data.productType,
    principalAmount: data.principalAmount,
    outstandingBalance: data.outstandingBalance,
    collateralType: data.collateralType,
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <CaseTabs data={data} role={role} onRefresh={refresh} initialTab={initialTab} />
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        {role === "SUPERVISOR" ? (
          <SupervisorGatePanel
            financingId={data.id}
            caseStatus={data.caseStatus}
            needsRevision={data.needsRevision}
            completeness={completeness}
            onDone={refresh}
          />
        ) : (
          <div className="rounded border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold">Panel Staf</p>
            <p className="mt-1 text-xs text-gray-600">
              Tindakan Gate (verifikasi, persetujuan solusi, penutupan kasus) hanya dapat dilakukan oleh Supervisor.
            </p>
            {data.caseStatus === "DRAFT" && (
              <div className="mt-3 border-t pt-3">
                <DeleteCaseButton id={data.id} />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 rounded border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold">Riwayat Keputusan Gate</p>
          {data.gateHistory.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">Belum ada keputusan gate.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data.gateHistory.map((g) => (
                <li key={g.id} className="border-l-2 border-gray-200 pl-3 text-xs">
                  <p className="font-medium">
                    {GATE_LABEL[g.gateStep]} —{" "}
                    <span
                      className={
                        g.decision === "APPROVED" ? "text-green-700" : "text-red-700"
                      }
                    >
                      {g.decision === "APPROVED" ? "Disetujui" : "Ditolak"}
                    </span>
                  </p>
                  <p className="text-gray-500">
                    {g.supervisor.name} · {new Date(g.createdAt).toLocaleString("id-ID")}
                  </p>
                  {g.notes && <p className="mt-0.5 text-gray-600">{g.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

const GATE_LABEL: Record<string, string> = {
  GATE_1_VERIFY: "Gate 1",
  GATE_2_SOLUTION: "Gate 2",
  GATE_3_CLOSE: "Gate 3",
};

/**
 * Hapus kasus yang masih DRAFT (salah input). Server menolak bila status sudah
 * melewati Draft; tombol hanya ditampilkan pada kondisi tersebut.
 */
function DeleteCaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const ok = window.confirm(
      "Hapus kasus ini secara permanen? Data nasabah dan seluruh riwayat terkait akan ikut dihapus."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/cases/${id}`, { method: "DELETE" });
      router.push("/cases");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="w-full rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {busy ? "Menghapus..." : "Hapus Kasus"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
