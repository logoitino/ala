import { isAuraUuid } from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TopFilmerRow } from '@/lib/filmers';
import type { SpotlightPeriodKind } from '@/types/database';

/**
 * ROADMAP Mission M1 — leaderboards and friendly competition.
 *
 * Boards rank hype and views only. Nothing here carries a Mālo amount or backer count, and nothing
 * should: docs/product/STORY.md "Never rank kids by how much money they received".
 */

export type LeaderboardPlayerRow = {
  rank: number;
  playerId: string;
  name: string;
  schoolName: string;
  hype: number;
  views: number;
  seki: number;
  aura: number;
  flex: number;
};

export type LeaderboardHighlightRow = {
  rank: number;
  reelId: string;
  title: string;
  category: string;
  playerId: string;
  name: string;
  schoolName: string;
  views: number;
  hype: number;
};

export type LeaderboardSchoolRow = {
  rank: number;
  schoolName: string;
  hype: number;
  highlights: number;
  fans: number;
  score: number;
};

export type LeaderboardFanRow = {
  rank: number;
  profileId: string;
  name: string;
  avatarUrl: string | null;
  hypeGiven: number;
  clipsTagged: number;
  score: number;
};

export type Leaderboards = {
  periodKind: SpotlightPeriodKind;
  startDate: string;
  endDate: string;
  playersHype: LeaderboardPlayerRow[];
  playersViews: LeaderboardPlayerRow[];
  highlights: LeaderboardHighlightRow[];
  schools: LeaderboardSchoolRow[];
  fans: LeaderboardFanRow[];
  /** `get_top_filmers` (separate RPC, merged in by `useLeaderboards`). Empty until that SQL is applied. */
  filmers?: TopFilmerRow[];
};

export type LeaderboardsResult =
  | { status: 'ok'; boards: Leaderboards }
  /** `get_leaderboards` is not deployed on this project yet (supabase/leaderboards.sql not applied). */
  | { status: 'unavailable' };

/**
 * What counts as a view (owner, 2026-09-29: "the same feeling as other social platforms"):
 * the clip has actually **played** for 3 seconds — not merely been on screen, so a clip that never
 * loads, sits buffering or is paused does not count. Clips shorter than that count at 90% played.
 * Server side (`record_reel_view`): signed-in viewers only, once per viewer per clip per day, never
 * the uploader or the tagged athlete, never removed / flagged / Vault-only clips.
 */
export const VIEW_PLAY_MS = 3000;

/** @deprecated Old name kept for callers; views now need real playback, see `VIEW_PLAY_MS`. */
export const VIEW_DWELL_MS = VIEW_PLAY_MS;

/**
 * @purpose Played time that makes a view for a clip of this length.
 * @param durationSec `VideoPlayer.duration` (0 / NaN until the clip loads).
 */
export function viewThresholdMs(durationSec: number | null | undefined): number {
  const ms = Number(durationSec) * 1000;
  if (!Number.isFinite(ms) || ms <= 0) return VIEW_PLAY_MS;
  return Math.max(500, Math.min(VIEW_PLAY_MS, Math.round(ms * 0.9)));
}

const EMPTY_BOARDS: Omit<Leaderboards, 'periodKind'> = {
  startDate: '',
  endDate: '',
  playersHype: [],
  playersViews: [],
  highlights: [],
  schools: [],
  fans: [],
};

function rpcMissing(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return /could not find the function|schema cache|42883|PGRST202/i.test(`${error.code ?? ''} ${error.message ?? ''}`);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    : [];
}

function asPeriod(value: unknown, fallback: SpotlightPeriodKind): SpotlightPeriodKind {
  return value === 'week' || value === 'month' || value === 'year' ? value : fallback;
}

function parsePlayer(row: Record<string, unknown>): LeaderboardPlayerRow | null {
  const playerId = asText(row.player_id);
  if (!isAuraUuid(playerId)) return null;
  return {
    rank: asCount(row.rank),
    playerId,
    name: asText(row.name) || 'Athlete',
    schoolName: asText(row.school_name),
    hype: asCount(row.hype),
    views: asCount(row.views),
    seki: asCount(row.seki),
    aura: asCount(row.aura),
    flex: asCount(row.flex),
  };
}

function parseHighlight(row: Record<string, unknown>): LeaderboardHighlightRow | null {
  const reelId = asText(row.reel_id);
  if (!isAuraUuid(reelId)) return null;
  return {
    rank: asCount(row.rank),
    reelId,
    title: asText(row.title) || 'Untitled Highlight',
    category: asText(row.category) || 'game_play',
    playerId: asText(row.player_id),
    name: asText(row.name) || 'Athlete',
    schoolName: asText(row.school_name),
    views: asCount(row.views),
    hype: asCount(row.hype),
  };
}

function parseSchool(row: Record<string, unknown>): LeaderboardSchoolRow | null {
  const schoolName = asText(row.school_name).trim();
  if (!schoolName) return null;
  return {
    rank: asCount(row.rank),
    schoolName,
    hype: asCount(row.hype),
    highlights: asCount(row.highlights),
    fans: asCount(row.fans),
    score: asCount(row.score),
  };
}

function parseFan(row: Record<string, unknown>): LeaderboardFanRow | null {
  const profileId = asText(row.profile_id);
  if (!profileId) return null;
  const avatar = asText(row.avatar_url).trim();
  return {
    rank: asCount(row.rank),
    profileId,
    name: asText(row.name) || 'Fan',
    avatarUrl: avatar || null,
    hypeGiven: asCount(row.hype_given),
    clipsTagged: asCount(row.clips_tagged),
    score: asCount(row.score),
  };
}

/** Parse a board, dropping malformed rows; a missing `rank` falls back to position among the kept rows. */
function parseList<T extends { rank: number }>(value: unknown, parse: (row: Record<string, unknown>) => T | null): T[] {
  return asRows(value)
    .map((row) => parse(row))
    .filter((row): row is T => row !== null)
    .map((row, index) => (row.rank > 0 ? row : { ...row, rank: index + 1 }));
}

/**
 * @purpose Map the `get_leaderboards` jsonb payload into typed boards, dropping malformed rows.
 * @param raw RPC payload.
 * @param requested Period asked for, used when the payload omits `period_kind`.
 */
export function parseLeaderboards(raw: unknown, requested: SpotlightPeriodKind = 'week'): Leaderboards {
  if (!raw || typeof raw !== 'object') return { periodKind: requested, ...EMPTY_BOARDS };
  const data = raw as Record<string, unknown>;
  return {
    periodKind: asPeriod(data.period_kind, requested),
    startDate: asText(data.start_date),
    endDate: asText(data.end_date),
    playersHype: parseList(data.players_hype, parsePlayer),
    playersViews: parseList(data.players_views, parsePlayer),
    highlights: parseList(data.highlights, parseHighlight),
    schools: parseList(data.schools, parseSchool),
    fans: parseList(data.fans, parseFan),
  };
}

/**
 * @purpose Every M1 board for one Spotlight window (week by default so new athletes can climb).
 * @returns `unavailable` when the RPC is not deployed yet; throws on any other failure so the
 * screen can show Retry instead of a misleading empty board.
 * @sideEffects `get_leaderboards` RPC.
 */
export async function fetchLeaderboards(kind: SpotlightPeriodKind = 'week'): Promise<LeaderboardsResult> {
  if (!isSupabaseConfigured) return { status: 'unavailable' };
  const { data, error } = await supabase.rpc('get_leaderboards', { period_kind: kind });
  if (error) {
    if (rpcMissing(error)) return { status: 'unavailable' };
    throw new Error(error.message || 'Could not load the boards.');
  }
  return { status: 'ok', boards: parseLeaderboards(data, kind) };
}

const viewedThisSession = new Set<string>();
let viewRpcMissing = false;

/**
 * @purpose Count one view of an uploaded Highlight, at most once per clip per app session.
 * @remarks The server also throttles to one counted view per viewer per clip per UTC day and ignores
 * the uploader and the tagged athlete; this client guard just avoids a round trip every time a clip
 * scrolls back into view. Seeded demo clips (non-UUID ids) and signed-out viewers are skipped — the
 * RPC is signed-in only. Fire-and-forget: a failure never reaches the feed, and once the RPC is
 * known to be missing (SQL not applied) it stops trying for the rest of the session.
 * @returns Whether a request was sent.
 * @sideEffects `record_reel_view` RPC.
 */
export function recordReelView(reelId: string | null | undefined, signedIn: boolean): boolean {
  if (!signedIn || !reelId || !isAuraUuid(reelId)) return false;
  if (viewRpcMissing || !isSupabaseConfigured) return false;
  if (viewedThisSession.has(reelId)) return false;
  viewedThisSession.add(reelId);
  void Promise.resolve(supabase.rpc('record_reel_view', { target_reel_id: reelId }))
    .then(({ error }) => {
      if (rpcMissing(error)) viewRpcMissing = true;
    })
    .catch(() => undefined);
  return true;
}

/**
 * @purpose Total counted views on an athlete's confirmed Highlights — the profile's "views" number,
 *   like the view total on a creator page. Includes Vault clips the viewer can't open.
 * @returns The total, or null when the RPC is missing (SQL not applied) or fails; callers fall back
 *   to `players.view_count`.
 */
export async function fetchAthleteHighlightViews(playerId: string | null | undefined): Promise<number | null> {
  if (!playerId || !isAuraUuid(playerId) || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.rpc('athlete_highlight_views', { target_player_id: playerId });
    if (error) return null;
    const total = Number(data);
    return Number.isFinite(total) && total >= 0 ? total : null;
  } catch {
    return null;
  }
}

/** Test hook: forget which clips were counted this session. */
export function resetReelViewSessionForTests(): void {
  viewedThisSession.clear();
  viewRpcMissing = false;
}
