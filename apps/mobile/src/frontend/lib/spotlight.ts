import AsyncStorage from '@react-native-async-storage/async-storage';

import { HIGHLIGHT_CLIPS } from '@/data/highlights';
import { isAuraUuid } from '@/lib/aura';
import { resolvePlaybackUrl } from '@/lib/reels';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Player, SpotlightAward, SpotlightPeriodKind } from '@/types/database';

export const SPOTLIGHT_TIP_LABEL = 'Support & Tip Athlete ⚡';
export const SPOTLIGHT_WATCH_LABEL = 'Watch Full Highlight 🎥';
export const SPOTLIGHT_DISMISS_LABEL = 'Dismiss (seen)';
export const SPOTLIGHT_CLOSE_LABEL = 'Close';

const SEEN_PREFIX = 'tapuai.spotlightSeen.';
const DEMO_HEADLINE = '4 Touchdowns & 12 Tackles';
const DEMO_SCHOOL = 'Westlake High';

/**
 * @purpose Monday UTC date that matches Postgres `date_trunc('week', now())`.
 * @param date Clock used for the current week window.
 */
export function utcWeekStart(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc.toISOString().slice(0, 10);
}

/**
 * @purpose First of the month UTC, matching Postgres `date_trunc('month', now())`.
 */
export function utcMonthStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * @purpose January 1 UTC, matching Postgres `date_trunc('year', now())`.
 */
export function utcYearStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}

function seenKey(awardId: string): string {
  return `${SEEN_PREFIX}${awardId}`;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * @purpose `players.id` only. Never invent `spotlight-{award.id}` — that string is not a UUID and `/user/[id]` 400s Postgres.
 */
function asPlayerId(...candidates: unknown[]): string {
  for (const value of candidates) {
    const text = asText(value);
    if (isAuraUuid(text)) return text;
  }
  return '';
}

function asPeriod(value: unknown): SpotlightPeriodKind {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('year')) return 'year';
  if (raw.includes('month')) return 'month';
  return 'week';
}

function periodTitle(kind: SpotlightPeriodKind): string {
  if (kind === 'year') return 'Player of the Year';
  if (kind === 'month') return 'Player of the Month';
  return 'Player of the Week';
}

function parsePlayer(raw: unknown): Player | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  const name = asText(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    jersey_number: Number(row.jersey_number) || 0,
    position: asText(row.position),
    height: asText(row.height),
    school_name: asText(row.school_name),
    backer_count: Number(row.backer_count) || 0,
    view_count: Number(row.view_count) || 0,
    aura_count: Number(row.aura_count) || 0,
    aura_points: Number(row.aura_points) || 0,
    flex_count: Number(row.flex_count) || 0,
    seki_count: Number(row.seki_count) || 0,
    team: typeof row.team === 'string' ? row.team : null,
    vault_locked: typeof row.vault_locked === 'boolean' ? row.vault_locked : undefined,
  };
}

/**
 * @purpose Normalize RPC jsonb / table rows into a Spotlight award.
 */
export function parseSpotlightAward(raw: unknown): SpotlightAward | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asText(row.id);
  const player = parsePlayer(row.player) ?? parsePlayer(row.players);
  // `athlete_id` is `profiles.id`, not `players.id` — do not treat it as a roster key.
  const player_id = asPlayerId(row.player_id, player?.id);
  if (!id) return null;
  const period_kind = asPeriod(row.period_kind ?? row.award_type);
  return {
    id,
    player_id,
    reel_id: asText(row.reel_id) || asText(row.highlight_reel_id) || null,
    period_kind,
    period_start: (asText(row.period_start) || asText(row.start_date)).slice(0, 10),
    school_name: asText(row.school_name) || asText(row.district_region) || player?.school_name || DEMO_SCHOOL,
    headline: asText(row.headline) || DEMO_HEADLINE,
    title: asText(row.title) || periodTitle(period_kind),
    is_active: row.is_active !== false,
    video_url: asText(row.video_url) || null,
    shot_by: asText(row.shot_by) || null,
    player,
  };
}

function demoClip() {
  return HIGHLIGHT_CLIPS.find((clip) => clip.school.toLowerCase().includes('westlake')) ?? HIGHLIGHT_CLIPS[0];
}

/**
 * @purpose Seeded Player of the Week when the RPC has no current row (Expo Go / empty table).
 * @param roster Live `players` so Mālo can target a real athlete when names match.
 */
export function demoSpotlightAward(roster: Player[] = []): SpotlightAward {
  const clip = demoClip();
  const fromRoster =
    roster.find((player) => player.school_name.toLowerCase().includes('westlake')) ??
    roster.find((player) => player.name.toLowerCase() === clip.athleteName.toLowerCase()) ??
    roster[0] ??
    null;
  const period_start = utcWeekStart();
  const player: Player = fromRoster ?? {
    id: 'demo-tyler-nguyen',
    name: clip.athleteName,
    jersey_number: 88,
    position: 'Wide Receiver',
    height: '6\'1"',
    school_name: DEMO_SCHOOL,
    backer_count: 22,
    aura_points: 48,
  };
  return {
    id: `demo-spotlight-week-${period_start}`,
    player_id: player.id,
    reel_id: clip.id,
    period_kind: 'week',
    period_start,
    school_name: DEMO_SCHOOL,
    headline: DEMO_HEADLINE,
    title: 'Player of the Week',
    is_active: true,
    video_url: clip.videoUrl,
    player,
  };
}

/**
 * @purpose Hydrate roster Aura / jersey onto an award player.
 */
export function hydrateSpotlightPlayer(award: SpotlightAward, roster: Player[]): SpotlightAward {
  const live = roster.find((player) => player.id === award.player_id)
    ?? roster.find((player) => player.name.toLowerCase() === (award.player?.name ?? '').toLowerCase());
  if (!live) return award;
  return {
    ...award,
    player_id: live.id,
    player: { ...award.player, ...live },
    school_name: award.school_name || live.school_name,
  };
}

async function fetchSpotlightFromTable(): Promise<SpotlightAward | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('spotlight_awards')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error || !Array.isArray(data)) return null;
  const rows = data.map(parseSpotlightAward).filter((row): row is SpotlightAward => Boolean(row));
  return rows.find((row) => row.period_kind === 'week') ?? rows[0] ?? null;
}

/**
 * @purpose Load this week's (else month's / year's) active Player of the Week/Month/Year for Highlights launch.
 * @param viewerUserId Signed-in `auth.users.id` passed to `get_active_spotlight_award`. Guests send null.
 * @returns Award payload or null when none is active.
 * @sideEffects `get_active_spotlight_award` RPC; `spotlight_awards` SELECT fallback.
 */
export async function fetchActiveSpotlightAward(viewerUserId?: string | null): Promise<SpotlightAward | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.rpc('get_active_spotlight_award', {
    viewer_user_id: viewerUserId ?? undefined,
  });

  if (!error && data != null) {
    let payload: unknown = data;
    if (typeof data === 'string') {
      try {
        payload = JSON.parse(data);
      } catch {
        payload = null;
      }
    }
    const parsed = parseSpotlightAward(payload);
    if (parsed) return parsed;
  }

  return fetchSpotlightFromTable();
}

async function attachReelVideos(awards: SpotlightAward[]): Promise<SpotlightAward[]> {
  const ids = [
    ...new Set(
      awards
        .filter(
          (award) =>
            Boolean(award.reel_id && isAuraUuid(award.reel_id)) &&
            (!award.video_url || !isAuraUuid(award.player_id)),
        )
        .map((award) => award.reel_id as string),
    ),
  ];
  if (ids.length === 0 || !isSupabaseConfigured) return awards;

  // 2026-09 audit (paywall bypass): read from `reels_feed`, not the base table — see lib/reels.ts.
  const { data, error } = await supabase.from('reels_feed').select('id, video_url, player_id').in('id', ids);
  if (error || !Array.isArray(data)) return awards;
  const clips = new Map<string, { video_url: string | null; player_id: string | null }>();
  for (const row of data) {
    if (!row?.id) continue;
    clips.set(row.id, {
      video_url: row.video_url ?? null,
      player_id: row.player_id ?? null,
    });
  }
  return Promise.all(
    awards.map(async (award) => {
      const clip = award.reel_id ? clips.get(award.reel_id) : undefined;
      const player_id = asPlayerId(award.player_id, clip?.player_id);
      const stored = award.video_url || clip?.video_url || null;
      const video_url = stored ? await resolvePlaybackUrl(stored) : null;
      if (player_id === award.player_id && video_url === award.video_url) return award;
      return { ...award, player_id, video_url: video_url || null };
    }),
  );
}

function withDemoVideo(award: SpotlightAward): SpotlightAward {
  if (award.video_url) return award;
  return { ...award, video_url: demoClip().videoUrl };
}

/**
 * @purpose Player of the Week/Month/Year board for the Spotlight tab — includes dismissed launch awards.
 * @param roster Live `players` for Aura / Mālo hydration.
 * @returns Newest awards first; always at least the demo week if the table is empty.
 * @sideEffects `get_active_spotlight_award`; `spotlight_awards` SELECT; `reels` video URLs.
 */
export async function fetchSpotlightBoard(roster: Player[] = []): Promise<SpotlightAward[]> {
  const active = await fetchActiveSpotlightAward();
  let rows: SpotlightAward[] = [];
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('spotlight_awards')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(12);
    if (!error && Array.isArray(data)) {
      rows = data.map(parseSpotlightAward).filter((row): row is SpotlightAward => Boolean(row));
    }
  }

  const merged: SpotlightAward[] = [];
  const seen = new Set<string>();
  for (const award of [active, ...rows]) {
    if (!award || seen.has(award.id)) continue;
    seen.add(award.id);
    merged.push(hydrateSpotlightPlayer(award, roster));
  }

  const withVideo = await attachReelVideos(merged);
  const board = withVideo.map((award) => withDemoVideo(hydrateSpotlightPlayer(award, roster)));
  if (board.length === 0) return [withDemoVideo(hydrateSpotlightPlayer(demoSpotlightAward(roster), roster))];
  return board;
}

/**
 * @purpose Short chip under a board card (`This week` vs Player of the Month).
 */
export function spotlightWindowLabel(award: SpotlightAward): string {
  if (award.period_kind === 'year') return 'Player of the Year';
  if (award.period_kind === 'month') return 'Player of the Month';
  if (award.period_start === utcWeekStart()) return 'This week';
  return award.title;
}

/**
 * @purpose True when this fan has not dismissed the award for the current week/month window.
 * @sideEffects AsyncStorage `tapuai.spotlightSeen.{awardId}`.
 */
export async function isSpotlightUnviewed(awardId: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(seenKey(awardId));
  return !raw;
}

/**
 * @purpose Persist dismiss so the popup does not return until the next award id (new week/month).
 * @sideEffects AsyncStorage `tapuai.spotlightSeen.{awardId}`.
 */
export async function markSpotlightSeen(awardId: string): Promise<void> {
  await AsyncStorage.setItem(seenKey(awardId), new Date().toISOString());
}

/**
 * @purpose Header chip: `🏆 PLAYER OF THE WEEK • WESTLAKE HIGH`.
 */
export function spotlightBadgeLabel(award: SpotlightAward): string {
  const period =
    award.period_kind === 'year'
      ? 'PLAYER OF THE YEAR'
      : award.period_kind === 'month'
        ? 'PLAYER OF THE MONTH'
        : 'PLAYER OF THE WEEK';
  const school = (award.school_name || DEMO_SCHOOL).trim().toUpperCase();
  return `🏆 ${period} • ${school}`;
}

/**
 * @purpose Credit the fan who shot the winning tape when they are not the athlete.
 */
export function spotlightShotByLabel(award: SpotlightAward): string | null {
  const shot = (award.shot_by ?? '').trim();
  if (!shot) return null;
  const athlete = (award.player?.name ?? '').trim();
  if (athlete && shot.toLowerCase() === athlete.toLowerCase()) return null;
  return `Clip by ${shot}`;
}
