-- =============================================================================================
-- Payout gate without the school — school confirmation becomes a badge, not the only road
-- =============================================================================================
-- Design: docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md §9 (owner approved 2026-09-29: "don't hinder growth").
--
-- What changes:
--   1. School confirmation still gives the "verified" badge and unlocks payouts with no cap.
--   2. Without the school, payouts unlock when ALL of these hold:
--        - exactly one open claim on the athlete, and no dispute;
--        - Stripe identity check passed: the linked guardian's custodial account has
--          payouts_enabled, or — when no guardian holds the money (or handover age passed) —
--          the claimant's own Connect account has payouts_enabled. Both flags are server-only.
--      Until 3 teammates vouch (or the school confirms), payouts are capped at
--      athlete_pending_payout_cap_cents() — $250.
--   3. Teammate vouches: an athlete at the same school who is school-confirmed, or who has
--      passed the gate above, can vouch for a pending teammate. Max 10 vouches a day.
--   4. athlete_is_varsity_verified keeps meaning "school confirmed" (the public badge). It used
--      to call athlete_payout_allowed; the two questions now have different answers.
--
-- Money: payouts are still blocked everywhere (503). The cap is enforced by whichever payout
-- path is built next (Phase 1a ledger), which must read athlete_payout_status(player_id).
--
-- Roll back: re-apply athlete_payout_allowed and athlete_is_varsity_verified from
-- 20260929120000_athlete_verification_ladder.sql, then
--   drop function public.vouch_for_teammate(uuid); drop function public.get_teammates_to_vouch();
--   drop function public.get_my_payout_status(); drop function public.athlete_payout_status(uuid);
--   drop function public.athlete_pending_payout_cap_cents(); drop table public.athlete_vouches;
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Teammate vouches
-- ---------------------------------------------------------------------------------------------

create table if not exists public.athlete_vouches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  voucher_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (request_id, voucher_profile_id)
);

create index if not exists athlete_vouches_voucher_idx
  on public.athlete_vouches (voucher_profile_id, created_at desc);

-- Written and read only through the RPCs below (admins read it in the SQL Editor).
alter table public.athlete_vouches enable row level security;
revoke all on public.athlete_vouches from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. The gate
-- ---------------------------------------------------------------------------------------------

-- One place to change the pending cap. Cents.
create or replace function public.athlete_pending_payout_cap_cents()
returns integer
language sql
immutable
as $$
  select 25000;
$$;

grant execute on function public.athlete_pending_payout_cap_cents() to anon, authenticated;

-- The one question every payout path must ask. Internal (reveals a minor's payout setup state):
-- clients use athlete_payout_allowed (boolean) or get_my_payout_status (their own claim).
--   allowed        may money leave Tapua'i for this athlete at all
--   path           'school' | 'identity' | null
--   cap_cents      null = no cap; otherwise the most that may be paid out in total
--   reason         why it is held: 'disputed' | 'no_claim' | 'needs_payout_setup' | null
create or replace function public.athlete_payout_status(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  req public.verification_requests%rowtype;
  open_claims integer;
  claimant_kyc boolean;
  guardian_kyc boolean;
  guardian_holds boolean;
  vouches integer := 0;
begin
  if target_player_id is null then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'no_claim', 'vouches', 0);
  end if;

  if exists (
    select 1 from public.profiles p
    where p.player_id = target_player_id
      and p.verification_status = 'verified'
      and coalesce(p.is_verified, false)
  ) then
    return jsonb_build_object('allowed', true, 'path', 'school', 'cap_cents', null, 'reason', null, 'vouches', 0);
  end if;

  if exists (
    select 1 from public.verification_requests v
    where v.player_id = target_player_id and v.status = 'disputed'
  ) then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'disputed', 'vouches', 0);
  end if;

  select count(*) into open_claims
  from public.verification_requests v
  where v.player_id = target_player_id and v.status = 'pending';
  if open_claims <> 1 then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'no_claim', 'vouches', 0);
  end if;

  select * into req
  from public.verification_requests v
  where v.player_id = target_player_id and v.status = 'pending'
  limit 1;

  select count(*) into vouches from public.athlete_vouches av where av.request_id = req.id;

  -- players.guardian_id is admin-set only; custodial_accounts.payouts_enabled is server-only.
  select exists (
    select 1
    from public.custodial_accounts ca
    join public.players pl on pl.id = ca.player_id and pl.guardian_id = ca.guardian_id
    where ca.player_id = target_player_id and ca.payouts_enabled
  ) into guardian_kyc;

  guardian_holds := exists (select 1 from public.custodial_accounts ca where ca.player_id = target_player_id)
    and not public.athlete_controls_money(target_player_id);

  select coalesce(p.payouts_enabled, false) into claimant_kyc
  from public.profiles p where p.id = req.requester_user_id;

  if not (guardian_kyc or (coalesce(claimant_kyc, false) and not guardian_holds)) then
    return jsonb_build_object('allowed', false, 'path', null, 'cap_cents', null, 'reason', 'needs_payout_setup', 'vouches', vouches);
  end if;

  return jsonb_build_object(
    'allowed', true,
    'path', 'identity',
    'cap_cents', case when vouches >= 3 then null else public.athlete_pending_payout_cap_cents() end,
    'reason', null,
    'vouches', vouches
  );
end;
$$;

revoke all on function public.athlete_payout_status(uuid) from public, anon, authenticated;

create or replace function public.athlete_payout_allowed(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.athlete_payout_status(target_player_id) ->> 'allowed')::boolean, false);
$$;

-- The gift sheet asks this for guests too ("held" line). A yes/no, nothing about the family.
grant execute on function public.athlete_payout_allowed(uuid) to anon, authenticated;

-- The public badge: confirmed by the school (or a Tapua'i admin), nothing else.
create or replace function public.athlete_is_varsity_verified(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.player_id = target_player_id
      and p.verification_status = 'verified'
      and coalesce(p.is_verified, false)
  );
$$;

grant execute on function public.athlete_is_varsity_verified(uuid) to anon, authenticated;

-- The caller's own claim: which player row (linked, or the open claim) and its gate state.
create or replace function public.my_claimed_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.player_id from public.profiles p
       where p.user_id = auth.uid() and p.verification_status = 'verified' limit 1),
    (select v.player_id from public.verification_requests v
       join public.profiles p on p.id = v.requester_user_id
       where p.user_id = auth.uid() and v.status in ('pending', 'disputed')
       order by v.created_at desc limit 1)
  );
$$;

revoke all on function public.my_claimed_player_id() from public, anon, authenticated;

create or replace function public.get_my_payout_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  target := public.my_claimed_player_id();
  if target is null then
    return null;
  end if;
  return public.athlete_payout_status(target)
    || jsonb_build_object('pending_cap_cents', public.athlete_pending_payout_cap_cents());
end;
$$;

grant execute on function public.get_my_payout_status() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Vouching
-- ---------------------------------------------------------------------------------------------

-- The school the caller may vouch at, or null when they may not vouch yet.
create or replace function public.my_vouching_school_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  req public.verification_requests%rowtype;
begin
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    return null;
  end if;
  if me.verification_status = 'verified' and coalesce(me.is_verified, false) then
    return me.school_id;
  end if;
  select * into req
  from public.verification_requests v
  where v.requester_user_id = me.id and v.status = 'pending'
  limit 1;
  if req.id is null or req.school_id is null then
    return null;
  end if;
  if coalesce((public.athlete_payout_status(req.player_id) ->> 'allowed')::boolean, false) then
    return req.school_id;
  end if;
  return null;
end;
$$;

revoke all on function public.my_vouching_school_id() from public, anon, authenticated;

-- Pending teammates at the caller's school. Empty when the caller may not vouch.
create or replace function public.get_teammates_to_vouch()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me_id uuid;
  school uuid;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;
  select id into me_id from public.profiles where user_id = auth.uid() limit 1;
  school := public.my_vouching_school_id();
  if school is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at)
    from (
      select
        v.id as request_id,
        coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), ''), 'Athlete') as name,
        v.sport,
        v.class_year,
        v.jersey,
        v.created_at,
        (select count(*) from public.athlete_vouches av where av.request_id = v.id) as vouches,
        exists (
          select 1 from public.athlete_vouches av
          where av.request_id = v.id and av.voucher_profile_id = me_id
        ) as vouched_by_me
      from public.verification_requests v
      join public.profiles p on p.id = v.requester_user_id
      where v.school_id = school
        and v.status = 'pending'
        and v.requester_user_id <> me_id
      order by v.created_at
      limit 50
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_teammates_to_vouch() to authenticated;

create or replace function public.vouch_for_teammate(target_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me_id uuid;
  school uuid;
  req public.verification_requests%rowtype;
  today_count integer;
  total integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to vouch for a teammate';
  end if;
  select id into me_id from public.profiles where user_id = auth.uid() limit 1;
  school := public.my_vouching_school_id();
  if school is null then
    raise exception 'Only confirmed athletes at this school can vouch';
  end if;
  select * into req from public.verification_requests where id = target_request_id;
  if req.id is null or req.status <> 'pending' then
    raise exception 'This teammate is not waiting for a vouch';
  end if;
  if req.school_id is distinct from school then
    raise exception 'You can only vouch for teammates at your school';
  end if;
  if req.requester_user_id = me_id then
    raise exception 'You cannot vouch for yourself';
  end if;
  select count(*) into today_count
  from public.athlete_vouches
  where voucher_profile_id = me_id and created_at > timezone('utc', now()) - interval '1 day';
  if today_count >= 10 then
    raise exception 'That is 10 vouches today. Try again tomorrow';
  end if;

  insert into public.athlete_vouches (request_id, voucher_profile_id)
  values (req.id, me_id)
  on conflict (request_id, voucher_profile_id) do nothing;

  select count(*) into total from public.athlete_vouches where request_id = req.id;
  return total;
end;
$$;

grant execute on function public.vouch_for_teammate(uuid) to authenticated;
