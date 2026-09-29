# Tapua'i database schema

Canonical SQL: [`apps/mobile/src/backend/db/schema.sql`](../apps/mobile/src/backend/db/schema.sql)  
Incremental scripts: [`supabase/`](../supabase/)  
Types: [`apps/mobile/src/frontend/types/database.ts`](../apps/mobile/src/frontend/types/database.ts) · shared contracts [`packages/shared-types`](../packages/shared-types/)  
Client palette: [`apps/mobile/src/frontend/lib/aura.ts`](../apps/mobile/src/frontend/lib/aura.ts)

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
| `current_tier` column | Derived via `get_aura_tier(points)` / `auraTierForPoints()` |
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
| `stripe_connect_id` | text | Stripe Connect Express account id (`acct_…`) from Accounts v2. Today always the signed-in caller's own account (athlete self-onboards) — see [PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md) for the parent-of-record model this is expected to move to (design only, not yet implemented). |
| `stripe_onboarding_complete` | boolean default false | Recipient applied and no user-due requirements after Express return. Incremental: `supabase/stripe_connect.sql`. |
| `payouts_enabled` | boolean default false | Recipient `stripe_transfers` / `payouts` capability is `active`. |
| `legal_terms_accepted_at` | timestamptz | In-app Terms / NIL / minor-safety acknowledgement. Incremental: `supabase/legal_terms_ack.sql`. |
| `legal_terms_version` | text | Matches `LEGAL_TERMS_VERSION` in `data/legal.ts` (`2026-09-27`). |

**Stripe HTTP (JWT):** Mālo PaymentIntent (`POST /api/create-payment-intent` and Edge `create-payment-intent`) and custodial payouts (`POST /api/create-payout`) require a valid Supabase session JWT (`Authorization: Bearer` → `auth.getUser`). Payout destination is the signed-in row's `stripe_connect_id` (service role or user-scoped read); a client `destinationAccountId` is ignored. Transfers require `payouts_enabled`. Missing `STRIPE_SECRET_KEY` queues for admin disbursement — it never transfers to an arbitrary id. Connect Account Links stay on JWT `create-stripe-account`. Server secret is `STRIPE_SECRET_KEY` only (never `EXPO_PUBLIC_STRIPE_SECRET_KEY`). **2026-09 freeze-switch fix:** `create-payment-intent` also accepts an optional `playerId` (`players.id`); when present it calls `malo_target_frozen(playerId)` via `createAuthedDb` and returns `403` **before calling `stripe.paymentIntents.create`** if that athlete is frozen — the only point in the checkout flow that can stop the charge itself, not just a downstream ledger write. `useTipCheckout.ts` passes `player?.id` on every checkout that has a target athlete (tip, vault unlock, exclusive subscribe); Drip merch and booster sponsorships have no athlete target and omit it. A lookup error (not a confirmed `true`) fails open to Stripe, same as a missing/older schema — `add_user_aura` / `increment_backer_count` / `increment_reel_tips` still catch a frozen target after the fact either way.
| `school_id` | uuid FK → `schools_and_teams` ON DELETE SET NULL | Athlete onboarding pick (HS or NCAA). Incremental: `supabase/schools_and_teams.sql`. |
| `athlete_division` | text | Copied from the selected team (`High School` / `NCAA D1`). |
| `athlete_sport` | text | Football / Basketball / Rugby / Volleyball (`ATHLETE_SPORTS`). |
| `athlete_jersey` | text | Roster number. |
| `athlete_position` | text | Position (same field for HS and college). |
| `athlete_class_year` | text | Graduation class (`26` / `27` / `28` → UI `'26`). |
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

**RLS + GRANT (2026-09 parent-payee security fix, closes the self-claim hole below):** the previous "Staff write players" blanket policy let any `parent`-role account UPDATE `guardian_id` on *any* roster row, self-assigning as guardian of an arbitrary athlete with zero verification — flagged in [PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md) §0 as load-bearing the moment guardian identity gates real Connect payout money. Fixed with the most conservative option available (per that doc's own §1, the real linking mechanism — invite code / roster-seed import / scoped self-declare — still needs product/legal sign-off, so this pass does not build that flow): `parent` was dropped from "Staff write players" (now booster/admin/operator only); `guardian_id` can only be set by an admin via `admin_set_player_guardian`; a new narrow "Parents update own linked player" policy lets an already-linked parent (`guardian_id = auth-resolved profiles.id`) keep toggling `parental_consent_approved` for their own athlete, matching the Parent screen's existing revoke/re-approve behavior, but cannot change `guardian_id` at all (not to themselves-on-an-unowned-row, not to anyone else, not to null). **2026-09 self-escalation audit follow-up (this was a real gap, not just a documentation nit):** the "Staff write players" policy's row-level `booster`/`admin`/`operator` check had no column scoping, and the table-level `grant update on players to authenticated` had no column allowlist either — so a `booster`- or `operator`-role account could still directly `UPDATE players SET guardian_id = …` via raw REST, completely bypassing `admin_set_player_guardian`, and the "Parents update own linked player" RLS policy's raw-write path was reachable by any `authenticated` caller at the grant level (Postgres column GRANTs are role-level, not row/policy-level, so they can't distinguish "the one linked parent" from anyone else signed in). Closed by narrowing the table-level grant to `grant update (name, jersey_number, position, height, school_name, backer_count, team, view_count, aura_count, flex_count, seki_count, aura_points, weight, forty_yard, vertical_jump, vault_locked) on public.players to authenticated` — i.e. `guardian_id` / `parental_consent_approved` / `guardian_consent_at` are excluded from every raw client write, full stop. The two remaining legitimate direct-write call sites (Parent screen toggle, admin verification-approve) were moved onto the two new SECURITY DEFINER RPCs above (`parent_set_player_consent`, `admin_approve_player_consent`), which bypass the column grant like `admin_set_player_guardian` already did. Consequence: the Parent screen's *initial* consent-approve tap (which also tried to self-assign `guardian_id`) still gets rejected — same intentional gap as before, unrelated to this pass — until an admin completes the first-time link. **2026-09 follow-up:** that admin-side gap is closed by Expo `/admin/athletes`'s "Link guardian" action (see the `guardian_id` row above) — an admin picks the athlete + parent pair and calls `admin_set_player_guardian`, after which the Parent screen's existing revoke/re-approve toggle works normally for that pair. This is still a manual stopgap, not the real self-service flow.

**Design in progress:** see [PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md) (Phase 1 item 3 — parent-of-record as the Stripe Connect account holder, athlete as beneficiary in metadata only). The §0 self-claim RLS gap that document flagged is now closed as described above, and admins have a working manual linking tool (Expo `/admin/athletes`); the full self-service linking-mechanism decision in §1 remains open.

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
| `is_flagged` | boolean default false | Set by `report_reel`. Review flag, not a global takedown. |
| `reported_by` | uuid[] default `{}` | Fan ids who reported this clip. Feed hides the row for those users. |
| `is_removed` | boolean default false | Admin **Remove Content**. Hidden from Highlights ⚡. Incremental: `supabase/admin_dashboard.sql`. |
| `category` | text default `game_play` | `game_play` \| `train_like_me` \| `serve_like_me`. Upload pills + feed badge. Serve Like Me doubles double-tap Aura (`SERVE_LIKE_ME_AURA_MULTIPLIER`). Incremental: `supabase/reel_category.sql`. |
| `flash_unlock_until` | timestamptz | Vault clip is playable until this instant. Athlete long-press **🔓 Flash Unlock (2 Hours)** calls `set_reel_flash_unlock` (**2026-09:** now checks the caller is the clip's `uploaded_by` or an admin — previously any signed-in user could flash-unlock any Vault clip for free). Incremental: `supabase/crew_and_flash_unlock.sql`. |
| `uploaded_by` | uuid FK → `profiles` ON DELETE SET NULL | Fan who uploaded. Trigger fills from the session profile. Incremental: `supabase/spotlight_auto.sql`. |
| `tag_status` | text default `pending` | `pending` \| `confirmed` \| `rejected`. Existing rows were backfilled `confirmed`. New fan tags stay pending until the tagged athlete, parent, school operator, or admin confirms. Only confirmed Game Play hype elects Spotlight. |
| `tag_confirmed_at` / `tag_confirmed_by` | timestamptz / uuid FK → `profiles` | Who verified the jersey. |
| `created_at` | timestamptz | |

**RLS (2026-09 audit — reels RLS tightening):** base-table SELECT is **not** public (**2026-09 paywall-bypass fix**, see below) — only the uploader's own row, or an admin. INSERT requires `authenticated` and `uploaded_by` to equal the caller's own `profiles.id` (the `reels_apply_tag_defaults` BEFORE INSERT trigger fills `uploaded_by` from the session before this check runs, so a real upload always satisfies it; a client cannot attribute a row to someone else's profile). UPDATE is two policies — the uploader may update their own row, or an admin (`current_user_role() = 'admin'`) may update any row — **and** a column-level `GRANT` on top of that narrows a raw client UPDATE to `title` / `category` / `is_exclusive` / `is_vault_only` / `flash_unlock_until` only. Counters (`seki_count` / `aura_count` / `flex_count` / `total_tips_cents`), `is_flagged` / `is_removed` / `reported_by`, and the tag fields are **not** in that grant — they only move through the SECURITY DEFINER RPCs (`increment_reel_hype`, `increment_reel_tips`, `moderate_flagged_reel`, `confirm_reel_player_tag`, `report_reel`), which bypass the column grant because they run as the function owner. Previously `with check (true)` on both INSERT and UPDATE — any anon/authenticated client could insert a Highlight attributed to any player, or vandalize any reel row (caption, video, hype counts, tip totals, vault flags, moderation flags) via a raw REST call.

**`public.reels_feed` (2026-09 paywall-bypass fix):** the base table's SELECT policy used to be `using (true)` — combined with a public `GRANT`, that meant anyone holding the app's public anon key could read `video_url` for every reel via a raw REST call, including Vault-only / Exclusive / Flash-Unlock clips, with no subscription and no login. The `.eq('is_vault_only', false)` filters scattered through `lib/reels.ts` were only ever a feed convenience, never an access boundary. Fixed by narrowing the base table's own SELECT policy to the uploader's own row or an admin, and adding this view as the one real fan-facing read path: it mirrors every `reels` column, but `video_url` comes back as `''` unless the row is unlocked, Flash-Unlocked right now, or the caller is the uploader / an admin / holds an active `subscriptions` row for the tagged athlete. `lib/reels.ts` and `lib/spotlight.ts` (the only two call sites that ever needed `video_url` for someone else's clip) now read from `reels_feed`; `lib/admin.ts` / `lib/adminCatalog.ts` (metadata-only, no `video_url`) and `services/MediaUploadService.ts` (insert-then-read-own-row) still read the base table directly. The view is not marked `security_invoker`, so it reads the full base table as its owner regardless of the narrower base-table policy — Postgres's normal (pre-15) view behavior, used deliberately here.

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
| `highlight_reel_id` | uuid FK → `reels` | Hottest confirmed Game Play clip for the winner |
| `start_date` / `end_date` | date | Inclusive window. Week is Monday–Sunday UTC; month/year are calendar UTC |
| `source` | text default `auto` | `auto` from hype; `manual` from admin override |
| `locked` | boolean default false | When true, hype will not recrown this window |
| `created_at` | timestamptz | |

**RLS (demo):** public SELECT. Admin INSERT / UPDATE / DELETE via `current_user_role() = 'admin'` (anon allowed in Expo Go). Incremental: `supabase/admin_dashboard.sql`. Client: `/admin/spotlight` + `publish_spotlight_award`.

### `get_active_spotlight_award(viewer_user_id)`

```sql
get_active_spotlight_award(viewer_user_id uuid default null) returns jsonb
```

Highlights launch passes the signed-in `auth.users.id` (guests omit). **Volatile:** refreshes live week/month/year crowns from confirmed Game Play hype (`sync_live_spotlight_awards`) unless the window is `locked`. Returns a **normalized** jsonb (`player_id`, `reel_id`, `period_kind`, `period_start`, `school_name`, `headline`, `title`, `video_url`, `shot_by`, nested `player`) for the award whose `start_date`–`end_date` contains today. Prefers week over month over year. Viewed state is **not** stored in Postgres — `Dismiss (seen)` writes AsyncStorage so the **launch popup** is once per award id. The Spotlight tab still lists the award. Grant: `EXECUTE` to `anon`, `authenticated`. Client: `fetchActiveSpotlightAward` / `fetchSpotlightBoard`.

### `can_confirm_player_tag` / `confirm_reel_player_tag` / `get_pending_player_tags`

A fan tag is a claim, not proof. `reels.tag_status` stays `pending` until the tagged athlete (`profiles.player_id`, name match, or jersey + school), their parent (`players.guardian_id`), a school operator, or admin confirms. `confirm_reel_player_tag(target_reel_id, tag_action)` accepts `confirm` or `reject`. Helper `reels_apply_tag_defaults` trigger auto-confirms only signed-in athlete / parent / operator / admin uploads. Incremental: `supabase/spotlight_auto.sql`. Client: `usePendingPlayerTags` + `TagConfirmList`.

**2026-09 audit follow-up:** `can_confirm_player_tag` used to `return true` unconditionally for any `auth.role() = 'anon'` caller, and `get_pending_player_tags` had a matching `or auth.role() = 'anon'` in its WHERE — since `confirm_reel_player_tag` trusts `can_confirm_player_tag` as its sole gate, this meant anyone holding just the public anon key (no session at all) could confirm or reject the player tag on any Highlight. Both bypasses are dropped; all three functions are now `EXECUTE`-granted to `authenticated` only (previously also `anon`).

### `get_spotlight_standings` / `sync_spotlight_period` / `sync_live_spotlight_awards` / `unlock_spotlight_period` / `spotlight_normalize_kind` / `spotlight_window`

Clip energy = Seki + Aura + Flex on **confirmed**, public, unflagged **Game Play** clips in the UTC week / month / year. Player of the Week/Month/Year is the tagged `players.id` with the most energy **and** a Varsity-verified claimed profile (`athlete_is_varsity_verified`). Unverified athletes keep public Highlights. `highlight_reel_id` is that player's hottest clip (`Clip by` when `uploaded_by` is not the athlete). `increment_reel_hype` and Highlights launch call `sync_live_spotlight_awards`. Admin **Let hype decide** calls `unlock_spotlight_period`. Manual publish sets `source=manual` and `locked=true`.

### `games`

Live scoreboard. Realtime. Operator console writes score / `clock` / `quarter` / `is_clock_running` here. PIN claim writes `claimed_by`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `home_team`, `away_team`, `home_school`, `away_school` | text | |
| `home_score`, `away_score` | integer | Incremented by `update_game_score` |
| `quarter` | text | `Q1`…`Final` |
| `status` | text | Often `live` |
| `venue` | text | |
| `clock` | text default `12:00` | |
| `is_clock_running` | boolean default false | Start / Pause Clock |
| `claimed_by` | uuid FK → `profiles(id)` ON DELETE SET NULL | Set after valid operator PIN |
| `is_active` | boolean | Local discovery |
| `created_at`, `updated_at` | timestamptz | |

**RLS (demo):** public SELECT; UPDATE `anon` or operator/admin; INSERT admin/operator (`Admin insert games`). Client: `/admin/games`.

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
| `source` | text | `malo` \| `tip` \| `booster` \| `vault` \| `merch` |
| `source_id` | text | Unique with `source` (tip / sponsorship / subscription / order id) |
| `label` | text | Human line for the Money desk |
| `payee_kind` | text | `athlete` \| `operator` \| `none` |
| `player_id` | uuid FK → `players` | Tagged athlete when the stream pays them |
| `recipient_id` | uuid | Legacy stub → `profiles` (unused by the Money desk) |
| `gross_cents` / `platform_cents` / `payout_cents` | integer | Stripe-style cents |
| `gross_amount` / `platform_cut_amount` / `payout_amount` | numeric | Dollars (legacy stub; kept in sync) |
| `created_at` | timestamptz | |

**RLS (2026-09 audit):** admin-only SELECT / writes (`anon` bypass dropped — all legitimate writes flow through the SECURITY DEFINER trigger `company_revenue_after_source_insert` / `record_company_revenue`, which is unaffected by table grants). `record_company_revenue` / `sync_company_revenue_logs` EXECUTE also revoked from `anon`/`authenticated` entirely — no client ever called them directly, and `record_company_revenue`'s `on conflict (source, source_id) do update` made it a direct route to overwrite an existing ledger row if it had stayed callable. `gross_cents` / `platform_cents` / `payout_cents` now have `>= 0` CHECK constraints. Incremental: `supabase/company_revenue.sql`. Client: `fetchCompanyRevenueSummary` + `fetchCompanyRevenueLogs` (now require a real authenticated admin session).

### `stripe_webhook_events`

Dedup ledger for `supabase/functions/stripe-webhook`, added in the **2026-09 Round 10 sweep**. Stripe can redeliver the same webhook event (retries, occasionally near-simultaneous duplicates), and the earlier idempotency guard was a `select` against `telemetry_logs` followed later by an `insert` marking it processed — two non-atomic steps, so two concurrent deliveries for the same PaymentIntent could both pass the check before either finished writing, double-crediting Aura / double-inserting a `tips` row (dormant today, since the webhook's rich-metadata credit path isn't reachable yet, but a real bug once it is).

| Column | Type | Notes |
| --- | --- | --- |
| `payment_intent_id` | text PK | Stripe `PaymentIntent.id` |
| `processed_at` | timestamptz | |

**RLS:** no policies at all for `anon`/`authenticated` — service-role only, since only the Edge Function (using the service key, which bypasses RLS) ever touches this table. The webhook now `insert`s here **first**; a `23505` unique-violation on that insert (not a prior `select`) is what means "another delivery already claimed this event" — atomic because Postgres's own primary-key enforcement decides it, not application code racing a check against a write.

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
| `event_type` | text | `video_stall` \| `video_first_frame` \| `socket_reconnect` \| `checkout_latency` \| `tab_dwell` \| `surface_scroll` \| `feature_tap` \| `ui_issue` |
| `video_id` | text | `reels.id` for video events |
| `channel` | text | Realtime channel, or fan surface (`home` / `local` / `spotlight` / `drip` / `profile`) |
| `step` | text | Checkout phase, feature id (`hype.seki`, `malo`, `cheer_poll`), or failed control (`checkout`, `report`) |
| `duration_ms` | integer | Stall / TTFF / tab dwell ms; for `surface_scroll` this is 0–100 depth |
| `attempts` | integer | Consecutive socket errors before a reconnect log |
| `payload` | jsonb | Extra context |
| `created_at` | timestamptz | |

**RLS (demo):** INSERT anyone; SELECT authenticated. Aggregates still reach `/admin/reports` through `get_admin_reports()` (security definer). Incremental: `supabase/telemetry_logs.sql` then `supabase/usage_reports.sql` (adds `duration_ms` / `channel` / `step` on remotes that still store checkout time in `metric_value`). Client: `apps/mobile/src/frontend/services/TelemetryManager.ts` + `useSurfaceUsage` (flush every 10s or queue size 15).

---

### `custodial_accounts` / `athlete_birthdates` / `custodial_withdrawals`

Owner money rules of 2026-09-29 ([PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md) §7). Incremental: `supabase/custodial_money.sql`. **Records only — nothing here moves money;** payouts stay 503 until the Phase 1a ledger ships.

| Table | Key columns | Notes |
| --- | --- | --- |
| `custodial_accounts` | `player_id` PK → `players`, `guardian_id` → `profiles`, `stripe_connect_id` (unique), `payouts_enabled`, `bank_in_athlete_name`, `handover_age` (18–21, default 18) | One account per athlete, so a guardian's account only ever holds that athlete's money. `handover_age` is admin-set per counsel (state majority / UTMA age). |
| `athlete_birthdates` | `player_id` PK, `birth_date`, `entered_by`, `entered_at` | Entered once by the guardian at custodial setup (COPPA: sign-up collects no birth date). Only an admin corrects it. No client ever reads the date directly. |
| `custodial_withdrawals` | `id`, `player_id`, `requested_by`, `requested_role` (`guardian` / `athlete`), `amount_cents` (1–100000), `note` (≤280), `status` (`pending_athlete` / `approved` / `declined` / `cancelled` / `paid`), `decided_by`, `decided_at` | A guardian request before handover waits for the athlete (`pending_athlete`); an athlete request after handover is `approved` at once. One pending request per athlete (partial unique index). |

RLS: SELECT only, when `custodial_role(player_id)` is not null (the verified athlete, their linked guardian, an admin). No client INSERT / UPDATE / DELETE — every write goes through the RPCs below.

### `verification_requests` (ladder columns) / `school_confirmers`

Migration `supabase/migrations/20260929120000_athlete_verification_ladder.sql` ([ATHLETE_VERIFICATION_DESIGN.md](ATHLETE_VERIFICATION_DESIGN.md)). **Not applied yet.**

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
  fan_name text
)
```

Gifts sent **to** an athlete. `tips` SELECT is the fan who paid or an admin, so the athlete cannot read their own incoming rows with a table select. This function returns rows only when the caller is an admin, the profile whose `player_id` matches `target_player_id`, or the linked guardian (`players.guardian_id`). Fan display name only. Incremental: `supabase/malo_ledger.sql` (after `supabase/tip_origin.sql`). Client: `useReceivedMalo` + `Profile/ReceivedMaloPanel` (own profile) and Athlete HQ.

Grant: `EXECUTE` to `authenticated` only.

### `get_admin_malo_breakdown()`

```sql
get_admin_malo_breakdown() returns jsonb
-- { by_origin, by_entry, by_day, recent }
```

Admin-only (`current_user_role() = 'admin'`). `by_origin` and `by_entry` are all-time cents and counts. `by_day` is the last 14 UTC days split by origin. `recent` is the latest 40 gifts with athlete name, fan name, channel, item id, and clip id. Incremental: `supabase/malo_ledger.sql`. Clients: Next Money desk (`fetchPortalMaloBreakdown`) and Expo `/admin/money` (`fetchAdminMaloOriginBars`).

Grant: `EXECUTE` to `authenticated` only.

### `search_local_entities(search_query, entity_kind)`

```sql
search_local_entities(search_query text, entity_kind text default 'all')
  returns table (entity_type text, entity_id text, title text, subtitle text)
```

`entity_kind` is `all` | `athlete` | `school` | `booster`. Needle shorter than 2 characters returns no rows. Athletes come from `players` (name / school / team). Schools are distinct `games` home/away school and team labels (`entity_id` = display title). Boosters come from `sponsorships` (business name / school team). Incremental: `supabase/search_local_entities.sql`. Client: `useLocalSearch` (falls back to table SELECTs if the RPC is missing).

Grant: `EXECUTE` to `anon`, `authenticated`.

### `report_reel(target_reel_id)`

```sql
report_reel(target_reel_id uuid) returns jsonb  -- { id, is_flagged, reported_by }
```

Requires `auth.uid()`. Appends the reporter onto `reels.reported_by` (no duplicates) and sets `is_flagged`. Grant: `EXECUTE` to `authenticated` only. Incremental: `supabase/report_reel.sql`. Client: `reportReelRemote` + `ReportContentModal` (local hide via `tapuai.hiddenReels` even for guests / seeded `hl-*` ids).

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
  -- series { clips, malo, stalls, dwell }
```

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

Matches `AURA_TIERS` in `aura.ts`. The app also computes locally (`auraTierForPoints`) so the card does not wait on the network. Keep SQL and TypeScript in lockstep.

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
| `is_admin_or_db()` | internal | True for an admin, `service_role`, or a direct DB session (`auth.role()` null — SQL Editor). |
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
| `rallies` | RLS SELECT: `live` / `filled` / `closed` for everyone, every row (pending too) for a manager; no client writes | `id`, `player_id`, `created_by`, `title` (3–60), `story` (≤600), `cost_kind` (`season` / `gear` / `travel` / `camps` / `college_prep` / `other`), `target_cents` (500–2,500,000), `raised_cents`, `donation_count`, `ends_on`, `status` (`pending_guardian` / `live` / `filled` / `closed`), `approved_by` / `approved_at`, `filled_at`, `thanks_key`, `thanks_reel_id`, `thanked_at`, timestamps. One open (`pending_guardian` / `live`) Rally per athlete (partial unique index). |
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
| `get_custodial_summary(target_player_id)` | athlete / guardian / admin | jsonb: `viewer_role`, names, `has_account`, `payouts_enabled`, `bank_in_athlete_name`, `handover_age`, `handover_date`, `athlete_controls`, `received_cents` (sum of `tips` for the athlete), last 20 `requests`. Null for anyone else. |

### `record_reel_view(target_reel_id)` / `get_leaderboards(period_kind)`

Incremental: `supabase/leaderboards.sql`. Client: `lib/leaderboards.ts`, `useLeaderboards`, `useReelViewTracker` (each `ReelCard`, 3 s of playback), `Spotlight/LeaderboardsBoard` behind `layouts.leaderboards`.

- `record_reel_view` — `authenticated` only. Counts at most once per viewer per clip per UTC day; skips removed, flagged and Vault-only clips and views by the uploader or the tagged athlete. Returns the new count or null.
- `get_leaderboards(period_kind default 'week')` — `anon` + `authenticated`. Top 10 per board for the Spotlight window: most-hyped players, most-viewed players, most-viewed Highlights, schools (hype + 10 × Highlights + 5 × distinct fans) and fans (10 × confirmed clips + hype given; username or first name only). Only confirmed-tag, public clips count. **No money fields** — STORY.md guardrail: never rank kids by Mālo.

## 7-Tier Aura palette

**Earn rate:** `aura_points += tip_dollars × 10` (`$5` Mālo → `+50`).

Tier = highest band whose minimum the balance meets. Source of truth: `AURA_TIERS` in `apps/mobile/src/frontend/lib/aura.ts` and `get_aura_tier` in SQL.

| Tier | Title | Min pts | Hex | Face | Ink | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Slate Silver** | 0 | `#94A3B8` | `#F1F5F9` | `#334155` | Entry border |
| 2 | **Island Cyan** | 8 | `#00E5FF` | `#CFF7FF` | `#007A8A` | Seki / away |
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
| `telemetry_logs` | Authenticated | INSERT anyone |
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
| `disbursements` | admin/parent only (was public despite being named "Admin read") | admin/parent only (`anon` bypass dropped) |
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

Upload requires a tagged player, a caption, and a video category (Game Play / Train Like Me / Serve Like Me). **Tagging a game is optional** (2026-09 — previously required, now `UploadVideoModal` defaults to "No specific game" and still lets a fan pick one). `MediaUploadService` writes `reels/{user_id}/{timestamp}.mp4` into bucket **`reels`** first, then falls back to `game_highlights` if that bucket is missing.

### Storage — `reels`

Created in `supabase/media_upload.sql`; consolidated into `schema.sql` (2026-09) — see note above. Client: `REELS_BUCKET` in `MediaUploadService.ts`.

| Parameter | Value |
| --- | --- |
| Bucket id / name | `reels` |
| Public | `true` |
| Object path | `reels/{auth.users.id}/{timestamp}.mp4` |
| RLS SELECT | `storage.objects` where `bucket_id = 'reels'` (public read, unchanged) |
| RLS INSERT / UPDATE | same `bucket_id` **and** `auth.role() = 'authenticated'` (2026-09 security pass — was bucket-only/anon-writable; tightened to match `MediaUploadService.uploadHighlight`'s existing signed-in requirement) |
| `allowed_mime_types` | `video/mp4`, `video/quicktime` (2026-09 Round 18 sweep — the client declares `video/mp4`; nothing server-side previously stopped a raw REST call from declaring an arbitrary Content-Type instead) |

### Storage — `reel_vault`

Interim private bucket for **new** Vault / Exclusive uploads (`REEL_VAULT_BUCKET`), until the video host is chosen: **Cloudflare Stream or Mux**, whichever stays cheaper and still plays reliably. This bucket is not the long-term host. `public = false`. `allowed_mime_types`: `video/mp4`, `video/quicktime`. `reels.video_url` stores `reelvault:{auth.users.id}/{timestamp}.mp4`, not an https URL. `reels_feed` still returns that token only when the caller is entitled; `resolvePlaybackUrl` then asks Storage for a one-hour signed URL.

`can_read_reel_vault(object_name)` is `SECURITY DEFINER` and returns true when that reel is no longer `is_vault_only` (so "Move to public feed" can still play a file that already lives in this bucket), or for the uploader, an admin, an active `subscriptions` row on `reels.player_id`, or a live `flash_unlock_until`. Storage SELECT calls it because a direct read of `public.reels` is hidden by RLS from everyone except the uploader and an admin. INSERT is the signed-in user, and only into their own `auth.uid()` folder. Grant: `EXECUTE` to `anon`, `authenticated` (anon only succeeds during Flash Unlock). Public Highlights stay on `reels`. Clips uploaded before this bucket still have public URLs — that leftover is the Round 9 hard blocker until those files move.

### Storage — `avatars`

Created in `supabase/media_upload.sql`; consolidated into `schema.sql` (2026-09) — see note above. Client: `ProfileAvatarPicker` → `uploadAvatar`.

| Parameter | Value |
| --- | --- |
| Bucket id / name | `avatars` |
| Public | `true` |
| Object path | Profile photos `{auth.users.id}/{timestamp}.jpg`; booster logos `sponsors/{timestamp}.{ext}` |
| Writes | `profiles.avatar_url` |
| RLS SELECT | `storage.objects` where `bucket_id = 'avatars'` (public read, unchanged) |
| RLS INSERT / UPDATE | same `bucket_id` **and** `auth.role() = 'authenticated'` (2026-09 security pass — was bucket-only/anon-writable; `uploadAvatar` already hard-requires `supabase.auth.getUser()` to return a user before it uploads, so this matches the client contract) |
| `allowed_mime_types` | `image/jpeg`, `image/png`, `image/webp`. The client sends an `ArrayBuffer` plus this type (`imageContentType` in `MediaUploadService.ts`). A React Native `Blob` is not used — `fetch().blob()` labels local photos `text/plain`, which this allow-list rejects. |

---

## Realtime

Published: `games`, `game_events`, `cheer_polls`, `app_runtime_config`. Fan hook `useLiveGame` filters `games` `id=eq.{gameId}` and `game_events` INSERT `game_id=eq.{gameId}` (featured live match when `gameId` is omitted). Operator callouts also Broadcast on public channel `game_events_${gameId}` with event `play` and payload `{ type, timestamp, team }`; focused `ReelCard` joins via `useGameEventBroadcast`. Aura / `profiles` are fetch + in-app event bus. Fan chrome (`AppRuntimeContext`) listens to `app_runtime_config` UPDATE.

---

## Incremental SQL order

Prefer full `schema.sql` on a blank project (includes `profiles` / `tips` / operator tables).

1. `players.sql` → `game_events.sql` → `games.sql` (+ `games_clock.sql` + `games_operator.sql`)
2. `increment_backer.sql` → `increment_hype.sql` (`increment_player_hype`)
3. `reels.sql` → `cheer_polls.sql` → `add_user_aura.sql` → `subscriptions.sql` → `subscriber_requests.sql` → `profile_roles.sql` → `add_user_role.sql` → `auth_fan_profile.sql` → `stripe_connect.sql` → `get_fan_tip_history.sql` → `sponsorships.sql` → `telemetry_logs.sql` → `saved_reels.sql` → `search_local_entities.sql` → `report_reel.sql` → `toggle_reel_vault_status.sql` → `schools_and_teams.sql` → `legal_terms_ack.sql` → `athlete_verification.sql` → `athlete_stats.sql` → `player_vault_lock.sql` → `spotlight_awards.sql` → `reel_category.sql` → `crew_and_flash_unlock.sql` → `reel_hype_votes.sql` → `admin_dashboard.sql` → `admin_portal.sql` → `app_runtime.sql` → `admin_reports.sql` → `spotlight_auto.sql` → `company_revenue.sql` → `app_feedback.sql` → `usage_reports.sql` → `media_upload.sql` → `tip_origin.sql` → `malo_ledger.sql` → `custodial_money.sql` → `leaderboards.sql`
