/**
 * Engineering Support's local sensor inventory and retained quality-check scanner.
 * Commands are fixed here: the catalog cannot execute code. Logs are private local artifacts,
 * bounded and redacted; a passing scan never proves hosted, device or visual health.
 */
import fs from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const AREAS = ['app', 'admin', 'backend', 'finance', 'data', 'ui', 'user-reports', 'tooling'];
const OUTPUT_LIMIT = 64_000;
const COMMANDS = {
  'quality-gate': ['pnpm', ['check']],
  'portal-tests': ['node', ['--import', './lib/analytics-resolver.mjs', '--test', ...fs.readdirSync(path.join(ROOT, 'apps/admin-portal/lib')).filter((name) => name.endsWith('.test.ts')).sort().map((name) => `lib/${name}`)]],
};

/** Fail closed on missing exits and timeouts; fingerprints group repeated check failures. */
export function classifyCheck(id, result) {
  const status = result.timedOut ? 'timed-out' : result.code === 0 && !result.signal ? 'passed' : 'failed';
  return { id, status, fingerprint: status === 'passed' ? null : `check:${id}` };
}

export function summarizeScan(checks, expected, sensors) {
  const skipped = expected.filter((id) => !checks.some((check) => check.id === id));
  const failures = checks.filter((check) => check.status !== 'passed').map((check) => check.id);
  const gaps = sensors.filter((sensor) => sensor.status !== 'implemented').map((sensor) => sensor.id);
  return { complete: skipped.length === 0, checksPassed: failures.length === 0, skipped, failures, gaps, runtimeVerified: false };
}

/** The owner requested this reporting line; a later registry edit must preserve or revise it deliberately. */
export function validateTeam(agents) {
  const expected = { SUPPORT: 'ENGINEERING', INCIDENT_TRIAGE: 'SUPPORT', TELEMETRY: 'SUPPORT', RELIABILITY: 'SUPPORT' };
  return Object.entries(expected).filter(([call, lead]) => agents.find((agent) => agent.call === call)?.lead !== lead)
    .map(([call, lead]) => `${call}: Engineering Support reporting lead must be ${lead}`);
}

/** Validate declared coverage, ownership and real local references; never infer semantic coverage. */
export function validateCatalog(catalog, { root, calls }) {
  const problems = [];
  if (catalog?.version !== 1 || !Array.isArray(catalog?.sensors) || !catalog.sensors.length) return ['Catalog must contain version 1 and sensors'];
  const ids = new Set();
  const areas = new Set();
  for (const sensor of catalog.sensors) {
    const label = sensor?.id || 'unnamed';
    if (!sensor || !/^[a-z][a-z0-9-]*$/.test(label) || ids.has(label)) problems.push(`${label}: invalid or duplicate id`);
    ids.add(label);
    if (!AREAS.includes(sensor?.area)) problems.push(`${label}: unknown area ${sensor?.area}`);
    areas.add(sensor?.area);
    if (!calls.has(sensor?.owner)) problems.push(`${label}: unknown owner ${sensor?.owner}`);
    if (!['implemented', 'partial', 'gap'].includes(sensor?.status)) problems.push(`${label}: invalid status`);
    for (const key of ['detects', 'limitation', 'next']) if (typeof sensor?.[key] !== 'string' || !sensor[key].trim()) problems.push(`${label}: missing ${key}`);
    if (!Array.isArray(sensor?.evidence) || !sensor.evidence.length) problems.push(`${label}: evidence paths required`);
    else for (const reference of sensor.evidence) {
      if (typeof reference !== 'string') { problems.push(`${label}: invalid reference`); continue; }
      const absolute = path.resolve(root, reference);
      if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(absolute)) problems.push(`${label}: missing or outside repository reference ${reference}`);
    }
  }
  for (const area of AREAS) if (!areas.has(area)) problems.push(`Missing coverage declaration for ${area}`);
  return problems;
}

/** Defense in depth for tool output; raw customer reports must never enter this scan. */
export function redactOutput(value) {
  return String(value)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/\bpi_[A-Za-z0-9_]*_secret_[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED]')
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1?[REDACTED]')
    .replace(/(["']?[a-z0-9_-]*(?:password|secret|token|api[_-]?key)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]]+)/gi, '$1"[REDACTED]"');
}

/** Run a fixed local check. Kill its process group on timeout so pnpm descendants stop too. */
export function runCommand(command, args, { cwd, timeoutMs = 600_000 }) {
  return new Promise((resolve) => {
    let output = '';
    let truncated = false;
    let timedOut = false;
    let spawnFailed = false;
    let killTimer;
    let forcedStop = Promise.resolve();
    const child = spawn(command, args, { cwd, shell: false, detached: process.platform !== 'win32', env: { ...process.env, FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const collect = (chunk) => {
      const text = chunk.toString();
      const combined = output + text;
      if (combined.length > OUTPUT_LIMIT) truncated = true;
      // Keep final failure/test summaries when a large suite prints more than the limit.
      output = combined.slice(-OUTPUT_LIMIT);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const stop = (signal) => {
      if (!child.pid) return;
      try {
        if (process.platform === 'win32') child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch { /* A check may finish between the timeout and kill. */ }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
      // The group may still contain grandchildren after the main check exits on SIGTERM.
      forcedStop = new Promise((finished) => {
        killTimer = setTimeout(() => { stop('SIGKILL'); finished(); }, 1000);
      });
    }, timeoutMs);
    child.on('error', (error) => { spawnFailed = true; collect(error.message); });
    child.on('close', async (code, signal) => {
      clearTimeout(timer);
      if (!timedOut) clearTimeout(killTimer);
      await forcedStop;
      resolve({ code: spawnFailed ? null : code, signal, timedOut, output: (truncated ? '[output truncated; final 64,000 characters retained]\n' : '') + redactOutput(output) });
    });
  });
}

/** Keep each run and atomically replace latest; no previous evidence is silently discarded. */
export async function saveScan(directory, report) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const data = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(path.join(directory, `${report.runId}.json`), data, { mode: 0o600, flag: 'wx' });
  const temporary = path.join(directory, `.latest-${randomUUID()}.tmp`);
  await writeFile(temporary, data, { mode: 0o600 });
  await rename(temporary, path.join(directory, 'latest.json'));
}

async function main(args) {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/engineering/detection-sensors.json'), 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/agents/registry.json'), 'utf8'));
  const problems = [...validateCatalog(catalog, { root: ROOT, calls: new Set(registry.agents.map((agent) => agent.call)) }), ...validateTeam(registry.agents)];
  if (problems.length) throw new Error(problems.join('\n'));
  if (!args.length || args[0] === '--check') {
    if (args.length > 1) throw new Error('Usage: detection.mjs --check | --scan [--only quality-gate|portal-tests]');
    console.log(`detection:check ok (${catalog.sensors.length} declared sensors; ${catalog.sensors.filter((s) => s.status !== 'implemented').length} partial/gap declarations; runtime not verified)`);
    return;
  }
  if (args[0] !== '--scan' || (args.length !== 1 && !(args.length === 3 && args[1] === '--only' && Object.hasOwn(COMMANDS, args[2])))) throw new Error('Usage: detection.mjs --check | --scan [--only quality-gate|portal-tests]');
  const selected = args.length === 3 ? [args[2]] : Object.keys(COMMANDS);
  const report = { version: 1, runId: `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`, startedAt: new Date().toISOString(), checks: [], sensors: catalog.sensors };
  const directory = path.join(ROOT, '.smoke/detection');
  // Persist a checkpoint before executing: an interrupted scan is visibly incomplete.
  await saveScan(directory, { ...report, summary: summarizeScan([], Object.keys(COMMANDS), catalog.sensors) });
  for (const id of selected) {
    const [command, commandArgs] = COMMANDS[id];
    console.log(`Detection: running ${id}`);
    const startedAt = new Date().toISOString();
    const result = await runCommand(command, commandArgs, { cwd: id === 'portal-tests' ? path.join(ROOT, 'apps/admin-portal') : ROOT });
    report.checks.push({ ...classifyCheck(id, result), startedAt, endedAt: new Date().toISOString(), ...result });
    await saveScan(directory, { ...report, runId: `${report.runId}-${id}`, summary: summarizeScan(report.checks, Object.keys(COMMANDS), catalog.sensors) });
    console.log(`Detection: ${id} ${report.checks.at(-1).status}`);
  }
  report.endedAt = new Date().toISOString();
  report.summary = summarizeScan(report.checks, Object.keys(COMMANDS), catalog.sensors);
  // Final has its own id, preserving the interrupted/in-progress checkpoint as evidence.
  report.runId += '-final';
  await saveScan(directory, report);
  console.log(JSON.stringify(report.summary));
  console.log('Private local evidence: .smoke/detection/latest.json');
  process.exitCode = report.summary.checksPassed ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(redactOutput(error.message)); process.exitCode = 1; });
}
