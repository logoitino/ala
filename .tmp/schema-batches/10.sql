do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_amounts_check
    check (gross_cents >= 0 and platform_cents >= 0 and payout_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_player_id_fkey
    foreign key (player_id) references public.players (id) on delete set null;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create index if not exists company_revenue_logs_created_at_idx
  on public.company_revenue_logs (created_at desc);
create index if not exists shop_orders_created_at_idx
  on public.shop_orders (created_at desc);
-- 2026-09 audit (Round 10 sweep): dedup ledger for `supabase/functions/stripe-webhook`. That
-- function's idempotency guard was a `select ... from telemetry_logs where payload contains
-- {payment_intent_id}` check followed later by an insert marking it processed — two separate,
-- non-atomic steps. Stripe explicitly redelivers webhooks (retries, and occasionally
-- near-simultaneous duplicate deliveries for the same event), so two concurrent invocations for the
-- same PaymentIntent could both pass the "already processed?" check before either finished writing,
-- double-crediting Aura and double-inserting a `tips` row. Currently dormant (the webhook's
-- rich-metadata credit path isn't reachable yet — `createPaymentIntentHandler` doesn't set
-- `tip_player_id`/`tip_kind`/`tip_aura_points` metadata), but fixing before it goes live is a lot
-- cheaper than fixing after. This table's primary key makes the dedup check atomic: the webhook now
-- inserts here FIRST, and a unique-violation on that insert (not a prior SELECT) is what means
-- "another delivery already claimed this event."
create table if not exists public.stripe_webhook_events (
  payment_intent_id text primary key,
  processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
-- Deliberately zero policies for anon/authenticated — this table is service-role only (the Edge
-- Function's admin client bypasses RLS entirely), never read or written by the app.

alter table public.company_revenue_logs enable row level security;
alter table public.shop_orders enable row level security;
-- 2026-09 audit item 8: dropped the `auth.role() = 'anon'` bypass on both policies. All legitimate
-- writes to this table go through the SECURITY DEFINER trigger `company_revenue_after_source_insert`
-- / `record_company_revenue` (fired on tips/sponsorships/subscriptions/shop_orders inserts), which
-- runs as the function owner and is unaffected by RLS or table grants — so there is no anon write
-- path this could break. No client code reads this table directly except the admin Money desk
-- (`lib/finance.ts` `fetchCompanyRevenueLogs`), which now requires a real authenticated admin.
drop policy if exists "Admin Full Access Revenue Logs" on public.company_revenue_logs;
drop policy if exists "Admin read company revenue logs" on public.company_revenue_logs;
create policy "Admin read company revenue logs"
  on public.company_revenue_logs for select
  using (public.current_user_role() = 'admin');
drop policy if exists "Admin write company revenue logs" on public.company_revenue_logs;
create policy "Admin write company revenue logs"
  on public.company_revenue_logs for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
-- 2026-09 audit item 8: no client code reads `shop_orders` directly (Drip purchase history isn't
-- surfaced yet) — restricted to admin.
drop policy if exists "Public read shop orders" on public.shop_orders;
create policy "Public read shop orders"
  on public.shop_orders for select
  using (public.current_user_role() = 'admin');
-- 2026-09 audit sweep: re-traced the "guest checkout" reasoning above — Drip is NOT listed in
-- `SOFT_WALL_GATES` (that list only gates the proactive sign-in *prompt* UI), but the actual charge
-- still goes through the same JWT-gated flow as Mālo/boosters: `Drip/ProductSheet.tsx` calls
-- `useTipCheckout().startCheckout`, which calls `stripeIntent.ts` `createPaymentIntent`, which calls
-- `requireAccessToken` — that throws before PaymentSheet ever opens if there is no real Supabase
-- session. So `recordDripOrder`'s `buyerId: user?.id` (`finance.ts`) is never actually null on a
-- legitimate purchase; there is no anonymous-buyer Drip order to preserve. Tightened to match
-- `tips`/`sponsorships`. As with those, this only stops a fabricated row from a client that never went
-- through Stripe — it does not itself verify the charge happened.
drop policy if exists "Anyone insert shop orders" on public.shop_orders;
drop policy if exists "Insert shop orders" on public.shop_orders;
create policy "Insert shop orders"
  on public.shop_orders for insert
  with check (auth.uid() = buyer_id);
-- 2026-09 audit item 8: this "all" policy's `auth.role() = 'anon'` bypass meant anon could also
-- UPDATE/DELETE any shop order (not just insert) — the real hole named in the audit ("edited or
-- deleted via raw REST"). Dropped; update/delete are now admin-only, insert is unaffected (separate
-- policy above).
drop policy if exists "Admin write shop orders" on public.shop_orders;
create policy "Admin write shop orders"
  on public.shop_orders for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
drop policy if exists "Admin delete shop orders" on public.shop_orders;
create policy "Admin delete shop orders"
  on public.shop_orders for delete
  using (public.current_user_role() = 'admin');
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
    else 0
  end;
$$;
create or replace function public.record_company_revenue(
  p_source text,
  p_source_id text,
  p_gross_cents integer,
  p_payee_kind text default 'none',
  p_player_id uuid default null,
  p_label text default '',
  p_created_at timestamptz default timezone('utc', now())
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  stream text := lower(btrim(coalesce(p_source, '')));
  gross integer := greatest(0, coalesce(p_gross_cents, 0));
  bps integer := public.company_revenue_bps(stream);
  platform integer := round((gross * bps)::numeric / 10000.0)::integer;
  payout integer := gross - platform;
  payee text := case
    when p_payee_kind in ('athlete', 'operator', 'none') then p_payee_kind
    else 'none'
  end;
  row_id uuid;
begin
  if stream not in ('malo', 'booster', 'vault', 'merch') then
    raise exception 'Unknown revenue source %', p_source;
  end if;
  if coalesce(p_source_id, '') = '' then
    raise exception 'Revenue source_id is required.';
  end if;

  insert into public.company_revenue_logs (
    transaction_type,
    source,
    source_id,
    label,
    payee_kind,
    player_id,
    gross_cents,
    platform_cents,
    payout_cents,
    gross_amount,
    platform_cut_amount,
    payout_amount,
    created_at
  )
  values (
    stream,
    stream,
    p_source_id,
    coalesce(nullif(btrim(p_label), ''), stream),
    payee,
    p_player_id,
    gross,
    platform,
    payout,
    round(gross / 100.0, 2),
    round(platform / 100.0, 2),
    round(payout / 100.0, 2),
    coalesce(p_created_at, timezone('utc', now()))
  )
  on conflict (source, source_id) do update
    set
      transaction_type = excluded.transaction_type,
      label = excluded.label,
      payee_kind = excluded.payee_kind,
      player_id = excluded.player_id,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount,
      created_at = excluded.created_at
  returning id into row_id;

  return row_id;
end;
$$;
create or replace function public.sync_company_revenue_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'malo',
    'malo',
    t.id::text,
    'Mālo · ' || coalesce(nullif(p.name, ''), 'Athlete'),
    'athlete',
    t.player_id,
    t.amount_cents,
    round((t.amount_cents * 1000)::numeric / 10000.0)::integer,
    t.amount_cents - round((t.amount_cents * 1000)::numeric / 10000.0)::integer,
    round(t.amount_cents / 100.0, 2),
    round(round((t.amount_cents * 1000)::numeric / 10000.0)::integer / 100.0, 2),
    round((t.amount_cents - round((t.amount_cents * 1000)::numeric / 10000.0)::integer) / 100.0, 2),
    t.created_at
  from public.tips t
  left join public.players p on p.id = t.player_id
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  get diagnostics n = row_count;

  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'booster',
    'booster',
    s.id::text,
    'Booster · ' || coalesce(nullif(s.business_name, ''), 'Local booster'),
    'operator',
    null,
    coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0),
    round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer,
    coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0)
      - round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer,
    round(coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) / 100.0, 2),
    round(round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer / 100.0, 2),
    round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0)
      - round((coalesce((to_jsonb(s)->>'amount_cents')::int, (to_jsonb(s)->>'monthly_amount')::int, 0) * 1500)::numeric / 10000.0)::integer) / 100.0, 2),
    s.created_at
  from public.sponsorships s
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'vault',
    'vault',
    sub.id::text,
    'Vault · ' || coalesce(nullif(p.name, ''), 'Athlete'),
    'athlete',
    sub.athlete_id,
    499,
    round((499 * 2000)::numeric / 10000.0)::integer,
    499 - round((499 * 2000)::numeric / 10000.0)::integer,
    4.99,
    round(round((499 * 2000)::numeric / 10000.0)::integer / 100.0, 2),
    round((499 - round((499 * 2000)::numeric / 10000.0)::integer) / 100.0, 2),
    sub.created_at
  from public.subscriptions sub
  left join public.players p on p.id = sub.athlete_id
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      player_id = excluded.player_id,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  insert into public.company_revenue_logs (
    transaction_type, source, source_id, label, payee_kind, player_id,
    gross_cents, platform_cents, payout_cents,
    gross_amount, platform_cut_amount, payout_amount, created_at
  )
  select
    'merch',
    'merch',
    o.id::text,
    'Drip · ' || coalesce(nullif(sp.name, ''), coalesce(o.product_id, 'Merch')),
    'none',
    null,
    o.amount_cents,
    o.amount_cents,
    0,
    round(o.amount_cents / 100.0, 2),
    round(o.amount_cents / 100.0, 2),
    0,
    o.created_at
  from public.shop_orders o
  left join public.shop_products sp on sp.id = o.product_id
  on conflict (source, source_id) do update
    set
      label = excluded.label,
      gross_cents = excluded.gross_cents,
      platform_cents = excluded.platform_cents,
      payout_cents = excluded.payout_cents,
      gross_amount = excluded.gross_amount,
      platform_cut_amount = excluded.platform_cut_amount,
      payout_amount = excluded.payout_amount;

  return n;
end;
$$;
create or replace function public.company_revenue_after_source_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'tips' then
    perform public.record_company_revenue(
      'malo',
      new.id::text,
      new.amount_cents,
      'athlete',
      new.player_id,
      'Mālo',
      new.created_at
    );
  elsif tg_table_name = 'sponsorships' then
    perform public.record_company_revenue(
      'booster',
      new.id::text,
      coalesce((to_jsonb(new)->>'amount_cents')::int, (to_jsonb(new)->>'monthly_amount')::int, 0),
      'operator',
      null,
      'Booster · ' || coalesce(nullif(new.business_name, ''), 'Local booster'),
      new.created_at
    );
  elsif tg_table_name = 'subscriptions' then
    perform public.record_company_revenue(
      'vault',
      new.id::text,
      499,
      'athlete',
      new.athlete_id,
      'Vault',
      new.created_at
    );
  elsif tg_table_name = 'shop_orders' then
    perform public.record_company_revenue(
      'merch',
      new.id::text,
      new.amount_cents,
      'none',
      null,
      'Drip',
      new.created_at
    );
  end if;
  return new;
end;
$$;
drop trigger if exists company_revenue_tips_ai on public.tips;
create trigger company_revenue_tips_ai
  after insert on public.tips
  for each row execute procedure public.company_revenue_after_source_insert();
drop trigger if exists company_revenue_sponsorships_ai on public.sponsorships;
create trigger company_revenue_sponsorships_ai
  after insert on public.sponsorships
  for each row execute procedure public.company_revenue_after_source_insert();
drop trigger if exists company_revenue_subscriptions_ai on public.subscriptions;
create trigger company_revenue_subscriptions_ai
  after insert on public.subscriptions
  for each row execute procedure public.company_revenue_after_source_insert();
drop trigger if exists company_revenue_shop_orders_ai on public.shop_orders;
create trigger company_revenue_shop_orders_ai
  after insert on public.shop_orders
  for each row execute procedure public.company_revenue_after_source_insert();
drop function if exists public.get_company_revenue_summary();
-- 2026-09 audit item 7: was anon-executable with no role check — anyone could read the full
-- company revenue ledger summary. SECURITY DEFINER bypasses table RLS, so the guard must be here.
create or replace function public.get_company_revenue_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
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
        'label', 'Mālo Micro-Tips',
        'split', '10% platform / 90% athlete',
        'gross_cents', (select coalesce(sum(gross_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'platform_cents', (select coalesce(sum(platform_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'payout_cents', (select coalesce(sum(payout_cents), 0)::int from public.company_revenue_logs where source = 'malo'),
        'platform_bps', 1000,
        'payout_bps', 9000,
        'payee', 'Athlete'
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