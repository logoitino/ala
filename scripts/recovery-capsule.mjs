/**
 * Private source capsules verify hashes and restore only into isolated previews, never live code or SQL.
 * Capsules include dependency locks and migrations as evidence; restoring them does not apply migrations.
 * SHA-256 proves integrity against the recorded digest, not the identity of a trusted signer.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const LIMITS = { maxFiles: 20_000, maxFileBytes: 20 * 1024 * 1024, maxBytes: 128 * 1024 * 1024, maxArchiveBytes: 192 * 1024 * 1024, maxJsonBytes: 220 * 1024 * 1024 };
const FOLDERS = new Set(['apps', 'packages', 'supabase', 'scripts', 'patches', 'docs', 'infrastructure', '.github', '.claude']);
const ROOT_FILES = new Set(['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'app.json', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'CHANGELOG.md', '.gitignore', '.dockerignore', '.npmrc']);
const IGNORE = new Set(['node_modules', '.git', '.next', '.expo', '.smoke', '.tmp', '.temp', '.superpowers', 'dist', 'out', 'web-build', 'ios', 'android', '.playwright-mcp', '.DS_Store', '__pycache__', '.terraform', 'upstream']);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => JSON.stringify(value);
const treeHash = (files) => sha(text(files.map(({ path: file, sha256, size, mode }) => ({ path: file, sha256, size, mode }))));
const manifestHash = ({ manifestHash: _digest, ...manifest }) => sha(text(manifest));

// Only reviewed source/config formats are packaged; ambiguous data files require an explicit policy edit.
const SOURCE_EXTENSIONS = new Set(['.ts','.tsx','.js','.cjs','.mjs','.sql','.md','.css','.scss','.html','.svg','.png','.jpg','.jpeg','.webp','.gif','.avif','.ttf','.otf','.woff','.woff2','.yml','.yaml','.toml','.sh','.patch','.py','.tf','.service','.timer']);
const JSON_SOURCE = new Set(['package.json','tsconfig.json','app.json','eas.json','scripts/app-data-boundary-baseline.json','scripts/vendor-boundary-baseline.json','docs/agents/feature-admin.json','docs/engineering/detection-sensors.json','docs/engineering/data-ownership.json','docs/engineering/infrastructure.json','docs/engineering/exit-map.json','docs/engineering/exit-map.baseline.json','docs/engineering/exit-readiness.json','docs/engineering/design/community-preview/canva-dashboard-concepts.json','.claude/agents/registry.json','packages/shared-types/admin/supportTopology.json','supabase/content/life_copy_rules.json','supabase/content/life_playbook_bank.json','supabase/content/trivia_starter_bank.json','infrastructure/supabase/upstream.lock.json','infrastructure/backup/job.config.example.json','infrastructure/exit/readiness.config.example.json','infrastructure/portability/profile.config.example.json','infrastructure/security/controls.json']);
// Only reviewed examples travel with source. Operator credentials and Terraform state never do.
// test-server.env.example (reviewed 2026-10-21) holds blank Stripe/service-role names only.
const envExample = file => ['apps/mobile/.env.example', 'apps/admin-portal/.env.example', 'apps/mobile/src/backend/api/test-server.env.example'].includes(file);
// This operator guide is source documentation; other backup/export names remain excluded.
const RECOVERY_GUIDES = new Set(['docs/engineering/BACKUP_OPERATIONS.md']);
/** Source identity ignores timestamps so content edits and reversions are measured honestly. */
export const sourceTreeHash = files => treeHash(files);
function allowedScope(file) {
  const parts = file.split('/');
  return (FOLDERS.has(parts[0]) || ROOT_FILES.has(file)) && !parts.some(part => IGNORE.has(part) || part.startsWith('.env') && !envExample(file))
    && (parts[0] !== '.claude' || parts.length === 1 || parts[1] === 'agents')
    && !parts.some((part, index) => /^(?:credentials?|secrets?|runtime-cache|customer-data|backups?|exports?|logs?|cache)(?:[._-]|$)/i.test(part)
      && !(RECOVERY_GUIDES.has(file) && index === parts.length - 1)
      && !(parts[0] === 'infrastructure' && parts[1] === 'backup' && (index === 1 || index === 2 && ['backup.py', 'backup.env.example'].includes(part))))
    && !/(?:\.pem|\.key|\.p12|\.p8|\.jks|\.mobileprovision|\.sqlite|\.db|\.dump|\.tsbuildinfo|\.log)$/i.test(file)
    && !/\.(?:local|secret|credentials)\./i.test(file) && !file.endsWith('/settings.local.json')
    && !/\.(?:tfstate|tfplan|age)(?:\.|$)/i.test(file) && !(file.endsWith('.tfvars') && !file.endsWith('.tfvars.example'));
}
function allowed(file) {
  if (!allowedScope(file)) return false;
  if (ROOT_FILES.has(file) || ['.github/CODEOWNERS','apps/mobile/public/canvaskit.wasm','infrastructure/containers/pnpm.npmrc','infrastructure/containers/Caddyfile.backend-switch'].includes(file)) return true;
  const extension = path.posix.extname(file).toLowerCase();
  if (extension === '.json') return JSON_SOURCE.has(file) || ['package.json','tsconfig.json','app.json','eas.json'].includes(path.posix.basename(file));
  const basename = path.posix.basename(file);
  return SOURCE_EXTENSIONS.has(extension) || ['.gitignore', '.dockerignore', 'Dockerfile', 'Caddyfile', '.terraform.lock.hcl'].includes(basename)
    || envExample(file) || file.startsWith('infrastructure/') && (/^Dockerfile\.[a-z]+$/.test(basename) || /\.(?:env|tfvars)\.example$/.test(basename));
}

function assertSafePath(file) {
  if (typeof file !== 'string' || !file || file.includes('\\') || /[\x00-\x1f]/.test(file) || path.posix.isAbsolute(file)
    || path.posix.normalize(file) !== file || file.split('/').includes('..') || !allowed(file)) throw new Error('Unsafe capsule path');
}

/** Dependency layout is necessary recovery source; registry auth is forbidden in packaged npm config. */
function assertNpmConfig(file, bytes) {
  if (!['.npmrc', 'infrastructure/containers/pnpm.npmrc'].includes(file)) return;
  const reviewed = new Set(['shamefully-hoist=true', 'strict-peer-dependencies=false']);
  for (const line of bytes.toString('utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#') && !line.startsWith(';'))) {
    if (!reviewed.has(line)) throw new Error('Unreviewed npm configuration; registry credentials may not enter a recovery capsule');
  }
}

async function privateDirectory(root, parts) {
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Recovery directory symlink is forbidden'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.mkdir(current, { recursive: true, mode: 0o700 });
  }
  return current;
}

/** Capture permitted current files with hard limits; source links fail rather than silently losing code. */
export async function collectSource(root, options = {}) {
  const limits = { ...LIMITS, ...options };
  const files = [];
  let total = 0;
  async function walk(directory, prefix = '') {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!allowedScope(file)) continue;
      const absolute = path.join(root, file);
      if (entry.isSymbolicLink()) throw new Error(`Source symlink must be resolved before packaging: ${file}`);
      if (entry.isDirectory()) { await walk(absolute, file); continue; }
      if (!entry.isFile()) throw new Error(`Unsupported source file: ${file}`);
      if (!allowed(file)) throw new Error(`Unreviewed source/data format; add an explicit source policy before packaging: ${file}`);
      const info = await fs.stat(absolute);
      if (info.size > limits.maxFileBytes || total + info.size > limits.maxBytes || files.length >= limits.maxFiles) throw new Error('Recovery source size/file limit exceeded');
      const bytes = await fs.readFile(absolute);
      assertNpmConfig(file, bytes);
      const after = await fs.stat(absolute);
      if (info.size !== bytes.length || info.mtimeMs !== after.mtimeMs) throw new Error('Source changed during package capture; retry after edits settle');
      total += bytes.length;
      files.push({ path: file, sha256: sha(bytes), size: bytes.length, mode: info.mode & 0o111 ? 0o700 : 0o600, modifiedAt: info.mtime.toISOString(), data: bytes.toString('base64') });
    }
  }
  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.some((file) => file.path === 'package.json') || !files.some((file) => file.path === 'pnpm-lock.yaml')) throw new Error('Complete source package requires package.json and pnpm-lock.yaml');
  return files;
}

function gitProvenance(root) {
  try {
    const lines = execFileSync('git', ['log', '-1', '--format=%H%n%an%n%aI'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
    const dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    return { gitCommit: lines[0], committedAuthor: lines[1], committedAt: lines[2], dirty };
  } catch { return { gitCommit: null, committedAuthor: null, committedAt: null, dirty: null }; }
}

/** Package the mutable working tree honestly; optional code checks must leave its captured tree unchanged. */
export async function createCapsule(root, options = {}) {
  const files = await collectSource(root, options);
  let verification = 'not-run';
  if (options.verifyCode) {
    // macOS idle sleep can expire the verification deadline while tests are suspended.
    // The process-scoped assertion ends with this bounded command; forced sleep still fails closed.
    const command = process.platform === 'darwin' ? '/usr/bin/caffeinate' : 'pnpm';
    const args = process.platform === 'darwin' ? ['-i', 'pnpm', 'check'] : ['check'];
    execFileSync(command, args, { cwd: root, stdio: 'inherit', timeout: 600_000 });
    if (treeHash(await collectSource(root, options)) !== treeHash(files)) throw new Error('Source changed during code verification; no verified capsule created');
    verification = 'passed';
  }
  const git = gitProvenance(root);
  const createdAt = new Date().toISOString();
  const releaseId = `code-${createdAt.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const provenance = { ...git, packagedBy: os.userInfo().username, packagedAt: createdAt, authorship: 'Git records committed authors; uncommitted file authorship is unknown.' };
  const manifest = {
    version: 1, releaseId, createdAt, gitCommit: git.gitCommit, provenanceHash: sha(text(provenance)), treeHash: treeHash(files),
    filesCount: files.length, byteCount: files.reduce((total, file) => total + file.size, 0), verification,
    schemaHash: files.find((file) => file.path === 'apps/mobile/src/backend/db/schema.sql')?.sha256 ?? null,
    migrationHashes: files.filter((file) => /^supabase\/migrations\/[^/]+\.sql$/.test(file.path)).map((file) => ({ path: file.path, sha256: file.sha256 })),
  };
  manifest.manifestHash = manifestHash(manifest);
  const payload = { format: 'tapuai-code-capsule', version: 1, manifest, provenance, files };
  const json = Buffer.from(text(payload));
  if (json.length > LIMITS.maxJsonBytes) throw new Error('Capsule expanded size limit exceeded');
  const archive = gzipSync(json, { level: 6 });
  // Full-backup staging is private and outside source; existing source-only callers keep their preview path.
  let directory;
  if (options.outputDirectory) {
    const requested = path.resolve(options.outputDirectory);
    if (requested === path.resolve(root) || requested.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Backup output must be outside the source repository');
    const info = await fs.lstat(requested);
    if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o077) throw new Error('External capsule output must be an existing private directory');
    directory = await fs.realpath(requested);
    if (directory === path.resolve(root) || directory.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error('Backup output resolves inside source');
  } else directory = await privateDirectory(root, ['.smoke', 'recovery', 'packages']);
  const capsulePath = path.join(directory, `${releaseId}.tapuai.gz`);
  await fs.writeFile(capsulePath, archive, { mode: 0o600, flag: 'wx' });
  const metadata = { ...manifest, capsuleHash: sha(archive) };
  const metadataPath = path.join(directory, `${releaseId}.metadata.json`);
  await fs.writeFile(metadataPath, `${text(metadata)}\n`, { mode: 0o600, flag: 'wx' });
  await verifyCapsule(capsulePath);
  return { capsulePath, metadataPath, metadata };
}

/** Validate all paths, payload bounds and hashes before exposing any file for restoration. */
export async function verifyCapsule(capsulePath) {
  const info = await fs.lstat(capsulePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size > LIMITS.maxArchiveBytes) throw new Error('Invalid capsule file or size limit');
  const archive = await fs.readFile(capsulePath);
  const json = gunzipSync(archive, { maxOutputLength: LIMITS.maxJsonBytes });
  const payload = JSON.parse(json.toString('utf8'));
  if (payload?.format !== 'tapuai-code-capsule' || payload.version !== 1 || !Array.isArray(payload.files)) throw new Error('Unsupported capsule format/version');
  const { manifest, files, provenance } = payload;
  if (!manifest || manifest.version !== 1 || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(manifest.releaseId) || !['not-run', 'passed'].includes(manifest.verification)) throw new Error('Invalid capsule manifest');
  if (!provenance || sha(text(provenance)) !== manifest.provenanceHash || provenance.gitCommit !== manifest.gitCommit || provenance.packagedAt !== manifest.createdAt || typeof provenance.packagedBy !== 'string' || provenance.packagedBy.length > 160) throw new Error('Capsule provenance integrity failure');
  if (files.length > LIMITS.maxFiles || files.length !== manifest.filesCount) throw new Error('Capsule file-count limit/integrity failure');
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    assertSafePath(file?.path);
    if (seen.has(file.path)) throw new Error('Duplicate capsule path');
    seen.add(file.path);
    if (typeof file.data !== 'string' || file.data.length > Math.ceil(LIMITS.maxFileBytes / 3) * 4
      || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > LIMITS.maxFileBytes || ![0o600, 0o700].includes(file.mode)
      || file.type || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid capsule entry size/type/hash');
    const bytes = Buffer.from(file.data, 'base64');
    assertNpmConfig(file.path, bytes);
    total += bytes.length;
    if (bytes.toString('base64') !== file.data || bytes.length !== file.size || sha(bytes) !== file.sha256 || total > LIMITS.maxBytes) throw new Error('Capsule content size/hash integrity failure');
  }
  if (total !== manifest.byteCount || treeHash(files) !== manifest.treeHash || manifestHash(manifest) !== manifest.manifestHash) throw new Error('Capsule manifest/tree hash integrity failure');
  const migrations = files.filter((file) => /^supabase\/migrations\/[^/]+\.sql$/.test(file.path)).map((file) => ({ path: file.path, sha256: file.sha256 }));
  if (text(migrations) !== text(manifest.migrationHashes) || (files.find((file) => file.path === 'apps/mobile/src/backend/db/schema.sql')?.sha256 ?? null) !== manifest.schemaHash) throw new Error('Schema/migration compatibility manifest mismatch');
  return { ...payload, capsuleHash: sha(archive) };
}

/** Restore to a fresh private preview. Never changes the current tree, runs SQL or launches old code. */
export async function restoreCapsule(capsulePath, root = ROOT) {
  const capsule = await verifyCapsule(capsulePath);
  const parent = await privateDirectory(root, ['.smoke', 'recovery', 'restores']);
  const destination = path.join(parent, capsule.manifest.releaseId);
  await fs.mkdir(destination, { mode: 0o700 }); // Existing previews deliberately fail closed.
  try {
    for (const file of capsule.files) {
      const target = path.join(destination, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, Buffer.from(file.data, 'base64'), { mode: file.mode, flag: 'wx' });
    }
    // Verify what was actually restored, without interpreting migrations or restoring customer data.
    const restored = await collectSource(destination);
    if (treeHash(restored) !== capsule.manifest.treeHash) throw new Error('Restored source integrity failure');
    await fs.writeFile(path.join(destination, 'RECOVERY_PREVIEW.json'), `${text({ releaseId: capsule.manifest.releaseId, treeHash: capsule.manifest.treeHash, restoredAt: new Date().toISOString(), operator: os.userInfo().username, next: 'Install the locked dependencies, run code tests and compare runtime/schema compatibility before approved deployment. No SQL or money was restored.' })}\n`, { mode: 0o600 });
    return destination;
  } catch (error) {
    // Only this newly created preview is removed; working source and prior previews remain intact.
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
}

async function main(args) {
  if (args[0] === 'package' && (args.length === 1 || args.length === 2 && args[1] === '--verify-code')) {
    const result = await createCapsule(ROOT, { verifyCode: args[1] === '--verify-code' });
    console.log(text(result));
  } else if (args[0] === 'verify' && args.length === 2) {
    const result = await verifyCapsule(path.resolve(args[1]));
    console.log(text({ ...result.manifest, capsuleHash: result.capsuleHash, integrity: 'passed', deployment: 'not verified', signer: 'unsigned' }));
  } else if (args[0] === 'restore' && args.length === 2) {
    console.log(text({ preview: await restoreCapsule(path.resolve(args[1])), activeCodeChanged: false, databaseRestored: false }));
  } else throw new Error('Usage: recovery-capsule.mjs package [--verify-code] | verify PACKAGE | restore PACKAGE');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
