-- SCALE-03 · Live score Broadcast (2026-10-18). Written locally, NOT applied anywhere.
--
-- Purpose: stop the game-night refetch storm (HOSTING_DECISION_BRIEF §7 item 5). Today `useLiveScores` listens to
-- `postgres_changes` on every `games` row and rereads the whole list on any change, so every fan rereads every game
-- on every score. After this file, each scoreboard change is sent once on a private per-game Broadcast topic
-- (`game_scores_{id}`) carrying only the changed columns and a per-game sequence number; game add / remove /
-- active flips go to `game_scores_index` so the list rereads only then.
--
-- What it adds:
--   1. `games.live_seq bigint` — bumped by a BEFORE trigger only when a scoreboard column changes, so a client can
--      drop duplicates / older messages and detect a missed one (gap → reread). Clients cannot set it.
--   2. AFTER trigger `games_broadcast_score_change` → `realtime.send(..., private => true)`. Payload
--      `{v:1, id, seq, changes:{<changed scoreboard columns>}}`, event `score`. `claimed_by` and other columns are
--      never sent. Membership payload `{v:1, id, op:'insert'|'delete'|'active'}`, event `membership`.
--      A failed send never blocks the score update (warning only).
--   3. `realtime.messages` SELECT policy: anon + authenticated may receive Broadcast on exactly
--      `game_scores_<uuid>` and `game_scores_index` (the same people who can already read `games`: "Public read
--      games" is `using (true)`). No INSERT policy is added, so no client can send on these topics; only the
--      definer trigger writes them. Presence is not allowed (extension must be 'broadcast').
--
-- Client: `apps/mobile/src/frontend/lib/liveScoreSync.ts`. The app uses these topics only when the build sets
-- `EXPO_PUBLIC_LIVE_SCORES_BROADCAST=true`; if the policy is missing it falls back to today's path on its own.
-- Apply order: after every earlier file (needs `games.sport` and `games.is_active`). Staging first.
--
-- Rollback (safe at any time; turn the app switch off first):
--   drop trigger if exists games_broadcast_score_change on public.games;
--   drop trigger if exists games_live_seq_bump on public.games;
--   drop function if exists public.games_broadcast_score_change();
--   drop function if exists public.games_live_seq_bump();
--   drop policy if exists "Fans receive game score changes" on realtime.messages;
--   -- optional, only once no build reads it: alter table public.games drop column if exists live_seq;

alter table public.games add column if not exists live_seq bigint not null default 0;

-- Clients (operator console, admin desk) write `games` directly; this keeps `live_seq` server-owned and moves it only
-- when something a fan sees changes, so the AFTER trigger and the client agree on "one change = one number".
create or replace function public.games_live_seq_bump()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.live_seq := 0;
    return new;
  end if;
  if (new.home_score, new.away_score, new.quarter, new.status, new.clock, new.is_clock_running, new.is_active,
      new.home_team, new.away_team, new.home_school, new.away_school, new.venue, new.sport)
     is distinct from
     (old.home_score, old.away_score, old.quarter, old.status, old.clock, old.is_clock_running, old.is_active,
      old.home_team, old.away_team, old.home_school, old.away_school, old.venue, old.sport) then
    new.live_seq := coalesce(old.live_seq, 0) + 1;
  else
    new.live_seq := old.live_seq;
  end if;
  return new;
end;
$$;

drop trigger if exists games_live_seq_bump on public.games;
create trigger games_live_seq_bump
  before insert or update on public.games
  for each row execute function public.games_live_seq_bump();

-- Security definer: `realtime.send` writes `realtime.messages`, which clients may not insert into on these topics.
-- Same pattern as Supabase's documented Broadcast-from-database triggers.
create or replace function public.games_broadcast_score_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fields constant text[] := array['home_score', 'away_score', 'quarter', 'status', 'clock', 'is_clock_running',
    'is_active', 'home_team', 'away_team', 'home_school', 'away_school', 'venue', 'sport', 'updated_at'];
  field text;
  next_row jsonb;
  prev_row jsonb;
  changes jsonb := '{}'::jsonb;
begin
  begin
    if tg_op = 'UPDATE' then
      if new.live_seq is not distinct from old.live_seq then
        return null; -- e.g. a claimed_by-only update: nothing a fan sees changed
      end if;
      next_row := to_jsonb(new);
      prev_row := to_jsonb(old);
      foreach field in array fields loop
        if next_row -> field is distinct from prev_row -> field then
          changes := changes || jsonb_build_object(field, next_row -> field);
        end if;
      end loop;
      perform realtime.send(
        jsonb_build_object('v', 1, 'id', new.id, 'seq', new.live_seq, 'changes', changes),
        'score', 'game_scores_' || new.id::text, true);
      if new.is_active is distinct from old.is_active then
        perform realtime.send(jsonb_build_object('v', 1, 'id', new.id, 'op', 'active'),
          'membership', 'game_scores_index', true);
      end if;
    elsif tg_op = 'INSERT' then
      perform realtime.send(jsonb_build_object('v', 1, 'id', new.id, 'op', 'insert'),
        'membership', 'game_scores_index', true);
    elsif tg_op = 'DELETE' then
      perform realtime.send(jsonb_build_object('v', 1, 'id', old.id, 'op', 'delete'),
        'membership', 'game_scores_index', true);
    end if;
  exception when others then
    -- A scoreboard update must never fail because Realtime could not take the message; fans reread on reconnect.
    raise warning 'games_broadcast_score_change: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

drop trigger if exists games_broadcast_score_change on public.games;
create trigger games_broadcast_score_change
  after insert or update or delete on public.games
  for each row execute function public.games_broadcast_score_change();

-- Trigger functions are never RPCs; keep them off the API roles (Supabase default privileges grant EXECUTE).
revoke all on function public.games_live_seq_bump() from public, anon, authenticated;
revoke all on function public.games_broadcast_score_change() from public, anon, authenticated;

-- Receive-only, exact topic shapes. `realtime.messages` already has RLS on (platform-owned; do not alter it).
drop policy if exists "Fans receive game score changes" on realtime.messages;
create policy "Fans receive game score changes"
  on realtime.messages for select
  to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() ~ '^game_scores_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|index)$'
  );
