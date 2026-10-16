-- ARCHIVED 2026-10-14 · MINOR-01 · owner approved · excerpt from supabase/migrations/20261014090000_profile_privacy.sql (draft, never applied) (guardian_set_privacy).
-- Not built, tested or applied. Restore: add it back to a new migration (and the lock columns privacy_locked_by / privacy_locked_at for the lock functions).
-- Every archived item and its reason: docs/engineering/data-ownership.json → archived.

-- The guardian may change the athlete's settings freely and lock or unlock them.
create or replace function public.guardian_set_privacy(target_profile_id uuid, settings jsonb, lock_settings boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.my_profile_id();
begin
  if not (public.is_guardian_of_profile(target_profile_id) or public.current_user_role() = 'admin') then
    raise exception 'Only this athlete''s guardian can change these settings.';
  end if;
  perform public.apply_privacy_settings(target_profile_id, settings, false);
  if lock_settings is not null then
    perform set_config('app.tapuai_privacy_write', 'on', true);
    update public.profiles
    set privacy_locked_by = case when lock_settings then me else null end,
        privacy_locked_at = case when lock_settings then timezone('utc', now()) else null end
    where id = target_profile_id;
    perform set_config('app.tapuai_privacy_write', 'off', true);
  end if;
  return public.privacy_settings_json(target_profile_id);
end;
$$;
