#!/usr/bin/env node
/** Replay 20261022110000 on the canonical schema: guests (and signed-in fans) lose admin/operator writes; operators and
 * admins keep exactly theirs. Usage: anon-branch-replay.mjs <pglite dist>. No hosted SQL runs. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: anon-branch-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261022110000_remove_anon_write_branch.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, ''));
const ADMIN = '00000000-0000-4000-8000-0000000000a2', OP = '00000000-0000-4000-8000-0000000000c2', FAN = '00000000-0000-4000-8000-0000000000f2';
const GAME = '00000000-0000-4000-8000-0000000000e2', PLAYER = '00000000-0000-4000-8000-0000000000d2';
await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${ADMIN}','{"birth_year":1990,"birth_month":1}'),('${OP}','{"birth_year":1990,"birth_month":1}'),('${FAN}','{"birth_year":1990,"birth_month":1}');
  update public.profiles set role='admin', roles=array['admin'], is_admin=true where user_id='${ADMIN}';
  update public.profiles set role='operator', roles=array['operator'] where user_id='${OP}';
  insert into public.games(id, home_team, away_team) values ('${GAME}','Home','Away');
  insert into public.players(id, name) values ('${PLAYER}','P');
  insert into public.app_feedback default values;`);
const who = (uid) => uid ? `set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon; set request.jwt.claims='{"role":"anon"}';`;
const results = [];
const run = async (uid, sql) => {
  await db.exec(who(uid));
  try { const r = await db.query(sql); return { ok: true, rows: r.rows, count: r.affectedRows ?? 0 }; }
  catch (e) { return { ok: false, code: e.code }; }
  finally { await db.exec('reset role; reset request.jwt.claims;'); }
};
const check = (name, pass, detail = '') => results.push({ name, pass, detail: JSON.stringify(detail) });
const sport = (n) => `insert into public.sport_configs(sport) values ('Replay ${n}')`;
const score = `update public.games set home_score = coalesce(home_score, 0) + 1 where id = '${GAME}'`;
const play = `insert into public.game_events(game_id, player_id, event_type, description) values ('${GAME}', '${PLAYER}', 'td', 'replay')`;

let r = await run(null, sport('baseline'));
check('baseline: a guest can write sport configs (the hole)', r.ok, r);
await db.exec(migration); await db.exec(migration); // idempotent
r = await run(null, sport('guest')); check('guest cannot write sport configs', !r.ok, r);
r = await run(null, score); check('guest cannot change a score', r.ok ? r.count === 0 : true, r);
r = await run(null, play); check('guest cannot post a play', !r.ok, r);
r = await run(null, 'select count(*)::int n from public.app_feedback'); check('guest cannot read feedback', r.ok && r.rows[0].n === 0, r);
r = await run(FAN, sport('fan')); check('signed-in fan cannot write sport configs', !r.ok, r);
r = await run(FAN, score); check('signed-in fan cannot change a score', r.ok ? r.count === 0 : true, r);
r = await run(OP, score); check('operator can change a score', r.ok && r.count === 1, r);
r = await run(OP, play); check('operator can post a play', r.ok, r);
r = await run(OP, sport('op')); check('operator cannot write sport configs', !r.ok, r);
r = await run(ADMIN, sport('admin')); check('admin can write sport configs', r.ok, r);
r = await run(ADMIN, 'select count(*)::int n from public.app_feedback'); check('admin reads feedback', r.ok && r.rows[0].n === 1, r);
r = await run(null, 'insert into public.app_feedback default values'); check('guest can still send feedback', r.ok, r);
await db.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.pass ? '' : ` — ${x.detail}`}`);
const failed = results.filter((x) => !x.pass).length;
console.log(`anon-branch replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
