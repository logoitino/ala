# Specialist work queue

Last updated: 2026-10-07. Entry point: [STATE.md](STATE.md). Owners and executable
instructions: [TEAMS.md](TEAMS.md), [TEAM_HIERARCHY.md](TEAM_HIERARCHY.md), and the agent registry.

This is the next execution sequence. A named owner owns the outcome and evidence; paired
specialists review their boundary. Staffing a role does not enable a deferred feature.
An agent definition is an instruction file, not a continuously running worker.

## Active Wave 0 work

| ID | Owner and review | Task | Acceptance / evidence | Status |
| --- | --- | --- | --- | --- |
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
| W0-09 | `DEVICE_QA`, `QA`, feature owners | Run enabled-role device smoke | Android + registered iPad evidence for upload, rights/reports, donation, receipts, Rally/thanks, profile, retry; every P0/P1 assigned | Pending real devices; [TESTER_SCRIPT.md](TESTER_SCRIPT.md) |

Do W0-05 through W0-09 on staging with the applicable account/device access. Applying SQL,
changing hosted configuration, publishing a build, and live money have distinct gates; a local
passing Jest run does not certify any of them. Current build links are in STATE §0.

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
