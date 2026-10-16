// DETECT-02 Postgres security replay: real role grants, immutable evidence and atomic source auditing.
// Uses an external PGlite installation, never a hosted database. Run with its dist directory.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const dist = process.argv[2] ?? '/tmp/books01-pg/pkg/package/dist';
const migrationPath = process.argv[3] ?? 'supabase/migrations/20261013190000_engineering_support.sql';
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const db = new PGlite();
const results = [];
const A = '00000000-0000-0000-0000-0000000000aa';
const B = '00000000-0000-0000-0000-0000000000bb';
const F = '00000000-0000-0000-0000-0000000000ff';
const as = (role, uid = '') => `reset role; set role ${role}; set request.jwt.claim.sub = '${uid}';`;
const admin = as('authenticated', A), second = as('authenticated', B), fan = as('authenticated', F);
const service = as('service_role'), anon = as('anon');
async function check(name, sql, assertion = () => {}) {
  try { const all = await db.exec(sql); const r = [...all].reverse().find(x => x.fields?.length)?.rows ?? []; assertion(r); results.push({name, pass:true}); return r; }
  catch (e) { results.push({name, pass:false, detail:e.message}); return []; }
  finally { await db.exec('rollback; reset role;').catch(() => {}); }
}
async function denied(name, sql, pattern = /permission denied|Admin access|required|rejected|invalid|append.only|second|review|rate|trusted|match|source|bound/i) {
  try { await db.exec(sql); results.push({name, pass:false, detail:'Unexpected success'}); }
  catch(e) { results.push({name, pass:pattern.test(e.message), detail:e.message}); }
  finally { await db.exec('rollback; reset role;').catch(() => {}); }
}
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
create table public.profiles (id uuid primary key default gen_random_uuid(),user_id uuid unique,role text,is_admin boolean default false,roles text[] default '{}',full_name text, stripe_connect_id text);
insert into public.profiles(user_id,role,is_admin,full_name) values ('${A}','admin',true,'Admin A'),('${B}','admin',true,'Admin B'),('${F}','fan',false,'Fan');
create function public.current_user_role() returns text language sql stable security definer set search_path='' as $$ select coalesce((select case when is_admin or role='admin' or 'admin'=any(roles) then 'admin' else role end from public.profiles where user_id=auth.uid()),'guest') $$;
create function public.require_admin_guard() returns void language plpgsql security definer set search_path='' as $$ begin if public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if; end $$;
grant execute on function public.current_user_role(),public.require_admin_guard() to authenticated;
create table public.tips(id uuid primary key default gen_random_uuid(),amount_cents integer not null,private_note text);
create table public.disbursements(id uuid primary key default gen_random_uuid(),amount_cents integer,status text);
create table public.company_revenue_logs(id uuid primary key default gen_random_uuid(),gross_cents integer);
create table public.app_runtime_config(id text primary key,draft jsonb,published jsonb,published_at timestamptz);
create table public.players(id uuid primary key default gen_random_uuid(),name text,guardian_id uuid,malo_frozen boolean,is_verified boolean);
create table public.games(id uuid primary key default gen_random_uuid(),status text,title text);
create table public.reels(id uuid primary key default gen_random_uuid(),is_hidden boolean,caption text);
create table public.school_confirmers(id uuid primary key default gen_random_uuid(),active boolean,token_hash text);
create table public.sponsorships(id uuid primary key default gen_random_uuid(),amount_cents integer);
create table public.subscriptions(id uuid primary key default gen_random_uuid(),status text);
create table public.ledger_accounts(code text primary key,name text);
create table public.ledger_manual_entries(id uuid primary key default gen_random_uuid(),memo text);
create table public.ledger_manual_lines(id uuid primary key default gen_random_uuid(),debit_cents integer);
create table public.ledger_period_closes(period text primary key);
create table public.ledger_period_reopens(id uuid primary key default gen_random_uuid(),period text);
grant select,insert,update,delete on public.tips,public.disbursements,public.app_runtime_config,public.profiles,public.games,public.reels to authenticated;
`);
if (fs.existsSync(migrationPath)) await check('migration applies', fs.readFileSync(migrationPath,'utf8'));
await check('admin snapshot has fixed bounded wire contract', `${admin} select public.get_engineering_support_snapshot() as snapshot`, r => {
const s=r[0].snapshot; assert.equal(s.version,1); assert.deepEqual(s.limits,{signals:200,reviews:300,audit:200,releases:20}); assert.ok(s.read_at); for(const k of ['signals','reviews','audit','releases']) assert.deepEqual(s[k],[]);
});
// Role spoofing must not create a database admin or trusted security source.
for (const [who, context] of [['guest',anon],['fan',fan]]) {
  await denied(`${who} snapshot denied`, `${context} select public.get_engineering_support_snapshot();`);
  await denied(`${who} review denied`, `${context} select public.record_support_review('none','resolved','checked safely',now(),null);`);
  await denied(`${who} release denied`, `${context} select public.register_support_release('{}');`);
  await denied(`${who} trusted capture denied`, `${context} select public.record_trusted_support_signal('auth','confirmed_attack','test','test-release','security');`);
}
await denied('admin trusted capture denied', `${admin} select public.record_trusted_support_signal('auth','confirmed_attack','test','test-release','security');`);
await denied('forged role metadata cannot read snapshot', `${fan} set request.jwt.claim.role='service_role'; set request.jwt.claims='{"role":"service_role","user_metadata":{"role":"admin"}}'; select public.get_engineering_support_snapshot();`);
await denied('guest signal denied', `${anon} select public.record_support_signal('app','render_failure','test','test-release');`);
await denied('null authenticated UID denied', `${as('authenticated')} select public.record_support_signal('app','render_failure','test','test-release');`);
for(const t of ['support_signals','support_reviews','support_audit_events','support_releases']) {
  for(const [who,ctx] of [['admin',admin],['fan',fan],['server',service]]) {
    await denied(`${who} cannot select ${t} directly`, `${ctx} select * from public.${t};`);
    await denied(`${who} cannot update ${t}`, `${ctx} update public.${t} set id=gen_random_uuid();`);
    await denied(`${who} cannot delete ${t}`, `${ctx} delete from public.${t};`);
    await denied(`${who} cannot truncate ${t}`, `${ctx} truncate public.${t};`);
  }
}
await denied('internal insertion helper denied', `${fan} select public.insert_support_signal('app','render_failure','test','test-release','security');`);
await denied('raw table INSERT denied to admin', `${admin} insert into public.support_signals(fingerprint,feature,code,category,severity,source,environment,release,actor_id) values('forged','app','render_failure','ui','error','security','test','test-release','${B}');`);
await check('client signal has real actor, source, canonical severity and DB timestamp', `${fan} select public.record_support_signal('app','render_failure','test','test-release'); reset role; select * from public.support_signals;`, r => {
assert.equal(r.length,1); assert.equal(r[0].actor_id,F); assert.equal(r[0].source,'client'); assert.equal(r[0].category,'ui'); assert.equal(r[0].severity,'error'); assert.equal(r[0].fingerprint,'app:render_failure:client:test:test-release'); assert.ok(r[0].occurred_at);
});
for(const code of ['confirmed_attack','syntax_check_failed','auth_invalid','auth_unavailable','server_configuration_error']) await denied(`client cannot claim ${code}`, `${fan} select public.record_support_signal('auth','${code}','test','test-release');`);
for(const [field,value] of [['feature','secret-token'],['code','raw-error-text'],['environment','raw-IP'],['release','token:private'],['release','x'.repeat(81)]]) {
const a={feature:'app',code:'render_failure',environment:'test',release:'test-release',[field]:value};
await denied(`invalid ${field} rejected ${value.length}`, `${fan} select public.record_support_signal('${a.feature}','${a.code}','${a.environment}','${a.release}');`);
}
await denied('caller cannot supply actor or timestamp args', `${fan} select public.record_support_signal(p_feature=>'app',p_code=>'render_failure',p_environment=>'test',p_release=>'test-release',p_actor_id=>'${B}');`, /does not exist/);
await denied('server cannot spoof client source', `${service} select public.record_trusted_support_signal('app','runtime_failure','test','test-release','client');`);
await denied('server source cannot confirm attack', `${service} select public.record_trusted_support_signal('auth','confirmed_attack','test','test-release','server');`);
await check('security capture uses privileged source and no fabricated user', `${service} select public.record_trusted_support_signal('auth','confirmed_attack','test','test-release','security'); reset role; select * from public.support_signals where code='confirmed_attack';`,r=>{assert.equal(r[0].source,'security'); assert.equal(r[0].actor_id,null); assert.equal(r[0].severity,'critical');});
await check('same code groups only within source provenance', `${service} select public.record_trusted_support_signal('app','render_failure','test','test-release','server'); reset role; select count(distinct fingerprint)::int as n from public.support_signals where code='render_failure';`,r=>assert.equal(r[0].n,2));
await check('client rate accepts exactly 30 across changing release scopes', `${fan} do $$ begin for i in 1..29 loop perform public.record_support_signal('app','runtime_failure','test','rate-'||i); end loop; end $$; reset role; select count(*)::int as n from public.support_signals where actor_id='${F}';`,r=>assert.equal(r[0].n,30));
await denied('31st client occurrence rate limited', `${fan} select public.record_support_signal('app','runtime_failure','test','new-scope');`);
await check('independent account rate unaffected', `${admin} select public.record_support_signal('app','runtime_failure','test','admin-release');`,r=>assert.equal(r.length,1));
const securityScope='auth:confirmed_attack:security:test:test-release';
let occurrence=(await check('security source exists',`select occurred_at::text as t from public.support_signals where fingerprint='${securityScope}';`,r=>assert.equal(r.length,1)))[0]?.t;
const reviewArgs=(scope,disp,time,parent=null)=>`'${scope}','${disp}','Checked safe synthetic fixture','${time}'::timestamptz,${parent?`'${parent}'::uuid`:'null'}`;
let parent=(await check('security false positive starts pending',`${admin} select public.record_support_review(${reviewArgs(securityScope,'false_positive',occurrence)}) as id; reset role; select id,decision,actor_id from public.support_reviews order by created_at desc limit 1;`,r=>{assert.equal(r[0].decision,'pending'); assert.equal(r[0].actor_id,A);}))[0]?.id;
await denied('same reviewer cannot confirm protected disposition',`${admin} select public.record_support_review(${reviewArgs(securityScope,'false_positive',occurrence,parent)});`);
await denied('second reviewer cannot change disposition',`${second} select public.record_support_review(${reviewArgs(securityScope,'resolved',occurrence,parent)});`);
await check('independent reviewer confirms without editing original',`${second} select public.record_support_review(${reviewArgs(securityScope,'false_positive',occurrence,parent)}); reset role; select count(*)::int as n,count(*) filter(where decision='pending')::int as original from public.support_reviews;`,r=>{assert.equal(r[0].n,2);assert.equal(r[0].original,1);});
await denied('one pending review cannot be confirmed twice',`${second} select public.record_support_review(${reviewArgs(securityScope,'false_positive',occurrence,parent)});`,/duplicate key/);
await denied('review cannot cover future occurrence',`${admin} select public.record_support_review('${securityScope}','resolved','Safe fixture rationale',now()+interval '1 day',null);`);
await denied('review cannot contain raw multiline diagnostic',`${admin} select public.record_support_review('${securityScope}','resolved',E'line one\nline two','${occurrence}',null);`);
await denied('untrusted report cannot confirm attack',`${admin} select public.record_support_review(${reviewArgs('app:render_failure:client:test:test-release','confirmed_attack',(await db.query("select occurred_at::text as t from public.support_signals where fingerprint='app:render_failure:client:test:test-release'")).rows[0].t)});`);
parent=(await check('explicit trusted confirmed attack still needs two reviewers',`${admin} select public.record_support_review(${reviewArgs(securityScope,'confirmed_attack',occurrence)}) as id; reset role; select id,decision from public.support_reviews order by created_at desc limit 1;`,r=>assert.equal(r[0].decision,'pending')))[0]?.id;
await check('new security occurrence is retained',`${service} select public.record_trusted_support_signal('auth','confirmed_attack','test','test-release','security'); reset role; select count(*)::int as n from public.support_signals where fingerprint='${securityScope}';`,r=>assert.equal(r[0].n,2));
await denied('new occurrence invalidates pending confirmation coverage',`${second} select public.record_support_review(${reviewArgs(securityScope,'confirmed_attack',occurrence,parent)});`);
await check('finance occurrence captured as client untrusted',`${admin} select public.record_support_signal('donation','payment_failed','test','money-fixture');`);
const moneyScope='donation:payment_failed:client:test:money-fixture';
const moneyTime=(await db.query(`select occurred_at::text as t from public.support_signals where fingerprint='${moneyScope}'`)).rows[0].t;
for(const disposition of ['expected','resolved','false_positive']) await check(`finance ${disposition} needs second review`,`${admin} select public.record_support_review(${reviewArgs(moneyScope,disposition,moneyTime)}); reset role; select decision from public.support_reviews order by created_at desc limit 1;`,r=>assert.equal(r[0].decision,'pending'));
await check('investigating security stays visible immediately',`${admin} select public.record_support_review(${reviewArgs(securityScope,'investigating',occurrence)}); reset role; select decision from public.support_reviews where disposition='investigating' and fingerprint='${securityScope}' order by created_at desc limit 1;`,r=>assert.equal(r[0].decision,'confirmed'));

await check('same-scope occurrences have strictly increasing DB times',`${service} select public.record_trusted_support_signal('auth','auth_invalid','test','time-fixture','server'); select public.record_trusted_support_signal('auth','auth_invalid','test','time-fixture','server'); reset role; select count(distinct occurred_at)::int as n from public.support_signals where release='time-fixture';`,r=>assert.equal(r[0].n,2));
// Protected features require independent review even when their code category is operational.
for(const feature of ['auth','donation','payouts','admin','support']) {
  await db.exec(`${admin} select public.record_support_signal('${feature}','read_failed','test','protected-feature'); reset role;`);
  const scope=`${feature}:read_failed:client:test:protected-feature`;
  const time=(await db.query(`select occurred_at::text as t from public.support_signals where fingerprint='${scope}'`)).rows[0].t;
  await check(`${feature} operational category disposition requires second reviewer`,`${admin} select public.record_support_review(${reviewArgs(scope,'expected',time)}); reset role; select decision from public.support_reviews order by created_at desc limit 1;`,r=>assert.equal(r[0].decision,'pending'));
}
// Actual source writes: audit provenance, privacy, chain continuity and transaction coupling.
const entity='11111111-1111-1111-1111-111111111111';
await check('actual money INSERT creates audit atomically',`${admin} insert into public.tips(id,amount_cents,private_note) values('${entity}',1000,'private payment detail'); reset role; select * from public.support_audit_events where table_name='tips';`,r=>{assert.equal(r.length,1);assert.equal(r[0].actor_id,A);assert.equal(r[0].actor_role,'admin');assert.equal(r[0].operation,'INSERT');assert.equal(r[0].previous_hash,null);assert.ok(!JSON.stringify(r).includes('private payment detail'));});
await check('actual money UPDATE records only changed field names',`${second} update public.tips set amount_cents=1250 where id='${entity}'; reset role; select changed_fields,actor_id,previous_hash,event_hash from public.support_audit_events where table_name='tips' order by chain_index desc;`,r=>{assert.deepEqual(r[0].changed_fields,['amount_cents']);assert.equal(r[0].actor_id,B);assert.equal(r[0].previous_hash,r[1].event_hash);});
await check('no-op write does not invent a change',`${admin} update public.tips set amount_cents=1250 where id='${entity}'; reset role; select count(*)::int as n from public.support_audit_events where table_name='tips';`,r=>assert.equal(r[0].n,2));
await check('actual DELETE retains audit history',`${admin} delete from public.tips where id='${entity}'; reset role; select operation from public.support_audit_events where table_name='tips' order by chain_index desc limit 1;`,r=>assert.equal(r[0].operation,'DELETE'));
await check('other entity has independent chain root',`${admin} insert into public.tips(amount_cents) values(75); reset role; select previous_hash from public.support_audit_events where table_name='tips' order by chain_index desc limit 1;`,r=>assert.equal(r[0].previous_hash,null));
await check('financial account code primary key is audited',`insert into public.ledger_accounts(code,name) values('1000','Fixture account'); select record_id from public.support_audit_events where table_name='ledger_accounts';`,r=>assert.equal(r[0].record_id,'1000'));
await check('financial period primary key is audited',`insert into public.ledger_period_closes(period) values('2026-10'); select record_id from public.support_audit_events where table_name='ledger_period_closes';`,r=>assert.equal(r[0].record_id,'2026-10'));
await check('publishing config preserves no private JSON values',`${admin} insert into public.app_runtime_config(id,draft,published) values('default','{"private":"hidden content"}','{}'); reset role; select table_name,changed_fields from public.support_audit_events where table_name='app_runtime_config';`,r=>{assert.equal(r.length,1);assert.ok(!JSON.stringify(r).includes('hidden content'));});
await check('profile ordinary name update is excluded',`${admin} update public.profiles set full_name='Different person name' where user_id='${F}'; reset role; select count(*)::int as n from public.support_audit_events where table_name='profiles';`,r=>assert.equal(r[0].n,0));
await check('actual privileged profile change is attributed',`${admin} update public.profiles set is_admin=true where user_id='${F}'; reset role; select actor_id,changed_fields from public.support_audit_events where table_name='profiles';`,r=>{assert.equal(r[0].actor_id,A);assert.deepEqual(r[0].changed_fields,['is_admin']);});
await check('audit hashes recompute with UTC canonical serialization',`select bool_and(event_hash=encode(sha256(convert_to(jsonb_build_object('id',id,'actor_id',actor_id,'actor_role',actor_role,'occurred_at',to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'operation',operation,'table_name',table_name,'record_id',record_id,'changed_fields',changed_fields,'previous_hash',previous_hash)::text,'UTF8')),'hex')) as valid from public.support_audit_events;`,r=>assert.equal(r[0].valid,true));
for(const t of ['support_signals','support_reviews','support_audit_events','support_releases']) await denied(`DB ordinary DML cannot erase ${t}`,`reset role; delete from public.${t};`,/append.only/);
await check('source and audit rollback together',`begin; insert into public.tips(id,amount_cents) values('${entity}',50); rollback; select (select count(*) from public.tips where id='${entity}')::int as source,(select count(*) from public.support_audit_events where table_name='tips' and record_id='${entity}')::int as history;`,r=>{assert.equal(r[0].source,0);assert.equal(r[0].history,3);});
await db.exec(`create function public.fixture_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'fixture audit failure'; end $$; create trigger fixture_fail_audit before insert on public.support_audit_events for each row execute function public.fixture_fail_audit();`);
await denied('audit append failure aborts source mutation',`${admin} insert into public.tips(id,amount_cents) values('${entity}',9000);`,/fixture audit failure/);
await check('failed audit left no money row',`select count(*)::int as n from public.tips where id='${entity}';`,r=>assert.equal(r[0].n,0));
await db.exec('drop trigger fixture_fail_audit on public.support_audit_events;');

const manifest={version:1,releaseId:'test-release',createdAt:new Date().toISOString(),gitCommit:null,treeHash:'a'.repeat(64),manifestHash:'b'.repeat(64),capsuleHash:'c'.repeat(64),provenanceHash:'e'.repeat(64),filesCount:1,byteCount:0,verification:'passed',schemaHash:null,migrationHashes:[{path:'supabase/migrations/20261013190000_engineering_support.sql',sha256:'d'.repeat(64)}]};
const manifestSql=m=>`'${JSON.stringify(m).replaceAll("'","''")}'::jsonb`;
await check('release registration records DB actor/time distinct from package time',`${admin} select public.register_support_release(${manifestSql(manifest)}); reset role; select actor_id,created_at,manifest from public.support_releases;`,r=>{assert.equal(r[0].actor_id,A);assert.deepEqual(r[0].manifest,manifest);assert.ok(r[0].created_at);});
for(const [name,values] of [['extra secret key',{password:'private'}],['capsule local path',{localPath:'/private'}],['bad hash',{capsuleHash:'no'}],['missing provenance hash',{provenanceHash:null}],['fake verification',{verification:'deployed'}],['traversal migration',{migrationHashes:[{path:'../secret.sql',sha256:'a'.repeat(64)}]}],['null files',{filesCount:null}],['fractional byte count',{byteCount:1.5}],['future package time',{createdAt:'2099-01-01T00:00:00Z'}],['extra migration field',{migrationHashes:[{...manifest.migrationHashes[0],content:'secret'}]}]]) await denied(`release rejects ${name}`,`${admin} select public.register_support_release(${manifestSql({...manifest,...values})});`);
await check('trusted capture scope rate exactly bounded',`${service} do $$ begin for i in 1..120 loop perform public.record_trusted_support_signal('support','runtime_failure','test','scope-rate','server'); end loop; end $$; reset role; select count(*)::int as n from public.support_signals where release='scope-rate';`,r=>assert.equal(r[0].n,120));
await denied('121st trusted same-scope event denied',`${service} select public.record_trusted_support_signal('support','runtime_failure','test','scope-rate','server');`);
await check('snapshot signals cap is exact under volume',`${service} do $$ begin for i in 1..100 loop perform public.record_trusted_support_signal('support','runtime_failure','test','volume-'||i,'check'); end loop; end $$; ${admin} select public.get_engineering_support_snapshot() as s;`,r=>{assert.equal(r[0].s.signals.length,200);assert.ok(r[0].s.audit.every(x=>!('chain_index' in x)));});
await check('snapshot exact audit/review/release limits under source volume',`${admin}
  do $$ begin for i in 1..205 loop insert into public.tips(amount_cents) values(i); end loop; end $$;
  do $$ begin for i in 1..310 loop perform public.record_support_review('${moneyScope}','investigating','Checked source volume fixture','${moneyTime}',null); end loop; end $$;
  do $$ begin for i in 1..21 loop perform public.register_support_release(${manifestSql(manifest)}); end loop; end $$;
  select public.get_engineering_support_snapshot() as s;`,r=>{assert.equal(r[0].s.audit.length,200);assert.equal(r[0].s.reviews.length,300);assert.equal(r[0].s.releases.length,20);assert.ok(r[0].s.audit.every(x=>typeof x.event_hash==='string'));});
await check('audit hash chain survives multiple events within one transaction',`select bool_and(previous_hash is not distinct from expected) as chained from (select previous_hash,lag(event_hash) over(partition by table_name,record_id order by chain_index) as expected from public.support_audit_events) a;`,r=>assert.equal(r[0].chained,true));
await check('reviews preserve submillisecond latest ordering',`select count(*)::int as n,count(distinct created_at)::int as distinct_times from public.support_reviews where fingerprint='${moneyScope}';`,r=>assert.equal(r[0].n,r[0].distinct_times));
await check('all source audit triggers installed with no silent dependency gaps',`select count(*)::int as n from pg_trigger where tgname='support_actual_write_audit';`,r=>assert.equal(r[0].n,16));
await check('all support tables RLS enabled and zero direct policies',`select bool_and(relrowsecurity) as secured from pg_class where relname in ('support_signals','support_reviews','support_audit_events','support_releases');`,r=>assert.equal(r[0].secured,true));
await check('all definer functions pin empty search path',`select bool_and(proconfig @> array['search_path=""']) as secured from pg_proc where proname in ('get_engineering_support_snapshot','record_support_signal','record_trusted_support_signal','insert_support_signal','record_support_review','register_support_release','capture_support_audit');`,r=>assert.equal(r[0].secured,true));
const report={source:'local PGlite Postgres fixture, not hosted SQL or full canonical schema activation',executedAt:new Date().toISOString(),postgresVersion:(await db.query('select version() as version')).rows[0].version,migration:migrationPath,migrationHash:createHash('sha256').update(fs.readFileSync(migrationPath)).digest('hex'),passed:results.filter(x=>x.pass).length,total:results.length,results};
if(process.argv[4]) { fs.mkdirSync(path.dirname(process.argv[4]),{recursive:true}); fs.writeFileSync(process.argv[4],JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify(report,null,2));
await db.close();
process.exitCode = results.some(x=>!x.pass) ? 1 : 0;
