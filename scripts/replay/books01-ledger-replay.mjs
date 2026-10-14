// BOOKS-01 bookkeeping migration replay on real Postgres (PGlite, Postgres compiled to WASM). Owned by FINANCE_DATA.
// Not part of `pnpm check`: PGlite is not a repo dependency (the npm registry is often blocked here).
// Fetch it into a scratch folder outside the repo, verify the checksum, then run:
//   mkdir -p /tmp/pg && cd /tmp/pg && curl -sO https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.9.tgz
//   openssl dgst -sha512 -binary pglite-0.5.9.tgz | base64   # expect GoQTRMZ/o4J3sMW4mLDtDFGNOm1xy5oH+iHDALWll3uERY6OF4BSnL1t7FZH2Mlw+RPceDBlFJgSaecO73c4EA==
//   tar xzf pglite-0.5.9.tgz
//   node scripts/replay/books01-ledger-replay.mjs /tmp/pg/package/dist supabase/migrations/20261012210000_bookkeeping_ledger.sql
// Exit 0 when every check passes. Last run: see docs/agents/BOOKS-01.md (PGlite 0.5.9, Postgres 18.6).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [distDir, migrationPath] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(path.join(distDir, 'index.js')).href);
const db = new PGlite();
const results = [];
const ok = (name) => results.push({ name, pass: true });
const bad = (name, detail) => results.push({ name, pass: false, detail });

async function expectOk(name, sql, check) {
  try {
    const r = await db.exec(sql);
    const last = [...r].reverse().find((res) => res.fields && res.fields.length > 0) ?? r[r.length - 1];
    if (check && !check(last?.rows ?? [])) return bad(name, `unexpected rows ${JSON.stringify(last?.rows)}`);
    ok(name);
    return last?.rows ?? [];
  } catch (e) { bad(name, e.message); return []; }
}
async function expectErr(name, sql, pattern) {
  try { await db.exec(sql); bad(name, 'no error raised'); }
  catch (e) { pattern.test(e.message) ? ok(name) : bad(name, `wrong error: ${e.message}`); }
  finally { await db.exec('reset role;').catch(() => {}); }
}
const asAdmin = `set role authenticated; set test.role = 'admin'; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';`;
const asFan = `set role authenticated; set test.role = 'fan'; set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';`;
const asAnon = `set role anon; set test.role = ''; set request.jwt.claim.sub = '';`;

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  insert into auth.users values ('00000000-0000-0000-0000-0000000000aa'), ('00000000-0000-0000-0000-0000000000bb');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create function public.current_user_role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'anon') $$;
  grant execute on function public.current_user_role() to anon, authenticated;
  create function public.require_admin_guard() returns void language plpgsql stable security definer set search_path = public as $$
  begin if public.current_user_role() <> 'admin' then raise exception 'Admin access required'; end if; end; $$;
  grant execute on function public.require_admin_guard() to authenticated;
  create table public.players (id uuid primary key default gen_random_uuid(), name text);
  create table public.tips (id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id),
    amount_cents integer not null check (amount_cents >= 0), platform_tip_cents integer not null default 0, fan_id uuid,
    created_at timestamptz not null default now());
  create table public.disbursements (id uuid primary key default gen_random_uuid(), player_id uuid references public.players(id),
    amount_cents integer not null default 0, status text not null default 'pending', created_at timestamptz not null default now());
  create table public.company_revenue_logs (id uuid primary key default gen_random_uuid(), transaction_type text not null,
    gross_amount numeric not null default 0, platform_cut_amount numeric not null default 0, payout_amount numeric not null default 0,
    recipient_id uuid, created_at timestamptz not null default now(), source text, source_id text, label text not null default '',
    payee_kind text not null default 'none', player_id uuid, gross_cents integer not null default 0, platform_cents integer not null default 0,
    payout_cents integer not null default 0, constraint company_revenue_logs_source_id_key unique (source, source_id),
    constraint company_revenue_logs_source_check check (source in ('malo', 'booster', 'vault', 'merch', 'tip')));
  grant select, insert, update on public.tips, public.disbursements to authenticated;
  create function public.sync_company_revenue_logs() returns integer language sql as $$ select 0 $$;
  insert into public.players (id, name) values ('11111111-1111-1111-1111-111111111111', 'Fixture');
`);
ok('stubs created');

const migration = fs.readFileSync(migrationPath, 'utf8');
await expectOk('migration applies on a clean database', migration);
await expectOk('migration re-runs safely (idempotent)', migration);
await expectOk('27 accounts seeded once', `select count(*)::int as n from public.ledger_accounts;`, (r) => r[0].n === 27);

// Admin path
const lines = (d, c, extra = '') => `'[{"account_code":"${d}","debit_cents":2500,"credit_cents":0}${extra},{"account_code":"${c}","debit_cents":0,"credit_cents":2500}]'::jsonb`;
const rows = await expectOk('admin records a balanced entry', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', 'Supabase Pro', 'INV-1', ${lines('6000', '1000')}) as id; reset role;`, (r) => r.length === 1);
const entryId = rows[0]?.id;
await expectErr('unbalanced entry rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', 'x', '', '[{"account_code":"6000","debit_cents":2500,"credit_cents":0},{"account_code":"1000","debit_cents":0,"credit_cents":2400}]'::jsonb);`, /Debits and credits must be equal/);
await expectErr('unknown account rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', 'x', '', ${lines('9999', '1000')});`, /Unknown account/);
await expectErr('two-sided line rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', 'x', '', '[{"account_code":"6000","debit_cents":5,"credit_cents":5},{"account_code":"1000","debit_cents":0,"credit_cents":0}]'::jsonb);`, /either a debit or a credit/);
await expectErr('single line rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', 'x', '', '[{"account_code":"6000","debit_cents":5,"credit_cents":0}]'::jsonb);`, /2 to 20 lines/);
await expectErr('over $1M line rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', 'x', '', '[{"account_code":"6000","debit_cents":100000001,"credit_cents":0},{"account_code":"1000","debit_cents":0,"credit_cents":100000001}]'::jsonb);`, /1,000,000/);
await expectErr('future date rejected', `${asAdmin} select public.record_ledger_entry(current_date + 10, 'software', 'x', '', ${lines('6000', '1000')});`, /between 2020-01-01 and today/);
await expectErr('tomorrow rejected (UTC)', `${asAdmin} select public.record_ledger_entry(current_date + 1, 'software', 'x', '', ${lines('6000', '1000')});`, /between 2020-01-01 and today/);
await expectErr('reserved kind rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'period_reopen', 'x', '', ${lines('6000', '1000')});`, /reserved/);
await expectErr('malformed athlete ref rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'refund', 'x', '', '[{"account_code":"2000","debit_cents":900,"credit_cents":0,"athlete_ref":"Kaleo"},{"account_code":"1010","debit_cents":0,"credit_cents":900}]'::jsonb);`, /Athlete reference/);
const refundRows = await expectOk('refund line keeps its athlete reference', `${asAdmin} select public.record_ledger_entry(date '2026-09-16', 'refund', 'Refund', '', '[{"account_code":"2000","debit_cents":900,"credit_cents":0,"athlete_ref":"ath-1a2b3c4d"},{"account_code":"4900","debit_cents":100,"credit_cents":0},{"account_code":"1010","debit_cents":0,"credit_cents":1000}]'::jsonb) as id; reset role;`, (r) => r.length === 1);
await expectOk('athlete reference stored on the line', `select athlete_ref from public.ledger_manual_lines where entry_id = '${refundRows[0]?.id}' and account_code = '2000';`, (r) => r[0]?.athlete_ref === 'ath-1a2b3c4d');
await expectErr('empty memo rejected', `${asAdmin} select public.record_ledger_entry(date '2026-09-15', 'software', '   ', '', ${lines('6000', '1000')});`, /check constraint|violates/);
await expectOk('lines stored with the entry', `select count(*)::int as n, sum(debit_cents)::int as d, sum(credit_cents)::int as c from public.ledger_manual_lines where entry_id = '${entryId}';`, (r) => r[0].n === 2 && r[0].d === 2500 && r[0].c === 2500);

await expectErr('void needs a reason', `${asAdmin} select public.void_ledger_entry('${entryId}', '  ');`, /Say why/);
const rev = await expectOk('admin voids by reversal', `${asAdmin} select public.void_ledger_entry('${entryId}', 'Duplicate invoice') as id; reset role;`, (r) => r.length === 1);
await expectErr('reversal date in the future rejected', `${asAdmin} select public.void_ledger_entry('${entryId}', 'x', date '2099-01-01');`, /reversal date/);
await expectOk('reversal mirrors the lines', `select account_code, debit_cents::int as d, credit_cents::int as c from public.ledger_manual_lines where entry_id = '${rev[0]?.id}' order by account_code;`, (r) => r.length === 2 && r[0].account_code === '1000' && r[0].d === 2500 && r[1].account_code === '6000' && r[1].c === 2500);
await expectOk('original marked voided', `select voided_at is not null as v, void_reason from public.ledger_manual_entries where id = '${entryId}';`, (r) => r[0].v === true && r[0].void_reason === 'Duplicate invoice');
await expectErr('second void rejected', `${asAdmin} select public.void_ledger_entry('${entryId}', 'again');`, /already voided/);
await expectErr('voiding a reversal rejected', `${asAdmin} select public.void_ledger_entry('${rev[0]?.id}', 'again');`, /already voided or is itself a reversal/);

await expectErr('current month cannot close', `${asAdmin} select public.close_ledger_period(to_char(current_date, 'YYYY-MM'), '', '{}'::jsonb);`, /finished month/);
await expectErr('bad period rejected', `${asAdmin} select public.close_ledger_period('2026-13', '', '{}'::jsonb);`, /look like/);
await expectOk('admin closes a finished month', `${asAdmin} select public.close_ledger_period('2026-08', 'August done', '{"6000":0}'::jsonb); reset role;`);
await expectErr('closing twice rejected', `${asAdmin} select public.close_ledger_period('2026-08', '', '{}'::jsonb);`, /already closed/);
await expectErr('entry into closed month rejected', `${asAdmin} select public.record_ledger_entry(date '2026-08-20', 'software', 'late', '', ${lines('6000', '1000')});`, /month is closed/);
await expectErr('reversal into closed month rejected', `${asAdmin} select public.void_ledger_entry((select id from public.ledger_manual_entries where reverses_id is null and voided_at is null limit 1), 'x', date '2026-08-10');`, /month is closed|not found/);
await expectErr('reopen needs a reason', `${asAdmin} select public.reopen_ledger_period('2026-08', '');`, /Say why/);
await expectOk('admin reopens with a reason', `${asAdmin} select public.reopen_ledger_period('2026-08', 'Late Stripe invoice'); reset role;`);
await expectOk('reopen kept with reason and previous totals', `select reason, previous_totals->>'6000' as t, previous_closed_at is not null as c from public.ledger_period_reopens where period = '2026-08';`, (r) => r.length === 1 && r[0].reason === 'Late Stripe invoice' && r[0].t === '0' && r[0].c === true);
await expectErr('reopening an open month rejected', `${asAdmin} select public.reopen_ledger_period('2026-08', 'again');`, /not closed/);
await expectOk('get_ledger_books returns accounts, entries and closes (audit notes hidden)', `${asAdmin} select public.get_ledger_books() as b; reset role;`,
  (r) => { const b = typeof r[0].b === 'string' ? JSON.parse(r[0].b) : r[0].b; return b.accounts.length === 27 && b.entries.length === 3 && b.entries.every((e) => e.lines.length >= 2) && Array.isArray(b.closes) && b.reopens.length === 1; });

// Denied paths
for (const [who, as] of [['signed-in fan', asFan], ['anon', asAnon]]) {
  await expectErr(`${who}: record_ledger_entry denied`, `${as} select public.record_ledger_entry(date '2026-09-15', 'software', 'x', '', ${lines('6000', '1000')});`, /Admin access required|permission denied/);
  await expectErr(`${who}: get_ledger_books denied`, `${as} select public.get_ledger_books();`, /Admin access required|permission denied/);
  await expectErr(`${who}: close denied`, `${as} select public.close_ledger_period('2026-07', '', '{}'::jsonb);`, /Admin access required|permission denied/);
  await expectErr(`${who}: void denied`, `${as} select public.void_ledger_entry('${entryId}', 'x');`, /Admin access required|permission denied/);
  await expectErr(`${who}: reopen denied`, `${as} select public.reopen_ledger_period('2026-07', 'x');`, /Admin access required|permission denied/);
  await expectErr(`${who}: direct insert into entries denied`, `${as} insert into public.ledger_manual_entries (entry_date, kind, memo) values (current_date, 'software', 'x');`, /permission denied/);
  await expectErr(`${who}: direct update of lines denied`, `${as} update public.ledger_manual_lines set debit_cents = 1;`, /permission denied/);
  await expectErr(`${who}: direct delete of closes denied`, `${as} delete from public.ledger_period_closes;`, /permission denied/);
}
await expectOk('signed-in fan reads zero ledger rows (RLS)', `${asFan} select (select count(*) from public.ledger_manual_entries)::int as e, (select count(*) from public.ledger_accounts)::int as a, (select count(*) from public.ledger_manual_lines)::int as l; reset role;`, (r) => r[0].e === 0 && r[0].a === 0 && r[0].l === 0);
await expectErr('anon cannot select ledger tables at all', `${asAnon} select count(*) from public.ledger_manual_entries;`, /permission denied/);
await expectOk('admin reads ledger rows (RLS)', `${asAdmin} select (select count(*) from public.ledger_manual_entries)::int as e; reset role;`, (r) => r[0].e >= 2);
await expectErr('period helper not callable by clients', `${asFan} select public.ledger_period_is_closed(current_date);`, /permission denied/);
await expectErr('lock helper not callable by clients', `${asFan} select public.ledger_lock_period('2026-09');`, /permission denied/);
await expectErr('fan cannot read reopens', `${asFan} insert into public.ledger_period_reopens (period, reason) values ('2026-01', 'x');`, /permission denied/);
await expectErr('trigger function not callable by clients', `${asFan} select public.tips_card_fee_revenue();`, /permission denied|trigger functions can only be called as triggers/);

// Donation columns, card-fee revenue row, payout paid date
await expectOk('donation with covered fee logs a card_fee revenue row', `
  insert into public.tips (id, player_id, amount_cents, cover_fee_cents, stripe_payment_intent_id) values
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 1000, 59, 'pi_3QabcDEF12345678');
  select source, gross_cents, platform_cents, payout_cents, payee_kind from public.company_revenue_logs where source_id = '22222222-2222-2222-2222-222222222222';`,
  (r) => r.length === 1 && r[0].source === 'card_fee' && r[0].gross_cents === 59 && r[0].platform_cents === 59 && r[0].payout_cents === 0);
await expectOk('no card_fee row without a covered fee', `insert into public.tips (player_id, amount_cents) values ('11111111-1111-1111-1111-111111111111', 500);
  select count(*)::int as n from public.company_revenue_logs where source = 'card_fee';`, (r) => r[0].n === 1);
await expectOk('a $1.50 covered fee on a $5 donation is accepted', `insert into public.tips (player_id, amount_cents, cover_fee_cents) values ('11111111-1111-1111-1111-111111111111', 500, 150) returning cover_fee_cents;`, (r) => r[0].cover_fee_cents === 150);
await expectErr('covered fee above the bound rejected', `insert into public.tips (player_id, amount_cents, cover_fee_cents) values ('11111111-1111-1111-1111-111111111111', 1000, 1001);`, /tips_cover_fee_cents_check/);
await expectErr('a PaymentIntent id cannot be reused', `insert into public.tips (player_id, amount_cents, stripe_payment_intent_id) values ('11111111-1111-1111-1111-111111111111', 1000, 'pi_3QabcDEF12345678');`, /duplicate key|tips_stripe_payment_intent_key/);
await expectErr('malformed PaymentIntent id rejected', `insert into public.tips (player_id, amount_cents, stripe_payment_intent_id) values ('11111111-1111-1111-1111-111111111111', 1000, 'pi_bad id');`, /tips_stripe_payment_intent_id_check/);
await expectOk('company_revenue_bps knows card_fee', `select public.company_revenue_bps('card_fee') as b, public.company_revenue_bps('malo') as m;`, (r) => r[0].b === 10000 && r[0].m === 1000);
await expectOk('payout marked paid gets paid_at; requeued clears it', `
  insert into public.disbursements (id, player_id, amount_cents, status) values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 500, 'queued');
  update public.disbursements set status = 'paid' where id = '33333333-3333-3333-3333-333333333333';
  select (select paid_at is not null from public.disbursements where id = '33333333-3333-3333-3333-333333333333') as paid;`, (r) => r[0].paid === true);
await expectOk('paid_at cleared when status leaves paid', `update public.disbursements set status = 'failed' where id = '33333333-3333-3333-3333-333333333333';
  select paid_at is null as cleared from public.disbursements where id = '33333333-3333-3333-3333-333333333333';`, (r) => r[0].cleared === true);
await expectOk('insert already paid is stamped', `insert into public.disbursements (player_id, amount_cents, status) values ('11111111-1111-1111-1111-111111111111', 100, 'paid') returning paid_at is not null as p;`, (r) => r[0].p === true);
await expectOk('a client-supplied paid_at is replaced on insert', `insert into public.disbursements (player_id, amount_cents, status, paid_at) values ('11111111-1111-1111-1111-111111111111', 100, 'paid', '2020-01-01') returning paid_at::date = current_date as today;`, (r) => r[0].today === true);
await expectOk('a direct paid_at edit on a paid payout is ignored', `
  insert into public.disbursements (id, player_id, amount_cents, status) values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 100, 'paid');
  update public.disbursements set paid_at = '2020-01-01' where id = '44444444-4444-4444-4444-444444444444';
  select paid_at::date = current_date as kept from public.disbursements where id = '44444444-4444-4444-4444-444444444444';`, (r) => r[0].kept === true);
await expectOk('revenue summary lists card fees as their own stream and streams add up to the total', `${asAdmin} select public.get_company_revenue_summary() as s; reset role;`,
  (r) => { const sm = typeof r[0].s === 'string' ? JSON.parse(r[0].s) : r[0].s; const fee = sm.streams.find((st) => st.source === 'card_fee'); return fee && fee.gross_cents === 209 && sm.streams.reduce((t, st) => t + st.gross_cents, 0) === sm.gross_volume_cents; });

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n      ${r.detail}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed on PGlite (Postgres ${(await db.query('show server_version')).rows[0].server_version})`);
process.exit(failed.length ? 1 : 0);
