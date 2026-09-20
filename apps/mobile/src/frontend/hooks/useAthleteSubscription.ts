import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function isPlayerUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function storageKey(playerId: string, userId?: string | null) {
  return userId ? `tapuai.exclusiveSub.${userId}.${playerId}` : `tapuai.exclusiveSub.guest.${playerId}`;
}

/**
 * @purpose Check whether the signed-in fan holds an active exclusive pass for one athlete.
 * @param playerId Target athlete `players.id` (stored as `subscriptions.athlete_id`).
 * @returns `{ subscribed, grant, loading }` — `grant` unblurs exclusive tiles immediately then inserts `subscriptions`.
 * @sideEffects Queries `subscriptions` by `subscriber_id` + `athlete_id`; AsyncStorage cache; insert on grant.
 */
export function useAthleteSubscription(playerId: string | undefined) {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(Boolean(playerId));

  const refresh = useCallback(async () => {
    if (!playerId) {
      setSubscribed(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (user?.id && isSupabaseConfigured && isPlayerUuid(playerId)) {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('subscriber_id', user.id)
          .eq('athlete_id', playerId)
          .eq('status', 'active')
          .maybeSingle();

        if (!error && data) {
          setSubscribed(true);
          await AsyncStorage.setItem(storageKey(playerId, user.id), '1');
          setLoading(false);
          return;
        }

        if (!error && !data) {
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
   * unlocking. Mirrors the `tips`-insert gating in `useTipCheckout.ts`.
   * @sideEffects `subscriptions` insert (`subscriber_id`, `athlete_id`); sets local `subscribed` +
   * AsyncStorage write only once that insert has succeeded (or a guest/unconfigured/non-UUID path
   * where no server check is possible); user-visible Alert on a genuine rejection.
   */
  const grant = useCallback(async () => {
    if (!playerId) return;

    // No server-side check is possible here (guest, Supabase not configured, or a non-UUID
    // placeholder id) — nothing to gate on, so unlock locally as before.
    if (!user?.id || !isSupabaseConfigured || !isPlayerUuid(playerId)) {
      setSubscribed(true);
      await AsyncStorage.setItem(storageKey(playerId, user?.id), '1');
      return;
    }

    const { error } = await supabase.from('subscriptions').insert({
      subscriber_id: user.id,
      athlete_id: playerId,
      status: 'active',
    });

    if (error && error.code !== '23505') {
      // A genuine rejection (frozen athlete via RLS, network failure, etc.) — do NOT unlock
      // locally. Table may also be missing until `supabase/subscriptions.sql` is applied, in
      // which case this same generic message applies.
      Alert.alert(
        'Subscription not recorded',
        'This athlete cannot currently accept exclusive subscriptions. Contact support if this seems wrong.',
      );
      return;
    }

    // Insert succeeded, or `23505` duplicate-key (fan is already subscribed) — both are success.
    setSubscribed(true);
    await AsyncStorage.setItem(storageKey(playerId, user.id), '1');
  }, [playerId, user?.id]);

  return { subscribed, grant, loading, refresh };
}

/**
 * @purpose Whether the signed-in fan holds any active exclusive pass (Subscriber Crest on Profile).
 * @returns `true` when `subscriptions` has an active row for the current user, else local cache.
 * @sideEffects `subscriptions` select; AsyncStorage `tapuai.exclusiveSub` fallback.
 */
export function useHasSubscriberPass() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      if (user?.id && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('subscriber_id', user.id)
          .eq('status', 'active')
          .limit(1);

        if (!error && data && data.length > 0) {
          setActive(true);
          return;
        }
      }

      const local = await AsyncStorage.getItem('tapuai.exclusiveSub');
      setActive(local === '1');
    } catch {
      setActive(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return active;
}
