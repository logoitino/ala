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

/** Demo `schools_and_teams.team_code` → catalog id (Expo Go / offline). */
export const DEMO_TEAM_CODES: Record<string, string> = {
  'WSTLK-2026': 'a1000000-0000-4000-8000-000000000001',
  'LPKHS-2026': 'a1000000-0000-4000-8000-000000000002',
  'ALAHS-2026': 'a1000000-0000-4000-8000-000000000003',
  'SKYRG-2026': 'a1000000-0000-4000-8000-000000000004',
  'AFORK-2026': 'a1000000-0000-4000-8000-000000000005',
  'TIMP-2026': 'a1000000-0000-4000-8000-000000000006',
  'BYU-2026': 'a1000000-0000-4000-8000-000000000011',
  'UTAH-2026': 'a1000000-0000-4000-8000-000000000012',
  'USU-2026': 'a1000000-0000-4000-8000-000000000013',
  'WEBER-2026': 'a1000000-0000-4000-8000-000000000014',
};

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
