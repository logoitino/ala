/**
 * Loads the Highlights clips with loading / error state and a manual `refresh`.
 * Wraps `fetchReels` (lib/reels.ts); shows a readable message when Supabase env vars are missing and ignores
 * results from superseded or unmounted reads. Reads keep caption receipts confirmed while pending.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchReels, type ReelHype } from '@/lib/reels';
import { applyReelCaptionChange, subscribeReelCaptionChanges, trackReelCaptionRead } from '@/lib/postCaptions';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { ReelWithPlayer } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

export function useReels() {
  const mountedRef = useRef(true);
  const activeRead = useRef<ReturnType<typeof trackReelCaptionRead> | null>(null);
  const [reels, setReels] = useState<ReelWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    activeRead.current?.close();
    activeRead.current = null;
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setReels([]);
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const read = trackReelCaptionRead();
    activeRead.current = read;
    const current = () => mountedRef.current && activeRead.current === read;
    try {
      const rows = await fetchReels();
      if (current()) setReels(read.reconcile(rows));
    } catch (caught) {
      if (current()) setError(caught instanceof Error ? caught.message : 'Could not load uploaded clips.');
    } finally {
      read.close();
      if (current()) {
        activeRead.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
      activeRead.current?.close();
      activeRead.current = null;
    };
  }, [refresh]);

  useEffect(() => subscribeReelCaptionChanges(change =>
    setReels(rows => applyReelCaptionChange(rows, change))), []);

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
