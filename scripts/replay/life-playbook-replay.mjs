#!/usr/bin/env node
/** QUIZ-04 real PostgreSQL actors: round kinds, the simplified Life Playbook (design §8), chapters, levels and privacy.
 *
 *   node scripts/replay/life-playbook-replay.mjs /tmp/books01-pg/pkg/package/dist
 *
 * Builds the whole canonical schema (QUIZ-01..04 plus the generated Life bank 20261014190000) on PGlite with the
 * Supabase stubs, then calls every RPC as a real signed-in actor. A few checks act as the database owner to prove a
 * guard (direct writes) or insert synthetic answered rounds to test the admin statistics thresholds.
 * Owner simplification (2026-10-15): one-admin approval like sports trivia, four 13+ chapters that open at 5 approved
 * items, the v4 copy rules (no money figures or years); the CPA sign-off, reviewers, sources, tax years, re-review,
 * January withdrawal and 16+ / adult bands are gone, and this replay proves no removed table or function remains.
 * Control tower (2026-10-15): quiz_admin_snapshot.bank_counts against the whole bank (drafts past the first page,
 * admin-only, content keys only) and the atomic quiz_admin_question 'edit_replace' (create + archive + two audit rows
 * together, refusals roll back both, non-drafts refused, caps kept, direct table writes still denied).
 * @sideEffects Disposable in-memory database only; no hosted calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const dist = process.argv[2] || '/tmp/books01-pg/pkg/package/dist';
const { PGlite } = await import(pathToFileURL(path.resolve(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.resolve(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
assert.ok(SUPABASE_STUBS, 'Supabase stubs not found');
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8'));

const admins = ['admin', 'admin2', 'plain'];
const adults = ['a1', 'a2', 'a3', 'ad', 'ng', 'gp1', 'gp2', 'solo', 'te', 'lvl', 'erz', 'slots', 'off1', 'opt1', 'fan'];
const teens13 = ['t13'];
const teens16 = ['t16'];
const stats = Array.from({ length: 25 }, (_, i) => `s${i + 1}`);
const keys = [...admins, ...adults, ...teens13, ...teens16, ...stats];
const ids = Object.fromEntries(keys.map((k, i) => [k, `00000000-0000-0000-0000-${String(i + 900).padStart(12, '0')}`]));
const year = Number((await db.query('select extract(year from current_date)::int y')).rows[0].y);
const birthYear = k => teens13.includes(k) ? year - 15 : teens16.includes(k) ? year - 17 : year - 30;
for (const k of keys) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)', [ids[k], JSON.stringify({ birth_year: birthYear(k), birth_month: 1 })]);
await db.query("update public.profiles set role='admin',is_admin=true where user_id=any($1::uuid[])", [admins.map(k => ids[k])]);
for (const k of keys) await db.query('update public.profiles set full_name=$2,username=$3 where user_id=$1', [ids[k], `${k[0].toUpperCase()}${k.slice(1)} Life`, `${k}_life`]);
const P = Object.fromEntries((await db.query('select user_id,id from public.profiles')).rows.filter(r => Object.values(ids).includes(r.user_id)).map(r => [keys.find(k => ids[k] === r.user_id), r.id]));

const actor = async (key, sql, args = []) => {
  await db.exec('begin');
  try {
    const role = key === 'anon' ? 'anon' : key === 'service' ? 'service_role' : 'authenticated';
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role, sub: ids[key] })]);
    const rows = (await db.query(sql, args)).rows; await db.exec('commit'); return rows;
  } catch (e) { await db.exec('rollback'); throw e; }
};
const rpc = async (key, sql, args = []) => (await actor(key, `select ${sql} result`, args))[0].result;
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const tests = [];
const test = async (name, work) => {
  try { await work(); tests.push({ name, pass: true }); } catch (e) { tests.push({ name, pass: false, detail: e.message }); }
  const t = tests.at(-1); console.log(`${t.pass ? 'PASS' : 'FAIL'} ${name}${t.detail ? ': ' + t.detail : ''}`);
};
const denied = (key, sql, args = []) => assert.rejects(() => rpc(key, sql, args), /quiz_|permission denied/);

const week = (await one("select date_trunc('week',statement_timestamp() at time zone 'UTC')::date::text w")).w;
const secret = 'ab'.repeat(32);
const reason = 'Reviewed local QUIZ-04 replay fixture only.';
const NOTICE = 'life-playbook-v1-testing';
const admin = (sql, args = []) => rpc('admin', sql, args);
const players = [...adults, ...teens13, ...teens16];
await admin('public.quiz_admin_settings($1::jsonb,$2,$3)', [JSON.stringify({ enabled: true, pilot_accounts: players.map(k => P[k]) }), reason, P.admin]);
await admin('public.quiz_admin_play_settings($1::jsonb,$2,$3)', [JSON.stringify({ round_size: 5, groups_enabled: true, images_enabled: false }), reason, P.admin]);
const DEFAULT_TH = { rookie: 0, varsity: 15, all_star: 40, pro: 80, hall_of_fame: 150 };
const lifeSettings = (life_enabled, level_thresholds = DEFAULT_TH, key = 'admin') =>
  rpc(key, 'public.quiz_admin_life_settings($1::jsonb,$2,$3)', [JSON.stringify({ life_enabled, level_thresholds }), reason, P[key]]);
const question = (key, id, action, payload) => rpc(key, 'public.quiz_admin_question($1,$2,$3::jsonb,$4)', [id, action, JSON.stringify(payload), P[key]]);
let n = 0;
const CHAPTERS = [['money_huddle', 'Money Huddle', 'Calling the play before you spend'], ['savings_season', 'Savings Season', 'Building your bench'],
  ['scam_defense', 'Scam Defense', 'Defense wins'], ['smart_plays', 'Smart Plays', 'Good calls every day']];
const lifeBase = (chapter, extra = {}) => ({ family_action: 'new', topic_category: 'life', chapter, min_age_band: '13', education_only: true,
  prompt: `Life fixture ${chapter} idea number ${++n}: which choice names the idea?`, options: ['First idea', 'Second idea', 'Third idea', 'Fourth idea'],
  correct_option: 1, explanation: `The second idea is the simple fact for this chapter.${chapter === 'scam_defense' ? ' Tell a trusted adult and use Report.' : ''}`,
  source_notes: 'Everyday fact checked by the approving admin.', reason, ...extra });
const lifeDraft = (chapter, extra = {}, key = 'admin') => question(key, null, 'create', lifeBase(chapter, extra));
const approve = (key, id) => question(key, id, 'approve', { reason });
const approvedLife = async (chapter, extra = {}, approver = 'admin') => { const q = await lifeDraft(chapter, extra); await approve(approver, q.id); return q; };
const prefs = key => rpc(key, 'public.quiz_preferences($1::jsonb,$2,$3,$4)', [JSON.stringify({ invitation_mode: 'off', topic_mode: 'sports', notice_version: 'timed-trivia-v1-testing' }), 0, randomUUID(), P[key]]);
const optIn = async (key, on = true) => {
  const v = (await rpc(key, 'public.quiz_life_snapshot()')).preferences.life_version;
  return rpc(key, 'public.quiz_life_preferences($1,$2,$3,$4)', [on, on ? NOTICE : null, v, P[key]]);
};
const lifeStart = (key, { request = randomUUID(), chapter = null, duration = 90, token = secret } = {}) =>
  rpc(key, 'public.quiz_life_start($1,$2,$3,$4,$5,$6,$7)', [week, request, token, P[key], NOTICE, chapter, duration]);
const start = (key, { request = randomUUID(), sport = null, token = secret } = {}) =>
  rpc(key, 'public.quiz_start($1,$2,$3,$4,$5,$6,$7,$8)', ['sport', sport, 30, week, 'timed-trivia-v1-testing', request, token, P[key]]);
const groupStart = (key, group, { request = randomUUID() } = {}) =>
  rpc(key, 'public.quiz_group_start($1,$2,$3,$4,$5,$6,$7)', [group, 30, week, 'timed-trivia-v1-testing', request, secret, P[key]]);
const answer = (key, attempt, option = 1) => rpc(key, 'public.quiz_answer($1,$2,$3,$4,$5)', [attempt, option, randomUUID(), secret, P[key]]);
const next = (key, attempt, position, { request = randomUUID() } = {}) => rpc(key, 'public.quiz_next($1,$2,$3,$4,$5)', [attempt, position, request, secret, P[key]]);
const end = (key, attempt, kind, why = 'user_end') => rpc(key, 'public.quiz_end($1,$2,$3,$4,$5,$6,$7)', [attempt, null, week, why, randomUUID(), P[key], kind]);
const cancel = (key, startRequest, kind) => rpc(key, 'public.quiz_end($1,$2,$3,$4,$5,$6,$7)', [null, startRequest, week, 'left_page', randomUUID(), P[key], kind]);
const snapshot = key => rpc(key, 'public.quiz_snapshot()');
const lifeSnap = key => rpc(key, 'public.quiz_life_snapshot()');
const createGroup = key => rpc(key, 'public.quiz_group_create($1,$2,$3,$4)', ['family', null, randomUUID(), P[key]]);
const join = (key, code) => rpc(key, 'public.quiz_group_join($1,$2)', [code, P[key]]);
const page = (key, group) => rpc(key, 'public.quiz_group_page($1)', [group]);
const chapterOf = async qid => (await one('select chapter from public.sport_quiz_questions where id=$1', [qid])).chapter;

for (const k of players) await prefs(k);
// Trivia pool for personal and group rounds.
const sportQ = async (sport) => { const q = await question('admin', null, 'create', { family_action: 'new', topic_category: 'sport', sport, prompt: `Which reviewed ${sport} fact is number ${++n}?`,
  options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 1, explanation: `The second choice is the reviewed ${sport} fact.`,
  source_notes: 'Official rules reviewed for this local fixture.', reason }); await approve('admin', q.id); return q; };
for (let i = 0; i < 12; i++) await sportQ('Basketball');

// 1. Access ---------------------------------------------------------------------------------------------------------------
await test('schema.sql leaves no session setting behind: quiz.full_schema is transaction-local', async () => {
  assert.ok(['', null].includes((await one("select current_setting('quiz.full_schema',true) v")).v));
});
await test('new tables are RLS-only with the Closed accounts policy; guest, fan and service role are denied direct reads and writes', async () => {
  for (const t of ['sport_quiz_life_chapters', 'sport_quiz_levels']) {
    assert.equal((await one('select relrowsecurity r from pg_class where oid=$1::regclass', [`public.${t}`])).r, true);
    assert.equal((await one('select count(*)::int n from pg_policies where tablename=$1 and policyname=$2 and permissive=$3', [t, 'Closed accounts', 'RESTRICTIVE'])).n, 1);
    for (const k of ['anon', 'fan', 'service']) {
      await assert.rejects(() => actor(k, `select * from public.${t}`), /permission denied/);
      await assert.rejects(() => actor(k, `delete from public.${t}`), /permission denied/);
    }
  }
  for (const k of ['fan', 'service']) await assert.rejects(() => actor(k, 'select chapter,education_only from public.sport_quiz_questions'), /permission denied/);
});
await test('every RLS-enabled sport_quiz_* table (incl. the QUIZ-02 tables) carries the restrictive Closed accounts policy', async () => {
  const missing = await db.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname like 'sport\\_quiz\\_%' escape '\\' and not exists (select 1 from pg_policy p where p.polrelid=c.oid and p.polname='Closed accounts' and not p.polpermissive)");
  assert.deepEqual(missing.rows.map(r => r.relname), []);
  for (const t of ['sport_quiz_exposures', 'sport_quiz_preferences', 'sport_quiz_requests', 'sport_quiz_week_guards'])
    assert.equal((await one('select count(*)::int n from pg_policies where tablename=$1 and policyname=$2 and permissive=$3', [t, 'Closed accounts', 'RESTRICTIVE'])).n, 1);
});
await test('internal helpers are not client callable; every quiz function pins search_path; nothing is executable by guests or service role', async () => {
  for (const sql of ['public.quiz_life_pool($1,null)', 'public.quiz_sync_badges($1,now())', 'public.quiz_life_access($1)', 'public.quiz_save_receipt($1,$1,\'start\',current_date,null,null,\'x\',now(),\'life\')',
    'public.quiz_life_copy_problems(\'a\',\'[]\'::jsonb,length($1::text)::text,\'money_huddle\')', 'public.quiz_life_band_ok(length($1::text)::text)',
    'public.quiz_round_begin($1,\'life\',\'life\',null,90,current_date,\'x\',$1,\'x\',null,null)'])
    await denied('fan', sql, [P.fan]);
  for (const sql of ['public.quiz_admin_life_snapshot()', 'public.quiz_life_snapshot()']) await denied('anon', sql);
  const loose = await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz\\_%' and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')");
  assert.deepEqual(loose.rows, []);
  const open = await db.query("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz\\_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute'))");
  assert.deepEqual(open.rows, []);
  assert.equal((await one("select count(*)::int n from pg_proc where proname='quiz_end'")).n, 1, 'the kind-less quiz_end is gone');
});
await test('admin-only Life RPCs refuse a fan and an identity mismatch', async () => {
  await denied('fan', 'public.quiz_admin_life_snapshot()');
  await assert.rejects(() => lifeSettings(true, DEFAULT_TH, 'fan'), /quiz_/);
  await assert.rejects(() => rpc('admin', 'public.quiz_admin_life_settings($1::jsonb,$2,$3)', [JSON.stringify({ life_enabled: true, level_thresholds: DEFAULT_TH }), reason, P.fan]), /quiz_identity_changed/);
  await denied('fan', 'public.quiz_admin_life_chapter($1,$2,$3,$4)', ['money_huddle', true, reason, P.fan]);
});
await test('owner simplification: no CPA sign-off, reviewer, source, tax-year, re-review, January or age-band table, column or function remains', async () => {
  for (const t of ['quiz_life_signoffs', 'quiz_content_reviewers']) assert.equal((await one('select to_regclass($1) r', [`public.${t}`])).r, null, t);
  const gone = ['quiz_life_band_rank', 'quiz_life_age_cap', 'quiz_life_source_ok', 'quiz_life_field_marked', 'quiz_life_due_on', 'quiz_life_today', 'quiz_life_item_current',
    'quiz_life_tax_year_ok', 'quiz_life_signoff_current', 'quiz_life_is_author', 'quiz_life_active_grant', 'quiz_guard_life_signoff', 'quiz_guard_reviewer',
    'quiz_admin_life_signoff', 'quiz_admin_life_signoff_confirm', 'quiz_life_signoff_dto', 'quiz_admin_reviewer'];
  assert.deepEqual((await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname=any($1::text[])", [gone])).rows, []);
  assert.equal((await one("select count(*)::int n from pg_proc where proname='quiz_life_copy_problems'")).n, 1, 'one copy-rule signature (prompt, options, explanation, chapter)');
  const cols = async t => (await db.query("select column_name c from information_schema.columns where table_schema='public' and table_name=$1", [t])).rows.map(r => r.c);
  const qcols = await cols('sport_quiz_questions');
  for (const c of ['domain', 'source_url', 'source_retrieved_on', 'as_of_tax_year', 'review_due_on', 'approved_at', 'life_reviewer_id', 'life_reviewer_grant_id', 'life_reviewed_at',
    'life_rereviewed_by', 'life_rereviewed_at']) assert.ok(!qcols.includes(c), c);
  for (const c of ['chapter', 'min_age_band', 'education_only']) assert.ok(qcols.includes(c), c);
  assert.deepEqual((await cols('sport_quiz_life_chapters')).sort(), ['framing', 'id', 'open', 'position', 'title', 'updated_at', 'updated_by']);
  const audit = (await one("select pg_get_constraintdef(oid) d from pg_constraint where conname='sport_quiz_audit_action_check'")).d;
  assert.ok(!/rereview|signoff|reviewer/.test(audit), audit);
  await assert.rejects(() => rpc('admin', 'public.quiz_admin_question($1,$2,$3::jsonb,$4)', [randomUUID(), 'rereview', JSON.stringify({ reason }), P.admin]), /quiz_question_action_invalid/);
});

// 2. Seeds and the generated bank -----------------------------------------------------------------------------------------
await test('four 13+ chapters are seeded closed; the generated bank loads 40 drafts (10 per chapter) and every chapter stays closed until 5 approved', async () => {
  assert.deepEqual((await db.query('select id,title,framing from public.sport_quiz_life_chapters order by position')).rows.map(r => [r.id, r.title, r.framing]), CHAPTERS);
  const bank = JSON.parse(fs.readFileSync('supabase/content/life_playbook_bank.json', 'utf8'));
  const rows = (await db.query('select status,chapter,min_age_band,education_only,sport from public.sport_quiz_questions where question_key=any($1::uuid[])', [bank.map(q => q.key)])).rows;
  assert.equal(rows.length, 40); assert.ok(rows.every(r => r.status === 'draft' && r.education_only === true && r.min_age_band === '13'));
  const per = rows.reduce((m, r) => ((m[r.chapter] = (m[r.chapter] || 0) + 1), m), {});
  assert.deepEqual(per, { money_huddle: 10, savings_season: 10, scam_defense: 10, smart_plays: 10 });
  const s = await admin('public.quiz_admin_life_snapshot()');
  assert.equal(s.open_at, 5); assert.equal(s.chapters.length, 4);
  assert.ok(s.chapters.every(c => c.open === false && c.switched_open === false && c.approved_count === 0 && c.needs_more === 5 && c.ready === false
    && c.reasons[0] === 'needs 5 more approved questions' && c.draft_count === 10));
  for (const k of ['signoffs', 'reviewers', 'rereview', 'today']) assert.ok(!(k in s), k);
  for (const k of ['min_age_band', 'domain', 'needs_signoff', 'note']) assert.ok(!(k in s.chapters[0]), k);
  assert.equal(s.settings.life_enabled, false, 'trivia.life starts off');
});
await test('trivia.life is off by default: the Life snapshot says off and Life Start is refused', async () => {
  assert.equal((await lifeSnap('a1')).availability, 'off');
  await assert.rejects(() => lifeStart('a1'), /quiz_life_paused|quiz_notice_required/);
});

// 3. Life question fields and one-admin approval -------------------------------------------------------------------------
await test('Life fields: validated on create; removed fields refused; trivia questions cannot carry them; a family stays Life or trivia', async () => {
  for (const extra of [{ source_url: 'https://www.consumerfinance.gov/' }, { as_of_tax_year: 2025 }, { source_retrieved_on: '2026-10-01' }])
    await assert.rejects(() => lifeDraft('money_huddle', extra), /quiz_question_action_invalid/, Object.keys(extra)[0]);
  await assert.rejects(() => lifeDraft('money_huddle', { min_age_band: '16' }), /quiz_life_fields_invalid/, 'every chapter is 13+');
  for (const gone of ['bank_basics', 'credit_clock', 'tax_timeout', 'life_needs', 'paycheck_playbook', 'nope_chapter'])
    await assert.rejects(() => lifeDraft(gone), /quiz_life_fields_invalid/, gone);
  await assert.rejects(() => lifeDraft('money_huddle', { education_only: undefined }), /quiz_life_fields_invalid/);
  await assert.rejects(() => question('admin', null, 'create', { family_action: 'new', topic_category: 'sport', sport: 'Basketball', prompt: 'Which reviewed fact is the fixture fact?',
    options: ['a1', 'b1', 'c1', 'd1'], correct_option: 0, explanation: 'Reviewed fixture explanation.', source_notes: 'Official rules reviewed here.', chapter: 'money_huddle', reason }), /quiz_life_fields_invalid/);
  const q = await lifeDraft('savings_season', { min_age_band: undefined });
  await assert.rejects(() => question('admin', q.id, 'edit', { ...lifeBase('savings_season'), family_action: 'existing', topic_category: 'sport', sport: 'Basketball', chapter: undefined, min_age_band: undefined,
    education_only: undefined }), /quiz_family_invalid|quiz_life_fields_invalid/);
  assert.deepEqual(await one('select sport,min_age_band,chapter from public.sport_quiz_questions where id=$1', [q.id]), { sport: 'Savings Season', min_age_band: '13', chapter: 'savings_season' });
});
let familyQ;
await test('one admin approves a Life question like sports trivia: the author may approve, no grant or second admin; a fan cannot', async () => {
  const q = await lifeDraft('money_huddle');
  assert.equal((await approve('admin', q.id)).status, 'approved', 'the writing admin approves');
  const r = await one('select reviewed_by,status from public.sport_quiz_questions where id=$1', [q.id]); assert.equal(r.reviewed_by, P.admin);
  const v2 = await question('admin', q.id, 'edit', { ...lifeBase('money_huddle'), family_action: 'existing' });
  assert.equal((await approve('admin', v2.id)).status, 'approved', 'the same admin approves the next version too');
  assert.equal((await one('select status from public.sport_quiz_questions where id=$1', [q.id])).status, 'archived');
  familyQ = v2;
  const other = await lifeDraft('smart_plays', {}, 'admin2'); assert.equal((await approve('admin', other.id)).status, 'approved', 'any admin');
  const fanTry = await lifeDraft('money_huddle');
  await assert.rejects(() => approve('fan', fanTry.id), /quiz_|permission denied/);
  // A bank draft passes the rules and is approvable by one admin as written (its short source note is enough).
  const bankDraft = (await one("select id from public.sport_quiz_questions where topic_category='life' and chapter='scam_defense' and reason like 'Life Playbook draft (QUIZ-04)%' limit 1")).id;
  assert.equal((await approve('admin2', bankDraft)).status, 'approved');
  assert.ok((await one("select count(*)::int n from public.sport_quiz_audit where action='question_approve'")).n >= 4);
});
await test('a missing education-only attestation refuses approval; chapter, band and attestation are fixed on a version', async () => {
  const noattest = await lifeDraft('money_huddle', { education_only: false });
  await assert.rejects(() => approve('admin', noattest.id), /quiz_life_attestation_required/);
  for (const set of ["chapter='savings_season'", "min_age_band=null", 'education_only=false'])
    await assert.rejects(() => db.query(`update public.sport_quiz_questions set ${set} where id=$1`, [familyQ.id]), /quiz_immutable|quiz_life|violates/, set);
});
await test('the simplified copy rules refuse money figures, years, a missing scam ending, long text, brands, advice, Tapua\'i words, NIL and tax at approval', async () => {
  const cases = [
    ['money_figure', 'money_huddle', { explanation: 'A budget might set aside $40 each week for saving goals.' }],
    ['money_figure', 'savings_season', { prompt: 'Life fixture: saving ten percent of each paycheck is called what?' }],
    ['money_figure', 'money_huddle', { options: ['Two grand', 'Second idea', 'Third idea', 'Fourth idea'] }],
    ['year', 'smart_plays', { explanation: 'In 2024 many teams planned their season with a budget.' }],
    ['scam_missing_report_line', 'scam_defense', { explanation: 'Phishing messages pretend to be someone trusted. Delete them.' }],
    ['prompt_too_long', 'money_huddle', { prompt: `Life fixture: which choice names the plan for spending before the season starts? ${'a'.repeat(70)}` }],
    ['explanation_too_long', 'money_huddle', { explanation: `A budget plans spending. ${'b'.repeat(190)}` }],
    ['brand_name', 'smart_plays', { options: ['Venmo', 'Second idea', 'Third idea', 'Fourth idea'] }],
    ['advice_you_should', 'savings_season', { explanation: 'You should always save before spending anything.' }],
    ['tapuai_money_word', 'money_huddle', { prompt: 'Life fixture: what is a donation in this lesson about the team budget?' }],
    ['tapuai_money_word', 'money_huddle', { explanation: 'Mālo is a thank-you word in this fixture.' }],
    ['nil_eligibility', 'smart_plays', { explanation: 'NIL deals can change what a high school athlete may do.' }],
    ['tax_loan_credit', 'smart_plays', { explanation: 'Taxes, a loan or a credit score are not simple facts here.' }],
  ];
  for (const [rule, chapter, extra] of cases) {
    const q = await lifeDraft(chapter, extra);
    await assert.rejects(() => approve('admin', q.id), new RegExp(`quiz_life_copy: .*${rule}`), rule);
  }
  const ok = await lifeDraft('scam_defense', { explanation: 'A message that rushes a decision is a classic scam play. Tell a trusted adult and use Report.' });
  assert.equal((await approve('admin', ok.id)).status, 'approved');
  const words = (await one("select public.quiz_life_copy_problems('Every dollar in the plan gets a job','[\"Fund the goal\",\"Invest time in learning\",\"c\",\"d\"]','Plain words.','money_huddle') p")).p;
  assert.deepEqual(words, [], 'concept words without a figure are allowed');
});
// Probe cases shared with the JS check (scripts/life-bank-sql.mjs --check).
const { PROBES, ITEM_PROBES } = await import(pathToFileURL(path.resolve('scripts/life-bank-sql.mjs')).href);
await test('copy rules: normalized probes (lookalikes, zero-width, spelled figures, years, scam ending, lengths) match the JS list exactly', async () => {
  assert.ok(PROBES.length >= 35 && ITEM_PROBES.length >= 3);
  for (const [chapter, explanation, want] of PROBES) {
    const got = (await one('select public.quiz_life_copy_problems($1,$2::jsonb,$3,$4) p', ['Prompt text here', '["a","b"]', explanation, chapter])).p;
    assert.deepEqual(got, want, explanation);
  }
  for (const [prompt, options, explanation, chapter, want] of ITEM_PROBES)
    assert.deepEqual((await one('select public.quiz_life_copy_problems($1,$2::jsonb,$3,$4) p', [prompt, JSON.stringify(options), explanation, chapter])).p, want, prompt);
  const rules = JSON.parse(fs.readFileSync('supabase/content/life_copy_rules.json', 'utf8')); delete rules._comment;
  assert.equal(rules.version, 4);
  assert.deepEqual((await one('select public.quiz_life_copy_rules() r')).r, rules, 'SQL rule list equals the JSON file');
  for (const k of ['illustrative_marker', 'disclaimer', 'health_words', 'stranger_words']) assert.ok(!(k in rules), k);
});

// 3b. Control tower: whole-bank review counts and the atomic edit (2026-10-15) ------------------------------------------
// No approvals here: the chapter tests below count approved items. Drafts and archived versions do not change them.
const adminSnap = (key = 'admin') => rpc(key, 'public.quiz_admin_snapshot($1,$2)', [null, null]);
const bankCountsSql = async () => ({
  topics: (await db.query("select topic_category,count(*) filter (where status='draft')::int draft_count,count(*) filter (where status='approved')::int approved_count from public.sport_quiz_questions where status in ('draft','approved') group by 1 order by 1")).rows,
  sports: (await db.query("select sport,count(*) filter (where status='draft')::int draft_count,count(*) filter (where status='approved')::int approved_count from public.sport_quiz_questions where status in ('draft','approved') and topic_category='sport' group by 1 order by 1")).rows,
  chapters: (await db.query("select c.id chapter,count(q.id) filter (where q.status='draft')::int draft_count,count(q.id) filter (where q.status='approved')::int approved_count from public.sport_quiz_life_chapters c left join public.sport_quiz_questions q on q.chapter=c.id and q.topic_category='life' group by c.id,c.position order by c.position")).rows,
});
const familyState = async key => (await db.query('select id,version,status,prompt from public.sport_quiz_questions where question_key=$1 order by version', [key])).rows;
const auditCount = async () => (await one('select count(*)::int n from public.sport_quiz_audit')).n;
const replace = (key, id, payload) => question(key, id, 'edit_replace', payload);
const lifeEdit = (chapter, extra = {}) => ({ ...lifeBase(chapter), family_action: 'existing', ...extra });
await test('review counts: bank_counts matches the whole bank by topic, sport and chapter, including drafts beyond the first 50-row page', async () => {
  for (let i = 0; (await one("select count(*)::int n from public.sport_quiz_questions where status='draft'")).n <= 60; i++)
    await question('admin', null, 'create', { family_action: 'new', topic_category: 'sport', sport: i % 2 ? 'Rugby' : 'Volleyball', prompt: `Which reviewed draft fact is number ${++n}?`,
      options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 1, explanation: 'The second choice is the reviewed draft fact.',
      source_notes: 'Official rules reviewed for this local fixture.', reason });
  const s = await adminSnap();
  assert.deepEqual(s.bank_counts, await bankCountsSql());
  const drafts = s.bank_counts.topics.reduce((sum, t) => sum + t.draft_count, 0);
  assert.equal(drafts, s.counts.questions_draft, 'the topic totals add up to the bank draft count');
  assert.ok(drafts > 60 && s.questions.length === 50 && s.next_question_cursor, 'more drafts than one loaded page');
  assert.ok(s.questions.filter(q => q.status === 'draft').length < drafts, 'the first page alone would undercount');
  assert.equal(s.bank_counts.chapters.length, 4, 'every chapter, zeros included');
  const lifeDrafts = s.bank_counts.chapters.reduce((sum, c) => sum + c.draft_count, 0);
  assert.equal(lifeDrafts, s.bank_counts.topics.find(t => t.topic_category === 'life').draft_count);
  assert.deepEqual((await admin('public.quiz_admin_life_snapshot()')).chapters.map(c => c.draft_count), s.bank_counts.chapters.map(c => c.draft_count), 'agrees with the Life desk');
});
await test('review counts are admin-only content counts: fan, guest and service role refused; only topic / sport / chapter and two counts per row', async () => {
  await denied('fan', 'public.quiz_admin_snapshot(null,null)');
  await denied('anon', 'public.quiz_admin_snapshot(null,null)');
  await denied('service', 'public.quiz_admin_snapshot(null,null)');
  const { bank_counts: b } = await adminSnap('admin2');
  assert.deepEqual(Object.keys(b).sort(), ['chapters', 'sports', 'topics']);
  for (const [list, label] of [['topics', 'topic_category'], ['sports', 'sport'], ['chapters', 'chapter']])
    for (const row of b[list]) assert.deepEqual(Object.keys(row).sort(), ['approved_count', 'draft_count', label].sort(), list);
});
await test('atomic edit: edit_replace creates the new draft version and archives the replaced draft together, with both audit rows', async () => {
  const d = await lifeDraft('smart_plays');
  const before = await bankCountsSql(); const audits = await auditCount();
  const r = await replace('admin2', d.id, lifeEdit('smart_plays', { question_key: d.question_key, prompt: 'Life fixture: a game plan for the week is called a schedule?', reason: 'Content review of one draft.' }));
  assert.equal(r.status, 'draft'); assert.equal(r.version, 2); assert.equal(r.question_key, d.question_key);
  assert.equal(r.replaced_id, d.id); assert.equal(r.replaced_status, 'archived');
  const fam = await familyState(d.question_key);
  assert.deepEqual(fam.map(x => [x.id, x.status]), [[d.id, 'archived'], [r.id, 'draft']]);
  const old = await one('select reason,reviewed_by from public.sport_quiz_questions where id=$1', [d.id]);
  assert.deepEqual(old, { reason: 'Content review of one draft.', reviewed_by: P.admin2 });
  const rows = (await db.query("select action,question_id,actor_id,reason,created_at from public.sport_quiz_audit order by id desc limit 2")).rows.reverse();
  assert.deepEqual(rows.map(x => [x.action, x.question_id, x.actor_id, x.reason]),
    [['question_edit', r.id, P.admin2, 'Content review of one draft.'], ['question_archive', d.id, P.admin2, 'Content review of one draft.']]);
  assert.equal(String(rows[0].created_at), String(rows[1].created_at), 'one transaction time');
  assert.equal(await auditCount(), audits + 2);
  assert.deepEqual(await bankCountsSql(), before, 'a replacement leaves the draft counts unchanged');
  // Sports trivia uses the same action; the editor may change the sport within the sports topic.
  const sq = await question('admin', null, 'create', { family_action: 'new', topic_category: 'sport', sport: 'Rugby', prompt: `Which reviewed rugby fact is number ${++n}?`,
    options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 1, explanation: 'The second choice is the reviewed rugby fact.', source_notes: 'Official rules reviewed for this local fixture.', reason });
  const sr = await replace('admin', sq.id, { family_action: 'existing', topic_category: 'sport', sport: 'Rugby', prompt: 'Which reviewed rugby fact is the edited one?', options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'],
    correct_option: 2, explanation: 'The third choice is the reviewed rugby fact.', source_notes: 'Official rules reviewed for this local fixture.', reason });
  assert.deepEqual((await familyState(sq.question_key)).map(x => x.status), ['archived', 'draft']); assert.equal(sr.replaced_id, sq.id);
});
await test('atomic edit: a refusal part-way (copy rule, attestation, lengths, content, family, actor, reason) leaves the draft and the audit unchanged', async () => {
  const d = await lifeDraft('scam_defense');
  const fam = await familyState(d.question_key); const audits = await auditCount();
  const unchanged = async label => { assert.deepEqual(await familyState(d.question_key), fam, label); assert.equal(await auditCount(), audits, label); };
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { explanation: 'A fake prize asks for $40 first. Tell a trusted adult and use Report.' })), /quiz_life_copy: .*money_figure/);
  await unchanged('copy rule: money figure');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { explanation: 'Phishing messages pretend to be someone trusted. Delete them.' })), /quiz_life_copy: .*scam_missing_report_line/);
  await unchanged('copy rule: scam ending');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { prompt: `Life fixture: which choice names the scam play here? ${'a'.repeat(100)}` })), /quiz_life_copy: .*prompt_too_long/);
  await unchanged('Life length limit');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { education_only: false })), /quiz_life_attestation_required/);
  await unchanged('attestation');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { options: ['Only', 'Three', 'Answers'] })), /quiz_question_content_invalid/);
  await unchanged('content');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { prompt: 'Too short' })), /quiz_|violates/);
  await unchanged('trivia length limit (prompt at least 10 characters)');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { topic_category: 'sport', sport: 'Rugby', chapter: undefined, min_age_band: undefined, education_only: undefined })), /quiz_family_invalid/);
  await unchanged('a Life family stays Life');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { question_key: randomUUID() })), /quiz_family_invalid/);
  await unchanged('another family key');
  await assert.rejects(() => rpc('admin', 'public.quiz_admin_question($1,$2,$3::jsonb,$4)', [d.id, 'edit_replace', JSON.stringify(lifeEdit('scam_defense')), P.admin2]), /quiz_identity_changed/);
  await unchanged('actor mismatch');
  await assert.rejects(() => replace('fan', d.id, lifeEdit('scam_defense')), /quiz_|permission denied/);
  await unchanged('a fan');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { reason: 'short' })), /quiz_question_action_invalid/);
  await unchanged('reason under 10 characters');
  await assert.rejects(() => replace('admin', d.id, lifeEdit('scam_defense', { source_url: 'https://example.org/' })), /quiz_question_action_invalid/);
  await unchanged('unknown field');
});
await test('atomic edit refuses a replaced row that is no longer a draft (approved, archived, void); nothing changes', async () => {
  const approvedSport = (await one("select id,question_key from public.sport_quiz_questions where topic_category='sport' and status='approved' limit 1"));
  const archived = (await one("select id,question_key from public.sport_quiz_questions where topic_category='life' and status='archived' limit 1"));
  const voidQ = await question('admin', null, 'create', { family_action: 'new', topic_category: 'science', sport: 'Science', prompt: `Which reviewed science fact is number ${++n}?`,
    options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 1, explanation: 'The second choice is the reviewed science fact.', source_notes: 'Everyday fact checked here.', reason });
  await question('admin', voidQ.id, 'void', { reason: 'Fixture void of one draft fact.' });
  for (const [q, payload] of [[familyQ, lifeEdit('money_huddle')], [archived, lifeEdit('smart_plays')], [approvedSport, { family_action: 'existing', topic_category: 'sport', sport: 'Basketball', prompt: 'Which reviewed fact replaces an approved one?',
    options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 0, explanation: 'The first choice is the reviewed fact.', source_notes: 'Official rules reviewed for this local fixture.', reason }],
    [{ id: voidQ.id, question_key: voidQ.question_key }, { family_action: 'existing', topic_category: 'science', sport: 'Science', prompt: 'Which reviewed science fact replaces a void one?',
      options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 0, explanation: 'The first choice is the reviewed fact.', source_notes: 'Everyday fact checked here.', reason }]]) {
    const fam = await familyState(q.question_key); const audits = await auditCount();
    await assert.rejects(() => replace('admin', q.id, payload), /quiz_replace_draft_only/);
    assert.deepEqual(await familyState(q.question_key), fam); assert.equal(await auditCount(), audits);
  }
  await assert.rejects(() => replace('admin', randomUUID(), lifeEdit('money_huddle')), /quiz_question_missing/);
});
await test('atomic edit keeps the version caps: at the Life cap a create is refused while a replacement (net zero) still saves', async () => {
  const d = await lifeDraft('smart_plays');
  await db.exec('begin');
  try {
    const have = (await one("select count(*)::int n from public.sport_quiz_questions where status in ('draft','approved') and topic_category='life'")).n;
    await db.query(`insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type,chapter,min_age_band,education_only)
      select gen_random_uuid(),1,'Smart Plays','Cap filler prompt number '||g,'["True","False"]'::jsonb,0,'Cap filler explanation.',$2,'life','Cap filler source note.','true_false','smart_plays','13',true
      from generate_series(1,$1::int) g`, [200 - have, reason]);
    await db.exec('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: ids.admin })]);
    const call = (id, action, payload) => db.query('select public.quiz_admin_question($1,$2,$3::jsonb,$4) r', [id, action, JSON.stringify(payload), P.admin]);
    await db.exec('savepoint at_cap');
    await assert.rejects(() => call(null, 'create', lifeBase('smart_plays')), /quiz_life_bank_full/);
    await db.exec('rollback to savepoint at_cap');
    await assert.rejects(() => call(d.id, 'edit', lifeEdit('smart_plays')), /quiz_life_bank_full/, 'a plain edit at the cap still grows the bank');
    await db.exec('rollback to savepoint at_cap');
    assert.equal((await call(d.id, 'edit_replace', lifeEdit('smart_plays'))).rows[0].r.status, 'draft');
    await db.exec('reset role');
    assert.equal((await one("select count(*)::int n from public.sport_quiz_questions where status in ('draft','approved') and topic_category='life'")).n, 200);
  } finally { await db.exec('rollback'); }
  assert.equal((await familyState(d.question_key)).length, 1, 'the cap fixture rolled back');
});
await test('direct-table access stays denied: an admin, fan, guest or service role cannot archive, insert or audit outside the RPC', async () => {
  const d = await lifeDraft('smart_plays');
  for (const k of ['admin', 'fan', 'anon', 'service']) {
    await assert.rejects(() => actor(k, "update public.sport_quiz_questions set status='archived' where id=$1", [d.id]), /permission denied/, k);
    await assert.rejects(() => actor(k, "insert into public.sport_quiz_audit(action,reason) values('question_archive','Direct insert attempt.')"), /permission denied/, k);
  }
  assert.equal((await one('select status from public.sport_quiz_questions where id=$1', [d.id])).status, 'draft');
});

// 4. Chapters ------------------------------------------------------------------------------------------------------------
const openChapter =(ch, open = true) => admin('public.quiz_admin_life_chapter($1,$2,$3,$4)', [ch, open, reason, P.admin]);
await test('a chapter opens with 5 approved questions (one round); before that it reads "needs N more approved questions"', async () => {
  const have = (await one("select count(*)::int n from public.sport_quiz_questions where chapter='money_huddle' and status='approved'")).n;
  for (let i = have; i < 4; i++) await approvedLife('money_huddle');
  await assert.rejects(() => openChapter('money_huddle'), /quiz_life_chapter_not_ready: needs 1 more approved question$/);
  await assert.rejects(() => db.query("update public.sport_quiz_life_chapters set open=true where id='money_huddle'"), /quiz_life_chapter_not_ready/);
  const st = (await admin('public.quiz_admin_life_snapshot()')).chapters.find(c => c.id === 'money_huddle');
  assert.equal(st.needs_more, 1); assert.deepEqual(st.reasons, ['needs 1 more approved question']);
  await approvedLife('money_huddle');
  const r = await openChapter('money_huddle'); assert.equal(r.open, true); assert.equal(r.ready, true); assert.deepEqual(r.reasons, []);
  assert.ok((await one("select count(*)::int n from public.sport_quiz_audit where action='life_chapter'")).n >= 1);
  await assert.rejects(() => db.query("delete from public.sport_quiz_life_chapters where id='smart_plays'"), /quiz_life_chapter_immutable/);
  await assert.rejects(() => db.query("update public.sport_quiz_life_chapters set id='other_play' where id='smart_plays'"), /quiz_life_chapter_immutable/);
  // Closing and re-opening follows the same rule; a void that drops below 5 stops drawing until topped up.
  const q = await approvedLife('savings_season'); for (let i = 0; i < 4; i++) await approvedLife('savings_season');
  assert.equal((await openChapter('savings_season')).open, true);
  await question('admin', q.id, 'void', { reason: 'Fixture correction of one Life fact.' });
  const sv = (await admin('public.quiz_admin_life_snapshot()')).chapters.find(c => c.id === 'savings_season');
  assert.equal(sv.switched_open, true); assert.equal(sv.open, false); assert.deepEqual(sv.reasons, ['needs 1 more approved question']);
  await approvedLife('savings_season');
  assert.equal((await admin('public.quiz_admin_life_snapshot()')).chapters.find(c => c.id === 'savings_season').open, true);
});
await test('settings: invalid thresholds refused; the switch turns Life on with an audited reason', async () => {
  await assert.rejects(() => lifeSettings(true, { ...DEFAULT_TH, varsity: 0 }), /quiz_settings_invalid/);
  await assert.rejects(() => lifeSettings(true, { ...DEFAULT_TH, pro: 30 }), /quiz_settings_invalid/);
  const r = await lifeSettings(true); assert.equal(r.life_enabled, true); assert.deepEqual(r.level_thresholds, DEFAULT_TH);
  assert.ok((await one("select count(*)::int n from public.sport_quiz_audit where action='life_settings'")).n >= 1);
});
await test('the opt-in is private: not opted in refuses Life; CAS on its own version; the trivia snapshot and admin desk never show it', async () => {
  assert.equal((await lifeSnap('a1')).availability, 'not_opted_in');
  await assert.rejects(() => lifeStart('a1'), /quiz_notice_required|quiz_life_not_opted_in/);
  await assert.rejects(() => rpc('a1', 'public.quiz_life_preferences($1,$2,$3,$4)', [true, null, 0, P.a1]), /quiz_preferences_invalid/);
  const r = await optIn('a1'); assert.equal(r.preferences.life_opt_in, true);
  await assert.rejects(() => rpc('a1', 'public.quiz_life_preferences($1,$2,$3,$4)', [false, null, 0, P.a1]), /quiz_preferences_stale/);
  assert.equal((await rpc('a1', 'public.quiz_life_preferences($1,$2,$3,$4)', [true, NOTICE, 0, P.a1])).outcome, 'unchanged');
  assert.equal((await lifeSnap('a1')).availability, 'ready');
  assert.ok(!('life_opt_in' in (await snapshot('a1')).preferences));
  const adminText = JSON.stringify(await admin('public.quiz_admin_life_snapshot()'));
  assert.ok(!adminText.includes(P.a1)); assert.equal((await admin('public.quiz_admin_life_snapshot()')).stats.opted_in, null, 'fewer than 10 opted in is hidden');
  for (const k of players.filter(k => k !== 'a1')) await optIn(k);
});


// 6. Round kinds ------------------------------------------------------------------------------------------------------------
{ const have = (await one("select count(*)::int n from public.sport_quiz_questions where chapter='money_huddle' and status='approved'")).n;
  for (let i = have; i < 26; i++) await approvedLife('money_huddle'); }
let fam;
await test('three independent weekly rounds: personal, group and Life in one week; each spends only its own guard', async () => {
  const g = await createGroup('a1'); fam = g; assert.equal((await join('a2', g.code)).outcome, 'joined');
  const p = await start('a1', { sport: 'Basketball' }); assert.equal(p.attempt.round_kind, 'personal'); await answer('a1', p.attempt.id); await end('a1', p.attempt.id, 'personal');
  let s = await snapshot('a1'); assert.deepEqual(s.week_spent_by_kind, { personal: true, group: false, life: false }, 'personal consumes nothing else');
  const gr = await groupStart('a1', g.group_id); assert.equal(gr.attempt.round_kind, 'group'); await answer('a1', gr.attempt.id); await end('a1', gr.attempt.id, 'group');
  assert.equal((await lifeSnap('a1')).week_spent, false, 'group does not consume Life');
  const l = await lifeStart('a1'); assert.equal(l.outcome, 'started'); assert.equal(l.attempt.round_kind, 'life'); assert.equal(l.attempt.duration_seconds, 90);
  assert.equal(l.active_question.topic_category, 'life');
  await answer('a1', l.attempt.id); await end('a1', l.attempt.id, 'life');
  s = await snapshot('a1'); assert.deepEqual(s.week_spent_by_kind, { personal: true, group: true, life: true });
  assert.equal((await start('a1', { sport: 'Basketball' })).outcome, 'week_spent');
  assert.equal((await lifeStart('a1')).outcome, 'week_spent');
  assert.equal((await one('select count(*)::int n from public.sport_quiz_attempts where profile_id=$1 and week_start=$2', [P.a1, week])).n, 3);
  // Life audit rows keep chapter and position only; the trivia admin counts leave Life out.
  const au = await one("select u.question_id,u.reason from public.sport_quiz_audit u where u.attempt_id=$1 and u.action='start'", [l.attempt.id]);
  assert.equal(au.question_id, null); assert.match(au.reason, /^[a-z_]+ #1$/);
  assert.ok((await one("select count(*)::int n from public.sport_quiz_audit u join public.sport_quiz_attempts a on a.id=u.attempt_id where a.round_kind='life' and u.question_id is not null")).n === 0);
  const tri = await admin('public.quiz_admin_snapshot()');
  assert.equal(tri.counts.week_rounds_life, undefined);
  // The trivia audit feed leaves Life participant rows out entirely (no chapter / position row by row).
  const lifeAuditIds = (await db.query("select u.id::text id from public.sport_quiz_audit u join public.sport_quiz_attempts a on a.id=u.attempt_id where a.round_kind='life'")).rows.map(r => r.id);
  assert.ok(lifeAuditIds.length >= 3);
  assert.ok(!tri.audit.some(x => lifeAuditIds.includes(x.id) || (['start', 'answer', 'end'].includes(x.action) && x.reason !== null)));
  assert.equal(tri.counts.week_items_issued, (await one("select count(*)::int n from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id=i.attempt_id where a.week_start=$1 and a.round_kind<>'life'", [week])).n);
});
await test('one active round at a time across kinds; 30 seconds is allowed for Life', async () => {
  const l = await lifeStart('a2', { duration: 30 }); assert.equal(l.attempt.duration_seconds, 30);
  await assert.rejects(() => start('a2', { sport: 'Basketball' }), /quiz_round_active/);
  await assert.rejects(() => groupStart('a2', fam.group_id), /quiz_round_active/);
  assert.equal((await snapshot('a2')).active_round_kind, 'life');
  assert.equal((await snapshot('a2')).attempt.round_kind, 'life', 'the trivia snapshot surfaces the open round of any kind');
  // Next re-checks Life access: an opt-out between items closes the round with no question.
  await answer('a2', l.attempt.id);
  await db.query('update public.sport_quiz_preferences set life_opt_in=false where profile_id=$1', [P.a2]);
  const nx = await next('a2', l.attempt.id, 1); assert.equal(nx.outcome, 'access_revoked'); assert.equal(nx.active_question, null);
  await db.query('update public.sport_quiz_preferences set life_opt_in=true where profile_id=$1', [P.a2]);
});
await test('exact recovery per kind: the same Start request returns the same open item for personal, group and Life; Next too', async () => {
  assert.equal((await join('a3', fam.code)).outcome, 'joined');
  for (const [kind, go] of [['personal', r => start('a3', { request: r, sport: 'Basketball' })], ['group', r => groupStart('a3', fam.group_id, { request: r })], ['life', r => lifeStart('a3', { request: r })]]) {
    const req = randomUUID(); const a = await go(req); const b = await go(req);
    assert.equal(a.outcome, 'started', kind); assert.deepEqual(b.active_question, a.active_question, kind); assert.equal(b.active_item.expires_at, a.active_item.expires_at, kind);
    assert.equal(b.round_kind, kind);
    if (kind === 'life') {
      await answer('a3', a.attempt.id); const nr = randomUUID();
      const n1 = await next('a3', a.attempt.id, 1, { request: nr }); const n2 = await next('a3', a.attempt.id, 1, { request: nr });
      assert.equal(n1.active_item.position, 2); assert.deepEqual(n2.active_question, n1.active_question);
      await assert.rejects(() => end('a3', a.attempt.id, 'personal'), /quiz_end_invalid/, 'End must name the round\'s own kind');
    }
    assert.notEqual((await end('a3', a.attempt.id, kind)).outcome, 'issued');
  }
});
await test('End per kind: cancelling an unknown Life Start spends only the Life guard; a personal cancel spends only personal', async () => {
  const e = await cancel('ad', randomUUID(), 'life'); assert.equal(e.outcome, 'cancelled'); assert.equal(e.round_kind, 'life');
  assert.deepEqual((await snapshot('ad')).week_spent_by_kind, { personal: false, group: false, life: true });
  await assert.rejects(() => cancel('ad', randomUUID(), 'life'), /quiz_round_closed/);
  await cancel('ad', randomUUID(), 'personal');
  assert.deepEqual((await snapshot('ad')).week_spent_by_kind, { personal: true, group: false, life: true });
  await assert.rejects(() => cancel('ad', randomUUID(), 'everything'), /quiz_end_invalid/);
  // A kind the caller cannot start writes nothing: not enrolled, or no group membership.
  const rows = async k => (await one('select (select count(*) from public.sport_quiz_requests where profile_id=$1)::int + (select count(*) from public.sport_quiz_week_guards where profile_id=$1)::int n', [P[k]])).n;
  const plainBefore = await rows('plain');
  await assert.rejects(() => cancel('plain', randomUUID(), 'life'), /quiz_round_closed/);
  assert.equal(await rows('plain'), plainBefore);
  const adBefore = await rows('ad');
  await assert.rejects(() => cancel('ad', randomUUID(), 'group'), /quiz_round_closed/, 'not in any group');
  assert.equal(await rows('ad'), adBefore);
});
await test('request budgets: an ordinary-save flood cannot block Start, Next or End of any kind; each kind keeps reserved slots', async () => {
  await db.query(`insert into public.sport_quiz_requests(profile_id,request_id,operation,week_start,payload_digest,attempt_id,receipt,created_at,prune_after,capacity_class,round_kind)
    select $1,gen_random_uuid(),'invitation',$2::date,null,null,'{}'::jsonb,now(),now()+interval '35 days','ordinary','personal' from generate_series(1,171)`, [P.slots, week]);
  await assert.rejects(() => rpc('slots', 'public.quiz_preferences($1::jsonb,$2,$3,$4)', [JSON.stringify({ invitation_mode: 'off', topic_mode: 'mix', notice_version: 'timed-trivia-v1-testing' }), 1, randomUUID(), P.slots]), /quiz_request_limit/);
  const l = await lifeStart('slots'); assert.equal(l.outcome, 'started', 'Life Start is not blocked by ordinary saves');
  await answer('slots', l.attempt.id); const nx = await next('slots', l.attempt.id, 1); assert.equal(nx.outcome, 'issued');
  assert.notEqual((await end('slots', l.attempt.id, 'life')).outcome, 'issued');
  assert.equal((await cancel('slots', randomUUID(), 'personal')).outcome, 'cancelled');
  // A round-budget flood for one kind leaves only that kind's reserved answer / end slots, and no other kind is touched.
  await db.query(`insert into public.sport_quiz_requests(profile_id,request_id,operation,week_start,payload_digest,attempt_id,receipt,created_at,prune_after,capacity_class,round_kind)
    select $1,gen_random_uuid(),'start',$2::date,null,null,'{}'::jsonb,now(),now()+interval '35 days','round','group' from generate_series(1,20)`, [P.a2, week]);
  assert.equal((await cancel('a2', randomUUID(), 'group')).outcome, 'cancelled', 'group reserved slots');
  const classes = (await db.query("select round_kind,capacity_class,count(*)::int n from public.sport_quiz_requests where profile_id=any($1::uuid[]) and capacity_class<>'ordinary' group by 1,2 order by 1,2", [[P.slots, P.a2]])).rows;
  assert.ok(classes.some(r => r.round_kind === 'group' && r.capacity_class === 'answer') && classes.some(r => r.round_kind === 'group' && r.capacity_class === 'end'));
  assert.ok(classes.some(r => r.round_kind === 'life' && r.capacity_class === 'round' && r.n >= 4));
});
// 7. Eligibility: every eligible account sees all four chapters; no age wording ---------------------------------------------
const noAge = async (work) => { try { await work(); assert.fail('expected refusal'); } catch (e) { assert.ok(!/unlock|birth|older|age/i.test(e.message), e.message); return e.message; } };
const chaptersSeen = async attempt => (await db.query('select q.chapter,q.min_age_band from public.sport_quiz_round_items i join public.sport_quiz_questions q on q.id=i.question_id where i.attempt_id=$1', [attempt])).rows;
await test('13–15 and adult accounts see the same four chapters (participant fields only) and draw only from open chapters', async () => {
  for (const k of ['t13', 't16', 'a1']) {
    const ch = await rpc(k, 'public.quiz_life_chapters()');
    assert.deepEqual(ch.chapters.map(c => c.id), CHAPTERS.map(c => c[0]), k);
    for (const c of ch.chapters) assert.deepEqual(Object.keys(c).sort(), ['framing', 'id', 'open', 'position', 'title', 'unseen_count']);
    assert.ok(!/note|sign-off|signoff|cpa|reviewer|reason|credit|tax|unlock/i.test(JSON.stringify(ch)), k);
  }
  assert.match(await noAge(() => lifeStart('t13', { chapter: 'smart_plays' })), /quiz_no_question/, 'a closed chapter reads like an empty pool');
  assert.match(await noAge(() => lifeStart('t13', { chapter: 'credit_clock' })), /quiz_no_question/, 'a removed chapter reads like an empty pool');
  const prog = await rpc('t13', 'public.quiz_life_progress()'); assert.deepEqual(prog.chapters.map(c => c.id), CHAPTERS.map(c => c[0]));
  const l = await lifeStart('t13'); let pos = 1;
  for (;;) { await answer('t13', l.attempt.id); if (pos >= l.attempt.planned_items) break; await next('t13', l.attempt.id, pos); pos++; }
  assert.ok((await chaptersSeen(l.attempt.id)).every(r => r.min_age_band === '13' && ['money_huddle', 'savings_season', 'scam_defense'].includes(r.chapter)));
  assert.equal((await lifeSnap('t13')).chapters_open, 2 + Number((await admin('public.quiz_admin_life_snapshot()')).chapters.find(c => c.id === 'scam_defense').open));
});
await test('not_given accounts (13+ without a recorded age): Life works while sport trivia stays closed; Next keeps working', async () => {
  await db.query('update public.profiles set birth_year=null,birth_month=null,age_check_required=true where id=$1', [P.ng]);
  assert.equal((await one('select public.profile_age_band($1) b', [P.ng])).b, 'not_given');
  await assert.rejects(() => start('ng', { sport: 'Basketball' }), /quiz_ineligible/);
  assert.equal((await snapshot('ng')).availability, 'ineligible');
  assert.equal((await lifeSnap('ng')).availability, 'ready');
  assert.deepEqual((await rpc('ng', 'public.quiz_life_chapters()')).chapters.map(c => c.id), CHAPTERS.map(c => c[0]));
  const l = await lifeStart('ng'); await answer('ng', l.attempt.id); const nx = await next('ng', l.attempt.id, 1); assert.equal(nx.active_item.position, 2);
  await end('ng', l.attempt.id, 'life');
  assert.deepEqual(await one("select public.quiz_life_band_ok('under_13') u,public.quiz_life_band_ok(null) z,public.quiz_life_band_ok('unknown') k,public.quiz_life_band_ok('teen_13_15') t"),
    { u: false, z: false, k: true, t: true });
});
await test('eligibility is re-checked at Next: an account that stops being eligible mid-round gets no further Life item', async () => {
  const l = await lifeStart('t16'); await answer('t16', l.attempt.id);
  await db.query('update public.sport_quiz_preferences set life_notice_version=null where profile_id=$1', [P.t16]);
  const nx = await next('t16', l.attempt.id, 1); assert.equal(nx.outcome, 'access_revoked'); assert.equal(nx.active_question, null);
  await db.query("update public.sport_quiz_preferences set life_notice_version='life-playbook-v1-testing' where profile_id=$1", [P.t16]);
  // The Life actor itself refuses a band outside the trivia bands + not_given / unknown (under 13 never reaches Life).
  const def = (await one("select pg_get_functiondef('public.profile_age_band(uuid)'::regprocedure) d")).d;
  await db.exec(`create or replace function public.profile_age_band(target uuid) returns text language sql stable security definer set search_path='' as $$ select 'under_13'::text $$`);
  try {
    assert.equal((await lifeSnap('t16')).availability, 'ineligible');
    await assert.rejects(() => lifeStart('t16'), /quiz_ineligible/);
    await assert.rejects(() => rpc('t16', 'public.quiz_life_chapters()'), /quiz_ineligible/);
  } finally { await db.exec(def); }
});

// 8. Levels, Life badges and group rules --------------------------------------------------------------------------------------
await test('levels only go up: admin thresholds, a private chapter badge at Varsity, a void never lowers, erasure clears', async () => {
  await lifeSettings(true, { rookie: 0, varsity: 1, all_star: 2, pro: 3, hall_of_fame: 4 });
  const l = await lifeStart('lvl', { chapter: 'money_huddle' });
  await answer('lvl', l.attempt.id); await next('lvl', l.attempt.id, 1); await answer('lvl', l.attempt.id); await end('lvl', l.attempt.id, 'life');
  let lv = await rpc('lvl', 'public.quiz_level()'); assert.equal(lv.level, 'all_star'); assert.equal(lv.facts, 2); assert.equal(lv.next_level, 'pro');
  const prog = (await rpc('lvl', 'public.quiz_life_progress()')).chapters.find(c => c.id === 'money_huddle');
  assert.equal(prog.rank, 2); assert.equal(prog.badge_earned, true); assert.equal(prog.seen_count, 2); assert.ok(prog.progress > 0 && prog.progress <= 1);
  const badge = (await rpc('lvl', 'public.quiz_badge_shelf()')).badges.find(b => b.kind === 'life');
  assert.equal(badge.label, 'Money Huddle Playbook'); assert.equal(badge.visibility, 'private');
  await assert.rejects(() => rpc('lvl', 'public.quiz_badge_visibility($1,$2,$3)', [badge.id, 'groups', P.lvl]), /quiz_badge_missing/);
  const first = (await one('select question_id from public.sport_quiz_round_items where attempt_id=$1 and position=1', [l.attempt.id])).question_id;
  await question('admin', first, 'void', { reason: 'Fixture correction of one Life fact.' });
  lv = await rpc('lvl', 'public.quiz_level()'); assert.equal(lv.facts, 1); assert.equal(lv.level, 'all_star', 'a void never lowers the stored level');
  await assert.rejects(() => db.query("update public.sport_quiz_levels set rank=0,level='rookie' where profile_id=$1", [P.lvl]), /quiz_level_only_up/);
  await assert.rejects(() => db.query('delete from public.sport_quiz_levels where profile_id=$1', [P.lvl]), /quiz_level_only_up/);
  await lifeSettings(true);
  assert.equal((await rpc('lvl', 'public.quiz_level()')).level, 'all_star', 'raising thresholds never lowers a reached level');
  const hv = (await snapshot('lvl')).history_version;
  const out = await rpc('lvl', 'public.quiz_erase_history($1,$2)', [hv, P.lvl]); assert.ok(out.removed_levels >= 2);
  assert.equal((await rpc('lvl', 'public.quiz_level()')).level, 'rookie');
  assert.equal((await rpc('lvl', 'public.quiz_badge_shelf()')).badges.length, 0);
});
await test('group "played" counts group rounds only: Life and personal rounds never mark a group member played', async () => {
  const g = await createGroup('gp1'); await join('gp2', g.code);
  const l = await lifeStart('gp1'); await answer('gp1', l.attempt.id); await end('gp1', l.attempt.id, 'life');
  const p = await start('gp1', { sport: 'Basketball' }); await answer('gp1', p.attempt.id); await end('gp1', p.attempt.id, 'personal');
  let pg = await page('gp2', g.group_id); assert.equal(pg.members.find(m => m.display_name === 'Gp1').played_this_week, false);
  assert.ok(!(await rpc('gp1', 'public.quiz_badge_shelf()')).badges.some(b => b.label === 'Family Challenger'));
  const gr = await groupStart('gp1', g.group_id); await answer('gp1', gr.attempt.id); await end('gp1', gr.attempt.id, 'group');
  pg = await page('gp2', g.group_id); assert.equal(pg.members.find(m => m.display_name === 'Gp1').played_this_week, true);
  assert.ok((await rpc('gp1', 'public.quiz_badge_shelf()')).badges.some(b => b.label === 'Family Challenger'));
  assert.ok(!JSON.stringify(pg).match(/Playbook|life/i));
});
await test('a group round needs at least two active members', async () => {
  const g = await createGroup('solo');
  await assert.rejects(() => groupStart('solo', g.group_id), /quiz_group_too_small/);
  assert.equal((await snapshot('solo')).week_spent_by_kind.group, false);
});
await test('Trivia Explorer re-points to another qualifying round of the same week when its round is voided', async () => {
  const curl = await sportQ('Curling');
  const p = await start('te', { sport: 'Curling' }); assert.equal(p.attempt.planned_items, 1); await answer('te', p.attempt.id);
  const l = await lifeStart('te'); await answer('te', l.attempt.id); await end('te', l.attempt.id, 'life');
  const before = await one("select attempt_id,voided_at from public.sport_quiz_badges where profile_id=$1 and label='Trivia Explorer' and period=$2", [P.te, week]);
  assert.equal(before.attempt_id, p.attempt.id);
  await question('admin', curl.id, 'void', { reason: 'Fixture correction voids the personal round.' });
  const after = await one("select attempt_id,voided_at from public.sport_quiz_badges where profile_id=$1 and label='Trivia Explorer' and period=$2", [P.te, week]);
  assert.equal(after.attempt_id, l.attempt.id); assert.equal(after.voided_at, null);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_badges where profile_id=$1 and label='Trivia Explorer'", [P.te])).n, 1);
});

// 9. Switch, opt-out, privacy, erasure -----------------------------------------------------------------------------------
await test('switching trivia.life off ends open Life rounds for good; opting out ends your own', async () => {
  const l = await lifeStart('off1');
  await lifeSettings(false);
  assert.deepEqual(await one('select status,close_reason from public.sport_quiz_attempts where id=$1', [l.attempt.id]), { status: 'ended', close_reason: 'paused' });
  assert.equal((await lifeSnap('off1')).availability, 'off');
  await lifeSettings(true);
  const o = await lifeStart('opt1');
  const r = await optIn('opt1', false); assert.equal(r.preferences.life_opt_in, false);
  assert.equal((await one('select close_reason from public.sport_quiz_attempts where id=$1', [o.attempt.id])).close_reason, 'access_revoked');
});
await test('admin Life statistics are aggregate only: >= 20 responders per question, band x chapter and level cells under 10 hidden', async () => {
  const [qx, qy] = (await db.query("select id,question_key from public.sport_quiz_questions where chapter='money_huddle' and status='approved' order by created_at limit 2")).rows;
  const insertRound = async (k, q, wk) => {
    const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,round_state,position,planned_items,round_size,
      topic_category,round_kind,closed_at,close_reason,completed_at) values($1,$2::date,'completed',now(),'round',90,now(),now()+interval '90 seconds',null,1,1,5,'life','life',now(),'answered',now()) returning id`, [P[k], wk])).id;
    await db.query(`insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at)
      values($1,1,$2,$3,now(),now()+interval '90 seconds',1,now(),'answered',now())`, [a, q.id, q.question_key]);
  };
  const lastWeek = (await one('select ($1::date - 7)::text d', [week])).d; const older = (await one('select ($1::date - 14)::text d', [week])).d;
  for (const k of stats) await insertRound(k, qx, lastWeek);
  for (const k of stats.slice(0, 5)) await insertRound(k, qy, older);
  const s = (await admin('public.quiz_admin_life_snapshot()')).stats;
  const x = s.questions.find(r => r.question_id === qx.id); assert.ok(x && x.responders >= 25 && typeof x.correct_share === 'number');
  assert.ok(!s.questions.some(r => r.question_id === qy.id)); assert.ok(s.questions.every(r => r.responders >= 20)); assert.ok(s.questions_hidden >= 1);
  const adultMh = s.cells.find(c => c.age_band === 'adult' && c.chapter === 'money_huddle'); assert.ok(adultMh.players >= 25 && adultMh.hidden === false);
  const teenMh = s.cells.find(c => c.age_band === 'teen_13_15' && c.chapter === 'money_huddle'); assert.equal(teenMh.players, null); assert.equal(teenMh.hidden, true);
  assert.ok(s.cells.every(c => (c.players === null) === c.hidden && (c.players === null || c.players >= 10)));
  assert.ok(s.levels.every(l => (l.players === null) === l.hidden && (l.players === null || l.players >= 10)));
  assert.equal(typeof s.opted_in, 'number');
  const text = JSON.stringify(s); for (const k of [...players, ...stats]) assert.ok(!text.includes(P[k]), 'no participant id in admin statistics');
});
await test('erasure covers Life (rounds, exposures, badges, levels) and spends all three weekly opportunities', async () => {
  const l = await lifeStart('erz'); await answer('erz', l.attempt.id); await end('erz', l.attempt.id, 'life');
  const hv = (await snapshot('erz')).history_version;
  const out = await rpc('erz', 'public.quiz_erase_history($1,$2)', [hv, P.erz]); assert.ok(out.removed_attempts >= 1 && out.removed_exposures >= 1);
  for (const t of ['attempts', 'exposures', 'badges', 'levels']) assert.equal((await one(`select count(*)::int n from public.sport_quiz_${t} where profile_id=$1`, [P.erz])).n, 0, t);
  assert.deepEqual((await snapshot('erz')).week_spent_by_kind, { personal: true, group: true, life: true });
  assert.equal((await lifeStart('erz')).outcome, 'week_spent');
  assert.equal((await lifeSnap('erz')).preferences.life_opt_in, true, 'the private opt-in is a setting, kept through erasure');
});
await test('reads do not write; migrations re-apply over live Life data without changing it', async () => {
  const tables = ['public.sport_quiz_settings', 'public.sport_quiz_questions', 'public.sport_quiz_attempts', 'public.sport_quiz_round_items', 'public.sport_quiz_badges',
    'public.sport_quiz_levels', 'public.sport_quiz_life_chapters', 'public.sport_quiz_week_guards', 'public.sport_quiz_preferences'];
  const state = async () => Object.fromEntries(await Promise.all(tables.map(async t => [t, (await db.query(`select to_jsonb(x) r from ${t} x order by to_jsonb(x)::text`)).rows])));
  const before = await state();
  await lifeSnap('a1'); await rpc('a1', 'public.quiz_life_progress()'); await rpc('a1', 'public.quiz_level()'); await rpc('a1', 'public.quiz_life_chapters()'); await admin('public.quiz_admin_life_snapshot()');
  // A lone QUIZ-03 re-run after QUIZ-04 stops before changing anything.
  await assert.rejects(() => db.exec(fs.readFileSync('supabase/migrations/20261014160000_trivia_play_together.sql', 'utf8')), /quiz_rerun_after_quiz04/);
  assert.equal((await one("select count(*)::int n from pg_proc where proname='quiz_end'")).n, 1);
  // The full-schema path (schema.sql sets quiz.full_schema) re-applies the QUIZ blocks together.
  await db.exec("select set_config('quiz.full_schema','on',false)");
  try {
    for (const f of ['20261014150000_timed_sport_trivia.sql', '20261014160000_trivia_play_together.sql', '20261014180000_life_playbook.sql', '20261014190000_life_playbook_bank.sql', '20261015210000_trivia_fresh_questions.sql'])
      await db.exec(fs.readFileSync(`supabase/migrations/${f}`, 'utf8'));
  } finally { await db.exec("select set_config('quiz.full_schema','',false)"); }
  assert.deepEqual(await state(), before);
  assert.equal((await lifeSnap('a1')).availability, 'ready');
});

console.log(JSON.stringify({ passed: tests.filter(t => t.pass).length, total: tests.length }, null, 0));
await db.close();
process.exitCode = tests.some(t => !t.pass) ? 1 : 0;
