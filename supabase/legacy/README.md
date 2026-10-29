<!-- Pre-migration incremental SQL kept for reference; do not apply as the live history. -->
# Legacy incremental SQL (reference only)

These 52 files are the **pre-migration** stand-alone scripts that were applied by hand (or
copied into `apps/mobile/src/backend/db/schema.sql`) before Tapua'i used timestamped
`supabase/migrations/`.

| Rule | Meaning |
| --- | --- |
| **Do not apply** these against a hosted project as the source of truth | Live history is `migrations/` + what was actually recorded on each project |
| **Do not delete** them | Reviewers and exit/parity work still need the original shapes |
| **Canonical for new work** | New changes = new `migrations/YYYYMMDDHHMMSS_name.sql`, then copy onto `schema.sql` |
| **Coverage (2026-10-28 inventory)** | Every file here is reflected in `schema.sql` and/or `migrations/` (content or object match). None were left “unclear.” |

Inventory (all **covered** → moved here 2026-10-28):

`add_user_aura.sql`, `add_user_role.sql`, `admin_dashboard.sql`, `admin_portal.sql`,
`admin_reports.sql`, `app_feedback.sql`, `app_runtime.sql`, `athlete_stats.sql`,
`athlete_subscriptions.sql`, `athlete_verification.sql`, `auth_fan_profile.sql`,
`cheer_polls.sql`, `clear_reel_hype.sql`, `company_revenue.sql`, `crew_and_flash_unlock.sql`,
`custodial_money.sql`, `demo_fan_account.sql`, `game_events.sql`, `games.sql`,
`games_clock.sql`, `games_operator.sql`, `get_fan_tip_history.sql`, `increment_backer.sql`,
`increment_hype.sql`, `leaderboards.sql`, `legal_terms_ack.sql`, `locker_room_wishlist.sql`,
`malo_ledger.sql`, `media_upload.sql`, `player_vault_lock.sql`, `players.sql`,
`profile_customization.sql`, `profile_roles.sql`, `profiles_verified_compat.sql`,
`reel_category.sql`, `reel_hype_votes.sql`, `reels.sql`, `report_reel.sql`, `saved_reels.sql`,
`schools_and_teams.sql`, `search_local_entities.sql`, `sponsorships.sql`, `sport_configs.sql`,
`spotlight_auto.sql`, `spotlight_awards.sql`, `stripe_connect.sql`, `subscriber_requests.sql`,
`subscriptions.sql`, `telemetry_logs.sql`, `tip_origin.sql`, `toggle_reel_vault_status.sql`,
`usage_reports.sql`.

Fake local seed data for CLI layouts lives in `../seed.sql` (never real people). Hosted
Demo Fan setup historically lived in `demo_fan_account.sql` here — still reference-only;
credentials must not ship in production builds.

See [CODE_ORGANIZATION_PLAN.md](../../docs/engineering/CODE_ORGANIZATION_PLAN.md) R2 and
[migrations/README.md](../migrations/README.md).
