/** Terms acknowledgment reads and acceptance stay bound to the canonical signed-in profile; delayed work cannot cross accounts. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { hasLegalAck, recordLegalAck } from '@/lib/legal';
import { telemetry } from '@/services/TelemetryManager';

const READ_FAILED = 'Could not check Terms acknowledgment. Please try again.';
const WRITE_FAILED = 'Could not save Terms acknowledgment. Please try again.';
const CHANGED = 'The account changed. Please try again.';
const UNCONFIRMED = 'Could not confirm Terms acknowledgment. Please refresh and try again.';
type AckState = { epoch: number; accepted: boolean; ready: boolean; error: string | null };

/**
 * @purpose Current Terms / NIL / minor-safety acknowledgment for Profile, verification and Connect.
 * @returns accepted, ready, busy, error, guarded accept/refresh and canonical userId. Acceptance failures reject explicitly.
 * @sideEffects Existing local/server legal acknowledgment helpers, current profile refresh and legal_ack telemetry after confirmation.
 */
export function useLegalAck() {
  const { session, user, profile, refreshProfile, isSessionCurrent } = useAuth();
  const userId = session?.access_token && user?.id && session.user.id === user.id ? user.id : null;
  const ownProfile = userId && profile?.user_id === userId ? profile : null;
  const profileId = ownProfile?.id ?? null;
  const identity = useRef({ userId, profileId, guard: isSessionCurrent, epoch: 0, mounted: true });
  const readRevision = useRef(0);
  const flight = useRef<object | null>(null);
  if (identity.current.userId !== userId || identity.current.profileId !== profileId || identity.current.guard !== isSessionCurrent) {
    identity.current = { ...identity.current, userId, profileId, guard: isSessionCurrent, epoch: identity.current.epoch + 1 };
    ++readRevision.current;
    flight.current = null;
  }
  const epoch = identity.current.epoch;
  const [state, setState] = useState<AckState | null>(null);
  const [busyEpoch, setBusyEpoch] = useState<number | null>(null);
  const isCurrent = useCallback(() => identity.current.mounted && identity.current.epoch === epoch &&
    (isSessionCurrent ? isSessionCurrent() : true), [epoch, isSessionCurrent]);
  const current = state?.epoch === epoch && isCurrent() ? state : null;
  useEffect(() => {
    identity.current.mounted = true;
    return () => { identity.current.mounted = false; flight.current = null; ++readRevision.current; };
  }, []);

  const refresh = useCallback(async () => {
    if (!isCurrent()) return false;
    const revision = ++readRevision.current;
    if (!userId || !profileId) {
      setState({ epoch, accepted: false, ready: !userId, error: null });
      return false;
    }
    setState({ epoch, accepted: false, ready: false, error: null });
    try {
      const ok = await hasLegalAck(userId, ownProfile?.legal_terms_accepted_at, ownProfile?.legal_terms_version);
      if (!isCurrent() || revision !== readRevision.current) return false;
      setState({ epoch, accepted: ok, ready: true, error: null });
      return ok;
    } catch {
      if (isCurrent() && revision === readRevision.current) setState({ epoch, accepted: false, ready: true, error: READ_FAILED });
      return false;
    }
  }, [epoch, isCurrent, ownProfile?.legal_terms_accepted_at, ownProfile?.legal_terms_version, profileId, userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const accept = useCallback(async () => {
    if (!isCurrent()) throw new Error(CHANGED);
    if (!userId || !profileId) throw new Error('Sign in and wait for your profile before accepting Terms.');
    if (flight.current) throw new Error('Terms acceptance is already in progress. Please wait.');
    const operation = {};
    flight.current = operation;
    ++readRevision.current;
    setBusyEpoch(epoch);
    setState({ epoch, accepted: false, ready: false, error: null });
    const ownsFlight = () => isCurrent() && flight.current === operation;
    try {
      await recordLegalAck(userId);
      if (!ownsFlight()) throw new Error(CHANGED);
      const refreshed = await refreshProfile();
      if (!ownsFlight()) throw new Error(CHANGED);
      if (!refreshed || refreshed.user_id !== userId || refreshed.id !== profileId) throw new Error(UNCONFIRMED);
      // Configured signed-in accounts need the current server record; a completed write alone is not confirmation.
      const revision = ++readRevision.current;
      const ok = await hasLegalAck(userId, refreshed.legal_terms_accepted_at, refreshed.legal_terms_version);
      if (!ownsFlight()) throw new Error(CHANGED);
      if (!ok || revision !== readRevision.current) throw new Error(UNCONFIRMED);
      setState({ epoch, accepted: true, ready: true, error: null });
      telemetry.trackFeature('legal_ack', 'profile');
    } catch (error) {
      if (!ownsFlight()) throw new Error(CHANGED);
      const message = error instanceof Error && error.message === UNCONFIRMED ? UNCONFIRMED : WRITE_FAILED;
      setState({ epoch, accepted: false, ready: true, error: message });
      throw new Error(message);
    } finally {
      if (flight.current === operation) {
        flight.current = null;
        if (identity.current.mounted) setBusyEpoch(null);
      }
    }
  }, [epoch, isCurrent, profileId, refreshProfile, userId]);

  return { accepted: current?.accepted ?? false, ready: current?.ready ?? false,
    busy: busyEpoch === epoch && isCurrent(), error: current?.error ?? null, accept, refresh, userId };
}
