/**
 * FEED-01: signed-in Highlights interest picks + personalization toggle.
 * Guests never load prefs. Phase 2 on-device signals load only when the counsel flag is on.
 * @sideEffects `user_feed_prefs` reads/writes; AsyncStorage first-run + optional Phase 2 touches.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  feedImplicitSignalsEnabled,
  type ImplicitFeedSignals,
  type UserFeedPrefs,
} from '@/data/highlights';
import { useAuth } from '@/context/AuthContext';
import {
  EMPTY_PREFS,
  fetchFeedPrefs,
  markFeedPicksPrompted,
  notifyFeedPrefsChanged,
  readFeedHideDemotions,
  readFeedPicksPrompted,
  readFeedSaveTouches,
  readFeedViewTouches,
  saveFeedPrefs,
  subscribeFeedPrefs,
} from '@/lib/feedPrefs';

/**
 * @purpose Load / save the viewer's Highlights picks for Home ranking.
 * @returns Prefs, availability, first-run prompt flag, save helpers, optional Phase 2 signals.
 * @sideEffects Supabase `user_feed_prefs`; AsyncStorage prompt + view/hide maps; optional `saved_reels` list when Phase 2 is on.
 */
export function useFeedPrefs() {
  const { user, isGuest } = useAuth();
  const userId = isGuest ? null : user?.id ?? null;
  const [prefs, setPrefs] = useState<UserFeedPrefs>(EMPTY_PREFS);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [implicit, setImplicit] = useState<ImplicitFeedSignals | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setPrefs(EMPTY_PREFS);
      setAvailable(false);
      setLoading(false);
      setPromptOpen(false);
      setImplicit(null);
      return;
    }
    setLoading(true);
    const result = await fetchFeedPrefs(userId);
    setPrefs(result.prefs);
    setAvailable(result.available);
    setError(result.error);
    setLoading(false);
    const prompted = await readFeedPicksPrompted();
    const emptyPicks =
      result.prefs.sports.length === 0 &&
      result.prefs.schools.length === 0 &&
      result.prefs.categoryPref === 'all';
    setPromptOpen(result.available && !prompted && emptyPicks);

    if (feedImplicitSignalsEnabled()) {
      const [views, saves, demoted] = await Promise.all([
        readFeedViewTouches(),
        readFeedSaveTouches(),
        readFeedHideDemotions(),
      ]);
      const toTouch = (row: { athleteId?: string | null; school?: string | null; sport?: string | null; atMs: number }) => ({
        athleteId: row.athleteId,
        school: row.school,
        sport: row.sport,
        atMs: row.atMs,
      });
      setImplicit({
        views: views.map(toTouch),
        saves: saves.map(toTouch),
        demotedAthletes: demoted,
        completedClipIds: new Set(views.map((row) => row.clipId).filter(Boolean) as string[]),
      });
    } else {
      setImplicit(null);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Profile Settings and Home each mount their own hook; broadcast keeps Home ranking current after a save.
  useEffect(() => subscribeFeedPrefs(() => {
    void refresh();
  }), [refresh]);

  const save = useCallback(
    async (next: UserFeedPrefs) => {
      if (!userId) return { prefs: next, error: 'Sign in to save Highlights picks.' };
      const result = await saveFeedPrefs(userId, next);
      if (!result.error) {
        setPrefs(result.prefs);
        setAvailable(true);
        await markFeedPicksPrompted();
        setPromptOpen(false);
        notifyFeedPrefsChanged();
      }
      setError(result.error);
      return result;
    },
    [userId],
  );

  const skipPrompt = useCallback(async () => {
    await markFeedPicksPrompted();
    setPromptOpen(false);
    notifyFeedPrefsChanged();
  }, []);

  const setPersonalizationOn = useCallback(
    async (on: boolean) => {
      return save({ ...prefs, personalizationOn: on });
    },
    [prefs, save],
  );

  return useMemo(
    () => ({
      prefs,
      available,
      loading,
      error,
      promptOpen,
      implicit,
      refresh,
      save,
      skipPrompt,
      setPersonalizationOn,
      signedIn: Boolean(userId),
    }),
    [
      prefs,
      available,
      loading,
      error,
      promptOpen,
      implicit,
      refresh,
      save,
      skipPrompt,
      setPersonalizationOn,
      userId,
    ],
  );
}
