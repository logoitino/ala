-- Tapua'i RBAC + game-day schema. Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Run in the Supabase SQL editor after enabling the Authentication schema.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  role text not null default 'guest' check (
    role in ('guest', 'fan', 'athlete', 'parent', 'operator', 'booster', 'sponsor', 'admin')
  ),
  full_name text not null,
  is_verified boolean not null default false,
  spirit_points integer not null default 0,
  stripe_connect_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jersey_number integer not null default 0,
  position text not null default '',
  height text not null default '',
  school_name text not null default '',
  backer_count integer not null default 0,
  team text,
  guardian_id uuid references public.profiles (id) on delete set null,
  parental_consent_approved boolean not null default false
);

alter table public.players add column if not exists guardian_id uuid references public.profiles (id) on delete set null;
alter table public.players add column if not exists parental_consent_approved boolean not null default false;
alter table public.players add column if not exists team text;
alter table public.players add column if not exists height text not null default '';
alter table public.players add column if not exists view_count integer not null default 0;
alter table public.players add column if not exists aura_count integer not null default 0;
alter table public.players add column if not exists flex_count integer not null default 0;
alter table public.players add column if not exists seki_count integer not null default 0;
alter table public.players add column if not exists aura_points integer not null default 0;
alter table public.players add column if not exists weight text not null default '';
alter table public.players add column if not exists forty_yard text not null default '';
alter table public.players add column if not exists vertical_jump text not null default '';
alter table public.players add column if not exists vault_locked boolean not null default true;
alter table public.profiles add column if not exists aura_points integer not null default 0;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists roles text[] not null default array['fan']::text[];
alter table public.profiles add column if not exists stripe_onboarding_complete boolean not null default false;
alter table public.profiles add column if not exists payouts_enabled boolean not null default false;
alter table public.profiles add column if not exists active_role text not null default 'fan';

create table if not exists public.athlete_career_stats (
  player_id uuid primary key references public.players (id) on delete cascade,
  sport text not null default 'Football',
  games_played integer not null default 0,
  scoring_value integer not null default 0,
  volume_value integer not null default 0,
  mvp_badges integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_game_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  played_on date not null,
  opponent_school text not null default '',
  stat_line text not null default '',
  scoring_value integer not null default 0,
  volume_value integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists athlete_game_logs_player_played_on_idx
  on public.athlete_game_logs (player_id, played_on desc);

create table if not exists public.athlete_training_badge_unlocks (
  player_id uuid not null references public.players (id) on delete cascade,
  badge_id text not null check (
    badge_id in ('film_room_starter', 'community_backer_magnet', 'friday_night_lights')
  ),
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, badge_id)
);

create index if not exists athlete_training_badge_unlocks_player_idx
  on public.athlete_training_badge_unlocks (player_id, unlocked_at desc);

create table if not exists public.schools_and_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mascot text not null default '',
  level text not null default 'high_school',
  division text not null default 'High School',
  region text not null default 'UT',
  city text not null default '',
  created_at timestamptz not null default now()
);

alter table public.schools_and_teams add column if not exists mascot text not null default '';
alter table public.schools_and_teams add column if not exists level text not null default 'high_school';
alter table public.schools_and_teams add column if not exists division text not null default 'High School';
alter table public.schools_and_teams add column if not exists region text not null default 'UT';
alter table public.schools_and_teams add column if not exists city text not null default '';
alter table public.schools_and_teams add column if not exists created_at timestamptz not null default now();

create unique index if not exists schools_and_teams_name_key on public.schools_and_teams (name);

insert into public.schools_and_teams (id, name, mascot, level, division, region, city)
values
  ('a1000000-0000-4000-8000-000000000001', 'Westlake High', 'Thunder', 'high_school', 'High School', 'UT', 'Saratoga Springs'),
  ('a1000000-0000-4000-8000-000000000002', 'Lone Peak High', 'Knights', 'high_school', 'High School', 'UT', 'Highland'),
  ('a1000000-0000-4000-8000-000000000003', 'American Leadership Academy', 'Hawks', 'high_school', 'High School', 'UT', 'Spanish Fork'),
  ('a1000000-0000-4000-8000-000000000004', 'Skyridge High', 'Sentinels', 'high_school', 'High School', 'UT', 'Lehi'),
  ('a1000000-0000-4000-8000-000000000005', 'American Fork High', 'Cavemen', 'high_school', 'High School', 'UT', 'American Fork'),
  ('a1000000-0000-4000-8000-000000000006', 'Timpview High', 'Thunderbirds', 'high_school', 'High School', 'UT', 'Provo'),
  ('a1000000-0000-4000-8000-000000000011', 'BYU', 'Cougars', 'college', 'NCAA D1', 'Big 12', 'Provo'),
  ('a1000000-0000-4000-8000-000000000012', 'Utah', 'Utes', 'college', 'NCAA D1', 'Big 12', 'Salt Lake City'),
  ('a1000000-0000-4000-8000-000000000013', 'Utah State', 'Aggies', 'college', 'NCAA D1', 'Mountain West', 'Logan'),
  ('a1000000-0000-4000-8000-000000000014', 'Weber State', 'Wildcats', 'college', 'NCAA D1', 'Big Sky', 'Ogden')
on conflict (id) do update set
  name = excluded.name,
  mascot = excluded.mascot,
  level = excluded.level,
  division = excluded.division,
  region = excluded.region,
  city = excluded.city;

alter table public.profiles add column if not exists school_id uuid references public.schools_and_teams (id) on delete set null;
alter table public.profiles add column if not exists athlete_division text;
alter table public.profiles add column if not exists athlete_sport text;
alter table public.profiles add column if not exists athlete_jersey text;
alter table public.profiles add column if not exists athlete_position text;
alter table public.profiles add column if not exists athlete_class_year text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists player_id uuid references public.players (id) on delete set null;

update public.profiles
set is_admin = true
where coalesce(is_admin, false) = false
  and (
    role = 'admin'
    or coalesce(roles, array[]::text[]) @> array['admin']::text[]
  );

update public.profiles
set active_role = 'athlete'
where role = 'athlete'
  and coalesce(active_role, 'fan') <> 'athlete';

update public.profiles
set roles = array[role]::text[]
where cardinality(coalesce(roles, array[]::text[])) = 0
  and role is not null;

update public.profiles
set roles = (
  select array_agg(distinct r)
  from unnest(roles || array[role]::text[]) as r
)
where role is not null
  and not (role = any(roles));

update public.profiles
set roles = (
  select array_agg(distinct r)
  from unnest(roles || array['fan']::text[]) as r
)
where role = 'athlete'
  and not ('fan' = any(roles));

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  home_school text not null default '',
  away_school text not null default '',
  home_score integer not null default 0,
  away_score integer not null default 0,
  quarter text not null default 'Q1',
  status text not null default 'live',
  venue text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.games add column if not exists quarter text not null default 'Q1';
alter table public.games add column if not exists home_school text not null default '';
alter table public.games add column if not exists away_school text not null default '';
alter table public.games add column if not exists is_active boolean not null default true;
alter table public.games add column if not exists updated_at timestamptz not null default now();
alter table public.games add column if not exists clock text not null default '12:00';
alter table public.games add column if not exists created_at timestamptz not null default now();
alter table public.games add column if not exists claimed_by uuid;
alter table public.games add column if not exists is_clock_running boolean not null default false;

do $$
begin
  alter table public.games
    add constraint games_claimed_by_fkey
    foreign key (claimed_by) references public.profiles (id) on delete set null;
exception
  when duplicate_object then null;
  when undefined_table then null;
end $$;

update public.games
set quarter = status
where status in ('Q1', 'Q2', 'Q3', 'Q4', 'Halftime', 'Final');

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  game_id uuid references public.games (id) on delete set null,
  event_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.game_events
  add column if not exists game_id uuid references public.games (id) on delete set null;

alter table public.game_events alter column player_id drop not null;

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  title text not null default '',
  player_id uuid references public.players (id) on delete set null,
  game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.reels add column if not exists video_url text not null default '';
alter table public.reels add column if not exists title text not null default '';
alter table public.reels add column if not exists player_id uuid references public.players (id) on delete set null;
alter table public.reels add column if not exists game_id uuid references public.games (id) on delete set null;
alter table public.reels add column if not exists created_at timestamptz not null default now();
alter table public.reels add column if not exists seki_count integer not null default 0;
alter table public.reels add column if not exists aura_count integer not null default 0;
alter table public.reels add column if not exists flex_count integer not null default 0;
alter table public.reels add column if not exists total_tips_cents integer not null default 0;
alter table public.reels add column if not exists is_exclusive boolean not null default false;
alter table public.reels add column if not exists is_vault_only boolean not null default false;

update public.reels
set is_vault_only = true
where coalesce(is_exclusive, false) = true
  and coalesce(is_vault_only, false) = false;
alter table public.reels add column if not exists is_flagged boolean not null default false;
alter table public.reels add column if not exists reported_by uuid[] not null default '{}'::uuid[];
alter table public.reels add column if not exists is_removed boolean not null default false;
alter table public.reels add column if not exists category text not null default 'game_play';

alter table public.reels drop constraint if exists reels_category_check;
alter table public.reels add constraint reels_category_check
  check (category in ('game_play', 'train_like_me', 'serve_like_me'));
alter table public.reels add column if not exists flash_unlock_until timestamptz;
alter table public.reels add column if not exists uploaded_by uuid references public.profiles (id) on delete set null;
alter table public.reels add column if not exists tag_status text;
alter table public.reels add column if not exists tag_confirmed_at timestamptz;
alter table public.reels add column if not exists tag_confirmed_by uuid references public.profiles (id) on delete set null;

update public.reels
set tag_status = 'confirmed',
    tag_confirmed_at = coalesce(tag_confirmed_at, created_at)
where tag_status is null;

alter table public.reels alter column tag_status set default 'pending';
alter table public.reels alter column tag_status set not null;
alter table public.reels drop constraint if exists reels_tag_status_check;
alter table public.reels add constraint reels_tag_status_check
  check (tag_status in ('pending', 'confirmed', 'rejected'));

create table if not exists public.spotlight_awards (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.profiles (id) on delete cascade,
  award_type text not null,
  level text not null default 'school',
  school_id uuid references public.schools_and_teams (id) on delete set null,
  district_region text,
  headline text not null,
  highlight_reel_id uuid references public.reels (id) on delete set null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

alter table public.spotlight_awards add column if not exists athlete_id uuid references public.profiles (id) on delete cascade;
alter table public.spotlight_awards add column if not exists award_type text;
alter table public.spotlight_awards add column if not exists level text not null default 'school';
alter table public.spotlight_awards add column if not exists school_id uuid references public.schools_and_teams (id) on delete set null;
alter table public.spotlight_awards add column if not exists district_region text;
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
end $$;

create index if not exists tips_fan_id_created_at_idx on public.tips (fan_id, created_at desc);

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

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete set null,
  full_name text not null,
  status text not null default 'pending',
  notes text
);

create table if not exists public.disbursements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete set null,
  amount_cents integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

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
    end,
    is_verified = case when normalized = 'athlete' then true else is_verified end
  where user_id = auth.uid()
  returning roles into next_roles;

  return next_roles;
end;
$$;

create or replace function public.increment_backer_count(target_player_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  update public.players
  set backer_count = coalesce(backer_count, 0) + 1
  where id = target_player_id
  returning backer_count into new_count;

  return new_count;
end;
$$;

drop function if exists public.add_user_aura(uuid, integer);
drop function if exists public.get_aura_tier(integer);

create or replace function public.add_user_aura(target_user_id uuid, points_to_add integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  add_points integer;
  player_total integer;
  profile_total integer;
begin
  add_points := greatest(coalesce(points_to_add, 0), 0);

  update public.players
  set aura_points = coalesce(aura_points, 0) + add_points
  where id = target_user_id
  returning aura_points into player_total;

  update public.profiles
  set aura_points = coalesce(aura_points, 0) + add_points
  where user_id = target_user_id or id = target_user_id
  returning aura_points into profile_total;

  return jsonb_build_object(
    'aura_points', coalesce(player_total, profile_total, add_points),
    'player_aura_points', player_total,
    'profile_aura_points', profile_total,
    'points_added', add_points
  );
end;
$$;

create or replace function public.get_aura_tier(points integer)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'tier', ranked.tier,
    'title', ranked.title,
    'min_points', ranked.min_points,
    'color', ranked.color
  )
  from (
    select *
    from (
      values
        (1, 0, 'Slate Silver', '#94A3B8'),
        (2, 8, 'Island Cyan', '#00E5FF'),
        (3, 20, 'Neon Jade', '#00E676'),
        (4, 40, 'Electric Violet', '#B388FF'),
        (5, 70, 'Crimson Ember', '#FF1744'),
        (6, 110, 'Polished Gold', '#FFD700'),
        (7, 170, 'Celestial Prism', '#00E676')
    ) as t(tier, min_points, title, color)
    where greatest(coalesce(points, 0), 0) >= t.min_points
    order by t.min_points desc
    limit 1
  ) ranked;
$$;

create or replace function public.increment_player_hype(target_player_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.players%rowtype;
begin
  if hype_kind = 'view' then
    update public.players
    set view_count = coalesce(view_count, 0) + 1
    where id = target_player_id
    returning * into result;
  elsif hype_kind = 'aura' then
    update public.players
    set aura_count = coalesce(aura_count, 0) + 1
    where id = target_player_id
    returning * into result;
  elsif hype_kind = 'flex' then
    update public.players
    set flex_count = coalesce(flex_count, 0) + 1
    where id = target_player_id
    returning * into result;
  elsif hype_kind = 'seki' then
    update public.players
    set seki_count = coalesce(seki_count, 0) + 1
    where id = target_player_id
    returning * into result;
  else
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  return jsonb_build_object(
    'view_count', coalesce(result.view_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'seki_count', coalesce(result.seki_count, 0)
  );
end;
$$;

create or replace function public.increment_reel_hype(target_reel_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reels%rowtype;
  viewer uuid := auth.uid();
  applied boolean := true;
begin
  if hype_kind not in ('aura', 'flex', 'seki') then
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  if viewer is not null then
    begin
      insert into public.reel_hype_votes (user_id, reel_id, kind)
      values (viewer, target_reel_id, hype_kind);
    exception
      when unique_violation then
        applied := false;
    end;
  end if;

  if applied then
    if hype_kind = 'aura' then
      update public.reels
      set aura_count = coalesce(aura_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    elsif hype_kind = 'flex' then
      update public.reels
      set flex_count = coalesce(flex_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    else
      update public.reels
      set seki_count = coalesce(seki_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    end if;
    perform public.sync_live_spotlight_awards();
  else
    select * into result from public.reels where id = target_reel_id;
  end if;

  return jsonb_build_object(
    'seki_count', coalesce(result.seki_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'total_tips_cents', coalesce(result.total_tips_cents, 0),
    'applied', applied
  );
end;
$$;

create or replace function public.increment_reel_tips(target_reel_id uuid, add_cents integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_total integer;
begin
  update public.reels
  set total_tips_cents = coalesce(total_tips_cents, 0) + greatest(coalesce(add_cents, 0), 0)
  where id = target_reel_id
  returning total_tips_cents into new_total;

  return coalesce(new_total, 0);
end;
$$;

create or replace function public.spotlight_normalize_kind(period_kind text)
returns text
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(period_kind, 'week'))) in ('month', 'player_of_the_month') then 'month'
    when lower(btrim(coalesce(period_kind, 'week'))) in ('year', 'player_of_the_year') then 'year'
    else 'week'
  end;
$$;

create or replace function public.spotlight_window(
  period_kind text,
  as_of date default (timezone('utc', now()))::date
)
returns table (window_start date, window_end date)
language plpgsql
stable
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  origin timestamptz := timezone('utc', as_of::timestamp);
begin
  if kind = 'month' then
    window_start := date_trunc('month', origin)::date;
    window_end := (date_trunc('month', origin) + interval '1 month' - interval '1 day')::date;
  elsif kind = 'year' then
    window_start := date_trunc('year', origin)::date;
    window_end := (date_trunc('year', origin) + interval '1 year' - interval '1 day')::date;
  else
    window_start := date_trunc('week', origin)::date;
    window_end := (window_start + 6)::date;
  end if;
  return next;
end;
$$;

create or replace function public.can_confirm_player_tag(target_player_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_name text := public.current_user_role();
  athlete public.players%rowtype;
begin
  if target_player_id is null then
    return false;
  end if;
  if role_name = 'admin' or auth.role() = 'anon' then
    return true;
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    return false;
  end if;

  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;
  if actor is null then
    return false;
  end if;

  if athlete.guardian_id is not null and athlete.guardian_id = actor then
    return true;
  end if;

  if exists (
    select 1
    from public.profiles pr
    left join public.schools_and_teams s on s.id = pr.school_id
    where pr.id = actor
      and (
        pr.player_id = athlete.id
        or lower(pr.full_name) = lower(athlete.name)
        or (
          nullif(btrim(coalesce(pr.athlete_jersey, '')), '') is not null
          and btrim(pr.athlete_jersey) = athlete.jersey_number::text
          and s.id is not null
          and (
            lower(s.name) = lower(athlete.school_name)
            or lower(s.name) = lower(coalesce(athlete.team, ''))
          )
        )
      )
  ) then
    return true;
  end if;

  if role_name = 'operator'
     or exists (
       select 1 from public.profiles pr
       where pr.id = actor
         and coalesce(pr.roles, array[]::text[]) @> array['operator']::text[]
     )
  then
    if exists (
      select 1
      from public.profiles pr
      join public.schools_and_teams s on s.id = pr.school_id
      where pr.id = actor
        and (
          lower(s.name) = lower(athlete.school_name)
          or lower(s.name) = lower(coalesce(athlete.team, ''))
        )
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.reels_apply_tag_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  should_set boolean := false;
begin
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  if NEW.uploaded_by is null then
    NEW.uploaded_by := actor;
  end if;

  if TG_OP = 'INSERT' then
    should_set := true;
  elsif TG_OP = 'UPDATE' and NEW.player_id is distinct from OLD.player_id then
    NEW.tag_status := 'pending';
    NEW.tag_confirmed_at := null;
    NEW.tag_confirmed_by := null;
    should_set := true;
  end if;

  if not should_set then
    return NEW;
  end if;

  if NEW.player_id is null then
    NEW.tag_status := 'pending';
    return NEW;
  end if;

  if public.can_confirm_player_tag(NEW.player_id)
     and public.current_user_role() <> 'guest'
     and auth.role() <> 'anon'
  then
    NEW.tag_status := 'confirmed';
    NEW.tag_confirmed_at := timezone('utc', now());
    NEW.tag_confirmed_by := actor;
  else
    NEW.tag_status := 'pending';
    NEW.tag_confirmed_at := null;
    NEW.tag_confirmed_by := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists reels_apply_tag_defaults on public.reels;
create trigger reels_apply_tag_defaults
  before insert or update of player_id, uploaded_by, tag_status
  on public.reels
  for each row
  execute procedure public.reels_apply_tag_defaults();

create or replace function public.confirm_reel_player_tag(target_reel_id uuid, tag_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(tag_action, '')));
  clip public.reels%rowtype;
  actor uuid;
  next_status text;
begin
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;
  if clip.player_id is null then
    raise exception 'This clip has no tagged player.';
  end if;
  if not public.can_confirm_player_tag(clip.player_id) then
    raise exception 'Only the tagged athlete, their parent, a school operator, or admin can verify this tag.';
  end if;

  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  next_status := case when action = 'reject' then 'rejected' else 'confirmed' end;

  update public.reels
  set
    tag_status = next_status,
    tag_confirmed_at = timezone('utc', now()),
    tag_confirmed_by = actor
  where id = target_reel_id
  returning * into clip;

  if next_status = 'confirmed' and actor is not null then
    update public.profiles
    set player_id = clip.player_id
    where id = actor
      and player_id is null
      and (
        public.current_user_role() in ('athlete', 'fan', 'admin')
        or coalesce(roles, array[]::text[]) && array['athlete', 'admin']::text[]
      );
  end if;

  perform public.sync_live_spotlight_awards();

  return jsonb_build_object(
    'id', clip.id,
    'player_id', clip.player_id,
    'tag_status', clip.tag_status,
    'tag_confirmed_at', clip.tag_confirmed_at
  );
end;
$$;

create or replace function public.get_pending_player_tags()
returns table (
  id uuid,
  title text,
  video_url text,
  player_id uuid,
  player_name text,
  school_name text,
  created_at timestamptz,
  seki_count integer,
  aura_count integer,
  flex_count integer,
  uploader_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_name text := public.current_user_role();
begin
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  return query
  select
    r.id,
    r.title,
    r.video_url,
    r.player_id,
    p.name,
    p.school_name,
    r.created_at,
    coalesce(r.seki_count, 0),
    coalesce(r.aura_count, 0),
    coalesce(r.flex_count, 0),
    coalesce(nullif(btrim(uploader.full_name), ''), nullif(btrim(uploader.username), ''))
  from public.reels r
  join public.players p on p.id = r.player_id
  left join public.profiles uploader on uploader.id = r.uploaded_by
  where r.tag_status = 'pending'
    and coalesce(r.is_removed, false) = false
    and (
      role_name = 'admin'
      or auth.role() = 'anon'
      or public.can_confirm_player_tag(r.player_id)
    )
  order by r.created_at desc
  limit 40;
end;
$$;

create or replace function public.get_spotlight_standings(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  leaders jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  select coalesce(jsonb_agg(ranked.row_data order by ranked.hype desc, ranked.created_at desc), '[]'::jsonb)
    into leaders
  from (
    select
      jsonb_build_object(
        'rank', row_number() over (order by scored.hype desc, scored.created_at desc),
        'player_id', scored.player_id,
        'name', scored.player_name,
        'school_name', scored.school_name,
        'hype', scored.hype,
        'seki', scored.seki,
        'aura', scored.aura,
        'flex', scored.flex,
        'reel_id', scored.reel_id,
        'title', scored.clip_title,
        'shot_by', scored.shot_by
      ) as row_data,
      scored.hype,
      scored.created_at
    from (
      select
        p.id as player_id,
        p.name as player_name,
        p.school_name,
        sum(coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0))::int as hype,
        sum(coalesce(r.seki_count, 0))::int as seki,
        sum(coalesce(r.aura_count, 0))::int as aura,
        sum(coalesce(r.flex_count, 0))::int as flex,
        (
          select hot.id
          from public.reels hot
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as reel_id,
        (
          select hot.title
          from public.reels hot
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as clip_title,
        (
          select coalesce(nullif(btrim(pr.username), ''), nullif(btrim(pr.full_name), ''))
          from public.reels hot
          left join public.profiles pr on pr.id = hot.uploaded_by
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as shot_by,
        max(r.created_at) as created_at
      from public.reels r
      join public.players p on p.id = r.player_id
      where r.tag_status = 'confirmed'
        and coalesce(r.is_removed, false) = false
        and coalesce(r.is_vault_only, false) = false
        and coalesce(r.is_flagged, false) = false
        and coalesce(r.category, 'game_play') = 'game_play'
        and r.created_at::date between bounds.window_start and bounds.window_end
      group by p.id, p.name, p.school_name
      having sum(coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) > 0
    ) scored
  ) ranked;

  return jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'leaders', coalesce(leaders, '[]'::jsonb)
  );
end;
$$;

create or replace function public.sync_spotlight_period(period_kind text default 'week')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  payload jsonb;
  leader jsonb;
  existing public.spotlight_awards%rowtype;
  linked uuid;
  award_id uuid;
  headline text;
  period_title text;
  shot_by text;
begin
  select * into bounds from public.spotlight_window(kind);
  payload := public.get_spotlight_standings(kind);
  leader := payload -> 'leaders' -> 0;

  select * into existing
  from public.spotlight_awards a
  where a.award_type = kind
    and a.start_date = bounds.window_start
  order by a.created_at desc
  limit 1;

  if existing.id is not null and coalesce(existing.locked, false) then
    return jsonb_build_object(
      'crowned', false,
      'locked', true,
      'id', existing.id,
      'period_kind', kind,
      'player_id', existing.player_id,
      'headline', existing.headline
    );
  end if;

  if leader is null or leader = 'null'::jsonb then
    return jsonb_build_object(
      'crowned', false,
      'locked', false,
      'period_kind', kind,
      'reason', 'no_confirmed_hype'
    );
  end if;

  period_title := case
    when kind = 'year' then 'Player of the Year'
    when kind = 'month' then 'Player of the Month'
    else 'Player of the Week'
  end;
  headline := nullif(btrim(coalesce(leader ->> 'title', '')), '');
  if headline is null then
    headline := format(
      '%s hype · %s Seki · %s Aura · %s Flex',
      coalesce(leader ->> 'hype', '0'),
      coalesce(leader ->> 'seki', '0'),
      coalesce(leader ->> 'aura', '0'),
      coalesce(leader ->> 'flex', '0')
    );
  end if;
  shot_by := nullif(btrim(coalesce(leader ->> 'shot_by', '')), '');
  if shot_by is not null
     and lower(shot_by) is distinct from lower(coalesce(leader ->> 'name', ''))
  then
    headline := headline || ' · Clip by ' || shot_by;
  end if;

  select pr.id into linked
  from public.profiles pr
  where pr.player_id = (leader ->> 'player_id')::uuid
     or lower(pr.full_name) = lower(leader ->> 'name')
  order by case when pr.player_id = (leader ->> 'player_id')::uuid then 0 else 1 end
  limit 1;

  if existing.id is not null then
    update public.spotlight_awards
    set
      athlete_id = linked,
      player_id = (leader ->> 'player_id')::uuid,
      award_type = kind,
      level = 'platform',
      district_region = leader ->> 'school_name',
      headline = headline,
      highlight_reel_id = nullif(leader ->> 'reel_id', '')::uuid,
      start_date = bounds.window_start,
      end_date = bounds.window_end,
      source = 'auto',
      locked = false
    where id = existing.id
    returning id into award_id;
  else
    insert into public.spotlight_awards (
      athlete_id, player_id, award_type, level, district_region, headline,
      highlight_reel_id, start_date, end_date, source, locked
    )
    values (
      linked,
      (leader ->> 'player_id')::uuid,
      kind,
      'platform',
      leader ->> 'school_name',
      headline,
      nullif(leader ->> 'reel_id', '')::uuid,
      bounds.window_start,
      bounds.window_end,
      'auto',
      false
    )
    returning id into award_id;
  end if;

  return jsonb_build_object(
    'crowned', true,
    'locked', false,
    'id', award_id,
    'period_kind', kind,
    'player_id', leader ->> 'player_id',
    'reel_id', leader ->> 'reel_id',
    'headline', headline,
    'hype', leader -> 'hype',
    'title', period_title
  );
end;
$$;

create or replace function public.sync_live_spotlight_awards()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'week', public.sync_spotlight_period('week'),
    'month', public.sync_spotlight_period('month'),
    'year', public.sync_spotlight_period('year')
  );
end;
$$;

create or replace function public.unlock_spotlight_period(period_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  select * into bounds from public.spotlight_window(kind);
  update public.spotlight_awards
  set locked = false,
      source = 'auto'
  where award_type = kind
    and start_date = bounds.window_start;
  return public.sync_spotlight_period(kind);
end;
$$;

drop function if exists public.toggle_reel_vault_status(uuid);

create or replace function public.toggle_reel_vault_status(target_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  next_vault boolean;
begin
  if actor is null then
    raise exception 'Sign in to change vault status.';
  end if;

  update public.reels
  set
    is_vault_only = not coalesce(is_vault_only, is_exclusive, false),
    is_exclusive = not coalesce(is_vault_only, is_exclusive, false)
  where id = target_reel_id
  returning is_vault_only into next_vault;

  if next_vault is null then
    raise exception 'Highlight not found.';
  end if;

  return next_vault;
end;
$$;

drop function if exists public.set_player_vault_locked(uuid, boolean);

create or replace function public.set_player_vault_locked(target_player_id uuid, is_locked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  next_locked boolean;
begin
  if actor is null then
    raise exception 'Sign in to lock or open the Vault.';
  end if;

  update public.players
  set vault_locked = coalesce(is_locked, true)
  where id = target_player_id
  returning vault_locked into next_locked;

  if next_locked is null then
    raise exception 'Athlete not found.';
  end if;

  return next_locked;
end;
$$;

drop function if exists public.get_crew_graph(uuid);
create or replace function public.get_crew_graph(target_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  crew_n integer := 0;
  squad_n integer := 0;
  is_following boolean := false;
  is_mutual boolean := false;
  viewer_player uuid;
  athlete_user uuid;
begin
  select count(*)::int into crew_n
  from public.crew_follows
  where athlete_id = target_athlete_id;

  select p.user_id into athlete_user
  from public.profiles p
  join public.players pl on lower(trim(p.full_name)) = lower(trim(pl.name))
  where pl.id = target_athlete_id
    and p.user_id is not null
  limit 1;

  if athlete_user is not null then
    select count(*)::int into squad_n
    from public.crew_follows
    where follower_id = athlete_user;
  end if;

  if actor is not null then
    select exists(
      select 1
      from public.crew_follows
      where follower_id = actor
        and athlete_id = target_athlete_id
    ) into is_following;

    select pl.id into viewer_player
    from public.players pl
    join public.profiles p on lower(trim(pl.name)) = lower(trim(p.full_name))
    where p.user_id = actor
    limit 1;

    if is_following and viewer_player is not null and athlete_user is not null then
      select exists(
        select 1
        from public.crew_follows
        where follower_id = athlete_user
          and athlete_id = viewer_player
      ) into is_mutual;
    end if;
  end if;

  return jsonb_build_object(
    'crew_count', coalesce(crew_n, 0),
    'squad_count', coalesce(squad_n, 0),
    'following', coalesce(is_following, false),
    'mutual', coalesce(is_mutual, false)
  );
end;
$$;

drop function if exists public.toggle_crew_follow(uuid, boolean);
create or replace function public.toggle_crew_follow(target_athlete_id uuid, should_join boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to join the Crew.';
  end if;

  if not exists (select 1 from public.players where id = target_athlete_id) then
    raise exception 'Athlete not found.';
  end if;

  if should_join then
    insert into public.crew_follows (follower_id, athlete_id)
    values (actor, target_athlete_id)
    on conflict (follower_id, athlete_id) do nothing;
  else
    delete from public.crew_follows
    where follower_id = actor
      and athlete_id = target_athlete_id;
  end if;

  return public.get_crew_graph(target_athlete_id);
end;
$$;

drop function if exists public.set_reel_flash_unlock(uuid);
create or replace function public.set_reel_flash_unlock(target_reel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  until_at timestamptz := timezone('utc', now()) + interval '2 hours';
  clip public.reels%rowtype;
  notified integer := 0;
begin
  if actor is null then
    raise exception 'Sign in to flash-unlock a Highlight.';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;

  update public.reels
  set flash_unlock_until = until_at
  where id = target_reel_id;

  if clip.player_id is not null then
    insert into public.crew_push_queue (recipient_id, athlete_id, reel_id, kind, title, body, payload)
    select
      f.follower_id,
      clip.player_id,
      clip.id,
      'flash_unlock',
      '⚡ Flash Unlock',
      'A Vault Highlight is open for 2 hours.',
      jsonb_build_object(
        'reel_id', clip.id,
        'athlete_id', clip.player_id,
        'flash_unlock_until', until_at,
        'kind', 'flash_unlock'
      )
    from public.crew_follows f
    where f.athlete_id = clip.player_id;

    get diagnostics notified = row_count;
  end if;

  return jsonb_build_object(
    'flash_unlock_until', until_at,
    'notified_count', coalesce(notified, 0)
  );
end;
$$;

drop function if exists public.get_active_spotlight_award(uuid);

create or replace function public.get_active_spotlight_award(viewer_user_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  award_id uuid;
  award_athlete uuid;
  award_player uuid;
  award_kind text;
  award_headline text;
  award_reel uuid;
  award_start date;
  award_region text;
  award_school uuid;
  school_label text;
  profile_name text;
  athlete public.players%rowtype;
  clip_id uuid;
  clip_url text;
  clip_uploader text;
  period_kind text;
  period_title text;
begin
  perform viewer_user_id;
  perform public.sync_live_spotlight_awards();

  select
    a.id,
    a.athlete_id,
    a.player_id,
    a.award_type,
    a.headline,
    a.highlight_reel_id,
    a.start_date,
    a.district_region,
    a.school_id
  into
    award_id,
    award_athlete,
    award_player,
    award_kind,
    award_headline,
    award_reel,
    award_start,
    award_region,
    award_school
  from public.spotlight_awards a
  where timezone('utc', now())::date between a.start_date and a.end_date
  order by
    case
      when lower(a.award_type) in ('week', 'player_of_the_week') then 0
      when lower(a.award_type) in ('month', 'player_of_the_month') then 1
      else 2
    end,
    a.created_at desc
  limit 1;

  if award_id is null then
    return null;
  end if;

  period_kind := public.spotlight_normalize_kind(award_kind);
  period_title := case
    when period_kind = 'year' then 'Player of the Year'
    when period_kind = 'month' then 'Player of the Month'
    else 'Player of the Week'
  end;

  if award_school is not null then
    select s.name into school_label from public.schools_and_teams s where s.id = award_school;
  end if;

  if award_player is not null then
    select * into athlete from public.players p where p.id = award_player;
  end if;

  if athlete.id is null and award_athlete is not null then
    select pr.full_name, pr.player_id into profile_name, award_player
    from public.profiles pr where pr.id = award_athlete;
    if award_player is not null then
      select * into athlete from public.players p where p.id = award_player;
    end if;
    if athlete.id is null then
      select * into athlete from public.players p where p.id = award_athlete;
    end if;
  end if;

  if athlete.id is null and profile_name is not null then
    select * into athlete
    from public.players p
    where lower(p.name) = lower(profile_name)
    limit 1;
  end if;

  clip_id := award_reel;
  if clip_id is not null then
    select r.video_url into clip_url from public.reels r where r.id = clip_id;
    select coalesce(nullif(btrim(pr.username), ''), nullif(btrim(pr.full_name), ''))
      into clip_uploader
    from public.reels r
    left join public.profiles pr on pr.id = r.uploaded_by
    where r.id = clip_id
      and r.uploaded_by is not null
      and (athlete.id is null or r.uploaded_by is distinct from (
        select pr2.id from public.profiles pr2 where pr2.player_id = athlete.id limit 1
      ))
      and lower(coalesce(pr.full_name, '')) is distinct from lower(coalesce(athlete.name, ''));
  end if;

  if clip_url is null and athlete.id is not null then
    select r.id, r.video_url
      into clip_id, clip_url
    from public.reels r
    where r.player_id = athlete.id
      and r.tag_status = 'confirmed'
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_removed, false) = false
    order by (coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) desc,
      r.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'id', award_id,
    'player_id', athlete.id,
    'reel_id', clip_id,
    'period_kind', period_kind,
    'period_start', award_start,
    'school_name', coalesce(nullif(trim(school_label), ''), nullif(trim(award_region), ''), athlete.school_name, 'Westlake High'),
    'headline', coalesce(nullif(trim(award_headline), ''), '4 Touchdowns & 12 Tackles'),
    'title', period_title,
    'is_active', true,
    'video_url', clip_url,
    'shot_by', clip_uploader,
    'player', case when athlete.id is null then null else to_jsonb(athlete) end
  );
end;
$$;

drop function if exists public.report_reel(uuid);

create or replace function public.report_reel(target_reel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter uuid := auth.uid();
  result public.reels%rowtype;
begin
  if reporter is null then
    raise exception 'Sign in to report a highlight.';
  end if;
  update public.reels
  set
    is_flagged = true,
    reported_by = case
      when coalesce(reported_by, '{}'::uuid[]) @> array[reporter] then coalesce(reported_by, '{}'::uuid[])
      else array_append(coalesce(reported_by, '{}'::uuid[]), reporter)
    end
  where id = target_reel_id
  returning * into result;
  if result.id is null then
    raise exception 'Highlight not found.';
  end if;
  return jsonb_build_object(
    'id', result.id,
    'is_flagged', result.is_flagged,
    'reported_by', result.reported_by
  );
end;
$$;

drop function if exists public.publish_spotlight_award(uuid, text, text, date, date);

create or replace function public.publish_spotlight_award(
  target_player_id uuid,
  award_headline text,
  period_kind text,
  window_start date,
  window_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  headline text := btrim(coalesce(award_headline, ''));
  athlete public.players%rowtype;
  linked uuid;
  clip uuid;
  award_id uuid;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  if kind not in ('week', 'month', 'year') then
    raise exception 'Unknown period_kind %', period_kind;
  end if;
  if headline = '' then
    raise exception 'Headline required';
  end if;
  if window_start is null or window_end is null or window_end < window_start then
    raise exception 'Valid start and end dates required';
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    raise exception 'Athlete not found.';
  end if;

  select pr.id into linked
  from public.profiles pr
  where pr.player_id = target_player_id
     or pr.id = target_player_id
     or lower(pr.full_name) = lower(athlete.name)
  order by case when pr.player_id = target_player_id then 0 when pr.id = target_player_id then 1 else 2 end
  limit 1;

  select r.id into clip
  from public.reels r
  where r.player_id = athlete.id
    and r.tag_status = 'confirmed'
    and coalesce(r.is_removed, false) = false
    and coalesce(r.is_vault_only, false) = false
  order by (coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) desc,
    r.created_at desc
  limit 1;

  update public.spotlight_awards
  set
    athlete_id = linked,
    player_id = athlete.id,
    award_type = kind,
    level = 'platform',
    district_region = athlete.school_name,
    headline = headline,
    highlight_reel_id = clip,
    start_date = window_start,
    end_date = window_end,
    source = 'manual',
    locked = true
  where award_type = kind
    and start_date = window_start
  returning id into award_id;

  if award_id is null then
    insert into public.spotlight_awards (
      athlete_id, player_id, award_type, level, district_region, headline,
      highlight_reel_id, start_date, end_date, source, locked
    )
    values (
      linked, athlete.id, kind, 'platform', athlete.school_name, headline,
      clip, window_start, window_end, 'manual', true
    )
    returning id into award_id;
  end if;

  return jsonb_build_object(
    'id', award_id,
    'athlete_id', linked,
    'player_id', athlete.id,
    'headline', headline,
    'highlight_reel_id', clip,
    'start_date', window_start,
    'end_date', window_end,
    'award_type', kind,
    'source', 'manual',
    'locked', true
  );
end;
$$;

drop function if exists public.moderate_flagged_reel(uuid, text);

create or replace function public.moderate_flagged_reel(
  target_reel_id uuid,
  moderation_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(moderation_action, '')));
  result public.reels%rowtype;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  if action not in ('dismiss', 'remove') then
    raise exception 'Unknown moderation_action %', moderation_action;
  end if;

  if action = 'dismiss' then
    update public.reels
    set is_flagged = false
    where id = target_reel_id
    returning * into result;
  else
    update public.reels
    set is_removed = true, is_flagged = false
    where id = target_reel_id
    returning * into result;
  end if;

  if result.id is null then
    raise exception 'Highlight not found.';
  end if;

  return jsonb_build_object(
    'id', result.id,
    'is_flagged', result.is_flagged,
    'is_removed', coalesce(result.is_removed, false)
  );
end;
$$;

drop function if exists public.get_admin_platform_metrics();

create or replace function public.get_admin_platform_metrics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'highlight_count', (
      select count(*)::int from public.reels where coalesce(is_removed, false) = false
    ),
    'engagement_count', (
      select coalesce(sum(coalesce(seki_count, 0) + coalesce(aura_count, 0) + coalesce(flex_count, 0)), 0)::int
      from public.reels
      where coalesce(is_removed, false) = false
    ),
    'malo_cents', (
      select coalesce(sum(amount_cents), 0)::int from public.tips
    ),
    'open_flags', (
      select count(*)::int
      from public.reels
      where coalesce(is_flagged, false) = true
        and coalesce(is_removed, false) = false
    ),
    'telemetry_events_24h', (
      select count(*)::int
      from public.telemetry_logs
      where created_at >= timezone('utc', now()) - interval '24 hours'
    )
  );
$$;

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
  school_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.player_id,
    t.reel_id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(p.name, 'Athlete') as athlete_name,
    coalesce(nullif(p.school_name, ''), '') as school_name
  from public.tips t
  left join public.players p on p.id = t.player_id
  where t.fan_id = coalesce(auth.uid(), fan_user_id)
  order by t.created_at desc;
$$;

drop function if exists public.search_schools_and_teams(text);

create or replace function public.search_schools_and_teams(search_query text)
returns setof public.schools_and_teams
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := replace(replace(btrim(coalesce(search_query, '')), '%', ''), '_', '');
begin
  if length(needle) < 1 then
    return;
  end if;

  return query
  select s.*
  from public.schools_and_teams s
  where s.name ilike '%' || needle || '%'
     or s.mascot ilike '%' || needle || '%'
     or s.division ilike '%' || needle || '%'
     or s.region ilike '%' || needle || '%'
     or s.city ilike '%' || needle || '%'
  order by
    case when s.name ilike needle || '%' then 0 else 1 end,
    s.name
  limit 20;
end;
$$;

drop function if exists public.search_local_entities(text, text);

create or replace function public.search_local_entities(search_query text, entity_kind text default 'all')
returns table (
  entity_type text,
  entity_id text,
  title text,
  subtitle text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  needle text := btrim(coalesce(search_query, ''));
  kind text := lower(btrim(coalesce(entity_kind, 'all')));
begin
  if char_length(needle) < 2 then
    return;
  end if;
  if kind not in ('all', 'athlete', 'school', 'booster') then
    kind := 'all';
  end if;

  if kind in ('all', 'athlete') and to_regclass('public.players') is not null then
    return query
    select
      'athlete'::text,
      p.id::text,
      p.name,
      coalesce(nullif(p.school_name, ''), coalesce(p.team, ''))
    from public.players p
    where p.name ilike '%' || needle || '%'
       or p.school_name ilike '%' || needle || '%'
       or coalesce(p.team, '') ilike '%' || needle || '%'
    order by p.name
    limit 20;
  end if;

  if kind in ('all', 'school') and to_regclass('public.games') is not null then
    return query
    select
      'school'::text,
      min(school_name) as entity_id,
      min(school_name) as title,
      'High school'::text as subtitle
    from (
      select distinct btrim(label) as school_name
      from (
        select g.home_school as label from public.games g
        union all
        select g.away_school from public.games g
        union all
        select g.home_team from public.games g
        union all
        select g.away_team from public.games g
      ) raw
      where btrim(coalesce(label, '')) <> ''
    ) names
    where school_name ilike '%' || needle || '%'
    group by lower(school_name)
    order by min(school_name)
    limit 20;
  end if;

  if kind in ('all', 'booster') and to_regclass('public.sponsorships') is not null then
    return query
    select
      'booster'::text,
      s.id::text,
      s.business_name,
      coalesce(s.school_team, '')
    from public.sponsorships s
    where s.business_name ilike '%' || needle || '%'
       or coalesce(s.school_team, '') ilike '%' || needle || '%'
    order by s.business_name
    limit 20;
  end if;
end;
$$;

create table if not exists public.cheer_polls (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  home_label text not null,
  away_label text not null,
  home_votes integer not null default 0,
  away_votes integer not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

drop function if exists public.cast_cheer_vote(text, text, text);

create or replace function public.cast_cheer_vote(
  poll_slug text,
  side text,
  previous_side text default null,
  home_name text default 'Westlake Thunder',
  away_name text default 'Lone Peak Knights'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cheer_polls%rowtype;
begin
  if side not in ('home', 'away') then
    raise exception 'Invalid cheer side %', side;
  end if;

  insert into public.cheer_polls (slug, home_label, away_label, home_votes, away_votes)
  values (
    poll_slug,
    coalesce(nullif(btrim(home_name), ''), 'Westlake Thunder'),
    coalesce(nullif(btrim(away_name), ''), 'Lone Peak Knights'),
    0,
    0
  )
  on conflict (slug) do nothing;

  if previous_side in ('home', 'away') and previous_side is distinct from side then
    if previous_side = 'home' then
      update public.cheer_polls
      set home_votes = greatest(coalesce(home_votes, 0) - 1, 0), updated_at = now()
      where slug = poll_slug;
    else
      update public.cheer_polls
      set away_votes = greatest(coalesce(away_votes, 0) - 1, 0), updated_at = now()
      where slug = poll_slug;
    end if;
  end if;

  if side = 'home' then
    update public.cheer_polls
    set home_votes = coalesce(home_votes, 0) + 1, updated_at = now()
    where slug = poll_slug
    returning * into result;
  else
    update public.cheer_polls
    set away_votes = coalesce(away_votes, 0) + 1, updated_at = now()
    where slug = poll_slug
    returning * into result;
  end if;

  return jsonb_build_object(
    'home_votes', coalesce(result.home_votes, 0),
    'away_votes', coalesce(result.away_votes, 0)
  );
end;
$$;

create or replace function public.update_game_score(
  target_game_id uuid,
  home_delta integer default 0,
  away_delta integer default 0,
  set_clock_running boolean default null,
  set_clock text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.games%rowtype;
begin
  update public.games
  set
    home_score = greatest(coalesce(home_score, 0) + coalesce(home_delta, 0), 0),
    away_score = greatest(coalesce(away_score, 0) + coalesce(away_delta, 0), 0),
    is_clock_running = coalesce(set_clock_running, is_clock_running),
    clock = coalesce(nullif(btrim(coalesce(set_clock, '')), ''), clock),
    updated_at = now()
  where id = target_game_id
  returning * into result;

  if result.id is null then
    raise exception 'Game % not found', target_game_id;
  end if;

  return jsonb_build_object(
    'id', result.id,
    'home_score', result.home_score,
    'away_score', result.away_score,
    'clock', result.clock,
    'is_clock_running', result.is_clock_running,
    'claimed_by', result.claimed_by,
    'quarter', result.quarter,
    'status', result.status
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.tips enable row level security;
alter table public.operator_gigs enable row level security;
alter table public.operator_checkins enable row level security;
alter table public.sponsor_ads enable row level security;
alter table public.sponsorships enable row level security;
alter table public.verification_requests enable row level security;
alter table public.disbursements enable row level security;
alter table public.reels enable row level security;
alter table public.saved_reels enable row level security;
alter table public.reel_hype_votes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscriber_requests enable row level security;
alter table public.cheer_polls enable row level security;
alter table public.telemetry_logs enable row level security;
alter table public.schools_and_teams enable row level security;
alter table public.athlete_career_stats enable row level security;
alter table public.athlete_game_logs enable row level security;
alter table public.athlete_training_badge_unlocks enable row level security;
alter table public.spotlight_awards enable row level security;
alter table public.crew_follows enable row level security;
alter table public.crew_push_queue enable row level security;

-- Read: guests/fans can watch game day.
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles" on public.profiles for select using (true);

drop policy if exists "Public read schools and teams" on public.schools_and_teams;
create policy "Public read schools and teams"
  on public.schools_and_teams for select
  using (true);

drop policy if exists "Public read athlete career stats" on public.athlete_career_stats;
create policy "Public read athlete career stats"
  on public.athlete_career_stats for select
  using (true);

drop policy if exists "Public read athlete game logs" on public.athlete_game_logs;
create policy "Public read athlete game logs"
  on public.athlete_game_logs for select
  using (true);

drop policy if exists "Public read athlete training badges" on public.athlete_training_badge_unlocks;
create policy "Public read athlete training badges"
  on public.athlete_training_badge_unlocks for select
  using (true);

drop policy if exists "Public read spotlight awards" on public.spotlight_awards;
create policy "Public read spotlight awards"
  on public.spotlight_awards for select
  using (true);

drop policy if exists "Admin write spotlight awards" on public.spotlight_awards;
create policy "Admin write spotlight awards"
  on public.spotlight_awards for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop policy if exists "Public read crew follows" on public.crew_follows;
create policy "Public read crew follows" on public.crew_follows for select using (true);

drop policy if exists "Users write own crew follows" on public.crew_follows;
create policy "Users write own crew follows"
  on public.crew_follows for all
  using (follower_id = auth.uid() or auth.role() = 'anon')
  with check (follower_id = auth.uid() or auth.role() = 'anon');

drop policy if exists "Users read own crew push" on public.crew_push_queue;
create policy "Users read own crew push"
  on public.crew_push_queue for select
  using (recipient_id = auth.uid() or auth.role() = 'anon');

drop policy if exists "Insert crew push" on public.crew_push_queue;
create policy "Insert crew push" on public.crew_push_queue for insert with check (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (user_id = auth.uid() or auth.role() = 'anon');

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (user_id = auth.uid() or public.current_user_role() = 'admin')
  with check (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "Public read players" on public.players;
create policy "Public read players" on public.players for select using (true);

drop policy if exists "Staff write players" on public.players;
create policy "Staff write players"
  on public.players for all
  using (
    auth.role() = 'anon'
    or public.current_user_role() in ('booster', 'admin', 'operator', 'parent')
  )
  with check (
    auth.role() = 'anon'
    or public.current_user_role() in ('booster', 'admin', 'operator', 'parent')
  );

drop policy if exists "Public read games" on public.games;
create policy "Public read games" on public.games for select using (true);

drop policy if exists "Operators update games" on public.games;
create policy "Operators update games"
  on public.games for update
  using (
    auth.role() = 'anon'
    or public.current_user_role() in ('operator', 'admin')
  )
  with check (
    auth.role() = 'anon'
    or public.current_user_role() in ('operator', 'admin')
  );

drop policy if exists "Public read game_events" on public.game_events;
create policy "Public read game_events" on public.game_events for select using (true);

drop policy if exists "Operators insert game_events" on public.game_events;
create policy "Operators insert game_events"
  on public.game_events for insert
  with check (
    auth.role() = 'anon'
    or public.current_user_role() in ('operator', 'admin')
  );

drop policy if exists "Public read tips" on public.tips;
create policy "Public read tips" on public.tips for select using (true);

drop policy if exists "Insert tips" on public.tips;
create policy "Insert tips" on public.tips for insert with check (true);

drop policy if exists "Public read gigs" on public.operator_gigs;
create policy "Public read gigs" on public.operator_gigs for select using (true);

drop policy if exists "Operators write gigs" on public.operator_gigs;
create policy "Operators write gigs"
  on public.operator_gigs for all
  using (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));

drop policy if exists "Operators write checkins" on public.operator_checkins;
create policy "Operators write checkins"
  on public.operator_checkins for all
  using (true)
  with check (true);

drop policy if exists "Public read sponsorships" on public.sponsorships;
create policy "Public read sponsorships" on public.sponsorships for select using (true);

drop policy if exists "Insert sponsorships" on public.sponsorships;
create policy "Insert sponsorships" on public.sponsorships for insert with check (true);

drop policy if exists "Public read ads" on public.sponsor_ads;
create policy "Public read ads" on public.sponsor_ads for select using (true);

drop policy if exists "Sponsors write ads" on public.sponsor_ads;
create policy "Sponsors write ads"
  on public.sponsor_ads for all
  using (auth.role() = 'anon' or public.current_user_role() in ('sponsor', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('sponsor', 'admin'));

drop policy if exists "Staff read verification" on public.verification_requests;
create policy "Staff read verification" on public.verification_requests for select using (true);

drop policy if exists "Boosters write verification" on public.verification_requests;
create policy "Boosters write verification"
  on public.verification_requests for all
  using (auth.role() = 'anon' or public.current_user_role() in ('booster', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('booster', 'admin'));

drop policy if exists "Admin read disbursements" on public.disbursements;
create policy "Admin read disbursements" on public.disbursements for select using (true);

drop policy if exists "Admin write disbursements" on public.disbursements;
create policy "Admin write disbursements"
  on public.disbursements for all
  using (auth.role() = 'anon' or public.current_user_role() in ('admin', 'parent'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('admin', 'parent'));

drop policy if exists "Public read reels" on public.reels;
create policy "Public read reels" on public.reels for select using (true);

drop policy if exists "Public insert reels" on public.reels;
create policy "Public insert reels"
  on public.reels for insert
  with check (true);

drop policy if exists "Public update reels" on public.reels;
create policy "Public update reels"
  on public.reels for update
  using (true)
  with check (true);

drop policy if exists "Fans read own saved reels" on public.saved_reels;
create policy "Fans read own saved reels"
  on public.saved_reels for select
  using (auth.uid() = user_id);

drop policy if exists "Fans save own reels" on public.saved_reels;
create policy "Fans save own reels"
  on public.saved_reels for insert
  with check (auth.uid() = user_id);

drop policy if exists "Fans unsave own reels" on public.saved_reels;
create policy "Fans unsave own reels"
  on public.saved_reels for delete
  using (auth.uid() = user_id);

drop policy if exists "Fans read own reel hype votes" on public.reel_hype_votes;
create policy "Fans read own reel hype votes"
  on public.reel_hype_votes for select
  using (auth.uid() = user_id);

drop policy if exists "Fans insert own reel hype votes" on public.reel_hype_votes;
create policy "Fans insert own reel hype votes"
  on public.reel_hype_votes for insert
  with check (auth.uid() = user_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Public read subscriptions" on public.subscriptions;
create policy "Public read subscriptions"
  on public.subscriptions for select
  using (true);

drop policy if exists "Public insert subscriptions" on public.subscriptions;
create policy "Public insert subscriptions"
  on public.subscriptions for insert
  with check (true);

drop policy if exists "Public update subscriptions" on public.subscriptions;
create policy "Public update subscriptions"
  on public.subscriptions for update
  using (true)
  with check (true);

drop policy if exists "Public read subscriber requests" on public.subscriber_requests;
create policy "Public read subscriber requests"
  on public.subscriber_requests for select
  using (true);

drop policy if exists "Public insert subscriber requests" on public.subscriber_requests;
create policy "Public insert subscriber requests"
  on public.subscriber_requests for insert
  with check (true);

drop policy if exists "Public read cheer polls" on public.cheer_polls;
create policy "Public read cheer polls" on public.cheer_polls for select using (true);

drop policy if exists "Insert telemetry logs" on public.telemetry_logs;
create policy "Insert telemetry logs" on public.telemetry_logs for insert with check (true);

drop policy if exists "Authenticated read telemetry logs" on public.telemetry_logs;
create policy "Authenticated read telemetry logs" on public.telemetry_logs for select using (auth.role() = 'authenticated');

grant select, insert, update, delete on public.profiles to anon, authenticated;
grant select on public.schools_and_teams to anon, authenticated;
grant select on public.athlete_career_stats to anon, authenticated;
grant select on public.athlete_game_logs to anon, authenticated;
grant select on public.athlete_training_badge_unlocks to anon, authenticated;
grant select, insert, update, delete on public.spotlight_awards to anon, authenticated;
grant select, insert, delete on public.crew_follows to anon, authenticated;
grant select, insert on public.crew_push_queue to anon, authenticated;
grant select, insert, update, delete on public.players to anon, authenticated;
grant select, insert, update on public.games to anon, authenticated;
grant select, insert on public.game_events to anon, authenticated;
grant select, insert on public.tips to anon, authenticated;
grant select, insert, update, delete on public.operator_gigs to anon, authenticated;
grant select, insert on public.operator_checkins to anon, authenticated;
grant select, insert, update, delete on public.sponsor_ads to anon, authenticated;
grant select, insert on public.sponsorships to anon, authenticated;
grant select, insert, update, delete on public.verification_requests to anon, authenticated;
grant select, insert, update on public.disbursements to anon, authenticated;
grant select, insert, update on public.reels to anon, authenticated;
grant select, insert, delete on public.saved_reels to authenticated;
grant select, insert on public.reel_hype_votes to authenticated;
grant select, insert, update on public.subscriptions to anon, authenticated;
grant select, insert on public.subscriber_requests to anon, authenticated;
grant select on public.cheer_polls to anon, authenticated;
grant insert on public.telemetry_logs to anon, authenticated;
grant select on public.telemetry_logs to authenticated;
grant execute on function public.increment_backer_count(uuid) to anon, authenticated;
grant execute on function public.add_user_aura(uuid, integer) to anon, authenticated;
grant execute on function public.get_aura_tier(integer) to anon, authenticated;
grant execute on function public.increment_player_hype(uuid, text) to anon, authenticated;
grant execute on function public.increment_reel_hype(uuid, text) to anon, authenticated;
grant execute on function public.increment_reel_tips(uuid, integer) to anon, authenticated;
grant execute on function public.cast_cheer_vote(text, text, text, text, text) to anon, authenticated;
grant execute on function public.update_game_score(uuid, integer, integer, boolean, text) to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.add_user_role(text) to anon, authenticated;
grant execute on function public.get_fan_tip_history(uuid) to anon, authenticated;
grant execute on function public.search_local_entities(text, text) to anon, authenticated;
grant execute on function public.search_schools_and_teams(text) to anon, authenticated;
grant execute on function public.report_reel(uuid) to authenticated;
grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to anon, authenticated;
grant execute on function public.spotlight_normalize_kind(text) to anon, authenticated;
grant execute on function public.spotlight_window(text, date) to anon, authenticated;
grant execute on function public.can_confirm_player_tag(uuid) to anon, authenticated;
grant execute on function public.confirm_reel_player_tag(uuid, text) to anon, authenticated;
grant execute on function public.get_pending_player_tags() to anon, authenticated;
grant execute on function public.get_spotlight_standings(text) to anon, authenticated;
grant execute on function public.sync_spotlight_period(text) to anon, authenticated;
grant execute on function public.sync_live_spotlight_awards() to anon, authenticated;
grant execute on function public.unlock_spotlight_period(text) to anon, authenticated;
grant execute on function public.moderate_flagged_reel(uuid, text) to anon, authenticated;
grant execute on function public.get_admin_platform_metrics() to anon, authenticated;
grant execute on function public.toggle_reel_vault_status(uuid) to anon, authenticated;
grant execute on function public.set_player_vault_locked(uuid, boolean) to anon, authenticated;
grant execute on function public.get_active_spotlight_award(uuid) to anon, authenticated;
grant execute on function public.get_crew_graph(uuid) to anon, authenticated;
grant execute on function public.toggle_crew_follow(uuid, boolean) to anon, authenticated;
grant execute on function public.set_reel_flash_unlock(uuid) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_events;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.cheer_polls;
exception
  when duplicate_object then null;
end $$;

insert into public.cheer_polls (slug, home_label, away_label, home_votes, away_votes)
values ('westlake-lone-peak', 'Westlake Thunder', 'Lone Peak Knights', 124, 98)
on conflict (slug) do nothing;

insert into public.games (
  home_team, away_team, home_school, away_school, home_score, away_score, quarter, status, venue, is_active
)
select * from (values
  ('Westlake', 'Lone Peak', 'Westlake High', 'Lone Peak High', 14, 10, 'Q2', 'live', 'Westlake Stadium', true),
  ('ALA Hawks', 'Skyridge', 'American Leadership Academy', 'Skyridge High', 21, 17, 'Q3', 'live', 'Hawks Field', true),
  ('Timpview', 'American Fork', 'Timpview High', 'American Fork High', 0, 0, 'Q1', 'live', 'Timpview Stadium', true)
) as seed(home_team, away_team, home_school, away_school, home_score, away_score, quarter, status, venue, is_active)
where not exists (select 1 from public.games limit 1);

insert into public.players (name, jersey_number, position, height, school_name, backer_count)
select * from (values
  ('Marcus Rivera', 7, 'Quarterback', '6''2"', 'ALA Hawks', 14),
  ('Jordan Blake', 21, 'Running Back', '5''11"', 'ALA Hawks', 9),
  ('Tyler Nguyen', 88, 'Wide Receiver', '6''1"', 'ALA Hawks', 22),
  ('Derek Sullivan', 54, 'Linebacker', '6''3"', 'ALA Hawks', 11),
  ('Andre Coleman', 99, 'Defensive End', '6''4"', 'ALA Hawks', 17)
) as seed(name, jersey_number, position, height, school_name, backer_count)
where not exists (select 1 from public.players limit 1);

update public.players
set
  weight = case when coalesce(weight, '') = '' then '192 lb' else weight end,
  forty_yard = case when coalesce(forty_yard, '') = '' then '4.58s' else forty_yard end,
  vertical_jump = case when coalesce(vertical_jump, '') = '' then '34 in' else vertical_jump end;

insert into public.athlete_career_stats (player_id, sport, games_played, scoring_value, volume_value, mvp_badges)
select p.id, 'Football', 11, 186, 2140, 2
from public.players p
on conflict (player_id) do nothing;

insert into public.athlete_game_logs (player_id, played_on, opponent_school, stat_line, scoring_value, volume_value)
select p.id, d.played_on, d.opponent_school, d.stat_line, d.scoring_value, d.volume_value
from public.players p
cross join (
  values
    ('2026-09-04'::date, 'Lone Peak Knights', '2 TD · 186 yds', 12, 186),
    ('2026-08-28'::date, 'Skyridge Sentinels', '1 TD · 142 yds', 6, 142),
    ('2026-08-21'::date, 'Timpview Thunderbirds', '3 TD · 221 yds', 18, 221)
) as d(played_on, opponent_school, stat_line, scoring_value, volume_value)
where not exists (
  select 1 from public.athlete_game_logs g where g.player_id = p.id
);

insert into public.spotlight_awards (
  athlete_id, award_type, level, district_region, headline, highlight_reel_id, start_date, end_date
)
select
  null,
  'week',
  'school',
  'Westlake High',
  '4 Touchdowns & 12 Tackles',
  (
    select r.id
    from public.reels r
    where coalesce(r.is_vault_only, false) = false
    order by r.created_at desc
    limit 1
  ),
  date_trunc('week', timezone('utc', now()))::date,
  (date_trunc('week', timezone('utc', now())) + interval '6 days')::date
where not exists (
  select 1
  from public.spotlight_awards a
  where a.start_date = date_trunc('week', timezone('utc', now()))::date
    and lower(a.award_type) in ('week', 'player_of_the_week')
);

-- Admin portal control plane: Drip catalog, school/poll writes. Safe to re-run.

create table if not exists public.shop_products (
  id text primary key,
  name text not null,
  category text not null check (category in ('apparel', 'aura_cards', 'merch')),
  price_cents integer not null default 0,
  blurb text not null default '',
  has_sizes boolean not null default false,
  inventory integer not null default 0,
  icon text not null default 'shirt',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.shop_products add column if not exists name text not null default '';
alter table public.shop_products add column if not exists category text not null default 'merch';
alter table public.shop_products add column if not exists price_cents integer not null default 0;
alter table public.shop_products add column if not exists blurb text not null default '';
alter table public.shop_products add column if not exists has_sizes boolean not null default false;
alter table public.shop_products add column if not exists inventory integer not null default 0;
alter table public.shop_products add column if not exists icon text not null default 'shirt';
alter table public.shop_products add column if not exists is_active boolean not null default true;
alter table public.shop_products add column if not exists sort_order integer not null default 0;
alter table public.shop_products add column if not exists created_at timestamptz not null default now();

insert into public.shop_products (id, name, category, price_cents, blurb, has_sizes, inventory, icon, sort_order)
values
  ('app-hoodie', 'Hawks Booster Hoodie', 'apparel', 5400, 'Heavyweight fleece with booster crest for Friday nights.', true, 8, 'shirt', 10),
  ('app-tee', 'Rivalry Night Tee', 'apparel', 3200, 'Westlake vs Lone Peak throwback print.', true, 24, 'shirt', 20),
  ('app-shorts', 'Sideline Practice Shorts', 'apparel', 3600, 'Mesh shorts with Neon Jade taping.', true, 14, 'shirt', 30),
  ('card-jade', 'Neon Jade Holo Card', 'aura_cards', 1400, 'Holographic Aura print with your handle on the foil edge.', false, 40, 'sparkles', 40),
  ('card-ember', 'Crimson Ember Foil Card', 'aura_cards', 2200, 'Tier 5 border replica on heavy stock.', false, 30, 'sparkles', 50),
  ('card-prism', 'Celestial Prism Set', 'aura_cards', 4000, 'Three-card pack: Jade, Cyan, and Prism foils.', false, 12, 'sparkles', 60),
  ('merch-bottle', 'Sideline Hydration Bottle', 'merch', 1800, 'Team-marked bottle for the stands.', false, 18, 'basketball', 70),
  ('merch-wrist', 'Wrist Coach Playband', 'merch', 2400, 'Call the next play from the bleachers.', false, 20, 'basketball', 80),
  ('merch-jersey', 'Replica Friday Jersey', 'merch', 6500, 'Stitched nameplate, booster-ready fit.', true, 6, 'basketball', 90)
on conflict (id) do nothing;

alter table public.shop_products enable row level security;

drop policy if exists "Public read shop products" on public.shop_products;
create policy "Public read shop products"
  on public.shop_products for select
  using (true);

drop policy if exists "Admin write shop products" on public.shop_products;
create policy "Admin write shop products"
  on public.shop_products for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop policy if exists "Admin write schools and teams" on public.schools_and_teams;
create policy "Admin write schools and teams"
  on public.schools_and_teams for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop policy if exists "Admin write cheer polls" on public.cheer_polls;
create policy "Admin write cheer polls"
  on public.cheer_polls for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop policy if exists "Admin insert games" on public.games;
create policy "Admin insert games"
  on public.games for insert
  with check (auth.role() = 'anon' or public.current_user_role() in ('admin', 'operator'));

drop policy if exists "Admin write sponsorships" on public.sponsorships;
create policy "Admin write sponsorships"
  on public.sponsorships for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop function if exists public.upsert_cheer_poll(text, text, text, boolean);

create or replace function public.upsert_cheer_poll(
  poll_slug text,
  home_name text,
  away_name text,
  make_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cheer_polls%rowtype;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  insert into public.cheer_polls (slug, home_label, away_label, is_active)
  values (
    btrim(poll_slug),
    coalesce(nullif(btrim(home_name), ''), 'Home'),
    coalesce(nullif(btrim(away_name), ''), 'Away'),
    coalesce(make_active, true)
  )
  on conflict (slug) do update
    set home_label = excluded.home_label,
        away_label = excluded.away_label,
        is_active = excluded.is_active,
        updated_at = now()
  returning * into result;

  return jsonb_build_object(
    'slug', result.slug,
    'home_label', result.home_label,
    'away_label', result.away_label,
    'home_votes', result.home_votes,
    'away_votes', result.away_votes,
    'is_active', result.is_active
  );
end;
$$;

grant select on public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_products to anon, authenticated;
grant insert, update, delete on public.schools_and_teams to anon, authenticated;
grant insert, update, delete on public.cheer_polls to anon, authenticated;
grant insert, update on public.games to anon, authenticated;
grant update, delete on public.sponsorships to anon, authenticated;
grant execute on function public.upsert_cheer_poll(text, text, text, boolean) to anon, authenticated;

-- App chrome flags (draft vs published) + admin reports. Safe to re-run.

create table if not exists public.app_runtime_config (
  id text primary key default 'default',
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_runtime_config (id, draft, published, published_at)
values (
  'default',
  '{"tabs":{"home":true,"local":true,"spotlight":true,"drip":true,"profile":true,"upload":true},"buttons":{"seki":true,"aura":true,"flex":true,"malo":true,"more":true,"subscribe":true,"crew":true,"vault":true,"flashUnlock":true},"layouts":{"liveMatches":true,"cheerPolls":true,"topBoosters":true,"sponsorshipModal":true,"spotlightModal":true,"operatorConsole":false,"parentHq":true,"boosterHq":true,"sponsorHq":true}}'::jsonb,
  '{"tabs":{"home":true,"local":true,"spotlight":true,"drip":true,"profile":true,"upload":true},"buttons":{"seki":true,"aura":true,"flex":true,"malo":true,"more":true,"subscribe":true,"crew":true,"vault":true,"flashUnlock":true},"layouts":{"liveMatches":true,"cheerPolls":true,"topBoosters":true,"sponsorshipModal":true,"spotlightModal":true,"operatorConsole":false,"parentHq":true,"boosterHq":true,"sponsorHq":true}}'::jsonb,
  timezone('utc', now())
)
on conflict (id) do nothing;

alter table public.app_runtime_config enable row level security;

drop policy if exists "Public read app runtime" on public.app_runtime_config;
create policy "Public read app runtime"
  on public.app_runtime_config for select
  using (true);

drop policy if exists "Admin write app runtime" on public.app_runtime_config;
create policy "Admin write app runtime"
  on public.app_runtime_config for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop function if exists public.patch_app_runtime_draft(jsonb);

create or replace function public.patch_app_runtime_draft(next_draft jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.app_runtime_config;
begin
  if next_draft is null then
    raise exception 'next_draft is required';
  end if;
  insert into public.app_runtime_config (id, draft, published, updated_at)
  values ('default', next_draft, next_draft, now())
  on conflict (id) do update
    set draft = excluded.draft,
        updated_at = now();
  select * into result from public.app_runtime_config where id = 'default';
  return jsonb_build_object(
    'draft', result.draft,
    'published', result.published,
    'published_at', result.published_at,
    'updated_at', result.updated_at
  );
end;
$$;

drop function if exists public.publish_app_runtime();

create or replace function public.publish_app_runtime()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.app_runtime_config;
begin
  update public.app_runtime_config
  set published = draft,
      published_at = timezone('utc', now()),
      updated_at = now()
  where id = 'default'
  returning * into result;
  if result.id is null then
    raise exception 'app_runtime_config is missing';
  end if;
  return jsonb_build_object(
    'draft', result.draft,
    'published', result.published,
    'published_at', result.published_at,
    'updated_at', result.updated_at
  );
end;
$$;

drop function if exists public.get_admin_reports();

create or replace function public.get_admin_reports()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'engagement', jsonb_build_object(
      'clips_live', (select count(*)::int from public.reels where coalesce(is_removed, false) = false),
      'clips_24h', (select count(*)::int from public.reels where created_at >= timezone('utc', now()) - interval '24 hours'),
      'clips_7d', (select count(*)::int from public.reels where created_at >= timezone('utc', now()) - interval '7 days'),
      'clips_prev_7d', (select count(*)::int from public.reels where created_at >= timezone('utc', now()) - interval '14 days' and created_at < timezone('utc', now()) - interval '7 days'),
      'seki', (select coalesce(sum(coalesce(seki_count, 0)), 0)::int from public.reels where coalesce(is_removed, false) = false),
      'aura', (select coalesce(sum(coalesce(aura_count, 0)), 0)::int from public.reels where coalesce(is_removed, false) = false),
      'flex', (select coalesce(sum(coalesce(flex_count, 0)), 0)::int from public.reels where coalesce(is_removed, false) = false),
      'hype_votes', (select count(*)::int from public.reel_hype_votes),
      'saves', (select count(*)::int from public.saved_reels),
      'crew_follows', (select count(*)::int from public.crew_follows)
    ),
    'money', jsonb_build_object(
      'malo_cents_all', (select coalesce(sum(amount_cents), 0)::int from public.tips),
      'malo_count_all', (select count(*)::int from public.tips),
      'malo_cents_24h', (select coalesce(sum(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_count_24h', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_cents_7d', (select coalesce(sum(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_count_7d', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_cents_prev_7d', (select coalesce(sum(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '14 days' and created_at < timezone('utc', now()) - interval '7 days'),
      'avg_tip_cents_7d', (select coalesce(avg(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'queued_payouts', (select count(*)::int from public.disbursements where status = 'queued'),
      'paid_payouts_cents', (select coalesce(sum(amount_cents), 0)::int from public.disbursements where status = 'paid'),
      'active_subs', (select count(*)::int from public.subscriptions where coalesce(status, 'active') = 'active')
    ),
    'content', jsonb_build_object(
      'flagged', (select count(*)::int from public.reels where coalesce(is_flagged, false) = true and coalesce(is_removed, false) = false),
      'removed', (select count(*)::int from public.reels where coalesce(is_removed, false) = true),
      'vault', (select count(*)::int from public.reels where coalesce(is_vault_only, false) = true and coalesce(is_removed, false) = false),
      'exclusive_clips', (select count(*)::int from public.reels where coalesce(is_exclusive, false) = true and coalesce(is_removed, false) = false),
      'flash_live', (select count(*)::int from public.reels where flash_unlock_until is not null and flash_unlock_until > timezone('utc', now()) and coalesce(is_removed, false) = false),
      'spotlight_live', (select count(*)::int from public.spotlight_awards where start_date <= (timezone('utc', now()))::date and end_date >= (timezone('utc', now()))::date),
      'qna', (select count(*)::int from public.subscriber_requests),
      'game_play', (select count(*)::int from public.reels where coalesce(category, 'game_play') = 'game_play' and coalesce(is_removed, false) = false),
      'train_like_me', (select count(*)::int from public.reels where category = 'train_like_me' and coalesce(is_removed, false) = false),
      'serve_like_me', (select count(*)::int from public.reels where category = 'serve_like_me' and coalesce(is_removed, false) = false)
    ),
    'audience', jsonb_build_object(
      'profiles', (select count(*)::int from public.profiles),
      'athletes', (select count(*)::int from public.players),
      'verified', (select count(*)::int from public.profiles where coalesce(is_verified_athlete, false) = true or role = 'athlete'),
      'admins', (select count(*)::int from public.profiles where coalesce(is_admin, false) = true),
      'schools', (select count(*)::int from public.schools_and_teams),
      'pending_verify', (select count(*)::int from public.verification_requests where status = 'pending')
    ),
    'live', jsonb_build_object(
      'live_games', (select count(*)::int from public.games where coalesce(is_active, true) = true),
      'parked_games', (select count(*)::int from public.games where coalesce(is_active, true) = false),
      'poll_votes', (select coalesce(sum(coalesce(home_votes, 0) + coalesce(away_votes, 0)), 0)::int from public.cheer_polls),
      'active_polls', (select count(*)::int from public.cheer_polls where coalesce(is_active, true) = true),
      'active_boosters', (select count(*)::int from public.sponsorships where coalesce(status, 'active') = 'active'),
      'drip_skus', (select count(*)::int from public.shop_products where coalesce(is_active, true) = true)
    ),
    'reliability', jsonb_build_object(
      'stalls_24h', (select count(*)::int from public.telemetry_logs where event_type = 'video_stall' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'reconnects_24h', (select count(*)::int from public.telemetry_logs where event_type = 'socket_reconnect' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'checkouts_24h', (select count(*)::int from public.telemetry_logs where event_type = 'checkout_latency' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'avg_checkout_ms_24h', (select coalesce(avg(duration_ms), 0)::int from public.telemetry_logs where event_type = 'checkout_latency' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'events_24h', (select count(*)::int from public.telemetry_logs where created_at >= timezone('utc', now()) - interval '24 hours')
    ),
    'leaders', jsonb_build_object(
      'malo', (
        select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value)), '[]'::jsonb)
        from (
          select coalesce(nullif(p.name, ''), 'Unknown') as label, sum(t.amount_cents)::int as value
          from public.tips t
          left join public.players p on p.id = t.player_id
          group by p.id, p.name
          order by value desc
          limit 5
        ) ranked
      ),
      'hype', (
        select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value)), '[]'::jsonb)
        from (
          select coalesce(nullif(r.title, ''), 'Untitled clip') as label,
            (coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0))::int as value
          from public.reels r
          where coalesce(r.is_removed, false) = false
          order by value desc, r.created_at desc
          limit 5
        ) ranked
      ),
      'schools', (
        select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value)), '[]'::jsonb)
        from (
          select coalesce(nullif(p.school_name, ''), 'Unlisted') as label, count(*)::int as value
          from public.players p
          group by 1
          order by value desc
          limit 5
        ) ranked
      )
    ),
    'series', jsonb_build_object(
      'clips', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, count(*)::int as n from public.reels group by 1
          ) c on c.day = d::date
        ) bucket
      ),
      'malo', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(amount_cents), 0)::int as n from public.tips group by 1
          ) c on c.day = d::date
        ) bucket
      ),
      'stalls', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, count(*)::int as n
            from public.telemetry_logs
            where event_type = 'video_stall'
            group by 1
          ) c on c.day = d::date
        ) bucket
      ),
      'dwell', (
        select coalesce(jsonb_agg(jsonb_build_object('label', to_char(bucket.d, 'Dy'), 'value', bucket.n) order by bucket.d), '[]'::jsonb)
        from (
          select d::date as d, coalesce(c.n, 0)::int as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(duration_ms), 0)::int as n
            from public.telemetry_logs
            where event_type = 'tab_dwell'
            group by 1
          ) c on c.day = d::date
        ) bucket
      )
    ),
    'usage', jsonb_build_object(
      'sessions_24h', (select count(*)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_24h', (select coalesce(sum(duration_ms), 0)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_7d', (select coalesce(sum(duration_ms), 0)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '7 days'),
      'taps_24h', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'taps_7d', (select count(*)::int from public.telemetry_logs where event_type = 'feature_tap' and created_at >= timezone('utc', now()) - interval '7 days'),
      'issues_24h', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'issues_7d', (select count(*)::int from public.telemetry_logs where event_type = 'ui_issue' and created_at >= timezone('utc', now()) - interval '7 days'),
      'feedback_bugs_open', (select count(*)::int from public.app_feedback where kind = 'bug' and status not in ('shipped', 'declined')),
      'avg_scroll_pct_7d', (select coalesce(avg(duration_ms), 0)::int from public.telemetry_logs where event_type = 'surface_scroll' and created_at >= timezone('utc', now()) - interval '7 days')
    ),
    'tabs', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select
          case coalesce(channel, 'other')
            when 'home' then 'Home'
            when 'local' then 'Local'
            when 'spotlight' then 'Spotlight'
            when 'drip' then 'Drip'
            when 'profile' then 'Profile'
            when 'upload' then 'Upload'
            else coalesce(nullif(channel, ''), 'Other')
          end as label,
          coalesce(sum(duration_ms), 0)::int as value
        from public.telemetry_logs
        where event_type = 'tab_dwell'
          and created_at >= timezone('utc', now()) - interval '7 days'
        group by 1
        order by value desc
        limit 8
      ) ranked
    ),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select coalesce(nullif(step, ''), 'unknown') as label, count(*)::int as value
        from public.telemetry_logs
        where event_type = 'feature_tap'
          and created_at >= timezone('utc', now()) - interval '7 days'
          and coalesce(step, '') not like 'tab.%'
        group by 1
        order by value desc
        limit 8
      ) ranked
    ),
    'issues', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select combined.label, sum(combined.n)::int as value
        from (
          select
            coalesce(nullif(step, ''), 'control') || ' · ' || coalesce(nullif(channel, ''), 'app') as label,
            count(*)::int as n
          from public.telemetry_logs
          where event_type = 'ui_issue'
            and created_at >= timezone('utc', now()) - interval '7 days'
          group by 1
          union all
          select coalesce(surface, 'other') || ' bug' as label, count(*)::int as n
          from public.app_feedback
          where kind = 'bug'
            and status not in ('shipped', 'declined')
          group by 1
        ) combined
        where combined.label <> ''
        group by combined.label
        order by value desc
        limit 8
      ) ranked
    ),
    'scroll', (
      select coalesce(jsonb_agg(jsonb_build_object('label', ranked.label, 'value', ranked.value) order by ranked.value desc), '[]'::jsonb)
      from (
        select
          case coalesce(channel, 'other')
            when 'home' then 'Home'
            when 'local' then 'Local'
            when 'spotlight' then 'Spotlight'
            when 'drip' then 'Drip'
            when 'profile' then 'Profile'
            else coalesce(nullif(channel, ''), 'Other')
          end as label,
          coalesce(avg(duration_ms), 0)::int as value
        from public.telemetry_logs
        where event_type = 'surface_scroll'
          and created_at >= timezone('utc', now()) - interval '7 days'
        group by 1
        order by value desc
        limit 8
      ) ranked
    )
  );
$$;

grant select on public.app_runtime_config to anon, authenticated;
grant insert, update on public.app_runtime_config to anon, authenticated;
grant execute on function public.patch_app_runtime_draft(jsonb) to anon, authenticated;
grant execute on function public.publish_app_runtime() to anon, authenticated;
grant execute on function public.get_admin_reports() to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.app_runtime_config;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Company revenue control plane for /admin/money. Incremental: supabase/company_revenue.sql.
-- Company revenue control plane for /admin/money.
-- Safe to re-run. Keep BPS in lockstep with src/frontend/data/finance.ts.
-- Existing remote stub used numeric dollars; we keep those columns and add cents.

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  product_id text,
  buyer_id uuid,
  amount_cents integer not null,
  qty integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.company_revenue_logs (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null,
  gross_amount numeric not null default 0,
  platform_cut_amount numeric not null default 0,
  payout_amount numeric not null default 0,
  recipient_id uuid,
  created_at timestamptz not null default now()
);

alter table public.company_revenue_logs add column if not exists source text;
alter table public.company_revenue_logs add column if not exists source_id text;
alter table public.company_revenue_logs add column if not exists label text not null default '';
alter table public.company_revenue_logs add column if not exists payee_kind text not null default 'none';
alter table public.company_revenue_logs add column if not exists player_id uuid;
alter table public.company_revenue_logs add column if not exists gross_cents integer not null default 0;
alter table public.company_revenue_logs add column if not exists platform_cents integer not null default 0;
alter table public.company_revenue_logs add column if not exists payout_cents integer not null default 0;

update public.company_revenue_logs
set source = coalesce(nullif(source, ''), nullif(transaction_type, ''), 'malo')
where source is null or source = '';

alter table public.company_revenue_logs alter column source set default 'malo';

do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_source_check
    check (source in ('malo', 'booster', 'vault', 'merch'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_payee_kind_check
    check (payee_kind in ('athlete', 'operator', 'none'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_source_id_key unique (source, source_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_player_id_fkey
    foreign key (player_id) references public.players (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

create index if not exists company_revenue_logs_created_at_idx
  on public.company_revenue_logs (created_at desc);

create index if not exists shop_orders_created_at_idx
  on public.shop_orders (created_at desc);

alter table public.company_revenue_logs enable row level security;
alter table public.shop_orders enable row level security;

drop policy if exists "Admin Full Access Revenue Logs" on public.company_revenue_logs;
drop policy if exists "Admin read company revenue logs" on public.company_revenue_logs;
create policy "Admin read company revenue logs"
  on public.company_revenue_logs for select
  using (
    auth.role() = 'anon'
    or public.current_user_role() = 'admin'
  );

drop policy if exists "Admin write company revenue logs" on public.company_revenue_logs;
create policy "Admin write company revenue logs"
  on public.company_revenue_logs for all
  using (
    auth.role() = 'anon'
    or public.current_user_role() = 'admin'
  )
  with check (
    auth.role() = 'anon'
    or public.current_user_role() = 'admin'
  );

drop policy if exists "Public read shop orders" on public.shop_orders;
create policy "Public read shop orders"
  on public.shop_orders for select
  using (true);

drop policy if exists "Anyone insert shop orders" on public.shop_orders;
create policy "Anyone insert shop orders"
  on public.shop_orders for insert
  with check (true);

drop policy if exists "Admin write shop orders" on public.shop_orders;
create policy "Admin write shop orders"
  on public.shop_orders for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

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

create or replace function public.get_company_revenue_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
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

grant select, insert, update, delete on public.company_revenue_logs to anon, authenticated;
grant select, insert, update, delete on public.shop_orders to anon, authenticated;
grant execute on function public.company_revenue_bps(text) to anon, authenticated;
grant execute on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) to anon, authenticated;
grant execute on function public.sync_company_revenue_logs() to anon, authenticated;
grant execute on function public.get_company_revenue_summary() to anon, authenticated;

-- Fan suggestions for the admin control plane. Incremental: supabase/app_feedback.sql.
-- Fan suggestions / bugs for the admin control plane. Safe to re-run.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  body text not null,
  kind text not null default 'suggestion',
  surface text not null default 'other',
  status text not null default 'new',
  runtime_path text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_feedback add column if not exists author_id uuid;
alter table public.app_feedback add column if not exists body text not null default '';
alter table public.app_feedback add column if not exists kind text not null default 'suggestion';
alter table public.app_feedback add column if not exists surface text not null default 'other';
alter table public.app_feedback add column if not exists status text not null default 'new';
alter table public.app_feedback add column if not exists runtime_path text not null default '';
alter table public.app_feedback add column if not exists admin_note text not null default '';
alter table public.app_feedback add column if not exists created_at timestamptz not null default now();
alter table public.app_feedback add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_kind_check
    check (kind in ('suggestion', 'bug', 'look', 'other'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_surface_check
    check (surface in ('home', 'local', 'spotlight', 'drip', 'profile', 'other'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_status_check
    check (status in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined'));
exception
  when duplicate_object then null;
end $$;

create index if not exists app_feedback_status_created_at_idx
  on public.app_feedback (status, created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "Anyone insert app feedback" on public.app_feedback;
create policy "Anyone insert app feedback"
  on public.app_feedback for insert
  with check (true);

drop policy if exists "Admin read app feedback" on public.app_feedback;
create policy "Admin read app feedback"
  on public.app_feedback for select
  using (auth.role() = 'anon' or public.current_user_role() = 'admin');

drop policy if exists "Admin write app feedback" on public.app_feedback;
create policy "Admin write app feedback"
  on public.app_feedback for update
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

create or replace function public.submit_app_feedback(
  p_body text,
  p_kind text default 'suggestion',
  p_surface text default 'other'
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  kind_n text := lower(btrim(coalesce(p_kind, 'suggestion')));
  surface_n text := lower(btrim(coalesce(p_surface, 'other')));
  body_n text := btrim(coalesce(p_body, ''));
  result public.app_feedback;
begin
  if length(body_n) < 8 then
    raise exception 'Tell us a bit more — at least a short sentence.';
  end if;
  if kind_n not in ('suggestion', 'bug', 'look', 'other') then
    kind_n := 'suggestion';
  end if;
  if surface_n not in ('home', 'local', 'spotlight', 'drip', 'profile', 'other') then
    surface_n := 'other';
  end if;

  insert into public.app_feedback (author_id, body, kind, surface, status)
  values (auth.uid(), body_n, kind_n, surface_n, 'new')
  returning * into result;

  return result;
end;
$$;

create or replace function public.get_app_feedback()
returns setof public.app_feedback
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.app_feedback
  order by
    case status
      when 'new' then 0
      when 'reviewing' then 1
      when 'planned' then 2
      when 'shipping' then 3
      else 4
    end,
    created_at desc
  limit 80;
$$;

create or replace function public.triage_app_feedback(
  target_id uuid,
  next_status text,
  next_note text default '',
  next_runtime_path text default ''
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  status_n text := lower(btrim(coalesce(next_status, '')));
  result public.app_feedback;
begin
  if status_n not in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined') then
    raise exception 'Unknown feedback status %', next_status;
  end if;

  update public.app_feedback
  set
    status = status_n,
    admin_note = coalesce(next_note, admin_note),
    runtime_path = coalesce(next_runtime_path, runtime_path),
    updated_at = timezone('utc', now())
  where id = target_id
  returning * into result;

  if result.id is null then
    raise exception 'Feedback not found.';
  end if;

  return result;
end;
$$;

grant select, insert, update on public.app_feedback to anon, authenticated;
grant execute on function public.submit_app_feedback(text, text, text) to anon, authenticated;
grant execute on function public.get_app_feedback() to anon, authenticated;
grant execute on function public.triage_app_feedback(uuid, text, text, text) to anon, authenticated;

-- Locker Room Wishlist gear funding. Incremental: supabase/locker_room_wishlist.sql.
-- Locker Room Wishlist: crowd-funded gear on the athlete Stats tab. Safe to re-run.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.players (id) on delete cascade,
  title text not null,
  photo_url text not null default '',
  buy_url text not null default '',
  target_amount_cents integer not null default 0,
  current_amount_cents integer not null default 0,
  is_equipped boolean not null default false,
  equipped_at timestamptz,
  aura_awarded boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wishlist_items add column if not exists photo_url text not null default '';
alter table public.wishlist_items add column if not exists buy_url text not null default '';
alter table public.wishlist_items add column if not exists target_amount_cents integer not null default 0;
alter table public.wishlist_items add column if not exists current_amount_cents integer not null default 0;
alter table public.wishlist_items add column if not exists is_equipped boolean not null default false;
alter table public.wishlist_items add column if not exists equipped_at timestamptz;
alter table public.wishlist_items add column if not exists aura_awarded boolean not null default false;
alter table public.wishlist_items add column if not exists is_active boolean not null default true;
alter table public.wishlist_items add column if not exists sort_order integer not null default 0;
alter table public.wishlist_items add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.wishlist_items
    add constraint wishlist_items_amounts_check
    check (target_amount_cents >= 0 and current_amount_cents >= 0);
exception
  when duplicate_object then null;
end $$;

create index if not exists wishlist_items_player_idx
  on public.wishlist_items (player_id, is_equipped, sort_order);

alter table public.wishlist_items enable row level security;

drop policy if exists "Public read wishlist items" on public.wishlist_items;
create policy "Public read wishlist items"
  on public.wishlist_items for select
  using (true);

drop policy if exists "Admin write wishlist items" on public.wishlist_items;
create policy "Admin write wishlist items"
  on public.wishlist_items for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

/**
 * Active wishlist for one athlete. Unfunded gear first so fans see what still needs money.
 */
create or replace function public.get_wishlist_items(target_player_id uuid)
returns setof public.wishlist_items
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.wishlist_items
  where player_id = target_player_id
    and is_active
  order by is_equipped, sort_order, created_at
  limit 20;
$$;

/**
 * Add a Mālo contribution to one wishlist item. Crossing the target equips the item once and
 * awards the athlete a flat +500 Aura through add_user_aura.
 */
create or replace function public.chip_in_wishlist_item(item_id uuid, amount_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  add_cents integer := greatest(coalesce(amount_cents, 0), 0);
  equip_aura constant integer := 500;
  row_after public.wishlist_items;
  newly_equipped boolean := false;
  awarded integer := 0;
  aura_result jsonb;
begin
  update public.wishlist_items
  set
    current_amount_cents = current_amount_cents + add_cents,
    updated_at = timezone('utc', now())
  where id = item_id
  returning * into row_after;

  if row_after.id is null then
    raise exception 'Wishlist item not found.';
  end if;

  if row_after.target_amount_cents > 0
    and row_after.current_amount_cents >= row_after.target_amount_cents
    and not row_after.aura_awarded
  then
    update public.wishlist_items
    set
      is_equipped = true,
      equipped_at = timezone('utc', now()),
      aura_awarded = true,
      updated_at = timezone('utc', now())
    where id = item_id
    returning * into row_after;

    newly_equipped := true;
    awarded := equip_aura;

    if row_after.player_id is not null then
      aura_result := public.add_user_aura(row_after.player_id, equip_aura);
    end if;
  end if;

  return jsonb_build_object(
    'item', to_jsonb(row_after),
    'newly_equipped', newly_equipped,
    'aura_points', awarded,
    'athlete_aura_points', (aura_result ->> 'aura_points')::integer
  );
end;
$$;

grant select on public.wishlist_items to anon, authenticated;
grant insert, update, delete on public.wishlist_items to anon, authenticated;
grant execute on function public.get_wishlist_items(uuid) to anon, authenticated;
grant execute on function public.chip_in_wishlist_item(uuid, integer) to anon, authenticated;

-- Sports builder playbooks. Incremental: supabase/sport_configs.sql.
-- Sports builder: per-sport scoring, periods, callouts, and Stats 📊 fields. Safe to re-run.

create table if not exists public.sport_configs (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  emoji text not null default '🏅',
  period_label text not null default 'Period',
  periods jsonb not null default '["P1","P2","OT"]'::jsonb,
  uses_clock boolean not null default true,
  clock_seconds integer not null default 720,
  scoring jsonb not null default '[]'::jsonb,
  callouts jsonb not null default '[]'::jsonb,
  stat_fields jsonb not null default '[]'::jsonb,
  measurables jsonb not null default '[]'::jsonb,
  positions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sport_configs add column if not exists emoji text not null default '🏅';
alter table public.sport_configs add column if not exists period_label text not null default 'Period';
alter table public.sport_configs add column if not exists periods jsonb not null default '["P1","P2","OT"]'::jsonb;
alter table public.sport_configs add column if not exists uses_clock boolean not null default true;
alter table public.sport_configs add column if not exists clock_seconds integer not null default 720;
alter table public.sport_configs add column if not exists scoring jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists callouts jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists stat_fields jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists measurables jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists positions jsonb not null default '[]'::jsonb;
alter table public.sport_configs add column if not exists is_active boolean not null default true;
alter table public.sport_configs add column if not exists sort_order integer not null default 0;
alter table public.sport_configs add column if not exists updated_at timestamptz not null default now();

create unique index if not exists sport_configs_sport_key
  on public.sport_configs (lower(btrim(sport)));

-- Which playbook a match uses. Operator console reads it to build score buttons and period chips.
alter table public.games add column if not exists sport text not null default 'Football';

alter table public.sport_configs enable row level security;

drop policy if exists "Public read sport configs" on public.sport_configs;
create policy "Public read sport configs"
  on public.sport_configs for select
  using (true);

drop policy if exists "Admin write sport configs" on public.sport_configs;
create policy "Admin write sport configs"
  on public.sport_configs for all
  using (auth.role() = 'anon' or public.current_user_role() = 'admin')
  with check (auth.role() = 'anon' or public.current_user_role() = 'admin');

/**
 * Every playbook, active first, in builder order. The fan app and operator console both read this.
 */
create or replace function public.get_sport_configs()
returns setof public.sport_configs
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.sport_configs
  order by sort_order, sport
  limit 100;
$$;

/**
 * Create or update one playbook from the admin Sports desk. Matching is by lower(sport) so a
 * rename creates a new row instead of silently orphaning games.
 */
create or replace function public.upsert_sport_config(payload jsonb)
returns public.sport_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  sport_n text := btrim(coalesce(payload ->> 'sport', ''));
  target_id uuid := nullif(payload ->> 'id', '')::uuid;
  result public.sport_configs;
begin
  if sport_n = '' then
    raise exception 'Name the sport before saving.';
  end if;

  if target_id is null then
    select id into target_id
    from public.sport_configs
    where lower(btrim(sport)) = lower(sport_n);
  end if;

  insert into public.sport_configs as sc (
    id, sport, emoji, period_label, periods, uses_clock, clock_seconds,
    scoring, callouts, stat_fields, measurables, positions, is_active, sort_order, updated_at
  )
  values (
    coalesce(target_id, gen_random_uuid()),
    sport_n,
    coalesce(nullif(payload ->> 'emoji', ''), '🏅'),
    coalesce(nullif(payload ->> 'period_label', ''), 'Period'),
    coalesce(payload -> 'periods', '[]'::jsonb),
    coalesce((payload ->> 'uses_clock')::boolean, true),
    greatest(coalesce((payload ->> 'clock_seconds')::integer, 0), 0),
    coalesce(payload -> 'scoring', '[]'::jsonb),
    coalesce(payload -> 'callouts', '[]'::jsonb),
    coalesce(payload -> 'stat_fields', '[]'::jsonb),
    coalesce(payload -> 'measurables', '[]'::jsonb),
    coalesce(payload -> 'positions', '[]'::jsonb),
    coalesce((payload ->> 'is_active')::boolean, true),
    coalesce((payload ->> 'sort_order')::integer, 0),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    sport = excluded.sport,
    emoji = excluded.emoji,
    period_label = excluded.period_label,
    periods = excluded.periods,
    uses_clock = excluded.uses_clock,
    clock_seconds = excluded.clock_seconds,
    scoring = excluded.scoring,
    callouts = excluded.callouts,
    stat_fields = excluded.stat_fields,
    measurables = excluded.measurables,
    positions = excluded.positions,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = timezone('utc', now())
  returning * into result;

  return result;
end;
$$;

/**
 * Remove a playbook. Games keep their `sport` text and fall back to the generic console.
 */
create or replace function public.delete_sport_config(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sport_configs where id = target_id;
  return found;
end;
$$;

grant select on public.sport_configs to anon, authenticated;
grant insert, update, delete on public.sport_configs to anon, authenticated;
grant execute on function public.get_sport_configs() to anon, authenticated;
grant execute on function public.upsert_sport_config(jsonb) to anon, authenticated;
grant execute on function public.delete_sport_config(uuid) to anon, authenticated;

-- Athlete HQ training badges. Incremental twin: supabase/athlete_training_badges.sql
-- Catalog + earn rules live in @tapuai/shared-types (`TRAINING_BADGES`).
create or replace function public.sync_athlete_training_badges(target_player_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player uuid := target_player_id;
  confirmed_tags integer := 0;
  malo_cents integer := 0;
  roster_claimed boolean := false;
begin
  if player is null then
    select pr.player_id into player
    from public.profiles pr
    where pr.user_id = auth.uid()
    limit 1;
  end if;

  if player is null then
    return jsonb_build_object(
      'player_id', null,
      'confirmed_tags', 0,
      'malo_cents', 0,
      'roster_claimed', false,
      'unlocks', '[]'::jsonb
    );
  end if;

  select count(*)::integer into confirmed_tags
  from public.reels r
  where r.player_id = player
    and r.tag_status = 'confirmed'
    and coalesce(r.is_removed, false) = false;

  select coalesce(sum(t.amount_cents), 0)::integer into malo_cents
  from public.tips t
  where t.player_id = player;

  select exists (
    select 1 from public.profiles pr where pr.player_id = player
  ) into roster_claimed;

  if confirmed_tags > 0 then
    insert into public.athlete_training_badge_unlocks (player_id, badge_id)
    values (player, 'film_room_starter')
    on conflict (player_id, badge_id) do nothing;
  end if;

  if malo_cents > 0 then
    insert into public.athlete_training_badge_unlocks (player_id, badge_id)
    values (player, 'community_backer_magnet')
    on conflict (player_id, badge_id) do nothing;
  end if;

  if roster_claimed then
    insert into public.athlete_training_badge_unlocks (player_id, badge_id)
    values (player, 'friday_night_lights')
    on conflict (player_id, badge_id) do nothing;
  end if;

  return jsonb_build_object(
    'player_id', player,
    'confirmed_tags', confirmed_tags,
    'malo_cents', malo_cents,
    'roster_claimed', roster_claimed,
    'unlocks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'badge_id', u.badge_id,
          'unlocked_at', u.unlocked_at
        )
        order by u.unlocked_at
      )
      from public.athlete_training_badge_unlocks u
      where u.player_id = player
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.sync_athlete_training_badges(uuid) to anon, authenticated;

-- Soft-Wall auth: fan profile on first signup (Apple / Google / Magic Link).
-- Incremental twin: supabase/auth_fan_profile.sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role, roles, is_verified, spirit_points, active_role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(new.email, 'fan'), '@', 1),
      'Fan'
    ),
    'fan',
    array['fan']::text[],
    false,
    0,
    'fan'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
