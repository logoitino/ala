-- Books (BOOKS-01): chart of accounts, hand-entered journal entries, month closes, and the three
-- money facts the revenue log was missing.
--
-- Purpose
--   The admin Books desk (`/admin/books`) builds a double-entry journal from the money tables the app
--   already writes (company_revenue_logs, disbursements). This file adds what cannot be derived:
--   1. ledger_accounts — the chart of accounts, seeded. Codes match CHART_OF_ACCOUNTS in
--      packages/shared-types/admin/bookkeeping.ts (a unit test compares them).
--   2. ledger_manual_entries + ledger_manual_lines — expenses, Stripe fees, Stripe payouts to the bank,
--      owner contributions/draws and corrections. Written only through record_ledger_entry, which
--      checks the entry balances, every account exists, and the month is open. Never edited or
--      deleted: void_ledger_entry posts a reversing entry.
--   3. ledger_period_closes — closing a month stores its per-account totals so the desk can tell
--      when a source row in a closed month changes later. Hand-entered entries cannot be dated into
--      a closed month; a per-month advisory lock serializes close, record, void and reopen.
--      ledger_period_reopens keeps every reopen with its reason and the totals it replaced.
--   4. tips.cover_fee_cents — the card fee a donor chose to cover. It is charged today but recorded
--      nowhere, so Stripe deposits cannot match the books. Logged as its own revenue row
--      (source 'card_fee', 100% Tapua'i), like the optional tip to Tapua'i.
--   5. tips.stripe_payment_intent_id — lets a Stripe payout be matched to the donations inside it
--      (unique when present).
--   6. disbursements.paid_at — owned by the server: set when a payout becomes paid, never taken from a
--      client, so a payout cannot be backdated into a closed month.
--   7. get_company_revenue_summary lists card fees as their own stream.
--   Reviewed 2026-10-13 by RLS_SECURITY (search_path '', locks, paid_at ownership, unique payment id,
--   reserved kinds) and CONTROLLER/TAX (manual lines carry an athlete reference for refunds and payouts).
--   No money moves. No change to who can donate, the 90 / 10 split, or the optional tip.
--
-- Owner: BOOKS-01 (2026-10-12, owner asked for bookkeeping, tax preparation and accounting export).
--   Design: docs/engineering/design/BOOKKEEPING.md.
--
-- Dependencies: public.require_admin_guard(), public.current_user_role(), public.tips,
--   public.disbursements, public.company_revenue_logs with the 'tip' source
--   (20260929180000_rally_goals_thanks_platform_tip.sql), public.record_company_revenue.
--   The pre-flight block stops with a clear message if the 'tip' source migration is missing.
--
-- Security: every new table has RLS on with an admin-only SELECT policy and no client write grant.
--   Writes go through security definer RPCs that call require_admin_guard() first. EXECUTE is
--   revoked from public and anon and granted to authenticated. The new tips columns are written by
--   the donor's own insert, like platform_tip_cents; cover_fee_cents is bounded by a CHECK.
--
-- Safe to re-run: if not exists / create or replace / on conflict do nothing throughout.
--
-- Applied: written 2026-10-12, not applied anywhere. Never parsed by Postgres.
--
-- Rollback:
--   drop trigger if exists tips_card_fee_revenue_ai on public.tips;
--   drop trigger if exists disbursements_paid_at_bu on public.disbursements;
--   drop function if exists public.tips_card_fee_revenue(), public.disbursements_paid_at(),
--     public.record_ledger_entry(date, text, text, text, jsonb), public.void_ledger_entry(uuid, text, date),
--     public.close_ledger_period(text, text, jsonb), public.reopen_ledger_period(text, text),
--     public.get_ledger_books(), public.ledger_period_is_closed(date), public.ledger_lock_period(text);
--   drop table if exists public.ledger_manual_lines, public.ledger_manual_entries,
--     public.ledger_period_closes, public.ledger_period_reopens, public.ledger_accounts;
--   drop index if exists public.tips_stripe_payment_intent_key;
--   (card_fee revenue rows must be deleted or reclassified before the source check can drop 'card_fee';
--   restore get_company_revenue_summary from 20260929180000.)
--   alter table public.tips drop column if exists cover_fee_cents, drop column if exists stripe_payment_intent_id;
--   alter table public.disbursements drop column if exists paid_at;
--   (then restore company_revenue_bps and the company_revenue_logs source check without 'card_fee').

do $$
begin
  if to_regprocedure('public.require_admin_guard()') is null then
    raise exception 'Apply the 2026-09 audit section of schema.sql first (require_admin_guard is missing).';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tips' and column_name = 'platform_tip_cents'
  ) then
    raise exception 'Apply 20260929180000_rally_goals_thanks_platform_tip.sql first (tips.platform_tip_cents is missing).';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Chart of accounts
-- ---------------------------------------------------------------------------------------------

create table if not exists public.ledger_accounts (
  code text primary key check (code ~ '^\d{4}$'),
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.ledger_accounts (code, name, account_type) values
  ('1000', 'Business bank account', 'asset'),
  ('1010', 'Stripe balance', 'asset'),
  ('1999', 'Suspense (needs review)', 'asset'),
  ('2000', 'Donations held for families', 'liability'),
  ('2010', 'Vault earnings held for athletes', 'liability'),
  ('2100', 'Booster operator payable', 'liability'),
  ('2200', 'Sales tax payable', 'liability'),
  ('2300', 'Owed to owner (expenses paid personally)', 'liability'),
  ('3000', 'Owner contributions', 'equity'),
  ('3100', 'Owner draws', 'equity'),
  ('4000', 'Platform share of donations', 'revenue'),
  ('4010', 'Optional tips to Tapua''i', 'revenue'),
  ('4020', 'Vault platform share', 'revenue'),
  ('4030', 'Booster sponsorship share', 'revenue'),
  ('4040', 'Drip merchandise sales', 'revenue'),
  ('4050', 'Card fees covered by donors', 'revenue'),
  ('4900', 'Refunds and chargebacks', 'revenue'),
  ('5000', 'Card processing fees', 'expense'),
  ('5010', 'Merchandise cost', 'expense'),
  ('6000', 'Software and hosting', 'expense'),
  ('6010', 'App store and developer fees', 'expense'),
  ('6020', 'Legal and professional', 'expense'),
  ('6030', 'Marketing and advertising', 'expense'),
  ('6040', 'Filmer rewards (paid by Tapua''i)', 'expense'),
  ('6050', 'Game-day operator fees', 'expense'),
  ('6090', 'Other business expenses', 'expense'),
  ('6100', 'Bank fees', 'expense')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Hand-entered entries and month closes
-- ---------------------------------------------------------------------------------------------

create table if not exists public.ledger_period_closes (
  period text primary key check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null,
  note text not null default '' check (char_length(note) <= 200),
  totals jsonb not null default '{}'::jsonb
);

-- Every reopen is kept with its reason and the totals the month had when it was closed.
create table if not exists public.ledger_period_reopens (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  reopened_at timestamptz not null default now(),
  reopened_by uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  previous_closed_at timestamptz,
  previous_totals jsonb not null default '{}'::jsonb
);

create table if not exists public.ledger_manual_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  kind text not null check (kind ~ '^[a-z_]{2,40}$'),
  memo text not null check (char_length(btrim(memo)) between 1 and 200),
  reference text not null default '' check (char_length(reference) <= 120),
  reverses_id uuid references public.ledger_manual_entries (id) on delete restrict,
  voided_at timestamptz,
  void_reason text not null default '' check (char_length(void_reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists ledger_manual_entries_one_reversal_idx
  on public.ledger_manual_entries (reverses_id) where reverses_id is not null;
create index if not exists ledger_manual_entries_date_idx on public.ledger_manual_entries (entry_date);

-- athlete_ref is the pseudonymous reference (ath-xxxxxxxx) the books use, so a refund or payout
-- recorded by hand reduces the right athlete's held balance.
create table if not exists public.ledger_manual_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.ledger_manual_entries (id) on delete restrict,
  account_code text not null references public.ledger_accounts (code),
  debit_cents bigint not null default 0 check (debit_cents >= 0),
  credit_cents bigint not null default 0 check (credit_cents >= 0),
  memo text not null default '' check (char_length(memo) <= 200),
  athlete_ref text check (athlete_ref is null or athlete_ref ~ '^ath-[0-9a-f]{8}$'),
  check ((debit_cents > 0) <> (credit_cents > 0))
);

create index if not exists ledger_manual_lines_entry_idx on public.ledger_manual_lines (entry_id);

alter table public.ledger_accounts enable row level security;
alter table public.ledger_period_closes enable row level security;
alter table public.ledger_period_reopens enable row level security;
alter table public.ledger_manual_entries enable row level security;
alter table public.ledger_manual_lines enable row level security;

drop policy if exists "Admin read ledger accounts" on public.ledger_accounts;
create policy "Admin read ledger accounts" on public.ledger_accounts
  for select to authenticated using (public.current_user_role() = 'admin');
drop policy if exists "Admin read ledger closes" on public.ledger_period_closes;
create policy "Admin read ledger closes" on public.ledger_period_closes
  for select to authenticated using (public.current_user_role() = 'admin');
drop policy if exists "Admin read ledger reopens" on public.ledger_period_reopens;
create policy "Admin read ledger reopens" on public.ledger_period_reopens
  for select to authenticated using (public.current_user_role() = 'admin');
drop policy if exists "Admin read ledger entries" on public.ledger_manual_entries;
create policy "Admin read ledger entries" on public.ledger_manual_entries
  for select to authenticated using (public.current_user_role() = 'admin');
drop policy if exists "Admin read ledger lines" on public.ledger_manual_lines;
create policy "Admin read ledger lines" on public.ledger_manual_lines
  for select to authenticated using (public.current_user_role() = 'admin');

-- Supabase default privileges grant new tables to anon/authenticated; the books are RPC-written only.
revoke all on public.ledger_accounts, public.ledger_period_closes, public.ledger_period_reopens,
  public.ledger_manual_entries, public.ledger_manual_lines from public, anon, authenticated;
grant select on public.ledger_accounts, public.ledger_period_closes, public.ledger_period_reopens,
  public.ledger_manual_entries, public.ledger_manual_lines to authenticated;

-- Security definer functions below use an empty search_path and schema-qualified names
-- (EXPERT_STANDARDS, Security); built-ins still resolve from pg_catalog.

create or replace function public.ledger_period_is_closed(p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ledger_period_closes where period = to_char(p_day, 'YYYY-MM'));
$$;

-- One transaction-scoped lock per month, taken by every RPC that checks or changes that month, so a
-- close cannot race a record, void or reopen of the same month.
create or replace function public.ledger_lock_period(p_period text)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('ledger:' || p_period, 0));
$$;

-- p_lines: [{"account_code":"6000","debit_cents":2500,"credit_cents":0,"memo":"","athlete_ref":null}, …],
-- 2 to 20 lines. Dates are UTC calendar days.
create or replace function public.record_ledger_entry(
  p_entry_date date,
  p_kind text,
  p_memo text,
  p_reference text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_id uuid;
  line jsonb;
  debit_total bigint := 0;
  credit_total bigint := 0;
  d bigint;
  c bigint;
begin
  perform public.require_admin_guard();
  if p_entry_date is null or p_entry_date > current_date or p_entry_date < date '2020-01-01' then
    raise exception 'Choose a date between 2020-01-01 and today (UTC).';
  end if;
  if lower(btrim(coalesce(p_kind, ''))) in ('period_reopen', 'period_close') then
    raise exception 'That entry kind is reserved.';
  end if;
  perform public.ledger_lock_period(to_char(p_entry_date, 'YYYY-MM'));
  if public.ledger_period_is_closed(p_entry_date) then
    raise exception 'That month is closed. Date the entry in an open month.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 2 and 20 then
    raise exception 'An entry needs 2 to 20 lines.';
  end if;
  for line in select * from jsonb_array_elements(p_lines) loop
    d := coalesce((line->>'debit_cents')::bigint, 0);
    c := coalesce((line->>'credit_cents')::bigint, 0);
    if d < 0 or c < 0 or (d > 0) = (c > 0) then
      raise exception 'Each line is either a debit or a credit, above zero.';
    end if;
    if d > 100000000 or c > 100000000 then
      raise exception 'Each line must be $1,000,000 or less.';
    end if;
    if not exists (select 1 from public.ledger_accounts a where a.code = line->>'account_code' and a.active) then
      raise exception 'Unknown account %', line->>'account_code';
    end if;
    if nullif(line->>'athlete_ref', '') is not null and line->>'athlete_ref' !~ '^ath-[0-9a-f]{8}$' then
      raise exception 'Athlete reference must look like ath-1a2b3c4d.';
    end if;
    debit_total := debit_total + d;
    credit_total := credit_total + c;
  end loop;
  if debit_total <> credit_total or debit_total = 0 then
    raise exception 'Debits and credits must be equal.';
  end if;

  insert into public.ledger_manual_entries (entry_date, kind, memo, reference, created_by)
  values (p_entry_date, lower(btrim(p_kind)), btrim(p_memo), btrim(coalesce(p_reference, '')), auth.uid())
  returning id into entry_id;

  insert into public.ledger_manual_lines (entry_id, account_code, debit_cents, credit_cents, memo, athlete_ref)
  select entry_id, l->>'account_code', coalesce((l->>'debit_cents')::bigint, 0),
    coalesce((l->>'credit_cents')::bigint, 0), left(coalesce(l->>'memo', ''), 200), nullif(l->>'athlete_ref', '')
  from jsonb_array_elements(p_lines) l;

  return entry_id;
end;
$$;

-- Voiding never deletes: it posts the mirror-image entry, dated in an open month.
create or replace function public.void_ledger_entry(p_entry_id uuid, p_reason text, p_reversal_date date default current_date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.ledger_manual_entries%rowtype;
  reversal_id uuid;
begin
  perform public.require_admin_guard();
  if p_reversal_date is null or p_reversal_date > current_date or p_reversal_date < date '2020-01-01' then
    raise exception 'Choose a reversal date between 2020-01-01 and today (UTC).';
  end if;
  perform public.ledger_lock_period(to_char(p_reversal_date, 'YYYY-MM'));
  select * into original from public.ledger_manual_entries where id = p_entry_id for update;
  if not found then raise exception 'Entry not found.'; end if;
  if original.voided_at is not null or original.reverses_id is not null then
    raise exception 'This entry is already voided or is itself a reversal.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Say why it is being voided.'; end if;
  if public.ledger_period_is_closed(p_reversal_date) then
    raise exception 'That month is closed. Date the reversal in an open month.';
  end if;

  insert into public.ledger_manual_entries (entry_date, kind, memo, reference, reverses_id, created_by)
  values (p_reversal_date, original.kind, left('Reversal: ' || original.memo, 200), original.reference, original.id, auth.uid())
  returning id into reversal_id;

  insert into public.ledger_manual_lines (entry_id, account_code, debit_cents, credit_cents, memo, athlete_ref)
  select reversal_id, account_code, credit_cents, debit_cents, memo, athlete_ref
  from public.ledger_manual_lines where entry_id = original.id;

  update public.ledger_manual_entries
  set voided_at = now(), void_reason = left(btrim(p_reason), 200)
  where id = original.id;

  return reversal_id;
end;
$$;

create or replace function public.close_ledger_period(p_period text, p_note text, p_totals jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  if p_period is null or p_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Period must look like 2026-10.'; end if;
  if to_date(p_period || '-01', 'YYYY-MM-DD') >= date_trunc('month', current_date)::date then
    raise exception 'Only a finished month can be closed.';
  end if;
  if jsonb_typeof(coalesce(p_totals, '{}'::jsonb)) <> 'object' then raise exception 'Totals must be an object.'; end if;
  perform public.ledger_lock_period(p_period);
  insert into public.ledger_period_closes (period, closed_by, note, totals)
  values (p_period, auth.uid(), left(btrim(coalesce(p_note, '')), 200), coalesce(p_totals, '{}'::jsonb))
  on conflict (period) do nothing;
  if not found then raise exception 'That month is already closed.'; end if;
end;
$$;

create or replace function public.reopen_ledger_period(p_period text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed public.ledger_period_closes%rowtype;
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Say why the month is being reopened.'; end if;
  perform public.ledger_lock_period(coalesce(p_period, ''));
  delete from public.ledger_period_closes where period = p_period returning * into closed;
  if not found then raise exception 'That month is not closed.'; end if;
  insert into public.ledger_period_reopens (period, reopened_by, reason, previous_closed_at, previous_totals)
  values (p_period, auth.uid(), left(btrim(p_reason), 200), closed.closed_at, closed.totals);
end;
$$;

-- One read for the desk: accounts, every recorded entry with its lines, closes and reopens.
create or replace function public.get_ledger_books()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'accounts', (select coalesce(jsonb_agg(to_jsonb(a) order by a.code), '[]'::jsonb) from public.ledger_accounts a),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'entry_date', e.entry_date, 'kind', e.kind, 'memo', e.memo, 'reference', e.reference,
        'reverses_id', e.reverses_id, 'voided_at', e.voided_at, 'void_reason', e.void_reason, 'created_at', e.created_at,
        'lines', (select coalesce(jsonb_agg(jsonb_build_object('account_code', l.account_code, 'debit_cents', l.debit_cents,
          'credit_cents', l.credit_cents, 'memo', l.memo, 'athlete_ref', l.athlete_ref) order by l.debit_cents desc, l.account_code), '[]'::jsonb)
          from public.ledger_manual_lines l where l.entry_id = e.id)
      ) order by e.entry_date, e.created_at), '[]'::jsonb)
      from public.ledger_manual_entries e
    ),
    'closes', (select coalesce(jsonb_agg(jsonb_build_object('period', c.period, 'closed_at', c.closed_at,
      'note', c.note, 'totals', c.totals) order by c.period), '[]'::jsonb) from public.ledger_period_closes c),
    'reopens', (select coalesce(jsonb_agg(jsonb_build_object('period', r.period, 'reopened_at', r.reopened_at,
      'reason', r.reason, 'previous_closed_at', r.previous_closed_at) order by r.reopened_at), '[]'::jsonb) from public.ledger_period_reopens r)
  );
end;
$$;

revoke all on function public.ledger_period_is_closed(date) from public, anon, authenticated;
revoke all on function public.ledger_lock_period(text) from public, anon, authenticated;
revoke all on function public.record_ledger_entry(date, text, text, text, jsonb) from public, anon;
revoke all on function public.void_ledger_entry(uuid, text, date) from public, anon;
revoke all on function public.close_ledger_period(text, text, jsonb) from public, anon;
revoke all on function public.reopen_ledger_period(text, text) from public, anon;
revoke all on function public.get_ledger_books() from public, anon;
grant execute on function public.record_ledger_entry(date, text, text, text, jsonb) to authenticated;
grant execute on function public.void_ledger_entry(uuid, text, date) to authenticated;
grant execute on function public.close_ledger_period(text, text, jsonb) to authenticated;
grant execute on function public.reopen_ledger_period(text, text) to authenticated;
grant execute on function public.get_ledger_books() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Money facts the revenue log was missing
-- ---------------------------------------------------------------------------------------------

alter table public.tips add column if not exists cover_fee_cents integer not null default 0;
alter table public.tips add column if not exists stripe_payment_intent_id text;

do $$
begin
  -- The covered fee is admin-configured (maloFeeDollars) and usually a few percent; the bound stops a
  -- fabricated client row without rejecting a real fee on a small donation.
  alter table public.tips add constraint tips_cover_fee_cents_check
    check (cover_fee_cents >= 0 and cover_fee_cents <= greatest(500, amount_cents));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.tips add constraint tips_stripe_payment_intent_id_check
    check (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]{8,64}$');
exception
  when duplicate_object then null;
end $$;

-- One PaymentIntent pays for one donation; a reused id would spoil payout matching and the future
-- webhook's dedupe key.
create unique index if not exists tips_stripe_payment_intent_key on public.tips (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.company_revenue_logs drop constraint if exists company_revenue_logs_source_check;
alter table public.company_revenue_logs
  add constraint company_revenue_logs_source_check
  check (source in ('malo', 'booster', 'vault', 'merch', 'tip', 'card_fee'));

create or replace function public.company_revenue_bps(stream_source text)
returns integer
language sql
immutable
as $$
  select case lower(btrim(coalesce(stream_source, '')))
    when 'malo' then 1000
    when 'booster' then 1500
    when 'vault' then 2000
    when 'merch' then 10000
    when 'tip' then 10000
    when 'card_fee' then 10000
    else 0
  end;
$$;

-- Same shape as tips_platform_tip_revenue: its own all-Tapua'i row, keyed by the donation id.
create or replace function public.tips_card_fee_revenue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.cover_fee_cents, 0) > 0 then
    insert into public.company_revenue_logs (
      transaction_type, source, source_id, label, payee_kind, player_id,
      gross_cents, platform_cents, payout_cents,
      gross_amount, platform_cut_amount, payout_amount, created_at
    )
    values (
      'card_fee', 'card_fee', new.id::text, 'Card fee covered by donor', 'none', new.player_id,
      new.cover_fee_cents, new.cover_fee_cents, 0,
      round(new.cover_fee_cents / 100.0, 2), round(new.cover_fee_cents / 100.0, 2), 0,
      new.created_at
    )
    on conflict (source, source_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.tips_card_fee_revenue() from public, anon, authenticated;

drop trigger if exists tips_card_fee_revenue_ai on public.tips;
create trigger tips_card_fee_revenue_ai
  after insert on public.tips
  for each row execute procedure public.tips_card_fee_revenue();

-- Revenue report: card fees covered by donors as their own stream, so the streams add up to the total.
create or replace function public.get_company_revenue_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
  perform public.sync_company_revenue_logs();

  select jsonb_build_object(
    'total_gross', round((select coalesce(sum(gross_cents), 0) from public.company_revenue_logs) / 100.0, 2),
    'total_platform_revenue', round((select coalesce(sum(platform_cents), 0) from public.company_revenue_logs) / 100.0, 2),
    'total_payouts', round((select coalesce(sum(payout_cents), 0) from public.company_revenue_logs) / 100.0, 2),
    'gross_volume_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs),
    'company_net_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs),
    'payouts_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs),
    'stripe_paid_cents', (
      select coalesce(sum(amount_cents), 0)::int
      from public.disbursements
      where status = 'paid'
    ),
    'streams', jsonb_build_array(
      jsonb_build_object(
        'source', 'malo',
        'label', 'Donations',
        'split', '10% platform / 90% athlete',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'platform_bps', 1000,
        'payout_bps', 9000,
        'payee', 'Athlete'
      ),
      jsonb_build_object(
        'source', 'tip',
        'label', 'Optional tips to Tapua''i',
        'split', '100% platform (donor chose it)',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'tip'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'tip'),
        'payout_cents', 0,
        'platform_bps', 10000,
        'payout_bps', 0,
        'payee', 'Tapua''i'
      ),
      jsonb_build_object(
        'source', 'card_fee',
        'label', 'Card fees covered by donors',
        'split', '100% platform (offsets card processing)',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'card_fee'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'card_fee'),
        'payout_cents', 0,
        'platform_bps', 10000,
        'payout_bps', 0,
        'payee', 'Tapua''i'
      ),
      jsonb_build_object(
        'source', 'booster',
        'label', 'Local District Booster Sponsorships',
        'split', '15% platform / 85% operator',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'booster'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'booster'),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source = 'booster'),
        'platform_bps', 1500,
        'payout_bps', 8500,
        'payee', 'Operator'
      ),
      jsonb_build_object(
        'source', 'merch_vault',
        'label', 'Merch & Vault Subscriptions',
        'split', 'Vault 20% / 80% athlete · Drip 100% platform',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source in ('vault', 'merch')),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source in ('vault', 'merch')),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source in ('vault', 'merch')),
        'platform_bps', null,
        'payout_bps', null,
        'payee', 'Athlete + company'
      )
    ),
    'recent', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', row.id,
            'source', row.source,
            'label', row.label,
            'gross_cents', row.gross_cents,
            'platform_cents', row.platform_cents,
            'payout_cents', row.payout_cents,
            'payee_kind', row.payee_kind,
            'created_at', row.created_at
          )
          order by row.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        select *
        from public.company_revenue_logs
        order by created_at desc
        limit 40
      ) row
    )
  )
  into payload;

  return payload;
end;
$$;

alter table public.disbursements add column if not exists paid_at timestamptz;

-- Payouts marked paid before this migration are dated by when they were created.
update public.disbursements set paid_at = created_at where status = 'paid' and paid_at is null;

-- The server owns paid_at: set when a payout first becomes paid, kept while it stays paid, cleared
-- otherwise. A client value (insert or a direct update) is always replaced, so nobody can backdate a
-- payout into a closed month.
create or replace function public.disbursements_paid_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'paid' then
    new.paid_at := case when tg_op = 'UPDATE' and old.status = 'paid' then old.paid_at else now() end;
  else
    new.paid_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.disbursements_paid_at() from public, anon, authenticated;

drop trigger if exists disbursements_paid_at_bu on public.disbursements;
create trigger disbursements_paid_at_bu
  before insert or update on public.disbursements
  for each row execute procedure public.disbursements_paid_at();
