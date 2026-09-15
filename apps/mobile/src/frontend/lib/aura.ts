import type { Player } from '@/types/database';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { FOCAL } from '@/theme/motion';

/** Default light collectible face when a tier wash is not yet resolved. */
export const AURA_CARD_FACE = FOCAL.mistJade;

export type AuraTier = {
  tier: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  min: number;
  title: string;
  color: string;
  glow: string;
  /** Light wash behind the 3D card on Daylight. */
  face: string;
  /** Ink that sits on `face`. */
  ink: string;
};

export const AURA_TIERS: AuraTier[] = [
  { tier: 1, min: 0, title: 'Slate Silver', color: '#94A3B8', glow: 'rgba(148,163,184,0.32)', face: FOCAL.mistSlate, ink: '#334155' },
  { tier: 2, min: 8, title: 'Island Cyan', color: FOCAL.islandCyan, glow: 'rgba(0,229,255,0.38)', face: FOCAL.mistCyan, ink: FOCAL.cyanInk },
  { tier: 3, min: 20, title: 'Neon Jade', color: FOCAL.neonJade, glow: 'rgba(0,230,118,0.40)', face: FOCAL.mistJade, ink: FOCAL.jadeInk },
  { tier: 4, min: 40, title: 'Electric Violet', color: '#B388FF', glow: 'rgba(179,136,255,0.40)', face: FOCAL.mistViolet, ink: FOCAL.violetInk },
  { tier: 5, min: 70, title: 'Crimson Ember', color: FOCAL.ember, glow: 'rgba(255,23,68,0.42)', face: FOCAL.mistEmber, ink: FOCAL.emberInk },
  { tier: 6, min: 110, title: 'Polished Gold', color: FOCAL.electricGold, glow: 'rgba(255,215,0,0.42)', face: FOCAL.mistGold, ink: FOCAL.goldInk },
  { tier: 7, min: 170, title: 'Celestial Prism', color: FOCAL.neonJade, glow: 'rgba(0,229,255,0.50)', face: '#EEFFF6', ink: FOCAL.jadeInk },
];

export function resolveAuraPoints(player: Pick<Player, 'aura_points' | 'aura_count' | 'seki_count' | 'flex_count'>): number {
  if (typeof player.aura_points === 'number' && Number.isFinite(player.aura_points)) {
    return Math.max(0, player.aura_points);
  }
  return Math.max(0, (player.aura_count ?? 0) + (player.seki_count ?? 0) + (player.flex_count ?? 0));
}

/**
 * @purpose Resolve which of the seven Aura bands a point total unlocks.
 * @param auraPoints Raw `profiles.aura_points` / `players.aura_points`.
 * @returns The highest tier whose `min` the balance meets (Slate Silver → Celestial Prism).
 */
export function auraTierForPoints(auraPoints: number): AuraTier {
  const points = Math.max(0, auraPoints);
  let current = AURA_TIERS[0];
  for (const tier of AURA_TIERS) {
    if (points >= tier.min) current = tier;
  }
  return current;
}

export function auraBadgeLabel(tier: AuraTier): string {
  return `Tier ${tier.tier} • ${tier.title}`;
}

/**
 * @purpose Fill the Aura progress bar between the current 7-tier band and the next.
 * @param auraPoints Raw point total.
 * @returns Current tier, optional next tier, and a 0–1 ratio within the band.
 */
export function auraProgressTowardNext(auraPoints: number): {
  tier: AuraTier;
  next: AuraTier | null;
  ratio: number;
} {
  const tier = auraTierForPoints(auraPoints);
  const next = AURA_TIERS.find((item) => item.tier === tier.tier + 1) ?? null;
  if (!next) return { tier, next: null, ratio: 1 };
  const span = Math.max(1, next.min - tier.min);
  const ratio = Math.min(1, Math.max(0, (Math.max(0, auraPoints) - tier.min) / span));
  return { tier, next, ratio };
}

export type AuraBooster = {
  id: string;
  username: string;
  full_name: string;
  aura_points: number;
  current_tier: AuraTier;
};

export function handleFromName(fullName: string): string {
  const slug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'booster';
}

export function boosterFromProfile(row: {
  id?: string | null;
  full_name?: string | null;
  username?: string | null;
  aura_points?: number | null;
  current_tier?: number | null;
}): AuraBooster | null {
  if (!row.id) return null;
  const aura_points = Math.max(0, Number(row.aura_points) || 0);
  const fromColumn = AURA_TIERS.find((tier) => tier.tier === Number(row.current_tier));
  return {
    id: row.id,
    full_name: row.full_name?.trim() || 'Fan',
    username: (row.username ?? '').replace(/^@/, '').trim() || handleFromName(row.full_name ?? ''),
    aura_points,
    current_tier: fromColumn ?? auraTierForPoints(aura_points),
  };
}

export function isAuraUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type AuraAward = {
  aura_points: number;
  player_aura_points: number | null;
  profile_aura_points: number | null;
  points_added: number;
};

type AuraListener = (playerId: string, auraPoints: number) => void;
type ProfileAuraListener = (userId: string, auraPoints: number) => void;

const playerListeners = new Set<AuraListener>();
const profileListeners = new Set<ProfileAuraListener>();

export function emitPlayerAura(playerId: string, auraPoints: number) {
  playerListeners.forEach((listener) => listener(playerId, auraPoints));
}

export function subscribePlayerAura(listener: AuraListener) {
  playerListeners.add(listener);
  return () => {
    playerListeners.delete(listener);
  };
}

export function emitProfileAura(userId: string, auraPoints: number) {
  profileListeners.forEach((listener) => listener(userId, auraPoints));
}

export function subscribeProfileAura(listener: ProfileAuraListener) {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

function parseAuraAward(data: unknown, fallback: AuraAward): AuraAward {
  if (!data || typeof data !== 'object') return fallback;
  const row = data as Record<string, unknown>;
  const added = Number(row.points_added);
  const total = Number(row.aura_points);
  const playerTotal = Number(row.player_aura_points);
  const profileTotal = Number(row.profile_aura_points);
  return {
    points_added: Number.isFinite(added) ? added : fallback.points_added,
    aura_points: Number.isFinite(total) ? total : fallback.aura_points,
    player_aura_points: Number.isFinite(playerTotal) ? playerTotal : fallback.player_aura_points,
    profile_aura_points: Number.isFinite(profileTotal) ? profileTotal : fallback.profile_aura_points,
  };
}

/**
 * @purpose Award Aura via `add_user_aura` to a profile (`user_id` / `id`) and/or player (`id`).
 * @param targetUserId Auth user uuid (Fan Aura) or `players.id` (Athlete Aura).
 * @param pointsToAdd Points to add; negatives clamp to 0.
 * @returns Parsed totals plus `points_added`.
 * @sideEffects `add_user_aura` RPC.
 */
export async function addUserAura(targetUserId: string, pointsToAdd: number): Promise<AuraAward> {
  const points_added = Math.max(0, Math.round(pointsToAdd));
  const fallback: AuraAward = {
    aura_points: points_added,
    player_aura_points: null,
    profile_aura_points: null,
    points_added,
  };

  if (!isSupabaseConfigured || !isAuraUuid(targetUserId) || points_added === 0) {
    return fallback;
  }

  const { data, error } = await supabase.rpc('add_user_aura', {
    target_user_id: targetUserId,
    points_to_add: points_added,
  });

  if (error) return fallback;
  return parseAuraAward(data, fallback);
}
