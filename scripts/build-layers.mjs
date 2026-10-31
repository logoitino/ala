#!/usr/bin/env node
/**
 * Build layers map (ARCHITECTURE_SYNC). Keeps docs/engineering/BUILD_LAYERS.md in step with the
 * hand-kept layer roster and live inventory signals, and routes owner change prompts into per-role
 * tasks (docs, team records, code).
 *
 *   node scripts/build-layers.mjs                 regenerate BUILD_LAYERS.md
 *   node scripts/build-layers.mjs --check         CI / pnpm check: fail if map stale or unannounced
 *   node scripts/build-layers.mjs --pending       exit 3 when unacknowledged (Stop / session gates)
 *   node scripts/build-layers.mjs --acknowledge --by "<session>"
 *                                                 write ARCHITECTURE_CHANGE_LOG + move baseline
 *   node scripts/build-layers.mjs --dispatch --change "<text>" --by "<session>"
 *                                                 print + append routed task breakdown for a prompt
 *   node scripts/build-layers.mjs --json          machine snapshot
 *
 * An announcement is a notice, not specialist execution or release approval. No unattended worker.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const write = (rel, body) => fs.writeFileSync(path.join(root, rel), body);
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
};
const mode = (
  ['--check', '--pending', '--acknowledge', '--dispatch', '--json'].find((m) => args.includes(m)) ?? '--write'
).slice(2);

const OUT = 'docs/engineering/BUILD_LAYERS.md';
const CONFIG = 'docs/engineering/build-layers.json';
const BASELINE = 'docs/engineering/build-layers.baseline.json';
const LOG = 'docs/agents/ARCHITECTURE_CHANGE_LOG.md';
const problems = [];
const uniq = (items) => [...new Set(items)].sort();

const config = JSON.parse(read(CONFIG));
const registry = JSON.parse(read('.claude/agents/registry.json')).agents;
const calls = new Set(registry.map((a) => a.call));

function listDirNames(rel, keep) {
  if (!exists(rel)) return [];
  return fs.readdirSync(path.join(root, rel), { withFileTypes: true })
    .filter(keep)
    .map((d) => d.name)
    .sort();
}

function collectSignals() {
  const schema = exists('apps/mobile/src/backend/db/schema.sql') ? read('apps/mobile/src/backend/db/schema.sql') : '';
  const edgeFunctions = listDirNames('supabase/functions', (d) => d.isDirectory() && !d.name.startsWith('_'));
  const apiRoutes = listDirNames('apps/mobile/app/api', (d) => d.isFile() && d.name.endsWith('+api.ts'))
    .map((f) => f.replace('+api.ts', ''));
  const buckets = uniq([...schema.matchAll(/bucket_id\s*=\s*'([a-z_]+)'/g)].map((m) => m[1]));
  const realtimeTables = uniq([...schema.matchAll(/alter publication supabase_realtime add table public\.([a-z_]+)/gi)].map((m) => m[1]));
  const migrations = listDirNames('supabase/migrations', (d) => d.isFile() && d.name.endsWith('.sql'));
  const easProfiles = exists('apps/mobile/eas.json')
    ? Object.keys(JSON.parse(read('apps/mobile/eas.json')).build ?? {}).sort()
    : [];
  const workflows = exists('.github/workflows')
    ? listDirNames('.github/workflows', (d) => d.isFile() && /\.ya?ml$/.test(d.name))
    : [];
  return {
    edgeFunctions,
    apiRoutes,
    buckets,
    realtimeTables,
    latestMigration: migrations.at(-1) ?? 'none',
    migrationsCount: migrations.length,
    easProfiles,
    workflows,
    agentCount: registry.length,
  };
}

const signals = collectSignals();

for (const who of [config.owner, config.lead, ...(config.alwaysNotify ?? [])]) {
  if (!calls.has(who)) problems.push(`build-layers.json names unknown agent ${who}`);
}
if (!Array.isArray(config.layers) || config.layers.length === 0) {
  problems.push('build-layers.json must declare layers');
}
const layerIds = new Set();
for (const layer of config.layers ?? []) {
  if (!layer?.id || layerIds.has(layer.id)) problems.push(`duplicate or missing layer id ${layer?.id}`);
  layerIds.add(layer.id);
  if (!['live', 'partial', 'candidate', 'exit'].includes(layer.status)) {
    problems.push(`layer ${layer.id}: invalid status ${layer.status}`);
  }
  for (const role of layer.roles ?? []) {
    if (!calls.has(role)) problems.push(`layer ${layer.id}: unknown role ${role}`);
  }
  const allowedSignals = new Set(Object.keys(signals));
  for (const signal of layer.signals ?? []) {
    if (!allowedSignals.has(signal)) problems.push(`layer ${layer.id}: unknown signal ${signal}`);
  }
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

const planPayload = {
  layers: config.layers.map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status,
    summary: l.summary,
    pieces: l.pieces,
    roles: [...(l.roles ?? [])].sort(),
    signals: [...(l.signals ?? [])].sort(),
  })),
  alwaysNotify: [...(config.alwaysNotify ?? [])].sort(),
  signals,
};
const planVersion = stableHash(planPayload);
const contentHash = createHash('sha256').update(JSON.stringify(planPayload)).digest('hex');

function gitState() {
  try {
    const git = (argv) => execFileSync('git', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { commit: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']) };
  } catch {
    return { commit: null, branch: null };
  }
}

function statusLabel(status) {
  if (status === 'live') return 'In use';
  if (status === 'partial') return 'Partial / Wave 0';
  if (status === 'exit') return 'Exit drill only';
  return 'Candidate / not selected';
}

function renderMarkdown() {
  const git = gitState();
  const lines = [
    '<!-- Generated by scripts/build-layers.mjs from docs/engineering/build-layers.json + live inventory signals. Do not edit by hand; change the JSON and run pnpm layers:sync. -->',
    '# Tapua\'i build layers',
    '',
    `**Owner:** \`${config.owner}\` (reports to \`${config.lead}\`). **Plan version:** \`${planVersion}\`.`,
    `**Agents in registry:** ${signals.agentCount}. **Latest migration:** \`${signals.latestMigration}\`.`,
    git.commit ? `**Git tip at generation:** \`${git.commit.slice(0, 7)}\` on \`${git.branch}\`.` : '',
    '',
    'Living map of how the app is built (L0–L9) and which callable roles sit on each layer.',
    'When the owner prompts a stack/architecture change, `ARCHITECTURE_SYNC` updates this map,',
    'announces it, and breaks the work into routed tasks so every named role updates its team',
    'records, documents and owned code in the same turn. An announcement is a notice — not',
    'proof that 116 specialists ran, a continuous worker is paid, or a release is approved.',
    '',
    'Companions: [SYSTEM_OVERVIEW](SYSTEM_OVERVIEW.md) · [ARCHITECTURE](ARCHITECTURE.md) ·',
    '[INFRASTRUCTURE_REGISTER](INFRASTRUCTURE_REGISTER.md) · [EXIT_INFRASTRUCTURE_MAP](exit/EXIT_INFRASTRUCTURE_MAP.md) ·',
    '[ARCHITECTURE_CHANGE_LOG](../agents/ARCHITECTURE_CHANGE_LOG.md) · [TEAM_HIERARCHY](../agents/TEAM_HIERARCHY.md).',
    '',
    '## Live inventory signals',
    '',
    '| Signal | Value |',
    '| --- | --- |',
    `| Edge Functions | ${signals.edgeFunctions.map((f) => `\`${f}\``).join(', ') || '—'} |`,
    `| Expo API routes | ${signals.apiRoutes.map((f) => `\`${f}\``).join(', ') || '—'} |`,
    `| Storage buckets (schema) | ${signals.buckets.map((f) => `\`${f}\``).join(', ') || '—'} |`,
    `| Realtime publication tables | ${signals.realtimeTables.map((f) => `\`${f}\``).join(', ') || '—'} |`,
    `| EAS build profiles | ${signals.easProfiles.map((f) => `\`${f}\``).join(', ') || '—'} |`,
    `| CI workflows | ${signals.workflows.map((f) => `\`${f}\``).join(', ') || '—'} |`,
    `| Registry agents | ${signals.agentCount} |`,
    `| Migrations | ${signals.migrationsCount} (latest \`${signals.latestMigration}\`) |`,
    '',
    '## Layer stack (top → bottom)',
    '',
  ];
  for (const layer of config.layers) {
    lines.push(`### ${layer.id} — ${layer.name}`);
    lines.push('');
    lines.push(`**Status:** ${statusLabel(layer.status)}. ${layer.summary}`);
    lines.push('');
    lines.push('**Pieces**');
    lines.push('');
    for (const piece of layer.pieces ?? []) lines.push(`- ${piece}`);
    lines.push('');
    lines.push('**Roles**');
    lines.push('');
    lines.push((layer.roles ?? []).map((r) => `\`${r}\``).join(' · ') || '—');
    lines.push('');
  }
  lines.push('## ASCII strip');
  lines.push('');
  lines.push('```text');
  lines.push('[ L0 Client ]       Expo iOS/Android/web · /admin writes · Next read-only');
  lines.push('        |');
  lines.push('[ L1 Edge/Build ]   EAS + OTA · GitHub CI · Supabase domain · public Storage CDN');
  lines.push('        |');
  lines.push('[ L2 App domain ]   Highlights · Give · Local · Profile · Soft-Wall · desks');
  lines.push('        |');
  lines.push('[ L3 Money API ]    JWT Node/Edge adapters · Stripe PaymentSheet + Connect');
  lines.push('        |');
  lines.push('[ L4 Streams ]      Realtime games/events/polls · OfflineQueue · telemetry_logs');
  lines.push('        |');
  lines.push('[ L5 Trust ]        Auth · RLS · Soft-Wall · minors/guardians · moderation');
  lines.push('        |');
  lines.push('[ L6 Storage ]      Postgres + RPCs · Storage buckets · media seam');
  lines.push('        |');
  lines.push('[ L7 Rules ]        Aura / Spotlight / polls / staff mod — no ML recs layer');
  lines.push('[ L8 Video* ]       *candidate Mux/Bunny/CF — today Storage + expo-video');
  lines.push('[ L9 Exit ]         AWS/Azure self-host drill · backup/parity tools');
  lines.push('```');
  lines.push('');
  lines.push('## How updates work');
  lines.push('');
  lines.push('1. Owner or lead prompts a change (`CALL: ARCHITECTURE_SYNC` with what moved).');
  lines.push('2. `ARCHITECTURE_SYNC` edits `build-layers.json` (and any owned code/docs) in the same turn.');
  lines.push('3. `pnpm layers:sync` regenerates this file; `pnpm layers:sync --acknowledge --by "<session>"`');
  lines.push('   writes [ARCHITECTURE_CHANGE_LOG](../agents/ARCHITECTURE_CHANGE_LOG.md) with per-role tasks.');
  lines.push('4. Each named role updates its team section, owned documents and code, then appends a review line.');
  lines.push('5. `DOCUMENTATION` and `VP_OPERATIONS` reconcile shared docs and roster drift; `pnpm layers:check`');
  lines.push('   (in `pnpm check` / CI) fails on a stale or unannounced map.');
  lines.push('');
  lines.push('This is not a paid idle worker. Currency is enforced by the same-turn protocol + CI gate,');
  lines.push('matching `EXIT_SYNC` / `INFRASTRUCTURE` — not by a background daemon.');
  lines.push('');
  return `${lines.filter((l, i) => !(l === '' && lines[i - 1] === '')).join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function readBaseline() {
  if (!exists(BASELINE)) return null;
  const raw = read(BASELINE).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeBaseline() {
  write(BASELINE, `${JSON.stringify({ planVersion, contentHash, signals, at: new Date().toISOString() }, null, 2)}\n`);
}

function diffSignals(prev, next) {
  const keys = uniq([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  const changes = [];
  for (const key of keys) {
    const a = JSON.stringify(prev?.[key] ?? null);
    const b = JSON.stringify(next?.[key] ?? null);
    if (a !== b) changes.push(key);
  }
  return changes;
}

function rolesForLayers(layerIds) {
  const roles = new Set(config.alwaysNotify ?? []);
  for (const layer of config.layers) {
    if (layerIds.has(layer.id)) for (const r of layer.roles ?? []) roles.add(r);
  }
  return [...roles].sort();
}

function inferLayersFromText(text) {
  const lower = (text || '').toLowerCase();
  const hit = new Set();
  const rules = [
    [/client|expo|ios|android|soft-?wall|fan bar|admin portal|next portal|playback|upload|profile ui/, 'L0'],
    [/eas|ota|cdn|load.?balanc|waf|github actions|ci workflow|preview build/, 'L1'],
    [/highlight|give|gift|local|spotlight|drip|beyond|shared-types|feature/, 'L2'],
    [/stripe|payment|connect|edge function|api route|checkout|payout|tip/, 'L3'],
    [/realtime|offline.?queue|telemetry|broadcast|cheer.?poll live/, 'L4'],
    [/auth|rls|minor|guardian|moderat|runtime.?config|consent|legal/, 'L5'],
    [/schema|migration|postgres|storage bucket|rpc|data.?map|vault bucket/, 'L6'],
    [/aura tier|leaderboard|spotlight elect|ml|recommendation|scoring model/, 'L7'],
    [/mux|bunny|cloudflare stream|video host|transcod/, 'L8'],
    [/exit|redundan|aws|azure|self-?host|parity|backup drill/, 'L9'],
  ];
  for (const [re, id] of rules) if (re.test(lower)) hit.add(id);
  if (hit.size === 0) for (const layer of config.layers) hit.add(layer.id);
  return hit;
}

function taskLines(roles, layerIds, changeText) {
  const layers = [...layerIds].sort().join(', ');
  const docs = (config.docTargets ?? []).map((d) => `\`${d}\``).join(', ');
  return roles.map((role) => {
    const ownsLayer = config.layers.some((l) => layerIds.has(l.id) && (l.roles ?? []).includes(role));
    const always = (config.alwaysNotify ?? []).includes(role);
    const bits = [
      `Review layers ${layers} against current tip for change: ${changeText || '(map refresh)'}`,
      ownsLayer ? 'Update owned code/paths if the layer contract moved' : 'Confirm no owned-code change required',
      always || role === 'DOCUMENTATION' ? `Sync shared docs (${docs}) as needed` : 'Update owned specialist docs if any',
      role === 'VP_OPERATIONS' ? 'Reconcile TEAMS / TEAM_HIERARCHY / registry if ownership moved' : 'Report team status to your lead',
      `Append review under the ARCHITECTURE_CHANGE_LOG notice: reviewed by ${role} <date>: ok / follow-up <task>`,
    ];
    return { role, tasks: bits };
  });
}

function appendLog({ by, fromVersion, changeText, layerIds, signalChanges }) {
  const roles = rolesForLayers(layerIds);
  const tasks = taskLines(roles, layerIds, changeText);
  const git = gitState();
  const when = new Date().toISOString().slice(0, 10);
  const header = [
    '',
    `## ${when} · plan \`${fromVersion || 'none'}\` → \`${planVersion}\` · announced by ${by}`,
    '',
    `App at announcement: commit \`${git.commit ?? 'unknown'}\` on \`${git.branch ?? 'unknown'}\`, agents ${signals.agentCount}, latest migration \`${signals.latestMigration}\`.`,
    '',
    changeText ? `- **Owner / session change:** ${changeText}` : '- **Map refresh:** inventory signals and layer roster synchronized.',
    `- **Layers touched:** ${[...layerIds].sort().map((id) => `\`${id}\``).join(', ') || '—'}`,
    signalChanges.length ? `- **Inventory signals changed:** ${signalChanges.map((s) => `\`${s}\``).join(', ')}` : '- **Inventory signals:** unchanged vs prior baseline.',
    `- **Notify (${roles.length}):** ${roles.map((r) => `\`${r}\``).join(', ')}.`,
    '',
    '### Routed tasks (each named agent must act)',
    '',
  ];
  for (const entry of tasks) {
    header.push(`#### \`${entry.role}\``);
    header.push('');
    for (const t of entry.tasks) header.push(`- [ ] ${t}`);
    header.push('');
  }
  header.push('**Review status:** notified; each named agent updates teams/docs/code as required and records the result below this line in its next task.');
  header.push('');

  let log = exists(LOG)
    ? read(LOG)
    : [
      '<!-- ARCHITECTURE_SYNC change notices: written by `pnpm layers:sync --acknowledge` / `--dispatch`. Reviewers append results under each notice. -->',
      '# Architecture / build-layers change log',
      '',
      'Owner prompts and inventory drifts that move the Tapua\'i build-layer map are announced here by',
      '`ARCHITECTURE_SYNC` with `pnpm layers:sync --acknowledge` or `--dispatch`. Named agents update',
      'their teams, documents and owned code, then append `reviewed by <CALL> <date>: ok / follow-up`.',
      'An announcement is a notice, not execution proof or release approval.',
      '',
      '<!-- entries below, newest first -->',
      '',
    ].join('\n');

  const marker = '<!-- entries below, newest first -->';
  if (!log.includes(marker)) {
    log = `${log.trimEnd()}\n\n${marker}\n`;
  }
  const [before, after] = log.split(marker);
  const next = `${before.trimEnd()}\n\n${marker}\n${header.join('\n')}${after ? after.replace(/^\n+/, '\n') : '\n'}`;
  write(LOG, next.endsWith('\n') ? next : `${next}\n`);
  return { roles, tasks };
}

const markdown = renderMarkdown();
const baseline = readBaseline();
const signalChanges = diffSignals(baseline?.signals, signals);
const pending = !baseline || baseline.planVersion !== planVersion || baseline.contentHash !== contentHash;

if (problems.length) {
  console.error(`build-layers failed (${problems.length} issues):\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}

if (mode === 'json') {
  console.log(JSON.stringify({ planVersion, contentHash, signals, pending, layers: config.layers.map((l) => l.id) }, null, 2));
  process.exit(0);
}

if (mode === 'write' || mode === 'acknowledge' || mode === 'dispatch') {
  write(OUT, markdown);
}

if (mode === 'check') {
  const onDisk = exists(OUT) ? read(OUT) : '';
  if (onDisk !== markdown) {
    console.error('build-layers:check failed: BUILD_LAYERS.md is stale — run `pnpm layers:sync`');
    process.exit(1);
  }
  if (pending) {
    console.error(
      `build-layers:check failed: plan ${planVersion} is not acknowledged`
      + (baseline ? ` (baseline ${baseline.planVersion})` : ' (no baseline)')
      + ' — run `pnpm layers:sync --acknowledge --by "<session>"`',
    );
    process.exit(1);
  }
  console.log(`layers:check ok (plan ${planVersion}; ${config.layers.length} layers; ${signals.agentCount} agents)`);
  process.exit(0);
}

if (mode === 'pending') {
  if (pending) {
    console.log(`layers:pending plan ${planVersion} (baseline ${baseline?.planVersion ?? 'none'})`);
    process.exit(3);
  }
  console.log(`layers:pending none (plan ${planVersion})`);
  process.exit(0);
}

if (mode === 'acknowledge' || mode === 'dispatch') {
  const by = option('--by') || 'unspecified-session';
  const changeText = option('--change') || (mode === 'dispatch' ? '' : 'Map synchronized with current inventory signals');
  if (mode === 'dispatch' && !changeText) {
    console.error('layers:sync --dispatch requires --change "<owner prompt>"');
    process.exit(1);
  }
  const layerIds = mode === 'dispatch' ? inferLayersFromText(changeText) : new Set(config.layers.map((l) => l.id));
  // For acknowledge-only with signal drift, prefer layers that declare those signals.
  if (mode === 'acknowledge' && signalChanges.length) {
    for (const layer of config.layers) {
      if ((layer.signals ?? []).some((s) => signalChanges.includes(s))) layerIds.add(layer.id);
    }
  }
  const fromVersion = baseline?.planVersion ?? 'none';
  const { roles, tasks } = appendLog({ by, fromVersion, changeText: changeText || 'Full layer map refresh', layerIds, signalChanges });
  writeBaseline();
  console.log(`layers:${mode} plan ${fromVersion} → ${planVersion}; notified ${roles.length} agents`);
  if (mode === 'dispatch') {
    console.log(JSON.stringify({ planVersion, layers: [...layerIds].sort(), roles, tasks }, null, 2));
  }
  process.exit(0);
}

if (mode === 'write') {
  console.log(`layers:sync wrote ${OUT} (plan ${planVersion}; pending=${pending})`);
  process.exit(0);
}
