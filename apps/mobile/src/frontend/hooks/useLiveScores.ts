/**
 * Local tab scoreboard: active games, kept current over Realtime, filtered by a ZIP / school search. Database reads and
 * the live channel go through `lib/liveGames`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { gameMatchesQuery } from '@/data/players';
import { fetchDiscoveryGames, subscribeGamesChanges } from '@/lib/liveGames';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { Game } from '@/types/database';

// 2026-09 fix: this used to be shown directly in the Local tab's empty state (`lede={error}`),
// leaking a developer-facing setup instruction to end users whenever Supabase wasn't configured or
// a fetch failed. The raw detail is still logged for debugging; only this friendly copy ever reaches
// the UI now.
const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';
const FRIENDLY_ERROR = 'We can’t reach the scoreboard right now. Check your connection and try again.';

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
      console.warn('[useLiveScores]', CONFIG_ERROR);
      setGames([]);
      setError(FRIENDLY_ERROR);
      setLoading(false);
      return;
    }

    const source = await fetchDiscoveryGames();

    if (!mountedRef.current) return;

    if (source.error) {
      console.warn('[useLiveScores]', source.error);
      setGames([]);
      setError(FRIENDLY_ERROR);
      setLoading(false);
      return;
    }

    setGames(source.games);
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

    const unsubscribe = subscribeGamesChanges('games_discovery', () => {
      void refresh(false);
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [refresh]);

  const visibleGames = useMemo(
    () => games.filter((game) => gameMatchesQuery(game, query)),
    [games, query],
  );

  return { games, visibleGames, query, setQuery, loading, error, refresh };
}
