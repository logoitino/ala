/**
 * The single Supabase client for the whole app.
 * Reads EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (apps/mobile/.env.local) and exports `supabase`
 * plus `isSupabaseConfigured`, which callers check before querying so a missing .env shows a readable error
 * instead of a crash. Auth sessions persist in AsyncStorage on device (an in-memory map where that is unavailable).
 * Only the anon key lives here; secret keys never belong in src/frontend.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl?.trim() && supabaseAnonKey?.trim(),
);

if (!isSupabaseConfigured) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart Expo.',
  );
}

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const memoryStore = new Map<string, string>();

const memoryStorage: AuthStorage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';

const webStorage: AuthStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

const authStorage: AuthStorage = isWebSSR
  ? memoryStorage
  : Platform.OS === 'web'
    ? webStorage
    : AsyncStorage;

export const supabase = createClient<Database>(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'public-anon-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: !isWebSSR,
      persistSession: !isWebSSR,
      detectSessionInUrl: false,
    },
  },
);

let realtimeTopicSeq = 0;

/**
 * @purpose Unique Realtime channel topic so two hooks in the same tick never reuse a subscribed socket.
 * @param prefix Stable label such as `live_game_{uuid}`.
 * @returns `{prefix}_{n}` that is unique for this JS runtime.
 */
export function nextRealtimeTopic(prefix: string): string {
  realtimeTopicSeq += 1;
  return `${prefix}_${realtimeTopicSeq}`;
}
