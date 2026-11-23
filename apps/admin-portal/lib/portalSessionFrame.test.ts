/** Strict private-frame parsing and real Supabase GET/user + PostgREST transport pinning; synthetic data only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { portalSessionFrame, samePortalSessionFrame } from './portalSessionFrame.ts';
import { resolveBackendConnection } from '../../../packages/shared-types/backendConnection.ts';
import * as sharedMfa from '../../../packages/shared-types/admin/adminMfa.ts';

const requirePortal = createRequire(new URL('../package.json', import.meta.url));
const { createClient } = requirePortal('@supabase/supabase-js');
const ts = requirePortal('typescript');
const sid = '11111111-1111-4111-8111-111111111111';
const sidB = '22222222-2222-4222-8222-222222222222';
function token(patch: Record<string, unknown> = {}) {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: 'A', session_id: sid, aal: 'aal2', exp: 4102444800, ...patch })).toString('base64url'), Buffer.from('synthetic-signature').toString('base64url')].join('.');
}
test('frame output is only a stable noncredential digest across same-session token refresh', async () => {
  const expected = createHash('sha256').update(JSON.stringify(['tapuai-private-frame-v1', 'A', sid, 'aal2'])).digest('hex');
  assert.equal(await portalSessionFrame(token(), 'A'), expected);
  assert.equal(await portalSessionFrame(token({ iat: 22 }), 'A'), expected);
  assert.notEqual(await portalSessionFrame(token({ session_id: sidB }), 'A'), expected);
  assert.notEqual(await portalSessionFrame(token({ aal: 'aal1' }), 'A'), expected);
});
for (const [name, jwt, user] of [
  ['malformed', 'bad-token', 'A'], ['wrong-sub', token({ sub: 'B' }), 'A'],
  ['missing-session', token({ session_id: undefined }), 'A'], ['invalid-session', token({ session_id: 'not-a-session' }), 'A'],
  ['unknown-aal', token({ aal: 'aal3' }), 'A'], ['expired', token({ exp: 1 }), 'A'],
  ['string-exp', token({ exp: '4102444800' }), 'A'], ['empty-user', token(), ''],
] as const) test(`private frame refuses ${name}`, async () => { assert.equal(await portalSessionFrame(jwt, user), null); });
test('synchronous preservation compares only an accepted lifetime with a valid current session/AAL', () => {
  assert.equal(samePortalSessionFrame(token(), token({ iat: 44 }), 'A'), true);
  assert.equal(samePortalSessionFrame(token({ exp: 1 }), token(), 'A'), true);
  for (const next of [token({ sub: 'B' }), token({ session_id: sidB }), token({ aal: 'aal1' }), token({ exp: 1 }), 'malformed']) {
    assert.equal(samePortalSessionFrame(token(), next, 'A'), false);
  }
});

function load(relative: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', code)((id: string) => id in mocks ? mocks[id] : requirePortal(id), module, module.exports);
  return module.exports;
}
async function serverCase(options: { mismatch?: boolean; malformedSub?: boolean; deniedProfile?: boolean } = {}) {
  const originalFetch = globalThis.fetch;
  const saved = Object.fromEntries(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_ADMIN_REQUIRE_MFA'].map(key => [key, process.env[key]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic-admin.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-key';
  process.env.NEXT_PUBLIC_ADMIN_REQUIRE_MFA = 'true';
  const captured = token(options.malformedSub ? { sub: 'B' } : {});
  let incoming = false; let sessionReads = 0;
  const wire: Array<{ path: string; auth: string | null; userFilter: string | null }> = [];
  const user = (id: string) => ({ id, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2020-01-01', factors: [] });
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const headers = new Headers(init?.headers);
    wire.push({ path: url.pathname, auth: headers.get('Authorization'), userFilter: url.searchParams.get('user_id') });
    if (url.pathname === '/auth/v1/user') {
      incoming = true;
      return new Response(JSON.stringify(user(options.mismatch ? 'B' : 'A')), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/rest/v1/profiles') return new Response(JSON.stringify(options.deniedProfile ? { code: '42501', message: 'Synthetic denied' } : { is_admin: true, role: 'fan', roles: [] }), { status: options.deniedProfile ? 403 : 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error('Unexpected synthetic transport');
  };
  globalThis.fetch = fetch;
  const client = createClient('https://synthetic-admin.invalid', 'synthetic-public-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch } });
  // Mock only the local session read; user validation/MFA and profile transport use the installed real SDK.
  client.auth.getSession = async () => { ++sessionReads; return { data: { session: { access_token: incoming ? token({ sub: 'B', session_id: sidB }) : captured, user: user(incoming ? 'B' : 'A') } }, error: null }; };
  const mfa = load('lib/adminMfa.ts', { '@tapuai/shared-types/admin/adminMfa': sharedMfa });
  const authz = load('lib/authz.ts', { 'server-only': {}, '@/lib/adminMfa': mfa, '@/lib/supabase.server': { getSupabaseServerClient: async () => client }, '@/lib/portalSessionFrame': { portalSessionFrame }, '@tapuai/shared-types/backendConnection': { resolveBackendConnection } });
  try { return { result: await authz.getPortalSession(), wire, captured, sessionReads }; }
  finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
test('actual server user validation, scoped profile and fresh MFA all keep captured A after session read changes to B', async () => {
  const { result, wire, captured, sessionReads } = await serverCase();
  assert.equal(result.userId, 'A'); assert.equal(result.isAdmin, true); assert.equal(result.mfaStep, 'pass');
  assert.equal(result.frameId, await portalSessionFrame(captured, 'A')); assert.match(result.verificationId, /^[0-9a-f-]{36}$/);
  assert.equal(sessionReads, 1); assert.equal(wire.length, 3);
  assert.equal(wire.filter(item => item.path === '/auth/v1/user').length, 2);
  assert.ok(wire.every(item => item.auth === `Bearer ${captured}`));
  assert.equal(wire.find(item => item.path === '/rest/v1/profiles')?.userFilter, 'eq.A');
  assert.doesNotMatch(JSON.stringify(result), /signature|session_id|11111111/);
});
test('a validated user mismatch refuses the server gate before profile/MFA transport', async () => {
  const { result, wire } = await serverCase({ mismatch: true }); assert.equal(result, null); assert.equal(wire.length, 1);
});
test('a verified-token sub mismatch cannot reach profile authorization or publish a private frame', async () => {
  const { result, wire } = await serverCase({ malformedSub: true });
  assert.ok(!result || (!result.frameId && !result.isAdmin)); assert.equal(wire.length, 1);
});
test('profile read refusal cannot become admin authority', async () => {
  const { result, wire } = await serverCase({ deniedProfile: true }); assert.equal(result.isAdmin, false); assert.equal(wire.length, 2);
});
