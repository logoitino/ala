#!/usr/bin/env node
/**
 * Exit infrastructure map (REDUNDANCY-02). Keeps the redundant-database / move-off-Supabase plan in step with the app.
 *
 *   node scripts/exit-map.mjs                 regenerate docs/engineering/EXIT_INFRASTRUCTURE_MAP.md
 *   node scripts/exit-map.mjs --check         CI / pnpm check: fail if the map is stale, a rule is broken, or app
 *                                             changes since the acknowledged baseline have not been announced
 *   node scripts/exit-map.mjs --pending       exit 3 when unacknowledged changes exist (used by the Stop hook)
 *   node scripts/exit-map.mjs --acknowledge --by "<session or person>"
 *                                             record the change notice in docs/agents/EXIT_CHANGE_LOG.md, routed to
 *                                             the agents who must act, and move the baseline to the current plan
 *   node scripts/exit-map.mjs --json          machine content hashes and SDK callsites, without source contents
 *   node scripts/exit-map.mjs --preflight --evidence-config /secure/exit-readiness.json
 *                                             requires the independent verified readiness evidence gate
 *
 * It reads what the app actually uses — schema.sql (schemas, tables, views, functions, policies, triggers, the app's
 * attachments on Supabase tables, extensions, realtime tables, buckets), migrations, Edge Functions, API routes, Auth
 * methods, Realtime client use and public environment names — and joins it with the hand-kept mapping in
 * docs/engineering/exit-map.json (component → AWS / Azure for exit A and B, owners, build order). The full safe source/configuration content hash
 * is the plan version; SDK sites expose literal and unresolved targets. Output is deterministic (no dates) so it only changes when the app does.
 *
 * Rules (fail in --check): every owner is a registry call; every mapped repo path exists; every Edge Function is in the
 * self-host allowlist (infrastructure/supabase/configure.py) or excluded with a reason; every Auth method the app calls
 * has a capability entry (so the cloud-native mapping stays complete); the map is current; and no change is pending.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectExitInventory } from './exit-inventory.mjs';
import { writeExitMap } from './exit-map-output.mjs';
import { securityReviewers } from '../infrastructure/security/routing.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const args = process.argv.slice(2);
const MODES = ['--check', '--pending', '--acknowledge', '--status', '--preflight', '--record-readiness'];
const mode = (MODES.find((m) => args.includes(m)) ?? '--write').slice(2);
const option = (name) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : ''; };
const OUT = 'docs/engineering/EXIT_INFRASTRUCTURE_MAP.md';
const BASELINE = 'docs/engineering/exit-map.baseline.json';
const LOG = 'docs/agents/EXIT_CHANGE_LOG.md';
const READINESS = 'docs/engineering/exit-readiness.json';
const writeMap = value => writeExitMap(root, OUT, value);
const problems = [];
const uniq = (items) => [...new Set(items)].sort();

// Shared pure collector is also consumed by release/readiness tooling; no source bytes are exported.
const machine = collectExitInventory(root);
const { inventory, planVersion, contentHash } = machine;
if (args.includes('--json')) { console.log(JSON.stringify(machine)); process.exit(0); }
// Validate source/mapping ancestry before parsing any hand-maintained mapping configuration.
const config = JSON.parse(read('docs/engineering/exit-map.json'));
const registry = JSON.parse(read('.claude/agents/registry.json')).agents;
const calls = new Set(registry.map((a) => a.call));
const { schemas, tables, views, functions, policies, triggers, attachments, extensions, realtimeTables, buckets,
  migrations, edgeFunctions, apiRoutes, authMethods, oauthProviders, realtimeUse, publicEnv, serverEnv, toolkit,
  rpcCalls, tableCalls, storageBuckets, channelNames, functionInvokes } = inventory;
const vendorCalls = exists('scripts/vendor-boundary-baseline.json') ? Object.values(JSON.parse(read('scripts/vendor-boundary-baseline.json'))).reduce((a, b) => a + b, 0) : 0;
const schemaFunctionNames = new Set(functions.flatMap(name => [name, name.split('.').at(-1)]));
const schemaRelationNames = new Set([...tables, ...views].flatMap(name => [name, name.split('.').at(-1)]));
const appConfig = JSON.parse(read('apps/mobile/app.json')).expo;
const mobilePackage = JSON.parse(read('apps/mobile/package.json'));
const version = { appVersion: appConfig.version, runtimeVersion: typeof appConfig.runtimeVersion === 'string' ? appConfig.runtimeVersion : JSON.stringify(appConfig.runtimeVersion),
  expoSdk: mobilePackage.dependencies?.expo ?? 'unknown', latestMigration: migrations.at(-1) ?? 'none',
  schemaHash: machine.sourceFiles.find(file => file.path === 'apps/mobile/src/backend/db/schema.sql')?.sha256 ?? 'missing',
  packages: ['apps/mobile/package.json', 'apps/admin-portal/package.json', 'packages/shared-types/package.json'].filter(exists).map(file => { const pkg = JSON.parse(read(file)); return `${pkg.name}@${pkg.version}`; }) };
// Preserve the existing status/readiness modes while binding them to the shared complete content fingerprint.
function appSourceHash() { return { hash: contentHash, files: machine.sourceFiles.length }; }
function gitState() {
  try {
    const git = argv => execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const relevant = ['apps', 'packages', 'supabase', 'scripts', 'infrastructure', 'patches', '.github', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.dockerignore', 'docs/engineering/exit-map.json'];
    const status = git(['status', '--porcelain', '--untracked-files=all', '--', ...relevant]);
    return { commit: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']), dirty: status ? status.split('\n').length : 0 };
  } catch { return { commit: null, branch: null, dirty: 0 }; }
}

// Who must act when each part changes. EXIT_SYNC sends every notice; REDUNDANCY_LEAD sees all of them.
const ROUTES = {
  schemas: ['EXIT_DATABASE', 'DATABASE_MIGRATIONS', 'RECOVERY'], tables: ['EXIT_DATABASE', 'DATABASE_MIGRATIONS', 'RECOVERY'],
  views: ['EXIT_DATABASE', 'DATABASE_MIGRATIONS'], functions: ['EXIT_DATABASE', 'DATABASE_MIGRATIONS', 'RLS_SECURITY'],
  policies: ['EXIT_DATABASE', 'RLS_SECURITY'], triggers: ['EXIT_DATABASE', 'DATABASE_MIGRATIONS'],
  attachments: ['EXIT_DATABASE', 'EXIT_SERVICES', 'RLS_SECURITY', 'STORAGE'], extensions: ['EXIT_DATABASE', 'EXIT_CLOUD'],
  realtimeTables: ['EXIT_SERVICES', 'REALTIME'], buckets: ['EXIT_SERVICES', 'STORAGE', 'RECOVERY'],
  migrations: ['EXIT_DATABASE', 'DATABASE_MIGRATIONS', 'RECOVERY'], edgeFunctions: ['EXIT_SERVICES', 'EXIT_CLOUD', 'API'],
  apiRoutes: ['EXIT_CLOUD', 'API'], authMethods: ['EXIT_SERVICES', 'AUTH', 'SESSION_SECURITY'],
  oauthProviders: ['EXIT_SERVICES', 'AUTH'], realtimeUse: ['EXIT_SERVICES', 'REALTIME'], publicEnv: ['EXIT_CLOUD', 'INFRASTRUCTURE', 'RELEASE'],
  serverEnv: ['EXIT_CLOUD', 'INFRASTRUCTURE', 'SECURITY'], toolkit: ['REDUNDANCY_LEAD', 'RECOVERY'],
  sourceFingerprints: ['EXIT_SYNC', 'EXIT_DATABASE', 'EXIT_SERVICES', 'EXIT_CLOUD', 'RECOVERY'],
  sdkCallsites: ['EXIT_DATABASE', 'EXIT_SERVICES', 'API', 'AUTH', 'STORAGE', 'REALTIME'],
  rpcCalls: ['EXIT_DATABASE', 'EXIT_SERVICES', 'API'], tableCalls: ['EXIT_DATABASE', 'EXIT_SERVICES'],
  storageBuckets: ['EXIT_SERVICES', 'STORAGE'], channelNames: ['EXIT_SERVICES', 'REALTIME'], functionInvokes: ['EXIT_SERVICES', 'EXIT_CLOUD'],
};
// Every notice carries Security partners; assigning them does not complete an independent review.
for (const area of Object.keys(ROUTES)) ROUTES[area] = uniq([...ROUTES[area], ...securityReviewers(area)]);
const LABELS = {
  schemas: 'Application schemas', tables: 'Tables', views: 'Views', functions: 'Database functions', policies: 'Row level security policies',
  triggers: 'Triggers', attachments: "App policies/triggers on Supabase's own tables", extensions: 'Extensions', realtimeTables: 'Realtime publication tables',
  buckets: 'Storage buckets', migrations: 'Migration files', edgeFunctions: 'Edge Functions', apiRoutes: 'Expo API routes', authMethods: 'Auth methods called',
  oauthProviders: 'OAuth providers', realtimeUse: 'Realtime features', publicEnv: 'Public client environment names', serverEnv: 'Server environment names',
  toolkit: 'Redundancy toolkit files', sourceFingerprints: 'Source/configuration content fingerprints', sdkCallsites: 'SDK callsites and unresolved targets', rpcCalls: 'Database functions the app calls', tableCalls: 'Tables/views the app reads or writes directly',
  storageBuckets: 'Storage buckets the app calls', channelNames: 'Realtime channels the app opens', functionInvokes: 'Server functions the app invokes',
};

// ---- Rules -------------------------------------------------------------------------------------------------------
for (const c of config.components) {
  for (const who of [c.owner, ...(c.with ?? [])]) if (!calls.has(who)) problems.push(`exit-map.json component ${c.id}: ${who} is not a registry call`);
  for (const rel of c.repo ?? []) if (!exists(rel)) problems.push(`exit-map.json component ${c.id}: repo path ${rel} no longer exists (update the mapping)`);
}
for (const step of config.buildOrder) if (!calls.has(step.owner)) problems.push(`exit-map.json build step "${step.step}": ${step.owner} is not a registry call`);
for (const owners of Object.values(ROUTES)) for (const who of owners) if (!calls.has(who)) problems.push(`notice route names unknown agent ${who}`);
for (const call of ['EXIT_SYNC', 'REDUNDANCY_LEAD']) if (!calls.has(call)) problems.push(`${call} must be in the registry`);
const allowlistSource = exists('infrastructure/supabase/configure.py') ? read('infrastructure/supabase/configure.py') : '';
const allowlist = uniq([...(allowlistSource.match(/ALLOWLIST\s*=\s*\(([^)]*)\)/)?.[1] ?? '').matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
const functionGaps = edgeFunctions.filter((f) => !allowlist.includes(f) && !config.edgeFunctionsExcluded?.[f]);
for (const f of functionGaps) problems.push(`Edge Function ${f} is neither in the self-host allowlist (infrastructure/supabase/configure.py) nor excluded with a reason in exit-map.json — the exit stack would silently lack it`);
for (const f of Object.keys(config.edgeFunctionsExcluded ?? {})) if (!edgeFunctions.includes(f)) problems.push(`exit-map.json excludes Edge Function ${f}, which no longer exists`);
const authGaps = authMethods.filter((m) => !config.authCapabilities?.[m]);
for (const m of authGaps) problems.push(`Auth method supabase.auth.${m} has no capability entry in exit-map.json authCapabilities — add it and check the exit B equivalent`);

const rpcGaps = rpcCalls.filter((f) => !schemaFunctionNames.has(f));
for (const f of rpcGaps) problems.push(`The app calls database function ${f}, which schema.sql does not define — it fails on Supabase and on any exit target`);
const tableGaps = tableCalls.filter((t) => !schemaRelationNames.has(t));
for (const t of tableGaps) problems.push(`The app reads table ${t}, which schema.sql does not define`);
for (const f of functionInvokes) if (!edgeFunctions.includes(f)) problems.push(`The app invokes server function ${f}, which supabase/functions does not contain`);
for (const b of storageBuckets) if (!buckets.includes(b)) problems.push(`The app uses Storage bucket ${b}, which schema.sql never configures (backup and restore would miss its rules)`);
for (const c of config.components) if (!config.tiers?.[c.tier]) problems.push(`exit-map.json component ${c.id}: tier must be one of ${Object.keys(config.tiers ?? {}).join(', ')}`);

// ---- Pending changes since the acknowledged baseline ----------------------------------------------------------------
let baseline = exists(BASELINE) ? JSON.parse(read(BASELINE)) : null;
let pending = [];
if (baseline) {
  for (const key of Object.keys(inventory)) {
    const before = new Set(baseline.inventory?.[key] ?? []);
    const now = new Set(inventory[key]);
    const added = inventory[key].filter((x) => !before.has(x));
    const removed = [...before].filter((x) => !now.has(x)).sort();
    if (added.length || removed.length) pending.push({ key, added, removed, notify: ROUTES[key] });
  }
}

// ---- Render ------------------------------------------------------------------------------------------------------
const team = ['REDUNDANCY_LEAD', 'EXIT_SYNC', 'EXIT_DATABASE', 'EXIT_SERVICES', 'EXIT_CLOUD'];
const partners = uniq(config.components.flatMap((c) => [c.owner, ...(c.with ?? [])]).filter((c) => !team.includes(c)));
const agentRow = (call) => {
  const a = registry.find((x) => x.call === call);
  return a ? `| \`${call}\` | ${a.department} | \`${a.lead}\` | ${a.tasks[0].replace(/\|/g, '\\|')} | [${path.basename(a.file)}](../../${a.file}) |` : `| \`${call}\` | — | — | not registered | — |`;
};
const list = (items, max = 400) => (items.length ? items.slice(0, max).map((x) => `\`${x}\``).join(', ') + (items.length > max ? ` … (+${items.length - max})` : '') : '—');
const esc = (s) => String(s).replace(/\|/g, '\\|');

let readiness = exists(READINESS) ? JSON.parse(read(READINESS)) : null;
const render = () => [
  '<!-- GENERATED by scripts/exit-map.mjs from the code and docs/engineering/exit-map.json. Do not edit by hand. -->',
  '# Exit infrastructure map — moving off Supabase to AWS or Azure',
  '',
  'The build map for the redundant database plan: everything the app uses on Supabase today, what replaces it on AWS or Azure',
  '(including load balancing, caching, CDN, firewall and database HA), how the data moves, how users are protected during the move,',
  'who builds each part and in what order. It regenerates on every app change (Stop hook, `pnpm check`, CI), so it always describes',
  'the current app. Team and protocol: [REDUNDANCY_TEAM](REDUNDANCY_TEAM.md). Operator commands: [CLOUD_MIGRATION_RUNBOOK](CLOUD_MIGRATION_RUNBOOK.md).',
  'Nothing here is provisioned, priced or approved; cloud spend and cutover remain owner decisions.',
  '',
  '## 1. Where the current version is',
  '',
  '| Fact | Current |',
  '| --- | --- |',
  `| Exit plan version (what the app uses on Supabase) | \`${planVersion}\` |`,
  `| Last announced plan | \`${baseline?.planVersion ?? 'none'}\` — ${pending.length ? `**${pending.length} area(s) changed and not yet announced** (§2)` : 'up to date'} |`,
  `| Mobile app version / runtime | ${version.appVersion} / ${version.runtimeVersion}; Expo SDK ${version.expoSdk} |`,
  `| Packages | ${version.packages.map((x) => `\`${x}\``).join(', ')} |`,
  `| Latest migration | \`${version.latestMigration}\` (${migrations.length} files) |`,
  `| Canonical schema hash | \`${version.schemaHash}\` (\`schema.sql\`) |`,
  `| Complete source/configuration content hash | \`${contentHash}\` across ${machine.sourceFiles.length} files |`,
  `| Informational readiness planning note | ${readiness ? `${readiness.scope}, recorded for plan \`${readiness.planVersion}\` ${readiness.planVersion === planVersion ? '(**matches** the current plan)' : '(**stale**: the app changed since)'}, app source \`${readiness.appSourceHash}\`, commit \`${readiness.commit}\`${readiness.dirty ? ' + uncommitted changes' : ''}, by ${readiness.by}` : 'none'} |`,
  '',
  'Live view (commit, branch, uncommitted files, app source hash, open notices, GO / NO-GO): `pnpm exit:status`.',
  'Before executing the exit, `pnpm exit:preflight -- --evidence-config /secure/exit-readiness.json` must say **GO**: the independent',
  'cutover evidence gate verifies the current release, exact artifacts, timed rehearsal and final frozen-backup acceptance (§13).',
  'The planning note, clean release commit and reviewed notices are additional checks; a planning note alone proves no readiness.',
  '',
  '## 2. Changes since the last announced plan',
  '',
  ...(baseline ? (pending.length ? [
    `${pending.length} area(s) changed since plan \`${baseline.planVersion}\`. \`EXIT_SYNC\` announces them with`,
    '`pnpm exit:map --acknowledge --by "<session>"`, which appends a routed notice to [EXIT_CHANGE_LOG](../agents/EXIT_CHANGE_LOG.md).',
    '',
    '| Area | Added | Removed | Notify |',
    '| --- | --- | --- | --- |',
    ...pending.map((p) => `| ${LABELS[p.key]} | ${list(p.added, 30)} | ${list(p.removed, 30)} | ${['EXIT_SYNC', 'REDUNDANCY_LEAD', ...p.notify].map((n) => `\`${n}\``).join(', ')} |`),
  ] : ['None. The plan matches the last announcement.']) : ['No baseline yet: run `pnpm exit:map --acknowledge --by "<session>"` once to create it.']),
  '',
  '## 3. Two exits',
  '',
  `- **Exit A (recommended).** ${config.exits.A}`,
  `- **Exit B.** ${config.exits.B}`,
  '- **Hybrid.** Exit A services pointed at a managed database (RDS / Azure Flexible Server) — the simplest way to get database HA without running it.',
  '',
  '## 4. Target topology (production tier)',
  '',
  '```mermaid',
  ...config.topology,
  '```',
  '',
  `Tiers: ${Object.entries(config.tiers).map(([k, v]) => `**${k}** — ${v}`).join('; ')}.`,
  '',
  '## 5. Component map',
  '',
  '| Component | Tier | Today | Exit A — AWS | Exit A — Azure | Exit B — AWS | Exit B — Azure | Owner (with) |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...config.components.map((c) => `| **${esc(c.name)}** | ${c.tier} | ${esc(c.today)} | ${esc(c.exitA.aws)} | ${esc(c.exitA.azure)} | ${esc(c.exitB.aws)} | ${esc(c.exitB.azure)} | \`${c.owner}\`${c.with?.length ? ` (${c.with.map((w) => `\`${w}\``).join(', ')})` : ''} |`),
  '',
  '**Notes per component**',
  '',
  ...config.components.map((c) => `- **${c.id}** — ${c.notes} Repo: ${c.repo.map((r) => `\`${r}\``).join(', ')}.`),
  '',
  '## 6. Same app, same data — the app\'s data surface',
  '',
  'Every call the app makes must answer the same way on the target. The code is not changed by exit A (only URLs and keys); these',
  'are the calls whose answers the proofs below cover.',
  '',
  '| What the app calls | Count | Items | How the target is proven to answer the same |',
  '| --- | --- | --- | --- |',
  `| ${LABELS.rpcCalls} | ${rpcCalls.length} | ${list(rpcCalls, 25)} | every one exists in \`schema.sql\` (checked here); parity compares body, settings, owner, execute rights |`,
  `| ${LABELS.tableCalls} | ${tableCalls.length} | ${list(tableCalls)} | parity: rows and hashes; **access parity**: rows visible to a guest, signed-in users and an admin |`,
  `| ${LABELS.storageBuckets} | ${storageBuckets.length} | ${list(storageBuckets)} | restore.py re-downloads and hashes every object; parity checks storage.objects policies |`,
  `| ${LABELS.channelNames} | ${channelNames.length} | ${list(channelNames)} | parity: realtime publication + realtime.messages policies; runbook Realtime smoke test |`,
  `| ${LABELS.functionInvokes} | ${functionInvokes.length} | ${list(functionInvokes)} | self-host allowlist (checked here); runbook checkout/Connect smoke test in Stripe test mode |`,
  `| ${LABELS.authMethods} | ${authMethods.length} | see §7 | GoTrue with restored users (exit A); capability map for exit B; runbook sign-in/MFA tests |`,
  '',
  'Access parity reads every application table as each kind of user through row level security and compares counts and row hashes; it',
  'catches an Auth layer that evaluates `auth.uid()` or claims differently even when the schema is identical (proven locally).',
  '',
  '## 7. What has to move (detected from the code)',
  '',
  'Counts come from static statements in `schema.sql` and the source; the live database fingerprint (`parity.py`) is the complete list.',
  '',
  '| Area | Count | Items |',
  '| --- | --- | --- |',
  `| ${LABELS.schemas} | ${schemas.length} | ${list(schemas)} |`,
  `| ${LABELS.tables} | ${tables.length} | covered by backup, restore list and parity automatically |`,
  `| ${LABELS.views} | ${views.length} | ${list(views)} |`,
  `| ${LABELS.functions} | ${functions.length} | covered by parity (body, settings, owner, execute rights) |`,
  `| ${LABELS.policies} | ${policies.length} declared by name | policies created in DO blocks (for example per-table "Closed accounts") are not visible here; parity counts the live set, and extra or missing policies block cutover |`,
  `| ${LABELS.triggers} | ${triggers.length} | covered by parity |`,
  `| ${LABELS.attachments} | ${attachments.length} | ${list(attachments)} |`,
  `| ${LABELS.extensions} | ${extensions.length} | ${list(extensions)} |`,
  `| ${LABELS.realtimeTables} | ${realtimeTables.length} | ${list(realtimeTables)} |`,
  `| ${LABELS.buckets} | ${buckets.length} | ${list(buckets)} |`,
  `| ${LABELS.migrations} | ${migrations.length} | latest \`${migrations.at(-1) ?? '—'}\` |`,
  `| ${LABELS.edgeFunctions} | ${edgeFunctions.length} | ${edgeFunctions.map((f) => `\`${f}\`${allowlist.includes(f) ? ' (self-host allowlist)' : config.edgeFunctionsExcluded?.[f] ? ' (excluded: ' + config.edgeFunctionsExcluded[f] + ')' : ' (**not covered**)'}`).join(', ')} |`,
  `| ${LABELS.apiRoutes} | ${apiRoutes.length} | ${list(apiRoutes)} |`,
  `| ${LABELS.authMethods} | ${authMethods.length} | ${authMethods.map((m) => `\`${m}\` (${config.authCapabilities?.[m] ?? '**unmapped**'})`).join(', ')} |`,
  `| ${LABELS.oauthProviders} | ${oauthProviders.length} | ${list(oauthProviders)} |`,
  `| ${LABELS.realtimeUse} | ${realtimeUse.length} | ${list(realtimeUse)} |`,
  `| ${LABELS.publicEnv} | ${publicEnv.length} | ${list(publicEnv)} |`,
  `| ${LABELS.serverEnv} | ${serverEnv.length} | ${list(serverEnv)} |`,
  `| Direct Supabase calls outside \`lib/\` | ${vendorCalls} | places an exit B adapter change must touch (may only shrink, \`pnpm app:data-boundaries\`) |`,
  '',
  '### SDK callsite coverage',
  '',
  `AST callsites: ${machine.calls.length}; literal targets: ${machine.calls.filter(c => c.targetResolution === 'literal').length}; explicit owner-review candidates: ${machine.unresolvedCalls.length}.`,
  'The complete machine inventory (`node scripts/exit-map.mjs --json`) records each detected callsite path, line, column,',
  'operation and literal target. Dynamic arguments and unresolved client origins require owner review. Syntax inspection',
  'does not prove runtime/provider coverage; overloads, dynamic SQL and deployed drift require live catalog parity.',
  '',
  '| Owner-review candidate | Operation | Target resolution | Reviewers |',
  '| --- | --- | --- | --- |',
  ...machine.unresolvedCalls.slice(0, 100).map(c => `| \`${c.path}:${c.line}:${c.column}\` | \`${c.kind}\` | ${c.targetResolution}; client ${c.clientResolution} | ${c.reviewers.map(r => `\`${r}\``).join(', ')} |`),
  ...(machine.unresolvedCalls.length > 100 ? [`Additional ${machine.unresolvedCalls.length - 100} candidates are included in the complete machine inventory.`] : []),
  '',
  '## 8. How the data moves',
  '',
  '| Strategy | How | Downtime | Rollback | When |',
  '| --- | --- | --- | --- | --- |',
  ...config.migrationStrategies.map((m) => `| **${esc(m.name)}** | ${esc(m.how)} | ${esc(m.downtime)} | ${esc(m.rollback)} | ${esc(m.when)} |`),
  '',
  'Storage bytes move separately from the database. Historical Beyond/Fan Zone bytes require isolated preload before app guards,',
  'reviewed owner reconciliation and final database guard restoration; see `EXIT_READY_RUNBOOK.md` and `storage_reconcile.py`.',
  'Bulk/delta synchronization is a proposed operator strategy, not an implemented continuous replicator. Measure final transfer/readback.',
  '',
  '## 9. Cutover plan and rollback',
  '',
  ...config.cutoverPhases.flatMap((ph) => [`**${ph.phase}** — owner \`${ph.owner}\`; gate: ${ph.gate}`, '', ...ph.steps.map((st, i) => `${i + 1}. ${st}`), '']),
  `**Roll back immediately if:** ${config.rollbackTriggers.join('; ')}.`,
  '',
  '## 10. Protection during and after the migration',
  '',
  '| Control | AWS | Azure | Why |',
  '| --- | --- | --- | --- |',
  ...config.protection.map((x) => `| **${esc(x.control)}** | ${esc(x.aws)} | ${esc(x.azure)} | ${esc(x.why)} |`),
  '',
  '## 11. Build order',
  '',
  '| # | Step | Owner | Tool | Status |',
  '| --- | --- | --- | --- | --- |',
  ...config.buildOrder.map((st, i) => `| ${i + 1} | ${esc(st.step)} | \`${st.owner}\` | ${esc(st.tool)} | ${esc(st.status)} |`),
  '',
  '## 12. Who takes care of it',
  '',
  '**Redundancy & Exit team** (reports to `ENGINEERING` → `CTO`; the owner decides spend and cutover):',
  '',
  '| Agent | Department | Lead | Primary duty | Definition |',
  '| --- | --- | --- | --- | --- |',
  ...team.map(agentRow),
  '',
  '**Partner agents named in the component map:**',
  '',
  '| Agent | Department | Lead | Primary duty | Definition |',
  '| --- | --- | --- | --- | --- |',
  ...partners.map(agentRow),
  '',
  '## 13. Coverage rules and the execution gate',
  '',
  `- Edge Functions outside the self-host allowlist and not excluded: ${functionGaps.length ? list(functionGaps) : 'none'}.`,
  `- Auth methods without a capability mapping: ${authGaps.length ? list(authGaps) : 'none'}.`,
  `- Database functions the app calls that \`schema.sql\` lacks: ${rpcGaps.length ? list(rpcGaps) : 'none'}; tables: ${tableGaps.length ? list(tableGaps) : 'none'}.`,
  '- Tables, functions, policies, triggers, sequences, grants, realtime membership, migration history and app attachments are carried by',
  '  the backup (full dump + every Storage object) and verified after restore by `parity.py` (structure, rows, access as each user).',
  '- **Execution gate (`pnpm exit:preflight`)** is GO only when: this map is current; no change is unannounced; every routed notice is',
  '  reviewed; the release commit is clean; the informational hosted-drill note matches this plan/source/commit and records the owner',
  '  approval reference; and `infrastructure/exit/readiness.py --phase cutover` independently verifies private original evidence,',
  '  runtime images, current source and final frozen-backup-specific database/Storage/writer acceptance. Supply `--evidence-config`.',
  '  Anything else is NO-GO with the reason. Prepared evidence alone does not authorize traffic or production writes.',
  '',
].join('\n');
const output = render();

// ---- Modes -------------------------------------------------------------------------------------------------------
function writeLogEntry(by) {
  const date = new Date().toISOString().slice(0, 10);
  const entry = [
    `## ${date} · plan \`${baseline?.planVersion ?? 'none'}\` → \`${planVersion}\` · announced by ${by}`,
    '',
    `App at announcement: commit \`${gitState().commit ?? 'unknown'}\`${gitState().dirty ? ` + ${gitState().dirty} uncommitted file(s)` : ''}, source \`${appSourceHash().hash}\`, app ${version.appVersion}, latest migration \`${version.latestMigration}\`.`,
    '',
    ...(pending.length ? pending.map((p) => `- **${LABELS[p.key]}** — added ${list(p.added, 30)}; removed ${list(p.removed, 30)}. Notify: ${['REDUNDANCY_LEAD', ...p.notify].map((n) => `\`${n}\``).join(', ')}.`) : ['- Baseline created; no prior plan to compare.']),
    '',
    '**Review status:** notified; each named agent reviews its part against the exit map and records the result below this line in its next task.',
    '',
  ].join('\n');
  const header = exists(LOG) ? read(LOG) : '';
  const marker = '<!-- entries below, newest first -->\n';
  const at = header.indexOf(marker);
  if (at < 0) throw new Error(`${LOG} is missing its entries marker`);
  fs.writeFileSync(path.join(root, LOG), header.slice(0, at + marker.length) + '\n' + entry + header.slice(at + marker.length));
}

/** Notices whose named agents have not all written `reviewed by <CALL>` under them. */
function openNotices() {
  if (!exists(LOG)) return [];
  const body = read(LOG).split('<!-- entries below, newest first -->')[1] ?? '';
  return body.split(/\n(?=## )/).filter((b) => b.startsWith('## ')).map((block) => {
    const named = uniq([...block.matchAll(/Notify: ([^\n]+)/g)].flatMap((m) => [...m[1].matchAll(/`([A-Z_]+)`/g)].map((x) => x[1])));
    const reviewed = new Set([...block.matchAll(/reviewed by `?([A-Z_]+)`?/gi)].map((m) => m[1].toUpperCase()));
    return { title: block.split('\n')[0].replace(/^## /, ''), missing: named.filter((c) => !reviewed.has(c)) };
  }).filter((n) => n.missing.length);
}

function preflightChecks() {
  const g = gitState();
  const src = appSourceHash();
  const notices = openNotices();
  let strongFailure = 'strong-evidence-required: supply --evidence-config with independently verified private readiness evidence';
  const evidenceConfig = option('--evidence-config');
  if (evidenceConfig) {
    try {
      // The independent gate validates private receipts and release identity; suppress provider/raw failure output.
      execFileSync('python3', [path.join(root, 'infrastructure/exit/readiness.py'), '--config-file', evidenceConfig, '--phase', 'cutover'],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
      strongFailure = '';
    } catch { strongFailure = 'strong-evidence-rejected: the independent readiness gate did not pass'; }
  }
  const checks = [
    ['Independent verified final cutover evidence passes', strongFailure],
    ['Exit map is current and every coverage rule passes', (!exists(OUT) || read(OUT) !== output || problems.length) ? `${problems.length} rule problem(s)${(!exists(OUT) || read(OUT) !== output) ? '; map out of date (pnpm exit:map)' : ''}` : ''],
    ['Every app change is announced to the team', pending.length ? `${pending.length} area(s) unannounced` : ''],
    ['Every routed notice is reviewed', notices.length ? `${notices.length} notice(s) waiting on ${uniq(notices.flatMap((n) => n.missing)).join(', ')}` : ''],
    ['Release commit is clean (no uncommitted app, database or infrastructure files)', g.commit === null ? 'not a git checkout' : g.dirty ? `${g.dirty} uncommitted file(s)` : ''],
    ['An informational readiness planning note exists', readiness ? '' : `missing ${READINESS}`],
    ['Readiness note references a hosted drill', readiness && readiness.scope !== 'hosted-drill' ? `scope is ${readiness.scope}` : ''],
    ['Readiness matches the current plan version', readiness && readiness.planVersion !== planVersion ? `proven for ${readiness.planVersion}, current ${planVersion}` : ''],
    ['Readiness matches the current app source', readiness && readiness.appSourceHash !== src.hash ? `proven for ${readiness.appSourceHash}, current ${src.hash}` : ''],
    ['Readiness matches the release commit', readiness && (readiness.commit !== g.commit || readiness.dirty) ? `proven on ${readiness.commit}${readiness.dirty ? ' (with uncommitted changes)' : ''}, release ${g.commit}` : ''],
    ['Owner approval for this exit is recorded', readiness?.ownerApproval ? '' : 'no ownerApproval reference in the planning note'],
  ].map(([name, failure]) => ({ name, failure: failure || (!readiness && name.startsWith('Readiness ') ? 'no readiness record' : '') }));
  for (const c of checks) c.ok = !c.failure;
  return { checks, go: checks.every((c) => c.ok), g, src, notices };
}

if (mode === 'status') {
  const { checks, go, g, src, notices } = preflightChecks();
  console.log([
    `Exit plan status — ${go ? 'GO' : 'NO-GO'} for executing the exit`,
    '',
    `  branch / commit      ${g.branch ?? '?'} @ ${g.commit ?? '?'}${g.dirty ? `  (+${g.dirty} uncommitted app/db/infra file(s))` : ''}`,
    `  app source hash      ${src.hash}  (${src.files} files: apps, packages, supabase, infrastructure, locks)`,
    `  app / runtime        ${version.appVersion} / ${version.runtimeVersion}; Expo SDK ${version.expoSdk}`,
    `  latest migration     ${version.latestMigration}  · schema ${version.schemaHash}`,
    `  exit plan version    ${planVersion}  (last announced ${baseline?.planVersion ?? 'none'}${pending.length ? `, ${pending.length} area(s) unannounced` : ''})`,
    `  readiness record     ${readiness ? `${readiness.scope} · plan ${readiness.planVersion} · source ${readiness.appSourceHash} · commit ${readiness.commit}${readiness.dirty ? '+dirty' : ''} · ${readiness.recordedAt} · ${readiness.by}` : 'none'}`,
    `  open notices         ${notices.length}${notices.length ? ` (waiting on ${uniq(notices.flatMap((n) => n.missing)).join(', ')})` : ''}`,
    '',
    ...checks.map((c) => `  ${c.ok ? 'ok  ' : 'NO  '} ${c.name}${c.failure ? ` — ${c.failure}` : ''}`),
  ].join('\n'));
  process.exit(0);
}
if (mode === 'preflight') {
  const { checks, go } = preflightChecks();
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'NO  '} ${c.name}${c.failure ? ` — ${c.failure}` : ''}`);
  console.log(go ? '\nGO: the exit plan is proven on exactly this app version.' : '\nNO-GO: do not execute the exit until every line is ok.');
  process.exit(go ? 0 : 1);
}
if (mode === 'record-readiness') {
  const scope = option('--scope');
  const evidence = option('--evidence');
  const by = option('--by');
  if (!['local-drill', 'hosted-drill'].includes(scope) || !evidence || !by) {
    console.error('usage: pnpm exit:map --record-readiness --scope local-drill|hosted-drill --evidence "<receipt>" --by "<who>" [--owner-approval "<reference>"]');
    process.exit(2);
  }
  if (problems.length || pending.length || !exists(OUT) || read(OUT) !== output) {
    console.error('exit:map: readiness can only be recorded on a current, fully announced plan (run pnpm exit:map:check).');
    process.exit(1);
  }
  const g = gitState();
  const record = { planVersion, appSourceHash: appSourceHash().hash, commit: g.commit, branch: g.branch, dirty: g.dirty > 0,
    appVersion: version.appVersion, latestMigration: version.latestMigration, schemaHash: version.schemaHash, scope, evidence, by,
    ownerApproval: option('--owner-approval') || null, recordedAt: new Date().toISOString(), informationalOnly: true };
  fs.writeFileSync(path.join(root, READINESS), JSON.stringify(record, null, 1) + '\n');
  readiness = record;
  writeMap(render());
  console.log(`exit:map recorded an informational ${scope} planning note for plan ${planVersion}, source ${record.appSourceHash}, commit ${g.commit}${g.dirty ? ' (+uncommitted)' : ''}; verified readiness still requires --evidence-config.`);
  process.exit(0);
}
if (mode === 'acknowledge') {
  const byIndex = args.indexOf('--by');
  const by = byIndex >= 0 ? args[byIndex + 1] : '';
  if (!by || by.startsWith('--')) { console.error('exit:map --acknowledge needs --by "<session or person>"'); process.exit(2); }
  if (problems.length) { console.error(`exit:map: fix these before announcing:\n${problems.map((p) => `- ${p}`).join('\n')}`); process.exit(1); }
  writeLogEntry(by);
  const announced = pending.length;
  baseline = { planVersion, inventory };
  fs.writeFileSync(path.join(root, BASELINE), JSON.stringify(baseline, null, 1) + '\n');
  pending = [];
  writeMap(render());
  console.log(`exit:map announced ${announced} changed area(s); baseline is now ${planVersion}. Notice in ${LOG}.`);
  process.exit(0);
}
if (mode === 'pending') {
  if (pending.length) { console.log(`${pending.length} area(s) changed since the acknowledged exit plan: ${pending.map((p) => LABELS[p.key]).join(', ')}`); process.exit(3); }
  process.exit(0);
}
if (mode === 'check') {
  if (!exists(OUT) || read(OUT) !== output) problems.push(`${OUT} is out of date. Run \`pnpm exit:map\` and commit the result.`);
  if (!baseline) problems.push(`${BASELINE} is missing. Run \`pnpm exit:map --acknowledge --by "<session>"\`.`);
  if (pending.length) problems.push(`App changes not yet announced to the Redundancy & Exit team (${pending.map((p) => LABELS[p.key]).join(', ')}). Review §2 of ${OUT}, then run \`pnpm exit:map --acknowledge --by "<session>"\`.`);
  if (problems.length) { console.error(`exit:map:check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`); process.exit(1); }
  console.log(`exit:map ok (plan ${planVersion}; ${config.components.length} components, ${tables.length} tables, ${functions.length} functions, ${edgeFunctions.length} Edge Functions, ${authMethods.length} Auth methods)`);
  process.exit(0);
}
writeMap(output);
if (problems.length) { console.error(`exit:map wrote ${OUT} with problems:\n${problems.map((p) => `- ${p}`).join('\n')}`); process.exit(1); }
console.log(`exit:map wrote ${OUT} (plan ${planVersion}${pending.length ? `; ${pending.length} area(s) pending announcement` : ''})`);
