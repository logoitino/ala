/** FUN-01 wire contract: the default-off approved-account pilot uses narrow RPC JSON receipts, never client table reads. */
export const FAN_ZONE_MEDIA_LIMITS = { maxBytes: 20 * 1024 * 1024, maxDurationMs: 30000, minDurationMs: 1000 } as const;
export type FanZoneCampaignStatus = 'draft' | 'open' | 'paused' | 'closed' | 'finalized';
export type FanZoneEntryStatus = 'draft' | 'submitted' | 'accepted' | 'changes' | 'rejected' | 'suspended' | 'withdrawn';
export type FanZoneCampaignAction = 'create' | 'configure' | 'open' | 'pause' | 'close' | 'finalize' | 'recount';
export type FanZoneEntryAction = 'reserve' | 'edit' | 'submit' | 'withdraw';
export type FanZonePermissionAction = 'assent' | 'grant' | 'revoke';
export type FanZoneReviewAction = 'accept' | 'changes' | 'reject' | 'suspend';
export type FanZoneCaseKind = 'report' | 'appeal' | 'deletion';
export type FanZoneCaseAction = 'resolve' | 'escalate';
export type FanZoneReflectionIdea = 'encourage' | 'help_at_home' | 'serve_together' | 'thank_someone';
export type FanZoneReflectionAction = 'create' | 'delete';
export type FanZoneMediaIntent = 'read' | 'verify' | 'remove';
export interface FanZoneConsentScope {
  campaign_id: string;
  revision: number;
  digest: string | null;
  alias: string;
  caption: string;
  audience: 'approved_pilot_accounts';
  form_version: 'fan-zone-v1-testing';
  reuse: false;
}
export interface FanZoneResult { entry_id: string; votes: number; }
export interface FanZoneCampaign {
  id: string;
  title: string;
  theme: string;
  period: 'game' | 'week';
  status: FanZoneCampaignStatus;
  testing_only: true;
  entry_opens_at: string;
  entry_closes_at: string;
  vote_opens_at: string;
  vote_closes_at: string;
  rules: string;
  support_contact: string;
  story_reel_id: string | null;
  opened_at: string | null;
  results: FanZoneResult[];
  recount_required: boolean;
  created_at: string;
  updated_at: string;
}
export interface FanZoneAdminCampaign extends FanZoneCampaign { pilot_accounts: string[]; }
export interface FanZoneCampaignPayload {
  title?: string;
  theme?: string;
  period?: 'game' | 'week';
  entry_opens_at?: string;
  entry_closes_at?: string;
  vote_opens_at?: string;
  vote_closes_at?: string;
  rules?: string;
  support_contact?: string;
  story_reel_id?: string | null;
  pilot_accounts?: string[];
}
export interface FanZoneEntryPayload { alias?: string; caption?: string; rights_confirmed?: boolean; }
export interface FanZoneEntry {
  id: string;
  campaign_id: string;
  owner_id: string;
  revision: number;
  path: string;
  alias: string;
  caption: string;
  rights_confirmed: boolean;
  status: FanZoneEntryStatus;
  reason: string | null;
  verified: boolean;
  digest: string | null;
  bytes: number | null;
  duration_ms: number | null;
  removed_at: string | null;
  /** Exact relied-on guardian grant; historical grants never substitute automatically. */
  guardian_consent_id: string | null;
  created_at: string;
  updated_at: string;
  consent_scope: FanZoneConsentScope;
  permission_valid: boolean;
  media_revisions: FanZoneMediaRevision[];
}
export interface FanZoneMediaRevision { revision: number; path: string; present: boolean; }
export interface FanZoneAdminEntry extends FanZoneEntry { media_revisions: FanZoneMediaRevision[]; }
/** Candidate DTO intentionally excludes identity, storage paths, digests and corrective text. */
export interface FanZoneCandidate { id: string; revision: number; alias: string; caption: string; }
export interface FanZoneBallot { id: string; campaign_id: string; entry_id: string; version: number; invalidated: boolean; }
export interface FanZoneAdminBallot {
  id: string;
  campaign_id: string;
  voter_id: string;
  entry_id: string;
  version: number;
  invalidated_at: string | null;
  invalid_reason: string | null;
  created_at: string;
  updated_at: string;
  valid: boolean;
}
export interface FanZoneCase {
  id: string;
  entry_id: string;
  revision: number;
  kind: FanZoneCaseKind;
  status: 'open' | 'escalated' | 'resolved' | 'completed';
  created_at: string;
  expires_at: string;
}
export interface FanZoneAdminCase extends FanZoneCase {
  path: string;
  reporter_id: string | null;
  details: string;
  reason: string | null;
  updated_at: string;
}
export interface FanZoneAudit {
  id: string;
  campaign_id: string;
  actor_id: string | null;
  action: string;
  subject_id: string | null;
  detail: { revision?: number; path?: string; reason?: string };
  created_at: string;
}
export interface FanZoneReflection { id: string; campaign_id: string; idea: FanZoneReflectionIdea; created_at: string; }
export interface FanZoneStory { id: string; player_id: string | null; video_url: string; title: string; }
export interface FanZoneSnapshot {
  ok: true;
  campaign: FanZoneCampaign | null;
  candidates: FanZoneCandidate[];
  results: FanZoneResult[];
  entry: FanZoneEntry | null;
  ballot: FanZoneBallot | null;
  guardian_queue: FanZoneEntry[];
  reflections: FanZoneReflection[];
  story: FanZoneStory | null;
  eligible: boolean;
  /** Known age alone does not enroll an owner, guardian or admin in this campaign's approved audience. */
  can_participate: boolean;
}
export interface FanZoneAdminSnapshot {
  ok: true;
  campaigns: FanZoneAdminCampaign[];
  campaign: FanZoneAdminCampaign | null;
  entries: FanZoneAdminEntry[];
  ballots: FanZoneAdminBallot[];
  cases: FanZoneAdminCase[];
  audit: FanZoneAudit[];
  counts: { entries: number; ballots: number; valid_ballots: number; cases: number; open_cases: number; audit: number; entry_statuses: Partial<Record<FanZoneEntryStatus, number>> };
  next_cursor: string | null;
  case_next_cursor: string | null;
  audit_next_cursor: string | null;
}
export interface FanZoneMediaAccess {
  ok: true;
  bucket: 'fan_zone';
  path: string;
  entry_id: string;
  revision: number;
  digest: string | null;
  bytes: number | null;
  duration_ms: number | null;
}
export interface FanZoneCampaignReceipt { ok: true; campaign: FanZoneAdminCampaign; }
export interface FanZoneEntryReceipt { ok: true; entry: FanZoneEntry; }
export interface FanZoneBallotReceipt { ok: true; request_id: string; ballot: FanZoneBallot; }
export interface FanZoneCaseReceipt { ok: true; case: FanZoneCase; }
export type FanZoneReflectionReceipt = { ok: true; reflection: FanZoneReflection } | { ok: true; deleted_id: string };
export interface FanZoneRemovalReceipt { ok: true; entry_id: string; revision: number; completed: boolean; }
/** Argument names are exactly the PostgREST RPC binding; consent scope must be passed untouched from the current private DTO. */
export interface FanZoneRpcMap {
  fun_snapshot: { args: { p_campaign_id?: string | null }; result: FanZoneSnapshot };
  fun_admin_snapshot: { args: { p_campaign_id?: string | null; p_before?: string | null }; result: FanZoneAdminSnapshot };
  fun_admin_campaign: { args: { p_id: string | null; p_action: FanZoneCampaignAction; p_payload: FanZoneCampaignPayload }; result: FanZoneCampaignReceipt };
  fun_entry: { args: { p_campaign_id: string; p_entry_id: string | null; p_action: FanZoneEntryAction; p_payload: FanZoneEntryPayload }; result: FanZoneEntryReceipt };
  fun_permission: { args: { p_entry_id: string; p_revision: number; p_action: FanZonePermissionAction; p_expected_scope: FanZoneConsentScope }; result: FanZoneEntryReceipt };
  fun_vote: { args: { p_campaign_id: string; p_entry_id: string; p_request_id: string; p_expected_version: number }; result: FanZoneBallotReceipt };
  fun_admin_entry: { args: { p_entry_id: string; p_action: FanZoneReviewAction; p_reason: string }; result: FanZoneEntryReceipt };
  fun_admin_ballot: { args: { p_ballot_id: string; p_reason: string }; result: { ok: true; ballot: Omit<FanZoneAdminBallot, 'valid'> } };
  fun_case: { args: { p_entry_id: string; p_kind: FanZoneCaseKind; p_details: string; p_secret: string }; result: FanZoneCaseReceipt };
  fun_case_status: { args: { p_case_id: string; p_secret: string }; result: FanZoneCaseReceipt };
  fun_admin_case: { args: { p_case_id: string; p_action: FanZoneCaseAction; p_reason: string }; result: FanZoneCaseReceipt };
  fun_reflection: { args: { p_campaign_id: string; p_id: string | null; p_idea: FanZoneReflectionIdea | null; p_action: FanZoneReflectionAction }; result: FanZoneReflectionReceipt };
  fun_media_access: { args: { p_entry_id: string; p_revision: number; p_intent: FanZoneMediaIntent }; result: FanZoneMediaAccess };
  fun_verify_media: { args: { p_entry_id: string; p_revision: number; p_digest: string; p_bytes: number; p_duration_ms: number }; result: FanZoneEntryReceipt };
  fun_complete_removal: { args: { p_entry_id: string; p_revision: number }; result: FanZoneRemovalReceipt };
}
