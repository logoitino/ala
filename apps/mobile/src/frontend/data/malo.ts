import { AURA_PER_DOLLAR, displayValue, type Player } from '@/data/players';
import type { HighlightClip } from '@/data/highlights';

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
  return `Drop Mālo · ${name}`;
}

/**
 * @purpose Tip sheet / rail copy: money goes to the performer, not Shot by.
 */
export function maloAthleteSheetSubtitle(athleteName?: string | null): string {
  const name = displayValue(athleteName, 'this athlete');
  return `This gift goes to ${name} — the athlete in the play — not whoever uploaded the clip. You and ${name} each earn ${AURA_PER_DOLLAR} Aura Points per $1.`;
}

export const MALO_PENDING_TAG_TOAST =
  'Confirm the athlete on this clip before Mālo. Gifts support the performer, not the uploader.';

export const MALO_UNTAGGED_TOAST =
  'Tag the athlete in this play before Mālo. Tap the name when a roster row is linked.';
