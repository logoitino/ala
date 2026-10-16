#!/usr/bin/env node
/** BEYOND-01: real local PostgreSQL actor/storage replay. No hosted operations. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist, migrationPath='supabase/migrations/20261016120000_beyond_game.sql', schemaPath='apps/mobile/src/backend/db/schema.sql']=process.argv.slice(2);
if(!dist) throw Error('Pass an installed PGlite dist directory.');
const {PGlite}=await import(pathToFileURL(path.join(dist,'index.js')).href);
const {pgcrypto}=await import(pathToFileURL(path.join(dist,'contrib/pgcrypto.js')).href);
const db=new PGlite({extensions:{pgcrypto}});
const results=[];
const check=(name,ok,detail='')=>{results.push({name,pass:!!ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${ok?'':` ${detail}`}`);};
const rows=async sql=>(await db.exec(sql)).at(-1).rows;
try{
 await db.exec(SUPABASE_STUBS);
 await db.exec(fs.readFileSync(schemaPath,'utf8'));
 await db.exec(fs.readFileSync(migrationPath,'utf8'));
 const uid=n=>`00000000-0000-0000-0000-00000000${String(n).padStart(4,'0')}`;
 const U={admin:uid(1),adult:uid(2),friend:uid(3),stranger:uid(4),teen:uid(5),guardian:uid(6),unknown:uid(7),closed:uid(8)};
 const year=new Date().getUTCFullYear();
 await db.exec(`insert into auth.users(id,raw_user_meta_data) values ${Object.entries(U).map(([k,v])=>`('${v}','${JSON.stringify(k==='teen'?{birth_year:String(year-15),birth_month:'1'}:k==='unknown'?{}:{birth_year:'1990',birth_month:'1'})}')`).join(',')}; update public.profiles set role='admin',is_admin=true where user_id='${U.admin}';`);
 const P={};for(const [k,v] of Object.entries(U))P[k]=(await rows(`select id from public.profiles where user_id='${v}'`))[0].id;
 await db.exec(`insert into public.friendships(requester_id,addressee_id,status,responded_at) values ('${P.adult}','${P.friend}','accepted',now()),('${P.teen}','${P.friend}','accepted',now());insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values('${P.teen}','${P.guardian}','invite',now());`);
 const q=async(who,sql)=>{try{await db.exec(`set role ${who==='guest'?'anon':'authenticated'};set request.jwt.claims='${JSON.stringify(who==='guest'?{role:'anon'}:{role:'authenticated',sub:U[who]})}';`);return(await db.exec(sql)).at(-1).rows;}catch(e){return {error:e.message};}finally{await db.exec('reset role;reset request.jwt.claims;');}};
 const one=async(who,sql)=>{const r=await q(who,sql);return Array.isArray(r)?r[0]?.v:r;};
 const rpc=(who,fn,args='')=>one(who,`select public.${fn}('${P[who]}'${args?`,${args}`:''}) as v`);
 // Synthetic legacy cards: exact verified/open athlete plus visible open uploader, never a roster-name fallback.
 const legacyActors={legacyAth:801,legacyPrivate:802,legacyUnverified:803,legacyClosed:804,legacyUploader:805,legacyTeen:806};
 for(const [k,n]of Object.entries(legacyActors)){U[k]=uid(n);await db.exec(`insert into auth.users(id,raw_user_meta_data) values('${U[k]}','${JSON.stringify({birth_year:String(k==='legacyTeen'?year-15:1990),birth_month:'1'})}')`);P[k]=(await rows(`select id from public.profiles where user_id='${U[k]}'`))[0].id;}
 const legacyPlayers={legacyAth:uid(851),legacyPrivate:uid(852),legacyUnverified:uid(853),legacyClosed:uid(854),legacyTeen:uid(856)};
 await db.exec(`insert into public.players(id,name) values ${Object.entries(legacyPlayers).map(([k,v])=>`('${v}','Exact ${k}')`).join(',')};
  ${Object.entries(legacyActors).map(([k])=>`update public.profiles set full_name='Exact ${k}',account_private=false,profile_audience=jsonb_build_object('photo','everyone'),hide_from_search=false${legacyPlayers[k]?`,player_id='${legacyPlayers[k]}',role='athlete',verification_status='${k==='legacyUnverified'?'unverified':'verified'}'`:''} where id='${P[k]}';`).join('\n')}
  update public.profiles set age_blocked_at=now() where id='${P.legacyClosed}';
  update public.profiles set account_private=true,profile_audience=jsonb_build_object('photo','only_me') where id='${P.legacyPrivate}';`);
 const legacyReels={work:uid(901),service:uid(902),vault:uid(903),exclusive:uid(904),removed:uid(905),pending:uid(906),unverified:uid(907),closed:uid(908),empty:uid(909),private:uid(910),noUploader:uid(911),teen:uid(912)};
 await db.exec(`select set_config('app.tapuai_tag_write','on',false);insert into public.reels(id,title,player_id,uploaded_by,video_url,category,is_vault_only,is_exclusive,is_removed) values ${Object.entries(legacyReels).map(([k,v])=>`('${v}','Legacy ${k}','${legacyPlayers[k==='unverified'?'legacyUnverified':k==='closed'?'legacyClosed':k==='private'?'legacyPrivate':k==='teen'?'legacyTeen':'legacyAth']}',${k==='noUploader'?'null':`'${P.legacyUploader}'`},'${k==='empty'?'':'https://fixture.invalid/video.mp4'}','${k==='service'?'serve_like_me':'train_like_me'}',${k==='vault'},${k==='exclusive'},${k==='removed'})`).join(',')};
  select set_config('app.tapuai_tag_write','on',false);update public.reels set tag_status=case when id='${legacyReels.pending}' then 'pending' else 'confirmed' end where id=any(array[${Object.values(legacyReels).map(v=>`'${v}'::uuid`).join(',')}]);select set_config('app.tapuai_tag_write','off',false);`);
 const legacy=(who,category='workout',n=24)=>one(who,`select public.beyond_legacy_posts(${P[who]?`'${P[who]}'`:'null'},'${category}',${n===null?'null':n}) as v`);
 const guestLegacy=await legacy('guest'),serviceLegacy=await legacy('guest','service');
 // These actual SQL rows are synthetic and minimal; retained for the root SDK parser integration check.
 console.log('LEGACY_FIXTURE',JSON.stringify({workout:guestLegacy,service:serviceLegacy}));
 check('legacy discovery while switch off returns exact permitted minimal workout/service cards only',
  guestLegacy?.length===1&&guestLegacy[0].id===legacyReels.work&&Object.keys(guestLegacy[0]).sort().join(',')==='athlete_name,category,id,player_id,title'
   &&guestLegacy[0].player_id===legacyPlayers.legacyAth&&guestLegacy[0].athlete_name==='Exact legacyAth'&&guestLegacy[0].category==='workout'&&serviceLegacy?.length===1&&serviceLegacy[0].id===legacyReels.service&&serviceLegacy[0].category==='service',
  JSON.stringify({guestLegacy,serviceLegacy}));
 const wrongLegacy=await q('friend',`select * from public.beyond_legacy_posts('${P.adult}','workout',24)`),nullLegacy=await q('friend',`select * from public.beyond_legacy_posts(null,'workout',24)`);
 check('legacy discovery binds authenticated actor; a guest cannot impersonate a profile',/account changed/.test(wrongLegacy.error??'')&&/account changed/.test(nullLegacy.error??'')&&!!(await q('guest',`select * from public.beyond_legacy_posts('${P.adult}','workout',24)`)).error);
 check('legacy invalid category and limits fail before returning an unrelated or unbounded list',/Choose a legacy category/.test((await legacy('guest','story')).error??'')&&/Choose a legacy limit/.test((await legacy('guest','workout',null)).error??'')&&/Choose a legacy limit/.test((await legacy('guest','workout',0)).error??'')&&/Choose a legacy limit/.test((await legacy('guest','workout',25)).error??''));
 await db.exec(`insert into public.user_blocks(blocker_id,blocked_id) values('${P.legacyAth}','${P.friend}');`);
 check('late athlete block removes exact linked legacy discovery',(await legacy('friend'))?.length===0);
 await db.exec(`delete from public.user_blocks where blocker_id='${P.legacyAth}' and blocked_id='${P.friend}';insert into public.user_blocks(blocker_id,blocked_id) values('${P.friend}','${P.legacyUploader}');`);
 check('late viewer-to-uploader block removes legacy discovery',(await legacy('friend'))?.length===0);
 await db.exec(`delete from public.user_blocks where blocker_id='${P.friend}' and blocked_id='${P.legacyUploader}';update public.profiles set profile_audience=jsonb_build_object('photo','only_me') where id='${P.legacyUploader}';`);
 check('uploader media privacy removes cards even with public verified athlete',(await legacy('guest'))?.length===0);
 await db.exec(`update public.profiles set profile_audience=jsonb_build_object('photo','everyone'),age_blocked_at=now() where id='${P.legacyUploader}';`);
 check('currently closed uploader removes all discovery and closed caller cannot read',(await legacy('guest'))?.length===0&&!!(await legacy('legacyUploader')).error);
 await db.exec(`update public.profiles set age_blocked_at=null where id='${P.legacyUploader}';insert into public.friendships(requester_id,addressee_id,status,responded_at) values('${P.friend}','${P.legacyTeen}','accepted',now());`);
 check('known teen without public consent stays unavailable to guest but accepted friend can discover',!(await legacy('guest')).some?.(r=>r.id===legacyReels.teen)&&(await legacy('friend'))?.some?.(r=>r.id===legacyReels.teen));
 await db.exec(`select set_config('app.tapuai_tag_write','on',false);insert into public.reels(id,title,player_id,uploaded_by,video_url,category) values ${Array.from({length:26},(_,i)=>`('${uid(1000+i)}','Bounded workout ${i}','${legacyPlayers.legacyAth}','${P.legacyUploader}','https://fixture.invalid/video.mp4','train_like_me')`).join(',')};select set_config('app.tapuai_tag_write','on',false);update public.reels set tag_status='confirmed' where id=any(array[${Array.from({length:26},(_,i)=>`'${uid(1000+i)}'::uuid`).join(',')}]);select set_config('app.tapuai_tag_write','off',false);`);
 check('legacy card list is truly bounded24 and respects a lower requested limit',(await legacy('guest'))?.length===24&&(await legacy('guest','workout',2))?.length===2);
 // Existing replays below remain independent of these synthetic reel rows.
 const media=`'[{"id":"${uid(101)}","kind":"photo","bytes":24,"width":1,"height":1}]'::jsonb`;
 const reserve=(who,request=uid(100),audience='friends',payload=media)=>rpc(who,'beyond_reserve',`'${request}','story','A safe story','${audience}',${payload},'beyond-rights-1','beyond-safety-1'`);
 check('default off blocks reservation',/not switched on/.test((await reserve('adult')).error??''));
 check('guest cannot impersonate actor',!!(await q('guest',`select public.beyond_status('${P.adult}')`)).error);
 check('wrong expected actor is denied',/account changed/.test((await one('friend',`select public.beyond_status('${P.adult}') as v`)).error??''));
 check('fan cannot enable',/Admin/.test((await rpc('friend','admin_beyond_set_enabled',`true,'Open reviewed pilot'`)).error??''));
 console.log('SWITCH',await rpc('admin','admin_beyond_set_enabled',`true,'Open reviewed pilot'`));
 check('required age not given cannot submit',/age/.test((await reserve('unknown',uid(102))).error??''));
 check('teen everyone is refused',/friends/.test((await reserve('teen',uid(103),'everyone')).error??''));
 check('external or extra media fields are refused',/media/.test((await reserve('adult',uid(104),'friends',`'[{"id":"${uid(104)}","kind":"photo","bytes":24,"width":1,"height":1,"url":"https://x.invalid"}]'`)).error??''));
 const post=await reserve('adult');
 check('reservation is private draft with scoped immutable key',post?.status==='draft'&&post?.media?.[0]?.path===`${U.adult}/${post.id}/${uid(101)}.jpg`,JSON.stringify(post));
 check('same request exact retry reuses post',(await reserve('adult'))?.id===post.id);
 check('same request changed scope refused',/request/.test((await reserve('adult',uid(100),'everyone')).error??''));
 check('friend cannot read pending draft',(await rpc('friend','beyond_posts',`'story',30,null`))?.posts?.length===0);
 check('draft without object cannot finalize',/files/.test((await rpc('adult','beyond_finalize',`'${post.id}'`)).error??''));
 const upload=(who,p,metadata=`'{"mimetype":"image/jpeg","size":24}'`,name=p.media[0].path)=>q(who,`insert into storage.objects(bucket_id,name,owner,metadata) values('beyond_game','${name}','${U[who]}',${metadata})`);
 check('other actor cannot upload owned path',!!(await upload('friend',post)).error);
 check('wrong size metadata refused',!!(await upload('adult',post,`'{"mimetype":"image/jpeg","size":25}'`)).error);
 check('reserved owner exact object upload succeeds',Array.isArray(await upload('adult',post)));
 check('duplicate upload refused',!!(await upload('adult',post)).error);
 const pending=await rpc('adult','beyond_finalize',`'${post.id}'`);
 check('finalize pending and retry exact',(pending?.status==='pending')&&(await rpc('adult','beyond_finalize',`'${post.id}'`))?.status==='pending');
 check('friend cannot SELECT pending storage',(await q('friend',`select * from storage.objects where bucket_id='beyond_game'`))?.length===0);
 check('owner can access pending media',(await rpc('adult','beyond_media_access',`'${post.id}','${uid(101)}'`))?.ttl_seconds===60);
 check('admin rejects stale revision',/changed/.test((await rpc('admin','admin_beyond_review',`'${post.id}',0,'approve','Rights and safety reviewed'`)).error??''));
 const approved=await rpc('admin','admin_beyond_review',`'${post.id}',${pending.revision},'approve','Rights and safety reviewed'`);
 check('review makes accepted friends post visible',(await rpc('friend','beyond_posts',`'story',30,null`))?.posts?.[0]?.id===post.id);
 check('private account prevents strangers',(await rpc('stranger','beyond_posts',`'story',30,null`))?.posts?.length===0);
 await q('friend',`select public.block_user('${P.adult}')`);
 check('late block removes feed and storage',(await rpc('friend','beyond_posts',`'story',30,null`))?.posts?.length===0&&(await q('friend',`select * from storage.objects where bucket_id='beyond_game'`))?.length===0);
 await q('friend',`select public.unblock_user('${P.adult}')`);
 // Blocking ends friendship; unblocking does not silently recreate one. Restore an independently accepted test friendship.
 await db.exec(`insert into public.friendships(requester_id,addressee_id,status,responded_at) values('${P.adult}','${P.friend}','accepted',now()) on conflict do nothing`);
 await rpc('friend','beyond_report',`'${post.id}','Visible personal information'`);
 check('report immediately holds content',(await rpc('adult','beyond_my_posts',`30,null`))?.posts?.[0]?.status==='held'&&(await rpc('friend','beyond_posts',`'story',30,null`))?.posts?.length===0);
 const held=(await rpc('admin','admin_beyond_posts',`'held',30,null`))?.posts?.[0];
 check('admin queue report count bounded',held?.report_count===1);
 await rpc('admin','admin_beyond_review',`'${post.id}',${held.revision},'approve','Report reviewed; publication permitted'`);
 await rpc('admin','admin_beyond_set_enabled',`false,'Pause for staffed review'`);
 check('off removes accepted media access',!!(await rpc('friend','beyond_media_access',`'${post.id}','${uid(101)}'`)).error);
 const removed=await rpc('adult','beyond_remove',`'${post.id}'`);
 check('owner withdrawal works while disabled',removed?.status==='removed'&&removed.cleanup==='pending');
 check('late storage insert denied after removal',!!(await upload('adult',post)).error);
 check('cleanup does not pretend remaining object deleted',(await rpc('admin','admin_beyond_cleanup_finish',`'${post.id}'`))?.cleanup==='partial');
 await q('admin',`delete from storage.objects where bucket_id='beyond_game' and name='${post.media[0].path}'`);
 console.log('CLEANUP_DELETE',await q('admin',`delete from storage.objects where bucket_id='beyond_game' and name='${post.media[0].path}'`));
 check('cleanup reflects catalog deletion only',(await rpc('admin','admin_beyond_cleanup_finish',`'${post.id}'`))?.cleanup==='complete');
 await rpc('admin','admin_beyond_set_enabled',`true,'Continue reviewed pilot'`);
 for(let i=0;i<4;i++){const p=await reserve('adult',uid(200+i),'friends',`'[{"id":"${uid(300+i)}","kind":"photo","bytes":24,"width":1,"height":1}]'`);await rpc('adult','beyond_remove',`'${p.id}'`);}
 check('durable quota survives cancel/removal churn',/5 submissions/.test((await reserve('adult',uid(250),'friends',`'[{"id":"${uid(350)}","kind":"photo","bytes":24,"width":1,"height":1}]'`)).error??''));
 const teen=await reserve('teen',uid(400),'friends',`'[{"id":"${uid(401)}","kind":"photo","bytes":24,"width":1,"height":1}]'`);
 await upload('teen',teen);await rpc('teen','beyond_finalize',`'${teen.id}'`);
 check('accepted guardian sees own linked teen pending',(await rpc('guardian','beyond_media_access',`'${teen.id}','${uid(401)}'`))?.path===teen.media[0].path);
 await db.exec(`update public.guardian_links set ended_at=now() where minor_id='${P.teen}'`);
 check('ended link removes pending access',!!(await rpc('guardian','beyond_media_access',`'${teen.id}','${uid(401)}'`)).error);
 await q('admin',`select public.admin_set_birth_month('${P.teen}',${year-10},1,'Close ineligible account')`);
 check('closed author blocks even own pending media',!!(await rpc('teen','beyond_media_access',`'${teen.id}','${uid(401)}'`)).error);
 check('closed author cannot be approved',/closed/.test((await rpc('admin','admin_beyond_review',`'${teen.id}',2,'approve','Review performed'`)).error??''));
 check('direct table reads and inserts denied',!!(await q('adult','select * from public.beyond_posts')).error&&!!(await q('adult',`insert into public.beyond_settings(id,enabled) values(true,true)`)).error);
 const ownExport=await rpc('adult','beyond_export_my_data',`'posts',2,null`);
 check('own export is bounded and paginated',ownExport?.items?.length===2&&!!ownExport.next_id&&ownExport.items.every(p=>p.creator_id===P.adult));
 check('wrong actor cannot export',!!(await one('friend',`select public.beyond_export_my_data('${P.adult}','posts',30,null) as v`)).error);
 const erase=await rpc('admin','admin_beyond_erase_profile',`'${P.teen}','Support deletion request'`);
 check('erasure removes identity but preserves cleanup mappings',erase?.removed_post_ids?.includes(teen.id)&&(await rows(`select owner_id from public.beyond_posts where id='${teen.id}'`))[0]?.owner_id===null&&(await rows(`select count(*)::int n from public.beyond_media where post_id='${teen.id}'`))[0]?.n===1);
 const deleted=await rows(`delete from public.profiles where id='${P.teen}' returning id`);
 check('profile deletion preserves orphan cleanup without blocking',deleted.length===1&&(await rows(`select count(*)::int n from public.beyond_media where post_id='${teen.id}'`))[0]?.n===1);
 await db.exec(`alter function public.are_friends(uuid,uuid) rename to beyond_test_friends`);
 check('missing privacy dependency refuses enable',!(await rpc('admin','admin_beyond_status'))?.enabled&&!!(await rpc('admin','admin_beyond_set_enabled',`true,'Cannot bypass dependencies'`)).error);
 check('legacy discovery fails closed when a required privacy dependency disappears',/privacy dependencies/.test((await legacy('guest')).error??''));
 await db.exec(`alter function public.beyond_test_friends(uuid,uuid) rename to are_friends`);
 const foreignPost=await reserve('stranger',uid(700),'friends',`'[{"id":"${uid(701)}","kind":"photo","bytes":24,"width":1,"height":1}]'`);
 await upload('stranger',foreignPost);
 const foreignPending=await rpc('stranger','beyond_finalize',`'${foreignPost.id}'`);
 await rpc('admin','admin_beyond_review',`'${foreignPost.id}',${foreignPending.revision},'approve','Explicit reviewer decision'`);
 await rpc('admin','admin_beyond_erase_profile',`'${P.admin}','Erase own Beyond data'`);
 check('admin self-erasure never recreates erased audit identity',(await rows(`select count(*)::int n from public.beyond_admin_events where actor_id='${P.admin}'`))[0].n===0);
 check('admin erasure removes reviewer attribution on other owned content',(await rows(`select count(*)::int n from public.beyond_posts where reviewer_id='${P.admin}'`))[0].n===0);
 const foreignAfter=(await rows(`select owner_id,status,category,caption,reviewed_at from public.beyond_posts where id='${foreignPost.id}'`))[0];
 check('reviewer erasure preserves other authors approved post',foreignAfter.owner_id===P.stranger&&foreignAfter.status==='approved'&&foreignAfter.category==='story'&&foreignAfter.caption==='A safe story'&&!!foreignAfter.reviewed_at&&(await rows(`select count(*)::int n from public.beyond_media where post_id='${foreignPost.id}'`))[0].n===1);
 await q('admin',`select public.set_my_birth_month(${year-10},1)`);
 check('closed admin cannot read or change switch',!!(await rpc('admin','admin_beyond_status')).error&&!!(await rpc('admin','admin_beyond_set_enabled',`false,'Stop now'`)).error);
 await db.exec(fs.readFileSync(migrationPath,'utf8'));
 check('migration replay is idempotent',true);
}catch(e){check('replay builds and runs',false,e.stack);}
// Reproduce the documented pre-PRIV legacy upgrade without removing/bypassing any constraint:
// existing duplicate verified claims cause that migration itself to skip its unique index.
const legacyDb=new PGlite({extensions:{pgcrypto}});
try{
 const canonical=fs.readFileSync(schemaPath,'utf8'),cut=canonical.indexOf('-- One verified account per roster athlete,');
 if(cut<0)throw Error('Missing actual legacy verification-index migration boundary.');
 await legacyDb.exec(SUPABASE_STUBS);await legacyDb.exec(canonical.slice(0,cut));
 const users=['00000000-0000-0000-0000-000000009001','00000000-0000-0000-0000-000000009002'],player='00000000-0000-0000-0000-000000009003',reel='00000000-0000-0000-0000-000000009004';
 await legacyDb.exec(`insert into auth.users(id) values('${users[0]}'),('${users[1]}');insert into public.players(id,name) values('${player}','Duplicate legacy roster');update public.profiles set player_id='${player}',role='athlete',verification_status='verified' where user_id=any(array['${users[0]}'::uuid,'${users[1]}'::uuid]);`);
 await legacyDb.exec(canonical.slice(cut));await legacyDb.exec(fs.readFileSync(migrationPath,'utf8'));
 const profiles=(await legacyDb.exec(`select id from public.profiles where user_id=any(array['${users[0]}'::uuid,'${users[1]}'::uuid]) order by user_id`)).at(-1).rows;
 await legacyDb.exec(`update public.profiles set birth_year=1990,birth_month=1,age_check_required=false,account_private=false,profile_audience=jsonb_build_object('photo','everyone'),hide_from_search=false where player_id='${player}';select set_config('app.tapuai_tag_write','on',false);insert into public.reels(id,title,player_id,uploaded_by,video_url,category,tag_status) values('${reel}','Ambiguous legacy workout','${player}','${profiles[0].id}','https://fixture.invalid/video.mp4','train_like_me','confirmed');select set_config('app.tapuai_tag_write','off',false);`);
 const indexExists=(await legacyDb.exec(`select to_regclass('public.profiles_verified_player_uidx') is not null as present`)).at(-1).rows[0].present;
 await legacyDb.exec(`set role anon;set request.jwt.claims='{"role":"anon"}';`);
 const cards=(await legacyDb.exec(`select public.beyond_legacy_posts(null,'workout',24) as cards`)).at(-1).rows[0].cards;
 check('documented legacy duplicate verified upgrade refuses ambiguous athlete cards without constraint bypass',indexExists===false&&Array.isArray(cards)&&cards.length===0,JSON.stringify({indexExists,cards}));
}catch(e){check('legacy duplicate upgrade replay builds and runs',false,e.stack);}
finally{await legacyDb.close();}
await db.close();
console.log(JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
