/**
 * Sideline scorer helpers: listing live games, saving the GPS check-in, quarter and scoring-step constants,
 * sideline callouts, and the Realtime channel + payload for broadcasting a play to fans watching the game.
 * Used by app/operator/** and `hooks/useGameEventBroadcast`. `OPERATOR_TEST_PIN` is a testing PIN only.
 * @sideEffects Reads `games`, writes `operator_checkins`, AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  displayValue,
  parseClockToSeconds,
  playerBelongsToSchool,
  type Player,
} from '@/data/players';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Game } from '@/types/database';

export const OPERATOR_TEST_PIN = '1234';

export const OPERATOR_LIVE_STATUSES = ['active', 'LIVE', 'IN_PROGRESS'] as const;

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export async function fetchOperatorGames(): Promise<{ games: Game[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    console.error('[operator] Supabase is not configured; cannot load games.');
    return { games: [], error: CONFIG_ERROR };
  }

  const live = await supabase
    .from('games')
    .select('*')
    .in('status', [...OPERATOR_LIVE_STATUSES])
    .order('updated_at', { ascending: false });

  if (live.error) {
    console.error('[operator] Live-status games query failed', live.error);
  } else if ((live.data?.length ?? 0) > 0) {
    return { games: live.data as Game[], error: null };
  } else {
    console.warn(
      '[operator] Zero games for status in (active, LIVE, IN_PROGRESS). Fetching all games for development.',
    );
  }

  const newestFirst = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  const all = newestFirst.error
    ? await supabase.from('games').select('*').order('updated_at', { ascending: false })
    : newestFirst;

  if (newestFirst.error) {
    console.warn('[operator] created_at order unavailable, using updated_at', newestFirst.error.message);
  }

  if (all.error) {
    console.error('[operator] All-games query failed', all.error);
    return { games: [], error: all.error.message };
  }

  const games = (all.data as Game[] | null) ?? [];
  if (games.length === 0) {
    console.error(
      '[operator] Supabase returned zero games. Check RLS policies, seed data, and EXPO_PUBLIC_SUPABASE_URL / ANON_KEY.',
    );
  }

  return { games, error: null };
}

/**
 * @purpose Persist a field operator GPS check-in only after device permission and location lookup succeed.
 * @param latitude Device latitude at check-in.
 * @param longitude Device longitude at check-in.
 * @returns Success or a friendly write failure; callers must not show checked-in state on failure.
 * @sideEffects `operator_checkins` INSERT.
 */
export async function saveOperatorCheckIn(
  latitude: number,
  longitude: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: 'The operator database is not configured.' };
  try {
    // About 1 km is all anyone reads, so exact GPS never leaves the phone; the database rounds again anyway.
    const coarse = (value: number) => Math.round(value * 100) / 100;
    const { error } = await supabase.from('operator_checkins').insert({ latitude: coarse(latitude), longitude: coarse(longitude) });
    if (error) return { ok: false, message: error.message || 'Could not save this field check-in.' };
    return { ok: true };
  } catch {
    return { ok: false, message: 'Could not save this field check-in.' };
  }
}

export const OPERATOR_QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const;

export type OperatorQuarter = (typeof OPERATOR_QUARTERS)[number];

export type OperatorAction = {
  id: string;
  label: string;
  eventType: string;
  points: number;
};

export type OperatorCallout = {
  id: string;
  label: string;
  eventType: string;
  emoji: string;
};

export const OPERATOR_CALLOUTS: OperatorCallout[] = [
  { id: 'big-play', label: 'Big Play', eventType: 'Big Play', emoji: '⚡' },
  { id: 'touchdown', label: 'Touchdown', eventType: 'Touchdown', emoji: '🏆' },
  { id: 'big-hit', label: 'Big Hit', eventType: 'Big Hit', emoji: '🤙' },
  { id: 'turnover', label: 'Turnover', eventType: 'Turnover', emoji: '🛑' },
];

export const GAME_EVENTS_BROADCAST_EVENT = 'play';

export type GameEventBroadcastPayload = {
  type: string;
  timestamp: string;
  team: string;
};

/**
 * @purpose Realtime topic for sideline callouts. Operator and fans must share this exact name.
 * @param gameId Active `games.id`.
 * @returns Channel topic `game_events_${gameId}`.
 */
export function gameEventsChannelName(gameId: string): string {
  return `game_events_${gameId}`;
}

/**
 * @purpose Fan overlay copy, e.g. "⚡ BIG PLAY: Westlake Thunder!".
 * @param payload Broadcast `{ type, team }`.
 * @param callouts Sport playbook callouts (`sport_configs`); defaults to the football set.
 * @returns Uppercase callout line for the Reel banner.
 */
export function formatGameEventHeadline(
  payload: Pick<GameEventBroadcastPayload, 'type' | 'team'>,
  callouts: OperatorCallout[] = OPERATOR_CALLOUTS,
): string {
  const callout = callouts.find((item) => item.eventType === payload.type);
  const emoji = callout?.emoji ?? '⚡';
  const label = (callout?.label ?? payload.type).toUpperCase();
  const team = displayValue(payload.team).trim();
  return team ? `${emoji} ${label}: ${team}!` : `${emoji} ${label}!`;
}

/**
 * @purpose Normalize a Realtime broadcast callback into `{ type, timestamp, team }`.
 * @param raw `channel.on('broadcast')` message or payload object.
 * @returns Parsed payload, or null when type/team are missing.
 */
export function parseGameEventBroadcast(raw: unknown): GameEventBroadcastPayload | null {
  const row = unwrapBroadcastBody(raw);
  if (!row) return null;
  const type = typeof row.type === 'string' ? row.type.trim() : '';
  if (!type || type === 'broadcast') return null;
  const team = typeof row.team === 'string' ? row.team.trim() : '';
  const timestamp =
    typeof row.timestamp === 'string' && row.timestamp.trim()
      ? row.timestamp
      : new Date().toISOString();
  return { type, timestamp, team };
}

function unwrapBroadcastBody(raw: unknown, depth = 0): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || depth > 3) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.type === 'string' && typeof row.team === 'string') return row;
  if (row.payload) return unwrapBroadcastBody(row.payload, depth + 1);
  return null;
}

/**
 * @purpose Push a sideline callout on `game_events_${gameId}` so focused Reel cards can overlay it.
 * @param gameId Active `games.id`.
 * @param payload `{ type, timestamp, team }` — e.g. type `Big Play`.
 * @sideEffects Supabase Realtime Broadcast (WebSocket, HTTP fallback if the socket is not yet joined).
 *   `private: true` routes this send through the `realtime.messages` RLS policies in schema.sql, which
 *   only allow an operator/admin (or anon on a still-unclaimed game, matching the `game_events` INSERT
 *   policy) to publish on a `game_events_%` topic — otherwise any anon-key holder could broadcast fake
 *   live events straight to fans with no server-side check at all.
 */
export async function sendGameEventBroadcast(
  gameId: string,
  payload: GameEventBroadcastPayload,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
  const channel = supabase.channel(gameEventsChannelName(gameId), {
    config: { broadcast: { ack: true }, private: true },
  });
  try {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), 1200);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    await channel.send({
      type: 'broadcast',
      event: GAME_EVENTS_BROADCAST_EVENT,
      payload,
    });
  } finally {
    void supabase.removeChannel(channel);
  }
}

const CLAIM_PREFIX = 'tapuai.operatorClaim.';

function claimKey(gameId: string): string {
  return `${CLAIM_PREFIX}${gameId}`;
}

export function isOperatorPin(value: string): boolean {
  return value === OPERATOR_TEST_PIN;
}

export async function claimOperatorGame(gameId: string, profileId?: string | null): Promise<void> {
  await AsyncStorage.setItem(claimKey(gameId), '1');
  if (!isSupabaseConfigured || !profileId) return;
  const { error } = await supabase
    .from('games')
    .update({ claimed_by: profileId, updated_at: new Date().toISOString() })
    .eq('id', gameId);
  if (error) {
    console.warn('[operator] claimed_by update skipped', error.message);
  }
}

export async function hasOperatorClaim(gameId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(claimKey(gameId));
  return value === '1';
}

export function clockSeconds(game: Game | null | undefined, fallbackSeconds = 12 * 60): number {
  return parseClockToSeconds(game?.clock) ?? fallbackSeconds;
}

export function rosterForScoringSide(
  players: Player[],
  game: Game,
  side: 'home' | 'away',
): Player[] {
  const school = side === 'home' ? game.home_school : game.away_school;
  const team = side === 'home' ? game.home_team : game.away_team;
  const matched = players.filter(
    (player) => playerBelongsToSchool(player, school) || playerBelongsToSchool(player, team),
  );
  return matched.length > 0 ? matched : players;
}

export async function updateOperatorQuarter(gameId: string, quarter: string): Promise<Game> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);

  const { data, error } = await supabase
    .from('games')
    .update({ quarter, updated_at: new Date().toISOString() })
    .eq('id', gameId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not update quarter.');
  }

  return data as Game;
}

export async function updateOperatorScore(args: {
  game: Game;
  side: 'home' | 'away';
  points: number;
}): Promise<{ game: Game; newScore: number; field: 'home_score' | 'away_score' }> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);

  const field = args.side === 'home' ? 'home_score' : 'away_score';
  const current = Number(args.game[field]) || 0;
  const newScore = current + args.points;
  const patch =
    field === 'home_score'
      ? { home_score: newScore, updated_at: new Date().toISOString() }
      : { away_score: newScore, updated_at: new Date().toISOString() };

  let { data, error } = await supabase
    .from('games')
    .update(patch)
    .eq('id', args.game.id)
    .select('*')
    .single();

  if (error?.message?.toLowerCase().includes('updated_at')) {
    const retryPatch = field === 'home_score' ? { home_score: newScore } : { away_score: newScore };
    const retry = await supabase.from('games').update(retryPatch).eq('id', args.game.id).select('*').single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return {
    field,
    newScore,
    game: (data as Game | null) ?? { ...args.game, [field]: newScore },
  };
}

function applyScorePatch(game: Game, row: Record<string, unknown> | null): Game {
  if (!row) return game;
  return {
    ...game,
    home_score: Number.isFinite(Number(row.home_score)) ? Number(row.home_score) : game.home_score,
    away_score: Number.isFinite(Number(row.away_score)) ? Number(row.away_score) : game.away_score,
    clock: typeof row.clock === 'string' ? row.clock : game.clock,
    is_clock_running:
      typeof row.is_clock_running === 'boolean' ? row.is_clock_running : game.is_clock_running,
    claimed_by: typeof row.claimed_by === 'string' ? row.claimed_by : game.claimed_by,
    quarter: typeof row.quarter === 'string' ? row.quarter : game.quarter,
    status: typeof row.status === 'string' ? row.status : game.status,
  };
}

/**
 * @purpose Increment home/away score and optionally toggle the live clock via `update_game_score`.
 * @param game Current game row used for optimistic fallback.
 * @param homeDelta Points to add to home (may be 0).
 * @param awayDelta Points to add to away (may be 0).
 * @param clockRunning When set, writes `games.is_clock_running`.
 * @param clock When set, writes `games.clock` (`m:ss`).
 * @returns Updated game fields.
 * @sideEffects Supabase RPC `update_game_score`; falls back to a direct `games` UPDATE if the RPC is missing.
 */
export async function updateGameScore(args: {
  game: Game;
  homeDelta?: number;
  awayDelta?: number;
  clockRunning?: boolean | null;
  clock?: string | null;
}): Promise<Game> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);

  const homeDelta = args.homeDelta ?? 0;
  const awayDelta = args.awayDelta ?? 0;
  const rpc = await supabase.rpc('update_game_score', {
    target_game_id: args.game.id,
    home_delta: homeDelta,
    away_delta: awayDelta,
    set_clock_running: args.clockRunning ?? null,
    set_clock: args.clock ?? null,
  });

  if (!rpc.error && rpc.data && typeof rpc.data === 'object') {
    return applyScorePatch(args.game, rpc.data as Record<string, unknown>);
  }

  if (homeDelta !== 0 || awayDelta !== 0) {
    const side = homeDelta !== 0 ? 'home' : 'away';
    const points = homeDelta !== 0 ? homeDelta : awayDelta;
    const scored = await updateOperatorScore({ game: args.game, side, points });
    let next = scored.game;
    if (args.clockRunning != null || args.clock) {
      next = await persistOperatorClock(next, {
        running: args.clockRunning,
        clock: args.clock,
      });
    }
    return next;
  }

  return persistOperatorClock(args.game, {
    running: args.clockRunning,
    clock: args.clock,
  });
}

/**
 * @purpose Persist clock text and/or `is_clock_running` when the RPC path is unavailable.
 * @sideEffects Direct `games` UPDATE.
 */
export async function persistOperatorClock(
  game: Game,
  patch: { running?: boolean | null; clock?: string | null },
): Promise<Game> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
  const body: { updated_at: string; clock?: string; is_clock_running?: boolean } = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.clock === 'string') body.clock = patch.clock;
  if (typeof patch.running === 'boolean') body.is_clock_running = patch.running;

  let { data, error } = await supabase.from('games').update(body).eq('id', game.id).select('*').single();
  if (error?.message?.toLowerCase().includes('is_clock_running')) {
    const retryBody = { updated_at: body.updated_at, clock: body.clock };
    const retry = await supabase.from('games').update(retryBody).eq('id', game.id).select('*').single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  return (data as Game | null) ?? { ...game, ...patch, clock: patch.clock ?? game.clock };
}

/**
 * @purpose Persist a sideline callout onto `game_events` for play-by-play history (best-effort; fans use Broadcast).
 * @sideEffects INSERT `game_events` (player_id null).
 */
export async function insertOperatorCallout(args: {
  gameId: string;
  callout: OperatorCallout;
  teamName: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);
  const description = `${args.callout.emoji} ${args.callout.label} · ${args.teamName}`;
  const withGame = {
    game_id: args.gameId,
    player_id: null,
    event_type: args.callout.eventType,
    description,
  };
  const first = await supabase.from('game_events').insert(withGame).select('id').single();
  if (!first.error) return (first.data as { id: string } | null)?.id ?? null;

  const missingGameId = /game_id/i.test(first.error.message);
  if (!missingGameId) throw new Error(first.error.message);

  const retry = await supabase
    .from('game_events')
    .insert({
      player_id: null,
      event_type: args.callout.eventType,
      description,
    })
    .select('id')
    .single();
  if (retry.error) throw new Error(retry.error.message);
  return (retry.data as { id: string } | null)?.id ?? null;
}

export async function insertOperatorEvent(args: {
  gameId: string;
  player: Player;
  action: OperatorAction;
  teamName: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) throw new Error(CONFIG_ERROR);

  const payload = {
    game_id: args.gameId,
    player_id: args.player.id,
    event_type: args.action.eventType,
    description: `${displayValue(args.teamName)} ${args.action.label} · #${displayValue(args.player.jersey_number)} ${displayValue(args.player.name)}`,
  };

  const { data, error } = await supabase.from('game_events').insert(payload).select('id').single();
  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string } | null)?.id ?? null;
}
