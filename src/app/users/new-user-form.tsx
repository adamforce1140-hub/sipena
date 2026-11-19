"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export function NewUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"STAFF" | "SUPERVISOR">("STAFF");
  const [password, setPassword] = useState("");

  function reset() {
    setName("");
    setEmail("");
    setRole("STAFF");
    setPassword("");
    setFieldErrors({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setFieldErrors({});
    setBusy(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({ name, email, role, password }),
      });
      setInfo(`Pengguna ${name} berhasil ditambahkan.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      const e2 = err as Error & { fields?: { path: string; message: string }[] };
      setError(e2.message);
      if (e2.fields) {
        setFieldErrors(
          Object.fromEntries(e2.fields.map((f) => [f.path, f.message]))
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      {info && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {info}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setInfo(null);
            setError(null);
          }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Tambah Pengguna
        </button>
      ) : (
        <form onSubmit={submit} className="rounded border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Pengguna Baru</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex flex-col">
              <label htmlFor="new-user-name" className="mb-1 text-xs font-medium text-gray-600">
                Nama
              </label>
              <input
                id="new-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                required
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>
            <div className="flex flex-col">
              <label htmlFor="new-user-email" className="mb-1 text-xs font-medium text-gray-600">
                Email
              </label>
              <input
                id="new-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                required
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>
            <div className="flex flex-col">
              <label htmlFor="new-user-role" className="mb-1 text-xs font-medium text-gray-600">
                Role
              </label>
              <select
                id="new-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "STAFF" | "SUPERVISOR")}
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="STAFF">Staf</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
              {fieldErrors.role && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.role}</p>
              )}
            </div>
            <div className="flex flex-col">
              <label htmlFor="new-user-password" className="mb-1 text-xs font-medium text-gray-600">
                Kata Sandi Awal (min. 8)
              </label>
              <input
                id="new-user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
                autoComplete="new-password"
                required
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || password.length < 8}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {busy ? "Menyimpan..." : "Simpan Pengguna"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                reset();
              }}
              className="rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
