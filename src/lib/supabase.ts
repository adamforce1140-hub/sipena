import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "bukti";

let _client: SupabaseClient | null = null;

/** Lazy Supabase client — hanya dibuat saat pertama kali dipakai. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables"
    );
  }
  _client = createClient(url, key);
  return _client;
}

/** Proxy yang menunda pembuatan client sampai property diakses. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});
