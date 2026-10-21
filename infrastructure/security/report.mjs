/**
 * Joins local infrastructure ownership, safe source evidence and required Security reviews.
 * Writes a deterministic report through the exit-map writer; never reads private inputs,
 * executes a guard or grants operational acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collectExitInventory } from '../../scripts/exit-inventory.mjs';
import { writeExitMap } from '../../scripts/exit-map-output.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT = 'docs/engineering/INFRASTRUCTURE_SECURITY_REPORT.md';
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const SECURITY = [
  'SECURITY', 'INFRA_SECURITY', 'SUPPLY_CHAIN_SECURITY', 'RECOVERY_SECURITY',
  'RLS_SECURITY', 'SESSION_SECURITY', 'THREAT_DETECTION',
];
const CONTROL_FIELDS = ['_comment', 'schemaVersion', 'serviceReviewers', 'componentReviewers', 'guards', 'operationalReviewers'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const unique = values => [...new Set(values)].sort();

export const GUARDS = Object.freeze({
  'client-boundary': 'security:client-keys',
  'no-ssn': 'security:no-ssn',
  'restore-contracts': 'redundancy:test',
  'source-custody': 'exit:test',
  'connection-contracts': 'portability:test',
  'source-recovery': 'recovery:test',
  'infra-inventory': 'infra:register:check',
  'data-governance': 'data:map:check',
  'role-routing': 'agents:check',
});
export const OPERATIONS = Object.freeze({
  'network-iam-tls': 'Network exposure, IAM least privilege and real TLS',
  'host-patching': 'Host patching, access and runtime hardening',
  'ci-supply-chain': 'CI permissions, action/dependency integrity and build trust',
  'runtime-images': 'Pinned reviewed images and actual target-platform offline load',
  'secret-custody': 'Independent key custody, rotation and credential isolation',
  'auth-sessions': 'Real Auth, MFA, redirects and migrated sessions',
  'database-authorization': 'Live grants, RLS, RPC and negative identity tests',
  'storage-access': 'Storage bytes, owners and private access after restore',
  'backup-offsite': 'Independent offsite retrieval, decryption and freshness',
  'restore-isolation': 'Isolated restore, writer fencing and measured rollback',
  'incident-response': 'Trusted events, tamper resistance and actual alert delivery',
  'payment-boundaries': 'Approved test payment, session and finance acceptance',
  'retention-privacy': 'Data minimization, erasure and approved retention',
});

function safeEvidence(file) {
  const allowedPath = typeof file === 'string' && file.length <= 240
    && /^(?:scripts|infrastructure|apps|packages|supabase|patches|\.github)\/[A-Za-z0-9_./()+@\[\]-]+$/.test(file);
  if (!allowedPath) throw new Error('unsafe-evidence-path');

  const unsafePart = file.split('/').some(part => {
    const backupSource = file.startsWith('infrastructure/backup/') && (part === 'backup' || part === 'backup.py');
    return part === '..' || part === '.' || part.startsWith('.env')
      || /^(?:credentials?|secrets?|backups?|exports?|logs?|cache|customer-data)(?:[._-]|$)/i.test(part) && !backupSource;
  });
  const privateExtension = /\.(?:env|local|secret|credentials|tfstate|tfplan|tfvars|age|pem|key|dump|log)(?:\.|$)/i.test(file);
  if (unsafePart || privateExtension) throw new Error('unsafe-evidence-path');
}

function bytesAt(root, file) {
  let current = root;
  for (const part of file.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('security-input-symlink');
  }
  const fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size > 4 * 1024 * 1024) throw new Error('security-input-not-bounded-file');
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    if (bytes.length !== before.size || before.mtimeMs !== after.mtimeMs) throw new Error('security-input-changed');
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

const jsonAt = (root, file) => JSON.parse(bytesAt(root, file).toString('utf8'));
const dictionary = value => value && typeof value === 'object' && !Array.isArray(value);

function identifiers(items) {
  if (!Array.isArray(items) || items.some(item => !item || !ID.test(item.id))
    || new Set(items.map(item => item.id)).size !== items.length) {
    throw new Error('invalid-inventory-identifiers');
  }
}

function readControls(root) {
  const controls = jsonAt(root, 'infrastructure/security/controls.json');
  if (controls.schemaVersion !== 1 || Object.keys(controls).some(key => !CONTROL_FIELDS.includes(key))
    || !dictionary(controls.serviceReviewers) || !dictionary(controls.componentReviewers)
    || !dictionary(controls.operationalReviewers) || !Array.isArray(controls.guards)) {
    throw new Error('invalid-security-controls');
  }
  return controls;
}

function readRoles(root, issues) {
  const registry = jsonAt(root, '.claude/agents/registry.json');
  if (registry.version !== 1 || !Array.isArray(registry.agents)
    || registry.agents.some(agent => !agent || !/^[A-Z][A-Z0-9_]{0,63}$/.test(agent.call))
    || new Set(registry.agents.map(agent => agent.call)).size !== registry.agents.length) {
    throw new Error('invalid-security-registry');
  }
  const roles = new Map(registry.agents.map(agent => [agent.call, agent]));
  for (const call of SECURITY) {
    const role = roles.get(call);
    if (!role || role.department !== 'Security' || role.lead !== (call === 'SECURITY' ? 'CTO' : 'SECURITY')) {
      issues.push(`invalid-security-role:${call}`);
    }
  }
  return roles;
}

function checkedReviewers(reviewers, label, issues) {
  if (!Array.isArray(reviewers) || reviewers.length === 0 || reviewers.some(call => !SECURITY.includes(call))
    || new Set(reviewers).size !== reviewers.length) {
    issues.push(`invalid-reviewers:${label}`);
    return [];
  }
  return unique(reviewers);
}

function coverage(items, mapping, kind, roles, issues) {
  identifiers(items);
  if (Object.keys(mapping).some(key => !ID.test(key))) throw new Error('invalid-coverage-identifiers');
  const itemIds = new Set(items.map(item => item.id));
  for (const key of Object.keys(mapping)) {
    if (!itemIds.has(key)) issues.push(`obsolete-${kind}:${key}`);
  }
  return [...items].sort((a, b) => a.id.localeCompare(b.id)).map(item => {
    const listed = mapping[item.id];
    if (!listed) issues.push(`uncovered-${kind}:${item.id}`);
    const reviewers = listed ? checkedReviewers(listed, `${kind}:${item.id}`, issues) : [];
    const engineeringOwner = kind === 'service' ? 'INFRASTRUCTURE' : item.owner;
    if (!roles.has(engineeringOwner)) issues.push(`unknown-engineering-owner:${kind}:${item.id}`);
    if (kind === 'component') {
      const routed = [item.owner, ...(Array.isArray(item.with) ? item.with : [])];
      for (const call of reviewers) {
        if (!routed.includes(call)) issues.push(`component-reviewer-not-routed:${item.id}:${call}`);
      }
    }
    return { id: item.id, engineeringOwner: roles.has(engineeringOwner) ? engineeringOwner : null, reviewers };
  });
}

function inspectGuards(root, guards, scripts, commands, sourcePaths, issues) {
  identifiers(guards);
  if (guards.some(guard => Object.keys(guard).some(key => !['id', 'evidence'].includes(key)))) {
    throw new Error('invalid-guard-fields');
  }
  for (const guard of guards) {
    if (!Object.hasOwn(GUARDS, guard.id)) issues.push(`unknown-guard:${guard.id}`);
  }
  return Object.entries(GUARDS).map(([id, command]) => {
    // Only this guard's missing prerequisites affect its status; other issues remain in the overall report.
    const previousIssueCount = issues.length;
    const guard = guards.find(candidate => candidate.id === id);
    const evidence = [];
    if (!guard) issues.push(`missing-guard:${id}`);
    if (typeof scripts[command] !== 'string') issues.push(`missing-guard-command:${id}`);
    if (!commands.includes(`pnpm ${command}`)) issues.push(`guard-not-in-full-check:${id}`);
    if (guard && (!Array.isArray(guard.evidence) || guard.evidence.length === 0 || guard.evidence.length > 32)) {
      throw new Error('invalid-guard-evidence');
    }
    for (const file of guard?.evidence ?? []) {
      safeEvidence(file);
      // Inventory membership is required before any evidence bytes are read.
      if (!sourcePaths.has(file)) {
        issues.push(`missing-evidence:${id}`);
        continue;
      }
      try {
        evidence.push({ path: file, sha256: sha(bytesAt(root, file)) });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        issues.push(`missing-evidence:${id}`);
      }
    }
    return {
      id, command: `pnpm ${command}`,
      status: issues.length === previousIssueCount ? 'source-linked' : 'needs-attention',
      executed: false, evidence,
    };
  });
}

function requiredOperations(mapping, issues) {
  if (Object.keys(mapping).some(id => !ID.test(id))) throw new Error('invalid-operation-identifiers');
  for (const id of Object.keys(mapping)) {
    if (!Object.hasOwn(OPERATIONS, id)) issues.push(`unknown-operation:${id}`);
  }
  return Object.entries(OPERATIONS).map(([id, title]) => {
    const listed = mapping[id];
    if (!listed) issues.push(`missing-operation:${id}`);
    return { id, title, reviewers: listed ? checkedReviewers(listed, `operation:${id}`, issues) : [], status: 'not-verified' };
  });
}

function securityMetadata(root, roles) {
  const files = ['.claude/agents/registry.json', 'docs/engineering/infrastructure.json', 'infrastructure/security/controls.json'];
  for (const call of SECURITY) {
    const file = roles.get(call)?.file;
    if (file) {
      if (!/^\.claude\/agents\/[a-z0-9-]+\.md$/.test(file)) throw new Error('invalid-security-role-path');
      files.push(file);
    }
  }
  for (const file of ['docs/engineering/INFRASTRUCTURE_SECURITY.md', 'docs/engineering/INFRASTRUCTURE_SECURITY_FINDINGS.md']) {
    if (fs.existsSync(path.join(root, file))) files.push(file);
  }
  return unique(files).map(file => ({ path: file, sha256: sha(bytesAt(root, file)) }));
}

/** Returns local governance and source hashes. No guard execution, audit acceptance or provider contact occurs. */
export function inspectSecurity(root = ROOT) {
  root = fs.realpathSync(root);
  const issues = [];
  const controls = readControls(root);
  const roles = readRoles(root, issues);
  const services = jsonAt(root, 'docs/engineering/infrastructure.json').services;
  const components = jsonAt(root, 'docs/engineering/exit-map.json').components;
  const pkg = jsonAt(root, 'package.json');
  if (!dictionary(pkg.scripts) || typeof pkg.scripts.check !== 'string') throw new Error('invalid-quality-check-contract');
  const commands = pkg.scripts.check.split(/\s*&&\s*/);
  const inventory = collectExitInventory(root);
  const sourcePaths = new Set(inventory.sourceFiles.map(file => file.path));

  const serviceCoverage = coverage(services, controls.serviceReviewers, 'service', roles, issues);
  const componentCoverage = coverage(components, controls.componentReviewers, 'component', roles, issues);
  const localGuards = inspectGuards(root, controls.guards, pkg.scripts, commands, sourcePaths, issues);
  for (const command of ['security:infra:test', 'security:infra:check']) {
    if (typeof pkg.scripts[command] !== 'string' || !commands.includes(`pnpm ${command}`)) {
      issues.push(`missing-security-full-check:${command}`);
    }
  }
  const operations = requiredOperations(controls.operationalReviewers, issues);
  const metadata = securityMetadata(root, roles);
  const metadataHash = sha(JSON.stringify(metadata));
  const boundHash = sha(JSON.stringify({ inventoryHash: inventory.contentHash, metadataHash }));
  return {
    schemaVersion: 1,
    scope: 'registered-infrastructure-and-governed-safe-source',
    source: {
      inventoryHash: inventory.contentHash, metadataHash, boundHash,
      fileCount: inventory.sourceFiles.length, metadataFileCount: metadata.length,
    },
    structuralStatus: issues.length ? 'needs-attention' : 'current',
    securityStatus: 'not-established',
    serviceCoverage, componentCoverage, localGuards, operations,
    issues: unique(issues),
    unresolvedSdkCandidates: inventory.reviewRequiredCallsites.length,
    providerContacted: false,
    operationalAcceptance: false,
    readyToCutOver: false,
  };
}

/** Formats only the validated report's safe identifiers, fixed titles and source links; performs no IO. */
export function renderSecurityReport(report) {
  const reviewers = calls => calls.map(call => `\`${call}\``).join(', ') || 'unassigned';
  const rows = items => items.map(item =>
    `| \`${item.id}\` | \`${item.engineeringOwner ?? 'unassigned'}\` | ${reviewers(item.reviewers)} |`).join('\n');
  const guards = report.localGuards.map(guard => {
    const evidence = guard.evidence.map(file => `[${path.posix.basename(file.path)}](../../${file.path})`).join(', ') || 'missing';
    return `| \`${guard.id}\` | \`${guard.command}\` | ${guard.status} | ${evidence} |`;
  }).join('\n');
  const operations = report.operations.map(operation =>
    `| ${operation.title} | ${reviewers(operation.reviewers)} | ${operation.status} |`).join('\n');
  const issues = report.issues.length
    ? report.issues.map(issue => `- \`${issue}\``).join('\n')
    : 'No structural issues found by this invocation.';
  return `<!-- Generated by infrastructure/security/report.mjs; source awareness never establishes operational security acceptance. -->
# Infrastructure Security Report

Local governance: **${report.structuralStatus}**. Operational security: **${report.securityStatus}**.
This deterministic report was generated from source; its guard links are not execution or reviewer receipts.
No providers contacted; operationalAcceptance=false; readyToCutOver=false.

## Source binding

- Safe source SHA256: \`${report.source.inventoryHash}\` (${report.source.fileCount} files).
- Security metadata SHA256: \`${report.source.metadataHash}\` (${report.source.metadataFileCount} files).
- Combined binding: \`${report.source.boundHash}\`.
- Unresolved SDK syntax candidates: ${report.unresolvedSdkCandidates}; their owners still need semantic review.

Scope is registered services/components and governed safe source, not unknown shadow systems or live cloud observations.
See [security workflow](INFRASTRUCTURE_SECURITY.md) and [dated scoped findings](INFRASTRUCTURE_SECURITY_FINDINGS.md).

## Services

| Service | Engineering coordinator | Security reviewers |
| --- | --- | --- |
${rows(report.serviceCoverage)}

## Exit components

| Component | Engineering owner | Security reviewers |
| --- | --- | --- |
${rows(report.componentCoverage)}

## Existing local guards

A guard is **source-linked** only when its configuration, command, full-check inclusion and evidence are present.
Missing prerequisites are **needs-attention**. This report never executes guards; preserve actual command results separately.

| Guard | Command | Status | Source evidence |
| --- | --- | --- | --- |
${guards}

## Required actual operational reviews

All remain **not-verified** here. An authored statement or report refresh does not establish acceptance.

| Requirement | Security reviewers | Status |
| --- | --- | --- |
${operations}

## Local governance issues

${issues}

SECURITY sends actual findings to CTO and the shared REDUNDANCY_LEAD/INFRASTRUCTURE packet.
Reviewers preserve original evidence, source/config version, date, validation limits and next owner.
No unattended security agent or delivered alert is created by this report.
`;
}

/** Checks rendered currentness without writing, or atomically refreshes Markdown. Current does not mean accepted. */
export async function updateSecurityReport(root = ROOT, { check = false } = {}) {
  const report = inspectSecurity(root);
  const output = renderSecurityReport(report);
  let current = false;
  try {
    current = bytesAt(root, OUTPUT).toString('utf8') === output;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const changed = check ? false : writeExitMap(root, OUTPUT, output);
  return { report, current: check ? current : true, changed };
}

async function runCommand(args) {
  if (args.length !== 1 || !['--write', '--check', '--json', '--help'].includes(args[0])) {
    throw new Error('invalid-security-report-command');
  }
  const mode = args[0];
  if (mode === '--help') {
    console.log('Security source report: --write | --check | --json. Local inputs only; no operational acceptance.');
    return;
  }
  if (mode === '--json') {
    const report = inspectSecurity();
    console.log(JSON.stringify(report));
    if (report.issues.length) process.exitCode = 1;
    return;
  }
  const result = await updateSecurityReport(ROOT, { check: mode === '--check' });
  if (result.report.issues.length) {
    // The exit source updater recognizes this exact semantic-failure prefix and retains only an unverified draft.
    const prefix = mode === '--write' ? `security:infra wrote ${OUTPUT} with problems` : 'security:infra coverage failed';
    console.error(`${prefix}: ${result.report.issues.join(', ')}`);
    process.exitCode = 1;
  } else if (!result.current) {
    console.error('security:infra report is stale; run pnpm security:infra');
    process.exitCode = 1;
  } else {
    console.log(`security:infra ${mode === '--check' ? 'check' : 'write'} ok (${result.report.serviceCoverage.length} services, ${result.report.componentCoverage.length} exit components; operational acceptance not established)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runCommand(process.argv.slice(2));
  } catch {
    console.error('security:infra refused invalid, unsafe or changed local inputs');
    process.exitCode = 2;
  }
}
