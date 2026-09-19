import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase helpers only — no `next/headers` import here. `getSupabaseServerClient` (the
 * cookie-backed Server Component client) lives in `lib/supabase.server.ts` instead; pulling it into this file
 * would drag `next/headers` into any Client Component (e.g. `SignOutButton`, `LoginForm`) that imports this
 * module for `getSupabaseBrowserClient`, which Next.js's client bundler rejects.
 */

/**
 * @purpose Browser Supabase client for interactive Next admin desks (Features toggles) and the login page.
 * @returns Cookie-backed client when public URL + anon key are present; otherwise `null`.
 * @sideEffects Reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Session lives in cookies
 *   (not localStorage) so Server Components / middleware can read the same signed-in session.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  return createBrowserClient(url, anon);
}

/**
 * @purpose Service-free anon client for contexts with no session (kept for callers that explicitly want the
 *   bare public client, e.g. pre-login env checks). Prefer `getSupabaseServerClient` (`lib/supabase.server.ts`)
 *   for Server Component data loaders.
 */
export function getSupabaseAnonClient(): SupabaseClient | null {
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
