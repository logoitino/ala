-- ARCHIVED 2026-10-14 · MINOR-01 · owner approved · excerpt from supabase/migrations/20261014090000_profile_privacy.sql (draft, never applied) (audience_rank).
-- Not built, tested or applied. Restore: add it back to a new migration (and the lock columns privacy_locked_by / privacy_locked_at for the lock functions).
-- Every archived item and its reason: docs/engineering/data-ownership.json → archived.

create or replace function public.audience_rank(level text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case level when 'everyone' then 3 when 'friends' then 2 when 'only_me' then 1 else 0 end;
$$;
