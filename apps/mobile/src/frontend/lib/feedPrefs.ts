/**
 * FEED-01 Highlights interest picks: load/save `user_feed_prefs` for the signed-in owner only.
 * Used only to order Home. Never shared for ads. Missing migration reads as "not switched on".
 * Phase 2 AsyncStorage collectors write only when `feedImplicitSignalsEnabled()` is true.
 * @sideEffects Supabase SELECT/UPSERT on `user_feed_prefs`; AsyncStorage first-run prompt marker;
 *   optional Phase 2 view/save/hide maps; in-process prefs broadcast so Home and Profile stay in sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  feedImplicitSignalsEnabled,
  parseReelCategory,
  type FeedCategoryLean,
  type UserFeedPrefs,
} from '@/data/highlights';
import { isMissingRelation } from '@/lib/dbErrors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const PROMPT_KEY = 'tapuai.feedPicksPrompted';
const VIEW_TOUCHES_KEY = 'tapuai.feedViewTouches';
const SAVE_TOUCHES_KEY = 'tapuai.feedSaveTouches';
const HIDE_ATHLETES_KEY = 'tapuai.feedHideAthletes';

const EMPTY_PREFS: UserFeedPrefs = {
  sports: [],
  schools: [],
  categoryPref: 'all',
  personalizationOn: true,
};

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const row of value) {
    if (typeof row !== 'string') continue;
    const trimmed = row.trim();
    if (!trimmed || out.includes(trimmed)) continue;
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function asCategoryLean(value: unknown): FeedCategoryLean {
  if (value === 'all') return 'all';
  if (value === 'game_play' || value === 'train_like_me' || value === 'serve_like_me') return value;
  return parseReelCategory(value) === value ? (value as FeedCategoryLean) : 'all';
}

/**
 * @purpose Database row → screen prefs. Unknown values fall back to empty picks + personalization on.
 */
export function parseFeedPrefs(raw: unknown): UserFeedPrefs {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    sports: asStringList(row.sports, 3),
    schools: asStringList(row.schools, 3),
    categoryPref: asCategoryLean(row.category_pref),
    personalizationOn: row.personalization_on !== false,
  };
}

/**
 * @purpose Load the signed-in owner's Highlights picks.
 * @returns Prefs, or empty defaults when missing / migration not applied / guest.
 * @sideEffects SELECT `user_feed_prefs`.
 */
export async function fetchFeedPrefs(userId: string | null | undefined): Promise<{
  prefs: UserFeedPrefs;
  available: boolean;
  error: string | null;
}> {
  if (!userId || !isSupabaseConfigured) {
    return { prefs: EMPTY_PREFS, available: false, error: null };
  }
  try {
    const { data, error } = await supabase.from('user_feed_prefs').select('*').eq('user_id', userId).maybeSingle();
    if (error) {
      if (isMissingRelation(error)) {
        return { prefs: EMPTY_PREFS, available: false, error: null };
      }
      return { prefs: EMPTY_PREFS, available: false, error: error.message };
    }
    if (!data) return { prefs: EMPTY_PREFS, available: true, error: null };
    return { prefs: parseFeedPrefs(data), available: true, error: null };
  } catch (caught) {
    return {
      prefs: EMPTY_PREFS,
      available: false,
      error: caught instanceof Error ? caught.message : 'Could not load Highlights picks.',
    };
  }
}

/**
 * @purpose Upsert the owner's Highlights picks (max 3 sports / 3 schools).
 * @sideEffects UPSERT `user_feed_prefs`.
 */
export async function saveFeedPrefs(
  userId: string,
  next: UserFeedPrefs,
): Promise<{ prefs: UserFeedPrefs; error: string | null }> {
  if (!isSupabaseConfigured) return { prefs: next, error: 'Supabase is not configured.' };
  const categoryPref: UserFeedPrefs['categoryPref'] =
    next.categoryPref === 'all' ||
    next.categoryPref === 'game_play' ||
    next.categoryPref === 'train_like_me' ||
    next.categoryPref === 'serve_like_me'
      ? next.categoryPref
      : 'all';
  const payload = {
    user_id: userId,
    sports: asStringList(next.sports, 3),
    schools: asStringList(next.schools, 3),
    category_pref: categoryPref,
    personalization_on: next.personalizationOn !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('user_feed_prefs')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) {
      return { prefs: next, error: 'Highlights picks are not available on this database yet.' };
    }
    return { prefs: next, error: error.message };
  }
  return { prefs: parseFeedPrefs(data ?? payload), error: null };
}

/** @purpose True when the first-run pick sheet has been finished or skipped on this device. */
export async function readFeedPicksPrompted(): Promise<boolean> {
  return (await AsyncStorage.getItem(PROMPT_KEY)) === '1';
}

/** @purpose Mark the first-run pick sheet as done (Save or Not now). */
export async function markFeedPicksPrompted(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_KEY, '1');
}

export type StoredFeedTouch = {
  athleteId?: string | null;
  school?: string | null;
  sport?: string | null;
  atMs: number;
  clipId?: string;
};

/**
 * @purpose Append a completed-view touch for Phase 2 (on-device only; never uploaded as a ranking table).
 * No-ops while `EXPO_PUBLIC_FEED_IMPLICIT_SIGNALS` is off — counsel gate before any collection.
 */
export async function rememberFeedViewTouch(touch: StoredFeedTouch): Promise<void> {
  if (!feedImplicitSignalsEnabled()) return;
  const raw = await AsyncStorage.getItem(VIEW_TOUCHES_KEY);
  let list: StoredFeedTouch[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) list = parsed as StoredFeedTouch[];
  } catch {
    list = [];
  }
  const next = [touch, ...list.filter((row) => row.clipId !== touch.clipId)].slice(0, 200);
  await AsyncStorage.setItem(VIEW_TOUCHES_KEY, JSON.stringify(next));
}

/** @purpose Read on-device view touches for Phase 2 ranking. */
export async function readFeedViewTouches(): Promise<StoredFeedTouch[]> {
  const raw = await AsyncStorage.getItem(VIEW_TOUCHES_KEY);
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as StoredFeedTouch[]) : [];
  } catch {
    return [];
  }
}

/**
 * @purpose Record a Save for Phase 2 (strongest implicit signal). On-device only; never uploaded for ads.
 * No-ops while the Phase 2 counsel flag is off — collection stays gated with ranking.
 */
export async function rememberFeedSaveTouch(touch: StoredFeedTouch): Promise<void> {
  if (!feedImplicitSignalsEnabled()) return;
  const raw = await AsyncStorage.getItem(SAVE_TOUCHES_KEY);
  let list: StoredFeedTouch[] = [];
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) list = parsed as StoredFeedTouch[];
  } catch {
    list = [];
  }
  const next = [touch, ...list.filter((row) => row.clipId !== touch.clipId)].slice(0, 200);
  await AsyncStorage.setItem(SAVE_TOUCHES_KEY, JSON.stringify(next));
}

/** @purpose Read on-device save touches for Phase 2 ranking. */
export async function readFeedSaveTouches(): Promise<StoredFeedTouch[]> {
  const raw = await AsyncStorage.getItem(SAVE_TOUCHES_KEY);
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as StoredFeedTouch[]) : [];
  } catch {
    return [];
  }
}

/**
 * @purpose Count a local hide against an athlete for Phase 2 demotion (2+ hides → −50 for 30 days).
 * No-ops while the Phase 2 counsel flag is off. Hide-from-feed itself stays on `tapuai.hiddenReels`.
 */
export async function rememberFeedHideAthlete(athleteId: string | null | undefined): Promise<void> {
  if (!feedImplicitSignalsEnabled()) return;
  const id = athleteId?.trim();
  if (!id) return;
  const raw = await AsyncStorage.getItem(HIDE_ATHLETES_KEY);
  let map: Record<string, { count: number; untilMs: number }> = {};
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (parsed && typeof parsed === 'object') map = parsed as typeof map;
  } catch {
    map = {};
  }
  const now = Date.now();
  const current = map[id];
  const count = (current?.count ?? 0) + 1;
  map[id] = {
    count,
    untilMs: count >= 2 ? now + 30 * 24 * 3_600_000 : current?.untilMs ?? 0,
  };
  await AsyncStorage.setItem(HIDE_ATHLETES_KEY, JSON.stringify(map));
}

/** @purpose Athlete demotion map for Phase 2 (id → untilMs). */
export async function readFeedHideDemotions(): Promise<Map<string, number>> {
  const raw = await AsyncStorage.getItem(HIDE_ATHLETES_KEY);
  const out = new Map<string, number>();
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, { untilMs?: number }>) : {};
    for (const [id, row] of Object.entries(parsed ?? {})) {
      if (typeof row?.untilMs === 'number' && row.untilMs > Date.now()) out.set(id, row.untilMs);
    }
  } catch {
    return out;
  }
  return out;
}

type FeedPrefsListener = () => void;
const feedPrefsListeners = new Set<FeedPrefsListener>();

/**
 * @purpose Subscribe every mounted `useFeedPrefs` so a Settings save refreshes Home without remount.
 */
export function subscribeFeedPrefs(listener: FeedPrefsListener): () => void {
  feedPrefsListeners.add(listener);
  return () => {
    feedPrefsListeners.delete(listener);
  };
}

/** @purpose Notify other screens after a successful prefs upsert (or skip). */
export function notifyFeedPrefsChanged(): void {
  for (const listener of feedPrefsListeners) listener();
}

export { EMPTY_PREFS };
