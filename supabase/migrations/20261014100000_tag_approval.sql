-- Tag approval — stage 2 of PRIV-01 (2026-10-14).
--
-- Purpose
--   Owner decision 2026-10-13: tags are approved by the person tagged, with a clear difference between approved and not
--   approved, designed so waiting tags do not cost athletes highlights, Spotlight credit or donations. Design panel
--   findings applied (docs/engineering/design/PROFILE_PRIVACY_DESIGN.md §3):
--   1. Decisions move only from pending to confirmed or rejected (admins may undo; undoing an approved tag that already
--      took donations is admin-only). A rejection clears the athlete from the clip and is remembered
--      (reel_tag_rejections): the same athlete cannot be tagged on that clip again, and after three declines that
--      uploader cannot tag that athlete at all. One uploader may have at most five tags of an athlete waiting.
--   2. Tags from someone the athlete blocked are rejected quietly; "Auto-approve tags from friends" approves a friend's tag.
--   3. Once an athlete has a verified account, only they, their guardian or an admin approve their tags (school
--      operators still confirm for athletes with no account).
--   4. reels_feed names a pending tag's athlete only to the uploader, the athlete, their guardian and admins, and a
--      rejected tag names nobody (a stranger's clip must not show a private athlete before they agree).
--   5. Credit is not lost while a tag waits: views and hype already accrue on a pending clip; Spotlight now places a clip
--      in the week its tag was approved, and leaderboards count earlier reactions and views on the approval date.
--
--   Stage 2 review (2026-10-14) applied: clients write only the app's reel columns (an uploader could approve their own
--   tag and set counters); a decline does not reveal who declined, even on the uploader's own reels row; a blocked
--   uploader's tag ends exactly like a decline (re-review: blocking someone with pending tags failed — fixed in
--   block_user; known limit: the quiet decline is immediate); the athlete
--   can remove an approved tag (unless it took donations); admins can undo a rejection; re-confirming keeps the date;
--   school operators are exempt from the pending cap. Follow-up (COMMERCE / CHECKOUT): refuse a donation on a pending
--   clip before charging (create-payment-intent does not receive the clip today; the app already disables Donate).
--
-- Owner: HIGHLIGHTS → ACCOUNT_TAGS, UPLOAD; SPOTLIGHT / LEADERBOARDS for credit; reviews RLS_SECURITY, MINOR_SAFETY.
-- Depends on: 20261014090000_profile_privacy.sql (is_blocked_between, are_friends, profiles.tag_review).
-- Safe to re-run: create table if not exists; create or replace.
-- Applied: written 2026-10-14, not applied anywhere.
-- Rollback: re-run the previous definitions of the five functions and reels_feed from schema.sql history; the
--   rejections table can stay.

create table if not exists public.reel_tag_rejections (
  -- Deferred so the tag trigger can record a block's quiet decline while the clip row is still being inserted.
  reel_id uuid not null references public.reels (id) on delete cascade deferrable initially deferred,
  player_id uuid not null references public.players (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  -- null = declined automatically because of a block (an admin can still undo it)
  rejected_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz not null default timezone('utc', now()),
  primary key (reel_id, player_id)
);
create index if not exists reel_tag_rejections_uploader_idx on public.reel_tag_rejections (player_id, uploader_id);
alter table public.reel_tag_rejections enable row level security;
revoke all on table public.reel_tag_rejections from public, anon, authenticated;

-- Whether the caller is a school operator at this roster athlete's school (same rule as can_confirm_player_tag).
create or replace function public.is_school_operator_for(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players athlete
    join public.profiles pr on pr.user_id = auth.uid()
    join public.schools_and_teams s on s.id = pr.school_id
    where athlete.id = target_player_id
      and (public.current_user_role() = 'operator' or coalesce(pr.roles, array[]::text[]) @> array['operator']::text[])
      and (lower(s.name) = lower(athlete.school_name) or lower(s.name) = lower(coalesce(athlete.team, '')))
  );
$$;

-- Whether the caller is a party to a clip's athlete tag: admin, uploader, the athlete's account or their guardian.
create or replace function public.tag_party(clip_uploaded_by uuid, clip_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_role() = 'admin'
    or (clip_uploaded_by is not null and clip_uploaded_by = public.my_profile_id())
    or (clip_player_id is not null and exists (
      select 1 from public.profiles p where p.player_id = clip_player_id and p.user_id = auth.uid()
    ))
    or (clip_player_id is not null and exists (
      select 1 from public.players pl where pl.id = clip_player_id and pl.guardian_id is not null and pl.guardian_id = public.my_profile_id()
    ));
$$;

create or replace function public.can_confirm_player_tag(target_player_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid;
  role_name text := public.current_user_role();
  athlete public.players%rowtype;
begin
  if target_player_id is null then
    return false;
  end if;
  if role_name = 'admin' then
    return true;
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    return false;
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;
  if actor is null then
    return false;
  end if;

  if athlete.guardian_id is not null and athlete.guardian_id = actor then
    return true;
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = actor and pr.player_id = athlete.id and pr.verification_status = 'verified'
  ) then
    return true;
  end if;

  -- Once an athlete has a verified account, only they, their guardian or an admin approve their tags ("Review every
  -- tag" means it). A school operator still confirms tags for athletes with no account.
  if exists (select 1 from public.profiles vp where vp.player_id = athlete.id and vp.verification_status = 'verified') then
    return false;
  end if;

  if role_name = 'operator'
     or exists (
       select 1 from public.profiles pr
       where pr.id = actor and coalesce(pr.roles, array[]::text[]) @> array['operator']::text[]
     )
  then
    if exists (
      select 1
      from public.profiles pr
      join public.schools_and_teams s on s.id = pr.school_id
      where pr.id = actor
        and (lower(s.name) = lower(athlete.school_name) or lower(s.name) = lower(coalesce(athlete.team, '')))
    ) then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create or replace function public.reels_apply_tag_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  should_set boolean := false;
  account public.profiles%rowtype;
begin
  -- confirm_reel_player_tag sets this while it records a decision (it clears player_id on a rejection).
  if coalesce(current_setting('app.tapuai_tag_write', true), '') = 'on' then
    return NEW;
  end if;
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  if NEW.uploaded_by is null then
    NEW.uploaded_by := actor;
  end if;

  -- Tag status and who approved it change only through confirm_reel_player_tag (or the server / an admin).
  if TG_OP = 'UPDATE'
     and (NEW.tag_status is distinct from OLD.tag_status or NEW.tag_confirmed_at is distinct from OLD.tag_confirmed_at
          or NEW.tag_confirmed_by is distinct from OLD.tag_confirmed_by)
     and NEW.player_id is not distinct from OLD.player_id
     and not public.is_trusted_server() and public.current_user_role() is distinct from 'admin' then
    raise exception 'Tags are approved by the athlete.';
  end if;

  if TG_OP = 'INSERT' then
    should_set := true;
  elsif TG_OP = 'UPDATE' and NEW.player_id is distinct from OLD.player_id then
    NEW.tag_status := 'pending';
    NEW.tag_confirmed_at := null;
    NEW.tag_confirmed_by := null;
    should_set := true;
  end if;

  if not should_set then
    return NEW;
  end if;

  if NEW.player_id is null then
    NEW.tag_status := 'pending';
    return NEW;
  end if;

  select * into account from public.profiles p
  where p.player_id = NEW.player_id
  order by (p.verification_status = 'verified') desc
  limit 1;

  if public.current_user_role() is distinct from 'admin' then
    -- The athlete already declined this clip.
    if exists (select 1 from public.reel_tag_rejections x where x.reel_id = NEW.id and x.player_id = NEW.player_id) then
      raise exception 'This athlete declined being tagged on this clip.';
    end if;
    -- Three declines from this athlete: this uploader can no longer tag them.
    if NEW.uploaded_by is not null and (
      select count(*) from public.reel_tag_rejections x where x.player_id = NEW.player_id and x.uploader_id = NEW.uploaded_by
    ) >= 3 then
      raise exception 'You can''t tag this athlete.';
    end if;
    -- At most five tags of the same athlete waiting on them from one uploader (a school operator uploading the
    -- athlete's games is exempt).
    if NEW.uploaded_by is not null and not public.is_school_operator_for(NEW.player_id) and (
      select count(*) from public.reels q
      where q.uploaded_by = NEW.uploaded_by and q.player_id = NEW.player_id and q.tag_status = 'pending' and q.id <> NEW.id
    ) >= 5 then
      raise exception 'Wait for this athlete to review your earlier tags.';
    end if;
  end if;

  -- A blocked uploader's tag ends exactly like a decline (untagged, nobody named), so neither reels_feed nor their
  -- own reels row tells them about the block (re-review P2). Known limit: it happens at once, not after a delay.
  if account.id is not null and NEW.uploaded_by is not null and public.is_blocked_between(account.id, NEW.uploaded_by) then
    insert into public.reel_tag_rejections (reel_id, player_id, uploader_id, rejected_by)
    values (NEW.id, NEW.player_id, NEW.uploaded_by, null)
    on conflict (reel_id, player_id) do nothing;
    NEW.player_id := null;
    NEW.tag_status := 'rejected';
    NEW.tag_confirmed_at := null;
    NEW.tag_confirmed_by := null;
    return NEW;
  end if;

  -- "Auto-approve tags from friends".
  if account.id is not null and account.tag_review = 'auto_friends' and NEW.uploaded_by is not null
     and public.are_friends(account.id, NEW.uploaded_by) then
    NEW.tag_status := 'confirmed';
    NEW.tag_confirmed_at := timezone('utc', now());
    NEW.tag_confirmed_by := account.id;
    return NEW;
  end if;

  if public.can_confirm_player_tag(NEW.player_id)
     and public.current_user_role() <> 'guest'
     and auth.role() <> 'anon'
  then
    NEW.tag_status := 'confirmed';
    NEW.tag_confirmed_at := timezone('utc', now());
    NEW.tag_confirmed_by := actor;
  else
    NEW.tag_status := 'pending';
    NEW.tag_confirmed_at := null;
    NEW.tag_confirmed_by := null;
  end if;

  return NEW;
end;
$$;

create or replace function public.confirm_reel_player_tag(target_reel_id uuid, tag_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := lower(btrim(coalesce(tag_action, '')));
  clip public.reels%rowtype;
  actor uuid;
  is_admin boolean := public.current_user_role() = 'admin';
begin
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;
  -- An admin re-confirming a rejection restores the athlete from the decline record.
  if clip.player_id is null and is_admin and action = 'confirm' and clip.tag_status = 'rejected' then
    select x.player_id into clip.player_id from public.reel_tag_rejections x
    where x.reel_id = clip.id order by x.rejected_at desc limit 1;
    delete from public.reel_tag_rejections x where x.reel_id = clip.id and x.player_id = clip.player_id;
  end if;
  if clip.player_id is null then
    raise exception 'This clip has no tagged player.';
  end if;
  if not public.can_confirm_player_tag(clip.player_id) then
    raise exception 'Only the athlete, their guardian or an admin can review this tag.';
  end if;
  -- Decisions move only forward from pending; undoing an approved tag that already took donations is an admin call.
  -- The athlete may still remove an approved tag (for example an auto-approved friend's tag); otherwise decisions
  -- move only forward from pending.
  if clip.tag_status <> 'pending' and not is_admin and not (action = 'reject' and clip.tag_status = 'confirmed') then
    raise exception 'This tag was already reviewed.';
  end if;
  if action = 'reject' and clip.tag_status = 'confirmed'
     and exists (select 1 from public.tips t where t.reel_id = clip.id) and not is_admin then
    raise exception 'This tag already has donations; ask an admin.';
  end if;

  select pr.id into actor from public.profiles pr where pr.user_id = auth.uid() limit 1;

  perform set_config('app.tapuai_tag_write', 'on', true);
  if action = 'reject' then
    -- Remember the decline so the same athlete cannot be tagged on this clip again, then untag it.
    insert into public.reel_tag_rejections (reel_id, player_id, uploader_id, rejected_by)
    values (clip.id, clip.player_id, clip.uploaded_by, actor)
    on conflict (reel_id, player_id) do nothing;
    -- Who declined, and when, stays in reel_tag_rejections: the uploader can read their own reels row, and a guardian's
    -- decline must not name the guardian (re-review P2). A quiet rejection looks the same.
    update public.reels
    set tag_status = 'rejected', player_id = null, tag_confirmed_at = null, tag_confirmed_by = null
    where id = target_reel_id
    returning * into clip;
  else
    update public.reels
    set tag_status = 'confirmed', player_id = clip.player_id,
        -- re-confirming an approved tag keeps its date, so the clip does not land in a second Spotlight week
        tag_confirmed_at = case when clip.tag_status = 'confirmed' then clip.tag_confirmed_at else timezone('utc', now()) end,
        tag_confirmed_by = case when clip.tag_status = 'confirmed' then clip.tag_confirmed_by else actor end
    where id = target_reel_id
    returning * into clip;
  end if;
  perform set_config('app.tapuai_tag_write', 'off', true);

  perform public.sync_live_spotlight_awards();

  return jsonb_build_object(
    'id', clip.id,
    'player_id', clip.player_id,
    'tag_status', clip.tag_status,
    'tag_confirmed_at', clip.tag_confirmed_at
  );
end;
$$;

create or replace view public.reels_feed as
select
  r.id,
  r.title,
  -- A pending tag names the athlete only to the uploader, the athlete, their guardian and admins; a rejected tag names
  -- nobody (PRIV-01 stage 2, MINOR_SAFETY): a stranger's clip must not show a private athlete before they agree.
  case
    when r.tag_status = 'rejected' and public.current_user_role() is distinct from 'admin' then null
    when r.tag_status = 'pending' and not public.tag_party(r.uploaded_by, r.player_id) then null
    else r.player_id
  end as player_id,
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
  -- A blocked uploader's quiet rejection and a real decline look the same (see reels_apply_tag_defaults).
  r.tag_status,
  -- Who decided, and when, only on an approved tag (a decline must not reveal the athlete or guardian).
  case when r.tag_status = 'confirmed' or public.current_user_role() = 'admin' then r.tag_confirmed_at else null end as tag_confirmed_at,
  case when r.tag_status = 'confirmed' or public.current_user_role() = 'admin' then r.tag_confirmed_by else null end as tag_confirmed_by,
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
  public.visible_avatar_url(up.id) as uploader_avatar_url,
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
            and coalesce(hot.tag_confirmed_at, hot.created_at)::date between bounds.window_start and bounds.window_end
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
            and coalesce(hot.tag_confirmed_at, hot.created_at)::date between bounds.window_start and bounds.window_end
          order by (coalesce(hot.seki_count, 0) + coalesce(hot.aura_count, 0) + coalesce(hot.flex_count, 0)) desc,
            hot.created_at desc
          limit 1
        ) as clip_title,
        (
          select coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''))
          from public.reels hot
          left join public.profiles pr on pr.id = hot.uploaded_by
          where hot.player_id = p.id
            and hot.tag_status = 'confirmed'
            and coalesce(hot.is_removed, false) = false
            and coalesce(hot.is_vault_only, false) = false
            and coalesce(hot.is_flagged, false) = false
            and coalesce(hot.category, 'game_play') = 'game_play'
            and coalesce(hot.media_type, 'video') = 'video'
            and coalesce(hot.tag_confirmed_at, hot.created_at)::date between bounds.window_start and bounds.window_end
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
        and coalesce(r.tag_confirmed_at, r.created_at)::date between bounds.window_start and bounds.window_end
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

create or replace function public.get_leaderboards(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  board_limit constant integer := 10;
  result jsonb;
begin
  select * into bounds from public.spotlight_window(kind);

  with eligible as (
    select r.id, r.title, r.player_id, r.uploaded_by, r.created_at, r.category,
      coalesce(r.tag_confirmed_at, r.created_at) as counted_at,
      p.name as player_name, coalesce(nullif(btrim(p.school_name), ''), '') as school_name
    from public.reels r
    join public.players p on p.id = r.player_id
    where r.tag_status = 'confirmed'
      and coalesce(r.is_removed, false) = false
      and coalesce(r.is_flagged, false) = false
      and coalesce(r.is_vault_only, false) = false
      and coalesce(r.is_exclusive, false) = false
  ),
  hype as (
    select v.reel_id, v.user_id, v.kind
    from public.reel_hype_votes v
    join eligible e on e.id = v.reel_id
    where greatest(v.created_at, e.counted_at)::date between bounds.window_start and bounds.window_end
  ),
  views as (
    select w.reel_id, w.viewer_id
    from public.reel_views w
    join eligible e on e.id = w.reel_id
    where greatest(w.view_day, e.counted_at::date) between bounds.window_start and bounds.window_end
  ),
  reel_scores as (
    select e.*,
      coalesce((select count(*) from hype h where h.reel_id = e.id), 0)::int as hype,
      coalesce((select count(*) from views w where w.reel_id = e.id), 0)::int as views
    from eligible e
  ),
  player_scores as (
    select rs.player_id, max(rs.player_name) as name, max(rs.school_name) as school_name,
      sum(rs.hype)::int as hype, sum(rs.views)::int as views,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'seki'), 0)::int as seki,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'aura'), 0)::int as aura,
      coalesce((select count(*) from hype h join eligible e on e.id = h.reel_id
        where e.player_id = rs.player_id and h.kind = 'flex'), 0)::int as flex
    from reel_scores rs
    group by rs.player_id
  ),
  school_fans as (
    select e.school_name, h.user_id as fan from hype h join eligible e on e.id = h.reel_id
    union
    select e.school_name, w.viewer_id as fan from views w join eligible e on e.id = w.reel_id
  ),
  school_scores as (
    select rs.school_name,
      sum(rs.hype)::int as hype,
      count(*) filter (where rs.counted_at::date between bounds.window_start and bounds.window_end)::int as highlights,
      coalesce((select count(distinct sf.fan) from school_fans sf where sf.school_name = rs.school_name), 0)::int as fans
    from reel_scores rs
    where rs.school_name <> ''
    group by rs.school_name
  ),
  fan_scores as (
    select pr.id as profile_id,
      coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Fan') as name,
      case when public.profile_item_visible(pr.id, 'photo') then pr.avatar_url else null end as avatar_url,
      coalesce((select count(*) from hype h where h.user_id = pr.user_id), 0)::int as hype_given,
      coalesce((select count(*) from eligible e where e.uploaded_by = pr.id
        and e.counted_at::date between bounds.window_start and bounds.window_end), 0)::int as clips_tagged
    from public.profiles pr
    where (exists (select 1 from hype h where h.user_id = pr.user_id)
      or exists (select 1 from eligible e where e.uploaded_by = pr.id
        and e.counted_at::date between bounds.window_start and bounds.window_end))
      -- hidden-from-search and blocked accounts are left off the fans board
      and (not pr.hide_from_search or public.viewer_relationship(pr.id) in ('self', 'admin', 'guardian', 'friend'))
      and public.viewer_relationship(pr.id) <> 'blocked'
  )
  select jsonb_build_object(
    'period_kind', kind,
    'start_date', bounds.window_start,
    'end_date', bounds.window_end,
    'players_hype', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.hype desc, ps.views desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.hype desc, ps.views desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'hype', ps.hype, 'seki', ps.seki, 'aura', ps.aura, 'flex', ps.flex, 'views', ps.views
          ) as row_data
        from player_scores ps
        where ps.hype > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'players_views', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by ps.views desc, ps.hype desc, ps.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by ps.views desc, ps.hype desc, ps.name),
            'player_id', ps.player_id, 'name', ps.name, 'school_name', ps.school_name,
            'views', ps.views, 'hype', ps.hype
          ) as row_data
        from player_scores ps
        where ps.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'highlights', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by rs.views desc, rs.hype desc, rs.created_at desc),
            'reel_id', rs.id, 'title', rs.title, 'category', rs.category,
            'player_id', rs.player_id, 'name', rs.player_name, 'school_name', rs.school_name,
            'views', rs.views, 'hype', rs.hype
          ) as row_data
        from reel_scores rs
        where rs.views > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'schools', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (ss.hype + ss.highlights * 10 + ss.fans * 5) desc, ss.school_name),
            'school_name', ss.school_name, 'hype', ss.hype, 'highlights', ss.highlights,
            'fans', ss.fans, 'score', ss.hype + ss.highlights * 10 + ss.fans * 5
          ) as row_data
        from school_scores ss
        where ss.hype + ss.highlights + ss.fans > 0
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb),
    'fans', coalesce((
      select jsonb_agg(row_data order by rank)
      from (
        select row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name) as rank,
          jsonb_build_object(
            'rank', row_number() over (order by (fs.clips_tagged * 10 + fs.hype_given) desc, fs.name),
            'profile_id', fs.profile_id, 'name', fs.name, 'avatar_url', fs.avatar_url,
            'hype_given', fs.hype_given, 'clips_tagged', fs.clips_tagged,
            'score', fs.clips_tagged * 10 + fs.hype_given
          ) as row_data
        from fan_scores fs
        order by rank
        limit board_limit
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- The trigger also sees direct writes to the tag columns, so it can refuse them.
drop trigger if exists reels_apply_tag_defaults on public.reels;
create trigger reels_apply_tag_defaults
  before insert or update of player_id, uploaded_by, tag_status, tag_confirmed_at, tag_confirmed_by
  on public.reels
  for each row
  execute procedure public.reels_apply_tag_defaults();

-- Clients write only the columns the app writes. Hosted Supabase grants every column by default, which made the
-- schema's column list meaningless: an uploader could approve their own tag or set their own counters and totals.
do $$
declare
  ins text;
  upd text;
begin
  select string_agg(quote_ident(column_name), ', ') into ins
  from information_schema.columns
  where table_schema = 'public' and table_name = 'reels'
    and column_name in ('id', 'video_url', 'title', 'player_id', 'game_id', 'is_exclusive', 'is_vault_only', 'category',
                        'attested_at', 'rights_version', 'media_type');
  select string_agg(quote_ident(column_name), ', ') into upd
  from information_schema.columns
  where table_schema = 'public' and table_name = 'reels'
    and column_name in ('title', 'category', 'is_exclusive', 'is_vault_only', 'flash_unlock_until');
  execute 'revoke insert, update on public.reels from anon, authenticated';
  execute format('grant insert (%s) on public.reels to authenticated', ins);
  execute format('grant update (%s) on public.reels to authenticated', upd);
end;
$$;

do $$
declare
  stmt text;
  fn text;
begin
  foreach stmt in array array[
    'grant execute on function public.tag_party(uuid, uuid) to anon, authenticated, service_role',
    'revoke all on function public.is_school_operator_for(uuid) from public, anon',
    'grant execute on function public.is_school_operator_for(uuid) to authenticated, service_role',
    'revoke all on function public.confirm_reel_player_tag(uuid, text) from public, anon',
    'grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated, service_role'
  ] loop
    fn := substring(stmt from 'function (public\.[a-z_]+\([^)]*\))');
    if to_regprocedure(fn) is not null then
      execute stmt;
    end if;
  end loop;
end;
$$;
