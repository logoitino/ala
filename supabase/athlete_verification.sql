-- Team-code Varsity verification. Claiming athlete/school does NOT auto-verify.
-- Safe to re-run.

alter table public.profiles
  add column if not exists verification_status text not null default 'unverified';

do $$
begin
  alter table public.profiles
    add constraint profiles_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified'));
exception
  when duplicate_object then null;
end $$;

alter table public.schools_and_teams
  add column if not exists team_code text;

create unique index if not exists schools_and_teams_team_code_key
  on public.schools_and_teams (upper(btrim(team_code)))
  where team_code is not null and btrim(team_code) <> '';

-- 2026-09 audit (Round 12 sweep, critical): removed — see apps/mobile/src/backend/db/schema.sql
-- for the full explanation. Never hardcode a real school's `redeem_team_code` secret in a committed
-- file again; set it via the Supabase SQL Editor directly and hand it to the coach out-of-band.

alter table public.verification_requests
  add column if not exists requester_user_id uuid references public.profiles (id) on delete set null;
alter table public.verification_requests
  add column if not exists school_id uuid references public.schools_and_teams (id) on delete set null;
alter table public.verification_requests
  add column if not exists team_code text;
alter table public.verification_requests
  add column if not exists created_at timestamptz not null default now();

-- Claiming Athlete Mode must not mint the Varsity badge.
drop function if exists public.add_user_role(text);

create or replace function public.add_user_role(new_role text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  next_roles text[];
  normalized text;
begin
  normalized := lower(btrim(coalesce(new_role, '')));
  if normalized = '' then
    raise exception 'role required';
  end if;

  update public.profiles
  set
    roles = (
      select coalesce(array_agg(distinct r), array[normalized]::text[])
      from unnest(
        coalesce(roles, array[]::text[])
        || array[normalized]::text[]
        || case when normalized = 'athlete' then array['fan']::text[] else array[]::text[] end
      ) as r
    ),
    role = case
      when normalized = 'admin' then 'admin'
      when normalized = 'athlete' then 'athlete'
      else role
    end,
    is_admin = case when normalized = 'admin' then true else is_admin end,
    active_role = case
      when normalized = 'athlete' then 'athlete'
      when normalized in ('fan', 'athlete') then normalized
      else coalesce(nullif(active_role, ''), 'fan')
    end
  where user_id = auth.uid()
  returning roles into next_roles;

  return next_roles;
end;
$$;

grant execute on function public.add_user_role(text) to anon, authenticated;

-- Prototype: drop auto-Varsity from role conversion unless staff already approved a request.
update public.profiles p
set
  is_verified = false,
  verification_status = 'unverified'
where coalesce(p.is_verified, false) = true
  and coalesce(p.is_admin, false) = false
  and not (coalesce(p.roles, array[]::text[]) @> array['admin']::text[])
  and not exists (
    select 1
    from public.verification_requests v
    where v.status = 'approved'
      and (
        (p.player_id is not null and v.player_id = p.player_id)
        or lower(btrim(v.full_name)) = lower(btrim(p.full_name))
      )
  );

update public.profiles
set verification_status = case
  when coalesce(is_verified, false) then 'verified'
  else coalesce(nullif(verification_status, ''), 'unverified')
end
where verification_status is null
   or (coalesce(is_verified, false) and verification_status <> 'verified')
   or (not coalesce(is_verified, false) and verification_status = 'verified');

create or replace function public.normalize_team_code(raw_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(btrim(coalesce(raw_code, '')), '\s+', '', 'g'));
$$;

create or replace function public.team_code_school_key(raw_code text)
returns text
language plpgsql
immutable
as $$
declare
  n text := public.normalize_team_code(raw_code);
  parts text[];
begin
  if n = '' then
    return '';
  end if;
  parts := string_to_array(n, '-');
  if coalesce(array_length(parts, 1), 0) >= 3 then
    return parts[1] || '-' || parts[array_length(parts, 1)];
  end if;
  return n;
end;
$$;

create or replace function public.sport_from_team_code_token(token text)
returns text
language plpgsql
immutable
as $$
declare
  t text := upper(btrim(coalesce(token, '')));
begin
  return case t
    when 'FB' then 'Football'
    when 'FOOT' then 'Football'
    when 'BKB' then 'Basketball'
    when 'BK' then 'Basketball'
    when 'BBALL' then 'Basketball'
    when 'RUG' then 'Rugby'
    when 'VB' then 'Volleyball'
    when 'VBALL' then 'Volleyball'
    when 'SOC' then 'Soccer'
    when 'BB' then 'Baseball'
    when 'SB' then 'Softball'
    when 'WR' then 'Wrestling'
    when 'TF' then 'Track & Field'
    when 'LAX' then 'Lacrosse'
    when 'HK' then 'Ice Hockey'
    when 'TEN' then 'Tennis'
    else null
  end;
end;
$$;

create or replace function public.athlete_is_varsity_verified(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles cl
    where coalesce(cl.is_verified, false) = true
      and coalesce(cl.verification_status, 'unverified') = 'verified'
      and (
        cl.player_id = target_player_id
        or (
          cl.player_id is null
          and exists (
            select 1
            from public.players p
            where p.id = target_player_id
              and lower(btrim(p.name)) = lower(btrim(cl.full_name))
          )
        )
      )
  );
$$;

-- 2026-09 audit (Round 12 sweep): rate limit — SCHOOL-SPORT-YEAR codes are a small enough
-- keyspace to brute-force via this RPC directly, independent of the git-leak issue fixed above.
alter table public.profiles add column if not exists team_code_fail_count integer not null default 0;
alter table public.profiles add column if not exists team_code_locked_until timestamptz;

create or replace function public.redeem_team_code(raw_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n text := public.normalize_team_code(raw_code);
  school_key text := public.team_code_school_key(raw_code);
  parts text[];
  sport_token text;
  sport_name text;
  me public.profiles%rowtype;
  school public.schools_and_teams%rowtype;
  max_attempts constant integer := 5;
  lockout_minutes constant integer := 15;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if n = '' then
    raise exception 'Team code required';
  end if;

  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    raise exception 'Profile required';
  end if;
  if me.legal_terms_accepted_at is null then
    raise exception 'legal acknowledgement required';
  end if;

  if me.team_code_locked_until is not null and me.team_code_locked_until > timezone('utc', now()) then
    raise exception 'Too many attempts. Try again later.';
  end if;

  -- 2026-09 audit (Round 31/33, mirrored from schema.sql): sets a transaction-local flag so
  -- `guard_profiles_admin_escalation` can tell this function's own legitimate writes to
  -- `team_code_fail_count`/`team_code_locked_until` apart from a raw client update attempting the
  -- same reset.
  perform set_config('app.tapuai_team_code_write', 'true', true);

  select * into school
  from public.schools_and_teams s
  where upper(btrim(coalesce(s.team_code, ''))) in (n, school_key)
  limit 1;

  if school.id is null then
    -- 2026-09 audit (Round 31, mirrored from schema.sql): this used to `raise exception` right
    -- after the update below — an unhandled exception rolls back everything this function did in
    -- the same call, including that same update, since there is no exception handler here. That
    -- meant the fail-count increment (and the lockout it triggers) never actually persisted on a
    -- wrong guess. Returning a graceful `{ok: false, ...}` result instead lets it commit;
    -- `lib/verification.ts`'s `redeemTeamCode()` already re-throws on `ok: false`.
    update public.profiles
    set
      team_code_fail_count = coalesce(team_code_fail_count, 0) + 1,
      team_code_locked_until = case
        when coalesce(team_code_fail_count, 0) + 1 >= max_attempts
          then timezone('utc', now()) + (lockout_minutes || ' minutes')::interval
        else team_code_locked_until
      end
    where id = me.id;
    return jsonb_build_object('ok', false, 'error', 'Unknown team code');
  end if;

  update public.profiles
  set team_code_fail_count = 0, team_code_locked_until = null
  where id = me.id;

  parts := string_to_array(n, '-');
  if coalesce(array_length(parts, 1), 0) >= 3 then
    sport_token := parts[2];
    sport_name := public.sport_from_team_code_token(sport_token);
  end if;

  update public.profiles
  set
    school_id = school.id,
    athlete_division = coalesce(nullif(athlete_division, ''), school.division),
    athlete_sport = coalesce(sport_name, athlete_sport),
    is_verified = true,
    verification_status = 'verified',
    roles = (
      select coalesce(array_agg(distinct r), array['fan', 'athlete']::text[])
      from unnest(coalesce(roles, array['fan']::text[]) || array['athlete', 'fan']::text[]) as r
    ),
    role = case when role in ('admin', 'athlete') then role else 'athlete' end,
    active_role = 'athlete'
  where id = me.id;

  insert into public.verification_requests (
    player_id, full_name, status, notes, requester_user_id, school_id, team_code
  )
  values (
    me.player_id,
    me.full_name,
    'approved',
    'Team code ' || n,
    me.id,
    school.id,
    n
  );

  return jsonb_build_object(
    'ok', true,
    'verification_status', 'verified',
    'school_id', school.id,
    'school_name', school.name,
    'team_code', school.team_code,
    'sport', sport_name
  );
end;
$$;

create or replace function public.request_athlete_verification(request_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  note text := nullif(btrim(coalesce(request_notes, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    raise exception 'Profile required';
  end if;
  if me.legal_terms_accepted_at is null then
    raise exception 'legal acknowledgement required';
  end if;
  if coalesce(me.is_verified, false) or coalesce(me.verification_status, 'unverified') = 'verified' then
    return jsonb_build_object('ok', true, 'verification_status', 'verified', 'already', true);
  end if;

  update public.profiles
  set verification_status = 'pending'
  where id = me.id;

  insert into public.verification_requests (
    player_id, full_name, status, notes, requester_user_id, school_id
  )
  values (
    me.player_id,
    me.full_name,
    'pending',
    coalesce(note, 'Coach / parent approval requested'),
    me.id,
    me.school_id
  );

  return jsonb_build_object(
    'ok', true,
    'verification_status', 'pending',
    'school_id', me.school_id
  );
end;
$$;

drop policy if exists "Athletes insert verification" on public.verification_requests;
create policy "Athletes insert verification"
  on public.verification_requests for insert
  with check (true);

grant execute on function public.normalize_team_code(text) to anon, authenticated;
grant execute on function public.team_code_school_key(text) to anon, authenticated;
grant execute on function public.sport_from_team_code_token(text) to anon, authenticated;
grant execute on function public.athlete_is_varsity_verified(uuid) to anon, authenticated;
grant execute on function public.redeem_team_code(text) to authenticated;
grant execute on function public.request_athlete_verification(text) to authenticated;

-- Re-run supabase/spotlight_auto.sql after this file so Player of the Week uses athlete_is_varsity_verified.
