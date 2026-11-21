/**
 * Actor-bound paid Exclusive-pass subscription state for one athlete: cache, refresh, and Soft-Wall-safe grant.
 * Used by Vault unlock on Highlights and Profile Subscribe; grant must read the live session so a
 * pre-login Soft-Wall resume still inserts `subscriptions`; private pass state is masked on owner/athlete change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { assertCurrent, createOfflineActorClient } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import type { PaymentActor } from '@/lib/payments';
import { resolveSessionUserId } from '@/lib/sessionToken';
import { fetchActiveSubscription, insertSubscription, isPlayerUuid } from '@/lib/subscriptions';
import { isSupabaseConfigured } from '@/lib/supabase';

function storageKey(playerId: string, userId?: string | null) {
  return userId ? `tapuai.exclusiveSub.${userId}.${playerId}` : `tapuai.exclusiveSub.guest.${playerId}`;
}

/**
 * @purpose Check whether the signed-in fan holds an active exclusive pass for one athlete.
 * @param playerId Target athlete `players.id` (stored as `subscriptions.athlete_id`).
 * @returns `{ subscribed, grant, loading }` — `grant` unblurs exclusive tiles immediately then inserts `subscriptions`.
 * @sideEffects Queries `subscriptions` by `subscriber_id` + `athlete_id`; AsyncStorage cache; insert on grant. Soft-Wall resume resolves the subscriber from the live session.
 */
export function useAthleteSubscription(playerId: string | undefined) {
  const { user, isSessionCurrent } = useAuth();
  const identity = `${user?.id ?? 'guest'}/${playerId ?? ''}`;
  const lifetime = useRef({ identity, guard: isSessionCurrent, generation: 0 });
  if (lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) lifetime.current = { identity, guard: isSessionCurrent, generation: lifetime.current.generation + 1 };
  const generation = lifetime.current.generation;
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;
  const [view, setView] = useState({ generation, subscribed: false, loading: Boolean(playerId) });
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;
  const subscribed = view.generation === generation && view.subscribed;
  const loading = view.generation === generation ? view.loading : Boolean(playerId);

  const refresh = useCallback(async () => {
    if (lifetime.current.identity !== identity || lifetime.current.guard !== isSessionCurrent) return;
    const capturedGeneration = lifetime.current.generation;
    const actor = user?.id ? offlineQueue.captureActor(user.id) : null;
    const current = () => lifetime.current.generation === capturedGeneration && (!actor || actor.isCurrent());
    const publish = (active: boolean, pending = false) => {
      if (current()) setView({ generation: capturedGeneration, subscribed: active, loading: pending });
    };
    if (!playerId) { publish(false); return; }
    publish(false, true);
    try {
      if (user?.id && isSupabaseConfigured && isPlayerUuid(playerId)) {
        const { active, failed } = await fetchActiveSubscription(user.id, playerId);
        if (!current()) return;
        if (!failed) {
          // A successful server read wins over a previously cached pass (including revocations).
          if (active) await AsyncStorage.setItem(storageKey(playerId, user.id), '1');
          else await AsyncStorage.removeItem(storageKey(playerId, user.id));
          publish(active);
          return;
        }
      }
      const local = await AsyncStorage.getItem(storageKey(playerId, user?.id));
      publish(local === '1');
    } catch { publish(false); }
  }, [identity, isSessionCurrent, playerId, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * @purpose Insert an active exclusive pass and unblur exclusive tiles — gated on the insert
   * actually succeeding so a server-side rejection (e.g. `malo_target_frozen` via the
   * `subscriptions` INSERT/UPDATE RLS policies) leaves the fan's UI locked instead of silently
   * unlocking. Mirrors the `tips`-insert gating in `useTipCheckout.ts`. Soft-Wall resume reads the
   * live session so a stashed pre-login closure still persists the pass.
   * @sideEffects `subscriptions` insert (`subscriber_id`, `athlete_id`); sets local `subscribed` +
   * AsyncStorage write only once that insert has succeeded (or a guest/unconfigured/non-UUID path
   * where no server check is possible); user-visible Alert on a genuine rejection.
   */
  /**
   * @returns `true` when the pass is recorded (or unlocked locally without a server check);
   * `false` when the insert was refused so Soft-Wall exclusive checkout can skip the unlock toast.
   */
  const grant = useCallback(async (payment?: PaymentActor): Promise<boolean> => {
    if (!playerId || playerIdRef.current !== playerId) return false;
    const capturedGeneration = lifetime.current.generation;
    const stillHere = () => lifetime.current.generation === capturedGeneration;

    const actor = payment?.actor ?? offlineQueue.captureActor();
    if (payment) assertCurrent(payment.actor);
    const subscriberId = actor?.userId ?? await resolveSessionUserId(userIdRef.current);
    if (actor) assertCurrent(actor);

    // No server-side check is possible here (guest, Supabase not configured, or a non-UUID
    // placeholder id) — nothing to gate on, so unlock locally as before.
    if (!subscriberId || !isSupabaseConfigured || !isPlayerUuid(playerId)) {
      if (!stillHere()) return false;
      setView({ generation: capturedGeneration, subscribed: true, loading: false });
      await AsyncStorage.setItem(storageKey(playerId, subscriberId), '1');
      return true;
    }

    const { ok } = await insertSubscription(subscriberId, playerId, payment?.client ?? (actor ? await createOfflineActorClient(actor) : undefined));
    if (actor) assertCurrent(actor);
    if (!stillHere()) return false;

    if (!ok) {
      // A genuine rejection (frozen athlete via RLS, network failure, etc.) — do NOT unlock
      // locally. Table may also be missing until `supabase/legacy/subscriptions.sql` is applied, in
      // which case this same generic message applies.
      Alert.alert(
        'Subscription not recorded',
        'This athlete cannot currently accept exclusive subscriptions. Contact support if this seems wrong.',
      );
      return false;
    }

    // Saved, or already subscribed (`23505` duplicate key) — both count as success.
    if (!stillHere()) return false;
    setView({ generation: capturedGeneration, subscribed: true, loading: false });
    await AsyncStorage.setItem(storageKey(playerId, subscriberId), '1');
    if (actor) assertCurrent(actor);
    return stillHere();
  }, [playerId]);
  return { subscribed, grant, loading, refresh };
}
