/**
 * Offline replay must use its originating account's token, including across the SDK's async token-read gap.
 * These tests retain the real Supabase client and replace only session reads and the HTTP transport.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { createOfflineActorClient, isOfflineActorChanged, OfflineActorChangedError, type OfflineActor } from './offlineActor';

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() { return mockConfigured; },
  supabase: { auth: { getSession: jest.fn() } },
}));

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let mockConfigured = true;
let current = true;
let actor: OfflineActor;
let transport: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;

function session(userId = USER_A, token = 'test-account-a-token') {
  return { data: { session: { user: { id: userId }, access_token: token } }, error: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  mockConfigured = true;
  current = true;
  actor = { userId: USER_A, isCurrent: () => current };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://offline-test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.mocked(supabase.auth.getSession).mockReset().mockResolvedValue(session() as never);
  transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () =>
    new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  globalThis.fetch = transport as unknown as typeof fetch;
  jest.mocked(AsyncStorage.setItem).mockClear();
});

afterEach(() => {
  globalThis.fetch = originalFetch as unknown as typeof fetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

it('keeps the captured token when the global session later changes', async () => {
  const client = await createOfflineActorClient(actor);
  jest.mocked(supabase.auth.getSession).mockResolvedValue(session(USER_B, 'test-account-b-token') as never);
  const result = await client.rpc('increment_reel_hype', { target_reel_id: USER_B, hype_kind: 'seki' });
  expect(result.error).toBeNull();
  expect(transport).toHaveBeenCalledTimes(1);
  const headers = new Headers(transport.mock.calls[0][1]?.headers);
  expect(headers.get('Authorization')).toBe('Bearer test-account-a-token');
  expect(headers.get('apikey')).toBe('public-test-key');
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('rejects an expired account lifetime before reading the session', async () => {
  current = false;
  await expect(createOfflineActorClient(actor).then(() => 'resolved')).rejects.toBeInstanceOf(OfflineActorChangedError);
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});

it('rejects a switch while the matching session read is unresolved', async () => {
  const read = deferred<ReturnType<typeof session>>();
  jest.mocked(supabase.auth.getSession).mockImplementation(() => read.promise as never);
  const client = createOfflineActorClient(actor);
  current = false;
  read.resolve(session());
  await expect(client.then(() => 'resolved')).rejects.toBeInstanceOf(OfflineActorChangedError);
  expect(transport).not.toHaveBeenCalled();
});

it.each([
  ['another account', session(USER_B)],
  ['no session', { data: { session: null }, error: null }],
  ['blank token', session(USER_A, '  ')],
  ['session error', { ...session(), error: { message: 'Session unavailable' } }],
])('does not substitute an anonymous or other token for %s', async (_label, read) => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue(read as never);
  await expect(createOfflineActorClient(actor).then(() => 'resolved')).rejects.toBeInstanceOf(OfflineActorChangedError);
  expect(transport).not.toHaveBeenCalled();
});

it('blocks a switch during the real SDK async token read before HTTP is issued', async () => {
  const client = await createOfflineActorClient(actor);
  // PostgREST is lazy: start .then(), then switch before fetchWithAuth resumes its await.
  const result = client.rpc('increment_reel_hype', { target_reel_id: USER_B, hype_kind: 'aura' }).then((row) => row);
  current = false;
  const row = await result;
  expect(isOfflineActorChanged(row.error)).toBe(true);
  expect(transport).not.toHaveBeenCalled();
});

it('lets a request already issued as A settle without borrowing B for the next request', async () => {
  const issued = deferred<void>();
  const completed = deferred<Response>();
  transport.mockImplementationOnce(() => { issued.resolve(); return completed.promise; });
  const client = await createOfflineActorClient(actor);
  const first = client.rpc('increment_reel_hype', { target_reel_id: USER_B, hype_kind: 'aura' }).then((row) => row);
  await issued.promise;
  current = false;
  jest.mocked(supabase.auth.getSession).mockResolvedValue(session(USER_B, 'test-account-b-token') as never);
  completed.resolve(new Response('{}', { status: 200 }));
  expect((await first).error).toBeNull();
  const next = await client.rpc('clear_reel_hype', { target_reel_id: USER_B, hype_kind: 'aura' });
  expect(isOfflineActorChanged(next.error)).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
  expect(new Headers(transport.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer test-account-a-token');
});

it('accepts a same-owner refreshed token for a new client without persisting it', async () => {
  const oldClient = await createOfflineActorClient(actor);
  jest.mocked(supabase.auth.getSession).mockResolvedValue(session(USER_A, 'test-account-a-refreshed') as never);
  const refreshed = await createOfflineActorClient(actor);
  await oldClient.rpc('clear_reel_hype', { target_reel_id: USER_B, hype_kind: 'seki' });
  await refreshed.rpc('increment_reel_hype', { target_reel_id: USER_B, hype_kind: 'seki' });
  expect(transport.mock.calls.map((call) => new Headers(call[1]?.headers).get('Authorization'))).toEqual([
    'Bearer test-account-a-token', 'Bearer test-account-a-refreshed',
  ]);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('rejects invalid public connection configuration before any transport', async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://offline-test.invalid/extra-path';
  await expect(createOfflineActorClient(actor)).rejects.toThrow(/configured/i);
  expect(transport).not.toHaveBeenCalled();
});

it('honors the guarded global configuration state without reading a session or issuing HTTP', async () => {
  mockConfigured = false;
  await expect(createOfflineActorClient(actor).then(() => 'resolved')).rejects.toThrow(/configured/i);
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});

it('recognizes SDK-wrapped lifetime errors without classifying network or server refusals as account switches', () => {
  expect(isOfflineActorChanged(new OfflineActorChangedError())).toBe(true);
  expect(isOfflineActorChanged({ message: `OfflineActorChangedError: ${new OfflineActorChangedError().message}` })).toBe(true);
  expect(isOfflineActorChanged({ message: 'Network request failed' })).toBe(false);
  expect(isOfflineActorChanged({ message: 'Permission denied' })).toBe(false);
  expect(isOfflineActorChanged(null)).toBe(false);
});
