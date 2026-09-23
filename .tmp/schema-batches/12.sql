/**
 * Remove a playbook. Games keep their `sport` text and fall back to the generic console.
 */
create or replace function public.delete_sport_config(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.sport_configs where id = target_id;
  return found;
end;
$$;
grant select on public.sport_configs to anon, authenticated;
grant insert, update, delete on public.sport_configs to anon, authenticated;
grant execute on function public.get_sport_configs() to anon, authenticated;
grant execute on function public.upsert_sport_config(jsonb) to anon, authenticated;
grant execute on function public.delete_sport_config(uuid) to anon, authenticated;
-- Soft-Wall auth: fan profile on first signup (Apple / Google / Magic Link).
-- Incremental twin: supabase/auth_fan_profile.sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    user_id, full_name, role, roles, is_verified, spirit_points, active_role, age_confirmed_13_plus
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
    -- COPPA gate: only ever set true from the sign-up checkbox's metadata (email+password /
    -- magic-link). OAuth (Apple/Google) never sends this, so it stays null and the client shows a
    -- one-time post-sign-in confirmation modal instead (`AgeConfirmModal`).
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
-- Storage: buckets + policies for Highlight upload/playback and profile avatars.
-- 2026-09 fix: this used to live only in supabase/media_upload.sql and supabase/reels.sql —
-- fine for an existing hosted project that already ran those, but it meant a FRESH project
-- seeded from schema.sql alone (exactly what Phase 0's "apply to a fresh Supabase project"
-- and the Phase 2 staging-project setup call for) had no Storage buckets at all, so every
-- upload would fail with "bucket is missing". Consolidated here so schema.sql alone is enough.
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do update set public = excluded.public;
insert into storage.buckets (id, name, public)
values ('game_highlights', 'game_highlights', true)
on conflict (id) do update set public = excluded.public;
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;
drop policy if exists "Public read reels bucket" on storage.objects;
create policy "Public read reels bucket"
  on storage.objects for select
  using (bucket_id = 'reels');
-- Signed-in fans only: bucket_id alone (with no auth check) let any anon-key
-- holder INSERT/UPDATE arbitrary files into these public buckets with no
-- session at all. MediaUploadService.ts already requires a session for both
-- uploadHighlight (reels/game_highlights) and uploadAvatar (avatars), so this
-- matches the existing client contract — it only blocks callers with no
-- session, which the app never asks Storage to do anyway.
drop policy if exists "Public upload reels bucket" on storage.objects;
create policy "Public upload reels bucket"
  on storage.objects for insert
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');
drop policy if exists "Public update reels bucket" on storage.objects;
create policy "Public update reels bucket"
  on storage.objects for update
  using (bucket_id = 'reels' and auth.role() = 'authenticated')
  with check (bucket_id = 'reels' and auth.role() = 'authenticated');
drop policy if exists "Public read game highlights" on storage.objects;
create policy "Public read game highlights"
  on storage.objects for select
  using (bucket_id = 'game_highlights');
drop policy if exists "Public upload game highlights" on storage.objects;
create policy "Public upload game highlights"
  on storage.objects for insert
  with check (bucket_id = 'game_highlights' and auth.role() = 'authenticated');
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
drop policy if exists "Public upload avatars" on storage.objects;
create policy "Public upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
drop policy if exists "Public update avatars" on storage.objects;
create policy "Public update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated')
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');