/** QUIZ-02 wire contract: private timed learning, exact recovery and bounded admin inventory.
 * @purpose Keeps active prompts confined to the original Start capability; account reads are sanitized.
 */
export const TIMED_QUIZ_NOTICE_VERSION = 'timed-trivia-v1-testing' as const;
export const TIMED_QUIZ_DURATIONS = [30, 90] as const;
export type TimedQuizTopic = 'sport' | 'science' | 'geography' | 'general';
export type TimedQuizStatus = 'issued' | 'completed' | 'skipped' | 'void' | 'ended' | 'expired';
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
  id: string; week_start: string; mode: 'legacy' | 'timed'; status: TimedQuizStatus;
  started_at: string | null; expires_at: string | null; duration_seconds: 30 | 90 | null;
  closed_at: string | null; close_reason: string | null; effective_expired: boolean;
  correction_reason: string | null;
};
export type TimedQuizPool = { topic_category: TimedQuizTopic; sport: string; unseen_count: number; allowed: boolean };
export type TimedQuizSnapshot = {
  contract_version: 2; profile_id: string | null; server_now: string; week_start: string; week_end: string;
  testing_only: true; availability: 'ready' | 'paused' | 'not_enrolled' | 'ineligible' | 'unavailable';
  preferences: TimedQuizPreferences; attempt: TimedQuizAttemptSummary | null;
  week_spent: boolean; scheduled_topic: 'sport' | 'fun'; pools: TimedQuizPool[];
  history_version: number; history_count: number; badge_count: number; correction_count: number;
};
export type TimedQuizQuestion = {
  id: string; question_key: string; version: number; topic_category: TimedQuizTopic;
  sport: string; prompt: string; options: [string, string, string, string];
};
export type TimedQuizResult = {
  answered_option: number | null; correct_option: number; was_correct: boolean | null;
  explanation: string; completed_at: string | null;
};
export type TimedQuizOperation = 'preferences' | 'invitation' | 'start' | 'answer' | 'end' | 'skip';
/** Receipts never carry a prompt. Only the separate Start extension can carry one. */
export type TimedQuizReceipt = {
  contract_version: 2; profile_id: string; request_id: string; operation: TimedQuizOperation;
  outcome: string; week_start: string; committed_at: string;
  attempt: TimedQuizAttemptSummary | null; result: TimedQuizResult | null;
  preferences: TimedQuizPreferences | null;
};
export type TimedQuizStartReceipt = TimedQuizReceipt & { server_now: string; active_question: TimedQuizQuestion | null };
export type TimedQuizHistoryItem = {
  attempt: TimedQuizAttemptSummary; question: TimedQuizQuestion | null; result: TimedQuizResult | null;
  badge: { id: string; label: 'Sport Learner' | 'Trivia Explorer'; visibility: 'private'; issued_at: string; voided_at: string | null } | null;
};
export type TimedQuizHistoryPage = {
  contract_version: 2; profile_id: string; server_now: string; history_version: number;
  total: number; items: TimedQuizHistoryItem[]; next_before: string | null;
};
export type TimedQuizEraseReceipt = {
  contract_version: 2; profile_id: string; history_version: number; week_start: string;
  week_spent: true; quota_prune_after: string; removed_attempts: number; removed_exposures: number;
  removed_badges: number; removed_requests: number; removed_audit: number;
};
export type TimedQuizAdminQuestion = TimedQuizQuestion & {
  correct_option: number; explanation: string; source_notes: string; reason: string;
  status: 'draft' | 'approved' | 'archived' | 'void'; created_at: string; created_by: string | null;
  reviewed_at: string | null; reviewed_by: string | null;
};
export type TimedQuizAdminQuestionInput = {
  reason: string; sport?: string; prompt?: string; options?: [string,string,string,string];
  correct_option?: number; explanation?: string; topic_category?: TimedQuizTopic; source_notes?: string;
  family_action?: 'new' | 'existing'; question_key?: string;
};
export type TimedQuizAdminQuestionReceipt = { id: string; question_key: string; version: number; status: TimedQuizAdminQuestion['status'] };
export type TimedQuizSettingsReceipt = { contract_version: 2; enabled: boolean; testing_only: true; pilot_accounts: string[] };
export type TimedQuizAdminSnapshot = {
  contract_version: 2; generated_at: string; week_start: string; week_end: string;
  settings: (TimedQuizSettingsReceipt & { reason: string; updated_at: string; updated_by: string | null }) | null;
  questions: TimedQuizAdminQuestion[]; question_total: number; question_cap: 100; next_question_cursor: string | null;
  audit: { id: string; action: string; actor_id: string | null; question_id: string | null; reason: string | null; created_at: string }[];
  next_before: string | null;
  counts: Record<'questions_draft'|'questions_approved'|'questions_archived'|'questions_void'|'week_issued'|'week_completed'|'week_skipped'|'week_void'|'week_ended'|'week_expired'|'badges_issued'|'badges_void'|'preferences_weekly'|'exposures'|'week_spent'|'retained_guards'|'retained_requests',number>;
  pools: { topic_category: TimedQuizTopic; sport: string; approved_count: number }[];
};
export type TimedQuizRetentionReceipt = { contract_version: 2; removed_guards: number; removed_requests: number; preserved_guards: number; batch_limit: 500 };
export type TimedQuizStartInput = { topic_category: TimedQuizTopic; sport: string | null; duration_seconds: 30|90; expected_week: string; notice_version: typeof TIMED_QUIZ_NOTICE_VERSION; request_id: string; session_secret: string; expected_profile_id: string };
export type TimedQuizAnswerInput = { attempt_id: string; option: number; request_id: string; session_secret: string; expected_profile_id: string };
export type TimedQuizEndInput = { attempt_id: string | null; start_request_id: string | null; expected_week: string; reason: 'user_end'|'left_page'|'background'|'identity_change'; request_id: string; expected_profile_id: string };
