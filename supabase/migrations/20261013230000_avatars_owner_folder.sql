-- Avatars bucket: a signed-in user may write only inside their own folder (2026-10-13).
--
-- Purpose
--   "Public upload avatars" / "Public update avatars" only checked the bucket and that the caller was signed in,
--   so any account could overwrite any other account's profile photo (often a minor's face) at its path. Same
--   class of hole as the reels bucket (20261007231000).
--   Writers audited 2026-10-13 (the only code that writes to `avatars`):
--   * MediaUploadService.uploadAvatar: `{auth.uid}/{ms}.jpg` → folder[1] = uid.
--   * useSponsorships.uploadSponsorLogo: `sponsors/{ms}.{ext}` today, `sponsors/{auth.uid}/{ms}.{ext}` from this
--     change. Older app builds keep the flat layout, so INSERT still accepts a new file directly under `sponsors/`,
--     but nobody can UPDATE (overwrite) a file there; overwriting needs the caller's own folder.
--   Reads stay public (profile photos are shown to guests by design; whether minors' photos should be is an open
--   product question, WORK_QUEUE P1-02).
--
--   Adds "Owner delete avatars": a user may delete their own photos (RLS_SECURITY review).
--
-- Owner: STORAGE (via BACKEND, CTO); reviewed by RLS_SECURITY.
-- Safe to re-run: drop policy if exists / create policy.
-- Applied: written 2026-10-13, not applied anywhere. Independent of the other 2026-10-13 files.
-- Rollback (restores the bucket-only policies; reopens the overwrite):
--   drop policy if exists "Public upload avatars" on storage.objects;
--   create policy "Public upload avatars" on storage.objects for insert
--     with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
--   drop policy if exists "Public update avatars" on storage.objects;
--   create policy "Public update avatars" on storage.objects for update
--     using (bucket_id = 'avatars' and auth.role() = 'authenticated')
--     with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

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
