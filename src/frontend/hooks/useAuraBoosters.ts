import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { DEV_PERSONAS } from '@/data/devPersonas';
import {
  auraTierForPoints,
  boosterFromProfile,
  subscribeProfileAura,
  type AuraBooster,
} from '@/lib/aura';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const LIMIT = 5;
const FULL_COLUMNS = 'id, username, full_name, aura_points';
const BASIC_COLUMNS = 'id, full_name, aura_points';

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

function parseRows(rows: unknown): AuraBooster[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => boosterFromProfile(row as Parameters<typeof boosterFromProfile>[0]))
    .filter((row): row is AuraBooster => Boolean(row));
}

/**
 * @purpose Load the top five Aura boosters from `profiles` (or `__DEV__` personas) for the Local leaderboard rail.
 * @returns `{ boosters, loading, refresh }` sorted by `aura_points` descending.
 * @sideEffects Supabase `profiles` SELECT on focus; `subscribeProfileAura` refresh.
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
    const full = await supabase
      .from('profiles')
      .select(FULL_COLUMNS)
      .order('aura_points', { ascending: false })
      .limit(LIMIT);

    const source = full.error
      ? await supabase.from('profiles').select(BASIC_COLUMNS).order('aura_points', { ascending: false }).limit(LIMIT)
      : full;

    const next = parseRows(source.data);
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
