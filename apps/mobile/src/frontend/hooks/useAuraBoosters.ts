import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { DEV_PERSONAS } from '@/data/devPersonas';
import {
  auraTierForPoints,
  boosterFromProfile,
  subscribeProfileAura,
  type AuraBooster,
} from '@/lib/aura';
import { isMissingFunction } from '@/lib/dbErrors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { untypedRpc } from '@/lib/rpc';

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
    // The board respects each person's Aura audience, hide-from-search and blocks (PRIV-01). Older databases without
    // get_aura_board still allow the direct read.
    const board = await untypedRpc('get_aura_board', { max_rows: LIMIT });
    let source: { data: unknown } = { data: null };
    if (!board.error) {
      source = { data: (Array.isArray(board.data) ? board.data : []).map((row) => ({ ...(row as Record<string, unknown>), full_name: (row as { display_name?: unknown }).display_name })) };
    } else if (isMissingFunction(board.error)) {
      const full = await supabase.from('profiles').select(FULL_COLUMNS).order('aura_points', { ascending: false }).limit(LIMIT);
      source = full.error
        ? await supabase.from('profiles').select(BASIC_COLUMNS).order('aura_points', { ascending: false }).limit(LIMIT)
        : full;
    }

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
