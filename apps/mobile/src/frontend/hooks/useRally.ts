import { useCallback, useEffect, useState } from 'react';

import { fetchActiveRally, fetchPlayerRallies, type Rally } from '@/lib/rallies';

/**
 * @purpose An athlete's Rally goal. Fans get the open (or recently filled) Rally; with `manage` the
 *   athlete / guardian also gets every Rally they can manage, including one waiting for approval.
 * @param playerId `players.id`. Nothing is fetched when empty.
 * @returns `{ rally, mine, available, loading, refresh }`. `rally` is what fans see; `mine` is newest-first;
 *   `available` is false (with `manage`) until the SQL is applied or when the caller can't manage this athlete.
 * @sideEffects `get_active_rally`, plus `get_player_rallies` when `manage`.
 */
export function useRally(playerId: string | null | undefined, manage = false) {
  const [rally, setRally] = useState<Rally | null>(null);
  const [mine, setMine] = useState<Rally[]>([]);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(Boolean(playerId));

  const load = useCallback(async () => {
    if (!playerId) return { active: null, managed: null };
    const [active, managed] = await Promise.all([
      fetchActiveRally(playerId),
      manage ? fetchPlayerRallies(playerId) : Promise.resolve(null),
    ]);
    return { active, managed };
  }, [manage, playerId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await load();
    setRally(next.active);
    setMine(next.managed ?? []);
    setAvailable(next.managed !== null);
    setLoading(false);
  }, [load]);

  useEffect(() => {
    let alive = true;
    setRally(null);
    setMine([]);
    setAvailable(false);
    if (!playerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load().then((next) => {
      if (!alive) return;
      setRally(next.active);
      setMine(next.managed ?? []);
      setAvailable(next.managed !== null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [load, playerId]);

  return { rally, mine, available, loading, refresh };
}
