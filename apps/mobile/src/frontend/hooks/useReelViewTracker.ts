import { useEffect, useRef } from 'react';

import { rememberFeedViewTouch } from '@/lib/feedPrefs';
import { recordReelView, VIEW_PLAY_MS } from '@/lib/leaderboards';

export type ReelViewMeta = {
  athleteId?: string | null;
  school?: string | null;
  sport?: string | null;
};

/**
 * @purpose Count a Highlight view once the clip has actually **played** for `thresholdMs`
 *   (3 s, or 90% of a shorter clip — `viewThresholdMs`). Played time adds up across pauses and
 *   buffering on the same clip; swiping to another clip starts again from zero.
 * @param reelId Clip id (`null` when nothing is on screen).
 * @param signedIn Views are signed-in only; guests never send.
 * @param playing True only while the video is really playing on screen (focused, not locked, not
 *   buffering, app in the foreground).
 * @param thresholdMs Played ms that make a view.
 * @param meta Optional athlete/school/sport for on-device Phase 2 ranking (never uploaded for ads).
 * @sideEffects `recordReelView` (fire-and-forget `record_reel_view` RPC, once per clip per session);
 *   AsyncStorage view touch for FEED-01 Phase 2 when counsel flag later turns on.
 */
export function useReelViewTracker(
  reelId: string | null | undefined,
  signedIn: boolean,
  playing = true,
  thresholdMs: number = VIEW_PLAY_MS,
  meta?: ReelViewMeta | null,
) {
  const playedMs = useRef(0);
  const counted = useRef(false);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    playedMs.current = 0;
    counted.current = false;
  }, [reelId]);

  useEffect(() => {
    if (!reelId || !signedIn || !playing || counted.current) return;
    const startedAt = Date.now();
    const timer = setTimeout(
      () => {
        counted.current = true;
        recordReelView(reelId, signedIn);
        const touch = metaRef.current;
        void rememberFeedViewTouch({
          clipId: reelId,
          athleteId: touch?.athleteId,
          school: touch?.school,
          sport: touch?.sport,
          atMs: Date.now(),
        });
      },
      Math.max(0, thresholdMs - playedMs.current),
    );
    return () => {
      clearTimeout(timer);
      if (!counted.current) playedMs.current += Date.now() - startedAt;
    };
  }, [reelId, signedIn, playing, thresholdMs]);
}
