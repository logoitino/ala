import { createBrowserClient } from '@supabase/ssr';
import {  type SupabaseClient } from '@supabase/supabase-js';

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

export function isAdminPortalConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}
