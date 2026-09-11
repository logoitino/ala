-- Games discovery + live scores. Run after players exists.
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  home_school text not null,
  away_school text not null,
  home_score integer not null default 0,
  away_score integer not null default 0,
  status text not null default 'Q1',
  venue text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "Anyone can read games"
  on public.games
  for select
  using (true);

create policy "Anyone can update games"
  on public.games
  for update
  using (true)
  with check (true);

grant select, update on public.games to anon, authenticated;

alter table public.game_events
  add column if not exists game_id uuid references public.games (id) on delete set null;

do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
end $$;

insert into public.games (
  home_team, away_team, home_school, away_school, home_score, away_score, status, venue, is_active
)
values
  ('Westlake', 'Lone Peak', 'Westlake High', 'Lone Peak High', 14, 10, 'Q2', 'Westlake Stadium', true),
  ('ALA Hawks', 'Skyridge', 'American Leadership Academy', 'Skyridge High', 21, 17, 'Q3', 'Hawks Field', true),
  ('Timpview', 'American Fork', 'Timpview High', 'American Fork High', 0, 0, 'Q1', 'Timpview Stadium', true);
