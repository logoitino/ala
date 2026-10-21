<!-- Venue implementation claims and dated evidence; local preparation is separate from hosted activation. -->
# LOCAL-02 — Game venue details and directions

## Approved scope

Owner approved venue + directions on 2026-10-21. Public game page shows stadium/gym name,
venue school, full address, optional arrival/parking note and Get directions. iOS opens Apple Maps;
Android/web opens Google Maps via HTTPS. No address means no directions. Venue TBA remains readable.
Each game owns its location, including away/neutral games; no automatic home-campus inference.
No user GPS collection, coordinates, map SDK, new paid service or reusable venue catalog in this version.

## Assignment and shared claims

| Responsibility | Executor | Owned files | Status |
| --- | --- | --- | --- |
| Engineering integration / LOCAL + ADMIN implementation | Outside-session Codex root | GamesTool, adminCatalog, handwritten Game type, gameVenue helper/card, guest game route, coverage map, feature registry, data/privacy/detection maps, STATE/history/index | Local work complete; claim released 2026-10-21T22:11:29.802Z |
| BACKEND implementation and regression | Outside-session Codex venue_database | New migration, canonical schema append, generated DB types, replay, migrations README | Local work complete; claim released 2026-10-21T22:11:29.802Z |
| Independent Data/Security/SUPPORT/QA review | Outside-session Codex reviewer, assigned after source preparation | Read-only review of migration and app/admin boundary; root integrates findings | Accepted locally; dated evidence below |
| Documentation reconciliation | Outside-session Codex root, independently reviewed | This tracker and affected engineering docs/index/state/history | Accepted locally; dated evidence below |

These executors do not establish that pinned Cursor Grok specialist models ran. Existing department
ownership and review authority remain. Preserve concurrent GameCard/theme/Effects/Profile/Reels work.

## Baseline, alternatives and bounded experiment

Observed source: games.venue is a free-text name edited in /admin/games and shown on Local cards.
There is no game address, stadium school field or fan directions control. Operator check-in GPS
is a separate private minimized source and is never used for game locations.

Chosen first version: per-game public venue fields and external directions. Alternatives are an
embedded map preview or map-based discovery; both introduce integrations beyond this approved scope.
Success: admin save/edit/clear preserves game data, wrong actors cannot alter location, missing fields
remain readable, destinations encode only the chosen game address, and failed map opens keep the address.
Stop/repair: failed validation or unavailable schema blocks requested venue changes visibly; clear address
removes directions. A map handoff does not prove arrival or map-provider accuracy.

## Admin-first order

1. Enroll planned contract; implement SQL/types/admin save/edit/review/clear and safe failures.
2. Run admin regressions and local PostgreSQL authorization replay; retain actual evidence.
3. Independent boundary review, record admin-ready checkpoint, pass selected admin gate.
4. Implement fan card/helper and selected guest/Local route; test destination/missing/failure states.
5. Run selected app-ready gate, pnpm detection:scan and pnpm check; synchronize data/exit/source docs.

## SDK documentation exception

Exact Expo 58 website fetch was blocked by the session's disabled internet mode; knowledge_load,
Python urllib and curl failed. Owner explicitly approved using installed SDK 58 sources on this turn.
Read installed expo 58.0.14 and expo-linking declaration/source; preserve SDK 58 package versions.

## Verification and remaining work

Historical enrollment state: planning only. Actual commands, results, independent reviews and
readiness checkpoints are recorded below. Migration application, configured hosted denial/readback and physical
iOS/Android map launch are separate remaining owner/QA actions; no hosted write is authorized by this work.

## Admin/source verification — 2026-10-21 UTC

- Test-first data-layer baseline: 6 failed / 1 passed (missing venue payload/clear/bounds/schema handling).
- Test-first form baseline after correcting a test Router mock: 5 failed / 1 passed (missing fields/preservation/locks).
- Independent review found cross-game row-ID precedence, unchanged legacy-name normalization,
  and PostgREST zero-row success. Each was reproduced by a failing regression and repaired.
- Root executed `cd apps/mobile && ../../node_modules/.bin/jest --watchman=false --runInBand
  src/frontend/components/Admin/__tests__/GamesToolVenue.test.tsx
  src/frontend/lib/__tests__/gameVenueAdmin.test.ts
  src/frontend/components/Admin/__tests__/AccessRestricted.test.tsx`: **3 suites / 20 tests PASS**.
  Real admin controls/forms with mocked remote boundary; no configured hosted admin-browser save.
- Database executor and independent reviewer executed
  `node scripts/replay/game-venues-replay.mjs .claude/worktrees/fan-zone/.smoke/runtime/pglite-cache/package/dist`:
  **68/68 PASS**, PGlite 0.5.9 / PostgreSQL 18.6, full current canonical schema.
- `node scripts/gen-db-types.mjs .claude/worktrees/fan-zone/.smoke/runtime/pglite-cache/package/dist --check`:
  **exit 0**, 122 tables / 3 views / 539 functions / 541 signatures. Generated file refresh also
  reconciles stale existing canonical feature types; it is not additional feature implementation.
- Prerequisite: full schema initially failed near reserved `authorization` in two unapplied NOTIFY
  functions. Renamed only the local variable to `send_authorization` in migration + canonical;
  expression-for-expression behavior retained. Full canonical build now succeeds. No hosted SQL.
- Browser Bridge reached localhost:8091 but /admin/games resolved to the existing reporting/Studio
  context; no private game-edit access or hosted writes inferred. Component/SQL evidence remains
  the admin proof. Native map launch is still unrun.
- Current app typecheck revealed concurrent GameCard `StyleSheet.absoluteFillObject` incompatibility
  with installed RN 0.88; this is outside venue code and remains explicit until the full gate.

At this historical admin stage, independent verdict and selected gate were pending; the preserved
checkpoint below records their completion before fan implementation.

### Preserved admin checkpoint — 2026-10-21T21:50:36.398Z

Independent outside-session venue_review accepted Data/Security/SUPPORT/QA boundary, closing all
three findings. Its separate command `pnpm --filter @tapuai/mobile test -- --watchman=false
--runInBand gameVenueAdmin GamesToolVenue databaseDrift` passed 3 suites / 19 tests (includes
database drift; root 20-test command includes AccessRestricted instead). SQL replay and generated
types independently passed. Scoped local admin-ready only; hosted/device claims remain open.

Root claims only the RN0.88 compatibility line in concurrent GameCard fieldLayer: use the
installed typed StyleSheet.absoluteFill object. Preserve every other concurrent GameCard/style edit.

## Fan implementation and regression — 2026-10-21 UTC

Fan code began only after preserved admin-ready and selected gate PASS. `GameVenueCard` uses
per-game fields below the live banner; `gameVenue` builds fixed Apple/Google HTTPS destinations
and asks Expo Linking to open only on a tap. Unknown address removes the action; address stays
selectable after failure. Single-flight and venue/mount identity prevent duplicate launches and
stale error presentation. Only fixed tap/failure telemetry codes are recorded.

Independent reviewer found an overview/Realtime race: a slow old roster/feed response restored
an address after a newer live correction/clear. Both corrected/cleared cases first failed in
`GameVenueRoute.test.tsx`, then pass with a per-fetch live-revision guard. The guest page uses
its own full-row postgres_changes; new address fields need not enter scoreboard-only Broadcast.

Root fan+existing-scorecard command passed **4 suites / 26 tests**:
`cd apps/mobile && ../../node_modules/.bin/jest --watchman=false --runInBand
src/frontend/components/Local/__tests__/GameVenueRoute.test.tsx
src/frontend/components/Local/__tests__/GameVenueCard.test.tsx
src/frontend/lib/__tests__/gameVenue.test.ts
src/frontend/components/Local/__tests__/GameCard.test.tsx`.

The concurrent RN0.88 GameCard typing blocker was repaired only at the fieldLayer style constant
(`absoluteFillObject` -> installed typed `absoluteFill`); existing scoreboard regressions pass.
No concurrent sport-field/theme/profile/reel design was reverted.

## Current-component browser evidence — 2026-10-21 UTC

Browser Bridge rendered the current Metro `GameVenueCard` module in a temporary browser-only
React root on root-owned tab1335873168 at localhost:8091. Synthetic neutral game data, intercepted
map-launch boundary and memory-only telemetry prevented provider/hosted writes. This exercises
current component/chrome rendering; it is not a configured admin save or full game/device journey.

- Desktop540-point component: readable name/school/address/arrival note and directions.
- Deliberate390 and320-point component containers: long school/address/note wrap, no horizontal
  overflow; directions button measured44points high. Bridge reported390 viewport emulation but
  actual innerWidth stayed1720, so this evidence is container layout, not phone viewport acceptance.
- Actual DOM click with synthetic launch rejection: selectable address retained, readable failure;
  one fixed tap and one fixed issue trace, no address/note/URL in traces. Retry succeeded and cleared
  error. Address clear removed all action buttons and displayed Address TBA.
- Saved local proof: `/tmp/local02-venue-390.png`, `/tmp/local02-venue-320.png`,
  `/tmp/local02-venue-cleared.png`, `/tmp/local02-browser-failure-1.json`,
  `/tmp/local02-retry-proof.json`, `/tmp/local02-long-proof.json`, `/tmp/local02-clear-proof.json`.
  These temporary artifacts are not release evidence stored in versioned source.

Initial required source checks exposed missing Security partner coverage for new `game-directions`
and unknown detection area `local`. Registered existing SESSION_SECURITY/INFRA_SECURITY partners
and the supported `app` area; no operational acceptance, background monitor or new permission.
Full check/detection results and final independent docs verdict follow below.

## Independent final source/docs checkpoint — 2026-10-21T22:00:20.525Z

Outside-session venue_review accepted final source and documentation. Independently passed
Infrastructure Security11services/24components, detection26sensors (gaps explicit), infrastructure
register, preserved admin-ready, documentation links and diff checks. No further source finding.
Browser proof is limited to current component containers, synthetic map boundary and fixed-only
telemetry traces; configured admin and hosted/device acceptance remain unverified. Root restored
original browser module exports/telemetry, unmounted the fixture and removed synthetic data.

### App checkpoint — 2026-10-21T22:00:20.525Z

Current fan implementation, focused4suites/26tests and independent source/docs review accepted
locally. Preserved admin checkpoint remains2026-10-21T21:50:36.398Z. Registry moves to app-ready
using those actual results; selected gate execution and full scan result are recorded below.

## Full-scan regression repair

First retained scan `2026-10-21T21-59-22-340Z-18d80162-final` completed both checks: portal passed,
quality-gate failed at two Profile identity assertions (243suites/2,343tests passed;2failed).
Concurrent UX-08 intentionally replaced `#0` text with the real `0` jersey patch and explicit
`Jersey number 0` accessibility label. Root additionally claims only the ProfileHeroAvatar test
import/header/jersey assertions: assert rendered0 within the accessible patch, and absence of the
favorite athlete's patch on a community hero. Preserve all concurrent Profile/JerseyBadge design.
Systematic debugging traced the failure to that changed presentation contract; no product fix.
Selected app-ready gate passed on2026-10-21T22:00:20.525Z (19registered features); this certifies
local contract metadata/evidence only. Final repaired full scan follows.

Second full scan `2026-10-21T22-01-15-497Z-bfe140ca-final` stopped at mobile typecheck:
concurrent QR work added required nullable public `GiftLink.sport` after the previous typecheck.
Three older route fixtures omitted it. The concurrent owner updated those fixtures before root's
proposed patch applied (patch refused the changed context); root made no gift-route/test/source
change. Portal106tests passed. Final check reruns after current fixtures settle; preserve QR work.

Third retained scan `2026-10-21T22-02-26-395Z-68adc81f-final`: both app typechecks and all
244mobile suites/2,345tests pass; portal106/106 pass. Every intermediate quality gate through
22Infrastructure Security tests passed. Final Security source report became stale after concurrent
Spotlight/QR/UI edits, so the full command correctly stopped before exit freshness checks.
Root refreshes governed source awareness and reruns the required final whole-project command;
no failing feature test or operational acceptance is inferred from the stale report.

## Final whole-project gate — 2026-10-21T22:11:29.802Z

After a bounded local source-stability wait and source-map refresh, retained scan
`2026-10-21T22-08-16-184Z-7500029d-final` completed2026-10-21T22:10:45.271Z:

- `pnpm detection:scan`: **exit0**, complete, both checks passed, no skipped check, runtimeVerified=false.
- Scanner's actual `pnpm check`: **exit0**; both app typechecks, mobile Jest, generated facts/links,
  copy/comments, admin-first/data ownership, recovery/redundancy/support/security/exit gates pass.
  The bounded retained output clips initial test totals; the preceding complete mobile run records
  244suites/2,345tests PASS. No extra count or device acceptance is inferred from clipped logs.
- Admin portal tests: **106/106 PASS**. Fixed sensor gaps remain explicit, including hosted venue
  persistence/authorization, physical map launch/arrival and telemetry delivery.
- Source ensure: synced/sourceCurrent=true, captured2026-10-21T22:10:35.581Z, readyToCutOver=false,
  codeVerification=not-run; safe source hash
  `64914d2bcc99d3c6e73f51abfda7c2b7b24dd70cda812b9c6cfd52c8b4fed3a8`.
- Selected LOCAL-02 app-ready passed again after final evidence update; documentation links and
  diff checks also passed. Source Security/exit checks remain separate from hosted acceptance.

Local feature adopts the bounded venue/directions recommendation: admin-first guards, fan error/
missing-address behavior and source/docs review met success criteria. Embedded maps/catalog remain
future proposals. Released root/database source claims; no commit, push, hosted SQL or deployment.
Next: owner chooses/applies migration to the approved environment; LOCAL/ADMIN/QA verify actual
save/readback/denied writers and venue accuracy, then physical Apple/Google map destinations.
These steps are activation evidence, independent of local app-ready metadata and passing source gates.
