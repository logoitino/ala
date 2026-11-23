/** UX15 actual Next request/response and production server-boundary source; synthetic verified Auth only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolveBackendConnection } from '../../../packages/shared-types/backendConnection.ts';
import { adminMfaHref } from './adminMfa.ts';

const portal = fileURLToPath(new URL('../', import.meta.url));
const requirePortal = createRequire(`${portal}/package.json`);
const ts = requirePortal('typescript');
const { NextRequest, NextResponse } = requirePortal('next/server');
const { redirect } = requirePortal('next/navigation');
const AccessRestricted = () => null;
const PortalSessionBoundary = () => null;

function load(relative: string, boundaries: Record<string, unknown>) {
  const source = readFileSync(`${portal}/${relative}`, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} as any };
  const boundaryRequire = (id: string) => id in boundaries ? boundaries[id] : requirePortal(id);
  new Function('require', 'module', 'exports', '__dirname', output)(boundaryRequire, module, module.exports, portal);
  return module.exports;
}
function layout(configured: boolean, session: null | { isAdmin: boolean; mfaStep: string; frameId?: string | null }) {
  let reads = 0;
  const module = load('app/(protected)/layout.tsx', {
    'next/navigation': { redirect }, '@/components/AccessRestricted': { AccessRestricted },
    '@/components/PortalSessionBoundary': { PortalSessionBoundary },
    '@/lib/adminMfa': { adminMfaHref }, '@/lib/supabase': { isAdminPortalConfigured: () => configured },
    '@/lib/authz': { getPortalSession: async () => { ++reads; return session ? { userId: 'A', verificationId: 'synthetic-check', ...session, frameId: session.frameId === undefined ? 'synthetic-frame' : session.frameId } : null; } },
  });
  return { render: () => module.default({ children: 'synthetic-private-admin-child' }), reads: () => reads };
}
const isRedirect = (path: string) => (error: unknown) => Boolean(error && typeof error === 'object' && 'digest' in error && String(error.digest).includes(`;${path};`));
test('unconfigured protected server layout never renders its administrative children', async () => {
  const view = layout(false, null); let output: any;
  try { output = await view.render(); } catch (error) { assert.equal(isRedirect('/login')(error), true); }
  assert.notEqual(output?.props?.children, 'synthetic-private-admin-child'); assert.equal(view.reads(), 0);
});
test('a configured signed-out direct server render goes to login', async () => { await assert.rejects(layout(true, null).render(), isRedirect('/login')); });
test('a verified nonadmin server session renders only AccessRestricted', async () => {
  const output = await layout(true, { isAdmin: false, mfaStep: 'off' }).render(); assert.equal(output.type, AccessRestricted);
});
for (const step of ['enroll', 'verify']) test(`verified admin ${step} cannot render protected children`, async () => { await assert.rejects(layout(true, { isAdmin: true, mfaStep: step }).render(), isRedirect(adminMfaHref('/'))); });
test('verified aal2 admin keeps the authorized desk render', async () => { const output = await layout(true, { isAdmin: true, mfaStep: 'pass' }).render(); assert.equal(output.props.children, 'synthetic-private-admin-child'); });
test('missing session assertion never passes private children into the browser boundary', async () => {
  const output = await layout(true, { isAdmin: true, mfaStep: 'pass', frameId: null }).render();
  assert.equal(output.type, PortalSessionBoundary); assert.equal(output.props.children, null);
});

async function request(configured: boolean | 'invalid', signedIn: boolean, pathname: string, step = 'pass') {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (configured) { process.env.NEXT_PUBLIC_SUPABASE_URL = configured === 'invalid' ? 'not-a-backend-url' : 'https://synthetic-admin.invalid'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-synthetic-key'; }
  else { delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; }
  let validates = 0;
  const module = load('middleware.ts', {
    'next/server': { NextRequest, NextResponse }, '@tapuai/shared-types/backendConnection': { resolveBackendConnection },
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => { ++validates; return { data: { user: signedIn ? { id: 'synthetic-admin-A' } : null }, error: null }; } } }) },
    '@/lib/adminMfa': { adminMfaHref, isAdminMfaRequired: () => true, readAdminMfaStep: async () => step },
  });
  try { return { response: await module.middleware(new NextRequest(`http://localhost:3001${pathname}`)), validates }; }
  finally { if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl; if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey; }
}
test('unconfigured middleware refuses a deliberate private route request', async () => { const { response, validates } = await request(false, false, '/product/people'); assert.equal(response.status, 307); assert.equal(new URL(response.headers.get('location')).pathname, '/login'); assert.equal(validates, 0); });
test('unconfigured login remains available without a redirect loop', async () => { const { response } = await request(false, false, '/login'); assert.equal(response.status, 200); });
test('configured middleware verifies the user and redirects a guest direct URL', async () => { const { response, validates } = await request(true, false, '/product/people?tab=flags'); assert.equal(validates, 1); assert.equal(response.status, 307); assert.equal(new URL(response.headers.get('location')).searchParams.get('next'), '/product/people?tab=flags'); });
test('configured aal1 admin middleware retains the MFA redirect', async () => { const { response } = await request(true, true, '/money', 'verify'); assert.equal(response.status, 307); assert.equal(new URL(response.headers.get('location')).pathname, '/login/mfa'); });
test('configured aal2 admin middleware retains authorized requests', async () => { const { response } = await request(true, true, '/money'); assert.equal(response.status, 200); });

test('invalid configured backend cannot authorize a private URL or invoke Auth', async () => {
  const { response, validates } = await request('invalid', true, '/money');
  assert.equal(response.status, 307); assert.equal(validates, 0);
  assert.equal(new URL(response.headers.get('location')!).pathname, '/login');
});

test('portal documents and Auth responses refuse shared caching, indexing and framing', async () => {
  const config = load('next.config.ts', {}).default;
  const rules = await config.headers();
  const { getPathMatch } = requirePortal('next/dist/shared/lib/router/utils/path-match');
  for (const path of ['/', '/money', '/product/people', '/login', '/login/mfa', '/auth/callback']) {
    const headers = new Map<string, string>(rules.filter((rule: any) => getPathMatch(rule.source)(path)).flatMap((rule: any) => rule.headers.map((header: any) => [header.key, header.value])));
    assert.match(headers.get('Cache-Control')!, /private.*no-store/);
    assert.equal(headers.get('Content-Security-Policy'), "frame-ancestors 'none'");
    assert.equal(headers.get('X-Frame-Options'), 'DENY');
    assert.match(headers.get('X-Robots-Tag')!, /noindex/);
  }
  for (const asset of ['/_next/static/media/font.ttf', '/_next/static/chunks/app.js', '/_next/image?url=icon.png', '/favicon.ico', '/icon.png']) {
    assert.equal(rules.some((rule: any) => Boolean(getPathMatch(rule.source)(asset.split('?')[0]))), false, asset);
  }
});

test('root metadata marks the private portal as nonindexable while preserving local fonts', () => {
  const font = () => ({ variable: 'synthetic-bundled-font' });
  const { metadata } = load('app/layout.tsx', { 'next/font/local': font, './globals.css': {} });
  assert.equal(metadata.robots.index, false); assert.equal(metadata.robots.follow, false);
});
