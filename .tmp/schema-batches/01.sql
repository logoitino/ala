alter table public.spotlight_awards add column if not exists headline text;
alter table public.spotlight_awards add column if not exists highlight_reel_id uuid references public.reels (id) on delete set null;
alter table public.spotlight_awards add column if not exists start_date date;
alter table public.spotlight_awards add column if not exists end_date date;
alter table public.spotlight_awards add column if not exists created_at timestamptz not null default now();
alter table public.spotlight_awards add column if not exists player_id uuid references public.players (id) on delete set null;
alter table public.spotlight_awards add column if not exists source text not null default 'auto';
alter table public.spotlight_awards add column if not exists locked boolean not null default false;
alter table public.spotlight_awards drop constraint if exists spotlight_awards_source_check;
alter table public.spotlight_awards add constraint spotlight_awards_source_check
  check (source in ('auto', 'manual'));
create index if not exists spotlight_awards_window_idx
  on public.spotlight_awards (start_date, end_date);
create index if not exists spotlight_awards_kind_start_idx
  on public.spotlight_awards (award_type, start_date);
create index if not exists reels_tag_status_idx
  on public.reels (tag_status, created_at desc)
  where coalesce(is_removed, false) = false;
create index if not exists reels_uploaded_by_idx
  on public.reels (uploaded_by);
create index if not exists profiles_player_id_idx
  on public.profiles (player_id);
create table if not exists public.saved_reels (
  user_id uuid not null,
  reel_id uuid not null references public.reels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id)
);
create index if not exists saved_reels_reel_id_idx on public.saved_reels (reel_id);
create table if not exists public.reel_hype_votes (
  user_id uuid not null,
  reel_id uuid not null references public.reels (id) on delete cascade,
  kind text not null check (kind in ('seki', 'aura', 'flex')),
  created_at timestamptz not null default now(),
  primary key (user_id, reel_id, kind)
);
create index if not exists reel_hype_votes_reel_id_idx on public.reel_hype_votes (reel_id);
create table if not exists public.crew_follows (
  follower_id uuid not null,
  athlete_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, athlete_id)
);
create index if not exists crew_follows_athlete_id_idx on public.crew_follows (athlete_id);
create index if not exists crew_follows_follower_id_idx on public.crew_follows (follower_id);
create table if not exists public.crew_push_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,
  athlete_id uuid references public.players (id) on delete cascade,
  reel_id uuid references public.reels (id) on delete cascade,
  kind text not null default 'flash_unlock',
  title text not null default '',
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists crew_push_queue_recipient_idx
  on public.crew_push_queue (recipient_id, created_at desc);
-- A stub `subscriptions` table (no subscriber_id / athlete_id) makes CREATE TABLE IF NOT EXISTS a no-op.
do $$
declare
  has_user_id boolean := false;
  has_subscriber_id boolean := false;
  has_athlete_id boolean := false;
  has_player_id boolean := false;
  id_type text;
  row_count bigint := 0;
begin
  if to_regclass('public.subscriptions') is null then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'user_id'
  ) into has_user_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'subscriber_id'
  ) into has_subscriber_id;

  if has_user_id and not has_subscriber_id then
    alter table public.subscriptions rename column user_id to subscriber_id;
    has_subscriber_id := true;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'player_id'
  ) into has_player_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'athlete_id'
  ) into has_athlete_id;

  if has_player_id and not has_athlete_id then
    alter table public.subscriptions rename column player_id to athlete_id;
    has_athlete_id := true;
  end if;

  select c.udt_name into id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'subscriptions'
    and c.column_name = 'id';

  execute 'select count(*) from public.subscriptions' into row_count;

  if id_type is distinct from 'uuid' or not has_subscriber_id or not has_athlete_id then
    if row_count = 0 then
      drop table public.subscriptions cascade;
    else
      if to_regclass('public.subscriptions_legacy') is not null then
        drop table public.subscriptions_legacy cascade;
      end if;
      alter table public.subscriptions rename to subscriptions_legacy;
    end if;
  end if;
end $$;
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null,
  athlete_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (subscriber_id, athlete_id)
);
create table if not exists public.subscriber_requests (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null,
  athlete_id uuid not null references public.players (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  amount_cents integer not null,
  created_at timestamptz not null default now()
);
alter table public.tips add column if not exists fan_id uuid;
alter table public.tips add column if not exists reel_id uuid;
alter table public.tips add column if not exists aura_points integer not null default 0;
do $$
begin
  alter table public.tips
    add constraint tips_reel_id_fkey
    foreign key (reel_id) references public.reels (id) on delete set null;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create index if not exists tips_fan_id_created_at_idx on public.tips (fan_id, created_at desc);
-- 2026-09 audit: CHECK constraints on money/points columns that had none, so even a bug (or a
-- future direct-table write by an authenticated staff role) can't post a negative tip or Aura award.
do $$
begin
  alter table public.tips add constraint tips_amount_cents_check check (amount_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.tips add constraint tips_aura_points_check check (aura_points >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create table if not exists public.operator_gigs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete set null,
  title text not null,
  venue text not null default '',
  starts_at timestamptz not null default now(),
  status text not null default 'open'
);
create table if not exists public.operator_checkins (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid references public.operator_gigs (id) on delete cascade,
  latitude double precision,
  longitude double precision,
  checked_in_at timestamptz not null default now()
);
create table if not exists public.sponsor_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  placement text not null default 'sideline',
  rivalry text,
  is_active boolean not null default true
);
create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  sponsor_user_id uuid,
  business_name text not null,
  logo_url text not null default '',
  school_team text not null default '',
  tier text not null default 'silver' check (tier in ('silver', 'gold', 'platinum')),
  amount_cents integer not null,
  aura_points integer not null default 0,
  billing_interval text not null default 'month',
  status text not null default 'active',
  created_at timestamptz not null default now()
);
-- 2026-09 fix: this file's `create table if not exists` is a no-op against a `sponsorships` table
-- that already existed (pre-audit) with a different column set — unlike every other table in this
-- file, sponsorships never had the matching `add column if not exists` safety net, so the very next
-- statement (the amount_cents check constraint) crashed with `column "amount_cents" does not exist`
-- on any project that already had this table. Backfilled to match the standalone incremental
-- (`supabase/sponsorships.sql`), which already had this right.
alter table public.sponsorships add column if not exists sponsor_user_id uuid;
alter table public.sponsorships add column if not exists business_name text not null default '';
alter table public.sponsorships add column if not exists logo_url text not null default '';
alter table public.sponsorships add column if not exists school_team text not null default '';
alter table public.sponsorships add column if not exists tier text not null default 'silver';
alter table public.sponsorships add column if not exists amount_cents integer not null default 0;
alter table public.sponsorships add column if not exists aura_points integer not null default 0;
alter table public.sponsorships add column if not exists billing_interval text not null default 'month';
alter table public.sponsorships add column if not exists status text not null default 'active';
alter table public.sponsorships add column if not exists created_at timestamptz not null default now();
do $$
begin
  alter table public.sponsorships add constraint sponsorships_amount_cents_check check (amount_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.sponsorships add constraint sponsorships_aura_points_check check (aura_points >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete set null,
  full_name text not null,
  status text not null default 'pending',
  notes text
);
alter table public.verification_requests
  add column if not exists requester_user_id uuid references public.profiles (id) on delete set null;
alter table public.verification_requests
  add column if not exists school_id uuid references public.schools_and_teams (id) on delete set null;
alter table public.verification_requests
  add column if not exists team_code text;
alter table public.verification_requests
  add column if not exists created_at timestamptz not null default now();
create table if not exists public.disbursements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete set null,
  amount_cents integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
-- 2026-09 fix: same gap as sponsorships above — this table had no column safety net, so
-- `create table if not exists` no-ops against a pre-existing narrower table and the constraint
-- below then fails with `column "amount_cents" does not exist`.
alter table public.disbursements add column if not exists player_id uuid references public.players (id) on delete set null;
alter table public.disbursements add column if not exists amount_cents integer not null default 0;
alter table public.disbursements add column if not exists status text not null default 'pending';
alter table public.disbursements add column if not exists created_at timestamptz not null default now();
do $$
begin
  alter table public.disbursements add constraint disbursements_amount_cents_check check (amount_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
create table if not exists public.telemetry_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  video_id text,
  channel text,
  step text,
  duration_ms integer,
  attempts integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.telemetry_logs add column if not exists video_id text;
alter table public.telemetry_logs add column if not exists channel text;
alter table public.telemetry_logs add column if not exists step text;
alter table public.telemetry_logs add column if not exists duration_ms integer;
alter table public.telemetry_logs add column if not exists attempts integer;
alter table public.telemetry_logs add column if not exists payload jsonb not null default '{}'::jsonb;
create index if not exists telemetry_logs_created_at_idx on public.telemetry_logs (created_at desc);
create index if not exists telemetry_logs_event_type_idx on public.telemetry_logs (event_type, created_at desc);
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when coalesce(is_admin, false)
          or role = 'admin'
          or coalesce(roles, array[]::text[]) @> array['admin']::text[]
        then 'admin'
        else role
      end
      from public.profiles
      where user_id = auth.uid()
      limit 1
    ),
    'guest'
  );
$$;
drop function if exists public.add_user_role(text);
-- 2026-09 audit (self-escalation fix): `add_user_role` always writes `auth.uid()`'s own row and had
-- NO check on which role was being requested — any authenticated session could call
-- `supabase.rpc('add_user_role', { new_role: 'admin' })` and set `is_admin = true` on itself, a full
-- privilege escalation with no verification step. Only `fan` and `athlete` have a real self-service
-- UI path today (`RoleSwitcherModal` → `AuthContext.completeAthleteOnboarding` → `addUserRole
-- ('athlete')`; `fan` is the default/downgrade). `parent` / `operator` / `booster` / `sponsor` /
-- `admin` have no legitimate self-service caller anywhere in the frontend (grepped every
-- `addUserRole(` / `add_user_role` call site: operator access is purely PIN-based with no role
-- grant at all — `lib/operator.ts`'s `OPERATOR_TEST_PIN` never touches `profiles`; there is no
-- "become a booster/parent/sponsor" flow either) — so this RPC now refuses to grant any of those
-- five unless the caller is *already* admin (checked via `current_user_role()` against the row's
-- state before this call runs, i.e. it can never be the thing that makes someone admin for the
-- first time). This closes the RPC path; the matching raw-`UPDATE`-on-`profiles` path is closed
-- separately below by the `guard_profiles_admin_escalation` trigger.
create or replace function public.add_user_role(new_role text)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  next_roles text[];
  normalized text;
  caller_role text;
begin
  normalized := lower(btrim(coalesce(new_role, '')));
  if normalized = '' then
    raise exception 'role required';
  end if;

  if normalized not in ('fan', 'athlete') then
    caller_role := public.current_user_role();
    if caller_role <> 'admin' then
      raise exception 'role % is not self-service', normalized;
    end if;
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