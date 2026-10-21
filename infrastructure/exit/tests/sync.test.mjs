/** Automatic copies must follow actual content, survive failures and preserve private evidence and working source. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncSource, syncStatus, ensureSource, launchAgentPlist } from '../sync.mjs';
import { startWatcher, stopWatcher, watcherStatus } from '../watcher.mjs';

async function fixture(fn) {
  const base = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tapuai-sync-test-')));
  const root = path.join(base, 'source'), stateDir = path.join(base, 'state');
  await fs.mkdir(root);
  const put = async (file, content) => { await fs.mkdir(path.dirname(path.join(root,file)), { recursive:true }); await fs.writeFile(path.join(root,file),content); };
  // A real check command exercises verification; fixtures never require pnpm dependencies.
  await put('package.json',JSON.stringify({name:'fixture',scripts:{check:'node -e "process.exit(0)"'}}));
  await put('pnpm-lock.yaml','lockfileVersion: 9\n');
  await put('docs/engineering/exit-map.json','{"components":[]}');
  await put('apps/mobile/src/backend/db/schema.sql','create table public.items (id int default 1);');
  await put('apps/mobile/src/frontend/lib/fixture.ts','export const amount=1;');
  await put('docs/STATE.md','# Source state\n');
  const options = { stateDir, targetId:'fixture-source', keep:3 };
  try { await fn({root,stateDir,put,options,base}); } finally { await fs.rm(base,{recursive:true,force:true}); }
}
const json = async file => JSON.parse(await fs.readFile(file,'utf8'));
const latest = stateDir => json(path.join(stateDir,'latest.json'));

test('snapshots exact working content with honest unverified status and reuse preserves original capture time', () => fixture(async ({root,stateDir,options}) => {
  const first=await syncSource(root,options);
  assert.equal(first.changed,true); assert.equal(first.codeVerification,'not-run'); assert.equal(first.readyToCutOver,false);
  const again=await syncSource(root,options);
  assert.equal(again.changed,false); assert.equal(again.capturedAt,first.capturedAt); assert.equal(again.releasePath,first.releasePath);
  assert.equal((await syncStatus(root,options)).sourceCurrent,true);
  assert.equal((await syncStatus(root,options)).codeVerified,false);
  assert.equal((await fs.stat(stateDir)).mode & 0o077,0);
}));

test('schema/default/migration/function/API/config/lock/assets additions edits and deletions advance copies', () => fixture(async ({root,options,put,stateDir}) => {
  let previous=await syncSource(root,options);
  for(const [file,content] of [
    ['apps/mobile/src/backend/db/schema.sql','create table public.items (id int default 2);'],
    ['supabase/migrations/20261019120000_copy.sql','select 2;'],
    ['supabase/functions/copy/index.ts','export const answer=2;'],
    ['apps/mobile/app/api/copy+api.ts','export const answer=2;'],
    ['docs/engineering/exit-map.json','{"components":[{"id":"owned"}]}'],
    ['pnpm-lock.yaml','lockfileVersion: 9\nsettings: changed\n'],
    ['apps/mobile/assets/copy.svg','<svg></svg>'],
  ]) {
    await put(file,content); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
    const next=await syncSource(root,options); assert.notEqual(next.sourceTreeHash,previous.sourceTreeHash); previous=next;
  }
  await fs.unlink(path.join(root,'apps/mobile/assets/copy.svg'));
  const next=await syncSource(root,options); assert.notEqual(next.sourceTreeHash,previous.sourceTreeHash);
  assert.equal((await fs.readdir(path.join(stateDir,'releases'))).length,3);
}));

test('same-size edits with restored mtime are captured and doc changes use full source identity', () => fixture(async ({root,options,put}) => {
  const first=await syncSource(root,options);
  const file=path.join(root,'apps/mobile/src/frontend/lib/fixture.ts'),info=await fs.stat(file);
  await put('apps/mobile/src/frontend/lib/fixture.ts','export const amount=2;'); await fs.utimes(file,info.atime,info.mtime);
  const second=await syncSource(root,options); assert.notEqual(second.sourceTreeHash,first.sourceTreeHash);
  await put('docs/STATE.md','# Updated source state\n');
  const third=await syncSource(root,options); assert.notEqual(third.sourceTreeHash,second.sourceTreeHash); assert.equal(third.releaseVersion,second.releaseVersion);
}));

test('private runtime data and output are excluded; ambiguous source formats fail without advancing latest', () => fixture(async ({root,stateDir,options,put}) => {
  const first=await syncSource(root,options);
  for(const file of ['apps/mobile/.env.local','apps/mobile/customer-data/user.json','infrastructure/backup/credentials.env','apps/mobile/node_modules/secret.json']) await put(file,'synthetic-private');
  assert.equal((await syncSource(root,options)).changed,false);
  await put('apps/mobile/not-reviewed.json','{"synthetic":true}');
  await assert.rejects(syncSource(root,options),/Unreviewed/);
  assert.deepEqual(await latest(stateDir),Object.fromEntries(Object.entries(first).filter(([key])=>!['outcome','checkedAt','changed','sourceCurrent','readyToCutOver','mapValidation'].includes(key))));
  const status=await syncStatus(root,options); assert.equal(status.sourceCurrent,false); assert.equal(status.outcome,'failed');
  await fs.unlink(path.join(root,'apps/mobile/not-reviewed.json'));
  assert.equal((await syncStatus(root,options)).sourceCurrent,false,'last failure remains explicit after a content revert');
  await syncSource(root,options); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
}));

test('source links and external state aliases fail closed and retain the prior copy', () => fixture(async ({root,stateDir,options,base}) => {
  await syncSource(root,options); const prior=await latest(stateDir);
  await fs.symlink(path.join(root,'docs/STATE.md'),path.join(root,'apps/mobile/link.md'));
  await assert.rejects(syncSource(root,options),/symlink/); assert.deepEqual(await latest(stateDir),prior);
  await fs.unlink(path.join(root,'apps/mobile/link.md'));
  await fs.symlink(stateDir,path.join(base,'alias'));
  await assert.rejects(syncSource(root,{...options,stateDir:path.join(base,'alias')}),/symlink/);
  await assert.rejects(syncSource(root,{...options,stateDir:path.join(root,'private')}),/outside/);
}));

test('changed target, public state, corrupt/missing/replaced releases and pointer links never report current', () => fixture(async ({root,stateDir,options,base}) => {
  await syncSource(root,options);
  await assert.rejects(syncSource(root,{...options,targetId:'another-target'}),/different/);
  assert.equal((await syncStatus(root,{...options,targetId:'another-target'})).sourceCurrent,false);
  const pointer=await latest(stateDir),manifest=path.join(stateDir,pointer.releasePath,'manifest.json');
  const original=await fs.readFile(manifest);
  await fs.writeFile(manifest,'{}'); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
  await fs.writeFile(manifest,original); await fs.chmod(manifest,0o644); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
  await fs.chmod(manifest,0o600); await fs.chmod(stateDir,0o755); assert.equal((await syncStatus(root,options)).sourceCurrent,false); await fs.chmod(stateDir,0o700);
  await fs.rename(path.join(stateDir,'latest.json'),path.join(base,'pointer.json')); await fs.symlink(path.join(base,'pointer.json'),path.join(stateDir,'latest.json'));
  assert.equal((await syncStatus(root,options)).sourceCurrent,false); await assert.rejects(syncSource(root,options),/symlink/);
}));

test('retention only prunes indexed intact generated cache, keeping arbitrary backups and exports', () => fixture(async ({root,stateDir,options,put}) => {
  await syncSource(root,{...options,keep:1});
  const first=await latest(stateDir);
  await fs.mkdir(path.join(stateDir,'backups'),{mode:0o700}); await fs.writeFile(path.join(stateDir,'backups','preserve.md'),'historical backup',{mode:0o600});
  await fs.mkdir(path.join(stateDir,'releases','owner-export'),{mode:0o700});
  await put('docs/STATE.md','# Second\n'); await syncSource(root,{...options,keep:1});
  await assert.rejects(fs.stat(path.join(stateDir,first.releasePath)),{code:'ENOENT'});
  assert.equal(await fs.readFile(path.join(stateDir,'backups/preserve.md'),'utf8'),'historical backup');
  assert.equal((await fs.stat(path.join(stateDir,'releases/owner-export'))).isDirectory(),true);
}));

test('OS lock refuses simultaneous writers and parent-pipe closure releases it without stale-PID repair', () => fixture(async ({root,stateDir,options}) => {
  await syncSource(root,options);
  const helper=fileURLToPath(new URL('../sync_lock.py',import.meta.url));
  const child=spawn('python3',['-u',helper,path.join(stateDir,'.sync.lock')],{stdio:['pipe','pipe','pipe']});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try {
    await new Promise(resolve=>child.stdout.once('data',resolve));
    await assert.rejects(syncSource(root,options),/Another exit sync/);
  } finally { child.stdin.end(); await exited; }
  await syncSource(root,options); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
}));

test('interrupted pruning resumes journaled deletion without losing latest or adopting arbitrary files', () => fixture(async ({root,stateDir,options,put}) => {
  await syncSource(root,options); const first=await latest(stateDir);
  await put('docs/STATE.md','# Second\n'); await syncSource(root,options); const second=await latest(stateDir);
  // Reproduce a crash after the catalog transaction and the first deletion, before journal completion.
  await fs.writeFile(path.join(stateDir,'catalog.json'),JSON.stringify({schemaVersion:1,owner:'tapuai-exit-sync/1',releases:[second],pendingDeletes:[first]}),{mode:0o600});
  await fs.rm(path.join(stateDir,first.releasePath),{recursive:true});
  await syncSource(root,options);
  assert.deepEqual((await json(path.join(stateDir,'catalog.json'))).pendingDeletes,[]);
  assert.equal((await latest(stateDir)).releasePath,second.releasePath); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
}));

test('source mutations during full verification fail without promoting a mixed snapshot', () => fixture(async ({root,stateDir,options,put}) => {
  await put('package.json',JSON.stringify({name:'fixture',scripts:{check:`node -e "require('node:fs').writeFileSync('docs/STATE.md','changed during verification')"`}}));
  await syncSource(root,options); const prior=await latest(stateDir);
  await assert.rejects(syncSource(root,{...options,verifyCode:true}),/Source changed/);
  assert.deepEqual(await latest(stateDir),prior); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
  await syncSource(root,options); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
}));

test('copies the working tree without modifying staged content, baseline, notices or readiness', () => fixture(async ({root,stateDir,options,put}) => {
  execFileSync('git',['init','-q'],{cwd:root});
  await put('docs/engineering/exit-map.baseline.json','{"original":true}');
  await put('docs/agents/EXIT_CHANGE_LOG.md','# Original notice\n'); await put('docs/engineering/exit-readiness.json','{"original":true}');
  execFileSync('git',['add','.'],{cwd:root});
  const staged=execFileSync('git',['show',':apps/mobile/src/frontend/lib/fixture.ts'],{cwd:root,encoding:'utf8'});
  await put('apps/mobile/src/frontend/lib/fixture.ts','export const amount=9;');
  await syncSource(root,options); const pointer=await latest(stateDir);
  assert.equal(await fs.readFile(path.join(stateDir,pointer.releasePath,'application/apps/mobile/src/frontend/lib/fixture.ts'),'utf8'),'export const amount=9;');
  assert.equal(execFileSync('git',['show',':apps/mobile/src/frontend/lib/fixture.ts'],{cwd:root,encoding:'utf8'}),staged);
  assert.equal(await fs.readFile(path.join(root,'docs/agents/EXIT_CHANGE_LOG.md'),'utf8'),'# Original notice\n');
  assert.deepEqual(await json(path.join(root,'docs/engineering/exit-map.baseline.json')),{original:true});
  assert.deepEqual(await json(path.join(root,'docs/engineering/exit-readiness.json')),{original:true});
}));

test('an explicit full check upgrades raw source; failed checks retain raw copy and truthful failed status', () => fixture(async ({root,stateDir,options,put}) => {
  const raw=await syncSource(root,options);
  const verified=await syncSource(root,{...options,verifyCode:true}); assert.equal(verified.codeVerification,'passed'); assert.notEqual(verified.releasePath,raw.releasePath);
  assert.equal((await syncStatus(root,options)).codeVerified,true);
  await put('package.json',JSON.stringify({name:'fixture',scripts:{check:'node -e "process.exit(1)"'}}));
  const changed=await syncSource(root,options);
  await assert.rejects(syncSource(root,{...options,verifyCode:true}));
  assert.equal((await latest(stateDir)).releasePath,changed.releasePath); assert.equal((await latest(stateDir)).codeVerification,'not-run');
  assert.equal((await syncStatus(root,options)).sourceCurrent,false);
}));

test('real watcher initial scan, content sweeps and restart catch up without timestamp dependence', () => fixture(async ({root,stateDir,options,put,base}) => {
  const module=fileURLToPath(new URL('../sync.mjs',import.meta.url));
  const runner=path.join(base,'watch.mjs');
  await fs.writeFile(runner,`import {watchSource} from ${JSON.stringify('file://'+module)}; await watchSource(${JSON.stringify(root)},${JSON.stringify({...options,intervalMs:100})});`);
  const start=()=>spawn(process.execPath,[runner],{stdio:'ignore'});
  async function waitFor(check) {
    const deadline=Date.now()+12000;
    while(Date.now()<deadline) { try { if(await check()) return; } catch {} await new Promise(resolve=>setTimeout(resolve,100)); }
    throw new Error('Watcher failed to capture before deadline');
  }
  async function stop(child) { child.kill('SIGTERM'); await new Promise(resolve=>child.once('exit',resolve)); }
  let child=start();
  try {
    await waitFor(async()=>Boolean(await latest(stateDir))); const first=await latest(stateDir);
    await put('apps/mobile/src/frontend/lib/fixture.ts','export const amount=7;');
    await waitFor(async()=>(await latest(stateDir)).sourceTreeHash!==first.sourceTreeHash);
    await stop(child); child=null; const stopped=await latest(stateDir);
    await put('docs/STATE.md','# Changed while stopped\n');
    child=start(); await waitFor(async()=>(await latest(stateDir)).sourceTreeHash!==stopped.sourceTreeHash);
  } finally { if(child) await stop(child); }
}));

test('LaunchAgent uses exact arguments, escaped paths and bounded durable status instead of unbounded logs', () => {
  const plist=launchAgentPlist({root:'/tmp/a & b',stateDir:'/tmp/private',targetId:'local-source'});
  assert.ok(plist.includes('com.tapuai.exit-source')); assert.ok(plist.includes('/tmp/a &amp; b/infrastructure/exit/sync.mjs'));
  assert.ok(plist.includes('<string>30000</string>')); assert.ok(plist.includes('<key>RunAtLoad</key><true/>'));
  assert.ok(!plist.includes('--verify-code')); assert.ok(plist.includes('/dev/null'));
});

test('changed retention policy is applied on reuse and malformed status never reports current', () => fixture(async ({root,stateDir,options,put}) => {
  await syncSource(root,options);
  await put('docs/STATE.md','# Second\n'); await syncSource(root,options);
  await put('docs/STATE.md','# Third\n'); await syncSource(root,options);
  const reused=await syncSource(root,{...options,keep:1});
  assert.equal(reused.changed,false); assert.equal((await fs.readdir(path.join(stateDir,'releases'))).length,1);
  const filename=path.join(stateDir,'status.json'), original=await json(filename);
  for(const changed of [{...original,schemaVersion:undefined},{...original,checkedAt:undefined},{...original,checkedAt:'2999-01-01T00:00:00.000Z'},{...original,sourceTreeHash:'0'.repeat(64)}]) {
    await fs.writeFile(filename,JSON.stringify(changed)); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
  }
}));

test('a generated map with semantic problems is retained as raw source while write/privacy errors fail', () => fixture(async ({root,stateDir,options,put}) => {
  await put('scripts/exit-map.mjs', `/** Synthetic completed-map validation failure. */\nimport fs from 'node:fs'; fs.writeFileSync('docs/engineering/EXIT_INFRASTRUCTURE_MAP.md','# Current draft with errors\\n'); console.error('exit:map wrote docs/engineering/EXIT_INFRASTRUCTURE_MAP.md with problems: missing capability'); process.exit(1);`);
  const raw=await syncSource(root,options); assert.equal(raw.mapValidation.outcome,'failed'); assert.equal(raw.codeVerification,'not-run');
  const pointer=await latest(stateDir);
  assert.match(await fs.readFile(path.join(stateDir,pointer.releasePath,'application/docs/engineering/EXIT_INFRASTRUCTURE_MAP.md'),'utf8'),/Current draft/);
  await put('scripts/exit-map.mjs', `/** Synthetic source/privacy failure. */\nconsole.error('Source symlink is forbidden'); process.exit(1);`);
  await assert.rejects(syncSource(root,options)); assert.deepEqual(await latest(stateDir),pointer); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
}));

test('interrupted promotion before latest publication cleans candidate and keeps current under keep1', () => fixture(async ({root,stateDir,options,put}) => {
  await syncSource(root,options); const first=await latest(stateDir);
  await put('docs/STATE.md','# Candidate\n'); await syncSource(root,options); const candidate=await latest(stateDir);
  // Replay crash before latest rename, including a caught failure that already removed its candidate.
  await fs.writeFile(path.join(stateDir,'latest.json'),JSON.stringify(first));
  await fs.writeFile(path.join(stateDir,'catalog.json'),JSON.stringify({schemaVersion:1,owner:'tapuai-exit-sync/1',releases:[first],pendingDeletes:[],pendingPromotion:candidate}));
  await fs.rm(path.join(stateDir,candidate.releasePath),{recursive:true});
  await put('docs/STATE.md','# Source state\n');
  await syncSource(root,{...options,keep:1});
  assert.equal((await latest(stateDir)).releasePath,first.releasePath); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
  assert.equal((await fs.stat(path.join(stateDir,first.releasePath))).isDirectory(),true);
}));

test('interrupted promotion after latest publication completes catalog before retaining current', () => fixture(async ({root,stateDir,options,put}) => {
  await syncSource(root,options); const first=await latest(stateDir);
  await put('docs/STATE.md','# Candidate\n'); await syncSource(root,options); const candidate=await latest(stateDir);
  // Replay crash after latest rename but before finalizing the catalog.
  await fs.writeFile(path.join(stateDir,'catalog.json'),JSON.stringify({schemaVersion:1,owner:'tapuai-exit-sync/1',releases:[first],pendingDeletes:[],pendingPromotion:candidate}));
  await syncSource(root,{...options,keep:1});
  assert.equal((await latest(stateDir)).releasePath,candidate.releasePath); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
  const records=await json(path.join(stateDir,'catalog.json')); assert.equal(records.pendingPromotion,null); assert.equal(records.releases.length,1);
}));

test('failed latest rename leaves resumable candidate journal and source revert keeps current under keep1', () => fixture(async ({root,stateDir,options,put}) => {
  await syncSource(root,options); const first=await latest(stateDir);
  await put('docs/STATE.md','# Candidate\n');
  const rename=fs.rename; let injected=false;
  fs.rename=async (from,to) => { if(path.basename(to)==='latest.json'&&!injected) { injected=true; throw new Error('Injected latest publication failure'); } return rename(from,to); };
  try { await assert.rejects(syncSource(root,options),/Injected latest publication failure/); } finally { fs.rename=rename; }
  assert.deepEqual(await latest(stateDir),first); assert.equal((await syncStatus(root,options)).sourceCurrent,false);
  const records=await json(path.join(stateDir,'catalog.json')); assert.ok(records.pendingPromotion);
  await put('docs/STATE.md','# Source state\n'); await syncSource(root,{...options,keep:1});
  assert.equal((await latest(stateDir)).releasePath,first.releasePath); assert.equal((await syncStatus(root,options)).sourceCurrent,true);
}));

test('managed process watcher captures changes and stops even when current source is stale', () => fixture(async ({root,stateDir,options,put}) => {
  const started=await startWatcher(root,{...options,intervalMs:200});
  try {
    assert.equal(started.active,true); assert.equal(started.loginAutoStart,false);
    const originalWrite=fs.writeFile;
    let observed;
    try {
      fs.writeFile=async()=>{throw new Error('Read-only process observation attempted a write');};
      observed=await watcherStatus(root,options);
    } finally {fs.writeFile=originalWrite;}
    assert.equal(observed.active,true); assert.equal(observed.pid,started.pid);
    await put('docs/STATE.md','# Process update\n');
    const deadline=Date.now()+12000;
    while(Date.now()<deadline) {
      if((await syncStatus(root,options)).sourceCurrent) break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal((await syncStatus(root,options)).sourceCurrent,true);
    await put('apps/mobile/not-reviewed.json','{}');
    const stopped=await stopWatcher(root,options); assert.equal(stopped.stopRequested,true); assert.equal(stopped.snapshotsDeleted,false);
  } finally { try { await stopWatcher(root,options); } catch {} }
}));

test('process controls never signal a foreign PID or follow a linked watcher record', () => fixture(async ({root,stateDir,options,base}) => {
  await syncSource(root,options);
  const record={schemaVersion:1,owner:'tapuai-exit-watcher/1',pid:process.pid,node:process.execPath,args:[fileURLToPath(new URL('../sync.mjs',import.meta.url)),'watch'],repositoryRoot:root,targetId:options.targetId};
  const filename=path.join(stateDir,'watcher.json');
  await fs.writeFile(filename,JSON.stringify(record),{mode:0o600});
  await assert.rejects(stopWatcher(root,options),/exact owned source configuration/);
  assert.equal((await watcherStatus(root,options)).active,false);
  await fs.rename(filename,path.join(base,'watcher-record.json')); await fs.symlink(path.join(base,'watcher-record.json'),filename);
  await assert.rejects(stopWatcher(root,options),/private owned regular/);
  assert.equal((await watcherStatus(root,options)).active,false);
}));

test('watcher observations do not create missing state or a process', () => fixture(async ({root,stateDir,options}) => {
  assert.equal((await watcherStatus(root,options)).active,false);
  await assert.rejects(fs.stat(stateDir),{code:'ENOENT'});
  await syncSource(root,options);
  assert.deepEqual(await watcherStatus(root,options),{active:false,state:'not-started',pid:null,intervalMs:null,loginAutoStart:false,runtime:'not-started'});
  await assert.rejects(fs.stat(path.join(stateDir,'watcher.json')),{code:'ENOENT'});
}));

test('quality-check ensure defers a concurrent capture without claiming current or code verification', () => fixture(async ({root,stateDir,options}) => {
  await syncSource(root,options);
  const helper=fileURLToPath(new URL('../sync_lock.py',import.meta.url));
  const child=spawn('python3',['-u',helper,path.join(stateDir,'.sync.lock')],{stdio:['pipe','pipe','pipe']});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try {
    await new Promise(resolve=>child.stdout.once('data',resolve));
    const result=await ensureSource(root,options); assert.equal(result.outcome,'deferred'); assert.equal(result.sourceCurrent,null); assert.equal(result.readyToCutOver,false);
  } finally {child.stdin.end();await exited;}
}));
