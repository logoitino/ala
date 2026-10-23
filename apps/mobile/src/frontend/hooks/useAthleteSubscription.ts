/**
 * Exclusive-pass subscription state for one athlete: cache, refresh, and Soft-Wall-safe grant.
 * Used by Vault unlock on Highlights and Profile Subscribe; grant must read the live session so a
 * pre-login Soft-Wall resume still inserts `subscriptions`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/context/AuthContext';
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
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(Boolean(playerId));
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!playerId) {
      setSubscribed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (user?.id && isSupabaseConfigured && isPlayerUuid(playerId)) {
        const { active, failed } = await fetchActiveSubscription(user.id, playerId);

        if (!failed && active) {
          setSubscribed(true);
          await AsyncStorage.setItem(storageKey(playerId, user.id), '1');
          setLoading(false);
          return;
        }

        if (!failed && !active) {
          const local = await AsyncStorage.getItem(storageKey(playerId, user.id));
          setSubscribed(local === '1');
          setLoading(false);
          return;
        }
      }

      const local = await AsyncStorage.getItem(storageKey(playerId, user?.id));
      setSubscribed(local === '1');
    } catch {
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [playerId, user?.id]);

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
  const grant = useCallback(async () => {
    if (!playerId) return;

    const subscriberId = await resolveSessionUserId(userIdRef.current);

    // No server-side check is possible here (guest, Supabase not configured, or a non-UUID
    // placeholder id) — nothing to gate on, so unlock locally as before.
    if (!subscriberId || !isSupabaseConfigured || !isPlayerUuid(playerId)) {
      setSubscribed(true);
      await AsyncStorage.setItem(storageKey(playerId, subscriberId), '1');
      return;
    }

    const { ok } = await insertSubscription(subscriberId, playerId);

    if (!ok) {
      // A genuine rejection (frozen athlete via RLS, network failure, etc.) — do NOT unlock
      // locally. Table may also be missing until `supabase/subscriptions.sql` is applied, in
      // which case this same generic message applies.
      Alert.alert(
        'Subscription not recorded',
        'This athlete cannot currently accept exclusive subscriptions. Contact support if this seems wrong.',
      );
      return;
    }

    // Saved, or already subscribed (`23505` duplicate key) — both count as success.
    setSubscribed(true);
    await AsyncStorage.setItem(storageKey(playerId, subscriberId), '1');
  }, [playerId]);

  return { subscribed, grant, loading, refresh };
}
