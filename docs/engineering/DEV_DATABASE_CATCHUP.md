# Development database catch-up (owner decision 2026-10-16)

The owner chose to switch Beyond the Game posting on in the **development** project
(`ulfapgtabidorgwfjvwz`, the database the local app uses) before staging. Development stopped
receiving database changes on 2026-09-23: its migration history ends at
`20260923155421_reel_vault_signed_playback`, and none of the 27 files in
`supabase/migrations/` are there. Beyond needs the privacy (PRIV-01) and minor-account
(MINOR-01) files underneath it, so the whole chain goes in, in order.

Prepared by Claude Code on 2026-10-16 from read-only checks of development. Nothing here has
been run; the Supabase connection this session used is read-only. **The owner (or an approved
engineer) runs it** in the Supabase SQL Editor. Do not use `supabase db push` on any hosted
project before the baseline in `supabase/migrations/README.md` (it would re-run hand-pasted SQL).

## What the read-only checks found (2026-10-16)

- Missing standalone prerequisites: `custodial_money.sql` (custodial accounts, birthdates,
  withdrawals, `custodial_role`, `athlete_controls_money`, `athlete_handover_date`,
  `admin_set_custodial_terms`) and `leaderboards.sql` (`reels.view_count`, `reel_views`). Also
  missing: `tip_origin.sql` (`tips.origin`) and `clear_reel_hype.sql`.
- Present already: `company_revenue_logs` (with `source`), `reels.category`,
  `require_admin_guard()`, `current_user_role()`, `profiles`, `players`, `games`,
  `operator_checkins`, `schools_and_teams`, `sport_configs`, `app_runtime_config` and the other
  tables the migrations reference (checked by listing every `public.` object the 27 files use
  but do not create).
- Published runtime theme is still the old Island Daylight one; publish Look → "Daylight
  (default)" as an admin afterwards (see STATE §4, 2026-10-15).

## Before you start

1. Development holds test data only, but take a backup first: Supabase dashboard → Database →
   Backups (or note that the free plan's daily backup is the restore point).
2. Open the SQL Editor on **development** (check the project name in the header). Run each file
   once, in the order below. If a file errors, **stop**; do not run later files. Copy the error
   into the session so the owning team can fix it.
3. After each file in `supabase/migrations/`, run its record line so the history stays true.

## Order

| # | File | Record line |
| --- | --- | --- |
| 1 | `supabase/clear_reel_hype.sql` | (standalone file, no record line) |
| 2 | `supabase/custodial_money.sql` | (standalone file, no record line) |
| 3 | `supabase/leaderboards.sql` | (standalone file, no record line) |
| 4 | `supabase/tip_origin.sql` | (standalone file, no record line) |
| 5 | `supabase/migrations/20260929120000_athlete_verification_ladder.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929120000', 'athlete_verification_ladder') on conflict do nothing;` |
| 6 | `supabase/migrations/20260929130000_payout_gate_without_school.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929130000', 'payout_gate_without_school') on conflict do nothing;` |
| 7 | `supabase/migrations/20260929140000_school_badge.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929140000', 'school_badge') on conflict do nothing;` |
| 8 | `supabase/migrations/20260929160000_reel_views_and_filmer_credit.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929160000', 'reel_views_and_filmer_credit') on conflict do nothing;` |
| 9 | `supabase/migrations/20260929170000_filmer_rewards.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929170000', 'filmer_rewards') on conflict do nothing;` |
| 10 | `supabase/migrations/20260929180000_rally_goals_thanks_platform_tip.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929180000', 'rally_goals_thanks_platform_tip') on conflict do nothing;` |
| 11 | `supabase/migrations/20260929190000_telemetry_logs_bounds.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20260929190000', 'telemetry_logs_bounds') on conflict do nothing;` |
| 12 | `supabase/migrations/20261001180000_content_rights_reports.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261001180000', 'content_rights_reports') on conflict do nothing;` |
| 13 | `supabase/migrations/20261002120000_operator_checkins_role_check.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261002120000', 'operator_checkins_role_check') on conflict do nothing;` |
| 14 | `supabase/migrations/20261002160000_reel_account_tags.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261002160000', 'reel_account_tags') on conflict do nothing;` |
| 15 | `supabase/migrations/20261007211500_public_profile_sport.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261007211500', 'public_profile_sport') on conflict do nothing;` |
| 16 | `supabase/migrations/20261007230000_photo_stories.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261007230000', 'photo_stories') on conflict do nothing;` |
| 17 | `supabase/migrations/20261007231000_reels_storage_owner_folder.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261007231000', 'reels_storage_owner_folder') on conflict do nothing;` |
| 18 | `supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261012180000', 'admin_reports_bigint_and_donation_bands') on conflict do nothing;` |
| 19 | `supabase/migrations/20261012210000_bookkeeping_ledger.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261012210000', 'bookkeeping_ledger') on conflict do nothing;` |
| 20 | `supabase/migrations/20261013120000_data_governance_closures.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261013120000', 'data_governance_closures') on conflict do nothing;` |
| 21 | `supabase/migrations/20261013190000_engineering_support.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261013190000', 'engineering_support') on conflict do nothing;` |
| 22 | `supabase/migrations/20261013210000_function_access_hardening.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261013210000', 'function_access_hardening') on conflict do nothing;` |
| 23 | `supabase/migrations/20261013220000_disbursements_guardian_scope.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261013220000', 'disbursements_guardian_scope') on conflict do nothing;` |
| 24 | `supabase/migrations/20261013230000_avatars_owner_folder.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261013230000', 'avatars_owner_folder') on conflict do nothing;` |
| 25 | `supabase/migrations/20261013231000_family_share_in_received.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261013231000', 'family_share_in_received') on conflict do nothing;` |
| 26 | `supabase/migrations/20261014090000_profile_privacy.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261014090000', 'profile_privacy') on conflict do nothing;` |
| 27 | `supabase/migrations/20261014100000_tag_approval.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261014100000', 'tag_approval') on conflict do nothing;` |
| 28 | `supabase/migrations/20261014110000_minor_accounts.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261014110000', 'minor_accounts') on conflict do nothing;` |
| 29 | `supabase/migrations/20261014120000_payee_verification.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261014120000', 'payee_verification') on conflict do nothing;` |
| 30 | `supabase/migrations/20261016100000_workout_challenges.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261016100000', 'workout_challenges') on conflict do nothing;` |
| 31 | `supabase/migrations/20261016120000_beyond_game.sql` | `insert into supabase_migrations.schema_migrations (version, name) values ('20261016120000', 'beyond_game') on conflict do nothing;` |

Notes on order: filename order already applies `20261013220000_disbursements_guardian_scope.sql`
after the function-access security fix, the PRIV-01 files before MINOR-01, and the workout
challenges and Beyond files after MINOR-01, as their headers require.

## After the files

1. Check that Beyond's objects exist:
   `select to_regclass('public.beyond_posts') is not null as beyond, to_regclass('public.guardian_links') is not null as minors;`
2. Sign in to Expo `/admin` with an **admin** account (the `rain` test account is not an admin),
   open Highlights & review → Beyond the Game, and switch contributions on. The switch refuses
   while a dependency is missing and says which one.
3. In the app, tap ＋: it should ask "What are you sharing?" (Highlight or Beyond moment).
4. Publish Look → "Daylight (default)" while signed in as admin (Calm Island colours).
5. Tell the session; STATE §5 then moves these rows from "not applied" to "applied on development".

## Still open after this

Staging needs the October files separately (STAGING_RUNBOOK). Hosted Storage/JWT behaviour,
devices, counsel review of the consent and Beyond rights wording, and live money remain separate
gates (STATE §5–§6).
