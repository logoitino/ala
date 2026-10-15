#!/usr/bin/env node
/**
 * Life Playbook bank (QUIZ-04) — turns `supabase/content/life_playbook_bank.json` into SQL.
 *
 * The bank is a set of DRAFT questions that teach simple, everyday money and life facts in sports terms
 * (docs/engineering/design/LIFE_PLAYBOOK_DESIGN.md §8, owner simplification 2026-10-15): four chapters, all 13+,
 * no money figures or years so nothing goes stale. A chapter opens at 5 approved items (one round). One admin approves
 * each question in the admin desk, exactly like sports trivia; nothing here approves or publishes anything.
 *
 *   node scripts/life-bank-sql.mjs           validate, then print the migration file to stdout
 *   node scripts/life-bank-sql.mjs --check   validate only (exit 1 and list every problem)
 *
 * Rules checked — the trivia bank rules (scripts/trivia-bank-sql.mjs) plus the Life ruleset:
 *   - key is a lowercase uuid, unique, not a seed draft and not a key in the trivia starter bank
 *   - question_type is choice4 (exactly 4 distinct options) or true_false (exactly ["True","False"]);
 *     options 1-100 characters after trimming; correct_option is an index into them
 *   - topic_category is 'life'; chapter is one of the four chapters; sport is the chapter display name;
 *     min_age_band is "13"; education_only is true (the author's attestation)
 *   - prompt at least 10 and explanation at least 10 characters (the upper limits are copy rules); source_notes is a
 *     short note of 10-200 characters; prompts unique
 *   - no questions about the player's own money or family
 *   - the Life copy ruleset from supabase/content/life_copy_rules.json (the SQL guard runs the same list at approval):
 *     no non-Latin lookalike letters, no advice ("you should / shouldn't / must / need to"), no brand names, no Tapua'i
 *     money words, no NIL / eligibility, no tax / loan / credit score / APR, no money figure of any kind, no years,
 *     Scam Defense ends "Tell a trusted adult and use Report.", prompt <= 120 and explanation <= 200 characters
 *   - --check also verifies the SQL copy of the rules matches the JSON and runs the probe cases (the Life replay runs
 *     the same cases through SQL)
 *
 * Output rows are idempotent `insert ... select ... where not exists (question_key)`, version 1, status left at its
 * 'draft' default. Apply after 20261014180000_life_playbook.sql (chapter, min_age_band, education_only, topic 'life').
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankPath = path.join(root, 'supabase/content/life_playbook_bank.json');
const triviaPath = path.join(root, 'supabase/content/trivia_starter_bank.json');
const checkOnly = process.argv.includes('--check');

const REASON = 'Life Playbook draft (QUIZ-04); one admin checks the fact and approves it like sports trivia.';
/** Chapter → display name used as `sport` (LIFE_PLAYBOOK_DESIGN.md §8; all 13+). */
const CHAPTERS = {
  money_huddle: 'Money Huddle',
  savings_season: 'Savings Season',
  scam_defense: 'Scam Defense',
  smart_plays: 'Smart Plays',
};
const EXISTING_KEYS = new Set(['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIELDS = ['key', 'question_type', 'topic_category', 'chapter', 'min_age_band', 'sport', 'prompt', 'options', 'correct_option', 'explanation', 'source_notes', 'education_only'];

/** Questions never ask about the player's own money, income, debts, family situation or taxes (§3). */
const PERSONAL = /\bhow much (money )?(do|did|does) you\b|\bdo you (have|owe|earn|make)\b|\byour (family|parents?|guardians?)['’]?s?\s+(income|money|debts?|bank|taxes|account|job)\b|\byour (income|debts?|salary|credit score|taxes)\b/i;
/**
 * The Life copy ruleset: one rule list (supabase/content/life_copy_rules.json) shared with SQL. The migration embeds
 * the same JSON in quiz_life_copy_rules(); `--check` fails if the two differ. The matching code is shared with the admin
 * "Add a question" form (packages/shared-types/lifeCopyRules.ts, 2026-10-15), so the desk and this check cannot drift:
 * normalized text (NFKC, zero-width characters removed, plain spaces and quotes, lowercase), the same whole-word
 * patterns as SQL, and the same rule names and order.
 */
const rulesPath = path.join(root, 'supabase/content/life_copy_rules.json');
const migrationPath = path.join(root, 'supabase/migrations/20261014180000_life_playbook.sql');
const RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
// Node strips the shared module's types itself. The shared-types package declares no module type, so Node prints a
// one-off "reparsing as ES module" notice; drop only that notice and keep every other warning.
const printWarnings = process.listeners('warning');
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.code !== 'MODULE_TYPELESS_PACKAGE_JSON') printWarnings.forEach((fn) => fn(w)); });
const { lifeCopyProblems, lifeCopyLength } = await import('../packages/shared-types/lifeCopyRules.ts');
/** Codepoint length after trimming, matching Postgres char_length(btrim(...)). */
const len = lifeCopyLength;
/** @returns the broken rule names, the same names and order as SQL quiz_life_copy_problems. */
const copyProblems = (item) => lifeCopyProblems(RULES, item);
/** Probe cases [chapter, explanation, expected]; the Life replay runs the same list through SQL. */
export const PROBES = [
  ['money_huddle', 'A paycheck of 500 dollars is split.', ['money_figure']],
  ['money_huddle', 'Saving 10\uFF05 builds a cushion.', ['money_figure']],
  ['money_huddle', 'Saving ten percent builds a cushion.', ['money_figure']],
  ['money_huddle', 'A pair of shoes for $40.', ['money_figure']],
  ['money_huddle', 'A pair of shoes for a hundred bucks.', ['money_figure']],
  ['money_huddle', 'Shoes cost a dollar more online.', ['money_figure']],
  ['money_huddle', 'A used car for two grand.', ['money_figure']],
  ['money_huddle', 'A team budget of 1k for the season.', ['money_figure']],
  ['money_huddle', 'Half a million fans watched.', ['money_figure']],
  ['money_huddle', 'A paycheck of USD 500 is split.', ['money_figure']],
  ['money_huddle', 'The interest rate is 5 percent each season.', ['money_figure']],
  ['money_huddle', 'Every dollar in a budget gets a job.', []],
  ['money_huddle', 'A grand plan helps; three months of saving builds a cushion.', []],
  ['money_huddle', 'In 2024 prices went up.', ['year']],
  ['money_huddle', 'Prices in the 1990s were different.', ['year']],
  ['money_huddle', "You shouldn't share a PIN.", ['advice_you_should']],
  ['money_huddle', 'You\u00A0should save.', ['advice_you_should']],
  ['money_huddle', 'Yōu need to save first.', ['advice_you_should']],
  ['money_huddle', 'Cards like Amex, CHASE, Venmo and Apple.', ['brand_name']],
  ['money_huddle', 'Donors and Mālo money and Tapuaʻi.', ['tapuai_money_word']],
  ['money_huddle', 'A dōnation from a fan feels great.', ['tapuai_money_word']],
  ['money_huddle', 'Tapua-i helps families.', ['tapuai_money_word']],
  ['money_huddle', 'A Ra\u200Blly goal.', ['tapuai_money_word']],
  ['money_huddle', 'A Ra\u0304lly goal with a combining macron.', ['tapuai_money_word']],
  ['money_huddle', 'A \u{1D41D}\u{1D428}\u{1D427}\u{1D41A}\u{1D42D}\u{1D422}\u{1D428}\u{1D427} from a fan.', ['tapuai_money_word']],
  ['money_huddle', 'A d\u043Enation from a fan.', ['non_latin_text']],
  ['money_huddle', 'A café budget.', ['non_latin_text']],
  ['money_huddle', 'NIL deals can matter to an athlete.', ['nil_eligibility']],
  ['money_huddle', 'Some athletes become ineligible.', ['nil_eligibility']],
  ['money_huddle', 'Taxes pay for roads and parks.', ['tax_loan_credit']],
  ['money_huddle', 'A loan is paid back over time.', ['tax_loan_credit']],
  ['money_huddle', 'A credit score tracks how bills are paid.', ['tax_loan_credit']],
  ['money_huddle', 'APR is a yearly cost of borrowing.', ['tax_loan_credit']],
  ['money_huddle', 'A gift card worth twenty dollars.', ['tapuai_money_word', 'money_figure']],
  ['money_huddle', 'A season has many games, and a budget plans spending.', []],
  ['scam_defense', 'Phishing pretends to be a friend. Delete it.', ['scam_missing_report_line']],
  ['scam_defense', 'Phishing pretends to be a friend. Tell a trusted adult and use Report.', []],
  ['savings_season', `A savings goal works like building a bench. ${'b'.repeat(157)}`, ['explanation_too_long']],
  ['smart_plays', `A good call is a plan. ${'b'.repeat(177)}`, []],
];
/** Whole-item cases [prompt, options, explanation, chapter, expected]. */
export const ITEM_PROBES = [
  [`Which choice is the plan? ${'a'.repeat(95)}`, ['a', 'b'], 'A plan comes first.', 'money_huddle', ['prompt_too_long']],
  [`Which choice is the plan? ${'a'.repeat(94)}`, ['a', 'b'], 'A plan comes first.', 'money_huddle', []],
  ['What does a price tag show?', ['$5', 'The cost'], 'A price tag shows the cost.', 'money_huddle', ['money_figure']],
];
function rulesProblems() {
  const errors = [];
  const sql = fs.readFileSync(migrationPath, 'utf8').match(/\$life_rules\$([\s\S]*?)\$life_rules\$/);
  const { _comment, ...rules } = RULES;
  if (!sql) errors.push('migration has no quiz_life_copy_rules() JSON between $life_rules$ markers');
  else if (JSON.stringify(JSON.parse(sql[1])) !== JSON.stringify(rules)) errors.push('SQL quiz_life_copy_rules() differs from supabase/content/life_copy_rules.json; copy the file into the migration and schema.sql');
  for (const [chapter, explanation, want] of PROBES) {
    const got = copyProblems({ prompt: 'Prompt text here', options: ['a', 'b'], explanation, chapter });
    if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`rule self-test "${explanation}": got [${got}] want [${want}]`);
  }
  for (const [prompt, options, explanation, chapter, want] of ITEM_PROBES) {
    const got = copyProblems({ prompt, options, explanation, chapter });
    if (JSON.stringify(got) !== JSON.stringify(want)) errors.push(`item self-test "${prompt.slice(0, 40)}": got [${got}] want [${want}]`);
  }
  return errors;
}

function triviaKeys() {
  try {
    return new Set(JSON.parse(fs.readFileSync(triviaPath, 'utf8')).map((r) => r && r.key));
  } catch {
    return new Set();
  }
}

function validate(rows) {
  const errors = [];
  if (!Array.isArray(rows)) return ['bank must be a JSON array'];
  const taken = triviaKeys();
  const keys = new Set();
  const prompts = new Set();
  rows.forEach((r, i) => {
    const at = `row ${i} (${r && r.key})`;
    const bad = (msg) => errors.push(`${at}: ${msg}`);
    if (!r || typeof r !== 'object') return bad('not an object');
    const extra = Object.keys(r).filter((k) => !FIELDS.includes(k));
    if (extra.length) bad(`unexpected fields ${extra.join(', ')}`);
    for (const f of ['key', 'question_type', 'topic_category', 'chapter', 'min_age_band', 'sport', 'prompt', 'explanation', 'source_notes']) {
      if (typeof r[f] !== 'string') bad(`${f} must be a string`);
    }
    if (errors.some((e) => e.startsWith(at))) return;

    if (!UUID.test(r.key)) bad('key is not a lowercase uuid');
    if (keys.has(r.key)) bad('duplicate key');
    if (EXISTING_KEYS.has(r.key)) bad('key collides with an existing seed draft');
    if (taken.has(r.key)) bad('key collides with the trivia starter bank');
    keys.add(r.key);

    const promptKey = r.prompt.trim().toLowerCase();
    if (prompts.has(promptKey)) bad('duplicate prompt');
    prompts.add(promptKey);

    if (len(r.prompt) < 10) bad(`prompt length ${len(r.prompt)} is under 10`);
    if (len(r.explanation) < 10) bad(`explanation length ${len(r.explanation)} is under 10`);
    if (len(r.source_notes) < 10 || len(r.source_notes) > 200) bad(`source_notes length ${len(r.source_notes)} not in 10-200 (a short note)`);

    if (r.topic_category !== 'life') bad(`topic_category "${r.topic_category}" must be "life"`);
    if (!CHAPTERS[r.chapter]) bad(`chapter "${r.chapter}" must be one of ${Object.keys(CHAPTERS).join(', ')}`);
    else if (r.sport !== CHAPTERS[r.chapter]) bad(`sport must be the chapter name "${CHAPTERS[r.chapter]}"`);
    if (r.min_age_band !== '13') bad(`min_age_band "${r.min_age_band}" must be "13"`);
    if (r.education_only !== true) bad('education_only must be true (the author\'s attestation)');

    const opts = r.options;
    if (!Array.isArray(opts) || opts.some((o) => typeof o !== 'string')) {
      bad('options must be an array of strings');
    } else {
      if (r.question_type === 'choice4') {
        if (opts.length !== 4) bad(`choice4 needs 4 options, has ${opts.length}`);
      } else if (r.question_type === 'true_false') {
        if (opts.length !== 2 || opts[0] !== 'True' || opts[1] !== 'False') bad('true_false options must be exactly ["True","False"]');
      } else bad(`question_type "${r.question_type}" invalid`);
      if (opts.some((o) => len(o) < 1 || len(o) > 100)) bad('every option must be 1-100 characters');
      if (new Set(opts.map((o) => o.trim())).size !== opts.length) bad('options must be distinct');
      if (!Number.isInteger(r.correct_option) || r.correct_option < 0 || r.correct_option >= opts.length) {
        bad(`correct_option ${r.correct_option} out of range`);
      }
    }

    const text = [r.prompt, r.explanation, ...(Array.isArray(opts) ? opts : [])].join(' ');
    const personal = text.match(PERSONAL);
    if (personal) bad(`personal question "${personal[0]}" (§3: never ask about the player's own money or family)`);
    for (const rule of copyProblems({ ...r, options: Array.isArray(opts) ? opts : [] })) bad(`Life copy rule ${rule} (supabase/content/life_copy_rules.json)`);
  });
  return errors;
}

/** SQL string literal with single quotes doubled; the bank has no backslash escapes to worry about. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function toSql(rows) {
  const tally = Object.entries(rows.reduce((m, r) => ((m[r.chapter] = (m[r.chapter] || 0) + 1), m), {})).map(([c, n]) => `${n} ${c}`).join(', ');
  const out = [
    `-- Life Playbook bank (QUIZ-04, owner simplification 2026-10-15): ${rows.length} DRAFT questions (${tally}).`,
    '-- Generated from supabase/content/life_playbook_bank.json by `node scripts/life-bank-sql.mjs`; regenerate rather than edit by hand.',
    '-- Simple everyday facts, all 13+, no money figures or years. Every row is a draft: one admin checks the fact and',
    "-- approves it in the admin desk like sports trivia (the server runs the Life copy rules). A chapter opens at 5 approved",
    '-- items, so this file opens nothing: all four chapters stay closed after it loads.',
    '-- Needs: 20261014180000_life_playbook.sql (topic_category life, chapter, min_age_band, education_only).',
    '-- Safe to re-run: each insert skips an existing question_key. Applied: written 2026-10-15, not applied anywhere.',
    "-- Rollback: delete from public.sport_quiz_questions where topic_category = 'life' and status = 'draft' and reason like 'Life Playbook draft (QUIZ-04)%'.",
    '',
  ];
  for (const r of rows) {
    out.push(
      'insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)',
      `select ${lit(r.key)},1,${lit(r.sport.trim())},`,
      `  ${lit(r.prompt.trim())},`,
      `  ${lit(JSON.stringify(r.options.map((o) => o.trim())))}::jsonb,${r.correct_option},`,
      `  ${lit(r.explanation.trim())},`,
      `  ${lit(REASON)},${lit(r.topic_category)},`,
      `  ${lit(r.source_notes.trim())},${lit(r.question_type)},${lit(r.chapter)},${lit(r.min_age_band)},true`,
      `where not exists(select 1 from public.sport_quiz_questions where question_key = ${lit(r.key)});`,
    );
  }
  return out.join('\n') + '\n';
}

function counts(rows) {
  const tally = (f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});
  return { total: rows.length, byChapter: tally((r) => r.chapter), byType: tally((r) => r.question_type), byChapterType: tally((r) => `${r.chapter}/${r.question_type}`) };
}

// Imported by the Life replay for the probe lists only; the CLI runs when executed directly.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
  } catch (err) {
    console.error(`life-bank: cannot read ${path.relative(root, bankPath)}: ${err.message}`);
    process.exit(1);
  }
  const errors = [...validate(rows), ...rulesProblems()];
  if (errors.length) {
    console.error(`life-bank: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  if (checkOnly) console.log(`life-bank: OK\n${JSON.stringify(counts(rows), null, 2)}`);
  else process.stdout.write(toSql(rows));
}
