import type { HighlightClip } from '@/data/highlights';

export type ExclusivePost = {
  id: string;
  kind: 'workout' | 'pregame' | 'qna';
  title: string;
  blurb: string;
};

export const EXCLUSIVE_POSTS: ExclusivePost[] = [
  {
    id: 'ex-1',
    kind: 'workout',
    title: 'Film-room footwork',
    blurb: '10-minute ladder, release drills, and pocket reset.',
  },
  {
    id: 'ex-2',
    kind: 'pregame',
    title: 'Pregame walk-up',
    blurb: 'Headphones on, stadium empty, same stretch every Friday.',
  },
  {
    id: 'ex-3',
    kind: 'qna',
    title: 'Fan Q&A: Friday nerves',
    blurb: 'Answering locker-room questions from the hub.',
  },
  {
    id: 'ex-4',
    kind: 'workout',
    title: 'Track start & burst',
    blurb: 'Three reps of 10-yard bursts between series.',
  },
];

export const EXCLUSIVE_KIND_LABEL: Record<ExclusivePost['kind'], string> = {
  workout: 'Workout clip',
  pregame: 'Pregame routine',
  qna: 'Fan Q&A',
};

export const EXCLUSIVE_MONTHLY_DOLLARS = 4.99;
export const EXCLUSIVE_AURA_GRANT = 100;

/**
 * @purpose Subscribe CTA. Catalogs desk can change the dollars after Publish to app.
 */
export function exclusiveSubscribeLabel(dollars = EXCLUSIVE_MONTHLY_DOLLARS): string {
  return `Subscribe for $${dollars.toFixed(2)}/mo — Unlock Exclusive Clips ⚡`;
}

/**
 * @purpose Vault-tab callout. Catalogs desk can change the dollars after Publish to app.
 */
export function exclusiveVaultCallout(dollars = EXCLUSIVE_MONTHLY_DOLLARS): string {
  return `Unlock the Vault for $${dollars.toFixed(2)}/mo to see full game breakdowns and raw practice film.`;
}

/**
 * @purpose Highlights ⚡ unlock chip. Catalogs desk can change the dollars after Publish to app.
 */
export function vaultUnlockLabel(dollars = EXCLUSIVE_MONTHLY_DOLLARS): string {
  return `Unlock Vault ($${dollars.toFixed(2)}/mo)`;
}

/**
 * @purpose PaymentSheet success toast. Catalogs desk can change the Aura grant after Publish to app.
 */
export function exclusiveUnlockToast(aura = EXCLUSIVE_AURA_GRANT): string {
  return `Exclusive clips unlocked ⚡ +${aura} Aura Points earned!`;
}

export const EXCLUSIVE_SUBSCRIBE_LABEL = exclusiveSubscribeLabel();
export const EXCLUSIVE_UNLOCK_TOAST = exclusiveUnlockToast();
export const EXCLUSIVE_REQUEST_TOAST = 'Request sent to athlete! ⚡';
export const EXCLUSIVE_VAULT_CALLOUT = exclusiveVaultCallout();
export const VAULT_BADGE_LABEL = 'Subscriber Vault 🔒';
export const VAULT_UNLOCK_LABEL = vaultUnlockLabel();
export const VAULT_MOVE_TO_VAULT = 'Move to Subscriber Vault 🔒';
export const VAULT_MOVE_TO_PUBLIC = 'Move to Free Public Feed 🌐';
/** Athlete master switch: seal the Vault so fans must subscribe. */
export const VAULT_LOCK_ACTION = 'Lock Vault 🔒';
/** Athlete master switch: open the Vault so anyone can watch those clips. */
export const VAULT_OPEN_ACTION = 'Open Vault 🌐';
export const VAULT_LOCKED_HINT =
  'Vault is locked. Fans must subscribe to watch these Highlights ⚡.';
export const VAULT_OPEN_HINT =
  'Vault is open. Anyone can watch Vault clips. Lock it when you want subscribers only.';

/** Hours a Flash Unlock keeps a Vault clip playable for the Crew. */
export const FLASH_UNLOCK_HOURS = 2;
export const FLASH_UNLOCK_ACTION = '🔓 Flash Unlock (2 Hours)';
export const FLASH_UNLOCK_TOAST = 'Flash Unlock live — Crew notified ⚡';

/**
 * @purpose True while `reels.flash_unlock_until` is still in the future.
 * @param until ISO timestamp from `reels.flash_unlock_until`.
 * @param now Epoch ms (injectable for tests / the countdown tick).
 */
export function isFlashUnlockActive(until?: string | null, now = Date.now()): boolean {
  if (!until) return false;
  const ts = Date.parse(until);
  return Number.isFinite(ts) && ts > now;
}

/**
 * @purpose Remaining Flash Unlock window as `1h 45m` / `45m` / `12s`.
 * @param until ISO timestamp from `reels.flash_unlock_until`.
 * @param now Epoch ms.
 * @returns Null when the window is missing or expired.
 */
export function formatFlashUnlockRemaining(until?: string | null, now = Date.now()): string | null {
  if (!isFlashUnlockActive(until, now)) return null;
  const ms = Math.max(0, Date.parse(until as string) - now);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.max(1, Math.ceil((ms % 60_000) / 1000));
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * @purpose Feed chip copy for an active Flash Unlock.
 */
export function flashUnlockChipLabel(until?: string | null, now = Date.now()): string | null {
  const remaining = formatFlashUnlockRemaining(until, now);
  if (!remaining) return null;
  return `⚡ FLASH UNLOCK • Locks in ${remaining}`;
}

/**
 * @purpose True when a clip is Subscriber Vault only (`reels.is_vault_only`). Defaults to public.
 * @param clip Tagged highlight. Missing flags mean free public access.
 */
export function isClipVaultOnly(clip: Pick<HighlightClip, 'isVaultOnly' | 'exclusive'> | null | undefined): boolean {
  if (!clip) return false;
  if (typeof clip.isVaultOnly === 'boolean') return clip.isVaultOnly;
  return Boolean(clip.exclusive);
}

/**
 * @purpose Normalize vault flags without inventing locks. Fan-first: unmarked clips stay public.
 * @param clips Athlete tagged media.
 * @returns Clips with `exclusive` / `isVaultOnly` aligned to stored vault status.
 */
export function markExclusiveClips(clips: HighlightClip[]): HighlightClip[] {
  return clips.map((clip) => {
    const vaultOnly = isClipVaultOnly(clip);
    return { ...clip, exclusive: vaultOnly, isVaultOnly: vaultOnly };
  });
}
