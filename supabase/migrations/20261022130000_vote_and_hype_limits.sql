-- One cheer vote per account per poll; one hype per account per player per kind per day (STATE §5 hole 4,
-- WORK_QUEUE DATA-01-F11).
--
-- Threat: cast_cheer_vote and increment_player_hype were guest-callable with no limit, and cast_cheer_vote trusted
-- the caller's previous_side, so one script could add a vote to one side and remove one from the other per call, and
-- inflate player hype that feeds Spotlight. A client-sent device id is forgeable, so the limit is the signed-in account.
-- Both stay security definer and keep their signatures and return shape; previous_side is now ignored (the server
-- remembers each account's side). Votes lock the poll row, so concurrent calls from one account cannot double count;
-- hype uses the vote row's primary key, so a repeat the same day is a no-op.
--
-- Applied: staging and development 2026-10-22 (Claude Code). Replay: scripts/replay/vote-limits-replay.mjs.
-- Rollback: drop table public.cheer_poll_votes, public.player_hype_votes; re-create both functions from schema.sql
-- before this file and grant execute on them to anon again.

create table if not exists public.cheer_poll_votes (
  poll_slug text not null references public.cheer_polls (slug) on delete cascade,
  voter_id uuid not null,
  side text not null check (side in ('home', 'away')),
  updated_at timestamptz not null default now(),
  primary key (poll_slug, voter_id)
);
create table if not exists public.player_hype_votes (
  voter_id uuid not null,
  player_id uuid not null references public.players (id) on delete cascade,
  hype_kind text not null check (hype_kind in ('view', 'aura', 'flex', 'seki')),
  voted_on date not null default (timezone('utc', now()))::date,
  primary key (voter_id, player_id, hype_kind, voted_on)
);
-- Only the two definer functions touch these rows; clients get no direct access.
alter table public.cheer_poll_votes enable row level security;
alter table public.player_hype_votes enable row level security;
revoke all on public.cheer_poll_votes, public.player_hype_votes from public, anon, authenticated;

create or replace function public.cast_cheer_vote(
  poll_slug text,
  side text,
  previous_side text default null,
  home_name text default 'Westlake Thunder',
  away_name text default 'Lone Peak Knights'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  voter uuid := auth.uid();
  prior text;
  result public.cheer_polls%rowtype;
begin
  if voter is null then
    raise exception 'Sign in to cheer' using errcode = '42501';
  end if;
  if side not in ('home', 'away') then
    raise exception 'Invalid cheer side %', side;
  end if;

  insert into public.cheer_polls (slug, home_label, away_label, home_votes, away_votes)
  values (poll_slug, coalesce(nullif(btrim(home_name), ''), 'Westlake Thunder'),
    coalesce(nullif(btrim(away_name), ''), 'Lone Peak Knights'), 0, 0)
  on conflict (slug) do nothing;
  -- Serialise votes on this poll so one account's concurrent calls see each other's stored side.
  select * into result from public.cheer_polls where slug = poll_slug for update;

  select v.side into prior from public.cheer_poll_votes v where v.poll_slug = cast_cheer_vote.poll_slug and v.voter_id = voter;
  if prior is distinct from side then
    insert into public.cheer_poll_votes (poll_slug, voter_id, side) values (cast_cheer_vote.poll_slug, voter, side)
    on conflict on constraint cheer_poll_votes_pkey do update set side = excluded.side, updated_at = now();
    update public.cheer_polls
    set home_votes = greatest(home_votes + (case when side = 'home' then 1 else 0 end) - (case when prior = 'home' then 1 else 0 end), 0),
        away_votes = greatest(away_votes + (case when side = 'away' then 1 else 0 end) - (case when prior = 'away' then 1 else 0 end), 0),
        updated_at = now()
    where slug = poll_slug
    returning * into result;
  end if;

  return jsonb_build_object('home_votes', coalesce(result.home_votes, 0), 'away_votes', coalesce(result.away_votes, 0));
end;
$$;

create or replace function public.increment_player_hype(target_player_id uuid, hype_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  voter uuid := auth.uid();
  added integer;
  result public.players%rowtype;
begin
  if voter is null then
    raise exception 'Sign in to hype' using errcode = '42501';
  end if;
  if hype_kind not in ('view', 'aura', 'flex', 'seki') then
    raise exception 'Unknown hype_kind %', hype_kind;
  end if;

  insert into public.player_hype_votes (voter_id, player_id, hype_kind) values (voter, target_player_id, hype_kind)
  on conflict do nothing;
  get diagnostics added = row_count;

  update public.players
  set view_count = coalesce(view_count, 0) + (case when added = 1 and hype_kind = 'view' then 1 else 0 end),
      aura_count = coalesce(aura_count, 0) + (case when added = 1 and hype_kind = 'aura' then 1 else 0 end),
      flex_count = coalesce(flex_count, 0) + (case when added = 1 and hype_kind = 'flex' then 1 else 0 end),
      seki_count = coalesce(seki_count, 0) + (case when added = 1 and hype_kind = 'seki' then 1 else 0 end)
  where id = target_player_id
  returning * into result;

  return jsonb_build_object('view_count', coalesce(result.view_count, 0), 'aura_count', coalesce(result.aura_count, 0),
    'flex_count', coalesce(result.flex_count, 0), 'seki_count', coalesce(result.seki_count, 0));
end;
$$;

revoke all on function public.cast_cheer_vote(text, text, text, text, text) from public, anon;
revoke all on function public.increment_player_hype(uuid, text) from public, anon;
grant execute on function public.cast_cheer_vote(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.increment_player_hype(uuid, text) to authenticated, service_role;
