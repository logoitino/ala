#!/usr/bin/env node
/**
 * Infrastructure register (INFRA-01). Joins the hand-kept inventory in docs/engineering/infrastructure.json with what the
 * code actually uses — dependencies, server functions, API routes, environment variable names (never values), Storage
 * buckets, database extensions, Realtime, CI workflows, build profiles — and how deeply the app is wired to Supabase, and
 * writes docs/engineering/INFRASTRUCTURE_REGISTER.md. `--check` (in `pnpm check` and CI) fails when the code uses
 * something no inventory entry claims, when an entry claims something the code no longer uses, or when the register is
 * out of date. That keeps INFRASTRUCTURE (and the Growth and Capacity Review) aware of every infrastructure change: it
 * always shows up as a reviewed diff. Deterministic output (no dates), so it only changes when infrastructure does.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const inventory = JSON.parse(read('docs/engineering/infrastructure.json'));
const outPath = 'docs/engineering/INFRASTRUCTURE_REGISTER.md';
const problems = [];

function walk(rel, keep) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return keep(abs) ? [abs] : [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', '.expo', '__tests__'].includes(entry.name)) return [];
    return walk(path.join(rel, entry.name), keep);
  });
}
const codeFile = (file) => /\.(ts|tsx|js|mjs)$/.test(file) && !/\.test\.(ts|tsx|js|mjs)$/.test(file);
const codeRoots = ['apps/mobile/src', 'apps/mobile/app', 'apps/admin-portal/app', 'apps/admin-portal/lib', 'apps/admin-portal/components',
  'apps/admin-portal/middleware.ts', 'supabase/functions', 'packages/shared-types'];
const code = codeRoots.flatMap((rel) => walk(rel, codeFile)).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const schema = read('apps/mobile/src/backend/db/schema.sql');
const uniq = (items) => [...new Set(items)].sort();
const count = (text, re) => [...text.matchAll(re)].length;

// What the code uses.
const packageFiles = ['apps/mobile/package.json', 'apps/admin-portal/package.json', 'packages/shared-types/package.json', 'package.json'];
const packages = uniq(packageFiles.flatMap((rel) => {
  const pkg = JSON.parse(read(rel));
  return Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
}));
const env = uniq([
  ...[...code.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]),
  ...[...code.matchAll(/Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\)/g)].map((m) => m[1]),
]);
// `_shared` (and any `_`-prefixed folder) is code the functions import, not a deployable function (Supabase convention).
const functions = uniq(fs.readdirSync(path.join(root, 'supabase/functions'), { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name));
const apiRoutes = uniq(fs.readdirSync(path.join(root, 'apps/mobile/app/api')).filter((f) => f.endsWith('+api.ts')).map((f) => f.replace('+api.ts', '')));
const extensions = uniq([...schema.matchAll(/create extension if not exists "?([a-z_]+)"?/gi)].map((m) => m[1]));
const buckets = uniq([...schema.matchAll(/bucket_id\s*=\s*'([a-z_]+)'/g)].map((m) => m[1]));
const workflows = exists('.github/workflows') ? uniq(fs.readdirSync(path.join(root, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f))) : [];
const realtimeTables = uniq([...schema.matchAll(/alter publication supabase_realtime add table public\.([a-z_]+)/g)].map((m) => m[1]));
const easProfiles = exists('apps/mobile/eas.json') ? Object.keys(JSON.parse(read('apps/mobile/eas.json')).build ?? {}).sort() : [];
const otaUrl = JSON.parse(read('apps/mobile/app.json'))?.expo?.updates?.url ?? null;
const otaHost = otaUrl ? new URL(otaUrl).host : 'none';
const baseline = (rel) => (exists(rel) ? Object.values(JSON.parse(read(rel))).reduce((sum, n) => sum + n, 0) : 0);
const baselineFiles = (rel) => (exists(rel) ? Object.keys(JSON.parse(read(rel))).length : 0);
const depth = {
  authUid: count(schema, /auth\.uid\(\)/g),
  authRole: count(schema, /auth\.role\(\)/g),
  storageSql: count(schema, /\bstorage\./g),
  realtimeSql: count(schema, /\brealtime\.|supabase_realtime/g),
  grants: count(schema, /\bto\s+(?:anon|authenticated|service_role)\b/g),
  channels: count(code, /\.channel\(/g),
  directOutsideLib: baseline('scripts/vendor-boundary-baseline.json'),
  directOutsideLibFiles: baselineFiles('scripts/vendor-boundary-baseline.json'),
  directInRoutes: baseline('scripts/app-data-boundary-baseline.json'),
};

// What the inventory claims.
const services = inventory.services ?? [];
const claimed = (key) => new Map(services.flatMap((s) => (s[key] ?? []).map((item) => [item, s.id])));
const claims = {
  packages: new Map([...claimed('packages'), ...(inventory.localLibraries?.packages ?? []).map((p) => [p, 'local library'])]),
  env: new Map([...claimed('env'), ...(inventory.appConfig?.env ?? []).map((e) => [e, 'app config'])]),
  functions: claimed('functions'),
  apiRoutes: claimed('apiRoutes'),
  extensions: claimed('extensions'),
  buckets: claimed('buckets'),
  workflows: claimed('workflows'),
};
const used = { packages, env, functions, apiRoutes, extensions, buckets, workflows };
const label = { packages: 'dependency', env: 'environment variable', functions: 'Edge Function', apiRoutes: 'API route', extensions: 'database extension', buckets: 'Storage bucket', workflows: 'CI workflow' };
for (const [key, items] of Object.entries(used)) {
  for (const item of items) if (!claims[key].has(item)) problems.push(`${label[key]} \`${item}\` is used but no entry in docs/engineering/infrastructure.json claims it. Add it to a service (or as a local library / app config) and tell INFRASTRUCTURE.`);
  for (const item of claims[key].keys()) if (!items.includes(item)) problems.push(`docs/engineering/infrastructure.json claims ${label[key]} \`${item}\`, which the code no longer uses. Remove it and tell INFRASTRUCTURE.`);
}

// The register.
const list = (items) => (items.length ? items.map((i) => `\`${i}\``).join(', ') : '—');
const usedBy = (service, key) => list((service[key] ?? []).filter((item) => used[key].includes(item)));
const lines = [
  '# Infrastructure register',
  '',
  '<!-- Generated by scripts/infra-register.mjs from docs/engineering/infrastructure.json and the code. Do not edit by hand. -->',
  '',
  'What Tapua\'i runs on, what the code actually uses, and how deeply the app is wired to each service. Owner:',
  '`INFRASTRUCTURE` (standing dev member of the Growth and Capacity Review). Every change here is a reviewed diff: `pnpm',
  'infra:register:check` fails until the inventory claims new usage and this file is regenerated. Plans and prices are',
  'owner-reported or unverified. Portability and exits: [PORTABILITY.md](PORTABILITY.md); decisions:',
  '[HOSTING_DECISION_BRIEF.md](HOSTING_DECISION_BRIEF.md), [ENVIRONMENTS_AND_HOSTING.md](ENVIRONMENTS_AND_HOSTING.md).',
  '',
  '## Services',
  '',
  '| Service | Role | Status | Environments | Plan | Decision |',
  '| --- | --- | --- | --- | --- | --- |',
  ...services.map((s) => `| ${s.name} | ${s.role} | ${s.status} | ${(s.environments ?? []).join('; ') || '—'} | ${s.plan ?? '—'} | ${s.decision ?? '—'} |`),
  '',
  '## What the code uses, by service',
  '',
  '| Service | Dependencies | Environment variables (names only) | Server functions / API routes | Buckets / extensions / workflows |',
  '| --- | --- | --- | --- | --- |',
  ...services.map((s) => `| ${s.name} | ${usedBy(s, 'packages')} | ${usedBy(s, 'env')} | ${[usedBy(s, 'functions'), usedBy(s, 'apiRoutes')].filter((x) => x !== '—').join('; ') || '—'} | ${[usedBy(s, 'buckets'), usedBy(s, 'extensions'), usedBy(s, 'workflows')].filter((x) => x !== '—').join('; ') || '—'} |`),
  '',
  `Local libraries (no outside service): ${(inventory.localLibraries?.packages ?? []).filter((p) => packages.includes(p)).length}. App configuration variables: ${list((inventory.appConfig?.env ?? []).filter((e) => env.includes(e)))}.`,
  '',
  '## How deeply we are integrated with Supabase',
  '',
  '| Measure | Count | Meaning |',
  '| --- | --- | --- |',
  `| \`auth.uid()\` / \`auth.role()\` in SQL | ${depth.authUid} / ${depth.authRole} | Identity calls a non-Supabase host must provide (prefer \`my_profile_id()\` in new SQL) |`,
  `| Grants to \`anon\` / \`authenticated\` / \`service_role\` | ${depth.grants} | The PostgREST role model |`,
  `| \`storage.*\` references in SQL | ${depth.storageSql} | Storage policies and bucket rules |`,
  `| Realtime references in SQL / client channels | ${depth.realtimeSql} / ${depth.channels} | Live updates to replace on another host |`,
  `| Realtime publication tables | ${realtimeTables.length} | ${list(realtimeTables)} |`,
  `| Direct Supabase calls outside \`lib/\` | ${depth.directOutsideLib} in ${depth.directOutsideLibFiles} files | Places a provider change must touch; may only shrink (\`app:data-boundaries\`) |`,
  `| Direct Supabase calls in Expo routes | ${depth.directInRoutes} | Same rule, route files |`,
  '',
  '## Builds, updates and CI',
  '',
  `- EAS build profiles: ${list(easProfiles)}; over-the-air updates host: \`${otaHost}\`.`,
  `- CI workflows: ${list(workflows)}.`,
  `- Edge Functions: ${list(functions)}. Metro API routes: ${list(apiRoutes)}.`,
  '',
];
const output = `${lines.join('\n')}\n`;

if (problems.length) {
  console.error(`infra:register found ${problems.length} problem(s):\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
if (process.argv.includes('--check')) {
  const current = exists(outPath) ? read(outPath) : '';
  if (current !== output) {
    console.error(`infra:register: ${outPath} is out of date (infrastructure or integration depth changed). Run \`node scripts/infra-register.mjs\`, and let INFRASTRUCTURE review the diff.`);
    process.exit(1);
  }
  console.log(`infra:register ok (${services.length} services, ${packages.length} dependencies, ${env.length} environment variables, ${functions.length} functions, ${apiRoutes.length} API routes)`);
} else {
  fs.writeFileSync(path.join(root, outPath), output);
  console.log(`Wrote ${outPath}.`);
}
