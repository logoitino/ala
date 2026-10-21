/** Exit releases must preserve exact source, expose drift and refuse ambiguous or altered recovery artifacts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRelease, verifyRelease } from '../release.mjs';

async function fixture(action) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'exit-release-test-'));
  const root = path.join(parent, 'repo');
  await fs.mkdir(root, { mode: 0o700 });
  for (const [name, body] of Object.entries({
    'package.json': '{"name":"synthetic-exit-fixture","private":true}',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'apps/mobile/src/backend/db/schema.sql': 'create table public.synthetic_copy(id uuid);\ncreate function public.synthetic_fn() returns int language sql as $$ select 1 $$;\n',
    'apps/mobile/src/frontend/lib/example.ts': "import {supabase} from './supabase';\nexport const read = () => supabase.from('synthetic_copy').select('*');\n",
    'docs/engineering/exit-map.json': '{"version":1,"components":[]}',
    'infrastructure/backup/backup.py': '"""Synthetic source fixture, no external operations."""\n',
    'infrastructure/backup/secrets.json': '{"synthetic_secret":"must-not-export"}',
  })) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), body);
  }
  try { await action(root, path.join(parent, 'release')); }
  finally { await fs.rm(parent, { recursive: true, force: true }); }
}

test('complete release has exact SQL/source and is current but never declares hosted readiness', async () => fixture(async (root, output) => {
  const result = await createRelease(root, { outputDirectory: output, targetId: 'aws-test' });
  assert.equal(result.readyToCutOver, false);
  const verified = await verifyRelease(output, { root });
  assert.equal(verified.current, true);
  assert.equal(verified.codeVerification, 'not-run');
  assert.equal(await fs.readFile(path.join(root, 'apps/mobile/src/backend/db/schema.sql'), 'utf8'),
    await fs.readFile(path.join(output, 'application/apps/mobile/src/backend/db/schema.sql'), 'utf8'));
  await assert.rejects(fs.access(path.join(output, 'application/infrastructure/backup/secrets.json')));
}));

test('unchanged function name with changed body invalidates a prepared release', async () => fixture(async (root, output) => {
  await createRelease(root, { outputDirectory: output, targetId: 'azure-test' });
  const file = path.join(root, 'apps/mobile/src/backend/db/schema.sql');
  await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('select 1', 'select 2'));
  const result = await verifyRelease(output, { root });
  assert.equal(result.integrity, 'passed');
  assert.equal(result.current, false);
}));

test('corrupt expanded SQL, missing files and unexpected artifacts each fail verification', async () => fixture(async (root, output) => {
  await createRelease(root, { outputDirectory: output, targetId: 'aws-test' });
  const file = path.join(output, 'application/apps/mobile/src/backend/db/schema.sql');
  const bytes = await fs.readFile(file);
  await fs.writeFile(file, 'create table public.lossy(id text);');
  await assert.rejects(verifyRelease(output), /integrity/);
  await fs.writeFile(file, bytes);
  await fs.writeFile(path.join(output, 'unexpected.txt'), 'unexpected', { mode: 0o600 });
  await assert.rejects(verifyRelease(output), /Unexpected/);
  await fs.unlink(path.join(output, 'unexpected.txt'));
  await fs.unlink(file);
  await assert.rejects(verifyRelease(output), /Missing/);
}));

test('public permissions and symlinks in a release are rejected', async () => fixture(async (root, output) => {
  await createRelease(root, { outputDirectory: output, targetId: 'aws-test' });
  const file = path.join(output, 'inventory.json');
  await fs.chmod(file, 0o644);
  await assert.rejects(verifyRelease(output), /private/);
  await fs.chmod(file, 0o600);
  await fs.symlink(root, path.join(output, 'unexpected-link'));
  await assert.rejects(verifyRelease(output), /Unsafe/);
}));

test('existing output, repository output and alias into repository cannot be overwritten', async () => fixture(async (root, output) => {
  await createRelease(root, { outputDirectory: output, targetId: 'aws-test' });
  await assert.rejects(createRelease(root, { outputDirectory: output, targetId: 'aws-test' }), /already exists/);
  await assert.rejects(createRelease(root, { outputDirectory: path.join(root, 'private-release'), targetId: 'aws-test' }), /outside/);
  const alias = path.join(path.dirname(root), 'repo-alias');
  await fs.symlink(root, alias);
  await assert.rejects(createRelease(root, { outputDirectory: path.join(alias, 'private-release'), targetId: 'aws-test' }), /outside/);
}));

test('capsule corruption prevents verification before restored source can be trusted', async () => fixture(async (root, output) => {
  await createRelease(root, { outputDirectory: output, targetId: 'aws-test' });
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'));
  await fs.appendFile(path.join(output, manifest.sourceCapsule), 'corrupt');
  await assert.rejects(verifyRelease(output), /integrity/);
}));
