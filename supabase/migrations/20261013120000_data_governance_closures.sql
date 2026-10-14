-- Data governance closures (DATA-01, findings F1–F5): give every orphaned table and function a real
-- reader, writer or caller, and archive the one function nothing needs.
--
-- Purpose
--   F1  athlete_career_stats / athlete_game_logs were read on profiles but nothing in the app wrote them.
--       admin_upsert_athlete_career_stats, admin_add_athlete_game_log, admin_remove_athlete_game_log
--       are the writers (Athletes desk → Stats).
--   F2  crew_push_queue was filled by set_reel_flash_unlock and never read or cleared. Fans already read
--       their own rows (policy "Users read own crew push"); Activity now shows them, and
--       clear_my_crew_alerts() removes all of the caller's alerts and, as housekeeping, any alert older
--       than 30 days for anyone, so fans who never press Clear do not keep alerts forever.
--   F3  operator_checkins stored exact GPS that nothing read. PRIVACY_ENGINEERING decision 2026-10-13: there
--       is no current purpose (paid gigs are Wave 3) and operators may be minors, so keep as little as
--       possible: a before-insert trigger rounds location to two decimals (about 1 km) and sets the time on
--       the server, and check-ins older than 30 days are removed automatically (on every insert and every
--       admin read; no pg_cron needed). One function, expire_operator_checkins, holds the delete rule for the
--       trigger, admin_list_operator_checkins and admin_purge_operator_checkins (Live games desk, manual
--       purge with a 7-day floor). Direct table reads are closed (RLS_SECURITY review 2026-10-13): clients
--       keep INSERT only, through an insert-only policy that supersedes "Operators write checkins"
--       (20261002120000).
--   F4  admin_list_school_confirmers lets the Schools desk show confirmers (never the token hash) so the
--       existing admin_add / admin_revoke_school_confirmer and admin_set_school_branding get an admin
--       control; admin_revoke_verification and admin_set_custodial_terms get controls in People and
--       Athletes without SQL changes.
--   F5  get_aura_tier(integer) is never called (the app computes tiers in lib/aura). Archived: its
--       definition is kept in archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql and the function is dropped here.
--
-- Owner: DATA_GOVERNANCE (DATA-01), owner approval 2026-10-13 ("go all the way … archive as wanted").
--   Owners of each fix: ATHLETE_STATS (F1), NOTIFICATIONS (F2), OPERATOR + PRIVACY_ENGINEERING (F3),
--   SCHOOL_PARTNERS / ATHLETE_VERIFICATION / CUSTODIAL (F4), AURA (F5).
--
-- Security: every function is security definer with an empty search_path and schema-qualified names.
--   Admin functions call require_admin_guard() first; clear_my_crew_alerts clears the caller's rows and
--   alerts older than 30 days. EXECUTE is revoked from public and anon and granted to authenticated.
--   Table grants narrowed: operator_checkins loses client SELECT / UPDATE / DELETE (insert-only policy);
--   school_confirmers SELECT becomes column-level without token_hash (admins read through the RPC).
--
-- Safe to re-run: create or replace; drop function if exists.
--
-- Applied: written 2026-10-13, not applied anywhere.
--
-- Rollback:
--   drop function if exists public.admin_upsert_athlete_career_stats(uuid, text, integer, integer, integer, integer),
--     public.admin_add_athlete_game_log(uuid, date, text, text, integer, integer),
--     public.admin_remove_athlete_game_log(uuid), public.clear_my_crew_alerts(),
--     public.admin_list_operator_checkins(integer), public.admin_purge_operator_checkins(integer),
--     public.admin_list_school_confirmers(uuid);
--   drop trigger if exists operator_checkins_minimize on public.operator_checkins;
--   drop function if exists public.operator_checkins_minimize(), public.expire_operator_checkins(integer);
--   drop index if exists public.operator_checkins_checked_in_at_idx;
--   (rounded coordinates and check-ins already removed cannot be restored)
--   restore get_aura_tier from archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql;
--   grant select, insert on public.operator_checkins to anon, authenticated; drop policy "Operators insert checkins"
--   and re-run 20261002120000; grant select on public.school_confirmers to authenticated.
--   Before applying, confirm no hosted-only function calls get_aura_tier:
--   select proname from pg_proc where prosrc ilike '%get_aura_tier%';

do $$
begin
  if to_regprocedure('public.require_admin_guard()') is null then
    raise exception 'Apply the 2026-09 audit section of schema.sql first (require_admin_guard is missing).';
  end if;
end $$;

-- F1 ------------------------------------------------------------------------------------------

create or replace function public.admin_upsert_athlete_career_stats(
  p_player_id uuid,
  p_sport text,
  p_games_played integer,
  p_scoring_value integer,
  p_volume_value integer,
  p_mvp_badges integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Choose an athlete.';
  end if;
  if char_length(btrim(coalesce(p_sport, ''))) not between 2 and 40 then raise exception 'Name the sport.'; end if;
  if least(coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0)) < 0
     or greatest(coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0)) > 100000 then
    raise exception 'Stats must be between 0 and 100,000.';
  end if;
  insert into public.athlete_career_stats (player_id, sport, games_played, scoring_value, volume_value, mvp_badges, updated_at)
  values (p_player_id, btrim(p_sport), coalesce(p_games_played, 0), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0), coalesce(p_mvp_badges, 0), now())
  on conflict (player_id) do update set
    sport = excluded.sport, games_played = excluded.games_played, scoring_value = excluded.scoring_value,
    volume_value = excluded.volume_value, mvp_badges = excluded.mvp_badges, updated_at = now();
end;
$$;

create or replace function public.admin_add_athlete_game_log(
  p_player_id uuid,
  p_played_on date,
  p_opponent_school text,
  p_stat_line text,
  p_scoring_value integer,
  p_volume_value integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  log_id uuid;
begin
  perform public.require_admin_guard();
  if p_player_id is null or not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'Choose an athlete.';
  end if;
  if p_played_on is null or p_played_on > current_date or p_played_on < date '2000-01-01' then
    raise exception 'Choose the game date (not in the future).';
  end if;
  if char_length(coalesce(p_stat_line, '')) > 120 or char_length(coalesce(p_opponent_school, '')) > 120 then
    raise exception 'Keep the opponent and stat line under 120 characters.';
  end if;
  if least(coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0)) < 0 or greatest(coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0)) > 10000 then
    raise exception 'Game stats must be between 0 and 10,000.';
  end if;
  insert into public.athlete_game_logs (player_id, played_on, opponent_school, stat_line, scoring_value, volume_value)
  values (p_player_id, p_played_on, btrim(coalesce(p_opponent_school, '')), btrim(coalesce(p_stat_line, '')), coalesce(p_scoring_value, 0), coalesce(p_volume_value, 0))
  returning id into log_id;
  return log_id;
end;
$$;

-- Removing a mistaken game line is a correction an admin makes from the Athletes desk.
create or replace function public.admin_remove_athlete_game_log(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  delete from public.athlete_game_logs where id = p_log_id;
  if not found then raise exception 'That game line no longer exists.'; end if;
end;
$$;

-- F2 ------------------------------------------------------------------------------------------

create or replace function public.clear_my_crew_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleared integer;
begin
  if auth.uid() is null then raise exception 'Sign in to clear alerts.'; end if;
  delete from public.crew_push_queue where recipient_id = auth.uid();
  get diagnostics cleared = row_count;
  -- Housekeeping: nobody's alerts outlive 30 days, including fans who never press Clear.
  delete from public.crew_push_queue where created_at < now() - interval '30 days';
  return cleared;
end;
$$;

-- F3 ------------------------------------------------------------------------------------------

-- The one retention rule. Never shorter than 7 days, so a mistyped purge cannot wipe today's check-ins.
create or replace function public.expire_operator_checkins(p_older_than_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged integer;
begin
  delete from public.operator_checkins
  where checked_in_at < now() - make_interval(days => greatest(coalesce(p_older_than_days, 30), 7));
  get diagnostics purged = row_count;
  return purged;
end;
$$;

-- Exact GPS never reaches storage, a client cannot pick a timestamp that dodges expiry, and every insert
-- clears expired rows.
create or replace function public.operator_checkins_minimize()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.latitude := round(new.latitude::numeric, 2)::double precision;
  new.longitude := round(new.longitude::numeric, 2)::double precision;
  new.checked_in_at := now();
  perform public.expire_operator_checkins();
  return new;
end;
$$;

drop trigger if exists operator_checkins_minimize on public.operator_checkins;
create trigger operator_checkins_minimize
  before insert on public.operator_checkins
  for each row execute function public.operator_checkins_minimize();

create index if not exists operator_checkins_checked_in_at_idx on public.operator_checkins (checked_in_at);

-- Rows stored before this migration get the same treatment.
update public.operator_checkins
set latitude = round(latitude::numeric, 2)::double precision,
  longitude = round(longitude::numeric, 2)::double precision,
  checked_in_at = least(checked_in_at, now());
select public.expire_operator_checkins();

-- Reading also expires, so old check-ins are gone even when no new ones arrive.
create or replace function public.admin_list_operator_checkins(p_limit integer default 50)
returns table (id uuid, gig_id uuid, checked_in_at timestamptz, latitude_approx numeric, longitude_approx numeric)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  perform public.expire_operator_checkins();
  return query
    select c.id, c.gig_id, c.checked_in_at,
      round(c.latitude::numeric, 2), round(c.longitude::numeric, 2)
    from public.operator_checkins c
    order by c.checked_in_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create or replace function public.admin_purge_operator_checkins(p_older_than_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  if coalesce(p_older_than_days, 0) < 7 then raise exception 'Keep at least 7 days of check-ins.'; end if;
  return public.expire_operator_checkins(p_older_than_days);
end;
$$;

-- Exact coordinates are readable by no client: INSERT stays (operator PIN / operator / admin), reads go
-- through admin_list_operator_checkins only.
revoke select, update, delete on public.operator_checkins from anon, authenticated;
drop policy if exists "Operators write checkins" on public.operator_checkins;
drop policy if exists "Operators insert checkins" on public.operator_checkins;
create policy "Operators insert checkins" on public.operator_checkins
  for insert to anon, authenticated
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));

-- F4 ------------------------------------------------------------------------------------------

-- Admins read confirmers through admin_list_school_confirmers; the table grant no longer includes the
-- token hash.
revoke select on public.school_confirmers from authenticated;
grant select (id, school_id, full_name, email, staff_role, sport, active, expires_at, created_by, created_at, last_used_at)
  on public.school_confirmers to authenticated;

-- Confirmers for one school, without the token hash.
create or replace function public.admin_list_school_confirmers(target_school_id uuid)
returns table (id uuid, full_name text, email text, staff_role text, sport text, active boolean, expires_at timestamptz, last_used_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin_guard();
  return query
    select c.id, c.full_name, c.email, c.staff_role, c.sport, c.active, c.expires_at, c.last_used_at
    from public.school_confirmers c
    where c.school_id = target_school_id
    order by c.active desc, c.created_at desc;
end;
$$;

-- F5 ------------------------------------------------------------------------------------------

drop function if exists public.get_aura_tier(integer);

-- Grants --------------------------------------------------------------------------------------

revoke all on function public.admin_upsert_athlete_career_stats(uuid, text, integer, integer, integer, integer) from public, anon;
revoke all on function public.admin_add_athlete_game_log(uuid, date, text, text, integer, integer) from public, anon;
revoke all on function public.admin_remove_athlete_game_log(uuid) from public, anon;
revoke all on function public.clear_my_crew_alerts() from public, anon;
revoke all on function public.admin_list_operator_checkins(integer) from public, anon;
revoke all on function public.admin_purge_operator_checkins(integer) from public, anon;
revoke all on function public.admin_list_school_confirmers(uuid) from public, anon;
-- Internal: only the trigger and the two admin functions above call these; no client may.
revoke all on function public.expire_operator_checkins(integer) from public, anon, authenticated;
revoke all on function public.operator_checkins_minimize() from public, anon, authenticated;
grant execute on function public.admin_upsert_athlete_career_stats(uuid, text, integer, integer, integer, integer) to authenticated;
grant execute on function public.admin_add_athlete_game_log(uuid, date, text, text, integer, integer) to authenticated;
grant execute on function public.admin_remove_athlete_game_log(uuid) to authenticated;
grant execute on function public.clear_my_crew_alerts() to authenticated;
grant execute on function public.admin_list_operator_checkins(integer) to authenticated;
grant execute on function public.admin_purge_operator_checkins(integer) to authenticated;
grant execute on function public.admin_list_school_confirmers(uuid) to authenticated;
