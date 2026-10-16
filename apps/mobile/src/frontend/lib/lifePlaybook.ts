/**
 * QUIZ-04 Life Playbook adapter: the Life round Start, the private opt-in, chapters, progress, the personal level and
 * the admin Life desk (switch, thresholds, chapters, aggregate statistics). Owner simplification 2026-10-15: one admin
 * approves Life questions like trivia (no sign-offs or named reviewers; those wrappers are archived).
 * The server owns time, eligibility, chapter opening and every approval rule; malformed data throws and nothing is
 * invented here. Rounds after Start reuse the QUIZ-03 adapter (answer, Next, End with round_kind 'life').
 * The admin "Add a question" form checks Life drafts with the shared copy rules (`lifeCopyCheck`, 2026-10-15).
 * @sideEffects Authenticated database RPCs via the shared callRpc binding; no telemetry, storage or payment calls.
 */
import { callRpc } from '@/lib/rpc';
import { checkStartReceipt } from '@/lib/sportQuiz';
import type { TimedQuizStartReceipt } from '@shared/timedSportQuiz';
import {
  LIFE_CHAPTER_IDS, LIFE_COPY_RULES, LIFE_LEVELS, LIFE_OPEN_AT,
  type LifeSnapshot, type LifeChapters, type LifeProgress, type TriviaLevel, type LifePreferencesReceipt, type LifeStartInput,
  type LifeAdminSnapshot, type LifeSettingsInput, type LifeSettingsReceipt, type LifeChapterReceipt,
  type LifeCopyRule, type LifeLevelThresholds, type LifeChapterId,
} from '@shared/lifePlaybook';
export * from '@shared/lifePlaybook';
import { lifeCopyLength, lifeCopyProblems, type LifeCopyRuleSet } from '@shared/lifeCopyRules';
// The one rule file (also embedded in SQL and read by scripts/life-bank-sql.mjs); the desk checks drafts with it before saving.
import lifeRulesFile from '../../../../../supabase/content/life_copy_rules.json';

const LIFE_RULES: LifeCopyRuleSet = lifeRulesFile;
/** Life prompt / explanation upper limits from the rule file (120 / 200 today). */
export const LIFE_COPY_LIMITS = { prompt: LIFE_RULES.prompt_max, explanation: LIFE_RULES.explanation_max } as const;
/** @purpose Run the shared Life copy rules on a draft before it is saved; the server runs the same list at approval. */
export function lifeCopyCheck(item: { prompt: string; options: string[]; explanation: string; chapter: LifeChapterId }): LifeCopyRule[] {
  return lifeCopyProblems(LIFE_RULES, item).filter((x): x is LifeCopyRule => (LIFE_COPY_RULES as readonly string[]).includes(x));
}
/** @purpose Codepoint length after trimming, the way the server counts Life text. */
export const lifeTextLength = lifeCopyLength;

const unavailable = () => new Error('Life Playbook data is unavailable. Refresh or contact Support.');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown, min = 1, max = Infinity): v is string => typeof v === 'string' && Array.from(v.trim()).length >= min && Array.from(v.trim()).length <= max;
const nullableText = (v: unknown) => v === null || text(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && timestamp(v);
const chapterId = (v: unknown): v is LifeChapterId => LIFE_CHAPTER_IDS.includes(v as LifeChapterId);
const level = (v: unknown) => LIFE_LEVELS.includes(v as (typeof LIFE_LEVELS)[number]);
const kinds = ['personal', 'group', 'life'];
// Prompt capabilities and hashes are never legal fields in these reads.
const hasSecret = (v: unknown): boolean => Array.isArray(v) ? v.some(hasSecret)
  : object(v) && Object.entries(v).some(([k, x]) => /^(hash|.*_hash|.*(?:secret|token|capability)(?:_digest)?)$/i.test(k) || hasSecret(x));

/** @purpose Five strictly increasing integer thresholds starting at Rookie 0, the same rule as quiz_thresholds_ok. */
export function lifeThresholdsValid(t: unknown): t is LifeLevelThresholds {
  if (!object(t) || Object.keys(t).length !== LIFE_LEVELS.length) return false;
  let prev = -1;
  for (const key of LIFE_LEVELS) {
    const v = t[key];
    if (!integer(v) || v > 99999 || (key === 'rookie' && v !== 0) || v <= prev) return false;
    prev = v;
  }
  return true;
}
/** @purpose Read the broken copy rules out of a server "quiz_life_copy: rule, rule" refusal so the desk can explain them. */
export function lifeCopyRules(message: string): LifeCopyRule[] {
  const m = /quiz_life_copy: ([a-z_, ]+)/.exec(message);
  return m ? m[1].split(',').map(x => x.trim()).filter((x): x is LifeCopyRule => (LIFE_COPY_RULES as readonly string[]).includes(x)) : [];
}
function preferences(v: unknown): boolean {
  return object(v) && typeof v.life_opt_in === 'boolean' && nullableText(v.life_notice_version) && (v.life_opted_in_at === null || timestamp(v.life_opted_in_at)) && integer(v.life_version);
}
function attemptSummary(v: unknown): boolean {
  return v === null || (object(v) && text(v.id) && date(v.week_start) && typeof v.status === 'string' && !('question' in v) && !('prompt' in v)
    && (v.round_kind === undefined || kinds.includes(String(v.round_kind))));
}

/** @purpose Own Life availability, private opt-in and this week's Life opportunity; never names a hidden chapter. */
export async function fetchLifeSnapshot(): Promise<LifeSnapshot> {
  const v = await callRpc<unknown>('quiz_life_snapshot');
  if (!object(v) || v.contract_version !== 4 || hasSecret(v) || !timestamp(v.server_now) || !date(v.week_start) || !date(v.week_end) || v.testing_only !== true
    || !['ineligible', 'unavailable', 'paused', 'not_enrolled', 'off', 'not_opted_in', 'empty', 'ready'].includes(String(v.availability))
    || v.notice_version !== 'life-playbook-v1-testing' || !(v.preferences === null || preferences(v.preferences)) || typeof v.week_spent !== 'boolean'
    || !attemptSummary(v.attempt) || !(v.active_round_kind === null || kinds.includes(String(v.active_round_kind)))
    || !integer(v.chapters_open) || !integer(v.unseen_count) || !integer(v.round_size)) throw unavailable();
  return v as unknown as LifeSnapshot;
}
/** @purpose Age-allowed chapters only, with open state and unseen counts. */
export async function fetchLifeChapters(): Promise<LifeChapters> {
  const v = await callRpc<unknown>('quiz_life_chapters');
  if (!object(v) || v.contract_version !== 4 || !text(v.profile_id) || !Array.isArray(v.chapters)
    || !v.chapters.every(c => object(c) && chapterId(c.id) && text(c.title, 2, 80) && typeof c.framing === 'string'
      && integer(c.position) && typeof c.open === 'boolean' && integer(c.unseen_count))) throw unavailable();
  // Keep only participant fields, so an admin field can never reach the app from this read.
  return { contract_version: 4, profile_id: v.profile_id, chapters: (v.chapters as Record<string, unknown>[]).map(c => ({ id: c.id, title: c.title, framing: c.framing,
    position: c.position, open: c.open, unseen_count: c.unseen_count })) } as LifeChapters;
}
/** @purpose Own chapter progress (share of approved questions seen) and the highest chapter level reached. */
export async function fetchLifeProgress(): Promise<LifeProgress> {
  const v = await callRpc<unknown>('quiz_life_progress');
  if (!object(v) || v.contract_version !== 4 || !text(v.profile_id) || !lifeThresholdsValid(v.thresholds) || !Array.isArray(v.chapters)
    || !v.chapters.every(c => object(c) && chapterId(c.id) && text(c.title) && integer(c.approved_count) && integer(c.seen_count)
      && typeof c.progress === 'number' && c.progress >= 0 && c.progress <= 1 && integer(c.facts) && integer(c.rank) && c.rank <= 4 && level(c.level)
      && text(c.level_label) && typeof c.badge_earned === 'boolean')) throw unavailable();
  return v as unknown as LifeProgress;
}
/** @purpose Own personal level across every round kind; it only goes up. */
export async function fetchTriviaLevel(): Promise<TriviaLevel> {
  const v = await callRpc<unknown>('quiz_level');
  if (!object(v) || v.contract_version !== 4 || !text(v.profile_id) || !integer(v.facts) || !integer(v.rank) || v.rank > 4 || !level(v.level) || !text(v.level_label)
    || !(v.next_level === null || level(v.next_level)) || !(v.next_at === null || integer(v.next_at)) || !lifeThresholdsValid(v.thresholds)
    || !(v.reached_at === null || timestamp(v.reached_at))) throw unavailable();
  return v as unknown as TriviaLevel;
}
/** @purpose Private Life opt-in with its own CAS version; opting out ends an open Life round. */
export async function saveLifePreferences(optIn: boolean, expectedVersion: number, expectedProfileId: string): Promise<LifePreferencesReceipt> {
  const v = await callRpc<unknown>('quiz_life_preferences', { p_opt_in: optIn, p_notice_version: optIn ? 'life-playbook-v1-testing' : null,
    p_expected_version: expectedVersion, p_expected_profile_id: expectedProfileId });
  if (!object(v) || v.contract_version !== 4 || v.profile_id !== expectedProfileId || !['saved', 'unchanged'].includes(String(v.outcome))
    || !preferences(v.preferences) || (v.preferences as Record<string, unknown>).life_opt_in !== optIn) throw unavailable();
  return v as unknown as LifePreferencesReceipt;
}
/** @purpose Start this week's Life round (90 s default, 30 allowed); only this Start can return the live first prompt. */
export async function startLifeRound(input: LifeStartInput): Promise<TimedQuizStartReceipt> {
  const v = await callRpc<unknown>('quiz_life_start', { p_expected_week: input.expected_week, p_request_id: input.request_id, p_session_secret: input.session_secret,
    p_expected_profile_id: input.expected_profile_id, p_notice_version: input.notice_version, p_chapter: input.chapter, p_duration_seconds: input.duration_seconds });
  const r = checkStartReceipt(v, input.expected_profile_id, input.request_id);
  if (r.attempt && r.attempt.round_kind !== undefined && r.attempt.round_kind !== 'life') throw unavailable();
  return r;
}

// Admin -------------------------------------------------------------------------------------------------------------------
function chapterState(c: unknown): boolean {
  return object(c) && integer(c.approved_count) && integer(c.needs_more)
    && typeof c.ready === 'boolean' && typeof c.switched_open === 'boolean' && typeof c.open === 'boolean' && Array.isArray(c.reasons) && c.reasons.every(r => text(r))
    && (!c.open || c.ready);
}
const cell = (c: unknown) => object(c) && (c.players === null ? c.hidden === true : integer(c.players) && c.players >= 10 && c.hidden === false);
/** @purpose Admin Life desk read; statistics must arrive aggregate (small cells null + hidden, >= 20 responders per question). */
export async function fetchLifeAdmin(): Promise<LifeAdminSnapshot> {
  const v = await callRpc<unknown>('quiz_admin_life_snapshot');
  const st = object(v) && object(v.stats) ? v.stats : null;
  if (!object(v) || v.contract_version !== 4 || hasSecret(v) || !timestamp(v.generated_at) || !object(v.settings)
    || typeof v.settings.life_enabled !== 'boolean' || !lifeThresholdsValid(v.settings.level_thresholds) || v.life_cap !== 200 || !integer(v.life_active_total)
    || v.open_at !== LIFE_OPEN_AT
    || !Array.isArray(v.chapters) || !v.chapters.every(c => object(c) && chapterId(c.id) && text(c.title) && integer(c.draft_count) && chapterState(c))
    || !st || !(st.opted_in === null || (integer(st.opted_in) && st.opted_in >= 10)) || !integer(st.questions_hidden)
    || !Array.isArray(st.questions) || !st.questions.every(q => object(q) && text(q.question_id) && integer(q.responders) && q.responders >= 20)
    || !Array.isArray(st.cells) || !st.cells.every(cell) || !Array.isArray(st.levels) || !st.levels.every(l => cell(l) && level((l as Record<string, unknown>).level))) throw unavailable();
  return v as unknown as LifeAdminSnapshot;
}
/** @purpose trivia.life switch and level thresholds with an audited reason; switching off ends open Life rounds. */
export async function saveLifeSettings(input: LifeSettingsInput, reason: string, expectedActorId: string): Promise<LifeSettingsReceipt> {
  const v = await callRpc<unknown>('quiz_admin_life_settings', { p_payload: input, p_reason: reason, p_expected_actor_id: expectedActorId });
  if (!object(v) || v.contract_version !== 4 || typeof v.life_enabled !== 'boolean' || !lifeThresholdsValid(v.level_thresholds)) throw unavailable();
  return { contract_version: 4, life_enabled: v.life_enabled, level_thresholds: v.level_thresholds };
}
/** @purpose Open or close one chapter; the server refuses to open it until it is ready (reasons in the error). */
export async function setLifeChapterOpen(chapter: LifeChapterId, open: boolean, reason: string, expectedActorId: string): Promise<LifeChapterReceipt> {
  const v = await callRpc<unknown>('quiz_admin_life_chapter', { p_chapter: chapter, p_open: open, p_reason: reason, p_expected_actor_id: expectedActorId });
  if (!object(v) || v.contract_version !== 4 || v.chapter !== chapter || !chapterState(v) || v.switched_open !== open) throw unavailable();
  return v as unknown as LifeChapterReceipt;
}
