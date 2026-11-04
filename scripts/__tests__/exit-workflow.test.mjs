/** CI source export must retain honest current artifacts, bind run/source identity, and never need provider secrets. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const workflow = await fs.readFile(path.join(repository, '.github/workflows/exit-release.yml'), 'utf8');
const steps = workflow.split(/^      - (?=name:|uses:)/m).slice(1);
const step = id => {
  const result = steps.find(source => new RegExp(`^        id: ${id}$`, 'm').test(source));
  assert.ok(result, `missing workflow step ${id}`);
  return result;
};
const script = id => {
  const match = step(id).match(/^        run: \|\n((?:          .*\n?)*)/m);
  assert.ok(match, `missing executable script ${id}`);
  return match[1].split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('all branch and PR events plus the default-branch sweep are read-only source jobs', () => {
  assert.match(workflow, /push:\n    branches: \['\*\*'\]/);
  assert.match(workflow, /  pull_request:\n/);
  assert.match(workflow, /  schedule:\n    - cron: '[^']+'/);
  assert.match(workflow, /  workflow_dispatch:/);
  assert.match(workflow, /permissions:\n  contents: read\n/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /pull_request_target|workflow_run|secrets\.|id-token:|contents: write|actions: write/);
  assert.doesNotMatch(workflow, /\b(?:backup:create|backup:restore|backup:publish|backup:job|terraform apply|docker push|aws s3|az storage)\b/);
  assert.doesNotMatch(workflow, /--acknowledge|--watch|SUPABASE_.*KEY|PGPASSWORD|PGPASSFILE/);
});

test('raw current source precedes optional full checks and quality failure remains a workflow failure', () => {
  assert.ok(workflow.indexOf('id: capture') < workflow.indexOf('id: verify_code'));
  assert.ok(workflow.indexOf('id: verify_code') < workflow.indexOf('id: provenance'));
  assert.match(script('capture'), /pnpm exit:sync sync --state-dir "\$EXIT_SYNC_STATE_DIRECTORY" --target-id source-review --keep 3\n/);
  assert.doesNotMatch(script('capture'), /--verify-code/);
  assert.match(script('verify_code'), /--keep 3 --verify-code/);
  assert.match(step('verify_code'), /continue-on-error: true/);
  assert.match(step('provenance'), /if: always\(\) && steps\.capture\.outcome == 'success'/);
  const upload = steps.find(source => source.includes('actions/upload-artifact@v4'));
  assert.match(upload, /if: always\(\) && steps\.capture\.outcome == 'success' && steps\.provenance\.outcome == 'success' && steps\.transport\.outcome == 'success'/);
  assert.match(upload, /continue-on-error: true/); // quota must not fail the job when verify-code passed
  assert.match(upload, /github\.event_name.*github\.sha.*github\.run_id.*github\.run_attempt/);
  assert.match(upload, /retention-days: 7/);
  assert.match(upload, /tapuai-exit-source-bundle\.tar\.gz\n.*tapuai-exit-source-bundle\.tar\.gz\.sha256/);
  assert.doesNotMatch(upload, /github\.workspace|path: \./);
  assert.match(upload, /include-hidden-files: true/);
  assert.match(workflow, /run: test "\$EXIT_VERIFICATION_OUTCOME" = success/);
  assert.doesNotMatch(workflow, /steps\.verify_code\.conclusion/); // continue-on-error conclusion can falsely say success
});

async function fixture(run) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-exit-workflow-'));
  try {
    const state = path.join(temporary, 'state');
    const releasePath = 'releases/12345678-1234-1234-1234-123456789abc';
    const release = path.join(state, releasePath);
    const bin = path.join(temporary, 'bin');
    await fs.mkdir(release, { recursive: true, mode: 0o700 });
    await fs.mkdir(bin, { mode: 0o700 });
    const manifest = { schemaVersion: 1, format: 'tapuai-exit-release/1', targetId: 'source-review',
      releaseVersion: 'a'.repeat(64), sourceTreeHash: 'b'.repeat(64), manifestSha256: 'c'.repeat(64), codeVerification: 'not-run' };
    const pointer = { schemaVersion: 1, owner: 'tapuai-exit-sync/1', repositoryRoot: temporary,
      targetId: manifest.targetId, releasePath, releaseVersion: manifest.releaseVersion,
      sourceTreeHash: manifest.sourceTreeHash, manifestSha256: manifest.manifestSha256,
      codeVerification: manifest.codeVerification, capturedAt: '2026-10-19T00:00:00.000Z' };
    const write = (filename, value) => fs.writeFile(filename, JSON.stringify(value) + '\n', { mode: 0o600 });
    const latest = path.join(state, 'latest.json'), manifestFile = path.join(release, 'manifest.json');
    await write(latest, pointer);
    await write(manifestFile, manifest);
    await write(path.join(state, 'status.json'), { status: 'failed', checkedAt: '2026-10-19T00:01:00.000Z', error: 'synthetic-code-check-failed' });
    await fs.writeFile(path.join(bin, 'git'), `#!${process.execPath}\nif (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(['rev-parse','--verify','HEAD'])) process.exit(2);\nprocess.stdout.write(process.env.EXIT_WORKFLOW_TEST_COMMIT+'\\n');\n`, { mode: 0o700 });
    const provenance = path.join(temporary, 'provenance.json');
    const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH,
      EXIT_SYNC_STATE_DIRECTORY: state, EXIT_PROVENANCE_FILE: provenance, EXIT_VERIFICATION_OUTCOME: 'failure',
      EXIT_EXPECTED_COMMIT: 'd'.repeat(40), EXIT_WORKFLOW_TEST_COMMIT: 'd'.repeat(40),
      EXIT_PR_HEAD_COMMIT: 'e'.repeat(40), EXIT_PR_BASE_COMMIT: 'f'.repeat(40),
      GITHUB_REPOSITORY: 'synthetic/tapuai', GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF: 'refs/pull/123/merge',
      GITHUB_RUN_ID: '12345', GITHUB_RUN_ATTEMPT: '2', GITHUB_TOKEN: 'synthetic-secret-never-export' };
    const execute = () => spawnSync('bash', ['-eu', '-c', script('provenance')], { cwd: temporary, env, encoding: 'utf8' });
    await run({ temporary, state, release, latest, manifestFile, pointer, manifest, write, env, provenance, execute });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

test('the actual provenance script binds a failed code check to the retained raw source without exporting secrets', async () => fixture(async context => {
  const result = context.execute();
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(await fs.readFile(context.provenance, 'utf8'));
  assert.equal(evidence.releaseVersion, context.pointer.releaseVersion);
  assert.equal(evidence.latestPointerSha256, hash(await fs.readFile(context.latest)));
  assert.equal(evidence.manifestFileSha256, hash(await fs.readFile(context.manifestFile)));
  assert.equal(evidence.manifestSha256, context.pointer.manifestSha256);
  assert.equal(evidence.codeCheckOutcome, 'failure');
  assert.equal(evidence.codeVerification, 'not-run');
  assert.equal(evidence.readyToCutOver, false);
  assert.equal(evidence.databaseData, 'not-included');
  assert.equal(evidence.runtimeImages, 'not-included');
  assert.equal(evidence.checkedOutCommit, context.env.EXIT_EXPECTED_COMMIT);
  assert.equal(evidence.pullRequestHeadCommit, context.env.EXIT_PR_HEAD_COMMIT);
  assert.equal(evidence.pullRequestBaseCommit, context.env.EXIT_PR_BASE_COMMIT);
  assert.equal(evidence.runId, '12345');
  assert.equal(evidence.runAttempt, '2');
  assert.ok(!JSON.stringify(evidence).includes('synthetic-secret-never-export'));
  assert.equal((await fs.stat(context.provenance)).mode & 0o777, 0o600);
  assert.ok(!(await fs.readdir(context.release)).includes('provenance.json'));
}));

test('actual tar transport preserves private/executable modes and includes only state plus provenance', async () => fixture(async context => {
  const state = path.join(context.temporary, 'tapuai-exit-source-state');
  await fs.rename(context.state, state);
  const executable = path.join(state, 'synthetic-runner.py');
  await fs.writeFile(executable, '# synthetic executable\n', { mode: 0o700 });
  await fs.writeFile(path.join(context.temporary, 'tapuai-exit-source-provenance.json'), '{"synthetic":true}\n', { mode: 0o600 });
  // Unrelated runner/checkout data must not be selected by the transport command.
  await fs.writeFile(path.join(context.temporary, '.env.private'), 'synthetic-excluded-secret\n', { mode: 0o600 });
  const env = { ...context.env, RUNNER_TEMP: context.temporary };
  const result = spawnSync('bash', ['-eu', '-c', script('transport')], { cwd: context.temporary, env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const archive = path.join(context.temporary, 'tapuai-exit-source-bundle.tar.gz');
  const sidecar = await fs.readFile(archive + '.sha256', 'utf8');
  assert.equal(sidecar, hash(await fs.readFile(archive)) + '  tapuai-exit-source-bundle.tar.gz\n');
  assert.equal((await fs.stat(archive)).mode & 0o777, 0o600);
  const listed = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  assert.ok(listed.stdout.split('\n').filter(Boolean).every(name => name.startsWith('tapuai-exit-source-state') || name === 'tapuai-exit-source-provenance.json'));
  assert.ok(!listed.stdout.includes('.env.private'));
  const unpack = path.join(context.temporary, 'unpacked');
  await fs.mkdir(unpack, { mode: 0o700 });
  const extracted = spawnSync('tar', ['-xzf', archive, '-C', unpack], { encoding: 'utf8' });
  assert.equal(extracted.status, 0, extracted.stderr);
  assert.equal((await fs.stat(path.join(unpack, 'tapuai-exit-source-state'))).mode & 0o777, 0o700);
  assert.equal((await fs.stat(path.join(unpack, 'tapuai-exit-source-state/latest.json'))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(path.join(unpack, 'tapuai-exit-source-state/synthetic-runner.py'))).mode & 0o777, 0o700);
}));

test('transport refuses source symlinks before creating any archive', async () => fixture(async context => {
  const state = path.join(context.temporary, 'tapuai-exit-source-state');
  await fs.rename(context.state, state);
  await fs.writeFile(path.join(context.temporary, 'tapuai-exit-source-provenance.json'), '{}\n', { mode: 0o600 });
  await fs.writeFile(path.join(context.temporary, 'outside-private.json'), '{}\n', { mode: 0o600 });
  await fs.symlink(path.join(context.temporary, 'outside-private.json'), path.join(state, 'linked.json'));
  const result = spawnSync('bash', ['-eu', '-c', script('transport')], {
    cwd: context.temporary, env: { ...context.env, RUNNER_TEMP: context.temporary }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  await assert.rejects(fs.stat(path.join(context.temporary, 'tapuai-exit-source-bundle.tar.gz')), { code: 'ENOENT' });
}));

test('transport refuses existing output links without changing unrelated files', async () => fixture(async context => {
  await fs.rename(context.state, path.join(context.temporary, 'tapuai-exit-source-state'));
  await fs.writeFile(path.join(context.temporary, 'tapuai-exit-source-provenance.json'), '{}\n', { mode: 0o600 });
  const unrelated = path.join(context.temporary, 'unrelated.txt');
  await fs.writeFile(unrelated, 'preserve-this-synthetic-file\n', { mode: 0o600 });
  await fs.symlink(unrelated, path.join(context.temporary, 'tapuai-exit-source-bundle.tar.gz'));
  const result = spawnSync('bash', ['-eu', '-c', script('transport')], {
    cwd: context.temporary, env: { ...context.env, RUNNER_TEMP: context.temporary }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.equal(await fs.readFile(unrelated, 'utf8'), 'preserve-this-synthetic-file\n');
}));

test('successful code checks must point at the newly verified release', async () => fixture(async context => {
  context.env.EXIT_VERIFICATION_OUTCOME = 'success';
  assert.notEqual(context.execute().status, 0);
  context.pointer.codeVerification = context.manifest.codeVerification = 'passed';
  await context.write(context.latest, context.pointer);
  await context.write(context.manifestFile, context.manifest);
  assert.equal(context.execute().status, 0);
  assert.equal(JSON.parse(await fs.readFile(context.provenance, 'utf8')).codeVerification, 'passed');
}));

test('checkout identity or pointer/manifest mismatches block run provenance', async () => fixture(async context => {
  context.env.EXIT_WORKFLOW_TEST_COMMIT = '1'.repeat(40);
  assert.notEqual(context.execute().status, 0);
  context.env.EXIT_WORKFLOW_TEST_COMMIT = context.env.EXIT_EXPECTED_COMMIT;
  context.manifest.releaseVersion = '2'.repeat(64);
  await context.write(context.manifestFile, context.manifest);
  assert.notEqual(context.execute().status, 0);
  await assert.rejects(fs.stat(context.provenance), { code: 'ENOENT' });
}));

test('public metadata, linked release roots and unsafe pointer paths cannot enter CI evidence', async () => fixture(async context => {
  await fs.chmod(context.latest, 0o644);
  assert.notEqual(context.execute().status, 0);
  await fs.chmod(context.latest, 0o600);
  context.pointer.releasePath = 'releases/../../private';
  await context.write(context.latest, context.pointer);
  assert.notEqual(context.execute().status, 0);
  context.pointer.releasePath = 'releases/12345678-1234-1234-1234-123456789abc';
  await context.write(context.latest, context.pointer);
  const original = path.join(context.temporary, 'real-releases');
  await fs.rename(path.join(context.state, 'releases'), original);
  await fs.symlink(original, path.join(context.state, 'releases'));
  assert.notEqual(context.execute().status, 0);
  await assert.rejects(fs.stat(context.provenance), { code: 'ENOENT' });
}));
