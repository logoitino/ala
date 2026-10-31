-- Combine measurables on players + career totals + recent game log.
-- Safe to re-run. UI: Stats 📊 on AthleteProfileView / AuraTradingCard back face.

alter table public.players add column if not exists weight text not null default '';
alter table public.players add column if not exists forty_yard text not null default '';
alter table public.players add column if not exists vertical_jump text not null default '';

create table if not exists public.athlete_career_stats (
  player_id uuid primary key references public.players (id) on delete cascade,
  sport text not null default 'Football',
  games_played integer not null default 0,
  scoring_value integer not null default 0,
  volume_value integer not null default 0,
  mvp_badges integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.athlete_game_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  played_on date not null,
  opponent_school text not null default '',
  stat_line text not null default '',
  scoring_value integer not null default 0,
  volume_value integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists athlete_game_logs_player_played_on_idx
  on public.athlete_game_logs (player_id, played_on desc);

alter table public.athlete_career_stats enable row level security;
alter table public.athlete_game_logs enable row level security;

drop policy if exists "Public read athlete career stats" on public.athlete_career_stats;
create policy "Public read athlete career stats"
  on public.athlete_career_stats for select
  using (true);

drop policy if exists "Public read athlete game logs" on public.athlete_game_logs;
create policy "Public read athlete game logs"
  on public.athlete_game_logs for select
  using (true);

grant select on public.athlete_career_stats to anon, authenticated;
grant select on public.athlete_game_logs to anon, authenticated;

update public.players
set
  weight = case when coalesce(weight, '') = '' then '192 lb' else weight end,
  forty_yard = case when coalesce(forty_yard, '') = '' then '4.58s' else forty_yard end,
  vertical_jump = case when coalesce(vertical_jump, '') = '' then '34 in' else vertical_jump end;

insert into public.athlete_career_stats (player_id, sport, games_played, scoring_value, volume_value, mvp_badges)
select p.id, 'Football', 11, 186, 2140, 2
from public.players p
on conflict (player_id) do nothing;

insert into public.athlete_game_logs (player_id, played_on, opponent_school, stat_line, scoring_value, volume_value)
select p.id, d.played_on, d.opponent_school, d.stat_line, d.scoring_value, d.volume_value
from public.players p
cross join (
  values
    ('2026-09-04'::date, 'Lone Peak Knights', '2 TD · 186 yds', 12, 186),
    ('2026-08-28'::date, 'Skyridge Sentinels', '1 TD · 142 yds', 6, 142),
    ('2026-08-21'::date, 'Timpview Thunderbirds', '3 TD · 221 yds', 18, 221)
) as d(played_on, opponent_school, stat_line, scoring_value, volume_value)
where not exists (
  select 1 from public.athlete_game_logs g where g.player_id = p.id
);
