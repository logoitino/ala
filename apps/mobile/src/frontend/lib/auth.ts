/**
 * Sign-in helpers behind the soft wall: what the email form may enable for a given field state, password length
 * checks for sign-up, and the Apple / Google / Magic Link flows. `updateOwnDisplayName` writes the signed-in
 * person's own `profiles.full_name`. Session handling lives in `context/AuthContext`. Web Google
 * keeps the initiating page/draft alive and opens its popup before any authorize network probe.
 * @sideEffects Supabase Auth, and a `profiles` UPDATE from `updateOwnDisplayName`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';

import type { Profile } from '@/types/database';
import { isMissingColumn } from '@/lib/dbErrors';
import { AGE_GATE_REFUSAL, ageBandFrom, birthInputError } from '@/lib/minors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export const GUEST_ID_KEY = 'tapuai.guestId';
export const ONBOARDING_SEEN_KEY = 'tapuai.onboardingSeen';
export const AUTH_CALLBACK_PATH = 'auth/callback';
const GOOGLE_SIGN_IN_FAILED = 'Could not finish Google sign-in. Please try again.';
const AUTH_RETURN_FAILED = 'Sign-in could not be completed. Please try again.';

/** Soft-Wall one-tap demo fan (Email provider + password must be enabled in Supabase). */
export const DEMO_FAN_EMAIL =
  process.env.EXPO_PUBLIC_DEMO_FAN_EMAIL?.trim() || 'demo@tapuai.app';
export const DEMO_FAN_PASSWORD =
  process.env.EXPO_PUBLIC_DEMO_FAN_PASSWORD?.trim() || 'TapuaiDemoFan1!';
export const DEMO_FAN_NAME = 'Demo Fan';

/**
 * @purpose Test-wave demo sign-in. A store build sets `EXPO_PUBLIC_APP_ENV=production` and hides it.
 * @returns True for local and preview. False when the public env says production.
 */
export function demoFanSignInAvailable(): boolean {
  return process.env.EXPO_PUBLIC_APP_ENV !== 'production';
}

/** Shown when the test account cannot be signed in or created on this server. */
export const DEMO_FAN_UNAVAILABLE =
  'The test account is not ready on this server. Create an account with your email.';

/**
 * @purpose A failed test-account sign-in should try to create that account when the server
 * does not recognize the credentials yet.
 * @param message Auth error message.
 * @param code Auth error code, when the client provides one.
 * @returns True for a missing, unconfirmed, or unrecognized test account.
 */
export function demoSignInShouldCreate(message: string, code?: string): boolean {
  const raw = `${code ?? ''} ${message}`.trim();
  return /invalid|not found|not confirmed/i.test(raw);
}
export const MIN_PASSWORD_LENGTH = 8;

/**
 * @purpose Which buttons the Soft-Wall email form may enable, for a given field state.
 * @remarks The birth month and year (MINOR-01, replacing the 13+ checkbox) are asked of accounts being
 * *created*, so they gate Create account and magic link (`signInWithOtp` mints a user when none exists)
 * but never Sign in — gating sign-in would retroactively lock out email accounts that already exist.
 * An under-13 date still enables the button: pressing it shows the neutral refusal (`signUpBirthProblem`),
 * so the form never hints at the age that works. Kept here, not inline in `SoftWallModal`, so the rule
 * is covered by tests.
 */
export function softWallEmailGates(
  email: string,
  password: string,
  birth: BirthMonth | null,
): { canSignIn: boolean; canCreate: boolean; canMagic: boolean } {
  const hasEmail = Boolean(email.trim());
  const hasBirth = Boolean(birth) && birthInputError(birth?.year ?? null, birth?.month ?? null) === null;
  return {
    canSignIn: hasEmail && Boolean(password),
    canCreate: hasEmail && hasBirth && passwordMeetsPolicy(password),
    canMagic: hasEmail && hasBirth,
  };
}

/** Birth month (1–12) and year from the sign-up form (MINOR-01; replaces the 13+ checkbox). No day is collected. */
export type BirthMonth = { year: number; month: number };

/**
 * @purpose Check a sign-up birth month before any account is made: a malformed value gets its fix, an under-13 date
 *   gets the neutral refusal (the caller pauses the device for 24 hours).
 */
export function signUpBirthProblem(birth: BirthMonth | null | undefined): string | null {
  const problem = birthInputError(birth?.year ?? null, birth?.month ?? null);
  if (problem) return problem;
  return ageBandFrom(birth?.year ?? null, birth?.month ?? null) === 'under_13' ? AGE_GATE_REFUSAL : null;
}

function birthMetadata(birth: BirthMonth): Record<string, string | boolean> {
  return { age_confirmed_13_plus: true, birth_year: String(birth.year), birth_month: String(birth.month) };
}

/**
 * @purpose True when a password is long enough to create an account. Sign-in does not use this.
 */
export function passwordMeetsPolicy(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/**
 * @purpose Turn a Supabase Auth failure into a sentence the sheet can show.
 * @param message Raw `error.message` from Auth.
 * @param action Which button failed, so a generic `validation_failed` still names the provider.
 */
export function authFailureMessage(message: string, action: 'google' | 'apple' | 'signup' | 'signin'): string {
  const raw = message.trim();
  if (/provider is not enabled/i.test(raw)) {
    if (action === 'google') {
      return 'Google sign-in is turned off on the server. Create an account with email.';
    }
    if (action === 'apple') {
      return 'Apple sign-in is turned off on the server. Create an account with email, or enable the Apple provider in Supabase Auth.';
    }
  }
  if (/already registered|already been registered|user already exists/i.test(raw)) {
    return 'That email already has an account. Sign in instead.';
  }
  if (action === 'signup' && /password/i.test(raw)) {
    return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // Google diagnostics may contain a return URL or token. Only recognized safe fixes reach the sheet.
  return action === 'google' ? GOOGLE_SIGN_IN_FAILED : raw || 'Could not finish that sign-in.';
}

/**
 * @purpose Turn a Supabase `/authorize` error into a sheet sentence.
 * @param status HTTP status from the authorize URL.
 * @param body Response body. A disabled Google provider returns JSON `msg`, which the browser would otherwise show as a dead page.
 * @param action Which button failed.
 * @returns A sentence for the sign-in sheet, or null when the provider can continue to the browser.
 */
export function oauthAuthorizeFailure(
  status: number,
  body: string,
  action: 'google' | 'apple',
): string | null {
  if (status < 400) return null;
  let message = body.trim();
  try {
    const parsed = JSON.parse(body) as { msg?: string; error_description?: string; message?: string };
    const diagnostic = [parsed.msg, parsed.error_description, parsed.message].find((value) => typeof value === 'string' && value);
    message = diagnostic || message;
  } catch {
    // Non-JSON diagnostics still pass through the provider's safe message mapping.
  }
  return authFailureMessage(message, action);
}

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
 * @purpose Detect a brand-new Supabase Auth user (this sign-in is also the account's first ever).
 * @remarks Standard Supabase idiom: `created_at` and `last_sign_in_at` land within the same request
 * on account creation, then diverge on every later sign-in. Used to decide whether the COPPA
 * one-time `AgeConfirmModal` (Apple / Google path) needs to show — never to gate a returning user.
 */
export function isNewAuthUser(user: User): boolean {
  if (!user.created_at || !user.last_sign_in_at) return false;
  const created = new Date(user.created_at).getTime();
  const lastSignIn = new Date(user.last_sign_in_at).getTime();
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return Math.abs(lastSignIn - created) < 10_000;
}

/**
 * @purpose Ensure a base fan `profiles` row exists after first successful auth.
 * @param ageConfirmed13Plus COPPA self-attestation from the sign-up checkbox, when this call is the
 * one that creates the row (client-side fallback — the `handle_new_auth_user` trigger normally wins
 * the race and already carries this from signup metadata; either path never overwrites an existing row).
 * @sideEffects `profiles` SELECT + INSERT.
 */
export async function ensureFanProfile(user: User, ageConfirmed13Plus?: boolean, birth?: BirthMonth): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
  if (data?.id) return;
  const row: Partial<Profile> & Pick<Profile, 'full_name'> = {
    user_id: user.id,
    full_name: displayNameFromUser(user),
    role: 'fan',
    roles: ['fan'],
    active_role: 'fan',
    age_confirmed_13_plus: ageConfirmed13Plus ?? null,
  };
  let { error } = await supabase.from('profiles').insert(birth ? { ...row, birth_year: birth.year, birth_month: birth.month } : row);
  // Databases without the minor-accounts update have no birth columns; the 13+ confirmation still lands.
  if (error && birth && isMissingColumn(error)) ({ error } = await supabase.from('profiles').insert(row));
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message || 'Could not create your fan profile.');
  }
}

/**
 * @purpose Record the COPPA self-attestation for the signed-in fan (Apple/Google post-sign-in modal).
 * @remarks Only ever called for the signed-in user's own row (`user_id = auth.uid()` under RLS) and
 * only ever writes `true` — never used to clear or re-check an existing confirmation.
 * @sideEffects `profiles` UPDATE.
 */
export async function confirmAge13Plus(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('profiles')
    .update({ age_confirmed_13_plus: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message || 'Could not save your confirmation.');
}

async function oauthAuthorizeBlock(url: string, action: 'google' | 'apple'): Promise<string | null> {
  try {
    const probe = await fetch(url);
    if (probe.ok) return null;
    return oauthAuthorizeFailure(probe.status, await probe.text(), action);
  } catch {
    return null;
  }
}

function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(authRedirectUri());
  } catch {
    throw new Error('Could not read this sign-in link. Please try again.');
  }
  // The deep-link listener can see unrelated URLs; credentials belong only to this configured callback.
  if (parsed.protocol !== expected.protocol || parsed.host !== expected.host || parsed.pathname !== expected.pathname
    || parsed.username || parsed.password) {
    throw new Error('Could not read this sign-in link. Please try again.');
  }
  const authKeys = new Set(['access_token', 'refresh_token', 'code', 'error', 'error_code', 'error_description']);
  // URLSearchParams preserves '=' inside values and distinguishes encoded '+' from a form space.
  for (const params of [parsed.searchParams, new URLSearchParams(parsed.hash.slice(1))]) {
    params.forEach((value, key) => {
      if (authKeys.has(key) && key in out) {
        throw new Error('Could not read this sign-in link. Please try again.');
      }
      out[key] = value;
    });
  }
  return out;
}

// Only pending exchanges are shared; never retain returned sessions or callback URLs after settlement.
const pendingAuthRedirects = new Map<string, Promise<Session | null>>();

/**
 * @purpose Complete OAuth / magic-link return by exchanging tokens from the deep link URL.
 * @returns Session after one shared in-flight exchange; null for a URL without credentials.
 * Only the exact generated callback is accepted. Provider-return errors stop before session
 * changes and never expose their description in the UI; repeated auth fields are refused.
 * @sideEffects `supabase.auth.setSession` or `exchangeCodeForSession`.
 */
export async function completeAuthRedirect(url: string): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const params = parseParams(url);
  if ('error' in params || 'error_code' in params || 'error_description' in params) {
    throw new Error(AUTH_RETURN_FAILED);
  }
  const hasTokens = Boolean(params.access_token && params.refresh_token);
  const key = hasTokens
    ? JSON.stringify(['tokens', params.access_token, params.refresh_token])
    : params.code ? JSON.stringify(['code', params.code]) : null;
  if (!key) return null;
  const pending = pendingAuthRedirects.get(key);
  if (pending) return pending;

  const completion = (async () => {
    const { data, error } = hasTokens
      ? await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token })
      : await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw new Error(AUTH_RETURN_FAILED);
    if (data.user) await ensureFanProfile(data.user);
    return data.session;
  })().catch(() => {
    // The callback screen must not display SDK or profile diagnostics containing identity data.
    throw new Error(AUTH_RETURN_FAILED);
  }).finally(() => { pendingAuthRedirects.delete(key); });
  pendingAuthRedirects.set(key, completion);
  return completion;
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
  if (error) throw new Error(authFailureMessage(error.message, 'apple'));
  if (!data.session?.user) throw new Error('Apple sign-in did not create a session.');
  await ensureFanProfile(data.session.user);
  return data.session;
}

/**
 * @purpose Google OAuth via system browser → Supabase session + fan profile.
 * Web keeps its popup close to the initiating gesture so the current sheet/draft survives.
 * @sideEffects `signInWithOAuth`; `WebBrowser.openAuthSessionAsync`; profile bootstrap.
 */
export async function signInWithGoogle(): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  }).catch(() => { throw new Error(GOOGLE_SIGN_IN_FAILED); });
  if (error) throw new Error(authFailureMessage(error.message, 'google'));
  if (!data.url) throw new Error('Google sign-in did not return a URL.');

  // Native can preflight disabled providers. A web fetch would consume the mobile browser's
  // popup gesture; keep the locally generated URL's path to openAuthSessionAsync network-free.
  if (Platform.OS !== 'web') {
    const blocked = await oauthAuthorizeBlock(data.url, 'google');
    if (blocked) throw new Error(blocked);
  }

  let result: Awaited<ReturnType<typeof WebBrowser.openAuthSessionAsync>>;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_WEB_BROWSER_BLOCKED') {
      throw new Error('Your browser blocked Google sign-in. Allow pop-ups for this site, then try again.');
    }
    throw new Error(GOOGLE_SIGN_IN_FAILED);
  }
  if (result.type !== 'success' || !('url' in result) || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }
  const session = await completeAuthRedirect(result.url);
  if (!session) throw new Error('Could not finish Google sign-in.');
  return session;
}

/**
 * @purpose Email + password Soft-Wall sign-in (normal credentials).
 * @param ageConfirmed13Plus COPPA checkbox from the sign-up sheet. Only ever used as the fallback
 * value if this call is the one that bootstraps a brand-new `profiles` row (see `ensureFanProfile`);
 * a returning user's existing row is never touched by it.
 * @sideEffects `signInWithPassword`; `ensureFanProfile`.
 */
export async function signInWithEmailPassword(
  email: string,
  password: string,
  ageConfirmed13Plus?: boolean,
): Promise<Session> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) throw new Error('Enter a valid email.');
  if (!password) throw new Error('Enter your password.');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });
  if (error) throw new Error(authFailureMessage(error.message, 'signin'));
  if (!data.session?.user) throw new Error('Sign-in did not create a session.');
  await ensureFanProfile(data.session.user, ageConfirmed13Plus);
  return data.session;
}

/**
 * @purpose Create a fan account with email and password. Role is always fan; the client never sends one.
 * @param birth Birth month and year (13 or older). Stored in signup metadata for `handle_new_auth_user`, which also
 *   refuses an under-13 date; the 13+ confirmation is still sent for databases without the minor-accounts update.
 * @returns Session when Supabase signs the new user in immediately.
 * @sideEffects `signUp`; `ensureFanProfile` when a session comes back. No profile write if email confirmation is still required.
 */
export async function signUpWithEmailPassword(
  email: string,
  password: string,
  birth: BirthMonth,
): Promise<Session | null> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const birthProblem = signUpBirthProblem(birth);
  if (birthProblem) throw new Error(birthProblem);
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
    throw new Error('Enter a valid email.');
  }
  if (!passwordMeetsPolicy(password)) {
    throw new Error(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { data, error } = await supabase.auth.signUp({
    email: trimmed,
    password,
    options: {
      data: {
        ...birthMetadata(birth),
        full_name: trimmed.split('@')[0] || 'Fan',
      },
      emailRedirectTo: authRedirectUri(),
    },
  });
  if (error) throw new Error(authFailureMessage(error.message, 'signup'));
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    throw new Error('That email already has an account. Sign in instead.');
  }
  if (data.session?.user) {
    await ensureFanProfile(data.session.user, true, birth);
    return data.session;
  }
  return null;
}

/**
 * @purpose Email magic link. User returns via `alasports://auth/callback`.
 * @param birth Birth month and year from the sign-up sheet. Carried as signup `user_metadata` so
 * `handle_new_auth_user()` can stamp it on the new `profiles` row — only applies the first time this
 * email creates an account; Supabase does not re-run the trigger or touch metadata for a returning user.
 * @sideEffects `signInWithOtp`.
 */
export async function signInWithMagicLink(email: string, birth: BirthMonth): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@') || trimmed.startsWith('@') || trimmed.endsWith('@')) {
    throw new Error('Enter a valid email.');
  }
  const birthProblem = signUpBirthProblem(birth);
  if (birthProblem) throw new Error(birthProblem);
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: authRedirectUri(),
      data: birthMetadata(birth),
    },
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
  const signInCode =
    existing.error && 'code' in existing.error ? String(existing.error.code ?? '') : '';
  if (existing.error && !demoSignInShouldCreate(signInMessage, signInCode)) {
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
    throw new Error(DEMO_FAN_UNAVAILABLE);
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

/**
 * @purpose Save the signed-in person's display name on their own profile row.
 * @param userId `auth.uid()`.
 * @param fullName Trimmed name. Blank is refused before the write.
 * @returns Null on success, or the database message.
 * @sideEffects `profiles` UPDATE on `full_name` for this user only.
 */
export async function updateOwnDisplayName(userId: string, fullName: string): Promise<string | null> {
  const next = fullName.trim();
  if (!next || !userId || !isSupabaseConfigured) return 'Sign in to save your name to Profile.';
  const { error } = await supabase.from('profiles').update({ full_name: next }).eq('user_id', userId);
  return error ? error.message : null;
}
