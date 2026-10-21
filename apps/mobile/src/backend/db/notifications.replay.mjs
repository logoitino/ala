#!/usr/bin/env node
/**
 * Replays notification recipient, source, preference and worker rules on real local PostgreSQL.
 * Requires an already installed external PGlite dist; absent engine exits2 with zero SQL cases.
 * Supabase roles/Auth are synthetic. One connection cannot prove multi-connection lock scheduling.
 * Usage: node apps/mobile/src/backend/db/notifications.replay.mjs <pglite-dist> [schema.sql]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { SUPABASE_STUBS } from '../../../../../scripts/replay/supabase-stubs.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const [dist, schemaPath = path.join(root, 'apps/mobile/src/backend/db/schema.sql')] = process.argv.slice(2);
// Requires two real database connections; this single-connection runner cannot execute it.
const concurrencyCases = ['expiry recovery racing completion locks delivery before attempt'];
if (!dist || !fs.existsSync(path.join(dist, 'index.js')) || !fs.existsSync(path.join(dist, 'pglite.wasm'))) {
  console.error(JSON.stringify({ status: 'not_run', cases: 0, reason: 'installed_postgresql_engine_unavailable', concurrency: { declared: concurrencyCases.length, executed: 0 } }));
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
// Real Auth has this field. The stand-in must expose confirmation to test activation accurately.
await db.exec('alter table auth.users add column email_confirmed_at timestamptz;');
try { await db.exec(fs.readFileSync(schemaPath, 'utf8')); }
catch (e) { console.error(JSON.stringify({ status: 'failed', cases: 0, reason: e.message })); process.exit(1); }
const A='00000000-0000-0000-0000-00000000a011',B='00000000-0000-0000-0000-00000000b011',ADMIN='00000000-0000-0000-0000-00000000c011';
const query=async sql=>(await db.query(sql)).rows;
const scalar=async sql=>Object.values((await query(sql))[0])[0];
const actor=id=>`set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${id}"}';`;
const service=`set role service_role; set request.jwt.claims='{"role":"service_role"}';`;
await db.exec(`insert into auth.users(id,email) values('${A}','a@example.invalid'),('${B}','b@example.invalid'),('${ADMIN}','admin@example.invalid');
 update public.profiles set role='admin',is_admin=true where user_id='${ADMIN}';`);
const results=[];
async function check(name,run){await db.exec('begin');try{await run();results.push({name,pass:true});}catch(e){results.push({name,pass:false,detail:e.message});}finally{await db.exec('rollback;reset role;reset request.jwt.claims;');}}
async function denied(sql,code='42501'){await db.exec('savepoint denial');let error;try{await db.exec(sql);}catch(e){error=e;}await db.exec('rollback to savepoint denial');assert.ok(error,'unexpected authorization');assert.equal(error.code,code);}
await check('every optional email starts off; games in-app starts off',async()=>{await db.exec(actor(A));const p=await scalar('select public.get_notification_preferences()');assert.equal(p.revision,0);assert.equal(p.emailEnabled,true);assert.ok(Object.values(p.categories).every(c=>c.email===false));assert.equal(p.categories.games.inApp,false);});
await check('authenticated client cannot write any notification table',async()=>{await db.exec(actor(A));for(const t of ['notification_preferences','notification_config','notification_events','notification_inbox','notification_deliveries','notification_delivery_attempts','notification_account_activations','notification_inbox_snapshots','notification_admin_audit'])await denied(`delete from public.${t}`);});
await check('guest and claimless actor cannot read preferences',async()=>{await db.exec(`set role anon;set request.jwt.claims='{}';`);await denied('select public.get_notification_preferences()');await db.exec('reset role');await db.exec(`set role authenticated;set request.jwt.claims='{}';`);await denied('select public.get_notification_preferences()');});
await check('unknown category and stale preference revision rejected',async()=>{await db.exec(actor(A));let p=await scalar('select public.get_notification_preferences()');p.categories.unregistered={email:true,inApp:true};await denied(`select public.save_notification_preferences(0,'${JSON.stringify(p)}','${A}')`,'22023');delete p.categories.unregistered;p.categories.account.email=true;const saved=await scalar(`select public.save_notification_preferences(0,'${JSON.stringify(p)}','${A}')`);assert.equal(saved.revision,1);await denied(`select public.save_notification_preferences(0,'${JSON.stringify(p)}','${A}')`,'40001');});
await check('staff config is admin-only; availability is recipient-safe',async()=>{await db.exec(actor(A));await denied('select public.get_admin_notification_config()');const a=await scalar('select public.get_notification_availability()');assert.equal(a.sourceAvailability.account,true);assert.equal(a.sourceAvailability.donation_receipts,false);assert.equal(a.revision,undefined);});
await check('unknown/unavailable source cannot be enabled by admin',async()=>{await db.exec(actor(ADMIN));const c=await scalar('select public.get_admin_notification_config()');c.categories.donation_receipts=true;await denied(`select public.set_admin_notification_config(0,'${JSON.stringify(c)}','${ADMIN}','reviewed_change')`,'22023');});
await check('clients cannot enqueue events or choose recipients',async()=>{await db.exec(actor(A));await denied(`select public.emit_notification_event('account_welcome:${A}','account_welcome','${A}')`);});
await check('service rejects arbitrary event and incorrect stable key',async()=>{await db.exec(service);await denied(`select public.emit_notification_event('arbitrary','social','${A}')`,'22023');await denied(`select public.emit_notification_event('arbitrary','account_welcome','${A}')`,'22023');});
await check('unconfirmed signup does not activate; confirmed eligible activation is deduplicated',async()=>{await db.exec(`update public.profiles set birth_year=2000,birth_month=1,role='fan' where user_id='${A}';`);assert.equal(await scalar(`select count(*)::int from public.notification_events where reference_id='${A}'`),0);await db.exec(`update auth.users set email_confirmed_at=now() where id='${A}';`);assert.equal(await scalar(`select count(*)::int from public.notification_events where reference_id='${A}'`),1);await db.exec(`update auth.users set raw_user_meta_data='{"login":"returning"}' where id='${A}';update public.profiles set full_name='Returning' where user_id='${A}';`);assert.equal(await scalar(`select count(*)::int from public.notification_events where reference_id='${A}'`),1);});
async function inboxFixture(){await db.exec(`insert into public.notification_events(event_key,event_type,category,reference_id,payload) values('fixture:1','account_welcome','account','${A}','{"version":1,"kind":"account_welcome","referenceId":"${A}"}');`);const event=await scalar("select id from public.notification_events where event_key='fixture:1'");return await scalar(`insert into public.notification_inbox(event_id,recipient_id) values('${event}','${A}') returning id`);}
async function enableAccountEmail(){
 await db.exec(`update public.profiles set birth_year=2000,birth_month=1,role='fan' where user_id='${A}';update auth.users set email_confirmed_at=now() where id='${A}';`);
 await db.exec(actor(ADMIN));const c=await scalar('select public.get_admin_notification_config()');c.emailEnabled=true;c.inAppEnabled=true;c.categories.account=true;
 await scalar(`select public.set_admin_notification_config(${c.revision},'${JSON.stringify(c)}','${ADMIN}','reviewed_change')`);await db.exec('reset role');
 await db.exec(actor(A));const p=await scalar('select public.get_notification_preferences()');p.categories.account.email=true;
 await scalar(`select public.save_notification_preferences(${p.revision},'${JSON.stringify(p)}','${A}')`);await db.exec('reset role');
}
await check('matching preference revision cannot save through a mismatched or NULL expected actor',async()=>{
 await db.exec(actor(A));const p=await scalar('select public.get_notification_preferences()');p.emailEnabled=false;
 await denied(`select public.save_notification_preferences(${p.revision},'${JSON.stringify(p)}','${B}')`);
 await denied(`select public.save_notification_preferences(${p.revision},'${JSON.stringify(p)}',null)`);
 const unchanged=await scalar('select public.get_notification_preferences()');assert.equal(unchanged.revision,p.revision);assert.equal(unchanged.emailEnabled,true);
});
await check('matching admin config revision cannot write through a mismatched or NULL expected actor',async()=>{
 await db.exec(actor(ADMIN));const c=await scalar('select public.get_admin_notification_config()');c.inAppEnabled=true;
 await denied(`select public.set_admin_notification_config(${c.revision},'${JSON.stringify(c)}','${A}','reviewed_change')`);
 await denied(`select public.set_admin_notification_config(${c.revision},'${JSON.stringify(c)}',null,'reviewed_change')`);
 assert.equal((await scalar('select public.get_admin_notification_config()')).revision,c.revision);
 await db.exec('reset role');assert.equal(await scalar('select count(*)::int from public.notification_admin_audit'),0);
});
await check('eligible known-failure retry cannot write through a mismatched or NULL expected actor',async()=>{
 await enableAccountEmail();const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);
 const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category,status,attempts,retryable,last_error_code) values('${e}','${A}','account','failed',1,true,'provider_unavailable') returning id`);
 await db.exec(actor(ADMIN));await denied(`select public.retry_notification_job('${job}','${A}','retry_known_failure')`);
 await denied(`select public.retry_notification_job('${job}',null,'retry_known_failure')`);await db.exec('reset role');
 assert.equal(await scalar(`select status from public.notification_deliveries where id='${job}'`),'failed');assert.equal(await scalar('select count(*)::int from public.notification_admin_audit'),1);
});
await check('recipient ownership read/archive, account-bound cutoff and new arrivals',async()=>{const id=await inboxFixture();await db.exec(actor(B));assert.equal((await scalar('select public.get_notification_inbox()')).items.length,0);await denied(`select public.set_notification_read('${id}',true)`);await db.exec('reset role');await db.exec(actor(A));let page=await scalar('select public.get_notification_inbox()');assert.equal(page.unreadCount,1);const cutoff=page.cutoff;await db.exec('reset role');const e=await scalar(`insert into public.notification_events(event_key,event_type,category,reference_id,payload) values('fixture:2','account_welcome','account','${A}','{"version":1,"kind":"account_welcome","referenceId":"${A}"}') returning id`);await db.exec(`insert into public.notification_inbox(event_id,recipient_id) values('${e}','${A}')`);await db.exec(actor(A));assert.equal(await scalar(`select public.mark_all_notifications_read('${cutoff}')`),1);assert.equal((await scalar('select public.get_notification_inbox()')).unreadCount,1);assert.equal(await scalar(`select public.set_notification_archived('${id}',true)`),true);assert.equal((await scalar('select public.get_notification_inbox()')).items.length,1);assert.equal((await scalar('select public.get_notification_inbox(true)')).items.length,1);await scalar(`select public.set_notification_archived('${id}',false)`);await db.exec('reset role');await db.exec(actor(B));await denied(`select public.mark_all_notifications_read('${cutoff}')`);});
await check('closed recipient denied owner RPCs',async()=>{await db.exec(`update public.profiles set age_blocked_at=now() where user_id='${A}';`);await db.exec(actor(A));await denied('select public.get_notification_preferences()');await denied('select public.get_notification_inbox()');});
await check('unrelated donor cannot say thanks when manager role is NULL',async()=>{const p=await scalar("insert into public.players(name) values('Synthetic') returning id");const t=await scalar(`insert into public.tips(player_id,fan_id,amount_cents) values('${p}','${A}',100) returning id`);await db.exec(actor(B));await denied(`select public.thank_donation('${t}','malo')`,'P0001');});
await check('expired started lease is unknown and admin cannot retry it',async()=>{const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category,status,lease_token,lease_until,started_at,attempts) values('${e}','${A}','account','attempting',gen_random_uuid(),now()-interval '1 second',now()-interval '2 seconds',1) returning id`);await db.exec(service);await scalar('select public.claim_notification_jobs(gen_random_uuid())');await db.exec('reset role');assert.equal(await scalar(`select status from public.notification_deliveries where id='${job}'`),'unknown');await db.exec(actor(ADMIN));await denied(`select public.retry_notification_job('${job}','${ADMIN}')`);});
await check('expiry recovery respects batch bound and updates only the locked delivery attempt',async()=>{
 const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);
 const second=await scalar(`insert into public.notification_events(event_key,event_type,category,reference_id,payload) values('fixture:reaper','account_welcome','account','${A}','{"version":1,"kind":"account_welcome","referenceId":"${A}"}') returning id`);
 for(const [event,seconds] of [[e,3],[second,2]]){
  const lease=await scalar('select gen_random_uuid()');const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category,status,lease_token,lease_until,started_at,attempts) values('${event}','${A}','account','attempting','${lease}',now()-interval '${seconds} seconds',now()-interval '4 seconds',1) returning id`);
  await db.exec(`insert into public.notification_delivery_attempts(job_id,attempt_number,lease_token,outcome) values('${job}',1,'${lease}','attempting')`);
 }
 await db.exec(service);await scalar('select public.claim_notification_jobs(gen_random_uuid(),1,60)');await db.exec('reset role');
 assert.equal(await scalar("select count(*)::int from public.notification_deliveries where status='unknown'"),1);
 assert.equal(await scalar("select count(*)::int from public.notification_deliveries where status='attempting'"),1);
 assert.equal(await scalar("select count(*)::int from public.notification_delivery_attempts where outcome='unknown'"),1);
 assert.equal(await scalar("select count(*)::int from public.notification_delivery_attempts where outcome='attempting'"),1);
 assert.equal(await scalar("select count(*)::int from public.notification_delivery_attempts a join public.notification_deliveries d on d.id=a.job_id where a.outcome='unknown' and d.status='unknown'"),1);
});
await check('send authorization rechecks opt-out and worker can durably finish denied begin',async()=>{const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);const token=await scalar('select gen_random_uuid()');const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category,status,lease_token,lease_until) values('${e}','${A}','account','attempting','${token}',now()+interval '1 minute') returning id`);await db.exec(service);const a=await scalar(`select public.authorize_notification_send('${job}','${token}')`);assert.equal(a.allowed,false);assert.ok(['channel_paused','category_paused','email_opt_out','category_opt_out','recipient_ineligible','unsubscribe_unavailable'].includes(a.reason));const b=await scalar(`select public.begin_notification_attempt('${job}','${token}')`);assert.equal(b.allowed,false);assert.equal(await scalar(`select public.complete_notification_attempt('${job}','${token}','suppressed','${b.reason}')`),true);await db.exec('reset role');assert.equal(await scalar(`select status from public.notification_deliveries where id='${job}'`),'suppressed');});
await check('health distinguishes overlapping acceptance and delivery evidence',async()=>{await db.exec(actor(ADMIN));const h=await scalar('select public.get_admin_notification_health()');assert.equal(h.providerEvidence,false);assert.ok(h.windowStart);assert.equal(typeof h.unknown,'number');});
await check('opt-out after queue suppresses before durable start',async()=>{
 await enableAccountEmail();const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);
 const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category) values('${e}','${A}','account') returning id`);
 await db.exec(service);const claims=await scalar('select public.claim_notification_jobs(gen_random_uuid(),1,60)');assert.equal(claims.length,1);const lease=claims[0].leaseToken;
 assert.equal((await scalar(`select public.authorize_notification_send('${job}','${lease}')`)).reason,'unsubscribe_unavailable');await db.exec('reset role');
 await db.exec(actor(A));const p=await scalar('select public.get_notification_preferences()');p.emailEnabled=false;await scalar(`select public.save_notification_preferences(${p.revision},'${JSON.stringify(p)}','${A}')`);await db.exec('reset role');
 await db.exec(service);const b=await scalar(`select public.begin_notification_attempt('${job}','${lease}')`);assert.equal(b.allowed,false);assert.equal(b.reason,'email_opt_out');assert.equal(await scalar(`select public.complete_notification_attempt('${job}','${lease}','suppressed','email_opt_out')`),true);await db.exec('reset role');
 assert.equal(await scalar(`select status from public.notification_deliveries where id='${job}'`),'suppressed');assert.equal(await scalar('select count(*)::int from public.notification_delivery_attempts'),0);
});
await check('unconfigured worker release preserves queued intent without fake attempts',async()=>{
 await enableAccountEmail();const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);
 const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category) values('${e}','${A}','account') returning id`);
 await db.exec(service);const claims=await scalar('select public.claim_notification_jobs(gen_random_uuid(),1,60)');assert.equal(claims[0].id,job);assert.equal(claims[0].attemptNumber,1);
 assert.equal(await scalar(`select public.release_notification_job('${job}','${claims[0].leaseToken}')`),true);await db.exec('reset role');
 assert.equal(await scalar(`select status from public.notification_deliveries where id='${job}'`),'queued');assert.equal(await scalar(`select attempts from public.notification_deliveries where id='${job}'`),0);
});
await check('pause suppresses backlog and resume cannot backfill it',async()=>{
 await enableAccountEmail();const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);
 const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category) values('${e}','${A}','account') returning id`);
 await db.exec(actor(ADMIN));let c=await scalar('select public.get_admin_notification_config()');c.emailEnabled=false;c=await scalar(`select public.set_admin_notification_config(${c.revision},'${JSON.stringify(c)}','${ADMIN}','pause_delivery')`);
 c.emailEnabled=true;await scalar(`select public.set_admin_notification_config(${c.revision},'${JSON.stringify(c)}','${ADMIN}','resume_future_events')`);await db.exec('reset role');
 assert.equal(await scalar(`select status from public.notification_deliveries where id='${job}'`),'suppressed');
});
await check('acceptance requires a nonnull valid provider evidence ID',async()=>{
 const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);const lease=await scalar('select gen_random_uuid()');
 const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category,status,attempts,lease_token,lease_until,started_at) values('${e}','${A}','account','attempting',1,'${lease}',now()+interval '1 minute',now()) returning id`);
 await db.exec(`insert into public.notification_delivery_attempts(job_id,attempt_number,lease_token,outcome) values('${job}',1,'${lease}','attempting')`);
 await db.exec(service);await denied(`select public.complete_notification_attempt('${job}','${lease}','accepted')`,'22023');
});
await check('account erasure clears inbox and leaves sanitized delivery attempt evidence',async()=>{
 const i=await inboxFixture();const e=await scalar(`select event_id from public.notification_inbox where id='${i}'`);
 const job=await scalar(`insert into public.notification_deliveries(event_id,recipient_id,category,status,attempts) values('${e}','${A}','account','unknown',1) returning id`);
 await db.exec(`insert into public.notification_delivery_attempts(job_id,attempt_number,lease_token,outcome,error_code) values('${job}',1,gen_random_uuid(),'unknown','transport_unknown');delete from auth.users where id='${A}';`);
 assert.equal(await scalar(`select count(*)::int from public.notification_inbox where recipient_id='${A}'`),0);assert.equal(await scalar(`select recipient_id from public.notification_deliveries where id='${job}'`),null);
 assert.equal(await scalar(`select count(*)::int from public.notification_delivery_attempts where job_id='${job}'`),1);
});
await check('migration re-applies and maintains RPC-only tables',async()=>{await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261021140000_notifications.sql'),'utf8'));assert.equal(await scalar("select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'notification_%' and c.relkind='r' and not c.relrowsecurity"),0);});
console.log(JSON.stringify({status:results.every(r=>r.pass)?'passed':'failed',cases:results.length,passed:results.filter(r=>r.pass).length,results,
 concurrency:{declared:concurrencyCases.length,executed:0,reason:'single_connection_replay_cannot_schedule_concurrent_transactions'}},null,2));
await db.close();process.exit(results.every(r=>r.pass)?0:1);
