drop function if exists public.set_malo_freeze(text, uuid, boolean);
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): the ONLY way to flip `profiles.malo_frozen` /
-- `schools_and_teams.malo_frozen` — admin-only, checked internally via `current_user_role()`, so no
-- extra table-level UPDATE grant is needed on either table for this feature.
create or replace function public.set_malo_freeze(target_type text, target_id uuid, frozen boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_frozen boolean := coalesce(frozen, false);
  updated_id uuid;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Access restricted';
  end if;
  if target_id is null then
    raise exception 'target_id required';
  end if;

  if target_type = 'athlete' then
    update public.profiles
    set malo_frozen = next_frozen
    where id = target_id
    returning id into updated_id;
  elsif target_type = 'school' then
    update public.schools_and_teams
    set malo_frozen = next_frozen
    where id = target_id
    returning id into updated_id;
  else
    raise exception 'Unknown target_type %', target_type;
  end if;

  if updated_id is null then
    raise exception '% not found', target_type;
  end if;

  return next_frozen;
end;
$$;
grant execute on function public.set_malo_freeze(text, uuid, boolean) to authenticated;
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.tips enable row level security;
alter table public.operator_gigs enable row level security;
alter table public.operator_checkins enable row level security;
alter table public.sponsor_ads enable row level security;
alter table public.sponsorships enable row level security;
alter table public.verification_requests enable row level security;
alter table public.disbursements enable row level security;
alter table public.reels enable row level security;
alter table public.saved_reels enable row level security;
alter table public.reel_hype_votes enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscriber_requests enable row level security;
alter table public.cheer_polls enable row level security;
alter table public.telemetry_logs enable row level security;
alter table public.schools_and_teams enable row level security;
alter table public.athlete_career_stats enable row level security;
alter table public.athlete_game_logs enable row level security;
alter table public.spotlight_awards enable row level security;
alter table public.crew_follows enable row level security;
alter table public.crew_push_queue enable row level security;
-- Read: guests/fans can watch game day.
-- SECURITY NOTE (2026-09 audit item 6): kept `using (true)` here deliberately — profiles power
-- guest-facing reads across the app with no Supabase session at all (public /user/[id], Team
-- Roster Strip `lib/roster.ts`, Top Boosters `useAuraBoosters.ts`, /gift/[handle] `lib/share.ts`),
-- so gating this to `authenticated` would break the documented browse-first guest flow. The
-- concretely named harmful column (`stripe_connect_id`) is NOT closed in this pass — see the long
-- comment on the `grant ... on public.profiles` line below for why a column-level fix was drafted,
-- found unsafe to land blind (breaks `AuthContext.tsx`'s `select('*')` self-profile load), and
-- reverted in favor of flagging it as a real, testable-only-on-staging follow-up.
drop policy if exists "Public read profiles" on public.profiles;
create policy "Public read profiles" on public.profiles for select using (true);
drop policy if exists "Public read schools and teams" on public.schools_and_teams;
create policy "Public read schools and teams"
  on public.schools_and_teams for select
  using (true);
drop policy if exists "Public read athlete career stats" on public.athlete_career_stats;
create policy "Public read athlete career stats"
  on public.athlete_career_stats for select
  using (true);
drop policy if exists "Public read athlete game logs" on public.athlete_game_logs;
create policy "Public read athlete game logs"
  on public.athlete_game_logs for select
  using (true);
drop policy if exists "Public read spotlight awards" on public.spotlight_awards;
create policy "Public read spotlight awards"
  on public.spotlight_awards for select
  using (true);
-- 2026-09 audit item 12: dropped the `auth.role() = 'anon'` bypass. Spotlight publishing is an
-- admin desk action (`/admin/spotlight`), not the anon operator-PIN sideline flow, so there is no
-- guest-facing write to preserve here.
drop policy if exists "Admin write spotlight awards" on public.spotlight_awards;
create policy "Admin write spotlight awards"
  on public.spotlight_awards for all
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
drop policy if exists "Public read crew follows" on public.crew_follows;
create policy "Public read crew follows" on public.crew_follows for select using (true);
drop policy if exists "Users write own crew follows" on public.crew_follows;
-- 2026-09 audit (Round 11 sweep): dropped the `auth.role() = 'anon'` bypass on both — this is a
-- fan feature gated by Soft-Wall (sign-in required before Join Crew is ever reachable), not an
-- admin/operator desk with the Studio-Unlock "no real session" excuse. `toggle_crew_follow`
-- (SECURITY DEFINER, already requires `auth.uid()` non-null) and `setCrewFollow`'s direct-table
-- fallback in `lib/crew.ts` (documented `@param userId Signed-in auth.uid()`) both only ever write
-- the caller's own `follower_id` — there was no legitimate anon caller, only an unconditional bypass
-- letting anyone with the public anon key insert fake Crew follows or delete any real user's Crew
-- relationships for any athlete pair.
create policy "Users write own crew follows"
  on public.crew_follows for all
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());
-- 2026-09 audit (Round 11 sweep): same bypass on SELECT let anyone with the anon key read every
-- fan's queued Crew push payloads, not just their own. INSERT was worse — `with check (true)`, no
-- role condition even needed — anyone could queue a fake in-app notification (`title`/`body`/`kind`
-- fully attacker-controlled) targeting any real `recipient_id`. The only real writer,
-- `set_reel_flash_unlock`, is SECURITY DEFINER and bypasses this policy already; nothing in the app
-- ever inserts here directly, so INSERT is now closed to clients entirely (and the grant below drops
-- to select-only).
drop policy if exists "Users read own crew push" on public.crew_push_queue;
create policy "Users read own crew push"
  on public.crew_push_queue for select
  using (recipient_id = auth.uid());
drop policy if exists "Insert crew push" on public.crew_push_queue;
-- 2026-09 audit (self-escalation fix, third pass — INSERT gap): this policy used to read
-- `with check (user_id = auth.uid() or auth.role() = 'anon')`, the same `auth.role() = 'anon'`
-- bypass pattern closed everywhere else in this file. Unlike the UPDATE policy below, no legitimate
-- caller ever needs the anon branch here: the only two INSERT paths into `profiles` are (a)
-- `handle_new_auth_user` (further down this file), a `SECURITY DEFINER` trigger on `auth.users` that
-- bypasses RLS entirely and is therefore unaffected by this policy either way, and (b)
-- `ensureFanProfile` in `lib/auth.ts`, the client fallback, which is only ever called with a `User`
-- already resolved from a real Supabase session (`data.user` / `data.session.user` after
-- `signUp` / `signInWithPassword` / OAuth exchange resolves) — it always runs as `authenticated`
-- with `user_id: user.id === auth.uid()`, so it already satisfies the `user_id = auth.uid()` branch
-- alone. With the anon branch present, an unauthenticated caller (raw anon key, no session) could
-- INSERT a brand-new row with `is_admin` / `role` / `roles` set directly — neither `add_user_role`'s
-- caller-must-already-be-admin check nor the `guard_profiles_admin_escalation` trigger (previously
-- `before update` only) applied to that path. The live blast radius was narrow (`user_id` carries a
-- `unique references auth.users (id)` FK, so the row must name a real, existing auth user, and
-- `handle_new_auth_user` normally already inserts that user's row first — the window was a fresh
-- `auth.users` id with no `profiles` row yet, e.g. a signup where the trigger insert failed/raced),
-- but `auth.role() = 'anon'` on an admin-flaggable table's INSERT check is wrong in principle
-- regardless of how narrow that window is. Fixed by dropping the anon branch; see
-- `guard_profiles_admin_escalation` below for the matching `before insert` defense-in-depth.
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (user_id = auth.uid());
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (user_id = auth.uid() or public.current_user_role() = 'admin')
  with check (user_id = auth.uid() or public.current_user_role() = 'admin');
-- 2026-09 audit (self-escalation fix, second half): the "Users update own profile" policy above
-- lets any signed-in user UPDATE their own row with no column restriction — `is_admin` / `role` /
-- `roles` included. `add_user_role()` now refuses to grant `admin` unless the caller is already
-- admin, but that RPC is not the only writer of these columns: any client can call
-- `supabase.from('profiles').update({ is_admin: true, role: 'admin', roles: ['admin'] }).eq
-- ('user_id', auth.uid())` directly and hit the exact same `user_id = auth.uid()` branch, bypassing
-- the RPC entirely. Postgres column-level GRANTs can't distinguish "this caller is already admin"
-- from "this caller is escalating themselves right now" (both run as the same `authenticated`
-- role), so the only reliable server-side gate is a row trigger that compares the caller's
-- *pre-existing* role (via `current_user_role()`, which reads the row as it stands before this
-- statement) against whether the write is trying to turn a non-admin row into an admin row. This
-- is defense-in-depth for the same vulnerability `add_user_role` was fixed for above, closing the
-- raw-`UPDATE` path (`PeopleTool`'s legitimate admin-grant action in `lib/adminCatalog.ts`'s
-- `patchAdminPerson` is unaffected: it is only ever called by a session that is already admin
-- against the RLS `using` branch above's `current_user_role() = 'admin'` grant, so `old_is_admin`
-- there is irrelevant — the trigger only blocks a *non-admin* caller flipping *their own* row to
-- admin).
-- 2026-09 audit (self-escalation fix, third pass — INSERT gap): this used to be `before update`
-- only, which left a brand-new INSERT free to set `is_admin`/`role`/`roles` to admin with no gate at
-- all (see "Users insert own profile" above for how that was reachable). Extended to
-- `before insert or update`. On INSERT there is no prior row to diff against — `old` doesn't exist
-- for that op — so the rule collapses to "the new row can't claim admin unless the caller performing
-- the insert is already admin" rather than the UPDATE path's "old row wasn't admin, new row is, and
-- the caller isn't admin". `TG_OP` distinguishes the two so the function never dereferences `old`
-- during an INSERT.
create or replace function public.guard_profiles_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_is_admin boolean;
  old_is_admin boolean;
begin
  new_is_admin := coalesce(new.is_admin, false)
    or new.role = 'admin'
    or coalesce(new.roles, array[]::text[]) @> array['admin']::text[];

  if tg_op = 'INSERT' then
    if new_is_admin and public.current_user_role() <> 'admin' then
      raise exception 'admin role can only be granted by an existing admin';
    end if;
    return new;
  end if;

  old_is_admin := coalesce(old.is_admin, false)
    or old.role = 'admin'
    or coalesce(old.roles, array[]::text[]) @> array['admin']::text[];

  if new_is_admin and not old_is_admin and public.current_user_role() <> 'admin' then
    raise exception 'admin role can only be granted by an existing admin';
  end if;

  return new;
end;
$$;
drop trigger if exists guard_profiles_admin_escalation on public.profiles;
create trigger guard_profiles_admin_escalation
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_admin_escalation();
drop policy if exists "Public read players" on public.players;
create policy "Public read players" on public.players for select using (true);
-- 2026-09 audit item 1/12: dropped the `auth.role() = 'anon'` bypass. `players` carries the real
-- Aura currency column (`aura_points`) plus roster/measurables — a raw anon REST PATCH could set
-- `aura_points` directly, bypassing `add_user_aura` entirely, which is worse than any of the RPC
-- holes this pass closes. The anon-facing hype-tap fallback in `lib/hype.ts` and backer-count
-- fallback in `lib/payments.ts` are unaffected: their primary path is the `increment_player_hype`
-- / `increment_backer_count` RPCs (still anon-executable, see grants below — those two are
-- vanity/engagement counters, not currency, and `increment_backer_count` only runs after a
-- soft-wall-gated authenticated Mālo tip anyway) and only fall back to a direct table write if the
-- RPC itself errors. Roster/measurables editing from the admin Catalog desk now requires a real
-- authenticated session with one of these roles — Studio-unlock-only preview (no Supabase auth)
-- will no longer be able to write here; see summary for the "admin desk has no real auth gate yet"
-- product decision this surfaces.
-- 2026-09 parent-payee security fix (docs/PARENT_PAYEE_CONNECT_DESIGN.md §0): `parent` dropped from
-- this blanket policy. It previously let ANY `parent`-role account UPDATE `guardian_id` on ANY
-- roster row with zero verification of an actual parent/guardian relationship — low-stakes while
-- `guardian_id` was inert, but about to gate real Stripe Connect payout money per the parent-payee
-- design doc. The design doc's own §1 flags that the *right* linking mechanism (invite code vs.
-- roster-seed import vs. something else) is still an open sign-off, so this pass does not invent
-- one. Interim, conservative fix: `guardian_id` can now only be set by an admin, via the narrow
-- `admin_set_player_guardian` RPC below (see policy + RPC further down). A parent who is *already*
-- the linked guardian on a row keeps the ability to toggle `parental_consent_approved` for that one
-- row via the separate "Parents update own linked player" policy below — this preserves the Parent
-- screen's existing revoke/re-approve toggle for an already-linked athlete, but the *initial*
-- self-claim (`app/(parent)/parent/index.tsx`'s `toggleConsent` setting `guardian_id = profile.id`
-- on a row it doesn't already own) is now rejected by RLS, which is the hole being closed — that
-- UI is not touched in this pass, so that specific call will surface a permission error until the
-- real linking flow (§1 of the design doc) ships.
drop policy if exists "Staff write players" on public.players;
create policy "Staff write players"
  on public.players for all
  using (public.current_user_role() in ('booster', 'admin', 'operator'))
  with check (public.current_user_role() in ('booster', 'admin', 'operator'));
-- 2026-09 parent-payee security fix (see comment above): a `parent`-role account may only UPDATE a
-- `players` row where `guardian_id` already equals their own `profiles.id` (i.e. they are already
-- the recorded guardian, set by an admin via `admin_set_player_guardian`) — and the `with check`
-- requires the row's `guardian_id` to still equal that same actor afterwards, so this policy can
-- never be used to claim an unowned row, reassign guardianship to someone else, or null it out.
-- This is intentionally narrower than "for all": it exists only so an already-linked parent can
-- keep toggling `parental_consent_approved` (and, later, `guardian_consent_at`) for their own
-- athlete, matching the Parent screen's revoke/re-approve behavior.
drop policy if exists "Parents update own linked player" on public.players;
create policy "Parents update own linked player"
  on public.players for update
  using (
    public.current_user_role() = 'parent'
    and guardian_id is not null
    and guardian_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  )
  with check (
    public.current_user_role() = 'parent'
    and guardian_id = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  );
-- 2026-09 parent-payee security fix: the only way `guardian_id` can now be set (the previous hole
-- let any `parent`-role account self-assign this on any row via direct UPDATE). Deliberately narrow
-- and admin-only rather than a self-service "request guardian link" flow — the design doc
-- (docs/PARENT_PAYEE_CONNECT_DESIGN.md §1) has three live candidate linking mechanisms (invite
-- code, roster-seed import, scoped self-declare) still pending product/legal sign-off, and building
-- a request/approval RPC now would risk prescribing the wrong one. This is an interim stopgap, not
-- the final parent-onboarding flow.
create or replace function public.admin_set_player_guardian(target_player_id uuid, new_guardian_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Admin required';
  end if;
  if target_player_id is null then
    raise exception 'target_player_id required';
  end if;
  if new_guardian_id is not null and not exists (select 1 from public.profiles where id = new_guardian_id) then
    raise exception 'Unknown guardian profile';
  end if;

  update public.players
  set
    guardian_id = new_guardian_id,
    parental_consent_approved = false,
    guardian_consent_at = null
  where id = target_player_id;

  if not found then
    raise exception 'Unknown player';
  end if;
end;
$$;
revoke all on function public.admin_set_player_guardian(uuid, uuid) from public;
grant execute on function public.admin_set_player_guardian(uuid, uuid) to authenticated;