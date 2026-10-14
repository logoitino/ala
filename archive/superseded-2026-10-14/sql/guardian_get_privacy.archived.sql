-- ARCHIVED 2026-10-14 · MINOR-01 · owner approved · excerpt from supabase/migrations/20261014090000_profile_privacy.sql (draft, never applied) (guardian_get_privacy).
-- Not built, tested or applied. Restore: add it back to a new migration (and the lock columns privacy_locked_by / privacy_locked_at for the lock functions).
-- Every archived item and its reason: docs/engineering/data-ownership.json → archived.

create or replace function public.guardian_get_privacy(target_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_guardian_of_profile(target_profile_id) or public.current_user_role() = 'admin') then
    raise exception 'Only this athlete''s guardian can see these settings.';
  end if;
  return public.privacy_settings_json(target_profile_id);
end;
$$;
