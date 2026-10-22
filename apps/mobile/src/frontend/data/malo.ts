/** Athlete-gift copy preserves legacy identifiers and the actual split; release wording follows VOICE. */
import { MALO_ATHLETE_SHARE_BPS, MALO_PLATFORM_CUT_BPS } from '@/data/finance';
import { AURA_PER_DOLLAR, displayValue, type Player } from '@/data/players';
import type { HighlightClip } from '@/data/highlights';

/**
 * Personal gifts and optional tips are separate (owner, 2026-10-22). Give names athlete support;
 * Tip Tapua'i names the optional platform contribution, shown only when monetization is enabled.
 * "Mālo" (thank you) is only ever used to thank someone. Rules and banned words: `docs/product/VOICE.md`,
 * enforced by `scripts/check-copy.mjs` (`pnpm copy:check`). Code and tables keep `malo` / `tips`.
 */

/** Button label for giving money. */
export const DONATE_LABEL = 'Give';

/** One-line mission, shown on first open and on the gift sheet. */
export const DONATION_MISSION =
  "Tapua'i helps families cover their young athlete's sports costs — fees, gear, travel — with personal gifts from their community.";

/**
 * Brand message (owner-approved 2026-10-07, BRAND-01). Shown on the welcome overlay, at the top of the
 * gift sheet's Amount step and under an athlete's profile Give button; also in public docs and store
 * copy. Plain text, never a heading. "Elevate" must never promise recruiting, scholarships or exposure,
 * and Give stays the money verb (docs/product/VOICE.md; LEGAL_BRIEFING row W, counsel open).
 */
export const TAGLINE_HEADLINE = 'Give. Elevate. Celebrate.';
export const TAGLINE_LINE = 'Support their journey. Elevate their opportunities. Celebrate their story.';

/** Plain answer to "where does my gift go?" (LEGAL row Q — counsel to confirm wording). */
export function donationWhereItGoes(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `Your gift goes to ${name}'s family account for their sports costs — not to whoever posted the clip, and never for a play or a stat. Gifts to individual athletes are personal gifts and are not tax-deductible.`;
}

/** Share of each gift that reaches the family account, and the share Tapua'i keeps (0%). */
export const ATHLETE_SHARE_PERCENT = MALO_ATHLETE_SHARE_BPS / 100;
export const PLATFORM_SHARE_PERCENT = MALO_PLATFORM_CUT_BPS / 100;

/**
 * @purpose The split, said plainly at the top of the gift sheet before any amount is picked.
 */
export function donationSplitLine(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `${ATHLETE_SHARE_PERCENT}% of your gift is allocated to ${name}'s family account. Tapua'i takes no cut.`;
}

/**
 * Optional tip to Tapua'i on top of the gift (GoFundMe model, owner 2026-09-29). Defaults to 0%:
 * a pre-selected add-on for the platform is a dark pattern (LEGAL row R). Never taken from the gift.
 */
export const PLATFORM_TIP_PERCENTS = [0, 5, 10, 15] as const;
export type PlatformTipPercent = (typeof PLATFORM_TIP_PERCENTS)[number];

// copy-ok: the optional tip to Tapua'i is the one place "tip" is right (docs/product/VOICE.md)
export const PLATFORM_TIP_TITLE = "Tip Tapua'i (optional)";
export const PLATFORM_TIP_HINT =
  // copy-ok: tip to Tapua'i, not to the athlete
  "100% of your gift goes to the athlete's family. Tips go to Tapua'i and keep the platform free for families.";

/** Cents for a percent tip on a donation of `donationDollars`. */
export function platformTipCentsFor(donationDollars: number, percent: number): number {
  if (!Number.isFinite(donationDollars) || donationDollars <= 0 || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round(donationDollars * percent);
}

/** Chip label: "No tip", "10%". */
export function platformTipChipLabel(percent: number): string {
  // copy-ok: tip to Tapua'i
  return percent > 0 ? `${percent}%` : 'No tip';
}

/**
 * @purpose "On a $10 gift: $10.00 to Kaleo's family, + $1.00 tip to Tapua'i" — the breakdown
 *   line under the chips, recomputed as the giver changes the tip or processing-coverage box.
 */
export function donationBreakdownLine(args: {
  athleteName?: string | null;
  donationDollars: number;
  feeDollars: number;
  tipPercent: number;
}): string {
  const name = displayValue(args.athleteName, 'this athlete');
  const cents = Math.round(args.donationDollars * 100);
  const platformCents = Math.round((cents * MALO_PLATFORM_CUT_BPS) / 10000);
  const tipCents = platformTipCentsFor(args.donationDollars, args.tipPercent);
  const feeCents = Math.round(Math.max(0, args.feeDollars) * 100);
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const extras = [
    feeCents > 0 ? `+ ${money(feeCents)} toward estimated Stripe processing` : null,
    // copy-ok: tip to Tapua'i
    tipCents > 0 ? `+ ${money(tipCents)} tip to Tapua'i` : null,
  ].filter(Boolean);
  const total = cents + feeCents + tipCents;
  return `On a ${money(cents)} gift: ${money(cents - platformCents)} allocated to ${name}'s family${
    extras.length ? ` ${extras.join(' ')}` : ''
  }. You pay ${money(total)}.`;
}

/**
 * @purpose True when Highlights Mālo may open PaymentSheet — gift is for the athlete in the play, not the uploader.
 * Pending / rejected tags and untagged clips stay discovery-only until the athlete is confirmed.
 */
export function canDropMaloOnHighlight(
  clip: Pick<HighlightClip, 'playerId' | 'tagStatus' | 'athleteName'>,
  player: Player | null | undefined,
): boolean {
  if (!player?.id) return false;
  const taggedId = (clip.playerId ?? player.id).trim();
  if (!taggedId) return false;
  const status = clip.tagStatus ?? 'confirmed';
  if (status === 'pending' || status === 'rejected') return false;
  return true;
}

/**
 * @purpose Fan-facing Mālo CTA naming the athlete who receives the gift.
 */
export function maloAthleteCta(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `${DONATE_LABEL} to ${name}`;
}

/**
 * @purpose Tip sheet / rail copy: money goes to the performer, not Shot by.
 */
export function maloAthleteSheetSubtitle(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `Your gift goes to ${name}'s family account — not whoever uploaded the clip. You and ${name} each earn ${AURA_PER_DOLLAR} Aura Points per $1.`;
}

export const MALO_PENDING_TAG_TOAST =
  'This tag is waiting for the athlete to approve it. Gifts open once they do, and go to the athlete in the clip, not the uploader.';

export const MALO_UNTAGGED_TOAST =
  'Tag the athlete in this clip before giving. Tap the name when a roster row is linked.';
