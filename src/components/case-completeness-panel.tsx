import Link from "next/link";
import type { CompletenessResult } from "@/lib/case-completeness";

/**
 * Ringkasan kelengkapan data kasus. Bersifat informatif untuk Supervisor
 * (bahan verifikasi) dan pengingat untuk Staf — tidak memblokir pengiriman.
 */
export function CaseCompletenessPanel({
  result,
  editHref,
  showEditLink,
}: {
  result: CompletenessResult;
  editHref?: string;
  showEditLink?: boolean;
}) {
  const tone = result.complete
    ? "border-green-300 bg-green-50 text-green-900"
    : "border-amber-300 bg-amber-50 text-amber-900";
  const bar = result.complete ? "bg-green-600" : "bg-amber-500";

  return (
    <div className={`rounded border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {result.complete ? "Data kasus lengkap" : "Data kasus belum lengkap"}
          <span className="ml-2 font-normal">
            {result.filled}/{result.total} terisi
          </span>
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold">{result.percent}%</span>
          {showEditLink && editHref && (
            <Link href={editHref} className="text-xs font-semibold underline">
              Lengkapi data
            </Link>
          )}
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
        <div className={`h-full ${bar}`} style={{ width: `${result.percent}%` }} />
      </div>

      {result.missing.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium">Yang masih kosong:</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {result.missing.map((label) => (
              <li key={label} className="rounded bg-white/70 px-2 py-0.5 text-xs">
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            Kasus tetap dapat diverifikasi. Data boleh dilengkapi Staf menyusul.
          </p>
        </div>
      )}
    </div>
  );
}
