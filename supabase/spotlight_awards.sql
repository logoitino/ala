-- Player of the Week / Month spotlight. Aligns with the live `spotlight_awards` stub.
-- Client launch: get_active_spotlight_award(viewer_user_id). Dismiss is AsyncStorage.

create table if not exists public.spotlight_awards (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.profiles (id) on delete cascade,
  award_type text not null,
  level text not null default 'school',
  school_id uuid references public.schools_and_teams (id) on delete set null,
  district_region text,
  headline text not null,
  highlight_reel_id uuid references public.reels (id) on delete set null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists spotlight_awards_window_idx
  on public.spotlight_awards (start_date, end_date);

alter table public.spotlight_awards enable row level security;

drop policy if exists "Public read spotlight awards" on public.spotlight_awards;
create policy "Public read spotlight awards"
  on public.spotlight_awards for select
  using (true);

grant select on public.spotlight_awards to anon, authenticated;

drop function if exists public.get_active_spotlight_award(uuid);

create or replace function public.get_active_spotlight_award(viewer_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  award_id uuid;
  award_athlete uuid;
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
  period_kind text;
  period_title text;
begin
  perform viewer_user_id;

  select
    a.id,
    a.athlete_id,
    a.award_type,
    a.headline,
    a.highlight_reel_id,
    a.start_date,
    a.district_region,
    a.school_id
  into
    award_id,
    award_athlete,
    award_kind,
    award_headline,
    award_reel,
    award_start,
    award_region,
    award_school
  from public.spotlight_awards a
  where timezone('utc', now())::date between a.start_date and a.end_date
  order by
    case when lower(a.award_type) in ('week', 'player_of_the_week') then 0 else 1 end,
    a.created_at desc
  limit 1;

  if award_id is null then
    return null;
  end if;

  period_kind := case
    when lower(coalesce(award_kind, 'week')) in ('month', 'player_of_the_month') then 'month'
    else 'week'
  end;
  period_title := case when period_kind = 'month' then 'Player of the Month' else 'Player of the Week' end;

  if award_school is not null then
    select s.name into school_label from public.schools_and_teams s where s.id = award_school;
  end if;

  if award_athlete is not null then
    select pr.full_name into profile_name from public.profiles pr where pr.id = award_athlete;
    select * into athlete from public.players p where p.id = award_athlete;
  end if;

  if athlete.id is null and profile_name is not null then
    select * into athlete
    from public.players p
    where lower(p.name) = lower(profile_name)
    limit 1;
  end if;

  if athlete.id is null then
    select * into athlete
    from public.players p
    order by
      case
        when p.school_name ilike '%westlake%' then 0
        when p.name ilike 'Tyler Nguyen' then 1
        else 2
      end,
      p.backer_count desc
    limit 1;
  end if;

  clip_id := award_reel;
  if clip_id is not null then
    select r.video_url into clip_url from public.reels r where r.id = clip_id;
  end if;

  if clip_url is null and athlete.id is not null then
    select r.id, r.video_url
      into clip_id, clip_url
    from public.reels r
    where r.player_id = athlete.id
      and coalesce(r.is_vault_only, false) = false
    order by r.created_at desc
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
    'player', case when athlete.id is null then null else to_jsonb(athlete) end
  );
end;
$$;

grant execute on function public.get_active_spotlight_award(uuid) to anon, authenticated;

insert into public.spotlight_awards (
  athlete_id, award_type, level, district_region, headline, highlight_reel_id, start_date, end_date
)
select
  null,
  'week',
  'school',
  'Westlake High',
  '4 Touchdowns & 12 Tackles',
  (
    select r.id
    from public.reels r
    where coalesce(r.is_vault_only, false) = false
    order by r.created_at desc
    limit 1
  ),
  date_trunc('week', timezone('utc', now()))::date,
  (date_trunc('week', timezone('utc', now())) + interval '6 days')::date
where not exists (
  select 1
  from public.spotlight_awards a
  where a.start_date = date_trunc('week', timezone('utc', now()))::date
    and lower(a.award_type) in ('week', 'player_of_the_week')
);
