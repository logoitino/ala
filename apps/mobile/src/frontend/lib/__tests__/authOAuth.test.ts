/**
 * Google browser sign-in must open before a network probe can consume the browser gesture.
 * Auth returns preserve encoded credentials, reject provider errors, and exchange concurrent one-time codes once.
 */
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { completeAuthRedirect, signInWithGoogle } from '../auth';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const mockSession: Session = {
  access_token: 'session-access', refresh_token: 'session-refresh', expires_in: 3600, token_type: 'bearer',
  user: { id: 'fan-owner', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2020-01-01' },
};
const mockOAuth = jest.fn();
const mockSetSession = jest.fn();
const mockExchange = jest.fn();
const mockProfileRead = jest.fn();
const mockOpenAuth = jest.fn();

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuth(...args),
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => require('react-native').Platform.OS === 'web'
    ? 'https://app.example.test/auth/callback' : 'alasports://auth/callback',
}));
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockOAuth(...args),
      setSession: (...args: unknown[]) => mockSetSession(...args),
      exchangeCodeForSession: (...args: unknown[]) => mockExchange(...args),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockProfileRead() }) }) }),
  },
}));

const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  mockOAuth.mockResolvedValue({ data: { url: 'https://auth.example.test/authorize?provider=google' }, error: null });
  mockSetSession.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null });
  mockExchange.mockResolvedValue({ data: { session: mockSession, user: mockSession.user }, error: null });
  mockProfileRead.mockResolvedValue({ data: { id: 'existing-profile' }, error: null });
  mockOpenAuth.mockResolvedValue({ type: 'success', url: 'https://app.example.test/auth/callback#access_token=access&refresh_token=refresh' });
});
afterAll(() => {
  Object.defineProperty(Platform, 'OS', originalPlatform);
  global.fetch = originalFetch as unknown as typeof fetch;
});

it('opens Google on web without waiting for a network authorize probe', async () => {
  const network = deferred<{ ok: boolean }>();
  global.fetch = jest.fn().mockReturnValue(network.promise) as unknown as typeof fetch;
  const result = signInWithGoogle();
  try {
    await Promise.resolve(); await Promise.resolve();
    expect(mockOpenAuth).toHaveBeenCalledWith(
      'https://auth.example.test/authorize?provider=google', 'https://app.example.test/auth/callback',
    );
    expect(global.fetch).not.toHaveBeenCalled();
  } finally {
    network.resolve({ ok: true });
    await result;
  }
});

it('explains a blocked Google popup with a retry action', async () => {
  mockOpenAuth.mockRejectedValue(Object.assign(new Error('internal browser details'), { code: 'ERR_WEB_BROWSER_BLOCKED' }));
  await expect(signInWithGoogle()).rejects.toThrow('Allow pop-ups for this site, then try again.');
  expect(mockSetSession).not.toHaveBeenCalled();
});

it('preserves the native authorize check and cancellation', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockOpenAuth.mockResolvedValue({ type: 'cancel' });
  await expect(signInWithGoogle()).rejects.toThrow('Google sign-in was cancelled.');
  expect(global.fetch).toHaveBeenCalledWith('https://auth.example.test/authorize?provider=google');
  expect(mockSetSession).not.toHaveBeenCalled();
});

it('keeps the native disabled-provider error before opening its browser', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  global.fetch = jest.fn().mockResolvedValue({
    ok: false, status: 400, text: async () => '{"msg":"Unsupported provider: provider is not enabled"}',
  }) as unknown as typeof fetch;
  await expect(signInWithGoogle()).rejects.toThrow('Google sign-in is turned off');
  expect(mockOpenAuth).not.toHaveBeenCalled();
});

it('returns the completed Google session and ensures the existing fan profile', async () => {
  expect(await signInWithGoogle()).toBe(mockSession);
  expect(mockProfileRead).toHaveBeenCalledTimes(1);
  expect(mockOAuth).toHaveBeenCalledWith({ provider: 'google', options: {
    redirectTo: 'https://app.example.test/auth/callback', skipBrowserRedirect: true,
  } });
});

it('preserves equals signs in implicit-flow credentials', async () => {
  await completeAuthRedirect('https://app.example.test/auth/callback#access_token=a=b==&refresh_token=r%3Dx%3D');
  expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'a=b==', refresh_token: 'r=x=' });
});

it('distinguishes form plus signs from percent-encoded plus signs', async () => {
  await completeAuthRedirect('https://app.example.test/auth/callback?code=one+two%2Bthree%3Dfour');
  expect(mockExchange).toHaveBeenCalledWith('one two+three=four');
});

it.each([
  'https://app.example.test/auth/callback?error=access_denied&error_description=private+details#access_token=a&refresh_token=r',
  'https://app.example.test/auth/callback?error_code=otp_expired&code=unused',
])('rejects a provider-error return without changing session or exposing its details', async (url) => {
  await expect(completeAuthRedirect(url)).rejects.toThrow('Sign-in could not be completed. Please try again.');
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockExchange).not.toHaveBeenCalled();
  expect(mockProfileRead).not.toHaveBeenCalled();
});

it('shares concurrent exchanges of the same normalized code across callback URL variants', async () => {
  const exchange = deferred<{ data: { session: Session; user: Session['user'] }; error: null }>();
  mockExchange.mockReturnValue(exchange.promise);
  const first = completeAuthRedirect('https://app.example.test/auth/callback?code=shared%2Bcode%3D');
  const second = completeAuthRedirect('https://app.example.test/auth/callback#code=shared%2Bcode=');
  expect(mockExchange).toHaveBeenCalledTimes(1);
  exchange.resolve({ data: { session: mockSession, user: mockSession.user }, error: null });
  expect(await first).toBe(mockSession);
  expect(await second).toBe(mockSession);
  expect(mockProfileRead).toHaveBeenCalledTimes(1);
});

it('shares concurrent token installs without retaining a completed result', async () => {
  const session = deferred<{ data: { session: Session; user: Session['user'] }; error: null }>();
  mockSetSession.mockReturnValueOnce(session.promise);
  const first = completeAuthRedirect('https://app.example.test/auth/callback#access_token=a&refresh_token=r');
  const second = completeAuthRedirect('https://app.example.test/auth/callback?refresh_token=r&access_token=a');
  expect(mockSetSession).toHaveBeenCalledTimes(1);
  session.resolve({ data: { session: mockSession, user: mockSession.user }, error: null });
  await Promise.all([first, second]);
  await completeAuthRedirect('https://app.example.test/auth/callback#access_token=a&refresh_token=r');
  expect(mockSetSession).toHaveBeenCalledTimes(2);
});

it('retries a code after a failed in-flight exchange instead of caching the rejection', async () => {
  mockExchange.mockResolvedValueOnce({ data: { session: null, user: null }, error: { message: 'temporarily unavailable' } });
  await expect(completeAuthRedirect('https://app.example.test/auth/callback?code=retry')).rejects.toThrow('Sign-in could not be completed. Please try again.');
  expect(await completeAuthRedirect('https://app.example.test/auth/callback?code=retry')).toBe(mockSession);
  expect(mockExchange).toHaveBeenCalledTimes(2);
});

it('leaves unrelated navigation URLs without a session change', async () => {
  expect(await completeAuthRedirect('https://app.example.test/auth/callback?unrelated=yes')).toBeNull();
  expect(mockSetSession).not.toHaveBeenCalled();
  expect(mockExchange).not.toHaveBeenCalled();
});

it('does not merge different pending authorization codes', async () => {
  const firstExchange = deferred<{ data: { session: Session; user: Session['user'] }; error: null }>();
  const secondExchange = deferred<{ data: { session: Session; user: Session['user'] }; error: null }>();
  const secondSession: Session = { ...mockSession, user: { ...mockSession.user, id: 'second-owner' } };
  mockExchange.mockReturnValueOnce(firstExchange.promise).mockReturnValueOnce(secondExchange.promise);
  const first = completeAuthRedirect('https://app.example.test/auth/callback?code=first-code');
  const second = completeAuthRedirect('https://app.example.test/auth/callback?code=second-code');
  firstExchange.resolve({ data: { session: mockSession, user: mockSession.user }, error: null });
  secondExchange.resolve({ data: { session: secondSession, user: secondSession.user }, error: null });
  expect((await first)?.user.id).toBe('fan-owner');
  expect((await second)?.user.id).toBe('second-owner');
  expect(mockExchange.mock.calls).toEqual([['first-code'], ['second-code']]);
});

it.each([
  'https://other.example.test/auth/callback?code=wrong-origin',
  'https://app.example.test/profile?code=wrong-path',
  'http://app.example.test/auth/callback#access_token=a&refresh_token=r',
])('rejects auth material outside the generated callback location', async (url) => {
  await expect(completeAuthRedirect(url)).rejects.toThrow('Could not read this sign-in link. Please try again.');
  expect(mockExchange).not.toHaveBeenCalled();
  expect(mockSetSession).not.toHaveBeenCalled();
});

it('hides unknown Google SDK diagnostics while preserving a known disabled-provider fix', async () => {
  mockOAuth.mockResolvedValueOnce({ data: { url: null }, error: { message: 'private access_token=not-a-real-token' } });
  await expect(signInWithGoogle()).rejects.toThrow('Could not finish Google sign-in. Please try again.');
  mockOAuth.mockResolvedValueOnce({ data: { url: null }, error: { message: 'provider is not enabled' } });
  await expect(signInWithGoogle()).rejects.toThrow('Google sign-in is turned off on the server. Create an account with email.');
});

it('hides an unexpected rejected Google SDK request', async () => {
  mockOAuth.mockRejectedValueOnce(new Error('private access_token=not-a-real-token'));
  await expect(signInWithGoogle()).rejects.toThrow('Could not finish Google sign-in. Please try again.');
});

it('hides unknown browser diagnostics', async () => {
  mockOpenAuth.mockRejectedValueOnce(new Error('private browser access_token=not-a-real-token'));
  await expect(signInWithGoogle()).rejects.toThrow('Could not finish Google sign-in. Please try again.');
});

it('hides unknown native authorize response diagnostics', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'private access_token=not-a-real-token' }) as unknown as typeof fetch;
  await expect(signInWithGoogle()).rejects.toThrow('Could not finish Google sign-in. Please try again.');
  expect(mockOpenAuth).not.toHaveBeenCalled();
});

it.each(['code', 'tokens'] as const)('hides session SDK diagnostics during the %s callback', async (kind) => {
  const failure = { data: { session: null, user: null }, error: { message: 'private access_token=not-a-real-token' } };
  if (kind === 'code') mockExchange.mockResolvedValueOnce(failure);
  else mockSetSession.mockResolvedValueOnce(failure);
  const params = kind === 'code' ? '?code=diagnostic' : '#access_token=a&refresh_token=r';
  await expect(completeAuthRedirect(`https://app.example.test/auth/callback${params}`)).rejects.toThrow('Sign-in could not be completed. Please try again.');
});

it('hides profile bootstrap diagnostics after a successful exchange', async () => {
  mockProfileRead.mockRejectedValueOnce(new Error('private account diagnostic'));
  await expect(completeAuthRedirect('https://app.example.test/auth/callback?code=profile-failure')).rejects.toThrow('Sign-in could not be completed. Please try again.');
});

it('preserves successful native sign-in at the generated custom-scheme callback', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockOpenAuth.mockResolvedValue({ type: 'success', url: 'alasports://auth/callback?code=native-code' });
  expect(await signInWithGoogle()).toBe(mockSession);
  expect(mockOpenAuth).toHaveBeenCalledWith('https://auth.example.test/authorize?provider=google', 'alasports://auth/callback');
  expect(mockExchange).toHaveBeenCalledWith('native-code');
});

it.each([
  'https://app.example.test/auth/callback?code=first&code=second',
  'https://app.example.test/auth/callback?code=first#code=second',
  'https://app.example.test/auth/callback#access_token=first&access_token=second&refresh_token=refresh',
])('rejects repeated auth credentials instead of choosing the last value', async (url) => {
  await expect(completeAuthRedirect(url)).rejects.toThrow('Could not read this sign-in link. Please try again.');
  expect(mockExchange).not.toHaveBeenCalled();
  expect(mockSetSession).not.toHaveBeenCalled();
});
