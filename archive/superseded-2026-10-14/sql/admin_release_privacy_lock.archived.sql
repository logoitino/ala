-- ARCHIVED 2026-10-14 · MINOR-01 · owner approved · excerpt from supabase/migrations/20261014090000_profile_privacy.sql (draft, never applied) (admin_release_privacy_lock).
-- Not built, tested or applied. Restore: add it back to a new migration (and the lock columns privacy_locked_by / privacy_locked_at for the lock functions).
-- Every archived item and its reason: docs/engineering/data-ownership.json → archived.

create or replace function public.admin_release_privacy_lock(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  perform set_config('app.tapuai_privacy_write', 'on', true);
  update public.profiles set privacy_locked_by = null, privacy_locked_at = null where id = target_profile_id;
  perform set_config('app.tapuai_privacy_write', 'off', true);
  return public.privacy_settings_json(target_profile_id);
end;
$$;
