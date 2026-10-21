/**
 * Local tab scoreboard: active games, kept current over Realtime, filtered by a ZIP / school search. Database reads and
 * the live channels go through `lib/liveGames`; the merge and refetch decisions live in `lib/liveScoreSync`.
 * SCALE-03 (2026-10-18): with `EXPO_PUBLIC_LIVE_SCORES_BROADCAST=true` each listed game is followed on its own private
 * Broadcast topic and a score change is merged in place. With the switch off (the default), or when the database
 * refuses the topic (migration not applied), it keeps the earlier behaviour: any `games` change rereads the list.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { gameMatchesQuery } from '@/data/players';
import {
  fetchDiscoveryGames,
  isLiveScoresBroadcastEnabled,
  subscribeGamesChanges,
  subscribeScoreTopic,
} from '@/lib/liveGames';
import { createLiveScoreSync, type LiveScoreSyncMode } from '@/lib/liveScoreSync';
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
 * @returns `{ games, visibleGames, query, setQuery, loading, error, refresh, liveMode }`. `liveMode` says whether
 *   per-game Broadcast or the earlier refetch path is running.
 * @sideEffects Supabase SELECT; Realtime private Broadcast `game_scores_*` (switch on) or `postgres_changes` on
 *   `games` (switch off / fallback). Every channel is removed on unmount.
 */
export function useLiveScores() {
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState<LiveScoreSyncMode>('legacy');
  const syncRef = useRef<ReturnType<typeof createLiveScoreSync> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('[useLiveScores]', CONFIG_ERROR);
      setGames([]);
      setError(FRIENDLY_ERROR);
      setLoading(false);
      return;
    }

    const sync = createLiveScoreSync({
      broadcastEnabled: isLiveScoresBroadcastEnabled(),
      fetchGames: fetchDiscoveryGames,
      subscribeTopic: subscribeScoreTopic,
      subscribeLegacy: (onChange) => subscribeGamesChanges('games_discovery', onChange),
      onState: (snapshot) => {
        if (snapshot.error) console.warn('[useLiveScores]', snapshot.error);
        setGames(snapshot.games);
        setLoading(snapshot.loading);
        setError(snapshot.error ? FRIENDLY_ERROR : null);
        setLiveMode(snapshot.mode);
      },
    });
    syncRef.current = sync;
    sync.start();
    return () => {
      syncRef.current = null;
      sync.stop();
    };
  }, []);

  const refresh = useCallback(async (showSpinner = true) => {
    await syncRef.current?.refresh(showSpinner);
  }, []);

  const visibleGames = useMemo(
    () => games.filter((game) => gameMatchesQuery(game, query)),
    [games, query],
  );

  return { games, visibleGames, query, setQuery, loading, error, refresh, liveMode };
}
