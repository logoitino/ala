#!/usr/bin/env node
/** Replay account tags for staging (workstream 4). Staging already has the later privacy and minor-account migrations,
 * so 20261002160000 alone would put back the old search (full names, hidden and blocked accounts) and miss the Closed
 * accounts policy. The catch-up is that file, then privacy's search and grants, then the policy, built here from the
 * repo sources. Proves the catch-up ends identical to development's order, then 20261022150000 (tags respect blocks).
 * Usage: account-tags-replay.mjs <pglite dist> [--print-staging-sql]. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist, flag] = process.argv.slice(2);
if (!dist) { console.error('usage: account-tags-replay.mjs <pglite dist> [--print-staging-sql]'); process.exit(2); }
const read = (f) => fs.readFileSync(f, 'utf8');
const tags = read('supabase/migrations/20261002160000_reel_account_tags.sql');
const blocks = read('supabase/migrations/20261022150000_account_tags_respect_blocks.sql');
const privacy = read('supabase/migrations/20261014090000_profile_privacy.sql');
const start = privacy.indexOf('-- Account tag search: a username prefix');
const search = privacy.slice(start, privacy.indexOf('$$;', start) + 3);
const grants = [...privacy.matchAll(/'((?:revoke all|grant execute) on function public\.search_taggable_accounts\(text\)[^']*)'/g)].map((m) => `${m[1]};`);
if (start < 0 || grants.length !== 2) { console.error('privacy anchors moved; update the catch-up builder'); process.exit(2); }
const closed = `drop policy if exists "Closed accounts" on public.reel_account_tags;
create policy "Closed accounts" on public.reel_account_tags as restrictive for all to authenticated
  using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()));`;
const catchup = [tags, '-- Later definitions staging already ran before this table existed (20261014090000, 20261014110000):', search, ...grants, closed].join('\n');
if (flag === '--print-staging-sql') { process.stdout.write(catchup + '\n'); process.exit(0); }

const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const schema = read('apps/mobile/src/backend/db/schema.sql').replace(blocks, '');
const dev = new PGlite({ extensions: { pgcrypto } });
const stg = new PGlite({ extensions: { pgcrypto } });
await dev.exec(SUPABASE_STUBS); await dev.exec(schema);
await stg.exec(SUPABASE_STUBS); await stg.exec(schema.replace(tags, ''));
const FP = `select coalesce(string_agg(k || '=' || v, ' ' order by k), '') fp from (
  select 'fn:' || p.proname k, md5(pg_get_functiondef(p.oid)) || ':' || coalesce((select string_agg(r.rolname, ',' order by r.rolname) from pg_roles r where r.rolname in ('anon','authenticated','service_role') and has_function_privilege(r.oid, p.oid, 'EXECUTE')), '') v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('account_tag_label','search_taggable_accounts','tag_reel_accounts','get_reel_account_tags','get_my_account_tags','confirm_account_tag')
  union all select 'policy:' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '') || '|' || coalesce(pg_get_expr(polwithcheck, polrelid), '') || '|' || polcmd::text || '|' || polpermissive::text)
  from pg_policy where polrelid = to_regclass('public.reel_account_tags')
  union all select 'grant:' || grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants where table_schema = 'public' and table_name = 'reel_account_tags' and grantee in ('anon','authenticated') group by grantee) x`;
const fp = async (db) => (await db.query(FP)).rows[0].fp;
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail: JSON.stringify(detail) });

const hardened = (await stg.query(`select pg_get_functiondef('public.search_taggable_accounts(text)'::regprocedure) d`)).rows[0].d;
await stg.exec(tags);
const reverted = (await stg.query(`select pg_get_functiondef('public.search_taggable_accounts(text)'::regprocedure) d`)).rows[0].d;
check('baseline: the 2026-10-02 file alone puts back the old full-name search on staging', /full_name ilike/.test(reverted) && !/full_name ilike/.test(hardened), '');
await stg.exec(catchup); await stg.exec(catchup); // idempotent
const devFp = await fp(dev), stgFp = await fp(stg);
check('after the catch-up, staging matches development exactly (functions, grants, policies)', devFp === stgFp && devFp.includes('policy:Closed accounts'), { devFp, stgFp });

const U = { up: 'a7', fan: 'b7', blocker: 'c7', hidden: 'd7', other: 'e7', x: 'f7' };
for (const k of Object.keys(U)) U[k] = `00000000-0000-4000-8000-0000000000${U[k]}`;
await stg.exec(`insert into auth.users(id, raw_user_meta_data) select u, '{"birth_year":1990,"birth_month":1}' from unnest(array['${Object.values(U).join("','")}']::uuid[]) u;
  update public.profiles set username = 'tagfan', full_name = 'Lavinia Secretname' where user_id = '${U.fan}';
  update public.profiles set username = 'tagblocker' where user_id = '${U.blocker}';
  update public.profiles set username = 'taghidden', hide_from_search = true where user_id = '${U.hidden}';
  update public.profiles set username = 'tagother' where user_id = '${U.other}';
  update public.profiles set username = 'tagx' where user_id = '${U.x}';`);
const pid = async (u) => (await stg.query(`select id from public.profiles where user_id = '${u}'`)).rows[0].id;
const P = {}; for (const [k, u] of Object.entries(U)) P[k] = await pid(u);
const who = (uid) => uid ? `set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon; set request.jwt.claims='{"role":"anon"}';`;
const as = async (uid, sql) => {
  await stg.exec(who(uid));
  try { const r = await stg.exec(sql); return { ok: true, rows: [...r].reverse().find((x) => x.fields?.length)?.rows ?? [] }; }
  catch (e) { return { ok: false, code: e.code, message: e.message }; }
  finally { await stg.exec('reset role; reset request.jwt.claims;'); }
};
const REEL = '00000000-0000-4000-8000-0000000000aa', REEL2 = '00000000-0000-4000-8000-0000000000ab';
await as(U.up, `insert into public.reels(id, title, video_url) values ('${REEL}', 'Tag test', 'https://example.invalid/v.mp4'), ('${REEL2}', 'Cap test', 'https://example.invalid/w.mp4')`);
await as(U.blocker, `select public.block_user('${P.up}')`);
let r = await as(U.up, `select public.tag_reel_accounts('${REEL}', array['${P.blocker}']::uuid[]) n`);
check('baseline: someone you blocked can still send you a new tag request', r.ok && r.rows[0].n === 1, r);
await stg.exec(`delete from public.reel_account_tags`);
await stg.exec(blocks); await stg.exec(blocks); // idempotent
r = await as(U.up, `select public.tag_reel_accounts('${REEL}', array['${P.blocker}', '${P.fan}']::uuid[]) n`);
const blockerTags = Number((await stg.query(`select count(*) n from public.reel_account_tags where profile_id = '${P.blocker}'`)).rows[0].n);
check('after the fix a blocked account is skipped silently and others are still tagged', r.ok && r.rows[0].n === 1 && blockerTags === 0, { r, blockerTags });
r = await as(U.fan, `select public.tag_reel_accounts('${REEL}', array['${P.other}']::uuid[]) n`);
check('only the uploader can tag accounts on a Highlight', !r.ok && r.code === '42501', r);
r = await as(null, `select public.tag_reel_accounts('${REEL}', array['${P.other}']::uuid[]) n`);
check('a guest cannot tag', !r.ok, r);
r = await as(U.up, `select public.tag_reel_accounts('${REEL2}', array['${P.fan}', '${P.other}', '${P.x}', '${P.hidden}']::uuid[]) n`);
check('at most three active mentions per Highlight', r.ok && r.rows[0].n === 3, r);
r = await as(U.up, `select label from public.search_taggable_accounts('Secretname')`);
check('search never matches a full name', r.ok && r.rows.length === 0, r);
r = await as(U.up, `select label from public.search_taggable_accounts('tagh')`);
check('search hides an account that hides from search', r.ok && r.rows.length === 0, r);
r = await as(U.up, `select label from public.search_taggable_accounts('tagb')`);
check('search hides an account in a block with you', r.ok && r.rows.length === 0, r);
r = await as(null, `select * from public.get_reel_account_tags('${REEL}')`);
check('guests do not see a pending mention', r.ok && r.rows.length === 0, r);
const tagId = (await stg.query(`select id from public.reel_account_tags where reel_id = '${REEL}' and profile_id = '${P.fan}'`)).rows[0].id;
r = await as(U.other, `select public.confirm_account_tag('${tagId}', 'confirm') s`);
check('nobody else can confirm your mention', r.ok && r.rows[0].s === null, r);
r = await as(U.fan, `select public.confirm_account_tag('${tagId}', 'confirm') s`);
const pub = await as(null, `select label from public.get_reel_account_tags('${REEL}')`);
check('the tagged account confirms and guests then see the name', r.ok && r.rows[0].s === 'confirmed' && pub.rows?.[0]?.label === 'tagfan', { r, pub });
r = await as(U.fan, `insert into public.reel_account_tags(reel_id, profile_id) values ('${REEL}', '${P.fan}')`);
check('clients cannot write tag rows directly', !r.ok, r);
await dev.close(); await stg.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.pass ? '' : ` — ${x.detail}`}`);
const failed = results.filter((x) => !x.pass).length;
console.log(`account-tags replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
