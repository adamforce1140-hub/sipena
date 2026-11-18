import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { NewCaseForm } from "./new-case-form";

export default async function NewCasePage() {
  const session = await auth();
  if (session!.user.role !== "STAFF") {
    redirect("/cases");
  }

  return (
    <AppShell active="cases">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Tambah Kasus NPF Baru</h1>
        <p className="text-sm text-gray-500">
          Lengkapi data nasabah dan pembiayaan. Kasus akan berstatus Draft sampai diverifikasi Supervisor.
        </p>
      </div>
      <NewCaseForm />
    </AppShell>
  );
}
