-- Direct shoutout / Q&A from exclusive subscribers. Safe to re-run.

create table if not exists public.subscriber_requests (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null,
  athlete_id uuid not null references public.players (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.subscriber_requests enable row level security;

drop policy if exists "Public read subscriber requests" on public.subscriber_requests;
create policy "Public read subscriber requests"
  on public.subscriber_requests for select
  using (true);

drop policy if exists "Public insert subscriber requests" on public.subscriber_requests;
create policy "Public insert subscriber requests"
  on public.subscriber_requests for insert
  with check (true);

grant select, insert on public.subscriber_requests to anon, authenticated;
