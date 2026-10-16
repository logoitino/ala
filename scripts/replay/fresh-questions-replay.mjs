#!/usr/bin/env node
/** QUIZ-05 real PostgreSQL actors: fun facts (audience, guardian approval, clearing, drawing), the answer shuffle,
 * reports and auto-pause, quality flags and difficulty, bulk import, Needs a look and the admin snapshot.
 *
 *   node scripts/replay/fresh-questions-replay.mjs /tmp/books01-pg/pkg/package/dist
 *
 * Builds the whole canonical schema (QUIZ-01..05) on PGlite with the Supabase stubs, then calls every RPC as a real
 * signed-in actor. A few checks act as the database owner to set up relationships (friends, Crew, roster links), to
 * insert synthetic answered rounds for the self-heal thresholds and athlete counts, or to prove a guard.
 * Design: docs/engineering/design/TRIVIA_FRESH_QUESTIONS_DESIGN.md (§6 overrides §1–§5). Section 11 turns the security
 * review's probes (RLS_SECURITY, 2026-10-15) into checks; the last check re-runs MINOR-01 and QUIZ-05.
 * @sideEffects Disposable in-memory database only; no hosted calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const dist = process.argv[2] || '/tmp/books01-pg/pkg/package/dist';
const { PGlite } = await import(pathToFileURL(path.resolve(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.resolve(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const stubs = fs.existsSync('scripts/replay/supabase-stubs.mjs')
  ? (await import(pathToFileURL(path.resolve('scripts/replay/supabase-stubs.mjs')).href)).SUPABASE_STUBS
  : fs.readFileSync('scripts/replay/schema-replay.mjs', 'utf8').match(/const SUPABASE_STUBS = String.raw`([\s\S]*?)`;/)?.[1];
assert.ok(stubs, 'Supabase stubs not found');
await db.exec(stubs);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8'));

// Actors ----------------------------------------------------------------------------------------------------------------
const admins = ['admin', 'admin2'];
const athletes = ['athA', 'athB', 'athU', 'athD', 'athL'];
const teens = ['athT', 'athT2', 'athTB'];
const guardians = ['gT'];
const fixed = ['fan', 'ng', 'ath16', 'rep1', 'rep2', 'rep3', 'rep4', 'rep5', 'rep6', 'newbie', 'blk', 'rpt', 'imp', 'polo', 'erz'];
const cands = Array.from({ length: 72 }, (_, i) => `c${i + 1}`);
const crowd = Array.from({ length: 34 }, (_, i) => `f${i + 1}`);
const keys = [...admins, ...athletes, ...teens, ...guardians, ...fixed, ...cands, ...crowd];
const ids = Object.fromEntries(keys.map((k, i) => [k, `00000000-0000-0000-0000-${String(i + 5000).padStart(12, '0')}`]));
const year = Number((await db.query('select extract(year from current_date)::int y')).rows[0].y);
const meta = k => k === 'ng' ? {} : { birth_year: teens.includes(k) ? year - 15 : k === 'ath16' ? year - 17 : year - 30, birth_month: 1 };
for (const k of keys) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)', [ids[k], JSON.stringify(meta(k))]);
await db.query("update public.profiles set role='admin',is_admin=true where user_id=any($1::uuid[])", [admins.map(k => ids[k])]);
for (const k of keys) await db.query('update public.profiles set full_name=$2,username=$3 where user_id=$1', [ids[k], `${k[0].toUpperCase()}${k.slice(1)} Fresh`, `${k.toLowerCase()}_fresh`]);
const P = Object.fromEntries((await db.query('select user_id,id from public.profiles')).rows.filter(r => Object.values(ids).includes(r.user_id)).map(r => [keys.find(k => ids[k] === r.user_id), r.id]));
// Accounts are 30 days old (report counting needs 7+), except newbie.
await db.query("update public.profiles set created_at = now() - interval '30 days' where user_id=any($1::uuid[]) and user_id <> $2", [Object.values(ids), ids.newbie]);
// Athlete accounts: a roster athlete each; all verified except athU.
const PL = {};
for (const k of [...athletes, ...teens, 'ath16']) {
  PL[k] = (await db.query("insert into public.players(name,school_name,team) values($1,'Kahuku High','Red Raiders') returning id", [`${k} Player`])).rows[0].id;
  await db.query("update public.profiles set player_id=$2,verification_status=$3,role='athlete' where id=$1", [P[k], PL[k], k === 'athU' ? 'unverified' : 'verified']);
}
await db.query("insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values($1,$2,'invite',now())", [P.athT, P.gT]);
await db.query("insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values($1,$2,'invite',now())", [P.athTB, P.gT]);

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

const week = (await one("select date_trunc('week',statement_timestamp() at time zone 'UTC')::date::text w")).w;
const secret = 'ef'.repeat(32);
const reason = 'Reviewed local QUIZ-05 replay fixture only.';
const NOTICE = 'timed-trivia-v1-testing';
const admin = (sql, args = []) => rpc('admin', sql, args);
const players = keys.filter(k => !admins.includes(k) && !crowd.includes(k) && k !== 'ng');
const settings = list => admin('public.quiz_admin_settings($1::jsonb,$2,$3)', [JSON.stringify({ enabled: true, pilot_accounts: list.map(k => P[k]) }), reason, P.admin]);
await settings(players);
await admin('public.quiz_admin_play_settings($1::jsonb,$2,$3)', [JSON.stringify({ round_size: 5, groups_enabled: true, images_enabled: false }), reason, P.admin]);
const HEAL = { min_responders: 30, too_easy_pct: 95, confusing_choice4_pct: 15, confusing_true_false_pct: 35, too_long_pct: 40 };
const fresh = (over = {}, key = 'admin') => rpc(key, 'public.quiz_admin_fresh_settings($1::jsonb,$2,$3)',
  [JSON.stringify({ athlete_questions_enabled: true, athlete_share_pct: 10, reports_paused: false, self_heal: HEAL, ...over }), reason, P[key]]);
const question = (id, action, payload, key = 'admin') => rpc(key, 'public.quiz_admin_question($1,$2,$3::jsonb,$4)', [id, action, JSON.stringify(payload), P[key]]);
let n = 0;
let weekBack = 10; // distinct past weeks for synthetic attempts (one round per account, week and kind)
const base = (sport, extra = {}) => ({ family_action: 'new', topic_category: 'sport', sport, prompt: `Which reviewed ${sport} fresh fact is number ${++n}?`,
  options: ['First choice', 'Second choice', 'Third choice', 'Fourth choice'], correct_option: 1, explanation: `The second choice is the reviewed ${sport} fact.`,
  source_notes: 'Official rules reviewed for this local fixture.', reason, ...extra });
const approved = async (sport, extra = {}) => { const q = await question(null, 'create', base(sport, extra)); await question(q.id, 'approve', { reason }); return q; };
const prefs = key => rpc(key, 'public.quiz_preferences($1::jsonb,$2,$3,$4)', [JSON.stringify({ invitation_mode: 'off', topic_mode: 'sports', notice_version: NOTICE }), 0, randomUUID(), P[key]]);
const start = (key, { request = randomUUID(), sport = 'Basketball' } = {}) =>
  rpc(key, 'public.quiz_start($1,$2,$3,$4,$5,$6,$7,$8)', ['sport', sport, 90, week, NOTICE, request, secret, P[key]]);
const learnStart = (key, athleteKey, { request = randomUUID(), sport = 'Basketball' } = {}) =>
  rpc(key, 'public.quiz_learn_start($1,$2,$3,$4,$5,$6,$7,$8)', [PL[athleteKey], sport, 90, week, NOTICE, request, secret, P[key]]);
const answerAt = (key, attempt, position, request = randomUUID()) => rpc(key, 'public.quiz_answer($1,$2,$3,$4,$5)', [attempt, position, request, secret, P[key]]);
const next = (key, attempt, position, request = randomUUID()) => rpc(key, 'public.quiz_next($1,$2,$3,$4,$5)', [attempt, position, request, secret, P[key]]);
const end = (key, attempt) => rpc(key, 'public.quiz_end($1,$2,$3,$4,$5,$6,$7)', [attempt, null, week, 'user_end', randomUUID(), P[key], 'personal']);
const submit = (key, prompt, text) => rpc(key, 'public.quiz_fact_submit($1,$2,$3)', [prompt, text, P[key]]);
const decide = (factId, action, payload, key = 'admin') => rpc(key, 'public.quiz_admin_fact_decide($1,$2,$3::jsonb,$4)', [factId, action, JSON.stringify(payload), P[key]]);
const CHECK = { no_sponsor_or_business: true, no_place: true, no_schedule: true };
const approveFact = id => decide(id, 'approve', { reason, checklist: CHECK });
const report = (key, qid, why) => rpc(key, 'public.quiz_report($1,$2,$3)', [qid, why, P[key]]);
const friends = (a, b) => db.query("insert into public.friendships(requester_id,addressee_id,status) values($1,$2,'accepted')", [P[a], P[b]]);
const follow = (viewer, athlete) => db.query('insert into public.crew_follows(follower_id,athlete_id) values($1,$2)', [ids[viewer], PL[athlete]]);
const audience = async (k, level, isPrivate = true) => {
  await db.query("select set_config('app.tapuai_privacy_write','on',false)");
  try { await db.query("update public.profiles set profile_audience = profile_audience || jsonb_build_object('fun_facts',$2::text), account_private=$3 where id=$1", [P[k], level, isPrivate]); }
  finally { await db.query("select set_config('app.tapuai_privacy_write','off',false)"); }
};
const factQuestion = async factId => (await one('select question_id from public.quiz_athlete_facts where id=$1', [factId])).question_id;

for (const k of players) await prefs(k);
for (let i = 0; i < 30; i++) await approved('Basketball');

// Advance a personal round to `target` (1-based), answering every item before it; returns the active question there.
const playTo = async (key, startReceipt, target) => {
  let active = startReceipt.active_question; let pos = 1;
  while (pos < target) {
    await answerAt(key, startReceipt.attempt.id, 0);
    const nx = await next(key, startReceipt.attempt.id, pos); pos++; active = nx.active_question;
    assert.ok(active, `item ${pos} issued`);
  }
  return active;
};
const slotOf = async (key, attempt) => (await one('select public.quiz_fact_slot($1,$2) s', [P[key], attempt])).s;

// 1. Access --------------------------------------------------------------------------------------------------------------
await test('new tables are RPC-only with the Closed accounts policy; guest, fan and service role are denied direct reads and writes', async () => {
  for (const t of ['quiz_athlete_facts', 'sport_quiz_question_stats', 'sport_quiz_reports', 'sport_quiz_imports']) {
    assert.equal((await one('select relrowsecurity r from pg_class where oid=$1::regclass', [`public.${t}`])).r, true);
    assert.equal((await one('select count(*)::int n from pg_policies where tablename=$1 and policyname=$2 and permissive=$3', [t, 'Closed accounts', 'RESTRICTIVE'])).n, 1);
    for (const k of ['anon', 'fan', 'athA', 'service']) {
      await assert.rejects(() => actor(k, `select * from public.${t}`), /permission denied/);
      await assert.rejects(() => actor(k, `delete from public.${t}`), /permission denied/);
    }
  }
  await assert.rejects(() => actor('athA', "insert into public.quiz_athlete_facts(athlete_id,prompt_key,answer_text,status,submitted_at,updated_at) values($1,'hype_song','Song','admin_review',now(),now())", [P.athA]), /permission denied/);
  for (const f of ['quiz_admin_fact_queue()', 'quiz_admin_needs_look()']) await assert.rejects(() => rpc('fan', `public.${f}`), /quiz_admin_only|permission denied/);
  await assert.rejects(() => rpc('anon', 'public.quiz_fact_mine()'), /permission denied/);
  for (const f of ['quiz_fact_clear(uuid,text,uuid,timestamptz)', 'quiz_fact_pick(uuid,uuid)', 'quiz_question_stats_refresh(uuid)'])
    assert.equal((await one(`select has_function_privilege('authenticated','public.${f}','execute') x`)).x, false, f);
  assert.equal((await one("select prosecdef d from pg_proc where proname='quiz_fact_submit'")).d, true);
  assert.ok((await one("select array_to_string(proconfig,',') c from pg_proc where proname='quiz_admin_import'")).c.includes('search_path='));
});

// 2. Fun-fact text filter and prompts -----------------------------------------------------------------------------------
await test('the server filter refuses links, handles, digits, addresses, weekdays, emoji, non-Latin, school, not-okay, money and brand words, and near wrong options', async () => {
  const probe = async (text, prompt = 'hidden_talent', who = 'athA') => (await one('select public.quiz_fact_text_problems($1,$2,$3) p', [text, prompt, P[who]])).p;
  const cases = [['see www.myclips.com', 'link'], ['@lani_hoops', 'handle_or_email'], ['Jersey 23 forever', 'digits'], ['Lives on Kam Highway', 'address'],
    ['Saturday mornings', 'weekday_or_time'], ['Hoops 🏀', 'emoji_or_non_latin'], ['Тalent', 'emoji_or_non_latin'], ['Go Kahuku High', 'school_or_city'],
    ['Shit talking', 'not_okay_word'], ['Asking for donations', 'money_word'], ['Nike shoes collecting', 'brand'], ['x', 'length']];
  for (const [text, code] of cases) assert.ok((await probe(text)).includes(code), `${text} → ${code}`);
  assert.ok((await probe('Eye of the Tigr', 'hype_song')).includes('matches_wrong_option'));
  assert.ok((await probe('Spaghetti tacos', 'pregame_meal')).includes('not_on_list'));
  assert.deepEqual(await probe('Chicken and rice', 'pregame_meal'), []);
  assert.deepEqual(await probe('Ukulele covers'), []);
  assert.deepEqual(await probe('Café sketches'), [], 'Latin accents are fine');
  assert.deepEqual((await one("select public.quiz_fact_look_reasons('Kobe Bryant','pro_athlete') r")).r, ['capitalised_pair']);
  assert.equal((await one("select jsonb_array_length(public.quiz_fact_prompts()) n")).n, 6);
  assert.equal((await one("select count(*)::int n from jsonb_array_elements(public.quiz_fact_prompts()) x where x->>'key' in ('favourite_movie','jersey_story')")).n, 0);
});

// 3. Submissions -----------------------------------------------------------------------------------------------------------
let factA, factA2, factT, factU, factD, factL, factTB;
await test('submissions: switch off refuses; no recorded age, non-athletes and bad text refused; three live facts, one per prompt', async () => {
  await assert.rejects(() => submit('athA', 'hype_song', 'Hula Hoop Song'), /quiz_facts_paused/);
  await fresh({ athlete_share_pct: 0 });
  await assert.rejects(() => submit('ng', 'hype_song', 'Hula Hoop Song'), /quiz_fact_age_needed/);
  await assert.rejects(() => submit('fan', 'hype_song', 'Hula Hoop Song'), /quiz_fact_athlete_only/);
  await assert.rejects(() => submit('athA', 'hype_song', 'call 808 555 0100'), /quiz_fact_text: .*digits/);
  await assert.rejects(() => rpc('athB', 'public.quiz_fact_submit($1,$2,$3)', ['hype_song', 'Island Breeze Jam', P.athA]), /quiz_identity_changed/);
  factA = (await submit('athA', 'hidden_talent', 'Ukulele covers')).fact; assert.equal(factA.status, 'admin_review');
  factA2 = (await submit('athA', 'pregame_meal', 'chicken AND rice')).fact; assert.equal(factA2.answer_text, 'Chicken and rice', 'meal stored as the list spelling');
  await submit('athA', 'other_sport', 'Paddle boarding');
  await assert.rejects(() => submit('athA', 'hype_song', 'Island Breeze Jam'), /quiz_fact_limit/);
  await assert.rejects(() => submit('athA', 'hidden_talent', 'Origami cranes'), /quiz_fact_prompt_taken/);
  const ab = (await submit('ath16', 'hidden_talent', 'Origami cranes')).fact; assert.equal(ab.status, 'admin_review', '16–17 need no guardian');
  assert.equal((await one('select count(*)::int n from public.sport_quiz_audit where action=$1 and reason like $2', ['fact_submit', '%Ukulele%'])).n, 0);
});
await test('13–15: no guardian keeps a draft waiting for a guardian; with a guardian it goes to MINOR-01 approval type fun_fact', async () => {
  const w = (await submit('athT2', 'hidden_talent', 'Lei making')).fact;
  assert.equal(w.status, 'waiting_guardian');
  assert.equal((await one('select count(*)::int n from public.guardian_approval_requests where minor_id=$1', [P.athT2])).n, 0, 'nothing is sent anywhere');
  factT = (await submit('athT', 'hidden_talent', 'Beatboxing')).fact; assert.equal(factT.status, 'guardian_review');
  const req = await one('select change_key,status from public.guardian_approval_requests where minor_id=$1', [P.athT]);
  assert.equal(req.change_key, `fun_fact:${factT.id}`); assert.equal(req.status, 'pending');
  factTB = (await submit('athTB', 'pro_athlete', 'Kawhi Leonard')).fact;
  const sup = await rpc('athT', 'public.get_my_supervision()'); assert.equal(sup.summary.fun_facts_shared, 0);
});
await test('guardian-only approve / decline: admins and other adults cannot decide, the guardian cannot withdraw', async () => {
  const reqId = (await one('select id from public.guardian_approval_requests where minor_id=$1', [P.athT])).id;
  await assert.rejects(() => rpc('admin', 'public.guardian_decide_approval($1,true)', [reqId]), /not yours to decide/);
  await assert.rejects(() => approveFact(factT.id), /quiz_fact_guardian_first/);
  await assert.rejects(() => rpc('fan', 'public.quiz_fact_guardian_decide($1,true,$2)', [factT.id, P.fan]), /quiz_fact_guardian_only/);
  await assert.rejects(() => rpc('gT', 'public.quiz_fact_withdraw($1,$2)', [factT.id, P.gT]), /quiz_fact_missing/);
  await assert.rejects(() => db.query("update public.guardian_approval_requests set status='approved',decided_by=$2 where id=$1", [reqId, P.admin]), /quiz_fact_guardian_only/);
  const pending = await rpc('gT', 'public.quiz_fact_guardian_pending()');
  assert.deepEqual(pending.facts.map(f => f.answer_text).sort(), ['Beatboxing', 'Kawhi Leonard']);
  assert.equal((await rpc('gT', 'public.quiz_fact_guardian_decide($1,false,$2)', [factTB.id, P.gT])).status, 'declined');
  // The generic MINOR-01 path works for the guardian too and changes no privacy setting.
  const before = await one('select friend_requests_from,account_private from public.profiles where id=$1', [P.athT]);
  await rpc('gT', 'public.guardian_decide_approval($1,true)', [reqId]);
  assert.deepEqual(await one('select friend_requests_from,account_private from public.profiles where id=$1', [P.athT]), before);
  assert.equal((await one('select status,guardian_decision from public.quiz_athlete_facts where id=$1', [factT.id])).status, 'admin_review');
  await assert.rejects(() => decide(factT.id, 'approve', { reason }), /quiz_fact_checklist_required/);
  assert.equal((await approveFact(factT.id)).status, 'approved');
  const sup = await rpc('athT', 'public.get_my_supervision()'); const gs = await rpc('gT', 'public.guardian_get_supervision($1)', [P.athT]);
  assert.equal(sup.summary.fun_facts_shared, 1); assert.equal(gs.summary.fun_facts_shared, 1);
});
await test('admin approval builds the question with {answer} and curated wrong options: no question row holds the athlete text', async () => {
  const r = await approveFact(factA.id); assert.equal(r.status, 'approved');
  await approveFact(factA2.id);
  const q = await one('select prompt,options,correct_option,explanation,topic_category,status from public.sport_quiz_questions where id=$1', [r.question_id]);
  assert.equal(q.topic_category, 'athlete'); assert.equal(q.status, 'approved'); assert.equal(q.options[q.correct_option], '{answer}');
  assert.ok(q.prompt.includes('{name}'));
  assert.equal((await one("select count(*)::int n from public.sport_quiz_questions where prompt||options::text||explanation like '%Ukulele%' or prompt||options::text||explanation like '%Chicken and rice%' and topic_category='athlete' and options::text not like '%{answer}%'")).n, 0);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_questions where topic_category='athlete' and options::text like '%Ukulele covers%'")).n, 0);
  const meal = await one('select options from public.sport_quiz_questions where id=$1', [await factQuestion(factA2.id)]);
  assert.ok(!meal.options.includes('Chicken and rice'), 'the chosen meal is not a wrong option');
  const queue = await admin('public.quiz_admin_fact_queue()');
  assert.ok(queue.facts.some(f => f.id === factA.id && f.answer_text === 'Ukulele covers' && f.guardian_status === 'not_needed'));
  assert.ok(queue.facts.some(f => f.id === factT.id && f.guardian_status === 'approved'));
  assert.ok(queue.facts.some(f => f.id === factTB.id && f.status === 'declined' && f.decline_reason === 'guardian'));
  // Unverified athlete and other athletes for later checks.
  factU = (await submit('athU', 'hidden_talent', 'Knot tying')).fact; await approveFact(factU.id);
  factD = (await submit('athD', 'hidden_talent', 'Yo-yo tricks')).fact; await approveFact(factD.id);
  factL = (await submit('athL', 'hidden_talent', 'Slackline walking')).fact; await approveFact(factL.id);
  const snap = await admin('public.quiz_admin_snapshot()');
  assert.ok(!snap.questions.some(x => x.topic_category === 'athlete'), 'fun-fact questions stay out of the bank pages');
  assert.ok(!('fact_salt' in snap.settings)); assert.equal(snap.fresh.facts_live, 6);
  assert.ok(!snap.audit.some(a => ['fact_submit', 'fact_withdraw', 'fact_guardian', 'fact_clear'].includes(a.action)));
});

// 4. Audience and drawing -----------------------------------------------------------------------------------------------
await db.query("update public.sport_quiz_settings set fact_salt='replay-fresh-salt'");
const inBucket = async k => (await one("select public.quiz_bucket('replay-fresh-salt:' || $1 || ':' || $2,0) b", [P[k], week])).b < 34;
const pool = []; const outPool = [];
for (const k of cands) (await inBucket(k) ? pool : outPool).push(k);
const take = () => { const k = pool.shift(); assert.ok(k, 'enough in-bucket viewers'); return k; };
await test('audience: friends default, 13–15 capped at friends, private profiles, blocks and unverified athletes refuse', async () => {
  await fresh({ athlete_share_pct: 10 });
  const s = take(); // a stranger
  assert.equal((await one('select public.quiz_fact_audience_ok($1,$2) x', [P.athA, P[s]])).x, false, 'default friends');
  await audience('athT', 'everyone', false);
  assert.equal((await one('select public.quiz_fact_audience_ok($1,$2) x', [P.athT, P[s]])).x, false, '13–15 capped at friends even when public');
  await audience('athB', 'everyone', true);
  assert.equal((await one('select public.quiz_fact_audience_ok($1,$2) x', [P.athB, P[s]])).x, false, 'private profile: everyone means friends');
  await audience('athB', 'everyone', false);
  assert.equal((await one('select public.quiz_fact_audience_ok($1,$2) x', [P.athB, P[s]])).x, true);
  await friends('athA', s); await follow(s, 'athA');
  assert.equal((await one('select public.quiz_fact_viewer_ok($1,$2,null) x', [factA.id, P[s]])).x, true);
  await follow(s, 'athU'); await friends('athU', s);
  assert.equal((await one('select public.quiz_fact_viewer_ok($1,$2,null) x', [factU.id, P[s]])).x, false, 'unverified athletes are never drawn');
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P.athB, P[s]]);
  assert.equal((await one('select public.quiz_fact_audience_ok($1,$2) x', [P.athB, P[s]])).x, false, 'a block refuses');
  assert.equal((await one("select public.privacy_default_audience()->>'fun_facts' a")).a, 'friends');
});
let drawn;
await test('drawing: a friend who follows the athlete gets one fun fact at the round\'s slot, filled at read time, with the athlete card after the reveal', async () => {
  const v = take(); await friends('athA', v); await follow(v, 'athA');
  const r = await start(v); const slot = await slotOf(v, r.attempt.id);
  assert.ok(slot >= 2 && slot <= 5); assert.equal(await slotOf(v, r.attempt.id), slot, 'deterministic per player-week');
  const q = await playTo(v, r, slot);
  assert.equal(q.topic_category, 'athlete'); assert.ok(q.prompt.startsWith('What is AthA') || q.prompt.includes('AthA'), q.prompt);
  assert.equal(q.fun_fact.first_name, 'AthA'); assert.ok(q.options.includes('Ukulele covers') || q.options.includes('Chicken and rice'));
  assert.ok(!('correct_option' in q) && !('explanation' in q) && !('shown_order' in q));
  const text = q.options.includes('Ukulele covers') ? 'Ukulele covers' : 'Chicken and rice';
  const a = await answerAt(v, r.attempt.id, q.options.indexOf(text));
  assert.equal(a.result.was_correct, true); assert.equal(a.result.fun_fact.athlete_player_id, PL.athA); assert.equal(a.result.fun_fact.first_name, 'AthA');
  assert.ok(a.result.explanation.includes('AthA'));
  const audit = await one("select question_id from public.sport_quiz_audit where actor_id=$1 and action='answer' order by id desc limit 1", [P[v]]);
  assert.equal(audit.question_id, null, 'fun-fact answer audit rows carry no question id');
  const items = (await db.query("select q.topic_category from public.sport_quiz_round_items i join public.sport_quiz_questions q on q.id=i.question_id where i.attempt_id=$1", [r.attempt.id])).rows;
  assert.equal(items.filter(x => x.topic_category === 'athlete').length, 1, 'at most one per round');
  await end(v, r.attempt.id);
  drawn = { v, attempt: r.attempt.id, text };
});
await test('about 1 in 3 rounds: a following friend outside the player-week bucket gets no fun fact; the share 0 switch off draws none', async () => {
  const v = outPool.shift(); await friends('athA', v); await follow(v, 'athA');
  const r = await start(v); assert.equal(await slotOf(v, r.attempt.id), null);
  const topics = [];
  let q = r.active_question; for (let pos = 1; pos <= 5; pos++) { topics.push(q.topic_category); await answerAt(v, r.attempt.id, 0); if (pos < 5) q = (await next(v, r.attempt.id, pos)).active_question; }
  assert.ok(!topics.includes('athlete'));
  const share = (await one("select count(*)::int n from (select k from unnest($1::text[]) k) x", [cands])).n;
  assert.ok(pool.length + outPool.length < share);
});
await test('Learn card: a stranger who started from the athlete\'s card is refused a friends-only fact; with everyone + public they get it; an invalid athlete id starts an ordinary round', async () => {
  const s = take();
  const r = await learnStart(s, 'athL');
  assert.equal((await one('select learn_athlete_id from public.sport_quiz_attempts where id=$1', [r.attempt.id])).learn_athlete_id, P.athL);
  const q = await playTo(s, r, await slotOf(s, r.attempt.id));
  assert.notEqual(q.topic_category, 'athlete', 'friends-only audience refuses a Learn-card stranger');
  await audience('athL', 'everyone', false);
  const s2 = take(); const r2 = await learnStart(s2, 'athL');
  const q2 = await playTo(s2, r2, await slotOf(s2, r2.attempt.id));
  assert.equal(q2.topic_category, 'athlete'); assert.ok(q2.options.includes('Slackline walking'));
  // Replay with a different athlete id conflicts; an unknown player id starts with no athlete recorded.
  const req = randomUUID(); const s3 = take();
  const r3 = await rpc(s3, 'public.quiz_learn_start($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), 'Basketball', 90, week, NOTICE, req, secret, P[s3]]);
  assert.equal((await one('select learn_athlete_id from public.sport_quiz_attempts where id=$1', [r3.attempt.id])).learn_athlete_id, null);
  await assert.rejects(() => rpc(s3, 'public.quiz_learn_start($1,$2,$3,$4,$5,$6,$7,$8)', [PL.athL, 'Basketball', 90, week, NOTICE, req, secret, P[s3]]), /quiz_request_conflict/);
});
await test('re-check at the reveal: an audience change after issue voids the item (fact_unavailable) and reveals nothing; a block voids an issued item at once', async () => {
  const v = take(); await friends('athD', v); await follow(v, 'athD');
  const r = await start(v); const slot = await slotOf(v, r.attempt.id);
  const q = await playTo(v, r, slot); assert.equal(q.topic_category, 'athlete');
  await audience('athD', 'only_me');
  const a = await answerAt(v, r.attempt.id, 0); assert.equal(a.outcome, 'fact_unavailable');
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1 and position=$2', [r.attempt.id, slot])).status, 'void');
  assert.ok(!JSON.stringify(a).includes('Yo-yo tricks'));
  await audience('athD', 'friends');
  const v2 = take(); await friends('athD', v2); await follow(v2, 'athD');
  const r2 = await start(v2); const slot2 = await slotOf(v2, r2.attempt.id);
  const q2 = await playTo(v2, r2, slot2); assert.equal(q2.topic_category, 'athlete');
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P[v2], P.athD]);
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1 and position=$2', [r2.attempt.id, slot2])).status, 'void');
  const v3 = take(); await friends('athD', v3); await follow(v3, 'athD');
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P.athD, P[v3]]);
  const r3 = await start(v3); const q3 = await playTo(v3, r3, await slotOf(v3, r3.attempt.id));
  assert.notEqual(q3.topic_category, 'athlete', 'blocked: an ordinary question instead');
});
await test('at most one per athlete per viewer per month; a later month draws again', async () => {
  const v = drawn.v;
  const other = await one("select q.id,q.question_key from public.sport_quiz_questions q join public.quiz_athlete_facts f on f.id=q.fact_id where f.athlete_id=$1 and q.id not in (select question_id from public.sport_quiz_round_items where attempt_id=$2)", [P.athA, drawn.attempt]);
  assert.ok(other, 'athA has a second fact');
  const nextWeek = (await one("select ($1::date + 7)::text d", [week])).d;
  const syn = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,round_state,position,planned_items,round_size,topic_category,round_kind,session_hash)
    values($1,$2::date,'issued',now(),'round',90,now(),now()+interval '90 seconds','item',1,5,5,'sport','personal',$3) returning id`, [P[v], nextWeek, 'a'.repeat(64)])).id;
  assert.equal((await one('select public.quiz_fact_pick($1,$2) q', [P[v], syn])).q, null);
  await db.query("update public.sport_quiz_round_items set issued_at = issued_at - interval '40 days', expires_at = expires_at - interval '40 days', answered_at = answered_at - interval '40 days', closed_at = closed_at - interval '40 days' where attempt_id=$1", [drawn.attempt]);
  assert.equal((await one('select public.quiz_fact_pick($1,$2) q', [P[v], syn])).q, other.id);
  await db.query('delete from public.sport_quiz_attempts where id=$1', [syn]);
});

// 5. Answer shuffle ---------------------------------------------------------------------------------------------------------
await test('shuffle: the shown order is stored at issue, identical on Start / Next replay, mapped back on answer, and kept in the receipt; true / false is never shuffled', async () => {
  const k = 'polo'; const req = randomUUID();
  const r = await start(k, { request: req });
  const again = await start(k, { request: req });
  assert.deepEqual(again.active_question.options, r.active_question.options, 'Start replay: same order');
  const item = await one('select shown_order,question_id from public.sport_quiz_round_items where attempt_id=$1 and position=1', [r.attempt.id]);
  assert.equal(item.shown_order.length, 4);
  const stored = (await one('select options from public.sport_quiz_questions where id=$1', [item.question_id])).options;
  assert.deepEqual(r.active_question.options, item.shown_order.map(i => stored[i]));
  const a = await answerAt(k, r.attempt.id, 2);
  const row = await one('select answered_option,answered_position from public.sport_quiz_round_items where attempt_id=$1 and position=1', [r.attempt.id]);
  assert.equal(row.answered_position, 2); assert.equal(row.answered_option, item.shown_order[2]);
  assert.equal(a.result.answered_position, 2); assert.equal(a.result.answered_option, item.shown_order[2]);
  assert.deepEqual(a.result.shown_order, item.shown_order); assert.equal(r.active_question.options[a.result.correct_position], stored[a.result.correct_option]);
  const nreq = randomUUID(); const n1 = await next(k, r.attempt.id, 1, nreq); const n2 = await next(k, r.attempt.id, 1, nreq);
  assert.deepEqual(n2.active_question.options, n1.active_question.options, 'Next replay: same order');
  await end(k, r.attempt.id);
  const hist = await rpc(k, 'public.quiz_history()');
  assert.ok(hist.items[0].items[0].result.correct_position !== undefined && hist.items[0].items[0].question.options.length === 4);
  const tf = await approved('Volleyball', { question_type: 'true_false', options: ['True', 'False'], correct_option: 0 });
  assert.deepEqual((await one('select options,correct_option from public.sport_quiz_questions where id=$1', [tf.id])), { options: ['True', 'False'], correct_option: 0 });
  const t = await start('rpt', { sport: 'Volleyball' });
  assert.deepEqual(t.active_question.options, ['True', 'False']);
  assert.equal((await one('select shown_order from public.sport_quiz_round_items where attempt_id=$1', [t.attempt.id])).shown_order, null);
  await answerAt('rpt', t.attempt.id, 0);
});
await test('approval shuffles the stored order (no correct-first habit); the guard refuses any other change of options', async () => {
  const qs = []; for (let i = 0; i < 12; i++) { const q = await question(null, 'create', base('Hockey', { correct_option: 0 })); qs.push(q.id); }
  for (const id of qs) await question(id, 'approve', { reason });
  const rows = (await db.query('select options,correct_option from public.sport_quiz_questions where id=any($1::uuid[])', [qs])).rows;
  assert.ok(rows.some(r => r.correct_option !== 0), 'not every correct answer stays first');
  assert.ok(rows.every(r => r.options[r.correct_option] === 'First choice' && [...r.options].sort().join() === ['First choice', 'Second choice', 'Third choice', 'Fourth choice'].sort().join()));
  await assert.rejects(() => db.query("update public.sport_quiz_questions set options='[\"a\",\"b\",\"c\",\"d\"]' where id=$1", [qs[0]]), /quiz_immutable/);
  const d = await question(null, 'create', base('Hockey'));
  await assert.rejects(() => db.query("update public.sport_quiz_questions set status='approved',correct_option=0,reviewed_at=now() where id=$1", [d.id]), /quiz_immutable/);
});

// 6. Withdrawal and clearing -------------------------------------------------------------------------------------------------
await test('withdrawal by the athlete alone clears the text now, voids the question and issued items; history shows "Removed by the athlete"; no audit row holds the text', async () => {
  const v = take(); await friends('athA', v); await follow(v, 'athA');
  // drawn.v already saw a fact; v gets one issued and unrevealed.
  const r = await start(v); const slot = await slotOf(v, r.attempt.id); const q = await playTo(v, r, slot);
  assert.equal(q.topic_category, 'athlete');
  const factId = (await one('select fact_id from public.sport_quiz_questions where id=$1', [q.id])).fact_id;
  await assert.rejects(() => rpc('admin', 'public.quiz_fact_withdraw($1,$2)', [factId, P.admin]), /quiz_fact_missing/);
  const w = await rpc('athA', 'public.quiz_fact_withdraw($1,$2)', [factId, P.athA]);
  assert.equal(w.fact.status, 'withdrawn'); assert.equal(w.fact.answer_text, null);
  const f = await one('select answer_text,status,clear_cause from public.quiz_athlete_facts where id=$1', [factId]);
  assert.deepEqual(f, { answer_text: null, status: 'withdrawn', clear_cause: 'withdrawn' });
  assert.equal((await one('select status from public.sport_quiz_questions where id=$1', [q.id])).status, 'void');
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1 and position=$2', [r.attempt.id, slot])).status, 'void');
  // Withdraw athA's other approved fact too, so the one drawn.v answered earlier is certainly gone.
  for (const other of (await db.query("select id from public.quiz_athlete_facts where athlete_id=$1 and status='approved'", [P.athA])).rows)
    await rpc('athA', 'public.quiz_fact_withdraw($1,$2)', [other.id, P.athA]);
  const hist = await rpc(drawn.v, 'public.quiz_history()');
  const seen = hist.items.flatMap(i => i.items).find(i => i.question.topic_category === 'athlete');
  assert.equal(seen.question.prompt, 'Removed by the athlete'); assert.ok(seen.question.options.includes('Removed by the athlete'));
  assert.equal(seen.result.explanation, 'Removed by the athlete.'); assert.equal(seen.status, 'answered', 'a revealed answer stays counted');
  assert.ok(!JSON.stringify(hist).includes(drawn.text));
  assert.equal((await one("select count(*)::int n from public.sport_quiz_audit where coalesce(reason,'') like '%Ukulele%' or coalesce(reason,'') like '%Chicken and rice%'")).n, 0);
});
await test('unlinking, an under-13 block and account deletion clear the text in the same transaction and void the question', async () => {
  const qB = (await submit('athB', 'hidden_talent', 'Fire knife dance')).fact; await approveFact(qB.id);
  const qid = await factQuestion(qB.id);
  await db.query('update public.profiles set player_id=null where id=$1', [P.athB]);
  assert.deepEqual(await one('select answer_text,status,clear_cause from public.quiz_athlete_facts where id=$1', [qB.id]), { answer_text: null, status: 'removed', clear_cause: 'unlinked' });
  assert.equal((await one('select status from public.sport_quiz_questions where id=$1', [qid])).status, 'void');
  await db.query("update public.profiles set age_blocked_at=now() where id=$1", [P.athT2]);
  assert.equal((await one('select status from public.quiz_athlete_facts where athlete_id=$1', [P.athT2])).status, 'removed');
  const qL = await factQuestion(factL.id);
  await db.query('delete from auth.users where id=$1', [ids.athL]);
  assert.equal((await one('select count(*)::int n from public.quiz_athlete_facts where id=$1', [factL.id])).n, 0);
  assert.deepEqual(await one('select status,fact_id from public.sport_quiz_questions where id=$1', [qL]), { status: 'void', fact_id: null });
});

// 7. Reports --------------------------------------------------------------------------------------------------------------
const curling = await approved('Curling');
const playCurling = async k => { const r = await start(k, { sport: 'Curling' }); await answerAt(k, r.attempt.id, 0); return r; };
await test('report rules: only after a closed item; fixed reasons; once per question; private only on fun facts; intake pause records nothing', async () => {
  await assert.rejects(() => report('rep1', curling.id, 'wrong_answer'), /quiz_report_not_allowed/);
  for (const k of ['rep1', 'rep2', 'rep3', 'rep4', 'rep5', 'newbie', 'blk']) await playCurling(k);
  await assert.rejects(() => report('rep1', curling.id, 'rude'), /quiz_report_invalid/);
  await assert.rejects(() => report('rep1', curling.id, 'private'), /quiz_report_invalid/);
  await fresh({ reports_paused: true });
  assert.equal((await report('rep1', curling.id, 'confusing')).outcome, 'paused');
  assert.equal((await one('select count(*)::int n from public.sport_quiz_reports')).n, 0);
  await fresh();
  assert.equal((await report('newbie', curling.id, 'wrong_answer')).outcome, 'reported');
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P.blk, P.admin]);
  assert.equal((await report('blk', curling.id, 'wrong_answer')).outcome, 'reported');
  const nc = (await db.query('select not_counted_reason r from public.sport_quiz_reports order by id')).rows.map(x => x.r);
  assert.deepEqual(nc, ['new_account', 'blocked_pair'], 'new accounts and blocked pairs are recorded but never counted');
  assert.equal(await one('select public.quiz_question_paused($1) p', [curling.id]).then(r => r.p), false);
  assert.equal((await report('rep1', curling.id, 'wrong_answer')).outcome, 'reported');
  assert.equal((await report('rep1', curling.id, 'confusing')).outcome, 'already_reported');
  assert.equal((await one('select public.quiz_question_paused($1) p', [curling.id])).p, false, 'one counted reporter is not enough');
  const r2 = await report('rep2', curling.id, 'confusing'); assert.equal(r2.outcome, 'reported'); assert.ok(!('counted' in r2) && !('paused' in r2));
  assert.equal((await one('select public.quiz_question_paused($1) p', [curling.id])).p, true, 'two counted accounts pause an ordinary question');
  assert.equal((await one("select public.quiz_unseen_count($1,'sport','Curling') n", [P.rep6])).n, 0, 'a paused question is never drawn');
});
await test('Needs a look: paused with reasons and counts only; Restore needs 3 new counted reporters to pause again; Dismiss and Archive', async () => {
  const look = await admin('public.quiz_admin_needs_look()');
  const row = look.questions.find(x => x.question_id === curling.id);
  assert.ok(row && row.paused_at && row.reports.counted === 2 && row.reports.not_counted === 2 && row.reports.open === 4);
  assert.ok(!JSON.stringify(look).includes(P.rep1), 'no reporter id');
  const snap = await admin('public.quiz_admin_snapshot()'); assert.ok(snap.fresh.needs_look_count >= 1 && snap.fresh.paused_count >= 1);
  await assert.rejects(() => admin('public.quiz_admin_needs_look_action($1,$2,$3,$4)', [curling.id, 'dismiss', reason, P.admin]), /quiz_look_paused/);
  await admin('public.quiz_admin_needs_look_action($1,$2,$3,$4)', [curling.id, 'restore', reason, P.admin]);
  assert.equal((await one('select public.quiz_question_paused($1) p', [curling.id])).p, false);
  await report('rep3', curling.id, 'wrong_answer'); await report('rep4', curling.id, 'wrong_answer');
  assert.equal((await one('select public.quiz_question_paused($1) p', [curling.id])).p, false, 'two new reporters after a restore are not enough');
  await report('rep5', curling.id, 'wrong_answer');
  assert.equal((await one('select public.quiz_question_paused($1) p', [curling.id])).p, true, 'three new reporters pause again');
  await admin('public.quiz_admin_needs_look_action($1,$2,$3,$4)', [curling.id, 'archive', reason, P.admin]);
  assert.equal((await one('select status from public.sport_quiz_questions where id=$1', [curling.id])).status, 'archived');
  assert.equal((await admin('public.quiz_admin_needs_look()')).questions.some(x => x.question_id === curling.id), false);
});
await test('fun fact: one counted "Not okay" pauses it and voids issued items; the owner sees "paused" without counts or reporter', async () => {
  const v = take(); await friends('athT', v); await follow(v, 'athT');
  const r = await start(v); const slot = await slotOf(v, r.attempt.id); const q = await playTo(v, r, slot);
  assert.equal(q.topic_category, 'athlete'); assert.ok(q.options.includes('Beatboxing'));
  const rep = take(); await friends('athT', rep); await follow(rep, 'athT');
  // rep needs a closed item: give them the question through a synthetic closed item in a completed round.
  await playCurlingLike(rep);
  const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,position,planned_items,round_size,topic_category,round_kind,closed_at,close_reason,completed_at)
    values($1,($2::date - 7),'completed',now(),'round',90,now(),now()+interval '90 seconds',1,1,5,'sport','personal',now(),'answered',now()) returning id`, [P[rep], week])).id;
  await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) select $1,1,id,question_key,now(),now()+interval '90 seconds',0,now(),'answered',now() from public.sport_quiz_questions where id=$2", [a, q.id]);
  await report(rep, q.id, 'not_okay');
  assert.equal((await one('select pause_reason from public.sport_quiz_question_stats where question_id=$1', [q.id])).pause_reason, 'fact_report');
  assert.equal((await one('select status from public.sport_quiz_round_items where attempt_id=$1 and position=$2', [r.attempt.id, slot])).status, 'void');
  const mine = await rpc('athT', 'public.quiz_fact_mine()');
  const f = mine.facts.find(x => x.id === factT.id); assert.equal(f.status, 'paused');
  assert.ok(!JSON.stringify(mine).includes(P[rep]) && !JSON.stringify(mine).includes('report'));
});
async function playCurlingLike(k) { const s = await approved('Lacrosse'); const r = await start(k, { sport: 'Lacrosse' }); await answerAt(k, r.attempt.id, 0); return s; }
await test('daily auto-pause cap: after 10 pauses in a topic, reports queue for an admin and one alert is recorded', async () => {
  const sci = []; for (let i = 0; i < 11; i++) sci.push(await approved('Science', { topic_category: 'science', sport: 'Science' }));
  for (const q of sci.slice(0, 10)) await db.query("insert into public.sport_quiz_question_stats(question_id,paused_at,pause_reason,updated_at) values($1,now(),'reports',now())", [q.id]);
  const target = sci[10];
  for (const k of ['rep1', 'rep2']) {
    const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,position,planned_items,round_size,topic_category,round_kind,closed_at,close_reason,completed_at)
      values($1,($2::date - 14),'completed',now(),'round',90,now(),now()+interval '90 seconds',1,1,5,'science','personal',now(),'answered',now()) returning id`, [P[k], week])).id;
    await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) select $1,1,id,question_key,now(),now()+interval '90 seconds',0,now(),'answered',now() from public.sport_quiz_questions where id=$2", [a, target.id]);
    await report(k, target.id, 'wrong_answer');
  }
  const st = await one('select paused_at,queued_at from public.sport_quiz_question_stats where question_id=$1', [target.id]);
  assert.equal(st.paused_at, null); assert.ok(st.queued_at);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_audit where action='report_alert' and reason='science'")).n, 1);
  assert.deepEqual((await admin('public.quiz_admin_needs_look()')).alerts, ['science']);
});
await test('per-account daily report limit is 10', async () => {
  const qs = []; for (let i = 0; i < 11; i++) qs.push(await approved('Rowing'));
  const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,position,planned_items,round_size,topic_category,round_kind,closed_at,close_reason,completed_at)
    values($1,($2::date - 21),'completed',now(),'round',90,now(),now()+interval '90 seconds',5,5,5,'sport','personal',now(),'answered',now()) returning id`, [P.rep6, week])).id;
  for (let i = 0; i < 11; i++) await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) select $1,$2,id,question_key,now(),now()+interval '90 seconds',0,now(),'answered',now() from public.sport_quiz_questions where id=$3", [a, (i % 5) + 1 + Math.floor(i / 5) * 0, qs[i].id]).catch(async () => {
    const b = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,position,planned_items,round_size,topic_category,round_kind,closed_at,close_reason,completed_at)
      values($1,($2::date - 28 - 7 * $3),'completed',now(),'round',90,now(),now()+interval '90 seconds',1,1,5,'sport','personal',now(),'answered',now()) returning id`, [P.rep6, week, i])).id;
    await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) select $1,1,id,question_key,now(),now()+interval '90 seconds',0,now(),'answered',now() from public.sport_quiz_questions where id=$2", [b, qs[i].id]);
  });
  for (let i = 0; i < 10; i++) assert.equal((await report('rep6', qs[i].id, 'confusing')).outcome, 'reported');
  await assert.rejects(() => report('rep6', qs[10].id, 'confusing'), /quiz_report_limit/);
});
await test('retention clears reporter ids at 90 days and deletes reports at 180; erasure removes the caller\'s reports', async () => {
  const ids3 = (await db.query('select id from public.sport_quiz_reports where reporter_id=$1 order by id limit 2', [P.rep6])).rows.map(r => r.id);
  await db.query("update public.sport_quiz_reports set created_at = now() - interval '100 days' where id=$1", [ids3[0]]);
  await db.query("update public.sport_quiz_reports set created_at = now() - interval '200 days' where id=$1", [ids3[1]]);
  const out = await admin('public.quiz_admin_retention($1,$2)', [reason, P.admin]);
  assert.ok(out.cleared_reporters >= 1 && out.removed_reports >= 1);
  assert.equal((await one('select reporter_id from public.sport_quiz_reports where id=$1', [ids3[0]])).reporter_id, null);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_reports where id=$1', [ids3[1]])).n, 0);
  const hv = (await rpc('rep6', 'public.quiz_snapshot()')).history_version;
  const e = await rpc('rep6', 'public.quiz_erase_history($1,$2)', [hv, P.rep6]);
  assert.ok(e.removed_reports >= 8); assert.equal((await one('select count(*)::int n from public.sport_quiz_reports where reporter_id=$1', [P.rep6])).n, 0);
});

// 8. Flags and difficulty -------------------------------------------------------------------------------------------------------
const responders = async (q, rightCount, expiredCount, total, extra = []) => {
  const qrow = await one('select id,question_key,correct_option,question_type,options from public.sport_quiz_questions where id=$1', [q]);
  const wrong = qrow.question_type === 'true_false' ? 1 - qrow.correct_option : (qrow.correct_option + 1) % 4;
  const who = [...crowd.slice(0, total), ...extra];
  for (let i = 0; i < who.length; i++) {
    const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,round_state,position,planned_items,round_size,topic_category,round_kind,session_hash)
      values($1,($2::date - 7 * $3),'issued',now(),'round',90,now(),now()+interval '90 seconds','item',1,1,5,'sport','personal',$4) returning id`, [P[who[i]], week, ++weekBack, 'b'.repeat(64)])).id;
    await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,status) values($1,1,$2,$3,now() - interval '2 minutes',now() + interval '1 minute','issued')", [a, qrow.id, qrow.question_key]);
    if (i < expiredCount) await db.query("update public.sport_quiz_round_items set status='expired',closed_at=expires_at where attempt_id=$1", [a]);
    else await db.query("update public.sport_quiz_round_items set status='answered',answered_option=$2,answered_at=now(),closed_at=now() where attempt_id=$1", [a, i - expiredCount < rightCount ? qrow.correct_option : wrong]);
  }
  return one('select responders,right_count,timeouts,difficulty,flags from public.sport_quiz_question_stats where question_id=$1', [q]);
};
await test('flags need 30 distinct accounts (admins and the author excluded): too easy at 95%, too long at 40% time-outs; difficulty easy / hard', async () => {
  const easy = await approved('Fencing');
  let s = await responders(easy.id, 28, 0, 29); assert.equal(s.responders, 29); assert.deepEqual(s.flags, []); assert.equal(s.difficulty, null);
  await db.query("delete from public.sport_quiz_attempts where profile_id=any($1::uuid[]) and topic_category='sport' and week_start < $2::date - 60", [crowd.map(k => P[k]), week]);
  s = await responders(easy.id, 29, 0, 30, ['admin2']); assert.equal(s.responders, 30, 'the admin is not counted'); assert.ok(s.flags.includes('too_easy')); assert.equal(s.difficulty, 'easy');
  const slow = await approved('Fencing');
  await db.query("delete from public.sport_quiz_attempts where profile_id=any($1::uuid[]) and week_start < $2::date - 60", [crowd.map(k => P[k]), week]);
  s = await responders(slow.id, 10, 12, 30); assert.ok(s.flags.includes('too_long')); assert.equal(s.difficulty, 'hard');
  assert.ok((await admin('public.quiz_admin_needs_look()')).questions.some(x => x.question_id === slow.id && x.responders === 30 && x.timeout_pct === 40));
});
await test('"confusing" depends on the type: 33% right flags true / false (35% or fewer) but not four choices (15% or fewer)', async () => {
  const tf = await approved('Fencing', { question_type: 'true_false', options: ['True', 'False'], correct_option: 0 });
  const c4 = await approved('Fencing');
  await db.query("delete from public.sport_quiz_attempts where profile_id=any($1::uuid[]) and week_start < $2::date - 60", [crowd.map(k => P[k]), week]);
  const a = await responders(tf.id, 10, 0, 30); assert.ok(a.flags.includes('confusing'));
  await db.query("delete from public.sport_quiz_attempts where profile_id=any($1::uuid[]) and week_start < $2::date - 60", [crowd.map(k => P[k]), week]);
  const b = await responders(c4.id, 10, 0, 30); assert.ok(!b.flags.includes('confusing')); assert.equal(b.difficulty, 'hard');
  await db.query("delete from public.sport_quiz_attempts where profile_id=any($1::uuid[]) and week_start < $2::date - 60", [crowd.map(k => P[k]), week]);
  const c = await responders(c4.id, 4, 0, 30); assert.ok(c.flags.includes('confusing'));
});
await test('at most two hard questions per round, and group sets choose at most two hard without reading members\' history', async () => {
  const hard = []; for (let i = 0; i < 3; i++) hard.push(await approved('Polo'));
  for (let i = 0; i < 3; i++) await approved('Polo');
  for (const h of hard) await db.query("insert into public.sport_quiz_question_stats(question_id,difficulty,responders,updated_at) values($1,'hard',30,now()) on conflict (question_id) do update set difficulty='hard'", [h.id]);
  const k = take(); const r = await start(k, { sport: 'Polo' });
  let pos = 1; while (pos < r.attempt.planned_items) { await answerAt(k, r.attempt.id, 0); await next(k, r.attempt.id, pos); pos++; }
  const nHard = (await one('select count(*)::int n from public.sport_quiz_round_items i where i.attempt_id=$1 and public.quiz_question_hard(i.question_id)', [r.attempt.id])).n;
  assert.ok(nHard <= 2, String(nHard));
  const g = await rpc('fan', 'public.quiz_group_create($1,$2,$3,$4)', ['family', 'Polo', randomUUID(), P.fan]);
  await db.query('select public.quiz_group_ensure_set($1,$2::date,5,now())', [g.group_id, week]);
  const setHard = (await one('select count(*)::int n from public.sport_quiz_group_sets s where s.group_id=$1 and public.quiz_question_hard(s.question_id)', [g.group_id])).n;
  assert.ok(setHard <= 2, String(setHard));
  assert.ok(!(await one("select pg_get_functiondef('public.quiz_group_ensure_set(uuid,date,integer,timestamptz)'::regprocedure) d")).d.includes('sport_quiz_exposures'));
});

// 9. Bulk import --------------------------------------------------------------------------------------------------------------
const row = (extra = {}) => ({ topic_category: 'sport', sport: 'Badminton', question_type: 'choice4', prompt: `Import fixture: badminton fact number ${++n}?`,
  options: ['Alpha', 'Beta', 'Gamma', 'Delta'], correct_option: 0, explanation: 'Alpha is the reviewed import fixture answer.', source_notes: 'Official rules reviewed for import.', ...extra });
const importRows = (rows, dry = true, key = 'admin') => rpc(key, 'public.quiz_admin_import($1::jsonb,$2,$3,$4)', [JSON.stringify(rows), dry, reason, P[key]]);
await test('bulk import: admin only, 200 rows / 64 KB, refusals (athlete, image, formula cells), dry run writes nothing', async () => {
  await assert.rejects(() => importRows([row()], true, 'fan'), /quiz_admin_only|quiz_identity_changed/);
  await assert.rejects(() => importRows(Array.from({ length: 201 }, () => row())), /quiz_import_too_large/);
  await assert.rejects(() => importRows([row({ explanation: 'x'.repeat(500), source_notes: 'y'.repeat(1000) }), ...Array.from({ length: 50 }, () => row({ explanation: 'x'.repeat(500), source_notes: 'y'.repeat(1000) }))]), /quiz_import_too_large/);
  const before = (await one('select count(*)::int n from public.sport_quiz_questions')).n;
  const out = await importRows([row(), row({ topic_category: 'athlete' }), row({ question_type: 'image_choice' }), row({ options: ['=SUM(A1)', 'Beta', 'Gamma', 'Delta'] }), row({ prompt: '+cmd injection prompt here' }),
    row({ topic_category: 'life', chapter: 'money_huddle', sport: undefined, prompt: 'A budget plans spending before money is gone, right?', options: ['True', 'False'], question_type: 'true_false', correct_option: 0, explanation: 'True. A budget is a plan made before spending.' })]);
  assert.equal((await one('select count(*)::int n from public.sport_quiz_questions')).n, before, 'dry run writes nothing');
  assert.deepEqual(out.rows.map(r => r.status), ['ready', 'refused', 'refused', 'refused', 'refused', 'ready']);
  assert.ok(out.rows[1].problems.includes('athlete_row')); assert.ok(out.rows[2].problems.includes('image_row'));
  assert.ok(out.rows[3].problems.includes('formula_cell')); assert.ok(out.rows[4].problems.includes('formula_cell'));
  assert.equal((await one("select count(*)::int n from pg_proc where proname like '%approve_all%'")).n, 0, 'no approve-all');
});
await test('bulk import duplicates: exact after cleanup blocks (any status, version, topic, and within the batch); near match warns; rows land as shuffled drafts', async () => {
  const existing = await one("select prompt from public.sport_quiz_questions where status='archived' limit 1");
  const shout = existing.prompt.toUpperCase().replace('?', ' ??');
  const p1 = 'Import fixture: which shuttle speed is the fastest one?';
  const out = await importRows([row({ prompt: shout }), row({ prompt: p1 }), row({ prompt: p1.toLowerCase() }), row({ prompt: 'Import fixture: which shuttle speed is the fastest one here?' })], false);
  assert.deepEqual(out.rows.map(r => r.status), ['refused', 'imported', 'refused', 'imported']);
  assert.ok(out.rows[0].problems.includes('duplicate')); assert.ok(out.rows[2].problems.includes('duplicate_in_batch'));
  assert.ok(['near_duplicate', 'near_duplicate_in_batch'].includes(out.rows[3].warnings[0]?.code));
  const drafts = (await db.query('select status,options,correct_option from public.sport_quiz_questions where id=any($1::uuid[])', [[out.rows[1].id, out.rows[3].id]])).rows;
  assert.ok(drafts.every(d => d.status === 'draft' && d.options[d.correct_option] === 'Alpha'));
  assert.equal((await one('select rows_imported from public.sport_quiz_imports order by created_at desc limit 1')).rows_imported, 2);
  const near = await importRows([row({ prompt: 'Import fixture: which shuttle speed is the fastest one now?' })]);
  assert.ok(near.rows[0].warnings.some(w => w.code === 'near_duplicate'));
});
await test('bulk import respects the 300 version cap', async () => {
  const active = (await one("select count(*)::int n from public.sport_quiz_questions where status in ('draft','approved') and topic_category not in ('life','athlete')")).n;
  await db.query(`insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,topic_category,source_notes,question_type)
    select gen_random_uuid(),1,'Filler','Cap filler prompt number ' || g || ' for the import cap?','["A","B","C","D"]'::jsonb,0,'Filler explanation text.','Cap filler fixture rows.','sport','Fixture source notes.','choice4'
    from generate_series(1,$1) g`, [299 - active]);
  const out = await importRows([row(), row()], true);
  assert.deepEqual(out.rows.map(r => r.status), ['ready', 'refused']); assert.ok(out.rows[1].problems.includes('bank_full'));
  await db.query("update public.sport_quiz_questions set status='archived' where sport='Filler'");
});

// 10. Needs a look → Edit, settings, snapshot, counts, export ---------------------------------------------------------------------
await test('Edit from Needs a look: edit_replace replaces an approved question that needs a look; refused for one that does not', async () => {
  const q = await approved('Archery');
  await assert.rejects(() => question(q.id, 'edit_replace', { ...base('Archery'), family_action: 'existing', question_key: q.question_key }), /quiz_replace_draft_only/);
  await db.query("insert into public.sport_quiz_question_stats(question_id,flags,updated_at) values($1,'{too_easy}',now())", [q.id]);
  const r = await question(q.id, 'edit_replace', { ...base('Archery'), family_action: 'existing', question_key: q.question_key });
  assert.equal(r.status, 'draft'); assert.equal(r.replaced_status, 'archived');
  const flagged = await approved('Archery');
  await db.query("insert into public.sport_quiz_question_stats(question_id,flags,updated_at) values($1,'{confusing}',now())", [flagged.id]);
  await admin('public.quiz_admin_needs_look_action($1,$2,$3,$4)', [flagged.id, 'dismiss', reason, P.admin]);
  assert.equal((await one('select public.quiz_needs_look($1) x', [flagged.id])).x, false);
});
await test('settings: share 0–10 and the self-heal bounds are enforced; switch and intake pause are audited; fun-fact questions never hit the cap', async () => {
  await assert.rejects(() => fresh({ athlete_share_pct: 11 }), /quiz_settings_invalid/);
  await assert.rejects(() => fresh({ self_heal: { ...HEAL, min_responders: 5 } }), /quiz_settings_invalid/);
  await assert.rejects(() => fresh({}, 'fan'), /quiz_admin_only|quiz_identity_changed/);
  const s = await fresh({ athlete_share_pct: 0, athlete_questions_enabled: false });
  assert.equal(s.athlete_share_pct, 0); assert.equal(s.report_rules.daily_pause_cap, 10);
  assert.equal((await one("select athlete_questions_enabled e,athlete_share_pct p from public.sport_quiz_settings")).e, false);
  assert.ok((await one("select count(*)::int n from public.sport_quiz_audit where action='fresh_settings'")).n >= 3);
});
await test('snapshot: weeks left per topic, sport and Life chapter with Refill needed under 4 weeks', async () => {
  const snap = await admin('public.quiz_admin_snapshot()');
  const geo = snap.refill.find(r => r.scope === 'topic' && r.key === 'geography');
  assert.equal(geo.approved, 0); assert.equal(geo.weeks_left, 0); assert.equal(geo.refill_needed, true);
  const bb = snap.refill.find(r => r.scope === 'sport' && r.key === 'Basketball'); assert.ok(bb && typeof bb.weeks_left === 'number');
  assert.equal(snap.refill.filter(r => r.scope === 'chapter').length, 4);
  assert.ok(snap.refill.every(r => r.refill_needed === (r.weeks_left < 4)));
  assert.ok(!JSON.stringify(snap.refill).match(/[0-9a-f]{8}-[0-9a-f]{4}/), 'content counts only');
});
await test('athlete counts: completed months only, under 5 hidden, 5+ / 10+ / 25+, athlete, guardian, admins and the testing group excluded', async () => {
  await fresh();
  const f2 = (await submit('ath16', 'pregame_ritual', 'Two minutes of quiet')).fact.id;
  await assert.rejects(() => submit('ath16', 'pregame_ritual', 'Two minutes of quiet'), /quiz_fact_prompt_taken|quiz_fact_text/);
  const fid = (await one("select id from public.quiz_athlete_facts where athlete_id=$1 and prompt_key='hidden_talent'", [P.ath16])).id;
  await approveFact(fid);
  const q = await factQuestion(fid);
  const lastMonth = (await one("select (date_trunc('month', now() at time zone 'UTC') - interval '1 month' + interval '3 days')::timestamptz t")).t;
  const seenBy = async who => { for (const k of who) {
    const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,position,planned_items,round_size,topic_category,round_kind,closed_at,close_reason,completed_at)
      values($1,date_trunc('week',$2::timestamptz at time zone 'UTC')::date - 7 * $3,'completed',$2,'round',90,$2,$2::timestamptz+interval '90 seconds',1,1,5,'sport','personal',$2,'answered',$2) returning id`, [P[k], lastMonth, ++weekBack])).id;
    await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) select $1,1,id,question_key,$3,$3::timestamptz + interval '90 seconds',0,$3,'answered',$3 from public.sport_quiz_questions where id=$2", [a, q, lastMonth]);
  } };
  const bucket = async () => (await rpc('ath16', 'public.quiz_fact_counts()')).facts.find(x => x.id === fid).months[0].bucket;
  await seenBy([...crowd.slice(0, 4), 'admin2', 'c1']); // c1 is in the testing group, admin2 an admin
  assert.equal(await bucket(), null, 'under 5 counted fans: hidden');
  await seenBy([crowd[4]]); assert.equal(await bucket(), '5+');
  await seenBy(crowd.slice(5, 10)); assert.equal(await bucket(), '10+');
  await seenBy(crowd.slice(10, 25)); assert.equal(await bucket(), '25+');
  const months = (await rpc('ath16', 'public.quiz_fact_counts()')).facts[0].months;
  assert.equal(months.length, 3); assert.ok(!months.some(m => m.month === new Date().toISOString().slice(0, 7)), 'completed months only');
  assert.ok(!JSON.stringify(await rpc('ath16', 'public.quiz_fact_counts()')).includes(P[crowd[0]]));
  assert.ok(f2);
});
await test('athlete export lists every fact and decision; withdrawn text is gone', async () => {
  const x = await rpc('athA', 'public.quiz_fact_export()');
  assert.ok(x.facts.length >= 3);
  const w = x.facts.find(f => f.status === 'withdrawn'); assert.equal(w.answer_text, null); assert.ok(w.cleared_at); assert.equal(w.admin_decision, 'approved');
  assert.ok(x.facts.some(f => f.status === 'admin_review' && f.answer_text === 'Paddle boarding'));
  const t = await rpc('athT', 'public.quiz_fact_export()'); assert.equal(t.facts[0].guardian_decision, 'approved');
});
// 11. Security review (RLS_SECURITY panel, 2026-10-15): the reviewer's probes in /tmp/q5probe as replay checks ----------------
const look = async (text, prompt = 'hidden_talent') => (await one('select public.quiz_fact_look_reasons($1,$2) r', [text, prompt])).r;
const probeText = async (text, prompt = 'hidden_talent', who = 'athA') => (await one('select public.quiz_fact_text_problems($1,$2,$3) p', [text, prompt, P[who]])).p;
await test('review P3: the filter refuses spaced / swapped profanity, lookalike letters, spelled contacts and schedules; school and team words (P2); borderline cases are look reasons', async () => {
  const refused = [['Kahuku', 'school_or_city'], ['Go Raiders', 'school_or_city'], ['Red Raiders fan', 'school_or_city'], ['f u c k', 'not_okay_word'], ['sh!t talk', 'not_okay_word'],
    ['shıt talk', 'not_okay_word'], ['b i t c h', 'not_okay_word'], ['Phuck', 'not_okay_word'], ['lani dot com', 'link'], ['insta lanihoops', 'handle_or_email'],
    ['snap lani hoops', 'handle_or_email'], ['lani at gmail', 'handle_or_email'], ['five five five oh one', 'digits'], ['Sat mornings', 'weekday_or_time'],
    ['seven pm sharp', 'weekday_or_time'], ['Main St near beach', 'address']];
  for (const [text, code] of refused) assert.ok((await probeText(text)).includes(code), `${text} → ${code}`);
  assert.deepEqual(await probeText('High jump drills'), [], 'generic school words (high, school…) alone are not refused');
  assert.deepEqual(await probeText('after school daily'), []); assert.ok((await look('after school daily')).includes('schedule_or_place_words'));
  assert.ok((await look('d a m n good')).includes('hidden_word'));
});
await test('re-review P2: ordinary answers pass (words inside words, sport and team words, bare street words, "oh oh oh"); the bypass list above still refuses', async () => {
  await db.query("update public.players set team='Varsity Football' where id=$1", [PL.ath16]);
  const ok = ['Crush it', 'Push It', 'Brush it off', 'Dish it out', 'Making sushi tacos', 'Matsushita radios', 'Scunthorpe', 'Football juggling', 'Varsity spirit',
    'Court vision', 'Drive to the hoop', 'Thunder Road', 'Oh oh oh'];
  for (const text of ok) assert.deepEqual(await probeText(text, 'hype_song', 'ath16'), [], text);
  assert.ok((await probeText('Kahuku', 'hype_song', 'ath16')).includes('school_or_city'), 'distinctive school words still refuse');
  for (const text of ['Matsushita radios', 'Scunthorpe']) assert.ok((await look(text, 'hype_song')).includes('hidden_word'), text);
  assert.ok((await look('Thunder Road', 'hype_song')).includes('possible_address'));
  assert.ok((await look('seven three one', 'hype_song')).includes('spelled_numbers'));
  for (const [text, code] of [['f u c k', 'not_okay_word'], ['sh!t talk', 'not_okay_word'], ['Main St near beach', 'address'], ['five five five oh one', 'digits'],
    ['nine one oh oh oh oh one', 'digits'], ['12 Kam Road', 'address'], ['five-five-five-one-two-three-four', 'digits'], ['five.five.five.one', 'digits'],
    ['fuuuck', 'not_okay_word'], ['biatch please', 'not_okay_word'], ['shiiiit yeah', 'not_okay_word']]) assert.ok((await probeText(text, 'hype_song', 'ath16')).includes(code), `${text} → ${code}`);
});
await test('review P3: a timed-out fun fact is re-checked before the reveal: after an unfollow it shows "Not available", no positions and no athlete card', async () => {
  const w = take(); await friends('athD', w); await follow(w, 'athD');
  const r = await start(w); const slot = await slotOf(w, r.attempt.id); const q = await playTo(w, r, slot);
  assert.equal(q.topic_category, 'athlete');
  await db.query('delete from public.crew_follows where follower_id=$1', [ids[w]]);
  await db.query("update public.sport_quiz_round_items set issued_at=now()-interval '100 seconds',expires_at=now()-interval '1 second' where attempt_id=$1 and position=$2", [r.attempt.id, slot]);
  await db.query("update public.sport_quiz_attempts set expires_at=now()-interval '1 second' where id=$1", [r.attempt.id]);
  const it = (await one('select public.quiz_round_items_dto($1, now()) d', [r.attempt.id])).d.find(x => x.position === slot);
  assert.equal(it.result.item_status, 'fact_unavailable'); assert.equal(it.result.correct_position, null); assert.equal(it.result.shown_order, null);
  assert.equal(it.result.fun_fact, undefined); assert.ok(it.question.options.includes('Not available')); assert.ok(!JSON.stringify(it).includes('Yo-yo tricks'));
  assert.equal(it.question.fun_fact.first_name, null);
});
await test('review P3: bank archive / void of a fun-fact question is refused; Needs a look Archive declines the fact and voids its question', async () => {
  const fq = await factQuestion(factD.id);
  for (const action of ['archive', 'void']) await assert.rejects(() => question(fq, action, { reason }), /quiz_fact_admin_path/);
  await admin('public.quiz_admin_needs_look_action($1,$2,$3,$4)', [fq, 'archive', reason, P.admin]);
  assert.equal((await one('select status from public.quiz_athlete_facts where id=$1', [factD.id])).status, 'declined');
  assert.equal((await one('select status from public.sport_quiz_questions where id=$1', [fq])).status, 'void');
});
await test('review P2: a counted "Not okay" / "Shares something private" on a fun fact pauses it even past the daily cap, and the alert is recorded', async () => {
  const f = (await submit('athD', 'other_sport', 'Canoe racing')).fact; await approveFact(f.id); const fq = await factQuestion(f.id);
  const rulesDef = (await one("select pg_get_functiondef('public.quiz_report_rules()'::regprocedure) d")).d;
  await db.exec(`create or replace function public.quiz_report_rules() returns jsonb language sql immutable set search_path = '' as $$ select ${"'"}{"ordinary_reporters":2,"fact_reporters":1,"fact_reasons":["not_okay","private"],"restored_reporters":3,"daily_pause_cap":0,"min_account_days":7,"per_account_per_day":10,"reporter_clear_days":90,"delete_days":180}${"'"}::jsonb $$`);
  try {
    const a = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,position,planned_items,round_size,topic_category,round_kind,closed_at,close_reason,completed_at)
      values($1,($2::date - 7 * $3),'completed',now(),'round',90,now(),now()+interval '90 seconds',1,1,5,'sport','personal',now(),'answered',now()) returning id`, [P.rep3, week, ++weekBack])).id;
    await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) select $1,1,id,question_key,now(),now()+interval '90 seconds',0,now(),'answered',now() from public.sport_quiz_questions where id=$2", [a, fq]);
    await report('rep3', fq, 'private');
  } finally { await db.exec(rulesDef); }
  const st = await one('select paused_at,pause_reason,queued_at from public.sport_quiz_question_stats where question_id=$1', [fq]);
  assert.ok(st.paused_at); assert.equal(st.pause_reason, 'fact_report'); assert.equal(st.queued_at, null);
  assert.equal((await one("select count(*)::int n from public.sport_quiz_audit where action='report_alert' and reason='athlete'")).n, 1);
});
await test('review P3: import trims tabs, returns and full-width forms before the formula check, and refuses lookalike-letter duplicates', async () => {
  const ex = (await one("select prompt from public.sport_quiz_questions where topic_category='sport' and status='approved' limit 1")).prompt;
  const r = await importRows([row({ explanation: '\t=HYPERLINK("http://x.example","click")' }), row({ source_notes: '\r=1+1 reviewed source' }),
    row({ explanation: '＝1+1 explanation text' }), row({ prompt: ex.replace(/a/g, 'а') })]);
  assert.deepEqual(r.rows.map(x => x.status), ['refused', 'refused', 'refused', 'refused']);
  for (const i of [0, 1, 2]) assert.ok(r.rows[i].problems.includes('formula_cell'), String(i));
  assert.ok(r.rows[3].problems.includes('non_latin_text') && r.rows[3].problems.includes('duplicate'));
});
await test('review P3: only a validated Learn-card athlete skips the fun-slot rotation (an unknown id does not)', async () => {
  await approved('Science', { topic_category: 'science', sport: 'Science' });
  const def = (await one("select pg_get_functiondef('public.quiz_fun_slot(uuid,date)'::regprocedure) d")).d;
  await db.exec("create or replace function public.quiz_fun_slot(p_me uuid,p_week date) returns boolean language sql stable security definer set search_path='' as $$ select true $$");
  try {
    const k = take();
    await assert.rejects(() => start(k), /quiz_topic_not_allowed/);
    await assert.rejects(() => rpc(k, 'public.quiz_learn_start($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), 'Basketball', 90, week, NOTICE, randomUUID(), secret, P[k]]), /quiz_topic_not_allowed/);
    assert.equal((await learnStart(k, 'athA')).outcome, 'started');
  } finally { await db.exec(def); }
});
await test('review P3: declined fun-fact text is purged 30 days after the decision by retention; the decision stays in the export', async () => {
  const d = (await submit('athT', 'other_sport', 'Water polo')).fact;
  await rpc('gT', 'public.quiz_fact_guardian_decide($1,false,$2)', [d.id, P.gT]);
  await db.query("update public.quiz_athlete_facts set guardian_decided_at=now()-interval '31 days',updated_at=now()-interval '31 days' where id=$1", [d.id]);
  const out = await admin('public.quiz_admin_retention($1,$2)', [reason, P.admin]); assert.ok(out.purged_declined_facts >= 1);
  assert.deepEqual(await one('select status,answer_text,clear_cause from public.quiz_athlete_facts where id=$1', [d.id]), { status: 'declined', answer_text: null, clear_cause: 'declined_purged' });
  const x = (await rpc('athT', 'public.quiz_fact_export()')).facts.find(f => f.id === d.id); assert.equal(x.decline_reason, 'guardian'); assert.equal(x.answer_text, null);
});
await test('review P3: the fun-fact pick respects the two-hard limit', async () => {
  const f = (await submit('ath16', 'pro_athlete', 'Kawhi Leonard')).fact; await approveFact(f.id); const fq = await factQuestion(f.id);
  const v = take(); await friends('ath16', v); await follow(v, 'ath16');
  const nextWeek = (await one("select ($1::date + 7)::text d", [week])).d;
  const syn = (await one(`insert into public.sport_quiz_attempts(profile_id,week_start,status,issued_at,mode,duration_seconds,started_at,expires_at,round_state,next_by,position,planned_items,round_size,topic_category,round_kind,session_hash)
    values($1,$2::date,'issued',now(),'round',90,now(),now()+interval '90 seconds','between',now()+interval '2 minutes',2,5,5,'sport','personal',$3) returning id`, [P[v], nextWeek, 'c'.repeat(64)])).id;
  const hard = [await approved('Squash'), await approved('Squash')];
  for (const [i, h] of hard.entries()) {
    await db.query("insert into public.sport_quiz_round_items(attempt_id,position,question_id,question_key,issued_at,expires_at,answered_option,answered_at,status,closed_at) values($1,$2,$3,$4,now(),now()+interval '90 seconds',0,now(),'answered',now())", [syn, i + 1, h.id, h.question_key]);
    await db.query("insert into public.sport_quiz_question_stats(question_id,difficulty,responders,updated_at) values($1,'hard',30,now()) on conflict (question_id) do update set difficulty='hard'", [h.id]);
  }
  assert.equal((await one('select public.quiz_round_hard_count($1) n', [syn])).n, 2);
  // Every fun fact of this athlete is hard, so none may be the round's third hard question.
  for (const x of (await db.query("select q.id from public.sport_quiz_questions q join public.quiz_athlete_facts f on f.id=q.fact_id where f.athlete_id=$1 and q.status='approved'", [P.ath16])).rows)
    await db.query("insert into public.sport_quiz_question_stats(question_id,difficulty,responders,updated_at) values($1,'hard',30,now()) on conflict (question_id) do update set difficulty='hard'", [x.id]);
  assert.equal((await one('select public.quiz_fact_pick($1,$2) q', [P[v], syn])).q, null, 'a third hard question is never drawn');
  await db.query("update public.sport_quiz_question_stats set difficulty='medium' where question_id=$1", [fq]);
  assert.equal((await one('select public.quiz_fact_pick($1,$2) q', [P[v], syn])).q, fq, 'the one fact that is not hard can be drawn');
  await db.query('delete from public.sport_quiz_attempts where id=$1', [syn]);
});
await test('review P3: athlete counts drop viewers blocked either way; a block clears the athlete card from saved receipts between the pair', async () => {
  const fid = (await one("select id from public.quiz_athlete_facts where athlete_id=$1 and prompt_key='hidden_talent'", [P.ath16])).id;
  const bucket = async () => (await rpc('ath16', 'public.quiz_fact_counts()')).facts.find(x => x.id === fid).months[0].bucket;
  assert.equal(await bucket(), '25+');
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P[crowd[0]], P.ath16]);
  assert.equal(await bucket(), '10+', 'a viewer who blocked the athlete is not counted');
  const cards = async () => (await one("select count(*)::int n from public.sport_quiz_requests where profile_id=$1 and receipt->'result'->'fun_fact'->>'athlete_player_id'=$2", [P[drawn.v], PL.athA])).n;
  assert.ok(await cards() >= 1, 'the answer receipt kept the athlete card');
  await db.query('insert into public.user_blocks(blocker_id,blocked_id) values($1,$2)', [P.athA, P[drawn.v]]);
  assert.equal(await cards(), 0);
});
await test('review P3: after the guardian approves, the teen cannot edit or cancel; withdraw and resubmit goes back to the guardian; direct writes are denied', async () => {
  const f = (await submit('athTB', 'hidden_talent', 'Ocean swimming')).fact;
  await rpc('gT', 'public.quiz_fact_guardian_decide($1,true,$2)', [f.id, P.gT]);
  await assert.rejects(() => submit('athTB', 'hidden_talent', 'Something else'), /quiz_fact_prompt_taken/);
  const req = await one('select id from public.guardian_approval_requests where change_key=$1', [`fun_fact:${f.id}`]);
  await assert.rejects(() => rpc('athTB', 'public.cancel_my_approval_request($1)', [req.id]), /already handled/);
  await rpc('athTB', 'public.quiz_fact_withdraw($1,$2)', [f.id, P.athTB]);
  assert.equal((await submit('athTB', 'hidden_talent', 'Lei making crafts')).fact.status, 'guardian_review');
  await assert.rejects(() => actor('athTB', "update public.guardian_approval_requests set status='approved' where minor_id=$1", [P.athTB]), /permission denied/);
});
await test('reads do not write; the migration re-applies over live data without changing it; QUIZ-04 refuses a lone re-run after QUIZ-05', async () => {
  const tables = ['public.quiz_athlete_facts', 'public.sport_quiz_question_stats', 'public.sport_quiz_reports', 'public.sport_quiz_imports', 'public.sport_quiz_questions', 'public.sport_quiz_settings'];
  const state = async () => Object.fromEntries(await Promise.all(tables.map(async t => [t, (await db.query(`select to_jsonb(x) r from ${t} x order by to_jsonb(x)::text`)).rows])));
  const before = await state();
  await admin('public.quiz_admin_snapshot()'); await admin('public.quiz_admin_needs_look()'); await admin('public.quiz_admin_fact_queue()');
  await rpc('athA', 'public.quiz_fact_mine()'); await rpc('ath16', 'public.quiz_fact_counts()'); await rpc('gT', 'public.quiz_fact_guardian_pending()');
  await importRows([row()], true);
  await assert.rejects(() => db.exec(fs.readFileSync('supabase/migrations/20261014180000_life_playbook.sql', 'utf8')), /quiz_rerun_after_quiz05/);
  await db.exec(fs.readFileSync('supabase/migrations/20261015210000_trivia_fresh_questions.sql', 'utf8'));
  assert.deepEqual(await state(), before);
});

await test('review P1: MINOR-01 alone after QUIZ-05 stops; its own decision function fails closed for fun_fact; the QUIZ-05 routing keeps the teen\'s friend setting, moves the fact and keeps fun_facts_shared', async () => {
  const minor01 = fs.readFileSync('supabase/migrations/20261014110000_minor_accounts.sql', 'utf8');
  await assert.rejects(() => db.exec(minor01), /minor01_rerun_after_quiz05/);
  const f = (await submit('athTB', 'other_sport', 'Outrigger paddling')).fact; assert.equal(f.status, 'guardian_review');
  const req = (await one("select id from public.guardian_approval_requests where change_key=$1 and status='pending'", [`fun_fact:${f.id}`])).id;
  const friendSetting = async () => (await one('select friend_requests_from f from public.profiles where id=$1', [P.athTB])).f;
  const before = await friendSetting();
  // As a schema.sql re-apply leaves it before the QUIZ blocks run again: MINOR-01's own function refuses the fun_fact key.
  await db.exec("select set_config('quiz.full_schema','on',false)");
  try { await db.exec(minor01); } finally { await db.exec("select set_config('quiz.full_schema','',false)"); }
  await assert.rejects(() => rpc('gT', 'public.guardian_decide_approval($1,true)', [req]), /cannot be decided here/);
  assert.equal(await friendSetting(), before); assert.equal((await one('select status from public.quiz_athlete_facts where id=$1', [f.id])).status, 'guardian_review');
  // Then QUIZ-05 runs again (as schema.sql does next): the guardian's approval moves the fact and changes no privacy setting.
  await db.exec(fs.readFileSync('supabase/migrations/20261015210000_trivia_fresh_questions.sql', 'utf8'));
  await rpc('gT', 'public.guardian_decide_approval($1,true)', [req]);
  assert.equal(await friendSetting(), before);
  assert.equal((await one('select status from public.quiz_athlete_facts where id=$1', [f.id])).status, 'admin_review');
  const sup = await rpc('athTB', 'public.get_my_supervision()');
  assert.equal(typeof sup.summary.fun_facts_shared, 'number'); assert.equal(typeof sup.summary.trivia_groups, 'number');
});

console.log(JSON.stringify({ passed: tests.filter(t => t.pass).length, total: tests.length }, null, 0));
await db.close();
process.exitCode = tests.some(t => !t.pass) ? 1 : 0;
