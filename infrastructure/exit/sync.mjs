/** Keep private current-source exit copies fresh; source integrity never grants data or hosted readiness. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectSource, sourceTreeHash } from '../../scripts/recovery-capsule.mjs';
import { createRelease, verifyRelease } from './release.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OWNER = 'tapuai-exit-sync/1';
const ID = /^[a-z][a-z0-9-]{1,63}$/;
const RELEASE_PATH = /^releases\/[a-f0-9-]{36}$/;
const HASH = /^[a-f0-9]{64}$/;
const DEFAULT_STATE = path.join(os.homedir(), 'Library/Application Support/Tapuai/exit-source');
const LABEL = 'com.tapuai.exit-source';
const now = () => new Date().toISOString();

async function noLinks(filename) {
  let current = path.parse(path.resolve(filename)).root;
  for (const part of path.resolve(filename).slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Exit sync path contains a symlink'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
async function privateEntry(filename, directory = false) {
  await noLinks(filename);
  const info = await fs.lstat(filename);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile()) || info.mode & 0o077
      || process.getuid && info.uid !== process.getuid()) throw new Error('Exit sync state must be private and owned by this user');
}
async function readJson(filename) {
  await privateEntry(filename);
  return JSON.parse(await fs.readFile(filename, 'utf8'));
}
async function atomicJson(filename, value) {
  await noLinks(filename);
  try { await privateEntry(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = path.join(path.dirname(filename), '.write-' + randomUUID());
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    // The old pointer survives a crash until the complete new record replaces it.
    await fs.rename(temporary, filename);
  } finally { await fs.rm(temporary, { force: true }); }
}
async function context(root, { stateDir, targetId = 'local-source', keep = 3 } = {}, create = false) {
  if (!ID.test(targetId) || !Number.isInteger(keep) || keep < 1 || keep > 100) throw new Error('Invalid target ID or retention count (1–100)');
  root = await fs.realpath(root);
  stateDir = path.resolve(stateDir ?? DEFAULT_STATE);
  await noLinks(stateDir);
  if (stateDir === root || stateDir.startsWith(root + path.sep) || root.startsWith(stateDir + path.sep)) throw new Error('State must be outside and must not contain the repository');
  if (create) await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  await privateEntry(stateDir, true);
  return { root, stateDir, targetId, keep };
}
async function assertOwnership(ctx, create = false) {
  const filename = path.join(ctx.stateDir, 'owner.json');
  let record;
  try { record = await readJson(filename); }
  catch (error) {
    if (!create || error.code !== 'ENOENT') throw error;
    if ((await fs.readdir(ctx.stateDir)).some(name => name !== '.sync.lock')) throw new Error('Refusing to adopt an existing unowned state directory');
    record = { schemaVersion: 1, owner: OWNER, repositoryRoot: ctx.root, targetId: ctx.targetId };
    await atomicJson(filename, record);
  }
  if (record.schemaVersion !== 1 || record.owner !== OWNER || record.repositoryRoot !== ctx.root || record.targetId !== ctx.targetId) throw new Error('Exit sync state belongs to a different repository or target');
}
/** Process controls share the same owned-state validation and lock, independently of source freshness. */
export async function managedState(root = ROOT, options = {}) {
  const ctx = await context(root, options); await assertOwnership(ctx); return ctx;
}
export async function lockManagedState(ctx) { return acquire(ctx); }
async function acquire(ctx) {
  const lock = path.join(ctx.stateDir, '.sync.lock');
  await noLinks(lock);
  try { await privateEntry(lock); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Kernel locking avoids stale-PID reclamation races. Parent death closes stdin and releases the lock.
  const helper = fileURLToPath(new URL('./sync_lock.py', import.meta.url));
  const child = spawn('python3', ['-u', helper, lock], { stdio:['pipe','pipe','pipe'] });
  let stderr = '';
  child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-4096); });
  const completion = new Promise((resolve, reject) => { child.once('exit', code => resolve(code)); child.once('error', reject); });
  // Observe spawn errors immediately even before a caller gets the completion promise.
  completion.catch(() => {});
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', () => reject(new Error(stderr.trim() || 'Exit sync lock helper exited')));
    child.stdout.once('data', data => data.toString().trim() === 'locked' ? resolve() : reject(new Error('Invalid lock handshake')));
  });
  return async () => { child.stdin.end(); if (await completion !== 0) throw new Error('Exit sync lock helper failed'); };
}

/** Refresh source awareness only: author notices and Security/domain approvals remain actual separate reviews. */
export async function refreshMap(root = ROOT) {
  const script = path.join(root, 'scripts/exit-map.mjs');
  await noLinks(script);
  try { await fs.stat(script); } catch (error) { if (error.code === 'ENOENT') return { outcome:'not-present' }; throw error; }
  let validation = { outcome:'passed' };
  try {
    execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
  } catch (error) {
    // The real map writer has completed a current draft before reporting semantic mapping problems.
    // Retain that draft as unverified source; privacy failures, crashes and write errors still stop capture.
    const report = String(error.stderr ?? '');
    if (error.status === 1 && report.startsWith('exit:map wrote docs/engineering/exit/EXIT_INFRASTRUCTURE_MAP.md with problems:')) validation = { outcome:'failed', problems:report.trim() };
    else throw error;
  }
  const security = path.join(root, 'infrastructure/security/report.mjs');
  await noLinks(security);
  try { await fs.stat(security); } catch (error) { if (error.code === 'ENOENT') return validation; throw error; }
  try {
    // The report links exact safe source/config and named reviewers; it never executes or accepts those reviews.
    execFileSync(process.execPath, [security, '--write'], { cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:120_000 });
  } catch (error) {
    const report = String(error.stderr ?? '');
    if (error.status === 1 && report.startsWith('security:infra wrote docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md with problems:')) return { outcome:'failed', problems:[validation.problems,report.trim()].filter(Boolean).join('\n') };
    throw error;
  }
  return validation;
}
function validPointer(pointer, ctx) {
  if (pointer.schemaVersion !== 1 || pointer.owner !== OWNER || pointer.repositoryRoot !== ctx.root || pointer.targetId !== ctx.targetId
      || !RELEASE_PATH.test(pointer.releasePath ?? '') || !HASH.test(pointer.sourceTreeHash ?? '') || !HASH.test(pointer.manifestSha256 ?? '')
      || !HASH.test(pointer.releaseVersion ?? '') || !['not-run','passed'].includes(pointer.codeVerification)
      || !Number.isFinite(Date.parse(pointer.capturedAt))) throw new Error('Invalid exit source pointer');
}
async function checkPointer(ctx, pointer) {
  validPointer(pointer, ctx);
  const directory = path.join(ctx.stateDir, pointer.releasePath);
  await noLinks(directory);
  const result = await verifyRelease(directory, { root: ctx.root });
  const manifest = await readJson(path.join(directory, 'manifest.json'));
  if (manifest.targetId !== pointer.targetId || manifest.sourceTreeHash !== pointer.sourceTreeHash || manifest.releaseVersion !== pointer.releaseVersion
      || manifest.manifestSha256 !== pointer.manifestSha256 || manifest.createdAt !== pointer.capturedAt || manifest.codeVerification !== pointer.codeVerification) throw new Error('Exit source pointer does not match its release');
  return result;
}
async function catalog(ctx) {
  try {
    const value = await readJson(path.join(ctx.stateDir, 'catalog.json'));
    if (value.schemaVersion !== 1 || value.owner !== OWNER || !Array.isArray(value.releases) || !Array.isArray(value.pendingDeletes ?? [])) throw new Error('Invalid exit source retention catalog');
    const seen = new Set();
    for (const record of [...value.releases, ...(value.pendingDeletes ?? []), ...(value.pendingPromotion ? [value.pendingPromotion] : [])]) { validPointer(record, ctx); if (seen.has(record.releasePath)) throw new Error('Duplicate retained release'); seen.add(record.releasePath); }
    return { ...value, pendingDeletes: value.pendingDeletes ?? [], pendingPromotion:value.pendingPromotion ?? null };
  } catch (error) { if (error.code === 'ENOENT') return { schemaVersion: 1, owner: OWNER, releases: [], pendingDeletes: [], pendingPromotion:null }; throw error; }
}
async function recoverPromotion(ctx, records, latest) {
  const pending = records.pendingPromotion;
  if (!pending) return records;
  if (latest?.releasePath === pending.releasePath) {
    if (JSON.stringify(latest) !== JSON.stringify(pending)) throw new Error('Pending promotion does not match current pointer');
    await checkPointer(ctx, pending);
    records = { ...records, releases:[...records.releases,pending], pendingPromotion:null };
  } else {
    // A complete candidate whose pointer was never published is journaled for safe cleanup.
    records = { ...records, pendingDeletes:[...records.pendingDeletes,pending], pendingPromotion:null };
  }
  await atomicJson(path.join(ctx.stateDir, 'catalog.json'), records);
  return records;
}
async function finishPruning(ctx, records, latest) {
  while (records.pendingDeletes.length) {
    const record = records.pendingDeletes[0];
    if (record.releasePath === latest?.releasePath) throw new Error('Retention attempted to remove the current pointer');
    const destination = path.join(ctx.stateDir, record.releasePath);
    await noLinks(destination);
    let exists = true;
    try { await fs.lstat(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; exists = false; }
    if (exists) {
      // Only cataloged intact copies can be deleted; a link or changed artifact requires operator review.
      await checkPointer(ctx, record);
      await fs.rm(destination, { recursive: true });
    }
    records = { ...records, pendingDeletes: records.pendingDeletes.slice(1) };
    await atomicJson(path.join(ctx.stateDir, 'catalog.json'), records);
  }
  return records;
}
async function prune(ctx, records, latest) {
  const ordered = [...records.filter(record => record.releasePath !== latest.releasePath), latest];
  const retained = ordered.slice(-ctx.keep), pendingDeletes = ordered.slice(0, -ctx.keep);
  // Journal before deleting: a crash leaves resumable owned work, never missing entries among retained copies.
  const updated = { schemaVersion: 1, owner: OWNER, releases: retained, pendingDeletes, pendingPromotion:null };
  await atomicJson(path.join(ctx.stateDir, 'catalog.json'), updated);
  await finishPruning(ctx, updated, latest);
}

/** Capture stable current source atomically. A failed attempt keeps the previous complete copy historical. */
export async function syncSource(root = ROOT, options = {}) {
  const ctx = await context(root, options, true);
  const releaseLock = await acquire(ctx);
  let createdPath = null;
  try {
    await assertOwnership(ctx, true);
    const releases = path.join(ctx.stateDir, 'releases');
    await noLinks(releases); await fs.mkdir(releases, { recursive: true, mode: 0o700 }); await privateEntry(releases, true);
    const mapValidation = await refreshMap(ctx.root);
    const before = sourceTreeHash(await collectSource(ctx.root));
    let prior;
    try { prior = await readJson(path.join(ctx.stateDir, 'latest.json')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let records = await catalog(ctx);
    records = await recoverPromotion(ctx, records, prior);
    records = await finishPruning(ctx, records, prior);
    if (prior) {
      await checkPointer(ctx, prior);
      if (!records.releases.some(record => JSON.stringify(record) === JSON.stringify(prior))) throw new Error('Current pointer missing from owned catalog');
      if (prior.sourceTreeHash === before && (!options.verifyCode || prior.codeVerification === 'passed')) {
        if (sourceTreeHash(await collectSource(ctx.root)) !== before) throw new Error('Source changed during freshness verification');
        await prune(ctx, records.releases, prior);
        const status = { schemaVersion: 1, owner: OWNER, outcome: 'synced', checkedAt: now(), ...prior, mapValidation };
        await atomicJson(path.join(ctx.stateDir, 'status.json'), status);
        return { ...status, changed: false, sourceCurrent: true, readyToCutOver: false };
      }
    }
    const releasePath = 'releases/' + randomUUID();
    const destination = path.join(ctx.stateDir, releasePath);
    await createRelease(ctx.root, { outputDirectory: destination, targetId: ctx.targetId, verifyCode: Boolean(options.verifyCode) });
    createdPath = destination;
    const manifest = await readJson(path.join(destination, 'manifest.json'));
    if (manifest.sourceTreeHash !== before || sourceTreeHash(await collectSource(ctx.root)) !== before) throw new Error('Source changed during snapshot capture; retry after edits settle');
    const pointer = { schemaVersion: 1, owner: OWNER, repositoryRoot: ctx.root, targetId: ctx.targetId, releasePath,
      sourceTreeHash: before, releaseVersion: manifest.releaseVersion, manifestSha256: manifest.manifestSha256,
      codeVerification: manifest.codeVerification, capturedAt: manifest.createdAt };
    await checkPointer(ctx, pointer);
    await atomicJson(path.join(ctx.stateDir, 'catalog.json'), { ...records, pendingPromotion:pointer });
    await atomicJson(path.join(ctx.stateDir, 'latest.json'), pointer);
    createdPath = null;
    await atomicJson(path.join(ctx.stateDir, 'catalog.json'), { ...records, releases:[...records.releases,pointer], pendingPromotion:null });
    await prune(ctx, [...records.releases, pointer], pointer);
    const status = { schemaVersion: 1, owner: OWNER, outcome: 'synced', checkedAt: now(), ...pointer, mapValidation };
    await atomicJson(path.join(ctx.stateDir, 'status.json'), status);
    return { ...status, changed: true, sourceCurrent: true, readyToCutOver: false };
  } catch (error) {
    if (createdPath) { await noLinks(createdPath); await fs.rm(createdPath, { recursive: true, force: true }); }
    // An unowned directory is never adopted merely to record an error.
    await assertOwnership(ctx).then(() => atomicJson(path.join(ctx.stateDir, 'status.json'), {
      schemaVersion: 1, owner: OWNER, outcome: 'failed', checkedAt: now(), repositoryRoot: ctx.root, targetId: ctx.targetId,
      error: error.message, sourceCurrent: false, readyToCutOver: false,
    })).catch(() => {});
    throw error;
  } finally { await releaseLock(); }
}
/** Quality checks can defer to an already running exact-source capture without claiming freshness. */
export async function ensureSource(root = ROOT, options = {}) {
  try { return await syncSource(root, options); }
  catch (error) {
    if (error.message !== 'Another exit sync is running') throw error;
    return {outcome:'deferred',reason:'another-source-capture-holds-lock',sourceCurrent:null,readyToCutOver:false};
  }
}

/** Status rechecks the complete copy and safe source bytes; a stale or failed attempt never reads as healthy. */
export async function syncStatus(root = ROOT, options = {}) {
  try {
    const ctx = await context(root, options); await assertOwnership(ctx);
    const pointer = await readJson(path.join(ctx.stateDir, 'latest.json'));
    const verification = await checkPointer(ctx, pointer);
    const records = await catalog(ctx);
    if (!records.releases.some(record => JSON.stringify(record) === JSON.stringify(pointer))) throw new Error('Current pointer missing from owned catalog');
    const last = await readJson(path.join(ctx.stateDir, 'status.json'));
    if (last.schemaVersion !== 1 || last.outcome !== 'synced' || !Object.entries(pointer).every(([key,value]) => last[key] === value)
        || typeof last.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(last.checkedAt)
        || !Number.isFinite(Date.parse(last.checkedAt)) || Date.parse(last.checkedAt) > Date.now() + 300_000
        || !['passed','failed','not-present'].includes(last.mapValidation?.outcome)) throw new Error(last.error ?? 'Latest source sync attempt is not successful or its metadata is invalid');
    const current = sourceTreeHash(await collectSource(ctx.root)) === pointer.sourceTreeHash && verification.current;
    return { ...pointer, outcome: current ? 'synced' : 'stale', checkedAt: now(), lastCheckedAt: last.checkedAt, mapValidation:last.mapValidation,
      sourceCurrent: Boolean(current), codeVerified: current && pointer.codeVerification === 'passed', readyToCutOver: false };
  } catch (error) { return { outcome: 'failed', error: error.message, sourceCurrent: false, codeVerified: false, readyToCutOver: false }; }
}

/** Poll content, not timestamps. Initial capture plus bounded sweeps catch edits made while the watcher was stopped. */
export async function watchSource(root = ROOT, options = {}) {
  const intervalMs = options.intervalMs ?? 30_000;
  if (!Number.isInteger(intervalMs) || intervalMs < 50 || intervalMs > 3_600_000) throw new Error('Invalid source sweep interval');
  let stopped = false, wake;
  const stop = () => { stopped = true; wake?.(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  try {
    while (!stopped) {
      try {
        const result = await syncSource(root, { ...options, verifyCode: false });
        if (result.changed) console.log(JSON.stringify(result));
      } catch (error) { console.error(JSON.stringify({ outcome: 'failed', checkedAt: now(), error: error.message })); }
      if (!stopped) await new Promise(resolve => { const timer = setTimeout(resolve, intervalMs); wake = () => { clearTimeout(timer); resolve(); }; });
    }
  } finally { process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop); }
}
const xml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
/** A per-user macOS watcher is reversible; installation neither captures live data nor enables cloud resources. */
export function launchAgentPlist({ root, stateDir, targetId, keep = 3, intervalMs = 30_000, node = process.execPath }) {
  const args = [node, path.join(root, 'infrastructure/exit/sync.mjs'), 'watch', '--state-dir', stateDir,
    '--target-id', targetId, '--keep', String(keep), '--interval-ms', String(intervalMs)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${LABEL}</string><key>ProgramArguments</key><array>${args.map(arg => '<string>' + xml(arg) + '</string>').join('')}</array>
<key>WorkingDirectory</key><string>${xml(root)}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(path.dirname(node))}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>ThrottleInterval</key><integer>30</integer><key>ProcessType</key><string>Background</string>
<!-- Durable private status.json replaces unbounded service logs. -->
<key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string>
</dict></plist>\n`;
}
async function service(root, options, uninstall = false) {
  if (process.platform !== 'darwin') throw new Error('Automatic installation currently supports macOS; run watch under your reviewed service manager elsewhere');
  const ctx = await context(root, options, !uninstall);
  const filename = options.sessionOnly ? path.join(ctx.stateDir, 'launch-agent.plist') : path.join(os.homedir(), 'Library/LaunchAgents', LABEL + '.plist');
  await noLinks(filename);
  const intervalMs = options.intervalMs ?? 30_000;
  if (!Number.isInteger(intervalMs) || intervalMs < 50 || intervalMs > 3_600_000) throw new Error('Invalid source sweep interval');
  const value = launchAgentPlist({ ...ctx, intervalMs });
  let existing;
  try { await privateEntry(filename); existing = await fs.readFile(filename, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing && existing !== value) throw new Error('Existing LaunchAgent differs; review and uninstall its exact original configuration before changing it');
  const domain = 'gui/' + process.getuid();
  if (uninstall) {
    if (!existing) throw new Error('Owned LaunchAgent is not installed');
    execFileSync('launchctl', ['bootout', domain + '/' + LABEL], { stdio: ['ignore','pipe','pipe'] });
    await fs.unlink(filename);
    return { service: LABEL, installed: false, snapshotsDeleted: false };
  }
  await syncSource(root, ctx);
  if (!existing) {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, value, { flag: 'wx', mode: 0o600 });
  }
  let running = false;
  try { execFileSync('launchctl', ['print', domain + '/' + LABEL], { stdio: ['ignore','pipe','pipe'] }); running = true; } catch {}
  if (!running) execFileSync('launchctl', ['bootstrap', domain, filename], { stdio: ['ignore','pipe','pipe'] });
  execFileSync('launchctl', ['kickstart', domain + '/' + LABEL], { stdio: ['ignore','pipe','pipe'] });
  return { service: LABEL, installed: true, configuration: filename, stateDir: ctx.stateDir, intervalMs,
    loginAutoStart:!options.sessionOnly, persistence:options.sessionOnly ? 'current-login-only' : 'user-login-startup',
    statusCommand: 'exit:sync status', readyToCutOver: false };
}
async function main(args) {
  const mode = args.shift();
  const options = {};
  const names = { '--state-dir':'stateDir', '--target-id':'targetId', '--keep':'keep', '--interval-ms':'intervalMs', '--repository-root':'repositoryRoot' };
  while (args.length) {
    const key = args.shift();
    if (key === '--verify-code') { options.verifyCode = true; continue; }
    if (key === '--session-only') { options.sessionOnly = true; continue; }
    if (!names[key] || !args.length || args[0].startsWith('--')) throw new Error('Unknown or incomplete exit sync option');
    const value = args.shift(); options[names[key]] = ['--keep','--interval-ms'].includes(key) ? Number(value) : value;
  }
  if (options.verifyCode && mode !== 'sync') throw new Error('--verify-code applies only to explicit sync');
  if (options.sessionOnly && !['install','uninstall'].includes(mode)) throw new Error('--session-only applies only to service installation/removal');
  if (options.repositoryRoot && mode !== 'watch') throw new Error('--repository-root applies only to an explicitly bound watcher');
  if (mode === 'watch') await watchSource(options.repositoryRoot ?? ROOT, options);
  else if (mode === 'ensure') console.log(JSON.stringify(await ensureSource(ROOT,options)));
  else if (mode === 'start' || mode === 'stop') {
    const watcher = await import('./watcher.mjs');
    console.log(JSON.stringify(await (mode === 'start' ? watcher.startWatcher : watcher.stopWatcher)(ROOT,options)));
  }
  else if (mode === 'sync') console.log(JSON.stringify(await syncSource(ROOT, options)));
  else if (mode === 'status') { const result = await syncStatus(ROOT, options); console.log(JSON.stringify(result)); if (!result.sourceCurrent) process.exitCode = 2; }
  else if (mode === 'install' || mode === 'uninstall') console.log(JSON.stringify(await service(ROOT, options, mode === 'uninstall')));
  else throw new Error('Usage: sync.mjs sync|ensure|status|watch|start|stop|install|uninstall [--state-dir PRIVATE_EXTERNAL] [--target-id ID] [--keep 3] [--interval-ms 30000] [sync --verify-code] [install|uninstall --session-only]');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error('Exit sync failed: ' + error.message); process.exitCode = 1; });
