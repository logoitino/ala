# Books rehearsal on staging (WORK_QUEUE W0-10)

Last updated: 2026-10-13. Owner of the run: the owner (applies SQL), with `CONTROLLER` and `BOOKKEEPER`
for the practice month and `INTERNAL_CONTROLS` for sign-off. Stripe test mode only; $0.

Why now: the owner wants bookkeeping in place at go-live (ROADMAP Wave 1 checklist item 10). Running it
on staging first, while money is fake, finds problems before real donations exist.

## Before you start

- The migration replays cleanly on Postgres: `node scripts/replay/books01-ledger-replay.mjs …` →
  72/72 (2026-10-13, PGlite 0.5.9 / Postgres 18.6, after the security and accounting review fixes).
  See the script header to rerun it.
- Staging must already have `20260929180000_rally_goals_thanks_platform_tip.sql` (recorded applied
  2026-09-30). The migration stops with a clear message if it does not.
- A preview build made **before** 2026-10-12 does not send the covered card fee or the Stripe payment
  id. Steps 1–3 and 5–6 still work; step 4's card-fee row needs a build that includes the 2026-10-12
  checkout change.

## Steps

0. **Security first.** Paste `supabase/migrations/20261013210000_function_access_hardening.sql` before this file: until it is applied, anyone with the public key can write rows into `company_revenue_logs`, which would make any month you close untrustworthy. Check afterwards: `select has_function_privilege('anon', 'public.record_company_revenue(text,text,integer,text,uuid,text,timestamptz)', 'execute');` returns `false`.
1. **Apply.** Supabase dashboard → staging project `tucioqipfejqqqtuakdi` → SQL Editor → paste
   `supabase/migrations/20261012210000_bookkeeping_ledger.sql` → Run. It is safe to run twice.
2. **Check.** Paste the read-only checks below. Every line should match its comment.
3. **Open the hub.** Sign in to the main admin as an admin → Manage desks → Commerce → **Finance &
   Books** (or choose the **Finance** lens). Overview should no longer say "Expenses and closes are
   not switched on".
4. **Make test money.** On a staging build, donate $10 with a `4242 4242 4242 4242` card, tick the card
   fee and choose a 10% tip for Tapua'i. In the hub: Reconcile shows Donations, Optional tips and Card
   fees as Complete; Transactions shows the donation with its channel; Statements shows $1.00 platform
   share, $1.00 optional tip and the covered fee as income and $9.00 held for the family.
5. **Practise a month.** Record & close → record last month's test Stripe fees (Stripe test dashboard →
   Reports → Balance) and one software expense → check Overview has no Stop items → close the month.
6. **Export and import.** Export → QuickBooks journal (daily) and Chart of accounts → import both into
   a free QuickBooks sandbox company (developer.intuit.com) → confirm the journal balances there.
7. **Record evidence** in `docs/agents/BOOKS-01.md` (what ran, counts, anything that failed) and tell
   the CFO; INTERNAL_CONTROLS signs off the practice month.

## Read-only checks (paste after step 1)

```sql
-- 27 accounts
select count(*) as accounts from public.ledger_accounts;

-- 5 ledger tables, RLS on (all true)
select relname, relrowsecurity from pg_class
where relname in ('ledger_accounts', 'ledger_manual_entries', 'ledger_manual_lines', 'ledger_period_closes', 'ledger_period_reopens');

-- clients hold SELECT only (no INSERT / UPDATE / DELETE rows for anon or authenticated)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_name like 'ledger\_%' and grantee in ('anon', 'authenticated') order by 1, 2, 3;

-- 5 ledger RPCs callable by authenticated only; no anon rows; the two helpers have no client rows at all
select routine_name, grantee from information_schema.role_routine_grants
where routine_name in ('record_ledger_entry', 'void_ledger_entry', 'close_ledger_period',
  'reopen_ledger_period', 'get_ledger_books', 'ledger_period_is_closed', 'ledger_lock_period')
  and grantee in ('anon', 'authenticated') order by 1, 2;

-- every definer function pins an empty search_path (7 rows, each with search_path="")
select proname, proconfig from pg_proc
where proname in ('record_ledger_entry', 'void_ledger_entry', 'close_ledger_period', 'reopen_ledger_period',
  'get_ledger_books', 'ledger_period_is_closed', 'ledger_lock_period');

-- payment id unique when present (1 row)
select indexname from pg_indexes where indexname = 'tips_stripe_payment_intent_key';

-- new columns present (3 rows)
select table_name, column_name from information_schema.columns
where (table_name = 'tips' and column_name in ('cover_fee_cents', 'stripe_payment_intent_id'))
   or (table_name = 'disbursements' and column_name = 'paid_at');

-- triggers present (2 rows)
select tgname from pg_trigger where tgname in ('tips_card_fee_revenue_ai', 'disbursements_paid_at_bu');

-- card_fee allowed in the revenue log check
select pg_get_constraintdef(oid) from pg_constraint where conname = 'company_revenue_logs_source_check';
```

A direct SQL Editor session runs as `postgres`, so it counts as admin; denial for a signed-in fan was
proven in the Postgres replay, not on staging. Note any difference here before continuing.
