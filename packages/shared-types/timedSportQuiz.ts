/** QUIZ-02 wire contract: private timed learning, exact recovery and bounded admin inventory.
 * QUIZ-03 extends it for rounds of up to five (mode 'round', Next), question types and the larger bank. Fields QUIZ-03
 * servers always send are optional here so QUIZ-02 fixtures still type-check; QUIZ-03-only shapes live in triviaPlayTogether.ts.
 * @purpose Keeps active prompts confined to the original Start/Next capability; account reads are sanitized.
 */
import type { LifeQuestionFields, LifeQuestionInput } from './lifePlaybook';
import type { FreshRefillRow, FreshStatus } from './freshQuestions';
export const TIMED_QUIZ_NOTICE_VERSION = 'timed-trivia-v1-testing' as const;
export const TIMED_QUIZ_DURATIONS = [30, 90] as const;
export type TimedQuizTopic = 'sport' | 'science' | 'geography' | 'general';
/** QUIZ-04: a question's topic can also be 'life' (Life Playbook); Life is never a fun-slot or personal Start topic.
 * QUIZ-05: 'athlete' marks a fun fact (Know your athlete), drawn only in personal rounds and filled at read time. */
export type TimedQuizQuestionTopic = TimedQuizTopic | 'life' | 'athlete';
/** QUIZ-04 weekly opportunities: each kind has its own guard; one active round at a time. */
export type TimedQuizRoundKind = 'personal' | 'group' | 'life';
export type TimedQuizStatus = 'issued' | 'completed' | 'skipped' | 'void' | 'ended' | 'expired';
export type TimedQuizQuestionType = 'choice4' | 'true_false' | 'image_choice';
/** 'between' = the last item closed and the round waits for Next until next_by. */
export type TimedQuizRoundState = 'item' | 'between';
export type TimedQuizPreferences = {
  invitation_mode: 'off' | 'weekly'; topic_mode: 'sports' | 'mix';
  notice_version: string | null; notice_accepted_at: string | null;
  version: number; history_version: number; last_invited_week: string | null;
};
export type TimedQuizPreferencesInput = {
  invitation_mode: TimedQuizPreferences['invitation_mode']; topic_mode: TimedQuizPreferences['topic_mode'];
  notice_version: typeof TIMED_QUIZ_NOTICE_VERSION;
};
/** Deliberately excludes question ID/family/content/answer and capability. */
export type TimedQuizAttemptSummary = {
  id: string; week_start: string; mode: 'legacy' | 'timed' | 'round'; status: TimedQuizStatus;
  started_at: string | null; expires_at: string | null; duration_seconds: 30 | 90 | null;
  closed_at: string | null; close_reason: string | null; effective_expired: boolean;
  correction_reason: string | null;
  /** QUIZ-03 round fields (null for single-question attempts). position = the current or last closed item. */
  round_state?: TimedQuizRoundState | null; position?: number | null; planned_items?: number | null; round_size?: number | null;
  next_by?: string | null; answered_count?: number; short_round?: boolean; group_id?: string | null;
  /** QUIZ-04 */
  round_kind?: TimedQuizRoundKind;
};
export type TimedQuizPool = { topic_category: TimedQuizTopic; sport: string; unseen_count: number; allowed: boolean };
export type TimedQuizSnapshot = {
  contract_version: 2; profile_id: string | null; server_now: string; week_start: string; week_end: string;
  testing_only: true; availability: 'ready' | 'paused' | 'not_enrolled' | 'ineligible' | 'unavailable';
  preferences: TimedQuizPreferences; attempt: TimedQuizAttemptSummary | null;
  week_spent: boolean; scheduled_topic: 'sport' | 'fun'; pools: TimedQuizPool[];
  history_version: number; history_count: number; badge_count: number; correction_count: number;
  /** QUIZ-03: questions per new round (1–5) and whether group play is switched on for this account. */
  round_size?: number; groups_available?: boolean;
  /** QUIZ-04: week_spent is the personal guard; attempt is the open round of any kind, else this week's personal attempt. */
  week_spent_by_kind?: Record<TimedQuizRoundKind, boolean>; active_round_kind?: TimedQuizRoundKind | null;
};
export type TimedQuizQuestion = {
  id: string; question_key: string; version: number; topic_category: TimedQuizQuestionTopic;
  sport: string; prompt: string; options: string[]; question_type?: TimedQuizQuestionType;
  /** QUIZ-05: options are in this item's shown order (the answer is the shown position). Never the order itself. */
  shuffled?: boolean;
  /** QUIZ-05 fun fact: the athlete's first name (null when not visible) and the prompt key. */
  fun_fact?: { first_name: string | null; prompt_key: string };
};
export type TimedQuizResult = {
  answered_option: number | null; correct_option: number; was_correct: boolean | null;
  explanation: string; completed_at: string | null;
  /** QUIZ-03 rounds: which item this result belongs to and how it closed. */
  position?: number | null; item_status?: 'answered' | 'expired' | 'ended' | 'void' | 'fact_unavailable' | null;
  /** QUIZ-05: the client adapter turns answered_option / correct_option into shown positions (the order the options were
   * shown); the server's stored indices stay in stored_answered_option / stored_correct_option. */
  answered_position?: number | null; correct_position?: number | null; shown_order?: number[] | null;
  stored_answered_option?: number | null; stored_correct_option?: number;
  /** QUIZ-05: the athlete card after a fun fact's reveal (no Donate or money words on that card). */
  fun_fact?: { first_name: string | null; athlete_player_id: string | null };
};
export type TimedQuizOperation = 'preferences' | 'invitation' | 'start' | 'answer' | 'end' | 'skip' | 'next';
/** The open item of a round, only on the original Start/Next response before its deadline. */
export type TimedQuizActiveItem = { position: number; planned_items: number; expires_at: string };
/** Receipts never carry a prompt. Only the separate Start extension can carry one. */
export type TimedQuizReceipt = {
  contract_version: 2; profile_id: string; request_id: string; operation: TimedQuizOperation;
  outcome: string; week_start: string; committed_at: string;
  attempt: TimedQuizAttemptSummary | null; result: TimedQuizResult | null;
  preferences: TimedQuizPreferences | null;
  /** QUIZ-04 */
  round_kind?: TimedQuizRoundKind;
};
export type TimedQuizStartReceipt = TimedQuizReceipt & { server_now: string; active_question: TimedQuizQuestion | null; active_item?: TimedQuizActiveItem | null };
export type TimedQuizRoundItem = {
  position: number; status: 'answered' | 'expired' | 'ended' | 'void'; question: TimedQuizQuestion; result: TimedQuizResult; correction_reason: string | null;
};
export type TimedQuizHistoryItem = {
  attempt: TimedQuizAttemptSummary; question: TimedQuizQuestion | null; result: TimedQuizResult | null;
  /** QUIZ-03 rounds: every closed item with its private result (empty for single-question attempts). */
  items?: TimedQuizRoundItem[];
  badge: { id: string; label: 'Sport Learner' | 'Trivia Explorer'; visibility: 'private' | 'groups'; issued_at: string; voided_at: string | null } | null;
};
export type TimedQuizHistoryPage = {
  contract_version: 2; profile_id: string; server_now: string; history_version: number;
  total: number; items: TimedQuizHistoryItem[]; next_before: string | null;
};
export type TimedQuizEraseReceipt = {
  contract_version: 2; profile_id: string; history_version: number; week_start: string;
  week_spent: true; quota_prune_after: string; removed_attempts: number; removed_exposures: number;
  removed_badges: number; removed_requests: number; removed_audit: number;
  /** Join attempts are kept until their 35-day prune so erasure cannot reset limits or refusal evidence. */
  removed_group_memberships?: number; retained_join_attempts?: number; removed_group_sets?: number;
  /** QUIZ-04: levels are cleared by erasure (all three weekly opportunities are spent). */
  removed_levels?: number;
  /** QUIZ-05: the caller's own question reports. */
  removed_reports?: number;
};
export type TimedQuizAdminQuestion = TimedQuizQuestion & {
  correct_option: number; explanation: string; source_notes: string; reason: string;
  status: 'draft' | 'approved' | 'archived' | 'void'; created_at: string; created_by: string | null;
  reviewed_at: string | null; reviewed_by: string | null;
  question_type?: TimedQuizQuestionType; media_path?: string | null; media_licence?: string | null; media_source?: string | null;
  media_attribution?: string | null; media_alt_text?: string | null; media_size_bytes?: number | null; media_has_person?: boolean | null;
  media_reviewed_by?: string | null; media_reviewed_at?: string | null; media_no_marks?: boolean | null; media_exif_stripped?: boolean | null;
} & Partial<LifeQuestionFields>;
export type TimedQuizMediaLicence = 'owned' | 'cc0' | 'cc_by' | 'licensed' | 'public_domain';
export type TimedQuizAdminQuestionInput = {
  reason: string; sport?: string; prompt?: string; options?: string[];
  correct_option?: number; explanation?: string; topic_category?: TimedQuizQuestionTopic; source_notes?: string;
  family_action?: 'new' | 'existing'; question_key?: string;
  question_type?: TimedQuizQuestionType; media_path?: string; media_licence?: TimedQuizMediaLicence; media_source?: string;
  media_attribution?: string; media_alt_text?: string; media_size_bytes?: number; media_has_person?: false; media_no_marks?: true; media_exif_stripped?: true;
} & LifeQuestionInput;
export type TimedQuizAdminQuestionReceipt = { id: string; question_key: string; version: number; status: TimedQuizAdminQuestion['status'] };
export type TimedQuizSettingsReceipt = { contract_version: 2; enabled: boolean; testing_only: true; pilot_accounts: string[] };
export type TimedQuizAdminSnapshot = {
  contract_version: 2; generated_at: string; week_start: string; week_end: string;
  settings: (TimedQuizSettingsReceipt & { reason: string; updated_at: string; updated_by: string | null;
    round_size?: number; groups_enabled?: boolean; images_enabled?: boolean }) | null;
  /** question_total = every stored version (paging); active_total = draft + approved, counted against question_cap. */
  questions: TimedQuizAdminQuestion[]; question_total: number; question_cap: 100 | 300; next_question_cursor: string | null;
  active_total?: number; life_active_total?: number; life_cap?: 200; forecast?: TimedQuizForecast[]; groups?: TimedQuizGroupCounts; reports?: TimedQuizGroupReport[];
  audit: { id: string; action: string; actor_id: string | null; question_id: string | null; reason: string | null; created_at: string }[];
  next_before: string | null;
  counts: Record<'questions_draft'|'questions_approved'|'questions_archived'|'questions_void'|'week_issued'|'week_completed'|'week_skipped'|'week_void'|'week_ended'|'week_expired'|'badges_issued'|'badges_void'|'preferences_weekly'|'exposures'|'week_spent'|'retained_guards'|'retained_requests',number>
    & Partial<Record<TimedQuizRoundCountKey,number>>;
  pools: { topic_category: TimedQuizTopic; sport: string; approved_count: number }[];
  /** QUIZ-04 control tower: whole-bank review counts; absent on an older server (the desk then counts loaded pages). */
  bank_counts?: TimedQuizBankCounts;
  /** QUIZ-05: weeks left / Refill needed and the fresh-question settings with the Needs a look count. */
  refill?: FreshRefillRow[]; fresh?: FreshStatus;
};
/** Draft and approved versions in the whole bank. Content counts only: no participant data, so no privacy threshold. */
export type TimedQuizBankCount = { draft_count: number; approved_count: number };
export type TimedQuizBankCounts = {
  topics: (TimedQuizBankCount & { topic_category: TimedQuizQuestionTopic })[];
  sports: (TimedQuizBankCount & { sport: string })[];
  /** Every Life chapter, zeros included. */
  chapters: (TimedQuizBankCount & { chapter: string })[];
};
export type TimedQuizRoundCountKey = 'week_rounds_short'|'week_rounds_group'|'questions_true_false'|'questions_image'|'week_items_issued'|'week_items_answered'|'week_items_void'
  |'badges_sport'|'badges_family'|'badges_season'|'badges_group_visible'|'recap_facts_quarter'|'week_rounds_personal';
/** Weeks until the most-exposed recent player runs out of a sport at the 28-day pace; null = no recent play. */
export type TimedQuizForecast = { sport: string; approved_families: number; players_28d: number; issued_28d: number; pace_per_player_week: number; max_seen: number; weeks_left: number | null };
/** Group overview: counts only, never member names or answers. */
export type TimedQuizGroupCounts = Record<'groups_active'|'groups_closed'|'members_active'|'members_removed'|'groups_played_this_week'|'codes_active'|'codes_issued'
  |'joins_7d'|'refusals_7d'|'wrong_codes_7d'|'reports_7d'|'sets_this_week'|'retained_sets'|'retained_join_attempts',number>;
export type TimedQuizGroupReport = { id: string; group_id: string; reason_code: 'safety'|'unwanted_contact'|'name_or_theme'|'other'; created_at: string };
export type TimedQuizRetentionReceipt = { contract_version: 2; removed_guards: number; removed_requests: number; preserved_guards: number; batch_limit: 500;
  removed_codes?: number; removed_group_sets?: number; removed_join_attempts?: number; removed_groups?: number;
  /** QUIZ-05: report retention (reporter ids cleared at 90 days, reports deleted at 180). */
  cleared_reporters?: number; removed_reports?: number;
  /** QUIZ-05 security review: declined fun-fact text purged 30 days after the decision. */
  purged_declined_facts?: number };
export type TimedQuizStartInput = { topic_category: TimedQuizTopic; sport: string | null; duration_seconds: 30|90; expected_week: string; notice_version: typeof TIMED_QUIZ_NOTICE_VERSION; request_id: string; session_secret: string; expected_profile_id: string };
export type TimedQuizAnswerInput = { attempt_id: string; option: number; request_id: string; session_secret: string; expected_profile_id: string };
/** QUIZ-04: round_kind names the guard End spends for a pending Start (and must match an attempt); the adapter defaults to personal. */
export type TimedQuizEndInput = { attempt_id: string | null; start_request_id: string | null; expected_week: string; reason: 'user_end'|'left_page'|'background'|'identity_change'; request_id: string; expected_profile_id: string; round_kind?: TimedQuizRoundKind };
