import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  gameEventsChannelName,
  parseGameEventBroadcast,
  type GameEventBroadcastPayload,
} from '@/lib/operator';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { GameEvent } from '@/types/database';

type UseGameEventBroadcastArgs = {
  gameId?: string | null;
  enabled: boolean;
  followFeatured?: boolean;
};

type GameEventFan = (event: GameEventBroadcastPayload) => void;

const fansByTopic = new Map<string, Set<GameEventFan>>();
const channelByTopic = new Map<string, RealtimeChannel>();

function payloadFromGameEvent(row: GameEvent): GameEventBroadcastPayload | null {
  const type = (row.event_type ?? '').trim();
  if (!type) return null;
  const team = (row.description ?? '').split('·').pop()?.trim() ?? '';
  return {
    type,
    timestamp: row.created_at ?? new Date().toISOString(),
    team,
  };
}

function dispatchGameEvent(topic: string, event: GameEventBroadcastPayload) {
  fansByTopic.get(topic)?.forEach((fan) => fan(event));
}

/**
 * @purpose Share one Realtime channel per `game_events_{id}` so paging Reels never `.on()` after `subscribe()`.
 * @sideEffects `private: true` opts this channel into Realtime Authorization — Supabase checks the
 *   `realtime.messages` RLS policies (schema.sql) before delivering a broadcast on this topic. Without
 *   it, broadcast sends bypass RLS entirely (they are not table writes), so anyone holding the public
 *   anon key could inject fake sideline events into every fan's live Reel overlay for any game id.
 */
function watchGameEventChannel(gameId: string, fan: GameEventFan): () => void {
  const topic = gameEventsChannelName(gameId);
  let fans = fansByTopic.get(topic);
  if (!fans) {
    fans = new Set();
    fansByTopic.set(topic, fans);
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: '*' }, (message) => {
        const parsed = parseGameEventBroadcast(message);
        if (parsed) dispatchGameEvent(topic, parsed);
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events' },
        (payload) => {
          const row = payload.new as GameEvent | null;
          if (!row) return;
          if (row.game_id && String(row.game_id) !== gameId) return;
          const parsed = payloadFromGameEvent(row);
          if (parsed) dispatchGameEvent(topic, parsed);
        },
      )
      .subscribe();
    channelByTopic.set(topic, channel);
  }
  fans.add(fan);
  return () => {
    fans.delete(fan);
    if (fans.size > 0) return;
    const channel = channelByTopic.get(topic);
    if (channel) void supabase.removeChannel(channel);
    channelByTopic.delete(topic);
    fansByTopic.delete(topic);
  };
}

/**
 * @purpose Join `game_events_${gameId}` while a Reel with that live game is on screen.
 * @param gameId `reels.game_id` when the clip is tagged.
 * @param enabled Subscribe only while this video is the focused Reel.
 * @param followFeatured When `gameId` is missing (seeded clips), resolve the current live `games` row first.
 * @returns Latest broadcast `{ type, timestamp, team }` plus `clear`.
 * @sideEffects Shared Realtime Broadcast + `game_events` INSERT `postgres_changes` (one channel per game id); `removeChannel` when the last Reel unsubscribes.
 */
export function useGameEventBroadcast({
  gameId,
  enabled,
  followFeatured = false,
}: UseGameEventBroadcastArgs) {
  const [resolvedId, setResolvedId] = useState<string | null>(gameId ?? null);
  const [lastEvent, setLastEvent] = useState<GameEventBroadcastPayload | null>(null);

  useEffect(() => {
    if (gameId) {
      setResolvedId(gameId);
      return;
    }
    if (!enabled || !followFeatured || !isSupabaseConfigured) {
      setResolvedId(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const running = await supabase
        .from('games')
        .select('id')
        .eq('is_clock_running', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && !running.error && running.data?.id) {
        setResolvedId(String(running.data.id));
        return;
      }
      const active = await supabase
        .from('games')
        .select('id')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && !active.error && active.data?.id) {
        setResolvedId(String(active.data.id));
        return;
      }
      const newest = await supabase
        .from('games')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || newest.error || !newest.data?.id) {
        setResolvedId(null);
        return;
      }
      setResolvedId(String(newest.data.id));
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, followFeatured, gameId]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !resolvedId) return;
    return watchGameEventChannel(resolvedId, setLastEvent);
  }, [enabled, resolvedId]);

  useEffect(() => {
    if (!enabled) setLastEvent(null);
  }, [enabled]);

  return {
    gameId: resolvedId,
    lastEvent,
    clear: () => setLastEvent(null),
  };
}
