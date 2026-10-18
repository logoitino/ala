/**
 * Profile Stats and Aura load one sport's recorded numbers. Navigation clears the previous identity immediately;
 * late responses never replace a newer athlete or sport, and missing live data remains unavailable.
 * @sideEffects `fetchAthleteStats` reads Supabase player, career and game-log records.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { emptyAthleteStats, type AthleteStatsBundle } from '@/data/athleteStats';
import { fetchAthleteStats } from '@/lib/athleteStats';
import type { Player } from '@/types/database';

/**
 * @purpose Stats 📊 engine: combine measurables, career table, recent game log for a roster athlete.
 * @param playerId `players.id` (demo/dev ids skip the network).
 * @param player Optional hydrated player so height/weight paint without a second round-trip.
 * @param targetSport Explicit selected sport from the linked athlete's own profile, when known.
 * @param enabled When false, skip the network read until this profile is the open screen.
 * @returns `{ stats, loading, refresh }`.
 * @sideEffects `fetchAthleteStats` → `players` / `athlete_career_stats` / `athlete_game_logs`.
 */
export function useAthleteStats(
  playerId: string | null | undefined,
  player?: Player | null,
  targetSport?: string | null,
  enabled = true,
) {
  const hydratedPlayer = player?.id === playerId?.trim() ? player : null;
  const empty = useMemo(() => emptyAthleteStats(hydratedPlayer, targetSport), [hydratedPlayer, targetSport]);
  const currentIdentity = useRef({ playerId, player, targetSport });
  currentIdentity.current = { playerId, player, targetSport };
  const request = useRef(0);
  const [state, setState] = useState<{
    playerId: typeof playerId; player: typeof player; targetSport: typeof targetSport;
    stats: AthleteStatsBundle; loading: boolean;
  }>(() => ({ playerId, player, targetSport, stats: empty, loading: Boolean(playerId) }));
  const isCurrent = state.playerId === playerId && state.player === player && state.targetSport === targetSport;

  const refresh = useCallback(async () => {
    const version = ++request.current;
    const identity = { playerId, player, targetSport };
    const stillCurrent = () => request.current === version
      && currentIdentity.current.playerId === playerId
      && currentIdentity.current.player === player
      && currentIdentity.current.targetSport === targetSport;
    if (!playerId) {
      setState({ ...identity, stats: empty, loading: false });
      return;
    }
    setState((previous) => ({ ...identity,
      stats: previous.playerId === playerId && previous.player === player && previous.targetSport === targetSport
        ? previous.stats : empty, loading: true }));
    try {
      const stats = await fetchAthleteStats(playerId, player, targetSport);
      if (stillCurrent()) setState({ ...identity, stats, loading: false });
    } catch {
      if (stillCurrent()) setState({ ...identity, stats: empty, loading: false });
    }
  }, [empty, player, playerId, targetSport]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    return () => { request.current += 1; };
  }, [enabled, refresh]);

  // Effects run after paint; this boundary prevents even one frame of the previous athlete's totals.
  return { stats: isCurrent ? state.stats : empty,
    loading: !enabled ? false : isCurrent ? state.loading : Boolean(playerId), refresh };
}
