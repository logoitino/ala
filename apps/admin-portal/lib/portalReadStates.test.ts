/** Actual existing readers/pages: denial and partial success never become healthy zero; refresh repeats the protected request. Offline fixture boundaries do not validate hosted Auth/RLS. */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const base = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const req = createRequire(base + '/package.json');
const ts = req('typescript');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
function loader(boundary: (id: string) => unknown) { const cache = new Map<string, {
    exports: any;
}>(); function load(file: string): any { let target: string | undefined = file; if (fs.existsSync(target) && fs.statSync(target).isDirectory())
    target = path.join(target, 'index'); if (!fs.existsSync(target))
    target = ['.ts', '.tsx', '.js'].map(ext => target! + ext).find(p => fs.existsSync(p)); if (!target)
    throw Error('Missing ' + file); if (cache.has(target))
    return cache.get(target)!.exports; const mod: {
    exports: any;
} = { exports: {} }; cache.set(target, mod); const code = ts.transpileModule(fs.readFileSync(target, 'utf8'), { fileName: target, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; new Function('require', 'module', 'exports', code)((id: string) => { const replacement = boundary(id); if (replacement !== undefined)
    return replacement; if (id === './SignOutButton' || id === '@/components/SignOutButton')
    return { SignOutButton: () => React.createElement('button', { disabled: true }, 'Synthetic sign-out placeholder') }; if (id.startsWith('@/'))
    return load(base + '/' + id.slice(2)); if (id.startsWith('.'))
    return load(path.resolve(path.dirname(target), id)); return req(id); }, mod, mod.exports); return mod.exports; } return load; }
function setup({ denyRuntime = false, denyAll = false, denyRecent = false, denyRoster = false, rejectRuntime = false, all = 7, recent = 3 } = {}) { const denied = { code: '42501', message: 'Synthetic access denied' }; const client = { from(table: string) { let head = false, week = false; const query: any = { select(_columns: string, options: any) { head = options?.head === true; return query; }, gte() { week = true; return query; }, then(resolve: any, reject: any) { if (table === 'app_runtime_config' && rejectRuntime)
            return Promise.reject(new Error('Synthetic transport rejected')).then(resolve, reject); let value: any; if (table === 'app_runtime_config')
            value = { data: denyRuntime ? null : { published: { buttons: { malo: false } }, draft: {}, published_at: '2026-11-22T00:00:00Z' }, error: denyRuntime ? denied : null };
        else if (head)
            value = { count: (week ? denyRecent : denyAll) ? null : (week ? recent : all), error: (week ? denyRecent : denyAll) ? denied : null };
        else
            value = { data: denyRoster ? null : [], error: denyRoster ? denied : null }; return Promise.resolve(value).then(resolve, reject); } }; for (const key of ['eq', 'or', 'order', 'limit', 'maybeSingle'])
        query[key] = () => query; return query; } }; const load = loader(id => id === '@/lib/supabase.server' ? { getSupabaseServerClient: async () => client } : undefined); return { load, helper: load(base + '/lib/softWall.ts') }; }
function text(html: string) { return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '); }
async function render(kind: string, options: Parameters<typeof setup>[0]) { const { load } = setup(options); return text(renderToStaticMarkup(await load(base + '/app/(protected)/' + kind + '/page.tsx').default())); }
test('configured denied runtime is an error, not missing environment', async () => { const output = await render('features', { denyRuntime: true }); assert.doesNotMatch(output, /Supabase env missing/); assert.match(output, /could not|failed|access denied/i); });
test('denied fan total stays unknown and confirmed recent total remains3', async () => { const { helper } = setup({ denyAll: true }); const value = await helper.fetchSoftWallOversight(); assert.equal(value.fanProfiles, null); assert.equal(value.fansLast7d, 3); });
test('denied runtime preserves separately confirmed fan counts', async () => { const { helper } = setup({ denyRuntime: true }); const value = await helper.fetchSoftWallOversight(); assert.equal(value.fanProfiles, 7); assert.equal(value.fansLast7d, 3); });
test('People never presents denied total as healthy zero', async () => { const output = await render('people', { denyAll: true }); assert.doesNotMatch(output, /Fan profiles \(all\) 0/); assert.match(output, /Fan profiles \(all\) (?:—|Unavailable|Unknown)/); });
test('confirmed zero counts remain measured zero', async () => { const { helper } = setup({ all: 0, recent: 0 }); const value = await helper.fetchSoftWallOversight(); assert.equal(value.fanProfiles, 0); assert.equal(value.fansLast7d, 0); assert.equal(value.configured, true); const output = await render('people', { all: 0, recent: 0 }); assert.match(output, /Fan profiles \(all\) 0/); });
test('Features has an explicit current-route full-request refresh', async () => { const { load } = setup(); const html = renderToStaticMarkup(await load(base + '/app/(protected)/features/page.tsx').default()); assert.match(html, /<a[^>]*href="\/features"[^>]*>[^<]*Refresh view/); });
test('a failed count cannot suppress independently confirmed published flags', async () => { const { helper } = setup({ denyAll: true }); const value = await helper.fetchSoftWallOversight(); assert.equal(value.configured, true); assert.equal(value.maloLive, false); assert.equal(value.fanProfiles, null); });
test('a recent-count refusal retains the independently measured total', async () => { const { helper } = setup({ denyRecent: true }); const value = await helper.fetchSoftWallOversight(); assert.equal(value.fanProfiles, 7); assert.equal(value.fansLast7d, null); assert.equal(value.configured, true); });
test('a rejected runtime transport preserves fan counts and gives a safe source error', async () => { const { helper } = setup({ rejectRuntime: true }); const value = await helper.fetchSoftWallOversight(); assert.equal(value.configured, false); assert.equal(value.fanProfiles, 7); assert.equal(value.fansLast7d, 3); assert.equal(value.errors.runtime, 'Published switches could not be read.'); const runtime = await helper.fetchPortalRuntime(); assert.equal(runtime.configured, false); assert.equal(runtime.error, 'Published switches could not be read.'); });
test('a refused roster is unknown while independent counts remain measured', async () => { const output = await render('people', { denyRoster: true }); assert.match(output, /Profiles loaded —/); assert.match(output, /Fan profiles \(all\) 7/); assert.match(output, /Fans · 7 days 3/); assert.match(output, /Profiles not in this read/); assert.doesNotMatch(output, /Showing 0 newest|No profiles yet/); });
test('Features does not promise unobserved immediate publication or expose backend details', async () => { const output = await render('features', { denyRuntime: true }); assert.doesNotMatch(output, /immediately after Publish|Synthetic access denied|42501/); assert.match(output, /After Publish, use Refresh view/); });
test('unconfigured reads remain distinct from configured failures', async () => { const load = loader(id => id === '@/lib/supabase.server' ? { getSupabaseServerClient: async () => null } : undefined); const value = await load(base + '/lib/softWall.ts').fetchSoftWallOversight(); const runtime = await load(base + '/lib/softWall.ts').fetchPortalRuntime(); assert.equal(value.fanProfiles, null); assert.equal(value.fansLast7d, null); assert.equal(runtime.error, 'Supabase env missing'); });
for (const active of ['/features', '/people', '/money'] as const)
    test(`Refresh view stays a full request to its existing ${active} route`, () => { const { load } = setup(); const Shell = load(base + '/components/PortalShell.tsx').PortalShell; const output = renderToStaticMarkup(React.createElement(Shell, { active }, React.createElement('p', null, 'Existing report'))); assert.match(output, new RegExp('<a[^>]*href="' + active + '"[^>]*>Refresh view</a>')); });
