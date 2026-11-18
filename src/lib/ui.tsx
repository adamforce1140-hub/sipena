import { CaseStatus } from "@prisma/client";

export const STATUS_LABEL: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Aktif",
  PENDING_SOLUTION: "Review Solusi",
  IN_EXECUTION: "Eksekusi",
  PENDING_CLOSURE: "Review Tutup",
  CLOSED: "Selesai / Terkunci",
};

export const STATUS_STYLE: Record<CaseStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-blue-100 text-blue-700",
  PENDING_SOLUTION: "bg-amber-100 text-amber-700",
  IN_EXECUTION: "bg-purple-100 text-purple-700",
  PENDING_CLOSURE: "bg-orange-100 text-orange-700",
  CLOSED: "bg-green-100 text-green-700",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export const COLLECTIBILITY_LABEL: Record<string, string> = {
  KOL_3: "KOL 3",
  KOL_4: "KOL 4",
  KOL_5: "KOL 5",
};

export const ROLE_LABEL: Record<string, string> = {
  STAFF: "Staf",
  SUPERVISOR: "Supervisor",
};

export function CollectibilityBadge({ value }: { value: string }) {
  const style =
    value === "KOL_5"
      ? "bg-red-100 text-red-700"
      : value === "KOL_4"
        ? "bg-orange-100 text-orange-700"
        : "bg-yellow-100 text-yellow-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {COLLECTIBILITY_LABEL[value] ?? value}
    </span>
  );
}

export function formatRupiah(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
