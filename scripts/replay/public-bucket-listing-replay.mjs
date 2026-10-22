#!/usr/bin/env node
/** Replay 20261022100000 on the canonical schema: before it anyone lists the public media buckets; after it only the
 * owner lists their own folders, while the buckets stay public (URL playback needs no SELECT policy).
 * Usage: public-bucket-listing-replay.mjs <pglite dist>. No hosted SQL runs. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: public-bucket-listing-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261022100000_public_bucket_listing_owner_only.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, ''));
const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000b1';
await db.exec(`insert into storage.buckets(id, name, public) values ('reels','reels',true),('game_highlights','game_highlights',true),('avatars','avatars',true) on conflict (id) do update set public = true;
  insert into storage.objects(bucket_id, name) values
    ('reels','${A}/clip.mp4'),('reels','reels/${A}/1.mp4'),('reels','reels/${B}/2.mp4'),
    ('game_highlights','reels/${A}/3.mp4'),('avatars','${A}/me.jpg'),('avatars','sponsors/${A}/logo.png'),('avatars','${B}/you.jpg');`);
const who = (uid) => uid ? `set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon; set request.jwt.claims='{"role":"anon"}';`;
const list = async (uid, bucket) => {
  await db.exec(who(uid));
  try { return (await db.query(`select name from storage.objects where bucket_id = '${bucket}' order by name`)).rows.map((r) => r.name); }
  finally { await db.exec('reset role; reset request.jwt.claims;'); }
};
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

check('baseline: a guest can list every reels object (the leak)', (await list(null, 'reels')).length === 3);
await db.exec(migration);
await db.exec(migration); // idempotent
for (const bucket of ['reels', 'game_highlights', 'avatars']) {
  const seen = await list(null, bucket);
  check(`guest lists nothing in ${bucket}`, seen.length === 0, JSON.stringify(seen));
}
const aReels = await list(A, 'reels');
check('owner lists own <uid>/ and reels/<uid>/ files only', JSON.stringify(aReels) === JSON.stringify([`${A}/clip.mp4`, `reels/${A}/1.mp4`]), JSON.stringify(aReels));
check('owner lists own game_highlights fallback file', (await list(A, 'game_highlights')).length === 1);
const aAvatars = await list(A, 'avatars');
check('owner lists own avatar and sponsor logo only', aAvatars.length === 2 && !aAvatars.some((n) => n.startsWith(B)), JSON.stringify(aAvatars));
check('another user cannot list the owner files', !(await list(B, 'reels')).some((n) => n.includes(A)));
check('buckets stay public for URL playback', (await db.query(`select bool_and(public) ok from storage.buckets where id in ('reels','game_highlights','avatars')`)).rows[0].ok === true);
await db.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`public-bucket-listing replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
