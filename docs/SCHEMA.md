# Tapua'i database schema

Canonical SQL: [`src/backend/db/schema.sql`](../src/backend/db/schema.sql)  
Incremental scripts: [`supabase/`](../supabase/)  
Types: [`src/frontend/types/database.ts`](../src/frontend/types/database.ts)  
Client palette: [`src/frontend/lib/aura.ts`](../src/frontend/lib/aura.ts)

Auth (`auth.users`) must exist before `profiles.user_id` can reference it.

---

## Product names vs Postgres

| Product / design doc | Actual relation or args |
| --- | --- |
| `video_tips` | `public.tips` (Mālo ledger) + `reels.total_tips_cents` |
| `add_user_aura(target_user_id, points_to_add)` | Postgres `add_user_aura(uuid, integer)` |
| `add_user_role(new_role)` | Postgres `add_user_role(text)` → `profiles.roles` |
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
| `is_verified` | boolean | |
| `spirit_points` | integer | |
| `aura_points` | integer default 0 | Ranking currency |
| `stripe_connect_id` | text | Stripe Connect Express account id (`acct_…`) from Accounts v2 |
| `stripe_onboarding_complete` | boolean default false | Recipient applied and no user-due requirements after Express return. Incremental: `supabase/stripe_connect.sql`. |
| `payouts_enabled` | boolean default false | Recipient `stripe_transfers` / `payouts` capability is `active`. |
| `school_id` | uuid FK → `schools_and_teams` ON DELETE SET NULL | Athlete onboarding pick (HS or NCAA). Incremental: `supabase/schools_and_teams.sql`. |
| `athlete_division` | text | Copied from the selected team (`High School` / `NCAA D1`). |
| `athlete_sport` | text | Football / Basketball / Rugby / Volleyball (`ATHLETE_SPORTS`). |
| `athlete_jersey` | text | Roster number. |
| `athlete_position` | text | Position (same field for HS and college). |
| `athlete_class_year` | text | Graduation class (`26` / `27` / `28` → UI `'26`). |
| `is_admin` | boolean default false | Web Admin Dashboard. Set by `add_user_role('admin')`. Also treated as true when `role` / `roles` include `admin`. Incremental: `supabase/admin_dashboard.sql`. |
| `player_id` | uuid FK → `players` ON DELETE SET NULL | Claimed roster row so That's me can auto-confirm. Incremental: `supabase/spotlight_auto.sql`. |
| `created_at` | timestamptz | |

**RLS:** public SELECT; UPDATE own row or `admin`. **No INSERT policy** (Auth bootstrap only SELECTs).

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
| `created_at` | timestamptz | |

Badge copy: `[ High School • UT ]` vs `[ NCAA D1 • Big 12 ]` (`formatTeamBadge`). Client: `useTeamSearch` / `TeamSearchField`. Trading card shows name, mascot, and badge on both faces.

**RLS (demo):** public SELECT. Admin INSERT / UPDATE / DELETE via `current_user_role() = 'admin'` (anon allowed in Expo Go). Incremental: `supabase/admin_portal.sql`. Client: `/admin/schools`.

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

**RLS (demo):** public SELECT on both stats tables. Writes are seed-only.

### `search_schools_and_teams(search_query)`

```sql
search_schools_and_teams(search_query text) returns setof public.schools_and_teams
```

Strips `%` / `_`, then `ILIKE '%' || needle || '%'`. Grant: `EXECUTE` to `anon`, `authenticated`. Incremental: `supabase/schools_and_teams.sql`.

### `reels`

Highlight / Seki clips. Files in Storage **`game_highlights`**.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `video_url` | text | Public URL |
| `title` | text | Caption |
| `player_id` | uuid FK → `players` ON DELETE SET NULL | Tagged athlete |
| `game_id` | uuid FK → `games` ON DELETE SET NULL | |
| `seki_count`, `aura_count`, `flex_count` | integer | Clip hype |
| `total_tips_cents` | integer | Mālo on this clip |
| `is_exclusive` | boolean default false | Legacy subscriber-only flag. Kept in lockstep with `is_vault_only`. |
| `is_vault_only` | boolean default **false** | Clip lives in the Vault collection (not the free Highlights ⚡ tab). Fans only need a subscription when `players.vault_locked` is true. Athlete long-press calls `toggle_reel_vault_status`. |
| `is_flagged` | boolean default false | Set by `report_reel`. Review flag, not a global takedown. |
| `reported_by` | uuid[] default `{}` | Fan ids who reported this clip. Feed hides the row for those users. |
| `is_removed` | boolean default false | Admin **Remove Content**. Hidden from Highlights ⚡. Incremental: `supabase/admin_dashboard.sql`. |
| `category` | text default `game_play` | `game_play` \| `train_like_me` \| `serve_like_me`. Upload pills + feed badge. Serve Like Me doubles double-tap Aura (`SERVE_LIKE_ME_AURA_MULTIPLIER`). Incremental: `supabase/reel_category.sql`. |
| `flash_unlock_until` | timestamptz | Vault clip is playable until this instant. Athlete long-press **🔓 Flash Unlock (2 Hours)** calls `set_reel_flash_unlock`. Incremental: `supabase/crew_and_flash_unlock.sql`. |
| `uploaded_by` | uuid FK → `profiles` ON DELETE SET NULL | Fan who uploaded. Trigger fills from the session profile. Incremental: `supabase/spotlight_auto.sql`. |
| `tag_status` | text default `pending` | `pending` \| `confirmed` \| `rejected`. Existing rows were backfilled `confirmed`. New fan tags stay pending until the tagged athlete, parent, school operator, or admin confirms. Only confirmed Game Play hype elects Spotlight. |
| `tag_confirmed_at` / `tag_confirmed_by` | timestamptz / uuid FK → `profiles` | Who verified the jersey. |
| `created_at` | timestamptz | |

**RLS (demo):** public SELECT / INSERT / UPDATE.

### `saved_reels`

Fan bookmarks from the Reel right rail. Incremental: `supabase/saved_reels.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid | Signed-in fan (`auth.uid()`). PK with `reel_id`. |
| `reel_id` | uuid FK → `reels` ON DELETE CASCADE | Uploaded clip only (seeded `hl-*` ids stay in AsyncStorage). |
| `created_at` | timestamptz | |

**RLS:** SELECT / INSERT / DELETE own rows (`auth.uid() = user_id`). Guests persist `tapuai.savedReel.guest.{reelId}` locally via `useSavedReel`.

### `reel_hype_votes`

One Seki / Aura / Flex per signed-in fan per Highlight. Incremental: `supabase/reel_hype_votes.sql`. Client: `loadReelVotes` / `markReelVote` (`tapuai.reelVotes.*`) plus `increment_reel_hype` which returns `applied: false` on a duplicate.

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

**RLS (demo):** public SELECT; INSERT/DELETE own `follower_id` (anon allowed for Expo Go).

### `crew_push_queue`

Push payloads queued when an athlete Flash Unlocks a Vault clip. `set_reel_flash_unlock` inserts one row per Crew member (`kind = flash_unlock`). Prototype queue — no Expo push token wiring yet.

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

**RLS (demo):** public SELECT / INSERT / UPDATE.

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

**RLS (demo):** public SELECT / INSERT.

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

### `get_spotlight_standings` / `sync_spotlight_period` / `sync_live_spotlight_awards` / `unlock_spotlight_period` / `spotlight_normalize_kind` / `spotlight_window`

Clip energy = Seki + Aura + Flex on **confirmed**, public, unflagged **Game Play** clips in the UTC week / month / year. Player of the Week/Month/Year is the tagged `players.id` with the most energy; `highlight_reel_id` is that player's hottest clip (`Clip by` when `uploaded_by` is not the athlete). `increment_reel_hype` and Highlights launch call `sync_live_spotlight_awards`. Admin **Let hype decide** calls `unlock_spotlight_period`. Manual publish sets `source=manual` and `locked=true`.

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

Atomic increment of scores plus optional clock fields. Re-run `supabase/games_operator.sql`. Client: `updateGameScore` in `src/frontend/lib/operator.ts` (falls back to a direct `games` UPDATE if the RPC is missing).

### `video_tips` → `public.tips`

Mālo ledger (no separate `video_tips` table).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `player_id` | uuid FK → `players` ON DELETE CASCADE | Recipient |
| `fan_id` | uuid | Tipper (`auth.users.id` / `auth.uid()`) |
| `reel_id` | uuid FK → `reels` ON DELETE SET NULL | Clip the Mālo was dropped on |
| `amount_cents` | integer | Mālo dollars × 100 (processing fee is not stored) |
| `aura_points` | integer | Fan Aura granted for this tip (`tipAmount * 10`) |
| `created_at` | timestamptz | |

Clip totals still use `increment_reel_tips`, not a rollup column on `tips`.

Successful Mālo (`useTipCheckout`, `!skipBacker`) **inserts** a `tips` row. Profile **Tip History & Receipts** (`/receipts`) reads via `get_fan_tip_history`. Profile **Total Tips Dropped** on the trading card is still device-local (`tapuai.maloDroppedCount`). Incremental `supabase/get_fan_tip_history.sql` **creates** `public.tips` when it is missing (this table lived only in full `schema.sql`).

**RLS (demo):** public SELECT; INSERT anyone.

### Related

`players` (roster + hype + `aura_points` + combine measurables), `athlete_career_stats`, `athlete_game_logs`, `subscriptions`, `subscriber_requests`, `game_events`, `cheer_polls`, `operator_gigs`, `operator_checkins`, `sponsor_ads`, `sponsorships`, `shop_products`, `shop_orders`, `wishlist_items`, `company_revenue_logs`, `telemetry_logs`, `verification_requests`, `disbursements`, `schools_and_teams`, `crew_follows`, `crew_push_queue`, `app_runtime_config`, `app_feedback`. See canonical `schema.sql`.

### `sponsorships`

Local business booster ledger (Silver / Gold / Platinum). Distinct from `sponsor_ads` (sideline creatives) and `subscriptions` (athlete exclusive pass).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `sponsor_user_id` | uuid | Payer (`auth.users.id`) |
| `business_name` | text | |
| `logo_url` | text | HTTPS or Storage public URL (`game_highlights/sponsors/`) |
| `school_team` | text | Targeted high school |
| `tier` | text | `silver` \| `gold` \| `platinum` |
| `amount_cents` | integer | Monthly dollars × 100 ($50 / $150 / $500) |
| `aura_points` | integer | 500 / 2,000 / 10,000 |
| `billing_interval` | text default `month` | Product copy; first month is PaymentSheet (not Stripe Billing) |
| `status` | text default `active` | |
| `created_at` | timestamptz | |

**RLS (demo):** public SELECT; INSERT anyone; admin UPDATE / DELETE. Incremental: `supabase/sponsorships.sql` + `admin_portal.sql`. Client: `useSponsorships` + `/admin/boosters`.

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

`games.sport` (text, default `Football`) selects the playbook for a match. **RLS (demo):** public SELECT; admin INSERT / UPDATE / DELETE (`anon` allowed in Expo Go). Client: `src/frontend/lib/sports.ts` + `useSportConfigs` + `/admin/sports`. Fallback: `SPORT_CONFIG_SEEDS` (Football, Basketball, Rugby, Volleyball, Soccer, Baseball, Softball, Wrestling, Track & Field, Lacrosse, Ice Hockey, Tennis).

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

**RLS (demo):** public SELECT; admin INSERT / UPDATE / DELETE (`anon` allowed in Expo Go). Client: `src/frontend/lib/wishlist.ts` + `components/Profile/LockerRoomWishlist.tsx` + `/admin/drip`. Fallback: `WISHLIST_DEMO_ITEMS` when the table is missing.

### `get_wishlist_items(target_player_id)`

```
get_wishlist_items(target_player_id uuid) returns setof wishlist_items
```

Active items for one athlete, unfunded first (`order by is_equipped, sort_order, created_at`, limit 20).

### `chip_in_wishlist_item(item_id, amount_cents)`

```
chip_in_wishlist_item(item_id uuid, amount_cents integer) returns jsonb
```

Adds a Mālo contribution to `current_amount_cents`. When the row crosses `target_amount_cents` for the first time it sets `is_equipped` / `equipped_at` / `aura_awarded` and calls `add_user_aura(player_id, 500)`. Returns `{ item, newly_equipped, aura_points, athlete_aura_points }` — the client uses `newly_equipped` for confetti and `athlete_aura_points` to restyle the Aura card. **v2:** like `add_user_aura` / `increment_backer_count`, this RPC trusts the client-supplied amount under demo RLS. Move the credit behind the Stripe webhook before real money.

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

**RLS (demo):** public SELECT; INSERT anyone; admin UPDATE / DELETE.

### `company_revenue_logs`

Admin finance ledger for `/admin/money`. One row per paid Mālo (`tips`), booster (`sponsorships`), Vault pass (`subscriptions` at $4.99), or Drip order (`shop_orders`). Splits (keep in lockstep with `src/frontend/data/finance.ts` + `company_revenue_bps`):

| Source | Platform | Payout |
| --- | --- | --- |
| Mālo Micro-Tips | 10% | 90% athlete |
| Local District Boosters | 15% | 85% operator |
| Vault subscribe | 20% | 80% athlete |
| Drip merch | 100% | — |

Fan `MALO_DISCLAIMER` still says 100% to custodial until counsel updates it. This table is the **admin model**, not fan copy.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `transaction_type` | text | Same as `source` (legacy stub column) |
| `source` | text | `malo` \| `booster` \| `vault` \| `merch` |
| `source_id` | text | Unique with `source` (tip / sponsorship / subscription / order id) |
| `label` | text | Human line for the Money desk |
| `payee_kind` | text | `athlete` \| `operator` \| `none` |
| `player_id` | uuid FK → `players` | Tagged athlete when the stream pays them |
| `recipient_id` | uuid | Legacy stub → `profiles` (unused by the Money desk) |
| `gross_cents` / `platform_cents` / `payout_cents` | integer | Stripe-style cents |
| `gross_amount` / `platform_cut_amount` / `payout_amount` | numeric | Dollars (legacy stub; kept in sync) |
| `created_at` | timestamptz | |

**RLS (demo):** admin or `anon` SELECT / writes (Expo Go Studio). Incremental: `supabase/company_revenue.sql`. Client: `fetchCompanyRevenueSummary` + `fetchCompanyRevenueLogs`.

### `app_runtime_config`

Single-row fan chrome map (`id = 'default'`). Admin **Features** writes `draft`. **Publish to app** copies `draft` onto `published`. The fan app reads `published` (`AppRuntimeContext.live`). Missing keys stay **on**.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text PK | Always `default` |
| `draft` | jsonb | Unpublished tabs / buttons / layouts |
| `published` | jsonb | What fans see |
| `published_at` | timestamptz | Last Publish to app |
| `updated_at` | timestamptz | Last draft write |

JSON groups: `tabs` (home / local / spotlight / drip / profile / upload), `buttons` (seki / aura / flex / malo / more / subscribe / crew / vault / flashUnlock / **suggest**), `layouts` (liveMatches / cheerPolls / topBoosters / sponsorshipModal / spotlightModal / homeSearch / localSearch / operatorConsole / parentHq / boosterHq / sponsorHq / **slangGuide** / **receipts** / **wishlist**), `theme` (background / surface / jade / gold / text; default **Daylight** `#F4F7F5` / `#00733C`), `profile` (showCard / showCrew / showStats / showVault / actionsOnTop / statsFirst), `highlights` (railSide / namePlacement / showSchool / showCaption / railOrder), `copy` (Home / Local / Spotlight / Drip kickers and ledes, `slangLine`, Profile / Receipts kickers and ledes, Operator / Parent / Booster / Sponsor ledes, optional `homeBannerTitle` / `homeBannerBody`), **`catalog`** (`maloAmounts`, `maloFeeDollars`, `exclusiveDollars`, `exclusiveAura`, `classYears`, `localFilters`, `sponsorTiers`, `reelCategories`). Client desks: `/admin/features` (flags), `/admin/look` (colors, copy, Profile chrome, Highlights ⚡ rail), `/admin/catalog` (prices and chips), `/admin/lab` (JSON draft, hidden from the sidebar), `/admin/coverage` (client map of every fan control → desk / flag / telemetry; no extra table).

**RLS (demo):** public SELECT; admin INSERT / UPDATE (`anon` in Expo Go). Incremental: `supabase/app_runtime.sql`. Client: `src/frontend/lib/runtime.ts` + `/admin/features`.

### `app_feedback`

Fan suggestions for the admin improvement queue. Distinct from `report_reel` (clip Report / Hide). Incremental: `supabase/app_feedback.sql`. Client: `src/frontend/lib/feedback.ts` + `/admin/feedback` + `/admin/lab`.

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

**RLS (demo):** public SELECT; admin writes (`anon` in Expo Go). Votes stay on `cast_cheer_vote`. Incremental: `supabase/cheer_polls.sql` + `admin_portal.sql`.

### `upsert_cheer_poll`

```sql
upsert_cheer_poll(poll_slug text, home_name text, away_name text, make_active boolean default true) returns jsonb
```

Admin publisher for School Polls. Grant: `EXECUTE` to `anon`, `authenticated`. Client: `/admin/polls`.

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

**RLS (demo):** INSERT anyone; SELECT authenticated. Aggregates still reach `/admin/reports` through `get_admin_reports()` (security definer). Incremental: `supabase/telemetry_logs.sql` then `supabase/usage_reports.sql` (adds `duration_ms` / `channel` / `step` on remotes that still store checkout time in `metric_value`). Client: `src/frontend/services/TelemetryManager.ts` + `useSurfaceUsage` (flush every 10s or queue size 15).

---

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

Grant: `EXECUTE` to `anon`, `authenticated`. Client: `src/frontend/hooks/useTipCheckout.ts` via `addUserAura`.

### `add_user_role(new_role)`

```sql
add_user_role(new_role text) returns text[]
```

Unions `new_role` onto the signed-in `profiles.roles` (`auth.uid()`). Adding `athlete` also keeps `fan`, sets `role` + `active_role` to `athlete`, and sets `is_verified`. Incremental: `supabase/add_user_role.sql`. Client: `addUserRoleRemote` / `AuthContext.addUserRole`.

Grant: `EXECUTE` to `anon`, `authenticated`.

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
  school_name text
)
```

Filters `tips.fan_id` to `coalesce(auth.uid(), fan_user_id)` and left-joins `players` for name + `school_name`. Incremental: `supabase/get_fan_tip_history.sql`. Client: `useFanTipHistory`.

Grant: `EXECUTE` to `anon`, `authenticated`.

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

Admin-only (prototype also allows `anon`). Upserts `spotlight_awards` for Player of the Week / Month / Year and **locks** the window so hype will not overwrite it. Links `player_id` plus a matching `profiles` row when possible. Featured tape is the athlete's hottest confirmed public clip. Incremental: `supabase/admin_dashboard.sql` + `supabase/spotlight_auto.sql`. Client: `useAdminDashboard`.

### `moderate_flagged_reel`

```sql
moderate_flagged_reel(target_reel_id uuid, moderation_action text) returns jsonb  -- { id, is_flagged, is_removed }
```

Admin-only. `dismiss` clears `is_flagged`. `remove` sets `is_removed` so Highlights ⚡ hides the clip. Incremental: `supabase/admin_dashboard.sql`.

### `get_admin_platform_metrics`

```sql
get_admin_platform_metrics() returns jsonb  -- highlight_count, engagement_count, malo_cents, open_flags, telemetry_events_24h
```

Admin dashboard Telemetry cards. Engagement is Seki + Aura + Flex on live clips. Mālo is `sum(tips.amount_cents)`. Incremental: `supabase/admin_dashboard.sql`.

### `patch_app_runtime_draft(next_draft)`

```sql
patch_app_runtime_draft(next_draft jsonb) returns jsonb  -- { draft, published, published_at, updated_at }
```

Writes Features draft. Fans still see `published` until `publish_app_runtime`. Incremental: `supabase/app_runtime.sql`. Client: `saveAppRuntimeDraft`.

### `publish_app_runtime()`

```sql
publish_app_runtime() returns jsonb  -- copies draft onto published, sets published_at
```

Gold **Publish to app** in the admin sidebar. Incremental: `supabase/app_runtime.sql`. Client: `publishAppRuntime`.

### `get_admin_reports()`

```sql
get_admin_reports() returns jsonb
  -- generated_at, engagement, money, content, audience, live, reliability,
  -- usage, tabs, features, issues, scroll, leaders,
  -- series { clips, malo, stalls, dwell }
```

Usage windows (24h / 7d / previous 7d), Mālo, Vault / Flash Unlock / Spotlight mix, Crew follows, telemetry stalls, **tab dwell / scroll / feature taps / control issues**, top Mālo / hottest clips / athletes-by-school, and `series` (7-day clips / Mālo / stalls / dwell). Incremental: `supabase/app_runtime.sql` + `supabase/admin_reports.sql` + `supabase/usage_reports.sql`. Client: `/admin/reports` (Health + **Usage** desk, graphs).

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

BPS stay in lockstep with `src/frontend/data/finance.ts`. Triggers on `tips`, `sponsorships`, `subscriptions`, `shop_orders` call `record_company_revenue`. `sync_company_revenue_logs` backfills unique `(source, source_id)` rows. Booster gross reads `amount_cents` or, on older remotes, `monthly_amount`. Incremental: `supabase/company_revenue.sql`.

### `get_company_revenue_summary()`

```sql
get_company_revenue_summary() returns jsonb
  -- total_gross, total_platform_revenue, total_payouts (dollars)
  -- gross_volume_cents, company_net_cents, payouts_cents, stripe_paid_cents
  -- streams[] (Mālo / boosters / merch+vault), recent[]
```

`VOLATILE` — runs `sync_company_revenue_logs` then aggregates. Client: `/admin/money`. Grant: `EXECUTE` to `anon`, `authenticated`. Changing the old `TABLE(total_gross, …)` return type required `DROP FUNCTION` first.

### `toggle_reel_vault_status(target_reel_id)`

```sql
toggle_reel_vault_status(target_reel_id uuid) returns boolean  -- next is_vault_only
```

Requires `auth.uid()`. Flips `reels.is_vault_only` and writes the same value to `is_exclusive`. Default is **false** (free public feed). Grant: `EXECUTE` to `anon`, `authenticated`. Incremental: `supabase/toggle_reel_vault_status.sql`. Client: `toggleReelVaultStatus` + `AthleteReelManager` (optimistic local write; table UPDATE fallback if the RPC is missing).

### `set_player_vault_locked(target_player_id, is_locked)`

```sql
set_player_vault_locked(target_player_id uuid, is_locked boolean) returns boolean
```

Requires `auth.uid()`. Writes `players.vault_locked`. Default **true**: Vault clips stay behind Subscribe ($4.99/mo) until the athlete taps Open Vault 🌐. Incremental: `supabase/player_vault_lock.sql`. Client: `setPlayerVaultLocked` + `VaultLockCard`.

### `get_aura_tier(points)`

```sql
get_aura_tier(points integer) returns jsonb  -- { tier, title, min_points, color }
```

Matches `AURA_TIERS` in `aura.ts`. The app also computes locally (`auraTierForPoints`) so the card does not wait on the network. Keep SQL and TypeScript in lockstep.

Other RPCs: `increment_backer_count`, `increment_player_hype`, `increment_reel_hype` (returns `applied`; no-ops a second Seki / Aura / Flex from the same `auth.uid()`; then `sync_live_spotlight_awards`), `increment_reel_tips`, `cast_cheer_vote`, `upsert_cheer_poll`, `update_game_score`, `current_user_role` (returns `admin` when `is_admin` or `roles` includes admin), `get_fan_tip_history`, `search_local_entities`, `search_schools_and_teams`, `report_reel`, `publish_spotlight_award`, `moderate_flagged_reel`, `get_admin_platform_metrics`, `patch_app_runtime_draft`, `publish_app_runtime`, `get_admin_reports`, `company_revenue_bps`, `record_company_revenue`, `sync_company_revenue_logs`, `company_revenue_after_source_insert`, `get_company_revenue_summary`, `submit_app_feedback`, `get_app_feedback`, `triage_app_feedback`, `toggle_reel_vault_status`, `set_player_vault_locked`, `get_active_spotlight_award`, `get_crew_graph`, `toggle_crew_follow`, `set_reel_flash_unlock`, `spotlight_normalize_kind`, `spotlight_window`, `can_confirm_player_tag`, `reels_apply_tag_defaults`, `confirm_reel_player_tag`, `get_pending_player_tags`, `get_spotlight_standings`, `sync_spotlight_period`, `sync_live_spotlight_awards`, `unlock_spotlight_period`. Cheer votes go through `cast_cheer_vote`; admin label edits go through `upsert_cheer_poll`. Re-run `supabase/cheer_polls.sql` after this signature change (`DROP FUNCTION` first):

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

## 7-Tier Aura palette

**Earn rate:** `aura_points += tip_dollars × 10` (`$5` Mālo → `+50`).

Tier = highest band whose minimum the balance meets. Source of truth: `AURA_TIERS` in `src/frontend/lib/aura.ts` and `get_aura_tier` in SQL.

| Tier | Title | Min pts | Hex | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Slate Silver** | 0 | `#94A3B8` | Entry border |
| 2 | **Island Cyan** | 8 | `#00E5FF` | |
| 3 | **Neon Jade** | 20 | `#00E676` | Brand jade |
| 4 | **Electric Violet** | 40 | `#B388FF` | |
| 5 | **Crimson Ember** | 70 | `#FF1744` | |
| 6 | **Polished Gold** | 110 | `#FFD700` | |
| 7 | **Celestial Prism** | 170 | `#00E676` / `#00E5FF` | Jade border, cyan glow |

Badge: `Tier {n} • {title}`. Card face `#161D20`. `AuraCard` (public athlete) / `AuraTradingCard` (Profile hub, both faces) / `TopAuraBoosters`. Progress fill uses `auraProgressTowardNext` (band min → next min; Celestial Prism is full). Focal motion tokens: Neon Jade `#00E676` (tips / Aura / active roles), Electric Gold `#FFD700` (Gold / Platinum boosters and `#1` rank). Source: `src/frontend/theme/motion.ts`.

If `aura_points` is unset on a player, the client falls back to `aura_count + seki_count + flex_count`.

---

## RLS (demo-open)

Policies in `schema.sql` allow Expo Go without login. **Tighten before production.**

| Table | SELECT | Writes |
| --- | --- | --- |
| `profiles` | Public | UPDATE own / admin — no INSERT |
| `players` | Public | anon or booster/admin/operator/parent |
| `games` | Public | UPDATE anon or operator/admin; INSERT admin/operator |
| `reels` | Public | INSERT + UPDATE anyone |
| `subscriptions` | Public | INSERT + UPDATE anyone |
| `subscriber_requests` | Public | INSERT anyone |
| `tips` | Public | INSERT anyone |
| `sponsorships` | Public | INSERT anyone; admin UPDATE / DELETE |
| `shop_products` | Public | Admin INSERT / UPDATE / DELETE |
| `shop_orders` | Public | INSERT anyone; admin UPDATE / DELETE |
| `company_revenue_logs` | Admin or `anon` | Admin or `anon` writes (Expo Go) |
| `app_runtime_config` | Public | Admin INSERT / UPDATE |
| `app_feedback` | Admin or `anon` | INSERT anyone; admin or `anon` UPDATE |
| `telemetry_logs` | Authenticated | INSERT anyone |
| `saved_reels` | Own rows | INSERT / DELETE own rows |
| `reel_hype_votes` | Own rows | INSERT own rows |
| `schools_and_teams` | Public | Admin INSERT / UPDATE / DELETE |
| `athlete_career_stats` | Public | Seed-only |
| `athlete_game_logs` | Public | Seed-only |
| `spotlight_awards` | Public | Admin INSERT / UPDATE / DELETE |
| `crew_follows` | Public | INSERT / DELETE own `follower_id` |
| `crew_push_queue` | Own `recipient_id` | INSERT anyone (RPC writes) |
| `cheer_polls` | Public | Admin writes; votes via `cast_cheer_vote` |
| `game_events` | Public | INSERT anon or operator/admin. `player_id` nullable for sideline callouts |

```sql
current_user_role()  -- profiles.role for auth.uid(), else 'guest'
```

---

## Storage — `game_highlights`

Created in `supabase/reels.sql`:

| Parameter | Value |
| --- | --- |
| Bucket id / name | `game_highlights` |
| Public | `true` |
| Client constant | `HIGHLIGHTS_BUCKET` in `src/frontend/lib/reels.ts` |
| Object path | `reels/{timestamp}.{ext}`; booster logos at `sponsors/{timestamp}.{ext}` |
| RLS SELECT | `storage.objects` where `bucket_id = 'game_highlights'` |
| RLS INSERT | same `bucket_id` |

Upload requires a tagged player, an active game, a caption, and a video category (Game Play / Train Like Me / Serve Like Me).

---

## Realtime

Published: `games`, `game_events`, `cheer_polls`, `app_runtime_config`. Fan hook `useLiveGame` filters `games` `id=eq.{gameId}` and `game_events` INSERT `game_id=eq.{gameId}` (featured live match when `gameId` is omitted). Operator callouts also Broadcast on public channel `game_events_${gameId}` with event `play` and payload `{ type, timestamp, team }`; focused `ReelCard` joins via `useGameEventBroadcast`. Aura / `profiles` are fetch + in-app event bus. Fan chrome (`AppRuntimeContext`) listens to `app_runtime_config` UPDATE.

---

## Incremental SQL order

Prefer full `schema.sql` on a blank project (includes `profiles` / `tips` / operator tables).

1. `players.sql` → `game_events.sql` → `games.sql` (+ `games_clock.sql` + `games_operator.sql`)
2. `increment_backer.sql` → `increment_hype.sql` (`increment_player_hype`)
3. `reels.sql` → `cheer_polls.sql` → `add_user_aura.sql` → `subscriptions.sql` → `subscriber_requests.sql` → `profile_roles.sql` → `add_user_role.sql` → `stripe_connect.sql` → `get_fan_tip_history.sql` → `sponsorships.sql` → `telemetry_logs.sql` → `saved_reels.sql` → `search_local_entities.sql` → `report_reel.sql` → `toggle_reel_vault_status.sql` → `schools_and_teams.sql` → `athlete_stats.sql` → `player_vault_lock.sql` → `spotlight_awards.sql` → `reel_category.sql` → `crew_and_flash_unlock.sql` → `reel_hype_votes.sql` → `admin_dashboard.sql` → `admin_portal.sql` → `app_runtime.sql` → `admin_reports.sql` → `spotlight_auto.sql` → `company_revenue.sql` → `app_feedback.sql` → `usage_reports.sql`
