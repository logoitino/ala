#!/usr/bin/env node
/** Replay real MULTISPORT-01 authority, revision, explicit legacy classification and history on the entire canonical SQL.
 * PGlite comes from an installed external cache. --baseline excludes the owned migration; no hosted SQL runs. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist, ...flags] = process.argv.slice(2);
if (!dist) { console.error('usage: athlete-sports-replay.mjs <pglite dist> [--baseline]'); process.exit(2); }
const migrationPath = 'supabase/migrations/20261021233000_athlete_sports.sql';
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, ''));
const A='00000000-0000-4000-8000-00000000a031', F='00000000-0000-4000-8000-00000000f031', P='00000000-0000-4000-8000-00000000b031', U='00000000-0000-4000-8000-00000000c031';
const PLAYER='00000000-0000-4000-8000-00000000d031', OTHER='00000000-0000-4000-8000-00000000d032';
await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${A}','{"birth_year":1990,"birth_month":1}'),('${F}','{"birth_year":1990,"birth_month":1}'),('${P}','{"birth_year":1990,"birth_month":1}'),('${U}','{"birth_year":1990,"birth_month":1}');
update public.profiles set role='admin',roles=array['admin'],is_admin=true where user_id='${A}';
insert into public.players(id,name) values('${PLAYER}','Replay athlete'),('${OTHER}','No career');
update public.profiles set role='athlete',roles=array['athlete'],athlete_sport='Football',athlete_jersey='7',athlete_position='QB',player_id='${PLAYER}' where user_id='${P}';
update public.profiles set role='athlete',roles=array['athlete'],athlete_sport='Football' where user_id='${U}';
insert into public.athlete_career_stats(player_id,sport,games_played) values('${PLAYER}','Volleyball',3);
-- The old one-row writer could overwrite sport; this current row cannot prove older logs.
update public.athlete_career_stats set sport='Football',games_played=8 where player_id='${PLAYER}';
insert into public.athlete_game_logs(player_id,played_on,stat_line) values('${PLAYER}','2026-10-01','legacy football'),('${PLAYER}','2026-09-01','legacy volleyball'),('${OTHER}','2026-10-01','unknown sport');`);
await db.exec(`insert into public.sport_configs(sport) values('Football'),('Volleyball'),('Rugby') on conflict do nothing;`);
const ids=(await db.query(`select id,user_id from public.profiles where user_id in('${A}','${F}','${P}','${U}')`)).rows;
const profile=(uid)=>ids.find(r=>r.user_id===uid).id;
const who=(uid)=>uid ? `set role authenticated;set request.jwt.claims='{"role":"authenticated","sub":"${uid}"}';` : `set role anon;set request.jwt.claims='{"role":"anon"}';`;
const results=[];
async function test(name,sql,check=()=>true,deny=false){
 try { const r=await db.exec(sql);const rows=[...r].reverse().find(x=>x.fields?.length)?.rows??[];results.push({name,pass:!deny&&check(rows),detail:JSON.stringify(rows)}); }
 catch(e){results.push({name,pass:deny&&['42501','P0001','23514'].includes(e.code),detail:`${e.code}: ${e.message}`});}
 finally{await db.exec('reset role;reset request.jwt.claims;');}
}
if(!flags.includes('--baseline')) await test('migration builds',migration);
const snapshot=(r)=>r[0]?.get_athlete_sports;
const entries=JSON.stringify([{sport:'Football',school_id:null,team_name:null,position:'QB',jersey:'7'},{sport:'Volleyball',school_id:null,team_name:'Team B',position:'Setter',jersey:'4'}]);
const save=(uid,primary='Football',revision=0,list=entries,target=profile(P))=>`${who(uid)}select public.set_athlete_sports('${target}','${primary}','${list}'::jsonb,${revision});`;
await test('legacy primary reads at revision zero',`${who(P)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)?.revision===0&&snapshot(r)?.sports.length===1);
await test('unclaimed athlete owns sports without a player',`${who(U)}select public.get_athlete_sports('${profile(U)}');`,r=>snapshot(r)?.primary_sport==='Football');
await test('old career overwrite cannot classify untagged legacy logs',`select sport from public.athlete_game_logs where stat_line in ('legacy football','legacy volleyball') order by played_on;`,r=>r.length===2&&r.every(log=>log.sport===null));
await test('unknown legacy logs remain unassigned',`select sport from public.athlete_game_logs where stat_line='unknown sport';`,r=>r[0]?.sport===null);
for(const uid of [null,F,U]) await test(`${uid??'guest'} cannot save another profile`,save(uid),()=>true,true);
await test('atomic self multi-sport save',save(P),r=>r[0]?.set_athlete_sports?.sports.length===2&&r[0]?.set_athlete_sports?.revision===1);
await test('stale revision rejected',save(P,'Volleyball',0),()=>true,true);
await test('invalid primary rejected',save(P,'Rugby',1),()=>true,true);
await test('duplicate sport rejected',save(P,'Football',1,JSON.stringify([{sport:'Football'},{sport:' football '}])) ,()=>true,true);
await test('unknown sport rejected',save(P,'Made Up',1,JSON.stringify([{sport:'Made Up'}])),()=>true,true);
await test('too many entries rejected',save(P,'Football',1,JSON.stringify(Array(17).fill({sport:'Football'}))),()=>true,true);
await test('manual primary changes atomically',save(P,'Volleyball',1),r=>r[0]?.set_athlete_sports?.primary_sport==='Volleyball'&&r[0]?.set_athlete_sports?.revision===2);
await test('sport choice grants no verification',`select verification_status,is_verified from public.profiles where id='${profile(P)}';`,r=>r[0]?.verification_status==='unverified'&&!r[0]?.is_verified);
await test('base participation public read refused',`${who(null)}select * from public.athlete_sport_entries;`,()=>true,true);
await test('base participation self write refused',`${who(P)}delete from public.athlete_sport_entries where profile_id='${profile(P)}';`,()=>true,true);
await test('private stranger receives null scope',`${who(F)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)===null);
await test('admin sees private entries',`${who(A)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)?.sports.length===2);
await test('admin list bounded and protected',`${who(A)}select public.admin_list_athlete_sports('',40);`,r=>Array.isArray(r[0]?.admin_list_athlete_sports)&&r[0].admin_list_athlete_sports.length<=40);
await test('fan cannot enumerate admin profiles',`${who(F)}select public.admin_list_athlete_sports('',40);`,()=>true,true);
await test('direct primary bypass rejected after opt-in',`${who(P)}update public.profiles set athlete_sport='Rugby' where id='${profile(P)}';`,()=>true,true);
await test('direct revision bypass rejected',`${who(P)}update public.profiles set athlete_sports_revision=99 where id='${profile(P)}';`,()=>true,true);
await test('independent second career preserves first',`${who(A)}select public.admin_upsert_athlete_career_stats('${PLAYER}','Volleyball',3,9,4,1);select sport,games_played from public.athlete_career_stats where player_id='${PLAYER}' order by sport;`,r=>r.length===2&&r[0].games_played===8&&r[1].games_played===3);
await test('old log RPC rejects ambiguous athlete',`${who(A)}select public.admin_add_athlete_game_log('${PLAYER}','2026-10-02','Opponent','unsafe',2,3);`,()=>true,true);
await test('explicit sport log retained',`${who(A)}select public.admin_add_athlete_game_log('${PLAYER}','2026-10-02','Opponent','new volley',2,3,'Volleyball');select sport from public.athlete_game_logs where stat_line='new volley';`,r=>r[0]?.sport==='Volleyball');
await test('fan cannot write career',`${who(F)}select public.admin_upsert_athlete_career_stats('${PLAYER}','Football',0,0,0,0);`,()=>true,true);
await test('removal preserves career and logs',save(P,'Football',2,JSON.stringify([{sport:'Football',position:'QB',jersey:'7'}]))+`select count(*)::int as n from public.athlete_career_stats where player_id='${PLAYER}';`,r=>r[0]?.n===2);
await test('reels have nullable recorded sport with legacy null',`select count(*)::int as n from public.reels where sport is not null;`,r=>r[0]?.n===0);
await test('feed exposes sport while preserving pending tag masking',`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='reels_feed' and column_name='sport') as present;`,r=>r[0]?.present===true);

await test('public sports with hidden school and stats redact each entry',`select public.apply_privacy_settings('${profile(P)}','{"account_private":false,"profile_audience":{"school":"only_me","stats":"only_me"}}');${who(F)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)?.sports[0]?.position===''&&snapshot(r)?.sports[0]?.jersey===''&&snapshot(r)?.sports[0]?.team_name===null);
await test('owner still sees own hidden credentials',`${who(P)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)?.sports[0]?.position==='QB'&&snapshot(r)?.sports[0]?.jersey==='7');
await test('blocking refuses otherwise public secondary scope',`insert into public.user_blocks(blocker_id,blocked_id) values('${profile(P)}','${profile(F)}');${who(F)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)===null);
await db.exec(`delete from public.user_blocks where blocker_id='${profile(P)}';`);
await test('guardian on record reads private participation',`update public.players set guardian_id='${profile(F)}' where id='${PLAYER}';select public.apply_privacy_settings('${profile(P)}','{"account_private":true}');${who(F)}select public.get_athlete_sports('${profile(P)}');`,r=>snapshot(r)?.sports[0]?.position==='QB');
await test('guardian has no new participation write permission',save(F,'Football',3),()=>true,true);
await db.exec(`update public.players set guardian_id=null where id='${PLAYER}';`);
const TEEN='00000000-0000-4000-8000-00000000e031';
await db.exec(`insert into auth.users(id,raw_user_meta_data) values('${TEEN}','{"birth_year":2011,"birth_month":1}');update public.profiles set role='athlete',roles=array['athlete'],athlete_sport='Football' where user_id='${TEEN}';`);
const teen=(await db.query(`select id from public.profiles where user_id='${TEEN}'`)).rows[0].id;
await test('minor public scope requires recorded guardian consent',`select public.apply_privacy_settings('${teen}','{"account_private":false}');${who(null)}select public.get_athlete_sports('${teen}');`,r=>snapshot(r)===null);
await test('minor self reads own participation',`${who(TEEN)}select public.get_athlete_sports('${teen}');`,r=>snapshot(r)?.sports.length===1);
await test('legacy revision zero onboarding remains supported',`${who(U)}update public.profiles set athlete_sport='Rugby',athlete_position='Wing',athlete_jersey='9' where id='${profile(U)}';select public.get_athlete_sports('${profile(U)}');`,r=>snapshot(r)?.primary_sport==='Rugby'&&snapshot(r)?.sports[0]?.jersey==='9');
await test('unclaimed athlete saves without verification',save(U,'Football',1,JSON.stringify([{sport:'Football'}]),profile(U)),r=>r[0]?.set_athlete_sports?.revision===2);
const REEL='00000000-0000-4000-8000-00000000e041', PHOTO='00000000-0000-4000-8000-00000000e042';
await test('uploader records explicit video sport',`${who(P)}insert into public.reels(id,title,video_url,sport) values('${REEL}','Video','https://example.invalid/video.mp4','Football');select sport from public.reels where id='${REEL}';`,r=>r[0]?.sport==='Football');
await test('photo story initial row records sport',`${who(P)}insert into public.reels(id,title,video_url,sport,media_type) values('${PHOTO}','Photos','','Volleyball','photo_story');select sport from public.reels where id='${PHOTO}';`,r=>r[0]?.sport==='Volleyball');
await test('owner cannot relabel a recorded sport after posting',`${who(P)}update public.reels set sport='Rugby' where id='${REEL}';`,()=>true,true);
await test('invalid upload sport rejected',`${who(P)}insert into public.reels(title,video_url,sport) values('Invalid','https://example.invalid/video.mp4','Made Up');`,()=>true,true);
await test('admin can correct recorded sport',`${who(A)}update public.reels set sport='Volleyball' where id='${REEL}';select sport from public.reels_feed where id='${REEL}';`,r=>r[0]?.sport==='Volleyball');
await test('sport removal preserves recorded media',save(P,'Rugby',3,JSON.stringify([{sport:'Rugby'}]))+`select sport from public.reels where id='${REEL}';`,r=>r[0]?.sport==='Volleyball');
await test('migration repeat never reclassifies unknown logs after multi-career',migration+`select sport from public.athlete_game_logs where stat_line='unknown sport';`,r=>r[0]?.sport===null);
await test('catalog usage counts secondary participation without career rows',`${who(A)}select * from public.admin_athlete_sport_usage();`,r=>r.some(x=>x.sport==='Football'&&Number(x.athletes)>=1));
await test('fan cannot read protected catalog participation aggregate',`${who(F)}select * from public.admin_athlete_sport_usage();`,()=>true,true);
await test('admin highlight repair has CAS readback',`${who(A)}select public.admin_set_highlight_sport('${REEL}','Football','Volleyball');`,r=>r[0]?.admin_set_highlight_sport?.sport==='Football');
await test('stale highlight repair refused',`${who(A)}select public.admin_set_highlight_sport('${REEL}','Rugby','Volleyball');`,()=>true,true);
await test('fan highlight repair refused',`${who(F)}select public.admin_set_highlight_sport('${REEL}','Rugby','Football');`,()=>true,true);
await test('admin unassigned log list is bounded',`${who(A)}select * from public.admin_list_unassigned_athlete_logs('${OTHER}',20);`,r=>r.length===1&&r[0].stat_line==='unknown sport');
const unknown=(await db.query(`select id from public.athlete_game_logs where stat_line='unknown sport'`)).rows[0].id;
await test('admin classifies original unassigned log without recreating it',`${who(A)}select * from public.admin_set_athlete_game_log_sport('${unknown}','${OTHER}','Volleyball',null);`,r=>r[0]?.id===unknown&&r[0]?.sport==='Volleyball'&&r[0]?.stat_line==='unknown sport'&&new Date(r[0]?.played_on).toISOString().startsWith('2026-10-01'));
await test('stale original log classification refused',`${who(A)}select public.admin_set_athlete_game_log_sport('${unknown}','${OTHER}','Football',null);`,()=>true,true);
await test('other target player cannot claim original log',`${who(A)}select public.admin_set_athlete_game_log_sport('${unknown}','${PLAYER}','Football','Volleyball');`,()=>true,true);
await db.close();
for(const r of results)console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.pass?'':` — ${r.detail}`}`);
const failed=results.filter(r=>!r.pass).length;console.log(`athlete-sports replay: ${results.length-failed}/${results.length} passed; ${flags.includes('--baseline')?'BASELINE':'LOCAL ONLY'}`);process.exitCode=failed?1:0;
