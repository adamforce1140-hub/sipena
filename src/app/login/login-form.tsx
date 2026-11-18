"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const QUICK_ACCOUNTS = [
  {
    role: "STAFF",
    label: "Staf Operasional",
    email: "staff@npf.local",
    description: "Tugas penagihan & pengajuan solusi",
  },
  {
    role: "SUPERVISOR",
    label: "Supervisor",
    email: "supervisor@npf.local",
    description: "Persetujuan 3 Gate & audit trail",
  },
];

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", { email, password, redirect: false });

    setLoading(false);
    if (res?.error) {
      setError("Email atau password salah.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function handleQuickLogin(quickEmail: string) {
    setError(null);
    setQuickLoading(quickEmail);

    const res = await signIn("credentials", {
      email: quickEmail,
      password: "password123",
      redirect: false,
    });

    setQuickLoading(null);
    if (res?.error) {
      setError("Login cepat gagal. Pastikan data seed sudah dijalankan.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold">Login — SIPENA</h1>
      <p className="text-sm text-gray-500">Sistem Pengelolaan Pembiayaan Bermasalah</p>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="nama@npf.local"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Masuk"}
      </button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-xs uppercase tracking-wide text-gray-500">
            atau login cepat
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {QUICK_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => handleQuickLogin(account.email)}
            disabled={loading || quickLoading !== null}
            className="flex w-full items-center justify-between rounded border px-3 py-2 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
          >
            <span>
              <span className="block text-sm font-medium text-gray-900">{account.label}</span>
              <span className="block text-xs text-gray-500">{account.description}</span>
            </span>
            <span className="ml-2 shrink-0 rounded bg-gray-100 px-2 py-1 font-mono text-[10px] uppercase text-gray-700">
              {quickLoading === account.email ? "..." : account.role}
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-gray-500">
        Login cepat memakai password default <span className="font-mono">password123</span> dari data seed.
      </p>
    </form>
  );
}
