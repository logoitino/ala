#!/usr/bin/env node
/** Replay 20261017090000 (SAFETY-01 coach-level label) on the canonical schema without it (and without MULTISPORT-01,
 * which builds on it), as on the hosted projects: who may set or change the label, the append-only admin audit, and
 * that a coach-level report never hides a clip. Usage: coach-level-replay.mjs <pglite dist>. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: coach-level-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261017090000_coach_level_label.sql', 'utf8');
const sports = fs.readFileSync('supabase/migrations/20261021233000_athlete_sports.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, '').replace(sports, ''));
const ADMIN = '00000000-0000-4000-8000-0000000000a6', UP = '00000000-0000-4000-8000-0000000000b6', OTHER = '00000000-0000-4000-8000-0000000000c6';
const R = ['d1', 'd2', 'd3', 'd4', 'd5'].reduce((m, k, i) => ({ ...m, [k]: `00000000-0000-4000-8000-0000000000${k}` }), {});
await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${ADMIN}','{"birth_year":1990,"birth_month":1}'),('${UP}','{"birth_year":1990,"birth_month":1}'),('${OTHER}','{"birth_year":1990,"birth_month":1}');
  update public.profiles set role='admin', roles=array['admin'], is_admin=true where user_id='${ADMIN}';`);
const who = (uid) => uid ? `set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon; set request.jwt.claims='{"role":"anon"}';`;
const as = async (uid, sql) => {
  await db.exec(who(uid));
  try { const r = await db.exec(sql); return { ok: true, rows: [...r].reverse().find((x) => x.fields?.length)?.rows ?? [] }; }
  catch (e) { return { ok: false, code: e.code, message: e.message }; }
  finally { await db.exec('reset role; reset request.jwt.claims;'); }
};
const label = async (id) => (await db.query(`select safety_label from public.reels where id = '${id}'`)).rows[0]?.safety_label;
const events = async (id) => Number((await db.query(`select count(*) n from public.safety_label_events where target_id = '${id}'`)).rows[0].n);
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail: JSON.stringify(detail) });
const upload = (id, category, extra = '') => as(UP, `insert into public.reels(id, title, video_url, category${extra ? ', safety_label' : ''}) values ('${id}', 'Clip', 'https://example.invalid/v.mp4', '${category}'${extra ? `, '${extra}'` : ''})`);

const feedBefore = (await db.query(`select string_agg(attname, ',') c from pg_attribute where attrelid = 'public.reels_feed'::regclass and attnum > 0`)).rows[0].c;
check('baseline: no label column on the feed (as hosted today)', !feedBefore.includes('safety_label'), feedBefore);
await db.exec(migration); await db.exec(migration); // idempotent
await db.exec(`select set_config('tapuai.coach_label', '', false)`);

let r = await upload(R.d1, 'train_like_me', 'coach_level');
check('an upload marked coach-level on Train Like Me is labelled and audited once', r.ok && (await label(R.d1)) === 'coach_level' && (await events(R.d1)) === 1, r);
r = await upload(R.d2, 'game_play', 'coach_level');
check('a direct insert cannot label a clip that is not Train Like Me', !r.ok && /Train Like Me/.test(r.message ?? ''), r);
await upload(R.d3, 'train_like_me');
r = await as(OTHER, `select public.set_own_coach_label('reel', '${R.d3}', 'coach_level')`);
check("another account cannot mark someone else's clip", !r.ok && (await label(R.d3)) === 'none', r);
r = await as(null, `select public.set_own_coach_label('reel', '${R.d3}', 'coach_level')`);
check('a guest cannot call the uploader function', !r.ok && r.code === '42501', r);
r = await as(UP, `select public.set_own_coach_label('reel', '${R.d3}', 'coach_level')`);
check('the uploader marks their new Train Like Me clip, audited', r.ok && (await label(R.d3)) === 'coach_level' && (await events(R.d3)) === 1, r);
r = await as(UP, `update public.reels set safety_label = 'none' where id = '${R.d3}'`);
check('the uploader cannot clear the label by a direct update', !r.ok && (await label(R.d3)) === 'coach_level', r);
r = await as(UP, `select public.set_coach_label('reel', '${R.d3}', 'none', 'not actually risky')`);
check('a non-admin cannot use the review function', !r.ok && (await label(R.d3)) === 'coach_level', r);
r = await as(ADMIN, `select public.set_coach_label('reel', '${R.d3}', 'none', 'short')`);
check('an admin change needs a reason of at least 8 characters', !r.ok && (await label(R.d3)) === 'coach_level', r);
r = await as(ADMIN, `select public.set_coach_label('reel', '${R.d3}', 'none', 'standard bodyweight squat')`);
check('an admin removes the label with a reason, audited', r.ok && (await label(R.d3)) === 'none' && (await events(R.d3)) === 2, r);
r = await as(UP, `select count(*) n from public.safety_label_events`);
check('the audit is unreadable to an ordinary account', r.ok ? Number(r.rows[0].n) === 0 : true, r);
r = await as(ADMIN, `select count(*) n from public.safety_label_events`);
check('an admin reads the audit', r.ok && Number(r.rows[0].n) === 3, r);
r = await as(UP, `insert into public.safety_label_events(target_kind, target_id, old_label, new_label, reason) values ('reel', '${R.d4}', 'none', 'coach_level', 'forged')`);
check('clients cannot write audit rows', !r.ok, r);
r = await as(UP, `select public.coach_label_desk()`);
check('the review desk is admin-only', !r.ok, r);

await upload(R.d5, 'train_like_me');
r = await as(OTHER, `select public.report_reel('${R.d5}', 'coach_level')`);
const flagged = async () => (await db.query(`select is_flagged from public.reels where id = '${R.d5}'`)).rows[0].is_flagged;
check('a "risky without a coach" report never hides the clip', r.ok && (await flagged()) !== true, r);
r = await as(OTHER, `select public.report_reel('${R.d5}', 'rights')`);
check('a rights report still hides it as before', r.ok && (await flagged()) === true, r);
const feed = await as(null, `select safety_label from public.reels_feed where id = '${R.d1}'`);
check('guests see the coach-level badge on the feed', feed.ok && feed.rows[0]?.safety_label === 'coach_level', feed);
await db.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.pass ? '' : ` — ${x.detail}`}`);
const failed = results.filter((x) => !x.pass).length;
console.log(`coach-level replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
