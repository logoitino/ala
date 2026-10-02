/**
 * Live game state: subscribes to one `games` row over Realtime so fan screens follow the operator's score and
 * clock, and ticks the clock locally between updates.
 * @sideEffects Supabase Realtime subscription.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { formatClock, isGameClockLive, parseClockToSeconds } from '@/data/players';
import { isSupabaseConfigured, nextRealtimeTopic, supabase } from '@/lib/supabase';
import { telemetry } from '@/services/TelemetryManager';
import type { Game, GameEvent } from '@/types/database';

export type LivePlayEvent = {
  id: string;
  eventType: string;
  description: string;
  gameId: string | null;
};

type LiveGameRow = Game & { clock_seconds?: number | null };

/**
 * @purpose Read persisted `games.clock` (`m:ss`) or an optional payload `clock_seconds` into local tick state.
 * @param row Game snapshot from SELECT or Realtime `postgres_changes`.
 * @returns Seconds remaining for MM:SS display.
 */
function secondsFromGame(row: LiveGameRow): number {
  const raw = row.clock_seconds;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  return parseClockToSeconds(row.clock) ?? 12 * 60;
}

/**
 * @purpose Subscribe one live `games` row (by `gameId`, or the current featured match) so fan UI tracks operator score/clock writes.
 * @param gameId Active game uuid. When omitted, the newest running/active `games` row is resolved first.
 * @param options.enabled When false, skip SELECT + Realtime (parent already owns a live snapshot).
 * @returns Live `homeScore` / `awayScore` / `quarter` / `status` / `clockSeconds`, MM:SS `clockLabel`, `isLive`, and the latest `game_events` play for toasts.
 * @sideEffects Supabase SELECT + Realtime `postgres_changes` on `games` (filtered `id=eq.{gameId}`) and `game_events`; 1s local clock while `is_clock_running`; `TelemetryManager.trackSocketReconnect` on `CHANNEL_ERROR` / `CLOSED`.
 */
export function useLiveGame(gameId?: string | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false;
  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const gameRef = useRef<Game | null>(null);
  const [resolvedId, setResolvedId] = useState<string | null>(gameId ?? null);
  const [game, setGame] = useState<Game | null>(null);
  const [clockSeconds, setClockSeconds] = useState(12 * 60);
  const [loading, setLoading] = useState(true);
  const [lastPlay, setLastPlay] = useState<LivePlayEvent | null>(null);

  const applyGame = useCallback((incoming: LiveGameRow, syncClock: boolean) => {
    const prev =
      gameRef.current?.id && incoming.id && gameRef.current.id !== incoming.id
        ? null
        : gameRef.current;
    const next = { ...(prev ?? {}), ...incoming } as LiveGameRow;
    gameRef.current = next;
    if (next.id) setResolvedId(next.id);
    const nextRunning = isGameClockLive(next);
    const wasRunning = runningRef.current;
    runningRef.current = nextRunning;
    if (syncClock || !nextRunning || !wasRunning) {
      setClockSeconds(secondsFromGame(next));
    }
    setGame(next);
  }, []);

  const clearLastPlay = useCallback(() => {
    setLastPlay(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (gameId) setResolvedId(gameId);
  }, [gameId]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const resolveFeaturedId = async (): Promise<string | null> => {
      if (gameId) return gameId;

      const running = await supabase
        .from('games')
        .select('id')
        .eq('is_clock_running', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && !running.error && running.data?.id) return String(running.data.id);

      const active = await supabase
        .from('games')
        .select('id')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && !active.error && active.data?.id) return String(active.data.id);

      const newest = await supabase
        .from('games')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || newest.error || !newest.data?.id) return null;
      return String(newest.data.id);
    };

    const load = async () => {
      setLoading(true);
      const id = await resolveFeaturedId();
      if (cancelled) return;
      if (!id) {
        gameRef.current = null;
        setGame(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('games').select('*').eq('id', id).maybeSingle();
      if (cancelled) return;
      if (!error && data) applyGame(data as Game, true);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [applyGame, enabled, gameId]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !resolvedId) return;

    const channelName = nextRealtimeTopic(`live_game_${resolvedId}`);
    let attempts = 0;
    let tearingDown = false;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${resolvedId}` },
        (payload) => {
          if (!mountedRef.current || !payload.new) return;
          applyGame(payload.new as Game, false);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${resolvedId}` },
        (payload) => {
          const row = payload.new as GameEvent | null;
          if (!mountedRef.current || !row) return;
          setLastPlay({
            id: row.id,
            eventType: row.event_type,
            description: row.description,
            gameId: row.game_id ?? resolvedId,
          });
        },
      )
      .subscribe((status) => {
        if (tearingDown) return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          attempts += 1;
          telemetry.trackSocketReconnect(channelName, attempts);
          return;
        }
        if (status === 'SUBSCRIBED' && attempts > 0) {
          telemetry.trackSocketReconnect(channelName, attempts);
          attempts = 0;
        }
      });

    return () => {
      tearingDown = true;
      supabase.removeChannel(channel);
    };
  }, [applyGame, enabled, resolvedId]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (!runningRef.current) return;
      setClockSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const homeScore = Number(game?.home_score) || 0;
  const awayScore = Number(game?.away_score) || 0;
  const quarter = (game?.quarter || game?.status || 'Q1').toString();
  const status = (game?.status || quarter).toString();
  const isLive = Boolean(game && isGameClockLive(game));

  return {
    game,
    gameId: resolvedId,
    homeTeam: game?.home_team ?? '',
    awayTeam: game?.away_team ?? '',
    homeScore,
    awayScore,
    quarter,
    status,
    clockSeconds,
    clockLabel: formatClock(clockSeconds),
    isLive,
    loading,
    lastPlay,
    clearLastPlay,
  };
}
