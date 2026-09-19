import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * @purpose Server Supabase client for Overview / Reports / Money / Soft-Wall / Profile / Features / People
 *   loaders (`lib/reports.ts`, `lib/softWall.ts`, `lib/profile.ts`) and the `profiles.is_admin` check
 *   (`lib/authz.ts`).
 * @returns A client that reads the signed-in admin's session from request cookies (RLS runs as `authenticated`,
 *   not `anon`) when a session exists, and an anonymous client when it does not (e.g. the login page itself is
 *   outside the `(protected)` group and never calls this). `null` when env is missing.
 * @sideEffects Reads `NEXT_PUBLIC_SUPABASE_*`; reads (and best-effort refreshes) the Supabase auth cookies via
 *   `next/headers`. Server Components cannot write cookies — that refresh happens in `middleware.ts` instead, so
 *   a failed `set`/`remove` here is expected and swallowed. `server-only` keeps this out of client bundles.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — middleware.ts already refreshes the session cookie.
        }
      },
    },
  });
}
