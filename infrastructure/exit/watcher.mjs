/** Manage a scoped source watcher process when login-startup services are unavailable; persistence stays explicit. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncSource, managedState, lockManagedState } from './sync.mjs';

const OWNER='tapuai-exit-watcher/1';
const script=fileURLToPath(new URL('./sync.mjs',import.meta.url));
const moduleRoot=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
async function context(root,options) {
  const owned=await managedState(root,options);
  const status={repositoryRoot:owned.root,targetId:owned.targetId};
  const state=owned.stateDir;
  return {status,state,owned,record:path.join(state,'watcher.json')};
}
async function readRecord(filename) {
  try {
    const info=await fs.lstat(filename);
    if(!info.isFile()||info.isSymbolicLink()||info.mode&0o077||info.uid!==process.getuid()) throw new Error('Watcher record must be a private owned regular file');
    const record=JSON.parse(await fs.readFile(filename,'utf8'));
    if(record.owner!==OWNER||record.schemaVersion!==1||!Number.isSafeInteger(record.pid)||record.pid<1
        || !Array.isArray(record.args)||record.args.some(arg=>typeof arg!=='string')||typeof record.node!=='string') throw new Error('Invalid watcher process record');
    return record;
  } catch(error) { if(error.code==='ENOENT') return null; throw error; }
}
function processState(record) {
  if(!record) return 'not-started';
  try { process.kill(record.pid,0); } catch(error) { if(error.code==='ESRCH') return 'stopped'; throw error; }
  const command=execFileSync('ps',['-ww','-p',String(record.pid),'-o','command='],{encoding:'utf8'}).trim();
  return command === [record.node,...record.args].join(' ') ? 'running' : 'foreign-process';
}
function validateCommand(record,ctx) {
  if(!record) return;
  const interval=record.intervalMs,keep=record.keep??3;
  const tail=['--state-dir',ctx.state,'--target-id',ctx.status.targetId,'--keep',String(keep),'--interval-ms',String(interval)];
  const expected=[script,'watch','--repository-root',ctx.status.repositoryRoot,...tail];
  const legacy=[script,'watch',...tail];
  if(record.repositoryRoot!==ctx.status.repositoryRoot||record.targetId!==ctx.status.targetId||record.node!==process.execPath
      || !Number.isInteger(interval)||interval<50||interval>3_600_000||!Number.isInteger(keep)||keep<1||keep>100
      || !(JSON.stringify(record.args)===JSON.stringify(expected)||ctx.status.repositoryRoot===moduleRoot&&JSON.stringify(record.args)===JSON.stringify(legacy))) throw new Error('Watcher command does not match the exact owned source configuration');
}
/** Start one current-login process; no system login registration, privileged service or cloud action is attempted. */
export async function startWatcher(root,options={}) {
  await syncSource(root,options);
  const ctx=await context(root,options), releaseLock=await lockManagedState(ctx.owned);
  try {
  const prior=await readRecord(ctx.record);
  validateCommand(prior,ctx);
  const state=processState(prior);
  if(state==='foreign-process') throw new Error('Recorded PID now belongs to another process; review stale record before starting');
  if(state==='running') return {...prior,active:true,loginAutoStart:false};
  const intervalMs=options.intervalMs??30_000;
  if(!Number.isInteger(intervalMs)||intervalMs<50||intervalMs>3_600_000) throw new Error('Invalid sweep interval');
  const args=[script,'watch','--repository-root',ctx.status.repositoryRoot,'--state-dir',ctx.state,'--target-id',ctx.status.targetId,'--keep',String(options.keep??3),'--interval-ms',String(intervalMs)];
  const child=spawn(process.execPath,args,{cwd:ctx.status.repositoryRoot,detached:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  child.unref();
  const record={schemaVersion:1,owner:OWNER,pid:child.pid,node:process.execPath,args,repositoryRoot:ctx.status.repositoryRoot,targetId:ctx.status.targetId,
    startedAt:new Date().toISOString(),runtime:'detached-process',keep:options.keep??3,intervalMs,loginAutoStart:false};
  // The record was validated above; a link that appeared meanwhile must never be followed.
  const temp=ctx.record+'.'+child.pid+'.tmp';
  try {
    await readRecord(ctx.record);
    await fs.writeFile(temp,JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'}); await fs.rename(temp,ctx.record);
    return {...record,active:processState(record)==='running'};
  }
  catch(error) { child.kill('SIGTERM'); throw error; }
  finally { await fs.rm(temp,{force:true}); }
  } finally { await releaseLock(); }
}
/** Stop only the exact recorded command. Snapshots, independent exports and other processes remain intact. */
export async function stopWatcher(root,options={}) {
  const ctx=await context(root,options),record=await readRecord(ctx.record);
  if(!record) throw new Error('No matching owned watcher record');
  validateCommand(record,ctx);
  const state=processState(record);
  if(state==='foreign-process') throw new Error('Refusing to signal another process');
  if(state==='running') process.kill(record.pid,'SIGTERM');
  return {pid:record.pid,stopRequested:state==='running',snapshotsDeleted:false,loginAutoStart:false};
}
/** Observe only the exact owned process; manual reads cannot advance a sweep receipt or restart a service. */
export async function watcherStatus(root,options={}) {
  try {
    const ctx=await context(root,options),record=await readRecord(ctx.record);
    validateCommand(record,ctx);
    const state=processState(record);
    return {active:state==='running',state,pid:record?.pid??null,intervalMs:record?.intervalMs??null,
      loginAutoStart:false,runtime:record?'detached-process':'not-started'};
  } catch {
    return {active:false,state:'invalid-or-unobservable',loginAutoStart:false};
  }
}
