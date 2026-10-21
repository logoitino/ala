/** Family-account data and actions belong to one signed-in viewer and athlete; delayed work cannot cross that boundary. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import {
  cancelWithdrawal, decideWithdrawal, fetchCustodialSummary, requestWithdrawal,
  setupCustodialAccount, type CustodialSummary,
} from '@/lib/custodial';

const READ_FAILED = 'Could not load the family account. Please try again.';
const CHANGED = 'The account or athlete changed. Please try again.';
const ACTION_FAILED = 'Could not update the family account. Please try again.';
const UNAVAILABLE = 'This part of the app is not switched on yet.';
const UNCONFIRMED = 'The update could not be confirmed. Refresh the family account.';
type Snapshot = { epoch: number; summary: CustodialSummary | null; available: boolean; loading: boolean; error: string | null };

/**
 * @purpose One athlete's custodial account for their athlete, guardian or admin viewer.
 * @param playerId Requested players.id, or null to stay idle.
 * @returns Owner-bound summary/read state and single-flight actions which reject invalid, busy or stale attempts.
 * @sideEffects get_custodial_summary on focus and action RPCs in lib/custodial; server permissions remain authoritative.
 */
export function useCustodial(playerId: string | null | undefined) {
  const { session, user, isSessionCurrent } = useAuth();
  const ownerId = session?.access_token && user?.id && session.user.id === user.id ? user.id : null;
  const targetId = typeof playerId === 'string' && playerId.trim() ? playerId.trim() : null;
  const identity = useRef({ ownerId, targetId, guard: isSessionCurrent, epoch: 0, mounted: true });
  const flight = useRef<object | null>(null);
  const readRevision = useRef(0);
  if (identity.current.ownerId !== ownerId || identity.current.targetId !== targetId || identity.current.guard !== isSessionCurrent) {
    identity.current = { ...identity.current, ownerId, targetId, guard: isSessionCurrent, epoch: identity.current.epoch + 1 };
    flight.current = null;
    ++readRevision.current;
  }
  const epoch = identity.current.epoch;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const latest = useRef<Snapshot | null>(null);
  const [busyEpoch, setBusyEpoch] = useState<number | null>(null);
  const isCurrent = useCallback(() => identity.current.mounted && identity.current.epoch === epoch &&
    (isSessionCurrent ? isSessionCurrent() : true), [epoch, isSessionCurrent]);
  const current = snapshot?.epoch === epoch && isCurrent() ? snapshot : null;
  const publish = useCallback((next: Snapshot) => {
    if (!isCurrent()) return;
    latest.current = next;
    setSnapshot(next);
  }, [isCurrent]);

  useEffect(() => {
    identity.current.mounted = true;
    return () => { identity.current.mounted = false; flight.current = null; ++readRevision.current; };
  }, []);

  const refresh = useCallback(async () => {
    if (!isCurrent()) return;
    const revision = ++readRevision.current;
    const canPublish = () => isCurrent() && readRevision.current === revision;
    if (!ownerId || !targetId) {
      publish({ epoch, summary: null, available: true, loading: false, error: null });
      return;
    }
    const previous = latest.current?.epoch === epoch ? latest.current : null;
    publish({ epoch, summary: previous?.summary ?? null, available: previous?.available ?? true, loading: true, error: null });
    try {
      const result = await fetchCustodialSummary(targetId);
      if (!canPublish()) return;
      if (result.state === 'unavailable') {
        publish({ epoch, summary: null, available: false, loading: false, error: null });
      } else if (result.state === 'error' || (result.summary && result.summary.playerId !== targetId)) {
        publish({ epoch, summary: null, available: true, loading: false, error: READ_FAILED });
      } else {
        publish({ epoch, summary: result.summary, available: true, loading: false, error: null });
      }
    } catch {
      if (canPublish()) publish({ epoch, summary: null, available: true, loading: false, error: READ_FAILED });
    }
  }, [epoch, isCurrent, ownerId, publish, targetId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const run = useCallback(async (action: () => Promise<void>) => {
    if (!isCurrent()) throw new Error(CHANGED);
    if (!ownerId || !targetId) throw new Error('Sign in and select an athlete before continuing.');
    if (flight.current) throw new Error('An account update is already in progress. Please wait.');
    const state = latest.current?.epoch === epoch ? latest.current : null;
    if (state?.available === false) throw new Error(UNAVAILABLE);
    if (!state?.summary || state.summary.playerId !== targetId || state.loading || state.error) {
      throw new Error('Refresh the family account before continuing.');
    }
    const operation = {};
    flight.current = operation;
    setBusyEpoch(epoch);
    const ownsFlight = () => isCurrent() && flight.current === operation;
    try {
      await action();
      if (!ownsFlight()) throw new Error(CHANGED);
      await refresh();
      if (!ownsFlight()) throw new Error(CHANGED);
      const confirmed = latest.current?.epoch === epoch ? latest.current : null;
      if (!confirmed?.available || !confirmed.summary || confirmed.error || confirmed.loading) {
        throw new Error(UNCONFIRMED);
      }
    } catch (error) {
      if (!ownsFlight()) throw new Error(CHANGED);
      const message = error instanceof Error && (error.message === UNAVAILABLE || error.message === UNCONFIRMED)
        ? error.message : ACTION_FAILED;
      const state = latest.current?.epoch === epoch ? latest.current : null;
      publish({ epoch, summary: state?.summary ?? null, available: state?.available ?? true, loading: state?.loading ?? false, error: message });
      throw new Error(message);
    } finally {
      // An outgoing completion cannot release the incoming viewer's update lock.
      if (flight.current === operation) {
        flight.current = null;
        if (identity.current.mounted) setBusyEpoch(null);
      }
    }
  }, [epoch, isCurrent, ownerId, publish, refresh, targetId]);

  const setup = useCallback((birthDate: string | null, bankInAthleteName: boolean | null) =>
    run(() => setupCustodialAccount(targetId!, birthDate, bankInAthleteName)), [run, targetId]);
  const request = useCallback((amountCents: number, note?: string) => run(async () => {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error(ACTION_FAILED);
    await requestWithdrawal(targetId!, amountCents, note);
  }), [run, targetId]);
  const decide = useCallback((requestId: string, approve: boolean) => run(async () => {
    if (!requestId?.trim()) throw new Error(ACTION_FAILED);
    await decideWithdrawal(requestId, approve);
  }), [run]);
  const cancel = useCallback((requestId: string) => run(async () => {
    if (!requestId?.trim()) throw new Error(ACTION_FAILED);
    await cancelWithdrawal(requestId);
  }), [run]);

  return { summary: current?.summary ?? null, available: current?.available ?? true,
    loading: current?.loading ?? Boolean(ownerId && targetId), error: current?.error ?? null,
    busy: busyEpoch === epoch && isCurrent(), refresh, setup, request, decide, cancel };
}
