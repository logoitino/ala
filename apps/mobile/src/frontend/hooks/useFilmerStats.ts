import { useCallback, useEffect, useState } from 'react';

import { fetchFilmerStats, type FilmerStats } from '@/lib/filmers';

/**
 * @purpose Lifetime filmer numbers for a profile (clips the athlete confirmed, views, hype, Props, Aura earned).
 * @param profileId `profiles.id` (same id as `reels.uploaded_by`). Nothing is fetched when empty.
 * @returns `{ stats, loading, refresh }`. `stats` stays null when the SQL is not applied.
 * @sideEffects `filmer_stats` RPC.
 */
export function useFilmerStats(profileId: string | null | undefined) {
  const [stats, setStats] = useState<FilmerStats | null>(null);
  const [loading, setLoading] = useState(Boolean(profileId));

  const refresh = useCallback(async () => {
    if (!profileId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await fetchFilmerStats(profileId);
    setStats(next);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    let alive = true;
    setStats(null);
    if (!profileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchFilmerStats(profileId).then((next) => {
      if (!alive) return;
      setStats(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [profileId]);

  return { stats, loading, refresh };
}
