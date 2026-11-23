/** Spotlight refreshes settle visibly and accept only the latest read in the active route lifetime. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { fetchSpotlightBoard, hydrateSpotlightPlayer } from '@/lib/spotlight';
import type { Player, SpotlightAward } from '@/types/database';

/**
 * @purpose Spotlight tab board: current and recent Player of the Week/Month awards, including ones already dismissed on Highlights launch.
 * @param roster Live `players` for Aura / Mālo hydration.
 * @returns `{ awards, loading, error, refresh }`; failed refreshes retain the last accepted board.
 * @sideEffects `get_active_spotlight_award` + `spotlight_awards` SELECT on focus.
 */
export function useSpotlightBoard(roster: Player[] = []) {
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const [awards, setAwards] = useState<SpotlightAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lifetime = useRef({ active: false, generation: 0 });

  const refresh = useCallback(async () => {
    if (!lifetime.current.active) return;
    const generation = ++lifetime.current.generation;
    const accepted = () => lifetime.current.active && lifetime.current.generation === generation;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchSpotlightBoard(rosterRef.current);
      if (accepted()) setAwards(next);
    } catch {
      if (accepted()) setError('Could not load Spotlights. Check your connection and try again.');
    } finally {
      if (accepted()) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      lifetime.current.active = true;
      void refresh();
      return () => {
        lifetime.current.active = false;
        lifetime.current.generation += 1;
      };
    }, [refresh]),
  );

  useEffect(() => {
    if (roster.length === 0) return;
    setAwards((current) => current.map((award) => hydrateSpotlightPlayer(award, rosterRef.current)));
  }, [roster.length]);

  return { awards, loading, error, refresh };
}
