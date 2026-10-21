#!/usr/bin/env node
/** NOTIFY-01 real local SQL checks for prepared payment attribution and ordered observations; no hosted calls. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { SUPABASE_STUBS } from './supabase-stubs.mjs';

const dist = process.argv[2] || '/tmp/books01-pg/pkg/package/dist';
let PGlite;
try { ({ PGlite } = await import(pathToFileURL(path.resolve(dist, 'index.js')).href)); }
catch { console.error('UNAVAILABLE: local PGlite engine missing; 0 SQL cases executed.'); process.exit(2); }
const db = new PGlite();
await db.exec(SUPABASE_STUBS);
// Focused fixture uses actual API roles/default grants and real PL/pgSQL; broader notification replay owns inbox RLS.
await db.exec('create table public.players(id uuid primary key);');
const migration = 'supabase/migrations/20261021150000_notification_payment_context.sql';
if (!fs.existsSync(migration)) { console.error('RED: payment context migration missing.'); process.exit(1); }
await db.exec(fs.readFileSync(migration, 'utf8'));
const donor = '00000000-0000-0000-0000-000000000001';
const athlete = '00000000-0000-0000-0000-000000000002';
const id = '00000000-0000-0000-0000-000000000003';
await db.query('insert into auth.users(id) values($1)', [donor]);
await db.query('insert into public.players(id) values($1)', [athlete]);
const actor = async (role, sql, args = [], claims = role) => {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: claims, sub: donor })]);
    const result = (await db.query(sql, args)).rows;
    await db.exec('commit'); return result;
  } catch (error) { await db.exec('rollback'); throw error; }
};
const recordSql = 'select public.record_notification_payment_context($1,$2,$3,$4,$5,$6,$7,$8,$9) result';
const recordArgs = [id, 'pi_local', donor, athlete, 500, 100, 50, 'usd', false];
const metadata = { tapuai_context_id: id, tapuai_purpose: 'donation', tapuai_user_id: donor,
  tapuai_player_id: athlete, tapuai_gift_cents: '500', tapuai_cover_fee_cents: '100',
  tapuai_platform_tip_cents: '50', tapuai_notification_authority: 'false' };
const applySql = 'select public.apply_notification_payment_event($1,$2,$3,$4,$5,$6,$7,$8::jsonb) result';
const observe = async (event, kind = 'success', refund = 0, patch = {}, role = 'service_role') =>
  (await actor(role, applySql, [event, 'pi_local', kind, false, 'usd', 650, refund, JSON.stringify({ ...metadata, ...patch })]))[0].result;
const row = async () => (await db.query('select * from public.notification_payment_contexts where id=$1', [id])).rows[0];
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
try {
  for (const role of ['anon', 'authenticated']) await test(`${role} cannot bind or observe payment context`, async () => {
    await assert.rejects(actor(role, recordSql, recordArgs));
    await assert.rejects(observe('evt_denied', 'success', 0, {}, role));
    await assert.rejects(actor(role, 'select * from public.notification_payment_contexts'));
  });
  await test('missing/null service claims fail closed', async () => { await assert.rejects(actor('service_role', recordSql, recordArgs, null)); });
  await test('server binds immutable purpose/actor/athlete/integer allocation with authority false', async () => {
    assert.equal((await actor('service_role', recordSql, recordArgs))[0].result, true);
    assert.equal((await row()).notification_authority, false);
    assert.equal(Number((await row()).total_cents), 650);
    assert.equal((await actor('service_role', recordSql, recordArgs))[0].result, true);
    await assert.rejects(actor('service_role', recordSql, [...recordArgs.slice(0, 4), 501, 100, 50, 'usd', false]));
    await assert.rejects(actor('service_role', "update public.notification_payment_contexts set notification_authority=true"));
  });
  for (const [key, value] of Object.entries({ tapuai_user_id: athlete, tapuai_player_id: donor,
    tapuai_purpose: 'exclusive', tapuai_gift_cents: '501', tapuai_cover_fee_cents: '101',
    tapuai_platform_tip_cents: '51', tapuai_notification_authority: 'true' })) {
    await test(`provider ${key} mismatch creates no event claim`, async () => {
      await assert.rejects(observe(`evt_bad_${key}`, 'success', 0, { [key]: value }));
      assert.equal(Number((await db.query('select count(*) n from public.notification_payment_observations')).rows[0].n), 0);
    });
  }
  await test('failed durable transition rolls back event claim and remains retryable', async () => {
    await db.exec("create function public.fail_payment_observation() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$; create trigger fail_payment before update on public.notification_payment_contexts for each row execute function public.fail_payment_observation();");
    await assert.rejects(observe('evt_success'));
    assert.equal(Number((await db.query('select count(*) n from public.notification_payment_observations')).rows[0].n), 0);
    await db.exec('drop trigger fail_payment on public.notification_payment_contexts; drop function public.fail_payment_observation();');
    assert.equal((await observe('evt_success')).notification, 'unavailable');
    assert.equal((await row()).observation_state, 'succeeded');
  });
  await test('duplicate success does not claim another event or revive later state', async () => {
    await observe('evt_success');
    assert.equal(Number((await db.query('select count(*) n from public.notification_payment_observations')).rows[0].n), 1);
  });
  await test('partial refund cumulative value never double-counts or regresses on reordering', async () => {
    await observe('evt_refund_100', 'refund', 100);
    await observe('evt_refund_100', 'refund', 100);
    await observe('evt_refund_50', 'refund', 50);
    await observe('evt_late_success');
    assert.equal(Number((await row()).refunded_cents), 100);
    assert.equal((await row()).observation_state, 'partially_refunded');
  });
  await test('full refund followed by success cannot revive or create a receipt', async () => {
    await observe('evt_refund_all', 'refund', 650); await observe('evt_success_after_refund');
    assert.equal((await row()).observation_state, 'refunded');
    assert.equal(Number((await row()).refunded_cents), 650);
    assert.equal((await row()).notification_authority, false);
  });
  await test('dispute remains terminal for observations, including reordered success/refund', async () => {
    await observe('evt_dispute', 'dispute'); await observe('evt_success_after_dispute'); await observe('evt_refund_after_dispute', 'refund', 100);
    assert.equal((await row()).observation_state, 'disputed');
    assert.equal(Number((await row()).refunded_cents), 650);
  });
  await test('same provider event with changed meaning fails instead of silently skipping', async () => { await assert.rejects(observe('evt_dispute', 'refund', 100)); });
  await test('non-donation/unmatched context is unavailable and unclaimed', async () => {
    const result = (await actor('service_role', applySql, ['evt_other', 'pi_non_donation', 'success', false, 'usd', 500, 0, '{}']))[0].result;
    assert.equal(result.notification, 'unavailable');
    assert.equal(Number((await db.query("select count(*) n from public.notification_payment_observations where provider_event_id='evt_other'")).rows[0].n), 0);
  });
  console.log(`${passed} SQL cases passed; no business money/Aura/notification writes are implemented.`);
} catch (error) { console.error(`FAIL after ${passed} SQL cases: ${error.message}`); process.exitCode = 1; }
finally { await db.close(); }
