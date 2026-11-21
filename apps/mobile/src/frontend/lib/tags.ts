/** UX-13 lets pending-tag decisions use the initiating account's client without changing server permissions. */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  PendingPlayerTag,
  SpotlightPeriodKind,
  SpotlightStanding,
  SpotlightStandings,
} from '@/types/database';

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function asPeriod(value: unknown): SpotlightPeriodKind {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('year')) return 'year';
  if (raw.includes('month')) return 'month';
  return 'week';
}

/**
 * @purpose Parse one pending tag row from `get_pending_player_tags`.
 */
export function parsePendingPlayerTag(raw: unknown): PendingPlayerTag | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  const player_id = asText(row.player_id);
  if (!id || !player_id) return null;
  return {
    id,
    title: asText(row.title, 'Untitled clip'),
    video_url: asText(row.video_url) || null,
    player_id,
    player_name: asText(row.player_name, 'Tagged athlete'),
    school_name: asText(row.school_name),
    created_at: asText(row.created_at),
    seki_count: asInt(row.seki_count),
    aura_count: asInt(row.aura_count),
    flex_count: asInt(row.flex_count),
    uploader_name: asText(row.uploader_name) || null,
  };
}

function parseStanding(raw: unknown): SpotlightStanding | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const player_id = asText(row.player_id);
  const name = asText(row.name);
  if (!player_id || !name) return null;
  return {
    rank: asInt(row.rank) || 1,
    player_id,
    name,
    school_name: asText(row.school_name),
    hype: asInt(row.hype),
    seki: asInt(row.seki),
    aura: asInt(row.aura),
    flex: asInt(row.flex),
    reel_id: asText(row.reel_id) || null,
    title: asText(row.title) || null,
    shot_by: asText(row.shot_by) || null,
  };
}

/**
 * @purpose Load fan clips whose player tag still needs That's me / That's our player.
 * @returns Pending rows the signed-in athlete, parent, operator, or admin may confirm.
 * @sideEffects `get_pending_player_tags`.
 */
export async function fetchPendingPlayerTags(): Promise<PendingPlayerTag[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_pending_player_tags');
  if (error || !Array.isArray(data)) return [];
  return data.map(parsePendingPlayerTag).filter((row): row is PendingPlayerTag => Boolean(row));
}

/**
 * @purpose Confirm or reject the tagged athlete on a Highlight ⚡.
 * @param reelId `reels.id`.
 * @param action `confirm` keeps the tag; `reject` drops it from Player of the Week scoring.
 * @sideEffects `confirm_reel_player_tag`; may write `profiles.player_id`; refreshes Spotlight leaders.
 */
export async function confirmReelPlayerTag(reelId: string, action: 'confirm' | 'reject', client = supabase): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await client.rpc('confirm_reel_player_tag', {
    target_reel_id: reelId,
    tag_action: action,
  });
  if (error) throw new Error(error.message);
}

/**
 * @purpose Live Player of the Week / Month / Year race from confirmed Game Day hype.
 * @param periodKind Window to score.
 * @sideEffects `get_spotlight_standings`.
 */
export async function fetchSpotlightStandings(
  periodKind: SpotlightPeriodKind = 'week',
): Promise<SpotlightStandings> {
  const empty: SpotlightStandings = {
    period_kind: periodKind,
    start_date: '',
    end_date: '',
    leaders: [],
  };
  if (!isSupabaseConfigured) return empty;
  const { data, error } = await supabase.rpc('get_spotlight_standings', { period_kind: periodKind });
  if (error || !data || typeof data !== 'object') return empty;
  const row = data as Record<string, unknown>;
  const leadersRaw = Array.isArray(row.leaders) ? row.leaders : [];
  return {
    period_kind: asPeriod(row.period_kind ?? periodKind),
    start_date: asText(row.start_date).slice(0, 10),
    end_date: asText(row.end_date).slice(0, 10),
    leaders: leadersRaw.map(parseStanding).filter((item): item is SpotlightStanding => Boolean(item)),
  };
}

/**
 * @purpose Crown (or refresh) the current window from confirmed hype. Skips locked admin overrides.
 * @sideEffects `sync_spotlight_period`.
 */
export async function syncSpotlightPeriod(periodKind: SpotlightPeriodKind): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('sync_spotlight_period', { period_kind: periodKind });
  if (error) throw new Error(error.message);
}

/**
 * @purpose Unlock an admin override so Seki / Aura / Flex can recrown this window.
 * @sideEffects `unlock_spotlight_period`.
 */
export async function unlockSpotlightPeriod(periodKind: SpotlightPeriodKind): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('unlock_spotlight_period', { period_kind: periodKind });
  if (error) throw new Error(error.message);
}
