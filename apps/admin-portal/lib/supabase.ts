import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * @purpose Browser Supabase client for interactive Next admin desks (Features toggles).
 * @returns Typed client when public URL + anon key are present; otherwise `null`.
 * @sideEffects Reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  return createClient(url, anon);
}

/**
 * @purpose Server Supabase client for Soft-Wall oversight SELECTs (same anon key; RLS demo-open).
 * @returns Client or `null` when env is missing.
 * @sideEffects Reads `NEXT_PUBLIC_SUPABASE_*` at request time.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isAdminPortalConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}
