-- Profile customization: bio, social links, and per-field "hide from other users' view" toggles.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE). Run in the Supabase SQL Editor.
-- Mirrors the corresponding section of apps/mobile/src/backend/db/schema.sql.

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

drop policy if exists "Public read athlete career stats" on public.athlete_career_stats;
create policy "Public read athlete career stats"
  on public.athlete_career_stats for select
  using (public.athlete_stats_visible(player_id));

drop policy if exists "Public read athlete game logs" on public.athlete_game_logs;
create policy "Public read athlete game logs"
  on public.athlete_game_logs for select
  using (public.athlete_stats_visible(player_id));

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
