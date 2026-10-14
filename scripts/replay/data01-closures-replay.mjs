// DATA-01 closures migration replay on real Postgres (PGlite). Owned by DATA_LINEAGE with BACKEND.
// Not part of `pnpm check` (PGlite is not a repo dependency); fetch it as described in
// scripts/replay/books01-ledger-replay.mjs, then run:
//   node scripts/replay/data01-closures-replay.mjs /tmp/pg/package/dist supabase/migrations/20261013120000_data_governance_closures.sql
// Exit 0 when every check passes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [distDir, migrationPath] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(path.join(distDir, 'index.js')).href);
const db = new PGlite();
const results = [];
const lastSelect = (r) => [...r].reverse().find((res) => res.fields && res.fields.length > 0) ?? r[r.length - 1];
async function ok(name, sql, check) {
  try { const r = lastSelect(await db.exec(sql)); if (check && !check(r?.rows ?? [])) results.push({ name, pass: false, detail: JSON.stringify(r?.rows) }); else results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, detail: e.message }); }
  finally { await db.exec('reset role;').catch(() => {}); }
}
async function err(name, sql, pattern) {
  try { await db.exec(sql); results.push({ name, pass: false, detail: 'no error' }); }
  catch (e) { results.push({ name, pass: pattern.test(e.message), detail: e.message }); }
  finally { await db.exec('reset role;').catch(() => {}); }
}
const ADMIN = `set role authenticated; set test.role = 'admin'; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';`;
const FAN = `set role authenticated; set test.role = 'fan'; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';`;
const ANON = `set role anon; set test.role = ''; set request.jwt.claim.sub = '';`;
const OPERATOR = `set role authenticated; set test.role = 'operator'; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000dd';`;
const P = '11111111-1111-1111-1111-111111111111';

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create function public.current_user_role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'anon') $$;
  grant execute on function public.current_user_role() to anon, authenticated;
  create function public.require_admin_guard() returns void language plpgsql stable security definer set search_path = public as $$
  begin if public.current_user_role() <> 'admin' then raise exception 'Admin access required'; end if; end; $$;
  grant execute on function public.require_admin_guard() to authenticated;
  create table public.players (id uuid primary key, name text);
  insert into public.players values ('${P}', 'Fixture');
  create table public.athlete_career_stats (player_id uuid primary key references public.players(id), sport text not null default 'Football', games_played integer not null default 0, scoring_value integer not null default 0, volume_value integer not null default 0, mvp_badges integer not null default 0, updated_at timestamptz not null default now());
  create table public.athlete_game_logs (id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id), played_on date not null, opponent_school text not null default '', stat_line text not null default '', scoring_value integer not null default 0, volume_value integer not null default 0, created_at timestamptz not null default now());
  create table public.crew_push_queue (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, kind text not null default 'flash_unlock', title text not null default '', body text not null default '', created_at timestamptz not null default now());
  insert into public.crew_push_queue (recipient_id, title) values ('00000000-0000-0000-0000-0000000000bb', 'mine'), ('00000000-0000-0000-0000-0000000000bb', 'mine 2'), ('00000000-0000-0000-0000-0000000000cc', 'someone else');
  create table public.operator_gigs (id uuid primary key default gen_random_uuid());
  create table public.operator_checkins (id uuid primary key default gen_random_uuid(), gig_id uuid references public.operator_gigs(id), latitude double precision, longitude double precision, checked_in_at timestamptz not null default now());
  insert into public.operator_checkins (latitude, longitude, checked_in_at) values (21.306944, -157.858333, now()), (40.760780, -111.891045, now() - interval '200 days');
  create function auth.role() returns text language sql stable as $$ select case when current_user = 'anon' then 'anon' else 'authenticated' end $$;
  grant execute on function auth.role() to anon, authenticated;
  -- Mirror schema.sql: RLS with the old for-all policy and the broad grant the migration must narrow.
  alter table public.operator_checkins enable row level security;
  create policy "Operators write checkins" on public.operator_checkins for all
    using (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'))
    with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));
  grant select, insert on public.operator_checkins to anon, authenticated;
  alter table public.crew_push_queue enable row level security;
  create policy "Users read own crew push" on public.crew_push_queue for select using (recipient_id = auth.uid());
  grant select on public.crew_push_queue to authenticated;
  insert into public.crew_push_queue (recipient_id, title, created_at) values ('00000000-0000-0000-0000-0000000000ee', 'stale', now() - interval '45 days');
  create table public.schools_and_teams (id uuid primary key);
  insert into public.schools_and_teams values ('22222222-2222-2222-2222-222222222222');
  create table public.school_confirmers (id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools_and_teams(id), full_name text not null, email text not null, staff_role text not null, sport text, token_hash text not null unique, active boolean not null default true, expires_at timestamptz not null default now() + interval '1 year', created_at timestamptz not null default now(), last_used_at timestamptz);
  insert into public.school_confirmers (school_id, full_name, email, staff_role, token_hash) values ('22222222-2222-2222-2222-222222222222', 'Ana Tui', 'ana@school.org', 'athletic_director', 'secret-hash');
  alter table public.school_confirmers add column created_by uuid;
  alter table public.school_confirmers enable row level security;
  create policy "Admins read school confirmers" on public.school_confirmers for select using (public.current_user_role() = 'admin');
  grant select on public.school_confirmers to authenticated;
  create function public.get_aura_tier(points integer) returns jsonb language sql as $$ select '{}'::jsonb $$;
`);

const migration = fs.readFileSync(migrationPath, 'utf8');
await ok('migration applies', migration);
await ok('migration re-runs safely', migration);

await ok('admin writes career stats', `${ADMIN} select public.admin_upsert_athlete_career_stats('${P}', 'Rugby', 8, 40, 120, 2); reset role; select sport, games_played from public.athlete_career_stats where player_id = '${P}';`, (r) => r[0]?.sport === 'Rugby' && r[0]?.games_played === 8);
await ok('upsert replaces the line', `${ADMIN} select public.admin_upsert_athlete_career_stats('${P}', 'Rugby', 9, 41, 121, 2); reset role; select count(*)::int as n, max(games_played) as g from public.athlete_career_stats;`, (r) => r[0].n === 1 && r[0].g === 9);
await err('negative stats rejected', `${ADMIN} select public.admin_upsert_athlete_career_stats('${P}', 'Rugby', -1, 0, 0, 0);`, /between 0/);
await err('unknown athlete rejected', `${ADMIN} select public.admin_upsert_athlete_career_stats('99999999-9999-9999-9999-999999999999', 'Rugby', 1, 0, 0, 0);`, /Choose an athlete/);
const logRows = await (async () => { try { return lastSelect(await db.exec(`${ADMIN} select public.admin_add_athlete_game_log('${P}', date '2026-10-02', 'Kahuku', '2 tries', 10, 30) as id; reset role;`)).rows; } catch (e) { results.push({ name: 'admin adds a game log', pass: false, detail: e.message }); return []; } })();
results.push({ name: 'admin adds a game log', pass: logRows.length === 1 });
await db.exec('reset role;');
await err('future game date rejected', `${ADMIN} select public.admin_add_athlete_game_log('${P}', current_date + 3, 'X', '', 0, 0);`, /not in the future/);
await ok('admin removes a game log', `${ADMIN} select public.admin_remove_athlete_game_log('${logRows[0]?.id}'); reset role; select count(*)::int as n from public.athlete_game_logs;`, (r) => r[0].n === 0);
await err('removing a missing log explains itself', `${ADMIN} select public.admin_remove_athlete_game_log('${logRows[0]?.id}');`, /no longer exists/);

await ok('a fan clears only their own crew alerts', `${FAN} select public.clear_my_crew_alerts() as n; reset role;`, (r) => r[0].n === 2);
await ok("other accounts' recent alerts stay; alerts older than 30 days are purged", `select count(*)::int as n, count(*) filter (where title = 'stale')::int as stale from public.crew_push_queue;`, (r) => r[0].n === 1 && r[0].stale === 0);
await err('a guest cannot clear alerts', `${ANON} select public.clear_my_crew_alerts();`, /permission denied|Sign in/);

await ok('existing exact coordinates are rounded when the migration runs', `select latitude::text as lat from public.operator_checkins;`, (r) => r.length === 1 && r[0].lat === '21.31');
await ok('the migration already expired the check-in older than 30 days', `select count(*)::int as n from public.operator_checkins;`, (r) => r[0].n === 1);
await ok('admin sees check-ins with location rounded to about 1 km', `${ADMIN} select latitude_approx::text as lat, longitude_approx::text as lng from public.admin_list_operator_checkins(10) order by checked_in_at desc limit 1; reset role;`, (r) => r[0]?.lat === '21.31' && r[0]?.lng === '-157.86');
await err('purge keeps at least 7 days', `${ADMIN} select public.admin_purge_operator_checkins(3);`, /at least 7 days/);
await ok('a manual purge (default 30 days) uses the same rule', `insert into public.operator_checkins (latitude, longitude) values (5, 5); alter table public.operator_checkins disable trigger operator_checkins_minimize; update public.operator_checkins set checked_in_at = now() - interval '10 days' where latitude = 5; alter table public.operator_checkins enable trigger operator_checkins_minimize; ${ADMIN} select public.admin_purge_operator_checkins() as d30, public.admin_purge_operator_checkins(7) as d7; reset role;`, (r) => r[0].d30 === 0 && r[0].d7 === 1);
await ok('recent check-ins remain', `select count(*)::int as n from public.operator_checkins;`, (r) => r[0].n === 1);
await ok('a new check-in is stored rounded, with the server time even if the client sends another', `${ANON} insert into public.operator_checkins (latitude, longitude, checked_in_at) values (40.760780, -111.891045, timestamptz '2099-01-01'); reset role; select latitude::text as lat, longitude::text as lng, checked_in_at <= now() as server_time from public.operator_checkins order by checked_in_at desc limit 1;`, (r) => r[0].lat === '40.76' && r[0].lng === '-111.89' && r[0].server_time === true);
await ok('every insert removes check-ins older than 30 days', `alter table public.operator_checkins disable trigger operator_checkins_minimize; insert into public.operator_checkins (latitude, longitude, checked_in_at) values (1, 1, now() - interval '31 days'); alter table public.operator_checkins enable trigger operator_checkins_minimize; insert into public.operator_checkins (latitude, longitude) values (2, 2); select count(*) filter (where checked_in_at < now() - interval '30 days')::int as old from public.operator_checkins;`, (r) => r[0].old === 0);
await ok('the admin list also expires old check-ins when none are arriving', `alter table public.operator_checkins disable trigger operator_checkins_minimize; insert into public.operator_checkins (latitude, longitude, checked_in_at) values (1, 1, now() - interval '45 days'); alter table public.operator_checkins enable trigger operator_checkins_minimize; ${ADMIN} select count(*)::int as n from public.admin_list_operator_checkins(50); reset role; select count(*) filter (where checked_in_at < now() - interval '30 days')::int as old from public.operator_checkins;`, (r) => r[0].old === 0);
await err('no client can call the retention function directly', `${ADMIN} select public.expire_operator_checkins(7);`, /permission denied/);

await err('guest cannot read exact check-in coordinates from the table', `${ANON} select latitude from public.operator_checkins;`, /permission denied/);
await err('operator cannot read exact check-in coordinates from the table', `${OPERATOR} select latitude from public.operator_checkins;`, /permission denied/);
await err('admin cannot read exact coordinates from the table either (rounded RPC only)', `${ADMIN} select latitude from public.operator_checkins;`, /permission denied/);
await ok('the sideline console can still insert a check-in (guest PIN)', `${ANON} insert into public.operator_checkins (latitude, longitude) values (1.23456, 2.34567); reset role; select count(*)::int as n from public.operator_checkins;`, (r) => r[0].n >= 2);
await ok('an operator can insert a check-in', `${OPERATOR} insert into public.operator_checkins (latitude, longitude) values (1.1, 2.2); reset role; select count(*)::int as n from public.operator_checkins;`, (r) => r[0].n >= 3);
await err('a fan cannot insert a check-in', `${FAN} insert into public.operator_checkins (latitude, longitude) values (1, 2);`, /row-level security|permission denied/);
await err('admin cannot read token_hash from the table', `${ADMIN} select token_hash from public.school_confirmers;`, /permission denied/);
await ok('admin can still read the other confirmer columns', `${ADMIN} select full_name from public.school_confirmers; reset role;`, (r) => r[0]?.full_name === 'Ana Tui');
await ok('admin lists confirmers without the token hash', `${ADMIN} select * from public.admin_list_school_confirmers('22222222-2222-2222-2222-222222222222'); reset role;`, (r) => r.length === 1 && r[0].full_name === 'Ana Tui' && !('token_hash' in r[0]));

for (const [who, as] of [['signed-in fan', FAN], ['guest', ANON]]) {
  await err(`${who}: career stats writer denied`, `${as} select public.admin_upsert_athlete_career_stats('${P}', 'Rugby', 1, 1, 1, 0);`, /Admin access required|permission denied/);
  await err(`${who}: game log remover denied`, `${as} select public.admin_remove_athlete_game_log('00000000-0000-0000-0000-000000000000');`, /Admin access required|permission denied/);
  await err(`${who}: game log writer denied`, `${as} select public.admin_add_athlete_game_log('${P}', date '2026-10-01', '', '', 0, 0);`, /Admin access required|permission denied/);
  await err(`${who}: check-in list denied`, `${as} select * from public.admin_list_operator_checkins(5);`, /Admin access required|permission denied/);
  await err(`${who}: check-in purge denied`, `${as} select public.admin_purge_operator_checkins(90);`, /Admin access required|permission denied/);
  await err(`${who}: confirmer list denied`, `${as} select * from public.admin_list_school_confirmers('22222222-2222-2222-2222-222222222222');`, /Admin access required|permission denied/);
}
await ok('get_aura_tier is archived (dropped)', `select to_regprocedure('public.get_aura_tier(integer)') is null as gone;`, (r) => r[0].gone === true);
await ok('every new function pins an empty search_path', `select count(*)::int as n from pg_proc where proname in ('admin_upsert_athlete_career_stats','admin_add_athlete_game_log','admin_remove_athlete_game_log','clear_my_crew_alerts','admin_list_operator_checkins','admin_purge_operator_checkins','admin_list_school_confirmers','expire_operator_checkins','operator_checkins_minimize') and array_to_string(proconfig, ',') = 'search_path=""';`, (r) => r[0].n === 9);

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n      ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed on PGlite (Postgres ${(await db.query('show server_version')).rows[0].server_version})`);
process.exit(failed.length ? 1 : 0);
