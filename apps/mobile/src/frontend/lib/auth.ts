import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export const GUEST_ID_KEY = 'tapuai.guestId';
export const ONBOARDING_SEEN_KEY = 'tapuai.onboardingSeen';
export const AUTH_CALLBACK_PATH = 'auth/callback';

/** Soft-Wall one-tap demo fan (Email provider + password must be enabled in Supabase). */
export const DEMO_FAN_EMAIL =
  process.env.EXPO_PUBLIC_DEMO_FAN_EMAIL?.trim() || 'demo@tapuai.app';
export const DEMO_FAN_PASSWORD =
  process.env.EXPO_PUBLIC_DEMO_FAN_PASSWORD?.trim() || 'TapuaiDemoFan1!';
export const DEMO_FAN_NAME = 'Demo Fan';

/**
 * @purpose Redirect URI for Magic Link / OAuth (`alasports://auth/callback`).
 */
export function authRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'alasports', path: AUTH_CALLBACK_PATH });
}

/**
 * @purpose Stable anonymous guest id for analytics / soft-wall (not a JWT).
 * @sideEffects AsyncStorage `tapuai.guestId`.
 */
export async function ensureGuestId(): Promise<string> {
  const existing = await AsyncStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

function displayNameFromUser(user: User): string {
  const meta = user.user_metadata ?? {};
  const named =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.preferred_username === 'string' && meta.preferred_username) ||
    '';
  if (named.trim()) return named.trim();
  if (user.email) return user.email.split('@')[0] ?? 'Fan';
  return 'Fan';
}

/**
 * @purpose Ensure a base fan `profiles` row exists after first successful auth.
 * @sideEffects `profiles` SELECT + INSERT.
 */
export async function ensureFanProfile(user: User): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (data?.id) return;
  const { error } = await supabase.from('profiles').insert({
    user_id: user.id,
    full_name: displayNameFromUser(user),
    role: 'fan',
    roles: ['fan'],
    active_role: 'fan',
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message || 'Could not create your fan profile.');
  }
}

function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const hash = url.split('#')[1] ?? '';
  const query = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : '';
  for (const chunk of `${query}&${hash}`.split('&')) {
    if (!chunk) continue;
    const [rawKey, rawValue = ''] = chunk.split('=');
    if (!rawKey) continue;
    out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
  }
  return out;
}

/**
 * @purpose Complete OAuth / magic-link return by exchanging tokens from the deep link URL.
 * @sideEffects `supabase.auth.setSession` or `exchangeCodeForSession`.
 */
export async function completeAuthRedirect(url: string): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const params = parseParams(url);
  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(error.message);
    if (data.user) await ensureFanProfile(data.user);
    return data.session;
  }
  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(error.message);
    if (data.user) await ensureFanProfile(data.user);
    return data.session;
  }
  return null;
}

/**
 * @purpose Apple Sign In → Supabase session + fan profile.
 * @sideEffects Expo Apple Authentication; `signInWithIdToken`; profile bootstrap.
 */
export async function signInWithApple(): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  if (Platform.OS !== 'ios') throw new Error('Continue with Apple is available on iOS.');

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) throw new Error('Apple Sign In is not available on this device.');

  const rawNonce = Crypto.randomUUID().replace(/-/g, '');
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple did not return an identity token.');

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw new Error(error.message);
  if (!data.session?.user) throw new Error('Apple sign-in did not create a session.');
  await ensureFanProfile(data.session.user);
  return data.session;
}

/**
 * @purpose Google OAuth via system browser → Supabase session + fan profile.
 * @sideEffects `signInWithOAuth`; `WebBrowser.openAuthSessionAsync`; profile bootstrap.
 */
export async function signInWithGoogle(): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  if (!data.url) throw new Error('Google sign-in did not return a URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }
  const session = await completeAuthRedirect(result.url);
  if (!session) throw new Error('Could not finish Google sign-in.');
  return session;
}

/**
 * @purpose Email + password Soft-Wall sign-in (normal credentials).
 * @sideEffects `signInWithPassword`; `ensureFanProfile`.
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) throw new Error('Enter a valid email.');
  if (!password) throw new Error('Enter your password.');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) throw new Error(error.message);
  if (!data.session?.user) throw new Error('Sign-in did not create a session.');
  await ensureFanProfile(data.session.user);
  return data.session;
}

/**
 * @purpose Email magic link. User returns via `alasports://auth/callback`.
 * @sideEffects `signInWithOtp`.
 */
export async function signInWithMagicLink(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) throw new Error('Enter a valid email.');
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo: authRedirectUri() },
  });
  if (error) throw new Error(error.message);
}

/**
 * @purpose One-tap Soft-Wall demo fan — email/password session + fan profile (creates the user on first use).
 * @sideEffects `signInWithPassword` / `signUp`; `ensureFanProfile`.
 */
export async function signInWithDemoAccount(): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');

  const email = DEMO_FAN_EMAIL;
  const password = DEMO_FAN_PASSWORD;

  const existing = await supabase.auth.signInWithPassword({ email, password });
  if (!existing.error && existing.data.session?.user) {
    await ensureFanProfile(existing.data.session.user);
    return existing.data.session;
  }

  const signInMessage = existing.error?.message ?? '';
  const unknownUser =
    /invalid login credentials|invalid_credentials|user not found|email not confirmed/i.test(signInMessage);

  if (!unknownUser && existing.error) {
    throw new Error(signInMessage || 'Could not sign in to the demo account.');
  }

  const created = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: DEMO_FAN_NAME, name: DEMO_FAN_NAME },
      emailRedirectTo: authRedirectUri(),
    },
  });
  if (created.error) {
    // Race: another device created the user between sign-in and sign-up.
    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (!retry.error && retry.data.session?.user) {
      await ensureFanProfile(retry.data.session.user);
      return retry.data.session;
    }
    throw new Error(
      created.error.message ||
        'Could not create the demo fan. In Supabase Auth → Providers enable Email, turn off “Confirm email” for local demos, or create demo@tapuai.app manually.',
    );
  }

  if (created.data.session?.user) {
    await ensureFanProfile(created.data.session.user);
    return created.data.session;
  }

  const afterConfirm = await supabase.auth.signInWithPassword({ email, password });
  if (!afterConfirm.error && afterConfirm.data.session?.user) {
    await ensureFanProfile(afterConfirm.data.session.user);
    return afterConfirm.data.session;
  }

  throw new Error(
    'Demo fan was created but email confirmation is required. Disable Confirm email in Supabase Auth → Providers → Email, then try again.',
  );
}

/**
 * @purpose End the Supabase session (guest browse resumes).
 * @sideEffects `supabase.auth.signOut`.
 */
export async function signOutRemote(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * @purpose Listen for auth deep links while the app is open.
 */
export function subscribeAuthDeepLinks(onUrl: (url: string) => void): () => void {
  const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
  void Linking.getInitialURL().then((url) => {
    if (url) onUrl(url);
  });
  return () => sub.remove();
}
