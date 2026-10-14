/**
 * Keeps enrolled future features accountable for admin handling before app readiness.
 * Only the CLI reads local files; the exported validator consumes a path snapshot.
 * A successful check verifies recorded contracts, never hosted behavior or release approval.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const states = ['planned', 'admin-ready', 'app-ready'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const concrete = (value) => typeof value === 'string' && value.trim().length > 0
  && !/\b(?:TODO|TBD|TBC|PLACEHOLDER)\b|^\s*<.*>\s*$|^\s*(?:pending|not run)\s*$/i.test(value);

function relativeFile(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
    && !/[\\:*?{}#\u0000-\u001f]/.test(value)
    && value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const date = new Date(value);
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z');
  return Number.isFinite(date.valueOf()) && date.toISOString() === normalized ? date.valueOf() : null;
}

/**
 * @purpose Validate recorded lifecycle contracts without reading files or the clock.
 * @param registry Parsed version-1 registry.
 * @param options Local path snapshot from inspectPaths, UTC now, and optional feature/requireState.
 * @returns Errors and the number of enrolled records; no semantic or release certification.
 */
export function validateRegistry(registry, { paths = new Map(), now, feature, requireState } = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const text = (value, label) => { if (!concrete(value)) fail(`${label}: provide concrete text without placeholders.`); };
  const textArray = (value, label) => {
    if (!Array.isArray(value) || value.length === 0) { fail(`${label}: provide a nonempty array.`); return; }
    value.forEach((entry, index) => text(entry, `${label}[${index}]`));
  };
  const checkPath = (value, label, implemented, evidence = false) => {
    if (!relativeFile(value)) { fail(`${label}: use a canonical repo-relative file path: ${JSON.stringify(value)}.`); return; }
    const state = paths.get(value) ?? { kind: 'missing' };
    if (state.kind === 'outside') fail(`${label}: path resolves outside the repository: ${value}.`);
    else if (state.kind === 'unreadable') fail(`${label}: path is unreadable or has an unresolved symlink: ${value}.`);
    else if (implemented && (state.kind !== 'file' || state.size <= 0)) {
      fail(`${label}: ${evidence ? 'evidence must be a nonempty file' : 'require a nonempty implemented file'}: ${value}.`);
    }
  };
  const checkDate = (value, label) => {
    const date = timestamp(value);
    if (date === null) fail(`${label}: use a valid UTC timestamp, such as 2026-10-12T09:00:00Z.`);
    else if (now !== undefined && date > timestamp(now)) fail(`${label}: readiness/planning date cannot be in the future.`);
    return date;
  };
  if (now !== undefined && timestamp(now) === null) fail('Validation now must be a valid UTC timestamp.');
  if (requireState !== undefined && !states.includes(requireState)) fail(`Unknown required state: ${requireState}.`);
  if (requireState !== undefined && !feature) fail('A required state needs --feature ID; empty registries cannot satisfy a feature gate.');
  if (!object(registry) || registry.version !== 1 || !Array.isArray(registry.features)) {
    fail('Registry must be an object with version 1 and a features array.');
    return { errors, featureCount: 0 };
  }
  const ids = new Set();
  for (const [index, record] of registry.features.entries()) {
    const label = `features[${index}]`;
    if (!object(record)) { fail(`${label}: feature must be an object.`); continue; }
    const prefix = concrete(record.id) ? record.id : label;
    if (typeof record.id !== 'string' || !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(record.id)) fail(`${prefix}.id: use a unique uppercase ID such as FEATURE-01.`);
    if (ids.has(record.id)) fail(`${prefix}.id: duplicate feature ID.`);
    ids.add(record.id);
    text(record.title, `${prefix}.title`);
    text(record.owner, `${prefix}.owner`);
    const rank = states.indexOf(record.status);
    if (rank < 0) fail(`${prefix}.status: use planned, admin-ready, or app-ready.`);
    const planned = checkDate(record.plannedAt, `${prefix}.plannedAt`);
    const exempt = object(record.exemption) && record.exemption.kind === 'presentation-only';
    if (record.exemption !== null) {
      if (!exempt) fail(`${prefix}.exemption: use null or an explicit presentation-only exemption.`);
      if (object(record.exemption)) {
        text(record.exemption.reason, `${prefix}.exemption.reason`);
        text(record.exemption.reviewedBy, `${prefix}.exemption.reviewedBy`);
      }
    }
    const fields = {
      source: { text: ['description'], arrays: [] },
      admin: { text: ['route'], arrays: ['actions'] },
      report: { text: ['route'], arrays: ['metrics'] },
      disable: { text: ['strategy'], arrays: [] },
      access: { text: ['deniedBehavior'], arrays: ['roles'] },
      app: { text: ['route'], arrays: [] },
    };
    for (const [name, contractFields] of Object.entries(fields)) {
      const contract = record[name];
      if (exempt && name !== 'app' && contract === null) continue;
      if (!object(contract)) { fail(`${prefix}.${name}: provide a contract object${name !== 'app' ? ' or an explicit presentation-only exemption' : ''}.`); continue; }
      for (const field of contractFields.text) text(contract[field], `${prefix}.${name}.${field}`);
      for (const field of contractFields.arrays) textArray(contract[field], `${prefix}.${name}.${field}`);
      if (name === 'admin' && typeof contract.route === 'string' && !/^\/admin(?:\/|$)/.test(contract.route)) fail(`${prefix}.admin.route: writes belong in Expo /admin.`);
      if (['app', 'report'].includes(name) && typeof contract.route === 'string' && !contract.route.startsWith('/')) fail(`${prefix}.${name}.route: use an app/report route beginning with /.`);
      if (!Array.isArray(contract.paths) || contract.paths.length === 0) fail(`${prefix}.${name}.paths: provide a nonempty array of repo-relative files.`);
      else contract.paths.forEach((entry, i) => checkPath(entry, `${prefix}.${name}.paths[${i}]`, name === 'app' ? rank >= 2 : rank >= 1));
    }
    if (!object(record.readiness)) { fail(`${prefix}.readiness: provide admin and app checkpoints, null until ready.`); continue; }
    const dates = {};
    for (const [name, minimumRank] of [['admin', 1], ['app', 2]]) {
      const checkpoint = record.readiness[name];
      if (rank < minimumRank) {
        if (checkpoint !== null) fail(`${prefix}: ${record.status} must keep readiness.${name} null.`);
        continue;
      }
      if (!object(checkpoint)) { fail(`${prefix}.readiness.${name}: save the readiness date and evidence before advancing.`); continue; }
      dates[name] = checkDate(checkpoint.date, `${prefix}.readiness.${name}.date`);
      if (planned !== null && dates[name] !== null && dates[name] < planned) fail(`${prefix}.readiness.${name}.date: cannot precede plannedAt.`);
      if (!Array.isArray(checkpoint.evidence) || checkpoint.evidence.length === 0) fail(`${prefix}.readiness.${name}.evidence: provide at least one concrete evidence record.`);
      else for (const [i, item] of checkpoint.evidence.entries()) {
        const evidenceLabel = `${prefix}.readiness.${name}.evidence[${i}]`;
        if (!object(item)) { fail(`${evidenceLabel}: provide path, command and result.`); continue; }
        checkPath(item.path, `${evidenceLabel}.path`, true, true);
        text(item.command, `${evidenceLabel}.command`);
        text(item.result, `${evidenceLabel}.result`);
        if (typeof item.result === 'string' && /^(?:pass(?:ed)?|ok|done|yes)$/i.test(item.result.trim())) fail(`${evidenceLabel}.result: record the observed counts or behavior, environment and outcome.`);
      }
    }
    // Full UTC timestamps allow honest same-day work without pretending app came first.
    if (rank >= 2 && dates.admin != null && dates.app != null && dates.admin >= dates.app) fail(`${prefix}: admin readiness must be recorded before app readiness.`);
  }
  if (feature) {
    const selected = registry.features.find((record) => object(record) && record.id === feature);
    if (!selected) fail(`${feature}: feature is not registered; enroll it before implementation.`);
    else if (requireState && states.indexOf(selected.status) < states.indexOf(requireState)) fail(`${feature}: requires ${requireState}; currently ${selected.status}.`);
  }
  return { errors, featureCount: registry.features.length };
}

function contained(root, absolute) {
  const relative = path.relative(root, absolute);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function inspectFile(root, relative) {
  if (!relativeFile(relative)) return { kind: 'invalid' };
  const absolute = path.resolve(root, relative);
  let ancestor = absolute;
  // A future child of an existing external symlink is unsafe even before the child exists.
  while (true) {
    try { fs.lstatSync(ancestor); break; }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code) || ancestor === root) return { kind: 'unreadable' };
      ancestor = path.dirname(ancestor);
    }
  }
  try {
    if (!contained(root, fs.realpathSync(ancestor))) return { kind: 'outside' };
    if (ancestor !== absolute) return { kind: 'missing' };
    const stat = fs.statSync(absolute);
    return { kind: stat.isFile() ? 'file' : 'directory', size: stat.size };
  } catch { return { kind: 'unreadable' }; }
}

/**
 * @purpose Snapshot actual file existence without mixing filesystem reads into validation.
 * @param registry Parsed metadata; malformed values are left for validateRegistry to reject.
 * @param repoRoot Repository directory; symlinks cannot lead outside its real path.
 * @returns Map of referenced path strings to kind/size facts.
 * @sideEffects Reads local filesystem metadata only.
 */
export function inspectPaths(registry, repoRoot) {
  const root = fs.realpathSync(repoRoot);
  const paths = new Map();
  const visit = (value) => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!object(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'path' && typeof item === 'string') paths.set(item, inspectFile(root, item));
      else if (key === 'paths' && Array.isArray(item)) {
        for (const entry of item) if (typeof entry === 'string') paths.set(entry, inspectFile(root, entry));
      } else visit(item);
    }
  };
  visit(registry);
  return paths;
}

function main(args) {
  const options = { repoRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), registry: 'docs/agents/feature-admin.json' };
  const flags = { '--repo-root': 'repoRoot', '--registry': 'registry', '--feature': 'feature', '--require': 'requireState' };
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/check-feature-admin.mjs [--registry repo/path.json] [--feature ID [--require planned|admin-ready|app-ready]] [--repo-root directory]');
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    if (!flags[args[i]] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown option or missing value: ${args[i]}. Use --help.`);
    options[flags[args[i]]] = args[i + 1];
  }
  const root = fs.realpathSync(options.repoRoot);
  const registryState = inspectFile(root, options.registry);
  if (!relativeFile(options.registry) || registryState.kind !== 'file') throw new Error('Registry must be an existing repo-relative file within the repository.');
  const registry = JSON.parse(fs.readFileSync(path.join(root, options.registry), 'utf8'));
  const result = validateRegistry(registry, { paths: inspectPaths(registry, root), now: new Date().toISOString(), feature: options.feature, requireState: options.requireState });
  if (result.errors.length) throw new Error(result.errors.map((message) => `- ${message}`).join('\n'));
  console.log(`feature-admin:check ok (${result.featureCount} registered features${options.feature ? `; ${options.feature}${options.requireState ? ` meets ${options.requireState}` : ''}` : ''}).`);
  console.log('Only registered contracts and local path/evidence records were checked. Unregistered feature intent is not detected; this is not release certification.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(`feature-admin:check failed:\n${error.message}`);
    process.exitCode = 1;
  }
}
