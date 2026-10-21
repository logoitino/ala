/**
 * SCALE-01: Expo `/admin` two-step sign-in (Supabase Auth TOTP). The rule is shared with the Next portal
 * (`@tapuai/shared-types/admin/adminMfa`); this file adds the Expo switch and the Supabase Auth calls so
 * `components/Admin/AdminMfaGate.tsx` stays off the vendor client.
 *
 * Switch: `EXPO_PUBLIC_ADMIN_REQUIRE_MFA` in `apps/mobile/.env.local` (or the EAS profile). Missing or anything
 * but `true` / `1` / `on` / `yes` means OFF, and with it off `AdminShell` makes no MFA call.
 * This gate is the desk UI only. Database reads and writes are still decided by RLS on the JWT.
 */
import {
  ADMIN_MFA_ISSUER,
  adminMfaRequired,
  adminMfaStep,
  readAalClaim,
  unverifiedTotpFactors,
  verifiedTotpFactors,
  type AdminMfaStep,
} from '@tapuai/shared-types/admin/adminMfa';

import { supabase } from '@/lib/supabase';

export { mfaErrorText, normalizeTotpCode } from '@tapuai/shared-types/admin/adminMfa';

/** @purpose Whether this build makes Expo `/admin` refuse a session that is not `aal2`. */
export function isAdminMfaRequiredOnApp(): boolean {
  return adminMfaRequired(process.env.EXPO_PUBLIC_ADMIN_REQUIRE_MFA);
}

/** What the gate needs: the step, and the verified factor to challenge when there is one. */
export type AdminMfaState = { step: AdminMfaStep; factorId: string | null };

/**
 * @purpose The step for the signed-in session. No access token (for example Studio unlock without an account)
 *   is refused like `aal1`; the factor list comes from Supabase Auth, not the cached session.
 * @sideEffects Supabase Auth `GET /user` (`mfa.listFactors`).
 */
export async function readAdminMfaState(accessToken: string | null | undefined): Promise<AdminMfaState> {
  if (!isAdminMfaRequiredOnApp()) return { step: 'off', factorId: null };
  const currentLevel = readAalClaim(accessToken);
  if (!accessToken) return { step: 'enroll', factorId: null };
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const factorId = verifiedTotpFactors(data.all)[0]?.id ?? null;
  return { step: adminMfaStep({ required: true, currentLevel, factors: data.all }), factorId };
}

/** The setup screen's QR (SVG markup, no data-URI prefix) and the same secret as text. */
export type AdminTotpSetup = { factorId: string; qrSvg: string; secret: string };

/**
 * @purpose Start a fresh TOTP setup, removing a half-finished earlier one first.
 * @sideEffects Supabase Auth `GET /user`, `DELETE /factors/<id>` per unverified TOTP factor, `POST /factors`.
 */
export async function startAdminTotpSetup(): Promise<AdminTotpSetup> {
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
  const qrSvg = data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, '');
  return { factorId: data.id, qrSvg, secret: data.totp.secret };
}

/**
 * @purpose Prove the code; the client stores the new `aal2` session and `AuthContext` receives it through
 *   `onAuthStateChange`.
 * @sideEffects Supabase Auth `POST /factors/<id>/challenge` and `/verify`.
 */
export async function verifyAdminTotpCode(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw challenge.error;
  const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (verified.error) throw verified.error;
}
