import { useCallback, useEffect, useRef, useState } from 'react';

import {
  demoSpotlightAward,
  fetchActiveSpotlightAward,
  hydrateSpotlightPlayer,
  isSpotlightUnviewed,
  markSpotlightSeen,
} from '@/lib/spotlight';
import type { Player, SpotlightAward } from '@/types/database';

/**
 * @purpose On Highlights launch, load the current week/month Player of the Week if this fan has not dismissed it.
 * @param viewerUserId Active `auth.users.id` for `get_active_spotlight_award`. Guests pass null.
 * @param roster Live `players` used to hydrate Aura points and demo Mālo targets.
 * @param options.enabled When false (auth still loading), skip the RPC so guests and signed-in fans don't double-pop.
 * @returns `{ award, visible, loading, dismiss }` — `visible` is true only for an unviewed award.
 * @sideEffects RPC `get_active_spotlight_award`; AsyncStorage `tapuai.spotlightSeen.{awardId}`.
 */
export function useActiveSpotlight(
  viewerUserId?: string | null,
  roster: Player[] = [],
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled !== false;
  const mountedRef = useRef(true);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const [award, setAward] = useState<SpotlightAward | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const remote = await fetchActiveSpotlightAward(viewerUserId);
      const next = hydrateSpotlightPlayer(remote ?? demoSpotlightAward(rosterRef.current), rosterRef.current);
      const unviewed = await isSpotlightUnviewed(next.id);
      if (cancelled || !mountedRef.current) return;
      setAward(next);
      setVisible(unviewed);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, viewerUserId]);

  useEffect(() => {
    if (roster.length === 0) return;
    setAward((current) => (current ? hydrateSpotlightPlayer(current, rosterRef.current) : current));
  }, [roster.length]);

  const dismiss = useCallback(async () => {
    const id = award?.id;
    setVisible(false);
    if (!id) return;
    await markSpotlightSeen(id);
  }, [award?.id]);

  return { award, visible, loading, dismiss };
}
