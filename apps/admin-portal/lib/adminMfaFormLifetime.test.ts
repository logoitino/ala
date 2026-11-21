/** Mounted production MFA form; Auth/factor/navigation boundaries use synthetic deferred operations. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { mfaErrorText, normalizeTotpCode } from './adminMfa.ts';
const requirePortal = createRequire(new URL('../package.json', import.meta.url));
const requireMobile = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { JSDOM } = createRequire(requireMobile.resolve('jest-environment-jsdom'))('jsdom');
const React = requirePortal('react'); const ts = requirePortal('typescript');
const source = readFileSync(new URL('../components/AdminMfaForm.tsx', import.meta.url), 'utf8');
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
async function mounted(run: (view: any) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal-test.invalid/login/mfa' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let listener: ((event: string, session: unknown) => void) | undefined;
  let begins = 0; let verifies = 0; const setup = deferred<any>(); const verification = deferred<void>(); const navigations: string[] = [];
  const helpers = { startTotpSetup: () => { ++begins; return setup.promise; }, verifiedTotpFactorId: async () => 'factor-A', verifyTotpCode: () => { ++verifies; return verification.promise; } };
  const auth = { getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'synthetic-A' } }, error: null }), onAuthStateChange: (callback: typeof listener) => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; } };
  const module = { exports: {} as { AdminMfaForm: unknown } };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundaryRequire = (id: string) => {
    if (id === 'next/navigation') return { useRouter: () => ({ replace: (path: string) => navigations.push(path), refresh() {} }) };
    if (id === '@/lib/supabase') return { getSupabaseBrowserClient: () => ({ auth }), authPublication: { isCurrent: () => true } };
    if (id === '@/lib/adminMfa') return { mfaErrorText, normalizeTotpCode };
    if (id === '@/lib/adminMfaClient') return helpers;
    if (id === '@/components/SignOutButton') return { SignOutButton: () => React.createElement('button', null, 'Sign out') };
    return requirePortal(id);
  };
  new Function('require', 'module', 'exports', code)(boundaryRequire, module, module.exports);
  const { createRoot } = requirePortal('react-dom/client'); const root = createRoot(dom.window.document.getElementById('root'));
  const render = async (userId = 'A') => React.act(async () => root.render(React.createElement(module.exports.AdminMfaForm, { mode: 'enroll', userId, next: '/money', email: `${userId}@synthetic.invalid` })));
  const click = async (twice = false) => React.act(async () => { const button = Array.from(dom.window.document.querySelectorAll('button')).find((b: any) => b.textContent === 'Set up an authenticator app') as any; button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); if (twice) button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  const enterCode = async () => React.act(async () => {
    const input = dom.window.document.querySelector('input');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(input, '123456');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  const submit = async () => React.act(async () => { const form = dom.window.document.querySelector('form'); form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); });
  try { await render(); await run({ dom, render, click, setup, verification, enterCode, submit, verifies: () => verifies, authChange: async () => React.act(async () => listener?.('SIGNED_IN', { user: { id: 'B' }, access_token: 'synthetic-B' })), begins: () => begins, navigations }); }
  finally { await React.act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
}
test('account prop change clears an existing outgoing setup key immediately', async () => mounted(async ({ click, setup, dom, render }) => {
  await click(); await React.act(async () => setup.resolve({ factorId: 'factor-A', qrCode: 'data:image/svg+xml,<svg/>', secret: 'synthetic-secret-A' }));
  assert.match(dom.window.document.body.textContent, /synthetic-secret-A/);
  await render('B'); assert.doesNotMatch(dom.window.document.body.textContent, /synthetic-secret-A/);
}));
test('browser Auth account change clears setup without waiting for a server rerender', async () => mounted(async ({ click, setup, dom, authChange }) => {
  await click(); await React.act(async () => setup.resolve({ factorId: 'factor-A', qrCode: 'data:image/svg+xml,<svg/>', secret: 'synthetic-secret-A' }));
  await authChange(); assert.doesNotMatch(dom.window.document.body.textContent, /synthetic-secret-A/); assert.doesNotMatch(dom.window.document.body.textContent, /A@synthetic.invalid/);
}));
test('a late outgoing enrollment cannot repopulate the incoming form', async () => mounted(async ({ click, setup, dom, render }) => {
  await click(); await render('B'); await React.act(async () => setup.resolve({ factorId: 'factor-A', qrCode: 'data:image/svg+xml,<svg/>', secret: 'synthetic-secret-A' }));
  assert.doesNotMatch(dom.window.document.body.textContent, /synthetic-secret-A/);
}));
test('two setup click events before a render issue only one enrollment', async () => mounted(async ({ click, begins }) => { await click(true); assert.equal(begins(), 1); }));
test('keyboard submit is single-flight and an outgoing verification cannot navigate', async () => mounted(async ({ click, setup, enterCode, submit, verifies, verification, authChange, navigations }) => {
  await click(); await React.act(async () => setup.resolve({ factorId: 'factor-A', qrCode: 'data:image/svg+xml,<svg/>', secret: 'synthetic-secret-A' }));
  await enterCode(); await submit(); assert.equal(verifies(), 1);
  await authChange(); await React.act(async () => verification.resolve(undefined)); assert.deepEqual(navigations, []);
}));
