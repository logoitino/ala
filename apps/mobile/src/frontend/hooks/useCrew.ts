/** Crew graph and follow callbacks belong to one account/athlete lifetime; delayed results never enter a new profile. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchCrewGraph, setCrewFollow, type CrewGraph } from '@/lib/crew';
import { createOfflineActorClient } from '@/lib/offlineActor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { offlineQueue } from '@/services/OfflineQueue';
const EMPTY: CrewGraph = { crew_count: 0, squad_count: 0, following: false, mutual: false };
/** @purpose The current fan's Crew/Squad flags and guarded join/leave actions on one athlete. */
export function useCrew(athleteId: string | undefined) {
  const { user, isSessionCurrent } = useAuth();
  const identity = `${user?.id ?? 'guest'}/${athleteId ?? ''}`;
  const lifetime = useRef({ identity, guard: isSessionCurrent, generation: 0 });
  if (lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) lifetime.current = { identity, guard: isSessionCurrent, generation: lifetime.current.generation + 1 };
  const generation = lifetime.current.generation;
  const request = useRef(0), inFlight = useRef<number | null>(null);
  const [view, setView] = useState({ generation, graph: EMPTY, loading: Boolean(athleteId), busy: false });
  const currentView = view.generation === generation ? view : { generation, graph: EMPTY, loading: Boolean(athleteId), busy: false };
  const refresh = useCallback(async () => {
    if (lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) return;
    const captured = lifetime.current.generation, id = ++request.current;
    const actor = user?.id ? offlineQueue.captureActor(user.id) : null;
    const current = () => lifetime.current.generation === captured && request.current === id && (!actor || actor.isCurrent());
    if (inFlight.current === captured) return;
    const publish = (graph: CrewGraph, loading = false) => { if (current()) setView({ generation: captured, graph, loading, busy: false }); };
    if (!athleteId) { publish(EMPTY); return; }
    publish(EMPTY, true);
    try {
      const client = actor && isSupabaseConfigured ? await createOfflineActorClient(actor) : undefined;
      if (!current()) return;
      const next = await fetchCrewGraph(athleteId, user?.id, client);
      publish(next);
    } catch { publish(EMPTY); }
  }, [athleteId, identity, isSessionCurrent, user?.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  const toggle = useCallback(async () => {
    if (!athleteId || !user?.id || lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) return null;
    const captured = lifetime.current.generation;
    if (inFlight.current === captured) return null;
    const actor = offlineQueue.captureActor(user.id);
    if (!actor) return null;
    const current = () => actor.isCurrent() && lifetime.current.generation === captured;
    const join = !currentView.graph.following;
    inFlight.current = captured; ++request.current;
    setView({ generation: captured, loading: false, busy: true, graph: { ...currentView.graph, following: join, mutual: join ? currentView.graph.mutual : false, crew_count: Math.max(0, currentView.graph.crew_count + (join ? 1 : -1)) } });
    try {
      const next = await setCrewFollow(athleteId, user.id, join, actor);
      if (!current()) return null;
      setView({ generation: captured, graph: next, loading: false, busy: false });
      return next;
    } catch {
      if (current()) { inFlight.current = null; await refresh(); }
      return null;
    } finally {
      if (inFlight.current === captured) inFlight.current = null;
      if (current()) setView(value => value.generation === captured ? { ...value, busy: false } : value);
    }
  }, [athleteId, currentView.graph, identity, isSessionCurrent, refresh, user?.id]);
  return { ...currentView.graph, loading: currentView.loading, busy: currentView.busy, refresh, toggle, signedIn: Boolean(user?.id) };
}
