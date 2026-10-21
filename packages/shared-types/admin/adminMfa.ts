/**
 * SCALE-01: the admin two-step sign-in rule shared by the Next admin portal and Expo `/admin`.
 * Supabase Auth TOTP: a session that finished the second step carries `aal: "aal2"` in its access
 * token. When the switch is on, an admin desk opens only for `aal2`; otherwise the admin is sent to
 * set up an authenticator app (no verified factor yet) or to enter a code (factor already set up).
 * The switch defaults OFF (`NEXT_PUBLIC_ADMIN_REQUIRE_MFA` / `EXPO_PUBLIC_ADMIN_REQUIRE_MFA`), so
 * nobody is locked out before MFA is enabled on the hosted project.
 * Pure functions, no client, so `node --test` and Jest can check them.
 */

export type AssuranceLevel = 'aal1' | 'aal2';

/** What an admin desk does with this session: `off` (switch off), `pass`, `verify` or `enroll`. */
export type AdminMfaStep = 'off' | 'pass' | 'verify' | 'enroll';

/** The fields this rule reads from a Supabase Auth factor (`user.factors`). */
export type MfaFactorLike = {
  id: string;
  factor_type?: string | null;
  status?: string | null;
  friendly_name?: string | null;
};

const ON_VALUES = new Set(['1', 'true', 'on', 'yes']);

/**
 * @purpose Read the enforcement switch. Only an explicit `true` / `1` / `on` / `yes` turns it on;
 *   missing, empty or anything else stays off.
 */
export function adminMfaRequired(raw: string | null | undefined): boolean {
  return typeof raw === 'string' && ON_VALUES.has(raw.trim().toLowerCase());
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Url(segment: string): string | null {
  const clean = segment.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  let out = '';
  for (const char of clean) {
    const index = BASE64.indexOf(char);
    if (index < 0) return null;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((value >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * @purpose The `aal` claim of an access token, or `null` when the token is missing or unreadable.
 *   This only decodes. The caller must already have had Supabase Auth validate the same token
 *   (`auth.getUser()`), as the portal middleware and layout do.
 */
export function readAalClaim(jwt: string | null | undefined): AssuranceLevel | null {
  if (typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  const json = decodeBase64Url(parts[1]);
  if (json == null) return null;
  try {
    const payload = JSON.parse(json) as { aal?: unknown };
    return payload.aal === 'aal1' || payload.aal === 'aal2' ? payload.aal : null;
  } catch {
    return null;
  }
}

/** @purpose TOTP factors the admin has finished setting up. */
export function verifiedTotpFactors<T extends MfaFactorLike>(factors: readonly T[] | null | undefined): T[] {
  return (factors ?? []).filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified');
}

/** @purpose TOTP factors left half set up (enrolled, never verified); cleared before a fresh setup. */
export function unverifiedTotpFactors<T extends MfaFactorLike>(factors: readonly T[] | null | undefined): T[] {
  return (factors ?? []).filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified');
}

/**
 * @purpose The one decision every admin desk makes. With the switch off nothing changes (`off`).
 *   With it on, only an `aal2` session passes; a missing or `aal1` claim is refused.
 */
export function adminMfaStep(input: {
  required: boolean;
  currentLevel: AssuranceLevel | null;
  factors: readonly MfaFactorLike[] | null | undefined;
}): AdminMfaStep {
  if (!input.required) return 'off';
  if (input.currentLevel === 'aal2') return 'pass';
  return verifiedTotpFactors(input.factors).length > 0 ? 'verify' : 'enroll';
}

/** @purpose A typed 6-digit code with spaces or dashes removed, or `null` when it is not 6 digits. */
export function normalizeTotpCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** @purpose A same-site return path for `?next=`; anything else (another host, `//`, `\`) returns `/`. */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\') || /[\r\n]/.test(raw)) return '/';
  return raw;
}

const MFA_ERROR_TEXT: Record<string, string> = {
  mfa_totp_enroll_not_enabled:
    'Two-step sign-in is not turned on for this Supabase project yet. The owner turns on TOTP under Authentication → Multi-Factor.',
  mfa_totp_verify_not_enabled:
    'Two-step sign-in is not turned on for this Supabase project yet. The owner turns on TOTP under Authentication → Multi-Factor.',
  mfa_verification_failed: 'That code did not match. Enter the newest code from your authenticator app.',
  mfa_verification_rejected: 'That code did not match. Enter the newest code from your authenticator app.',
  mfa_challenge_expired: 'That code took too long. Enter the newest code from your authenticator app.',
  mfa_factor_not_found: 'That authenticator app setup was removed. Sign out, sign in again and set it up again.',
  mfa_factor_name_conflict: 'An earlier setup is still open. Reload this page and start again.',
  too_many_enrolled_mfa_factors: 'This account has too many authenticator setups. Ask the owner to remove one in Supabase.',
  over_request_rate_limit: 'Too many tries. Wait a minute, then try again.',
};

/**
 * @purpose Plain words for a Supabase Auth MFA error. Known codes get a fixed sentence; anything else keeps the
 *   server message, or a general line when there is none.
 */
export function mfaErrorText(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && MFA_ERROR_TEXT[code]) return MFA_ERROR_TEXT[code];
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Two-step sign-in did not finish. Try again.';
}

/** Name and issuer shown in the authenticator app. */
export const ADMIN_MFA_ISSUER = "Tapua'i Admin";
