<!-- Source schema overview distinguishes private test quotes from gift-credit and settlement authority. -->
## MONEY-TIPS-01 — no-cut gifts and optional platform tips (local, 2026-10-22)

Append-only `20261022152000_no_cut_gifts_optional_tips.sql` changes the individual `malo`
allocation to0platform/10000family independently of `buttons.MONETIZATION_TIPS_ENABLED`.
Other commercial rates stay unchanged. Existing financial rows/closed periods are preserved;
new missing gift rows backfill at0cut only into open periods. The summary exposes bounded
`gift_repair_gap_count`; missing/unknown is not healthy.

`monetization_tips_enabled()` is a private literal-boolean published-config lookup, defaultOFF.
`prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric)` is service-only and prepares
an actor/athlete-bound quote in existing `notification_payment_contexts`. Optional allocations
need publishedON. `record_notification_payment_context` binds the unchanged quote to a real
Stripe test intent once; provisional references cannot credit a gift. `tips_payment_context_guard()`
checks exact recorded optional allocation/identity/intent and duplicates before insert, including
previously issued quotes when the flag turnsOFF. No new table, column, credit writer or receipt
producer; `notification_authority` remainsfalse. Existing `tips` insertion owns business credit.

First draft creation keeps this new money flag publishedOFF until explicit adminPublish.
Flat catalog processing coverage is an estimate/contribution, not actual processor cost.
Current-family gross liability is not bank settlement; test mode and blocked payouts remain.
Migration application, actual per-charge processing and item8movement require separate evidence.

<!-- Canonical schema inventory; notification entries are local unapplied source contracts. -->
# Tapua'i database schema

Canonical SQL: [`apps/mobile/src/backend/db/schema.sql`](../../apps/mobile/src/backend/db/schema.sql)  
Incremental scripts: [`supabase/`](../../supabase/)  
Types: [`apps/mobile/src/frontend/types/database.ts`](../../apps/mobile/src/frontend/types/database.ts) · shared contracts [`packages/shared-types`](../../packages/shared-types/)  
Client palette: [`apps/mobile/src/frontend/lib/aura.ts`](../../apps/mobile/src/frontend/lib/aura.ts)

Auth (`auth.users`) must exist before `profiles.user_id` can reference it.

---

## Product names vs Postgres

| Product / design doc | Actual relation or args |
| --- | --- |
| `video_tips` | `public.tips` (Mālo ledger) + `reels.total_tips_cents` |
| `add_user_aura(target_user_id, points_to_add)` | Postgres `add_user_aura(uuid, integer)` |
| `add_user_role(new_role)` | Postgres `add_user_role(text)` → `profiles.roles` (does not mint Varsity; self-service only for `fan`/`athlete` — see `is_admin` row and function doc below) |
| `redeem_team_code(raw_code)` | Postgres `redeem_team_code(text)` → school code accepted, account **pending** (verification ladder, 2026-09-29) |
| `get_fan_tip_history(fan_user_id)` | Postgres `get_fan_tip_history(uuid)` → Mālo receipts for the tipper |
| `search_local_entities(search_query, entity_kind)` | Postgres `search_local_entities(text, text)` → athlete / school / booster hits |
| `search_schools_and_teams(search_query)` | Postgres `search_schools_and_teams(text)` → HS + NCAA catalog |
| `current_tier` column | Derived in the app via `auraTierForPoints()` (`AURA_TIERS`; SQL `get_aura_tier` archived 2026-10-13) |
| Lock Vault 🔒 / Open Vault 🌐 | `players.vault_locked` + `set_player_vault_locked(target_player_id, is_locked)` |
| Serve Like Me / Train Like Me | `reels.category` (`game_play` \| `train_like_me` \| `serve_like_me`) |
| The Crew ⚡ / Your Squad 🛡️ | `crew_follows` + `get_crew_graph` / `toggle_crew_follow` |
| Admin portal | `/admin` control plane (`profiles.is_admin` or Studio unlock) writes `players`, `schools_and_teams`, `games`, `reels`, `shop_products`, `shop_orders`, `sponsorships`, `cheer_polls`, `spotlight_awards`, `profiles`, `app_runtime_config`, `company_revenue_logs`, `app_feedback`. Studio / Publish / Features / Look / Catalogs / Feedback / Reports / Coverage / Money are client desks on the same tables (Coverage is a client catalog, not a table). Lab / QA stay as hidden deep links. Heavy chrome waits on `publish_app_runtime`. |
| Vault Flash Unlock | `reels.flash_unlock_until` + `set_reel_flash_unlock` → `crew_push_queue` |

---

## Core tables

### `profiles`

Identity for signed-in users.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `user_id` | uuid unique FK → `auth.users(id)` ON DELETE CASCADE | |
| `role` | text | Active / legacy role: `guest` \| `fan` \| `athlete` \| `parent` \| `operator` \| `booster` \| `sponsor` \| `admin` |
| `roles` | text[] default `{fan}` | Dual capability, e.g. `{fan,athlete}`. Athletes also keep `fan`. Incremental: `supabase/profile_roles.sql`. |
| `active_role` | text default `fan` | Fan View vs Athlete Management View (`fan` \| `athlete`). Incremental: `supabase/add_user_role.sql`. |
| `full_name` | text not null | |
| `username` | text | Optional; client slugs `full_name` if null |
| `is_verified` | boolean default false | Varsity badge. **Not** set by claiming athlete/school or by a team code. True only after the school confirms in person (`school_confirm_athlete`) or an admin approves (`admin_decide_verification`) — ladder migration `supabase/migrations/20260929120000_athlete_verification_ladder.sql`; the `guard_profiles_verification` trigger blocks every other write to `is_verified` / `verification_status` / `player_id`. Some hosted DBs also have `is_verified_athlete` (legacy alias). Next `/people` + Expo People read either. Incremental: `supabase/profiles_verified_compat.sql`. |
| `verification_status` | text default `unverified` | `unverified` \| `pending` \| `verified`. Claimed school stays public while pending. Incremental: `supabase/athlete_verification.sql`. |
| `spirit_points` | integer | |
| `aura_points` | integer default 0 | Ranking currency |
| `stripe_connect_id` | text | Stripe Connect Express account id (`acct_…`) from Accounts v2. Today always the signed-in caller's own account (athlete self-onboards) — see [PARENT_PAYEE_CONNECT_DESIGN.md](design/PARENT_PAYEE_CONNECT_DESIGN.md) for the parent-of-record model this is expected to move to (design only, not yet implemented). |
| `stripe_onboarding_complete` | boolean default false | Recipient applied and no user-due requirements after Express return. Incremental: `supabase/stripe_connect.sql`. |
| `payouts_enabled` | boolean default false | Recipient `stripe_transfers` / `payouts` capability is `active`. |
| `legal_terms_accepted_at` | timestamptz | In-app Terms / NIL / minor-safety acknowledgement. Incremental: `supabase/legal_terms_ack.sql`. |
| `legal_terms_version` | text | Matches `LEGAL_TERMS_VERSION` in `data/legal.ts` (`2026-09-27`). |

**Stripe HTTP (JWT):** Mālo PaymentIntent (`POST /api/create-payment-intent` and Edge `create-payment-intent`) and custodial payouts (`POST /api/create-payout`) require a valid Supabase session JWT (`Authorization: Bearer`). Checkout verifies ES256 / RS256 tokens locally against the project JWKS and falls back to `auth.getUser`; payouts and Connect always call `auth.getUser` (live session; SCALE-04, logic in `supabase/functions/_shared/money/`). Payout destination is the signed-in row's `stripe_connect_id` (service role or user-scoped read); a client `destinationAccountId` is ignored. Transfers require `payouts_enabled`. Missing `STRIPE_SECRET_KEY` queues for admin disbursement — it never transfers to an arbitrary id. Connect Account Links stay on JWT `create-stripe-account`. Server secret is `STRIPE_SECRET_KEY` only (never `EXPO_PUBLIC_STRIPE_SECRET_KEY`). **2026-09 freeze-switch fix:** `create-payment-intent` also accepts an optional `playerId` (`players.id`); when present it calls `malo_target_frozen(playerId)` via `createAuthedDb` and returns `403` **before calling `stripe.paymentIntents.create`** if that athlete is frozen — the only point in the checkout flow that can stop the charge itself, not just a downstream ledger write. `useTipCheckout.ts` passes `player?.id` on every checkout that has a target athlete (tip, vault unlock, exclusive subscribe); Drip merch and booster sponsorships have no athlete target and omit it. A lookup error (not a confirmed `true`) fails open to Stripe, same as a missing/older schema — `add_user_aura` / `increment_backer_count` / `increment_reel_tips` still catch a frozen target after the fact either way.
| `school_id` | uuid FK → `schools_and_teams` ON DELETE SET NULL | Athlete onboarding pick (HS or NCAA). Incremental: `supabase/schools_and_teams.sql`. |
| `athlete_division` | text | Copied from the selected team (`High School` / `NCAA D1`). |
| `athlete_sport` | text | Football / Basketball / Rugby / Volleyball (`ATHLETE_SPORTS`). |
| `athlete_jersey` | text | Roster number. |
| `athlete_position` | text | Position (same field for HS and college). |
| `athlete_class_year` | text | Graduation class (`26`–`30` → UI `'26`; catalog `ATHLETE_CLASS_YEARS` covers HS + college underclass). |
| `is_admin` | boolean default false | Web Admin Dashboard. Also treated as true when `role` / `roles` include `admin`. Incremental: `supabase/admin_dashboard.sql`. **2026-09 self-escalation fix:** `add_user_role('admin')` no longer works for a caller who isn't already admin — it raises unless `current_user_role() = 'admin'` before the call (checked inside the function). A `before insert or update` trigger (`guard_profiles_admin_escalation`) closes the matching raw-`UPDATE`- and raw-`INSERT`-on-`profiles` paths too. **2026-09 Round 15 sweep, critical:** that trigger only ever checked `is_admin`/`role = 'admin'`/`roles` containing `admin` — but `profiles` has a blanket `grant update` with no column restriction, so any signed-in fan could run a raw `update profiles set role = 'booster'` (or `operator`/`parent`/`sponsor`) directly and instantly pass `current_user_role() in ('booster', 'admin', 'operator')`, unlocking full `players` table write access among other booster/operator-gated policies — the exact bug `add_user_role` already blocked at the RPC layer (Round 3), just never extended to this trigger. Generalized to check each of the five privileged roles (`admin`, `booster`, `operator`, `parent`, `sponsor`) individually — a role newly present in NEW that wasn't already in OLD is rejected unless the caller is already admin (checked per-role, not just "privileged vs not", so someone who legitimately holds one privileged role can't self-upgrade to another). The one remaining legitimate admin-grant path is the admin desk (`PeopleTool.tsx` → `patchAdminPerson` in `lib/adminCatalog.ts`), which only ever runs from an already-admin session (RLS `current_user_role() = 'admin'` branch), so the trigger never blocks it. **2026-09 bootstrap-gap fix:** this trigger also unconditionally blocked the legitimate one-time "grant the very first admin" SQL run directly in the Supabase SQL Editor, since a raw DB session has no PostgREST JWT at all and `current_user_role()` resolves to `'guest'` there too — a real superuser DB session already has unrestricted power regardless of this trigger anyway (it can `alter table ... disable trigger` outright), so the block bought no real security. Exempted sessions with `auth.role() is null` (no PostgREST role context at all) — a genuine anon REST call still has `auth.role() = 'anon'` even with no `sub` claim, so that path remains blocked exactly as before. |
| `player_id` | uuid FK → `players` ON DELETE SET NULL | Claimed roster row so That's me can auto-confirm. Incremental: `supabase/spotlight_auto.sql`. |
| `avatar_url` | text | Public Storage URL (`avatars/{user_id}/{timestamp}.jpg`). Incremental: `supabase/media_upload.sql`. |
| `age_confirmed_13_plus` | boolean default null | COPPA gate: self-attested "I am 13 years of age or older" checkbox, not a birthdate (data minimization). Null = not yet confirmed (includes every pre-existing account from before this column existed — never retroactively blocked). Set `true` only at the moment a **new** account is created with the box checked: `handle_new_auth_user()` reads it from signup metadata (email+password / magic-link), or the client's one-time `AgeConfirmModal` sets it after first Apple/Google sign-in. Incremental: `supabase/auth_fan_profile.sql`. |
| `malo_frozen` | boolean default false | Compliance kill switch (`LEGAL_BRIEFING.md` §8 item 5): honor a written direction from a school/association to freeze Mālo for this athlete's claimed profile, within hours. Nullable/default false, never retroactive on its own. Flip only via the admin-only `set_malo_freeze(target_type, target_id, frozen)` RPC — never a raw client UPDATE. Enforced (with the athlete's school freeze) by `tips` / `subscriptions` INSERT/UPDATE RLS via `malo_target_frozen(target_player_id)`. Client: Expo `/admin/people` (`PeopleTool.tsx`). |
| `bio` | text | Free-text about-me, ≤500 chars (`profiles_bio_length_check`). Editable by the owner from the profile "Edit Profile" sheet. Hideable via `profile_visibility.bio` — see `profiles_public` below. |
| `social_links` | jsonb default `{}` | Caller-defined `{ platform: handle-or-url }` map (e.g. `instagram`, `twitter`, `tiktok`, `youtube`). Hideable via `profile_visibility.social_links`. |
| `profile_visibility` | jsonb default `{"bio": true, "school": true, "stats": true, "social_links": true}` | Per-field "hide from other users' view" map the owner controls from Edit Profile. Missing/unset key defaults to visible. Owner and admin always see everything regardless of this flag — it only ever narrows what *other* users see. `bio` / `social_links` enforcement lives in `profiles_public`; `stats` enforcement lives in `athlete_stats_visible(target_player_id)` gating the `athlete_career_stats` / `athlete_game_logs` SELECT policies; `school` is presentation-only (no RLS — `players.school_name` stays a public roster field everywhere else in the app) and is just read by the client to decide whether to render the school/team line on the public profile. |
| `created_at` | timestamptz | |

**RLS:** public SELECT; INSERT requires `authenticated` with `user_id = auth.uid()` (Soft-Wall / client `ensureFanProfile`) — **2026-09 audit, third pass:** this policy previously also allowed `auth.role() = 'anon'` as an OR branch (the same bypass pattern closed everywhere else), which let an unauthenticated caller INSERT a brand-new row with `is_admin`/`role`/`roles` set directly, unguarded by either the `add_user_role` fix or the escalation trigger below (both applied only to UPDATE at the time). Live blast radius was narrow — `profiles.user_id` is `unique references auth.users (id)`, so the row must name a real, already-existing auth user with no `profiles` row yet — but the anon branch is gone regardless since no legitimate caller needed it: `handle_new_auth_user` (below) bypasses RLS entirely as a trigger, and `ensureFanProfile` only ever runs against an already-resolved real session (`user_id === auth.uid()`). UPDATE own row or `admin`, with a `before insert or update` trigger (`guard_profiles_admin_escalation`) that additionally rejects any write flipping `is_admin`/`role`/`roles` to admin unless the calling session is already admin, on both INSERT and UPDATE — see the `is_admin` row above (2026-09 self-escalation fix). First signup also inserts via trigger `on_auth_user_created` → `handle_new_auth_user()` on `auth.users` (security definer), now also carrying `age_confirmed_13_plus` from the signup form's metadata when present. Incremental: `supabase/auth_fan_profile.sql`. Client: `AuthContext` + `lib/auth.ts`. **2026-09 audit:** public SELECT is kept (guest-browse surfaces like Team Roster Strip, Top Boosters, `/gift/[handle]` all read `profiles` with no session), but this still publicly exposes `stripe_connect_id` and other status columns — considered a column-level `REVOKE` but reverted because it would also break `AuthContext`'s `select('*')` self-profile load without a live DB to test against; flagged as a real follow-up (either a `profiles_public` view + call-site migration, or an audited explicit column allowlist). The server routes that need `stripe_connect_id` (`createPayout.ts`, `create-stripe-account`) already read it with the service-role key, unaffected either way. **2026-09 profile customization:** the `profiles_public` view below is that follow-up, scoped to `bio` / `social_links` only (not a general fix for `stripe_connect_id`, which remains the same accepted, pre-existing risk described above).

### `profiles_public` (view)

Read-only mirror of `profiles` used by every "viewing someone else's account" surface (public `/user/[id]`, Team Roster Strip, etc.) instead of the base table. Same shape concern as `reels_feed` (base table is publicly `using (true)` and can't be narrowed to a per-row/per-column REVOKE without breaking the owner's own `select('*')`), same fix shape: a view that nulls the hidden columns for anyone who isn't the owner or admin. Columns: `id`, `user_id`, `player_id`, `username`, `full_name`, `avatar_url`, `is_verified`, `is_verified_athlete`, `school_visible` (mirrors `profile_visibility->>'school'`, client-enforced), `bio` (null unless `profile_visibility.bio` is true, or caller is the owner/admin), `social_links` (`{}` under the same condition). Not marked `security_invoker`, so it reads the full base table as its owner regardless of the base table's own policy — same as `reels_feed`. Granted `select` to `anon, authenticated`.

`20261007211500_public_profile_sport.sql` appends nullable `athlete_sport` for linked accounts with the athlete role. This is public sport identity, independent of the private numeric Stats flag; no career values or payment fields enter the view. Existing bio/social visibility cases and grants are preserved. Prepared locally; not applied to a hosted database. Older databases omit the optional client field and fall back to career sport / unique roster position.

### `schools_and_teams`

Universal High School + college catalog for Athlete onboarding. Fuzzy search is `ILIKE '%query%'` on name, mascot, division, region, and city.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Seed ids are stable (`a1000000-…`). |
| `name` | text unique | `Westlake High`, `BYU` |
| `mascot` | text | `Thunder`, `Cougars` |
| `level` | text | `high_school` \| `college` |
| `division` | text | `High School` or `NCAA D1` (also D2+ later) |
| `region` | text | HS state (`UT`) or conference (`Big 12`) |
| `city` | text | |
| `team_code` | text unique (case-insensitive) | Coach-issued season code, e.g. `WSTLK-2026`. Athletes may type `WSTLK-RUG-2026` (sport token in the middle). Incremental: `supabase/athlete_verification.sql`. |
| `malo_frozen` | boolean default false | Compliance kill switch (`LEGAL_BRIEFING.md` §8 item 5): honor a written direction from a school/association to freeze Mālo for every athlete at this school, within hours. Nullable/default false. Flip only via the admin-only `set_malo_freeze(target_type, target_id, frozen)` RPC. Enforced (with the athlete's own profile freeze) by `tips` / `subscriptions` INSERT/UPDATE RLS via `malo_target_frozen(target_player_id)`. Client: Expo `/admin/schools` (`SchoolsTool.tsx`). |
| `created_at` | timestamptz | |

Badge copy: `[ High School • UT ]` vs `[ NCAA D1 • Big 12 ]` (`formatTeamBadge`). Client: `useTeamSearch` / `TeamSearchField`. Trading card shows name, mascot, and badge on both faces.

**RLS (demo):** public SELECT. Admin INSERT / UPDATE / DELETE via `current_user_role() = 'admin'` (anon allowed in Expo Go). Incremental: `supabase/admin_portal.sql`. Client: `/admin/schools`.

### `players` guardian / parental consent

| Column | Type | Notes |
| --- | --- | --- |
| `guardian_id` | uuid FK → `profiles(id)` ON DELETE SET NULL | The parent/guardian's own `profiles.id`. **2026-09 security fix:** can now only be set by an admin via the `admin_set_player_guardian(target_player_id, new_guardian_id)` SECURITY DEFINER RPC (admin-role-checked internally). Client: `adminSetPlayerGuardian` in `apps/mobile/src/frontend/lib/adminCatalog.ts`, called from Expo `/admin/athletes` (`AthletesTool.tsx`)'s per-row "Link guardian" action (pick a `players` row + a `parent`-role `profiles` row, confirm, done) — the manual stopgap that unblocks first-time linking now that the self-assign hole is closed; see the RLS note below. Also used by `confirm_reel_player_tag`'s auto-confirm check (schema.sql ~1212) and the tag-pending logic in the `reels` section below. |
| `parental_consent_approved` | boolean not null default false | Toggled by the Parent screen (`app/(parent)/parent/index.tsx`'s `toggleConsent`) via the `parent_set_player_consent(target_player_id, approved)` SECURITY DEFINER RPC, which re-checks server-side that `guardian_id` already equals the caller's own linked `profiles.id` — see RLS below. Also settable `true` by an admin approving a verification request, via `admin_approve_player_consent(target_player_id)` (`setVerificationStatus` in `lib/adminCatalog.ts`). `admin_set_player_guardian` resets this to `false` whenever it (re)assigns `guardian_id`. |
| `guardian_consent_at` | timestamptz | Dated record of when `parental_consent_approved` was last set true, mirroring `profiles.legal_terms_accepted_at`. Written by `parent_set_player_consent` / `admin_approve_player_consent` (both above). Index: `players_guardian_id_idx`. |

**RLS + GRANT (2026-09 parent-payee security fix, closes the self-claim hole below):** the previous "Staff write players" blanket policy let any `parent`-role account UPDATE `guardian_id` on *any* roster row, self-assigning as guardian of an arbitrary athlete with zero verification — flagged in [PARENT_PAYEE_CONNECT_DESIGN.md](design/PARENT_PAYEE_CONNECT_DESIGN.md) §0 as load-bearing the moment guardian identity gates real Connect payout money. Fixed with the most conservative option available (per that doc's own §1, the real linking mechanism — invite code / roster-seed import / scoped self-declare — still needs product/legal sign-off, so this pass does not build that flow): `parent` was dropped from "Staff write players" (now booster/admin/operator only); `guardian_id` can only be set by an admin via `admin_set_player_guardian`; a new narrow "Parents update own linked player" policy lets an already-linked parent (`guardian_id = auth-resolved profiles.id`) keep toggling `parental_consent_approved` for their own athlete, matching the Parent screen's existing revoke/re-approve behavior, but cannot change `guardian_id` at all (not to themselves-on-an-unowned-row, not to anyone else, not to null). **2026-09 self-escalation audit follow-up (this was a real gap, not just a documentation nit):** the "Staff write players" policy's row-level `booster`/`admin`/`operator` check had no column scoping, and the table-level `grant update on players to authenticated` had no column allowlist either — so a `booster`- or `operator`-role account could still directly `UPDATE players SET guardian_id = …` via raw REST, completely bypassing `admin_set_player_guardian`, and the "Parents update own linked player" RLS policy's raw-write path was reachable by any `authenticated` caller at the grant level (Postgres column GRANTs are role-level, not row/policy-level, so they can't distinguish "the one linked parent" from anyone else signed in). Closed by narrowing the table-level grant to `grant update (name, jersey_number, position, height, school_name, backer_count, team, view_count, aura_count, flex_count, seki_count, aura_points, weight, forty_yard, vertical_jump, vault_locked) on public.players to authenticated` — i.e. `guardian_id` / `parental_consent_approved` / `guardian_consent_at` are excluded from every raw client write, full stop. The two remaining legitimate direct-write call sites (Parent screen toggle, admin verification-approve) were moved onto the two new SECURITY DEFINER RPCs above (`parent_set_player_consent`, `admin_approve_player_consent`), which bypass the column grant like `admin_set_player_guardian` already did. Consequence: the Parent screen's *initial* consent-approve tap (which also tried to self-assign `guardian_id`) still gets rejected — same intentional gap as before, unrelated to this pass — until an admin completes the first-time link. **2026-09 follow-up:** that admin-side gap is closed by Expo `/admin/athletes`'s "Link guardian" action (see the `guardian_id` row above) — an admin picks the athlete + parent pair and calls `admin_set_player_guardian`, after which the Parent screen's existing revoke/re-approve toggle works normally for that pair. This is still a manual stopgap, not the real self-service flow.

**Design in progress:** see [PARENT_PAYEE_CONNECT_DESIGN.md](design/PARENT_PAYEE_CONNECT_DESIGN.md) (Phase 1 item 3 — parent-of-record as the Stripe Connect account holder, athlete as beneficiary in metadata only). The §0 self-claim RLS gap that document flagged is now closed as described above, and admins have a working manual linking tool (Expo `/admin/athletes`); the full self-service linking-mechanism decision in §1 remains open.

### `players` measurables + Stats 📊

Roster identity lives on `players`. Combine fields and career engine:

| Column / table | Notes |
| --- | --- |
| `players.height` | Existing text measurable |
| `players.weight` | Combine weight (`192 lb`) |
| `players.forty_yard` | 40-yard dash (`4.58s`) |
| `players.vertical_jump` | Vertical (`34 in`) |
| `players.vault_locked` | Master Vault seal. Default **true**: fans must subscribe ($4.99/mo) to watch Vault clips. Athlete can Open Vault 🌐. Incremental: `supabase/player_vault_lock.sql`. RPC `set_player_vault_locked`. |
| `athlete_career_stats` | One row per player: `sport`, `games_played`, `scoring_value`, `volume_value`, `mvp_badges` |
| `athlete_game_logs` | Recent games: `played_on`, `opponent_school`, `stat_line`, scoring/volume |

Sport-specific career headers (client `careerColumnsForSport`): Football Points/Yards, Basketball Points/Rebounds, Rugby Tries/Tackles, Volleyball Kills/Digs. Trading-card back face shows Games / scoring / volume. Incremental: `supabase/athlete_stats.sql`. Client: `useAthleteStats` / `AthleteStatsTab`.

**RLS (2026-09 profile customization):** `athlete_career_stats` / `athlete_game_logs` SELECT was `using (true)`; now `using (athlete_stats_visible(player_id))` so a claiming athlete can hide their stats from other users via `profiles.profile_visibility.stats` (owner/admin still always see them; an unclaimed player row has no owner to make that choice, so it stays visible). See `athlete_stats_visible(target_player_id)` below.

**RLS (demo):** public SELECT on both stats tables. Writes are seed-only.

### `search_schools_and_teams(search_query)`

```sql
search_schools_and_teams(search_query text) returns setof public.schools_and_teams
```

Strips `%` / `_`, then `ILIKE '%' || needle || '%'`. Grant: `EXECUTE` to `anon`, `authenticated`. Incremental: `supabase/schools_and_teams.sql`.

### `reels`

Highlight / Seki clips. Files in Storage **`reels`** (fallback **`game_highlights`**).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `video_url` | text | Public https URL for a free Highlight, or `reelvault:{path}` for a Vault / Exclusive clip in the private `reel_vault` bucket |
| `title` | text | Caption |
| `player_id` | uuid FK → `players` ON DELETE SET NULL | Tagged athlete |
| `game_id` | uuid FK → `games` ON DELETE SET NULL | |
| `seki_count`, `aura_count`, `flex_count` | integer | Clip hype |
| `total_tips_cents` | integer | Mālo on this clip |
| `is_exclusive` | boolean default false | Legacy subscriber-only flag. Kept in lockstep with `is_vault_only`. |
| `is_vault_only` | boolean default **false** | Clip lives in the Vault collection (not the free Highlights ⚡ tab). Fans only need a subscription when `players.vault_locked` is true. Athlete long-press calls `toggle_reel_vault_status` (**2026-09:** now checks the caller is the clip's `uploaded_by` or an admin — previously any signed-in user could flip any clip's Vault flag). |
| `is_flagged` | boolean default false | Set by `report_reel` when the clip should leave the public feed: fake footage, impersonation, or music/logo/broadcast; a report from the tagged athlete or their guardian; or three separate accounts. One other report does not hide the clip. |
| `reported_by` | uuid[] default `{}` | Fan ids who reported this clip. Feed hides the row for those users. |
| `is_removed` | boolean default false | Admin **Remove Content**. Hidden from Highlights ⚡. Incremental: `supabase/admin_dashboard.sql`. |
| `category` | text default `game_play` | `game_play` \| `train_like_me` \| `serve_like_me`. Upload pills + feed badge. Serve Like Me doubles double-tap Aura (`SERVE_LIKE_ME_AURA_MULTIPLIER`). Incremental: `supabase/reel_category.sql`. |
| `flash_unlock_until` | timestamptz | Vault clip is playable until this instant. Athlete long-press **🔓 Flash Unlock (2 Hours)** calls `set_reel_flash_unlock` (**2026-09:** now checks the caller is the clip's `uploaded_by` or an admin — previously any signed-in user could flash-unlock any Vault clip for free). Incremental: `supabase/crew_and_flash_unlock.sql`. |
| `uploaded_by` | uuid FK → `profiles` ON DELETE SET NULL | Fan who uploaded. Trigger fills from the session profile. Incremental: `supabase/spotlight_auto.sql`. |
| `tag_status` | text default `pending` | `pending` \| `confirmed` \| `rejected`. Existing rows were backfilled `confirmed`. New fan tags stay pending until the tagged athlete, parent, school operator, or admin confirms. Only confirmed Game Day hype elects Spotlight. |
| `tag_confirmed_at` / `tag_confirmed_by` | timestamptz / uuid FK → `profiles` | Who verified the jersey. |
| `attested_at` | timestamptz | When the uploader confirmed permission, sound, and marks. Null on older clips. |
| `rights_version` | text | Which confirmation text they agreed to (`2026-10-01`). Incremental: `supabase/migrations/20261001180000_content_rights_reports.sql`. |
| `media_type` | text not null default `video` | `video` \| `photo_story` (constraint `reels_media_type_check`). A photo story stores `video_url = ''`; its photos live in `reel_photos`. Not in the column UPDATE grant, so a published clip cannot change type. Constraint `reels_photo_story_public_check`: a story can never be `is_vault_only` or `is_exclusive` (v1 stories are public only), so `toggle_reel_vault_status` and the client column UPDATE both fail for a story. A story with `photo_count = 0` is **unpublished**: hidden from the pending-tag queue and filmer rewards (and by the client's `isListableReel`). Incremental: `supabase/migrations/20261007230000_photo_stories.sql` (not applied). |
| `photo_count` | smallint not null default 0 | Photos in a story, 0–10 (`reels_photo_count_check`). Server-owned: trigger `reels_reset_photo_count()` zeroes it on every INSERT and only `set_reel_photos` sets it; not in the column UPDATE grant. Same migration. |
| `photo_cleanup_pending` | boolean not null default false | Server-owned terminal failed-upload claim. Owner cleanup RPCs mark only zero-count stories; INSERT forces false and clients cannot update it. A claimed story cannot be reopened/published or receive late Storage content writes. `20261020190000_failed_photo_story_cleanup.sql`, written locally, not applied. |
| `created_at` | timestamptz | |

**RLS (2026-09 audit — reels RLS tightening):** base-table SELECT is **not** public (**2026-09 paywall-bypass fix**, see below) — only the uploader's own row, or an admin. INSERT requires `authenticated` and `uploaded_by` to equal the caller's own `profiles.id` (the `reels_apply_tag_defaults` BEFORE INSERT trigger fills `uploaded_by` from the session before this check runs, so a real upload always satisfies it; a client cannot attribute a row to someone else's profile). UPDATE is two policies — the uploader may update their own row, or an admin (`current_user_role() = 'admin'`) may update any row — **and** a column-level `GRANT` on top of that narrows a raw client UPDATE to `title` / `category` / `is_exclusive` / `is_vault_only` / `flash_unlock_until` only. Counters (`seki_count` / `aura_count` / `flex_count` / `total_tips_cents`), `is_flagged` / `is_removed` / `reported_by`, and the tag fields are **not** in that grant — they only move through the SECURITY DEFINER RPCs (`increment_reel_hype`, `increment_reel_tips`, `moderate_flagged_reel`, `confirm_reel_player_tag`, `report_reel`), which bypass the column grant because they run as the function owner. Previously `with check (true)` on both INSERT and UPDATE — any anon/authenticated client could insert a Highlight attributed to any player, or vandalize any reel row (caption, video, hype counts, tip totals, vault flags, moderation flags) via a raw REST call.

**`public.reels_feed` (2026-09 paywall-bypass fix):** the base table's SELECT policy used to be `using (true)` — combined with a public `GRANT`, that meant anyone holding the app's public anon key could read `video_url` for every reel via a raw REST call, including Vault-only / Exclusive / Flash-Unlock clips, with no subscription and no login. The `.eq('is_vault_only', false)` filters scattered through `lib/reels.ts` were only ever a feed convenience, never an access boundary. Fixed by narrowing the base table's own SELECT policy to the uploader's own row or an admin, and adding this view as the one real fan-facing read path: it mirrors every `reels` column, but `video_url` comes back as `''` unless the row is unlocked, Flash-Unlocked right now, or the caller is the uploader / an admin / holds an active `subscriptions` row for the tagged athlete. `lib/reels.ts` and `lib/spotlight.ts` (the only two call sites that ever needed `video_url` for someone else's clip) now read from `reels_feed`; `lib/admin.ts` / `lib/adminCatalog.ts` (metadata-only, no `video_url`) and `services/MediaUploadService.ts` (insert-then-read-own-row) still read the base table directly. The view is not marked `security_invoker`, so it reads the full base table as its owner regardless of the narrower base-table policy — Postgres's normal (pre-15) view behavior, used deliberately here.

**`reels_feed` photo-story columns (2026-10-07, `20261007230000_photo_stories.sql`, not applied):** `create or replace` re-states the `20260929160000` definition unchanged and in order, then appends `media_type`, `photo_count` and `cover_path`. `cover_path` is the position-0 `reel_photos.image_path` (a Storage object path in bucket `reels`, not a URL — the client calls `supabase.storage.from('reels').getPublicUrl(path)`) behind the same entitlement `CASE` as `video_url` (`''` when locked); null for videos and for a story whose photos are not saved yet. Rollback must drop and re-create the view (columns cannot be removed with `create or replace`).

**Photo stories and other reel readers (same migration):** `get_pending_player_tags()` skips unpublished stories; `reels_filmer_rewards()` awards nothing for an unpublished story (it catches up on the next tag/view update after publishing); `get_spotlight_standings`, `get_active_spotlight_award` and `publish_spotlight_award` count and pick videos only (`coalesce(media_type, 'video') = 'video'`), so Spotlight features no photo stories for now. Each is re-stated from its previous definition in `schema.sql` with only that filter added; signatures, return types and grants are unchanged.

### `reel_reports`

One row per account per clip. Written only by `report_reel`. Admins can read it (`current_user_role() = 'admin'`). Incremental: `supabase/migrations/20261001180000_content_rights_reports.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `reel_id` | uuid FK → `reels` ON DELETE CASCADE | |
| `reporter_id` | uuid | `auth.uid()` of the reporter |
| `reason` | text | `fake_footage` \| `wrong_athlete` \| `impersonation` \| `rights` \| `inappropriate` \| `other` \| `unspecified` |
| `created_at` | timestamptz | |

### `reel_account_tags`

Mentions of Tapua'i accounts on a Highlight. The uploader may add up to three active (pending or confirmed) mentions; the RPC locks the owned reel before counting so concurrent attachments share that cap. The name stays off the clip until that account confirms. Donations still follow `reels.player_id`. Direct writes are revoked; the RPCs below are the only writers. Incremental: `supabase/migrations/20261002160000_reel_account_tags.sql` (not applied). Client: `lib/accountTags.ts`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `reel_id` | uuid FK → `reels` ON DELETE CASCADE | |
| `profile_id` | uuid FK → `profiles` ON DELETE CASCADE | Unique with `reel_id` |
| `status` | text | `pending` \| `confirmed` \| `rejected` |
| `created_at` | timestamptz | |

**RLS:** anyone can read `confirmed`. The tagged account and the uploader can also read their pending rows. No client INSERT/UPDATE.

RPCs: `search_taggable_accounts(search_query)` (since PRIV-01: username prefix of 3+ characters; hidden and blocked accounts never appear), `tag_reel_accounts(target_reel_id, profile_ids)`, `get_reel_account_tags(target_reel_id)`, `get_my_account_tags()`, `confirm_account_tag(target_tag_id, tag_action)`. `account_tag_label` builds the public name and is not granted to the app. `tag_reel_accounts` rejects missing identity and non-uploader writes and, since 20261022150000, silently skips a profile in a block with the uploader. `confirm_account_tag` returns the new status only when it updates an owned pending mention; missing, foreign, or already answered rows return SQL `NULL`. On development since 2026-10-17; replay `scripts/replay/account-tags-replay.mjs`.

### `reel_photos`

The photos of a photo story (Highlights ⚡ photo stories, WORK_QUEUE UX-05), in order; `position` 0 is the cover. [Design](design/PHOTO_STORIES_DESIGN.md). Incremental: `supabase/migrations/20261007230000_photo_stories.sql` (**written 2026-10-07, not applied anywhere, never parsed by Postgres**). Files: bucket `reels`, object path `{auth.users.id}/stories/{reel_id}/{position}-{epoch ms}.jpg` (the same migration adds `image/jpeg` to the bucket allow-list). The table stores that **path**, never a URL, so the database never trusts a host; clients build the URL with `supabase.storage.from('reels').getPublicUrl(path)`. Client: `lib/photoStories.ts`, `services/MediaUploadService.ts` (`uploadStoryPhoto`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `reel_id` | uuid FK → `reels` ON DELETE CASCADE | Unique with `position` |
| `position` | smallint | 0–9, array order from `set_reel_photos` |
| `image_path` | text | 1–300 characters; Storage object path in bucket `reels`, `{uploader uid}/stories/{reel_id}/{n}-{ms}.jpg` |
| `description` | text | Optional, ≤ 200 characters, trimmed (empty → null) |
| `width`, `height` | integer | Optional picker dimensions (layout hints) |
| `created_at` | timestamptz | |

**RLS:** enabled. Base-table SELECT (`authenticated`) only for the story's uploader or an admin — mirrors "Read own or admin reels". All privileges revoked from `public` / `anon` / `authenticated`, then `select` granted to `authenticated`; no client INSERT / UPDATE / DELETE. Fans and guests read `reel_photos_feed`.

**`set_reel_photos(p_reel_id, p_photos)`** → integer (photos saved). `security definer`, `search_path = public`; EXECUTE revoked from `public` / `anon`, granted to `authenticated` only. **Publish once:** v1 has no edit screen, so the call is refused (55000) when the reel's `photo_count` is already set; a failed call rolls back and leaves the count at 0, so the client may retry until one succeeds. Checks: signed in with a profile; locks the reel `for update` and requires `uploaded_by` = the caller's profile (42501 otherwise); `media_type = 'photo_story'`; not `is_removed`; `photo_count = 0`; `p_photos` is a JSON array of 1–10 objects `{ image_path, description?, width?, height? }`; `image_path` is a string of 1–300 characters matching the anchored pattern `^<auth.uid()>/stories/<p_reel_id>/[0-9]{1,2}-[0-9]{10,16}[.]jpg$` (no host, `..`, `%`, query string or other folder can match); `description` is text or null, trimmed, empty → null, ≤ 200; `width` / `height` are null or numbers 1–100000 (rounded to whole pixels). Inserts the list in array order (`position` 0..n-1), then sets `reels.photo_count`. The client must therefore insert the reel first and upload under its id.

**`reel_photos_feed` (view)** — `select` granted to `anon, authenticated` (default view privileges revoked first). Columns `id`, `reel_id`, `position`, `description`, `width`, `height`, `image_path`; inner join `reels`, rows of removed reels excluded. `image_path` uses the exact `reels_feed` `video_url` rule (free clip, Flash-Unlocked now, admin, uploader, or active subscriber to the tagged athlete; otherwise `''`), so a future Vault story is already gated. Not `security_invoker`, same as `reels_feed`.

**`reels_reset_photo_count()`** — BEFORE INSERT trigger function on `reels` (trigger `reels_reset_photo_count`): sets `photo_count = 0` so the table-wide INSERT grant cannot plant a fake count. Not callable as an RPC.

### `saved_reels`

Fan bookmarks from the Reel right rail. Incremental: `supabase/saved_reels.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid | Signed-in fan (`auth.uid()`). PK with `reel_id`. |
| `reel_id` | uuid FK → `reels` ON DELETE CASCADE | Uploaded clip only (seeded `hl-*` ids stay in AsyncStorage). |
| `created_at` | timestamptz | |

**RLS:** SELECT / INSERT / DELETE own rows (`auth.uid() = user_id`). Guests persist `tapuai.savedReel.guest.{reelId}` locally via `useSavedReel`.

### `reel_hype_votes`

One Seki / Aura / Flex per signed-in fan per Highlight. A second tap on the same chip removes it. Incremental: `supabase/reel_hype_votes.sql`, `supabase/clear_reel_hype.sql`. Client: `loadReelVotes` / `markReelVote` / `clearReelVote` (`tapuai.reelVotes.*`). `increment_reel_hype` returns `applied: false` on a duplicate. `clear_reel_hype` deletes that fan's `reel_hype_votes` row, steps the counter down by one (never below zero), and returns `applied: false` when there was no vote to remove. Execute is `authenticated` only.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid | Signed-in fan (`auth.uid()`). PK with `reel_id` + `kind`. |
| `reel_id` | uuid FK → `reels` ON DELETE CASCADE | Uploaded clip only (seeded `hl-*` ids stay in AsyncStorage). |
| `kind` | text | `seki` \| `aura` \| `flex` |
| `created_at` | timestamptz | |

**RLS:** SELECT / INSERT own rows (`auth.uid() = user_id`). Guests (and Expo Go without the table) stay on local flags. Double-tap Aura is the same one Aura vote.

### `crew_follows`

Fan → athlete Crew graph. **The Crew ⚡** is follower count; **Your Squad 🛡️** is how many athletes that profile follows. Incremental: `supabase/crew_and_flash_unlock.sql`. Client: `useCrew` + `Join Crew ⚡` / glowing **Teammates 🤝** when mutual.

| Column | Type | Notes |
| --- | --- | --- |
| `follower_id` | uuid | Signed-in fan (`auth.uid()`). PK with `athlete_id`. |
| `athlete_id` | uuid FK → `players` ON DELETE CASCADE | Athlete being followed |
| `created_at` | timestamptz | |

**RLS (2026-09 Round 11 sweep):** all operations (`for all`) scoped to `follower_id = auth.uid()`. Previously `using/with check (follower_id = auth.uid() or auth.role() = 'anon')` — an unconditional bypass, not actually needed for Expo Go (`toggle_crew_follow` is SECURITY DEFINER and already required a real session; `setCrewFollow`'s direct-table fallback in `lib/crew.ts` always writes the caller's own `auth.uid()`) — that let anyone holding the public anon key insert fake Crew follows or delete any real user's Crew relationships for any athlete pair, no login needed. Grant narrowed to `authenticated` only.

### `crew_push_queue`

Push payloads queued when an athlete Flash Unlocks a Vault clip. `set_reel_flash_unlock` inserts one row per Crew member (`kind = flash_unlock`). Prototype queue — no Expo push token wiring yet. **2026-09:** `set_reel_flash_unlock` now requires the caller to be the clip's `uploaded_by` or an admin (previously any signed-in user could flash-unlock any Vault clip). **2026-09 Round 11 sweep:** SELECT dropped the same `auth.role() = 'anon'` bypass (anyone could read every fan's queued notifications, not just their own); INSERT — previously `with check (true)`, no role check at all — is now closed to clients entirely, since the only real writer is the SECURITY DEFINER RPC above, which bypasses this policy anyway. Nothing in the app ever inserted here directly, so this only closes an anyone-can-queue-a-fake-notification hole, no functionality lost. Grant narrowed to `select` only, `authenticated` only.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `recipient_id` | uuid | Fan `auth.uid()` |
| `athlete_id` | uuid FK → `players` | |
| `reel_id` | uuid FK → `reels` | |
| `kind` | text default `flash_unlock` | |
| `title` / `body` | text | |
| `payload` | jsonb | `{ reel_id, athlete_id, flash_unlock_until, kind }` |
| `created_at` | timestamptz | |

**RLS (demo):** SELECT own `recipient_id`; INSERT anyone (RPC is security definer).

### `subscriptions`

Per-athlete exclusive access after `$4.99/mo` PaymentSheet on `/athlete/[id]`. Client also mirrors the grant in AsyncStorage (`tapuai.exclusiveSub.{userId|guest}.{playerId}`) so tiles unlock if this table is not applied yet. Checkout is a **one-time PaymentIntent** persisted as an app `subscriptions` row (not Stripe Billing).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `subscriber_id` | uuid | Signed-in fan (`auth` user id). Guests persist locally only. |
| `athlete_id` | uuid FK → `players` ON DELETE CASCADE | Target athlete |
| `status` | text default `active` | `active` / `canceled` / `expired` |
| `created_at` | timestamptz | |

Unique `(subscriber_id, athlete_id)`. Incremental file: `supabase/subscriptions.sql` (alias: `supabase/athlete_subscriptions.sql`, which also copies any leftover `athlete_subscriptions` rows). If a stub `subscriptions` table already exists (no `subscriber_id` / `athlete_id`), the script drops it when empty or renames it to `subscriptions_legacy`. An older `user_id` column is renamed to `subscriber_id`.

**RLS (2026-09 audit):** SELECT/UPDATE own `subscriber_id` or admin; INSERT requires `auth.uid() = subscriber_id`. Previously `with check (true)` let any client grant itself a free permanent unlock for any `subscriber_id` — closed. **2026-09 compliance:** INSERT and UPDATE also require `not malo_target_frozen(athlete_id)` — a frozen athlete (or their frozen school, `LEGAL_BRIEFING.md` §8 item 5) rejects new/updated exclusive subscriptions at the database layer. See `malo_target_frozen(target_player_id)` below.

### `subscriber_requests`

Direct shoutout / Q&A from exclusive subscribers on `/athlete/[id]` Vault. Composer is `SubscriberQnA`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `subscriber_id` | uuid | Signed-in fan |
| `athlete_id` | uuid FK → `players` ON DELETE CASCADE | Target athlete |
| `body` | text | Question or shoutout |
| `created_at` | timestamptz | |

Incremental file: `supabase/subscriber_requests.sql`.

**RLS (2026-09 audit):** `body` is private message content, so `using (true)` / `with check (true)` were closed. SELECT is the sender (`auth.uid() = subscriber_id`, so a fan can read back their own Q&A history), the receiving athlete (`profiles.player_id = subscriber_requests.athlete_id` for the caller's own `profiles` row, mirroring the athlete-identity join used elsewhere in this file), or admin (`current_user_role() = 'admin'`). INSERT requires `auth.uid() = subscriber_id`. `anon` grant dropped — `authenticated` only.

### `spotlight_awards`

Player of the Week / Month / Year featured on Highlights launch and the Spotlight fan-bar tab. Incremental: `supabase/spotlight_awards.sql` + `supabase/spotlight_auto.sql`. Client: `useActiveSpotlight` + `useSpotlightBoard` + `SpotlightModal`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | AsyncStorage seen key is `tapuai.spotlightSeen.{id}` |
| `athlete_id` | uuid FK → `profiles` ON DELETE CASCADE | Optional linked fan/athlete profile |
| `player_id` | uuid FK → `players` ON DELETE SET NULL | Tagged athlete who won the window |
| `award_type` | text | `week` / `month` / `year` |
| `level` | text default `school` | Auto crowns use `platform` |
| `school_id` | uuid FK → `schools_and_teams` | Optional catalog school |
| `district_region` | text | Badge fallback, e.g. Westlake High |
| `headline` | text | Performance line or clip title; may append `Clip by` when a fan shot the tape |
| `highlight_reel_id` | uuid FK → `reels` | Hottest confirmed Game Day clip for the winner |
| `start_date` / `end_date` | date | Inclusive window. Week is Monday–Sunday UTC; month/year are calendar UTC |
| `source` | text default `auto` | `auto` from hype; `manual` from admin override |
| `locked` | boolean default false | When true, hype will not recrown this window |
| `created_at` | timestamptz | |

**RLS (demo):** public SELECT. Admin INSERT / UPDATE / DELETE via `current_user_role() = 'admin'` (anon allowed in Expo Go). Incremental: `supabase/admin_dashboard.sql`. Client: `/admin/spotlight` + `publish_spotlight_award`.

### `get_active_spotlight_award(viewer_user_id)`

```sql
get_active_spotlight_award(viewer_user_id uuid default null) returns jsonb
```

Highlights launch passes the signed-in `auth.users.id` (guests omit). **Volatile:** refreshes live week/month/year crowns from confirmed Game Day hype (`sync_live_spotlight_awards`) unless the window is `locked`. Returns a **normalized** jsonb (`player_id`, `reel_id`, `period_kind`, `period_start`, `school_name`, `headline`, `title`, `video_url`, `shot_by`, nested `player`) for the award whose `start_date`–`end_date` contains today. Prefers week over month over year. Viewed state is **not** stored in Postgres — `Dismiss (seen)` writes AsyncStorage so the **launch popup** is once per award id. The Spotlight tab still lists the award. Grant: `EXECUTE` to `anon`, `authenticated`. Client: `fetchActiveSpotlightAward` / `fetchSpotlightBoard`.

### `can_confirm_player_tag` / `confirm_reel_player_tag` / `get_pending_player_tags`

A fan tag is a claim, not proof. `reels.tag_status` stays `pending` until the tagged athlete (`profiles.player_id`, name match, or jersey + school), their parent (`players.guardian_id`), a school operator, or admin confirms. `confirm_reel_player_tag(target_reel_id, tag_action)` accepts `confirm` or `reject`. Helper `reels_apply_tag_defaults` trigger auto-confirms only signed-in athlete / parent / operator / admin uploads. Incremental: `supabase/spotlight_auto.sql`. Client: `usePendingPlayerTags` + `TagConfirmList`.

**2026-09 audit follow-up:** `can_confirm_player_tag` used to `return true` unconditionally for any `auth.role() = 'anon'` caller, and `get_pending_player_tags` had a matching `or auth.role() = 'anon'` in its WHERE — since `confirm_reel_player_tag` trusts `can_confirm_player_tag` as its sole gate, this meant anyone holding just the public anon key (no session at all) could confirm or reject the player tag on any Highlight. Both bypasses are dropped; all three functions are now `EXECUTE`-granted to `authenticated` only (previously also `anon`).

### `get_spotlight_standings` / `sync_spotlight_period` / `sync_live_spotlight_awards` / `unlock_spotlight_period` / `spotlight_normalize_kind` / `spotlight_window`

Clip energy = Seki + Aura + Flex on **confirmed**, public, unflagged **Game Day** clips in the UTC week / month / year. Player of the Week/Month/Year is the tagged `players.id` with the most energy **and** a Varsity-verified claimed profile (`athlete_is_varsity_verified`). Unverified athletes keep public Highlights. `highlight_reel_id` is that player's hottest clip (`Clip by` when `uploaded_by` is not the athlete). `increment_reel_hype` and Highlights launch call `sync_live_spotlight_awards`. Admin **Let hype decide** calls `unlock_spotlight_period`. Manual publish sets `source=manual` and `locked=true`.

### `games`

Live scoreboard. Realtime. Operator console writes score / `clock` / `quarter` / `is_clock_running` here. PIN claim writes `claimed_by`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `home_team`, `away_team`, `home_school`, `away_school` | text | |
| `home_score`, `away_score` | integer | Incremented by `update_game_score` |
| `quarter` | text | `Q1`…`Final` |
| `status` | text | Often `live` |
| `venue` | text | Public stadium/gym/field name; LOCAL-02 protects location edits for admins, new/changed names bounded to 160 characters. |
| `venue_school`, `venue_address`, `venue_notes` | text default empty | LOCAL-02 public venue school (160 chars), full address (320), optional arrival/parking note (400). Per-game location; never inferred from home school. Migration `20261021220000`, locally written/unapplied. |
| `clock` | text default `12:00` | |
| `is_clock_running` | boolean default false | Start / Pause Clock |
| `claimed_by` | uuid FK → `profiles(id)` ON DELETE SET NULL | Set after valid operator PIN |
| `is_active` | boolean | Local discovery |
| `created_at`, `updated_at` | timestamptz | |
| `live_seq` | bigint default 0 | SCALE-03 (`20261018120000`, **not applied**). Server-owned per-game change number: trigger `games_live_seq_bump` sets 0 on insert and adds 1 only when a scoreboard column changes; a client value is ignored |

**RLS (demo):** public SELECT; UPDATE `anon` or operator/admin; INSERT admin/operator (`Admin insert games`). Client: `/admin/games`.

### `games_live_seq_bump` / `games_broadcast_score_change` (SCALE-03 triggers, not applied)

Trigger functions, not RPCs (EXECUTE revoked from API roles). `games_live_seq_bump` (BEFORE INSERT/UPDATE) keeps `games.live_seq`. `games_broadcast_score_change` (AFTER INSERT/UPDATE/DELETE, SECURITY DEFINER, `search_path = ''`) calls `realtime.send` on private topic `game_scores_{id}` with event `score` and payload `{v:1, id, seq, changes}` (only the changed scoreboard columns; never `claimed_by`), and on `game_scores_index` with event `membership` and payload `{v:1, id, op}` for insert / delete / `is_active` flips. A send failure only raises a warning. Policy `Fans receive game score changes` on `realtime.messages`: anon + authenticated SELECT, Broadcast only, topic exactly `game_scores_<uuid>` or `game_scores_index`; no INSERT policy, so clients cannot send. Client: `lib/liveScoreSync.ts` behind `EXPO_PUBLIC_LIVE_SCORES_BROADCAST` (default off).

### `games_venue_guard` (LOCAL-02 trigger, not applied)

Before INSERT/UPDATE, this trigger normalizes public venue fields, enforces text bounds and
requires the existing trusted admin guard for location writes. Legacy anon/operator score-only
updates keep their location exactly; blank-location operator inserts retain existing permissions.
No client EXECUTE grant. Trusted server/SQL Editor keeps maintenance authority. Clear address
removes fan directions; no user GPS, map coordinates, personal address or check-in reference.
Owner applies `20261021220000_game_venues.sql` after trusted admin helpers, then QA verifies
hosted save/clear/denial; local source and replay evidence in [LOCAL-02](../agents/LOCAL-02.md).

### `update_game_score`

```sql
update_game_score(
  target_game_id uuid,
  home_delta integer default 0,
  away_delta integer default 0,
  set_clock_running boolean default null,
  set_clock text default null
) returns jsonb
```

Atomic increment of scores plus optional clock fields. Re-run `supabase/games_operator.sql`. Client: `updateGameScore` in `apps/mobile/src/frontend/lib/operator.ts` (falls back to a direct `games` UPDATE if the RPC is missing). **2026-09 audit:** this is the operator console's primary score path and is SECURITY DEFINER, so it bypassed the `games` RLS policy's claimed-game narrowing entirely; it now carries the same stopgap check internally — an anon caller can only score a game while it is still unclaimed (`claimed_by is null`).

### `video_tips` → `public.tips`

Mālo ledger (no separate `video_tips` table).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `player_id` | uuid FK → `players` ON DELETE CASCADE | Recipient |
| `fan_id` | uuid | Tipper (`auth.users.id` / `auth.uid()`) |
| `reel_id` | uuid FK → `reels` ON DELETE SET NULL | Clip the Mālo was dropped on |
| `origin` | text | Where the gift started: `highlight`, `qr`, `wishlist`, `profile`, `live`, `rally`. Default `profile` |
| `entry` | text | How the fan arrived: `in_app` or `qr_link`. A Highlight after a QR scan stays `origin=highlight` and `entry=qr_link` |
| `wishlist_item_id` | uuid FK → `wishlist_items` ON DELETE SET NULL | Locker item this gift funded |
| `source_label` | text | Item title (or other detail) so the row still names the gear if the item is renamed |
| `amount_cents` | integer | Donation dollars × 100 (processing fee and the optional tip are not included). The 90 / 10 split is on this amount |
| `platform_tip_cents` | integer, default 0 | Optional tip to Tapua'i the donor added at checkout (`0 ≤ x ≤ amount_cents`). 100% platform; never part of the athlete's share. Migration `20260929180000` |
| `rally_id` | uuid FK → `rallies` ON DELETE SET NULL | Rally goal this donation counts toward. `tips_rally_before_insert` credits the Rally, or nulls this when the Rally is not live / belongs to another athlete |
| `aura_points` | integer | Fan Aura granted for this tip (`tipAmount * 10`) |
| `cover_fee_cents` | integer, default 0 | Card fee the donor chose to cover (charged on top; `0 ≤ x ≤ greatest(500, amount_cents)`). Trigger `tips_card_fee_revenue` logs it as a `card_fee` revenue row (100% Tapua'i). BOOKS-01, migration `20261012210000` (not applied) |
| `stripe_payment_intent_id` | text | `pi_…` from the PaymentSheet client secret, so a Stripe payout can be matched to its donations. Same migration |
| `created_at` | timestamptz | |

Clip totals still use `increment_reel_tips`, not a rollup column on `tips`.

Successful Mālo (`useTipCheckout`, `!skipBacker`) **inserts** one `tips` row. Highlight sheets set `origin=highlight` and `reel_id`. A gift-link profile (`/gift/{handle}` → `/user/{id}?entry=qr`) sets `origin=qr` and `entry=qr_link`. A locker Chip In sets `origin=wishlist`, `wishlist_item_id`, and `source_label` to the item title, then `chip_in_wishlist_item` only moves the item total — it does not insert a second row. Live-feed play cards set `origin=live`. Profile **Tip History & Receipts** (`/receipts`) reads the fan's own gifts via `get_fan_tip_history`. The athlete's own profile and Athlete HQ read gifts they received via `get_received_malo`. Next `/money` and Expo `/admin/money` chart the same rows via `get_admin_malo_breakdown`. Profile **Total Tips Dropped** on the trading card is still device-local (`tapuai.maloDroppedCount`). `tip_origin_label(origin, entry, source_label)` builds the channel phrase stored on `company_revenue_logs.label` (`source` stays `malo`). Incremental `supabase/tip_origin.sql`. `supabase/get_fan_tip_history.sql` **creates** `public.tips` when it is missing (this table lived only in full `schema.sql`).

**RLS (2026-09 audit):** SELECT own `fan_id` or admin; INSERT requires `auth.uid() = fan_id` (was `with check (true)` — any client could fabricate a tip of any amount for any player; closed at the RLS layer, though this still trusts the client that a real Stripe charge happened — see `supabase/functions/stripe-webhook/index.ts` for the real verification path this is meant to migrate to). `amount_cents` / `aura_points` now also have `>= 0` CHECK constraints. **2026-09 compliance:** INSERT also requires `not malo_target_frozen(player_id)` — a frozen athlete (or their frozen school, `LEGAL_BRIEFING.md` §8 item 5) rejects new Mālo at the database layer, surfaced to the fan as a generic "Mālo not recorded" alert in `useTipCheckout.ts` (payment already succeeded; no server-side Stripe verification exists yet either way — see the note above).

### Related

`players` (roster + hype + `aura_points` + combine measurables), `athlete_career_stats`, `athlete_game_logs`, `subscriptions`, `subscriber_requests`, `game_events`, `cheer_polls`, `operator_gigs`, `operator_checkins`, `sponsor_ads`, `sponsorships`, `shop_products`, `shop_orders`, `wishlist_items`, `company_revenue_logs`, `telemetry_logs`, `verification_requests`, `disbursements`, `schools_and_teams`, `crew_follows`, `crew_push_queue`, `app_runtime_config`, `app_feedback`. See canonical `schema.sql`.

### `sponsorships`

Local business booster ledger (Silver / Gold / Platinum). Distinct from `sponsor_ads` (sideline creatives) and `subscriptions` (athlete exclusive pass).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `sponsor_user_id` | uuid | Payer (`auth.users.id`) |
| `business_name` | text | |
| `logo_url` | text | HTTPS or Storage public URL (`avatars/sponsors/`) |
| `school_team` | text | Targeted high school |
| `tier` | text | `silver` \| `gold` \| `platinum` |
| `amount_cents` | integer | Monthly dollars × 100 ($50 / $150 / $500) |
| `aura_points` | integer | 500 / 2,000 / 10,000 |
| `billing_interval` | text default `month` | Product copy; first month is PaymentSheet (not Stripe Billing) |
| `status` | text default `active` | |
| `created_at` | timestamptz | |

**RLS (2026-09 audit sweep):** public SELECT; INSERT requires `auth.uid() = sponsor_user_id` **or** `current_user_role() = 'admin'` (`with check (true)` closed — the fan/booster checkout path (`useSponsorships.ts`) always inserts its own `auth.uid()`; the admin Boosters desk (`adminCatalog.ts` `upsertBooster`, `/admin/boosters`) records offline deals with no `sponsor_user_id` at all, hence the admin alternative); admin UPDATE / DELETE (`anon` bypass still present on that policy — not closed this pass). This only stops a fabricated row from a client that never went through Stripe; it does not verify a charge happened (separate webhook effort). Incremental: `supabase/sponsorships.sql` + `admin_portal.sql`. Client: `useSponsorships` + `/admin/boosters`.

### `shop_products`

Drip marketplace catalog. The fan Drip tab reads `is_active` rows (`useDripCatalog`); `/admin/drip` upserts SKUs. Seeded from the former hardcoded `DRIP_ITEMS`. Incremental: `supabase/admin_portal.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Stable slug (`app-hoodie`) |
| `name` | text | |
| `category` | text | `apparel` \| `aura_cards` \| `merch` |
| `price_cents` | integer | Stripe-style cents |
| `blurb` | text | |
| `has_sizes` | boolean | ProductSheet size pills |
| `inventory` | integer | Qty clamp |
| `icon` | text | `shirt` \| `sparkles` \| `basketball` |
| `is_active` | boolean | Hidden from Drip when false |
| `sort_order` | integer | Rack order |
| `created_at` | timestamptz | |

**RLS (demo):** public SELECT; admin INSERT / UPDATE / DELETE (`anon` allowed in Expo Go). Client: `useDripCatalog` + `/admin/drip`. Fallback: `DRIP_ITEMS` when the table is missing.

### `sport_configs`

One playbook per sport, authored at `/admin/sports`. Drives the operator console (score buttons, period chips, clock, sideline callouts) and the athlete Stats 📊 pane (combine tiles, career rows). Any sport without a row falls back to `GENERIC_SPORT_CONFIG`, so nothing is unscoreable. Incremental: `supabase/sport_configs.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `sport` | text | Unique on `lower(btrim(sport))` — `games.sport` and `athlete_career_stats.sport` join by name |
| `emoji` | text | Console + Stats badge (`🏈`) |
| `period_label` | text | Quarter / Half / Set / Inning / Period |
| `periods` | jsonb | Ordered chips (`["Q1","Q2","Q3","Q4","OT"]`) |
| `uses_clock` | boolean | False hides the operator clock (volleyball, baseball, track) |
| `clock_seconds` | integer | Seconds per period seed for the console clock |
| `scoring` | jsonb | `[{ id, label, points, eventType }]` — score buttons and player-tag macros |
| `callouts` | jsonb | `[{ id, label, emoji, eventType }]` — Broadcast buttons, also the fan toast emoji |
| `stat_fields` | jsonb | `[{ source: games \| scoring \| volume \| mvp, label, show }]` career rows |
| `measurables` | jsonb | `[{ key: height \| weight \| fortyYard \| verticalJump, label, show }]` combine tiles |
| `positions` | jsonb | `[{ short, full }]` roster pills on `/admin/athletes` (empty = free text) |
| `is_active` | boolean | Paused playbooks stay off new game / athlete pickers |
| `sort_order` | integer | Builder order |
| `created_at` / `updated_at` | timestamptz | |

`games.sport` (text, default `Football`) selects the playbook for a match. **RLS (demo):** public SELECT; admin INSERT / UPDATE / DELETE (`anon` allowed in Expo Go). Client: `apps/mobile/src/frontend/lib/sports.ts` + `useSportConfigs` + `/admin/sports`. Fallback: `SPORT_CONFIG_SEEDS` (Football, Basketball, Rugby, Volleyball, Soccer, Baseball, Softball, Wrestling, Track & Field, Lacrosse, Ice Hockey, Tennis).

### `get_sport_configs()`

```
get_sport_configs() returns setof sport_configs
```

Every playbook in builder order (`sort_order, sport`), limit 100.

### `upsert_sport_config(payload)`

```
upsert_sport_config(payload jsonb) returns sport_configs
```

Create or update one playbook. Without an `id` it matches on `lower(sport)`, so re-running the seeder is idempotent. Blank names raise.

### `delete_sport_config(target_id)`

```
delete_sport_config(target_id uuid) returns boolean
```

Drops a playbook. Games keep their `sport` text and fall back to the generic console.

### `wishlist_items`

Locker Room Wishlist gear on the athlete Stats 📊 tab. Fans either buy the item outright through `buy_url` or drop Mālo toward the goal. Incremental: `supabase/locker_room_wishlist.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `player_id` | uuid | → `players.id` on delete cascade |
| `title` | text | Card headline (`Speed Cleats — Size 12`) |
| `photo_url` | text | Remote item photo; falls back to a jade glyph |
| `buy_url` | text | 🎁 Gift Item Directly opens this in `expo-web-browser` |
| `target_amount_cents` | integer | Funding goal |
| `current_amount_cents` | integer | Mālo credited so far |
| `is_equipped` | boolean | True once funded — stamps EQUIPPED ⚡ |
| `equipped_at` | timestamptz | Crossing time |
| `aura_awarded` | boolean | Guards the one-time +500 Aura equip bonus |
| `is_active` | boolean | Hidden from the rack when false |
| `sort_order` | integer | Rack order (unfunded first) |
| `created_at` / `updated_at` | timestamptz | |

**RLS (demo):** public SELECT; admin INSERT / UPDATE / DELETE (`anon` allowed in Expo Go). Client: `apps/mobile/src/frontend/lib/wishlist.ts` + `components/Profile/LockerRoomWishlist.tsx` + `/admin/drip`. Fallback: `WISHLIST_DEMO_ITEMS` when the table is missing.

### `get_wishlist_items(target_player_id)`

```
get_wishlist_items(target_player_id uuid) returns setof wishlist_items
```

Active items for one athlete, unfunded first (`order by is_equipped, sort_order, created_at`, limit 20).

### `chip_in_wishlist_item(item_id, amount_cents)`

```
chip_in_wishlist_item(item_id uuid, amount_cents integer) returns jsonb
```

Adds a Mālo contribution to `current_amount_cents`. When the row crosses `target_amount_cents` for the first time it sets `is_equipped` / `equipped_at` / `aura_awarded` and calls `add_user_aura(player_id, 500)`. Returns `{ item, newly_equipped, aura_points, athlete_aura_points }` — the client uses `newly_equipped` for confetti and `athlete_aura_points` to restyle the Aura card. **v2:** like `add_user_aura` / `increment_backer_count`, this RPC trusts the client-supplied amount. Move the credit behind the Stripe webhook before real money. **2026-09 audit:** `EXECUTE` restricted to `authenticated` (`schema.sql` and `supabase/locker_room_wishlist.sql` revoke `anon` so a re-run cannot widen it; Chip In is behind the Soft Wall, so this doesn't affect guests); the per-gift row is the `tips` insert (`origin=wishlist`, `wishlist_item_id`) written before this RPC; `wishlist_items` itself still only stores the aggregate `current_amount_cents`, so there is no `auth.uid()` owner column on the item — a per-call cap (`amount_cents <= 100000`) stands in as a stopgap instead. **2026-09 freeze-switch fix:** also raises via `malo_target_frozen(wishlist_items.player_id)` before `current_amount_cents` moves at all — not just at the +500 Aura/equip step below the target, which `add_user_aura`'s own check would already catch.

### `shop_orders`

Paid Drip checkout rows. ProductSheet inserts after PaymentSheet succeeds. A trigger writes `company_revenue_logs` (`source = merch`, 100% platform). Incremental: `supabase/company_revenue.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `product_id` | text | `shop_products.id` slug |
| `buyer_id` | uuid | Payer (`auth.users.id`) |
| `amount_cents` | integer | Order total |
| `qty` | integer default 1 | |
| `created_at` | timestamptz | |

**RLS (2026-09 audit sweep):** SELECT admin-only (no client reads this table directly yet); INSERT requires `auth.uid() = buyer_id` (`with check (true)` closed) — Drip is **not** listed in `SOFT_WALL_GATES` (`malo` / `crew` / `wishlist` only), but that list only gates the proactive sign-in *prompt* UI: the actual charge still goes through the same JWT-gated `useTipCheckout` → `createPaymentIntent` → `requireAccessToken` flow as Mālo/boosters, which throws before PaymentSheet opens without a real session, so `recordDripOrder`'s `buyerId` is never null on a legitimate purchase and there is no anonymous-buyer order to preserve; UPDATE / DELETE admin-only (previously anon could also update/delete any row through the same `for all` policy — closed). `amount_cents` / `qty` have CHECK constraints (`>= 0` / `> 0`). As with `tips`/`sponsorships`, this only stops a fabricated row from a client that never went through Stripe; it does not verify a charge happened.

### `company_revenue_logs`

Admin finance ledger for `/admin/money`. One row per paid Mālo (`tips`), booster (`sponsorships`), Vault pass (`subscriptions` at $4.99), or Drip order (`shop_orders`). Splits (keep in lockstep with `apps/mobile/src/frontend/data/finance.ts` + `company_revenue_bps`):

| Source | Platform | Payout |
| --- | --- | --- |
| Donations (`malo`) | 10% | 90% athlete |
| Optional tip to Tapua'i (`tip`) | 100% | — (donor chose it; `tips.platform_tip_cents`) |
| Local District Boosters | 15% | 85% operator |
| Vault subscribe | 20% | 80% athlete |
| Drip merch | 100% | — |

**Decided 2026-09-29 (owner):** keep the 10% and disclose it on the donate sheet — `MALO_DISCLAIMER` and `donationSplitLine` now say 90% to the family account, 10% to Tapua'i (which also covers card processing). The `tip` row is written by trigger `tips_platform_tip_revenue_ai` (migration `20260929180000`, not applied) when `tips.platform_tip_cents > 0`; `source_id` is the tip id. `get_company_revenue_summary` lists it as its own stream.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `transaction_type` | text | Same as `source` (legacy stub column) |
| `source` | text | `malo` \| `tip` \| `booster` \| `vault` \| `merch` \| `card_fee` (BOOKS-01, not applied) |
| `source_id` | text | Unique with `source` (tip / sponsorship / subscription / order id) |
| `label` | text | Human line for the Money desk |
| `payee_kind` | text | `athlete` \| `operator` \| `none` |
| `player_id` | uuid FK → `players` | Tagged athlete when the stream pays them |
| `recipient_id` | uuid | Legacy stub → `profiles` (unused by the Money desk) |
| `gross_cents` / `platform_cents` / `payout_cents` | integer | Stripe-style cents |
| `gross_amount` / `platform_cut_amount` / `payout_amount` | numeric | Dollars (legacy stub; kept in sync) |
| `created_at` | timestamptz | |

**RLS (2026-09 audit):** admin-only SELECT / writes (`anon` bypass dropped — all legitimate writes flow through the SECURITY DEFINER trigger `company_revenue_after_source_insert` / `record_company_revenue`, which is unaffected by table grants). `record_company_revenue` / `sync_company_revenue_logs` EXECUTE also revoked from `anon`/`authenticated` entirely — no client ever called them directly, and `record_company_revenue`'s `on conflict (source, source_id) do update` made it a direct route to overwrite an existing ledger row if it had stayed callable. `gross_cents` / `platform_cents` / `payout_cents` now have `>= 0` CHECK constraints. Incremental: `supabase/company_revenue.sql`. Clients: the admin reports read the summary through `lib/adminReports.ts` (`get_company_revenue_summary`) and Finance & Books reads the table through `lib/bookkeeping.ts`; both need a real authenticated admin session.

### `stripe_webhook_events`

Dedup ledger for `supabase/functions/stripe-webhook`, added in the **2026-09 Round 10 sweep**. Stripe can redeliver the same webhook event (retries, occasionally near-simultaneous duplicates), and the earlier idempotency guard was a `select` against `telemetry_logs` followed later by an `insert` marking it processed — two non-atomic steps, so two concurrent deliveries for the same PaymentIntent could both pass the check before either finished writing, double-crediting Aura / double-inserting a `tips` row (dormant today, since the webhook's rich-metadata credit path isn't reachable yet, but a real bug once it is).

| Column | Type | Notes |
| --- | --- | --- |
| `payment_intent_id` | text PK | Stripe `PaymentIntent.id` |
| `processed_at` | timestamptz | |

**RLS:** no policies at all for `anon`/`authenticated` — service-role only, since only the Edge Function (using the service key, which bypasses RLS) ever touches this table. The webhook now `insert`s here **first**; a `23505` unique-violation on that insert (not a prior `select`) is what means "another delivery already claimed this event" — atomic because Postgres's own primary-key enforcement decides it, not application code racing a check against a write.

### Data governance closures (DATA-01, `20261013120000_data_governance_closures.sql`, **written 2026-10-13, not applied**; replayed 46/46 on PGlite with `scripts/replay/data01-closures-replay.mjs`)

Every function below is security definer with `set search_path = ''`; admin functions call `require_admin_guard()` first; EXECUTE for `authenticated` only.

| RPC | Closes | What it does | Caller |
| --- | --- | --- | --- |
| `admin_upsert_athlete_career_stats(p_player_id, p_sport, p_games_played, p_scoring_value, p_volume_value, p_mvp_badges)` | F1 | Creates or replaces an athlete's career line (0–100,000 each) | Athletes desk → Stats (`AthleteRecordsPanel`) |
| `admin_add_athlete_game_log(p_player_id, p_played_on, p_opponent_school, p_stat_line, p_scoring_value, p_volume_value)` | F1 | Adds a game line (date not in the future, text ≤ 120) | same |
| `admin_remove_athlete_game_log(p_log_id)` | F1 | Removes a mistaken game line | same |
| `clear_my_crew_alerts()` | F2 | Deletes the caller's own `crew_push_queue` rows; returns the count | Activity → Crew alerts (`CrewAlertsCard`) |
| `admin_list_operator_checkins(p_limit)` | F3 | Expires check-ins older than 30 days, then lists recent ones with latitude / longitude at 2 decimals (~1 km) | Live games desk (`OperatorCheckinsPanel`) |
| `admin_purge_operator_checkins(p_older_than_days)` | F3 | Clears sooner than 30 days (minimum 7; default 30) through `expire_operator_checkins` | same |
| `expire_operator_checkins(p_older_than_days)` | F3 | The one retention rule: deletes check-ins older than the window (default 30, never under 7). No client EXECUTE | The trigger and the two admin functions above |
| `operator_checkins_minimize()` (trigger, before insert on `operator_checkins`) | F3 | Rounds latitude / longitude to 2 decimals, sets `checked_in_at` to the server time, expires old rows (PRIVACY_ENGINEERING decision 2026-10-13: 30 days) | Every check-in insert |
| `admin_list_school_confirmers(target_school_id)` | F4 | Confirmers for a school without `token_hash` | Schools desk (`SchoolStaffPanel`), which also calls `admin_add_school_confirmer`, `admin_revoke_school_confirmer`, `admin_set_school_branding` |

The People desk's "Revoke and unlink" calls `admin_revoke_verification` (it says "not switched on" where the
RPC is missing; Unverify stays a badge-only `profiles` update), the Schools desk reads current branding
before saving it, and the Athletes desk calls `admin_set_custodial_terms`. `get_aura_tier` is dropped (F5).
Table grants narrowed by the same migration (RLS_SECURITY review): `operator_checkins` keeps client INSERT
only, through the insert-only policy "Operators insert checkins" (supersedes "Operators write checkins"
from `20261002120000`), so no client can read exact coordinates; `school_confirmers` SELECT is column-level
without `token_hash`. `clear_my_crew_alerts` also deletes any alert older than 30 days.

### Books ledger (`ledger_accounts`, `ledger_manual_entries`, `ledger_manual_lines`, `ledger_period_closes`, `ledger_period_reopens`)

BOOKS-01, migration `20261012210000_bookkeeping_ledger.sql` (**written 2026-10-12, revised 2026-10-13 after RLS_SECURITY and CONTROLLER/TAX review, not applied**; replayed 72/72 on PGlite / Postgres 18.6 with `scripts/replay/books01-ledger-replay.mjs`).
Design: `docs/engineering/design/BOOKKEEPING.md`. The admin Books desk (`/admin/books`) builds a
double-entry journal in the client from `company_revenue_logs` and paid `disbursements`; these tables
hold only what cannot be derived.

| Table | Purpose |
| --- | --- |
| `ledger_accounts` | Chart of accounts (`code` 4 digits PK, `name`, `account_type` asset / liability / equity / revenue / expense, `active`). Seeded; codes match `CHART_OF_ACCOUNTS` in `packages/shared-types/admin/bookkeeping.ts` (unit test). |
| `ledger_manual_entries` | Hand-entered entries: `entry_date`, `kind`, `memo`, `reference`, `reverses_id` (one reversal per entry), `voided_at` / `void_reason`, `created_by`. Never edited or deleted. |
| `ledger_manual_lines` | Lines: `entry_id`, `account_code` FK, `debit_cents` / `credit_cents` (bigint, exactly one above zero), `athlete_ref` (`ath-` + 8 hex, nullable) so a recorded refund or payout reduces the right athlete's held balance. |
| `ledger_period_closes` | `period` (`YYYY-MM`) PK, `closed_at`, `closed_by`, `note`, `totals` jsonb (the close fingerprint from the desk: net cents per account, `entries` count and `athlete:<ref>` held movement, so later changes are detected). |
| `ledger_period_reopens` | Every reopen: `period`, `reopened_at`, `reopened_by`, `reason`, `previous_closed_at`, `previous_totals` (the fingerprint it replaced). |

**RLS:** admin-only SELECT (`to authenticated`) on all five; no client INSERT / UPDATE / DELETE grant. **RPCs**
(security definer, `set search_path = ''`, `require_admin_guard()` first, EXECUTE for `authenticated` only;
each takes a per-month advisory lock through `ledger_lock_period(p_period)` so close, record, void and
reopen of the same month serialize):
`record_ledger_entry(p_entry_date, p_kind, p_memo, p_reference, p_lines jsonb)` — 2–20 lines, each one
side, ≤ $1M, known active account, optional well-formed `athlete_ref`, debits = credits > 0, date 2020-01-01
to today (UTC), reserved kinds refused, month open; `void_ledger_entry(p_entry_id,
p_reason, p_reversal_date)` — posts the mirror entry (athlete references kept) dated 2020-01-01 to today in
an open month and marks the original voided;
`close_ledger_period(p_period, p_note, p_totals)` — finished months only; `reopen_ledger_period(p_period,
p_reason)` — writes a `ledger_period_reopens` row with the replaced totals; `get_ledger_books()` — accounts,
entries with lines, closes and reopens. Helpers `ledger_period_is_closed(p_day)` and `ledger_lock_period(p_period)`
are not callable by clients (EXECUTE revoked from `authenticated`).

Same migration: `company_revenue_logs.source` also allows `card_fee` (`company_revenue_bps` 10000), via
trigger `tips_card_fee_revenue` (AFTER INSERT on `tips`, `tips_card_fee_revenue_ai`), and
`get_company_revenue_summary` lists it as its own stream so the streams add up to the total.
`disbursements.paid_at` timestamptz is owned by the server: trigger `disbursements_paid_at` (BEFORE INSERT
OR UPDATE, `disbursements_paid_at_bu`) sets it when a payout first becomes `paid`, keeps it while paid,
clears it otherwise, and always replaces a client value; existing paid rows are backfilled from
`created_at`. `tips.stripe_payment_intent_id` is unique when present (`tips_stripe_payment_intent_key`).
Pre-existing until `20261013220000` is applied: users with the `parent` role can update any disbursement row
(policy "Admin write disbursements"); BOOKS-01 closes the backdating route; `20261013220000_disbursements_guardian_scope.sql` (written, not applied) narrows the policy itself: admin-only writes, reads for admins and the athlete's custodial parties. Its trigger
`disbursements_paid_final()` (BEFORE UPDATE) makes a paid payout final: amount and athlete cannot change except from a trusted
server session; correct a wrong payment with a new row (BOOKS-01 never edits history). Status may still move (a bank return).

### `app_runtime_config`

Single-row fan chrome map (`id = 'default'`). Admin **Features** writes `draft`. **Publish to app** copies `draft` onto `published`. The fan app reads `published` (`AppRuntimeContext.live`). Missing keys stay **on**.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Always `default` |
| `draft` | jsonb | Unpublished tabs / buttons / layouts |
| `published` | jsonb | What fans see |
| `published_at` | timestamptz | Last Publish to app |
| `updated_at` | timestamptz | Last draft write |

JSON groups: `tabs` (home / local / spotlight / drip / profile / upload), `buttons` (seki / aura / flex / malo / more / subscribe / crew / vault / flashUnlock / **suggest**), `layouts` (liveMatches / cheerPolls / topBoosters / sponsorshipModal / spotlightModal / homeSearch / localSearch / **operatorConsole** (default **off** until Features + Publish) / parentHq / boosterHq / sponsorHq / **slangGuide** / **receipts** / **wishlist**), `theme` (background / surface / jade / gold / text; default **Daylight** `#F3FAF6` / `#00733C`), `profile` (showCard = Flip Aura card from hamburger — not the default hero / showCrew = slim Crew · Squad strip / showStats / showVault / actionsOnTop / statsFirst; Next portal + Expo Look draft these via `PROFILE_CHROME_FLAGS`), `highlights` (railSide / namePlacement / showSchool / showCaption / railOrder), `copy` (Home / Local / Spotlight / Drip kickers and ledes, `slangLine`, Profile / Receipts kickers and ledes, Operator / Parent / Booster / Sponsor ledes, optional `homeBannerTitle` / `homeBannerBody`), **`catalog`** (`maloAmounts`, `maloFeeDollars`, `exclusiveDollars`, `exclusiveAura`, `classYears`, `localFilters`, `sponsorTiers`, `reelCategories`). Client desks: `/admin/features` (flags + Soft-Wall board), `/admin/look` (colors, copy, Profile chrome, Highlights ⚡ rail), `/admin/catalog` (prices and chips), `/admin/lab` (JSON draft, hidden from the sidebar), `/admin/coverage` (client map of every fan control → desk / flag / telemetry, including Soft-Wall auth surface; no extra table). Next portal (`pnpm admin`) also reads published Soft-Wall flags + fan counts via `SOFT_WALL_GATES`.

**RLS (2026-09 audit):** public SELECT stays (the fan app reads `published` on boot, before any sign-in); INSERT / UPDATE now authenticated-admin only (`anon` bypass dropped). `patch_app_runtime_draft` / `publish_app_runtime` are SECURITY DEFINER so this table policy never actually gated them either way — both now also check `current_user_role() = 'admin'` internally. Incremental: `supabase/app_runtime.sql`. Client: `apps/mobile/src/frontend/lib/runtime.ts` + `/admin/features`.

### `app_feedback`

Fan suggestions for the admin improvement queue. Distinct from `report_reel` (clip Report / Hide). Incremental: `supabase/app_feedback.sql`. Client: `apps/mobile/src/frontend/lib/feedback.ts` + `/admin/feedback` + `/admin/lab`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `author_id` | uuid | `auth.uid()` when signed in |
| `body` | text | At least 8 characters |
| `kind` | text | `suggestion` \| `bug` \| `look` \| `other` |
| `surface` | text | `home` \| `local` \| `spotlight` \| `drip` \| `profile` \| `other` |
| `status` | text | `new` → `reviewing` → `planned` → `shipping` → `shipped` \| `declined` |
| `runtime_path` | text | Optional chrome key, e.g. `copy.spotlightLede` or `tabs.drip` |
| `admin_note` | text | Triage note |
| `created_at` / `updated_at` | timestamptz | |

**RLS (demo):** INSERT anyone; SELECT / UPDATE admin or `anon`.

### `submit_app_feedback`

```sql
submit_app_feedback(p_body text, p_kind text default 'suggestion', p_surface text default 'other') returns app_feedback
```

Anyone (Expo Go `anon` allowed). Grant: `EXECUTE` to `anon`, `authenticated`. Client: Profile **Send a suggestion** and Highlights ⋯ **Suggest an improvement**.

### `get_app_feedback`

```sql
get_app_feedback() returns setof app_feedback
```

Admin inbox, new first, limit 80. Grant: `EXECUTE` to `anon`, `authenticated`. Client: `/admin/feedback`.

### `triage_app_feedback`

```sql
triage_app_feedback(target_id uuid, next_status text, next_note text default '', next_runtime_path text default '') returns app_feedback
```

Moves a row through triage and optionally pins a runtime path for Engineer Lab. Grant: `EXECUTE` to `anon`, `authenticated`.

### `cheer_polls`

Local School Polls. Fans vote through `cast_cheer_vote`. Admins publish labels and active flags through `upsert_cheer_poll` (`/admin/polls`).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `slug` | text unique | `westlake-lone-peak` or `game-{id}` |
| `home_label` / `away_label` | text | Shown on `CheerPollCard` |
| `home_votes` / `away_votes` | integer | |
| `is_active` | boolean | Hidden from Local when false |
| `updated_at` | timestamptz | |

**RLS:** public SELECT. Writes require `current_user_role() = 'admin'` (`anon` bypass dropped). Votes stay on `cast_cheer_vote`. Incremental: `supabase/cheer_polls.sql` + `admin_portal.sql`.

### `cheer_poll_votes`

One row per signed-in account per poll (20261022130000). Written only by `cast_cheer_vote`, which now requires sign-in,
ignores the client's `previous_side` and moves one vote when an account switches sides.

| Column | Type | Notes |
| --- | --- | --- |
| `poll_slug` | text FK → `cheer_polls.slug` | PK with `voter_id` |
| `voter_id` | uuid | `auth.uid()` of the voter |
| `side` | text | `home` / `away` |
| `updated_at` | timestamptz | |

**RLS:** on, no client grants (definer function only).

### `player_hype_votes`

One row per account, player, hype kind and UTC day (20261022130000). `increment_player_hype` requires sign-in and adds
to `players` counts only when this row is new.

| Column | Type | Notes |
| --- | --- | --- |
| `voter_id` | uuid | PK part |
| `player_id` | uuid FK → `players.id` | PK part |
| `hype_kind` | text | `view` / `aura` / `flex` / `seki` |
| `voted_on` | date | UTC day; PK part |

**RLS:** on, no client grants (definer function only).

### `upsert_cheer_poll`

```sql
upsert_cheer_poll(poll_slug text, home_name text, away_name text, make_active boolean default true) returns jsonb
```

Admin publisher for School Polls. Requires `current_user_role() = 'admin'` inside the function. The old check (`role <> 'admin' AND auth.role() <> 'anon'`) rejected signed-in non-admins and let anon through. Grant: `EXECUTE` to `authenticated` only. Client: `/admin/polls`.

### `telemetry_logs`

Batched client performance **and** product-usage events (Reel stalls, Realtime reconnects, Mālo checkout latency, tab dwell, scroll depth, feature taps, control issues).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `event_type` | text | `video_stall` \| `video_first_frame` \| `socket_reconnect` \| `checkout_latency` \| `tab_dwell` \| `surface_scroll` \| `feature_tap` \| `ui_issue` \| `flash_unlock` \| `stripe_webhook_payment_succeeded` \| `screen_mount` \| `app_start` (last two: `20261020173000`, written, not applied; client sends them only while `layouts.telemetrySmoothness` is on) |
| `video_id` | text | `reels.id` for video events |
| `channel` | text | Realtime channel, or fan surface (`home` / `local` / `spotlight` / `drip` / `profile`) |
| `step` | text | Checkout phase, feature id (`hype.seki`, `malo`, `cheer_poll`), or failed control (`checkout`, `report`) |
| `duration_ms` | integer | Stall / TTFF / tab dwell ms; for `surface_scroll` this is 0–100 depth |
| `attempts` | integer | Consecutive socket errors before a reconnect log |
| `payload` | jsonb | Extra context |
| `created_at` | timestamptz | |

**RLS (demo):** INSERT anyone (guest browse included); SELECT authenticated. **Checks** (`20260929190000_telemetry_logs_bounds.sql`, applied to staging only): `event_type` must be one of the values above; `surface_scroll` duration is 0–100 (it stores depth); `tab_dwell` up to 12 hours; other durations up to 10 minutes; `attempts` 0–1000; text fields ≤80/160/80; `payload` ≤4000 bytes. A CHECK binds the service role too, so the webhook event type is in the list. This does not stop many small valid-looking rows — that needs STATE §6 item 1. Aggregates still reach `/admin/reports` through `get_admin_reports()` (security definer). Incremental: `supabase/telemetry_logs.sql` then `supabase/usage_reports.sql`. Client: `TelemetryManager.ts` + `useSurfaceUsage` (flush every 10s or queue size 15).

---

### `custodial_accounts` / `athlete_birthdates` / `custodial_withdrawals`

Owner money rules of 2026-09-29 ([PARENT_PAYEE_CONNECT_DESIGN.md](design/PARENT_PAYEE_CONNECT_DESIGN.md) §7). Incremental: `supabase/custodial_money.sql`. **Records only — nothing here moves money;** payouts stay 503 until the Phase 1a ledger ships.

| Table | Key columns | Notes |
| --- | --- | --- |
| `custodial_accounts` | `player_id` PK → `players`, `guardian_id` → `profiles`, `stripe_connect_id` (unique), `payouts_enabled`, `bank_in_athlete_name`, `handover_age` (18–21, default 18) | One account per athlete, so a guardian's account only ever holds that athlete's money. `handover_age` is admin-set per counsel (state majority / UTMA age). |
| `athlete_birthdates` | `player_id` PK, `birth_date`, `entered_by`, `entered_at` | Entered once by the guardian at custodial setup (COPPA: sign-up collects no birth date). Only an admin corrects it. No client ever reads the date directly. |
| `custodial_withdrawals` | `id`, `player_id`, `requested_by`, `requested_role` (`guardian` / `athlete`), `amount_cents` (1–100000), `note` (≤280), `status` (`pending_athlete` / `approved` / `declined` / `cancelled` / `paid`), `decided_by`, `decided_at` | A guardian request before handover waits for the athlete (`pending_athlete`); an athlete request after handover is `approved` at once. One pending request per athlete (partial unique index). |

RLS: SELECT only, when `custodial_role(player_id)` is not null (the verified athlete, their linked guardian, an admin). No client INSERT / UPDATE / DELETE — every write goes through the RPCs below.

### `verification_requests` (ladder columns) / `school_confirmers`

Migration `supabase/migrations/20260929120000_athlete_verification_ladder.sql` ([ATHLETE_VERIFICATION_DESIGN.md](design/ATHLETE_VERIFICATION_DESIGN.md)). **Not applied yet.**

| Table | Columns | Notes |
| --- | --- | --- |
| `verification_requests` (added) | `sport`, `class_year`, `jersey`, `meet_code_hash`, `meet_code_expires_at`, `meet_code_attempts`, `confirmer_id` → `school_confirmers`, `confirmer_name` (typed signature), `decided_at`, `decision_note` | `status` ∈ `pending` / `approved` / `rejected` / `disputed` / `revoked`. One open (`pending` / `disputed`) request per account (partial unique index). `player_id` here is the roster row the athlete *says* is them; `profiles.player_id` is only set on approval. The 6-digit meet code is stored as a sha256 hash, valid 30 minutes, void after 5 wrong tries. |
| `school_confirmers` | `id`, `school_id` → `schools_and_teams`, `full_name`, `email`, `staff_role` (`athletic_director` / `coach`), `sport` (null = every sport), `token_hash` (unique), `active`, `expires_at` (+1 year), `created_by`, `created_at`, `last_used_at` | One row per athletic director or coach. The link token is shown once by `admin_add_school_confirmer` and stored hashed. RLS: admin SELECT only; no client writes. |

### `reel_views` + `reels.view_count`

M1 leaderboards (Release Wave 0). Incremental: `supabase/leaderboards.sql`. `reels.view_count` (int, ≥0) is the counted views for a Highlight; it is not in the `reels` column UPDATE grant, so only `record_reel_view` moves it. `reel_views` (`reel_id`, `viewer_id`, `view_day`, all three the PK) is the throttle: one counted view per signed-in viewer per clip per UTC day. RLS on, no policies, no client grants.

## Custom functions

Changing a function’s return type requires **`DROP FUNCTION` first** (Postgres `42P13`). `supabase/add_user_aura.sql` already drops `add_user_aura(uuid, integer)` and `get_aura_tier(integer)` before recreate.

### `add_user_aura(target_user_id, points_to_add)`

Postgres:

```sql
add_user_aura(target_user_id uuid, points_to_add integer) returns jsonb
```

Mālo (`!skipBacker`) calls this **twice** with the same signature: tipper `user.id` (Fan Aura on `profiles`) then reel `player.id` (Athlete Aura on `players`). Skip the second call when the ids match. Exclusive subscribe, Drip, and booster sponsorships (`skipBacker`) grant **only the payer**. `points_to_add = tipAmount * 10` on Mālo (fee cover does not add Aura). Exclusive subscribe on `/athlete/[id]` passes **`points_to_add = 100`**. Drip Buy Now passes **`order dollars × 10`**. Sponsorships pass **500 / 2,000 / 10,000**.

Any authenticated user, including verified athletes, may drop Mālo.

- Increments `players.aura_points` where `id = target_user_id`
- Increments `profiles.aura_points` where `user_id` or `id` matches
- Returns `{ aura_points, player_aura_points, profile_aura_points, points_added }`

Grant: `EXECUTE` to `authenticated` only (2026-09 audit — `anon` revoked). Client: `apps/mobile/src/frontend/hooks/useTipCheckout.ts` via `addUserAura`. **Security note:** this RPC still cannot verify from SQL alone that a real Stripe charge happened (it's called for both the tipper and the recipient after client-side `presentPaymentSheet()` resolves), so as a stopgap it rejects `points_to_add > 5000` per call (bypassed only for the `service_role` caller — see `supabase/functions/stripe-webhook/index.ts`, the server-verified path meant to eventually replace this client-facing call entirely). **2026-09 compliance (freeze-switch fix):** also raises when `malo_target_frozen(target_user_id)` is true — checked unconditionally (no `service_role` exemption). Because `malo_target_frozen` only matches a `profiles` row keyed by `player_id = target_user_id`, this is a no-op for the tipper's own call (`target_user_id` is an auth/profile id, not a `players.id`) and only blocks the athlete-recipient call, from every caller (checkout, `ReelCard` double-tap Like, `chip_in_wishlist_item`) — not just `useTipCheckout.ts`.

### `add_user_role(new_role)`

```sql
add_user_role(new_role text) returns text[]
```

Unions `new_role` onto the signed-in `profiles.roles` (`auth.uid()`). Adding `athlete` also keeps `fan` and sets `role` + `active_role` to `athlete`. It does **not** set `is_verified` — school claim is not Varsity. Incremental: `supabase/add_user_role.sql`. Client: `addUserRoleRemote` / `AuthContext.addUserRole`.

**2026-09 self-escalation fix:** this RPC always writes the caller's own row (`auth.uid()`) and previously had no check on which role was being requested — any authenticated session could call `supabase.rpc('add_user_role', { new_role: 'admin' })` and set `is_admin = true` on itself, a full privilege escalation with zero verification. `fan` and `athlete` are the only roles with a real self-service UI path (`RoleSwitcherModal` → `AuthContext.completeAthleteOnboarding`), so those two stay unrestricted. Every other role — `admin`, `parent`, `operator`, `booster`, `sponsor` — has no legitimate self-service caller anywhere in the frontend today (operator access is purely PIN-based via `lib/operator.ts` and never touches `profiles`; there is no "become a booster/parent/sponsor" flow), so the function now raises unless the caller's `current_user_role()` is already `'admin'` before the call runs. A `before insert or update` trigger on `profiles` (`guard_profiles_admin_escalation`) closes the equivalent raw-`UPDATE` and raw-`INSERT` bypasses (`supabase.from('profiles').update({ is_admin: true, ... })`, or a fabricated `insert` of a brand-new admin row) for the same reason — see the `profiles` RLS note above.

### `malo_target_frozen(target_player_id)` / `set_malo_freeze(target_type, target_id, frozen)`

```sql
malo_target_frozen(target_player_id uuid) returns boolean
set_malo_freeze(target_type text, target_id uuid, frozen boolean) returns boolean
```

Compliance kill switch (`LEGAL_BRIEFING.md` §8 item 5) so the team can honor a written direction from a school/association to freeze Mālo for a named athlete or school within hours — this blocks **money**, not content (Highlights/Vault stay visible; only new `tips` and new/updated `subscriptions` rows are rejected).

`malo_target_frozen(target_player_id)` is a `stable` helper: true when the `profiles` row with `player_id = target_player_id` has `malo_frozen = true`, or that profile's `school_id` points to a `schools_and_teams` row with `malo_frozen = true`. An unclaimed roster row (no linked `profiles` row) has nowhere to store a freeze flag, so it reads as not-frozen. Used directly inside the `tips` and `subscriptions` INSERT/UPDATE `with check` clauses (see those tables above) — not a client-side check, a database one. Grant: `EXECUTE` to `anon`, `authenticated` (called from inside RLS policy evaluation).

**2026-09 freeze-switch fix:** the `tips` INSERT policy rejecting a frozen athlete's ledger row turned out to block *only that row* — `increment_backer_count`, `add_user_aura`, `increment_reel_tips`, and `chip_in_wishlist_item` had no freeze check of their own, so the fan's card was still charged and the athlete's public backer count / Aura / reel tip total still moved even when the `tips` insert silently failed. All four now call `malo_target_frozen` themselves and raise when the target is frozen (see each RPC above / below), so the freeze blocks the visible effects, not just the bookkeeping row. `useTipCheckout.ts` was also reordered so `incrementBackerCount` and the recipient's `add_user_aura` call only run after the `tips` insert actually succeeds. Deeper still, `POST /api/create-payment-intent` (`createPaymentIntent.ts`) now accepts an optional `playerId` and checks `malo_target_frozen` **before minting the Stripe PaymentIntent**, so a Mālo tip / vault unlock / exclusive subscribe for a frozen athlete is rejected before the fan's card is ever charged (403, "This athlete cannot currently receive Mālo."); player-agnostic charges (Drip merch, booster sponsorships) omit `playerId` and are unaffected. `increment_player_hype` / `increment_reel_hype` were deliberately left unchanged — they bump `aura_count`/`flex_count`/`seki_count`/`view_count` (free engagement taps), a different column family from `aura_points` and outside what "Mālo" (money) means in `LEGAL_BRIEFING.md` §8.

`set_malo_freeze(target_type, target_id, frozen)` is the **only** way to flip `profiles.malo_frozen` (`target_type = 'athlete'`, `target_id` = `profiles.id`) or `schools_and_teams.malo_frozen` (`target_type = 'school'`, `target_id` = `schools_and_teams.id`). `SECURITY DEFINER`, checks `current_user_role() = 'admin'` internally and raises `Access restricted` otherwise — no raw table UPDATE is granted for this column beyond what already exists. Grant: `EXECUTE` to `authenticated` only. Client: `setMaloFreeze` in `apps/mobile/src/frontend/lib/adminCatalog.ts`, called from Expo `/admin/people` (`PeopleTool.tsx`, per-athlete) and `/admin/schools` (`SchoolsTool.tsx`, per-school), each behind a confirm dialog.

### `athlete_stats_visible(target_player_id)`

```sql
athlete_stats_visible(target_player_id uuid) returns boolean
```

Mirrors `malo_target_frozen`'s shape: a `stable` helper that looks up the `profiles` row with `player_id = target_player_id`. Returns true (visible) when that profile's `profile_visibility->>'stats'` isn't explicitly `false`, or the caller is that profile's owner (`auth.uid()`), or the caller is admin. An unclaimed roster row (no linked `profiles` row) has no owner to hide anything, so it reads as visible. Used inside the `athlete_career_stats` / `athlete_game_logs` SELECT policies (see `players` measurables above) — a database-layer gate for the 2026-09 profile customization "hide stats from other users" toggle, not a client-side filter. Grant: `EXECUTE` to `anon`, `authenticated` (called from inside RLS policy evaluation).

### `redeem_team_code` / `request_athlete_verification` / `athlete_is_varsity_verified`

```sql
redeem_team_code(raw_code text) returns jsonb
request_athlete_verification(request_notes text default null) returns jsonb
athlete_is_varsity_verified(target_player_id uuid) returns boolean
normalize_team_code(raw_code text) returns text
team_code_school_key(raw_code text) returns text
sport_from_team_code_token(token text) returns text
```

**Superseded 2026-09-29 by the verification ladder (below).** Before it: `redeem_team_code` matched `schools_and_teams.team_code` (`WSTLK-2026` or `WSTLK-RUG-2026`), required `legal_terms_accepted_at`, set `is_verified` + `verification_status = verified`, and wrote an approved `verification_requests` row. `request_athlete_verification` queues a pending request (profile stays public). Helpers parse sport tokens (`RUG` → Rugby). `athlete_is_varsity_verified` gates Player of the Week. Incremental: `supabase/athlete_verification.sql`. Client: `VerifyAthleteModal` / `lib/verification.ts`.

**2026-09 Round 12 sweep — two fixes:** (1) every school's real `team_code` used to be hardcoded in plain text in this repo (`schema.sql` and `supabase/athlete_verification.sql`) — removed; a real school's code must now be set directly via the Supabase SQL Editor and handed to the coach out-of-band, never committed to a file. (2) `redeem_team_code` had no rate limit, and the `SCHOOL-SPORT-YEAR` format is a small enough keyspace to brute-force directly through the RPC even without a leak. Added `profiles.team_code_fail_count` / `profiles.team_code_locked_until`: 5 wrong codes locks that account out of redeeming for 15 minutes (a correct code resets the counter); checked before the code lookup runs, so a locked-out account can't keep using the call to probe codes either.

Grant: `EXECUTE` to `anon`, `authenticated`.

### `handle_new_auth_user()`

```sql
handle_new_auth_user() returns trigger
```

`AFTER INSERT` on `auth.users` (`on_auth_user_created`). Inserts a base `profiles` row (`role` / `roles` / `active_role` = fan) when missing. Pairs with client `ensureFanProfile` after Soft-Wall Apple / Google / Magic Link. Incremental: `supabase/auth_fan_profile.sql`.

### `get_fan_tip_history(fan_user_id)`

```sql
get_fan_tip_history(fan_user_id uuid) returns table (
  id uuid,
  player_id uuid,
  reel_id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  athlete_name text,
  school_name text,
  origin text,
  entry text,
  wishlist_item_id uuid,
  source_label text
)
```

Filters `tips.fan_id` to `auth.uid()` only (2026-09 audit fix — the `fan_user_id` argument is accepted but ignored/never trusted as a fallback identity; an anonymous caller with `auth.uid()` null gets zero rows) and left-joins `players` for name + `school_name`. Return columns include the channel (`origin`, `entry`, `wishlist_item_id`, `source_label`). A new return shape needs `DROP FUNCTION` first (`42P13`). Incremental: `supabase/tip_origin.sql` (and `supabase/get_fan_tip_history.sql`). Client: `useFanTipHistory`.

Grant: `EXECUTE` to `authenticated` only (previously also granted to `anon`, which let anyone read any fan's tip history by passing an arbitrary `fan_user_id` — closed 2026-09).

### `get_received_malo(target_player_id)`

```sql
get_received_malo(target_player_id uuid) returns table (
  id uuid,
  amount_cents integer,
  aura_points integer,
  created_at timestamptz,
  origin text,
  entry text,
  source_label text,
  reel_id uuid,
  wishlist_item_id uuid,
  fan_name text,
  family_cents integer   -- 20261013231000 (not applied): what reached the family account
)
```

Gifts sent **to** an athlete. `tips` SELECT is the fan who paid or an admin, so the athlete cannot read their own incoming rows with a table select. This function returns rows only when the caller is an admin, the profile whose `player_id` matches `target_player_id`, or the linked guardian (`players.guardian_id`). Fan display name only. Incremental: `supabase/malo_ledger.sql` (after `supabase/tip_origin.sql`). Client: `useReceivedMalo` + `Profile/ReceivedMaloPanel` (own profile) and Athlete HQ. `family_cents` (from `20261013231000_family_share_in_received.sql`, not applied) is the books' recorded payout for that donation (`company_revenue_logs`, source `malo`), falling back to the current split; the panel leads with it instead of the donated total.

Grant: `EXECUTE` to `authenticated` only.

### `get_admin_malo_breakdown()`

```sql
get_admin_malo_breakdown() returns jsonb
-- { by_origin, by_entry, by_day, recent }
```

Admin-only (`current_user_role() = 'admin'`). `by_origin` and `by_entry` are all-time cents and counts. `by_day` is the last 14 UTC days split by origin. `recent` is the latest 40 gifts with athlete name, fan name, channel, item id, and clip id. Incremental: `supabase/malo_ledger.sql`. Clients: Next Money desk (`fetchPortalMaloBreakdown`) and Expo `/admin/money` (the Revenue report (`lib/adminReports.ts`)).

Grant: `EXECUTE` to `authenticated` only.

### `search_local_entities(search_query, entity_kind)`

```sql
search_local_entities(search_query text, entity_kind text default 'all')
  returns table (entity_type text, entity_id text, title text, subtitle text)
```

`entity_kind` is `all` | `athlete` | `school` | `booster`. Needle shorter than 2 characters returns no rows. Athletes come from `players` (name / school / team). Schools are distinct `games` home/away school and team labels (`entity_id` = display title). Boosters come from `sponsorships` (business name / school team). Incremental: `supabase/search_local_entities.sql`. Client: `useLocalSearch` (falls back to table SELECTs if the RPC is missing).

Grant: `EXECUTE` to `anon`, `authenticated`.

### `report_reel(target_reel_id, report_reason)`

```sql
report_reel(target_reel_id uuid, report_reason text) returns jsonb
  -- { id, is_flagged, reported_by, reason, report_count }
report_reel(target_reel_id uuid) returns jsonb  -- same, reason 'unspecified'
```

Requires `auth.uid()`. Writes `reel_reports` (one row per account) and appends the reporter onto `reels.reported_by`. Sets `is_flagged` for fake footage, impersonation, or music/logo/broadcast; for a report from the tagged athlete or their guardian; or after three accounts. Grant: `EXECUTE` to `authenticated` only. Incremental: `supabase/migrations/20261001180000_content_rights_reports.sql` (replaces `supabase/report_reel.sql`). Client: `reportReelRemote` + `ReportContentModal` (local hide via `tapuai.hiddenReels` even for guests / seeded `hl-*` ids).

### `publish_spotlight_award`

```sql
publish_spotlight_award(target_player_id uuid, award_headline text, period_kind text, window_start date, window_end date) returns jsonb
```

Admin-only (`current_user_role() = 'admin'`, checked inside the function). Upserts `spotlight_awards` for Player of the Week / Month / Year and **locks** the window so hype will not overwrite it. Links `player_id` plus a matching `profiles` row when possible. Featured tape is the athlete's hottest confirmed public clip. Grant: `EXECUTE` to `authenticated` only (`anon` dropped — the role check already made it a no-op, same pattern as `moderate_flagged_reel`). Incremental: `supabase/admin_dashboard.sql` + `supabase/spotlight_auto.sql`. Client: `useAdminDashboard`.

### `moderate_flagged_reel`

```sql
moderate_flagged_reel(target_reel_id uuid, moderation_action text) returns jsonb  -- { id, is_flagged, is_removed }
```

Admin-only (`current_user_role() = 'admin'`, checked inside the function). `dismiss` clears `is_flagged`. `remove` sets `is_removed` so Highlights ⚡ hides the clip. `restore` (**2026-09**, added alongside the `reels` RLS tightening) clears `is_removed` — the `/admin/highlights` desk's un-remove toggle now calls this instead of a raw `reels` UPDATE, since `is_removed` is no longer in that table's column grant. Grant: `EXECUTE` to `authenticated` only (`anon` dropped — the role check already made it a no-op). Incremental: `supabase/admin_dashboard.sql`.

### `get_admin_platform_metrics`

```sql
get_admin_platform_metrics() returns jsonb  -- highlight_count, engagement_count, malo_cents, open_flags, telemetry_events_24h
```

Admin dashboard Telemetry cards. Engagement is Seki + Aura + Flex on live clips. Mālo is `sum(tips.amount_cents)`. Incremental: `supabase/admin_dashboard.sql`. **2026-09 Round 18 sweep, critical:** was anon-executable with no role check at all — `malo_cents` is the platform's total Mālo revenue across every fan/athlete, readable with no login. Same gap already fixed for `get_admin_reports`/`get_company_revenue_summary`, just never applied here; now requires `current_user_role() = 'admin'`. `lib/admin.ts`'s `fetchAdminPlatformMetrics` already has a client-side fallback (direct `reels`/`tips`/`telemetry_logs` reads) for when the RPC errors — that fallback is bounded by those tables' own RLS (a non-admin only ever saw their own `tips` rows there), so this fix doesn't newly break anything, it just stops the RPC itself from handing out the full platform total to anyone.

### `patch_app_runtime_draft(next_draft)`

```sql
patch_app_runtime_draft(next_draft jsonb) returns jsonb  -- { draft, published, published_at, updated_at }
```

Writes Features draft. Fans still see `published` until `publish_app_runtime`. Incremental: `supabase/app_runtime.sql`. Client: `saveAppRuntimeDraft`. **2026-09 audit:** `EXECUTE` restricted to `authenticated`; internally raises unless `current_user_role() = 'admin'` (SECURITY DEFINER bypasses the table's RLS, so the real gate has to live in the function body — was previously callable by literally anyone).

### `publish_app_runtime()`

```sql
publish_app_runtime() returns jsonb  -- copies draft onto published, sets published_at
```

Gold **Publish to app** in the admin sidebar. Incremental: `supabase/app_runtime.sql`. Client: `publishAppRuntime`. **2026-09 audit:** same tightening as `patch_app_runtime_draft` above — `authenticated` + internal admin check.

### `get_admin_reports()`

```sql
get_admin_reports() returns jsonb
  -- generated_at, engagement, money, content, audience, live, reliability,
  -- usage, tabs, features, issues, scroll, leaders,
  -- donation_bands { under_50, 50_to_250, 250_plus },
  -- series { clips, malo, stalls, dwell },
  -- trivia { prep_views/start_presses/starts/answers/nexts/completes/abandons/unavailable_7d,
  --   start/answer/next/explanation_failed_7d, by_position_7d, starts_by_kind_7d },
  -- smoothness { mounts_7d, avg_mount_ms_7d, by_surface_7d, app_starts_7d, avg_start_ms_7d }
```

**2026-10-20 (`supabase/migrations/20261020180000_reports_trivia_smoothness.sql`, written, not applied anywhere):** new top-level `trivia` and `smoothness` keys (behavior-logging Step 3). Trivia counts the Step-1 funnel over 7 days (starts, answers, Nexts, completions, abandonments, missing-content ends, the four failure controls, answers per question position with a digit-guarded cast, starts per round kind). Smoothness counts `screen_mount` / `app_start` rows (Step 2): mounts and cold starts, both averages, average mount per surface. Counts only, never names, ids, question text or account data; on a database without the `20261020173000` whitelist the smoothness keys read zero. Full-body rewrite that includes the 20261012180000 casts and bands — apply after (or instead of) that file, never before it; rollback re-applies 20261012180000. Trivia keys fill as soon as clients log; smoothness keys fill after 20261020173000 + `layouts.telemetrySmoothness`. **2026-10-20 (`20261020174500_reports_trivia_funnel_top.sql`, written, not applied anywhere):** trivia gains `prep_views_7d` + `start_presses_7d` (preparation views and Start taps, the funnel top). Full-body rewrite including 20261020180000 — apply after (or instead of) it, rollback re-applies it.

**2026-10-12 (owner decisions; `supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql`, written, not applied anywhere):** every milliseconds or cents sum is cast to `bigint` instead of `int` (`usage.dwell_ms_24h` / `dwell_ms_7d`, `tabs[].value`, `series.dwell`, `series.malo`, the `money.*_cents` sums, `leaders.malo[].value`). A 7-day tab-dwell sum passed 2^31 ms at about 596 hours and the cast failed the whole RPC. Values below 2^31 are unchanged. New top-level `donation_bands` (owner decision 3C) counts athletes by all-time donation total in cents: `under_50` is more than 0 and under 5000, `50_to_250` is 5000 to under 25000, `250_plus` is 25000 and up. Counts only, never names or ids; same source as `leaders.malo` (every `tips` row, grouped per player), so the numbers agree; `{"under_50": 0, "50_to_250": 0, "250_plus": 0}` when there are no donations. `leaders.malo` (top-5 names) is still returned so existing readers keep working; the portal stops showing names, and dropping the key is a later call. EXECUTE is revoked from `public` and `anon` and granted to `authenticated`.

Usage windows (24h / 7d / previous 7d), Mālo, Vault / Flash Unlock / Spotlight mix, Crew follows, telemetry stalls, **tab dwell / scroll / feature taps / control issues**, top Mālo / hottest clips / athletes-by-school, and `series` (7-day clips / Mālo / stalls / dwell). Incremental: `supabase/app_runtime.sql` + `supabase/admin_reports.sql` + `supabase/usage_reports.sql`. Client: Expo `/admin/reports` and Next `http://localhost:3001/reports`. **2026-09 audit:** `EXECUTE` restricted to `authenticated`; internally calls `require_admin_guard()` (new helper — `language sql` functions can't use `if/raise` directly) and raises unless the caller is admin. Was previously anon-executable with no role check at all — anyone could read platform-wide money/audience aggregates.

### `require_admin_guard()`

```sql
require_admin_guard() returns void
```

2026-09 audit addition. Small SECURITY DEFINER helper — raises `Admin access required` unless `current_user_role() = 'admin'`, else no-ops. Exists because `get_admin_reports()` is `language sql` (no `if/raise` control flow available directly); called as `select public.require_admin_guard();` as that function's first statement.

### `company_revenue_bps(stream_source)` / `record_company_revenue` / `sync_company_revenue_logs`

```sql
company_revenue_bps(stream_source text) returns integer  -- 1000 Mālo / 1500 booster / 2000 vault / 10000 merch
record_company_revenue(
  p_source text,
  p_source_id text,
  p_gross_cents integer,
  p_payee_kind text default 'none',
  p_player_id uuid default null,
  p_label text default '',
  p_created_at timestamptz default now()
) returns uuid
sync_company_revenue_logs() returns integer
company_revenue_after_source_insert() returns trigger
```

BPS stay in lockstep with `apps/mobile/src/frontend/data/finance.ts`. Triggers on `tips`, `sponsorships`, `subscriptions`, `shop_orders` call `record_company_revenue`. A Mālo log stays `source = malo`; the label is `Mālo ·` plus `tip_origin_label` and the athlete name. `sync_company_revenue_logs` backfills unique `(source, source_id)` rows. Booster gross reads `amount_cents` or, on older remotes, `monthly_amount`. Incremental: `supabase/company_revenue.sql` (same Mālo label as `schema.sql`) and `supabase/tip_origin.sql` (the helper and columns).

### `get_company_revenue_summary()`

```sql
get_company_revenue_summary() returns jsonb
  -- total_gross, total_platform_revenue, total_payouts (dollars)
  -- gross_volume_cents, company_net_cents, payouts_cents, stripe_paid_cents
  -- streams[] (Mālo / boosters / merch+vault), recent[]
```

`VOLATILE` — runs `sync_company_revenue_logs` then aggregates. Client: Expo `/admin/money` and Next `http://localhost:3001/money`. Grant: `EXECUTE` to `anon`, `authenticated`. Changing the old `TABLE(total_gross, …)` return type required `DROP FUNCTION` first.

### `toggle_reel_vault_status(target_reel_id)`

```sql
toggle_reel_vault_status(target_reel_id uuid) returns boolean  -- next is_vault_only
```

Requires `auth.uid()` and (**2026-09**) either the clip's `uploaded_by` or an admin — previously any signed-in user could flip any clip's Vault flag, not just their own. Flips `reels.is_vault_only` and writes the same value to `is_exclusive`. Default is **false** (free public feed). Grant: `EXECUTE` to `authenticated` only (`anon` dropped — `actor is null` already made it a no-op). Incremental: `supabase/toggle_reel_vault_status.sql`. Client: `toggleReelVaultStatus` + `AthleteReelManager` (own clips) / `/admin/highlights` (any clip); optimistic local write; table UPDATE fallback if the RPC is missing (still RLS/column-scoped to uploader-or-admin, same as the RPC).

### `set_player_vault_locked(target_player_id, is_locked)`

```sql
set_player_vault_locked(target_player_id uuid, is_locked boolean) returns boolean
```

Requires `auth.uid()`. Writes `players.vault_locked`. Default **true**: Vault clips stay behind Subscribe ($4.99/mo) until the athlete taps Open Vault 🌐. **2026-09 audit follow-up:** the function had zero ownership check — any signed-in fan could lock/unlock any athlete's Vault. Now requires either the caller's own `profiles.player_id = target_player_id` (the athlete managing their own row from `app/(tabs)/profile.tsx`'s `manageVault`) or `current_user_role() in ('booster', 'admin', 'operator')` (the admin Athletes desk), mirroring the "Staff write players" RLS policy. Grant narrowed to `authenticated` (was also `anon`). Incremental: `supabase/player_vault_lock.sql`. Client: `setPlayerVaultLocked` + `VaultLockCard`.

### `get_aura_tier(points)`

```sql
get_aura_tier(points integer) returns jsonb  -- { tier, title, min_points, color }
```

**Archived 2026-10-13 (DATA-01-F5, owner approved):** nothing called it — the app computes tiers in `aura.ts` (`auraTierForPoints`). Dropped by `20261013120000_data_governance_closures.sql` (not applied); the definition is kept in `archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql`. `AURA_TIERS` in `aura.ts` is the single source of truth.

Other RPCs: `increment_backer_count` (`EXECUTE` to `authenticated` only; `supabase/increment_backer.sql` revokes `anon` so a re-run cannot widen it), `increment_player_hype`, `increment_reel_hype` (returns `applied`; no-ops a second Seki / Aura / Flex from the same `auth.uid()`; then `sync_live_spotlight_awards`), `clear_reel_hype` (second tap; deletes the vote, decrements the counter, then `sync_live_spotlight_awards`; `authenticated` only), `increment_reel_tips`, `cast_cheer_vote`, `upsert_cheer_poll`, `update_game_score`, `current_user_role` (returns `admin` when `is_admin` or `roles` includes admin), `get_fan_tip_history`, `tip_origin_label` (immutable channel phrase for receipts and `company_revenue_logs`; execute revoked from `public` and `anon`), `search_local_entities`, `search_schools_and_teams`, `report_reel`, `publish_spotlight_award`, `moderate_flagged_reel`, `get_admin_platform_metrics`, `patch_app_runtime_draft`, `publish_app_runtime`, `get_admin_reports`, `company_revenue_bps`, `record_company_revenue`, `sync_company_revenue_logs`, `company_revenue_after_source_insert`, `get_company_revenue_summary`, `submit_app_feedback`, `get_app_feedback`, `triage_app_feedback`, `toggle_reel_vault_status`, `set_player_vault_locked`, `get_active_spotlight_award`, `get_crew_graph`, `toggle_crew_follow`, `set_reel_flash_unlock`, `spotlight_normalize_kind`, `spotlight_window`, `can_confirm_player_tag`, `reels_apply_tag_defaults`, `confirm_reel_player_tag`, `get_pending_player_tags`, `get_spotlight_standings`, `sync_spotlight_period`, `sync_live_spotlight_awards`, `unlock_spotlight_period`, `redeem_team_code`, `request_athlete_verification`, `athlete_is_varsity_verified`, `normalize_team_code`, `team_code_school_key`, `sport_from_team_code_token`, `admin_set_player_guardian` (2026-09 parent-payee security fix — admin-only `players.guardian_id` setter; client `adminSetPlayerGuardian` in `lib/adminCatalog.ts`, called from Expo `/admin/athletes`'s "Link guardian" action, see the `players` guardian section above), `parent_set_player_consent` (2026-09 self-escalation audit follow-up — the linked parent's only remaining path to toggle `players.parental_consent_approved` / `guardian_consent_at`; client: `app/(parent)/parent/index.tsx`'s `toggleConsent`), `admin_approve_player_consent` (same pass — admin-only equivalent for the verification-approve flow; client: `setVerificationStatus` in `lib/adminCatalog.ts`), `guard_profiles_admin_escalation` (`before insert or update` trigger on `profiles`, not a callable RPC — rejects any UPDATE or INSERT that newly grants any of `admin`/`booster`/`operator`/`parent`/`sponsor` unless the calling session is already admin; see the `profiles.is_admin` row above — 2026-09 Round 15: generalized from admin-only). Cheer votes go through `cast_cheer_vote`; admin label edits go through `upsert_cheer_poll`. Re-run `supabase/cheer_polls.sql` after this signature change (`DROP FUNCTION` first):

```sql
cast_cheer_vote(
  poll_slug text,
  side text,
  previous_side text default null,
  home_name text default 'Westlake Thunder',
  away_name text default 'Lone Peak Knights'
) returns jsonb  -- { home_votes, away_votes }
```

Insert-on-miss seeds `home_name` / `away_name` at 0–0. Featured rivalry `westlake-lone-peak` is still preloaded at 124 / 98.

---

### Athlete verification ladder RPCs

Migration `supabase/migrations/20260929120000_athlete_verification_ladder.sql` (not applied yet). All `SECURITY DEFINER`. Client: `lib/verification.ts`, `lib/schoolConfirm.ts`, `useMyVerification`, `components/Verification/`, route `app/school-confirm.tsx`. Failures that must keep a counter (wrong meet code) return `{ok:false, error}` instead of raising.

| Function | Who | What |
| --- | --- | --- |
| `allow_verification_write()` | internal | Sets the transaction-local flag `app.tapuai_verification_write` that `guard_profiles_verification` honours. |
| `hash_secret(raw)` | internal | sha256 hex (pgcrypto). Tokens and meet codes are only stored hashed. |
| `is_admin_or_db()` | internal | `is_trusted_server()` or an admin. Always true or false. Hardened by `20261013210000_function_access_hardening.sql` (not applied): before it, an `anon` request with no claims also counted as the database, and the four ladder admin functions were still executable by `anon`. |
| `is_trusted_server()` | internal | The one "server, not a client" test: `service_role`, or a session with no JWT role that did not switch to `anon` / `authenticated` (the SQL Editor). Used by `is_admin_or_db()` and by the caps in `add_user_aura`, `update_game_score`, `chip_in_wishlist_item` and the Stripe-fields guard. Same migration. |
| `athlete_payout_allowed(target_player_id)` | anon, authenticated | Boolean over `athlete_payout_status` (redefined in the payout-gate migration below). Drives the gift sheet's "held" line. |
| `athlete_is_varsity_verified(target_player_id)` | anon, authenticated | School confirmed (the public badge) — a school-confirmed account is linked to the roster row. No name matching. Since the payout-gate migration it no longer equals `athlete_payout_allowed`. |
| `apply_verification(req)` | internal | Marks the requester verified, links `player_id`, school, athlete role. |
| `guard_profiles_verification()` | trigger on `profiles` | Blocks any non-admin write to `is_verified` / `verification_status` / `player_id` unless the flag is set. |
| `claim_athlete(target_player_id, request_notes)` | authenticated | Opens or updates the caller's one open claim; account → `pending`. A second account claiming the same athlete (or one already verified as them) → both `disputed`. |
| `request_athlete_verification(request_notes)` | authenticated | Legal-ack check, then `claim_athlete(null)`. |
| `redeem_team_code(raw_code)` | authenticated | Same lockout as before; sets school + sport, opens a claim, returns **pending**. |
| `start_school_check()` | authenticated | New 6-digit code for the caller's open claim, valid 30 min. Refuses with no claim, a disputed claim, or no school. |
| `get_my_verification()` | authenticated | jsonb: `verification_status`, `request_status`, `school_name`, `has_school`, `sport`, `code_expires_at`, `confirmer_name`, `decision_note`. |
| `school_confirmer_from_token(confirm_token)` | internal | Active, unexpired confirmer for a link token. |
| `get_school_confirmation_queue(confirm_token)` | anon, authenticated | The confirmer's school (and sport) pending students: name, sport, class year, jersey, whether a code is live. No contact details. |
| `school_confirm_athlete(confirm_token, request_id, approve, meet_code, confirmer_signature, note)` | anon, authenticated | Signature required. Decline needs no code. Confirm needs the live meet code; re-checks nobody else is verified as that athlete; then `apply_verification`. |
| `admin_add_school_confirmer(target_school_id, confirmer_name, confirmer_email, confirmer_role, confirmer_sport)` | admin / SQL Editor | Returns `{id, token, link}` once (`alasports://school-confirm?t=…`). |
| `admin_revoke_school_confirmer(confirmer_id)` | admin | Deactivates a link. |
| `admin_decide_verification(request_id, approve, note)` | admin | Stamps only the requester (never by name); closes other open claims on that athlete. Used by People → verification queue. |
| `admin_revoke_verification(target_profile_id, note)` | admin | Removes the badge and roster link; the request becomes `revoked`. |

`can_confirm_player_tag` / `confirm_reel_player_tag` are also redefined here: name and jersey matching removed, and confirming a tag no longer links `profiles.player_id`.

### Payout gate without the school + teammate vouches

Migration `supabase/migrations/20260929130000_payout_gate_without_school.sql` (design §9, **not applied yet**). All `SECURITY DEFINER`. Client: `lib/payoutGate.ts`, `useMyVerification().payout`, `components/Verification/TeammateVouchCard.tsx`.

| Object | Who | What |
| --- | --- | --- |
| table `athlete_vouches` | RPC only | `id`, `request_id` → `verification_requests` (cascade), `voucher_profile_id` → `profiles`, `created_at`; unique (`request_id`, `voucher_profile_id`). RLS on, no client grants. |
| `athlete_pending_payout_cap_cents()` | anon, authenticated | `25000` ($250). The one place to change the cap. |
| `athlete_payout_status(target_player_id)` | internal | jsonb `{allowed, path ('school' / 'identity' / null), cap_cents, reason ('disputed' / 'no_claim' / 'needs_payout_setup'), vouches}`. School-confirmed → allowed, no cap. Else one undisputed pending claim **and** Stripe ID check (linked guardian's `custodial_accounts.payouts_enabled`, or the claimant's own `profiles.payouts_enabled` when no guardian holds the money) → allowed, capped until 3 vouches. **Every payout path must read this and honour `cap_cents`.** |
| `my_claimed_player_id()` | internal | Caller's linked roster row, else their open claim's. |
| `get_my_payout_status()` | authenticated | `athlete_payout_status` for the caller's claim + `pending_cap_cents`. |
| `my_vouching_school_id()` | internal | School the caller may vouch at: school-confirmed → their school; else their pending claim's school if their own gate is open. |
| `get_teammates_to_vouch()` | authenticated | Up to 50 pending claims at that school (not the caller's): `request_id`, `name`, `sport`, `class_year`, `jersey`, `vouches`, `vouched_by_me`. Empty when the caller may not vouch. |
| `vouch_for_teammate(target_request_id)` | authenticated | Same-school, pending, not self, max 10 a day. Returns the new count. |

### School badge

Migration `supabase/migrations/20260929140000_school_badge.sql` (design §10, **not applied yet**). Client: `lib/schoolBadge.ts`, `useSchoolBadge`, `components/Verification/SchoolCrest.tsx`.

| Object | Who | What |
| --- | --- | --- |
| `schools_and_teams` (added) | admin | `logo_url` (https only), `color_primary`, `color_secondary` (`#RRGGBB`); CHECK `schools_and_teams_branding_check`. |
| `admin_set_school_branding(target_school_id, new_logo_url, new_color_primary, new_color_secondary)` | admin / SQL Editor | Sets the crest and colours. |
| `athlete_school_badge(target_player_id)` | anon, authenticated | jsonb `{school_id, school_name, mascot, logo_url, color_primary, color_secondary, confirmed_at, confirmed_by ('athletic_director' / 'coach' / 'tapuai')}` — **null unless a school-confirmed account is linked**. Never the staff member's name. |
| `profiles` CHECK `profiles_name_no_check_marks` | — | `full_name` / `username` may not contain ✓ ✔ ☑ ✅ (NOT VALID: existing rows untouched). |

### Highlight views + filmer credit

Migration `supabase/migrations/20260929160000_reel_views_and_filmer_credit.sql` (**not applied yet**). Client: `lib/reels.ts` (feed tier), `lib/leaderboards.ts` (`fetchAthleteHighlightViews`), `ReelCard` (credit + views), `TaggedReelGrid` (▶ per poster).

A **view** = 3 s of actual playback (or 90% of a shorter clip) by a signed-in account that is not the uploader or the tagged athlete, at most once per account per clip per UTC day (`VIEW_PLAY_MS`, `record_reel_view`).

| Object | Who | What |
| --- | --- | --- |
| `reels_feed` (added columns, appended) | anon, authenticated | `view_count`; `uploader_name` (username, else first name only — never a full name; null when the tagged athlete posted it); `uploader_avatar_url`. Left join `profiles` on `reels.uploaded_by = profiles.id`. |
| `athlete_highlight_views(target_player_id)` | anon, authenticated | integer — total `view_count` on the athlete's confirmed, not-removed clips. The profile's "views" number. |
| `filmer_stats(target_profile_id)` | anon, authenticated | jsonb `{clips, views, hype}` over clips that profile uploaded and the athlete confirmed. Credit only — no money. |

### Filmer rewards

Migration `supabase/migrations/20260929170000_filmer_rewards.sql` (**not applied yet**; needs `supabase/leaderboards.sql` and `20260929160000`). Client: `lib/filmers.ts`, `useFilmerStats`, `components/Filmers/` (`FilmerCard` on profiles, `FilmerSheet` from "🎥 Filmed by"), Spotlight Boards "Top Filmers 🎥" tab. A **filmer** is a clip's uploader when the uploader is not the tagged athlete. Filmers never receive any part of an athlete's Mālo.

| Object | Who | What |
| --- | --- | --- |
| `filmer_rewards` | RLS: filmer reads own rows; server writes only | One row per reward: `profile_id`, `reel_id`, `kind` (`tag_confirmed` / `views_milestone` / `props`), `source_key` (unique — makes each reward idempotent), `aura_points`, `cash_cents` (always 0 today), `funded_by` (CHECK `= 'tapuai'`), `created_at`. `cash_cents` / `funded_by` are reserved for a future Tapua'i-funded filmer programme (ROADMAP M11); the CHECK means athlete gifts can never be routed here. |
| `filmer_props` | no client grants | (`reel_id`, `giver_user_id`) PK — one Props per fan per clip. |
| `award_filmer_aura(target_profile_id, target_reel_id, reward_kind, reward_key, points)` | internal only | Inserts the reward once and adds the Aura to `profiles.aura_points`. |
| `reel_filmer_profile_id(target_reel_id)` | internal only | The uploader's `profiles.id` unless they are the tagged athlete. |
| `reels_filmer_rewards()` trigger (`after update of tag_status, view_count on reels`) | server | Confirmed, not-removed clip with a filmer → +10 Aura (`tag:<reel>`), then +10 / +50 / +200 at 100 / 1,000 / 10,000 views (catches up when a tag is confirmed late). |
| `give_filmer_props(target_reel_id)` | authenticated | Confirmed clip with a filmer; not your own; 50 a day. +1 Aura to the filmer. Returns the clip's Props total. |
| `filmer_stats(target_profile_id)` (replaced) | anon, authenticated | jsonb `{clips, views, hype, props, aura_earned}` over confirmed clips they filmed (not their own-athlete clips). |
| `get_top_filmers(period_kind default 'week')` | anon, authenticated | Top 10 in the Spotlight window: `{rank, profile_id, name, avatar_url, clips, views, hype, props, score}`, score = views + 3 × hype + 5 × Props on public confirmed clips. No money fields. |

### Rally goals, donation thank-yous, optional tip to Tapua'i

Migration `supabase/migrations/20260929180000_rally_goals_thanks_platform_tip.sql` (**not applied yet**; needs `supabase/custodial_money.sql`, `company_revenue.sql`, `tip_origin.sql`). Client: `lib/rallies.ts` + `useRally`, `components/Rally/` (`RallyCard` on the athlete profile and in Parent HQ, `CreateRallySheet`); `lib/donationThanks.ts` + `useDonationThanks`, `components/Thanks/ThanksPicker`, "Say thanks" in `Profile/ReceivedMaloPanel`, "said thanks" rows in Activity; tip chips in `TipCheckout`. Mission: families raise money for real sports costs next to the athlete's highlights, and donors hear back.

| Object | Who | What |
| --- | --- | --- |
| `rallies` | RLS SELECT: `live` / `filled` / `closed` for everyone ("Read public rallies"), every row (pending too) for a signed-in manager ("Managers read own rallies"; split in `20261020090000` so guests never call `rally_manager_role`); no client writes | `id`, `player_id`, `created_by`, `title` (3–60), `story` (≤600), `cost_kind` (`season` / `gear` / `travel` / `camps` / `college_prep` / `other`), `target_cents` (500–2,500,000), `raised_cents`, `donation_count`, `ends_on`, `status` (`pending_guardian` / `live` / `filled` / `closed`), `approved_by` / `approved_at`, `filled_at`, `thanks_key`, `thanks_reel_id`, `thanked_at`, timestamps. One open (`pending_guardian` / `live`) Rally per athlete (partial unique index). |
| `donation_thanks` | RLS on, no grants (RPCs only) | `tip_id` PK → `tips`, `player_id`, `thanked_by`, `message_key` (`malo` / `season` / `gear` / `family` / `work` — presets only, no free text), `created_at`. One thank-you per donation. |
| `rally_manager_role(target_player_id)` | authenticated | `admin`, `guardian` (`players.guardian_id`), `athlete` (own verified `profiles.player_id`), else null. |
| `create_rally(target_player_id, rally_title, rally_story, rally_cost_kind, rally_target_cents, rally_ends_on)` | manager | Live at once for a guardian / admin, or an athlete who already controls their own money (`athlete_controls_money`); otherwise `pending_guardian`. Refuses a frozen athlete, a second open Rally, or an end date outside 1–180 days. Returns the row. |
| `approve_rally(target_rally_id)` | guardian / admin | `pending_guardian` → `live`. |
| `close_rally(target_rally_id)` | manager | Open → `closed`. |
| `thank_rally(target_rally_id, message_key, what_it_paid_for_reel)` | manager | Once the Rally has at least one donation and is not pending: preset key only; the optional clip must be the athlete's own confirmed, non-Vault reel. Shown to every fan on the card. |
| `get_active_rally(target_player_id)` | anon, authenticated | The live, unexpired Rally, else one filled / thanked in the last 30 days. |
| `get_player_rallies(target_player_id)` | manager | Every Rally, newest first (pending included). |
| `tips_rally_before_insert()` trigger (`before insert on tips`) | server | When `rally_id` points at a live Rally of the same athlete: adds `amount_cents` to `raised_cents`, +1 `donation_count`, fills it at the goal. Otherwise sets `rally_id` null. Trusts the client insert like every `tips` row today (§ `tips` RLS note). |
| `tips_platform_tip_revenue()` trigger (`after insert on tips`) | server | `platform_tip_cents > 0` → one `company_revenue_logs` row, `source = 'tip'`, 100% platform, `payee_kind = 'none'`. |
| `thank_donation(target_tip_id, message_key)` | athlete / guardian / admin of the recipient | Records one preset thank-you for that donation; returns `found`. |
| `get_donations_to_thank(target_player_id)` | manager | Recent donations: `tip_id`, `amount_cents`, `created_at`, `fan_name`, `rally_title`, `thanked_key`. |
| `get_my_donation_thanks()` | authenticated | Thank-yous the caller received as a donor: `tip_id`, `player_id`, `athlete_name`, `message_key`, `amount_cents`, `thanked_at`. |

Also in this migration: `company_revenue_bps('tip')` = 10000, `tip_origin_label('rally')` = "Rally", `get_company_revenue_summary()` re-created with the `tip` stream.

### Custodial money RPCs

All `SECURITY DEFINER`, `search_path = public`. Incremental: `supabase/custodial_money.sql`. Client: `lib/custodial.ts` + `useCustodial`, `components/Custodial/` (Activity for the athlete, Parent HQ for the guardian).

| Function | Who | What |
| --- | --- | --- |
| `custodial_role(target_player_id)` | authenticated | `admin`, `guardian` (`players.guardian_id` = caller), `athlete` (caller's `profiles.player_id` = target **and** `verification_status = 'verified'`), else null. The verified check is kept even though the ladder migration makes `profiles.player_id` server-only, because that migration is not applied yet. |
| `athlete_handover_date(target_player_id)` / `athlete_controls_money(target_player_id)` | internal only (EXECUTE revoked from public / anon / authenticated) | Birth date + `handover_age` years; true on or after that day. Revoked so nobody can derive a minor's birth date. Handover is computed on every call, so it is automatic. |
| `guardian_setup_custodial(target_player_id, athlete_birth_date, bank_in_athlete_name)` | linked guardian | Birth date once (5–30 years old); refuses if the athlete is already of age; upserts the account for this guardian only. A later call with a null date just updates `bank_in_athlete_name`. |
| `admin_set_custodial_terms(target_player_id, new_handover_age, corrected_birth_date)` | admin | Sets the state's handover age or corrects a birth date. |
| `request_custodial_withdrawal(target_player_id, amount_cents, note)` | guardian before handover; athlete after | Returns the `custodial_withdrawals` row. Guardian → `pending_athlete`; athlete of age → `approved`. A guardian after handover is refused. |
| `decide_custodial_withdrawal(request_id, approve)` | the verified athlete | Pending only → `approved` / `declined`. |
| `cancel_custodial_withdrawal(request_id)` | the requester | Pending only → `cancelled`. |
| `get_custodial_summary(target_player_id)` | athlete / guardian / admin | jsonb: `viewer_role`, names, `has_account`, `payouts_enabled`, `bank_in_athlete_name`, `handover_age`, `handover_date`, `athlete_controls`, `received_cents` (sum of `tips` for the athlete — what fans donated), `family_cents` (the family account's share from the books; `20261013231000`, not applied), last 20 `requests`. Null for anyone else. |

### `record_reel_view(target_reel_id)` / `get_leaderboards(period_kind)`

Incremental: `supabase/leaderboards.sql`. Client: `lib/leaderboards.ts`, `useLeaderboards`, `useReelViewTracker` (each `ReelCard`, 3 s of playback), `Spotlight/LeaderboardsBoard` behind `layouts.leaderboards`.

- `record_reel_view` — `authenticated` only. Counts at most once per viewer per clip per UTC day; skips removed, flagged and Vault-only clips and views by the uploader or the tagged athlete. Returns the new count or null.
- `get_leaderboards(period_kind default 'week')` — `anon` + `authenticated`. Top 10 per board for the Spotlight window: most-hyped players, most-viewed players, most-viewed Highlights, schools (hype + 10 × Highlights + 5 × distinct fans) and fans (10 × confirmed clips + hype given; username or first name only). Only confirmed-tag, public clips count. **No money fields** — STORY.md guardrail: never rank kids by Mālo.

## 7-Tier Aura palette

**Earn rate:** `aura_points += tip_dollars × 10` (`$5` Mālo → `+50`).

Tier = highest band whose minimum the balance meets. Source of truth: `AURA_TIERS` in `apps/mobile/src/frontend/lib/aura.ts` (`get_aura_tier` archived 2026-10-13).

| Tier | Title | Min pts | Hex | Face | Ink | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Slate Silver** | 0 | `#94A3B8` | `#F1F5F9` | `#334155` | Entry border |
| 2 | **Island Cyan** | 8 | `#00E5FF` | `#CFF7FF` | `#00707E` | Seki / away |
| 3 | **Neon Jade** | 20 | `#00E676` | `#E8FBF0` | `#00733C` | Brand jade |
| 4 | **Electric Violet** | 40 | `#B388FF` | `#F3EDFF` | `#4C1D95` | Flex-adjacent |
| 5 | **Crimson Ember** | 70 | `#FF1744` | `#FFE8EC` | `#C4002B` | Heat |
| 6 | **Polished Gold** | 110 | `#FFD700` | `#FFF8DC` | `#8A6400` | |
| 7 | **Celestial Prism** | 170 | `#00E676` / `#00E5FF` | `#EEFFF6` | `#00733C` | Jade border, cyan glow; Skia sweep |

Badge: `Tier {n} • {title}`. Collectible cards use per-tier `face` + `ink` on Daylight (`AURA_TIERS` in `aura.ts`). `Profile/AuraTradingCard` (Profile hub and the public athlete sheet, both faces) / `TopAuraBoosters`. Progress fill uses `auraProgressTowardNext` (band min → next min; Celestial Prism is full). Standard Island scheme (`FOCAL` + `TAB_ACCENTS`): Daylight `#F3FAF6`, Jade `#00E676` / `#00733C` (Home / Mālo), Cyan `#00E5FF` (Local / Seki), Gold `#FFD700` / `#8A6400` (kickers / Spotlight / ranks), Ember `#FF1744` (LIVE / Drip), Violet `#7C4DFF` (Profile). Video chrome stays Obsidian `#0F1416`. Source: `apps/mobile/src/frontend/theme/motion.ts`.

If `aura_points` is unset on a player, the client falls back to `aura_count + seki_count + flex_count`.

---

## RLS (tightened 2026-09 — some tables still demo-open, tighten those before production)

`schema.sql` originally allowed Expo Go without login almost everywhere (`auth.role() = 'anon' or ...` baked into most admin/staff policies). A 2026-09 security audit closed the money-fabrication and admin-data-exposure holes below; a few same-pattern tables were deliberately **not** touched in that pass (called out at the bottom) because closing them needs either a bigger product decision (real authenticated operator/admin accounts — the PIN claim and Studio-unlock preview are both client-only today, not Supabase-authenticated) or a larger refactor (`app_feedback` SELECT/UPDATE, `operator_gigs`/`operator_checkins`, the direct `wishlist_items` table write policy (the fan-facing `chip_in_wishlist_item` RPC path IS tightened — see above — but admin desk direct-table writes to `wishlist_items` still have the `anon` bypass), `sport_configs` admin writes — still `with check (true)` / anon-or-role, same class of issue as `tips` was, just not in this pass's scope). `reels` INSERT/UPDATE was in that deferred list until a later 2026-09 pass tightened it specifically (see the `reels` section above and `toggle_reel_vault_status` / `set_reel_flash_unlock` / `moderate_flagged_reel` RPC entries) — the six-plus raw `.from('reels').update(...)` call sites across `lib/reels.ts`, `lib/admin.ts`, `lib/adminCatalog.ts`, and `lib/crew.ts` were individually audited for their real actor before the RLS/column-grant/RPC design landed. Those remaining tables are still demo-open — tighten before production.

| Table | SELECT | Writes |
| --- | --- | --- |
| `profiles` | Public (guest-browse; `stripe_connect_id` exposure to anon/authenticated is a known, deliberately-deferred gap — see the `profiles` section above) | INSERT own (`user_id = auth.uid`); UPDATE own / admin |
| `players` | Public | **authenticated** booster/admin/operator (`anon` bypass dropped — carries `aura_points`); `parent` may UPDATE only a row where `guardian_id` already equals them; column-level `GRANT` (2026-09 self-escalation audit follow-up) excludes `guardian_id` / `parental_consent_approved` / `guardian_consent_at` from every raw `authenticated` write regardless of role — those three are writable only via `admin_set_player_guardian` (admin-only), `parent_set_player_consent` (linked-parent-only), and `admin_approve_player_consent` (admin-only), all `SECURITY DEFINER` |
| `games` | Public | UPDATE operator/admin, or `anon` only while `claimed_by is null`; INSERT **authenticated** admin/operator |
| `game_events` | Public | INSERT operator/admin, or `anon` only while the referenced game is unclaimed. `player_id` nullable for sideline callouts |
| `reels` | Public | INSERT requires `authenticated` + `uploaded_by = auth.uid()`'s own `profiles.id` (trigger-filled, `with check (true)` closed); UPDATE is uploader-own-row or admin-any-row, **and** a column grant narrows raw UPDATE to `title`/`category`/`is_exclusive`/`is_vault_only`/`flash_unlock_until` — counters and moderation flags are RPC-only |
| `subscriptions` | Own `subscriber_id` or admin | INSERT/UPDATE own `subscriber_id` only (`with check (true)` closed) |
| `subscriber_requests` | Sender, receiving athlete, or admin | INSERT requires `auth.uid() = subscriber_id` (`with check (true)` closed); `anon` bypass dropped |
| `tips` | Own `fan_id` or admin | INSERT requires `auth.uid() = fan_id` (`with check (true)` closed); `amount_cents`/`aura_points` CHECK `>= 0` |
| `sponsorships` | Public | INSERT requires `auth.uid() = sponsor_user_id` or admin (`with check (true)` closed); admin UPDATE / DELETE (`anon` bypass **still present** on that policy, not closed this pass); `amount_cents`/`aura_points` CHECK `>= 0` |
| `shop_products` | Public | Admin INSERT / UPDATE / DELETE |
| `shop_orders` | **Admin-only** | INSERT requires `auth.uid() = buyer_id` (`with check (true)` closed — see `shop_orders` section above); admin UPDATE / DELETE (`anon` bypass dropped); `amount_cents` CHECK `>= 0`, `qty` CHECK `> 0` |
| `company_revenue_logs` | **Admin-only** | **Admin-only** (`anon` bypass dropped; real writes flow through a SECURITY DEFINER trigger regardless); amount columns CHECK `>= 0` |
| `app_runtime_config` | Public (fan chrome boot) | **authenticated** admin only (`anon` bypass dropped; `patch_app_runtime_draft`/`publish_app_runtime` also admin-checked internally since SECURITY DEFINER bypasses this policy) |
| `app_feedback` | Admin or `anon` | INSERT anyone; admin or `anon` UPDATE — not tightened this pass |
| `telemetry_logs` | Authenticated (any signed-in user — still open, STATE §6) | INSERT anyone, including anon (guest browse). Row shape is bounded by CHECKs in `20260929190000_telemetry_logs_bounds.sql` (staging only) |
| `saved_reels` | Own rows | INSERT / DELETE own rows |
| `reel_hype_votes` | Own rows | INSERT own rows, **authenticated only** (anon execute on `increment_reel_hype` defeated this table's own per-user dedupe — closed) |
| `schools_and_teams` | Public | Admin INSERT / UPDATE / DELETE |
| `athlete_career_stats` | Public | Seed-only |
| `athlete_game_logs` | Public | Seed-only |
| `spotlight_awards` | Public | **authenticated** admin only (`anon` bypass dropped, including inside `publish_spotlight_award` / `unlock_spotlight_period`) |
| `crew_follows` | Public | INSERT / DELETE own `follower_id` |
| `crew_push_queue` | Own `recipient_id` | INSERT anyone (RPC writes) |
| `cheer_polls` | Public | **authenticated** admin only (`anon` bypass dropped on the write policy and inside `upsert_cheer_poll`); votes via `cast_cheer_vote` |
| `verification_requests` | Own request (`requester_user_id`) or booster/admin | INSERT requires the caller's own `requester_user_id` (or null); booster/admin UPDATE / DELETE (`anon` bypass dropped) |
| `disbursements` | admin, plus that athlete's custodial parties via `custodial_role(player_id)` (`20261013220000`, not applied; before it every parent read every row) | admin only (`20261013220000`, not applied; before it any parent could insert / update / delete any row) |
| `sponsor_ads` | Public | **authenticated** sponsor/admin only (`anon` bypass dropped; no client code writes this table today) |

```sql
current_user_role()  -- profiles.role for auth.uid(), else 'guest'
```

**Known open product decision (not made in this pass):** operator PIN-claim (`lib/operator.ts` `OPERATOR_TEST_PIN`) and Expo `/admin` Studio-unlock preview are both client-only gates today, never backed by a real Supabase-authenticated session/role. RLS can no longer treat `auth.role() = 'anon'` as "trusted operator/admin" the way it used to, so anon writes on `games`/`game_events` are now narrowed to unclaimed games only (see above) rather than fully blocked, and `players`/`sponsor_ads`/admin-desk writes now require a real authenticated account with the right role — Studio-unlock-only preview (no sign-in) will no longer be able to write to those tables. Whether to build real authenticated operator/admin accounts is a product call for the team, not something decided here.

**Server-side payment verification:** `supabase/functions/stripe-webhook/index.ts` (new) verifies the Stripe signature on `payment_intent.succeeded` and is meant to become the only writer of `tips` / `subscriptions` / Aura once COMMERCE adds enough PaymentIntent metadata for it to attribute a charge to a specific tip/subscription/order — see the file's header comment for the deploy checklist (Stripe dashboard webhook + `STRIPE_WEBHOOK_SECRET`) and what's still manual. The client-side write path in `useTipCheckout.ts` is intentionally still in place; migrating off it is a COMMERCE follow-up.

---

## Storage — `game_highlights`

Created in `supabase/reels.sql`; consolidated into the canonical `schema.sql` (2026-09, bottom of the file) so a **fresh** Supabase project needs no extra incremental step to get a working upload path — running `supabase/reels.sql` / `supabase/media_upload.sql` afterward is still safe (idempotent) for an already-hosted project catching up.

| Parameter | Value |
| --- | --- |
| Bucket id / name | `game_highlights` |
| Public | `true` |
| Client constant | `HIGHLIGHTS_BUCKET` in `apps/mobile/src/frontend/lib/reels.ts` |
| Object path | Highlight fallback only: `reels/{user_id}/{timestamp}.mp4`. Booster logos are images and live on `avatars` at `sponsors/{timestamp}.{ext}` — this bucket’s `allowed_mime_types` is video-only. |
| RLS SELECT | `storage.objects` where `bucket_id = 'game_highlights'` (public read, unchanged) |
| RLS INSERT | same `bucket_id` **and** `auth.role() = 'authenticated'` (2026-09 security pass — was bucket-only, so any anon-key holder with no session could write; `MediaUploadService.uploadHighlight` already requires the caller be signed in, so this closes the gap without breaking the app) |
| `allowed_mime_types` | `video/mp4`, `video/quicktime` (same Round 18 rule as `reels`) |

Upload requires a tagged player, a caption, and a video category (Game Day / Train Like Me / Serve Like Me). **Tagging a game is optional** (2026-09 — previously required, now `UploadVideoModal` defaults to "No specific game" and still lets a fan pick one). `MediaUploadService` writes `reels/{user_id}/{timestamp}.mp4` into bucket **`reels`** first, then falls back to `game_highlights` if that bucket is missing.

### Storage — `reels`

Created in `supabase/media_upload.sql`; consolidated into `schema.sql` (2026-09) — see note above. Client: `REELS_BUCKET` in `MediaUploadService.ts`.

| Parameter | Value |
| --- | --- |
| Bucket id / name | `reels` |
| Public | `true` |
| Object path | Videos `reels/{auth.users.id}/{timestamp}.mp4` (`uploadHighlight` puts a literal `reels/` folder inside the bucket); photo stories `{auth.users.id}/stories/{reel_id}/{position}-{epoch ms}.jpg` (`uploadStoryPhoto`) |
| RLS SELECT | `storage.objects` where `bucket_id = 'reels'` (public read, unchanged) |
| RLS INSERT / UPDATE | same `bucket_id` **and** `auth.role() = 'authenticated'` (2026-09 security pass — was bucket-only/anon-writable; tightened to match `MediaUploadService.uploadHighlight`'s existing signed-in requirement). **Pending (`supabase/migrations/20261007231000_reels_storage_owner_folder.sql`, written 2026-10-07, not applied):** both policies also require the caller's own folder — `(storage.foldername(name))[1] = auth.uid()::text` (photo stories) or `[1] = 'reels' and [2] = auth.uid()::text` (videos) — so `upsert` can no longer overwrite another account's object. Until applied, any signed-in user can overwrite any object by path. |
| `allowed_mime_types` | `video/mp4`, `video/quicktime`, plus `image/jpeg` once `20261007230000_photo_stories.sql` is applied (photo stories; not applied anywhere yet) (2026-09 Round 18 sweep — the client declares `video/mp4`; nothing server-side previously stopped a raw REST call from declaring an arbitrary Content-Type instead) |

### Storage — `reel_vault`

Interim private bucket for **new** Vault / Exclusive uploads (`REEL_VAULT_BUCKET`), until the video host is chosen: **Cloudflare Stream or Mux**, whichever stays cheaper and still plays reliably. This bucket is not the long-term host. `public = false`. `allowed_mime_types`: `video/mp4`, `video/quicktime`. `reels.video_url` stores `reelvault:{auth.users.id}/{timestamp}.mp4`, not an https URL. `reels_feed` still returns that token only when the caller is entitled; `resolvePlaybackUrl` then asks Storage for a one-hour signed URL.

`can_read_reel_vault(object_name)` is `SECURITY DEFINER` and returns true when that reel is no longer `is_vault_only` (so "Move to public feed" can still play a file that already lives in this bucket), or for the uploader, an admin, an active `subscriptions` row on `reels.player_id`, or a live `flash_unlock_until`. Storage SELECT calls it because a direct read of `public.reels` is hidden by RLS from everyone except the uploader and an admin. INSERT is the signed-in user, and only into their own `auth.uid()` folder. Grant: `EXECUTE` to `anon`, `authenticated` (anon only succeeds during Flash Unlock). Public Highlights stay on `reels`. Clips uploaded before this bucket still have public URLs — that leftover is the Round 9 hard blocker until those files move.

### Storage — `avatars`

Created in `supabase/media_upload.sql`; consolidated into `schema.sql` (2026-09) — see note above. Client: `ProfileAvatarPicker` → `uploadAvatar`.

| Parameter | Value |
| --- | --- |
| Bucket id / name | `avatars` |
| Public | `true` |
| Object path | Profile photos `{auth.users.id}/{timestamp}.jpg`; booster logos `sponsors/{auth.users.id}/{timestamp}.{ext}` (older builds: `sponsors/{timestamp}.{ext}`) |
| Writes | `profiles.avatar_url` |
| RLS SELECT | `storage.objects` where `bucket_id = 'avatars'` (public read, unchanged) |
| RLS INSERT / UPDATE | same `bucket_id` **and** `auth.role() = 'authenticated'` (2026-09 security pass). Until `20261013230000_avatars_owner_folder.sql` is applied, any signed-in user can overwrite any profile photo. After it: INSERT and UPDATE only in the caller's own folder (`{uid}/…` or `sponsors/{uid}/…`); a new file directly under `sponsors/` may still be inserted (older builds) but never overwritten |
| `allowed_mime_types` | `image/jpeg`, `image/png`, `image/webp`. The client sends an `ArrayBuffer` plus this type (`imageContentType` in `MediaUploadService.ts`). A React Native `Blob` is not used — `fetch().blob()` labels local photos `text/plain`, which this allow-list rejects. |

---

## Realtime

Published: `games`, `game_events`, `cheer_polls`, `app_runtime_config`. Fan hook `useLiveGame` filters `games` `id=eq.{gameId}` and `game_events` INSERT `game_id=eq.{gameId}` (featured live match when `gameId` is omitted). Operator callouts also Broadcast on public channel `game_events_${gameId}` with event `play` and payload `{ type, timestamp, team }`; focused `ReelCard` joins via `useGameEventBroadcast`. SCALE-03 (written, not applied): with `EXPO_PUBLIC_LIVE_SCORES_BROADCAST=true`, `useLiveScores` joins private Broadcast `game_scores_index` plus `game_scores_{id}` per listed game (at most 40; the rest poll once a minute) and merges each change by `live_seq`; it rereads only on reconnect, a gap, an unknown game or a membership notice. Switch off, or a refused private topic, keeps the earlier `postgres_changes` on `games` → full reread. Aura / `profiles` are fetch + in-app event bus. Fan chrome (`AppRuntimeContext`) listens to `app_runtime_config` UPDATE.

---

## Incremental SQL order

Prefer full `schema.sql` on a blank project (includes `profiles` / `tips` / operator tables).

1. `players.sql` → `game_events.sql` → `games.sql` (+ `games_clock.sql` + `games_operator.sql`)
2. `increment_backer.sql` → `increment_hype.sql` (`increment_player_hype`)
3. `reels.sql` → `cheer_polls.sql` → `add_user_aura.sql` → `subscriptions.sql` → `subscriber_requests.sql` → `profile_roles.sql` → `add_user_role.sql` → `auth_fan_profile.sql` → `stripe_connect.sql` → `get_fan_tip_history.sql` → `sponsorships.sql` → `telemetry_logs.sql` → `saved_reels.sql` → `search_local_entities.sql` → `report_reel.sql` → `toggle_reel_vault_status.sql` → `schools_and_teams.sql` → `legal_terms_ack.sql` → `athlete_verification.sql` → `athlete_stats.sql` → `player_vault_lock.sql` → `spotlight_awards.sql` → `reel_category.sql` → `crew_and_flash_unlock.sql` → `reel_hype_votes.sql` → `admin_dashboard.sql` → `admin_portal.sql` → `app_runtime.sql` → `admin_reports.sql` → `spotlight_auto.sql` → `company_revenue.sql` → `app_feedback.sql` → `usage_reports.sql` → `media_upload.sql` → `tip_origin.sql` → `malo_ledger.sql` → `custodial_money.sql` → `leaderboards.sql`

## Engineering Support (DETECT-02, local migration only)

`20261013190000_engineering_support.sql` adds `support_signals`, `support_reviews`,
`support_audit_events` and `support_releases`. Append-only restricted evidence; no direct client
writes. `get_engineering_support_snapshot()` reads at most 200 signals, 300 reviews,
200 audit events and 20 releases. `/admin/support` uses this bounded reader; missing reads stay unknown.

| Function | Contract |
| --- | --- |
| `support_code_metadata` | Private fixed event category/severity vocabulary |
| `guard_support_append_only` | Reject evidence update/delete |
| `insert_support_signal` | Private validated append helper |
| `record_support_signal` | Authenticated client, fixed feature/code/environment/release; server actor/time/source; bounded rate |
| `record_trusted_support_signal` | Service role only; trusted server/security/check observations; confirmed_attack requires security source |
| `record_support_review` | Admin rationale and occurrence coverage; protected terminal decisions need another admin; new occurrences reopen |
| `register_support_release` | Admin registers bounded package metadata; no source upload, signing, deployment or restore |
| `capture_support_audit` | Atomic source-change trigger; actor/role/time, operation/record, changed field names and per-entity hash chain |
| `get_engineering_support_snapshot` | Admin-only bounded reader, explicit version/read time/limits |

Audit covers the 16 source tables named in the migration, including profiles, app config,
admin content and money/ledger sources. Audit failure aborts the source mutation. No full row
values, credentials or payment details are retained. Privileged database operators can alter
triggers and recompute unsigned chains; this is a stated trust boundary. Evidence has no client
delete grant; privacy retention/purge requires reviewed operator procedures. The local recovery
capsule preserves schema/migration hashes; code restoration never executes old SQL or undoes money.

### Rebuilding the schema locally (`scripts/replay/schema-replay.mjs`, 2026-10-13)

`node scripts/replay/schema-replay.mjs <pglite dist>` builds the whole `schema.sql` on an empty Postgres 18.6
(PGlite, outside the repo) with stubs for Supabase's `auth` / `storage` / `realtime` schemas and roles, applies it
twice, and checks rules that must hold everywhere: row level security on every public table, a pinned
`search_path` on every security definer function, no `admin_*` function executable by `anon`, and that a request
with no JWT claims is never treated as an admin, plus who may call each hardened function (tried as a guest, a
signed-in fan, an admin and a claimless request) and that a real donation still reaches the books. It found the gaps fixed by
`20261013210000_function_access_hardening.sql`: guests (and signed-in fans) could write revenue rows into the
books through `record_company_revenue`, guests could change sport settings and triage feedback, and a request with
no claims counted as the database. 35/35 with the two October security files; 13/35 on the schema without them. Follow-up (not reachable while
`profiles` RLS needs `auth.uid()`): the profile role-escalation trigger still skips its check when `auth.role()`
is null.

### Profile privacy, friends and blocking (PRIV-01, `20261014090000_profile_privacy.sql`, **written 2026-10-14, not applied**)

Design: [PROFILE_PRIVACY_DESIGN.md](design/PROFILE_PRIVACY_DESIGN.md). Replay: `scripts/replay/schema-replay.mjs`.
`profiles` SELECT is now **own row or admin**; other people's profiles come only through `get_public_profiles` (over
`profiles_public`, rebuilt on the rule below, `user_id` removed, no direct client reads) and the functions here. Helpers
that answer about other people (`are_friends`, `is_blocked_between`, `viewer_relationship`) are
not client-callable. A blocked person sees a guest's view. Photos and full names also stopped leaking through
`reels_feed`, `get_leaderboards`, `get_top_filmers`, `get_spotlight_standings`, `get_pending_player_tags` and
`get_donations_to_thank`. `profiles` gains `account_private` (new accounts true),
`profile_audience` (per item: `everyone` / `friends` / `only_me`), `hide_from_search`, `tag_review`,
`friend_requests_from` (`everyone` / `teens` / `nobody`; `teens` is the MINOR-01 teen default); trigger
`profiles_privacy_guard` (`guard_profiles_privacy()`) refuses direct writes to them and mirrors the legacy
`profile_visibility` switches. The first draft's guardian lock (`privacy_locked_by`, `privacy_lock_active`,
`guardian_get_privacy`, `guardian_set_privacy`, `admin_release_privacy_lock`) was removed before anything was applied
(owner 2026-10-14): supervision and approvals replace it (MINOR-01 below).

| Table | Purpose |
| --- | --- |
| `friendships` | Requests (`pending`), friendships (`accepted`), declines (`declined`, kept 30 days, hidden from the requester). Unique per pair. Parties read; no direct writes. |
| `user_blocks` | `(blocker_id, blocked_id)`. The blocker reads their own; no direct writes. |
| `friend_request_log` | Every request sent; the daily (20) and per-person (3 a week) limits and admin counts read it. No client access. |

| Function | What it does |
| --- | --- |
| `my_profile_id()` · `are_friends(a, b)` · `is_blocked_between(a, b)` · `is_guardian_of_profile(target)` | Building blocks (definer). |
| `viewer_relationship(target)` | `self` / `admin` / `guardian` / `blocked` / `friend` / `stranger` / `guest` for the caller. |
| `privacy_default_audience()` | Private defaults. |
| `profile_item_visible(target, item)` | The single rule: audience, private account, blocks. Unknown → hidden. |
| `player_hidden_from_viewer(player_id)` | A roster athlete's account hides from this caller's search (or blocked them). |
| `privacy_settings_json(target)` · `apply_privacy_settings(target, settings)` | Read and apply settings (internal). |
| `get_my_privacy()` · `set_my_privacy(settings)` | Own settings (MINOR-01 redefines both with the teen rules and the minor status). |
| `friend_requests_enabled()` | Feature switch `privacy.friends` (published config); default on. |
| `request_friend(target_profile_id)` · `respond_friend(request_id, accept)` · `remove_friend(target_profile_id)` · `list_my_friends()` | Friends: 20 requests a day, "who can send me requests", blocks refuse; accepting a mutual request befriends. |
| `block_user(target_profile_id)` · `unblock_user(target_profile_id)` · `list_my_blocks()` | Block ends friendship, requests, Crew follows both ways and pending tags / mentions. |
| `get_public_profiles(profile_ids, player_ids, handle)` | The only read of `profiles_public` for clients: named accounts only (≤ 50 ids each, or one exact handle), so it is no directory and hide-from-search holds. |
| `audience_allows(rel, is_private, audience, item)` · `visible_avatar_url(target)` | The rule without lookups (the view works the viewer out once per row); one photo or null, for invoker views like `reels_feed`. |
| `claimed_player_ids(ids)` · `get_aura_board(max_rows)` | Replacements for direct `profiles` reads (roster claimed badge, Aura board respecting privacy). |
| `crew_follow_blocked(athlete_id)` | Used by the `crew_follows` write policy and `toggle_crew_follow`. `crew_follows` reads: the follower, the athlete's own account, admins. |
| `admin_get_privacy(target)` · `admin_reset_privacy(target)` · `admin_set_hide_from_search(target, hidden)` · `admin_end_friendship(a, b)` · `admin_privacy_report()` | People desk → Privacy & safety. Counts only, never who. |

Also changed: `search_taggable_accounts` (3-character username prefix; hidden and blocked excluded),
`search_local_entities` (hidden athletes excluded), `athlete_stats_visible` (stats audience), `get_crew_graph` (finds
the athlete's account by `player_id`, not by name), `toggle_crew_follow` (refuses a blocked follower).

### Tag approval (PRIV-01 stage 2, `20261014100000_tag_approval.sql`, **written 2026-10-14, not applied**)

| Table / function | What it does |
| --- | --- |
| `reel_tag_rejections` | `(reel_id, player_id)` declines with `uploader_id`, `rejected_by` (null = automatic, because of a block), `rejected_at`. `reel_id` is deferred so the trigger can record a block's decline during an insert. No client access. |
| `tag_party(uploaded_by, player_id)` | Whether the caller is the uploader, the athlete's account, their guardian or an admin (used by `reels_feed`). |
| `is_school_operator_for(player_id)` | The caller is an operator of the athlete's school (exempt from the five-pending cap for game uploads). |
| `confirm_reel_player_tag(target_reel_id, tag_action)` | Only pending → confirmed / rejected (admins may undo; rejecting an approved tag that took donations is admin-only). A rejection clears `player_id` and records the decline. |
| `reels_apply_tag_defaults()` (trigger) | Refuses direct writes to the tag status / confirmed columns, refuses re-tagging a declined clip, bars an uploader after three declines, caps five pending tags per uploader per athlete (operators exempt), ends a blocked uploader's tag exactly like a decline, auto-approves friends when the athlete chose it. |
| `can_confirm_player_tag(player_id)` | A school operator confirms only for athletes with no verified account. |

Clients write only the app's `reels` columns (column grants: insert `id, video_url, title, player_id, game_id,
is_exclusive, is_vault_only, category, attested_at, rights_version, media_type`; update `title, category, is_exclusive,
is_vault_only, flash_unlock_until`); counters and tag status go through functions. A decline (by the athlete, a block
or `block_user`) leaves `tag_confirmed_by` / `tag_confirmed_at` null, so not even the uploader's own row names who
declined. `reels_feed.player_id` is null on a pending tag for anyone outside it and on a rejected tag for everyone but admins.
`get_spotlight_standings` places a clip in the week its tag was approved; `get_leaderboards` counts reactions and views
from before approval on the approval date, so waiting tags lose no credit.

### Payee verification (VERIFY-02, `20261014120000_payee_verification.sql`, **written 2026-10-14, not applied**)

Plan and owner decisions: [PAYEE_VERIFICATION_PLAN.md](design/PAYEE_VERIFICATION_PLAN.md). **No SSN is ever stored:**
earners give it to Stripe's hosted onboarding; CHECK constraints refuse SSN-shaped text and non-Stripe references.
`athlete_payout_status` adds `needs_payee_verification`: the actual payee (`payee_for_player`: the guardian on record
while they hold the money or the athlete is a minor, otherwise the athlete's account) needs a current Stripe identity +
TIN check **for the exact Stripe account that would be paid** (for a guardian holding the money, the custodial account,
which must belong to the guardian on record) and, for a guardian (an adult other than the athlete), the school's
parent-on-record confirmation or a document review **confirmed by a second admin** (not the recorder, not the subject). `payouts_enabled`
("transfers active") alone is no longer identity. `looks_like_ssn(value)` (immutable; also used in CHECKs) refuses SSN-shaped text, "SSN … digits" and long digit runs. Triggers: `payee_verifications_append_only` / `payee_verifications_no_truncate` (no deletes or truncate, even by the server),
`profiles_payout_flags_guard` / `custodial_payout_flags_guard` (`guard_payout_flags()`: payout flags change only from the
server or an override approved by an independent second admin; the custodial holder cannot change either), `players_payee_supersede` / `profiles_payee_supersede` /
`custodial_payee_supersede` (`payee_changes_supersede()`: a new guardian on record or Connect account needs new checks).

| Table | Purpose |
| --- | --- |
| `payee_verifications` | Append-only checks: subject, athlete, role, method (`stripe_connect_kyc` / `school_parent_confirmation` / `document_review` / `stripe_identity`), provider, Stripe reference, status, yes/no checks, reviewer, reason. No client access. |
| `payout_flag_overrides` | Requests to turn transfers on or off by hand: reason (10+ characters), requester, second-admin decision, 7-day expiry. No client access. |

| Function | What it does |
| --- | --- |
| `payee_for_player(target_player_id)` (payee, role, account) · `current_payee_check(subject, target_player_id, check_methods, stripe_account)` · `payee_missing_checks(target_player_id)` · `payee_hold_reason(target_player_id)` | Who the payee is, which account would be paid, and what they still need (`payee` / `identity` / `relationship`). Server only. |
| `record_stripe_kyc(account_id, identity_verified, tin_verified, transfers_active, details_due)` | Server only: records provider identity/TIN check results as verified, pending or requires-input and mirrors transfers. `create-stripe-account` calls it with Stripe's v1 `individual.verification` answer for a stored account (never while Stripe has not answered); capability/onboarding flags are not identity proof. Since 20261022140000 an identical answer returns the current record unchanged and calls serialize per account; a different answer supersedes. See PAYEE_VERIFICATION_PLAN §8. |
| `stripe_connect_context(actor_user_id, target_player_id = null)` | New `20261021120000_connect_account_context.sql`, local/unapplied. Service-only caller context: `id`, exact `stripe_connect_id`, `legal_terms_accepted_at`, `owner_user_id`, `target_player_id`, `target_kind` (`self` / `guardian`). Caller id comes from live Auth validation. Self requires recorded adult age, athlete role and no custodial handover hold; guardian requires verified nonself athlete, actual guardian on record, matching existing custodial record/DOB before handover, confirmed link, unrevoked donations consent, reviewed two-admin relationship and no disputed claim. Both reject age-blocked callers. Short transaction locks protect relied-on rows. No new KYC evidence. |
| `save_stripe_connect_account(actor_user_id, target_player_id, expected_profile_id, expected_account_id, account_id, onboarding_complete, transfers_enabled)` | New service-only RPC, local/unapplied. Returns saved account id text. Repeats context authorization after the Stripe await; exact captured profile/binding CAS permits only first binding or the same existing account. Rejects cross-profile/custodial account reuse. Guardian writes only `custodial_accounts` binding/transfer flag; self writes existing profile binding/status fields. Requires Terms before first save. Provider account advisory locks serialize reuse checks between application writers. No client write grant, payout enabling or identity/TIN inference. |
| `supersede_payee_checks(subject, target_player_id, check_methods)` · `guard_payee_verifications()` · `guard_payee_truncate()` · `guard_payout_flags()` · `payee_changes_supersede()` | Internal. |
| `admin_record_payee_check(target_player_id, subject, check_method, passed, p_reason, provider_ref)` · `admin_confirm_payee_check(verification_id)` · `admin_revoke_payee_check(verification_id, p_reason)` | Admin: school confirmation, document review (not kept), Stripe Identity for disputes — never about yourself; a second admin confirms; revoke. |
| `admin_request_payout_override(subject, target_player_id, enable, p_reason)` · `admin_decide_payout_override(override_id, approve)` | Two-admin payout override (the requester, the person it affects and the athlete's guardian cannot decide). |
| `admin_payee_overview(target_profile_id)` · `admin_payee_report()` | People desk: payee picture and counts. |

### Minor accounts (MINOR-01, `20261014110000_minor_accounts.sql`, **written 2026-10-14, not applied**)

Design: [MINOR_ACCOUNTS_DESIGN.md](design/MINOR_ACCOUNTS_DESIGN.md). Replay: `scripts/replay/schema-replay.mjs`.
`profiles` gains `birth_year` / `birth_month` (no day; replaces the 13+ checkbox as the age signal),
`birth_recorded_at`, `age_blocked_at` (under 13: the account is closed) and `age_check_required` (false for older
accounts, so their missing age stays `unknown`; true for new ones, `not_given`). Triggers: `profiles_new_account_rules`
(`profiles_apply_new_account_rules()`: inserts start on the private defaults; a teen gets `friend_requests_from =
teens`; a new account with no age takes no requests; an under-13 date refuses the insert), `profiles_age_guard`
(`guard_profiles_age()`: birth columns only through the functions; a closed account changes nothing),
`guardian_consents_append_only` / `guardian_consents_no_truncate`, `user_blocks_end_links` (a block ends every guardian
link between the two). A restrictive policy **"Closed accounts"** on every RLS table and on `storage.objects` uses
`caller_not_age_blocked()`; new RLS tables must add it too. `my_profile_id()` returns null for a closed account.
`handle_new_auth_user()` reads `birth_year` / `birth_month` from sign-up metadata. `athlete_payout_status` adds the
reasons `needs_guardian_consent` and `needs_birth_month` (`minor_payout_hold_reason`).

| Table | Purpose |
| --- | --- |
| `guardian_links` | A teen's parent or guardian: `source` invite (the teen confirms, `confirmed_at`) or custodial (the guardian on record). At most two; either side ends it. No client access. |
| `guardian_invites` | Hashed one-time 8-character codes (48 hours, newest only, 5 a day). No client access. |
| `guardian_invite_attempts` | Wrong-code tries (10 a day per account). No client access. |
| `guardian_consents` | Signed consent: form version and SHA-256 of the text, typed name, relationship, permissions (public profile, payouts), revocation. Append-only; outlives the accounts (ids set null). No client access. |
| `guardian_approval_requests` | Under-16 requests to go public or accept requests from anyone (one pending per change, 14 days). No client access. |
| `supervision_events` | What the teen and guardian both see (365 days). No client access. |

| Function | What it does |
| --- | --- |
| `age_band_from(birth_y, birth_m, on_date)` · `is_minor_band(band)` · `profile_age_band(target)` | Bands `under_13` / `teen_13_15` / `teen_16_17` / `adult` / `not_given` / `unknown`; an age is reached the month after the birth month. |
| `set_my_birth_month(birth_y, birth_m)` | Record, or correct to a younger age; under 13 closes the account (`close_under_13_account`). |
| `get_my_privacy()` · `set_my_privacy(settings)` · `request_friend(target_profile_id)` | Redefined: minor status; public needs consent; under-16 public / open requests become approval requests; `teens` refuses everyone not a recorded teen (same refusal message). |
| `create_guardian_invite()` · `preview_guardian_invite(invite_code)` · `accept_guardian_invite(invite_code, signer_name, relationship, allows_donations, allows_public_profile, form_version, form_sha256)` | Teen code; the adult (recorded 18+) previews and signs; the link waits for the teen. A wrong code returns `bad_code` (the try is kept). |
| `respond_guardian_link(link_id, accept)` · `end_guardian_link(link_id)` | The teen confirms or declines; either side unlinks. |
| `sign_guardian_consent(minor_profile_id, …, form_version, form_sha256)` · `revoke_guardian_consent(minor_profile_id)` | Sign again / change permissions (payouts only by the guardian on record); withdraw. One refusal message for every account. |
| `get_my_supervision()` · `guardian_get_supervision(minor_profile_id)` · `guardian_list_minors()` | The shared summary (settings, counts never who, events since linking for the guardian); the guardian's teens. |
| `guardian_decide_approval(request_id, approve)` · `cancel_my_approval_request(request_id)` | Under-16 approvals. |
| `admin_minor_overview(target_profile_id)` · `admin_set_birth_month(target_profile_id, birth_y, birth_m, reason)` · `admin_end_guardian_link(link_id, reason)` · `admin_minor_report()` · `admin_list_age_blocked()` · `admin_purge_minor_records()` | People desk: case file (names), corrections and link endings with a reason, counts and abuse signals, the under-13 deletion list, retention. |
| `guardian_links_enabled()` · `guardian_consent_form_version()` · `guardian_consent_form_sha256()` | Switch `minors.guardian_links`; the accepted form version and text hash. |
| `first_name_of` · `minor_has_consent` · `minor_guardian_count` · `minor_link_slots_used` · `is_supervising_guardian` · `is_guardian_of_record` · `log_supervision_event` · `athlete_profile_for_player` · `minor_payout_hold_reason` · `enforce_minor_consent` · `apply_teen_defaults` · `close_under_13_account` · `caller_not_age_blocked` · `minor_status_json` · `guardian_invite_for_code` · `record_guardian_consent` · `close_guardian_link` · `user_blocks_end_guardian_links` · `verified_player_of` · `supervision_json` · `guardian_view` · `guard_consent_records` · `guard_consent_truncate` · `profiles_apply_new_account_rules` · `guard_profiles_age` | Internal helpers and triggers (server only; `caller_not_age_blocked` is callable so the policies can use it).

### Workout challenges (CHAL-01 part 1a, `20261016100000_workout_challenges.sql`, **written 2026-10-16, not applied**)

Design: [WORKOUT_CHALLENGES_DESIGN.md](design/WORKOUT_CHALLENGES_DESIGN.md) §6 ("1a"). Replay:
`scripts/replay/workout-challenges-replay.mjs` (also builds a database cut before PRIV-01 to prove the switch refuses).
Preset responses and friend invites on listable, non-Vault, non-Exclusive `train_like_me` posts with an approved athlete
tag whose verified athlete account allows challenges. Presets `accepted` / `love_it` / `im_in` / `did_it` ("Challenge
accepted!", "Love this workout", "I'm in", "Did it! 💪"); no free text. Eligible callers: signed in, not closed, any age
band but under 13 (`unknown` / `not_given` count as 13–15). Every table is RPC-only: RLS on, no client grants, the
restrictive "Closed accounts" policy (added only when MINOR-01 exists). Functions that use PRIV-01 / MINOR-01 objects
are plpgsql, so the file applies before them and the switch then refuses. Redefines `supervision_json` (MINOR-01) to add
`summary.challenge_invites_7d`, only when MINOR-01 is present; re-run the file if MINOR-01 is applied later.

| Table | Purpose |
| --- | --- |
| `challenge_responses` | One preset per account per post (primary key `reel_id, responder_id`); changeable or removable; 50 posts a day (rolling 24 hours). |
| `challenge_nudges` | Invites ("{name} invited you to try {athlete}'s workout"), Activity only. `delivered = false` when dropped by a mute, block or admin mute, kept only so the 5-a-day and 1-per-pair-per-day limits count it. Deleted after 30 days. |
| `challenge_mutes` | A recipient's mute of one sender, or everyone (`sender_id` null). |
| `challenge_badges` | "Challenge finisher" (`challenge_finisher`) after "Did it!" on 3 different workouts. Private, noncash. |
| `challenge_athlete_settings` | "Allow challenges on my workouts". No row = on for adults, off for everyone else. |
| `challenge_sender_holds` | Admin hold on a sender's invites: `mute` (dropped silently) or `suspend` (refused), with the reason. |
| `challenge_admin_events` | Append-only admin record: the switch history (newest `switch_on` / `switch_off` is the switch), holds, retention, erasure, each with its reason. Kept 2 years (the newest switch change always). |

| Function | What it does |
| --- | --- |
| `challenge_respond(target_reel_id, preset)` | Answer, change, or remove (`preset` null). Refused off a challenge post, on the athlete's own post, across a block, above 50 a day. Returns the counts plus `badge_earned`. |
| `challenge_counts(target_reel_id)` | Counts per preset, each null below 5; on a minor athlete's post only the athlete and their guardian (MINOR-01 link or guardian on record) see them. Closed responders and responders blocked with the athlete or the viewer are left out; `mine` is the caller's own preset. Guests too. |
| `challenge_invite(target_reel_id, friend_profile_id)` | Accepted friends only; 5 a day, 1 per pair per day across posts, under a per-sender advisory lock; the same answer whether delivered or dropped; a suspended sender is refused. |
| `challenge_mute(sender_profile_id, mute)` · `challenge_inbox(max_rows)` · `challenge_my_status()` · `set_allow_challenges(allow)` · `challenge_export_my_data()` | Mutes; Activity invites (30 days, delivered, not muted or blocked, post still open); my setting, mutes and badges; the athlete switch (a minor's change logs a `settings_changed` supervision event, key `allow_challenges`); export of every challenge row about me (sent invites never show `delivered`). |
| `admin_challenge_status()` · `admin_set_challenges_enabled(turn_on, reason)` | Switch, missing PRIV-01 / MINOR-01 pieces, last change, totals; switch on refused while anything is missing. |
| `admin_challenge_post_counts(max_rows)` · `admin_challenge_nudge_senders(days)` · `admin_hold_challenge_sender(sender_profile_id, hold, reason)` | Per-post aggregate counts; invite counts per sender (recipients as ids only); mute / suspend / clear with a reason, audited. |
| `admin_challenge_retention()` · `admin_challenge_erase(target_profile_id, reason)` | Retention (invites 30 days, admin records 2 years); erase one person from every challenge table, audited. |
| `challenge_missing_dependencies` · `challenge_switch_on` · `challenges_live` · `challenge_me` · `challenge_band` · `challenge_athlete_allows` · `challenge_reel_check` · `challenge_counts_visible` · `challenge_award_badge` · `challenge_counts_json` · `challenge_profile_export` · `challenge_erase_profile` · `challenge_admin_profile` · `guard_challenge_admin_events` | Internal helpers and the append-only trigger (server only). `challenge_erase_profile` is the hook for the account-deletion path (P1-01). |

### CHAL-01 safeguard repair contract (October 15 Denver, local only)

All15 public challenge RPCs now require **first** `expected_actor_id` (canonical profile UUID), checked against the actual nonclosed caller. `challenge_counts` alone accepts null with no authenticated user; no legacy unbound overload remains. Seven admin functions use the same bound nonclosed admin gate. `challenge_expected_profile` is private.

`challenge_response_quota(responder_id,reel_id,last_responded_at)` holds at most50distinct workout identifiers within rolling24hours, independently of response/reel removal. The reel identifier deliberately has no FK; own data export includes the records. Expired entries purge on writes/retention; privileged support erasure/profile deletion clears them, an explicit exceptional reset. `challenge_redact_audit_identity` and `challenge_on_profile_delete` preserve immutable audit action/time/reason/detail while allowing only trusted identity-null deletion updates. Ordinary mutation/truncation remains denied. Late athlete/viewer blocks now hide counts and inbox entries. Replay:42/42 on local PGlite18.6; not hosted enforcement.

### Beyond the Game (BEYOND-01, local unapplied20261016120000)

Design: [BEYOND_GAME_DESIGN.md](design/BEYOND_GAME_DESIGN.md). Six RPC-only tables:

| Table | Purpose |
| --- | --- |
| `beyond_settings` | Last contribution-switch administrator/reason/time; sole live enable remains published.highlights.beyondGameEnabled, defaultfalse. RPC-only. |
| `beyond_posts` | Account-owned immutable revisioned category/caption/audience/review/rights-safety version-time and cleanup state. Pending private, approved exact audience, reported held immediately; erasure anonymizes while retaining cleanup mapping. |
| `beyond_media` | Exact private immutable user/post/media path, kind/mime/bytes/dimensions/attested video duration. One<=45sec50MiB video or<=3JPEG5MiB photos. This metadata is not content/person/rights verification. Mappings retained until actual Storage absence. |
| `beyond_submission_quota` | Server reservation UUID/time per canonical owner, durable5perrolling24h regardless of self-removal. Own export;35day write/admin retention; privileged support erasure is an exceptional reset. |
| `beyond_reports` | Reporter canonical UUID, post/reason/time for immediate distribution hold and protected review; own report export and erasure. Not a public popularity metric. |
| `beyond_admin_events` | Restricted reason/action/time audit for switch/review/retention/cleanup. Identity references null on account deletion; support erasure sanitizes corresponding reasons. Minimal retained action/time is not counsel-approved retention. |

All public entrypoints carry required `expected_actor_id` and server-check the actual canonical nonclosed caller; guestnull is accepted only for permitted unauthenticated reads. `beyond_game` is a private Storage bucket; no public URL/upsert fallback. Metadata validates scope/type/size, not decoded media or rights. Authorized current admins can read removed mapped bytes strictly for cleanup until real provider erasure; participant/guardian/public media access refuses removed content.

| Function | Contract |
| --- | --- |
| `beyond_missing` | Checks required PRIV-01/MINOR-01 dependency functions before operational enable. |
| `beyond_enabled` | Reads sole published contribution enable; disabled/missing meansfalse. |
| `beyond_actor` | Private current nonclosed canonical profile and supplied expected actor match; only selected publicreads allow unauthenticated guestnull. |
| `beyond_admin` | Private current nonclosed admin authority plus expected canonical actor check. |
| `beyond_owner_open` | Determines owner submission eligibility and closure/age status. |
| `beyond_can_view` | Private exact owner/admin/guardian or accepted approved audience check with current blocks/privacy/age and switch. |
| `beyond_post_json` | Server exact post/media projection with optional protected review/report detail; no money/athlete payee identity. |
| `beyond_status` | Actor-bound feature/dependency/audience/submission capability reader. |
| `beyond_posts` | Bounded category/UUIDcursor approved accepted-audience list, current viewer rechecked. |
| `beyond_my_posts` | Bounded own review status/cursor list, canonical actorbound. |
| `beyond_reserve` | Idempotent private draft reservation, exact media/attestations/audience and durable5rolling24h quota. |
| `beyond_identity_removed` | Deletion/erasure trigger anonymizes author/caption/review/report identities while preserving removed object cleanup targets. |
| `beyond_export_my_data` | Bounded section/cursor own-data export for posts/reports/quota; server canonical actorbinding. |
| `admin_beyond_erase_profile` | Reasoned admin support erasure, up to50owned posts/call; immediately removes distribution and queues preserved media targets. Privileged quota reset exception. |
| `beyond_storage_guard` | Storage write metadata/type/owner/path guard for immutable reserved media; no decoded content claim. |
| `beyond_storage_allowed` | Restrictive storage predicate protecting exact draft inserts, current accepted reads, no updates and removed cleanup admin access. |
| `beyond_finalize` | Exact existing reserved owned-file metadata validation and idempotent pending submission; actual media content review remains required. |
| `beyond_remove` | Own canonical-actor removal immediately hides distribution, queues physical cleanup without refunding quota. |
| `beyond_report` | Eligible current viewer concern immediately holds distribution and records reason once per reporter/post. |
| `beyond_media_access` | Actor-bound exact authorized post/file access, SDK-requested60s TTL; never removed or substituted/external paths. |
| `admin_beyond_status` | Protected contribution/dependency/switch-change status, pending and cleanup aggregates. |
| `admin_beyond_set_enabled` | Reasoned nonclosed admin-only sole published contribution switch, dependency-checked, defaultoff. |
| `admin_beyond_posts` | Bounded review state/cursor queue with protected reports/cleanup metadata. |
| `admin_beyond_review` | Reasoned approve/remove with immutable expected revision, accepted audience/owner/media/dependency recheck. |
| `admin_beyond_cleanup_targets` | Protected exact removedpost mapped private paths for real provider erasure, never SQL-only delete claim. |
| `admin_beyond_cleanup_finish` | Rechecks actual storage catalog absence; complete onlywhen every target absent, partial failures visible. |
| `admin_beyond_retention` | Reasoned admin24h draft expiry and35day quota purge; expired files remain mapped pending physical cleanup, no deployed schedule. |

Canonical copy/generated maps and independent reviews remain in integration; written SQL is not hosted activation. Retention is explicitly invoked. Previously delivered signed bytes cannot be recalled.

`beyond_profile_erasure`: profile-deletion trusted identity/audit sanitization trigger, server-only.

CHAL participant source extension: `challenge_friends(expected_actor_id,max_rows)` adds a16th actor-bound endpoint for at most50accepted friend choices, excluding blocked/closed/nonaccepted records; minimal profile/name projection. No new table or public graph. Source and replay are reverified before app-ready, preserving the original admin checkpoint.

### Beyond legacy discovery integration (local)

`beyond_legacy_posts(expected_actor_id,category,max_rows)` returns a JSON array of at most24 minimal cards (id, title240codepoints, player_id, athlete_name160codepoints, workout/service category). Internal filters retain Train/Serve categories; exact confirmed linked verified/open athlete and open uploader are required. Both current photo audiences, blocks, age closure and applicable known-teen public consent are checked explicitly; the privileged reels_feed view alone is not an authorization boundary. Ambiguous legacy verified ownership fails closed. Guest null is allowed only without an authenticated actor. No media URL or full profile is returned; contribution enablement is separate. Canonical integration now contains the final migration exactly once; written/unapplied.
## FUN-01 / QUIZ-01 — locally written testing pilots

Default-off, approved account testing only; no hosted SQL applied. [Fan Zone design](design/FAN_ZONE_DESIGN.md), [Sport Pop Quiz design](design/SPORT_POP_QUIZ_DESIGN.md), task evidence FUN-01/QUIZ-01. No payment/Aura/contest release.

| Table | Purpose |
| --- | --- |
| `fan_zone_campaigns` | Default-off testing-only fan award campaigns, approved tester audience, immutable rules/windows and free-ballot result revisions. |
| `fan_zone_entries` | Private fan-video drafts/revisions, server-reserved immutable storage paths, verified media metadata, review and withdrawal state. |
| `fan_zone_consents` | Immutable exact-entry assent/guardian permission/revocation receipts tied to scope/media revision and active confirmed supervision link. |
| `fan_zone_ballots` | One current versioned free ballot per canonical eligible profile/campaign, with restricted invalidation rationale. |
| `fan_zone_requests` | Caller/request/argument-bound ballot retry receipts, capped60/window and expired30days after vote close. |
| `fan_zone_cases` | Private bounded report/appeal/deletion cases with hashed reporter receipt secret/30day receipt access, actual removal completion and escalation. |
| `fan_zone_audit` | Immutable server actor/time Fan Zone configuration/review/consent/ballot/result/removal trace; restricted corrective access. |
| `fan_zone_reflections` | Voluntary private preset service reflection receipts, deletable by owner; no beneficiary detail or payment condition. |
| `sport_quiz_settings` | Default-paused/testing-only quiz switch with approved canonical-profile tester allowlist. |
| `sport_quiz_questions` | Human-reviewed immutable family/version, sport or optional fun topic, bounded sources, four choices and explanation; draft/approved/archive/void. |
| `sport_quiz_attempts` | Own timed30/90-second immutable question/result lifecycle per account UTC week; hash-only active capability; old untimed attempts historical. |
| `sport_quiz_badges` | Private equal right/wrong Trivia Explorer completion; historical Sport Learner preserved; no Aura wallet, vote/payment value; correction may void. |
| `sport_quiz_audit` | Immutable editorial/admin correction history; protected erasure removes own participant learning associations; admin export redacts participant actor/question/attempt links. |

| Function | Use (narrow caller/admin/service guard; helpers internal) |
| --- | --- |
| `fun_eligible` | Internal canonical-profile known-age/open-account eligibility predicate for fan actions. |
| `fun_actor` | Internal authenticated canonical profile/age guard; never assumes profile ID equals Auth user ID. |
| `fun_admin_guard` | Internal admin/known-age guard for corrective Fan Zone operations. |
| `fun_pilot` | Internal testing-only campaign/tester-audience authorization, empty allowlist denies by default. |
| `fun_scope` | Internal exact revision/digest/alias/caption/campaign/audience/form/no-reuse consent scope. |
| `fun_guardian` | Internal currently active confirmed supervision-link predicate; does not prove legal guardianship. |
| `fun_permission_valid` | Internal current exact-entry assent/guardian-link/grant/revocation validity. |
| `fun_candidate` | Internal accepted/currentverified/media-present/permission-valid candidate eligibility predicate. |
| `fun_entry_json` | Internal redacted private own/guardian/admin entry DTO including tracked media revision removal list. |
| `fun_campaign_json` | Internal campaign DTO with approved tester identities restricted to admins. |
| `fun_case_json` | Internal minimal secret-authorized case receipt projection; no other case text. |
| `fun_audit` | Internal append-only trusted actor/time corrective event capture. |
| `fun_signature` | Internal hash of ballot request arguments for caller-bound exact retry. |
| `fun_admin_campaign` | Admin create/configure/testing-open/pause/close/finalize/recount; winners derived from valid free totals. |
| `fun_entry` | Caller-owned private reserve/edit/verified-submit/withdraw with immutable revision paths and server entry window. |
| `fun_permission` | Exact expected-scope assent/linked guardian grant/revoke; edit/stale form/link ending invalidates publication. |
| `fun_vote` | Atomic one free ballot/account/window; version CAS, caller/request/args retry binding, no-self vote and capped mutations. |
| `fun_admin_entry` | Admin normal decisions compare exact reviewed scope atomically; explicit current-entry emergency suspension with rationale; no winner selection. |
| `fun_admin_ballot` | Admin proven ballot invalidation with reason and recount-required audit. |
| `fun_media_access` | Caller-scoped exact revision read/verify/remove authorization before server private storage access. |
| `fun_verify_media` | Service-only sanitized digest/bytes/duration commit to still-authorized immutable draft; no client media assertion. |
| `fun_complete_removal` | Service-only actual object-absence completion across all tracked entry revisions/deletion cases. |
| `fun_case` | Bounded report/appeal/removal request with hashed secret; public report saturation cannot deny owner deletion. |
| `fun_case_status` | Secret-authorized unexpired minimal case status; no private target existence leak. |
| `fun_admin_case` | Admin case resolve/escalation with reason; completion only server-confirmed deletion. |
| `fun_reflection` | Own private voluntary preset service receipt create/delete, separate from badges/money. |
| `fun_snapshot` | Own/guardian plus enrolled-pilot campaign/candidate/result/story; eligible is known age, can_participate is own tester capability; private guardian queue independent. |
| `fun_admin_snapshot` | Complete selected bounded campaign Data with independently paged cases/audit, campaign-bound timestamp/ID JSON cursors and defined counts; corrective identity scope. |
| `fan_zone_private.upload_allowed` | Private-schema Storage INSERT policy helper; schema usage denied to API roles, only policy-bound execute; owner editable reserved path/window and no existing object. |
| `fun_page_time` | Insert trigger ensures timestamp-page ordering without same-transaction skipped case/audit rows. |
| `fun_immutable_record` | Trigger protects exact consent/audit receipts against mutation/truncate; identity nulling handled for deletion. |
| `fun_prune_receipts` | Service-only explicit expiry cleanup for bounded ballot retry records; no scheduler or hosted execution established. |
| `quiz_week` | Internal authoritative UTC Monday start for one weekly assignment/badge. |
| `quiz_actor` | Internal canonical account/knownage/closed check; no client-supplied participant identity. |
| `quiz_admin_actor` | Internal protected quiz content/settings admin guard. |
| `quiz_require_testing` | Internal default-paused/tester allowlist/production-refusal guard for quiz participation. |
| `quiz_guard_question` | Trigger freezes issued question wording/answers; edits become new reviewed versions. |
| `quiz_guard_audit` | Trusted editorial/admin audit immutable; protected own-learning erasure removes participant audit associations, with FK nulling on identity deletion. |
| `quiz_snapshot` | Current v2 own account/week/preferences, prompt-free attempt summary, exact unseen pools and history revision/counts; active question never appears. |
| `quiz_start` | Current v2 atomic unseen approved family once per expected canonical account/UTCweek; only exact original Start capability returns an active prompt with fixed server deadline. Refresh cannot resume a round. |
| `quiz_answer` | Current v2 original capability/expected profile and server deadline authorize one committed answer; exact option/request recovery preserves one private equal participation badge. |
| `quiz_skip` | Current v2 expected-profile/week Skip consumes an unspent weekly opportunity without prompt/reward; already-spent returns authoritative status, active closure uses End. Not now is separate local invitation dismissal. |
| `quiz_admin_settings` | Admin default-paused testing audience/settings change with authoritative rationale. |
| `quiz_admin_question` | Admin question create/newversion/approve/archive/void with fact-review reason and invalid-badge correction. |
| `quiz_admin_snapshot` | Complete <=100 question-version bank, defined current-week counts and bigint-paged audit; no participant answer list. |

| `fun_storage_guard` | Campaign→entry Storage INSERT/UPDATE mutation fence, including service writes; stale/path-moving/post-withdrawal/deletion/verified writes refused. Actual provider compensation still needs hosted proof. |

| `fun_guardian_grant_valid` | Current pinned exact guardian receipt/link/scope check; a replacement requires a fresh explicit grant after revocation/link loss. |

`fan_zone_entries.guardian_consent_id` is a nullable private FK to the relied-on exact consent receipt. First valid grant stays pinned; older other grants cannot replace it automatically. A fresh explicit replacement does not let the earlier actor’s stale revoke disable the replacement.

| `quiz_normalize_options` | Protected option whitespace canonicalization; legacy invalid options remain visible for audited admin correction, deny assignment/completion. |

Fan admin correction changes unapplied RPC signatures together: `fun_admin_entry(uuid,text,text,jsonb)` requires exact displayed scope for normal decisions; null scope is explicit emergency Suspend only. `fun_admin_snapshot(uuid,text)` accepts version1 campaign-bound JSON cursors with independent case/audit timestamp/ID markers. Old signatures are explicitly dropped and only new signatures granted. Existing timestamp insert guards remain; tied recovery/import rows also page completely.

## QUIZ-02 timed trivia mapping

New migration `20261014150000_timed_sport_trivia.sql` replaces untimed authority; root canonical
append and actual verification are recorded in [QUIZ-02](../agents/QUIZ-02.md). Prior QUIZ-01
checkpoints remain historical. First legacy upgrade resets admission to paused/testing-only/empty cohort; repeated canonical application preserves existing timed settings, live deadlines/capabilities, preferences and history.

| New private table | Purpose and boundaries |
| --- | --- |
| `sport_quiz_preferences` | Default-off invitations, sports/mix, notice, preference CAS, retained monotonic history revision and once-weekly claim. |
| `sport_quiz_exposures` | Unique account/family first issuance with immutable version; includes ended/expired/void; erased with learning history. |
| `sport_quiz_week_guards` | Profile/week/spent/prune only,35days; retained after disclosed history erasure, cascades on account deletion. |
| `sport_quiz_requests` | Private bounded exact request/input recovery/cancelled Start, expected week; no plaintext token/prompt; erasable. |

| New function | Authority/purpose |
| --- | --- |
| `quiz_week_at` | Internal UTC Monday from explicit locked/read server instant. |
| `quiz_expected_actor` | Internal canonical current JWT equality with expected participant/admin ID and current permission. |
| `quiz_cursor` | Internal exact bounded version/stream/timestamp/ID cursor validation before casts. |
| `quiz_lock` | Internal settings/account serialization; caller captures clock after acquiring locks. |
| `quiz_preferences_dto` | Internal own default/retained preference and revision projection. |
| `quiz_summary` | Internal prompt-free immutable attempt metadata/effective expiry at supplied server instant. |
| `quiz_question_dto` | Internal immutable content projection; only authorized Start/terminal history can expose it. |
| `quiz_result_dto` | Internal own terminal result/explanation; no active correct-answer projection. |
| `quiz_digest` | Internal normalized-input SHA binding without plaintext secret storage. |
| `quiz_receipt_dto` | Internal minimal exact receipt/terminal result, never active question. |
| `quiz_save_request` | Internal bounded caller/request receipt insertion and original outcome. |
| `quiz_spend` | Internal atomic35-day minimal weekly quota. |
| `quiz_expire` | Internal persisted terminal expiry under lifecycle lock, no snapshot writes. |
| `quiz_fun_slot` | Internal deterministic account/UTC-week4sports/1optional fun slots without inferred-interest tracking. |
| `quiz_fun_available` | Internal reviewed unseen optional-topic availability without fallback or repeat. |
| `quiz_bump_history` | Protected material learning-change revision under settings/account serialization; stale erase rejects, exact retries do not bump. |
| `quiz_preferences` | Participant expected-profile/CAS/request preference/notice write; Off separate from End. |
| `quiz_invitation` | Participant optional once-weekly quiet card claim; no prompt/deadline or draw. |
| `quiz_history` | Own terminal learning/badge/correction pages; no active prompt or other child's history. |
| `quiz_erase_history` | Own expected-profile/history CAS: ends current/pending week, removes learning/exposures/badges/receipts/participant audit; retains disclosed preference/revision and quota. |
| `quiz_admin_retention` | Expected-current-admin reasoned bounded expired receipt/quota pruning; preserves unexpired guards. |

Replaced `quiz_snapshot()` is read-only v2 own availability/preferences/pools/week and sanitized
attempt status, never an active prompt. `quiz_start` binds expected profile/week/notice/topic,
duration30/90, request UUID and memory-only256-bit token hash. Exact original Start recovery
keeps the deadline; ordinary receipt/history cannot resume. `quiz_answer` accepts only a valid
owned active token before the locked deadline; exact committed recovery remains readable.
`quiz_end` accepts exactly one attempt or Start UUID and no secret, including a cancellation
fence before delayed Start. `quiz_skip` explicitly closes the expected week; Not now does not.

Admin settings/question/retention writes require captured canonical admin equality, reason and
current permission. Pause permanently ends active rounds; re-enable cannot resume them. Source
approval requires explicit family review and source notes; corrections preserve issued versions.
`quiz_admin_snapshot` pages50 questions and50 audit independently with full totals/effective
expiry. Helpers/direct private tables are revoked from clients; dropped old untimed overloads
fail closed. UUID receipts are capped60/account/week with57 ordinary slots and protected answer,
Off and End slots; exact committed retries precede capacity checks. Erasure uses CAS without a
UUID receipt; unknown deletion requires Refresh/reconfirm rather than auto-newrevision erase.

## QUIZ-03 trivia play together (`20261014160000_trivia_play_together.sql`, **written 2026-10-14, not applied**)

Design: [TRIVIA_PLAY_TOGETHER_DESIGN.md](design/TRIVIA_PLAY_TOGETHER_DESIGN.md) (§9 overrides §1–§7). Appended to
`schema.sql` after QUIZ-02. Settings stay paused, testing-only and empty-cohort; both new switches start off.
Replays: `node scripts/replay/trivia-play-together-replay.mjs <pglite dist>` (QUIZ-03 actors) and
`node scripts/replay/timed-trivia-replay.mjs <pglite dist> --with-quiz03` (every QUIZ-02 check on top of QUIZ-03).

| New private table | Purpose and boundaries |
| --- | --- |
| `sport_quiz_round_items` | The attempt stays the weekly round (`mode = 'round'`); one row per issued question (position 1–5) with its own `issued_at` / `expires_at`, private answer, status `issued` / `answered` / `expired` / `ended` / `void`. Unissued positions do not exist, so they stay in the pool. |
| `sport_quiz_groups` | Family-challenge group: preset `name_key` only (`family`, `friends`, `team_fans`, `cousins`, `game_day_crew`, `home_team`), optional sport theme, current `owner_id` (hand-over on creator deletion), `active` / `closed`. No search, no listing. |
| `sport_quiz_group_members` | Membership (max 12; an account belongs to at most 5, creates at most 3). `removed` rows (creator, block or admin) bar rejoining; leaving deletes the row. |
| `sport_quiz_group_codes` | One SHA-256 hashed 8-character code per group, valid 7 days; deleted when the group is full and on any removal (rotation). |
| `sport_quiz_group_join_attempts` | Joined / wrong code / refused (+ private reason: `teen_rule`, `blocked`, `full`, `removed`, `closed`); 10 wrong-or-refused tries and 5 joins per account per day; purged after 35 days. |
| `sport_quiz_group_sets` | Shared group-week set, drawn at random from the theme without reading any member's exposures; purged at week end + 35 days. |
| `sport_quiz_group_cases` | Append-only safety log: `report` (fixed reason), `admin_view`, `admin_removal`, `admin_close`, `member_removed`, `blocked_removed`, `handover`, `dissolved`. No FK on `group_id`, so it survives the group purge. |

Changed tables: `sport_quiz_settings` gains `round_size` (1–5, default 5), `groups_enabled` (`trivia.groups`) and
`images_enabled` (`trivia.images`), both default off. `sport_quiz_questions` gains `question_type` (`choice4` |
`true_false` | `image_choice`), 2–4 options with `correct_option < option count`, `true_false` fixed to
`["True","False"]`, and image rights fields (`media_path`, `media_licence`, `media_source`, `media_attribution`,
`media_alt_text`, `media_size_bytes ≤ 307200`, `media_has_person = false`, `media_reviewed_by`); type and media join
the immutability trigger; `image_choice` approval raises `quiz_images_off` while the switch is off and images are
never drawn (no bucket, no delivery). `sport_quiz_attempts` gains `round_state` (`item` | `between`), `position`,
`planned_items`, `round_size`, `next_by`, `topic_category`, `sport_filter`, `group_id`. `sport_quiz_badges` becomes
unique per `(profile_id, label, period)` with `kind` (`weekly`, `sport`, `family`, `season`), `sport` and
`visibility` `private` | `groups`. `sport_quiz_requests` adds operation `next`. `supervision_events` adds
`trivia_group_joined` / `trivia_group_left`.

| New or redefined function | Authority/purpose |
| --- | --- |
| `quiz_start` (redefined, same signature) | Starts a round: `planned_items = min(round_size, unseen)`; issues item 1 only; refuses (`quiz_week_closing`) unless items × duration + gaps fit before the UTC week ends. Response adds `active_item`. |
| `quiz_group_start` | Same weekly opportunity, started only from a group page; shared set unless the member has seen that family, then a private replacement. Refused while `trivia.groups` is off. |
| `quiz_next` | Request UUID + expected position + session secret. Issues the next item with its own deadline; an exact replay returns the same item only before its deadline; re-checks the week (`week_closed`) and closes short when the pool runs out. |
| `quiz_answer` / `quiz_end` (redefined) | Answer the open item (bounded by its option count); a round waits in `between` for 2 minutes, then closes. A round with at least one committed, non-void answer is `completed`; leaving ends the whole round. |
| `quiz_snapshot`, `quiz_history` (redefined) | Effective round state is computed read-only; history lists closed items with private results, never an open item. Snapshot adds `round_size`, `groups_available`. |
| `quiz_badge_shelf`, `quiz_badge_visibility` | Own badges; opt one in or out of group pages. |
| `quiz_season_recap` | Own calendar-quarter recap: facts by sport and topic, rounds, badges. |
| `quiz_group_create`, `quiz_group_join`, `quiz_group_leave` | Preset names; one-time code; joins follow MINOR-01's friend-request setting for every teen both ways plus PRIV-01 blocks; every refusal reads `refused`. |
| `quiz_group_remove_member`, `quiz_group_renew_code`, `quiz_group_set_theme` | Creator only; removal bars rejoining and rotates the code. |
| `quiz_group_page`, `quiz_groups_mine`, `quiz_group_report` | Live page: played-this-week mark per member, group totals only, opt-in badges, member ids only to the creator; removed members get only the removal notice. Report carries the group id and a fixed reason. |
| `quiz_admin_play_settings` | Admin round size and the two switches, audited. |
| `quiz_admin_group_case`, `quiz_admin_group_remove` | Admin audited case view (member ids, age bands, refusal reasons, case log; each read logged) and removal / close with a reason. |
| `quiz_admin_question`, `quiz_admin_settings`, `quiz_admin_snapshot`, `quiz_admin_retention`, `quiz_erase_history` (redefined) | 300 cap counting draft + approved; per-item void; round-aware pause; snapshot adds `active_total`, `forecast`, `groups`, `reports`, round/badge counts; retention also purges codes, sets, join attempts and closed groups; erasure also leaves groups (hand-over/dissolve), removes join attempts, sets of dissolved groups and every badge. |
| `supervision_json` (MINOR-01, redefined by copy) | Adds `summary.trivia_groups` (count only); joined/left events arrive through `supervision_events`. |

Internal helpers (revoked from every client role, `search_path` pinned): `quiz_round_gap`, `quiz_week_end`,
`quiz_quarter_of`, `quiz_normalize_options` (now 2–4 options), `quiz_guard_question`, `quiz_question_dto`,
`quiz_fun_available`, `quiz_unseen_count`, `quiz_facts`, `quiz_played`, `quiz_round_view`, `quiz_summary`,
`quiz_result_dto`, `quiz_round_items_dto`, `quiz_round_close`, `quiz_round_settle`, `quiz_expire`, `quiz_round_pick`,
`quiz_round_issue`, `quiz_active_item`, `quiz_round_begin`, `quiz_sync_badges`, `quiz_badge_defaults` (trigger),
`quiz_group_code_new`, `quiz_group_active_count`, `quiz_group_issue_code`, `quiz_teen_accepts`, `quiz_group_refusal`,
`quiz_group_case`, `quiz_group_handover`, `quiz_group_mark_removed`, `quiz_group_display_name`, `quiz_group_page_dto`,
`quiz_group_ensure_set`, `quiz_group_owned`, `quiz_admin_forecast`, `quiz_groups_on_block` (trigger on
`user_blocks`: removes the blocked party), `quiz_group_owner_gone` (trigger: creator deletion hand-over),
`quiz_guard_group_case` (trigger: append-only log).

Access: no table grants; RLS plus the MINOR-01 restrictive "Closed accounts" policy on every new table; lock order
settings → group → account → attempt; advisory lock per group while a shared set is drawn.

**Security review fixes (RLS_SECURITY + MINOR_SAFETY + PRIVACY, 2026-10-14).** Teen rules are re-checked after a join:
`quiz_group_recheck` (trigger `quiz_groups_on_profile` on `profiles` birth month/year, `friend_requests_from`,
`age_blocked_at`), `quiz_group_recheck_pair` (triggers `quiz_groups_on_friendship` on unfriend / accepted→other and
`quiz_groups_on_guardian_link` when `ended_at` is set) and lazily `quiz_group_needs_recheck` / `quiz_group_recheck_group`
in `quiz_group_page` (now volatile) and group Start, which covers birthdays. An age correction removes the account
that changed; a setting change, unfriend or ended link removes the party the teen's rule refuses (`quiz_pair_ok`).
Removals use reason `teen_rule` (case `rule_removed`, no rejoin bar; the join check decides). An under-13 closure
(`quiz_profile_closed`) removes every membership with reason `closed` (case `account_closed`), and a closed account
never appears on a page. Erasure keeps `sport_quiz_group_join_attempts` (returns `retained_join_attempts`) so limits
and refusal evidence survive. Group pages: fact totals are null until 3 members played this week, then rounded down to
multiples of 5; a closed group lists no members; `member_ref` is an opaque per-group reference (`quiz_member_ref`,
SHA-256 of a private per-group `ref_salt`, group id and profile id) and `quiz_group_remove_member(uuid,text,uuid)`
takes it. Codes come from pgcrypto `gen_random_bytes` with rejection sampling. Image rights add required
`media_no_marks` and `media_exif_stripped` (true), and `quiz_admin_question(..., 'review_media', ...)` records
`media_reviewed_by` / `media_reviewed_at` by a second admin; approval raises `quiz_media_review_required` without it
(audit action `question_review_media`).

**Intentional QUIZ-02 behaviour changes** (the `--with-quiz03` run marks them `quiz03 ?`): (1) Start issues a round
of up to `round_size` questions (default 5) instead of one; with a one-question pool the round behaves exactly like
QUIZ-02. (2) The bank cap is 300 and counts only draft and approved versions (was 100 counting every version);
`question_total` still counts every version for paging and `active_total` is new. (3) An answer in a round that
has more questions returns outcome `answered` with the round waiting for Next, and history lists a round only
once it closes. (4) Leaving after at least one answer closes the round as `completed` (keeps the badge), not
`ended`. (5) A correction voids one item; the round is voided only when no committed answer remains. Harness-only
adjustment: the QUIZ-02 backdate helper also backdates the open round item, because a round's deadline lives there.

## QUIZ-04 Life Playbook and personal progress (`20261014180000_life_playbook.sql` + `20261014190000_life_playbook_bank.sql`, **written 2026-10-14, simplified 2026-10-15, not applied**)

Design: [LIFE_PLAYBOOK_DESIGN.md](design/LIFE_PLAYBOOK_DESIGN.md) (§8 owner simplification overrides §2–§7). Appended to
`schema.sql` after the QUIZ-03 starter bank. `trivia.life` (`sport_quiz_settings.life_enabled`) starts off; settings stay
paused / testing-only. The bank file is generated by `node scripts/life-bank-sql.mjs` from
`supabase/content/life_playbook_bank.json` (40 drafts, 10 per chapter, all 13+); every chapter stays closed after it
loads. Replay: `node scripts/replay/life-playbook-replay.mjs <pglite dist>`.

**Owner simplification (2026-10-15).** Life questions are simple facts with no money numbers, approved by one admin the
same way as sports trivia. Removed before anything was applied (excerpts in
`archive/superseded-2026-10-15/sql/life_playbook_review.archived.sql`, registry `data-ownership.json` → `archived`): the
CPA sign-off (`quiz_life_signoffs`, `quiz_admin_life_signoff`, `quiz_admin_life_signoff_confirm`,
`quiz_life_signoff_current`, `quiz_life_signoff_dto`, `quiz_guard_life_signoff`), named finance / tax reviewers
(`quiz_content_reviewers`, `quiz_admin_reviewer`, `quiz_life_active_grant`, `quiz_life_is_author`, `quiz_guard_reviewer`),
allow-listed sources (`quiz_life_source_ok`), the re-review action and the January withdrawal (`quiz_life_due_on`,
`quiz_life_today`, `quiz_life_item_current`, `quiz_life_tax_year_ok`), the 16+ / 18 bands (`quiz_life_band_rank`,
`quiz_life_age_cap`) and the illustrative-figure marker (`quiz_life_field_marked`).

| New private table | Purpose and boundaries |
| --- | --- |
| `sport_quiz_life_chapters` | Four chapters seeded closed, all 13+: `money_huddle` (Money Huddle), `savings_season` (Savings Season), `scam_defense` (Scam Defense), `smart_plays` (Smart Plays). Columns `id`, `title`, `framing`, `open`, `position`, `updated_at`, `updated_by`. `open` switches on only when the chapter has 5 approved questions (one round; trigger `quiz_guard_life_chapter`); the id never changes; no delete. |
| `sport_quiz_levels` | Highest level reached per account (`track = 'overall'`) and per Life chapter; only goes up (`quiz_guard_level`); removed only by history erasure or account deletion. |

Changed tables: `sport_quiz_settings` gains `life_enabled` and `level_thresholds` (Rookie 0, Varsity 15, All-Star 40,
Pro 80, Hall of Fame 150; strictly increasing). `sport_quiz_questions` allows `topic_category = 'life'` and gains
`chapter`, `min_age_band` (`13` only) and `education_only`; all three are immutable on a version. `sport_quiz_attempts`,
`sport_quiz_week_guards` and `sport_quiz_requests` gain `round_kind` (`personal` | `group` | `life`); attempts are
unique per `(profile_id, week_start, round_kind)` and guards keyed the same way. `sport_quiz_preferences` gains the
private `life_opt_in`, `life_notice_version` (`life-playbook-v1-testing`), `life_opted_in_at`, `life_version`. Badges add
kind `life` (`<Chapter> Playbook`, lifetime, always private). Audit adds `life_settings` and `life_chapter`.

| New or redefined function | Authority/purpose |
| --- | --- |
| `quiz_life_start` | Life round (kind `life`, 90 s default, 30 allowed, optional chapter): `trivia.life`, Life notice and opt-in, open chapters. A closed or empty chapter reads `quiz_no_question`. |
| `quiz_life_snapshot`, `quiz_life_chapters`, `quiz_life_progress`, `quiz_level` | Own Life availability (`off`, `not_opted_in`, `empty`, `ready`, …), the four chapters with open state and unseen counts, chapter progress (share of approved questions seen) and level (highest of stored and current). |
| `quiz_life_preferences` | Private opt-in with its own CAS version; opting out ends an open Life round; not audited. |
| `quiz_start`, `quiz_group_start` (redefined) | Kind `personal` (explicit topics sport / science / geography / general) and `group` (needs ≥ 2 active members: `quiz_group_too_small`). |
| `quiz_end(uuid,uuid,date,text,uuid,uuid,text)` (new signature) | Takes the round kind; a pending Start is cancelled against that kind's guard; an attempt must match (`quiz_end_invalid`). The 6-argument version is dropped. |
| `quiz_next`, `quiz_answer`, `quiz_skip`, `quiz_receipt`, `quiz_history`, `quiz_badge_shelf`, `quiz_badge_visibility`, `quiz_erase_history`, `quiz_snapshot` (redefined) | Next re-checks Life access (`access_revoked`); trivia-eligible accounts, plus 13+ accounts without a recorded age (`not_given` / `unknown`), can play Life (the latter Life only); Life badges cannot be shown to groups; erasure removes levels and spends all three guards; the snapshot adds `week_spent_by_kind`, `active_round_kind` and returns the open round of any kind. |
| `quiz_admin_question` (redefined) | Life fields (chapter, `min_age_band` 13, `education_only`); Life cap 200 (trivia cap 300 excludes Life). One admin approves, as for trivia; the trigger requires the education-only attestation and runs the Life copy rules (`quiz_life_copy: <rules>`). Control tower (2026-10-15): action `edit_replace` is the review queue's Edit in one transaction under the same locks — refused with `quiz_replace_draft_only` unless the replaced row is still a draft; archives it, creates the new draft version through the create / edit checks (family, content, lengths, Life fields, caps counted after the archive) and, for Life, requires the attestation and a clean copy-rule check at save; writes `question_edit` (new id) and `question_archive` (replaced id) audit rows; the receipt adds `replaced_id` and `replaced_status`. Any refusal rolls back both. |
| `quiz_admin_snapshot` (redefined) | `active_total` counts trivia only; adds `life_active_total`, `life_cap`, `week_rounds_personal`; participant counts and the audit feed exclude Life. Control tower (2026-10-15): adds `bank_counts` = `{topics, sports, chapters}`, each row a label (`topic_category` / `sport` / `chapter`, every chapter listed) with `draft_count` and `approved_count` over the whole bank, so the review queue counts unloaded drafts. Content counts only (no participant data, no threshold); admin-only like the rest of the read. |
| `quiz_admin_life_settings`, `quiz_admin_life_chapter`, `quiz_admin_life_snapshot` | Switch and thresholds (off ends open Life rounds); open / close a chapter, refused with "needs N more approved questions" until 5; the Life desk read with chapters and aggregate-only statistics. |

Internal helpers (revoked from every client role, `search_path` pinned): `quiz_level_keys`, `quiz_level_label`,
`quiz_thresholds_ok`, `quiz_level_rank`, `quiz_life_band_ok` (trivia-eligible bands plus `not_given` / `unknown`), `quiz_life_open_at` (5 approved questions open a chapter), `quiz_life_copy_problems`, `quiz_life_approved_count`,
`quiz_life_chapter_state`, `quiz_life_chapter_open`, `quiz_life_pool`, `quiz_life_unseen_count`, `quiz_life_actor`,
`quiz_life_expected_actor`, `quiz_trivia_band`, `quiz_life_access`, `quiz_life_preferences_dto`, `quiz_save_receipt`,
`quiz_group_facts`, `quiz_attempt_qualifies`, `quiz_spend` (4-argument), `quiz_life_copy_rules`, `quiz_life_normalize`,
`quiz_life_phrase_re`, `quiz_life_strip`, `quiz_life_alt`, `quiz_life_figure_re`, `quiz_audit_is_life`, triggers
`quiz_guard_life_chapter`, `quiz_guard_level`, `quiz_guard_truncate`. Redefined helpers: `quiz_guard_question`,
`quiz_summary` (adds `round_kind`), `quiz_preferences_dto` (no Life fields), `quiz_fun_available` (explicit topics),
`quiz_played` (group rounds only), `quiz_round_pick`, `quiz_round_begin`, `quiz_sync_badges`, `quiz_group_page_dto`,
`quiz_save_request` (wrapper).

**Life copy ruleset (SQL at approval, `quiz_life_copy_problems(prompt, options, explanation, chapter)`; CI over the JSON
with `pnpm life:bank:check`).** One rule list, `supabase/content/life_copy_rules.json` (version 4), embedded as
`quiz_life_copy_rules()`; the check fails if the copies differ and runs the probe cases in JS. Text is normalized first
(`quiz_life_normalize`: NFKC, zero-width removed, plain spaces / quotes, lowercase), and every rule but `non_latin_text`
matches the macron-stripped copy (`quiz_life_strip`; phrases via `quiz_life_alt` / `quiz_life_phrase_re`). Rules:
`non_latin_text` (letters outside ASCII and the allowed macron / dash forms), `advice_you_should` (you should /
shouldn't / must / need to …), `brand_name`, `tapuai_money_word` (Tapua'i variants, donate / donation / donor, Rally,
family account, payout, Aura, gift, Mālo / Malo), `nil_eligibility` (NIL, eligible / eligibility), `tax_loan_credit`
(tax, loan, credit score, APR), `money_figure` (any money amount, price, percentage, rate or k / grand / million figure,
`quiz_life_figure_re`; no illustrative exception), `year` (a calendar year), `scam_missing_report_line` (Scam Defense
explanations end "Tell a trusted adult and use Report."), `prompt_too_long` (over 120 characters) and
`explanation_too_long` (over 200).

**Other rules.** Life participant audit rows keep chapter and position in `reason`, never the question id; Life numbers
live in `quiz_admin_life_snapshot` behind its thresholds. Request budgets: `capacity_class` adds `round` — 20 round
requests (Start, Next, answer, End) per kind per week and 111 ordinary saves, then the reserved answer / off / end slots
per (week, kind). `quiz_end` refuses a pending cancel for a kind the caller cannot start (`quiz_round_closed`, nothing
written). Re-running `20261014160000` alone after QUIZ-04 stops with `quiz_rerun_after_quiz04`; `schema.sql` wraps the
QUIZ blocks in one transaction with a transaction-local `quiz.full_schema`, so the whole file still re-applies and a
failed paste leaves nothing on. New tables carry the restrictive "Closed accounts" policy and are RPC-only. The QUIZ-04 file also adds that policy to any RLS-enabled `sport_quiz_*` table missing it (QUIZ-02's four tables, applied in migration order).

**Privacy.** `quiz_admin_life_snapshot` statistics are aggregate only: per-question numbers only with ≥ 20 responders,
age band × chapter and level cells under 10 come back `null` with `hidden: true`, the opt-in count is hidden under 10,
and nothing lists or links a participant.

**Intentional QUIZ-03 behaviour changes** (the QUIZ-03 replay was updated for each): (1) three weekly opportunities
instead of one — a personal, a group and a Life round no longer consume each other; (2) group "played", Family
Challenger and group fact totals count group rounds only (a personal round no longer marks a member played);
(3) a group round needs at least two active members; (4) `quiz_end` takes `p_round_kind` and the 6-argument version is
gone; (5) the admin `active_total` and the 300 cap exclude Life questions; (6) the weekly request cap is 171 with
reserved slots per (week, kind); (7) Trivia Explorer is one per week and re-points to another qualifying round of that
week before a void withdraws it; (8) the trivia snapshot's `attempt` is the open round of any kind, else this week's
personal attempt; (9) erasure spends all three weekly opportunities and clears levels; (10) QUIZ-03's widened checks
are re-added `NOT VALID` so QUIZ-04 rows survive a re-run.

## QUIZ-05 Fresh questions: self-healing trivia, Know your athlete and refills (`20261015210000_trivia_fresh_questions.sql`, **written 2026-10-15, not applied**)

Design [TRIVIA_FRESH_QUESTIONS_DESIGN](design/TRIVIA_FRESH_QUESTIONS_DESIGN.md) (§6 design review overrides §1–§5). The one
rule: nothing reaches players without an admin approving it; spotting, pausing, drafting and alerting are automatic.
Switch `trivia.athlete_questions` (`sport_quiz_settings.athlete_questions_enabled`) starts off and the fun-fact share
(`athlete_share_pct`, 0–10) at 0. Appended to `schema.sql` inside the QUIZ transaction; `20261014180000` now refuses a lone
re-run after this file (`quiz_rerun_after_quiz05`).

| Table / column | Purpose |
| --- | --- |
| `quiz_athlete_facts` | An athlete's fun facts: `athlete_id`, `prompt_key` (six prompts), `answer_text` (2–40 characters; the **only** place the athlete's words live, cleared to null on withdrawal, unlink, under-13 block), `status` (`waiting_guardian`, `guardian_review`, `admin_review`, `approved`, `declined`, `withdrawn`, `removed`), `look_reasons`, guardian request / decision, admin decision, `decline_reason`, `question_id`, `cleared_at` / `clear_cause`. At most 3 live and one live per prompt. |
| `sport_quiz_question_stats` | Per question version: distinct `responders`, `right_count`, `timeouts`, `difficulty` (easy / medium / hard from `min_responders`), `flags` (`too_easy`, `confusing` type-aware, `too_long`), `dismissed_flags`, pause state (`paused_at`, `pause_reason`), `queued_at` (daily cap), `restored_at` / `restored_by`, `reviewed_at`. Aggregates only. |
| `sport_quiz_reports` | Question reports: `question_id`, `topic_category`, `reporter_id` (cleared at 90 days), `reason` (`wrong_answer`, `confusing`, `not_okay`, `private` on fun facts only), `is_fact`, `counted` / `not_counted_reason` (`new_account`, `no_completed_round`, `blocked_pair`). One per account per question; deleted at 180 days and by erasure. |
| `sport_quiz_imports` | One row per real bulk import (actor, reason, totals); dry runs write nothing. |
| `sport_quiz_questions.fact_id`, topic `athlete` | A fun-fact question holds `{name}` in the prompt and `{answer}` as the correct option, never the athlete's words; filled per viewer at read time. Excluded from the bank pages and the 300 cap. |
| `sport_quiz_round_items.shown_order`, `answered_position` | The shown order generated at issue (null for true / false and older items) and the shown position answered; `answered_option` stays the stored index. |
| `sport_quiz_attempts.learn_athlete_id` | The athlete whose Learn card started the personal round (validated at Start). |
| `sport_quiz_settings` | `athlete_questions_enabled`, `athlete_share_pct`, `reports_paused`, `self_heal` (five editable thresholds within bounds), `fact_salt` (private; never returned). |
| `guardian_approval_requests.change_key` | Also `fun_fact:<fact id>` (MINOR-01 approval type `fun_fact`). |
| `privacy_default_audience` | Adds `fun_facts: friends`; 13–15 are capped at friends when drawing. |

| RPC | Behaviour |
| --- | --- |
| `quiz_learn_start` | Personal weekly round from an athlete's Learn card; the athlete player id is validated (verified, open, no block) and joins the Start digest. |
| `quiz_answer` (redefined) | `p_option` is the **shown** position; mapped through the item's `shown_order`; both kept on the item and in the receipt result (`answered_position`, `correct_position`, `shown_order` after the reveal). A fun fact is re-checked at the reveal and voided (`fact_unavailable`) if it no longer passes. Fun-fact answer audit rows carry no question id. |
| `quiz_report` | After a closed round item only; fixed reasons; once per question; 10 per day; intake pause returns `paused` and records nothing; auto-pause at 2 counted reporters (1 `not_okay` / `private` on a fun fact), 3 new after a restore, at most 10 per topic per UTC day (then `queued_at` + one `report_alert`). The reply never says whether it counted. |
| `quiz_fact_submit`, `quiz_fact_withdraw`, `quiz_fact_mine`, `quiz_fact_counts`, `quiz_fact_export` | Athlete: submit (server text filter, 13–15 to the guardian or a waiting draft, no recorded age refused), withdraw (athlete only; clears the text and voids the question and unrevealed items), own facts (with "paused"), completed-month buckets (5+ / 10+ / 25+, under 5 hidden; athlete, guardians, admins and testers never counted), export of facts and decisions. |
| `quiz_fact_guardian_pending`, `quiz_fact_guardian_decide` | Supervising guardian only: see and approve / decline; never write, edit or withdraw. `guardian_decide_approval` (redefined) routes `fun_fact` keys the same way, refuses admins for them and changes no privacy setting. |
| `quiz_admin_fact_queue`, `quiz_admin_fact_decide` | Admin queue (200 newest, guardian status, look reasons, withdrawn shown without text) and decision: approve needs the checklist (no sponsor or business, no place, no schedule), the guardian's approval for 13–15 and a clean server text check; it builds the question from the prompt template, three curated wrong options not near the answer and `{answer}`, shuffled. Decline takes a reason code. |
| `quiz_admin_needs_look`, `quiz_admin_needs_look_action` | Paused, queued, flagged and reported questions with reasons and counts (responders and percentages only from `min_responders`; never a reporter). Actions `restore`, `dismiss`, `archive` (a fun fact is declined and its question voided). Edit = `quiz_admin_question` `edit_replace`, now also for an approved question that needs a look. |
| `quiz_admin_fresh_settings` | Switch, share (0–10), report intake and self-heal thresholds, with a reason; audited `fresh_settings`. |
| `quiz_admin_import` | 200 rows / 64 KB; server re-check; dry run; refuses athlete / image rows, unknown columns and cells starting with `= + - @`; exact duplicates after cleanup (all statuses, versions, families, topics, and the batch) block, near matches (80%+ shared words) warn; caps; passing rows land as shuffled drafts. No approve-all. |
| `quiz_admin_snapshot` (redefined) | Adds `refill` (weeks left per topic, sport and Life chapter; `refill_needed` under 4 weeks; assumed pace of one round a week without recent play) and `fresh` (settings, report rules, Needs a look / paused counts, fact queue counts, today's alert topics); strips `fact_salt`; bank pages and counts exclude fun-fact questions; participant fact audit rows stay out of the feed. |
| `quiz_admin_retention` / `quiz_erase_history` (redefined) | Reporter ids cleared at 90 days, reports deleted at 180 (`cleared_reporters`, `removed_reports`); erasure removes the caller's reports (`removed_reports`). |
| `supervision_json` (redefined) | Adds `fun_facts_shared` (live approved facts; the same for teen and guardian). |

Redefined draws and DTOs: `quiz_round_begin` (12 arguments; the QUIZ-04 11-argument form is dropped), `quiz_start`,
`quiz_group_start`, `quiz_life_start`, `quiz_next`, `quiz_round_pick` (fun-fact slot, paused never drawn, at most two
hard), `quiz_round_issue` (shown order), `quiz_unseen_count`, `quiz_fun_available`, `quiz_life_pool`,
`quiz_group_ensure_set` (two-hard cap without reading members' history), `quiz_result_dto`, `quiz_round_items_dto`,
`quiz_guard_question` (draft → approved may permute options with the same texts and correct text; fact shape),
`quiz_admin_question` (approval shuffle; caps exclude fun facts; fun facts approved only through the fact queue).
Helpers: `quiz_fresh_norm`, `quiz_levenshtein`, `quiz_near_match`, `quiz_word_overlap`, `quiz_random_order`,
`quiz_shuffle_options`, `quiz_same_options`, `quiz_bucket`, `quiz_self_heal_defaults`, `quiz_self_heal_ok`,
`quiz_report_rules`, `quiz_fact_prompts`, `quiz_fact_prompt`, `quiz_fact_not_okay_words`, `quiz_fact_text_problems`,
`quiz_fact_look_reasons`, `quiz_fact_audience_ok`, `quiz_fact_viewer_ok`, `quiz_fact_visible`, `quiz_fact_fill`,
`quiz_fact_slot`, `quiz_fact_pick`, `quiz_fact_void_items`, `quiz_fact_retire_question`, `quiz_fact_clear`,
`quiz_fact_actor`, `quiz_fact_request_open`, `quiz_fact_owner_dto`, `quiz_fact_month_bucket`, `quiz_question_stats_refresh`,
`quiz_question_paused`, `quiz_question_hard`, `quiz_round_hard_count`, `quiz_open_reports`, `quiz_needs_look`,
`quiz_shown_position`, `quiz_item_question_dto`, `quiz_item_result_dto`, `quiz_admin_refill`. Triggers:
`quiz_items_stats` (counters when an answer or time-out commits), `quiz_fact_on_approval` (guardian-only decisions move
the fact), `quiz_facts_on_profile` (unlink / under-13 block clears text), `quiz_facts_on_delete` (account deletion voids
the question), `quiz_facts_on_block` (a block voids unrevealed items between the two).

**Drawing.** Personal rounds only, never group sets or Life; at most one per round; the slot is deterministic per
player-week from the private salt (`quiz_bucket < least(share × round_size, 34)`, never position 1); at most one per
athlete per viewer per UTC month; verified athlete with a recorded 13+ age (13–15 with the guardian's approval); the
viewer follows the athlete (Crew) or started from that athlete's Learn card; the `fun_facts` audience allows; no block.
Checked at issue (else an ordinary question) and at the reveal (else the item is voided).

**Intentional behaviour changes.** (1) `quiz_answer`'s option is the shown position for round items; results add the
positions and the client adapter reads them (QUIZ-03 replay answers by option text); (2) approval reorders a choice
question's stored options; (3) paused questions are never drawn and at most two hard questions appear in a round;
(4) bank pages, counts and the 300 cap exclude fun-fact questions; (5) `edit_replace` accepts an approved question that
needs a look; (6) `guardian_decide_approval` (MINOR-01, edited in place, and QUIZ-05's copy) changes the friend setting
only for `friend_requests_everyone` and refuses unknown approval types; MINOR-01 refuses a lone re-run after QUIZ-05
(`minor01_rerun_after_quiz05`; `schema.sql` wraps it with `quiz.full_schema`).

**Security review (RLS_SECURITY, 2026-10-15), applied.** Fun-fact `not_okay` / `private` reports always pause (past the
daily cap; the alert is still recorded). The text filter folds lookalike letters (`quiz_fold_lookalikes`: dotless i,
Cyrillic, Greek), reads a letters-only collapsed copy for profanity ("f u c k", "sh!t", "Phuck"), refuses spelled
contacts ("dot com", "at gmail", "insta" / "snap" + a handle, three spelled digits) and schedules ("Sat mornings",
"seven pm"), and refuses distinctive 4+ letter words of the athlete's school, team, mascot or town (generic words such as
high, school, academy excluded); borderline schedule / place words and hidden weaker words are look reasons. A
timed-out or unanswered fun-fact item is re-checked (`quiz_item_fact_ok`) before anything is filled: on failure the
option reads "Not available" and the result has `item_status` `fact_unavailable`, no positions and no athlete card.
`quiz_admin_question` refuses every action on a fun-fact question (`quiz_fact_admin_path`; use the fact queue or Needs a
look). Import: formula check after NFKC and leading whitespace; `non_latin_text` refusal; `quiz_fresh_norm` folds
lookalikes and keeps other letters. The fun-fact pick keeps the two-hard limit. Only a validated Learn-card athlete
skips the fun-slot rotation. `quiz_admin_retention` purges declined fact text 30 days after the decision
(`clear_cause` `declined_purged`, `purged_declined_facts`). Counts drop viewers blocked either way. A block removes the
athlete card (`fun_fact`) from saved receipts between the pair. Re-review: one scan, `quiz_fact_word_scan`, feeds both the
refusals and the look reasons — profanity refuses only as a whole word (swaps undone) or a run of spaced single letters,
otherwise it is a look ("Crush it", "Scunthorpe" pass); spelled digits refuse only when phone-like (7+, or 4+ with 3 that
are not "oh"); street abbreviations / Street / Highway refuse after a capitalised name or a number, road / drive / court /
lane only after a number (a capitalised name before them is a look); sport names and varsity / boys / girls / team words
are generic for the school and team check.

## SAFETY-01 Coach-level label (`20261017090000_coach_level_label.sql`, written 2026-10-16; applied on development 2026-10-22, staging waits for Beyond)

`reels.safety_label` and `beyond_posts.safety_label`: `none` or `coach_level`, default `none`. `safety_label_events` is append-only (target, old, new, actor, reason, time), RLS on, admin select, restrictive Closed accounts policy, no client writes. `guard_coach_label` refuses a direct update. Uploads may send `coach_level` on insert (column insert grant); `audit_coach_label_on_insert` (after insert) refuses it on anything but Train Like Me and writes the uploader audit row. `set_own_coach_label` lets the uploader mark a new Train Like Me clip (20 minutes) or a workout still in draft or pending. `set_coach_label` is admin-only and requires a reason. `coach_label_desk` returns labelled counts, open "Risky without a coach" suggestions, median review hours for the UTC week (null when there are none) and the latest events. `report_reel` accepts `coach_level` and does not flag or count that reason toward the three-report hide. `reels_feed` and `beyond_post_json` include `safety_label`. Missing SQL reads as unknown on the desk, never as zero unlabelled clips.


## Failed photo-story upload cleanup — app repair (2026-10-20)

Incremental migration: `supabase/migrations/20261020190000_failed_photo_story_cleanup.sql`, copied exactly into canonical schema; written, not applied.

- **`begin_failed_photo_story_cleanup(uuid)`**: authenticated, active canonical uploader only; same reel lock as `set_reel_photos`. Returns `pending` with exact owner/story prefix, `published` without marking/deleting a committed story, or `discarded` for an absent row. Other owners (including an admin acting as nonowner) and videos are denied.
- **`finish_failed_photo_story_cleanup(uuid)`**: same owner/lock, zero-count terminal claim required; refuses while any Storage object under the exact prefix remains. Deletes the hidden reel only once exact-prefix Storage metadata is empty; the client uses the Storage remove API when files are present. Physical bytes/CDN deletion remains unverified. Never deletes `storage.objects` through SQL. Missing rows are idempotent.
- **`guard_failed_photo_story_state()`**, **`can_delete_failed_photo_story_object(text,text)`** and **`guard_photo_story_storage_write()`**: terminal insert/update marker, exact claimed owner-prefix DELETE permission, locked late-content-write guard respectively. All functions pin empty search paths; only the two cleanup RPCs and policy helper are client executable. The existing Closed accounts restriction remains. Timestamp-only `updated_at`/`last_accessed_at` updates remain allowed, while name/bucket/version/metadata/owner changes remain guarded.

The client retires a failed attempt before every retry or athlete/game retarget, then inserts the preserved local draft as a fresh story. Closing persists owner/reel removal intent locally before dismissal; network cleanup retries on the next originating-account Upload open. Failed local persistence keeps the draft visible. A lost publish response recovers actual stored fields/cover, never applies newly edited mentions to that earlier story, and leaves the edited local draft unsubmitted. No bulk cleanup job or live provider operation is introduced. Historical unknown-id rows, termination before received-id persistence, app data loss, never reopening Upload, unexpected historical filenames and closed-account cleanup remain separate gaps. Source review/static checks and client tests do not prove hosted Storage deletion/CDN behavior or real PostgreSQL locking; actual local engine execution was blocked by OS IPC/network permissions.

## NOTIFY-01 — notifications and payment proof preparation (unapplied)

[Notification migration](../../supabase/migrations/20261021140000_notifications.sql) and
[payment-context migration](../../supabase/migrations/20261021150000_notification_payment_context.sql)
are copied exactly into canonical SQL. No local SQL engine cases executed. All notification
production paused, optional email blocked pending unsubscribe/provider support, and payment
notification authority false. [Design](design/EMAIL_NOTIFICATIONS_DESIGN.md) and
[admin evidence](evidence/NOTIFY-01-admin.md) carry behavior and execution limits.

| Table | Source contract |
| --- | --- |
| `notification_config` | Singleton server pauses, allowlisted categories and revision |
| `notification_preferences` | Own revisioned masters/category choices; optional emails off |
| `notification_events` | Stable dedup key and allowlisted source/payload reference |
| `notification_account_activations` | New-account-only eligible activation, no returning-login replay |
| `notification_inbox` | Own read/archive state with current source authorization |
| `notification_inbox_snapshots` | Opaque account-bound cutoff,1h TTL, at most10 active/account |
| `notification_deliveries` | Durable per-recipient intent/lease/status, no blind unknown retries |
| `notification_delivery_attempts` | Durable before-send attempts and acceptance/outcome evidence |
| `notification_admin_audit` | Auth-derived staff actor/fixed audited action reason |
| `notification_payment_contexts` | Server-owned purpose/actor/quote allocation, adapters unwired |
| `notification_payment_observations` | Verified processor-event observations; no canonical credit authority |

| RPC/helper | Scope |
| --- | --- |
| `notification_categories`, `notification_actor`, `notification_source_eligible` | Allowlist/Auth actor/current source rights |
| `get_notification_preferences`, `save_notification_preferences`, `get_notification_availability` | Own preferences; save revision plus expected_actor equal to Auth |
| `get_notification_inbox`, `set_notification_read`, `mark_all_notifications_read`, `set_notification_archived` | Own bounded page, separate state and account-bound cutoff |
| `notification_require_service`, `notification_require_admin` | Role checks for privileged execution |
| `get_admin_notification_config`, `set_admin_notification_config`, `get_admin_notification_jobs`, `retry_notification_job`, `get_admin_notification_health` | Admin-only source/jobs/Health; saves/retries compare captured actor to Auth; known failures below3 attempts only |
| `notification_activate_account`, `emit_notification_event`, `notification_auth_activation`, `notification_profile_activation` | Eligible new confirmed account producer, service-only emit, triggers |
| `claim_notification_jobs`, `authorize_notification_send`, `begin_notification_attempt`, `release_notification_job`, `complete_notification_attempt` | Service-only bounded delivery→attempt locks, fresh eligibility, durable attempt and exact evidence |
| `record_notification_payment_context`, `apply_notification_payment_event` | Service-only context/observation preparation; money authority false |
| `thank_donation` | Existing preset thank-you repaired to reject NULL role before writes |

New definers use empty search paths and schema-qualified relations; direct table grants are
revoked with RLS/RPC boundaries. Old actor-unguarded save/config/retry overloads are dropped.
Written grants/policies are not deployed security evidence. Generated DB catalog remains
unchanged until the SQL engine can regenerate it; the client uses the existing bound RPC SDK.


## MULTISPORT-01 — Local unapplied participation and recorded sport source

Migration: `supabase/migrations/20261021233000_athlete_sports.sql`.

| Source | Contract |
| --- | --- |
| `athlete_sport_entries` | PK(profile_id,sport), school_id nullable directory FK, team_name≤120, position≤80, jersey≤12. No direct anon/authenticated grant; RPC privacy and self-athlete/admin writes. Up to16 unique canonical sports, exactly one primary. |
| `profiles.athlete_sports_revision` | Nonnegative integer, profile-row-locked compare-and-save. Manual primary mirrors athlete_sport/position/jersey, preserves school_id/player/guardian/verification. Unmanaged onboarding remains compatible and advances revision; trusted managed opt-in rejects direct mutation. |
| `athlete_career_stats` | Composite PK(player_id,sport), each sport preserved independently. |
| `athlete_game_logs.sport` | Nullable recorded sport; all untagged old logs stay null until explicit staff classification. Old six-argument writer refuses ambiguous cases, explicit seventh p_sport available. |
| `reels.sport`, `reels_feed.sport` | Optional initial video/photo recorded tag, legacy null never inferred. Preserve tag/avatar/Vault CASE; active-catalog validation and uploader historical-retag denial. |
| `get_athlete_sports(uuid)` | Authorized privacy-filtered snapshot; school/team obey school audience, position stats audience, jersey both. Blocked/private/minor/guardian rules reused. |
| `set_athlete_sports(uuid,text,jsonb,integer)` | Atomic complete list replacement, canonical active/retained sport validation and revision conflict. |
| `admin_list_athlete_sports(text,integer)` | Protected existing Sports desk search, maximum40 rows. |
| `guard_profile_athlete_sports`, `sync_legacy_athlete_sport`, `guard_reel_recorded_sport` | Trigger-only entry points, no public execute grants. |

Removing participation preserves recorded stats/logs/Highlights. Source restoration does not apply SQL;
local replay and hosted/device acceptance are separate in [tracker](../agents/MULTISPORT-01.md).


Admin repair extensions: `admin_get_highlight_sport(uuid)` and `admin_set_highlight_sport(uuid,text,text)`
provide one-row read/old-value compare-and-save in Highlights. `admin_list_unassigned_athlete_logs(uuid,integer)`
returns at most20 original unknown logs; `admin_set_athlete_game_log_sport(uuid,uuid,text,text)` classifies or
corrects the original target-player log without replacing id/date/values. `admin_athlete_sport_usage()` includes
secondary participation in protected catalog usage. `profiles.athlete_sports_managed` is an internal trusted
opt-in marker: legacy onboarding changes advance revision, avoiding a stale first save, while post-opt-in direct
credential mutation remains rejected. No new guardian or verification authority.
