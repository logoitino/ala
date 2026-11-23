/**
 * SCALE-01: admin two-step sign-in for the Next portal. The rule itself is shared with Expo `/admin`
 * (`@tapuai/shared-types/admin/adminMfa`); this file adds the portal switch and the session read used by
 * `middleware.ts`, `app/(protected)/layout.tsx` and `/login/mfa`.
 *
 * Switch: `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` in `apps/admin-portal/.env.local`. Missing or anything but
 * `true` / `1` / `on` / `yes` means OFF, and with it off no extra Supabase call is made.
 * No `server-only` import: middleware imports this too.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';

import { adminMfaRequired, adminMfaStep, readAalClaim, safeNextPath, type AdminMfaStep } from '@tapuai/shared-types/admin/adminMfa';

export * from '@tapuai/shared-types/admin/adminMfa';

/** Where an admin desk sends a session that still needs its second step. */
export const ADMIN_MFA_PATH = '/login/mfa';

/**
 * @purpose Whether this portal build enforces `aal2`. Next inlines `NEXT_PUBLIC_*` at build / dev start, so a
 *   change needs a dev-server restart.
 */
export function isAdminMfaRequired(): boolean {
  return adminMfaRequired(process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA);
}

/** @purpose `/login/mfa?next=<same-site path>`. */
export function adminMfaHref(next: string | null | undefined): string {
  return `${ADMIN_MFA_PATH}?next=${encodeURIComponent(safeNextPath(next))}`;
}

/**
 * @purpose The MFA step for a user Supabase Auth has already validated in this request.
 * @param validated `fresh` re-checks the access token with Supabase Auth (`mfa.getAuthenticatorAssuranceLevel(jwt)`,
 *   one extra request; the layout and `/login/mfa` use it). `local` only decodes the token `getUser()` just
 *   validated (middleware uses it on every request).
 * @returns `off` without any call when the switch is off.
 * @sideEffects `auth.getSession()` (reads the cookie token); with `fresh`, a Supabase Auth `GET /user`.
 */
export async function readAdminMfaStep(
  supabase: SupabaseClient,
  user: Pick<User, 'factors'>,
  validated: 'fresh' | 'local',
  capturedToken?: string | null,
): Promise<AdminMfaStep> {
  if (!isAdminMfaRequired()) return 'off';
  // The server gate can pin a token already validated for its exact user, instead of borrowing a later session.
  const token = capturedToken !== undefined ? capturedToken : (await supabase.auth.getSession()).data.session?.access_token ?? null;
  if (!token) return adminMfaStep({ required: true, currentLevel: null, factors: user.factors });
  if (validated === 'local') {
    return adminMfaStep({ required: true, currentLevel: readAalClaim(token), factors: user.factors });
  }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(token);
  const level = error ? null : data?.currentLevel;
  const currentLevel = level === 'aal2' ? 'aal2' : level === 'aal1' ? 'aal1' : null;
  return adminMfaStep({ required: true, currentLevel, factors: user.factors });
}
