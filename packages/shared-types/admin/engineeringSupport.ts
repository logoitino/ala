/**
 * Engineering Support wire model and safety rules for the main admin console (DETECT-02).
 * Keep client assertions untrusted, retain occurrence evidence, and never infer permission
 * to repair money or access from an issue disposition. No raw error payload belongs here.
 */

export const SUPPORT_FEATURES = {
  app: { label: 'App', sensitivity: 'general' }, highlights: { label: 'Highlights', sensitivity: 'general' },
  activity: { label: 'Activity', sensitivity: 'general' }, local: { label: 'Local', sensitivity: 'general' },
  spotlight: { label: 'Spotlight', sensitivity: 'general' }, drip: { label: 'Drip', sensitivity: 'general' },
  profile: { label: 'Profile', sensitivity: 'general' }, auth: { label: 'Sign in', sensitivity: 'security' },
  donation: { label: 'Donate', sensitivity: 'finance' }, payouts: { label: 'Payouts', sensitivity: 'finance' },
  operator: { label: 'Operator', sensitivity: 'general' }, upload: { label: 'Upload', sensitivity: 'general' },
  admin: { label: 'Admin', sensitivity: 'security' }, support: { label: 'Engineering Support', sensitivity: 'security' },
} as const;
export type SupportFeature = keyof typeof SUPPORT_FEATURES;
export type SupportCategory = 'ui' | 'runtime' | 'network' | 'data' | 'finance' | 'security' | 'syntax' | 'user_report';
export type SupportSeverity = 'info' | 'warning' | 'error' | 'critical';
export type SupportSource = 'client' | 'server' | 'security' | 'check';
export type SupportEnvironment = 'development' | 'test' | 'preview' | 'production';
export type SupportDisposition = 'investigating' | 'expected' | 'false_positive' | 'resolved' | 'confirmed_attack';
export type SupportReviewDecision = 'pending' | 'confirmed';
export type SupportOperation = 'read' | 'render' | 'payment' | 'ledger' | 'refund' | 'payout' | 'authorization' | 'publish' | 'delete' | 'write';

export const SUPPORT_CODES = {
  render_failure: { category: 'ui', severity: 'error', client: true },
  runtime_failure: { category: 'runtime', severity: 'error', client: true },
  unhandled_rejection: { category: 'runtime', severity: 'error', client: true },
  read_timeout: { category: 'network', severity: 'warning', client: true },
  network_unavailable: { category: 'network', severity: 'warning', client: true },
  read_failed: { category: 'data', severity: 'error', client: true },
  user_cancelled: { category: 'ui', severity: 'info', client: true },
  auth_expired: { category: 'runtime', severity: 'info', client: true },
  data_invalid: { category: 'data', severity: 'error', client: true },
  payment_failed: { category: 'finance', severity: 'error', client: true },
  access_denied: { category: 'security', severity: 'warning', client: true },
  suspicious_pattern: { category: 'security', severity: 'warning', client: true },
  confirmed_attack: { category: 'security', severity: 'critical', client: false },
  syntax_check_failed: { category: 'syntax', severity: 'error', client: false },
  user_report: { category: 'user_report', severity: 'warning', client: true },
  recovery_succeeded: { category: 'runtime', severity: 'info', client: true },
  recovery_failed: { category: 'runtime', severity: 'error', client: true },
  auth_invalid: { category: 'security', severity: 'warning', client: false },
  auth_unavailable: { category: 'network', severity: 'error', client: false },
  server_configuration_error: { category: 'runtime', severity: 'critical', client: false },
} as const satisfies Record<string, { category: SupportCategory; severity: SupportSeverity; client: boolean }>;
export type SupportCode = keyof typeof SUPPORT_CODES;
export type ClientSupportCode = { [K in SupportCode]: typeof SUPPORT_CODES[K]['client'] extends true ? K : never }[SupportCode];

export type SupportScope = { feature: SupportFeature; code: SupportCode; source: SupportSource; environment: SupportEnvironment; release: string };
export type SupportSignal = SupportScope & {
  id: string; fingerprint: string; category: SupportCategory; severity: SupportSeverity; occurred_at: string; actor_id: string | null;
};
export type SupportReview = {
  id: string; fingerprint: string; disposition: SupportDisposition; rationale: string; reviewed_through: string;
  actor_id: string; created_at: string; decision: SupportReviewDecision; parent_review_id: string | null;
};
export type SupportAudit = {
  id: string; actor_id: string | null; actor_role: string; occurred_at: string; operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string; record_id: string; changed_fields: string[]; previous_hash: string | null; event_hash: string;
};
export type SupportReleaseManifest = {
  version: 1; releaseId: string; createdAt: string; gitCommit: string | null;
  treeHash: string; manifestHash: string; capsuleHash: string; provenanceHash: string; filesCount: number; byteCount: number;
  /** Operator-reported local verification, never proof of a signer, hosted deployment or database state. */
  verification: 'not-run' | 'passed'; schemaHash: string | null; migrationHashes: { path: string; sha256: string }[];
};
export type SupportRelease = { id: string; actor_id: string; created_at: string; manifest: SupportReleaseManifest };
export type EngineeringSupportSnapshot = {
  version: 1; read_at: string; signals: SupportSignal[]; reviews: SupportReview[]; audit: SupportAudit[]; releases: SupportRelease[];
  limits: { signals: number; reviews: number; audit: number; releases: number };
};
export type SupportClassification = {
  kind: 'expected' | 'issue' | 'user_report' | 'suspicious' | 'confirmed_attack'; reason: string; trusted: boolean;
};
export type SupportSignalGroup = SupportScope & {
  fingerprint: string; category: SupportCategory; severity: SupportSeverity; firstOccurredAt: string; lastOccurredAt: string;
  occurrences: SupportSignal[]; count: number; recentCount: number; review: SupportReview | null;
  state: 'open' | 'review_pending' | 'reviewed'; classification: SupportClassification;
};

const owns = (object: object, key: unknown): key is string => typeof key === 'string' && Object.prototype.hasOwnProperty.call(object, key);
export const safeSupportFeature = (value: unknown): SupportFeature | null => owns(SUPPORT_FEATURES, value) ? value as SupportFeature : null;
export const safeSupportCode = (value: unknown): SupportCode | null => owns(SUPPORT_CODES, value) ? value as SupportCode : null;
/** Release IDs are public build labels only; never pass a URL, user identifier or arbitrary diagnostic string. */
export const safeSupportRelease = (value: unknown): string | null => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value) ? value : null;
export const safeSupportEnvironment = (value: unknown): SupportEnvironment | null =>
  ['development', 'test', 'preview', 'production'].includes(value as string) ? value as SupportEnvironment : null;

/** Source is part of the key so client assertions cannot inherit a server/security review. Matches the SQL RPC. */
export function supportFingerprint(scope: SupportScope): string {
  return `${scope.feature}:${scope.code}:${scope.source}:${scope.environment}:${scope.release}`;
}

const millis = (value: string) => Date.parse(value);
// PostgreSQL records distinct occurrences a microsecond apart. Date.parse alone would silently
// grant an older review to the new occurrence, so keep the last three fractional digits too.
const micros = (value: string): bigint => BigInt(millis(value)) * 1000n + BigInt((/\.(\d+)/.exec(value)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
const compareTime = (a: string, b: string): number => micros(a) < micros(b) ? -1 : micros(a) > micros(b) ? 1 : 0;
const protectedScope = (scope: { category: SupportCategory; feature: SupportFeature }) =>
  scope.category === 'finance' || scope.category === 'security' || SUPPORT_FEATURES[scope.feature].sensitivity !== 'general';
const covered = (through: string, occurrence: string) => compareTime(through, occurrence) >= 0;

function validConfirmedReview(scope: { category: SupportCategory; feature: SupportFeature; fingerprint: string }, candidate: SupportReview, reviews: readonly SupportReview[]): boolean {
  if (candidate.fingerprint !== scope.fingerprint || candidate.decision !== 'confirmed') return false;
  if (candidate.disposition === 'investigating' || !protectedScope(scope)) return true;
  const parent = reviews.find((row) => row.id === candidate.parent_review_id);
  return Boolean(parent && parent.decision === 'pending' && parent.fingerprint === candidate.fingerprint &&
    parent.disposition === candidate.disposition && compareTime(parent.reviewed_through, candidate.reviewed_through) === 0 &&
    parent.actor_id !== candidate.actor_id && parent.id !== candidate.id && compareTime(parent.created_at, candidate.created_at) < 0);
}

/**
 * @purpose Return the latest review that still covers the last occurrence, including pending reviews.
 * A bounded snapshot may omit an approval parent; in that case the caller must show pending evidence.
 */
export function applicableSupportReview(group: Pick<SupportSignalGroup, 'fingerprint' | 'lastOccurredAt'>, reviews: readonly SupportReview[]): SupportReview | null {
  const latest = reviews.filter((row) => row.fingerprint === group.fingerprint)
    .sort((a, b) => compareTime(b.created_at, a.created_at) || b.id.localeCompare(a.id))[0];
  return latest && covered(latest.reviewed_through, group.lastOccurredAt) ? latest : null;
}

/** @purpose Separate expected outcomes, user reports, failures and reviewed threats without inferring an attack from volume/origin. */
export function classifySupportSignal(signal: SupportSignal, review: SupportReview | null = null, reviews: readonly SupportReview[] = []): SupportClassification {
  const trusted = signal.source !== 'client';
  const accepted = review && covered(review.reviewed_through, signal.occurred_at) && validConfirmedReview(signal, review, reviews);
  if (signal.category === 'security' || signal.code === 'confirmed_attack' || signal.code === 'suspicious_pattern' || signal.code === 'auth_invalid') {
    if (signal.source === 'security' && signal.code === 'confirmed_attack' && accepted && review.disposition === 'confirmed_attack') {
      return { kind: 'confirmed_attack', reason: 'Trusted security evidence has two distinct reviewers.', trusted };
    }
    if (accepted && ['expected', 'false_positive'].includes(review.disposition)) {
      return { kind: 'expected', reason: 'Security reviewers marked the covered evidence expected or false positive.', trusted };
    }
    return { kind: 'suspicious', reason: trusted ? 'Security review is needed; a signal alone does not confirm an attack.' : 'Untrusted client assertion; Security review is needed.', trusted };
  }
  if (['user_cancelled', 'auth_expired', 'recovery_succeeded'].includes(signal.code) || accepted && ['expected', 'false_positive'].includes(review.disposition)) {
    return { kind: 'expected', reason: signal.code === 'auth_expired' ? 'Sign in expired; this alone is not an attack.' : 'Expected outcome or reviewed false positive.', trusted };
  }
  if (signal.category === 'user_report') return { kind: 'user_report', reason: 'A person reported an issue; reproduction is still needed.', trusted };
  return { kind: 'issue', reason: 'A detected failure needs owner review and verification.', trusted };
}

/**
 * @purpose Collapse duplicate display rows without losing source evidence. Counts are for this bounded snapshot.
 * @param now Reference time for a 24-hour recent count; all supplied older occurrences remain in the group.
 */
export function groupSupportSignals(signals: readonly SupportSignal[], reviews: readonly SupportReview[], now: string | number = Date.now()): SupportSignalGroup[] {
  const groups = new Map<string, SupportSignalGroup>();
  const seen = new Set<string>();
  const nowMs = typeof now === 'number' ? now : millis(now);
  for (const signal of signals) {
    if (seen.has(signal.id)) continue;
    seen.add(signal.id);
    const key = supportFingerprint(signal);
    let group = groups.get(key);
    if (!group) {
      group = { feature: signal.feature, code: signal.code, source: signal.source, environment: signal.environment, release: signal.release,
        fingerprint: key, category: signal.category, severity: signal.severity, firstOccurredAt: signal.occurred_at, lastOccurredAt: signal.occurred_at,
        occurrences: [], count: 0, recentCount: 0, review: null, state: 'open', classification: classifySupportSignal(signal) };
      groups.set(key, group);
    }
    group.occurrences.push(signal);
    group.count += 1;
    if (millis(signal.occurred_at) >= nowMs - 86_400_000 && millis(signal.occurred_at) <= nowMs) group.recentCount += 1;
  }
  for (const group of groups.values()) {
    group.occurrences.sort((a, b) => compareTime(a.occurred_at, b.occurred_at) || a.id.localeCompare(b.id));
    group.firstOccurredAt = group.occurrences[0].occurred_at;
    const latest = group.occurrences[group.occurrences.length - 1];
    group.lastOccurredAt = latest.occurred_at;
    group.review = applicableSupportReview(group, reviews);
    if (group.review) group.state = validConfirmedReview(group, group.review, reviews) ? 'reviewed' : 'review_pending';
    group.classification = classifySupportSignal(latest, group.review, reviews);
  }
  return [...groups.values()].sort((a, b) => compareTime(b.lastOccurredAt, a.lastOccurredAt) || a.fingerprint.localeCompare(b.fingerprint));
}

/** The DETECT-02 recovery contract permits one transient read retry. No review can override this policy. */
export function canAutomaticallyRecover(input: { category: SupportCategory; feature: SupportFeature; operation: SupportOperation; transient: boolean; attempts: number }): boolean {
  return input.operation === 'read' && input.transient === true && input.attempts === 0 && !protectedScope(input);
}

const fail = (): never => { throw new Error('Support snapshot is unavailable or malformed.'); };
const obj = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const str = (value: unknown, max = 320): string => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : fail();
const uuid = (value: unknown): string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : fail();
const nullableUuid = (value: unknown): string | null => value === null ? null : uuid(value);
const hash = (value: unknown, length = 64): string => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value) ? value : fail();
const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum ? value : fail();
const oneOf = <T extends string>(value: unknown, values: readonly T[]): T => typeof value === 'string' && values.includes(value as T) ? value as T : fail();
function timestamp(value: unknown): string {
  const text = str(value, 40);
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(text);
  // Date.parse normalizes nonexistent dates; verify the calendar portion before accepting a database timestamp.
  if (!match || !Number.isFinite(millis(text)) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return fail();
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (date.toISOString().slice(0, 10) !== match[1]) return fail();
  return text;
}
function collection<T>(value: unknown, max: number, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) return fail();
  return value.map(parse);
}
function parseSignal(value: unknown): SupportSignal {
  const row = obj(value);
  const feature = safeSupportFeature(row.feature) ?? fail();
  const code = safeSupportCode(row.code) ?? fail();
  const environment = safeSupportEnvironment(row.environment) ?? fail();
  const release = safeSupportRelease(row.release) ?? fail();
  const source = oneOf(row.source, ['client', 'server', 'security', 'check'] as const);
  const rule = SUPPORT_CODES[code];
  if (row.category !== rule.category || row.severity !== rule.severity || source === 'client' && !rule.client || code === 'confirmed_attack' && source !== 'security') return fail();
  const result: SupportSignal = { id: uuid(row.id), fingerprint: str(row.fingerprint, 240), feature, code, category: rule.category, severity: rule.severity,
    source, environment, release, occurred_at: timestamp(row.occurred_at), actor_id: nullableUuid(row.actor_id) };
  if (result.fingerprint !== supportFingerprint(result)) return fail();
  return result;
}
function parseReview(value: unknown): SupportReview {
  const row = obj(value);
  const parsed: SupportReview = { id: uuid(row.id), fingerprint: str(row.fingerprint, 240),
    disposition: oneOf(row.disposition, ['investigating', 'expected', 'false_positive', 'resolved', 'confirmed_attack'] as const), rationale: str(row.rationale, 1000),
    reviewed_through: timestamp(row.reviewed_through), actor_id: uuid(row.actor_id), created_at: timestamp(row.created_at),
    decision: oneOf(row.decision, ['pending', 'confirmed'] as const), parent_review_id: nullableUuid(row.parent_review_id) };
  if (compareTime(parsed.reviewed_through, parsed.created_at) > 0) return fail();
  return parsed;
}
function parseAudit(value: unknown): SupportAudit {
  const row = obj(value);
  const identifier = (value: unknown) => { const text = str(value, 100); return /^[a-z][a-z0-9_]*$/.test(text) ? text : fail(); };
  return { id: uuid(row.id), actor_id: nullableUuid(row.actor_id), actor_role: identifier(row.actor_role), occurred_at: timestamp(row.occurred_at),
    operation: oneOf(row.operation, ['INSERT', 'UPDATE', 'DELETE'] as const), table_name: identifier(row.table_name), record_id: str(row.record_id, 100),
    changed_fields: collection(row.changed_fields, 100, identifier), previous_hash: row.previous_hash === null ? null : hash(row.previous_hash), event_hash: hash(row.event_hash) };
}
function parseRelease(value: unknown): SupportRelease {
  const row = obj(value); const manifest = obj(row.manifest);
  if (manifest.version !== 1) return fail();
  const releaseId = safeSupportRelease(manifest.releaseId) ?? fail();
  const createdAt = timestamp(manifest.createdAt);
  const filesCount = integer(manifest.filesCount, 100_000);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(releaseId) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(createdAt) || filesCount === 0) return fail();
  const migrationHashes = collection(manifest.migrationHashes, 1000, (value) => {
    const migration = obj(value); const path = str(migration.path, 240);
    if (!/^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/.test(path)) return fail();
    return { path, sha256: hash(migration.sha256) };
  });
  if (new Set(migrationHashes.map((migration) => migration.path)).size !== migrationHashes.length) return fail();
  return { id: uuid(row.id), actor_id: uuid(row.actor_id), created_at: timestamp(row.created_at), manifest: {
    version: 1, releaseId, createdAt,
    gitCommit: manifest.gitCommit === null ? null : hash(manifest.gitCommit, 40), treeHash: hash(manifest.treeHash), manifestHash: hash(manifest.manifestHash), capsuleHash: hash(manifest.capsuleHash), provenanceHash: hash(manifest.provenanceHash),
    filesCount, byteCount: integer(manifest.byteCount, 10_737_418_240), verification: oneOf(manifest.verification, ['not-run', 'passed'] as const),
    schemaHash: manifest.schemaHash === null ? null : hash(manifest.schemaHash), migrationHashes,
  } };
}

/**
 * @purpose Validate the bounded RPC response, selecting only permitted fields. Malformed/missing collections
 * must show an unavailable source rather than inventing an empty healthy result.
 */
export function parseEngineeringSupportSnapshot(value: unknown): EngineeringSupportSnapshot {
  const row = obj(value); const limits = obj(row.limits);
  if (row.version !== 1) return fail();
  const parsedLimits = { signals: integer(limits.signals, 200), reviews: integer(limits.reviews, 300), audit: integer(limits.audit, 200), releases: integer(limits.releases, 20) };
  if (Object.values(parsedLimits).some((limit) => limit < 1)) return fail();
  const parsed: EngineeringSupportSnapshot = { version: 1, read_at: timestamp(row.read_at),
    signals: collection(row.signals, parsedLimits.signals, parseSignal), reviews: collection(row.reviews, parsedLimits.reviews, parseReview),
    audit: collection(row.audit, parsedLimits.audit, parseAudit), releases: collection(row.releases, parsedLimits.releases, parseRelease), limits: parsedLimits };
  for (const rows of [parsed.signals, parsed.reviews, parsed.audit, parsed.releases]) {
    if (new Set(rows.map((record) => record.id)).size !== rows.length) return fail();
  }
  if ([...parsed.signals.map((r) => r.occurred_at), ...parsed.reviews.map((r) => r.created_at), ...parsed.audit.map((r) => r.occurred_at), ...parsed.releases.map((r) => r.created_at)].some((time) => compareTime(time, parsed.read_at) > 0)) return fail();
  return parsed;
}
