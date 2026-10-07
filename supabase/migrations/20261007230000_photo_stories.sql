-- Photo stories in Highlights ⚡ (WORK_QUEUE UX-05, schema slice; QA fixes UX-05a).
-- Purpose: a Highlight can be one photo or a swipeable story of up to 10 photos instead of a clip.
--   reels.media_type ('video' | 'photo_story') and reels.photo_count describe the post; the photos
--   live in public.reel_photos as Storage object PATHS in the public `reels` bucket (never URLs —
--   the client builds the URL with supabase.storage.from('reels').getPublicUrl(path)). Photos are
--   written only through set_reel_photos, once per story, so count, order, ownership and path are
--   checked in the database. The reel row itself is inserted exactly like a video (same insert
--   policy, triggers, rights attestation and tag status); a photo story stores video_url = ''.
--   A story is public only (constraint reels_photo_story_public_check) and is "unpublished" until
--   its photos are saved (media_type = 'photo_story' and photo_count = 0): the pending-tag queue
--   and filmer rewards skip it. Spotlight features videos only for now.
--   Fans read photos through reel_photos_feed, which gates image_path with the same rule reels_feed
--   uses for video_url. reels_feed gains media_type, photo_count and cover_path (position-0 photo,
--   same gate), appended after the existing columns. The public `reels` Storage bucket also
--   accepts image/jpeg so the photos can be uploaded.
-- Design: docs/engineering/design/PHOTO_STORIES_DESIGN.md ("Data model").
-- Depends on: public.reels (is_removed, is_vault_only, is_exclusive, flash_unlock_until,
--   uploaded_by, tag_*, view_count from supabase/leaderboards.sql), public.profiles,
--   public.players, public.subscriptions, public.spotlight_awards, public.current_user_role(),
--   public.can_confirm_player_tag(), public.athlete_is_varsity_verified(),
--   public.spotlight_window(), public.spotlight_normalize_kind(), public.sync_live_spotlight_awards(),
--   public.reel_filmer_profile_id() / award_filmer_aura() (20260929170000_filmer_rewards.sql),
--   storage.buckets row 'reels', and reels_feed as last defined by
--   20260929160000_reel_views_and_filmer_credit.sql (re-stated below with three columns appended).
-- Status: written 2026-10-07, not applied anywhere, never parsed by Postgres.
--
-- Re-stated functions (each copied from its current, only definition in
-- apps/mobile/src/backend/db/schema.sql, with the photo-story filter as the only change; signatures,
-- return types and grants are unchanged, so create or replace keeps the existing ACLs):
--   get_pending_player_tags()             schema.sql line 1759 — skips unpublished stories.
--   get_spotlight_standings(text)         schema.sql line 1816 — videos only (hype total + clip picks).
--   get_active_spotlight_award(uuid)      schema.sql line 2365 — ignores a story as the award clip.
--   publish_spotlight_award(uuid, text, text, date, date)
--                                         schema.sql line 2544 — picks a video as the award clip.
--   reels_filmer_rewards() trigger fn     schema.sql line 8905 — no Aura for an unpublished story.
--   (sync_spotlight_period reads get_spotlight_standings, so it needs no change.)
--
-- Rollback (in this order — reels_feed references reel_photos and the new columns):
--   drop view if exists public.reel_photos_feed;
--   drop view if exists public.reels_feed;
--   -- re-create reels_feed from the 20260929160000_reel_views_and_filmer_credit.sql definition
--   -- (schema.sql line 8692; create or replace cannot remove columns), then:
--   -- grant select on public.reels_feed to anon, authenticated;
--   -- re-create from the previous definitions: get_pending_player_tags (schema.sql line 1759),
--   -- get_spotlight_standings (line 1816), get_active_spotlight_award (line 2365),
--   -- publish_spotlight_award (line 2544), reels_filmer_rewards (line 8905) — create or replace
--   -- is enough; the filters below reference media_type / photo_count, so do this before
--   -- dropping the columns.
--   drop function if exists public.set_reel_photos(uuid, jsonb);
--   drop table if exists public.reel_photos;
--   drop trigger if exists reels_reset_photo_count on public.reels;
--   drop function if exists public.reels_reset_photo_count();
--   alter table public.reels drop constraint if exists reels_photo_story_public_check;
--   alter table public.reels drop constraint if exists reels_photo_count_check;
--   alter table public.reels drop constraint if exists reels_media_type_check;
--   alter table public.reels drop column if exists photo_count;
--   alter table public.reels drop column if exists media_type;
--   update storage.buckets set allowed_mime_types = array_remove(allowed_mime_types, 'image/jpeg')
--     where id = 'reels';
begin;

-- 1. What kind of Highlight a reel is. Existing rows default to video, so nothing else changes.
alter table public.reels add column if not exists media_type text not null default 'video';
alter table public.reels add column if not exists photo_count smallint not null default 0;

alter table public.reels drop constraint if exists reels_media_type_check;
alter table public.reels
  add constraint reels_media_type_check check (media_type in ('video', 'photo_story'));

alter table public.reels drop constraint if exists reels_photo_count_check;
alter table public.reels
  add constraint reels_photo_count_check check (photo_count between 0 and 10);

-- Photo stories are public only in v1 (design decision 1; paid photos wait for the private Vault
-- bucket). Enforced on the row, so toggle_reel_vault_status and the client column UPDATE grant on
-- is_vault_only / is_exclusive both fail for a story instead of relying on the hidden toggle.
alter table public.reels drop constraint if exists reels_photo_story_public_check;
alter table public.reels
  add constraint reels_photo_story_public_check check (
    coalesce(media_type, 'video') <> 'photo_story'
    or (not coalesce(is_vault_only, false) and not coalesce(is_exclusive, false))
  );

-- media_type and photo_count are deliberately NOT added to the reels column UPDATE grant: a
-- published video cannot become a story, and only set_reel_photos moves the count. The table-wide
-- INSERT grant would still let a client insert a fake count, so this trigger zeroes it on every
-- insert. set_reel_photos sets the real count afterwards with an UPDATE, which this trigger ignores.
create or replace function public.reels_reset_photo_count()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.photo_count := 0;
  return NEW;
end;
$$;

drop trigger if exists reels_reset_photo_count on public.reels;
create trigger reels_reset_photo_count
  before insert on public.reels
  for each row
  execute procedure public.reels_reset_photo_count();

-- 2. The photos of a story, in order (position 0 = cover). image_path is the object path inside
-- the `reels` bucket ({uid}/stories/{reel_id}/{position}-{ms}.jpg), not a URL, so the database
-- never stores or trusts a host.
create table if not exists public.reel_photos (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  image_path text not null check (char_length(image_path) between 1 and 300),
  description text check (description is null or char_length(description) <= 200),
  width integer, height integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (reel_id, position)
);

alter table public.reel_photos enable row level security;

-- Who may read the base table: the story's uploader (reading back their own rows) and admins.
-- Mirrors "Read own or admin reels"; fans and guests read reel_photos_feed instead.
drop policy if exists "Read own or admin reel photos" on public.reel_photos;
create policy "Read own or admin reel photos" on public.reel_photos
  for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    or exists (
      select 1 from public.reels r
      where r.id = reel_photos.reel_id
        and r.uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
    )
  );

-- No client insert/update/delete: Supabase's default privileges would otherwise grant them.
revoke all on table public.reel_photos from public, anon, authenticated;
grant select on table public.reel_photos to authenticated;

-- 3. The only writer. Callable by a signed-in uploader for their own, not-removed photo story,
-- ONCE: v1 has no edit screen, so a story whose photo_count is already set is refused. A failed
-- call rolls back and leaves photo_count at 0, so the client can retry until one call succeeds.
-- Saves the list in array order (position 0..n-1), sets reels.photo_count and returns the count.
create or replace function public.set_reel_photos(p_reel_id uuid, p_photos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  story public.reels%rowtype;
  path_pattern text;
  photo_total integer;
  item jsonb;
  item_ordinal bigint;
  next_path text;
  next_description text;
  next_width integer;
  next_height integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in before adding photos' using errcode = '42501';
  end if;
  if p_reel_id is null then
    raise exception 'Pick a photo story first' using errcode = '22023';
  end if;
  select p.id into actor from public.profiles p where p.user_id = auth.uid() limit 1;
  if actor is null then
    raise exception 'An account is required to add photos' using errcode = '42501';
  end if;

  -- Lock the owned reel: two saves of the same story cannot both pass the publish-once check.
  select r.* into story
  from public.reels r
  where r.id = p_reel_id and r.uploaded_by = actor
  for update;
  if not found then
    raise exception 'Only the uploader may change this photo story' using errcode = '42501';
  end if;
  if story.media_type is distinct from 'photo_story' then
    raise exception 'This Highlight is not a photo story' using errcode = '22023';
  end if;
  if coalesce(story.is_removed, false) then
    raise exception 'This Highlight was removed' using errcode = '42501';
  end if;
  if coalesce(story.photo_count, 0) <> 0 then
    raise exception 'This photo story is already published' using errcode = '55000';
  end if;

  if p_photos is null or jsonb_typeof(p_photos) <> 'array' then
    raise exception 'Photos must be a list' using errcode = '22023';
  end if;
  photo_total := jsonb_array_length(p_photos);
  if photo_total < 1 or photo_total > 10 then
    raise exception 'A photo story holds 1 to 10 photos' using errcode = '22023';
  end if;

  -- Each photo must be the caller's own upload for THIS story, in the exact layout
  -- MediaUploadService.uploadStoryPhoto writes: {uid}/stories/{reel_id}/{position}-{ms}.jpg.
  -- Anchored at both ends, so no host, '..', '%', query string or other folder can slip in.
  -- uuid text is hex digits and '-', which carry no regex meaning; [.] is a literal dot without
  -- depending on standard_conforming_strings for a backslash escape.
  path_pattern := '^' || auth.uid()::text || '/stories/' || p_reel_id::text
    || '/[0-9]{1,2}-[0-9]{10,16}[.]jpg$';

  -- Rows can only exist here if an older build saved them; the count check above already proved
  -- the story is unpublished. Any exception below aborts the whole call.
  delete from public.reel_photos where reel_id = p_reel_id;

  for item, item_ordinal in
    select e.value, e.ordinality
    from jsonb_array_elements(p_photos) with ordinality as e(value, ordinality)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'Photo % is not valid', item_ordinal using errcode = '22023';
    end if;

    if jsonb_typeof(item -> 'image_path') is distinct from 'string' then
      raise exception 'Photo % has no image', item_ordinal using errcode = '22023';
    end if;
    next_path := item ->> 'image_path';
    if char_length(next_path) not between 1 and 300 or next_path !~ path_pattern then
      raise exception 'Photo % must be uploaded from your account for this story', item_ordinal
        using errcode = '42501';
    end if;

    next_description := null;
    if item ? 'description' and jsonb_typeof(item -> 'description') <> 'null' then
      if jsonb_typeof(item -> 'description') <> 'string' then
        raise exception 'Photo % description must be text', item_ordinal using errcode = '22023';
      end if;
      next_description := nullif(btrim(item ->> 'description'), '');
      if next_description is not null and char_length(next_description) > 200 then
        raise exception 'Photo % description is over 200 characters', item_ordinal
          using errcode = '22023';
      end if;
    end if;

    -- Dimensions are layout hints from the picker: whole pixels, rounded if a platform sends a
    -- fraction; anything else is rejected rather than stored as a misleading size.
    next_width := null;
    if item ? 'width' and jsonb_typeof(item -> 'width') <> 'null' then
      if jsonb_typeof(item -> 'width') <> 'number' then
        raise exception 'Photo % width is not valid', item_ordinal using errcode = '22023';
      end if;
      if (item ->> 'width')::numeric not between 1 and 100000 then
        raise exception 'Photo % width is not valid', item_ordinal using errcode = '22023';
      end if;
      next_width := round((item ->> 'width')::numeric)::integer;
    end if;

    next_height := null;
    if item ? 'height' and jsonb_typeof(item -> 'height') <> 'null' then
      if jsonb_typeof(item -> 'height') <> 'number' then
        raise exception 'Photo % height is not valid', item_ordinal using errcode = '22023';
      end if;
      if (item ->> 'height')::numeric not between 1 and 100000 then
        raise exception 'Photo % height is not valid', item_ordinal using errcode = '22023';
      end if;
      next_height := round((item ->> 'height')::numeric)::integer;
    end if;

    insert into public.reel_photos (reel_id, position, image_path, description, width, height)
    values (p_reel_id, (item_ordinal - 1)::smallint, next_path, next_description, next_width, next_height);
  end loop;

  update public.reels set photo_count = photo_total where id = p_reel_id;

  return photo_total;
end;
$$;

revoke all on function public.set_reel_photos(uuid, jsonb) from public, anon;
grant execute on function public.set_reel_photos(uuid, jsonb) to authenticated;

-- 4. Fan-facing read path for story photos (guests included). image_path uses the exact
-- entitlement rule reels_feed applies to video_url (unlocked / Flash-Unlocked now / admin /
-- uploader / active subscriber), returning '' otherwise. Removed Highlights are excluded.
-- Not security_invoker, so it reads the base tables as the view owner, like reels_feed.
create or replace view public.reel_photos_feed as
select
  ph.id,
  ph.reel_id,
  ph.position,
  ph.description,
  ph.width,
  ph.height,
  case
    when coalesce(r.is_vault_only, false) = false then ph.image_path
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
    when public.current_user_role() = 'admin' then ph.image_path
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then ph.image_path
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then ph.image_path
    else ''
  end as image_path
from public.reel_photos ph
join public.reels r on r.id = ph.reel_id
where coalesce(r.is_removed, false) = false;

-- Read-only: drop the default view privileges before granting select.
revoke all on public.reel_photos_feed from public, anon, authenticated;
grant select on public.reel_photos_feed to anon, authenticated;

-- 5. reels_feed: the 20260929160000 definition unchanged and in order, plus media_type,
-- photo_count and cover_path appended (create or replace can only add columns at the end).
-- cover_path is the position-0 photo's Storage path behind the same gate as video_url; null for
-- videos and for a story whose photos are not saved yet.
create or replace view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url,
  coalesce(r.view_count, 0) as view_count,
  -- Handle first, else first name only: the clip credit never shows a fan's full name.
  -- Null when the tagged athlete posted it themself (no "Filmed by" on your own clip).
  case
    when r.player_id is not null and up.player_id = r.player_id then null
    else coalesce(
      nullif(btrim(up.username), ''),
      nullif(split_part(btrim(coalesce(up.full_name, '')), ' ', 1), '')
    )
  end as uploader_name,
  up.avatar_url as uploader_avatar_url,
  r.media_type,
  r.photo_count,
  (
    select case
      when coalesce(r.is_vault_only, false) = false then ph.image_path
      when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then ph.image_path
      when public.current_user_role() = 'admin' then ph.image_path
      when auth.uid() is not null and r.uploaded_by = (
        select p.id from public.profiles p where p.user_id = auth.uid() limit 1
      ) then ph.image_path
      when auth.uid() is not null and r.player_id is not null and exists (
        select 1 from public.subscriptions s
        where s.subscriber_id = auth.uid()
          and s.athlete_id = r.player_id
          and s.status = 'active'
      ) then ph.image_path
      else ''
    end
    from public.reel_photos ph
    where ph.reel_id = r.id and ph.position = 0
  ) as cover_path
from public.reels r
left join public.profiles up on up.id = r.uploaded_by;

grant select on public.reels_feed to anon, authenticated;

-- 6. Storage: story photos upload to the public `reels` bucket as JPEG
-- ({uid}/stories/{reel_id}/{position}-{ms}.jpg, MediaUploadService.uploadStoryPhoto), but that
-- bucket's allow-list was video-only, so Storage would refuse every photo. Add image/jpeg only
-- (the client re-encodes every photo to JPEG and strips its metadata first) and keep the video
-- types. A null allow-list already accepts everything, so it is left alone.
update storage.buckets
set allowed_mime_types = allowed_mime_types || array['image/jpeg']
where id = 'reels'
  and allowed_mime_types is not null
  and not ('image/jpeg' = any (allowed_mime_types));

-- 7. Unpublished stories stay out of the tag-confirmation queue (an athlete would be asked to
-- confirm a post with no photos). Re-stated from schema.sql line 1759; only the filter is new.
create or replace function public.get_pending_player_tags()
returns table (
  id uuid,
  title text,
  video_url text,
  player_id uuid,
  player_name text,
  school_name text,
  created_at timestamptz,
  seki_count integer,
  aura_count integer,
  flex_count integer,
  uploader_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_name text := public.current_user_role();
begin
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  return query
  select
    r.id,
    r.title,
    r.video_url,
    r.player_id,
    p.name,
    p.school_name,
    r.created_at,
    coalesce(r.seki_count, 0),
    coalesce(r.aura_count, 0),
    coalesce(r.flex_count, 0),
    coalesce(nullif(btrim(uploader.full_name), ''), nullif(btrim(uploader.username), ''))
  from public.reels r
  join public.players p on p.id = r.player_id
  left join public.profiles uploader on uploader.id = r.uploaded_by
  where r.tag_status = 'pending'
    and coalesce(r.is_removed, false) = false
    and not (coalesce(r.media_type, 'video') = 'photo_story' and coalesce(r.photo_count, 0) = 0)
    and (
      -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass alongside
      -- `can_confirm_player_tag`'s matching fix, above.
      role_name = 'admin'
      or public.can_confirm_player_tag(r.player_id)
    )
  order by r.created_at desc
  limit 40;
end;
$$;

-- 8. Spotlight features videos only for now: a story neither adds to the weekly hype total nor
-- becomes the award clip. Re-stated from schema.sql line 1816; only the media_type filters are new.
create or replace function public.get_spotlight_standings(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  leaders jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  select coalesce(jsonb_agg(ranked.row_data order by ranked.hype desc, ranked.created_at desc), '[]'::jsonb)
    into leaders
  from (
    select
      jsonb_build_object(
        'rank', row_number() over (order by scored.hype desc, scored.created_at desc),
        'player_id', scored.player_id,
        'name', scored.player_name,
        'school_name', scored.school_name,
        'hype', scored.hype,
        'seki', scored.seki,
        'aura', scored.aura,
        'flex', scored.flex,
        'reel_id', scored.reel_id,
        'title', scored.clip_title,
        'shot_by', scored.shot_by
      ) as row_data,
      scored.hype,
      scored.created_at
    from (
      select
        p.id as player_id,
        p.name as player_name,
        p.school_name,
        sum(coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0))::int as hype,
        sum(coalesce(r.seki_count, 0))::int as seki,
        sum(coalesce(r.aura_count, 0))::int as aura,
        sum(coalesce(r.flex_count, 0))::int as flex,
        (
          select hot.id
          from public.reels hot
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as reel_id,
        (
          select hot.title
          from public.reels hot
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as clip_title,
        (
          select coalesce(nullif(btrim(pr.username), ''), nullif(btrim(pr.full_name), ''))
          from public.reels hot
          left join public.profiles pr on pr.id = hot.uploaded_by
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and hot.created_at::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as shot_by,
        max(r.created_at) as created_at
      from public.reels r
      join public.players p on p.id = r.player_id
      where r.tag_status = 'confirmed'
        and public.athlete_is_varsity_verified(p.id)
        and coalesce(r.is_removed, false) = false
        and coalesce(r.is_vault_only, false) = false
        and coalesce(r.is_flagged, false) = false
        and coalesce(r.category, 'game_play') = 'game_play'
        and coalesce(r.media_type, 'video') = 'video'
        and r.created_at::date between bounds.window_start and bounds.window_end
      group by p.id, p.name, p.school_name
      having sum(coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) > 0
    ) scored
  ) ranked;

  return jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'leaders', coalesce(leaders, '[]'::jsonb)
  );
end;
$$;

-- 9. Award card clip: ignore a stored photo-story clip and fall back to the athlete's top video.
-- Re-stated from schema.sql line 2365; only the media_type guard and filter are new.
create or replace function public.get_active_spotlight_award(viewer_user_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  award_id uuid;
  award_athlete uuid;
  award_player uuid;
  award_kind text;
  award_headline text;
  award_reel uuid;
  award_start date;
  award_region text;
  award_school uuid;
  school_label text;
  profile_name text;
  athlete public.players%rowtype;
  clip_id uuid;
  clip_url text;
  clip_uploader text;
  period_kind text;
  period_title text;
begin
  perform viewer_user_id;
  perform public.sync_live_spotlight_awards();

  select
    a.id,
    a.athlete_id,
    a.player_id,
    a.award_type,
    a.headline,
    a.highlight_reel_id,
    a.start_date,
    a.district_region,
    a.school_id
  into
    award_id,
    award_athlete,
    award_player,
    award_kind,
    award_headline,
    award_reel,
    award_start,
    award_region,
    award_school
  from public.spotlight_awards a
  where timezone('utc', now())::date between a.start_date and a.end_date
  order by
    case
      when lower(a.award_type) in ('week', 'player_of_the_week') then 0
      when lower(a.award_type) in ('month', 'player_of_the_month') then 1
      else 2
    end,
    a.created_at desc
  limit 1;

  if award_id is null then
    return null;
  end if;

  period_kind := public.spotlight_normalize_kind(award_kind);
  period_title := case
    when period_kind = 'year' then 'Player of the Year'
    when period_kind = 'month' then 'Player of the Month'
    else 'Player of the Week'
  end;

  if award_school is not null then
    select s.name into school_label from public.schools_and_teams s where s.id = award_school;
  end if;

  if award_player is not null then
    select * into athlete from public.players p where p.id = award_player;
  end if;

  if athlete.id is null and award_athlete is not null then
    select pr.full_name, pr.player_id into profile_name, award_player
    from public.profiles pr where pr.id = award_athlete;
    if award_player is not null then
      select * into athlete from public.players p where p.id = award_player;
    end if;
    if athlete.id is null then
      select * into athlete from public.players p where p.id = award_athlete;
    end if;
  end if;

  if athlete.id is null and profile_name is not null then
    select * into athlete
    from public.players p
    where lower(p.name) = lower(profile_name)
    limit 1;
  end if;

  clip_id := award_reel;
  if clip_id is not null and exists (
    select 1 from public.reels r where r.id = clip_id and coalesce(r.media_type, 'video') <> 'video'
  ) then
    clip_id := null;
  end if;
  if clip_id is not null then
    select r.video_url into clip_url from public.reels r where r.id = clip_id;
    select coalesce(nullif(btrim(pr.username), ''), nullif(btrim(pr.full_name), ''))
      into clip_uploader
    from public.reels r
    left join public.profiles pr on pr.id = r.uploaded_by
    where r.id = clip_id
      and r.uploaded_by is not null
      and (athlete.id is null or r.uploaded_by is distinct from (
        select pr2.id from public.profiles pr2 where pr2.player_id = athlete.id limit 1
      ))
      and lower(coalesce(pr.full_name, '')) is distinct from lower(coalesce(athlete.name, ''));
  end if;

  if clip_url is null and athlete.id is not null then
    select r.id, r.video_url
      into clip_id, clip_url
    from public.reels r
    where r.player_id = athlete.id
      and r.tag_status = 'confirmed'
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_removed, false) = false
      and coalesce(r.media_type, 'video') = 'video'
    order by (coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) desc,
      r.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'id', award_id,
    'player_id', athlete.id,
    'reel_id', clip_id,
    'period_kind', period_kind,
    'period_start', award_start,
    'school_name', coalesce(nullif(trim(school_label), ''), nullif(trim(award_region), ''), athlete.school_name, 'Westlake High'),
    'headline', coalesce(nullif(trim(award_headline), ''), '4 Touchdowns & 12 Tackles'),
    'title', period_title,
    'is_active', true,
    'video_url', clip_url,
    'shot_by', clip_uploader,
    'player', case when athlete.id is null then null else to_jsonb(athlete) end
  );
end;
$$;

-- 10. Admin-published award picks the athlete's top video, never a story.
-- Re-stated from schema.sql line 2544; only the media_type filter is new.
create or replace function public.publish_spotlight_award(
  target_player_id uuid,
  award_headline text,
  period_kind text,
  window_start date,
  window_end date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  headline text := btrim(coalesce(award_headline, ''));
  athlete public.players%rowtype;
  linked uuid;
  clip uuid;
  award_id uuid;
begin
  -- 2026-09 audit: dropped the `auth.role() <> 'anon'` bypass — this is an admin-only Spotlight
  -- desk action (`/admin/spotlight`), not part of the anon operator-PIN sideline flow.
  if public.current_user_role() <> 'admin' then
    raise exception 'Access restricted';
  end if;
  if kind not in ('week', 'month', 'year') then
    raise exception 'Unknown period_kind %', period_kind;
  end if;
  if headline = '' then
    raise exception 'Headline required';
  end if;
  if window_start is null or window_end is null or window_end < window_start then
    raise exception 'Valid start and end dates required';
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    raise exception 'Athlete not found.';
  end if;

  select pr.id into linked
  from public.profiles pr
  where pr.player_id = target_player_id
     or pr.id = target_player_id
     or lower(pr.full_name) = lower(athlete.name)
  order by case when pr.player_id = target_player_id then 0 when pr.id = target_player_id then 1 else 2 end
  limit 1;

  select r.id into clip
  from public.reels r
  where r.player_id = athlete.id
    and r.tag_status = 'confirmed'
    and coalesce(r.is_removed, false) = false
    and coalesce(r.is_vault_only, false) = false
    and coalesce(r.media_type, 'video') = 'video'
  order by (coalesce(r.seki_count, 0) + coalesce(r.aura_count, 0) + coalesce(r.flex_count, 0)) desc,
    r.created_at desc
  limit 1;

  update public.spotlight_awards
  set
    athlete_id = linked,
    player_id = athlete.id,
    award_type = kind,
    level = 'platform',
    district_region = athlete.school_name,
    headline = headline,
    highlight_reel_id = clip,
    start_date = window_start,
    end_date = window_end,
    source = 'manual',
    locked = true
  where award_type = kind
    and start_date = window_start
  returning id into award_id;

  if award_id is null then
    insert into public.spotlight_awards (
      athlete_id, player_id, award_type, level, district_region, headline,
      highlight_reel_id, start_date, end_date, source, locked
    )
    values (
      linked, athlete.id, kind, 'platform', athlete.school_name, headline,
      clip, window_start, window_end, 'manual', true
    )
    returning id into award_id;
  end if;

  return jsonb_build_object(
    'id', award_id,
    'athlete_id', linked,
    'player_id', athlete.id,
    'headline', headline,
    'highlight_reel_id', clip,
    'start_date', window_start,
    'end_date', window_end,
    'award_type', kind,
    'source', 'manual',
    'locked', true
  );
end;
$$;

-- 11. Filmer rewards: no Aura for a story until its photos are saved. Re-stated from schema.sql
-- line 8905; only the unpublished-story guard is new. (The trigger fires on tag_status /
-- view_count updates, so a story confirmed before publishing earns on its next counted view.)
create or replace function public.reels_filmer_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  filmer uuid;
  milestone record;
begin
  if new.tag_status is distinct from 'confirmed'
    or new.uploaded_by is null
    or coalesce(new.is_removed, false)
    or (coalesce(new.media_type, 'video') = 'photo_story' and coalesce(new.photo_count, 0) = 0)
  then
    return new;
  end if;
  filmer := public.reel_filmer_profile_id(new.id);
  if filmer is null then
    return new;
  end if;

  perform public.award_filmer_aura(filmer, new.id, 'tag_confirmed', 'tag:' || new.id, 10);

  for milestone in
    select * from (values (100, 10), (1000, 50), (10000, 200)) as m (views, points)
  loop
    if coalesce(new.view_count, 0) >= milestone.views then
      perform public.award_filmer_aura(
        filmer, new.id, 'views_milestone', 'views:' || milestone.views || ':' || new.id, milestone.points
      );
    end if;
  end loop;

  return new;
end;
$$;

commit;
