/** Profile sport reads belong to both the subject and viewer session; late private responses never cross accounts.
 * @sideEffects Privacy-filtered `fetchAthleteSports` RPC through the Profile SDK. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { fetchAthleteSports, type AthleteSportsSnapshot } from '@/lib/athleteSports';

const alwaysCurrent = () => true;
type Status = 'idle' | 'loading' | 'ready' | 'unavailable';
/** @purpose Load selected sports, retain confirmed results during refresh, and discard stale session/subject reads. */
export function useAthleteSports(profileId?: string | null, enabled = true) {
  const auth = useAuth();
  const account = auth.user?.id ?? null;
  const guard = auth.isSessionCurrent ?? alwaysCurrent;
  const identity = `${account ?? 'guest'}:${profileId ?? ''}`;
  const current = useRef({ identity, guard, enabled });
  current.current = { identity, guard, enabled };
  const request = useRef(0);
  const [state, setState] = useState<{ identity: string; guard: typeof guard; snapshot: AthleteSportsSnapshot | null; status: Status }>(
    { identity, guard, snapshot: null, status: profileId && enabled ? 'loading' : 'idle' });
  const reload = useCallback(async () => {
    const version = ++request.current;
    if (!profileId || !enabled) return;
    const valid = () => request.current === version && current.current.identity === identity
      && current.current.guard === guard && current.current.enabled && guard();
    setState(previous => ({ identity, guard, status: 'loading', snapshot: previous.identity === identity && previous.guard === guard ? previous.snapshot : null }));
    try {
      const snapshot = await fetchAthleteSports(profileId);
      if (snapshot && snapshot.profileId !== profileId) throw new Error('Invalid sport subject');
      if (valid()) setState({ identity, guard, snapshot, status: snapshot ? 'ready' : 'unavailable' });
    } catch {
      if (valid()) setState({ identity, guard, snapshot: null, status: 'unavailable' });
    }
  }, [enabled, guard, identity, profileId]);
  useEffect(() => { void reload(); return () => { request.current += 1; }; }, [reload]);
  const acceptConfirmed = useCallback((snapshot: AthleteSportsSnapshot) => {
    if (snapshot.profileId !== profileId || !enabled || !guard() || current.current.identity !== identity || current.current.guard !== guard) return;
    request.current += 1;
    setState({ identity, guard, snapshot, status: 'ready' });
  }, [enabled, guard, identity, profileId]);
  const matches = enabled && profileId && state.identity === identity && state.guard === guard && guard();
  return { snapshot: matches ? state.snapshot : null,
    status: (!enabled || !profileId ? 'idle' : matches ? state.status : 'loading') as Status, reload, acceptConfirmed };
}
