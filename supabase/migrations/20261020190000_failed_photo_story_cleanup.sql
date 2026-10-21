-- Retire failed photo-story drafts without deleting published media or Storage metadata directly.
-- Existing-upload repair: docs/engineering/design/PHOTO_STORIES_DESIGN.md (Privacy and safety).
-- Requires photo stories (20261007230000), owner folders (20261007231000), and minor-account guards.
-- Written locally, not applied. Rollback requires pausing photo uploads first: remove the two
-- triggers, cleanup policy/functions and constraint/column below. Do not clear a pending marker
-- while uploads run: a stale request could publish references to objects already deleted.
begin;

alter table public.reels add column if not exists photo_cleanup_pending boolean not null default false;
-- The existing set_reel_photos writer locks this row before publishing. This constraint makes
-- publication fail atomically after cleanup won that lock, without replacing applied SQL.
alter table public.reels drop constraint if exists reels_photo_cleanup_pending_check;
alter table public.reels add constraint reels_photo_cleanup_pending_check
  check (not photo_cleanup_pending or (media_type = 'photo_story' and photo_count = 0));
revoke update (photo_cleanup_pending) on public.reels from public, anon, authenticated, service_role;

create or replace function public.guard_failed_photo_story_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    -- INSERT is table-granted to uploaders: no caller may pre-claim a new draft for deletion.
    NEW.photo_cleanup_pending := false;
  elsif OLD.photo_cleanup_pending and not NEW.photo_cleanup_pending then
    raise exception 'A retired photo story cannot be reopened' using errcode = '55000';
  end if;
  return NEW;
end;
$$;
revoke all on function public.guard_failed_photo_story_state() from public, anon, authenticated, service_role;
drop trigger if exists guard_failed_photo_story_state on public.reels;
create trigger guard_failed_photo_story_state before insert or update on public.reels
  for each row execute function public.guard_failed_photo_story_state();

create or replace function public.begin_failed_photo_story_cleanup(p_reel_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  story public.reels%rowtype;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated'
     or not public.caller_not_age_blocked() then
    raise exception 'An active signed-in account is required' using errcode = '42501';
  end if;
  if p_reel_id is null then
    raise exception 'Pick a photo story first' using errcode = '22023';
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then
    raise exception 'An account is required' using errcode = '42501';
  end if;
  select r.* into story from public.reels r where r.id = p_reel_id for update;
  if not found then return pg_catalog.jsonb_build_object('status', 'discarded'); end if;
  if story.uploaded_by is distinct from actor then
    raise exception 'Only the uploader may discard this photo story' using errcode = '42501';
  end if;
  if story.media_type is distinct from 'photo_story' then
    raise exception 'This Highlight is not a photo story' using errcode = '22023';
  end if;
  if story.photo_count <> 0 then
    if coalesce(story.is_removed, false) then
      raise exception 'This photo story was removed' using errcode = '42501';
    end if;
    -- A lost publish response must never turn a successful story into a failed draft.
    return pg_catalog.jsonb_build_object('status', 'published');
  end if;
  update public.reels set photo_cleanup_pending = true where id = p_reel_id;
  return pg_catalog.jsonb_build_object('status', 'pending',
    'prefix', auth.uid()::text || '/stories/' || p_reel_id::text || '/');
end;
$$;
revoke all on function public.begin_failed_photo_story_cleanup(uuid) from public, anon, authenticated, service_role;
grant execute on function public.begin_failed_photo_story_cleanup(uuid) to authenticated;

create or replace function public.finish_failed_photo_story_cleanup(p_reel_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  story public.reels%rowtype;
  story_prefix text;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated'
     or not public.caller_not_age_blocked() then
    raise exception 'An active signed-in account is required' using errcode = '42501';
  end if;
  if p_reel_id is null then
    raise exception 'Pick a photo story first' using errcode = '22023';
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then raise exception 'An account is required' using errcode = '42501'; end if;
  select r.* into story from public.reels r where r.id = p_reel_id for update;
  if not found then return pg_catalog.jsonb_build_object('status', 'discarded'); end if;
  if story.uploaded_by is distinct from actor then
    raise exception 'Only the uploader may discard this photo story' using errcode = '42501';
  end if;
  if story.media_type is distinct from 'photo_story' or story.photo_count <> 0
     or not story.photo_cleanup_pending then
    raise exception 'This photo story is not awaiting cleanup' using errcode = '55000';
  end if;
  story_prefix := auth.uid()::text || '/stories/' || p_reel_id::text || '/';
  -- Use the Storage API for object deletion. Physical-byte/CDN deletion requires hosted
  -- verification; SQL only observes metadata. An unexpected old filename also blocks finish.
  if exists (select 1 from storage.objects o where o.bucket_id = 'reels'
    and pg_catalog.left(o.name, pg_catalog.length(story_prefix)) = story_prefix) then
    raise exception 'Photo story files still require cleanup' using errcode = '55000';
  end if;
  delete from public.reels where id = p_reel_id;
  return pg_catalog.jsonb_build_object('status', 'discarded');
end;
$$;
revoke all on function public.finish_failed_photo_story_cleanup(uuid) from public, anon, authenticated, service_role;
grant execute on function public.finish_failed_photo_story_cleanup(uuid) to authenticated;

-- A policy helper sees the claimed row through its owner's RLS, never through admin scope.
-- FOR SHARE serializes a Storage deletion with finish's row lock until metadata removal commits.
create or replace function public.can_delete_failed_photo_story_object(p_bucket text, p_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  story public.reels%rowtype;
  reel_text text;
  story_prefix text;
begin
  if p_bucket is distinct from 'reels' or auth.uid() is null
     or auth.role() is distinct from 'authenticated' or not public.caller_not_age_blocked() then
    return false;
  end if;
  reel_text := pg_catalog.split_part(p_name, '/', 3);
  if reel_text is null or reel_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  story_prefix := auth.uid()::text || '/stories/' || reel_text || '/';
  if pg_catalog.left(p_name, pg_catalog.length(story_prefix)) is distinct from story_prefix then
    return false;
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then return false; end if;
  select r.* into story from public.reels r where r.id = reel_text::uuid for share;
  return found and story.uploaded_by = actor and story.media_type = 'photo_story'
    and story.photo_count = 0 and story.photo_cleanup_pending;
end;
$$;
revoke all on function public.can_delete_failed_photo_story_object(text, text) from public, anon, authenticated, service_role;
grant execute on function public.can_delete_failed_photo_story_object(text, text) to authenticated;
drop policy if exists "Delete claimed failed photo story objects" on storage.objects;
create policy "Delete claimed failed photo story objects" on storage.objects for delete to authenticated
  using (public.can_delete_failed_photo_story_object(bucket_id, name));
-- Existing restrictive Closed accounts policy and other buckets' policies remain in force.

create or replace function public.guard_photo_story_storage_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  candidate storage.objects%rowtype;
  actor uuid;
  story public.reels%rowtype;
  path_pattern text;
  check_old boolean := false;
begin
  if TG_OP = 'UPDATE' then
    -- Storage may record an access/update timestamp when serving an existing object. That
    -- bookkeeping changes no bytes, ownership or path and must work for published stories.
    -- Compare every other column, including future version/content fields, before allowing it.
    if (pg_catalog.to_jsonb(NEW) - array['updated_at', 'last_accessed_at']::text[])
       is not distinct from
       (pg_catalog.to_jsonb(OLD) - array['updated_at', 'last_accessed_at']::text[]) then
      return NEW;
    end if;
  end if;
  -- Check OLD too: an UPDATE must not move a retired/live story object into a video folder.
  -- Non-story names and buckets keep their existing Storage policy behavior.
  if TG_OP = 'UPDATE' then check_old := true; end if;
  loop
    if check_old then candidate := OLD; else candidate := NEW; end if;
    if candidate.bucket_id = 'reels' and pg_catalog.split_part(candidate.name, '/', 2) = 'stories' then
      if auth.uid() is null or auth.role() is distinct from 'authenticated'
         or not public.caller_not_age_blocked() then
        raise exception 'An active signed-in uploader is required for story photos' using errcode = '42501';
      end if;
      path_pattern := '^' || auth.uid()::text || '/stories/'
        || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        || '/[0-9]{1,2}-[0-9]{10,16}[.]jpg$';
      if candidate.name !~ path_pattern then
        raise exception 'This is not an owned story photo path' using errcode = '42501';
      end if;
      select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
      -- Hold the parent lock until the upload metadata transaction commits. Cleanup waits
      -- for an already-running upload; later uploads wait and then see the terminal marker.
      select r.* into story from public.reels r
        where r.id = pg_catalog.split_part(candidate.name, '/', 3)::uuid for share;
      if not found or actor is null or story.uploaded_by is distinct from actor
         or story.media_type is distinct from 'photo_story' or story.photo_count <> 0
         or story.photo_cleanup_pending or coalesce(story.is_removed, false) then
        raise exception 'This photo story no longer accepts uploads' using errcode = '42501';
      end if;
    end if;
    exit when not check_old;
    check_old := false;
  end loop;
  return NEW;
end;
$$;
revoke all on function public.guard_photo_story_storage_write() from public, anon, authenticated, service_role;
drop trigger if exists guard_photo_story_storage_write on storage.objects;
create trigger guard_photo_story_storage_write before insert or update on storage.objects
  for each row execute function public.guard_photo_story_storage_write();
commit;
