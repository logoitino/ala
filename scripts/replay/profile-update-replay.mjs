#!/usr/bin/env node
/** Replay 20261022120000 on the canonical schema plus development's open UPDATE (and its old public read): before it
 * anyone edits any profile; after it only the owner (or an admin) does, even though other rows stay readable. Usage: profile-update-replay.mjs <pglite dist>. No hosted SQL runs. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: profile-update-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261022120000_drop_public_update_profiles.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, ''));
const OWNER = '00000000-0000-4000-8000-0000000000a3', OTHER = '00000000-0000-4000-8000-0000000000b3';
await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${OWNER}','{"birth_year":1990,"birth_month":1}'),('${OTHER}','{"birth_year":1990,"birth_month":1}');
  create policy "Public Update Profiles" on public.profiles for update using (true);
  -- Development had a public read policy until PRIV-01 (2026-10-17); with it the open UPDATE was exploitable, and any
  -- future broad read would revive it. The fix must hold even when other rows are readable.
  create policy "Public Read Profiles" on public.profiles for select using (true);
  grant update on public.profiles to anon;`);
const who = (uid) => uid ? `set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon; set request.jwt.claims='{"role":"anon"}';`;
const edit = async (uid, bio) => {
  await db.exec(who(uid));
  try { return (await db.query(`update public.profiles set bio = '${bio}' where user_id = '${OWNER}'`)).affectedRows ?? 0; }
  catch { return 0; }
  finally { await db.exec('reset role; reset request.jwt.claims;'); }
};
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });
check('baseline: another user can edit the owner profile (the hole)', (await edit(OTHER, 'hijacked')) === 1);
await db.exec(migration); await db.exec(migration); // idempotent
check('guest cannot edit the profile', (await edit(null, 'guest')) === 0);
check('another user cannot edit the profile', (await edit(OTHER, 'other')) === 0);
check('owner can still edit their profile', (await edit(OWNER, 'mine')) === 1);
const bio = (await db.query(`select bio from public.profiles where user_id = '${OWNER}'`)).rows[0].bio;
check('only the owner edit landed', bio === 'mine', bio);
await db.close();
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`profile-update replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
