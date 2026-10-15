/**
 * Trivia control tower helpers (2026-10-15): the simple "Add a question" draft and its live checks, the topic and
 * chapter labels, Life chapter progress, the review-queue counts, and one status summary shared by the admin Home card
 * and the Trivia desk. Everything here is read from the existing admin reads (quiz_admin_snapshot and the Life admin
 * read); a read that is missing says "not switched on", never zero. The server re-checks every rule on save and at
 * approval. Review counts come from the snapshot's whole-bank `bank_counts`; an older server without it falls back to
 * the loaded pages, always labelled "(loaded so far)".
 * @sideEffects None (pure functions).
 */
import { ATHLETE_SPORTS } from '@/data/teams';
import { sportQuizOptionsIssue, type TimedQuizAdminQuestion, type TimedQuizAdminQuestionInput, type TimedQuizAdminSnapshot, type TimedQuizBankCounts, type TimedQuizQuestionTopic } from '@/lib/sportQuiz';
import { LIFE_CHAPTER_IDS, LIFE_COPY_LIMITS, lifeCopyCheck, lifeTextLength, type LifeAdminSnapshot, type LifeChapterId, type LifeCopyRule } from '@/lib/lifePlaybook';
import { isMissingFunction } from '@/lib/dbErrors';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

/** Topics in the order the desk offers them; the label is what admins see, `sport` the stored label for one-label topics. */
export const TRIVIA_TOPICS: { id: TimedQuizQuestionTopic; label: string; sport?: string }[] = [
  { id: 'sport', label: 'Sports' }, { id: 'science', label: 'Science', sport: 'Science' }, { id: 'geography', label: 'Geography', sport: 'Geography' },
  { id: 'general', label: 'Fun', sport: 'General' }, { id: 'life', label: 'Life Playbook' },
];
export const TRIVIA_SPORTS: readonly string[] = ATHLETE_SPORTS;
/** @purpose Desk label for a stored topic. */
export const topicLabel = (t: TimedQuizQuestionTopic | string) => TRIVIA_TOPICS.find(x => x.id === t)?.label ?? String(t);

/** Plain words for each Life copy rule the server and CI refuse. */
export const LIFE_RULE_WORDS: Record<LifeCopyRule, string> = {
  non_latin_text: 'Use plain letters only: no lookalike or accented letters.',
  advice_you_should: 'No advice such as “you should”, “you must” or “you need to”.',
  brand_name: 'No brand or company names.',
  tapuai_money_word: 'No Tapua’i money words (donation, donor, Rally, family account, payout, Aura, gift, the thank-you word).',
  nil_eligibility: 'No NIL or eligibility topics.',
  tax_loan_credit: 'No taxes, loans, credit scores or APR.',
  money_figure: 'No money amounts, prices, percentages, rates or figures like “1k”.',
  year: 'No years.',
  scam_missing_report_line: 'Scam Defense explanations end with “Tell a trusted adult and use Report.”',
  prompt_too_long: `Life questions stay within ${LIFE_COPY_LIMITS.prompt} characters.`,
  explanation_too_long: `Life explanations stay within ${LIFE_COPY_LIMITS.explanation} characters.`,
};

export type SimpleType = 'true_false' | 'choice4';
export type SimpleDraft = {
  topic: TimedQuizQuestionTopic; sport: string; chapter: LifeChapterId; type: SimpleType; prompt: string; options: string[];
  correct: number | null; explanation: string; attest: boolean; family: 'new' | 'existing'; familyKey: string; source: string; reason: string;
};
/** The source note is long enough for the server's 10-character minimum and editable under More options. */
export const DEFAULT_SOURCE = 'Everyday fact';
export const DEFAULT_ADD_REASON = 'Added in admin';
export const DEFAULT_REVIEW_REASON = 'Content review';
export const EMPTY_SIMPLE: SimpleDraft = {
  topic: 'sport', sport: '', chapter: 'money_huddle', type: 'true_false', prompt: '', options: ['', '', '', ''], correct: null, explanation: '',
  attest: false, family: 'new', familyKey: '', source: DEFAULT_SOURCE, reason: DEFAULT_ADD_REASON,
};
const TRUE_FALSE = ['True', 'False'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Trivia text is counted like SQL: ASCII-space trim, Unicode characters.
const triviaLength = (s: string) => Array.from(s.replace(/^ +| +$/g, '')).length;

/** @purpose Prefill the simple form from a stored draft (review queue Edit). */
export function draftFromQuestion(q: TimedQuizAdminQuestion, reason: string): SimpleDraft {
  const type: SimpleType = q.question_type === 'true_false' ? 'true_false' : 'choice4';
  const chapter = q.topic_category === 'life' && q.chapter && LIFE_CHAPTER_IDS.includes(q.chapter) ? q.chapter : 'money_huddle';
  return { topic: q.topic_category, sport: q.sport, chapter, type, prompt: q.prompt, options: type === 'true_false' ? ['', '', '', ''] : [...q.options, '', '', ''].slice(0, 4),
    correct: q.correct_option, explanation: q.explanation, attest: q.education_only === true, family: 'existing', familyKey: q.question_key, source: q.source_notes || DEFAULT_SOURCE, reason };
}

export type DraftCheck = { ok: boolean; text: string };
export type DraftChecks = { checks: DraftCheck[]; valid: boolean; options: string[]; lifeRules: LifeCopyRule[] };
/** @purpose Live checks shown before saving: the server's length limits, answer rules, Life copy rules and the reason. */
export function simpleChecks(d: SimpleDraft, opts: { full: boolean; editing?: boolean }): DraftChecks {
  const life = d.topic === 'life';
  const options = d.type === 'true_false' ? TRUE_FALSE : d.options;
  const len = life ? lifeTextLength : triviaLength;
  const promptMax = life ? LIFE_COPY_LIMITS.prompt : 280;
  const explanationMax = life ? LIFE_COPY_LIMITS.explanation : 500;
  const p = len(d.prompt), e = len(d.explanation), src = triviaLength(d.source), why = Array.from(d.reason.trim()).length;
  const lifeRules = life ? lifeCopyCheck({ prompt: d.prompt, options, explanation: d.explanation, chapter: d.chapter }).filter(r => r !== 'prompt_too_long' && r !== 'explanation_too_long') : [];
  const checks: DraftCheck[] = [
    d.topic === 'sport' ? { ok: TRIVIA_SPORTS.includes(d.sport) || (opts.editing === true && triviaLength(d.sport) >= 2), text: d.sport ? `Sport: ${d.sport}` : 'Pick a sport.' } : null,
    { ok: p >= 10 && p <= promptMax, text: `Question: ${p} of ${promptMax} characters${p < 10 ? ' (at least 10)' : ''}.` },
    d.type === 'choice4' ? { ok: !sportQuizOptionsIssue(options, 'choice4'), text: 'Four different answers, each 1 to 100 characters.' } : null,
    { ok: d.correct !== null && d.correct >= 0 && d.correct < options.length, text: d.correct === null ? 'Choose the correct answer.' : `Correct answer: ${options[d.correct] || `answer ${d.correct + 1}`}.` },
    { ok: e >= 10 && e <= explanationMax, text: `Explanation: ${e} of ${explanationMax} characters${e < 10 ? ' (at least 10)' : ''}.` },
    ...(life ? [
      { ok: lifeRules.length === 0, text: lifeRules.length ? 'Life Playbook word rules: fix the items below.' : 'Life Playbook word rules: none broken.' },
      { ok: d.attest, text: d.attest ? 'Attested: a simple everyday fact with no advice, products or brands.' : 'Confirm it is a simple everyday fact with no advice, products or brands.' },
    ] : []),
    { ok: src >= 10 && src <= 1000, text: `Source note: ${src} characters (10 to 1,000).` },
    d.family === 'existing' && !opts.editing ? { ok: uuid.test(d.familyKey.trim()), text: 'Existing family key is a question family ID.' } : null,
    { ok: why >= 10 && why <= 500, text: `Reason: ${why} characters (10 to 500).` },
    opts.full ? { ok: false, text: life ? 'The Life Playbook bank is full. Archive drafts before adding more.' : 'The trivia bank is full. Archive drafts before adding more.' } : null,
  ].filter((c): c is DraftCheck => !!c);
  return { checks, valid: checks.every(c => c.ok), options, lifeRules };
}
/** @purpose The create / edit payload the existing quiz_admin_question path expects. */
export function simplePayload(d: SimpleDraft, editKey: string | null): TimedQuizAdminQuestionInput {
  const life = d.topic === 'life';
  const options = d.type === 'true_false' ? TRUE_FALSE : d.options.map(o => o.trim());
  const sport = TRIVIA_TOPICS.find(t => t.id === d.topic)?.sport ?? d.sport.trim();
  return {
    reason: d.reason.trim(), ...(life ? { chapter: d.chapter, min_age_band: '13' as const, education_only: d.attest } : { sport }),
    prompt: d.prompt.trim(), options, correct_option: d.correct ?? 0, explanation: d.explanation.trim(), topic_category: d.topic, source_notes: d.source.trim(),
    question_type: d.type, ...(editKey ? { family_action: 'existing' as const, question_key: editKey } : d.family === 'existing' ? { family_action: 'existing' as const, question_key: d.familyKey.trim() } : { family_action: 'new' as const }),
  };
}

/**
 * @purpose "Money Huddle: 3 of 5 approved to open", or open / ready wording, per chapter. Approved counts are the Life
 *   read's server counts over the whole bank (the same numbers that decide opening). With `drafts`, it adds the
 *   chapter's drafts waiting, from the whole-bank review counts when the server sends them, else the Life read's own
 *   per-chapter draft count (never the loaded pages).
 */
export function chapterProgress(life: LifeAdminSnapshot, drafts?: ReviewCounts): { id: LifeChapterId; text: string }[] {
  return life.chapters.map(c => {
    // Without whole-bank counts the Life read's draft_count (also server-side, whole bank) beats the loaded pages.
    const waiting = drafts ? drafts.whole ? drafts.chapters[c.id]?.draft ?? 0 : c.draft_count : null;
    const tail = waiting === null ? '' : ` · ${waiting} draft${waiting === 1 ? '' : 's'} waiting`;
    return { id: c.id, text: (c.open ? `${c.title}: open · ${c.approved_count} approved`
      : c.ready ? `${c.title}: ${c.approved_count} of ${life.open_at} approved · ready to open`
        : `${c.title}: ${c.approved_count} of ${life.open_at} approved to open`) + tail };
  });
}

/** Label for counts taken from the loaded pages because the server sent no whole-bank counts. */
export const LOADED_SO_FAR = '(loaded so far)';
export type ReviewTally = { draft: number; approved: number };
/**
 * Draft / approved tallies for the review queue. `whole` is true when they come from the server's `bank_counts` (every
 * draft, loaded or not); false when an older server sent none and they were counted from the loaded pages. Content
 * counts only: question versions by status, never participant data.
 */
export type ReviewCounts = {
  whole: boolean; drafts: number; topics: Partial<Record<TimedQuizQuestionTopic, ReviewTally>>; sports: Record<string, ReviewTally>; chapters: Record<string, ReviewTally>;
};
/** @purpose Whole-bank review counts from the snapshot, or the loaded-page fallback (marked `whole: false`). */
export function reviewCounts(bank: TimedQuizBankCounts | undefined, loaded: TimedQuizAdminQuestion[]): ReviewCounts {
  const out: ReviewCounts = { whole: !!bank, drafts: 0, topics: {}, sports: {}, chapters: {} };
  const add = (map: Record<string, ReviewTally>, key: string, draft: number, approved: number) => {
    const t = map[key] ?? { draft: 0, approved: 0 }; map[key] = { draft: t.draft + draft, approved: t.approved + approved };
  };
  if (bank) {
    for (const r of bank.topics) { add(out.topics, r.topic_category, r.draft_count, r.approved_count); out.drafts += r.draft_count; }
    for (const r of bank.sports) add(out.sports, r.sport, r.draft_count, r.approved_count);
    for (const r of bank.chapters) add(out.chapters, r.chapter, r.draft_count, r.approved_count);
    return out;
  }
  for (const q of loaded) {
    if (q.status !== 'draft' && q.status !== 'approved') continue;
    const d = q.status === 'draft' ? 1 : 0, a = 1 - d;
    out.drafts += d; add(out.topics, q.topic_category, d, a);
    if (q.topic_category === 'sport') add(out.sports, q.sport, d, a);
    if (q.topic_category === 'life' && q.chapter) add(out.chapters, q.chapter, d, a);
  }
  return out;
}

export type TriviaRead<T> = { data: T | null; missing: boolean; error: string | null };
/** @purpose A failed read: an unapplied migration (or no configured database) is "not switched on", anything else an error. */
export function readFailure(e: unknown): { missing: boolean; error: string | null } {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Source unavailable.';
  const missing = message === NOT_SWITCHED_ON || message === 'Supabase is not configured.' || isMissingFunction(message);
  return { missing, error: missing ? null : message };
}
export type TriviaStatus = {
  state: 'not_on' | 'unavailable' | 'paused' | 'testing' | 'on';
  stateText: string; switches: string[]; drafts: string; chapters: string; low: string[];
};
const onOff = (v: boolean | undefined) => v === undefined ? 'not switched on' : v ? 'on' : 'off';

/** @purpose One honest summary for the Home card and the desk: trivia state, switches, drafts, chapters and low topics. */
export function triviaStatus(quiz: TriviaRead<TimedQuizAdminSnapshot>, lifeRead: TriviaRead<LifeAdminSnapshot>): TriviaStatus {
  const life = lifeRead.data;
  const lifeSwitch = life ? onOff(life.settings.life_enabled) : lifeRead.error ? 'could not be read' : 'not switched on';
  const chapters = life ? `${life.chapters.filter(c => c.open).length} of ${life.chapters.length} Life chapters open`
    : lifeRead.error ? 'Life chapters could not be read.' : 'Life chapters: not switched on.';
  const s = quiz.data;
  if (!s) {
    return { state: quiz.error && !quiz.missing ? 'unavailable' : 'not_on', stateText: quiz.error && !quiz.missing ? `Trivia status could not be read: ${quiz.error}` : 'Trivia is not switched on in this database.',
      switches: [`Life Playbook (trivia.life): ${lifeSwitch}`], drafts: 'Drafts waiting for approval: not switched on.', chapters, low: [] };
  }
  const st = s.settings;
  const state: TriviaStatus['state'] = !st ? 'not_on' : !st.enabled ? 'paused' : st.testing_only ? 'testing' : 'on';
  const testers = st?.pilot_accounts.length ?? 0;
  const stateText = !st ? 'Trivia settings are not switched on.' : state === 'paused' ? 'Paused' : state === 'testing'
    ? `On for ${testers} tester account${testers === 1 ? '' : 's'} · testing only` : 'On';
  // The same whole-bank review counts as the review queue when the server sends them; else the server's own totals.
  const bank = s.bank_counts ? reviewCounts(s.bank_counts, []) : null;
  const lifeDrafts = bank ? bank.topics.life?.draft ?? 0 : life ? life.chapters.reduce((n, c) => n + c.draft_count, 0) : null;
  const n = bank ? bank.drafts : s.counts.questions_draft;
  const drafts = `${n} draft${n === 1 ? '' : 's'} waiting for approval${lifeDrafts !== null && lifeDrafts > 0 ? ` (${lifeDrafts} Life Playbook)` : ''}.`;
  const size = st && typeof st.round_size === 'number' ? st.round_size : 5;
  const low: string[] = [];
  for (const topic of TRIVIA_TOPICS.filter(t => t.sport)) {
    const approved = s.pools.filter(p => p.topic_category === topic.id).reduce((sum, p) => sum + p.approved_count, 0);
    if (approved < size) low.push(`${topic.label}: ${approved ? `${approved} approved` : 'none approved'} (a full round needs ${size})`);
  }
  for (const p of s.pools.filter(x => x.topic_category === 'sport' && x.approved_count < size)) low.push(`${p.sport}: ${p.approved_count} approved (a full round needs ${size})`);
  for (const f of s.forecast ?? []) if (f.weeks_left !== null && f.weeks_left <= 2 && !low.some(l => l.startsWith(`${f.sport}:`))) low.push(`${f.sport}: about ${f.weeks_left} week${f.weeks_left === 1 ? '' : 's'} of new questions left`);
  for (const c of life?.chapters ?? []) if (!c.open && c.needs_more > 0) low.push(`${c.title}: needs ${c.needs_more} more approved to open`);
  return {
    state, stateText,
    switches: [`Groups (trivia.groups): ${onOff(st?.groups_enabled)}`, `Life Playbook (trivia.life): ${lifeSwitch}`, `Images (trivia.images): ${onOff(st?.images_enabled)}${st?.images_enabled ? '' : ', locked'}`],
    drafts, chapters, low,
  };
}
