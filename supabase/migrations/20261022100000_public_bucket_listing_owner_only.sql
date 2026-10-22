-- Public media buckets stop being listable by everyone (STATE §5 "Legacy Vault objects in public Storage").
--
-- Threat: "Public read …" SELECT policies let anyone list every object in reels / game_highlights / avatars, so a clip
-- moved into the Vault after upload (its file stays in the public reels bucket) could be enumerated and downloaded.
-- Public buckets serve files by URL without any SELECT policy, so playback, avatars and logos keep working. SELECT is
-- still needed for the owner's own folder: Storage upsert checks SELECT, and photo-story cleanup lists its folder.
-- Owner folders match the existing write rules: <uid>/… , reels/<uid>/… (Highlights and the game_highlights fallback),
-- sponsors/<uid>/… (booster logos). Development also carried three older duplicate policies; all six are dropped.
--
-- Applied: staging and development 2026-10-22 (Claude Code). Replay: scripts/replay/public-bucket-listing-replay.mjs.
-- Rollback: drop policy "Owner lists own public media" on storage.objects; then
--   create policy "Public read reels bucket" on storage.objects for select using (bucket_id = 'reels');
--   create policy "Public read game highlights" on storage.objects for select using (bucket_id = 'game_highlights');
--   create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Public read reels bucket" on storage.objects;
drop policy if exists "Public read game highlights" on storage.objects;
drop policy if exists "Public read avatars" on storage.objects;
drop policy if exists "Public Read Reels" on storage.objects;
drop policy if exists "Public Access Highlights" on storage.objects;
drop policy if exists "Public Read Avatars" on storage.objects;

drop policy if exists "Owner lists own public media" on storage.objects;
create policy "Owner lists own public media" on storage.objects for select to authenticated
  using (
    bucket_id in ('reels', 'game_highlights', 'avatars')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or ((storage.foldername(name))[1] in ('reels', 'sponsors') and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );
