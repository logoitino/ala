import { useEffect, useState } from 'react';

import { fetchSchoolBadge, type SchoolBadge } from '@/lib/schoolBadge';

/**
 * @purpose The school crest for an athlete sheet, or null until the school has confirmed them.
 * @param playerId `players.id` of the profile being viewed.
 * @sideEffects `athlete_school_badge` RPC when `playerId` changes.
 */
export function useSchoolBadge(playerId: string | null | undefined): SchoolBadge | null {
  const [badge, setBadge] = useState<SchoolBadge | null>(null);
  useEffect(() => {
    let live = true;
    setBadge(null);
    void fetchSchoolBadge(playerId).then((next) => {
      if (live) setBadge(next);
    });
    return () => {
      live = false;
    };
  }, [playerId]);
  return badge;
}
