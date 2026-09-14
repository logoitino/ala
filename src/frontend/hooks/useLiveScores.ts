import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { gameMatchesQuery } from '@/data/players';
import { isSupabaseConfigured, nextRealtimeTopic, supabase } from '@/lib/supabase';
import type { Game } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

/**
 * @purpose Subscribe to live `games` rows for Local discovery (Realtime + ZIP / school search).
 * @returns `{ games, visibleGames, query, setQuery, loading, error, refresh }`.
 * @sideEffects Supabase SELECT + Realtime `postgres_changes` on `games`.
 */
export function useLiveScores() {
  const mountedRef = useRef(true);
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (showSpinner = true) => {
    if (!mountedRef.current) return;
    if (showSpinner) setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setGames([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const live = await supabase
      .from('games')
      .select('*')
      .eq('is_active', true)
      .order('home_team', { ascending: true });

    const source =
      live.error && /is_active/i.test(live.error.message)
        ? await supabase.from('games').select('*').order('home_team', { ascending: true })
        : live;

    if (!mountedRef.current) return;

    if (source.error) {
      setGames([]);
      setError(source.error.message);
      setLoading(false);
      return;
    }

    setGames((source.data as Game[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    if (!isSupabaseConfigured) {
      return () => {
        mountedRef.current = false;
      };
    }

    const channelTopic = nextRealtimeTopic('games_discovery');
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        () => {
          void refresh(false);
        },
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const visibleGames = useMemo(
    () => games.filter((game) => gameMatchesQuery(game, query)),
    [games, query],
  );

  return { games, visibleGames, query, setQuery, loading, error, refresh };
}
