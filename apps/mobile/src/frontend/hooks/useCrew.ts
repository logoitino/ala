/** Crew load failures remain retryable; guest Join resumes once for the same mounted athlete. Crew graph and follow callbacks belong to one account/athlete lifetime; delayed results never enter a new profile. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchCrewGraph, setCrewFollow, type CrewGraph } from '@/lib/crew';
import { createOfflineActorClient, type OfflineActor } from '@/lib/offlineActor';
import { isSupabaseConfigured } from '@/lib/supabase';
import { offlineQueue } from '@/services/OfflineQueue';
const EMPTY: CrewGraph = { crew_count: 0, squad_count: 0, following: false, mutual: false };
/** @purpose The current fan's Crew/Squad flags and guarded join/leave actions on one athlete. */
export function useCrew(athleteId: string | undefined) {
  const { user, isSessionCurrent } = useAuth();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const target = useRef({ athleteId });
  if (target.current.athleteId !== athleteId) target.current = { athleteId };
  const capturedTarget = target.current;
  const pendingGuestJoin = useRef<{ target: typeof capturedTarget; actor: OfflineActor; guard?: typeof isSessionCurrent } | null>(null);
  const identity = `${user?.id ?? 'guest'}/${athleteId ?? ''}`;
  const lifetime = useRef({ identity, guard: isSessionCurrent, generation: 0 });
  if (lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) lifetime.current = { identity, guard: isSessionCurrent, generation: lifetime.current.generation + 1 };
  const generation = lifetime.current.generation;
  const request = useRef(0), inFlight = useRef<number | null>(null);
  const [view, setView] = useState({ generation, graph: EMPTY, loading: Boolean(athleteId), busy: false, error: null as string | null });
  const currentView = view.generation === generation && (isSessionCurrent?.() ?? true) ? view : { generation, graph: EMPTY, loading: Boolean(athleteId), busy: false, error: null };
  const refresh = useCallback(async () => {
    if (!mounted.current || !(isSessionCurrent?.() ?? true) || lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) return;
    const captured = lifetime.current.generation, id = ++request.current;
    const actor = user?.id ? offlineQueue.captureActor(user.id) : null;
    const current = () => mounted.current && (isSessionCurrent?.() ?? true) && lifetime.current.generation === captured && request.current === id && (!actor || actor.isCurrent());
    if (inFlight.current === captured) return;
    const publish = (graph: CrewGraph, loading = false, error: string | null = null) => { if (current()) setView({ generation: captured, graph, loading, busy: false, error }); };
    if (!athleteId) { publish(EMPTY); return; }
    if (user?.id && !actor) { publish(EMPTY, false, 'Your account changed. Reopen Crew.'); return; }
    publish(EMPTY, true);
    try {
      const client = actor && isSupabaseConfigured ? await createOfflineActorClient(actor) : undefined;
      if (!current()) return;
      const next = await fetchCrewGraph(athleteId, user?.id, client);
      publish(next);
    } catch { publish(EMPTY, false, 'Could not load Crew. Check your connection and retry.'); }
  }, [athleteId, identity, isSessionCurrent, user?.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  const toggle = useCallback(async () => {
    if (!mounted.current || !(isSessionCurrent?.() ?? true) || currentView.loading || currentView.error || !athleteId || !user?.id || lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) return null;
    const captured = lifetime.current.generation;
    if (inFlight.current === captured) return null;
    const actor = offlineQueue.captureActor(user.id);
    if (!actor) return null;
    const current = () => mounted.current && actor.isCurrent() && lifetime.current.generation === captured;
    const join = !currentView.graph.following;
    inFlight.current = captured; ++request.current;
    setView({ generation: captured, loading: false, busy: true, error: null, graph: { ...currentView.graph, following: join, mutual: join ? currentView.graph.mutual : false, crew_count: Math.max(0, currentView.graph.crew_count + (join ? 1 : -1)) } });
    try {
      const next = await setCrewFollow(athleteId, user.id, join, actor);
      if (!current()) return null;
      setView({ generation: captured, graph: next, loading: false, busy: false, error: null });
      return next;
    } catch {
      if (current()) setView({ generation: captured, graph: currentView.graph, loading: false, busy: false, error: 'Could not update Crew. Retry before trying again.' });
      return null;
    } finally {
      if (inFlight.current === captured) inFlight.current = null;
      if (current()) setView(value => value.generation === captured ? { ...value, busy: false } : value);
    }
  }, [athleteId, currentView.graph, currentView.loading, currentView.error, identity, isSessionCurrent, refresh, user?.id]);
  const live = useRef({ user, isSessionCurrent, currentView, toggle });
  live.current = { user, isSessionCurrent, currentView, toggle };
  const drainGuestJoin = () => {
    const pending = pendingGuestJoin.current, latest = live.current;
    if (!pending) return;
    if (!mounted.current || target.current !== pending.target || !pending.target.athleteId || !pending.actor.isCurrent() || (latest.user?.id && latest.user.id !== pending.actor.userId)) { pendingGuestJoin.current = null; return; }
    // Soft-Wall can resume after queue binding but before the Auth consumer renders its first signed-in owner.
    if (!latest.user?.id) return;
    if (pending.guard && pending.guard !== latest.isSessionCurrent) { pendingGuestJoin.current = null; return; }
    if (!(latest.isSessionCurrent?.() ?? true)) { pendingGuestJoin.current = null; return; }
    pending.guard = latest.isSessionCurrent;
    if (latest.currentView.loading) return;
    pendingGuestJoin.current = null;
    if ((latest.isSessionCurrent?.() ?? true) && !latest.currentView.error && !latest.currentView.graph.following) void latest.toggle();
  };
  useEffect(drainGuestJoin, [user?.id, isSessionCurrent, currentView.loading, currentView.error, capturedTarget]);
  let resumed = false;
  const resumeGuestJoin = () => {
    if (resumed || user?.id || !mounted.current || target.current !== capturedTarget) return;
    const actor = offlineQueue.captureActor();
    if (!actor) return;
    resumed = true;
    pendingGuestJoin.current = { target: capturedTarget, actor };
    drainGuestJoin();
  };
  return { resumeGuestJoin, error: currentView.error, ...currentView.graph, loading: currentView.loading, busy: currentView.busy, refresh, toggle, signedIn: Boolean(user?.id) };
}
