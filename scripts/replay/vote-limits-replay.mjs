#!/usr/bin/env node
/** Replay 20261022130000 on the canonical schema: before it a guest stuffs cheer votes and hype; after it each signed-in
 * account counts once (switching sides moves one vote) and guests are refused. Usage: vote-limits-replay.mjs <pglite dist>. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: vote-limits-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261022130000_vote_and_hype_limits.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, ''));
const U1 = '00000000-0000-4000-8000-0000000000a4', U2 = '00000000-0000-4000-8000-0000000000b4', PLAYER = '00000000-0000-4000-8000-0000000000d4';
await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${U1}','{"birth_year":1990,"birth_month":1}'),('${U2}','{"birth_year":1990,"birth_month":1}');
  insert into public.players(id, name) values ('${PLAYER}','P');`);
const who = (uid) => uid ? `set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon; set request.jwt.claims='{"role":"anon"}';`;
const call = async (uid, sql) => {
  await db.exec(who(uid));
  try { return { ok: true, row: Object.values((await db.query(sql)).rows[0])[0] }; }
  catch (e) { return { ok: false, code: e.code }; }
  finally { await db.exec('reset role; reset request.jwt.claims;'); }
};
const vote = (uid, side, prev = null, slug = 'p') => call(uid, `select public.cast_cheer_vote('${slug}', '${side}', ${prev ? `'${prev}'` : 'null'})`);
const hype = (uid, kind) => call(uid, `select public.increment_player_hype('${PLAYER}', '${kind}')`);
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail: JSON.stringify(detail) });

await vote(null, 'home', null, 'base'); await vote(null, 'home', 'away', 'base'); const stuffed = await vote(null, 'home', 'away', 'base');
check('baseline: a guest stuffs votes and drags the other side', stuffed.ok && stuffed.row.home_votes === 3, stuffed);
await db.exec(migration); await db.exec(migration); // idempotent
let r = await vote(null, 'home'); check('guest cannot vote', !r.ok && r.code === '42501', r);
r = await vote(U1, 'home'); check('first vote counts once', r.ok && r.row.home_votes === 1 && r.row.away_votes === 0, r);
r = await vote(U1, 'home'); check('repeat vote changes nothing', r.ok && r.row.home_votes === 1, r);
r = await vote(U1, 'home', 'away'); check('forged previous_side is ignored', r.ok && r.row.home_votes === 1 && r.row.away_votes === 0, r);
r = await vote(U1, 'away'); check('switching sides moves exactly one vote', r.ok && r.row.home_votes === 0 && r.row.away_votes === 1, r);
r = await vote(U2, 'home'); check('a second account counts once', r.ok && r.row.home_votes === 1 && r.row.away_votes === 1, r);
r = await hype(null, 'seki'); check('guest cannot hype', !r.ok && r.code === '42501', r);
r = await hype(U1, 'seki'); check('first hype counts', r.ok && r.row.seki_count === 1, r);
r = await hype(U1, 'seki'); check('repeat hype the same day is a no-op', r.ok && r.row.seki_count === 1, r);
r = await hype(U1, 'aura'); check('a different kind counts once', r.ok && r.row.aura_count === 1 && r.row.seki_count === 1, r);
r = await hype(U2, 'seki'); check('another account adds one', r.ok && r.row.seki_count === 2, r);
r = await call(U1, 'select count(*) from public.cheer_poll_votes'); check('clients cannot read vote rows', !r.ok, r);
await db.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.pass ? '' : ` — ${x.detail}`}`);
const failed = results.filter((x) => !x.pass).length;
console.log(`vote-limits replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
