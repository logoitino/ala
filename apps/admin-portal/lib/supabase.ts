import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * @purpose Browser Supabase client for the Next admin portal stub.
 * @returns Typed client when public URL + anon key are present; otherwise `null`.
 * @sideEffects Reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  return createClient(url, anon);
}
