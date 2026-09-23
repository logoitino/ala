-- 2026-09 audit item 3: subscriptions gate paid athlete content — `useHasSubscriberPass` only
-- ever reads the caller's own `subscriber_id`, so there is no guest-browse read to preserve.
drop policy if exists "Public read subscriptions" on public.subscriptions;
create policy "Public read subscriptions"
  on public.subscriptions for select
  using (auth.uid() = subscriber_id or public.current_user_role() = 'admin');
-- 2026-09 audit item 3: `with check (true)` let any client grant itself a free permanent unlock of
-- any athlete's paid content for any subscriber_id. `useAthleteSubscription.ts` always inserts with
-- `subscriber_id: user.id`, so tying the check to auth.uid() matches the only real caller.
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): a frozen athlete (or their frozen school)
-- rejects new exclusive subscriptions at the database layer — see `malo_target_frozen`.
drop policy if exists "Public insert subscriptions" on public.subscriptions;
create policy "Public insert subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = subscriber_id and not public.malo_target_frozen(subscriptions.athlete_id));
drop policy if exists "Public update subscriptions" on public.subscriptions;
create policy "Public update subscriptions"
  on public.subscriptions for update
  using (auth.uid() = subscriber_id or public.current_user_role() = 'admin')
  with check (
    (auth.uid() = subscriber_id or public.current_user_role() = 'admin')
    and not public.malo_target_frozen(subscriptions.athlete_id)
  );
-- 2026-09 audit item (subscriber_requests): `body` is the actual private message text a fan sends
-- an athlete (Vault "Direct Request"). SELECT is scoped to the sender (their own Q&A history), the
-- receiving athlete (via `profiles.player_id = subscriber_requests.athlete_id`, mirroring the
-- `profiles.player_id` athlete-identity join used elsewhere in this file), or admin — not `using
-- (true)`. INSERT requires the caller to insert as themself.
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
drop policy if exists "Public read cheer polls" on public.cheer_polls;
create policy "Public read cheer polls" on public.cheer_polls for select using (true);
drop policy if exists "Insert telemetry logs" on public.telemetry_logs;
create policy "Insert telemetry logs" on public.telemetry_logs for insert with check (true);
drop policy if exists "Authenticated read telemetry logs" on public.telemetry_logs;
create policy "Authenticated read telemetry logs" on public.telemetry_logs for select using (auth.role() = 'authenticated');
-- 2026-09 audit: `profiles` SELECT stays public (see the policy comment above for why); the
-- concretely sensitive column is closed via the REVOKE further below. INSERT/UPDATE stay open to
-- anon at the *grant* level (Postgres GRANTs are additive with RLS, not a replacement for it) because
-- the RLS policies ("Users insert own profile" / "Users update own profile") tie the actual writes to
-- `auth.uid()`, matching the existing pattern elsewhere in this file — as of the third-pass fix above,
-- "Users insert own profile" no longer has an `auth.role() = 'anon'` escape hatch, so an anon-key
-- caller with no session (`auth.uid()` null) cannot satisfy either policy's `with check` regardless
-- of holding the table-level grant.
grant select, insert, update, delete on public.profiles to anon, authenticated;
-- 2026-09 audit item 6, considered and NOT applied: a column-level
-- `revoke select (stripe_connect_id) on public.profiles from anon, authenticated` was drafted to
-- close the named PII exposure without touching the table-wide read guest browse depends on.
-- Reverted: Postgres column privileges only add a *narrower* grant on top of a table-wide one —
-- they do not subtract from it, so this would have been a no-op unless the table-wide `select`
-- grant above were also revoked and re-granted on an explicit column allowlist. That in turn would
-- make any `select('*')` query on `profiles` fail outright (Postgres/PostgREST reject the whole
-- wildcard query if the caller lacks privilege on any one column), and `select('*')` on `profiles`
-- is exactly how `AuthContext.tsx` loads every signed-in user's own profile on every app boot
-- (`.from('profiles').select('*').eq('user_id', userId)`). That is untestable from here against a
-- live Supabase instance, and the failure mode (every authenticated user unable to load their own
-- profile) is worse than the exposure it would close. Left open, flagged for a real fix: either
-- (a) a `profiles_public` view carrying only the non-sensitive columns, with call sites migrated
-- to it, or (b) enumerating every non-sensitive column for an explicit `grant select (...)` after
-- auditing every current `select('*')`/`select(...)` call site — either is a bigger, testable-only-
-- against-staging change, not something to land blind in this pass.
grant select on public.schools_and_teams to anon, authenticated;
grant select on public.athlete_career_stats to anon, authenticated;
grant select on public.athlete_game_logs to anon, authenticated;
-- 2026-09 audit item 12: spotlight board stays publicly readable (guest browse); publishing is
-- now authenticated-admin only (see the RLS policy above).
grant select on public.spotlight_awards to anon, authenticated;
grant insert, update, delete on public.spotlight_awards to authenticated;
-- 2026-09 audit (Round 11 sweep): both narrowed to `authenticated` — Soft-Wall gates Join Crew
-- behind sign-in, so there was never a real anon caller; `crew_push_queue` also drops `insert`
-- entirely (see RLS policy comment above — only the SECURITY DEFINER RPC writes it).
grant select, insert, delete on public.crew_follows to authenticated;
grant select on public.crew_push_queue to authenticated;
-- 2026-09 audit item 1/12: `players` carries `aura_points` directly — see the RLS policy comment
-- above. Read stays public (roster/cards are guest-browse); writes are now authenticated-role only.
grant select on public.players to anon, authenticated;
grant insert, delete on public.players to authenticated;
-- 2026-09 audit item 2 (add_user_role escalation pass): UPDATE narrowed to an explicit column
-- allowlist that excludes `guardian_id` / `parental_consent_approved` / `guardian_consent_at` —
-- those three are now writable only through the SECURITY DEFINER RPCs above
-- (`admin_set_player_guardian`, `parent_set_player_consent`, `admin_approve_player_consent`), which
-- bypass this grant entirely. This is the fix for the "Staff write players" policy still being
-- `for all` for `booster`/`operator` with zero column scoping — see the long comment above.
grant update (
  name, jersey_number, position, height, school_name, backer_count, team,
  view_count, aura_count, flex_count, seki_count, aura_points, weight,
  forty_yard, vertical_jump, vault_locked
) on public.players to authenticated;
-- 2026-09 audit item 12: `games`/`game_events` reads stay public (live scoreboard is guest-browse).
-- Writes stay grantable to anon at the table level because the RLS policies above now narrow anon
-- writes to unclaimed games only; INSERT (creating a new game) is admin-desk-only, not part of the
-- anon operator-PIN flow, so that moves to authenticated.
grant select, update on public.games to anon, authenticated;
grant insert on public.games to authenticated;
grant select, insert on public.game_events to anon, authenticated;
-- 2026-09 audit item 2: tips are financial records now scoped by the RLS policies above
-- (auth.uid() = fan_id, or admin) — no legitimate anon caller remains, so anon is revoked here too.
grant select, insert on public.tips to authenticated;
grant select, insert, update, delete on public.operator_gigs to anon, authenticated;
grant select, insert on public.operator_checkins to anon, authenticated;
-- 2026-09 audit item 12: sponsor_ads reads stay public (sideline banners are guest-browse); writes
-- are now authenticated-role only (see the RLS policy above).
grant select on public.sponsor_ads to anon, authenticated;
grant insert, update, delete on public.sponsor_ads to authenticated;
-- 2026-09 audit sweep: read stays public (Top Boosters rail is guest-browse), but insert is
-- authenticated-only now — see the RLS policy comment above.
grant select on public.sponsorships to anon, authenticated;
grant insert on public.sponsorships to authenticated;
-- 2026-09 audit item 12: verification_requests is an internal review queue, not guest-browse —
-- anon is revoked entirely; RLS above scopes authenticated access to the requester or booster/admin.
grant select, insert, update, delete on public.verification_requests to authenticated;
-- 2026-09 audit item 11: disbursements are payout ledger rows — anon revoked entirely.
grant select, insert, update on public.disbursements to authenticated;
-- 2026-09 audit (paywall bypass): base-table SELECT is no longer public — see the "Read own or
-- admin reels" policy comment above. Guest/fan browsing now reads `public.reels_feed` (granted
-- further up, right after that view's definition) instead. INSERT/UPDATE drop `anon` (Soft-Wall
-- gates the upload FAB; no real anon caller). UPDATE is further narrowed to an explicit column
-- allowlist — see the RLS policy comments above for why counters/moderation flags are deliberately
-- excluded and stay RPC-only.
grant select on public.reels to authenticated;
grant insert on public.reels to authenticated;
grant update (title, category, is_exclusive, is_vault_only, flash_unlock_until) on public.reels to authenticated;
grant select, insert, delete on public.saved_reels to authenticated;
grant select, insert on public.reel_hype_votes to authenticated;
-- 2026-09 audit item 3: subscriptions gate paid content — anon revoked; RLS above scopes
-- authenticated access to the subscriber themself (or admin).
grant select, insert, update on public.subscriptions to authenticated;
-- 2026-09 audit item (subscriber_requests): `body` is private message content — anon revoked;
-- RLS above scopes SELECT to the sender, the receiving athlete, or admin, and INSERT to the sender.
grant select, insert on public.subscriber_requests to authenticated;
grant select on public.cheer_polls to anon, authenticated;
grant insert on public.telemetry_logs to anon, authenticated;
grant select on public.telemetry_logs to authenticated;
-- 2026-09 audit item 1: `increment_backer_count` only ever runs after a soft-wall-gated
-- authenticated Mālo tip (`useTipCheckout.ts` / `lib/payments.ts`) — anon revoked.
grant execute on function public.increment_backer_count(uuid) to authenticated;
-- 2026-09 audit item 1/4: see the SECURITY TRADEOFF comment on the function body above (per-call
-- cap stopgap) — anon revoked, authenticated + internal cap only.
grant execute on function public.add_user_aura(uuid, integer) to authenticated;
grant execute on function public.get_aura_tier(integer) to anon, authenticated;
-- 2026-09 audit item 1: intentionally LEFT anon-executable. Unlike the others in this list,
-- `increment_player_hype` writes vanity view/aura/flex/seki tap counters on `players`, never the
-- `aura_points` currency column, has no per-user dedup either way, and is a documented
-- guest-facing engagement surface (Highlights ⚡ reactions are not behind the Soft Wall). Tightening
-- it to authenticated would regress a currently-working guest feature for a purely cosmetic counter
-- with no money/Aura implication. Flagged here rather than silently left as-is.
grant execute on function public.increment_player_hype(uuid, text) to anon, authenticated;
-- 2026-09 audit item 1: `increment_reel_hype` is different from `increment_player_hype` above — it
-- writes to `reel_hype_votes` with a per-(user_id, reel_id, kind) UNIQUE constraint specifically to
-- dedupe one hype tap per signed-in fan. For an anon caller `auth.uid()` is null, so that dedupe
-- insert was always skipped and the counter incremented unconditionally on every call — i.e. anon
-- execute defeated this table's own anti-spam design. Restricting to authenticated makes the dedupe
-- actually work as designed, not just closes a theoretical hole.
grant execute on function public.increment_reel_hype(uuid, text) to authenticated;
-- 2026-09 audit item 1: same reasoning as increment_backer_count — only reached post-Mālo-tip.
grant execute on function public.increment_reel_tips(uuid, integer) to authenticated;
grant execute on function public.cast_cheer_vote(text, text, text, text, text) to anon, authenticated;
grant execute on function public.update_game_score(uuid, integer, integer, boolean, text) to anon, authenticated;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.add_user_role(text) to anon, authenticated;
grant execute on function public.normalize_team_code(text) to anon, authenticated;
grant execute on function public.team_code_school_key(text) to anon, authenticated;
grant execute on function public.sport_from_team_code_token(text) to anon, authenticated;
grant execute on function public.athlete_is_varsity_verified(uuid) to anon, authenticated;
grant execute on function public.redeem_team_code(text) to authenticated;
grant execute on function public.request_athlete_verification(text) to authenticated;
grant execute on function public.get_fan_tip_history(uuid) to authenticated;
grant execute on function public.search_local_entities(text, text) to anon, authenticated;
grant execute on function public.search_schools_and_teams(text) to anon, authenticated;
grant execute on function public.report_reel(uuid) to authenticated;
grant execute on function public.publish_spotlight_award(uuid, text, text, date, date) to anon, authenticated;
grant execute on function public.spotlight_normalize_kind(text) to anon, authenticated;
grant execute on function public.spotlight_window(text, date) to anon, authenticated;
-- 2026-09 audit follow-up: anon dropped from all three — confirming/rejecting a player
-- tag (and the pending-tag queue that feeds it) requires a real session now that the
-- `auth.role() = 'anon'` bypass is gone from the function bodies above.
grant execute on function public.can_confirm_player_tag(uuid) to authenticated;
grant execute on function public.confirm_reel_player_tag(uuid, text) to authenticated;
grant execute on function public.get_pending_player_tags() to authenticated;
grant execute on function public.get_spotlight_standings(text) to anon, authenticated;
grant execute on function public.sync_spotlight_period(text) to anon, authenticated;
grant execute on function public.sync_live_spotlight_awards() to anon, authenticated;
grant execute on function public.unlock_spotlight_period(text) to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): the function body already restricts this to
-- `current_user_role() = 'admin'` (see the comment on the function above) — `anon` execute here was
-- always a no-op for a real admin action, dropped for consistency with the other admin-only RPCs.
grant execute on function public.moderate_flagged_reel(uuid, text) to authenticated;
grant execute on function public.get_admin_platform_metrics() to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): the function body now requires the uploader or an admin
-- (see the comment on the function above) — `anon` execute was already a no-op (`actor is null`
-- always raised), dropped for consistency.
grant execute on function public.toggle_reel_vault_status(uuid) to authenticated;
-- 2026-09 audit follow-up: anon dropped — the role check inside the function body now requires
-- a real authenticated session anyway (current_user_role() resolves to 'guest' for anon).
grant execute on function public.set_player_vault_locked(uuid, boolean) to authenticated;
grant execute on function public.get_active_spotlight_award(uuid) to anon, authenticated;
grant execute on function public.get_crew_graph(uuid) to anon, authenticated;
grant execute on function public.toggle_crew_follow(uuid, boolean) to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): same reasoning as `toggle_reel_vault_status` above —
-- ownership check added to the function body, `anon` execute dropped as a no-op.
grant execute on function public.set_reel_flash_unlock(uuid) to authenticated;
do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.game_events;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.cheer_polls;
exception
  when duplicate_object then null;
  when duplicate_table then null;
end $$;
insert into public.cheer_polls (slug, home_label, away_label, home_votes, away_votes)
values ('westlake-lone-peak', 'Westlake Thunder', 'Lone Peak Knights', 124, 98)
on conflict (slug) do nothing;
insert into public.games (
  home_team, away_team, home_school, away_school, home_score, away_score, quarter, status, venue, is_active
)
select * from (values
  ('Westlake', 'Lone Peak', 'Westlake High', 'Lone Peak High', 14, 10, 'Q2', 'live', 'Westlake Stadium', true),
  ('ALA Hawks', 'Skyridge', 'American Leadership Academy', 'Skyridge High', 21, 17, 'Q3', 'live', 'Hawks Field', true),
  ('Timpview', 'American Fork', 'Timpview High', 'American Fork High', 0, 0, 'Q1', 'live', 'Timpview Stadium', true)
) as seed(home_team, away_team, home_school, away_school, home_score, away_score, quarter, status, venue, is_active)
where not exists (select 1 from public.games limit 1);
insert into public.players (name, jersey_number, position, height, school_name, backer_count)
select * from (values
  ('Marcus Rivera', 7, 'Quarterback', '6''2"', 'ALA Hawks', 14),
  ('Jordan Blake', 21, 'Running Back', '5''11"', 'ALA Hawks', 9),
  ('Tyler Nguyen', 88, 'Wide Receiver', '6''1"', 'ALA Hawks', 22),
  ('Derek Sullivan', 54, 'Linebacker', '6''3"', 'ALA Hawks', 11),
  ('Andre Coleman', 99, 'Defensive End', '6''4"', 'ALA Hawks', 17)
) as seed(name, jersey_number, position, height, school_name, backer_count)
where not exists (select 1 from public.players limit 1);
update public.players
set
  weight = case when coalesce(weight, '') = '' then '192 lb' else weight end,
  forty_yard = case when coalesce(forty_yard, '') = '' then '4.58s' else forty_yard end,
  vertical_jump = case when coalesce(vertical_jump, '') = '' then '34 in' else vertical_jump end;
insert into public.athlete_career_stats (player_id, sport, games_played, scoring_value, volume_value, mvp_badges)
select p.id, 'Football', 11, 186, 2140, 2
from public.players p
on conflict (player_id) do nothing;