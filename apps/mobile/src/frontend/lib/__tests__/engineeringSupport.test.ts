/**
 * DETECT-02 support model safety: source evidence survives grouping, reviews expire on a
 * new occurrence, and client reports never prove an attack or authorize a money repair.
 */
import {
  applicableSupportReview, canAutomaticallyRecover, classifySupportSignal, groupSupportSignals,
  parseEngineeringSupportSnapshot, safeSupportCode, safeSupportFeature, safeSupportRelease,
  supportFingerprint, type EngineeringSupportSnapshot, type SupportReview, type SupportSignal,
} from '@tapuai/shared-types/admin/engineeringSupport';

const T0 = '2026-10-13T10:00:00.000Z';
const T1 = '2026-10-13T11:00:00.000Z';
const T2 = '2026-10-13T12:00:00.000Z';
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const signal = (patch: Partial<SupportSignal> = {}): SupportSignal => {
  const row: SupportSignal = { id: A, fingerprint: '', feature: 'highlights', code: 'render_failure', category: 'ui', severity: 'error', source: 'client', environment: 'test', release: 'detect-02', occurred_at: T0, actor_id: A, ...patch };
  row.fingerprint = supportFingerprint(row);
  return row;
};
const review = (row: SupportSignal, patch: Partial<SupportReview> = {}): SupportReview => ({ id: B, fingerprint: row.fingerprint, disposition: 'resolved', rationale: 'Verified rendering repair in preview.', reviewed_through: row.occurred_at, actor_id: A, created_at: T1, decision: 'confirmed', parent_review_id: null, ...patch });
const snapshot = (): EngineeringSupportSnapshot => ({ version: 1, read_at: T2, signals: [signal()], reviews: [], audit: [], releases: [], limits: { signals: 200, reviews: 300, audit: 200, releases: 20 } });

describe('fixed support vocabulary', () => {
  it('accepts product feature names and rejects routes, personal data and arbitrary error strings', () => {
    expect(safeSupportFeature('donation')).toBe('donation');
    expect(safeSupportFeature('/profile/private-user')).toBeNull();
    expect(safeSupportCode('Bearer private-token')).toBeNull();
    expect(safeSupportRelease('detect-02')).toBe('detect-02');
    expect(safeSupportRelease('https://host?token=private')).toBeNull();
    expect(safeSupportRelease('a'.repeat(81))).toBeNull();
  });
  it('separates fingerprints by release, environment and source', () => {
    const base = signal();
    expect(base.fingerprint).toBe('highlights:render_failure:client:test:detect-02');
    for (const patch of [{ release: 'next' }, { environment: 'production' as const }, { source: 'server' as const }, { feature: 'profile' as const }]) {
      expect(supportFingerprint({ ...base, ...patch })).not.toBe(base.fingerprint);
    }
  });
});

describe('classification and review authority', () => {
  it.each(['user_cancelled', 'auth_expired', 'recovery_succeeded'] as const)('classifies expected %s without calling it an attack', (code) => {
    expect(classifySupportSignal(signal({ code, category: 'runtime', severity: 'info' })).kind).toBe('expected');
  });
  it('keeps a user report separate from detected runtime and syntax failures', () => {
    expect(classifySupportSignal(signal({ code: 'user_report', category: 'user_report' })).kind).toBe('user_report');
    expect(classifySupportSignal(signal({ code: 'syntax_check_failed', category: 'syntax', source: 'check' })).kind).toBe('issue');
  });
  it('treats security capture and high volume as suspicious until independent evidence is reviewed', () => {
    const suspicious = signal({ code: 'suspicious_pattern', category: 'security', source: 'security' });
    expect(classifySupportSignal(suspicious).kind).toBe('suspicious');
    expect(classifySupportSignal(signal({ code: 'confirmed_attack', category: 'security', source: 'client' })).kind).toBe('suspicious');
    expect(classifySupportSignal(signal({ code: 'confirmed_attack', category: 'security', source: 'security' })).kind).toBe('suspicious');
  });
  it('requires an explicit security code, covered occurrence and two distinct reviewers before confirming an attack', () => {
    const row = signal({ code: 'confirmed_attack', category: 'security', source: 'security' });
    const first = review(row, { disposition: 'confirmed_attack', decision: 'pending' });
    const second = review(row, { id: '33333333-3333-3333-3333-333333333333', disposition: 'confirmed_attack', actor_id: B, parent_review_id: first.id, created_at: T2 });
    expect(classifySupportSignal(row, second, [first, second]).kind).toBe('confirmed_attack');
    expect(classifySupportSignal(row, { ...second, actor_id: A }, [first, second]).kind).toBe('suspicious');
    expect(classifySupportSignal({ ...row, source: 'client' }, second, [first, second]).kind).toBe('suspicious');
    expect(classifySupportSignal({ ...row, occurred_at: '2026-10-13T13:00:00.000Z' }, second, [first, second]).kind).toBe('suspicious');
  });
});

describe('grouping and reviewed occurrence coverage', () => {
  it('groups repeated occurrences, ignores snapshot replay and retains both source records', () => {
    const first = signal();
    const next = signal({ id: B, occurred_at: T1 });
    const groups = groupSupportSignals([next, first, first], [], T2);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ count: 2, recentCount: 2, firstOccurredAt: T0, lastOccurredAt: T1, state: 'open' });
    expect(groups[0].occurrences.map((row) => row.id)).toEqual([A, B]);
    expect(groupSupportSignals([first, signal({ source: 'server', id: B })], [])).toHaveLength(2);
  });
  it('does not merge releases/environments or erase old evidence outside the recent count', () => {
    const old = signal({ occurred_at: '2026-10-01T10:00:00.000Z' });
    expect(groupSupportSignals([old], [], T2)[0]).toMatchObject({ count: 1, recentCount: 0 });
    expect(groupSupportSignals([old, signal({ release: 'next', id: B }), signal({ environment: 'production', id: '33333333-3333-3333-3333-333333333333' })], [])).toHaveLength(3);
  });
  it('keeps a reviewed issue reviewed on replay and reopens it on a new occurrence', () => {
    const first = signal();
    const done = review(first);
    const reviewed = groupSupportSignals([first, first], [done])[0];
    expect(reviewed.state).toBe('reviewed');
    expect(applicableSupportReview(reviewed, [done])).toEqual(done);
    const reopened = groupSupportSignals([first, signal({ id: B, occurred_at: T2 })], [done])[0];
    expect(reopened.state).toBe('open');
    expect(reopened.review).toBeNull();
  });
  it('reopens on a PostgreSQL occurrence one microsecond after the reviewed boundary regardless of UUID order', () => {
    const first = signal({ id: B, occurred_at: '2026-10-13T10:00:00.123455+00:00' });
    const next = signal({ id: A, occurred_at: '2026-10-13T10:00:00.123456+00:00' });
    const done = review(first);
    const reopened = groupSupportSignals([next, first], [done])[0];
    expect(reopened.lastOccurredAt).toBe(next.occurred_at);
    expect(reopened.state).toBe('open');
    expect(reopened.review).toBeNull();
  });
  it('orders review decisions at database precision and treats equivalent time zones as the same instant', () => {
    const row = signal({ occurred_at: '2026-10-13T10:00:00.123455Z' });
    const older = review(row, { id: B, created_at: '2026-10-13T11:00:00.123455+00:00' });
    const newer = review(row, { id: A, created_at: '2026-10-13T07:00:00.123456-04:00', disposition: 'investigating' });
    expect(groupSupportSignals([row], [newer, older])[0].review).toEqual(newer);
  });
  it('leaves protected reviews pending without a distinct matching parent reviewer', () => {
    const row = signal({ code: 'payment_failed', category: 'finance', feature: 'donation' });
    const pending = review(row, { decision: 'pending', disposition: 'false_positive' });
    const wrong = review(row, { id: '33333333-3333-3333-3333-333333333333', parent_review_id: pending.id, disposition: 'false_positive', created_at: T2 });
    expect(groupSupportSignals([row], [pending])[0].state).toBe('review_pending');
    expect(groupSupportSignals([row], [pending, wrong])[0].state).toBe('review_pending');
    expect(groupSupportSignals([row], [pending, { ...wrong, actor_id: B }])[0].state).toBe('reviewed');
  });
});

describe('safe recovery policy', () => {
  it('allows only one transient read retry outside protected feature domains', () => {
    expect(canAutomaticallyRecover({ category: 'network', feature: 'highlights', operation: 'read', transient: true, attempts: 0 })).toBe(true);
    expect(canAutomaticallyRecover({ category: 'network', feature: 'highlights', operation: 'read', transient: true, attempts: 1 })).toBe(false);
    expect(canAutomaticallyRecover({ category: 'data', feature: 'highlights', operation: 'read', transient: false, attempts: 0 })).toBe(false);
  });
  it.each(['payment', 'ledger', 'refund', 'payout', 'authorization', 'publish', 'delete', 'write', 'render'] as const)('never repeats %s automatically', (operation) => {
    expect(canAutomaticallyRecover({ category: 'network', feature: 'highlights', operation, transient: true, attempts: 0 })).toBe(false);
  });
  it.each([{ category: 'finance', feature: 'highlights' }, { category: 'security', feature: 'highlights' }, { category: 'network', feature: 'donation' }, { category: 'network', feature: 'auth' }, { category: 'network', feature: 'payouts' }] as const)('denies money/access recovery even after false-positive review: %s', (scope) => {
    expect(canAutomaticallyRecover({ ...scope, operation: 'read', transient: true, attempts: 0 })).toBe(false);
  });
});

describe('bounded snapshot parsing', () => {
  it('accepts actual uppercase PostgreSQL trigger operations and keeps values out of the audit', () => {
    const audit = { id: B, actor_id: A, actor_role: 'admin', occurred_at: T1, operation: 'UPDATE', table_name: 'app_runtime_config', record_id: A,
      changed_fields: ['updated_at', 'flags'], previous_hash: null, event_hash: 'a'.repeat(64) };
    expect(parseEngineeringSupportSnapshot({ ...snapshot(), audit: [audit] }).audit).toEqual([audit]);
    expect(() => parseEngineeringSupportSnapshot({ ...snapshot(), audit: [{ ...audit, operation: 'DROP' }] })).toThrow();
  });
  it.each(['2026-02-30T12:00:00Z', '2026-10-13T24:00:00Z'])('rejects calendar/time normalization masquerading as a timestamp: %s', (read_at) => {
    expect(() => parseEngineeringSupportSnapshot({ ...snapshot(), read_at })).toThrow();
  });
  it('accepts the exact RPC wire shape and strips extra payload fields', () => {
    const input = snapshot();
    const parsed = parseEngineeringSupportSnapshot({ ...input, signals: [{ ...input.signals[0], message: 'private error', stack: 'private stack' }] });
    expect(parsed).toEqual(input);
    expect(parsed.signals[0]).not.toHaveProperty('message');
  });
  it.each([{}, { ...snapshot(), reviews: undefined }, { ...snapshot(), audit: {} }, { ...snapshot(), version: 2 }, { ...snapshot(), read_at: 'tomorrow' }, { ...snapshot(), signals: [{ ...signal(), fingerprint: 'wrong' }] }, { ...snapshot(), signals: [{ ...signal(), category: 'unknown' }] }, { ...snapshot(), signals: Array(201).fill(signal()) }])('refuses unavailable, partial or malformed snapshots %#', (input) => {
    expect(() => parseEngineeringSupportSnapshot(input)).toThrow('Support snapshot is unavailable or malformed.');
  });
  it('validates operator-reported recovery metadata without treating it as deployment evidence', () => {
    const manifest = { version: 1 as const, releaseId: 'detect-02', createdAt: T0, gitCommit: null, treeHash: 'a'.repeat(64), manifestHash: 'b'.repeat(64), capsuleHash: 'c'.repeat(64), provenanceHash: 'e'.repeat(64), filesCount: 1, byteCount: 9, verification: 'passed' as const, schemaHash: null, migrationHashes: [{ path: 'supabase/migrations/20261013190000_engineering_support.sql', sha256: 'd'.repeat(64) }] };
    const input = { ...snapshot(), releases: [{ id: B, actor_id: A, created_at: T1, manifest }] };
    expect(parseEngineeringSupportSnapshot(input).releases[0].manifest.verification).toBe('passed');
    expect(() => parseEngineeringSupportSnapshot({ ...input, releases: [{ ...input.releases[0], manifest: { ...manifest, migrationHashes: [{ path: '../private.sql', sha256: 'd'.repeat(64) }] } }] })).toThrow();
    expect(() => parseEngineeringSupportSnapshot({ ...input, releases: [{ ...input.releases[0], manifest: { ...manifest, filesCount: -1 } }] })).toThrow();
    expect(() => parseEngineeringSupportSnapshot({ ...input, releases: [{ ...input.releases[0], manifest: { ...manifest, provenanceHash: undefined } }] })).toThrow();
    expect(parseEngineeringSupportSnapshot({ ...input, releases: [{ ...input.releases[0], manifest: { ...manifest, byteCount: 10737418240 } }] }).releases[0].manifest.byteCount).toBe(10737418240);
    for (const patch of [{ filesCount: 0 }, { byteCount: 10737418241 }, { migrationHashes: [...manifest.migrationHashes, ...manifest.migrationHashes] }, { migrationHashes: [{ path: 'supabase/migrations/20261013_support.sql', sha256: 'd'.repeat(64) }] }, { releaseId: 'private.label' }]) {
      expect(() => parseEngineeringSupportSnapshot({ ...input, releases: [{ ...input.releases[0], manifest: { ...manifest, ...patch } }] })).toThrow();
    }
  });
});
