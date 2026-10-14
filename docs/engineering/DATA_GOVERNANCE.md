# Data governance — where every piece of data lives and moves

Last updated: 2026-10-13. Control point: **`DATA_GOVERNANCE`** (reports to the CTO), with `DATA_LINEAGE`
(the map) and `CODE_HYGIENE` (dead code). Tracker: [DATA-01](../agents/DATA-01.md).

## The rule

Every table, view, Storage bucket, database function, feature switch and exported piece of code has **an
owner, a writer, a reader and a purpose**. If something has no owner, nothing writes it, nothing reads it, or nothing calls it, it is
either fixed, recorded as a deliberate exception with a reason, or archived with the owner's approval.
Nothing is deleted (owner rule, 2026-10-07).

## The three pieces

| Piece | What it is | Who keeps it |
| --- | --- | --- |
| [data-ownership.json](data-ownership.json) | The registry: owner and purpose for every table and view; how hand-run functions are used; deliberate exceptions; the decision (keep or archive) for every unused export | `DATA_GOVERNANCE` (`CODE_HYGIENE` for `exportsTriage`) |
| [scripts/data-map.mjs](../../scripts/data-map.mjs) | The generator: reads `schema.sql`, every app, portal and Edge Function file and the registry, and traces owner → writers → readers → database functions → triggers → screens | `DATA_LINEAGE` |
| [DATA_MAP.md](DATA_MAP.md) | The generated master map, by owner, table and function, with the dead-code triage and any rule failures | Generated; never hand-edited |

`pnpm check` (and CI) runs `pnpm data:map:check`. It fails when the map is stale or a rule is broken,
and each failure says exactly how to fix it.

## When you change data (every agent and every outside session)

1. New table or view → add it to `data-ownership.json` `tables` with an owner (a registered agent call)
   and a plain-language purpose. Money columns also go in the finance data catalog
   (`packages/shared-types/admin/financeCatalog.ts`); personal data also goes in
   [DATA_PRIVACY_MAP.md](DATA_PRIVACY_MAP.md).
2. New database function → make sure something calls it (app, portal, Edge Function, trigger or other
   SQL). A function meant for the SQL Editor gets a `functions` entry saying how it is used.
3. New export → import it somewhere, or don't export it.
4. Run `node scripts/data-map.mjs` and commit the regenerated `DATA_MAP.md` with your change.
5. If you think something is dead, tell `DATA_GOVERNANCE`; do not delete it.

New features also enroll in the feature workflow ([FEATURE_ADMIN_WORKFLOW](FEATURE_ADMIN_WORKFLOW.md));
`DATA_GOVERNANCE` reviews the data paths in that enrollment.

## How the map relates to the other maps

The master map does not replace the specialist maps. It ties them together, and each keeps its owner:

| Map | Covers | Owner |
| --- | --- | --- |
| [DATA_PRIVACY_MAP.md](DATA_PRIVACY_MAP.md) | Personal data, minors, retention, processors | `PRIVACY_ENGINEERING` |
| Finance data catalog (`financeCatalog.ts`) and Reconcile tab | Every money column; source rows reach the books | `FINANCE_DATA`, `INTERNAL_CONTROLS` |
| Analytics measure catalog (`packages/shared-types/admin/analytics.ts`) | Every reported measure | `ANALYST` |
| Coverage map (`lib/adminCoverage.ts`) | Every fan control, its switch and telemetry key | `RUNTIME_CONFIG`, `ADMIN` |
| Feature registry (`docs/agents/feature-admin.json`) | Admin-first contract for new features | Feature owner, reviewed by the lead |
| `app:data-boundaries` | No database calls from Expo route files | `ENGINEERING` |

## Chain of command

`CTO` → `DATA_GOVERNANCE` → `DATA_LINEAGE` / `CODE_HYGIENE`. A finding goes to the owner named in the
registry through that owner's lead, and the CTO assigns the fix. Money findings also go to the CFO's
office (`FINANCE_DATA`, `INTERNAL_CONTROLS`); personal-data findings go to `PRIVACY_ENGINEERING`. Only the
owner (`FACILITATOR`) approves archiving, applying SQL or deleting.

## Cadence

- **Every change:** `pnpm data:map:check` and `pnpm code:unused` in `pnpm check` and CI. `code:unused` runs the
  TypeScript compiler's unused-locals check on the app and fails on any unused import, variable or parameter not
  named in `data-ownership.json` → `unusedLocalsBaseline` (each entry has an owner and a reason).
- **Weekly:** `DATA_GOVERNANCE` reads the map for new exceptions, findings and triage entries, and reports
  drift to the CTO.
- **Before every release:** owners confirm their tables' purposes are still true; open findings are
  either fixed or accepted in STATE §5.

## Findings (2026-10-13) — all closed locally (F8/F9 found by the full schema replay)

| ID | Finding | Owner | Closed by |
| --- | --- | --- | --- |
| DATA-01-F1 | Career stats and game logs were shown but nothing in the app wrote them | `ATHLETE_STATS` | Athletes desk → Stats panel (`AthleteRecordsPanel`) through `admin_upsert_athlete_career_stats`, `admin_add_athlete_game_log`, `admin_remove_athlete_game_log` |
| DATA-01-F2 | Crew alerts were queued and never read or cleared | `NOTIFICATIONS` | Activity → Crew alerts (`CrewAlertsCard`) reads the fan's own alerts; `clear_my_crew_alerts` clears them |
| DATA-01-F3 | Operator GPS check-ins were stored and never read | `OPERATOR` + `PRIVACY_ENGINEERING` | Live games desk (`OperatorCheckinsPanel`) reads them; the database stores them rounded to ~1 km and removes them after 30 days automatically (`expire_operator_checkins`, PRIVACY_ENGINEERING decision 2026-10-13) |
| DATA-01-F4 | Five admin functions were SQL Editor only | `ATHLETE_VERIFICATION`, `CUSTODIAL`, `SCHOOL_PARTNERS` | Schools desk branding (prefilled from the database) + confirmers (`SchoolStaffPanel`), People desk "Revoke and unlink" → `admin_revoke_verification` (Unverify stays badge-only), Athletes desk custodial terms |
| DATA-01-F5 | `get_aura_tier` was never called | `AURA` | Dropped by migration; definition in `archive/dead-code-2026-10-13/sql/get_aura_tier.archived.sql` |
| DATA-01-F6 | 47 unused exports, then everything that only they used (two passes, 62 entries) | `CODE_HYGIENE` | Moved to `archive/dead-code-2026-10-13/` with their tests (owner approved); list in `data-ownership.json` → `archived`; 19 exports kept with reasons in `exportsTriage` |
| DATA-01-F7 | Look desk "Actions on top" switch did nothing | `PROFILE` | Wired in `AthleteProfileView` (Donate / Share under the section tabs when on) |
| DATA-01-F8 | Books could be written by anyone: `record_company_revenue` / `sync_company_revenue_logs` kept EXECUTE through PUBLIC (guests and signed-in fans wrote revenue rows in the replay); donation totals, Aura, sport settings and feedback triage were also open to guests | `RLS_SECURITY` with `LEDGER`, `ADMIN` | `20261013210000_function_access_hardening.sql` (written, not applied; **apply first on staging**) |
| DATA-01-F9 | A request with no JWT claims counted as the SQL Editor (`is_admin_or_db()`), and caps reading `auth.role() <> 'service_role'` skipped on NULL | `RLS_SECURITY` | Same migration: `is_trusted_server()` is the one server test, used by the admin guard, the function caps and the five cap CHECK constraints |
| DATA-01-F10 | Any parent-role account could read, insert, update or delete every family's payout rows (`disbursements`, which feed the books) | `RLS_SECURITY` with `CUSTODIAL`, `INTERNAL_CONTROLS` | `20261013220000_disbursements_guardian_scope.sql` (written, not applied) |

The migration `20261013120000_data_governance_closures.sql` is written and replayed (46/46), not applied:
until the owner applies it, those controls say "not switched on". Two items stay as recorded exceptions by
design: `operator_gigs` (parked with game-day gigs, Wave 3, owner launch order) and `ledger_accounts`
(seeded by its migration).

## Review of the closure pass (2026-10-13)

Independent review (RLS_SECURITY, QA) of the closures found one security blocker and four P2 defects; all fixed
and tested before hand-off:

- **Exact operator GPS was still readable straight from the table.** The migration now revokes table reads
  and updates from `anon` and `authenticated` and keeps an insert-only policy, so only the rounded admin list
  reads check-ins. Replay checks this.
- A panel could show the previous record's data after switching athlete or school. Panels are keyed by
  record and discard late responses (`AthleteRecordsPanel` test proves a slow response cannot land).
- Saving one branding colour wiped the others. Branding now prefills from the database and Save stays off
  until it has.
- Unverify had started unlinking the athlete. It is badge-only again; unlinking is the separate, warned
  "Revoke and unlink" (`PeopleTool.test.tsx`).
- The dead-export rule let some dead code pass (comments and import paths counted as uses). Fixed in the
  generator; the second archive pass followed.

Two unused locals sit in files under PLAY-01's open claim (`ReelCard` `hype`, two test bindings); they are
baselined with owners (`PLAYBACK`, `UPLOAD`) and removed when that claim is released.

## Merges (2026-10-13, owner: "merge similar functions into one")

`CODE_HYGIENE` reviewed the DATA-01 code and its neighbours for functions doing the same job:

| Was | Now | Why |
| --- | --- | --- |
| 12 copies of the "database function not applied yet" check, each with different codes and phrases (accountTags, adminControls, adminReports, bookkeeping, crew, custodial, donationThanks, leaderboards, payoutGate, photoStories, verification, plus the checkout's missing-column check) | `lib/dbErrors.ts`: `isMissingFunction`, `isMissingColumn`, `isMissingRelation` | One reading everywhere. The old phrase match on "schema cache" also matched a missing *column*, so a column error could pass as "not switched on"; the shared check no longer does. |
| Busy label + double-tap guard + notice + reload written out in the Stats, Branding/confirmers and Check-ins panels and the People desk | `hooks/useAdminAction.ts` | Same behaviour in every desk; People now shows errors in red and guards double taps (it had neither). |
| Game-log row mapping in `lib/athleteStats.ts` and again in `lib/adminControls.ts` | `mapGameLogs` in `data/athleteStats.ts` | The profile and the admin panel read a game line the same way. |
| Check-in deletes in the admin purge, plus a separate expiry planned for the trigger and the list | `expire_operator_checkins` (SQL) | One retention rule for the trigger, the admin list and the manual purge. |

Not merged, on purpose: `fetchAthleteStats` vs `fetchAthleteRecords` (public profile with demo fallbacks vs admin
read that must fail loudly); money formatters (each screen's rounding is a VOICE-reviewed display choice);
the two scripts' file walkers (different roots and filters). Remaining unclaimed copies: `lib/reels.ts`
(report fallback) is left for PLAY-01's open claim on Reels.

## What the map covers

Tables, views, database functions (with overloads), triggers, Storage buckets, published feature switches
and unused exports. Telemetry event keys stay with `TELEMETRY` (`eventLabels`) and the coverage map, which
already tie each fan control to its key.

## Limits of the generator

It matches patterns; it is not a compiler. A table or function name built at run time is invisible to
it unless the name appears as a string literal in a file that queries by variable (that case is
handled). Screens are traced through imports, following the exported symbol that holds the data call
and the exports in the same file that use it. A widely shared module can still make a screen list
longer than the real path. Bucket screen lists are broad because every upload goes through one shared helper
(`MediaUploadService`). A switch group read by key (`live.buttons[id]`) counts as reading every switch in it.
