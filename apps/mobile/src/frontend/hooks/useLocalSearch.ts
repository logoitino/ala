/**
 * Debounced search for the Local tab (athletes, schools, games) plus the shared recent searches list.
 * `useLocalSearch` queries `lib/localSearch` after a short pause in typing; `useRecentLocalSearches` keeps the last few
 * searches in AsyncStorage on the device. Every new search hides superseded results immediately.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore } from 'react';

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
  const needle = searchQuery.trim();
  const enabled = needle.length > 1 && isSupabaseConfigured;
  const [settled, setSettled] = useState<{ needle: string; kind: LocalSearchKind; rows: LocalSearchHit[] } | null>(null);

  useEffect(() => {
    setSettled(null);
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => {
      void searchLocalEntities(needle, kind).then(
        rows => { if (current) setSettled({ needle, kind, rows }); },
        () => { if (current) setSettled({ needle, kind, rows: EMPTY_HITS }); },
      );
    }, DEBOUNCE_MS);
    return () => { current = false; clearTimeout(timer); };
  }, [enabled, kind, needle]);

  const matches = enabled && settled?.needle === needle && settled.kind === kind;
  return { hits: matches ? settled.rows : EMPTY_HITS, loading: enabled && !matches };
}

const EMPTY_HITS: LocalSearchHit[] = [];
const EMPTY_RECENT: string[] = [];
let recent = EMPTY_RECENT;
let hydration: Promise<void> | undefined;
let clearVersion = 0;
let writes = Promise.resolve();
const listeners = new Set<() => void>();

function publish(items: string[]) {
  recent = items;
  for (const listener of listeners) listener();
}

function hydrateRecent() {
  const version = clearVersion;
  return hydration ??= AsyncStorage.getItem(RECENT_KEY).then(raw => {
    if (!raw || version !== clearVersion) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const seen = new Set<string>();
    const items: string[] = [];
    for (const value of parsed) {
      if (typeof value !== 'string') continue;
      const item = value.trim();
      if (item.length < 2 || seen.has(item.toLowerCase())) continue;
      items.push(item);
      seen.add(item.toLowerCase());
      if (items.length === RECENT_LIMIT) break;
    }
    publish(items);
  }).catch(() => { /* Recents are optional; search still works. */ });
}

function subscribeRecent(listener: () => void) {
  listeners.add(listener);
  void hydrateRecent();
  return () => { listeners.delete(listener); };
}

function writeRecent(write: () => Promise<void>) {
  writes = writes.then(write).catch(() => { /* Keep the current in-memory list when storage is unavailable. */ });
  return writes;
}

async function remember(query: string) {
  const needle = query.trim();
  if (needle.length <= 1) return;
  const version = clearVersion;
  await hydrateRecent();
  if (version !== clearVersion) return;
  const items = [needle, ...recent.filter(item => item.toLowerCase() !== needle.toLowerCase())].slice(0, RECENT_LIMIT);
  publish(items);
  return writeRecent(() => AsyncStorage.setItem(RECENT_KEY, JSON.stringify(items)));
}

function clearRecent() {
  ++clearVersion;
  hydration ??= Promise.resolve();
  publish(EMPTY_RECENT);
  return writeRecent(() => AsyncStorage.removeItem(RECENT_KEY));
}

const getRecent = () => recent;
const getServerRecent = () => EMPTY_RECENT;

/**
 * @purpose Persist recent Local Explore queries for the results drawer rows.
 * @returns `{ recent, remember, clearRecent }`.
 * @sideEffects AsyncStorage `tapuai.localSearchRecent`.
 */
export function useRecentLocalSearches() {
  return { recent: useSyncExternalStore(subscribeRecent, getRecent, getServerRecent), remember, clearRecent };
}
