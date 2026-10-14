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
  aura_points integer not null default 0,
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
-- Phase 1 item 3 groundwork (docs/engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md) — dated consent record alongside
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

-- 2026-09 profile customization: free-text about-me, social handles, and a per-field "hide from
-- other users' view" map. `profile_visibility` defaults every field to visible so existing rows
-- behave exactly as before this migration. Enforcement for "hidden from others" lives in the
-- `profiles_public` view / `athlete_stats_visible()` further down this file, not here — the base
-- `profiles` table keeps its existing blanket `using (true)` read policy (documented above; a
-- column-level narrowing was already tried for `stripe_connect_id` and found unsafe to land blind).
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists social_links jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists profile_visibility jsonb not null default
  '{"bio": true, "school": true, "stats": true, "social_links": true}'::jsonb;

do $$
begin
  alter table public.profiles add constraint profiles_bio_length_check check (char_length(bio) <= 500);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

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

-- 2026-09 audit (Round 12 sweep, critical): this used to hardcode every real school's
-- `redeem_team_code` secret in plain text, in a file committed to git — WSTLK-2026, LPKHS-2026,
-- etc. `redeem_team_code` grants instant "⚡ VERIFIED VARSITY" status (school claim, athlete role,
-- Spotlight eligibility) to any signed-in account that submits the right code, no coach/staff
-- approval, no identity check — that is the entire point of the feature (fast onboarding), but it
-- means the code IS the only thing standing between "real athlete" and "anyone who read this file."
-- These are real Utah high schools (Westlake, Lone Peak, American Fork, Timpview — the actual
-- Phase 5 GTM target per docs/company/INVESTOR.md), and this file's git history now permanently contains
-- every one of those codes regardless of what runs next. Do not put a real school's code in any
-- committed file again: generate a high-entropy value out-of-band (a UUID segment or random token,
-- not a guessable SCHOOL-SPORT-YEAR pattern — that format is small enough to brute-force via
-- `redeem_team_code` directly even without the leak, since it's `authenticated`-only with no rate
-- limit), set it directly via the Supabase SQL Editor or dashboard (never a file that gets
-- committed), and hand it to the coach out-of-band (not in any doc/code file either). The codes
-- from this file's history should be treated as already compromised and rotated the same way before
-- any real school/athlete relies on them.

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
-- Where the gift was started, and how the fan arrived. Billing groups on these, not on the athlete alone.
-- origin: highlight | qr | wishlist | profile | live
-- entry: in_app | qr_link (a Highlight opened after a QR scan stays origin=highlight, entry=qr_link)
alter table public.tips add column if not exists origin text not null default 'profile';
alter table public.tips add column if not exists entry text not null default 'in_app';
alter table public.tips add column if not exists source_label text not null default '';
alter table public.tips add column if not exists wishlist_item_id uuid;

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
create index if not exists tips_origin_created_at_idx on public.tips (origin, created_at desc);
create index if not exists tips_wishlist_item_id_idx on public.tips (wishlist_item_id) where wishlist_item_id is not null;

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

-- 2026-09 audit (Round 24 follow-up): `tips` is written directly by the client right after
-- `presentPaymentSheet()` resolves (see `useTipCheckout.ts`), with no server-side verification yet
-- that a Stripe charge of this amount actually happened (that's the dormant rich-metadata path in
-- `supabase/functions/stripe-webhook/`). Applying the same per-row cap `chip_in_wishlist_item`
-- already uses for the identical gap ($1,000 / 10,000 Aura) as a stopgap until that webhook path is
-- live — bounds the blast radius of a fabricated row without touching any legitimate flow (tip
-- presets top out at $25). `service_role` (the eventual webhook's own writes) is exempt so a real,
-- Stripe-verified tip larger than this can still be recorded once that path ships.
do $$
begin
  alter table public.tips add constraint tips_amount_cents_cap_check
    check (auth.role() = 'service_role' or amount_cents <= 100000);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.tips add constraint tips_aura_points_cap_check
    check (auth.role() = 'service_role' or aura_points <= 10000);
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

-- 2026-09 audit (Round 24 follow-up): same gap and same stopgap as `tips` above — a sponsor can
-- self-insert this row (see "Insert sponsorships" policy) with no server-side charge verification
-- yet. Cap comfortably covers the real catalog max (Platinum $500) with headroom.
do $$
begin
  alter table public.sponsorships add constraint sponsorships_amount_cents_cap_check
    check (auth.role() = 'service_role' or amount_cents <= 100000);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.sponsorships add constraint sponsorships_aura_points_cap_check
    check (auth.role() = 'service_role' or aura_points <= 10000);
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

-- 2026-09 data-privacy sweep (docs/STATE.md §5): INSERT stays open to anon so guest
-- browse still logs. These CHECKs stop one row from wrecking a Reports average.
-- surface_scroll is 0–100 depth; tab_dwell up to 12 hours; other durations up to 10 minutes.
-- flash_unlock and stripe_webhook_payment_succeeded are real writers (the webhook is service
-- role, and a CHECK still applies there). Volume spoofing of many small rows is still open (§6).
alter table public.telemetry_logs drop constraint if exists telemetry_logs_event_type_check;
alter table public.telemetry_logs add constraint telemetry_logs_event_type_check
  check (event_type in (
    'video_stall', 'video_first_frame', 'socket_reconnect', 'checkout_latency',
    'tab_dwell', 'surface_scroll', 'feature_tap', 'ui_issue',
    'flash_unlock', 'stripe_webhook_payment_succeeded'
  ));

alter table public.telemetry_logs drop constraint if exists telemetry_logs_duration_ms_check;
alter table public.telemetry_logs add constraint telemetry_logs_duration_ms_check
  check (
    duration_ms is null
    or (
      duration_ms >= 0
      and case event_type
        when 'surface_scroll' then duration_ms <= 100
        when 'tab_dwell' then duration_ms <= 43200000
        else duration_ms <= 600000
      end
    )
  );

alter table public.telemetry_logs drop constraint if exists telemetry_logs_attempts_check;
alter table public.telemetry_logs add constraint telemetry_logs_attempts_check
  check (attempts is null or (attempts >= 0 and attempts <= 1000));

alter table public.telemetry_logs drop constraint if exists telemetry_logs_text_check;
alter table public.telemetry_logs add constraint telemetry_logs_text_check
  check (
    (video_id is null or char_length(video_id) <= 80)
    and (channel is null or char_length(channel) <= 160)
    and (step is null or char_length(step) <= 80)
  );

alter table public.telemetry_logs drop constraint if exists telemetry_logs_payload_check;
alter table public.telemetry_logs add constraint telemetry_logs_payload_check
  check (octet_length(payload::text) <= 4000);

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

-- 2026-09 audit (Round 12 sweep): rate limit for redeem_team_code below — the SCHOOL-SPORT-YEAR
-- code format is a small enough keyspace to brute-force via the RPC directly (no rate limit
-- existed at all), independent of the separate git-leak issue fixed above.
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

  -- 2026-09 audit (Round 12 sweep): reject before ever touching schools_and_teams once locked out,
  -- so a locked-out account can't keep using this call to probe codes either.
  if me.team_code_locked_until is not null and me.team_code_locked_until > timezone('utc', now()) then
    raise exception 'Too many attempts. Try again later.';
  end if;

  -- 2026-09 audit (Round 31/33 follow-up): `team_code_fail_count`/`team_code_locked_until` are
  -- protected from a raw client write by `guard_profiles_admin_escalation` below, which requires
  -- either an admin session or this transaction-local flag — set here, right before the only two
  -- places in this function that touch those columns, so a raw REST call attempting the same reset
  -- (with no flag set) is rejected while this function's own legitimate resets still work. `true` as
  -- the third argument to `set_config` scopes it to the current transaction only; PostgREST runs
  -- each RPC call in its own transaction, so this never leaks into an unrelated request.
  perform set_config('app.tapuai_team_code_write', 'true', true);

  select * into school
  from public.schools_and_teams s
  where upper(btrim(coalesce(s.team_code, ''))) in (n, school_key)
  limit 1;

  if school.id is null then
    -- 2026-09 audit (Round 31 sweep): this used to `raise exception` right after the update above —
    -- but an unhandled exception rolls back everything this function call did, including that same
    -- update, since there is no exception handler anywhere in this function to create a savepoint
    -- boundary. That meant the fail-count increment (and the lockout it is supposed to trigger) never
    -- actually persisted to the database on a single wrong guess — the Round 12 lockout has never
    -- been functionally live, silently defeating its own purpose since it was written. Returning a
    -- graceful `{ok: false, ...}` JSON result instead lets the update above actually commit;
    -- `lib/verification.ts`'s `redeemTeamCode()` already re-throws on `ok: false`, so the client-
    -- facing contract (this call throws on a bad code) is unchanged.
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

  -- A real code resets the counter — only wrong guesses count toward the lockout.
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

create or replace function public.increment_backer_count(target_player_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): a frozen athlete's public backer count must
  -- not keep climbing off a Mālo that the `tips` INSERT already rejects — see `malo_target_frozen`.
  if public.malo_target_frozen(target_player_id) then
    raise exception 'Mālo is frozen for this athlete; backer count cannot be incremented.';
  end if;

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

  -- SECURITY TRADEOFF (2026-09 audit item 1/4): this RPC is called for BOTH the tipper
  -- (self-Aura) and the athlete recipient right after a real tip (see useTipCheckout.ts),
  -- so a strict `auth.uid() = target_user_id` ownership check would break the "award the
  -- athlete too" half. Postgres/RLS alone cannot verify a real Stripe charge happened —
  -- that verification now lives in supabase/functions/stripe-webhook/index.ts, which writes
  -- Aura directly (as service_role, exempt below) once a charge is confirmed. Until every
  -- caller is migrated to trust that webhook instead of calling this RPC client-side, cap the
  -- client-facing path so a compromised/scripted client can fabricate at most a small amount
  -- of Aura per call rather than an unbounded amount. This is a stopgap, not a fix.
  if auth.role() <> 'service_role' and add_points > 5000 then
    raise exception 'points_to_add exceeds the per-call limit (5000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this RPC is called both for the tipper's own
  -- Fan Aura (target_user_id = auth user id) and for the athlete recipient's Athlete Aura
  -- (target_user_id = players.id) — see useTipCheckout.ts. `malo_target_frozen` only matches a
  -- `profiles` row keyed by `player_id = target_user_id`, so this is a no-op (false) for a tipper's
  -- own auth/profile id and only blocks the case that actually matters: awarding Aura to a frozen
  -- athlete. Applies to every caller (checkout, reel double-tap, wishlist chip-in), not service_role
  -- exempt, since the freeze must be a hard block regardless of caller.
  if public.malo_target_frozen(target_user_id) then
    raise exception 'Mālo is frozen for this athlete; Aura cannot be added.';
  end if;

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

-- Second tap on the same Seki / Aura / Flex chip. Deletes this fan's vote and steps the counter
-- down by one. No vote row means the counter stays put (`applied: false`).
create or replace function public.clear_reel_hype(target_reel_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reels%rowtype;
  viewer uuid := auth.uid();
  removed integer := 0;
begin
  if viewer is null then
    raise exception 'Sign in to change hype';
  end if;

  if hype_kind not in ('aura', 'flex', 'seki') then
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  delete from public.reel_hype_votes
  where user_id = viewer
    and reel_id = target_reel_id
    and kind = hype_kind;
  get diagnostics removed = row_count;

  if removed > 0 then
    if hype_kind = 'aura' then
      update public.reels
      set aura_count = greatest(coalesce(aura_count, 0) - 1, 0)
      where id = target_reel_id
      returning * into result;
    elsif hype_kind = 'flex' then
      update public.reels
      set flex_count = greatest(coalesce(flex_count, 0) - 1, 0)
      where id = target_reel_id
      returning * into result;
    else
      update public.reels
      set seki_count = greatest(coalesce(seki_count, 0) - 1, 0)
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
    'applied', removed > 0
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
  reel_player_id uuid;
begin
  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this is the visible running total of Mālo
  -- dollars on a clip — resolve the tagged athlete and block the same way `tips` INSERT does.
  -- An untagged reel (no player_id) has no freeze target, so it is not blocked.
  select player_id into reel_player_id from public.reels where id = target_reel_id;
  if reel_player_id is not null and public.malo_target_frozen(reel_player_id) then
    raise exception 'Mālo is frozen for this athlete; reel tip total cannot be updated.';
  end if;

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
  -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass. It let anyone
  -- holding only the public anon key (no session at all) confirm/reject any player's
  -- tag on any Highlight via `confirm_reel_player_tag`, which trusts this helper as its
  -- sole gate. Only a real admin session (or, below, the tagged athlete/guardian/
  -- operator match) may confirm a tag now.
  if role_name = 'admin' then
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
      -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass alongside
      -- `can_confirm_player_tag`'s matching fix, above.
      role_name = 'admin'
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
        and public.athlete_is_varsity_verified(p.id)
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
  -- 2026-09 audit: dropped the `auth.role() <> 'anon'` bypass — this is an admin-only Spotlight
  -- desk action (`/admin/spotlight`), not part of the anon operator-PIN sideline flow.
  if public.current_user_role() <> 'admin' then
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
  owner_profile uuid;
  clip_uploader uuid;
  next_vault boolean;
begin
  if actor is null then
    raise exception 'Sign in to change vault status.';
  end if;

  select uploaded_by into clip_uploader from public.reels where id = target_reel_id;
  if not found then
    raise exception 'Highlight not found.';
  end if;

  select p.id into owner_profile from public.profiles p where p.user_id = actor limit 1;

  -- 2026-09 audit (reels RLS tightening): this RPC previously let *any* signed-in user flip the
  -- Vault flag on *any* reel — it only checked `actor is not null`, not who uploaded the clip. Now
  -- scoped to the uploader (matches `AthleteReelManager`'s own-clip long-press menu) or an admin
  -- (matches the `/admin/highlights` desk's Vault toggle).
  if clip_uploader is distinct from owner_profile and public.current_user_role() <> 'admin' then
    raise exception 'Only the uploader or an admin can change this Highlight''s Vault status.';
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

  -- 2026-09 audit follow-up: this SECURITY DEFINER RPC bypasses RLS entirely, so it needs its own
  -- ownership check — previously any signed-in fan could lock/unlock any athlete's Vault. There
  -- are two legitimate callers: (a) the athlete themselves, managing their own claimed roster row
  -- from their own Profile tab (`app/(tabs)/profile.tsx`'s `manageVault` — `VaultLockCard`), and
  -- (b) school staff from the admin Athletes desk (`AthletesTool.tsx`), mirroring the "Staff write
  -- players" RLS policy's role set.
  -- 2026-09 audit (Round 27/33 sweep): `profiles.player_id` is a self-service, unverified claim by
  -- design (`saveAthleteOnboardingRemote`'s fuzzy name match, no team-code requirement — see
  -- `docs/company/ALA_TEAM_BRIEF.md`'s "claim freely, not a wall" onboarding philosophy) — anyone could
  -- previously set their own `player_id` to any real athlete's id and lock/unlock that athlete's
  -- Vault paywall at will. Vault control is a real monetization gate, not a browse feature, so it's
  -- the right place to draw the line: require the caller's own profile to be `is_verified` (i.e.
  -- actually redeemed a coach-issued team code for their claimed school), narrowing this from "any
  -- account, any player_id" down to "an account that passed real school verification, claiming a
  -- player_id." Still not a perfect athlete-to-row match (a verified teammate could still claim a
  -- different teammate's row), but closes the "any stranger, zero verification" version of the gap
  -- without touching the free/unverified onboarding path itself.
  if not (
    public.current_user_role() in ('booster', 'admin', 'operator')
    or exists (
      select 1 from public.profiles p
      where p.user_id = actor
        and p.player_id = target_player_id
        and coalesce(p.is_verified, false)
    )
  ) then
    raise exception 'Only the verified athlete, school staff, or admin may lock or open a Vault.';
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
  owner_profile uuid;
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

  select p.id into owner_profile from public.profiles p where p.user_id = actor limit 1;

  -- 2026-09 audit (reels RLS tightening): previously any signed-in user could flash-unlock any
  -- Vault clip for free (no ownership check at all) — this only exists as an athlete's own-clip
  -- promo tool (`AthleteReelManager`), so scope it the same way as `toggle_reel_vault_status`.
  if clip.uploaded_by is distinct from owner_profile and public.current_user_role() <> 'admin' then
    raise exception 'Only the uploader or an admin can flash-unlock this Highlight.';
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
  -- 2026-09 audit: dropped the `auth.role() <> 'anon'` bypass — this is an admin-only Spotlight
  -- desk action (`/admin/spotlight`), not part of the anon operator-PIN sideline flow.
  if public.current_user_role() <> 'admin' then
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
  -- 2026-09 audit: dropped the `auth.role() <> 'anon'` bypass — content moderation is an
  -- admin-only action, not part of the anon operator-PIN sideline flow.
  if public.current_user_role() <> 'admin' then
    raise exception 'Access restricted';
  end if;
  -- 2026-09 audit (reels RLS tightening): `restore` added so the `/admin/highlights` desk's
  -- un-remove toggle (`setHighlightRemoved(reelId, false)`) has an admin-gated RPC path now that
  -- `is_removed` is no longer in the raw-UPDATE column grant (see the RLS policy comment below).
  if action not in ('dismiss', 'remove', 'restore') then
    raise exception 'Unknown moderation_action %', moderation_action;
  end if;

  if action = 'dismiss' then
    update public.reels
    set is_flagged = false
    where id = target_reel_id
    returning * into result;
  elsif action = 'restore' then
    update public.reels
    set is_removed = false
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

-- 2026-09 audit (Round 18 sweep, critical): was anon-executable with no role check at all — the
-- exact same gap already found and fixed for `get_admin_reports`/`get_company_revenue_summary`
-- (2026-09 audit item 7), just never applied here too. `malo_cents` alone is the platform's total
-- Mālo revenue across every fan/athlete; anyone with the public anon key could read it, plus
-- engagement/moderation-queue counts, with no login at all. Fixed inline with `current_user_role()`
-- (defined earlier in this file, unlike `require_admin_guard()` which is defined much later — used
-- directly here rather than forward-referencing it) as a leading statement that raises before the
-- real query runs if the caller isn't admin.
create or replace function public.get_admin_platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
  return jsonb_build_object(
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
end;
$$;

-- fan_user_id is accepted (and ignored) only for client call-signature compatibility;
-- the function ALWAYS scopes to the authenticated caller and never trusts a
-- client-supplied identity. An anonymous caller (auth.uid() is null) gets zero rows.
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

-- Admin Money desk: every Mālo grouped by where it started, how the fan arrived, and the latest rows.
create or replace function public.get_admin_malo_breakdown()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'by_origin', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'origin', grouped.origin,
        'cents', grouped.cents,
        'count', grouped.n
      ) order by grouped.cents desc), '[]'::jsonb)
      from (
        select coalesce(origin, 'profile') as origin,
               coalesce(sum(amount_cents), 0)::int as cents,
               count(*)::int as n
        from public.tips
        group by 1
      ) grouped
    ),
    'by_entry', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'entry', grouped.entry,
        'cents', grouped.cents,
        'count', grouped.n
      ) order by grouped.cents desc), '[]'::jsonb)
      from (
        select coalesce(entry, 'in_app') as entry,
               coalesce(sum(amount_cents), 0)::int as cents,
               count(*)::int as n
        from public.tips
        group by 1
      ) grouped
    ),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', grouped.day,
        'origin', grouped.origin,
        'cents', grouped.cents,
        'count', grouped.n
      ) order by grouped.day, grouped.origin), '[]'::jsonb)
      from (
        select to_char(created_at at time zone 'utc', 'YYYY-MM-DD') as day,
               coalesce(origin, 'profile') as origin,
               coalesce(sum(amount_cents), 0)::int as cents,
               count(*)::int as n
        from public.tips
        where created_at >= timezone('utc', now()) - interval '14 days'
        group by 1, 2
      ) grouped
    ),
    'recent', (
      select coalesce(jsonb_agg(to_jsonb(recent_row) order by recent_row.created_at desc), '[]'::jsonb)
      from (
        select
          t.id,
          t.amount_cents,
          coalesce(t.aura_points, 0) as aura_points,
          t.created_at,
          coalesce(t.origin, 'profile') as origin,
          coalesce(t.entry, 'in_app') as entry,
          coalesce(t.source_label, '') as source_label,
          t.reel_id,
          t.wishlist_item_id,
          coalesce(nullif(p.name, ''), 'Athlete') as athlete_name,
          coalesce(nullif(f.full_name, ''), 'Fan') as fan_name
        from public.tips t
        left join public.players p on p.id = t.player_id
        left join public.profiles f on f.user_id = t.fan_id
        order by t.created_at desc
        limit 40
      ) recent_row
    )
  ) into payload;

  return payload;
end;
$$;

-- Gifts an athlete (or their linked guardian) can read. Fans still use get_fan_tip_history for what they sent.
-- Re-runnable: 20261013231000 (end of file) changes this function's result columns, so a re-run drops first.
drop function if exists public.get_received_malo(uuid);
create or replace function public.get_received_malo(target_player_id uuid)
returns table (
  id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  origin text,
  entry text,
  source_label text,
  reel_id uuid,
  wishlist_item_id uuid,
  fan_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_player_id is null then
    return;
  end if;

  if public.current_user_role() is distinct from 'admin'
    and not exists (
      select 1
      from public.profiles me
      where me.user_id = auth.uid()
        and me.player_id = target_player_id
    )
    and not exists (
      select 1
      from public.players pl
      join public.profiles me on me.id = pl.guardian_id
      where pl.id = target_player_id
        and me.user_id = auth.uid()
    )
  then
    return;
  end if;

  return query
  select
    t.id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(t.origin, 'profile') as origin,
    coalesce(t.entry, 'in_app') as entry,
    coalesce(t.source_label, '') as source_label,
    t.reel_id,
    t.wishlist_item_id,
    coalesce(nullif(f.full_name, ''), 'Fan') as fan_name
  from public.tips t
  left join public.profiles f on f.user_id = t.fan_id
  where t.player_id = target_player_id
  order by t.created_at desc
  limit 100;
end;
$$;

drop function if exists public.search_schools_and_teams(text);

-- 2026-09 audit (Round 13 sweep, critical): was `returns setof public.schools_and_teams` with
-- `select s.*` — since this is SECURITY DEFINER (runs as the function owner, bypassing the caller's
-- column grants entirely), it leaked every school's `team_code` regardless of the table-level
-- column grant fix above. Explicit column list — no `team_code` — closes it at the source instead
-- of relying on the return type to coincidentally not include it.
create or replace function public.search_schools_and_teams(search_query text)
returns table (
  id uuid,
  name text,
  mascot text,
  level text,
  division text,
  region text,
  city text,
  created_at timestamptz,
  malo_frozen boolean
)
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
  select s.id, s.name, s.mascot, s.level, s.division, s.region, s.city, s.created_at, s.malo_frozen
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
  -- 2026-09 audit item 12: this is SECURITY DEFINER, so it bypasses the "Operators update games"
  -- RLS policy's claimed_by-narrowing entirely — and it's the operator console's PRIMARY score
  -- path (`updateGameScore` in lib/operator.ts calls this RPC before falling back to a direct
  -- table UPDATE), so leaving this function unconditional would make that RLS narrowing mostly
  -- cosmetic. Same stopgap here: an anon caller may only update a game that is still unclaimed.
  if public.current_user_role() not in ('operator', 'admin') and auth.role() <> 'service_role' then
    if exists (select 1 from public.games where id = target_game_id and claimed_by is not null) then
      raise exception 'This game has been claimed by another operator.';
    end if;
  end if;

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

-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): true when the target athlete's own profile
-- freeze, or their school's freeze, should block NEW Mālo/exclusive money for `players.id`
-- `target_player_id`. Reused by the `tips` and `subscriptions` INSERT/UPDATE checks below. A
-- roster row with no linked `profiles` row (unclaimed athlete) has nowhere to store a freeze flag,
-- so it reads as not-frozen — matches the rest of the freeze switch, which only exists on claimed
-- profiles/schools.
create or replace function public.malo_target_frozen(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    left join public.schools_and_teams sc on sc.id = pr.school_id
    where pr.player_id = target_player_id
      and (coalesce(pr.malo_frozen, false) or coalesce(sc.malo_frozen, false))
  );
$$;

grant execute on function public.malo_target_frozen(uuid) to anon, authenticated;

-- 2026-09 profile customization: gates `athlete_career_stats` / `athlete_game_logs` SELECT so an
-- athlete can hide their stats from other users via `profiles.profile_visibility->>'stats'`. Mirrors
-- `malo_target_frozen`'s "look up the claiming profile via player_id" shape. A player row nobody has
-- claimed yet (no matching `profiles.player_id`) has no owner to make that choice, so it stays
-- visible — this only ever narrows access for a player an owner has actually claimed and hidden.
-- Owner and admin always see their own stats regardless of the flag (matches the "hide from other
-- users' view only" scope agreed with the product owner).
create or replace function public.athlete_stats_visible(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select coalesce((pr.profile_visibility->>'stats')::boolean, true)
        or pr.user_id = auth.uid()
        or public.current_user_role() = 'admin'
      from public.profiles pr
      where pr.player_id = target_player_id
      limit 1
    ),
    true
  );
$$;

grant execute on function public.athlete_stats_visible(uuid) to anon, authenticated;

drop function if exists public.set_malo_freeze(text, uuid, boolean);

-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): the intended way to flip `profiles.malo_frozen` /
-- `schools_and_teams.malo_frozen` — admin-only, checked internally via `current_user_role()`.
-- 2026-09 audit (Round 29 sweep): the original version of this comment claimed this RPC was "the
-- ONLY way" to change `malo_frozen` since no extra grant was added for it — that reasoning was wrong
-- the same way the original `is_admin` self-escalation bug was: `profiles` already has a blanket
-- `grant ... update` with no column restriction, so a raw client UPDATE to the caller's own row hit
-- the exact same gap regardless of this RPC's own admin check. Real defense is now in
-- `guard_profiles_admin_escalation`, which also guards this column.
create or replace function public.set_malo_freeze(target_type text, target_id uuid, frozen boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_frozen boolean := coalesce(frozen, false);
  updated_id uuid;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Access restricted';
  end if;
  if target_id is null then
    raise exception 'target_id required';
  end if;

  if target_type = 'athlete' then
    update public.profiles
    set malo_frozen = next_frozen
    where id = target_id
    returning id into updated_id;
  elsif target_type = 'school' then
    update public.schools_and_teams
    set malo_frozen = next_frozen
    where id = target_id
    returning id into updated_id;
  else
    raise exception 'Unknown target_type %', target_type;
  end if;

  if updated_id is null then
    raise exception '% not found', target_type;
  end if;

  return next_frozen;
end;
$$;

grant execute on function public.set_malo_freeze(text, uuid, boolean) to authenticated;

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
alter table public.spotlight_awards enable row level security;
alter table public.crew_follows enable row level security;
alter table public.crew_push_queue enable row level security;

-- Read: guests/fans can watch game day.
-- SECURITY NOTE (2026-09 audit item 6): kept `using (true)` here deliberately — profiles power
-- guest-facing reads across the app with no Supabase session at all (public /user/[id], Team
-- Roster Strip `lib/roster.ts`, Top Boosters `useAuraBoosters.ts`, /gift/[handle] `lib/share.ts`),
-- so gating this to `authenticated` would break the documented browse-first guest flow. The
-- concretely named harmful column (`stripe_connect_id`) is NOT closed in this pass — see the long
-- comment on the `grant ... on public.profiles` line below for why a column-level fix was drafted,
-- found unsafe to land blind (breaks `AuthContext.tsx`'s `select('*')` self-profile load), and
-- reverted in favor of flagging it as a real, testable-only-on-staging follow-up.
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles" on public.profiles for select using (true);

drop policy if exists "Public read schools and teams" on public.schools_and_teams;
create policy "Public read schools and teams"
  on public.schools_and_teams for select
  using (true);

-- 2026-09 profile customization: was `using (true)`. Now defers to `athlete_stats_visible()` so an
-- athlete can hide their own career stats from other users (owner/admin still always see them).
drop policy if exists "Public read athlete career stats" on public.athlete_career_stats;
create policy "Public read athlete career stats"
  on public.athlete_career_stats for select
  using (public.athlete_stats_visible(player_id));

drop policy if exists "Public read athlete game logs" on public.athlete_game_logs;
create policy "Public read athlete game logs"
  on public.athlete_game_logs for select
  using (public.athlete_stats_visible(player_id));

drop policy if exists "Public read spotlight awards" on public.spotlight_awards;
create policy "Public read spotlight awards"
  on public.spotlight_awards for select
  using (true);

-- 2026-09 audit item 12: dropped the `auth.role() = 'anon'` bypass. Spotlight publishing is an
-- admin desk action (`/admin/spotlight`), not the anon operator-PIN sideline flow, so there is no
-- guest-facing write to preserve here.
drop policy if exists "Admin write spotlight awards" on public.spotlight_awards;
create policy "Admin write spotlight awards"
  on public.spotlight_awards for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Public read crew follows" on public.crew_follows;
create policy "Public read crew follows" on public.crew_follows for select using (true);

drop policy if exists "Users write own crew follows" on public.crew_follows;
-- 2026-09 audit (Round 11 sweep): dropped the `auth.role() = 'anon'` bypass on both — this is a
-- fan feature gated by Soft-Wall (sign-in required before Join Crew is ever reachable), not an
-- admin/operator desk with the Studio-Unlock "no real session" excuse. `toggle_crew_follow`
-- (SECURITY DEFINER, already requires `auth.uid()` non-null) and `setCrewFollow`'s direct-table
-- fallback in `lib/crew.ts` (documented `@param userId Signed-in auth.uid()`) both only ever write
-- the caller's own `follower_id` — there was no legitimate anon caller, only an unconditional bypass
-- letting anyone with the public anon key insert fake Crew follows or delete any real user's Crew
-- relationships for any athlete pair.
create policy "Users write own crew follows"
  on public.crew_follows for all
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());

-- 2026-09 audit (Round 11 sweep): same bypass on SELECT let anyone with the anon key read every
-- fan's queued Crew push payloads, not just their own. INSERT was worse — `with check (true)`, no
-- role condition even needed — anyone could queue a fake in-app notification (`title`/`body`/`kind`
-- fully attacker-controlled) targeting any real `recipient_id`. The only real writer,
-- `set_reel_flash_unlock`, is SECURITY DEFINER and bypasses this policy already; nothing in the app
-- ever inserts here directly, so INSERT is now closed to clients entirely (and the grant below drops
-- to select-only).
drop policy if exists "Users read own crew push" on public.crew_push_queue;
create policy "Users read own crew push"
  on public.crew_push_queue for select
  using (recipient_id = auth.uid());

drop policy if exists "Insert crew push" on public.crew_push_queue;

-- 2026-09 audit (self-escalation fix, third pass — INSERT gap): this policy used to read
-- `with check (user_id = auth.uid() or auth.role() = 'anon')`, the same `auth.role() = 'anon'`
-- bypass pattern closed everywhere else in this file. Unlike the UPDATE policy below, no legitimate
-- caller ever needs the anon branch here: the only two INSERT paths into `profiles` are (a)
-- `handle_new_auth_user` (further down this file), a `SECURITY DEFINER` trigger on `auth.users` that
-- bypasses RLS entirely and is therefore unaffected by this policy either way, and (b)
-- `ensureFanProfile` in `lib/auth.ts`, the client fallback, which is only ever called with a `User`
-- already resolved from a real Supabase session (`data.user` / `data.session.user` after
-- `signUp` / `signInWithPassword` / OAuth exchange resolves) — it always runs as `authenticated`
-- with `user_id: user.id === auth.uid()`, so it already satisfies the `user_id = auth.uid()` branch
-- alone. With the anon branch present, an unauthenticated caller (raw anon key, no session) could
-- INSERT a brand-new row with `is_admin` / `role` / `roles` set directly — neither `add_user_role`'s
-- caller-must-already-be-admin check nor the `guard_profiles_admin_escalation` trigger (previously
-- `before update` only) applied to that path. The live blast radius was narrow (`user_id` carries a
-- `unique references auth.users (id)` FK, so the row must name a real, existing auth user, and
-- `handle_new_auth_user` normally already inserts that user's row first — the window was a fresh
-- `auth.users` id with no `profiles` row yet, e.g. a signup where the trigger insert failed/raced),
-- but `auth.role() = 'anon'` on an admin-flaggable table's INSERT check is wrong in principle
-- regardless of how narrow that window is. Fixed by dropping the anon branch; see
-- `guard_profiles_admin_escalation` below for the matching `before insert` defense-in-depth.
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (user_id = auth.uid());

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (user_id = auth.uid() or public.current_user_role() = 'admin')
  with check (user_id = auth.uid() or public.current_user_role() = 'admin');

-- 2026-09 audit (self-escalation fix, second half): the "Users update own profile" policy above
-- lets any signed-in user UPDATE their own row with no column restriction — `is_admin` / `role` /
-- `roles` included. `add_user_role()` now refuses to grant `admin` unless the caller is already
-- admin, but that RPC is not the only writer of these columns: any client can call
-- `supabase.from('profiles').update({ is_admin: true, role: 'admin', roles: ['admin'] }).eq
-- ('user_id', auth.uid())` directly and hit the exact same `user_id = auth.uid()` branch, bypassing
-- the RPC entirely. Postgres column-level GRANTs can't distinguish "this caller is already admin"
-- from "this caller is escalating themselves right now" (both run as the same `authenticated`
-- role), so the only reliable server-side gate is a row trigger that compares the caller's
-- *pre-existing* role (via `current_user_role()`, which reads the row as it stands before this
-- statement) against whether the write is trying to turn a non-admin row into an admin row. This
-- is defense-in-depth for the same vulnerability `add_user_role` was fixed for above, closing the
-- raw-`UPDATE` path (`PeopleTool`'s legitimate admin-grant action in `lib/adminCatalog.ts`'s
-- `patchAdminPerson` is unaffected: it is only ever called by a session that is already admin
-- against the RLS `using` branch above's `current_user_role() = 'admin'` grant, so `old_is_admin`
-- there is irrelevant — the trigger only blocks a *non-admin* caller flipping *their own* row to
-- admin).
-- 2026-09 audit (self-escalation fix, third pass — INSERT gap): this used to be `before update`
-- only, which left a brand-new INSERT free to set `is_admin`/`role`/`roles` to admin with no gate at
-- all (see "Users insert own profile" above for how that was reachable). Extended to
-- `before insert or update`. On INSERT there is no prior row to diff against — `old` doesn't exist
-- for that op — so the rule collapses to "the new row can't claim admin unless the caller performing
-- the insert is already admin" rather than the UPDATE path's "old row wasn't admin, new row is, and
-- the caller isn't admin". `TG_OP` distinguishes the two so the function never dereferences `old`
-- during an INSERT.
-- 2026-09 audit (Round 15 sweep, critical): generalized from admin-only to all five privileged
-- roles. `add_user_role` already refuses to self-grant `booster`/`operator`/`parent`/`sponsor`/
-- `admin` unless the caller is already admin (Round 3 fix) — but this trigger, the thing that closes
-- the matching raw-`UPDATE`-on-`profiles` bypass, only ever checked for `is_admin`/`role = 'admin'`.
-- `profiles` has a blanket `grant ... update` with no column restriction, so any signed-in fan could
-- run `update profiles set role = 'booster' where user_id = auth.uid()` directly and instantly pass
-- `current_user_role() in ('booster', 'admin', 'operator')` — unlocking full `players` table write
-- access ("Staff write players"), among other booster/operator-gated policies, with zero admin
-- grant. Same root cause and same fix shape as the original admin-escalation bug, just never
-- extended to the other four roles that RPC already protected.
-- Checks each of the 5 roles individually (not just "privileged vs not") — a coarse boolean would
-- let someone who already legitimately holds one privileged role (say an admin-granted `booster`)
-- self-upgrade to `operator` or `admin` via the same raw update, since "already privileged" would
-- read true both before and after. Only a role newly present in NEW that wasn't already in OLD
-- counts as an escalation.
-- 2026-09 fix (bootstrap gap, present since this trigger's original Round 3 version, only now
-- surfaced): `current_user_role()` resolves to `'guest'` for ANY session with no PostgREST JWT at
-- all — including a direct Supabase SQL Editor / migration / service-role connection, which never
-- sets `request.jwt.claims` in the first place. That meant this trigger blocked not just a client
-- self-escalating over the anon/authenticated REST API (the actual threat it exists for), but also
-- the legitimate one-time "grant the very first admin" SQL (`update profiles set is_admin = true
-- where ...`) run directly in the SQL Editor — a real superuser DB session already has unrestricted
-- power regardless of this trigger (it can `alter table ... disable trigger` outright), so blocking
-- it here bought no real security, only a confusing bootstrap failure. Fixed by exempting sessions
-- with no PostgREST role context at all (`auth.role() is null`) — distinct from, and does NOT
-- exempt, a genuine anon REST call, which always has `auth.role() = 'anon'` even with no `sub`
-- claim, so that path is still blocked exactly as before.
create or replace function public.guard_profiles_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged_roles constant text[] := array['admin', 'booster', 'operator', 'parent', 'sponsor'];
  new_roles_set text[];
  old_roles_set text[];
  gained text[];
begin
  if auth.role() is null then
    return new;
  end if;

  new_roles_set := coalesce(new.roles, array[]::text[])
    || array[new.role]
    || case when coalesce(new.is_admin, false) then array['admin'] else array[]::text[] end;

  if tg_op = 'INSERT' then
    old_roles_set := array[]::text[];
  else
    old_roles_set := coalesce(old.roles, array[]::text[])
      || array[old.role]
      || case when coalesce(old.is_admin, false) then array['admin'] else array[]::text[] end;
  end if;

  select coalesce(array_agg(r), array[]::text[])
  into gained
  from unnest(privileged_roles) as r
  where r = any (new_roles_set) and not (r = any (old_roles_set));

  if array_length(gained, 1) > 0 and public.current_user_role() <> 'admin' then
    raise exception 'these roles can only be granted by an existing admin: %', array_to_string(gained, ', ');
  end if;

  -- 2026-09 audit (Round 29 sweep): same root cause as the role-escalation gap above, different
  -- column. `set_malo_freeze`'s own comment claimed it was "the ONLY way" to flip `malo_frozen`
  -- because no *extra* table grant was added for it — but `profiles` already has a blanket
  -- `grant ... update` with no column restriction, so that reasoning never actually held. A frozen
  -- account (a real compliance/legal action per LEGAL_BRIEFING.md §8 item 5) could self-unfreeze
  -- with a raw `update profiles set malo_frozen = false where user_id = auth.uid()`, bypassing the
  -- admin-only RPC entirely and defeating the freeze's whole purpose. Guarding it the same way as
  -- the role columns: only an admin session may change it.
  if (
    (tg_op = 'INSERT' and coalesce(new.malo_frozen, false))
    or (tg_op = 'UPDATE' and new.malo_frozen is distinct from old.malo_frozen)
  ) and public.current_user_role() <> 'admin' then
    raise exception 'malo_frozen can only be changed by an admin';
  end if;

  -- 2026-09 audit (Round 30 sweep): same root cause again, a third time. `createPayout.ts` and
  -- `create-stripe-account`'s own doc comments both say the payout destination is "resolved
  -- server-side from `profiles.stripe_connect_id`, never a client-supplied account id" — but that
  -- claim only held for the app's own client code, which never happened to write these columns
  -- directly. Nothing stopped a raw REST call: `profiles`' blanket update grant covers
  -- `stripe_connect_id` / `payouts_enabled` / `stripe_onboarding_complete` same as everything else,
  -- so any signed-in user could self-set `payouts_enabled = true` and `stripe_connect_id` to an
  -- arbitrary string (their own real Connect id, someone else's if ever discoverable, or garbage)
  -- with zero real Stripe onboarding. Harmless today only because Round 23 already hard-blocks every
  -- real transfer regardless of these flags — but the entire "destination resolved server-side, never
  -- trust the client" security property this system is documented to rely on would be false the
  -- moment that block is lifted, undermining the point of building a balance ledger at all. `auth.role()
  -- = 'service_role'` is exempted so the `create-stripe-account` Edge Function (which legitimately
  -- writes these with the service key, and has no admin session to satisfy `current_user_role()`)
  -- keeps working.
  if (
    (tg_op = 'INSERT' and (
      new.stripe_connect_id is not null
      or coalesce(new.payouts_enabled, false)
      or coalesce(new.stripe_onboarding_complete, false)
    ))
    or (tg_op = 'UPDATE' and (
      new.stripe_connect_id is distinct from old.stripe_connect_id
      or new.payouts_enabled is distinct from old.payouts_enabled
      or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete
    ))
  ) and auth.role() <> 'service_role' and public.current_user_role() <> 'admin' then
    raise exception 'Stripe Connect fields can only be set by the server';
  end if;

  -- 2026-09 audit (Round 31/33 follow-up): `team_code_fail_count`/`team_code_locked_until` are
  -- `redeem_team_code`'s anti-brute-force lockout state (Round 12). Unlike the columns above, the
  -- one legitimate writer runs as the *calling user's own session*, not admin/service_role, so this
  -- can't just check `current_user_role()`. `redeem_team_code` sets a transaction-local flag
  -- (`app.tapuai_team_code_write`) immediately before its own writes to these columns; a raw client
  -- update attempting the same reset has no way to set that flag first, so it's rejected here.
  if (
    (tg_op = 'INSERT' and (
      coalesce(new.team_code_fail_count, 0) <> 0
      or new.team_code_locked_until is not null
    ))
    or (tg_op = 'UPDATE' and (
      new.team_code_fail_count is distinct from old.team_code_fail_count
      or new.team_code_locked_until is distinct from old.team_code_locked_until
    ))
  )
    and public.current_user_role() <> 'admin'
    and coalesce(current_setting('app.tapuai_team_code_write', true), '') <> 'true'
  then
    raise exception 'team_code_fail_count / team_code_locked_until can only be changed by the server';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profiles_admin_escalation on public.profiles;
create trigger guard_profiles_admin_escalation
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_admin_escalation();

-- 2026-09 profile customization: `profiles` keeps its blanket `using (true)` read policy (see the
-- long note above — a column-level narrowing was already tried once and found unsafe to land
-- blind), so `bio` / `social_links` can't be hidden from other users by revoking table access.
-- Mirrors the `reels_feed` pattern instead: a view that nulls the hidden columns for anyone who
-- isn't the owner or an admin, which every OTHER-user-facing read (the public `/user/[id]` screen,
-- Team Roster Strip, etc.) goes through instead of the base table. The owner's own screens keep
-- reading `profiles` directly, so they always see their own bio/links regardless of the flag.
drop view if exists public.profiles_public;
create view public.profiles_public as
select
  pr.id,
  pr.user_id,
  pr.player_id,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  pr.is_verified,
  pr.is_verified_athlete,
  coalesce((pr.profile_visibility->>'school')::boolean, true) as school_visible,
  case
    when coalesce((pr.profile_visibility->>'bio')::boolean, true) then pr.bio
    when pr.user_id = auth.uid() then pr.bio
    when public.current_user_role() = 'admin' then pr.bio
    else null
  end as bio,
  case
    when coalesce((pr.profile_visibility->>'social_links')::boolean, true) then pr.social_links
    when pr.user_id = auth.uid() then pr.social_links
    when public.current_user_role() = 'admin' then pr.social_links
    else '{}'::jsonb
  end as social_links
from public.profiles pr;

grant select on public.profiles_public to anon, authenticated;

drop policy if exists "Public read players" on public.players;
create policy "Public read players" on public.players for select using (true);

-- 2026-09 audit item 1/12: dropped the `auth.role() = 'anon'` bypass. `players` carries the real
-- Aura currency column (`aura_points`) plus roster/measurables — a raw anon REST PATCH could set
-- `aura_points` directly, bypassing `add_user_aura` entirely, which is worse than any of the RPC
-- holes this pass closes. The anon-facing hype-tap fallback in `lib/hype.ts` and backer-count
-- fallback in `lib/payments.ts` are unaffected: their primary path is the `increment_player_hype`
-- / `increment_backer_count` RPCs (`increment_player_hype` stays anon-executable — guest hype taps;
-- `increment_backer_count` is authenticated only, see the grant below — it only runs after a
-- soft-wall-gated Mālo tip) and only fall back to a direct table write if the
-- RPC itself errors. Roster/measurables editing from the admin Catalog desk now requires a real
-- authenticated session with one of these roles — Studio-unlock-only preview (no Supabase auth)
-- will no longer be able to write here; see summary for the "admin desk has no real auth gate yet"
-- product decision this surfaces.
-- 2026-09 parent-payee security fix (docs/engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md §0): `parent` dropped from
-- this blanket policy. It previously let ANY `parent`-role account UPDATE `guardian_id` on ANY
-- roster row with zero verification of an actual parent/guardian relationship — low-stakes while
-- `guardian_id` was inert, but about to gate real Stripe Connect payout money per the parent-payee
-- design doc. The design doc's own §1 flags that the *right* linking mechanism (invite code vs.
-- roster-seed import vs. something else) is still an open sign-off, so this pass does not invent
-- one. Interim, conservative fix: `guardian_id` can now only be set by an admin, via the narrow
-- `admin_set_player_guardian` RPC below (see policy + RPC further down). A parent who is *already*
-- the linked guardian on a row keeps the ability to toggle `parental_consent_approved` for that one
-- row via the separate "Parents update own linked player" policy below — this preserves the Parent
-- screen's existing revoke/re-approve toggle for an already-linked athlete, but the *initial*
-- self-claim (`app/(parent)/parent/index.tsx`'s `toggleConsent` setting `guardian_id = profile.id`
-- on a row it doesn't already own) is now rejected by RLS, which is the hole being closed — that
-- UI is not touched in this pass, so that specific call will surface a permission error until the
-- real linking flow (§1 of the design doc) ships.
drop policy if exists "Staff write players" on public.players;
create policy "Staff write players"
  on public.players for all
  using (public.current_user_role() in ('booster', 'admin', 'operator'))
  with check (public.current_user_role() in ('booster', 'admin', 'operator'));

-- 2026-09 parent-payee security fix (see comment above): a `parent`-role account may only UPDATE a
-- `players` row where `guardian_id` already equals their own `profiles.id` (i.e. they are already
-- the recorded guardian, set by an admin via `admin_set_player_guardian`) — and the `with check`
-- requires the row's `guardian_id` to still equal that same actor afterwards, so this policy can
-- never be used to claim an unowned row, reassign guardianship to someone else, or null it out.
-- This is intentionally narrower than "for all": it exists only so an already-linked parent can
-- keep toggling `parental_consent_approved` (and, later, `guardian_consent_at`) for their own
-- athlete, matching the Parent screen's revoke/re-approve behavior.
drop policy if exists "Parents update own linked player" on public.players;
create policy "Parents update own linked player"
  on public.players for update
  using (
    public.current_user_role() = 'parent'
    and guardian_id is not null
    and guardian_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  )
  with check (
    public.current_user_role() = 'parent'
    and guardian_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  );

-- 2026-09 parent-payee security fix: the only way `guardian_id` can now be set (the previous hole
-- let any `parent`-role account self-assign this on any row via direct UPDATE). Deliberately narrow
-- and admin-only rather than a self-service "request guardian link" flow — the design doc
-- (docs/engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md §1) has three live candidate linking mechanisms (invite
-- code, roster-seed import, scoped self-declare) still pending product/legal sign-off, and building
-- a request/approval RPC now would risk prescribing the wrong one. This is an interim stopgap, not
-- the final parent-onboarding flow.
create or replace function public.admin_set_player_guardian(target_player_id uuid, new_guardian_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin required';
  end if;
  if target_player_id is null then
    raise exception 'target_player_id required';
  end if;
  if new_guardian_id is not null and not exists (select 1 from public.profiles where id = new_guardian_id) then
    raise exception 'Unknown guardian profile';
  end if;

  update public.players
  set
    guardian_id = new_guardian_id,
    parental_consent_approved = false,
    guardian_consent_at = null
  where id = target_player_id;

  if not found then
    raise exception 'Unknown player';
  end if;
end;
$$;

revoke all on function public.admin_set_player_guardian(uuid, uuid) from public;
grant execute on function public.admin_set_player_guardian(uuid, uuid) to authenticated;

-- 2026-09 audit item 2 (add_user_role escalation pass): "Staff write players" below is `for all`
-- for `booster`/`admin`/`operator` with no column scoping, and the table-level `grant update` on
-- `players` had no column allowlist either — together that let a `booster`- or `operator`-role
-- account write `guardian_id` / `parental_consent_approved` / `guardian_consent_at` directly via a
-- raw REST `UPDATE`, completely bypassing the admin-only RPC above. Postgres column GRANTs are
-- role-level (every signed-in user is just `authenticated`), so they can't tell "booster" apart
-- from "the one already-linked parent" or "an admin approving a verification request" — those two
-- legitimate direct-write call sites (`app/(parent)/parent/index.tsx`'s `toggleConsent`, and
-- `lib/adminCatalog.ts`'s `setVerificationStatus`) are moved to these two narrow SECURITY DEFINER
-- RPCs so the column-level grant below can safely exclude all three columns for everyone else.
create or replace function public.parent_set_player_consent(target_player_id uuid, approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
begin
  if public.current_user_role() <> 'parent' then
    raise exception 'Parent required';
  end if;
  if target_player_id is null then
    raise exception 'target_player_id required';
  end if;

  select id into caller_profile_id from public.profiles where user_id = auth.uid() limit 1;
  if caller_profile_id is null then
    raise exception 'Profile not found';
  end if;

  update public.players
  set
    parental_consent_approved = coalesce(approved, false),
    guardian_consent_at = case when coalesce(approved, false) then now() else null end
  where id = target_player_id
    and guardian_id = caller_profile_id;

  if not found then
    raise exception 'Not linked to this athlete';
  end if;
end;
$$;

revoke all on function public.parent_set_player_consent(uuid, boolean) from public;
grant execute on function public.parent_set_player_consent(uuid, boolean) to authenticated;

create or replace function public.admin_approve_player_consent(target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin required';
  end if;
  if target_player_id is null then
    raise exception 'target_player_id required';
  end if;

  update public.players
  set
    parental_consent_approved = true,
    guardian_consent_at = now()
  where id = target_player_id;

  if not found then
    raise exception 'Unknown player';
  end if;
end;
$$;

revoke all on function public.admin_approve_player_consent(uuid) from public;
grant execute on function public.admin_approve_player_consent(uuid) to authenticated;

drop policy if exists "Public read games" on public.games;
create policy "Public read games" on public.games for select using (true);

-- 2026-09 audit item 12: operator claim is PIN-based in the client only (`lib/operator.ts`
-- `OPERATOR_TEST_PIN`), never a Supabase-authenticated session, so restricting this to
-- `authenticated` would break the sideline scoring demo outright. Real fix (authenticated operator
-- accounts) is a bigger product decision flagged in the summary, not made here. As a narrower
-- stopgap: an anon caller may only update a game that is still unclaimed (`claimed_by is null`).
-- Once a real authenticated operator (or admin) claims a game via `claimOperatorGame`, anon
-- callers can no longer overwrite its score/clock/quarter via raw REST.
drop policy if exists "Operators update games" on public.games;
create policy "Operators update games"
  on public.games for update
  using (
    public.current_user_role() in ('operator', 'admin')
    or (auth.role() = 'anon' and claimed_by is null)
  )
  with check (
    public.current_user_role() in ('operator', 'admin')
    or (auth.role() = 'anon' and claimed_by is null)
  );

drop policy if exists "Public read game_events" on public.game_events;
create policy "Public read game_events" on public.game_events for select using (true);

-- Same stopgap as "Operators update games": anon play-by-play inserts are only allowed while the
-- referenced game is unclaimed (or `game_id` is null, matching the retry fallback in
-- `insertOperatorCallout`/`lib/operator.ts` for older rows without the column).
drop policy if exists "Operators insert game_events" on public.game_events;
create policy "Operators insert game_events"
  on public.game_events for insert
  with check (
    public.current_user_role() in ('operator', 'admin')
    or (
      auth.role() = 'anon'
      and (
        game_id is null
        or exists (
          select 1 from public.games g
          where g.id = game_events.game_id and g.claimed_by is null
        )
      )
    )
  );

-- 2026-09 audit: `useGameEventBroadcast.ts` / `lib/operator.ts` push live sideline callouts on a
-- Realtime Broadcast channel `game_events_{gameId}` for every fan viewing that game's Reel. Broadcast
-- sends are NOT table writes, so the "Operators insert game_events" policy above never covered them —
-- with no Realtime Authorization configured, anyone holding the app's public anon key could open a
-- socket and broadcast a fabricated event straight onto any fan's screen, live, with zero auth check.
-- Fix: both channel() calls now pass `{ private: true }`, which makes Realtime consult these
-- `realtime.messages` RLS policies before delivering (receive) or accepting (send) a message on the
-- topic. Mirrors the same claimed/unclaimed stopgap as the `game_events` table policy above.
-- Note: `realtime.messages` already has RLS enabled by the Supabase platform on every project, and
-- the SQL Editor's role does not own that table — running `alter table realtime.messages enable row
-- level security` here fails with `must be owner of table messages` (42501). Only CREATE POLICY is
-- needed (and permitted) on it.
drop policy if exists "Fans receive game_events broadcast" on realtime.messages;
create policy "Fans receive game_events broadcast"
  on realtime.messages for select
  using (realtime.topic() like 'game_events\_%' escape '\');

drop policy if exists "Operators send game_events broadcast" on realtime.messages;
create policy "Operators send game_events broadcast"
  on realtime.messages for insert
  with check (
    realtime.topic() like 'game_events\_%' escape '\'
    and (
      public.current_user_role() in ('operator', 'admin')
      or (
        auth.role() = 'anon'
        and exists (
          select 1 from public.games g
          where g.id::text = split_part(realtime.topic(), 'game_events_', 2)
            and g.claimed_by is null
        )
      )
    )
  );

-- 2026-09 audit item 2: tips are financial records, not a guest-browse surface — no client reads
-- another fan's tips directly (`useFanTipHistory` filters by `fan_id = auth.uid()`; admin reads go
-- through `get_admin_reports()`, a SECURITY DEFINER RPC that bypasses this policy entirely).
drop policy if exists "Public read tips" on public.tips;
create policy "Public read tips"
  on public.tips for select
  using (auth.uid() = fan_id or public.current_user_role() = 'admin');

-- 2026-09 audit item 2: `with check (true)` let any client insert a fabricated tip of any amount
-- for any player. This still does not verify a real Stripe charge happened (see
-- supabase/functions/stripe-webhook/index.ts for that) but at minimum ties the row to the caller's
-- own auth.uid(), closing "anyone can credit tips to any fan_id".
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): a frozen athlete (or their frozen school)
-- rejects new Mālo at the database layer, not just in the client — see `malo_target_frozen`.
drop policy if exists "Insert tips" on public.tips;
create policy "Insert tips"
  on public.tips for insert
  with check (auth.uid() = fan_id and not public.malo_target_frozen(tips.player_id));

drop policy if exists "Public read gigs" on public.operator_gigs;
create policy "Public read gigs" on public.operator_gigs for select using (true);

drop policy if exists "Operators write gigs" on public.operator_gigs;
create policy "Operators write gigs"
  on public.operator_gigs for all
  using (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));

drop policy if exists "Operators write checkins" on public.operator_checkins;
-- Role check added 2026-10-02 (migration 20261002120000): parity with operator_gigs above.
create policy "Operators write checkins"
  on public.operator_checkins for all
  using (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));

drop policy if exists "Public read sponsorships" on public.sponsorships;
create policy "Public read sponsorships" on public.sponsorships for select using (true);

-- 2026-09 audit sweep (same pattern as `tips`/`subscriptions` item 2/3): sponsorships are financial
-- records — the fan/booster checkout flow (`hooks/useSponsorships.ts` `recordSponsorship`) always
-- inserts with `sponsor_user_id: user?.id`, and that checkout is JWT-gated (`stripeIntent.ts`
-- `requireAccessToken` throws before `createPaymentIntent`/PaymentSheet ever runs without a real
-- session), so there is no anonymous booster-checkout path to preserve. The admin Boosters desk
-- (`lib/adminCatalog.ts` `upsertBooster`, `/admin/boosters`) records offline sponsorship deals without
-- a `sponsor_user_id` at all, so admin needs its own alternative rather than an ownership check that
-- row could never satisfy. Like `tips`, this closes fabrication (arbitrary `sponsor_user_id` / amount
-- via the anon key) but does not itself verify a Stripe charge happened — that is the separate
-- Stripe-webhook effort scaffolded in `supabase/functions/stripe-webhook/`.
drop policy if exists "Insert sponsorships" on public.sponsorships;
create policy "Insert sponsorships"
  on public.sponsorships for insert
  with check (auth.uid() = sponsor_user_id or public.current_user_role() = 'admin');

drop policy if exists "Public read ads" on public.sponsor_ads;
create policy "Public read ads" on public.sponsor_ads for select using (true);

-- 2026-09 audit item 12: dropped the `auth.role() = 'anon'` bypass. No client code writes
-- `sponsor_ads` directly today (sideline/rivalry banner tools are stubs per `lib/adminCoverage.ts`),
-- so there is no anon-facing flow this could break.
drop policy if exists "Sponsors write ads" on public.sponsor_ads;
create policy "Sponsors write ads"
  on public.sponsor_ads for all
  using (public.current_user_role() in ('sponsor', 'admin'))
  with check (public.current_user_role() in ('sponsor', 'admin'));

-- 2026-09 audit item 12: verification requests are an internal review queue (Varsity claims),
-- not a guest-browse surface — no fan-facing screen reads other athletes' requests directly.
drop policy if exists "Staff read verification" on public.verification_requests;
create policy "Staff read verification"
  on public.verification_requests for select
  using (
    public.current_user_role() in ('booster', 'admin')
    or exists (
      select 1 from public.profiles p
      where p.id = verification_requests.requester_user_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "Boosters write verification" on public.verification_requests;
create policy "Boosters write verification"
  on public.verification_requests for all
  using (public.current_user_role() in ('booster', 'admin'))
  with check (public.current_user_role() in ('booster', 'admin'));

-- 2026-09 audit item 12: `request_athlete_verification` (the RPC used by the primary path in
-- `lib/verification.ts`) is already `authenticated`-only. The direct-insert fallback in that same
-- file only runs once `supabase.auth.getUser()` resolves a user, and always sets
-- `requester_user_id` from that user's own profile — so tying the check to auth.uid() matches the
-- only real caller and closes the previous unconditional `with check (true)`.
drop policy if exists "Athletes insert verification" on public.verification_requests;
create policy "Athletes insert verification"
  on public.verification_requests for insert
  with check (
    requester_user_id is null
    or exists (
      select 1 from public.profiles p
      where p.id = verification_requests.requester_user_id and p.user_id = auth.uid()
    )
  );

-- 2026-09 audit item 11: this policy was literally named "Admin read" but its actual `using`
-- clause was `true` (public) — payout records readable by anyone. Now genuinely admin/parent-only.
drop policy if exists "Admin read disbursements" on public.disbursements;
create policy "Admin read disbursements"
  on public.disbursements for select
  using (public.current_user_role() in ('admin', 'parent'));

-- 2026-09 audit item 11: dropped the `auth.role() = 'anon'` bypass — disbursements are payout
-- ledger rows, not part of any guest or anon operator-demo flow.
drop policy if exists "Admin write disbursements" on public.disbursements;
create policy "Admin write disbursements"
  on public.disbursements for all
  using (public.current_user_role() in ('admin', 'parent'))
  with check (public.current_user_role() in ('admin', 'parent'));

-- 2026-09 audit (paywall bypass): `using (true)` + `grant select ... to anon, authenticated` meant
-- ANY client holding the public anon key could read `video_url` for every reel via a raw REST call —
-- including Vault-only / subscriber-Exclusive / Flash-Unlock clips — with no subscription, no Vault
-- unlock, not even a login. The app's own `.eq('is_vault_only', false)` feed filters were never an
-- access boundary, just a query convenience. RLS can't conditionally null one column within a row
-- that must otherwise stay visible (for the blurred paywall tile), so the real fix is the
-- `public.reels_feed` view below, which every fan-facing read now goes through (`lib/reels.ts`,
-- `lib/spotlight.ts`) — it nulls `video_url` unless the row is unlocked, Flash-Unlocked right now, or
-- the caller is the uploader / an admin / an active subscriber to the tagged athlete. This base-table
-- policy is narrowed to just what the base table itself still needs: an uploader reading back their
-- own freshly-inserted/updated row (`MediaUploadService.insertReelRow`'s `.select()` after insert),
-- and the admin moderation desks (`lib/admin.ts`, `lib/adminCatalog.ts`) which need every row's
-- metadata (not video_url) regardless of lock state. The view is owned by the migration role (not
-- `authenticated`/`anon`), so it reads the full base table regardless of this narrower policy —
-- Postgres evaluates a view's underlying table access using the view owner's privileges unless the
-- view is explicitly marked `security_invoker`, which this one deliberately is not.
drop policy if exists "Public read reels" on public.reels;
drop policy if exists "Read own or admin reels" on public.reels;
create policy "Read own or admin reels" on public.reels
  for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    or uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  );

drop view if exists public.reels_feed;
create view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url
from public.reels r;

grant select on public.reels_feed to anon, authenticated;

-- 2026-09 audit (reels RLS tightening): `with check (true)` let any anon/authenticated client
-- insert a Highlight attributed to any `player_id` with any `uploaded_by`. `MediaUploadService.
-- insertReelRow` never sets `uploaded_by` itself; the `reels_apply_tag_defaults` BEFORE INSERT
-- trigger (see that trigger above) fills it from the caller's own `profiles.id` before this WITH
-- CHECK runs — Postgres applies a row's BEFORE-trigger mutations, then evaluates RLS, for INSERT —
-- so this check passes for every real upload and rejects any row a client tries to attribute to
-- someone else's profile. Soft-Wall gates the upload FAB, so `anon` was never a real caller either;
-- narrowed to `authenticated` to match.
drop policy if exists "Public insert reels" on public.reels;
drop policy if exists "Authenticated insert own reels" on public.reels;
create policy "Authenticated insert own reels"
  on public.reels for insert
  to authenticated
  with check (
    uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  );

-- 2026-09 audit (reels RLS tightening): `using (true) with check (true)` let any anon/authenticated
-- client vandalize ANY reel row via a raw REST PATCH — caption, video_url, hype counts, tip totals,
-- vault/exclusive flags, moderation flags, all of it. Two row policies replace it below (uploader
-- edits their own clip; admin edits any clip); the GRANT further down additionally narrows which
-- *columns* `authenticated` may touch at all to `title` / `category` / `is_exclusive` /
-- `is_vault_only` / `flash_unlock_until` (RLS alone can't restrict columns within a matched
-- policy, so without that grant an owner-scoped policy could still be used to rewrite counters or
-- moderation flags on their own row). Counters (`seki_count`/`aura_count`/`flex_count`/
-- `total_tips_cents`), `is_flagged`/`is_removed`/`reported_by`, and the tag fields only move through
-- the SECURITY DEFINER RPCs (`increment_reel_hype`, `increment_reel_tips`, `moderate_flagged_reel`,
-- `confirm_reel_player_tag`, `report_reel`), which bypass column grants entirely because they run as
-- the function owner, not the caller's session role.
drop policy if exists "Public update reels" on public.reels;
drop policy if exists "Uploader updates own reel" on public.reels;
create policy "Uploader updates own reel"
  on public.reels for update
  to authenticated
  using (uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1))
  with check (uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1));

drop policy if exists "Admin moderates any reel" on public.reels;
create policy "Admin moderates any reel"
  on public.reels for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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

-- 2026-09 audit item 3: subscriptions gate paid athlete content — `useHasSubscriberPass` only
-- ever reads the caller's own `subscriber_id`, so there is no guest-browse read to preserve.
drop policy if exists "Public read subscriptions" on public.subscriptions;
create policy "Public read subscriptions"
  on public.subscriptions for select
  using (auth.uid() = subscriber_id or public.current_user_role() = 'admin');

-- 2026-09 audit item 3: `with check (true)` let any client grant itself a free permanent unlock of
-- any athlete's paid content for any subscriber_id. `useAthleteSubscription.ts` always inserts with
-- `subscriber_id: user.id`, so tying the check to auth.uid() matches the only real caller.
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): a frozen athlete (or their frozen school)
-- rejects new exclusive subscriptions at the database layer — see `malo_target_frozen`.
drop policy if exists "Public insert subscriptions" on public.subscriptions;
create policy "Public insert subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = subscriber_id and not public.malo_target_frozen(subscriptions.athlete_id));

drop policy if exists "Public update subscriptions" on public.subscriptions;
create policy "Public update subscriptions"
  on public.subscriptions for update
  using (auth.uid() = subscriber_id or public.current_user_role() = 'admin')
  with check (
    (auth.uid() = subscriber_id or public.current_user_role() = 'admin')
    and not public.malo_target_frozen(subscriptions.athlete_id)
  );

-- 2026-09 audit item (subscriber_requests): `body` is the actual private message text a fan sends
-- an athlete (Vault "Direct Request"). SELECT is scoped to the sender (their own Q&A history), the
-- receiving athlete (via `profiles.player_id = subscriber_requests.athlete_id`, mirroring the
-- `profiles.player_id` athlete-identity join used elsewhere in this file), or admin — not `using
-- (true)`. INSERT requires the caller to insert as themself.
-- 2026-09 audit (Round 27/33 sweep): same reasoning as `set_player_vault_locked` above —
-- `player_id` is a self-service, unverified claim, so the receiving-athlete branch here previously
-- let anyone read another athlete's private messages just by copying their id into their own
-- `player_id`. Requiring `is_verified` narrows this to "an account that actually redeemed a real
-- team code," not any signed-in stranger.
drop policy if exists "Public read subscriber requests" on public.subscriber_requests;
drop policy if exists "Read own or received subscriber requests" on public.subscriber_requests;
create policy "Read own or received subscriber requests"
  on public.subscriber_requests for select
  using (
    auth.uid() = subscriber_id
    or exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid()
        and pr.player_id = subscriber_requests.athlete_id
        and coalesce(pr.is_verified, false)
    )
    or public.current_user_role() = 'admin'
  );

drop policy if exists "Public insert subscriber requests" on public.subscriber_requests;
drop policy if exists "Insert own subscriber requests" on public.subscriber_requests;
create policy "Insert own subscriber requests"
  on public.subscriber_requests for insert
  with check (auth.uid() = subscriber_id);

drop policy if exists "Public read cheer polls" on public.cheer_polls;
create policy "Public read cheer polls" on public.cheer_polls for select using (true);

drop policy if exists "Insert telemetry logs" on public.telemetry_logs;
create policy "Insert telemetry logs" on public.telemetry_logs for insert with check (true);

drop policy if exists "Authenticated read telemetry logs" on public.telemetry_logs;
create policy "Authenticated read telemetry logs" on public.telemetry_logs for select using (auth.role() = 'authenticated');

-- 2026-09 audit: `profiles` SELECT stays public (see the policy comment above for why); the
-- concretely sensitive column is closed via the REVOKE further below. INSERT/UPDATE stay open to
-- anon at the *grant* level (Postgres GRANTs are additive with RLS, not a replacement for it) because
-- the RLS policies ("Users insert own profile" / "Users update own profile") tie the actual writes to
-- `auth.uid()`, matching the existing pattern elsewhere in this file — as of the third-pass fix above,
-- "Users insert own profile" no longer has an `auth.role() = 'anon'` escape hatch, so an anon-key
-- caller with no session (`auth.uid()` null) cannot satisfy either policy's `with check` regardless
-- of holding the table-level grant.
grant select, insert, update, delete on public.profiles to anon, authenticated;
-- 2026-09 audit item 6, considered and NOT applied: a column-level
-- `revoke select (stripe_connect_id) on public.profiles from anon, authenticated` was drafted to
-- close the named PII exposure without touching the table-wide read guest browse depends on.
-- Reverted: Postgres column privileges only add a *narrower* grant on top of a table-wide one —
-- they do not subtract from it, so this would have been a no-op unless the table-wide `select`
-- grant above were also revoked and re-granted on an explicit column allowlist. That in turn would
-- make any `select('*')` query on `profiles` fail outright (Postgres/PostgREST reject the whole
-- wildcard query if the caller lacks privilege on any one column), and `select('*')` on `profiles`
-- is exactly how `AuthContext.tsx` loads every signed-in user's own profile on every app boot
-- (`.from('profiles').select('*').eq('user_id', userId)`). That is untestable from here against a
-- live Supabase instance, and the failure mode (every authenticated user unable to load their own
-- profile) is worse than the exposure it would close. Left open, flagged for a real fix: either
-- (a) a `profiles_public` view carrying only the non-sensitive columns, with call sites migrated
-- to it, or (b) enumerating every non-sensitive column for an explicit `grant select (...)` after
-- auditing every current `select('*')`/`select(...)` call site — either is a bigger, testable-only-
-- against-staging change, not something to land blind in this pass.
-- 2026-09 audit (Round 13 sweep, critical): `team_code` is the Varsity-verification secret
-- (`redeem_team_code`) — a blanket `grant select` on the whole table meant anyone could read every
-- school's code directly (`select team_code from schools_and_teams`, or even just filter on it in a
-- WHERE clause to oracle a guess), completely defeating the Round 12 rotation and rate limit: the
-- rate limit lives inside the RPC, but a raw REST read never touches the RPC at all. Column-level
-- grant instead — every current client call site (`lib/teams.ts`, `lib/adminCatalog.ts`) already
-- enumerates explicit columns and never selects `team_code` or `*`, confirmed by grep before this
-- change; `redeem_team_code`/`search_schools_and_teams` are unaffected since SECURITY DEFINER
-- functions run as the function owner, not the caller, so they bypass column grants entirely.
-- The explicit REVOKE matters: GRANT is additive, not a replacement — a project that already ran
-- the old blanket `grant select on schools_and_teams to anon, authenticated` (every project that ran
-- schema.sql before this round) keeps that broader privilege forever unless it is revoked first;
-- adding a narrower column grant on top of it would have been a silent no-op.
revoke select on public.schools_and_teams from anon, authenticated;
grant select (id, name, mascot, level, division, region, city, created_at, malo_frozen)
  on public.schools_and_teams to anon, authenticated;
grant select on public.athlete_career_stats to anon, authenticated;
grant select on public.athlete_game_logs to anon, authenticated;
-- 2026-09 audit item 12: spotlight board stays publicly readable (guest browse); publishing is
-- now authenticated-admin only (see the RLS policy above).
grant select on public.spotlight_awards to anon, authenticated;
grant insert, update, delete on public.spotlight_awards to authenticated;
-- 2026-09 audit (Round 11 sweep): both narrowed to `authenticated` — Soft-Wall gates Join Crew
-- behind sign-in, so there was never a real anon caller; `crew_push_queue` also drops `insert`
-- entirely (see RLS policy comment above — only the SECURITY DEFINER RPC writes it).
grant select, insert, delete on public.crew_follows to authenticated;
grant select on public.crew_push_queue to authenticated;
-- 2026-09 audit item 1/12: `players` carries `aura_points` directly — see the RLS policy comment
-- above. Read stays public (roster/cards are guest-browse); writes are now authenticated-role only.
grant select on public.players to anon, authenticated;
grant insert, delete on public.players to authenticated;
-- 2026-09 audit item 2 (add_user_role escalation pass): UPDATE narrowed to an explicit column
-- allowlist that excludes `guardian_id` / `parental_consent_approved` / `guardian_consent_at` —
-- those three are now writable only through the SECURITY DEFINER RPCs above
-- (`admin_set_player_guardian`, `parent_set_player_consent`, `admin_approve_player_consent`), which
-- bypass this grant entirely. This is the fix for the "Staff write players" policy still being
-- `for all` for `booster`/`operator` with zero column scoping — see the long comment above.
grant update (
  name, jersey_number, position, height, school_name, backer_count, team,
  view_count, aura_count, flex_count, seki_count, aura_points, weight,
  forty_yard, vertical_jump, vault_locked
) on public.players to authenticated;
-- 2026-09 audit item 12: `games`/`game_events` reads stay public (live scoreboard is guest-browse).
-- Writes stay grantable to anon at the table level because the RLS policies above now narrow anon
-- writes to unclaimed games only; INSERT (creating a new game) is admin-desk-only, not part of the
-- anon operator-PIN flow, so that moves to authenticated.
grant select, update on public.games to anon, authenticated;
grant insert on public.games to authenticated;
grant select, insert on public.game_events to anon, authenticated;
-- 2026-09 audit item 2: tips are financial records now scoped by the RLS policies above
-- (auth.uid() = fan_id, or admin) — no legitimate anon caller remains, so anon is revoked here too.
grant select, insert on public.tips to authenticated;
grant select, insert, update, delete on public.operator_gigs to anon, authenticated;
grant select, insert on public.operator_checkins to anon, authenticated;
-- 2026-09 audit item 12: sponsor_ads reads stay public (sideline banners are guest-browse); writes
-- are now authenticated-role only (see the RLS policy above).
grant select on public.sponsor_ads to anon, authenticated;
grant insert, update, delete on public.sponsor_ads to authenticated;
-- 2026-09 audit sweep: read stays public (Top Boosters rail is guest-browse), but insert is
-- authenticated-only now — see the RLS policy comment above.
grant select on public.sponsorships to anon, authenticated;
grant insert on public.sponsorships to authenticated;
-- 2026-09 audit item 12: verification_requests is an internal review queue, not guest-browse —
-- anon is revoked entirely; RLS above scopes authenticated access to the requester or booster/admin.
grant select, insert, update, delete on public.verification_requests to authenticated;
-- 2026-09 audit item 11: disbursements are payout ledger rows — anon revoked entirely.
grant select, insert, update on public.disbursements to authenticated;
-- 2026-09 audit (paywall bypass): base-table SELECT is no longer public — see the "Read own or
-- admin reels" policy comment above. Guest/fan browsing now reads `public.reels_feed` (granted
-- further up, right after that view's definition) instead. INSERT/UPDATE drop `anon` (Soft-Wall
-- gates the upload FAB; no real anon caller). UPDATE is further narrowed to an explicit column
-- allowlist — see the RLS policy comments above for why counters/moderation flags are deliberately
-- excluded and stay RPC-only.
grant select on public.reels to authenticated;
grant insert on public.reels to authenticated;
grant update (title, category, is_exclusive, is_vault_only, flash_unlock_until) on public.reels to authenticated;
grant select, insert, delete on public.saved_reels to authenticated;
grant select, insert on public.reel_hype_votes to authenticated;
-- 2026-09 audit item 3: subscriptions gate paid content — anon revoked; RLS above scopes
-- authenticated access to the subscriber themself (or admin).
grant select, insert, update on public.subscriptions to authenticated;
-- 2026-09 audit item (subscriber_requests): `body` is private message content — anon revoked;
-- RLS above scopes SELECT to the sender, the receiving athlete, or admin, and INSERT to the sender.
grant select, insert on public.subscriber_requests to authenticated;
grant select on public.cheer_polls to anon, authenticated;
grant insert on public.telemetry_logs to anon, authenticated;
grant select on public.telemetry_logs to authenticated;
-- 2026-09 audit item 1: `increment_backer_count` only ever runs after a soft-wall-gated
-- authenticated Mālo tip (`useTipCheckout.ts` / `lib/payments.ts`) — anon revoked.
grant execute on function public.increment_backer_count(uuid) to authenticated;
-- 2026-09 audit item 1/4: see the SECURITY TRADEOFF comment on the function body above (per-call
-- cap stopgap) — anon revoked, authenticated + internal cap only.
grant execute on function public.add_user_aura(uuid, integer) to authenticated;
grant execute on function public.get_aura_tier(integer) to anon, authenticated;
-- 2026-09 audit item 1: intentionally LEFT anon-executable. Unlike the others in this list,
-- `increment_player_hype` writes vanity view/aura/flex/seki tap counters on `players`, never the
-- `aura_points` currency column, has no per-user dedup either way, and is a documented
-- guest-facing engagement surface (Highlights ⚡ reactions are not behind the Soft Wall). Tightening
-- it to authenticated would regress a currently-working guest feature for a purely cosmetic counter
-- with no money/Aura implication. Flagged here rather than silently left as-is.
grant execute on function public.increment_player_hype(uuid, text) to anon, authenticated;
-- 2026-09 audit item 1: `increment_reel_hype` is different from `increment_player_hype` above — it
-- writes to `reel_hype_votes` with a per-(user_id, reel_id, kind) UNIQUE constraint specifically to
-- dedupe one hype tap per signed-in fan. For an anon caller `auth.uid()` is null, so that dedupe
-- insert was always skipped and the counter incremented unconditionally on every call — i.e. anon
-- execute defeated this table's own anti-spam design. Restricting to authenticated makes the dedupe
-- actually work as designed, not just closes a theoretical hole.
grant execute on function public.increment_reel_hype(uuid, text) to authenticated;
revoke execute on function public.clear_reel_hype(uuid, text) from public, anon;
grant execute on function public.clear_reel_hype(uuid, text) to authenticated;
-- 2026-09 audit item 1: same reasoning as increment_backer_count — only reached post-Mālo-tip.
grant execute on function public.increment_reel_tips(uuid, integer) to authenticated;
grant execute on function public.cast_cheer_vote(text, text, text, text, text) to anon, authenticated;
grant execute on function public.update_game_score(uuid, integer, integer, boolean, text) to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.add_user_role(text) to anon, authenticated;
grant execute on function public.normalize_team_code(text) to anon, authenticated;
grant execute on function public.team_code_school_key(text) to anon, authenticated;
grant execute on function public.sport_from_team_code_token(text) to anon, authenticated;
grant execute on function public.athlete_is_varsity_verified(uuid) to anon, authenticated;
grant execute on function public.redeem_team_code(text) to authenticated;
grant execute on function public.request_athlete_verification(text) to authenticated;
grant execute on function public.get_fan_tip_history(uuid) to authenticated;
revoke execute on function public.get_admin_malo_breakdown() from public, anon;
grant execute on function public.get_admin_malo_breakdown() to authenticated;
revoke execute on function public.get_received_malo(uuid) from public, anon;
grant execute on function public.get_received_malo(uuid) to authenticated;
revoke execute on function public.tip_origin_label(text, text, text) from public, anon;
grant execute on function public.search_local_entities(text, text) to anon, authenticated;
grant execute on function public.search_schools_and_teams(text) to anon, authenticated;
grant execute on function public.report_reel(uuid) to authenticated;
-- 2026-09 audit follow-up: same reasoning as `moderate_flagged_reel` below — the body
-- already requires `current_user_role() = 'admin'`, so `anon` execute was a no-op.
-- REVOKE so a re-run of this file drops a grant left by an earlier apply.
revoke execute on function public.publish_spotlight_award(uuid, text, text, date, date) from anon;
grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to authenticated;
grant execute on function public.spotlight_normalize_kind(text) to anon, authenticated;
grant execute on function public.spotlight_window(text, date) to anon, authenticated;
-- 2026-09 audit follow-up: anon dropped from all three — confirming/rejecting a player
-- tag (and the pending-tag queue that feeds it) requires a real session now that the
-- `auth.role() = 'anon'` bypass is gone from the function bodies above.
grant execute on function public.can_confirm_player_tag(uuid) to authenticated;
grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated;
grant execute on function public.get_pending_player_tags() to authenticated;
grant execute on function public.get_spotlight_standings(text) to anon, authenticated;
grant execute on function public.sync_spotlight_period(text) to anon, authenticated;
grant execute on function public.sync_live_spotlight_awards() to anon, authenticated;
grant execute on function public.unlock_spotlight_period(text) to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): the function body already restricts this to
-- `current_user_role() = 'admin'` (see the comment on the function above) — `anon` execute here was
-- always a no-op for a real admin action, dropped for consistency with the other admin-only RPCs.
grant execute on function public.moderate_flagged_reel(uuid, text) to authenticated;
grant execute on function public.get_admin_platform_metrics() to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): the function body now requires the uploader or an admin
-- (see the comment on the function above) — `anon` execute was already a no-op (`actor is null`
-- always raised), dropped for consistency.
grant execute on function public.toggle_reel_vault_status(uuid) to authenticated;
-- 2026-09 audit follow-up: anon dropped — the role check inside the function body now requires
-- a real authenticated session anyway (current_user_role() resolves to 'guest' for anon).
grant execute on function public.set_player_vault_locked(uuid, boolean) to authenticated;
grant execute on function public.get_active_spotlight_award(uuid) to anon, authenticated;
grant execute on function public.get_crew_graph(uuid) to anon, authenticated;
grant execute on function public.toggle_crew_follow(uuid, boolean) to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): same reasoning as `toggle_reel_vault_status` above —
-- ownership check added to the function body, `anon` execute dropped as a no-op.
grant execute on function public.set_reel_flash_unlock(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.game_events;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.cheer_polls;
exception
  when duplicate_object then null;
  when duplicate_table then null;
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

-- School Poll labels are an admin desk action (`/admin/polls`). The anon bypass let a
-- logged-out client write the same rows the RPC was supposed to gate.
drop policy if exists "Admin write cheer polls" on public.cheer_polls;
create policy "Admin write cheer polls"
  on public.cheer_polls for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- 2026-09 audit item 12: dropped the `auth.role() = 'anon'` bypass. Creating a new game row is an
-- admin-desk action (`adminCatalog.ts`), not part of the anon operator-PIN scoring flow — the grant
-- for INSERT on `games` is authenticated-only now too (see grants below), so this matches.
drop policy if exists "Admin insert games" on public.games;
create policy "Admin insert games"
  on public.games for insert
  with check (public.current_user_role() in ('admin', 'operator'));

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
  -- Admin only. The previous check (`role <> 'admin' AND auth.role() <> 'anon'`) rejected
  -- signed-in non-admins and let anon through.
  if public.current_user_role() <> 'admin' then
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
revoke insert, update, delete on public.cheer_polls from anon;
grant insert, update, delete on public.cheer_polls to authenticated;
grant insert, update on public.games to anon, authenticated;
grant update, delete on public.sponsorships to anon, authenticated;
revoke execute on function public.upsert_cheer_poll(text, text, text, boolean) from anon;
grant execute on function public.upsert_cheer_poll(text, text, text, boolean) to authenticated;

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
  '{"tabs":{"home":true,"local":true,"spotlight":true,"drip":false,"profile":true,"upload":true},"buttons":{"seki":true,"aura":true,"flex":true,"malo":true,"more":true,"subscribe":true,"crew":true,"vault":true,"flashUnlock":true},"layouts":{"liveMatches":true,"cheerPolls":true,"topBoosters":true,"sponsorshipModal":true,"spotlightModal":true,"operatorConsole":false,"parentHq":true,"boosterHq":true,"sponsorHq":true}}'::jsonb,
  '{"tabs":{"home":true,"local":true,"spotlight":true,"drip":false,"profile":true,"upload":true},"buttons":{"seki":true,"aura":true,"flex":true,"malo":true,"more":true,"subscribe":true,"crew":true,"vault":true,"flashUnlock":true},"layouts":{"liveMatches":true,"cheerPolls":true,"topBoosters":true,"sponsorshipModal":true,"spotlightModal":true,"operatorConsole":false,"parentHq":true,"boosterHq":true,"sponsorHq":true}}'::jsonb,
  timezone('utc', now())
)
on conflict (id) do nothing;

alter table public.app_runtime_config enable row level security;

drop policy if exists "Public read app runtime" on public.app_runtime_config;
create policy "Public read app runtime"
  on public.app_runtime_config for select
  using (true);

-- 2026-09 audit item 10: dropped the `auth.role() = 'anon'` bypass. Note this RLS policy alone
-- was never the real gate for `patch_app_runtime_draft` / `publish_app_runtime` below — both are
-- SECURITY DEFINER, which bypasses table RLS regardless of what this policy says. The actual fix
-- for those two is the internal `current_user_role() <> 'admin'` check added to each (item 9). This
-- policy still matters for the direct-table-UPDATE fallback in `lib/runtime.ts` (`saveAppRuntimeDraft`
-- / `publishAppRuntime`), which now requires a real authenticated admin session too.
drop policy if exists "Admin write app runtime" on public.app_runtime_config;
create policy "Admin write app runtime"
  on public.app_runtime_config for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

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
  -- 2026-09 audit item 9: this is SECURITY DEFINER, so the table's RLS policy above never actually
  -- gated it — anyone with `execute` (previously anon+authenticated) could publish a live config
  -- change regardless of the RLS policy's wording. The real gate has to live here.
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
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
  -- 2026-09 audit item 9: same reasoning as patch_app_runtime_draft above — SECURITY DEFINER
  -- bypasses table RLS, so the admin check has to happen inside the function body.
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
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

-- 2026-09 audit item 7: small reusable guard for `language sql` functions, which cannot use
-- `if ... raise exception` directly. Raises when the caller is not an admin, else no-ops.
create or replace function public.require_admin_guard()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
end;
$$;

-- 2026-09 audit (Round 33/34 sweep, found by seeding a genuinely fresh staging project — the exact
-- clean-install test Phase 2 exists for): `get_admin_reports()` below references `app_feedback` in
-- its query, but that table's real `create table if not exists` isn't defined until much later in
-- this file (the "Fan suggestions" section). `get_admin_reports` is `language sql`, and Postgres
-- validates a SQL-language function's referenced relations exist at CREATE FUNCTION time (unlike
-- `plpgsql`, which only checks syntax until first execution) — so this has always failed on a truly
-- fresh project with no pre-existing `app_feedback` table. Never surfaced against the live project
-- because that table already existed there from an earlier partial run before this ordering issue
-- existed. Minimal stub here, matching the same "safety net so a later create table if not exists
-- doesn't crash" idiom already used throughout this file (see the sponsorships/disbursements/
-- shop_orders comments) — the real `app_feedback` section further down still owns the full column
-- set, RLS, and grants; this just makes the table exist early enough for this function to compile.
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'suggestion',
  status text not null default 'new',
  surface text not null default 'other'
);

drop function if exists public.get_admin_reports();

-- 2026-09 audit item 7: was anon-executable with no role check at all — anyone could read
-- platform-wide money/audience/content aggregates. `select public.require_admin_guard();` as the
-- first statement raises before the report query runs if the caller is not an admin; the report
-- query itself is the function's returned (final-statement) result, unchanged otherwise.
-- 2026-10-12 (supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql, written,
-- not applied anywhere): ms and cents sums are bigint (a 7-day tab-dwell sum overflowed int at about
-- 596 hours and failed the RPC), and a new top-level donation_bands key counts athletes by all-time
-- donation total with no names (owner decision 3C). leaders.malo stays for existing readers.
create or replace function public.get_admin_reports()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.require_admin_guard();
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
      'malo_cents_all', (select coalesce(sum(amount_cents), 0)::bigint from public.tips),
      'malo_count_all', (select count(*)::int from public.tips),
      'malo_cents_24h', (select coalesce(sum(amount_cents), 0)::bigint from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_count_24h', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '24 hours'),
      'malo_cents_7d', (select coalesce(sum(amount_cents), 0)::bigint from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_count_7d', (select count(*)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'malo_cents_prev_7d', (select coalesce(sum(amount_cents), 0)::bigint from public.tips where created_at >= timezone('utc', now()) - interval '14 days' and created_at < timezone('utc', now()) - interval '7 days'),
      'avg_tip_cents_7d', (select coalesce(avg(amount_cents), 0)::int from public.tips where created_at >= timezone('utc', now()) - interval '7 days'),
      'queued_payouts', (select count(*)::int from public.disbursements where status = 'queued'),
      'paid_payouts_cents', (select coalesce(sum(amount_cents), 0)::bigint from public.disbursements where status = 'paid'),
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
      'verified', (select count(*)::int from public.profiles where coalesce(is_verified, false) = true or coalesce(verification_status, '') = 'verified'),
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
          select coalesce(nullif(p.name, ''), 'Unknown') as label, sum(t.amount_cents)::bigint as value
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
    -- Owner decision 3C (2026-10-12): athletes counted by all-time donation total, counts only, never
    -- names or ids. Same source as leaders.malo (every public.tips row, grouped per player, no other
    -- filter); tips.player_id is NOT NULL with an FK, so the inner join drops no rows. A player whose
    -- total is 0 is in no band. Bounds in cents: (0, 5000) / [5000, 25000) / [25000, inf).
    'donation_bands', coalesce(
      (
        select jsonb_build_object(
          'under_50', (count(*) filter (where totals.total_cents > 0 and totals.total_cents < 5000))::int,
          '50_to_250', (count(*) filter (where totals.total_cents >= 5000 and totals.total_cents < 25000))::int,
          '250_plus', (count(*) filter (where totals.total_cents >= 25000))::int
        )
        from (
          select p.id, sum(t.amount_cents)::bigint as total_cents
          from public.tips t
          join public.players p on p.id = t.player_id
          group by p.id
        ) totals
      ),
      '{"under_50": 0, "50_to_250": 0, "250_plus": 0}'::jsonb
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
          select d::date as d, coalesce(c.n, 0)::bigint as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(amount_cents), 0)::bigint as n from public.tips group by 1
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
          select d::date as d, coalesce(c.n, 0)::bigint as n
          from generate_series((timezone('utc', now()))::date - 6, (timezone('utc', now()))::date, interval '1 day') as d
          left join (
            select created_at::date as day, coalesce(sum(duration_ms), 0)::bigint as n
            from public.telemetry_logs
            where event_type = 'tab_dwell'
            group by 1
          ) c on c.day = d::date
        ) bucket
      )
    ),
    'usage', jsonb_build_object(
      'sessions_24h', (select count(*)::int from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_24h', (select coalesce(sum(duration_ms), 0)::bigint from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '24 hours'),
      'dwell_ms_7d', (select coalesce(sum(duration_ms), 0)::bigint from public.telemetry_logs where event_type = 'tab_dwell' and created_at >= timezone('utc', now()) - interval '7 days'),
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
          coalesce(sum(duration_ms), 0)::bigint as value
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

-- 2026-09 audit items 7/9/10: app_runtime_config SELECT stays public — it drives the fan app's
-- feature-flag/chrome bootstrap, read by guests before any sign-in. Writes are now
-- authenticated-only (admin enforced by the RLS policy above and, for the two RPCs, redundantly
-- inside the function bodies since SECURITY DEFINER bypasses RLS).
grant select on public.app_runtime_config to anon, authenticated;
grant insert, update on public.app_runtime_config to authenticated;
grant execute on function public.patch_app_runtime_draft(jsonb) to authenticated;
grant execute on function public.publish_app_runtime() to authenticated;
revoke execute on function public.get_admin_reports() from public, anon;
grant execute on function public.get_admin_reports() to authenticated;
grant execute on function public.require_admin_guard() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.app_runtime_config;
exception
  when duplicate_object then null;
  when duplicate_table then null;
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

-- 2026-09 fix: same gap as sponsorships above — this table had no column safety net, so
-- `create table if not exists` no-ops against a pre-existing narrower table and the constraints
-- below then fail with `column "amount_cents" does not exist` (or `"qty"`).
alter table public.shop_orders add column if not exists product_id text;
alter table public.shop_orders add column if not exists buyer_id uuid;
alter table public.shop_orders add column if not exists amount_cents integer not null default 0;
alter table public.shop_orders add column if not exists qty integer not null default 1;
alter table public.shop_orders add column if not exists created_at timestamptz not null default now();

do $$
begin
  alter table public.shop_orders add constraint shop_orders_amount_cents_check check (amount_cents >= 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.shop_orders add constraint shop_orders_qty_check check (qty > 0);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

-- 2026-09 audit (Round 24/26 follow-up): same gap this table's own comment above already names —
-- `amount_cents` is client-computed (`priceCents * qty` in `ProductSheet.tsx`) and inserted directly,
-- with no server-side check against a real Stripe charge yet. Same stopgap cap as `tips` /
-- `sponsorships` / `chip_in_wishlist_item`. Catalog prices top out at $65/item with inventory capped
-- at 6-40 units (see the `shop_products` seed above), so even buying out the priciest item's entire
-- stock stays under $400 — $1,000 has generous headroom over any real order.
do $$
begin
  alter table public.shop_orders add constraint shop_orders_amount_cents_cap_check
    check (auth.role() = 'service_role' or amount_cents <= 100000);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

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
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_payee_kind_check
    check (payee_kind in ('athlete', 'operator', 'none'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.company_revenue_logs
    add constraint company_revenue_logs_source_id_key unique (source, source_id);
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

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

-- 2026-09 audit item 8: anon revoked entirely — see the RLS policy comments above (all legitimate
-- writes flow through the SECURITY DEFINER trigger, which doesn't need a table grant to do it).
grant select, insert, update, delete on public.company_revenue_logs to authenticated;
-- 2026-09 audit sweep: read/update/delete are admin-only via RLS above; insert is now
-- authenticated-only too (anon revoked) — see the RLS policy comment above for why the earlier
-- "guest checkout" grant here was based on a stale reading of the Drip purchase flow.
grant select, insert, update, delete on public.shop_orders to authenticated;
grant execute on function public.company_revenue_bps(text) to authenticated;
-- 2026-09 audit (found alongside item 8, not separately numbered in the backlog): this RPC does a
-- raw `insert ... on conflict (source, source_id) do update` into the revenue ledger with
-- caller-supplied amounts and no role check, and is meant to be called ONLY by the
-- `company_revenue_after_source_insert` trigger (internal calls from another SECURITY DEFINER
-- function run as the owner and do not need this grant). No client code calls it. Revoking both
-- anon and authenticated closes a direct-RPC path to fabricate or overwrite revenue rows by
-- reusing a real (source, source_id) pair — the same class of hole as item 8, just one level
-- removed from the table itself.
revoke execute on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) from anon, authenticated;
revoke execute on function public.sync_company_revenue_logs() from anon, authenticated;
grant execute on function public.get_company_revenue_summary() to authenticated;

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
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_surface_check
    check (surface in ('home', 'local', 'spotlight', 'drip', 'profile', 'other'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

do $$
begin
  alter table public.app_feedback
    add constraint app_feedback_status_check
    check (status in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined'));
exception
  when duplicate_object then null;
  when duplicate_table then null;
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
  when duplicate_table then null;
end $$;

create index if not exists wishlist_items_player_idx
  on public.wishlist_items (player_id, is_equipped, sort_order);

do $$
begin
  alter table public.tips
    add constraint tips_wishlist_item_id_fkey
    foreign key (wishlist_item_id) references public.wishlist_items (id) on delete set null;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;

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
  target_player uuid;
begin
  -- The per-gift ledger is the `tips` row `useTipCheckout` inserts before this call
  -- (`origin = wishlist`, `wishlist_item_id`, `source_label` = the item title). This RPC only
  -- moves the item aggregate, so it must not insert a second `tips` row.
  -- SECURITY TRADEOFF (2026-09 audit item 5): there is still no payer column on `wishlist_items`
  -- itself. Execute is `authenticated`-only and a per-call cap stands in until a Stripe charge
  -- is verified the same way supabase/functions/stripe-webhook/index.ts will eventually verify tips.
  if auth.role() <> 'service_role' and add_cents > 100000 then
    raise exception 'amount_cents exceeds the per-call limit (100000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this is a Mālo contribution too (see the
  -- doc comment above) — block it the same way `tips` INSERT does, before the aggregate even moves,
  -- not only at the equip/+500 Aura step below (add_user_aura's own check would catch that step,
  -- but not a below-target contribution that never reaches it).
  select player_id into target_player from public.wishlist_items where id = item_id;
  if target_player is not null and public.malo_target_frozen(target_player) then
    raise exception 'Mālo is frozen for this athlete; wishlist contributions are disabled.';
  end if;

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
-- 2026-09 audit item 1/5: Chip In is behind the Soft Wall (`SOFT_WALL_GATES` id `wishlist`), so
-- authenticated-only does not regress guest browse. See the SECURITY TRADEOFF comment on the
-- function body above for why a per-call cap stands in for a real ownership check.
revoke execute on function public.chip_in_wishlist_item(uuid, integer) from public, anon;
grant execute on function public.chip_in_wishlist_item(uuid, integer) to authenticated;

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

-- Soft-Wall auth: fan profile on first signup (Apple / Google / Magic Link).
-- Incremental twin: supabase/auth_fan_profile.sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id, full_name, role, roles, is_verified, aura_points, active_role, age_confirmed_13_plus
  )
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
    'fan',
    -- COPPA gate: only ever set true from the sign-up checkbox's metadata (email+password /
    -- magic-link). OAuth (Apple/Google) never sends this, so it stays null and the client shows a
    -- one-time post-sign-in confirmation modal instead (`AgeConfirmModal`).
    nullif(new.raw_user_meta_data->>'age_confirmed_13_plus', '')::boolean
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

grant execute on function public.handle_new_auth_user() to supabase_auth_admin;

-- Storage: buckets + policies for Highlight upload/playback and profile avatars.
-- 2026-09 fix: this used to live only in supabase/media_upload.sql and supabase/reels.sql —
-- fine for an existing hosted project that already ran those, but it meant a FRESH project
-- seeded from schema.sql alone (exactly what Phase 0's "apply to a fresh Supabase project"
-- and the Phase 2 staging-project setup call for) had no Storage buckets at all, so every
-- upload would fail with "bucket is missing". Consolidated here so schema.sql alone is enough.
-- 2026-09 audit (Round 18 sweep): `allowed_mime_types` — uploads declare their own Content-Type
-- client-side (`MediaUploadService.ts` passes 'video/mp4' for reels/game_highlights and
-- image/jpeg|png|webp for avatars, from the file extension) with nothing server-side checking the file actually matches. A raw
-- REST call to Storage's upload endpoint bypasses the app entirely and can declare any Content-Type
-- it wants — e.g. uploading HTML/SVG content declared as an image, which the public bucket would
-- then serve with that same header. This doesn't inspect file *bytes* (Postgres/Storage RLS has no
-- way to do that; real validation would need an Edge Function doing magic-byte sniffing), but it
-- does close the direct version of the attack: the bucket now rejects any upload whose declared
-- Content-Type isn't in this list, matching exactly what the app itself always sends.
-- 2026-10-07: this `reels` list is no longer the final word. Photo stories upload JPEGs to `reels`,
-- so the photo-stories block near the end of this file (Source:
-- supabase/migrations/20261007230000_photo_stories.sql) appends `image/jpeg` after this runs. Edit
-- the allow-list there, not here, or a full replay of this file will refuse every story photo.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('reels', 'reels', true, array['video/mp4', 'video/quicktime'])
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('game_highlights', 'game_highlights', true, array['video/mp4', 'video/quicktime'])
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('avatars', 'avatars', true, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;

-- Private Vault / Exclusive playback. Public Highlights stay on `reels`. New locked clips
-- upload here and store `reelvault:{path}` in `reels.video_url`. Playback uses a signed URL.
-- `can_read_reel_vault` allows the uploader, an admin, an active subscriber, a live Flash
-- Unlock, or a clip that has been moved back to the public feed.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('reel_vault', 'reel_vault', false, array['video/mp4', 'video/quicktime'])
on conflict (id) do update set public = excluded.public, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read reels bucket" on storage.objects;
create policy "Public read reels bucket"
  on storage.objects for select
  using (bucket_id = 'reels');

-- Signed-in fans only: bucket_id alone (with no auth check) let any anon-key
-- holder INSERT/UPDATE arbitrary files into these public buckets with no
-- session at all. MediaUploadService.ts already requires a session for both
-- uploadHighlight (reels/game_highlights) and uploadAvatar (avatars), so this
-- matches the existing client contract — it only blocks callers with no
-- session, which the app never asks Storage to do anyway.
drop policy if exists "Public upload reels bucket" on storage.objects;
create policy "Public upload reels bucket"
  on storage.objects for insert
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');

drop policy if exists "Public update reels bucket" on storage.objects;
create policy "Public update reels bucket"
  on storage.objects for update
  using (bucket_id = 'reels' and auth.role() = 'authenticated')
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');

drop policy if exists "Public read game highlights" on storage.objects;
create policy "Public read game highlights"
  on storage.objects for select
  using (bucket_id = 'game_highlights');

drop policy if exists "Public upload game highlights" on storage.objects;
create policy "Public upload game highlights"
  on storage.objects for insert
  with check (bucket_id = 'game_highlights' and auth.role() = 'authenticated');

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Public upload avatars" on storage.objects;
create policy "Public upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Public update avatars" on storage.objects;
create policy "Public update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated')
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Storage SELECT on reel_vault cannot query public.reels directly: that table's RLS hides
-- the row from subscribers and from anon during Flash Unlock, so the EXISTS check would
-- always fail for the people reels_feed just handed the token to. This definer reads the
-- same entitlement CASE and only returns a boolean.
create or replace function public.can_read_reel_vault(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reels r
    where r.video_url = 'reelvault:' || object_name
      and (
        coalesce(r.is_vault_only, false) = false
        or public.current_user_role() = 'admin'
        or (
          auth.uid() is not null
          and r.uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
        )
        or (r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()))
        or (
          auth.uid() is not null
          and r.player_id is not null
          and exists (
            select 1 from public.subscriptions s
            where s.subscriber_id = auth.uid()
              and s.athlete_id = r.player_id
              and s.status = 'active'
          )
        )
      )
  );
$$;

revoke all on function public.can_read_reel_vault(text) from public;
grant execute on function public.can_read_reel_vault(text) to anon, authenticated;

drop policy if exists "Upload own vault reel" on storage.objects;
create policy "Upload own vault reel"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reel_vault'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Read entitled vault reel" on storage.objects;
create policy "Read entitled vault reel"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'reel_vault'
    and public.can_read_reel_vault(name)
  );

-- =============================================================================
-- Custodial money rules (owner decision, 2026-09-29). Standalone copy: supabase/custodial_money.sql.
-- to an existing project. Safe to re-run.
--
-- The rules, in plain words (docs/engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md §7):
--   1. A guardian holds one payout account per athlete, and it holds only that athlete's money
--      (custodial_accounts is keyed by player_id; a Stripe account can serve only one athlete).
--   2. The athlete sees every gift and every withdrawal request (get_custodial_summary).
--   3. A guardian cannot withdraw without the athlete approving it in the app
--      (request_custodial_withdrawal -> pending_athlete -> decide_custodial_withdrawal).
--   4. At the handover age (default 18; admin sets 19 or 21 where counsel says the state requires
--      it) control passes to the athlete automatically: the guardian can no longer request, and the
--      athlete can move the money themselves. "Automatically" = computed from the birth date on
--      every call, so no scheduled job is needed.
--   5. Guardians are strongly encouraged to pay out to a bank account in the athlete's name
--      (bank_in_athlete_name), and stay in charge until the handover age.
--
-- Nothing here moves money. Approved requests wait until payouts open (ROADMAP Phase 1a +
-- Release waves Wave 1 checklist); POST /api/create-payout stays hard-blocked (503) until then.
-- Only a *verified* athlete account can approve: profiles.player_id alone is client-writable
-- (lib/teams.ts links by name match), so it cannot be trusted to identify the athlete.

create table if not exists public.custodial_accounts (
  player_id uuid primary key references public.players (id) on delete restrict,
  guardian_id uuid not null references public.profiles (id) on delete restrict,
  -- Filled by the parent-payee Connect flow once built (design §2). Unique: one Stripe account
  -- can never hold two athletes' money.
  stripe_connect_id text unique,
  payouts_enabled boolean not null default false,
  -- Guardian's own statement that the payout bank account is in the athlete's name (or a
  -- custodial account titled for them). Encouraged, not required. Null = not answered yet.
  bank_in_athlete_name boolean,
  handover_age smallint not null default 18 check (handover_age between 18 and 21),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists custodial_accounts_guardian_idx on public.custodial_accounts (guardian_id);

-- Kept apart from players/profiles on purpose: only the guardian, the athlete and admins can read
-- it, and it exists only to compute the handover date. Collected from the guardian at custodial
-- setup, never at sign-up (the 13+ checkbox stays the only age signal for everyone else).
create table if not exists public.athlete_birthdates (
  player_id uuid primary key references public.players (id) on delete cascade,
  birth_date date not null,
  entered_by uuid references public.profiles (id) on delete set null,
  entered_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.custodial_withdrawals (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete restrict,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_role text not null check (requested_role in ('guardian', 'athlete')),
  -- Same interim per-row cap as tips (Rounds 24/26). Checked against a real balance once the
  -- Phase 1a ledger exists.
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000),
  note text check (note is null or char_length(note) <= 280),
  status text not null default 'pending_athlete'
    check (status in ('pending_athlete', 'approved', 'declined', 'cancelled', 'paid')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists custodial_withdrawals_player_idx
  on public.custodial_withdrawals (player_id, created_at desc);
-- One open request at a time per athlete, so an athlete is never asked to approve a pile.
create unique index if not exists custodial_withdrawals_one_pending
  on public.custodial_withdrawals (player_id) where status = 'pending_athlete';

-- Who is the caller to this athlete's money? 'admin' | 'guardian' | 'athlete' | null.
create or replace function public.custodial_role(target_player_id uuid)
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
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    return null;
  end if;
  if public.current_user_role() = 'admin' then
    return 'admin';
  end if;
  if exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = me.id) then
    return 'guardian';
  end if;
  if me.player_id = target_player_id and coalesce(me.verification_status, 'unverified') = 'verified' then
    return 'athlete';
  end if;
  return null;
end;
$$;

revoke all on function public.custodial_role(uuid) from public;
grant execute on function public.custodial_role(uuid) to authenticated;

-- Birth date + handover age. Null until the guardian has entered a birth date.
create or replace function public.athlete_handover_date(target_player_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (b.birth_date + make_interval(years => coalesce(ca.handover_age, 18)::int))::date
  from public.athlete_birthdates b
  left join public.custodial_accounts ca on ca.player_id = b.player_id
  where b.player_id = target_player_id;
$$;

-- True once the athlete has reached the handover age. Unknown birth date = false (the guardian
-- stays in charge, and the athlete still approves every withdrawal).
create or replace function public.athlete_controls_money(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.athlete_handover_date(target_player_id) <= current_date, false);
$$;

-- Internal helpers only (called from the SECURITY DEFINER RPCs below). Not granted to clients:
-- a handover date would reveal a minor's birth date to anyone who asked.
revoke all on function public.athlete_handover_date(uuid) from public, anon, authenticated;
revoke all on function public.athlete_controls_money(uuid) from public, anon, authenticated;

alter table public.custodial_accounts enable row level security;
alter table public.athlete_birthdates enable row level security;
alter table public.custodial_withdrawals enable row level security;

drop policy if exists "Custodial parties read account" on public.custodial_accounts;
create policy "Custodial parties read account"
  on public.custodial_accounts for select
  to authenticated
  using (public.custodial_role(player_id) is not null);

drop policy if exists "Custodial parties read birthdate" on public.athlete_birthdates;
create policy "Custodial parties read birthdate"
  on public.athlete_birthdates for select
  to authenticated
  using (public.custodial_role(player_id) is not null);

drop policy if exists "Custodial parties read withdrawals" on public.custodial_withdrawals;
create policy "Custodial parties read withdrawals"
  on public.custodial_withdrawals for select
  to authenticated
  using (public.custodial_role(player_id) is not null);

-- Reads only. Every write goes through the SECURITY DEFINER RPCs below.
revoke all on public.custodial_accounts from anon, authenticated;
revoke all on public.athlete_birthdates from anon, authenticated;
revoke all on public.custodial_withdrawals from anon, authenticated;
grant select on public.custodial_accounts to authenticated;
grant select on public.athlete_birthdates to authenticated;
grant select on public.custodial_withdrawals to authenticated;

-- Guardian opens (or updates) the athlete's custodial record. The birth date can be entered once;
-- after that only an admin can correct it, so the handover date cannot be pushed back.
create or replace function public.guardian_setup_custodial(
  target_player_id uuid,
  athlete_birth_date date,
  bank_in_athlete_name boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid;
  on_file date;
begin
  if public.custodial_role(target_player_id) is distinct from 'guardian' then
    raise exception 'Only this athlete''s linked guardian can set up their account';
  end if;
  select id into caller from public.profiles where user_id = auth.uid() limit 1;

  select birth_date into on_file from public.athlete_birthdates where player_id = target_player_id;
  if on_file is null then
    if athlete_birth_date is null then
      raise exception 'Enter the athlete''s date of birth';
    end if;
    if athlete_birth_date > current_date - interval '5 years'
       or athlete_birth_date < current_date - interval '30 years' then
      raise exception 'That date of birth does not look right';
    end if;
    insert into public.athlete_birthdates (player_id, birth_date, entered_by)
    values (target_player_id, athlete_birth_date, caller);
  elsif athlete_birth_date is not null and athlete_birth_date <> on_file then
    raise exception 'A date of birth is already on file. Ask Tapua''i support to correct it';
  end if;

  if public.athlete_controls_money(target_player_id) then
    raise exception 'This athlete has reached the handover age and manages their own money';
  end if;

  insert into public.custodial_accounts (player_id, guardian_id, bank_in_athlete_name)
  values (target_player_id, caller, bank_in_athlete_name)
  on conflict (player_id) do update
    set bank_in_athlete_name = coalesce(excluded.bank_in_athlete_name, public.custodial_accounts.bank_in_athlete_name),
        updated_at = timezone('utc', now())
    where public.custodial_accounts.guardian_id = caller;

  if not found then
    raise exception 'This athlete''s account belongs to a different guardian';
  end if;
end;
$$;

revoke all on function public.guardian_setup_custodial(uuid, date, boolean) from public;
grant execute on function public.guardian_setup_custodial(uuid, date, boolean) to authenticated;

-- Admin-only: set the handover age for the athlete's state (counsel's call) or correct a birth date.
create or replace function public.admin_set_custodial_terms(
  target_player_id uuid,
  new_handover_age smallint default null,
  corrected_birth_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin required';
  end if;
  if new_handover_age is not null then
    update public.custodial_accounts
    set handover_age = new_handover_age, updated_at = timezone('utc', now())
    where player_id = target_player_id;
    if not found then
      raise exception 'No custodial account for this athlete';
    end if;
  end if;
  if corrected_birth_date is not null then
    insert into public.athlete_birthdates (player_id, birth_date, entered_by)
    values (
      target_player_id,
      corrected_birth_date,
      (select id from public.profiles where user_id = auth.uid() limit 1)
    )
    on conflict (player_id) do update
      set birth_date = excluded.birth_date,
          entered_by = excluded.entered_by,
          entered_at = timezone('utc', now());
  end if;
end;
$$;

revoke all on function public.admin_set_custodial_terms(uuid, smallint, date) from public;
grant execute on function public.admin_set_custodial_terms(uuid, smallint, date) to authenticated;

-- Before the handover age: the guardian asks, the athlete approves.
-- After it: the guardian can no longer ask; the athlete moves their own money (auto-approved).
create or replace function public.request_custodial_withdrawal(
  target_player_id uuid,
  amount_cents integer,
  note text default null
)
returns public.custodial_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  role_name text := public.custodial_role(target_player_id);
  caller uuid;
  req public.custodial_withdrawals;
  in_control boolean := public.athlete_controls_money(target_player_id);
begin
  select id into caller from public.profiles where user_id = auth.uid() limit 1;
  if not exists (select 1 from public.custodial_accounts where player_id = target_player_id) then
    raise exception 'No payout account has been set up for this athlete yet';
  end if;

  if role_name = 'guardian' then
    if in_control then
      raise exception 'This athlete has reached the handover age. The money is theirs to move now';
    end if;
    insert into public.custodial_withdrawals (player_id, requested_by, requested_role, amount_cents, note, status)
    values (target_player_id, caller, 'guardian', amount_cents, nullif(trim(note), ''), 'pending_athlete')
    returning * into req;
  elsif role_name = 'athlete' then
    if not in_control then
      raise exception 'Your guardian manages withdrawals until your handover date. You approve each one';
    end if;
    insert into public.custodial_withdrawals (
      player_id, requested_by, requested_role, amount_cents, note, status, decided_by, decided_at
    )
    values (
      target_player_id, caller, 'athlete', amount_cents, nullif(trim(note), ''), 'approved',
      caller, timezone('utc', now())
    )
    returning * into req;
  else
    raise exception 'Not allowed';
  end if;

  return req;
exception
  when unique_violation then
    raise exception 'There is already a request waiting on the athlete';
end;
$$;

revoke all on function public.request_custodial_withdrawal(uuid, integer, text) from public;
grant execute on function public.request_custodial_withdrawal(uuid, integer, text) to authenticated;

-- Only the (verified) athlete can approve or decline a guardian's request.
create or replace function public.decide_custodial_withdrawal(request_id uuid, approve boolean)
returns public.custodial_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.custodial_withdrawals;
begin
  select * into req from public.custodial_withdrawals where id = request_id;
  if req.id is null then
    raise exception 'Request not found';
  end if;
  if public.custodial_role(req.player_id) is distinct from 'athlete' then
    raise exception 'Only the athlete can approve this';
  end if;
  if req.status <> 'pending_athlete' then
    raise exception 'This request has already been decided';
  end if;

  update public.custodial_withdrawals
  set
    status = case when coalesce(approve, false) then 'approved' else 'declined' end,
    decided_by = (select id from public.profiles where user_id = auth.uid() limit 1),
    decided_at = timezone('utc', now())
  where id = request_id
  returning * into req;
  return req;
end;
$$;

revoke all on function public.decide_custodial_withdrawal(uuid, boolean) from public;
grant execute on function public.decide_custodial_withdrawal(uuid, boolean) to authenticated;

create or replace function public.cancel_custodial_withdrawal(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.custodial_withdrawals
  set status = 'cancelled', decided_at = timezone('utc', now())
  where id = request_id
    and status = 'pending_athlete'
    and requested_by = (select id from public.profiles where user_id = auth.uid() limit 1);
  if not found then
    raise exception 'Only an open request you made can be cancelled';
  end if;
end;
$$;

revoke all on function public.cancel_custodial_withdrawal(uuid) from public;
grant execute on function public.cancel_custodial_withdrawal(uuid) to authenticated;

-- Everything the guardian or athlete needs on one screen. Returns null for anyone else.
create or replace function public.get_custodial_summary(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text := public.custodial_role(target_player_id);
  acct public.custodial_accounts%rowtype;
  athlete public.players%rowtype;
  guardian_name text;
  handover date;
begin
  if role_name is null then
    return null;
  end if;
  select * into athlete from public.players where id = target_player_id;
  select * into acct from public.custodial_accounts where player_id = target_player_id;
  select coalesce(nullif(trim(p.full_name), ''), 'Your guardian') into guardian_name
  from public.profiles p where p.id = athlete.guardian_id;
  handover := public.athlete_handover_date(target_player_id);

  return jsonb_build_object(
    'viewer_role', role_name,
    'player_id', target_player_id,
    'athlete_name', coalesce(athlete.name, ''),
    'guardian_linked', athlete.guardian_id is not null,
    'guardian_name', guardian_name,
    'has_account', acct.player_id is not null,
    'payouts_enabled', coalesce(acct.payouts_enabled, false),
    'bank_in_athlete_name', acct.bank_in_athlete_name,
    'handover_age', coalesce(acct.handover_age, 18),
    'handover_date', handover,
    'athlete_controls', coalesce(handover <= current_date, false),
    'received_cents', (
      select coalesce(sum(t.amount_cents), 0) from public.tips t where t.player_id = target_player_id
    ),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.created_at desc)
      from (
        select id, requested_role, amount_cents, note, status, created_at, decided_at
        from public.custodial_withdrawals
        where player_id = target_player_id
        order by created_at desc
        limit 20
      ) w
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_custodial_summary(uuid) from public;
grant execute on function public.get_custodial_summary(uuid) to authenticated;

-- =============================================================================
-- M1 leaderboards (Release Wave 0, 2026-09-29). Standalone copy: supabase/leaderboards.sql.
-- =============================================================================

alter table public.reels add column if not exists view_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reels_view_count_nonnegative'
  ) then
    alter table public.reels
      add constraint reels_view_count_nonnegative check (view_count >= 0);
  end if;
end;
$$;

-- `view_count` is not in the `grant update (title, category, is_exclusive, is_vault_only,
-- flash_unlock_until) on public.reels to authenticated` column list, so clients cannot write it.
-- It only moves through `record_reel_view` below (SECURITY DEFINER, runs as the owner).

-- One row per viewer per Highlight per UTC day. The primary key is the throttle: a second view the
-- same day is a no-op insert, so replaying or looping a clip cannot pump its count. Client tables
-- get no policies and no grants — only the RPCs below read or write it.
create table if not exists public.reel_views (
  reel_id uuid not null references public.reels (id) on delete cascade,
  viewer_id uuid not null,
  view_day date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  primary key (reel_id, viewer_id, view_day)
);

create index if not exists reel_views_view_day_idx on public.reel_views (view_day);

alter table public.reel_views enable row level security;
revoke all on public.reel_views from anon, authenticated;

-- Signed-in only: the anon key ships in the app bundle, so an anon view would be inflatable by
-- anyone with a script. The uploader and the tagged athlete's own account do not count (no
-- watching your own clip up the board). Removed, flagged and Vault-only clips never count.
-- Returns the clip's view count after the call, or null when the clip cannot be counted.
create or replace function public.record_reel_view(target_reel_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewer_profile uuid;
  viewer_player uuid;
  clip public.reels%rowtype;
  inserted integer := 0;
  next_count integer;
begin
  if viewer is null then
    raise exception 'Sign in to count a view' using errcode = '42501';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if not found
    or coalesce(clip.is_removed, false)
    or coalesce(clip.is_flagged, false)
    or coalesce(clip.is_vault_only, false)
  then
    return null;
  end if;

  select p.id, p.player_id into viewer_profile, viewer_player
  from public.profiles p
  where p.user_id = viewer
  limit 1;

  if (viewer_profile is not null and clip.uploaded_by = viewer_profile)
    or (viewer_player is not null and clip.player_id = viewer_player)
  then
    return coalesce(clip.view_count, 0);
  end if;

  insert into public.reel_views (reel_id, viewer_id, view_day)
  values (target_reel_id, viewer, (timezone('utc', now()))::date)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.reels
      set view_count = coalesce(view_count, 0) + 1
      where id = target_reel_id
      returning view_count into next_count;
    return next_count;
  end if;

  return coalesce(clip.view_count, 0);
end;
$$;

revoke all on function public.record_reel_view(uuid) from public, anon;
grant execute on function public.record_reel_view(uuid) to authenticated;

-- Every board for one Spotlight window (`week` by default, so new athletes can climb each Monday).
--
-- Eligible clips: tag confirmed (the athlete, their guardian, an operator or an admin said "that's
-- them"), not removed, not flagged, not Vault-only, not Exclusive. Hype = Seki / Aura / Flex votes
-- cast inside the window (`reel_hype_votes.created_at`); views = counted views inside the window
-- (`reel_views.view_day`). Neither depends on when the clip was uploaded.
--
-- School score = hype + 10 × Highlights posted in the window + 5 × distinct fans who hyped or
-- viewed that school's clips. Fan score = 10 × clips they posted that got confirmed + hype they gave.
-- Fans show a username (or first name only) — never a full name.
create or replace function public.get_leaderboards(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  board_limit constant integer := 10;
  result jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  with eligible as (
    select r.id, r.title, r.player_id, r.uploaded_by, r.created_at, r.category,
      p.name as player_name, coalesce(nullif(btrim(p.school_name), ''), '') as school_name
    from public.reels r
    join public.players p on p.id = r.player_id
    where r.tag_status = 'confirmed'
      and coalesce(r.is_removed, false) = false
      and coalesce(r.is_flagged, false) = false
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_exclusive, false) = false
  ),
  hype as (
    select v.reel_id, v.user_id, v.kind
    from public.reel_hype_votes v
    join eligible e on e.id = v.reel_id
    where v.created_at::date between bounds.window_start and bounds.window_end
  ),
  views as (
    select w.reel_id, w.viewer_id
    from public.reel_views w
    join eligible e on e.id = w.reel_id
    where w.view_day between bounds.window_start and bounds.window_end
  ),
  reel_scores as (
    select e.*,
      coalesce((select count(*) from hype h where h.reel_id = e.id), 0)::int as hype,
      coalesce((select count(*) from views w where w.reel_id = e.id), 0)::int as views
    from eligible e
  ),
  player_scores as (
    select rs.player_id, max(rs.player_name) as name, max(rs.school_name) as school_name,
      sum(rs.hype)::int as hype, sum(rs.views)::int as views,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'seki'), 0)::int as seki,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'aura'), 0)::int as aura,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'flex'), 0)::int as flex
    from reel_scores rs
    group by rs.player_id
  ),
  school_fans as (
    select e.school_name, h.user_id as fan from hype h join eligible e on e.id = h.reel_id
    union
    select e.school_name, w.viewer_id as fan from views w join eligible e on e.id = w.reel_id
  ),
  school_scores as (
    select rs.school_name,
      sum(rs.hype)::int as hype,
      count(*) filter (where rs.created_at::date between bounds.window_start and bounds.window_end)::int as highlights,
      coalesce((select count(distinct sf.fan) from school_fans sf where sf.school_name = rs.school_name), 0)::int as fans
    from reel_scores rs
    where rs.school_name <> ''
    group by rs.school_name
  ),
  fan_scores as (
    select pr.id as profile_id,
      coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Fan') as name,
      pr.avatar_url,
      coalesce((select count(*) from hype h where h.user_id = pr.user_id), 0)::int as hype_given,
      coalesce((select count(*) from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end), 0)::int as clips_tagged
    from public.profiles pr
    where exists (select 1 from hype h where h.user_id = pr.user_id)
      or exists (select 1 from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end)
  )
  select jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'players_hype', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.hype desc, ps.views desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.hype desc, ps.views desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'hype', ps.hype, 'seki', ps.seki, 'aura', ps.aura, 'flex', ps.flex, 'views', ps.views
          ) as row_data
        from player_scores ps
        where ps.hype > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'players_views', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.views desc, ps.hype desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.views desc, ps.hype desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'views', ps.views, 'hype', ps.hype
          ) as row_data
        from player_scores ps
        where ps.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'highlights', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc),
            'reel_id', rs.id, 'title', rs.title, 'category', rs.category,
            'player_id', rs.player_id, 'name', rs.player_name, 'school_name', rs.school_name,
            'views', rs.views, 'hype', rs.hype
          ) as row_data
        from reel_scores rs
        where rs.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name),
            'school_name', ss.school_name, 'hype', ss.hype, 'highlights', ss.highlights,
            'fans', ss.fans, 'score', ss.hype + ss.highlights * 10 + ss.fans * 5
          ) as row_data
        from school_scores ss
        where ss.hype + ss.highlights + ss.fans > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'fans', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name),
            'profile_id', fs.profile_id, 'name', fs.name, 'avatar_url', fs.avatar_url,
            'hype_given', fs.hype_given, 'clips_tagged', fs.clips_tagged,
            'score', fs.clips_tagged * 10 + fs.hype_given
          ) as row_data
        from fan_scores fs
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_leaderboards(text) to anon, authenticated;

-- =============================================================================================
-- Athlete verification ladder (2026-09-29) — copy of supabase/migrations/20260929120000_athlete_verification_ladder.sql.
-- The migration file is the source of truth; keep this block identical to it. Later definitions in
-- this file override the earlier redeem_team_code / request_athlete_verification /
-- athlete_is_varsity_verified / can_confirm_player_tag / confirm_reel_player_tag above.
-- =============================================================================================

-- =============================================================================================
-- Athlete verification ladder — the school confirms each athlete in person
-- =============================================================================================
-- Design: docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md (owner decisions 2026-09-29, §0 and §4).
--
-- What changes:
--   1. Anyone can still claim to be an athlete. The claim is visible as "verification pending".
--   2. The shared school team code no longer verifies anyone. It only records the school.
--   3. An athletic director or coach, added by a Tapua'i admin, gets a private link. It opens a
--      form in the app. To confirm a student they must type the 6-digit code shown on that
--      student's phone — proof that they met in person — and sign with their name.
--   4. Only verification links an account to a `players` row. Clients can no longer write
--      `profiles.is_verified`, `verification_status` or `player_id` (they could, until now,
--      with one raw REST update).
--   5. Admin approval stamps the requester only. It used to stamp every profile with the same
--      name. `athlete_is_varsity_verified` and tag confirmation stop trusting name matches.
--   6. Existing accounts that were verified only by a shared team code go back to "pending".
--
-- Money: gifts to an athlete who is not verified are held. Payouts are blocked everywhere today
-- (503), and any future payout path must call `athlete_payout_allowed(player_id)` first.
--
-- Roll back: re-apply the previous definitions of redeem_team_code, request_athlete_verification,
-- athlete_is_varsity_verified, can_confirm_player_tag and confirm_reel_player_tag from git
-- history (commit 7afbef6, apps/mobile/src/backend/db/schema.sql), then
--   drop trigger guard_profiles_verification on public.profiles;
-- The new tables and columns are additive and can stay.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Claim records: extend verification_requests (the admin desk already reads it)
-- ---------------------------------------------------------------------------------------------

alter table public.verification_requests add column if not exists sport text;
alter table public.verification_requests add column if not exists class_year text;
alter table public.verification_requests add column if not exists jersey text;
alter table public.verification_requests add column if not exists meet_code_hash text;
alter table public.verification_requests add column if not exists meet_code_expires_at timestamptz;
alter table public.verification_requests add column if not exists meet_code_attempts integer not null default 0;
alter table public.verification_requests add column if not exists confirmer_id uuid;
alter table public.verification_requests add column if not exists confirmer_name text;
alter table public.verification_requests add column if not exists decided_at timestamptz;
alter table public.verification_requests add column if not exists decision_note text;

-- Statuses: pending (waiting on the school) · approved · rejected · disputed (two accounts claim
-- the same athlete; admin decides) · revoked (verification taken back). NOT VALID so legacy rows
-- with other values do not block the migration.
do $$
begin
  alter table public.verification_requests
    add constraint verification_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'disputed', 'revoked')) not valid;
exception
  when duplicate_object then null;
end $$;

-- One open claim per account. Close older duplicates first so the unique index can be built.
update public.verification_requests v
set status = 'rejected', decision_note = 'Superseded by a newer request (2026-09-29 migration)'
where v.status = 'pending'
  and v.requester_user_id is not null
  and exists (
    select 1 from public.verification_requests newer
    where newer.requester_user_id = v.requester_user_id
      and newer.status = 'pending'
      and (newer.created_at, newer.id) > (v.created_at, v.id)
  );

create unique index if not exists verification_requests_one_open_per_account
  on public.verification_requests (requester_user_id)
  where status in ('pending', 'disputed');

create index if not exists verification_requests_school_pending_idx
  on public.verification_requests (school_id)
  where status = 'pending';

create index if not exists verification_requests_player_idx
  on public.verification_requests (player_id);

-- ---------------------------------------------------------------------------------------------
-- 2. School confirmers: athletic directors and coaches allowed to confirm athletes
-- ---------------------------------------------------------------------------------------------
-- Only the SHA-256 of the link token is stored. The token itself is returned once, to the admin
-- who creates the confirmer, and sent to the AD/coach at their school email.

create table if not exists public.school_confirmers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools_and_teams (id) on delete cascade,
  full_name text not null,
  email text not null,
  staff_role text not null check (staff_role in ('athletic_director', 'coach')),
  -- null = every sport at the school (usual for an AD); otherwise the coach's sport only.
  sport text,
  token_hash text not null unique,
  active boolean not null default true,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '1 year'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz
);

do $$
begin
  alter table public.verification_requests
    add constraint verification_requests_confirmer_fk
    foreign key (confirmer_id) references public.school_confirmers (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table public.school_confirmers enable row level security;
revoke all on public.school_confirmers from anon, authenticated;
grant select on public.school_confirmers to authenticated;

drop policy if exists "Admins read school confirmers" on public.school_confirmers;
create policy "Admins read school confirmers"
  on public.school_confirmers for select
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------------------------

-- The verification RPCs below set this transaction-local flag right before they write the
-- guarded columns; guard_profiles_verification lets those writes through and nothing else.
create or replace function public.allow_verification_write()
returns void
language sql
as $$
  select set_config('app.tapuai_verification_write', 'true', true);
$$;

revoke all on function public.allow_verification_write() from public, anon, authenticated;

create or replace function public.hash_secret(raw text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(digest(coalesce(raw, ''), 'sha256'), 'hex');
$$;

revoke all on function public.hash_secret(text) from public, anon, authenticated;

-- True for a direct database session (SQL Editor, migrations) or an admin app session.
create or replace function public.is_admin_or_db()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() is null or auth.role() = 'service_role' or public.current_user_role() = 'admin';
$$;

revoke all on function public.is_admin_or_db() from public, anon;
grant execute on function public.is_admin_or_db() to authenticated;

-- The one question every payout path must ask. A player row can receive gifts before anyone is
-- verified; the money is only released once an account verified by the school is linked to it.
create or replace function public.athlete_payout_allowed(target_player_id uuid)
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

grant execute on function public.athlete_payout_allowed(uuid) to authenticated;

-- Replaces the old version, which also counted an unlinked profile whose name matched.
create or replace function public.athlete_is_varsity_verified(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.athlete_payout_allowed(target_player_id);
$$;

grant execute on function public.athlete_is_varsity_verified(uuid) to anon, authenticated;

-- Marks `me` verified and links the player row. Callers have already checked who may do this.
create or replace function public.apply_verification(req public.verification_requests)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.allow_verification_write();
  update public.profiles
  set
    is_verified = true,
    verification_status = 'verified',
    player_id = coalesce(req.player_id, player_id),
    school_id = coalesce(req.school_id, school_id),
    roles = (
      select coalesce(array_agg(distinct r), array['fan', 'athlete']::text[])
      from unnest(coalesce(roles, array['fan']::text[]) || array['athlete', 'fan']::text[]) as r
    ),
    role = case when role in ('admin', 'athlete') then role else 'athlete' end
  where id = req.requester_user_id;
end;
$$;

revoke all on function public.apply_verification(public.verification_requests) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Existing data: undo verification that only a shared team code granted, and self-links
-- ---------------------------------------------------------------------------------------------
-- An account keeps "verified" only if an admin approved a request for it (team_code is null on
-- admin approvals). Everyone else goes back to pending with an open request, so they show up in
-- their school's confirmation queue. `player_id` on an unverified account was self-set; it moves
-- onto the request as the athlete they claim to be.

do $$
declare
  downgraded integer;
  unlinked integer;
begin
  with keep as (
    select distinct p.id
    from public.profiles p
    join public.verification_requests v
      on v.status = 'approved'
     and v.team_code is null
     and (v.requester_user_id = p.id or (p.player_id is not null and v.player_id = p.player_id))
  ),
  targets as (
    select p.id, p.full_name, p.player_id, p.school_id, p.athlete_sport, p.athlete_class_year, p.athlete_jersey
    from public.profiles p
    where p.verification_status = 'verified'
      and not coalesce(p.is_admin, false)
      and not (coalesce(p.roles, array[]::text[]) @> array['admin']::text[])
      and p.id not in (select id from keep)
  ),
  reopened as (
    insert into public.verification_requests
      (player_id, full_name, status, notes, requester_user_id, school_id, sport, class_year, jersey)
    select t.player_id, coalesce(t.full_name, 'Athlete'), 'pending',
           'Re-opened 2026-09-29: a shared team code no longer verifies on its own',
           t.id, t.school_id, t.athlete_sport, t.athlete_class_year, t.athlete_jersey
    from targets t
    where not exists (
      select 1 from public.verification_requests o
      where o.requester_user_id = t.id and o.status in ('pending', 'disputed')
    )
    returning 1
  )
  update public.profiles p
  set is_verified = false, verification_status = 'pending'
  from targets t
  where p.id = t.id;
  get diagnostics downgraded = row_count;

  -- Carry each unverified self-link onto the account's open request, then clear it.
  update public.verification_requests v
  set player_id = p.player_id
  from public.profiles p
  where v.requester_user_id = p.id
    and v.status in ('pending', 'disputed')
    and v.player_id is null
    and p.player_id is not null
    and p.verification_status <> 'verified';

  update public.profiles
  set player_id = null
  where player_id is not null
    and verification_status <> 'verified';
  get diagnostics unlinked = row_count;

  raise notice 'verification ladder: % team-code-only accounts set to pending, % self-links cleared',
    downgraded, unlinked;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Guard: clients cannot write the verification columns
-- ---------------------------------------------------------------------------------------------
-- Separate from guard_profiles_admin_escalation so it can be reviewed and rolled back on its own.

create or replace function public.guard_profiles_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_or_db()
     or coalesce(current_setting('app.tapuai_verification_write', true), '') = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false)
       or coalesce(new.verification_status, 'unverified') <> 'unverified'
       or new.player_id is not null then
      raise exception 'Verification can only be set by your school or Tapua''i.';
    end if;
  elsif new.is_verified is distinct from old.is_verified
     or new.verification_status is distinct from old.verification_status
     or new.player_id is distinct from old.player_id then
    raise exception 'Verification can only be set by your school or Tapua''i.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profiles_verification on public.profiles;
create trigger guard_profiles_verification
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_verification();

-- ---------------------------------------------------------------------------------------------
-- 6. Athlete side: claim, team code, in-person code, status
-- ---------------------------------------------------------------------------------------------

-- Opens (or updates) the caller's claim. `target_player_id` is the roster row they say is them;
-- it is recorded on the claim and only linked when the school confirms.
create or replace function public.claim_athlete(target_player_id uuid default null, request_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  open_req public.verification_requests%rowtype;
  next_status text := 'pending';
  clash_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    raise exception 'Profile required';
  end if;
  if me.verification_status = 'verified' then
    return jsonb_build_object('ok', true, 'verification_status', 'verified', 'already', true);
  end if;
  if target_player_id is not null
     and not exists (select 1 from public.players where id = target_player_id) then
    target_player_id := null;
  end if;

  -- Someone else is already verified as this athlete, or has an open claim on them: freeze.
  if target_player_id is not null then
    if exists (
      select 1 from public.profiles p
      where p.player_id = target_player_id and p.verification_status = 'verified' and p.id <> me.id
    ) then
      next_status := 'disputed';
    else
      select v.id into clash_id
      from public.verification_requests v
      where v.player_id = target_player_id
        and v.status in ('pending', 'disputed')
        and v.requester_user_id is distinct from me.id
      limit 1;
      if clash_id is not null then
        next_status := 'disputed';
        update public.verification_requests
        set status = 'disputed', meet_code_hash = null, meet_code_expires_at = null
        where player_id = target_player_id and status = 'pending' and requester_user_id is distinct from me.id;
      end if;
    end if;
  end if;

  select * into open_req
  from public.verification_requests
  where requester_user_id = me.id and status in ('pending', 'disputed')
  limit 1;

  if open_req.id is null then
    insert into public.verification_requests
      (player_id, full_name, status, notes, requester_user_id, school_id, sport, class_year, jersey)
    values
      (target_player_id, coalesce(nullif(btrim(me.full_name), ''), 'Athlete'), next_status,
       coalesce(nullif(btrim(coalesce(request_notes, '')), ''), 'Athlete claim'),
       me.id, me.school_id, me.athlete_sport, me.athlete_class_year, me.athlete_jersey)
    returning * into open_req;
  else
    update public.verification_requests
    set
      player_id = coalesce(target_player_id, player_id),
      full_name = coalesce(nullif(btrim(me.full_name), ''), full_name),
      school_id = coalesce(me.school_id, school_id),
      sport = coalesce(me.athlete_sport, sport),
      class_year = coalesce(me.athlete_class_year, class_year),
      jersey = coalesce(me.athlete_jersey, jersey),
      status = case when next_status = 'disputed' then 'disputed' else status end,
      notes = coalesce(nullif(btrim(coalesce(request_notes, '')), ''), notes)
    where id = open_req.id
    returning * into open_req;
  end if;

  perform public.allow_verification_write();
  update public.profiles
  set
    verification_status = 'pending',
    is_verified = false,
    roles = (
      select coalesce(array_agg(distinct r), array['fan', 'athlete']::text[])
      from unnest(coalesce(roles, array['fan']::text[]) || array['athlete', 'fan']::text[]) as r
    ),
    role = case when role in ('admin', 'athlete') then role else 'athlete' end
  where id = me.id;

  return jsonb_build_object(
    'ok', true,
    'verification_status', 'pending',
    'request_status', open_req.status,
    'school_id', open_req.school_id
  );
end;
$$;

grant execute on function public.claim_athlete(uuid, text) to authenticated;

-- Kept for existing clients ("request approval" button): same as a claim with no roster row.
create or replace function public.request_athlete_verification(request_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is not null and me.legal_terms_accepted_at is null then
    raise exception 'legal acknowledgement required';
  end if;
  return public.claim_athlete(null, request_notes);
end;
$$;

grant execute on function public.request_athlete_verification(text) to authenticated;

-- The team code now only proves which school; the school still confirms the athlete.
-- Same lockout as before (5 wrong guesses → 15 minutes).
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
  sport_name text;
  me public.profiles%rowtype;
  school public.schools_and_teams%rowtype;
  claim jsonb;
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

  perform set_config('app.tapuai_team_code_write', 'true', true);

  select * into school
  from public.schools_and_teams s
  where upper(btrim(coalesce(s.team_code, ''))) in (n, school_key)
  limit 1;

  if school.id is null then
    -- Returned, not raised, so the fail-count increment commits (see the Round 31 note in schema.sql).
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

  parts := string_to_array(n, '-');
  if coalesce(array_length(parts, 1), 0) >= 3 then
    sport_name := public.sport_from_team_code_token(parts[2]);
  end if;

  update public.profiles
  set
    team_code_fail_count = 0,
    team_code_locked_until = null,
    school_id = school.id,
    athlete_division = coalesce(nullif(athlete_division, ''), school.division),
    athlete_sport = coalesce(sport_name, athlete_sport),
    active_role = 'athlete'
  where id = me.id;

  if me.verification_status = 'verified' then
    return jsonb_build_object('ok', true, 'verification_status', 'verified', 'already', true,
      'school_id', school.id, 'school_name', school.name, 'sport', sport_name);
  end if;

  claim := public.claim_athlete(null, 'School code accepted');
  update public.verification_requests
  set team_code = n
  where requester_user_id = me.id and status in ('pending', 'disputed');

  return jsonb_build_object(
    'ok', true,
    'verification_status', 'pending',
    'request_status', claim ->> 'request_status',
    'school_id', school.id,
    'school_name', school.name,
    'sport', sport_name
  );
end;
$$;

grant execute on function public.redeem_team_code(text) to authenticated;

-- The athlete shows this code to their AD or coach, who types it into the confirmation form.
-- Valid 30 minutes; asking again replaces it.
create or replace function public.start_school_check()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  me public.profiles%rowtype;
  req public.verification_requests%rowtype;
  code text;
  expires timestamptz := timezone('utc', now()) + interval '30 minutes';
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  select * into req
  from public.verification_requests
  where requester_user_id = me.id and status in ('pending', 'disputed')
  limit 1;
  if req.id is null then
    return jsonb_build_object('ok', false, 'error', 'Claim your athlete status first.');
  end if;
  if req.status = 'disputed' then
    return jsonb_build_object('ok', false, 'error', 'Another account also claims this athlete. Tapua''i is reviewing it.');
  end if;
  if req.school_id is null then
    return jsonb_build_object('ok', false, 'error', 'Add your school first.');
  end if;

  code := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  update public.verification_requests
  set meet_code_hash = public.hash_secret(code), meet_code_expires_at = expires, meet_code_attempts = 0
  where id = req.id;

  return jsonb_build_object('ok', true, 'code', code, 'expires_at', expires);
end;
$$;

grant execute on function public.start_school_check() to authenticated;

-- Everything the athlete's own verification card needs.
create or replace function public.get_my_verification()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  req public.verification_requests%rowtype;
  school_name text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into me from public.profiles where user_id = auth.uid() limit 1;
  if me.id is null then
    return null;
  end if;
  select * into req
  from public.verification_requests
  where requester_user_id = me.id
  order by (status in ('pending', 'disputed')) desc, created_at desc
  limit 1;
  select s.name into school_name
  from public.schools_and_teams s
  where s.id = coalesce(req.school_id, me.school_id);

  return jsonb_build_object(
    'verification_status', coalesce(me.verification_status, 'unverified'),
    'request_status', req.status,
    'school_name', school_name,
    'has_school', coalesce(req.school_id, me.school_id) is not null,
    'sport', coalesce(req.sport, me.athlete_sport),
    'code_expires_at', case when req.meet_code_expires_at > timezone('utc', now()) then req.meet_code_expires_at end,
    'confirmer_name', case when req.status = 'approved' then req.confirmer_name end,
    'decision_note', case when req.status in ('rejected', 'revoked') then req.decision_note end
  );
end;
$$;

grant execute on function public.get_my_verification() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 7. School side: the confirmation form (no account; the link token is the credential)
-- ---------------------------------------------------------------------------------------------

create or replace function public.school_confirmer_from_token(confirm_token text)
returns public.school_confirmers
language sql
stable
security definer
set search_path = public
as $$
  select c.*
  from public.school_confirmers c
  where c.token_hash = public.hash_secret(btrim(coalesce(confirm_token, '')))
    and c.active
    and c.expires_at > timezone('utc', now())
  limit 1;
$$;

revoke all on function public.school_confirmer_from_token(text) from public, anon, authenticated;

create or replace function public.get_school_confirmation_queue(confirm_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.school_confirmers%rowtype;
  school_name text;
  queue jsonb;
begin
  c := public.school_confirmer_from_token(confirm_token);
  if c.id is null then
    return jsonb_build_object('ok', false, 'error', 'This link is not active. Ask Tapua''i for a new one.');
  end if;
  select s.name into school_name from public.schools_and_teams s where s.id = c.school_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id,
      'full_name', v.full_name,
      'sport', v.sport,
      'class_year', v.class_year,
      'jersey', v.jersey,
      'created_at', v.created_at,
      'code_ready', v.meet_code_expires_at > timezone('utc', now())
    ) order by v.created_at), '[]'::jsonb)
  into queue
  from public.verification_requests v
  where v.school_id = c.school_id
    and v.status = 'pending'
    and (c.sport is null or v.sport is null or lower(v.sport) = lower(c.sport));

  return jsonb_build_object(
    'ok', true,
    'confirmer_name', c.full_name,
    'staff_role', c.staff_role,
    'sport', c.sport,
    'school_name', school_name,
    'requests', queue
  );
end;
$$;

grant execute on function public.get_school_confirmation_queue(text) to anon, authenticated;

-- approve = true needs the student's current 6-digit code; approve = false ("not on my roster")
-- does not. Wrong codes are counted on the claim; after 5 the code is void and the student asks
-- for a new one. Failures are returned, not raised, so the attempt count commits.
create or replace function public.school_confirm_athlete(
  confirm_token text,
  request_id uuid,
  approve boolean,
  meet_code text default null,
  confirmer_signature text default null,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.school_confirmers%rowtype;
  req public.verification_requests%rowtype;
  signature text := nullif(btrim(coalesce(confirmer_signature, '')), '');
  max_attempts constant integer := 5;
begin
  c := public.school_confirmer_from_token(confirm_token);
  if c.id is null then
    return jsonb_build_object('ok', false, 'error', 'This link is not active. Ask Tapua''i for a new one.');
  end if;

  select * into req from public.verification_requests where id = request_id for update;
  if req.id is null or req.school_id is distinct from c.school_id then
    return jsonb_build_object('ok', false, 'error', 'This student is not waiting on your school.');
  end if;
  if req.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'This request was already handled.');
  end if;
  if c.sport is not null and req.sport is not null and lower(req.sport) <> lower(c.sport) then
    return jsonb_build_object('ok', false, 'error', 'This student is in a different sport.');
  end if;
  if signature is null then
    return jsonb_build_object('ok', false, 'error', 'Type your full name to sign.');
  end if;

  update public.school_confirmers set last_used_at = timezone('utc', now()) where id = c.id;

  if not approve then
    update public.verification_requests
    set status = 'rejected', confirmer_id = c.id, confirmer_name = signature,
        decided_at = timezone('utc', now()), meet_code_hash = null, meet_code_expires_at = null,
        decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Not on the school roster')
    where id = req.id;
    perform public.allow_verification_write();
    update public.profiles
    set verification_status = 'unverified', is_verified = false
    where id = req.requester_user_id and verification_status <> 'verified';
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if req.meet_code_hash is null or req.meet_code_expires_at is null
     or req.meet_code_expires_at <= timezone('utc', now()) then
    return jsonb_build_object('ok', false, 'error', 'Ask the student to tap "Show my school code" and read you the new code.');
  end if;
  if public.hash_secret(btrim(coalesce(meet_code, ''))) <> req.meet_code_hash then
    update public.verification_requests
    set
      meet_code_attempts = meet_code_attempts + 1,
      meet_code_hash = case when meet_code_attempts + 1 >= max_attempts then null else meet_code_hash end
    where id = req.id;
    return jsonb_build_object('ok', false, 'error',
      case when req.meet_code_attempts + 1 >= max_attempts
        then 'Too many wrong codes. Ask the student for a new one.'
        else 'That code does not match. Check the student''s screen.' end);
  end if;

  -- Last check before linking: nobody else may already be verified as this athlete.
  if req.player_id is not null and exists (
    select 1 from public.profiles p
    where p.player_id = req.player_id and p.verification_status = 'verified'
      and p.id is distinct from req.requester_user_id
  ) then
    update public.verification_requests set status = 'disputed' where id = req.id;
    return jsonb_build_object('ok', false, 'error', 'Another account is already verified as this athlete. Tapua''i will review it.');
  end if;

  update public.verification_requests
  set status = 'approved', confirmer_id = c.id, confirmer_name = signature,
      decided_at = timezone('utc', now()), meet_code_hash = null, meet_code_expires_at = null,
      decision_note = nullif(btrim(coalesce(note, '')), '')
  where id = req.id
  returning * into req;
  perform public.apply_verification(req);

  return jsonb_build_object('ok', true, 'status', 'approved', 'full_name', req.full_name);
end;
$$;

grant execute on function public.school_confirm_athlete(text, uuid, boolean, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Admin side
-- ---------------------------------------------------------------------------------------------

-- Returns the link token ONCE. Check the person is real staff (school email domain, a call to the
-- school office) before creating them.
create or replace function public.admin_add_school_confirmer(
  target_school_id uuid,
  confirmer_name text,
  confirmer_email text,
  confirmer_role text,
  confirmer_sport text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text := encode(gen_random_bytes(24), 'hex');
  new_id uuid;
  actor uuid;
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  if nullif(btrim(coalesce(confirmer_name, '')), '') is null
     or nullif(btrim(coalesce(confirmer_email, '')), '') is null then
    raise exception 'Name and school email are required';
  end if;
  select id into actor from public.profiles where user_id = auth.uid() limit 1;

  insert into public.school_confirmers (school_id, full_name, email, staff_role, sport, token_hash, created_by)
  values (target_school_id, btrim(confirmer_name), lower(btrim(confirmer_email)), confirmer_role,
          nullif(btrim(coalesce(confirmer_sport, '')), ''), public.hash_secret(token), actor)
  returning id into new_id;

  return jsonb_build_object('id', new_id, 'token', token, 'link', 'alasports://school-confirm?t=' || token);
end;
$$;

grant execute on function public.admin_add_school_confirmer(uuid, text, text, text, text) to authenticated;

create or replace function public.admin_revoke_school_confirmer(confirmer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  update public.school_confirmers set active = false where id = confirmer_id;
end;
$$;

grant execute on function public.admin_revoke_school_confirmer(uuid) to authenticated;

-- Admin override and dispute resolution. Stamps the requester only (the old client-side approve
-- stamped every profile with a matching name).
create or replace function public.admin_decide_verification(request_id uuid, approve boolean, note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.verification_requests%rowtype;
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  select * into req from public.verification_requests where id = request_id for update;
  if req.id is null then
    raise exception 'Request not found';
  end if;

  if not approve then
    update public.verification_requests
    set status = 'rejected', decided_at = timezone('utc', now()), meet_code_hash = null,
        decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Rejected by Tapua''i')
    where id = req.id;
    if req.requester_user_id is not null then
      perform public.allow_verification_write();
      update public.profiles
      set verification_status = 'unverified', is_verified = false
      where id = req.requester_user_id and verification_status <> 'verified';
    end if;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  if req.requester_user_id is null then
    raise exception 'This request has no account to verify';
  end if;
  if req.player_id is not null and exists (
    select 1 from public.profiles p
    where p.player_id = req.player_id and p.verification_status = 'verified'
      and p.id <> req.requester_user_id
  ) then
    raise exception 'Another account is verified as this athlete. Revoke it first.';
  end if;

  update public.verification_requests
  set status = 'approved', decided_at = timezone('utc', now()), meet_code_hash = null,
      decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Approved by Tapua''i')
  where id = req.id
  returning * into req;
  perform public.apply_verification(req);

  -- Close any other open claim on the same athlete, and drop those accounts back to unverified.
  if req.player_id is not null then
    perform public.allow_verification_write();
    update public.profiles p
    set verification_status = 'unverified', is_verified = false
    where p.verification_status = 'pending'
      and p.id in (
        select v.requester_user_id from public.verification_requests v
        where v.player_id = req.player_id and v.status in ('pending', 'disputed') and v.id <> req.id
      );
    update public.verification_requests
    set status = 'rejected', decided_at = timezone('utc', now()),
        decision_note = 'Another account was verified as this athlete'
    where player_id = req.player_id and status in ('pending', 'disputed') and id <> req.id;
  end if;

  return jsonb_build_object('ok', true, 'status', 'approved');
end;
$$;

grant execute on function public.admin_decide_verification(uuid, boolean, text) to authenticated;

create or replace function public.admin_revoke_verification(target_profile_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  update public.verification_requests
  set status = 'revoked', decided_at = timezone('utc', now()),
      decision_note = coalesce(nullif(btrim(coalesce(note, '')), ''), 'Verification revoked')
  where requester_user_id = target_profile_id and status = 'approved';
  perform public.allow_verification_write();
  update public.profiles
  set is_verified = false, verification_status = 'unverified', player_id = null
  where id = target_profile_id;
end;
$$;

grant execute on function public.admin_revoke_verification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 9. Tags stop trusting name and jersey matches
-- ---------------------------------------------------------------------------------------------
-- Before: anyone whose profile name or jersey + school matched could confirm an athlete's tags,
-- and confirming a tag linked their account to that athlete. Now: the verified athlete, their
-- guardian, an operator at that school, or an admin; no linking.

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
  if role_name = 'admin' then
    return true;
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    return false;
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;
  if actor is null then
    return false;
  end if;

  if athlete.guardian_id is not null and athlete.guardian_id = actor then
    return true;
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = actor and pr.player_id = athlete.id and pr.verification_status = 'verified'
  ) then
    return true;
  end if;

  if role_name = 'operator'
     or exists (
       select 1 from public.profiles pr
       where pr.id = actor and coalesce(pr.roles, array[]::text[]) @> array['operator']::text[]
     )
  then
    if exists (
      select 1
      from public.profiles pr
      join public.schools_and_teams s on s.id = pr.school_id
      where pr.id = actor
        and (lower(s.name) = lower(athlete.school_name) or lower(s.name) = lower(coalesce(athlete.team, '')))
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

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
    raise exception 'Only the verified athlete, their parent, a school operator, or admin can verify this tag.';
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;
  next_status := case when action = 'reject' then 'rejected' else 'confirmed' end;

  update public.reels
  set tag_status = next_status, tag_confirmed_at = timezone('utc', now()), tag_confirmed_by = actor
  where id = target_reel_id
  returning * into clip;

  perform public.sync_live_spotlight_awards();

  return jsonb_build_object(
    'id', clip.id,
    'player_id', clip.player_id,
    'tag_status', clip.tag_status,
    'tag_confirmed_at', clip.tag_confirmed_at
  );
end;
$$;

grant execute on function public.can_confirm_player_tag(uuid) to authenticated;
grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated;


-- ===== 20260929130000_payout_gate_without_school.sql =====
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


-- ===== 20260929140000_school_badge.sql =====
-- =============================================================================================
-- School badge — the school's crest on a school-confirmed athlete's profile
-- =============================================================================================
-- Design: docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md §10 (owner request 2026-09-29).
--
-- What changes:
--   1. schools_and_teams gets logo_url and two brand colours, set only by a Tapua'i admin
--      (admin_set_school_branding). No logo → the app draws a monogram shield in the colours.
--   2. athlete_school_badge(player_id) returns the crest data ONLY when the school (or an admin)
--      confirmed that athlete. The app never builds the badge from profile fields a user can
--      edit, so a fan account cannot make one appear.
--   3. Display names can no longer contain check-mark characters (✓ ✔ ☑ ✅), which a fan could
--      use to imitate the badge. NOT VALID: existing names are left alone.
--
-- Roll back:
--   drop function public.athlete_school_badge(uuid);
--   drop function public.admin_set_school_branding(uuid, text, text, text);
--   alter table public.profiles drop constraint profiles_name_no_check_marks;
-- The new columns are additive and can stay.
-- =============================================================================================

alter table public.schools_and_teams add column if not exists logo_url text;
alter table public.schools_and_teams add column if not exists color_primary text;
alter table public.schools_and_teams add column if not exists color_secondary text;

do $$
begin
  alter table public.schools_and_teams
    add constraint schools_and_teams_branding_check
    check (
      (logo_url is null or logo_url ~ '^https://')
      and (color_primary is null or color_primary ~ '^#[0-9A-Fa-f]{6}$')
      and (color_secondary is null or color_secondary ~ '^#[0-9A-Fa-f]{6}$')
    );
exception
  when duplicate_object then null;
end $$;

create or replace function public.admin_set_school_branding(
  target_school_id uuid,
  new_logo_url text default null,
  new_color_primary text default null,
  new_color_secondary text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_or_db() then
    raise exception 'Only Tapua''i admins can set school branding';
  end if;
  update public.schools_and_teams
  set
    logo_url = nullif(btrim(new_logo_url), ''),
    color_primary = nullif(btrim(new_color_primary), ''),
    color_secondary = nullif(btrim(new_color_secondary), '')
  where id = target_school_id;
  if not found then
    raise exception 'Unknown school';
  end if;
end;
$$;

revoke all on function public.admin_set_school_branding(uuid, text, text, text) from public, anon;
grant execute on function public.admin_set_school_branding(uuid, text, text, text) to authenticated;

-- Null unless a school-confirmed account is linked to this player row. confirmed_by is the
-- staff role only ('athletic_director' | 'coach' | 'tapuai'), never the staff member's name.
create or replace function public.athlete_school_badge(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me public.profiles%rowtype;
  school public.schools_and_teams%rowtype;
  req public.verification_requests%rowtype;
  staff text;
begin
  select * into me
  from public.profiles p
  where p.player_id = target_player_id
    and p.verification_status = 'verified'
    and coalesce(p.is_verified, false)
  limit 1;
  if me.id is null or me.school_id is null then
    return null;
  end if;
  select * into school from public.schools_and_teams where id = me.school_id;
  if school.id is null then
    return null;
  end if;
  select * into req
  from public.verification_requests v
  where v.requester_user_id = me.id and v.status = 'approved'
  order by v.decided_at desc nulls last, v.created_at desc
  limit 1;
  if req.confirmer_id is not null then
    select c.staff_role into staff from public.school_confirmers c where c.id = req.confirmer_id;
  end if;

  return jsonb_build_object(
    'school_id', school.id,
    'school_name', school.name,
    'mascot', nullif(school.mascot, ''),
    'logo_url', school.logo_url,
    'color_primary', school.color_primary,
    'color_secondary', school.color_secondary,
    'confirmed_at', coalesce(req.decided_at, req.created_at),
    'confirmed_by', coalesce(staff, 'tapuai')
  );
end;
$$;

grant execute on function public.athlete_school_badge(uuid) to anon, authenticated;

do $$
begin
  alter table public.profiles
    add constraint profiles_name_no_check_marks
    check (
      coalesce(full_name, '') !~ '[✓✔☑✅]'
      and coalesce(username, '') !~ '[✓✔☑✅]'
    ) not valid;
exception
  when duplicate_object then null;
end $$;

-- =============================================================================
-- Highlight views + filmer credit (supabase/migrations/20260929160000_reel_views_and_filmer_credit.sql)
-- =============================================================================
-- =============================================================================================
-- Highlight views on profiles + credit for the fan who filmed the clip
-- =============================================================================================
-- Owner request 2026-09-29: every clip keeps its own Seki / Aura / Flex and views from other
-- accounts, "the same feeling as other social platforms" — hype on the clip, views on the
-- athlete's page — and fans who upload get visible credit.
--
-- What changes:
--   1. reels_feed gains view_count, uploader_name, uploader_avatar_url (appended, so existing
--      readers are unaffected). Views were already counted by record_reel_view (one per signed-in
--      viewer per clip per day, never the uploader or tagged athlete) but no client could read them.
--      The app now counts a view only after 3 s of real playback (lib/leaderboards.ts VIEW_PLAY_MS).
--   2. athlete_highlight_views(player): total counted views on that athlete's confirmed clips —
--      the number on their profile.
--   3. filmer_stats(profile): clips a fan filmed that the athlete confirmed, and their total views
--      and hype. Credit only; no money.
--
-- Roll back:
--   drop function public.filmer_stats(uuid); drop function public.athlete_highlight_views(uuid);
--   then re-create reels_feed from schema.sql's "2026-09 audit (paywall bypass)" block (drop view
--   first — create or replace cannot remove columns).
-- =============================================================================================

create or replace view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url,
  coalesce(r.view_count, 0) as view_count,
  -- Handle first, else first name only: the clip credit never shows a fan's full name.
  -- Null when the tagged athlete posted it themself (no "Filmed by" on your own clip).
  case
    when r.player_id is not null and up.player_id = r.player_id then null
    else coalesce(
      nullif(btrim(up.username), ''),
      nullif(split_part(btrim(coalesce(up.full_name, '')), ' ', 1), '')
    )
  end as uploader_name,
  up.avatar_url as uploader_avatar_url
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;

grant select on public.reels_feed to anon, authenticated;

create or replace function public.athlete_highlight_views(target_player_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(r.view_count), 0)::integer
  from public.reels r
  where r.player_id = target_player_id
    and r.tag_status = 'confirmed'
    and not coalesce(r.is_removed, false);
$$;

grant execute on function public.athlete_highlight_views(uuid) to anon, authenticated;

create or replace function public.filmer_stats(target_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clips', count(*)::integer,
    'views', coalesce(sum(r.view_count), 0)::integer,
    'hype', coalesce(sum(r.seki_count + r.aura_count + r.flex_count), 0)::integer
  )
  from public.reels r
  where r.uploaded_by = target_profile_id
    and r.tag_status = 'confirmed'
    and not coalesce(r.is_removed, false);
$$;

grant execute on function public.filmer_stats(uuid) to anon, authenticated;

-- =============================================================================
-- Filmer rewards (supabase/migrations/20260929170000_filmer_rewards.sql)
-- =============================================================================
-- =============================================================================================
-- Filmers: stats, Top Filmers board, Aura rewards and Props
-- =============================================================================================
-- Owner decision 2026-09-29: fans who film and post a teammate's highlight get rewarded, but never
-- out of the athlete's gifts. Mālo stays 100% the tagged athlete's.
--
-- What changes:
--   1. filmer_rewards — one row per reward a filmer earns (tag confirmed, view milestone, Props).
--      Written only by the server. Today every row is Aura. cash_cents / funded_by are reserved for
--      a future Tapua'i-funded filmer programme: funded_by can only ever be 'tapuai', so athlete
--      gifts can never be routed to a filmer through this table. No client shows the cash columns.
--   2. Aura for filmers (server-side trigger on reels, so a client cannot mint it):
--        +10 when the athlete confirms the tag on a clip the fan filmed;
--        +10 / +50 / +200 when that clip reaches 100 / 1,000 / 10,000 counted views.
--      Never paid to the athlete for their own clip.
--   3. filmer_props — a fan's "🎥 Props" to whoever filmed a clip (once per fan per clip, 50 a day).
--      +1 Aura to the filmer each.
--   4. filmer_stats(profile) now also returns props and aura_earned.
--   5. get_top_filmers(period_kind) — the Spotlight "Top Filmers" board: views + 3 × hype + 5 × Props
--      on confirmed clips they filmed, inside the Spotlight window. No money fields.
--
-- Needs: supabase/leaderboards.sql (reels.view_count, reel_views, reel_hype_votes.created_at) and
-- 20260929160000_reel_views_and_filmer_credit.sql (filmer_stats).
--
-- Roll back:
--   drop trigger reels_filmer_rewards on public.reels; drop function public.reels_filmer_rewards();
--   drop function public.get_top_filmers(text); drop function public.give_filmer_props(uuid);
--   drop function public.award_filmer_aura(uuid, uuid, text, text, integer);
--   drop table public.filmer_props; drop table public.filmer_rewards;
--   then re-create filmer_stats from 20260929160000. Aura already added to profiles stays.
-- =============================================================================================

create table if not exists public.filmer_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid references public.reels (id) on delete set null,
  kind text not null check (kind in ('tag_confirmed', 'views_milestone', 'props')),
  -- Makes each reward idempotent: 'tag:<reel>', 'views:<n>:<reel>', 'props:<reel>:<giver>'.
  source_key text not null unique,
  aura_points integer not null default 0 check (aura_points >= 0),
  cash_cents integer not null default 0 check (cash_cents >= 0),
  funded_by text not null default 'tapuai' check (funded_by = 'tapuai'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists filmer_rewards_profile_idx on public.filmer_rewards (profile_id, created_at desc);

alter table public.filmer_rewards enable row level security;
revoke all on public.filmer_rewards from anon, authenticated;
grant select on public.filmer_rewards to authenticated;

drop policy if exists "Filmers read own rewards" on public.filmer_rewards;
create policy "Filmers read own rewards" on public.filmer_rewards
  for select to authenticated
  using (profile_id in (select p.id from public.profiles p where p.user_id = auth.uid()));

create table if not exists public.filmer_props (
  reel_id uuid not null references public.reels (id) on delete cascade,
  giver_user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (reel_id, giver_user_id)
);

create index if not exists filmer_props_giver_idx on public.filmer_props (giver_user_id, created_at desc);

-- Written and read only through the functions below.
alter table public.filmer_props enable row level security;
revoke all on public.filmer_props from anon, authenticated;

-- Internal: add a reward once. Returns true when it was new.
create or replace function public.award_filmer_aura(
  target_profile_id uuid,
  target_reel_id uuid,
  reward_kind text,
  reward_key text,
  points integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  if target_profile_id is null or coalesce(points, 0) <= 0 then
    return false;
  end if;
  insert into public.filmer_rewards (profile_id, reel_id, kind, source_key, aura_points)
  values (target_profile_id, target_reel_id, reward_kind, reward_key, points)
  on conflict (source_key) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  update public.profiles
    set aura_points = coalesce(aura_points, 0) + points
    where id = target_profile_id;
  return true;
end;
$$;

revoke all on function public.award_filmer_aura(uuid, uuid, text, text, integer) from public, anon, authenticated;

-- The filmer of a clip: its uploader, unless the uploader is the tagged athlete. Null otherwise.
create or replace function public.reel_filmer_profile_id(target_reel_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.id
  from public.reels r
  join public.profiles up on up.id = r.uploaded_by
  where r.id = target_reel_id
    and (r.player_id is null or up.player_id is distinct from r.player_id);
$$;

revoke all on function public.reel_filmer_profile_id(uuid) from public, anon, authenticated;

create or replace function public.reels_filmer_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  filmer uuid;
  milestone record;
begin
  if new.tag_status is distinct from 'confirmed'
    or new.uploaded_by is null
    or coalesce(new.is_removed, false)
  then
    return new;
  end if;
  filmer := public.reel_filmer_profile_id(new.id);
  if filmer is null then
    return new;
  end if;

  perform public.award_filmer_aura(filmer, new.id, 'tag_confirmed', 'tag:' || new.id, 10);

  for milestone in
    select * from (values (100, 10), (1000, 50), (10000, 200)) as m (views, points)
  loop
    if coalesce(new.view_count, 0) >= milestone.views then
      perform public.award_filmer_aura(
        filmer, new.id, 'views_milestone', 'views:' || milestone.views || ':' || new.id, milestone.points
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists reels_filmer_rewards on public.reels;
create trigger reels_filmer_rewards
  after update of tag_status, view_count on public.reels
  for each row
  execute function public.reels_filmer_rewards();

create or replace function public.give_filmer_props(target_reel_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  giver uuid := auth.uid();
  filmer uuid;
  clip public.reels%rowtype;
  today_count integer;
  inserted integer := 0;
  total integer;
begin
  if giver is null then
    raise exception 'Sign in to give Props' using errcode = '42501';
  end if;
  select * into clip from public.reels where id = target_reel_id;
  if not found or clip.tag_status is distinct from 'confirmed' or coalesce(clip.is_removed, false) then
    raise exception 'Props open once the athlete confirms this clip';
  end if;
  filmer := public.reel_filmer_profile_id(target_reel_id);
  if filmer is null then
    raise exception 'This clip was posted by the athlete';
  end if;
  if exists (select 1 from public.profiles p where p.id = filmer and p.user_id = giver) then
    raise exception 'You filmed this one';
  end if;
  select count(*) into today_count
  from public.filmer_props
  where giver_user_id = giver and created_at > timezone('utc', now()) - interval '1 day';
  if today_count >= 50 then
    raise exception 'That is 50 Props today. Try again tomorrow';
  end if;

  insert into public.filmer_props (reel_id, giver_user_id)
  values (target_reel_id, giver)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    perform public.award_filmer_aura(filmer, target_reel_id, 'props', 'props:' || target_reel_id || ':' || giver, 1);
  end if;

  select count(*) into total from public.filmer_props where reel_id = target_reel_id;
  return total;
end;
$$;

grant execute on function public.give_filmer_props(uuid) to authenticated;

create or replace function public.filmer_stats(target_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with clips as (
    select r.*
    from public.reels r
    join public.profiles up on up.id = r.uploaded_by
    where r.uploaded_by = target_profile_id
      and r.tag_status = 'confirmed'
      and not coalesce(r.is_removed, false)
      and (r.player_id is null or up.player_id is distinct from r.player_id)
  )
  select jsonb_build_object(
    'clips', (select count(*) from clips)::integer,
    'views', coalesce((select sum(view_count) from clips), 0)::integer,
    'hype', coalesce((select sum(seki_count + aura_count + flex_count) from clips), 0)::integer,
    'props', (select count(*) from public.filmer_props fp join clips c on c.id = fp.reel_id)::integer,
    'aura_earned', coalesce((
      select sum(fr.aura_points) from public.filmer_rewards fr where fr.profile_id = target_profile_id
    ), 0)::integer
  );
$$;

grant execute on function public.filmer_stats(uuid) to anon, authenticated;

create or replace function public.get_top_filmers(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
begin
  select * into bounds from public.spotlight_window(kind);

  return coalesce((
    with eligible as (
      select r.id, r.uploaded_by
      from public.reels r
      join public.profiles up on up.id = r.uploaded_by
      where r.tag_status = 'confirmed'
        and not coalesce(r.is_removed, false)
        and not coalesce(r.is_flagged, false)
        and not coalesce(r.is_vault_only, false)
        and (r.player_id is null or up.player_id is distinct from r.player_id)
    ),
    scores as (
      select e.uploaded_by as profile_id,
        count(distinct e.id)::int as clips,
        coalesce(sum((select count(*) from public.reel_views w
          where w.reel_id = e.id and w.view_day between bounds.window_start and bounds.window_end)), 0)::int as views,
        coalesce(sum((select count(*) from public.reel_hype_votes v
          where v.reel_id = e.id and v.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as hype,
        coalesce(sum((select count(*) from public.filmer_props fp
          where fp.reel_id = e.id and fp.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as props
      from eligible e
      group by e.uploaded_by
    ),
    ranked as (
      select s.*, s.views + s.hype * 3 + s.props * 5 as score,
        coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''), 'Filmer') as name,
        pr.avatar_url
      from scores s
      join public.profiles pr on pr.id = s.profile_id
      where s.views + s.hype + s.props > 0
    )
    select jsonb_agg(row_data order by rank)
    from (
      select row_number() over (order by rk.score desc, rk.name) as rank,
        jsonb_build_object(
          'rank', row_number() over (order by rk.score desc, rk.name),
          'profile_id', rk.profile_id, 'name', rk.name, 'avatar_url', rk.avatar_url,
          'clips', rk.clips, 'views', rk.views, 'hype', rk.hype, 'props', rk.props, 'score', rk.score
        ) as row_data
      from ranked rk
      order by rank
      limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_top_filmers(text) to anon, authenticated;

-- =============================================================================
-- Rally goals, donation thank-yous, optional tip to Tapua'i (supabase/migrations/20260929180000_rally_goals_thanks_platform_tip.sql)
-- =============================================================================
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
  -- 'card_fee' (BOOKS-01, below) is listed here too, so re-running this file after card-fee rows exist cannot fail.
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

-- Content rights (2026-10-01). Uploader confirmation columns, report reasons, and weighted hiding.
-- Source: supabase/migrations/20261001180000_content_rights_reports.sql

alter table public.reels add column if not exists attested_at timestamptz;
alter table public.reels add column if not exists rights_version text;

create table if not exists public.reel_reports (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  reporter_id uuid not null,
  reason text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reel_id, reporter_id),
  constraint reel_reports_reason_check check (
    reason in (
      'fake_footage',
      'wrong_athlete',
      'impersonation',
      'rights',
      'inappropriate',
      'other',
      'unspecified'
    )
  )
);

create index if not exists reel_reports_reel_idx on public.reel_reports (reel_id);

alter table public.reel_reports enable row level security;

drop policy if exists "Admin reads reel reports" on public.reel_reports;
create policy "Admin reads reel reports"
  on public.reel_reports for select
  to authenticated
  using (public.current_user_role() = 'admin');

revoke all on public.reel_reports from anon, authenticated;
grant select on public.reel_reports to authenticated;

create or replace function public.report_reel(target_reel_id uuid, report_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reporter uuid := auth.uid();
  reason text := coalesce(nullif(trim(report_reason), ''), 'unspecified');
  result public.reels%rowtype;
  report_count integer := 0;
  hides_now boolean := false;
begin
  if reporter is null then
    raise exception 'Sign in to report a highlight.';
  end if;
  if reason not in (
    'fake_footage', 'wrong_athlete', 'impersonation', 'rights', 'inappropriate', 'other', 'unspecified'
  ) then
    raise exception 'Pick a report reason.';
  end if;

  insert into public.reel_reports (reel_id, reporter_id, reason)
  values (target_reel_id, reporter, reason)
  on conflict (reel_id, reporter_id) do update
    set reason = excluded.reason;

  select count(*)::integer into report_count
  from public.reel_reports
  where reel_id = target_reel_id;

  select exists (
    select 1
    from public.reels r
    join public.profiles me on me.user_id = reporter
    where r.id = target_reel_id
      and (
        me.player_id = r.player_id
        or exists (
          select 1 from public.custodial_accounts ca
          where ca.player_id = r.player_id and ca.guardian_id = me.id
        )
        or exists (
          select 1 from public.players pl
          where pl.id = r.player_id and pl.guardian_id = me.id
        )
      )
  ) into hides_now;

  if reason in ('fake_footage', 'impersonation', 'rights') then
    hides_now := true;
  end if;

  update public.reels
  set
    is_flagged = hides_now or report_count >= 3 or coalesce(is_flagged, false),
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
    'reported_by', result.reported_by,
    'reason', reason,
    'report_count', report_count
  );
end;
$$;

create or replace function public.report_reel(target_reel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.report_reel(target_reel_id, 'unspecified');
end;
$$;

revoke all on function public.report_reel(uuid, text) from public, anon;
revoke all on function public.report_reel(uuid) from public, anon;
grant execute on function public.report_reel(uuid, text) to authenticated;
grant execute on function public.report_reel(uuid) to authenticated;


-- ===== 20261002160000_reel_account_tags.sql =====
-- Account tags on a Highlight.
-- Purpose: the uploader can mention up to 3 Tapua'i accounts. The name stays private until that
-- account confirms. Donations still follow the athlete tag (`reels.player_id`), not these mentions.
-- Depends on: public.reels, public.profiles.
-- Revised 2026-10-07 before its first application (STATE and README record not applied anywhere):
-- serialize the three-active-mention cap and return no success for an unchanged confirmation.
-- Rollback:
--   drop function if exists public.confirm_account_tag(uuid, text);
--   drop function if exists public.get_my_account_tags();
--   drop function if exists public.get_reel_account_tags(uuid);
--   drop function if exists public.tag_reel_accounts(uuid, uuid[]);
--   drop function if exists public.search_taggable_accounts(text);
--   drop table if exists public.reel_account_tags;

create table if not exists public.reel_account_tags (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (reel_id, profile_id),
  constraint reel_account_tags_status_check check (status in ('pending', 'confirmed', 'rejected'))
);

create index if not exists reel_account_tags_profile_idx
  on public.reel_account_tags (profile_id, status);

alter table public.reel_account_tags enable row level security;

drop policy if exists "Public read confirmed account tags" on public.reel_account_tags;
create policy "Public read confirmed account tags"
  on public.reel_account_tags for select
  to anon, authenticated
  using (status = 'confirmed');

drop policy if exists "Tagged account and uploader read their tags" on public.reel_account_tags;
create policy "Tagged account and uploader read their tags"
  on public.reel_account_tags for select
  to authenticated
  using (
    profile_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
    or exists (
      select 1 from public.reels r
      where r.id = reel_account_tags.reel_id
        and r.uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
    )
  );

revoke all on table public.reel_account_tags from public, anon, authenticated;
grant select on table public.reel_account_tags to anon, authenticated;

create or replace function public.account_tag_label(target public.profiles)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(btrim(target.username), ''),
    nullif(split_part(btrim(coalesce(target.full_name, '')), ' ', 1), ''),
    'Account'
  );
$$;

create or replace function public.search_taggable_accounts(search_query text)
returns table (id uuid, label text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, public.account_tag_label(p) as label
  from public.profiles p
  where auth.uid() is not null
    and char_length(btrim(coalesce(search_query, ''))) >= 2
    and (
      p.username ilike '%' || btrim(search_query) || '%'
      or p.full_name ilike '%' || btrim(search_query) || '%'
    )
  order by p.username nulls last
  limit 8;
$$;

create or replace function public.tag_reel_accounts(target_reel_id uuid, profile_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  added integer := 0;
  next_id uuid;
begin
  if auth.uid() is null or target_reel_id is null then
    raise exception 'Sign in before tagging accounts' using errcode = '42501';
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then
    raise exception 'An account is required to tag accounts' using errcode = '42501';
  end if;
  -- Lock the owned reel before counting: concurrent calls cannot each consume the last slot.
  perform 1 from public.reels r
  where r.id = target_reel_id and r.uploaded_by = actor
  for update;
  if not found then
    raise exception 'Only the uploader may tag accounts on this Highlight' using errcode = '42501';
  end if;

  foreach next_id in array coalesce(profile_ids, '{}'::uuid[])
  loop
    exit when (
      select count(*) from public.reel_account_tags t
      where t.reel_id = target_reel_id and t.status <> 'rejected'
    ) >= 3;
    insert into public.reel_account_tags (reel_id, profile_id, status)
    values (target_reel_id, next_id, 'pending')
    on conflict (reel_id, profile_id) do nothing;
    if found then
      added := added + 1;
    end if;
  end loop;
  return added;
end;
$$;

create or replace function public.get_reel_account_tags(target_reel_id uuid)
returns table (id uuid, profile_id uuid, label text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.profile_id, public.account_tag_label(p), t.status
  from public.reel_account_tags t
  join public.profiles p on p.id = t.profile_id
  where t.reel_id = target_reel_id
    and (
      t.status = 'confirmed'
      or (
        auth.uid() is not null
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.reels r
            join public.profiles me on me.id = r.uploaded_by
            where r.id = t.reel_id and me.user_id = auth.uid()
          )
        )
      )
    )
  order by t.created_at;
$$;

create or replace function public.get_my_account_tags()
returns table (id uuid, reel_id uuid, reel_title text, label text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.reel_id, coalesce(nullif(btrim(r.title), ''), 'Highlight'), public.account_tag_label(p), t.status
  from public.reel_account_tags t
  join public.profiles p on p.id = t.profile_id
  join public.reels r on r.id = t.reel_id
  where p.user_id = auth.uid()
    and t.status = 'pending'
  order by t.created_at desc;
$$;

create or replace function public.confirm_account_tag(target_tag_id uuid, tag_action text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(tag_action, '')));
  next_status text;
begin
  if auth.uid() is null then
    return null;
  end if;
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;
  next_status := case when action = 'confirm' then 'confirmed' else 'rejected' end;
  update public.reel_account_tags t
  set status = next_status
  from public.profiles p
  where t.id = target_tag_id
    and t.profile_id = p.id
    and p.user_id = auth.uid()
    and t.status = 'pending';
  -- Missing, foreign, and already answered tags must never report a fresh decision.
  if not found then
    return null;
  end if;
  return next_status;
end;
$$;

revoke all on function public.account_tag_label(public.profiles) from public, anon, authenticated;
revoke all on function public.search_taggable_accounts(text) from public, anon;
revoke all on function public.tag_reel_accounts(uuid, uuid[]) from public, anon;
revoke all on function public.get_reel_account_tags(uuid) from public;
revoke all on function public.get_my_account_tags() from public, anon;
revoke all on function public.confirm_account_tag(uuid, text) from public, anon;

grant execute on function public.search_taggable_accounts(text) to authenticated;
grant execute on function public.tag_reel_accounts(uuid, uuid[]) to authenticated;
grant execute on function public.get_reel_account_tags(uuid) to anon, authenticated;
grant execute on function public.get_my_account_tags() to authenticated;
grant execute on function public.confirm_account_tag(uuid, text) to authenticated;


-- 2026-10-07 public sport identity (supabase/migrations/20261007211500_public_profile_sport.sql).
-- Public profile sport identity so hero, Stats and Aura select the same playbook.
-- Design: docs/engineering/ARCHITECTURE.md (Profile sports and section navigation).
-- Append a nullable identity column; preserve the existing view order, grants and privacy cases.
-- Rollback: restore the prior profiles_public SELECT without athlete_sport via a maintenance-window
-- drop/create (Postgres cannot remove a view column with CREATE OR REPLACE); regrant anon/auth SELECT.
-- No base-table permission changes and no career/stat/financial fields are added.
begin;

create or replace view public.profiles_public as
select
  pr.id,
  pr.user_id,
  pr.player_id,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  pr.is_verified,
  pr.is_verified_athlete,
  coalesce((pr.profile_visibility->>'school')::boolean, true) as school_visible,
  case
    when coalesce((pr.profile_visibility->>'bio')::boolean, true) then pr.bio
    when pr.user_id = auth.uid() then pr.bio
    when public.current_user_role() = 'admin' then pr.bio
    else null
  end as bio,
  case
    when coalesce((pr.profile_visibility->>'social_links')::boolean, true) then pr.social_links
    when pr.user_id = auth.uid() then pr.social_links
    when public.current_user_role() = 'admin' then pr.social_links
    else '{}'::jsonb
  end as social_links,
  -- Sport is public athlete identity; private bio/social/stat rules stay in their existing predicates.
  case when pr.player_id is not null and (pr.role = 'athlete' or 'athlete' = any(coalesce(pr.roles, '{}'::text[])))
    then nullif(btrim(pr.athlete_sport), '') else null end as athlete_sport
from public.profiles pr;

grant select on public.profiles_public to anon, authenticated;

commit;


-- =============================================================================
-- 2026-10-07 photo stories in Highlights (WORK_QUEUE UX-05).
-- Source: supabase/migrations/20261007230000_photo_stories.sql
-- Written, not applied anywhere. Design: docs/engineering/design/PHOTO_STORIES_DESIGN.md.
-- This copy is the newest definition of reels_feed, get_pending_player_tags, get_spotlight_standings,
-- get_active_spotlight_award, publish_spotlight_award and reels_filmer_rewards (supersedes the
-- earlier blocks above).
-- =============================================================================
-- Photo stories in Highlights ⚡ (WORK_QUEUE UX-05, schema slice; QA fixes UX-05a).
-- Purpose: a Highlight can be one photo or a swipeable story of up to 10 photos instead of a clip.
--   reels.media_type ('video' | 'photo_story') and reels.photo_count describe the post; the photos
--   live in public.reel_photos as Storage object PATHS in the public `reels` bucket (never URLs —
--   the client builds the URL with supabase.storage.from('reels').getPublicUrl(path)). Photos are
--   written only through set_reel_photos, once per story, so count, order, ownership and path are
--   checked in the database. The reel row itself is inserted exactly like a video (same insert
--   policy, triggers, rights attestation and tag status); a photo story stores video_url = ''.
--   A story is public only (constraint reels_photo_story_public_check) and is "unpublished" until
--   its photos are saved (media_type = 'photo_story' and photo_count = 0): the pending-tag queue
--   and filmer rewards skip it. Spotlight features videos only for now.
--   Fans read photos through reel_photos_feed, which gates image_path with the same rule reels_feed
--   uses for video_url. reels_feed gains media_type, photo_count and cover_path (position-0 photo,
--   same gate), appended after the existing columns. The public `reels` Storage bucket also
--   accepts image/jpeg so the photos can be uploaded.
-- Design: docs/engineering/design/PHOTO_STORIES_DESIGN.md ("Data model").
-- Depends on: public.reels (is_removed, is_vault_only, is_exclusive, flash_unlock_until,
--   uploaded_by, tag_*, view_count from supabase/leaderboards.sql), public.profiles,
--   public.players, public.subscriptions, public.spotlight_awards, public.current_user_role(),
--   public.can_confirm_player_tag(), public.athlete_is_varsity_verified(),
--   public.spotlight_window(), public.spotlight_normalize_kind(), public.sync_live_spotlight_awards(),
--   public.reel_filmer_profile_id() / award_filmer_aura() (20260929170000_filmer_rewards.sql),
--   storage.buckets row 'reels', and reels_feed as last defined by
--   20260929160000_reel_views_and_filmer_credit.sql (re-stated below with three columns appended).
-- Status: written 2026-10-07, not applied anywhere, never parsed by Postgres.
--
-- Re-stated functions (each copied from its current, only definition in
-- apps/mobile/src/backend/db/schema.sql, with the photo-story filter as the only change; signatures,
-- return types and grants are unchanged, so create or replace keeps the existing ACLs):
--   get_pending_player_tags()             schema.sql line 1759 — skips unpublished stories.
--   get_spotlight_standings(text)         schema.sql line 1816 — videos only (hype total + clip picks).
--   get_active_spotlight_award(uuid)      schema.sql line 2365 — ignores a story as the award clip.
--   publish_spotlight_award(uuid, text, text, date, date)
--                                         schema.sql line 2544 — picks a video as the award clip.
--   reels_filmer_rewards() trigger fn     schema.sql line 8905 — no Aura for an unpublished story.
--   (sync_spotlight_period reads get_spotlight_standings, so it needs no change.)
--
-- Rollback (in this order — reels_feed references reel_photos and the new columns):
--   drop view if exists public.reel_photos_feed;
--   drop view if exists public.reels_feed;
--   -- re-create reels_feed from the 20260929160000_reel_views_and_filmer_credit.sql definition
--   -- (schema.sql line 8692; create or replace cannot remove columns), then:
--   -- grant select on public.reels_feed to anon, authenticated;
--   -- re-create from the previous definitions: get_pending_player_tags (schema.sql line 1759),
--   -- get_spotlight_standings (line 1816), get_active_spotlight_award (line 2365),
--   -- publish_spotlight_award (line 2544), reels_filmer_rewards (line 8905) — create or replace
--   -- is enough; the filters below reference media_type / photo_count, so do this before
--   -- dropping the columns.
--   drop function if exists public.set_reel_photos(uuid, jsonb);
--   drop table if exists public.reel_photos;
--   drop trigger if exists reels_reset_photo_count on public.reels;
--   drop function if exists public.reels_reset_photo_count();
--   alter table public.reels drop constraint if exists reels_photo_story_public_check;
--   alter table public.reels drop constraint if exists reels_photo_count_check;
--   alter table public.reels drop constraint if exists reels_media_type_check;
--   alter table public.reels drop column if exists photo_count;
--   alter table public.reels drop column if exists media_type;
--   update storage.buckets set allowed_mime_types = array_remove(allowed_mime_types, 'image/jpeg')
--     where id = 'reels';
begin;

-- 1. What kind of Highlight a reel is. Existing rows default to video, so nothing else changes.
alter table public.reels add column if not exists media_type text not null default 'video';
alter table public.reels add column if not exists photo_count smallint not null default 0;

alter table public.reels drop constraint if exists reels_media_type_check;
alter table public.reels
  add constraint reels_media_type_check check (media_type in ('video', 'photo_story'));

alter table public.reels drop constraint if exists reels_photo_count_check;
alter table public.reels
  add constraint reels_photo_count_check check (photo_count between 0 and 10);

-- Photo stories are public only in v1 (design decision 1; paid photos wait for the private Vault
-- bucket). Enforced on the row, so toggle_reel_vault_status and the client column UPDATE grant on
-- is_vault_only / is_exclusive both fail for a story instead of relying on the hidden toggle.
alter table public.reels drop constraint if exists reels_photo_story_public_check;
alter table public.reels
  add constraint reels_photo_story_public_check check (
    coalesce(media_type, 'video') <> 'photo_story'
    or (not coalesce(is_vault_only, false) and not coalesce(is_exclusive, false))
  );

-- media_type and photo_count are deliberately NOT added to the reels column UPDATE grant: a
-- published video cannot become a story, and only set_reel_photos moves the count. The table-wide
-- INSERT grant would still let a client insert a fake count, so this trigger zeroes it on every
-- insert. set_reel_photos sets the real count afterwards with an UPDATE, which this trigger ignores.
create or replace function public.reels_reset_photo_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.photo_count := 0;
  return NEW;
end;
$$;

drop trigger if exists reels_reset_photo_count on public.reels;
create trigger reels_reset_photo_count
  before insert on public.reels
  for each row
  execute procedure public.reels_reset_photo_count();

-- 2. The photos of a story, in order (position 0 = cover). image_path is the object path inside
-- the `reels` bucket ({uid}/stories/{reel_id}/{position}-{ms}.jpg), not a URL, so the database
-- never stores or trusts a host.
create table if not exists public.reel_photos (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  image_path text not null check (char_length(image_path) between 1 and 300),
  description text check (description is null or char_length(description) <= 200),
  width integer, height integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reel_id, position)
);

alter table public.reel_photos enable row level security;

-- Who may read the base table: the story's uploader (reading back their own rows) and admins.
-- Mirrors "Read own or admin reels"; fans and guests read reel_photos_feed instead.
drop policy if exists "Read own or admin reel photos" on public.reel_photos;
create policy "Read own or admin reel photos" on public.reel_photos
  for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    or exists (
      select 1 from public.reels r
      where r.id = reel_photos.reel_id
        and r.uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
    )
  );

-- No client insert/update/delete: Supabase's default privileges would otherwise grant them.
revoke all on table public.reel_photos from public, anon, authenticated;
grant select on table public.reel_photos to authenticated;

-- 3. The only writer. Callable by a signed-in uploader for their own, not-removed photo story,
-- ONCE: v1 has no edit screen, so a story whose photo_count is already set is refused. A failed
-- call rolls back and leaves photo_count at 0, so the client can retry until one call succeeds.
-- Saves the list in array order (position 0..n-1), sets reels.photo_count and returns the count.
create or replace function public.set_reel_photos(p_reel_id uuid, p_photos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  story public.reels%rowtype;
  path_pattern text;
  photo_total integer;
  item jsonb;
  item_ordinal bigint;
  next_path text;
  next_description text;
  next_width integer;
  next_height integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before adding photos' using errcode = '42501';
  end if;
  if p_reel_id is null then
    raise exception 'Pick a photo story first' using errcode = '22023';
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then
    raise exception 'An account is required to add photos' using errcode = '42501';
  end if;

  -- Lock the owned reel: two saves of the same story cannot both pass the publish-once check.
  select r.* into story
  from public.reels r
  where r.id = p_reel_id and r.uploaded_by = actor
  for update;
  if not found then
    raise exception 'Only the uploader may change this photo story' using errcode = '42501';
  end if;
  if story.media_type is distinct from 'photo_story' then
    raise exception 'This Highlight is not a photo story' using errcode = '22023';
  end if;
  if coalesce(story.is_removed, false) then
    raise exception 'This Highlight was removed' using errcode = '42501';
  end if;
  if coalesce(story.photo_count, 0) <> 0 then
    raise exception 'This photo story is already published' using errcode = '55000';
  end if;

  if p_photos is null or jsonb_typeof(p_photos) <> 'array' then
    raise exception 'Photos must be a list' using errcode = '22023';
  end if;
  photo_total := jsonb_array_length(p_photos);
  if photo_total < 1 or photo_total > 10 then
    raise exception 'A photo story holds 1 to 10 photos' using errcode = '22023';
  end if;

  -- Each photo must be the caller's own upload for THIS story, in the exact layout
  -- MediaUploadService.uploadStoryPhoto writes: {uid}/stories/{reel_id}/{position}-{ms}.jpg.
  -- Anchored at both ends, so no host, '..', '%', query string or other folder can slip in.
  -- uuid text is hex digits and '-', which carry no regex meaning; [.] is a literal dot without
  -- depending on standard_conforming_strings for a backslash escape.
  path_pattern := '^' || auth.uid()::text || '/stories/' || p_reel_id::text
    || '/[0-9]{1,2}-[0-9]{10,16}[.]jpg$';

  -- Rows can only exist here if an older build saved them; the count check above already proved
  -- the story is unpublished. Any exception below aborts the whole call.
  delete from public.reel_photos where reel_id = p_reel_id;

  for item, item_ordinal in
    select e.value, e.ordinality
    from jsonb_array_elements(p_photos) with ordinality as e(value, ordinality)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Photo % is not valid', item_ordinal using errcode = '22023';
    end if;

    if jsonb_typeof(item -> 'image_path') is distinct from 'string' then
      raise exception 'Photo % has no image', item_ordinal using errcode = '22023';
    end if;
    next_path := item ->> 'image_path';
    if char_length(next_path) not between 1 and 300 or next_path !~ path_pattern then
      raise exception 'Photo % must be uploaded from your account for this story', item_ordinal
        using errcode = '42501';
    end if;

    next_description := null;
    if item ? 'description' and jsonb_typeof(item -> 'description') <> 'null' then
      if jsonb_typeof(item -> 'description') <> 'string' then
        raise exception 'Photo % description must be text', item_ordinal using errcode = '22023';
      end if;
      next_description := nullif(btrim(item ->> 'description'), '');
      if next_description is not null and char_length(next_description) > 200 then
        raise exception 'Photo % description is over 200 characters', item_ordinal
          using errcode = '22023';
      end if;
    end if;

    -- Dimensions are layout hints from the picker: whole pixels, rounded if a platform sends a
    -- fraction; anything else is rejected rather than stored as a misleading size.
    next_width := null;
    if item ? 'width' and jsonb_typeof(item -> 'width') <> 'null' then
      if jsonb_typeof(item -> 'width') <> 'number' then
        raise exception 'Photo % width is not valid', item_ordinal using errcode = '22023';
      end if;
      if (item ->> 'width')::numeric not between 1 and 100000 then
        raise exception 'Photo % width is not valid', item_ordinal using errcode = '22023';
      end if;
      next_width := round((item ->> 'width')::numeric)::integer;
    end if;

    next_height := null;
    if item ? 'height' and jsonb_typeof(item -> 'height') <> 'null' then
      if jsonb_typeof(item -> 'height') <> 'number' then
        raise exception 'Photo % height is not valid', item_ordinal using errcode = '22023';
      end if;
      if (item ->> 'height')::numeric not between 1 and 100000 then
        raise exception 'Photo % height is not valid', item_ordinal using errcode = '22023';
      end if;
      next_height := round((item ->> 'height')::numeric)::integer;
    end if;

    insert into public.reel_photos (reel_id, position, image_path, description, width, height)
    values (p_reel_id, (item_ordinal - 1)::smallint, next_path, next_description, next_width, next_height);
  end loop;

  update public.reels set photo_count = photo_total where id = p_reel_id;

  return photo_total;
end;
$$;

revoke all on function public.set_reel_photos(uuid, jsonb) from public, anon;
grant execute on function public.set_reel_photos(uuid, jsonb) to authenticated;

-- 4. Fan-facing read path for story photos (guests included). image_path uses the exact
-- entitlement rule reels_feed applies to video_url (unlocked / Flash-Unlocked now / admin /
-- uploader / active subscriber), returning '' otherwise. Removed Highlights are excluded.
-- Not security_invoker, so it reads the base tables as the view owner, like reels_feed.
create or replace view public.reel_photos_feed as
select
  ph.id,
  ph.reel_id,
  ph.position,
  ph.description,
  ph.width,
  ph.height,
  case
    when coalesce(r.is_vault_only, false) = false then ph.image_path
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
    when public.current_user_role() = 'admin' then ph.image_path
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then ph.image_path
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then ph.image_path
    else ''
  end as image_path
from public.reel_photos ph
join public.reels r on r.id = ph.reel_id
where coalesce(r.is_removed, false) = false;

-- Read-only: drop the default view privileges before granting select.
revoke all on public.reel_photos_feed from public, anon, authenticated;
grant select on public.reel_photos_feed to anon, authenticated;

-- 5. reels_feed: the 20260929160000 definition unchanged and in order, plus media_type,
-- photo_count and cover_path appended (create or replace can only add columns at the end).
-- cover_path is the position-0 photo's Storage path behind the same gate as video_url; null for
-- videos and for a story whose photos are not saved yet.
create or replace view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url,
  coalesce(r.view_count, 0) as view_count,
  -- Handle first, else first name only: the clip credit never shows a fan's full name.
  -- Null when the tagged athlete posted it themself (no "Filmed by" on your own clip).
  case
    when r.player_id is not null and up.player_id = r.player_id then null
    else coalesce(
      nullif(btrim(up.username), ''),
      nullif(split_part(btrim(coalesce(up.full_name, '')), ' ', 1), '')
    )
  end as uploader_name,
  up.avatar_url as uploader_avatar_url,
  r.media_type,
  r.photo_count,
  (
    select case
      when coalesce(r.is_vault_only, false) = false then ph.image_path
      when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
      when public.current_user_role() = 'admin' then ph.image_path
      when auth.uid() is not null and r.uploaded_by = (
        select p.id from public.profiles p where p.user_id = auth.uid() limit 1
      ) then ph.image_path
      when auth.uid() is not null and r.player_id is not null and exists (
        select 1 from public.subscriptions s
        where s.subscriber_id = auth.uid()
          and s.athlete_id = r.player_id
          and s.status = 'active'
      ) then ph.image_path
      else ''
    end
    from public.reel_photos ph
    where ph.reel_id = r.id and ph.position = 0
  ) as cover_path
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;

grant select on public.reels_feed to anon, authenticated;

-- 6. Storage: story photos upload to the public `reels` bucket as JPEG
-- ({uid}/stories/{reel_id}/{position}-{ms}.jpg, MediaUploadService.uploadStoryPhoto), but that
-- bucket's allow-list was video-only, so Storage would refuse every photo. Add image/jpeg only
-- (the client re-encodes every photo to JPEG and strips its metadata first) and keep the video
-- types. A null allow-list already accepts everything, so it is left alone.
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['image/jpeg']
where id = 'reels'
  and allowed_mime_types is not null
  and not ('image/jpeg' = any (allowed_mime_types));

-- 7. Unpublished stories stay out of the tag-confirmation queue (an athlete would be asked to
-- confirm a post with no photos). Re-stated from schema.sql line 1759; only the filter is new.
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
    and not (coalesce(r.media_type, 'video') = 'photo_story' and coalesce(r.photo_count, 0) = 0)
    and (
      -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass alongside
      -- `can_confirm_player_tag`'s matching fix, above.
      role_name = 'admin'
      or public.can_confirm_player_tag(r.player_id)
    )
  order by r.created_at desc
  limit 40;
end;
$$;

-- 8. Spotlight features videos only for now: a story neither adds to the weekly hype total nor
-- becomes the award clip. Re-stated from schema.sql line 1816; only the media_type filters are new.
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
            and coalesce(hot.media_type, 'video') = 'video'
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
            and coalesce(hot.media_type, 'video') = 'video'
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
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as shot_by,
        max(r.created_at) as created_at
      from public.reels r
      join public.players p on p.id = r.player_id
      where r.tag_status = 'confirmed'
        and public.athlete_is_varsity_verified(p.id)
        and coalesce(r.is_removed, false) = false
        and coalesce(r.is_vault_only, false) = false
        and coalesce(r.is_flagged, false) = false
        and coalesce(r.category, 'game_play') = 'game_play'
        and coalesce(r.media_type, 'video') = 'video'
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

-- 9. Award card clip: ignore a stored photo-story clip and fall back to the athlete's top video.
-- Re-stated from schema.sql line 2365; only the media_type guard and filter are new.
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
  if clip_id is not null and exists (
    select 1 from public.reels r where r.id = clip_id and coalesce(r.media_type, 'video') <> 'video'
  ) then
    clip_id := null;
  end if;
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
      and coalesce(r.media_type, 'video') = 'video'
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

-- 10. Admin-published award picks the athlete's top video, never a story.
-- Re-stated from schema.sql line 2544; only the media_type filter is new.
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
  -- 2026-09 audit: dropped the `auth.role() <> 'anon'` bypass — this is an admin-only Spotlight
  -- desk action (`/admin/spotlight`), not part of the anon operator-PIN sideline flow.
  if public.current_user_role() <> 'admin' then
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
    and coalesce(r.media_type, 'video') = 'video'
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

-- 11. Filmer rewards: no Aura for a story until its photos are saved. Re-stated from schema.sql
-- line 8905; only the unpublished-story guard is new. (The trigger fires on tag_status /
-- view_count updates, so a story confirmed before publishing earns on its next counted view.)
create or replace function public.reels_filmer_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  filmer uuid;
  milestone record;
begin
  if new.tag_status is distinct from 'confirmed'
    or new.uploaded_by is null
    or coalesce(new.is_removed, false)
    or (coalesce(new.media_type, 'video') = 'photo_story' and coalesce(new.photo_count, 0) = 0)
  then
    return new;
  end if;
  filmer := public.reel_filmer_profile_id(new.id);
  if filmer is null then
    return new;
  end if;

  perform public.award_filmer_aura(filmer, new.id, 'tag_confirmed', 'tag:' || new.id, 10);

  for milestone in
    select * from (values (100, 10), (1000, 50), (10000, 200)) as m (views, points)
  loop
    if coalesce(new.view_count, 0) >= milestone.views then
      perform public.award_filmer_aura(
        filmer, new.id, 'views_milestone', 'views:' || milestone.views || ':' || new.id, milestone.points
      );
    end if;
  end loop;

  return new;
end;
$$;

commit;


-- =============================================================================
-- 2026-10-07 reels bucket writes limited to the caller's own folder (WORK_QUEUE UX-05a).
-- Source: supabase/migrations/20261007231000_reels_storage_owner_folder.sql
-- Written, not applied anywhere. Supersedes the "Public upload reels bucket" / "Public update reels
-- bucket" policies in the Storage block above.
-- =============================================================================
-- Reels bucket: signed-in users may write only inside their own folder (WORK_QUEUE UX-05a).
-- Purpose: the `reels` Storage INSERT / UPDATE policies only checked the bucket and that the caller
--   was signed in. Uploads use `upsert: true`, so any account could overwrite another account's
--   public Highlight video or photo-story photo (often images of minors) at the same object path.
--   Both policies now also require the path to sit in the caller's own folder.
-- Writers audited 2026-10-07 (the only code that writes to `reels`; Edge Functions, the admin portal
--   and app routes do not upload):
--   * MediaUploadService.uploadHighlight (public video): object `reels/{auth.uid}/{ms}.mp4` — note
--     the literal `reels/` prefix inside the bucket, so folder[1] = 'reels', folder[2] = uid.
--   * MediaUploadService.uploadStoryPhoto (photo story): object `{auth.uid}/stories/{reel_id}/{n}-{ms}.jpg`,
--     folder[1] = uid.
--   Both layouts are allowed so neither writer breaks. Vault clips go to `reel_vault` and avatars to
--   `avatars` (not touched here); the `game_highlights` fallback bucket keeps its bucket-only policy.
-- Design: docs/engineering/design/PHOTO_STORIES_DESIGN.md ("Privacy and safety");
--   docs/engineering/SCHEMA.md (Storage — `reels`).
-- Depends on: Supabase Storage (storage.objects, storage.foldername) and the two policies created in
--   schema.sql's Storage block ("Public upload reels bucket", "Public update reels bucket").
--   Independent of 20261007230000_photo_stories.sql; apply either first.
-- Status: written 2026-10-07, not applied anywhere, never parsed by Postgres.
--
-- Rollback (restores the previous bucket-only policies):
--   drop policy if exists "Public upload reels bucket" on storage.objects;
--   create policy "Public upload reels bucket" on storage.objects for insert
--     with check (bucket_id = 'reels' and auth.role() = 'authenticated');
--   drop policy if exists "Public update reels bucket" on storage.objects;
--   create policy "Public update reels bucket" on storage.objects for update
--     using (bucket_id = 'reels' and auth.role() = 'authenticated')
--     with check (bucket_id = 'reels' and auth.role() = 'authenticated');
begin;

-- Who may upload: a signed-in user, into `{uid}/...` or the video layout `reels/{uid}/...`.
drop policy if exists "Public upload reels bucket" on storage.objects;
create policy "Public upload reels bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'reels'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reels'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- Who may overwrite (upsert): the same owner, for an object already in their folder and staying there.
drop policy if exists "Public update reels bucket" on storage.objects;
create policy "Public update reels bucket"
  on storage.objects for update
  using (
    bucket_id = 'reels'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reels'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'reels'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reels'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

commit;


-- =============================================================================
-- 2026-10-12 Books: chart of accounts, recorded entries, month closes and reopens, covered card fee
-- and PaymentIntent id on donations, server-owned payout paid date (BOOKS-01 / BOOKS-02).
-- Source: supabase/migrations/20261012210000_bookkeeping_ledger.sql (revised 2026-10-13 after
-- RLS_SECURITY and CONTROLLER/TAX review; replayed 72/72 on PGlite / Postgres 18.6).
-- Written, not applied anywhere. Design: docs/engineering/design/BOOKKEEPING.md.
-- =============================================================================
begin;

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

commit;


-- =============================================================================
-- 2026-10-13 Data governance closures (DATA-01 F1–F5): writers for athlete stats, Crew alert clearing,
-- operator check-in reader and retention purge (direct table reads closed), school confirmer list
-- (token hash no longer granted), get_aura_tier archived.
-- Source: supabase/migrations/20261013120000_data_governance_closures.sql (replayed 40/40 on PGlite after
-- RLS_SECURITY review). Written, not applied anywhere. Handbook: docs/engineering/DATA_GOVERNANCE.md.
-- =============================================================================
begin;

-- Data governance closures (DATA-01, findings F1–F5): give every orphaned table and function a real
-- reader, writer or caller, and archive the one function nothing needs.
--
-- Purpose
--   F1  athlete_career_stats / athlete_game_logs were read on profiles but nothing in the app wrote them.
--       admin_upsert_athlete_career_stats, admin_add_athlete_game_log, admin_remove_athlete_game_log
--       are the writers (Athletes desk → Stats).
--   F2  crew_push_queue was filled by set_reel_flash_unlock and never read or cleared. Fans already read
--       their own rows (policy "Users read own crew push"); Activity now shows them, and
--       clear_my_crew_alerts() removes all of the caller's alerts and, as housekeeping, any alert older
--       than 30 days for anyone, so fans who never press Clear do not keep alerts forever.
--   F3  operator_checkins stored exact GPS that nothing read. PRIVACY_ENGINEERING decision 2026-10-13: there
--       is no current purpose (paid gigs are Wave 3) and operators may be minors, so keep as little as
--       possible: a before-insert trigger rounds location to two decimals (about 1 km) and sets the time on
--       the server, and check-ins older than 30 days are removed automatically (on every insert and every
--       admin read; no pg_cron needed). One function, expire_operator_checkins, holds the delete rule for the
--       trigger, admin_list_operator_checkins and admin_purge_operator_checkins (Live games desk, manual
--       purge with a 7-day floor). Direct table reads are closed (RLS_SECURITY review 2026-10-13): clients
--       keep INSERT only, through an insert-only policy that supersedes "Operators write checkins"
--       (20261002120000).
--   F4  admin_list_school_confirmers lets the Schools desk show confirmers (never the token hash) so the
--       existing admin_add / admin_revoke_school_confirmer and admin_set_school_branding get an admin
--       control; admin_revoke_verification and admin_set_custodial_terms get controls in People and
--       Athletes without SQL changes.
--   F5  get_aura_tier(integer) is never called (the app computes tiers in lib/aura). Archived: its
--       definition is kept in archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql and the function is dropped here.
--
-- Owner: DATA_GOVERNANCE (DATA-01), owner approval 2026-10-13 ("go all the way … archive as wanted").
--   Owners of each fix: ATHLETE_STATS (F1), NOTIFICATIONS (F2), OPERATOR + PRIVACY_ENGINEERING (F3),
--   SCHOOL_PARTNERS / ATHLETE_VERIFICATION / CUSTODIAL (F4), AURA (F5).
--
-- Security: every function is security definer with an empty search_path and schema-qualified names.
--   Admin functions call require_admin_guard() first; clear_my_crew_alerts clears the caller's rows and
--   alerts older than 30 days. EXECUTE is revoked from public and anon and granted to authenticated.
--   Table grants narrowed: operator_checkins loses client SELECT / UPDATE / DELETE (insert-only policy);
--   school_confirmers SELECT becomes column-level without token_hash (admins read through the RPC).
--
-- Safe to re-run: create or replace; drop function if exists.
--
-- Applied: written 2026-10-13, not applied anywhere.
--
-- Rollback:
--   drop function if exists public.admin_upsert_athlete_career_stats(uuid, text, integer, integer, integer, integer),
--     public.admin_add_athlete_game_log(uuid, date, text, text, integer, integer),
--     public.admin_remove_athlete_game_log(uuid), public.clear_my_crew_alerts(),
--     public.admin_list_operator_checkins(integer), public.admin_purge_operator_checkins(integer),
--     public.admin_list_school_confirmers(uuid);
--   drop trigger if exists operator_checkins_minimize on public.operator_checkins;
--   drop function if exists public.operator_checkins_minimize(), public.expire_operator_checkins(integer);
--   drop index if exists public.operator_checkins_checked_in_at_idx;
--   (rounded coordinates and check-ins already removed cannot be restored)
--   restore get_aura_tier from archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql;
--   grant select, insert on public.operator_checkins to anon, authenticated; drop policy "Operators insert checkins"
--   and re-run 20261002120000; grant select on public.school_confirmers to authenticated.
--   Before applying, confirm no hosted-only function calls get_aura_tier:
--   select proname from pg_proc where prosrc ilike '%get_aura_tier%';

do $$
begin
  if to_regprocedure('public.require_admin_guard()') is null then
    raise exception 'Apply the 2026-09 audit section of schema.sql first (require_admin_guard is missing).';
  end if;
end $$;

-- F1 ------------------------------------------------------------------------------------------

create or replace function public.admin_upsert_athlete_career_stats(
  p_player_id uuid,
  p_sport text,
  p_games_played integer,
  p_scoring_value integer,
  p_volume_value integer,
  p_mvp_badges integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Choose an athlete.';
  end if;
  if char_length(btrim(coalesce(p_sport, ''))) not between 2 and 40 then raise exception 'Name the sport.'; end if;
  if least(coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0)) < 0
     or greatest(coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0)) > 100000 then
    raise exception 'Stats must be between 0 and 100,000.';
  end if;
  insert into public.athlete_career_stats (player_id, sport, games_played, scoring_value, volume_value, mvp_badges, updated_at)
  values (p_player_id, btrim(p_sport), coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0), now())
  on conflict (player_id) do update set
    sport = excluded.sport, games_played = excluded.games_played, scoring_value = excluded.scoring_value,
    volume_value = excluded.volume_value, mvp_badges = excluded.mvp_badges, updated_at = now();
end;
$$;

create or replace function public.admin_add_athlete_game_log(
  p_player_id uuid,
  p_played_on date,
  p_opponent_school text,
  p_stat_line text,
  p_scoring_value integer,
  p_volume_value integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  log_id uuid;
begin
  perform public.require_admin_guard();
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Choose an athlete.';
  end if;
  if p_played_on is null or p_played_on > current_date or p_played_on < date '2000-01-01' then
    raise exception 'Choose the game date (not in the future).';
  end if;
  if char_length(coalesce(p_stat_line, '')) > 120 or char_length(coalesce(p_opponent_school, '')) > 120 then
    raise exception 'Keep the opponent and stat line under 120 characters.';
  end if;
  if least(coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0)) < 0 or greatest(coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0)) > 10000 then
    raise exception 'Game stats must be between 0 and 10,000.';
  end if;
  insert into public.athlete_game_logs (player_id, played_on, opponent_school, stat_line, scoring_value, volume_value)
  values (p_player_id, p_played_on, btrim(coalesce(p_opponent_school, '')), btrim(coalesce(p_stat_line, '')), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0))
  returning id into log_id;
  return log_id;
end;
$$;

-- Removing a mistaken game line is a correction an admin makes from the Athletes desk.
create or replace function public.admin_remove_athlete_game_log(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  delete from public.athlete_game_logs where id = p_log_id;
  if not found then raise exception 'That game line no longer exists.'; end if;
end;
$$;

-- F2 ------------------------------------------------------------------------------------------

create or replace function public.clear_my_crew_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleared integer;
begin
  if auth.uid() is null then raise exception 'Sign in to clear alerts.'; end if;
  delete from public.crew_push_queue where recipient_id = auth.uid();
  get diagnostics cleared = row_count;
  -- Housekeeping: nobody's alerts outlive 30 days, including fans who never press Clear.
  delete from public.crew_push_queue where created_at < now() - interval '30 days';
  return cleared;
end;
$$;

-- F3 ------------------------------------------------------------------------------------------

-- The one retention rule. Never shorter than 7 days, so a mistyped purge cannot wipe today's check-ins.
create or replace function public.expire_operator_checkins(p_older_than_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged integer;
begin
  delete from public.operator_checkins
  where checked_in_at < now() - make_interval(days => greatest(coalesce(p_older_than_days, 30), 7));
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Exact GPS never reaches storage, a client cannot pick a timestamp that dodges expiry, and every insert
-- clears expired rows.
create or replace function public.operator_checkins_minimize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.latitude := round(new.latitude::numeric, 2)::double precision;
  new.longitude := round(new.longitude::numeric, 2)::double precision;
  new.checked_in_at := now();
  perform public.expire_operator_checkins();
  return new;
end;
$$;

drop trigger if exists operator_checkins_minimize on public.operator_checkins;
create trigger operator_checkins_minimize
  before insert on public.operator_checkins
  for each row execute function public.operator_checkins_minimize();

create index if not exists operator_checkins_checked_in_at_idx on public.operator_checkins (checked_in_at);

-- Rows stored before this migration get the same treatment.
update public.operator_checkins
set latitude = round(latitude::numeric, 2)::double precision,
  longitude = round(longitude::numeric, 2)::double precision,
  checked_in_at = least(checked_in_at, now());
select public.expire_operator_checkins();

-- Reading also expires, so old check-ins are gone even when no new ones arrive.
create or replace function public.admin_list_operator_checkins(p_limit integer default 50)
returns table (id uuid, gig_id uuid, checked_in_at timestamptz, latitude_approx numeric, longitude_approx numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  perform public.expire_operator_checkins();
  return query
    select c.id, c.gig_id, c.checked_in_at,
      round(c.latitude::numeric, 2), round(c.longitude::numeric, 2)
    from public.operator_checkins c
    order by c.checked_in_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create or replace function public.admin_purge_operator_checkins(p_older_than_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  if coalesce(p_older_than_days, 0) < 7 then raise exception 'Keep at least 7 days of check-ins.'; end if;
  return public.expire_operator_checkins(p_older_than_days);
end;
$$;

-- Exact coordinates are readable by no client: INSERT stays (operator PIN / operator / admin), reads go
-- through admin_list_operator_checkins only.
revoke select, update, delete on public.operator_checkins from anon, authenticated;
drop policy if exists "Operators write checkins" on public.operator_checkins;
drop policy if exists "Operators insert checkins" on public.operator_checkins;
create policy "Operators insert checkins" on public.operator_checkins
  for insert to anon, authenticated
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));

-- F4 ------------------------------------------------------------------------------------------

-- Admins read confirmers through admin_list_school_confirmers; the table grant no longer includes the
-- token hash.
revoke select on public.school_confirmers from authenticated;
grant select (id, school_id, full_name, email, staff_role, sport, active, expires_at, created_by, created_at, last_used_at)
  on public.school_confirmers to authenticated;

-- Confirmers for one school, without the token hash.
create or replace function public.admin_list_school_confirmers(target_school_id uuid)
returns table (id uuid, full_name text, email text, staff_role text, sport text, active boolean, expires_at timestamptz, last_used_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return query
    select c.id, c.full_name, c.email, c.staff_role, c.sport, c.active, c.expires_at, c.last_used_at
    from public.school_confirmers c
    where c.school_id = target_school_id
    order by c.active desc, c.created_at desc;
end;
$$;

-- F5 ------------------------------------------------------------------------------------------

drop function if exists public.get_aura_tier(integer);

-- Grants --------------------------------------------------------------------------------------

revoke all on function public.admin_upsert_athlete_career_stats(uuid, text, integer, integer, integer, integer) from public, anon;
revoke all on function public.admin_add_athlete_game_log(uuid, date, text, text, integer, integer) from public, anon;
revoke all on function public.admin_remove_athlete_game_log(uuid) from public, anon;
revoke all on function public.clear_my_crew_alerts() from public, anon;
revoke all on function public.admin_list_operator_checkins(integer) from public, anon;
revoke all on function public.admin_purge_operator_checkins(integer) from public, anon;
revoke all on function public.admin_list_school_confirmers(uuid) from public, anon;
-- Internal: only the trigger and the two admin functions above call these; no client may.
revoke all on function public.expire_operator_checkins(integer) from public, anon, authenticated;
revoke all on function public.operator_checkins_minimize() from public, anon, authenticated;
grant execute on function public.admin_upsert_athlete_career_stats(uuid, text, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_add_athlete_game_log(uuid, date, text, text, integer, integer) to authenticated;
grant execute on function public.admin_remove_athlete_game_log(uuid) to authenticated;
grant execute on function public.clear_my_crew_alerts() to authenticated;
grant execute on function public.admin_list_operator_checkins(integer) to authenticated;
grant execute on function public.admin_purge_operator_checkins(integer) to authenticated;
grant execute on function public.admin_list_school_confirmers(uuid) to authenticated;

commit;


-- DETECT-02: restricted support evidence, independent reviews, release provenance and atomic audit.
-- Dependencies: current_user_role(), auth.uid(), September RBAC and October bookkeeping tables.
-- Local replay only. The owner applies SQL. No financial rules or payout gates are changed.
-- Rollback: revoke RPC execution and remove source audit triggers after review; retain evidence.
-- Trust boundary: DB owners/superusers can disable triggers/change functions and recompute hashes.
-- Chains detect accidental/application tampering; they are not signed or externally anchored.

begin;

-- Fixed vocabulary keeps client reports from carrying private payloads or arbitrary diagnostic text.
create or replace function public.support_code_metadata(p_code text)
returns jsonb language sql immutable set search_path = '' as $$
  select case p_code
    when 'render_failure' then '["ui","error"]'::jsonb
    when 'runtime_failure' then '["runtime","error"]'::jsonb
    when 'unhandled_rejection' then '["runtime","error"]'::jsonb
    when 'read_timeout' then '["network","warning"]'::jsonb
    when 'network_unavailable' then '["network","warning"]'::jsonb
    when 'read_failed' then '["data","error"]'::jsonb
    when 'user_cancelled' then '["ui","info"]'::jsonb
    when 'auth_expired' then '["runtime","info"]'::jsonb
    when 'data_invalid' then '["data","error"]'::jsonb
    when 'payment_failed' then '["finance","error"]'::jsonb
    when 'access_denied' then '["security","warning"]'::jsonb
    when 'suspicious_pattern' then '["security","warning"]'::jsonb
    when 'confirmed_attack' then '["security","critical"]'::jsonb
    when 'syntax_check_failed' then '["syntax","error"]'::jsonb
    when 'user_report' then '["user_report","warning"]'::jsonb
    when 'recovery_succeeded' then '["runtime","info"]'::jsonb
    when 'recovery_failed' then '["runtime","error"]'::jsonb
    when 'auth_invalid' then '["security","warning"]'::jsonb
    when 'auth_unavailable' then '["network","error"]'::jsonb
    when 'server_configuration_error' then '["runtime","critical"]'::jsonb
  end
$$;
revoke all on function public.support_code_metadata(text) from public, anon, authenticated, service_role;

create table if not exists public.support_signals (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (char_length(fingerprint) <= 180),
  feature text not null check (feature in ('app','highlights','activity','local','spotlight','drip','profile','auth','donation','payouts','operator','upload','admin','support')),
  code text not null check (public.support_code_metadata(code) is not null),
  category text not null check (category = public.support_code_metadata(code)->>0),
  severity text not null check (severity = public.support_code_metadata(code)->>1),
  source text not null check (source in ('client','server','security','check')),
  environment text not null check (environment in ('development','test','preview','production')),
  release text not null check (release ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  check (source <> 'client' or (actor_id is not null and code not in ('confirmed_attack','syntax_check_failed','auth_invalid','auth_unavailable','server_configuration_error'))),
  check (code <> 'confirmed_attack' or source = 'security')
);
create index if not exists support_signals_read_idx on public.support_signals(occurred_at desc,id desc);
create index if not exists support_signals_scope_idx on public.support_signals(fingerprint,occurred_at desc);
create index if not exists support_signals_actor_rate_idx on public.support_signals(actor_id,occurred_at desc) where source='client';

create table if not exists public.support_reviews (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (char_length(fingerprint) <= 180),
  disposition text not null check (disposition in ('investigating','expected','false_positive','resolved','confirmed_attack')),
  rationale text not null check (char_length(btrim(rationale)) between 8 and 500 and octet_length(rationale) <= 2000),
  reviewed_through timestamptz not null,
  actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  decision text not null check (decision in ('pending','confirmed')),
  parent_review_id uuid unique references public.support_reviews(id)
);
create index if not exists support_reviews_read_idx on public.support_reviews(created_at desc,id desc);
create index if not exists support_reviews_scope_idx on public.support_reviews(fingerprint,created_at desc);

create table if not exists public.support_audit_events (
  id uuid primary key default gen_random_uuid(),
  chain_index bigint generated always as identity unique,
  actor_id uuid,
  actor_role text not null,
  occurred_at timestamptz not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id text not null check (char_length(record_id) <= 128),
  changed_fields text[] not null,
  previous_hash text check (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists support_audit_read_idx on public.support_audit_events(chain_index desc);
create index if not exists support_audit_chain_idx on public.support_audit_events(table_name,record_id,chain_index desc);

create table if not exists public.support_releases (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  manifest jsonb not null check (jsonb_typeof(manifest)='object' and octet_length(manifest::text) <= 65536)
);
create index if not exists support_releases_read_idx on public.support_releases(created_at desc,id desc);

-- Every API role, including the server credential role, uses scoped RPCs rather than table writes.
alter table public.support_signals enable row level security;
alter table public.support_reviews enable row level security;
alter table public.support_audit_events enable row level security;
alter table public.support_releases enable row level security;
revoke all on public.support_signals,public.support_reviews,public.support_audit_events,public.support_releases from public,anon,authenticated,service_role;
revoke all on sequence public.support_audit_events_chain_index_seq from public,anon,authenticated,service_role;

create or replace function public.guard_support_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Support evidence is append-only'; end $$;
revoke all on function public.guard_support_append_only() from public,anon,authenticated,service_role;
do $$ declare t text; begin
  foreach t in array array['support_signals','support_reviews','support_audit_events','support_releases'] loop
    execute format('drop trigger if exists support_append_only on public.%I',t);
    execute format('create trigger support_append_only before update or delete or truncate on public.%I for each statement execute function public.guard_support_append_only()',t);
  end loop;
end $$;

-- Internal insertion has no public EXECUTE; immutable scope and actor are derived by RPC wrappers.
create or replace function public.insert_support_signal(p_feature text,p_code text,p_environment text,p_release text,p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_meta jsonb; v_scope text; v_actor uuid := auth.uid(); v_count integer; v_time timestamptz;
begin
  v_meta := public.support_code_metadata(p_code);
  if p_feature is null or p_feature not in ('app','highlights','activity','local','spotlight','drip','profile','auth','donation','payouts','operator','upload','admin','support')
    or v_meta is null or p_environment is null or p_environment not in ('development','test','preview','production')
    or p_release is null or p_release !~ '^[a-z0-9][a-z0-9._-]{0,79}$'
    or p_source is null or p_source not in ('client','server','security','check') then
    raise exception 'Invalid support signal vocabulary';
  end if;
  if p_source='client' and (v_actor is null or p_code in ('confirmed_attack','syntax_check_failed','auth_invalid','auth_unavailable','server_configuration_error')) then
    raise exception 'Trusted code or signed-in actor required';
  end if;
  if p_code='confirmed_attack' and p_source<>'security' then raise exception 'Confirmed attack requires security source'; end if;
  v_scope := p_feature||':'||p_code||':'||p_source||':'||p_environment||':'||p_release;
  -- Serialize only one reporting account/scope. No global audit lock or automatic repair.
  if p_source='client' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-rate:'||v_actor::text,0));
    select count(*) into v_count from public.support_signals where source='client' and actor_id=v_actor and occurred_at>clock_timestamp()-interval '1 minute';
    if v_count>=30 then raise exception 'Support client rate limit reached'; end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-rate:'||v_scope,0));
    select count(*) into v_count from public.support_signals where fingerprint=v_scope and occurred_at>clock_timestamp()-interval '1 minute';
    if v_count>=120 then raise exception 'Support trusted rate limit reached'; end if;
  end if;
  -- Equal clock readings cannot let a later occurrence inherit an earlier review's coverage.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-occurrence:'||v_scope,0));
  select greatest(clock_timestamp(),max(occurred_at)+interval '1 microsecond') into v_time from public.support_signals where fingerprint=v_scope;
  insert into public.support_signals(fingerprint,feature,code,category,severity,source,environment,release,actor_id,occurred_at)
    values(v_scope,p_feature,p_code,v_meta->>0,v_meta->>1,p_source,p_environment,p_release,v_actor,v_time) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.insert_support_signal(text,text,text,text,text) from public,anon,authenticated,service_role;

-- Signed-in clients submit minimal untrusted reports; category/severity cannot be forged.
create or replace function public.record_support_signal(p_feature text,p_code text,p_environment text,p_release text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Signed-in actor required'; end if;
  return public.insert_support_signal(p_feature,p_code,p_environment,p_release,'client');
end $$;
revoke all on function public.record_support_signal(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_support_signal(text,text,text,text) to authenticated;

-- The actual PostgREST role, rather than user_metadata/JWT text alone, gates trusted capture.
create or replace function public.record_trusted_support_signal(p_feature text,p_code text,p_environment text,p_release text,p_source text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true)<>'service_role' then raise exception 'Trusted service role required'; end if;
  if p_source is null or p_source not in ('server','security','check') then raise exception 'Invalid trusted source'; end if;
  return public.insert_support_signal(p_feature,p_code,p_environment,p_release,p_source);
end $$;
revoke all on function public.record_trusted_support_signal(text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_trusted_support_signal(text,text,text,text,text) to service_role;

-- Admin reviews retain original occurrences and decisions. Later occurrences reopen the issue.
create or replace function public.record_support_review(p_fingerprint text,p_disposition text,p_rationale text,p_reviewed_through timestamptz,p_parent_review_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_signal public.support_signals; v_parent public.support_reviews; v_id uuid; v_decision text; v_latest timestamptz; v_time timestamptz;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if;
  if p_fingerprint is null or char_length(p_fingerprint)>180 or p_disposition is null or p_disposition not in ('investigating','expected','false_positive','resolved','confirmed_attack')
    or p_rationale is null or char_length(btrim(p_rationale)) not between 8 and 500 or octet_length(p_rationale)>2000
    or p_rationale ~ '[[:cntrl:]]' or p_reviewed_through is null then raise exception 'Invalid review bounds'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-review:'||p_fingerprint,0));
  select * into v_signal from public.support_signals where fingerprint=p_fingerprint order by occurred_at desc,id desc limit 1;
  if not found then raise exception 'Review source not found'; end if;
  v_latest := v_signal.occurred_at;
  -- Require an actual occurrence, not a future timestamp that could suppress unseen evidence.
  if p_reviewed_through>v_latest or not exists(select 1 from public.support_signals where fingerprint=p_fingerprint and occurred_at=p_reviewed_through) then
    raise exception 'Review must match an existing occurrence';
  end if;
  if p_disposition='confirmed_attack' and (v_signal.source<>'security' or v_signal.code<>'confirmed_attack') then
    raise exception 'Confirmed attack requires trusted security source';
  end if;
  if p_parent_review_id is not null then
    select * into v_parent from public.support_reviews where id=p_parent_review_id;
    if not found or v_parent.decision<>'pending' or v_parent.parent_review_id is not null or v_parent.fingerprint<>p_fingerprint
      or v_parent.disposition<>p_disposition or v_parent.reviewed_through<>p_reviewed_through then raise exception 'Second review must match pending review'; end if;
    if v_parent.actor_id=auth.uid() then raise exception 'Second reviewer must be independent'; end if;
    if p_reviewed_through<>v_latest then raise exception 'New occurrence requires a new review'; end if;
    v_decision := 'confirmed';
  elsif (v_signal.category in ('security','finance') or v_signal.feature in ('auth','donation','payouts','admin','support')) and p_disposition<>'investigating' then v_decision := 'pending';
  else v_decision := 'confirmed'; end if;
  select greatest(clock_timestamp(),max(created_at)+interval '1 microsecond') into v_time from public.support_reviews where fingerprint=p_fingerprint;
  insert into public.support_reviews(fingerprint,disposition,rationale,reviewed_through,actor_id,decision,parent_review_id,created_at)
    values(p_fingerprint,p_disposition,btrim(p_rationale),p_reviewed_through,auth.uid(),v_decision,p_parent_review_id,v_time) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.record_support_review(text,text,text,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function public.record_support_review(text,text,text,timestamptz,uuid) to authenticated;

-- Registration records reported local capsule verification. It does not certify signer/deployment.
create or replace function public.register_support_release(p_manifest jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_m jsonb; v_date timestamptz;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if;
  if p_manifest is null or jsonb_typeof(p_manifest)<>'object' or octet_length(p_manifest::text)>65536
    or (select array_agg(k order by k) from jsonb_object_keys(p_manifest) k) is distinct from
      array['byteCount','capsuleHash','createdAt','filesCount','gitCommit','manifestHash','migrationHashes','provenanceHash','releaseId','schemaHash','treeHash','verification','version']::text[] then
    raise exception 'Invalid release manifest keys or bounds';
  end if;
  if p_manifest->'version'<>'1'::jsonb or jsonb_typeof(p_manifest->'releaseId')<>'string' or p_manifest->>'releaseId' !~ '^[a-z0-9][a-z0-9-]{0,79}$'
    or jsonb_typeof(p_manifest->'createdAt')<>'string' or p_manifest->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$'
    or not (p_manifest->'gitCommit'='null'::jsonb or (jsonb_typeof(p_manifest->'gitCommit')='string' and p_manifest->>'gitCommit' ~ '^[a-f0-9]{40}$'))
    or not (p_manifest->'schemaHash'='null'::jsonb or (jsonb_typeof(p_manifest->'schemaHash')='string' and p_manifest->>'schemaHash' ~ '^[a-f0-9]{64}$'))
    or jsonb_typeof(p_manifest->'verification')<>'string' or p_manifest->>'verification' not in ('not-run','passed')
    or jsonb_typeof(p_manifest->'filesCount')<>'number' or (p_manifest->>'filesCount') !~ '^\d+$' or (p_manifest->>'filesCount')::numeric not between 1 and 100000
    or jsonb_typeof(p_manifest->'byteCount')<>'number' or (p_manifest->>'byteCount') !~ '^\d+$' or (p_manifest->>'byteCount')::numeric not between 0 and 10737418240
    or jsonb_typeof(p_manifest->'migrationHashes')<>'array' or jsonb_array_length(p_manifest->'migrationHashes')>1000 then
    raise exception 'Invalid release manifest values';
  end if;
  v_date := (p_manifest->>'createdAt')::timestamptz;
  if v_date<'2020-01-01'::timestamptz or v_date>clock_timestamp()+interval '5 minutes' then raise exception 'Invalid package time'; end if;
  if exists(select 1 from unnest(array['treeHash','manifestHash','capsuleHash','provenanceHash']) k where jsonb_typeof(p_manifest->k)<>'string' or p_manifest->>k !~ '^[a-f0-9]{64}$') then raise exception 'Invalid release hash'; end if;
  for v_m in select value from jsonb_array_elements(p_manifest->'migrationHashes') loop
    if jsonb_typeof(v_m)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(v_m) k) is distinct from array['path','sha256']::text[]
      or jsonb_typeof(v_m->'path')<>'string' or v_m->>'path' !~ '^supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql$'
      or jsonb_typeof(v_m->'sha256')<>'string' or v_m->>'sha256' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid migration hash entry'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_manifest->'migrationHashes') x group by x->>'path' having count(*)>1) then raise exception 'Duplicate migration path'; end if;
  insert into public.support_releases(actor_id,manifest) values(auth.uid(),p_manifest) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.register_support_release(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.register_support_release(jsonb) to authenticated;

-- Atomic AFTER trigger observes actual field changes, stores no row values and locks only its entity.
create or replace function public.capture_support_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_old jsonb := case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(NEW) end;
  v_fields text[]; v_record text; v_prev text; v_hash text; v_id uuid := gen_random_uuid();
  v_time timestamptz := clock_timestamp(); v_actor uuid := auth.uid(); v_role text := public.current_user_role(); v_payload jsonb;
begin
  select array_agg(k order by k) into v_fields from (select jsonb_object_keys(v_old||v_new) k) keys where v_old->k is distinct from v_new->k;
  if v_fields is null then return null; end if;
  if TG_TABLE_NAME='profiles' then
    v_fields := array(select f from unnest(v_fields) f where f in ('role','roles','is_admin','active_role','player_id','is_verified','verification_status','stripe_connect_id','malo_frozen','payouts_enabled'));
    if cardinality(v_fields)=0 then return null; end if;
    if TG_OP<>'INSERT' and v_old->>'user_id'=v_actor::text then
      v_role := case when coalesce((v_old->>'is_admin')::boolean,false) or v_old->>'role'='admin' or coalesce(v_old->'roles','[]'::jsonb) ? 'admin' then 'admin' else coalesce(v_old->>'role','guest') end;
    end if;
  elsif TG_TABLE_NAME in ('games','reels','players') and v_role<>'admin' and current_setting('role',true)<>'service_role' then
    v_fields := array(select f from unnest(v_fields) f where f in ('guardian_id','parental_consent_approved','malo_frozen','is_verified','verification_status','is_hidden','is_published','status'));
    if cardinality(v_fields)=0 then return null; end if;
  end if;
  if current_setting('role',true)='service_role' then v_role := 'service_role';
  elsif v_actor is null then v_role := 'database_operator'; end if;
  v_record := coalesce(v_new->>'id',v_old->>'id',v_new->>'user_id',v_old->>'user_id',v_new->>'code',v_old->>'code',v_new->>'period',v_old->>'period');
  if v_record is null then raise exception 'Audited entity requires opaque id'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('support-audit:'||TG_TABLE_NAME||':'||v_record,0));
  select event_hash into v_prev from public.support_audit_events where table_name=TG_TABLE_NAME and record_id=v_record order by chain_index desc limit 1;
  v_payload := jsonb_build_object('id',v_id,'actor_id',v_actor,'actor_role',v_role,'occurred_at',to_char(v_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'operation',TG_OP,'table_name',TG_TABLE_NAME,'record_id',v_record,'changed_fields',v_fields,'previous_hash',v_prev);
  v_hash := encode(pg_catalog.sha256(convert_to(v_payload::text,'UTF8')),'hex');
  insert into public.support_audit_events(id,actor_id,actor_role,occurred_at,operation,table_name,record_id,changed_fields,previous_hash,event_hash)
    values(v_id,v_actor,v_role,v_time,TG_OP,TG_TABLE_NAME,v_record,v_fields,v_prev,v_hash);
  return null;
end $$;
revoke all on function public.capture_support_audit() from public,anon,authenticated,service_role;

-- Required source scope is explicit; missing dependencies fail activation rather than hiding coverage.
do $$ declare t text; begin
  foreach t in array array['profiles','players','games','reels','app_runtime_config','school_confirmers','tips','disbursements','company_revenue_logs','sponsorships','subscriptions','ledger_accounts','ledger_manual_entries','ledger_manual_lines','ledger_period_closes','ledger_period_reopens'] loop
    if to_regclass('public.'||t) is null then raise exception 'Apply source migrations first: %',t; end if;
    execute format('drop trigger if exists support_actual_write_audit on public.%I',t);
    execute format('create trigger support_actual_write_audit after insert or update or delete on public.%I for each row execute function public.capture_support_audit()',t);
  end loop;
end $$;

-- Admin-only one-statement read. Absence/error remains an error; clients cannot supply unbounded limits.
create or replace function public.get_engineering_support_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Admin access required'; end if;
  select jsonb_build_object('version',1,'read_at',clock_timestamp(),
    'signals',coalesce((select jsonb_agg(to_jsonb(s) order by s.occurred_at desc,s.id desc) from (select * from public.support_signals order by occurred_at desc,id desc limit 200) s),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from (select * from public.support_reviews order by created_at desc,id desc limit 300) r),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)-'chain_index' order by a.chain_index desc) from (select * from public.support_audit_events order by chain_index desc limit 200) a),'[]'::jsonb),
    'releases',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id desc) from (select * from public.support_releases order by created_at desc,id desc limit 20) m),'[]'::jsonb),
    'limits',jsonb_build_object('signals',200,'reviews',300,'audit',200,'releases',20)) into v_result;
  return v_result;
end $$;
revoke all on function public.get_engineering_support_snapshot() from public,anon,authenticated,service_role;
grant execute on function public.get_engineering_support_snapshot() to authenticated;

commit;

-- Function access hardening (DATA-01 schema replay finding, 2026-10-13; RLS_SECURITY reviewed).
--
-- Purpose
--   A replay of the whole schema.sql on an empty Postgres (scripts/replay/schema-replay.mjs) checked who can call
--   what. It found:
--   1. Books integrity: record_company_revenue and sync_company_revenue_logs had EXECUTE revoked from anon and
--      authenticated but not from PUBLIC, so any guest with the public key could write a revenue row into
--      company_revenue_logs (proved in the replay). increment_reel_tips, add_user_aura and increment_backer_count (donation
--      totals, Aura, backer counts) were open to guests the same way (backer count only ever granted authenticated,
--      never revoked from anon, which hosted Supabase grants by default), as did publish_spotlight_award and upsert_cheer_poll (those two check
--      the caller's role inside, so tidy-up only).
--   2. Admin-desk functions open to guests: triage_app_feedback, upsert_sport_config and delete_sport_config were
--      granted to anon and checked nothing. Only the admin desks (signed-in admins) call them.
--   3. "No claims" counted as the database: is_admin_or_db() treated a missing JWT role as the SQL Editor, so a
--      request running as anon with no claims passed it, and four verification-ladder admin functions
--      (20260929120000) were still executable by anon. Caps that test `auth.role() <> 'service_role'` read NULL
--      for such a request and were skipped (add_user_aura 5,000-point cap, update_game_score claimed-game check,
--      chip_in_wishlist_item cap, the Stripe-fields guard), and the profile role-escalation trigger returned early.
--      Whether the hosted gateway ever forwards a claimless request is not verified; this closes it either way.
--
-- Changes
--   - is_trusted_server(): the one test for "the server, not a client": service_role, or a session with no JWT
--     role that did not switch to anon / authenticated (the SQL Editor; PostgREST always switches). Always true or
--     false. The role setting survives inside security definer functions, where current_user is the owner.
--   - is_admin_or_db() = is_trusted_server() or an admin. The caps above use not is_trusted_server(); the
--     escalation trigger skips only for a true database session.
--   - The three admin-desk functions require is_admin_or_db() and are no longer granted to anon.
--   - PUBLIC / anon EXECUTE removed where listed; authenticated keeps what the app calls; service_role is granted every
--     narrowed function explicitly (RLS_SECURITY: a CHECK runs its function as the writing role, so the Stripe
--     webhook's tip insert needs EXECUTE on is_trusted_server).
--   - The five amount / Aura cap CHECK constraints on tips, sponsorships and shop_orders read
--     `auth.role() = 'service_role' or …`, which passes on NULL; they now use is_trusted_server(). Added NOT VALID:
--     existing rows were accepted under the old rule and are not re-judged; every new row is.
--   Not changed: update_game_score stays anon-executable for the operator PIN (STATE §5, accepted for internal
--   testing).
--
-- Owner: RLS_SECURITY (review), DATA_GOVERNANCE (finding); function owners LEDGER (revenue), ATHLETE_VERIFICATION /
--   SCHOOL_PARTNERS (ladder), AURA, OPERATOR, COMMERCE (wishlist), ADMIN (feedback, sports).
-- Safe to re-run: create or replace; grants are idempotent; revokes skip functions this database lacks
--   (development lacks the verification ladder and other September SQL).
-- Applied: written 2026-10-13, not applied anywhere. Apply FIRST on staging; independent of the other 2026-10-13
--   files. Function bodies below are the current schema.sql definitions with only the marked lines changed.
-- Rollback: re-run each function's previous definition from schema.sql history and restore the old grants
--   (not recommended: it reopens the books write).

create or replace function public.is_trusted_server()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false)
    or (auth.role() is null and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('anon', 'authenticated'));
$$;

create or replace function public.is_admin_or_db()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Always true or false: a NULL would read as "not refused" in callers' `if not public.is_admin_or_db()`.
  select public.is_trusted_server() or coalesce(public.current_user_role() = 'admin', false);
$$;

-- Bodies: current definitions; changed lines use is_trusted_server() / is_admin_or_db().

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

  -- SECURITY TRADEOFF (2026-09 audit item 1/4): this RPC is called for BOTH the tipper
  -- (self-Aura) and the athlete recipient right after a real tip (see useTipCheckout.ts),
  -- so a strict `auth.uid() = target_user_id` ownership check would break the "award the
  -- athlete too" half. Postgres/RLS alone cannot verify a real Stripe charge happened —
  -- that verification now lives in supabase/functions/stripe-webhook/index.ts, which writes
  -- Aura directly (as service_role, exempt below) once a charge is confirmed. Until every
  -- caller is migrated to trust that webhook instead of calling this RPC client-side, cap the
  -- client-facing path so a compromised/scripted client can fabricate at most a small amount
  -- of Aura per call rather than an unbounded amount. This is a stopgap, not a fix.
  if not public.is_trusted_server() and add_points > 5000 then
    raise exception 'points_to_add exceeds the per-call limit (5000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this RPC is called both for the tipper's own
  -- Fan Aura (target_user_id = auth user id) and for the athlete recipient's Athlete Aura
  -- (target_user_id = players.id) — see useTipCheckout.ts. `malo_target_frozen` only matches a
  -- `profiles` row keyed by `player_id = target_user_id`, so this is a no-op (false) for a tipper's
  -- own auth/profile id and only blocks the case that actually matters: awarding Aura to a frozen
  -- athlete. Applies to every caller (checkout, reel double-tap, wishlist chip-in), not service_role
  -- exempt, since the freeze must be a hard block regardless of caller.
  if public.malo_target_frozen(target_user_id) then
    raise exception 'Mālo is frozen for this athlete; Aura cannot be added.';
  end if;

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
  -- 2026-09 audit item 12: this is SECURITY DEFINER, so it bypasses the "Operators update games"
  -- RLS policy's claimed_by-narrowing entirely — and it's the operator console's PRIMARY score
  -- path (`updateGameScore` in lib/operator.ts calls this RPC before falling back to a direct
  -- table UPDATE), so leaving this function unconditional would make that RLS narrowing mostly
  -- cosmetic. Same stopgap here: an anon caller may only update a game that is still unclaimed.
  if public.current_user_role() not in ('operator', 'admin') and not public.is_trusted_server() then
    if exists (select 1 from public.games where id = target_game_id and claimed_by is not null) then
      raise exception 'This game has been claimed by another operator.';
    end if;
  end if;

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
  target_player uuid;
begin
  -- The per-gift ledger is the `tips` row `useTipCheckout` inserts before this call
  -- (`origin = wishlist`, `wishlist_item_id`, `source_label` = the item title). This RPC only
  -- moves the item aggregate, so it must not insert a second `tips` row.
  -- SECURITY TRADEOFF (2026-09 audit item 5): there is still no payer column on `wishlist_items`
  -- itself. Execute is `authenticated`-only and a per-call cap stands in until a Stripe charge
  -- is verified the same way supabase/functions/stripe-webhook/index.ts will eventually verify tips.
  if not public.is_trusted_server() and add_cents > 100000 then
    raise exception 'amount_cents exceeds the per-call limit (100000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this is a Mālo contribution too (see the
  -- doc comment above) — block it the same way `tips` INSERT does, before the aggregate even moves,
  -- not only at the equip/+500 Aura step below (add_user_aura's own check would catch that step,
  -- but not a below-target contribution that never reaches it).
  select player_id into target_player from public.wishlist_items where id = item_id;
  if target_player is not null and public.malo_target_frozen(target_player) then
    raise exception 'Mālo is frozen for this athlete; wishlist contributions are disabled.';
  end if;

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

create or replace function public.guard_profiles_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged_roles constant text[] := array['admin', 'booster', 'operator', 'parent', 'sponsor'];
  new_roles_set text[];
  old_roles_set text[];
  gained text[];
begin
  if auth.role() is null and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('anon', 'authenticated') then
    return new;
  end if;

  new_roles_set := coalesce(new.roles, array[]::text[])
    || array[new.role]
    || case when coalesce(new.is_admin, false) then array['admin'] else array[]::text[] end;

  if tg_op = 'INSERT' then
    old_roles_set := array[]::text[];
  else
    old_roles_set := coalesce(old.roles, array[]::text[])
      || array[old.role]
      || case when coalesce(old.is_admin, false) then array['admin'] else array[]::text[] end;
  end if;

  select coalesce(array_agg(r), array[]::text[])
  into gained
  from unnest(privileged_roles) as r
  where r = any (new_roles_set) and not (r = any (old_roles_set));

  if array_length(gained, 1) > 0 and public.current_user_role() <> 'admin' then
    raise exception 'these roles can only be granted by an existing admin: %', array_to_string(gained, ', ');
  end if;

  -- 2026-09 audit (Round 29 sweep): same root cause as the role-escalation gap above, different
  -- column. `set_malo_freeze`'s own comment claimed it was "the ONLY way" to flip `malo_frozen`
  -- because no *extra* table grant was added for it — but `profiles` already has a blanket
  -- `grant ... update` with no column restriction, so that reasoning never actually held. A frozen
  -- account (a real compliance/legal action per LEGAL_BRIEFING.md §8 item 5) could self-unfreeze
  -- with a raw `update profiles set malo_frozen = false where user_id = auth.uid()`, bypassing the
  -- admin-only RPC entirely and defeating the freeze's whole purpose. Guarding it the same way as
  -- the role columns: only an admin session may change it.
  if (
    (tg_op = 'INSERT' and coalesce(new.malo_frozen, false))
    or (tg_op = 'UPDATE' and new.malo_frozen is distinct from old.malo_frozen)
  ) and public.current_user_role() <> 'admin' then
    raise exception 'malo_frozen can only be changed by an admin';
  end if;

  -- 2026-09 audit (Round 30 sweep): same root cause again, a third time. `createPayout.ts` and
  -- `create-stripe-account`'s own doc comments both say the payout destination is "resolved
  -- server-side from `profiles.stripe_connect_id`, never a client-supplied account id" — but that
  -- claim only held for the app's own client code, which never happened to write these columns
  -- directly. Nothing stopped a raw REST call: `profiles`' blanket update grant covers
  -- `stripe_connect_id` / `payouts_enabled` / `stripe_onboarding_complete` same as everything else,
  -- so any signed-in user could self-set `payouts_enabled = true` and `stripe_connect_id` to an
  -- arbitrary string (their own real Connect id, someone else's if ever discoverable, or garbage)
  -- with zero real Stripe onboarding. Harmless today only because Round 23 already hard-blocks every
  -- real transfer regardless of these flags — but the entire "destination resolved server-side, never
  -- trust the client" security property this system is documented to rely on would be false the
  -- moment that block is lifted, undermining the point of building a balance ledger at all. `auth.role()
  -- = 'service_role'` is exempted so the `create-stripe-account` Edge Function (which legitimately
  -- writes these with the service key, and has no admin session to satisfy `current_user_role()`)
  -- keeps working.
  if (
    (tg_op = 'INSERT' and (
      new.stripe_connect_id is not null
      or coalesce(new.payouts_enabled, false)
      or coalesce(new.stripe_onboarding_complete, false)
    ))
    or (tg_op = 'UPDATE' and (
      new.stripe_connect_id is distinct from old.stripe_connect_id
      or new.payouts_enabled is distinct from old.payouts_enabled
      or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete
    ))
  ) and not public.is_trusted_server() and public.current_user_role() <> 'admin' then
    raise exception 'Stripe Connect fields can only be set by the server';
  end if;

  -- 2026-09 audit (Round 31/33 follow-up): `team_code_fail_count`/`team_code_locked_until` are
  -- `redeem_team_code`'s anti-brute-force lockout state (Round 12). Unlike the columns above, the
  -- one legitimate writer runs as the *calling user's own session*, not admin/service_role, so this
  -- can't just check `current_user_role()`. `redeem_team_code` sets a transaction-local flag
  -- (`app.tapuai_team_code_write`) immediately before its own writes to these columns; a raw client
  -- update attempting the same reset has no way to set that flag first, so it's rejected here.
  if (
    (tg_op = 'INSERT' and (
      coalesce(new.team_code_fail_count, 0) <> 0
      or new.team_code_locked_until is not null
    ))
    or (tg_op = 'UPDATE' and (
      new.team_code_fail_count is distinct from old.team_code_fail_count
      or new.team_code_locked_until is distinct from old.team_code_locked_until
    ))
  )
    and public.current_user_role() <> 'admin'
    and coalesce(current_setting('app.tapuai_team_code_write', true), '') <> 'true'
  then
    raise exception 'team_code_fail_count / team_code_locked_until can only be changed by the server';
  end if;

  return new;
end;
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
  -- Admin desks only (function access hardening 2026-10-13); it used to be granted to guests with no check.
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
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
  -- Admin desks only (function access hardening 2026-10-13); it used to be granted to guests with no check.
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
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

create or replace function public.delete_sport_config(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin desks only (function access hardening 2026-10-13); it used to be granted to guests with no check.
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  delete from public.sport_configs where id = target_id;
  return found;
end;
$$;

-- Cap constraints: the same server test, so a request with no claims cannot skip a cap.
alter table public.tips drop constraint if exists tips_amount_cents_cap_check;
alter table public.tips add constraint tips_amount_cents_cap_check
  check (public.is_trusted_server() or amount_cents <= 100000) not valid;
alter table public.tips drop constraint if exists tips_aura_points_cap_check;
alter table public.tips add constraint tips_aura_points_cap_check
  check (public.is_trusted_server() or aura_points <= 10000) not valid;
alter table public.sponsorships drop constraint if exists sponsorships_amount_cents_cap_check;
alter table public.sponsorships add constraint sponsorships_amount_cents_cap_check
  check (public.is_trusted_server() or amount_cents <= 100000) not valid;
alter table public.sponsorships drop constraint if exists sponsorships_aura_points_cap_check;
alter table public.sponsorships add constraint sponsorships_aura_points_cap_check
  check (public.is_trusted_server() or aura_points <= 10000) not valid;
alter table public.shop_orders drop constraint if exists shop_orders_amount_cents_cap_check;
alter table public.shop_orders add constraint shop_orders_amount_cents_cap_check
  check (public.is_trusted_server() or amount_cents <= 100000) not valid;

-- Grants. Each statement runs only where the function exists.
do $$
declare
  stmt text;
  fn text;
begin
  foreach stmt in array array[
    'revoke all on function public.is_trusted_server() from public',
    'grant execute on function public.is_trusted_server() to anon, authenticated',
    'revoke all on function public.is_admin_or_db() from public, anon',
    'grant execute on function public.is_admin_or_db() to authenticated',
    -- server-only: called by triggers and by security definer functions, never by a client
    'revoke all on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) from public, anon, authenticated',
    'revoke all on function public.sync_company_revenue_logs() from public, anon, authenticated',
    -- signed-in callers only
    'revoke all on function public.increment_reel_tips(uuid, integer) from public, anon',
    'grant execute on function public.increment_reel_tips(uuid, integer) to authenticated',
    'revoke all on function public.add_user_aura(uuid, integer) from public, anon',
    -- schema.sql said "anon revoked" here but only ever granted authenticated; hosted grants anon by default
    'revoke all on function public.increment_backer_count(uuid) from public, anon',
    'grant execute on function public.increment_backer_count(uuid) to authenticated',
    'grant execute on function public.add_user_aura(uuid, integer) to authenticated',
    'revoke all on function public.publish_spotlight_award(uuid, text, text, date, date) from public, anon',
    'revoke all on function public.upsert_cheer_poll(text, text, text, boolean) from public, anon',
    -- admin desks: signed-in, and the functions now check for an admin
    'revoke all on function public.triage_app_feedback(uuid, text, text, text) from public, anon',
    'grant execute on function public.triage_app_feedback(uuid, text, text, text) to authenticated',
    'revoke all on function public.upsert_sport_config(jsonb) from public, anon',
    'grant execute on function public.upsert_sport_config(jsonb) to authenticated',
    'revoke all on function public.delete_sport_config(uuid) from public, anon',
    'grant execute on function public.delete_sport_config(uuid) to authenticated',
    -- verification ladder admin functions (guarded inside by is_admin_or_db)
    'revoke all on function public.admin_add_school_confirmer(uuid, text, text, text, text) from public, anon',
    'revoke all on function public.admin_decide_verification(uuid, boolean, text) from public, anon',
    'revoke all on function public.admin_revoke_school_confirmer(uuid) from public, anon',
    'revoke all on function public.admin_revoke_verification(uuid, text) from public, anon',
    -- guarded inside by current_user_role(), but revoked from public only, and hosted Supabase grants anon directly
    'revoke all on function public.admin_approve_player_consent(uuid) from public, anon',
    'revoke all on function public.admin_set_custodial_terms(uuid, smallint, date) from public, anon',
    'revoke all on function public.admin_set_player_guardian(uuid, uuid) from public, anon',
    -- The server role keeps every function above: removing PUBLIC must not take it from the Stripe webhook (its
    -- add_user_aura calls; and is_trusted_server inside the cap CHECKs runs as the writing role).
    'grant execute on function public.add_user_aura(uuid, integer) to service_role',
    'grant execute on function public.admin_add_school_confirmer(uuid, text, text, text, text) to service_role',
    'grant execute on function public.admin_decide_verification(uuid, boolean, text) to service_role',
    'grant execute on function public.admin_revoke_school_confirmer(uuid) to service_role',
    'grant execute on function public.admin_revoke_verification(uuid, text) to service_role',
    'grant execute on function public.admin_approve_player_consent(uuid) to service_role',
    'grant execute on function public.admin_set_custodial_terms(uuid, smallint, date) to service_role',
    'grant execute on function public.admin_set_player_guardian(uuid, uuid) to service_role',
    'grant execute on function public.increment_backer_count(uuid) to service_role',
    'grant execute on function public.delete_sport_config(uuid) to service_role',
    'grant execute on function public.increment_reel_tips(uuid, integer) to service_role',
    'grant execute on function public.is_admin_or_db() to service_role',
    'grant execute on function public.is_trusted_server() to service_role',
    'grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to service_role',
    'grant execute on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) to service_role',
    'grant execute on function public.sync_company_revenue_logs() to service_role',
    'grant execute on function public.triage_app_feedback(uuid, text, text, text) to service_role',
    'grant execute on function public.upsert_cheer_poll(text, text, text, boolean) to service_role',
    'grant execute on function public.upsert_sport_config(jsonb) to service_role'
  ] loop
    fn := substring(stmt from 'function (public\.[a-z_]+\([^)]*\))');
    if to_regprocedure(fn) is not null then
      execute stmt;
    end if;
  end loop;
end;
$$;

-- Payout rows: admins write, and a parent reads only their own athlete's (STATE §5 Wave 1 blocker, 2026-10-13).
--
-- Purpose
--   "Admin write disbursements" let any account with the parent role insert, update or delete every payout row,
--   and "Admin read disbursements" let it read them all, not only its own child's (found by RLS_SECURITY during
--   the BOOKS-01 review). Payout rows feed the books (Finance & Books, Money desk), so a parent could change an
--   amount or status for any family. Only admin desks write disbursements in the app (Money, Books); the parent
--   app never does.
--   - Writes: admins only.
--   - Reads: admins, plus the custodial parties for that athlete through custodial_role(player_id) (the guardian
--     and the verified athlete, as for custodial_accounts: the athlete sees every gift and payout). A database
--     without custodial_role (development lacks custodial_money.sql) falls back to admin-only reads.
--
--   - Paid and failed payouts are final (INTERNAL_CONTROLS review; tightened after RLS_SECURITY): status moves only
--     between 'paid' and 'failed' (a bank return), and amount and athlete never change. The books never edit history
--     (BOOKS-01: entries are voided by reversal); a wrong payment is corrected with a new row. Side effect: deleting an
--     athlete who has a paid or failed payout is refused for app roles (the FK would blank player_id), which keeps
--     payout attribution for the books and 1099 review; the SQL Editor can still do it.
--
-- Chain of command: owner → CTO → SECURITY → RLS_SECURITY (owner); reviewed by CUSTODIAL (guardian rules) and
--   INTERNAL_CONTROLS (payout controls, CFO office).
-- Safe to re-run: drop policy if exists / create policy.
-- Applied: written 2026-10-13, not applied anywhere. Apply after 20261013210000_function_access_hardening.sql.
-- Rollback: drop trigger disbursements_paid_final and function disbursements_paid_final(); re-create the two previous policies from schema.sql (`current_user_role() in ('admin', 'parent')`) —
--   not recommended; it reopens every family's payout rows to every parent.

drop policy if exists "Admin write disbursements" on public.disbursements;
drop policy if exists "Admins write disbursements" on public.disbursements;
create policy "Admins write disbursements"
  on public.disbursements for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin read disbursements" on public.disbursements;
drop policy if exists "Custodial parties read disbursements" on public.disbursements;
do $$
begin
  if to_regprocedure('public.custodial_role(uuid)') is not null then
    execute $p$create policy "Custodial parties read disbursements"
      on public.disbursements for select
      to authenticated
      using (public.current_user_role() = 'admin' or public.custodial_role(player_id) is not null)$p$;
  else
    raise notice 'custodial_role is not on this database: payout rows stay admin-read only';
    execute $p$create policy "Custodial parties read disbursements"
      on public.disbursements for select
      to authenticated
      using (public.current_user_role() = 'admin')$p$;
  end if;
end;
$$;

create or replace function public.disbursements_paid_final()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Paid and failed are final states: a payout cannot be moved back to queued to edit it and pay again
  -- (RLS_SECURITY: paid -> failed -> edit -> paid). The Money desk only ever moves queued -> paid | failed.
  if old.status in ('paid', 'failed') and not public.is_trusted_server() then
    if new.status not in ('paid', 'failed') then
      raise exception 'A paid or failed payout cannot go back to %. Record a new payout instead.', new.status;
    end if;
    if new.amount_cents is distinct from old.amount_cents or new.player_id is distinct from old.player_id then
      raise exception 'A paid or failed payout cannot change amount or athlete. Record a correcting payout instead.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists disbursements_paid_final on public.disbursements;
create trigger disbursements_paid_final
  before update on public.disbursements
  for each row execute function public.disbursements_paid_final();

revoke all on function public.disbursements_paid_final() from public, anon, authenticated;

-- Avatars bucket: a signed-in user may write only inside their own folder (2026-10-13).
--
-- Purpose
--   "Public upload avatars" / "Public update avatars" only checked the bucket and that the caller was signed in,
--   so any account could overwrite any other account's profile photo (often a minor's face) at its path. Same
--   class of hole as the reels bucket (20261007231000).
--   Writers audited 2026-10-13 (the only code that writes to `avatars`):
--   * MediaUploadService.uploadAvatar: `{auth.uid}/{ms}.jpg` → folder[1] = uid.
--   * useSponsorships.uploadSponsorLogo: `sponsors/{ms}.{ext}` today, `sponsors/{auth.uid}/{ms}.{ext}` from this
--     change. Older app builds keep the flat layout, so INSERT still accepts a new file directly under `sponsors/`,
--     but nobody can UPDATE (overwrite) a file there; overwriting needs the caller's own folder.
--   Reads stay public (profile photos are shown to guests by design; whether minors' photos should be is an open
--   product question, WORK_QUEUE P1-02).
--
--   Adds "Owner delete avatars": a user may delete their own photos (RLS_SECURITY review).
--
-- Owner: STORAGE (via BACKEND, CTO); reviewed by RLS_SECURITY.
-- Safe to re-run: drop policy if exists / create policy.
-- Applied: written 2026-10-13, not applied anywhere. Independent of the other 2026-10-13 files.
-- Rollback (restores the bucket-only policies; reopens the overwrite):
--   drop policy if exists "Public upload avatars" on storage.objects;
--   create policy "Public upload avatars" on storage.objects for insert
--     with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
--   drop policy if exists "Public update avatars" on storage.objects;
--   create policy "Public update avatars" on storage.objects for update
--     using (bucket_id = 'avatars' and auth.role() = 'authenticated')
--     with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Public upload avatars" on storage.objects;
create policy "Public upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'sponsors'
        and (
          (storage.foldername(name))[2] = auth.uid()::text
          -- legacy flat layout from older builds: a new file directly in sponsors/, never an overwrite
          or coalesce(array_length(storage.foldername(name), 1), 0) = 1
        )
      )
    )
  );

drop policy if exists "Public update avatars" on storage.objects;
create policy "Public update avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'sponsors' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  )
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'sponsors' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- A user can remove their own old photo (often a minor's face); nobody else's. There was no delete policy at all.
drop policy if exists "Owner delete avatars" on storage.objects;
create policy "Owner delete avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'sponsors' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- Show families what actually reaches their account (2026-10-13).
--
-- Purpose
--   The athlete's "Support received" list (get_received_malo) and the custodial money cards (get_custodial_summary,
--   "… received" / "Held for you") showed the full amount fans donated. The family account receives that amount
--   minus Tapua'i's share (90% today), so a family saw $50 when $45 reached them.
--   - get_received_malo gains family_cents per donation.
--   - get_custodial_summary gains family_cents; received_cents keeps meaning "donated by fans" so app builds already
--     installed keep working (expand, then contract).
--   family_cents comes from the books' recorded payout for that donation (company_revenue_logs, source 'malo'), and
--   falls back to the current split (company_revenue_bps('malo')) when no revenue row exists.
--   The fallback uses company_revenue_bps('malo'); sync_company_revenue_logs hard-codes 1000 bps, so the two differ
--   only if the rate changes (RLS_SECURITY note).
--   Not changed: withdrawal requests are still not capped against the family share; how money reaches families is
--   an open owner + counsel decision (STATE §6 item 8).
--
-- Owner: COMMERCE → LEDGER, CUSTODIAL (chain: owner → CTO → COMMERCE); copy reviewed by VOICE and LEGAL.
-- Depends on: company_revenue.sql (company_revenue_logs, company_revenue_bps), custodial_money.sql, the Rally /
--   thanks migration (get_received_malo). All on staging.
-- Safe to re-run: get_received_malo is dropped and re-created (its result columns change), with grants restored;
--   get_custodial_summary is create or replace.
-- Applied: written 2026-10-13, not applied anywhere.
-- Rollback: re-run both functions' previous definitions from schema.sql history (the app falls back to the
--   donated total when family_cents is missing).

drop function if exists public.get_received_malo(uuid);

create or replace function public.get_received_malo(target_player_id uuid)
returns table (
  id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  origin text,
  entry text,
  source_label text,
  reel_id uuid,
  wishlist_item_id uuid,
  fan_name text,
  family_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or target_player_id is null then
    return;
  end if;

  if public.current_user_role() is distinct from 'admin'
    and not exists (
      select 1
      from public.profiles me
      where me.user_id = auth.uid()
        and me.player_id = target_player_id
    )
    and not exists (
      select 1
      from public.players pl
      join public.profiles me on me.id = pl.guardian_id
      where pl.id = target_player_id
        and me.user_id = auth.uid()
    )
  then
    return;
  end if;

  return query
  select
    t.id,
    t.amount_cents,
    coalesce(t.aura_points, 0) as aura_points,
    t.created_at,
    coalesce(t.origin, 'profile') as origin,
    coalesce(t.entry, 'in_app') as entry,
    coalesce(t.source_label, '') as source_label,
    t.reel_id,
    t.wishlist_item_id,
    coalesce(nullif(split_part(btrim(coalesce(f.full_name, '')), ' ', 1), ''), 'Fan') as fan_name,
    -- What reaches the family account: the books' recorded payout for this donation, or the current split when
    -- no revenue row exists yet.
    coalesce(
      r.payout_cents,
      t.amount_cents - round((t.amount_cents * public.company_revenue_bps('malo'))::numeric / 10000.0)::integer
    ) as family_cents
  from public.tips t
  left join public.profiles f on f.user_id = t.fan_id
  left join public.company_revenue_logs r on r.source = 'malo' and r.source_id = t.id::text
  where t.player_id = target_player_id
  order by t.created_at desc
  limit 100;
end;
$$;

revoke execute on function public.get_received_malo(uuid) from public, anon;
grant execute on function public.get_received_malo(uuid) to authenticated;

create or replace function public.get_custodial_summary(target_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  role_name text := public.custodial_role(target_player_id);
  acct public.custodial_accounts%rowtype;
  athlete public.players%rowtype;
  guardian_name text;
  handover date;
begin
  if role_name is null then
    return null;
  end if;
  select * into athlete from public.players where id = target_player_id;
  select * into acct from public.custodial_accounts where player_id = target_player_id;
  select coalesce(nullif(trim(p.full_name), ''), 'Your guardian') into guardian_name
  from public.profiles p where p.id = athlete.guardian_id;
  handover := public.athlete_handover_date(target_player_id);

  return jsonb_build_object(
    'viewer_role', role_name,
    'player_id', target_player_id,
    'athlete_name', coalesce(athlete.name, ''),
    'guardian_linked', athlete.guardian_id is not null,
    'guardian_name', guardian_name,
    'has_account', acct.player_id is not null,
    'payouts_enabled', coalesce(acct.payouts_enabled, false),
    'bank_in_athlete_name', acct.bank_in_athlete_name,
    'handover_age', coalesce(acct.handover_age, 18),
    'handover_date', handover,
    'athlete_controls', coalesce(handover <= current_date, false),
    'received_cents', (
      select coalesce(sum(t.amount_cents), 0) from public.tips t where t.player_id = target_player_id
    ),
    -- The family account's share (after Tapua'i's share), from the books; received_cents stays the donated total.
    'family_cents', (
      select coalesce(sum(coalesce(
        r.payout_cents,
        t.amount_cents - round((t.amount_cents * public.company_revenue_bps('malo'))::numeric / 10000.0)::integer
      )), 0)
      from public.tips t
      left join public.company_revenue_logs r on r.source = 'malo' and r.source_id = t.id::text
      where t.player_id = target_player_id
    ),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.created_at desc)
      from (
        select id, requested_role, amount_cents, note, status, created_at, decided_at
        from public.custodial_withdrawals
        where player_id = target_player_id
        order by created_at desc
        limit 20
      ) w
    ), '[]'::jsonb)
  );
end;
$$;

-- Hosted Supabase grants new functions to anon by default; the summary is for signed-in custodial parties only
-- (it returns null without a user, so this is tidy-up; RLS_SECURITY review).
revoke execute on function public.get_custodial_summary(uuid) from public, anon;
grant execute on function public.get_custodial_summary(uuid) to authenticated;

-- Profile privacy, two-way friends and blocking — stage 1 of PRIV-01 (2026-10-14).
--
-- Purpose
--   Owner decisions 2026-10-13 (docs/engineering/design/PROFILE_PRIVACY_DESIGN.md): accounts are public or private
--   (new accounts private), each profile item has an audience (everyone / friends / only me), friends are two-way,
--   people can block others, and people can hide from search. A private
--   athlete's name, approved-tagged Highlights, Donate, Rally / gear goals and Join Crew stay public.
--   Before this, `profiles` was readable by anyone (guests included), so the old hide switches only hid things from the
--   app's own screens. This migration closes direct reads of other people's rows and enforces every rule in SQL.
--
--   1. Settings live in new columns (account_private, profile_audience, hide_from_search, tag_review,
--      friend_requests_from). Existing accounts keep today's behaviour (public; each old
--      switch maps true → everyone, false → only me; friends list only me). New accounts get the private defaults.
--      Changes go only through set_my_privacy (a trigger refuses direct column writes), so the minor-account rules
--      (20261014110000_minor_accounts.sql) cannot be bypassed; older app builds that write the legacy profile_visibility switches are
--      mirrored into the new audience, fail-closed (a re-shown item becomes friends, not everyone).
--   2. friendships (requests, accepted, declined with a 30-day cooldown that the requester is never told about),
--      user_blocks (the blocked person is not told). Neither table accepts direct client writes.
--   3. viewer_relationship(target) and profile_item_visible(target, item) are the single rule; profiles_public is
--      rebuilt on them (user_id removed from it), and `profiles` SELECT becomes own row or admin.
--   4. Abuse limits: 20 friend requests a day, "who can send me requests", blocked people cannot request, join the
--      Crew (enforced in the crew_follows policy too) or appear in each other's searches; account search needs a
--      3-character username prefix.
--   5. crew_follows reads close (the follower, the athlete's own account and admins; counts still come from
--      get_crew_graph); get_crew_graph finds the athlete's account by player_id, not by matching names.
--   6. Search (account tags, local athlete search, the Aura board) respects hide-from-search and blocks.
--   Stage 2 (tags) and the screens follow in separate changes.
--
-- Owner: PROFILE (via ENGINEERING, CTO), with CREW, DISCOVERY, ADMIN; reviews RLS_SECURITY, PRIVACY_ENGINEERING,
--   MINOR_SAFETY, CUSTODIAL, DATA_GOVERNANCE. The guardian lock in the first draft was replaced before anything was
--   applied: owner 2026-10-14, a guardian supervises and approves a few changes instead (20261014110000_minor_accounts.sql).
-- Safe to re-run: add column if not exists; backfills touch only null rows; create or replace; drop policy if exists.
-- Applied: written 2026-10-14, not applied anywhere. Apply after the 2026-10-13 security files.
-- Rollback: recreate "Public read profiles" (using (true)) and "Public read crew follows" (using (true)), restore the
--   previous profiles_public view from schema.sql history; the new tables and columns can stay (unused).
--   Stage 1 review (2026-10-14) applied: helpers that answer about other people are not client-callable; the public
--   view is read only through get_public_profiles (named accounts, so hide-from-search holds); a blocked person sees a
--   guest's view; photos and full names no longer leak through reels_feed, the boards, Spotlight, donor and tag lists;
--   friend-request limits use a log; tag search escapes wildcards; one relationship lookup per view row.
-- Known limit: the avatars bucket is public, so hiding the photo hides the URL from other people but not a file whose
--   URL someone already has (WORK_QUEUE P1-02 follow-up: private avatars with signed URLs).

-- 1. Settings ------------------------------------------------------------------------------------------------------

alter table public.profiles add column if not exists account_private boolean;
alter table public.profiles add column if not exists profile_audience jsonb;
alter table public.profiles add column if not exists hide_from_search boolean not null default false;
alter table public.profiles add column if not exists tag_review text not null default 'review_all';
alter table public.profiles add column if not exists friend_requests_from text not null default 'everyone';

alter table public.profiles drop constraint if exists profiles_tag_review_check;
alter table public.profiles add constraint profiles_tag_review_check check (tag_review in ('review_all', 'auto_friends'));
alter table public.profiles drop constraint if exists profiles_friend_requests_from_check;
alter table public.profiles add constraint profiles_friend_requests_from_check check (friend_requests_from in ('everyone', 'teens', 'nobody'));

-- Existing accounts keep what they had (explicit backfill; only rows not yet migrated).
update public.profiles set account_private = false where account_private is null;
update public.profiles
set profile_audience = jsonb_build_object(
  'photo', 'everyone',
  'bio', case when coalesce((profile_visibility ->> 'bio')::boolean, true) then 'everyone' else 'only_me' end,
  'school', case when coalesce((profile_visibility ->> 'school')::boolean, true) then 'everyone' else 'only_me' end,
  'social_links', case when coalesce((profile_visibility ->> 'social_links')::boolean, true) then 'everyone' else 'only_me' end,
  'stats', case when coalesce((profile_visibility ->> 'stats')::boolean, true) then 'everyone' else 'only_me' end,
  'aura', 'everyone',
  'crew', 'everyone',
  'friends_list', 'only_me'
)
where profile_audience is null;

-- New accounts: private, with the private defaults (fail closed).
alter table public.profiles alter column account_private set default true;
alter table public.profiles alter column account_private set not null;
alter table public.profiles alter column profile_audience set default
  '{"photo":"friends","bio":"friends","school":"friends","social_links":"only_me","stats":"friends","aura":"friends","crew":"friends","friends_list":"only_me"}'::jsonb;
alter table public.profiles alter column profile_audience set not null;

-- One verified account per roster athlete, so "the athlete's account" is unambiguous (skipped with a notice if data
-- already has duplicates; an admin resolves them first).
do $$
begin
  if not exists (
    select 1 from public.profiles where verification_status = 'verified' and player_id is not null
    group by player_id having count(*) > 1
  ) then
    create unique index if not exists profiles_verified_player_uidx
      on public.profiles (player_id) where verification_status = 'verified' and player_id is not null;
  else
    raise warning 'profiles_verified_player_uidx SKIPPED: more than one verified account per athlete exists. Resolve the duplicates, then re-run this file.';
  end if;
end;
$$;

-- 2. Friends and blocks ---------------------------------------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_check check (status in ('pending', 'accepted', 'declined'))
);
create unique index if not exists friendships_pair_uidx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, created_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- Every request ever sent, so the daily and per-person limits cannot be reset by cancelling and asking again.
create table if not exists public.friend_request_log (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists friend_request_log_requester_idx on public.friend_request_log (requester_id, created_at desc);

alter table public.friendships enable row level security;
alter table public.friend_request_log enable row level security;
alter table public.user_blocks enable row level security;

-- 3. The rule -------------------------------------------------------------------------------------------------------

create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.user_blocks u
    where (u.blocker_id = a and u.blocked_id = b) or (u.blocker_id = b and u.blocked_id = a)
  );
$$;

-- The guardian of an athlete's account: players.guardian_id for the roster athlete the account is linked to.
create or replace function public.is_guardian_of_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles t
    join public.players pl on pl.id = t.player_id
    where t.id = target and pl.guardian_id is not null and pl.guardian_id = public.my_profile_id()
  );
$$;

-- self, admin, guardian, blocked, friend, stranger or guest — for the signed-in caller looking at `target`.
create or replace function public.viewer_relationship(target uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if target is null then
    return 'guest';
  end if;
  if me is not null and me = target then
    return 'self';
  end if;
  if public.current_user_role() = 'admin' then
    return 'admin';
  end if;
  if me is null then
    return 'guest';
  end if;
  if public.is_guardian_of_profile(target) then
    return 'guardian';
  end if;
  if public.is_blocked_between(me, target) then
    return 'blocked';
  end if;
  if public.are_friends(me, target) then
    return 'friend';
  end if;
  return 'stranger';
end;
$$;

create or replace function public.privacy_default_audience()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"photo":"friends","bio":"friends","school":"friends","social_links":"only_me","stats":"friends","aura":"friends","crew":"friends","friends_list":"only_me"}'::jsonb;
$$;

-- The audience rule on its own (no lookups), so a view can work out the viewer once per row and reuse it.
create or replace function public.audience_allows(rel text, is_private boolean, audience jsonb, item text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  level text;
begin
  if rel in ('self', 'admin', 'guardian') then
    return true;
  end if;
  if rel is null or rel = 'blocked' then
    return false;
  end if;
  level := coalesce(audience ->> item, public.privacy_default_audience() ->> item, 'only_me');
  if level = 'friends' then
    return rel = 'friend';
  end if;
  if level = 'everyone' then
    return rel = 'friend' or not coalesce(is_private, true);
  end if;
  return false;
end;
$$;

-- Whether the caller may see one item of `target`'s profile. Unknown item, setting or account → hidden (fail closed).
create or replace function public.profile_item_visible(target uuid, item text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.audience_allows(public.viewer_relationship(p.id), p.account_private, p.profile_audience, item)
    from public.profiles p where p.id = target
  ), false);
$$;

-- Whether a roster athlete's linked account hides from this caller's search.
create or replace function public.player_hidden_from_viewer(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.player_id = target_player_id
      and (
        (p.hide_from_search and public.viewer_relationship(p.id) not in ('self', 'admin', 'guardian', 'friend'))
        or public.viewer_relationship(p.id) = 'blocked'
      )
  );
$$;

-- 4. Direct reads close; the public view applies the rule ---------------------------------------------------------

drop policy if exists "Public read profiles" on public.profiles;
drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles
  for select using (user_id = auth.uid() or public.current_user_role() = 'admin');

drop function if exists public.get_public_profiles(uuid[], uuid[], text);
drop view if exists public.profiles_public;
create view public.profiles_public as
select
  pr.id,
  pr.player_id,
  pr.username,
  -- Accounts not linked to a roster athlete show strangers a username or first name, not the full name.
  case
    when pr.player_id is not null or v.rel in ('self', 'admin', 'guardian', 'friend') then pr.full_name
    else coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''), 'Fan')
  end as full_name,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'photo') then pr.avatar_url else null end as avatar_url,
  pr.is_verified,
  pr.is_verified_athlete,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'school') as school_visible,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'bio') then pr.bio else null end as bio,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'social_links') then pr.social_links else '{}'::jsonb end as social_links,
  -- Sport is public athlete identity (clips and donations depend on it).
  case when pr.player_id is not null and (pr.role = 'athlete' or 'athlete' = any(coalesce(pr.roles, '{}'::text[])))
    then nullif(btrim(pr.athlete_sport), '') else null end as athlete_sport,
  pr.verification_status,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'school') then pr.school_id else null end as school_id,
  case when public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'aura') then pr.aura_points else null end as aura_points,
  pr.account_private,
  -- A blocked person sees the same as a guest and is not told; the blocker sees 'blocked' (to offer Unblock).
  case
    when v.rel = 'blocked' and not exists (
      select 1 from public.user_blocks u where u.blocker_id = public.my_profile_id() and u.blocked_id = pr.id
    ) then 'guest'
    else v.rel
  end as viewer_relation,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'stats') as stats_visible,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'crew') as crew_visible,
  public.audience_allows(v.rel, pr.account_private, pr.profile_audience, 'friends_list') as friends_visible,
  -- The school-confirmed badge is public even when the school itself is hidden.
  (pr.school_id is not null) as school_confirmed
from public.profiles pr
cross join lateral (select public.viewer_relationship(pr.id) as rel) v;

-- No directory: the view is read only through get_public_profiles, for named accounts (hide-from-search holds).
revoke all on public.profiles_public from public, anon, authenticated;
grant select on public.profiles_public to service_role;

create or replace function public.get_public_profiles(
  profile_ids uuid[] default null,
  player_ids uuid[] default null,
  handle text default null
)
-- An explicit column list (not `setof profiles_public`) so re-running the schema can drop and rebuild the view.
returns table (
  id uuid, player_id uuid, username text, full_name text, avatar_url text, is_verified boolean,
  is_verified_athlete boolean, school_visible boolean, bio text, social_links jsonb, athlete_sport text,
  verification_status text, school_id uuid, aura_points integer, account_private boolean, viewer_relation text,
  stats_visible boolean, crew_visible boolean, friends_visible boolean, school_confirmed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
  from public.profiles_public v
  where v.id = any(coalesce((profile_ids)[1:50], '{}'::uuid[]))
     or v.player_id = any(coalesce((player_ids)[1:50], '{}'::uuid[]))
     or (nullif(btrim(handle), '') is not null and lower(v.username) = lower(btrim(handle)));
$$;

-- Stats follow the stats audience; a roster athlete nobody has claimed has no owner to choose, so stays visible.
create or replace function public.athlete_stats_visible(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.profile_item_visible(pr.id, 'stats') from public.profiles pr where pr.player_id = target_player_id
     order by (pr.verification_status = 'verified') desc limit 1),
    true
  );
$$;

-- 5. Writes to privacy columns go through the functions below -----------------------------------------------------

create or replace function public.guard_profiles_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  was boolean;
  now_on boolean;
begin
  if coalesce(current_setting('app.tapuai_privacy_write', true), '') = 'on' or public.is_trusted_server() then
    return new;
  end if;
  if new.account_private is distinct from old.account_private
     or new.profile_audience is distinct from old.profile_audience
     or new.hide_from_search is distinct from old.hide_from_search
     or new.tag_review is distinct from old.tag_review
     or new.friend_requests_from is distinct from old.friend_requests_from then
    raise exception 'Change privacy settings from Profile → Privacy.';
  end if;
  -- Older app builds still write the four legacy switches: mirror them and fail closed.
  if new.profile_visibility is distinct from old.profile_visibility then
    foreach k in array array['bio', 'school', 'stats', 'social_links'] loop
      was := coalesce((old.profile_visibility ->> k)::boolean, true);
      now_on := coalesce((new.profile_visibility ->> k)::boolean, true);
      if was and not now_on then
        new.profile_audience := jsonb_set(new.profile_audience, array[k], '"only_me"');
      elsif now_on and not was then
        if coalesce(new.profile_audience ->> k, 'only_me') = 'only_me' then
          new.profile_audience := jsonb_set(new.profile_audience, array[k], '"friends"');
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privacy_guard on public.profiles;
create trigger profiles_privacy_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_privacy();

create or replace function public.privacy_settings_json(target uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'account_private', p.account_private,
    'audience', public.privacy_default_audience() || coalesce(p.profile_audience, '{}'::jsonb),
    'hide_from_search', p.hide_from_search,
    'tag_review', p.tag_review,
    'friend_requests_from', p.friend_requests_from
  )
  from public.profiles p where p.id = target;
$$;

-- Applies a settings object to one profile (callers check who may change what first).
create or replace function public.apply_privacy_settings(target uuid, settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur public.profiles%rowtype;
  next_private boolean;
  next_audience jsonb;
  next_hide boolean;
  next_review text;
  next_requests text;
  k text;
  v text;
begin
  select * into cur from public.profiles where id = target;
  if not found then
    raise exception 'Account not found.';
  end if;
  settings := coalesce(settings, '{}'::jsonb);
  next_private := coalesce((settings ->> 'account_private')::boolean, cur.account_private);
  next_hide := coalesce((settings ->> 'hide_from_search')::boolean, cur.hide_from_search);
  next_review := coalesce(settings ->> 'tag_review', cur.tag_review);
  next_requests := coalesce(settings ->> 'friend_requests_from', cur.friend_requests_from);
  next_audience := public.privacy_default_audience() || coalesce(cur.profile_audience, '{}'::jsonb);
  if jsonb_typeof(settings -> 'audience') = 'object' then
    for k, v in select key, value #>> '{}' from jsonb_each(settings -> 'audience') loop
      if not (public.privacy_default_audience() ? k) then
        raise exception 'Unknown profile item: %', k;
      end if;
      if v not in ('everyone', 'friends', 'only_me') then
        raise exception 'Choose everyone, friends or only me.';
      end if;
      next_audience := jsonb_set(next_audience, array[k], to_jsonb(v));
    end loop;
  end if;
  -- 'teens' (requests only from accounts aged 13–17, plus a linked guardian) is the teen default; its rules live in
  -- 20261014110000_minor_accounts.sql.
  if next_review not in ('review_all', 'auto_friends') or next_requests not in ('everyone', 'teens', 'nobody') then
    raise exception 'That setting is not available.';
  end if;
  perform set_config('app.tapuai_privacy_write', 'on', true);
  update public.profiles
  set account_private = next_private, profile_audience = next_audience, hide_from_search = next_hide,
      tag_review = next_review, friend_requests_from = next_requests
  where id = target;
  perform set_config('app.tapuai_privacy_write', 'off', true);
  return public.privacy_settings_json(target);
end;
$$;

create or replace function public.get_my_privacy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in to see your privacy settings.';
  end if;
  return public.privacy_settings_json(me);
end;
$$;

create or replace function public.set_my_privacy(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in to change your privacy settings.';
  end if;
  return public.apply_privacy_settings(me, settings);
end;
$$;

-- 6. Friends ---------------------------------------------------------------------------------------------------------

-- Friend requests can be turned off by the owner (feature switch privacy.friends = false in the published config).
create or replace function public.friend_requests_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (c.published -> 'features' ->> 'privacy.friends')::boolean
    from public.app_runtime_config c where c.id = 'default'
  ), true);
$$;

-- Returns 'friends' or 'requested'. The same message covers blocked, closed and unknown accounts.
create or replace function public.request_friend(target_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  t public.profiles%rowtype;
  row_found public.friendships%rowtype;
  sent_today integer;
begin
  if me is null then
    raise exception 'Sign in to add friends.';
  end if;
  if not public.friend_requests_enabled() then
    raise exception 'Friend requests are paused right now.';
  end if;
  select * into t from public.profiles where id = target_profile_id;
  if not found or t.id = me or public.is_blocked_between(me, t.id) or t.friend_requests_from = 'nobody' then
    raise exception 'You can''t send a friend request to this account.';
  end if;
  select * into row_found from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, t.id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, t.id);
  if found then
    if row_found.status = 'accepted' then
      return 'friends';
    end if;
    if row_found.status = 'pending' and row_found.requester_id = me then
      return 'requested';
    end if;
    if row_found.status = 'pending' and row_found.addressee_id = me then
      update public.friendships set status = 'accepted', responded_at = timezone('utc', now()) where id = row_found.id;
      return 'friends';
    end if;
    -- Declined: the requester waits 30 days and is never told; the person who declined may send their own request.
    if row_found.requester_id = me and row_found.responded_at > timezone('utc', now()) - interval '30 days' then
      return 'requested';
    end if;
    delete from public.friendships where id = row_found.id;
  end if;
  select count(*)::int into sent_today from public.friend_request_log l
  where l.requester_id = me and l.created_at > timezone('utc', now()) - interval '1 day';
  if sent_today >= 20 then
    raise exception 'You''ve sent a lot of friend requests today. Try again tomorrow.';
  end if;
  if (select count(*) from public.friend_request_log l
      where l.requester_id = me and l.addressee_id = t.id and l.created_at > timezone('utc', now()) - interval '7 days') >= 3 then
    return 'requested';
  end if;
  insert into public.friend_request_log (requester_id, addressee_id) values (me, t.id);
  insert into public.friendships (requester_id, addressee_id) values (me, t.id);
  return 'requested';
end;
$$;

create or replace function public.respond_friend(request_id uuid, accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  f public.friendships%rowtype;
begin
  select * into f from public.friendships where id = request_id;
  if not found or f.addressee_id is distinct from me or f.status <> 'pending' then
    raise exception 'That request is no longer waiting.';
  end if;
  update public.friendships
  set status = case when accept then 'accepted' else 'declined' end, responded_at = timezone('utc', now())
  where id = request_id;
  return case when accept then 'friends' else 'declined' end;
end;
$$;

-- Unfriend, or cancel my own pending request. A decline the requester is waiting out stays in place.
create or replace function public.remove_friend(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, target_profile_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, target_profile_id)
    and (f.status in ('accepted', 'pending') or f.addressee_id = me);
end;
$$;

create or replace function public.list_my_friends()
returns table (request_id uuid, profile_id uuid, display_name text, username text, avatar_url text, status text, since timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    return;
  end if;
  return query
  select
    f.id,
    o.id,
    case when f.status = 'accepted' or o.player_id is not null then o.full_name
         else coalesce(nullif(btrim(o.username), ''), nullif(split_part(btrim(coalesce(o.full_name, '')), ' ', 1), ''), 'Fan') end,
    o.username,
    case when public.profile_item_visible(o.id, 'photo') then o.avatar_url else null end,
    case when f.status = 'accepted' then 'friend' when f.addressee_id = me then 'incoming' else 'outgoing' end,
    coalesce(f.responded_at, f.created_at)
  from public.friendships f
  join public.profiles o on o.id = case when f.requester_id = me then f.addressee_id else f.requester_id end
  where (f.requester_id = me or f.addressee_id = me)
    and (f.status in ('accepted', 'pending'))
    and not public.is_blocked_between(me, o.id)
  order by (f.status = 'pending' and f.addressee_id = me) desc, coalesce(f.responded_at, f.created_at) desc
  limit 500;
end;
$$;

-- 7. Blocks ----------------------------------------------------------------------------------------------------------

-- Ends the friendship, any requests, Crew follows both ways and pending tags/mentions between the two accounts.
create or replace function public.block_user(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  mine public.profiles%rowtype;
  theirs public.profiles%rowtype;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  select * into theirs from public.profiles where id = target_profile_id;
  if not found or theirs.id = me then
    raise exception 'You can''t block this account.';
  end if;
  select * into mine from public.profiles where id = me;
  insert into public.user_blocks (blocker_id, blocked_id) values (me, theirs.id) on conflict do nothing;
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, theirs.id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, theirs.id);
  if mine.player_id is not null and theirs.user_id is not null then
    delete from public.crew_follows where follower_id = theirs.user_id and athlete_id = mine.player_id;
  end if;
  if theirs.player_id is not null and mine.user_id is not null then
    delete from public.crew_follows where follower_id = mine.user_id and athlete_id = theirs.player_id;
  end if;
  -- Their pending tags of me end like a decline (untagged; nobody named). The tag-write flag lets this through the
  -- stage 2 trigger, which otherwise refuses status changes from anyone but the athlete's review (RLS_SECURITY P1).
  if mine.player_id is not null then
    -- Remembered as an automatic decline (rejected_by null) once stage 2 exists, so an admin can undo it.
    if to_regclass('public.reel_tag_rejections') is not null then
      execute 'insert into public.reel_tag_rejections (reel_id, player_id, uploader_id, rejected_by)
               select r.id, r.player_id, r.uploaded_by, null from public.reels r
               where r.uploaded_by = $1 and r.player_id = $2 and r.tag_status = ''pending''
               on conflict (reel_id, player_id) do nothing'
        using theirs.id, mine.player_id;
    end if;
    perform set_config('app.tapuai_tag_write', 'on', true);
    update public.reels set tag_status = 'rejected', player_id = null, tag_confirmed_at = null, tag_confirmed_by = null
    where uploaded_by = theirs.id and player_id = mine.player_id and tag_status = 'pending';
    perform set_config('app.tapuai_tag_write', 'off', true);
  end if;
  if to_regclass('public.reel_account_tags') is not null then
    execute 'delete from public.reel_account_tags t using public.reels r
             where r.id = t.reel_id and t.status = ''pending''
               and ((t.profile_id = $1 and r.uploaded_by = $2) or (t.profile_id = $2 and r.uploaded_by = $1))'
      using me, theirs.id;
  end if;
end;
$$;

create or replace function public.unblock_user(target_profile_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.user_blocks where blocker_id = public.my_profile_id() and blocked_id = target_profile_id;
$$;

create or replace function public.list_my_blocks()
returns table (profile_id uuid, display_name text, username text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id,
    coalesce(nullif(btrim(o.username), ''), nullif(split_part(btrim(coalesce(o.full_name, '')), ' ', 1), ''), 'Account'),
    o.username, u.created_at
  from public.user_blocks u
  join public.profiles o on o.id = u.blocked_id
  where u.blocker_id = public.my_profile_id()
  order by u.created_at desc;
$$;

-- 8. Reads that used to touch other people's profiles rows -------------------------------------------------------

-- Which of these roster athletes have a linked account (roster "claimed" badge). Ids only.
create or replace function public.claimed_player_ids(target_player_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.player_id from public.profiles p
  where p.player_id = any(coalesce(target_player_ids, '{}'::uuid[]));
$$;

-- The Aura board: only people whose Aura this caller may see, never hidden-from-search or blocked accounts.
create or replace function public.get_aura_board(max_rows integer default 20)
returns table (id uuid, username text, display_name text, aura_points integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.username, c.display_name, c.aura_points
  from (
    select p.id, p.username,
      case when p.player_id is not null then p.full_name
           else coalesce(nullif(btrim(p.username), ''), nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Fan') end
        as display_name,
      p.aura_points, p.hide_from_search
    from public.profiles p
    where coalesce(p.aura_points, 0) > 0
    order by p.aura_points desc
    limit 200
  ) c
  where public.profile_item_visible(c.id, 'aura')
    and (not c.hide_from_search or public.viewer_relationship(c.id) in ('self', 'admin', 'guardian', 'friend'))
  order by c.aura_points desc
  limit least(greatest(coalesce(max_rows, 20), 1), 50);
$$;

-- Account tag search: a username prefix of at least 3 characters (wildcards are escaped, not stripped); hidden and
-- blocked accounts never appear.
create or replace function public.search_taggable_accounts(search_query text)
returns table (id uuid, label text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := replace(replace(replace(btrim(coalesce(search_query, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if auth.uid() is null or char_length(btrim(coalesce(search_query, ''))) < 3 then
    return;
  end if;
  return query
  select p.id, public.account_tag_label(p) as label
  from public.profiles p
  where p.username ilike q || '%'
    and (not p.hide_from_search or public.viewer_relationship(p.id) in ('self', 'admin', 'guardian', 'friend'))
    and public.viewer_relationship(p.id) <> 'blocked'
  order by p.username nulls last
  limit 8;
end;
$$;

-- Local search: athletes whose account hides from search (or blocked this caller) are left out.
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
    where (p.name ilike '%' || needle || '%'
       or p.school_name ilike '%' || needle || '%'
       or coalesce(p.team, '') ilike '%' || needle || '%')
      and not public.player_hidden_from_viewer(p.id)
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

-- 9. Crew -------------------------------------------------------------------------------------------------------------

create or replace function public.crew_follow_blocked(target_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles a
    where a.player_id = target_athlete_id and public.is_blocked_between(a.id, public.my_profile_id())
  );
$$;

drop policy if exists "Public read crew follows" on public.crew_follows;
drop policy if exists "Read own or own athlete crew follows" on public.crew_follows;
create policy "Read own or own athlete crew follows" on public.crew_follows
  for select using (
    follower_id = auth.uid()
    or public.current_user_role() = 'admin'
    or exists (select 1 from public.profiles p where p.player_id = crew_follows.athlete_id and p.user_id = auth.uid())
  );

drop policy if exists "Users write own crew follows" on public.crew_follows;
create policy "Users write own crew follows"
  on public.crew_follows for all
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid() and not public.crew_follow_blocked(athlete_id));

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

  -- The athlete's account by its roster link (it used to match names, which two athletes can share).
  select p.user_id into athlete_user
  from public.profiles p
  where p.player_id = target_athlete_id and p.user_id is not null
  order by (p.verification_status = 'verified') desc
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

    select p.player_id into viewer_player
    from public.profiles p
    where p.user_id = actor and p.player_id is not null
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
    if public.crew_follow_blocked(target_athlete_id) then
      raise exception 'You can''t join this Crew.';
    end if;
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

-- 10. Admin -------------------------------------------------------------------------------------------------------

create or replace function public.admin_get_privacy(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return public.privacy_settings_json(target_profile_id) || jsonb_build_object(
    'friend_count', (select count(*) from public.friendships f where f.status = 'accepted' and target_profile_id in (f.requester_id, f.addressee_id)),
    'pending_incoming', (select count(*) from public.friendships f where f.status = 'pending' and f.addressee_id = target_profile_id),
    'pending_outgoing', (select count(*) from public.friendships f where f.status = 'pending' and f.requester_id = target_profile_id),
    -- from the request log, so cancelled requests still count (the spam signal)
    'requests_sent_7d', (select count(*) from public.friend_request_log l where l.requester_id = target_profile_id and l.created_at > timezone('utc', now()) - interval '7 days'),
    'blocks_made', (select count(*) from public.user_blocks u where u.blocker_id = target_profile_id),
    'blocks_received', (select count(*) from public.user_blocks u where u.blocked_id = target_profile_id)
  );
end;
$$;

create or replace function public.admin_reset_privacy(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return public.apply_privacy_settings(target_profile_id, jsonb_build_object(
    'account_private', true, 'audience', public.privacy_default_audience(),
    'hide_from_search', false, 'tag_review', 'review_all', 'friend_requests_from', 'everyone'));
end;
$$;

create or replace function public.admin_set_hide_from_search(target_profile_id uuid, hidden boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return public.apply_privacy_settings(target_profile_id, jsonb_build_object('hide_from_search', coalesce(hidden, true)));
end;
$$;

create or replace function public.admin_end_friendship(profile_a uuid, profile_b uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  perform public.require_admin_guard();
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(profile_a, profile_b)
    and greatest(f.requester_id, f.addressee_id) = greatest(profile_a, profile_b);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.admin_privacy_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'private_accounts', (select count(*) from public.profiles where account_private),
    'public_accounts', (select count(*) from public.profiles where not account_private),
    'hidden_from_search', (select count(*) from public.profiles where hide_from_search),
    'friendships', (select count(*) from public.friendships where status = 'accepted'),
    'requests_7d', (select count(*) from public.friend_request_log where created_at > timezone('utc', now()) - interval '7 days'),
    'blocks_7d', (select count(*) from public.user_blocks where created_at > timezone('utc', now()) - interval '7 days'),
    'friend_requests_enabled', public.friend_requests_enabled()
  );
end;
$$;


-- 12. Photos and names outside profiles_public (stage 1 review) ------------------------------------------------

-- One account's photo for this caller, or null. Narrow on purpose: invoker views (reels_feed) can call it without
-- clients getting the general visibility helper.
create or replace function public.visible_avatar_url(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.profile_item_visible(p.id, 'photo') then p.avatar_url else null end
  from public.profiles p where p.id = target;
$$;

-- reels_feed: the uploader's photo follows their photo audience (it used to bypass it).
create or replace view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url,
  coalesce(r.view_count, 0) as view_count,
  -- Handle first, else first name only: the clip credit never shows a fan's full name.
  -- Null when the tagged athlete posted it themself (no "Filmed by" on your own clip).
  case
    when r.player_id is not null and up.player_id = r.player_id then null
    else coalesce(
      nullif(btrim(up.username), ''),
      nullif(split_part(btrim(coalesce(up.full_name, '')), ' ', 1), '')
    )
  end as uploader_name,
  public.visible_avatar_url(up.id) as uploader_avatar_url,
  r.media_type,
  r.photo_count,
  (
    select case
      when coalesce(r.is_vault_only, false) = false then ph.image_path
      when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
      when public.current_user_role() = 'admin' then ph.image_path
      when auth.uid() is not null and r.uploaded_by = (
        select p.id from public.profiles p where p.user_id = auth.uid() limit 1
      ) then ph.image_path
      when auth.uid() is not null and r.player_id is not null and exists (
        select 1 from public.subscriptions s
        where s.subscriber_id = auth.uid()
          and s.athlete_id = r.player_id
          and s.status = 'active'
      ) then ph.image_path
      else ''
    end
    from public.reel_photos ph
    where ph.reel_id = r.id and ph.position = 0
  ) as cover_path
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;


-- get_leaderboards: fans board respects photo audience, hide-from-search and blocks.
create or replace function public.get_leaderboards(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  board_limit constant integer := 10;
  result jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  with eligible as (
    select r.id, r.title, r.player_id, r.uploaded_by, r.created_at, r.category,
      p.name as player_name, coalesce(nullif(btrim(p.school_name), ''), '') as school_name
    from public.reels r
    join public.players p on p.id = r.player_id
    where r.tag_status = 'confirmed'
      and coalesce(r.is_removed, false) = false
      and coalesce(r.is_flagged, false) = false
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_exclusive, false) = false
  ),
  hype as (
    select v.reel_id, v.user_id, v.kind
    from public.reel_hype_votes v
    join eligible e on e.id = v.reel_id
    where v.created_at::date between bounds.window_start and bounds.window_end
  ),
  views as (
    select w.reel_id, w.viewer_id
    from public.reel_views w
    join eligible e on e.id = w.reel_id
    where w.view_day between bounds.window_start and bounds.window_end
  ),
  reel_scores as (
    select e.*,
      coalesce((select count(*) from hype h where h.reel_id = e.id), 0)::int as hype,
      coalesce((select count(*) from views w where w.reel_id = e.id), 0)::int as views
    from eligible e
  ),
  player_scores as (
    select rs.player_id, max(rs.player_name) as name, max(rs.school_name) as school_name,
      sum(rs.hype)::int as hype, sum(rs.views)::int as views,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'seki'), 0)::int as seki,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'aura'), 0)::int as aura,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'flex'), 0)::int as flex
    from reel_scores rs
    group by rs.player_id
  ),
  school_fans as (
    select e.school_name, h.user_id as fan from hype h join eligible e on e.id = h.reel_id
    union
    select e.school_name, w.viewer_id as fan from views w join eligible e on e.id = w.reel_id
  ),
  school_scores as (
    select rs.school_name,
      sum(rs.hype)::int as hype,
      count(*) filter (where rs.created_at::date between bounds.window_start and bounds.window_end)::int as highlights,
      coalesce((select count(distinct sf.fan) from school_fans sf where sf.school_name = rs.school_name), 0)::int as fans
    from reel_scores rs
    where rs.school_name <> ''
    group by rs.school_name
  ),
  fan_scores as (
    select pr.id as profile_id,
      coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Fan') as name,
      case when public.profile_item_visible(pr.id, 'photo') then pr.avatar_url else null end as avatar_url,
      coalesce((select count(*) from hype h where h.user_id = pr.user_id), 0)::int as hype_given,
      coalesce((select count(*) from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end), 0)::int as clips_tagged
    from public.profiles pr
    where (exists (select 1 from hype h where h.user_id = pr.user_id)
      or exists (select 1 from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end))
      -- hidden-from-search and blocked accounts are left off the fans board
      and (not pr.hide_from_search or public.viewer_relationship(pr.id) in ('self', 'admin', 'guardian', 'friend'))
      and public.viewer_relationship(pr.id) <> 'blocked'
  )
  select jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'players_hype', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.hype desc, ps.views desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.hype desc, ps.views desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'hype', ps.hype, 'seki', ps.seki, 'aura', ps.aura, 'flex', ps.flex, 'views', ps.views
          ) as row_data
        from player_scores ps
        where ps.hype > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'players_views', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.views desc, ps.hype desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.views desc, ps.hype desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'views', ps.views, 'hype', ps.hype
          ) as row_data
        from player_scores ps
        where ps.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'highlights', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc),
            'reel_id', rs.id, 'title', rs.title, 'category', rs.category,
            'player_id', rs.player_id, 'name', rs.player_name, 'school_name', rs.school_name,
            'views', rs.views, 'hype', rs.hype
          ) as row_data
        from reel_scores rs
        where rs.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name),
            'school_name', ss.school_name, 'hype', ss.hype, 'highlights', ss.highlights,
            'fans', ss.fans, 'score', ss.hype + ss.highlights * 10 + ss.fans * 5
          ) as row_data
        from school_scores ss
        where ss.hype + ss.highlights + ss.fans > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'fans', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name),
            'profile_id', fs.profile_id, 'name', fs.name, 'avatar_url', fs.avatar_url,
            'hype_given', fs.hype_given, 'clips_tagged', fs.clips_tagged,
            'score', fs.clips_tagged * 10 + fs.hype_given
          ) as row_data
        from fan_scores fs
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- get_top_filmers: same rules as the fans board.
create or replace function public.get_top_filmers(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
begin
  select * into bounds from public.spotlight_window(kind);

  return coalesce((
    with eligible as (
      select r.id, r.uploaded_by
      from public.reels r
      join public.profiles up on up.id = r.uploaded_by
      where r.tag_status = 'confirmed'
        and not coalesce(r.is_removed, false)
        and not coalesce(r.is_flagged, false)
        and not coalesce(r.is_vault_only, false)
        and (r.player_id is null or up.player_id is distinct from r.player_id)
    ),
    scores as (
      select e.uploaded_by as profile_id,
        count(distinct e.id)::int as clips,
        coalesce(sum((select count(*) from public.reel_views w
          where w.reel_id = e.id and w.view_day between bounds.window_start and bounds.window_end)), 0)::int as views,
        coalesce(sum((select count(*) from public.reel_hype_votes v
          where v.reel_id = e.id and v.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as hype,
        coalesce(sum((select count(*) from public.filmer_props fp
          where fp.reel_id = e.id and fp.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as props
      from eligible e
      group by e.uploaded_by
    ),
    ranked as (
      select s.*, s.views + s.hype * 3 + s.props * 5 as score,
        coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''), 'Filmer') as name,
        case when public.profile_item_visible(pr.id, 'photo') then pr.avatar_url else null end as avatar_url
      from scores s
      join public.profiles pr on pr.id = s.profile_id
      where s.views + s.hype + s.props > 0
        and (not pr.hide_from_search or public.viewer_relationship(pr.id) in ('self', 'admin', 'guardian', 'friend'))
        and public.viewer_relationship(pr.id) <> 'blocked'
    )
    select jsonb_agg(row_data order by rank)
    from (
      select row_number() over (order by rk.score desc, rk.name) as rank,
        jsonb_build_object(
          'rank', row_number() over (order by rk.score desc, rk.name),
          'profile_id', rk.profile_id, 'name', rk.name, 'avatar_url', rk.avatar_url,
          'clips', rk.clips, 'views', rk.views, 'hype', rk.hype, 'props', rk.props, 'score', rk.score
        ) as row_data
      from ranked rk
      order by rank
      limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;

-- get_spotlight_standings: a filmer with no username shows a first name, never a full name.
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
            and coalesce(hot.media_type, 'video') = 'video'
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
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as clip_title,
        (
          select coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''))
          from public.reels hot
          left join public.profiles pr on pr.id = hot.uploaded_by
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as shot_by,
        max(r.created_at) as created_at
      from public.reels r
      join public.players p on p.id = r.player_id
      where r.tag_status = 'confirmed'
        and public.athlete_is_varsity_verified(p.id)
        and coalesce(r.is_removed, false) = false
        and coalesce(r.is_vault_only, false) = false
        and coalesce(r.is_flagged, false) = false
        and coalesce(r.category, 'game_play') = 'game_play'
        and coalesce(r.media_type, 'video') = 'video'
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

-- get_pending_player_tags: the uploader's first name, not full name.
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
    coalesce(nullif(split_part(btrim(coalesce(uploader.full_name, '')), ' ', 1), ''), nullif(btrim(uploader.username), ''))
  from public.reels r
  join public.players p on p.id = r.player_id
  left join public.profiles uploader on uploader.id = r.uploaded_by
  where r.tag_status = 'pending'
    and coalesce(r.is_removed, false) = false
    and not (coalesce(r.media_type, 'video') = 'photo_story' and coalesce(r.photo_count, 0) = 0)
    and (
      -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass alongside
      -- `can_confirm_player_tag`'s matching fix, above.
      role_name = 'admin'
      or public.can_confirm_player_tag(r.player_id)
    )
  order by r.created_at desc
  limit 40;
end;
$$;

-- get_donations_to_thank: the donor's first name, not full name.
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
    coalesce(nullif(split_part(btrim(coalesce(f.full_name, '')), ' ', 1), ''), 'A fan') as fan_name,
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

-- 11. Access ---------------------------------------------------------------------------------------------------------

revoke all on table public.friendships from public, anon, authenticated;
revoke all on table public.user_blocks from public, anon, authenticated;
revoke all on table public.friend_request_log from public, anon, authenticated;
grant select on table public.friendships to authenticated;
grant select on table public.user_blocks to authenticated;

drop policy if exists "Parties read friendships" on public.friendships;
create policy "Parties read friendships" on public.friendships
  for select to authenticated
  using (addressee_id = public.my_profile_id() or (requester_id = public.my_profile_id() and status <> 'declined'));

drop policy if exists "Blocker reads own blocks" on public.user_blocks;
create policy "Blocker reads own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = public.my_profile_id());

do $$
declare
  stmt text;
  fn text;
begin
  foreach stmt in array array[
    -- internal helpers: callable from views, policies and other functions; harmless booleans for clients
    'grant execute on function public.my_profile_id() to anon, authenticated, service_role',
    'revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated',
    'grant execute on function public.are_friends(uuid, uuid) to service_role',
    'revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated',
    'grant execute on function public.is_blocked_between(uuid, uuid) to service_role',
    'revoke all on function public.is_guardian_of_profile(uuid) from public, anon, authenticated',
    'grant execute on function public.is_guardian_of_profile(uuid) to service_role',
    'revoke all on function public.viewer_relationship(uuid) from public, anon, authenticated',
    'grant execute on function public.viewer_relationship(uuid) to service_role',
    'grant execute on function public.privacy_default_audience() to anon, authenticated, service_role',
    'grant execute on function public.audience_allows(text, boolean, jsonb, text) to anon, authenticated, service_role',
    'grant execute on function public.visible_avatar_url(uuid) to anon, authenticated, service_role',
    'revoke all on function public.get_public_profiles(uuid[], uuid[], text) from public',
    'grant execute on function public.get_public_profiles(uuid[], uuid[], text) to anon, authenticated, service_role',
    'revoke all on function public.profile_item_visible(uuid, text) from public, anon, authenticated',
    'grant execute on function public.profile_item_visible(uuid, text) to service_role',
    'grant execute on function public.player_hidden_from_viewer(uuid) to anon, authenticated, service_role',
    'grant execute on function public.crew_follow_blocked(uuid) to anon, authenticated, service_role',
    'grant execute on function public.athlete_stats_visible(uuid) to anon, authenticated, service_role',
    'grant execute on function public.claimed_player_ids(uuid[]) to anon, authenticated, service_role',
    'grant execute on function public.get_aura_board(integer) to anon, authenticated, service_role',
    'grant execute on function public.search_local_entities(text, text) to anon, authenticated, service_role',
    'grant execute on function public.friend_requests_enabled() to anon, authenticated, service_role',
    -- guests browse athlete profiles, including Crew counts
    'grant execute on function public.get_crew_graph(uuid) to anon, authenticated, service_role',
    -- signed-in only
    'revoke all on function public.privacy_settings_json(uuid) from public, anon, authenticated',
    'revoke all on function public.apply_privacy_settings(uuid, jsonb) from public, anon, authenticated',
    'revoke all on function public.guard_profiles_privacy() from public, anon, authenticated',
    'revoke all on function public.search_taggable_accounts(text) from public, anon',
    'grant execute on function public.search_taggable_accounts(text) to authenticated, service_role',
    'grant execute on function public.privacy_settings_json(uuid) to service_role',
    'grant execute on function public.apply_privacy_settings(uuid, jsonb) to service_role'
  ] loop
    fn := substring(stmt from 'function (public\.[a-z_]+\([^)]*\))');
    if to_regprocedure(fn) is not null then
      execute stmt;
    end if;
  end loop;
  foreach fn in array array[
    'public.get_my_privacy()', 'public.set_my_privacy(jsonb)', 'public.request_friend(uuid)', 'public.respond_friend(uuid, boolean)',
    'public.remove_friend(uuid)', 'public.list_my_friends()', 'public.block_user(uuid)', 'public.unblock_user(uuid)',
    'public.list_my_blocks()', 'public.admin_get_privacy(uuid)', 'public.admin_reset_privacy(uuid)',
    'public.admin_set_hide_from_search(uuid, boolean)',
    'public.admin_end_friendship(uuid, uuid)', 'public.admin_privacy_report()',
    'public.toggle_crew_follow(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- 13. Safety check for databases with extra policies (staging was built by hand) -------------------------------------
do $$
declare
  extra text;
begin
  select string_agg(tablename || ': ' || policyname, ', ') into extra
  from pg_policies
  where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')
    and ((tablename = 'profiles' and policyname not in ('Read own profile or admin', 'Users update own profile', 'Users insert own profile'))
      or (tablename = 'crew_follows' and policyname not in ('Read own or own athlete crew follows', 'Users write own crew follows')));
  if extra is not null then
    raise exception 'Other read policies still open these tables (%). Review and drop them, then re-run.', extra;
  end if;
end;
$$;

-- Tag approval — stage 2 of PRIV-01 (2026-10-14).
--
-- Purpose
--   Owner decision 2026-10-13: tags are approved by the person tagged, with a clear difference between approved and not
--   approved, designed so waiting tags do not cost athletes highlights, Spotlight credit or donations. Design panel
--   findings applied (docs/engineering/design/PROFILE_PRIVACY_DESIGN.md §3):
--   1. Decisions move only from pending to confirmed or rejected (admins may undo; undoing an approved tag that already
--      took donations is admin-only). A rejection clears the athlete from the clip and is remembered
--      (reel_tag_rejections): the same athlete cannot be tagged on that clip again, and after three declines that
--      uploader cannot tag that athlete at all. One uploader may have at most five tags of an athlete waiting.
--   2. Tags from someone the athlete blocked are rejected quietly; "Auto-approve tags from friends" approves a friend's tag.
--   3. Once an athlete has a verified account, only they, their guardian or an admin approve their tags (school
--      operators still confirm for athletes with no account).
--   4. reels_feed names a pending tag's athlete only to the uploader, the athlete, their guardian and admins, and a
--      rejected tag names nobody (a stranger's clip must not show a private athlete before they agree).
--   5. Credit is not lost while a tag waits: views and hype already accrue on a pending clip; Spotlight now places a clip
--      in the week its tag was approved, and leaderboards count earlier reactions and views on the approval date.
--
--   Stage 2 review (2026-10-14) applied: clients write only the app's reel columns (an uploader could approve their own
--   tag and set counters); a decline does not reveal who declined, even on the uploader's own reels row; a blocked
--   uploader's tag ends exactly like a decline (re-review: blocking someone with pending tags failed — fixed in
--   block_user; known limit: the quiet decline is immediate); the athlete
--   can remove an approved tag (unless it took donations); admins can undo a rejection; re-confirming keeps the date;
--   school operators are exempt from the pending cap. Follow-up (COMMERCE / CHECKOUT): refuse a donation on a pending
--   clip before charging (create-payment-intent does not receive the clip today; the app already disables Donate).
--
-- Owner: HIGHLIGHTS → ACCOUNT_TAGS, UPLOAD; SPOTLIGHT / LEADERBOARDS for credit; reviews RLS_SECURITY, MINOR_SAFETY.
-- Depends on: 20261014090000_profile_privacy.sql (is_blocked_between, are_friends, profiles.tag_review).
-- Safe to re-run: create table if not exists; create or replace.
-- Applied: written 2026-10-14, not applied anywhere.
-- Rollback: re-run the previous definitions of the five functions and reels_feed from schema.sql history; the
--   rejections table can stay.

create table if not exists public.reel_tag_rejections (
  -- Deferred so the tag trigger can record a block's quiet decline while the clip row is still being inserted.
  reel_id uuid not null references public.reels (id) on delete cascade deferrable initially deferred,
  player_id uuid not null references public.players (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  -- null = declined automatically because of a block (an admin can still undo it)
  rejected_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz not null default timezone('utc', now()),
  primary key (reel_id, player_id)
);
create index if not exists reel_tag_rejections_uploader_idx on public.reel_tag_rejections (player_id, uploader_id);
alter table public.reel_tag_rejections enable row level security;
revoke all on table public.reel_tag_rejections from public, anon, authenticated;

-- Whether the caller is a school operator at this roster athlete's school (same rule as can_confirm_player_tag).
create or replace function public.is_school_operator_for(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players athlete
    join public.profiles pr on pr.user_id = auth.uid()
    join public.schools_and_teams s on s.id = pr.school_id
    where athlete.id = target_player_id
      and (public.current_user_role() = 'operator' or coalesce(pr.roles, array[]::text[]) @> array['operator']::text[])
      and (lower(s.name) = lower(athlete.school_name) or lower(s.name) = lower(coalesce(athlete.team, '')))
  );
$$;

-- Whether the caller is a party to a clip's athlete tag: admin, uploader, the athlete's account or their guardian.
create or replace function public.tag_party(clip_uploaded_by uuid, clip_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'admin'
    or (clip_uploaded_by is not null and clip_uploaded_by = public.my_profile_id())
    or (clip_player_id is not null and exists (
      select 1 from public.profiles p where p.player_id = clip_player_id and p.user_id = auth.uid()
    ))
    or (clip_player_id is not null and exists (
      select 1 from public.players pl where pl.id = clip_player_id and pl.guardian_id is not null and pl.guardian_id = public.my_profile_id()
    ));
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
  if role_name = 'admin' then
    return true;
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    return false;
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;
  if actor is null then
    return false;
  end if;

  if athlete.guardian_id is not null and athlete.guardian_id = actor then
    return true;
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = actor and pr.player_id = athlete.id and pr.verification_status = 'verified'
  ) then
    return true;
  end if;

  -- Once an athlete has a verified account, only they, their guardian or an admin approve their tags ("Review every
  -- tag" means it). A school operator still confirms tags for athletes with no account.
  if exists (select 1 from public.profiles vp where vp.player_id = athlete.id and vp.verification_status = 'verified') then
    return false;
  end if;

  if role_name = 'operator'
     or exists (
       select 1 from public.profiles pr
       where pr.id = actor and coalesce(pr.roles, array[]::text[]) @> array['operator']::text[]
     )
  then
    if exists (
      select 1
      from public.profiles pr
      join public.schools_and_teams s on s.id = pr.school_id
      where pr.id = actor
        and (lower(s.name) = lower(athlete.school_name) or lower(s.name) = lower(coalesce(athlete.team, '')))
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
  account public.profiles%rowtype;
begin
  -- confirm_reel_player_tag sets this while it records a decision (it clears player_id on a rejection).
  if coalesce(current_setting('app.tapuai_tag_write', true), '') = 'on' then
    return NEW;
  end if;
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  if NEW.uploaded_by is null then
    NEW.uploaded_by := actor;
  end if;

  -- Tag status and who approved it change only through confirm_reel_player_tag (or the server / an admin).
  if TG_OP = 'UPDATE'
     and (NEW.tag_status is distinct from OLD.tag_status or NEW.tag_confirmed_at is distinct from OLD.tag_confirmed_at
          or NEW.tag_confirmed_by is distinct from OLD.tag_confirmed_by)
     and NEW.player_id is not distinct from OLD.player_id
     and not public.is_trusted_server() and public.current_user_role() is distinct from 'admin' then
    raise exception 'Tags are approved by the athlete.';
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

  select * into account from public.profiles p
  where p.player_id = NEW.player_id
  order by (p.verification_status = 'verified') desc
  limit 1;

  if public.current_user_role() is distinct from 'admin' then
    -- The athlete already declined this clip.
    if exists (select 1 from public.reel_tag_rejections x where x.reel_id = NEW.id and x.player_id = NEW.player_id) then
      raise exception 'This athlete declined being tagged on this clip.';
    end if;
    -- Three declines from this athlete: this uploader can no longer tag them.
    if NEW.uploaded_by is not null and (
      select count(*) from public.reel_tag_rejections x where x.player_id = NEW.player_id and x.uploader_id = NEW.uploaded_by
    ) >= 3 then
      raise exception 'You can''t tag this athlete.';
    end if;
    -- At most five tags of the same athlete waiting on them from one uploader (a school operator uploading the
    -- athlete's games is exempt).
    if NEW.uploaded_by is not null and not public.is_school_operator_for(NEW.player_id) and (
      select count(*) from public.reels q
      where q.uploaded_by = NEW.uploaded_by and q.player_id = NEW.player_id and q.tag_status = 'pending' and q.id <> NEW.id
    ) >= 5 then
      raise exception 'Wait for this athlete to review your earlier tags.';
    end if;
  end if;

  -- A blocked uploader's tag ends exactly like a decline (untagged, nobody named), so neither reels_feed nor their
  -- own reels row tells them about the block (re-review P2). Known limit: it happens at once, not after a delay.
  if account.id is not null and NEW.uploaded_by is not null and public.is_blocked_between(account.id, NEW.uploaded_by) then
    insert into public.reel_tag_rejections (reel_id, player_id, uploader_id, rejected_by)
    values (NEW.id, NEW.player_id, NEW.uploaded_by, null)
    on conflict (reel_id, player_id) do nothing;
    NEW.player_id := null;
    NEW.tag_status := 'rejected';
    NEW.tag_confirmed_at := null;
    NEW.tag_confirmed_by := null;
    return NEW;
  end if;

  -- "Auto-approve tags from friends".
  if account.id is not null and account.tag_review = 'auto_friends' and NEW.uploaded_by is not null
     and public.are_friends(account.id, NEW.uploaded_by) then
    NEW.tag_status := 'confirmed';
    NEW.tag_confirmed_at := timezone('utc', now());
    NEW.tag_confirmed_by := account.id;
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
  is_admin boolean := public.current_user_role() = 'admin';
begin
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;
  -- An admin re-confirming a rejection restores the athlete from the decline record.
  if clip.player_id is null and is_admin and action = 'confirm' and clip.tag_status = 'rejected' then
    select x.player_id into clip.player_id from public.reel_tag_rejections x
    where x.reel_id = clip.id order by x.rejected_at desc limit 1;
    delete from public.reel_tag_rejections x where x.reel_id = clip.id and x.player_id = clip.player_id;
  end if;
  if clip.player_id is null then
    raise exception 'This clip has no tagged player.';
  end if;
  if not public.can_confirm_player_tag(clip.player_id) then
    raise exception 'Only the athlete, their guardian or an admin can review this tag.';
  end if;
  -- Decisions move only forward from pending; undoing an approved tag that already took donations is an admin call.
  -- The athlete may still remove an approved tag (for example an auto-approved friend's tag); otherwise decisions
  -- move only forward from pending.
  if clip.tag_status <> 'pending' and not is_admin and not (action = 'reject' and clip.tag_status = 'confirmed') then
    raise exception 'This tag was already reviewed.';
  end if;
  if action = 'reject' and clip.tag_status = 'confirmed'
     and exists (select 1 from public.tips t where t.reel_id = clip.id) and not is_admin then
    raise exception 'This tag already has donations; ask an admin.';
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;

  perform set_config('app.tapuai_tag_write', 'on', true);
  if action = 'reject' then
    -- Remember the decline so the same athlete cannot be tagged on this clip again, then untag it.
    insert into public.reel_tag_rejections (reel_id, player_id, uploader_id, rejected_by)
    values (clip.id, clip.player_id, clip.uploaded_by, actor)
    on conflict (reel_id, player_id) do nothing;
    -- Who declined, and when, stays in reel_tag_rejections: the uploader can read their own reels row, and a guardian's
    -- decline must not name the guardian (re-review P2). A quiet rejection looks the same.
    update public.reels
    set tag_status = 'rejected', player_id = null, tag_confirmed_at = null, tag_confirmed_by = null
    where id = target_reel_id
    returning * into clip;
  else
    update public.reels
    set tag_status = 'confirmed', player_id = clip.player_id,
        -- re-confirming an approved tag keeps its date, so the clip does not land in a second Spotlight week
        tag_confirmed_at = case when clip.tag_status = 'confirmed' then clip.tag_confirmed_at else timezone('utc', now()) end,
        tag_confirmed_by = case when clip.tag_status = 'confirmed' then clip.tag_confirmed_by else actor end
    where id = target_reel_id
    returning * into clip;
  end if;
  perform set_config('app.tapuai_tag_write', 'off', true);

  perform public.sync_live_spotlight_awards();

  return jsonb_build_object(
    'id', clip.id,
    'player_id', clip.player_id,
    'tag_status', clip.tag_status,
    'tag_confirmed_at', clip.tag_confirmed_at
  );
end;
$$;

create or replace view public.reels_feed as
select
  r.id,
  r.title,
  -- A pending tag names the athlete only to the uploader, the athlete, their guardian and admins; a rejected tag names
  -- nobody (PRIV-01 stage 2, MINOR_SAFETY): a stranger's clip must not show a private athlete before they agree.
  case
    when r.tag_status = 'rejected' and public.current_user_role() is distinct from 'admin' then null
    when r.tag_status = 'pending' and not public.tag_party(r.uploaded_by, r.player_id) then null
    else r.player_id
  end as player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  -- A blocked uploader's quiet rejection and a real decline look the same (see reels_apply_tag_defaults).
  r.tag_status,
  -- Who decided, and when, only on an approved tag (a decline must not reveal the athlete or guardian).
  case when r.tag_status = 'confirmed' or public.current_user_role() = 'admin' then r.tag_confirmed_at else null end as tag_confirmed_at,
  case when r.tag_status = 'confirmed' or public.current_user_role() = 'admin' then r.tag_confirmed_by else null end as tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url,
  coalesce(r.view_count, 0) as view_count,
  -- Handle first, else first name only: the clip credit never shows a fan's full name.
  -- Null when the tagged athlete posted it themself (no "Filmed by" on your own clip).
  case
    when r.player_id is not null and up.player_id = r.player_id then null
    else coalesce(
      nullif(btrim(up.username), ''),
      nullif(split_part(btrim(coalesce(up.full_name, '')), ' ', 1), '')
    )
  end as uploader_name,
  public.visible_avatar_url(up.id) as uploader_avatar_url,
  r.media_type,
  r.photo_count,
  (
    select case
      when coalesce(r.is_vault_only, false) = false then ph.image_path
      when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
      when public.current_user_role() = 'admin' then ph.image_path
      when auth.uid() is not null and r.uploaded_by = (
        select p.id from public.profiles p where p.user_id = auth.uid() limit 1
      ) then ph.image_path
      when auth.uid() is not null and r.player_id is not null and exists (
        select 1 from public.subscriptions s
        where s.subscriber_id = auth.uid()
          and s.athlete_id = r.player_id
          and s.status = 'active'
      ) then ph.image_path
      else ''
    end
    from public.reel_photos ph
    where ph.reel_id = r.id and ph.position = 0
  ) as cover_path
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;


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
            and coalesce(hot.media_type, 'video') = 'video'
            and coalesce(hot.tag_confirmed_at, hot.created_at)::date between bounds.window_start and bounds.window_end
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
            and coalesce(hot.media_type, 'video') = 'video'
            and coalesce(hot.tag_confirmed_at, hot.created_at)::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as clip_title,
        (
          select coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''))
          from public.reels hot
          left join public.profiles pr on pr.id = hot.uploaded_by
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and coalesce(hot.tag_confirmed_at, hot.created_at)::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as shot_by,
        max(r.created_at) as created_at
      from public.reels r
      join public.players p on p.id = r.player_id
      where r.tag_status = 'confirmed'
        and public.athlete_is_varsity_verified(p.id)
        and coalesce(r.is_removed, false) = false
        and coalesce(r.is_vault_only, false) = false
        and coalesce(r.is_flagged, false) = false
        and coalesce(r.category, 'game_play') = 'game_play'
        and coalesce(r.media_type, 'video') = 'video'
        and coalesce(r.tag_confirmed_at, r.created_at)::date between bounds.window_start and bounds.window_end
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

create or replace function public.get_leaderboards(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  board_limit constant integer := 10;
  result jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  with eligible as (
    select r.id, r.title, r.player_id, r.uploaded_by, r.created_at, r.category,
      coalesce(r.tag_confirmed_at, r.created_at) as counted_at,
      p.name as player_name, coalesce(nullif(btrim(p.school_name), ''), '') as school_name
    from public.reels r
    join public.players p on p.id = r.player_id
    where r.tag_status = 'confirmed'
      and coalesce(r.is_removed, false) = false
      and coalesce(r.is_flagged, false) = false
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_exclusive, false) = false
  ),
  hype as (
    select v.reel_id, v.user_id, v.kind
    from public.reel_hype_votes v
    join eligible e on e.id = v.reel_id
    where greatest(v.created_at, e.counted_at)::date between bounds.window_start and bounds.window_end
  ),
  views as (
    select w.reel_id, w.viewer_id
    from public.reel_views w
    join eligible e on e.id = w.reel_id
    where greatest(w.view_day, e.counted_at::date) between bounds.window_start and bounds.window_end
  ),
  reel_scores as (
    select e.*,
      coalesce((select count(*) from hype h where h.reel_id = e.id), 0)::int as hype,
      coalesce((select count(*) from views w where w.reel_id = e.id), 0)::int as views
    from eligible e
  ),
  player_scores as (
    select rs.player_id, max(rs.player_name) as name, max(rs.school_name) as school_name,
      sum(rs.hype)::int as hype, sum(rs.views)::int as views,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'seki'), 0)::int as seki,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'aura'), 0)::int as aura,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'flex'), 0)::int as flex
    from reel_scores rs
    group by rs.player_id
  ),
  school_fans as (
    select e.school_name, h.user_id as fan from hype h join eligible e on e.id = h.reel_id
    union
    select e.school_name, w.viewer_id as fan from views w join eligible e on e.id = w.reel_id
  ),
  school_scores as (
    select rs.school_name,
      sum(rs.hype)::int as hype,
      count(*) filter (where rs.counted_at::date between bounds.window_start and bounds.window_end)::int as highlights,
      coalesce((select count(distinct sf.fan) from school_fans sf where sf.school_name = rs.school_name), 0)::int as fans
    from reel_scores rs
    where rs.school_name <> ''
    group by rs.school_name
  ),
  fan_scores as (
    select pr.id as profile_id,
      coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Fan') as name,
      case when public.profile_item_visible(pr.id, 'photo') then pr.avatar_url else null end as avatar_url,
      coalesce((select count(*) from hype h where h.user_id = pr.user_id), 0)::int as hype_given,
      coalesce((select count(*) from eligible e where e.uploaded_by = pr.id
        and e.counted_at::date between bounds.window_start and bounds.window_end), 0)::int as clips_tagged
    from public.profiles pr
    where (exists (select 1 from hype h where h.user_id = pr.user_id)
      or exists (select 1 from eligible e where e.uploaded_by = pr.id
        and e.counted_at::date between bounds.window_start and bounds.window_end))
      -- hidden-from-search and blocked accounts are left off the fans board
      and (not pr.hide_from_search or public.viewer_relationship(pr.id) in ('self', 'admin', 'guardian', 'friend'))
      and public.viewer_relationship(pr.id) <> 'blocked'
  )
  select jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'players_hype', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.hype desc, ps.views desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.hype desc, ps.views desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'hype', ps.hype, 'seki', ps.seki, 'aura', ps.aura, 'flex', ps.flex, 'views', ps.views
          ) as row_data
        from player_scores ps
        where ps.hype > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'players_views', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.views desc, ps.hype desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.views desc, ps.hype desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'views', ps.views, 'hype', ps.hype
          ) as row_data
        from player_scores ps
        where ps.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'highlights', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc),
            'reel_id', rs.id, 'title', rs.title, 'category', rs.category,
            'player_id', rs.player_id, 'name', rs.player_name, 'school_name', rs.school_name,
            'views', rs.views, 'hype', rs.hype
          ) as row_data
        from reel_scores rs
        where rs.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name),
            'school_name', ss.school_name, 'hype', ss.hype, 'highlights', ss.highlights,
            'fans', ss.fans, 'score', ss.hype + ss.highlights * 10 + ss.fans * 5
          ) as row_data
        from school_scores ss
        where ss.hype + ss.highlights + ss.fans > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'fans', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name),
            'profile_id', fs.profile_id, 'name', fs.name, 'avatar_url', fs.avatar_url,
            'hype_given', fs.hype_given, 'clips_tagged', fs.clips_tagged,
            'score', fs.clips_tagged * 10 + fs.hype_given
          ) as row_data
        from fan_scores fs
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- The trigger also sees direct writes to the tag columns, so it can refuse them.
drop trigger if exists reels_apply_tag_defaults on public.reels;
create trigger reels_apply_tag_defaults
  before insert or update of player_id, uploaded_by, tag_status, tag_confirmed_at, tag_confirmed_by
  on public.reels
  for each row
  execute procedure public.reels_apply_tag_defaults();

-- Clients write only the columns the app writes. Hosted Supabase grants every column by default, which made the
-- schema's column list meaningless: an uploader could approve their own tag or set their own counters and totals.
do $$
declare
  ins text;
  upd text;
begin
  select string_agg(quote_ident(column_name), ', ') into ins
  from information_schema.columns
  where table_schema = 'public' and table_name = 'reels'
    and column_name in ('id', 'video_url', 'title', 'player_id', 'game_id', 'is_exclusive', 'is_vault_only', 'category',
                        'attested_at', 'rights_version', 'media_type');
  select string_agg(quote_ident(column_name), ', ') into upd
  from information_schema.columns
  where table_schema = 'public' and table_name = 'reels'
    and column_name in ('title', 'category', 'is_exclusive', 'is_vault_only', 'flash_unlock_until');
  execute 'revoke insert, update on public.reels from anon, authenticated';
  execute format('grant insert (%s) on public.reels to authenticated', ins);
  execute format('grant update (%s) on public.reels to authenticated', upd);
end;
$$;

do $$
declare
  stmt text;
  fn text;
begin
  foreach stmt in array array[
    'grant execute on function public.tag_party(uuid, uuid) to anon, authenticated, service_role',
    'revoke all on function public.is_school_operator_for(uuid) from public, anon',
    'grant execute on function public.is_school_operator_for(uuid) to authenticated, service_role',
    'revoke all on function public.confirm_reel_player_tag(uuid, text) from public, anon',
    'grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated, service_role'
  ] loop
    fn := substring(stmt from 'function (public\.[a-z_]+\([^)]*\))');
    if to_regprocedure(fn) is not null then
      execute stmt;
    end if;
  end loop;
end;
$$;

-- Minor accounts: birth month and year, teen-safe defaults, guardian link, signed consent and supervision (MINOR-01,
-- 2026-10-14). Builds on PRIV-01 (20261014090000_profile_privacy.sql, 20261014100000_tag_approval.sql).
--
-- Purpose
--   Owner decisions 2026-10-14 (docs/engineering/design/MINOR_ACCOUNTS_DESIGN.md): a guardian is linked and signs a
--   consent, but is not "total dictatorship"; teens can go solo within the law; sign-up stays fast.
--   1. profiles.birth_year / birth_month (no day) replace the 13+ checkbox. Bands: under_13, teen_13_15, teen_16_17,
--      adult, unknown (accounts made before this). A person reaches an age at the start of the month after their birth
--      month (never early). Under 13: sign-up is refused; a later under-13 entry blocks the account (my_profile_id()
--      stops resolving, profile details cleared, listed for deletion on the admin desk). Self-corrections only to a
--      younger age; older needs support.
--   2. Teens get teen-safe defaults: private, friend requests only from other teens (new value 'teens').
--   3. guardian_links (a teen's one-time invite code, or the admin-set athlete guardian), at most two per teen; either
--      side can end it. guardian_consents keeps the signed form (version, typed name, relationship, permissions,
--      revocation). Consent unlocks a public profile and payouts of donations (athlete_payout_status gains the reason
--      'needs_guardian_consent' for a known minor).
--   4. Supervision: the teen and the guardian see the same summary (settings, counts never who, consent, requests,
--      events). Under-16s: going public or opening friend requests to everyone becomes a guardian approve / decline
--      request. This replaces the PRIV-01 guardian lock (removed from stage 1 before anything was applied).
--   5. Admin: overview, birth correction with a reason, end a link, report, the age-blocked list, a retention purge;
--      switch minors.guardian_links pauses new invites and links (it never loosens a rule).
--   Design review (MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, LEGAL; 2026-10-14) applied: a code-linked guardian
--   gets only the supervision summary, never the teen's only-me items (the PRIV-01 'guardian' relationship stays the
--   admin-set athlete guardian); the teen confirms each code link; blocking a guardian ends the link; codes last 48
--   hours; new accounts with no age yet ('not_given') cannot be friended and cannot friend teens; payouts need positive
--   adult evidence or, for a minor, the donations consent of the guardian on record; consent records are append-only,
--   survive account deletion and pin the signed text by hash; a guardian sees only events after they linked;
--   retention purge; under-13 clips are hidden at once.
--   SQL review (RLS_SECURITY + MINOR_SAFETY, 2026-10-14) applied: "off" / "no" / "f" could make a teen public (booleans
--   are now read the way Postgres casts them and the consent rule is re-checked after every save); one refusal message
--   for every account in sign_guardian_consent; a guardian sees nothing until the teen confirms; the guardian on record
--   cannot re-link after the teen ended or blocked them; a closed under-13 account is refused by every table (a
--   restrictive "Closed accounts" policy on every RLS table) and its friendships end; stale waiting links are closed;
--   payouts treat a typed adult age as enough only with the account's own Stripe payouts on (Stripe checks the birth
--   date) and read the claimant's age on the identity path; consent records also refuse truncate and later edits.
--   Future migrations that add an RLS table must add the "Closed accounts" policy too.
--
-- Owner: PROFILE (via ENGINEERING, CTO), with AUTH, ONBOARDING, CUSTODIAL, ADMIN; reviews MINOR_SAFETY,
--   PRIVACY_ENGINEERING, RLS_SECURITY, CUSTODIAL, LEGAL (consent form, LEGAL_BRIEFING row AA), DATA_GOVERNANCE.
-- Needs: 20261014090000 and 20261014100000 first; hash_secret() (athlete verification ladder).
-- Safe to re-run: add column if not exists; create table if not exists; create or replace; drop trigger if exists.
-- Applied: written 2026-10-14, not applied anywhere.
-- Rollback: drop the five new tables and the functions below; re-apply set_my_privacy, get_my_privacy, request_friend,
--   my_profile_id from 20261014090000 and athlete_payout_status / handle_new_auth_user from
--   schema.sql history; the birth columns can stay (unused).

-- 1. Age -------------------------------------------------------------------------------------------------------------

alter table public.profiles add column if not exists birth_year smallint;
alter table public.profiles add column if not exists birth_month smallint;
alter table public.profiles add column if not exists birth_recorded_at timestamptz;
alter table public.profiles add column if not exists age_blocked_at timestamptz;
-- false for accounts made before this change (their missing age is 'unknown', today's behaviour); true for every new
-- account (a missing age is 'not_given': no friend requests in or to teens, no guardian link, payouts wait).
alter table public.profiles add column if not exists age_check_required boolean;
update public.profiles set age_check_required = false where age_check_required is null;
alter table public.profiles alter column age_check_required set default true;
alter table public.profiles alter column age_check_required set not null;

alter table public.profiles drop constraint if exists profiles_birth_month_check;
alter table public.profiles add constraint profiles_birth_month_check check (
  (birth_year is null and birth_month is null)
  or (birth_month between 1 and 12 and birth_year between 1900 and 2100)
);

-- Whole years old on `on_date`, counting the birthday as the last day of the birth month (up to a month late).
create or replace function public.age_band_from(birth_y integer, birth_m integer, on_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when birth_y is null or birth_m is null then 'unknown'
    else (
      select case when y < 13 then 'under_13' when y < 16 then 'teen_13_15' when y < 18 then 'teen_16_17' else 'adult' end
      from (
        select floor(((extract(year from on_date)::int * 12 + extract(month from on_date)::int) - (birth_y * 12 + birth_m) - 1) / 12.0)::int as y
      ) a
    )
  end;
$$;

create or replace function public.is_minor_band(band text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(band in ('teen_13_15', 'teen_16_17'), false);
$$;

create or replace function public.profile_age_band(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case when p.birth_year is null and p.age_check_required then 'not_given'
                else public.age_band_from(p.birth_year, p.birth_month, current_date) end
    from public.profiles p where p.id = target
  ), 'unknown');
$$;

-- An age-blocked (under-13) account is treated as signed out by every function that asks who the caller is.
create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.user_id = auth.uid() and p.age_blocked_at is null limit 1;
$$;

-- 2. Guardian links, invites, consent, approvals, events ---------------------------------------------------------------

create table if not exists public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  minor_id uuid not null references public.profiles (id) on delete cascade,
  guardian_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('invite', 'custodial')),
  created_at timestamptz not null default timezone('utc', now()),
  -- An invite link counts only once the teen confirms "Is this your parent or guardian?" (7 days to answer); the
  -- admin-set athlete guardian's link is confirmed when made.
  confirmed_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles (id) on delete set null,
  end_reason text check (end_reason is null or char_length(end_reason) <= 200),
  constraint guardian_links_not_self check (minor_id <> guardian_id)
);
create unique index if not exists guardian_links_one_active on public.guardian_links (minor_id, guardian_id) where ended_at is null;
create index if not exists guardian_links_guardian_idx on public.guardian_links (guardian_id) where ended_at is null;

-- Only the hash of a code is stored; a code works once, for 48 hours, and only the teen's newest one works.
create table if not exists public.guardian_invites (
  code_hash text primary key,
  minor_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null
);
create index if not exists guardian_invites_minor_idx on public.guardian_invites (minor_id, created_at desc);

-- Wrong-code attempts, so an 8-character code cannot be guessed (10 a day per account).
create table if not exists public.guardian_invite_attempts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists guardian_invite_attempts_idx on public.guardian_invite_attempts (profile_id, created_at desc);

-- Append-only signed records (guard_consent_records). They outlive the accounts (ids become null) for the period
-- counsel sets (LEGAL row AA); form_sha256 pins the exact text signed (data/guardianConsent.ts).
create table if not exists public.guardian_consents (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.guardian_links (id) on delete set null,
  minor_id uuid references public.profiles (id) on delete set null,
  guardian_id uuid references public.profiles (id) on delete set null,
  form_version text not null check (char_length(form_version) <= 40),
  form_sha256 text not null check (form_sha256 ~ '^[0-9a-f]{64}$'),
  -- the typed full name is the signature
  signer_name text not null check (char_length(btrim(signer_name)) between 2 and 120),
  relationship text not null check (relationship in ('parent', 'legal_guardian')),
  allows_donations boolean not null,
  allows_public_profile boolean not null,
  signed_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 200)
);
create unique index if not exists guardian_consents_one_active on public.guardian_consents (link_id) where revoked_at is null;
create index if not exists guardian_consents_minor_idx on public.guardian_consents (minor_id) where revoked_at is null;

create table if not exists public.guardian_approval_requests (
  id uuid primary key default gen_random_uuid(),
  minor_id uuid not null references public.profiles (id) on delete cascade,
  change_key text not null check (change_key in ('account_public', 'friend_requests_everyone')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled', 'expired')),
  requested_at timestamptz not null default timezone('utc', now()),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz
);
create unique index if not exists guardian_approval_one_pending on public.guardian_approval_requests (minor_id, change_key) where status = 'pending';

-- What the teen and their guardian both see. Kept 365 days (trimmed on write, filtered on read, purged by the desk).
create table if not exists public.supervision_events (
  id bigint generated always as identity primary key,
  minor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'age_recorded', 'age_corrected', 'invite_created', 'guardian_linked', 'guardian_unlinked', 'consent_signed',
    'consent_withdrawn', 'settings_changed', 'made_private', 'approval_requested', 'approval_decided', 'approval_cancelled'
  )),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists supervision_events_minor_idx on public.supervision_events (minor_id, created_at desc);

alter table public.guardian_links enable row level security;
alter table public.guardian_invites enable row level security;
alter table public.guardian_invite_attempts enable row level security;
alter table public.guardian_consents enable row level security;
alter table public.guardian_approval_requests enable row level security;
alter table public.supervision_events enable row level security;

-- 3. Building blocks ---------------------------------------------------------------------------------------------------

create or replace function public.guardian_links_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (c.published -> 'features' ->> 'minors.guardian_links')::boolean
    from public.app_runtime_config c where c.id = 'default'
  ), true);
$$;

-- The consent form text lives in the app (data/guardianConsent.ts); the server accepts only this version and hash.
create or replace function public.guardian_consent_form_version()
returns text
language sql
immutable
set search_path = ''
as $$
  select '2026-10-14-draft'::text;
$$;

create or replace function public.guardian_consent_form_sha256()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'f39f7c23538fcf209fb368bd56f16250ba685cd7c3a4bf23d94be19cea0caa0f'::text;
$$;

create or replace function public.guard_consent_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_trusted_server() then
      return old;
    end if;
    raise exception 'Signed consent records are kept.';
  end if;
  if (new.form_version, new.form_sha256, new.signer_name, new.relationship, new.allows_donations, new.allows_public_profile, new.signed_at)
     is distinct from (old.form_version, old.form_sha256, old.signer_name, old.relationship, old.allows_donations, old.allows_public_profile, old.signed_at)
     or new.id is distinct from old.id
     or (old.revoked_at is not null and (new.revoked_at is distinct from old.revoked_at or new.revoke_reason is distinct from old.revoke_reason
         or (new.revoked_by is distinct from old.revoked_by and new.revoked_by is not null)))
     or (new.link_id is distinct from old.link_id and new.link_id is not null)
     or (new.minor_id is distinct from old.minor_id and new.minor_id is not null)
     or (new.guardian_id is distinct from old.guardian_id and new.guardian_id is not null) then
    raise exception 'Signed consent records are kept as signed; sign again instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_consents_append_only on public.guardian_consents;
create trigger guardian_consents_append_only
  before update or delete on public.guardian_consents
  for each row execute function public.guard_consent_records();

create or replace function public.guard_consent_truncate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Signed consent records are kept.';
end;
$$;

drop trigger if exists guardian_consents_no_truncate on public.guardian_consents;
create trigger guardian_consents_no_truncate
  before truncate on public.guardian_consents
  for each statement execute function public.guard_consent_truncate();

create or replace function public.first_name_of(target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), nullif(btrim(p.username), ''), 'Someone')
  from public.profiles p where p.id = target;
$$;

-- An active consent on a confirmed link. Donations also need the signer to be the guardian on record for the athlete
-- (players.guardian_id, admin-set; the custodial money guardian) at the time it is checked.
create or replace function public.minor_has_consent(minor uuid, scope text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_consents c
    join public.guardian_links l on l.id = c.link_id and l.ended_at is null and l.confirmed_at is not null
    where c.minor_id = minor and c.revoked_at is null
      and case scope
        when 'public_profile' then c.allows_public_profile
        when 'donations' then c.allows_donations and exists (
          select 1 from public.profiles t join public.players pl on pl.id = t.player_id
          where t.id = minor and t.verification_status = 'verified' and pl.guardian_id = c.guardian_id)
        else false end
  );
$$;

create or replace function public.minor_guardian_count(minor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.guardian_links l where l.minor_id = minor and l.ended_at is null and l.confirmed_at is not null;
$$;

-- Confirmed links plus invite links still waiting for the teen (both use one of the two places).
create or replace function public.minor_link_slots_used(minor uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.guardian_links l
  where l.minor_id = minor and l.ended_at is null
    and (l.confirmed_at is not null or l.created_at > timezone('utc', now()) - interval '7 days');
$$;

-- The caller supervises this teen: a confirmed link while the account is 13–17. This is NOT the PRIV-01 'guardian'
-- viewer relationship (which stays the admin-set athlete guardian): supervision is only the summary below.
create or replace function public.is_supervising_guardian(minor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.guardian_links l
    where l.minor_id = minor and l.guardian_id = public.my_profile_id() and l.ended_at is null and l.confirmed_at is not null
      and public.is_minor_band(public.profile_age_band(minor))
  );
$$;

create or replace function public.is_guardian_of_record(minor uuid, guardian uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles t join public.players pl on pl.id = t.player_id
    where t.id = minor and t.verification_status = 'verified' and pl.guardian_id = guardian
  );
$$;

create or replace function public.log_supervision_event(minor uuid, event_kind text, event_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_minor_band(public.profile_age_band(minor)) then
    return;
  end if;
  insert into public.supervision_events (minor_id, kind, detail, actor_id)
  values (minor, event_kind, coalesce(event_detail, '{}'::jsonb), public.my_profile_id());
  delete from public.supervision_events e
  where e.minor_id = minor and e.created_at < timezone('utc', now()) - interval '365 days';
end;
$$;

-- The athlete account for a roster athlete: the verified one, else the open claimant.
create or replace function public.athlete_profile_for_player(target_player_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.id from public.profiles p where p.player_id = target_player_id and p.verification_status = 'verified' limit 1),
    (select v.requester_user_id from public.verification_requests v
       where v.player_id = target_player_id and v.status in ('pending', 'disputed') order by v.created_at desc limit 1)
  );
$$;

-- Why money for this athlete must wait, or null. `account` is the athlete account money would follow (the verified
-- account, or the open claimant). Adult evidence: the custodial birth date, or a typed adult age on an account whose own
-- Stripe payouts are on (Stripe checks the birth date; unverified assumption, counsel row AA). A minor needs the
-- donations consent of the guardian on record. When signals disagree, the protective one wins.
create or replace function public.minor_payout_hold_reason(target_player_id uuid, account uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bd date;
  band text;
  own_payouts boolean;
begin
  select b.birth_date into bd from public.athlete_birthdates b where b.player_id = target_player_id;
  band := case when account is null then 'unknown' else public.profile_age_band(account) end;
  select coalesce(p.payouts_enabled, false) into own_payouts from public.profiles p where p.id = account;
  if (bd is not null and bd > current_date - interval '18 years') or public.is_minor_band(band) or band = 'under_13' then
    return case when public.minor_has_consent(account, 'donations') then null else 'needs_guardian_consent' end;
  end if;
  if (bd is not null and bd <= current_date - interval '18 years') or (band = 'adult' and coalesce(own_payouts, false)) then
    return null;
  end if;
  if band = 'adult' then
    return 'needs_payout_setup';
  end if;
  return 'needs_birth_month';
end;
$$;

-- A teen's account cannot stay public without a consent that allows it.
create or replace function public.enforce_minor_consent(minor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_minor_band(public.profile_age_band(minor))
     and exists (select 1 from public.profiles p where p.id = minor and not p.account_private)
     and not public.minor_has_consent(minor, 'public_profile') then
    perform public.apply_privacy_settings(minor, '{"account_private": true}'::jsonb);
    perform public.log_supervision_event(minor, 'made_private', '{"why": "no_consent"}'::jsonb);
  end if;
  if public.minor_guardian_count(minor) = 0 then
    update public.guardian_approval_requests set status = 'cancelled', decided_at = timezone('utc', now())
    where minor_id = minor and status = 'pending';
  end if;
end;
$$;

-- Teen defaults when an age is first recorded (or corrected into the teen range).
create or replace function public.apply_teen_defaults(minor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_minor_band(public.profile_age_band(minor)) then
    return;
  end if;
  if exists (select 1 from public.profiles p where p.id = minor and p.friend_requests_from = 'everyone') then
    perform public.apply_privacy_settings(minor, '{"friend_requests_from": "teens"}'::jsonb);
  end if;
  perform public.enforce_minor_consent(minor);
end;
$$;

-- Closes an account whose holder is under 13 (COPPA actual knowledge): stop using it, clear what it shared, hide its
-- clips, end its friendships and guardian links. The caller has already recorded the birth month and set the flag.
create or replace function public.close_under_13_account(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link uuid;
begin
  -- The age-write flag stays on to the end: the closed-account guard would refuse these server-side writes too.
  perform set_config('app.tapuai_age_write', 'on', true);
  update public.profiles set bio = null, avatar_url = null, social_links = '{}'::jsonb where id = target;
  perform public.apply_privacy_settings(target, '{"account_private": true, "hide_from_search": true}'::jsonb);
  update public.reels set is_removed = true where uploaded_by = target;
  delete from public.friendships where target in (requester_id, addressee_id);
  for link in select l.id from public.guardian_links l where l.minor_id = target and l.ended_at is null loop
    perform public.close_guardian_link(link, 'age_blocked');
  end loop;
  perform set_config('app.tapuai_age_write', 'off', true);
end;
$$;

-- Every RLS table refuses a closed (under-13) account: policies that use auth.uid() directly would otherwise still let
-- it write. Evaluated once per query.
create or replace function public.caller_not_age_blocked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.age_blocked_at is not null);
$$;

-- 4. New accounts and the birth columns --------------------------------------------------------------------------------

-- Inserts start on the private defaults (a client insert could otherwise create a public row and skip the PRIV-01
-- guard, which only watches updates). A recorded age sets the teen rules or refuses an under-13 account; a new account
-- with no age yet ('not_given') takes no friend requests until it adds one.
create or replace function public.profiles_apply_new_account_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  band text;
begin
  if not (coalesce(current_setting('app.tapuai_privacy_write', true), '') = 'on' or public.is_trusted_server()) then
    new.account_private := true;
    new.profile_audience := public.privacy_default_audience();
    new.hide_from_search := false;
    new.tag_review := 'review_all';
    new.friend_requests_from := 'everyone';
    new.age_blocked_at := null;
    new.age_check_required := true;
  end if;
  if new.birth_year is null or new.birth_month is null then
    new.birth_year := null;
    new.birth_month := null;
    new.birth_recorded_at := null;
    if coalesce(new.age_check_required, true) then
      new.friend_requests_from := 'nobody';
    end if;
    return new;
  end if;
  if new.birth_year * 12 + new.birth_month > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'Check your birth month and year.';
  end if;
  band := public.age_band_from(new.birth_year, new.birth_month, current_date);
  if band = 'under_13' then
    raise exception 'We can''t create your account right now.';
  end if;
  new.birth_recorded_at := coalesce(new.birth_recorded_at, timezone('utc', now()));
  new.age_confirmed_13_plus := true;
  if public.is_minor_band(band) then
    new.account_private := true;
    new.friend_requests_from := 'teens';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_new_account_rules on public.profiles;
create trigger profiles_new_account_rules
  before insert on public.profiles
  for each row execute function public.profiles_apply_new_account_rules();

create or replace function public.guard_profiles_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.tapuai_age_write', true), '') = 'on' or public.is_trusted_server() then
    return new;
  end if;
  -- A closed (under-13) account changes nothing; support reopens it with admin_set_birth_month.
  if old.age_blocked_at is not null and public.current_user_role() is distinct from 'admin' then
    raise exception 'This account is closed.';
  end if;
  if new.birth_year is distinct from old.birth_year or new.birth_month is distinct from old.birth_month
     or new.birth_recorded_at is distinct from old.birth_recorded_at or new.age_blocked_at is distinct from old.age_blocked_at
     or new.age_check_required is distinct from old.age_check_required then
    raise exception 'Add or correct your birth month and year from Profile.';
  end if;
  -- Older builds only ever set the 13+ confirmation to true.
  if coalesce(old.age_confirmed_13_plus, false) and new.age_confirmed_13_plus is distinct from old.age_confirmed_13_plus then
    raise exception 'Add or correct your birth month and year from Profile.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_age_guard on public.profiles;
create trigger profiles_age_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_age();

-- Sign-up metadata now carries birth_year / birth_month (email and magic-link sign-up); Apple / Google ask after the
-- first sign-in. Bad values are dropped (the app asks again); an under-13 date fails the sign-up (the trigger above).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  by_text text := new.raw_user_meta_data->>'birth_year';
  bm_text text := new.raw_user_meta_data->>'birth_month';
  by_val smallint;
  bm_val smallint;
begin
  if by_text ~ '^[0-9]{4}$' and bm_text ~ '^[0-9]{1,2}$' and bm_text::int between 1 and 12 and by_text::int >= 1900
     and by_text::int * 12 + bm_text::int <= extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    by_val := by_text::smallint;
    bm_val := bm_text::smallint;
  end if;
  insert into public.profiles (
    user_id, full_name, role, roles, is_verified, aura_points, active_role, age_confirmed_13_plus, birth_year, birth_month,
    age_check_required
  )
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
    'fan',
    -- Older builds send only the 13+ confirmation; a birth month and year sets it too (profiles_new_account_rules).
    nullif(new.raw_user_meta_data->>'age_confirmed_13_plus', '')::boolean,
    by_val,
    bm_val,
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- The teen's own view adds their birth month and year and the links waiting for their answer.
create or replace function public.minor_status_json(target uuid, for_teen boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'age_band', public.profile_age_band(p.id),
    'needs_birth', p.birth_year is null,
    'birth_year', case when for_teen then p.birth_year end,
    'birth_month', case when for_teen then p.birth_month end,
    'guardian_links_enabled', public.guardian_links_enabled(),
    'has_public_consent', public.minor_has_consent(p.id, 'public_profile'),
    'has_donations_consent', public.minor_has_consent(p.id, 'donations'),
    'guardians', coalesce((
      select jsonb_agg(jsonb_build_object(
        'link_id', l.id, 'first_name', public.first_name_of(l.guardian_id), 'since', l.confirmed_at,
        'guardian_of_record', public.is_guardian_of_record(p.id, l.guardian_id),
        'consent', (select jsonb_build_object('signed_at', c.signed_at, 'form_version', c.form_version,
                      'relationship', c.relationship, 'allows_donations', c.allows_donations,
                      'allows_public_profile', c.allows_public_profile)
                    from public.guardian_consents c where c.link_id = l.id and c.revoked_at is null)
      ) order by l.confirmed_at)
      from public.guardian_links l where l.minor_id = p.id and l.ended_at is null and l.confirmed_at is not null
    ), '[]'::jsonb),
    'pending_links', case when for_teen then coalesce((
      select jsonb_agg(jsonb_build_object(
        'link_id', l.id, 'first_name', public.first_name_of(l.guardian_id),
        'username', (select g.username from public.profiles g where g.id = l.guardian_id), 'requested_at', l.created_at
      ) order by l.created_at)
      from public.guardian_links l
      where l.minor_id = p.id and l.ended_at is null and l.confirmed_at is null
        and l.created_at > timezone('utc', now()) - interval '7 days'
    ), '[]'::jsonb) else '[]'::jsonb end,
    'pending_approvals', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'change_key', r.change_key, 'requested_at', r.requested_at) order by r.requested_at)
      from public.guardian_approval_requests r
      where r.minor_id = p.id and r.status = 'pending' and r.requested_at > timezone('utc', now()) - interval '14 days'
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = target;
$$;

-- Records (or corrects to a younger age) the caller's birth month and year. Returns the new status; an under-13 entry
-- blocks the account and returns {"status": "blocked"}.
create or replace function public.set_my_birth_month(birth_y integer, birth_m integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  cur public.profiles%rowtype;
  band text;
  old_band text;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if birth_m is null or birth_y is null or birth_m not between 1 and 12 or birth_y < 1900
     or birth_y * 12 + birth_m > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'Check your birth month and year.';
  end if;
  select * into cur from public.profiles where id = me;
  old_band := public.profile_age_band(me);
  if cur.birth_year is not null then
    if birth_y * 12 + birth_m < cur.birth_year * 12 + cur.birth_month then
      raise exception 'To change this to an older age, contact support.';
    end if;
    if birth_y = cur.birth_year and birth_m = cur.birth_month then
      return public.minor_status_json(me, true);
    end if;
  end if;
  band := public.age_band_from(birth_y, birth_m, current_date);
  perform set_config('app.tapuai_age_write', 'on', true);
  if band = 'under_13' then
    -- COPPA actual knowledge: the desk lists the account for deletion (admin_list_age_blocked).
    update public.profiles
    set birth_year = birth_y, birth_month = birth_m, birth_recorded_at = timezone('utc', now()), age_blocked_at = timezone('utc', now())
    where id = me;
    perform set_config('app.tapuai_age_write', 'off', true);
    perform public.close_under_13_account(me);
    return jsonb_build_object('status', 'blocked');
  end if;
  update public.profiles
  set birth_year = birth_y, birth_month = birth_m, birth_recorded_at = timezone('utc', now()), age_confirmed_13_plus = true
  where id = me;
  perform set_config('app.tapuai_age_write', 'off', true);
  -- Leaving 'not_given' opens friend requests to the band's default; a correction never loosens otherwise.
  if old_band = 'not_given' and cur.friend_requests_from = 'nobody' then
    perform public.apply_privacy_settings(me, jsonb_build_object('friend_requests_from',
      case when public.is_minor_band(band) then 'teens' else 'everyone' end));
  elsif not public.is_minor_band(band) and cur.friend_requests_from = 'teens' then
    perform public.apply_privacy_settings(me, '{"friend_requests_from": "nobody"}'::jsonb);
  end if;
  if public.is_minor_band(band) and band is distinct from old_band then
    perform public.apply_teen_defaults(me);
  end if;
  perform public.log_supervision_event(me, case when cur.birth_year is null then 'age_recorded' else 'age_corrected' end,
    jsonb_build_object('band', band));
  return public.minor_status_json(me, true);
end;
$$;

-- 5. Privacy with the teen rules ------------------------------------------------------------------------------------

create or replace function public.get_my_privacy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in to see your privacy settings.';
  end if;
  return public.privacy_settings_json(me) || jsonb_build_object('minor', public.minor_status_json(me, true));
end;
$$;

-- Teens: Public needs a guardian consent that allows it; under-16s send Public and friend requests from Anyone to the
-- guardian as approve / decline requests (the rest of the save applies). 'teens' is only for teen accounts; a new
-- account adds its age before opening up.
create or replace function public.set_my_privacy(settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  cur public.profiles%rowtype;
  band text;
  wants_public boolean;
  wants_open boolean;
  held text[] := array[]::text[];
  before_json jsonb;
  after_json jsonb;
  changed text[];
begin
  if me is null then
    raise exception 'Sign in to change your privacy settings.';
  end if;
  settings := coalesce(settings, '{}'::jsonb);
  select * into cur from public.profiles where id = me;
  band := public.profile_age_band(me);
  -- Read booleans the way apply_privacy_settings casts them ("off", "no", "f" and "0" are all false).
  wants_public := cur.account_private and not coalesce((settings ->> 'account_private')::boolean, true);
  wants_open := coalesce(settings ->> 'friend_requests_from', cur.friend_requests_from) <> cur.friend_requests_from
    and (settings ->> 'friend_requests_from') in ('everyone', 'teens');

  if (settings ->> 'friend_requests_from') = 'teens' and cur.friend_requests_from <> 'teens' and not public.is_minor_band(band) then
    raise exception 'That setting is for teen accounts.';
  end if;
  if band = 'not_given' and (wants_public or wants_open) then
    raise exception 'Add your birth month and year first.';
  end if;
  if public.is_minor_band(band) then
    if wants_public and not public.minor_has_consent(me, 'public_profile') then
      raise exception 'A parent or guardian needs to sign the consent before your profile can be public.';
    end if;
    wants_open := (settings ->> 'friend_requests_from') = 'everyone' and cur.friend_requests_from <> 'everyone';
    if band = 'teen_13_15' and (wants_public or wants_open) then
      if public.minor_guardian_count(me) = 0 then
        raise exception 'Invite a parent or guardian first. They approve this change.';
      end if;
      update public.guardian_approval_requests set status = 'expired'
      where minor_id = me and status = 'pending' and requested_at <= timezone('utc', now()) - interval '14 days';
      if wants_public then
        held := array_append(held, 'account_public');
        settings := settings - 'account_private';
      end if;
      if wants_open then
        held := array_append(held, 'friend_requests_everyone');
        settings := settings - 'friend_requests_from';
      end if;
      insert into public.guardian_approval_requests (minor_id, change_key)
      select me, k from unnest(held) k
      on conflict do nothing;
      perform public.log_supervision_event(me, 'approval_requested', jsonb_build_object('changes', to_jsonb(held)));
    end if;
  end if;

  before_json := public.privacy_settings_json(me);
  after_json := public.apply_privacy_settings(me, settings);
  select array_agg(k) into changed from jsonb_object_keys(after_json) k where after_json -> k is distinct from before_json -> k;
  if changed is not null then
    perform public.log_supervision_event(me, 'settings_changed', jsonb_build_object('keys', to_jsonb(changed)));
  end if;
  -- Belt and braces: whatever was sent, a teen without a public-profile consent ends the save private.
  perform public.enforce_minor_consent(me);
  after_json := public.privacy_settings_json(me);
  return after_json || jsonb_build_object('minor', public.minor_status_json(me, true), 'held_for_approval', to_jsonb(held));
end;
$$;

-- PRIV-01's request_friend with one more rule: "Only other teens" refuses everyone who is not a recorded teen (a
-- linked guardian may still ask). The refusal reads the same as every other refusal, so it does not reveal a teen.
create or replace function public.request_friend(target_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  t public.profiles%rowtype;
  row_found public.friendships%rowtype;
  sent_today integer;
begin
  if me is null then
    raise exception 'Sign in to add friends.';
  end if;
  if not public.friend_requests_enabled() then
    raise exception 'Friend requests are paused right now.';
  end if;
  select * into t from public.profiles where id = target_profile_id;
  if not found or t.id = me or t.age_blocked_at is not null or public.is_blocked_between(me, t.id) or t.friend_requests_from = 'nobody'
     or (t.friend_requests_from = 'teens'
         and not public.is_minor_band(public.profile_age_band(me))
         and not exists (select 1 from public.guardian_links l
                         where l.minor_id = t.id and l.guardian_id = me and l.ended_at is null and l.confirmed_at is not null)) then
    raise exception 'You can''t send a friend request to this account.';
  end if;
  select * into row_found from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, t.id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, t.id);
  if found then
    if row_found.status = 'accepted' then
      return 'friends';
    end if;
    if row_found.status = 'pending' and row_found.requester_id = me then
      return 'requested';
    end if;
    if row_found.status = 'pending' and row_found.addressee_id = me then
      update public.friendships set status = 'accepted', responded_at = timezone('utc', now()) where id = row_found.id;
      return 'friends';
    end if;
    -- Declined: the requester waits 30 days and is never told; the person who declined may send their own request.
    if row_found.requester_id = me and row_found.responded_at > timezone('utc', now()) - interval '30 days' then
      return 'requested';
    end if;
    delete from public.friendships where id = row_found.id;
  end if;
  select count(*)::int into sent_today from public.friend_request_log l
  where l.requester_id = me and l.created_at > timezone('utc', now()) - interval '1 day';
  if sent_today >= 20 then
    raise exception 'You''ve sent a lot of friend requests today. Try again tomorrow.';
  end if;
  if (select count(*) from public.friend_request_log l
      where l.requester_id = me and l.addressee_id = t.id and l.created_at > timezone('utc', now()) - interval '7 days') >= 3 then
    return 'requested';
  end if;
  insert into public.friend_request_log (requester_id, addressee_id) values (me, t.id);
  insert into public.friendships (requester_id, addressee_id) values (me, t.id);
  return 'requested';
end;
$$;

-- 6. Invites, links and consent ---------------------------------------------------------------------------------------

create or replace function public.create_guardian_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  band text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  raw text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  code text := '';
  i integer;
  expires timestamptz := timezone('utc', now()) + interval '48 hours';
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  band := public.profile_age_band(me);
  if band in ('unknown', 'not_given') then
    raise exception 'Add your birth month and year first.';
  end if;
  if not public.is_minor_band(band) then
    raise exception 'Guardian links are for accounts aged 13 to 17.';
  end if;
  if not public.guardian_links_enabled() then
    raise exception 'Guardian links are paused right now.';
  end if;
  if public.minor_link_slots_used(me) >= 2 then
    raise exception 'You already have two guardians linked or waiting.';
  end if;
  if (select count(*) from public.guardian_invites g where g.minor_id = me and g.created_at > timezone('utc', now()) - interval '1 day') >= 5 then
    raise exception 'You''ve made a lot of codes today. Try again tomorrow.';
  end if;
  -- 8 characters from 31 (no 0/O, 1/I/L), each from two random hex digits of v4 UUIDs.
  for i in 0..7 loop
    code := code || substr(alphabet, 1 + (('x' || substr(raw, 1 + i * 2, 2))::bit(8)::int % 31), 1);
  end loop;
  update public.guardian_invites set expires_at = timezone('utc', now())
  where minor_id = me and used_at is null and expires_at > timezone('utc', now());
  insert into public.guardian_invites (code_hash, minor_id, expires_at) values (public.hash_secret(code), me, expires);
  perform public.log_supervision_event(me, 'invite_created', '{}'::jsonb);
  return jsonb_build_object('code', code, 'expires_at', expires);
end;
$$;

-- The guardian side of a code: the caller must be 18+ (recorded), with 10 wrong tries a day. Returns the invite row, or
-- an empty row for a wrong code (no exception, so the counted try is kept: an exception would roll it back).
create or replace function public.guardian_invite_for_code(invite_code text)
returns public.guardian_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  band text;
  inv public.guardian_invites%rowtype;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  band := public.profile_age_band(me);
  if band in ('unknown', 'not_given') then
    raise exception 'Add your birth month and year first.';
  end if;
  if band <> 'adult' then
    raise exception 'A parent or guardian must be 18 or older.';
  end if;
  if not public.guardian_links_enabled() then
    raise exception 'Guardian links are paused right now.';
  end if;
  if (select count(*) from public.guardian_invite_attempts a where a.profile_id = me and a.created_at > timezone('utc', now()) - interval '1 day') >= 10 then
    raise exception 'Too many tries. Try again tomorrow.';
  end if;
  select * into inv from public.guardian_invites g
  where g.code_hash = public.hash_secret(upper(btrim(coalesce(invite_code, ''))))
    and g.used_at is null and g.expires_at > timezone('utc', now());
  if not found or inv.minor_id = me or public.is_blocked_between(me, inv.minor_id) then
    insert into public.guardian_invite_attempts (profile_id) values (me);
    return null;
  end if;
  return inv;
end;
$$;

create or replace function public.preview_guardian_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.guardian_invites%rowtype := public.guardian_invite_for_code(invite_code);
begin
  if inv.code_hash is null then
    return jsonb_build_object('status', 'bad_code');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'first_name', public.first_name_of(inv.minor_id),
    'username', (select p.username from public.profiles p where p.id = inv.minor_id),
    'form_version', public.guardian_consent_form_version(),
    'can_allow_donations', public.is_guardian_of_record(inv.minor_id, public.my_profile_id())
  );
end;
$$;

-- Records a signed consent on a link (revoking the guardian's earlier one), then applies its effects. The consent counts
-- once the link is confirmed; payouts only from the guardian on record.
create or replace function public.record_guardian_consent(
  link uuid, signer text, relation text, donations boolean, public_profile boolean, version text, text_sha256 text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.guardian_links%rowtype;
begin
  select * into l from public.guardian_links where id = link and ended_at is null;
  if not found then
    raise exception 'This guardian link has ended.';
  end if;
  if version is distinct from public.guardian_consent_form_version() or text_sha256 is distinct from public.guardian_consent_form_sha256() then
    raise exception 'The consent form has changed. Reload and read it again.';
  end if;
  if char_length(btrim(coalesce(signer, ''))) < 2 then
    raise exception 'Type your full name to sign.';
  end if;
  if relation is null or relation not in ('parent', 'legal_guardian') then
    raise exception 'Choose parent or legal guardian.';
  end if;
  if coalesce(donations, false) and not public.is_guardian_of_record(l.minor_id, l.guardian_id) then
    raise exception 'Only the guardian on record for this athlete''s family account can allow payouts.';
  end if;
  update public.guardian_consents set revoked_at = timezone('utc', now()), revoked_by = public.my_profile_id(), revoke_reason = 'signed_again'
  where link_id = link and revoked_at is null;
  insert into public.guardian_consents (link_id, minor_id, guardian_id, form_version, form_sha256, signer_name, relationship, allows_donations, allows_public_profile)
  values (link, l.minor_id, l.guardian_id, version, text_sha256, btrim(signer), relation, coalesce(donations, false), coalesce(public_profile, false));
  perform public.log_supervision_event(l.minor_id, 'consent_signed',
    jsonb_build_object('donations', coalesce(donations, false), 'public_profile', coalesce(public_profile, false)));
  perform public.enforce_minor_consent(l.minor_id);
end;
$$;

-- The guardian redeems a teen's code and signs. The link waits for the teen to confirm (respond_guardian_link).
create or replace function public.accept_guardian_invite(
  invite_code text, signer_name text, relationship text, allows_donations boolean, allows_public_profile boolean,
  form_version text, form_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  inv public.guardian_invites%rowtype := public.guardian_invite_for_code(invite_code);
  link uuid;
  waiting boolean := false;
begin
  if inv.code_hash is null or not public.is_minor_band(public.profile_age_band(inv.minor_id)) then
    return jsonb_build_object('status', 'bad_code');
  end if;
  -- A waiting link the teen never answered (7 days) is closed, so the new code starts a fresh one they can see.
  update public.guardian_links set ended_at = timezone('utc', now()), end_reason = 'not_confirmed'
  where minor_id = inv.minor_id and guardian_id = me and ended_at is null and confirmed_at is null
    and created_at <= timezone('utc', now()) - interval '7 days';
  select l.id, l.confirmed_at is null into link, waiting from public.guardian_links l
  where l.minor_id = inv.minor_id and l.guardian_id = me and l.ended_at is null;
  if link is null then
    if public.minor_link_slots_used(inv.minor_id) >= 2 then
      raise exception 'This account already has two guardians linked or waiting.';
    end if;
    insert into public.guardian_links (minor_id, guardian_id, source) values (inv.minor_id, me, 'invite') returning id into link;
    waiting := true;
  end if;
  update public.guardian_invites set used_at = timezone('utc', now()), used_by = me where code_hash = inv.code_hash;
  perform public.record_guardian_consent(link, signer_name, relationship, allows_donations, allows_public_profile, form_version, form_sha256);
  return jsonb_build_object('status', case when waiting then 'waiting_for_teen' else 'linked' end,
                            'first_name', public.first_name_of(inv.minor_id), 'link_id', link);
end;
$$;

-- The teen answers "Is {name} your parent or guardian?". Yes makes the link (and its consent) count; no ends it.
create or replace function public.respond_guardian_link(link_id uuid, accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  l public.guardian_links%rowtype;
begin
  select * into l from public.guardian_links g
  where g.id = link_id and g.minor_id = me and g.ended_at is null and g.confirmed_at is null
    and g.created_at > timezone('utc', now()) - interval '7 days'
  for update;
  if not found then
    raise exception 'This request has ended.';
  end if;
  if coalesce(accept, false) then
    if public.minor_guardian_count(me) >= 2 then
      raise exception 'You already have two guardians linked.';
    end if;
    update public.guardian_links set confirmed_at = timezone('utc', now()) where id = l.id;
    perform public.log_supervision_event(me, 'guardian_linked', jsonb_build_object('guardian', public.first_name_of(l.guardian_id)));
    perform public.enforce_minor_consent(me);
  else
    perform public.close_guardian_link(l.id, 'teen_declined');
  end if;
  return public.minor_status_json(me, true);
end;
$$;

-- A guardian signs (or re-signs) for a teen they are linked to; the admin-set athlete guardian may start a link here.
-- Every refusal reads the same, so this cannot be used to find out who is a teen. The guardian on record's new link is
-- confirmed at once, unless the teen ended or blocked an earlier one: then the teen confirms again.
create or replace function public.sign_guardian_consent(
  minor_profile_id uuid, signer_name text, relationship text, allows_donations boolean, allows_public_profile boolean,
  form_version text, form_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  link uuid;
  refused constant text := 'You can''t sign for this account. Ask the teen for a guardian code.';
  teen_ended boolean;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  if public.profile_age_band(me) <> 'adult' then
    raise exception 'A parent or guardian must be 18 or older (add your birth month and year first).';
  end if;
  update public.guardian_links set ended_at = timezone('utc', now()), end_reason = 'not_confirmed'
  where minor_id = minor_profile_id and guardian_id = me and ended_at is null and confirmed_at is null
    and created_at <= timezone('utc', now()) - interval '7 days';
  select l.id into link from public.guardian_links l where l.minor_id = minor_profile_id and l.guardian_id = me and l.ended_at is null;
  -- An admin-ended link stays ended: support reinstates on purpose (or changes players.guardian_id) — review P2.
  if (link is null and not public.is_guardian_of_record(minor_profile_id, me))
     or not public.is_minor_band(public.profile_age_band(minor_profile_id))
     or public.is_blocked_between(me, minor_profile_id)
     or (link is null and exists (
           select 1 from public.guardian_links l
           where l.minor_id = minor_profile_id and l.guardian_id = me and l.end_reason like 'admin:%')) then
    raise exception '%', refused;
  end if;
  if link is null then
    if not public.guardian_links_enabled() then
      raise exception 'Guardian links are paused right now.';
    end if;
    if public.minor_link_slots_used(minor_profile_id) >= 2 then
      raise exception '%', refused;
    end if;
    select exists (
      select 1 from public.guardian_links l
      where l.minor_id = minor_profile_id and l.guardian_id = me and l.end_reason in ('teen_unlinked', 'teen_declined', 'blocked')
    ) into teen_ended;
    insert into public.guardian_links (minor_id, guardian_id, source, confirmed_at)
    values (minor_profile_id, me, 'custodial', case when teen_ended then null else timezone('utc', now()) end)
    returning id into link;
    if not teen_ended then
      perform public.log_supervision_event(minor_profile_id, 'guardian_linked', jsonb_build_object('guardian', public.first_name_of(me)));
    end if;
  end if;
  perform public.record_guardian_consent(link, signer_name, relationship, allows_donations, allows_public_profile, form_version, form_sha256);
  return public.guardian_view(minor_profile_id);
end;
$$;

create or replace function public.revoke_guardian_consent(minor_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  n integer;
begin
  update public.guardian_consents c set revoked_at = timezone('utc', now()), revoked_by = me, revoke_reason = 'withdrawn'
  from public.guardian_links l
  where l.id = c.link_id and l.ended_at is null and l.guardian_id = me and l.minor_id = minor_profile_id and c.revoked_at is null;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'There is no consent of yours to withdraw.';
  end if;
  perform public.log_supervision_event(minor_profile_id, 'consent_withdrawn', '{}'::jsonb);
  perform public.enforce_minor_consent(minor_profile_id);
  return public.guardian_view(minor_profile_id);
end;
$$;

-- Ends a link and the consent signed on it, then re-applies the teen rules. Shared by both sides, blocks and the admin.
create or replace function public.close_guardian_link(link uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.guardian_links%rowtype;
begin
  update public.guardian_links
  set ended_at = timezone('utc', now()), ended_by = public.my_profile_id(), end_reason = left(reason, 200)
  where id = link and ended_at is null
  returning * into l;
  if l.id is null then
    raise exception 'This guardian link has already ended.';
  end if;
  update public.guardian_consents set revoked_at = timezone('utc', now()), revoked_by = public.my_profile_id(), revoke_reason = 'link_ended'
  where link_id = link and revoked_at is null;
  if l.confirmed_at is not null then
    perform public.log_supervision_event(l.minor_id, 'guardian_unlinked',
      jsonb_build_object('guardian', public.first_name_of(l.guardian_id), 'reason', left(reason, 40)));
  end if;
  perform public.enforce_minor_consent(l.minor_id);
end;
$$;

-- Either side may end a link at any time (the owner's "no dictatorship" rule).
create or replace function public.end_guardian_link(link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  l public.guardian_links%rowtype;
begin
  select * into l from public.guardian_links g where g.id = link_id and g.ended_at is null;
  if not found or me is null or me not in (l.minor_id, l.guardian_id) then
    raise exception 'This guardian link has already ended.';
  end if;
  perform public.close_guardian_link(link_id, case when me = l.minor_id then 'teen_unlinked' else 'guardian_unlinked' end);
end;
$$;

-- Blocking either way ends every link between the two (a teen can always cut a guardian off with Block).
create or replace function public.user_blocks_end_guardian_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  link uuid;
begin
  for link in
    select l.id from public.guardian_links l
    where l.ended_at is null
      and ((l.minor_id = new.blocker_id and l.guardian_id = new.blocked_id) or (l.minor_id = new.blocked_id and l.guardian_id = new.blocker_id))
  loop
    perform public.close_guardian_link(link, 'blocked');
  end loop;
  return new;
end;
$$;

drop trigger if exists user_blocks_end_links on public.user_blocks;
create trigger user_blocks_end_links
  after insert on public.user_blocks
  for each row execute function public.user_blocks_end_guardian_links();

-- 7. Supervision and approvals ----------------------------------------------------------------------------------------

create or replace function public.verified_player_of(target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.player_id from public.profiles p where p.id = target and p.verification_status = 'verified';
$$;

-- What the teen and their guardian both see: settings, status, counts (never who) and events since `events_since`
-- (a guardian sees only what happened after they linked).
create or replace function public.supervision_json(minor uuid, events_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', p.id,
    'first_name', public.first_name_of(p.id),
    'username', p.username,
    'settings', public.privacy_settings_json(p.id),
    'status', public.minor_status_json(p.id, false),
    'summary', jsonb_build_object(
      'friends', (select count(*) from public.friendships f where f.status = 'accepted' and p.id in (f.requester_id, f.addressee_id)),
      'incoming_requests', (select count(*) from public.friendships f where f.status = 'pending' and f.addressee_id = p.id),
      'blocked_accounts', (select count(*) from public.user_blocks u where u.blocker_id = p.id),
      'tags_waiting', (select count(*) from public.reels r
                       where r.player_id = public.verified_player_of(p.id) and r.tag_status = 'pending'),
      'hidden_from_search', p.hide_from_search
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'detail', e.detail, 'at', e.created_at,
                                          'by_teen', e.actor_id is not distinct from p.id) order by e.created_at desc)
      from (
        select * from public.supervision_events e
        where e.minor_id = p.id and e.created_at >= coalesce(events_since, '-infinity'::timestamptz)
          and e.created_at > timezone('utc', now()) - interval '365 days'
        order by e.created_at desc limit 30
      ) e
    ), '[]'::jsonb)
  )
  from public.profiles p where p.id = minor;
$$;

-- The guardian's view of one teen: the shared summary from the date they linked, plus whether they can allow payouts.
create or replace function public.guardian_view(minor uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_supervising_guardian(minor) then
      public.supervision_json(minor, (
        select min(l.confirmed_at) from public.guardian_links l
        where l.minor_id = minor and l.guardian_id = public.my_profile_id() and l.ended_at is null and l.confirmed_at is not null
      )) || jsonb_build_object('can_allow_donations', public.is_guardian_of_record(minor, public.my_profile_id()), 'link_status', 'linked')
    -- Nothing about the teen until they confirm the link.
    else jsonb_build_object('profile_id', minor, 'link_status', 'waiting_for_teen')
  end;
$$;

create or replace function public.get_my_supervision()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  return public.supervision_json(me, null) || jsonb_build_object('status', public.minor_status_json(me, true));
end;
$$;

create or replace function public.guardian_get_supervision(minor_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_supervising_guardian(minor_profile_id) then
    raise exception 'Only this teen''s linked guardian can see this.';
  end if;
  return public.guardian_view(minor_profile_id);
end;
$$;

-- Teens this guardian supervises or is waiting on, plus the admin-set athlete guardian's teens who still need a consent.
create or replace function public.guardian_list_minors()
returns table (
  profile_id uuid, first_name text, username text, age_band text, link_id uuid, link_status text,
  account_private boolean, my_consent jsonb, can_allow_donations boolean, pending_approvals integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.my_profile_id() as id),
  mine as (
    select l.minor_id, l.id as link_id, case when l.confirmed_at is null then 'waiting_for_teen' else 'linked' end as link_status
    from public.guardian_links l, me
    where l.guardian_id = me.id and l.ended_at is null
      and (l.confirmed_at is not null or l.created_at > timezone('utc', now()) - interval '7 days')
    union
    select t.id, null::uuid, 'not_linked' from public.profiles t join public.players pl on pl.id = t.player_id, me
    where pl.guardian_id = me.id and t.verification_status = 'verified'
      and not exists (select 1 from public.guardian_links l where l.minor_id = t.id and l.guardian_id = me.id and l.ended_at is null)
  )
  select p.id, public.first_name_of(p.id), p.username, public.profile_age_band(p.id), m.link_id, m.link_status,
    case when m.link_status = 'linked' then p.account_private end,
    (select jsonb_build_object('signed_at', c.signed_at, 'form_version', c.form_version, 'relationship', c.relationship,
                               'allows_donations', c.allows_donations, 'allows_public_profile', c.allows_public_profile)
       from public.guardian_consents c where c.link_id = m.link_id and c.revoked_at is null),
    public.is_guardian_of_record(p.id, (select id from me)),
    case when m.link_status = 'linked' then (select count(*)::int from public.guardian_approval_requests r
       where r.minor_id = p.id and r.status = 'pending' and r.requested_at > timezone('utc', now()) - interval '14 days') else 0 end
  from mine m join public.profiles p on p.id = m.minor_id
  where (select id from me) is not null;
$$;

create or replace function public.guardian_decide_approval(request_id uuid, approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.guardian_approval_requests%rowtype;
begin
  select * into r from public.guardian_approval_requests a where a.id = request_id for update;
  if not found or not (public.is_supervising_guardian(r.minor_id) or public.current_user_role() = 'admin') then
    raise exception 'This request is not yours to decide.';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request was already handled.';
  end if;
  if r.requested_at <= timezone('utc', now()) - interval '14 days' then
    update public.guardian_approval_requests set status = 'expired' where id = r.id;
    return public.guardian_view(r.minor_id) || jsonb_build_object('notice', 'This request expired. They can ask again.');
  end if;
  if coalesce(approve, false) then
    if r.change_key = 'account_public' then
      if public.is_minor_band(public.profile_age_band(r.minor_id)) and not public.minor_has_consent(r.minor_id, 'public_profile') then
        raise exception 'Sign the consent with "public profile" allowed first.';
      end if;
      perform public.apply_privacy_settings(r.minor_id, '{"account_private": false}'::jsonb);
    else
      perform public.apply_privacy_settings(r.minor_id, '{"friend_requests_from": "everyone"}'::jsonb);
    end if;
  end if;
  update public.guardian_approval_requests
  set status = case when coalesce(approve, false) then 'approved' else 'declined' end,
      decided_by = public.my_profile_id(), decided_at = timezone('utc', now())
  where id = r.id;
  perform public.log_supervision_event(r.minor_id, 'approval_decided',
    jsonb_build_object('change', r.change_key, 'approved', coalesce(approve, false)));
  return public.guardian_view(r.minor_id);
end;
$$;

create or replace function public.cancel_my_approval_request(request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
  n integer;
begin
  update public.guardian_approval_requests set status = 'cancelled', decided_by = me, decided_at = timezone('utc', now())
  where id = request_id and minor_id = me and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'This request was already handled.';
  end if;
  perform public.log_supervision_event(me, 'approval_cancelled', '{}'::jsonb);
  return public.minor_status_json(me, true);
end;
$$;

-- 8. Money: payouts wait for positive adult evidence, or a minor's donations consent ------------------------------------

-- Same as before (athlete verification ladder), plus minor_payout_hold_reason wherever money would otherwise be allowed.
--   reason   why it is held: 'disputed' | 'no_claim' | 'needs_payout_setup' | 'needs_guardian_consent' |
--            'needs_birth_month' | null
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
  hold text;
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
    hold := public.minor_payout_hold_reason(target_player_id, public.athlete_profile_for_player(target_player_id));
    if hold is not null then
      return jsonb_build_object('allowed', false, 'path', 'school', 'cap_cents', null, 'reason', hold, 'vouches', 0);
    end if;
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

  -- the claimant is the account money would follow on this path
  hold := public.minor_payout_hold_reason(target_player_id, req.requester_user_id);
  if hold is not null then
    return jsonb_build_object('allowed', false, 'path', 'identity', 'cap_cents', null, 'reason', hold, 'vouches', vouches);
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

-- 9. Admin -------------------------------------------------------------------------------------------------------------

-- The safety case file for one account: names are shown here (admins only), unlike the counts-only privacy panel.
create or replace function public.admin_minor_overview(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return (
    select jsonb_build_object(
      'age_band', public.profile_age_band(p.id),
      'birth_year', p.birth_year,
      'birth_month', p.birth_month,
      'birth_recorded_at', p.birth_recorded_at,
      'age_blocked_at', p.age_blocked_at,
      'links', coalesce((
        select jsonb_agg(jsonb_build_object('link_id', l.id, 'guardian_id', l.guardian_id,
          'guardian_name', (select g.full_name from public.profiles g where g.id = l.guardian_id),
          'guardian_teens', (select count(*) from public.guardian_links x where x.guardian_id = l.guardian_id and x.ended_at is null),
          'source', l.source, 'created_at', l.created_at, 'confirmed_at', l.confirmed_at,
          'ended_at', l.ended_at, 'end_reason', l.end_reason) order by l.created_at desc)
        from public.guardian_links l where l.minor_id = p.id
      ), '[]'::jsonb),
      'consents', coalesce((
        select jsonb_agg(jsonb_build_object('form_version', c.form_version, 'signer_name', c.signer_name,
          'relationship', c.relationship, 'allows_donations', c.allows_donations,
          'allows_public_profile', c.allows_public_profile, 'signed_at', c.signed_at, 'revoked_at', c.revoked_at,
          'revoke_reason', c.revoke_reason) order by c.signed_at desc)
        from public.guardian_consents c where c.minor_id = p.id
      ), '[]'::jsonb),
      'supervision', public.supervision_json(p.id, null)
    )
    from public.profiles p where p.id = target_profile_id
  );
end;
$$;

-- Support's correction (either direction), with a reason kept as a supervision event.
create or replace function public.admin_set_birth_month(target_profile_id uuid, birth_y integer, birth_m integer, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  band text;
  old_band text := public.profile_age_band(target_profile_id);
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  if birth_m is null or birth_y is null or birth_m not between 1 and 12 or birth_y < 1900
     or birth_y * 12 + birth_m > extract(year from current_date)::int * 12 + extract(month from current_date)::int then
    raise exception 'Check the birth month and year.';
  end if;
  band := public.age_band_from(birth_y, birth_m, current_date);
  perform set_config('app.tapuai_age_write', 'on', true);
  update public.profiles
  set birth_year = birth_y, birth_month = birth_m, birth_recorded_at = timezone('utc', now()),
      age_blocked_at = case when band = 'under_13' then coalesce(age_blocked_at, timezone('utc', now())) else null end
  where id = target_profile_id;
  perform set_config('app.tapuai_age_write', 'off', true);
  if band = 'under_13' then
    perform public.close_under_13_account(target_profile_id);
  else
    if not public.is_minor_band(band) and exists (select 1 from public.profiles p where p.id = target_profile_id and p.friend_requests_from = 'teens') then
      perform public.apply_privacy_settings(target_profile_id, '{"friend_requests_from": "nobody"}'::jsonb);
    end if;
    if band is distinct from old_band then
      perform public.apply_teen_defaults(target_profile_id);
    end if;
  end if;
  perform public.log_supervision_event(target_profile_id, 'age_corrected', jsonb_build_object('band', band, 'by', 'support', 'reason', left(btrim(reason), 200)));
  return public.admin_minor_overview(target_profile_id);
end;
$$;

create or replace function public.admin_end_guardian_link(link_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  minor uuid;
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(reason, ''))) < 5 then
    raise exception 'Give a reason (at least 5 characters).';
  end if;
  select l.minor_id into minor from public.guardian_links l where l.id = link_id;
  perform public.close_guardian_link(link_id, 'admin: ' || btrim(reason));
  return public.admin_minor_overview(minor);
end;
$$;

create or replace function public.admin_minor_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return (
    with bands as (
      select p.id, public.profile_age_band(p.id) as band, p.age_blocked_at from public.profiles p
    )
    select jsonb_build_object(
      'teen_13_15', count(*) filter (where band = 'teen_13_15' and age_blocked_at is null),
      'teen_16_17', count(*) filter (where band = 'teen_16_17' and age_blocked_at is null),
      'adult', count(*) filter (where band = 'adult'),
      'not_given', count(*) filter (where band = 'not_given'),
      'unknown', count(*) filter (where band = 'unknown'),
      'under_13_blocked', count(*) filter (where age_blocked_at is not null),
      'teens_with_guardian', count(*) filter (where public.is_minor_band(band) and public.minor_guardian_count(id) > 0),
      'teens_public_consent', count(*) filter (where public.is_minor_band(band) and public.minor_has_consent(id, 'public_profile')),
      'teens_donations_consent', count(*) filter (where public.is_minor_band(band) and public.minor_has_consent(id, 'donations')),
      'pending_approvals', (select count(*) from public.guardian_approval_requests r
                            where r.status = 'pending' and r.requested_at > timezone('utc', now()) - interval '14 days'),
      'invites_7d', (select count(*) from public.guardian_invites g where g.created_at > timezone('utc', now()) - interval '7 days'),
      -- abuse signals: one adult supervising many teens; adults sending friend requests to teens
      'guardians_over_3_teens', (select count(*) from (
          select l.guardian_id from public.guardian_links l where l.ended_at is null group by l.guardian_id having count(*) > 3) g),
      'adult_requests_to_teens_7d', (select count(*) from public.friend_request_log f
          where f.created_at > timezone('utc', now()) - interval '7 days'
            and public.profile_age_band(f.requester_id) = 'adult' and public.is_minor_band(public.profile_age_band(f.addressee_id))),
      'guardian_links_enabled', public.guardian_links_enabled()
    )
    from bands
  );
end;
$$;

-- Under-13 accounts waiting for deletion (deleting the sign-in itself needs the service role / Supabase dashboard).
create or replace function public.admin_list_age_blocked()
returns table (profile_id uuid, user_id uuid, blocked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return query select p.id, p.user_id, p.age_blocked_at from public.profiles p where p.age_blocked_at is not null order by p.age_blocked_at;
end;
$$;

-- Retention (PRIVACY_ENGINEERING): events 365 days, invite codes 30 days, wrong tries 2 days, decided or expired
-- approvals 90 days. Consent records are not purged here (counsel sets their period, LEGAL row AA).
create or replace function public.admin_purge_minor_records()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev integer;
  inv integer;
  att integer;
  app integer;
begin
  perform public.require_admin_guard();
  delete from public.supervision_events where created_at < timezone('utc', now()) - interval '365 days';
  get diagnostics ev = row_count;
  delete from public.guardian_invites where created_at < timezone('utc', now()) - interval '30 days';
  get diagnostics inv = row_count;
  delete from public.guardian_invite_attempts where created_at < timezone('utc', now()) - interval '2 days';
  get diagnostics att = row_count;
  delete from public.guardian_approval_requests
  where (status <> 'pending' and coalesce(decided_at, requested_at) < timezone('utc', now()) - interval '90 days')
     or (status = 'pending' and requested_at < timezone('utc', now()) - interval '90 days');
  get diagnostics app = row_count;
  return jsonb_build_object('events', ev, 'invites', inv, 'attempts', att, 'approvals', app);
end;
$$;

-- 10. Access -------------------------------------------------------------------------------------------------------------

do $$
declare
  t text;
  fn text;
begin
  foreach t in array array['guardian_links', 'guardian_invites', 'guardian_invite_attempts', 'guardian_consents',
                           'guardian_approval_requests', 'supervision_events'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
  execute 'revoke all on sequence public.supervision_events_id_seq from public, anon, authenticated';
  -- internal: other functions, triggers and the server only
  foreach fn in array array[
    'public.profile_age_band(uuid)', 'public.guardian_links_enabled()', 'public.first_name_of(uuid)',
    'public.guard_consent_records()', 'public.minor_has_consent(uuid, text)', 'public.minor_guardian_count(uuid)',
    'public.minor_link_slots_used(uuid)', 'public.is_supervising_guardian(uuid)', 'public.is_guardian_of_record(uuid, uuid)',
    'public.log_supervision_event(uuid, text, jsonb)', 'public.athlete_profile_for_player(uuid)',
    'public.minor_payout_hold_reason(uuid, uuid)', 'public.enforce_minor_consent(uuid)', 'public.close_under_13_account(uuid)',
    'public.guard_consent_truncate()', 'public.apply_teen_defaults(uuid)',
    'public.profiles_apply_new_account_rules()', 'public.guard_profiles_age()', 'public.minor_status_json(uuid, boolean)',
    'public.guardian_invite_for_code(text)', 'public.record_guardian_consent(uuid, text, text, boolean, boolean, text, text)',
    'public.close_guardian_link(uuid, text)', 'public.user_blocks_end_guardian_links()',
    'public.supervision_json(uuid, timestamptz)', 'public.verified_player_of(uuid)', 'public.guardian_view(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  -- evaluated as the caller inside the "Closed accounts" policies; answers only about the caller
  execute 'revoke all on function public.caller_not_age_blocked() from public, anon';
  execute 'grant execute on function public.caller_not_age_blocked() to authenticated, service_role';
  -- pure helpers (no lookups)
  foreach fn in array array['public.age_band_from(integer, integer, date)', 'public.is_minor_band(text)',
                            'public.guardian_consent_form_version()', 'public.guardian_consent_form_sha256()'] loop
    execute format('grant execute on function %s to anon, authenticated, service_role', fn);
  end loop;
  -- signed-in only
  foreach fn in array array[
    'public.set_my_birth_month(integer, integer)', 'public.get_my_privacy()', 'public.set_my_privacy(jsonb)',
    'public.request_friend(uuid)', 'public.create_guardian_invite()', 'public.preview_guardian_invite(text)',
    'public.accept_guardian_invite(text, text, text, boolean, boolean, text, text)', 'public.respond_guardian_link(uuid, boolean)',
    'public.sign_guardian_consent(uuid, text, text, boolean, boolean, text, text)', 'public.revoke_guardian_consent(uuid)',
    'public.end_guardian_link(uuid)', 'public.get_my_supervision()', 'public.guardian_get_supervision(uuid)',
    'public.guardian_list_minors()', 'public.guardian_decide_approval(uuid, boolean)', 'public.cancel_my_approval_request(uuid)',
    'public.admin_minor_overview(uuid)', 'public.admin_set_birth_month(uuid, integer, integer, text)',
    'public.admin_end_guardian_link(uuid, text)', 'public.admin_minor_report()', 'public.admin_list_age_blocked()',
    'public.admin_purge_minor_records()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- 11. Closed accounts on every RLS table ------------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  for tbl in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity loop
    execute format('drop policy if exists "Closed accounts" on public.%I', tbl);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated
                    using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))', tbl);
  end loop;
  -- Uploads too (avatars, reels): a closed account cannot add or change files.
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Closed accounts" on storage.objects';
    execute 'create policy "Closed accounts" on storage.objects as restrictive for all to authenticated
             using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))';
  end if;
end;
$$;

-- Payee verification: who may receive an athlete's donations, how they were verified, and who can change payout flags
-- (VERIFY-02, 2026-10-14). Plan and owner decisions: docs/engineering/design/PAYEE_VERIFICATION_PLAN.md.
--
-- Purpose
--   Owner decisions 2026-10-14: (1) an earner's Social Security number goes to Stripe only (Stripe-hosted Connect
--   onboarding verifies it and issues tax forms); Tapua'i never stores an SSN or part of one; (2) a guardian may receive a
--   minor's money only after Stripe verifies their identity AND the school confirms in person that they are the parent on
--   record (support reviews a birth certificate or court order as the fallback, without keeping it); (3) Stripe Identity
--   (ID + selfie) only for disputes; (4) payout flags change by hand only with a written reason and a second admin.
--   1. payee_verifications: append-only record of each check (provider, method, provider reference, status, yes/no
--      checks, reviewer, reason). CHECK constraints refuse SSN-shaped text and unknown check names. No client access.
--   2. payee_for_player / payee_hold_reason: the actual payee (the guardian on record while the guardian holds the money
--      or the athlete is a minor; otherwise the athlete's account) needs a current identity check (Stripe: identity and
--      TIN) and, for a guardian, a current relationship check. athlete_payout_status adds 'needs_payee_verification'.
--      "Transfers active" (payouts_enabled) is no longer read as identity.
--   3. record_stripe_kyc (server only) records Stripe's result for the future account.updated webhook (CONNECT).
--   4. Payout flags (profiles.stripe_connect_id / payouts_enabled / stripe_onboarding_complete and the custodial
--      account's) change only from the server or through an approved two-admin override (payout_flag_overrides).
--   5. A changed guardian on record or Connect account supersedes the old checks (re-verification).
--   6. Admin: overview, relationship check entry, revoke, override request / approval, report.
--
-- Owner: CONNECT (via COMMERCE, CTO) with CUSTODIAL, ATHLETE_VERIFICATION, ADMIN; reviews RLS_SECURITY, SECURITY,
--   PRIVACY_ENGINEERING, INFO_RETURNS, LEGAL (row AA), DATA_GOVERNANCE.
-- Needs: 20261014110000_minor_accounts.sql first.
-- Safe to re-run: create table if not exists; create or replace; drop trigger if exists.
-- Applied: written 2026-10-14, not applied anywhere. Payouts stay blocked (503) regardless.
-- Rollback: drop the two new tables and the functions and triggers below; re-apply athlete_payout_status from
--   20261014110000; restore admin writes to the payout flags (guard_profiles_admin_escalation still allows them).

-- 1. Records -----------------------------------------------------------------------------------------------------------

create table if not exists public.payee_verifications (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid references public.profiles (id) on delete set null,
  player_id uuid references public.players (id) on delete set null,
  role text not null check (role in ('adult_athlete', 'guardian_payee')),
  method text not null check (method in ('stripe_connect_kyc', 'school_parent_confirmation', 'document_review', 'stripe_identity')),
  provider text not null check (provider in ('stripe', 'school', 'support')),
  -- Stripe object ids only (acct_…, vs_…); never a number a person typed.
  provider_ref text check (provider_ref is null or provider_ref ~ '^(acct|vs|vi)_[A-Za-z0-9]{6,64}$'),
  status text not null check (status in ('pending', 'verified', 'requires_input', 'failed', 'revoked', 'superseded')),
  checks jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  expires_at timestamptz,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 500),
  superseded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  -- Owner decision: no SSN, not even part of one, ever lands here.
  constraint payee_verifications_no_ssn check (coalesce(reason, '') !~ '[0-9]{3}[- ]?[0-9]{2}[- ]?[0-9]{4}'),
  constraint payee_verifications_known_checks check (
    jsonb_typeof(checks) = 'object'
    and checks - array['identity', 'tin', 'bank', 'relationship', 'document_kept'] = '{}'::jsonb
  )
);
create index if not exists payee_verifications_subject_idx on public.payee_verifications (subject_profile_id, created_at desc);
create index if not exists payee_verifications_player_idx on public.payee_verifications (player_id, created_at desc);

create table if not exists public.payout_flag_overrides (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid not null references public.profiles (id) on delete cascade,
  player_id uuid references public.players (id) on delete cascade,
  target text not null check (target in ('profile', 'custodial')),
  payouts_enabled boolean not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500 and reason !~ '[0-9]{3}[- ]?[0-9]{2}[- ]?[0-9]{4}'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default timezone('utc', now()),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  constraint payout_flag_overrides_custodial_player check (target = 'profile' or player_id is not null)
);
create index if not exists payout_flag_overrides_pending_idx on public.payout_flag_overrides (status, requested_at desc);

alter table public.payee_verifications enable row level security;
alter table public.payout_flag_overrides enable row level security;

-- Append-only: a record only moves to superseded / revoked (once), from these functions.
create or replace function public.guard_payee_verifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_trusted_server() then
      return old;
    end if;
    raise exception 'Verification records are kept.';
  end if;
  if (new.id, new.subject_profile_id, new.player_id, new.role, new.method, new.provider, new.provider_ref, new.checks,
      new.verified_at, new.expires_at, new.reviewer_id, new.reason, new.created_at)
     is distinct from (old.id, old.subject_profile_id, old.player_id, old.role, old.method, old.provider, old.provider_ref,
      old.checks, old.verified_at, old.expires_at, old.reviewer_id, old.reason, old.created_at)
     and not ((new.subject_profile_id is null and old.subject_profile_id is not null) or (new.player_id is null and old.player_id is not null)
              or (new.reviewer_id is null and old.reviewer_id is not null)) then
    raise exception 'Verification records are kept as recorded.';
  end if;
  if new.status is distinct from old.status
     and not (old.status in ('pending', 'verified', 'requires_input') and new.status in ('superseded', 'revoked')) then
    raise exception 'Verification records are kept as recorded.';
  end if;
  return new;
end;
$$;

drop trigger if exists payee_verifications_append_only on public.payee_verifications;
create trigger payee_verifications_append_only
  before update or delete on public.payee_verifications
  for each row execute function public.guard_payee_verifications();

-- 2. Who the payee is, and is it verified ------------------------------------------------------------------------------

-- The guardian on record while they hold the money (custodial account, before handover) or while the athlete is a known
-- minor; otherwise the athlete's own account (verified, else the open claimant).
create or replace function public.payee_for_player(target_player_id uuid)
returns table (payee_profile_id uuid, payee_role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  guardian uuid;
  account uuid := public.athlete_profile_for_player(target_player_id);
  bd date;
  band text;
begin
  select pl.guardian_id into guardian from public.players pl where pl.id = target_player_id;
  select b.birth_date into bd from public.athlete_birthdates b where b.player_id = target_player_id;
  band := case when account is null then 'unknown' else public.profile_age_band(account) end;
  if (exists (select 1 from public.custodial_accounts ca where ca.player_id = target_player_id)
      and not public.athlete_controls_money(target_player_id))
     or (bd is not null and bd > current_date - interval '18 years') or public.is_minor_band(band) or band = 'under_13' then
    return query select guardian, 'guardian_payee'::text;
  else
    return query select account, 'adult_athlete'::text;
  end if;
end;
$$;

-- The newest live record of one method for this payee (and athlete, for relationship checks).
create or replace function public.current_payee_check(subject uuid, target_player_id uuid, check_methods text[])
returns public.payee_verifications
language sql
stable
security definer
set search_path = ''
as $$
  select v.* from public.payee_verifications v
  where v.subject_profile_id = subject
    and v.method = any (check_methods)
    and (target_player_id is null or v.player_id = target_player_id)
    and v.status not in ('superseded', 'revoked')
    and (v.expires_at is null or v.expires_at > timezone('utc', now()))
  order by v.created_at desc
  limit 1;
$$;

-- What the payee still needs, as a list: 'payee' (nobody to pay), 'identity' (Stripe identity + TIN), 'relationship'
-- (school parent confirmation or document review, for a guardian). Empty = verified.
create or replace function public.payee_missing_checks(target_player_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  payee uuid;
  payee_role text;
  kyc public.payee_verifications;
  rel public.payee_verifications;
  missing text[] := array[]::text[];
begin
  select p.payee_profile_id, p.payee_role into payee, payee_role from public.payee_for_player(target_player_id) p;
  if payee is null then
    return array['payee'];
  end if;
  kyc := public.current_payee_check(payee, null, array['stripe_connect_kyc']);
  if kyc.id is null or kyc.status <> 'verified' or coalesce((kyc.checks ->> 'identity')::boolean, false) is not true
     or coalesce((kyc.checks ->> 'tin')::boolean, false) is not true then
    missing := array_append(missing, 'identity');
  end if;
  if payee_role = 'guardian_payee' then
    rel := public.current_payee_check(payee, target_player_id, array['school_parent_confirmation', 'document_review']);
    if rel.id is null or rel.status <> 'verified' then
      missing := array_append(missing, 'relationship');
    end if;
  end if;
  return missing;
end;
$$;

create or replace function public.payee_hold_reason(target_player_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when cardinality(public.payee_missing_checks(target_player_id)) = 0 then null else 'needs_payee_verification' end;
$$;

-- 3. The payout gate ----------------------------------------------------------------------------------------------

-- Same as MINOR-01, plus payee_hold_reason wherever money would otherwise be allowed (the payout flags alone are no
-- longer read as identity).
--   reason   why it is held: 'disputed' | 'no_claim' | 'needs_payout_setup' | 'needs_guardian_consent' |
--            'needs_birth_month' | 'needs_payee_verification' | null
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
  hold text;
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
    hold := coalesce(public.minor_payout_hold_reason(target_player_id, public.athlete_profile_for_player(target_player_id)),
                     public.payee_hold_reason(target_player_id));
    if hold is not null then
      return jsonb_build_object('allowed', false, 'path', 'school', 'cap_cents', null, 'reason', hold, 'vouches', 0);
    end if;
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

  -- the claimant is the account money would follow on this path
  hold := coalesce(public.minor_payout_hold_reason(target_player_id, req.requester_user_id), public.payee_hold_reason(target_player_id));
  if hold is not null then
    return jsonb_build_object('allowed', false, 'path', 'identity', 'cap_cents', null, 'reason', hold, 'vouches', vouches);
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

-- 4. Recording checks --------------------------------------------------------------------------------------------------

-- Marks this payee's live checks of these methods superseded (a new check, or something changed that needs a new one).
create or replace function public.supersede_payee_checks(subject uuid, target_player_id uuid, check_methods text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payee_verifications set status = 'superseded', superseded_at = timezone('utc', now())
  where subject_profile_id = subject and method = any (check_methods)
    and (target_player_id is null or player_id = target_player_id)
    and status in ('pending', 'verified', 'requires_input');
$$;

-- Stripe's answer for a Connect account (server only: the account.updated webhook, CONNECT follow-up). Records identity /
-- TIN / bank results and, with the server's own flag, mirrors "transfers active" onto the account row.
create or replace function public.record_stripe_kyc(account_id text, identity_verified boolean, tin_verified boolean, transfers_active boolean, details_due boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid;
  rec uuid;
begin
  if not public.is_trusted_server() then
    raise exception 'Only the server records Stripe results.';
  end if;
  select p.id into subject from public.profiles p where p.stripe_connect_id = account_id limit 1;
  if subject is null then
    select ca.guardian_id into subject from public.custodial_accounts ca where ca.stripe_connect_id = account_id limit 1;
  end if;
  if subject is null then
    raise exception 'Unknown Connect account.';
  end if;
  perform public.supersede_payee_checks(subject, null, array['stripe_connect_kyc']);
  insert into public.payee_verifications (subject_profile_id, role, method, provider, provider_ref, status, checks, verified_at)
  values (
    subject,
    case when exists (select 1 from public.players pl where pl.guardian_id = subject) then 'guardian_payee' else 'adult_athlete' end,
    'stripe_connect_kyc', 'stripe', account_id,
    case when coalesce(identity_verified, false) and coalesce(tin_verified, false) then 'verified'
         when coalesce(details_due, false) then 'requires_input' else 'pending' end,
    jsonb_build_object('identity', coalesce(identity_verified, false), 'tin', coalesce(tin_verified, false), 'bank', coalesce(transfers_active, false)),
    case when coalesce(identity_verified, false) and coalesce(tin_verified, false) then timezone('utc', now()) end
  )
  returning id into rec;
  perform set_config('app.tapuai_payout_flag_write', 'on', true);
  update public.profiles set payouts_enabled = coalesce(transfers_active, false) where stripe_connect_id = account_id;
  update public.custodial_accounts set payouts_enabled = coalesce(transfers_active, false) where stripe_connect_id = account_id;
  perform set_config('app.tapuai_payout_flag_write', 'off', true);
  return rec;
end;
$$;

-- An admin records a relationship check for a guardian: the school's in-person confirmation that they are the parent on
-- record (default), or support's review of a birth certificate / court order (fallback; the document is not kept).
-- Stripe Identity is entered here only for a dispute.
create or replace function public.admin_record_payee_check(
  target_player_id uuid, subject uuid, check_method text, passed boolean, reason text, provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec uuid;
  me uuid := public.my_profile_id();
begin
  perform public.require_admin_guard();
  if check_method not in ('school_parent_confirmation', 'document_review', 'stripe_identity') then
    raise exception 'Choose school parent confirmation, document review or Stripe Identity.';
  end if;
  if char_length(btrim(coalesce(reason, ''))) < 10 then
    raise exception 'Say what was checked (at least 10 characters). Never type an SSN or a document number.';
  end if;
  if check_method <> 'stripe_identity' and not exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = subject) then
    raise exception 'Set this person as the athlete''s guardian on record first.';
  end if;
  perform public.supersede_payee_checks(subject, target_player_id, array[check_method]);
  insert into public.payee_verifications (subject_profile_id, player_id, role, method, provider, provider_ref, status, checks, verified_at, reviewer_id, reason)
  values (
    subject, target_player_id,
    case when exists (select 1 from public.players pl where pl.id = target_player_id and pl.guardian_id = subject) then 'guardian_payee' else 'adult_athlete' end,
    check_method,
    case check_method when 'school_parent_confirmation' then 'school' when 'document_review' then 'support' else 'stripe' end,
    provider_ref,
    case when coalesce(passed, false) then 'verified' else 'failed' end,
    case check_method
      when 'stripe_identity' then jsonb_build_object('identity', coalesce(passed, false))
      when 'document_review' then jsonb_build_object('relationship', coalesce(passed, false), 'document_kept', false)
      else jsonb_build_object('relationship', coalesce(passed, false)) end,
    case when coalesce(passed, false) then timezone('utc', now()) end,
    me, btrim(reason)
  )
  returning id into rec;
  return rec;
end;
$$;

create or replace function public.admin_revoke_payee_check(verification_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  perform public.require_admin_guard();
  if char_length(btrim(coalesce(reason, ''))) < 10 then
    raise exception 'Give a reason (at least 10 characters).';
  end if;
  update public.payee_verifications set status = 'revoked', superseded_at = timezone('utc', now())
  where id = verification_id and status in ('pending', 'verified', 'requires_input');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'This check is no longer live.';
  end if;
  insert into public.payee_verifications (subject_profile_id, player_id, role, method, provider, status, reviewer_id, reason)
  select v.subject_profile_id, v.player_id, v.role, v.method, v.provider, 'revoked', public.my_profile_id(), 'Revoked: ' || btrim(reason)
  from public.payee_verifications v where v.id = verification_id;
end;
$$;

-- 5. Payout flags: the server, or two admins with a reason --------------------------------------------------------------

create or replace function public.guard_payout_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_trusted_server() or coalesce(current_setting('app.tapuai_payout_flag_write', true), '') = 'on' then
    return new;
  end if;
  if tg_table_name = 'profiles' then
    if new.stripe_connect_id is distinct from old.stripe_connect_id
       or new.payouts_enabled is distinct from old.payouts_enabled
       or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete then
      raise exception 'Payout settings change only from Stripe, or with a second admin''s approval.';
    end if;
  elsif new.stripe_connect_id is distinct from old.stripe_connect_id or new.payouts_enabled is distinct from old.payouts_enabled then
    raise exception 'Payout settings change only from Stripe, or with a second admin''s approval.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_payout_flags_guard on public.profiles;
create trigger profiles_payout_flags_guard
  before update on public.profiles
  for each row execute function public.guard_payout_flags();
drop trigger if exists custodial_payout_flags_guard on public.custodial_accounts;
create trigger custodial_payout_flags_guard
  before update on public.custodial_accounts
  for each row execute function public.guard_payout_flags();

create or replace function public.admin_request_payout_override(subject uuid, target_player_id uuid, enable boolean, reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec uuid;
begin
  perform public.require_admin_guard();
  insert into public.payout_flag_overrides (subject_profile_id, player_id, target, payouts_enabled, reason, requested_by)
  values (subject, target_player_id, case when target_player_id is null then 'profile' else 'custodial' end, coalesce(enable, false), btrim(coalesce(reason, '')), public.my_profile_id())
  returning id into rec;
  return rec;
end;
$$;

-- A second admin (not the requester) approves or rejects within 7 days; approval applies the flag.
create or replace function public.admin_decide_payout_override(override_id uuid, approve boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.payout_flag_overrides%rowtype;
  me uuid := public.my_profile_id();
begin
  perform public.require_admin_guard();
  select * into o from public.payout_flag_overrides where id = override_id for update;
  if not found or o.status <> 'pending' then
    raise exception 'This request was already handled.';
  end if;
  if o.requested_by is not distinct from me then
    raise exception 'A second admin has to decide this.';
  end if;
  if o.requested_at <= timezone('utc', now()) - interval '7 days' then
    update public.payout_flag_overrides set status = 'expired', decided_at = timezone('utc', now()) where id = o.id;
    return 'expired';
  end if;
  if coalesce(approve, false) then
    perform set_config('app.tapuai_payout_flag_write', 'on', true);
    if o.target = 'profile' then
      update public.profiles set payouts_enabled = o.payouts_enabled where id = o.subject_profile_id;
    else
      update public.custodial_accounts set payouts_enabled = o.payouts_enabled where player_id = o.player_id;
    end if;
    perform set_config('app.tapuai_payout_flag_write', 'off', true);
  end if;
  update public.payout_flag_overrides
  set status = case when coalesce(approve, false) then 'approved' else 'rejected' end, decided_by = me, decided_at = timezone('utc', now())
  where id = o.id;
  return case when coalesce(approve, false) then 'approved' else 'rejected' end;
end;
$$;

-- 6. Re-verification ----------------------------------------------------------------------------------------------------

-- A new guardian on record needs new checks; so does a new Connect account.
create or replace function public.payee_changes_supersede()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Nested: PL/pgSQL resolves every field named in a condition, so each table's columns are read only for that table.
  if tg_table_name = 'players' then
    if new.guardian_id is distinct from old.guardian_id and old.guardian_id is not null then
      perform public.supersede_payee_checks(old.guardian_id, new.id, array['school_parent_confirmation', 'document_review', 'stripe_identity']);
    end if;
  elsif tg_table_name = 'profiles' then
    if new.stripe_connect_id is distinct from old.stripe_connect_id then
      perform public.supersede_payee_checks(new.id, null, array['stripe_connect_kyc']);
    end if;
  elsif tg_table_name = 'custodial_accounts' then
    if new.stripe_connect_id is distinct from old.stripe_connect_id then
      perform public.supersede_payee_checks(new.guardian_id, null, array['stripe_connect_kyc']);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists players_payee_supersede on public.players;
create trigger players_payee_supersede after update of guardian_id on public.players
  for each row execute function public.payee_changes_supersede();
drop trigger if exists profiles_payee_supersede on public.profiles;
create trigger profiles_payee_supersede after update of stripe_connect_id on public.profiles
  for each row execute function public.payee_changes_supersede();
drop trigger if exists custodial_payee_supersede on public.custodial_accounts;
create trigger custodial_payee_supersede after update of stripe_connect_id on public.custodial_accounts
  for each row execute function public.payee_changes_supersede();

-- 7. Admin ---------------------------------------------------------------------------------------------------------------

-- One person's payee picture: athletes they are the payee for (as the athlete or the guardian on record), what each
-- still needs, the check history (never an SSN; no document), the payout flags and open override requests.
create or replace function public.admin_payee_overview(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'payouts_enabled', (select coalesce(p.payouts_enabled, false) from public.profiles p where p.id = target_profile_id),
    'has_connect_account', (select p.stripe_connect_id is not null from public.profiles p where p.id = target_profile_id),
    'athletes', coalesce((
      select jsonb_agg(jsonb_build_object('player_id', pl.id, 'name', pl.name,
        'as', case when pl.guardian_id = target_profile_id then 'guardian' else 'athlete' end,
        'payee_is_this_person', (select f.payee_profile_id = target_profile_id from public.payee_for_player(pl.id) f),
        'missing', to_jsonb(public.payee_missing_checks(pl.id)),
        'payout', public.athlete_payout_status(pl.id)) order by pl.name)
      from public.players pl
      where pl.guardian_id = target_profile_id
         or pl.id = (select p.player_id from public.profiles p where p.id = target_profile_id and p.verification_status = 'verified')
    ), '[]'::jsonb),
    'checks', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'player_id', v.player_id, 'role', v.role, 'method', v.method,
        'provider', v.provider, 'status', v.status, 'checks', v.checks, 'verified_at', v.verified_at, 'created_at', v.created_at,
        'reviewer', (select r.full_name from public.profiles r where r.id = v.reviewer_id), 'reason', v.reason) order by v.created_at desc)
      from public.payee_verifications v where v.subject_profile_id = target_profile_id
    ), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'target', o.target, 'player_id', o.player_id, 'payouts_enabled', o.payouts_enabled,
        'reason', o.reason, 'status', o.status, 'requested_at', o.requested_at,
        'requested_by', (select r.full_name from public.profiles r where r.id = o.requested_by),
        'mine', o.requested_by is not distinct from public.my_profile_id()) order by o.requested_at desc)
      from public.payout_flag_overrides o where o.subject_profile_id = target_profile_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_payee_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return jsonb_build_object(
    'verified_identity', (select count(distinct v.subject_profile_id) from public.payee_verifications v
                          where v.method = 'stripe_connect_kyc' and v.status = 'verified'),
    'verified_relationship', (select count(*) from public.payee_verifications v
                              where v.method in ('school_parent_confirmation', 'document_review') and v.status = 'verified'),
    'needs_input', (select count(*) from public.payee_verifications v where v.status = 'requires_input'),
    'failed_30d', (select count(*) from public.payee_verifications v where v.status = 'failed' and v.created_at > timezone('utc', now()) - interval '30 days'),
    'overrides_waiting', (select count(*) from public.payout_flag_overrides o
                          where o.status = 'pending' and o.requested_at > timezone('utc', now()) - interval '7 days')
  );
end;
$$;

-- 8. Access ----------------------------------------------------------------------------------------------------------------

do $$
declare
  t text;
  fn text;
begin
  foreach t in array array['payee_verifications', 'payout_flag_overrides'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    -- MINOR-01 rule for every RLS table: closed (under-13) accounts are refused.
    execute format('drop policy if exists "Closed accounts" on public.%I', t);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated
                    using ((select public.caller_not_age_blocked())) with check ((select public.caller_not_age_blocked()))', t);
  end loop;
  foreach fn in array array[
    'public.guard_payee_verifications()', 'public.payee_for_player(uuid)', 'public.current_payee_check(uuid, uuid, text[])',
    'public.payee_missing_checks(uuid)', 'public.payee_hold_reason(uuid)', 'public.supersede_payee_checks(uuid, uuid, text[])',
    'public.record_stripe_kyc(text, boolean, boolean, boolean, boolean)', 'public.guard_payout_flags()', 'public.payee_changes_supersede()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
  foreach fn in array array[
    'public.admin_record_payee_check(uuid, uuid, text, boolean, text, text)', 'public.admin_revoke_payee_check(uuid, text)',
    'public.admin_request_payout_override(uuid, uuid, boolean, text)', 'public.admin_decide_payout_override(uuid, boolean)',
    'public.admin_payee_overview(uuid)', 'public.admin_payee_report()'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;


-- FUN-01: default-off, approved-account testing pilot, private immutable media, exact permission and free ballots.
-- Design: docs/engineering/design/FAN_ZONE_DESIGN.md. Written/replayed locally; never applied by this script.
-- Rollback: pause campaigns, retain consent/audit/case records, revoke fun_* API grants and archive media via approved removal.
-- Dependencies: MINOR-01 profile age/guardian links and PRIV-01 profile/block helpers. No financial data is changed.

create table if not exists public.fan_zone_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  theme text not null check (char_length(theme) between 1 and 240),
  period text not null check (period in ('game','week')),
  status text not null default 'draft' check (status in ('draft','open','paused','closed','finalized')),
  testing_only boolean not null default true check (testing_only),
  pilot_accounts uuid[] not null default '{}' check (cardinality(pilot_accounts) <= 100),
  entry_opens_at timestamptz not null,
  entry_closes_at timestamptz not null,
  vote_opens_at timestamptz not null,
  vote_closes_at timestamptz not null,
  rules text not null check (char_length(rules) between 10 and 4000),
  support_contact text not null default '' check (char_length(support_contact) <= 200),
  story_reel_id uuid references public.reels(id) on delete set null,
  opened_at timestamptz,
  results jsonb not null default '[]',
  result_signature text,
  recount_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (entry_opens_at < entry_closes_at and vote_opens_at < vote_closes_at and entry_closes_at <= vote_closes_at)
);
create table if not exists public.fan_zone_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  owner_id uuid not null references public.profiles(id),
  revision integer not null default 1 check (revision between 1 and 100),
  path text not null unique,
  alias text not null default '' check (char_length(alias) <= 40),
  caption text not null default '' check (char_length(caption) <= 240),
  rights_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft','submitted','accepted','changes','rejected','suspended','withdrawn')),
  reason text check (char_length(reason) <= 500),
  verified boolean not null default false,
  digest text check (digest ~ '^[a-f0-9]{64}$'),
  bytes integer check (bytes between 1 and 20971520),
  duration_ms integer check (duration_ms between 1000 and 30000),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id,owner_id)
);
create table if not exists public.fan_zone_consents (
  id uuid primary key default gen_random_uuid(),
  sequence_id bigint generated always as identity,
  entry_id uuid not null references public.fan_zone_entries(id),
  revision integer not null,
  actor_id uuid not null references public.profiles(id),
  link_id uuid references public.guardian_links(id),
  action text not null check (action in ('assent','grant','revoke')),
  scope jsonb not null,
  created_at timestamptz not null default now()
);
-- Explicit publication binding: historical grants cannot replace a revoked or ended relied-on grant.
alter table public.fan_zone_entries add column if not exists guardian_consent_id uuid references public.fan_zone_consents(id);
create table if not exists public.fan_zone_ballots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  voter_id uuid not null references public.profiles(id),
  entry_id uuid not null references public.fan_zone_entries(id),
  version integer not null check (version > 0),
  invalidated_at timestamptz,
  invalid_reason text check (char_length(invalid_reason) between 5 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,voter_id)
);
create table if not exists public.fan_zone_requests (
  request_id uuid not null,
  voter_id uuid not null references public.profiles(id),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  entry_id uuid not null,
  expected_version integer not null,
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key(voter_id,request_id)
);
create table if not exists public.fan_zone_cases (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.fan_zone_entries(id),
  revision integer not null,
  path text not null,
  reporter_id uuid references public.profiles(id),
  kind text not null check(kind in ('report','appeal','deletion')),
  details text not null check(char_length(details) between 3 and 1000),
  secret_hash text not null unique,
  status text not null default 'open' check(status in ('open','escalated','resolved','completed')),
  reason text check(char_length(reason) between 5 and 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',
  updated_at timestamptz not null default now()
);
create table if not exists public.fan_zone_audit (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  subject_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.fan_zone_reflections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.fan_zone_campaigns(id),
  owner_id uuid not null references public.profiles(id),
  idea text not null check(idea in ('encourage','help_at_home','serve_together','thank_someone')),
  created_at timestamptz not null default now()
);
create index if not exists fan_zone_consents_entry on public.fan_zone_consents(entry_id,revision,created_at desc);
create index if not exists fan_zone_cases_page on public.fan_zone_cases(entry_id,created_at desc);
-- One deletion request covers every historical revision; exact retries reuse its receipt rather than adding cases.
create unique index if not exists fan_zone_one_deletion on public.fan_zone_cases(entry_id) where kind='deletion';
create index if not exists fan_zone_audit_page on public.fan_zone_audit(campaign_id,created_at desc);

-- Table grants are closed even under Supabase's permissive default privileges. Definer APIs enforce actor gates.
do $$ declare t text; begin
  foreach t in array array['campaigns','entries','consents','ballots','requests','cases','audit','reflections'] loop
    execute format('alter table public.fan_zone_%I enable row level security',t);
    execute format('revoke all on public.fan_zone_%I from public, anon, authenticated',t);
    execute format('grant all on public.fan_zone_%I to service_role',t);
    execute format('drop policy if exists fan_zone_closed_account on public.fan_zone_%I',t);
    execute format('create policy fan_zone_closed_account on public.fan_zone_%I as restrictive for all to authenticated using (public.my_profile_id() is not null) with check (public.my_profile_id() is not null)',t);
  end loop;
end $$;

create or replace function public.fun_eligible(p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
  -- Check the stored closure marker and age band directly; calling this helper from itself recurses.
  select exists(select 1 from public.profiles p where p.id=p_profile and p.age_blocked_at is null
    and public.profile_age_band(p.id) in ('adult','teen_13_15','teen_16_17'));
$$;
create or replace function public.fun_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); begin
  if not public.fun_eligible(me) then raise exception 'FUN_ACCOUNT_INELIGIBLE'; end if; return me;
end $$;
create or replace function public.fun_admin_guard() returns uuid language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); begin
  if not coalesce(public.current_user_role()='admin',false) then raise exception 'FUN_ADMIN_REQUIRED'; end if; return me;
end $$;
create or replace function public.fun_pilot(p_campaign uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(p_profile) and exists(select 1 from public.fan_zone_campaigns c where c.id=p_campaign and p_profile=any(c.pilot_accounts));
$$;
create or replace function public.fun_scope(p_entry public.fan_zone_entries) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('campaign_id',p_entry.campaign_id,'revision',p_entry.revision,'digest',p_entry.digest,
 'alias',p_entry.alias,'caption',p_entry.caption,'audience','approved_pilot_accounts','form_version','fan-zone-v1-testing','reuse',false);
$$;
create or replace function public.fun_guardian(p_owner uuid,p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(p_actor) and public.profile_age_band(p_actor)='adult' and public.fun_eligible(p_owner)
 and public.is_minor_band(public.profile_age_band(p_owner)) and not public.is_blocked_between(p_actor,p_owner)
 and exists(select 1 from public.guardian_links l where l.minor_id=p_owner and l.guardian_id=p_actor and l.confirmed_at is not null and l.ended_at is null);
$$;
create or replace function public.fun_guardian_grant_valid(p_entry public.fan_zone_entries) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.fan_zone_consents s join public.guardian_links l on l.id=s.link_id
 where s.id=p_entry.guardian_consent_id and s.entry_id=p_entry.id and s.revision=p_entry.revision
 and s.scope=public.fun_scope(p_entry) and s.action='grant'
 and l.minor_id=p_entry.owner_id and l.guardian_id=s.actor_id and l.confirmed_at is not null and l.ended_at is null
 and public.fun_guardian(p_entry.owner_id,s.actor_id) and not exists(select 1 from public.fan_zone_consents x
 where x.entry_id=s.entry_id and x.revision=s.revision and x.actor_id=s.actor_id and x.sequence_id>s.sequence_id));
$$;
create or replace function public.fun_permission_valid(p_entry public.fan_zone_entries) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(p_entry.owner_id) and p_entry.verified and p_entry.removed_at is null and exists(
 select 1 from public.fan_zone_consents s where s.entry_id=p_entry.id and s.revision=p_entry.revision and s.actor_id=p_entry.owner_id
 and s.scope=public.fun_scope(p_entry) and s.action='assent' and not exists(select 1 from public.fan_zone_consents x where x.entry_id=s.entry_id and x.revision=s.revision and x.actor_id=s.actor_id and x.sequence_id>s.sequence_id))
 and (public.profile_age_band(p_entry.owner_id)='adult' or public.fun_guardian_grant_valid(p_entry));
$$;
create or replace function public.fun_candidate(p_entry public.fan_zone_entries) returns boolean language sql stable security definer set search_path='' as $$
 select p_entry.status='accepted' and public.fun_pilot(p_entry.campaign_id,p_entry.owner_id) and public.fun_permission_valid(p_entry);
$$;
create or replace function public.fun_entry_json(p_entry public.fan_zone_entries) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p_entry)||jsonb_build_object('consent_scope',public.fun_scope(p_entry),'permission_valid',public.fun_permission_valid(p_entry),'media_revisions',coalesce((select jsonb_agg(jsonb_build_object('revision',(a.detail->>'revision')::int,'path',a.detail->>'path','present',exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=a.detail->>'path')) order by a.created_at) from public.fan_zone_audit a where a.subject_id=p_entry.id and a.action='entry_revision'),'[]'::jsonb));
$$;
create or replace function public.fun_campaign_json(p_campaign public.fan_zone_campaigns) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p_campaign)-'pilot_accounts'-'result_signature';
$$;
create or replace function public.fun_case_json(p_case public.fan_zone_cases) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p_case.id,'entry_id',p_case.entry_id,'revision',p_case.revision,'kind',p_case.kind,'status',p_case.status,'created_at',p_case.created_at,'expires_at',p_case.expires_at);
$$;
create or replace function public.fun_audit(p_campaign uuid,p_action text,p_subject uuid,p_detail jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.fan_zone_audit(campaign_id,actor_id,action,subject_id,detail) values(p_campaign,public.my_profile_id(),p_action,p_subject,p_detail);
$$;
create or replace function public.fun_signature(p_campaign uuid) returns text language sql stable security definer set search_path='' as $$
 select md5(coalesce((select string_agg(e.id::text||':'||e.revision::text,',' order by e.id) from public.fan_zone_entries e where e.campaign_id=p_campaign and public.fun_candidate(e)),'')||'|'||coalesce((select string_agg(b.id::text||':'||b.version::text,',' order by b.id) from public.fan_zone_ballots b join public.fan_zone_entries e on e.id=b.entry_id where b.campaign_id=p_campaign and b.invalidated_at is null and public.fun_pilot(p_campaign,b.voter_id) and public.fun_candidate(e) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id)),''));
$$;

create or replace function public.fun_admin_campaign(p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); c public.fan_zone_campaigns; tally jsonb;
begin
 if p_action='create' then
  insert into public.fan_zone_campaigns(title,theme,period,entry_opens_at,entry_closes_at,vote_opens_at,vote_closes_at,rules,support_contact,story_reel_id,pilot_accounts)
  values(p_payload->>'title',p_payload->>'theme',p_payload->>'period',(p_payload->>'entry_opens_at')::timestamptz,(p_payload->>'entry_closes_at')::timestamptz,(p_payload->>'vote_opens_at')::timestamptz,(p_payload->>'vote_closes_at')::timestamptz,p_payload->>'rules',coalesce(p_payload->>'support_contact',''),(p_payload->>'story_reel_id')::uuid,coalesce(array(select jsonb_array_elements_text(p_payload->'pilot_accounts')::uuid),'{}')) returning * into c;
 else
  select * into c from public.fan_zone_campaigns where id=p_id for update;
  if not found then raise exception 'FUN_CAMPAIGN_UNAVAILABLE'; end if;
  if p_action='configure' then
   if c.opened_at is not null then raise exception 'FUN_RULES_IMMUTABLE'; end if;
   update public.fan_zone_campaigns set title=coalesce(p_payload->>'title',title),theme=coalesce(p_payload->>'theme',theme),period=coalesce(p_payload->>'period',period),rules=coalesce(p_payload->>'rules',rules),support_contact=coalesce(p_payload->>'support_contact',support_contact),
   entry_opens_at=coalesce((p_payload->>'entry_opens_at')::timestamptz,entry_opens_at),entry_closes_at=coalesce((p_payload->>'entry_closes_at')::timestamptz,entry_closes_at),vote_opens_at=coalesce((p_payload->>'vote_opens_at')::timestamptz,vote_opens_at),vote_closes_at=coalesce((p_payload->>'vote_closes_at')::timestamptz,vote_closes_at),
   story_reel_id=case when p_payload?'story_reel_id' then (p_payload->>'story_reel_id')::uuid else story_reel_id end,pilot_accounts=case when p_payload?'pilot_accounts' then array(select jsonb_array_elements_text(p_payload->'pilot_accounts')::uuid) else pilot_accounts end where id=c.id;
  elsif p_action='open' then
   if c.status not in ('draft','paused') or now()>=c.vote_closes_at or char_length(trim(c.support_contact))<5 or cardinality(c.pilot_accounts)=0
   or exists(select 1 from unnest(c.pilot_accounts) p where not public.fun_eligible(p)) then raise exception 'FUN_TESTING_OPEN_DENIED'; end if;
   update public.fan_zone_campaigns set status='open',opened_at=coalesce(opened_at,now()) where id=c.id;
  elsif p_action='pause' then
   if c.status<>'open' then raise exception 'FUN_STATE_INVALID'; end if;
   update public.fan_zone_campaigns set status='paused' where id=c.id;
  elsif p_action='close' then
   if c.status not in ('open','paused') then raise exception 'FUN_STATE_INVALID'; end if;
   update public.fan_zone_campaigns set status='closed' where id=c.id;
  elsif p_action in ('finalize','recount') then
   if now()<c.vote_closes_at or c.opened_at is null then raise exception 'FUN_VOTING_NOT_ENDED'; end if;
   with counts as (select e.id,count(b.id)::int votes from public.fan_zone_entries e left join public.fan_zone_ballots b on b.entry_id=e.id and b.invalidated_at is null and public.fun_pilot(c.id,b.voter_id) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id) where e.campaign_id=c.id and public.fun_candidate(e) group by e.id)
   select coalesce(jsonb_agg(jsonb_build_object('entry_id',id,'votes',votes) order by id),'[]') into tally from counts where votes>0 and votes=(select max(votes) from counts);
   update public.fan_zone_campaigns set status='finalized',results=tally,recount_required=false,result_signature=public.fun_signature(c.id) where id=c.id;
  else raise exception 'FUN_ACTION_INVALID'; end if;
  update public.fan_zone_campaigns set updated_at=now() where id=c.id returning * into c;
 end if;
 perform public.fun_audit(c.id,'campaign_'||p_action,c.id);
 return jsonb_build_object('ok',true,'campaign',to_jsonb(c)-'result_signature');
end $$;

create or replace function public.fun_entry(p_campaign_id uuid,p_entry_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); c public.fan_zone_campaigns; e public.fan_zone_entries; eid uuid:=gen_random_uuid();
begin
 select * into c from public.fan_zone_campaigns where id=p_campaign_id for update;
 if not found then raise exception 'FUN_ENTRY_UNAVAILABLE'; end if;
 if p_action='reserve' then
  if not public.fun_pilot(c.id,me) or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at then raise exception 'FUN_ENTRY_WINDOW_CLOSED'; end if;
  if (select count(*) from public.fan_zone_entries where campaign_id=c.id)>=100 then raise exception 'FUN_ENTRY_CAP'; end if;
  insert into public.fan_zone_entries(id,campaign_id,owner_id,path) values(eid,c.id,me,eid::text||'/1/'||gen_random_uuid()::text||'.mp4') returning * into e;
 else
  select * into e from public.fan_zone_entries where id=p_entry_id and campaign_id=c.id and owner_id=me for update;
  if not found then raise exception 'FUN_ENTRY_UNAVAILABLE'; end if;
  if p_action='withdraw' then
   update public.fan_zone_entries set status='withdrawn',updated_at=now() where id=e.id returning * into e;
   update public.fan_zone_campaigns set recount_required=true where id=c.id;
  else
   if not public.fun_pilot(c.id,me) or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at or e.status='withdrawn' then raise exception 'FUN_ENTRY_WINDOW_CLOSED'; end if;
   if p_action='edit' then
    -- A changed revision never points at old sanitized bytes or old public permission.
    update public.fan_zone_entries set revision=revision+1,path=id::text||'/'||(revision+1)::text||'/'||gen_random_uuid()::text||'.mp4',alias=coalesce(p_payload->>'alias',''),caption=coalesce(p_payload->>'caption',''),rights_confirmed=coalesce((p_payload->>'rights_confirmed')::boolean,false),status='draft',reason=null,verified=false,digest=null,bytes=null,duration_ms=null,removed_at=null,guardian_consent_id=null,updated_at=now() where id=e.id returning * into e;
    update public.fan_zone_campaigns set recount_required=true where id=c.id;
   elsif p_action='submit' then
    if e.status<>'draft' or not e.verified or e.removed_at is not null or not e.rights_confirmed or char_length(trim(e.alias))<1 or char_length(trim(e.caption))<1 then raise exception 'FUN_VERIFIED_RIGHTS_REQUIRED'; end if;
    update public.fan_zone_entries set status='submitted',updated_at=now() where id=e.id returning * into e;
   else raise exception 'FUN_ACTION_INVALID'; end if;
  end if;
 end if;
 if p_action in ('reserve','edit') then perform public.fun_audit(c.id,'entry_revision',e.id,jsonb_build_object('revision',e.revision,'path',e.path)); end if;
 perform public.fun_audit(c.id,'entry_'||p_action,e.id,jsonb_build_object('revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;

create or replace function public.fun_permission(p_entry_id uuid,p_revision integer,p_action text,p_expected_scope jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); e public.fan_zone_entries; c public.fan_zone_campaigns; link uuid; scope jsonb; receipt_id uuid; bind_grant boolean:=false;
begin
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.id=p_entry_id for update of c0;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or (e.owner_id<>me and not public.fun_guardian(e.owner_id,me)) then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
 scope:=public.fun_scope(e);
 if e.revision<>p_revision or p_expected_scope is distinct from scope then raise exception 'FUN_PERMISSION_SCOPE_STALE'; end if;
 if p_action='assent' then
  if me<>e.owner_id then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
 elsif p_action='grant' then
  if not public.fun_guardian(e.owner_id,me) then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
  select id into link from public.guardian_links where minor_id=e.owner_id and guardian_id=me and confirmed_at is not null and ended_at is null;
  -- A different guardian's receipt is retained but cannot replace a still-valid relied-on guardian.
  bind_grant:=not public.fun_guardian_grant_valid(e) or exists(select 1 from public.fan_zone_consents s where s.id=e.guardian_consent_id and s.actor_id=me);
 elsif p_action='revoke' then
  if me<>e.owner_id then select id into link from public.guardian_links where minor_id=e.owner_id and guardian_id=me and confirmed_at is not null and ended_at is null; end if;
 else raise exception 'FUN_ACTION_INVALID'; end if;
 if p_action<>'revoke' and (not e.verified or e.removed_at is not null or e.status='withdrawn' or not public.fun_pilot(c.id,e.owner_id)) then raise exception 'FUN_PERMISSION_UNAVAILABLE'; end if;
 insert into public.fan_zone_consents(entry_id,revision,actor_id,link_id,action,scope) values(e.id,e.revision,me,link,p_action,scope) returning id into receipt_id;
 if bind_grant then update public.fan_zone_entries set guardian_consent_id=receipt_id,updated_at=now() where id=e.id returning * into e; end if;
 update public.fan_zone_campaigns set recount_required=true where id=e.campaign_id;
 perform public.fun_audit(e.campaign_id,'permission_'||p_action,e.id,jsonb_build_object('revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;

create or replace function public.fun_vote(p_campaign_id uuid,p_entry_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); c public.fan_zone_campaigns; e public.fan_zone_entries; b public.fan_zone_ballots; r public.fan_zone_requests; receipt jsonb;
begin
 -- The campaign lock serializes ballots with review, withdrawal, pause, invalidation and finalization.
 select * into c from public.fan_zone_campaigns where id=p_campaign_id for update;
 if not found or p_request_id is null or p_expected_version is null or p_expected_version<0 then raise exception 'FUN_BALLOT_INVALID'; end if;
 select * into r from public.fan_zone_requests where voter_id=me and request_id=p_request_id;
 if found then
  if r.campaign_id<>p_campaign_id or r.entry_id<>p_entry_id or r.expected_version<>p_expected_version or now()>=r.expires_at then raise exception 'FUN_REQUEST_REUSED'; end if; return r.receipt;
 end if;
 if not public.fun_pilot(c.id,me) or c.status<>'open' or now()<c.vote_opens_at or now()>=c.vote_closes_at then raise exception 'FUN_VOTE_WINDOW_CLOSED'; end if;
 if (select count(*) from public.fan_zone_requests where voter_id=me and campaign_id=c.id)>=60 then raise exception 'FUN_BALLOT_RATE_LIMIT'; end if;
 select * into e from public.fan_zone_entries where id=p_entry_id and campaign_id=c.id;
 if not found or not public.fun_candidate(e) or e.owner_id=me or public.is_blocked_between(me,e.owner_id) then raise exception 'FUN_CANDIDATE_UNAVAILABLE'; end if;
 select * into b from public.fan_zone_ballots where campaign_id=c.id and voter_id=me for update;
 if coalesce(b.version,0)<>p_expected_version then raise exception 'FUN_BALLOT_VERSION_STALE'; end if;
 if b.invalidated_at is not null then raise exception 'FUN_BALLOT_INVALIDATED'; end if;
 insert into public.fan_zone_ballots(campaign_id,voter_id,entry_id,version) values(c.id,me,e.id,1)
 on conflict(campaign_id,voter_id) do update set entry_id=excluded.entry_id,version=fan_zone_ballots.version+1,updated_at=now() returning * into b;
 receipt:=jsonb_build_object('ok',true,'request_id',p_request_id,'ballot',jsonb_build_object('id',b.id,'campaign_id',b.campaign_id,'entry_id',b.entry_id,'version',b.version,'invalidated',false));
 insert into public.fan_zone_requests(request_id,voter_id,campaign_id,entry_id,expected_version,receipt,expires_at) values(p_request_id,me,c.id,e.id,p_expected_version,receipt,c.vote_closes_at+interval '30 days');
 return receipt;
end $$;

-- Remove the unpublished old overload before restoring narrow API grants.
drop function if exists public.fun_admin_entry(uuid,text,text);
create or replace function public.fun_admin_entry(p_entry_id uuid,p_action text,p_reason text,p_expected_scope jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); e public.fan_zone_entries; c public.fan_zone_campaigns; target text;
begin
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.id=p_entry_id for update of c0;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found then raise exception 'FUN_ENTRY_UNAVAILABLE'; end if;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 500 then raise exception 'FUN_REASON_REQUIRED'; end if;
 -- Normal review applies only to the exact media/copy seen; explicit emergency suspension stops the current entry.
 if p_expected_scope is distinct from public.fun_scope(e) and not (p_action='suspend' and p_expected_scope is null) then raise exception 'FUN_REVIEW_SCOPE_STALE'; end if;
 target:=case p_action when 'accept' then 'accepted' when 'changes' then 'changes' when 'reject' then 'rejected' when 'suspend' then 'suspended' end;
 if target is null or e.status='withdrawn' or (target='accepted' and (e.status not in ('submitted','suspended') or not e.verified or not e.rights_confirmed or e.removed_at is not null)) then raise exception 'FUN_STATE_INVALID'; end if;
 update public.fan_zone_entries set status=target,reason=p_reason,updated_at=now() where id=e.id returning * into e;
 update public.fan_zone_campaigns set recount_required=true where id=e.campaign_id;
 perform public.fun_audit(e.campaign_id,'review_'||p_action,e.id,jsonb_build_object('reason',p_reason,'revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;
create or replace function public.fun_admin_ballot(p_ballot_id uuid,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); b public.fan_zone_ballots;
begin
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_ballots b0 on b0.campaign_id=c.id where b0.id=p_ballot_id for update of c;
 if p_reason is null or char_length(trim(p_reason)) not between 5 and 500 then raise exception 'FUN_REASON_REQUIRED'; end if;
 update public.fan_zone_ballots set invalidated_at=coalesce(invalidated_at,now()),invalid_reason=p_reason where id=p_ballot_id returning * into b;
 if not found then raise exception 'FUN_BALLOT_UNAVAILABLE'; end if;
 update public.fan_zone_campaigns set recount_required=true where id=b.campaign_id;
 perform public.fun_audit(b.campaign_id,'ballot_invalidate',b.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true,'ballot',to_jsonb(b));
end $$;

create or replace function public.fun_media_access(p_entry_id uuid,p_revision integer,p_intent text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); e public.fan_zone_entries; media_path text;
begin
 select * into e from public.fan_zone_entries where id=p_entry_id;
 if not found or not public.fun_eligible(me) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
 if p_intent='remove' then
  if me<>e.owner_id and not public.fun_guardian(e.owner_id,me) and not coalesce(public.current_user_role()='admin',false) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  if not exists(select 1 from public.fan_zone_cases k where k.entry_id=e.id and k.kind='deletion' and k.status in ('open','escalated')) then raise exception 'FUN_REMOVAL_NOT_REQUESTED'; end if;
  select a.detail->>'path' into media_path from public.fan_zone_audit a where a.subject_id=e.id and a.action='entry_revision' and (a.detail->>'revision')::int=p_revision order by a.created_at desc limit 1;
  if media_path is null then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
 else
  if e.revision<>p_revision or e.removed_at is not null then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  media_path:=e.path;
  if p_intent='verify' then
   -- Only the owner may reauthorize a current draft; an existing digest permits a receipt retry, never another Storage write.
   if me<>e.owner_id or not public.fun_pilot(e.campaign_id,me) or e.status<>'draft' or not exists(select 1 from public.fan_zone_campaigns c where c.id=e.campaign_id and c.status='open' and now()>=c.entry_opens_at and now()<c.entry_closes_at) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  elsif p_intent='read' then
   if not e.verified or (me<>e.owner_id and not public.fun_guardian(e.owner_id,me) and not coalesce(public.current_user_role()='admin',false)
    and not (public.fun_pilot(e.campaign_id,me) and public.fun_candidate(e) and not public.is_blocked_between(me,e.owner_id))) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
   if e.status='withdrawn' and me<>e.owner_id and not coalesce(public.current_user_role()='admin',false) then raise exception 'FUN_MEDIA_UNAVAILABLE'; end if;
  else raise exception 'FUN_ACTION_INVALID'; end if;
 end if;
 return jsonb_build_object('ok',true,'bucket','fan_zone','path',media_path,'entry_id',e.id,'revision',p_revision,'digest',case when e.revision=p_revision then e.digest end,'bytes',case when e.revision=p_revision then e.bytes end,'duration_ms',case when e.revision=p_revision then e.duration_ms end);
end $$;
create or replace function public.fun_verify_media(p_entry_id uuid,p_revision integer,p_digest text,p_bytes integer,p_duration_ms integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.fan_zone_entries; c public.fan_zone_campaigns;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FUN_SERVICE_REQUIRED'; end if;
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.id=p_entry_id for update of c0;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or e.revision<>p_revision or e.status<>'draft' or e.verified or not public.fun_pilot(c.id,e.owner_id)
 or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at or not exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=e.path) then raise exception 'FUN_VERIFY_STALE'; end if;
 if p_digest is null or p_digest !~ '^[a-f0-9]{64}$' or p_bytes is null or p_bytes not between 1 and 20971520 or p_duration_ms is null or p_duration_ms not between 1000 and 30000 then raise exception 'FUN_MEDIA_INVALID'; end if;
 update public.fan_zone_entries set verified=true,digest=p_digest,bytes=p_bytes,duration_ms=p_duration_ms,updated_at=now() where id=e.id returning * into e;
 perform public.fun_audit(e.campaign_id,'media_verified',e.id,jsonb_build_object('revision',e.revision));
 return jsonb_build_object('ok',true,'entry',public.fun_entry_json(e));
end $$;
create or replace function public.fun_complete_removal(p_entry_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.fan_zone_entries; media_path text; complete boolean;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'FUN_SERVICE_REQUIRED'; end if;
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_entries e0 on e0.campaign_id=c.id where e0.id=p_entry_id for update of c;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or not exists(select 1 from public.fan_zone_cases k where k.entry_id=e.id and k.kind='deletion') then raise exception 'FUN_REMOVAL_NOT_REQUESTED'; end if;
 select a.detail->>'path' into media_path from public.fan_zone_audit a where a.subject_id=e.id and a.action='entry_revision' and (a.detail->>'revision')::int=p_revision order by a.created_at desc limit 1;
 if media_path is null or exists(select 1 from storage.objects where bucket_id='fan_zone' and name=media_path) then raise exception 'FUN_OBJECT_STILL_PRESENT'; end if;
 if p_revision=e.revision then update public.fan_zone_entries set verified=false,removed_at=now(),status='withdrawn',updated_at=now() where id=e.id; end if;
 complete:=not exists(select 1 from storage.objects where bucket_id='fan_zone' and name like e.id::text||'/%');
 if complete then update public.fan_zone_cases set status='completed',reason='Server confirmed all entry objects removed',updated_at=now() where entry_id=e.id and kind='deletion' and status in ('open','escalated'); end if;
 update public.fan_zone_campaigns set recount_required=true where id=e.campaign_id;
 perform public.fun_audit(e.campaign_id,'media_removed',e.id,jsonb_build_object('revision',p_revision));
 return jsonb_build_object('ok',true,'entry_id',e.id,'revision',p_revision,'completed',complete);
end $$;

create or replace function public.fun_case(p_entry_id uuid,p_kind text,p_details text,p_secret uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); e public.fan_zone_entries; k public.fan_zone_cases; h text; staff boolean:=coalesce(public.current_user_role()='admin',false);
begin
 if p_secret is null or p_details is null or char_length(trim(p_details)) not between 3 and 1000 or p_kind not in ('report','appeal','deletion') or p_kind is null then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if auth.uid() is not null and not public.fun_eligible(me) then raise exception 'FUN_ACCOUNT_INELIGIBLE'; end if;
 h:=encode(public.digest(p_secret::text,'sha256'),'hex');
 -- All entry/case mutations take campaign then entry, before a case lock or its audit campaign FK lock.
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_entries e0 on e0.campaign_id=c.id where e0.id=p_entry_id for update of c;
 select * into e from public.fan_zone_entries where id=p_entry_id for update;
 if not found or not coalesce((me=e.owner_id or public.fun_guardian(e.owner_id,me) or coalesce(public.current_user_role()='admin',false)
  or (p_kind='report' and public.fun_candidate(e) and (me is null or public.fun_pilot(e.campaign_id,me)) and not public.is_blocked_between(me,e.owner_id))),false) then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if p_kind='appeal' and not coalesce((me=e.owner_id or public.fun_guardian(e.owner_id,me)),false) then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if p_kind='deletion' and not coalesce((me=e.owner_id or public.fun_guardian(e.owner_id,me) or staff),false) then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 if staff then perform public.fun_admin_guard(); end if;
 -- Global intake accounting follows campaign/entry locks; it never blocks the path to an existing removal request.
 perform pg_advisory_xact_lock(710014);
 -- Receipt lookup can be foreign to this entry; read it without taking a foreign case lock out of order.
 select * into k from public.fan_zone_cases where secret_hash=h;
 if found then
  if k.entry_id<>e.id or k.kind<>p_kind or k.details<>p_details or k.reporter_id is distinct from me or now()>=k.expires_at then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
  return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
 end if;
 if p_kind='deletion' and exists(select 1 from public.fan_zone_cases where entry_id=e.id and kind='deletion') then raise exception 'FUN_DELETION_ALREADY_REQUESTED'; end if;
 -- Public report volume must not prevent the owner from requesting actual removal.
 if (p_kind='report' and ((select count(*) from public.fan_zone_cases where entry_id=e.id and kind='report' and created_at>now()-interval '1 day')>=5
 or (select count(*) from public.fan_zone_cases where kind='report' and status in ('open','escalated'))>=500))
 or (p_kind<>'deletion' and me is not null and (select count(*) from public.fan_zone_cases where reporter_id=me and kind<>'deletion' and created_at>now()-interval '1 day')>=10) then raise exception 'FUN_CASE_RATE_LIMIT'; end if;
 insert into public.fan_zone_cases(entry_id,revision,path,reporter_id,kind,details,secret_hash) values(e.id,e.revision,e.path,me,p_kind,p_details,h) returning * into k;
 perform public.fun_audit(e.campaign_id,'case_'||p_kind,k.id);
 return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
end $$;
create or replace function public.fun_case_status(p_case_id uuid,p_secret uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare k public.fan_zone_cases;
begin
 select * into k from public.fan_zone_cases where id=p_case_id and secret_hash=encode(public.digest(p_secret::text,'sha256'),'hex') and now()<expires_at;
 if not found then raise exception 'FUN_CASE_UNAVAILABLE'; end if;
 return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
end $$;
create or replace function public.fun_admin_case(p_case_id uuid,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); k public.fan_zone_cases; campaign uuid;
begin
 -- Match entry/permission/removal mutation lock order; audit insertion needs the already-held campaign FK lock.
 perform 1 from public.fan_zone_campaigns c join public.fan_zone_entries e on e.campaign_id=c.id join public.fan_zone_cases k0 on k0.entry_id=e.id where k0.id=p_case_id for update of c;
 perform 1 from public.fan_zone_entries e join public.fan_zone_cases k0 on k0.entry_id=e.id where k0.id=p_case_id for update of e;
 select * into k from public.fan_zone_cases where id=p_case_id for update;
 if not found or k.status not in ('open','escalated') or p_reason is null or char_length(trim(p_reason)) not between 5 and 500 or p_action not in ('resolve','escalate') or p_action is null then raise exception 'FUN_CASE_INVALID'; end if;
 if k.kind='deletion' and p_action='resolve' then raise exception 'FUN_ACTUAL_REMOVAL_REQUIRED'; end if;
 update public.fan_zone_cases set status=case p_action when 'resolve' then 'resolved' else 'escalated' end,reason=p_reason,updated_at=now() where id=k.id returning * into k;
 select campaign_id into campaign from public.fan_zone_entries where id=k.entry_id;
 perform public.fun_audit(campaign,'case_'||p_action,k.id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('ok',true,'case',public.fun_case_json(k));
end $$;
create or replace function public.fun_reflection(p_campaign_id uuid,p_id uuid,p_idea text,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=public.fun_actor(); r public.fan_zone_reflections;
begin
 if p_action='create' then
  if not public.fun_pilot(p_campaign_id,me) or not exists(select 1 from public.fan_zone_campaigns where id=p_campaign_id and opened_at is not null) or p_idea is null or p_idea not in ('encourage','help_at_home','serve_together','thank_someone') then raise exception 'FUN_REFLECTION_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtext(me::text));
  if (select count(*) from public.fan_zone_reflections where owner_id=me and campaign_id=p_campaign_id)>=20 then raise exception 'FUN_REFLECTION_CAP'; end if;
  insert into public.fan_zone_reflections(campaign_id,owner_id,idea) values(p_campaign_id,me,p_idea) returning * into r;
  return jsonb_build_object('ok',true,'reflection',to_jsonb(r)-'owner_id');
 elsif p_action='delete' then
  delete from public.fan_zone_reflections where id=p_id and owner_id=me and campaign_id=p_campaign_id returning * into r;
  if not found then raise exception 'FUN_REFLECTION_UNAVAILABLE'; end if;
  return jsonb_build_object('ok',true,'deleted_id',r.id);
 else raise exception 'FUN_ACTION_INVALID'; end if;
end $$;

create or replace function public.fun_snapshot(p_campaign_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.my_profile_id(); c public.fan_zone_campaigns; own jsonb; ballot jsonb; candidates jsonb; results jsonb; story jsonb; queue jsonb; reflections jsonb;
begin
 select * into c from public.fan_zone_campaigns x where (p_campaign_id is null or x.id=p_campaign_id) and public.fun_eligible(me)
 and (public.fun_pilot(x.id,me) or coalesce(public.current_user_role()='admin',false) or exists(select 1 from public.fan_zone_entries e where e.campaign_id=x.id and (e.owner_id=me or public.fun_guardian(e.owner_id,me))))
 and (x.opened_at is not null or coalesce(public.current_user_role()='admin',false)) order by x.created_at desc,x.id desc limit 1;
 if c.id is null then return jsonb_build_object('ok',true,'campaign',null,'candidates','[]'::jsonb,'results','[]'::jsonb,'entry',null,'ballot',null,'guardian_queue','[]'::jsonb,'reflections','[]'::jsonb,'story',null,'eligible',public.fun_eligible(me),'can_participate',false); end if;
 select public.fun_entry_json(e) into own from public.fan_zone_entries e where campaign_id=c.id and owner_id=me;
 select jsonb_build_object('id',b.id,'campaign_id',b.campaign_id,'entry_id',b.entry_id,'version',b.version,'invalidated',b.invalidated_at is not null) into ballot from public.fan_zone_ballots b where b.campaign_id=c.id and b.voter_id=me;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'alias',e.alias,'caption',e.caption) order by md5(e.id::text||current_date::text)),'[]') into candidates from public.fan_zone_entries e where e.campaign_id=c.id and public.fun_pilot(c.id,me) and public.fun_candidate(e) and not public.is_blocked_between(me,e.owner_id);
 results:='[]';
 if c.status='finalized' and not c.recount_required and c.result_signature=public.fun_signature(c.id) and public.fun_pilot(c.id,me) then
  select coalesce(jsonb_agg(j),'[]') into results from jsonb_array_elements(c.results) j join public.fan_zone_entries e on e.id=(j->>'entry_id')::uuid where public.fun_candidate(e) and not public.is_blocked_between(me,e.owner_id);
 end if;
 select coalesce(jsonb_agg(public.fun_entry_json(e) order by e.created_at),'[]') into queue from public.fan_zone_entries e where e.campaign_id=c.id and public.fun_guardian(e.owner_id,me) and e.status<>'withdrawn';
 select coalesce(jsonb_agg(to_jsonb(r)-'owner_id' order by r.created_at desc),'[]') into reflections from public.fan_zone_reflections r where r.campaign_id=c.id and r.owner_id=me;
 -- A curated story must remain free/public; no alternative athlete is substituted when its source becomes private.
 select jsonb_build_object('id',r.id,'player_id',r.player_id,'video_url',r.video_url,'title',r.title) into story from public.reels r join public.profiles p on p.id=r.uploaded_by
 where r.id=c.story_reel_id and r.tag_status='confirmed' and r.media_type='video' and not r.is_removed and not r.is_flagged and not r.is_vault_only and not r.is_exclusive and not p.account_private and public.fun_eligible(p.id) and (public.profile_age_band(p.id)='adult' or public.minor_has_consent(p.id,'public_profile')) and not public.is_blocked_between(me,p.id);
 return jsonb_build_object('ok',true,'campaign',public.fun_campaign_json(c)||jsonb_build_object('results',results,'recount_required',c.recount_required or (c.result_signature is not null and c.result_signature<>public.fun_signature(c.id))),
 'candidates',candidates,'results',results,'entry',own,'ballot',ballot,'guardian_queue',queue,'reflections',reflections,'story',story,'eligible',public.fun_eligible(me),'can_participate',public.fun_pilot(c.id,me));
end $$;
drop function if exists public.fun_admin_snapshot(uuid,timestamptz);
create or replace function public.fun_admin_snapshot(p_campaign_id uuid default null,p_before text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=public.fun_admin_guard(); c public.fan_zone_campaigns; campaigns jsonb; entries jsonb; cases jsonb; audit jsonb; ballots jsonb; counts jsonb;
 cursor jsonb; marker jsonb; case_at timestamptz; case_id uuid; audit_at timestamptz; audit_id uuid; case_next jsonb; audit_next jsonb; combined jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(x)-'result_signature' order by x.created_at desc),'[]') into campaigns from (select * from public.fan_zone_campaigns order by created_at desc limit 100) x;
 select * into c from public.fan_zone_campaigns where p_campaign_id is null or id=p_campaign_id order by created_at desc,id desc limit 1;
 -- Independent composite markers also preserve imported rows with identical timestamps.
 if p_before is not null then
  begin
   if char_length(p_before)>2000 then raise exception 'FUN_CURSOR_INVALID'; end if;
   cursor:=p_before::jsonb;
   if jsonb_typeof(cursor)<>'object' or cursor->'v' is distinct from '1'::jsonb or jsonb_typeof(cursor->'campaign') is distinct from 'string'
    or cursor->>'campaign' is distinct from c.id::text or not (cursor ? 'cases' or cursor ? 'audit')
    or exists(select 1 from jsonb_object_keys(cursor) k where k not in ('v','campaign','cases','audit')) then raise exception 'FUN_CURSOR_INVALID'; end if;
   for marker in select value from jsonb_each(cursor) where key in ('cases','audit') loop
    if jsonb_typeof(marker)<>'object' or jsonb_typeof(marker->'at') is distinct from 'string' or jsonb_typeof(marker->'id') is distinct from 'string'
     or exists(select 1 from jsonb_object_keys(marker) k where k not in ('at','id'))
     or (marker->>'at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$'
     or (marker->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'FUN_CURSOR_INVALID'; end if;
   end loop;
   case_at:=(cursor->'cases'->>'at')::timestamptz;case_id:=(cursor->'cases'->>'id')::uuid;
   audit_at:=(cursor->'audit'->>'at')::timestamptz;audit_id:=(cursor->'audit'->>'id')::uuid;
  exception when others then raise exception 'FUN_CURSOR_INVALID'; end;
 end if;
 select coalesce(jsonb_agg(public.fun_entry_json(e)||jsonb_build_object('media_revisions',coalesce((select jsonb_agg(jsonb_build_object('revision',(a.detail->>'revision')::int,'path',a.detail->>'path','present',exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=a.detail->>'path')) order by a.created_at) from public.fan_zone_audit a where a.subject_id=e.id and a.action='entry_revision'),'[]'::jsonb)) order by e.created_at),'[]') into entries from public.fan_zone_entries e where e.campaign_id=c.id;
 select coalesce(jsonb_agg(to_jsonb(x)-'secret_hash' order by x.created_at desc,x.id desc),'[]') into cases from (select k.* from public.fan_zone_cases k join public.fan_zone_entries e on e.id=k.entry_id where e.campaign_id=c.id and (case_at is null or (k.created_at,k.id)<(case_at,case_id)) order by k.created_at desc,k.id desc limit 50) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') into audit from (select * from public.fan_zone_audit where campaign_id=c.id and (audit_at is null or (created_at,id)<(audit_at,audit_id)) order by created_at desc,id desc limit 50) x;
 select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('valid',b.invalidated_at is null and public.fun_pilot(c.id,b.voter_id) and public.fun_candidate(e) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id)) order by b.created_at),'[]') into ballots from public.fan_zone_ballots b join public.fan_zone_entries e on e.id=b.entry_id where b.campaign_id=c.id;
 select jsonb_build_object('entries',(select count(*) from public.fan_zone_entries where campaign_id=c.id),'ballots',(select count(*) from public.fan_zone_ballots where campaign_id=c.id),'valid_ballots',(select count(*) from public.fan_zone_ballots b join public.fan_zone_entries e on e.id=b.entry_id where b.campaign_id=c.id and b.invalidated_at is null and public.fun_pilot(c.id,b.voter_id) and public.fun_candidate(e) and b.voter_id<>e.owner_id and not public.is_blocked_between(b.voter_id,e.owner_id)),
 'cases',(select count(*) from public.fan_zone_cases k join public.fan_zone_entries e on e.id=k.entry_id where e.campaign_id=c.id),'open_cases',(select count(*) from public.fan_zone_cases k join public.fan_zone_entries e on e.id=k.entry_id where e.campaign_id=c.id and k.status in ('open','escalated')),'audit',(select count(*) from public.fan_zone_audit where campaign_id=c.id),
 'entry_statuses',coalesce((select jsonb_object_agg(status,n) from (select status,count(*) n from public.fan_zone_entries where campaign_id=c.id group by status) x),'{}'::jsonb)) into counts;
 if jsonb_array_length(cases)=50 then case_next:=jsonb_build_object('v',1,'campaign',c.id,'cases',jsonb_build_object('at',cases->49->>'created_at','id',cases->49->>'id')); end if;
 if jsonb_array_length(audit)=50 then audit_next:=jsonb_build_object('v',1,'campaign',c.id,'audit',jsonb_build_object('at',audit->49->>'created_at','id',audit->49->>'id')); end if;
 if case_next is not null or audit_next is not null then combined:=coalesce(case_next,'{}')||coalesce(audit_next,'{}'); end if;
 return jsonb_build_object('ok',true,'campaigns',campaigns,'campaign',case when c.id is not null then to_jsonb(c)-'result_signature' end,'entries',entries,'ballots',ballots,'cases',cases,'audit',audit,'counts',counts,'next_cursor',combined::text,'case_next_cursor',case_next::text,'audit_next_cursor',audit_next::text);
end $$;

-- Storage checks use an unexposed namespace: callers can execute the policy, but cannot resolve/call its helper.
create schema if not exists fan_zone_private;
revoke all on schema fan_zone_private from public,anon,authenticated;
create or replace function fan_zone_private.upload_allowed(p_name text,p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.fun_eligible(public.my_profile_id()) and (p_owner is null or p_owner=auth.uid()) and exists(
 select 1 from public.fan_zone_entries e join public.fan_zone_campaigns c on c.id=e.campaign_id
 where e.path=p_name and e.owner_id=public.my_profile_id() and e.status='draft' and not e.verified and e.removed_at is null and public.fun_pilot(c.id,e.owner_id)
 and c.status='open' and now()>=c.entry_opens_at and now()<c.entry_closes_at)
 and not exists(select 1 from storage.objects o where o.bucket_id='fan_zone' and o.name=p_name);
$$;
revoke all on function fan_zone_private.upload_allowed(text,uuid) from public,anon,authenticated;
grant execute on function fan_zone_private.upload_allowed(text,uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('fan_zone','fan_zone',false,20971520,array['video/mp4']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create unique index if not exists fan_zone_object_unique on storage.objects(bucket_id,name) where bucket_id='fan_zone';
-- A service upsert must also obey the reserved draft invariant: a late upload cannot recreate removed media.
-- This protects Storage catalog rows; physical provider writes/metadata compatibility require hosted verification.
create or replace function public.fun_storage_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.fan_zone_entries; c public.fan_zone_campaigns; owner_user uuid;
begin
 if tg_op='UPDATE' and (old.bucket_id='fan_zone' or new.bucket_id='fan_zone')
 and (new.bucket_id,new.name,new.owner) is distinct from (old.bucket_id,old.name,old.owner) then raise exception 'FUN_STORAGE_IMMUTABLE'; end if;
 if new.bucket_id<>'fan_zone' then return new; end if;
 select c0.* into c from public.fan_zone_campaigns c0 join public.fan_zone_entries e0 on e0.campaign_id=c0.id where e0.path=new.name for update of c0;
 select * into e from public.fan_zone_entries where path=new.name for update;
 if not found or e.status<>'draft' or e.verified or e.removed_at is not null or not public.fun_pilot(c.id,e.owner_id)
 or c.status<>'open' or now()<c.entry_opens_at or now()>=c.entry_closes_at
 or exists(select 1 from public.fan_zone_cases k where k.entry_id=e.id and k.kind='deletion') then raise exception 'FUN_STORAGE_IMMUTABLE'; end if;
 select user_id into owner_user from public.profiles where id=e.owner_id;
 if new.owner is not null and new.owner is distinct from owner_user then raise exception 'FUN_STORAGE_IMMUTABLE'; end if;
 return new;
end $$;
drop trigger if exists fan_zone_storage_guard on storage.objects;
create trigger fan_zone_storage_guard before insert or update on storage.objects for each row execute function public.fun_storage_guard();
drop policy if exists fan_zone_insert on storage.objects;
create policy fan_zone_insert on storage.objects for insert to authenticated with check(bucket_id='fan_zone' and fan_zone_private.upload_allowed(name,owner));
drop policy if exists fan_zone_insert_boundary on storage.objects;
create policy fan_zone_insert_boundary on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'fan_zone' or fan_zone_private.upload_allowed(name,owner));
drop policy if exists fan_zone_no_read on storage.objects;
create policy fan_zone_no_read on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'fan_zone');
drop policy if exists fan_zone_no_update on storage.objects;
create policy fan_zone_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'fan_zone') with check(bucket_id<>'fan_zone');
drop policy if exists fan_zone_no_delete on storage.objects;
create policy fan_zone_no_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'fan_zone');



-- Timestamp-only API cursors need a strict order even when many records share one SQL transaction.
create or replace function public.fun_page_time() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='fan_zone_audit' then
  perform pg_advisory_xact_lock(710016);
  select greatest(clock_timestamp(),coalesce(max(created_at)+interval '1 microsecond',clock_timestamp())) into new.created_at from public.fan_zone_audit;
 else
  perform pg_advisory_xact_lock(710015);
  select greatest(clock_timestamp(),coalesce(max(created_at)+interval '1 microsecond',clock_timestamp())) into new.created_at from public.fan_zone_cases;
 end if;
 return new;
end $$;
create unique index if not exists fan_zone_audit_timestamp on public.fan_zone_audit(created_at);
create unique index if not exists fan_zone_case_timestamp on public.fan_zone_cases(created_at);
drop trigger if exists fan_zone_audit_time on public.fan_zone_audit;
create trigger fan_zone_audit_time before insert on public.fan_zone_audit for each row execute function public.fun_page_time();
drop trigger if exists fan_zone_case_time on public.fan_zone_cases;
create trigger fan_zone_case_time before insert on public.fan_zone_cases for each row execute function public.fun_page_time();

create or replace function public.fun_immutable_record() returns trigger language plpgsql security definer set search_path='' as $$
begin raise exception 'FUN_RECORD_IMMUTABLE'; end $$;
drop trigger if exists fan_zone_consent_immutable on public.fan_zone_consents;
create trigger fan_zone_consent_immutable before update or delete on public.fan_zone_consents for each row execute function public.fun_immutable_record();
drop trigger if exists fan_zone_audit_immutable on public.fan_zone_audit;
create trigger fan_zone_audit_immutable before update or delete on public.fan_zone_audit for each row execute function public.fun_immutable_record();
revoke all on sequence public.fan_zone_consents_sequence_id_seq from public,anon,authenticated;

-- This bounded operational helper needs a trusted runner; no scheduler or hosted cleanup is started here.
create or replace function public.fun_prune_receipts() returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; begin
 if auth.role() is distinct from 'service_role' then raise exception 'FUN_SERVICE_REQUIRED'; end if;
 delete from public.fan_zone_requests where expires_at<now(); get diagnostics n=row_count;
 return jsonb_build_object('ok',true,'deleted_requests',n);
end $$;

-- Every public function loses PostgreSQL PUBLIC and Supabase default direct grants before explicit API grants.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'fun_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
 end loop;
end $$;
grant execute on function public.fun_snapshot(uuid),public.fun_case(uuid,text,text,uuid),public.fun_case_status(uuid,uuid) to anon,authenticated;
grant execute on function public.fun_admin_snapshot(uuid,text),public.fun_admin_campaign(uuid,text,jsonb),public.fun_entry(uuid,uuid,text,jsonb),public.fun_permission(uuid,integer,text,jsonb),public.fun_vote(uuid,uuid,uuid,integer),public.fun_admin_entry(uuid,text,text,jsonb),public.fun_admin_ballot(uuid,text),public.fun_admin_case(uuid,text,text),public.fun_reflection(uuid,uuid,text,text),public.fun_media_access(uuid,integer,text) to authenticated;
grant execute on function public.fun_prune_receipts() to service_role;
grant execute on function public.fun_verify_media(uuid,integer,text,integer,integer),public.fun_complete_removal(uuid,integer) to service_role;


-- QUIZ-01: optional weekly private sport learning, isolated from money, Aura and Fan Zone votes.
-- Requires MINOR-01 helpers; ordered after FUN-01. Written locally, not applied anywhere.
-- All settings start paused with an empty <=100 canonical-profile tester allowlist. No production mode.
-- Admin facts are draft until reviewed. Edits create new versions; voids invalidate affected completion badges.
-- Rollback: drop the five sport_quiz_* tables and quiz_* functions below; no existing money/media data changes.

create table if not exists public.sport_quiz_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  testing_only boolean not null default true check (testing_only),
  pilot_accounts uuid[] not null default '{}' check (cardinality(pilot_accounts) <= 100),
  reason text not null default 'Paused; local testing only.' check (char_length(reason) between 10 and 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (not enabled or cardinality(pilot_accounts) > 0)
);
insert into public.sport_quiz_settings(singleton) values (true) on conflict do nothing;

create table if not exists public.sport_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question_key uuid not null default gen_random_uuid(),
  version integer not null check (version > 0),
  sport text not null check (char_length(btrim(sport)) between 2 and 80),
  prompt text not null check (char_length(btrim(prompt)) between 10 and 280),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option integer not null check (correct_option between 0 and 3),
  explanation text not null check (char_length(btrim(explanation)) between 10 and 500),
  status text not null default 'draft' check (status in ('draft','approved','archived','void')),
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique(question_key,version)
);

create table if not exists public.sport_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  question_id uuid references public.sport_quiz_questions(id),
  status text not null check (status in ('issued','completed','skipped','void')),
  issued_at timestamptz not null default now(),
  answered_option integer check (answered_option between 0 and 3),
  request_id uuid unique,
  completed_at timestamptz,
  voided_at timestamptz,
  correction_reason text,
  unique(profile_id,week_start),
  check (status <> 'completed' or (question_id is not null and answered_option is not null and request_id is not null and completed_at is not null)),
  check (status <> 'issued' or question_id is not null)
);

create table if not exists public.sport_quiz_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null unique references public.sport_quiz_attempts(id) on delete cascade,
  week_start date not null,
  label text not null default 'Sport Learner' check (label = 'Sport Learner'),
  visibility text not null default 'private' check (visibility = 'private'),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  unique(profile_id,week_start)
);

create table if not exists public.sport_quiz_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('settings','question_create','question_edit','question_approve','question_archive','question_void','start','answer','skip')),
  question_id uuid references public.sport_quiz_questions(id),
  attempt_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create or replace function public.quiz_week()
returns date language sql stable set search_path = '' as $$
  select date_trunc('week', now() at time zone 'UTC')::date;
$$;

create or replace function public.quiz_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.my_profile_id();
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null or me is null
     or public.profile_age_band(me) not in ('adult','teen_13_15','teen_16_17') then
    raise exception 'quiz_ineligible';
  end if;
  return me;
end;
$$;

create or replace function public.quiz_admin_actor()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_actor();
begin
  if public.current_user_role() is distinct from 'admin' then raise exception 'quiz_admin_only'; end if;
  return me;
end;
$$;

create or replace function public.quiz_require_testing(me uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.sport_quiz_settings%rowtype;
begin
  -- User writes share this lock; admin pause/allowlist/void serializes before any new completion.
  select * into s from public.sport_quiz_settings where singleton for share;
  if not found or s.testing_only is not true then raise exception 'quiz_unavailable'; end if;
  if s.enabled is not true then raise exception 'quiz_paused'; end if;
  if not (me = any(s.pilot_accounts)) then raise exception 'quiz_not_enrolled'; end if;
end;
$$;

-- Options use ECMAScript trim whitespace and Unicode codepoint lengths, matching the desk.
-- Other stored text retains the table's ASCII-space btrim/char_length contract for legacy rows.
create or replace function public.quiz_normalize_options(p_options jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare item jsonb; normalized jsonb := '[]'; option_text text;
begin
  if jsonb_typeof(p_options) is distinct from 'array' then return null; end if;
  if jsonb_array_length(p_options) <> 4 then return null; end if;
  for item in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(item) <> 'string' then return null; end if;
    option_text := btrim(item #>> '{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
    if char_length(option_text) not between 1 and 100 then return null; end if;
    normalized := normalized || jsonb_build_array(option_text);
  end loop;
  if (select count(distinct value) from jsonb_array_elements(normalized)) <> 4 then return null; end if;
  return normalized;
end;
$$;

create or replace function public.quiz_guard_question()
returns trigger language plpgsql set search_path = '' as $$
declare normalized jsonb;
begin
  if tg_op = 'UPDATE' and (new.question_key,new.version,new.sport,new.prompt,new.options,new.correct_option,new.explanation,new.created_at)
    is distinct from (old.question_key,old.version,old.sport,old.prompt,old.options,old.correct_option,old.explanation,old.created_at) then
    raise exception 'quiz_immutable: edit creates a new draft version';
  end if;
  if tg_op = 'UPDATE' and old.status = 'void' and new.status <> 'void' then raise exception 'quiz_void_final'; end if;
  normalized := public.quiz_normalize_options(new.options);
  -- Legacy malformed bytes remain inspectable and immutable; archive/void must still permit audited repair.
  if normalized is null and tg_op = 'UPDATE' and new.status in ('archived','void') then return new; end if;
  if normalized is null then raise exception 'quiz_options_invalid'; end if;
  if tg_op = 'INSERT' then new.options := normalized; end if;
  return new;
end;
$$;
drop trigger if exists quiz_question_guard on public.sport_quiz_questions;
create trigger quiz_question_guard before insert or update on public.sport_quiz_questions for each row execute function public.quiz_guard_question();

create or replace function public.quiz_guard_audit()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Account deletion may null the FK; no audit content may otherwise be rewritten or erased.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 and old.actor_id is not null and new.actor_id is null
    and (to_jsonb(new)-'actor_id') = (to_jsonb(old)-'actor_id') then return new; end if;
  raise exception 'quiz_audit_immutable';
end;
$$;
drop trigger if exists quiz_audit_guard on public.sport_quiz_audit;
create trigger quiz_audit_guard before update or delete on public.sport_quiz_audit for each row execute function public.quiz_guard_audit();
drop trigger if exists quiz_audit_truncate_guard on public.sport_quiz_audit;
create trigger quiz_audit_truncate_guard before truncate on public.sport_quiz_audit for each statement execute function public.quiz_guard_audit();

create or replace function public.quiz_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := public.my_profile_id();
  s public.sport_quiz_settings%rowtype;
  a public.sport_quiz_attempts%rowtype;
  q public.sport_quiz_questions%rowtype;
  availability text; sports jsonb := '[]'; badges jsonb := '[]'; corrections jsonb := '[]'; attempt jsonb := null;
begin
  if auth.role() is distinct from 'authenticated' or auth.uid() is null then raise exception 'quiz_ineligible'; end if;
  select * into s from public.sport_quiz_settings where singleton;
  availability := case
    when me is null or public.profile_age_band(me) not in ('adult','teen_13_15','teen_16_17') then 'ineligible'
    when s.singleton is null or s.testing_only is not true then 'unavailable'
    when not s.enabled then 'paused'
    when not (me = any(s.pilot_accounts)) then 'not_enrolled'
    else 'ready' end;
  if availability not in ('ineligible','unavailable') then
    select * into a from public.sport_quiz_attempts where profile_id = me and week_start = public.quiz_week();
    if a.id is not null then
      select * into q from public.sport_quiz_questions where id = a.question_id;
      if a.status = 'issued' and (q.id is null or public.quiz_normalize_options(q.options) is null) and availability = 'ready' then availability := 'unavailable'; end if;
      attempt := jsonb_build_object('id',a.id,'week_start',a.week_start,'sport',q.sport,'status',a.status,
        'unavailable_reason',case when a.status = 'issued' and (q.id is null or public.quiz_normalize_options(q.options) is null)
          then 'This question is unavailable while its answer choices are corrected.' else null end,
        'question',case when q.id is not null and a.status <> 'void' and (availability = 'ready' or a.status = 'completed') then
          jsonb_build_object('id',q.id,'question_key',q.question_key,'version',q.version,'sport',q.sport,'prompt',q.prompt,'options',q.options) else null end,
        'result',case when a.status = 'completed' then jsonb_build_object('option',a.answered_option,'correct_option',q.correct_option,
          'was_correct',a.answered_option = q.correct_option,'explanation',q.explanation,'completed_at',a.completed_at,'request_id',a.request_id) else null end);
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'attempt_id',b.attempt_id,'week_start',b.week_start,
      'label',b.label,'visibility',b.visibility,'issued_at',b.issued_at) order by b.week_start desc),'[]') into badges
      from public.sport_quiz_badges b where b.profile_id = me and b.voided_at is null;
    select coalesce(jsonb_agg(jsonb_build_object('attempt_id',x.id,'week_start',x.week_start,'reason',x.correction_reason,'voided_at',x.voided_at) order by x.week_start desc),'[]')
      into corrections from public.sport_quiz_attempts x where x.profile_id = me and x.status = 'void';
  end if;
  if availability = 'ready' then
    select coalesce(jsonb_agg(x.sport order by x.sport),'[]') into sports from (select distinct sport from public.sport_quiz_questions where status = 'approved' and public.quiz_normalize_options(options) is not null) x;
    -- An empty approved pool cannot offer a new question. Already-issued versions remain stable and answerable.
    if jsonb_array_length(sports) = 0 and a.id is null then availability := 'unavailable'; end if;
  end if;
  return jsonb_build_object('availability',availability,'testing_only',true,'week_start',public.quiz_week(),'week_end',public.quiz_week()+7,
    'status',case when a.id is not null then a.status when availability = 'ready' then 'available' else 'unavailable' end,
    'sports',sports,'attempt',attempt,'badges',badges,'corrections',corrections);
end;
$$;

create or replace function public.quiz_start(p_sport text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); qid uuid; aid uuid;
begin
  perform public.quiz_require_testing(me);
  -- Serializes start/skip for this canonical profile across sport changes and request retries.
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || me::text,0));
  if exists(select 1 from public.sport_quiz_attempts where profile_id = me and week_start = public.quiz_week()) then return public.quiz_snapshot(); end if;
  select id into qid from public.sport_quiz_questions where status = 'approved' and sport = btrim(p_sport)
    and public.quiz_normalize_options(options) is not null order by random() limit 1 for share;
  if qid is null then raise exception 'quiz_no_question'; end if;
  insert into public.sport_quiz_attempts(profile_id,week_start,question_id,status) values(me,public.quiz_week(),qid,'issued') returning id into aid;
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id) values(me,'start',qid,aid);
  return public.quiz_snapshot();
end;
$$;

create or replace function public.quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); a public.sport_quiz_attempts%rowtype; q public.sport_quiz_questions%rowtype;
begin
  perform public.quiz_require_testing(me);
  if p_option is null or p_option not between 0 and 3 or p_request_id is null then raise exception 'quiz_answer_invalid'; end if;
  select * into a from public.sport_quiz_attempts where id = p_attempt_id and profile_id = me for update;
  if a.id is null then raise exception 'quiz_attempt_not_owned'; end if;
  if a.week_start <> public.quiz_week() then raise exception 'quiz_week_closed'; end if;
  select * into q from public.sport_quiz_questions where id = a.question_id for share;
  if a.status = 'void' or q.status = 'void' then raise exception 'quiz_question_void'; end if;
  if a.status = 'completed' then
    if a.request_id = p_request_id and a.answered_option = p_option then return public.quiz_snapshot(); end if;
    raise exception 'quiz_answer_already_committed';
  end if;
  if a.status <> 'issued' then raise exception 'quiz_attempt_not_issued'; end if;
  if q.id is null or public.quiz_normalize_options(q.options) is null then raise exception 'quiz_question_unavailable: answer choices need correction'; end if;
  if exists(select 1 from public.sport_quiz_attempts where request_id = p_request_id) then raise exception 'quiz_request_reused'; end if;
  update public.sport_quiz_attempts set status = 'completed',answered_option = p_option,request_id = p_request_id,completed_at = now() where id = a.id;
  insert into public.sport_quiz_badges(profile_id,attempt_id,week_start) values(me,a.id,a.week_start);
  insert into public.sport_quiz_audit(actor_id,action,question_id,attempt_id) values(me,'answer',a.question_id,a.id);
  return public.quiz_snapshot();
end;
$$;

create or replace function public.quiz_skip()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_actor(); aid uuid;
begin
  perform public.quiz_require_testing(me);
  perform pg_advisory_xact_lock(hashtextextended('sport-quiz:' || me::text,0));
  insert into public.sport_quiz_attempts(profile_id,week_start,status) values(me,public.quiz_week(),'skipped')
    on conflict(profile_id,week_start) do update set status = 'skipped'
      where sport_quiz_attempts.status = 'issued' returning id into aid;
  if aid is not null then insert into public.sport_quiz_audit(actor_id,action,attempt_id) values(me,'skip',aid); end if;
  return public.quiz_snapshot();
end;
$$;

create or replace function public.quiz_admin_settings(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); testers uuid[]; next_enabled boolean;
begin
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean'
     or jsonb_typeof(p_payload->'pilot_accounts') is distinct from 'array' or char_length(btrim(coalesce(p_reason,''))) not between 10 and 500
     or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('enabled','pilot_accounts')) then raise exception 'quiz_settings_invalid'; end if;
  if jsonb_array_length(p_payload->'pilot_accounts') > 100 then raise exception 'quiz_testers_limit'; end if;
  select coalesce(array_agg(x::uuid),'{}'::uuid[]) into testers from jsonb_array_elements_text(p_payload->'pilot_accounts') x;
  next_enabled := (p_payload->>'enabled')::boolean;
  if cardinality(testers) <> (select count(distinct x) from unnest(testers) x) then raise exception 'quiz_testers_duplicate'; end if;
  -- Pause must remain available after a listed tester closes; re-enabling still requires a valid eligible audience.
  if next_enabled and exists(select 1 from unnest(testers) x where not exists(select 1 from public.profiles p where p.id = x and p.age_blocked_at is null
     and public.profile_age_band(p.id) in ('adult','teen_13_15','teen_16_17'))) then raise exception 'quiz_testers_ineligible'; end if;
  if next_enabled and cardinality(testers) = 0 then raise exception 'quiz_testers_required'; end if;
  update public.sport_quiz_settings set enabled = next_enabled, pilot_accounts = testers,reason = btrim(p_reason),updated_at = now(),updated_by = me where singleton;
  insert into public.sport_quiz_audit(actor_id,action,reason) values(me,'settings',btrim(p_reason));
  return jsonb_build_object('enabled',next_enabled,'testing_only',true,'pilot_accounts',testers);
end;
$$;

create or replace function public.quiz_admin_question(p_id uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); q public.sport_quiz_questions%rowtype; nextq public.sport_quiz_questions%rowtype; why text := btrim(p_payload->>'reason');
begin
  if p_action is null or p_action not in ('create','edit','approve','archive','void') or char_length(coalesce(why,'')) not between 10 and 500 then raise exception 'quiz_question_action_invalid'; end if;
  -- All question/config mutations lock settings first, matching user-write lock order.
  perform 1 from public.sport_quiz_settings where singleton for update;
  if p_action <> 'create' then
    select * into q from public.sport_quiz_questions where id = p_id for update;
    if q.id is null then raise exception 'quiz_question_missing'; end if;
  elsif p_id is not null then raise exception 'quiz_create_id_invalid'; end if;
  if p_action in ('create','edit') then
    if (select count(*) from public.sport_quiz_questions) >= 100 then raise exception 'quiz_bank_full'; end if;
    if p_action = 'edit' then
      update public.sport_quiz_questions set status = 'archived',reason = why where question_key = q.question_key and status = 'approved';
    end if;
    insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason,created_by)
      values(case when p_action = 'edit' then q.question_key else gen_random_uuid() end,
        case when p_action = 'edit' then (select max(version)+1 from public.sport_quiz_questions where question_key = q.question_key) else 1 end,
        btrim(p_payload->>'sport'),btrim(p_payload->>'prompt'),p_payload->'options',(p_payload->>'correct_option')::integer,btrim(p_payload->>'explanation'),why,me)
      returning * into nextq;
  else
    if q.status = 'void' then raise exception 'quiz_void_final'; end if;
    if p_action = 'approve' and q.status <> 'draft' then raise exception 'quiz_approve_draft_only'; end if;
    if p_action = 'approve' then update public.sport_quiz_questions set status = 'archived',reason = why where question_key = q.question_key and status = 'approved'; end if;
    update public.sport_quiz_questions set status = case p_action when 'approve' then 'approved' when 'archive' then 'archived' else 'void' end,
      reason = why,reviewed_at = now(),reviewed_by = me where id = q.id returning * into nextq;
    if p_action = 'void' then
      update public.sport_quiz_attempts set status = 'void',voided_at = now(),correction_reason = why where question_id = q.id and status in ('issued','completed');
      update public.sport_quiz_badges set voided_at = now() where attempt_id in (select id from public.sport_quiz_attempts where question_id = q.id) and voided_at is null;
    end if;
  end if;
  insert into public.sport_quiz_audit(actor_id,action,question_id,reason) values(me,'question_'||p_action,nextq.id,why);
  return jsonb_build_object('id',nextq.id,'question_key',nextq.question_key,'version',nextq.version,'status',nextq.status);
end;
$$;

create or replace function public.quiz_admin_snapshot(p_before bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.quiz_admin_actor(); bank jsonb; audit jsonb; next_before text;
begin
  select coalesce(jsonb_agg(to_jsonb(q) order by q.sport,q.question_key,q.version),'[]') into bank from public.sport_quiz_questions q;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id::text,'action',x.action,'actor_id',case when x.action = 'settings' or x.action like 'question_%' then x.actor_id else null end,
    'question_id',x.question_id,'reason',x.reason,'created_at',x.created_at) order by x.id desc),'[]') into audit
    from (select * from public.sport_quiz_audit where p_before is null or id < p_before order by id desc limit 50) x;
  if jsonb_array_length(audit) = 50 and exists(select 1 from public.sport_quiz_audit where id < (audit->49->>'id')::bigint) then next_before := audit->49->>'id'; end if;
  return jsonb_build_object('generated_at',now(),'week_start',public.quiz_week(),'week_end',public.quiz_week()+7,
    'settings',(select to_jsonb(s)-'singleton' from public.sport_quiz_settings s where singleton),'questions',bank,'audit',audit,'next_before',next_before,
    'counts',jsonb_build_object(
      'questions_draft',(select count(*) from public.sport_quiz_questions where status = 'draft'),
      'questions_approved',(select count(*) from public.sport_quiz_questions where status = 'approved'),
      'questions_archived',(select count(*) from public.sport_quiz_questions where status = 'archived'),
      'questions_void',(select count(*) from public.sport_quiz_questions where status = 'void'),
      'week_issued',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'issued'),
      'week_completed',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'completed'),
      'week_skipped',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'skipped'),
      'week_void',(select count(*) from public.sport_quiz_attempts where week_start = public.quiz_week() and status = 'void'),
      'badges_issued',(select count(*) from public.sport_quiz_badges where voided_at is null),
      'badges_void',(select count(*) from public.sport_quiz_badges where voided_at is not null)));
end;
$$;

-- Draft-only seeds: human fact/context approval is required before a question can be assigned.
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason)
select '10000000-0000-0000-0000-000000000001',1,'American football',
  'In American football, how many points is a touchdown before any extra point or conversion?',
  '["3","6","7","2"]',1,'A touchdown is worth six points. The extra-point or two-point conversion attempt is scored separately.',
  'Draft factual example; content owner must verify context before approval.'
where not exists(select 1 from public.sport_quiz_questions where question_key = '10000000-0000-0000-0000-000000000001');
insert into public.sport_quiz_questions(question_key,version,sport,prompt,options,correct_option,explanation,reason)
select '10000000-0000-0000-0000-000000000002',1,'Basketball',
  'In standard five-on-five basketball, how many players from each team are on the court?',
  '["4","5","6","7"]',1,'Standard five-on-five basketball has five players from each team on the court.',
  'Draft factual example; content owner must verify five-on-five context before approval.'
where not exists(select 1 from public.sport_quiz_questions where question_key = '10000000-0000-0000-0000-000000000002');

do $$
declare tab text; fn text;
begin
  foreach tab in array array['sport_quiz_settings','sport_quiz_questions','sport_quiz_attempts','sport_quiz_badges','sport_quiz_audit'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',tab);
    execute format('drop policy if exists "Closed accounts" on public.%I',tab);
    execute format('create policy "Closed accounts" on public.%I as restrictive for all to authenticated using (public.caller_not_age_blocked()) with check (public.caller_not_age_blocked())',tab);
  end loop;
  revoke all on sequence public.sport_quiz_audit_id_seq from public,anon,authenticated,service_role;
  foreach fn in array array['public.quiz_week()','public.quiz_actor()','public.quiz_admin_actor()','public.quiz_require_testing(uuid)','public.quiz_normalize_options(jsonb)','public.quiz_guard_question()','public.quiz_guard_audit()',
    'public.quiz_snapshot()','public.quiz_start(text)','public.quiz_answer(uuid,integer,uuid)','public.quiz_skip()',
    'public.quiz_admin_snapshot(bigint)','public.quiz_admin_question(uuid,text,jsonb)','public.quiz_admin_settings(jsonb,text)'] loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn);
  end loop;
  foreach fn in array array['public.quiz_snapshot()','public.quiz_start(text)','public.quiz_answer(uuid,integer,uuid)','public.quiz_skip()',
    'public.quiz_admin_snapshot(bigint)','public.quiz_admin_question(uuid,text,jsonb)','public.quiz_admin_settings(jsonb,text)'] loop
    execute format('grant execute on function %s to authenticated',fn);
  end loop;
end;
$$;
