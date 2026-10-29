-- Optional seed schema for the Tapua'i players table.
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  jersey_number integer not null,
  position text not null,
  height text not null,
  school_name text not null,
  backer_count integer not null default 0
);

alter table public.players enable row level security;

create policy "Anyone can read players"
  on public.players
  for select
  using (true);

grant select on public.players to anon, authenticated;

insert into public.players (name, jersey_number, position, height, school_name, backer_count)
values
  ('Marcus Rivera', 7, 'Quarterback', '6''2"', 'ALA Hawks', 14),
  ('Jordan Blake', 21, 'Running Back', '5''11"', 'ALA Hawks', 9),
  ('Tyler Nguyen', 88, 'Wide Receiver', '6''1"', 'ALA Hawks', 22),
  ('Derek Sullivan', 54, 'Linebacker', '6''3"', 'ALA Hawks', 11),
  ('Andre Coleman', 99, 'Defensive End', '6''4"', 'ALA Hawks', 17);
