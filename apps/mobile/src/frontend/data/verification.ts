export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export const VERIFY_SHEET_TITLE = 'Verify Your Athlete Status ⚡';
export const VERIFY_SHEET_KICKER = 'Varsity badge';
export const VERIFY_INPUT_LABEL = 'Team Code';
export const VERIFY_INPUT_PLACEHOLDER = 'WSTLK-RUG-2026';
export const VERIFY_SUBMIT_LABEL = 'Submit Code & Claim Badge';
export const VERIFY_REQUEST_LINK = "Don't have a code? Request approval from your coach or parent.";
export const CLAIM_VERIFY_CTA = 'Claim School Verification ⚡';
export const VARSITY_VERIFIED_LABEL = '⚡ VERIFIED VARSITY';
export const VARSITY_PENDING_LABEL = '⏳ VARSITY PENDING';
export const SCHOOL_CLAIMED_LABEL = 'SCHOOL CLAIMED';
export const NOT_VERIFIED_LABEL = 'Not verified yet';
export const VERIFY_UNLOCK_COPY = 'Player of the Week and Spotlight eligibility unlocked.';
export const VERIFY_WAIT_COPY =
  'Your name stays public while you wait. Varsity is the glow — team code or a coach/parent thumbs-up.';

/** Sport tokens used in `WSTLK-RUG-2026` style codes. */
export const TEAM_CODE_SPORTS: Record<string, string> = {
  FB: 'Football',
  FOOT: 'Football',
  BKB: 'Basketball',
  BK: 'Basketball',
  BBALL: 'Basketball',
  RUG: 'Rugby',
  VB: 'Volleyball',
  VBALL: 'Volleyball',
  SOC: 'Soccer',
  BB: 'Baseball',
  SB: 'Softball',
  WR: 'Wrestling',
  TF: 'Track & Field',
  LAX: 'Lacrosse',
  HK: 'Ice Hockey',
  TEN: 'Tennis',
};

// 2026-09 audit (Round 13 sweep, critical): removed `DEMO_TEAM_CODES` — it hardcoded every real
// school's `redeem_team_code` secret here, in a file bundled into the shipped app itself. Unlike
// the git-history exposure fixed alongside this, that meant the codes were extractable from ANY
// installed copy of the app (unpacking the JS bundle), independent of repo access entirely. It was
// also used as a fallback that could grant real `profiles.is_verified = true` — see
// `lib/verification.ts`'s `redeemTeamCode` for the full explanation. The RPC is the only path now.

export type ParsedTeamCode = {
  normalized: string;
  schoolKey: string;
  sport: string | null;
};

/**
 * @purpose Parse coach-issued codes (`WSTLK-2026` or `WSTLK-RUG-2026`) into a school key + optional sport.
 * @param raw Athlete-typed team code.
 */
export function parseTeamCode(raw: string): ParsedTeamCode {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
  const parts = normalized.split('-').filter(Boolean);
  if (parts.length >= 3) {
    const sportToken = parts[1] ?? '';
    return {
      normalized,
      schoolKey: `${parts[0]}-${parts[parts.length - 1]}`,
      sport: TEAM_CODE_SPORTS[sportToken] ?? null,
    };
  }
  return { normalized, schoolKey: normalized, sport: null };
}

/**
 * @purpose Map `profiles.is_verified` + `verification_status` onto the three badge states viewers see.
 */
export function resolveVerificationStatus(input?: {
  is_verified?: boolean | null;
  verification_status?: string | null;
} | null): VerificationStatus {
  if (!input) return 'unverified';
  if (input.is_verified || input.verification_status === 'verified') return 'verified';
  if (input.verification_status === 'pending') return 'pending';
  return 'unverified';
}
