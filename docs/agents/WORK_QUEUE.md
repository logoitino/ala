# Specialist work queue

Last updated: 2026-10-07. Entry point: [STATE.md](../STATE.md). Owners and executable
instructions: [TEAMS.md](TEAMS.md), [TEAM_HIERARCHY.md](TEAM_HIERARCHY.md), and the agent registry.

This is the next execution sequence. A named owner owns the outcome and evidence; paired
specialists review their boundary. Staffing a role does not enable a deferred feature.
An agent definition is an instruction file, not a continuously running worker.

## Active Wave 0 work

| ID | Owner and review | Task | Acceptance / evidence | Status |
| --- | --- | --- | --- | --- |
| UX-03 | `LOCAL`, `PROFILE`, `HIGHLIGHTS`, `DESIGN`, `DOCUMENTATION`; `ACCESSIBILITY`, `QA`, `DEVICE_QA` review | Strengthen sports identity across game cards, profile hero and Highlight overlays | Scores tied to full team names; scheduled/final states beat stale clocks; missing values not invented; known athlete credentials only; community credentials hidden; confirmed crests preserved; profile/reaction/donation actions retained | Complete locally: `pnpm check` passes both typechecks, 53 suites / 256 tests and all guards; 17 targeted Local/Profile/Reel/banner tests; QA boundary fixes verified; web export passes (52 static / 3 API). Browser follow-up: 55 suites / 261 tests; identity/crest/spoken-school/close regressions fixed; controlled narrow/large-text browser checks and fixes recorded in AUDIT_REPORT. Native readers/text scaling/playback-paging gestures and hosted verification pending |
| UX-04 | `PROFILE` primary; `ATHLETE_STATS`, `AURA`, `DESIGN`, `DOCUMENTATION`; `QA`, `ACCESSIBILITY`, `VOICE` review | Match sport stats/Aura and compact owner/public navigation | One sport/playbook, honest missing data; direct Goals/Team/Manage, exact ownership, stale navigation guarded; hidden schools retained | Implemented locally; final evidence in AUDIT_REPORT. Public sport migration prepared, unapplied. Native and PostgreSQL/hosted replay pending |
| UX-02 | `CHECKOUT`, `DESIGN`, `UPLOAD`, `DOCUMENTATION`; `VOICE`, `ACCESSIBILITY`, `QA`, `DEVICE_QA` review | Compact Donate in one popup; playful Daylight upload/menu/page consistency; synchronize every team handoff | Amount/Options/Review; fixed navigation; choices preserved on Back; explicit totals/split/No tip default; final-action-only payment; no duplicate/dismissal during payment or payment during close; successful payment terminal on recording failure; old recipient completion/callbacks suppressed; exact fee accessible label; shared coverage inventory and device gaps recorded | Complete locally: full Jest 50 suites / 242 tests; latest checkout guard 8 targeted tests; both app typechecks pass; four review findings addressed. Native visual/accessibility/payment, hosted and build verification pending |
| UX-01 | `UPLOAD`, `DESIGN`, `ACCESSIBILITY`, `QA` | Replace long upload form with compact video/details/review steps and optional settings | Fixed header/footer; draft preserved on Back; picker cancel harmless; athlete/caption/rights required; optional tags/game/Vault retained; no duplicate publish; screen/keyboard device checks explicitly recorded | Complete locally: 7 upload scenarios; 47 suites / 228 tests and mobile typecheck pass; native/keyboard checks pending |
| W0-01 | `PRODUCT`, `ENGINEERING`, `CI`, `QA` | Expand functional ownership, agent definitions and hierarchy; validate registry in CI | 83 registry calls have files, valid reporting leads, existing ownership paths and matching team document entries; semantic ownership independently reviewed | Complete locally; registry and ownership review passed |
| W0-02 | `LOCAL`, `FULLSTACK`, `REALTIME`, `QA` | Remove direct database access from guest game/player routes | Route exceptions fall from 8 to 6; preserve match/feed errors and cached roster fallback; late live joins stop after cleanup | Complete locally; route/data-layer regressions and final checks pass |
| W0-03 | `ACCOUNT_TAGS`, `UPLOAD`, `BACKEND`, `RLS_SECURITY`, `QA` | Repair account-tag reliability before applying its October SQL | Real attach failures distinguished from missing SQL; failed confirmation remains pending; no false success for stale/wrong actor; concurrent tags serialized to max 3 | Complete locally; helper/inbox/upload regressions pass; SQL concurrency/RLS execution pending |
| W0-04 | `PRIVACY_ENGINEERING`, `CUSTODIAL`, `COMPLIANCE`, `QA` | Correct privacy inventory and historical readiness claims | DOB exception, custodial records, mentions, reports and school contacts listed; recorded staging readiness separated from fresh verification | Corrected locally; no remote verification |
| W0-05 | `AUTH`, `RELEASE`, `CHECKOUT`, `DEVICE_QA` | Verify installed-build staging sign-in and test checkout | Identify build/project; email callback returns signed in; test donation records once using current client credit path; no live-money assertion | Ready for staged device run; hosted config not checked this session |
| W0-06 | `STORAGE`, `VAULT`, `DATABASE_MIGRATIONS`, `RLS_SECURITY`, `QA` | Review and prepare private Vault bucket setup | Private bucket and correct policy/dependency order; uploader/entitled viewer allowed, unrelated account denied; public uploads still work | Staging bucket recorded missing; setup not applied |
| W0-07 | `DATABASE_MIGRATIONS`, `OPERATOR`, `RLS_SECURITY`, `QA` | Validate operator check-in role policy migration | Signed-in fan denied GPS reads/inserts; operator/admin allowed; anon demo exception explicitly internal-only; rollback verified | `20261002120000` written, not applied; SQL execution pending |
| W0-08 | `ACCOUNT_TAGS`, `DATABASE_MIGRATIONS`, `RLS_SECURITY`, `TEST_AUTOMATION` | Validate and stage account-tag migration after W0-03 | Two-user pending/privacy/confirm/reject tests, wrong actor denied, parallel writes max 3, athlete remains donation recipient | Local fix first; database execution pending |
| W0-09 | `DEVICE_QA`, `QA`, feature owners | Run enabled-role device smoke | Android + registered iPad evidence for upload, rights/reports, donation, receipts, Rally/thanks, profile, retry; every P0/P1 assigned | Pending real devices; [TESTER_SCRIPT.md](../engineering/TESTER_SCRIPT.md) |

Do W0-05 through W0-09 on staging with the applicable account/device access. Applying SQL,
changing hosted configuration, publishing a build, and live money have distinct gates; a local
passing Jest run does not certify any of them. Current build links are in STATE §0.

## Engineering readiness (R1–R4)

The plan and its checklists live in
[CODE_ORGANIZATION_PLAN.md](../engineering/CODE_ORGANIZATION_PLAN.md). These are not the product
phases in ROADMAP. R3 (production) waits on R2 and on the Wave 1 owner decisions.

| ID | Owner and review | Task | Acceptance / evidence | Status |
| --- | --- | --- | --- | --- |
| R1-01 | `ENGINEERING`, `DOCUMENTATION`; `QA` review | Repo and docs tidy for outside engineers | Topic commits; clutter in `archive/`; docs in engineering/product/legal/company/agents with 0 broken links; README, docs index, GLOSSARY, ONBOARDING start-here; `pnpm check` | Done locally 2026-10-07; `pnpm check` passes |
| R1-02 | Owner; `RELEASE`, `CI` | Merge `wave0-custodial-verification` into `main`, push, protect `main` | PR merged with CI green; `main` requires PR + passing checks; no direct pushes | Needs owner approval and GitHub access |
| R1-03 | Owner; `COMPLIANCE`, `DOCUMENTATION` | Move `docs/legal/` and `docs/company/` to a private location before outside access | Folders replaced by a pointer README; links updated; `pnpm check` passes | Waiting on owner choice of location |
| R2-01 | `DATABASE_MIGRATIONS`, `BACKEND`; `RLS_SECURITY` review | Supabase CLI layout: `config.toml`, synthetic `seed.sql` (Demo Fan, demo PIN, sample games/clips) | `supabase db reset` builds a working dev database from the repo alone | Not started; CLI not installable on the owner's Mac (run in CI or elsewhere) |
| R2-02 | `DATABASE_MIGRATIONS`, `RELEASE` | Authorized staging snapshot; baseline cutoff/replay and hosted history reconciliation plan; compare `schema.sql`; legacy SQL to `supabase/legacy/` | Snapshot-covered migrations are not replayed; auth/Storage/Realtime prerequisites documented; every difference resolved or listed; loose files archived with README (52 is the historical count); hosted history writes separately authorized | Not started; authorized database access and reconciliation review required |
| R2-03 | `SHARED_CONTRACTS`, `CI` | Generate `types/database.ts` and `schema.sql`; CI fails on drift; replay agreed baseline and later migrations in an isolated Supabase stack | Generated headers; drift check, clean `supabase db reset`, synthetic seed and auth/Storage policy checks green in CI; plain Postgres alone is insufficient | Not started |
| R3-01 | `RELEASE`, `FULLSTACK`; `SESSION_SECURITY` review | `app.config.ts` per `APP_ENV` (name, bundle ID, icon, scheme); EAS env vars per profile | Dev, preview and production builds install side by side and point at the right project | Not started |
| R3-02 | Owner; `RELEASE`, `RLS_SECURITY`, `STORAGE`, `RECOVERY` | Production Supabase project with secrets, private buckets, backups and restore drill | Migrations applied by CI; no anon bypass or demo PIN; restore drill recorded | Gated on R2 and STATE §6 items 8–9 |
| R3-03 | `CI`, `RELEASE`, `RELIABILITY` | Deploy pipeline: `main` → staging, release tag → production; error monitoring | A tagged release reaches production with no manual SQL; errors visible per environment | Not started |
| R4-01 | `API`, `BACKEND`; `QA` review | Retire Expo API routes in `apps/mobile/src/backend/api/` in favour of the Edge Functions | Checkout, Connect and payouts work on every project with the routes removed; tests updated | Not started; confirm Edge Function secrets on each project first |
| R4-02 | `CI`, `ENGINEERING` | ESLint + Prettier enforced in CI | Config committed; CI lint step green; formatting PR is behaviour-free | Not started; needs a machine with npm registry access |
| R4-03 | `ENGINEERING`, feature owners; `TEST_AUTOMATION` | Split 900+ line files; route data debt to zero; screen tests for donate/upload/sign-in; admin-portal tests | One behaviour-free PR per split; `app:data-boundaries` baseline at 0; new suites green | Not started (debt 6 files / 12 calls) |

### Organization review evidence — 2026-10-07

- Tracked active Markdown relative file links resolve (0 broken links). Workspace/build paths
  exclude `archive/`; setup and phase instructions were reconciled with the current code.
- Expo web export passed locally with `EXPO_NO_DOTENV=1`: 52 static routes and 3 API routes.
- Separate iOS/Android one-worker exports passed with Hermes bytecode (8.2 MB / 8.4 MB);
  signed native binaries and device interaction are not verified by those exports.
- Next optimized build passed locally for all routes. These are local build checks; hosted
  credentials, installed-build sign-in, native layouts and test-payment acceptance remain pending.
- Final `pnpm check` passed both app typechecks, 50 suites / 242 tests and all guards,
  including `docs:links` and `security:client-keys`; both new guards also rejected invalid fixtures.
- Next sequence: finish/review R1 locally, prepare the R2 baseline and clean replay plan, then
  R3 after its owner/Wave 1 gates. Independent R4 splits/tests may accompany R2.

## Specialist backlog beyond the immediate sequence

| Function | Accountable specialist | Next bounded assignment |
| --- | --- | --- |
| Search and low-view discovery | `DISCOVERY` | Verify existing query/filter empty/error behavior; low-view lane remains later |
| Notification queue | `NOTIFICATIONS` | Inventory `crew_push_queue` producers/consumers and delivery guarantees; do not add unsolicited messaging |
| Shared schema contracts | `SHARED_CONTRACTS` | Map manually maintained types to current RPCs and prepare generation check without pretending a live dump exists |
| Video/feed performance | `MOBILE_PERFORMANCE`, `PLAYBACK` | Capture real-device load, player teardown, dropped frames and memory for enabled feed |
| Backup and restore | `RECOVERY` | Prepare staging restore drill using synthetic data and explicit RPO/RTO targets; no uptime promise |
| Costs | `COST_OPERATIONS` | Estimate current storage/bandwidth/build use from verifiable inputs; no service purchase |
| Vault disclosure | `BILLING`, `VOICE`, `LEGAL` | Existing upload Vault copy says monthly access while current product docs describe one-time Exclusive; reconcile separately before pricing copy changes |
| Gear goals and receipts | `WISHLIST`, `RECEIPTS` | Verify donation-linked totals and receipt state against test payments; ledger limitations explicit |
| Moderation and minor safety | `MODERATION`, `MINOR_SAFETY`, `CONTENT_RIGHTS` | Review report thresholds, authorized review and escalation evidence before public video |
| Support and research | `SUPPORT`, `RESEARCH`, `MARKETING` | Prepare internal tester triage and consent-aware feedback plan; contact requires authorization |

## Scope next, before public release

| ID | Lead and review | Deliverable | Acceptance / dependency |
| --- | --- | --- | --- |
| P1-01 | `PRIVACY_ENGINEERING`, `BACKEND`, `FULLSTACK`, `LEGAL` | Account export/deletion design | Identity authorization, other people's clip/roster relationships, Stripe/Storage processing, financial retention and requester disclosure agreed before destructive implementation |
| P1-02 | `RLS_SECURITY`, `AUTH`, `PROFILE`, `PRIVACY_ENGINEERING` | Public profile field allowlist | All public readers mapped; owner/admin self-read preserved; sensitive fields unavailable through base table as well as view; staging authorization tests |
| P1-03 | `UPLOAD`, `STORAGE`, `PRIVACY_ENGINEERING` | Upload metadata removal plan | Photo/video GPS and EXIF inspected before/after; native/web paths and compression failures covered; approved fallback cannot expose raw metadata silently |
| P1-04 | `PRIVACY_ENGINEERING`, `OPERATOR`, `CUSTODIAL`, `ATHLETE_VERIFICATION` | GPS/verification/DOB retention and correction plan | Purpose, duration, authorized correction, audit record and deletion schedule assigned; counsel reviews requirements |
| P1-05 | `LEDGER`, `CHECKOUT`, `RECONCILIATION`, `BACKEND`, `QA` | One authoritative payment credit path | Verified payment/replay/retry produces exactly one donation credit; client write retired in same rollout; reconciliation and rollback specified; do not deploy crediting independently |
| P1-06 | `SESSION_SECURITY`, `ADMIN`, `OPERATOR`, `RLS_SECURITY` | Real operator/Studio sessions | Every affected anon policy mapped and removed together with role-based clients; unauthorized RPC/table callers denied |
| P1-07 | `TELEMETRY`, `PRIVACY_ENGINEERING`, `BACKEND` | Telemetry identity implementation plan | Privacy disclosure and admin-only reads agreed before user/session identifiers are collected; bounded events and consent posture preserved |

## Decisions held with the owner

| Decision | Preparing team | Required decision / evidence |
| --- | --- | --- |
| Family payment routing and guardian handover | Finance, custodial, Legal | Destination-charge vs platform ledger model; state age rules; verified approvals and Stripe mechanics |
| Held donation cap/refund window | Finance, Trust & Safety, Legal | Cap/window and refund authority; ledger design |
| App Store donation/fee treatment | Finance, Legal, Release | Counsel disposition on disclosed 90 / 10 and optional tip; approved implementation before live money |
| Video host | Media, Reliability, Finance | Mux/Cloudflare comparison using actual playback/entitlement/bandwidth requirements; owner selects |
| Apple wallet and iPhone distribution | Release, Checkout | Merchant ID/certificate and device registration controlled by account owner |
| Public safety/consent process | Trust & Safety, Legal, Partnerships | Human moderation, school/association permissions, minor consent and escalation contacts |

Drip activation, filmer cash, fan signatures, free-text athlete/fan messaging, paid sessions,
game-day gigs and savings custody remain in their recorded later waves. Their specialists can
prepare scoped reviews; implementation starts only when that item is authorized.

## Handoff format

Use `ID`, lead, paired reviewer, paths, acceptance, current evidence, and next action when
dispatching. Before editing shared files, agree on ownership. Each result states exactly what
was tested, what remains unverified, and whether it is merely written or actually applied.
`QA` owns the final release gate; department completion does not override it.
