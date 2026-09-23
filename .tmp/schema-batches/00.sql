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
-- Phase 1 item 3 groundwork (docs/PARENT_PAYEE_CONNECT_DESIGN.md) — dated consent record alongside
-- the existing boolean, mirroring `profiles.legal_terms_accepted_at`. Not yet written by any code
-- path; the consent-flow UI that sets it is a follow-up gated on that design doc's sign-offs.
alter table public.players add column if not exists guardian_consent_at timestamptz;
-- Supports "which athletes does this guardian manage" / "who is this athlete's guardian" lookups
-- (already used by the tag-confirmation RPC below); no index existed on this FK.
create index if not exists players_guardian_id_idx on public.players (guardian_id);
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
alter table public.profiles add column if not exists legal_terms_accepted_at timestamptz;
alter table public.profiles add column if not exists legal_terms_version text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_verified_athlete boolean not null default false;
-- COPPA age gate (2026-09): self-attested "13 years of age or older" confirmation collected as a
-- checkbox at sign-up (data minimization — never a birthdate or exact age). Nullable/default null so
-- pre-existing accounts created before this gate existed are left alone, never retroactively blocked.
-- Set to true by `ensureFanProfile` (client fallback) or `handle_new_auth_user` (from signup metadata)
-- the moment a NEW account is created with the box checked; existing rows are never overwritten.
alter table public.profiles add column if not exists age_confirmed_13_plus boolean default null;
-- 2026-09 audit: CHECK constraints on the Aura currency / engagement counter columns, so even a
-- direct authenticated-staff table write (or a bug) can't drive them negative.
-- 2026-09 fix: every such `do $$ ... exception when duplicate_object then null $$` block in this
-- file now also catches `duplicate_table` (42P07) — a re-run that hits a UNIQUE constraint whose
-- backing index survived from an earlier partial run raises `relation "..." already exists`
-- (duplicate_table), not `duplicate_object` (42710), so the narrower catch alone left re-runs
-- fragile. Harmless no-op for the CHECK-constraint blocks, which never raise duplicate_table.
do $$
begin
  alter table public.players add constraint players_counters_check
    check (
      aura_points >= 0 and view_count >= 0 and aura_count >= 0
      and flex_count >= 0 and seki_count >= 0 and backer_count >= 0
    );
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter table public.profiles add constraint profiles_aura_points_check check (aura_points >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
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
alter table public.schools_and_teams add column if not exists team_code text;
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): per-school Mālo freeze switch. Nullable,
-- defaults to false. Flip only via `set_malo_freeze` (admin-only SECURITY DEFINER RPC below).
alter table public.schools_and_teams add column if not exists malo_frozen boolean default false;
create unique index if not exists schools_and_teams_team_code_key
  on public.schools_and_teams (upper(btrim(team_code)))
  where team_code is not null and btrim(team_code) <> '';
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
update public.schools_and_teams set team_code = 'WSTLK-2026' where id = 'a1000000-0000-4000-8000-000000000001' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'LPKHS-2026' where id = 'a1000000-0000-4000-8000-000000000002' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'ALAHS-2026' where id = 'a1000000-0000-4000-8000-000000000003' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'SKYRG-2026' where id = 'a1000000-0000-4000-8000-000000000004' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'AFORK-2026' where id = 'a1000000-0000-4000-8000-000000000005' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'TIMP-2026' where id = 'a1000000-0000-4000-8000-000000000006' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'BYU-2026' where id = 'a1000000-0000-4000-8000-000000000011' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'UTAH-2026' where id = 'a1000000-0000-4000-8000-000000000012' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'USU-2026' where id = 'a1000000-0000-4000-8000-000000000013' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'WEBER-2026' where id = 'a1000000-0000-4000-8000-000000000014' and coalesce(team_code, '') = '';
alter table public.profiles add column if not exists school_id uuid references public.schools_and_teams (id) on delete set null;
alter table public.profiles add column if not exists athlete_division text;
alter table public.profiles add column if not exists athlete_sport text;
alter table public.profiles add column if not exists athlete_jersey text;
alter table public.profiles add column if not exists athlete_position text;
alter table public.profiles add column if not exists athlete_class_year text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists player_id uuid references public.players (id) on delete set null;
alter table public.profiles add column if not exists verification_status text not null default 'unverified';
do $$
begin
  alter table public.profiles
    add constraint profiles_verification_status_check
    check (verification_status in ('unverified', 'pending', 'verified'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): per-athlete Mālo freeze switch so the team can
-- honor a written direction from a school/association within hours. Nullable, defaults to false so
-- existing rows are unaffected. Flip only via `set_malo_freeze` (admin-only SECURITY DEFINER RPC
-- below) — this column is never exposed to a raw client UPDATE.
alter table public.profiles add column if not exists malo_frozen boolean default false;
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
  when duplicate_table then null;
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