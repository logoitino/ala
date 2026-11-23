/** Mount the actual protected layout/private frame; Auth and server verification use synthetic controlled boundaries. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createAuthPublicationScope } from '../../../packages/shared-types/admin/authPublication.ts';

const requirePortal = createRequire(new URL('../package.json', import.meta.url));
const requireMobile = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { JSDOM } = createRequire(requireMobile.resolve('jest-environment-jsdom'))('jsdom');
const React = requirePortal('react');
const { createRoot } = requirePortal('react-dom/client');
const ts = requirePortal('typescript');
const sidA = '11111111-1111-4111-8111-111111111111';
const sidB = '22222222-2222-4222-8222-222222222222';
function token(userId: string, sessionId = sidA, aal = 'aal2') {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId, aal, exp: 4102444800 })).toString('base64url'), Buffer.from('synthetic-signature').toString('base64url')].join('.');
}
function frame(userId: string, sessionId = sidA, aal = 'aal2') {
  return createHash('sha256').update(JSON.stringify(['tapuai-private-frame-v1', userId, sessionId, aal])).digest('hex');
}
function session(userId: string, sessionId = sidA, aal = 'aal2') { return { user: { id: userId }, access_token: token(userId, sessionId, aal) }; }

async function mounted(check: (api: any) => Promise<void>, initial = session('A'), realSdkRecovery = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal-test.invalid/money' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
    // This isolated DOM has no cross-tab channel; prevent Node's BroadcastChannel from keeping the fixture open.
    ...(realSdkRecovery ? { BroadcastChannel: undefined } : {}),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const listeners: Array<(event: string, session: any) => void> = [];
  const publication = createAuthPublicationScope();
  let current: any = initial; let getSession = async () => ({ data: { session: current }, error: null });
  let verification = 'check-A-1'; let expectedFrame = frame('A'); let expectedUser = 'A'; let mounts = 0;
  const navigations: string[] = []; let refreshes = 0;
  let heldDigestToken: string | null = null; let digestWait: Promise<void> = Promise.resolve();
  let client: any = { auth: { getSession: () => getSession(), onAuthStateChange: (listener: any) => {
    listeners.push(listener); return { data: { subscription: { unsubscribe: () => listeners.splice(listeners.indexOf(listener), 1) } } };
  } } };
  let releaseRecovery = () => {};
  if (realSdkRecovery) {
    const { createClient } = requirePortal('@supabase/supabase-js');
    let finish!: () => void;
    const held = new Promise<void>(resolve => { finish = resolve; });
    let first = true;
    let stored: string | null = JSON.stringify({ ...initial, refresh_token: 'synthetic-refresh', expires_at: 4102444800,
      user: { ...initial.user, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2020-01-01' } });
    client = createClient('https://synthetic-browser.invalid', 'synthetic-public-key', {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'ux15-synthetic-browser',
        storage: { getItem: async (key: string) => {
          if (key !== 'ux15-synthetic-browser') return null;
          if (first) { first = false; await held; } return stored;
        }, setItem: async (_key: string, value: string) => { stored = value; }, removeItem: async () => { stored = null; } },
      }, global: { fetch: async () => { throw new Error('No initialization transport was expected'); } },
    });
    releaseRecovery = finish;
  }
  const mocks: Record<string, any> = {
    'next/navigation': { useRouter: () => ({ refresh: () => ++refreshes, replace: (path: string) => navigations.push(path) }), redirect: (path: string) => { throw new Error(path); } },
    '@/lib/supabase': { getSupabaseBrowserClient: () => client, authPublication: publication, isAdminPortalConfigured: () => true },
    '@/components/SignOutButton': { SignOutButton: () => React.createElement('button', null, 'Sign out') },
    '@/components/AccessRestricted': { AccessRestricted: () => React.createElement('p', null, 'Restricted') },
    '@/lib/adminMfa': { adminMfaHref: () => '/login/mfa' },
    '@/lib/authz': { getPortalSession: async () => ({ userId: expectedUser, email: null, isAdmin: true, mfaStep: 'pass', frameId: expectedFrame, verificationId: verification }) },
  };
  function load(relative: string): any {
    const path = new URL(`../${relative}`, import.meta.url);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    const boundaryRequire = (id: string): any => {
      if (id in mocks) return mocks[id];
      if (id === '@/components/PortalSessionBoundary') return load('components/PortalSessionBoundary.tsx');
      if (id === '@/lib/portalSessionFrame') {
        const actual = load('lib/portalSessionFrame.ts');
        return { ...actual, portalSessionFrame: async (jwt: string, userId: string) => {
          const digest = await actual.portalSessionFrame(jwt, userId);
          if (jwt === heldDigestToken) await digestWait;
          return digest;
        } };
      }
      return requirePortal(id);
    };
    new Function('require', 'module', 'exports', code)(boundaryRequire, module, module.exports); return module.exports;
  }
  const Layout = load('app/(protected)/layout.tsx').default;
  const root = createRoot(dom.window.document.getElementById('root'));
  async function settle() { await React.act(async () => { await new Promise(done => setTimeout(done, 15)); }); }
  function PrivateChild() { React.useEffect(() => { ++mounts; }, []); return React.createElement('span', null, `PRIVATE_${expectedUser}`); }
  async function render() { const element = await Layout({ children: React.createElement(PrivateChild) }); await React.act(async () => root.render(element)); await settle(); }
  async function emit(event: string, next: any) { current = next; await React.act(async () => { for (const listener of [...listeners]) listener(event, next); }); await settle(); }
  try {
    await render();
    await check({ text: () => dom.window.document.body.textContent ?? '', emit, session, frame, publication, token,
      server: async (user: string, sid: string, aal = 'aal2') => { expectedUser = user; expectedFrame = frame(user, sid, aal); verification = `check-${user}-${Math.random()}`; await render(); },
      staleServer: render, deferRead: (read: typeof getSession) => { getSession = read; }, settle,
      refreshes: () => refreshes, mounts: () => mounts, navigations, releaseRecovery,
      holdDigest: (jwt: string) => { heldDigestToken = jwt; let finish!: () => void; digestWait = new Promise<void>(resolve => { finish = resolve; }); return finish; },
      unmount: async () => React.act(async () => root.unmount()),
    });
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as Record<string, unknown>)[key]; }
  }
}

test('actual protected frame drops outgoing admin content on incoming account', async () => mounted(async api => {
  assert.match(api.text(), /PRIVATE_A/); await api.emit('SIGNED_IN', session('B', sidB)); assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('actual protected frame drops content on signout before another same-user signin', async () => mounted(async api => {
  await api.emit('SIGNED_OUT', null); assert.doesNotMatch(api.text(), /PRIVATE_A/);
  await api.emit('SIGNED_IN', session('A', sidB)); assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('initial hydration cannot render a stale server frame for the same UID new Auth session', async () => mounted(async api => {
  assert.doesNotMatch(api.text(), /PRIVATE_A/);
}, session('A', sidB)));
test('same-session AAL downgrade masks the previously verified privileged frame', async () => mounted(async api => {
  await api.emit('TOKEN_REFRESHED', session('A', sidA, 'aal1')); assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('same-session same-AAL token refresh preserves the mounted private child', async () => mounted(async api => {
  assert.equal(api.mounts(), 1);
  const refreshed = session('A'); refreshed.access_token += '-refreshed-signature';
  await api.emit('TOKEN_REFRESHED', refreshed);
  assert.match(api.text(), /PRIVATE_A/); assert.equal(api.mounts(), 1); assert.equal(api.refreshes(), 0);
}));
test('existing-session SIGNED_IN reconfirmation preserves its private frame without another report load', async () => mounted(async api => {
  await api.emit('SIGNED_IN', session('A'));
  assert.match(api.text(), /PRIVATE_A/); assert.equal(api.mounts(), 1); assert.equal(api.refreshes(), 0);
}));
test('an inconsistent incoming event UID cannot retain another user token frame', async () => mounted(async api => {
  const next = session('B', sidB); next.access_token = token('A');
  await api.emit('TOKEN_REFRESHED', next); assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('same-user signin after signout needs a new server verification even if the old token is replayed', async () => mounted(async api => {
  await api.emit('SIGNED_OUT', null); await api.emit('SIGNED_IN', session('A'));
  await api.staleServer(); assert.doesNotMatch(api.text(), /PRIVATE_A/);
  await api.server('A', sidA); assert.match(api.text(), /PRIVATE_A/);
}));
test('incoming B stays masked until its own newly authorized server frame arrives', async () => mounted(async api => {
  await api.emit('SIGNED_IN', session('B', sidB)); assert.doesNotMatch(api.text(), /PRIVATE_A|PRIVATE_B/);
  await api.server('B', sidB); assert.match(api.text(), /PRIVATE_B/); assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('a delayed old-cookie read cannot restore A after the incoming Auth event', async () => mounted(async api => {
  let finish!: (value: any) => void;
  const pending = new Promise(resolve => { finish = resolve; });
  api.deferRead(() => pending); await api.server('A', sidA);
  await api.emit('SIGNED_IN', session('B', sidB));
  finish({ data: { session: session('A') }, error: null }); await api.settle();
  assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('an abandoned scoped MFA notification cannot restore the outgoing private frame', async () => mounted(async api => {
  await api.emit('SIGNED_IN', session('B', sidB));
  await assert.rejects(api.publication.run(token('A'), () => { throw new Error('Account changed'); }, async () => {
    await api.emit('MFA_CHALLENGE_VERIFIED', session('A'));
  }), /Account changed/);
  assert.doesNotMatch(api.text(), /PRIVATE_A/);
}));
test('real SDK stored-session SIGNED_IN recovery before the initial digest does not reload or strand the authorized frame', async () => mounted(async api => {
  assert.doesNotMatch(api.text(), /PRIVATE_A/);
  api.releaseRecovery(); await api.settle(); await api.settle();
  assert.match(api.text(), /PRIVATE_A/); assert.equal(api.mounts(), 1); assert.equal(api.refreshes(), 0);
}, session('A'), true));
test('a changed-AAL refresh poisons the old verification before its digest await and refuses a replayed older token', async () => mounted(async api => {
  const release = api.holdDigest(token('A', sidA, 'aal1'));
  try {
    await api.emit('TOKEN_REFRESHED', session('A', sidA, 'aal1'));
    assert.doesNotMatch(api.text(), /PRIVATE_A/);
    await api.emit('TOKEN_REFRESHED', session('A'));
    assert.doesNotMatch(api.text(), /PRIVATE_A/);
    release(); await api.settle(); assert.doesNotMatch(api.text(), /PRIVATE_A/);
    await api.server('A', sidA); assert.match(api.text(), /PRIVATE_A/);
  } finally { release(); }
}));
