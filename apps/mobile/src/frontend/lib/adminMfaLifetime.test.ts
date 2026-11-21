/** Real Auth SDK MFA hops use one captured actor; fake HTTP cannot enroll or verify a hosted factor. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authPublication, supabase } from '@/lib/supabase';
import { startAdminTotpSetup, verifyAdminTotpCode } from './adminMfa';
import type { OfflineActor } from './offlineActor';
jest.mock('@/lib/supabase', () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mfa-test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  return jest.requireActual('@/lib/supabase');
});
const A = '11111111-1111-4111-8111-111111111111'; const B = '22222222-2222-4222-8222-222222222222';
function jwt(id: string, aal = 'aal1') { const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: id, exp: 4102444800, aal })}.test-signature`; }
const tokenA = jwt(A); const tokenB = jwt(B);
const beforeFetch = globalThis.fetch; const beforeUrl = process.env.EXPO_PUBLIC_SUPABASE_URL; const beforeKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
let live: boolean; let actor: OfflineActor; let http: jest.Mock<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function user(id = A, factors: unknown[] = []) { return { id, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-11-20T00:00:00Z', factors }; }
function wires() { return http.mock.calls.map(([url, init]) => ({ path: new URL(String(url)).pathname, authorization: new Headers(init?.headers).get('Authorization'), method: init?.method })); }
beforeEach(async () => {
  await AsyncStorage.clear(); supabase.auth.stopAutoRefresh();
  live = true; actor = { userId: A, isCurrent: () => live }; process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://mfa-test.invalid'; process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  http = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith('/user')) return reply(user(new Headers(init?.headers).get('Authorization') === `Bearer ${tokenB}` ? B : A));
    if (path.endsWith('/challenge')) return reply({ id: 'challenge-A', expires_at: 4102444800 });
    if (path.endsWith('/verify')) return reply({ access_token: jwt(A, 'aal2'), refresh_token: 'synthetic-refresh-A', token_type: 'bearer', expires_in: 3600, user: user() });
    return reply({ id: 'factor-A', type: 'totp', totp: { qr_code: '<svg/>', secret: 'synthetic-setup-A', uri: 'otpauth://test' } });
  }); globalThis.fetch = http;
  await supabase.auth.setSession({ access_token: tokenA, refresh_token: 'synthetic-refresh-A' }); http.mockClear();
});
afterEach(() => { jest.restoreAllMocks(); globalThis.fetch = beforeFetch; if (beforeUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = beforeUrl; if (beforeKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = beforeKey; });
it('keeps enrollment on captured A when mutable global Auth becomes B', async () => {
  http.mockImplementationOnce(async () => { await supabase.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' }); return reply(user()); });
  await startAdminTotpSetup(actor);
  expect(wires().filter((r) => r.path.endsWith('/factors')).map((r) => r.authorization)).toEqual([`Bearer ${tokenA}`]);
});
it('does not enroll after actor loss during the preceding user read', async () => {
  http.mockImplementationOnce(async () => { live = false; return reply(user()); });
  await expect(startAdminTotpSetup(actor)).rejects.toThrow(/account changed/i);
  expect(wires().filter((r) => r.path.endsWith('/factors'))).toEqual([]);
});
it('does not verify a challenge after its actor leaves', async () => {
  const normal = http.getMockImplementation()!;
  http.mockImplementation(async (...args) => { if (String(args[0]).endsWith('/challenge')) live = false; return normal(...args); });
  await expect(verifyAdminTotpCode('factor-A', '123456', actor)).rejects.toThrow(/account changed/i);
  expect(wires().filter((r) => r.path.endsWith('/verify'))).toEqual([]);
});
it('does not install a verified outgoing session after the issued verify response arrives', async () => {
  const install = jest.spyOn(supabase.auth, 'setSession'); const normal = http.getMockImplementation()!;
  http.mockImplementation(async (...args) => { if (String(args[0]).endsWith('/verify')) live = false; return normal(...args); });
  await expect(verifyAdminTotpCode('factor-A', '123456', actor)).rejects.toThrow(/account changed/i);
  expect(install).not.toHaveBeenCalled();
});
it('publishes a verified current A session through the existing public Auth API', async () => {
  await verifyAdminTotpCode('factor-A', '123456', actor);
  const { data } = await supabase.auth.getSession();
  expect(data.session?.user.id).toBe(A); expect(data.session?.access_token).toBe(jwt(A, 'aal2'));
});

function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
it('does not replace incoming B when A session validation JSON finishes late', async () => {
  const reached = deferred<void>(); let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  const normal = http.getMockImplementation()!;
  http.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) {
      reached.resolve(undefined); return new Response(body, { headers: { 'Content-Type': 'application/json' } });
    }
    return normal(...args);
  });
  const task = verifyAdminTotpCode('factor-A', '123456', actor).catch((e) => e);
  await reached.promise; live = false;
  await supabase.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' });
  stream.enqueue(new TextEncoder().encode(JSON.stringify(user()))); stream.close();
  await task;
  expect((await supabase.auth.getSession()).data.session?.user.id).toBe(B);
});
it('does not let delayed A Auth storage overwrite B or announce A verification', async () => {
  const reached = deferred<void>(); const release = deferred<void>();
  const save = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
    if (value.includes(jwt(A, 'aal2'))) { reached.resolve(undefined); await release.promise; }
    return save(key, value);
  });
  const events: string[] = [];
  const listener = supabase.auth.onAuthStateChange((_event, session) => { if (session) events.push(session.access_token); });
  const task = verifyAdminTotpCode('factor-A', '123456', actor).catch((e) => e);
  await reached.promise; live = false;
  const incoming = supabase.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' });
  await Promise.resolve(); await Promise.resolve();
  release.resolve(undefined); await Promise.all([task, incoming]);
  listener.data.subscription.unsubscribe();
  expect((await supabase.auth.getSession()).data.session?.user.id).toBe(B);
  expect(events).not.toContain(jwt(A, 'aal2'));
});
it('identifies an outgoing Auth notification when its lifetime ends after storage succeeds', async () => {
  const save = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
    await save(key, value);
    if (value.includes(jwt(A, 'aal2'))) queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => { live = false; })));
  });
  const stale: string[] = [];
  const accepted: string[] = [];
  const listener = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) return;
    if (!authPublication.isCurrent(session.access_token)) stale.push(session.access_token);
    else accepted.push(session.access_token);
  });
  await verifyAdminTotpCode('factor-A', '123456', actor).catch(() => undefined);
  listener.data.subscription.unsubscribe();
  expect(stale).toContain(jwt(A, 'aal2'));
  expect(accepted).not.toContain(jwt(A, 'aal2'));
});

it('a late scoped validation session_not_found cannot clear incoming B storage', async () => {
  const reached = deferred<void>(); let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  const normal = http.getMockImplementation()!;
  http.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) {
      reached.resolve(undefined); return new Response(body, { status: 403, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
    }
    return normal(...args);
  });
  const nullEvents: string[] = [];
  const listener = supabase.auth.onAuthStateChange((event, session) => { if (!session) nullEvents.push(event); });
  const task = verifyAdminTotpCode('factor-A', '123456', actor).catch(e => e);
  await reached.promise; live = false;
  await supabase.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' });
  nullEvents.length = 0;
  stream.enqueue(new TextEncoder().encode(JSON.stringify({ code: 'session_not_found', message: 'Synthetic outgoing session missing' }))); stream.close(); await task;
  listener.data.subscription.unsubscribe();
  expect((await supabase.auth.getSession()).data.session?.user.id).toBe(B);
  expect(nullEvents).not.toContain('SIGNED_OUT');
});

it('ordinary incoming B signOut still clears B while stale A validation is pending', async () => {
  const reached = deferred<void>(); const release = deferred<void>(); const normal = http.getMockImplementation()!;
  http.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) {
      reached.resolve(undefined); await release.promise;
      return reply({ code: 'session_not_found', message: 'Synthetic outgoing session missing' }, 403);
    }
    return normal(...args);
  });
  const events: string[] = [];
  const listener = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' && !session) events.push(event); });
  const task = verifyAdminTotpCode('factor-A', '123456', actor).catch(e => e);
  await reached.promise; live = false;
  await supabase.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' });
  expect((await supabase.auth.signOut()).error).toBeNull();
  expect((await supabase.auth.getSession()).data.session).toBeNull(); expect(events).toEqual(['SIGNED_OUT']);
  release.resolve(undefined); await task; listener.data.subscription.unsubscribe();
  expect(events).toEqual(['SIGNED_OUT']);
});

it('current scoped validation failure reports an error without publishing aal2; ordinary getUser failure still signs out', async () => {
  const normal = http.getMockImplementation()!;
  http.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`)
      return reply({ code: 'session_not_found', message: 'Synthetic outgoing session missing' }, 403);
    return normal(...args);
  });
  await expect(verifyAdminTotpCode('factor-A', '123456', actor)).rejects.toThrow('Could not validate the verified session. Sign in again to continue.');
  expect((await supabase.auth.getSession()).data.session?.access_token).toBe(tokenA);
  const events: string[] = [];
  const listener = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' && !session) events.push(event); });
  http.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'session_not_found', message: 'Synthetic current session missing' }), { status: 403, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } }));
  const failed = await supabase.auth.getUser(tokenA);
  expect(failed.error?.name).toBe('AuthSessionMissingError');
  expect((await supabase.auth.getSession()).data.session).toBeNull();
  listener.data.subscription.unsubscribe(); expect(events).toEqual(['SIGNED_OUT']);
});
