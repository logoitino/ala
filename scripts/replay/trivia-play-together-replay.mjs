#!/usr/bin/env node
/** QUIZ-03 real PostgreSQL actors: rounds of five with Next recovery, question types, badges, recap and family groups.
 *
 *   node scripts/replay/trivia-play-together-replay.mjs /tmp/books01-pg/pkg/package/dist
 *
 * Builds the whole canonical schema (including QUIZ-03) on PGlite with the Supabase stubs from supabase-stubs.mjs,
 * then calls every RPC as a real signed-in actor. A few checks swap the internal week-end helper as the database
 * owner to simulate the UTC week boundary, and backdate item deadlines; both are restored before the next check.
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

const adults = ['admin', 'fan', 'ana', 'ben', 'cal', 'dee', 'eve', 'gus', 'fred', 'lim', 'tries', 'joiner', 'erase', 'gone', 'heir', 'solo', 'x1', 'y1', 'z1',
  'trio', 'tf', 'img', 'week', 'void', 'leave', 'season', 'expl', 'size', 'recap',
  ...Array.from({ length: 11 }, (_, i) => `m${i + 1}`),
  // Security-review fixtures (second admin for image rights, drift, erasure limits, totals, opaque refs).
  'rev', 'own2', 'aged', 'kid', 'pal', 'grd', 'p1', 'p2', 'p3', 'p4', 'erz', 'erz2', 'own3', 'clo1', 'clo2'];
const teens = ['tia', 'tara', 'tom', 'tess', 'tn1', 'tn2', 'tn3', 'tn4', 'tn5', 'bday', 'bday2'];
const keys = [...adults, ...teens];
const ids = Object.fromEntries(keys.map((k, i) => [k, `00000000-0000-0000-0000-${String(i + 700).padStart(12, '0')}`]));
const year = Number((await db.query('select extract(year from current_date)::int y')).rows[0].y);
for (const k of keys) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)', [ids[k], JSON.stringify({ birth_year: year - (teens.includes(k) ? 15 : 30), birth_month: 1 })]);
await db.query("update public.profiles set role='admin',is_admin=true where user_id=any($1::uuid[])", [[ids.admin, ids.rev]]);
for (const k of keys) await db.query('update public.profiles set full_name=$2,username=$3 where user_id=$1', [ids[k], `${k[0].toUpperCase()}${k.slice(1)} Family`, `${k}_user`]);
const P = Object.fromEntries((await db.query('select user_id,id from public.profiles')).rows.filter(r => Object.values(ids).includes(r.user_id)).map(r => [keys.find(k => ids[k] === r.user_id), r.id]));
await db.query("update public.profiles set friend_requests_from='nobody' where id=$1", [P.tom]);
await db.query("update public.profiles set friend_requests_from='everyone' where id=$1", [P.tess]);

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
const secret = 'cd'.repeat(32);
const admin = (sql, args = []) => rpc('admin', sql, args);
const testers = keys.filter(k => k !== 'admin').map(k => P[k]);
const reason = 'Reviewed local QUIZ-03 replay fixture only.';
const settings = (enabled = true, list = testers) => admin('public.quiz_admin_settings($1::jsonb,$2,$3)', [JSON.stringify({ enabled, pilot_accounts: list }), reason, P.admin]);
const play = (round_size = 5, groups_enabled = true, images_enabled = false, key = 'admin', expected = P.admin) =>
  rpc(key, 'public.quiz_admin_play_settings($1::jsonb,$2,$3)', [JSON.stringify({ round_size, groups_enabled, images_enabled }), reason, expected]);
const question = (id, action, payload) => admin('public.quiz_admin_question($1,$2,$3::jsonb,$4)', [id, action, JSON.stringify(payload), P.admin]);
let n = 0;
const base = (sport, extra = {}) => ({ family_action: 'new', topic_category: 'sport', sport, prompt: `Which reviewed ${sport} fact is number ${++n}?`,
  options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 1, explanation: `The second choice is the reviewed ${sport} fact.`,
  source_notes: 'Official rules reviewed for this local fixture.', reason, ...extra });
const approved = async (sport, extra = {}) => { const q = await question(null, 'create', base(sport, extra)); await question(q.id, 'approve', { reason }); return q; };
const prefs = key => rpc(key, 'public.quiz_preferences($1::jsonb,$2,$3,$4)', [JSON.stringify({ invitation_mode: 'off', topic_mode: 'sports', notice_version: 'timed-trivia-v1-testing' }), 0, randomUUID(), P[key]]);
const start = (key, { request = randomUUID(), duration = 30, sport = null, topic = 'sport', token = secret } = {}) =>
  rpc(key, 'public.quiz_start($1,$2,$3,$4,$5,$6,$7,$8)', [topic, sport, duration, week, 'timed-trivia-v1-testing', request, token, P[key]]);
const groupStart = (key, group, { request = randomUUID(), duration = 30 } = {}) =>
  rpc(key, 'public.quiz_group_start($1,$2,$3,$4,$5,$6,$7)', [group, duration, week, 'timed-trivia-v1-testing', request, secret, P[key]]);
const answer = (key, attempt, option = 1, { request = randomUUID(), token = secret } = {}) => rpc(key, 'public.quiz_answer($1,$2,$3,$4,$5)', [attempt, option, request, token, P[key]]);
const next = (key, attempt, position, { request = randomUUID(), token = secret } = {}) => rpc(key, 'public.quiz_next($1,$2,$3,$4,$5)', [attempt, position, request, token, P[key]]);
// QUIZ-04: quiz_end takes the round kind; the replay reads it from the attempt it ends.
const end = async (key, attempt, why = 'left_page') => rpc(key, 'public.quiz_end($1,$2,$3,$4,$5,$6,$7)',
  [attempt, null, week, why, randomUUID(), P[key], (await one('select round_kind from public.sport_quiz_attempts where id=$1', [attempt]))?.round_kind ?? 'personal']);
const snapshot = key => rpc(key, 'public.quiz_snapshot()');
const create = (key, name = 'family', theme = null, request = randomUUID()) => rpc(key, 'public.quiz_group_create($1,$2,$3,$4)', [name, theme, request, P[key]]);
const join = (key, code) => rpc(key, 'public.quiz_group_join($1,$2)', [code, P[key]]);
const page = (key, group) => rpc(key, 'public.quiz_group_page($1)', [group]);
const leave = (key, group) => rpc(key, 'public.quiz_group_leave($1,$2)', [group, P[key]]);
const removeMember = (key, group, member) => rpc(key, 'public.quiz_group_remove_member($1,$2,$3)', [group, member, P[key]]);
const block = (a, b) => db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P[a], P[b]]);
const member = (group, key) => one('select status,removed_reason from public.sport_quiz_group_members where group_id=$1 and profile_id=$2', [group, P[key]]);
const backdateItem = attempt => db.query("update public.sport_quiz_round_items set issued_at=statement_timestamp()-interval '100 seconds',expires_at=statement_timestamp()-interval '10 seconds' where attempt_id=$1 and status='issued'", [attempt]);
const backdateNext = attempt => db.query("update public.sport_quiz_attempts set next_by=statement_timestamp()-interval '1 second' where id=$1 and round_state='between'", [attempt]);
const weekEndDef = (await one("select pg_get_functiondef('public.quiz_week_end(date)'::regprocedure) d")).d;
const withWeekEnd = async (expr, work) => {
  await db.exec(`create or replace function public.quiz_week_end(p_week date) returns timestamptz language sql volatile set search_path='' as $$ select ${expr} $$`);
  try { await work(); } finally { await db.exec(weekEndDef); }
};

// Bank: Basketball 8, Football 6, Rugby 4 (group theme), Cricket 1, one true/false, science 2.
await settings(true); await play(5, true, false);
for (let i = 0; i < 8; i++) await approved('Basketball');
for (let i = 0; i < 6; i++) await approved('Football');
for (let i = 0; i < 4; i++) await approved('Rugby');
for (const k of keys) if (k !== 'admin') await prefs(k);

await test('new tables are RLS-only: guest, fan and service role are denied direct reads and writes', async () => {
  for (const t of ['round_items', 'groups', 'group_members', 'group_codes', 'group_join_attempts', 'group_sets', 'group_cases']) {
    const rls = await one('select relrowsecurity r from pg_class where oid=$1::regclass', [`public.sport_quiz_${t}`]); assert.equal(rls.r, true);
    const pol = await one('select count(*)::int n from pg_policies where tablename=$1 and policyname=$2 and permissive=$3', [`sport_quiz_${t}`, 'Closed accounts', 'RESTRICTIVE']); assert.equal(pol.n, 1);
    for (const k of ['anon', 'fan', 'service']) {
      await assert.rejects(() => actor(k, `select * from public.sport_quiz_${t}`), /permission denied/);
      await assert.rejects(() => actor(k, `delete from public.sport_quiz_${t}`), /permission denied/);
    }
  }
});
await test('internal helpers and supervision summary are not client callable; every quiz function pins search_path', async () => {
  for (const sql of ['public.quiz_round_pick($1,$1,1)', 'public.quiz_sync_badges($1,now())', 'public.quiz_group_refusal($1,$1)', 'public.quiz_group_issue_code($1,$1,now())',
    'public.quiz_round_settle($1,now())', 'public.quiz_group_ensure_set($1,current_date,5,now())', 'public.supervision_json($1,null)', 'public.quiz_teen_accepts($1,$1)'])
    await denied('fan', sql, [P.fan]);
  for (const k of ['anon', 'service']) await denied(k, 'public.quiz_groups_mine()');
  const loose = await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz\\_%' and not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%')");
  assert.deepEqual(loose.rows, []);
  const anonExec = await db.query("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'quiz\\_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute'))");
  assert.deepEqual(anonExec.rows, []);
});
await test('admin-only views and switches refuse a fan and an identity mismatch', async () => {
  await denied('fan', 'public.quiz_admin_snapshot()');
  await denied('fan', 'public.quiz_admin_group_case($1,$2,$3)', [randomUUID(), reason, P.fan]);
  await denied('fan', 'public.quiz_admin_group_remove($1,null,$2,$3)', [randomUUID(), reason, P.fan]);
  await assert.rejects(() => play(5, true, false, 'fan', P.fan), /quiz_/);
  await assert.rejects(() => play(5, true, false, 'admin', P.fan), /quiz_identity_changed/);
});
await test('round-size setting is 1 to 5, default 5, and shows in both snapshots', async () => {
  assert.equal((await snapshot('fan')).round_size, 5);
  await assert.rejects(() => play(6), /quiz_settings_invalid/); await assert.rejects(() => play(0), /quiz_settings_invalid/);
  const s = await admin('public.quiz_admin_snapshot()'); assert.equal(s.settings.round_size, 5); assert.equal(s.settings.groups_enabled, true); assert.equal(s.settings.images_enabled, false);
});

let fanRound, fanItem2Request;
await test('Start issues question 1 of 5 with its own deadline and no answer key', async () => {
  fanRound = await start('fan', { sport: 'Basketball' });
  assert.equal(fanRound.outcome, 'started'); assert.equal(fanRound.attempt.mode, 'round'); assert.equal(fanRound.attempt.planned_items, 5);
  assert.equal(fanRound.active_item.position, 1); assert.equal(fanRound.active_item.planned_items, 5);
  assert.equal(Date.parse(fanRound.active_item.expires_at) - Date.parse(fanRound.attempt.started_at), 30000);
  assert.equal('correct_option' in fanRound.active_question, false); assert.equal(fanRound.result, null);
  const s = await snapshot('fan'); assert.equal(s.attempt.round_state, 'item'); assert.equal('question' in s.attempt, false);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_exposures where profile_id=$1', [P.fan])).n, 1);
});
await test('answer reveals only that item, then the round waits for Next with next_by about 2 minutes later', async () => {
  // QUIZ-05: options are shown in a per-item order and stored shuffled at approval, so the replay answers by text: the
  // shown position of the wrong 'First choice'; the result's stored correct index names 'Second choice'.
  const shown = fanRound.active_question.options;
  const r = await answer('fan', fanRound.attempt.id, shown.indexOf('First choice'));
  assert.equal(r.outcome, 'answered'); assert.equal(r.attempt.status, 'issued'); assert.equal(r.attempt.round_state, 'between');
  assert.equal(r.result.position, 1); assert.equal(r.result.was_correct, false);
  const stored = (await one('select options from public.sport_quiz_questions where id=$1', [fanRound.active_question.id])).options;
  assert.equal(stored[r.result.correct_option], 'Second choice'); assert.equal(shown[r.result.correct_position], 'Second choice');
  const gap = Date.parse(r.attempt.next_by) - Date.parse(r.result.completed_at); assert.ok(gap >= 119000 && gap <= 121000, String(gap));
  assert.equal((await one("select count(*)::int n from public.sport_quiz_badges where profile_id=$1 and label='Trivia Explorer' and voided_at is null", [P.fan])).n, 1);
});
await test('Next refuses a wrong position, a wrong secret and another account; no item is issued before Next', async () => {
  await assert.rejects(() => next('fan', fanRound.attempt.id, 2), /quiz_next_not_ready/);
  await assert.rejects(() => next('fan', fanRound.attempt.id, 1, { token: 'ef'.repeat(32) }), /quiz_capability_invalid/);
  await assert.rejects(() => next('ben', fanRound.attempt.id, 1), /quiz_/);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_round_items where attempt_id=$1', [fanRound.attempt.id])).n, 1);
});
await test('Next exact recovery: same request returns the same item before its deadline; a fresh request cannot fetch it', async () => {
  fanItem2Request = randomUUID();
  const a = await next('fan', fanRound.attempt.id, 1, { request: fanItem2Request });
  assert.equal(a.outcome, 'issued'); assert.equal(a.active_item.position, 2); assert.ok(a.active_question.id);
  const b = await next('fan', fanRound.attempt.id, 1, { request: fanItem2Request });
  assert.deepEqual(b.active_question, a.active_question); assert.equal(b.active_item.expires_at, a.active_item.expires_at);
  await assert.rejects(() => next('fan', fanRound.attempt.id, 2, { request: fanItem2Request }), /quiz_request_conflict/);
  await assert.rejects(() => next('fan', fanRound.attempt.id, 1), /quiz_next_not_ready/);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_round_items where attempt_id=$1', [fanRound.attempt.id])).n, 2);
});
await test('item deadline: snapshot is read-only, late answer is expired, Next replay after the deadline returns no question', async () => {
  await backdateItem(fanRound.attempt.id);
  const s = await snapshot('fan'); assert.equal(s.attempt.status, 'issued'); assert.equal(s.attempt.round_state, 'between'); assert.equal(s.attempt.effective_expired, true);
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1 and position=2', [fanRound.attempt.id])).status, 'issued');
  assert.equal((await next('fan', fanRound.attempt.id, 1, { request: fanItem2Request })).active_question, null);
  assert.equal((await answer('fan', fanRound.attempt.id, 1)).outcome, 'expired');
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1 and position=2', [fanRound.attempt.id])).status, 'expired');
});
await test('missed Next window closes the round as completed (one committed answer) and keeps the badge', async () => {
  await backdateNext(fanRound.attempt.id);
  assert.equal((await snapshot('fan')).attempt.status, 'completed');
  const r = await next('fan', fanRound.attempt.id, 2); assert.equal(r.outcome, 'completed'); assert.equal(r.active_question, null);
  const h = await rpc('fan', 'public.quiz_history()');
  assert.equal(h.items[0].attempt.close_reason, 'next_timeout'); assert.equal(h.items[0].items.length, 2); assert.equal(h.items[0].badge.label, 'Trivia Explorer');
  assert.equal((await one('select count(*)::int n from public.sport_quiz_exposures where profile_id=$1', [P.fan])).n, 2);
});
await test('a full round of five: answers, Next and completion; 5 Basketball facts earn Basketball Explorer once', async () => {
  const r = await start('expl', { sport: 'Basketball' }); let at = r;
  for (let pos = 1; pos <= 5; pos++) {
    const a = await answer('expl', r.attempt.id, 1); assert.equal(a.outcome, pos === 5 ? 'completed' : 'answered');
    if (pos < 5) { at = await next('expl', r.attempt.id, pos); assert.equal(at.active_item.position, pos + 1); }
  }
  const shelf = await rpc('expl', 'public.quiz_badge_shelf()');
  assert.deepEqual(shelf.badges.map(b => b.label).sort(), ['Basketball Explorer', 'Trivia Explorer']);
  assert.ok(shelf.badges.every(b => b.visibility === 'private'));
  assert.equal((await one("select count(*)::int n from public.sport_quiz_badges where profile_id=$1 and label='Basketball Explorer'", [P.expl])).n, 1);
});
await test('leaving mid-round ends the whole round; unissued questions stay unseen; no answers means no badge', async () => {
  const r = await start('leave', { sport: 'Football' });
  const e = await end('leave', r.attempt.id, 'background'); assert.equal(e.outcome, 'ended');
  assert.equal((await one('select count(*)::int n from public.sport_quiz_exposures where profile_id=$1', [P.leave])).n, 1);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_badges where profile_id=$1', [P.leave])).n, 0);
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1', [r.attempt.id])).status, 'ended');
  assert.equal((await answer('leave', r.attempt.id, 1)).outcome, 'ended');
});
await test('round size setting: a new round uses the size; a small pool gives a short round that says so', async () => {
  await play(3, true, false);
  const r = await start('size', { sport: 'Football' }); assert.equal(r.attempt.planned_items, 3); assert.equal(r.attempt.short_round, false);
  await end('size', r.attempt.id, 'user_end');
  await play(5, true, false);
  await approved('Cricket');
  const c = await start('solo', { sport: 'Cricket' }); assert.equal(c.attempt.planned_items, 1); assert.equal(c.attempt.short_round, true); assert.equal(c.attempt.round_size, 5);
  assert.equal((await answer('solo', c.attempt.id, 1)).outcome, 'completed');
});
await test('week boundary: Start refuses a round that cannot finish before the UTC week ends; Next re-checks and closes', async () => {
  await withWeekEnd("clock_timestamp() + interval '11 minutes'", async () => {
    await assert.rejects(() => start('week', { duration: 90, sport: 'Football' }), /quiz_week_closing/);
    const r = await start('week', { duration: 30, sport: 'Football' }); assert.equal(r.attempt.planned_items, 5);
    await answer('week', r.attempt.id, 1);
    await db.exec("create or replace function public.quiz_week_end(p_week date) returns timestamptz language sql volatile set search_path='' as $$ select clock_timestamp() + interval '5 seconds' $$");
    const nx = await next('week', r.attempt.id, 1); assert.equal(nx.outcome, 'week_closed'); assert.equal(nx.active_question, null); assert.equal(nx.attempt.status, 'completed');
  });
});
await test('true/false: exactly True/False, answer bounded by two options; choice4 needs four', async () => {
  await assert.rejects(() => question(null, 'create', base('Football', { question_type: 'true_false' })), /quiz_question_content_invalid/);
  await assert.rejects(() => question(null, 'create', base('Football', { question_type: 'true_false', options: ['True', 'False'], correct_option: 2 })), /quiz_question_content_invalid/);
  await assert.rejects(() => question(null, 'create', base('Football', { options: ['a', 'b', 'c'] })), /quiz_question_content_invalid/);
  await assert.rejects(() => db.query("update public.sport_quiz_questions set question_type='true_false' where status='approved' and sport='Rugby'"), /quiz_immutable/);
  const tf = await approved('Volleyball', { question_type: 'true_false', options: ['True', 'False'], correct_option: 0 });
  const r = await start('tf', { sport: 'Volleyball' }); assert.equal(r.active_question.question_type, 'true_false'); assert.deepEqual(r.active_question.options, ['True', 'False']);
  await assert.rejects(() => answer('tf', r.attempt.id, 2), /quiz_answer_invalid/);
  const a = await answer('tf', r.attempt.id, 0); assert.equal(a.result.was_correct, true); assert.ok(tf.id);
});
await test('image_choice: rights fields validated, approval refused while trivia.images is off, never drawn in this build', async () => {
  const media = { question_type: 'image_choice', media_path: 'equipment/ball-01.webp', media_licence: 'owned', media_source: 'Staff photo, local fixture',
    media_attribution: 'Tapuai staff', media_alt_text: 'A ball resting on a wooden court floor', media_size_bytes: 120000, media_has_person: false,
    media_no_marks: true, media_exif_stripped: true };
  await assert.rejects(() => question(null, 'create', base('Basketball', { ...media, media_no_marks: false })), /quiz_media_invalid/);
  await assert.rejects(() => question(null, 'create', base('Basketball', { ...media, media_exif_stripped: undefined })), /quiz_media_invalid/);
  await assert.rejects(() => question(null, 'create', base('Basketball', { ...media, media_has_person: true })), /quiz_media_invalid/);
  await assert.rejects(() => question(null, 'create', base('Basketball', { ...media, media_size_bytes: 400000 })), /quiz_media_invalid/);
  await assert.rejects(() => question(null, 'create', base('Basketball', { ...media, media_alt_text: 'This shows the Second choice clearly here' })), /quiz_media_alt_reveals_answer/);
  await assert.rejects(() => question(null, 'create', base('Basketball', { media_path: 'x.webp' })), /quiz_media_invalid/);
  const img = await question(null, 'create', base('Handball', media)); assert.equal(img.status, 'draft');
  await assert.rejects(() => question(img.id, 'approve', { reason }), /quiz_images_off/);
  await play(5, true, true);
  // Rights review is a separate step by a second admin; the creator cannot review, and approval waits for it.
  await assert.rejects(() => question(img.id, 'approve', { reason }), /quiz_media_review_required/);
  await assert.rejects(() => question(img.id, 'review_media', { reason }), /quiz_media_reviewer_is_creator/);
  await rpc('rev', 'public.quiz_admin_question($1,$2,$3::jsonb,$4)', [img.id, 'review_media', JSON.stringify({ reason: 'Second admin checked licence, marks and EXIF.' }), P.rev]);
  assert.equal((await one('select media_reviewed_by r,media_no_marks m,media_exif_stripped e from public.sport_quiz_questions where id=$1', [img.id])).r, P.rev);
  const ok = await question(img.id, 'approve', { reason }); assert.equal(ok.status, 'approved'); await play(5, true, false);
  await assert.rejects(() => start('img', { sport: 'Handball' }), /quiz_no_question/);
  assert.ok((await snapshot('img')).pools.every(p => p.sport !== 'Handball'));
});
await test('bank cap counts draft and approved only, and the admin desk forecasts weeks per sport', async () => {
  const s = await admin('public.quiz_admin_snapshot()');
  assert.equal(s.question_cap, 300);
  // QUIZ-04: Life questions have their own 200 cap, so the trivia total excludes them.
  assert.equal(s.active_total, (await one("select count(*)::int n from public.sport_quiz_questions where status in ('draft','approved') and topic_category <> 'life'")).n);
  const bb = s.forecast.find(f => f.sport === 'Basketball'); assert.ok(bb.approved_families >= 8); assert.ok(bb.issued_28d >= 7); assert.equal(typeof bb.weeks_left, 'number');
  assert.equal(s.forecast.find(f => f.sport === 'Rugby').weeks_left, null);
});
await test('per-item void: one item voided keeps the round completed; voiding the last answered item voids round and badge', async () => {
  const r = await start('void', { sport: 'Football' });
  await answer('void', r.attempt.id, 1); const n2 = await next('void', r.attempt.id, 1); await answer('void', r.attempt.id, 1); await end('void', r.attempt.id, 'user_end');
  const items = (await db.query('select position,question_id from public.sport_quiz_round_items where attempt_id=$1 order by position', [r.attempt.id])).rows;
  await question(items[0].question_id, 'void', { reason: 'Fact correction voids this one item only.' });
  let h = await rpc('void', 'public.quiz_history()'); assert.equal(h.items[0].attempt.status, 'completed'); assert.equal(h.items[0].items[0].status, 'void');
  assert.equal(h.items[0].badge.voided_at, null);
  await question(items[1].question_id, 'void', { reason: 'Second correction leaves no committed answer.' });
  h = await rpc('void', 'public.quiz_history()'); assert.equal(h.items[0].attempt.status, 'void'); assert.ok(h.items[0].badge.voided_at);
  assert.ok(n2.active_question);
});
await test('void of an open item closes it and the round waits for Next instead of ending', async () => {
  const r = await start('trio', { sport: 'Basketball' });
  await question(r.active_question.id, 'void', { reason: 'Open item corrected during the round.' });
  const s = await snapshot('trio'); assert.equal(s.attempt.status, 'issued'); assert.equal(s.attempt.round_state, 'between');
  const nx = await next('trio', r.attempt.id, 1); assert.equal(nx.active_item.position, 2);
});

// Groups ---------------------------------------------------------------------------------------------------------------
let fam, famCode;
await test('create: preset names only, code is 8 characters valid 7 days, stored only as a hash', async () => {
  await assert.rejects(() => create('ana', 'The Best Family Ever'), /quiz_group_invalid/);
  await assert.rejects(() => create('ana', 'family', 'Underwater Chess'), /quiz_group_theme_invalid/);
  const req = randomUUID(); const g = await create('ana', 'family', null, req); fam = g.group_id; famCode = g.code;
  assert.match(famCode, /^[A-HJ-NP-Z2-9]{8}$/); assert.equal(g.is_owner, true); assert.equal(g.code_shown, true);
  const row = await one('select code_hash,expires_at-created_at d from public.sport_quiz_group_codes where group_id=$1', [fam]);
  assert.notEqual(row.code_hash, famCode); assert.equal(row.d.days ?? 7, 7);
  const retry = await create('ana', 'family', null, req); assert.equal(retry.group_id, fam); assert.equal(retry.code, null);
});
await test('an adult stranger joins an all-adult group by code; codes are case and dash tolerant', async () => {
  const j = await join('ben', `${famCode.slice(0, 4).toLowerCase()}-${famCode.slice(4)}`); assert.equal(j.outcome, 'joined'); assert.equal(j.group.totals.members, 2);
});
await test('teen rules both ways: a teen cannot join adults; adults cannot join a teen; refusal reasons recorded privately', async () => {
  const t = await join('tia', famCode); assert.equal(t.outcome, 'refused'); assert.equal(t.group, null);
  assert.equal((await one("select refusal_reason r from public.sport_quiz_group_join_attempts where profile_id=$1 order by id desc limit 1", [P.tia])).r, 'teen_rule');
  const tg = await create('tia', 'cousins'); const c = await join('cal', tg.code); assert.equal(c.outcome, 'refused');
  const teen2 = await join('tara', tg.code); assert.equal(teen2.outcome, 'joined');
  await db.query("insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values($1,$2,'invite',now())", [P.tia, P.gus]);
  assert.equal((await join('gus', tg.code)).outcome, 'refused', 'tara (teens only) does not accept her friend Tia\'s guardian');
  await db.query("update public.profiles set friend_requests_from='everyone' where id=$1", [P.tara]);
  assert.equal((await join('gus', tg.code)).outcome, 'joined');
});
await test('teen "nobody": only an accepted friend or linked guardian may share the group; "everyone" accepts any eligible adult', async () => {
  const g = await create('tom', 'friends');
  await db.query("insert into public.friendships(requester_id,addressee_id,status,responded_at) values($1,$2,'accepted',now())", [P.fred, P.tom]);
  assert.equal((await join('eve', g.code)).outcome, 'refused');
  assert.equal((await join('fred', g.code)).outcome, 'joined');
  const open = await create('tess', 'home_team'); assert.equal((await join('eve', open.code)).outcome, 'joined');
});
await test('blocks are part of every join: a joiner blocked with any member gets the ordinary refusal', async () => {
  await block('dee', 'ben');
  const j = await join('dee', famCode); assert.equal(j.outcome, 'refused');
  assert.equal((await one("select refusal_reason r from public.sport_quiz_group_join_attempts where profile_id=$1 order by id desc limit 1", [P.dee])).r, 'blocked');
});
await test('limits: 10 wrong tries a day, then refused before counting', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await join('tries', 'ZZZZZZZZ')).outcome, 'refused');
  await assert.rejects(() => join('tries', famCode), /quiz_group_try_limit/);
});
await test('limits: an account creates at most 3 groups and belongs to at most 5', async () => {
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await create('lim', 'friends')).code);
  await assert.rejects(() => create('lim', 'friends'), /quiz_group_create_limit/);
  const extra = [await create('x1', 'family'), await create('y1', 'family'), await create('z1', 'family')];
  assert.equal((await join('lim', extra[0].code)).outcome, 'joined'); assert.equal((await join('lim', extra[1].code)).outcome, 'joined');
  await assert.rejects(() => join('lim', extra[2].code), /quiz_group_member_limit/);
  assert.ok(codes.length === 3);
});
await test('limits: 5 joins a day', async () => {
  const groups = []; for (const k of ['m1', 'm2', 'm3']) groups.push(await create(k, 'team_fans'));
  for (const k of ['m4', 'm5', 'm6']) groups.push(await create(k, 'team_fans'));
  for (let i = 0; i < 5; i++) { if (i === 4) await leave('joiner', groups[0].group_id); assert.equal((await join('joiner', groups[i].code)).outcome, 'joined'); }
  await assert.rejects(() => join('joiner', groups[5].code), /quiz_group_join_limit/);
});
let full, fullCode;
await test('max 12 members: the code dies when the group is full and cannot be renewed', async () => {
  const g = await create('heir', 'game_day_crew'); full = g.group_id; fullCode = g.code;
  for (const k of ['m7', 'm8', 'm9', 'm10', 'm11', 'eve', 'fred', 'cal', 'x1', 'y1', 'z1']) {
    const j = await join(k, fullCode); assert.equal(j.outcome, 'joined', k);
  }
  assert.equal((await page('heir', full)).totals.members, 12); assert.equal((await page('heir', full)).code_active, false);
  assert.equal((await join('ana', fullCode)).outcome, 'refused');
  await assert.rejects(() => rpc('heir', 'public.quiz_group_renew_code($1,$2)', [full, P.heir]), /quiz_group_full/);
});
await test('creator removal rotates the code; the old code stops working and a removed member cannot rejoin', async () => {
  await assert.rejects(() => removeMember('heir', full, P.m11), /quiz_group_invalid/);
  const ref = (await page('heir', full)).members.find(m => m.display_name === 'M11').member_ref;
  const r = await removeMember('heir', full, ref); assert.match(r.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.deepEqual(await member(full, 'm11'), { status: 'removed', removed_reason: 'creator' });
  assert.equal((await join('ana', fullCode)).outcome, 'refused');
  assert.equal((await join('m11', r.code)).outcome, 'refused');
  assert.equal((await one("select refusal_reason r from public.sport_quiz_group_join_attempts where profile_id=$1 order by id desc limit 1", [P.m11])).r, 'removed');
  assert.equal((await page('m11', full)).outcome, 'removed');
  await assert.rejects(() => removeMember('m7', full, P.m8), /quiz_group_not_owner/);
});
await test('a block removes the blocked party with the creator-removal message; blocking the creator hands the group over', async () => {
  await block('heir', 'm10');
  assert.deepEqual(await member(full, 'm10'), { status: 'removed', removed_reason: 'blocked' });
  assert.equal((await page('m10', full)).outcome, 'removed');
  await block('m7', 'heir');
  assert.equal((await member(full, 'heir')).status, 'removed');
  const g = await one('select owner_id from public.sport_quiz_groups where id=$1', [full]); assert.equal(g.owner_id, P.m7);
  assert.equal((await page('m7', full)).is_owner, true);
});
await test('group page shows played marks and totals only: no per-member counts, answers, times or ranks; member ids only to the owner', async () => {
  const p = await page('ben', fam);
  assert.deepEqual(Object.keys(p.members[0]).sort(), ['badges', 'display_name', 'is_me', 'is_owner', 'member_ref', 'played_this_week']);
  assert.ok(p.members.every(m => m.member_ref === null));
  assert.deepEqual(Object.keys(p.totals).sort(), ['facts_this_season', 'facts_this_week', 'members', 'played_this_week']);
  assert.equal(p.code_expires_at, null);
  const text = JSON.stringify([p.members, p.totals]); for (const banned of ['correct', 'answered_option', 'expires_at', 'duration', 'joined_at', 'rank', 'score', 'speed', 'question']) assert.ok(!text.includes(banned), banned);
  assert.ok((await page('ana', fam)).members.every(m => /^[0-9a-f]{32}$/.test(m.member_ref)));
  const teen = await page('tara', (await one("select group_id from public.sport_quiz_group_members where profile_id=$1 and status='active' limit 1", [P.tara])).group_id);
  assert.ok(teen.members.some(m => m.display_name === 'Tia')); assert.ok(teen.members.every(m => !m.display_name.includes('Family')));
  await assert.rejects(() => page('cal', fam), /quiz_group_not_member/);
});
let rugby, setRows;
await test('shared group-week set is drawn without reading exposures; a member who saw one gets a private replacement', async () => {
  const def = (await one("select pg_get_functiondef('public.quiz_group_ensure_set(uuid,date,integer,timestamptz)'::regprocedure) d")).d; assert.ok(!def.includes('exposures'));
  await play(3, true, false);
  const g = await create('x1', 'cousins', 'Rugby'); rugby = g.group_id;
  assert.equal((await join('y1', g.code)).outcome, 'joined');
  const r1 = await groupStart('x1', rugby); assert.equal(r1.attempt.group_id, rugby); assert.equal(r1.attempt.planned_items, 3);
  setRows = (await db.query('select position,question_key,question_id from public.sport_quiz_group_sets where group_id=$1 order by position', [rugby])).rows;
  assert.equal(setRows.length, 3); assert.equal(r1.active_question.id, setRows[0].question_id);
  await db.query('insert into public.sport_quiz_exposures(profile_id,question_key,question_id,first_issued_at) values($1,$2,$3,now()-interval \'30 days\')', [P.y1, setRows[0].question_key, setRows[0].question_id]);
  const r2 = await groupStart('y1', rugby);
  assert.notEqual(r2.active_question.id, setRows[0].question_id); assert.ok(!setRows.some(s => s.question_id === r2.active_question.id));
  assert.deepEqual(Object.keys(r2).sort(), Object.keys(r1).sort());
  assert.ok(!JSON.stringify(r2).match(/replacement|shared|overlap/));
  await answer('y1', r2.attempt.id, 1); const n2 = await next('y1', r2.attempt.id, 1); assert.equal(n2.active_question.id, setRows[1].question_id);
  assert.equal((await db.query('select count(*)::int n from public.sport_quiz_group_sets where group_id=$1', [rugby])).rows[0].n, 3);
  await play(5, true, false);
});
// QUIZ-04 §7.3: "played" and Family Challenger count group rounds only, so this member plays a group round.
await test('one completed group round marks the member played in every group, and earns Family Challenger', async () => {
  const before = await page('ana', fam); assert.equal(before.members.find(m => m.is_me).played_this_week, false);
  const g2 = await create('eve', 'friends'); assert.equal((await join('ana', g2.code)).outcome, 'joined');
  const r = await groupStart('ana', fam); await answer('ana', r.attempt.id, 1); await end('ana', r.attempt.id, 'user_end');
  assert.equal((await page('ana', fam)).members.find(m => m.is_me).played_this_week, true);
  assert.equal((await page('eve', g2.group_id)).members.find(m => !m.is_me && m.display_name === 'Ana').played_this_week, true);
  assert.ok((await rpc('ana', 'public.quiz_badge_shelf()')).badges.some(b => b.label === 'Family Challenger' && b.period === week));
  assert.equal((await page('ben', fam)).totals.facts_this_week, null, 'hidden until 3 members played');
});
await test('badges: unique per (profile, label, period); visible to groups only when the member opts in', async () => {
  const shelf = await rpc('ana', 'public.quiz_badge_shelf()'); const fc = shelf.badges.find(b => b.label === 'Family Challenger');
  assert.deepEqual((await page('ben', fam)).members.find(m => m.display_name === 'Ana').badges, []);
  await assert.rejects(() => rpc('ben', 'public.quiz_badge_visibility($1,$2,$3)', [fc.id, 'groups', P.ben]), /quiz_badge_missing/);
  await rpc('ana', 'public.quiz_badge_visibility($1,$2,$3)', [fc.id, 'groups', P.ana]);
  assert.deepEqual((await page('ben', fam)).members.find(m => m.display_name === 'Ana').badges, ['Family Challenger']);
  await db.query("select public.quiz_sync_badges($1,now())", [P.ana]);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_badges where profile_id=$1 and label='Family Challenger'", [P.ana])).n, 1);
});
await test('Season Learner after 10 rounds in one calendar quarter', async () => {
  const qid = (await one("select id from public.sport_quiz_questions where status='approved' and sport='Basketball' limit 1")).id;
  for (let i = 0; i < 9; i++) await db.query("insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,answered_option,request_id,completed_at,mode) values($1,date '2026-07-06'+$2*7,$3,'completed',1,gen_random_uuid(),now(),'legacy')", [P.season, i, qid]);
  await db.query("select public.quiz_sync_badges($1,now())", [P.season]);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_badges where profile_id=$1 and kind='season'", [P.season])).n, 0);
  await db.query("insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,answered_option,request_id,completed_at,mode) values($1,date '2026-09-21',$2,'completed',1,gen_random_uuid(),now(),'legacy')", [P.season, qid]);
  await db.query("select public.quiz_sync_badges($1,now())", [P.season]);
  assert.equal((await one("select period from public.sport_quiz_badges where profile_id=$1 and kind='season'", [P.season])).period, '2026-Q3');
});
await test('season recap is own data only: facts, sports and per-sport counts for the caller', async () => {
  const mine = await rpc('expl', 'public.quiz_season_recap()');
  // The open-item correction above may have voided one of these five Basketball items; recap counts committed, non-void facts.
  const facts = (await one("select count(*)::int n from public.sport_quiz_round_items i join public.sport_quiz_attempts a on a.id=i.attempt_id where a.profile_id=$1 and i.status='answered'", [P.expl])).n;
  assert.ok(facts >= 4); assert.equal(mine.profile_id, P.expl); assert.equal(mine.facts, facts); assert.deepEqual(mine.per_sport, [{ sport: 'Basketball', facts }]); assert.equal(mine.rounds, 1);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_badges where profile_id=$1 and label='Basketball Explorer' and voided_at is null", [P.expl])).n, facts >= 5 ? 1 : 0);
  const other = await rpc('recap', 'public.quiz_season_recap()'); assert.equal(other.facts, 0); assert.deepEqual(other.per_sport, []);
  assert.equal((await rpc('season', 'public.quiz_season_recap($1)', ['2026-Q3'])).rounds, 10);
  await assert.rejects(() => rpc('expl', 'public.quiz_season_recap($1)', ['2026-13']), /quiz_recap_invalid/);
});
await test('report group: members (and removed members) can report with a fixed reason; strangers cannot', async () => {
  const r = await rpc('ben', 'public.quiz_group_report($1,$2,$3)', [fam, 'unwanted_contact', P.ben]); assert.equal(r.outcome, 'reported');
  await rpc('m11', 'public.quiz_group_report($1,$2,$3)', [full, 'safety', P.m11]);
  await assert.rejects(() => rpc('cal', 'public.quiz_group_report($1,$2,$3)', [fam, 'other', P.cal]), /quiz_group_not_member/);
  await assert.rejects(() => rpc('ben', 'public.quiz_group_report($1,$2,$3)', [fam, 'free text here', P.ben]), /quiz_group_invalid/);
  const s = await admin('public.quiz_admin_snapshot()'); assert.ok(s.reports.some(x => x.group_id === fam && x.reason_code === 'unwanted_contact'));
  assert.ok(!JSON.stringify(s.reports).includes(P.ben));
});
await test('admin case view: member ids, age bands and refusal reasons, each read audited', async () => {
  const before = (await one("select count(*)::int n from public.sport_quiz_group_cases where kind='admin_view'")).n;
  const c = await admin('public.quiz_admin_group_case($1,$2,$3)', [fam, 'Reviewing the unwanted contact report.', P.admin]);
  assert.ok(c.members.some(m => m.profile_id === P.ben && m.age_band === 'adult'));
  assert.ok(c.refusals.some(x => x.profile_id === P.tia && x.refusal_reason === 'teen_rule' && x.age_band === 'teen_13_15'));
  assert.ok(c.refusals.some(x => x.refusal_reason === 'blocked'));
  assert.ok(!JSON.stringify(c).match(/full_name|username|display_name/));
  assert.equal((await one("select count(*)::int n from public.sport_quiz_group_cases where kind='admin_view'")).n, before + 1);
  await assert.rejects(() => admin('public.quiz_admin_group_case($1,$2,$3)', [fam, 'short', P.admin]), /quiz_group_case_invalid/);
  await assert.rejects(() => db.query('delete from public.sport_quiz_group_cases'), /quiz_group_case_immutable/);
});
await test('admin removal with a reason bars rejoining; admin close ends the group and its code', async () => {
  const r = await admin('public.quiz_admin_group_remove($1,$2,$3,$4)', [fam, P.ben, 'Safety case: removed after review.', P.admin]); assert.equal(r.outcome, 'removed');
  assert.deepEqual(await member(fam, 'ben'), { status: 'removed', removed_reason: 'admin' });
  const g = await create('cal', 'friends');
  const c = await admin('public.quiz_admin_group_remove($1,null,$2,$3)', [g.group_id, 'Safety case: whole group closed.', P.admin]); assert.equal(c.outcome, 'closed');
  assert.equal((await join('eve', g.code)).outcome, 'refused');
  assert.equal((await page('cal', g.group_id)).outcome, 'closed');
});
await test('guardian supervision counts trivia groups and joined/left events, the same for teen and guardian, with no group details', async () => {
  const teenView = await rpc('tia', 'public.get_my_supervision()');
  assert.equal(teenView.summary.trivia_groups, 1);
  assert.ok(teenView.events.some(e => e.kind === 'trivia_group_joined')); assert.ok(teenView.events.filter(e => e.kind.startsWith('trivia')).every(e => JSON.stringify(e.detail) === '{}'));
  const guardianView = await rpc('gus', 'public.guardian_get_supervision($1)', [P.tia]); assert.equal(guardianView.summary.trivia_groups, 1);
  const tg = (await one("select group_id from public.sport_quiz_group_members where profile_id=$1 and status='active'", [P.tia])).group_id;
  await leave('tia', tg);
  const after = await rpc('gus', 'public.guardian_get_supervision($1)', [P.tia]);
  assert.equal(after.summary.trivia_groups, 0); assert.ok(after.events.some(e => e.kind === 'trivia_group_left'));
  assert.equal((await one('select owner_id from public.sport_quiz_groups where id=$1', [tg])).owner_id, P.tara);
});
await test('trivia.groups switch pauses new groups, joins and group rounds without touching existing data', async () => {
  await play(5, false, false);
  await assert.rejects(() => create('erase', 'family'), /quiz_groups_paused/);
  await assert.rejects(() => join('erase', 'AAAAAAAA'), /quiz_groups_paused/);
  await assert.rejects(() => groupStart('m7', full), /quiz_groups_paused|quiz_week|quiz_round/);
  assert.equal((await page('m7', full)).outcome, 'member');
  assert.equal((await snapshot('m7')).groups_available, false);
  await play(5, true, false);
});
await test('erasure leaves every group (handing over ownership), removes join attempts, dissolved sets and every badge', async () => {
  const g = await create('erase', 'family'); await join('m1', g.code);
  const solo = await create('erase', 'friends', 'Rugby');
  // QUIZ-04: a group round needs two members; m2 joins for the round and leaves, so the group still dissolves on erasure.
  await join('m2', solo.code);
  await play(3, true, false); const r = await groupStart('erase', solo.group_id); await answer('erase', r.attempt.id, 1); await end('erase', r.attempt.id, 'user_end'); await play(5, true, false);
  await leave('m2', solo.group_id);
  const fc = (await rpc('erase', 'public.quiz_badge_shelf()')).badges.find(b => b.label === 'Family Challenger');
  await rpc('erase', 'public.quiz_badge_visibility($1,$2,$3)', [fc.id, 'groups', P.erase]);
  await join('erase', 'WRONGCOD');
  const s = await snapshot('erase');
  const out = await rpc('erase', 'public.quiz_erase_history($1,$2)', [s.history_version, P.erase]);
  assert.equal(out.removed_group_memberships, 2); assert.ok(out.retained_join_attempts >= 1); assert.equal(out.removed_group_sets, 3); assert.ok(out.removed_badges >= 2);
  assert.ok((await one('select count(*)::int n from public.sport_quiz_group_join_attempts where profile_id=$1', [P.erase])).n >= 1);
  for (const t of ['group_members', 'badges', 'attempts', 'exposures']) assert.equal((await one(`select count(*)::int n from public.sport_quiz_${t} where profile_id=$1`, [P.erase])).n, 0, t);
  assert.equal((await one('select owner_id from public.sport_quiz_groups where id=$1', [g.group_id])).owner_id, P.m1);
  assert.equal((await one('select status from public.sport_quiz_groups where id=$1', [solo.group_id])).status, 'closed');
  assert.ok(!(await page('m1', g.group_id)).members.some(m => m.display_name === 'Erase'));
});
await test('a deleted creator hands the group to the oldest member, or the group dissolves', async () => {
  const g = await create('gone', 'family'); await join('m2', g.code); await join('m3', g.code);
  const lone = await create('solo', 'friends');
  await db.query('delete from public.profiles where id=$1', [P.gone]);
  assert.equal((await one('select owner_id from public.sport_quiz_groups where id=$1', [g.group_id])).owner_id, P.m2);
  await db.query('delete from public.profiles where id=$1', [P.solo]);
  const l = await one('select status,close_reason from public.sport_quiz_groups where id=$1', [lone.group_id]); assert.deepEqual(l, { status: 'closed', close_reason: 'dissolved' });
});
await test('retention purges expired codes, old join attempts, past sets and closed groups; the case log stays', async () => {
  await db.query("update public.sport_quiz_group_codes set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where group_id=(select group_id from public.sport_quiz_group_codes order by group_id limit 1)");
  await db.query("update public.sport_quiz_group_join_attempts set created_at=created_at-interval '40 days',prune_after=prune_after-interval '40 days' where profile_id=$1", [P.tries]);
  await db.query("update public.sport_quiz_group_sets set created_at=now()-interval '40 days',prune_after=now()-interval '1 second' where group_id=$1", [rugby]);
  await db.query("update public.sport_quiz_groups set closed_at=now()-interval '36 days' where status='closed'");
  const cases = (await one('select count(*)::int n from public.sport_quiz_group_cases')).n;
  const r = await admin('public.quiz_admin_retention($1,$2)', ['Prune expired group codes, sets and attempts.', P.admin]);
  assert.ok(r.removed_codes >= 1); assert.equal(r.removed_join_attempts, 10); assert.equal(r.removed_group_sets, 3); assert.ok(r.removed_groups >= 2);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_groups where status=$1', ['closed'])).n, 0);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_group_cases')).n, cases);
});
// Security review (RLS_SECURITY + MINOR_SAFETY + PRIVACY) fixes -------------------------------------------------------
await play(5, true, false);
const lastRefusal = async key => (await one('select refusal_reason r from public.sport_quiz_group_join_attempts where profile_id=$1 order by id desc limit 1', [P[key]]))?.r;
await test('review P1: an adult who corrects their age to 15 leaves an adult group (teen_rule) and no longer shows', async () => {
  const g = await create('own2'); assert.equal((await join('aged', g.code)).outcome, 'joined');
  await rpc('aged', 'public.set_my_birth_month($1,$2)', [year - 15, 1]);
  assert.deepEqual(await member(g.group_id, 'aged'), { status: 'removed', removed_reason: 'teen_rule' });
  assert.equal((await member(g.group_id, 'own2')).status, 'active', 'the adult owner is not the one removed');
  assert.ok(!(await page('own2', g.group_id)).members.some(m => m.display_name === 'Aged'));
  assert.equal((await page('aged', g.group_id)).outcome, 'removed');
  assert.ok((await admin('public.quiz_admin_group_case($1,$2,$3)', [g.group_id, reason, P.admin])).cases.some(c => c.kind === 'rule_removed'));
});
await test('review P1: under-13 closure ends every membership and a closed account never shows', async () => {
  const g = await create('own3'); assert.equal((await join('kid', g.code)).outcome, 'joined');
  await rpc('kid', 'public.set_my_birth_month($1,$2)', [year - 11, 1]);
  assert.equal((await one('select age_blocked_at is not null b from public.profiles where id=$1', [P.kid])).b, true);
  assert.deepEqual(await member(g.group_id, 'kid'), { status: 'removed', removed_reason: 'closed' });
  assert.ok(!(await page('own3', g.group_id)).members.some(m => m.display_name === 'Kid'));
  assert.equal((await page('own3', g.group_id)).totals.members, 1);
});
await test('review P2: an unfriend removes the adult the teen no longer accepts; the teen stays', async () => {
  const g = await create('tn1', 'cousins');
  await db.query("insert into public.friendships(requester_id,addressee_id,status,responded_at) values($1,$2,'accepted',now())", [P.pal, P.tn1]);
  assert.equal((await join('pal', g.code)).outcome, 'joined');
  await db.query('delete from public.friendships where requester_id=$1 and addressee_id=$2', [P.pal, P.tn1]);
  assert.deepEqual(await member(g.group_id, 'pal'), { status: 'removed', removed_reason: 'teen_rule' });
  assert.equal((await member(g.group_id, 'tn1')).status, 'active');
  assert.equal((await join('pal', (await rpc('tn1', 'public.quiz_group_renew_code($1,$2)', [g.group_id, P.tn1])).code)).outcome, 'refused');
  assert.equal(await lastRefusal('pal'), 'teen_rule', 'no rejoin bar; the rule itself refuses');
});
await test('review P2: an ended guardian link removes the guardian from a teen-only group', async () => {
  const g = await create('tn2', 'family');
  await db.query("insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values($1,$2,'invite',now())", [P.tn2, P.grd]);
  assert.equal((await join('grd', g.code)).outcome, 'joined');
  await db.query('update public.guardian_links set ended_at=now() where minor_id=$1 and guardian_id=$2', [P.tn2, P.grd]);
  assert.deepEqual(await member(g.group_id, 'grd'), { status: 'removed', removed_reason: 'teen_rule' });
});
await test('review P2: a teen tightening their friend-request setting removes the members it now refuses', async () => {
  await db.query("update public.profiles set friend_requests_from='everyone' where id=$1", [P.tn3]);
  const g = await create('tn3', 'friends'); assert.equal((await join('p1', g.code)).outcome, 'joined');
  await db.query("update public.profiles set friend_requests_from='teens' where id=$1", [P.tn3]);
  assert.deepEqual(await member(g.group_id, 'p1'), { status: 'removed', removed_reason: 'teen_rule' });
  assert.equal((await member(g.group_id, 'tn3')).status, 'active');
});
await test('review P1: drift without a trigger (a birthday) is caught lazily on the group page and at group Start', async () => {
  const g = await create('tn4', 'friends'); assert.equal((await join('bday', g.code)).outcome, 'joined');
  const g2 = await create('tn5', 'friends'); assert.equal((await join('bday2', g2.code)).outcome, 'joined');
  // QUIZ-04: a group round needs two members after the drift removal, so a third teen joins first.
  assert.equal((await join('tia', g2.code)).outcome, 'joined');
  await db.exec('alter table public.profiles disable trigger quiz_groups_profile_rules');
  try { await db.query('update public.profiles set birth_year=$2 where id=any($1::uuid[])', [[P.bday, P.bday2], year - 19]); }
  finally { await db.exec('alter table public.profiles enable trigger quiz_groups_profile_rules'); }
  assert.equal((await member(g.group_id, 'bday')).status, 'active', 'no trigger ran');
  const pg = await page('tn4', g.group_id); assert.equal(pg.totals.members, 1);
  assert.deepEqual(await member(g.group_id, 'bday'), { status: 'removed', removed_reason: 'teen_rule' });
  await groupStart('tn5', g2.group_id);
  assert.deepEqual(await member(g2.group_id, 'bday2'), { status: 'removed', removed_reason: 'teen_rule' });
});
await test('review P2: erasure keeps join attempts, so a double erase cannot reset the limits and refusal evidence survives', async () => {
  for (let i = 0; i < 10; i++) await join('erz', `QQQQQQQ${i}`);
  await assert.rejects(() => join('erz', 'QQQQQQQZ'), /quiz_group_try_limit/);
  const s1 = await snapshot('erz'); const e1 = await rpc('erz', 'public.quiz_erase_history($1,$2)', [s1.history_version, P.erz]); assert.equal(e1.retained_join_attempts, 10);
  await assert.rejects(() => join('erz', 'QQQQQQQZ'), /quiz_group_try_limit/);
  const s2 = await snapshot('erz'); await rpc('erz', 'public.quiz_erase_history($1,$2)', [s2.history_version, P.erz]);
  await assert.rejects(() => join('erz', 'QQQQQQQZ'), /quiz_group_try_limit/);
  const tg = await create('tess', 'cousins'); await db.query("update public.profiles set friend_requests_from='teens' where id=$1", [P.tess]);
  assert.equal((await join('erz2', tg.code)).outcome, 'refused');
  const s3 = await snapshot('erz2'); await rpc('erz2', 'public.quiz_erase_history($1,$2)', [s3.history_version, P.erz2]);
  const c = await admin('public.quiz_admin_group_case($1,$2,$3)', [tg.group_id, reason, P.admin]);
  assert.ok(c.refusals.some(x => x.profile_id === P.erz2 && x.refusal_reason === 'teen_rule'));
});
await test('review P3: group fact totals stay hidden until 3 members played and are rounded down to 5s', async () => {
  const g = await create('p2', 'team_fans'); await join('p3', g.code); await join('p4', g.code);
  // QUIZ-04: group totals count group rounds only.
  const playOne = async k => { const r = await groupStart(k, g.group_id); await answer(k, r.attempt.id, 1); await end(k, r.attempt.id, 'user_end'); };
  await playOne('p2'); await playOne('p3');
  let t = (await page('p2', g.group_id)).totals; assert.equal(t.played_this_week, 2); assert.equal(t.facts_this_week, null); assert.equal(t.facts_this_season, null);
  await playOne('p4');
  t = (await page('p2', g.group_id)).totals; assert.equal(t.played_this_week, 3); assert.equal(t.facts_this_week, 0); assert.equal(t.facts_this_week % 5, 0);
});
await test('review P3: member_ref is opaque and different per group; raw profile ids cannot remove', async () => {
  const a = await create('clo1', 'friends'); const b = await create('clo2', 'friends');
  await join('p1', a.code); await join('p1', b.code);
  const ra = (await page('clo1', a.group_id)).members.find(m => !m.is_me).member_ref;
  const rb = (await page('clo2', b.group_id)).members.find(m => !m.is_me).member_ref;
  assert.match(ra, /^[0-9a-f]{32}$/); assert.notEqual(ra, rb); assert.ok(![ra, rb].some(x => x.includes(P.p1.replace(/-/g, '').slice(0, 12))));
  await assert.rejects(() => removeMember('clo1', a.group_id, P.p1), /quiz_group_invalid/);
  await removeMember('clo1', a.group_id, rb);
  assert.equal((await member(a.group_id, 'p1')).status, 'active', 'a ref from another group removes nobody');
  await removeMember('clo1', a.group_id, ra); assert.equal((await member(a.group_id, 'p1')).status, 'removed');
  assert.equal((await member(b.group_id, 'p1')).status, 'active');
});
await test('review P3: an admin-closed group shows no members', async () => {
  const g = await create('p3', 'home_team'); await join('p4', g.code);
  await admin('public.quiz_admin_group_remove($1,null,$2,$3)', [g.group_id, 'Safety case: whole group closed.', P.admin]);
  const pg = await page('p4', g.group_id); assert.equal(pg.outcome, 'closed'); assert.deepEqual(pg.members, []); assert.equal(pg.totals.members, 0);
});
await test('review P3: group codes use pgcrypto random bytes, every position spans all 31 characters', async () => {
  const rows = (await db.query('select public.quiz_group_code_new() c from generate_series(1,3000)')).rows.map(r => r.c);
  assert.ok(rows.every(c => /^[A-HJ-NP-Z2-9]{8}$/.test(c)));
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => new Set(rows.map(c => c[i])).size), Array(8).fill(31));
  assert.ok((await one("select pg_get_functiondef('public.quiz_group_code_new()'::regprocedure) d")).d.includes('gen_random_bytes'));
});
await test('admin snapshot group overview is counts only, with badge and recap totals', async () => {
  const s = await admin('public.quiz_admin_snapshot()');
  for (const k of ['groups_active', 'members_active', 'groups_played_this_week', 'codes_active', 'codes_issued', 'reports_7d', 'refusals_7d']) assert.equal(typeof s.groups[k], 'number', k);
  for (const k of ['badges_sport', 'badges_family', 'badges_season', 'recap_facts_quarter', 'week_items_answered']) assert.equal(typeof s.counts[k], 'number', k);
  assert.ok(!JSON.stringify(s.groups).match(/[0-9a-f]{8}-[0-9a-f]{4}/));
});
await test('snapshots and group reads do not change any row count', async () => {
  const tables = ['attempts', 'round_items', 'badges', 'groups', 'group_members', 'group_codes', 'group_join_attempts', 'group_sets', 'group_cases', 'exposures', 'requests'];
  const counts = async () => Object.fromEntries(await Promise.all(tables.map(async t => [t, (await one(`select count(*)::int n from public.sport_quiz_${t}`)).n])));
  const before = await counts();
  await snapshot('fan'); await rpc('ana', 'public.quiz_groups_mine()'); await page('m7', full); await rpc('expl', 'public.quiz_season_recap()'); await rpc('expl', 'public.quiz_badge_shelf()');
  assert.deepEqual(await counts(), before);
});
await test('migration re-applies over live QUIZ-03 data without changing it', async () => {
  const tables = ['settings', 'questions', 'attempts', 'round_items', 'badges', 'groups', 'group_members', 'group_cases'];
  const state = async () => Object.fromEntries(await Promise.all(tables.map(async t => [t, (await db.query(`select to_jsonb(x) r from public.sport_quiz_${t} x order by to_jsonb(x)::text`)).rows])));
  const before = await state();
  // QUIZ-02 then QUIZ-03 again over live QUIZ-03 rows (new badge labels, review_media audit actions): must not fail.
  // QUIZ-04: after QUIZ-04 exists, QUIZ-03 re-runs only on the full-schema path (quiz.full_schema), followed by QUIZ-04.
  await db.exec("select set_config('quiz.full_schema','on',false)");
  try {
    for (const f of ['20261014150000_timed_sport_trivia.sql', '20261014160000_trivia_play_together.sql', '20261014180000_life_playbook.sql', '20261014190000_life_playbook_bank.sql', '20261015210000_trivia_fresh_questions.sql'])
      await db.exec(fs.readFileSync(`supabase/migrations/${f}`, 'utf8'));
  } finally { await db.exec("select set_config('quiz.full_schema','',false)"); }
  assert.deepEqual(await state(), before);
});

await test('starter bank: 60 drafts load (45 four-choice, 15 true/false) and none can be asked before approval', async () => {
  const keys = JSON.parse(fs.readFileSync('supabase/content/trivia_starter_bank.json', 'utf8')).map((q) => q.key);
  const rows = (await db.query(`select question_type, status from public.sport_quiz_questions where question_key = any($1::uuid[])`, [keys])).rows;
  assert.equal(rows.length, 60);
  assert.ok(rows.every((r) => r.status === 'draft'));
  assert.equal(rows.filter((r) => r.question_type === 'true_false').length, 15);
  assert.equal(rows.filter((r) => r.question_type === 'choice4').length, 45);
});

console.log(JSON.stringify({ passed: tests.filter(t => t.pass).length, total: tests.length }, null, 0));
await db.close();
process.exitCode = tests.some(t => !t.pass) ? 1 : 0;
