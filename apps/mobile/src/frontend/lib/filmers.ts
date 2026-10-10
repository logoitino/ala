import { isAuraUuid } from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SpotlightPeriodKind } from '@/types/database';

/**
 * Fans who film a teammate's play and post it (owner, 2026-09-29). Filmers earn credit, a tier,
 * Aura and Props — never a share of the athlete's Mālo. The server awards the Aura
 * (`20260929170000_filmer_rewards.sql`): +10 when the athlete confirms the tag, +10 / +50 / +200 at
 * 100 / 1,000 / 10,000 views, +1 per Props.
 */

export type FilmerStats = {
  clips: number;
  views: number;
  hype: number;
  props: number;
  auraEarned: number;
};

export type FilmerTierId = 'rookie' | 'sideline' | 'pro' | 'legend';

export type FilmerTier = {
  id: FilmerTierId;
  label: string;
  /** Reached with this many confirmed clips… */
  clips: number;
  /** …or this many counted views. */
  views: number;
};

export const FILMER_TIERS: readonly FilmerTier[] = [
  { id: 'rookie', label: 'Rookie Filmer', clips: 1, views: 0 },
  { id: 'sideline', label: 'Sideline Filmer', clips: 5, views: 1_000 },
  { id: 'pro', label: 'Pro Filmer', clips: 25, views: 10_000 },
  { id: 'legend', label: 'Legend Filmer', clips: 100, views: 100_000 },
];

export const FILMER_AURA_RULES = [
  { label: 'Athlete confirms your clip', points: 10 },
  { label: '100 views', points: 10 },
  { label: '1,000 views', points: 50 },
  { label: '10,000 views', points: 200 },
  { label: 'Each Props', points: 1 },
] as const;

function reached(stats: FilmerStats, tier: FilmerTier): boolean {
  return stats.clips >= tier.clips || (tier.views > 0 && stats.views >= tier.views);
}

/**
 * @purpose Highest tier the filmer has reached, or null before their first confirmed clip.
 */
export function filmerTier(stats: FilmerStats | null | undefined): FilmerTier | null {
  if (!stats || stats.clips < 1) return null;
  let best: FilmerTier | null = null;
  for (const tier of FILMER_TIERS) if (reached(stats, tier)) best = tier;
  return best;
}

/**
 * @purpose "3 more clips or 400 more views to Sideline Filmer". Null at the top tier.
 */
export function nextFilmerTierHint(stats: FilmerStats): string | null {
  const next = FILMER_TIERS.find((tier) => !reached(stats, tier));
  if (!next) return null;
  const clips = next.clips - stats.clips;
  const clipText = `${clips} more ${clips === 1 ? 'clip' : 'clips'}`;
  if (next.views <= 0) return `${clipText} to ${next.label}`;
  return `${clipText} or ${(next.views - stats.views).toLocaleString()} more views to ${next.label}`;
}

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function parseFilmerStats(raw: unknown): FilmerStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const count = (key: string) => asCount(row[key]);
  return {
    clips: count('clips'),
    views: count('views'),
    hype: count('hype'),
    props: count('props'),
    auraEarned: count('aura_earned'),
  };
}

/**
 * @purpose Lifetime filmer numbers for a profile (`profiles.id`, the same id as `reels.uploaded_by`).
 * @returns Null when the RPC is missing or fails — callers hide the filmer card.
 */
export async function fetchFilmerStats(profileId: string | null | undefined): Promise<FilmerStats | null> {
  if (!profileId || !isAuraUuid(profileId) || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('filmer_stats', { target_profile_id: profileId });
    if (error) return null;
    return parseFilmerStats(data);
  } catch {
    return null;
  }
}

export type GivePropsResult = { ok: true; total: number } | { ok: false; message: string };

/**
 * @purpose Send "🎥 Props" to whoever filmed a clip. Once per fan per clip; the server gives the
 *   filmer +1 Aura.
 * @returns The clip's Props total, or the server's reason (not confirmed yet, your own clip, daily cap).
 * @sideEffects `give_filmer_props` RPC.
 */
export async function giveFilmerProps(reelId: string): Promise<GivePropsResult> {
  if (!isAuraUuid(reelId) || !isSupabaseConfigured) return { ok: false, message: 'Props open once this clip is live.' };
  try {
    const { data, error } = await supabase.rpc('give_filmer_props', { target_reel_id: reelId });
    if (error) return { ok: false, message: error.message || 'Could not send Props.' };
    return { ok: true, total: asCount(data) };
  } catch {
    return { ok: false, message: 'Could not send Props.' };
  }
}

export type TopFilmerRow = {
  rank: number;
  profileId: string;
  name: string;
  avatarUrl: string | null;
  clips: number;
  views: number;
  hype: number;
  props: number;
  score: number;
};

export function parseTopFilmers(raw: unknown): TopFilmerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row, index) => {
      const profileId = typeof row.profile_id === 'string' ? row.profile_id : '';
      if (!profileId) return null;
      const avatar = typeof row.avatar_url === 'string' ? row.avatar_url.trim() : '';
      return {
        rank: asCount(row.rank) || index + 1,
        profileId,
        name: (typeof row.name === 'string' && row.name.trim()) || 'Filmer',
        avatarUrl: avatar || null,
        clips: asCount(row.clips),
        views: asCount(row.views),
        hype: asCount(row.hype),
        props: asCount(row.props),
        score: asCount(row.score),
      };
    })
    .filter((row): row is TopFilmerRow => row !== null);
}

/**
 * @purpose Spotlight "Top Filmers" board for the window (views + 3 × hype + 5 × Props).
 * @returns Rows, or `[]` when the RPC is missing — the tab then shows its empty copy.
 */
export async function fetchTopFilmers(kind: SpotlightPeriodKind = 'week'): Promise<TopFilmerRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase.rpc('get_top_filmers', { period_kind: kind });
    if (error) return [];
    return parseTopFilmers(data);
  } catch {
    return [];
  }
}
