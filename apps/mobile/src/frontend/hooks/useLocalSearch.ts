/**
 * Debounced search for the Local tab (athletes, schools, games) plus the "recent searches" list.
 * `useLocalSearch` queries Supabase after a short pause in typing; `useRecentLocalSearches` keeps the last few
 * searches in AsyncStorage on the device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { LocalSearchHit, LocalSearchKind } from '@/types/database';

const RECENT_KEY = 'tapuai.localSearchRecent';
const RECENT_LIMIT = 6;
const DEBOUNCE_MS = 180;

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseHit(row: Record<string, unknown>): LocalSearchHit | null {
  const entity_type = asText(row.entity_type);
  const entity_id = asText(row.entity_id);
  const title = asText(row.title);
  if (!entity_id || !title) return null;
  if (entity_type !== 'athlete' && entity_type !== 'school' && entity_type !== 'booster') return null;
  return {
    entity_type,
    entity_id,
    title,
    subtitle: asText(row.subtitle),
  };
}

function parseHits(rows: unknown): LocalSearchHit[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (row && typeof row === 'object' ? parseHit(row as Record<string, unknown>) : null))
    .filter((row): row is LocalSearchHit => Boolean(row));
}

function ilikeSafe(raw: string): string {
  return raw.replace(/[\\%_,]/g, ' ').trim();
}

async function fallbackSearch(needle: string, kind: LocalSearchKind): Promise<LocalSearchHit[]> {
  const pattern = `%${ilikeSafe(needle)}%`;
  const hits: LocalSearchHit[] = [];

  if (kind === 'all' || kind === 'athlete') {
    const { data } = await supabase
      .from('players')
      .select('id, name, school_name, team')
      .or(`name.ilike.${pattern},school_name.ilike.${pattern}`)
      .limit(20);
    for (const row of data ?? []) {
      const id = asText(row.id);
      const title = asText(row.name);
      if (!id || !title) continue;
      hits.push({
        entity_type: 'athlete',
        entity_id: id,
        title,
        subtitle: asText(row.school_name) || asText(row.team),
      });
    }
  }

  if (kind === 'all' || kind === 'school') {
    const { data } = await supabase.from('games').select('home_school, away_school, home_team, away_team').limit(80);
    const seen = new Set<string>();
    for (const row of data ?? []) {
      for (const raw of [row.home_school, row.away_school, row.home_team, row.away_team]) {
        const title = asText(raw);
        const key = title.toLowerCase();
        if (!title || seen.has(key) || !key.includes(ilikeSafe(needle).toLowerCase())) continue;
        seen.add(key);
        hits.push({ entity_type: 'school', entity_id: title, title, subtitle: 'High school' });
      }
    }
  }

  if (kind === 'all' || kind === 'booster') {
    const { data } = await supabase
      .from('sponsorships')
      .select('id, business_name, school_team')
      .or(`business_name.ilike.${pattern},school_team.ilike.${pattern}`)
      .limit(20);
    for (const row of data ?? []) {
      const id = asText(row.id);
      const title = asText(row.business_name);
      if (!id || !title) continue;
      hits.push({
        entity_type: 'booster',
        entity_id: id,
        title,
        subtitle: asText(row.school_team),
      });
    }
  }

  return hits;
}

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
        const rpc = await supabase.rpc('search_local_entities', {
          search_query: needle,
          entity_kind: kind,
        });
        let rows: LocalSearchHit[] = [];
        if (!rpc.error) {
          rows = parseHits(rpc.data);
        } else {
          try {
            rows = await fallbackSearch(needle, kind);
          } catch {
            rows = [];
          }
        }
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
