-- 2026-09 audit item 2 (add_user_role escalation pass): "Staff write players" below is `for all`
-- for `booster`/`admin`/`operator` with no column scoping, and the table-level `grant update` on
-- `players` had no column allowlist either — together that let a `booster`- or `operator`-role
-- account write `guardian_id` / `parental_consent_approved` / `guardian_consent_at` directly via a
-- raw REST `UPDATE`, completely bypassing the admin-only RPC above. Postgres column GRANTs are
-- role-level (every signed-in user is just `authenticated`), so they can't tell "booster" apart
-- from "the one already-linked parent" or "an admin approving a verification request" — those two
-- legitimate direct-write call sites (`app/(parent)/parent/index.tsx`'s `toggleConsent`, and
-- `lib/adminCatalog.ts`'s `setVerificationStatus`) are moved to these two narrow SECURITY DEFINER
-- RPCs so the column-level grant below can safely exclude all three columns for everyone else.
create or replace function public.parent_set_player_consent(target_player_id uuid, approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_profile_id uuid;
begin
  if public.current_user_role() <> 'parent' then
    raise exception 'Parent required';
  end if;
  if target_player_id is null then
    raise exception 'target_player_id required';
  end if;

  select id into caller_profile_id from public.profiles where user_id = auth.uid() limit 1;
  if caller_profile_id is null then
    raise exception 'Profile not found';
  end if;

  update public.players
  set
    parental_consent_approved = coalesce(approved, false),
    guardian_consent_at = case when coalesce(approved, false) then now() else null end
  where id = target_player_id
    and guardian_id = caller_profile_id;

  if not found then
    raise exception 'Not linked to this athlete';
  end if;
end;
$$;
revoke all on function public.parent_set_player_consent(uuid, boolean) from public;
grant execute on function public.parent_set_player_consent(uuid, boolean) to authenticated;
create or replace function public.admin_approve_player_consent(target_player_id uuid)
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

  update public.players
  set
    parental_consent_approved = true,
    guardian_consent_at = now()
  where id = target_player_id;

  if not found then
    raise exception 'Unknown player';
  end if;
end;
$$;
revoke all on function public.admin_approve_player_consent(uuid) from public;
grant execute on function public.admin_approve_player_consent(uuid) to authenticated;
drop policy if exists "Public read games" on public.games;
create policy "Public read games" on public.games for select using (true);
-- 2026-09 audit item 12: operator claim is PIN-based in the client only (`lib/operator.ts`
-- `OPERATOR_TEST_PIN`), never a Supabase-authenticated session, so restricting this to
-- `authenticated` would break the sideline scoring demo outright. Real fix (authenticated operator
-- accounts) is a bigger product decision flagged in the summary, not made here. As a narrower
-- stopgap: an anon caller may only update a game that is still unclaimed (`claimed_by is null`).
-- Once a real authenticated operator (or admin) claims a game via `claimOperatorGame`, anon
-- callers can no longer overwrite its score/clock/quarter via raw REST.
drop policy if exists "Operators update games" on public.games;
create policy "Operators update games"
  on public.games for update
  using (
    public.current_user_role() in ('operator', 'admin')
    or (auth.role() = 'anon' and claimed_by is null)
  )
  with check (
    public.current_user_role() in ('operator', 'admin')
    or (auth.role() = 'anon' and claimed_by is null)
  );
drop policy if exists "Public read game_events" on public.game_events;
create policy "Public read game_events" on public.game_events for select using (true);
-- Same stopgap as "Operators update games": anon play-by-play inserts are only allowed while the
-- referenced game is unclaimed (or `game_id` is null, matching the retry fallback in
-- `insertOperatorCallout`/`lib/operator.ts` for older rows without the column).
drop policy if exists "Operators insert game_events" on public.game_events;
create policy "Operators insert game_events"
  on public.game_events for insert
  with check (
    public.current_user_role() in ('operator', 'admin')
    or (
      auth.role() = 'anon'
      and (
        game_id is null
        or exists (
          select 1 from public.games g
          where g.id = game_events.game_id and g.claimed_by is null
        )
      )
    )
  );
-- 2026-09 audit: `useGameEventBroadcast.ts` / `lib/operator.ts` push live sideline callouts on a
-- Realtime Broadcast channel `game_events_{gameId}` for every fan viewing that game's Reel. Broadcast
-- sends are NOT table writes, so the "Operators insert game_events" policy above never covered them —
-- with no Realtime Authorization configured, anyone holding the app's public anon key could open a
-- socket and broadcast a fabricated event straight onto any fan's screen, live, with zero auth check.
-- Fix: both channel() calls now pass `{ private: true }`, which makes Realtime consult these
-- `realtime.messages` RLS policies before delivering (receive) or accepting (send) a message on the
-- topic. Mirrors the same claimed/unclaimed stopgap as the `game_events` table policy above.
-- Note: `realtime.messages` already has RLS enabled by the Supabase platform on every project, and
-- the SQL Editor's role does not own that table — running `alter table realtime.messages enable row
-- level security` here fails with `must be owner of table messages` (42501). Only CREATE POLICY is
-- needed (and permitted) on it.
drop policy if exists "Fans receive game_events broadcast" on realtime.messages;
create policy "Fans receive game_events broadcast"
  on realtime.messages for select
  using (realtime.topic() like 'game_events\_%' escape '\');
drop policy if exists "Operators send game_events broadcast" on realtime.messages;
create policy "Operators send game_events broadcast"
  on realtime.messages for insert
  with check (
    realtime.topic() like 'game_events\_%' escape '\'
    and (
      public.current_user_role() in ('operator', 'admin')
      or (
        auth.role() = 'anon'
        and exists (
          select 1 from public.games g
          where g.id::text = split_part(realtime.topic(), 'game_events_', 2)
            and g.claimed_by is null
        )
      )
    )
  );
-- 2026-09 audit item 2: tips are financial records, not a guest-browse surface — no client reads
-- another fan's tips directly (`useFanTipHistory` filters by `fan_id = auth.uid()`; admin reads go
-- through `get_admin_reports()`, a SECURITY DEFINER RPC that bypasses this policy entirely).
drop policy if exists "Public read tips" on public.tips;
create policy "Public read tips"
  on public.tips for select
  using (auth.uid() = fan_id or public.current_user_role() = 'admin');
-- 2026-09 audit item 2: `with check (true)` let any client insert a fabricated tip of any amount
-- for any player. This still does not verify a real Stripe charge happened (see
-- supabase/functions/stripe-webhook/index.ts for that) but at minimum ties the row to the caller's
-- own auth.uid(), closing "anyone can credit tips to any fan_id".
-- 2026-09 compliance (LEGAL_BRIEFING.md §8 item 5): a frozen athlete (or their frozen school)
-- rejects new Mālo at the database layer, not just in the client — see `malo_target_frozen`.
drop policy if exists "Insert tips" on public.tips;
create policy "Insert tips"
  on public.tips for insert
  with check (auth.uid() = fan_id and not public.malo_target_frozen(tips.player_id));
drop policy if exists "Public read gigs" on public.operator_gigs;
create policy "Public read gigs" on public.operator_gigs for select using (true);
drop policy if exists "Operators write gigs" on public.operator_gigs;
create policy "Operators write gigs"
  on public.operator_gigs for all
  using (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'))
  with check (auth.role() = 'anon' or public.current_user_role() in ('operator', 'admin'));
drop policy if exists "Operators write checkins" on public.operator_checkins;
create policy "Operators write checkins"
  on public.operator_checkins for all
  using (true)
  with check (true);
drop policy if exists "Public read sponsorships" on public.sponsorships;
create policy "Public read sponsorships" on public.sponsorships for select using (true);
-- 2026-09 audit sweep (same pattern as `tips`/`subscriptions` item 2/3): sponsorships are financial
-- records — the fan/booster checkout flow (`hooks/useSponsorships.ts` `recordSponsorship`) always
-- inserts with `sponsor_user_id: user?.id`, and that checkout is JWT-gated (`stripeIntent.ts`
-- `requireAccessToken` throws before `createPaymentIntent`/PaymentSheet ever runs without a real
-- session), so there is no anonymous booster-checkout path to preserve. The admin Boosters desk
-- (`lib/adminCatalog.ts` `upsertBooster`, `/admin/boosters`) records offline sponsorship deals without
-- a `sponsor_user_id` at all, so admin needs its own alternative rather than an ownership check that
-- row could never satisfy. Like `tips`, this closes fabrication (arbitrary `sponsor_user_id` / amount
-- via the anon key) but does not itself verify a Stripe charge happened — that is the separate
-- Stripe-webhook effort scaffolded in `supabase/functions/stripe-webhook/`.
drop policy if exists "Insert sponsorships" on public.sponsorships;
create policy "Insert sponsorships"
  on public.sponsorships for insert
  with check (auth.uid() = sponsor_user_id or public.current_user_role() = 'admin');
drop policy if exists "Public read ads" on public.sponsor_ads;
create policy "Public read ads" on public.sponsor_ads for select using (true);
-- 2026-09 audit item 12: dropped the `auth.role() = 'anon'` bypass. No client code writes
-- `sponsor_ads` directly today (sideline/rivalry banner tools are stubs per `lib/adminCoverage.ts`),
-- so there is no anon-facing flow this could break.
drop policy if exists "Sponsors write ads" on public.sponsor_ads;
create policy "Sponsors write ads"
  on public.sponsor_ads for all
  using (public.current_user_role() in ('sponsor', 'admin'))
  with check (public.current_user_role() in ('sponsor', 'admin'));
-- 2026-09 audit item 12: verification requests are an internal review queue (Varsity claims),
-- not a guest-browse surface — no fan-facing screen reads other athletes' requests directly.
drop policy if exists "Staff read verification" on public.verification_requests;
create policy "Staff read verification"
  on public.verification_requests for select
  using (
    public.current_user_role() in ('booster', 'admin')
    or exists (
      select 1 from public.profiles p
      where p.id = verification_requests.requester_user_id and p.user_id = auth.uid()
    )
  );
drop policy if exists "Boosters write verification" on public.verification_requests;
create policy "Boosters write verification"
  on public.verification_requests for all
  using (public.current_user_role() in ('booster', 'admin'))
  with check (public.current_user_role() in ('booster', 'admin'));
-- 2026-09 audit item 12: `request_athlete_verification` (the RPC used by the primary path in
-- `lib/verification.ts`) is already `authenticated`-only. The direct-insert fallback in that same
-- file only runs once `supabase.auth.getUser()` resolves a user, and always sets
-- `requester_user_id` from that user's own profile — so tying the check to auth.uid() matches the
-- only real caller and closes the previous unconditional `with check (true)`.
drop policy if exists "Athletes insert verification" on public.verification_requests;
create policy "Athletes insert verification"
  on public.verification_requests for insert
  with check (
    requester_user_id is null
    or exists (
      select 1 from public.profiles p
      where p.id = verification_requests.requester_user_id and p.user_id = auth.uid()
    )
  );
-- 2026-09 audit item 11: this policy was literally named "Admin read" but its actual `using`
-- clause was `true` (public) — payout records readable by anyone. Now genuinely admin/parent-only.
drop policy if exists "Admin read disbursements" on public.disbursements;
create policy "Admin read disbursements"
  on public.disbursements for select
  using (public.current_user_role() in ('admin', 'parent'));
-- 2026-09 audit item 11: dropped the `auth.role() = 'anon'` bypass — disbursements are payout
-- ledger rows, not part of any guest or anon operator-demo flow.
drop policy if exists "Admin write disbursements" on public.disbursements;
create policy "Admin write disbursements"
  on public.disbursements for all
  using (public.current_user_role() in ('admin', 'parent'))
  with check (public.current_user_role() in ('admin', 'parent'));
-- 2026-09 audit (paywall bypass): `using (true)` + `grant select ... to anon, authenticated` meant
-- ANY client holding the public anon key could read `video_url` for every reel via a raw REST call —
-- including Vault-only / subscriber-Exclusive / Flash-Unlock clips — with no subscription, no Vault
-- unlock, not even a login. The app's own `.eq('is_vault_only', false)` feed filters were never an
-- access boundary, just a query convenience. RLS can't conditionally null one column within a row
-- that must otherwise stay visible (for the blurred paywall tile), so the real fix is the
-- `public.reels_feed` view below, which every fan-facing read now goes through (`lib/reels.ts`,
-- `lib/spotlight.ts`) — it nulls `video_url` unless the row is unlocked, Flash-Unlocked right now, or
-- the caller is the uploader / an admin / an active subscriber to the tagged athlete. This base-table
-- policy is narrowed to just what the base table itself still needs: an uploader reading back their
-- own freshly-inserted/updated row (`MediaUploadService.insertReelRow`'s `.select()` after insert),
-- and the admin moderation desks (`lib/admin.ts`, `lib/adminCatalog.ts`) which need every row's
-- metadata (not video_url) regardless of lock state. The view is owned by the migration role (not
-- `authenticated`/`anon`), so it reads the full base table regardless of this narrower policy —
-- Postgres evaluates a view's underlying table access using the view owner's privileges unless the
-- view is explicitly marked `security_invoker`, which this one deliberately is not.
drop policy if exists "Public read reels" on public.reels;
create policy "Read own or admin reels" on public.reels
  for select
  to authenticated
  using (
    public.current_user_role() = 'admin'
    or uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  );
drop view if exists public.reels_feed;
create view public.reels_feed as
select
  r.id,
  r.title,
  r.player_id,
  r.game_id,
  r.created_at,
  r.seki_count,
  r.aura_count,
  r.flex_count,
  r.total_tips_cents,
  r.is_exclusive,
  r.is_vault_only,
  r.is_flagged,
  r.reported_by,
  r.is_removed,
  r.category,
  r.flash_unlock_until,
  r.uploaded_by,
  r.tag_status,
  r.tag_confirmed_at,
  r.tag_confirmed_by,
  case
    when coalesce(r.is_vault_only, false) = false then r.video_url
    when r.flash_unlock_until is not null and r.flash_unlock_until > timezone('utc', now()) then r.video_url
    when public.current_user_role() = 'admin' then r.video_url
    when auth.uid() is not null and r.uploaded_by = (
      select p.id from public.profiles p where p.user_id = auth.uid() limit 1
    ) then r.video_url
    when auth.uid() is not null and r.player_id is not null and exists (
      select 1 from public.subscriptions s
      where s.subscriber_id = auth.uid()
        and s.athlete_id = r.player_id
        and s.status = 'active'
    ) then r.video_url
    else ''
  end as video_url
from public.reels r;
grant select on public.reels_feed to anon, authenticated;
-- 2026-09 audit (reels RLS tightening): `with check (true)` let any anon/authenticated client
-- insert a Highlight attributed to any `player_id` with any `uploaded_by`. `MediaUploadService.
-- insertReelRow` never sets `uploaded_by` itself; the `reels_apply_tag_defaults` BEFORE INSERT
-- trigger (see that trigger above) fills it from the caller's own `profiles.id` before this WITH
-- CHECK runs — Postgres applies a row's BEFORE-trigger mutations, then evaluates RLS, for INSERT —
-- so this check passes for every real upload and rejects any row a client tries to attribute to
-- someone else's profile. Soft-Wall gates the upload FAB, so `anon` was never a real caller either;
-- narrowed to `authenticated` to match.
drop policy if exists "Public insert reels" on public.reels;
create policy "Authenticated insert own reels"
  on public.reels for insert
  to authenticated
  with check (
    uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1)
  );
-- 2026-09 audit (reels RLS tightening): `using (true) with check (true)` let any anon/authenticated
-- client vandalize ANY reel row via a raw REST PATCH — caption, video_url, hype counts, tip totals,
-- vault/exclusive flags, moderation flags, all of it. Two row policies replace it below (uploader
-- edits their own clip; admin edits any clip); the GRANT further down additionally narrows which
-- *columns* `authenticated` may touch at all to `title` / `category` / `is_exclusive` /
-- `is_vault_only` / `flash_unlock_until` (RLS alone can't restrict columns within a matched
-- policy, so without that grant an owner-scoped policy could still be used to rewrite counters or
-- moderation flags on their own row). Counters (`seki_count`/`aura_count`/`flex_count`/
-- `total_tips_cents`), `is_flagged`/`is_removed`/`reported_by`, and the tag fields only move through
-- the SECURITY DEFINER RPCs (`increment_reel_hype`, `increment_reel_tips`, `moderate_flagged_reel`,
-- `confirm_reel_player_tag`, `report_reel`), which bypass column grants entirely because they run as
-- the function owner, not the caller's session role.
drop policy if exists "Public update reels" on public.reels;
create policy "Uploader updates own reel"
  on public.reels for update
  to authenticated
  using (uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1))
  with check (uploaded_by = (select p.id from public.profiles p where p.user_id = auth.uid() limit 1));
drop policy if exists "Admin moderates any reel" on public.reels;
create policy "Admin moderates any reel"
  on public.reels for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
drop policy if exists "Fans read own saved reels" on public.saved_reels;
create policy "Fans read own saved reels"
  on public.saved_reels for select
  using (auth.uid() = user_id);
drop policy if exists "Fans save own reels" on public.saved_reels;
create policy "Fans save own reels"
  on public.saved_reels for insert
  with check (auth.uid() = user_id);
drop policy if exists "Fans unsave own reels" on public.saved_reels;
create policy "Fans unsave own reels"
  on public.saved_reels for delete
  using (auth.uid() = user_id);
drop policy if exists "Fans read own reel hype votes" on public.reel_hype_votes;
create policy "Fans read own reel hype votes"
  on public.reel_hype_votes for select
  using (auth.uid() = user_id);
drop policy if exists "Fans insert own reel hype votes" on public.reel_hype_votes;
create policy "Fans insert own reel hype votes"
  on public.reel_hype_votes for insert
  with check (auth.uid() = user_id);
alter table public.subscriptions enable row level security;