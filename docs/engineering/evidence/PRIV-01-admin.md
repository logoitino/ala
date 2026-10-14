# PRIV-01 admin-ready evidence (2026-10-14)

Feature: profile privacy, two-way friends, blocking, guardian lock, hide from search (stage 1). Design:
[PROFILE_PRIVACY_DESIGN.md](../design/PROFILE_PRIVACY_DESIGN.md). Tag approval (stage 2) and the app screens are not
part of this checkpoint.

## What was built for the admin stage

- Source: `supabase/migrations/20261014090000_profile_privacy.sql` (written, **not applied anywhere**), copied onto
  `schema.sql`. Every rule is enforced in SQL; `profiles` reads close to own row or admin; `profiles_public` is read only
  through `get_public_profiles`.
- Client: `apps/mobile/src/frontend/lib/privacy.ts` (one wrapper per function), shared `lib/rpc.ts`.
- Admin: People desk → `PrivacyReport` (desk-wide counts) and `PrivacySafetyPanel` per person (settings, guardian lock,
  counts only — never who; reset to private defaults, release lock, hide/show in search).
- Disable: published switch `features.privacy.friends = false` pauses new friend requests; settings and blocks stay
  enforced. Admin repair: reset to private defaults.

## Checks run (Node 24.21.0, this Mac, 2026-10-14 ≈03:19 UTC)

| Command | Result |
| --- | --- |
| `node scripts/replay/schema-replay.mjs /tmp/books01-pg/pkg/package/dist` | 67/67 passed on PGlite (Postgres 18.6); includes 24 PRIV-01 checks: private defaults, closed direct reads, every audience, friends flow, guardian lock (new screen and older builds), blocks, no directory, hidden helpers, tag-search escaping, request-limit log, badge, feed photo, admin counts, friends switch |
| `cd apps/mobile && ../../node_modules/.bin/jest --watchman=false` on `PrivacySafetyPanel`, `privacy`, `PeopleTool`, `ReelOwnerPeek`, `routeClients`, `public-profile-navigation` tests | 5 suites, 29 tests passed |
| `pnpm check` | exit 0: 120 suites / 874 tests and every guard (data map 0 rule failures, docs, copy, comments, code:unused, agents, detection, feature-admin) |

## Reviews

- Design panel (PROFILE, PRIVACY_ENGINEERING, MINOR_SAFETY, RLS_SECURITY, HIGHLIGHTS, SPOTLIGHT, CUSTODIAL, ACCOUNT_TAGS):
  changes needed → applied in the design and stage 1.
- Stage 1 SQL (RLS_SECURITY, PRIVACY_ENGINEERING, MINOR_SAFETY): changes needed (11 findings) → applied → **approved**
  with probes.

## Not verified

Hosted database (not applied anywhere), the admin desk in a browser or on a device, real staging data (the migration's
final check stops if staging has extra hand-made read policies on `profiles` or `crew_follows`). Follow-ups: leaderboard
speed (fewer relationship checks), private avatar files (public bucket).
