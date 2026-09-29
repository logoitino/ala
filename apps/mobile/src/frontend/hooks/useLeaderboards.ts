import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchLeaderboards, type Leaderboards } from '@/lib/leaderboards';
import type { SpotlightPeriodKind } from '@/types/database';

/**
 * @purpose Spotlight Boards (ROADMAP M1): most-hyped / most-viewed players, most-viewed Highlights, school standings, top fans.
 * @param kind Spotlight window; `week` by default so the boards reset every Monday.
 * @param enabled `layouts.leaderboards`; when false nothing is fetched.
 * @returns `{ boards, unavailable, loading, error, refresh }`. `unavailable` means `get_leaderboards` is not deployed yet — render nothing loud.
 * @sideEffects `get_leaderboards` RPC on focus and on `refresh`.
 */
export function useLeaderboards(kind: SpotlightPeriodKind = 'week', enabled = true) {
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLeaderboards(kind);
      if (result.status === 'unavailable') {
        setUnavailable(true);
        setBoards(null);
      } else {
        setUnavailable(false);
        setBoards(result.boards);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the boards.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      if (enabled) void refresh();
    }, [enabled, refresh]),
  );

  return { boards, unavailable, loading, error, refresh };
}
