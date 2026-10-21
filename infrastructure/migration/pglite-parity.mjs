#!/usr/bin/env node
/**
 * REDUNDANCY-01 local proof of the database parity check, on the real canonical schema and no hosted database.
 *
 *   node infrastructure/migration/pglite-parity.mjs <pglite dist dir>
 *
 * Builds a "source" from schema.sql (Supabase pieces stubbed as in scripts/replay) with synthetic rows, then a
 * separate "target" built the way a restored owned-server stack is: schema first, then every row copied across
 * (as record text, the way pg_restore's COPY does, into a separate process) and sequences set. It runs the same catalog.sql parity.py uses and the same comparer (python3 parity.py compare), and checks:
 *   - a faithful copy passes with zero blocking findings;
 *   - each drift a bad restore can cause is blocked: RLS off, a missing or extra policy, a new anon grant, a lost
 *     or changed row, a sequence behind the source, a table dropped from realtime, a definer function without
 *     its search_path, a disabled trigger, missing migration history, and an auth.uid() that reads a different claim
 *     (exit B's Auth bridge risk: the schema matches, but every signed-in user sees different rows — access parity).
 * Each drift is applied inside a transaction on the target and rolled back. PGlite is fetched outside the repo
 * (CI pins 0.5.9 by hash); it is not a dependency. Exit 1 on any failed expectation.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from '../../scripts/replay/supabase-stubs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: node infrastructure/migration/pglite-parity.mjs <pglite dist dir>'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib', 'pgcrypto.js')).href);

const schema = fs.readFileSync(path.join(root, 'apps/mobile/src/backend/db/schema.sql'), 'utf8');
const catalog = fs.readFileSync(path.join(here, 'catalog.sql'), 'utf8');
const accessSql = fs.readFileSync(path.join(here, 'access.sql'), 'utf8');
// Same session settings parity.py sets before fingerprinting, so row text is identical across servers.
const STABLE = `set local search_path = ''; set local row_security = on; set local timezone = 'UTC'; set local datestyle = 'ISO, YMD'; set local intervalstyle = 'postgres';
  set local extra_float_digits = 3; set local bytea_output = 'hex'; set local tapuai.parity_schemas = 'auto';
  set local tapuai.parity_hash_rows = 'on';`;
// Shared with local-drill.mjs: synthetic rows plus the CLI migration-history table hosted Supabase keeps.
const SEED = fs.readFileSync(path.join(here, 'fixtures/synthetic-seed.sql'), 'utf8');
const MIGRATIONS = SEED.split('\n').filter((l) => l.startsWith('create ')).join('\n');

async function build() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  await db.exec(schema);
  await db.exec(MIGRATIONS);
  return db;
}

/** Synthetic rows only (fixtures/synthetic-seed.sql). */
async function seed(db) {
  await db.exec(SEED);
}

/** Copy every row the way a logical restore does: definitions exist first, rows load with triggers held off. */
async function copyRows(source, target) {
  const tables = (await source.query(`select format('%I.%I', n.nspname, c.relname) as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p') and n.nspname in ('public','auth','storage','supabase_migrations')
      and c.oid not in (select objid from pg_depend where deptype = 'e') order by 1`)).rows.map((r) => r.t);
  await target.exec(`set session_replication_role = replica;`);
  for (const t of tables) {
    // Record text, like pg_restore's COPY. A JSON round trip would turn numeric 25.00 into 25, and the row
    // hash rightly calls that a different row.
    const rows = (await source.query(`select coalesce(array_agg(x::text), '{}') as r from ${t} x`)).rows[0].r;
    await target.exec(`delete from ${t};`);
    if (rows.length) await target.query(`insert into ${t} overriding system value select (r::${t}).* from unnest($1::text[]) r`, [rows]);
  }
  await target.exec(`set session_replication_role = origin;`);
  for (const { s, v } of (await source.query(`select format('%I.%I', schemaname, sequencename) as s, last_value as v from pg_sequences where last_value is not null`)).rows) {
    await target.query(`select setval($1, $2)`, [s, v]);
  }
}

async function fingerprint(db, mutation = '') {
  try {
    await db.exec(`begin; ${STABLE} ${mutation}`);
    const fp = (await db.query(catalog)).rows[0].fingerprint;
    const rows = (await db.query(fp.rows_sql)).rows;
    delete fp.rows_sql;
    fp.rows = Object.fromEntries(rows.map((r) => [r.key, { count: Number(r.row_count), digest: r.digest }]));
    // Access parity: the app's own view through RLS, as guest / signed-in user / admin (same file parity.py runs).
    fp.access = JSON.parse((await db.exec(accessSql)).at(-1).rows[0].access);
    return fp;
  } finally {
    await db.exec('rollback;');
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tapuai-parity-'));
let n = 0;
function compare(source, target) {
  const a = path.join(tmp, `s${++n}.json`); const b = path.join(tmp, `t${n}.json`);
  fs.writeFileSync(a, JSON.stringify(source)); fs.writeFileSync(b, JSON.stringify(target));
  try {
    return { exit: 0, result: JSON.parse(execFileSync('python3', [path.join(here, 'parity.py'), 'compare', a, b, '--json'], { encoding: 'utf8' })) };
  } catch (error) {
    if (error.status === 1 && error.stdout) return { exit: 1, result: JSON.parse(error.stdout) };
    throw error;
  }
}

const results = [];
const record = (name, pass, detail = '') => results.push({ name, pass, detail });

const source = await build();
await seed(source);
const target = await build();
await copyRows(source, target);
const sourceFp = await fingerprint(source);
const seeded = Object.values(sourceFp.rows).filter((r) => r.count > 0).length;
record('source fingerprint covers the canonical schema with seeded rows',
  Object.keys(sourceFp.tables).length > 100 && seeded >= 6, `${Object.keys(sourceFp.tables).length} tables/views, ${seeded} non-empty row targets`);

const clean = compare(sourceFp, await fingerprint(target));
record('a faithful restore passes with zero blocking findings', clean.exit === 0 && clean.result.blocking === 0,
  clean.result.findings.filter((f) => f.severity === 'block').map((f) => `${f.area} ${f.key}: ${f.message}`).join(' | '));

const DRIFTS = [
  ['row level security switched off', `alter table public.players disable row level security;`, 'tables', 'public.players'],
  ['a policy missing on the target', `drop policy if exists "Public read players" on public.players; drop policy if exists "Players are viewable by everyone" on public.players;
     do $$ declare p text; begin select polname into p from pg_policy where polrelid = 'public.players'::regclass limit 1; execute format('drop policy %I on public.players', p); end $$;`, 'policies', 'public.players.'],
  ['an extra permissive policy on the target', `create policy parity_extra on public.tips for select to anon using (true);`, 'policies', 'public.tips.parity_extra'],
  ['a new anon grant', `do $$ declare t text; begin select format('%I.%I', schemaname, tablename) into t from pg_tables where schemaname = 'public'
     and not has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'select') order by 1 limit 1; execute format('grant select on %s to anon', t); end $$;`, 'grants', 'public.'],
  ['a lost row', `delete from public.games where home_team = 'North';`, 'rows', 'public.games'],
  ['a changed row with the same count', `update public.players set name = 'Changed' where name = 'Synthetic Athlete Two';`, 'rows', 'public.players'],
  ['a sequence behind the source', `select setval('public.challenge_mutes_id_seq', 5);`, 'sequences', 'public.challenge_mutes_id_seq'],
  ['a table dropped from realtime', `alter publication supabase_realtime drop table public.games;`, 'publications', 'supabase_realtime'],
  ['a definer function without its search_path', `do $$ declare f text; begin select p.oid::regprocedure::text into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.proconfig is not null order by 1 limit 1; execute format('alter function %s reset search_path', f); end $$;`, 'functions', 'public.'],
  ['a disabled trigger', `do $$ declare t record; begin select tg.tgname, format('%I.%I', n.nspname, c.relname) as rel into t from pg_trigger tg
     join pg_class c on c.oid = tg.tgrelid join pg_namespace n on n.oid = c.relnamespace where not tg.tgisinternal and n.nspname = 'public' order by 1 limit 1;
     execute format('alter table %s disable trigger %I', t.rel, t.tgname); end $$;`, 'triggers', 'public.'],
  ['auth.uid() reading a different claim (exit B Auth bridge drift; schema identical)', `create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`, 'access', 'user:'],
  ['migration history the target lacks', `delete from supabase_migrations.schema_migrations where version = '20261013210000';`, 'migrations', 'supabase_migrations.schema_migrations'],
];
for (const [name, mutation, area, keyPrefix] of DRIFTS) {
  try {
    const drifted = compare(sourceFp, await fingerprint(target, mutation));
    const hit = drifted.result.findings.find((f) => f.severity === 'block' && f.area === area && f.key.startsWith(keyPrefix));
    record(`blocks ${name}`, drifted.exit === 1 && Boolean(hit), hit ? `${hit.key}: ${hit.message}` : JSON.stringify(drifted.result.findings.slice(0, 3)));
  } catch (error) {
    // A drift that cannot even be applied is a broken test, not a pass.
    record(`blocks ${name}`, false, `could not apply: ${error.message}`);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} parity checks passed`);
process.exit(failed ? 1 : 0);
