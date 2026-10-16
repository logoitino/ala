/**
 * Exercises future-feature enrollment against real temporary repository files.
 * These tests catch premature app readiness, missing evidence, and paths escaping the repo;
 * they do not treat a registry entry as proof of hosted behavior or release approval.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import * as implementation from '../check-feature-admin.mjs';

const script = fileURLToPath(new URL('../check-feature-admin.mjs', import.meta.url));
const testOptions = {};
const now = '2026-10-12T12:00:00Z';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-admin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (relative, text = 'Implemented local fixture; tests passed with exit 0.\n') => {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, text);
  };
  for (const file of ['src/source.mjs', 'src/admin.mjs', 'src/report.mjs', 'src/disable.mjs',
    'src/access.mjs', 'src/app.mjs', 'evidence/admin.md', 'evidence/app.md']) write(file);
  const record = {
    id: 'FEATURE-01',
    title: 'School event announcements',
    owner: 'ADMIN',
    status: 'planned',
    plannedAt: '2026-10-12T08:00:00Z',
    exemption: null,
    source: { description: 'Existing school events are the canonical event source.', paths: ['src/source.mjs'] },
    admin: { route: '/admin/events', actions: ['Create a draft event', 'Publish the reviewed event'], paths: ['src/admin.mjs'] },
    report: { route: '/admin/analytics', metrics: ['Published events in the selected UTC week; source errors stay unknown.'], paths: ['src/report.mjs'] },
    disable: { strategy: 'An authorized admin unpublishes the event; existing drafts remain recoverable.', paths: ['src/disable.mjs'] },
    access: { roles: ['admin'], deniedBehavior: 'Guests and unrelated accounts cannot write events.', paths: ['src/access.mjs'] },
    app: { route: '/local', paths: ['src/app.mjs'] },
    readiness: { admin: null, app: null },
  };
  const evidence = (which, date) => ({
    date,
    evidence: [{ path: `evidence/${which}.md`, command: `node --test tests/${which}.test.mjs`, result: '6 tests passed, 0 failed; exit 0. Local fixture only.' }],
  });
  const readyAdmin = () => {
    record.status = 'admin-ready';
    record.readiness.admin = evidence('admin', '2026-10-12T09:00:00Z');
  };
  const readyApp = () => {
    readyAdmin();
    record.status = 'app-ready';
    record.readiness.app = evidence('app', '2026-10-12T10:00:00Z');
  };
  const registry = () => ({ version: 1, features: [record] });
  const validate = (value = registry(), options = {}) => implementation.validateRegistry(value, {
    paths: implementation.inspectPaths(value, root), now, ...options,
  });
  return { root, write, record, readyAdmin, readyApp, registry, validate };
}

test('pure validation uses the supplied snapshot even after local files change', (t) => {
  const f = fixture(t);
  f.readyAdmin();
  const paths = implementation.inspectPaths(f.registry(), f.root);
  fs.rmSync(path.join(f.root, 'src/admin.mjs'));
  assert.deepEqual(implementation.validateRegistry(f.registry(), { paths, now }), { errors: [], featureCount: 1 });
  assert.match(f.validate().errors.join('\n'), /admin.paths.*implemented file/);
});

test('an empty registry is valid but cannot satisfy a selected feature gate', testOptions, (t) => {
  const { validate } = fixture(t);
  assert.deepEqual(validate({ version: 1, features: [] }).errors, []);
  assert.match(validate({ version: 1, features: [] }, { feature: 'FEATURE-01', requireState: 'admin-ready' }).errors.join('\n'), /not registered/i);
});

test('malformed envelopes and records return actionable failures without throwing', testOptions, (t) => {
  const { validate, registry, record } = fixture(t);
  for (const malformed of [null, [], {}, { version: 2, features: [] }, { version: 1, features: {} }, { version: 1, features: [null, []] }]) {
    assert.ok(validate(malformed).errors.length > 0);
  }
  record.status = 'released';
  record.owner = ' ';
  record.admin.actions = [];
  assert.match(validate().errors.join('\n'), /status/);
  assert.match(validate().errors.join('\n'), /owner/);
  assert.match(validate().errors.join('\n'), /admin.actions/);
  const duplicate = structuredClone(registry().features[0]);
  assert.match(validate({ version: 1, features: [record, duplicate] }).errors.join('\n'), /duplicate/i);
});

test('planned contracts can name future files without asserting readiness', testOptions, (t) => {
  const f = fixture(t);
  for (const contract of ['source', 'admin', 'report', 'disable', 'access', 'app']) f.record[contract].paths = [`future/${contract}.mjs`];
  assert.deepEqual(f.validate().errors, []);
  assert.deepEqual(f.validate(undefined, { feature: 'FEATURE-01', requireState: 'planned' }).errors, []);
  assert.match(f.validate(undefined, { feature: 'FEATURE-01', requireState: 'admin-ready' }).errors.join('\n'), /requires admin-ready/i);
  f.record.readiness.admin = { date: '2026-10-12T09:00:00Z', evidence: [] };
  assert.match(f.validate().errors.join('\n'), /planned.*readiness/i);
});

test('contract prose may describe pending work while readiness results reject generic placeholders', testOptions, (t) => {
  const f = fixture(t);
  f.record.source.description = 'Pending event drafts stay private until reviewed.';
  assert.deepEqual(f.validate().errors, []);
  f.readyAdmin();
  f.record.readiness.admin.evidence[0].result = 'passed';
  assert.match(f.validate().errors.join('\n'), /evidence.*result/);
});

test('admin-ready checks implemented operational paths while app files may still be future work', testOptions, (t) => {
  const f = fixture(t);
  f.readyAdmin();
  f.record.app.paths = ['future/app.mjs'];
  assert.deepEqual(f.validate().errors, []);
  for (const contract of ['source', 'admin', 'report', 'disable', 'access']) {
    const current = f.record[contract].paths;
    f.record[contract].paths = [`future/${contract}.mjs`];
    assert.match(f.validate().errors.join('\n'), new RegExp(`${contract}\\.paths.*implemented file`));
    f.record[contract].paths = current;
  }
  f.record.admin.route = '/events';
  assert.match(f.validate().errors.join('\n'), /Expo.*admin/i);
});

test('ready states require nonempty evidence files and concrete recorded commands/results', testOptions, (t) => {
  const f = fixture(t);
  f.readyAdmin();
  const checkpoint = structuredClone(f.record.readiness.admin);
  for (const evidence of [[], [{ path: 'future/evidence.md', command: 'node --test', result: '6 tests passed; exit 0.' }],
    [{ path: 'evidence/admin.md', command: 'TODO', result: 'pending' }]]) {
    f.record.readiness.admin.evidence = evidence;
    assert.ok(f.validate().errors.length > 0);
  }
  f.record.readiness.admin = checkpoint;
  f.write('evidence/admin.md', '');
  assert.match(f.validate().errors.join('\n'), /evidence.*nonempty file/i);
});

test('app-ready requires saved admin readiness strictly earlier than app readiness', testOptions, (t) => {
  const f = fixture(t);
  f.readyApp();
  assert.deepEqual(f.validate(undefined, { feature: 'FEATURE-01', requireState: 'app-ready' }).errors, []);
  const prior = f.record.readiness.admin;
  f.record.readiness.admin = null;
  assert.match(f.validate().errors.join('\n'), /readiness.admin/);
  f.record.readiness.admin = prior;
  for (const date of ['2026-10-12T10:00:00Z', '2026-10-12T11:00:00Z']) {
    f.record.readiness.admin.date = date;
    assert.match(f.validate().errors.join('\n'), /before app/i);
  }
  f.record.readiness.admin.date = '2026-10-12T09:00:00Z';
  f.record.app.paths = ['future/app.mjs'];
  assert.match(f.validate().errors.join('\n'), /app.paths.*implemented file/);
});

test('invalid and future timestamps cannot create retrospective readiness', testOptions, (t) => {
  const f = fixture(t);
  f.readyApp();
  for (const date of ['2026-02-30T09:00:00Z', 'yesterday', '2026-10-13T09:00:00Z']) {
    f.record.readiness.admin.date = date;
    assert.ok(f.validate().errors.length > 0);
  }
  f.record.readiness.admin.date = '2026-10-12T07:00:00Z';
  assert.match(f.validate().errors.join('\n'), /plannedAt/);
});

test('all contract and evidence paths reject traversal, absolute paths, URLs and ambiguous syntax', testOptions, (t) => {
  const f = fixture(t);
  for (const unsafe of ['../outside.mjs', 'src/../../outside.mjs', '/tmp/outside.mjs', 'C:/outside.mjs',
    'https://example.test/code', 'src\\source.mjs', './src/source.mjs', 'src//source.mjs', 'src/*.mjs', 'src/source.mjs#L1', 'src/\u0000source.mjs']) {
    f.record.source.paths = [unsafe];
    assert.match(f.validate().errors.join('\n'), /repo-relative/i, unsafe);
  }
  f.record.source.paths = ['src/source.mjs'];
  f.readyAdmin();
  f.record.readiness.admin.evidence[0].path = '../outside.md';
  assert.match(f.validate().errors.join('\n'), /repo-relative/i);
});

test('symlinks escaping the repository are rejected even for planned future children', testOptions, (t) => {
  const f = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-admin-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'source.mjs'), 'Outside repository');
  fs.symlinkSync(outside, path.join(f.root, 'escaped'));
  for (const escaped of ['escaped/source.mjs', 'escaped/future.mjs']) {
    f.record.source.paths = [escaped];
    assert.match(f.validate().errors.join('\n'), /outside.*repository/i);
  }
  f.record.source.paths = ['src'];
  f.readyAdmin();
  assert.match(f.validate().errors.join('\n'), /implemented file/i);
});

test('presentation-only exemptions need a reason, reviewer and prior exemption evidence', testOptions, (t) => {
  const f = fixture(t);
  for (const contract of ['source', 'admin', 'report', 'disable', 'access']) f.record[contract] = null;
  assert.ok(f.validate().errors.length > 0);
  f.record.exemption = { kind: 'presentation-only', reason: 'Only spacing and typography change; there are no new data, actions, permissions or reporting obligations.', reviewedBy: 'DESIGN' };
  assert.deepEqual(f.validate().errors, []);
  f.readyApp();
  assert.deepEqual(f.validate().errors, []);
  for (const field of ['reason', 'reviewedBy']) {
    const current = f.record.exemption[field];
    f.record.exemption[field] = '';
    assert.match(f.validate().errors.join('\n'), new RegExp(`exemption.${field}`));
    f.record.exemption[field] = current;
  }
  f.record.exemption.kind = 'no-admin-needed';
  assert.match(f.validate().errors.join('\n'), /presentation-only/);
});

test('CLI reads real registries, fails malformed JSON, and cannot hide an unknown feature', testOptions, (t) => {
  const f = fixture(t);
  const run = (...args) => spawnSync(process.execPath, [script, '--repo-root', f.root, ...args], { encoding: 'utf8' });
  f.write('docs/agents/feature-admin.json', JSON.stringify({ version: 1, features: [] }));
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 registered/i);
  assert.match(result.stdout, /unregistered/i);
  assert.match(result.stdout, /release/i);
  assert.equal(run('--feature', 'FEATURE-01', '--require', 'admin-ready').status, 1);
  assert.equal(run('--require', 'app-ready').status, 1);
  f.readyApp();
  f.write('docs/agents/feature-admin.json', JSON.stringify(f.registry()));
  result = run('--feature', 'FEATURE-01', '--require', 'app-ready');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(run('--registry', '../outside.json').status, 1);
  assert.equal(run('--unknown').status, 1);
  f.write('docs/agents/feature-admin.json', '{broken');
  assert.equal(run().status, 1);
  fs.rmSync(path.join(f.root, 'docs/agents/feature-admin.json'));
  assert.equal(run().status, 1);
});
