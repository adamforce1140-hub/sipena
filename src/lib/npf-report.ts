import { prisma } from "@/lib/prisma";
import { CaseStatus, Collectibility } from "@prisma/client";
import { COLLECTIBILITY_LABEL, STATUS_LABEL } from "@/lib/ui";

export type NpfFilter = {
  status: CaseStatus | null;
  collectibility: Collectibility | null;
  q: string;
};

export function parseNpfFilter(params: {
  status?: string;
  collectibility?: string;
  q?: string;
}): NpfFilter {
  const status = params.status as CaseStatus | undefined;
  const collectibility = params.collectibility as Collectibility | undefined;
  return {
    status: status && Object.values(CaseStatus).includes(status) ? status : null,
    collectibility:
      collectibility && Object.values(Collectibility).includes(collectibility)
        ? collectibility
        : null,
    q: params.q?.trim() ?? "",
  };
}

export function filterLabel(filter: NpfFilter): string {
  const parts: string[] = [];
  parts.push(
    filter.status
      ? `Status ${STATUS_LABEL[filter.status] ?? filter.status}`
      : "Semua status aktif (kasus selesai tidak dihitung)"
  );
  parts.push(
    filter.collectibility
      ? `Kolektibilitas ${COLLECTIBILITY_LABEL[filter.collectibility] ?? filter.collectibility}`
      : "Semua kolektibilitas"
  );
  if (filter.q) parts.push(`Pencarian "${filter.q}"`);
  return parts.join(" · ");
}

export function buildFilterQuery(filter: NpfFilter): string {
  const sp = new URLSearchParams();
  if (filter.status) sp.set("status", filter.status);
  if (filter.collectibility) sp.set("collectibility", filter.collectibility);
  if (filter.q) sp.set("q", filter.q);
  const query = sp.toString();
  return query ? `?${query}` : "";
}

export async function loadNpfCases(filter: NpfFilter) {
  return prisma.financing.findMany({
    where: {
      // Laporan NPF hanya memuat kasus berjalan. Kasus selesai/terkunci baru muncul
      // bila status "Selesai / Terkunci" dipilih secara eksplisit.
      ...(filter.status ? { caseStatus: filter.status } : { caseStatus: { not: "CLOSED" } }),
      ...(filter.collectibility ? { collectibility: filter.collectibility } : {}),
      ...(filter.q
        ? {
            OR: [
              { contractNumber: { contains: filter.q } },
              { customer: { fullName: { contains: filter.q } } },
              { customer: { nik: { contains: filter.q } } },
            ],
          }
        : {}),
    },
    include: {
      customer: {
        select: { cifNumber: true, fullName: true, nik: true },
      },
    },
    orderBy: [{ caseStatus: "asc" }, { updatedAt: "desc" }],
  });
}
