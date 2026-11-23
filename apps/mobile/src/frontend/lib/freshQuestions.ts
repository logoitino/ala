/**
 * UX-14: optional captured clients preserve initiating-account transport without changing existing payloads.
 * QUIZ-05 fresh questions adapter: fun facts (Know your athlete) for athletes, guardians and admins; question reports;
 * the Learn-card Start; Needs a look; bulk import and the fresh-question settings. The server owns every rule (audience,
 * guardian order, text filter, thresholds, caps); malformed data throws and nothing is invented here.
 * Design: docs/engineering/design/TRIVIA_FRESH_QUESTIONS_DESIGN.md (§6 overrides §1–§5).
 * @sideEffects Authenticated database RPCs via the shared callRpc binding; no telemetry, storage or payment calls.
 */
import { callRpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import { checkStartReceipt } from '@/lib/sportQuiz';
import type { TimedQuizStartReceipt } from '@shared/timedSportQuiz';
import {
  FUN_FACT_PROMPTS, FUN_FACT_TEXT_CODES, FRESH_SELF_HEAL_BOUNDS, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, TRIVIA_QUESTION_REPORT_REASONS,
  type FactDecisionInput, type FactDecisionReceipt, type FactQueue, type FreshSelfHeal, type FreshSettingsInput, type FreshSettingsReceipt,
  type FunFact, type FunFactCounts, type FunFactExport, type FunFactMine, type FunFactPromptKey, type FunFactReceipt, type FunFactTextCode,
  type GuardianFunFactDecision, type GuardianFunFacts, type ImportResult, type ImportRow, type NeedsLook, type NeedsLookAction, type NeedsLookReceipt,
  type TriviaLearnStartInput, type TriviaQuestionReportReason, type TriviaQuestionReportReceipt,
} from '@shared/freshQuestions';
export * from '@shared/freshQuestions';

const unavailable = () => new Error('Trivia fresh-question data is unavailable. Refresh or contact Support.');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const nullableText = (v: unknown) => v === null || text(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const promptKey = (v: unknown): v is FunFactPromptKey => (FUN_FACT_PROMPTS as readonly string[]).includes(String(v));
// Capabilities and hashes are never legal fields in these reads.
const hasSecret = (v: unknown): boolean => Array.isArray(v) ? v.some(hasSecret)
  : object(v) && Object.entries(v).some(([k, x]) => /^(hash|.*_hash|.*(?:secret|token|capability|salt)(?:_digest)?)$/i.test(k) || hasSecret(x));
const checked = <T>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T => {
  if (!object(v) || v.contract_version !== 5 || hasSecret(v) || !ok(v)) throw unavailable();
  return v as T;
};
const funFact = (f: unknown) => object(f) && text(f.id) && promptKey(f.prompt_key) && (f.answer_text === null || typeof f.answer_text === 'string')
  && ['waiting_guardian', 'guardian_review', 'admin_review', 'approved', 'declined', 'withdrawn', 'removed', 'paused'].includes(String(f.status));

/** @purpose Read the refusal codes out of a server "quiz_fact_text: code, code" error so screens can explain them. */
export function funFactTextCodes(message: string): FunFactTextCode[] {
  const m = /quiz_fact_text:\s*([a-z_,\s]+)/.exec(message);
  return m ? m[1].split(',').map(x => x.trim()).filter((x): x is FunFactTextCode => (FUN_FACT_TEXT_CODES as readonly string[]).includes(x)) : [];
}
/** Plain words for each refusal (VOICE: no money words; the same list the admin desk shows). */
export const FUN_FACT_TEXT_WORDS: Record<FunFactTextCode, string> = {
  length: 'Use 2 to 40 characters.', emoji_or_non_latin: 'Use plain letters only, without emoji.', link: 'No links or websites.',
  handle_or_email: 'No @handles, hashtags or emails.', digits: 'No numbers (that keeps phone numbers, addresses and times out).',
  address: 'No street or address words.', weekday_or_time: 'No days or times.', school_or_city: 'Leave out your school or town.',
  not_okay_word: 'That word is not okay here.', money_word: 'Leave out donation and money words.', brand: 'No brand or company names.',
  not_on_list: 'Pick one from the list.', matches_wrong_option: 'That is too close to one of the other choices. Try different words.',
  prompt_invalid: 'Pick one of the prompts.',
};

// Participants -------------------------------------------------------------------------------------------------------------
/** @purpose Start the personal weekly round from an athlete's "Learn {sport} with {name}" card; the server validates the athlete. */
export async function startTriviaFromLearnCard(input: TriviaLearnStartInput): Promise<TimedQuizStartReceipt> {
  const v = await callRpc<unknown>('quiz_learn_start', { p_athlete_player_id: input.athlete_player_id, p_sport: input.sport, p_duration_seconds: input.duration_seconds,
    p_expected_week: input.expected_week, p_notice_version: input.notice_version, p_request_id: input.request_id, p_session_secret: input.session_secret,
    p_expected_profile_id: input.expected_profile_id });
  return checkStartReceipt(v, input.expected_profile_id, input.request_id);
}
/** @purpose "Report a problem with this question" after the reveal; the reply never says whether it counted. */
export async function reportTriviaQuestion(questionId: string, reason: TriviaQuestionReportReason, expectedProfileId: string): Promise<TriviaQuestionReportReceipt> {
  if (!(TRIVIA_QUESTION_REPORT_REASONS as readonly string[]).includes(reason)) throw unavailable();
  const v = await callRpc<unknown>('quiz_report', { p_question_id: questionId, p_reason: reason, p_expected_profile_id: expectedProfileId });
  return checked<TriviaQuestionReportReceipt>(v, x => ['reported', 'already_reported', 'paused'].includes(String(x.outcome)) && x.question_id === questionId);
}
const factReceipt = (v: unknown) => checked<FunFactReceipt>(v, x => funFact(x.fact));
/** @purpose Share (or edit an unsent draft of) a fun fact; under 16 it goes to the linked guardian first. */
export async function submitFunFact(prompt: FunFactPromptKey, answer: string, expectedProfileId: string): Promise<FunFact> {
  return factReceipt(await callRpc('quiz_fact_submit', { p_prompt_key: prompt, p_answer: answer, p_expected_profile_id: expectedProfileId })).fact;
}
/** @purpose Remove a fun fact (athlete only): the text is cleared now and it stops being drawn. */
export async function withdrawFunFact(factId: string, expectedProfileId: string): Promise<FunFact> {
  return factReceipt(await callRpc('quiz_fact_withdraw', { p_fact_id: factId, p_expected_profile_id: expectedProfileId })).fact;
}
/** @purpose The athlete's own facts, prompts, limits and switch state. */
export async function fetchMyFunFacts(): Promise<FunFactMine> {
  return checked<FunFactMine>(await callRpc('quiz_fact_mine'), x => text(x.profile_id) && typeof x.enabled === 'boolean' && integer(x.live) && x.max_live === 3
    && Array.isArray(x.prompts) && x.prompts.every(p => object(p) && promptKey(p.key) && text(p.label)) && Array.isArray(x.facts) && x.facts.every(funFact));
}
/** @purpose Completed-month buckets per live fact (null = under 5 fans; never who). */
export async function fetchFunFactCounts(): Promise<FunFactCounts> {
  return checked<FunFactCounts>(await callRpc('quiz_fact_counts'), x => Array.isArray(x.facts) && x.facts.every(f => object(f) && text(f.id)
    && Array.isArray(f.months) && f.months.every(m => object(m) && /^\d{4}-\d{2}$/.test(String(m.month)) && [null, '5+', '10+', '25+'].includes(m.bucket as string | null))));
}
/** @purpose Data export: every fact and decision (withdrawn text is already gone). */
export async function exportMyFunFacts(): Promise<FunFactExport> {
  return checked<FunFactExport>(await callRpc('quiz_fact_export'), x => text(x.profile_id) && Array.isArray(x.facts));
}
/** @purpose Guardian: fun facts waiting for this guardian's approve / decline (teens they supervise). */
export async function fetchGuardianFunFacts(client = supabase): Promise<GuardianFunFacts> {
  return checked<GuardianFunFacts>(await callRpc('quiz_fact_guardian_pending', {}, client), x => Array.isArray(x.facts) && x.facts.every(f => object(f) && text(f.fact_id) && text(f.minor_profile_id) && promptKey(f.prompt_key)));
}
/** @purpose Guardian approves or declines; a guardian never writes, edits or withdraws. */
export async function decideGuardianFunFact(factId: string, approve: boolean, expectedProfileId: string, client = supabase): Promise<GuardianFunFactDecision> {
  return checked<GuardianFunFactDecision>(await callRpc('quiz_fact_guardian_decide', { p_fact_id: factId, p_approve: approve, p_expected_profile_id: expectedProfileId }, client),
    x => x.fact_id === factId && text(x.status));
}

// Admin ----------------------------------------------------------------------------------------------------------------------
/** @purpose The fun-fact queue (200 newest) with guardian status; admins see the text to decide. */
export async function fetchFactQueue(): Promise<FactQueue> {
  return checked<FactQueue>(await callRpc('quiz_admin_fact_queue'), x => object(x.counts) && Array.isArray(x.facts) && x.facts.every(f => object(f) && text(f.id)
    && promptKey(f.prompt_key) && text(f.guardian_status) && typeof f.paused === 'boolean' && strings(f.look_reasons)));
}
/** @purpose Approve (with the checklist) or decline with a reason code. */
export async function decideFact(factId: string, input: FactDecisionInput, expectedActorId: string): Promise<FactDecisionReceipt> {
  const { action, ...payload } = input;
  return checked<FactDecisionReceipt>(await callRpc('quiz_admin_fact_decide', { p_fact_id: factId, p_action: action, p_payload: payload, p_expected_actor_id: expectedActorId }),
    x => x.fact_id === factId && ['approved', 'declined'].includes(String(x.status)));
}
/** @purpose Needs a look: paused, queued, flagged and reported questions with reasons (aggregates only). */
export async function fetchNeedsLook(): Promise<NeedsLook> {
  return checked<NeedsLook>(await callRpc('quiz_admin_needs_look'), x => integer(x.count) && strings(x.alerts) && Array.isArray(x.questions) && x.questions.every(q => object(q)
    && text(q.question_id) && strings(q.options) && strings(q.flags) && object(q.reports) && (q.responders === null || integer(q.responders))
    && !JSON.stringify(q.reports).includes('reporter')));
}
/** @purpose Restore / Dismiss / Archive one question from Needs a look (Edit goes through edit_replace). */
export async function actOnNeedsLook(questionId: string, action: NeedsLookAction, reason: string, expectedActorId: string): Promise<NeedsLookReceipt> {
  return checked<NeedsLookReceipt>(await callRpc('quiz_admin_needs_look_action', { p_question_id: questionId, p_action: action, p_reason: reason, p_expected_actor_id: expectedActorId }),
    x => x.question_id === questionId && x.action === action && typeof x.needs_look === 'boolean');
}
/** @purpose The editable self-heal thresholds, within the server's bounds. */
export function selfHealValid(h: FreshSelfHeal): boolean {
  return (Object.keys(FRESH_SELF_HEAL_BOUNDS) as (keyof FreshSelfHeal)[]).every(k => Number.isInteger(h[k]) && h[k] >= FRESH_SELF_HEAL_BOUNDS[k][0] && h[k] <= FRESH_SELF_HEAL_BOUNDS[k][1]);
}
/** @purpose trivia.athlete_questions, the share (0–10%), report intake and the thresholds, saved together with a reason. */
export async function saveFreshSettings(input: FreshSettingsInput, reason: string, expectedActorId: string): Promise<FreshSettingsReceipt> {
  if (!Number.isInteger(input.athlete_share_pct) || input.athlete_share_pct < 0 || input.athlete_share_pct > 10 || !selfHealValid(input.self_heal)) throw new Error('Those settings are outside the allowed range.');
  return checked<FreshSettingsReceipt>(await callRpc('quiz_admin_fresh_settings', { p_payload: input, p_reason: reason, p_expected_actor_id: expectedActorId }),
    x => typeof x.athlete_questions_enabled === 'boolean' && integer(x.athlete_share_pct) && typeof x.reports_paused === 'boolean' && object(x.self_heal));
}
/** @purpose Bulk import: a dry run previews every row's rule and duplicate results; a real run lands passing rows as drafts. */
export async function importTriviaQuestions(rows: ImportRow[], dryRun: boolean, reason: string, expectedActorId: string): Promise<ImportResult> {
  if (!rows.length || rows.length > IMPORT_MAX_ROWS || new TextEncoder().encode(JSON.stringify(rows)).length > IMPORT_MAX_BYTES) throw new Error(`Import up to ${IMPORT_MAX_ROWS} rows (64 KB) at a time.`);
  return checked<ImportResult>(await callRpc('quiz_admin_import', { p_rows: rows, p_dry_run: dryRun, p_reason: reason, p_expected_actor_id: expectedActorId }),
    x => x.dry_run === dryRun && Array.isArray(x.rows) && x.rows.length === rows.length && x.rows.every(r => object(r) && integer(r.index) && strings(r.problems) && Array.isArray(r.warnings) && nullableText(r.id)));
}

/**
 * @purpose Turn pasted rows (tab-separated from a sheet, or comma-separated with "quotes") into import rows. Columns:
 *   topic | sport or chapter | type | question | answer 1..4 | correct (1–4, or the answer text) | explanation | source.
 *   A header row starting with "topic" is skipped. True / false rows leave the answers empty or True / False. Cells are
 *   passed as written (formula-start cells are refused by the server, never rewritten here); unreadable rows come back
 *   in `errors` with their line number.
 */
export function parseImportPaste(paste: string): { rows: ImportRow[]; errors: { line: number; message: string }[] } {
  const rows: ImportRow[] = []; const errors: { line: number; message: string }[] = [];
  const lines = paste.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = raw.includes('\t') ? raw.split('\t') : splitCsv(raw);
    if (i === 0 && /^topic/i.test(cells[0]?.trim() ?? '')) return;
    if (cells.length < 10) { errors.push({ line: i + 1, message: 'Needs 10 or 11 columns: topic, sport or chapter, type, question, four answers, correct, explanation, and an optional source.' }); return; }
    const [topicRaw, place, typeRaw, prompt, a1, a2, a3, a4, correctRaw, explanation, source = ''] = cells.map(c => c.trim());
    const topic = topicRaw.toLowerCase().replace(/^sports?$/, 'sport').replace(/^fun$/, 'general').replace(/^life playbook$/, 'life');
    const type = /^(true[ _/-]?false|tf|t\/f)$/i.test(typeRaw) ? 'true_false' : 'choice4';
    const options = type === 'true_false' ? ['True', 'False'] : [a1, a2, a3, a4];
    const n = Number(correctRaw);
    const correct = Number.isInteger(n) && n >= 1 && n <= options.length ? n - 1 : options.findIndex(o => o.toLowerCase() === correctRaw.toLowerCase());
    if (correct < 0) { errors.push({ line: i + 1, message: 'Correct must be 1–4 (or True / False), or the exact answer text.' }); return; }
    const row = { topic_category: topic, question_type: type, prompt, options, correct_option: correct, explanation, source_notes: source || 'Bulk import; verify the source before approval.' } as ImportRow;
    if (topic === 'life') row.chapter = place.toLowerCase().replace(/\s+/g, '_'); else if (place) row.sport = place;
    rows.push(row);
  });
  return { rows, errors };
}
function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c; }
    else if (c === '"') quoted = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
/** Plain words for the import problems the server returns. */
export const IMPORT_PROBLEM_WORDS: Record<string, string> = {
  row_invalid: 'Not a row', unknown_column: 'Unknown column', formula_cell: 'A cell starts with = + - or @', athlete_row: 'Fun facts cannot be imported',
  topic_invalid: 'Unknown topic', image_row: 'Image questions cannot be imported', type_invalid: 'Unknown type', prompt_length: 'Question needs 10–280 characters',
  explanation_length: 'Explanation needs 10–500 characters', source_length: 'Source note needs 10–1,000 characters', options_invalid: 'Answers are not valid',
  correct_invalid: 'Correct answer missing', chapter_invalid: 'Unknown Life chapter', sport_not_for_life: 'Life rows take a chapter, not a sport',
  chapter_not_for_trivia: 'Only Life rows take a chapter', sport_invalid: 'Sport needs 2–80 characters', duplicate: 'Already in the bank',
  duplicate_in_batch: 'Repeats an earlier row', bank_full: 'The bank cap is reached', non_latin_text: 'Use plain or accented Latin letters only',
};
