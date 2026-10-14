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

-- Signed-in fans only: bucket_id alone (with no auth check) let any anon-key
-- holder INSERT/UPDATE arbitrary files into these public buckets with no
-- session at all. MediaUploadService.ts already requires a session for both
-- uploadHighlight (reels) and uploadAvatar (avatars), so this matches the
-- existing client contract.
-- Writes are owner-folder only, kept identical to the migrations below so re-running this legacy file can never
-- reopen the overwrite hole (RLS_SECURITY 2026-10-13):
--   reels   → supabase/migrations/20261007231000_reels_storage_owner_folder.sql
--   avatars → supabase/migrations/20261013230000_avatars_owner_folder.sql
-- Who may upload: a signed-in user, into `{uid}/...` or the video layout `reels/{uid}/...`.
drop policy if exists "Public upload reels bucket" on storage.objects;
create policy "Public upload reels bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'reels'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reels'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- Who may overwrite (upsert): the same owner, for an object already in their folder and staying there.
drop policy if exists "Public update reels bucket" on storage.objects;
create policy "Public update reels bucket"
  on storage.objects for update
  using (
    bucket_id = 'reels'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reels'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'reels'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'reels'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Public upload avatars" on storage.objects;
create policy "Public upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'sponsors'
        and (
          (storage.foldername(name))[2] = auth.uid()::text
          -- legacy flat layout from older builds: a new file directly in sponsors/, never an overwrite
          or coalesce(array_length(storage.foldername(name), 1), 0) = 1
        )
      )
    )
  );

drop policy if exists "Public update avatars" on storage.objects;
create policy "Public update avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'sponsors' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  )
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'sponsors' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- A user can remove their own old photo (often a minor's face); nobody else's. There was no delete policy at all.
drop policy if exists "Owner delete avatars" on storage.objects;
create policy "Owner delete avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] = 'sponsors' and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );
