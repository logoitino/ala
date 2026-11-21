/** Actual sign-out control mounted in a DOM; synthetic pending/error Auth boundary only. */
import assert from 'node:assert/strict'; import test from 'node:test'; import { readFileSync } from 'node:fs'; import { createRequire } from 'node:module'; import { mfaErrorText } from './adminMfa.ts';
const requirePortal = createRequire(new URL('../package.json', import.meta.url)); const requireMobile = createRequire(new URL('../../mobile/package.json', import.meta.url));
const { JSDOM } = createRequire(requireMobile.resolve('jest-environment-jsdom'))('jsdom'); const React = requirePortal('react'); const ts = requirePortal('typescript');
async function mounted(run: (view: any) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal-test.invalid' }); const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  let calls = 0; let clears = 0; let finish!: (value: any) => void; let response = new Promise<any>((done) => { finish = done; }); const navigations: string[] = [];
  const auth = { signOut: () => { ++calls; return response; } }; const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL('../components/SignOutButton.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundaryRequire = (id: string) => id === '@/lib/supabase' ? { getSupabaseBrowserClient: () => ({ auth }) } : id === '@/lib/adminMfa' ? { mfaErrorText } : id === 'next/navigation' ? { useRouter: () => ({ replace: (path: string) => navigations.push(path), refresh() {} }) } : requirePortal(id);
  new Function('require', 'module', 'exports', code)(boundaryRequire, module, module.exports);
  const root = requirePortal('react-dom/client').createRoot(dom.window.document.getElementById('root'));
  const click = async (twice = false) => React.act(async () => { const button = dom.window.document.querySelector('button'); button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); if (twice) button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  try { await React.act(async () => root.render(React.createElement(module.exports.SignOutButton, { onBeforeSignOut: () => ++clears }))); await run({ dom, click, calls: () => calls, clears: () => clears, finish: async (value: any) => React.act(async () => finish(value)), retryResponse: () => { response = Promise.resolve({ error: null }); }, navigations }); }
  finally { finish({ error: null }); await React.act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
}
test('sign-out invalidates setup before awaiting Auth and has one synchronous flight', async () => mounted(async ({ click, clears, calls, finish }) => { await click(true); assert.equal(clears(), 1); assert.equal(calls(), 1); await finish({ error: null }); }));
test('a denied sign-out displays its failure and can be retried without false navigation', async () => mounted(async ({ click, dom, finish, retryResponse, navigations, calls }) => {
  await click(); await finish({ error: { message: 'Synthetic sign-out failure' } }); assert.deepEqual(navigations, []); assert.match(dom.window.document.querySelector('[role="alert"]')?.textContent ?? '', /Synthetic sign-out failure/); assert.equal(dom.window.document.querySelector('button').disabled, false);
  retryResponse(); await click(); assert.equal(calls(), 2); assert.deepEqual(navigations, ['/login']);
}));
