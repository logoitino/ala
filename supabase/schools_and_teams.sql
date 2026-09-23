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

-- 2026-09 audit (Round 13 sweep): removed — this was a third copy of the exact hardcoded-secret
-- bug fixed in apps/mobile/src/backend/db/schema.sql and supabase/athlete_verification.sql (Round
-- 12), missed in that pass because it's a separate standalone incremental. Never hardcode a real
-- school's `redeem_team_code` secret in a committed file; set it via the Supabase SQL Editor
-- directly and hand it to the coach out-of-band.

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

-- 2026-09 audit (Round 13 sweep, critical): `team_code` is the Varsity-verification secret
-- (`redeem_team_code`) — was `returns setof public.schools_and_teams` / `select s.*`, and since this
-- is SECURITY DEFINER it leaked every school's code to anon regardless of the table grant. Explicit
-- column list, no `team_code`.
create or replace function public.search_schools_and_teams(search_query text)
returns table (
  id uuid,
  name text,
  mascot text,
  level text,
  division text,
  region text,
  city text,
  created_at timestamptz,
  malo_frozen boolean
)
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
  select s.id, s.name, s.mascot, s.level, s.division, s.region, s.city, s.created_at, s.malo_frozen
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

-- 2026-09 audit (Round 13 sweep): column-level grant, not the whole table — see schema.sql for the
-- full explanation (this REVOKE matters: GRANT is additive, not a replacement, on a project that
-- already ran the old blanket grant).
revoke select on public.schools_and_teams from anon, authenticated;
grant select (id, name, mascot, level, division, region, city, created_at, malo_frozen)
  on public.schools_and_teams to anon, authenticated;
grant execute on function public.search_schools_and_teams(text) to anon, authenticated;
