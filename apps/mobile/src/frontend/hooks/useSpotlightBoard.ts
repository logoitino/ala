import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchSpotlightBoard, hydrateSpotlightPlayer } from '@/lib/spotlight';
import type { Player, SpotlightAward } from '@/types/database';

/**
 * @purpose Spotlight tab board: current and recent Player of the Week/Month awards, including ones already dismissed on Highlights launch.
 * @param roster Live `players` for Aura / Mālo hydration.
 * @returns `{ awards, loading, refresh }`.
 * @sideEffects `get_active_spotlight_award` + `spotlight_awards` SELECT on focus.
 */
export function useSpotlightBoard(roster: Player[] = []) {
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const [awards, setAwards] = useState<SpotlightAward[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchSpotlightBoard(rosterRef.current);
      setAwards(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (roster.length === 0) return;
    setAwards((current) => current.map((award) => hydrateSpotlightPlayer(award, rosterRef.current)));
  }, [roster.length]);

  return { awards, loading, refresh };
}
