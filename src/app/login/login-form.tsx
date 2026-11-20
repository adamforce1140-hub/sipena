"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-lg border bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-xl font-bold">Login — SIPENA</h1>
        <p className="text-sm text-gray-500">Sistem Pengelolaan Pembiayaan Bermasalah</p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="nama@npf.local"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Masukkan password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Memproses...
          </span>
        ) : "Masuk"}
      </button>

      <div className="rounded bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
        <p className="font-semibold text-gray-700">Kredensial Demo:</p>
        <p>
          <span className="font-medium">Staff:</span> staff@npf.local / password123
        </p>
        <p>
          <span className="font-medium">Supervisor:</span> supervisor@npf.local / password123
        </p>
      </div>
    </form>
  );
}
