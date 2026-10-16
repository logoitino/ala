#!/usr/bin/env node
/**
 * Rebuild the whole canonical schema from an empty Postgres and check the security rules that must hold for
 * every table and function (DATA-01, 2026-10-13). Readiness R2 asks for a database that can be rebuilt from
 * the repository; this is the local proof. It uses PGlite (Postgres compiled to WebAssembly) from outside the
 * repo — it is not a dependency — and never touches a hosted database.
 *
 *   node scripts/replay/schema-replay.mjs /tmp/pg/package/dist [apps/mobile/src/backend/db/schema.sql]
 *
 * Supabase's own schemas (auth, storage, realtime), roles and default privileges are stubbed with the pieces schema.sql uses;
 * `auth.role()` behaves like Supabase's: empty when the request carries no JWT claims. Access checks try each
 * call as a guest, a signed-in fan, an admin and a request with no claims.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const [dist, schemaPath = 'apps/mobile/src/backend/db/schema.sql'] = process.argv.slice(2);
if (!dist) { console.error('usage: node scripts/replay/schema-replay.mjs <pglite dist dir> [schema.sql]'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib', 'pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });

const results = [];
const record = (name, pass, detail = '') => results.push({ name, pass, detail });
const rows = async (sql) => (await db.query(sql)).rows;
const schema = fs.readFileSync(schemaPath, 'utf8');

await db.exec(SUPABASE_STUBS);
try { await db.exec(schema); record('schema.sql builds an empty database', true); }
catch (e) {
  // Nothing after this can run on a half-built database: say why and stop.
  console.error(`FAIL  schema.sql builds an empty database — ${e.message}${e.where ? ` (${e.where.split('\n')[0]})` : ''}`);
  process.exit(1);
}
try { await db.exec(schema); record('schema.sql re-applies over itself (idempotent)', true); }
catch (e) { record('schema.sql re-applies over itself (idempotent)', false, e.message); }

const list = (r) => r.map((x) => Object.values(x)[0]).join(', ');
const none = async (name, sql) => { const r = await rows(sql); record(name, r.length === 0, list(r)); };
await none('every public table has row level security', `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`);
await none('every security definer function pins its search_path', `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') order by 1`);
await none('no admin_* function is executable by a signed-out guest', `select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'execute') order by 1`);

const probe = async (setup) => { try { return (await db.exec(`${setup} select public.is_admin_or_db() as ok;`)).at(-1).rows[0].ok; } catch (e) { return `error: ${e.message}`; } finally { await db.exec('reset role; reset request.jwt.claims;'); } };
// is_admin_or_db is not granted to anon, so probe it the way an admin function does: inside a definer function.
await db.exec(`create function public.__guard_probe() returns boolean language sql security definer set search_path = '' as $$ select public.is_admin_or_db() $$; grant execute on function public.__guard_probe() to anon, authenticated;`);
const inside = async (setup) => { try { return (await db.exec(`${setup} select public.__guard_probe() as ok;`)).at(-1).rows[0].ok; } catch (e) { return `error: ${e.message}`; } finally { await db.exec('reset role; reset request.jwt.claims;'); } };
record('the SQL Editor (no role switch) still counts as the database', (await probe('')) === true);
record('a guest with an anon token is not an admin', (await inside(`set role anon; set request.jwt.claims = '{"role":"anon"}';`)) === false);
const claimless = await inside(`set role anon; set request.jwt.claims = '';`);
record('a guest with NO token claims is not an admin', claimless === false, String(claimless));
const roleless = await inside(`set role authenticated; set request.jwt.claims = '';`);
record('a signed-in fan with no role claim is not an admin', roleless === false, String(roleless));
await db.exec('drop function public.__guard_probe();');
try { await db.exec(`set role anon; set request.jwt.claims = ''; select public.admin_revoke_verification(gen_random_uuid(), 'replay');`); record('a guest with no claims cannot run admin_revoke_verification', false, 'it ran'); }
catch (e) { record('a guest with no claims cannot run admin_revoke_verification', /permission denied|Admins only/.test(e.message), e.message); }
finally { await db.exec('reset role; reset request.jwt.claims;'); }

// Function access hardening (20261013210000): who may call what, checked by trying it.
const ADMIN = '00000000-0000-0000-0000-00000000a001', FAN = '00000000-0000-0000-0000-00000000f001', PLAYER = '00000000-0000-0000-0000-00000000b001';
await db.exec(`insert into auth.users (id) values ('${ADMIN}'), ('${FAN}');
  -- the sign-up trigger creates each profile; make one an admin (as the SQL Editor would)
  update public.profiles set role = 'admin', is_admin = true where user_id = '${ADMIN}';
  update public.profiles set role = 'fan' where user_id = '${FAN}';
  insert into public.players (id, name) values ('${PLAYER}', 'Replay Athlete');`);
const as = { guest: `set role anon; set request.jwt.claims = '{"role":"anon"}';`, fan: `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${FAN}"}';`, admin: `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${ADMIN}"}';`, claimlessFan: `set role authenticated; set request.jwt.claims = '';` };
const attempt = async (who, sql) => { try { await db.exec(`${as[who]} ${sql};`); return 'ran'; } catch (e) { return e.message; } finally { await db.exec('reset role; reset request.jwt.claims;'); } };
const refused = async (name, who, sql, pattern = /permission denied|Admins only|exceeds|not allowed|only/i) => { const r = await attempt(who, sql); record(name, r !== 'ran' && pattern.test(r), r); };
await refused('a guest cannot write a revenue row into the books', 'guest', `select public.record_company_revenue('merch', 'replay-fake', 12345)`, /permission denied/);
await refused('a signed-in fan cannot write a revenue row either', 'fan', `select public.record_company_revenue('merch', 'replay-fake', 12345)`, /permission denied/);
await refused('a guest cannot re-run the revenue sync', 'guest', `select public.sync_company_revenue_logs()`, /permission denied/);
await refused("a guest cannot inflate a clip's donation total", 'guest', `select public.increment_reel_tips(gen_random_uuid(), 500)`, /permission denied/);
await refused('a guest cannot add Aura', 'guest', `select public.add_user_aura('${FAN}', 10)`, /permission denied/);
await refused("a guest cannot inflate an athlete's backer count", 'guest', `select public.increment_backer_count('${PLAYER}')`, /permission denied/);
await refused('a guest cannot change sport settings', 'guest', `select public.upsert_sport_config('{"sport":"Replay"}'::jsonb)`, /permission denied/);
await refused('a signed-in fan cannot change sport settings', 'fan', `select public.upsert_sport_config('{"sport":"Replay"}'::jsonb)`, /Admins only/);
await refused('a signed-in fan cannot delete a sport', 'fan', `select public.delete_sport_config(gen_random_uuid())`, /Admins only/);
await refused('a signed-in fan cannot triage feedback', 'fan', `select public.triage_app_feedback(gen_random_uuid(), 'planned')`, /Admins only/);
const adminSport = await attempt('admin', `select public.upsert_sport_config('{"sport":"Replay Sport"}'::jsonb)`);
record('an admin can still change sport settings', adminSport === 'ran', adminSport);
await refused('the 5,000-point Aura cap holds for a request with no claims', 'claimlessFan', `select public.add_user_aura('${FAN}', 6000)`, /exceeds|permission denied/);
const donation = await attempt('fan', `insert into public.tips (player_id, amount_cents, fan_id) values ('${PLAYER}', 2500, '${FAN}')`);
const logged = (await rows(`select count(*)::int as n from public.company_revenue_logs where source = 'malo'`))[0].n;
record('a real donation still lands in the books after the revokes', donation === 'ran' && logged >= 1, `insert: ${donation}; revenue rows: ${logged}`);

// Caps hold for a request with a user but no role claim (auth.role() NULL), not only for a normal fan.
as.roleless = `set role authenticated; set request.jwt.claims = '{"sub":"${FAN}"}';`;
await refused('the donation amount cap holds for a request with no role claim', 'roleless', `insert into public.tips (player_id, amount_cents, fan_id) values ('${PLAYER}', 250000, '${FAN}')`, /check constraint|cap/i);
await refused('the donation amount cap holds for a normal fan', 'fan', `insert into public.tips (player_id, amount_cents, fan_id) values ('${PLAYER}', 250000, '${FAN}')`, /check constraint|cap/i);

// The Stripe webhook writes as service_role: the cap CHECK runs is_trusted_server as that role, so it needs EXECUTE.
as.server = `set role service_role; set request.jwt.claims = '{"role":"service_role"}';`;
const serverTip = await attempt('server', `insert into public.tips (player_id, amount_cents, fan_id) values ('${PLAYER}', 250000, '${FAN}')`);
record('the server (Stripe webhook) can record a donation above the client cap', serverTip === 'ran', serverTip);
const serverAura = await attempt('server', `select public.add_user_aura('${FAN}', 10)`);
record('the server can still add Aura', serverAura === 'ran', serverAura);

// Payout rows (20261013220000): admins write; a parent reads only their own athlete's and writes nothing.
const PARENT = '00000000-0000-0000-0000-00000000c001', OWN = '00000000-0000-0000-0000-00000000b002';
await db.exec(`insert into auth.users (id) values ('${PARENT}');
  update public.profiles set role = 'parent' where user_id = '${PARENT}';
  insert into public.players (id, name, guardian_id) values ('${OWN}', 'Parent''s Athlete', (select id from public.profiles where user_id = '${PARENT}'));
  insert into public.disbursements (player_id, amount_cents) values ('${PLAYER}', 1000), ('${OWN}', 2000);`);
as.parent = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${PARENT}"}';`;
const seen = await (async () => { try { return (await db.exec(`${as.parent} select player_id::text as p from public.disbursements;`)).at(-1).rows.map((r) => r.p); } catch (e) { return [e.message]; } finally { await db.exec('reset role; reset request.jwt.claims;'); } })();
record("a parent sees only their own athlete's payouts", seen.length === 1 && seen[0] === OWN, JSON.stringify(seen));
const changed = await (async () => { try { return (await db.exec(`${as.parent} update public.disbursements set amount_cents = 1 returning id;`)).at(-1).rows.length; } catch (e) { return e.message; } finally { await db.exec('reset role; reset request.jwt.claims;'); } })();
record('a parent cannot change any payout row (not even their own)', changed === 0, String(changed));
await refused('a parent cannot create a payout row', 'parent', `insert into public.disbursements (player_id, amount_cents) values ('${OWN}', 999999)`, /row-level security|permission denied/);
const adminPaid = await attempt('admin', `update public.disbursements set status = 'paid' where player_id = '${OWN}'`);
record('an admin can still update payouts', adminPaid === 'ran' && (await rows(`select status from public.disbursements where player_id = '${OWN}'`))[0].status === 'paid', adminPaid);
await refused('a paid payout cannot change amount, even for an admin', 'admin', `update public.disbursements set amount_cents = 1 where player_id = '${OWN}'`, /cannot change amount/);
const statusMove = await attempt('admin', `update public.disbursements set status = 'failed' where player_id = '${OWN}'`);
record("a paid payout's status can still move to failed (bank return)", statusMove === 'ran', statusMove);
await refused('a failed payout cannot go back to queued to be edited and paid again', 'admin', `update public.disbursements set status = 'queued' where player_id = '${OWN}'`, /cannot go back/);
await refused('a failed payout cannot change amount either', 'admin', `update public.disbursements set amount_cents = 1 where player_id = '${OWN}'`, /cannot change amount/);

// Avatars bucket (20261013230000): write only in your own folder; legacy flat sponsor logos insert-only.
await db.exec(`insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
  insert into storage.objects (bucket_id, name) values ('avatars', '${ADMIN}/victim.jpg'), ('avatars', 'sponsors/legacy-old.png');`);
const ownAvatar = await attempt('fan', `insert into storage.objects (bucket_id, name) values ('avatars', '${FAN}/me.jpg')`);
record('a user can upload a profile photo into their own folder', ownAvatar === 'ran', ownAvatar);
await refused("a user cannot upload into another user's photo folder", 'fan', `insert into storage.objects (bucket_id, name) values ('avatars', '${ADMIN}/x.jpg')`, /row-level security/);
const overwrite = await (async () => { try { return (await db.exec(`${as.fan} update storage.objects set metadata = '{"x":1}' where name in ('${ADMIN}/victim.jpg', 'sponsors/legacy-old.png') returning id;`)).at(-1).rows.length; } catch (e) { return e.message; } finally { await db.exec('reset role; reset request.jwt.claims;'); } })();
record("a user cannot overwrite another user's photo or a shared sponsor logo", overwrite === 0, String(overwrite));
const legacyLogo = await attempt('fan', `insert into storage.objects (bucket_id, name) values ('avatars', 'sponsors/legacy-new.png')`);
const ownLogo = await attempt('fan', `insert into storage.objects (bucket_id, name) values ('avatars', 'sponsors/${FAN}/logo.png')`);
record('booster logos upload from old builds (flat) and new builds (own folder)', legacyLogo === 'ran' && ownLogo === 'ran', `${legacyLogo} / ${ownLogo}`);
const deletes = await (async () => { try { return (await db.exec(`${as.fan} delete from storage.objects where name in ('${FAN}/me.jpg', '${ADMIN}/victim.jpg') returning name;`)).at(-1).rows.map((r) => r.name); } catch (e) { return [e.message]; } finally { await db.exec('reset role; reset request.jwt.claims;'); } })();
record("a user can delete their own photo but not another user's", deletes.length === 1 && deletes[0] === `${FAN}/me.jpg`, JSON.stringify(deletes));

// Family share (20261013231000): what the family account receives, from the books.
const gift = await attempt('fan', `insert into public.tips (player_id, amount_cents, fan_id) values ('${OWN}', 5000, '${FAN}')`);
const [books] = await rows(`select r.payout_cents from public.company_revenue_logs r join public.tips t on r.source = 'malo' and r.source_id = t.id::text where t.player_id = '${OWN}' and t.amount_cents = 5000`);
const parentView = async () => { try { const out = await db.exec(`${as.parent} select (select family_cents from public.get_received_malo('${OWN}') where amount_cents = 5000) as row_family, (public.get_custodial_summary('${OWN}')->>'family_cents')::int as summary_family, (public.get_custodial_summary('${OWN}')->>'received_cents')::int as summary_donated;`); return out.at(-1).rows[0]; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role; reset request.jwt.claims;'); } };
const seen1 = await parentView();
record("the family sees what reaches their account (the books' payout), not the donated total", gift === 'ran' && books?.payout_cents > 0 && books.payout_cents < 5000 && seen1.row_family === books.payout_cents && seen1.summary_family === books.payout_cents && seen1.summary_donated === 5000, JSON.stringify({ gift, books, seen1 }));
await db.exec(`delete from public.company_revenue_logs where source = 'malo' and source_id in (select id::text from public.tips where player_id = '${OWN}')`);
const seen2 = await parentView();
record('with no books entry yet, the family share falls back to the current split', seen2.row_family === books?.payout_cents, JSON.stringify(seen2));
const strangerRows = await (async () => { try { return (await db.exec(`${as.fan} select count(*)::int as n from public.get_received_malo('${OWN}');`)).at(-1).rows[0].n; } catch (e) { return e.message; } finally { await db.exec('reset role; reset request.jwt.claims;'); } })();
record("a stranger sees none of another athlete's donations", strangerRows === 0, String(strangerRows));

// Profile privacy (20261014090000, PRIV-01 stage 1).
const STR = '00000000-0000-0000-0000-00000000d001', FRI = '00000000-0000-0000-0000-00000000e001', ATH = '00000000-0000-0000-0000-00000000a002';
const ATH_PLAYER = '00000000-0000-0000-0000-00000000b003';
await db.exec(`insert into auth.users (id) values ('${STR}'), ('${FRI}'), ('${ATH}');
  insert into public.players (id, name, guardian_id) values ('${ATH_PLAYER}', 'Private Athlete', (select id from public.profiles where user_id = '${PARENT}'));
  update public.profiles set username = 'strangerguy', full_name = 'Stranger Person' where user_id = '${STR}';
  update public.profiles set username = 'bestfriend', full_name = 'Best Friend' where user_id = '${FRI}';
  update public.profiles set username = 'privateathlete', full_name = 'Kaleo Private', player_id = '${ATH_PLAYER}', role = 'athlete', verification_status = 'verified',
    bio = 'secret bio', social_links = '{"instagram":"kaleo"}'::jsonb, avatar_url = 'https://x/a.jpg', hide_from_search = true where user_id = '${ATH}';`);
// MINOR-01: these fixture accounts are adults (a new account with no age takes no friend requests).
await db.exec(`update public.profiles set birth_year = 1990, birth_month = 1, friend_requests_from = 'everyone' where user_id in ('${STR}', '${FRI}', '${ATH}', '${PARENT}', '${FAN}');`);
const pid = async (uid) => (await rows(`select id from public.profiles where user_id = '${uid}'`))[0].id;
const P_ATH = await pid(ATH), P_STR = await pid(STR), P_FRI = await pid(FRI);
as.str = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${STR}"}';`;
as.fri = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${FRI}"}';`;
as.ath = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${ATH}"}';`;
const q = async (who, sql) => { try { return (await db.exec(`${as[who]} ${sql};`)).at(-1).rows; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role; reset request.jwt.claims;'); } };
const [fresh] = await rows(`select account_private, profile_audience->>'social_links' as social from public.profiles where user_id = '${STR}'`);
record('a new account starts private, with social links only visible to the owner', fresh.account_private === true && fresh.social === 'only_me', JSON.stringify(fresh));
const direct = await q('str', `select count(*)::int as n from public.profiles where user_id <> '${STR}'`);
const own = await q('str', `select count(*)::int as n from public.profiles where user_id = '${STR}'`);
record("nobody reads other people's profiles rows directly; their own row still reads", direct[0]?.n === 0 && own[0]?.n === 1, JSON.stringify({ direct, own }));
const adminAll = await q('admin', `select count(*)::int as n from public.profiles`);
record('an admin still reads every profile', adminAll[0]?.n >= 6, JSON.stringify(adminAll));
const strView = await q('str', `select full_name, avatar_url, bio, social_links::text as social, aura_points, viewer_relation from public.get_public_profiles(array['${P_ATH}']::uuid[])`);
record('a stranger sees a private athlete\'s name but not photo, bio, links or Aura', strView[0]?.full_name === 'Kaleo Private' && strView[0]?.avatar_url === null && strView[0]?.bio === null && strView[0]?.social === '{}' && strView[0]?.aura_points === null && strView[0]?.viewer_relation === 'stranger', JSON.stringify(strView));
const guestView = await q('guest', `select bio, viewer_relation from public.get_public_profiles(array['${P_ATH}']::uuid[])`);
record('a guest sees no private details', guestView[0]?.bio === null && guestView[0]?.viewer_relation === 'guest', JSON.stringify(guestView));
const nameRule = await q('str', `select full_name from public.get_public_profiles(array['${P_FRI}']::uuid[])`);
record('a fan account shows strangers a username, not the full name', nameRule[0]?.full_name === 'bestfriend', JSON.stringify(nameRule));
const req = await q('fri', `select public.request_friend('${P_ATH}') as r`);
const incoming = await q('ath', `select request_id, status from public.list_my_friends()`);
const accepted = await q('ath', `select public.respond_friend('${incoming[0]?.request_id}', true) as r`);
const friendView = await q('fri', `select bio, avatar_url, social_links::text as social, viewer_relation from public.get_public_profiles(array['${P_ATH}']::uuid[])`);
record('friends: request, accept, then the friend sees bio and photo but not only-me links', req[0]?.r === 'requested' && incoming[0]?.status === 'incoming' && accepted[0]?.r === 'friends' && friendView[0]?.bio === 'secret bio' && friendView[0]?.avatar_url === 'https://x/a.jpg' && friendView[0]?.social === '{}' && friendView[0]?.viewer_relation === 'friend', JSON.stringify({ req, incoming, accepted, friendView }));
const g = await q('parent', `select bio from public.get_public_profiles(array['${P_ATH}']::uuid[])`);
record("the athlete's guardian sees everything on the profile", g[0]?.bio === 'secret bio', JSON.stringify(g));
const directWrite = await q('ath', `update public.profiles set account_private = false where user_id = '${ATH}'`);
record('privacy settings cannot be changed by writing the row directly', /Profile → Privacy/.test(directWrite.error ?? ''), JSON.stringify(directWrite));
const lockGone = await rows(`select count(*)::int as n from pg_proc where proname in ('guardian_set_privacy', 'guardian_get_privacy', 'privacy_lock_active', 'admin_release_privacy_lock')`);
record('no guardian lock: a guardian cannot rewrite the athlete\'s settings (replaced by supervision, MINOR-01)', lockGone[0].n === 0, JSON.stringify(lockGone));
const legacyOff = await q('ath', `update public.profiles set profile_visibility = '{"bio": true, "school": false, "stats": true, "social_links": true}'::jsonb where user_id = '${ATH}' returning profile_audience->>'school' as school`);
const legacyOn = await q('ath', `update public.profiles set profile_visibility = '{"bio": true, "school": true, "stats": true, "social_links": true}'::jsonb where user_id = '${ATH}' returning profile_audience->>'school' as school`);
record('older app builds: hiding an item maps to only me, re-showing it maps to friends (fail closed)', legacyOff[0]?.school === 'only_me' && legacyOn[0]?.school === 'friends', JSON.stringify({ legacyOff, legacyOn }));
const searchStr = await q('str', `select count(*)::int as n from public.search_local_entities('Private Athlete', 'athlete')`);
const searchFri = await q('fri', `select count(*)::int as n from public.search_local_entities('Private Athlete', 'athlete')`);
record('hide from search: strangers do not find the athlete, friends do', searchStr[0]?.n === 0 && searchFri[0]?.n === 1, JSON.stringify({ searchStr, searchFri }));
const tagSearch = await q('fri', `select count(*)::int as n from public.search_taggable_accounts('st')`);
record('account search needs at least 3 characters', tagSearch[0]?.n === 0, JSON.stringify(tagSearch));
await q('str', `select public.request_friend('${P_ATH}')`);
await q('ath', `select public.block_user('${P_STR}')`);
const blockedView = await q('str', `select viewer_relation, bio from public.get_public_profiles(array['${P_ATH}']::uuid[])`);
const blockedReq = await q('str', `select public.request_friend('${P_ATH}')`);
const blockedCrew = await q('str', `insert into public.crew_follows (follower_id, athlete_id) values ('${STR}', '${ATH_PLAYER}')`);
const leftover = await rows(`select count(*)::int as n from public.friendships where '${P_STR}' in (requester_id, addressee_id)`);
record('a block: the blocked person sees a guest\'s view (not told), cannot request or join the Crew, and the request is gone', blockedView[0]?.viewer_relation === 'guest' && blockedView[0]?.bio === null && Boolean(blockedReq.error) && /row-level security/.test(blockedCrew.error ?? '') && leftover[0].n === 0, JSON.stringify({ blockedView, blockedReq, blockedCrew, leftover }));
const blockerView = await q('ath', `select viewer_relation from public.get_public_profiles(array['${P_STR}']::uuid[])`);
record('the blocker sees "blocked" (so the app can offer Unblock)', blockerView[0]?.viewer_relation === 'blocked', JSON.stringify(blockerView));
const directory = await q('guest', `select count(*)::int as n from public.profiles_public where username ilike 'priv%'`);
record('no directory: the public view cannot be searched directly (hide-from-search holds)', /permission denied/.test(directory.error ?? ''), JSON.stringify(directory));
const graph = await q('guest', `select public.are_friends('${P_ATH}', '${P_FRI}')`);
record('nobody can ask who is friends or who blocked whom', /permission denied/.test(graph.error ?? ''), JSON.stringify({ graph }));
const wild = await q('fri', `select count(*)::int as n from public.search_taggable_accounts('___')`);
await db.exec(`update public.profiles set username = 'joe_s', hide_from_search = false where user_id = '${FRI}'`);
const under = await q('ath', `select count(*)::int as n from public.search_taggable_accounts('joe_s')`);
record('tag search: wildcards are escaped, usernames with underscores are findable', wild[0]?.n === 0 && under[0]?.n === 1, JSON.stringify({ wild, under }));
const spam = await (async () => { let last; for (let i = 0; i < 5; i++) { await q('fri', `select public.request_friend('${P_STR}')`); last = await q('fri', `select public.remove_friend('${P_STR}')`); } return (await rows(`select count(*)::int as n from public.friend_request_log where requester_id = '${P_FRI}' and addressee_id = '${P_STR}'`))[0].n; })();
record('request-cancel-request cannot dodge the limits (3 per person per week)', spam === 3, String(spam));
await db.exec(`insert into public.schools_and_teams (id, name) values ('00000000-0000-0000-0000-0000000005c1', 'Replay High') on conflict do nothing;
  update public.profiles set school_id = '00000000-0000-0000-0000-0000000005c1' where user_id = '${ATH}';
  insert into public.reels (id, title, video_url, player_id, uploaded_by) values ('00000000-0000-0000-0000-0000000007e1', 'Replay clip', 'https://x/v.mp4', '${ATH_PLAYER}', '${P_ATH}');`).catch((e) => record('privacy fixtures (school, clip)', false, e.message));
const badge = await q('str', `select school_confirmed, school_id from public.get_public_profiles(null, array['${ATH_PLAYER}']::uuid[])`);
record('the school-confirmed badge shows even when the school itself is hidden', badge[0]?.school_confirmed === true && badge[0]?.school_id === null, JSON.stringify(badge));
const feedStr = await q('str', `select uploader_avatar_url from public.reels_feed where id = '00000000-0000-0000-0000-0000000007e1'`);
const feedFri = await q('fri', `select uploader_avatar_url from public.reels_feed where id = '00000000-0000-0000-0000-0000000007e1'`);
record("the highlights feed shows the uploader's photo only to people their photo audience allows", Array.isArray(feedStr) && feedStr.length === 1 && feedStr[0].uploader_avatar_url === null && feedFri[0]?.uploader_avatar_url === 'https://x/a.jpg', JSON.stringify({ feedStr, feedFri }));
await db.exec(`insert into public.crew_follows (follower_id, athlete_id) values ('${FRI}', '${ATH_PLAYER}')`);
const crewRows = await q('str', `select count(*)::int as n from public.crew_follows where athlete_id = '${ATH_PLAYER}'`);
const crewGuest = await q('guest', `select (public.get_crew_graph('${ATH_PLAYER}')->>'crew_count')::int as n`);
record("Crew lists are private to the follower and the athlete; counts still show to guests", crewRows[0]?.n === 0 && crewGuest[0]?.n === 1, JSON.stringify({ crewRows, crewGuest }));
await db.exec(`update public.app_runtime_config set published = coalesce(published, '{}'::jsonb) || '{"features": {"privacy.friends": false}}'::jsonb where id = 'default'`);
const paused = await q('fri', `select public.request_friend('${P_STR}')`);
await db.exec(`update public.app_runtime_config set published = published - 'features' where id = 'default'`);
record('the owner can pause friend requests with the privacy.friends switch', /paused/.test(paused.error ?? ''), JSON.stringify(paused));
const notAdmin = await q('fri', `select public.admin_get_privacy('${P_ATH}')`);
const adminView = await q('admin', `select (public.admin_get_privacy('${P_ATH}')->>'blocks_made')::int as b, (public.admin_privacy_report()->>'private_accounts')::int as p`);
record('admin: reads counts (never who) and the report; non-admins are refused', Boolean(notAdmin.error) && adminView[0]?.b === 1 && adminView[0]?.p >= 1, JSON.stringify({ notAdmin, adminView }));

// Tag approval (20261014100000, PRIV-01 stage 2).
const TAGGER = '00000000-0000-0000-0000-00000000f101';
await db.exec(`insert into auth.users (id) values ('${TAGGER}'); update public.profiles set username = 'tagger' where user_id = '${TAGGER}';`);
as.tagger = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${TAGGER}"}';`;
const P_TAG = await pid(TAGGER);
const clip = async (who, id) => q(who, `insert into public.reels (id, title, video_url, player_id) values ('${id}', 'Tag test', 'https://x/t.mp4', '${ATH_PLAYER}') returning tag_status`);
const C1 = '00000000-0000-0000-0000-0000000007a1';
const made = await clip('tagger', C1);
const feedStranger = await q('str', `select player_id from public.reels_feed where id = '${C1}'`);
const feedUploader = await q('tagger', `select player_id from public.reels_feed where id = '${C1}'`);
const feedAthlete = await q('ath', `select player_id from public.reels_feed where id = '${C1}'`);
record("a pending tag names the athlete only to the uploader and the athlete, not to strangers", made[0]?.tag_status === 'pending' && feedStranger[0]?.player_id === null && feedUploader[0]?.player_id === ATH_PLAYER && feedAthlete[0]?.player_id === ATH_PLAYER, JSON.stringify({ made, feedStranger, feedUploader, feedAthlete }));
const reject = await q('ath', `select public.confirm_reel_player_tag('${C1}', 'reject')->>'tag_status' as s`);
const after = await rows(`select player_id, tag_status from public.reels where id = '${C1}'`);
const retag = await q('tagger', `update public.reels set player_id = '${ATH_PLAYER}' where id = '${C1}'`);
const again = await q('ath', `select public.confirm_reel_player_tag('${C1}', 'confirm')`);
record('a rejection untags the clip, is remembered, and cannot be re-tagged or re-reviewed', reject[0]?.s === 'rejected' && after[0].player_id === null && after[0].tag_status === 'rejected' && /declined|permission denied/.test(retag.error ?? '') && Boolean(again.error), JSON.stringify({ reject, after, retag, again }));
const C2 = '00000000-0000-0000-0000-0000000007a2';
const blockedTag = await clip('str', C2);
record("a tag from someone the athlete blocked is rejected quietly", blockedTag[0]?.tag_status === 'rejected', JSON.stringify(blockedTag));
await q('ath', `select public.set_my_privacy('{"tag_review": "auto_friends"}'::jsonb)`);
const C3 = '00000000-0000-0000-0000-0000000007a3';
const friendTag = await clip('fri', C3);
record('"auto-approve tags from friends" approves a friend\'s tag at once', friendTag[0]?.tag_status === 'confirmed', JSON.stringify(friendTag));
const caps = [];
for (let i = 0; i < 6; i++) caps.push(await clip('tagger', `00000000-0000-0000-0000-0000000008b${i}`));
record('one uploader can have at most five tags of an athlete waiting', caps.slice(0, 5).every((r) => r[0]?.tag_status === 'pending') && /Wait for this athlete/.test(caps[5].error ?? ''), JSON.stringify(caps.map((r) => r.error ?? r[0]?.tag_status)));
for (const i of [0, 1]) await q('ath', `select public.confirm_reel_player_tag('00000000-0000-0000-0000-0000000008b${i}', 'reject')`);
const barred = await clip('tagger', '00000000-0000-0000-0000-0000000008c1');
record('after three declines, that uploader cannot tag the athlete at all', /can't tag this athlete/.test(barred.error ?? ''), JSON.stringify(barred));
// Credit: a reaction 10 days ago on a clip approved today counts in today's window.
const C4 = '00000000-0000-0000-0000-0000000008b2';
await db.exec(`update public.reels set created_at = now() - interval '10 days' where id = '${C4}';
  insert into public.reel_hype_votes (user_id, reel_id, kind, created_at) values ('${STR}', '${C4}', 'seki', now() - interval '10 days');`);
await q('ath', `select public.confirm_reel_player_tag('${C4}', 'confirm')`);
const board = await q('fri', `select public.get_leaderboards('week') as b`);
const hypeRow = (board[0]?.b?.players_hype ?? []).find((r) => r.player_id === ATH_PLAYER || r.name === 'Private Athlete');
record('reactions from before approval count in the week the tag was approved', Boolean(hypeRow) && (hypeRow.hype ?? hypeRow.value ?? 0) >= 1, JSON.stringify(board[0]?.b?.players_hype ?? board));
// Stage 2 re-review (RLS_SECURITY 2026-10-14).
const P8B3 = '00000000-0000-0000-0000-0000000008b3';
const selfApprove = await q('tagger', `update public.reels set tag_status = 'confirmed' where id = '${P8B3}'`);
const counter = await q('tagger', `update public.reels set seki_count = 99 where id = '${P8B3}'`);
record('an uploader cannot approve their own tag or set counters by writing the row', /permission denied/.test(selfApprove.error ?? '') && /permission denied/.test(counter.error ?? ''), JSON.stringify({ selfApprove, counter }));
const declinedOwn = await q('tagger', `select tag_status, tag_confirmed_by, tag_confirmed_at, player_id from public.reels where id = '${C1}'`);
const quietOwnBase = await q('str', `select tag_status, tag_confirmed_by, player_id from public.reels where id = '${C2}'`);
const quietOwnFeed = await q('str', `select tag_status, player_id from public.reels_feed where id = '${C2}'`);
const declinedFeed = await q('tagger', `select tag_status, player_id from public.reels_feed where id = '${C1}'`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
record("a decline never names who declined, and a block's quiet decline looks the same (own row and feed)", declinedOwn[0]?.tag_confirmed_by === null && declinedOwn[0]?.tag_confirmed_at === null && declinedOwn[0]?.player_id === null && same(quietOwnBase[0], { tag_status: 'rejected', tag_confirmed_by: null, player_id: null }) && same(quietOwnFeed[0], declinedFeed[0]), JSON.stringify({ declinedOwn, quietOwnBase, quietOwnFeed, declinedFeed }));
const removeApproved = await q('ath', `select public.confirm_reel_player_tag('${C3}', 'reject')->>'tag_status' as s`);
record('the athlete can remove an auto-approved tag', removeApproved[0]?.s === 'rejected', JSON.stringify(removeApproved));
const undo = await q('admin', `select public.confirm_reel_player_tag('${C1}', 'confirm')->>'player_id' as p`);
record('an admin can undo a rejection (the athlete comes back from the rejection record)', undo[0]?.p === ATH_PLAYER, JSON.stringify(undo));
const pendingBefore = await rows(`select count(*)::int as n from public.reels where uploaded_by = '${P_TAG}' and tag_status = 'pending'`);
const blockWithPending = await q('ath', `select public.block_user('${P_TAG}')`);
const pendingAfter = await rows(`select count(*)::int as n from public.reels where uploaded_by = '${P_TAG}' and tag_status = 'pending'`);
record('blocking someone who has pending tags of you works, and their tags end like a decline', pendingBefore[0].n > 0 && !blockWithPending.error && pendingAfter[0].n === 0, JSON.stringify({ pendingBefore, blockWithPending, pendingAfter }));
const blockUndo = await q('admin', `select public.confirm_reel_player_tag('${P8B3}', 'confirm')->>'player_id' as p`);
record("an admin can undo a block's automatic decline", blockUndo[0]?.p === ATH_PLAYER, JSON.stringify(blockUndo));
await q('ath', `select public.unblock_user('${P_TAG}')`);

// Minor accounts (20261014110000, MINOR-01).
const Y = new Date().getUTCFullYear();
const TEEN = '00000000-0000-0000-0000-00000000c101', TEEN16 = '00000000-0000-0000-0000-00000000c102', GUARD = '00000000-0000-0000-0000-00000000c103';
const KID = '00000000-0000-0000-0000-00000000c104', NEWBIE = '00000000-0000-0000-0000-00000000c105', OTHER = '00000000-0000-0000-0000-00000000c106';
await db.exec(`insert into auth.users (id, raw_user_meta_data) values
  ('${TEEN}', '{"birth_year": "${Y - 14}", "birth_month": "1"}'), ('${TEEN16}', '{"birth_year": "${Y - 16}", "birth_month": "1"}'),
  ('${GUARD}', '{"birth_year": "1985", "birth_month": "6"}'), ('${NEWBIE}', '{}'), ('${OTHER}', '{"birth_year": "1990", "birth_month": "2"}');
  update public.profiles set username = 'teenlani', full_name = 'Lani Teen', bio = 'teen bio' where user_id = '${TEEN}';
  update public.profiles set username = 'teensixteen', full_name = 'Sefa Sixteen' where user_id = '${TEEN16}';
  update public.profiles set username = 'guardmele', full_name = 'Mele Guardian' where user_id = '${GUARD}';
  update public.profiles set username = 'newbieone' where user_id = '${NEWBIE}';
  update public.profiles set username = 'otheradult' where user_id = '${OTHER}';`);
for (const [k, v] of Object.entries({ teen: TEEN, teen16: TEEN16, guard: GUARD, newbie: NEWBIE, other: OTHER })) as[k] = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${v}"}';`;
const P_TEEN = await pid(TEEN), P_TEEN16 = await pid(TEEN16), P_GUARD = await pid(GUARD);
const kidSignup = await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${KID}', '{"birth_year": "${Y - 10}", "birth_month": "1"}')`).then(() => 'created', (e) => e.message);
const ages = await rows(`select username, account_private, friend_requests_from as fr, public.profile_age_band(id) as band from public.profiles where user_id in ('${TEEN}', '${NEWBIE}', '${OTHER}') order by username`);
const byName = Object.fromEntries(ages.map((r) => [r.username, r]));
record('sign-up: under-13 is refused; a teen starts private with requests only from teens; a new account with no age takes none', /can't create/.test(kidSignup) && byName.teenlani?.band === 'teen_13_15' && byName.teenlani?.account_private === true && byName.teenlani?.fr === 'teens' && byName.newbieone?.band === 'not_given' && byName.newbieone?.fr === 'nobody' && byName.otheradult?.fr === 'everyone', JSON.stringify({ kidSignup, ages }));
const adultReq = await q('other', `select public.request_friend('${P_TEEN}')`);
const newbieReq = await q('newbie', `select public.request_friend('${P_TEEN}')`);
const teenReq = await q('teen16', `select public.request_friend('${P_TEEN}') as r`);
record('"only other teens": adults and accounts with no age are refused with the ordinary message; another teen can ask', /can't send a friend request to this account/.test(adultReq.error ?? '') && /can't send/.test(newbieReq.error ?? '') && teenReq[0]?.r === 'requested', JSON.stringify({ adultReq, newbieReq, teenReq }));
const birthWrite = await q('teen', `update public.profiles set birth_year = 1990 where user_id = '${TEEN}'`);
const older = await q('teen', `select public.set_my_birth_month(1990, 1)`);
record('a teen cannot make themselves older (direct write or the form); support corrects that', /from Profile/.test(birthWrite.error ?? '') && /contact support/.test(older.error ?? ''), JSON.stringify({ birthWrite, older }));
const soloPublic = await q('teen', `select public.set_my_privacy('{"account_private": false}'::jsonb)`);
const soloOpen = await q('teen', `select public.set_my_privacy('{"friend_requests_from": "everyone"}'::jsonb)`);
const sixteenOpen = await q('teen16', `select public.set_my_privacy('{"friend_requests_from": "everyone"}'::jsonb)->>'friend_requests_from' as fr`);
const sixteenPublic = await q('teen16', `select public.set_my_privacy('{"account_private": false}'::jsonb)`);
record('solo teens: public needs a guardian consent; under-16s need a guardian for open requests; 16-17 open requests themselves', /needs to sign the consent/.test(soloPublic.error ?? '') && /Invite a parent or guardian/.test(soloOpen.error ?? '') && sixteenOpen[0]?.fr === 'everyone' && /needs to sign the consent/.test(sixteenPublic.error ?? ''), JSON.stringify({ soloPublic, soloOpen, sixteenOpen, sixteenPublic }));
const inv = await q('teen', `select public.create_guardian_invite()->>'code' as c`);
const CODE = inv[0]?.c;
const guess = await q('other', `select public.preview_guardian_invite('AAAAAAAA')->>'status' as s`);
const tries = await rows(`select count(*)::int as n from public.guardian_invite_attempts where profile_id = (select id from public.profiles where user_id = '${OTHER}')`);
const kidGuard = await q('teen16', `select public.preview_guardian_invite('${CODE}')`);
const preview = await q('guard', `select public.preview_guardian_invite('${CODE}') as p`);
record('guardian codes: 8 characters, a wrong guess is counted, a teen cannot be a guardian, the adult sees the first name only', /^[A-HJ-NP-Z2-9]{8}$/.test(CODE ?? '') && guess[0]?.s === 'bad_code' && tries[0].n === 1 && /18 or older/.test(kidGuard.error ?? '') && preview[0]?.p?.status === 'ok' && preview[0]?.p?.first_name === 'Lani' && preview[0]?.p?.can_allow_donations === false, JSON.stringify({ CODE, guess, tries, kidGuard, preview }));
const sign = (who, fn, extra = '') => q(who, `select public.${fn}(${extra}'Mele Guardian', 'parent', false, true, public.guardian_consent_form_version(), public.guardian_consent_form_sha256()) as r`);
const badHash = await q('guard', `select public.accept_guardian_invite('${CODE}', 'Mele Guardian', 'parent', false, true, public.guardian_consent_form_version(), '${'0'.repeat(64)}')`);
const accepted2 = await sign('guard', 'accept_guardian_invite', `'${CODE}', `);
const beforeConfirm = await q('teen', `select (public.get_my_privacy()->'minor'->>'has_public_consent')::boolean as c, public.get_my_privacy()->'minor'->'pending_links'->0->>'link_id' as link`);
const earlyLook = await q('guard', `select public.guardian_get_supervision('${P_TEEN}')`);
record('the guardian signs (exact form text only); nothing counts until the teen confirms the link', /form has changed/.test(badHash.error ?? '') && accepted2[0]?.r?.status === 'waiting_for_teen' && beforeConfirm[0]?.c === false && Boolean(beforeConfirm[0]?.link) && /linked guardian/.test(earlyLook.error ?? ''), JSON.stringify({ badHash, accepted2, beforeConfirm, earlyLook }));
const LINK = beforeConfirm[0]?.link;
const confirmed = await q('teen', `select (public.respond_guardian_link('${LINK}', true)->>'has_public_consent')::boolean as c`);
const guardView = await q('guard', `select viewer_relation, bio from public.get_public_profiles(array['${P_TEEN}']::uuid[])`);
record("after the teen confirms, the consent counts; a code-linked guardian still sees only what a stranger sees on the profile", confirmed[0]?.c === true && guardView[0]?.viewer_relation === 'stranger' && guardView[0]?.bio === null, JSON.stringify({ confirmed, guardView }));
const ask = await q('teen', `select public.set_my_privacy('{"account_private": false}'::jsonb) as s`);
const sup = await q('guard', `select public.guardian_get_supervision('${P_TEEN}') as s`);
const REQ = sup[0]?.s?.status?.pending_approvals?.[0]?.id;
const teenSup = await q('teen', `select public.get_my_supervision() as s`);
const decide = await q('guard', `select public.guardian_decide_approval('${REQ}', true)->'settings'->>'account_private' as p`);
record('under-16 going public: held for the guardian, who sees the same summary (counts, events since linking) and approves', ask[0]?.s?.held_for_approval?.[0] === 'account_public' && ask[0]?.s?.account_private === true && Boolean(REQ) && sup[0]?.s?.summary?.incoming_requests === 1 && teenSup[0]?.s?.events?.length > sup[0]?.s?.events?.length && decide[0]?.p === 'false', JSON.stringify({ ask: ask[0]?.s?.held_for_approval, REQ, guardEvents: sup[0]?.s?.events?.length, teenEvents: teenSup[0]?.s?.events?.length, decide }));
const notRecord = await q('guard', `select public.sign_guardian_consent('${P_TEEN}', 'Mele Guardian', 'parent', true, true, public.guardian_consent_form_version(), public.guardian_consent_form_sha256())`);
const withdraw = await q('guard', `select public.revoke_guardian_consent('${P_TEEN}')->'settings'->>'account_private' as p`);
record('payouts need the guardian on record; withdrawing consent makes the teen private again', /guardian on record/.test(notRecord.error ?? '') && withdraw[0]?.p === 'true', JSON.stringify({ notRecord, withdraw }));
await q('teen', `select public.block_user('${P_GUARD}')`);
const linksLeft = await rows(`select count(*)::int as n from public.guardian_links where minor_id = '${P_TEEN}' and ended_at is null`);
record('a teen can always cut a guardian off: blocking ends the link', linksLeft[0].n === 0, JSON.stringify(linksLeft));
const kidFix = await q('newbie', `select public.set_my_birth_month(${Y - 10}, 1)->>'status' as s`);
const kidAfter = await q('newbie', `select public.get_my_privacy()`);
const blockedList = await q('admin', `select count(*)::int as n from public.admin_list_age_blocked()`);
record('an under-13 entry blocks the account at once and lists it for deletion', kidFix[0]?.s === 'blocked' && /Sign in/.test(kidAfter.error ?? '') && blockedList[0]?.n === 1, JSON.stringify({ kidFix, kidAfter, blockedList }));
await db.exec(`update public.profiles set is_verified = true, payouts_enabled = true where user_id = '${ATH}'`);
// VERIFY-02: the payees are verified (Stripe identity + TIN; the school confirmed the parent on record), so these MINOR-01
// checks see only the age / consent rules.
await db.exec(`update public.profiles set stripe_connect_id = 'acct_replayath001' where user_id = '${ATH}';
  update public.profiles set stripe_connect_id = 'acct_replayparent01', birth_year = 1980, birth_month = 5 where user_id = '${PARENT}';
  select public.record_stripe_kyc('acct_replayath001', true, true, true);
  select public.record_stripe_kyc('acct_replayparent01', true, true, true);`);
const P_PARENT = await pid(PARENT);
const ADMIN2 = '00000000-0000-0000-0000-00000000a0a2';
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${ADMIN2}', '{"birth_year": "1980", "birth_month": "1"}');
  update public.profiles set role = 'admin', is_admin = true where user_id = '${ADMIN2}';`);
as.admin2 = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${ADMIN2}"}';`;
const schoolCheck = await q('admin', `select public.admin_record_payee_check('${ATH_PLAYER}', '${P_PARENT}', 'school_parent_confirmation', true, 'AD confirmed in person at the school office') as id`);
await q('admin2', `select public.admin_confirm_payee_check('${schoolCheck[0]?.id}')`);
const pay = async () => (await rows(`select public.athlete_payout_status('${ATH_PLAYER}') as s`))[0].s;
const payAdult = await pay();
await q('admin', `select public.admin_set_birth_month('${P_ATH}', ${Y - 15}, 1, 'replay check')`);
const payMinor = await pay();
const recordSign = await q('parent', `select public.sign_guardian_consent('${P_ATH}', 'Pat Parent', 'parent', true, false, public.guardian_consent_form_version(), public.guardian_consent_form_sha256()) as r`);
const payConsent = await pay();
await db.exec(`update public.profiles set birth_year = null, birth_month = null, age_check_required = false where user_id = '${ATH}'`);
const payUnknown = await pay();
record('payouts: an adult is allowed; a minor waits for the donations consent of the guardian on record; an unknown age waits', payAdult.allowed === true && payMinor.reason === 'needs_guardian_consent' && !recordSign.error && payConsent.allowed === true && payUnknown.reason === 'needs_birth_month', JSON.stringify({ payAdult, payMinor, recordSign: recordSign.error, payConsent, payUnknown }));
// SQL review (RLS_SECURITY + MINOR_SAFETY 2026-10-14).
const offTrick = await q('teen16', `select public.set_my_privacy('{"account_private": "off"}'::jsonb)`);
const offAfter = await rows(`select account_private from public.profiles where user_id = '${TEEN16}'`);
record('"off" / "no" / "f" cannot make a teen public without consent', Boolean(offTrick.error) && offAfter[0].account_private === true, JSON.stringify({ offTrick, offAfter }));
const oracleTeen = await q('other', `select public.sign_guardian_consent('${P_TEEN16}', 'X Y', 'parent', false, false, public.guardian_consent_form_version(), public.guardian_consent_form_sha256())`);
const oracleAdult = await q('other', `select public.sign_guardian_consent('${P_GUARD}', 'X Y', 'parent', false, false, public.guardian_consent_form_version(), public.guardian_consent_form_sha256())`);
record('signing for an account you are not linked to reads the same for teens and adults (no way to find teens)', Boolean(oracleTeen.error) && oracleTeen.error === oracleAdult.error, JSON.stringify({ oracleTeen, oracleAdult }));
const inv16 = await q('teen16', `select public.create_guardian_invite()->>'code' as c`);
await q('other', `select public.accept_guardian_invite('${inv16[0]?.c}', 'Other Adult', 'parent', false, false, public.guardian_consent_form_version(), public.guardian_consent_form_sha256())`);
const unconfirmedLook = await q('other', `select public.sign_guardian_consent('${P_TEEN16}', 'Other Adult', 'parent', false, true, public.guardian_consent_form_version(), public.guardian_consent_form_sha256()) as v`);
record('a guardian the teen has not confirmed learns nothing about them (no settings, counts or events)', unconfirmedLook[0]?.v?.link_status === 'waiting_for_teen' && unconfirmedLook[0]?.v?.summary === undefined && unconfirmedLook[0]?.v?.events === undefined, JSON.stringify(unconfirmedLook));
await q('admin', `select public.admin_set_birth_month('${P_ATH}', ${Y - 15}, 1, 'replay check')`);
const recordLink = (await rows(`select id from public.guardian_links where minor_id = '${P_ATH}' and ended_at is null and confirmed_at is not null`))[0]?.id;
await q('ath', `select public.end_guardian_link('${recordLink}')`);
const relink = await q('parent', `select public.sign_guardian_consent('${P_ATH}', 'Pat Parent', 'parent', true, false, public.guardian_consent_form_version(), public.guardian_consent_form_sha256()) as v`);
const payAfterUnlink = await pay();
record('after the teen ends the link, the guardian on record cannot re-link without the teen confirming (payouts wait)', relink[0]?.v?.link_status === 'waiting_for_teen' && payAfterUnlink.reason === 'needs_guardian_consent', JSON.stringify({ relink, payAfterUnlink }));
const closedWrite = await q('newbie', `update public.profiles set bio = 'back again' where user_id = '${NEWBIE}'`);
const closedTip = await q('newbie', `insert into public.tips (player_id, amount_cents, fan_id) values ('${ATH_PLAYER}', 500, '${NEWBIE}')`);
const closedBio = await rows(`select bio from public.profiles where user_id = '${NEWBIE}'`);
record('a closed under-13 account cannot write anything, even through table policies', closedBio[0].bio === null && (Boolean(closedWrite.error) || (Array.isArray(closedWrite) && closedWrite.length === 0)) && Boolean(closedTip.error), JSON.stringify({ closedWrite, closedTip, closedBio }));
const adminLink = (await rows(`select id from public.guardian_links where minor_id = '${P_ATH}' and guardian_id = (select id from public.profiles where user_id = '${PARENT}') and ended_at is null`))[0]?.id;
if (adminLink) await q('admin', `select public.admin_end_guardian_link('${adminLink}', 'safety concern')`);
const afterAdmin = await q('parent', `select public.sign_guardian_consent('${P_ATH}', 'Pat Parent', 'parent', true, false, public.guardian_consent_form_version(), public.guardian_consent_form_sha256())`);
const closedUpload = await q('newbie', `insert into storage.objects (bucket_id, name) values ('avatars', '${NEWBIE}/a.jpg')`);
record('an admin-ended link stays ended; a closed account cannot upload files', Boolean(adminLink) && /can't sign/.test(afterAdmin.error ?? '') && Boolean(closedUpload.error), JSON.stringify({ adminLink, afterAdmin, closedUpload }));
const rewrite = await db.exec(`update public.guardian_consents set signer_name = 'Someone Else'`).then(() => 'ran', (e) => e.message);
const peek = await q('guard', `select count(*)::int as n from public.guardian_consents`);
const helper = await q('guard', `select public.minor_has_consent('${P_TEEN}', 'public_profile')`);
record('consent records are append-only and unreadable to clients; the helpers are server-only', /kept as signed/.test(rewrite) && /permission denied/.test(peek.error ?? '') && /permission denied/.test(helper.error ?? ''), JSON.stringify({ rewrite, peek, helper }));
const report = await q('admin', `select public.admin_minor_report() as r`);
const notAdminReport = await q('guard', `select public.admin_minor_report()`);
record('admin: the minor report counts bands, links and consents; non-admins are refused', report[0]?.r?.teen_13_15 >= 1 && report[0]?.r?.under_13_blocked === 1 && 'adult_requests_to_teens_7d' in (report[0]?.r ?? {}) && Boolean(notAdminReport.error), JSON.stringify({ report, notAdminReport }));

// Payee verification (20261014120000, VERIFY-02).
const ADULT_ATH = '00000000-0000-0000-0000-00000000a0a3', ADULT_PLAYER = '00000000-0000-0000-0000-00000000b0a3';
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${ADULT_ATH}', '{"birth_year": "2000", "birth_month": "1"}');
  insert into public.players (id, name) values ('${ADULT_PLAYER}', 'Adult Athlete');
  update public.profiles set player_id = '${ADULT_PLAYER}', verification_status = 'verified', is_verified = true, stripe_connect_id = 'acct_replayadult01' where user_id = '${ADULT_ATH}';`);
as.adultath = `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${ADULT_ATH}"}';`;
const P_ADULT = await pid(ADULT_ATH);
const payA = async () => (await rows(`select public.athlete_payout_status('${ADULT_PLAYER}') as s`))[0].s;
const beforeKyc = await payA();
await db.exec(`select public.record_stripe_kyc('acct_replayadult01', true, false, true)`);
const noTin = await payA();
await db.exec(`select public.record_stripe_kyc('acct_replayadult01', true, true, true)`);
const afterKyc = await payA();
record('an adult athlete is paid only after Stripe verifies identity and TIN ("transfers active" alone is not identity)', beforeKyc.allowed === false && noTin.reason === 'needs_payee_verification' && afterKyc.allowed === true, JSON.stringify({ beforeKyc, noTin, afterKyc }));
const ssn = await db.exec(`insert into public.payee_verifications (subject_profile_id, role, method, provider, status, reason) values ('${P_ADULT}', 'adult_athlete', 'document_review', 'support', 'verified', 'SSN 123-45-6789 checked')`).then(() => 'stored', (e) => e.message);
const ssnRef = await db.exec(`insert into public.payee_verifications (subject_profile_id, role, method, provider, status, provider_ref) values ('${P_ADULT}', 'adult_athlete', 'stripe_connect_kyc', 'stripe', 'verified', '123456789')`).then(() => 'stored', (e) => e.message);
const ssnCheck = await q('admin', `select public.admin_record_payee_check('${ATH_PLAYER}', '${P_PARENT}', 'document_review', true, 'birth certificate 123 45 6789 seen')`);
record('no SSN can be stored: SSN-shaped text and non-Stripe references are refused', /no_ssn/.test(ssn) && /provider_ref/.test(ssnRef) && /Leave numbers out/.test(ssnCheck.error ?? ''), JSON.stringify({ ssn, ssnRef, ssnCheck }));
const PARENT2 = '00000000-0000-0000-0000-00000000a0a4';
await db.exec(`insert into auth.users (id, raw_user_meta_data) values ('${PARENT2}', '{"birth_year": "1979", "birth_month": "3"}')`);
const P_PARENT2 = await pid(PARENT2);
await q('admin', `select public.admin_set_birth_month('${P_ATH}', ${Y - 15}, 1, 'replay check')`);
const payWithParent = await pay();
await db.exec(`update public.players set guardian_id = '${P_PARENT2}' where id = '${ATH_PLAYER}'`);
const relAfterChange = await rows(`select status from public.payee_verifications where subject_profile_id = '${P_PARENT}' and method = 'school_parent_confirmation' order by created_at desc limit 1`);
const payNewGuardian = await pay();
await db.exec(`update public.players set guardian_id = '${P_PARENT}' where id = '${ATH_PLAYER}'`);
record('a minor\'s guardian payee needs Stripe identity AND the school\'s parent confirmation; a new guardian on record starts over', relAfterChange[0]?.status === 'superseded' && payNewGuardian.reason !== undefined && payNewGuardian.allowed === false, JSON.stringify({ payWithParent, relAfterChange, payNewGuardian }));
const directFlag = await q('admin', `update public.profiles set payouts_enabled = false where user_id = '${ADULT_ATH}'`);
const overrideReq = await q('admin', `select public.admin_request_payout_override('${P_ADULT}', null, false, 'Stripe account flagged by bank; pausing') as id`);
const vSelfApprove = await q('admin', `select public.admin_decide_payout_override('${overrideReq[0]?.id}', true)`);
const second = await q('admin2', `select public.admin_decide_payout_override('${overrideReq[0]?.id}', true) as r`);
const flagNow = await rows(`select payouts_enabled from public.profiles where user_id = '${ADULT_ATH}'`);
const noReason = await q('admin', `select public.admin_request_payout_override('${P_ADULT}', null, true, 'x')`);
record('payout flags: no direct admin write; an override needs a reason and a second admin', /second admin/.test(directFlag.error ?? '') && /second, independent admin/.test(vSelfApprove.error ?? '') && second[0]?.r === 'approved' && flagNow[0].payouts_enabled === false && Boolean(noReason.error), JSON.stringify({ directFlag, vSelfApprove, second, flagNow, noReason }));
const peekV = await q('adultath', `select count(*)::int as n from public.payee_verifications`);
const fakeKyc = await q('adultath', `select public.record_stripe_kyc('acct_replayadult01', true, true, true)`);
const rewriteV = await db.exec(`update public.payee_verifications set checks = '{"identity": true, "tin": true}'::jsonb where status = 'superseded'`).then(() => 'ran', (e) => e.message);
const overview = await q('admin', `select public.admin_payee_overview('${P_ADULT}') as o`);
record('verification records are server-only and append-only; the admin overview lists checks and what is missing', /permission denied/.test(peekV.error ?? '') && /permission denied/.test(fakeKyc.error ?? '') && /kept as recorded/.test(rewriteV) && (overview[0]?.o?.checks?.length ?? 0) >= 2 && Array.isArray(overview[0]?.o?.athletes), JSON.stringify({ peekV, fakeKyc, rewriteV, overview: overview[0]?.o?.athletes }));

// VERIFY-02 review (RLS_SECURITY 2026-10-14).
const pending = await q('admin', `select public.admin_record_payee_check('${ATH_PLAYER}', '${P_PARENT}', 'document_review', true, 'Birth certificate viewed in person, not kept') as id`);
const pendingRow = await rows(`select status from public.payee_verifications where id = '${pending[0]?.id}'`);
const selfConfirm = await q('admin', `select public.admin_confirm_payee_check('${pending[0]?.id}')`);
const revoke = await q('admin2', `select public.admin_revoke_payee_check('${pending[0]?.id}', 'Recorded against the wrong family')`);
const revokedRow = await rows(`select status from public.payee_verifications where id = '${pending[0]?.id}'`);
record('a relationship check waits for a second admin (the recorder cannot confirm it) and can be revoked', pendingRow[0]?.status === 'pending' && /second admin/.test(selfConfirm.error ?? '') && !revoke.error && revokedRow[0]?.status === 'revoked', JSON.stringify({ pendingRow, selfConfirm, revoke, revokedRow }));
const P_ADMIN = await pid(ADMIN);
await db.exec(`update public.players set guardian_id = '${P_ADMIN}' where id = '${ADULT_PLAYER}'`);
const selfRecord = await q('admin', `select public.admin_record_payee_check('${ADULT_PLAYER}', '${P_ADMIN}', 'school_parent_confirmation', true, 'I say I am the parent of this athlete')`);
await db.exec(`update public.players set guardian_id = null where id = '${ADULT_PLAYER}'`);
await db.exec(`update public.players set guardian_id = '${P_ATH}' where id = '${ATH_PLAYER}'`);
const minorPayee = await rows(`select payee_profile_id from public.payee_for_player('${ATH_PLAYER}')`);
const minorRecord = await q('admin', `select public.admin_record_payee_check('${ATH_PLAYER}', '${P_ATH}', 'school_parent_confirmation', true, 'Recording the teen as their own guardian')`);
await db.exec(`update public.players set guardian_id = '${P_PARENT}' where id = '${ATH_PLAYER}'`);
record('no one records a check about themselves, and a minor is never their own guardian payee', /about yourself/.test(selfRecord.error ?? '') && minorPayee[0]?.payee_profile_id === null && /adult other than the athlete/.test(minorRecord.error ?? ''), JSON.stringify({ selfRecord, minorPayee, minorRecord }));
await db.exec(`insert into public.custodial_accounts (player_id, guardian_id, stripe_connect_id) values ('${ATH_PLAYER}', '${P_PARENT2}', 'acct_replaycust001')`);
const custodialMismatch = await rows(`select public.payee_missing_checks('${ATH_PLAYER}') as m`);
await db.exec(`update public.custodial_accounts set guardian_id = '${P_PARENT}' where player_id = '${ATH_PLAYER}'`);
const custodialNoKyc = await rows(`select public.payee_missing_checks('${ATH_PLAYER}') as m`);
await db.exec(`delete from public.custodial_accounts where player_id = '${ATH_PLAYER}'`);
record('the verified payee must own the account being paid (custodial holder = guardian on record; KYC for that exact Stripe account)', JSON.stringify(custodialMismatch[0].m) === '["payee"]' && custodialNoKyc[0].m.includes('identity'), JSON.stringify({ custodialMismatch, custodialNoKyc }));
const forAdmin1 = await q('admin2', `select public.admin_request_payout_override('${P_ADMIN}', null, true, 'Turning on transfers for the first admin') as id`);
const beneficiary = await q('admin', `select public.admin_decide_payout_override('${forAdmin1[0]?.id}', true)`);
record('the admin an override benefits cannot approve it', /independent admin/.test(beneficiary.error ?? ''), JSON.stringify(beneficiary));
const ssnLike = await rows(`select public.looks_like_ssn('123.45.6789') a, public.looks_like_ssn('123 - 45 - 6789') b, public.looks_like_ssn('SSN last four 6789') c, public.looks_like_ssn('１２３-４５-６７８９') d, public.looks_like_ssn('Met the AD on 2026-10-14 at 3:30') e, public.looks_like_ssn('call (801) 555-0134') f`);
record('the SSN filter catches dotted, spaced, full-width and "last four" forms (and phone numbers, which do not belong in reasons either) but not dates', ssnLike[0].a && ssnLike[0].b && ssnLike[0].c && ssnLike[0].d && !ssnLike[0].e && ssnLike[0].f, JSON.stringify(ssnLike));
const purge = await db.exec(`delete from public.payee_verifications`).then(() => 'deleted', (e) => e.message);
const truncate = await db.exec(`truncate public.payee_verifications`).then(() => 'truncated', (e) => e.message);
const sneak = await db.exec(`update public.payee_verifications set reason = 'rewritten', reviewer_id = null where reviewer_id is not null`).then(() => 'ran', (e) => e.message);
record('verification records cannot be deleted, truncated or rewritten (even by the server)', /kept/.test(purge) && /kept/.test(truncate) && /kept as recorded/.test(sneak), JSON.stringify({ purge, truncate, sneak }));

const [counts] = await rows(`select (select count(*) from pg_tables where schemaname = 'public')::int as tables, (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')::int as functions, (select count(*) from pg_policies where schemaname = 'public')::int as policies`);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : ` — ${r.detail}`}`);
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed on PGlite (Postgres ${(await rows('show server_version'))[0].server_version}); ${counts.tables} tables, ${counts.functions} functions, ${counts.policies} policies`);
process.exit(failed.length ? 1 : 0);
