-- Reels bucket: signed-in users may write only inside their own folder (WORK_QUEUE UX-05a).
-- Purpose: the `reels` Storage INSERT / UPDATE policies only checked the bucket and that the caller
--   was signed in. Uploads use `upsert: true`, so any account could overwrite another account's
--   public Highlight video or photo-story photo (often images of minors) at the same object path.
--   Both policies now also require the path to sit in the caller's own folder.
-- Writers audited 2026-10-07 (the only code that writes to `reels`; Edge Functions, the admin portal
--   and app routes do not upload):
--   * MediaUploadService.uploadHighlight (public video): object `reels/{auth.uid}/{ms}.mp4` — note
--     the literal `reels/` prefix inside the bucket, so folder[1] = 'reels', folder[2] = uid.
--   * MediaUploadService.uploadStoryPhoto (photo story): object `{auth.uid}/stories/{reel_id}/{n}-{ms}.jpg`,
--     folder[1] = uid.
--   Both layouts are allowed so neither writer breaks. Vault clips go to `reel_vault` and avatars to
--   `avatars` (not touched here); the `game_highlights` fallback bucket keeps its bucket-only policy.
-- Design: docs/engineering/design/PHOTO_STORIES_DESIGN.md ("Privacy and safety");
--   docs/engineering/SCHEMA.md (Storage — `reels`).
-- Depends on: Supabase Storage (storage.objects, storage.foldername) and the two policies created in
--   schema.sql's Storage block ("Public upload reels bucket", "Public update reels bucket").
--   Independent of 20261007230000_photo_stories.sql; apply either first.
-- Status: written 2026-10-07, not applied anywhere, never parsed by Postgres.
--
-- Rollback (restores the previous bucket-only policies):
--   drop policy if exists "Public upload reels bucket" on storage.objects;
--   create policy "Public upload reels bucket" on storage.objects for insert
--     with check (bucket_id = 'reels' and auth.role() = 'authenticated');
--   drop policy if exists "Public update reels bucket" on storage.objects;
--   create policy "Public update reels bucket" on storage.objects for update
--     using (bucket_id = 'reels' and auth.role() = 'authenticated')
--     with check (bucket_id = 'reels' and auth.role() = 'authenticated');
begin;

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

commit;
