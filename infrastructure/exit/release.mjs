/** Portable exit releases retain exact current source and inventory; they never export credentials or imply a live restore. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCapsule, verifyCapsule } from '../../scripts/recovery-capsule.mjs';
import { collectExitInventory } from '../../scripts/exit-inventory.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{1,63}$/.test(value);
const manifestHash = ({ manifestSha256: _ignored, ...manifest }) => sha(JSON.stringify(manifest));

async function externalDestination(root, requested) {
  const resolvedRoot = await fs.realpath(root);
  const absolute = path.resolve(requested);
  try { await fs.lstat(absolute); throw new Error('Release destination already exists'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let parent = path.dirname(absolute), missing = [];
  while (true) {
    try { parent = await fs.realpath(parent); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; missing.unshift(path.basename(parent)); parent = path.dirname(parent); }
  }
  parent = path.join(parent, ...missing);
  const destination = path.join(parent, path.basename(absolute));
  if (destination === resolvedRoot || destination.startsWith(resolvedRoot + path.sep)) throw new Error('Release artifacts must remain outside the source repository');
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  return destination;
}

async function privateFile(filename) {
  const info = await fs.lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077) throw new Error('Release evidence must be private regular files');
  return info;
}

/** Build a new reviewable copy; code verification is explicit and unfinished runtime/data gates stay visible. */
export async function createRelease(root = ROOT, { outputDirectory, targetId, verifyCode = false } = {}) {
  if (!outputDirectory || !validId(targetId)) throw new Error('Provide an external output directory and a reviewed target ID');
  root = await fs.realpath(root);
  const destination = await externalDestination(root, outputDirectory);
  const stage = await fs.mkdtemp(path.join(path.dirname(destination), '.tapuai-exit-'));
  await fs.chmod(stage, 0o700);
  try {
    const before = collectExitInventory(root);
    const capsule = await createCapsule(root, { outputDirectory: stage, verifyCode });
    const source = await verifyCapsule(capsule.capsulePath);
    const after = collectExitInventory(root);
    if (before.contentHash !== after.contentHash) throw new Error('Source changed while preparing the exit release');
    const indexed = new Map(source.files.map(file => [file.path, file]));
    for (const file of before.sourceFiles) {
      const included = indexed.get(file.path);
      if (!included || included.sha256 !== file.sha256 || included.size !== file.size) throw new Error('Exit inventory does not match packaged source: ' + file.path);
    }
    const application = path.join(stage, 'application');
    await fs.mkdir(application, { mode: 0o700 });
    for (const file of source.files) {
      const target = path.join(application, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, Buffer.from(file.data, 'base64'), { mode: file.mode, flag: 'wx' });
    }
    await fs.writeFile(path.join(stage, 'inventory.json'), JSON.stringify(before, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    const artifacts = [];
    for (const filename of [path.basename(capsule.capsulePath), path.basename(capsule.metadataPath), 'inventory.json']) {
      const bytes = await fs.readFile(path.join(stage, filename));
      artifacts.push({ path: filename, size: bytes.length, sha256: sha(bytes) });
    }
    const manifest = {
      schemaVersion: 1, format: 'tapuai-exit-release/1',
      releaseId: 'exit-' + randomUUID(), targetId, createdAt: new Date().toISOString(),
      releaseVersion: before.contentHash, planVersion: before.planVersion,
      sourceTreeHash: source.manifest.treeHash, sourceCapsule: path.basename(capsule.capsulePath),
      codeVerification: source.manifest.verification, artifacts,
      sourceFiles: source.files.map(({ path: filename, sha256, size, mode }) => ({ path: filename, sha256, size, mode })),
      dynamicCallReviewsRequired: before.unresolvedCalls.length,
      databaseData: 'requires-separate-encrypted-backup', runtimeImages: 'requires-prepared-image-archives',
      hostedCompatibility: 'not-proven', cutover: 'not-executed', integrityProvenance: 'unsigned-private-operator-evidence',
    };
    manifest.manifestSha256 = manifestHash(manifest);
    await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await verifyRelease(stage, { root });
    // The final path is absent until the entire copy verifies; an existing destination is never replaced.
    try { await fs.lstat(destination); throw new Error('Release destination appeared during preparation'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.rename(stage, destination);
    return { destination, releaseVersion: manifest.releaseVersion, planVersion: manifest.planVersion,
      targetId, sourceFiles: manifest.sourceFiles.length, codeVerification: manifest.codeVerification,
      dynamicCallReviewsRequired: manifest.dynamicCallReviewsRequired, readyToCutOver: false };
  } catch (error) {
    await fs.rm(stage, { recursive: true, force: true });
    throw error;
  }
}

/** Check exact artifact/source copies and, when requested, whether current runtime source has moved on. */
export async function verifyRelease(directory, { root = null } = {}) {
  const requested = path.resolve(directory), info = await fs.lstat(requested);
  if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o077) throw new Error('Release directory must be private and must not be a symlink');
  directory = await fs.realpath(requested);
  if (root) {
    const realRoot = await fs.realpath(root);
    if (directory === realRoot || directory.startsWith(realRoot + path.sep)) throw new Error('Release must remain outside the source repository');
  }
  await privateFile(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.format !== 'tapuai-exit-release/1' || !validId(manifest.targetId)
      || !/^[a-f0-9]{64}$/.test(manifest.releaseVersion ?? '') || manifestHash(manifest) !== manifest.manifestSha256
      || !Array.isArray(manifest.artifacts) || !Array.isArray(manifest.sourceFiles)) throw new Error('Invalid release manifest');
  if (manifest.artifacts.length !== 3 || new Set(manifest.artifacts.map(file => file.path)).size !== 3) throw new Error('Incomplete release artifacts');
  for (const file of manifest.artifacts) {
    if (typeof file.path !== 'string' || file.path !== path.basename(file.path) || file.path === 'manifest.json') throw new Error('Unsafe release artifact path');
    await privateFile(path.join(directory, file.path));
    const bytes = await fs.readFile(path.join(directory, file.path));
    if (bytes.length !== file.size || sha(bytes) !== file.sha256) throw new Error('Release artifact integrity failure');
  }
  if (!manifest.artifacts.some(file => file.path === manifest.sourceCapsule)
      || !manifest.artifacts.some(file => file.path === 'inventory.json')) throw new Error('Required release artifacts missing');
  const source = await verifyCapsule(path.join(directory, manifest.sourceCapsule));
  const expectedFiles = source.files.map(({ path: filename, sha256, size, mode }) => ({ path: filename, sha256, size, mode }));
  if (source.manifest.treeHash !== manifest.sourceTreeHash || JSON.stringify(expectedFiles) !== JSON.stringify(manifest.sourceFiles)
      || source.manifest.verification !== manifest.codeVerification) throw new Error('Source capsule/manifest accounting mismatch');
  const inventory = JSON.parse(await fs.readFile(path.join(directory, 'inventory.json'), 'utf8'));
  if (inventory.contentHash !== manifest.releaseVersion || inventory.planVersion !== manifest.planVersion
      || sha(JSON.stringify(inventory.sourceFiles)) !== inventory.contentHash) throw new Error('Inventory version mismatch');
  const indexed = new Map(expectedFiles.map(file => [file.path, file]));
  for (const file of inventory.sourceFiles) {
    const included = indexed.get(file.path);
    if (!included || included.size !== file.size || included.sha256 !== file.sha256) throw new Error('Inventory source coverage mismatch');
  }
  const allowed = new Map([['manifest.json', null], ...manifest.artifacts.map(file => [file.path, file]),
    ...expectedFiles.map(file => ['application/' + file.path, file])]);
  const seen = new Set();
  async function walk(relative = '') {
    for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
      const filename = relative ? relative + '/' + entry.name : entry.name;
      const absolute = path.join(directory, filename), details = await fs.lstat(absolute);
      if (entry.isSymbolicLink() || details.mode & 0o077) throw new Error('Unsafe or public entry in release');
      if (entry.isDirectory()) { await walk(filename); continue; }
      if (!entry.isFile() || !allowed.has(filename)) throw new Error('Unexpected entry in release');
      seen.add(filename);
      const expected = allowed.get(filename);
      if (expected && filename.startsWith('application/')) {
        const bytes = await fs.readFile(absolute);
        if (bytes.length !== expected.size || sha(bytes) !== expected.sha256 || (details.mode & 0o777) !== expected.mode) throw new Error('Expanded source integrity failure');
      }
    }
  }
  await walk();
  if (seen.size !== allowed.size) throw new Error('Missing release source/artifact');
  const current = root ? collectExitInventory(root) : null;
  return { integrity: 'passed', targetId: manifest.targetId, releaseVersion: manifest.releaseVersion,
    planVersion: manifest.planVersion, codeVerification: manifest.codeVerification,
    sourceFiles: manifest.sourceFiles.length, current: current ? current.contentHash === manifest.releaseVersion : null,
    currentVersion: current?.contentHash ?? null, readyToCutOver: false };
}

async function main(args) {
  const option = name => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1]; };
  if (args[0] === 'create') {
    console.log(JSON.stringify(await createRelease(ROOT, { outputDirectory: option('--output-dir'), targetId: option('--target-id'), verifyCode: args.includes('--verify-code') })));
  } else if (args[0] === 'verify' && args[1]) {
    const result = await verifyRelease(args[1], { root: args.includes('--current') ? ROOT : null });
    console.log(JSON.stringify(result));
    if (result.current === false) process.exitCode = 2;
  } else throw new Error('Usage: release.mjs create --output-dir EXTERNAL_NEW_DIR --target-id ID [--verify-code] | verify DIR [--current]');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error('Exit release failed: ' + error.message); process.exitCode = 1; });
