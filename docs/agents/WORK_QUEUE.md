# Specialist work queue

Last updated: 2026-10-13. Entry point: [STATE.md](../STATE.md). Owners and executable
instructions: [TEAMS.md](TEAMS.md), [TEAM_HIERARCHY.md](TEAM_HIERARCHY.md), and the agent registry.

An app fix is assigned by `CTO`. The CTO names one lead. That lead names one specialist.
The specialist reports to the lead. The lead reports the fix to the CTO. `VP_OPERATIONS` reports to the CTO, checks that each team is still doing its defined job, and updates roles, protocols, and this queue in the same turn they change. `QA` can reject the result.
The owner (`FACILITATOR`) still decides applying SQL, merging, live money, prices, and counsel.

## GROWTH-01 — Growth and Capacity Review (2026-10-13)

Owner-authorized operating setup uses **GROWTH_ANALYTICS as the single accountable packet
owner**, through MARKETING → CTO → owner. [The charter](../engineering/GROWTH_CAPACITY_REVIEW.md)
defines source/metric quality, review-only triggers, 30/90-day service forecasts, component
options and the first evidence-gap packet. Actual outside-session executors, paths/checks,
review results and claim release are in [GROWTH-01](GROWTH-01.md).

Current setup: charter, role/registry duties and team/priority routing documented. Baseline is
internal Wave 0, Stripe test mode and blocked payouts; hosted MAU/retention/conversion,
provider usage/invoices/limits and representative capacity are **unknown/unread**, not zero.
Reuse existing Analytics/Audience, Health/Support/QA and Finance & Books. No duplicate dashboard,
new metric collector, hosted reading, runtime change or scheduled worker is established here.
The owner selected an initial infrastructure ceiling of $50/month; no vendor/plan/purchase
is approved. Charter $40/$50 budget, verified 70%/85% quota and verified MAU 100/1,000/10,000
rules prompt quality checks and review, not automatic upgrades or accepted growth/capacity targets.

### Remaining evidence and decision work

These are next assignments/dependencies, not implemented measurements. Preparation proceeds
alongside the existing ranked HEALTH/security/recovery lanes below; this packet cannot close
or bypass their hosted, device, Finance, privacy, counsel or release gates.

| Sequence / work | Current result / dependency | Responsible contributor; next concrete check |
| --- | --- | --- |
| 1. Metric definitions and valid baseline | Existing record/event catalog and clip/donation prior-week pairs exist; unique MAU, retention, successful funnel and target contracts are missing | GROWTH_ANALYTICS with ANALYST, PRODUCT, DATA_GOVERNANCE and TELEMETRY/Privacy: review ID/source/window/mode/unit, qualifying action, lawful deduplication, numerator/denominator, cohort age/coverage and accepted target/date. Name the existing source or a separately reviewed measurement-scope task; do not invent active people from profile/tab counts |
| 2. Actual service costs and purchased limits | Selected ceiling is known; invoices/authorized usage, current price/credit-expiry, SKU/project/region and quota intervals are unread | COST_OPERATIONS through OPERATIONS with FINANCE_DATA/FPA/TREASURY/CFO: request authorized dated aggregate billing/usage/quote receipts, reconcile invoice vs Books and full cost completeness; calculate component 30/90-day low/baseline/high forecasts. No hosted access or purchase authorized by this row |
| 3. Representative runtime/capacity/recovery | Prior local tests and Health sensors are not production headroom, p95 or crash-free denominators; hosted/device/durable/database recovery remain open | RELIABILITY through SUPPORT/ENGINEERING with BACKEND/STORAGE/REALTIME/RECOVERY/QA: define authorized representative game-night workload, exact peak/limit/window and source coverage/loss; obtain actual runtime/load/recovery evidence within its assigned scope. Keep source capsule and database restore distinct |
| 4. Quality and independent acceptance | No verified threshold breach or vendor winner in current baseline; missing evidence blocks comparisons | DATA_GOVERNANCE/ANALYST verify environment, freshness, exclusions and comparable windows; Finance reconciles costs/income, Security/Privacy and QA review applicable negative/recovery tests. Record false positive/insufficient/confirmed with reviewer/date; urgent incidents use domain escalation immediately |
| 5. One costed recommendation and decision | Retain internal-testing setup while closing source gaps; no change approved | GROWTH_ANALYTICS integrates one versioned packet through MARKETING; CTO records keep/investigate/experiment/revise/change recommendation with equivalent quality, loaded costs, migration/rollback and gates. Owner approves/rejects/defers spending, service/data movement and release; name implementation owner only after decision |
| 6. Recurring receipts and follow-up | Weekly/on-receipt, monthly-invoice and confirmed-trigger duties documented; no scheduler installed | GROWTH_ANALYTICS records actual executor/date, source versions/windows, values/unknowns, reviews/CTO/owner result, next owner/review; DOCUMENTATION/VP reconcile affected handoffs/roles/priorities in the task ledger. Preserve old packet/target versions |

Coordination setup receipt: Codex `/root/team_coordination`, claim start
2026-10-14T01:57:17Z (2026-10-13 local), checked the charter, five roles, 106-role registry,
team routing and existing Analytics/Health/Books source boundaries. Changed duties and
remaining priorities are in the owned role/team/queue/plan paths; actual checks and review
close-out are recorded in GROWTH-01. No live measurement or hosted capacity claim follows
from local documentation checks. Next packet owner is GROWTH_ANALYTICS; missing source
owners are named above.

Coordination checks at 2026-10-14T02:02:41Z (2026-10-13 local): `pnpm agents:check`
passed (106 roles), `pnpm docs:links` passed (186 active Markdown files), and scoped
`git diff --check` passed. Baseline comparison preserved all 106 calls/role paths/departments/
leads/model pins and the five role frontmatter names/tools/force-default pins. Independent
Documentation disposition and final root integration/release are recorded in GROWTH-01.

**Video scalability follow-up:** [Hosting brief §11](../engineering/HOSTING_DECISION_BRIEF.md#11-video-scalability-team-review--2026-10-13)
integrates actual media/reliability and cost/operations reviews. Mux is a provisional first
technical experiment; Bunny and Cloudflare join the initial equivalent quote/capability
comparison and can become the first provider. Current terms/usage and dollar winner remain
unknown. COST_OPERATIONS/FPA supply quotes/workload/loaded costs; HIGHLIGHTS/PLAYBACK/UPLOAD/
STORAGE with RLS_SECURITY/Data/Privacy/QA/Recovery prepare SCALE-02 admin-first access, processing,
deletion and rollback verification. Implementation and host selection remain pending;
actual review receipts/claims are in the GROWTH-01 video follow-up.

### Standing joint checkpoint — next packet October 20, 2026

Follow [Growth charter §9](../engineering/GROWTH_CAPACITY_REVIEW.md#9-verification-consent-and-safe-engagement)
and [Verification, consent and safe growth](../legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md).
This is an authorized operating assignment; product options remain proposed and underlying
controls require their existing counsel/domain/hosted/device acceptance.

| Next owner | Concrete next evidence or decision |
| --- | --- |
| LEGAL / COMPLIANCE with counsel, Privacy and Minor Safety | Establish ages/jurisdictions; classify legal obligations versus processor/school/company choices; record approved alternatives, consent authority/text/withdrawal and exposure/retention exceptions |
| ENGINEERING with PROFILE/AUTH/ONBOARDING, BACKEND/Security and QA | Reconcile concurrent MINOR-01 client/server/signup/OAuth/unknown-age/invite/teen-confirmation behavior with its design; maintain regression evidence for repaired review-run typecheck failures (BirthMonth versus boolean and removed locked/fetchGuardianPrivacy/saveGuardianPrivacy references). The earlier root pnpm check exited 2 at mobile typecheck and skipped downstream checks (safe-growth-check.log); the fresh user-growth follow-up pnpm check exited 0 after concurrent MINOR repairs: 126 suites/905 tests, docs:check, 191 doc destinations, 106 roles and three registered features (user-growth-check.log). Root records this current local result in GROWTH-01; hosted/privacy/media/financial/device acceptance remains open. Verify supported states, age exclusion and residual-account recovery; do not infer current behavior from an older checkbox or an unapplied migration |
| CUSTODIAL / CONNECT / ATHLETE_VERIFICATION with Commerce/Finance and counsel | Resolve supervision versus payee authority, claim/consent linkage, school-independent approved alternatives, disputed links, exact provider readiness, settlement/held-money/refund and handover requirements |
| Privacy / Content Rights / Support with Legal and QA | Reconcile consent-copy promises with actual public roster/profile/content exposure, revocation and multiple-guardian behavior; define secure correction/dispute/appeal handling, response capacity and remaining media deletion/access work |
| GROWTH_ANALYTICS with ANALYST/Product, Support/Cost/Finance | Agree separate permitted-engagement and optional-setup funnels, safety/false-rejection/revocation measures, source/denominator/privacy acceptance and loaded 30/90-day manual-review costs; absent current values remain unknown |
| GROWTH_ANALYTICS → MARKETING → CTO → owner | Exchange Legal/Growth/Engineering findings before one packet; record common recommendation or disagreement, accepted lawful alternatives and domain/counsel controls, owner approve/reject/defer, implementation lead, rollback/stop criteria and next review |
| DOCUMENTATION / VP_OPERATIONS | Record actual execution/checks/gaps in GROWTH-01, reconcile affected duties/docs and release shared claims after root integration |

No new role, reporting/model pin, runtime collector, campaign, hosted operation or unattended
worker is established. These preparation duties do not close feature or release gates.

### User growth plans — fan/creator bridges and October 20 packet

[User growth plans](../product/USER_GROWTH_PLANS.md) and [Growth charter §10](../engineering/GROWTH_CAPACITY_REVIEW.md#10-growth-plans-for-every-user-type)
add next decisions within the existing Growth packet. Preserve prior guardian/school-independent
identity/payee/settlement/refund decisions and current MINOR integration gates above. These
bridges are proposals, not feature enrollment, hosted controls, new rewards or approved campaigns.

| Existing owner / decision lane | Next evidence or scoped proposal |
| --- | --- |
| GROWTH_ANALYTICS with Product/Research/Analyst/Data/Privacy | Supply every overlapping segment card: guest/fan/young fan/uploader/filmer/donor/athlete/guardian/school/booster/sponsor, gated operator and internal staff capacity. Define acquisition, first/repeat/cross-user value, qualifying outcome/window/denominator/overlap, baseline or missing source, capability gaps, action safeguards, loaded cost and next owner/decision. No invented rates or accepted targets |
| PRODUCT/ONBOARDING/DISCOVERY/CREW/ACTIVITY with Growth/Design/QA | Rehearse useful non-donating guest/fan/young-fan discovery/watch/save/cheer/follow paths and optional creation. Preserve supported casual video without athlete/payee/pro filmer status; retain age/action protections and photo/video differences |
| UPLOAD/PROFILE/ACCOUNT_TAGS with Backend/Security/Content Rights/QA | Clarify video Tag later's missing completion path and photo athlete requirement; propose authorized request/confirm retagging with no raw recipient reassignment, valid attribution history, decline/conflict/retry and rights/audience checks. No retag feature is claimed built |
| UPLOAD/STORAGE/Moderation/Support/Security/Recovery/QA under SCALE-02 | Propose private upload staging and authorized publish, durable operation/status recovery, rights-version preservation, orphan cleanup/metadata limits and owner/subject removal. Pending tag/review or local Hide does not protect/delete public bytes; admin-first enrollment and actual denial/recovery tests precede implementation acceptance |
| FILMER_REWARDS/LEADERBOARDS/Content Rights/Voice/Legal/Privacy/QA | Verify confirmed/nonremoved and self-award exclusions, truthful posted-by versus filmed-by, recognition/public alias permission and pending/error/unread stats. Compare proposed untagged recognition and reward reversal/appeal/manipulation controls; current Props/Aura are not promised for ineligible clips and no new rewards/cash are authorized |
| SHARING/PLAYBACK/CHECKOUT/Product/QA with Privacy/Commerce | Propose tested clip landing and recipient-specific app handoff with removed/private/unknown/unsupported states. Current gift landing opens a profile; web PaymentSheet is unavailable. Guest reach and authenticated counted views need separate definitions; no live web donation channel is claimed |
| Support/Cost Operations/Finance with Growth/Engineering | Forecast original/retried media, storage/delivery, moderation/appeal arrivals, handling/rework/backlog and loaded 30/90-day labor/provider costs; establish accepted scope/stop limits before an authorized pilot |
| GROWTH_ANALYTICS → MARKETING → CTO → owner | October 20 packet includes every plan's status/gap/next owner and two feasible exchanged options with Legal/domain/Finance/QA acceptance. Proposed 0–30/31–60/61–90 stages start from authorization; public/money/partner/later-wave gates govern expansion. Record actual execution, decision and follow-up in GROWTH-01 |

Do not recruit paid filmers/operators, send campaigns, pool family donations or make reach/rank
conditional on donations under this planning assignment. Future cash, paid sessions/matches,
operator work and new instrumentation retain existing separate approvals and feature workflows.

### Family-fun standing packet — focused brainstorming, October 20

[Family-fun playbook](../product/FAMILY_FUN_PLAYBOOK.md) and [Growth charter §11](../engineering/GROWTH_CAPACITY_REVIEW.md#11-family-fun-fan-recognition-and-voluntary-service)
extend the existing single packet and segment cards. The owner requests continued brainstorming
and selected fan voting chooses the winner, with separate badge/Aura and money earning paths. These are next evidence/design
assignments, not feature enrollment, public competition, service campaign or app implementation.
Prior guardian/identity/payee/settlement/refund decisions and public/later-wave gates remain open.

| Existing owner / decision lane | Next evidence or scoped proposal |
| --- | --- |
| GROWTH_ANALYTICS / PRODUCT / RESEARCH with MARKETING | Give each overlapping fan/family/friend segment free useful themes, accessible/newcomer actions and meaningful return/contribution; refine Fan Moment, Behind the Jersey and Serve Together with the owner-selected fan-ballot Game/Week award. Staff checks published eligibility/rights/safety; the entry with the most valid free ballots wins without a staff-preferred winner. Choose starter audience/age/place and staffing, then focused design; October 20 packet, authorization-relative stages only |
| FILMER_REWARDS / HIGHLIGHTS / SPOTLIGHT / AURA with Legal/Privacy/Minor Safety/QA | Define published free-entry eligibility/rights/safety, positive conduct/creativity/inclusion guidance, candidate/window limits, direct newcomers and ties/no-valid-result/ineligible-correction/appeal. Public candidate consent is per entry, without whole-profile publicity; declined exposure preserves private acknowledgment. Month/Year need bounded windows; staff does not choose a preferred winner. Existing athlete Spotlight/Aura are distinct; no spending/views/followers/athlete-stat vote points or cash entitlement |
| UPLOAD / HIGHLIGHTS / STORAGE / Backend / Security with Content Rights/Privacy/QA | Show actual ordinary-account video versus photo requirements, honest posted-by/camera credit, age/action/subject/mark/public candidate permissions and safe event/beneficiary metadata; decline preserves private acknowledgment, without whole-profile publicity. Propose restricted review/publish/status recovery, pause/close and full media removal against current public-byte gaps; pending tag is not private staging and no workflow is built here |
| LOCAL / POLLS / LEADERBOARDS / SCHOOL_PARTNERS with Backend/Security/Data/Privacy/QA | Separate informal cheers from later scored competition. Propose frozen eligible opt-in cohort, unique completers, comparable-size groups, contribution caps, small-cell/unranked safeguards, affiliation rules, lawful deduplication, server closure/pause/idempotency and abuse/correction/appeal. Also propose owner-selected award ballots: one free eligible-account ballot/window, lawful server eligibility/rate/duplicate checks, risk-proportionate abuse without blanket Stripe KYC, durable idempotency, closure/freeze and published ballot-change/tie/ineligible-correction/appeal/recount. Invalid outside votes do not automatically disqualify an entrant; investigate provenance and protect safety details. Disclose tie handling before opening; co-recognition is a proposed option. Balance candidate/newcomer discovery and similar school nomination opportunities, acknowledging fanbase/network advantage. One account does not prove one person; current guest/device/retry counts cannot select award winners or prove effective pause |
| PRODUCT / TRUST_SAFETY / MINOR_SAFETY / CONTENT_RIGHTS with Legal/School Partners/Support | Design optional safe service and nonidentifying reflections with accessible watching/learning alternatives. No adult-minor meetups, hazardous challenges, beneficiary identity/location proof or unverified-hours claims; service/posting remain voluntary before/after earnings and never conditions for payout/access |
| CFO / COMMERCE / LEGAL / COMPLIANCE / TAX with CUSTODIAL/CONNECT/Finance/School Partners | Keep existing eligible family donations distinct from proposed creator licensing/sponsored posts/paid service/prizes; select an actual model before payment design and examine age/guardian/contract/NIL/labor/tax/processor duties. No generic fan wallet, promised cash per upload/service pool or athlete-donation share is approved |
| SUPPORT / COST_OPERATIONS / Finance / Engineering with Growth/QA | Name curator, backup and independent appeal reviewer; forecast review/rework/appeal arrivals, ballot friction/retries/abuse, media delivery and loaded labor costs. Propose accepted queue/capacity/scope thresholds, pause authority, removal coverage and recovery before entries open; present source/window/denominator gaps without invented throughput or targets |
| GROWTH_ANALYTICS → MARKETING → CTO → owner; DOCUMENTATION / VP_OPERATIONS | Exchange actual domain findings before one October 20 packet with meaningful return/accepted contributions/newcomer access, permission refusals/exposure/removals, abuse/appeals/backlog/cost and separate voluntary donation/settlement measures. Record known/unknown, two feasible options/disagreements, focused brainstorming decision, next lead and actual receipt in GROWTH-01; no enrollment or implementation without the separate workflow |

Generic fan noncash recognition, voluntary service, trusted school scoring and money/paid work
remain separate proposals. New rewards and future Month/Year expansion require focused design,
admin/domain/counsel/Finance/QA acceptance and owner decisions; this table authorizes preparation.

Owner selection is settled: eligible entries compete by valid free fan ballots. The next
October 20 decision concerns candidate/publicity scope, ballot/window/abuse/tie/correction
rules and staffing for focused design. Staff may enforce published eligibility/rights/safety
with appeals; private acknowledgment is not an alternate staff-selected winner. Optional
consented invitations cannot buy votes or use spam/private messaging. No blanket voting KYC,
trusted-vote implementation, campaign or public award is established by these assignments.

## Current evaluation and improvement — HEALTH-01 (2026-10-13)

The owner asked to evaluate and improve all current tasks. Actual outside-session Codex
assignments, shared claims and source/check receipts are in [HEALTH-01](HEALTH-01.md).
Team coordination evaluated this queue and DEPARTMENT_PLANS; TELEMETRY repaired the existing logger;
root integrated QA/Security evidence and DOCUMENTATION corrected the affected handoff docs.
Coordination claim started 2026-10-14T00:35:02Z (2026-10-13 local). No role/model changes.

Baseline: the retained scan at 2026-10-13T21:46:50Z–21:48:04Z passed the local quality gate
(115 mobile suites /827 tests) and separate Next tests (86/86). Current-schema verification
is dated separately in HEALTH-01: the final frozen replay passed 35/35 after concurrent fixes.
There are 17 declared sensors, 14 partial/gaps. These checks precede HEALTH-01 repairs.
Each completion below is scoped to its evidence; a quiet sensor or green local gate does not
establish hosted/device health. The private full evaluation is retained at
`.smoke/support/health-task-evaluation.md`; check/close-out receipts are in HEALTH-01.

### Evaluation across existing current sections

| Queue section / work | Current evaluation | Next owner and concrete check |
| --- | --- | --- |
| COORD-01 / standing CTO assignments | Documentation/team reconciliation complete locally; ongoing duties run when assigned. ADM-01 re-review and photo-story source remain completed | Leads supply each new handoff; DOCUMENTATION/VP verify changed source/evidence and dated receipt |
| DETECT-01 / DETECT-02 | Scanner, Support desk, bounded SupportSignalManager, protected reviews and app containment complete locally. G3 legacy logger and QA source independence repairs are locally accepted (21 logger and 11 QA tests); G1/G2/G4/G5/G6 retain distinct gaps | SUPPORT/TELEMETRY/QA: preserve accepted cap/timeout/uncertainty/one-read reservations; verify hosted/device delivery and named remaining coverage |
| DATA-01 | Findings F1–F7 and archive/guard work complete locally. F8/function access hardening written, RLS_SECURITY approved (second pass after CHANGES NEEDED: service_role grants, final paid/failed payouts, Supabase default-grant replay) and replayed 35/35 (13/35 without); unapplied. F9 five-cap hardening verified in the same replay. F10 guardian payout scope fix approved by RLS_SECURITY, CUSTODIAL and INTERNAL_CONTROLS, unapplied; F10a live-payout approval/handover remains gated | Root current-source five-cap probe and schema 35/35 accepted; owner applies reviewed function hardening first, then BACKEND/RLS_SECURITY verifies wrong-role denial and trusted paths |
| BOOKS-01/02 | Hub, accounting review fixes, catalog/reconciliation and SQL replay 72/72 complete locally; finance acceptance, applied SQL and W0-10 remain distinct | CFO/CONTROLLER/FINANCE_DATA: supplied finance acceptance; owner/BACKEND/QA: staging application, real-admin read, practice close and sandbox CSV import |
| PLAY-01 / ENV-01/02 | ENV-01 launch repair complete locally. PLAY-01 frozen controller/SDK patch and local regression/export/lock checks exist; final browser, native playback, clean install and hosted media are unverified | PLAYBACK/QA: accepted/invalid local-media browsing and stale-source/view-time checks; RELEASE: clean locked install on capable machine; BACKEND/STORAGE: approved metadata/payload evidence before object repair |
| ADM-01/02, UX-01–04, UX-05a–d, BRAND-01, TOOL-01 | Listed local implementations/reviews complete; UX-05e fixture evidence is partial, TOOL-01 OAuth remains owner-dependent | QA/VISUAL_QA/DEVICE_QA: remaining live-photo, native picker/orientation/gesture and staff/data/write checks; owner: tooling sign-in and approved builds/SQL |
| W0-01–04 | Functional roster, guest-route boundary, account-tag helper and privacy corrections complete locally | Owners maintain these contracts; no blanket code restart. W0-03 local completion is prerequisite evidence for W0-08 SQL checks |
| W0-05–10 | Installed-build sign-in/checkout, Vault setup, operator/tag SQL, role device smoke and Books rehearsal pending their hosted/device/owner dependencies | RELEASE/DEVICE_QA identify build/project first; BACKEND/RLS_SECURITY execute authorized policy checks before users exercise changed SQL |
| R1 | R1-01 local organization complete; coordinated branch integration and private legal/company document home remain owner-dependent | Owner/RELEASE/CI: reviewed integration/remote CI; owner/COMPLIANCE/DOCUMENTATION: private location and approved reading subset |
| R2 | Full schema replay is useful local evidence; CLI layout/seed, authorized baseline/history and generated drift/reset acceptance remain unfinished | DATABASE_MIGRATIONS/BACKEND/SHARED_CONTRACTS/CI: versioned synthetic reset, baseline cutoff and auth/Storage/Realtime checks on capable environment |
| R3 / R4 | Production environment/pipeline gated on R2 and payment decisions. R4 local splits/tests are partial; operator debt remains two routes/seven direct calls | RELEASE/CI: environment-binding design; API/BACKEND: Edge secrets before route retirement; ENGINEERING: one bounded split/boundary regression at a time; no new dependency without available package source |
| Specialist backlog | Existing discovery, notification, schema, media, backup, cost, receipts/moderation/research functions retain bounded review work; completed Vault disclosure stays complete | Functional owner supplies one assigned failure/recovery or completeness check; RECOVERY separates source restore from approved database-backup drill |
| P1-01–08 / owner decisions / compliance | Public privacy/payments/sessions, CPA/counsel/consent/production gates remain pending. Rounded 30-day GPS retention implemented locally within broader P1-04; no new telemetry identity from HEALTH-01 | Relevant policy/finance/security lead prepares evidence; owner/counsel decide retention, payment routing, store treatment and release actions |
| Handoff / future feature acceptance / STANDARD-01 | Operating standards documented and locally accepted; no outside walkthrough or continuously running agent is established | Assigned leads review actual source/evidence and admin-before-app checkpoints; authorized outside reviewer records walkthrough separately |

### Ranked remaining work

The HEALTH-01 local repair lane is accepted. Remaining preparation can proceed within its assigned scope. Hosted, device and counsel lanes need
their stated dependency; listing a task does not authorize its external action.

| Rank | Work / status | Accountable owner | Next concrete check |
| --- | --- | --- | --- |
| 1 | HEALTH-01 / DETECT-01-G3 and QA source independence — local repair accepted | TELEMETRY with SUPPORT; ADMIN/QA | Full scan passed 117 app suites/859 tests and Next 86; logger 21/21 and QA 11/11, independent review accepted. Remaining G3 hosted/device delivery, durability and retention need separate evidence |
| 2 | Function access hardening / DATA-01-F8/F9 — local fix and review; hosted security dependency | Root Security / RLS_SECURITY; owner + BACKEND for application | Current frozen schema 35/35 and all five boundary expressions/client vs trusted paths passed; hashes/date and review accepted in HEALTH-01. Owner applies reviewed hardening before other October SQL; verify anon/fan denial and trusted/admin allowed paths afterward |
| 3 | PLAY-01 / ENV-02 — source implemented, acceptance incomplete | PLAYBACK/QA; BACKEND/STORAGE; RELEASE | Finish controlled local-media interaction and clean patch install; obtain authorized hosted metadata/payload evidence before proposing object repair |
| 4 | R2 and source/database recovery — local preparation with access/tooling dependencies | DATABASE_MIGRATIONS/BACKEND/SHARED_CONTRACTS/CI; RECOVERY | Establish synthetic Supabase reset and migration baseline; record auth/Storage policy checks. Rehearse approved database backup and deployed compatibility separately from existing source capsule |
| 5 | W0-06–08, UX-05a and DATA/Books/Support migration activation — hosted/owner dependency | Owner; BACKEND/RLS_SECURITY/STORAGE/domain owners | Ordered approved application and readback; concurrent account-tag cap/privacy checks, operator grants/retention, Vault entitlements, Support actor/review provenance |
| 6 | W0-10 / P1-08 finance rehearsal — SQL/owner/CPA dependencies | CFO/CONTROLLER/BOOKKEEPER/INTERNAL_CONTROLS/FINANCE_DATA; QA | Real-admin Books read, one practice month with Suspense zero, closed totals and QuickBooks sandbox import; tax/business decisions remain with owner/CPA |
| 7 | W0-05/09, UX-05e and remaining ADM/UX acceptance — actual build/device dependency | RELEASE/DEVICE_QA/QA and surface owners | Record build/project/version; test sign-in, picker/metadata orientation, gestures, single test-donation credit and staff controls on authorized staging |
| 8 | G1/G2/G4/G5/G6 and public design preparation — assigned local scope, hosted/finance/policy dependencies as noted | SUPPORT/RELIABILITY/API/RECONCILIATION/TEST_AUTOMATION/INCIDENT_TRIAGE and domain owners | One evidence-backed durable-intake, correlation, settlement, harness or linked-intake assignment; preserve P1 single-credit/consent constraints |
| 9 | R1-02/03, R3 and remaining P1/owner/counsel decisions — approval dependency | Owner, CFO/PRODUCT/LEGAL/COMPLIANCE/RELEASE | Approve coordinated branch/private sharing plan; decide family routing/fees/payee/consent/video host before production and live-money execution |

HEALTH-01 is **locally accepted**: logger 21/21, QA 11/11, independent review and full retained
scan pass 117 app suites/859 tests and Next 86/86 at 2026-10-14T00:58:02.345Z (2026-10-13 local). Source receipt records cap 120/batch 15/timeout 10s, safe
fixed-status counters, no replay of failed/uncertain attempted batches, retained unresolved
request capacity and no late-delivery claim. Disposal retains the inert singleton. Hosted/device
delivery and process-local volatility/per-row payload limits remain open. Older dates/results
below remain historical evidence with their original scope.

Coordination receipt: Codex `/root/team_coordination` updated WORK_QUEUE and
DEPARTMENT_PLANS from 62 current task IDs plus backlog, owner decisions and operating
sections. At 2026-10-14T00:52:27Z (2026-10-13 local): `pnpm agents:check` passed (106 roles),
`pnpm docs:links` passed (182 Markdown files), and scoped `git diff --check` passed.
Logger 21 and QA 11 have source-owner evidence and passed the final integrated scan. Root
accepted current-source Security proof (schema 35/35 and five cap boundaries), integrated
shared close-out and records final claim release in HEALTH-01. Hosted SQL/device/
durable recovery/counsel/owner gates remain assigned; no scheduler or release was started.

## Current Documentation and team-coordination checkpoint (COORD-01, 2026-10-13)

Owner requested active documentation and team upkeep. Actual Codex DOCUMENTATION synchronization
and VP_OPERATIONS reconciliation passes completed locally; root accepted and integrated both.
Fresh full gate passed after registry/Team flow regeneration: 115 suites /827 tests, 181 Markdown
destinations and 106 roles. Claims are released. Assignments, changes, checks and next owners are in
[COORD-01](COORD-01.md). Completed local admin/Support/standards work stays complete locally;
hosted/device/counsel/owner gates remain pending where their own evidence is absent.
Every applicable future handoff records both execution receipts and resolves required corrections
before completion. This checkpoint does not configure unattended/background agents.

## Current CTO assignment (2026-10-08; ADM-01 added 2026-10-11, updated 2026-10-12)

The build handed to the CTO is the local Wave 0 app, not a new feature.

| Lead | Assignment | Stop |
| --- | --- | --- |
| `QA` | UX-05e: fixture browser pass of the photo-story counter and dots (2026-10-09). Upload steps, tagline placements, live feed, and device paging are still open | Do not call the device pass done. A live feed shows photo stories only after the photo SQL is applied |
| `ENGINEERING` / `HIGHLIGHTS` | Photo-story prefetch and the owner peek card are already in the local tree | Do not reopen them |
| `BACKEND` | Photo-story, account-tag, public-sport, and operator-check-in SQL stay written only | Do not apply SQL unless the owner asks |
| `SECURITY` | Keep the named gaps visible: client `tips` insert, public profile fields, unapplied operator GPS policy | Do not "fix" those by opening RLS |
| `PRODUCT` | No new Later item (Drip fan tab, Aura-card signature, Hudl file import) | Wait for an owner ask |
| `ADMIN` | ADM-01 (2026-10-11): admin portal charts and dashboards, read-only, on the existing `get_admin_reports` / `get_company_revenue_summary` keys. DESIGN builds the chart kit first; PORTAL, ANALYST, ADMIN and COMMERCE then build their own pages. See the ADM-01 row below | No SQL, RPC, grant, new data key, route, write path or dependency. Status: **Done locally 2026-10-12, review accepted; waiting on the owner to commit and merge.** a–e and integration in `a5d0e8f`; fix waves 1–3, event labels and Codex's report format (owner's default on every page) local and uncommitted. Final review: VISUAL_QA ACCEPT, ACCESSIBILITY PASS, QA gates pass (`pnpm check` 443 tests, portal 80/80). P3s open: source/config keys outside Data disclosures (worst on Sign-in, `auth/page.tsx`); `LedgerTables.tsx:87` wrap pattern. Not verified: Enter on a `<summary>`, native devices, hosted data. Owner decisions 2026-10-12 (below): `bigint` overflow fix approved, migration written, staging application pending the owner's paste; Vault family account direction A, built after counsel with STATE §6 item 8; the all-time donation-total list (VOICE #26) is replaced by counts by band, no names (`donation_bands`, same migration; ADMIN and ANALYST switching Trends and Analytics). Nothing merged or deployed |

HEALTH-01 ranks the current evaluation/repair work above. The remaining UX-05e local browser check stays with `QA` → `VISUAL_QA`; device paging stays with `DEVICE_QA`. Older assignment dates do not reopen completed photo-story implementation or ADM-01 review.

Department plans (where each team is, and what it will do before public): [DEPARTMENT_PLANS.md](DEPARTMENT_PLANS.md). The VP of Operations updates that file when a priority moves.

This is the next execution sequence. A named owner owns the outcome and evidence; paired
specialists review their boundary. Staffing a role does not enable a deferred feature.
An agent definition is an instruction file, not a continuously running worker.

## Active Wave 0 work

### DETECT-01 — Engineering Support under Dev (owner request, 2026-10-13)

Owner → CTO → ENGINEERING → SUPPORT → INCIDENT_TRIAGE, TELEMETRY, RELIABILITY.
SUPPORT leads cross-system detection and repair pairing; QA and domain gates remain independent.
Tracker/shared-file claim: [DETECT-01.md](DETECT-01.md); handbook:
[ENGINEERING_SUPPORT.md](../engineering/ENGINEERING_SUPPORT.md). DETECT-01 established the local scanner;
DETECT-02 subsequently implemented the main-admin Support desk and bounded app capture.
Current local scan: 106 roles, 17 declared sensors (14 partial/gaps), 117 app suites /859 tests,
Next 86/86. Runtime remains unverified; earlier 115/827 baseline is retained in DETECT-02.
Use the current generated [DATA_MAP](../engineering/DATA_MAP.md) for inventory counts; local
function-hardening changes follow the earlier 159-function checkpoint.
Hosted delivery, durable fatal intake, device coverage and domain gaps remain open.

| ID | Primary detection owner / required pair | Work | Status |
| --- | --- | --- | --- |
| DETECT-01 | SUPPORT / ENGINEERING | Reuse four roles, sensor coverage map, retained local scan and lifecycle | Local scanner setup complete. Earlier 105-role scan retained in DETECT-01; its unfinished admin-control finding was resolved by DATA-01. Current local gates pass; hosted/runtime gaps remain explicit |
| DETECT-01-G1 | RELIABILITY / FULLSTACK, SESSION_SECURITY, QA | Shared sanitized app crash capture | Local containment and opt-in crash observation implemented in DETECT-02; durable hosted fatal intake and device validation remain open |
| DETECT-01-G2 | RELIABILITY / API, BACKEND, OPERATIONS, SECURITY | Backend failure capture, correlation and operator escalation | Authenticated bounded server capture built/replayed locally in DETECT-02; hosted delivery, correlation and escalation remain unverified |
| DETECT-01-G3 | TELEMETRY / RELIABILITY, BACKEND, PRIVACY_ENGINEERING | Sensor delivery/loss status, bounded queue/retry and retention | HEALTH-01 TelemetryManager repair locally verified: 120 total queued/unresolved rows, batch 15, timeout 10s, safe sampled getHealth and no attempted-batch replay. Focused 21/21 and QA 11/11 pass; independent review and full scan 117/859 plus Next 86 accepted locally. Hosted/device delivery and volatile durability/per-row payload limits remain explicit; SupportSignalManager bounds stay intact |
| DETECT-01-G4 | RECONCILIATION / LEDGER, BACKEND, FINANCE_DATA, INTERNAL_CONTROLS; CFO acceptance | Verified Stripe settlement/event alerts and one credit path | Open; no webhook crediting alongside client tips insert |
| DETECT-01-G5 | TEST_AUTOMATION / VISUAL_QA, ACCESSIBILITY, ADMIN, FULLSTACK, DEVICE_QA | Reusable synthetic visual/route/focus regression harness | Open; prior browser evidence does not establish scheduled coverage |
| DETECT-01-G6 | INCIDENT_TRIAGE / SUPPORT, ADMIN | Link safe duplicate user reports and runtime/check incidents | Successful feedback observation and runtime issue grouping built locally in DETECT-02, preserving originals; broader linked intake and hosted recurrence verification remain open |
| DETECT-01-I1 | ADMIN / DATA_GOVERNANCE, linked DATA-01-F1/F3/F4; SUPPORT follows integration | Earlier new adminControls exports had no callers (11 data-map findings) | Historical concurrent-build finding resolved: DATA-01 wired real consumers and regenerated the map; current full gate and data-map check pass. Original retained failed scan remains in DETECT-01; a new retained end-to-end scan is a separate SUPPORT action. **Rerun 2026-10-13 15:00 MDT: `detection:scan` passed end to end** (it first exposed a `code:unused` fail-open under `FORCE_COLOR`, fixed: tsc `--pretty false`, fail closed when the compiler does not finish) |

Shared document writers: read the current contents and this claim before editing. This task owns
role/reporting sync, detection scripts/catalog/docs, package/CI integration and status notes;
app, SQL, Finance and PLAY-01 sources remain with their active owners.


### DATA-01 — Data governance team and the master data map (owner request, 2026-10-13)

The owner asked for a team that checks where every piece of data goes, that it reaches the right
teams and functions, and that no dead data or code piles up, with every role knowing the control
person. Owner → `CTO` → `DATA_GOVERNANCE` (new lead, the data control point) → `DATA_LINEAGE`,
`CODE_HYGIENE`; `VP_OPERATIONS` added the control-point note to all 105 agent definitions and the
team documents. Map: [DATA_MAP.md](../engineering/DATA_MAP.md); handbook:
[DATA_GOVERNANCE.md](../engineering/DATA_GOVERNANCE.md); tracker: [DATA-01.md](DATA-01.md).

| ID | Owner (via lead) | Work | Status |
| --- | --- | --- | --- |
| DATA-01 | `DATA_GOVERNANCE`, `DATA_LINEAGE`, `CODE_HYGIENE` | Ownership registry, generator, `pnpm data:map:check` in `pnpm check` and CI | Done locally at the DATA-01 checkpoint: 53 tables/views, 4 buckets, 38 switches, 148 functions, 0 failures. Later Support/function changes are in the current generated map; original counts are history |
| DATA-01-F1 | `ATHLETE_STATS` → `PROFILE` | Career stats and game logs are read but nothing in the app writes them | Closed: Athletes desk Stats panel (migration not applied) |
| DATA-01-F2 | `NOTIFICATIONS` → `CREW` | Crew notifications are queued but never sent or cleared | Closed: Activity Crew alerts + clear (migration not applied) |
| DATA-01-F3 | `OPERATOR` + `PRIVACY_ENGINEERING` | Operator GPS check-ins are stored but never read | Closed: Live games desk reader; stored at ~1 km, removed after 30 days automatically (PRIVACY_ENGINEERING; migration not applied) |
| DATA-01-F4 | `ATHLETE_VERIFICATION`, `CUSTODIAL` | Verification revoke and custodial terms have no admin control | Closed: Schools / People / Athletes desk controls |
| DATA-01-F5 | `AURA` | `get_aura_tier` is never called | Closed: archived by migration |
| DATA-01-F7 | `PROFILE` | Look desk "Actions on top" switch did nothing | Closed: wired in AthleteProfileView |
| DATA-01-F8 | `RLS_SECURITY` → `LEDGER`, `ADMIN` | Guests and signed-in fans could write revenue rows into the books; guests could raise donation totals / Aura and change sport settings / triage feedback | Fixed locally: `20261013210000_function_access_hardening.sql`, schema replay 35/35 (13/35 without it); **owner applies first on staging** |
| DATA-01-F9 | `RLS_SECURITY` | Claimless requests counted as the SQL Editor; NULL-sensitive caps | Fixed locally in current function-hardening migration/canonical source: five caps use `is_trusted_server`. The older failure-before probe predates concurrent fixes and is not a current defect finding. Root post-fix/schema replay pending; migration remains unapplied |
| DATA-01-F10 | `CTO` → `SECURITY` → `RLS_SECURITY`; reviewers `CUSTODIAL`, `INTERNAL_CONTROLS` | Parents could read / write every family's payout rows (STATE §5 Wave 1 blocker) | Fixed locally: `20261013220000_disbursements_guardian_scope.sql` (+ paid payouts final), schema replay 35/35; CUSTODIAL + INTERNAL_CONTROLS approved; owner applies after `20261013210000` |
| DATA-01-F10a | `CUSTODIAL` + `INTERNAL_CONTROLS` → owner + payments counsel (STATE §6 item 8) | Before live payouts: tie each payout to an approved `custodial_withdrawals` row (refuse `paid` otherwise); two-person approval (who queues cannot mark paid); `custodial_role` should hide post-handover payouts from the guardian (all four custodial tables); record old / new amount and status in the audit trail | Open, gated on the live-money decision; not built in Wave 0 |
| DATA-01-F11 | `SECURITY` → `RLS_SECURITY` with `POLLS`, `LEADERBOARDS` | Before public beta: `cast_cheer_vote` (guest can create poll slugs and add / remove votes without limit) and `increment_player_hype` (guest can inflate counts that sway `sync_spotlight_period`) need a per-device / per-account limit or signed-in-only EXECUTE | Open; acceptable for Wave 0 internal testing (RLS_SECURITY 2026-10-13) |
| DATA-01-F6 | `CODE_HYGIENE` with each owner | 47 unused exports proposed for archive | Closed: 62 archived with tests in two passes (owner approved); 19 kept with reasons; `pnpm code:unused` guards new unused locals |

### BOOKS-02 — Finance and Accounting team, finance data and the Finance & Books hub (owner request, 2026-10-13)

The owner asked for a properly structured accounting and tax team that knows every expense and every
dollar of revenue, works with Finance, owns taxes, and has a dev-team member building its data, with
interfaces in the main admin. Chain of command used:

| Step | From → to | Work | Status |
| --- | --- | --- | --- |
| 1 | Owner → `CFO` | Stand up the Office of the CFO (CONTROLLER, BOOKKEEPER, INTERNAL_CONTROLS, TAX, INFO_RETURNS, SALES_TAX, TREASURY, FPA); `VP_OPERATIONS` synchronizes registry and team docs | Done locally; `agents:check` 102 agents |
| 2 | `CFO` → `CTO` (request) → `ENGINEERING` → `FINANCE_DATA` | Finance data catalog + schema coverage test; source-to-ledger reconciliation; filterable transactions; tax calendar and readiness; hub tabs; Finance lens | Built locally; `ADMIN` integration of nav/lens |
| 3 | `FINANCE_DATA` with `BACKEND`, `DATABASE_MIGRATIONS` | Replay the bookkeeping migration on Postgres | 72/72 on PGlite (Postgres 18.6) after review fixes |
| 4 | `RLS_SECURITY`, `CONTROLLER` + `TAX`, `QA` | Independent reviews of the migration, the accounting/tax rules and the hub | Done: security 0 blockers / 6 should-fix; accounting 2 blockers; QA 1 P1 / 6 P2 — all fixed and re-tested (BOOKS-01) |
| 5 | `CFO` | Finance acceptance of the hub and catalog | Ready for acceptance; `BOOKS-02` admin-ready in feature-admin.json |
| 6 | Owner | W0-10 rehearsal on staging ([packet](../engineering/BOOKS01_STAGING_REHEARSAL.md)) | Waiting on the owner to apply the migration |

Operating document: [FINANCE_OPERATIONS.md](../company/FINANCE_OPERATIONS.md). Tracker and evidence:
[BOOKS-01.md](BOOKS-01.md). Feature enrollment: `BOOKS-02` in [feature-admin.json](feature-admin.json).

### PLAY-01 — browsing error repair (owner screenshots, 2026-10-13)

`ENGINEERING` → `HIGHLIGHTS` → `PLAYBACK` owns rejected web-play promises and the
current-source/focus/lock lifecycle. QA verifies browsing with local media; dependency
compatibility and DOCUMENTATION review/integration are paired. Lightning CSS direct
and worker probes pass; do not reinstall or clear quarantine without failure evidence.
Status, claims and acceptance: [PLAY-01.md](PLAY-01.md). Hosted source metadata/object
repair (ENV-02) remains separately limited; no public-demo admin grant is implied.
HEALTH-01 evaluation: frozen source/controller/SDK patch implemented and locally checked
(3 suites /38 tests; earlier full gate 98 suites /646 tests, native exports and patch/lock
validation). Final browser interaction, device playback and complete clean install remain
unverified in PLAY-01; keep its existing claims until that owner supplies close-out.

### ADM-02 — unified main admin (owner request, 2026-10-12)

The owner selected the report portal shown at `http://localhost:3033/` and asked to
combine all app administration into that experience. Expo `/admin` becomes the main
portal with that report design, all reporting views and all existing editing desks.
Functional lead: `ENGINEERING` → `ADMIN`; paired `PORTAL`, `SHARED_CONTRACTS`, `ANALYST`,
`COMMERCE`, `DESIGN`, `ACCESSIBILITY`, `QA` and `DOCUMENTATION`.
Live claims, acceptance and actual evidence: [ADM-02.md](ADM-02.md).
Status: **complete locally**; 89 suites / 529 tests, 86 Next model tests, compatible
Next build, iOS/Android exports and desktop/phone report checks passed. Hosted admin
acceptance and native interaction remain pending; browser keyboard limits are explicit
in the tracker. Claims are released.
Existing migrations and release gates retain their recorded status.

### ENV-01 — local launch recovery (2026-10-12)

Functional routing at ENV-01 execution was `CTO` → `OPERATIONS` → `RELIABILITY`, with `QA` review and
`DOCUMENTATION` handoff. Current detection reporting is `CTO` → `ENGINEERING` → `SUPPORT` → `RELIABILITY` (DETECT-01). This recovery is an owner-authorized Codex outside session;
the registry's pinned Cursor agents were not executed or reassigned.

| Session | Claimed files / responsibility | Status |
| --- | --- | --- |
| Codex root | Local native dependency repair and Metro; STATE, WORK_QUEUE, TROUBLESHOOTING, AUDIT_REPORT | Released 2026-10-12; fresh web/server and iOS development bundles, browser shell, and `pnpm check` 78 suites / 443 tests passed |
| Codex profile_sport_stats | Native loader, installed binary and worker evidence | Read-only review complete; no files changed |
| Codex sports_accessibility_review | Launch context and repeatable diagnostic review | Read-only review complete; no files changed |
| Codex profile_creative_design | `.claude/agents/photo-stories.md`, TESTER_SCRIPT, PHOTO_STORIES_DESIGN, DATA_PRIVACY_MAP | Released 2026-10-12; published-story, video-tag and metadata descriptions reconciled; docs/links/agents checks passed |

Original photo-story work is present locally. UX-05e still owns browser/device acceptance;
written October migrations remain unapplied. This repair does not advance those gates.

**ENV-02 — follow-up for `BACKEND` / `STORAGE`, with `QA` review:** the settled browser
video fails before decoding (media error 4). Its exact legacy MP4 URL responds to HEAD
with 200 and `text/plain`; the current uploader specifies `video/mp4`. Confirm the
stored payload/container and metadata before preparing an object repair. This is a
separate media-source issue; no hosted object was changed during ENV-01. Evidence and
limits are recorded in AUDIT_REPORT. Device and photo-story acceptance remain open.

| ID | Owner and review | Task | Acceptance / evidence | Status |
| --- | --- | --- | --- | --- |
| ADM-01 | Lead `ADMIN`. a `DESIGN` + `ACCESSIBILITY`; b `PORTAL`; c `ANALYST`; d `ADMIN`; e `COMMERCE`; g `DOCUMENTATION`; h `VP_OPERATIONS`. `ACCESSIBILITY`, `DESIGN`, `VOICE`, `COMMERCE`/`BILLING`, `QA` + `VISUAL_QA` review | Admin portal charts and dashboards. **a** chart kit (`components/charts/*`, `lib/chartScale.ts` + test) and `globals.css` tokens (`--text-muted` contrast fix, `:focus-visible`); **b** Home, Audience, Health, Departments, Product and the shell (minutes on tab time, Game Day label, OperationsBoard tab semantics, `—` for a missing key); **c** `/analytics` eight dashboards on the kit; **d** Trends (`/reports`) and additive `REPORT_LABELS` in `lib/reports.ts` (minutes, `n%` scroll, 24 h pace row); **e** Revenue (`/money`); **f** reserved: a per-origin day chart needs a `lib/reports.ts` parse change, not this pass; **g** STATE §4, CHANGELOG, AUDIT_REPORT link; **h** registry `owns`: `components/charts` and `lib/chartScale.ts` (+ test) to `PORTAL` (`DESIGN` and `ACCESSIBILITY` review any prop or visual change), `components/revenue` to `COMMERCE` | Every chart names a key from the CTO's §0 contract; only clips and donations get a prior-week delta; missing ≠ zero; each chart has a figure, summary, and a Data table; no chart library, no new dependency, no write path, no new route. Each owner reports typecheck plus `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts` (baseline 15/15, Node version named). QA gate: portal typecheck and a real `next build`, `pnpm check`, docs/copy/comments/agents checks, grep proof of no new `rpc(`/writes, VISUAL_QA screenshots at 320/768/1280 and 200% zoom on the empty-state server and a fixture harness (no hosted data) | **Live status and resume steps: [ADM-01.md](ADM-01.md).** Assigned 2026-10-11. Baseline `c5a95a8`. Roles reconciled (Trends `ADMIN`, Revenue `COMMERCE`, admin.md auth paragraph). Status 2026-10-12 (from ADMIN's reports): a–e and g done locally (chart kit in `a5d0e8f`); integration done; Phase C review (`QA`, `VISUAL_QA`, `VOICE`, `ACCESSIBILITY`) in progress; f not this pass. h done 2026-10-12: chart kit owned by `PORTAL`, `components/revenue` by `COMMERCE` in registry, portal.md, commerce.md and TEAMS.md. Not merged, not deployed. **Update 2026-10-12:** Phase C review done (QA ACCEPT, VOICE changes, ACCESSIBILITY FAIL on small fixes, VISUAL_QA defects). Fix waves 1–3 done locally, uncommitted, portal tests 72/72. New shared modules (PORTAL): `lib/measureColors.ts` + test, one colour per measure, and `peakLabelAnchor` in `lib/chartScale.ts`; `lib/eventLabels.ts` + test (plain words for telemetry keys) is on disk and still being finished. Codex UI/UX follow-up: sticky header removed (WCAG 2.4.11), Community Impact Home built from an owner-selected Canva design, report format (wide header, underline tabs, open panels, report charts) being applied to every tab, adopted by owner decision as the default everywhere. **Status: Done locally 2026-10-12, review accepted; waiting on the owner to commit and merge.** `lib/eventLabels.ts` wired in; report format on every page; final browser review VISUAL_QA ACCEPT (after one P2 fix: Health counts split at 320px) and ACCESSIBILITY PASS; `pnpm check` 78 suites / 443 tests and portal 80/80 pass; STATE, CHANGELOG and AUDIT_REPORT updated. P3s open: source/config keys visible outside Data disclosures (worst on Sign-in, `auth/page.tsx`); `LedgerTables.tsx:87` detail values share the old wrap pattern (did not split). Not verified: Enter on a `<summary>`, native devices, hosted data. Owner decisions 2026-10-12: `get_admin_reports` `bigint` overflow approved (migration written; staging application pending the owner's paste); Vault money in the custodial family account, direction A, built after counsel with STATE §6 item 8; the all-time donation-total list (VOICE #26) replaced by counts by band, no names |
| UX-05a | `DATABASE_MIGRATIONS`, `BACKEND`; `RLS_SECURITY`, `STORAGE` review | Photo stories schema: `20261007230000_photo_stories.sql` (`reels.media_type`/`photo_count`, `reel_photos`, `set_reel_photos` RPC, `reel_photos_feed`, extended `reels_feed`) per [PHOTO_STORIES_DESIGN.md](../engineering/design/PHOTO_STORIES_DESIGN.md) | RLS on `reel_photos` with owner/admin select and no direct writes; RPC enforces caller = uploader, `photo_story` type, 1–10 items, anchored own-folder Storage paths, publish-once, descriptions ≤ 200; feed views gate `image_path`/`cover_path` like `video_url`; existing `reels_feed` columns unchanged in order; mirrored in `schema.sql`, `types/database.ts`, SCHEMA.md, migrations README with rollback; `pnpm docs:check`. Written ≠ applied: no hosted application without authorization | Complete locally 2026-10-07 (QA path/publish-once fixes included). SQL not applied. RLS replay pending |
| UX-05b | `PHOTO_STORIES`, `UPLOAD`; `CONTENT_RIGHTS`, `MINOR_SAFETY`, `ACCESSIBILITY` review | Photo story upload: Media `Video \| Photos` switch, pick/reorder/remove up to 10, per-photo descriptions, metadata stripping, Storage upload and `set_reel_photos` | Photos hidden when RPC/columns missing; ≥ 1 photo, caption, athlete tag, photo rights wording required; Vault hidden; `exif: false` + `stripJpegMetadata` unit tests prove GPS/EXIF/XMP removed and image data intact; `Uploading photo 2 of 5`; partial failure publishes nothing and retry keeps the draft; draft survives Back; 44-point labelled Move earlier/later; `movePhoto` and fallback tests pass | Complete locally 2026-10-07. Photos stay hidden until SQL is applied. Device picker/orientation pending |
| UX-05c | `HIGHLIGHTS`, `PLAYBACK`; `DESIGN`, `ACCESSIBILITY` review | Photo story feed, profile grid poster and the **Game Day** label (stored `game_play`) | `PhotoStoryMedia.tsx` replaces the video area for `isPhotoStory`; horizontal paging inside the vertical pager; `2 / 5` chip, dots and current description; per-photo labels/adjustable actions; photos load when current card; the pager prefetches the photo story immediately above and below; rail/donate/report/credit unchanged; 3-second view rule; missing columns treated as video; `TaggedReelGrid` uses `coverUrl` + `📷 n` (pair PROFILE); "Game Play" shown as "Game Day" everywhere with no data migration | Complete locally 2026-10-07 (Game Day label included). Neighbor photo stories are prefetched into the session cache. Device paging pending |
| UX-05d | `VOICE`, `MARKETING`; `LEGAL`, `PRIVACY_ENGINEERING`, `DOCUMENTATION` review | Photo story copy, legal and privacy documentation | `pnpm copy:check` clean; Donate-only money words on story cards; LEGAL row: "Elevate their opportunities" promises no recruiting/scholarship/exposure outcome; DATA_PRIVACY_MAP lists photos, per-photo descriptions and the metadata rule; GLOSSARY/TESTER_SCRIPT updated; generated facts and counsel conclusions untouched | Complete locally 2026-10-07 (LEGAL rows U–W). Nothing published externally |
| UX-05e | `QA`, `VISUAL_QA`, `DEVICE_QA` | Independent verification of UX-05a–d and BRAND-01 placements | Jest/typecheck/guards actually run; VISUAL_QA Playwright evidence on Expo web at narrow widths and large text (upload steps, reorder, progress, feed chip/dots, tagline placements) recorded in AUDIT_REPORT; DEVICE_QA native picker, orientation after stripping and paging on real devices or explicitly pending; unapplied migration reported as not verified | 2026-10-09: Jest 6 suites / 60 tests. Fixture browser pass of the feed counter and five dots at 320 and 375, including 320 at 200% CSS text; Next moves 1/5 to 2/5. Photo bitmap did not paint. Upload steps, reorder, progress, tagline placements, live feed, and device checks still open. SQL not applied |
| BRAND-01 | `BRAND`, `VOICE`; `LEGAL` review | Place the owner-approved message "Donate. Elevate. Celebrate." — *Support their journey. Elevate their opportunities. Celebrate their story.* | Exact wording in VOICE.md tagline section and the approved placements only: welcome overlay (`ONBOARDING`), donate sheet header (`CHECKOUT`), athlete profile donate area (`PROFILE`), STORY/PUBLIC and store copy (`STORE_LISTING.md`); no outcome promise; `pnpm copy:check` and `pnpm docs:check` pass; VOICE and LEGAL sign-off recorded; nothing published externally | Complete locally 2026-10-07 in the four approved placements. Not published to a store |
| TOOL-01 | `DESIGN_TOOLING`; `ENGINEERING` review | MCP tooling for UI/UX: project `.mcp.json` (Playwright, Expo, Canva, read-only Supabase dev) and user-level Figma, documented in [TOOLING.md](../engineering/TOOLING.md) | Each server's purpose, users and safety limits documented; Supabase pinned to development with `read_only=true`; no staging/production connection, write token or EAS build/submission without owner approval; Playwright evidence path (`.playwright-mcp/`, git-ignored) usable by VISUAL_QA | Configured locally; servers load on next Claude Code start in the repo; OAuth for Canva/Expo/Supabase pending owner sign-in |
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
| W0-08 | `ACCOUNT_TAGS`, `DATABASE_MIGRATIONS`, `RLS_SECURITY`, `TEST_AUTOMATION` | Validate and stage account-tag migration after W0-03 | Two-user pending/privacy/confirm/reject tests, wrong actor denied, parallel writes max 3, athlete remains donation recipient | W0-03 local helper/inbox/upload fix complete; two-user/concurrent-cap/privacy SQL execution and authorized staging application pending |
| W0-09 | `DEVICE_QA`, `QA`, feature owners | Run enabled-role device smoke | Android + registered iPad evidence for upload, rights/reports, donation, receipts, Rally/thanks, profile, retry; every P0/P1 assigned | Pending real devices; [TESTER_SCRIPT.md](../engineering/TESTER_SCRIPT.md) |
| W0-10 | `CONTROLLER`, `BOOKKEEPER`, `INTERNAL_CONTROLS` (Office of the CFO) with `FINANCE_DATA`, `DATABASE_MIGRATIONS`, `RLS_SECURITY`; owner applies SQL | Rehearse the Books desk on staging during testing (owner 2026-10-12: must be there for go-live) | `20261012210000_bookkeeping_ledger.sql` reviewed, replayed and applied to staging; a test donation with covered fee shows `card_fee` revenue and a `pi_…` id; one test month has Stripe fees recorded, Suspense zero, closed; daily QuickBooks file imported into a QuickBooks sandbox company without errors; `/admin/books` checked in the browser as a real admin | Built locally (BOOKS-01); migration not applied; recommended during Wave 0 because test mode costs nothing |

Phase 2 local gate passed 2026-10-10 (`pnpm check`, 72 suites / 414 tests). Run W0-05 through W0-09 on the current previews linked in STATE §0 and record the actual installed build. The October 11 night previews omit later Tag-later changes; the October 1 installs omit the subsequent UI work. Applying SQL,
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
| R2-01 | `DATABASE_MIGRATIONS`, `BACKEND`; `RLS_SECURITY` review | Supabase CLI layout: `config.toml`, synthetic `seed.sql` (Demo Fan, demo PIN, sample games/clips) | `supabase db reset` builds a working dev database from the repo alone | Not started; CLI not installable on the owner's Mac (run in CI or elsewhere). Seed rules and the E1 baseline / `migration repair` sequence: [ENVIRONMENTS_AND_HOSTING](../engineering/ENVIRONMENTS_AND_HOSTING.md) §3, §5 |
| R2-02 | `DATABASE_MIGRATIONS`, `RELEASE` | Authorized staging snapshot; baseline cutoff/replay and hosted history reconciliation plan; compare `schema.sql`; legacy SQL to `supabase/legacy/` | Snapshot-covered migrations are not replayed; auth/Storage/Realtime prerequisites documented; every difference resolved or listed; loose files archived with README (52 is the historical count); hosted history writes separately authorized | Not started; authorized database access and reconciliation review required |
| R2-03 | `SHARED_CONTRACTS`, `CI` | Generate `types/database.ts` and `schema.sql`; CI fails on drift; replay agreed baseline and later migrations in an isolated Supabase stack | Generated headers; drift check, clean `supabase db reset`, synthetic seed and auth/Storage policy checks green in CI; plain Postgres alone is insufficient | Not started |
| R3-01 | `RELEASE`, `FULLSTACK`; `SESSION_SECURITY` review | `app.config.ts` per `APP_ENV` (name, bundle ID, icon, scheme); EAS env vars per profile | Dev, preview and production builds install side by side and point at the right project | Not started. 2026-10-13: `EXPO_PUBLIC_APP_ENV` now set in every EAS profile (production builds hid nothing before; test `appEnv.test.ts`); bundle IDs are owner decisions (ENVIRONMENTS_AND_HOSTING §9) |
| R3-02 | Owner; `RELEASE`, `RLS_SECURITY`, `STORAGE`, `RECOVERY` | Production Supabase project with secrets, private buckets, backups and restore drill | Migrations applied by CI; no anon bypass or demo PIN; restore drill recorded | Gated on R2 and STATE §6 items 8–9 |
| R3-03 | `CI`, `RELEASE`, `RELIABILITY` | Deploy pipeline: `main` → staging, release tag → production; error monitoring | A tagged release reaches production with no manual SQL; errors visible per environment | Not started. Design approved 2026-10-13 (CTO + OPERATIONS reviews): ENVIRONMENTS_AND_HOSTING §4 (owner approves staging and prod deploys, function allowlist without `stripe-webhook`, dry-run before approval). PGlite schema and migration replays already run in CI |
| PRIV-01 | `PROFILE` (via ENGINEERING); reviews RLS_SECURITY, PRIVACY_ENGINEERING, MINOR_SAFETY, CUSTODIAL, HIGHLIGHTS, SPOTLIGHT, ACCOUNT_TAGS | Profile privacy, friends, blocking, hide from search, tag approval (guardian lock replaced by MINOR-01) | App-ready (feature-admin); stage 2 re-reviews applied; schema replay 100/100 | Owner applies `20261014090000` then `20261014100000`; PLAYBACK wires `tagState` in ReelCard when PLAY-01 releases it; counsel on LEGAL row Z; follow-ups: private avatar files, leaderboard speed |
| MINOR-01 | `PROFILE` (via ENGINEERING) with AUTH, ONBOARDING, CUSTODIAL; reviews MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, RLS_SECURITY, LEGAL | Minor accounts: birth month and year, teen defaults, guardian link + signed consent, supervision, under-16 approvals, under-13 closure | App-ready (feature-admin); design + SQL reviews applied; schema replay 100/100 | Owner applies `20261014110000` after the PRIV-01 files; counsel writes the consent form and answers LEGAL row AA (and F, Z); owner decides the optional 72-hour guardian wait / 7-day guardian account age; COMMERCE re-checks consent at transfer time when payouts are built; SUPPORT deletes listed under-13 sign-ins in Supabase |
| SCALE-01 | `SECURITY` → `SESSION_SECURITY`, `ADMIN` | MFA (`aal2`) on admin desks; MFA on Supabase / GitHub / Expo accounts; append-only audit log off the database host (HOSTING_DECISION_BRIEF §7.2) | Admin desks refuse a session without a second factor; tests | Not started; no MFA anywhere today |
| SCALE-02 | `HIGHLIGHTS` → `PLAYBACK`, `UPLOAD`, `STORAGE`; `BACKEND`, `RLS_SECURITY`, Data/Privacy/QA/Recovery review | Provider-neutral references and batched authorized signer; resumable/idempotent upload jobs and verified ready/error lifecycle; removal/visibility/deletion/legacy access and recovery handling (hosting brief §11) | Admin-first enrollment and handling; expand-only migration/old-client compatibility; actor/expiry/removed-state denials; duplicate/out-of-order provider events; actual native/web and media restore/rollback evidence | Implementation not started. Actual GROWTH-01 video review recommends Mux as provisional first experiment with Bunny/Cloudflare in initial comparison; terms/owner selection pending. Source-backed public-URL lock/removal and byte-purge caveats require domain review |
| SCALE-03 | `ENGINEERING` → `REALTIME`, `LOCAL` | `useLiveScores` onto a filtered per-game Broadcast topic carrying the change only (§7.5) | No full refetch per change; game-night load test | Not started; today every fan refetches every game on every score change |
| SCALE-04 | `COMMERCE` → `LEDGER`, `CONNECT`, `CHECKOUT`; `ENGINEERING` → `API` | One server runtime for money (shared `src/backend/api` handlers with Edge / Metro adapters, payout included); webhook-authoritative crediting; retire the client `tips` insert (§7.6) | Same handler code on every runtime; webhook tests | Gated with P1-05 / STATE §6 item 3 |
| SCALE-05 | `BACKEND` → `DATABASE_MIGRATIONS`; `DATA_GOVERNANCE` | Scale-safe schema pass: `(select auth.uid())` in policies, partitioned `reel_views` / `telemetry_logs`, `state_code` / `country_code` / `currency` (§7.7) | One expand-only migration; schema replay green | After R2 baseline |
| SCALE-06 | `SUPPORT` → `RELIABILITY`, `TELEMETRY`; `OPERATIONS` → `RECOVERY` | Restore drill into an isolated project; error monitoring, uptime check and status feed to a named phone; game-day runbook; telemetry off the main database by S2 (§7.8) | Drill recorded; alert reaches a phone | Needs hosted access |
| SCALE-07 | `CREW` → `NOTIFICATIONS` | Install `expo-notifications`; send the queued Crew alerts; store native tokens beside Expo tokens (§7.9) | A queued alert reaches a device | Not started; alerts are queued but never sent |
| SCALE-08 | `ADMIN` → `ANALYST`; `FINANCE_DATA` | Append-only journal / event export and daily rollups so a replica or warehouse is a pipe (§7.10) | Reports read rollups, not live tables | S2 trigger (ANALYST wants earlier) |
| R4-01 | `API`, `BACKEND`; `QA` review | Retire Expo API routes in `apps/mobile/src/backend/api/` in favour of the Edge Functions | Checkout, Connect and payouts work on every project with the routes removed; tests updated | Not started; confirm Edge Function secrets on each project first |
| R4-02 | `CI`, `ENGINEERING` | ESLint + Prettier enforced in CI | Config committed; CI lint step green; formatting PR is behaviour-free | Not started; needs a machine with npm registry access |
| R4-03 | `ENGINEERING`, feature owners; `TEST_AUTOMATION` | Split 900+ line files; route data debt to zero; screen tests for donate/upload/sign-in; admin-portal tests | One behaviour-free PR per split; `app:data-boundaries` baseline at 0; new suites green | Started 2026-10-10. Route debt is the two operator screens (7 calls). Athlete, parent, Profile, and the public athlete sheet moved into `lib/`. File splits and screen tests are still open |

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
| Backup and restore | `RECOVERY` | DETECT-02 source package/isolated restore verified for its captured version; next rehearse an approved synthetic database backup and deployed compatibility with stated RPO/RTO inputs; no uptime promise |
| Costs | `COST_OPERATIONS` | Estimate current storage/bandwidth/build use from verifiable inputs; no service purchase |
| Vault disclosure | `BILLING`, `VOICE`, `LEGAL` | Fan labels now match the one-time Exclusive charge. Upload and Vault copy name one-time Exclusive access and the price without `/mo`. Auto-renewal disclosure stays off |
| Gear goals and receipts | `WISHLIST`, `RECEIPTS` | Verify donation-linked totals and receipt state against test payments; ledger limitations explicit |
| Moderation and minor safety | `MODERATION`, `MINOR_SAFETY`, `CONTENT_RIGHTS` | Local Open flags columns show the report reason and whether an athlete or guardian reported the clip. Strikes and appeals are still unbuilt. Authorized review and escalation evidence before public video remain open. |
| Support and research | `SUPPORT`, `RESEARCH`, `MARKETING` | Prepare internal tester triage and consent-aware feedback plan; contact requires authorization |

## Scope next, before public release

| ID | Lead and review | Deliverable | Acceptance / dependency |
| --- | --- | --- | --- |
| P1-01 | `PRIVACY_ENGINEERING`, `BACKEND`, `FULLSTACK`, `LEGAL` | Account export/deletion design | Identity authorization, other people's clip/roster relationships, Stripe/Storage processing, financial retention and requester disclosure agreed before destructive implementation |
| P1-02 | `RLS_SECURITY`, `AUTH`, `PROFILE`, `PRIVACY_ENGINEERING` | Public profile field allowlist | All public readers mapped; owner/admin self-read preserved; sensitive fields unavailable through base table as well as view; staging authorization tests |
| P1-03 | `UPLOAD`, `STORAGE`, `PRIVACY_ENGINEERING` | Upload metadata removal plan | Photo/video GPS and EXIF inspected before/after; native/web paths and compression failures covered; approved fallback cannot expose raw metadata silently |
| P1-04 | `PRIVACY_ENGINEERING`, `OPERATOR`, `CUSTODIAL`, `ATHLETE_VERIFICATION` | GPS/verification/DOB retention and correction plan | DATA-01 rounded 30-day automatic GPS retention implemented locally (migration unapplied); broader verification/DOB purpose, correction/audit/deletion and counsel requirements remain to be agreed and verified |
| P1-05 | `LEDGER`, `CHECKOUT`, `RECONCILIATION`, `BACKEND`, `QA` | One authoritative payment credit path | Verified payment/replay/retry produces exactly one donation credit; client write retired in same rollout; reconciliation and rollback specified; do not deploy crediting independently |
| P1-06 | `SESSION_SECURITY`, `ADMIN`, `OPERATOR`, `RLS_SECURITY` | Real operator/Studio sessions | Every affected anon policy mapped and removed together with role-based clients; unauthorized RPC/table callers denied |
| P1-07 | `TELEMETRY`, `PRIVACY_ENGINEERING`, `BACKEND` | Telemetry identity implementation plan | Privacy disclosure and admin-only reads agreed before user/session identifiers are collected; bounded events and consent posture preserved |
| P1-08 | `CFO` with `CONTROLLER`, `TAX`, `TREASURY`; `FINANCE_DATA`, `LEDGER`, `COMMERCE`, `LEGAL`; owner | Books live with the first real dollar (ROADMAP Wave 1 checklist item 10) | W0-10 done; bookkeeping migration in the production project's migration set; business bank account, QuickBooks Online (or Wave) company with the Tapua'i chart of accounts, CPA engaged on BOOKKEEPING §8; then BOOKKEEPING §7 in order: Connect destination charges, webhook-verified fees/refunds (with P1-05), append-only revenue log, real Vault price and booster renewals, QuickBooks API push |

## Compliance routing note — 2026-10-10

What the app already does, and which team may do the next product work, is in [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) under "Compliance routing — 2026-10-10". That note does not finish counsel's documents. P1-01 and the owner decisions below stay open. No new task id.

## Decisions held with the owner

| Decision | Preparing team | Required decision / evidence |
| --- | --- | --- |
| Family payment routing and guardian handover | Finance, custodial, Legal | Destination-charge vs platform ledger model; state age rules; verified approvals and Stripe mechanics |
| Held donation cap/refund window | Finance, Trust & Safety, Legal | Cap/window and refund authority; ledger design |
| App Store donation/fee treatment | Finance, Legal, Release | Counsel disposition on disclosed 90 / 10 and optional tip; approved implementation before live money |
| Video host | Media, Reliability, Finance; GROWTH_ANALYTICS integrates one packet | Mux/Cloudflare/Bunny comparison at the same workload, quality, access/recovery and full cost; current quote/allowance evidence required. Mux is a provisional technical experiment, not a selected host. Owner selects; GROWTH-01 video follow-up records the actual review |
| Apple wallet and iPhone distribution | Release, Checkout | Merchant ID/certificate and device registration controlled by account owner |
| Public safety/consent process | Trust & Safety, Legal, Partnerships | Human moderation, school/association permissions, minor consent and escalation contacts |
| Admin reports overflow fix (ADM-01, 2026-10-12) | Database (`BACKEND`, `DATABASE_MIGRATIONS`), Security | `get_admin_reports` `sum(duration_ms)::int` overflows past about 596 hours of tab time in a window and fails every portal page. Fix is a `bigint` cast in a new migration. **Approved 2026-10-12; migration written; staging application pending the owner's paste.** `supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql` (`DATABASE_MIGRATIONS`) also adds `donation_bands`, the counts by band (no names) that replace the all-time donation-total list (VOICE #26, owner 2026-10-12). The owner applies it on staging (`tucioqipfejqqqtuakdi`) through the SQL Editor; this Mac has no database credentials. Not applied anywhere yet |
| Vault money and the family account (ADM-01, 2026-10-12) | Finance (`COMMERCE`, `CUSTODIAL`, `LEDGER`), Legal | The ledger records the Vault 80% for the athlete (`payee_kind` `athlete`), but `get_custodial_summary` sums only `tips`, so it never reaches the custodial family account. Copy says "recorded for the athlete" until it is built. **Direction chosen: A; build after counsel with item 8** (owner 2026-10-12): Vault/Exclusive money is treated like donations, credited to the same custodial family account under the same guardian rules. Nothing is built in Wave 0 (test mode); finalised with STATE §6 item 8 when the owner meets payments counsel |

Drip activation, filmer cash, fan signatures, free-text athlete/fan messaging, paid sessions,
game-day gigs and savings custody remain in their recorded later waves. Their specialists can
prepare scoped reviews; implementation starts only when that item is authorized.

## Handoff format

Use `ID`, lead, paired reviewer, paths, acceptance, current evidence, and next action when
dispatching. Before editing shared files, agree on ownership and claim them in the task tracker's Status table; release the claim when done. Another tool's session (Codex, Cursor, a person) may be editing the same tree: check file times before each edit, never revert its work without the owner, and ask the owner when two sessions hold conflicting instructions (TEAMS.md, Specialist operating contract, item 10). Each result states exactly what
was tested, what remains unverified, and whether it is merely written or actually applied.
`QA` owns the final release gate; department completion does not override it.

## Future feature acceptance

All future feature assignments follow [FEATURE_ADMIN_WORKFLOW](../engineering/FEATURE_ADMIN_WORKFLOW.md).
Enroll with [FEATURE_ADMIN_TEMPLATE](FEATURE_ADMIN_TEMPLATE.md), assign one owner and
reviewers, and reuse canonical admin/report surfaces. Source, admin actions, reporting,
access/privacy and disable/repair handling are verified before app implementation. The
selected `admin-ready` gate precedes app work; `app-ready` follows app verification with
the earlier checkpoint preserved. Presentation-only exemptions need the recorded reason,
reviewer and evidence. Ordinary repairs keep the fix process unless adding a capability.
`pnpm check` validates registered contracts and workflow tests; leads must catch missing
enrollment and review actual evidence. These local checks do not apply SQL or certify
hosted/device/release readiness. Existing role/model pins and release owners are unchanged.

## DETECT-02 — Engineering Support console

Owner: ADMIN under ENGINEERING; SUPPORT coordinates INCIDENT_TRIAGE, TELEMETRY and
RELIABILITY; SECURITY assigns THREAT_DETECTION, SESSION_SECURITY and RLS_SECURITY;
RECOVERY/RELEASE/QA and financial source owners review their controls.
See [execution ledger](DETECT-02.md) and [design](../engineering/design/ENGINEERING_SUPPORT_CONSOLE.md).
Acceptance: bounded main-admin issue review, actual source/team diagram, server change audit,
protected independent reviews, inert-to-enabled runtime sensors after admin checkpoint, verified
source packages and isolated restores. Local migration/replay only; hosted activation and database
restore/deployment remain owner-gated. No automated financial or authorization mutations.
Current status: complete locally, admin-ready before app-ready; 115 suites /827 tests,
Next 86, SQL 144 and recovery 10 checks passed. The final 997-file source capsule was verified
and restored separately before STANDARD-01/COORD-01; it does not certify later source,
hosted activation, database backups, deployment compatibility or devices. HEALTH-01 repairs
the separate legacy TelemetryManager and QA observation paths without reopening this build.

## STANDARD-01 — Innovation and outside handoff

Owner-requested 2026-10-13; root Codex owns this documentation integration under the existing
Engineering/Documentation contracts. Standard: [INNOVATION_AND_HANDOFF](../engineering/INNOVATION_AND_HANDOFF.md).
Acceptance: observed/hypothesized struggles, bounded experiment and decision evidence, familiar
module/interface standards, admin-first integration and audience-scoped engineering/legal/investor
reading paths. Status/evidence and shared-file claims live in that document. No runtime, schema,
role/model, release, business fact or approved legal conclusion changes are part of this task.
Current status: documentation implemented and accepted locally (115 suites /827 tests and
read-only documentation review; claims released). Outside-company walkthroughs remain
unperformed, with authorized audience and owner sharing decisions still required.


## Current FUN-01 / QUIZ-01 implementation handoff — 2026-10-14

Owner authorized the recommended local build and added weekly Sport Pop Quiz. Earlier
brainstorming sections remain dated history. Current source and actual evidence are in
[FUN-01](FUN-01.md) and [QUIZ-01](QUIZ-01.md), in the isolated codex/fan-zone checkout.
Corrected Fan admin has actual admin-ready at 2026-10-14T13:42:36Z and Quiz at 2026-10-14T06:09:57Z, both before participant source. Fan caller correction 070a58b independently passes specification/quality and local Data/Safety/SUPPORT with 35 focused tests; separate private video has 13. Quiz participant/discovery reviews pass with 23 and 44 focused tests. Shared Fan integration 8179b7b preserves private guardian recovery independently of participation dismissal; final affected checks pass 53 tests plus one coverage test and mobile typecheck. Shared Fan consumer review independently passes at 8179b7b; full check passes 148 suites/1,146 assertions and all guards; independent whole-branch/Data/Safety/SUPPORT and actual Documentation/VP scope reviews PASS; selected local Fan app-ready passes at metadata date 2026-10-14T14:49:04Z, after admin. Final status continuation is retained. Owner now selects 30-second timed trivia with a longer accessible option. Existing Quiz source is untimed; [timed design proposal](../engineering/design/TIMED_TRIVIA_PROPOSAL.md) requires owner review and new admin handling before runtime changes.

POLLS with ADMIN/UPLOAD/BACKEND owns operational source; Content/VOICE verifies sport facts
and contextual wording. Data/Safety/SUPPORT independently checks ownership, privacy,
corrections, removal and stop controls before expansion; QA reviews visible behavior and
actual gates. PRODUCT/RESEARCH and Growth include casual fans, filmers, athletes, families,
friends, guardians and optional personal learning by donor/booster/sponsor/staff/operator
accounts, without institutional privileges. Private Sport Learner completion badges are
separate from Aura, earnings, public ranking, fan ballots and voluntary service.

GROWTH_ANALYTICS gathers the October20 evidence packet: optional engagement/return,
onboarding friction, corrections/support burden and operational capacity; unknown real
measurements stay unknown. DOCUMENTATION/VP_OPERATIONS records actual executors, source
checks and next owners. Wider audience, hosted release, money/service expansion and counsel
decisions retain their existing gates; no new spending, scheduler or external outreach.
