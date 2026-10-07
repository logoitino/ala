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
