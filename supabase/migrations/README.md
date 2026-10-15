# Database migrations

Started 2026-09-29 (docs/engineering/CODE_ORGANIZATION_PLAN.md step 1). Every database change from now on is a
new timestamped file in this folder, applied in filename order.

We are **not** moving hosts. This folder exists so the database history is plain, ordered SQL that
anyone can read — and, if Tapua'i ever has to move to another Postgres host, can replay in order.

## Rules

1. **One change per file**, named `YYYYMMDDHHMMSS_short_name.sql` (UTC). Supabase CLI layout, so
   `supabase db push` and `supabase migration list` work once the CLI is available.
2. **Header on every file:** purpose, link to the design doc, and how to roll back.
3. **Never edit a file that has been applied** to staging or production. Fix forward with a new file.
4. **Idempotent where cheap** (`create or replace`, `if not exists`, `drop trigger if exists`), so a
   re-run on staging is harmless.
5. **Copy the file onto the end of `apps/mobile/src/backend/db/schema.sql`** under a header, until
   that file becomes generated (plan step 1.4). `pnpm docs:check` reads `schema.sql`, so new tables
   and RPCs must also go into `docs/engineering/SCHEMA.md`.
6. Secrets (team codes, confirmer tokens) never go in a migration. Create them at run time — see
   "Adding a school confirmer" below.

## Applying (owner or approved engineer)

Staging first, then production.

- **With the Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
- **Without the CLI:** open the SQL Editor, paste the file, run it once. Then record it:
  `insert into supabase_migrations.schema_migrations (version, name) values ('20260929120000', 'athlete_verification_ladder');`
  (skip this line if the `supabase_migrations` schema does not exist yet — the baseline step creates it).

## Baseline — required for readiness R2, not done

Required before a clean rebuild and production setup. It needs staging database access.
A read-only dump can be reviewed locally; repairing remote migration history changes the
project and follows the approval recorded in STATE. Production does not exist yet.

1. Dump staging's current public schema to a review file outside `migrations/` first.
2. Determine which existing migrations the dump already includes. Choose a reviewed baseline
   strategy that does not replay those changes on top of themselves; verify it from an empty
   local Supabase instance before repairing staging migration history.
3. Diff the baseline with `schema.sql`. Each difference is either a standalone `supabase/*.sql` file
   that was never applied (turn it into a migration) or dead SQL (delete it).
4. Move the standalone `supabase/*.sql` files to `supabase/legacy/`.

Do not give a current snapshot an older filename and assume all later files can safely replay.
If using a historical baseline sorted before `20260929120000`, it must represent the schema
before those migrations. A current squashed baseline requires a documented treatment of the
included history. Auth, Storage, grants and other dependencies need Supabase-aware validation.

## Files

Application dates below are saved records, not a fresh remote query.

Apply order, including the standalone `supabase/*.sql` files these depend on, and a pre-flight
check: `docs/STATE.md` §0.

| File | What | Applied? |
| --- | --- | --- |
| `20260929120000_athlete_verification_ladder.sql` | School-confirmed athlete verification: claims go to "pending", the athletic director or coach confirms in person with a 6-digit code; closes the self-verify and name-match holes. [Design](../../docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md) | **Recorded on staging 2026-09-30; not development.** No dependency on the other unapplied files |
| `20260929130000_payout_gate_without_school.sql` | Payouts unlock with Stripe ID check + one undisputed claim, $250 cap until 3 teammate vouches or school confirmation; `athlete_vouches` + vouch RPCs. [Design §9](../../docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md) | **Recorded on staging 2026-09-30; not development.** Needs `20260929120000` and `supabase/custodial_money.sql` (`custodial_accounts`, `athlete_controls_money`) first |
| `20260929140000_school_badge.sql` | School logo / colours, `athlete_school_badge`, `admin_set_school_branding`, no ✓ in names. [Design §10](../../docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md) | **Recorded on staging 2026-09-30; not development.** Needs `20260929120000` first |
| `20260929160000_reel_views_and_filmer_credit.sql` | `reels_feed` gains `view_count` / `uploader_name` / `uploader_avatar_url`; `athlete_highlight_views`, `filmer_stats` | **Recorded on staging 2026-09-30; not development.** Needs `supabase/leaderboards.sql` (`reels.view_count`) first |
| `20260929170000_filmer_rewards.sql` | Filmer Aura (tag confirmed, view milestones, Props), `filmer_rewards` ledger, `filmer_props`, `give_filmer_props`, `get_top_filmers`, `filmer_stats` v2 | **Recorded on staging 2026-09-30; not development.** Needs `20260929160000` first |
| `20260929180000_rally_goals_thanks_platform_tip.sql` | Rally goals (`rallies`, create / approve / close / thank RPCs, `tips.rally_id` credits the total), preset donor thank-yous (`donation_thanks`, `thank_donation`), optional tip to Tapua'i at checkout (`tips.platform_tip_cents`, revenue source `tip`, 100% platform) | **Recorded on staging 2026-09-30; not development.** Needs `supabase/custodial_money.sql` (`athlete_controls_money`), `company_revenue.sql`, `tip_origin.sql` first |
| `20260929190000_telemetry_logs_bounds.sql` | Bounds `telemetry_logs` event type, duration (scroll 0–100, tab dwell 12h, everything else 10 min), attempts, text length and payload. Guest INSERT stays. Re-run replaces an earlier draft. [docs/STATE.md](../../docs/STATE.md) §5 / §6 item 1 | **Staging 2026-09-30.** Not the development project. No dependency. |
| `20261001180000_content_rights_reports.sql` | Uploader confirmation columns on `reels`, `reel_reports`, and `report_reel` reasons. Fake footage, impersonation, and music/logo/broadcast leave the public feed; other reasons wait for the athlete, the guardian, or three accounts. | **Staging 2026-10-01.** Not the development project. Needs `custodial_accounts`. |
| `20261002120000_operator_checkins_role_check.sql` | Puts a role check (demo-PIN `anon`, operator, admin) on `operator_checkins`, which stored GPS check-ins behind `using (true)`. Matches `operator_gigs`. Needs `current_user_role()` (already in schema). | **No.** Not applied to any project. |
| `20261002160000_reel_account_tags.sql` | Highlight account mentions (`reel_account_tags`). Uploader adds up to three active mentions under a reel row lock; confirmation returns a status only for an owned pending row actually changed. Donations stay on the athlete tag. Revised 2026-10-07 before first application; no local Postgres verification. | **No.** Not applied to any project. |

| `20261007211500_public_profile_sport.sql` | Appends nullable selected athlete sport to `profiles_public`, preserving bio/social visibility and grants. Public hero/Stats/Aura share sport selection. | **No.** Prepared locally, PostgreSQL replay and hosted application pending. Needs existing profiles_public and current_user_role. |
| `20261007230000_photo_stories.sql` | Photo stories in Highlights ⚡ (UX-05): `reels.media_type` (`video` \| `photo_story`) + `photo_count` (zeroed on insert, set only by the RPC); constraint `reels_photo_story_public_check` keeps stories out of the Vault; `reel_photos` stores Storage **paths** (`image_path`, uploader/admin base reads, no client writes); `set_reel_photos` publishes a story once after ownership, 1–10 count, anchored own-folder path (`{uid}/stories/{reel_id}/{n}-{ms}.jpg`) and description checks; `reel_photos_feed` gates `image_path` like `reels_feed` gates `video_url`; `reels_feed` appends `media_type`, `photo_count`, `cover_path`; re-states `get_pending_player_tags`, `reels_filmer_rewards` (skip unpublished stories) and `get_spotlight_standings`, `get_active_spotlight_award`, `publish_spotlight_award` (videos only); Storage bucket `reels` also accepts `image/jpeg`. [Design](../../docs/engineering/design/PHOTO_STORIES_DESIGN.md) | **No.** Written 2026-10-07 (QA fixes UX-05a the same day, before any application), not applied anywhere; never parsed by Postgres. Needs `20260929160000` (current `reels_feed`), `20260929170000` (filmer rewards) and `supabase/leaderboards.sql`; waits on DATABASE_MIGRATIONS + RLS_SECURITY sign-off. |
| `20261007231000_reels_storage_owner_folder.sql` | `reels` bucket INSERT / UPDATE policies also require the caller's own folder: `{uid}/...` (photo stories) or `reels/{uid}/...` (the video layout `uploadHighlight` writes), so one account can no longer overwrite another's video or photo with `upsert`. Writers audited 2026-10-07. Separate so STORAGE can review it alone. | **No.** Written 2026-10-07, not applied anywhere; never parsed by Postgres. Independent of the photo-story migration. |
| `20261012180000_admin_reports_bigint_and_donation_bands.sql` | `get_admin_reports` (owner decisions 2026-10-12): every milliseconds or cents sum is `bigint`, not `int` (a 7-day tab-dwell sum overflowed past about 596 hours and failed the whole RPC); new top-level `donation_bands` `{under_50, 50_to_250, 250_plus}` counts athletes by all-time donation total in cents (>0 and <5000 / 5000 to <25000 / 25000+), counts only, same `tips` source as `leaders.malo`, all zeros with no donations. `leaders.malo` is kept for existing readers. Same signature, `security definer`, `search_path`, admin guard; EXECUTE revoked from `public`/`anon`, granted to `authenticated`. Rollback: previous body at commit `a5d0e8f`, `schema.sql` lines 4785-5030. | **No.** Written 2026-10-12, not applied anywhere; never parsed by Postgres. Needs `require_admin_guard()` (2026-09 audit section of `schema.sql`; the file checks first). Owner pastes it into the staging SQL Editor. |
| `20261012210000_bookkeeping_ledger.sql` | Books (BOOKS-01, revised 2026-10-13 after RLS_SECURITY and CONTROLLER/TAX review; PGlite replay 72/72): seeded `ledger_accounts`; `ledger_period_reopens` audit; per-month advisory lock (`ledger_lock_period`); `search_path = ''` on every definer function; `athlete_ref` on recorded lines (refunds, payouts); server-owned `disbursements.paid_at`; unique `tips.stripe_payment_intent_id`; card fees as their own `get_company_revenue_summary` stream; `ledger_manual_entries` / `ledger_manual_lines` written only by `record_ledger_entry` (balanced, known accounts, open month) and reversed by `void_ledger_entry`; `ledger_period_closes` with per-account totals via `close_ledger_period` / `reopen_ledger_period`; `get_ledger_books` read. `tips.cover_fee_cents` (logged as `card_fee` revenue by `tips_card_fee_revenue`) and `tips.stripe_payment_intent_id`; `disbursements.paid_at` stamped by `disbursements_paid_at`. All RPCs admin-guarded, EXECUTE for `authenticated` only; new tables admin-SELECT only, no client writes. [Design](../../docs/engineering/design/BOOKKEEPING.md) | **No.** Written 2026-10-12, not applied anywhere; never parsed by Postgres. Needs `require_admin_guard()` and `20260929180000` (the file checks both first). Until applied, `/admin/books` shows income and payouts only, and the checkout retries a donation insert without the two new columns. |
| `20261013120000_data_governance_closures.sql` | Data governance closures (DATA-01 F1–F5): admin writers for `athlete_career_stats` / `athlete_game_logs`; `clear_my_crew_alerts` so Crew alerts are read and cleared; `operator_checkins` stored rounded to ~1 km with the server's time and expired after 30 days by one function (`expire_operator_checkins`, run by the `operator_checkins_minimize` insert trigger, `admin_list_operator_checkins` and `admin_purge_operator_checkins`); `admin_list_school_confirmers` (no token hash); drops `get_aura_tier` (archived as `archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql`). All admin-guarded, `search_path = ''`, EXECUTE for `authenticated` only. | **No.** Written 2026-10-13, not applied anywhere; replayed 46/46 on PGlite (`scripts/replay/data01-closures-replay.mjs`). Needs `require_admin_guard()`. The admin controls report "not switched on" until it is applied. School confirmers can now be added from the Schools desk; the SQL below still works. |
| `20261013210000_function_access_hardening.sql` | **Security fix** found by the full `schema.sql` replay (DATA-01; RLS_SECURITY approved). Guests and signed-in fans could write revenue rows into the books (`record_company_revenue` / `sync_company_revenue_logs` kept EXECUTE through PUBLIC); guests could raise donation totals and Aura, change sport settings and triage feedback. Now: server-only functions have no client EXECUTE; `increment_reel_tips`, `add_user_aura`, `publish_spotlight_award`, `upsert_cheer_poll` are signed-in only; `triage_app_feedback`, `upsert_sport_config`, `delete_sport_config` require an admin; `increment_backer_count` and three `admin_*` custodial functions lose the guest grant hosted Supabase adds by default; `service_role` keeps every narrowed function (the Stripe webhook). New `is_trusted_server()` is the one "server, not a client" test; `is_admin_or_db()` and the caps use it, so a request with no JWT claims no longer counts as the SQL Editor; the four ladder admin functions lose anon EXECUTE. | **No.** Written 2026-10-13, not applied anywhere. **Apply first on staging**, independent of the other 2026-10-13 files. Replay: `scripts/replay/schema-replay.mjs` (whole schema; 35/35 with both October security files, 13/35 before them; the replay mimics Supabase's default grants). Skips (with a notice) functions a database lacks. The five amount / Aura cap CHECK constraints now use `is_trusted_server()` (NOT VALID: new rows only). |
| `20261013220000_disbursements_guardian_scope.sql` | Payout rows (STATE §5 Wave 1 blocker): admins write; reads are admins plus the athlete's custodial parties (`custodial_role`, guardian / verified athlete). Before it any parent-role account could read, insert, update or delete every family's payout rows. A paid payout is final (trigger `disbursements_paid_final`: amount and athlete locked; status may still move). Falls back to admin-only reads where `custodial_role` is missing. Owner RLS_SECURITY (chain: owner → CTO → SECURITY), reviewed by CUSTODIAL and INTERNAL_CONTROLS. | **No.** Written 2026-10-13, not applied anywhere. Apply after `20261013210000`. Replay: `scripts/replay/schema-replay.mjs` (35/35). CUSTODIAL + INTERNAL_CONTROLS approved. |
| `20261013230000_avatars_owner_folder.sql` | `avatars` bucket: INSERT / UPDATE only in the caller's own folder (`{uid}/…`, `sponsors/{uid}/…`); before it any signed-in user could overwrite any profile photo. Older builds' flat `sponsors/<file>` logos may still be inserted, never overwritten. Users may delete their own photos ("Owner delete avatars"). The legacy `supabase/media_upload.sql` now carries the same owner-folder policies (reels and avatars) so re-running it cannot reopen the hole. Owner STORAGE; RLS_SECURITY approved after changes. | **No.** Written 2026-10-13, not applied anywhere. Independent. Replay: `scripts/replay/schema-replay.mjs`. |
| `20261013231000_family_share_in_received.sql` | `get_received_malo` gains `family_cents` (dropped and re-created; grants restored) and `get_custodial_summary` gains `family_cents`: what reached the family account, from the books (`company_revenue_logs`), so families stop seeing the donated total as received. `received_cents` unchanged for installed builds. Owner COMMERCE → LEDGER, CUSTODIAL; wording reviewed by VOICE and LEGAL. | **No.** Written 2026-10-13, not applied anywhere. Needs `company_revenue.sql`, `custodial_money.sql` (on staging). Replay: `scripts/replay/schema-replay.mjs` (43/43). Confirm `company_revenue_logs_source_id_key` (unique source, source_id) exists on staging first. Also revokes guest EXECUTE on `get_custodial_summary`. |
| `20261014090000_profile_privacy.sql` | PRIV-01 stage 1: public / private accounts (new accounts private), per-item audiences, two-way friends, blocking, hide from search (the first draft's guardian lock was removed before anything was applied; MINOR-01 replaces it); `profiles` SELECT closes to own row or admin, `profiles_public` rebuilt on `viewer_relationship` / `profile_item_visible`, `crew_follows` reads close and its writes refuse blocked followers; search respects privacy. Existing accounts keep today's behaviour. Owner PROFILE; reviews RLS_SECURITY, PRIVACY_ENGINEERING, MINOR_SAFETY. | **No.** Written 2026-10-14, not applied anywhere. Apply after the 2026-10-13 files. Replay: `scripts/replay/schema-replay.mjs`. Known limit: public avatar files. |
| `20261014100000_tag_approval.sql` | PRIV-01 stage 2: tag decisions only from pending; a rejection untags the clip and is remembered (`reel_tag_rejections`: no re-tag on that clip; three declines bar the uploader); five pending tags per uploader per athlete (school operators exempt); a blocked uploader's tag ends exactly like a decline; clients write only the app's `reels` columns; a decline names nobody; auto-approve friends; operators confirm only for athletes without a verified account; `reels_feed` hides a pending tag's athlete from non-parties; Spotlight and leaderboards credit pre-approval engagement on the approval date. Owner HIGHLIGHTS / ACCOUNT_TAGS; reviews RLS_SECURITY, MINOR_SAFETY, SPOTLIGHT. | **No.** Written 2026-10-14, not applied anywhere. Apply after `20261014090000`. Replay: `scripts/replay/schema-replay.mjs`. |
| `20261014110000_minor_accounts.sql` | MINOR-01: birth month and year replace the 13+ checkbox (under 13 refused; an under-13 entry closes the account, with a restrictive "Closed accounts" policy on every RLS table and Storage); teen defaults (private, requests from teens only); guardian links from a teen's code (the teen confirms), signed append-only consent (public profile, payouts from the guardian on record), supervision summary and under-16 approvals; payout reasons `needs_guardian_consent` / `needs_birth_month`; admin case file, report and retention. Owner PROFILE; reviews MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, RLS_SECURITY, LEGAL (row AA). | **No.** Written 2026-10-14, not applied anywhere. Apply after `20261014100000`. Replay: `scripts/replay/schema-replay.mjs`. Future RLS tables must add the "Closed accounts" policy. |
| `20261014120000_payee_verification.sql` | VERIFY-02: SSN to Stripe only (never stored; CHECKs refuse SSN-shaped text); append-only `payee_verifications`; payouts need the actual payee's Stripe identity + TIN and, for a guardian, the school's parent confirmation (document review fallback) — reason `needs_payee_verification`; payout flags change only from the server or a two-admin override (`payout_flag_overrides`); re-verification when the guardian on record or Connect account changes; admin overview / report. Owner CONNECT; reviews RLS_SECURITY, CUSTODIAL, PRIVACY_ENGINEERING, INFO_RETURNS, LEGAL. | **No.** Written 2026-10-14, not applied anywhere. Apply after `20261014110000`. Replay: `scripts/replay/schema-replay.mjs`. The `create-stripe-account` function must call `record_stripe_kyc` (CONNECT follow-up). |

## Adding a school confirmer (after the verification migration)

In the SQL Editor (a direct session counts as admin):

```sql
select public.admin_add_school_confirmer(
  '<schools_and_teams.id>', 'Ana Tui', 'ana.tui@school.org', 'athletic_director', null);
-- or 'coach' with a sport, e.g. 'Rugby', to limit the link to that team
```

It returns `{id, token, link}` once. Send the `link` (`alasports://school-confirm?t=…`) to that
staff member's **school email** only. The token is stored hashed and cannot be shown again; to
replace a lost link, `select public.admin_revoke_school_confirmer('<id>');` and add a new one.

## Setting a school's crest (after the school badge migration)

```sql
select public.admin_set_school_branding(
  '<schools_and_teams.id>', 'https://example.org/crest.png', '#1D3F8F', '#FFFFFF');
-- logo must be https (or null for a monogram shield); colours #RRGGBB
```

### Engineering Support (20261013190000)

`20261013190000_engineering_support.sql` adds restricted support evidence/reviews/releases
and selected-table atomic audit. Requires October bookkeeping and existing role guards.
Prepared and replayed locally only; apply only with owner approval. Rollback disables RPCs/triggers
through reviewed migration and preserves records. Never restore old SQL automatically or undo money
when switching source versions. Canonical schema contains the same support section.

## Family fun testing pilots (written, not applied)

| Migration | Dependency / handling | Applied |
| --- | --- | --- |
| `20261014130000_fan_zone.sql` | After `20261014120000_payee_verification.sql`/MINOR-01; private bucket, exact entry consent, versioned free ballots, reporting/removal. Default draft/empty approved tester audience, production refusal. Local actor replay only; no deployment/scheduler. Normal admin review uses exact-scope CAS; snapshot uses versioned composite cursor. Old RPC signatures explicitly dropped before new grants. | No. |
| `20261014140000_sport_pop_quiz.sql` | After FUN-01; private weekly question/badge and corrected-content handling. Default paused/empty tester audience; all seed questions draft awaiting fact review. | No. |

Owner approves actual SQL/release. See [Fan Zone design](../../docs/engineering/design/FAN_ZONE_DESIGN.md) and [Quiz design](../../docs/engineering/design/SPORT_POP_QUIZ_DESIGN.md). Rollback headers require reviewed retention/access handling; do not delete records or restore old SQL automatically.

## Timed trivia replacement — QUIZ-02

| File | Purpose | Applied? |
| --- | --- | --- |
| `20261014150000_timed_sport_trivia.sql` | After untimed1400: private preferences/exposures/exact recovery/minimal35-day quota,30/90 deadline, original-view capability, secret-free End/cancel, CAS erasure, versioned sources/family review and50-row admin paging. First legacy upgrade resets prior enabled/nonempty cohort to paused/empty; later repeats preserve timed settings/preferences/history/live deadlines. Legacy attempts remain historical. | **Local source only; not applied anywhere.** Actual actor/canonical/admin/app evidence in [QUIZ-02](../../docs/agents/QUIZ-02.md). |

Root appends final migration bytes to canonical schema. Revoke old untimed overloads; old clients
fail closed. Rollback is pause and reviewed forward repair, never automatically restore untimed
authority or erase learning/quota records. Real hosted compatibility, lifecycle/accessibility and
counsel notices/retention review remain required before enabling a cohort.

## Trivia play together — QUIZ-03

| File | Purpose | Applied? |
| --- | --- | --- |
| `20261014160000_trivia_play_together.sql` | After QUIZ-02 and MINOR-01/PRIV-01 (after QUIZ-04 it stops with `quiz_rerun_after_quiz04` if re-run alone; re-apply via `schema.sql`): rounds of up to five with per-item deadlines and exact Next recovery, week-boundary checks, per-item void, round size 1–5, `true_false` / `image_choice` types (images refused while `trivia.images` is off; no delivery), cap 300 counting draft + approved, badges per (profile, label, period), season recap, family groups (preset names, hashed codes, teen rules both ways, blocks, limits, shared sets without exposure reads, audited case log, admin case view / removal), guardian `trivia_groups` count, erasure / retention / hand-over. Both switches default off; settings stay paused. | **Local source only; not applied anywhere.** Replays: `trivia-play-together-replay.mjs` and `timed-trivia-replay.mjs --with-quiz03`. |
| `20261014170000_trivia_starter_bank.sql` | QUIZ-03 starter trivia bank: 60 **draft** questions (12 sports × 4, plus science / geography / fun; 45 four-choice, 15 true / false) generated from `supabase/content/trivia_starter_bank.json` by `scripts/trivia-bank-sql.mjs`. Content verifies sources and approves each in /admin/sport-quiz. | **No.** Written 2026-10-14, not applied anywhere. Apply after `20261014160000`. |
| `20261014180000_life_playbook.sql` | QUIZ-04 after the QUIZ-03 starter bank, simplified in place by the owner on 2026-10-15 (design §8): round kinds (personal / group / Life, one guard each, one active round, `quiz_end` takes the kind, per-kind request budgets with reserved slots); group rounds need 2 members and alone count as "played"; Trivia Explorer re-points on void; Life columns (`chapter`, `min_age_band` 13, `education_only`), separate Life cap 200; four 13+ chapters (Money Huddle, Savings Season, Scam Defense, Smart Plays), closed until 5 approved questions; one-admin approval like trivia with the simplified Life copy rules (`supabase/content/life_copy_rules.json` v4: no advice, brands, Tapua'i money words, NIL / eligibility, tax / loan / credit, money figures or years; Scam Defense ending; length limits); levels that only go up; private opt-in; aggregate-only admin Life statistics; Life out of trivia counts and audit feed; `trivia.life` off. Control tower additions (2026-10-15, also in place): `quiz_admin_snapshot.bank_counts` (draft / approved versions by topic, sport and chapter) and the atomic `quiz_admin_question` action `edit_replace`. Re-adds QUIZ-03's widened checks `NOT VALID`. Removed before applying (archived in `archive/superseded-2026-10-15/sql/`): CPA sign-offs, named reviewers, source / tax-year / re-review fields, January withdrawal, 16+ / adult bands. | **Local source only; not applied anywhere.** Replay: `life-playbook-replay.mjs`. |
| `20261014190000_life_playbook_bank.sql` | QUIZ-04 Life bank: 40 **draft** questions (10 per chapter, all 13+, simple facts with no money figures) generated from `supabase/content/life_playbook_bank.json` by `node scripts/life-bank-sql.mjs`; one admin approves each like trivia; all chapters stay closed until 5 are approved. | **No.** Written 2026-10-14, regenerated 2026-10-15, not applied anywhere. Apply after `20261014180000`. |

Rollback is pause (settings off, `trivia.groups` off) and a reviewed forward migration; never drop round, group
or case records blindly. Hosted compatibility, counsel review of group notices/retention and device testing remain.

