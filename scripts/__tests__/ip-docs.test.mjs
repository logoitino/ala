/** IP packet regression scenarios: source drift must not silently renew reviews or alter decisions.
 * Real isolated repositories exercise safe inventory, failed refreshes and read-only checks.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const script = resolve('scripts/ip-docs.mjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'tapuai-ip-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  for (const dir of ['docs/legal', 'apps/mobile/src', 'packages', 'supabase']) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'apps/mobile/src/flow.ts'), 'export const state = 1;\n');
  writeFileSync(join(root, 'package.json'), '{"dependencies":{"example":"1.0"}}\n');
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
  const register = {
    _comment: 'Synthetic intake fixture; no actual legal decision.', version: 1, recordDate: '2026-10-22',
    project: 'Synthetic project', jurisdictionAssumption: 'Counsel decision pending',
    candidates: [{ id: 'IP-C01', title: 'Event flow', owner: 'ENGINEERING', problem: 'Dropped events', baseline: 'Unknown',
      mechanism: 'Review state flow', alternatives: 'Refetch', limitations: 'No novelty finding',
      sources: ['apps/mobile/src/flow.ts'], technicalEvidence: [], humanContributions: 'Unknown',
      counselQuestions: ['Which technique is new?'], review: null, decisions: [] }],
    rightsChecklist: [{ id: 'R01', category: 'Authorship', status: 'pending', needed: 'Human evidence' }],
    disclosureEvents: [], decisions: [], filings: [], counselQuestions: ['Which countries?']
  };
  const save = () => writeFileSync(join(root, 'docs/legal/ip-register.json'), JSON.stringify(register));
  save();
  const call = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  const packet = () => readFileSync(join(root, 'docs/legal/IP_COUNSEL_PACKET.md'), 'utf8');
  return { root, register, save, call, packet };
}

test('refresh detects new untracked source and source edits while preserving recorded reviews and decisions', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  const digest = f.packet().match(/Candidate source SHA-256: `([a-f0-9]{64})`/)[1];
  const review = { sourceSha256: digest, date: '2026-10-22', reviewer: 'Synthetic reviewer', evidence: 'Synthetic read only' };
  const decision = { date: '2026-10-22', actor: 'Synthetic owner', kind: 'defer', summary: 'Wait for counsel', evidence: 'Synthetic decision' };
  f.register.candidates[0].review = review;
  f.register.decisions.push(decision);
  f.save();
  assert.equal(f.call().status, 0);
  assert.match(f.packet(), /Current recorded engineering review/);
  writeFileSync(join(f.root, 'apps/mobile/src/new-flow.ts'), 'export const other = 2;');
  assert.equal(f.call('--check').status, 1);
  writeFileSync(join(f.root, 'apps/mobile/src/flow.ts'), 'export const state = 3;');
  assert.equal(f.call().status, 0);
  assert.match(f.packet(), /STALE engineering review/);
  assert.match(f.packet(), /Wait for counsel/);
  const stored = JSON.parse(readFileSync(join(f.root, 'docs/legal/ip-register.json')));
  assert.deepEqual(stored.candidates[0].review, review);
  assert.deepEqual(stored.decisions, [decision]);
});

test('credential and ignored runtime files never enter the packet or source digest', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  const before = f.packet();
  writeFileSync(join(f.root, 'apps/mobile/.env.local'), 'SECRET=private-fixture-only');
  writeFileSync(join(f.root, 'apps/mobile/customer.json'), '{"record":"private-fixture-only"}');
  writeFileSync(join(f.root, '.gitignore'), 'apps/mobile/runtime/\n');
  mkdirSync(join(f.root, 'apps/mobile/runtime'));
  writeFileSync(join(f.root, 'apps/mobile/runtime/secret.ts'), 'private-fixture-only');
  assert.equal(f.call('--check').status, 0);
  assert.equal(f.packet(), before);
  assert.doesNotMatch(f.packet(), /private-fixture-only|customer.json|secret.ts/);
});

test('missing references fail refresh without replacing the existing packet', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  const before = f.packet();
  f.register.candidates[0].sources.push('apps/mobile/src/missing.ts'); f.save();
  assert.equal(f.call().status, 1);
  assert.equal(f.packet(), before);
});

test('source path traversal and credential references are rejected explicitly', (t) => {
  const f = fixture(t);
  for (const bad of ['../outside.ts', 'apps/mobile/.env.local']) {
    f.register.candidates[0].sources = [bad]; f.save();
    const result = f.call();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsafe|excluded/i);
  }
});

test('symlinked source or output cannot read or overwrite external material', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  const outside = join(f.root, 'outside.txt'); writeFileSync(outside, 'private-fixture-only');
  symlinkSync(outside, join(f.root, 'apps/mobile/src/link.ts'));
  assert.equal(f.call().status, 1);
  rmSync(join(f.root, 'apps/mobile/src/link.ts'));
  rmSync(join(f.root, 'docs/legal/IP_COUNSEL_PACKET.md'));
  symlinkSync(outside, join(f.root, 'docs/legal/IP_COUNSEL_PACKET.md'));
  assert.equal(f.call().status, 1);
  assert.equal(readFileSync(outside, 'utf8'), 'private-fixture-only');
});

test('check does not repair modified output and repeated sync is deterministic', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  const original = f.packet();
  assert.equal(f.call().status, 0);
  assert.equal(f.packet(), original);
  writeFileSync(join(f.root, 'docs/legal/IP_COUNSEL_PACKET.md'), 'changed output');
  assert.equal(f.call('--check').status, 1);
  assert.equal(f.packet(), 'changed output');
});

test('invalid review hashes and unsupported filing records do not create legal status', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  f.register.candidates[0].review = { sourceSha256: 'bad', date: '2026-10-22', reviewer: 'Synthetic', evidence: 'Fixture' }; f.save();
  assert.equal(f.call().status, 1);
  f.register.candidates[0].review = null;
  f.register.filings = [{ type: 'patent', status: 'granted' }]; f.save();
  assert.equal(f.call().status, 1);
});

test('broken symlinks in source inventory fail instead of silently omitting evidence', (t) => {
  const f = fixture(t);
  assert.equal(f.call().status, 0);
  symlinkSync(join(f.root, 'does-not-exist'), join(f.root, 'apps/mobile/src/broken.ts'));
  const result = f.call();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /symlink/i);
});
