-- Direct shoutout / Q&A from exclusive subscribers. Safe to re-run.

create table if not exists public.subscriber_requests (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null,
  athlete_id uuid not null references public.players (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.subscriber_requests enable row level security;

-- 2026-09 audit: `body` is private message text — SELECT is scoped to the sender (their own Q&A
-- history), the receiving athlete (via `profiles.player_id = subscriber_requests.athlete_id`), or
-- admin. INSERT requires the caller to insert as themself.
drop policy if exists "Public read subscriber requests" on public.subscriber_requests;
drop policy if exists "Read own or received subscriber requests" on public.subscriber_requests;
create policy "Read own or received subscriber requests"
  on public.subscriber_requests for select
  using (
    auth.uid() = subscriber_id
    or exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and pr.player_id = subscriber_requests.athlete_id
    )
    or public.current_user_role() = 'admin'
  );

drop policy if exists "Public insert subscriber requests" on public.subscriber_requests;
drop policy if exists "Insert own subscriber requests" on public.subscriber_requests;
create policy "Insert own subscriber requests"
  on public.subscriber_requests for insert
  with check (auth.uid() = subscriber_id);

grant select, insert on public.subscriber_requests to authenticated;
revoke select, insert on public.subscriber_requests from anon;
