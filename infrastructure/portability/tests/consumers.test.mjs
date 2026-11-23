/** Exercise actual client boundaries and refuse unconfigured private pages while keeping login reachable; no network or private env. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { resolveBackendConnection } from '../../../packages/shared-types/backendConnection.ts';
import { createAuthPublicationScope } from '../../../packages/shared-types/admin/authPublication.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ts = createRequire(path.join(root, 'apps/mobile/package.json'))('typescript');
const { parseCookieHeader, serializeCookieHeader, stringFromBase64URL } =
  createRequire(path.join(root, 'apps/admin-portal/package.json'))('@supabase/ssr');
const files = {
  mobile: 'apps/mobile/src/frontend/lib/supabase.ts',
  browser: 'apps/admin-portal/lib/supabase.ts',
  server: 'apps/admin-portal/lib/supabase.server.ts',
  middleware: 'apps/admin-portal/middleware.ts',
  callback: 'apps/admin-portal/app/auth/callback/route.ts',
};

function env(url = 'https://compatible.example', publicKey = 'sb_publishable_synthetic') {
  return { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: publicKey,
    NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey };
}

// Transpile only the owned module, replacing external dependencies at the actual import boundary.
function load(which, environment = env(), options = {}) {
  const calls = [], warnings = [], storage = new Map(), responseCookies = new Map(), requestCookies = new Map();
  const cookieWrites = [], cookieValues = [{ name: 'session', value: 'synthetic-session' }];
  let cookieReads = 0, authReads = 0, mfaReads = 0;
  const client = { auth: {
    getUser: async () => { authReads++; return { data: { user: options.user ?? null } }; },
    exchangeCodeForSession: async code => { calls.push({ exchange: code }); },
  } };
  const cookieStore = {
    getAll: () => cookieValues,
    set: (...args) => { if (options.readonlyCookies) throw new Error('Render cannot write'); cookieWrites.push(args); },
  };
  function cookieJar(map) {
    return { getAll: () => [...map].map(([name, value]) => ({ name, value })),
      set: (name, value) => { if (typeof name === 'object') map.set(name.name, name.value); else map.set(name, value); } };
  }
  const nextResponse = {
    next: () => ({ kind: 'next', cookies: cookieJar(responseCookies) }),
    redirect: url => ({ kind: 'redirect', url: String(url), cookies: cookieJar(new Map()) }),
  };
  const sdk = (url, key, config) => { calls.push({ url, key, config }); return client; };
  const nativeStorage = { native: true, getItem: async key => storage.get(key) ?? null,
    setItem: async (key, value) => { storage.set(key, value); }, removeItem: async key => { storage.delete(key); } };
  const webStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } };
  const mocks = {
    '@tapuai/shared-types/backendConnection': { resolveBackendConnection },
    '@tapuai/shared-types/admin/authPublication': { createAuthPublicationScope },
    '@supabase/ssr': { createBrowserClient: sdk, createServerClient: sdk,
      parseCookieHeader, serializeCookieHeader, stringFromBase64URL },
    '@supabase/supabase-js': { createClient: sdk },
    'react-native': { Platform: { OS: options.platform ?? 'ios' } },
    'react-native-url-polyfill/auto': {},
    '@react-native-async-storage/async-storage': nativeStorage,
    'server-only': {},
    'next/headers': { cookies: async () => { cookieReads++; return cookieStore; } },
    'next/server': { NextResponse: nextResponse },
    '@/lib/adminMfa': { isAdminMfaRequired: () => Boolean(options.mfa),
      readAdminMfaStep: async (passedClient, user, mode) => {
        assert.equal(passedClient, client); assert.equal(user, options.user); assert.equal(mode, 'local'); mfaReads++;
        return 'verify';
      }, adminMfaHref: next => `/login/mfa?next=${encodeURIComponent(next)}` },
  };
  const module = { exports: {} };
  const context = { module, exports: module.exports, process: { env: { ...environment } }, URL, Headers, Request, Response,
    fetch: async () => { throw new Error('Unexpected network request in portability fixture'); },
    console: { warn: value => warnings.push(String(value)) },
    require: name => { if (!(name in mocks)) throw new Error(`Unexpected dependency ${name}`); return mocks[name]; } };
  if (options.window) context.window = { localStorage: webStorage };
  const source = fs.readFileSync(path.join(root, files[which]), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, context, { filename: files[which] });
  return { api: module.exports, calls, warnings, nativeStorage, cookieWrites, cookieValues,
    requestCookies, responseCookies, client,
    get cookieReads() { return cookieReads; }, get authReads() { return authReads; }, get mfaReads() { return mfaReads; },
    request: pathname => ({ url: `https://portal.example${pathname}`, nextUrl: new URL(`https://portal.example${pathname}`), cookies: cookieJar(requestCookies) }) };
}

test('each configured consumer constructs the SDK with normalized portable origins and the public key', async () => {
  for (const [raw, normalized] of [['https://COMPATIBLE.example/', 'https://compatible.example'], ['http://127.0.0.1:54321/', 'http://127.0.0.1:54321']]) {
    for (const which of Object.keys(files)) {
      const loaded = load(which, env(raw));
      if (which === 'browser') { assert.equal(loaded.api.isAdminPortalConfigured(), true); loaded.api.getSupabaseBrowserClient(); }
      else if (which === 'server') await loaded.api.getSupabaseServerClient();
      else if (which === 'middleware') await loaded.api.middleware(loaded.request('/health'));
      else if (which === 'callback') await loaded.api.GET(new Request('https://portal.example/auth/callback?code=synthetic'));
      else assert.equal(loaded.api.isSupabaseConfigured, true);
      assert.equal(loaded.calls[0].url, normalized, which);
      assert.equal(loaded.calls[0].key, 'sb_publishable_synthetic', which);
    }
  }
});

test('missing or invalid inputs never pass a rejected origin/secret into an SDK or consume request cookies', async () => {
  const jwt = role => {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256' })}.${encode({ role })}.${Buffer.from('synthetic').toString('base64url')}`;
  };
  for (const [url, key] of [[undefined, undefined], ['', 'sb_publishable_synthetic'],
    ['https://compatible.example/private', 'sb_publishable_synthetic'],
    ['https://compatible.example', 'sb_secret_PRIVATE_MARKER'],
    ['https://compatible.example', '${PRIVATE_MARKER}'],
    ['https://compatible.example', jwt('service_role')], ['https://compatible.example', jwt('authenticated')]]) {
    const configuration = env(url, key);
    // Explicit undefined must stay missing, rather than the convenience fixture's default parameters.
    if (url === undefined) for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) delete configuration[name];
    if (key === undefined) for (const name of ['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) delete configuration[name];
    for (const which of Object.keys(files)) {
      const loaded = load(which, configuration);
      if (which === 'mobile') {
        assert.equal(loaded.api.isSupabaseConfigured, false);
        assert.equal(loaded.calls[0].url, 'http://127.0.0.1:1');
        assert.equal(loaded.calls[0].key, 'public-anon-key');
        assert.equal(loaded.warnings.length, 1);
        assert.equal(loaded.warnings[0].includes('PRIVATE_MARKER'), false);
      } else {
        if (which === 'browser') { assert.equal(loaded.api.isAdminPortalConfigured(), false); assert.equal(loaded.api.getSupabaseBrowserClient(), null); }
        if (which === 'server') assert.equal(await loaded.api.getSupabaseServerClient(), null);
        if (which === 'middleware') {
          // Missing configuration cannot verify private access, but must not trap the setup/login page.
          const denied = await loaded.api.middleware(loaded.request('/health'));
          assert.equal(denied.kind, 'redirect');
          assert.equal(denied.url, 'https://portal.example/login?next=%2Fhealth');
          assert.equal((await loaded.api.middleware(loaded.request('/login'))).kind, 'next');
        }
        if (which === 'callback') await loaded.api.GET(new Request('https://portal.example/auth/callback?code=synthetic'));
        assert.equal(loaded.calls.length, 0, which);
        assert.equal(loaded.cookieReads, 0, which);
        assert.equal(loaded.authReads, 0, which);
      }
    }
  }
});

test('mobile retains native persistence, browser storage and isolated nonrefreshing web SSR storage', async () => {
  const native = load('mobile');
  const nativeAuth = native.calls[0].config.auth;
  await nativeAuth.storage.setItem('session', 'synthetic-native');
  assert.equal(await native.nativeStorage.getItem('session'), 'synthetic-native');
  await native.nativeStorage.setItem('session', 'synthetic-native-updated');
  assert.equal(await nativeAuth.storage.getItem('session'), 'synthetic-native-updated');
  let current = true;
  await assert.rejects(native.api.authPublication.run('synthetic-scoped-token',
    () => { if (!current) throw new Error('The account changed.'); },
    () => { current = false; return nativeAuth.storage.setItem('session', JSON.stringify({ access_token: 'synthetic-scoped-token' })); }),
    /account changed/i);
  assert.equal(await native.nativeStorage.getItem('session'), 'synthetic-native-updated');
  await nativeAuth.storage.removeItem('session');
  assert.equal(await native.nativeStorage.getItem('session'), null);
  assert.equal(nativeAuth.persistSession, true); assert.equal(nativeAuth.autoRefreshToken, true);
  assert.equal(nativeAuth.detectSessionInUrl, false);
  const topics = [native.api.nextRealtimeTopic('same'), native.api.nextRealtimeTopic('same')];
  assert.notEqual(topics[0], topics[1]);
  const web = load('mobile', env(), { platform: 'web', window: true });
  const browserStorage = web.calls[0].config.auth.storage;
  await browserStorage.setItem('session', 'synthetic'); assert.equal(await browserStorage.getItem('session'), 'synthetic');
  await browserStorage.removeItem('session'); assert.equal(await browserStorage.getItem('session'), null);
  const ssr = load('mobile', env(), { platform: 'web' });
  const ssrAuth = ssr.calls[0].config.auth;
  assert.equal(ssrAuth.persistSession, false); assert.equal(ssrAuth.autoRefreshToken, false);
  await ssrAuth.storage.setItem('session', 'synthetic'); assert.equal(await ssrAuth.storage.getItem('session'), 'synthetic');
  assert.equal(await load('mobile', env(), { platform: 'web' }).calls[0].config.auth.storage.getItem('session'), null);
  await ssrAuth.storage.removeItem('session'); assert.equal(await ssrAuth.storage.getItem('session'), null);
});

test('server client and callback preserve request cookie reads, refresh writes and code exchange', async () => {
  for (const readonlyCookies of [false, true]) {
    const server = load('server', env(), { readonlyCookies });
    await server.api.getSupabaseServerClient();
    const cookies = server.calls[0].config.cookies;
    assert.equal(cookies.getAll(), server.cookieValues);
    assert.doesNotThrow(() => cookies.setAll([{ name: 'new-session', value: 'refreshed', options: { httpOnly: true } }]));
    assert.equal(server.cookieWrites.length, readonlyCookies ? 0 : 1);
  }
  const callback = load('callback');
  const response = await callback.api.GET(new Request('https://portal.example/auth/callback?code=synthetic&next=%2Fhealth'));
  callback.calls[0].config.cookies.setAll([{ name: 'session', value: 'fresh', options: { secure: true } }]);
  assert.equal(callback.cookieWrites[0][1], 'fresh');
  assert.equal(callback.calls[1].exchange, 'synthetic');
  assert.equal(response.url, 'https://portal.example/health');
});

test('middleware still validates getUser, redirects guests and copies refreshed cookies through MFA redirects', async () => {
  const guest = load('middleware');
  assert.equal((await guest.api.middleware(guest.request('/health?tab=errors'))).url,
    'https://portal.example/login?next=%2Fhealth%3Ftab%3Derrors');
  assert.equal(guest.authReads, 1);
  assert.equal((await load('middleware').api.middleware(guest.request('/login'))).kind, 'next');
  // Preserve the exact user object checked by the MFA fake.
  const originalUser = { id: 'synthetic-admin' };
  const mfa = load('middleware', env(), { user: originalUser, mfa: true });
  mfa.client.auth.getUser = async () => {
    mfa.calls[0].config.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true } }]);
    return { data: { user: originalUser } };
  };
  const response = await mfa.api.middleware(mfa.request('/health?tab=errors'));
  assert.equal(mfa.mfaReads, 1);
  assert.equal(mfa.requestCookies.get('session'), 'refreshed');
  assert.equal(response.cookies.getAll()[0].value, 'refreshed');
  assert.match(response.url, /\/login\/mfa\?next=%2Fhealth%3Ftab%3Derrors$/);
});
