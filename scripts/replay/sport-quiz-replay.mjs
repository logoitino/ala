#!/usr/bin/env node
/**
 * QUIZ-01 real Postgres actor replay: weekly learning is private, optional and testing-only.
 * Uses the schema replay's Supabase bootstrap and cached PGlite; no hosted calls or package installs.
 * @sideEffects Creates and destroys an in-memory database, then prints actual assertions.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const dist = process.argv[2] || '/tmp/books01-pg/pkg/package/dist';
const schemaPath = process.argv[3] || 'apps/mobile/src/backend/db/schema.sql';
const migrationPath = 'supabase/migrations/20261014140000_sport_pop_quiz.sql';
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const bootstrap = fs.readFileSync('scripts/replay/schema-replay.mjs', 'utf8').match(/const SUPABASE_STUBS = String.raw`([\s\S]*?)`;/)?.[1];
assert.ok(bootstrap, 'existing Supabase bootstrap is available');
await db.exec(bootstrap);
await db.exec(fs.readFileSync(schemaPath, 'utf8'));
if (fs.existsSync(migrationPath)) await db.exec(fs.readFileSync(migrationPath, 'utf8'));

const ids = Object.fromEntries(['admin', 'fan', 'teen', 'other', 'unknown', 'closed'].map((key, i) => [key, `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`]));
const year = Number((await db.query('select extract(year from current_date)::int as y')).rows[0].y);
for (const [key, id] of Object.entries(ids)) {
  const meta = key === 'unknown' ? {} : { birth_year: year - (key === 'teen' ? 15 : 30), birth_month: 1 };
  await db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)', [id, JSON.stringify(meta)]);
}
await db.query("update public.profiles set role = 'admin', is_admin = true where user_id = $1", [ids.admin]);
await db.query('update public.profiles set age_blocked_at = now() where user_id = $1', [ids.closed]);
const profiles = Object.fromEntries((await db.query('select user_id, id from public.profiles')).rows.map(r => [Object.keys(ids).find(k => ids[k] === r.user_id), r.id]));
const actor = async (key, sql, args = []) => {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${key === 'anon' ? 'anon' : 'authenticated'}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(key === 'anon' ? { role: 'anon' } : { role: 'authenticated', sub: ids[key] })]);
    const result = (await db.query(sql, args)).rows;
    await db.exec('commit');
    return result;
  } catch (error) { await db.exec('rollback'); throw error; }
};
const rpc = async (key, sql, args = []) => (await actor(key, `select ${sql} as result`, args))[0].result;
const tests = [];
const test = async (name, work) => {
  try { await work(); tests.push({ name, pass: true }); }
  catch (error) { tests.push({ name, pass: false, detail: error.message }); }
};
const denied = (key, sql, args = []) => assert.rejects(() => rpc(key, sql, args), /quiz_|permission denied/);
const snapshot = (key = 'fan') => rpc(key, 'public.quiz_snapshot()');
const admin = (sql, args = []) => rpc('admin', sql, args);
const questionPayload = {
  sport: 'American football', prompt: 'How many points is a touchdown before any conversion?',
  options: ['3', '6', '7', '2'], correct_option: 1,
  explanation: 'A touchdown scores six points. Extra-point and two-point attempts are separate.',
  reason: 'Draft learning example; content owner must review.'
};
const question = (id, action, payload) => admin('public.quiz_admin_question($1::uuid, $2, $3::jsonb)', [id, action, JSON.stringify(payload)]);
const settings = (enabled, testers = [profiles.fan, profiles.teen]) => admin('public.quiz_admin_settings($1::jsonb, $2)', [JSON.stringify({ enabled, pilot_accounts: testers }), 'Local test audience reviewed.']);

await test('settings start paused with no enrolled testers and draft seeds', async () => {
  const s = await snapshot(); assert.equal(s.availability, 'paused'); assert.equal(s.attempt, null); assert.deepEqual(s.sports, []);
  const a = await admin('public.quiz_admin_snapshot()'); assert.equal(a.settings.enabled, false); assert.equal(a.settings.testing_only, true);
  assert.deepEqual(a.settings.pilot_accounts, []); assert.ok(a.questions.length > 0); assert.ok(a.questions.every(q => q.status === 'draft'));
});
// RED before the migration: a real missing quiz_snapshot, not a mock or a missing module.
if (!fs.existsSync(migrationPath)) { console.log(tests); await db.close(); process.exit(1); }

await test('canonical profile ids differ from auth ids', async () => assert.notEqual(profiles.fan, ids.fan));
await test('guest cannot call quiz RPCs', async () => { await denied('anon', 'public.quiz_snapshot()'); await denied('anon', "public.quiz_start('American football')"); });
await test('fan cannot read admin bank or change settings', async () => { await denied('fan', 'public.quiz_admin_snapshot()'); await denied('fan', "public.quiz_admin_settings('{}'::jsonb, 'test')"); });
await test('direct table reads/writes and private helpers are denied', async () => {
  for (const table of ['settings', 'questions', 'attempts', 'badges', 'audit']) {
    await assert.rejects(() => actor('fan', `select * from public.sport_quiz_${table}`), /permission denied/);
    await assert.rejects(() => actor('fan', `delete from public.sport_quiz_${table}`), /permission denied/);
  }
  await denied('fan', 'public.quiz_actor()');
});
await test('enable requires a nonempty bounded canonical tester list', async () => {
  await assert.rejects(() => settings(true, []), /quiz_/);
  await assert.rejects(() => settings(true, [ids.fan]), /quiz_/);
  await assert.rejects(() => settings(true, Array(101).fill(profiles.fan)), /quiz_/);
  await assert.rejects(() => admin('public.quiz_admin_settings($1::jsonb,$2)', [JSON.stringify({ enabled: false, pilot_accounts: [], testing_only: false }), 'Not allowed to launch.']), /quiz_/);
});
let q1;
await test('draft content has no available sport until explicit approval', async () => {
  q1 = await question(null, 'create', questionPayload); await settings(true);
  assert.deepEqual((await snapshot()).sports, []);
  await assert.rejects(() => rpc('fan', "public.quiz_start('American football')"), /quiz_no_question/);
  await question(q1.id, 'approve', { reason: 'Verified six-point touchdown under American football rules.' });
  assert.deepEqual((await snapshot()).sports, ['American football']);
});
await test('unknown, closed and unenrolled accounts cannot participate', async () => {
  for (const key of ['unknown', 'closed', 'other']) {
    const s = await snapshot(key); assert.equal(s.attempt, null); assert.deepEqual(s.sports, []);
    assert.ok(['ineligible', 'not_enrolled'].includes(s.availability));
    await denied(key, "public.quiz_start('American football')"); await denied(key, 'public.quiz_skip()');
  }
});
let attempt;
await test('one weekly random approved assignment exposes no answer', async () => {
  const s = await rpc('fan', "public.quiz_start('American football')"); attempt = s.attempt;
  assert.equal(s.status, 'issued'); assert.equal(attempt.question.version, 1); assert.equal(attempt.result, null);
  assert.equal('correct_option' in attempt.question, false); assert.equal('explanation' in attempt.question, false);
  assert.equal((await rpc('fan', "public.quiz_start('rugby')")).attempt.id, attempt.id);
  const rows = (await db.query('select count(*)::int as n from public.sport_quiz_attempts where profile_id=$1', [profiles.fan])).rows;
  assert.equal(rows[0].n, 1);
});
await test('another account and invalid options cannot answer the attempt', async () => {
  await denied('teen', 'public.quiz_answer($1, 0, gen_random_uuid())', [attempt.id]);
  for (const option of [-1, 4, null]) await denied('fan', 'public.quiz_answer($1, $2, gen_random_uuid())', [attempt.id, option]);
  await denied('fan', 'public.quiz_answer($1, 0, null)', [attempt.id]);
});
const request = '00000000-0000-0000-0000-000000001111';
let receipt;
await test('a wrong answer commits explanation and one private completion badge', async () => {
  receipt = await rpc('fan', 'public.quiz_answer($1, 0, $2)', [attempt.id, request]);
  assert.equal(receipt.status, 'completed'); assert.equal(receipt.attempt.result.was_correct, false);
  assert.equal(receipt.attempt.result.correct_option, 1); assert.ok(receipt.attempt.result.explanation.includes('six'));
  assert.equal(receipt.attempt.result.request_id, request); assert.equal(receipt.badges.length, 1);
  assert.equal(receipt.badges[0].label, 'Sport Learner'); assert.equal(receipt.badges[0].visibility, 'private');
  assert.equal((await db.query('select aura_points from public.profiles where id=$1', [profiles.fan])).rows[0].aura_points, 0);
});
await test('exact retry is stable but changed option or request rejects', async () => {
  const again = await rpc('fan', 'public.quiz_answer($1, 0, $2)', [attempt.id, request]);
  assert.deepEqual(again.attempt.result, receipt.attempt.result); assert.equal(again.badges.length, 1);
  await denied('fan', 'public.quiz_answer($1, 1, $2)', [attempt.id, request]);
  await denied('fan', 'public.quiz_answer($1, 0, gen_random_uuid())', [attempt.id]);
});
await test('skip dismisses the week and sport changes cannot start again', async () => {
  const s = await rpc('teen', 'public.quiz_skip()'); assert.equal(s.status, 'skipped'); assert.deepEqual(s.badges, []);
  assert.equal((await rpc('teen', "public.quiz_start('American football')")).status, 'skipped');
  assert.equal((await rpc('teen', 'public.quiz_skip()')).attempt.id, s.attempt.id);
  assert.equal((await rpc('fan', 'public.quiz_skip()')).status, 'completed');
});
await test('editing creates a new draft version and cannot rewrite issued content', async () => {
  const edit = await question(q1.id, 'edit', { ...questionPayload, prompt: 'Updated wording for the next approved version.', reason: 'Clarify context for a future assignment.' });
  assert.notEqual(edit.id, q1.id); assert.equal(edit.version, 2); assert.equal(edit.status, 'draft');
  const s = await snapshot(); assert.equal(s.attempt.question.prompt, questionPayload.prompt);
  await assert.rejects(() => db.query("update public.sport_quiz_questions set correct_option=3 where id=$1", [q1.id]), /quiz_immutable/);
});
await test('voiding an erroneous version hides badge and shows correction', async () => {
  await question(q1.id, 'void', { reason: 'Content owner found ambiguous wording; correcting the record.' });
  const s = await snapshot(); assert.equal(s.status, 'void'); assert.deepEqual(s.badges, []);
  assert.equal(s.attempt.result, null); assert.ok(s.corrections[0].reason.includes('ambiguous'));
  await denied('fan', 'public.quiz_answer($1, 0, $2)', [attempt.id, request]);
  await assert.rejects(() => question(q1.id, 'approve', { reason: 'Cannot restore a voided question.' }), /quiz_/);
});
await test('settings cannot activate production even as admin', async () => {
  await assert.rejects(() => db.exec('update public.sport_quiz_settings set testing_only=false'), /check constraint/);
  await settings(false); assert.equal((await snapshot()).availability, 'paused');
  await denied('fan', "public.quiz_start('American football')");
});
await test('audit is server attributed append-only and cursor paging loses no rows', async () => {
  const a = await admin('public.quiz_admin_snapshot()'); assert.ok(a.audit.some(x => x.action === 'question_void' && x.actor_id === profiles.admin));
  assert.equal(a.counts.badges_void, 1); assert.equal(a.counts.week_completed, 0);
  assert.ok(a.audit.every(x => !('option' in x) && !('profile_id' in x)));
  await assert.rejects(() => db.exec('delete from public.sport_quiz_audit'), /quiz_audit_immutable/);
  for (let i=0; i<55; i++) await settings(false);
  const first = await admin('public.quiz_admin_snapshot()'); assert.equal(first.audit.length, 50); assert.ok(first.next_before);
  const second = await admin('public.quiz_admin_snapshot($1::bigint)', [first.next_before]);
  assert.equal(new Set([...first.audit, ...second.audit].map(x => x.id)).size, first.audit.length + second.audit.length);
});
await test('week boundary prevents old answers and permits one new assignment', async () => {
  const draft = (await admin('public.quiz_admin_snapshot()')).questions.find(q => q.status === 'draft');
  await question(draft.id, 'approve', { reason: 'Verified factual question for local boundary rehearsal.' }); await settings(true);
  await db.exec("update public.sport_quiz_attempts set week_start=week_start-7 where profile_id is not null");
  await denied('fan', 'public.quiz_answer($1, 0, $2)', [attempt.id, request]);
  const s = await rpc('fan', `public.quiz_start('${draft.sport.replaceAll("'", "''")}')`); assert.equal(s.status, 'issued'); assert.notEqual(s.attempt.id, attempt.id);
});
await test('teen can complete an eligible private quiz without guardian or payee setup', async () => {
  const s = await rpc('teen', "public.quiz_start('American football')");
  const done = await rpc('teen', 'public.quiz_answer($1, 1, gen_random_uuid())', [s.attempt.id]);
  assert.equal(done.status, 'completed'); assert.equal(done.badges.length, 1); assert.equal(done.badges[0].visibility, 'private');
});
await test('revoking a tester hides issued questions and denies new participation; old badges remain own-scoped', async () => {
  await settings(true, [profiles.fan]);
  const s = await snapshot('teen'); assert.equal(s.availability, 'not_enrolled'); assert.equal(s.badges.length, 1);
  await denied('teen', "public.quiz_start('American football')");
  await denied('teen', 'public.quiz_answer($1,1,gen_random_uuid())', [s.attempt.id]);
  assert.equal((await snapshot('other')).badges.length, 0);
});
await test('paused enrolled accounts cannot start or answer, while an own completed badge stays visible', async () => {
  await settings(false,[profiles.fan,profiles.teen]);
  const s = await snapshot('teen'); assert.equal(s.availability,'paused'); assert.equal(s.badges.length,1);
  await denied('teen','public.quiz_answer($1,1,gen_random_uuid())',[s.attempt.id]);
  await denied('teen',"public.quiz_start('American football')");
});
await test('an issued question void prevents answers and corrects all completions of that version', async () => {
  await settings(true,[profiles.fan,profiles.teen]);
  const s = await snapshot(); assert.equal(s.status, 'issued');
  await question(s.attempt.question.id, 'void', { reason: 'The factual wording is ambiguous; withdraw this issued version.' });
  await denied('fan','public.quiz_answer($1,1,gen_random_uuid())',[s.attempt.id]);
  const corrected = await snapshot(); assert.equal(corrected.status,'void'); assert.equal(corrected.attempt.question,null);
  assert.deepEqual(corrected.badges,[]); assert.ok(corrected.corrections.length >= 1);
  assert.deepEqual((await snapshot('teen')).badges,[]);
});
await test('age closure hides historical badges and refuses completion without exposing another account', async () => {
  await db.query('update public.profiles set age_blocked_at=now() where id=$1',[profiles.teen]);
  const s = await snapshot('teen'); assert.equal(s.availability,'ineligible'); assert.deepEqual(s.badges,[]); assert.equal(s.attempt,null);
  await denied('teen',"public.quiz_start('American football')");
});
await test('migration can reapply without resetting settings, review states or correction history', async () => {
  const before = await admin('public.quiz_admin_snapshot()');
  await db.exec(fs.readFileSync(migrationPath,'utf8'));
  const after = await admin('public.quiz_admin_snapshot()');
  assert.deepEqual(after.settings,before.settings); assert.deepEqual(after.counts,before.counts);
  assert.deepEqual(after.questions,before.questions); assert.deepEqual(after.audit,before.audit);
});
await test('UTC Monday week stays fixed when a caller changes its session time zone', async () => {
  const before = await snapshot();
  await db.exec("set timezone = 'Pacific/Kiritimati'");
  const after = await snapshot(); assert.equal(after.week_start,before.week_start); assert.equal(after.week_end,before.week_end);
  await db.exec("set timezone = 'UTC'");
});
await test('the complete bank rejects question 101', async () => {
  const before = await admin('public.quiz_admin_snapshot()');
  for (let i=before.questions.length; i<100; i++) await question(null, 'create', { ...questionPayload, prompt: `Question ${i}: how many points is a touchdown?` });
  await assert.rejects(() => question(null, 'create', questionPayload), /quiz_bank_full/);
  assert.equal((await admin('public.quiz_admin_snapshot()')).questions.length, 100);
});
for (const t of tests) console.log(`${t.pass ? 'PASS' : 'FAIL'} ${t.name}${t.detail ? ` — ${t.detail}` : ''}`);
console.log(`${tests.filter(t => t.pass).length}/${tests.length} sport quiz actor scenarios passed`);
await db.close();
process.exit(tests.every(t => t.pass) ? 0 : 1);
