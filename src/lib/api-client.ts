/**
 * Helper fetch untuk client component: menormalkan error API menjadi bentuk seragam.
 */
export type ApiError = {
  error: string;
  fields?: { path: string; message: string }[];
};

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = data as ApiError;
    const error = new Error(err.error ?? `Terjadi kesalahan (${res.status}).`) as Error & {
      status?: number;
      fields?: { path: string; message: string }[];
    };
    error.status = res.status;
    error.fields = err.fields;
    throw error;
  }

  return data as T;
}
