/**
 * Fan-side live game data: the Local scoreboard list, the featured live match, one game row, and the Realtime channels
 * that keep them current. Moved out of `hooks/useLiveScores` and `hooks/useLiveGame` (PORT-01) so a host change
 * rewrites lib/, not the hooks.
 * @sideEffects SELECT on `games`; Realtime `postgres_changes` on `games` and `game_events`.
 */

import { nextRealtimeTopic, supabase } from '@/lib/supabase';
import type { Game, GameEvent } from '@/types/database';

/**
 * @purpose Load the active games for the Local scoreboard, home team A to Z.
 * @returns Games, or an empty list plus the database message. A database without `games.is_active` falls back to
 *   every game, so an older project still shows a scoreboard instead of an error.
 * @sideEffects `games` SELECT (twice when the fallback runs).
 */
export async function fetchDiscoveryGames(): Promise<{ games: Game[]; error: string | null }> {
  const live = await supabase.from('games').select('*').eq('is_active', true).order('home_team', { ascending: true });
  const source =
    live.error && /is_active/i.test(live.error.message)
      ? await supabase.from('games').select('*').order('home_team', { ascending: true })
      : live;
  if (source.error) return { games: [], error: source.error.message };
  return { games: (source.data as Game[] | null) ?? [], error: null };
}

/**
 * @purpose Pick the game fan screens should follow when none was named: a running clock first, then the newest active
 *   game, then the newest game of any kind.
 * @returns The game id, or null when there are no games or every read failed.
 * @sideEffects Up to three `games` SELECTs.
 */
export async function resolveFeaturedGameId(): Promise<string | null> {
  const running = await supabase
    .from('games')
    .select('id')
    .eq('is_clock_running', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!running.error && running.data?.id) return String(running.data.id);

  const active = await supabase
    .from('games')
    .select('id')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!active.error && active.data?.id) return String(active.data.id);

  const newest = await supabase.from('games').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (newest.error || !newest.data?.id) return null;
  return String(newest.data.id);
}

/**
 * @purpose Load one game row for live fan screens.
 * @param gameId `games.id`.
 * @returns The row, or null when it is missing or the read failed.
 * @sideEffects `games` SELECT.
 */
export async function fetchLiveGameRow(gameId: string): Promise<Game | null> {
  const { data, error } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle();
  if (error || !data) return null;
  return data as Game;
}

/**
 * @purpose Call back whenever any game row changes, so a list can reload.
 * @param topicPrefix Channel name prefix; a sequence number is added so remounts never share a channel.
 * @param onChange Called with no arguments after each change.
 * @returns Unsubscribe.
 * @sideEffects Realtime `postgres_changes` channel on `games`.
 */
export function subscribeGamesChanges(topicPrefix: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(nextRealtimeTopic(topicPrefix))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
      onChange();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * @purpose Follow one game: its row changes and each new play logged for it.
 * @param gameId `games.id` to follow.
 * @param handlers `onGame` gets each new row; `onPlay` each inserted `game_events` row; `onStatus` each channel status
 *   with the topic name, so the caller can count reconnects.
 * @returns Unsubscribe.
 * @sideEffects Realtime `postgres_changes` on `games` (filtered to `gameId`) and `game_events` INSERTs for it.
 */
export function subscribeLiveGame(
  gameId: string,
  handlers: {
    onGame: (game: Game) => void;
    onPlay: (event: GameEvent) => void;
    onStatus: (status: string, topic: string) => void;
  },
): () => void {
  const topic = nextRealtimeTopic(`live_game_${gameId}`);
  const channel = supabase
    .channel(topic)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
      (payload) => {
        if (!payload.new) return;
        handlers.onGame(payload.new as Game);
      },
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
      (payload) => {
        const row = payload.new as GameEvent | null;
        if (!row) return;
        handlers.onPlay(row);
      },
    )
    .subscribe((status) => {
      handlers.onStatus(status, topic);
    });
  return () => {
    supabase.removeChannel(channel);
  };
}
