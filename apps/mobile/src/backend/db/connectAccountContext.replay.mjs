#!/usr/bin/env node
/**
 * Local PostgreSQL replay for caller-bound Connect context and conditional persistence.
 * Uses an external PGlite engine and the actual canonical schema; all identities are synthetic.
 * Usage: node apps/mobile/src/backend/db/connectAccountContext.replay.mjs <pglite-dist> [schema.sql]
 * The saved pre-change schema can exercise RED. No provider calls, credentials or hosted database.
 * PGlite has one connection: competing snapshots below test CAS, not concurrent lock scheduling.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { SUPABASE_STUBS } from '../../../../../scripts/replay/supabase-stubs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const [dist, schemaFile = path.join(root, 'apps/mobile/src/backend/db/schema.sql')] = process.argv.slice(2);
if (!dist || !fs.existsSync(path.join(dist, 'index.js'))) {
  console.error('NOT RUN: supply an installed external PGlite dist directory; PostgreSQL execution is required.');
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(dist, 'index.js')).href);
const { pgcrypto } = await import(pathToFileURL(path.join(dist, 'contrib/pgcrypto.js')).href);
const db = new PGlite({ extensions: { pgcrypto } });
const query = async (sql) => (await db.query(sql)).rows;
const scalar = async (sql) => Object.values((await query(sql))[0])[0];
const results = [];
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const G = uid(1), A = uid(2), T = uid(3), O = uid(4), R = uid(5), P = uid(1001), Q = uid(1002);
await db.exec(SUPABASE_STUBS);
await db.exec(fs.readFileSync(schemaFile, 'utf8'));
await db.exec(`insert into auth.users(id) values('${G}'),('${A}'),('${T}'),('${O}'),('${R}');
  update public.profiles set birth_year=1980,birth_month=1,age_check_required=false;
  update public.profiles set role='athlete',roles=array['athlete'] where user_id='${A}';
  update public.profiles set role='parent',roles=array['parent'] where user_id='${G}';
  update public.profiles set role='admin',roles=array['admin'],is_admin=true where user_id in ('${O}','${R}');
  update public.profiles set birth_year=2011,birth_month=1,role='athlete',roles=array['athlete'] where user_id='${T}';`);
const gp = await scalar(`select id from public.profiles where user_id='${G}'`);
const ap = await scalar(`select id from public.profiles where user_id='${A}'`);
const tp = await scalar(`select id from public.profiles where user_id='${T}'`);
const op = await scalar(`select id from public.profiles where user_id='${O}'`);
const rp = await scalar(`select id from public.profiles where user_id='${R}'`);
await db.exec(`insert into public.players(id,name,guardian_id) values('${P}','Synthetic Athlete','${gp}'),('${Q}','Synthetic Other Athlete','${gp}');
  update public.profiles set player_id='${P}',verification_status='verified',is_verified=true where id='${tp}';
  update public.profiles set legal_terms_accepted_at=now() where id in ('${gp}','${ap}');
  update public.profiles set stripe_connect_id='acct_GuardianOwn1' where id='${gp}';
  insert into public.custodial_accounts(player_id,guardian_id,stripe_connect_id) values('${P}','${gp}',null),('${Q}','${gp}','acct_GuardianOther1');
  insert into public.athlete_birthdates(player_id,birth_date,entered_by) values('${P}','2011-01-01','${gp}');`);
const link = await scalar(`insert into public.guardian_links(minor_id,guardian_id,source,confirmed_at) values('${tp}','${gp}','custodial',now()) returning id`);
const consent = await scalar(`insert into public.guardian_consents(link_id,minor_id,guardian_id,form_version,form_sha256,signer_name,relationship,allows_donations,allows_public_profile)
  values('${link}','${tp}','${gp}','synthetic-only','${'0'.repeat(64)}','Synthetic Guardian','legal_guardian',true,false) returning id`);
const relationship = await scalar(`insert into public.payee_verifications(subject_profile_id,player_id,role,method,provider,status,checks,reviewer_id,second_reviewer_id,verified_at)
  values('${gp}','${P}','guardian_payee','school_parent_confirmation','school','verified','{"relationship":true}','${op}','${rp}',now()) returning id`);
await db.exec(`insert into public.payee_verifications(subject_profile_id,role,method,provider,provider_ref,status,checks,verified_at)
  values('${gp}','guardian_payee','stripe_connect_kyc','stripe','acct_GuardianOwn1','verified','{"identity":true,"tin":true}',now()),
        ('${gp}','guardian_payee','stripe_connect_kyc','stripe','acct_GuardianOther1','verified','{"identity":true,"tin":true}',now()),
        ('${gp}','guardian_payee','stripe_connect_kyc','stripe','acct_GuardianPrevious1','verified','{"identity":true,"tin":true}',now());`);
const service = `set role service_role; set request.jwt.claims='{"role":"service_role"}';`;
const context = (actor = G, player = P) => `select public.stripe_connect_context('${actor}',${player ? `'${player}'` : 'null'}) as context`;
const save = (actor = G, player = P, profile = gp, expected = null, account = 'acct_GuardianNew1') =>
  `select public.save_stripe_connect_account('${actor}',${player ? `'${player}'` : 'null'},'${profile}',${expected === null ? 'null' : `'${expected}'`},'${account}',true,true)`;
async function check(name, run) {
  await db.exec('begin;');
  try { await run(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, detail: error.message }); }
  finally { await db.exec('rollback; reset role; reset request.jwt.claims;'); }
}
async function denied(sql, code = '42501') {
  await db.exec('savepoint denied_probe;');
  let error;
  try { await db.exec(sql); } catch (caught) { error = caught; }
  await db.exec('rollback to savepoint denied_probe;');
  assert.ok(error, 'operation unexpectedly succeeded');
  assert.equal(error.code, code);
}
await check('adult athlete own-profile context', async () => {
  await db.exec(service); const c = (await query(context(A, null)))[0].context;
  assert.equal(c.id, ap); assert.equal(c.target_kind, 'self'); assert.equal(c.owner_user_id, A);
});
await check('guardian context uses custodial binding, never own-profile account', async () => {
  await db.exec(service); const c = (await query(context()))[0].context;
  assert.equal(c.id, gp); assert.equal(c.stripe_connect_id, null); assert.equal(c.target_kind, 'guardian');
  assert.equal(c.target_player_id, P);
});
await check('guardian save writes no own-profile flags and keeps other-account KYC', async () => {
  await db.exec(service); assert.equal(await scalar(save()), 'acct_GuardianNew1');
  assert.equal(await scalar(`select stripe_connect_id from public.profiles where id='${gp}'`), 'acct_GuardianOwn1');
  assert.equal(await scalar(`select payouts_enabled from public.profiles where id='${gp}'`), false);
  assert.equal(await scalar(`select stripe_connect_id from public.custodial_accounts where player_id='${P}'`), 'acct_GuardianNew1');
  assert.equal(await scalar(`select count(*)::int from public.payee_verifications where method='stripe_connect_kyc' and status='verified'`), 3);
});
await check('old account supersession preserves other guardian accounts', async () => {
  await db.exec(`update public.custodial_accounts set stripe_connect_id='acct_GuardianPrevious1' where player_id='${P}';
    update public.custodial_accounts set stripe_connect_id='acct_GuardianReplacement1' where player_id='${P}';`);
  assert.equal(await scalar(`select status from public.payee_verifications where provider_ref='acct_GuardianPrevious1'`), 'superseded');
  assert.equal(await scalar(`select status from public.payee_verifications where provider_ref='acct_GuardianOther1'`), 'verified');
});
await check('own-profile binding supersedes only old nonnull account', async () => {
  await db.exec(`update public.profiles set stripe_connect_id='acct_GuardianOwnNew1' where id='${gp}'`);
  assert.equal(await scalar(`select status from public.payee_verifications where provider_ref='acct_GuardianOwn1'`), 'superseded');
  assert.equal(await scalar(`select status from public.payee_verifications where provider_ref='acct_GuardianOther1'`), 'verified');
});
for (const [name, mutation] of [
  ['blocked guardian', `update public.profiles set age_blocked_at=now() where id='${gp}'`],
  ['minor guardian', `update public.profiles set birth_year=2011 where id='${gp}'`],
  ['unknown guardian age', `update public.profiles set birth_year=null,birth_month=null where id='${gp}'`],
  ['changed guardian on record', `update public.players set guardian_id='${op}' where id='${P}'`],
  ['missing custodial record', `delete from public.custodial_accounts where player_id='${P}'`],
  ['missing birth date', `delete from public.athlete_birthdates where player_id='${P}'`],
  ['handover reached', `update public.athlete_birthdates set birth_date='2000-01-01' where player_id='${P}'`],
  ['unverified athlete', `update public.profiles set verification_status='unverified',is_verified=false where id='${tp}'`],
  ['unconfirmed guardian link', `update public.guardian_links set confirmed_at=null where id='${link}'`],
  ['ended guardian link', `update public.guardian_links set ended_at=now() where id='${link}'`],
  ['revoked consent', `update public.guardian_consents set revoked_at=now() where id='${consent}'`],
  ['relationship revoked', `update public.payee_verifications set status='revoked' where id='${relationship}'`],
  ['disputed athlete claim', `insert into public.verification_requests(player_id,full_name,status,requester_user_id) values('${P}','Synthetic Dispute','disputed','${tp}')`],
]) await check(name, async () => { await db.exec(mutation); await db.exec(service); await denied(context()); await denied(save()); });
for (const status of ['failed', 'revoked', 'pending']) await check(`latest ${status} relationship cannot borrow an older pass`, async () => {
  await db.exec(`insert into public.payee_verifications(subject_profile_id,player_id,role,method,provider,status,checks,created_at)
    values('${gp}','${P}','guardian_payee','document_review','support','${status}','{"relationship":false}',now()+interval '1 second')`);
  await db.exec(service); await denied(context()); await denied(save());
});
await check('latest expired relationship cannot borrow older verification', async () => {
  await db.exec(`insert into public.payee_verifications(subject_profile_id,player_id,role,method,provider,status,checks,reviewer_id,second_reviewer_id,verified_at,expires_at,created_at)
    values('${gp}','${P}','guardian_payee','document_review','support','verified','{"relationship":true}','${op}','${rp}',now()-interval '2 days',now()-interval '1 day',now()+interval '1 second')`);
  await db.exec(service); await denied(context()); await denied(save());
});
await check('minor cannot bypass guardian route by omitting playerId', async () => { await db.exec(service); await denied(context(T, null)); });
await check('adult athlete cannot bypass configured 21-year custodial handover', async () => {
  await db.exec(`update public.profiles set player_id=null,verification_status='unverified',is_verified=false where id='${tp}';
    update public.profiles set player_id='${P}',verification_status='verified',is_verified=true where id='${ap}';
    update public.athlete_birthdates set birth_date=current_date-interval '19 years' where player_id='${P}';
    update public.custodial_accounts set handover_age=21 where player_id='${P}';`);
  await db.exec(service); await denied(context(A, null)); await denied(save(A, null, ap, null, 'acct_AdultBeforeHandover1'));
});
await check('fan/admin roles do not impersonate adult athlete', async () => { await db.exec(service); await denied(context(O, null)); });
await check('unrelated adult cannot request another guardian account', async () => { await db.exec(service); await denied(context(A, P)); });
await check('guardian cannot reuse own profile or another athlete account', async () => {
  await db.exec(service); await denied(save(G, P, gp, null, 'acct_GuardianOwn1'), '23505');
  await denied(save(G, P, gp, null, 'acct_GuardianOther1'), '23505');
});
await check('captured profile and exact binding CAS refuse stale saves', async () => {
  await db.exec(service); await denied(save(G, P, ap), '40001');
  await scalar(save()); await denied(save(G, P, gp, null, 'acct_GuardianSecond1'), '40001');
  assert.equal(await scalar(save(G, P, gp, 'acct_GuardianNew1')), 'acct_GuardianNew1');
  await denied(save(G, P, gp, 'acct_GuardianNew1', 'acct_GuardianReplacement1'), '40001');
});
await check('exact captured padded binding permits benign trimmed retrieval normalization', async () => {
  await db.exec(`update public.custodial_accounts set stripe_connect_id=' acct_GuardianNew1 ' where player_id='${P}'`);
  await db.exec(service); assert.equal((await query(context()))[0].context.stripe_connect_id, ' acct_GuardianNew1 ');
  assert.equal(await scalar(save(G, P, gp, ' acct_GuardianNew1 ')), 'acct_GuardianNew1');
});
await check('legacy padded other binding still prevents cross-athlete reuse', async () => {
  await db.exec(`update public.custodial_accounts set stripe_connect_id=' acct_GuardianOther1 ' where player_id='${Q}'`);
  await db.exec(service); await denied(save(G, P, gp, null, 'acct_GuardianOther1'), '23505');
});
await check('consent revoked after context load refuses save', async () => {
  await db.exec(service); await query(context()); await db.exec('reset role; reset request.jwt.claims;');
  await db.exec(`update public.guardian_consents set revoked_at=now() where id='${consent}';`);
  await db.exec(service); await denied(save());
});
await check('self-account save persists flags and cannot reuse custodial account', async () => {
  await db.exec(service); await denied(save(A, null, ap, null, 'acct_GuardianOther1'), '23505');
  assert.equal(await scalar(save(A, null, ap, null, 'acct_AdultOwnNew1')), 'acct_AdultOwnNew1');
  assert.equal(await scalar(`select stripe_onboarding_complete from public.profiles where id='${ap}'`), true);
  await denied(save(A, null, ap, 'acct_AdultOwnNew1', 'acct_GuardianOther1'), '40001');
});
await check('first save requires Terms and rejects incomplete provider fields', async () => {
  await db.exec(`update public.profiles set legal_terms_accepted_at=null where id='${gp}'`);
  await db.exec(service); await denied(save());
  await denied(`select public.save_stripe_connect_account('${G}','${P}','${gp}',null,'bad-id',true,true)`, '22023');
  await denied(`select public.save_stripe_connect_account('${G}','${P}','${gp}',null,'acct_GuardianNew1',null,true)`, '22023');
});
for (const who of ['anon', 'authenticated']) await check(`${who} cannot call context or save despite forged service claims`, async () => {
  await db.exec(`set role ${who}; set request.jwt.claims='{"role":"service_role","sub":"${G}"}';`);
  await denied(context()); await denied(save());
});
for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}${result.detail ? `: ${result.detail}` : ''}`);
console.log(`${results.filter((r) => r.pass).length}/${results.length} checks PASS; single-connection replay, concurrency not verified.`);
await db.close();
process.exitCode = results.every((r) => r.pass) ? 0 : 1;
