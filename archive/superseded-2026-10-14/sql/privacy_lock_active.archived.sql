-- ARCHIVED 2026-10-14 · MINOR-01 · owner approved · excerpt from supabase/migrations/20261014090000_profile_privacy.sql (draft, never applied) (privacy_lock_active).
-- Not built, tested or applied. Restore: add it back to a new migration (and the lock columns privacy_locked_by / privacy_locked_at for the lock functions).
-- Every archived item and its reason: docs/engineering/data-ownership.json → archived.

-- A lock ends at the athlete's handover date when it is known; otherwise it stays until released.
create or replace function public.privacy_lock_active(target uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  locked uuid;
  linked uuid;
  handover date;
begin
  select p.privacy_locked_by, p.player_id into locked, linked from public.profiles p where p.id = target;
  if locked is null then
    return false;
  end if;
  if linked is not null and to_regprocedure('public.athlete_handover_date(uuid)') is not null then
    execute 'select public.athlete_handover_date($1)' into handover using linked;
    if handover is not null and handover <= current_date then
      return false;
    end if;
  end if;
  return true;
end;
$$;
