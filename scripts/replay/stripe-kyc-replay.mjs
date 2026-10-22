#!/usr/bin/env node
/** Replay 20261022140000 on the canonical schema: before it every repeated Stripe status poll appends a new KYC record;
 * after it an identical answer is a no-op, a real change still supersedes, and clients still cannot record.
 * Usage: stripe-kyc-replay.mjs <pglite dist>. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';
const [dist] = process.argv.slice(2);
if (!dist) { console.error('usage: stripe-kyc-replay.mjs <pglite dist>'); process.exit(2); }
const migration = fs.readFileSync('supabase/migrations/20261022140000_record_stripe_kyc_dedupe.sql', 'utf8');
const { PGlite } = await import(pathToFileURL(path.join(path.resolve(dist), 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(path.resolve(dist), 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync('apps/mobile/src/backend/db/schema.sql', 'utf8').replace(migration, ''));
const A = '00000000-0000-4000-8000-0000000000a5', B = '00000000-0000-4000-8000-0000000000b5';
await db.exec(`insert into auth.users(id, raw_user_meta_data) values ('${A}','{"birth_year":1990,"birth_month":1}'),('${B}','{"birth_year":1990,"birth_month":1}');
  update public.profiles set stripe_connect_id = 'acct_replaykyc01' where user_id = '${A}';
  update public.profiles set stripe_connect_id = 'acct_replaykyc02' where user_id = '${B}';`);
const rows = async (sql) => (await db.query(sql)).rows;
// Baseline polls use account 01 (old body); everything after the migration uses account 02.
let acct = 'acct_replaykyc01';
const kyc = (identity, tin, bank = true, due = false) => db.query(`select public.record_stripe_kyc('${acct}', ${identity}, ${tin}, ${bank}, ${due}) as id`).then((r) => r.rows[0].id);
const history = () => rows(`select status, checks, superseded_at is null as current from public.payee_verifications where provider_ref = '${acct}' order by created_at, id`);
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail: JSON.stringify(detail) });

await kyc(true, true); await kyc(true, true); await kyc(true, true);
check('baseline: three identical polls append three records', (await history()).length === 3, await history());
await db.exec(migration); await db.exec(migration); // idempotent
acct = 'acct_replaykyc02';

const first = await kyc(true, false);
const again = await kyc(true, false);
let h = (await history()).filter((x) => x.current);
check('a repeated identical answer returns the same record and adds none', first === again && h.length === 1 && h[0].status === 'pending', h);
const verified = await kyc(true, true);
h = await history();
check('a real change supersedes once and leaves one current verified record', verified !== first && h.filter((x) => x.current).length === 1 && h.filter((x) => x.current)[0].status === 'verified', h);
await kyc(true, true); await kyc(true, true);
check('repeat polls of a verified account keep it verified with no new history', (await history()).filter((x) => x.current && x.status === 'verified').length === 1, await history());
await kyc(false, false, true, true);
h = (await history()).filter((x) => x.current);
check("Stripe's own downgrade is still recorded", h.length === 1 && h[0].status === 'requires_input', h);
const flag = await rows(`select payouts_enabled from public.profiles where user_id = '${B}'`);
check('the payout capability flag follows the recorded answer', flag[0]?.payouts_enabled === true, flag);
await db.exec(`set role authenticated; set request.jwt.claims='{"role":"authenticated","sub":"${B}"}';`);
const forged = await kyc(true, true).then(() => 'recorded', (e) => e.message);
await db.exec('reset role; reset request.jwt.claims;');
check('the account owner cannot record their own KYC result', /permission denied|Only the server/.test(forged), forged);
const unknown = await db.query(`select public.record_stripe_kyc('acct_replaynone1', true, true, true)`).then(() => 'recorded', (e) => e.message);
check('an unbound account id is refused', /Unknown Connect account/.test(unknown), unknown);
await db.close();
for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.name}${x.pass ? '' : ` — ${x.detail}`}`);
const failed = results.filter((x) => !x.pass).length;
console.log(`stripe-kyc replay: ${results.length - failed}/${results.length} passed; LOCAL ONLY`);
process.exit(failed ? 1 : 0);
