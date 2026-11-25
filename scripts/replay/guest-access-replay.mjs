#!/usr/bin/env node
/** GUEST-ACCESS-01 disposable PostgreSQL denial/preview checks: no hosted data, keys, grants or migration application. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const dist = process.argv[2];
if (!dist) throw new Error('Pass the verified local PGlite dist directory.');
const { PGlite } = await import(pathToFileURL(path.resolve(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.resolve(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec('create role authenticator noinherit;');
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8'));
const migration = 'supabase/migrations/20261125180000_guest_account_access.sql';
// Reapplication must leave grants, policy and the bounded source idempotent.
if (fs.existsSync(migration)) await db.exec(fs.readFileSync(migration, 'utf8'));
const uid = '00000000-0000-4000-8000-000000006001';
await db.query("insert into auth.users(id,raw_user_meta_data) values($1,jsonb_build_object('birth_year',extract(year from current_date)::int-30,'birth_month',1))", [uid]);
const player = (await db.query("insert into public.players(name,school_name) values('Synthetic preview athlete','Synthetic school') returning id")).rows[0].id;
await db.query('update public.profiles set player_id=$1 where user_id=$2',[player,uid]);
for(let i=0;i<7;i++) await db.query("insert into public.reels(title,video_url,player_id,is_flagged,is_removed,is_exclusive,is_vault_only,tag_status,attested_at,rights_version) values($1,$2,$3,false,false,false,false,'confirmed',now(),'synthetic-preview-rights')",['Synthetic clip '+i,'https://example.invalid/video'+i+'.mp4',player]);
await db.exec("update public.reels set tag_status='confirmed' where title like 'Synthetic clip %'");
await db.query("insert into public.reels(title,video_url,is_flagged,is_removed,is_exclusive,is_vault_only,attested_at,rights_version) values('Vault synthetic','vault://never',false,false,true,true,now(),'synthetic-preview-rights')");
// Pending/rejected tags are hidden in reels_feed; eligibility must inspect the raw record.
for (const status of ['pending','rejected']) await db.query("insert into public.reels(title,video_url,player_id,is_flagged,is_removed,is_exclusive,is_vault_only,tag_status,attested_at,rights_version,created_at) values($1,$2,$3,false,false,false,false,$4,now(),'synthetic-preview-rights',now()+interval '1 hour')",['Hidden '+status,'https://example.invalid/'+status+'.mp4',player,status]);
await db.exec("update public.reels set tag_status='rejected' where title='Hidden rejected'");
const expectedPlayers=(await db.query('select count(*)::int n from public.players')).rows[0].n;
let passed=0;
const test=async(name,work)=>{await work();passed++;console.log('PASS '+name);};
const as=async(role,sub,work,extra={})=>{
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,...(sub?{sub}:{}),...extra})]);
 await db.exec('set role '+role);
 try{return await work();}finally{await db.exec('reset role; reset request.jwt.claims;');}
};
const denied=async(sql)=>{
 let rejected=false;try{await as('anon',null,()=>db.query(sql));}catch(e){rejected=e.code==='42501';}assert.equal(rejected,true,sql);
};
await test('guard installs without replacing an unrelated pre-request hook',async()=>{const r=await db.query("select rolconfig from pg_roles where rolname='authenticator'");assert.ok(r.rows[0].rolconfig?.includes('pgrst.db_pre_request=public.enforce_registered_api_account'));await db.exec("alter role authenticator set pgrst.db_pre_request='public.existing_guard'");await assert.rejects(()=>db.exec(fs.readFileSync(migration,'utf8')),/GUEST_API_GUARD_EXISTING_HOOK/);await db.exec("alter role authenticator set pgrst.db_pre_request='public.enforce_registered_api_account'");});
await test('a database-specific blank pre-request hook cannot mask the guard',async()=>{
 const name=(await db.query('select current_database() as name')).rows[0].name;
 const quoted='"'+name.replaceAll('"','""')+'"';
 await db.exec("alter role authenticator in database "+quoted+" set pgrst.db_pre_request=''");
 await assert.rejects(()=>db.exec(fs.readFileSync(migration,'utf8')),/GUEST_API_GUARD_EXISTING_HOOK/);
 await db.exec('alter role authenticator in database '+quoted+' reset pgrst.db_pre_request');
});
await test('anonymous raw profile/roster/directory/feed reads are denied',async()=>{
 for(const table of ['players','profiles','schools_and_teams','reels','reels_feed']) await denied('select * from public.'+table);
});
await test('anonymous profile and search RPCs are not exposed',async()=>{
 await denied('select * from public.get_public_profiles(null,null,null)');
 const rows=(await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and has_function_privilege('anon',p.oid,'execute') and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')")).rows;
 assert.deepEqual(rows.map(x=>x.proname).sort(),['account_browsing_allowed','current_user_role','enforce_registered_api_account','guest_highlights_preview'].sort());
});
await test('guest preview is at most three sanitized free videos, not a paging directory',async()=>{
 const rows=await as('anon',null,()=>db.query('select * from public.guest_highlights_preview()'));
 assert.equal(rows.rows.length,3);
 for(const row of rows.rows){assert.deepEqual(Object.keys(row).sort(),['id','video_url','title','created_at'].sort());assert.match(row.video_url,/example.invalid/);assert.doesNotMatch(row.video_url,/pending|rejected/);}
});
await test('member direct reads remain available under their existing RLS',async()=>{
 const rows=await as('authenticated',uid,()=>db.query('select * from public.players'));
 assert.equal(rows.rows.length,expectedPlayers);assert.ok(rows.rows.some(row=>row.id===player));
 const p=await as('authenticated',uid,()=>db.query('select * from public.get_public_profiles(null,$1::uuid[],null)',[[player]]));
 assert.equal(p.rows.length,1);
});
await test('anonymous-auth token does not earn member data access',async()=>{
 const rows=await as('authenticated',uid,()=>db.query('select * from public.players'),{is_anonymous:true});assert.equal(rows.rows.length,0);
 const p=await as('authenticated',uid,()=>db.query('select * from public.get_public_profiles(null,$1::uuid[],null)',[[player]]),{is_anonymous:true});assert.equal(p.rows.length,0);
});
await test('API guard rejects anonymous-auth JWTs and managed anonymous-user records',async()=>{
 let rejected=false;try{await as('authenticated',uid,()=>db.query('select public.enforce_registered_api_account()'),{is_anonymous:true});}catch(e){rejected=e.code==='42501';}assert.equal(rejected,true);
 await db.exec('alter table auth.users add column is_anonymous boolean not null default false');
 await db.query('update auth.users set is_anonymous=true where id=$1',[uid]);
 rejected=false;try{await as('authenticated',uid,()=>db.query('select public.enforce_registered_api_account()'));}catch(e){rejected=e.code==='42501';}assert.equal(rejected,true);
 await db.query('update auth.users set is_anonymous=false where id=$1',[uid]);
 await as('authenticated',uid,()=>db.query('select public.enforce_registered_api_account()'));
 await as('anon',null,()=>db.query('select public.enforce_registered_api_account()'));
});
await test('anonymous identities cannot upload/list authenticated Storage metadata',async()=>{
 let rejected=false;try{await as('authenticated',uid,()=>db.query("insert into storage.objects(bucket_id,name,owner) values('reels',$1,$2)",[uid+'/synthetic.mp4',uid]),{is_anonymous:true});}catch(e){rejected=e.code==='42501';}assert.equal(rejected,true);
});
await db.close();console.log(JSON.stringify({passed,failed:0,hostedVerified:false}));
