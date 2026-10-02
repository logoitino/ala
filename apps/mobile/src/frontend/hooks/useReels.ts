/**
 * Loads the Highlights clips with loading / error state and a manual `refresh`.
 * Wraps `fetchReels` (lib/reels.ts); shows a readable message when Supabase env vars are missing and ignores
 * results that arrive after the screen unmounted.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchReels, type ReelHype } from '@/lib/reels';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { ReelWithPlayer } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export function useReels() {
  const mountedRef = useRef(true);
  const [reels, setReels] = useState<ReelWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setReels([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    try {
      const rows = await fetchReels();
      if (!mountedRef.current) return;
      setReels(rows);
    } catch (caught) {
      if (!mountedRef.current) return;
      setError(caught instanceof Error ? caught.message : 'Could not load uploaded clips.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const applyReelHype = useCallback((reelId: string, hype: ReelHype) => {
    setReels((current) =>
      current.map((reel) =>
        reel.id === reelId
          ? {
              ...reel,
              seki_count: hype.seki_count,
              aura_count: hype.aura_count,
              flex_count: hype.flex_count,
              total_tips_cents: hype.total_tips_cents,
            }
          : reel,
      ),
    );
  }, []);

  const applyReelTips = useCallback((reelId: string, addCents: number) => {
    setReels((current) =>
      current.map((reel) =>
        reel.id === reelId
          ? { ...reel, total_tips_cents: (reel.total_tips_cents ?? 0) + addCents }
          : reel,
      ),
    );
  }, []);

  return { reels, loading, error, refresh, setReels, applyReelHype, applyReelTips };
}
