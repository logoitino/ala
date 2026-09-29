import {
  parseTeamCode,
  resolveVerificationStatus,
  type VerificationStatus,
} from '@/data/verification';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type RedeemTeamCodeResult = {
  ok: boolean;
  verification_status: VerificationStatus;
  school_id?: string | null;
  school_name?: string | null;
  sport?: string | null;
  already?: boolean;
};

function rpcMissing(message: string | undefined): boolean {
  const text = message ?? '';
  return /could not find the function|schema cache|42883|PGRST202/i.test(text);
}

function asStatus(raw: unknown): VerificationStatus {
  return resolveVerificationStatus({
    is_verified: raw === 'verified',
    verification_status: typeof raw === 'string' ? raw : null,
  });
}

function asText(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/**
 * @purpose Redeem a school/team code. Since the verification ladder (2026-09-29) the code only
 *   narrows the school and opens a claim — the account goes to **pending**, and the athletic
 *   director or coach confirms the student in person (`school_confirm_athlete`).
 * @param rawCode e.g. `WSTLK-RUG-2026`.
 * @returns Status (`pending`, or `verified` + `already` for an account that was already verified) + school.
 * @sideEffects `redeem_team_code` RPC only.
 */
export async function redeemTeamCode(rawCode: string): Promise<RedeemTeamCodeResult> {
  const parsed = parseTeamCode(rawCode);
  if (!parsed.normalized) {
    throw new Error('Enter a team code (e.g. WSTLK-RUG-2026).');
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('redeem_team_code', { raw_code: parsed.normalized });
    if (!error && data && typeof data === 'object') {
      const row = data as Record<string, unknown>;
      // 2026-09 audit (Round 31 sweep): a wrong/locked-out code now comes back as a graceful
      // `{ok: false, error}` JSON result (see schema.sql) instead of a thrown Postgres exception —
      // needed so the RPC's own fail-count increment actually persists. Re-throwing here keeps this
      // function's own contract (throws on failure) unchanged for `VerifyAthleteModal.tsx`, which
      // never itself checks `result.ok`.
      if (row.ok === false) {
        throw new Error(friendlyVerifyError(asText(row.error) ?? 'Could not redeem this team code.'));
      }
      return {
        ok: true,
        verification_status: asStatus(row.verification_status ?? 'pending'),
        school_id: asText(row.school_id),
        school_name: asText(row.school_name),
        sport: asText(row.sport) ?? parsed.sport,
        already: row.already === true,
      };
    }
    // 2026-09 audit (Round 13 sweep, critical): this used to fall back — on ANY rpc failure,
    // including the RPC simply being missing from a stale schema cache — to a direct
    // `schools_and_teams` query filtering by `team_code` (only possible because that column was
    // publicly readable; fixed by column-restricting the grant, see schema.sql), and beyond that to
    // `DEMO_TEAM_CODES` — a map of every real school's code hardcoded in `data/verification.ts`,
    // which ships inside the app bundle to every device and is trivially extractable by unpacking
    // it, independent of git access entirely. Both fallbacks could grant real
    // `is_verified = true` on `profiles` using a secret that was never actually secret. The RPC
    // (rate-limited as of Round 12) is now the only path — a schema-cache lag or RPC outage should
    // surface as an error here, not silently degrade to an unprotected bypass.
    throw new Error(friendlyVerifyError(error?.message ?? 'Could not redeem this team code.'));
  }

  throw new Error('Supabase is not configured.');
}

/**
 * @purpose Claim athlete status without a team code. The account shows "pending" until the school
 *   confirms it. Profile stays public.
 * @param notes Optional message for the admin People queue.
 * @sideEffects `request_athlete_verification` RPC only. The old direct `profiles` / `verification_requests`
 *   write fallback is gone — the `guard_profiles_verification` trigger blocks client writes to the
 *   verification columns, and a missing RPC must surface as an error.
 */
export async function requestAthleteVerification(notes?: string): Promise<RedeemTeamCodeResult> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('request_athlete_verification', {
    request_notes: notes?.trim() || undefined,
  });
  if (error) throw new Error(friendlyVerifyError(error.message));
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (row.ok === false) {
    throw new Error(friendlyVerifyError(asText(row.error) ?? 'Could not send the request.'));
  }
  return {
    ok: true,
    verification_status: asStatus(row.verification_status ?? 'pending'),
    school_id: asText(row.school_id),
    already: row.already === true,
  };
}

/**
 * @purpose Open (or update) this account's athlete claim, optionally pointing at a roster row.
 *   The link to `players` is only made when the school confirms.
 * @param playerId `players.id` the athlete picked, or null.
 * @returns false when the RPC is not deployed yet (onboarding must not fail on a stale schema).
 * @sideEffects `claim_athlete` RPC.
 */
export async function claimAthlete(playerId: string | null, notes?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.rpc('claim_athlete', {
    target_player_id: playerId,
    request_notes: notes?.trim() || null,
  });
  if (error) {
    if (rpcMissing(error.message)) return false;
    throw new Error(friendlyVerifyError(error.message));
  }
  return true;
}

export type MyVerification = {
  status: VerificationStatus;
  /** `verification_requests.status` of the latest claim: pending / approved / rejected / disputed / revoked. */
  requestStatus: string | null;
  schoolName: string | null;
  hasSchool: boolean;
  sport: string | null;
  codeExpiresAt: string | null;
  confirmerName: string | null;
  decisionNote: string | null;
};

/**
 * @purpose Parse `get_my_verification` JSON into `MyVerification`; null for an empty/invalid payload.
 */
export function parseMyVerification(raw: unknown): MyVerification | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  return {
    status: asStatus(row.verification_status ?? 'unverified'),
    requestStatus: asText(row.request_status),
    schoolName: asText(row.school_name),
    hasSchool: row.has_school === true,
    sport: asText(row.sport),
    codeExpiresAt: asText(row.code_expires_at),
    confirmerName: asText(row.confirmer_name),
    decisionNote: asText(row.decision_note),
  };
}

/**
 * @purpose Load the signed-in account's own verification state (badge, school, whether a school code is live).
 * @returns null when signed out, offline, or the RPC is not deployed yet.
 * @sideEffects `get_my_verification` RPC.
 */
export async function fetchMyVerification(): Promise<MyVerification | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('get_my_verification');
  if (error) {
    if (rpcMissing(error.message)) return null;
    throw new Error(error.message);
  }
  return parseMyVerification(data);
}

export type SchoolCheckCode = { code: string; expiresAt: string };

/**
 * @purpose Mint the 6-digit code the student reads to their athletic director or coach in person.
 *   Valid 30 minutes; a new code replaces the old one.
 * @sideEffects `start_school_check` RPC (stores only a hash of the code).
 */
export async function startSchoolCheck(): Promise<SchoolCheckCode> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('start_school_check');
  if (error) throw new Error(error.message);
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const code = asText(row.code);
  const expiresAt = asText(row.expires_at);
  if (row.ok === false || !code || !expiresAt) {
    throw new Error(asText(row.error) ?? 'Could not make a school code. Try again.');
  }
  return { code, expiresAt };
}

/**
 * @purpose Whether the athlete's school has confirmed them (the public badge). For "is money held?"
 *   use `fetchPayoutAllowed` in `lib/payoutGate.ts` — since 2026-09-29 the two can differ.
 * @returns true only when a school-confirmed account is linked to the `players` row. Unknown → false.
 * @sideEffects `athlete_is_varsity_verified` RPC.
 */
export async function fetchPlayerVerified(playerId: string | null | undefined): Promise<boolean> {
  if (!playerId || !isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc('athlete_is_varsity_verified', { target_player_id: playerId });
  if (error) return false;
  return data === true;
}

/**
 * @purpose Load the claimed-profile Varsity state for a public athlete sheet (`players.id`).
 * @sideEffects `profiles` SELECT by `player_id`, then a name match. Only a `player_id` link — which
 *   only school confirmation creates — can show "verified" or the account's avatar. A name match
 *   shows at most "pending" and the school, so a stranger with the same name cannot borrow the badge.
 */
export async function fetchPlayerVerification(
  playerId: string,
  playerName?: string | null,
): Promise<{
  status: VerificationStatus;
  schoolClaimed: boolean;
  schoolId: string | null;
  avatarUrl: string | null;
}> {
  const empty = { status: 'unverified' as const, schoolClaimed: false, schoolId: null, avatarUrl: null };
  if (!playerId || !isSupabaseConfigured) return empty;
  const columns = 'is_verified, verification_status, school_id, player_id, full_name, avatar_url';
  const { data: byPlayer } = await supabase.from('profiles').select(columns).eq('player_id', playerId).maybeSingle();
  if (byPlayer) {
    return {
      status: resolveVerificationStatus(byPlayer),
      schoolClaimed: Boolean(byPlayer.school_id),
      schoolId: typeof byPlayer.school_id === 'string' ? byPlayer.school_id : null,
      avatarUrl:
        typeof byPlayer.avatar_url === 'string' && byPlayer.avatar_url.trim() ? byPlayer.avatar_url.trim() : null,
    };
  }
  if (!playerName?.trim()) return empty;
  const { data: byName } = await supabase
    .from('profiles')
    .select(columns)
    .ilike('full_name', playerName.trim())
    .limit(1)
    .maybeSingle();
  if (!byName) return empty;
  const claimed = resolveVerificationStatus(byName);
  return {
    status: claimed === 'unverified' ? 'unverified' : 'pending',
    schoolClaimed: Boolean(byName.school_id),
    schoolId: typeof byName.school_id === 'string' ? byName.school_id : null,
    avatarUrl: null,
  };
}

function friendlyVerifyError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('legal')) return 'Agree to Terms of Service & NIL Compliance first.';
  if (text.includes('unknown team code')) {
    return 'Unknown team code. Ask your coach for this season’s code, or request approval below.';
  }
  if (text.includes('sign in')) return 'Sign in to claim your Varsity badge.';
  if (text.includes('team code required')) return 'Enter a team code (e.g. WSTLK-RUG-2026).';
  return message;
}
