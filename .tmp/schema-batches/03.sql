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
  -- 2026-09 audit: dropped the `auth.role() <> 'anon'` bypass — this is an admin-only Spotlight
  -- desk action (`/admin/spotlight`), not part of the anon operator-PIN sideline flow.
  if public.current_user_role() <> 'admin' then
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
drop function if exists public.toggle_reel_vault_status(uuid);
create or replace function public.toggle_reel_vault_status(target_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  owner_profile uuid;
  clip_uploader uuid;
  next_vault boolean;
begin
  if actor is null then
    raise exception 'Sign in to change vault status.';
  end if;

  select uploaded_by into clip_uploader from public.reels where id = target_reel_id;
  if not found then
    raise exception 'Highlight not found.';
  end if;

  select p.id into owner_profile from public.profiles p where p.user_id = actor limit 1;

  -- 2026-09 audit (reels RLS tightening): this RPC previously let *any* signed-in user flip the
  -- Vault flag on *any* reel — it only checked `actor is not null`, not who uploaded the clip. Now
  -- scoped to the uploader (matches `AthleteReelManager`'s own-clip long-press menu) or an admin
  -- (matches the `/admin/highlights` desk's Vault toggle).
  if clip_uploader is distinct from owner_profile and public.current_user_role() <> 'admin' then
    raise exception 'Only the uploader or an admin can change this Highlight''s Vault status.';
  end if;

  update public.reels
  set
    is_vault_only = not coalesce(is_vault_only, is_exclusive, false),
    is_exclusive = not coalesce(is_vault_only, is_exclusive, false)
  where id = target_reel_id
  returning is_vault_only into next_vault;

  if next_vault is null then
    raise exception 'Highlight not found.';
  end if;

  return next_vault;
end;
$$;
drop function if exists public.set_player_vault_locked(uuid, boolean);
create or replace function public.set_player_vault_locked(target_player_id uuid, is_locked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  next_locked boolean;
begin
  if actor is null then
    raise exception 'Sign in to lock or open the Vault.';
  end if;

  -- 2026-09 audit follow-up: this SECURITY DEFINER RPC bypasses RLS entirely, so it needs its own
  -- ownership check — previously any signed-in fan could lock/unlock any athlete's Vault. There
  -- are two legitimate callers: (a) the athlete themselves, managing their own claimed roster row
  -- from their own Profile tab (`app/(tabs)/profile.tsx`'s `manageVault` — `VaultLockCard`), and
  -- (b) school staff from the admin Athletes desk (`AthletesTool.tsx`), mirroring the "Staff write
  -- players" RLS policy's role set.
  if not (
    public.current_user_role() in ('booster', 'admin', 'operator')
    or exists (
      select 1 from public.profiles p
      where p.user_id = actor
        and p.player_id = target_player_id
    )
  ) then
    raise exception 'Only the athlete, school staff, or admin may lock or open a Vault.';
  end if;

  update public.players
  set vault_locked = coalesce(is_locked, true)
  where id = target_player_id
  returning vault_locked into next_locked;

  if next_locked is null then
    raise exception 'Athlete not found.';
  end if;

  return next_locked;
end;
$$;
drop function if exists public.get_crew_graph(uuid);
create or replace function public.get_crew_graph(target_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  crew_n integer := 0;
  squad_n integer := 0;
  is_following boolean := false;
  is_mutual boolean := false;
  viewer_player uuid;
  athlete_user uuid;
begin
  select count(*)::int into crew_n
  from public.crew_follows
  where athlete_id = target_athlete_id;

  select p.user_id into athlete_user
  from public.profiles p
  join public.players pl on lower(trim(p.full_name)) = lower(trim(pl.name))
  where pl.id = target_athlete_id
    and p.user_id is not null
  limit 1;

  if athlete_user is not null then
    select count(*)::int into squad_n
    from public.crew_follows
    where follower_id = athlete_user;
  end if;

  if actor is not null then
    select exists(
      select 1
      from public.crew_follows
      where follower_id = actor
        and athlete_id = target_athlete_id
    ) into is_following;

    select pl.id into viewer_player
    from public.players pl
    join public.profiles p on lower(trim(pl.name)) = lower(trim(p.full_name))
    where p.user_id = actor
    limit 1;

    if is_following and viewer_player is not null and athlete_user is not null then
      select exists(
        select 1
        from public.crew_follows
        where follower_id = athlete_user
          and athlete_id = viewer_player
      ) into is_mutual;
    end if;
  end if;

  return jsonb_build_object(
    'crew_count', coalesce(crew_n, 0),
    'squad_count', coalesce(squad_n, 0),
    'following', coalesce(is_following, false),
    'mutual', coalesce(is_mutual, false)
  );
end;
$$;
drop function if exists public.toggle_crew_follow(uuid, boolean);
create or replace function public.toggle_crew_follow(target_athlete_id uuid, should_join boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to join the Crew.';
  end if;

  if not exists (select 1 from public.players where id = target_athlete_id) then
    raise exception 'Athlete not found.';
  end if;

  if should_join then
    insert into public.crew_follows (follower_id, athlete_id)
    values (actor, target_athlete_id)
    on conflict (follower_id, athlete_id) do nothing;
  else
    delete from public.crew_follows
    where follower_id = actor
      and athlete_id = target_athlete_id;
  end if;

  return public.get_crew_graph(target_athlete_id);
end;
$$;
drop function if exists public.set_reel_flash_unlock(uuid);
create or replace function public.set_reel_flash_unlock(target_reel_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  owner_profile uuid;
  until_at timestamptz := timezone('utc', now()) + interval '2 hours';
  clip public.reels%rowtype;
  notified integer := 0;
begin
  if actor is null then
    raise exception 'Sign in to flash-unlock a Highlight.';
  end if;

  select * into clip from public.reels where id = target_reel_id;
  if clip.id is null then
    raise exception 'Highlight not found.';
  end if;

  select p.id into owner_profile from public.profiles p where p.user_id = actor limit 1;

  -- 2026-09 audit (reels RLS tightening): previously any signed-in user could flash-unlock any
  -- Vault clip for free (no ownership check at all) — this only exists as an athlete's own-clip
  -- promo tool (`AthleteReelManager`), so scope it the same way as `toggle_reel_vault_status`.
  if clip.uploaded_by is distinct from owner_profile and public.current_user_role() <> 'admin' then
    raise exception 'Only the uploader or an admin can flash-unlock this Highlight.';
  end if;

  update public.reels
  set flash_unlock_until = until_at
  where id = target_reel_id;

  if clip.player_id is not null then
    insert into public.crew_push_queue (recipient_id, athlete_id, reel_id, kind, title, body, payload)
    select
      f.follower_id,
      clip.player_id,
      clip.id,
      'flash_unlock',
      '⚡ Flash Unlock',
      'A Vault Highlight is open for 2 hours.',
      jsonb_build_object(
        'reel_id', clip.id,
        'athlete_id', clip.player_id,
        'flash_unlock_until', until_at,
        'kind', 'flash_unlock'
      )
    from public.crew_follows f
    where f.athlete_id = clip.player_id;

    get diagnostics notified = row_count;
  end if;

  return jsonb_build_object(
    'flash_unlock_until', until_at,
    'notified_count', coalesce(notified, 0)
  );
end;
$$;
drop function if exists public.get_active_spotlight_award(uuid);