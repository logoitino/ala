#!/usr/bin/env node
/** Local Fan Zone actor replay; rebuilds canonical SQL using Supabase role/storage stubs, never hosted data. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dist = process.argv[2] || '/tmp/books01-pg/pkg/package/dist';
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
process.on('uncaughtException',e=>{console.error('REPLAY ERROR',e.message,e.where||'');process.exit(1);});
const db = new PGlite({extensions:{pgcrypto}});
const SUPABASE_STUBS = String.raw`
  do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;
  do $$ begin create role supabase_auth_admin; exception when duplicate_object then null; end $$;
  create schema if not exists auth; create schema if not exists storage; create schema if not exists realtime;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')::text $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  -- Like Supabase's: the folders only, without the file name ('a/b/c.jpg' → {a,b}).
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text, private boolean default false, inserted_at timestamptz default now());
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
  grant usage on schema auth, storage, realtime, public to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated, service_role;
  -- Supabase's default privileges: every table, function and sequence the project creates in public is granted to
  -- all three API roles directly. Without this the replay would under-report what a guest can reach on hosted.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;


await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql','utf8'));
const tests=[];
const check=(name, ok)=>{tests.push({name,ok});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
const q=async(sql)=>(await db.query(sql)).rows;
const present=await q("select to_regprocedure('public.fun_snapshot(uuid)') is not null as ok");
check('Fan Zone snapshot exists after canonical replay',present[0].ok);
if(!present[0].ok){await db.close();process.exit(1);}
// Missing eligibility, permission or locking checks must turn these real actor assertions red.
const ids={admin:'00000000-0000-0000-0000-000000000001',adult:'00000000-0000-0000-0000-000000000002',other:'00000000-0000-0000-0000-000000000003',teen:'00000000-0000-0000-0000-000000000004',guardian:'00000000-0000-0000-0000-000000000005',unknown:'00000000-0000-0000-0000-000000000006',closed:'00000000-0000-0000-0000-000000000007',guardian2:'00000000-0000-0000-0000-000000000008'};
for(const [name,id] of Object.entries(ids)) await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${id}','${JSON.stringify(name==='unknown'?{}:{birth_year:name==='teen'?2010:1980,birth_month:1})}');`);
await db.exec(`update public.profiles set role='admin',is_admin=true where user_id='${ids.admin}'; update public.profiles set age_blocked_at=now() where user_id='${ids.closed}';`);
const profiles={};for(const [k,v]of Object.entries(ids))profiles[k]=(await q(`select id from public.profiles where user_id='${v}'`))[0].id;
check('canonical profile IDs differ from authentication IDs',profiles.adult!==ids.adult);
const act=async(who,sql)=>{try{await db.exec(`set role ${who==='guest'?'anon':who==='server'?'service_role':'authenticated'}; set request.jwt.claims='${JSON.stringify(who==='guest'?{role:'anon'}:who==='server'?{role:'service_role'}:who==='claimless'?{}:{role:'authenticated',sub:ids[who]})}';`);return (await q(sql))[0]?.r;}finally{await db.exec('reset role; reset request.jwt.claims;');}};
const deny=async(name,who,sql,pattern=/FUN_|permission denied|row-level security|duplicate/i)=>{try{await act(who,sql);check(name,false);}catch(e){check(name,pattern.test(e.message));}};
const call=async(who,fn,args)=>act(who,`select public.${fn}(${args}) as r`);
const lit=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
const payload={title:'Replay',theme:'Family fun',period:'week',entry_opens_at:new Date(Date.now()-3600000).toISOString(),entry_closes_at:new Date(Date.now()+3600000).toISOString(),vote_opens_at:new Date(Date.now()-3600000).toISOString(),vote_closes_at:new Date(Date.now()+7200000).toISOString(),rules:'Testing rules: free votes, shared ties',support_contact:'testing@example.invalid',pilot_accounts:['admin','adult','other','teen','guardian'].map(k=>profiles[k])};
await deny('default-off campaign cannot open without approved testers','admin',`select public.fun_admin_campaign((public.fun_admin_campaign(null,'create',${lit({...payload,pilot_accounts:[]})})->'campaign'->>'id')::uuid,'open','{}')`);
const campaign=await call('admin','fun_admin_campaign',`null,'create',${lit(payload)}`);const c=campaign.campaign.id;
await deny('fans cannot operate campaigns','adult',`select public.fun_admin_campaign('${c}','open','{}')`);
await call('admin','fun_admin_campaign',`'${c}','open','{}'`);
await deny('opened rules cannot be rewritten','admin',`select public.fun_admin_campaign('${c}','configure','{"rules":"changed"}')`);
for(const who of ['guest','unknown','closed','claimless']) await deny(`${who} cannot reserve an entry`,who,`select public.fun_entry('${c}',null,'reserve','{}')`);
const permit=(who,e,action)=>call(who,'fun_permission',`'${e.id}',${e.revision},'${action}',${lit(e.consent_scope)}`);
const reserve=who=>call(who,'fun_entry',`'${c}',null,'reserve','{}'`);
const edit=(who,e)=>call(who,'fun_entry',`'${c}','${e.id}','edit',${lit({alias:who+' Fan',caption:'A family cheer',rights_confirmed:true})}`);
const adult=(await reserve('adult')).entry;const other=(await reserve('other')).entry;const teen=(await reserve('teen')).entry;
await deny('one entry per account per campaign','adult',`select public.fun_entry('${c}',null,'reserve','{}')`);
await deny('another account cannot edit a private draft','other',`select public.fun_entry('${c}','${adult.id}','edit','{}')`);
await deny('an unsanitized draft cannot be submitted','adult',`select public.fun_entry('${c}','${adult.id}','submit','{}')`);
const entries={adult:await edit('adult',adult),other:await edit('other',other),teen:await edit('teen',teen)};
for(const [who,v]of Object.entries(entries)){
 const e=v.entry;await act(who,`insert into storage.objects(bucket_id,name,owner) values ('fan_zone','${e.path}','${ids[who]}')`);
 const overwrite=await act(who,`update storage.objects set name=name where bucket_id='fan_zone' returning id as r`);check('private storage cannot be overwritten by '+who,overwrite===undefined);
 const read=await act(who,`select count(*)::int as r from storage.objects where bucket_id='fan_zone'`);check(who+' cannot directly read private storage',read===0);
 await deny('client cannot forge verification '+who,who,`select public.fun_verify_media('${e.id}',${e.revision},'${'a'.repeat(64)}',1024,1000)`);
 await call('server','fun_verify_media',`'${e.id}',${e.revision},'${'a'.repeat(64)}',1024,1000`);
 try {const receipt=await call(who,'fun_media_access',`'${e.id}',${e.revision},'verify'`);check(who+' can retry its own verified draft authorization',receipt.digest==='a'.repeat(64)&&receipt.bytes===1024&&receipt.duration_ms===1000);}catch(e){check(who+' can retry its own verified draft authorization',false);}
 await deny('another viewer cannot verify '+who+' verified draft',who==='adult'?'other':'adult',`select public.fun_media_access('${e.id}',${e.revision},'verify')`);
 await deny('service cannot upsert '+who+' verified draft','server',`update storage.objects set metadata='{}' where bucket_id='fan_zone' and name='${e.path}' returning id as r`,/FUN_STORAGE_IMMUTABLE/);
 await call(who,'fun_entry',`'${c}','${e.id}','submit','{}'`);
 await call('admin','fun_admin_entry',`'${e.id}','accept','Rights reviewed for pilot'`);
}
for(const who of Object.keys(entries)) entries[who].entry=(await call(who,'fun_snapshot',`'${c}'`)).entry;
const A=entries.adult.entry,T=entries.teen.entry,O=entries.other.entry;
await deny('another account cannot read a private submission','other',`select public.fun_media_access('${A.id}',${A.revision},'read')`);
await permit('adult',A,'assent');await permit('other',O,'assent');
await permit('teen',T,'assent');
check('teen assent alone does not make a public candidate',!(await call('guardian','fun_snapshot',`'${c}'`)).candidates.some(x=>x.id===T.id));
const link=(await q(`insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values('${profiles.teen}','${profiles.guardian}','invite',now()) returning id`))[0].id;
await deny('unlinked adult cannot consent for teen','guardian2',`select public.fun_permission('${T.id}',${T.revision},'grant',${lit(T.consent_scope)})`);
await permit('guardian',T,'grant');
check('guardian can review exact media revision',(await call('guardian','fun_media_access',`'${T.id}',${T.revision},'read'`)).revision===T.revision);
check('enrolled known-age account has an explicit participation flag',(await call('adult','fun_snapshot',`'${c}'`)).can_participate===true);
await db.exec(`update public.fan_zone_campaigns set pilot_accounts=array_remove(pilot_accounts,'${profiles.guardian}'::uuid) where id='${c}'`);
const privateGuardian=await call('guardian','fun_snapshot',`'${c}'`);
check('unlisted guardian can review privately but cannot participate',privateGuardian.eligible===true&&privateGuardian.can_participate===false&&privateGuardian.campaign.id===c&&privateGuardian.guardian_queue.some(e=>e.id===T.id)&&privateGuardian.candidates.length===0);
await db.exec(`update public.fan_zone_campaigns set pilot_accounts=array_append(pilot_accounts,'${profiles.guardian}'::uuid) where id='${c}'`);
const guest=await call('guest','fun_snapshot',`'${c}'`);check('guest cannot discover testing campaigns',guest.campaign===null&&guest.candidates.length===0);check('no campaign never grants participation',guest.can_participate===false);const pub=await call('guardian','fun_snapshot',`'${c}'`);check('public candidates expose no owner, path, digest or private reasons',pub.candidates.length===3&&pub.candidates.every(x=>!('owner_id'in x)&&!('path'in x)&&!('digest'in x)&&!('reason'in x)));
await deny('self vote denied','adult',`select public.fun_vote('${c}','${A.id}',gen_random_uuid(),0)`);
for(const who of ['guest','unknown','closed','claimless'])await deny(`${who} cannot vote`,who,`select public.fun_vote('${c}','${A.id}',gen_random_uuid(),0)`);
const request='10000000-0000-0000-0000-000000000001';
const v1=await call('adult','fun_vote',`'${c}','${O.id}','${request}',0`);const repeat=await call('adult','fun_vote',`'${c}','${O.id}','${request}',0`);
check('same request returns same atomic ballot version',v1.ballot.version===1&&JSON.stringify(v1)===JSON.stringify(repeat));
await deny('reused request with different arguments denied','adult',`select public.fun_vote('${c}','${T.id}','${request}',1)`);
await deny('stale expected version cannot replace current ballot','adult',`select public.fun_vote('${c}','${T.id}',gen_random_uuid(),0)`);
const v2=await call('adult','fun_vote',`'${c}','${T.id}',gen_random_uuid(),1`);check('replacement advances version',v2.ballot.version===2);
await call('other','fun_vote',`'${c}','${A.id}',gen_random_uuid(),0`);
check('snapshot reveals only own ballot',(await call('adult','fun_snapshot',`'${c}'`)).ballot.version===2&&pub.ballot===null&&!('ballots'in pub));
await call('admin','fun_admin_campaign',`'${c}','pause','{}'`);
await deny('paused campaign rejects ballots','guardian',`select public.fun_vote('${c}','${A.id}',gen_random_uuid(),0)`);
await deny('paused campaign rejects draft editing','adult',`select public.fun_entry('${c}','${A.id}','edit','{}')`);
await call('admin','fun_admin_campaign',`'${c}','open','{}'`);
await permit('guardian',T,'revoke');
await deny('revocation denies next pilot media request','other',`select public.fun_media_access('${T.id}',${T.revision},'read')`);
await permit('guardian',T,'grant');
await db.exec(`update public.guardian_links set ended_at=now() where id='${link}'`);
await deny('ended guardian link denies next media request','other',`select public.fun_media_access('${T.id}',${T.revision},'read')`);
await deny('ended guardian link loses private access','guardian',`select public.fun_media_access('${T.id}',${T.revision},'read')`);
await db.exec(`update public.guardian_links set ended_at=null where id='${link}'`);
const E=(await edit('teen',T)).entry;
await deny('old media revision is unauthorized after edit','adult',`select public.fun_media_access('${T.id}',${T.revision},'read')`);
check('edit invalidates verified media, review and consent',E.revision===T.revision+1&&E.status==='draft'&&E.verified===false);
await call('adult','fun_vote',`'${c}','${O.id}',gen_random_uuid(),2`);
await deny('results cannot finalize before voting deadline','admin',`select public.fun_admin_campaign('${c}','finalize','{}')`);
await db.exec(`update public.fan_zone_campaigns set entry_closes_at=now()-interval '2 minute',vote_closes_at=now()-interval '1 minute' where id='${c}'`);
await deny('late ballot denied','guardian',`select public.fun_vote('${c}','${A.id}',gen_random_uuid(),0)`);
const final=await call('admin','fun_admin_campaign',`'${c}','finalize','{}'`);
check('ties share recognition from valid ballots',final.campaign.results.length===2&&final.campaign.results.every(x=>x.votes===1));
const b=(await q(`select id from public.fan_zone_ballots where campaign_id='${c}' and voter_id='${profiles.other}'`))[0].id;
await call('admin','fun_admin_ballot',`'${b}','Proven invalid test ballot'`);
check('invalidation hides stale results',(await call('guardian','fun_snapshot',`'${c}'`)).results.length===0);
const recount=await call('admin','fun_admin_campaign',`'${c}','recount','{}'`);check('recount uses valid ballots rather than staff choice',recount.campaign.results.length===1&&recount.campaign.results[0].entry_id===O.id);
await call('other','fun_entry',`'${c}','${O.id}','withdraw','{}'`);
await deny('withdrawal denies subsequent pilot media','adult',`select public.fun_media_access('${O.id}',${O.revision},'read')`);
const zero=await call('admin','fun_admin_campaign',`'${c}','recount','{}'`);check('zero valid ballots yields no award',zero.campaign.results.length===0);
const secret='20000000-0000-0000-0000-000000000001';
const deletion=await call('other','fun_case',`'${O.id}','deletion','Remove my private media','${secret}'`);
await deny('other user cannot delete entrant media','adult',`select public.fun_case('${O.id}','deletion','not mine',gen_random_uuid())`);
await deny('deletion cannot be completed before removal','admin',`select public.fun_admin_case('${deletion.case.id}','resolve','Removed')`);
await deny('clients cannot forge actual removal','other',`select public.fun_complete_removal('${O.id}',${O.revision})`);
check('owner can remove after tracked deletion request',(await call('other','fun_media_access',`'${O.id}',${O.revision},'remove'`)).path===O.path);
await db.exec(`delete from storage.objects where bucket_id='fan_zone' and name='${O.path}'`);
await call('server','fun_complete_removal',`'${O.id}',${O.revision}`);
check('actual removal completes deletion receipt',(await call('guest','fun_case_status',`'${deletion.case.id}','${secret}'`)).case.status==='completed');
await deny('wrong receipt secret learns no case','guest',`select public.fun_case_status('${deletion.case.id}',gen_random_uuid())`);
await deny('anonymous person cannot report private draft','guest',`select public.fun_case('${T.id}','report','Concern',gen_random_uuid())`);
const reflection=await call('adult','fun_reflection',`'${c}',null,'encourage','create'`);
await deny('reflection rejects beneficiary free text','adult',`select public.fun_reflection('${c}',null,'Visit 123 private address','create')`);
await deny('private reflection cannot be deleted by another actor','other',`select public.fun_reflection('${c}','${reflection.reflection.id}',null,'delete')`);
await call('adult','fun_reflection',`'${c}','${reflection.reflection.id}',null,'delete'`);
check('own reflection deletion has a receipt',(await call('adult','fun_snapshot',`'${c}'`)).reflections.length===0);
for(const t of ['campaigns','entries','consents','ballots','requests','cases','audit','reflections'])await deny('clients have no direct table grants '+t,'adult',`select count(*) as r from public.fan_zone_${t}`);
const helperGrants=await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'fun_%' and p.proname not in ('fun_snapshot','fun_admin_snapshot','fun_admin_campaign','fun_entry','fun_permission','fun_vote','fun_admin_entry','fun_admin_ballot','fun_case','fun_case_status','fun_admin_case','fun_reflection','fun_media_access','fun_verify_media','fun_complete_removal') and (has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('anon',p.oid,'execute'))`);
check('internal helpers have no client execute grants',helperGrants.length===0);
const admin=await call('admin','fun_admin_snapshot',`'${c}',null`);check('admin snapshot contains complete capped entries and explicit populations',admin.entries.length===3&&admin.counts.entries===3&&Array.isArray(admin.audit)&&Array.isArray(admin.cases));
await deny('fan cannot read corrective admin desk','adult',`select public.fun_admin_snapshot('${c}',null)`);

const oldDeletion=await call('teen','fun_case',`'${T.id}','deletion','Remove every draft revision',gen_random_uuid()`);
const currentRemoval=await call('server','fun_complete_removal',`'${T.id}',${E.revision}`);
check('removal remains incomplete while historical objects remain',currentRemoval.completed===false);
check('owner gets historical media revision list',(await call('teen','fun_snapshot',`'${c}'`)).entry.media_revisions.some(x=>x.revision===T.revision&&x.present));
check('owner can authorize historical removal',(await call('teen','fun_media_access',`'${T.id}',${T.revision},'remove'`)).path===T.path);
await db.exec(`delete from storage.objects where bucket_id='fan_zone' and name='${T.path}'`);
check('all historical removal completes receipt',(await call('server','fun_complete_removal',`'${T.id}',${T.revision}`)).completed===true);
const secretHash=(await q(`select secret_hash from public.fan_zone_cases where id='${deletion.case.id}'`))[0].secret_hash;
check('case secrets are persisted only as SHA256 hashes',secretHash.length===64&&!secretHash.includes(secret));
await db.exec(`update public.fan_zone_cases set expires_at=now()-interval '1 second' where id='${deletion.case.id}'`);
await deny('expired case receipts do not expose status','guest',`select public.fun_case_status('${deletion.case.id}','${secret}')`);
await deny('stale consent caption scope fails atomically','adult',`select public.fun_permission('${A.id}',${A.revision},'assent',${lit({...A.consent_scope,caption:'different'})})`);
await deny('guest media reads are unavailable','guest',`select public.fun_media_access('${A.id}',${A.revision},'read')`);
await deny('unenrolled known-age adult cannot read candidates','guardian2',`select public.fun_media_access('${A.id}',${A.revision},'read')`);
check('unenrolled known-age account gets no campaign',(await call('guardian2','fun_snapshot',`'${c}'`)).campaign===null);
await db.exec(`insert into public.user_blocks(blocker_id,blocked_id) values('${profiles.guardian}','${profiles.adult}')`);
await deny('blocking revokes pilot media access','guardian',`select public.fun_media_access('${A.id}',${A.revision},'read')`);
check('blocking removes candidate listing',!(await call('guardian','fun_snapshot',`'${c}'`)).candidates.some(x=>x.id===A.id));
await deny('consent records cannot be rewritten even by database owner','admin',`update public.fan_zone_consents set scope='{}' returning id as r`);
const rewrite=await db.exec(`update public.fan_zone_consents set scope='{}'`).then(()=>true,e=>/FUN_RECORD_IMMUTABLE/.test(e.message));
check('consent trace is immutable at the database boundary',rewrite===true&&(await q(`select count(*)::int n from public.fan_zone_consents where scope='{}'`))[0].n===0);
await db.exec(`update public.fan_zone_requests set expires_at=now()-interval '1 second'`);
const prune=await call('server','fun_prune_receipts','');
check('expired ballot receipts are actually prunable',prune.deleted_requests>=1&&(await q('select count(*)::int n from public.fan_zone_requests'))[0].n===0);

await db.exec(`insert into public.fan_zone_audit(campaign_id,action) select '${c}','paging_probe' from generate_series(1,60)`);
const firstPage=await call('admin','fun_admin_snapshot',`'${c}',null`);
let auditRows=[...firstPage.audit],page=firstPage;while(page.audit_next_cursor){page=await call('admin','fun_admin_snapshot',`'${c}','${page.audit_next_cursor}'`);auditRows.push(...page.audit);}
check('timestamp cursor retains every audit event inserted in one transaction',new Set(auditRows.map(x=>x.id)).size===firstPage.counts.audit);
const auditRewrite=await db.exec(`delete from public.fan_zone_audit where action='paging_probe'`).then(()=>false,e=>/FUN_RECORD_IMMUTABLE/.test(e.message));check('audit events cannot be deleted',auditRewrite);
for(let i=0;i<5;i++) await call('guest','fun_case',`'${A.id}','report','Pilot safety concern ${i}',gen_random_uuid()`);
const unblockedRemoval=await call('adult','fun_case',`'${A.id}','deletion','Remove despite saturated public reports',gen_random_uuid()`);
check('anonymous report cap cannot block owner deletion',unblockedRemoval.case.kind==='deletion');
// The explicitly relied-on guardian must not be replaced by another historical exact grant.
const bindingCampaign=(await call('admin','fun_admin_campaign',`null,'create',${lit(payload)}`)).campaign.id;
await call('admin','fun_admin_campaign',`'${bindingCampaign}','open','{}'`);
let bindingEntry=(await call('teen','fun_entry',`'${bindingCampaign}',null,'reserve','{}'`)).entry;
bindingEntry=(await call('teen','fun_entry',`'${bindingCampaign}','${bindingEntry.id}','edit',${lit({alias:'Teen cheer',caption:'Family cheer',rights_confirmed:true})}`)).entry;
await act('teen',`insert into storage.objects(bucket_id,name,owner) values('fan_zone','${bindingEntry.path}','${ids.teen}')`);
await call('server','fun_verify_media',`'${bindingEntry.id}',${bindingEntry.revision},'${'b'.repeat(64)}',1024,1000`);
bindingEntry=(await call('teen','fun_entry',`'${bindingCampaign}','${bindingEntry.id}','submit','{}'`)).entry;
await call('admin','fun_admin_entry',`'${bindingEntry.id}','accept','Exact testing media reviewed'`);
const secondLink=(await q(`insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values('${profiles.teen}','${profiles.guardian2}','invite',now()) returning id`))[0].id;
await permit('teen',bindingEntry,'assent');
const firstBinding=(await permit('guardian',bindingEntry,'grant')).entry.guardian_consent_id;
const historicalGrant=await permit('guardian2',bindingEntry,'grant');
check('another guardian receipt does not replace the explicitly relied-on grant',!!firstBinding&&historicalGrant.entry.guardian_consent_id===firstBinding);
await call('other','fun_vote',`'${bindingCampaign}','${bindingEntry.id}',gen_random_uuid(),0`);
for(const boundary of ['revoke','ended_link']){
 await db.exec(`update public.fan_zone_campaigns set entry_closes_at=now()-interval '2 minute',vote_closes_at=now()-interval '1 minute' where id='${bindingCampaign}'`);
 const recognized=await call('admin','fun_admin_campaign',`'${bindingCampaign}','finalize','{}'`);
 check(boundary+' starts with a valid exact guardian-backed result',recognized.campaign.results.length===1&&recognized.campaign.results[0].entry_id===bindingEntry.id);
 if(boundary==='revoke')await permit('guardian',bindingEntry,'revoke');
 else await db.exec(`update public.guardian_links set ended_at=now() where id='${secondLink}'`);
 check(boundary+' hides results despite another historical guardian grant',(await call('other','fun_snapshot',`'${bindingCampaign}'`)).results.length===0);
 await db.exec(`update public.fan_zone_campaigns set status='open',entry_closes_at=now()+interval '1 hour',vote_closes_at=now()+interval '2 hours' where id='${bindingCampaign}'`);
 check(boundary+' removes candidate instead of substituting a historical guardian',!(await call('other','fun_snapshot',`'${bindingCampaign}'`)).candidates.some(x=>x.id===bindingEntry.id));
 await deny(boundary+' denies subsequent pilot media','other',`select public.fun_media_access('${bindingEntry.id}',${bindingEntry.revision},'read')`);
 await deny(boundary+' denies a new ballot','guardian',`select public.fun_vote('${bindingCampaign}','${bindingEntry.id}',gen_random_uuid(),0)`,/FUN_CANDIDATE_UNAVAILABLE/);
 const replacement=boundary==='revoke'?'guardian2':'guardian';
 const replacementEntry=(await permit(replacement,bindingEntry,'grant')).entry;
 const exactReceipt=(await q(`select actor_id,link_id,scope from public.fan_zone_consents where id='${replacementEntry.guardian_consent_id}'`))[0];
 check(boundary+' binds the fresh replacement actor, link and exact scope',exactReceipt.actor_id===profiles[replacement]&&exactReceipt.link_id===(replacement==='guardian2'?secondLink:link)&&JSON.stringify(exactReceipt.scope)===JSON.stringify(bindingEntry.consent_scope));
 check(boundary+' allows a fresh explicit replacement grant',(await call('other','fun_snapshot',`'${bindingCampaign}'`)).candidates.some(x=>x.id===bindingEntry.id));
 if(boundary==='revoke'){
  const staleRevoke=await permit('guardian',bindingEntry,'revoke');
  check('stale prior guardian revoke cannot revoke the newly bound replacement',staleRevoke.entry.guardian_consent_id===replacementEntry.guardian_consent_id&&(await call('other','fun_snapshot',`'${bindingCampaign}'`)).candidates.some(x=>x.id===bindingEntry.id));
  await permit('guardian',bindingEntry,'grant');
 }
}
// Requested Task 1 Safety regressions use only the replay's synthetic in-memory database.
const removalCampaign=(await call('admin','fun_admin_campaign',`null,'create',${lit({...payload,pilot_accounts:[profiles.guardian,profiles.guardian2]})}`)).campaign.id;
await call('admin','fun_admin_campaign',`'${removalCampaign}','open','{}'`);
const saturated=(await call('guardian','fun_entry',`'${removalCampaign}',null,'reserve','{}'`)).entry;
await act('guardian',`insert into storage.objects(bucket_id,name,owner) values('fan_zone','${saturated.path}','${ids.guardian}')`);
check('service can sanitize only the current editable draft',(await act('server',`update storage.objects set metadata='{"sanitized":true}' where bucket_id='fan_zone' and name='${saturated.path}' returning id as r`))!==undefined);
await deny('service cannot rename a reserved object','server',`update storage.objects set name='unreserved.mp4' where bucket_id='fan_zone' and name='${saturated.path}' returning id as r`,/FUN_STORAGE_IMMUTABLE/);
await deny('service cannot move a reserved object to another bucket','server',`update storage.objects set bucket_id='avatars' where bucket_id='fan_zone' and name='${saturated.path}' returning id as r`,/FUN_STORAGE_IMMUTABLE/);
await deny('service cannot transfer immutable reserved object ownership','server',`update storage.objects set owner='${ids.admin}' where bucket_id='fan_zone' and name='${saturated.path}' returning id as r`,/FUN_STORAGE_IMMUTABLE/);
for(let i=0;i<10;i++) await call('guardian','fun_case',`'${saturated.id}','appeal','Private signed intake ${i}',gen_random_uuid()`);
// Seed the independent public queue bound; authorized removal must remain available at global saturation too.
await db.exec(`insert into public.fan_zone_cases(entry_id,revision,path,kind,details,secret_hash) select '${A.id}',${A.revision},'${A.path}','report','Global intake saturation fixture',encode(public.digest('queue-fixture-'||i::text,'sha256'),'hex') from generate_series(1,495) i`);
check('public report queue reaches its bounded population',(await q(`select count(*)::int n from public.fan_zone_cases where kind='report' and status in ('open','escalated')`))[0].n>=500);
let saturatedDeletion;
try{saturatedDeletion=await call('guardian','fun_case',`'${saturated.id}','deletion','Remove after signed intake cap',gen_random_uuid()`);check('signed intake saturation cannot prevent owner deletion',saturatedDeletion.case.kind==='deletion');}catch(e){check('signed intake saturation cannot prevent owner deletion',false);}
if(saturatedDeletion){
 await deny('duplicate deletion does not create an unbounded second active case','guardian',`select public.fun_case('${saturated.id}','deletion','Duplicate removal request',gen_random_uuid())`);
 check('existing deletion still authorizes owner object removal',(await call('guardian','fun_media_access',`'${saturated.id}',${saturated.revision},'remove'`)).path===saturated.path);
 await deny('service cannot rewrite a draft with tracked removal requested','server',`update storage.objects set metadata='{}' where bucket_id='fan_zone' and name='${saturated.path}' returning id as r`,/FUN_STORAGE_IMMUTABLE/);
 const active=(await q(`select count(*)::int n from public.fan_zone_cases where entry_id='${saturated.id}' and kind='deletion' and status in ('open','escalated')`))[0].n;check('one active deletion request bounds duplicates',active===1);
}
const blockedOwner=(await call('guardian2','fun_entry',`'${removalCampaign}',null,'reserve','{}'`)).entry;
await act('guardian2',`insert into storage.objects(bucket_id,name,owner) values('fan_zone','${blockedOwner.path}','${ids.guardian2}')`);
await db.exec(`update public.profiles set age_blocked_at=now() where id='${profiles.guardian2}'`);
let staffDeletion;
try{staffDeletion=await call('admin','fun_case',`'${blockedOwner.id}','deletion','Staff safety removal for closed owner',gen_random_uuid()`);check('admin can initiate tracked removal for age-blocked owner',staffDeletion.case.kind==='deletion');}catch(e){check('admin can initiate tracked removal for age-blocked owner',false);}
if(staffDeletion){
 check('staff deletion authorizes private object removal',(await call('admin','fun_media_access',`'${blockedOwner.id}',${blockedOwner.revision},'remove'`)).path===blockedOwner.path);
 await deny('blocked owner cannot authorize removal as a client','guardian2',`select public.fun_media_access('${blockedOwner.id}',${blockedOwner.revision},'remove')`);
 await call('admin','fun_admin_case',`'${staffDeletion.case.id}','escalate','Staff removal is awaiting actual server deletion'`);
 await db.exec(`delete from storage.objects where bucket_id='fan_zone' and name='${blockedOwner.path}'`);
 check('service removal completes the staff initiated tracked receipt',(await call('server','fun_complete_removal',`'${blockedOwner.id}',${blockedOwner.revision}`)).completed===true);
}
await deny('service cannot overwrite a verified immutable object','server',`update storage.objects set metadata='{}' where bucket_id='fan_zone' and name='${A.path}' returning id as r`,/FUN_STORAGE_IMMUTABLE/);
await deny('late service insert cannot recreate an object after completed removal','server',`insert into storage.objects(bucket_id,name,owner) values('fan_zone','${O.path}','${ids.other}')`,/FUN_STORAGE_IMMUTABLE/);
await db.exec(fs.readFileSync('supabase/migrations/20261014130000_fan_zone.sql','utf8'));check('Fan Zone migration replays idempotently',true);
console.log(`\n${tests.filter(t=>t.ok).length}/${tests.length} Fan Zone actor checks passed`);await db.close();process.exit(tests.every(t=>t.ok)?0:1);
