/** Private setup must fail closed before real credentials, destinations, snapshots or readiness exist. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSetup, verifySetup } from '../setup.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CLI = fileURLToPath(new URL('../setup.mjs', import.meta.url));
const HASH = value => createHash('sha256').update(value).digest('hex');
const readJson = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
async function fixture(fn) {
  const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-setup-test-')));
  await fs.chmod(base, 0o700);
  const root = path.join(base, 'source'), sourceStateDir = path.join(base, 'source-state'), outputDir = path.join(base, 'private-setup');
  await fs.mkdir(root, { mode:0o700 }); await fs.mkdir(sourceStateDir, { mode:0o700 });
  const options = { root, sourceStateDir, outputDir, sourceUrl:'https://abcdefghijklmnopqrst.supabase.co', sourceTargetId:'local-source' };
  try { await fn({ base, root, sourceStateDir, outputDir, options }); }
  finally { await fs.rm(base, { recursive:true, force:true }); }
}
async function tree(directory, prefix = '') {
  const result = [];
  for (const name of (await fs.readdir(directory)).sort()) {
    const relative = prefix ? `${prefix}/${name}` : name, filename = path.join(directory, name), info = await fs.lstat(filename);
    assert.equal(info.isSymbolicLink(), false);
    result.push({ path:relative, mode:info.mode & 0o777, directory:info.isDirectory() });
    if (info.isDirectory()) result.push(...await tree(filename, relative));
  }
  return result;
}

test('creates exactly private organized templates and binds every byte/directory in an incomplete manifest', () => fixture(async ({ options, outputDir }) => {
  const result = await createSetup(options);
  assert.equal(result.backupCreated, false); assert.equal(result.servicesActivated, false);
  assert.equal(result.incomplete, true); assert.equal(result.readyToCutOver, false);
  assert.equal((await fs.lstat(outputDir)).mode & 0o777, 0o700);
  const entries = await tree(outputDir);
  for (const entry of entries) assert.equal(entry.mode, entry.directory ? 0o700 : 0o600, entry.path);
  assert.deepEqual(entries.filter(entry => !entry.directory).map(entry => entry.path).sort(), [
    'README.md', 'SETUP_MANIFEST.json', 'config/backup.env', 'config/backup-job.json', 'config/health.json',
    'credentials/recipients.txt', 'credentials/source.pgpass.example',
  ].sort());
  const manifest = await readJson(path.join(outputDir, 'SETUP_MANIFEST.json'));
  const { manifestSha256, ...body } = manifest;
  assert.equal(manifestSha256, HASH(JSON.stringify(body)));
  assert.equal(manifestSha256, result.manifestSha256);
  for (const file of manifest.files) {
    assert.equal(file.sha256, HASH(await fs.readFile(path.join(outputDir, file.path))));
    assert.equal(file.mode, '0600');
  }
  assert.deepEqual(manifest.directories.map(item => item.path).sort(), ['.', ...entries.filter(entry => entry.directory).map(entry => entry.path)].sort());
  assert.equal((await verifySetup(outputDir)).integrity, 'verified');
  assert.equal((await verifySetup(outputDir)).readyToCutOver, false);
}));

test('templates contain no copied source/ambient secrets, identities, actual passwords, job receipts or encrypted data', () => fixture(async ({ options, root, sourceStateDir, outputDir }) => {
  const secret = 'synthetic-secret-never-copy-20261020';
  await fs.writeFile(path.join(root, '.env.local'), `SUPABASE_SOURCE_SERVICE_ROLE_KEY=${secret}`);
  await fs.writeFile(path.join(sourceStateDir, 'private-existing-secret.env'), secret, { mode:0o600 });
  const previous = process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY;
  try { process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY = secret; await createSetup(options); }
  finally { if (previous === undefined) delete process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SOURCE_SERVICE_ROLE_KEY = previous; }
  for (const entry of await tree(outputDir)) {
    if (!entry.directory) assert.equal((await fs.readFile(path.join(outputDir, entry.path), 'utf8')).includes(secret), false, entry.path);
  }
  assert.equal(await fs.readFile(path.join(outputDir, 'credentials/recipients.txt'), 'utf8'), '');
  await assert.rejects(fs.lstat(path.join(outputDir, 'credentials/source.pgpass')), { code:'ENOENT' });
  assert.deepEqual(await fs.readdir(path.join(outputDir, 'state/backup-status')), []);
  assert.deepEqual(await fs.readdir(path.join(outputDir, 'data/backups')), []);
  assert.equal(await fs.readFile(path.join(sourceStateDir, 'private-existing-secret.env'), 'utf8'), secret);
}));

test('real job loader rejects empty destinations, real database validator rejects empty PG fields, and health cannot claim readiness', () => fixture(async ({ options, outputDir }) => {
  await createSetup(options);
  const jobPath = path.join(outputDir, 'config/backup-job.json'), envPath = path.join(outputDir, 'config/backup.env');
  const job = await readJson(jobPath), health = await readJson(path.join(outputDir, 'config/health.json'));
  assert.deepEqual(job.destinations, []); assert.equal(job.backup.custody_file, null);
  assert.equal(health.readiness, null);
  assert.deepEqual(health, {
    schemaVersion:1,
    source:{ stateDir:options.sourceStateDir, targetId:'local-source', maxScanAgeSeconds:120, expectedSupabaseUrl:options.sourceUrl },
    backup:{ jobConfigFile:jobPath, maxAgeHours:7, maxRunHours:2 }, readiness:null,
  });
  const script = `import sys\nsys.path.insert(0, sys.argv[1])\nimport job\nfrom common import load_env, postgres_env\ntry:\n    job.load_config(sys.argv[2])\nexcept ValueError as error:\n    assert 'destinations' in str(error), str(error)\nelse:\n    raise AssertionError('Incomplete job was accepted')\nenv=load_env(sys.argv[3])\nfor key in ('PGHOST','PGPORT','PGDATABASE','PGUSER','SUPABASE_SOURCE_SERVICE_ROLE_KEY'):\n    assert env[key] == ''\nassert env['PGSSLMODE'] == 'verify-full'\nassert env['PGPASSFILE'] == sys.argv[4]\ntry:\n    postgres_env(env)\nexcept ValueError as error:\n    assert 'PGHOST' in str(error)\nelse:\n    raise AssertionError('Incomplete source was accepted')\nprint('rejected-before-live-actions')\n`;
  const run = spawnSync('python3', ['-c', script, path.join(ROOT, 'infrastructure/backup'), jobPath, envPath,
    path.join(outputDir, 'credentials/source.pgpass')], { encoding:'utf8' });
  assert.equal(run.status, 0, run.stderr); assert.equal(run.stdout.trim(), 'rejected-before-live-actions');
  assert.equal((await verifySetup(outputDir)).incomplete, true);
}));

test('refuses even empty existing output, files and final symlinks without adopting or changing them', () => fixture(async ({ options, base, outputDir }) => {
  // mkdir's mode is masked by the process umask. Source-release CI uses 077, which turns 0755 into 0700
  // before createSetup runs. Pin 0755 so the refusal is proven not to tighten or replace that destination.
  await fs.mkdir(outputDir, { mode:0o755 });
  await fs.chmod(outputDir, 0o755);
  await assert.rejects(createSetup(options), /already exists/);
  assert.deepEqual(await fs.readdir(outputDir), []); assert.equal((await fs.stat(outputDir)).mode & 0o777, 0o755);
  await fs.rmdir(outputDir); await fs.writeFile(outputDir, 'existing-owned-by-someone-else');
  await assert.rejects(createSetup(options), /already exists/); assert.equal(await fs.readFile(outputDir, 'utf8'), 'existing-owned-by-someone-else');
  await fs.unlink(outputDir);
  const real = path.join(base, 'real-existing'); await fs.mkdir(real); await fs.symlink(real, outputDir);
  await assert.rejects(createSetup(options), /symlink/); assert.equal((await fs.lstat(outputDir)).isSymbolicLink(), true);
  assert.deepEqual(await fs.readdir(real), []);
}));

test('refuses repository descendants/ancestors, symlink parents, traversal aliases and overlapping source state', () => fixture(async ({ options, base, root, sourceStateDir }) => {
  for (const outputDir of [path.join(root, 'setup'), base, path.join(sourceStateDir, 'setup')]) {
    await assert.rejects(createSetup({ ...options, outputDir }), /outside|separate/);
  }
  await fs.symlink(root, path.join(base, 'repo-alias'));
  await assert.rejects(createSetup({ ...options, outputDir:path.join(base, 'repo-alias/setup') }), /symlink/);
  await fs.symlink(base, path.join(base, 'external-alias'));
  await assert.rejects(createSetup({ ...options, outputDir:path.join(base, 'external-alias/setup') }), /symlink/);
  await assert.rejects(createSetup({ ...options, outputDir:base+'/future/../source/setup' }), /traversal/);
  await assert.rejects(createSetup({ ...options, outputDir:'relative/setup' }), /absolute/);
  assert.deepEqual(await fs.readdir(root), []);
}));

test('requires existing private owned external source state and rejects source links without reading its contents', () => fixture(async ({ options, base, root, sourceStateDir }) => {
  await fs.chmod(sourceStateDir, 0o755);
  await assert.rejects(createSetup(options), /private/); assert.equal((await fs.stat(sourceStateDir)).mode & 0o777, 0o755);
  await fs.chmod(sourceStateDir, 0o700);
  await fs.symlink(sourceStateDir, path.join(base, 'state-alias'));
  await assert.rejects(createSetup({ ...options, sourceStateDir:path.join(base, 'state-alias') }), /symlink/);
  await assert.rejects(createSetup({ ...options, sourceStateDir:path.join(root, 'state') }), /outside/);
  await assert.rejects(createSetup({ ...options, sourceStateDir:path.join(base, 'missing-state') }), { code:'ENOENT' });
  assert.equal((await fs.readdir(base)).some(name => name.startsWith('.tapuai-setup-')), false);
}));

test('preserves existing parent permissions and creates only new private parent folders', () => fixture(async ({ options, base }) => {
  const parent = path.join(base, 'existing-parent'); await fs.mkdir(parent); await fs.chmod(parent, 0o755);
  const outputDir = path.join(parent, 'new-parent/second-parent/setup');
  await createSetup({ ...options, outputDir });
  assert.equal((await fs.stat(parent)).mode & 0o777, 0o755);
  for (const dirname of ['new-parent','new-parent/second-parent','new-parent/second-parent/setup']) {
    assert.equal((await fs.stat(path.join(parent, dirname))).mode & 0o777, 0o700);
  }
  assert.equal((await verifySetup(outputDir)).integrity, 'verified');
}));

test('failed promotion removes only owned staging/new parents and leaves existing parents untouched', () => fixture(async ({ options, base }) => {
  const parent = path.join(base, 'existing-parent'); await fs.mkdir(parent); await fs.chmod(parent, 0o755);
  const outputDir = path.join(parent, 'new-parent/setup');
  const previous = process.env.PATH;
  try { process.env.PATH = ''; await assert.rejects(createSetup({ ...options, outputDir }), /promotion failed/); }
  finally { process.env.PATH = previous; }
  assert.deepEqual(await fs.readdir(parent), []); assert.equal((await fs.stat(parent)).mode & 0o777, 0o755);
  await assert.rejects(fs.lstat(outputDir), { code:'ENOENT' });
}));

test('a concurrently created destination is retained and owned staging is cleaned', () => fixture(async ({ options, base, outputDir }) => {
  // Poll for staging instead of fs.watch: promotion runs a synchronous subprocess that blocks the event loop,
  // so a lagging watch event can arrive after the rename and be dropped by close(), losing the collision.
  // Staging takes dozens of event-loop turns (every file write, chmod and verify read), so the first poll
  // after mkdtemp always plants the destination long before the pre-promotion re-check.
  let created = false, stopped = false;
  const race = (async () => {
    while (!stopped) {
      if (!created && (await fs.readdir(base)).some(name => name.startsWith('.tapuai-setup-'))) {
        created = true; mkdirSync(outputDir, { mode:0o700 }); writeFileSync(path.join(outputDir, 'owner-marker'), 'retained');
        return;
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  })();
  try { await assert.rejects(createSetup(options), /already exists|promotion failed/); }
  finally { stopped = true; await race; }
  assert.equal(created, true); assert.equal(await fs.readFile(path.join(outputDir, 'owner-marker'), 'utf8'), 'retained');
  assert.equal((await fs.readdir(base)).some(name => name.startsWith('.tapuai-setup-')), false);
}));

test('integrity fails on changed content, public permissions, symlinks, missing directories and unrecorded files', () => fixture(async ({ options, outputDir, base }) => {
  await createSetup(options);
  const filename = path.join(outputDir, 'config/backup.env'), initial = await fs.readFile(filename);
  await fs.appendFile(filename, '# changed\n'); await assert.rejects(verifySetup(outputDir), /hash changed/);
  await fs.writeFile(filename, initial); await fs.chmod(filename, 0o644); await assert.rejects(verifySetup(outputDir), /private/);
  await fs.chmod(filename, 0o600);
  const external = path.join(base, 'external.env'); await fs.writeFile(external, initial, { mode:0o600 });
  await fs.unlink(filename); await fs.symlink(external, filename); await assert.rejects(verifySetup(outputDir), /symlink/);
  await fs.unlink(filename); await fs.writeFile(filename, initial, { mode:0o600 });
  await fs.writeFile(path.join(outputDir, 'unrecorded.txt'), 'new', { mode:0o600 });
  await assert.rejects(verifySetup(outputDir), /Unexpected/); await fs.unlink(path.join(outputDir, 'unrecorded.txt'));
  await fs.rmdir(path.join(outputDir, 'data/backups')); await assert.rejects(verifySetup(outputDir), /missing/);
}));

test('strict CLI rejects extra/duplicate/secret arguments and invalid public origins without reflecting supplied secret values', () => fixture(async ({ sourceStateDir, outputDir, options }) => {
  const baseArgs = ['--output-dir', outputDir, '--source-url', options.sourceUrl, '--source-state-dir', sourceStateDir];
  const secret = 'supplied-secret-not-in-errors';
  for (const args of [
    [...baseArgs, '--service-role-key', secret], [...baseArgs, '--source-url', 'https://second.supabase.co'],
    [...baseArgs, '--output-dir'], ['--source-url', 'https://user:'+secret+'@source.supabase.co', '--output-dir', outputDir, '--source-state-dir', sourceStateDir],
  ]) {
    const run = spawnSync(process.execPath, [CLI, ...args], { encoding:'utf8' });
    assert.equal(run.status, 1); assert.equal(run.stdout, ''); assert.equal(run.stderr.includes(secret), false);
  }
  for (const sourceUrl of ['http://abcdefghijklmnopqrst.supabase.co', 'https://localhost', 'https://127.0.0.1',
    'https://db.internal', 'https://source.supabase.co/path', 'https://source.supabase.co:444', 'https://source.supabase.co?key=x']) {
    await assert.rejects(createSetup({ ...options, sourceUrl }), /HTTPS public/);
  }
  await assert.rejects(createSetup({ ...options, sourceTargetId:'not valid' }), /target ID/);
  await assert.rejects(createSetup({ ...options, secret }), /Unsupported/);
  await assert.rejects(fs.lstat(outputDir), { code:'ENOENT' });
}));

test('CLI produces a non-runnable receipt and README quotes every generated path as one shell argument', () => fixture(async ({ options, base, sourceStateDir }) => {
  const outputDir = path.join(base, "private setup ' $(printf should-not-run)");
  const run = spawnSync(process.execPath, [CLI, '--output-dir', outputDir, '--source-url', options.sourceUrl,
    '--source-state-dir', sourceStateDir], { encoding:'utf8' });
  assert.equal(run.status, 0, run.stderr); const result = JSON.parse(run.stdout);
  assert.equal(result.incomplete, true); assert.equal(result.backupCreated, false); assert.equal(result.servicesActivated, false);
  const readme = await fs.readFile(path.join(outputDir, 'README.md'), 'utf8');
  const command = readme.split('\n').find(line => line.startsWith('pnpm exit:health '));
  // Capture arguments with a shell function; the README must never expand embedded substitutions.
  const capture = spawnSync('/bin/sh', ['-c', 'pnpm() { printf "%s\\n" "$@"; }; '+command], { encoding:'utf8' });
  assert.equal(capture.status, 0, capture.stderr);
  assert.deepEqual(capture.stdout.trimEnd().split('\n'), ['exit:health', '--config-file', path.join(outputDir, 'config/health.json')]);
  const env = await fs.readFile(path.join(outputDir, 'config/backup.env'), 'utf8');
  assert.ok(env.includes(`PGPASSFILE="${path.join(outputDir, 'credentials/source.pgpass')}"`));
  assert.equal((await verifySetup(outputDir)).readyToCutOver, false);
}));
