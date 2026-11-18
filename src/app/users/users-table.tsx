"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { ROLE_LABEL, formatDate } from "@/lib/ui";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  collectionLogs: number;
  payments: number;
};

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  async function toggleActive(user: UserRow) {
    setError(null);
    setInfo(null);
    setBusyId(user.id);
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function submitReset(user: UserRow) {
    setError(null);
    setInfo(null);
    setBusyId(user.id);
    try {
      await apiFetch(`/api/users/${user.id}/password`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setInfo(`Kata sandi ${user.name} berhasil direset.`);
      setResetId(null);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {info}
        </div>
      )}

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aktivitas</th>
              <th className="px-3 py-2">Dibuat</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">
                    {u.name}
                    {isSelf && <span className="ml-2 text-xs text-gray-500">(Anda)</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{u.email}</td>
                  <td className="px-3 py-2">{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {u.collectionLogs} log · {u.payments} bayar
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === u.id || (isSelf && u.isActive)}
                        onClick={() => toggleActive(u)}
                        title={isSelf && u.isActive ? "Akun sendiri tidak dapat dinonaktifkan" : undefined}
                        className={`rounded border px-2 py-1 text-xs font-medium disabled:opacity-40 ${
                          u.isActive
                            ? "border-red-300 text-red-700 hover:bg-red-50"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetId(resetId === u.id ? null : u.id);
                          setPassword("");
                          setError(null);
                        }}
                        className="rounded border px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {resetId === u.id ? "Batal" : "Reset Kata Sandi"}
                      </button>
                    </div>

                    {resetId === u.id && (
                      <form
                        className="mt-2 flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          submitReset(u);
                        }}
                      >
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Kata sandi baru (min. 8)"
                          className="w-52 rounded border px-2 py-1 text-xs"
                          autoComplete="new-password"
                        />
                        <button
                          type="submit"
                          disabled={busyId === u.id || password.length < 8}
                          className="rounded bg-gray-800 px-3 py-1 text-xs text-white disabled:opacity-40"
                        >
                          Simpan
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
