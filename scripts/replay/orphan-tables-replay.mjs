#!/usr/bin/env node
/** Replay 20261022090000: the two orphan public tables end up RLS-on with no client grants, idempotently, and the
 * file is a no-op on a database that never had them. Usage: orphan-tables-replay.mjs <pglite dist>. No hosted SQL. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: orphan-tables-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261022090000_lock_orphan_public_tables.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin;
  create table public.school_teams (id int); create table public.app_feature_flags (key text, on_ boolean);
  insert into public.app_feature_flags values ('x', true);
  grant select, insert, update, delete on public.school_teams, public.app_feature_flags to anon, authenticated;`);
await db.exec(migration);
await db.exec(migration); // idempotent
const rls = (await db.query(`select relname, relrowsecurity from pg_class where relname in ('school_teams','app_feature_flags')`)).rows;
check('RLS enabled on both tables', rls.length === 2 && rls.every((r) => r.relrowsecurity));
for (const role of ['anon', 'authenticated']) {
  try { await db.exec(`set role ${role}; select * from public.app_feature_flags;`); check(`${role} read refused`, false, 'read succeeded'); }
  catch (e) { check(`${role} read refused`, e.code === '42501', `${e.code}`); }
  finally { await db.exec('reset role;'); }
  try { await db.exec(`set role ${role}; insert into public.school_teams values (1);`); check(`${role} write refused`, false, 'write succeeded'); }
  catch (e) { check(`${role} write refused`, e.code === '42501', `${e.code}`); }
  finally { await db.exec('reset role;'); }
}
check('server role still reads', (await db.query('select count(*)::int n from public.app_feature_flags')).rows[0].n === 1);
await db.close();

const empty = new PGlite();
await empty.exec('create role anon nologin; create role authenticated nologin;');
try { await empty.exec(migration); check('no-op where the tables do not exist', true); } catch (e) { check('no-op where the tables do not exist', false, e.message); }
await empty.close();

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`orphan-tables replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
