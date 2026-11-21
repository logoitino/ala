/** UX-13 masks private pending tags by Auth lifetime and binds review decisions to their initiating actor. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { offlineQueue } from '@/services/OfflineQueue';
import { assertCurrent, createOfflineActorClient, OfflineActorChangedError } from '@/lib/offlineActor';
import { confirmReelPlayerTag, fetchPendingPlayerTags } from '@/lib/tags';
import type { PendingPlayerTag } from '@/types/database';

/**
 * @purpose Pending That's me / That's our player queue for Athlete HQ, Parent, Operator, and Spotlight admin.
 * @returns Pending clips plus confirm / reject actions.
 * @sideEffects `get_pending_player_tags` on focus; `confirm_reel_player_tag` on action.
 */
export function usePendingPlayerTags() {
  const { user, isSessionCurrent } = useAuth();
  const userId = user?.id ?? null;
  const holder = useRef({ userId, guard: isSessionCurrent, active: false, read: 0, flight: null as object | null });
  if (holder.current.userId !== userId || holder.current.guard !== isSessionCurrent) {
    holder.current = { userId, guard: isSessionCurrent, active: false, read: 0, flight: null };
  }
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; scope.flight = null; }; }, [scope]);
  const [frame, setFrame] = useState<{ owner: typeof scope; tags: PendingPlayerTag[]; loading: boolean; error: string | null; busyId: string | null } | null>(null);
  const shown = frame?.owner === scope && current() ? frame : null;
  const refresh = useCallback(async () => {
    if (!current()) return;
    const read = ++scope.read;
    const actor = userId ? offlineQueue.captureActor(userId) : null;
    const accepted = () => current() && read === scope.read && (!userId || Boolean(actor?.isCurrent()));
    if (!userId) { setFrame({ owner: scope, tags: [], loading: false, error: null, busyId: null }); return; }
    if (!actor) return;
    setFrame(previous => ({ owner: scope, tags: previous?.owner === scope ? previous.tags : [], loading: true, error: null, busyId: previous?.owner === scope ? previous.busyId : null }));
    try {
      const tags = await fetchPendingPlayerTags();
      if (accepted()) setFrame(previous => ({ owner: scope, tags, loading: false, error: null, busyId: previous?.owner === scope ? previous.busyId : null }));
    } catch (caught) {
      if (accepted()) setFrame({ owner: scope, tags: [], loading: false, error: caught instanceof Error ? caught.message : 'Could not load pending tags.', busyId: null });
    }
  }, [current, scope, userId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const resolve = useCallback(async (reelId: string, action: 'confirm' | 'reject') => {
    if (!current()) throw new OfflineActorChangedError();
    const actor = userId ? offlineQueue.captureActor(userId) : null;
    if (!actor) throw new OfflineActorChangedError();
    if (scope.flight) throw new Error('A tag review is already in progress. Please wait.');
    const flight = {};
    scope.flight = flight;
    ++scope.read;
    setFrame(previous => previous?.owner === scope ? { ...previous, busyId: reelId, error: null, loading: false } : previous);
    try {
      const client = await createOfflineActorClient(actor);
      assertCurrent(actor);
      await confirmReelPlayerTag(reelId, action, client);
      assertCurrent(actor);
      if (!current()) throw new OfflineActorChangedError();
      setFrame(previous => previous?.owner === scope ? { ...previous, tags: previous.tags.filter(row => row.id !== reelId) } : previous);
    } catch (caught) {
      if (current() && actor.isCurrent()) setFrame(previous => previous?.owner === scope ? { ...previous, error: caught instanceof Error ? caught.message : 'Could not update that tag.' } : previous);
      throw caught;
    } finally {
      if (scope.flight === flight) {
        scope.flight = null;
        if (current()) setFrame(previous => previous?.owner === scope ? { ...previous, busyId: null } : previous);
      }
    }
  }, [current, scope, userId]);
  return { tags: shown?.tags ?? [], loading: shown?.loading ?? Boolean(userId), error: shown?.error ?? null, busyId: shown?.busyId ?? null, refresh, resolve };
}
