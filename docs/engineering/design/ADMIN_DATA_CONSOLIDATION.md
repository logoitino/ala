# Admin data consolidation and feature workflow

Date: 2026-10-12. Status: accepted locally; hosted data/device acceptance remains pending.

## Goal

Cross-check every Manage desk, including concurrent Books, against all twelve prior reports, remove duplicate dashboards,
retain complete analysis and editing actions, and require an admin contract for future features.

## Architecture

Expo `/admin` owns writes and the main reports. Existing routes remain valid. Related
editors share workspace navigation; reports own period-wide analysis. Chart Data is an
essential accessible alternative and remains complete. Next remains read-only.

## Tech stack

Expo 57, React Native / web, TypeScript, existing Supabase session, shared pure report models,
Jest, Browser Bridge with a separate synthetic backend. No new package or SQL.

## Global constraints

Preserve concurrent Books work and all payment/access/publish policies. Missing values
remain unknown. Distinct reporting windows, population definitions, source errors,
donation privacy, bounded record limits and corrective actions remain visible. No hosted
writes, publication, commits, staging or deployment. Work in the owner’s existing feature
workspace: a new checkout would separate active local edits from the requested portal.

## Data ownership map

| Manage desks | Primary analysis | Operational context retained |
| --- | --- | --- |
| Live games, Sports, Polls, Publish | Analytics → Live games | Match scores, scoring rules, votes, go-live readiness |
| Boosters | Revenue, Analytics → Live games | Sponsorship status, school and tier |
| Highlights, Moderation | Analytics → Highlights / Trust, Health | Per-clip evidence, report reasons/counts/relationship, moderation actions |
| Spotlight | Analytics → Highlights / Trust | Standings, pending tags, crown/override decisions |
| Drip, Locker Room | Revenue, Analytics → Donations / Live games | Inventory, goal target/raised/equipped and catalog controls |
| Payouts (`money`) | Revenue | Payout requests and confirmed status actions |
| Books | Books | Accounting journal, expenses, closes, liabilities and exports; separate from Revenue |
| Athletes, Schools, People | Audience, Product → People | Distinct roster, school and account permissions/verification controls |
| Feedback | Health, Departments → Support | Suggestions, status, note, path and apply handoff |
| Coverage | Product | Complete control registry, source flags, telemetry mapping, owner and app links |
| Features, Look, Catalogs, Lab | Product | One App setup workspace; structured or validated draft editors and explicit Publish |
| QA | Health | Incident dismissal, device-local queue and repair tools |
| Studio | Tools | Role/device previews |
| Saved Reports | Analytics | Compatibility redirect |

## Preservation findings

- All 64 known scalar measures and four raw seven-day series remain available in Analytics.
  Arbitrary returned numeric keys also remain visible in a collapsed raw-read catalog.
- Trends retains two prior-week and five rolling-day comparisons. Static rankings/counts
  use Analytics; Revenue retains its distinct fourteen-day donation source and reconciliation.
- Product owns nullable published flags; Profile renders six settings once with meanings.
- Health restores all thirteen legacy threshold checks and corrective links. Low stock gets
  an explicit independent read/error state rather than the legacy inbox’s zero fallback.
- Lab’s revenue/telemetry/inbox summary reads are removed. QA keeps incident actions and
  device queue; Coverage keeps the full control registry without another headline dashboard.
- Books is concurrently owned by Claude (BOOKS-01). Its migration is written but unapplied;
  this review does not certify accounting writes or alter those files.

## Implementation plan

1. Capture fresh baseline screenshots; add focused regressions for analysis preservation,
   missing states, board selection and workspace route/lens reachability. Observe failures.
2. Consolidate report builders/presentation. Restore nullable Health triage and stock reads;
   preserve every board, source, Data table, raw scalar and unique comparison.
3. Consolidate Manage workspaces and utility data. Preserve saved editors through subnav,
   clarify Payouts and Publish queue, remove Lab/QA duplicate reads, fix Coverage missing
   states and responsive moderation details. Verify existing actions remain reachable.
4. Delegate an independent future-feature workflow implementation: registry, validator,
   focused tests, agent instructions and template. Root owns package/check integration and
   shared docs. Review the implementation against actual registration/order limitations.
5. Run focused and complete gates; inspect paired before/after screenshots and desktop,
   tablet, phone and enlarged text. Update STATE, CHANGELOG, menu/task docs and this record
   with actual evidence and remaining hosted/device limits.

Execution uses the subagent-driven-development skill for independent workflow work;
root integrates and verifies UI work. Registry model pins and specialist approvals are
unchanged; Codex sessions are outside-session assistance, not pinned-role execution.


## Local implementation review

- The full saved-route inventory has 24 entries including concurrent Books and the
  Reports/Coverage redirects. Manage has 18 entries instead of 23; workspace tabs and
  original-name search preserve the original editor paths. Control map is report 13.
- Source reviewers accepted the preservation of all 64 cataloged measures and future
  scalar keys, four series, seven Trends comparisons, 13 Health checks, full control
  mappings, complete Revenue/privacy/reconciliation and department/API information.
- Review fixes cover exact stock counting, normalized runtime dirty/count parity,
  strict Lab feedback read errors, workspace/member search, Lab lens discovery and
  one shared telemetry reading per key with surface names. Missing flags are nullable.
- Fresh project gate: 96 suites / 611 mobile tests and 13 workflow tests; both app
  typechecks and all guards pass. Compatible Next model tests: 86 pass. The later
  Moderation description correction passed the same complete gate. Browser
  acceptance includes desktop, tablet, phone, enlarged text and workspace handoffs.
- The feature registry starts empty and is not retroactive readiness certification.
  The lead must check enrollment and actual evidence/order; the CLI checks declared
  records and local files. Future changes reuse existing controls/reports where suitable.

This is a source-contract and synthetic local data audit. Hosted database acceptance,
actual financial reconciliation, accounting/Books acceptance and installed native-device
interaction remain separate work. The local HTTP fixture does not emulate Realtime.


## Final acceptance evidence

- `pnpm check`: 96 suites / 611 mobile tests, 13 workflow tests, both typechecks and
  every project guard passed. Log: `.smoke/main-admin/consolidate-check-accepted.log`.
- Compatible Next: 86 tests passed; `.smoke/main-admin/consolidate-next-final.log`.
- Browser: 56 responsive reads at 1728/768/320px, including doubled CSS text on
  Health/Analytics/Control map/Lab/Moderation. No measured page/control overflow or
  clipped leaf text. `.smoke/main-admin/consolidate-layout-results.json`.
- 19 interaction checks passed with the final source. They cover 18 unique Manage
  entries, editor/workspace search, both workspaces, all eight complete boards/Data,
  physical Analytics arrow focus, all 13 Health checks/exact stock, 129 Control map
  rows, unique telemetry keys and 33 Profile mappings, saved redirects, Lab/invalid
  JSON, QA controls and restored Home. `.smoke/main-admin/consolidate-behavior-results.json`.
- The harness initially counted the global Open production app link in Control map
  app links; scoping to the actual panel corrected that assertion. Browser Bridge's
  repeated general marker clicks also missed their intended targets. A direct scoped
  Profile click was observed as trusted and selected 33 rows; unique markers were used
  for later controls. See `.smoke/main-admin/consolidate-click-trace.json`. This does
  not remove the earlier physical Data Enter/Home/End tool limitations.
- The root, moderation and workflow implementation claims are released after local
  integration. Existing model pins, owner approvals and concurrent Books scope are preserved.

Reviewed before/after captures and remaining limits are in
[MAIN_ADMIN_PORTAL](MAIN_ADMIN_PORTAL.md). No hosted financial/configuration/moderation
writes, SQL application, publication, package install, commit, merge or deployment occurred.


Final phone eye-test correction (2026-10-12): the JSON editor's `flex: 1` shrank its
column container and overlapped feedback despite passing width/clipping checks. A direct
sibling-position regression failed (feedback top 1506.5 before Save bottom 1560);
phone/tablet editors now keep natural height and do not shrink. The 320px regression
passes with feedback top 1621, 61px after Save. Desktop retains equal columns. The
complete project gate passes again (96 suites / 611 app tests, 13 workflow tests and
all guards). Additional desktop/tablet/phone/enlarged geometry evidence is saved in
`.smoke/main-admin/consolidate-lab-layout-final.json`. The first 56 responsive checks
remain width/control checks; sibling geometry and screenshot review complete the eye test.


Final local total: **60 responsive/geometry checks** (56 broad reads + four Lab
sibling-geometry checks), **19 interactions**, and **32 stable reviewed source hashes**.
Ordinary sample Home is restored with its heading at y=162 and no test iframe. Aggregate
evidence: `.smoke/main-admin/consolidate-acceptance.json`; reviewed captures are in
MAIN_ADMIN_PORTAL. This acceptance covers local source and fixtures.
