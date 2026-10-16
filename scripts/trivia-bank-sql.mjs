#!/usr/bin/env node
/**
 * Trivia starter bank (QUIZ-03) — turns `supabase/content/trivia_starter_bank.json` into SQL.
 *
 * The bank is about 60 DRAFT questions for families and fans: sport rules and terminology for every
 * supported sport, plus a small science / geography / general set. Content verifies each fact source and
 * approves questions one at a time in the admin desk; nothing here approves or publishes anything.
 *
 *   node scripts/trivia-bank-sql.mjs           validate, then print a migration body to stdout
 *   node scripts/trivia-bank-sql.mjs --check   validate only (exit 1 and list every problem)
 *
 * Rules checked (mirroring sport_quiz_questions in 20261014140000_sport_pop_quiz.sql and
 * 20261014150000_timed_sport_trivia.sql):
 *   - key is a uuid, unique, and not one of the two existing seed drafts
 *   - question_type is choice4 (exactly 4 distinct options) or true_false (exactly ["True","False"])
 *   - options are strings of 1-100 characters after trimming; correct_option is an index into them
 *   - topic_category is sport | science | geography | general; sport questions name a supported sport
 *     (apps/mobile/src/frontend/data/sports.ts), others use Science / Geography / General
 *   - prompt 10-280, explanation 10-500, source_notes 10-1000 characters; prompts unique
 *   - no money words (VOICE: trivia stays away from money topics entirely)
 *
 * Output rows are idempotent `insert ... select ... where not exists (question_key)`, version 1, with
 * status left at its 'draft' default. The insert names `question_type`, which BACKEND adds in a later
 * migration (with the relaxed two-option check for true_false); apply this body only after that one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankPath = path.join(root, 'supabase/content/trivia_starter_bank.json');
const checkOnly = process.argv.includes('--check');

const REASON = 'Starter draft (QUIZ-03); Content verifies the source before approval.';
/** Active sports in apps/mobile/src/frontend/data/sports.ts; quiz_start matches `sport` exactly. */
const SPORTS = [
  'Football', 'Basketball', 'Rugby', 'Volleyball', 'Soccer', 'Baseball', 'Softball',
  'Wrestling', 'Track & Field', 'Lacrosse', 'Ice Hockey', 'Tennis',
];
const NON_SPORT = { science: 'Science', geography: 'Geography', general: 'General' };
const EXISTING_KEYS = new Set(['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MONEY = /\$|\b(donat\w*|money|dollars?|cash|tips?|pa(?:y|ys|id|ying|yment|yments|yout|youts)|prizes?|bets?|betting|wagers?|funds?|funding|fundrais\w*)\b/i;
const FIELDS = ['key', 'question_type', 'topic_category', 'sport', 'prompt', 'options', 'correct_option', 'explanation', 'source_notes'];

/** Unicode codepoint length after trimming, matching Postgres char_length(btrim(...)). */
const len = (s) => [...s.trim()].length;

function validate(rows) {
  const errors = [];
  if (!Array.isArray(rows)) return ['bank must be a JSON array'];
  const keys = new Set();
  const prompts = new Set();
  rows.forEach((r, i) => {
    const at = `row ${i} (${r && r.key})`;
    const bad = (msg) => errors.push(`${at}: ${msg}`);
    if (!r || typeof r !== 'object') return bad('not an object');
    const extra = Object.keys(r).filter((k) => !FIELDS.includes(k));
    if (extra.length) bad(`unexpected fields ${extra.join(', ')}`);
    for (const f of ['key', 'question_type', 'topic_category', 'sport', 'prompt', 'explanation', 'source_notes']) {
      if (typeof r[f] !== 'string') bad(`${f} must be a string`);
    }
    if (errors.some((e) => e.startsWith(at))) return;

    if (!UUID.test(r.key)) bad('key is not a lowercase uuid');
    if (keys.has(r.key)) bad('duplicate key');
    if (EXISTING_KEYS.has(r.key)) bad('key collides with an existing seed draft');
    keys.add(r.key);

    const promptKey = r.prompt.trim().toLowerCase();
    if (prompts.has(promptKey)) bad('duplicate prompt');
    prompts.add(promptKey);

    if (len(r.prompt) < 10 || len(r.prompt) > 280) bad(`prompt length ${len(r.prompt)} not in 10-280`);
    if (len(r.explanation) < 10 || len(r.explanation) > 500) bad(`explanation length ${len(r.explanation)} not in 10-500`);
    if (len(r.source_notes) < 10 || len(r.source_notes) > 1000) bad(`source_notes length ${len(r.source_notes)} not in 10-1000`);
    if (len(r.sport) < 2 || len(r.sport) > 80) bad('sport length not in 2-80');

    if (r.topic_category === 'sport') {
      if (!SPORTS.includes(r.sport)) bad(`sport "${r.sport}" is not a supported sport`);
    } else if (NON_SPORT[r.topic_category]) {
      if (r.sport !== NON_SPORT[r.topic_category]) bad(`sport must be "${NON_SPORT[r.topic_category]}" for ${r.topic_category}`);
    } else bad(`topic_category "${r.topic_category}" invalid`);

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
    const money = text.match(MONEY);
    if (money) bad(`money word "${money[0]}" (VOICE: keep trivia off money topics)`);
  });
  return errors;
}

/** SQL string literal with single quotes doubled; the bank has no backslash escapes to worry about. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

function toSql(rows) {
  const out = [
    '-- QUIZ-03 starter trivia bank: generated by scripts/trivia-bank-sql.mjs from supabase/content/trivia_starter_bank.json.',
    `-- ${rows.length} draft questions; status stays 'draft' until Content verifies the source and approves each one.`,
    '-- Requires the BACKEND migration that adds sport_quiz_questions.question_type and relaxes the option count for true_false.',
    '-- Idempotent: each row is skipped when its question_key already exists.',
    '',
  ];
  for (const r of rows) {
    out.push(
      'insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)',
      `select ${lit(r.key)},1,${lit(r.sport.trim())},`,
      `  ${lit(r.prompt.trim())},`,
      `  ${lit(JSON.stringify(r.options.map((o) => o.trim())))}::jsonb,${r.correct_option},`,
      `  ${lit(r.explanation.trim())},`,
      `  ${lit(REASON)},${lit(r.topic_category)},`,
      `  ${lit(r.source_notes.trim())},${lit(r.question_type)}`,
      `where not exists(select 1 from public.sport_quiz_questions where question_key = ${lit(r.key)});`,
    );
  }
  return out.join('\n') + '\n';
}

function counts(rows) {
  const tally = (f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});
  return { total: rows.length, bySport: tally((r) => r.sport), byTopic: tally((r) => r.topic_category), byType: tally((r) => r.question_type) };
}

let rows;
try {
  rows = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
} catch (err) {
  console.error(`trivia-bank: cannot read ${path.relative(root, bankPath)}: ${err.message}`);
  process.exit(1);
}
const errors = validate(rows);
if (errors.length) {
  console.error(`trivia-bank: ${errors.length} problem(s)\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
if (checkOnly) {
  console.log(`trivia-bank: OK\n${JSON.stringify(counts(rows), null, 2)}`);
} else {
  process.stdout.write(toSql(rows));
}
