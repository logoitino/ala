/** UX-13 frames private donor/athlete thank-yous by Auth lifetime and binds decisions so outgoing work cannot revive or change another account’s gifts. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { assertCurrent, createOfflineActorClient } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import {
  fetchDonationsToThank,
  fetchMyDonationThanksResult,
  thankDonation,
  type DonationToThank,
  type ThankResult,
  type ThanksKey,
  type ThanksReceived,
} from '@/lib/donationThanks';

/**
 * @purpose Athlete / guardian side: recent donations and a `thank(tipId, key)` that marks the row
 *   thanked right away.
 * @param playerId `players.id`. Nothing is fetched when empty.
 * @sideEffects `get_donations_to_thank`, `thank_donation`.
 */
export function useDonationsToThank(playerId: string | null | undefined) {
  const { user, isSessionCurrent } = useAuth();
  const userId = user?.id ?? null;
  const holder = useRef({ userId, playerId, guard: isSessionCurrent, active: false, read: 0, flights: new Set<string>() });
  if (holder.current.userId !== userId || holder.current.playerId !== playerId || holder.current.guard !== isSessionCurrent) {
    holder.current = { userId, playerId, guard: isSessionCurrent, active: false, read: 0, flights: new Set<string>() };
  }
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; scope.flights.clear(); }; }, [scope]);
  const [frame, setFrame] = useState<{ owner: typeof scope; rows: DonationToThank[]; loading: boolean; error: string | null } | null>(null);
  const shown = frame?.owner === scope && current() ? frame : null;
  const refresh = useCallback(async () => {
    if (!current()) return;
    const read = ++scope.read;
    const actor = userId ? offlineQueue.captureActor(userId) : null;
    const accepted = () => current() && read === scope.read && Boolean(actor?.isCurrent());
    if (!userId || !playerId) { setFrame({ owner: scope, rows: [], loading: false, error: null }); return; }
    if (!actor) return;
    setFrame(previous => ({ owner: scope, rows: previous?.owner === scope ? previous.rows : [], loading: true, error: null }));
    try {
      const client = await createOfflineActorClient(actor);
      if (!accepted()) return;
      const rows = await fetchDonationsToThank(playerId, client);
      if (accepted()) setFrame({ owner: scope, rows, loading: false, error: null });
    } catch {
      if (accepted()) setFrame({ owner: scope, rows: [], loading: false, error: 'Could not load thank-you choices. Check your connection and retry.' });
    }
  }, [current, scope, playerId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const thank = useCallback(async (tipId: string, key: ThanksKey): Promise<ThankResult> => {
    const changed: ThankResult = { ok: false, message: 'Your account or athlete changed. Reopen the thank-you list.' };
    if (!current() || !userId || !playerId) return changed;
    const captured = offlineQueue.captureActor(userId);
    if (!captured) return changed;
    const actor = { userId: captured.userId, isCurrent: () => current() && captured.isCurrent() };
    if (scope.flights.has(tipId)) return { ok: false, message: 'This thank-you is already being sent.' };
    scope.flights.add(tipId);
    ++scope.read;
    try {
      const client = await createOfflineActorClient(actor);
      if (!current()) return changed;
      assertCurrent(actor);
      const result = await thankDonation(tipId, key, client);
      if (!current() || !actor.isCurrent()) return changed;
      // A read issued before confirmation must not put the row back into an unthanked state.
      ++scope.read;
      setFrame(previous => previous?.owner === scope ? { owner: scope, loading: false, error: previous.error,
        rows: result.ok ? previous.rows.map(row => row.tipId === tipId ? { ...row, thankedKey: key } : row) : previous.rows } : previous);
      return result;
    } catch {
      if (current() && actor.isCurrent()) setFrame(previous => previous?.owner === scope ? { ...previous, loading: false } : previous);
      return current() && actor.isCurrent() ? { ok: false, message: 'Could not send the thank-you.' } : changed;
    } finally {
      scope.flights.delete(tipId);
    }
  }, [current, scope, userId, playerId]);

  return { rows: shown?.rows ?? [], loading: shown?.loading ?? Boolean(userId && playerId), error: shown?.error ?? null, refresh, thank };
}

/**
 * @purpose Donor side: thank-yous athletes have sent the signed-in fan (Activity).
 * @sideEffects `get_my_donation_thanks` once signed in.
 */
export function useMyDonationThanks() {
  const { user, isSessionCurrent } = useAuth();
  const userId = user?.id ?? null;
  const holder = useRef({ userId, guard: isSessionCurrent, active: false, read: 0 });
  if (holder.current.userId !== userId || holder.current.guard !== isSessionCurrent) {
    holder.current = { userId, guard: isSessionCurrent, active: false, read: 0 };
  }
  const scope = holder.current;
  const current = useCallback(() => holder.current === scope && scope.active && (scope.guard?.() ?? true), [scope]);
  useEffect(() => { scope.active = true; return () => { scope.active = false; ++scope.read; }; }, [scope]);
  const [frame, setFrame] = useState<{ owner: typeof scope; rows: ThanksReceived[]; loading: boolean; error: string | null } | null>(null);
  const shown = frame?.owner === scope && current() ? frame : null;
  const refresh = useCallback(async () => {
    if (!current()) return;
    const read = ++scope.read;
    const actor = userId ? offlineQueue.captureActor(userId) : null;
    const accepted = () => current() && read === scope.read && (!userId || Boolean(actor?.isCurrent()));
    if (!userId) { setFrame({ owner: scope, rows: [], loading: false, error: null }); return; }
    if (!actor) return;
    setFrame(previous => ({ owner: scope, rows: previous?.owner === scope ? previous.rows : [], loading: true, error: null }));
    try {
      const result = await fetchMyDonationThanksResult();
      if (accepted()) setFrame({ owner: scope, rows: result.rows, loading: false, error: result.error });
    } catch {
      if (accepted()) setFrame({ owner: scope, rows: [], loading: false, error: 'We could not load athlete thank-yous. Check your connection and try again.' });
    }
  }, [current, scope, userId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { rows: shown?.rows ?? [], loading: shown?.loading ?? Boolean(userId), error: shown?.error ?? null, refresh };
}
