/**
 * Every offline action and older-database fallback must retain its originating account's HTTP authorization.
 * Real domain helpers and the real SDK run against fake session/HTTP boundaries; no hosted requests are made.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';
import { dispatchOfflineAction } from './offlineActions';
import { isOfflineActorChanged, type OfflineActor } from './offlineActor';
import { OfflineQueue, type OfflineActionPayload } from '@/services/OfflineQueue';

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: jest.fn() } },
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null })),
  },
}));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const REEL = '33333333-3333-4333-8333-333333333333';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let transport: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
let current: boolean;
let actor: OfflineActor;
let queue: OfflineQueue | undefined;

function session(userId = A, access_token = 'test-origin-a-token') {
  return { data: { session: { user: { id: userId }, access_token } }, error: null };
}
function response(data: unknown = {}, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function missingFunction() {
  return response({ code: 'PGRST202', message: 'Could not find the function with report_reason or team names', details: '', hint: '' }, 404);
}
function wire() {
  return transport.mock.calls.map(([input, init]) => ({
    url: new URL(String(input)),
    method: init?.method,
    body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null,
    authorization: new Headers(init?.headers).get('Authorization'),
  }));
}

beforeEach(async () => {
  current = true;
  actor = { userId: A, isCurrent: () => current };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://offline-test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  jest.mocked(supabase.auth.getSession).mockReset().mockResolvedValue(session() as never);
  jest.mocked(NetInfo.fetch).mockResolvedValue({ type: 'unknown', isConnected: false, isInternetReachable: null, details: null } as NetInfoState);
  transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => response());
  globalThis.fetch = transport as typeof fetch;
  await AsyncStorage.clear();
});

afterEach(() => {
  queue?.dispose();
  queue = undefined;
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

const actions: Array<{ action: OfflineActionPayload; paths: string[]; body: unknown }> = [
  { action: { type: 'bookmark', userId: A, reelId: REEL, saved: true }, paths: ['/rest/v1/saved_reels'], body: { user_id: A, reel_id: REEL } },
  { action: { type: 'hype_clear', reelId: REEL, kind: 'seki' }, paths: ['/rest/v1/rpc/clear_reel_hype'], body: { target_reel_id: REEL, hype_kind: 'seki' } },
  { action: { type: 'cheer_vote', slug: 'test-poll', side: 'home', previousSide: null, homeName: 'Home', awayName: 'Away' }, paths: ['/rest/v1/rpc/cast_cheer_vote'], body: { poll_slug: 'test-poll', side: 'home', previous_side: null, home_name: 'Home', away_name: 'Away' } },
  { action: { type: 'report_reel', reelId: REEL, reason: 'rights' }, paths: ['/rest/v1/rpc/report_reel'], body: { target_reel_id: REEL, report_reason: 'rights' } },
  { action: { type: 'aura_hype', reelId: REEL, kind: 'aura', grantAura: true, userId: B, auraPoints: 2 }, paths: ['/rest/v1/rpc/increment_reel_hype', '/rest/v1/rpc/add_user_aura'], body: { target_reel_id: REEL, hype_kind: 'aura' } },
];

it.each(actions)('sends $action.type with A authorization even when the mutable session becomes B', async ({ action, paths, body }) => {
  jest.mocked(supabase.auth.getSession).mockImplementationOnce(async () => {
    const captured = session();
    jest.mocked(supabase.auth.getSession).mockResolvedValue(session(B, 'test-incoming-b-token') as never);
    return captured as never;
  });
  await dispatchOfflineAction(action, actor);
  expect(wire().map((request) => request.url.pathname)).toEqual(paths);
  expect(wire().map((request) => request.authorization)).toEqual(paths.map(() => 'Bearer test-origin-a-token'));
  expect(wire()[0].body).toEqual(body);
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
  if (action.type === 'aura_hype') {
    expect(wire()[1].body).toEqual({ target_user_id: B, points_to_add: 2 });
  }
});

it('binds bookmark removal to the explicit owner and exact target', async () => {
  await dispatchOfflineAction({ type: 'bookmark', userId: A, reelId: REEL, saved: false }, actor);
  expect(wire()).toHaveLength(1);
  expect(wire()[0].method).toBe('DELETE');
  expect(wire()[0].url.searchParams.get('user_id')).toBe(`eq.${A}`);
  expect(wire()[0].url.searchParams.get('reel_id')).toBe(`eq.${REEL}`);
  expect(wire()[0].authorization).toBe('Bearer test-origin-a-token');
});

it('refuses a bookmarked row owned by a different actor before reading a token or issuing HTTP', async () => {
  await expect(dispatchOfflineAction({ type: 'bookmark', userId: B, reelId: REEL, saved: true }, actor)).rejects.toThrow(/account changed/i);
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});

it.each(['cheer_vote', 'report_reel'] as const)('keeps the older-function %s fallback on the captured token', async (type) => {
  const action = actions.find((row) => row.action.type === type)!.action;
  transport.mockImplementationOnce(async () => {
    jest.mocked(supabase.auth.getSession).mockResolvedValue(session(B, 'test-incoming-b-token') as never);
    return missingFunction();
  });
  await dispatchOfflineAction(action, actor);
  expect(wire()).toHaveLength(2);
  expect(wire().map((request) => request.authorization)).toEqual(['Bearer test-origin-a-token', 'Bearer test-origin-a-token']);
  expect(wire()[1].body).toEqual(type === 'cheer_vote'
    ? { poll_slug: 'test-poll', side: 'home', previous_side: null }
    : { target_reel_id: REEL });
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
});

it.each(['cheer_vote', 'report_reel'] as const)('prevents the older-function %s fallback after actor invalidation', async (type) => {
  const action = actions.find((row) => row.action.type === type)!.action;
  transport.mockImplementationOnce(async () => { current = false; return missingFunction(); });
  const error = await dispatchOfflineAction(action, actor).catch((caught: unknown) => caught);
  expect(isOfflineActorChanged(error)).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
});

it('prevents an Aura award after the successful hype response belongs to a departed actor', async () => {
  transport.mockImplementationOnce(async () => { current = false; return response(); });
  await expect(dispatchOfflineAction(actions[4].action, actor)).rejects.toThrow(/account changed/i);
  expect(wire().map((request) => request.url.pathname)).toEqual(['/rest/v1/rpc/increment_reel_hype']);
});

it('does not swallow actor invalidation in the async token gap of the second Aura request', async () => {
  let hypeResponded = false;
  let switchScheduled = false;
  actor = {
    userId: A,
    isCurrent: () => {
      const allowed = current;
      // Schedule the external account transition after the first post-hype lifetime check returns.
      if (hypeResponded && !switchScheduled) {
        switchScheduled = true;
        queueMicrotask(() => { current = false; });
      }
      return allowed;
    },
  };
  transport.mockImplementationOnce(async () => { hypeResponded = true; return response(); });
  // The SDK wraps a thrown fetch error into a plain object; preserving that rejection is sufficient.
  const error = await dispatchOfflineAction(actions[4].action, actor).catch((caught: unknown) => caught);
  expect(isOfflineActorChanged(error)).toBe(true);
  expect(wire().map((request) => request.url.pathname)).toEqual(['/rest/v1/rpc/increment_reel_hype']);
});

it('accepts a successful Aura award already issued as A after the account changes', async () => {
  transport.mockImplementation(async (input) => {
    if (String(input).endsWith('/rpc/add_user_aura')) {
      current = false;
      jest.mocked(supabase.auth.getSession).mockResolvedValue(session(B, 'test-incoming-b-token') as never);
    }
    return response();
  });
  await expect(dispatchOfflineAction(actions[4].action, actor)).resolves.toBeUndefined();
  expect(wire().map((request) => request.url.pathname)).toEqual(['/rest/v1/rpc/increment_reel_hype', '/rest/v1/rpc/add_user_aura']);
  expect(wire().map((request) => request.authorization)).toEqual(['Bearer test-origin-a-token', 'Bearer test-origin-a-token']);
  expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
});

it('retains the original queued Aura action when an account switch prevents its award', async () => {
  OfflineQueue.getInstance().dispose();
  delete (globalThis as typeof globalThis & { __tapuaiOfflineQueue?: OfflineQueue }).__tapuaiOfflineQueue;
  queue = OfflineQueue.getInstance();
  await queue.snapshot();
  queue.setActor(A);
  await queue.enqueue(actions[4].action, queue.captureActor(A));
  transport.mockImplementationOnce(async () => { queue!.setActor(B); return response(); });
  jest.mocked(NetInfo.fetch).mockResolvedValue({ type: 'unknown', isConnected: true, isInternetReachable: null, details: null } as NetInfoState);
  await queue.isOnline();
  await queue.flush();
  expect(wire().map((request) => request.url.pathname)).toEqual(['/rest/v1/rpc/increment_reel_hype']);
  const stored = JSON.parse((await AsyncStorage.getItem('tapuai.offlineQueue'))!) as unknown[];
  expect(stored).toEqual([expect.objectContaining({ type: 'aura_hype', actorUserId: A, userId: B, reelId: REEL })]);
  expect(await queue.snapshot()).toEqual([]);
});
