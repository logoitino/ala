#!/usr/bin/env node
/**
 * CHAL-01 part 1a replay (workout challenges) on real Postgres (PGlite), never a hosted database. Owned by HIGHLIGHTS
 * with BACKEND / DATABASE_MIGRATIONS. Builds the whole canonical schema (Supabase stubbed as in schema-replay.mjs),
 * re-applies the migration over it, and tries every rule as the accounts it is about: eligibility, one response per
 * account, the daily caps, counts hidden under 5 and on minor athletes' posts, blocked and closed responders, invites
 * (friends only, silent mutes, per-pair / daily limits under the lock), the supervision event and guardian count, the
 * badge, retention, export and erasure, direct-table denial and the admin desk. A second database cut before PRIV-01
 * proves the switch refuses, naming what is missing.
 *
 *   node scripts/replay/workout-challenges-replay.mjs <pglite dist> [migration] [schema.sql]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const [dist, migrationPath = 'supabase/migrations/20261016100000_workout_challenges.sql', schemaPath = 'apps/mobile/src/backend/db/schema.sql'] = process.argv.slice(2);
if (!dist) { console.error('usage: node scripts/replay/workout-challenges-replay.mjs <pglite dist dir> [migration] [schema.sql]'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib', 'pgcrypto.js')).href);
const migration = fs.readFileSync(migrationPath, 'utf8');
const schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('create table if not exists public.challenge_responses')) {
  console.error(`FAIL  ${schemaPath} does not contain the workout challenges migration (copy it onto the end).`);
  process.exit(1);
}

const results = [];
const record = (name, pass, detail = '') => results.push({ name, pass: Boolean(pass), detail });
const Y = new Date().getUTCFullYear();
const boundRpcNames = ['admin_challenge_status', 'admin_set_challenges_enabled', 'admin_challenge_post_counts',
  'admin_challenge_nudge_senders', 'admin_hold_challenge_sender', 'admin_challenge_retention', 'admin_challenge_erase',
  'challenge_respond', 'challenge_invite', 'challenge_mute', 'challenge_inbox', 'challenge_my_status',
  'set_allow_challenges', 'challenge_export_my_data', 'challenge_counts', 'challenge_friends'];
const bindActor = (sql, profile) => sql.replace(new RegExp('public\\.(' + boundRpcNames.join('|') + ')\\(([^)]*)\\)', 'g'), (whole, name, args) =>
  args.trim().startsWith('expected_actor_id') ? whole : `public.${name}(${profile ? `'${profile}'` : 'null'}${args.trim() ? ', ' + args : ''})`);


// ---------------------------------------------------------------- 1. Before PRIV-01 / MINOR-01: the switch refuses
{
  const cut = schema.indexOf('-- Profile privacy, two-way friends and blocking');
  const early = new PGlite({ extensions: { pgcrypto } });
  await early.exec(SUPABASE_STUBS);
  await early.exec(schema.slice(0, cut));
  let applied = 'applied';
  try { await early.exec(migration); } catch (e) { applied = e.message; }
  const ADM = '00000000-0000-0000-0000-0000000000a1';
  await early.exec(`insert into auth.users (id) values ('${ADM}'); update public.profiles set role = 'admin', is_admin = true where user_id = '${ADM}';`);
  const earlyAdminProfile = (await early.exec(`select id from public.profiles where user_id = '${ADM}'`)).at(-1).rows[0].id;
  const asAdmin = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${ADM}"}';`;
  const tryIt = async (sql) => { try { return (await early.exec(`${asAdmin} ${bindActor(sql, earlyAdminProfile)};`)).at(-1).rows; } catch (e) { return { error: e.message }; } finally { await early.exec('reset role; reset request.jwt.claims;'); } };
  const refused = await tryIt(`select public.admin_set_challenges_enabled(true, 'Launch the workout challenges')`);
  const status = await tryIt(`select public.admin_challenge_status() as s`);
  const respond = await tryIt(`select public.challenge_respond(gen_random_uuid(), 'accepted')`);
  record('the migration applies on a database without PRIV-01 / MINOR-01', applied === 'applied', applied);
  record('the switch is refused while PRIV-01 and MINOR-01 are missing, naming them; participants hear "not switched on"',
    /cannot be switched on yet.*PRIV-01 friends.*PRIV-01 blocks.*MINOR-01 age bands/.test(refused.error ?? '')
      && status[0]?.s?.switched_on === false && status[0]?.s?.missing?.length >= 4 && /not switched on/.test(respond.error ?? ''),
    JSON.stringify({ refused, missing: status[0]?.s?.missing, respond }));
  await early.close();
}

// ---------------------------------------------------------------- 2. The whole schema
const db = new PGlite({ extensions: { pgcrypto } });
const rows = async (sql) => (await db.exec(sql)).at(-1).rows;
await db.exec(SUPABASE_STUBS);
try { await db.exec(schema); record('schema.sql (with this migration) builds an empty database', true); }
catch (e) { console.error(`FAIL  schema.sql builds — ${e.message}`); process.exit(1); }

const id = (n) => `00000000-0000-0000-0000-0000000c${String(n).padStart(4, '0')}`;
const U = {
  admin: id(1), ath: id(2), teenAth: id(3), guard: id(4), teenFan: id(5), newbie: id(6),
  f1: id(11), f2: id(12), f3: id(13), f4: id(14), f5: id(15), f6: id(16), f7: id(17), f8: id(18), str: id(19),
};
const PL_ATH = '00000000-0000-0000-0000-0000000d0001', PL_TEEN = '00000000-0000-0000-0000-0000000d0002';
const adultMeta = `'{"birth_year": "1990", "birth_month": "1"}'`;
await db.exec(`insert into auth.users (id, raw_user_meta_data) values
  ('${U.admin}', ${adultMeta}), ('${U.ath}', ${adultMeta}), ('${U.guard}', '{"birth_year": "1984", "birth_month": "5"}'),
  ('${U.teenAth}', '{"birth_year": "${Y - 14}", "birth_month": "1"}'), ('${U.teenFan}', '{"birth_year": "${Y - 15}", "birth_month": "1"}'),
  ('${U.newbie}', '{}'),
  ${['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'str'].map((k) => `('${U[k]}', ${adultMeta})`).join(', ')};
  insert into public.players (id, name) values ('${PL_ATH}', 'Sione Adult'), ('${PL_TEEN}', 'Lani Teen');
  update public.profiles set role = 'admin', is_admin = true where user_id = '${U.admin}';
  ${Object.entries(U).map(([k, v]) => `update public.profiles set username = '${k.toLowerCase()}acct', full_name = '${k.toUpperCase()} Person' where user_id = '${v}';`).join('\n')}
  update public.profiles set player_id = '${PL_ATH}', role = 'athlete', verification_status = 'verified' where user_id = '${U.ath}';
  update public.profiles set player_id = '${PL_TEEN}', role = 'athlete', verification_status = 'verified' where user_id = '${U.teenAth}';`);
const P = {};
for (const [k, v] of Object.entries(U)) P[k] = (await rows(`select id from public.profiles where user_id = '${v}'`))[0].id;
const as = Object.fromEntries(Object.entries(U).map(([k, v]) => [k, `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${v}"}';`]));
as.guest = `set role anon; set request.jwt.claims = '{"role":"anon"}';`;
const q = async (who, sql) => { try { return (await db.exec(`${as[who]} ${bindActor(sql, P[who])};`)).at(-1).rows; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role; reset request.jwt.claims;'); } };
const one = async (who, sql) => { const r = await q(who, sql); return Array.isArray(r) ? r[0] : r; };

// The teen athlete's guardian (confirmed MINOR-01 link) and friendships (PRIV-01), written as the server would.
const friends = [['f1', 'f2'], ['f1', 'f3'], ['f1', 'f4'], ['f1', 'f5'], ['f1', 'f6'], ['f1', 'f8'], ['f7', 'f2'], ['f8', 'f2'], ['teenFan', 'teenAth'], ['f3', 'f2']];
await db.exec(`insert into public.guardian_links (minor_id, guardian_id, source, confirmed_at) values ('${P.teenAth}', '${P.guard}', 'invite', timezone('utc', now()) - interval '1 day');
  insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ${friends.map(([a, b]) => `('${P[a]}', '${P[b]}', 'accepted', now())`).join(', ')};`);

// Posts. tag_status is set with the tag-write flag, as the athlete's approval would.
const R = Object.fromEntries(['work1', 'work2', 'work3', 'vault', 'exclusive', 'game', 'removed', 'teen', 'photoEmpty'].map((k, i) => [k, `00000000-0000-0000-0000-0000000e${String(i + 1).padStart(4, '0')}`]));
const reel = (rid, player, extra = {}) => {
  const v = { video_url: 'https://cdn.example/v.mp4', category: 'train_like_me', is_vault_only: false, is_exclusive: false, is_removed: false, ...extra };
  return `('${rid}', '${v.video_url}', 'Leg day', '${player}', '${v.category}', ${v.is_vault_only}, ${v.is_exclusive}, ${v.is_removed})`;
};
await db.exec(`insert into public.reels (id, video_url, title, player_id, category, is_vault_only, is_exclusive, is_removed) values
  ${reel(R.work1, PL_ATH)}, ${reel(R.work2, PL_ATH)}, ${reel(R.work3, PL_ATH)}, ${reel(R.vault, PL_ATH, { is_vault_only: true })},
  ${reel(R.exclusive, PL_ATH, { is_exclusive: true })}, ${reel(R.game, PL_ATH, { category: 'game_play' })},
  ${reel(R.removed, PL_ATH, { is_removed: true })}, ${reel(R.teen, PL_TEEN)}, ${reel(R.photoEmpty, PL_ATH, { video_url: '' })};
  update public.reels set media_type = 'photo_story', photo_count = 0 where id = '${R.photoEmpty}';
  select set_config('app.tapuai_tag_write', 'on', false);
  update public.reels set tag_status = 'confirmed' where id in (${Object.values(R).map((r) => `'${r}'`).join(', ')});
  select set_config('app.tapuai_tag_write', 'off', false);`);

// The invite picker must bind its minimal accepted-friend projection to the actual current JWT.
const ownFriends = await q('f1', `select * from public.challenge_friends()`);
const cappedFriends = await q('f1', `select * from public.challenge_friends(2)`);
const wrongFriends = await q('f2', `select * from public.challenge_friends(expected_actor_id => '${P.f1}')`);
const nullFriends = await q('f1', `select * from public.challenge_friends(expected_actor_id => null)`);
const guestFriends = await q('guest', `select * from public.challenge_friends(expected_actor_id => null)`);
record('friend picker binds actor, denies null and guest, exposes only accepted own friends with minimal names even while off',
  Array.isArray(ownFriends) && ownFriends.length === 6 && ownFriends.every(r =>
    Object.keys(r).sort().join(',') === 'name,profile_id' && r.name === Object.keys(P).find(k => P[k] === r.profile_id)?.toUpperCase())
    && !ownFriends.some(r => r.profile_id === P.f7) && Array.isArray(cappedFriends) && cappedFriends.length === 2
    && /Account access required/.test(wrongFriends.error ?? '') && /Account access required/.test(nullFriends.error ?? '')
    && /permission denied/.test(guestFriends.error ?? ''), JSON.stringify({ ownFriends, cappedFriends, wrongFriends, nullFriends, guestFriends }));
await db.exec(`insert into public.friendships (requester_id, addressee_id, status) values ('${P.f1}', '${P.str}', 'pending');
  insert into public.user_blocks (blocker_id, blocked_id) values ('${P.f2}', '${P.f1}');`);
const filteredFriends = await q('f1', `select * from public.challenge_friends()`);
record('friend picker excludes pending and foreign relationships and a current block in either direction',
  Array.isArray(filteredFriends) && filteredFriends.length === 5
    && !filteredFriends.some(r => [P.str, P.f2, P.f7].includes(r.profile_id)), JSON.stringify(filteredFriends));
await db.exec(`delete from public.user_blocks where blocker_id = '${P.f2}' and blocked_id = '${P.f1}';
  delete from public.friendships where requester_id = '${P.f1}' and addressee_id = '${P.str}';`);
const invalidFriendLimit = await q('f1', `select * from public.challenge_friends(null)`);
const tooManyFriends = await q('f1', `select * from public.challenge_friends(51)`);
record('friend picker rejects invalid row limits rather than returning an unbounded set',
  /Choose a friend limit/.test(invalidFriendLimit.error ?? '') && /Choose a friend limit/.test(tooManyFriends.error ?? ''),
  JSON.stringify({ invalidFriendLimit, tooManyFriends }));

// ---------------------------------------------------------------- Switch
const before = await q('f1', `select public.challenge_respond('${R.work1}', 'accepted')`);
const offCounts = await one('guest', `select public.challenge_counts('${R.work1}') as c`);
const noReason = await q('admin', `select public.admin_set_challenges_enabled(true, 'go')`);
const fanSwitch = await q('f1', `select public.admin_set_challenges_enabled(true, 'I want it on')`);
const guestSwitch = await q('guest', `select public.admin_set_challenges_enabled(true, 'I want it on')`);
const statusBefore = await one('admin', `select public.admin_challenge_status() as s`);
record('challenges start switched off; fans hear "not switched on" and counts say switched off',
  /not switched on/.test(before.error ?? '') && offCounts?.c?.enabled === false && statusBefore?.s?.switched_on === false && statusBefore?.s?.missing?.length === 0,
  JSON.stringify({ before, offCounts, statusBefore }));
record('only an admin, with a reason, can flip the switch (a guest cannot even call it)',
  /reason/.test(noReason.error ?? '') && /Admin access required/.test(fanSwitch.error ?? '') && /permission denied/.test(guestSwitch.error ?? ''),
  JSON.stringify({ noReason, fanSwitch, guestSwitch }));
const switched = await one('admin', `select public.admin_set_challenges_enabled(true, 'Owner approved CHAL-01 1a') as s`);
record('with PRIV-01 and MINOR-01 present the admin switches challenges on (audited)', switched?.s?.live === true
  && (await rows(`select count(*)::int as n from public.challenge_admin_events where action = 'switch_on' and reason = 'Owner approved CHAL-01 1a'`))[0].n === 1, JSON.stringify(switched));

// ---------------------------------------------------------------- Eligibility
const reasons = {};
for (const k of ['vault', 'exclusive', 'game', 'removed', 'teen', 'photoEmpty', 'work1']) reasons[k] = (await one('f1', `select public.challenge_counts('${R[k]}') as c`))?.c?.reason ?? 'ok';
const refusals = {};
for (const k of ['vault', 'exclusive', 'game', 'removed', 'teen']) refusals[k] = (await q('f1', `select public.challenge_respond('${R[k]}', 'accepted')`)).error ?? 'ran';
record('responses only on listable, non-Vault, non-Exclusive Train Like Me posts whose athlete allows them (a minor athlete is off by default)',
  reasons.vault === 'vault' && reasons.exclusive === 'exclusive' && reasons.game === 'not_workout' && reasons.removed === 'not_listed'
    && reasons.photoEmpty === 'not_listed' && reasons.teen === 'athlete_off' && reasons.work1 === 'ok'
    && Object.values(refusals).every((e) => /not open on this post/.test(e)),
  JSON.stringify({ reasons, refusals }));
const guestResp = await q('guest', `select public.challenge_respond('${R.work1}', 'accepted')`);
const ownResp = await q('ath', `select public.challenge_respond('${R.work1}', 'accepted')`);
const newbieResp = await one('newbie', `select public.challenge_respond('${R.work1}', 'im_in') as c`);
const badPreset = await q('f2', `select public.challenge_respond('${R.work1}', 'you rock')`);
record('a guest cannot respond, the athlete cannot answer their own workout, an account with no age yet (treated as 13–15) can, free text is refused',
  /permission denied/.test(guestResp.error ?? '') && /own workout/.test(ownResp.error ?? '') && newbieResp?.c?.mine === 'im_in' && /Choose one/.test(badPreset.error ?? ''),
  JSON.stringify({ guestResp, ownResp, newbieResp, badPreset }));

// A retained SDK call may use a different current JWT: the claimed actor is a comparison, never authentication.
const participantStateBefore = await rows(`select (select count(*)::int from public.challenge_responses) as responses,
  (select count(*)::int from public.challenge_mutes) as mutes`);
const wrongParticipant = await q('f2', `select public.challenge_respond(expected_actor_id => '${P.f1}', target_reel_id => '${R.work1}', preset => 'accepted')`);
const wrongPrivateRead = await q('f2', `select public.challenge_my_status(expected_actor_id => '${P.f1}')`);
const matchingPrivateRead = await one('f2', `select public.challenge_my_status(expected_actor_id => '${P.f2}') as s`);
const guestForgedCounts = await q('guest', `select public.challenge_counts(expected_actor_id => '${P.f2}', target_reel_id => '${R.work1}')`);
const authedNullCounts = await q('f2', `select public.challenge_counts(expected_actor_id => null, target_reel_id => '${R.work1}')`);
record('participant mutation/private reads bind expected actor; guest cannot claim an actor and authenticated counts cannot omit it',
  /Account access required/.test(wrongParticipant.error ?? '') && /Account access required/.test(wrongPrivateRead.error ?? '')
    && matchingPrivateRead?.s?.enabled === true && /Account access required/.test(guestForgedCounts.error ?? '')
    && /Account access required/.test(authedNullCounts.error ?? '')
    && JSON.stringify(participantStateBefore) === JSON.stringify(await rows(`select (select count(*)::int from public.challenge_responses) as responses,
      (select count(*)::int from public.challenge_mutes) as mutes`)),
  JSON.stringify({ wrongParticipant, wrongPrivateRead, matchingPrivateRead, guestForgedCounts, authedNullCounts }));

// ---------------------------------------------------------------- One response per account, changeable
await q('f1', `select public.challenge_respond('${R.work1}', 'accepted')`);
const changed = await one('f1', `select public.challenge_respond('${R.work1}', 'love_it') as c`);
const mineRows = await rows(`select preset from public.challenge_responses where responder_id = '${P.f1}' and reel_id = '${R.work1}'`);
const removedResp = await one('f1', `select public.challenge_respond('${R.work1}', null) as c`);
const afterRemove = await rows(`select count(*)::int as n from public.challenge_responses where responder_id = '${P.f1}'`);
record('one response per account per post: it changes in place and can be removed', changed?.c?.mine === 'love_it' && mineRows.length === 1
  && mineRows[0].preset === 'love_it' && removedResp?.c?.mine === null && afterRemove[0].n === 0, JSON.stringify({ changed: changed?.c, mineRows, afterRemove }));

// ---------------------------------------------------------------- Daily cap (50 posts a day)
await db.exec(`insert into public.reels (id, video_url, title, player_id, category)
  select ('00000000-0000-0000-0000-0000000f' || lpad(g::text, 4, '0'))::uuid, 'https://cdn.example/x.mp4', 'Drill', '${PL_ATH}', 'train_like_me' from generate_series(1, 50) g;
  select set_config('app.tapuai_tag_write', 'on', false);
  update public.reels set tag_status = 'confirmed' where title = 'Drill';
  select set_config('app.tapuai_tag_write', 'off', false);`);
for (let g = 1; g <= 50; g++) await q('f8', `select public.challenge_respond('00000000-0000-0000-0000-0000000f${String(g).padStart(4, '0')}', 'im_in')`);
const capped = await q('f8', `select public.challenge_respond('${R.work1}', 'accepted')`);
const hasQuota = (await rows(`select to_regclass('public.challenge_response_quota') is not null as yes`))[0].yes;
await db.exec(hasQuota
  ? `update public.challenge_response_quota set last_responded_at = now() - interval '24 hours' where responder_id = '${P.f8}' and reel_id = '00000000-0000-0000-0000-0000000f0001'`
  : `update public.challenge_responses set updated_at = now() - interval '24 hours' where responder_id = '${P.f8}' and reel_id = '00000000-0000-0000-0000-0000000f0001'`);
const afterDay = await one('f8', `select public.challenge_respond('${R.work1}', 'accepted') as c`);
record('50 responses a day: the 51st post is refused until a day has passed', /50 workouts today/.test(capped.error ?? '') && afterDay?.c?.mine === 'accepted',
  JSON.stringify({ capped, afterDay: afterDay?.c?.mine ?? afterDay }));
const sameAtCap = await one('f8', `select public.challenge_respond('${R.work1}', 'love_it') as c`);
await q('f8', `select public.challenge_respond('${R.work1}', null)`);
const sameRepost = await one('f8', `select public.challenge_respond('${R.work1}', 'accepted') as c`);
await db.exec(`delete from public.reels where id = '00000000-0000-0000-0000-0000000f0002'`);
const deletedCounts = await one('f8', `select public.challenge_counts('00000000-0000-0000-0000-0000000f0002') as c`);
const afterPostDeletion = await q('f8', `select public.challenge_respond('${R.work2}', 'accepted')`);
for (let g = 3; g <= 50; g++) await q('f8', `select public.challenge_respond('00000000-0000-0000-0000-0000000f${String(g).padStart(4, '0')}', null)`);
await q('f8', `select public.challenge_respond('${R.work1}', null)`);
const afterChurn = await q('f8', `select public.challenge_respond('${R.work3}', 'accepted')`);
const quotaRows = hasQuota ? await rows(`select count(*)::int as n from public.challenge_response_quota where responder_id = '${P.f8}'`) : [];
record('rolling quota survives response removal and post deletion, counts distinct IDs, permits same-workout changes and never resurrects a deleted post',
  sameAtCap?.c?.mine === 'love_it' && sameRepost?.c?.mine === 'accepted' && deletedCounts?.c?.eligible === false
    && /50 workouts today/.test(afterPostDeletion.error ?? '') && /50 workouts today/.test(afterChurn.error ?? '') && quotaRows[0]?.n === 50,
  JSON.stringify({ sameAtCap: sameAtCap?.c?.mine, sameRepost: sameRepost?.c?.mine, deletedCounts, afterPostDeletion, afterChurn, quotaRows }));
await db.exec(`delete from public.challenge_responses where responder_id = '${P.f8}'`);

// ---------------------------------------------------------------- Counts hidden under 5
for (const k of ['f2', 'f3', 'f4', 'f1']) await q(k, `select public.challenge_respond('${R.work1}', 'accepted')`);
const four = await one('f1', `select public.challenge_counts('${R.work1}') as c`);
await q('f5', `select public.challenge_respond('${R.work1}', 'accepted')`);
const fiveOwn = await one('f5', `select public.challenge_counts('${R.work1}') as c`);
const fiveGuest = await one('guest', `select public.challenge_counts('${R.work1}') as c`);
record("counts per preset are hidden below 5 and show at 5 (the caller's own response counts and is returned)",
  four?.c?.counts?.accepted === null && four?.c?.total === 5 && four?.c?.mine === 'accepted' && fiveOwn?.c?.counts?.accepted === 5
    && fiveOwn?.c?.mine === 'accepted' && fiveGuest?.c?.counts?.accepted === 5 && fiveGuest?.c?.mine === null && fiveGuest?.c?.counts?.im_in === null,
  JSON.stringify({ four: four?.c, fiveOwn: fiveOwn?.c, fiveGuest: fiveGuest?.c }));

// ---------------------------------------------------------------- Blocked and closed responders
await q('ath', `select public.block_user('${P.f5}')`);
const afterBlock = await one('guest', `select public.challenge_counts('${R.work1}') as c`);
await q('f6', `select public.challenge_respond('${R.work1}', 'accepted')`);
const backToFive = await one('guest', `select public.challenge_counts('${R.work1}') as c`);
const closed = await one('f4', `select public.set_my_birth_month(${Y - 10}, 1)->>'status' as s`);
const afterClose = await one('guest', `select public.challenge_counts('${R.work1}') as c`);
const closedCall = await q('f4', `select public.challenge_respond('${R.work2}', 'accepted')`);
const afterFriendClosure = await q('f1', `select * from public.challenge_friends()`);
const closedFriendCaller = await q('f4', `select * from public.challenge_friends()`);
record('friend picker masks a newly closed friend and denies a closed caller with retained authentication',
  Array.isArray(afterFriendClosure) && !afterFriendClosure.some(r => r.profile_id === P.f4)
    && /Sign in/.test(closedFriendCaller.error ?? ''), JSON.stringify({ afterFriendClosure, closedFriendCaller }));
const blockedResp = await q('f5', `select public.challenge_respond('${R.work2}', 'accepted')`);
record('responders blocked with the athlete, and closed (under-13) accounts, stop counting; neither can respond',
  afterBlock?.c?.counts?.accepted === null && backToFive?.c?.counts?.accepted === 5 && closed?.s === 'blocked' && afterClose?.c?.counts?.accepted === null
    && /Sign in/.test(closedCall.error ?? '') && /not open on this post/.test(blockedResp.error ?? ''),
  JSON.stringify({ afterBlock: afterBlock?.c?.counts, backToFive: backToFive?.c?.counts, closed, afterClose: afterClose?.c?.counts, closedCall, blockedResp }));

// ---------------------------------------------------------------- Minor athlete: the switch, the supervision event, who sees counts
const notAthlete = await q('f1', `select public.set_allow_challenges(true)`);
const teenOn = await one('teenAth', `select public.set_allow_challenges(true) as s`);
const event = await rows(`select kind, detail from public.supervision_events where minor_id = '${P.teenAth}' and detail->'keys' ? 'allow_challenges'`);
const guardianSees = await one('guard', `select public.guardian_get_supervision('${P.teenAth}') as s`);
record('a teen athlete turning challenges on is a supervision event the guardian sees; only athletes have the setting',
  /verified athlete/.test(notAthlete.error ?? '') && teenOn?.s?.allow_challenges === true && teenOn?.s?.allow_default === false && event.length === 1
    && event[0].kind === 'settings_changed' && guardianSees?.s?.events?.some((e) => e.detail?.allow_challenges === true),
  JSON.stringify({ notAthlete, teenOn: teenOn?.s, event, guardianEvents: guardianSees?.s?.events?.length }));
for (const k of ['f1', 'f2', 'f3', 'f6', 'f7']) await q(k, `select public.challenge_respond('${R.teen}', 'love_it')`);
const teenStranger = await one('f8', `select public.challenge_counts('${R.teen}') as c`);
const teenGuest = await one('guest', `select public.challenge_counts('${R.teen}') as c`);
const teenSelf = await one('teenAth', `select public.challenge_counts('${R.teen}') as c`);
const teenGuardian = await one('guard', `select public.challenge_counts('${R.teen}') as c`);
const teenResponder = await one('f1', `select public.challenge_counts('${R.teen}') as c`);
record("on a minor athlete's post only the athlete and their guardian see counts; a responder still sees their own choice",
  teenStranger?.c?.visible === false && teenStranger?.c?.counts === null && teenGuest?.c?.counts === null && teenSelf?.c?.counts?.love_it === 5
    && teenGuardian?.c?.counts?.love_it === 5 && teenResponder?.c?.counts === null && teenResponder?.c?.mine === 'love_it',
  JSON.stringify({ teenStranger: teenStranger?.c, teenSelf: teenSelf?.c?.counts, teenGuardian: teenGuardian?.c?.counts, teenResponder: teenResponder?.c }));

// ---------------------------------------------------------------- Invites
const notFriend = await q('f1', `select public.challenge_invite('${R.work1}', '${P.str}')`);
const sent = await one('f1', `select public.challenge_invite('${R.work1}', '${P.f2}') as r`);
const samePair = await q('f1', `select public.challenge_invite('${R.work1}', '${P.f2}')`);
const samePairOtherPost = await q('f1', `select public.challenge_invite('${R.work2}', '${P.f2}')`);
const inbox = await q('f2', `select sender_name, athlete_name, reel_id from public.challenge_inbox()`);
record('invites go to accepted friends only, once per pair per day across all posts, and land in the friend\'s Activity inbox',
  /only invite friends/.test(notFriend.error ?? '') && sent?.r?.status === 'sent' && /already invited this friend today/.test(samePair.error ?? '')
    && /already invited/.test(samePairOtherPost.error ?? '') && inbox.length === 1 && inbox[0].sender_name === 'F1' && inbox[0].athlete_name === 'Sione Adult',
  JSON.stringify({ notFriend, sent, samePair, samePairOtherPost, inbox }));
const beforeAthleteBlock = await one('f2', `select public.challenge_counts('${R.work1}') as c`);
await q('f2', `select public.block_user('${P.ath}')`);
const viewerBlockedCounts = await one('f2', `select public.challenge_counts('${R.work1}') as c`);
const viewerBlockedInbox = await q('f2', `select count(*)::int as n from public.challenge_inbox()`);
record('a current viewer-to-athlete block hides counts, own response and previously delivered workout invites',
  beforeAthleteBlock?.c?.eligible === true && viewerBlockedCounts?.c?.eligible === false && viewerBlockedCounts?.c?.mine === null
    && viewerBlockedCounts?.c?.counts === null && viewerBlockedCounts?.c?.total === null && viewerBlockedInbox[0]?.n === 0,
  JSON.stringify({ viewerBlockedCounts, viewerBlockedInbox }));
await db.exec(`delete from public.user_blocks where blocker_id = '${P.f2}' and blocked_id = '${P.ath}'`);
await q('ath', `select public.block_user('${P.f2}')`);
const athleteBlockedCounts = await one('f2', `select public.challenge_counts('${R.work1}') as c`);
const athleteBlockedInbox = await q('f2', `select count(*)::int as n from public.challenge_inbox()`);
record('an athlete-to-viewer block also hides own response, aggregate counts and previously delivered invites',
  athleteBlockedCounts?.c?.eligible === false && athleteBlockedCounts?.c?.mine === null && athleteBlockedCounts?.c?.counts === null
    && athleteBlockedCounts?.c?.total === null && athleteBlockedInbox[0]?.n === 0,
  JSON.stringify({ athleteBlockedCounts, athleteBlockedInbox }));
await db.exec(`delete from public.user_blocks where blocker_id = '${P.ath}' and blocked_id = '${P.f2}'`);

await q('f3', `select public.challenge_mute('${P.f1}', true)`);
const toMuted = await one('f1', `select public.challenge_invite('${R.work1}', '${P.f3}') as r`);
const mutedInbox = await q('f3', `select count(*)::int as n from public.challenge_inbox()`);
await q('f6', `select public.challenge_mute(null, true)`);
const toMuteAll = await one('f1', `select public.challenge_invite('${R.work2}', '${P.f6}') as r`);
const muteAllInbox = await q('f6', `select count(*)::int as n from public.challenge_inbox()`);
const dropped = await rows(`select count(*)::int as n from public.challenge_nudges where sender_id = '${P.f1}' and not delivered`);
record('a mute (one sender or everyone) drops the invite silently: the sender gets the same answer, the recipient sees nothing',
  toMuted?.r?.status === 'sent' && mutedInbox[0]?.n === 0 && toMuteAll?.r?.status === 'sent' && muteAllInbox[0]?.n === 0 && dropped[0].n === 2,
  JSON.stringify({ toMuted, mutedInbox, toMuteAll, muteAllInbox, dropped }));
const fifth = await one('f1', `select public.challenge_invite('${R.work1}', '${P.f8}') as r`);
const toBlockedWithAthlete = await one('f1', `select public.challenge_invite('${R.work3}', '${P.f5}') as r`);
const sixth = await q('f1', `select public.challenge_invite('${R.work3}', '${P.f2}')`);
record('5 invites a day per sender, dropped ones included, so a mute cannot be detected through the limit',
  fifth?.r?.sent_today === 4 && toBlockedWithAthlete?.r?.sent_today === 5 && /5 invites today/.test(sixth.error ?? ''), JSON.stringify({ fifth, toBlockedWithAthlete, sixth }));
// A second sender fills the cap in one burst.
await db.exec(`insert into public.friendships (requester_id, addressee_id, status, responded_at) values
  ('${P.f7}', '${P.f1}', 'accepted', now()), ('${P.f7}', '${P.f3}', 'accepted', now()), ('${P.f7}', '${P.f6}', 'accepted', now()), ('${P.f7}', '${P.f8}', 'accepted', now()), ('${P.f7}', '${P.newbie}', 'accepted', now()), ('${P.f7}', '${P.teenFan}', 'accepted', now());`);
const burst = [];
for (const k of ['f2', 'f1', 'f3', 'f6', 'f8', 'newbie']) burst.push((await q('f7', `select (public.challenge_invite('${R.work1}', '${P[k]}'))->>'status' as s`)).error ?? 'sent');
const lockHeld = /pg_advisory_xact_lock\(pg_catalog\.hashtextextended\('challenge-invite:'/.test((await rows(`select pg_get_functiondef('public.challenge_invite(uuid, uuid, uuid)'::regprocedure) as d`))[0].d);
record('the daily limit holds in a burst (5 pass, the 6th is refused) and the counter is taken under a per-sender lock',
  burst.slice(0, 5).every((s) => s === 'sent') && /5 invites today/.test(burst[5]) && lockHeld, JSON.stringify({ burst, lockHeld }));
await q('f8', `select public.challenge_invite('${R.work1}', '${P.f2}')`);
const beforeBlockInbox = await q('f2', `select count(*)::int as n from public.challenge_inbox() where sender_id = '${P.f8}'`);
await q('f2', `select public.block_user('${P.f8}')`);
const afterFriendBlock = await q('f8', `select public.challenge_invite('${R.work2}', '${P.f2}')`);
const blockedInbox = await q('f2', `select count(*)::int as n from public.challenge_inbox() where sender_id = '${P.f8}'`);
record('a block ends the friendship (no invite either way) and hides earlier invites from that person', /only invite friends/.test(afterFriendBlock.error ?? '') && beforeBlockInbox[0]?.n === 1 && blockedInbox[0]?.n === 0,
  JSON.stringify({ afterFriendBlock, beforeBlockInbox, blockedInbox }));
// Admin hold on a sender: mute (silent) and suspend (refused), each with a reason, audited.
const holdNoReason = await q('admin', `select public.admin_hold_challenge_sender('${P.f3}', 'mute', 'x')`);
await q('admin', `select public.admin_hold_challenge_sender('${P.f3}', 'mute', 'Reported for invite spam')`);
const heldSend = await one('f3', `select public.challenge_invite('${R.work1}', '${P.f2}') as r`);
const heldRow = await rows(`select delivered from public.challenge_nudges where sender_id = '${P.f3}'`);
await q('admin', `select public.admin_hold_challenge_sender('${P.f3}', 'suspend', 'Second report, invites paused')`);
const suspended = await q('f3', `select public.challenge_invite('${R.work2}', '${P.f1}')`);
const audit = await rows(`select action, reason from public.challenge_admin_events where target_profile_id = '${P.f3}' order by id`);
record('an admin can mute a sender (silently dropped) or suspend their invites (refused), each with a reason, audited',
  /reason/.test(holdNoReason.error ?? '') && heldSend?.r?.status === 'sent' && heldRow.length === 1 && heldRow[0].delivered === false
    && /paused on your account/.test(suspended.error ?? '') && audit.map((a) => a.action).join(',') === 'sender_mute,sender_suspend',
  JSON.stringify({ holdNoReason, heldSend, heldRow, suspended, audit }));

// ---------------------------------------------------------------- Guardian summary count
const teenInvite = await one('teenFan', `select public.challenge_invite('${R.work1}', '${P.teenAth}') as r`);
const summary = await one('guard', `select public.guardian_get_supervision('${P.teenAth}') as s`);
const teenOwn = await one('teenAth', `select public.get_my_supervision() as s`);
record('the guardian summary counts challenge invites received in 7 days (a count, never who); the teen sees the same',
  teenInvite?.r?.status === 'sent' && summary?.s?.summary?.challenge_invites_7d === 1 && teenOwn?.s?.summary?.challenge_invites_7d === 1
    && !JSON.stringify(summary?.s?.summary).includes(P.teenFan),
  JSON.stringify({ teenInvite, summary: summary?.s?.summary }));

// ---------------------------------------------------------------- Badge
await q('f2', `select public.challenge_respond('${R.work1}', 'did_it')`);
const two = await one('f2', `select public.challenge_respond('${R.work2}', 'did_it') as c`);
const three = await one('f2', `select public.challenge_respond('${R.work3}', 'did_it') as c`);
const again = await one('f2', `select public.challenge_respond('${R.work3}', 'accepted') as c`);
const status = await one('f2', `select public.challenge_my_status() as s`);
record('"Challenge finisher" is earned on the third different workout answered "Did it!", once, and stays private to its holder',
  two?.c?.badge_earned === false && three?.c?.badge_earned === true && again?.c?.badge_earned === false && status?.s?.badges?.length === 1
    && status?.s?.badges[0].badge === 'challenge_finisher', JSON.stringify({ two: two?.c?.badge_earned, three: three?.c?.badge_earned, badges: status?.s?.badges }));

// ---------------------------------------------------------------- Admin desk
const posts = await q('admin', `select reel_id, accepted, love_it, did_it, responses, invites, eligible from public.admin_challenge_post_counts(50)`);
const w1 = Array.isArray(posts) ? posts.find((r) => r.reel_id === R.work1) : null;
const senders = await q('admin', `select sender_id, sender_username, sent, dropped, recipients, recipient_ids, hold from public.admin_challenge_nudge_senders(7)`);
const f1Row = Array.isArray(senders) ? senders.find((r) => r.sender_id === P.f1) : null;
const fanDesk = await q('f1', `select * from public.admin_challenge_nudge_senders(7)`);
record('admin: per-post aggregate counts and per-sender invite counts (recipients as ids only); fans are refused',
  w1?.eligible === true && w1?.responses >= 5 && w1?.invites >= 3 && f1Row?.sent === 5 && f1Row?.dropped === 3 && f1Row?.recipient_ids?.length === 5
    && /Admin access required/.test(fanDesk.error ?? ''),
  JSON.stringify({ w1, f1Row, fanDesk }));

// ---------------------------------------------------------------- Retention, export, erasure
await db.exec(`insert into public.challenge_nudges (sender_id, recipient_id, reel_id, delivered, created_at) values ('${P.f6}', '${P.f1}', '${R.work1}', true, timezone('utc', now()) - interval '31 days')`);
const kept = (await rows(`select count(*)::int as n from public.challenge_nudges where created_at > timezone('utc', now()) - interval '30 days'`))[0].n;
const retention = await one('admin', `select public.admin_challenge_retention() as r`);
const afterRet = await rows(`select count(*)::int as old, (select count(*)::int from public.challenge_nudges) as total from public.challenge_nudges where created_at < timezone('utc', now()) - interval '30 days'`);
const rewrite = await db.exec(`update public.challenge_admin_events set reason = 'rewritten'`).then(() => 'ran', (e) => e.message);
record('retention deletes invites after 30 days and keeps newer ones; the admin record cannot be rewritten',
  retention?.r?.invites === 1 && afterRet[0].old === 0 && afterRet[0].total === kept && /kept as written/.test(rewrite), JSON.stringify({ retention, afterRet, kept, rewrite }));
const exported = await one('f1', `select public.challenge_export_my_data() as e`);
const ex = exported?.e ?? {};
record('export covers responses, invites sent and received, mutes, badges and the setting, and never says whether a sent invite was dropped',
  Array.isArray(ex.responses) && ex.responses.length >= 1 && ex.invites_sent?.length === 5 && ex.invites_sent.every((n) => !('delivered' in n))
    && Array.isArray(ex.invites_received) && Array.isArray(ex.mutes) && Array.isArray(ex.badges) && 'athlete_setting' in ex,
  JSON.stringify({ responses: ex.responses?.length, sent: ex.invites_sent?.length, keys: Object.keys(ex) }));
const erase = await one('admin', `select public.admin_challenge_erase('${P.f2}', 'Deletion request ticket 42') as r`);
const leftover = await rows(`select
  (select count(*) from public.challenge_responses where responder_id = '${P.f2}')::int +
  (select count(*) from public.challenge_nudges where '${P.f2}' in (sender_id, recipient_id))::int +
  (select count(*) from public.challenge_mutes where '${P.f2}' in (recipient_id, coalesce(sender_id, recipient_id)))::int +
  (select count(*) from public.challenge_badges where profile_id = '${P.f2}')::int as n`);
const eraseAudit = await rows(`select count(*)::int as n from public.challenge_admin_events where action = 'erase' and target_profile_id is null and reason = 'Deletion request ticket 42'`);
const plainDeletion = await db.exec(`delete from auth.users where id = '${U.f6}'`).then(() => 'deleted', e => e.message);
const cascade = await rows(`select (select count(*) from public.challenge_mutes where recipient_id = '${P.f6}')::int + (select count(*) from public.challenge_responses where responder_id = '${P.f6}')::int as n`);
record('erasure removes a person from all four tables (audited); deleting the profile cascades',
  erase?.r?.responses >= 3 && erase?.r?.badges === 1 && leftover[0].n === 0 && eraseAudit[0].n === 1 && cascade[0].n === 0 && plainDeletion === 'deleted' && (await rows(`select count(*)::int as n from auth.users where id = '${U.f6}'`))[0].n === 0, JSON.stringify({ erase, leftover, eraseAudit, cascade, plainDeletion }));

// The new redaction scope never authorizes evidence edits or another profile's identity.
const evidenceId = (await rows(`select id from public.challenge_admin_events where target_profile_id = '${P.f3}' order by id limit 1`))[0].id;
const unauthorizedIdentity = await db.exec(`update public.challenge_admin_events set target_profile_id = null where id = ${evidenceId}`).then(() => 'ran', e => e.message);
const wrongScopeIdentity = await db.exec(`select set_config('app.tapuai_challenge_redact_profile', '${P.f1}', false);
  update public.challenge_admin_events set target_profile_id = null where id = ${evidenceId}`).then(() => 'ran', e => e.message);
const evidenceEdits = [];
for (const change of ["reason = 'Changed reason'", "action = 'sender_clear'", "detail = '{\"altered\":true}'::jsonb", "created_at = created_at + interval '1 second'", "id = id + 10000", `admin_id = '${P.f1}'`]) {
  evidenceEdits.push(await db.exec(`select set_config('app.tapuai_challenge_redact_profile', '${P.f3}', false);
    update public.challenge_admin_events set target_profile_id = null, ${change} where id = ${evidenceId}`).then(() => 'ran', e => e.message));
}
await db.exec(`select set_config('app.tapuai_challenge_redact_profile', '', false)`);
const clientRedact = await q('admin', `select public.challenge_redact_audit_identity('${P.f3}')`);
record('identity redaction rejects absent/wrong scopes and every nonidentity change, and even admin clients cannot call its helper',
  /kept as written/.test(unauthorizedIdentity) && /kept as written/.test(wrongScopeIdentity)
    && evidenceEdits.every((e, i) => i === 4 ? /column "id" can only be updated to DEFAULT/.test(e) : /kept as written/.test(e)) && /permission denied/.test(clientRedact.error ?? ''),
  JSON.stringify({ unauthorizedIdentity, wrongScopeIdentity, evidenceEdits, clientRedact }));
// A surviving admin erasing their own challenge data must not reattach either identity in the new erase event.
const erasingAdminUid = id(30);
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${erasingAdminUid}', ${adultMeta});
  update public.profiles set role = 'admin', is_admin = true where user_id = '${erasingAdminUid}'`);
const erasingAdmin = (await rows(`select id from public.profiles where user_id = '${erasingAdminUid}'`))[0].id;
P.selfErasingAdmin = erasingAdmin;
as.selfErasingAdmin = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${erasingAdminUid}"}';`;
await q('selfErasingAdmin', `select public.admin_hold_challenge_sender('${erasingAdmin}', 'mute', 'Self-erasure audit fixture')`);
const mismatchBefore = await rows(`select count(*)::int as n from public.challenge_admin_events`);
const wrongActorRead = await q('selfErasingAdmin', `select public.admin_challenge_status(expected_actor_id => '${P.admin}')`);
const wrongActorWrite = await q('selfErasingAdmin', `select public.admin_set_challenges_enabled(expected_actor_id => '${P.admin}', turn_on => false, reason => 'Wrong expected actor request')`);
const matchingActorRead = await one('selfErasingAdmin', `select public.admin_challenge_status(expected_actor_id => '${erasingAdmin}') as s`);
const nullActorRead = await q('selfErasingAdmin', `select public.admin_challenge_status(expected_actor_id => null)`);
record('admin requests bind expected profile to actual open admin: mismatched/null reads and writes denied, matching actor works',
  /Admin access required/.test(wrongActorRead.error ?? '') && /Admin access required/.test(wrongActorWrite.error ?? '')
    && /Admin access required/.test(nullActorRead.error ?? '') && matchingActorRead?.s?.live === true
    && JSON.stringify(mismatchBefore) === JSON.stringify(await rows(`select count(*)::int as n from public.challenge_admin_events`)),
  JSON.stringify({ wrongActorRead, wrongActorWrite, nullActorRead, matchingActorRead }));
const selfEvidenceBefore = await rows(`select id, action, reason, detail, created_at from public.challenge_admin_events where admin_id = '${erasingAdmin}' order by id`);
const selfErase = await one('selfErasingAdmin', `select public.admin_challenge_erase('${erasingAdmin}', 'Erase own challenge records') as r`);
const selfEvidenceAfter = await rows(`select id, action, reason, detail, created_at from public.challenge_admin_events where id = ${selfEvidenceBefore[0].id}`);
record('support erasure of a surviving acting admin clears both audit identities, preserves old evidence and does not reintroduce them',
  selfErase?.r?.audit_identities === 1 && JSON.stringify(selfEvidenceBefore) === JSON.stringify(selfEvidenceAfter)
    && (await rows(`select count(*)::int as n from public.challenge_admin_events where admin_id = '${erasingAdmin}' or target_profile_id = '${erasingAdmin}'`))[0].n === 0
    && (await rows(`select count(*)::int as n from public.profiles where id = '${erasingAdmin}'`))[0].n === 1,
  JSON.stringify({ selfErase, selfEvidenceBefore, selfEvidenceAfter }));

// Referenced audit identities must redact without altering evidence or blocking account deletion.
const targetAuditBefore = await rows(`select id, action, reason, detail, created_at from public.challenge_admin_events where target_profile_id = '${P.f3}' order by id`);
const targetDeletion = await db.exec(`delete from auth.users where id = '${U.f3}'`).then(() => 'deleted', e => e.message);
const targetAuditAfter = await rows(`select id, action, reason, detail, created_at from public.challenge_admin_events where id in (${targetAuditBefore.map(r => r.id).join(',')}) order by id`);
const targetRefs = await rows(`select count(*)::int as n from public.challenge_admin_events where target_profile_id = '${P.f3}' or admin_id = '${P.f3}'`);
record('deleting an audit-referenced target succeeds, clears only identity and preserves immutable evidence',
  targetDeletion === 'deleted' && targetRefs[0].n === 0 && targetAuditBefore.length === 2 && JSON.stringify(targetAuditBefore) === JSON.stringify(targetAuditAfter)
    && (await rows(`select count(*)::int as n from public.profiles where id = '${P.f3}'`))[0].n === 0,
  JSON.stringify({ targetDeletion, targetRefs, targetAuditBefore, targetAuditAfter }));
const quotaExport = await one('f8', `select public.challenge_export_my_data() as e`);
const quotaErase = await one('admin', `select public.admin_challenge_erase('${P.f8}', 'Erase workout data by support request') as r`);
record('own export includes minimal durable quota; privileged erasure clears it without retaining a target audit identity',
  quotaExport?.e?.response_quota?.length === 50 && quotaExport.e.response_quota.every(r => Object.keys(r).sort().join(',') === 'last_responded_at,reel_id')
    && quotaErase?.r?.response_quota === 50 && (!hasQuota || (await rows(`select count(*)::int as n from public.challenge_response_quota where responder_id = '${P.f8}'`))[0].n === 0)
    && (await rows(`select count(*)::int as n from public.challenge_admin_events where target_profile_id = '${P.f8}'`))[0].n === 0,
  JSON.stringify({ quotaExport: quotaExport?.e?.response_quota?.length, quotaErase }));

// Expired quota can be pruned independently of response rows; deletion and support erasure are explicit exceptions.
if (hasQuota) {
  await db.exec(`insert into public.challenge_response_quota(responder_id, reel_id, last_responded_at)
    values ('${P.f8}', '${R.work1}', now() - interval '24 hours')`);
  const quotaRetention = await one('admin', `select public.admin_challenge_retention() as r`);
  const retentionLeft = (await rows(`select count(*)::int as n from public.challenge_response_quota where responder_id = '${P.f8}'`))[0].n;
  const afterSupportErase = await one('f8', `select public.challenge_respond('${R.work1}', 'accepted') as c`);
  await db.exec(`insert into public.challenge_response_quota(responder_id, reel_id, last_responded_at)
    values ('${erasingAdmin}', '${R.work1}', clock_timestamp())`);
  const quotaProfileDelete = await db.exec(`delete from auth.users where id = '${erasingAdminUid}'`).then(() => 'deleted', e => e.message);
  record('expired quota is pruned by retention; support-erased surviving accounts can respond again; full deletion cascades quota',
    quotaRetention?.r?.response_quota === 1 && retentionLeft === 0 && afterSupportErase?.c?.mine === 'accepted'
      && quotaProfileDelete === 'deleted' && (await rows(`select count(*)::int as n from public.challenge_response_quota where responder_id = '${erasingAdmin}'`))[0].n === 0,
    JSON.stringify({ quotaRetention, retentionLeft, afterSupportErase: afterSupportErase?.c?.mine, quotaProfileDelete }));
} else {
  record('expired quota is pruned by retention; support-erased surviving accounts can respond again; full deletion cascades quota', false, 'durable quota table absent');
}

// ---------------------------------------------------------------- Direct-table denial and policies
const tables = ['challenge_response_quota', 'challenge_responses', 'challenge_nudges', 'challenge_mutes', 'challenge_badges', 'challenge_athlete_settings', 'challenge_sender_holds', 'challenge_admin_events'];
const direct = [];
for (const t of tables) for (const who of ['f1', 'guest', 'admin']) {
  const r = await q(who, `select count(*) from public.${t}`);
  if (!/permission denied/.test(r.error ?? '')) direct.push(`${who} read ${t}`);
}
const insertTry = await q('f1', `insert into public.challenge_responses (reel_id, responder_id, preset) values ('${R.work2}', '${P.f1}', 'did_it')`);
const badgeTry = await q('f1', `insert into public.challenge_badges (profile_id, badge) values ('${P.f1}', 'challenge_finisher')`);
const policies = await rows(`select c.relname, c.relrowsecurity as rls, exists (select 1 from pg_policies p where p.tablename = c.relname and p.policyname = 'Closed accounts' and p.permissive = 'RESTRICTIVE') as closed
  from pg_class c where c.relname = any(array[${tables.map((t) => `'${t}'`).join(', ')}])`);
const unpinned = await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef
  and (p.proname like '%challenge%') and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
const internal = await q('f1', `select public.challenge_reel_check('${R.work1}')`);
record('no client (fan, guest, even an admin) reads or writes the tables directly; RLS + "Closed accounts" on all; helpers are server-only; search_path pinned',
  direct.length === 0 && /permission denied/.test(insertTry.error ?? '') && /permission denied/.test(badgeTry.error ?? '')
    && policies.length === tables.length && policies.every((p) => p.rls && p.closed) && unpinned.length === 0 && /permission denied/.test(internal.error ?? ''),
  JSON.stringify({ direct, insertTry, badgeTry, policies, unpinned, internal }));

// ---------------------------------------------------------------- Re-apply
const counted = (await rows(`select count(*)::int as n from public.challenge_responses`))[0].n;
let reapply = 'ran';
try { await db.exec(migration); } catch (e) { reapply = e.message; }
const afterReapply = await one('admin', `select public.admin_challenge_status() as s`);
record('the migration re-applies over itself and keeps the switch and the data', reapply === 'ran' && afterReapply?.s?.live === true
  && (await rows(`select count(*)::int as n from public.challenge_responses`))[0].n === counted, JSON.stringify({ reapply, live: afterReapply?.s?.live }));
const legacySignatures = ["public.challenge_respond(uuid, text)", "public.challenge_counts(uuid)", "public.challenge_invite(uuid, uuid)", "public.challenge_mute(uuid, boolean)", "public.challenge_inbox(integer)", "public.challenge_my_status()", "public.set_allow_challenges(boolean)", "public.challenge_export_my_data()", "public.admin_challenge_status()", "public.admin_set_challenges_enabled(boolean, text)", "public.admin_challenge_post_counts(integer)", "public.admin_challenge_nudge_senders(integer)", "public.admin_hold_challenge_sender(uuid, text, text)", "public.admin_challenge_retention()", "public.admin_challenge_erase(uuid, text)", "public.challenge_admin_profile()"];
const survivingLegacy = [];
for (const signature of legacySignatures) if ((await rows(`select to_regprocedure('${signature}') is not null as yes`))[0].yes) survivingLegacy.push(signature);
record('reapply removes every legacy public challenge overload and the unbound admin helper', survivingLegacy.length === 0, JSON.stringify(survivingLegacy));
const off = await one('admin', `select public.admin_set_challenges_enabled(false, 'Pause for review') as s`);
const offInbox = await q('f1', `select count(*)::int as n from public.challenge_inbox()`);
const offRespond = await q('f1', `select public.challenge_respond('${R.work1}', 'accepted')`);
record('switching off stops responses and empties Activity without deleting anything', off?.s?.live === false && offInbox[0]?.n === 0 && /not switched on/.test(offRespond.error ?? ''),
  JSON.stringify({ off: off?.s?.live, offInbox, offRespond }));

// A JWT retaining admin metadata must not retain desk access after closure.
await one('admin', `select public.set_my_birth_month(${Y - 10}, 1)`);
const adminCalls = [
  `select public.admin_challenge_status()`, `select public.admin_set_challenges_enabled(true, 'Closed actor attempt')`,
  `select * from public.admin_challenge_post_counts(50)`, `select * from public.admin_challenge_nudge_senders(7)`,
  `select public.admin_hold_challenge_sender('${P.f1}', 'mute', 'Closed actor attempt')`,
  `select public.admin_challenge_retention()`, `select public.admin_challenge_erase('${P.f1}', 'Closed actor attempt')`,
];
const closedAdminResults = [];
const adminStateBefore = hasQuota ? await rows(`select (select count(*)::int from public.challenge_admin_events) as events,
  (select count(*)::int from public.challenge_responses) as responses, (select count(*)::int from public.challenge_response_quota) as quota,
  (select count(*)::int from public.challenge_sender_holds) as holds`) : [];
for (const sql of adminCalls) closedAdminResults.push(await q('admin', sql));
const actuallyClosed = (await rows(`select age_blocked_at is not null as closed from public.profiles where id = '${P.admin}'`))[0].closed;
record('all seven challenge admin definers reject a closed account despite its retained admin role',
  actuallyClosed && closedAdminResults.every(r => /Admin access required/.test(r.error ?? ''))
    && JSON.stringify(adminStateBefore) === JSON.stringify(await rows(`select (select count(*)::int from public.challenge_admin_events) as events,
      (select count(*)::int from public.challenge_responses) as responses, (select count(*)::int from public.challenge_response_quota) as quota,
      (select count(*)::int from public.challenge_sender_holds) as holds`)), JSON.stringify({ actuallyClosed, closedAdminResults }));
const adminAuditBefore = await rows(`select id, action, reason, detail, created_at from public.challenge_admin_events where admin_id = '${P.admin}' order by id`);
const adminDeletion = await db.exec(`delete from auth.users where id = '${U.admin}'`).then(() => 'deleted', e => e.message);
const adminAuditAfter = await rows(`select id, action, reason, detail, created_at from public.challenge_admin_events where id in (${adminAuditBefore.map(r => r.id).join(',')}) order by id`);
record('deleting an audit-referenced admin succeeds, preserves evidence and clears its audit identity',
  adminDeletion === 'deleted' && JSON.stringify(adminAuditBefore) === JSON.stringify(adminAuditAfter)
    && (await rows(`select count(*)::int as n from public.challenge_admin_events where admin_id = '${P.admin}'`))[0].n === 0
    && (await rows(`select count(*)::int as n from public.profiles where id = '${P.admin}'`))[0].n === 0,
  JSON.stringify({ adminDeletion, before: adminAuditBefore.length, after: adminAuditAfter.length }));

for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed on PGlite (Postgres ${(await rows('show server_version'))[0].server_version})`);
process.exit(failed.length ? 1 : 0);
