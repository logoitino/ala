import { useEffect } from 'react';

import { recordReelView, VIEW_DWELL_MS } from '@/lib/leaderboards';

/**
 * @purpose Count a Highlight view once it has been the active, playing clip for `VIEW_DWELL_MS` (M1 most-viewed boards).
 * @param reelId Active clip id (`null` when nothing is on screen).
 * @param signedIn Views are signed-in only; guests never send.
 * @param active False while the feed is blurred, paused behind a sheet, or backgrounded — the timer restarts when it comes back.
 * @sideEffects `recordReelView` (fire-and-forget `record_reel_view` RPC, once per clip per session).
 */
export function useReelViewTracker(reelId: string | null | undefined, signedIn: boolean, active = true) {
  useEffect(() => {
    if (!reelId || !signedIn || !active) return;
    const timer = setTimeout(() => {
      recordReelView(reelId, signedIn);
    }, VIEW_DWELL_MS);
    return () => clearTimeout(timer);
  }, [reelId, signedIn, active]);
}
