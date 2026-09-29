-- =============================================================================================
-- Filmers: stats, Top Filmers board, Aura rewards and Props
-- =============================================================================================
-- Owner decision 2026-09-29: fans who film and post a teammate's highlight get rewarded, but never
-- out of the athlete's gifts. Mālo stays 100% the tagged athlete's.
--
-- What changes:
--   1. filmer_rewards — one row per reward a filmer earns (tag confirmed, view milestone, Props).
--      Written only by the server. Today every row is Aura. cash_cents / funded_by are reserved for
--      a future Tapua'i-funded filmer programme: funded_by can only ever be 'tapuai', so athlete
--      gifts can never be routed to a filmer through this table. No client shows the cash columns.
--   2. Aura for filmers (server-side trigger on reels, so a client cannot mint it):
--        +10 when the athlete confirms the tag on a clip the fan filmed;
--        +10 / +50 / +200 when that clip reaches 100 / 1,000 / 10,000 counted views.
--      Never paid to the athlete for their own clip.
--   3. filmer_props — a fan's "🎥 Props" to whoever filmed a clip (once per fan per clip, 50 a day).
--      +1 Aura to the filmer each.
--   4. filmer_stats(profile) now also returns props and aura_earned.
--   5. get_top_filmers(period_kind) — the Spotlight "Top Filmers" board: views + 3 × hype + 5 × Props
--      on confirmed clips they filmed, inside the Spotlight window. No money fields.
--
-- Needs: supabase/leaderboards.sql (reels.view_count, reel_views, reel_hype_votes.created_at) and
-- 20260929160000_reel_views_and_filmer_credit.sql (filmer_stats).
--
-- Roll back:
--   drop trigger reels_filmer_rewards on public.reels; drop function public.reels_filmer_rewards();
--   drop function public.get_top_filmers(text); drop function public.give_filmer_props(uuid);
--   drop function public.award_filmer_aura(uuid, uuid, text, text, integer);
--   drop table public.filmer_props; drop table public.filmer_rewards;
--   then re-create filmer_stats from 20260929160000. Aura already added to profiles stays.
-- =============================================================================================

create table if not exists public.filmer_rewards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reel_id uuid references public.reels (id) on delete set null,
  kind text not null check (kind in ('tag_confirmed', 'views_milestone', 'props')),
  -- Makes each reward idempotent: 'tag:<reel>', 'views:<n>:<reel>', 'props:<reel>:<giver>'.
  source_key text not null unique,
  aura_points integer not null default 0 check (aura_points >= 0),
  cash_cents integer not null default 0 check (cash_cents >= 0),
  funded_by text not null default 'tapuai' check (funded_by = 'tapuai'),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists filmer_rewards_profile_idx on public.filmer_rewards (profile_id, created_at desc);

alter table public.filmer_rewards enable row level security;
revoke all on public.filmer_rewards from anon, authenticated;
grant select on public.filmer_rewards to authenticated;

drop policy if exists "Filmers read own rewards" on public.filmer_rewards;
create policy "Filmers read own rewards" on public.filmer_rewards
  for select to authenticated
  using (profile_id in (select p.id from public.profiles p where p.user_id = auth.uid()));

create table if not exists public.filmer_props (
  reel_id uuid not null references public.reels (id) on delete cascade,
  giver_user_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (reel_id, giver_user_id)
);

create index if not exists filmer_props_giver_idx on public.filmer_props (giver_user_id, created_at desc);

-- Written and read only through the functions below.
alter table public.filmer_props enable row level security;
revoke all on public.filmer_props from anon, authenticated;

-- Internal: add a reward once. Returns true when it was new.
create or replace function public.award_filmer_aura(
  target_profile_id uuid,
  target_reel_id uuid,
  reward_kind text,
  reward_key text,
  points integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  if target_profile_id is null or coalesce(points, 0) <= 0 then
    return false;
  end if;
  insert into public.filmer_rewards (profile_id, reel_id, kind, source_key, aura_points)
  values (target_profile_id, target_reel_id, reward_kind, reward_key, points)
  on conflict (source_key) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  update public.profiles
    set aura_points = coalesce(aura_points, 0) + points
    where id = target_profile_id;
  return true;
end;
$$;

revoke all on function public.award_filmer_aura(uuid, uuid, text, text, integer) from public, anon, authenticated;

-- The filmer of a clip: its uploader, unless the uploader is the tagged athlete. Null otherwise.
create or replace function public.reel_filmer_profile_id(target_reel_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select up.id
  from public.reels r
  join public.profiles up on up.id = r.uploaded_by
  where r.id = target_reel_id
    and (r.player_id is null or up.player_id is distinct from r.player_id);
$$;

revoke all on function public.reel_filmer_profile_id(uuid) from public, anon, authenticated;

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

drop trigger if exists reels_filmer_rewards on public.reels;
create trigger reels_filmer_rewards
  after update of tag_status, view_count on public.reels
  for each row
  execute function public.reels_filmer_rewards();

create or replace function public.give_filmer_props(target_reel_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  giver uuid := auth.uid();
  filmer uuid;
  clip public.reels%rowtype;
  today_count integer;
  inserted integer := 0;
  total integer;
begin
  if giver is null then
    raise exception 'Sign in to give Props' using errcode = '42501';
  end if;
  select * into clip from public.reels where id = target_reel_id;
  if not found or clip.tag_status is distinct from 'confirmed' or coalesce(clip.is_removed, false) then
    raise exception 'Props open once the athlete confirms this clip';
  end if;
  filmer := public.reel_filmer_profile_id(target_reel_id);
  if filmer is null then
    raise exception 'This clip was posted by the athlete';
  end if;
  if exists (select 1 from public.profiles p where p.id = filmer and p.user_id = giver) then
    raise exception 'You filmed this one';
  end if;
  select count(*) into today_count
  from public.filmer_props
  where giver_user_id = giver and created_at > timezone('utc', now()) - interval '1 day';
  if today_count >= 50 then
    raise exception 'That is 50 Props today. Try again tomorrow';
  end if;

  insert into public.filmer_props (reel_id, giver_user_id)
  values (target_reel_id, giver)
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    perform public.award_filmer_aura(filmer, target_reel_id, 'props', 'props:' || target_reel_id || ':' || giver, 1);
  end if;

  select count(*) into total from public.filmer_props where reel_id = target_reel_id;
  return total;
end;
$$;

grant execute on function public.give_filmer_props(uuid) to authenticated;

create or replace function public.filmer_stats(target_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with clips as (
    select r.*
    from public.reels r
    join public.profiles up on up.id = r.uploaded_by
    where r.uploaded_by = target_profile_id
      and r.tag_status = 'confirmed'
      and not coalesce(r.is_removed, false)
      and (r.player_id is null or up.player_id is distinct from r.player_id)
  )
  select jsonb_build_object(
    'clips', (select count(*) from clips)::integer,
    'views', coalesce((select sum(view_count) from clips), 0)::integer,
    'hype', coalesce((select sum(seki_count + aura_count + flex_count) from clips), 0)::integer,
    'props', (select count(*) from public.filmer_props fp join clips c on c.id = fp.reel_id)::integer,
    'aura_earned', coalesce((
      select sum(fr.aura_points) from public.filmer_rewards fr where fr.profile_id = target_profile_id
    ), 0)::integer
  );
$$;

grant execute on function public.filmer_stats(uuid) to anon, authenticated;

create or replace function public.get_top_filmers(period_kind text default 'week')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  kind text := public.spotlight_normalize_kind(period_kind);
  bounds record;
begin
  select * into bounds from public.spotlight_window(kind);

  return coalesce((
    with eligible as (
      select r.id, r.uploaded_by
      from public.reels r
      join public.profiles up on up.id = r.uploaded_by
      where r.tag_status = 'confirmed'
        and not coalesce(r.is_removed, false)
        and not coalesce(r.is_flagged, false)
        and not coalesce(r.is_vault_only, false)
        and (r.player_id is null or up.player_id is distinct from r.player_id)
    ),
    scores as (
      select e.uploaded_by as profile_id,
        count(distinct e.id)::int as clips,
        coalesce(sum((select count(*) from public.reel_views w
          where w.reel_id = e.id and w.view_day between bounds.window_start and bounds.window_end)), 0)::int as views,
        coalesce(sum((select count(*) from public.reel_hype_votes v
          where v.reel_id = e.id and v.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as hype,
        coalesce(sum((select count(*) from public.filmer_props fp
          where fp.reel_id = e.id and fp.created_at::date between bounds.window_start and bounds.window_end)), 0)::int as props
      from eligible e
      group by e.uploaded_by
    ),
    ranked as (
      select s.*, s.views + s.hype * 3 + s.props * 5 as score,
        coalesce(nullif(btrim(pr.username), ''), nullif(split_part(btrim(coalesce(pr.full_name, '')), ' ', 1), ''), 'Filmer') as name,
        pr.avatar_url
      from scores s
      join public.profiles pr on pr.id = s.profile_id
      where s.views + s.hype + s.props > 0
    )
    select jsonb_agg(row_data order by rank)
    from (
      select row_number() over (order by rk.score desc, rk.name) as rank,
        jsonb_build_object(
          'rank', row_number() over (order by rk.score desc, rk.name),
          'profile_id', rk.profile_id, 'name', rk.name, 'avatar_url', rk.avatar_url,
          'clips', rk.clips, 'views', rk.views, 'hype', rk.hype, 'props', rk.props, 'score', rk.score
        ) as row_data
      from ranked rk
      order by rank
      limit 10
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_top_filmers(text) to anon, authenticated;
