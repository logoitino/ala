import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { resolveBackendConnection } from '@tapuai/shared-types/backendConnection';

import { readAdminMfaStep, type AdminMfaStep } from '@/lib/adminMfa';
import { getSupabaseServerClient } from '@/lib/supabase.server';
import { portalSessionFrame } from '@/lib/portalSessionFrame';

export type PortalSession = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  /**
   * SCALE-01 second step for an admin: `off` while `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` is off (no extra call),
   * `pass` for an `aal2` session, else `enroll` / `verify`. Always `off` for a non-admin, who sees Access
   * Restricted instead.
   */
  mfaStep: AdminMfaStep;
  /** Private ephemeral UI correlation; conveys no server entitlement and contains no credential/raw session claim. */
  frameId: string | null;
  verificationId: string;
};

function parseRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string');
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string');
      } catch {
        // fall through to comma split
      }
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

/**
 * @purpose `profiles.is_admin` gate for the Next admin portal — same signal Expo `/admin` reads via
 *   `isAdminAccess` (`apps/mobile/src/frontend/lib/roles.ts`), so a fan account is never treated as staff here
 *   just because it is signed in.
 * @returns `null` when there is no signed-in Supabase Auth session (caller should redirect to `/login`);
 *   otherwise the session plus whether that profile is an admin (caller should render Access Restricted when
 *   `isAdmin` is `false`).
 * @sideEffects `supabase.auth.getUser()` (re-validates the session with Supabase, not just the local cookie) and
 *   a `profiles` SELECT scoped to `user_id = verified user.id`, pinned to that captured token. With the MFA switch on, an admin's token is re-checked once
 *   more for its `aal` (`readAdminMfaStep`, `fresh`).
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (sessionError || !session || !token) return null;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user || session.user.id !== user.id) return null;

  const frameId = await portalSessionFrame(token, user.id);
  const verificationId = globalThis.crypto.randomUUID();
  // A verified HTTP user still needs consistent JWT session claims before any privileged query/UI correlation.
  if (!frameId) return { userId: user.id, email: user.email ?? null, isAdmin: false, mfaStep: 'off', frameId, verificationId };

  const backend = resolveBackendConnection({ url: process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  if (!backend.connection) return null;
  // Supported accessToken clients pin profile authorization without mutating a shared SDK or persisting Auth.
  const bound = createClient(backend.connection.url, backend.connection.publicKey, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: profile, error: profileError } = await bound
    .from('profiles')
    .select('is_admin, role, roles')
    .eq('user_id', user.id)
    .maybeSingle();

  const roles = parseRoles(profile?.roles).map((role) => role.toLowerCase());
  const isAdmin =
    !profileError && (profile?.is_admin === true || profile?.role === 'admin' || roles.includes('admin'));

  const mfaStep = isAdmin ? await readAdminMfaStep(supabase, user, 'fresh', token) : 'off';

  return { userId: user.id, email: user.email ?? null, isAdmin, mfaStep,
    frameId, verificationId };
}
