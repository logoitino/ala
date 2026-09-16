-- Universal HS + college team catalog. Safe to re-run.
-- search_schools_and_teams uses ILIKE '%query%' on name / mascot / division / region / city.

create table if not exists public.schools_and_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mascot text not null default '',
  level text not null default 'high_school',
  division text not null default 'High School',
  region text not null default 'UT',
  city text not null default '',
  created_at timestamptz not null default now()
);

alter table public.schools_and_teams add column if not exists mascot text not null default '';
alter table public.schools_and_teams add column if not exists level text not null default 'high_school';
alter table public.schools_and_teams add column if not exists division text not null default 'High School';
alter table public.schools_and_teams add column if not exists region text not null default 'UT';
alter table public.schools_and_teams add column if not exists city text not null default '';
alter table public.schools_and_teams add column if not exists created_at timestamptz not null default now();
alter table public.schools_and_teams add column if not exists team_code text;

create unique index if not exists schools_and_teams_team_code_key
  on public.schools_and_teams (upper(btrim(team_code)))
  where team_code is not null and btrim(team_code) <> '';

create unique index if not exists schools_and_teams_name_key on public.schools_and_teams (name);

insert into public.schools_and_teams (id, name, mascot, level, division, region, city)
values
  ('a1000000-0000-4000-8000-000000000001', 'Westlake High', 'Thunder', 'high_school', 'High School', 'UT', 'Saratoga Springs'),
  ('a1000000-0000-4000-8000-000000000002', 'Lone Peak High', 'Knights', 'high_school', 'High School', 'UT', 'Highland'),
  ('a1000000-0000-4000-8000-000000000003', 'American Leadership Academy', 'Hawks', 'high_school', 'High School', 'UT', 'Spanish Fork'),
  ('a1000000-0000-4000-8000-000000000004', 'Skyridge High', 'Sentinels', 'high_school', 'High School', 'UT', 'Lehi'),
  ('a1000000-0000-4000-8000-000000000005', 'American Fork High', 'Cavemen', 'high_school', 'High School', 'UT', 'American Fork'),
  ('a1000000-0000-4000-8000-000000000006', 'Timpview High', 'Thunderbirds', 'high_school', 'High School', 'UT', 'Provo'),
  ('a1000000-0000-4000-8000-000000000011', 'BYU', 'Cougars', 'college', 'NCAA D1', 'Big 12', 'Provo'),
  ('a1000000-0000-4000-8000-000000000012', 'Utah', 'Utes', 'college', 'NCAA D1', 'Big 12', 'Salt Lake City'),
  ('a1000000-0000-4000-8000-000000000013', 'Utah State', 'Aggies', 'college', 'NCAA D1', 'Mountain West', 'Logan'),
  ('a1000000-0000-4000-8000-000000000014', 'Weber State', 'Wildcats', 'college', 'NCAA D1', 'Big Sky', 'Ogden')
on conflict (id) do update set
  name = excluded.name,
  mascot = excluded.mascot,
  level = excluded.level,
  division = excluded.division,
  region = excluded.region,
  city = excluded.city;

update public.schools_and_teams set team_code = 'WSTLK-2026' where id = 'a1000000-0000-4000-8000-000000000001' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'LPKHS-2026' where id = 'a1000000-0000-4000-8000-000000000002' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'ALAHS-2026' where id = 'a1000000-0000-4000-8000-000000000003' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'SKYRG-2026' where id = 'a1000000-0000-4000-8000-000000000004' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'AFORK-2026' where id = 'a1000000-0000-4000-8000-000000000005' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'TIMP-2026' where id = 'a1000000-0000-4000-8000-000000000006' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'BYU-2026' where id = 'a1000000-0000-4000-8000-000000000011' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'UTAH-2026' where id = 'a1000000-0000-4000-8000-000000000012' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'USU-2026' where id = 'a1000000-0000-4000-8000-000000000013' and coalesce(team_code, '') = '';
update public.schools_and_teams set team_code = 'WEBER-2026' where id = 'a1000000-0000-4000-8000-000000000014' and coalesce(team_code, '') = '';

alter table public.profiles add column if not exists school_id uuid references public.schools_and_teams (id) on delete set null;
alter table public.profiles add column if not exists athlete_division text;
alter table public.profiles add column if not exists athlete_sport text;
alter table public.profiles add column if not exists athlete_jersey text;
alter table public.profiles add column if not exists athlete_position text;
alter table public.profiles add column if not exists athlete_class_year text;

alter table public.schools_and_teams enable row level security;

drop policy if exists "Public read schools and teams" on public.schools_and_teams;
create policy "Public read schools and teams"
  on public.schools_and_teams for select
  using (true);

drop function if exists public.search_schools_and_teams(text);

create or replace function public.search_schools_and_teams(search_query text)
returns setof public.schools_and_teams
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := replace(replace(btrim(coalesce(search_query, '')), '%', ''), '_', '');
begin
  if length(needle) < 1 then
    return;
  end if;

  return query
  select s.*
  from public.schools_and_teams s
  where s.name ilike '%' || needle || '%'
     or s.mascot ilike '%' || needle || '%'
     or s.division ilike '%' || needle || '%'
     or s.region ilike '%' || needle || '%'
     or s.city ilike '%' || needle || '%'
  order by
    case when s.name ilike needle || '%' then 0 else 1 end,
    s.name
  limit 20;
end;
$$;

grant select on public.schools_and_teams to anon, authenticated;
grant execute on function public.search_schools_and_teams(text) to anon, authenticated;
