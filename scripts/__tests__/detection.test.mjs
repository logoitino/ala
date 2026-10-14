/** Detection must retain failures and gaps without leaking command output into permanent logs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as detector from '../detection.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temporary = async (fn) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tapuai-detection-'));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
};

test('a failed check produces a non-green, stable incident fingerprint', () => {
  const failure = detector.classifyCheck('quality-gate', { code: 1, signal: null, timedOut: false });
  assert.equal(failure.status, 'failed');
  assert.equal(failure.fingerprint, 'check:quality-gate');
  assert.equal(detector.classifyCheck('quality-gate', { code: null, signal: 'SIGTERM', timedOut: false }).status, 'failed');
  assert.equal(detector.classifyCheck('quality-gate', { code: 0, timedOut: true }).status, 'timed-out');
});

test('subset scans expose omitted checks and all catalog gaps', () => {
  const summary = detector.summarizeScan([{ id: 'quality-gate', status: 'passed' }], ['quality-gate', 'portal-tests'], [{ id: 'backend', status: 'gap' }]);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.skipped, ['portal-tests']);
  assert.deepEqual(summary.gaps, ['backend']);
});

test('catalog rejects absent coverage, unknown owners and references outside the repository', () => {
  const catalog = { version: 1, sensors: [{ id: 'x', area: 'app', owner: 'UNKNOWN', status: 'gap', detects: 'Failures', evidence: ['../outside'], limitation: 'Not built', next: 'Build it' }] };
  const problems = detector.validateCatalog(catalog, { root, calls: new Set(['SUPPORT']) });
  assert.ok(problems.some((p) => p.includes('UNKNOWN')));
  assert.ok(problems.some((p) => p.includes('outside')));
  assert.ok(problems.some((p) => p.includes('finance')));
});

test('the support team cannot silently drift out of Engineering or lose a specialist', () => {
  const agents = [
    { call: 'SUPPORT', lead: 'ENGINEERING' },
    ...['INCIDENT_TRIAGE', 'TELEMETRY', 'RELIABILITY'].map((call) => ({ call, lead: 'SUPPORT' })),
  ];
  assert.deepEqual(detector.validateTeam(agents), []);
  agents[2].lead = 'OPERATIONS';
  assert.ok(detector.validateTeam(agents).some((p) => p.includes('TELEMETRY')));
});

test('real child exit errors and timeouts are captured', async () => {
  const failed = await detector.runCommand(process.execPath, ['-e', 'process.stderr.write("bad syntax"); process.exit(2)'], { cwd: root, timeoutMs: 3000 });
  assert.equal(failed.code, 2);
  assert.match(failed.output, /bad syntax/);
  const hung = await detector.runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: root, timeoutMs: 100 });
  assert.equal(hung.timedOut, true);
  const missing = await detector.runCommand('/not/a/real/executable', [], { cwd: root, timeoutMs: 100 });
  assert.equal(missing.code, null);
  assert.match(missing.output, /ENOENT/);
});

test('logs redact email, bearer tokens, secrets, JWTs, card numbers and URL queries', () => {
  const input = 'parent@example.com Bearer abcdefghi sk_test_123456789 payment_intent_secret=pi_123_secret_456 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signaturevalue 4242 4242 4242 4242 https://host.test/path?token=123';
  const safe = detector.redactOutput(input);
  for (const sensitive of ['parent@example.com', 'abcdefghi', 'sk_test_123456789', 'pi_123_secret_456', 'eyJhbGci', '4242 4242', 'token=123']) assert.ok(!safe.includes(sensitive), sensitive);
});

test('quoted JSON credentials cannot enter retained logs', () => {
  const safe = detector.redactOutput('{"token":"synthetic_sensitive_token","password":"synthetic_sensitive_password","client_secret":"synthetic_secret"}');
  for (const value of ['synthetic_sensitive_token', 'synthetic_sensitive_password', 'synthetic_secret']) assert.ok(!safe.includes(value), value);
});

test('timeout kills a descendant that ignores SIGTERM even after its parent exits', { skip: process.platform === 'win32' }, async () => temporary(async (dir) => {
  const heartbeat = path.join(dir, 'heartbeat');
  const childCode = `const fs = require('node:fs'); process.on('SIGTERM', () => {}); setInterval(() => fs.writeFileSync(${JSON.stringify(heartbeat)}, String(Date.now())), 20);`;
  const parentCode = `const {spawn} = require('node:child_process'); const child = spawn(process.execPath, ['-e', ${JSON.stringify(childCode)}], {stdio:'ignore'}); console.log(child.pid); setInterval(() => {}, 1000);`;
  const result = await detector.runCommand(process.execPath, ['-e', parentCode], { cwd: root, timeoutMs: 800 });
  const pid = Number(result.output.trim());
  try {
    assert.equal(result.timedOut, true);
    const first = await readFile(heartbeat, 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(await readFile(heartbeat, 'utf8'), first, 'descendant continued writing after timeout cleanup');
  } finally {
    if (Number.isInteger(pid) && pid > 0) try { process.kill(pid, 'SIGKILL'); } catch { /* Already stopped. */ }
  }
}));

test('output is bounded and truncation is visible', async () => {
  const result = await detector.runCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(300000))'], { cwd: root, timeoutMs: 15000 });
  assert.equal(result.code, 0);
  assert.ok(result.output.length <= 66000);
  assert.match(result.output, /truncated/);
});

test('saving two scans retains history and latest points to the second', async () => temporary(async (dir) => {
  await detector.saveScan(dir, { runId: 'first', checks: [{ status: 'failed' }] });
  await detector.saveScan(dir, { runId: 'second', checks: [{ status: 'passed' }] });
  assert.ok((await readdir(dir)).includes('first.json'));
  assert.equal(JSON.parse(await readFile(path.join(dir, 'latest.json'), 'utf8')).runId, 'second');
  await writeFile(path.join(dir, 'note.txt'), 'keep');
}));
