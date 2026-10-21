/**
 * Stripe Connect onboarding for payees. Asks the JWT-gated Edge Function for an Express account link; the secret key
 * and link creation stay on the server, never on the device. Pending work stays bound to its account
 * lifetime; device cache flags cannot override explicit server status or waive Terms.
 * @sideEffects JWT Connect requests; native auth browser or allowlisted web navigation. Only own-profile flags use device cache.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from 'expo-router';

import { apiUrl } from '@/lib/apiUrl';
import { isMissingEdgeFunction } from '@/lib/edgeFunction';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { hasLegalAck } from '@/lib/legal';

WebBrowser.maybeCompleteAuthSession();

const LOCAL_KEY_PREFIX = 'tapuai.stripeConnect.';
const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAILURE = 'Bank setup could not be completed. Try again.';
let browserFlight: object | null = null;

export type StripeConnectState = {
  accountId: string | null;
  stripe_onboarding_complete: boolean;
  payouts_enabled: boolean;
};

type ConnectApiPayload = StripeConnectState & {
  url?: string | null;
  error?: string;
  playerId?: string;
  transport?: 'edge' | 'http';
};
type ConnectStatus = { epoch: number; loading: boolean; ready: boolean; linked: boolean | null; error: string | null; transport?: 'edge' | 'http' };

class ConnectFailure extends Error {
  constructor(readonly code?: string, readonly transport?: 'edge' | 'http') { super(code === 'connect_ineligible'
    ? 'This account is not eligible for bank setup. Check your age, athlete and guardian verification.' : FAILURE); }
}

function localKey(userId: string) {
  return `${LOCAL_KEY_PREFIX}${userId}`;
}

async function readLocalState(userId: string): Promise<StripeConnectState | null> {
  const raw = await AsyncStorage.getItem(localKey(userId));
  if (!raw) return null;
  try {
    return asPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeLocalState(userId: string, next: StripeConnectState) {
  await AsyncStorage.setItem(localKey(userId), JSON.stringify(next));
}

function asPayload(data: unknown, playerId?: string): ConnectApiPayload | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.accountId !== 'string' || !row.accountId.trim() ||
      typeof row.stripe_onboarding_complete !== 'boolean' || typeof row.payouts_enabled !== 'boolean' ||
      (row.url != null && typeof row.url !== 'string') ||
      (playerId && row.playerId !== playerId)) return null;
  return {
    accountId: row.accountId.trim(),
    stripe_onboarding_complete: row.stripe_onboarding_complete,
    payouts_enabled: row.payouts_enabled,
    url: row.url as string | null | undefined,
    error: typeof row.error === 'string' ? row.error : undefined,
    playerId: typeof row.playerId === 'string' ? row.playerId : undefined,
  };
}

/** Only Stripe's hosted Connect/dashboard origins can receive an authenticated bank setup navigation. */
function stripeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port &&
      ['connect.stripe.com', 'dashboard.stripe.com'].includes(parsed.hostname)) return parsed.href;
  } catch { /* A malformed provider URL stays inside the app as a fixed failure. */ }
  throw new ConnectFailure();
}

async function responseCode(error: unknown, data: unknown, playerId?: string): Promise<string | undefined> {
  const http = error as { context?: { status?: number; clone?: () => { json: () => Promise<unknown> }; json?: () => Promise<unknown> } } | null;
  if (![400, 403].includes(http?.context?.status ?? 0)) return undefined;
  let body = data;
  try {
    if (!body && http?.context?.json) body = await (http.context.clone?.() ?? http.context).json!();
  } catch { return undefined; }
  const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
  if (code === 'connect_not_linked' && http?.context?.status === 400 &&
    (!playerId || (body as { playerId?: unknown }).playerId === playerId)) return code;
  return code === 'connect_ineligible' && http?.context?.status === 403 ? code : undefined;
}

/**
 * @purpose Ask the JWT-gated Connect function for an Express Account Link. Never mint `sk_` or Account Links on device.
 * @param body Return/refresh URLs, mode and optional athlete playerId; the server resolves the authorized payee/account.
 * @param accessToken Supabase session JWT (`Authorization: Bearer`).
 * @sideEffects `supabase.functions.invoke('create-stripe-account')`; Metro `POST /api/create-stripe-account` only if the function is missing.
 */
async function requestConnect(
  body: Record<string, unknown>,
  accessToken: string,
  isCurrent: () => boolean,
  playerId?: string,
  transport?: 'edge' | 'http',
): Promise<ConnectApiPayload> {
  if (transport === 'http') return requestHttpConnect(body, accessToken, isCurrent, playerId);
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.functions.invoke('create-stripe-account', {
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!isCurrent()) throw new Error('Connect account changed.');
    if (!error) {
      const payload = asPayload(data, playerId);
      if (!payload || payload.error) throw new ConnectFailure();
      return { ...payload, transport: 'edge' };
    }
    if (!isMissingEdgeFunction(error)) {
      throw new ConnectFailure(await responseCode(error, data, playerId), 'edge');
    }
    if (transport === 'edge') throw new ConnectFailure();
  }
  // A missing Edge reply must not replay the old account's request after a switch.
  if (!isCurrent()) throw new Error('Connect account changed.');

  return requestHttpConnect(body, accessToken, isCurrent, playerId);
}

/** The same scoped response checks apply to the Node fallback and its read-only compatibility handshake. */
async function requestHttpConnect(body: Record<string, unknown>, accessToken: string, isCurrent: () => boolean, playerId?: string): Promise<ConnectApiPayload> {
  const response = await fetch(apiUrl('/api/create-stripe-account'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ConnectApiPayload & { code?: string };
  if (!isCurrent()) throw new ConnectFailure();
  if (!response.ok) {
    throw new ConnectFailure(response.status === 400 && data.code === 'connect_not_linked' && (!playerId || data.playerId === playerId) ? data.code
      : response.status === 403 && data.code === 'connect_ineligible' ? data.code : undefined, 'http');
  }
  const payload = asPayload(data, playerId);
  if (!payload || payload.error) throw new ConnectFailure();
  return { ...payload, transport: 'http' };
}

/**
 * @purpose Optional Stripe test onboarding for own-profile or guardian/athlete scope; status never grants payout authority.
 * @param options A playerId selects guardian scope. It requires a current target-bound status/transport handshake and uses no persistent cache.
 * @returns Existing four onboarding fields plus linked/statusLoading/statusReady/error/refresh for honest status and recovery.
 * @sideEffects JWT Connect requests, allowlisted browser navigation, own-profile cache/refresh. First setup requires Terms.
 */
export function useStripeConnect(options?: { playerId?: string }) {
  const { session, user, profile, refreshProfile, isSessionCurrent } = useAuth();
  const latestSession = useRef(session);
  latestSession.current = session;
  const guardian = options?.playerId !== undefined;
  const playerId = typeof options?.playerId === 'string' && PLAYER_ID.test(options.playerId) ? options.playerId.toLowerCase() : undefined;
  const target = guardian ? playerId ?? 'invalid' : 'profile';
  const ownerId = session?.access_token && user?.id && session.user.id === user.id ? user.id : null;
  const flight = useRef<object | null>(null);
  const revision = useRef(0);
  const identity = useRef({ ownerId, target, sessionGuard: isSessionCurrent, epoch: 0, mounted: true });
  // Mask outgoing results during render, including a return to A after A → B → A.
  if (identity.current.ownerId !== ownerId || identity.current.target !== target || identity.current.sessionGuard !== isSessionCurrent) {
    identity.current.ownerId = ownerId;
    identity.current.sessionGuard = isSessionCurrent;
    identity.current.target = target;
    identity.current.epoch += 1;
    flight.current = null;
    revision.current += 1;
  }
  const epoch = identity.current.epoch;
  const [busyOwner, setBusyOwner] = useState<{ ownerId: string; epoch: number } | null>(null);
  const [local, setLocal] = useState<{
    ownerId: string; epoch: number; source: 'cache' | 'server'; state: StripeConnectState;
  } | null>(null);
  const [status, setStatusState] = useState<ConnectStatus | null>(null);
  const latestStatus = useRef<ConnectStatus | null>(null);
  const setStatus = useCallback((next: ConnectStatus) => {
    latestStatus.current = next; setStatusState(next);
  }, []);
  const currentProfile = ownerId && profile?.user_id === ownerId ? profile : null;
  const currentLocal = local?.ownerId === ownerId && local.epoch === epoch &&
    (guardian ? local.source === 'server' : currentProfile ? currentProfile.stripe_connect_id === local.state.accountId : local.source === 'server') ? local.state : null;
  // Persisted flags fill only absent fields on the same account; explicit server false always wins.
  const stripeOnboardingComplete = !guardian && currentProfile?.stripe_onboarding_complete !== undefined
    ? currentProfile.stripe_onboarding_complete === true : currentLocal?.stripe_onboarding_complete === true;
  const payoutsEnabled = !guardian && currentProfile?.payouts_enabled !== undefined
    ? currentProfile.payouts_enabled === true : currentLocal?.payouts_enabled === true;
  const busy = Boolean(ownerId && busyOwner?.ownerId === ownerId && busyOwner.epoch === epoch);
  const isCurrentOwner = useCallback(() => identity.current.mounted &&
    identity.current.ownerId === ownerId && identity.current.target === target && identity.current.epoch === epoch &&
    (isSessionCurrent ? isSessionCurrent() : true), [ownerId, target, epoch, isSessionCurrent]);

  useEffect(() => {
    identity.current.mounted = true;
    return () => { identity.current.mounted = false; flight.current = null; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync().catch(() => undefined);
    return () => { void WebBrowser.coolDownAsync().catch(() => undefined); };
  }, []);

  useEffect(() => {
    if (!ownerId || guardian) return;
    const beforeRead = revision.current;
    void readLocalState(ownerId).then((cached) => {
      if (!cached || !isCurrentOwner() || beforeRead !== revision.current) return;
      setLocal({ ownerId, epoch, source: 'cache', state: cached });
    }).catch(() => undefined); // An unavailable convenience cache does not block server onboarding.
  }, [ownerId, epoch, isCurrentOwner, guardian]);

  const refresh = useCallback(async () => {
    if (!ownerId || !isCurrentOwner() || flight.current) return;
    if (guardian && !playerId) { setStatus({ epoch, loading: false, ready: false, linked: null, error: FAILURE }); return; }
    const operation = {}; flight.current = operation;
    const isCurrent = () => isCurrentOwner() && flight.current === operation;
    setStatus({ epoch, loading: true, ready: false, linked: null, error: null });
    try {
      const next = await requestConnect({ mode: 'status', ...(playerId ? { playerId } : {}) }, session!.access_token, isCurrent, playerId);
      if (!isCurrent()) return;
      revision.current += 1;
      setLocal({ ownerId, epoch, source: 'server', state: next });
      setStatus({ epoch, loading: false, ready: true, linked: true, error: null, transport: next.transport });
      if (!guardian) await refreshProfile().catch(() => null);
    } catch (error) {
      if (!isCurrent()) return;
      const unlinked = error instanceof ConnectFailure && error.code === 'connect_not_linked';
      setLocal(null);
      setStatus({ epoch, loading: false, ready: unlinked, linked: unlinked ? false : null, error: unlinked ? null : error instanceof ConnectFailure ? error.message : FAILURE, transport: unlinked ? error.transport : undefined });
    } finally { if (flight.current === operation) flight.current = null; }
  }, [ownerId, guardian, playerId, epoch, isCurrentOwner, session?.access_token, refreshProfile]);

  useFocusEffect(useCallback(() => { if (guardian) void refresh(); }, [guardian, refresh]));

  const createStripeExpressAccount = useCallback(async () => {
    if (!isCurrentOwner()) return;
    if (guardian && !playerId) return;
    // Older deployed functions ignore playerId. A matching status handshake must precede any creation.
    const checkedStatus = latestStatus.current;
    if (guardian && (checkedStatus?.epoch !== epoch || !checkedStatus.ready || checkedStatus.loading || checkedStatus.error || !checkedStatus.transport)) return;
    const accessToken = session?.access_token;
    if (!ownerId || !accessToken) {
      Alert.alert('Stripe Connect', 'Sign in to connect payouts.');
      return;
    }
    if (flight.current) return;
    if (browserFlight) { Alert.alert('Stripe Connect', 'Another in-app browser session is already open.'); return; }
    const operation = {};
    flight.current = operation;
    setBusyOwner({ ownerId, epoch });
    const isCurrent = () => isCurrentOwner() && flight.current === operation;
    const persistFlags = async (next: ConnectApiPayload) => {
      if (!isCurrent()) return false;
      revision.current += 1;
      setLocal({ ownerId, epoch, source: 'server', state: next });
      // The server has already confirmed its save; cache/refresh failures do not revoke its link.
      setStatus({ epoch, loading: false, ready: true, linked: true, error: null, transport: next.transport });
      if (guardian) return isCurrent(); // A per-athlete bank never reads/writes the guardian's profile cache.
      await writeLocalState(ownerId, {
        accountId: next.accountId,
        stripe_onboarding_complete: next.stripe_onboarding_complete,
        payouts_enabled: next.payouts_enabled,
      }).catch(() => undefined);
      if (!isCurrent()) return false;
      await refreshProfile().catch(() => null);
      return isCurrent();
    };

    try {
      // A device cache cannot waive the original first-onboarding Terms requirement.
      if (guardian || currentProfile?.stripe_onboarding_complete !== true) {
        const agreed = await hasLegalAck(ownerId, currentProfile?.legal_terms_accepted_at, currentProfile?.legal_terms_version);
        if (!isCurrent()) return;
        if (!agreed) {
          Alert.alert('Terms required', 'Agree to Terms of Service & NIL Compliance before connecting a bank.');
          return;
        }
      }
      const returnUrl = Linking.createURL('stripe-connect', playerId ? { queryParams: { playerId } } : undefined);
      const created = await requestConnect({ returnUrl, refreshUrl: returnUrl,
        mode: stripeOnboardingComplete ? 'dashboard' : 'onboarding', ...(playerId ? { playerId } : {}) }, accessToken, isCurrent, playerId, guardian ? checkedStatus?.transport : undefined);
      if (!isCurrent() || !await persistFlags(created)) return;
      if (!created.url) {
        Alert.alert('Stripe Connect', 'No onboarding URL was returned.');
        return;
      }
      const url = stripeUrl(created.url);
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined') throw new ConnectFailure();
        // Minting is asynchronous; full-page navigation does not depend on a popup's expiring user gesture.
        window.location.assign(url);
        return;
      }
      if (browserFlight) { Alert.alert('Stripe Connect', 'Another in-app browser session is already open.'); return; }
      const browser = {}; browserFlight = browser;
      let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
      try { result = await WebBrowser.openAuthSessionAsync(url, returnUrl); }
      finally { if (browserFlight === browser) browserFlight = null; }
      if (!isCurrent()) return;
      if (result.type === 'locked') {
        Alert.alert('Stripe Connect', 'Another in-app browser session is already open.');
        return;
      }
      // Stripe can outlast a JWT. Keep the captured account lifetime, but use its latest same-owner token.
      const returnedSession = latestSession.current;
      if (returnedSession?.user.id !== ownerId || !returnedSession.access_token) throw new ConnectFailure();
      const synced = await requestConnect({ returnUrl, refreshUrl: returnUrl, mode: 'status', ...(playerId ? { playerId } : {}) }, returnedSession.access_token, isCurrent, playerId, guardian ? created.transport : undefined);
      if (isCurrent()) await persistFlags(synced);
    } catch (error) {
      if (!isCurrent()) return;
      if (guardian && error instanceof ConnectFailure && error.code === 'connect_not_linked') {
        setLocal(null); setStatus({ epoch, loading: false, ready: true, linked: false, error: null, transport: error.transport }); return;
      }
      const message = error instanceof ConnectFailure ? error.message : FAILURE;
      setStatus({ epoch, loading: false, ready: false, linked: null, error: message });
      Alert.alert('Stripe Connect', message);
    } finally {
      // An old account's completion cannot unlock a newer account's operation.
      if (flight.current === operation) {
        flight.current = null;
        if (identity.current.mounted) setBusyOwner(null);
      }
    }
  }, [ownerId, guardian, playerId, epoch, isCurrentOwner, session?.access_token, currentProfile?.stripe_onboarding_complete,
    currentProfile?.legal_terms_accepted_at, currentProfile?.legal_terms_version, refreshProfile, stripeOnboardingComplete]);

  const currentStatus = status?.epoch === epoch && ownerId ? status : null;
  const linked = guardian ? currentStatus?.linked ?? null : currentProfile
    ? typeof currentProfile.stripe_connect_id === 'string' && !!currentProfile.stripe_connect_id.trim()
    : currentLocal?.accountId ? true : currentStatus?.linked ?? null;
  return { createStripeExpressAccount, busy, stripeOnboardingComplete, payoutsEnabled,
    linked, statusReady: guardian ? currentStatus?.ready === true : true,
    statusLoading: guardian ? currentStatus?.loading ?? !!ownerId : currentStatus?.loading === true,
    error: currentStatus?.error ?? null, refresh };
}
