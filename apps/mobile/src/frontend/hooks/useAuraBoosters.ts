/**
 * Local leaderboard rail: the top five Aura boosters from `lib/aura` (`get_aura_board`), with `__DEV__` personas when
 * the database is not configured or returns nobody. Refreshes on focus and whenever a profile's Aura changes.
 */
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { DEV_PERSONAS } from '@/data/devPersonas';
import { auraTierForPoints, fetchAuraBoard, subscribeProfileAura, type AuraBooster } from '@/lib/aura';
import { isSupabaseConfigured } from '@/lib/supabase';

const LIMIT = 5;

function fallbackBoosters(): AuraBooster[] {
  return [...DEV_PERSONAS]
    .sort((left, right) => right.aura_points - left.aura_points)
    .slice(0, LIMIT)
    .map((persona) => ({
      id: persona.id,
      username: persona.handle,
      full_name: persona.name,
      aura_points: persona.aura_points,
      current_tier: auraTierForPoints(persona.aura_points),
    }));
}

/**
 * @purpose Load the top five Aura boosters (`get_aura_board`, which respects privacy) or `__DEV__` personas for the Local leaderboard rail.
 * @returns `{ boosters, loading, refresh }` sorted by `aura_points` descending.
 * @sideEffects `get_aura_board` RPC on focus (direct `profiles` read on databases without it); `subscribeProfileAura` refresh.
 */
export function useAuraBoosters() {
  const [boosters, setBoosters] = useState<AuraBooster[]>(fallbackBoosters);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setBoosters(fallbackBoosters());
      setLoading(false);
      return;
    }

    setLoading(true);
    const next = await fetchAuraBoard(LIMIT);
    setBoosters(next.length > 0 ? next : fallbackBoosters());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => subscribeProfileAura(() => void refresh()), [refresh]);

  return { boosters, loading, refresh };
}
