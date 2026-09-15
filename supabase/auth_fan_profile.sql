-- Fan profile bootstrap on first auth (Soft-Wall / Magic Link / Apple / Google).
-- Safe to re-run. Pair with apps/mobile/src/frontend/lib/auth.ts `ensureFanProfile`.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role, roles, is_verified, spirit_points, active_role)
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
    'fan'
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
