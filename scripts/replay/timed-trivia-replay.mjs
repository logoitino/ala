#!/usr/bin/env node
/** QUIZ-02 real PostgreSQL actors verify timed authority and private recovery.
 * `--with-quiz03` also applies the QUIZ-03 rounds/groups migration and re-runs every check on top of it; the few
 * expectations QUIZ-03 intentionally changes are marked `quiz03 ?` and listed in docs/engineering/SCHEMA.md (QUIZ-03 section).
 * @sideEffects Builds a disposable database from the historical canonical schema; no hosted calls.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const dist = process.argv[2] || '.smoke/runtime/pglite-cache/package/dist';
const quiz03 = process.argv.includes('--with-quiz03');
const quiz03Migration='supabase/migrations/20261014160000_trivia_play_together.sql';
const { PGlite } = await import(pathToFileURL(path.resolve(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.resolve(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const bootstrap = fs.readFileSync('scripts/replay/schema-replay.mjs','utf8').match(/const SUPABASE_STUBS = String.raw`([\s\S]*?)`;/)?.[1];
assert.ok(bootstrap);
await db.exec(bootstrap);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql','utf8').split('\n-- QUIZ-02:')[0]);
const ids = Object.fromEntries(['admin','fan','teen','other','unknown','blocked','legacy','cancel','expired','paused','erased','voided','correct','clock','skip','invite','quota','quotaActive','topic','legacyDone','revStart','revAnswer','revEnd','revSkip','revExpire','revPause','revVoid','revCancel','revPreserve'].map((k,i)=>[k,`00000000-0000-0000-0000-${String(i+200).padStart(12,'0')}`]));
const year = Number((await db.query('select extract(year from current_date)::int y')).rows[0].y);
for (const [k,id] of Object.entries(ids)) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[id,JSON.stringify(k==='unknown'?{}:{birth_year:year-(k==='teen'?15:30),birth_month:1})]);
await db.query("update public.profiles set role='admin',is_admin=true where user_id=$1",[ids.admin]);
await db.query('update public.profiles set age_blocked_at=now() where user_id=$1',[ids.blocked]);
const profiles = Object.fromEntries((await db.query('select user_id,id from public.profiles')).rows.filter(r=>Object.values(ids).includes(r.user_id)).map(r=>[Object.keys(ids).find(k=>ids[k]===r.user_id),r.id]));
const actor = async (key,sql,args=[])=>{
  await db.exec('begin');
  try {
    await db.exec(`set local role ${key==='anon'?'anon':key==='service'?'service_role':'authenticated'}`);
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:key==='anon'?'anon':key==='service'?'service_role':'authenticated',sub:ids[key]})]);
    const rows=(await db.query(sql,args)).rows; await db.exec('commit'); return rows;
  } catch(e) { await db.exec('rollback'); throw e; }
};
const rpc = async (key,sql,args=[]) => (await actor(key,`select ${sql} result`,args))[0].result;
const snapshot=(key='fan')=>rpc(key,'public.quiz_snapshot()');
const tests=[];
const test=async(name,work)=>{try{await work();tests.push({name,pass:true});}catch(e){tests.push({name,pass:false,detail:e.message});} console.log(`${tests.at(-1).pass?'PASS':'FAIL'} ${name}${tests.at(-1).detail?': '+tests.at(-1).detail:''}`);};
const finish=async()=>{console.log(JSON.stringify({passed:tests.filter(t=>t.pass).length,total:tests.length,tests},null,2));await db.close();process.exitCode=tests.some(t=>!t.pass)?1:0;};
const migration='supabase/migrations/20261014150000_timed_sport_trivia.sql';
const legacyQuestion=(await db.query("insert into public.sport_quiz_questions(version,sport,prompt,options,correct_option,explanation,status,reason) values(1,'Legacy sport','What is the old learning question?','[\"one\",\"two\",\"three\",\"four\"]',1,'This is the old private explanation.','approved','Historical reviewed learning fixture.') returning id")).rows[0].id;
await db.query("insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status) values($1,public.quiz_week()-7,$2,'issued')",[profiles.legacy,legacyQuestion]);
const oldComplete=(await db.query("insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,answered_option,request_id,completed_at) values($1,public.quiz_week()-7,$2,'completed',1,gen_random_uuid(),now()-interval '7 days') returning id",[profiles.legacyDone,legacyQuestion])).rows[0].id;
await db.query("insert into public.sport_quiz_badges(profile_id,attempt_id,week_start) values($1,$2,public.quiz_week()-7)",[profiles.legacyDone,oldComplete]);
await db.query('update public.sport_quiz_settings set enabled=true,pilot_accounts=$1::uuid[]',[ [profiles.legacy] ]);
if(fs.existsSync(migration)) await db.exec(fs.readFileSync(migration,'utf8'));
if(quiz03) await db.exec(fs.readFileSync(quiz03Migration,'utf8'));
await test('timed protocol starts paused, invitations off and no active question in snapshot',async()=>{
  const s=await snapshot(); assert.equal(s.contract_version,2); assert.equal(s.preferences.invitation_mode,'off');
  assert.equal(s.availability,'paused'); assert.equal(s.attempt,null);
  const c=(await db.query('select enabled,testing_only,pilot_accounts from public.sport_quiz_settings')).rows[0];assert.equal(c.enabled,false);assert.equal(c.testing_only,true);assert.deepEqual(c.pilot_accounts,[]);
});
if(!fs.existsSync(migration)){await finish();} else {
const week=(await db.query("select date_trunc('week',statement_timestamp() at time zone 'UTC')::date::text w")).rows[0].w;
const secret='ab'.repeat(32);
const admin=(sql,args=[])=>rpc('admin',sql,args);
const denied=(key,sql,args=[])=>assert.rejects(()=>rpc(key,sql,args),/quiz_|permission denied/);
const allTesters=Object.keys(ids).filter(k=>!['admin','unknown','blocked','other'].includes(k)).map(k=>profiles[k]);
const settings=(enabled,testers=allTesters)=>admin('public.quiz_admin_settings($1::jsonb,$2,$3)',[JSON.stringify({enabled,pilot_accounts:testers}),'Reviewed local testing audience only.',profiles.admin]);
const question=(id,action,payload)=>admin('public.quiz_admin_question($1,$2,$3::jsonb,$4)',[id,action,JSON.stringify(payload),profiles.admin]);
const payload={family_action:'new',topic_category:'sport',sport:'American football',prompt:'How many points is a touchdown before the conversion?',options:['3','6','7','2'],correct_option:1,explanation:'A touchdown scores six points before the conversion.',source_notes:'NFL official scoring rules, section touchdown.',reason:'Reviewed draft for local learning only.'};
const prefs=(key,mode='off',topic='sports',version=0,request=randomUUID(),expected=profiles[key])=>rpc(key,'public.quiz_preferences($1::jsonb,$2,$3,$4)',[JSON.stringify({invitation_mode:mode,topic_mode:topic,notice_version:'timed-trivia-v1-testing'}),version,request,expected]);
const starts=new Map();
const start=(key,request=randomUUID(),duration=30,token=secret,expected=profiles[key],expectedWeek=week,topic='sport',sport=null)=>{
  starts.set(key,request);return rpc(key,'public.quiz_start($1,$2,$3,$4,$5,$6,$7,$8)',[topic,sport,duration,expectedWeek,'timed-trivia-v1-testing',request,token,expected]);
};
const answer=(key,id,option=0,request=randomUUID(),token=secret,expected=profiles[key])=>rpc(key,'public.quiz_answer($1,$2,$3,$4,$5)',[id,option,request,token,expected]);
const end=(key,id=null,startId=null,request=randomUUID(),reason='user_end',expected=profiles[key])=>rpc(key,'public.quiz_end($1,$2,$3,$4,$5,$6)',[id,startId,week,reason,request,expected]);
const backdate=async(id)=>{await db.query("update public.sport_quiz_attempts set started_at=t.at-interval '100 seconds',issued_at=t.at-interval '100 seconds',expires_at=t.at-interval '10 seconds',duration_seconds=90 from (select statement_timestamp() at)t where id=$1",[id]);
 // QUIZ-03 harness only: a round's deadline lives on its open item, so the same backdate moves that item too.
 if(quiz03) await db.query("update public.sport_quiz_round_items set issued_at=t.at-interval '100 seconds',expires_at=t.at-interval '10 seconds' from (select statement_timestamp() at)t where attempt_id=$1 and status='issued'",[id]);};
await test('canonical profile differs from auth identity',async()=>assert.notEqual(profiles.fan,ids.fan));
await test('legacy issued round becomes terminal history with its family exposed',async()=>{
 const h=await rpc('legacy','public.quiz_history()');assert.equal(h.items[0].attempt.mode,'legacy');assert.equal(h.items[0].attempt.status,'ended');
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_exposures where profile_id=$1',[profiles.legacy])).rows[0].n,1);
});
await test('legacy completed result and Sport Learner name survive upgrade',async()=>{
 const h=await rpc('legacyDone','public.quiz_history()');assert.equal(h.items[0].attempt.status,'completed');assert.equal(h.items[0].badge.label,'Sport Learner');assert.equal(h.items[0].result.was_correct,true);
});
await test('guest/service cannot execute and private tables/helpers remain denied',async()=>{
 for(const k of ['anon','service']) await denied(k,'public.quiz_snapshot()');
 for(const t of ['preferences','exposures','week_guards','requests','attempts','questions','badges','audit','settings']){
  await assert.rejects(()=>actor('fan',`select * from public.sport_quiz_${t}`),/permission denied/);
  await assert.rejects(()=>actor('service',`delete from public.sport_quiz_${t}`),/permission denied/);
 }
  await denied('fan','public.quiz_actor()');await denied('fan','public.quiz_week_at(statement_timestamp())');
  for(const k of ['anon','fan','service']) await denied(k,'public.quiz_bump_history($1)',[profiles.fan]);
 await denied('fan','public.quiz_admin_snapshot()');
});
await test('old untimed overloads removed',async()=>{
 for(const signature of ['quiz_start(text)','quiz_answer(uuid,integer,uuid)','quiz_skip()','quiz_admin_snapshot(bigint)']) assert.equal((await db.query('select to_regprocedure($1)::text f',[`public.${signature}`])).rows[0].f,null);
});
await test('settings fail closed and require canonical bounded cohort',async()=>{
 await assert.rejects(()=>settings(true,[]),/quiz_/);await assert.rejects(()=>settings(true,[ids.fan]),/quiz_/);
 await assert.rejects(()=>settings(true,Array(101).fill(profiles.fan)),/quiz_/);
});
let q;
await test('draft requires explicit family and source, approval remains explicit',async()=>{
 await assert.rejects(()=>question(null,'create',{...payload,family_action:undefined}),/quiz_/);
 q=await question(null,'create',payload);await settings(true);
 assert.equal((await snapshot()).availability,'unavailable');await question(q.id,'approve',{reason:'Verified six-point touchdown from official rules.'});
 assert.equal((await snapshot()).availability,'ready');
});
await test('unknown blocked and unenrolled refuse starts without exposing pool',async()=>{
 for(const k of ['unknown','blocked','other']){const s=await snapshot(k);assert.deepEqual(s.pools,[]);await assert.rejects(()=>start(k),/quiz_/);}
});
await test('expected canonical identity mismatch refuses every participant write before mutation',async()=>{
 await assert.rejects(()=>prefs('fan','off','sports',0,randomUUID(),profiles.teen),/quiz_identity_changed/);
 await assert.rejects(()=>start('fan',randomUUID(),30,secret,profiles.teen),/quiz_identity_changed/);
 await denied('fan','public.quiz_invitation($1,$2,$3)',[week,randomUUID(),profiles.teen]);
 await denied('fan','public.quiz_skip($1,$2,$3)',[week,randomUUID(),profiles.teen]);
 await denied('fan','public.quiz_erase_history(0,$1)',[profiles.teen]);
 await assert.rejects(()=>end('fan',null,randomUUID(),randomUUID(),'user_end',profiles.teen),/quiz_identity_changed/);
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_week_guards where profile_id=$1',[profiles.fan])).rows[0].n,0);
});
await test('notice choice exact retry and stale preference CAS',async()=>{
 const req=randomUUID();const p=await prefs('fan','off','sports',0,req);assert.equal(p.preferences.invitation_mode,'off');
 assert.deepEqual(await prefs('fan','off','sports',0,req),p);
 await assert.rejects(()=>prefs('fan','weekly','sports',0,req),/quiz_request_conflict/);
 await assert.rejects(()=>prefs('fan','weekly','sports',0),/quiz_preferences_stale/);
});
await test('weekly invitation claims once, no attempt or family',async()=>{
 await prefs('invite','weekly');const req=randomUUID();const a=await rpc('invite','public.quiz_invitation($1,$2,$3)',[week,req,profiles.invite]);assert.equal(a.outcome,'claimed');
 assert.deepEqual(await rpc('invite','public.quiz_invitation($1,$2,$3)',[week,req,profiles.invite]),a);
 assert.equal((await rpc('invite','public.quiz_invitation($1,$2,$3)',[week,randomUUID(),profiles.invite])).outcome,'already_claimed');
 const s=await snapshot('invite');assert.equal(s.attempt,null);assert.equal(s.week_spent,false);
});
let fanStart;
await test('Start exposes one immutable prompt only via original capability, no answer',async()=>{
 fanStart=await start('fan');assert.equal(fanStart.active_question.id,q.id);assert.equal(fanStart.attempt.duration_seconds,30);
 assert.equal('correct_option' in fanStart.active_question,false);assert.equal('explanation' in fanStart.active_question,false);
 const s=await snapshot();assert.equal('question' in s.attempt,false);assert.equal(s.week_spent,true);
 const raw=(await db.query('select session_hash from public.sport_quiz_attempts where id=$1',[fanStart.attempt.id])).rows[0].session_hash;
 assert.notEqual(raw,secret);assert.match(raw,/^[0-9a-f]{64}$/);
});
await test('exact Start retains deadline; different view cannot recover or redraw',async()=>{
 const req=starts.get('fan');const a=await start('fan',req);assert.equal(a.attempt.expires_at,fanStart.attempt.expires_at);assert.deepEqual(a.active_question,fanStart.active_question);
 await assert.rejects(()=>start('fan',req,90),/quiz_request_conflict/);
 await assert.rejects(()=>start('fan',req,30,'cd'.repeat(32)),/quiz_request_conflict/);
 const fresh=await start('fan');assert.equal(fresh.active_question,null);assert.equal(fresh.outcome,'week_spent');
 assert.equal((await rpc('fan','public.quiz_receipt($1)',[req])).active_question,undefined);
 assert.equal((await rpc('fan','public.quiz_history()')).items.length,0);
});
await test('Off changes invitations without ending active round',async()=>{
 await prefs('fan','off','sports',1);assert.equal((await snapshot()).attempt.status,'issued');
});
await test('wrong answer commits same private participation reward, exact receipt later recoverable',async()=>{
 const req=randomUUID();const a=await answer('fan',fanStart.attempt.id,0,req);assert.equal(a.outcome,'completed');assert.equal(a.result.was_correct,false);assert.equal(a.result.correct_option,1);
 assert.deepEqual(await answer('fan',fanStart.attempt.id,0,req),a);
 await assert.rejects(()=>answer('fan',fanStart.attempt.id,1,req),/quiz_request_conflict/);
 const h=await rpc('fan','public.quiz_history()');assert.equal(h.items[0].badge.label,'Trivia Explorer');assert.equal(h.items[0].badge.visibility,'private');
 assert.equal((await end('fan',fanStart.attempt.id)).outcome,'completed');
});
await test('other account, wrong secret and expected identity cannot answer',async()=>{
 await assert.rejects(()=>answer('teen',fanStart.attempt.id),/quiz_/);
 await assert.rejects(()=>answer('fan',fanStart.attempt.id,0,randomUUID(),secret,profiles.teen),/quiz_identity_changed/);
});
await test('answer before deadline works with 90 seconds and same badge for correct result',async()=>{
 await prefs('correct');const a=await start('correct',randomUUID(),90);const r=await answer('correct',a.attempt.id,1);
 assert.equal(r.result.was_correct,true);assert.equal((await rpc('correct','public.quiz_history()')).items[0].badge.label,'Trivia Explorer');
});
await test('End before Start cancels its exact UUID without question or deadline',async()=>{
 const startId=randomUUID();const req=randomUUID();const a=await end('cancel',null,startId,req);assert.equal(a.outcome,'cancelled');
 assert.deepEqual(await end('cancel',null,startId,req),a);await prefs('cancel');
 const delayed=await start('cancel',startId);assert.equal(delayed.active_question,null);assert.equal(delayed.outcome,'cancelled');
 assert.equal((await snapshot('cancel')).week_spent,true);
});
await test('End target exactly one, reason fixed and owner bound',async()=>{
 await assert.rejects(()=>end('teen',null,null),/quiz_end_invalid/);
 await assert.rejects(()=>end('teen',fanStart.attempt.id,randomUUID()),/quiz_end_invalid/);
 await assert.rejects(()=>end('teen',fanStart.attempt.id),/quiz_/);
 await assert.rejects(()=>end('teen',null,randomUUID(),randomUUID(),'arbitrary'),/quiz_end_invalid/);
});
await test('unknown Start cancellation cannot consume another active round reservation',async()=>{
 await prefs('teen');const a=await start('teen');const before=(await db.query('select count(*)::int n from public.sport_quiz_requests where profile_id=$1',[profiles.teen])).rows[0].n;
 await assert.rejects(()=>end('teen',null,randomUUID()),/quiz_round_closed/);
 assert.equal((await snapshot('teen')).attempt.status,'issued');assert.equal((await db.query('select count(*)::int n from public.sport_quiz_requests where profile_id=$1',[profiles.teen])).rows[0].n,before);
 await end('teen',a.attempt.id);
});
await test('effective expiry read-only, late answer denied, original Start no longer reveals',async()=>{
 await prefs('expired');const req=randomUUID();const a=await start('expired',req);await backdate(a.attempt.id);
 const before=(await db.query('select status from public.sport_quiz_attempts where id=$1',[a.attempt.id])).rows[0].status;
 const s=await snapshot('expired');assert.equal(s.attempt.status,'expired');assert.equal(s.attempt.effective_expired,true);
 assert.equal((await db.query('select status from public.sport_quiz_attempts where id=$1',[a.attempt.id])).rows[0].status,before);
 assert.equal((await start('expired',req)).active_question,null);
 assert.equal((await answer('expired',a.attempt.id)).outcome,'expired');
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_badges where profile_id=$1',[profiles.expired])).rows[0].n,0);
});
await test('pause ends active permanently; receipts readable, reenable cannot resume',async()=>{
 await prefs('paused');const req=randomUUID();const a=await start('paused',req);await settings(false);
 assert.equal((await snapshot('paused')).attempt.status,'ended');
 await assert.rejects(()=>answer('paused',a.attempt.id),/quiz_paused/);
 assert.equal((await rpc('fan','public.quiz_history()')).items[0].badge.label,'Trivia Explorer');
 await settings(true);assert.equal((await start('paused',req)).active_question,null);
});
await test('clock is captured after lock instead of transaction start',async()=>{
 await prefs('clock');const request=randomUUID();const row=(await actor('clock',"with pause as materialized(select pg_sleep(0.03)) select transaction_timestamp() tx,public.quiz_start('sport',null,30,$1,'timed-trivia-v1-testing',$2,$3,$4) receipt from pause",[week,request,secret,profiles.clock]))[0];const a=row.receipt;
 assert.ok(Date.parse(a.attempt.started_at)-Date.parse(row.tx)>=20);
 const delta=(await db.query('select extract(epoch from expires_at-started_at)::int d from public.sport_quiz_attempts where id=$1',[a.attempt.id])).rows[0].d;assert.equal(delta,30);
});
await test('old-week Start/Skip and invalid durations refuse without draw',async()=>{
 const old=(await db.query('select (public.quiz_week()-7)::text w')).rows[0].w;
 await assert.rejects(()=>start('teen',randomUUID(),30,secret,profiles.teen,old),/quiz_week_changed/);
 for(const d of [0,31,91,null]) await assert.rejects(()=>start('teen',randomUUID(),d),/quiz_start_invalid/);
 await denied('teen','public.quiz_skip($1,$2,$3)',[old,randomUUID(),profiles.teen]);
});
await test('Skip closes weekly quota without a family; repeated request is exact',async()=>{
 const req=randomUUID();const a=await rpc('skip','public.quiz_skip($1,$2,$3)',[week,req,profiles.skip]);assert.equal(a.outcome,'skipped');
 assert.deepEqual(await rpc('skip','public.quiz_skip($1,$2,$3)',[week,req,profiles.skip]),a);assert.equal((await snapshot('skip')).week_spent,true);
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_exposures where profile_id=$1',[profiles.skip])).rows[0].n,0);
});
await test('history clear closes pending Start and retains only minimal weekly guard',async()=>{
 await prefs('erased');const delayedId=randomUUID();const a=await rpc('erased','public.quiz_erase_history(0,$1)',[profiles.erased]);
 assert.equal(a.history_version,1);assert.equal(a.week_spent,true);
 const late=await start('erased',delayedId);assert.equal(late.active_question,null);assert.equal(late.outcome,'week_spent');
 await denied('erased','public.quiz_erase_history(0,$1)',[profiles.erased]);
 const guard=(await db.query('select * from public.sport_quiz_week_guards where profile_id=$1',[profiles.erased])).rows[0];assert.deepEqual(Object.keys(guard).sort(),['profile_id','prune_after','spent_at','week_start']);
 assert.equal((Date.parse(guard.prune_after)-Date.parse(guard.spent_at))/86400000,35);
});
await test('history clear deletes capability, exposure, badge and receipts; old exact retry closed',async()=>{
 const req=starts.get('fan');const s=await snapshot();await rpc('fan','public.quiz_erase_history($1,$2)',[s.history_version,profiles.fan]);
 for(const t of ['attempts','exposures','badges','requests']) assert.equal((await db.query(`select count(*)::int n from public.sport_quiz_${t} where profile_id=$1`,[profiles.fan])).rows[0].n,0);
 assert.equal((await start('fan',req)).active_question,null);assert.equal((await rpc('fan','public.quiz_history()')).total,0);
});
await test('seen family excludes edited versions, exhaustion does not substitute',async()=>{
 const next=await question(q.id,'edit',{...payload,family_action:'existing',question_key:q.question_key,prompt:'What is the value of a touchdown before the extra play?'});await question(next.id,'approve',{reason:'Reviewed revised wording in same touchdown family.'});
 const s=await snapshot('correct');assert.ok(s.pools.every(p=>p.unseen_count===0));
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_exposures where profile_id=$1 and question_key=$2',[profiles.correct,q.question_key])).rows[0].n,1);
 q=next;
});
await test('void corrects exposed attempts and badges without resetting family or week',async()=>{
 await prefs('voided');const a=await start('voided');await answer('voided',a.attempt.id,1);await question(q.id,'void',{reason:'Fact correction invalidates this reviewed pilot version.'});
 const h=await rpc('voided','public.quiz_history()');assert.equal(h.items[0].attempt.status,'void');assert.ok(h.items[0].badge.voided_at);
 assert.equal((await snapshot('voided')).week_spent,true);
});
await test('deterministic mix schedule and sports-only alternative never issue unseen wrong topic',async()=>{
 await prefs('topic','off','mix');const s=await snapshot('topic');const slot=(await db.query("select ((public.quiz_week()-date '1970-01-05')/7 % 5 + 5) % 5 n")).rows[0].n;
 assert.equal(s.scheduled_topic,slot===4?'fun':'sport');
 await assert.rejects(()=>start('topic',randomUUID(),30,secret,profiles.topic,week,'science'),/quiz_topic_not_allowed|quiz_no_question/);
});
await test('admin full counts and 51 tied question paging independent of audit',async()=>{
 const initial=(await db.query('select count(*)::int n from public.sport_quiz_questions')).rows[0].n;
 for(let i=initial;i<51;i++) await question(null,'create',{...payload,prompt:`Which reviewed test question is numbered ${i}?`});
 await db.exec('alter table public.sport_quiz_questions disable trigger quiz_question_guard');
 try{await db.exec("update public.sport_quiz_questions set created_at='2026-10-14T00:00:00.123456Z'");}finally{await db.exec('alter table public.sport_quiz_questions enable trigger quiz_question_guard');}
 const first=await admin('public.quiz_admin_snapshot()');assert.equal(first.questions.length,50);assert.equal(first.question_total,51);assert.ok(first.next_question_cursor);
 const second=await admin('public.quiz_admin_snapshot($1,null)',[first.next_question_cursor]);assert.equal(second.questions.length,1);assert.equal(second.next_question_cursor,null);assert.equal(second.question_total,51);
 assert.equal(new Set([...first.questions,...second.questions].map(x=>x.id)).size,51);assert.deepEqual(second.audit,first.audit);
 if(first.next_before){const audit=await admin('public.quiz_admin_snapshot(null,$1)',[first.next_before]);assert.ok(audit.audit.every(x=>BigInt(x.id)<BigInt(first.next_before)));assert.deepEqual(audit.questions,first.questions);}
 for(const bad of ['{}','null','[]','{"v":1,"stream":"history"}']) await denied('admin','public.quiz_admin_snapshot($1,null)',[bad]);
});
await test('retention bounded and preserves every unexpired quota',async()=>{
 const before=(await db.query('select count(*)::int n from public.sport_quiz_week_guards')).rows[0].n;
 const r=await admin('public.quiz_admin_retention($1,$2)',['Prune only expired recovery and quota records.',profiles.admin]);assert.equal(r.removed_guards,0);assert.equal(r.preserved_guards,before);assert.equal(r.batch_limit,500);
});
await test('one optional fun slot and four sports slots across a complete UTC five-week block',async()=>{
 const n=(await db.query("select count(*) filter(where public.quiz_fun_slot($1,public.quiz_week()+i*7))::int fun from generate_series(0,4)i",[profiles.topic])).rows[0].fun;
 assert.equal(n,1);
});
await test('caller-forged erasure context cannot read/delete audit or call private helper',async()=>{
 await assert.rejects(()=>actor('fan',"with forged as materialized(select set_config('quiz.erase_profile',$1,true) who) delete from public.sport_quiz_audit where actor_id=(select who::uuid from forged)",[profiles.admin]),/permission denied/);
 await denied('fan','public.quiz_save_request($1,gen_random_uuid(),\'end\',public.quiz_week(),null,null,\'ended\',now())',[profiles.admin]);
 await denied('fan','public.quiz_guard_audit()');
});
await test('admin identity mismatch refuses settings, question and retention without audit',async()=>{
 const before=(await db.query('select count(*)::int n from public.sport_quiz_audit')).rows[0].n;
 await denied('admin','public.quiz_admin_settings($1::jsonb,$2,$3)',[JSON.stringify({enabled:false,pilot_accounts:[]}),'Identity switched before this change.',profiles.fan]);
 await denied('admin','public.quiz_admin_question(null,\'create\',$1::jsonb,$2)',[JSON.stringify(payload),profiles.fan]);
 await denied('admin','public.quiz_admin_retention($1,$2)',['Identity switched before cleanup.',profiles.fan]);
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_audit')).rows[0].n,before);
});
await test('admin ordinary history erase removes own play audit but preserves editorial audit',async()=>{
 await settings(true,[...allTesters,profiles.admin]);await prefs('admin');
 const fresh=await question(null,'create',{...payload,sport:'Cricket',prompt:'How many choices does this reviewed cricket question have?'});await question(fresh.id,'approve',{reason:'Reviewed bounded source and all answer choices.'});
 const a=await start('admin');await answer('admin',a.attempt.id,0);
 const editorial=(await db.query("select count(*)::int n from public.sport_quiz_audit where actor_id=$1 and action like 'question_%'",[profiles.admin])).rows[0].n;
 const rev=(await snapshot('admin')).history_version;
 const result=await rpc('admin','public.quiz_erase_history($1,$2)',[rev,profiles.admin]);assert.equal(result.removed_audit,2);
 assert.equal((await db.query("select count(*)::int n from public.sport_quiz_audit where actor_id=$1 and action in ('start','answer','skip','end')",[profiles.admin])).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from public.sport_quiz_audit where actor_id=$1 and action like 'question_%'",[profiles.admin])).rows[0].n,editorial);
});
await test('admin audit redacts participant actor and question graph, no token/request fields',async()=>{
 const a=await admin('public.quiz_admin_snapshot()');for(const x of a.audit){if(['start','answer','skip','end'].includes(x.action)){assert.equal(x.actor_id,null);assert.equal(x.question_id,null);}assert.equal('attempt_id' in x,false);assert.equal('request_id' in x,false);assert.equal('session_hash' in x,false);}
});
await test('pre-Start history confirmation becomes stale; exact Start retry never advances revision',async()=>{
 await prefs('revStart');const before=(await snapshot('revStart')).history_version;const req=randomUUID();await start('revStart',req);
 const after=(await snapshot('revStart')).history_version;await assert.rejects(()=>rpc('revStart','public.quiz_erase_history($1,$2)',[before,profiles.revStart]),/quiz_history_stale/);
 assert.ok(after>before);await start('revStart',req);assert.equal((await snapshot('revStart')).history_version,after);
 const erased=await rpc('revStart','public.quiz_erase_history($1,$2)',[after,profiles.revStart]);assert.equal(erased.removed_attempts,1);
});
await test('pre-answer history confirmation cannot erase a newly committed badge; exact answer retry is stable',async()=>{
 await prefs('revAnswer');const a=await start('revAnswer');const before=(await snapshot('revAnswer')).history_version;const req=randomUUID();await answer('revAnswer',a.attempt.id,1,req);
 await assert.rejects(()=>rpc('revAnswer','public.quiz_erase_history($1,$2)',[before,profiles.revAnswer]),/quiz_history_stale/);
 const after=(await snapshot('revAnswer')).history_version;assert.ok(after>before);await answer('revAnswer',a.attempt.id,1,req);assert.equal((await snapshot('revAnswer')).history_version,after);
 assert.equal((await rpc('revAnswer','public.quiz_history()')).items[0].badge.label,'Trivia Explorer');
});
await test('End, Skip and unknown Start cancellation advance material history revision exactly once',async()=>{
 await prefs('revEnd');const a=await start('revEnd');const before=(await snapshot('revEnd')).history_version;const req=randomUUID();await end('revEnd',a.attempt.id,null,req);
 await assert.rejects(()=>rpc('revEnd','public.quiz_erase_history($1,$2)',[before,profiles.revEnd]),/quiz_history_stale/);
 const after=(await snapshot('revEnd')).history_version;await end('revEnd',a.attempt.id,null,req);assert.equal((await snapshot('revEnd')).history_version,after);
 const skipBefore=(await snapshot('revSkip')).history_version;await rpc('revSkip','public.quiz_skip($1,$2,$3)',[week,randomUUID(),profiles.revSkip]);
 await assert.rejects(()=>rpc('revSkip','public.quiz_erase_history($1,$2)',[skipBefore,profiles.revSkip]),/quiz_history_stale/);
 const cancelBefore=(await snapshot('revCancel')).history_version;await end('revCancel',null,randomUUID());
 await assert.rejects(()=>rpc('revCancel','public.quiz_erase_history($1,$2)',[cancelBefore,profiles.revCancel]),/quiz_history_stale/);
});
await test('persisted expiry and pause closure invalidate earlier history confirmation',async()=>{
 await prefs('revExpire');const a=await start('revExpire');const before=(await snapshot('revExpire')).history_version;await backdate(a.attempt.id);await answer('revExpire',a.attempt.id);
 await assert.rejects(()=>rpc('revExpire','public.quiz_erase_history($1,$2)',[before,profiles.revExpire]),/quiz_history_stale/);
 await prefs('revPause');await start('revPause');const pauseBefore=(await snapshot('revPause')).history_version;await settings(false);
 await assert.rejects(()=>rpc('revPause','public.quiz_erase_history($1,$2)',[pauseBefore,profiles.revPause]),/quiz_history_stale/);
 await settings(true);
});
await test('correction invalidates history CAS without removing new result or correction',async()=>{
 const c=await question(null,'create',{...payload,sport:'Revision sport'});await question(c.id,'approve',{reason:'Reviewed the isolated correction source.'});
 await prefs('revVoid');const a=await start('revVoid',randomUUID(),30,secret,profiles.revVoid,week,'sport','Revision sport');await answer('revVoid',a.attempt.id,1);
 const before=(await snapshot('revVoid')).history_version;await question(c.id,'void',{reason:'Correction invalidates this isolated learning question.'});
 await assert.rejects(()=>rpc('revVoid','public.quiz_erase_history($1,$2)',[before,profiles.revVoid]),/quiz_history_stale/);
 const h=await rpc('revVoid','public.quiz_history()');assert.equal(h.items[0].attempt.status,'void');assert.ok(h.items[0].badge.voided_at);
});
await test('receipt saturation reserves Off, answer and exact End without blocking closure',async()=>{
 await prefs('quota','weekly');const a=await start('quota');
 for(let v=1;v<=55;v++) await prefs('quota','weekly','sports',v);
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_requests where profile_id=$1',[profiles.quota])).rows[0].n,57);
 await assert.rejects(()=>prefs('quota','weekly','sports',56),/quiz_request_limit/);
 await prefs('quota','off','sports',56);const req=randomUUID();await answer('quota',a.attempt.id,1);const e=await end('quota',a.attempt.id,null,req);assert.equal(e.outcome,'completed');
 assert.deepEqual(await end('quota',a.attempt.id,null,req),e);await assert.rejects(()=>end('quota',a.attempt.id,null,req,'background'),/quiz_request_conflict/);
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_requests where profile_id=$1',[profiles.quota])).rows[0].n,60);
});
await test('active End at saturated ordinary budget remains exact and last Off slot survives',async()=>{
 await prefs('quotaActive','weekly');const a=await start('quotaActive');for(let v=1;v<=55;v++) await prefs('quotaActive','weekly','sports',v);
 const req=randomUUID();const e=await end('quotaActive',a.attempt.id,null,req);assert.equal(e.outcome,'ended');assert.deepEqual(await end('quotaActive',a.attempt.id,null,req),e);
 const late=await answer('quotaActive',a.attempt.id,0);assert.equal(late.outcome,'ended');
 await prefs('quotaActive','off','sports',56);assert.equal((await snapshot('quotaActive')).preferences.invitation_mode,'off');
 assert.equal((await db.query('select count(*)::int n from public.sport_quiz_requests where profile_id=$1',[profiles.quotaActive])).rows[0].n,60);
 await assert.rejects(()=>end('quotaActive',a.attempt.id,null,req,'background'),/quiz_request_conflict/);
});
await test(quiz03?'quiz03 ? bank cap 300 counts only draft and approved versions; immutable sources and family cannot change':'bank cap counts every historical version; immutable sources and family cannot change',async()=>{
 if(quiz03){
  const active=async()=>(await db.query("select count(*)::int n from public.sport_quiz_questions where status in ('draft','approved')")).rows[0].n;
  for(let i=await active();i<300;i++) await question(null,'create',{...payload,prompt:`Which additional bounded test question is ${i}?`});
  await assert.rejects(()=>question(null,'create',payload),/quiz_bank_full/);
  const draft=(await db.query("select id from public.sport_quiz_questions where status='draft' order by created_at limit 1")).rows[0].id;
  await question(draft,'archive',{reason:'Archive frees one active slot under the cap.'});
  await question(null,'create',{...payload,prompt:'Which question uses the slot freed by archiving?'});
  await assert.rejects(()=>db.query('update public.sport_quiz_questions set source_notes=$1 where id=$2',['Changed private source notes.',q.id]),/quiz_immutable/);
  const snap=await admin('public.quiz_admin_snapshot()');assert.equal(snap.active_total,300);assert.equal(snap.question_cap,300);assert.ok(snap.question_total>300);
  return;
 }
 const initial=(await db.query('select count(*)::int n from public.sport_quiz_questions')).rows[0].n;
 for(let i=initial;i<100;i++) await question(null,'create',{...payload,prompt:`Which additional bounded test question is ${i}?`});
 await assert.rejects(()=>question(null,'create',payload),/quiz_bank_full/);
 await assert.rejects(()=>db.query('update public.sport_quiz_questions set source_notes=$1 where id=$2',['Changed private source notes.',q.id]),/quiz_immutable/);
 assert.equal((await admin('public.quiz_admin_snapshot()')).question_total,100);
});
await test('expired retention removes only bounded old guards and requests',async()=>{
 await db.query("insert into public.sport_quiz_week_guards values($1,public.quiz_week()-42,statement_timestamp()-interval '42 days',statement_timestamp()-interval '7 days')",[profiles.teen]);
 const r=await admin('public.quiz_admin_retention($1,$2)',['Prune only quota older than the disclosed 35 days.',profiles.admin]);assert.equal(r.removed_guards,1);
 assert.ok((await snapshot('quota')).week_spent);
});
await test('timed row cannot omit its deadline or active capability hash',async()=>{
 try{
  await assert.rejects(()=>db.query("insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,mode,duration_seconds,started_at,expires_at,session_hash) values($1,public.quiz_week(),$2,'issued','timed',30,statement_timestamp(),null,$3)",[profiles.other,q.id,secret]),/quiz_timed_window/);
  await assert.rejects(()=>db.query("insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status,mode,duration_seconds,started_at,expires_at) values($1,public.quiz_week()-7,$2,'issued','timed',30,statement_timestamp(),statement_timestamp()+interval '30 seconds')",[profiles.other,q.id]),/quiz_timed_capability/);
 } finally {await db.query('delete from public.sport_quiz_attempts where profile_id=$1',[profiles.other]);}
});
await test('ordinary and admin snapshots do not change any private table row count',async()=>{
 const counts=async()=>Object.fromEntries(await Promise.all(['preferences','exposures','week_guards','requests','attempts','questions','badges','audit','settings'].map(async t=>[t,(await db.query(`select count(*)::int n from public.sport_quiz_${t}`)).rows[0].n])));
 const before=await counts();await snapshot('fan');await snapshot('topic');await admin('public.quiz_admin_snapshot()');assert.deepEqual(await counts(),before);
});
await test('full canonical second application preserves nondefault timed settings, preferences, history and correction',async()=>{
 await prefs('revPreserve');const live=await start('revPreserve',randomUUID(),90);
 const tables=['settings','preferences','questions','attempts','exposures','week_guards','requests','badges','audit',...(quiz03?['round_items']:[])];
 const state=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await db.query(`select to_jsonb(x) row from public.sport_quiz_${t} x order by to_jsonb(x)::text`)).rows])));
 const before=await state();assert.equal(before.settings[0].row.enabled,true);assert.ok(before.preferences.some(x=>x.row.topic_mode==='mix'));assert.ok(before.attempts.some(x=>x.row.status==='void'));
 assert.ok(before.attempts.some(x=>x.row.id===live.attempt.id&&x.row.status==='issued'&&x.row.session_hash));
 const canonical=fs.readFileSync('apps/mobile/src/backend/db/schema.sql','utf8').split('\n-- QUIZ-02:')[0]+'\n'+fs.readFileSync(migration,'utf8')+(quiz03?'\n'+fs.readFileSync(quiz03Migration,'utf8'):'');
 await db.exec(canonical);assert.deepEqual(await state(),before);
 for(const signature of ['quiz_start(text)','quiz_answer(uuid,integer,uuid)','quiz_skip()','quiz_admin_snapshot(bigint)']) assert.equal((await db.query('select to_regprocedure($1)::text f',[`public.${signature}`])).rows[0].f,null);
});
if(quiz03) await test('quiz03 ? every Start in this run issued a round (mode round with items), never a single timed question',async()=>{
 const r=(await db.query("select count(*) filter(where mode='round')::int rounds,count(*) filter(where mode='timed' and status<>'skipped')::int timed from public.sport_quiz_attempts")).rows[0];
 assert.ok(r.rounds>10);assert.equal(r.timed,0);
 assert.ok((await db.query('select count(*)::int n from public.sport_quiz_round_items')).rows[0].n>=r.rounds-2);
});
await finish(); }
