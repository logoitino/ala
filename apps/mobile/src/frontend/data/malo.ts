import { MALO_ATHLETE_SHARE_BPS, MALO_PLATFORM_CUT_BPS } from '@/data/finance';
import { AURA_PER_DOLLAR, displayValue, type Player } from '@/data/players';
import type { HighlightClip } from '@/data/highlights';

/**
 * Fan-facing money language (owner, 2026-09-29): Tapua'i is a donation app. Say **Donate** /
 * **donation** everywhere a fan gives money — never "Mālo", "tip", "backing", "Chip In" or "fund".
 * "Mālo" (thank you) is only ever used to thank someone. Rules and banned words: `docs/VOICE.md`,
 * enforced by `scripts/check-copy.mjs` (`pnpm copy:check`). Code and tables keep `malo` / `tips`.
 */

/** Button label for giving money. */
export const DONATE_LABEL = 'Donate';

/** One-line mission, shown on first open and on the donate sheet. */
export const DONATION_MISSION =
  "Tapua'i helps families cover their young athlete's sports costs — fees, gear, travel — with donations from their community.";

/** Plain answer to "where does my donation go?" (LEGAL row Q — counsel to confirm wording). */
export function donationWhereItGoes(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `Your donation goes to ${name}'s family account for their sports costs — not to whoever posted the clip, and never for a play or a stat. Donations to individuals are not tax-deductible.`;
}

/** Share of each donation that reaches the family account, and the share Tapua'i keeps (10%). */
export const ATHLETE_SHARE_PERCENT = MALO_ATHLETE_SHARE_BPS / 100;
export const PLATFORM_SHARE_PERCENT = MALO_PLATFORM_CUT_BPS / 100;

/**
 * @purpose The split, said plainly at the top of the donate sheet before any amount is picked.
 */
export function donationSplitLine(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `${ATHLETE_SHARE_PERCENT}% goes to ${name}'s family account. Tapua'i keeps ${PLATFORM_SHARE_PERCENT}% to run the app.`;
}

/**
 * Optional tip to Tapua'i on top of the donation (GoFundMe model, owner 2026-09-29). Defaults to 0%:
 * a pre-selected add-on for the platform is a dark pattern (LEGAL row R). Never taken from the donation.
 */
export const PLATFORM_TIP_PERCENTS = [0, 5, 10, 15] as const;
export type PlatformTipPercent = (typeof PLATFORM_TIP_PERCENTS)[number];

// copy-ok: the optional tip to Tapua'i is the one place "tip" is right (docs/VOICE.md)
export const PLATFORM_TIP_TITLE = "Add a tip for Tapua'i (optional)";
export const PLATFORM_TIP_HINT =
  // copy-ok: tip to Tapua'i, not to the athlete
  "Tips keep the app free for families. They go to Tapua'i, not the athlete, and never come out of your donation.";

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
 * @purpose "On a $10 donation: $9.00 to Kaleo's family, $1.00 to Tapua'i, + $1.00 tip" — the breakdown
 *   line under the chips, recomputed as the donor changes the tip or card-fee box.
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
    feeCents > 0 ? `+ ${money(feeCents)} card fee` : null,
    // copy-ok: tip to Tapua'i
    tipCents > 0 ? `+ ${money(tipCents)} tip to Tapua'i` : null,
  ].filter(Boolean);
  const total = cents + feeCents + tipCents;
  return `On a ${money(cents)} donation: ${money(cents - platformCents)} to ${name}'s family, ${money(platformCents)} to Tapua'i${
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
  return `Your donation goes to ${name}'s family account — not whoever uploaded the clip. You and ${name} each earn ${AURA_PER_DOLLAR} Aura Points per $1.`;
}

export const MALO_PENDING_TAG_TOAST =
  'Confirm the athlete on this clip before donating. Donations go to the athlete in it, not the uploader.';

export const MALO_UNTAGGED_TOAST =
  'Tag the athlete in this clip before donating. Tap the name when a roster row is linked.';
