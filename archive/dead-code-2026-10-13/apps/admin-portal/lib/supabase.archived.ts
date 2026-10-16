// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/admin-portal/lib/supabase.ts: getSupabaseAnonClient.
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

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

