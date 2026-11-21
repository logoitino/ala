/** Mount the real login form in an isolated DOM; only Auth and Next navigation use local boundary doubles. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { safeNextPath } from './adminMfa.ts';

const requirePortal = createRequire(new URL('../package.json', import.meta.url));
const requireMobile = createRequire(new URL('../../mobile/package.json', import.meta.url));
const requireEnvironment = createRequire(requireMobile.resolve('jest-environment-jsdom'));
const { JSDOM } = requireEnvironment('jsdom');
const React = requirePortal('react');
const { createRoot } = requirePortal('react-dom/client');
const ts = requirePortal('typescript');
const formSource = readFileSync(new URL('../components/LoginForm.tsx', import.meta.url), 'utf8');

async function submit(next: string, magicLink = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://portal-test.invalid/login' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const navigations: string[] = []; const redirects: string[] = [];
  const auth = {
    signInWithPassword: async () => ({ error: null }),
    signInWithOtp: async ({ options }: { options: { emailRedirectTo: string } }) => { redirects.push(options.emailRedirectTo); return { error: null }; },
  };
  const module = { exports: {} as { LoginForm: () => unknown } };
  const code = ts.transpileModule(formSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const boundaryRequire = (id: string) => {
    if (id === 'next/navigation') return { useRouter: () => ({ replace: (path: string) => navigations.push(path), refresh: () => undefined }), useSearchParams: () => new URLSearchParams({ next }) };
    if (id === '@/lib/supabase') return { getSupabaseBrowserClient: () => ({ auth }), isAdminPortalConfigured: () => true };
    if (id === '@/lib/adminMfa') return { safeNextPath };
    return requirePortal(id);
  };
  new Function('require', 'module', 'exports', code)(boundaryRequire, module, module.exports);
  const root = createRoot(dom.window.document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(module.exports.LoginForm)));
    if (magicLink) {
      const button = Array.from(dom.window.document.querySelectorAll('button')).find((item: any) => item.textContent === 'Magic link') as any;
      await React.act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    }
    await React.act(async () => dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    return { navigations, redirects };
  } finally {
    await React.act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as Record<string, unknown>)[key]; }
  }
}
for (const unsafe of ['https://elsewhere.invalid', '//elsewhere.invalid', 'javascript:alert(1)', '/\\elsewhere.invalid', '/a\nb']) {
  test(`password sign-in refuses unsafe return path ${JSON.stringify(unsafe)}`, async () => {
    assert.deepEqual((await submit(unsafe)).navigations, ['/']);
  });
}
test('password sign-in preserves a same-site destination and query', async () => {
  assert.deepEqual((await submit('/money?tab=ledger')).navigations, ['/money?tab=ledger']);
});
test('magic-link callback receives only the normalized same-site return path', async () => {
  const result = await submit('//elsewhere.invalid', true);
  assert.deepEqual(result.navigations, []);
  assert.equal(new URL(result.redirects[0]).searchParams.get('next'), '/');
});
