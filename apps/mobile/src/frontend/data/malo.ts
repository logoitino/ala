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
