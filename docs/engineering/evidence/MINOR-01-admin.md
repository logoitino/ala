# MINOR-01 admin-ready evidence (2026-10-14)

Feature: minor accounts. Covers birth month and year (replacing the 13+ checkbox), teen-safe defaults, guardian link
through a teen's code with teen confirmation, the signed consent, supervision, under-16 approvals and under-13 closure.
Design: [MINOR_ACCOUNTS_DESIGN.md](../design/MINOR_ACCOUNTS_DESIGN.md). This replaces the PRIV-01 guardian lock, which
was removed from stage 1 before anything was applied.

## What was built for the admin stage

- **Source:** `supabase/migrations/20261014110000_minor_accounts.sql` (written, **not applied anywhere**), copied onto
  `schema.sql`. Every rule is in SQL, and the six new tables have no client access.
- **Client:** `apps/mobile/src/frontend/lib/minors.ts` has one wrapper per function. `data/guardianConsent.ts` holds the
  draft form, with its SHA-256 pinned to the migration.
- **Admin:** People desk → Privacy & safety.
  - `MinorReport` shows counts by band, teens with a guardian, each consent permission, waiting approvals, codes made
    and two abuse signals: guardians with more than 3 teens, and adult friend requests to teens. It also has the
    under-13 deletion list and the retention purge.
  - `MinorCaseFile` is the per-person file: band and birth month and year, closed state, guardian links with names,
    signed consent records and the supervision summary. Its two repairs, correcting the birth month and year and ending
    a guardian link, each need a reason.
- **Disable:** the published switch `features.minors.guardian_links = false` pauses new codes and links. It never
  loosens a rule: existing links, consent and the teen rules stay in force.

## Checks run (Node 24.21.0, this Mac, 2026-10-14 ≈04:44 UTC)

| Command | Result |
| --- | --- |
| `node scripts/replay/schema-replay.mjs /tmp/books01-pg/pkg/package/dist` | 100/100 passed on PGlite (Postgres 18.6), including 20 MINOR-01 checks. They cover sign-up bands and the under-13 refusal, teen-only requests, no older-age self-correction, consent and approval gates, codes (format, counted wrong tries, adults only), teen confirmation, a code-linked guardian seeing only the stranger view, approvals, payouts only through the guardian on record, unlink by block, under-13 closure on every table and Storage, append-only consent, the admin report, the "off"/"no" boolean trick, the teen oracle, an unconfirmed guardian learning nothing, no re-link after the teen ends it or after an admin ends it, and payouts for an adult, a minor and an unknown age |
| `cd apps/mobile && ../../node_modules/.bin/jest --watchman=false src/frontend/components/Admin/__tests__/MinorAccountsPanel.test.tsx src/frontend/components/Admin/__tests__/PrivacySafetyPanel.test.tsx src/frontend/lib/__tests__/minors.test.ts src/frontend/data/__tests__/guardianConsent.test.ts` | 4 suites passed |

The admin desk and the app screens were built in the same session. This checkpoint records when the admin desk and its
tests passed, before the app checkpoint.

## Reviews

- **Design panel** (MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, LEGAL): changes needed → applied. Declined for growth:
  the 72-hour wait before a new guardian can approve, and the rule that guardian accounts must be 7 days old. Both are
  recorded as options for the owner.
- **SQL review** (RLS_SECURITY with MINOR_SAFETY): changes needed (1 P0, 4 P1, 2 P2, 5 P3) → applied → re-check. That
  re-check confirmed everything except one new P2 (re-linking after an admin ends a link) and one P3 (Storage writes by
  a closed account). Both are now fixed and covered by replay checks, but the reviewer has not re-read those two fixes.

## Not verified

- Any hosted database: the migration is not applied anywhere.
- The admin desk in a browser or on a device.
- Real staging data.
- That Stripe Express checks an account holder's birth date (assumed, LEGAL row AA).
- Deleting under-13 sign-ins: done from the Supabase dashboard, not by the app.
