/**
 * FUN-01 typed, bound client RPCs. Validate complete persisted DTOs and preserve exact consent/ballot receipts.
 * Missing/malformed sources throw fixed-code errors; no table fallback, private telemetry or service RPC access.
 * @sideEffects Authenticated RPCs through lib/rpc and caller-authorized media removal API requests.
 */
import type { FanZoneAdminSnapshot, FanZoneEntry, FanZoneRpcMap } from '@shared/fanZone';
import { isMissingFunction } from '@/lib/dbErrors';
import { untypedRpc } from '@/lib/rpc';
import { isSupabaseConfigured } from '@/lib/supabase';
import { removeFanZoneMedia } from '@/lib/fanZoneMedia';
export type * from '@shared/fanZone';
const messages: Record<string, string> = {
    FUN_UNAVAILABLE: 'Fan Zone is unavailable. Refresh or contact Support.',
    FUN_NOT_APPLIED: 'Fan Zone is not switched on yet: its database update has not been applied.',
    FUN_NOT_CONFIGURED: 'Fan Zone is not configured in this build.',
    FUN_INVALID_RESPONSE: 'Fan Zone returned incomplete data. Refresh or contact Support.',
    FUN_INVALID_REQUEST: 'This Fan Zone request is not supported. Refresh or contact Support.',
    FUN_ACCOUNT_INELIGIBLE: 'This account cannot use Fan Zone. Check age/account status or contact Support.',
    FUN_ADMIN_REQUIRED: 'An eligible admin account is required.',
    FUN_PERMISSION_SCOPE_STALE: 'Permission scope changed. Refresh and review the exact revision again.',
    FUN_BALLOT_VERSION_STALE: 'Your ballot changed. Refresh before replacing it.',
    FUN_REQUEST_REUSED: 'This request differs from its original ballot. Refresh before voting again.',
    FUN_CASE_RATE_LIMIT: 'The concern queue limit was reached. Use the configured support contact or Help/Safety.',
    FUN_DELETION_ALREADY_REQUESTED: 'Removal is already requested. Refresh to continue the tracked removal.',
    FUN_ACTUAL_REMOVAL_REQUIRED: 'Deletion completes only after every stored revision has actually been removed.',
    FUN_REMOVAL_NOT_REQUESTED: 'Create a tracked deletion request before removing media.',
    FUN_MEDIA_UNAVAILABLE: 'Fan video service is unavailable. Removal has not been confirmed.',
};
const knownCodes = new Set([
    'FUN_ACCOUNT_INELIGIBLE', 'FUN_ADMIN_REQUIRED', 'FUN_CAMPAIGN_UNAVAILABLE', 'FUN_TESTING_OPEN_DENIED', 'FUN_STATE_INVALID', 'FUN_RULES_IMMUTABLE', 'FUN_VOTING_NOT_ENDED', 'FUN_ACTION_INVALID', 'FUN_ENTRY_UNAVAILABLE', 'FUN_ENTRY_WINDOW_CLOSED', 'FUN_ENTRY_CAP', 'FUN_VERIFIED_RIGHTS_REQUIRED', 'FUN_PERMISSION_UNAVAILABLE', 'FUN_PERMISSION_SCOPE_STALE', 'FUN_BALLOT_INVALID', 'FUN_REQUEST_REUSED', 'FUN_VOTE_WINDOW_CLOSED', 'FUN_BALLOT_RATE_LIMIT', 'FUN_CANDIDATE_UNAVAILABLE', 'FUN_BALLOT_VERSION_STALE', 'FUN_BALLOT_INVALIDATED', 'FUN_REASON_REQUIRED', 'FUN_BALLOT_UNAVAILABLE', 'FUN_MEDIA_UNAVAILABLE', 'FUN_REMOVAL_NOT_REQUESTED', 'FUN_MEDIA_INVALID', 'FUN_CASE_UNAVAILABLE', 'FUN_CASE_RATE_LIMIT', 'FUN_DELETION_ALREADY_REQUESTED', 'FUN_CASE_INVALID', 'FUN_ACTUAL_REMOVAL_REQUIRED', 'FUN_REFLECTION_INVALID', 'FUN_REFLECTION_CAP', 'FUN_REFLECTION_UNAVAILABLE',
]);
/** @purpose Fixed safe user text plus typed diagnostic code; raw backend messages never leave this adapter. */
export class FanZoneError extends Error {
    readonly code: string;
    constructor(code: string) { super(messages[code] ?? 'Fan Zone could not complete this action. Refresh or contact Support.'); this.name = 'FanZoneError'; this.code = code; }
}
type Row = Record<string, unknown>;
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
// PostgreSQL char_length counts Unicode code points. Most persisted columns do not trim at all.
const text = (v: unknown, min = 0, max = Infinity): v is string => typeof v === 'string' && Array.from(v).length >= min && Array.from(v).length <= max;
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const nullable = (v: unknown, check: (x: unknown) => boolean) => v === null || check(v);
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const one = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v);
const onlyKeys = (v: Row, keys: readonly string[]) => Object.keys(v).every(key => keys.includes(key));
const array = (v: unknown, check: (x: unknown) => boolean, max = Infinity): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(check);
const entryStates = ['draft', 'submitted', 'accepted', 'changes', 'rejected', 'suspended', 'withdrawn'];
const digest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const result = (v: unknown) => object(v) && uuid(v.entry_id) && integer(v.votes, 1);
function campaign(v: unknown, admin: boolean): boolean {
    return object(v) && uuid(v.id) && text(v.title, 1, 80) && text(v.theme, 1, 240) && one(v.period, ['game', 'week'])
        && one(v.status, ['draft', 'open', 'paused', 'closed', 'finalized']) && v.testing_only === true
        && ['entry_opens_at', 'entry_closes_at', 'vote_opens_at', 'vote_closes_at', 'created_at', 'updated_at'].every(k => timestamp(v[k]))
        && text(v.rules, 10, 4000) && text(v.support_contact, 0, 200) && nullable(v.story_reel_id, uuid) && nullable(v.opened_at, timestamp)
        && array(v.results, result, 100) && bool(v.recount_required) && !('result_signature' in v)
        && (admin ? array(v.pilot_accounts, uuid, 100) : !('pilot_accounts' in v));
}
function entry(v: unknown): v is FanZoneEntry {
    if (!object(v) || !uuid(v.id) || !uuid(v.campaign_id) || !uuid(v.owner_id) || !integer(v.revision, 1, 100)
        || !text(v.path) || !text(v.alias, 0, 40) || !text(v.caption, 0, 240) || !bool(v.rights_confirmed) || !one(v.status, entryStates)
        || !nullable(v.reason, x => text(x, 0, 500)) || !bool(v.verified) || !nullable(v.digest, digest) || !nullable(v.bytes, x => integer(x, 1, 20971520))
        || !nullable(v.duration_ms, x => integer(x, 1000, 30000)) || !nullable(v.removed_at, timestamp) || !nullable(v.guardian_consent_id, uuid)
        || !timestamp(v.created_at) || !timestamp(v.updated_at) || !bool(v.permission_valid)
        || !array(v.media_revisions, x => object(x) && integer(x.revision, 1, 100) && text(x.path) && bool(x.present), 100) || !object(v.consent_scope))
        return false;
    const s = v.consent_scope;
    return s.campaign_id === v.campaign_id && s.revision === v.revision && s.digest === v.digest && s.alias === v.alias && s.caption === v.caption
        && s.audience === 'approved_pilot_accounts' && s.form_version === 'fan-zone-v1-testing' && s.reuse === false;
}
function ballot(v: unknown, admin: boolean, valid = true): boolean {
    return object(v) && uuid(v.id) && uuid(v.campaign_id) && uuid(v.entry_id) && integer(v.version, 1)
        && (admin ? uuid(v.voter_id) && nullable(v.invalidated_at, timestamp) && nullable(v.invalid_reason, x => text(x, 5, 500))
            && timestamp(v.created_at) && timestamp(v.updated_at) && (!valid || bool(v.valid)) : bool(v.invalidated) && !('voter_id' in v));
}
function caseRow(v: unknown, admin: boolean): boolean {
    return object(v) && uuid(v.id) && uuid(v.entry_id) && integer(v.revision, 1, 100) && one(v.kind, ['report', 'appeal', 'deletion'])
        && one(v.status, ['open', 'escalated', 'resolved', 'completed']) && timestamp(v.created_at) && timestamp(v.expires_at) && !('secret_hash' in v)
        && (admin ? text(v.path) && nullable(v.reporter_id, uuid) && text(v.details, 3, 1000) && nullable(v.reason, x => text(x, 5, 500)) && timestamp(v.updated_at)
            : onlyKeys(v, ['id', 'entry_id', 'revision', 'kind', 'status', 'created_at', 'expires_at']));
}
function audit(v: unknown): boolean {
    return object(v) && uuid(v.id) && uuid(v.campaign_id) && nullable(v.actor_id, uuid) && text(v.action) && nullable(v.subject_id, uuid)
        && object(v.detail) && timestamp(v.created_at);
}
function adminSnapshot(v: Row): boolean {
    if (!array(v.campaigns, x => campaign(x, true), 100) || !nullable(v.campaign, x => campaign(x, true)) || !array(v.entries, entry, 100)
        || !array(v.ballots, x => ballot(x, true), 100) || !array(v.cases, x => caseRow(x, true), 50) || !array(v.audit, audit, 50)
        || !['next_cursor', 'case_next_cursor', 'audit_next_cursor'].every(k => nullable(v[k], timestamp)) || !object(v.counts))
        return false;
    const counts = v.counts;
    if (!['entries', 'ballots', 'valid_ballots', 'cases', 'open_cases', 'audit'].every(k => integer(counts[k])) || !object(counts.entry_statuses))
        return false;
    const statuses = counts.entry_statuses;
    const entries = v.entries;
    const ballots = v.ballots, selected = object(v.campaign) ? v.campaign.id : null;
    return Object.entries(statuses).every(([k, n]) => entryStates.includes(k) && integer(n)) && v.entries.length === counts.entries && v.ballots.length === counts.ballots
        && v.cases.length <= Number(counts.cases) && v.audit.length <= Number(counts.audit) && Number(counts.valid_ballots) <= Number(counts.ballots)
        && Number(counts.open_cases) <= Number(counts.cases) && Object.values(statuses).reduce<number>((total, n) => total + Number(n), 0) === counts.entries
        && entryStates.every(status => entries.filter(x => object(x) && x.status === status).length === Number(statuses[status] ?? 0))
        && entries.every(x => object(x) && x.campaign_id === selected) && ballots.every(x => object(x) && x.campaign_id === selected)
        && ballots.filter(x => object(x) && x.valid).length === counts.valid_ballots;
}
function snapshot(v: Row): boolean {
    return nullable(v.campaign, x => campaign(x, false)) && array(v.candidates, x => object(x) && uuid(x.id) && integer(x.revision, 1, 100) && text(x.alias, 0, 40) && text(x.caption, 0, 240)
        && onlyKeys(x, ['id', 'revision', 'alias', 'caption']), 100) && array(v.results, result, 100)
        && nullable(v.entry, entry) && nullable(v.ballot, x => ballot(x, false)) && array(v.guardian_queue, entry, 100)
        && array(v.reflections, x => object(x) && uuid(x.id) && uuid(x.campaign_id) && one(x.idea, ['encourage', 'help_at_home', 'serve_together', 'thank_someone']) && timestamp(x.created_at) && !('owner_id' in x), 20)
        && nullable(v.story, x => object(x) && uuid(x.id) && nullable(x.player_id, uuid) && text(x.video_url) && text(x.title)) && bool(v.eligible) && bool(v.can_participate)
        && (v.campaign !== null || v.can_participate === false);
}
type ClientRpc = Exclude<keyof FanZoneRpcMap, 'fun_verify_media' | 'fun_complete_removal'>;
const clientRpcs = new Set<ClientRpc>(['fun_snapshot', 'fun_admin_snapshot', 'fun_admin_campaign', 'fun_entry', 'fun_permission', 'fun_vote', 'fun_admin_entry', 'fun_admin_ballot', 'fun_case', 'fun_case_status', 'fun_admin_case', 'fun_reflection', 'fun_media_access']);
function response(fn: ClientRpc, v: unknown): boolean {
    if (!object(v) || v.ok !== true)
        return false;
    switch (fn) {
        case 'fun_snapshot': return snapshot(v);
        case 'fun_admin_snapshot': return adminSnapshot(v);
        case 'fun_admin_campaign': return campaign(v.campaign, true);
        case 'fun_entry':
        case 'fun_permission':
        case 'fun_admin_entry': return entry(v.entry);
        case 'fun_vote': return uuid(v.request_id) && ballot(v.ballot, false);
        case 'fun_admin_ballot': return ballot(v.ballot, true, false);
        case 'fun_case':
        case 'fun_case_status':
        case 'fun_admin_case': return caseRow(v.case, false);
        case 'fun_reflection': return uuid(v.deleted_id) || (object(v.reflection) && uuid(v.reflection.id) && uuid(v.reflection.campaign_id)
            && one(v.reflection.idea, ['encourage', 'help_at_home', 'serve_together', 'thank_someone']) && timestamp(v.reflection.created_at) && !('owner_id' in v.reflection));
        case 'fun_media_access': return v.bucket === 'fan_zone' && text(v.path, 1) && uuid(v.entry_id) && integer(v.revision, 1, 100)
            && nullable(v.digest, digest) && nullable(v.bytes, x => integer(x, 1, 20971520)) && nullable(v.duration_ms, x => integer(x, 1000, 30000));
    }
}
function boundReceipt(fn: ClientRpc, args: Row, value: unknown): boolean {
    if (!object(value))
        return false;
    const e = object(value.entry) ? value.entry : null, b = object(value.ballot) ? value.ballot : null, c = object(value.case) ? value.case : null;
    switch (fn) {
        case 'fun_snapshot':
        case 'fun_admin_snapshot': return !args.p_campaign_id || value.campaign === null || (object(value.campaign) && value.campaign.id === args.p_campaign_id);
        case 'fun_admin_campaign': return args.p_action === 'create' || (object(value.campaign) && value.campaign.id === args.p_id);
        case 'fun_entry': return !!e && e.campaign_id === args.p_campaign_id && (!args.p_entry_id || e.id === args.p_entry_id);
        case 'fun_permission': return !!e && e.id === args.p_entry_id && e.revision === args.p_revision && object(args.p_expected_scope) && object(e.consent_scope)
            && Object.entries(args.p_expected_scope).every(([k, v]) => (e.consent_scope as Row)[k] === v);
        case 'fun_admin_entry': return e?.id === args.p_entry_id;
        case 'fun_vote': return value.request_id === args.p_request_id && b?.campaign_id === args.p_campaign_id && b?.entry_id === args.p_entry_id && b?.version === Number(args.p_expected_version) + 1;
        case 'fun_admin_ballot': return b?.id === args.p_ballot_id;
        case 'fun_case': return c?.entry_id === args.p_entry_id && c?.kind === args.p_kind;
        case 'fun_case_status':
        case 'fun_admin_case': return c?.id === args.p_case_id;
        case 'fun_reflection': return args.p_action === 'delete' ? value.deleted_id === args.p_id : object(value.reflection) && value.reflection.campaign_id === args.p_campaign_id;
        case 'fun_media_access': return value.entry_id === args.p_entry_id && value.revision === args.p_revision;
    }
}
/** @purpose Call only client-granted RPCs with exact argument types and validated result envelopes. */
export async function fanZoneRpc<K extends ClientRpc>(fn: K, args: FanZoneRpcMap[K]['args']): Promise<FanZoneRpcMap[K]['result']> {
    if (!clientRpcs.has(fn))
        throw new FanZoneError('FUN_INVALID_REQUEST');
    if (!isSupabaseConfigured)
        throw new FanZoneError('FUN_NOT_CONFIGURED');
    let value: unknown;
    try {
        const { data, error } = await untypedRpc(fn, args);
        if (error)
            throw new FanZoneError(isMissingFunction(error) ? 'FUN_NOT_APPLIED' : typeof error.message === 'string' && knownCodes.has(error.message) ? error.message : 'FUN_UNAVAILABLE');
        value = data;
    }
    catch (caught) {
        throw caught instanceof FanZoneError ? caught : new FanZoneError('FUN_UNAVAILABLE');
    }
    if (!response(fn, value) || !boundReceipt(fn, args, value))
        throw new FanZoneError('FUN_INVALID_RESPONSE');
    return value as FanZoneRpcMap[K]['result'];
}
/** @purpose Complete selected-campaign entries/ballots/counts, and bounded case/audit pages. */
export function fetchFanZoneAdmin(campaignId: string | null = null, before: string | null = null): Promise<FanZoneAdminSnapshot> {
    return fanZoneRpc('fun_admin_snapshot', { p_campaign_id: campaignId, p_before: before });
}
/** @purpose Current authorized public/private state; unknown data never becomes an empty healthy source. */
export function fetchFanZone(campaignId: string | null = null) { return fanZoneRpc('fun_snapshot', { p_campaign_id: campaignId }); }
/** @purpose Remove one revision through the caller-authorized API; completion requires an actual matching server receipt. */
export async function removeFanZoneRevision(entryId: string, revision: number): Promise<{
    completed: boolean;
}> {
    let receipt: unknown; // The transport's historical type omits entry; validate the actual API envelope here.
    try {
        receipt = await removeFanZoneMedia(entryId, revision);
    }
    catch {
        throw new FanZoneError('FUN_MEDIA_UNAVAILABLE');
    }
    if (!object(receipt) || receipt.ok !== true || receipt.entry !== entryId || receipt.revision !== revision || !bool(receipt.completed)
        || receipt.status !== (receipt.completed ? 'removed' : 'revision_removed'))
        throw new FanZoneError('FUN_INVALID_RESPONSE');
    return { completed: receipt.completed };
}
/** @purpose SQL mutation reason bounds use ASCII-space trim, distinct from untrimmed persisted column bounds. */
export function fanZoneReasonValid(reason: string): boolean {
    return text(reason, 0, 500) && text(reason.replace(/^ +| +$/g, ''), 5, 500);
}
