/**
 * Public game data for the guest match screen: game, roster, recent plays, and live updates.
 * Keep database queries and channel cleanup here so the route only composes the feed and rosters.
 * @sideEffects Supabase SELECT and Realtime on `games`, `players`, and `game_events`.
 */

import type { Player } from '@/data/players';
import { realtimeEq } from '@/lib/postgrestFilter';
import { isSupabaseConfigured, nextRealtimeTopic, supabase } from '@/lib/supabase';
import type { Game, GameEvent, GameEventWithPlayer } from '@/types/database';

const GAME_EVENT_SELECT = '*, players(*)';
const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

/**
 * @purpose Load a public match with rosters and the newest 40 plays; feed errors leave the match usable.
 * @param gameId Match shown by the guest route.
 * @returns Game, players, events, and separate match/feed errors.
 * @sideEffects SELECT on `games`, `players`, and `game_events`.
 */
export async function fetchGuestGameOverview(gameId: string): Promise<{
  game: Game | null;
  players: Player[];
  events: GameEventWithPlayer[];
  error: string | null;
  feedError: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { game: null, players: [], events: [], error: CONFIG_ERROR, feedError: null };
  }

  const [gameResult, playersResult, eventsResult] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).single(),
    supabase.from('players').select('*'),
    supabase.from('game_events').select(GAME_EVENT_SELECT).eq('game_id', gameId)
      .order('created_at', { ascending: false }).limit(40),
  ]);

  return {
    game: gameResult.data as Game | null,
    players: (playersResult.data as Player[] | null) ?? [],
    events: eventsResult.error ? [] : (eventsResult.data as GameEventWithPlayer[] | null) ?? [],
    error: gameResult.error?.message ?? (gameResult.data ? null : 'Game not found.'),
    feedError: eventsResult.error?.message ?? null,
  };
}

/**
 * @purpose Hydrate a just-inserted play with its athlete; the route can fall back to its cached roster.
 * @param eventId New play id received over Realtime.
 * @returns Joined play when readable, otherwise null.
 * @sideEffects SELECT on `game_events` with joined `players`.
 */
export async function fetchGuestGameEvent(eventId: string): Promise<GameEventWithPlayer | null> {
  const { data } = await supabase.from('game_events').select(GAME_EVENT_SELECT).eq('id', eventId).single();
  return data as GameEventWithPlayer | null;
}

/**
 * @purpose Follow score changes and new plays for one guest match, with cleanup owned by the caller's effect.
 * @param gameId Match to follow.
 * @param callbacks Receivers for the game snapshot and raw inserted play.
 * @returns Cleanup that removes the channel and silences late callbacks.
 * @sideEffects Supabase Realtime subscription on `games` and `game_events`.
 */
export function subscribeToGuestGame(
  gameId: string,
  callbacks: { onGame: (game: Game) => void; onEvent: (event: GameEvent) => void },
): () => void {
  if (!isSupabaseConfigured) return () => {};
  const gameFilter = realtimeEq('id', gameId);
  if (!gameFilter) return () => {};
  let active = true;
  const channel = supabase.channel(nextRealtimeTopic(`guest_game_${gameId}`))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: gameFilter },
      (payload) => {
        if (active && payload.new) callbacks.onGame(payload.new as Game);
      })
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'game_events' },
      (payload) => {
        const row = payload.new as GameEvent;
        if (active && row.game_id === gameId) callbacks.onEvent(row);
      })
    .subscribe();

  return () => {
    active = false;
    void supabase.removeChannel(channel);
  };
}
