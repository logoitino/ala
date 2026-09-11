import { useCallback, useEffect, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Player } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export function useRoster() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setPlayers([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase.from('players').select('*');
    if (queryError) {
      setPlayers([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setPlayers((data as Player[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyBackerCount = useCallback((playerId: string, nextCount: number) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === playerId ? { ...player, backer_count: nextCount } : player,
      ),
    );
  }, []);

  return { players, loading, error, refresh, applyBackerCount, setPlayers };
}
