/** Real oversight modules/pages; failed provider reads stay unknown rather than becoming zero/live. */
import assert from 'node:assert/strict'; import test from 'node:test';
import { readFileSync } from 'node:fs'; import { createRequire } from 'node:module';
const requirePortal = createRequire(new URL('../package.json', import.meta.url)); const ts = requirePortal('typescript'); const React = requirePortal('react');
const shared = requirePortal('@tapuai/shared-types');
function load(path: string, boundary: (id: string) => unknown) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)((id: string) => boundary(id) ?? requirePortal(id), module, module.exports); return module.exports;
}
async function fetchOversight(kind: 'profile' | 'softWall', failed: number | null, missingRuntime = false) {
  let index = 0;
  const responses = [
    { data: missingRuntime ? null : { published: { profile: { showCard: false }, buttons: { malo: false } } }, error: null },
    { count: 0, error: null }, { count: 0, error: null },
  ];
  if (failed !== null) responses[failed] = { ...responses[failed], error: { message: 'Synthetic access denied', code: '42501' } } as any;
  const client = { from() { const result = responses[index++]; const query: any = { then: (resolve: any) => Promise.resolve(result).then(resolve) }; for (const key of ['select', 'eq', 'not', 'or', 'gte', 'maybeSingle']) query[key] = () => query; return query; } };
  const module = load(`./${kind}.ts`, (id) => id === '@/lib/supabase.server' ? { getSupabaseServerClient: async () => client } : id === '@tapuai/shared-types' ? shared : undefined);
  return kind === 'profile' ? module.fetchProfileOversight() : module.fetchSoftWallOversight();
}
for (const kind of ['profile', 'softWall'] as const) {
  for (const failed of [0, 1, 2]) test(`${kind} denies authoritative status when query ${failed} fails`, async () => assert.equal((await fetchOversight(kind, failed)).configured, false));
  test(`${kind} missing runtime is unavailable`, async () => assert.equal((await fetchOversight(kind, null, true)).configured, false));
  test(`${kind} confirmed zero counts stay a valid configured result`, async () => { const value = await fetchOversight(kind, null); assert.equal(value.configured, true); assert.equal(kind === 'profile' ? value.claimedAthletes : value.fanProfiles, 0); });
}
for (const kind of ['profile', 'auth'] as const) test(`${kind} page renders unknown status for unavailable reads`, async () => {
  const oversight = await fetchOversight(kind === 'profile' ? 'profile' : 'softWall', 1);
  oversight.configured = false;
  const Page = load(`../app/(protected)/${kind}/page.tsx`, (id) => {
    if (id === '@/lib/profile') return { fetchProfileOversight: async () => oversight };
    if (id === '@/lib/softWall') return { fetchSoftWallOversight: async () => oversight, fetchPortalRuntime: async () => ({ configured: false }) };
    if (id === '@/components/PortalShell') return {
      PortalShell: ({ children }: any) => React.createElement('div', null, children), Panel: ({ children }: any) => React.createElement('section', null, children),
      StatCard: ({ label, value }: any) => React.createElement('p', null, `${label}: ${value}`), Badge: ({ children }: any) => React.createElement('span', null, children),
      SectionHeading: ({ title }: any) => React.createElement('h2', null, title), FlagStatusList: () => React.createElement('div', null, 'Live flags'),
    };
  }).default;
  const html = requirePortal('react-dom/server').renderToStaticMarkup(await Page());
  assert.match(html, /Unavailable|unavailable/);
  if (kind === 'profile') { assert.doesNotMatch(html, /Claimed athletes: 0|Athlete profiles: 0|Flip Aura card: Live/); assert.doesNotMatch(html, />On<|>Off</); }
  else assert.doesNotMatch(html, /Soft Wall: Armed|Soft Wall: Paused/);
});
