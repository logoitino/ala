-- Rally goals, athlete thank-yous, and the optional tip to Tapua'i (owner, 2026-09-29).
--
-- Mission: make it easy for a family to put their young athlete where the community can watch their
-- highlights and donate toward real sports costs (the GoFundMe replacement), and for the athlete to
-- say thank you. Docs: docs/product/STORY.md, docs/product/VOICE.md, ROADMAP M2.
--
-- 1. tips.platform_tip_cents — an optional tip the donor adds for Tapua'i at checkout (GoFundMe
--    model). It is charged on top of the donation, never counted as the athlete's donation, and
--    logged as its own 100% platform revenue row (source 'tip'). The donation itself keeps the 10%
--    platform share (`company_revenue_bps('malo')`), which the donate sheet now discloses.
-- 2. rallies — a named cost (fees, gear, travel, camps, college prep) with a short story, a target
--    and an optional end date. A guardian's Rally goes live at once; an athlete's Rally waits for
--    their guardian (or an admin) unless the athlete already controls their own money (18+ on the
--    custodial record). One open Rally per athlete. Donations reach a Rally through `tips.rally_id`;
--    a BEFORE INSERT trigger moves the total and fills it.
-- 3. donation_thanks — the athlete (or their guardian) thanks a donor with a preset message. Presets
--    only, no free text and no reply channel: many athletes are minors (STORY.md guardrails, ROADMAP M4).
--
-- Depends on: custodial_money.sql (`athlete_controls_money`), company_revenue.sql, tip_origin.sql,
-- reels.sql. Not applied to live Supabase yet.
--
-- Rollback:
--   drop trigger if exists tips_rally_before_insert on public.tips;
--   drop trigger if exists tips_platform_tip_revenue_ai on public.tips;
--   drop function if exists public.tips_rally_before_insert(), public.tips_platform_tip_revenue(),
--     public.rally_manager_role(uuid), public.create_rally(uuid, text, text, text, integer, date),
--     public.approve_rally(uuid), public.close_rally(uuid), public.thank_rally(uuid, text, uuid),
--     public.get_active_rally(uuid), public.get_player_rallies(uuid), public.thank_donation(uuid, text),
--     public.get_donations_to_thank(uuid), public.get_my_donation_thanks();
--   drop table if exists public.donation_thanks; alter table public.tips drop column if exists rally_id;
--   drop table if exists public.rallies; alter table public.tips drop column if exists platform_tip_cents;
--   (then restore company_revenue_bps and the company_revenue_logs source check without 'tip').

-- ---------------------------------------------------------------------------------------------
-- 1. Optional tip to Tapua'i
-- ---------------------------------------------------------------------------------------------

alter table public.tips add column if not exists platform_tip_cents integer not null default 0;

do $$
begin
  alter table public.tips
    add constraint tips_platform_tip_cents_check
    check (platform_tip_cents >= 0 and platform_tip_cents <= amount_cents);
exception
  when duplicate_object then null;
end $$;

alter table public.company_revenue_logs drop constraint if exists company_revenue_logs_source_check;
alter table public.company_revenue_logs
  add constraint company_revenue_logs_source_check
  check (source in ('malo', 'booster', 'vault', 'merch', 'tip'));

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
    else 0
  end;
$$;

-- The donation row is still logged by company_revenue_after_source_insert() as 'malo' on
-- amount_cents (10% platform / 90% athlete). The optional tip is its own row, all Tapua'i.
create or replace function public.tips_platform_tip_revenue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.platform_tip_cents, 0) > 0 then
    insert into public.company_revenue_logs (
      transaction_type, source, source_id, label, payee_kind, player_id,
      gross_cents, platform_cents, payout_cents,
      gross_amount, platform_cut_amount, payout_amount, created_at
    )
    values (
      'tip', 'tip', new.id::text, 'Tip to Tapua''i', 'none', new.player_id,
      new.platform_tip_cents, new.platform_tip_cents, 0,
      round(new.platform_tip_cents / 100.0, 2), round(new.platform_tip_cents / 100.0, 2), 0,
      new.created_at
    )
    on conflict (source, source_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.tips_platform_tip_revenue() from public, anon, authenticated;

drop trigger if exists tips_platform_tip_revenue_ai on public.tips;
create trigger tips_platform_tip_revenue_ai
  after insert on public.tips
  for each row execute procedure public.tips_platform_tip_revenue();

-- Money desk: show the optional tips as their own stream (and call donations "Donations").
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

-- ---------------------------------------------------------------------------------------------
-- 2. Rally goals
-- ---------------------------------------------------------------------------------------------

create table if not exists public.rallies (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 60),
  story text not null default '' check (char_length(story) <= 600),
  cost_kind text not null default 'season'
    check (cost_kind in ('season', 'gear', 'travel', 'camps', 'college_prep', 'other')),
  target_cents integer not null check (target_cents between 500 and 2500000),
  raised_cents integer not null default 0 check (raised_cents >= 0),
  donation_count integer not null default 0 check (donation_count >= 0),
  ends_on date,
  status text not null default 'pending_guardian'
    check (status in ('pending_guardian', 'live', 'filled', 'closed')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  filled_at timestamptz,
  thanks_key text,
  thanks_reel_id uuid references public.reels (id) on delete set null,
  thanked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rallies_player_status_idx on public.rallies (player_id, status, created_at desc);
-- One open Rally per athlete.
create unique index if not exists rallies_one_open_per_player
  on public.rallies (player_id) where status in ('pending_guardian', 'live');

alter table public.tips add column if not exists rally_id uuid references public.rallies (id) on delete set null;
create index if not exists tips_rally_id_idx on public.tips (rally_id) where rally_id is not null;

-- New origin: a donation started from a Rally card.
alter table public.tips drop constraint if exists tips_origin_check;
alter table public.tips add constraint tips_origin_check
  check (origin in ('highlight', 'qr', 'wishlist', 'profile', 'live', 'rally'));

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
      when 'rally' then 'Rally'
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

alter table public.rallies enable row level security;

-- Who may manage this athlete's Rallies: 'admin' | 'guardian' | 'athlete' (the claimed profile,
-- verified or not — a minor's Rally still needs the guardian) | null.
create or replace function public.rally_manager_role(target_player_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
begin
  if auth.uid() is null or target_player_id is null then
    return null;
  end if;
  if public.current_user_role() = 'admin' then
    return 'admin';
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    return null;
  end if;
  if exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = me.id) then
    return 'guardian';
  end if;
  if me.player_id = target_player_id then
    return 'athlete';
  end if;
  return null;
end;
$$;

revoke all on function public.rally_manager_role(uuid) from public, anon;
grant execute on function public.rally_manager_role(uuid) to authenticated;

drop policy if exists "Read public or own rallies" on public.rallies;
create policy "Read public or own rallies"
  on public.rallies for select
  using (status in ('live', 'filled', 'closed') or public.rally_manager_role(player_id) is not null);

grant select on public.rallies to anon, authenticated;
-- No client writes: create / approve / close / thank go through the RPCs below.

create or replace function public.create_rally(
  target_player_id uuid,
  rally_title text,
  rally_story text,
  rally_cost_kind text,
  rally_target_cents integer,
  rally_ends_on date default null
)
returns public.rallies
language plpgsql
security definer
set search_path = public
as $$
declare
  role text := public.rally_manager_role(target_player_id);
  me uuid;
  go_live boolean;
  row_out public.rallies;
begin
  if role is null then
    raise exception 'Only the athlete or their parent / guardian can start a Rally';
  end if;
  if public.malo_target_frozen(target_player_id) then
    raise exception 'Donations are paused for this athlete';
  end if;
  if exists (select 1 from public.rallies where player_id = target_player_id and status in ('pending_guardian', 'live')) then
    raise exception 'This athlete already has an open Rally. Close it before starting another';
  end if;
  if rally_ends_on is not null and (rally_ends_on <= current_date or rally_ends_on > current_date + 180) then
    raise exception 'Pick an end date within the next 6 months';
  end if;

  select id into me from public.profiles where user_id = auth.uid() limit 1;
  go_live := role in ('guardian', 'admin') or public.athlete_controls_money(target_player_id);

  insert into public.rallies (player_id, created_by, title, story, cost_kind, target_cents, ends_on, status, approved_by, approved_at)
  values (
    target_player_id, me, btrim(rally_title), btrim(coalesce(rally_story, '')),
    coalesce(nullif(rally_cost_kind, ''), 'season'), rally_target_cents, rally_ends_on,
    case when go_live then 'live' else 'pending_guardian' end,
    case when go_live then me end,
    case when go_live then timezone('utc', now()) end
  )
  returning * into row_out;
  return row_out;
end;
$$;

create or replace function public.approve_rally(target_rally_id uuid)
returns public.rallies
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rallies;
  role text;
begin
  select * into r from public.rallies where id = target_rally_id;
  if r.id is null then
    raise exception 'Rally not found';
  end if;
  role := public.rally_manager_role(r.player_id);
  if role not in ('guardian', 'admin') then
    raise exception 'Only a parent / guardian can approve this Rally';
  end if;
  if r.status <> 'pending_guardian' then
    return r;
  end if;
  update public.rallies
  set status = 'live',
      approved_by = (select id from public.profiles where user_id = auth.uid() limit 1),
      approved_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = target_rally_id
  returning * into r;
  return r;
end;
$$;

create or replace function public.close_rally(target_rally_id uuid)
returns public.rallies
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rallies;
begin
  select * into r from public.rallies where id = target_rally_id;
  if r.id is null or public.rally_manager_role(r.player_id) is null then
    raise exception 'Rally not found';
  end if;
  if r.status in ('pending_guardian', 'live') then
    update public.rallies set status = 'closed', updated_at = timezone('utc', now())
    where id = target_rally_id returning * into r;
  end if;
  return r;
end;
$$;

-- Public thank-you on a Rally (shown on the athlete's profile): a preset message and, optionally,
-- one of the athlete's own confirmed clips showing what the donations paid for.
create or replace function public.thank_rally(target_rally_id uuid, message_key text, what_it_paid_for_reel uuid default null)
returns public.rallies
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rallies;
begin
  select * into r from public.rallies where id = target_rally_id;
  if r.id is null or public.rally_manager_role(r.player_id) is null then
    raise exception 'Rally not found';
  end if;
  if r.status = 'pending_guardian' or r.donation_count = 0 then
    raise exception 'Say thanks once people have donated to this Rally';
  end if;
  if message_key not in ('malo', 'season', 'gear', 'family', 'work') then
    raise exception 'Pick one of the thank-you messages';
  end if;
  -- The clip is shown to every fan, so it must be public (not Vault-only) and confirmed as this athlete.
  if what_it_paid_for_reel is not null and not exists (
    select 1 from public.reels
    where id = what_it_paid_for_reel and player_id = r.player_id and coalesce(tag_status, 'confirmed') = 'confirmed'
      and not coalesce(is_vault_only, false)
  ) then
    raise exception 'Pick one of this athlete''s own confirmed clips';
  end if;
  update public.rallies
  set thanks_key = message_key,
      thanks_reel_id = what_it_paid_for_reel,
      thanked_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = target_rally_id
  returning * into r;
  return r;
end;
$$;

-- The Rally fans see: live and not past its end date, or filled / thanked in the last 30 days.
create or replace function public.get_active_rally(target_player_id uuid)
returns public.rallies
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.rallies
  where player_id = target_player_id
    and (
      (status = 'live' and (ends_on is null or ends_on >= current_date))
      or (status = 'filled' and coalesce(thanked_at, filled_at) > timezone('utc', now()) - interval '30 days')
    )
  order by (status = 'live') desc, created_at desc
  limit 1;
$$;

-- Everything the athlete / guardian can manage, newest first (includes pending).
create or replace function public.get_player_rallies(target_player_id uuid)
returns setof public.rallies
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.rally_manager_role(target_player_id) is null then
    return;
  end if;
  return query
  select * from public.rallies where player_id = target_player_id order by created_at desc limit 20;
end;
$$;

-- A donation tagged to a Rally moves its total. Anything that no longer qualifies (closed, filled,
-- past its end date, another athlete's Rally) still records the donation — the card was already
-- charged — but drops the rally_id so the Rally total stays honest.
create or replace function public.tips_rally_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rallies;
begin
  if new.rally_id is null then
    return new;
  end if;
  select * into r from public.rallies where id = new.rally_id for update;
  if r.id is null or r.player_id <> new.player_id or r.status <> 'live'
     or (r.ends_on is not null and r.ends_on < current_date) then
    new.rally_id := null;
    return new;
  end if;
  update public.rallies
  set raised_cents = raised_cents + greatest(new.amount_cents, 0),
      donation_count = donation_count + 1,
      status = case when raised_cents + greatest(new.amount_cents, 0) >= target_cents then 'filled' else status end,
      filled_at = case when raised_cents + greatest(new.amount_cents, 0) >= target_cents then timezone('utc', now()) else filled_at end,
      updated_at = timezone('utc', now())
  where id = r.id;
  return new;
end;
$$;

revoke all on function public.tips_rally_before_insert() from public, anon, authenticated;

drop trigger if exists tips_rally_before_insert on public.tips;
create trigger tips_rally_before_insert
  before insert on public.tips
  for each row execute procedure public.tips_rally_before_insert();

revoke all on function public.create_rally(uuid, text, text, text, integer, date) from public, anon;
revoke all on function public.approve_rally(uuid) from public, anon;
revoke all on function public.close_rally(uuid) from public, anon;
revoke all on function public.thank_rally(uuid, text, uuid) from public, anon;
revoke all on function public.get_player_rallies(uuid) from public, anon;
grant execute on function public.create_rally(uuid, text, text, text, integer, date) to authenticated;
grant execute on function public.approve_rally(uuid) to authenticated;
grant execute on function public.close_rally(uuid) to authenticated;
grant execute on function public.thank_rally(uuid, text, uuid) to authenticated;
grant execute on function public.get_player_rallies(uuid) to authenticated;
grant execute on function public.get_active_rally(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Thank-yous to donors
-- ---------------------------------------------------------------------------------------------

create table if not exists public.donation_thanks (
  tip_id uuid primary key references public.tips (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  thanked_by uuid references public.profiles (id) on delete set null,
  message_key text not null check (message_key in ('malo', 'season', 'gear', 'family', 'work')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists donation_thanks_player_idx on public.donation_thanks (player_id, created_at desc);

alter table public.donation_thanks enable row level security;
revoke all on public.donation_thanks from anon, authenticated;
-- Read and write only through the RPCs below.

create or replace function public.thank_donation(target_tip_id uuid, message_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tips;
  role text;
begin
  select * into t from public.tips where id = target_tip_id;
  if t.id is null then
    raise exception 'Donation not found';
  end if;
  role := public.rally_manager_role(t.player_id);
  if role not in ('athlete', 'guardian') then
    raise exception 'Only the athlete or their parent / guardian can say thanks';
  end if;
  if t.fan_id is null then
    raise exception 'This donor can''t receive a thank-you';
  end if;
  if message_key not in ('malo', 'season', 'gear', 'family', 'work') then
    raise exception 'Pick one of the thank-you messages';
  end if;
  insert into public.donation_thanks (tip_id, player_id, thanked_by, message_key)
  values (t.id, t.player_id, (select id from public.profiles where user_id = auth.uid() limit 1), message_key)
  on conflict (tip_id) do nothing;
  return found;
end;
$$;

-- Athlete / guardian: recent donations and whether each donor has been thanked.
create or replace function public.get_donations_to_thank(target_player_id uuid)
returns table (
  tip_id uuid,
  amount_cents integer,
  created_at timestamptz,
  fan_name text,
  rally_title text,
  thanked_key text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.rally_manager_role(target_player_id) not in ('athlete', 'guardian', 'admin') then
    return;
  end if;
  return query
  select
    t.id,
    t.amount_cents,
    t.created_at,
    coalesce(nullif(f.full_name, ''), 'A fan') as fan_name,
    r.title as rally_title,
    dt.message_key as thanked_key
  from public.tips t
  left join public.profiles f on f.user_id = t.fan_id
  left join public.rallies r on r.id = t.rally_id
  left join public.donation_thanks dt on dt.tip_id = t.id
  where t.player_id = target_player_id
    and t.fan_id is not null
  order by t.created_at desc
  limit 50;
end;
$$;

-- Donor: thank-yous they've received. No amounts from other donors, nothing private about the athlete.
create or replace function public.get_my_donation_thanks()
returns table (
  tip_id uuid,
  player_id uuid,
  athlete_name text,
  message_key text,
  amount_cents integer,
  thanked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select dt.tip_id, dt.player_id, coalesce(nullif(p.name, ''), 'An athlete'), dt.message_key, t.amount_cents, dt.created_at
  from public.donation_thanks dt
  join public.tips t on t.id = dt.tip_id
  left join public.players p on p.id = dt.player_id
  where t.fan_id = auth.uid()
  order by dt.created_at desc
  limit 50;
$$;

revoke all on function public.thank_donation(uuid, text) from public, anon;
revoke all on function public.get_donations_to_thank(uuid) from public, anon;
revoke all on function public.get_my_donation_thanks() from public, anon;
grant execute on function public.thank_donation(uuid, text) to authenticated;
grant execute on function public.get_donations_to_thank(uuid) to authenticated;
grant execute on function public.get_my_donation_thanks() to authenticated;
