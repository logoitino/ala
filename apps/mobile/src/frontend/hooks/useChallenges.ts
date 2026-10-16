/** CHAL-01 participant resource lifecycle. RPCs remain in lib; no storage, offline queue or telemetry. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

type Frame<T> = { key: string | null; data: T | null; error: string | null; notice: string | null; busy: boolean; reading: boolean; ready: boolean; version: number };
const empty = <T,>(key: string | null, version: number): Frame<T> => ({ key, version, data: null, error: null, notice: null, busy: false, reading: key !== null, ready: false });
/** @purpose Bind one focused challenge resource to current auth/profile/target and reject outgoing reads/actions. */
export function useChallenges<T>(resource: string, active: boolean, read: (actor: string | null) => Promise<T>, allowGuest = false) {
  const { user, profile, loading } = useAuth();
  const [focused, setFocused] = useState(false);
  const scope = useRef({ identity: null as string | null, epoch: 0 });
  const [foreground, setForeground] = useState(AppState.currentState === 'active' && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden));
  useEffect(() => {
    const apply = (next: boolean) => {
      // Invalidate before React commits: a retained action must fail inside the same background/hidden event.
      if (!next) scope.current = { identity: null, epoch: scope.current.epoch + 1 };
      setForeground(next);
    };
    const update = () => apply(AppState.currentState === 'active' && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden));
    const subscription = AppState.addEventListener('change', state => apply(state === 'active' && (Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden)));
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
    return () => { subscription.remove(); if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', update); };
  }, []);
  const actorId = !loading && user?.id && profile?.id && profile.user_id === user.id && !profile.age_blocked_at ? profile.id : null;
  const identity = !loading && active && focused && foreground
    ? actorId ? JSON.stringify([user!.id, actorId, resource]) : allowGuest && !user ? JSON.stringify(['guest', resource]) : null : null;
  if (scope.current.identity !== identity) scope.current = { identity, epoch: scope.current.epoch + 1 };
  useFocusEffect(useCallback(() => { setFocused(true); return () => { scope.current = { identity: null, epoch: scope.current.epoch + 1 }; setFocused(false); }; }, []));
  const epoch = scope.current.epoch;
  const key = identity === null ? null : `${epoch}:${identity}`;
  const alive = useRef(true);
  const serial = useRef(0);
  const flight = useRef<string | null>(null);
  const [stored, setStored] = useState<Frame<T>>(() => empty(key, 0));
  const latest = useRef(stored);
  const current = useCallback(() => alive.current && identity !== null && scope.current.identity === identity && scope.current.epoch === epoch, [identity, epoch]);
  const publish = useCallback((frame: Frame<T>) => { latest.current = frame; setStored(frame); }, []);
  const load = useCallback(async (notice: string | null = null) => {
    if (!current() || flight.current === key) return;
    const version = ++serial.current;
    publish({ ...empty<T>(key, version), notice });
    try {
      const data = await read(actorId);
      if (!current() || serial.current !== version) return;
      publish({ key, version, data, error: null, notice, busy: false, reading: false, ready: true });
    } catch (caught) {
      if (current() && serial.current === version) publish({ ...empty<T>(key, version), reading: false, notice, error: caught instanceof Error ? caught.message : 'Could not read challenges. Try again.' });
    }
  }, [current, key, actorId, publish, read]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; serial.current += 1; };
  }, [load]);
  const frame = stored.key === key && key !== null ? stored : empty<T>(null, serial.current);
  const version = frame.version;
  const run = useCallback(async (work: (actor: string, accepted: () => boolean) => Promise<string>) => {
    const accepted = () => current() && latest.current.key === key && latest.current.version === version && latest.current.ready;
    if (!actorId || !accepted() || flight.current === key) return;
    flight.current = key;
    publish({ ...latest.current, busy: true, error: null, notice: null });
    try {
      const notice = await work(actorId, accepted);
      if (!accepted()) return;
      flight.current = null;
      await load(notice);
    } catch (caught) {
      if (!accepted()) return;
      const next = ++serial.current;
      publish({ ...empty<T>(key, next), reading: false, error: caught instanceof Error ? caught.message : 'Could not confirm that action. Refresh before continuing.' });
    } finally {
      if (current() && flight.current === key) flight.current = null;
    }
  }, [actorId, current, key, version, publish, load]);
  const refresh = useCallback(() => load(), [load]);
  return { ...frame, actorId, canRead: key !== null, identityKey: key, run, refresh };
}
