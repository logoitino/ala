-- Mālo channel tags. Safe to re-run.
-- origin: highlight | qr | wishlist | profile | live
-- entry: in_app | qr_link
-- wishlist_item_id + source_label name the locker item ("the tea").
-- Apply after locker_room_wishlist.sql and company_revenue.sql.
-- Does not turn on Stripe webhook crediting. The client still inserts one tips row.

alter table public.tips add column if not exists origin text not null default 'profile';
alter table public.tips add column if not exists entry text not null default 'in_app';
alter table public.tips add column if not exists source_label text not null default '';
alter table public.tips add column if not exists wishlist_item_id uuid;

do $$
begin
  alter table public.tips add constraint tips_origin_check
    check (origin in ('highlight', 'qr', 'wishlist', 'profile', 'live'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.tips add constraint tips_entry_check
    check (entry in ('in_app', 'qr_link'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create index if not exists tips_origin_created_at_idx on public.tips (origin, created_at desc);
create index if not exists tips_wishlist_item_id_idx on public.tips (wishlist_item_id) where wishlist_item_id is not null;

do $$
begin
  if to_regclass('public.wishlist_items') is null then
    return;
  end if;
  alter table public.tips
    add constraint tips_wishlist_item_id_fkey
    foreign key (wishlist_item_id) references public.wishlist_items (id) on delete set null;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

create or replace function public.tip_origin_label(origin text, entry text, source_label text)
returns text
language sql
immutable
as $$
  select
    case coalesce(origin, 'profile')
      when 'highlight' then 'Highlight'
      when 'qr' then 'QR link'
      when 'wishlist' then 'Wishlist'
      when 'live' then 'Live feed'
      else 'Profile'
    end
    || case
      when coalesce(entry, 'in_app') = 'qr_link' and coalesce(origin, 'profile') is distinct from 'qr'
        then ' via QR'
      else ''
    end
    || case
      when coalesce(btrim(source_label), '') <> '' then ' · ' || btrim(source_label)
      else ''
    end;
$$;

revoke execute on function public.tip_origin_label(text, text, text) from public, anon;

drop function if exists public.get_fan_tip_history(uuid);

create or replace function public.get_fan_tip_history(fan_user_id uuid)
returns table (
  id uuid,
  player_id uuid,
  reel_id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  athlete_name text,
  school_name text,
  origin text,
  entry text,
  wishlist_item_id uuid,
  source_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.player_id,
    t.reel_id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(p.name, 'Athlete') as athlete_name,
    coalesce(nullif(p.school_name, ''), '') as school_name,
    coalesce(t.origin, 'profile') as origin,
    coalesce(t.entry, 'in_app') as entry,
    t.wishlist_item_id,
    coalesce(t.source_label, '') as source_label
  from public.tips t
  left join public.players p on p.id = t.player_id
  where auth.uid() is not null
    and t.fan_id = auth.uid()
  order by t.created_at desc;
end;
$$;

grant execute on function public.get_fan_tip_history(uuid) to authenticated;

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
    'Mālo · ' || public.tip_origin_label(t.origin, t.entry, t.source_label)
      || ' · ' || coalesce(nullif(p.name, ''), 'Athlete'),
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
      'Mālo · ' || public.tip_origin_label(new.origin, new.entry, new.source_label),
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

