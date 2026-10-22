#!/usr/bin/env node
/** MONEY-TIPS-01 actual local PostgreSQL upgrade/quote/allocation checks; no provider or hosted settlement claim. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const dist = process.argv[2];
if (!dist) { console.error('UNAVAILABLE: pass verified local PGlite dist; 0 cases executed.'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.resolve(dist,'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.resolve(dist,'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const schemaPath='apps/mobile/src/backend/db/schema.sql';
const migrationPath='supabase/migrations/20261022152000_no_cut_gifts_optional_tips.sql';
const schema=fs.readFileSync(schemaPath,'utf8'), migration=fs.readFileSync(migrationPath,'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const results=[];
const test=async(name,work)=>{ await work(); results.push({name,pass:true}); console.log('PASS '+name); };
const donor='00000000-0000-0000-0000-000000000001', admin='00000000-0000-0000-0000-000000000002';
const athlete='00000000-0000-0000-0000-000000000003', other='00000000-0000-0000-0000-000000000004';
const actor=async(role,sql,args=[],sub=donor,claimsRole=role)=>{
  await db.exec('begin');
  try { await db.exec(`set local role ${role}`); await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:claimsRole,sub})]);
    const result=(await db.query(sql,args)).rows; await db.exec('commit'); return result;
  } catch(e) { await db.exec('rollback'); throw e; }
};
const flag=async(value)=>{ await db.query("insert into public.app_runtime_config(id,draft,published) values('default',$1::jsonb,$1::jsonb) on conflict(id) do update set draft=excluded.draft,published=excluded.published",[JSON.stringify({buttons:{MONETIZATION_TIPS_ENABLED:value},catalog:{maloFeeDollars:0.5}})]); };
const prepare=async(cover=false,percent=0,who=donor)=> (await actor('service_role','select public.prepare_tip_payment_context($1,$2,5000,$3,$4) q',[who,athlete,cover,percent]))[0].q;
const bind=async(q,pi,patch={})=>{
  q={...q,...patch};return (await actor('service_role','select public.record_notification_payment_context($1,$2,$3,$4,$5,$6,$7,$8,$9) ok',[q.id,pi,q.donorId,q.athleteId,q.giftCents,q.coverFeeCents,q.platformTipCents,'usd',false]))[0].ok;
};
const gift=async(pi,tip=0,fee=0,who=donor,gross=5000,target=athlete)=> (await actor('authenticated','insert into public.tips(player_id,fan_id,amount_cents,platform_tip_cents,cover_fee_cents,stripe_payment_intent_id) values($1,$2,$3,$4,$5,$6) returning id',[target,who,gross,tip,fee,pi],who))[0].id;
const allocation=async(id)=> (await db.query("select gross_cents,platform_cents,payout_cents from public.company_revenue_logs where source='malo' and source_id=$1",[id])).rows[0];
try {
 await db.exec(SUPABASE_STUBS);
 await test('prior canonical schema builds cleanly before tip migration',()=>db.exec(schema.split('-- Canonical money model: 20261022152000_no_cut_gifts_optional_tips.sql')[0]));
 await db.exec(`insert into auth.users(id) values('${donor}'),('${admin}'),('${other}'); update public.profiles set role='fan' where user_id in('${donor}','${other}'); update public.profiles set role='admin',is_admin=true where user_id='${admin}'; insert into public.players(id,name) values('${athlete}','Quote Athlete');`);
 const historic=await gift('pi_historical');
 assert.deepEqual(await allocation(historic),{gross_cents:5000,platform_cents:500,payout_cents:4500});
 await db.query("update public.tips set created_at='2026-09-01' where id=$1",[historic]);
 await db.query("update public.company_revenue_logs set created_at='2026-09-01' where source='malo' and source_id=$1",[historic]);
 await db.exec("insert into public.ledger_period_closes(period) values('2026-09');");
 const oldFingerprint=JSON.stringify((await db.query("select * from public.company_revenue_logs where source_id=$1",[historic])).rows);
 await test('append migration upgrades prior schema and reapplies twice',async()=>{ await db.exec(migration); await db.exec(migration); });
 await test('missing published flag and malformed values are OFF',async()=>{
   await db.exec("delete from public.app_runtime_config where id='default'");
   assert.equal((await db.query('select public.monetization_tips_enabled() e')).rows[0].e,false);
   for(const value of [false,'true',1,null,[],{}]) { await flag(value); assert.equal((await db.query('select public.monetization_tips_enabled() e')).rows[0].e,false); await assert.rejects(prepare(true,10)); }
 });
 await test('OFF base gift books full 5000 family gross with zero platform gift revenue',async()=>{ await flag(false); const id=await gift('pi_offbase01'); assert.deepEqual(await allocation(id),{gross_cents:5000,platform_cents:0,payout_cents:5000}); });
 await test('OFF forged tip and fee extras insert no gift or revenue',async()=>{ const before=(await db.query('select count(*) n from public.tips')).rows[0].n; await assert.rejects(gift('pi_forgedtip01',500)); await assert.rejects(gift('pi_forgedfee01',0,50)); assert.equal((await db.query('select count(*) n from public.tips')).rows[0].n,before); });
 await test('quote RPC and context tables deny guests/fans/null service role claims',async()=>{
   for(const role of ['anon','authenticated']) { await assert.rejects(actor(role,'select public.prepare_tip_payment_context($1,$2,5000,false,0)',[donor,athlete])); await assert.rejects(actor(role,'select * from public.notification_payment_contexts')); }
   await assert.rejects(actor('service_role','select public.prepare_tip_payment_context($1,$2,5000,false,0)',[donor,athlete],donor,null));
   await assert.rejects(actor('authenticated','select public.monetization_tips_enabled()'));
 });
 await test('first draft ON stays unpublished OFF until actual admin Publish',async()=>{
   await db.exec("delete from public.app_runtime_config where id='default'"); const draft=JSON.stringify({buttons:{MONETIZATION_TIPS_ENABLED:true},catalog:{maloFeeDollars:0.5}});
   const r=(await actor('authenticated','select public.patch_app_runtime_draft($1::jsonb) r',[draft],admin))[0].r;
   assert.equal(r.draft.buttons.MONETIZATION_TIPS_ENABLED,true);assert.equal(r.published.buttons.MONETIZATION_TIPS_ENABLED,false);await assert.rejects(prepare(true,10));
   for(const who of [donor,other]) { await assert.rejects(actor('authenticated','select public.patch_app_runtime_draft($1::jsonb)',[draft],who)); await assert.rejects(actor('authenticated','select public.publish_app_runtime()',[],who)); }
   await actor('authenticated','select public.publish_app_runtime()',[],admin);
   assert.equal((await db.query('select public.monetization_tips_enabled() e')).rows[0].e,true);
 });
 let q;
 await test('ON server quote binds 5000 gift + 500 optional tip + 50 estimated cover separately',async()=>{ q=await prepare(true,10); assert.equal(q.giftCents,5000);assert.equal(q.platformTipCents,500);assert.equal(q.coverFeeCents,50);assert.equal(q.totalCents,5550);assert.equal(q.notificationAuthority,false); });
 await test('unpromoted provisional reference cannot be inserted as a gift',async()=>{ await assert.rejects(gift('pi_quote_'+q.id.replaceAll('-',''),500,50)); });
 await test('issued quote survives OFF before binding; new extras denied; binding immutable and idempotent',async()=>{ await flag(false);await assert.rejects(prepare(true,10)); assert.equal(await bind(q,'pi_approved01'),true); assert.equal(await bind(q,'pi_approved01'),true);await assert.rejects(bind(q,'pi_retarget01'));await assert.rejects(bind(q,'pi_approved01',{giftCents:5001})); });
 await test('bound context rejects wrong actor, gift, tip, fee and athlete with no rows',async()=>{
   for(const [who,gross,tip,fee,target] of [[other,5000,500,50,athlete],[donor,5001,500,50,athlete],[donor,5000,501,50,athlete],[donor,5000,500,51,athlete],[donor,5000,500,50,other]]) await assert.rejects(gift('pi_approved01',tip,fee,who,gross,target));
 });
 let approved;
 await test('approved PI credits full family gross after OFF with tip/cover separate; duplicate PI refused',async()=>{
   approved=await gift('pi_approved01',500,50); assert.deepEqual(await allocation(approved),{gross_cents:5000,platform_cents:0,payout_cents:5000});
   const extras=(await db.query("select source,gross_cents,platform_cents,payout_cents from public.company_revenue_logs where source_id=$1 order by source",[approved])).rows;
   assert.deepEqual(extras,[{source:'card_fee',gross_cents:50,platform_cents:50,payout_cents:0},{source:'malo',gross_cents:5000,platform_cents:0,payout_cents:5000},{source:'tip',gross_cents:500,platform_cents:500,payout_cents:0}]);await assert.rejects(gift('pi_approved01',500,50));
 });
 await test('ON new gift still has no cut; duplicate plain PI refused',async()=>{ await flag(true);const plain=await prepare();await bind(plain,'pi_onplain01');const id=await gift('pi_onplain01');assert.deepEqual(await allocation(id),{gross_cents:5000,platform_cents:0,payout_cents:5000});await assert.rejects(gift('pi_offbase01')); });
 await test('missing malformed published processing estimate refuses extra quote',async()=>{
   for(const fee of ['0.5',null,-1,{},21474837]) { await db.query("update public.app_runtime_config set published=jsonb_set(published,'{catalog,maloFeeDollars}',$1::jsonb)",[JSON.stringify(fee)]);await assert.rejects(prepare(true,10)); }
   await flag(true);
 });
 await test('gift catch-up stays zero and report never reprices historic closed allocation',async()=>{
   await db.query("delete from public.company_revenue_logs where source='malo' and source_id=$1",[approved]);await actor('service_role','select public.sync_company_revenue_logs()');assert.deepEqual(await allocation(approved),{gross_cents:5000,platform_cents:0,payout_cents:5000});
   const report=(await actor('authenticated','select public.get_company_revenue_summary() r',[],admin))[0].r;
   const stream=report.streams.find(x=>x.source==='malo');assert.equal(stream.platform_bps,0);assert.equal(stream.payout_bps,10000);
   assert.equal(JSON.stringify((await db.query("select * from public.company_revenue_logs where source_id=$1",[historic])).rows),oldFingerprint);
 });
 await test('missing closed-month gift revenue stays a surfaced repair gap',async()=>{
   const id=await gift('pi_closedgap01');await db.query("update public.tips set created_at='2026-09-02' where id=$1",[id]);await db.query("delete from public.company_revenue_logs where source='malo' and source_id=$1",[id]);
   const report=(await actor('authenticated','select public.get_company_revenue_summary() r',[],admin))[0].r;assert.equal(report.gift_repair_gap_count,1);assert.equal(await allocation(id),undefined);
 });
 await test('parent reads stored old 4500, new 5000 and missing-row full fallback; stranger sees nothing',async()=>{
   const guardian='00000000-0000-0000-0000-000000000005';
   await db.exec(`insert into auth.users(id) values('${guardian}'); update public.profiles set role='parent' where user_id='${guardian}'; update public.players set guardian_id=(select id from public.profiles where user_id='${guardian}') where id='${athlete}';`);
   const rows=await actor('authenticated','select id,family_cents from public.get_received_malo($1)',[athlete],guardian);
   assert.equal(rows.find(r=>r.id===historic).family_cents,4500);assert.equal(rows.find(r=>r.id===approved).family_cents,5000);
   assert.equal(rows.filter(r=>r.family_cents===5000).length,4);
   const summary=(await actor('authenticated','select public.get_custodial_summary($1) s',[athlete],guardian))[0].s;
   assert.equal(summary.family_cents,24500);assert.equal(summary.received_cents,25000);
   assert.equal((await actor('authenticated','select * from public.get_received_malo($1)',[athlete],other)).length,0);
 });
 await test('closed donor, frozen athlete and missing target refuse service quotation',async()=>{
   await db.query('update public.profiles set age_blocked_at=now() where user_id=$1',[donor]);await assert.rejects(prepare());await db.query('update public.profiles set age_blocked_at=null where user_id=$1',[donor]);
   const athleteUser='00000000-0000-0000-0000-000000000006';
   await db.exec(`insert into auth.users(id) values('${athleteUser}'); update public.profiles set role='athlete',player_id='${athlete}',malo_frozen=true where user_id='${athleteUser}';`);
   await assert.rejects(prepare());await db.query('update public.profiles set malo_frozen=false where user_id=$1',[athleteUser]);
   await assert.rejects(actor('service_role','select public.prepare_tip_payment_context($1,$2,5000,false,0)',[donor,other]));
 });
 await test('gift above authenticated 100000-cent ledger cap refuses before any quote is persisted',async()=>{
   const before=(await db.query('select count(*) n from public.notification_payment_contexts')).rows[0].n;
   await assert.rejects(actor('service_role','select public.prepare_tip_payment_context($1,$2,100001,false,0)',[donor,athlete]),/payment_context_invalid/);
   assert.equal((await db.query('select count(*) n from public.notification_payment_contexts')).rows[0].n,before);
 });
 await test('cover estimate above existing gift-row bound refuses before any quote is persisted',async()=>{
   await db.query("update public.app_runtime_config set published=jsonb_set(published,'{catalog,maloFeeDollars}','100'::jsonb)");
   const before=(await db.query('select count(*) n from public.notification_payment_contexts')).rows[0].n;
   await assert.rejects(prepare(true,0),/processing_estimate_out_of_bounds/);
   assert.equal((await db.query('select count(*) n from public.notification_payment_contexts')).rows[0].n,before);
   await flag(true);
 });
 await test('maximum admitted gift, fee, tip and computed Aura fit the unchanged authenticated row caps',async()=>{
   await db.query("update public.app_runtime_config set published=jsonb_set(published,'{catalog,maloFeeDollars}','1000'::jsonb)");
   const q=(await actor('service_role','select public.prepare_tip_payment_context($1,$2,100000,true,100) q',[donor,athlete]))[0].q;
   assert.equal(q.giftCents,100000);assert.equal(q.coverFeeCents,100000);assert.equal(q.platformTipCents,100000);assert.equal(q.totalCents,300000);
   await bind(q,'pi_boundaries01');
   const [r]=await actor('authenticated','insert into public.tips(player_id,fan_id,amount_cents,platform_tip_cents,cover_fee_cents,stripe_payment_intent_id,aura_points) values($1,$2,100000,100000,100000,$3,10000) returning id',[athlete,donor,'pi_boundaries01']);
   assert.deepEqual(await allocation(r.id),{gross_cents:100000,platform_cents:0,payout_cents:100000});await flag(true);
 });
 await test('commercial basis points and notification authority remain unchanged',async()=>{
   for(const [source,bps] of [['malo',0],['booster',1500],['vault',2000],['merch',10000],['tip',10000],['card_fee',10000]]) assert.equal((await db.query('select public.company_revenue_bps($1) bps',[source])).rows[0].bps,bps);
   assert.equal((await db.query('select count(*) n from public.notification_payment_contexts where notification_authority is distinct from false')).rows[0].n,0);
 });
 console.log(`${results.length} SQL cases passed; actual processing/Stripe settlement/payouts unverified.`);
} catch(e) { results.push({name:'failure',pass:false,error:e.message}); console.error(e.message,e.where||'');process.exitCode=1; }
finally { fs.mkdirSync('.smoke/gift-copy',{recursive:true});fs.writeFileSync('.smoke/gift-copy/tip-source-sql-results.json',JSON.stringify({time:new Date().toISOString(),schemaHash:hash(schema),migrationHash:hash(migration),engine:'PostgreSQL18.6/PGlite0.5.9 local',results,actualProcessingVerified:false,settlementVerified:false},null,2)+'\n');await db.close(); }
