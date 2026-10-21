#!/usr/bin/env node
/**
 * REDUNDANCY-01 local restore drill with the real PostgreSQL client tools: pg_dump → reviewed list → pg_restore → parity.
 *
 *   node infrastructure/migration/local-drill.mjs <postgres client bin dir> <pglite dist dir> <pglite-socket dist dir>
 *
 * Servers are two PGlite instances (PostgreSQL 18 in WebAssembly) exposed on 127.0.0.1 through pglite-socket, so
 * the unmodified psql / pg_dump / pg_restore binaries talk to them over the normal wire protocol. (A native
 * PostgreSQL server needs System V shared memory, which this Mac's policy blocks.) The "source" gets the Supabase
 * stubs, the canonical schema.sql and the synthetic seed; the "target" gets only what a fresh Supabase stack has
 * (roles, service schemas, pgcrypto, the realtime publication). Then, with the commands the recovery tools use:
 *
 *   1. parity.py fingerprint on the source (psql, one read-only snapshot) and on the bare target stack
 *   2. pg_dump --format=custom (plus --inserts, see below), pg_restore --list (as backup.py)
 *   3. toc_review.py with both fingerprints: refused without Auth rows; proposed with --include-auth-data
 *   4. pg_restore --single-transaction --no-owner --exit-on-error --use-list  (as restore.py)
 *   5. bucket rows copied as a stand-in for restore.py --storage (no Storage API here)
 *   6. parity.py compare on the raw restore: must BLOCK, because the stack's default privileges hand anon /
 *      authenticated rights back that the source had revoked (pg_dump only records changes from PostgreSQL's
 *      built-in default)
 *   7. parity.py grant-sync → psql, then fingerprint and compare again        (must PASS)
 *   8. one policy dropped on the target                                       (must be BLOCKED)
 *
 * Synthetic data only; no hosted database, provider or credential. The target is PGlite with stubs, not the pinned
 * Supabase images, so this proves the tools and the procedure, not Auth/Storage service compatibility. PGlite and
 * pglite-socket are fetched outside the repo; they are not dependencies.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from '../../scripts/replay/supabase-stubs.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const [bin, pgliteDist, socketDist] = process.argv.slice(2);
if (!bin || !pgliteDist || !socketDist || !fs.existsSync(path.join(bin, 'pg_dump'))) {
  console.error('usage: node infrastructure/migration/local-drill.mjs <postgres client bin dir> <pglite dist dir> <pglite-socket dist dir>');
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(pgliteDist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(pgliteDist, 'contrib', 'pgcrypto.js')).href);
const { PGLiteSocketServer } = await import(pathToFileURL(path.join(socketDist, 'index.js')).href);

const tool = (name) => path.join(bin, name);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tapuai-drill-'));
fs.chmodSync(work, 0o700);
const results = [];
const record = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };
const servers = [];
// pg_restore --exit-on-error drops its connection abruptly; the socket server must not take the drill down with it.
process.on('uncaughtException', (error) => { if (error.code !== 'ECONNRESET') throw error; });

async function server(name, setup) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(setup);
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 });
  await socket.start();
  servers.push(socket);
  const env = { PGHOST: '127.0.0.1', PGPORT: String(socket.port), PGDATABASE: 'postgres', PGUSER: 'postgres' };
  const envFile = path.join(work, `${name}.env`);
  fs.writeFileSync(envFile, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  return { name, db, envFile, env: { ...process.env, ...env, PATH: `${bin}:${process.env.PATH}` } };
}

/** Run a command; resolve with { status, stdout, stderr } instead of throwing, so each step can be recorded. */
async function sh(file, args, env) {
  try {
    const { stdout, stderr } = await run(file, args, { env, maxBuffer: 256 * 1024 * 1024, encoding: 'buffer' });
    return { status: 0, stdout, stderr: stderr.toString() };
  } catch (error) {
    return { status: error.code ?? 1, stdout: error.stdout ?? Buffer.alloc(0), stderr: String(error.stderr ?? error.message) };
  }
}
const py = (script, args, env = process.env) => sh('python3', [path.join(here, script), ...args], env);
const text = (r) => `${r.stdout.toString()}${r.stderr}`.trim();

try {
  const schema = fs.readFileSync(path.join(root, 'apps/mobile/src/backend/db/schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.join(here, 'fixtures/synthetic-seed.sql'), 'utf8');
  const source = await server('source', `${SUPABASE_STUBS}\n${schema}\n${seed}`);
  // A fresh Supabase stack: its roles, service schemas, extensions and publication, but no application schema.
  const target = await server('target', `${SUPABASE_STUBS}\ncreate extension if not exists pgcrypto;`);
  record('source built from schema.sql and seeded; target is a bare stack', true, `ports ${source.env.PGPORT} / ${target.env.PGPORT}`);

  const sourceFp = path.join(work, 'source.json');
  let r = await py('parity.py', ['fingerprint', '--env-file', source.envFile, '--out', sourceFp], source.env);
  record('psql fingerprint of the source (one read-only snapshot)', r.status === 0, text(r).slice(0, 300));

  const dump = path.join(work, 'database.dump');
  const toc = path.join(work, 'database.toc');
  // backup.py's dump plus --inserts: pglite-socket cannot stream COPY FROM STDIN, so rows travel as INSERTs.
  // The TOC (what the reviewed list selects) is the same; a native target restores backup.py's COPY dump.
  r = await sh(tool('pg_dump'), ['--no-password', '--format=custom', '--inserts', '--rows-per-insert=500', '--file', dump], source.env);
  if (r.status !== 0) throw new Error(`pg_dump failed: ${r.stderr.trim().slice(-400)}`);
  r = await sh(tool('pg_restore'), ['--list', dump], source.env);
  fs.writeFileSync(toc, r.stdout, { mode: 0o600 });
  const entries = fs.readFileSync(toc, 'utf8').split('\n').filter((l) => /^\d+;/.test(l)).length;
  record('pg_dump custom archive and its TOC', r.status === 0 && entries > 0, `${(fs.statSync(dump).size / 1024).toFixed(0)} KiB, ${entries} TOC entries`);

  // What the bare stack already provides, taken before anything is restored into it.
  const bareFp = path.join(work, 'target-bare.json');
  r = await py('parity.py', ['fingerprint', '--env-file', target.envFile, '--out', bareFp], target.env);
  record('psql fingerprint of the bare target stack (before restore)', r.status === 0, text(r).slice(0, 300));

  r = await py('toc_review.py', ['--toc', toc, '--out', path.join(work, 'no-auth.list'), '--source-fingerprint', sourceFp, '--target-fingerprint', bareFp]);
  record('proposal without Auth rows is refused (public tables reference auth.users)', r.status === 1, (r.stderr.match(/[^\n]*references Auth[^\n]*/) || [''])[0].slice(0, 180));

  const list = path.join(work, 'reviewed.list');
  const reviewReport = path.join(work, 'review.md');
  r = await py('toc_review.py', ['--toc', toc, '--out', list, '--include-auth-data', '--source-fingerprint', sourceFp, '--target-fingerprint', bareFp, '--report', reviewReport]);
  record('restore list proposed and cross-checked against every source table', r.status === 0 || r.status === 2, text(r).slice(0, 300));
  if (fs.existsSync(reviewReport)) {
    const pending = fs.readFileSync(reviewReport, 'utf8').split('\n').filter((l) => l.startsWith('- `'));
    if (pending.length) console.log(`      left commented for review (${pending.length}):\n${pending.map((l) => `        ${l}`).join('\n')}`);
  }

  // restore.py's exact pg_restore flags. Review items stay commented out, as in an unreviewed proposal.
  r = await sh(tool('pg_restore'), ['--no-password', '--exit-on-error', '--single-transaction', '--no-owner', '--use-list', list, '--dbname', 'postgres', dump], target.env);
  record('pg_restore with the reviewed list (single transaction, no owner, exit on error)', r.status === 0, r.stderr.trim().split('\n').slice(-3).join(' ').slice(0, 400));

  // Stand-in for restore.py --storage: the Storage API recreates bucket rows (and objects; the seed has none).
  const buckets = (await source.db.query(`select coalesce(array_agg(b::text), '{}') as r from storage.buckets b`)).rows[0].r;
  if (buckets.length) await target.db.query(`insert into storage.buckets select (r::storage.buckets).* from unnest($1::text[]) r`, [buckets]);

  const restoredFp = path.join(work, 'target-restored.json');
  r = await py('parity.py', ['fingerprint', '--env-file', target.envFile, '--out', restoredFp], target.env);
  record('psql fingerprint of the restored target', r.status === 0, text(r).slice(0, 300));
  r = await py('parity.py', ['compare', sourceFp, restoredFp]);
  const reopened = (r.stdout.toString().match(/\| (grants|execute) \|[^\n]*only on target \(changes what guests/g) || []).length;
  record('parity blocks the raw restore: the stack\'s default privileges reopened revoked grants', r.status === 1 && reopened > 0,
    `${reopened} anon/authenticated/PUBLIC rights the source did not have are on the target (e.g. ${(r.stdout.toString().match(/\| grants \| `[^`]*` \| grant anon[^|]*/) || [''])[0].replace(/\| grants \| /, '')})`);

  // grant-sync: reviewable SQL that makes target privileges exactly the source's, then applied with psql.
  const grants = path.join(work, 'grants.sql');
  r = await py('parity.py', ['grant-sync', sourceFp, restoredFp, '--out', grants]);
  const applied = await sh(tool('psql'), ['--no-psqlrc', '--quiet', '-v', 'ON_ERROR_STOP=1', '--file', grants], target.env);
  record('grant-sync generated and applied (privileges only, one transaction)', r.status === 0 && applied.status === 0, `${text(r)} ${applied.stderr.trim().slice(0, 200)}`);

  const targetFp = path.join(work, 'target.json');
  r = await py('parity.py', ['fingerprint', '--env-file', target.envFile, '--out', targetFp], target.env);
  const parityReport = path.join(work, 'parity.md');
  r = await py('parity.py', ['compare', sourceFp, targetFp, '--report', parityReport]);
  const rows = r.stdout.toString().split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Area') && !l.startsWith('| ---'));
  record('restored target matches the source (parity PASS)', r.status === 0,
    r.status === 0 ? `${(r.stdout.toString().match(/\*\*PASS\*\*[^\n]*/) || [''])[0]}${rows.length ? ` · warnings: ${rows.slice(0, 4).join(' / ')}` : ''}` : rows.slice(0, 10).join(' / '));

  await target.db.exec(`do $$ declare p record; begin select polname, format('%I.%I', n.nspname, c.relname) as rel into p from pg_policy
    join pg_class c on c.oid = polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' order by 1 limit 1;
    execute format('drop policy %I on %s', p.polname, p.rel); end $$;`);
  const bad = path.join(work, 'target-bad.json');
  await py('parity.py', ['fingerprint', '--env-file', target.envFile, '--out', bad], target.env);
  r = await py('parity.py', ['compare', sourceFp, bad]);
  record('a restore missing one policy is blocked', r.status === 1 && /\| policies \|/.test(r.stdout.toString()), (r.stdout.toString().match(/\| policies \|[^\n]*/) || [''])[0]);
} catch (error) {
  record('drill ran to completion', false, error.message.slice(0, 500));
} finally {
  for (const s of servers) await s.stop().catch(() => {});
  // TAPUAI_DRILL_KEEP=1 keeps the synthetic dump, TOC, lists and reports for inspection (still a private temp folder).
  if (process.env.TAPUAI_DRILL_KEEP === '1') console.log(`kept ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} drill steps passed`);
process.exit(failed ? 1 : 0);
