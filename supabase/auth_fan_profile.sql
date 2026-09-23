-- Fan profile bootstrap on first auth (Soft-Wall / Magic Link / Apple / Google).
-- Safe to re-run. Pair with apps/mobile/src/frontend/lib/auth.ts `ensureFanProfile`.

-- 2026-09: adds the COPPA age gate (`profiles.age_confirmed_13_plus`) from signup metadata.
-- Run `alter table public.profiles add column if not exists age_confirmed_13_plus boolean default null;`
-- first on any project that predates this change (also in the canonical schema.sql).
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
