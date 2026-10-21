#!/usr/bin/env node
/**
 * LOCAL-02 public sporting venue contract, replayed against the whole canonical schema on PGlite.
 * The real SQL proves that admin venue edits are protected while legacy sideline scores still work.
 * No hosted database or map provider is contacted. PGlite is loaded from an installed outside cache.
 * Run: node scripts/replay/game-venues-replay.mjs <pglite dist dir> [--baseline] [--schema=path]
 * --baseline excludes LOCAL-02 and demonstrates the missing venue protection before implementation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const [dist, ...flags] = process.argv.slice(2);
if (!dist) {
  console.error('usage: node scripts/replay/game-venues-replay.mjs <pglite dist dir> [--baseline]');
  process.exit(2);
}
const baseline = flags.includes('--baseline');
const migrationPath = 'supabase/migrations/20261021220000_game_venues.sql';
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const results = [];
const record = (name, pass, detail = '') => results.push({ name, pass, detail });
const reset = async () => db.exec('reset role; reset request.jwt.claims;');
const rows = async (sql) => (await db.query(sql)).rows;
const run = async (name, sql, check = () => true) => {
  try {
    const result = await db.exec(sql);
    const rowset = [...result].reverse().find((item) => item.fields?.length)?.rows ?? [];
    record(name, check(rowset), JSON.stringify(rowset));
  } catch (error) { record(name, false, error.message); }
  finally { await reset(); }
};
const denied = async (name, sql, codes = ['42501', 'P0001']) => {
  try { await db.exec(sql); record(name, false, 'request was allowed'); }
  catch (error) { record(name, codes.includes(error.code), `${error.code}: ${error.message}`); }
  finally { await reset(); }
};
const updateDenied = async (name, setup, field, gameId) => {
  const before = (await rows(`select ${field} from public.games where id = '${gameId}';`))[0][field];
  let acceptable = true;
  let detail = '';
  try { await db.exec(`${setup} update public.games set ${field} = 'Unauthorized' where id = '${gameId}';`); }
  catch (error) { acceptable = ['42501', 'P0001'].includes(error.code); detail = `${error.code}: ${error.message}`; }
  finally { await reset(); }
  // RLS may refuse an UPDATE with zero matched rows; the persisted value is the authorization result.
  const after = (await rows(`select ${field} from public.games where id = '${gameId}';`))[0][field];
  record(name, acceptable && after === before, detail || `persisted value ${JSON.stringify(after)}`);
};

await db.exec(SUPABASE_STUBS);
const schemaPath = flags.find((flag) => flag.startsWith('--schema='))?.slice('--schema='.length)
  ?? 'apps/mobile/src/backend/db/schema.sql';
let schema = fs.readFileSync(schemaPath, 'utf8');
// Strip only this owned migration so the baseline remains reproducible after the implementation exists.
if (fs.existsSync(migrationPath)) {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  schema = schema.replace(migration, '');
}
try { await db.exec(schema); record('whole prior canonical schema builds', true); }
catch (error) { console.error(`FAIL schema setup: ${error.message}`); process.exit(1); }

const ADMIN_ID = '00000000-0000-0000-0000-00000000a002';
const FAN_ID = '00000000-0000-0000-0000-00000000f002';
const OPERATOR_ID = '00000000-0000-0000-0000-00000000d002';
const GAME = '00000000-0000-0000-0000-00000000c002';
const LEGACY = '00000000-0000-0000-0000-00000000c003';
const LEGACY_LONG = '00000000-0000-0000-0000-00000000c004';
await db.exec(`
  insert into auth.users (id) values ('${ADMIN_ID}'), ('${FAN_ID}'), ('${OPERATOR_ID}');
  update public.profiles set role = 'admin', is_admin = true where user_id = '${ADMIN_ID}';
  update public.profiles set role = 'fan' where user_id = '${FAN_ID}';
  update public.profiles set role = 'operator' where user_id = '${OPERATOR_ID}';
  insert into public.games (id, home_team, away_team, venue)
    values ('${GAME}', 'Home', 'Away', 'Old stadium'),
      ('${LEGACY}', 'Legacy', 'Away', '  Legacy stadium  '),
      ('${LEGACY_LONG}', 'Legacy long', 'Away', repeat('L', 161));
`);
const who = {
  anon: `set role anon; set request.jwt.claims = '{"role":"anon"}';`,
  fan: `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${FAN_ID}"}';`,
  operator: `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${OPERATOR_ID}"}';`,
  admin: `set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${ADMIN_ID}"}';`,
  claimlessAnon: `set role anon; set request.jwt.claims = '';`,
  claimlessFan: `set role authenticated; set request.jwt.claims = '';`,
  service: `set role service_role; set request.jwt.claims = '{"role":"service_role"}';`,
};

if (!baseline) {
  const migration = fs.readFileSync(migrationPath, 'utf8');
  await run('migration applies to existing games', migration);
  await run('migration re-applies safely', migration);
}

for (const actor of ['anon', 'operator']) {
  await updateDenied(`${actor} cannot alter original venue`, who[actor], 'venue', GAME);
}

if (!baseline) {
  await run('existing game gains empty optional fields', `select venue_school, venue_address, venue_notes from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue_school === '' && r[0]?.venue_address === '' && r[0]?.venue_notes === '');
  for (const actor of ['anon', 'fan', 'operator', 'claimlessAnon', 'claimlessFan']) {
    for (const field of ['venue_school', 'venue_address', 'venue_notes']) {
      await updateDenied(`${actor} cannot update ${field}`, who[actor], field, GAME);
    }
    await denied(`${actor} cannot insert a public location`, `${who[actor]} insert into public.games (home_team, away_team, venue_address) values ('Home', 'Away', '12 Stadium Road, Honolulu, HI');`);
  }
  await run('admin saves explicit away-game venue with trimmed public arrival details', `${who.admin}
    update public.games set venue = E' \tAway stadium\n ', venue_school = '  Away school  ',
      venue_address = '  12 Stadium Road, Honolulu, HI  ', venue_notes = E'\nUse the east entrance\t'
      where id = '${GAME}';
    select venue, venue_school, venue_address, venue_notes from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue === 'Away stadium' && r[0]?.venue_school === 'Away school'
      && r[0]?.venue_address === '12 Stadium Road, Honolulu, HI' && r[0]?.venue_notes === 'Use the east entrance');
  await run('fan can read public sporting venue fields', `${who.fan} select venue_address from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue_address === '12 Stadium Road, Honolulu, HI');
  await run('guest can read public sporting venue fields', `${who.anon} select venue_notes from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue_notes === 'Use the east entrance');
  await run('admin can create a game with a public sporting venue', `${who.admin}
    insert into public.games (home_team, away_team, venue, venue_school, venue_address, venue_notes)
      values ('Admin new', 'Away', '  School gym  ', '  Visiting school  ', '  12 Gym Road, Honolulu, HI  ', '  Public parking  ');
    select venue, venue_school, venue_address, venue_notes from public.games where home_team = 'Admin new';`,
    (r) => r[0]?.venue === 'School gym' && r[0]?.venue_school === 'Visiting school'
      && r[0]?.venue_address === '12 Gym Road, Honolulu, HI' && r[0]?.venue_notes === 'Public parking');
  for (const actor of ['anon', 'operator']) {
    await run(`${actor} still updates scores and clock without altering venue fields`, `${who[actor]}
      update public.games set home_score = 7, away_score = 3, quarter = 'Q2', clock = '08:42' where id = '${GAME}';
      select home_score, clock, venue_address from public.games where id = '${GAME}';`,
      (r) => r[0]?.home_score === 7 && r[0]?.clock === '08:42' && r[0]?.venue_address === '12 Stadium Road, Honolulu, HI');
    await run(`${actor} score-only update retains historical venue whitespace`, `${who[actor]}
      update public.games set away_score = away_score + 1 where id = '${LEGACY}';
      select venue from public.games where id = '${LEGACY}';`, (r) => r[0]?.venue === '  Legacy stadium  ');
  }
  await run('operator can still insert a legacy game without location details', `${who.operator}
    insert into public.games (home_team, away_team) values ('Operator legacy', 'Away');
    select venue_address from public.games where home_team = 'Operator legacy';`, (r) => r[0]?.venue_address === '');
  await run('operator whitespace-only location insert normalizes to empty', `${who.operator}
    insert into public.games (home_team, away_team, venue, venue_school, venue_address, venue_notes)
      values ('Blank venue', 'Away', E'\t\n ', E'\t ', E'\n ', E'\r\n ');
    select venue, venue_address, venue_notes from public.games where home_team = 'Blank venue';`,
    (r) => r[0]?.venue === '' && r[0]?.venue_address === '' && r[0]?.venue_notes === '');
  await run('admin clears all venue fields', `${who.admin}
    update public.games set venue = E'\t\n ', venue_school = '', venue_address = '', venue_notes = '' where id = '${GAME}';
    select venue, venue_school, venue_address, venue_notes from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue === '' && r[0]?.venue_school === '' && r[0]?.venue_address === '' && r[0]?.venue_notes === '');
  await run('explicit null optional details normalize to empty', `${who.admin}
    update public.games set venue_school = null, venue_address = null, venue_notes = null where id = '${GAME}';
    select venue_school, venue_address, venue_notes from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue_school === '' && r[0]?.venue_address === '' && r[0]?.venue_notes === '');
  await run('admin can save a neutral venue without attaching a school', `${who.admin}
    update public.games set venue = 'City field', venue_address = '44 Field Lane, Honolulu, HI' where id = '${GAME}';
    select venue, venue_school, venue_address from public.games where id = '${GAME}';`,
    (r) => r[0]?.venue === 'City field' && r[0]?.venue_school === '' && r[0]?.venue_address === '44 Field Lane, Honolulu, HI');
  await run('admin can add an address while preserving an unchanged historical long venue', `${who.admin}
    update public.games set venue_address = '12 Old Stadium Road, Honolulu, HI' where id = '${LEGACY_LONG}';
    select venue, venue_address from public.games where id = '${LEGACY_LONG}';`,
    (r) => r[0]?.venue === 'L'.repeat(161) && r[0]?.venue_address === '12 Old Stadium Road, Honolulu, HI');
  await run('admin can clear an address while preserving an unchanged historical long venue', `${who.admin}
    update public.games set venue_address = '' where id = '${LEGACY_LONG}';
    select venue, venue_address from public.games where id = '${LEGACY_LONG}';`,
    (r) => r[0]?.venue === 'L'.repeat(161) && r[0]?.venue_address === '');
  await run('admin new-field edits retain historical venue whitespace', `${who.admin}
    update public.games set venue_notes = 'Use public east gate' where id = '${LEGACY}';
    select venue from public.games where id = '${LEGACY}';`, (r) => r[0]?.venue === '  Legacy stadium  ');
  await run('SQL Editor may populate public venue details', `update public.games set venue_notes = 'Public parking entrance' where id = '${GAME}';`);
  await run('trusted service may repair public venue details', `${who.service} update public.games set venue_notes = 'Public north entrance' where id = '${GAME}';`);
  for (const [field, limit] of [['venue', 160], ['venue_school', 160], ['venue_address', 320], ['venue_notes', 400]]) {
    await run(`admin accepts ${field} exact character boundary`, `${who.admin} update public.games set ${field} = repeat('é', ${limit}) where id = '${GAME}';`);
    await denied(`admin rejects oversized ${field}`, `${who.admin} update public.games set ${field} = repeat('x', ${limit + 1}) where id = '${GAME}';`, ['22023', '23514']);
    await denied(`SQL Editor rejects oversized ${field}`, `update public.games set ${field} = repeat('x', ${limit + 1}) where id = '${GAME}';`, ['22023', '23514']);
    await denied(`INSERT rejects oversized ${field}`, `${who.admin} insert into public.games (home_team, away_team, ${field}) values ('Oversized', 'Away', repeat('x', ${limit + 1}));`, ['22023', '23514']);
  }
  await denied('operator cannot disable venue guard', `${who.operator} alter table public.games disable trigger games_venue_guard;`);
  await denied('operator cannot change trigger execution mode', `${who.operator} set session_replication_role = replica;`);
  for (const actor of ['anon', 'fan', 'operator', 'admin']) {
    await denied(`${actor} cannot invoke internal venue trigger directly`, `${who[actor]} select public.games_venue_guard();`);
  }
  await run('new-field bounds still hold if a privileged maintenance process bypasses triggers', `
    alter table public.games disable trigger games_venue_guard;
    do $$ begin
      begin update public.games set venue_address = repeat('x', 321) where id = '${GAME}';
        raise exception 'constraint missing';
      exception when check_violation then null; end;
    end $$;
    alter table public.games enable trigger games_venue_guard;`);
  await run('admin location change does not reset team or score fields', `${who.admin}
    update public.games set venue = 'Restored field', venue_school = '', venue_address = '', venue_notes = '' where id = '${GAME}';
    select home_team, home_score, away_score, clock from public.games where id = '${GAME}';`,
    (r) => r[0]?.home_team === 'Home' && r[0]?.home_score === 7 && r[0]?.away_score === 3 && r[0]?.clock === '08:42');
}

const failed = results.filter((result) => !result.pass);
for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.pass ? '' : ` — ${result.detail}`}`);
console.log(`${results.length - failed.length}/${results.length} passed on PGlite (Postgres ${(await rows('show server_version'))[0].server_version})${baseline ? ' — prior schema baseline' : ''}`);
await db.close();
process.exit(failed.length ? 1 : 0);
