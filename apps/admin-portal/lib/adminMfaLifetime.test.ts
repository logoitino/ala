/** Real public Auth/SSR cookie APIs, synthetic users and fake HTTP only. */
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createRequire } from 'node:module';
import { getSupabaseBrowserClient, authPublication } from './supabase.ts';
import { startTotpSetup, verifyTotpCode } from './adminMfaClient.ts';
const requireMobile = createRequire(new URL('../../mobile/package.json', import.meta.url));
const requireEnvironment = createRequire(requireMobile.resolve('jest-environment-jsdom'));
const { JSDOM } = requireEnvironment('jsdom');
const A = '11111111-1111-4111-8111-111111111111'; const B = '22222222-2222-4222-8222-222222222222';
const jwt = (id: string, aal = 'aal1') => `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: 4102444800, aal })).toString('base64url')}.test-signature`;
const tokenA = jwt(A); const tokenB = jwt(B);
const user = (id = A) => ({ id, aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-11-20T00:00:00Z', factors: [] });
const reply = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const oldFetch = globalThis.fetch; const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window'); const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; const oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const oldBroadcastChannel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
const dom = new JSDOM('', { url: 'https://portal-test.invalid' });
let client: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>; let live: boolean;
let calls: { path: string; authorization: string | null }[];
let request: typeof fetch;
const actor = () => ({ userId: A, isCurrent: () => live });
before(() => {
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window }); Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mfa-test.invalid'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-test-key';
  client = getSupabaseBrowserClient()!; client.auth.stopAutoRefresh();
});
beforeEach(async () => {
  live = true; calls = [];
  request = async (url, init) => {
    const path = new URL(String(url)).pathname; const authorization = new Headers(init?.headers).get('Authorization'); calls.push({ path, authorization });
    if (path.endsWith('/user')) return reply(user(authorization === `Bearer ${tokenB}` ? B : A));
    if (path.endsWith('/challenge')) return reply({ id: 'challenge-A', expires_at: 4102444800 });
    if (path.endsWith('/verify')) return reply({ access_token: jwt(A, 'aal2'), refresh_token: 'synthetic-refresh-A', token_type: 'bearer', expires_in: 3600, user: user() });
    return reply({ id: 'factor-A', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'synthetic-secret-A', uri: 'otpauth://test' } });
  };
  globalThis.fetch = (...args) => request(...args);
  const seeded = await client.auth.setSession({ access_token: tokenA, refresh_token: 'synthetic-refresh-A' }); assert.equal(seeded.error, null); client.auth.stopAutoRefresh(); calls = [];
});
after(() => {
  client.auth.stopAutoRefresh(); dom.window.close(); globalThis.fetch = oldFetch;
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
  if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
  if (oldBroadcastChannel) Object.defineProperty(globalThis, 'BroadcastChannel', oldBroadcastChannel); else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
  if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
});
test('enrollment remains captured A while the public browser session becomes B', async () => {
  const normal = request; let first = true;
  request = async (...args) => { if (first) { first = false; await client.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' }); } return normal(...args); };
  await startTotpSetup(actor());
  assert.deepEqual(calls.filter((c) => c.path.endsWith('/factors')).map((c) => c.authorization), [`Bearer ${tokenA}`]);
});
test('actor loss before enrollment refuses the factor write', async () => {
  const normal = request; request = async (...args) => { live = false; return normal(...args); };
  await assert.rejects(startTotpSetup(actor()), /account changed/i);
  assert.equal(calls.filter((c) => c.path.endsWith('/factors')).length, 0);
});
test('actor loss after challenge refuses the verify hop', async () => {
  const normal = request; request = async (...args) => { if (String(args[0]).endsWith('/challenge')) live = false; return normal(...args); };
  await assert.rejects(verifyTotpCode('factor-A', '123456', actor()), /account changed/i);
  assert.equal(calls.filter((c) => c.path.endsWith('/verify')).length, 0);
});
test('same-owner verification publishes aal2 in cookies through the public SDK', async () => {
  await verifyTotpCode('factor-A', '123456', actor());
  assert.equal((await client.auth.getSession()).data.session?.access_token, jwt(A, 'aal2'));
});
test('late validation JSON does not replace incoming B cookies with A', async () => {
  let release!: (value: void) => void; const reached = new Promise<void>((done) => { release = done; });
  let stream!: ReadableStreamDefaultController<Uint8Array>; const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  const normal = request;
  request = async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) { release(); return new Response(body, { headers: { 'Content-Type': 'application/json' } }); }
    return normal(...args);
  };
  const task = verifyTotpCode('factor-A', '123456', actor()).catch((e) => e);
  await reached; live = false; await client.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' });
  stream.enqueue(new TextEncoder().encode(JSON.stringify(user()))); stream.close(); await task;
  assert.equal((await client.auth.getSession()).data.session?.user.id, B);
});
test('invalid scoped cookie batches are refused including a chunked session', async () => {
  const current = () => { if (!live) throw new Error('The account changed.'); };
  const normal = request;
  request = async (...args) => reply({ ...user(), user_metadata: { synthetic_padding: 'x'.repeat(7000) } });
  // Invalidate at our supported cookie-adapter boundary, after successful SDK validation.
  const original = authPublication.assertValue;
  let completeSessionBytes = 0;
  authPublication.assertValue = value => {
    completeSessionBytes = value?.length ?? 0; live = false; original(value);
  };
  try {
    await assert.rejects(authPublication.run(jwt(A, 'aal2'), current, () => client.auth.setSession({ access_token: jwt(A, 'aal2'), refresh_token: 'synthetic-refresh-A' })), /account changed/i);
    assert.ok(completeSessionBytes > 7000);
  } finally { authPublication.assertValue = original; request = normal; }
  assert.equal((await client.auth.getSession()).data.session?.access_token, tokenA);
});
test('a late scoped validation session_not_found cannot clear incoming B cookies', async () => {
  let release!: () => void; const reached = new Promise<void>(done => { release = done; });
  let stream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } });
  const normal = request;
  request = async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) {
      release(); return new Response(body, { status: 403, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
    }
    return normal(...args);
  };
  const nullEvents: string[] = [];
  const listener = client.auth.onAuthStateChange((event, session) => { if (!session) nullEvents.push(event); });
  const task = verifyTotpCode('factor-A', '123456', actor()).catch(e => e);
  await reached; live = false;
  await client.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' }); nullEvents.length = 0;
  stream.enqueue(new TextEncoder().encode(JSON.stringify({ code: 'session_not_found', message: 'Synthetic outgoing session missing' }))); stream.close(); await task;
  listener.data.subscription.unsubscribe();
  assert.equal((await client.auth.getSession()).data.session?.user.id, B);
  assert.ok(!nullEvents.includes('SIGNED_OUT'));
});

test('ordinary incoming B signOut clears B while stale A validation is pending', async () => {
  let arrive!: () => void; const reached = new Promise<void>(r => { arrive = r; });
  let resume!: () => void; const release = new Promise<void>(r => { resume = r; }); const normal = request;
  request = async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) {
      arrive(); await release;
      return new Response(JSON.stringify({ code: 'session_not_found', message: 'Synthetic outgoing session missing' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return normal(...args);
  };
  const events: string[] = [];
  const listener = client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' && !session) events.push(event); });
  const task = verifyTotpCode('factor-A', '123456', actor()).catch(e => e);
  await reached; live = false;
  await client.auth.setSession({ access_token: tokenB, refresh_token: 'synthetic-refresh-B' });
  assert.equal((await client.auth.signOut()).error, null);
  assert.equal((await client.auth.getSession()).data.session, null); assert.deepEqual(events, ['SIGNED_OUT']);
  resume(); await task; listener.data.subscription.unsubscribe(); assert.deepEqual(events, ['SIGNED_OUT']);
});

test('current scoped validation failure is recoverable; ordinary unscoped getUser still removes a missing session', async () => {
  const errorReply = () => new Response(JSON.stringify({ code: 'session_not_found', message: 'Synthetic current session missing' }), { status: 403, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
  const normal = request;
  request = async (...args) => {
    if (String(args[0]).endsWith('/user') && new Headers(args[1]?.headers).get('Authorization') === `Bearer ${jwt(A, 'aal2')}`) return errorReply();
    return normal(...args);
  };
  await assert.rejects(verifyTotpCode('factor-A', '123456', actor()), /Could not validate the verified session. Sign in again to continue./);
  assert.equal((await client.auth.getSession()).data.session?.access_token, tokenA);
  const events: string[] = [];
  const listener = client.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' && !session) events.push(event); });
  request = async () => errorReply();
  const failed = await client.auth.getUser(tokenA);
  assert.equal(failed.error?.name, 'AuthSessionMissingError');
  assert.equal((await client.auth.getSession()).data.session, null);
  listener.data.subscription.unsubscribe(); assert.deepEqual(events, ['SIGNED_OUT']);
});
