-- Function access hardening (DATA-01 schema replay finding, 2026-10-13; RLS_SECURITY reviewed).
--
-- Purpose
--   A replay of the whole schema.sql on an empty Postgres (scripts/replay/schema-replay.mjs) checked who can call
--   what. It found:
--   1. Books integrity: record_company_revenue and sync_company_revenue_logs had EXECUTE revoked from anon and
--      authenticated but not from PUBLIC, so any guest with the public key could write a revenue row into
--      company_revenue_logs (proved in the replay). increment_reel_tips, add_user_aura and increment_backer_count (donation
--      totals, Aura, backer counts) were open to guests the same way (backer count only ever granted authenticated,
--      never revoked from anon, which hosted Supabase grants by default), as did publish_spotlight_award and upsert_cheer_poll (those two check
--      the caller's role inside, so tidy-up only).
--   2. Admin-desk functions open to guests: triage_app_feedback, upsert_sport_config and delete_sport_config were
--      granted to anon and checked nothing. Only the admin desks (signed-in admins) call them.
--   3. "No claims" counted as the database: is_admin_or_db() treated a missing JWT role as the SQL Editor, so a
--      request running as anon with no claims passed it, and four verification-ladder admin functions
--      (20260929120000) were still executable by anon. Caps that test `auth.role() <> 'service_role'` read NULL
--      for such a request and were skipped (add_user_aura 5,000-point cap, update_game_score claimed-game check,
--      chip_in_wishlist_item cap, the Stripe-fields guard), and the profile role-escalation trigger returned early.
--      Whether the hosted gateway ever forwards a claimless request is not verified; this closes it either way.
--
-- Changes
--   - is_trusted_server(): the one test for "the server, not a client": service_role, or a session with no JWT
--     role that did not switch to anon / authenticated (the SQL Editor; PostgREST always switches). Always true or
--     false. The role setting survives inside security definer functions, where current_user is the owner.
--   - is_admin_or_db() = is_trusted_server() or an admin. The caps above use not is_trusted_server(); the
--     escalation trigger skips only for a true database session.
--   - The three admin-desk functions require is_admin_or_db() and are no longer granted to anon.
--   - PUBLIC / anon EXECUTE removed where listed; authenticated keeps what the app calls; service_role is granted every
--     narrowed function explicitly (RLS_SECURITY: a CHECK runs its function as the writing role, so the Stripe
--     webhook's tip insert needs EXECUTE on is_trusted_server).
--   - The five amount / Aura cap CHECK constraints on tips, sponsorships and shop_orders read
--     `auth.role() = 'service_role' or …`, which passes on NULL; they now use is_trusted_server(). Added NOT VALID:
--     existing rows were accepted under the old rule and are not re-judged; every new row is.
--   Not changed: update_game_score stays anon-executable for the operator PIN (STATE §5, accepted for internal
--   testing).
--
-- Owner: RLS_SECURITY (review), DATA_GOVERNANCE (finding); function owners LEDGER (revenue), ATHLETE_VERIFICATION /
--   SCHOOL_PARTNERS (ladder), AURA, OPERATOR, COMMERCE (wishlist), ADMIN (feedback, sports).
-- Safe to re-run: create or replace; grants are idempotent; revokes skip functions this database lacks
--   (development lacks the verification ladder and other September SQL).
-- Applied: written 2026-10-13, not applied anywhere. Apply FIRST on staging; independent of the other 2026-10-13
--   files. Function bodies below are the current schema.sql definitions with only the marked lines changed.
-- Rollback: re-run each function's previous definition from schema.sql history and restore the old grants
--   (not recommended: it reopens the books write).

create or replace function public.is_trusted_server()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false)
    or (auth.role() is null and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('anon', 'authenticated'));
$$;

create or replace function public.is_admin_or_db()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Always true or false: a NULL would read as "not refused" in callers' `if not public.is_admin_or_db()`.
  select public.is_trusted_server() or coalesce(public.current_user_role() = 'admin', false);
$$;

-- Bodies: current definitions; changed lines use is_trusted_server() / is_admin_or_db().

create or replace function public.add_user_aura(target_user_id uuid, points_to_add integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  add_points integer;
  player_total integer;
  profile_total integer;
begin
  add_points := greatest(coalesce(points_to_add, 0), 0);

  -- SECURITY TRADEOFF (2026-09 audit item 1/4): this RPC is called for BOTH the tipper
  -- (self-Aura) and the athlete recipient right after a real tip (see useTipCheckout.ts),
  -- so a strict `auth.uid() = target_user_id` ownership check would break the "award the
  -- athlete too" half. Postgres/RLS alone cannot verify a real Stripe charge happened —
  -- that verification now lives in supabase/functions/stripe-webhook/index.ts, which writes
  -- Aura directly (as service_role, exempt below) once a charge is confirmed. Until every
  -- caller is migrated to trust that webhook instead of calling this RPC client-side, cap the
  -- client-facing path so a compromised/scripted client can fabricate at most a small amount
  -- of Aura per call rather than an unbounded amount. This is a stopgap, not a fix.
  if not public.is_trusted_server() and add_points > 5000 then
    raise exception 'points_to_add exceeds the per-call limit (5000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this RPC is called both for the tipper's own
  -- Fan Aura (target_user_id = auth user id) and for the athlete recipient's Athlete Aura
  -- (target_user_id = players.id) — see useTipCheckout.ts. `malo_target_frozen` only matches a
  -- `profiles` row keyed by `player_id = target_user_id`, so this is a no-op (false) for a tipper's
  -- own auth/profile id and only blocks the case that actually matters: awarding Aura to a frozen
  -- athlete. Applies to every caller (checkout, reel double-tap, wishlist chip-in), not service_role
  -- exempt, since the freeze must be a hard block regardless of caller.
  if public.malo_target_frozen(target_user_id) then
    raise exception 'Mālo is frozen for this athlete; Aura cannot be added.';
  end if;

  update public.players
  set aura_points = coalesce(aura_points, 0) + add_points
  where id = target_user_id
  returning aura_points into player_total;

  update public.profiles
  set aura_points = coalesce(aura_points, 0) + add_points
  where user_id = target_user_id or id = target_user_id
  returning aura_points into profile_total;

  return jsonb_build_object(
    'aura_points', coalesce(player_total, profile_total, add_points),
    'player_aura_points', player_total,
    'profile_aura_points', profile_total,
    'points_added', add_points
  );
end;
$$;

create or replace function public.update_game_score(
  target_game_id uuid,
  home_delta integer default 0,
  away_delta integer default 0,
  set_clock_running boolean default null,
  set_clock text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.games%rowtype;
begin
  -- 2026-09 audit item 12: this is SECURITY DEFINER, so it bypasses the "Operators update games"
  -- RLS policy's claimed_by-narrowing entirely — and it's the operator console's PRIMARY score
  -- path (`updateGameScore` in lib/operator.ts calls this RPC before falling back to a direct
  -- table UPDATE), so leaving this function unconditional would make that RLS narrowing mostly
  -- cosmetic. Same stopgap here: an anon caller may only update a game that is still unclaimed.
  if public.current_user_role() not in ('operator', 'admin') and not public.is_trusted_server() then
    if exists (select 1 from public.games where id = target_game_id and claimed_by is not null) then
      raise exception 'This game has been claimed by another operator.';
    end if;
  end if;

  update public.games
  set
    home_score = greatest(coalesce(home_score, 0) + coalesce(home_delta, 0), 0),
    away_score = greatest(coalesce(away_score, 0) + coalesce(away_delta, 0), 0),
    is_clock_running = coalesce(set_clock_running, is_clock_running),
    clock = coalesce(nullif(btrim(coalesce(set_clock, '')), ''), clock),
    updated_at = now()
  where id = target_game_id
  returning * into result;

  if result.id is null then
    raise exception 'Game % not found', target_game_id;
  end if;

  return jsonb_build_object(
    'id', result.id,
    'home_score', result.home_score,
    'away_score', result.away_score,
    'clock', result.clock,
    'is_clock_running', result.is_clock_running,
    'claimed_by', result.claimed_by,
    'quarter', result.quarter,
    'status', result.status
  );
end;
$$;

create or replace function public.chip_in_wishlist_item(item_id uuid, amount_cents integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  add_cents integer := greatest(coalesce(amount_cents, 0), 0);
  equip_aura constant integer := 500;
  row_after public.wishlist_items;
  newly_equipped boolean := false;
  awarded integer := 0;
  aura_result jsonb;
  target_player uuid;
begin
  -- The per-gift ledger is the `tips` row `useTipCheckout` inserts before this call
  -- (`origin = wishlist`, `wishlist_item_id`, `source_label` = the item title). This RPC only
  -- moves the item aggregate, so it must not insert a second `tips` row.
  -- SECURITY TRADEOFF (2026-09 audit item 5): there is still no payer column on `wishlist_items`
  -- itself. Execute is `authenticated`-only and a per-call cap stands in until a Stripe charge
  -- is verified the same way supabase/functions/stripe-webhook/index.ts will eventually verify tips.
  if not public.is_trusted_server() and add_cents > 100000 then
    raise exception 'amount_cents exceeds the per-call limit (100000)';
  end if;

  -- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): this is a Mālo contribution too (see the
  -- doc comment above) — block it the same way `tips` INSERT does, before the aggregate even moves,
  -- not only at the equip/+500 Aura step below (add_user_aura's own check would catch that step,
  -- but not a below-target contribution that never reaches it).
  select player_id into target_player from public.wishlist_items where id = item_id;
  if target_player is not null and public.malo_target_frozen(target_player) then
    raise exception 'Mālo is frozen for this athlete; wishlist contributions are disabled.';
  end if;

  update public.wishlist_items
  set
    current_amount_cents = current_amount_cents + add_cents,
    updated_at = timezone('utc', now())
  where id = item_id
  returning * into row_after;

  if row_after.id is null then
    raise exception 'Wishlist item not found.';
  end if;

  if row_after.target_amount_cents > 0
    and row_after.current_amount_cents >= row_after.target_amount_cents
    and not row_after.aura_awarded
  then
    update public.wishlist_items
    set
      is_equipped = true,
      equipped_at = timezone('utc', now()),
      aura_awarded = true,
      updated_at = timezone('utc', now())
    where id = item_id
    returning * into row_after;

    newly_equipped := true;
    awarded := equip_aura;

    if row_after.player_id is not null then
      aura_result := public.add_user_aura(row_after.player_id, equip_aura);
    end if;
  end if;

  return jsonb_build_object(
    'item', to_jsonb(row_after),
    'newly_equipped', newly_equipped,
    'aura_points', awarded,
    'athlete_aura_points', (aura_result ->> 'aura_points')::integer
  );
end;
$$;

create or replace function public.guard_profiles_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  privileged_roles constant text[] := array['admin', 'booster', 'operator', 'parent', 'sponsor'];
  new_roles_set text[];
  old_roles_set text[];
  gained text[];
begin
  if auth.role() is null and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('anon', 'authenticated') then
    return new;
  end if;

  new_roles_set := coalesce(new.roles, array[]::text[])
    || array[new.role]
    || case when coalesce(new.is_admin, false) then array['admin'] else array[]::text[] end;

  if tg_op = 'INSERT' then
    old_roles_set := array[]::text[];
  else
    old_roles_set := coalesce(old.roles, array[]::text[])
      || array[old.role]
      || case when coalesce(old.is_admin, false) then array['admin'] else array[]::text[] end;
  end if;

  select coalesce(array_agg(r), array[]::text[])
  into gained
  from unnest(privileged_roles) as r
  where r = any (new_roles_set) and not (r = any (old_roles_set));

  if array_length(gained, 1) > 0 and public.current_user_role() <> 'admin' then
    raise exception 'these roles can only be granted by an existing admin: %', array_to_string(gained, ', ');
  end if;

  -- 2026-09 audit (Round 29 sweep): same root cause as the role-escalation gap above, different
  -- column. `set_malo_freeze`'s own comment claimed it was "the ONLY way" to flip `malo_frozen`
  -- because no *extra* table grant was added for it — but `profiles` already has a blanket
  -- `grant ... update` with no column restriction, so that reasoning never actually held. A frozen
  -- account (a real compliance/legal action per LEGAL_BRIEFING.md §8 item 5) could self-unfreeze
  -- with a raw `update profiles set malo_frozen = false where user_id = auth.uid()`, bypassing the
  -- admin-only RPC entirely and defeating the freeze's whole purpose. Guarding it the same way as
  -- the role columns: only an admin session may change it.
  if (
    (tg_op = 'INSERT' and coalesce(new.malo_frozen, false))
    or (tg_op = 'UPDATE' and new.malo_frozen is distinct from old.malo_frozen)
  ) and public.current_user_role() <> 'admin' then
    raise exception 'malo_frozen can only be changed by an admin';
  end if;

  -- 2026-09 audit (Round 30 sweep): same root cause again, a third time. `createPayout.ts` and
  -- `create-stripe-account`'s own doc comments both say the payout destination is "resolved
  -- server-side from `profiles.stripe_connect_id`, never a client-supplied account id" — but that
  -- claim only held for the app's own client code, which never happened to write these columns
  -- directly. Nothing stopped a raw REST call: `profiles`' blanket update grant covers
  -- `stripe_connect_id` / `payouts_enabled` / `stripe_onboarding_complete` same as everything else,
  -- so any signed-in user could self-set `payouts_enabled = true` and `stripe_connect_id` to an
  -- arbitrary string (their own real Connect id, someone else's if ever discoverable, or garbage)
  -- with zero real Stripe onboarding. Harmless today only because Round 23 already hard-blocks every
  -- real transfer regardless of these flags — but the entire "destination resolved server-side, never
  -- trust the client" security property this system is documented to rely on would be false the
  -- moment that block is lifted, undermining the point of building a balance ledger at all. `auth.role()
  -- = 'service_role'` is exempted so the `create-stripe-account` Edge Function (which legitimately
  -- writes these with the service key, and has no admin session to satisfy `current_user_role()`)
  -- keeps working.
  if (
    (tg_op = 'INSERT' and (
      new.stripe_connect_id is not null
      or coalesce(new.payouts_enabled, false)
      or coalesce(new.stripe_onboarding_complete, false)
    ))
    or (tg_op = 'UPDATE' and (
      new.stripe_connect_id is distinct from old.stripe_connect_id
      or new.payouts_enabled is distinct from old.payouts_enabled
      or new.stripe_onboarding_complete is distinct from old.stripe_onboarding_complete
    ))
  ) and not public.is_trusted_server() and public.current_user_role() <> 'admin' then
    raise exception 'Stripe Connect fields can only be set by the server';
  end if;

  -- 2026-09 audit (Round 31/33 follow-up): `team_code_fail_count`/`team_code_locked_until` are
  -- `redeem_team_code`'s anti-brute-force lockout state (Round 12). Unlike the columns above, the
  -- one legitimate writer runs as the *calling user's own session*, not admin/service_role, so this
  -- can't just check `current_user_role()`. `redeem_team_code` sets a transaction-local flag
  -- (`app.tapuai_team_code_write`) immediately before its own writes to these columns; a raw client
  -- update attempting the same reset has no way to set that flag first, so it's rejected here.
  if (
    (tg_op = 'INSERT' and (
      coalesce(new.team_code_fail_count, 0) <> 0
      or new.team_code_locked_until is not null
    ))
    or (tg_op = 'UPDATE' and (
      new.team_code_fail_count is distinct from old.team_code_fail_count
      or new.team_code_locked_until is distinct from old.team_code_locked_until
    ))
  )
    and public.current_user_role() <> 'admin'
    and coalesce(current_setting('app.tapuai_team_code_write', true), '') <> 'true'
  then
    raise exception 'team_code_fail_count / team_code_locked_until can only be changed by the server';
  end if;

  return new;
end;
$$;

create or replace function public.triage_app_feedback(
  target_id uuid,
  next_status text,
  next_note text default '',
  next_runtime_path text default ''
)
returns public.app_feedback
language plpgsql
security definer
set search_path = public
as $$
declare
  status_n text := lower(btrim(coalesce(next_status, '')));
  result public.app_feedback;
begin
  -- Admin desks only (function access hardening 2026-10-13); it used to be granted to guests with no check.
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  if status_n not in ('new', 'reviewing', 'planned', 'shipping', 'shipped', 'declined') then
    raise exception 'Unknown feedback status %', next_status;
  end if;

  update public.app_feedback
  set
    status = status_n,
    admin_note = coalesce(next_note, admin_note),
    runtime_path = coalesce(next_runtime_path, runtime_path),
    updated_at = timezone('utc', now())
  where id = target_id
  returning * into result;

  if result.id is null then
    raise exception 'Feedback not found.';
  end if;

  return result;
end;
$$;

create or replace function public.upsert_sport_config(payload jsonb)
returns public.sport_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  sport_n text := btrim(coalesce(payload ->> 'sport', ''));
  target_id uuid := nullif(payload ->> 'id', '')::uuid;
  result public.sport_configs;
begin
  -- Admin desks only (function access hardening 2026-10-13); it used to be granted to guests with no check.
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  if sport_n = '' then
    raise exception 'Name the sport before saving.';
  end if;

  if target_id is null then
    select id into target_id
    from public.sport_configs
    where lower(btrim(sport)) = lower(sport_n);
  end if;

  insert into public.sport_configs as sc (
    id, sport, emoji, period_label, periods, uses_clock, clock_seconds,
    scoring, callouts, stat_fields, measurables, positions, is_active, sort_order, updated_at
  )
  values (
    coalesce(target_id, gen_random_uuid()),
    sport_n,
    coalesce(nullif(payload ->> 'emoji', ''), '🏅'),
    coalesce(nullif(payload ->> 'period_label', ''), 'Period'),
    coalesce(payload -> 'periods', '[]'::jsonb),
    coalesce((payload ->> 'uses_clock')::boolean, true),
    greatest(coalesce((payload ->> 'clock_seconds')::integer, 0), 0),
    coalesce(payload -> 'scoring', '[]'::jsonb),
    coalesce(payload -> 'callouts', '[]'::jsonb),
    coalesce(payload -> 'stat_fields', '[]'::jsonb),
    coalesce(payload -> 'measurables', '[]'::jsonb),
    coalesce(payload -> 'positions', '[]'::jsonb),
    coalesce((payload ->> 'is_active')::boolean, true),
    coalesce((payload ->> 'sort_order')::integer, 0),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    sport = excluded.sport,
    emoji = excluded.emoji,
    period_label = excluded.period_label,
    periods = excluded.periods,
    uses_clock = excluded.uses_clock,
    clock_seconds = excluded.clock_seconds,
    scoring = excluded.scoring,
    callouts = excluded.callouts,
    stat_fields = excluded.stat_fields,
    measurables = excluded.measurables,
    positions = excluded.positions,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = timezone('utc', now())
  returning * into result;

  return result;
end;
$$;

create or replace function public.delete_sport_config(target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin desks only (function access hardening 2026-10-13); it used to be granted to guests with no check.
  if not public.is_admin_or_db() then
    raise exception 'Admins only';
  end if;
  delete from public.sport_configs where id = target_id;
  return found;
end;
$$;

-- Cap constraints: the same server test, so a request with no claims cannot skip a cap.
alter table public.tips drop constraint if exists tips_amount_cents_cap_check;
alter table public.tips add constraint tips_amount_cents_cap_check
  check (public.is_trusted_server() or amount_cents <= 100000) not valid;
alter table public.tips drop constraint if exists tips_aura_points_cap_check;
alter table public.tips add constraint tips_aura_points_cap_check
  check (public.is_trusted_server() or aura_points <= 10000) not valid;
alter table public.sponsorships drop constraint if exists sponsorships_amount_cents_cap_check;
alter table public.sponsorships add constraint sponsorships_amount_cents_cap_check
  check (public.is_trusted_server() or amount_cents <= 100000) not valid;
alter table public.sponsorships drop constraint if exists sponsorships_aura_points_cap_check;
alter table public.sponsorships add constraint sponsorships_aura_points_cap_check
  check (public.is_trusted_server() or aura_points <= 10000) not valid;
alter table public.shop_orders drop constraint if exists shop_orders_amount_cents_cap_check;
alter table public.shop_orders add constraint shop_orders_amount_cents_cap_check
  check (public.is_trusted_server() or amount_cents <= 100000) not valid;

-- Grants. Each statement runs only where the function exists.
do $$
declare
  stmt text;
  fn text;
begin
  foreach stmt in array array[
    'revoke all on function public.is_trusted_server() from public',
    'grant execute on function public.is_trusted_server() to anon, authenticated',
    'revoke all on function public.is_admin_or_db() from public, anon',
    'grant execute on function public.is_admin_or_db() to authenticated',
    -- server-only: called by triggers and by security definer functions, never by a client
    'revoke all on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) from public, anon, authenticated',
    'revoke all on function public.sync_company_revenue_logs() from public, anon, authenticated',
    -- signed-in callers only
    'revoke all on function public.increment_reel_tips(uuid, integer) from public, anon',
    'grant execute on function public.increment_reel_tips(uuid, integer) to authenticated',
    'revoke all on function public.add_user_aura(uuid, integer) from public, anon',
    -- schema.sql said "anon revoked" here but only ever granted authenticated; hosted grants anon by default
    'revoke all on function public.increment_backer_count(uuid) from public, anon',
    'grant execute on function public.increment_backer_count(uuid) to authenticated',
    'grant execute on function public.add_user_aura(uuid, integer) to authenticated',
    'revoke all on function public.publish_spotlight_award(uuid, text, text, date, date) from public, anon',
    'revoke all on function public.upsert_cheer_poll(text, text, text, boolean) from public, anon',
    -- admin desks: signed-in, and the functions now check for an admin
    'revoke all on function public.triage_app_feedback(uuid, text, text, text) from public, anon',
    'grant execute on function public.triage_app_feedback(uuid, text, text, text) to authenticated',
    'revoke all on function public.upsert_sport_config(jsonb) from public, anon',
    'grant execute on function public.upsert_sport_config(jsonb) to authenticated',
    'revoke all on function public.delete_sport_config(uuid) from public, anon',
    'grant execute on function public.delete_sport_config(uuid) to authenticated',
    -- verification ladder admin functions (guarded inside by is_admin_or_db)
    'revoke all on function public.admin_add_school_confirmer(uuid, text, text, text, text) from public, anon',
    'revoke all on function public.admin_decide_verification(uuid, boolean, text) from public, anon',
    'revoke all on function public.admin_revoke_school_confirmer(uuid) from public, anon',
    'revoke all on function public.admin_revoke_verification(uuid, text) from public, anon',
    -- guarded inside by current_user_role(), but revoked from public only, and hosted Supabase grants anon directly
    'revoke all on function public.admin_approve_player_consent(uuid) from public, anon',
    'revoke all on function public.admin_set_custodial_terms(uuid, smallint, date) from public, anon',
    'revoke all on function public.admin_set_player_guardian(uuid, uuid) from public, anon',
    -- The server role keeps every function above: removing PUBLIC must not take it from the Stripe webhook (its
    -- add_user_aura calls; and is_trusted_server inside the cap CHECKs runs as the writing role).
    'grant execute on function public.add_user_aura(uuid, integer) to service_role',
    'grant execute on function public.admin_add_school_confirmer(uuid, text, text, text, text) to service_role',
    'grant execute on function public.admin_decide_verification(uuid, boolean, text) to service_role',
    'grant execute on function public.admin_revoke_school_confirmer(uuid) to service_role',
    'grant execute on function public.admin_revoke_verification(uuid, text) to service_role',
    'grant execute on function public.admin_approve_player_consent(uuid) to service_role',
    'grant execute on function public.admin_set_custodial_terms(uuid, smallint, date) to service_role',
    'grant execute on function public.admin_set_player_guardian(uuid, uuid) to service_role',
    'grant execute on function public.increment_backer_count(uuid) to service_role',
    'grant execute on function public.delete_sport_config(uuid) to service_role',
    'grant execute on function public.increment_reel_tips(uuid, integer) to service_role',
    'grant execute on function public.is_admin_or_db() to service_role',
    'grant execute on function public.is_trusted_server() to service_role',
    'grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to service_role',
    'grant execute on function public.record_company_revenue(text, text, integer, text, uuid, text, timestamptz) to service_role',
    'grant execute on function public.sync_company_revenue_logs() to service_role',
    'grant execute on function public.triage_app_feedback(uuid, text, text, text) to service_role',
    'grant execute on function public.upsert_cheer_poll(text, text, text, boolean) to service_role',
    'grant execute on function public.upsert_sport_config(jsonb) to service_role'
  ] loop
    fn := substring(stmt from 'function (public\.[a-z_]+\([^)]*\))');
    if to_regprocedure(fn) is not null then
      execute stmt;
    end if;
  end loop;
end;
$$;
