/**
 * Verification wording and rules: the on-screen labels for the Verify sheet and badges (unverified / pending /
 * verified, held-gift and payout-setup notices), check-mark reservation for school-confirmed names, `parseTeamCode`
 * (coach-issued codes into a school key plus optional sport) and `resolveVerificationStatus`.
 * Money-adjacent notices are LEGAL-owned; change them through docs/legal/LEGAL_BRIEFING.md.
 */

export type VerificationStatus = 'unverified' | 'pending' | 'verified';

export const VERIFY_SHEET_TITLE = 'Verify Your Athlete Status ⚡';
export const VERIFY_SHEET_KICKER = 'Varsity badge';
export const VERIFY_INPUT_LABEL = 'Team Code';
export const VERIFY_INPUT_PLACEHOLDER = 'WSTLK-RUG-2026';
export const VERIFY_SUBMIT_LABEL = 'Submit School Code';
export const VERIFY_REQUEST_LINK = "Don't have a code? Claim your athlete status and your school confirms you.";
export const CLAIM_VERIFY_CTA = 'Claim School Verification ⚡';
export const VARSITY_VERIFIED_LABEL = '⚡ VERIFIED VARSITY';
export const VARSITY_PENDING_LABEL = '⏳ VARSITY PENDING';
export const SCHOOL_CLAIMED_LABEL = 'SCHOOL CLAIMED';
export const NOT_VERIFIED_LABEL = 'Not verified yet';
export const VERIFY_UNLOCK_COPY = 'Player of the Week and Spotlight eligibility unlocked.';
export const VERIFY_WAIT_COPY =
  'Your profile stays public while you wait. Your athletic director or coach confirms you in person — show them your school code from Activity.';
/** Shown to the athlete while pending. Money copy — LEGAL to review (LEGAL_BRIEFING). */
export const VERIFY_HELD_COPY =
  "Fans can already send you gifts. They're held until a parent finishes payout setup (or your school confirms you).";
/** Shown to a fan giving to an athlete who is not verified yet. Money copy — LEGAL to review. */
export const GIFT_HELD_NOTICE =
  "Payouts aren't set up for this athlete yet — your donation is held until their family finishes payout setup.";
/** Athlete on Activity once the identity path unlocks payouts. Money copy — LEGAL to review. */
export function payoutUnlockedCopy(capCents: number | null, vouches: number): string {
  if (capCents == null) return 'Payouts are unlocked.';
  const cap = `$${Math.round(capCents / 100)}`;
  const need = Math.max(0, 3 - vouches);
  return `Payouts are unlocked up to ${cap}. The limit lifts when your school confirms you or ${need} more teammate${need === 1 ? '' : 's'} vouch${need === 1 ? 'es' : ''} for you.`;
}
/** Athlete on Activity when the family still has to pass the Stripe identity check. */
export const PAYOUT_SETUP_COPY =
  'To get paid without waiting on your school, a parent sets up payouts in Parent HQ (Stripe checks their ID — it takes a few minutes).';

/** MINOR-01: an athlete aged 13–17 — payouts need the donations consent of the guardian on record for the family account. */
export const PAYOUT_GUARDIAN_CONSENT_COPY =
  'Payouts wait until your parent or guardian on record for your family account signs the consent. Invite them from Profile → Privacy.';

/** VERIFY-02: the payee has not finished Stripe's identity and tax check (and, for a guardian, the school's parent confirmation). */
export const PAYOUT_PAYEE_VERIFICATION_COPY =
  'Payouts wait until the person being paid finishes Stripe\'s identity check (Stripe asks for their Social Security number; Tapua\'i never sees it). A parent or guardian also needs your school to confirm they are your parent on record.';

/** MINOR-01: no birth month and year on the athlete's account yet. */
export const PAYOUT_BIRTH_MONTH_COPY = 'Add your birth month and year in Profile → Privacy so payouts can be set up.';
/** Check marks are reserved for the school badge; names cannot use them (`profiles_name_no_check_marks`). */
export const RESERVED_BADGE_MARKS = /[✓✔☑✅]/;
export const RESERVED_BADGE_MARKS_ERROR = 'Check marks are reserved for school-confirmed athletes. Remove them from your name.';
/** Toast after a school code is accepted: it narrows the school, it does not verify. */
export const SCHOOL_CODE_ACCEPTED = 'School code accepted — your coach or AD confirms you next';

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
