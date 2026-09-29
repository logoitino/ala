import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { apiUrl } from '@/lib/apiUrl';
import { isMissingEdgeFunction } from '@/lib/edgeFunction';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { hasLegalAck } from '@/lib/legal';

WebBrowser.maybeCompleteAuthSession();

const LOCAL_KEY_PREFIX = 'tapuai.stripeConnect.';

export type StripeConnectState = {
  accountId: string | null;
  stripe_onboarding_complete: boolean;
  payouts_enabled: boolean;
};

type ConnectApiPayload = StripeConnectState & {
  url?: string | null;
  error?: string;
};

function localKey(userId: string | null | undefined) {
  return `${LOCAL_KEY_PREFIX}${userId || 'guest'}`;
}

async function readLocalState(userId: string | null | undefined): Promise<StripeConnectState | null> {
  const raw = await AsyncStorage.getItem(localKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StripeConnectState>;
    return {
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : null,
      stripe_onboarding_complete: Boolean(parsed.stripe_onboarding_complete),
      payouts_enabled: Boolean(parsed.payouts_enabled),
    };
  } catch {
    return null;
  }
}

async function writeLocalState(userId: string | null | undefined, next: StripeConnectState) {
  await AsyncStorage.setItem(localKey(userId), JSON.stringify(next));
}

function asPayload(data: unknown): ConnectApiPayload | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as ConnectApiPayload;
  if (typeof row.accountId !== 'string' || !row.accountId) return null;
  return row;
}

/**
 * @purpose Ask the JWT-gated Connect function for an Express Account Link. Never mint `sk_` or Account Links on device.
 * @param body `returnUrl` / `refreshUrl` / `mode` only — the server binds the account to `auth.uid()`.
 * @param accessToken Supabase session JWT (`Authorization: Bearer`).
 * @sideEffects `supabase.functions.invoke('create-stripe-account')`; Metro `POST /api/create-stripe-account` only if the function is missing.
 */
async function requestConnect(
  body: Record<string, unknown>,
  accessToken: string,
): Promise<ConnectApiPayload> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.functions.invoke('create-stripe-account', {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = asPayload(data);
    if (payload) {
      if (payload.error) throw new Error(payload.error);
      return payload;
    }
    if (error && !isMissingEdgeFunction(error)) {
      throw new Error(error.message || 'Could not start Stripe Connect.');
    }
  }

  const response = await fetch(apiUrl('/api/create-stripe-account'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ConnectApiPayload;
  if (!response.ok) {
    throw new Error(data.error ?? 'Could not start Stripe Connect.');
  }
  const payload = asPayload(data);
  if (!payload) {
    throw new Error('Stripe Connect did not return an account id.');
  }
  return payload;
}

/**
 * @purpose Stripe Connect Express onboarding for athlete Mālo / subscription payouts. Links are minted server-side only.
 * @returns `{ createStripeExpressAccount, busy, stripeOnboardingComplete, payoutsEnabled }` — opens the Express URL in `WebBrowser.openAuthSessionAsync`.
 * @sideEffects JWT Edge Function `create-stripe-account` (Metro fallback), `WebBrowser.openAuthSessionAsync`, AsyncStorage cache, `refreshProfile`. First onboarding requires `hasLegalAck`.
 */
export function useStripeConnect() {
  const { session, user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<StripeConnectState>({
    accountId: null,
    stripe_onboarding_complete: false,
    payouts_enabled: false,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void readLocalState(user?.id).then((cached) => {
      if (!active || !cached) return;
      setLocal(cached);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const persistFlags = useCallback(
    async (next: StripeConnectState) => {
      setLocal(next);
      void writeLocalState(user?.id, next);
      await refreshProfile();
    },
    [refreshProfile, user?.id],
  );

  const stripeOnboardingComplete = Boolean(
    profile?.stripe_onboarding_complete || local.stripe_onboarding_complete,
  );
  const payoutsEnabled = Boolean(profile?.payouts_enabled || local.payouts_enabled);

  const createStripeExpressAccount = useCallback(async () => {
    if (busy) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      Alert.alert('Stripe Connect', 'Sign in to connect payouts.');
      return;
    }

    const alreadyOnboarded = Boolean(profile?.stripe_onboarding_complete || local.stripe_onboarding_complete);
    if (!alreadyOnboarded) {
      const agreed = await hasLegalAck(
        session.user.id,
        profile?.legal_terms_accepted_at,
        profile?.legal_terms_version,
      );
      if (!agreed) {
        Alert.alert('Terms required', 'Agree to Terms of Service & NIL Compliance before connecting a bank.');
        return;
      }
    }

    setBusy(true);
    try {
      const returnUrl = Linking.createURL('stripe-connect');
      const mode = stripeOnboardingComplete ? 'dashboard' : 'onboarding';
      const created = await requestConnect(
        {
          returnUrl,
          refreshUrl: returnUrl,
          mode,
        },
        accessToken,
      );

      await persistFlags({
        accountId: created.accountId,
        stripe_onboarding_complete: created.stripe_onboarding_complete,
        payouts_enabled: created.payouts_enabled,
      });

      if (!created.url) {
        Alert.alert('Stripe Connect', 'No onboarding URL was returned.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(created.url, returnUrl);

      if (result.type === 'locked') {
        Alert.alert('Stripe Connect', 'Another in-app browser session is already open.');
        return;
      }

      const synced = await requestConnect(
        {
          returnUrl,
          refreshUrl: returnUrl,
          mode: 'status',
        },
        accessToken,
      );

      await persistFlags({
        accountId: synced.accountId,
        stripe_onboarding_complete: synced.stripe_onboarding_complete,
        payouts_enabled: synced.payouts_enabled,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open Stripe Connect.';
      Alert.alert('Stripe Connect', message);
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    local.stripe_onboarding_complete,
    persistFlags,
    profile?.legal_terms_accepted_at,
    profile?.legal_terms_version,
    profile?.stripe_onboarding_complete,
    session?.access_token,
    session?.user.id,
    stripeOnboardingComplete,
  ]);

  return {
    createStripeExpressAccount,
    busy,
    stripeOnboardingComplete,
    payoutsEnabled,
  };
}
