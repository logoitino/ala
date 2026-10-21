/** Content drift and SDK inventory must expose changed behavior without reading private runtime inputs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeExitMap } from '../exit-map-output.mjs';

const helper = await import('../exit-inventory.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('exit-inventory.mjs')) return {};
  throw error;
});
const collect = root => {
  assert.equal(typeof helper.collectExitInventory, 'function', 'a content-aware inventory is required');
  return helper.collectExitInventory(root);
};
async function fixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-exit-inventory-'));
  const put = async (file, content) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  };
  try {
    await put('package.json', '{"name":"fixture"}');
    await put('pnpm-lock.yaml', 'lockfileVersion: 9\n');
    await put('docs/engineering/exit-map.json', '{"components":[]}');
    await put('apps/mobile/src/backend/db/schema.sql', 'create function public.answer() returns int language sql as $$select 1$$;\ncreate table public.items (id int default 1);');
    await put('supabase/migrations/20261019000000_fixture.sql', 'select 1;');
    await put('supabase/functions/checkout/index.ts', 'export const amount = 1;');
    await put('apps/mobile/app/api/checkout+api.ts', 'export const amount = 1;');
    await put('infrastructure/backup/job.py', 'VERSION = 1\n');
    await fn(root, put);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('unchanged names still invalidate the plan after schema, migration, endpoint or deployment body changes', async () => fixture(async (root, put) => {
  const initial = collect(root);
  assert.equal(collect(root).sourceHash, initial.sourceHash);
  const edits = [
    ['apps/mobile/src/backend/db/schema.sql', 'create function public.answer() returns int language sql as $$select 2$$;\ncreate table public.items (id int default 1);'],
    ['apps/mobile/src/backend/db/schema.sql', 'create function public.answer() returns int language sql as $$select 2$$;\ncreate table public.items (id int default 2);'],
    ['supabase/migrations/20261019000000_fixture.sql', 'select 2;'],
    ['supabase/functions/checkout/index.ts', 'export const amount = 2;'],
    ['apps/mobile/app/api/checkout+api.ts', 'export const amount = 2;'],
    ['infrastructure/backup/job.py', 'VERSION = 2\n'],
    ['docs/engineering/exit-map.json', '{"components":[{"id":"azure"}]}'],
    ['pnpm-lock.yaml', 'lockfileVersion: 9\nsettings: changed\n'],
  ];
  let previous = initial.sourceHash;
  for (const [file, content] of edits) {
    await put(file, content);
    const next = collect(root);
    assert.notEqual(next.sourceHash, previous, file);
    previous = next.sourceHash;
  }
}));

test('AST inventory records aliased SDK, wrapper, nested route and typed client callsites with literal targets', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/demo.ts', `import { supabase as db } from './supabase';
import { callRpc as invokeRpc } from './rpc';
const TABLE = 'profiles';
const other = db;
other.from(TABLE).select('id');
invokeRpc('current_profile');
db.auth.mfa.challenge({factorId: 'not-exported'});
db.storage.from('avatars').upload('not-exported', new Uint8Array());
db.functions.invoke('checkout');
db.channel('game:public').on('postgres_changes', {schema: 'public', table: 'games'}, () => {}).subscribe();
// db.from('comment_only');
const label = "db.rpc('string_only')";`);
  await put('apps/mobile/app/api/nested/worker+api.ts', `import { createClient as makeClient, type SupabaseClient } from '@supabase/supabase-js';
const admin = makeClient(process.env.URL, process.env.KEY);
admin.rpc('worker_action');
export function read(client: SupabaseClient) { return client.from('games'); }`);
  const { callsites } = collect(root);
  for (const [kind, target] of [['database.from', 'profiles'], ['database.rpc', 'current_profile'], ['auth.mfa.challenge', null], ['storage.from', 'avatars'], ['functions.invoke', 'checkout'], ['realtime.on', 'games'], ['database.rpc', 'worker_action'], ['database.from', 'games']]) {
    assert.ok(callsites.some(site => site.kind === kind && site.target === target && site.clientResolution === 'resolved'), `${kind}:${target}`);
  }
  assert.equal(callsites.find(site => site.target === 'profiles').line, 5);
  assert.ok(callsites.every(site => Number.isInteger(site.line) && Number.isInteger(site.column)));
  assert.ok(!JSON.stringify(callsites).includes('not-exported'));
  assert.ok(!callsites.some(site => ['comment_only', 'string_only'].includes(site.target)));
}));

test('media storage adapter calls name their bucket; untyped receivers and dynamic buckets stay review candidates', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/services/upload.ts', `import { mediaStorage, type MediaStorageAdapter } from '@/lib/mediaStorage';
const VAULT = 'reel_vault';
export async function save(storage: MediaStorageAdapter = mediaStorage, bucket: string) {
  await storage.upload(VAULT, 'private/not-exported.mp4', new ArrayBuffer(0), { contentType: 'video/mp4' });
  await mediaStorage.sign('reels', 'not-exported', 60);
  await storage.remove(bucket, ['not-exported']);
}
export function other(storage: { upload(bucket: string): void }) { storage.upload('lookalike'); }`);
  const result = collect(root);
  const adapter = result.callsites.filter(site => site.via);
  assert.deepEqual(adapter.map(site => [site.target, site.via, site.clientResolution]), [
    ['reel_vault', 'MediaStorageAdapter.upload', 'resolved'], ['reels', 'MediaStorageAdapter.sign', 'resolved'], [null, 'MediaStorageAdapter.remove', 'resolved']]);
  assert.ok(adapter.every(site => site.kind === 'storage.from'));
  assert.ok(adapter.find(site => site.target === null).reviewRequired);
  assert.deepEqual(result.inventory.storageBuckets, ['reel_vault', 'reels']);
  assert.ok(!result.callsites.some(site => site.target === 'lookalike'));
  assert.ok(!JSON.stringify(result.callsites).includes('not-exported'));
}));

test('dynamic targets and unresolved client origins require explicit owner review', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/dynamic.ts', `import { supabase } from './supabase';
export function run(table: string, client: unknown) {
  supabase.from(table);
  supabase.rpc(getRpcName());
  (client as any).from('unknown_origin');
}`);
  const result = collect(root);
  assert.ok(result.callsites.some(site => site.kind === 'database.from' && site.target === null && site.targetResolution === 'dynamic' && site.reviewRequired));
  assert.ok(result.callsites.some(site => site.target === 'unknown_origin' && site.clientResolution === 'unresolved' && site.reviewRequired));
  assert.equal(result.reviewRequiredCallsites.length, 3);
  assert.ok(result.reviewRequiredCallsites.every(site => site.reviewers.length));
}));

test('private files and generated runtime trees do not alter hashes or enter exported inventory', async () => fixture(async (root, put) => {
  const before = collect(root);
  for (const file of ['apps/mobile/.env.local', 'apps/mobile/customer-data.json', 'infrastructure/backup/secrets.json', 'infrastructure/terraform/aws/terraform.tfstate', 'infrastructure/terraform/aws/private.tfvars', 'apps/mobile/node_modules/private.js', 'apps/mobile/dist/private.js']) {
    await put(file, 'synthetic_private_do_not_export');
  }
  await fs.symlink(path.join(root, 'apps/mobile/.env.local'), path.join(root, 'apps/mobile/.env.secret'));
  const after = collect(root);
  assert.equal(after.sourceHash, before.sourceHash);
  assert.ok(!JSON.stringify(after).includes('synthetic_private_do_not_export'));
  assert.ok(!after.sourceFiles.some(file => file.path.includes('.env') || file.path.endsWith('.tfstate')));
}));

test('a source symlink cannot import files outside the checkout', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/ordinary.ts', 'export const safe = true;');
  await fs.symlink(path.join(root, 'package.json'), path.join(root, 'apps/mobile/src/frontend/lib/link.ts'));
  assert.throws(() => collect(root), /symlink/i);
}));

test('dangling source links fail and the release interface binds machine inventory to content', async () => fixture(async root => {
  const current = collect(root);
  assert.equal(current.schemaVersion, 1);
  assert.match(current.planVersion, /^[a-f0-9]{12}$/);
  assert.equal(current.contentHash, current.sourceHash);
  assert.deepEqual(current.calls, current.callsites);
  assert.deepEqual(current.unresolvedCalls, current.reviewRequiredCallsites);
  assert.ok(current.inventory.functions.includes('public.answer'));
  await fs.symlink(path.join(root, 'missing.ts'), path.join(root, 'apps/mobile/src/dangling.ts'));
  assert.throws(() => collect(root), /symlink/i);
}));

test('SDK result values and shadowed literal names cannot manufacture resolved capabilities', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/results.ts', `import { supabase } from './supabase';
const TABLE = 'profiles';
const { data } = await supabase.auth.getSession();
data.session.access_token.trim();
export function read(TABLE: string) { return supabase.from(TABLE); }`);
  const result = collect(root);
  assert.deepEqual(result.inventory.authMethods, ['getSession']);
  assert.ok(result.calls.some(site => site.kind === 'database.from' && site.targetResolution === 'dynamic'));
}));

test('legacy preflight requires the independently verified evidence config before claiming GO', () => {
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  const result = spawnSync(process.execPath, ['scripts/exit-map.mjs', '--preflight'], { cwd: repository, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /strong-evidence-required/);
});

test('execution preflight invokes the final cutover phase and rejects an incomplete independent gate', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-preflight-cli-'));
  try {
    const capture = path.join(directory, 'arguments.json');
    const stub = path.join(directory, 'python3');
    await fs.writeFile(stub, `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.EXIT_PHASE_TEST_CAPTURE, JSON.stringify(process.argv.slice(2)));\nprocess.exit(2);\n`, { mode: 0o700 });
    const repository = fileURLToPath(new URL('../../', import.meta.url));
    const result = spawnSync(process.execPath, ['scripts/exit-map.mjs', '--preflight', '--evidence-config', '/synthetic/private-config.json'], {
      cwd: repository, encoding: 'utf8', env: { ...process.env, PATH: directory + path.delimiter + process.env.PATH, EXIT_PHASE_TEST_CAPTURE: capture },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /strong-evidence-rejected/);
    const argumentsList = JSON.parse(await fs.readFile(capture, 'utf8'));
    assert.equal(argumentsList[argumentsList.indexOf('--phase') + 1], 'cutover');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('mapping config ancestors cannot link private inputs into the inventory', async () => fixture(async root => {
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-private-mapping-'));
  try {
    await fs.writeFile(path.join(external, 'exit-map.json'), '{"synthetic":"private"}');
    await fs.rm(path.join(root, 'docs/engineering'), { recursive: true });
    await fs.symlink(external, path.join(root, 'docs/engineering'));
    assert.throws(() => collect(root), /symlink/i);
  } finally { await fs.rm(external, { recursive: true, force: true }); }
}));

test('qualified database schemas and shadowed client parameters stay explicit', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/schema.ts', `import { supabase as db } from './supabase';
const privateDb = db.schema('private');
privateDb.from('audit');
db.schema('sports').rpc('score');
export function dynamic(schema: string) { return db.schema(schema).from('games'); }
export function shadow(db: any) { return db.from('unresolved'); }
export function typed(db: SupabaseClient) { return db.from('profiles'); }`);
  const result = collect(root);
  assert.equal(result.calls.find(site => site.target === 'audit').schema, 'private');
  assert.equal(result.calls.find(site => site.target === 'score').schema, 'sports');
  assert.ok(result.calls.some(site => site.target === 'games' && site.schemaResolution === 'dynamic' && site.reviewRequired));
  assert.equal(result.calls.find(site => site.target === 'unresolved').clientResolution, 'unresolved');
  assert.equal(result.calls.find(site => site.target === 'profiles').clientResolution, 'resolved');
}));

test('runtime-computed SDK methods are explicit review candidates', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/computed.ts', `import { supabase } from './supabase';
export function run(action: string) { return supabase.auth[action](); }
export function query(operation: string) { return supabase[operation]('profiles'); }`);
  const result = collect(root);
  assert.equal(result.calls.length, 2);
  assert.equal(result.unresolvedCalls.length, 2);
  assert.ok(result.calls.every(site => site.methodResolution === 'dynamic' && site.reviewRequired));
}));

test('local variable shadowing cannot inherit outer client or literal-target provenance', async () => fixture(async (root, put) => {
  await put('apps/mobile/src/frontend/lib/shadow.ts', `import { supabase as db } from './supabase';
import { callRpc as invoke } from './rpc';
const TABLE = 'profiles';
export function otherClient() { const db = unrelatedClient(); return db.from('local'); }
export function otherTable() { const TABLE = runtimeTable(); return db.from(TABLE); }
export function otherWrapper() { const invoke = unrelatedFunction(); return invoke('local_rpc'); }`);
  const result = collect(root);
  assert.equal(result.calls.find(site => site.target === 'local').clientResolution, 'unresolved');
  assert.ok(result.calls.some(site => site.targetResolution === 'dynamic' && site.reviewRequired));
  assert.equal(result.calls.find(site => site.target === 'local_rpc').clientResolution, 'unresolved');
}));

// Test the exact automatic writer without modifying the working repo's generated document.
test('map output refuses final/ancestor links and identical regeneration does not change mtime', async () => fixture(async (root, put) => {
  const output = 'docs/engineering/EXIT_INFRASTRUCTURE_MAP.md';
  await put(output, '# Original\n');
  const before = await fs.stat(path.join(root, output));
  assert.equal(writeExitMap(root, output, '# Original\n'), false);
  assert.equal((await fs.stat(path.join(root, output))).mtimeMs, before.mtimeMs);
  assert.equal(writeExitMap(root, output, '# Changed\n'), true);
  await put('docs/private-target.md', '# Preserve\n');
  await fs.unlink(path.join(root, output));
  await fs.symlink(path.join(root, 'docs/private-target.md'), path.join(root, output));
  assert.throws(() => writeExitMap(root, output, '# Must not write\n'), /symlink/);
  assert.equal(await fs.readFile(path.join(root, 'docs/private-target.md'), 'utf8'), '# Preserve\n');
  await fs.unlink(path.join(root, output));
  await fs.rename(path.join(root, 'docs/engineering'), path.join(root, 'docs/engineering-original'));
  await fs.symlink(path.join(root, 'docs/engineering-original'), path.join(root, 'docs/engineering'));
  assert.throws(() => writeExitMap(root, output, '# Must not write\n'), /symlink/);
}));
