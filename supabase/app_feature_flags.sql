-- Residual remote table (founder screenshot: RLS disabled on app_feature_flags).
-- Product chrome is public.app_runtime_config (Features / Look / Soft-Wall / PROFILE_CHROME_FLAGS).
-- This script does NOT create a second flag store. Safe to re-run.
-- Requires public.current_user_role() (profile_roles / schema.sql).
-- No-op when the table is absent (fresh installs that never had the dashboard leftover).

do $$
declare
  pol record;
begin
  if to_regclass('public.app_feature_flags') is null then
    raise notice 'public.app_feature_flags is absent — fan chrome lives in app_runtime_config';
    return;
  end if;

  alter table public.app_feature_flags enable row level security;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'app_feature_flags'
  loop
    execute format('drop policy if exists %I on public.app_feature_flags', pol.policyname);
  end loop;

  execute $p$
    create policy "Admin only app feature flags"
      on public.app_feature_flags for all
      using (public.current_user_role() = 'admin')
      with check (public.current_user_role() = 'admin')
  $p$;

  revoke all on table public.app_feature_flags from public;
  revoke all on table public.app_feature_flags from anon;
  grant select, insert, update, delete on table public.app_feature_flags to authenticated;
exception
  when undefined_table then
    null;
  when undefined_function then
    raise exception 'current_user_role() is required before locking app_feature_flags';
end $$;
