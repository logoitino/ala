import { useCallback, useEffect, useState } from 'react';

import { demoAthleteStats, type AthleteStatsBundle } from '@/data/athleteStats';
import { fetchAthleteStats } from '@/lib/athleteStats';
import type { Player } from '@/types/database';

/**
 * @purpose Stats 📊 engine: combine measurables, career table, recent game log for a roster athlete.
 * @param playerId `players.id` (demo/dev ids skip the network).
 * @param player Optional hydrated player so height/weight paint without a second round-trip.
 * @returns `{ stats, loading, refresh }`.
 * @sideEffects `fetchAthleteStats` → `players` / `athlete_career_stats` / `athlete_game_logs`.
 */
export function useAthleteStats(playerId: string | null | undefined, player?: Player | null) {
  const [stats, setStats] = useState<AthleteStatsBundle>(() =>
    demoAthleteStats(
      player ?? {
        id: playerId || 'demo-athlete',
        name: 'Athlete',
        jersey_number: 0,
        position: '',
        height: '',
        school_name: '',
        backer_count: 0,
      },
    ),
  );
  const [loading, setLoading] = useState(Boolean(playerId));

  const refresh = useCallback(async () => {
    if (!playerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await fetchAthleteStats(playerId, player);
    setStats(next);
    setLoading(false);
  }, [player, playerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
