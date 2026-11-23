import { createBrowserClient, parseCookieHeader, serializeCookieHeader, stringFromBase64URL } from '@supabase/ssr';
import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import { resolveBackendConnection } from '@tapuai/shared-types/backendConnection';
import { createAuthPublicationScope } from '@tapuai/shared-types/admin/authPublication';

export const authPublication = createAuthPublicationScope();

/** Existing SDK session shape for in-memory browser guards; importing the type keeps vendor boundaries in lib. */
export type PortalBrowserSession = Session;

/**
 * Browser-safe Supabase helpers only — no `next/headers` import here. `getSupabaseServerClient` (the
 * cookie-backed Server Component client) lives in `lib/supabase.server.ts` instead; pulling it into this file
 * would drag `next/headers` into any Client Component (e.g. `SignOutButton`, `LoginForm`) that imports this
 * module for `getSupabaseBrowserClient`, which Next.js's client bundler rejects.
 */

/**
 * @purpose Browser Supabase client for interactive Next admin desks (Features toggles) and the login page.
 * @returns Cookie-backed client when the portable public connection is valid; otherwise `null`.
 * @sideEffects Reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Session lives in cookies
 *   (not localStorage) so Server Components / middleware can read the same signed-in session.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const backend = resolveBackendConnection({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!backend.connection) return null;
  return createBrowserClient(backend.connection.url, backend.connection.publicKey, {
    global: { fetch: authPublication.wrapFetch((...args) => globalThis.fetch(...args)) },
    cookies: {
      getAll: () => typeof document === 'undefined' ? [] : parseCookieHeader(document.cookie),
      setAll: (cookies) => {
        // SSR owns encoding/chunking. Guard each complete new session before any synchronous cookie writes.
        const groups = new Map<string, { name: string; value: string }[]>();
        for (const cookie of cookies) {
          if (!cookie.value) continue;
          const key = cookie.name.replace(/\.\d+$/, '');
          const group = groups.get(key) ?? []; group.push(cookie); groups.set(key, group);
        }
        for (const [key, group] of groups) {
          const whole = group.find((cookie) => cookie.name === key)?.value
            ?? group.sort((a, b) => Number(a.name.slice(key.length + 1)) - Number(b.name.slice(key.length + 1))).map((cookie) => cookie.value).join('');
          authPublication.assertValue(whole.startsWith('base64-') ? stringFromBase64URL(whole.slice(7)) : whole);
        }
        if (typeof document === 'undefined') throw new Error('Browser Auth cookies are unavailable.');
        for (const { name, value, options } of cookies) document.cookie = serializeCookieHeader(name, value, options);
      },
    },
  });
}

export function isAdminPortalConfigured(): boolean {
  return resolveBackendConnection({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).status === 'configured';
}
