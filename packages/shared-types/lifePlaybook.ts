/** QUIZ-04 Life Playbook wire contract: round kinds, the private opt-in, chapters, levels and the admin Life desk.
 * @purpose Life content teaches simple everyday money facts in sports terms (owner simplification 2026-10-15): four
 * chapters, all 13+, each opening with 5 approved questions (one round). One admin approves a Life question like any
 * trivia question; the server runs the Life copy rules. Admin statistics are aggregate only (small cells null + hidden).
 */
import type { TimedQuizAttemptSummary, TimedQuizRoundKind } from './timedSportQuiz';

export const LIFE_NOTICE_VERSION = 'life-playbook-v1-testing' as const;
export const LIFE_DURATIONS = [30, 90] as const;
export const LIFE_DEFAULT_DURATION = 90 as const;
export const LIFE_CHAPTER_IDS = ['money_huddle', 'savings_season', 'scam_defense', 'smart_plays'] as const;
export type LifeChapterId = (typeof LIFE_CHAPTER_IDS)[number];
export const LIFE_LEVELS = ['rookie', 'varsity', 'all_star', 'pro', 'hall_of_fame'] as const;
export type LifeLevel = (typeof LIFE_LEVELS)[number];
export const LIFE_LEVEL_LABELS: Record<LifeLevel, string> = { rookie: 'Rookie', varsity: 'Varsity', all_star: 'All-Star', pro: 'Pro', hall_of_fame: 'Hall of Fame' };
export type LifeLevelThresholds = Record<LifeLevel, number>;
export const LIFE_DEFAULT_THRESHOLDS: LifeLevelThresholds = { rookie: 0, varsity: 15, all_star: 40, pro: 80, hall_of_fame: 150 };
/** A chapter opens with this many approved questions (one round). */
export const LIFE_OPEN_AT = 5 as const;
/** Every Life chapter and question is 13+. */
export type LifeAgeBand = '13';
/** Server copy-rule names returned in "quiz_life_copy: ..." refusals at approval. */
export const LIFE_COPY_RULES = ['non_latin_text', 'advice_you_should', 'brand_name', 'tapuai_money_word', 'nil_eligibility', 'tax_loan_credit', 'money_figure', 'year',
  'scam_missing_report_line', 'prompt_too_long', 'explanation_too_long'] as const;
export type LifeCopyRule = (typeof LIFE_COPY_RULES)[number];

/** Life columns on an admin question row (null / false on trivia questions); fixed on a version once created. */
export type LifeQuestionFields = { chapter: LifeChapterId | null; min_age_band: LifeAgeBand | null; education_only: boolean };
/** Admin create / edit input for a Life question (topic_category 'life'; the server sets sport to the chapter title). */
export type LifeQuestionInput = { chapter?: LifeChapterId; min_age_band?: LifeAgeBand; education_only?: boolean };

export type LifePreferences = { life_opt_in: boolean; life_notice_version: string | null; life_opted_in_at: string | null; life_version: number };
export type LifeAvailability = 'ineligible' | 'unavailable' | 'paused' | 'not_enrolled' | 'off' | 'not_opted_in' | 'empty' | 'ready';
export type LifeSnapshot = {
  contract_version: 4; profile_id: string | null; server_now: string; week_start: string; week_end: string; testing_only: true;
  availability: LifeAvailability; notice_version: typeof LIFE_NOTICE_VERSION; preferences: LifePreferences | null;
  week_spent: boolean; attempt: TimedQuizAttemptSummary | null; active_round_kind: TimedQuizRoundKind | null;
  default_duration_seconds: 90; round_size: number; chapters_open: number; unseen_count: number;
};
/** Participant chapter: no admin note, sign-off, reviewer or refusal-reason fields. */
export type LifeChapter = { id: LifeChapterId; title: string; framing: string; position: number; open: boolean; unseen_count: number };
export type LifeChapters = { contract_version: 4; profile_id: string; chapters: LifeChapter[] };
export type LifeChapterProgress = {
  id: LifeChapterId; title: string; approved_count: number; seen_count: number; progress: number; facts: number;
  rank: number; level: LifeLevel; level_label: string; badge_earned: boolean;
};
export type LifeProgress = { contract_version: 4; profile_id: string; thresholds: LifeLevelThresholds; chapters: LifeChapterProgress[] };
export type TriviaLevel = {
  contract_version: 4; profile_id: string; facts: number; rank: number; level: LifeLevel; level_label: string;
  next_level: LifeLevel | null; next_at: number | null; thresholds: LifeLevelThresholds; reached_at: string | null;
};
export type LifePreferencesReceipt = { contract_version: 4; profile_id: string; outcome: 'saved' | 'unchanged'; preferences: LifePreferences };
export type LifeStartInput = {
  expected_week: string; request_id: string; session_secret: string; expected_profile_id: string;
  notice_version: typeof LIFE_NOTICE_VERSION; chapter: LifeChapterId | null; duration_seconds: 30 | 90;
};

// Admin ---------------------------------------------------------------------------------------------------------------
export type LifeSettingsInput = { life_enabled: boolean; level_thresholds: LifeLevelThresholds };
export type LifeSettingsReceipt = LifeSettingsInput & { contract_version: 4 };
export type LifeChapterState = {
  approved_count: number; needs_more: number; ready: boolean; switched_open: boolean; open: boolean;
  /** Plain reasons a chapter cannot open, e.g. "needs 3 more approved questions". */
  reasons: string[];
};
export type LifeAdminChapter = LifeChapterState & { id: LifeChapterId; title: string; framing: string; position: number; updated_at: string; draft_count: number };
export type LifeChapterReceipt = LifeChapterState & { contract_version: 4; chapter: LifeChapterId };
/** Aggregate only; a small cell is { players: null, hidden: true }. */
export type LifeAdminStats = {
  opted_in: number | null; week_life_rounds: number | null;
  questions: { question_id: string; chapter: LifeChapterId; responders: number; correct_share: number }[];
  questions_hidden: number;
  cells: { age_band: 'teen_13_15' | 'teen_16_17' | 'adult' | 'no_age'; chapter: LifeChapterId; players: number | null; hidden: boolean }[];
  levels: { level: LifeLevel; label: string; players: number | null; hidden: boolean }[];
};
export type LifeAdminSnapshot = {
  contract_version: 4; generated_at: string;
  settings: { life_enabled: boolean; level_thresholds: LifeLevelThresholds; round_size: number; enabled: boolean };
  life_cap: 200; life_active_total: number; open_at: typeof LIFE_OPEN_AT; chapters: LifeAdminChapter[]; stats: LifeAdminStats;
};
