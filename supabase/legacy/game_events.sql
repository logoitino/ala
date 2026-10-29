-- Live game feed events. Run this in the Supabase SQL editor after players exists.
create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  event_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists game_events_created_at_idx on public.game_events (created_at desc);

alter table public.game_events enable row level security;

create policy "Anyone can read game_events"
  on public.game_events
  for select
  using (true);

create policy "Anyone can insert game_events"
  on public.game_events
  for insert
  with check (true);

grant select, insert on public.game_events to anon, authenticated;

alter table public.game_events alter column player_id drop not null;

alter publication supabase_realtime add table public.game_events;
