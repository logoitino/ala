/** Prepare private, incomplete recovery configuration without reading credentials or starting services. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OWNER = 'tapuai-exit-setup/1';
const ID = /^[a-z][a-z0-9-]{1,63}$/;
const MANIFEST = 'SETUP_MANIFEST.json';
const DIRECTORIES = ['config', 'credentials', 'data', 'data/backups', 'state', 'state/backup-status'];
const FILES = ['README.md', 'config/backup.env', 'config/backup-job.json', 'config/health.json',
  'credentials/recipients.txt', 'credentials/source.pgpass.example'];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const within = (child, parent) => child === parent || child.startsWith(parent + path.sep);

function plain(value, name) {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${name} must be a bounded plain string`);
  }
  return value;
}
function absolute(value, name) {
  plain(value, name);
  if (!path.isAbsolute(value) || value.split(path.sep).includes('..')) throw new Error(`${name} must be absolute without traversal`);
  return path.resolve(value);
}
async function noLinks(filename) {
  let current = path.parse(filename).root;
  for (const part of filename.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Setup paths must not contain symlinks or aliases');
      if (await fs.realpath(current) !== current) throw new Error('Setup paths must use their canonical spelling');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
function outside(filename, root) {
  if (within(filename, root) || within(root, filename)) throw new Error('Setup paths must be outside and must not contain the repository');
}
async function entry(filename, directory = false, exactMode = null) {
  await noLinks(filename);
  const info = await fs.lstat(filename);
  if ((directory ? !info.isDirectory() : !info.isFile()) || info.mode & 0o077
      || process.getuid && info.uid !== process.getuid() || exactMode !== null && (info.mode & 0o777) !== exactMode) {
    throw new Error('Setup inputs and generated files must be private and owned by this user');
  }
  return info;
}
async function absent(filename) {
  try { await fs.lstat(filename); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('Setup output already exists; existing folders and files are never replaced');
}
function publicOrigin(value) {
  plain(value, 'Source URL');
  let url;
  try { url = new URL(value); } catch { throw new Error('Source URL must be an HTTPS public origin'); }
  const host = url.hostname;
  // This records a public observed origin; it never resolves DNS, probes Supabase, or establishes ownership.
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== '/' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)) {
    throw new Error('Source URL must be an HTTPS public DNS origin without credentials, paths or ports');
  }
  return url.origin;
}

// Node rename can overwrite a concurrently created empty directory. The OS no-replace operation
// publishes the completed tree atomically and retains somebody else's destination on every race.
const PROMOTE = `import ctypes, os, sys
libc = ctypes.CDLL(None, use_errno=True)
source, target = (os.fsencode(value) for value in sys.argv[1:])
if sys.platform == 'darwin':
    operation = libc.renamex_np
    operation.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
    result = operation(source, target, 4)
elif sys.platform.startswith('linux'):
    operation = libc.renameat2
    operation.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    result = operation(-100, source, -100, target, 1)
else:
    raise RuntimeError('Atomic exclusive directory promotion requires Linux or macOS')
if result:
    raise OSError(ctypes.get_errno(), 'Atomic exclusive setup promotion failed')
`;
function promote(stage, target) {
  try { execFileSync('python3', ['-c', PROMOTE, stage, target], { stdio:['ignore','pipe','pipe'], timeout:30_000 }); }
  catch { throw new Error('Atomic setup promotion failed; no existing output was replaced (Python 3 and Linux/macOS required)'); }
}
async function parents(directory, owned) {
  await noLinks(directory);
  try {
    if (!(await fs.lstat(directory)).isDirectory()) throw new Error('Setup parent must be a directory');
    return;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await parents(path.dirname(directory), owned);
  // Exclusive creation means cleanup only includes directories created by this invocation.
  await fs.mkdir(directory, { mode:0o700 });
  owned.push({ path:directory, info:await fs.lstat(directory) });
  await fs.chmod(directory, 0o700);
}
async function removeOwned(record, recursive = false) {
  if (!record) return;
  try {
    const current = await fs.lstat(record.path);
    if (current.dev !== record.info.dev || current.ino !== record.info.ino || current.isSymbolicLink()) return;
    if (recursive) await fs.rm(record.path, { recursive:true });
    else await fs.rmdir(record.path);
  } catch (error) { if (!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code)) throw error; }
}
function payloads(ctx) {
  const at = name => path.join(ctx.outputDir, name);
  const env = [
    '# Incomplete private template. Read as data with backup tooling; never source this file into a shell.',
    '# Fill the exact source database fields and trusted CA path; no credentials were copied.',
    'PGHOST=', 'PGPORT=', 'PGDATABASE=', 'PGUSER=',
    `PGPASSFILE="${at('credentials/source.pgpass')}"`, 'PGSSLMODE=verify-full', 'PGSSLROOTCERT=',
    `SUPABASE_SOURCE_URL=${ctx.sourceUrl}`, 'SUPABASE_SOURCE_SERVICE_ROLE_KEY=', '',
  ].join('\n');
  const job = {
    _comment:'Incomplete private setup: fill verified source credentials, independently held age recipients, and reviewed destinations before running.',
    version:1, state_dir:at('state/backup-status'),
    backup:{ env_file:at('config/backup.env'), output_dir:at('data/backups'),
      recipients_file:at('credentials/recipients.txt'), custody_file:null, consistency:'online' },
    destinations:[],
  };
  const health = {
    schemaVersion:1,
    source:{ stateDir:ctx.sourceStateDir, targetId:ctx.sourceTargetId, maxScanAgeSeconds:120, expectedSupabaseUrl:ctx.sourceUrl },
    backup:{ jobConfigFile:at('config/backup-job.json'), maxAgeHours:7, maxRunHours:2 },
    readiness:null,
  };
  const readme = [
    '# Private recovery setup — incomplete', '',
    'This folder contains configuration templates only. No backup, cloud destination, restore proof,',
    'private encryption identity, or warm-cutover readiness has been created. No job was activated.',
    `The observed public source origin is ${ctx.sourceUrl}; recording it does not verify the service.`, '',
    '## Folders', '',
    '- `config/`: private backup environment, unattended job and combined health configuration.',
    '- `credentials/`: empty public age recipients list and a pgpass example; no actual password file.',
    '- `data/backups/`: empty encrypted archive destination.',
    '- `state/backup-status/`: empty job receipt directory.',
    '- `SETUP_MANIFEST.json`: hashes and modes of the original templates, always marked incomplete.', '',
    '## Complete the private configuration', '',
    '1. Fill PGHOST, PGPORT, PGDATABASE and PGUSER in `config/backup.env` from the reviewed source.',
    '   Set PGSSLROOTCERT to a trusted private CA file if the source connection requires one;',
    '   retain PGSSLMODE=verify-full. Fill the server-only SUPABASE_SOURCE_SERVICE_ROLE_KEY privately.',
    '2. Create `credentials/source.pgpass` from the example with the exact source password; use mode 600.',
    '   The example is not a password file. Never place credentials in command arguments or the checkout.',
    '3. Add reviewed public age recipients to `credentials/recipients.txt`. Keep the corresponding',
    '   private decryption identities independently and test custody. None was generated here.',
    '4. Choose and configure independent private AWS/Azure destinations in `config/backup-job.json`.',
    '   Match the existing `infrastructure/backup/job.config.example.json` provider fields exactly.',
    '   The empty destinations list deliberately fails the job loader. Custody evidence is optional',
    '   until independently recorded; the template does not invent it.',
    '5. Verify Node 24, pnpm, Python 3.10+, age, matching-major pg_dump/pg_restore and psql, trusted',
    '   source TLS and separately authorized provider CLIs/identities. This generator installed nothing.',
    '6. Rehearse a reviewed restore and supply protected readiness evidence separately. Online capture',
    '   is not a database/Storage write freeze, PITR, HA, or a proven two-to-three-hour switch.', '',
    '## Read-only status checks', '',
    'The following commands report missing configuration and evidence until real work is completed.',
    'They do not start the backup job or change a provider:', '',
    '```sh', `cd ${quote(ctx.root)}`,
    `pnpm exit:sync status --state-dir ${quote(ctx.sourceStateDir)} --target-id ${quote(ctx.sourceTargetId)}`,
    `pnpm exit:health --config-file ${quote(at('config/health.json'))}`, '```', '',
    'After private configuration and operator review, the one-shot job entry point is:', '',
    '```sh', `cd ${quote(ctx.root)}`,
    `python3 infrastructure/backup/job.py --config-file ${quote(at('config/backup-job.json'))}`, '```', '',
    'That command performs live capture and uploads when configured; it was not run by setup.',
    'Keep every generated directory at mode 700 and file at mode 600. Existing parent modes are preserved.',
    'Changing a template invalidates its original setup hash; this manifest proves template integrity,',
    'not current credential correctness, backup freshness, or readiness. Generated paths bind this location.',
    'To abandon this setup, first inspect the folder and remove only your newly created setup tree;',
    'preserve any data or credentials added later. The generator never adopts an existing destination.', '',
  ].join('\n');
  return {
    'README.md':readme, 'config/backup.env':env, 'config/backup-job.json':json(job), 'config/health.json':json(health),
    'credentials/recipients.txt':'',
    'credentials/source.pgpass.example':'# Placeholder only. Copy privately to source.pgpass and fill every field; mode 600.\n<source-host>:<source-port>:<source-database>:<source-user>:<source-password>\n',
  };
}

/** Only explicit public origin and private path metadata enter the generated setup. */
export async function createSetup(options) {
  if (!options || typeof options !== 'object' || Object.keys(options).some(key => !['outputDir','sourceUrl','sourceStateDir','sourceTargetId','root'].includes(key))) {
    throw new Error('Unsupported setup options');
  }
  const root = await fs.realpath(options.root ?? ROOT);
  const outputDir = absolute(options.outputDir, 'Output directory');
  const sourceStateDir = absolute(options.sourceStateDir, 'Source state directory');
  const sourceTargetId = options.sourceTargetId ?? 'local-source';
  if (typeof sourceTargetId !== 'string' || !ID.test(sourceTargetId)) throw new Error('Invalid source target ID');
  const ctx = { root, outputDir, sourceStateDir, sourceTargetId, sourceUrl:publicOrigin(options.sourceUrl) };
  outside(outputDir, root); outside(sourceStateDir, root);
  if (within(outputDir, sourceStateDir) || within(sourceStateDir, outputDir)) throw new Error('Setup and source state directories must be separate');
  await noLinks(outputDir); await absent(outputDir); await entry(sourceStateDir, true);
  const ownedParents = []; let stage; let published = false;
  try {
    await parents(path.dirname(outputDir), ownedParents);
    await noLinks(outputDir); await absent(outputDir);
    const stagePath = await fs.mkdtemp(path.join(path.dirname(outputDir), '.tapuai-setup-'));
    stage = { path:stagePath, info:await fs.lstat(stagePath) };
    await fs.chmod(stagePath, 0o700);
    for (const directory of DIRECTORIES) {
      const filename = path.join(stagePath, directory);
      await fs.mkdir(filename, { mode:0o700 }); await fs.chmod(filename, 0o700);
    }
    const content = payloads(ctx), files = [];
    for (const filename of FILES) {
      const data = content[filename];
      await fs.writeFile(path.join(stagePath, filename), data, { flag:'wx', mode:0o600 });
      await fs.chmod(path.join(stagePath, filename), 0o600);
      files.push({ path:filename, sha256:sha256(data), mode:'0600' });
    }
    const manifest = {
      schemaVersion:1, owner:OWNER, incomplete:true, readyToCutOver:false, createdAt:new Date().toISOString(),
      repositoryRoot:root, outputDirectory:outputDir, source:{ stateDir:sourceStateDir, targetId:sourceTargetId, supabaseUrl:ctx.sourceUrl },
      directories:[{ path:'.', mode:'0700' }, ...DIRECTORIES.map(directory => ({ path:directory, mode:'0700' }))], files,
      manifestFile:{ path:MANIFEST, mode:'0600', integrity:'sha256 of JSON.stringify(manifest without manifestSha256)' },
    };
    manifest.manifestSha256 = sha256(JSON.stringify(manifest));
    await fs.writeFile(path.join(stagePath, MANIFEST), json(manifest), { flag:'wx', mode:0o600 });
    await fs.chmod(path.join(stagePath, MANIFEST), 0o600);
    await verifyTree(stagePath, outputDir);
    await noLinks(outputDir); await absent(outputDir); await entry(sourceStateDir, true);
    promote(stagePath, outputDir); published = true; stage = null;
    return { schemaVersion:1, outputDirectory:outputDir, manifestSha256:manifest.manifestSha256,
      incomplete:true, readyToCutOver:false, backupCreated:false, servicesActivated:false };
  } finally {
    await removeOwned(stage, true);
    if (!published) for (const parent of ownedParents.reverse()) await removeOwned(parent);
  }
}

async function verifyTree(directory, expectedOutput = directory) {
  await entry(directory, true, 0o700);
  const filename = path.join(directory, MANIFEST);
  await entry(filename, false, 0o600);
  const raw = await fs.readFile(filename, 'utf8');
  if (raw.length > 65536) throw new Error('Setup manifest exceeds its limit');
  const manifest = JSON.parse(raw);
  const { manifestSha256, ...body } = manifest;
  if (manifest.schemaVersion !== 1 || manifest.owner !== OWNER || manifest.incomplete !== true || manifest.readyToCutOver !== false
      || manifest.outputDirectory !== expectedOutput || manifestSha256 !== sha256(JSON.stringify(body))
      || JSON.stringify(manifest.manifestFile) !== JSON.stringify({ path:MANIFEST, mode:'0600', integrity:'sha256 of JSON.stringify(manifest without manifestSha256)' })
      || JSON.stringify(manifest.directories) !== JSON.stringify([{ path:'.', mode:'0700' }, ...DIRECTORIES.map(name => ({ path:name, mode:'0700' }))])
      || !Array.isArray(manifest.files) || manifest.files.length !== FILES.length
      || manifest.files.some((record,index) => record.path !== FILES[index] || record.mode !== '0600' || !/^[a-f0-9]{64}$/.test(record.sha256))) {
    throw new Error('Setup manifest is incomplete, altered or bound to another location');
  }
  const expected = new Set([...FILES, MANIFEST, ...DIRECTORIES]);
  async function walk(current, prefix = '') {
    for (const name of await fs.readdir(current)) {
      const relative = prefix ? `${prefix}/${name}` : name;
      if (!expected.delete(relative)) throw new Error('Unexpected file in original setup tree');
      const info = await fs.lstat(path.join(current, name));
      const isDirectory = DIRECTORIES.includes(relative);
      await entry(path.join(current, name), isDirectory, isDirectory ? 0o700 : 0o600);
      if (isDirectory) await walk(path.join(current, name), relative);
      else if (!info.isFile()) throw new Error('Unexpected setup entry type');
    }
  }
  await walk(directory);
  if (expected.size) throw new Error('Original setup tree is missing a file or directory');
  for (const record of manifest.files) {
    if (sha256(await fs.readFile(path.join(directory, record.path))) !== record.sha256) throw new Error('Original setup file hash changed');
  }
  return { schemaVersion:1, integrity:'verified', incomplete:true, readyToCutOver:false, manifestSha256 };
}
/** Initial template integrity is deliberately separate from health or operational readiness. */
export async function verifySetup(directory) {
  directory = absolute(directory, 'Setup directory');
  return verifyTree(directory);
}

function parse(args) {
  const names = { '--output-dir':'outputDir', '--source-url':'sourceUrl', '--source-state-dir':'sourceStateDir', '--source-target-id':'sourceTargetId' };
  const options = {};
  for (let index=0; index<args.length; index+=2) {
    const key = names[args[index]], value = args[index+1];
    if (!key || key in options || !value || value.startsWith('--')) throw new Error('Unknown, duplicate or missing setup argument');
    options[key] = value;
  }
  if (!options.outputDir || !options.sourceUrl || !options.sourceStateDir) throw new Error('Output directory, public source URL and existing private source state are required');
  return options;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    process.stdout.write('Usage: pnpm exit:setup --output-dir NEW_ABSOLUTE_EXTERNAL --source-url HTTPS_PUBLIC_ORIGIN --source-state-dir EXISTING_PRIVATE [--source-target-id local-source]\n');
  } else {
    try { process.stdout.write(json(await createSetup(parse(process.argv.slice(2))))); }
    // No rejected URL, supplied value, credential or subprocess diagnostic is reflected in output.
    catch (error) { process.stderr.write(`exit:setup failed: ${error.message}\n`); process.exitCode = 1; }
  }
}

// Profile generation uses the same reviewed ownership/alias/no-overwrite primitives as private recovery setup.
export { absolute as privateOutputPath, noLinks as rejectPathAliases, outside as requireOutsideRepository,
  entry as privateOwnedEntry, absent as requireAbsentOutput, promote as promoteExclusive,
  parents as createPrivateParents, removeOwned as removeOwnedOutput };
