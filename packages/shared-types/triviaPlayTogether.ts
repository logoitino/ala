/** QUIZ-03 wire contract: Next, group play, badge shelf, season recap and the admin group desk.
 * @purpose Group pages carry a played-this-week mark per member and group totals only; codes appear once, to the creator.
 */
import type { TimedQuizStartReceipt } from './timedSportQuiz';

export const TRIVIA_GROUP_NAMES = ['family', 'friends', 'team_fans', 'cousins', 'game_day_crew', 'home_team'] as const;
export type TriviaGroupName = (typeof TRIVIA_GROUP_NAMES)[number];
export const TRIVIA_GROUP_LABELS: Record<TriviaGroupName, string> = {
  family: 'Family', friends: 'Friends', team_fans: 'Team fans', cousins: 'Cousins', game_day_crew: 'Game day crew', home_team: 'Home team',
};
export const TRIVIA_REPORT_REASONS = ['safety', 'unwanted_contact', 'name_or_theme', 'other'] as const;
export type TriviaReportReason = (typeof TRIVIA_REPORT_REASONS)[number];

/** Next keeps exact recovery: the same request UUID, expected position and round secret return the same item before its deadline. */
export type TriviaNextInput = { attempt_id: string; expected_position: number; request_id: string; session_secret: string; expected_profile_id: string };
export type TriviaNextReceipt = TimedQuizStartReceipt;
export type TriviaGroupStartInput = {
  group_id: string; duration_seconds: 30 | 90; expected_week: string; notice_version: 'timed-trivia-v1-testing';
  request_id: string; session_secret: string; expected_profile_id: string;
};

export type TriviaGroupMember = {
  /** Opaque per-group reference (32 hex), sent only to the group's creator for removal; never a profile id. */
  member_ref: string | null; display_name: string; is_owner: boolean; is_me: boolean; played_this_week: boolean; badges: string[];
};
export type TriviaGroupPage = {
  contract_version: 3; group_id: string; name_key: TriviaGroupName; theme_sport: string | null; status: 'active' | 'closed';
  is_owner: boolean; week_start: string; members: TriviaGroupMember[];
  /** Fact totals are null until 3 members played this week, then rounded down to 5s; a closed group lists no members. */
  totals: { members: number; played_this_week: number; facts_this_week: number | null; facts_this_season: number | null };
  everyone_played: boolean; code_active: boolean; code_expires_at: string | null; can_invite: boolean;
  outcome?: 'member' | 'closed';
};
export type TriviaGroupRemoved = { contract_version: 3; group_id: string; name_key: TriviaGroupName; outcome: 'removed' };
/** create / remove-member responses: the page plus a code shown once (null on a retry or when the group is full). */
export type TriviaGroupWithCode = TriviaGroupPage & { code: string | null; code_shown?: boolean };
export type TriviaJoinResult = { contract_version: 3; outcome: 'joined' | 'refused'; group: TriviaGroupPage | null };
export type TriviaLeaveResult = { contract_version: 3; outcome: 'left' | 'not_member' };
export type TriviaCodeReceipt = { contract_version: 3; group_id: string; code: string; expires_at: string };
export type TriviaReportReceipt = { contract_version: 3; outcome: 'reported'; group_id: string };
export type TriviaMyGroups = {
  contract_version: 3; profile_id: string; week_start: string; groups_enabled: boolean;
  groups: { group_id: string; name_key: TriviaGroupName; theme_sport: string | null; is_owner: boolean; members: number; played_this_week: boolean; everyone_played: boolean }[];
  removed: { group_id: string; name_key: TriviaGroupName }[];
  limits: { created: number; create_limit: 3; belong: number; belong_limit: 5; max_members: 12 };
};

/** QUIZ-04 adds 'life': one private Life Playbook badge per chapter at Varsity (never shown on group pages). */
export type TriviaBadgeKind = 'weekly' | 'sport' | 'family' | 'season' | 'life';
export type TriviaBadge = { id: string; label: string; kind: TriviaBadgeKind; sport: string | null; period: string; visibility: 'private' | 'groups'; issued_at: string };
export type TriviaBadgeShelf = { contract_version: 3; profile_id: string; badges: TriviaBadge[] };
export type TriviaBadgeReceipt = TriviaBadge & { contract_version: 3 };
export type TriviaSeasonRecap = {
  contract_version: 3; profile_id: string; quarter: string; starts_on: string; ends_before: string;
  facts: number; sports: number; rounds: number; badges: number;
  per_sport: { sport: string; facts: number }[]; per_topic: { topic_category: 'sport' | 'science' | 'geography' | 'general' | 'life' | 'athlete'; facts: number }[];
};

export type TriviaPlaySettingsInput = { round_size: number; groups_enabled: boolean; images_enabled: boolean };
export type TriviaPlaySettingsReceipt = TriviaPlaySettingsInput & { contract_version: 3 };
export type TriviaRefusalReason = 'teen_rule' | 'blocked' | 'full' | 'removed' | 'closed';
export type TriviaGroupCaseKind = 'report' | 'admin_view' | 'admin_removal' | 'admin_close' | 'member_removed' | 'blocked_removed' | 'handover' | 'dissolved';
/** Audited admin case view: ids and age bands only, never names. */
export type TriviaGroupCase = {
  contract_version: 3; generated_at: string; group_id: string;
  group: { name_key: TriviaGroupName; theme_sport: string | null; status: 'active' | 'closed'; created_at: string; closed_at: string | null;
    close_reason: string | null; owner_id: string | null; codes_issued: number; code_active: boolean } | null;
  members: { profile_id: string; age_band: string; status: 'active' | 'removed'; joined_at: string; removed_at: string | null; removed_reason: string | null; is_owner: boolean }[];
  refusals: { profile_id: string; age_band: string; refusal_reason: TriviaRefusalReason; created_at: string }[];
  cases: { id: string; kind: TriviaGroupCaseKind; actor_id: string | null; subject_id: string | null; reason_code: string | null; reason: string | null; created_at: string }[];
};
export type TriviaGroupRemoval = { contract_version: 3; outcome: 'removed' | 'closed' | 'already_closed'; group_id: string; profile_id: string | null };
