/**
 * Debounced search for the Local tab (athletes, schools, games) plus the "recent searches" list.
 * `useLocalSearch` queries `lib/localSearch` after a short pause in typing; `useRecentLocalSearches` keeps the last few
 * searches in AsyncStorage on the device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { searchLocalEntities } from '@/lib/localSearch';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { LocalSearchHit, LocalSearchKind } from '@/types/database';

const RECENT_KEY = 'tapuai.localSearchRecent';
const RECENT_LIMIT = 6;
const DEBOUNCE_MS = 180;

/**
 * @purpose Debounced Local Explore search via `search_local_entities`, with a table SELECT fallback.
 * @param searchQuery Header `TextInput` value; RPC runs when trimmed length is greater than 1.
 * @param kind Segment chip: `all` / `athlete` / `school` / `booster`.
 * @returns `{ hits, loading }` for the results drawer.
 * @sideEffects Supabase RPC `search_local_entities(search_query, entity_kind)`; fallback `players` / `games` / `sponsorships` SELECTs.
 */
export function useLocalSearch(searchQuery: string, kind: LocalSearchKind) {
  const [hits, setHits] = useState<LocalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const needle = searchQuery.trim();
    if (needle.length <= 1 || !isSupabaseConfigured) {
      setHits([]);
      setLoading(false);
      return;
    }

    const requestId = seq.current + 1;
    seq.current = requestId;
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        const rows = await searchLocalEntities(needle, kind);
        if (seq.current !== requestId) return;
        setHits(rows);
        setLoading(false);
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [kind, searchQuery]);

  return { hits, loading };
}

/**
 * @purpose Persist recent Local Explore queries for the results drawer chips.
 * @returns `{ recent, remember, clearRecent }`.
 * @sideEffects AsyncStorage `tapuai.localSearchRecent`.
 */
export function useRecentLocalSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    void AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        setRecent(parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 1).slice(0, RECENT_LIMIT));
      } catch {
        // Ignore corrupt cache.
      }
    });
  }, []);

  const remember = useCallback(async (query: string) => {
    const needle = query.trim();
    if (needle.length <= 1) return;
    setRecent((current) => {
      const next = [needle, ...current.filter((item) => item.toLowerCase() !== needle.toLowerCase())].slice(
        0,
        RECENT_LIMIT,
      );
      void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecent = useCallback(async () => {
    setRecent([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }, []);

  return { recent, remember, clearRecent };
}
