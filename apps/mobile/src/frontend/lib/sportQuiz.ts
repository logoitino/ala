/**
 * QUIZ-01 bound client adapter. Server owns weekly assignment, tester eligibility and private badge issuance.
 * Missing/malformed sources throw; this module never supplies a fallback question or invented counts.
 * @sideEffects Authenticated database RPCs via the shared callRpc binding; no telemetry, storage or payment calls.
 */
import { callRpc } from '@/lib/rpc';
import type {
  QuizAdminQuestion, QuizAdminSnapshot, QuizAudit, QuizQuestionAction, QuizQuestionPayload, QuizQuestionReceipt,
  QuizSettingsInput, QuizSettingsReceipt, QuizSnapshot,
} from '@shared/sportQuiz';
export type * from '@shared/sportQuiz';

const unavailable = () => new Error('Sport Pop Quiz data is unavailable. Refresh or contact Support.');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === 'string');
const countKeys = ['questions_draft','questions_approved','questions_archived','questions_void','week_issued','week_completed','week_skipped','week_void','badges_issued','badges_void'];
// Stored non-option SQL text uses ASCII-space btrim and Unicode character counts, including legacy rows.
const text = (value: unknown, min = 1, max = Infinity): value is string => typeof value === 'string'
  && Array.from(value.replace(/^ +| +$/g, '')).length >= min && Array.from(value.replace(/^ +| +$/g, '')).length <= max;
const nullableText = (value: unknown): value is string | null => value === null || text(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(value);
const cursor = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d*$/.test(value);

/** @purpose Match server option canonicalization; semantic legacy defects stay readable for safe repair. */
export function sportQuizOptionsIssue(options: string[]): string | null {
  const normalized = options.map(option => option.trim()); // Same explicit ECMAScript whitespace set as quiz_normalize_options.
  return options.length !== 4 || normalized.some(option => Array.from(option).length < 1 || Array.from(option).length > 100)
    || new Set(normalized).size !== 4 ? 'Invalid answer choices. Archive or void this version, or create a corrected draft; do not approve it.' : null;
}
/** @purpose Authoring bounds use the same Unicode counts/ASCII text bounds and canonical option rules as SQL. */
export function sportQuizContentValid(content: { sport: string; prompt: string; options: string[]; explanation: string }): boolean {
  return text(content.sport,2,80) && text(content.prompt,10,280) && text(content.explanation,10,500) && !sportQuizOptionsIssue(content.options);
}

function questionReceipt(value: unknown): value is QuizQuestionReceipt & Record<string, unknown> {
  return object(value) && text(value.id) && text(value.question_key)
    && typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version >= 1
    && typeof value.status === 'string' && ['draft','approved','archived','void'].includes(value.status);
}
function settingsReceipt(value: unknown): value is QuizSettingsReceipt & Record<string, unknown> {
  return object(value) && value.testing_only === true && typeof value.enabled === 'boolean'
    && strings(value.pilot_accounts) && value.pilot_accounts.length <= 100 && value.pilot_accounts.every(id => text(id))
    && new Set(value.pilot_accounts).size === value.pilot_accounts.length && (!value.enabled || value.pilot_accounts.length > 0);
}
/** @purpose Validate every Data field before the desk receives a typed question row. */
function adminQuestion(value: unknown): value is QuizAdminQuestion {
  return object(value) && questionReceipt(value) && text(value.sport, 2, 80) && text(value.prompt, 10, 280)
    && strings(value.options) && value.options.length === 4 && value.options.every(option => text(option, 1, 100))
    && typeof value.correct_option === 'number' && Number.isInteger(value.correct_option) && value.correct_option >= 0 && value.correct_option <= 3
    && text(value.explanation, 10, 500) && text(value.reason, 10, 500) && timestamp(value.created_at) && nullableText(value.created_by)
    && (value.reviewed_at === null || timestamp(value.reviewed_at)) && nullableText(value.reviewed_by);
}
function adminAudit(value: unknown): value is QuizAudit {
  return object(value) && cursor(value.id)
    && typeof value.action === 'string' && ['settings','question_create','question_edit','question_approve','question_archive','question_void','start','answer','skip'].includes(value.action)
    && nullableText(value.actor_id) && nullableText(value.question_id) && nullableText(value.reason) && timestamp(value.created_at);
}

/** @purpose Reject malformed/private-contract violations instead of rendering a pretend quiz. */
function snapshot(value: unknown): QuizSnapshot {
  if (!object(value) || value.testing_only !== true || !['ready','paused','not_enrolled','ineligible','unavailable'].includes(String(value.availability))
    || !['available','unavailable','issued','completed','skipped','void'].includes(String(value.status))
    || typeof value.week_start !== 'string' || typeof value.week_end !== 'string' || !strings(value.sports)
    || !Array.isArray(value.badges) || !Array.isArray(value.corrections)
    || value.badges.some(b => !object(b) || b.visibility !== 'private' || b.label !== 'Sport Learner')) throw unavailable();
  if (value.attempt !== null) {
    if (!object(value.attempt) || typeof value.attempt.id !== 'string') throw unavailable();
    const a = value.attempt;
    if (a.unavailable_reason !== undefined && !nullableText(a.unavailable_reason)) throw unavailable();
    if (a.result !== null && (a.status !== 'completed' || !object(a.result) || typeof a.result.explanation !== 'string')) throw unavailable();
    if (a.question !== null && (!object(a.question) || !strings(a.question.options) || a.question.options.length !== 4
      || 'correct_option' in a.question || 'explanation' in a.question)) throw unavailable();
  }
  return value as unknown as QuizSnapshot;
}

/** @purpose Own-scoped week, prompt, completion and private badge state. */
export async function fetchSportQuiz(): Promise<QuizSnapshot> { return snapshot(await callRpc('quiz_snapshot')); }
/** @purpose Start once per UTC account week; the server reuses an existing assignment or skip. */
export async function startSportQuiz(sport: string): Promise<QuizSnapshot> { return snapshot(await callRpc('quiz_start', { p_sport: sport })); }
/** @purpose Preserve exact answer/request identity; caller retains this request across uncertain success retries. */
export async function answerSportQuiz(attemptId: string, option: number, requestId: string): Promise<QuizSnapshot> {
  return snapshot(await callRpc('quiz_answer', { p_attempt_id: attemptId, p_option: option, p_request_id: requestId }));
}
/** @purpose Dismiss this UTC week without losing existing badges or another app capability. */
export async function skipSportQuiz(): Promise<QuizSnapshot> { return snapshot(await callRpc('quiz_skip')); }

/** @purpose Full bounded admin bank/counts and audit cursor, with no participant answer/identity list. */
export async function fetchSportQuizAdmin(before: string | null = null): Promise<QuizAdminSnapshot> {
  const value = await callRpc<unknown>('quiz_admin_snapshot', { p_before: before });
  if (!object(value) || !timestamp(value.generated_at) || !date(value.week_start) || !date(value.week_end)
    || !settingsReceipt(value.settings) || !text(value.settings.reason, 10, 500) || !timestamp(value.settings.updated_at) || !nullableText(value.settings.updated_by)
    || !Array.isArray(value.questions) || value.questions.length > 100 || !value.questions.every(adminQuestion)
    || !Array.isArray(value.audit) || value.audit.length > 50 || !value.audit.every(adminAudit)
    || (value.next_before !== null && !cursor(value.next_before))
    || !object(value.counts) || !countKeys.every(key => {
      const n = (value.counts as Record<string, unknown>)[key];
      return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
    })) throw unavailable();
  return value as unknown as QuizAdminSnapshot;
}
/** @purpose Restrict local testing to explicit canonical profile IDs; server refuses production mode and empty enable. */
export async function saveSportQuizSettings(payload: QuizSettingsInput, reason: string): Promise<QuizSettingsReceipt> {
  const value = await callRpc<unknown>('quiz_admin_settings', { p_payload: payload, p_reason: reason });
  if (!settingsReceipt(value)) throw unavailable();
  return value;
}
/** @purpose Draft/create new version, fact approval, archive or irreversible correction/void with authoritative audit. */
export async function saveSportQuizQuestion(id: string | null, action: QuizQuestionAction, payload: QuizQuestionPayload): Promise<QuizQuestionReceipt> {
  const value = await callRpc<unknown>('quiz_admin_question', { p_id: id, p_action: action, p_payload: payload });
  if (!questionReceipt(value)) throw unavailable();
  return value;
}
