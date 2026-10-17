/** FUN-01 literal wire fixtures mirror persisted SQL DTO fields; helpers allocate independent test data. */
import type { FanZoneAdminSnapshot, FanZoneSnapshot } from '@shared/fanZone';
export const FUN_IDS = { campaign: '10000000-0000-0000-0000-000000000001', entry: '20000000-0000-0000-0000-000000000001', owner: '30000000-0000-0000-0000-000000000001', admin: '30000000-0000-0000-0000-000000000002', ballot: '40000000-0000-0000-0000-000000000001', case: '50000000-0000-0000-0000-000000000001', audit: '60000000-0000-0000-0000-000000000001', grant: '70000000-0000-0000-0000-000000000001' };
const time = '2026-10-14T06:00:00.000Z';
// Windows stay open relative to the clock so a vote or an "open campaign" check does not expire on a calendar day.
const dayMs = 24 * 60 * 60 * 1000;
const entryOpensAt = new Date(Date.now() - dayMs).toISOString();
const entryClosesAt = new Date(Date.now() + dayMs).toISOString();
const voteOpensAt = entryOpensAt;
const voteClosesAt = new Date(Date.now() + 2 * dayMs).toISOString();
/** @purpose Complete current-campaign Data response, including all historical media and explicit populations. */
export function fanAdminFixture(): FanZoneAdminSnapshot {
 const campaign = { id: FUN_IDS.campaign, title: 'Family cheer', theme: 'A family cheer', period: 'week' as const, status: 'open' as const, testing_only: true as const,
  pilot_accounts: [FUN_IDS.owner, FUN_IDS.admin], entry_opens_at: entryOpensAt, entry_closes_at: entryClosesAt, vote_opens_at: voteOpensAt, vote_closes_at: voteClosesAt, rules: 'Free ballots; ties share recognition.', support_contact: 'pilot@example.invalid', story_reel_id: null, opened_at: time, results: [], recount_required: true, created_at: time, updated_at: time };
 const entry = { id: FUN_IDS.entry, campaign_id: FUN_IDS.campaign, owner_id: FUN_IDS.owner, revision: 2, path: `${FUN_IDS.entry}/2/80000000-0000-0000-0000-000000000002.mp4`, alias: 'Family Fan', caption: 'Our family cheer', rights_confirmed: true, status: 'accepted' as const, reason: null, verified: true, digest: 'a'.repeat(64), bytes: 1024, duration_ms: 1000, removed_at: null, guardian_consent_id: FUN_IDS.grant, created_at: time, updated_at: time,
  consent_scope: { campaign_id: FUN_IDS.campaign, revision: 2, digest: 'a'.repeat(64), alias: 'Family Fan', caption: 'Our family cheer', audience: 'approved_pilot_accounts' as const, form_version: 'fan-zone-v1-testing' as const, reuse: false as const }, permission_valid: true,
  media_revisions: [ { revision: 1, path: `${FUN_IDS.entry}/1/80000000-0000-0000-0000-000000000001.mp4`, present: true }, { revision: 2, path: `${FUN_IDS.entry}/2/80000000-0000-0000-0000-000000000002.mp4`, present: true } ] };
 return { ok: true, campaigns: [campaign], campaign, entries: [entry], ballots: [{ id: FUN_IDS.ballot, campaign_id: FUN_IDS.campaign, voter_id: FUN_IDS.admin, entry_id: FUN_IDS.entry, version: 1, invalidated_at: null, invalid_reason: null, created_at: time, updated_at: time, valid: true }], cases: [{ id: FUN_IDS.case, entry_id: FUN_IDS.entry, revision: 2, path: entry.path, reporter_id: null, kind: 'report', details: 'Please review the exact caption.', status: 'open', reason: null, created_at: time, expires_at: '2026-11-13T06:00:00Z', updated_at: time }], audit: [{ id: FUN_IDS.audit, campaign_id: FUN_IDS.campaign, actor_id: FUN_IDS.admin, action: 'review_accept', subject_id: FUN_IDS.entry, detail: { reason: 'Rights reviewed' }, created_at: time }], counts: { entries: 1, ballots: 1, valid_ballots: 1, cases: 1, open_cases: 1, audit: 1, entry_statuses: { accepted: 1 } }, next_cursor: null, case_next_cursor: null, audit_next_cursor: null };
}
/** @purpose Public snapshot never contains tester lists or private candidate identifiers. */
export function fanSnapshotFixture(): FanZoneSnapshot {
 const admin = fanAdminFixture();
 const { pilot_accounts: _testers, ...campaign } = admin.campaign!;
 const entry = admin.entries[0];
 return { ok: true, campaign, candidates: [{ id: entry.id, revision: entry.revision, alias: entry.alias, caption: entry.caption }], results: [], entry, ballot: null, guardian_queue: [], reflections: [], story: null, eligible: true, can_participate: true };
}
/** @purpose Exact remove API wire envelope binds entry/revision and actual completion status. */
export function fanRemovalFixture(revision:number,completed:boolean) { return {ok:true as const,entry:FUN_IDS.entry,revision,completed,status:completed?'removed':'revision_removed'}; }
