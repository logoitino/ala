/** QUIZ-05 wire contract: fun facts (Know your athlete), reports, Needs a look, bulk import and fresh-question settings.
 * @purpose The athlete's words travel only to the athlete, their guardian (to decide), admins (to decide) and, filled at
 * read time, to viewers the audience allows. Counts are buckets for completed months; reports never name a reporter.
 * Design: docs/engineering/design/TRIVIA_FRESH_QUESTIONS_DESIGN.md (§6 overrides §1–§5).
 */

export const FUN_FACT_PROMPTS = ['pregame_meal', 'hype_song', 'pro_athlete', 'pregame_ritual', 'hidden_talent', 'other_sport'] as const;
export type FunFactPromptKey = (typeof FUN_FACT_PROMPTS)[number];
export const FUN_FACT_MAX_LIVE = 3 as const;
export const FUN_FACT_MAX_LENGTH = 40 as const;
/** Server refusal codes from "quiz_fact_text: code, code". */
export const FUN_FACT_TEXT_CODES = ['length', 'emoji_or_non_latin', 'link', 'handle_or_email', 'digits', 'address', 'weekday_or_time', 'school_or_city',
  'not_okay_word', 'money_word', 'brand', 'not_on_list', 'matches_wrong_option', 'prompt_invalid'] as const;
export type FunFactTextCode = (typeof FUN_FACT_TEXT_CODES)[number];
export type FunFactStatus = 'waiting_guardian' | 'guardian_review' | 'admin_review' | 'approved' | 'declined' | 'withdrawn' | 'removed';
/** What the owner sees: 'paused' while the fact's question is paused for a check (no counts, no reporter). */
export type FunFactOwnerStatus = FunFactStatus | 'paused';
export type FunFactDeclineReason = 'guardian' | 'not_okay' | 'private' | 'sponsor_or_business' | 'place' | 'schedule' | 'other';
export const FUN_FACT_ADMIN_DECLINE_REASONS = ['not_okay', 'private', 'sponsor_or_business', 'place', 'schedule', 'other'] as const;
export type FunFactAdminDeclineReason = (typeof FUN_FACT_ADMIN_DECLINE_REASONS)[number];
export type FunFactAudience = 'everyone' | 'friends' | 'only_me';

export type FunFact = {
  id: string; prompt_key: FunFactPromptKey; label: string; answer_text: string | null; status: FunFactOwnerStatus; submitted_at: string;
  guardian_decision: 'approved' | 'declined' | null; guardian_decided_at: string | null; admin_decided_at: string | null;
  decline_reason: FunFactDeclineReason | null; cleared_at: string | null;
};
export type FunFactPrompt = { key: FunFactPromptKey; label: string; answers: string[] | null };
export type FunFactMine = {
  contract_version: 5; profile_id: string; enabled: boolean; can_submit: boolean; needs_birth: boolean; guardian_needed: boolean; has_guardian: boolean;
  verified: boolean; audience: FunFactAudience; effective_audience: FunFactAudience; max_live: 3; live: number; prompts: FunFactPrompt[]; facts: FunFact[];
};
export type FunFactReceipt = { contract_version: 5; fact: FunFact };
/** Distinct fans per completed month; null = fewer than 5 (hidden). */
export type FunFactBucket = '5+' | '10+' | '25+' | null;
export type FunFactCounts = { contract_version: 5; profile_id: string; facts: { id: string; prompt_key: FunFactPromptKey; months: { month: string; bucket: FunFactBucket }[] }[] };
export type FunFactExport = {
  contract_version: 5; profile_id: string; exported_at: string;
  facts: { id: string; prompt_key: FunFactPromptKey; answer_text: string | null; status: FunFactStatus; submitted_at: string; guardian_decision: 'approved' | 'declined' | null;
    guardian_decided_at: string | null; admin_decision: 'approved' | 'declined' | null; admin_decided_at: string | null; decline_reason: FunFactDeclineReason | null;
    cleared_at: string | null; clear_cause: 'withdrawn' | 'unlinked' | 'age_blocked' | 'account_deleted' | 'declined_purged' | null; look_reasons: string[] }[];
};
export type GuardianFunFacts = {
  contract_version: 5; profile_id: string;
  facts: { fact_id: string; minor_profile_id: string; first_name: string; prompt_key: FunFactPromptKey; label: string; answer_text: string; requested_at: string }[];
};
export type GuardianFunFactDecision = { contract_version: 5; fact_id: string; status: FunFactStatus };

/** Report reasons. 'private' ("Shares something private") is offered on fun facts only. */
export const TRIVIA_QUESTION_REPORT_REASONS = ['wrong_answer', 'confusing', 'not_okay', 'private'] as const;
export type TriviaQuestionReportReason = (typeof TRIVIA_QUESTION_REPORT_REASONS)[number];
export const TRIVIA_QUESTION_REPORT_LABELS: Record<TriviaQuestionReportReason, string> = {
  wrong_answer: 'Wrong answer', confusing: 'Confusing', not_okay: 'Not okay', private: 'Shares something private',
};
/** The reply never says whether the report counted or paused anything. */
export type TriviaQuestionReportReceipt = { contract_version: 5; outcome: 'reported' | 'already_reported' | 'paused'; question_id: string };

export type TriviaLearnStartInput = {
  athlete_player_id: string; sport: string | null; duration_seconds: 30 | 90; expected_week: string; notice_version: 'timed-trivia-v1-testing';
  request_id: string; session_secret: string; expected_profile_id: string;
};

// Admin ----------------------------------------------------------------------------------------------------------------------
export type FreshSelfHeal = { min_responders: number; too_easy_pct: number; confusing_choice4_pct: number; confusing_true_false_pct: number; too_long_pct: number };
/** Editable bounds (the server refuses anything outside them). */
export const FRESH_SELF_HEAL_BOUNDS: Record<keyof FreshSelfHeal, [number, number]> = {
  min_responders: [20, 200], too_easy_pct: [80, 100], confusing_choice4_pct: [5, 30], confusing_true_false_pct: [20, 45], too_long_pct: [20, 80],
};
export const FRESH_SELF_HEAL_DEFAULTS: FreshSelfHeal = { min_responders: 30, too_easy_pct: 95, confusing_choice4_pct: 15, confusing_true_false_pct: 35, too_long_pct: 40 };
export type FreshReportRules = {
  ordinary_reporters: number; fact_reporters: number; fact_reasons: string[]; restored_reporters: number; daily_pause_cap: number;
  min_account_days: number; per_account_per_day: number; reporter_clear_days: number; delete_days: number;
};
export type FreshSettingsInput = { athlete_questions_enabled: boolean; athlete_share_pct: number; reports_paused: boolean; self_heal: FreshSelfHeal };
export type FreshSettingsReceipt = FreshSettingsInput & { contract_version: 5; report_rules: FreshReportRules };
/** The snapshot's `fresh` block: settings, counts and today's alert topics. */
export type FreshStatus = FreshSettingsInput & {
  report_rules: FreshReportRules; needs_look_count: number; paused_count: number; facts_admin_review: number; facts_guardian_review: number; facts_live: number; imports_30d?: number; alerts: string[];
};
/** Weeks left per topic / sport / Life chapter; Refill needed under 4 weeks. 'assumed' pace = one full round a week. */
export type FreshRefillRow = {
  scope: 'topic' | 'sport' | 'chapter'; key: string; approved: number; pace_per_player_week: number; pace_source: 'measured' | 'assumed'; max_seen: number;
  weeks_left: number; refill_needed: boolean;
};

export type FactQueueGuardianStatus = 'not_needed' | 'no_guardian_yet' | 'pending' | 'lapsed' | 'approved' | 'declined';
export type FactQueueRow = {
  id: string; athlete_profile_id: string; first_name: string; age_band: string; verified: boolean; prompt_key: FunFactPromptKey; label: string;
  answer_text: string | null; status: FunFactStatus; guardian_status: FactQueueGuardianStatus; look_reasons: string[]; submitted_at: string;
  admin_decided_at: string | null; decline_reason: FunFactDeclineReason | null; cleared_at: string | null; question_id: string | null; paused: boolean;
};
export type FactQueue = { contract_version: 5; generated_at: string; counts: Record<FunFactStatus, number>; facts: FactQueueRow[] };
export type FactDecisionInput =
  | { action: 'approve'; reason: string; checklist: { no_sponsor_or_business: true; no_place: true; no_schedule: true } }
  | { action: 'decline'; reason: string; decline_reason: FunFactAdminDeclineReason };
export type FactDecisionReceipt = { contract_version: 5; fact_id: string; status: 'approved' | 'declined'; question_id: string | null };

export type NeedsLookFlag = 'too_easy' | 'confusing' | 'too_long';
export type NeedsLookRow = {
  question_id: string; question_key: string; version: number; topic_category: string; sport: string; chapter: string | null; question_type: string;
  status: 'draft' | 'approved'; is_fact: boolean; fact_id: string | null; prompt: string; options: string[]; correct_option: number;
  explanation: string; source_notes: string; education_only: boolean;
  paused_at: string | null; pause_reason: 'reports' | 'fact_report' | null; queued_at: string | null; restored_at: string | null;
  flags: NeedsLookFlag[]; difficulty: 'easy' | 'medium' | 'hard' | null; responders: number | null; right_pct: number | null; timeout_pct: number | null;
  reports: { open: number; counted: number; not_counted: number; wrong_answer: number; confusing: number; not_okay: number; private: number };
};
export type NeedsLook = { contract_version: 5; generated_at: string; min_responders: number; count: number; questions: NeedsLookRow[]; alerts: string[] };
export type NeedsLookAction = 'restore' | 'dismiss' | 'archive';
export type NeedsLookReceipt = { contract_version: 5; question_id: string; action: NeedsLookAction; needs_look: boolean; status: string };

export const IMPORT_MAX_ROWS = 200 as const;
export const IMPORT_MAX_BYTES = 65536 as const;
export type ImportRow = {
  topic_category: 'sport' | 'science' | 'geography' | 'general' | 'life'; sport?: string; chapter?: string; question_type: 'choice4' | 'true_false';
  prompt: string; options: string[]; correct_option: number; explanation: string; source_notes: string;
};
export type ImportRowResult = {
  index: number; status: 'ready' | 'imported' | 'refused'; problems: string[];
  warnings: { code: 'near_duplicate' | 'near_duplicate_in_batch'; question_id?: string; row?: number }[]; id: string | null;
};
export type ImportResult = {
  contract_version: 5; dry_run: boolean; rows_total: number; rows_ready: number; rows_refused: number; rows_warned: number; trivia_left: number; life_left: number; rows: ImportRowResult[];
};
