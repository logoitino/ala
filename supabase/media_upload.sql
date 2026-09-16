-- Media upload: Highlight Storage `reels` + profile `avatars` + `profiles.avatar_url`.
-- Incremental: run after supabase/reels.sql. Client: MediaUploadService.

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read reels bucket" on storage.objects;
create policy "Public read reels bucket"
  on storage.objects for select
  using (bucket_id = 'reels');

drop policy if exists "Public upload reels bucket" on storage.objects;
create policy "Public upload reels bucket"
  on storage.objects for insert
  with check (bucket_id = 'reels');

drop policy if exists "Public update reels bucket" on storage.objects;
create policy "Public update reels bucket"
  on storage.objects for update
  using (bucket_id = 'reels')
  with check (bucket_id = 'reels');

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Public upload avatars" on storage.objects;
create policy "Public upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

drop policy if exists "Public update avatars" on storage.objects;
create policy "Public update avatars"
  on storage.objects for update
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');
