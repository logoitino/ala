import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { fetchCrewGraph, setCrewFollow, type CrewGraph } from '@/lib/crew';

const EMPTY: CrewGraph = { crew_count: 0, squad_count: 0, following: false, mutual: false };

/**
 * @purpose The Crew ⚡ / Your Squad 🛡️ counts and Join Crew / Teammates state for an athlete sheet.
 * @param athleteId Profile `players.id`.
 * @returns Counts, follow flags, `busy`, `refresh`, and `toggle` (join when not following, leave when already in Crew).
 * @sideEffects `get_crew_graph` / `toggle_crew_follow`; AsyncStorage follow flag.
 */
export function useCrew(athleteId: string | undefined) {
  const { user } = useAuth();
  const [graph, setGraph] = useState<CrewGraph>(EMPTY);
  const [loading, setLoading] = useState(Boolean(athleteId));
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!athleteId) {
      setGraph(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchCrewGraph(athleteId, user?.id);
      setGraph(next);
    } catch {
      setGraph(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [athleteId, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * @purpose Join the Crew when idle, leave when already following (including Teammates).
   */
  const toggle = useCallback(async () => {
    if (!athleteId || !user?.id || busy) return null;
    const join = !graph.following;
    setBusy(true);
    setGraph((current) => ({
      ...current,
      following: join,
      mutual: join ? current.mutual : false,
      crew_count: Math.max(0, current.crew_count + (join ? 1 : -1)),
    }));
    try {
      const next = await setCrewFollow(athleteId, user.id, join);
      setGraph(next);
      return next;
    } catch {
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }, [athleteId, busy, graph.following, refresh, user?.id]);

  return { ...graph, loading, busy, refresh, toggle, signedIn: Boolean(user?.id) };
}
