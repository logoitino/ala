/** Code recovery must preserve source while rejecting secret files, tampering and unsafe restores. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import * as recovery from '../recovery-capsule.mjs';

async function fixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tapuai-capsule-'));
  try {
    await mkdir(path.join(root, 'apps/mobile/src'), { recursive: true });
    await mkdir(path.join(root, 'supabase/migrations'), { recursive: true });
    await writeFile(path.join(root, 'apps/mobile/src/feature.ts'), 'export const healthy = true;\n');
    await writeFile(path.join(root, 'package.json'), '{"name":"fixture"}');
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
    await writeFile(path.join(root, 'supabase/migrations/20261013000100_fixture.sql'), '-- reversible code only\n');
    await fn(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('package and isolated restore preserve source, lockfile and migration hashes', async () => fixture(async (root) => {
  const result = await recovery.createCapsule(root);
  const verified = await recovery.verifyCapsule(result.capsulePath);
  assert.equal(verified.manifest.treeHash, result.metadata.treeHash);
  assert.equal(verified.manifest.verification, 'not-run');
  const restored = await recovery.restoreCapsule(result.capsulePath, root);
  assert.notEqual(restored, root);
  assert.equal(await readFile(path.join(restored, 'apps/mobile/src/feature.ts'), 'utf8'), 'export const healthy = true;\n');
  assert.equal(await readFile(path.join(restored, 'pnpm-lock.yaml'), 'utf8'), 'lockfileVersion: 9\n');
  assert.equal(result.metadata.migrationHashes.length, 1);
}));

test('capsule excludes credentials, runtime data, scratch and dependencies', async () => fixture(async (root) => {
  await writeFile(path.join(root, 'apps/mobile/.env.local'), 'SECRET=synthetic_never_package');
  await mkdir(path.join(root, 'node_modules'), { recursive: true });
  await writeFile(path.join(root, 'node_modules/secret.js'), 'synthetic_never_package');
  await writeFile(path.join(root, 'apps/mobile/local.sqlite'), 'synthetic_never_package');
  const result = await recovery.createCapsule(root);
  const capsule = await recovery.verifyCapsule(result.capsulePath);
  assert.ok(capsule.files.every((file) => !file.path.includes('.env') && !file.path.includes('node_modules') && !file.path.endsWith('.sqlite')));
  assert.ok(!JSON.stringify(capsule).includes('synthetic_never_package'));
}));

test('tampered content cannot verify or restore', async () => fixture(async (root) => {
  const result = await recovery.createCapsule(root);
  const payload = JSON.parse(gunzipSync(await readFile(result.capsulePath)));
  payload.files[0].data = Buffer.from('changed').toString('base64');
  const bad = path.join(root, 'tampered.gz');
  await writeFile(bad, gzipSync(JSON.stringify(payload)));
  await assert.rejects(recovery.verifyCapsule(bad), /hash|size|integrity/i);
  await assert.rejects(recovery.restoreCapsule(bad, root), /hash|size|integrity/i);
}));

test('traversal and duplicate entries are rejected before filesystem writes', async () => fixture(async (root) => {
  const result = await recovery.createCapsule(root);
  const payload = JSON.parse(gunzipSync(await readFile(result.capsulePath)));
  payload.files[0].path = '../outside';
  const bad = path.join(root, 'unsafe.gz');
  await writeFile(bad, gzipSync(JSON.stringify(payload)));
  await assert.rejects(recovery.verifyCapsule(bad), /path/i);
  const original = JSON.parse(gunzipSync(await readFile(result.capsulePath)));
  original.files.push(original.files[0]);
  original.manifest.filesCount = original.files.length;
  await writeFile(bad, gzipSync(JSON.stringify(original)));
  await assert.rejects(recovery.verifyCapsule(bad), /duplicate/i);
}));

test('a preexisting symlink cannot redirect a restore outside the private preview area', async () => fixture(async (root) => {
  const result = await recovery.createCapsule(root);
  const outside = path.join(root, 'outside');
  await mkdir(outside);
  await symlink(outside, path.join(root, '.smoke/recovery/restores'));
  await assert.rejects(recovery.restoreCapsule(result.capsulePath, root), /symlink/i);
}));

test('restore refuses an existing preview and never overwrites current source', async () => fixture(async (root) => {
  const result = await recovery.createCapsule(root);
  await recovery.restoreCapsule(result.capsulePath, root);
  await writeFile(path.join(root, 'apps/mobile/src/feature.ts'), 'current working code');
  await assert.rejects(recovery.restoreCapsule(result.capsulePath, root), /exist/i);
  assert.equal(await readFile(path.join(root, 'apps/mobile/src/feature.ts'), 'utf8'), 'current working code');
}));

test('source symlinks and excessive files fail explicitly', async () => fixture(async (root) => {
  await symlink(path.join(root, 'package.json'), path.join(root, 'apps/mobile/src/link.ts'));
  await assert.rejects(recovery.createCapsule(root), /symlink/i);
  await rm(path.join(root, 'apps/mobile/src/link.ts'));
  await assert.rejects(recovery.createCapsule(root, { maxFiles: 1 }), /limit/i);
}));

test('truncated archives fail and local provenance does not claim application-user authorship', async () => fixture(async (root) => {
  const result = await recovery.createCapsule(root);
  const capsule = await recovery.verifyCapsule(result.capsulePath);
  assert.equal(capsule.provenance.authorship, 'Git records committed authors; uncommitted file authorship is unknown.');
  assert.ok(capsule.provenance.packagedBy);
  await writeFile(result.capsulePath, (await readFile(result.capsulePath)).subarray(0, 50));
  await assert.rejects(recovery.verifyCapsule(result.capsulePath));
}));

 test('conventional credentials/cache files are excluded and ambiguous data fails closed', async () => fixture(async root => {
   await mkdir(path.join(root,'scripts'),{recursive:true});
   await writeFile(path.join(root,'scripts/credentials.json'),'synthetic_private_value');
   await writeFile(path.join(root,'apps/mobile/runtime-cache.json'),'synthetic_private_value');
   const capsule = await recovery.verifyCapsule((await recovery.createCapsule(root)).capsulePath);
   assert.ok(!JSON.stringify(capsule).includes('synthetic_private_value'));
   await writeFile(path.join(root,'apps/mobile/users.json'),'synthetic_private_value');
   await assert.rejects(recovery.createCapsule(root), /Unreviewed source\/data format/);
 }));

 test('packaging provenance is bound to the manifest and cannot change without an integrity failure', async () => fixture(async root => {
   const result = await recovery.createCapsule(root);
   const payload = JSON.parse(gunzipSync(await readFile(result.capsulePath)));
   payload.provenance.packagedBy = 'forged-operator';
   const bad = path.join(root,'forged.gz');await writeFile(bad,gzipSync(JSON.stringify(payload)));
   await assert.rejects(recovery.verifyCapsule(bad), /provenance integrity/);
 }));

test('portable source includes reviewed infrastructure and configuration without operator state', async () => fixture(async root => {
  await mkdir(path.join(root, 'infrastructure/backup'), { recursive: true });
  await mkdir(path.join(root, 'infrastructure/terraform/aws'), { recursive: true });
  await mkdir(path.join(root, 'infrastructure/containers'), { recursive: true });
  await mkdir(path.join(root, 'infrastructure/exit'), { recursive: true });
  await mkdir(path.join(root, 'docs/engineering'), { recursive: true });
  await writeFile(path.join(root, 'infrastructure/backup/backup.py'), '# private backup orchestration\n');
  await writeFile(path.join(root, 'infrastructure/backup/job.config.example.json'), '{"version":1,"destinations":[]}');
  await writeFile(path.join(root, 'infrastructure/exit/readiness.config.example.json'), '{"schemaVersion":1,"targetId":"placeholder"}');
  await writeFile(path.join(root, 'infrastructure/containers/Caddyfile.backend-switch'), '# reviewed API origin\nexample.test { respond 404 }\n');
  await writeFile(path.join(root, 'infrastructure/backup/secrets.json'), 'synthetic-private-value');
  await writeFile(path.join(root, 'infrastructure/terraform/aws/main.tf'), '# reviewed resources\n');
  await writeFile(path.join(root, 'infrastructure/terraform/aws/terraform.tfstate'), 'synthetic-private-value');
  await writeFile(path.join(root, 'infrastructure/terraform/aws/private.tfvars'), 'synthetic-private-value');
  await writeFile(path.join(root, 'docs/engineering/infrastructure.json'), '{"services":[]}');
  await writeFile(path.join(root, 'docs/engineering/BACKUP_OPERATIONS.md'), '# Reviewed recovery procedure\n');
  await writeFile(path.join(root, '.dockerignore'), '.env*\n');
  const capsule = await recovery.verifyCapsule((await recovery.createCapsule(root)).capsulePath);
  for (const expected of ['infrastructure/backup/backup.py', 'infrastructure/backup/job.config.example.json', 'infrastructure/exit/readiness.config.example.json', 'infrastructure/containers/Caddyfile.backend-switch', 'infrastructure/terraform/aws/main.tf', 'docs/engineering/infrastructure.json', 'docs/engineering/BACKUP_OPERATIONS.md', '.dockerignore']) {
    assert.ok(capsule.files.some(file => file.path === expected), expected);
  }
  assert.ok(!JSON.stringify(capsule).includes('synthetic-private-value'));
}));

test('full-backup capsule staging must be private and outside the source tree', async () => fixture(async root => {
  const external = await mkdtemp(path.join(os.tmpdir(), 'tapuai-external-'));
  try {
    const result = await recovery.createCapsule(root, { outputDirectory: external });
    assert.equal(path.dirname(result.capsulePath), await realpath(external));
    assert.equal((await recovery.verifyCapsule(result.capsulePath)).manifest.filesCount, 4);
    await assert.rejects(recovery.createCapsule(root, { outputDirectory: root }), /outside/);
    await import('node:fs/promises').then(fs => fs.chmod(external, 0o755));
    await assert.rejects(recovery.createCapsule(root, { outputDirectory: external }), /private/);
  } finally { await rm(external, { recursive: true, force: true }); }
}));

test('dependency-layout npm settings travel with source but registry-auth settings fail closed', async () => fixture(async root => {
  await writeFile(path.join(root, '.npmrc'), 'shamefully-hoist=true\nstrict-peer-dependencies=false\n');
  const capsule = await recovery.verifyCapsule((await recovery.createCapsule(root)).capsulePath);
  assert.ok(capsule.files.some(file => file.path === '.npmrc'));
  await writeFile(path.join(root, '.npmrc'), 'registry=https://unreviewed.example\n');
  await assert.rejects(recovery.createCapsule(root), /Unreviewed npm configuration/);
}));

test('macOS verification holds an idle-sleep assertion only until its bounded child check exits', {skip:process.platform!=='darwin'}, async () => fixture(async root => {
  const external=await mkdtemp(path.join(os.tmpdir(),'tapuai-power-check-'));
  const evidence=path.join(external,'evidence.json');
  const prior=process.env.RECOVERY_POWER_TEST_EVIDENCE;
  try {
    process.env.RECOVERY_POWER_TEST_EVIDENCE=evidence;
    await writeFile(path.join(root,'package.json'),JSON.stringify({name:'fixture',scripts:{check:'node apps/mobile/src/power-check.cjs'}}));
    await writeFile(path.join(root,'apps/mobile/src/power-check.cjs'), `/** Synthetic power assertion evidence, outside source. */
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
let pid=process.pid,ancestors=[],assertionPid=null;
for(let i=0;i<10&&pid>1;i++){
 ancestors.push(pid);
 const line=execFileSync('/bin/ps',['-p',String(pid),'-o','ppid='],{encoding:'utf8'}).trim();
 pid=Number(line);
}
const deadline=Date.now()+5000;
while(Date.now()<deadline&&assertionPid===null){
 const assertions=execFileSync('/usr/bin/pmset',['-g','assertions'],{encoding:'utf8'});
 const matches=[...assertions.matchAll(/pid (\\d+)\\(caffeinate\\):[^\\n]*PreventUserIdleSystemSleep/g)];
 let best=Infinity;
 for(const match of matches){
  try{
   const candidate=Number(match[1]);
   const parent=Number(execFileSync('/bin/ps',['-p',String(candidate),'-o','ppid='],{encoding:'utf8'}).trim());
   const index=ancestors.indexOf(parent);
   if(index>=0&&index<best){assertionPid=candidate;best=index;}
  }catch{}
 }
 if(assertionPid===null)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);
}
const present=assertionPid!==null;
fs.writeFileSync(process.env.RECOVERY_POWER_TEST_EVIDENCE,JSON.stringify({assertionPid,assertionPresent:present}));
`);
    const result=await recovery.createCapsule(root,{verifyCode:true});
    assert.equal(result.metadata.verification,'passed');
    const observed=JSON.parse(await readFile(evidence,'utf8'));
    assert.equal(observed.assertionPresent,true,'the actual check utility must own a temporary caffeinate assertion');
    let ended=false; const deadline=Date.now()+5000;
    while(Date.now()<deadline) {
      const assertions=execFileSync('/usr/bin/pmset',['-g','assertions'],{encoding:'utf8'});
      if(!assertions.includes('pid '+observed.assertionPid+'(caffeinate)')) {ended=true;break;}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(ended,true,'the scoped assertion must end with verification');
  } finally {
    if(prior===undefined) delete process.env.RECOVERY_POWER_TEST_EVIDENCE; else process.env.RECOVERY_POWER_TEST_EVIDENCE=prior;
    await rm(external,{recursive:true,force:true});
  }
}));
