-- FEED-01 interest-based Highlights picks (Phase 1).
-- Purpose: owner-only storage for sports / schools / category lean / personalization toggle.
-- Design: owner interest-feed prompt (2026-11-13). Ads and paid promotion are out of scope.
-- Rollback: drop table public.user_feed_prefs;
-- Applied: not applied (Wave 0 local write). Hosted apply is owner-gated.

create table if not exists public.user_feed_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sports text[] not null default '{}',
  schools text[] not null default '{}',
  category_pref text not null default 'all'
    check (category_pref in ('all', 'game_play', 'train_like_me', 'serve_like_me')),
  personalization_on boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint user_feed_prefs_sports_len check (cardinality(sports) <= 3),
  constraint user_feed_prefs_schools_len check (cardinality(schools) <= 3)
);

comment on table public.user_feed_prefs is
  'FEED-01: signed-in Highlights picks. Used only to order the Home feed for that owner. Deleted with the account. Never shared for ads.';

alter table public.user_feed_prefs enable row level security;

revoke all on public.user_feed_prefs from public, anon;
grant select, insert, update on public.user_feed_prefs to authenticated;

drop policy if exists "Owners read own feed prefs" on public.user_feed_prefs;
create policy "Owners read own feed prefs"
  on public.user_feed_prefs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Owners insert own feed prefs" on public.user_feed_prefs;
create policy "Owners insert own feed prefs"
  on public.user_feed_prefs for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners update own feed prefs" on public.user_feed_prefs;
create policy "Owners update own feed prefs"
  on public.user_feed_prefs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No DELETE grant for clients beyond cascade from auth.users; no service-role ranking reads.
