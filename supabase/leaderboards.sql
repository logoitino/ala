-- ROADMAP Mission M1 — leaderboards and friendly competition. Safe to re-run.
--
-- Adds a Highlight view count (one counted view per signed-in viewer per clip per UTC day) and one
-- read RPC that returns every board for a Spotlight window: most-hyped players, most-viewed players,
-- most-viewed Highlights, school standings and top fans.
--
-- Guardrail (docs/STORY.md): boards rank hype and views only. No tips, Mālo amounts or backer counts
-- appear anywhere in `get_leaderboards` — never rank kids by money.
--
-- Standalone copy for applying by hand; `apps/mobile/src/backend/db/schema.sql` is canonical.

alter table public.reels add column if not exists view_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reels_view_count_nonnegative'
  ) then
    alter table public.reels
      add constraint reels_view_count_nonnegative check (view_count >= 0);
  end if;
end;
$$;

-- `view_count` is not in the `grant update (title, category, is_exclusive, is_vault_only,
-- flash_unlock_until) on public.reels to authenticated` column list, so clients cannot write it.
-- It only moves through `record_reel_view` below (SECURITY DEFINER, runs as the owner).

-- One row per viewer per Highlight per UTC day. The primary key is the throttle: a second view the
-- same day is a no-op insert, so replaying or looping a clip cannot pump its count. Client tables
-- get no policies and no grants — only the RPCs below read or write it.
create table if not exists public.reel_views (
  reel_id uuid not null references public.reels (id) on delete cascade,
  viewer_id uuid not null,
  view_day date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now(),
  primary key (reel_id, viewer_id, view_day)
);

create index if not exists reel_views_view_day_idx on public.reel_views (view_day);

alter table public.reel_views enable row level security;
revoke all on public.reel_views from anon, authenticated;

-- Signed-in only: the anon key ships in the app bundle, so an anon view would be inflatable by
-- anyone with a script. The uploader and the tagged athlete's own account do not count (no
-- watching your own clip up the board). Removed, flagged and Vault-only clips never count.
-- Returns the clip's view count after the call, or null when the clip cannot be counted.
create or replace function public.record_reel_view(target_reel_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewer_profile uuid;
  viewer_player uuid;
  clip public.reels%rowtype;
  inserted integer := 0;
  next_count integer;
begin
  if viewer is null then
    raise exception 'Sign in to count a view' using errcode = '42501';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if not found
    or coalesce(clip.is_removed, false)
    or coalesce(clip.is_flagged, false)
    or coalesce(clip.is_vault_only, false)
  then
    return null;
  end if;

  select p.id, p.player_id into viewer_profile, viewer_player
  from public.profiles p
  where p.user_id = viewer
  limit 1;

  if (viewer_profile is not null and clip.uploaded_by = viewer_profile)
    or (viewer_player is not null and clip.player_id = viewer_player)
  then
    return coalesce(clip.view_count, 0);
  end if;

  insert into public.reel_views (reel_id, viewer_id, view_day)
  values (target_reel_id, viewer, (timezone('utc', now()))::date)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.reels
      set view_count = coalesce(view_count, 0) + 1
      where id = target_reel_id
      returning view_count into next_count;
    return next_count;
  end if;

  return coalesce(clip.view_count, 0);
end;
$$;

revoke all on function public.record_reel_view(uuid) from public, anon;
grant execute on function public.record_reel_view(uuid) to authenticated;

-- Every board for one Spotlight window (`week` by default, so new athletes can climb each Monday).
--
-- Eligible clips: tag confirmed (the athlete, their guardian, an operator or an admin said "that's
-- them"), not removed, not flagged, not Vault-only, not Exclusive. Hype = Seki / Aura / Flex votes
-- cast inside the window (`reel_hype_votes.created_at`); views = counted views inside the window
-- (`reel_views.view_day`). Neither depends on when the clip was uploaded.
--
-- School score = hype + 10 × Highlights posted in the window + 5 × distinct fans who hyped or
-- viewed that school's clips. Fan score = 10 × clips they posted that got confirmed + hype they gave.
-- Fans show a username (or first name only) — never a full name.
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
    where v.created_at::date between bounds.window_start and bounds.window_end
  ),
  views as (
    select w.reel_id, w.viewer_id
    from public.reel_views w
    join eligible e on e.id = w.reel_id
    where w.view_day between bounds.window_start and bounds.window_end
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
      count(*) filter (where rs.created_at::date between bounds.window_start and bounds.window_end)::int as highlights,
      coalesce((select count(distinct sf.fan) from school_fans sf where sf.school_name = rs.school_name), 0)::int as fans
    from reel_scores rs
    where rs.school_name <> ''
    group by rs.school_name
  ),
  fan_scores as (
    select pr.id as profile_id,
      coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(pr.full_name), ' ', 1), ''), 'Fan') as name,
      pr.avatar_url,
      coalesce((select count(*) from hype h where h.user_id = pr.user_id), 0)::int as hype_given,
      coalesce((select count(*) from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end), 0)::int as clips_tagged
    from public.profiles pr
    where exists (select 1 from hype h where h.user_id = pr.user_id)
      or exists (select 1 from eligible e where e.uploaded_by = pr.id
        and e.created_at::date between bounds.window_start and bounds.window_end)
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

grant execute on function public.get_leaderboards(text) to anon, authenticated;
