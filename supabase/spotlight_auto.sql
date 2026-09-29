-- SUPERSEDED IN PART (2026-09-29): migrations/20260929120000_athlete_verification_ladder.sql replaces
-- redeem_team_code, request_athlete_verification, athlete_is_varsity_verified, can_confirm_player_tag
-- and confirm_reel_player_tag. Do NOT re-run this file after that migration: it would bring back
-- instant verification by shared team code and name-matched tag confirmation.

-- Player of the Week / Month / Year from confirmed tags.
-- Fan tags start pending. Athlete / parent / operator / admin confirm.
-- Clip energy (Seki + Aura + Flex) elects the tagged player; the hottest clip is the tape.
-- Incremental: run after spotlight_awards.sql + reel_hype_votes.sql + admin_dashboard.sql.

alter table public.profiles
  add column if not exists player_id uuid references public.players (id) on delete set null;

alter table public.reels
  add column if not exists uploaded_by uuid references public.profiles (id) on delete set null;
alter table public.reels
  add column if not exists tag_status text;
alter table public.reels
  add column if not exists tag_confirmed_at timestamptz;
alter table public.reels
  add column if not exists tag_confirmed_by uuid references public.profiles (id) on delete set null;

update public.reels
set tag_status = 'confirmed',
    tag_confirmed_at = coalesce(tag_confirmed_at, created_at)
where tag_status is null;

alter table public.reels
  alter column tag_status set default 'pending';

alter table public.reels
  alter column tag_status set not null;

alter table public.reels drop constraint if exists reels_tag_status_check;
alter table public.reels add constraint reels_tag_status_check
  check (tag_status in ('pending', 'confirmed', 'rejected'));

alter table public.spotlight_awards
  add column if not exists player_id uuid references public.players (id) on delete set null;
alter table public.spotlight_awards
  add column if not exists source text not null default 'auto';
alter table public.spotlight_awards
  add column if not exists locked boolean not null default false;

alter table public.spotlight_awards drop constraint if exists spotlight_awards_source_check;
alter table public.spotlight_awards add constraint spotlight_awards_source_check
  check (source in ('auto', 'manual'));

create index if not exists reels_tag_status_idx
  on public.reels (tag_status, created_at desc)
  where coalesce(is_removed, false) = false;

create index if not exists reels_uploaded_by_idx
  on public.reels (uploaded_by);

create index if not exists profiles_player_id_idx
  on public.profiles (player_id);

create index if not exists spotlight_awards_kind_start_idx
  on public.spotlight_awards (award_type, start_date);

create or replace function public.spotlight_normalize_kind(period_kind text)
returns text
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(period_kind, 'week'))) in ('month', 'player_of_the_month') then 'month'
    when lower(btrim(coalesce(period_kind, 'week'))) in ('year', 'player_of_the_year') then 'year'
    else 'week'
  end;
$$;

create or replace function public.spotlight_window(
  period_kind text,
  as_of date default (timezone('utc', now()))::date
)
returns table (window_start date, window_end date)
language plpgsql
stable
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  origin timestamptz := timezone('utc', as_of::timestamp);
begin
  if kind = 'month' then
    window_start := date_trunc('month', origin)::date;
    window_end := (date_trunc('month', origin) + interval '1 month' - interval '1 day')::date;
  elsif kind = 'year' then
    window_start := date_trunc('year', origin)::date;
    window_end := (date_trunc('year', origin) + interval '1 year' - interval '1 day')::date;
  else
    window_start := date_trunc('week', origin)::date;
    window_end := (window_start + 6)::date;
  end if;
  return next;
end;
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
  -- 2026-09 audit follow-up: dropped the `auth.role() = 'anon'` bypass — see schema.sql.
  if role_name = 'admin' then
    return true;
  end if;

  select * into athlete from public.players where id = target_player_id;
  if athlete.id is null then
    return false;
  end if;

  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;
  if actor is null then
    return false;
  end if;

  if athlete.guardian_id is not null and athlete.guardian_id = actor then
    return true;
  end if;

  if exists (
    select 1
    from public.profiles pr
    left join public.schools_and_teams s on s.id = pr.school_id
    where pr.id = actor
      and (
        pr.player_id = athlete.id
        or lower(pr.full_name) = lower(athlete.name)
        or (
          nullif(btrim(coalesce(pr.athlete_jersey, '')), '') is not null
          and btrim(pr.athlete_jersey) = athlete.jersey_number::text
          and s.id is not null
          and (
            lower(s.name) = lower(athlete.school_name)
            or lower(s.name) = lower(coalesce(athlete.team, ''))
          )
        )
      )
  ) then
    return true;
  end if;

  if role_name = 'operator'
     or exists (
       select 1 from public.profiles pr
       where pr.id = actor
         and coalesce(pr.roles, array[]::text[]) @> array['operator']::text[]
     )
  then
    if exists (
      select 1
      from public.profiles pr
      join public.schools_and_teams s on s.id = pr.school_id
      where pr.id = actor
        and (
          lower(s.name) = lower(athlete.school_name)
          or lower(s.name) = lower(coalesce(athlete.team, ''))
        )
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
begin
  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  if NEW.uploaded_by is null then
    NEW.uploaded_by := actor;
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

drop trigger if exists reels_apply_tag_defaults on public.reels;
create trigger reels_apply_tag_defaults
  before insert or update of player_id, uploaded_by, tag_status
  on public.reels
  for each row
  execute procedure public.reels_apply_tag_defaults();

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
  next_status text;
begin
  if action not in ('confirm', 'reject') then
    raise exception 'tag_action must be confirm or reject';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;
  if clip.player_id is null then
    raise exception 'This clip has no tagged player.';
  end if;
  if not public.can_confirm_player_tag(clip.player_id) then
    raise exception 'Only the tagged athlete, their parent, a school operator, or admin can verify this tag.';
  end if;

  select pr.id into actor
  from public.profiles pr
  where pr.user_id = auth.uid()
  limit 1;

  next_status := case when action = 'reject' then 'rejected' else 'confirmed' end;

  update public.reels
  set
    tag_status = next_status,
    tag_confirmed_at = timezone('utc', now()),
    tag_confirmed_by = actor
  where id = target_reel_id
  returning * into clip;

  if next_status = 'confirmed' and actor is not null then
    update public.profiles
    set player_id = clip.player_id
    where id = actor
      and player_id is null
      and (
        public.current_user_role() in ('athlete', 'fan', 'admin')
        or coalesce(roles, array[]::text[]) && array['athlete', 'admin']::text[]
      );
  end if;

  perform public.sync_live_spotlight_awards();

  return jsonb_build_object(
    'id', clip.id,
    'player_id', clip.player_id,
    'tag_status', clip.tag_status,
    'tag_confirmed_at', clip.tag_confirmed_at
  );
end;
$$;

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
    and (
      role_name = 'admin'
      or public.can_confirm_player_tag(r.player_id)
    )
  order by r.created_at desc
  limit 40;
end;
$$;

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

create or replace function public.sync_spotlight_period(period_kind text default 'week')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
  payload jsonb;
  leader jsonb;
  existing public.spotlight_awards%rowtype;
  linked uuid;
  award_id uuid;
  headline text;
  period_title text;
  shot_by text;
begin
  select * into bounds from public.spotlight_window(kind);
  payload := public.get_spotlight_standings(kind);
  leader := payload -> 'leaders' -> 0;

  select * into existing
  from public.spotlight_awards a
  where a.award_type = kind
    and a.start_date = bounds.window_start
  order by a.created_at desc
  limit 1;

  if existing.id is not null and coalesce(existing.locked, false) then
    return jsonb_build_object(
      'crowned', false,
      'locked', true,
      'id', existing.id,
      'period_kind', kind,
      'player_id', existing.player_id,
      'headline', existing.headline
    );
  end if;

  if leader is null or leader = 'null'::jsonb then
    return jsonb_build_object(
      'crowned', false,
      'locked', false,
      'period_kind', kind,
      'reason', 'no_confirmed_hype'
    );
  end if;

  period_title := case
    when kind = 'year' then 'Player of the Year'
    when kind = 'month' then 'Player of the Month'
    else 'Player of the Week'
  end;
  headline := nullif(btrim(coalesce(leader ->> 'title', '')), '');
  if headline is null then
    headline := format(
      '%s hype · %s Seki · %s Aura · %s Flex',
      coalesce(leader ->> 'hype', '0'),
      coalesce(leader ->> 'seki', '0'),
      coalesce(leader ->> 'aura', '0'),
      coalesce(leader ->> 'flex', '0')
    );
  end if;
  shot_by := nullif(btrim(coalesce(leader ->> 'shot_by', '')), '');
  if shot_by is not null
     and lower(shot_by) is distinct from lower(coalesce(leader ->> 'name', ''))
  then
    headline := headline || ' · Clip by ' || shot_by;
  end if;

  select pr.id into linked
  from public.profiles pr
  where pr.player_id = (leader ->> 'player_id')::uuid
     or lower(pr.full_name) = lower(leader ->> 'name')
  order by case when pr.player_id = (leader ->> 'player_id')::uuid then 0 else 1 end
  limit 1;

  if existing.id is not null then
    update public.spotlight_awards
    set
      athlete_id = linked,
      player_id = (leader ->> 'player_id')::uuid,
      award_type = kind,
      level = 'platform',
      district_region = leader ->> 'school_name',
      headline = headline,
      highlight_reel_id = nullif(leader ->> 'reel_id', '')::uuid,
      start_date = bounds.window_start,
      end_date = bounds.window_end,
      source = 'auto',
      locked = false
    where id = existing.id
    returning id into award_id;
  else
    insert into public.spotlight_awards (
      athlete_id, player_id, award_type, level, district_region, headline,
      highlight_reel_id, start_date, end_date, source, locked
    )
    values (
      linked,
      (leader ->> 'player_id')::uuid,
      kind,
      'platform',
      leader ->> 'school_name',
      headline,
      nullif(leader ->> 'reel_id', '')::uuid,
      bounds.window_start,
      bounds.window_end,
      'auto',
      false
    )
    returning id into award_id;
  end if;

  return jsonb_build_object(
    'crowned', true,
    'locked', false,
    'id', award_id,
    'period_kind', kind,
    'player_id', leader ->> 'player_id',
    'reel_id', leader ->> 'reel_id',
    'headline', headline,
    'hype', leader -> 'hype',
    'title', period_title
  );
end;
$$;

create or replace function public.sync_live_spotlight_awards()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'week', public.sync_spotlight_period('week'),
    'month', public.sync_spotlight_period('month'),
    'year', public.sync_spotlight_period('year')
  );
end;
$$;

create or replace function public.unlock_spotlight_period(period_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
begin
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
    raise exception 'Access restricted';
  end if;
  select * into bounds from public.spotlight_window(kind);
  update public.spotlight_awards
  set locked = false,
      source = 'auto'
  where award_type = kind
    and start_date = bounds.window_start;
  return public.sync_spotlight_period(kind);
end;
$$;

create or replace function public.increment_reel_hype(target_reel_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.reels%rowtype;
  viewer uuid := auth.uid();
  applied boolean := true;
begin
  if hype_kind not in ('aura', 'flex', 'seki') then
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  if viewer is not null then
    begin
      insert into public.reel_hype_votes (user_id, reel_id, kind)
      values (viewer, target_reel_id, hype_kind);
    exception
      when unique_violation then
        applied := false;
    end;
  end if;

  if applied then
    if hype_kind = 'aura' then
      update public.reels
      set aura_count = coalesce(aura_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    elsif hype_kind = 'flex' then
      update public.reels
      set flex_count = coalesce(flex_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    else
      update public.reels
      set seki_count = coalesce(seki_count, 0) + 1
      where id = target_reel_id
      returning * into result;
    end if;
    perform public.sync_live_spotlight_awards();
  else
    select * into result from public.reels where id = target_reel_id;
  end if;

  return jsonb_build_object(
    'seki_count', coalesce(result.seki_count, 0),
    'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0),
    'total_tips_cents', coalesce(result.total_tips_cents, 0),
    'applied', applied
  );
end;
$$;

drop function if exists public.get_active_spotlight_award(uuid);

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

drop function if exists public.publish_spotlight_award(uuid, text, text, date, date);

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
  if public.current_user_role() <> 'admin' and auth.role() <> 'anon' then
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

grant execute on function public.spotlight_normalize_kind(text) to anon, authenticated;
grant execute on function public.spotlight_window(text, date) to anon, authenticated;
-- 2026-09 audit follow-up: anon dropped — see schema.sql.
grant execute on function public.can_confirm_player_tag(uuid) to authenticated;
grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated;
grant execute on function public.get_pending_player_tags() to authenticated;
grant execute on function public.get_spotlight_standings(text) to anon, authenticated;
grant execute on function public.sync_spotlight_period(text) to anon, authenticated;
grant execute on function public.sync_live_spotlight_awards() to anon, authenticated;
grant execute on function public.unlock_spotlight_period(text) to anon, authenticated;
grant execute on function public.get_active_spotlight_award(uuid) to anon, authenticated;
-- Admin-only Spotlight desk action. Match schema.sql: authenticated only.
revoke execute on function public.publish_spotlight_award(uuid, text, text, date, date) from anon;
grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to authenticated;
grant execute on function public.increment_reel_hype(uuid, text) to anon, authenticated;
