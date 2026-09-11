import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { gameMatchesQuery } from '@/data/players';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Game } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export function useLiveScores() {
  const mountedRef = useRef(true);
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setGames([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('games')
      .select('*')
      .eq('is_active', true)
      .order('home_team', { ascending: true });

    if (!mountedRef.current) return;

    if (queryError) {
      setGames([]);
      setError(queryError.message);
      setLoading(false);
      return;
    }

    setGames((data as Game[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('games_discovery')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload) => {
          const next = (payload.new ?? payload.old) as Game | undefined;
          if (!next?.id) return;
          setGames((current) => {
            if (payload.eventType === 'DELETE' || next.is_active === false) {
              return current.filter((game) => game.id !== next.id);
            }
            return [next, ...current.filter((game) => game.id !== next.id)];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const visibleGames = useMemo(
    () => games.filter((game) => gameMatchesQuery(game, query)),
    [games, query],
  );

  return { games, visibleGames, query, setQuery, loading, error, refresh };
}
