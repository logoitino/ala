/** IP counsel packet: bind supplied intake facts to a safe local source inventory.
 * Only hashes/paths and reviewed input text are rendered; legal decisions remain manual records.
 * @sideEffects Reads Git-listed source and register; sync atomically replaces one fixed Markdown file.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = 'docs/legal/ip-register.json';
const output = 'docs/legal/IP_COUNSEL_PACKET.md';
const roots = ['apps', 'packages', 'supabase'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.py', '.sh', '.patch']);
const explicit = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'];
const excluded = /(^|\/)(?:\.[^/]+|node_modules|dist|build|coverage|runtime|tmp|temp|cache|backups?)(\/|$)|(?:^|\/)(?:credentials|secrets?|private[-_]key)(?:[.-]|$)/i;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => { throw new Error(message); };
const text = (value) => String(value).replace(/[\r\n]+/g, ' ').replace(/[\\`*_[\]<>|]/g, '\\$&');
const link = (path) => `[${text(path)}](../../${path.split('/').map(encodeURIComponent).join('/')})`;

function safePath(root, path, required = true) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') || path.split('/').some((part) => !part || part === '..' || part === '.')) fail('Unsafe IP path');
  const absolute = join(root, path);
  // Check every ancestor: a normal filename under a symlinked directory is unsafe too.
  let current = root;
  for (const segment of path.split('/')) {
    current = join(current, segment);
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) fail(`Unsafe symlink in IP path: ${path}`);
  }
  if (!existsSync(absolute)) {
    if (required) fail(`Missing IP reference: ${path}`);
    return absolute;
  }
  if (!lstatSync(absolute).isFile() || relative(root, realpathSync(absolute)).startsWith('..')) fail(`Unsafe IP reference: ${path}`);
  return absolute;
}

function strings(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) fail(`Invalid ${name}`);
}
function fields(value, required, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid ${name}`);
  for (const field of required) if (typeof value[field] !== 'string' || !value[field].trim()) fail(`Missing ${name}.${field}`);
}
function dated(record, name) {
  fields(record, ['date', 'evidence'], name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || Number.isNaN(Date.parse(record.date))) fail(`Invalid ${name} date`);
}
function records(list, name, required) {
  if (!Array.isArray(list)) fail(`Invalid ${name}`);
  for (const record of list) { dated(record, name); fields(record, required, name); }
}

function validate(register) {
  if (register.version !== 1) fail('Unsupported IP register version');
  fields(register, ['recordDate', 'project', 'jurisdictionAssumption'], 'register');
  if (!Array.isArray(register.candidates) || !register.candidates.length) fail('Missing IP candidates');
  const ids = new Set();
  for (const candidate of register.candidates) {
    fields(candidate, ['id', 'title', 'owner', 'problem', 'baseline', 'mechanism', 'alternatives', 'limitations', 'humanContributions'], 'candidate');
    if (!/^IP-C\d+$/.test(candidate.id) || ids.has(candidate.id)) fail('Invalid/duplicate IP candidate ID');
    ids.add(candidate.id);
    strings(candidate.sources, 'sources'); strings(candidate.technicalEvidence, 'technical evidence'); strings(candidate.counselQuestions, 'candidate questions');
    if (!candidate.sources.length) fail('Missing candidate source scope');
    if (candidate.review !== null) {
      dated(candidate.review, 'review'); fields(candidate.review, ['reviewer', 'sourceSha256'], 'review');
      if (!/^[a-f0-9]{64}$/.test(candidate.review.sourceSha256)) fail('Invalid review source SHA-256');
    }
    records(candidate.decisions, 'candidate decisions', ['actor', 'kind', 'summary']);
  }
  if (!Array.isArray(register.rightsChecklist)) fail('Missing rights checklist');
  for (const row of register.rightsChecklist) {
    fields(row, ['id', 'category', 'status', 'needed'], 'rights row');
    if (!['pending', 'recorded-for-review', 'counsel-reviewed'].includes(row.status)) fail('Unsupported rights status');
    if (row.status !== 'pending') { dated(row, 'rights review'); fields(row, ['reviewer'], 'rights review'); }
  }
  records(register.disclosureEvents, 'disclosures', ['actor', 'kind', 'summary']);
  records(register.decisions, 'decisions', ['actor', 'kind', 'summary']);
  records(register.filings, 'filings', ['type', 'jurisdiction', 'receiptReference', 'applicant', 'contributors', 'docketOwner']);
  strings(register.counselQuestions, 'counsel questions');
}

function inventory(root) {
  const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  if (realpathSync(gitRoot) !== root) fail('IP command must run at the repository root');
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots, ...explicit], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0').filter(Boolean);
  const files = [];
  for (const path of [...new Set(paths)].sort()) {
    const allowed = explicit.includes(path) || (roots.some((prefix) => path.startsWith(`${prefix}/`)) && (extensions.has(extname(path)) || path.endsWith('/package.json')));
    if (!allowed || excluded.test(path)) continue;
    const absolute = safePath(root, path, false);
    if (existsSync(absolute)) files.push({ path, sha256: sha(readFileSync(absolute)) });
  }
  // Root manifests are required even if a repository excludes them from Git accidentally.
  for (const path of explicit.slice(0, 2)) if (!files.some((file) => file.path === path)) fail(`Missing IP manifest: ${path}`);
  return files;
}

function decisionLines(records) {
  if (!records.length) return ['No records supplied.'];
  return records.map((row) => `- ${text(row.date)} · ${text(row.actor)} · ${text(row.kind)}: ${text(row.summary)} Evidence: ${text(row.evidence)}`);
}

/** Build deterministic intake Markdown without inferring ownership, novelty or filing status. */
export function buildPacket(location) {
  const root = realpathSync(location);
  const register = JSON.parse(readFileSync(safePath(root, input), 'utf8'));
  validate(register);
  const files = inventory(root);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const inventorySha = sha(JSON.stringify(files));
  const candidates = register.candidates.map((candidate) => {
    const sources = candidate.sources.map((path) => {
      if (excluded.test(path) || !roots.some((prefix) => path.startsWith(`${prefix}/`)) || !extensions.has(extname(path))) fail(`Unsafe or excluded candidate source: ${path}`);
      safePath(root, path);
      if (!byPath.has(path)) fail(`Excluded/unlisted candidate source: ${path}`);
      return byPath.get(path);
    });
    const evidence = candidate.technicalEvidence.map((path) => {
      if (!path.startsWith('docs/') || extname(path) !== '.md') fail('Unsafe technical evidence path');
      return { path, sha256: sha(readFileSync(safePath(root, path))) };
    });
    // Review binds supplied technical descriptions as well as source/docs, so editing a claim
    // cannot silently keep a previous engineering review current.
    const { review, decisions, ...description } = candidate;
    const digest = sha(JSON.stringify({ description, sources, evidence }));
    return { candidate, sources, evidence, digest };
  });
  const stale = candidates.filter(({ candidate, digest }) => candidate.review && candidate.review.sourceSha256 !== digest).length;
  const pending = register.rightsChecklist.filter((row) => row.status !== 'counsel-reviewed').length;
  const lines = [
    '<!-- Generated internal counsel intake evidence. Run pnpm ip:sync; edit the register, never this file. -->',
    `# ${text(register.project)} — intellectual property counsel packet`, '',
    '**Handling:** internal, owner-approved recipients only. Access controls and legal privilege are not established by this label.', '',
    `**Input record date:** ${text(register.recordDate)}. **Preparation status:** intake draft; legal completeness and permission to present are not established.`, '',
    'This packet contains source fingerprints and supplied investigation notes. It is not a patent/copyright application, legal opinion or proof of company ownership.', '',
    '[Process and presentation checklist](IP_PROTECTION_PLAN.md) · [Input register](ip-register.json) · [Actual work receipts](../agents/IP-01.md)', '',
    '## 1. Current source and open work', '',
    `- Inventory SHA-256: \`${inventorySha}\``,
    `- Register SHA-256: \`${sha(JSON.stringify(register))}\``,
    `- Safe source/manifest files monitored: ${files.length}. Git-tracked and non-ignored untracked source; excluded files require separate human review.`,
    `- Investigation candidates: ${candidates.length}; missing engineering reviews: ${candidates.filter(({ candidate }) => !candidate.review).length}; stale engineering reviews: ${stale}.`,
    `- Rights categories awaiting counsel review: ${pending}.`,
    `- Supplied filing receipts: ${register.filings.length}. Receipt entries require independent verification; no legal status is inferred.`,
    `- Jurisdiction assumption: ${text(register.jurisdictionAssumption)}`, '',
    'A changed inventory requires Documentation/feature-owner review for new capabilities, licenses and source scope. Byte currency alone does not validate technical descriptions, human contributions or legal conclusions.', '',
    '| Monitored area | Files |', '| --- | --- |',
    ...roots.map((prefix) => `| ${prefix}/ | ${files.filter((file) => file.path.startsWith(`${prefix}/`)).length} |`), '',
    '## 2. Technical investigation disclosures', '',
    'These candidates are questions to investigate. None has an established novelty, patentability or freedom-to-operate finding from this generator.', ''
  ];
  for (const { candidate: c, sources, evidence, digest } of candidates) {
    lines.push(`### ${text(c.id)} — ${text(c.title)}`, '', `**Feature owner:** ${text(c.owner)}`, '',
      `Candidate source SHA-256: \`${digest}\``, '',
      `**Review state:** ${!c.review ? 'No engineering review supplied.' : c.review.sourceSha256 === digest ? 'Current recorded engineering review; legal acceptance remains separate.' : 'STALE engineering review: source, references or description changed; feature owner must revalidate.'}`, '');
    if (c.review) lines.push(`Recorded review: ${text(c.review.date)} · ${text(c.review.reviewer)} · bound to \`${c.review.sourceSha256}\`. Evidence: ${text(c.review.evidence)}`, '');
    for (const [label, field] of [['Problem', 'problem'], ['Baseline / prior approaches', 'baseline'], ['Mechanism to trace', 'mechanism'], ['Alternatives to compare', 'alternatives'], ['Evidence limits', 'limitations'], ['Human contributions / ownership', 'humanContributions']]) lines.push(`**${label}:** ${text(c[field])}`, '');
    lines.push('| Source / reading reference | SHA-256 |', '| --- | --- |',
      ...[...sources, ...evidence].map((file) => `| ${link(file.path)} | \`${file.sha256}\` |`), '',
      'References are source reading locations, not evidence that tests or counsel review ran.', '',
      '**Counsel questions:**', '', ...c.counselQuestions.map((q) => `- ${text(q)}`), '',
      '**Recorded candidate decisions:**', '', ...decisionLines(c.decisions), '');
  }
  lines.push('## 3. Copyright, ownership and other protection checklist', '',
    '| ID / material | Supplied status | Required evidence / next work |', '| --- | --- | --- |',
    ...register.rightsChecklist.map((row) => `| ${text(row.id)} — ${text(row.category)} | ${text(row.status)} | ${text(row.needed)}${row.status === 'pending' ? '' : ` Review: ${text(row.date)} · ${text(row.reviewer)} · ${text(row.evidence)}`} |`), '',
    'Company possession is not ownership. Identify human-authored material and AI assistance; verify assignments, exclusions, licensed components, notices and school/user media rights with counsel.', '',
    '### Manifest and dependency reading inventory', '',
    'Names/versions are source observations, not a license audit. Transitive dependencies and notices must be reviewed against the lockfile; URLs/non-semver references are withheld from this summary.', '',
    '| Manifest | SHA-256 | Direct dependency observations |', '| --- | --- | --- |');
  for (const file of files.filter((entry) => entry.path.endsWith('package.json'))) {
    const manifest = JSON.parse(readFileSync(safePath(root, file.path), 'utf8'));
    const deps = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies };
    const summary = Object.entries(deps).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, version]) => `${text(name)} (${typeof version === 'string' && /^(?:workspace:)?[~^<>=\d.*| +x-]+$/.test(version) ? text(version) : 'non-semver reference; review privately'})`).join('; ') || 'None declared';
    lines.push(`| ${link(file.path)} | \`${file.sha256}\` | ${summary} |`);
  }
  lines.push('', '## 4. Disclosure history', '', ...decisionLines(register.disclosureEvents), '',
    'Owner statements require factual confirmation. Preserve earlier events and corrections; counsel evaluates public/private disclosure, offers/sales and jurisdiction-specific effects.', '',
    '## 5. Recorded protection decisions', '', ...decisionLines(register.decisions), '',
    '## 6. Filing receipts and counsel docket', '');
  if (!register.filings.length) lines.push('No filing receipts supplied. No filed, patent-pending, granted or registered status is established.');
  for (const row of register.filings) lines.push(`- ${text(row.date)} · ${text(row.type)} · ${text(row.jurisdiction)} · receipt: ${text(row.receiptReference)} · applicant/assignee: ${text(row.applicant)} · contributor identification: ${text(row.contributors)} · docket owner: ${text(row.docketOwner)}. Evidence: ${text(row.evidence)}${row.deadline ? ` Supplied follow-up: ${text(row.deadline)}; counsel must verify.` : ''}`);
  lines.push('', 'Counsel controls actual deadlines and verifies receipts; this file is not a legal docket or an automatic filing service.', '',
    '## 7. Questions for counsel', '', ...register.counselQuestions.map((q) => `- ${text(q)}`), '',
    '## 8. Presentation gate', '',
    'Before presenting: verify authorized recipients/private storage; refresh and freeze source; obtain feature-owner semantic and contribution/rights reviews; check disclosure history; record actual counsel and owner decisions. Use the full checklist in the process plan. Unknowns remain visible.', '',
    'Copyright/design/trademark deposits, patent claims/forms and signed assignments are prepared and approved separately with qualified counsel. No source, credentials, customer/minor data or private legal correspondence is automatically exported by this tool.', '');
  return lines.join('\n');
}

/** Sync one fixed output atomically, or check currency without writing anything. */
export function run(location, check = false) {
  const root = realpathSync(location);
  const target = safePath(root, output, false);
  const markdown = buildPacket(root);
  if (check) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== markdown) fail('IP packet is stale or missing. Run pnpm ip:sync, review changed scope, then pnpm ip:check.');
    return 'IP packet source currency and structure PASS; legal reviews remain separate.';
  }
  if (existsSync(target) && readFileSync(target, 'utf8') === markdown) return 'IP packet already current.';
  const temporary = join(dirname(target), `.ip-packet-${process.pid}.tmp`);
  try {
    writeFileSync(temporary, markdown, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, target);
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  return 'IP packet refreshed; review changed scope and all pending legal evidence.';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--check')) fail('Usage: node scripts/ip-docs.mjs [--check]');
    console.log(run(process.cwd(), args.includes('--check')));
  } catch (error) { console.error(`IP documentation error: ${error.message}`); process.exitCode = 1; }
}
