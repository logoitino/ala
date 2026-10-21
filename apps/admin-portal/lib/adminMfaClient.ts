/**
 * SCALE-01: browser calls for the `/login/mfa` step (Supabase Auth TOTP `listFactors` / `unenroll` / `enroll` /
 * `challenge` / `verify`). Kept in `lib/` so pages and components stay off the vendor client
 * (`scripts/check-app-data-boundaries.mjs`). Every function throws the Supabase Auth error as-is; the form turns
 * it into words with `mfaErrorText`.
 */
import { ADMIN_MFA_ISSUER, unverifiedTotpFactors, verifiedTotpFactors } from '@/lib/adminMfa';
import { getSupabaseBrowserClient } from '@/lib/supabase';

/** What the setup screen shows: the QR image (an SVG data URI) and the same secret as text. */
export type TotpSetup = { factorId: string; qrCode: string; secret: string };

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error('Add NEXT_PUBLIC_SUPABASE_* to apps/admin-portal/.env.local (same project as the Expo app).');
  return supabase;
}

/**
 * @purpose Start a fresh TOTP setup. A half-finished earlier setup (enrolled, never verified) is removed first,
 *   so a reload does not fail on the repeated name.
 * @sideEffects Supabase Auth `GET /user`, `DELETE /factors/<id>` for each unverified TOTP factor, `POST /factors`.
 */
export async function startTotpSetup(): Promise<TotpSetup> {
  const supabase = client();
  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error) throw listed.error;
  for (const factor of unverifiedTotpFactors(listed.data.all)) {
    const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error) throw removed.error;
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: ADMIN_MFA_ISSUER,
    issuer: ADMIN_MFA_ISSUER,
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * @purpose The verified TOTP factor to challenge on a returning sign-in, or `null` when there is none.
 * @sideEffects Supabase Auth `GET /user`.
 */
export async function verifiedTotpFactorId(): Promise<string | null> {
  const { data, error } = await client().auth.mfa.listFactors();
  if (error) throw error;
  return verifiedTotpFactors(data.all)[0]?.id ?? null;
}

/**
 * @purpose Prove the code and raise this browser session to `aal2`. The new session lands in the cookies, so the
 *   middleware and the `(protected)` layout see it on the next request.
 * @sideEffects Supabase Auth `POST /factors/<id>/challenge` and `/verify`; rewrites the session cookies.
 */
export async function verifyTotpCode(factorId: string, code: string): Promise<void> {
  const supabase = client();
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (verified.error) throw verified.error;
}
