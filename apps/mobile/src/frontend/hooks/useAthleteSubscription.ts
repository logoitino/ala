import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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
   * @purpose Insert an active exclusive pass and unblur exclusive tiles without waiting on Stripe/RPC.
   * @sideEffects Sets local `subscribed`; AsyncStorage write; `subscriptions` insert (`subscriber_id`, `athlete_id`). Reads `supabase.auth.getSession()` so a Soft-Wall resume after guest sign-in still persists the row.
   */
  const grant = useCallback(async () => {
    if (!playerId) return;
    let subscriberId = userIdRef.current;
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id) subscriberId = data.session.user.id;
    }
    setSubscribed(true);
    await AsyncStorage.setItem(storageKey(playerId, subscriberId), '1');

    if (!subscriberId || !isSupabaseConfigured || !isPlayerUuid(playerId)) return;

    const { error } = await supabase.from('subscriptions').insert({
      subscriber_id: subscriberId,
      athlete_id: playerId,
      status: 'active',
    });

    if (error && error.code !== '23505') {
      // Table may be missing until `supabase/subscriptions.sql` is applied; local grant still stands.
    }
  }, [playerId]);

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
