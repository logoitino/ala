/**
 * `ReelCard` props, the memo comparison that keeps hype taps from re-rendering every mounted card, and the
 * small hype-burst helpers and measured chrome clearances the card shares with its styles. The caption
 * source participates in memo comparison because display formatting can hide changes to the raw value
 * (split out of ReelCard.tsx for R4-03; behaviour unchanged — the memo wrapper itself stays in ReelCard.tsx).
 */

import type { PlayReactionId, Player } from '@/data/players';
import type { HighlightClip } from '@/data/highlights';
import type { UsageSurface } from '@/hooks/useSurfaceUsage';
import type { ReelHype } from '@/lib/reels';

export type ReelCardProps = {
  clip: HighlightClip;
  player: Player | null;
  active: boolean;
  height: number;
  /** Measured feed header clearance; oversized text stays scrollable below its scoreboard. */
  overlayInsetTop?: number;
  /** Floating dock clearance applies only to chrome; media retains the full measured page. */
  overlayInsetBottom?: number;
  tipping: boolean;
  sekiPlay?: boolean;
  /** When true, play if `active` even if the host route is not focused (profile / athlete modal). */
  playbackActive?: boolean;
  /** Only the first video after Welcome carries the welcome art until playback starts. */
  welcomePoster?: boolean;
  onTip: () => void;
  /** True after this fan has already dropped a Mālo on this clip. */
  userTipped?: boolean;
  onOpenProfile?: () => void;
  onReelHypeChange?: (reelId: string, hype: ReelHype) => void;
  /** After Report / Hide, parent drops this clip from the paging feed. */
  onHide?: (reelId: string) => void;
  /** FEED-01 "Why this clip" line for signed-in Home. Guests omit. */
  whyThisClip?: string | null;
  /** Tab that owns this card so usage reports know which surface liked / failed the control. */
  surface?: UsageSurface;
};

export type HypePop = {
  id: number;
  x: number;
  y: number;
  kind: PlayReactionId;
  boosted?: boolean;
};

/** Burst container size in points. Offsets are derived as half of this so it centres on the tap. */
export function popSize(burst: HypePop): number {
  return burst.boosted ? 224 : 176;
}

/** Reads the counter for one hype kind so the optimistic/server comparisons stay readable. */
export function countFor(hype: ReelHype, kind: PlayReactionId): number {
  return kind === 'seki' ? hype.seki_count : kind === 'aura' ? hype.aura_count : hype.flex_count;
}

export const LIVE_BANNER_RESERVE = 108;
/** Default for standalone/modal reels; Home passes its measured floating-dock clearance. */
export const OVERLAY_BOTTOM_INSET = 8;

/**
 * Tapping a hype chip bubbles the new count to the feed, which rebuilds every `clip` object
 * and re-renders every mounted card — video chrome, blur layers, Skia glow and the action
 * rail included. That cascade, not the counter itself, is what made the chips feel janky.
 *
 * Function props are compared by identity. The exported `ReelCard` wrapper hands the memoized
 * card stable stand-ins that call the latest parent callback, so fresh parent closures do not
 * defeat the memo — and a skipped render can never leave a stale closure behind (the parents'
 * `onTip` goes through `requireAuth`, which captures auth `loading` / `session`).
 */
export function sameReelCardProps(prev: ReelCardProps, next: ReelCardProps): boolean {
  if (
    prev.active !== next.active ||
    prev.height !== next.height ||
    prev.overlayInsetTop !== next.overlayInsetTop ||
    prev.overlayInsetBottom !== next.overlayInsetBottom ||
    prev.tipping !== next.tipping ||
    prev.playbackActive !== next.playbackActive ||
    prev.welcomePoster !== next.welcomePoster ||
    prev.userTipped !== next.userTipped ||
    prev.surface !== next.surface ||
    prev.sekiPlay !== next.sekiPlay ||
    prev.onTip !== next.onTip ||
    prev.onOpenProfile !== next.onOpenProfile ||
    prev.onReelHypeChange !== next.onReelHypeChange ||
    prev.onHide !== next.onHide ||
    prev.whyThisClip !== next.whyThisClip
  ) {
    return false;
  }

  const a = prev.clip;
  const b = next.clip;
  if (
    a.id !== b.id ||
    a.videoUrl !== b.videoUrl ||
    a.athleteName !== b.athleteName ||
    a.school !== b.school ||
    a.tag !== b.tag ||
    a.editCaptionSource !== b.editCaptionSource ||
    a.sekiCount !== b.sekiCount ||
    a.auraCount !== b.auraCount ||
    a.flexCount !== b.flexCount ||
    a.totalTipsCents !== b.totalTipsCents ||
    a.isVaultOnly !== b.isVaultOnly ||
    a.flashUnlockUntil !== b.flashUnlockUntil ||
    a.category !== b.category ||
    a.tagStatus !== b.tagStatus ||
    a.playerId !== b.playerId ||
    a.gameId !== b.gameId ||
    a.sekiPlay !== b.sekiPlay ||
    a.filmedBy !== b.filmedBy ||
    a.uploadedBy !== b.uploadedBy ||
    a.mediaType !== b.mediaType ||
    a.photoCount !== b.photoCount ||
    a.coverUrl !== b.coverUrl
  ) {
    return false;
  }

  const p = prev.player;
  const q = next.player;
  if (p === q) return true;
  if (!p || !q) return false;
  return (
    p.id === q.id &&
    p.name === q.name &&
    p.vault_locked === q.vault_locked &&
    p.aura_count === q.aura_count &&
    p.seki_count === q.seki_count &&
    p.flex_count === q.flex_count &&
    p.view_count === q.view_count &&
    p.backer_count === q.backer_count
  );
}
