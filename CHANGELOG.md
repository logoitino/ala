<!-- Dated release copy records preserve older financial terminology as history. -->
## 2026-11-08 — UI density + content triage

- ~12% denser type/padding tokens (`TYPE`, `space`, sheet radii); Local + upload flow first; fan tabs follow.
- Upload details: sport/game/mentions behind More options; athlete tag stays on the main path.
- See [DENSITY_AUDIT.md](docs/engineering/design/DENSITY_AUDIT.md). Gift/checkout out of scope.

## 2026-11-04 — Lovable brand EAS preview FINISHED ($0 Free)

- Android APK `d77f53d4` and iOS IPA `a4d637f8` from `main` `a38cb44` (preview profile).

## 2026-11-04 — Lovable whole-app tab / sheet sweep

- Jade sheet washes and tab accents across fan + role surfaces; Spotlight gold awards kept; Beyond KitButton.

## 2026-11-04 — Splash + brand lockup finish (Lovable sample)

- Expo splash replaced with Lovable brand; Soft-Wall / age / admin use BrandMark; Local cyan→jade.

## 2026-11-04 — Lovable EAS preview FINISHED ($0 Free)

- Android APK `8e0237fb` and iOS IPA `bf9b8567` from `main` `248a5e6` (preview profile).

## 2026-11-04 — Teams synced to Lovable UI/UX standard

- TEAMS / Design / Portal / Accessibility / Admin / MENU_STYLE_MAP / SYSTEM_OVERVIEW updated to
  [LOVABLE_UI_UX_PLAN](docs/engineering/design/LOVABLE_UI_UX_PLAN.md) after the Claude rollout on main.

## 2026-11-04 — App readiness priority; Exit on backburner

- STATE §0 / WORK_QUEUE: APP-TEST A–C is the active queue; Exit same-turn currency only.
- #27 squash-merged to `main` (layers tip, weekly prune, Exit upload soft-fail).

## 2026-11-04 — Portable Exit upload best-effort under Actions quota

- `exit-release.yml` upload `continue-on-error`; verify-code remains the workflow fail gate.
- Workflow test asserts the soft upload.

## 2026-11-04 — Weekly schedule for Prune Exit Source Artifacts

- Cron Sundays 06:17 UTC keep-3 plus existing owner `workflow_dispatch`; infra register role text.

## 2026-11-03 — Android preview `03e28f4e` finished ($0 Free)

- EAS Android preview APK ready; record in STATE / OWNER_ACTIONS_1_5.

## 2026-11-03 — Exit map + security:infra after layers CI tip

- Announce exit plan `f13c2b1a644c` and refresh infrastructure Security report after #27’s
  `ci-checks.yml` / `BUILD_LAYERS` change.

## 2026-11-03 — BUILD_LAYERS currency without volatile git tip

- Stop embedding commit/branch in generated `BUILD_LAYERS.md` (broke Portable Exit `layers:check`
  after every merge). Run `pnpm layers:check` in Team Quality Checks.

## 2026-11-03 — Refresh security:infra / exit map after retention-test tip

- Tip CI stale after `exit-workflow` assertion change; regenerate report and announce exit plan.

## 2026-11-03 — Exit workflow test matches 7-day artifact retention

- Update `scripts/__tests__/exit-workflow.test.mjs` after exit-source `retention-days` 30→7.

## 2026-11-03 — Claim prune-exit-artifacts.yml in infrastructure register

- Tip CI failed `infra:register:check` after the prune workflow landed; claim it under
  `github-actions` in `docs/engineering/infrastructure.json`.

## 2026-11-03 — Owner leftovers 1–5: prune workflow + Android EAS handoff

- Add `Prune Exit Source Artifacts` workflow; shorten exit-source artifact retention to 7 days.
- Owner checklist: [docs/engineering/OWNER_ACTIONS_1_5.md](docs/engineering/OWNER_ACTIONS_1_5.md).
- Android EAS preview `03e28f4e` submitted after Free quota reset window.

## 2026-10-31 — Recovery capsule allows ARCHITECTURE_SYNC build-layers JSON

- Allowlist `docs/engineering/build-layers.json` and `build-layers.baseline.json` in
  `scripts/recovery-capsule.mjs` so Portable Exit packaging accepts the new map files.

## 2026-10-31 — Main stack land + CI gate regen; APP-TEST A–C next

- Soft-Wall #12, ARCHITECTURE_SYNC #17, Jev #18, HS+college #19, reviewer #20 on `main`.
- Regenerate `supportTopology.json` (`ARCHITECTURE_SYNC`) and `BUILD_LAYERS.md` for tip gates.
- STATE §0 / WORK_QUEUE: APP-TEST-01 lanes A–C are the next priority; webhook tip crediting stays off.

## 2026-10-28 — Reviewer readiness (docs / SQL layout only)

- `docs/REVIEWER_START_HERE.md` for outside engineers; STATE §0 one page; prior §0 log →
  `docs/engineering/STATE_LOG_ARCHIVE.md`.
- 52 loose `supabase/*.sql` → `supabase/legacy/` (reference); `config.toml` + fake `seed.sql`.
- AGENTS component folder listing deduped; folder READMEs + README VOICE #5; R1/R2/R4 checklist
  evidence in CODE_ORGANIZATION_PLAN. No app behavior change.

## 2026-10-28 — HS + college framing

- Class-year pills include `'29` / `'30`; RoleSwitcher uses `ATHLETE_CLASS_YEARS` as fallback.
- Mission, Welcome, STORY, PUBLIC and store drafts name high school and college athletes.
- Jev unreachable in cloud (miss recorded in STATE); owner-approved scope applied.

## 2026-10-28 — Jev on complex decisions (standing)

- Owner rule: include Jev (TypeSafe) before coding non-trivial forks so decisions and diffs
  stay faster and leaner. Protocol: `docs/engineering/JEV.md`; AGENTS + TEAMS §1a;
  `.cursor/rules/jev.mdc`. Record scores or unreachable misses; never invent a Jev result.

## 2026-10-27 — ARCHITECTURE_SYNC build-layers map

- Add `ARCHITECTURE_SYNC` (116 roles): L0–L9 stack map in `build-layers.json` /
  `BUILD_LAYERS.md`, routed notices in `ARCHITECTURE_CHANGE_LOG.md`.
- Owner change prompts break into per-role team/docs/code tasks; `pnpm layers:sync` /
  `layers:check` in full check. Currency is change-driven (like EXIT_SYNC), not an idle worker.

## 2026-10-24 — Soft-Wall EAS preview + Profile/age UX checkpoint

- EAS Soft-Wall preview path: Stripe RN 0.83 (no tapandpay), arm-only Android ABIs, Gradle
  `workers.max=2`, iOS `$StripeDisableSPM` plugin; prior finished builds Android `42e81674` /
  iOS `d4a153a0`.
- Birth-year field keeps partial digits while typing; Profile hamburger sits on the hero
  identity row; settings sheet scrolls with Account / Play & shop / Money & staff /
  Support & legal groups.
- Hierarchy sync for the tip: 115 agents, docs/links, feature-admin, IP, exit plan
  `4fc54275bb8d`, infra and Security source report gates. COORD-02 gift release remains open.
- Resubmit from `43d3146`: iOS preview `09de0497` **FINISHED**
  (IPA https://expo.dev/artifacts/eas/CIVa_sDSWSyxS2kDSntQY-j_el6g9n781S9cSOjSRGc.ipa);
  Android blocked by Expo Free monthly Android quota until 2026-11-01 (no paid plan without owner).

## 2026-10-23 — Soft-Wall Vault unlock and resume session

- Guest Vault unlock on Highlights opens Soft-Wall (`soft_wall.exclusive`) then resumes PaymentSheet.
- Checkout and exclusive `grant` read the live Auth session so Soft-Wall resume still writes
  `tips.fan_id`, payer Aura and the `subscriptions` row. Coverage lists the Vault Soft Wall.

## 2026-10-22 — Gift-language copy phase

Individual athlete/family support uses Gift/Give; program donations and optional platform tips
stay distinct. Athlete page and personal-gift receipts say gifts are not tax-deductible.
Checkout waits for the separate no-cut tip model. Older donation/10% entries below are
superseded history. Counsel drafts and exceptions: [report](docs/engineering/evidence/GIFT_LANGUAGE_REPORT.md).

<!-- Source security work and evidence limits remain explicit; original operational acceptance is separate. -->
# Changelog

## 2026-11-04 — Design refresh, phase 1 (Lovable reference)

- Add a shared mobile action kit (`components/UI/Kit.tsx`: button variants, chips, badges, LIVE pill,
  progress) and `KIT` tokens in `constants/theme.ts`, mapped from the Lovable "Friday Night Lights" prototype.
- First-open welcome becomes a full-screen night hero; copy, BRAND-01 tagline and dismiss behaviour unchanged.
- Athlete HQ leads with a scoreboard gift total from the recorded ledger, lists gifts as rows, and shows
  badges as icon tiles (no progress until it is measured). Role dashboard panels drop the gold left edge.
- Phase 2: sign-in sheet and age card get larger titles, 52pt controls, a lock reassurance strip and AA-safe
  error ink; gift sheet uses scoreboard amount tiles, a 44pt scoreboard review total, ink-on-ink tip chips and
  a solid Next action. Fan headings are larger; Activity rows use 44pt filled icons. Flows, copy and payment
  guards unchanged.
- Phase 3 (owner asked for the Lovable design, keeping all content): the Next admin portal moves from top tabs
  to a dark left sidebar (top bar below `lg`) with every section, Product desk, Analytics, Departments and Sign out
  carried over; Daylight canvas and card panels/stat cards. Live Local games render as dark scoreboard cards
  with a solid LIVE pill; Spotlight's #1 row is a dark award card with gold rank and podium ranks 2–3; the
  locked Vault is a dark card with a gold one-time unlock; receipts show scoreboard amounts.
- Lovable sample match: new app icon and logo, Bricolage Grotesque + Figtree fonts, photo-wall welcome with Sign in, and Lovable-style fan nav bar (same floating shape). Needs a new native build for the icon and embedded fonts.
- Rollout: per-screen violet/cyan accents swept to the jade/ink system; quiz gameplay, reaction and tier colours kept as documented exceptions.
- Rollout: Drip cards, Beyond, Fan Zone, Quiz buttons, role HQs, Expo admin controls and Join Crew now follow the plan.
- Rollout: Highlights rail buttons (glass, light Give) and Profile (segmented sections, ink chips, neutral cards; violet accent retired).
- Owner adopted the Lovable design as the whole-app standard: [LOVABLE_UI_UX_PLAN](docs/engineering/design/LOVABLE_UI_UX_PLAN.md).
- Not yet run: mobile Jest suite and a Next build (run `pnpm check` on Node 24 and view the portal at 320px/1280px).

## 2026-10-22 — Metro disconnected-request repair (METRO-01)

- Version SDK58 Router Server's narrow pre-shell cancellation fix; retain real errors,
  static exports and stream cleanup. Add installed-SDK11-case regression to full check/CI.
- Restart existing Metro terminals to load the patch. Local evidence: [METRO-01](docs/engineering/evidence/METRO-01.md).

## 2026-10-22 — Refresh Claude entry point

- Keep STATE/AGENTS imports and add current conventions, gift-release/team, counsel and IP
  reading paths. Require verified remote evidence before reporting GitHub publication.


## 2026-10-22 — Whole-team gift release documentation (COORD-02)

- Reconcile115 role definitions/17 departments and current dispatch duties with Gift/Donation/Tip
  and the zero-cut source contract; preserve pinned reporting/model values and dated history.
- Add counsel/guardian review packets and a source-bound coordinated rollout with concrete
  pending decisions. Fresh read-only hosted checks prove missing tip/payment-context prerequisites.
- Correct rollback comments to require containment/forward repair without restoring the gift cut;
  no executable payment or SQL logic changes. Final current verification is in COORD-02.


## 2026-10-22 — No-cut personal gifts and optional Tapua'i support (local)

Source/admin checkpoint e9da05f and subsequent checkout language on codex/tip-model. New gifts
allocate full gross to family liability, zero gift cut independently of the default-OFF extras
flag. Historical posted allocations remain intact. Immutable service quotes/ledger guards,
cap and in-flight/re-review protections, separate tip/estimated processing lines and gift wording
are locally verified. See [model evidence](docs/engineering/evidence/MONEY-TIPS-01-admin.md) and
[checkout evidence](docs/engineering/evidence/MONEY-TIPS-01-app.md). Rollout, actual processor costs,
bank settlement, signed consent and counsel/store approval remain pending.


## 2026-10-22 — Payee checks record Stripe's answer

- Bank setup now records Stripe's own identity and tax-ID result for a linked account, so payee
  verification can complete on the server. Nothing is recorded until Stripe has answered, and a
  repeated answer adds no history (migration `20261022140000`, applied to development and staging). Payouts stay blocked.

## 2026-10-22 — Continuing IP preparation (IP-01)

- Final local full check/detection and106 portal tests pass; earlier stale-map/timeout gaps resolved for commit. Preserve the historical Recovery screenshot with engineering evidence.

- Add an evolving internal counsel packet and plan covering copyright, patent investigation,
  trademarks, trade secrets, ownership and disclosure history.
- Refresh source fingerprints through local checks/Claude Stop; flag changed review evidence
  and preserve supplied decisions. CI checks committed currency; no idle paid AI worker.
- Assign factual upkeep to Documentation and supplied counsel coordination to Legal. Actual
  rights decisions, legal documents, filings, docket deadlines and sharing remain owner/counsel work.


## 2026-10-22 — Security holes closed on staging and development

- Ask guests to sign in before they cheer in a poll; each account counts once and can switch sides.
- Stop anyone from listing uploaded files, editing other people's profiles, or writing admin and game data without the right account.
- Bring staging level with development's security fixes.

## 2026-10-21 — More room for content

- Show Profile counts on one line, the profile sections on one row, and Local polls in about half the space.
- Tighten game-day cards and every popup while keeping buttons easy to tap.
- Put long explanations behind More; policy and money messages always stay in full.

## 2026-10-21 — Sport accents and more room across fan tabs (UX-10)

- Compact all seven fan destinations, including own/public Profile cards and Drip, with readable labels and44-point buttons.
- Add vibrant cyan/violet/gold/ember accents and decorative sport icons matching the existing jade/sand theme.
- Extend Highlights video behind the floating dock; measure dock clearance for captions, reactions and non-video page footers, and preserve page alignment on resize.
- Repair the installed web video view’s intrinsic sizing with explicit full-frame dimensions. Local verification and separate device checks: [UX-10](docs/agents/UX-10.md).

## 2026-10-21 — Truthful QR line and more sign-in / donate tests

- Change the Share & Donate QR line to "Friends and family can donate from the link." — no instant, app-free promise.
- Test the sign-in hold-and-resume, the held-donation notice and failed sign-in messages.

## 2026-10-21 — Multiple athlete sports and compact fan layout (local implementation)

- Keep one manually chosen primary sport for field artwork, with independent teams/positions/jerseys and stats for additional sports.
- Keep profile sport-chip selection temporary; new videos/photos can record an explicit sport, and old unassigned Highlights stay in All.
- Add participation repair to Sports, recorded-tag correction to Highlights and original-log classification to Stats. Published sport choices distinguish empty/unavailable sources and retry without losing drafts.
- Shrink Local cards/type and keep Games/Polls/Boosters icon labels visible; place sponsor content under Boosters.
- Use an inset translucent bottom dock with opaque controls; scrolling softens only its background, with stop/focus/accessibility recovery.
- Enrollment, admin-first checkpoint and actual local/hosted evidence tracked in [MULTISPORT-01](docs/agents/MULTISPORT-01.md) and [UX-09](docs/agents/UX-09.md). SQL remains unapplied.


## 2026-10-21 — Sport field theme across the app, and athlete profiles load again

- Carry the field lines on every tab heading, role home, Beyond the Game, empty and paused cards and every profile.
- Follow the viewer: athletes see their own sport, everyone else a generic field.
- Use scoreboard digits for counts and amounts and the jersey patch wherever a jersey number stands alone.
- Fix athlete profiles that showed "Couldn't load athlete" after tag approval.

## 2026-10-21 — Sport field lines and scoreboard digits (UX-08)

- Draw each athlete's own playing surface faintly behind their profile, the QR donate page and Local game cards; sports added later get a generic field.
- Show jersey numbers as a stitched patch and live numbers as fixed-width scoreboard digits.
- Give the featured Spotlight card award-gold field lines and a jersey patch.
- Hide the athlete's school on the QR donate page when they have made it private.
- Keep Home's "Swipe for the athlete" hint off the Serve Like Me chip.

## 2026-10-21 — Game venue details and directions (LOCAL-02)

- Add school, public venue address and arrival notes to Expo admin Games and the shared game page.
- Open Apple Maps on iOS and Google Maps on Android/web from **Get directions**; retain selectable address after failure.
- Protect all venue edits with trusted admin SQL, preserve operator score writes and prevent stale overview responses restoring corrected locations.
- Register source/data/privacy/support/infrastructure ownership; migration remains unapplied and device/provider verification remains open in [LOCAL-02](docs/agents/LOCAL-02.md).

## 2026-10-21 — Share & Donate QR build-out

- Add **Donate to {name}** on the QR landing page, opening the usual donate sheet tagged as a QR donation.
- Say plainly when a QR link names nobody, and offer Try again when the lookup fails.
- Add **Share & Donate ⚡** for each linked athlete in Parent HQ.
- Keep QR links working for athletes without a username by using their athlete id.
- Let a build point printed QRs at a hosted preview with `EXPO_PUBLIC_WEB_ORIGIN` until tapuai.app serves the web app.

## 2026-10-21 — Notification settings, inbox and staff/source contracts

- Add Profile channel/category choices and Activity read/unread, active-inbox snapshot mark-all, archive/restore and bounded pages.
- Keep every optional email off initially, Auth recovery separate and unsupported sources visibly unavailable.
- Add server-owned event/preferences/inbox/delivery contracts, safe templates and Expo staff previews/pause/known-failure repair/Health.
- Guard revisions, captured actors and complete Auth/view/effect lifetimes; correct Archived bulk-read scope.
- Repair strict worker evidence, delivery lock ordering and NULL-role thank-you denial; prepare payment proof with authority false.
- Register Finance/data/privacy/control/sensor ownership and reconcile tester/team documentation without changing role pins.
- Pass233 mobile suites/2,287 tests, both app/shared typechecks and independent scoped source reviews.
- Keep unapplied SQL, actual emails, atomic donation/outbox wiring, native push and hosted release gates explicit in [local evidence](docs/engineering/evidence/NOTIFY-01-app.md).

## 2026-10-21 — Email and notification design draft

- Map existing Activity, Crew, Auth mail and feature-specific controls before proposing unified preferences.
- Draft Profile category/channel settings, an unread inbox, safe email delivery and Expo staff monitoring.
- Identify donation attribution/commit and thank-you authorization repairs needed before those sources can send alerts.
- Record the later approved architecture/default choice: only security email on by default; all optional email categories off.
- Enroll NOTIFY-01 as planned and start local backend/admin implementation before Profile/Activity UI; provider/hosted work remains separate.
- Design and implementation sequence: [email and notifications](docs/engineering/design/EMAIL_NOTIFICATIONS_DESIGN.md).

## 2026-10-21 — Current-app operational test execution

- Exercise the local Connect, payment and payout HTTP routes without Authorization; all three return401 with safe sign-in copy.
- Repair failed OAuth return cleanup after actual browser testing found Router history could restore error query details.
- Keep recovery on a clean callback route without retrying its consumed return; preserve new return handling and native behavior.
- Verify ordinary existing-test-account email sign-in resumes the draft; verify clean failed-return recovery and browser Back/Forward.
- Pass226 mobile suites/2,196 tests, both app typechecks and independent56 focused tests; actual media selection/provider tests remain open.
- Independently reproduce those anonymous denials; signed-in bank, Stripe and payout checks remain separate.
- Record the failed local Connect SQL replay honestly: missing PGlite engine, exit2 and zero executed SQL cases.
- Keep Google setup pending after the owner's confirmation; do not equate the prepared guide with provider acceptance.
- Original executor evidence and remaining cases: [APP-TEST-01 execution](docs/agents/COORD-01.md#app-test-01-execution--2026-10-21-utc).

## 2026-10-21 — Roadmap and whole-team app-testing handoff

- Reconcile current app implementation against Google, Stripe test-bank and media walkthrough prerequisites.
- Prioritize APP-TEST-01 and update the115-role/17-department briefing, with51 app/testing specialist duties synchronized.
- Preserve earlier checks as dated evidence and keep long videos off/live deferred.
- Correct legacy-public-Vault, profile access and environment/migration status wording.
- Actual ownership, checks and remaining gates: [coordination receipt](docs/agents/COORD-01.md#current-app-roadmap-and-whole-team-refresh--2026-10-21-utc).

## 2026-10-21 — Current-app testing preparation

- Normalize web/native video duration units and preserve duration through publishing.
- Reject invalid and over-limit duration before compression or upload; keep long videos off and live deferred.
- Add an offline generator for ten synthetic images, short/overlong videos and a valid oversized MP4.
- Prepare Google setup instructions; read-only development settings confirm Google is disabled.
- Full mobile226suites/2,193tests and both app typechecks pass; independent media review153tests passes.
- Local test assets and checks do not complete Google, bank, hosted upload or native device acceptance.
- Current sources and actual evidence: [media testing checkpoint](docs/engineering/design/MEDIA_SERVICE_PLAN.md#6-current-app-testing-preparation--2026-10-21-utc).

## 2026-10-20 — Replaceable video and photo storage

- Bind upload, public URL, signing, listing and deletion behind a media storage adapter.
- Read Highlight references and old public URLs on the selected host, preserving legacy URL suffixes.
- Keep private Vault upload/signing independent of public URL construction; reject unsafe/private public references.
- Preserve photo sanitization, published-story recovery and owner-claimed cleanup.
- Keep current limits and writers; longer videos stay off until costs are measured and live streaming is deferred.
- Full mobile225suites/2,154tests, both app typechecks and scoped guards pass; independent Security reviewed102focused tests.
- Contracts, tests and migration limits: [media service plan](docs/engineering/design/MEDIA_SERVICE_PLAN.md).

## 2026-10-20 — Guardian and adult Stripe test bank preparation

- Derive the selected payee from live Auth and service-only SQL; save current eligibility/binding before issuing links.
- Let eligible guardians explicitly manage the selected athlete's test setup without borrowing their own account.
- Preserve current account/athlete context through status, Terms, portal navigation and native return token refresh.
- Require server-confirmed current Terms in the client; keep capability flags distinct from KYC and payouts blocked.
- Final local mobile 223 suites / 2,103 tests and both app typechecks pass; SQL replay/provider walkthrough remain unrun.
- Actual source/review receipts and configuration prerequisites: [payee plan §10](docs/engineering/design/PAYEE_VERIFICATION_PLAN.md#10-google-account-to-stripe-test-bank-preparation--2026-10-21-in-progress).

## 2026-10-20 — Clearer Google account creation and sign-in recovery

- Offer Google from both account sheet modes; keep age confirmation and bank-free profile creation.
- Avoid the web authorize network probe before opening Google; preserve native flow and interrupted actions.
- Validate callback location/credentials, share concurrent return completion and mask provider diagnostics.
- Show recovery for failed returns and use the current route rather than an unrelated app launch link.
- Local verification and hosted/payment limits: [sign-in checkpoint](docs/ONBOARDING.md#google-account-creation-and-later-bank-setup--local-repair-2026-10-20).


## 2026-10-20 — Reliable account switching and Connect setup

- Bind pending Connect actions to the initiating account lifetime; require matching profile binding for legacy cached payout status.
- Prevent duplicate onboarding taps while checking Terms; preserve normal browser return/token refresh.
- Reject late profile loads and stale auth hydration, including account switches batched into one render.
- Treat device cache as a convenience and handle Edge/HTTP account errors consistently.
- App scope, verification and remaining limits: [repair contract](docs/engineering/design/PAYEE_VERIFICATION_PLAN.md#9-connect-client-and-profile-freshness-repair--2026-10-20-local-app).



## 2026-10-20 — Smoother first web tab visits

- Compile routes at startup in the Expo web development preview to remove first-visit “Bundling...” interruptions.
- Keep production web route splitting and existing lazy screen mounting.
- Restart Metro with `--clear` and reload the browser to use the updated router configuration.
- Local verification and scope: [STATE §4](docs/STATE.md#4-recent-changes-rolling--newest-first).


## 2026-10-20 — Reliable Connect account saves

- Require server credentials for protected Connect profile writes in both runtimes.
- Report database read/save failures and unmatched updates instead of returning unpersisted success.
- Save account bindings before issuing links; conditional updates protect against competing bindings.
- Keep identity/TIN verification separate from onboarding and transfer flags; authoritative KYC wiring remains open.
- Details and verification limits: [payee plan](docs/engineering/design/PAYEE_VERIFICATION_PLAN.md#8-connect-persistence-repair--2026-10-20-local-app).

## 2026-10-20 — Failed photo-story cleanup

- Added owner-only cleanup SQL and Storage guards; migration written, not applied.
- Retire failed attempts before a fresh retry so earlier uploaded files do not accumulate.
- Save minimal owner/story removal intent before Close; retry cleanup when that account opens Upload.
- Preserve already-published stories and recover their stored cover without applying new draft mentions.
- App contract and verification limits: [photo stories](docs/engineering/design/PHOTO_STORIES_DESIGN.md#failed-upload-cleanup-repair--2026-10-20).

## 2026-10-20 — Athlete stories and clearer tabs

- Added a named Story section for existing visible profile biographies and social links.
- Improved headings, empty-state guidance, activity text wrapping and tab readability.
- Kept Spotlight loading distinct from empty and made Drip category empties clearer.
- Enlarged existing controls and respected Reduce Motion for shared button/tab feedback.
- Made the existing Upload chooser scroll within the window height when text is tall.
- Preserved existing data/privacy, navigation, published settings and composer/payment safeguards.
- Local review and verification scope: [UX-07](docs/agents/UX-07.md).

## 2026-10-20 — Clearer Security checks and accurate report statuses

- Simplified source reporting into readable helpers without changing public function or CLI contracts.
- Missing guard prerequisites now show `needs-attention` in both JSON and Markdown; unrelated guards retain their own status.
- Added four regressions and actual CLI coverage. Local22 Security tests pass; final integrated/source evidence is retained outside source in the [existing tracker](docs/agents/REDUNDANCY-07.md).
- Awaited two async screen-timing test rerenders found during the integrated gate; targeted3tests and both-app typecheck pass, with independent API/source review.

## 2026-10-20 — Security partners for portable infrastructure

- Added infrastructure, supply-chain and recovery Security roles under SECURITY -> CTO, with actual VP/Documentation reconciliation.
- Added current registered-source coverage/report and independent Security notice routing to the existing exit workflow and project/CI gates.
- Fixed local SSH wildcard-range checks, inherited Compose credential overrides and nested Docker registry-credential inclusion policy.
- Aligned current Trivia funnel regression with the exact chapter DTO and original uncertain-answer retry; no runtime authorization changed.
- Actual scoped evidence and final verification custody: [REDUNDANCY-07](docs/agents/REDUNDANCY-07.md). Live controls and continuous monitoring remain unverified.

## 2026-10-20 — Portable app connection contract and local compatibility

- Both apps validate one shared public backend connection before SDK creation, preserving session/cookie/MFA behavior.
- Added matching private target profile generation and actual installed-SDK synthetic loopback protocol checks to the full project gate.
- Reject build-time dotenv interpolation, unsafe public keys and ambiguous routing; no live provider/configuration installation performed.
- Actual local tests/build/source verification custody: [REDUNDANCY-06](docs/agents/REDUNDANCY-06.md).

## 2026-10-20 — Rally meters show for guests (after the database update)

People browsing without an account could not see an athlete's Rally meter: the database refused the read. Once update `20261020090000` is applied, guests see live, filled and closed Rallies again. Signed-in families see exactly what they saw before.

<!-- Record actual local source automation separately from hosted/data readiness. -->

## 2026-10-20 — Private backup setup and operational exit health

- Added fresh private external setup templates with exact hashes/modes and empty sensitive inputs.
- Added read-only combined source/process/sweep, source-bound backup freshness and prepared-evidence health; missing setup remains NO-GO.
- Backup records now bind the actual source origin and PG endpoint/user; same-path connection drift and unbound retries fail closed.
- Actual local setup/review/check evidence: [REDUNDANCY-05](docs/agents/REDUNDANCY-05.md). Live backups/cloud rehearsal remain pending.

## 2026-10-20 — Current source updater verified

- Full project check passes205mobile suites/1,805tests and91exit checks; independent crash/process/retention review accepted.
- Exact source refreshed by current-login watcher and project/Stop catch-up; private latest/attempt receipts remain honest.
- macOS login service installation blocked; restart with `pnpm exit:sync start` after process/login ends. Live data and cloud rehearsal remain pending.

## 2026-10-19 — Automatically current exit source

- Added initial/restart and30s content-polled exact-source cache, atomic freshness/failure status, OS lock and resumable keep3 retention.
- Extended source CI to every branch/PR/manual/daily default sweep with run provenance and permission-preserving tar transport.
- Activation/check receipts: [REDUNDANCY-04](docs/agents/REDUNDANCY-04.md); live backups/cloud rehearsal remain pending.

## 2026-10-19 — Current owned-cloud exit preparation

- Exact expanded app/SQL/source releases and content-aware migration inventory; prepared source-only CI export.
- Immutable runtime image archives, optional stable API gateway, historical Storage ownership reconciliation and strict original-evidence readiness.
- Same-interface self-hosted Supabase exit; future180-minute target remains unproved. Execution: [REDUNDANCY-03](docs/agents/REDUNDANCY-03.md).

## 2026-10-19 — Complete backup jobs, freshness checks and cloud retrieval

- Added one private-config job for capture and every configured independent copy, with locking, atomic evidence and guarded archive retries.
- Added snapshot-age health checks and cloud-reader retrieval validated against a protected original checksum before decryption.
- Corrected inconsistent success-record monitoring and Azure partial-publication retries; documented operator setup in [BACKUP_OPERATIONS](docs/engineering/BACKUP_OPERATIONS.md).
- Scheduler and alert delivery remain inactive; no cloud or live data operation ran.

## 2026-10-19 — Supabase backup and own-server migration kit

- Owner confirmed backup of Supabase for AWS/Azure recovery; added organized infrastructure operator folders and full database/Auth + Storage byte capture, encrypted packaging, verification, isolated reviewed restore and offsite publishing.
- Added guarded Storage-only retries, strict PostgreSQL target routing and reviewed source recovery policy including dependency layout, infrastructure and required configuration.
- Prepared Expo SDK58 and Next standalone containers, private Supabase bootstrap/configuration and independent AWS S3/Azure Blob plus optional VM templates. No cloud resources, live backup, SQL application, schedule or cutover executed.
- Added architecture, operator runbooks, owned data exports and actual verification tracker: [REDUNDANCY-01](docs/agents/REDUNDANCY-01.md).

## 2026-10-19 — Trivia demo no longer awards Aura

The dev-only trivia preview says nothing is saved. It now also awards no Aura: a right answer in the demo used to add 5 Aura to a signed-in tester's card. Real weekly rounds still award 5 Aura for a right answer.

## 2026-10-18 — Two-step sign-in for admin desks (off for now)

The web admin portal and Expo `/admin` can require an authenticator app code before an admin desk opens. An admin sets it up once with a QR code or setup key, then enters a 6-digit code at each sign-in. It stays off until TOTP is turned on in Supabase and the owner sets the switch; until then sign-in is unchanged. Steps: `docs/engineering/ADMIN_MFA.md`.

## 2026-10-18 — Live scores can update one game at a time (off for now)

The Local scoreboard can follow each game on its own channel and change just that score, instead of every fan reloading every game. It stays off until the database update `20261018120000` is applied and a build turns it on; until then nothing changes for fans.

## 2026-10-18 — Home shows a clip that has a file

Once an uploaded Highlight or a finished photo story is available, Home no longer pages the five sample cards that have no video. Those names remain when the feed has nothing else to play.

## 2026-10-18 — One live Highlight, and a smaller upload

Home keeps a decoded video only for the clip on screen. The next card is a poster until you swipe to it. A Highlight upload still has to be 45 seconds or less, and it also has to be under 8 MB. Profile numbers and the Home trivia notice load when that part is open. The trivia database was not changed.

## 2026-10-17 — Fan Zone and Beyond on development

Fan Zone and Beyond are on the development project. The extra unique indexes on storage objects were removed because that table is owned by the storage admin role. The write guards are triggers, and both media buckets are private. An admin still has to turn the switches on. Coach-level SQL was not run.

## 2026-10-17 — Development database catch-up through trivia

Privacy, minor accounts, payee checks, sport quiz, timed trivia, play-together, Life Playbook, fresh questions, workout challenges, life-lesson questions, and the IQ file are on the development project. The bank has 123 questions. Fan Zone and Beyond did not apply: those files need to own the storage objects table. Coach-level SQL was not run. Home highlights play the one surviving video file.

## 2026-10-17 — Health shows where the app failed

The portal Health page counts open syntax checks, logic and data failures, and screen glitches from Engineering Support. Fan Zone and Engineering Support join the waiting-database list. Product names the Expo desks this portal does not host, including trivia’s 5 Aura award and the IQ question file.

## 2026-10-17 — Search filters stay quoted

Typed search text is quoted before it goes into a PostgREST `.or()` filter, and a live-match channel opens only for a plain id or slug. Database functions already take that text as a parameter.

## 2026-10-17 — Profiles, Local, and trivia Aura

Athlete profiles from Highlights and the Local pill stay open. A trivia side notice appears only when a round can start. A right answer adds 5 Aura to the card. Six IQ questions are written for the weekly mix and are not applied yet.

## 2026-10-17 — Database updates wait on admin

A control whose database update is not applied no longer paints a red notice on Activity, workout challenges, or challenge settings. Expo admin Home and the portal Health page list the control, the migration file, and the Expo desk. A real read failure still shows.

## 2026-10-17 — Coach-level and Rally share handoff

The documents now follow the same chain as the build: Highlights through Engineering to the CTO. The share sheet is in the current work. Counsel and the database update stay open.

## 2026-10-16 — Coach-level workouts and a shareable Rally

A workout that needs a coach or spotter can carry a Coach-level move label. Reporting it as risky does not take the clip down. A filled Rally and a board leader can be shared. The brand line stays Donate. Elevate. Celebrate. The database update is written and not applied. Counsel has not signed off on the wording.

## 2026-10-16 — This week’s trivia subject

The Highlight card names sports or a subject off the field. A finished round says which one unlocks next week, and offers one fact to take to dinner.

## 2026-10-16 — Student-athlete lessons in trivia

The Highlight card clears for the week after Play or Not now. A finished round points to a new subject next week. Draft questions add American history, the job site, and practice fuel. They stay drafts until reviewed.

## 2026-10-16 — Trivia invite on the Highlight

The side card asks if you want to play this week’s round. The app rechecks availability on its own.

## 2026-10-16 — Fan bar on trivia and Fan Zone

Sport Pop Quiz and Fan Zone keep the same bottom bar as Highlights, so Home is always one tap. Leaving that way still ends an open trivia round.

## 2026-10-16 — Trivia results on one phone screen

A finished trivia round keeps the cheer, the facts medal and the badge together, then shows each question as a short jade, gold, cyan or violet card. The recap stays on the phone with very little scrolling.

## 2026-10-16 — Phone-sized trivia and Fan Zone play

Trivia and Fan Zone stay within a phone width. A live trivia round fills the screen with a gold question and large answers. Fan Zone paths stack on the phone, and voting is the bright action.

## 2026-10-16 — Trivia notice on the Highlight, Fan Zone on Beyond

Highlights no longer stacks Fan Zone and Sport Pop Quiz over the clip. Trivia appears in gold and violet for a few seconds, then tucks to a tab on the left. Play opens the round. Fan Zone discovery is on the Beyond page.

## 2026-10-16 — Celebrate a live play, then donate

On a live match, opening a play shows Seki, Aura and Flex so you can celebrate the athlete. Donate is a button on that card. The donation pages open only after you tap it.

## 2026-10-16 — Family notices fit the Highlight

Fan Zone and Sport Pop Quiz on Home show as a short card on the clip. Refresh stays easy to tap. Open and Not now sit beside each other so the notice does not cover the Highlight.

## 2026-10-16 — Combined-branch test repair

Guardian activity names a fun-fact approval correctly. Fan Zone test campaigns keep a voting window that is still open. The finance catalog lists each payout flag once.

## 2026-10-16 — Fan Zone and trivia on the main line

Fan Zone, sport trivia, and the life playbook are now in the same branch as Beyond and the current admin. Home can open Fan Zone discovery. Guardian supervision can approve a teen's fun fact and still shows workout invites. The repair after the merge makes the mobile app typecheck again.

## 2026-10-16 — Approved vs pending tag chip on Highlights

Highlight cards now show whether the athlete approved the tag: a solid "✓ Tagged" chip for approved tags and a grey dashed "Tag pending" chip while waiting for approval. Untagged clips show no chip.

## 2026-10-16 — Beyond follow-up: catch-up plan, safety label design, phrase test

A step-by-step checklist now brings the development database up to date so Beyond posting can be switched on there (not run yet). A "Coach-level move" safety label for risky workouts is designed and registered for the admin-first build, with wording for Legal to choose. Four phrases for "my Beyond workout for the day" — Seki Set, Extra Rep, OT and Two-a-Day — go to users for a test before one is picked.

## 2026-10-16 — Beyond on the Home bar and one Upload button for everything

Beyond now sits next to Home and Local at the top of Highlights. Tapping it plays athletes' workout and service clips full-screen, just like Highlights, with a link to the Beyond the Game page for fans' own workouts, service, learning and stories. The bottom bar is Home, Activity, Upload, Spotlight and Profile. When Beyond posting is switched on, Upload asks "Highlight or Beyond moment?" so any fan, athlete or family can post either kind in one tap; otherwise it opens the Highlight composer as before.

## 2026-10-16 — Whole-team documentation update

All107 role definitions now give their current handoff; task-only registry descriptions and team/department/roadmap entry points distinguish current local Beyond/workouts/design from future fan/trivia/Vault work, unapplied hosted gates and separate admin-worktree capabilities. Existing role ownership, reporting, tools and models stay intact. Current Team flow is regenerated from the registry; detailed coverage and actual checks are in [TEAM_STATUS](docs/agents/TEAM_STATUS.md) and [COORD-01](docs/agents/COORD-01.md). Following the explicit approval prompt, the owner approved keeping the Stripe-only Finance Operations §7 clarification and finalizing the team records. The decision is recorded, final local checks passed, and scoped coordination claims are released.


## 2026-10-15 — Calm Island colours

The app moves to the owner-chosen Calm Island palette: one deep-jade colour for Donate, Upload and the active tab on every destination; a warm sand-white canvas; gold only for awards and Spotlight; red only for LIVE. Filter chips share one look everywhere (dark when selected, white outlined otherwise), page corner decoration is gone, and Beyond / challenge refresh buttons no longer show as dead buttons to guests. Options and the comparison live in the Figma file "Tapua'i — Look & colour refresh". Publish Look → Daylight from `/admin/look` so the stored runtime theme matches.

## 2026-10-15 — Beyond the Game and workout participation (local)

Approved dedicated bottom tab: workouts, service, learning/STEM and stories; Highlights remains first, Drip moves into Profile. Reviewed private fan photo/video contributions have no athlete/payee selector, rights/safety consent, youth audience limits, safe retry, own history/removal/report/export and explicit media loading. Actor-bound bounded legacy cards lead to established athlete profile viewing/support. Workout presets, accepted-friend Activity invitations and private noncash badge/settings/export complete CHAL-01a.

Independent source/Data/SUPPORT reviews resolved quota/erasure/closed-account/stale-action/privacy and integration findings. Full local detection scan passed148mobile suites/1,188tests plus86portaltests; real database replay57Beyond/46CHAL. Admin-before-app checkpoints and final local evidence in [BEYOND-01](docs/agents/BEYOND-01.md). Migrations remain unapplied and contribution/challenge switches off; hosted/device/Utah legal release and later Vault/season/try-video work remain pending.

## 2026-10-15 — Fresh trivia and athlete fun facts (QUIZ-05)

Trivia now looks after itself. Players can report a question that seems wrong, confusing or not okay; questions with
enough reports pause until an admin checks them, and answers come in a different order for each player. Athletes can
choose to share up to three fun facts from a short list of prompts, such as their hype song or pre-game meal. Each one
is checked by an admin, and a parent or guardian approves first for under-16s. Their fans may then meet a "Fun fact"
question now and then, shown only to people the athlete's privacy settings allow, and an athlete can remove one any
time. Admins can paste in a batch of new questions as drafts. Migrations written, not applied; athlete fun facts start
switched off.

## 2026-10-15 — Trivia feels like game day

Trivia rounds are now playful: questions pop in, a shot-clock bar counts down, and every right answer gets a sports
cheer ("Touchdown!", "Nothing but net!", "Ace!") with confetti. A miss gets an encouraging "Good hustle!" and the fact.
Finishing a round, or reaching a new level, gets its own celebration. On the web there are soft, short sounds; phones give a
gentle buzz for now. A Sound on / off switch is on the trivia screen, and phones set to reduce motion get calm fades
instead.

## 2026-10-15 — Life Playbook and never-held-back trivia (QUIZ-04)

Trivia now gives everyone three separate weekly rounds: your own round, one group round, and, if you turn it on, a
Life Playbook round. Group play never uses up your own round, and your level (Rookie → Varsity → All-Star → Pro → Hall
of Fame) only goes up. Life Playbook is optional, simple and fun: short true / false and four-choice facts about everyday
life skills, in sports terms, in four chapters for everyone 13+: Money Huddle, Savings Season, Scam Defense and Smart
Plays. Questions never give advice, name brands, mention Tapua'i donations, or use money amounts or dates, and scam
questions always say to tell a trusted adult and use Report. 40 Life drafts are ready, and the sports starter questions
were simplified too. Nothing is asked before an admin approves it. Migrations written, not applied; trivia stays paused
for testers.

## 2026-10-14 — Trivia, play together (QUIZ-03)

Trivia now comes as a weekly round of up to five quick questions (still 30 or 90 seconds each, chosen before you start),
with true / false questions alongside four-choice ones. Athlete profiles offer "Learn {sport} with {name}" so families
and fans can learn the game their athlete plays. Families and friends can start a private challenge group with a code,
play the same weekly round, and see who played — never scores, speed or rankings. A private badge shelf and season recap
show what you have learned. Groups follow the teen safety rules (an adult stranger cannot share a group with a teen), and
blocking someone removes them. A 60-question starter bank is ready for review; nothing is asked before an admin approves
it. Migrations written, not applied; trivia stays paused for testers.

## 2026-10-14 — Optional timed trivia player

Trivia now offers explicit30- or90-second rounds, manual play or optional weekly invitations, reviewed unseen questions, private participation badges and private history controls. Leaving clears the question; interrupted responses recover only permitted committed results. Clear-history explains retained preferences/notices and the35-day weekly quota. Final independent source review accepts the participant corrections, including safe initial status loading. Root150-suite/1,219-test full check, both app types and all guards pass. Selected local app-ready passes after the preserved admin checkpoint; actual final Documentation/VP handoff passes and the pilot remains paused.

## 2026-10-14 — Timed trivia admin acceptance

Reviewed trivia administration now includes full bank/audit paging, permanent Pause, correction and bounded retention. Local server and SDK privacy fixes pass independent review; canonical105/Fan154/historical34/timed50 pass. Timed player implementation follows actual QUIZ-02 admin-ready.

## 2026-10-14 — Approved timed trivia admin development

The owner approved optional sports-first30/90-second learning. QUIZ-02 was enrolled before
source. The new admin desk supports complete paged facts/family review, effective expiry,
pause, correction and bounded retention; strict SDK/admin checks pass50tests and mobile
types. Timed actor source is being finalized and independently reviewed. Player changes
wait for a new verified admin checkpoint. Both pilots stay paused/empty; no hosted rollout.

## 2026-10-14 — Fan local source acceptance

Independent133-path source/coherence/Data/Safety/SUPPORT review passes, with actual
Documentation/VP scope reviews. Root148-suite/1,146-assertion full check and105/154/34
local replays pass. Selected local Fan app-ready exits0 at metadata date2026-10-14T14:49:04Z,
after actual admin. Final status continuation is retained. Timed trivia remains an
owner-review draft; revised Quiz app readiness stays unset and pilots stay inactive.

## 2026-10-14 — Timed trivia decision draft and final source repairs

Owner selected 30 seconds with a longer accessible option. New indexed proposal recommends
90 seconds, explicit opt-in, sports-first reviewed questions and account exposure history.
Current Quiz remains untimed; revised app readiness is pending design/admin-first work.
Fan shared consumer review passes. Byte-identical fixture relocation preserves all real tests;
full check round2 passes 1,146 assertions before an unused test import stops later guards.
Import-only repair b7fd0c resolves it; root full rerun exits0 with148 suites/1,146 assertions and all guards. No pilot activation.

## 2026-10-14 — Fan and Quiz shared account activities

Fan Zone now joins the optional Quiz in Home and four role HQs, with generic/private history
links in profile and explicit root Back/Home navigation. Private guardian review remains
visible independently of participant dismissal, including paused/unenrolled guardians.
Fan stale-permission refusal resets video/caption review before authoritative refresh; its
35 focused tests and independent correction review pass. Shared source 8179b7b passes final
affected discovery/Home/HQ checks (53), coverage test and typecheck. Final broad/full/app gates
and Documentation/VP closure remain pending; pilots stay inactive local source.

## 2026-10-14 — Fan participant source and private review control

Fan Zone now has local private submission, exact-scope teen/guardian review, free ballot recovery,
optional athlete stories/service, concern receipts and tracked removal. Participant checks pass
29 tests; the separate uncached authorized video review control passes 13 and independent producer
review. Full caller review requires stale-permission refresh/reset correction before shared Home
and account discovery. The weekly quiz is already connected and independently reviewed.
Data map validates all new consumed exports; final full gates and Documentation/VP remain pending.

## 2026-10-14 — Fan admin gate passes before participant source

Exact displayed scope now binds normal review; explicit emergency suspension is separate. Composite per-stream cursors preserve recovery ties. The 154 actor, 45 SDK/admin and 105 root canonical checks pass; actual independent technical/operational acceptance and selected admin-ready gate precede Fan participant source. Quiz shared discovery independently passes. Local source only; full gates pending.

## 2026-10-14 — Weekly quiz participant and discovery source

Optional weekly Sport Quiz page includes explanations, private completion badges, honest Skip/retry and account isolation;23local tests and independent review pass. Home/four HQ/profile integration passes44local tests and typecheck, with consumer review/full gates pending. Fan admin review requests stale-revision safety guards before its admin checkpoint; composite paging strengthens recovery robustness, while existing timestamp guards already protect normal writes. No hosted activation.

## 2026-10-14 — Weekly Sport Quiz local admin checkpoint

Question bank, paused tester controls, complete Data/audit and private correction rules pass independent local review. Quiz actor34/34, two admin/adapter suites30tests and root canonical105/105 pass. Actual QUIZ admin-ready gate passes before participant page/card work. Learning badges are noncash/private; migrations remain unapplied.

## 2026-10-14 — Fan Zone backend/media correction review

Private Fan Zone source now has explicit guardian approval binding, safe upload retry, tracked removal available despite reporting quotas, blocked-owner admin deletion intake and a Storage mutation fence. Scoped independent source review passes; local135actor/14API/105canonical checks pass. Admin and quiz contract correction are in progress; no fan UI or hosted activation yet. Weekly Sport Quiz learning direction added to the per-user engagement playbook.

## 2026-10-14 — Fan Zone implementation enrolled; Finance catalog repair

Owner authorizes the recommended first Fan Zone. FUN-01 design/plan and planned admin-first contract are recorded in an isolated checkout; no feature or release readiness yet. Corrected the existing payout_flag_overrides.payouts_enabled catalog omission as a CONNECT control (no journal/money movement); focused existing Finance coverage 15/15 passes. No SQL application or payee behavior change.

## 2026-10-13 — Refine the family-fun journey

At the owner's request, FAMILY_FUN_PLAYBOOK §12 proposes one weekly Fan Zone entry point,
private fan contribution/review/status, accessible newcomer acknowledgment versus awards,
group/creator credit, selection alternatives, optional service/support and cooperative school
recaps. Owner chooses fan voting selects the winner; revised direction assigns staff entry
eligibility/rights/safety review and valid free ballots, with proposed server windows/retries,
ties/corrections, candidate permissions and honest network-advantage limits. Growth charter/
per-user plans/team duties reflect the choice; actual Product/Growth/Safety/Documentation
review and local checks are recorded in GROWTH-01. This remains brainstorming, with no app
implementation, new enrollment, public award, voting, service campaign or payment change.

## 2026-10-13 — Family fun and fan recognition brainstorming

Owner clarifies any eligible account holder can submit fun fan videos, with Fan of the
Game/Week/Month/Year and awesome-fan badges, and confirms separate noncash recognition and
money paths with voluntary service. New FAMILY_FUN_PLAYBOOK proposes free fan moments,
athlete/family stories, service, recaps, fair school participation and newcomer-friendly
reviewed recognition. Actual Codex Growth/Legal/source reviews exchanged findings; charter
§11 and per-user plans integrate the concept into the one Growth packet. Existing polls
and athlete Spotlight do not establish a safe/fair generic fan-award workflow. No new app
feature, public contest, badge, prize, service campaign or earning model is implemented by
this brainstorming work. Actual coordination/documentation/check results are in GROWTH-01.

## 2026-10-14 — Verifying who gets paid (VERIFY-02)

Owner decisions: anyone who earns donations gives their Social Security number to Stripe in Stripe's own payout setup —
Tapua'i never asks for it or stores it, and a new check fails the build if code tries. A parent or guardian can receive a
teen's donations only after Stripe verifies their identity and tax ID and the school confirms in person that they are the
parent on record (support can review a birth certificate or court order instead, without keeping a copy); two admins
must agree on that confirmation. Stripe's ID + selfie check is kept for disputes. Turning someone's payouts on or off by
hand needs a written reason and a second, independent admin. Admin People desk: payee verification panel and counts.
Telemetry now strips anything shaped like an SSN. Migration `20261014120000_payee_verification.sql` written, not
applied; payouts remain blocked.

## 2026-10-14 — Minor accounts: age, guardian consent and supervision (MINOR-01)

Sign-up asks for birth month and year instead of a 13+ checkbox; an under-13 date creates nothing (neutral message,
24-hour pause on the device), and an under-13 entry later closes the account. Teens start private and take friend
requests only from other teens. A teen can invite a parent or guardian with a one-time code; the adult signs a consent
form (draft for counsel, marked testing only) and the link counts once the teen confirms. The guardian sees the teen's
settings, safety counts (never who their friends are) and changes, and — for under-16s only — approves or declines going
public or taking friend requests from anyone. The teen sees exactly what the guardian sees, and either can unlink or
block. Consent unlocks a public profile and, from the guardian on record for the family account, payouts. Admin People
desk: minor accounts report, case file, birth-month correction and link ending (with reasons), retention.
Replaces the PRIV-01 guardian lock. Also: blocking someone who had tagged you now works, and a declined tag no longer
names who declined. Migration `20261014110000_minor_accounts.sql` written, not applied.

## 2026-10-13 — Fan/filmer mitigation and growth plans by user type

Owner follow-up expands Growth's one-packet duties to every overlapping user segment, including
non-donating fans and casual uploaders. Actual Codex Engineering/Legal/Growth reviews exchanged
source findings: fan videos already allow Tag later without athlete/payee/pro-filmer status;
photos retain athlete selection, and retag/recovery/media permission/share/donation-handoff/
recognition gaps need explicit decisions. New product USER_GROWTH_PLANS contains per-segment
value/acquisition/activation/repeat/contribution/outcomes, mitigation owners, staged 30/60/90
day proposals and support/cost/safety acceptance. Growth charter §10 establishes plan cards
and next Oct20 packet. Existing role/workflow coordination and actual checks are recorded in
docs/agents/GROWTH-01.md. No app feature, campaign/outreach, cash incentive, hosted change or
financial release is implemented by this planning work. Fresh full pnpm check exits 0:
126 mobile suites/905 tests,191 doc destinations,106 roles and three registered features.
Counts include concurrent MINOR integration; this plan changes no app source/tests. Hosted,
media/device/provider, counsel and financial release gates remain separate.

## 2026-10-13 — Verification, consent and safe growth review

Actual outside-session Codex Legal, Growth and Dev reviews exchanged recommendations on
guardians, Stripe, school athletes, public exposure, consent and engagement. New source
review/decision packet documents observed local gaps, proposed verification tiers, notices,
resumption/review safeguards, safety plus growth metrics and five owner decisions. Growth
charter §9 establishes the standing joint checkpoint under the existing one-packet routing.
Product policy, relationship-proof, payee/fees/held-money and launch decisions require the
recorded counsel/domain and owner dispositions. External current policies could not be read;
platform examples are explicitly unverified. MINOR-01 changed concurrently; report labels
source observations and ongoing integration. Actual coordination/Documentation execution,
checks and next owners are recorded in docs/agents/GROWTH-01.md. Full pnpm check failed at
mobile typecheck (28 ongoing integration diagnostics); separate schema-doc check failed. Local
doc destinations and 106-role alignment passed. This review adds no runtime controls, applied
migrations, live money or release approval.

## 2026-10-13 — Video scalability recommendation review

Actual Codex media/reliability and cost/operations functions reviewed video hosting within
GROWTH-01/SCALE-02. Hosting brief §11 recommends Mux as the provisional first technical
experiment, with Bunny Stream and Cloudflare Stream in the initial equal-workload/full-cost
comparison. Current prices/free eligibility/traffic/capacity remain unverified; no vendor is
selected or established cheapest. Proposed video allocation fits inside infrastructure $50,
separate from existing AI spending; no spending/cancellation/provider action performed.
Source-backed upload/access/deletion/web-player gaps become admin-first/domain/QA/recovery
acceptance work; existing media remains during a staged, authorized rollout. FPA current
baseline, TEAMS shortlist and queue next owners synchronized; reporting/model pins intact.
Actual tests/reviews/gates and released claims are recorded in the GROWTH-01 video follow-up.
Independent Documentation accepted; existing focused unit checks passed three suites/48 tests
and root full `pnpm check` passed 118 suites/867 tests, 186 doc destinations and 106 roles.
Reviewed source/role/installed-SDK hashes match. Counts include concurrent shared-tree work;
the video review changed no application source or tests.
No runtime/schema/collector/new UI, hosted migration, real content export or rollout built.

## 2026-10-13 — Owner-reported expense baseline

Finance operations §6.1 records approximately $200/month AI, currently Free Supabase and
undecided video hosting from the owner's reply. Existing $50/month infrastructure ceiling
is separate from AI. Known reported recurring subtotal is $200/month; a fully used allowance
would give $250/month/$3,000 annual AI-plus-infrastructure planning cost before other expenses.
Invoices, provider limits, video cost and available cash remain unverified/unknown. Growth and
hosting plans link this source; no journal entry, provider purchase, cancellation or migration.
Independent Documentation accepted the baseline and arithmetic; full `pnpm check` passed
118 suites/861 tests, 186 Markdown destinations and 106 agents. Private actual receipts:
`.smoke/support/finance-cost-baseline-review.md`, `finance-cost-baseline-check.log` and
`finance-cost-baseline-closeout.json` in the same directory.

## 2026-10-13 — GROWTH-01 accountable growth and service review team

Owner asked for one agent/team to measure app growth and success, recommend service options
when credible numbers warrant a review, and submit decisions to CTO/owner. Reused
GROWTH_ANALYTICS as accountable Growth and Capacity Review lead through MARKETING; ANALYST,
COST_OPERATIONS, RELIABILITY, Data and Finance supply domain evidence and independent review.
Established metric/source/target/quality contracts, per-service review thresholds, standing
weekly/monthly/event review duties, provider selection baselines, a single decision packet
and the first actual measurement-gap assessment. Current operating stage is internal test;
MAU/cohort retention, current invoices/limits and production headroom remain unmeasured here.

Reuses Analytics/Audience, Health/Support and Finance & Books rather than duplicating their
metrics. Initial budget remains $50/month; 40/50 budget and 70/85% verified quota thresholds
prompt diagnosis/recommendations. MAU checkpoints are proposed planning inputs, not accepted
success targets or guaranteed capacity. Owner approves spend/vendor/migration; resulting
implementation needs admin-first/Data/Finance/Security/QA gates. No collector, new admin UI,
background scheduler, external tracker or hosted change was built in this operating setup.
Actual coordination/documentation/full-gate evidence and claim release: docs/agents/GROWTH-01.md.
Documentation accepted the charter and team assignment; all 106 role/reporting/model pins
remain intact. Regenerated existing Team flow metadata and passed `pnpm check` (118 app
suites/861 tests, 186 Markdown destinations, 106 roles). Next standing packet: October 20;
live collection and source/target gaps remain assigned in the queue.

## 2026-10-13 — Hosting budget and expansion options follow-up

Owner selected an initial infrastructure ceiling of $50/month. Extended the existing
HOSTING_DECISION_BRIEF (§10) with managed Supabase, own hardware/VPS, AWS/Azure managed stacks
and other PostgreSQL options; proposed inexpensive dev/staging, gated production/recovery
budgets, measured video/operating costs and an optional synthetic exit trial after R2.
Linked the environment plan and docs index. This is a recommendation, with no host chosen,
new spending, provisioning, data movement or service implementation.

Fresh Claude review could not start: its launcher failed macOS sandbox_apply with exit 71,
including the escalation attempt. Prepared a concrete read-only follow-up request; prior
panel recommendations remain attributed historical context. Official-page bodies were blocked
by input filtering, so prices/quotas/SLA references remain unverified planning assumptions.
Documentation accepted the new proposal; quote-completeness feedback incorporated. Full
`pnpm check` passed (118 app suites /861 tests, 184 Markdown destinations, 106 roles).
Actual receipts and pending owners are recorded in the brief's follow-up handoff.

## 2026-10-13 — HEALTH-01 task evaluation and bounded health repairs

- Evaluated 62 current task IDs, all queue sections, specialist backlog and owner decisions;
  reconciled nine ranked lanes and next owners. Existing local completions stay scoped to
  their evidence; hosted/device/finance/counsel/recovery requirements remain open.
- Repaired the existing TelemetryManager: 120 total queued/unresolved rows, batch 15,
  10-second caller timeout, safe loss/status counters and no replay of an attempted uncertain
  INSERT. Ignored aborts retain capacity; disposed singleton cannot spawn more stalled work.
- Improved the QA desk with independent digest/device reads, one actual pending read per source,
  stale/unmounted guards, accurate Clear/Unsave labels and unconfirmed write notices.
  Local sampled delivery/loss/history does not imply fleet health or duplicate Health analysis.
- Valid failure-before regressions, final logger 21/21 and QA 11/11, and independent reviews
  support local acceptance. Fresh retained scan passed 117 suites/859 app tests and Next 86/86;
  documentation, 106-role alignment and generated data/Team flow checks passed.
- Root reviewed/tested the concurrent SQL repair without authoring or applying it. Frozen
  current canonical replay 35/35 and all five exact cap boundaries/client vs trusted contexts
  passed. Real tip INSERT/UPDATE state was checked; sponsorship/shop coverage is constraint
  expression coverage. Earlier NULL-passing probe and a corrected RLS test assumption are
  retained separately from current-source proof; hosted JWT/charge/transfer are unverified.
- Actual Documentation and VP coordination receipts, source hashes and remaining owners are
  in `docs/agents/HEALTH-01.md`. No hosted application, deployment, live money, scheduler or commit.

## 2026-10-13 — COORD-01 documentation and team coordination

Actual outside-session Codex Documentation and VP Operations passes completed locally and were
reviewed/integrated by root. Corrected stale assignments, completed admin/Support/finance/data
priorities, shared helper/source references and recovery evidence; retained historical records
and hosted/device/counsel/owner gaps. Added required handoff receipts with actual executor,
checked/changed paths, dated results, open issues and next owner. Reconciled all 106 reporting
roles without changing leads/model pins; regenerated main-admin Team flow ownership and master
data map. Fresh `pnpm check` passed after those updates: 115 suites /827 tests, 181 Markdown
destinations, 106 roles and 2 feature contracts. Evidence/claim release: `docs/agents/COORD-01.md`.
Duties are task-triggered; no unattended scheduler or continuously running worker is configured.
No hosted application, deployment, live-money action or commit.

## Historical STATE header captured 2026-10-13 before COORD-01

This is a historical checkpoint snapshot, not the current task or failure status. Current status is in `docs/STATE.md`; earlier details are retained here when its header was made concise.

**Last updated:** 2026-10-13 · STANDARD-01 innovation and outside-handoff standard documented: observed/potential struggles, bounded experiments and decision evidence, shared module contracts, engineer/legal/investor reading paths; existing agent and admin-first workflows linked, outside walkthroughs not performed · DETECT-02 main-admin Engineering Support built locally: four-tab desk, generated team/source diagram, restricted signals and protected false-positive reviews, transactional change audit, cybersecurity THREAT_DETECTION role (106 roles), bounded source capsules and isolated restore; admin-ready gate and 12 responsive/3 behavior browser checks passed; 144 SQL replay and 10 recovery checks pass; app-ready and full local gate passed (115 suites/827 tests, Next 86/86), hosted migration not applied · Archive naming rule (`.archived`, enforced), 12 missing-function checks merged into `lib/dbErrors.ts`, `useAdminAction` for admin desks, operator check-ins 30 days automatic and rounded at write (PRIVACY_ENGINEERING; replay 46/46) · Data governance closure pass + QA follow-up: 62 dead entries archived in two passes (owner approved), every dead-data finding closed with real readers/writers/admin controls, operator GPS table reads revoked, `pnpm code:unused` guard, buckets and feature switches in the data map, closures migration replayed 40/40 (not applied); `pnpm check` 103 suites / 700 tests · Engineering Support under Dev (existing SUPPORT, INCIDENT_TRIAGE, TELEMETRY, RELIABILITY; 105 agents), 14-sensor coverage map, retained local detection scan and six assigned runtime gaps; 10 scanner tests and review pass, latest full scan flags concurrent unfinished admin controls · Data Governance team (DATA_GOVERNANCE as the data control point, DATA_LINEAGE, CODE_HYGIENE; 105 agents) and the master data map with `pnpm data:map:check` in CI; 4 dead-data findings routed, 47 archive proposals awaiting the owner · Office of the CFO (10 finance/tax roles, 102 agents) and the Finance & Books hub (eight tabs, finance data catalog, reconciliation) built locally; bookkeeping migration revised after security/accounting/QA review and replayed 72/72 on Postgres, not applied · PLAY-01 browsing error repair in progress; CSS direct/worker probes pass, web-play promise fix and local-media verification underway · Admin data consolidation accepted locally: 18 Manage entries, all 24 saved routes, 64 measures and 13 Health checks retained; future-feature admin-first workflow integrated (611 app tests + 13 workflow tests, 60 responsive/geometry checks, 19 interactions; hosted/device checks pending) · Books desk (BOOKS-01) built locally at `/admin/books`: double-entry journal from the money tables, money held for families as a liability, tax-year pack, QuickBooks/general-ledger CSV export; bookkeeping migration written, not applied · Manage desks data ownership and compact directory accepted locally: 544 tests, ten browser checks and eight responsive reads · Main admin navigation polish accepted locally: desk search/browsing, report shortcuts, Home refresh and SVG warning fix; 535 tests, 29 responsive reads, 11 browser checks and iOS/Android HBC exports pass · ADM-02 main admin combined locally at :8081/admin: selected :3033 design, twelve reports and all 23 desks; 89 suites / 529 tests, Next build and iOS/Android exports pass; hosted/device checks pending · Local Expo launch recovered: native quarantine cleared, fresh web/iOS bundles and browser shell verified (78 suites / 443 tests); original historical loader error not reproduced · ADM-01 fix waves 1–3, readable event labels and the owner-chosen report format on every admin portal page are in place locally (uncommitted); `pnpm check` and portal tests 80/80 pass, and the final browser review is accepted (VISUAL_QA ACCEPT, ACCESSIBILITY PASS). The owner commits and merges. · All admin desks now follow Home’s report format; desktop/phone layouts, enlarged text, mouse controls and focus are verified locally. · The admin portal header now scrolls with the page to address hidden keyboard focus (ADM-01 follow-up; local keyboard focus verified, full portal re-review done and accepted: VISUAL_QA ACCEPT, ACCESSIBILITY PASS, 2026-10-12). · Every admin portal page now draws its numbers as charts with a written summary and a Data table. A missing number shows “—”, not $0.00. · A chosen cheer stays a white button with a colored edge, so it does not blend into the poll bar. The upload menu sits centered with Next under the choices. The Highlight bar is Home, search, and Local. · Analytics is eight dashboards and a measure catalog at `/analytics`, owned by `ANALYST`. · A video Highlight can post with Tag later and one permission line. Choosing an athlete no longer plays the clip inside the sheet. Donate stays off until an athlete is tagged. Photo stories still need an athlete. The night preview does not include this. · A downward swipe on a popup’s top bar closes it on a phone, and a finished upload drops the clip preview before the sheet closes. · The admin portal home is a measured dashboard, and the tabs are Home, Trends, Audience, Revenue, Health, and Product. · Swiping open the Highlight owner card no longer crashes the browser. · Popup menus close with a downward swipe. The admin portal Operations page tabs are Where, Buttons, Errors, and Menus. · The admin portal Departments page shows Billing, Marketing, Support, API, and IT on one read-only screen. `PORTAL` reports to `ADMIN`. · The preview server now has the confirmed test account `demo@tapuai.app`. Sign-in is Apple, Google, email, and password. The 13+ confirmation is only on Create an account. · Preview queued 2026-10-11 night. Android `5cca4a55-cfc3-4c58-9346-34b9e0433b27` and iOS `c5255651-06e3-4f46-9861-5a47ad1b434a`. They include the popup swipe and the upload black-screen fix. iOS still installs only on the one registered iPad. The evening builds `04244951` and `12d017d4` do not. · Guests can watch a shared Highlight and two more swipes, then the account sheet. Upload asks for an account before the composer. The test account stays on that sheet until a production build. · Redirect `alasports://auth/callback` is saved. Google sign-in stays in the sheet because the Google provider is still off. · A profile card edge and the next-tier line wear the earned Aura color. The Aura card control is filled with that same color. · One-time Exclusive is bought from the Vault tab and a locked Highlight. The profile row under the card is Donate and Share. · Profile counts sit inside the athlete card like a social profile: Seki, Riding, and Crew. Join is an icon under the Crew number. The story pills under the card are gone. Jev chose that three-count row (probability 0.70, confidence 0.40, 527 input tokens). · Seki and Flex now tell a story on a Highlight and on a profile. A play that makes the Seki pill says so, and “You called it” when you gave that Seki. Flex says you are riding with the athlete. Aura stays a count and a tier. No SQL applied. · Latest local app uploaded to EAS preview. Android `196a7acf-b18f-4af0-a4c8-85d7e9ab6afc` and iOS `9dad0fa8-1902-448f-82e7-03a9b4a869b5` are queued. They include the scoreboard and hype-glow fixes. The iOS profile still has one iPad. · Selected Seki, Aura, and Flex glow is painted behind the circle so the rail no longer clips it. Local Open flags shows the report reason and whether an athlete or guardian reported the clip. Strikes and appeals are unbuilt. The hosted database was not queried. · Jev walked the lib, data, and hook helpers. No replacement cleared confidence 0.90. QA accepted the mobile suite: 74 suites, 416 tests. Compliance gaps routed in `docs/legal/LEGAL_BRIEFING.md`. iOS preview `af6a7e72` installs on the registered iPad only. Android preview `6febe2bb` still in progress · Department plans: where each team is, and what public still requires · 2026-10-08 · Hierarchy grouped by reporting lead (90 agents) · VP of Operations (`VP_OPERATIONS`) keeps roles, protocols, and priorities current under the CTO · CTO assigns app fixes; leads report to `CTO` (90 agents) · Owner peek card redesigned (light Daylight card, 2 x 2 stats, equal-width Donate / Join Crew) · 2026-10-07 · Highlights prefetch the next and previous photo story · Photo stories in Highlights built locally (UX-05; SQL unapplied) · "Donate. Elevate. Celebrate." in four placements · Game Play → Game Day label · MCP servers (Playwright, Expo, Canva, Supabase dev) · 87 agents · Compact sports profiles (60 suites / 311 tests) / direct Goals and Team navigation; sport-matched Stats/Aura, missing data unreported; public sport migration prepared, unapplied · Sports UI browser verification and fixes (UX-03): 55 suites / 261 tests; identity/accessibility and narrow large-text fixes; native verification pending · Readiness R1 organization audited: web builds and 50 suites / 242 tests pass; CI Node 24 and persistent docs/credential guards; R2–R4 next actions clarified · Stripe secret moved out of `.env.local` (Edge Functions hold it); native-module quarantine cleared · Compact donation/menu integration verified locally (UX-02; 50 suites / 242 tests) · Compact staged video upload complete locally (UX-01) · 83 callable agents with functional ownership and CI registry validation · Specialist work queue in WORK_QUEUE.md · Guest route data boundaries reduced to 6 routes / 12 calls · Account-tag write/confirmation fixes prepared; SQL remains unapplied · Staging/build readiness and custodial DOB inventory corrected from local evidence · Wave 0 test mode; device and hosted SQL verification remain pending.

## 2026-10-13 — Innovation and outside handoff standard (STANDARD-01)

- Added a repeatable problem → bounded experiment → evidence → adopt/revise/stop workflow, including potential struggles and failed-experiment learning, in the existing task/design/incident records.
- Connected shared interface/naming/decision/diagram requirements to the existing agent, Support and admin-first feature workflows.
- Added audience reading paths and version/environment/owner/evidence requirements for outside engineers, legal reviewers and investors, with approved document scope and explicit readiness/gaps.
- Corrected stale duplicated department model labels in expert-standard prose; actual role pins and model table stay the reference. No runtime, schema, financial rule or legal conclusion changed.
- Local validation and documentation review pass: full gate 115 suites /827 tests, 180 Markdown destinations, 106-role consistency and 2 registered feature contracts. No outside-company walkthrough was performed.

## 2026-10-14 — Profile privacy, friends, blocking and tag approval

- Profiles can be public or private (new accounts start private), and people choose who sees their photo, bio, school, social links, stats, Aura, Crew lists and friends list: everyone, friends or only them. A private athlete's name, approved-tagged Highlights, Donate, Rally and gear goals and Join Crew stay public.
- Two-way friends with requests, blocking (the blocked person isn't told), hide from search, and a guardian lock that keeps a minor's settings strict.
- Tags wait for the tagged athlete's approval; an approved tag and a pending one look different, a pending tag doesn't name the athlete to strangers, and Spotlight and leaderboards credit a clip's earlier engagement once it's approved.
- Admins see privacy counts (never who) on the People desk and can reset someone to private defaults. Database changes are written and tested, not applied.

## 2026-10-13 — Engineering Support: detection and repair under Dev

- Reused SUPPORT under ENGINEERING with INCIDENT_TRIAGE, TELEMETRY and RELIABILITY; moved the last two from Operations and synchronized the 105-role roster. QA and finance/security/data ownership remain independent.
- Added a 14-sensor coverage catalog, six assigned gaps, incident/recovery template and detection/repair review in the admin-first feature workflow.
- Added `pnpm detection:scan`: runs the local quality gate and separate Next tests, retains bounded redacted check logs and interrupted/completed checkpoints, and reports failed/timed-out/skipped checks and missing runtime coverage. CI now includes detection tests/catalog, future-feature gates and separate Next tests. Nothing was deployed.
- Scanner tests/re-review pass 10/10; fixed timeout descendant cleanup, quoted-JSON secret redaction and stale hierarchy representations. Retained scans caught test/metadata cleanup mismatches and then verified recovery. Latest scan passes 681 app tests and 86 Next tests but flags 11 new admin-control exports awaiting callers in concurrent work; the global gate remains red. See DETECT-01.

## 2026-10-13 — Nothing left hanging: archive pass and data fixes

- Unused functions, components and constants (and the tests that covered them) moved to `archive/dead-code-2026-10-13/` in two passes, 62 entries in total; nothing was deleted. A new `pnpm code:unused` check fails on any new unused import or variable.
- Admins can now enter athlete career stats and game logs (Athletes desk), set custodial terms, manage school crests and the staff who confirm athletes (Schools desk), and see operator check-ins with location rounded to about 1 km plus a 90-day purge that takes two taps (Live games desk). Exact check-in locations are no longer readable from the table at all. Branding fields start from the school's current values, so saving one colour keeps the others. On the People desk, Unverify only removes the badge; a separate, warned "Revoke and unlink" goes through the verification ladder.
- Fans see Crew alerts on Activity and can clear them.
- The Look desk "Actions on top" switch now works (Donate / Share move under the profile tabs).
- Families now see what is recorded for their family account (after Tapua'i's share) and what fans donated, instead of the donated total shown as received. Other users can no longer overwrite someone's profile photo, and people can delete their own old photos (database change written, not applied).
- Production store builds no longer offer the demo test sign-in (the build profiles never told the app it was production). A plan for dev, staging and production environments, and for staying on Supabase versus moving to AWS or Azure, is in docs/engineering/ENVIRONMENTS_AND_HOSTING.md.
- Security fix (written, not applied): a full rebuild of the database schema showed that anyone with the public app key could write revenue rows into the books, raise donation totals and Aura, and change sport settings. A new migration closes every one; apply it first on staging.
- Operator check-ins are kept only to about 1 km (rounded on the phone and in the database), timed by the server, and deleted automatically after 30 days (privacy decision); the Live games purge can clear them sooner.
- Archived files are named `<name>.archived.<ext>` so they never look like live code, and the data map check enforces it. Twelve copies of the "not switched on yet" check became one, and the admin desks share one way to run a save.
- The data map also checks Storage buckets and feature switches; every item is owned and connected. The supporting migration is written and replayed, not applied.

## 2026-10-13 — Data governance: one map of where every piece of data lives

- A Data Governance team now exists. `DATA_GOVERNANCE` is the data control point and reports to the CTO; `DATA_LINEAGE` keeps the master data map and `CODE_HYGIENE` handles dead code. Every agent definition names the control point.
- `docs/engineering/DATA_MAP.md` is generated from the schema and the code. For every table and view it gives the owner, purpose, what writes it, what reads it, database functions, triggers and the screens that reach it; it also lists every database function's callers. `pnpm check` and CI fail when anything is unowned, write-only, never written, never called, or an unused export nobody has decided on.
- First findings: stats tables nothing writes, Crew notifications never sent, operator GPS never read, two admin functions with no control, and one unused function. 47 unused exports are proposed for archive and wait for the owner's approval; nothing was deleted.

## 2026-10-13 — Finance & Books: the Office of the CFO and its hub

- A Finance and Accounting team now exists in the agent roster: a CFO reporting to the owner, a Controller with a Bookkeeper and Internal Controls, a Tax lead (owns every tax area) with Information Returns and Sales Tax, Treasury, and Financial Planning. A Finance Data engineer in Engineering builds their data. How work flows: `docs/company/FINANCE_OPERATIONS.md`.
- `/admin/books` is now **Finance & Books** with eight tabs: Overview, Transactions (filter and export exactly what you see), Statements, Taxes (tax pack, readiness, federal deadlines), Reconcile (every donation, tip, card fee, Vault sale, booster and Drip order matched to the books), Data (every money column and who owns it), Record & close (including refunds of a whole charge), and Export. A **Finance** lens shows only the money desks.
- Nothing is exported or closed while any source is unread or the books do not balance. Athlete names and family-typed titles never leave the admin app.
- The bookkeeping migration was hardened after security and accounting review and replays 72/72 on Postgres. It is still not applied.

## 2026-10-13 — browser Highlight playback repair

- Interrupted browser play requests are handled inside Expo Video rather than escaping
  as uncaught errors. A versioned pnpm patch preserves immediate pause intent and
  ignores stale queued events and old-source failures.
- Highlight replacement waits for current-source readiness and focus. Failed clips
  show **This Highlight couldn't play.** with **Retry**; loading, failed and paused
  clips contribute no watched time. Sound changes can retry a refused start once
  without restarting a clip already playing. Photo stories retain their image player.
- Current Lightning CSS direct and Metro worker transforms pass. No native binding
  reinstall or quarantine removal was needed in this pass. Invalid hosted media can
  still fail; Retry does not repair its contents. [PLAY-01](docs/agents/PLAY-01.md)
  records reproduction, patch installation, final gates and remaining hosted/device checks.

## 2026-10-12 — admin data consolidation

Related editors share App setup and Highlights & review workspaces; saved routes remain
reachable. Payouts clarifies Money, Coverage joins Product, and QA/Lab stop repeating
financial/health dashboards. Analytics selects a complete board; Trends retains comparisons;
Revenue stream views and Profile settings are consolidated. Health restores operational
triage with unknown/error states. Moderation keeps full evidence on narrow screens.
Future feature agents register and verify admin handling before building app experiences;
registered lifecycle checks join the project gate. Manage now has 18 entries with all 24
saved routes preserved, including Books and two compatibility redirects. Local acceptance:
611 app tests, 13 workflow tests, 86 compatible Next tests, 56 responsive reads and 19 browser
interaction checks passed. Hosted data and native-device acceptance remain pending.


All notable product and schema shifts for Tapua'i (`ala-sports`). Keep this file current when landing features.

## 2026-10-12

### Books: Tapua'i's bookkeeping in the main admin

- New Commerce desk **Books** (`/admin/books`): profit and loss, money held for families (a liability, not income) with a per-athlete subledger, trial balance, journal, and a tax-year pack for the CPA (gross receipts, quarterly net with estimated-tax dates, pass-through money for 1099-K reconciliation, payees to review, Drip sales by month).
- Lists what a bookkeeper would question, worst first, and refuses QuickBooks exports while the books do not balance or the read was incomplete.
- Exports a QuickBooks Online journal CSV (daily summary with no athlete names), a general ledger CSV, the chart of accounts and the tax pack. On a phone they open in the share sheet.
- Record Stripe fees, expenses, Stripe payouts to the bank and owner money, void by reversal, and close a month. These need migration `20261012210000_bookkeeping_ledger.sql`, written and not applied.
- Donations now also record the card fee a donor covered and the Stripe payment id, once that migration is applied. Guide: [BOOKKEEPING.md](docs/engineering/design/BOOKKEEPING.md).

### Manage desks: one place for each task

- Manage desks opens on request and closes when a desk is chosen. View and Group filters replace repeated headings; QA and Lab appear once in Tools.
- Money focuses on queueing and reviewing disbursements. Existing confirmation and status controls remain; Revenue holds the ledger, stream splits and donation history.
- The old Reports address opens Analytics, avoiding a second dashboard with the same metrics. All saved desk addresses remain supported; 22 editing/utility desks appear in Manage desks.
- Local verification and remaining follow-ups: [MAIN_ADMIN_PORTAL](docs/engineering/design/MAIN_ADMIN_PORTAL.md).

### Main admin: find desks and navigate reports

- Manage desks can browse groups while keeping the current report open. Desk links show their existing descriptions in open divider rows.
- Search finds editing desks by name, group or description within the chosen lens. It includes QA/Lab utilities, reports the number found, and explains how to recover from an empty search.
- Longer reports have “In this report” shortcuts. They scroll and focus the current report’s section, including Analytics’ full measure and list catalogs.
- Home includes Refresh report. Refresh is disabled while loading and when report access is unavailable.
- Revenue rings use a compatible SVG rotation, removing the invalid DOM property banner on web.
- Verification and unchanged hosted/device follow-ups: [MAIN_ADMIN_PORTAL](docs/engineering/design/MAIN_ADMIN_PORTAL.md).


### One main admin application

- Expo `/admin` combines the owner-selected `localhost:3033` report design with all 23 existing editing and utility desks. Home, Trends, Audience, Revenue, Health, Product, Analytics and Departments share its scrolling header and open report layout.
- Product includes Features, Profile, Sign-in and People oversight. Manage desks keeps the role lenses, nested trails, drafts, confirmations and explicit Publish controls.
- Expo and the compatible Next reporting client share platform-neutral report models. Missing values, source errors, donation bands, partial ledger reads and Wave 0 payment notes remain visible.
- Charts include complete Data values. Home retains donation counts, weekly comparisons, View Trends and the community support summary. Admin entry uses its own sign-in controls and no longer opens the first-visit fan welcome.
- Local verification and remaining hosted/device checks are recorded in [ADM-02](docs/agents/ADM-02.md). No SQL, role grants, publication or deployment was performed.

### Admin portal: readable labels and steadier numbers

- Activity lists on Trends, Analytics, Health and Departments show readable names, such as “Seki on a Highlight”, “Join Crew” and “Upload retry (upload)”, instead of raw event codes.
- Each measure keeps one colour on every page, so donations, clips and stalls look the same wherever they appear.
- Numbers no longer break across two lines, peak labels stay inside the chart on the first and last day, and a small day still draws a visible column.
- Every page has its own browser tab title, such as “Trends · Tapua'i Admin”, and the sign-in page is titled “Sign in”.
- Money lines use plain donation wording. The Vault split reads “Vault: 80% recorded for the athlete, 20% to Tapua'i · Drip: 100% to Tapua'i”.
- Minutes and durations read the same way on every page (“<1 min”, whole minutes, “850 ms”, “1.3 s”).
- The all-time donation totals on Trends are a list for admin review, with no rank numbers.
- Sign-in announces progress and errors to screen readers, and a missing value is spoken as words, not read out as a dash.
- Home shows video stalls in red when there are any. Analytics no longer has the “Around the game” chart.
- Counts on Health stay on one line at phone width, and the Product tab stays marked while you are on one of its desks.

### Consistent admin report format

- This report format is the default look on every page, by the owner’s decision.

- Trends, Audience, Revenue, Health, Product, Analytics and Departments follow Home’s wider layout, bold headings, open charts and lighter dividers.
- Home keeps its unique community support overview. Product subpages and Health tabs use the same navigation style.
- Ledger tables and phone rows retain their values and donation notes in the shared report layout.

### Community support dashboard

- Home opens with “A week of community support.”, the donation total, a wide donation chart and a compact clip chart.
- Supporting measures follow in a simpler report layout. Recorded values, source disclosures and the read-only workflow remain available.
- Home navigation and source labels wrap for narrow screens and enlarged text; the Trends action keeps readable white text.

### Admin portal keyboard navigation

- The header scrolls with the page so it cannot cover a focused control when navigating backward with the keyboard.

### Admin portal charts

- Every admin portal page draws its numbers as charts. Each chart has a written summary and a Data table with every value.
- Home, Trends, Audience, Revenue, Health, Product, Departments, and the eight Analytics dashboards use the same chart kit.
- A number the portal did not receive shows “—”, not $0.00.
- Revenue keeps the test-mode banner and shows the donation split. Labels say QR donation link and Gear goal.
- Time on tabs shows minutes, scroll depth shows a percent, and the content label is Game Day.

## 2026-10-11

### Highlight bar, upload, and cheer poll

- The Highlight bar is Home, search, and Local. All and Seki are off that bar.
- The upload menu is centered, and Next sits with the choices.
- A chosen side on a live cheer poll stays a separate button from the share bar.

### Analytics

- The admin portal has an Analytics page: eight dashboards and a catalog of every measure the app already reports. A missing measure stays blank.

### Upload

- A video Highlight can post with Tag later. One permission line covers footage, sound, and marks. This is me is the first choice when the signed-in account is that athlete. Donate stays off until an athlete is tagged. Choosing an athlete no longer plays the clip inside the sheet. Photo stories still need an athlete.

### Preview

- Android and iOS preview builds were queued again so a phone can install the popup swipe and the upload black-screen fix. iOS still installs only on the registered iPad.

### Phone menus and upload

- A downward swipe on the top of a popup closes it on a phone.
- After a Highlight publishes, the clip preview leaves before the sheet closes, so the app does not stay on a black screen.

### Preview

- Android and iOS preview builds were queued again so a phone can install guest looking, the sign-in sheet, swipe-to-close, and the owner-card fix. iOS still installs only on the registered iPad.

### Admin portal

- After sign-in, Home is a dashboard of measured numbers and 7-day charts. The tabs are Home, Trends, Audience, Revenue, Health, and Product, in one equal row. Daily people, retention, and acquisition cost are named as not measured.

### Owner card

- Swiping a Highlight sideways to open the owner card no longer crashes the browser.

### Operations and popup menus

- Popup menus close when you swipe down on the grab bar.
- The admin portal Operations page breaks the same reports into Where, Buttons, Errors, and Menus. The open tab says the busiest place, the most used button, or the most reported error, then lists every smaller row.

### Management desk

- The admin portal has a Departments page for Billing, Marketing, Support, API, and IT. Failed reads and empty windows are marked on that page. A partner reads it after an admin signs them in. There is no public data key.

### Guest looking

- A guest can watch the Highlight in front of them and two more swipes. The next swipe asks for an account. Upload asks before the composer opens. The test account stays on the sign-in sheet, with its email and password, until a production build.
- The preview server was missing that test account, so the button reported invalid credentials. The confirmed account is on staging now.
- Sign-in is Continue with Apple, Continue with Google, email, and password. Create an account is a separate step, and that is the only place the 13+ confirmation appears.
- Preview queued 2026-10-11. Android `fe188b8e-2a66-486f-a24e-9085dd6f7676`. iOS `b16cc2cb-fb2c-4acf-9de1-430f82f53d9e` (registered iPad only).

## 2026-10-10

### Google sign-in

- Redirect `alasports://auth/callback` is saved. Continue with Google stays in the sign-in sheet while the Google provider is off, instead of opening a page that does not create an account. Email still creates the account.

### Aura card color

- The profile card edge and the Aura card control use the color of the tier already earned. The bar names the next tier. The words on the filled control stay dark so they stay readable.

### Exclusive on the Vault

- The athlete profile row is Donate and Share. One-time Exclusive is bought from the Vault tab and from a locked Highlight. The price and the one-time charge are unchanged.

### Profile counts

- An athlete profile shows Seki, Riding, Crew, and Squad as separate counts inside the profile card. Join Crew is the icon under the Crew number. Squad is the mutual-follow count and has no join button.

### Seki and Flex stories

- A Highlight and an athlete profile now say when a play made the Seki pill, including “You called it” if you gave that Seki. Flex says you are riding with that athlete, and names the crew once three people have. Aura stays a count and a tier.

### Live play hype

- On a live play, each person can give one Seki, one Aura, and one Flex. Tapping again clears that one. The button fills when it is on and dips when it comes off. It never counts past 1.

### Menus and tabs

- Popup sheets, the fan bar, and the Home / All / Seki switch move with a short settled slide.

### Exclusive and booster prices

- Exclusive buttons say **One-time Exclusive · $4.99**. Vault sentences say one-time Exclusive access and show the price with no monthly period. Booster prices show as **$50**, **$150**, and **$500** with no period. The charge is still a one-time payment. Donation words are unchanged.

## 2026-10-08

### Highlights owner card

- The card that slides in when you swipe a Highlight now matches the rest of the app: a light rounded card with a header colored by the athlete's Aura tier, a clear "On this clip" row (the tag, or just whether it is a video or a photo story), a visible "Posted by" line, four stats in a tidy 2 x 2 grid, and Join Crew and Donate as two equal buttons. The @handle shows only when the athlete has an account with a real username. Join Crew, Donate and Open full profile stay pinned at the bottom (and Close at the top) so they never scroll off small phones; on narrow phones the verified mark sits on the avatar and the header is slimmer. Screen readers hear the athlete's name first, plain labels without bullet characters, and reduced motion skips the entry animations. The cyan used for text on cyan washes (Island Cyan tier, Local accent) is a little darker to meet the contrast minimum.

## 2026-10-07

### Photo stories in Highlights, and "Donate. Elevate. Celebrate."

- Highlights can now be one photo or a swipeable story of up to 10 photos: reorder before posting, add an optional description to each photo, tag the athlete, and pick Game Day, Train Like Me or Serve Like Me. Stories sit in the same feed as clips with a `1 / 5` counter, show a `📷 5` badge on profile grids, and donate to the featured athlete through the usual popup. The story just above or below the one on screen loads ahead of the swipe. Hype, save, report and "Filmed by" work as on clips. Photo stories are public only for now.
- Location and camera details are removed from every photo before it uploads; a photo that cannot be cleaned is not uploaded. A story appears only if every photo uploads.
- The first category is now called **Game Day** (it was Game Play) for photos and videos.
- The message "Donate. Elevate. Celebrate." — *Support their journey. Elevate their opportunities. Celebrate their story.* — appears on the welcome screen, at the top of the donate popup and under an athlete's Donate button.
- Database changes for photo stories are written (`20261007230000_photo_stories.sql`) but not applied, so the Photos option stays hidden until they are. Fixed a likely cause of the first Highlights clip not loading its video (to be confirmed on a device).

### Compact sport profiles and direct goals

- Profiles and Aura cards share the selected sport and published stat labels: Volleyball uses Matches/Kills/Digs, other sports their playbooks. Missing real data stays unreported; old totals from another sport are excluded. Aura points have their own label.
- Shorter photo/name hero and compact 44-point actions; wrapping sections bring Goals/wishlist, Stats, Team and owner Manage into reach. Goals shows wishlist first; Team opens teammates; Manage holds thank-yous and owner Vault tools.
- Public profile switching rejects stale loads, hidden schools remain hidden, and exact player links govern ownership. One-time exclusive-access wording is consistent with checkout.
- Public selected-sport view migration prepared locally and mirrored in canonical SQL; not applied. Figma profiles/Aura and Canva sports-direction designs created. Native/hosted verification remains pending.

### Sports identity across Local, Profile and Highlights

- Browser verification follow-up: exact player links prevent same-name credential borrowing; community heroes suppress favorite-athlete school proof; spoken scoreboards include school names; dismissal has a 44-point button target.
- Narrow large-text fixes let Local scores wrap and Highlight copy/actions scroll beneath measured header chrome, with Aura bursts outside rail clipping. Full check passes 55 suites / 261 tests; browser evidence is in AUDIT_REPORT. Native accessibility/playback/paging verification remains pending.

- Local cards pair full team/school names with separate scores and recorded game status; scheduled games no longer look like live 0–0 results, and missing scores/clocks stay unreported.
- Profile hero gives athlete identity more emphasis and shows only supplied sport, position and class details. Community profiles hide athlete credentials; confirmed school crests keep their existing rule.
- Highlight overlays add actual roster jersey/position and more room for athlete/school names; match banners use the same scoreboard presentation rules.
- Full integration passes both app typechecks, 53 suites / 256 tests and all project guards; 17 targeted Local/Profile/Reel/banner checks cover the changed surfaces. Local Expo web export passed in the initial pass. Browser follow-up is recorded above; native layout/accessibility checks remain pending.

### Organization verification and readiness

- Verified the reorganized documentation and workspace paths; added persistent local-link and client-credential checks to `pnpm check` and CI, with CI on Node 24.
- Corrected read-only Next Profile instructions and onboarding/build guidance.
- Reconciled saved staging migration dates and clarified R1–R4 requirements, baseline replay, and production dependencies.
- Both app typechecks, 50 suites / 242 tests, all guards, Expo web and iOS/Android bundle exports, and Next optimized build pass locally. Native interaction, real test payments and hosted database replay remain pending.

### Compact donations and shared Daylight menus

- Donate now stays in one popup with Amount, Options and Review pages; Back/Next and the final Donate action stay outside scrolling content.
- Amount and optional extras survive Back; only the reviewed final action opens payment. Pending checkout locks duplicate taps and dismissal, and a closing popup cannot start payment.
- A completed payment cannot be charged again in the same checkout when saving the donation or updating counters fails; the warning distinguishes this from payment failure. Replacing the inline recipient prevents the previous recipient’s completion from changing the new checkout or firing its callbacks.
- The optional card-fee control announces the exact fee and unchanged family share to screen readers.
- Upload and shared fan menus/pages gain rounded cards, accent washes and step chips using the existing Island Daylight palette; full-screen video retains its contrast.
- Added DOCUMENTATION under Engineering, bringing the callable roster to 83. All existing agents now hand off documentation evidence; MENU_STYLE_MAP records modal/page coverage and tester gaps.
- Local integration: full Jest passes 50 suites / 242 tests; the latest checkout callback guard also passes all 8 targeted checkout tests. Both app typechecks pass; independent review found the four checkout issues addressed.
- No native screenshots, keyboard checks or Stripe-device verification recorded for this pass; press stills are stale.

### Compact video upload

- Upload now has three short steps: Video, Details, and Review. Back and Next/Publish stay outside the scrolling content.
- Athlete and game choices open searchable selection screens. Game links, account mentions and Vault access live under More options.
- Back preserves the draft; choosing another clip resets rights confirmations. An optional game starts unset instead of silently linking to a demo matchup.
- Publishing remains gated on an athlete, caption and all applicable rights confirmations; a duplicate tap cannot start a second upload.


### Account mention reliability

- Failed mention confirmation keeps the request visible and explains how to try again.
- A successfully published Highlight remains published when account mentions fail; the uploader sees an accurate warning.
- Pending account-tag SQL now serializes additions to enforce three active mentions across concurrent requests and returns no success for a missing, foreign or already answered tag. The migration remains unapplied.

### Specialist ownership and maintainability

- Expanded the roster to 82 callable agents, updated all existing definitions and reporting hierarchy, and assigned work through `docs/agents/WORK_QUEUE.md`.
- Added registry consistency checks to CI. Guest game/player routes now use data helpers, reducing route database exceptions from eight to six.
- Corrected historical staging/branch status and the privacy inventory's custodial birthdate exception.

## 2026-10-02

### Account tags

- On a Highlight, the uploader can mention up to three accounts. The name stays hidden until that person taps That's me on their profile. Donations still go to the athlete in the clip. The database change is written and not applied yet, so the search stays empty until then.
- A fan digital signature on the Aura card is named for a later phase. It is not in the app.

### Support received

- An athlete with no donations sees **$0.00** and "No donations yet". A missing or failed donations call shows the same empty total, not "Could not load donations".

### Highlights

- Rivalry week on Highlights can be swiped left or right to dismiss. A tap still opens the school poll.
- The donate sheet opens at the title, stays on the screen, and scrolls when there is more to read.

### Drip waits

- The Drip tab is off. The marketplace stays in the app and comes back in Wave 1. Admin → Features can turn `tabs.drip` on later, then Publish to app.

## 2026-10-01

### Footage, sound, and marks

- Before a Highlight publishes, the uploader confirms they filmed it or have permission, the sound is the original recording or music they have the right to use, and they are not treating a school logo, team mark, or TV broadcast as theirs. A game-play clip also confirms it is real footage, not AI-made or a face swap.
- Report / Hide asks why: fake or AI-made footage, the wrong athlete, impersonation, music or a logo or a broadcast without permission, inappropriate, or other. Fake footage, impersonation, and music/logo/broadcast leave the public feed for review. Other reports hide the clip after the tagged athlete, their guardian, or three separate accounts report it.
- Needs migration `20261001180000_content_rights_reports.sql` on the database the app is talking to.

## 2026-09-29

### Telemetry

- A new migration (not applied yet) caps what one analytics row can say, so a single fake event cannot wreck Reports. Guest browsing still logs. Signing in is not required to record a visit.

### Tabs, role portals, and operator reliability

- An active school rivalry now appears above Highlights and opens Local directly on the school poll.
- Activity thank-you rows open the athlete who sent the thank-you. Drip supports pull-to-refresh and distinguishes a load failure from an intentionally empty rack.
- Athlete, Parent, Booster and Sponsor tools now show Retry when their private data fails to load instead of saying there are no donations, athletes, requests, or placements.
- Operator check-in only says “Checked in” after the database accepts the coordinates; the scorer portal can retry its initial load.
- Engineering review now has a PR checklist, CODEOWNERS, folder placement guides, and a CI check that prevents new direct Supabase queries in Expo route files.

### Audit fixes

- Sign-in sheet: a fast double tap on Apple / Google / email / magic link no longer starts two sign-ins.
- Admin → Money: **Mark paid** and **Failed** ask before changing a payout and show an error if the save fails.
- Admin → People: **Verify / Unverify** and **Grant / Revoke admin** ask before they apply.

### Rally goals, say thanks, and a clear 90 / 10 split

- **Rally goals.** A family can start a Rally on the athlete's profile for a real sports cost — season fees, gear, travel, camps, college prep — with a goal, a short story and an optional end date. Fans see the progress bar, donate toward it, and share it. A compact meter on the current Highlight does the same. Filling a Rally opens a full-screen moment, and "Watch what it paid for" plays that clip. A Rally an athlete starts waits for their parent or guardian to approve it in Parent HQ.
- **Say thanks.** Every donation now has a **Say thanks 🙏** button for the athlete and their parent or guardian (on the profile and in Parent HQ). A filled Rally asks them to thank everyone, optionally with a clip of what it paid for. Donors see "{athlete} said thanks" in Activity. Thank-yous are five preset messages — no free text — because many athletes are minors.
- **The split, said plainly.** The donate sheet now says 90% goes to the athlete's family account and Tapua'i keeps 10% to run the app, including card processing, with a breakdown line that updates as you choose.
- **Optional tip for Tapua'i.** Like GoFundMe, donors can add a tip for Tapua'i (No tip / 5% / 10% / 15%). It starts at **No tip** and never comes out of the donation. The "cover card fees" box now starts **unchecked**.
- Needs migration `20260929180000_rally_goals_thanks_platform_tip.sql` (not applied); until then the Rally card and thank buttons stay hidden. The split line and tip choice show right away; a tip picked before the migration is charged and noted in Stripe metadata, but the donation row is saved without it and no `tip` revenue row is written.

### Donations, in plain words

- The app now says **Donate** everywhere you give money: "Donate to Kaleo", "Donate $10", "Donation History & Receipts", "Donate $5 to this goal". "Mālo", "tip", "backing", "Chip In" and "Share & Fund" are gone from the screens. "Mālo!" is now only how we say thank you ("Mālo! Your donation to Kaleo is on its way").
- The donate sheet says where the money goes: to the athlete's family account for sports costs, not to whoever posted the clip, never for a play or a stat, and not tax-deductible.
- First open explains the mission: Tapua'i helps families cover their young athlete's sports costs with donations from their community.
- New `pnpm copy:check` (runs in CI) and a VOICE agent keep the wording consistent.

### Filmers: tiers, Top Filmers, Aura and Props

- **Tap "🎥 Filmed by …"** on any clip to see that filmer's clips, views, hype and Props, and send them **Props 🎥** (once per clip, sign-in needed). Mālo still always goes to the athlete in the clip.
- **Filmer tiers:** Rookie (1 confirmed clip), Sideline (5 clips or 1K views), Pro (25 or 10K), Legend (100 or 100K). Shown on your profile, with how far to the next one; your profile invites you to film a teammate's play if you haven't yet.
- **Filmers earn Aura:** +10 when the athlete confirms your clip, +10 / +50 / +200 at 100 / 1,000 / 10,000 views, +1 per Props.
- **Top Filmers 🎥** tab on the Spotlight boards (views + hype + Props on confirmed clips this week / month / year).
- Needs the new database migration before it shows real numbers.

### Views, filmer credit, and tagging who's in the clip

- **What counts as a view:** 3 seconds of the video actually playing (or 90% of a clip shorter than that), by a signed-in account that isn't the uploader or the athlete in it, once per account per clip per day. Paused, locked or swiped-past clips don't count.
- **Views on profiles:** every clip on an athlete's profile shows a ▶ view count, and the Aura card's "views" total now adds up the views on their confirmed clips. Seki / Aura / Flex stay on each clip, like likes.
- **"🎥 Filmed by …"** on clips a fan posted (handle or first name only; not shown when the athlete posted it themself).
- **Uploads no longer pre-pick an athlete.** "Who's in this clip?" must be chosen, because Mālo goes to whoever is tagged. An athlete posting their own clip starts tagged as themself.
- The swipe-for-the-athlete panel now finds who posted a clip (it was looking them up by the wrong ID).

### Highlights: Seki / Aura / Flex fixed and simplified

- Un-Seki / un-Aura no longer flickers or jumps to another video: the Home feed used to re-sort itself on every tap (and the Seki pill dropped clips that fell below 3 Seki), sliding a different clip under your finger. The order now only changes when you pull to refresh or switch pills.
- A tap right after swiping onto a clip sticks — it's no longer undone when your saved votes finish loading. Tapping Seki and Aura quickly keeps both.
- Effects: **Aura** keeps the burst; **Seki's 🤙 turns into a 🏈** for a moment, like YouTube's like button; **Flex** just lights up. Removing a vote is instant with no effect.

### Payouts without waiting on the school, and the school crest

- **School confirmation is now a badge, not the only way to get paid.** An athlete's payouts can unlock once a parent (or the 18+ athlete) passes Stripe's ID check, with one claim and no dispute. Until **3 teammates vouch** or the school confirms, payouts are capped at **$250**. (Payouts are still switched off; the cap is enforced when the payment ledger lands.)
- **Vouch for teammates** card on Activity for confirmed athletes: "They're on my team" (same school only, 10 a day).
- Activity's verification card now says when payouts are unlocked (and the cap), or what setup is missing. Held-gift wording now says "until their family finishes payout setup" (counsel to review).
- **School crest on confirmed athletes:** the school's colours behind the profile photo, the crest on the edge of the ring, a small crest on the Aura card, and "✓ {School} athlete". Tap the crest to see who confirmed them and when. Tapua'i sets each school's logo and colours.
- Names can no longer include check marks (✓ ✔ ☑ ✅), so nobody can fake the badge in their name.
- **Aura card flip fixed:** the flip now works inside the card viewer, the overlapping "flip" chip is gone, and an **Identity / Season stats** switch sits under the card. The profile's "Flip Aura card" button is a proper pill.
- Schema: `20260929130000_payout_gate_without_school.sql`, `20260929140000_school_badge.sql`. **Not applied to the live DB.**

### Faster sign-up

- The sign-up sheet now leads with **Continue with Apple / Google**; email and password sit below "or use email".
- Claiming an athlete profile needs only **team and sport**. Roster number, position and graduation class are optional and can be added later.

### Athlete verification — the school confirms, gifts wait

- Anyone can still claim to be an athlete. A claim, or a school/team code, now makes the account **"Verification pending"** — a team code no longer verifies on its own.
- The athlete's **athletic director or coach confirms them in person**: the athlete taps **Show my school code** on Activity (6 digits, valid 30 minutes), and the staff member types it into the Tapua'i school form (`alasports://school-confirm?t=…`, one link per staff member, issued by Tapua'i), ticks "I met this student in person and they are on my roster", and signs with their name. "Not on my roster" declines.
- While pending, the athlete sees on Activity: *"Fans can already send you gifts. They're held and only paid out after your school confirms you."* Fans see a matching line on the gift sheet. (Held today simply because payouts are off; the cap and automatic refunds need the payment ledger.)
- Two accounts claiming the same athlete are both frozen for Tapua'i review.
- Security: accounts can no longer mark themselves verified or link themselves to an athlete; admin approval stamps only the requester, not everyone with the same name; a same-name stranger can't borrow a verified badge or avatar; tag confirmation no longer matches by name or jersey. **Accounts verified only by a team code go back to pending** when the migration is applied.
- Schema: first file in the new `supabase/migrations/` folder, `20260929120000_athlete_verification_ladder.sql` — `school_confirmers`, new `verification_requests` columns, a guard trigger and 10 RPCs. **Not applied to the live DB.**

### Custodial money rules — the athlete stays in the loop

- A guardian's custodial account holds only that one athlete's money. Parent HQ lists only athletes linked to the signed-in guardian, and each gets a card: date of birth (entered once), "Is the payout bank account in the athlete's name?" (strongly encouraged), and **ask the athlete to approve a withdrawal**.
- The athlete sees a card at the top of Activity: who holds their Mālo, until when, and every pending request with **Approve / Decline**. No withdrawal proceeds without the athlete.
- At 18 (or the state's age, admin-set 18–21) control passes to the athlete automatically; the guardian can no longer ask, and the athlete's own withdrawals are approved at once.
- Schema: `custodial_accounts`, `athlete_birthdates`, `custodial_withdrawals` plus seven RPCs (`supabase/legacy/custodial_money.sql`). **Records only — no money moves; payouts still return 503.** Not applied to the live DB.
- Removed the misleading Parent HQ "Set up Stripe custodial payout" button, which sent a hardcoded $25 payout request.

### M1 leaderboards

- Spotlight **Boards**: most-hyped players, most-viewed players, most-viewed Highlights, school standings and top fans for the Spotlight week. Hype and views only — never money. Behind `layouts.leaderboards`.
- Highlights now count views: one per signed-in viewer per clip per day, after 2 seconds on screen; the uploader and the tagged athlete don't count. Schema: `reels.view_count`, `reel_views`, `record_reel_view`, `get_leaderboards` (`supabase/legacy/leaderboards.sql`). Not applied to the live DB.

### Apple Pay and Google Pay

- The Mālo PaymentSheet offers Apple Pay and Google Pay (Google Pay in test mode unless the key is live). Needs a new build; Apple Pay also needs the merchant ID registered with Apple and a Stripe certificate.

## 2026-09-28 (later)

### Activity replaces Local in the fan bar

- New **Activity** tab: Mālo you received, Mālo you sent, and highlights waiting on your tag confirmation, newest first. Rows that need a decision sort above the timeline. Built from sources that already exist (`get_received_malo`, `get_fan_tip_history`, pending tags), so **there is no notifications table yet — no unread state and no push.** Pending tags are filtered to the viewer's own player (the RPC returns every confirmable tag, which for admins is all of them). A failed load shows a Retry state instead of "Nothing yet". Signed-out shows a sign-in prompt. Admin → Features gains a **tabs.activity** switch.
- **Local** moved out of the fan bar and into a pill at the end of the Highlights row, styled deliberately unlike its neighbours (divider, cyan outline, location pin, chevron) because it navigates rather than filters. Still routable at `/local`. **tabs.local** still works as a kill switch: it hides the pill and pauses the Local screen.
- **Home / All / Seki** pills now carry live clip counts, so the labels say what is behind them.

### Seki / Aura / Flex stopped glitching

- Tapping a chip used to re-render every mounted `ReelCard` — video chrome, blur, Skia glow and the action rail — because the new count bubbles to the feed, which rebuilds every clip object. `ReelCard` is now `React.memo`'d with an explicit comparator, behind a thin wrapper that passes identity-stable callbacks so a skipped render never holds a stale `onTip` (which captures auth state through `requireAuth`). That cascade, not the counter, was the jank.
- A per-kind generation token discards superseded server responses, an in-flight counter stops the feed's echo overwriting the optimistic value, and neither handler adopts a server row that did not actually move the count. Un-voting no longer snaps the number back. Counts that arrive while a tap is in flight are adopted once it settles.
- The burst and shout play only on a tap that adds a vote; tapping a selected chip removes the vote quietly.

### Effects and sheet chrome

- `HypeBurst` is larger and reads on video: 10 rotating sparks, a double shockwave ring, 24pt shout, and a Reduced Motion path. It fires at the tap point only — there is no second centred burst.
- Eight bottom sheets now share one `SheetHandle` and one `SHEET_BLUR_INTENSITY`. The handles had drifted apart and backdrop blur was 40 on some sheets and 48 on others.
- The Aura trading card flips on a body tap; the standalone **Flip Card 🔄** button and the duplicate hamburger entry are gone. A 🔄 chip on the card is the affordance.

### Local wears its own colour

- Local was themed in gold, which is Spotlight's accent. Hub switcher, search field, section rules, loading spinner and the sponsor CTA now use `TAB_ACCENTS.local` cyan. Gold stays reserved for sponsor **tier** (`sponsorCardGold` / `sponsorCardOn`). Sponsor rail gained elevation and a scroll reveal, the boosters pane gained a reveal, and the School polls heading sits on one line.

### docs/STATE.md

- New `docs/STATE.md` is the read-first entry point for engineers and AI agents: current state, recent changes, environment constraints, knowingly-broken list, open decisions. `CLAUDE.md` imports it, `AGENTS.md` and `README.md` point at it, and CI fails a pull request that changes `apps/` / `packages/` / `supabase/` without updating it.

## 2026-09-28

### Sign in is no longer age-gated

- The 13+ confirmation on the Soft-Wall email form gated **Sign in** as well as Create account, which locked out returning email accounts that already existed. The checkbox is a COPPA attestation for accounts being *created*, so it now gates Create account and the magic link — both of which can mint a new row — and not Sign in. The rule lives in `softWallEmailGates` (`lib/auth.ts`) with unit tests, rather than inline in `SoftWallModal`, so it cannot quietly come back.

### Highlights search and Spotlight land on the clip

- Searching Highlights and tapping a result did nothing when the **All** pill was already selected: the pending clip was held in a ref and the effect that resolves it only re-ran when the filter actually changed. It is state now, so the jump lands whichever pill is active. Tapping a feed pill cancels a pending jump.
- Spotlight **Watch Full Highlight** silently did nothing from the Highlights tab when the award's clip sat outside the active filter. It now widens the feed to All and jumps, and if the clip is not in the feed at all it opens the athlete's profile — the same fallback chain the Spotlight tab already had.

### Seven unused components removed

- `ScoreboardBanner`, `GameEventCard`, `ScoreHeader`, `ReactionButtons`, `HighlightClipCard` (an unused alias re-export of `Reels/ReelCard`), `ScorerHeaderButton`, and `Profile/AuraCard` had no importers anywhere. Deleted, and the component lists in `AGENTS.md` / `docs/engineering/SYSTEM_OVERVIEW.md` / `docs/engineering/SCHEMA.md` corrected — the live card is `Profile/AuraTradingCard`. `docs/engineering/AUDIT_REPORT.md` now marks sections 1-7 as the 2026-09-14 snapshot and records this pass.

## 2026-09-27

### Preview installs

- Internal preview builds for this Mālo ledger pass: [iOS](https://expo.dev/accounts/logoitino/projects/ala-sports/builds/b4b8c235-cbc6-4ae7-ada8-4dadb4a25835) (registered iPad) and [Android](https://expo.dev/accounts/logoitino/projects/ala-sports/builds/1c8b92f0-36b6-48ca-b7d8-c35a1ca02a19) (APK).

### Money desks and athlete profiles read the gift channel

- Next `/money` charts Mālo by surface (Highlight, QR link, Wishlist, Profile, Live feed), by arrival (in the app or a QR gift link), and by the last 14 days, then lists each gift with athlete, fan, item or clip, and amount. Overview names the top surface. Expo `/admin/money` shows the same surface bars. An athlete's own profile and Athlete HQ list gifts they received. Apply `supabase/legacy/tip_origin.sql`, then `supabase/legacy/malo_ledger.sql` (`get_admin_malo_breakdown`, `get_received_malo`).

### Terms name the Mālo record

- The prototype Terms of Service & Privacy summary (`LEGAL_TERMS_VERSION` `2026-09-27`) tells fans we store where each Mālo started, including the wishlist item, and that we use that record for receipts, athlete accounting, and to see which parts of the app bring in support. The same notice sits on the Mālo sheet. This is still a prototype summary, not a finished privacy policy.

### Mālo rows name where the gift started

- Each `tips` row records `origin` (Highlight, QR link, Wishlist, Profile, Live feed), `entry` (`in_app` or `qr_link`), and, for a locker Chip In, `wishlist_item_id` plus the item title. One row is the ledger. `chip_in_wishlist_item` still only moves the item total. Company-revenue labels keep `source=malo` and add the channel, including a re-run of `supabase/legacy/company_revenue.sql`. Apply `supabase/legacy/tip_origin.sql` on the live database.

### Local plays open downward

- A Local live-feed card leads with the athlete, the play, and a one-line stat. The gold chevron enlarges that same card to Seki, Aura, Flex, and Mālo.

### Toasts swipe away, and hype chips toggle

- Aura notices, live-score banners, and play callouts dismiss on a swipe left, right, or up.
- A second tap on Seki, Aura, or Flex takes that reaction back. `clear_reel_hype` deletes the fan's vote and steps the Highlight counter down. Apply `supabase/legacy/clear_reel_hype.sql` on the live database for the count to stick.

### Popup cards share one frame

- Fan sheets, centered dialogs, and the Highlights owner peek use one width rule: equal side gutters, a 440-wide card on a browser, and the same padding on an iPhone SE through a Pro Max. `useSheetFrame` owns the sheet chrome. The owner peek caps at 420 and keeps a close strip.

### School Poll writes are admin-only

- `upsert_cheer_poll` rejected signed-in non-admins and allowed anon, because the guard was `current_user_role() <> 'admin' AND auth.role() <> 'anon'`. It now requires `current_user_role() = 'admin'`. Execute is `authenticated` only. The `cheer_polls` write policy and table grant drop the same anon bypass, so the Polls desk fallback cannot write a poll without an admin session.

## 2026-09-26

### Backer-count grant

- `supabase/legacy/increment_backer.sql` granted `increment_backer_count` to `anon` and `authenticated`, which undoes the canonical grant in `schema.sql` (`authenticated` only). The incremental now revokes `anon` and keeps the Mālo-freeze check from the canonical function.

### Spotlight publish grant

- `publish_spotlight_award` is admin-only inside the function (`current_user_role() = 'admin'`). Execute is now granted to `authenticated` only, matching `moderate_flagged_reel`. A re-run revokes the earlier `anon` grant.

## 2026-09-25

### Motion pass: Highlights owner peek, card-deck paging, scroll reveals

- Swipe a Highlight left or right to slide in `Reels/ReelOwnerPeek`: tagged athlete with Aura-tier ring, Varsity badge, position · jersey · school, Crew / Mālo / Seki / Aura counts, Join Crew (Soft-Wall for guests), Mālo, and Open full profile. When someone other than the athlete posted the clip, a “Posted by @handle” line names them (`reels.uploaded_by`). The video parallaxes and dims behind the panel; the pager locks vertical paging while a peek is open. First three pages show a one-time “Swipe for the athlete” hint (AsyncStorage `tapuai.reelPeekHint`). Snap rules live in `lib/reels.ts` (`resolvePeekSnap`, `clampPeekOffset`) with unit tests.
- `Reels/ReelPage` wraps each pager item (Home and `ReelViewModal`): the outgoing clip shrinks, sinks, rounds and dims while the incoming clip scales up with a slight tilt (`REEL_DEPTH` in `theme/motion.ts`). Reduced Motion turns the depth and reveal effects off.
- `Effects/ScrollFx` (`ScrollFxScrollView`, `ScrollFxItem`, `ScrollFxParallax`) drives Local (game cards tilt in, polls slide alternately), Spotlight (featured card zooms, board tilts), Drip (gear slides in from alternating sides), and Profile / athlete sheet (pull-to-stretch hero). Headings parallax and fade on scroll (`SCROLL_FX`).
- Fan bar: the per-tab glow dot is replaced by a sliding accent indicator that springs to the focused tab and overshoots in width (`SPRING_BOUNCE` → `SPRING_CARD`).

### Compliance warnings on user actions

- Mālo, bank connect, parent consent, cheer polls, highlight upload, and account creation now say where the product is still a prototype: test payments, no live custodial payout, cheers are not a prize, and uploads need rights to the clip. These notices do not claim the app is legally approved.

### Sign-in and account creation

- Google’s `400 validation_failed` is the Auth server saying the Google provider is not enabled. The sheet now says that in words when Auth returns it.
- Email **Create account** requires the 13+ confirmation and an 8-character password. The new row is always a fan. The client does not send a role.

## 2026-09-24

### Company phases

- `docs/company/COMPANY_PHASES.md` is the operating order for security, billing, and legal work (LLC, trademark, patent triage, counsel paper). It points at the roadmap and the legal briefing. It does not clear live Stripe.

## 2026-09-23

### Vault video playback

- Highlight upload in Expo Go skips `react-native-compressor`. That package needs NitroModules, which Expo Go does not ship, and importing it was the redbox on pick. The original clip still uploads.
- New Vault / Exclusive uploads go to a private `reel_vault` bucket. The row stores `reelvault:{path}` instead of a public URL. Entitled playback uses a one-hour signed URL, gated by `can_read_reel_vault`. Free Highlights stay on the public `reels` bucket. Older Vault files that were uploaded as public URLs are unchanged.

### Profile photo and sign-in sheet

- Account Settings → Sign in waits until the hamburger sheet’s native modal has dismissed before opening Soft-Wall, so iOS no longer drops the sign-in sheet while the app still treats it as open.
- Profile photos and booster logos upload as raw bytes with `image/jpeg`, `image/png`, or `image/webp`. A React Native blob’s `text/plain` type was rejected by the `avatars` bucket. Booster logos go to `avatars/sponsors/`, not the video-only `game_highlights` bucket.

### Account customization: bio, social links, and per-field visibility

- Profile hamburger gains **Edit Profile** (`Profile/EditProfileModal`): display name, username, a free-text bio (≤500 chars), up to four social handles (Instagram / X / TikTok / YouTube), and a Visible/Hidden toggle for Bio, School/team, Stats, and Social links. New `profiles.bio` / `profiles.social_links` / `profiles.profile_visibility` columns; `AuthContext.updateProfile` writes them (optimistic local update, then a remote `profiles` UPDATE).
- The real bio and social chips render as a new "About" section on `AthleteProfileView`'s hero, separate from the existing auto-generated position/school summary line that only ever showed on the flip-card back face. Social chips resolve through `lib/socialLinks.ts` and open in `expo-web-browser`.
- **Hiding is enforced server-side, not just client-side.** `profiles` keeps its existing public `using (true)` SELECT (narrowing it was already tried once for `stripe_connect_id` and found unsafe to land blind — see `docs/engineering/SCHEMA.md`), so a new `profiles_public` view mirrors the `reels_feed` pattern: it nulls `bio`/`social_links` for anyone but the owner or admin when hidden. The public `/user/[id]` screen and `Reels/ReelOwnerPeek`'s "Posted by @handle" line read this view instead of the base table. A new `athlete_stats_visible(target_player_id)` function gates `athlete_career_stats` / `athlete_game_logs` SELECT the same way for the Stats toggle. "School" hidden is presentation-only (no RLS — `players.school_name` stays public everywhere else in the app); it just tells the public screen not to render the school line.
- **This does not close the existing Phase 0 item 4 concern** (`docs/product/ROADMAP.md`) about a `profiles_public` view/column-allowlist for full PII (`stripe_connect_id` and other status columns) — this view is scoped narrowly to the new `bio`/`social_links` fields for this feature, not a general fix for the broader public-`profiles`-grant exposure already flagged there.

## 2026-09-16

### Highlights Mālo goes to the athlete in the play

- Rail CTA and tip sheet name the tagged athlete (`Drop Mālo · [Name]`). Copy says the gift is for the performer, not whoever uploaded the clip (`MALO_DISCLAIMER` + sheet subtitle).
- PaymentSheet opens only when the clip has a roster athlete and a non-pending / non-rejected tag. Pending or untagged clips toast and route to profile (or Alert) instead of checkout. Profile CTA reads `Drop $N Mālo · [Name]`.

### Expo web no longer dies on Profile SSR

- `http://localhost:8081` crashed with `Class extends value undefined is not a constructor or null` while SSR-loading Profile (`react-native-qrcode-svg` + `expo-file-system` `File` on Node). Web now uses `ShareQrModal.web.tsx` / `share.web.ts` and loads Skia `WithSkiaWeb` only in the browser.

### Web Reports + Money on the Next portal

- `pnpm admin` → `http://localhost:3001/reports` (behavior: sessions, taps, dwell, Mālo windows, leaders) and `/money` (gross / net / payouts / streams). Same RPCs as Expo `/admin/reports` and `/admin/money`.

### Department call sheet

- New [TEAMS.md](docs/agents/TEAMS.md): command staff (Facilitator / Mobile / Backend / QA) plus product departments (`HIGHLIGHTS` · `LOCAL` · `SPOTLIGHT` · `PROFILE` · `AUTH` · `COMMERCE` · `AURA` · `ADMIN` · `BACKEND` · `OPERATOR` · `ROLE_HQ` · `QA` · `LEGAL`). Each section lists fan route, Expo/Next desk, functions, and do-not-touch. Grok [ALA_TEAM_BRIEF.md](docs/company/ALA_TEAM_BRIEF.md) points at the call template.

### Admin portal wired to the fan app

- Next Features (`pnpm admin`) now toggles the **same flag catalog** as Expo `/admin/features` + Look · Profile (`APP_RUNTIME_FLAG_GROUPS` in shared-types): fan bar, hype, boards, Profile chrome. Draft merge keeps Look copy / catalogs when you flip one switch. **Publish to app** / **Discard draft** hit `patch_app_runtime_draft` + `publish_app_runtime` — Expo fans pick up `published` over Realtime.
- Profile desk can draft chrome (Flip card, Crew, tabs, Actions on top, Open on Stats) instead of read-only badges. **Actions on top** actually moves Mālo / Subscribe in `AthleteProfileView`.
- People list shows Claimed roster + Varsity status from live `is_verified_athlete` / `verification_status` (hosted DBs that never got `profiles.is_verified`). Expo `/admin/people` list + Verify/Approve use the same fallback. Incremental: `supabase/legacy/profiles_verified_compat.sql`. Coverage: match roster taps open `/user/[id]`.

### Profile tab matches a tapped athlete

- Own Profile and `/user/[id]` share one `AthleteProfileView`: hero, Crew, Share & Fund, Highlights / Stats / Vault, roster. **YOUR HUB** heading is gone; hamburger overlays the own sheet, back overlays a public sheet (stack title hidden).
- Join Crew, Drop Mālo, and Subscribe hide when `profiles.player_id` (or name) matches the roster row (`isOwnAthleteSheet`). Public sheets run PaymentSheet + `useAthleteSubscription.grant` instead of a fake AsyncStorage tick. Live-game roster and play-card names open `/user/[id]` instead of a tip sheet.

### Highlight picker + compression + avatars

- Camera Roll Highlights go through `HighlightPickerModal` (`expo-image-picker` videos, 45s cap, trim UI). Longer clips alert **Highlight clips must be 45 seconds or less to showcase your best plays!**
- `MediaUploadService` compresses with `react-native-compressor` (1080p vertical, ~2.5 Mbps) under **Optimizing highlight quality...**, uploads `reels/{user_id}/{timestamp}.mp4` to Storage `reels` (fallback `game_highlights`), then inserts `public.reels`. Expo Go skips native compress and still publishes.
- Own Profile hero `ProfileAvatarPicker` 1:1 crop → `avatars` bucket → `profiles.avatar_url`. Incremental: `supabase/legacy/media_upload.sql`.

### Spotlight Watch no longer 400s athlete sheet

- Seeded `spotlight_awards` rows can have a null `player_id`. The parser used to invent `spotlight-{award.id}` and **Watch Full Highlight** on the Spotlight tab pushed `/user/{that string}`. Postgres then returned `invalid input syntax for type uuid`. Watch now opens the clip; `/user/[id]` only queries real `players.id` UUIDs.

### Share & Fund ⚡ QR flyer

- Athlete Profile and Locker Room Wishlist cards open `ShareQrModal`: Obsidian canvas, neon-jade QR for `https://tapuai.app/gift/{handle}` (`react-native-qrcode-svg`).
- **Save QR Image to Camera Roll** (`expo-media-library` `Asset.create`), **Copy Web Tipping Link** (`expo-clipboard` + Success haptic), **Share via SMS / Social** (`Share.share`).
- Expo route `/gift/[handle]` is the in-app landing for that URL.

### Team Code Athlete Verification (Varsity)

- Claiming athlete + school stays easy (`RoleSwitcherModal` **Claim athlete profile**). `add_user_role('athlete')` no longer sets `is_verified`.
- **Claim School Verification ⚡** (`VerifyAthleteModal`): team code (`WSTLK-RUG-2026`) or coach/parent request. `profiles.verification_status` = `unverified` \| `pending` \| `verified`.
- Viewers see neon jade **⚡ VERIFIED VARSITY** (`VarsityBadge`) on the hero name and 3D trading card; otherwise SCHOOL CLAIMED / Not verified yet or ⏳ VARSITY PENDING. Highlights stay public while waiting.
- Player of the Week / Spotlight auto-elect requires Varsity (`athlete_is_varsity_verified`). Incremental: `supabase/legacy/athlete_verification.sql`.

### Legal Terms & NIL Compliance sheet

- Profile Settings → **Terms of Service & NIL Compliance 📜** (`LegalModal`): ToS/Privacy summary, High School NIL disclaimer (Mālo independent of performance; no school-trademark license), Minor Safety & Parental Authorization.
- Mandatory `LegalAckToggle` on **Apply for Athlete Verification** and **Connect Bank Account**. Stamps `profiles.legal_terms_accepted_at` (`supabase/legacy/legal_terms_ack.sql`). Connect onboarding returns 403 without it.

## 2026-09-15

### Expo Go iOS Simulator — Record no longer aborts

- Upload **Record** skipped `launchCameraAsync` on iOS Simulator (`UIImagePickerController setMediaTypes:` abort in Expo Go 57). Use **Library** (PHPicker) or a physical device.

### Clean Profile hierarchy

- Profile hero is a large avatar (tier ring + jersey); Flip Aura card opens from the hamburger or a slim control — not a full-width card blocking the scroll.
- Account Settings (Sign in/out, Capability, Receipts, Suggest, Admin, Flip, Payouts) move into a **menu-outline** `ProfileMenuSheet`.
- Crew / Squad slim into one compact strip with a small Join CTA. Highlights collage stays the next big beat; **Active Team Roster** lists school teammates (tap to open). Athletes see Claimed / Unclaimed via `profiles.player_id`. Hub athlete pick prefers `profile.player_id`.
- **Admin portal Profile desk:** Next `/profile` + Features · Profile chrome flags (`PROFILE_CHROME_FLAGS` in shared-types); Overview shows claimed-athlete count. Expo Look · Profile copy matches hamburger / collage-first hierarchy. Coverage maps hamburger + Flip card to Look (`profile.showCard`).
- Grok Bot ALA team brief: [`docs/company/ALA_TEAM_BRIEF.md`](docs/company/ALA_TEAM_BRIEF.md) (Facilitator / Mobile / Backend / Ship QA).

### Soft-Wall admin oversight (Expo + Next portal)

- Expo Coverage adds Soft-Wall auth surface (`soft_wall.*`, providers, welcome overlay, guest browse). Features desk documents Soft-Wall gates + Operator pause; People adds Fans filter and Soft-Wall signup counts; Overview Soft-Wall strip.
- Next `@tapuai/admin-portal` is dynamic: Overview / Soft-Wall / Features / People read `app_runtime_config` + fan `profiles`. Features toggles Soft-Wall related flags via `patch_app_runtime_draft` + Publish. Shared gate map in `@tapuai/shared-types` (`SOFT_WALL_GATES`).
- Soft-Wall telemetry: `soft_wall.malo|crew|wishlist`, `auth.password|apple|google|magic_link|demo`.
- **Demo Fan:** SoftWall / Profile **Continue as Demo Fan** → `demo@tapuai.app` / `TapuaiDemoFan1!` (env override). Creates the Auth user on first tap when Confirm email is off. SoftWall also has email + password **Sign in**.

### Browse-first Soft-Wall auth

- Guests browse Highlights, trading cards, and Locker Room without an account. **Mālo**, **Join Crew**, and **Chip In** open `SoftWallModal` (Continue with Apple / Google + Magic Link email), then resume the intercepted action after `SIGNED_IN`.
- `AuthContext` exposes `isGuest`, Apple / Google / Magic Link helpers, sign-out, guest AsyncStorage markers, and fan profile bootstrap (`ensureFanProfile` + SQL trigger `handle_new_auth_user`). Deep link: `alasports://auth/callback`.
- First-open `WelcomeOverlay` (no account wall). Operator console stays shipped but paused: `layouts.operatorConsole` defaults to **false** until Features + Publish.

### Admin Look + People desks

- Look: serialize `app_runtime_config` draft writes so copy/hex typing cannot race; surface draft/publish errors on the Look desk and Publish bar; drop duplicate Daylight preset row.
- People: Approve verifies matching `profiles` (by `player_id` and name); grant/revoke admin keeps `roles` in sync with `is_admin`; pending queue errors and busy-state buttons.

### Monorepo audit + path retarget

- Re-verified `pnpm typecheck`, `pnpm docs:check`, shared-types imports, and zero Stripe secrets under `apps/mobile/src/frontend/`. Updated [AUDIT_REPORT](docs/engineering/AUDIT_REPORT.md) §0, [TROUBLESHOOTING](docs/engineering/TROUBLESHOOTING.md), SCHEMA body paths, INVESTOR / LEGAL `pnpm docs:sync` wording.

### A + Full monorepo (pnpm)

- Repo root is workspace orchestration: `pnpm-workspace.yaml`, root scripts (`pnpm mobile`, `pnpm admin`, `pnpm docs:sync`). Expo app moved to `apps/mobile/` (`@tapuai/mobile`). Next.js App Router **stub** at `apps/admin-portal/` (`@tapuai/admin-portal`) with Tailwind + Supabase JS — Expo `/admin` desks stay in mobile. Shared contracts in `packages/shared-types` (`@tapuai/shared-types`).
- Docs: new [ARCHITECTURE](docs/engineering/ARCHITECTURE.md), rewritten [ONBOARDING](docs/ONBOARDING.md) + root [README](README.md); `AGENTS.md` / `docs/engineering/SYSTEM_OVERVIEW.md` / `SCHEMA.md` / `docs:sync` paths retargeted to `apps/mobile/…`. Env: `apps/mobile/.env.local` (`EXPO_PUBLIC_*`) and `apps/admin-portal/.env.local` (`NEXT_PUBLIC_*`).

### Island Daylight tab scheme (gold + ember)

- Shared scheme: Jade · Cyan · Gold · Ember · Violet. `ScreenHeading` kickers/underlines use gold; fan bar paints each tab its own accent (`TAB_ACCENTS`). LIVE chips and cheer LIVE pills are Ember red; Spotlight award cards sit on gold mist; Drip tiles pick up ember mist with gold price badges; Local section titles get a gold rule and sponsor Gold/Platinum cards sit on gold mist.
- Deeper pass: Highlights chrome (Home / All / Seki, search, campaign) uses gold + ember; Local hubs / Game / Play / Cheer / ScoreHeader / alerts match Spotlight gold-mist cards; Profile Crew, Flip Card, Vault lock, settings rows, and roster jersey chips pick up gold / ember. Guest `/game/[id]` Realtime uses `nextRealtimeTopic` so `postgres_changes` is never attached after `subscribe()`.

### Island Daylight card palette

- Aura collectibles (`AuraTradingCard`, `AuraCard`, `TopAuraBoosters`) sit on per-tier light `face` washes with readable `ink` instead of charcoal `#161D20`. Local Game / Play / Cheer cards, Drip Gear, and Locker Room tiles share jade mist; away / Seki sides pick up Island Cyan. Highlights ⚡ overlays stay Obsidian.

### Fun hype bursts — Seki / Aura / Flex

- Highlights rail chips each have their own color (Seki cyan, Aura jade, Flex gold) and fire `Effects/HypeBurst`: flying emoji, a shout (`SEKI!` / `AURA!` / `FLEX!`), and a spring ring. Double-tap Aura on the clip uses the same burst (2× on Serve Like Me). Local play cards use the same palette. Fan bar active tab gets a per-tab mist wash + glow dot; Aura toasts pick up a gold rim.

### Skia neon sweep on the Aura trading card

- New `Effects/GlowingNeonBorder`: Skia `SweepGradient` (Neon Jade → Cyber Gold → Electric Violet → Jade) with a solid `BlurMask` (12) behind a crisp stroke. Reanimated spins the sweep 0→2π every 3s (`withRepeat` + linear `withTiming`). Celestial Prism or a funded Locker Room item pulses stroke thickness 3↔7 (`withSequence`).
- `Profile/GlowingCardWrapper` measures the 3D card and sits the canvas 16px outside each edge so the blur is not clipped. `AuraTradingCard` wraps the flip stage in it; Flip Card 🔄 stays outside the glow. Studio **aura_legend** (Celestial Prism) is the preview; Profile lights it from tier 7 or `get_wishlist_items` when any gear is equipped. Native uses `GlowingCardWrapper.tsx` (Skia in the binary). Expo web uses `GlowingCardWrapper.web.tsx` so CanvasKit (`public/canvaskit.wasm`, `npm run skia:web`) is never pulled into the iOS/Android bundle.

### Admin audit — Catalogs, Daylight default, one builder per category

- System sidebar is Features / Look / **Catalogs** / Studio. Lab and QA stay as hidden deep links (Feedback **Open in Lab**, Reports Reliability) so they are not a second Features or Reports desk.
- New `/admin/catalog` (`Admin/CatalogTool`) drafts Mālo presets, cover-fee dollars, exclusive pass dollars + Aura, class years, Local region chips, booster tier prices, and upload category labels until **Publish to app**. Coverage maps every former `owner: code` list to this desk. Money, Boosters, and Feedback link here instead of duplicating the editors.
- The fan app reads `live.catalog` for tip chips, exclusive copy, onboarding years, Local filters, sponsor checkout, Chip In, and upload / Highlights category labels. Sports playbooks, Drip SKUs, schools, games, and wishlist gear stay on their own instant-save desks.
- **Daylight is the shipping canvas** (`LIGHT_COLORS`, `DAYLIGHT_THEME`, Look **Reset to default**). Status bar, tab shells, and payout chrome follow the published theme. Highlights ⚡ (and other video surfaces) stay Obsidian.

### Sports builder — every sport, scored and shown its own way

- New **`/admin/sports`** desk (`Admin/SportsTool`, Operations group) defines one playbook per sport: emoji, segment name (Quarter / Half / Set / Inning / Flight), period chips, clock on/off + minutes, score buttons (label / points / feed play type), sideline callouts, which **Stats 📊** career rows and combine tiles fans see, and roster position pills. Add, edit, pause, or delete any sport, with a live preview of the console and Stats table before saving.
- Each row shows what rides on it — score buttons, periods, clock, positions, athletes, and games — so a change is never blind. **Install starter playbooks** writes the twelve seeded sports (Football, Basketball, Rugby, Volleyball, Soccer, Baseball, Softball, Wrestling, Track & Field, Lacrosse, Ice Hockey, Tennis) into Supabase; playbooks not yet saved are marked `starter`.
- The operator console (`/operator/[gameId]`) and sideline scorer now build their score pad, period chips, clock, callouts, and player-tag macros from the match's playbook (`games.sport`). Untimed sports hide the clock entirely; unknown sports inherit `GENERIC_SPORT_CONFIG` instead of football.
- Fan surfaces follow the same rows: the athlete **Stats 📊** pane renders the playbook's combine tiles and career labels (Kills / Digs, Tries / Tackles, Goals / Assists…), and live play toasts resolve their emoji from that sport's callouts.
- `/admin/games` gains a sport picker that swaps its period chips and clock field to match; `/admin/athletes` shows position pills for the selected sport instead of football-only QB…K. Athlete onboarding offers every active sport.
- New `public.sport_configs` + `get_sport_configs` / `upsert_sport_config` / `delete_sport_config`, plus `games.sport`. Incremental: `supabase/legacy/sport_configs.sql`. Expo Go without the table falls back to `SPORT_CONFIG_SEEDS`.
- Coverage tracks the score buttons, period chips, callouts, and Stats rows against the Sports desk.

### Locker Room Wishlist — crowd-funded gear

- Athlete **Stats 📊** tab gains **👟 Locker Room Wishlist**: a horizontal rack of gear cards with item photo, title, money line, and a spring-animated Neon Jade funding bar. **🎁 Gift Item Directly** opens the retailer link in `expo-web-browser`; **⚡ Chip In $5** opens the Mālo sheet and credits whatever the fan pays toward the goal.
- Crossing 100% fires full-screen confetti + a **Gear Unlocked!** notification, stamps a glowing **EQUIPPED ⚡** badge on the card, and pays the athlete a one-time **+500 Aura** (`chip_in_wishlist_item` → `add_user_aura`, guarded by `aura_awarded`).
- New `public.wishlist_items` + `get_wishlist_items` / `chip_in_wishlist_item`. Incremental: `supabase/legacy/locker_room_wishlist.sql`. Expo Go without the table falls back to `WISHLIST_DEMO_ITEMS`.
- Managed from admin: `layouts.wishlist` pauses the whole rack (Features), and Coverage tracks `wishlist` / `wishlist_gift` / `wishlist_chip_in` taps against the Drip and Money desks.

### Admin portal — business nav, trail, Coverage

- `/admin` is organized like a production ops portal: pinned **Home**, then Operations / Content / Commerce / Audience / Growth / System. Every desk has **Back** (stack or Home), **Home**, a crumb, and **Open in app** when the desk maps to a fan surface.
- `/admin/coverage` lists every fan-visible control (tabs, Highlights rail, Local boards, Drip, Profile, receipts, Upload, Operator / Parent / Booster / Sponsor actions), who manages it, live vs paused, and 7-day taps / issues. Overview shows live/paused coverage counts.
- Features / Look can pause or rewrite slang guide, suggestions, receipts, and role-HQ ledes (`buttons.suggest`, `layouts.slangGuide`, `layouts.receipts`, copy keys). Missing JSON keys stay on.

### Usage reports + live scoreboard tap

- `/admin/reports` **Usage** desk: time on tabs, deepest scroll, features fans tap (Seki / Mālo / polls / Drip), hottest control issues (failed checkout, Report, upload, open bugs). Still one Expo `/admin` — no second admin app.
- Fan surfaces write `tab_dwell` / `surface_scroll` / `feature_tap` / `ui_issue` into `telemetry_logs` via `useSurfaceUsage`. Home live scoreboard taps through to the Local game. Incremental: `supabase/legacy/usage_reports.sql` (adds `duration_ms` / `channel` / `step` on remotes that still used `metric_value`, then `get_admin_reports` usage keys).

### Admin control plane — Marketing / Owner / Engineer

- One `/admin` portal. Sidebar **All desks / Marketing / Owner / Engineer** pills filter the same routes (`tapuai.adminLens`). Marketing lands on Look / copy / Features; Owner on Overview / Money / Reports; Engineer on Lab / QA / flags.
- Fans send app-level suggestions from Profile **Send a suggestion** and Highlights ⋯ **Suggest an improvement** (`submit_app_feedback`). That is not clip Report (`report_reel`). `/admin/feedback` triages `new → reviewing → planned → shipping → shipped | declined` and can pin a `runtime_path`.
- Look gains a **Copy** tab (`app_runtime_config.copy`: Home / Local / Spotlight / Drip kickers, ledes, empty lines, optional Home campaign banner). Still draft until **Publish to app**.
- `/admin/lab` edits the runtime **draft JSON** (unknown keys / invalid hex rejected), applies a triaged suggestion onto the draft, and uses the same Publish path. No in-app TypeScript, `eval`, or git.
- Overview always shows Gross / net / payouts, Reports health fail-warn count, and new feedback. Incremental: `supabase/legacy/app_feedback.sql`.

### Admin Money — financial control plane

- `/admin/money` is the revenue desk (Expo Router, not `app/finance/page.tsx`): Gross Platform Volume, Company Net Revenue, Athlete & Operator Payouts, plus a split table for Mālo (10/90), district boosters (15/85), and merch + Vault. Totals come from `get_company_revenue_summary`; the log list reads `company_revenue_logs`. Incremental: `supabase/legacy/company_revenue.sql`. Fan Mālo copy is still 100% to custodial until counsel updates `MALO_DISCLAIMER`.

### Auto Spotlight + tag verification

- Player of the Week / Month / Year is elected from **confirmed** Game Play hype (Seki + Aura + Flex). The award is the tagged athlete; the hottest clip is the tape; a fan uploader gets **Clip by**, not the crown.
- Fan tags start `pending`. The athlete, their parent, a school operator, or admin taps **That's them** / **Not them**. Computer vision is out of scope — we verify the confirmer, not the pixels.
- `/admin/spotlight` shows the live race, pending tags, Crown from hype, and a locked manual override. Incremental: `supabase/legacy/spotlight_auto.sql`.

## 2026-09-13

### Admin Look + Reports graphs

- `/admin/look` drafts brand colors (Obsidian / jade / gold presets + hex), Profile chrome (card / Crew / Stats / Vault / action placement), and Highlights ⚡ overlay (rail left/right, name top/bottom, school/caption, button order). Same **Publish to app** gate as Features.
- Reports open on **Health** (pass / warn / fail for stalls, flags, checkout, payouts, live board, Drip stock, Spotlight, unpublished chrome) plus 7-day bar charts for clips, Mālo, and stalls. Incremental: `get_admin_reports` `series`.

### Admin Features + Publish to app + Reports

- Fan-bar tabs, Upload +, Seki / Aura / Flex / Mālo / More, Subscribe / Crew / Vault / Flash Unlock, Local boards, search, Spotlight modal, and role HQs are flags on `app_runtime_config`. Toggles stay **draft** until **Publish to app** (sidebar gold button). School names, player stats, captions, Drip prices, scores, and verify stay **instant**.
- `/admin` nav is grouped: Ship / Content / Catalog / People & money / Insights. New desks: **Features** (`/admin/features`) and **Reports** (`/admin/reports` — usage windows, Mālo, leaders, reliability). Incremental: `supabase/legacy/app_runtime.sql` + `supabase/legacy/admin_reports.sql` (`patch_app_runtime_draft`, `publish_app_runtime`, `get_admin_reports`).

### Admin Studio / Publish / QA

- The fan app no longer shows a Dev role bar or Aura persona chips. Guest / Fan / Athlete / Operator preview lives only in `/admin/studio`. Expo Go **Unlock Studio** (Access Restricted) or `profiles.is_admin` opens the portal; Profile shows **Admin portal** for those sessions. Operator / Parent / Booster / Sponsor previews keep a one-line hatch back to `/admin`.
- New desks: **Publish** (go-live parked games, restore clips, activate Drip/polls, Spotlight status) and **QA** (24h stalls, offline queue flush, empty-state checklist, walk production). Games / Highlights / Drip / Polls / Boosters / Spotlight link out to the matching fan surface or operator console.

### Admin portal desks

- Admin tools are ops desks, not raw CRUD: dollars instead of cents, school/athlete pickers, live/parked/on-Drip filters, score +1 on live games, Highlight retitle/retag, Mālo payout mark-paid, vote share bars, and an Overview inbox for flags / verify / payouts / low stock / empty live board.

### Admin portal (production control plane)

- `/admin` is the **admin portal** that writes the same tables the fan app reads. Nested routes + Obsidian sidebar: Overview, Spotlight, Moderation, Athletes, Schools, Live games, Highlights, People, Drip, Boosters, Money, Polls. Non-admins still see **Access Restricted**. Incremental: `supabase/legacy/admin_portal.sql` (`shop_products`, admin writes on `schools_and_teams` / `cheer_polls` / `games` INSERT / `sponsorships`, `upsert_cheer_poll`). Drip tab loads `shop_products` (`useDripCatalog`) with `DRIP_ITEMS` fallback. Local School Polls prefer published `cheer_polls` labels.

### Web Admin Dashboard

- `/admin` is the Obsidian / Neon Jade **Web Admin Dashboard** (Expo Router, not Next.js). Non-admins see **Access Restricted**. Admins get Spotlight Manager (publish Player of the Week), Moderation & Reports (Dismiss / Remove Content on flagged Highlights), and Platform Telemetry (Highlights count, Seki+Aura+Flex, Mālo ledger). `profiles.is_admin` plus Studio unlock. Incremental: `supabase/legacy/admin_dashboard.sql` (`publish_spotlight_award`, `moderate_flagged_reel`, `get_admin_platform_metrics`, `reels.is_removed`).

### Home feed + one hype / Mālo state

- Fan bar first tab is **Home**. Highlights ⚡ still lives on Profile. Top chrome is search + **Home / All / Seki**. Home ranks Crew you follow, your school, Serve Like Me, Flash Unlock, energy, and freshness. Search looks up clip titles and athlete profiles (`search_local_entities` + the live feed) in the same dark jade sheet as Local Explore.
- Name + Seki / Aura / Flex / Mālo / ⋯ sit on the clip, just above the fan bar. The video fills the scene from the status area to the nav. iOS Live Text / frame analysis is off (`allowsVideoFrameAnalysis={false}`) so the blue gear does not sit on the clip.
- One Seki, one Aura, and one Flex per fan per clip (`reel_hype_votes` + local `tapuai.reelVotes.*`). Double-tap Aura is that one Aura. After a Mālo, the button fills jade and reads **Mālo'd**. Incremental: `supabase/legacy/reel_hype_votes.sql`.

### Highlights chrome + fan bar

- Highlights ⚡ no longer shows the pulsing Aura rank chip. The athlete name wears a 7-tier color border (full **Tier n • title** stays on Profile). Fan bar sits in a phone-width row around a centered Upload plus so Spotlight does not squeeze Drip / Profile. Upload sheet: Library / Record tiles, stacked category rows with a check, phone-width column on web.
- Highlights overlay is TikTok-style: name (tier color) + school + caption bottom-left; right rail is Seki / Aura / Flex / Mālo / ⋯. Share, Save, and Report live in `ReelMoreSheet`. Views leave the feed and show on the Profile trading card. **SEKI PLAY** badge is gone; **All / Seki** switch at the top of Highlights filters `sekiPlay` clips. Upload plus sits in its own slot between Local and Spotlight so it does not cover a tab.

### Crew / Squad + Vault Flash Unlock

- Profile counters are **The Crew ⚡** (followers) and **Your Squad 🛡️** (following). Visitors tap **Join Crew ⚡** (Neon Jade). Mutual follows show a glowing **Teammates 🤝** badge. Persistence: `crew_follows` + `get_crew_graph` / `toggle_crew_follow`.
- Athletes long-press a Vault clip and tap **🔓 Flash Unlock (2 Hours)**. `set_reel_flash_unlock` writes `reels.flash_unlock_until` and queues a `crew_push_queue` row for every Crew member. Highlights ⚡ shows **⚡ FLASH UNLOCK • Locks in 1h 45m** and plays the clip without Subscribe for that window. Incremental: `supabase/legacy/crew_and_flash_unlock.sql`.

### Serve Like Me / Train Like Me

- Upload pills tag a Highlight as **⚡ Game Play**, **💪 Train Like Me**, or **🤝 Serve Like Me (2x Aura Boost)**. Serve shows a Neon Jade **Community Impact Boost ⚡** chip. Persists `reels.category` (`game_play` / `train_like_me` / `serve_like_me`). Incremental: `supabase/legacy/reel_category.sql`.
- Feed cards float **🤝 SERVE LIKE ME • 2x AURA** or **💪 TRAIN LIKE ME** top-left. Double-tapping Serve Like Me grants 2 Aura (vs 1) and a jade particle burst. OfflineQueue flushes the same point count.

### Player of the Week spotlight

- Highlights launch queries `get_active_spotlight_award(viewer_user_id)` and, if the current week/month award is unviewed, opens `SpotlightModal` over the feed: looped winning Highlight, Neon Jade badge, 7-tier Aura portrait, **Support & Tip Athlete ⚡** (Mālo sheet) and **Watch Full Highlight 🎥**. **Dismiss (seen)** stores AsyncStorage `tapuai.spotlightSeen.{awardId}` so it pops once per period. Incremental: `supabase/legacy/spotlight_awards.sql`.
- Spotlight video never calls `pause()` on unmount (expo-video already released the native player; that crash blocked every CTA). Support / Watch wait for the modal fade, then open Mālo or scroll the Highlights ⚡ feed.
- **Spotlight** fan-bar tab (`/spotlight`) lists current and recent Player of the Week/Month cards so a dismissed launch popup is still reachable. Tap a card to replay the modal (Close does not re-arm the popup).

### Athlete Vault lock

- Athletes **Lock Vault 🔒** so fans must subscribe ($4.99/mo) to watch Vault Highlights ⚡, or **Open Vault 🌐** for a public preview. Default is locked (`players.vault_locked`). Clip placement (Highlights vs Vault) is still long-press. Incremental: `supabase/legacy/player_vault_lock.sql`. RPC `set_player_vault_locked`.

### Unified athlete profile + Highlights ⚡

- User-facing **Reel / Reels** copy is **Highlight / Highlights ⚡** (fan bar, publish, receipts, trading card). Persistence stays `reels`.
- `AthleteProfileView` is the shared sheet for own Profile and `/user/[id]` (name taps). Tabs: **Highlights ⚡**, **Stats 📊**, **Vault 🔒**. Legacy `/athlete/[id]` redirects. Fan bar stays mounted.
- Stats engine: combine measurables on `players` plus `athlete_career_stats` / `athlete_game_logs`. Trading-card back face shows Games / scoring / volume. Incremental: `supabase/legacy/athlete_stats.sql`.

### Local match stays in the fan bar

- Tapping a live game on Local pushes `/local/game/[id]` inside the Local nested stack, so `FanTabBar` stays visible. Public `/game/[id]` in `(guest)` is unchanged for deep links. Tapping Local again pops back to the hub.

### Universal team search (HS + NCAA)

- Athlete onboarding in `RoleSwitcherModal` uses one `schools_and_teams` autocomplete (`ILIKE %query%`) with `[ High School • UT ]` / `[ NCAA D1 • Big 12 ]` badges. HS and college share sport, roster number, position, and class year. Saves `profiles.school_id` + `athlete_division`. Aura trading card shows team name, mascot, and division on both faces. Incremental: `supabase/legacy/schools_and_teams.sql`. `docs:check` now fails if SCHEMA omits a `schema.sql` table or RPC.

### Fan-first Open Vault

- Reels default to the free public feed (`reels.is_vault_only` / `is_exclusive` false). Vault clips on `ReelCard` show a semi-transparent **Subscriber Vault 🔒** badge and **Unlock Vault ($4.99/mo)** PaymentSheet; subscribers and public clips play full-resolution with no overlay.
- Athlete Management Profile grid (`AthleteReelManager`) long-presses a thumbnail to **Move to Subscriber Vault 🔒** / **Move to Free Public Feed 🌐**. Medium haptic, optimistic chip, `toggle_reel_vault_status` RPC. Incremental: `supabase/legacy/toggle_reel_vault_status.sql`.

### Front-of-house docs sync

- `npm run docs:sync` (`scripts/sync-front-docs.mjs`) reads Mālo / exclusive / booster / Aura / PIN / Connect constants and writes `docs/product/PRODUCT_FACTS.md` plus marked blocks in PUBLIC / INVESTOR / LEGAL. CI runs `npm run docs:check`. Legal analysis outside the markers stays human-written.

### Front-of-house briefing pack

- Public one-pager, investor memo, and legal/liability briefing (not legal advice) in `docs/product/PUBLIC.md`, `docs/company/INVESTOR.md`, `docs/legal/LEGAL_BRIEFING.md`. Prototype stills in `docs/company/press/`.

## 2026-09-12

### Unified motion + Reel / trading-card focal chrome

- `src/frontend/theme/motion.ts` is the spring and focal-color source: `SPRING_CARD` (sheets / pills), `SPRING_BOUNCE` (reaction chips / score pops), `SPRING_FLIP` (Aura trading card). Neon Jade `#00E676` is reserved for tips, Aura gains, and active roles. Electric Gold `#FFD700` is reserved for Gold / Platinum boosters and top ranks.
- Reel feed: tagged athlete name sits top-left in a 7-tier Aura color border (full rank lives on Profile). School roster + category / Flash Unlock chips stay under the name. Mālo ⚡ keeps a persistent Neon Jade border glow.
- `AuraTradingCard` flips with `SPRING_FLIP`. Back-face Season Points and Total Tipped land in Neon Jade with a staggered `withDelay` fade.

### Phase B production readiness

- `OfflineQueue` (`src/frontend/services/OfflineQueue.ts`) persists Aura taps, cheer votes, bookmarks, and reports in AsyncStorage while `NetInfo.isConnected === false`, then flushes `increment_reel_hype` / `add_user_aura` / `cast_cheer_vote` / `saved_reels` / `report_reel` on reconnect. Root layout starts the singleton at boot.
- Reel rail **Report / Hide Highlight 🚩** opens `ReportContentModal`. Confirm appends the fan onto `reels.reported_by`, sets `is_flagged`, hides the clip on this account (`tapuai.hiddenReels` + toast). Incremental SQL: `supabase/legacy/report_reel.sql`.
- Stripe Express Account Links are minted only server-side. `useStripeConnect` / `PayoutSetupCard` call Edge Function `create-stripe-account` with `Authorization: Bearer` session JWT. The handler binds the Express account to `auth.uid()` (ignores client `accountId` / `profileId`) and writes `stripe_connect_id` / `stripe_onboarding_complete` / `payouts_enabled`. Metro `POST /api/create-stripe-account` is a JWT-gated local fallback only.

### Profile trading card + Account Settings audit

- `AuraTradingCard` flips with Reanimated `withTiming` (`rotateY` 0°↔180°, `perspective: 1000`). Tap the card or **Flip Card 🔄**. Medium `impactAsync` fires when rotation crosses 90°. Front keeps the live 7-tier Aura border; back shows Season Points, Reels Posted, and Tips Received.
- **Account Capability** opens `RoleSwitcherModal` over `expo-blur`. Dual Fan + Athlete accounts get a jade segmented Fan View / Athlete Management toggle that writes `profiles.active_role` with Medium haptic. Fan-only **Apply for Athlete Verification 🏆** calls `add_user_role`, updates `roles` immediately, and unlocks `PayoutSetupCard`.
- **Connect Bank Account** launches Stripe Express via JWT Edge Function `create-stripe-account` (`WebBrowser.openAuthSessionAsync`). The server writes `stripe_onboarding_complete` on return. **Tip History & Receipts 🧾** fires Light `impactAsync` and pushes `/receipts` (hidden fan tab).

### Drip + Upload button audit

- Drip `GearCard` scales to 0.96 and opens `ProductSheet` over an `expo-blur` backdrop. Size pills (S–2XL) slide a jade indicator with `withSpring` and Light `impactAsync`. Quantity + / − clamps 1…`inventory` and updates total + Aura live. **Buy Now** runs `useTipCheckout` PaymentSheet (`skipBacker`); success grants order dollars × 10 Aura to the payer.
- Center tab **+** (`accessibilityLabel="Upload video"`) opens `UploadVideoModal`. ImagePicker stores the video URI; a paused `expo-video` `VideoView` is the thumbnail. **Subscriber Exclusive 🔒** paints a `#00E676` border and sets `is_exclusive: true`. **Publish Reel** shows the Storage progress bar, fires `notificationAsync(Success)`, and `UploadSheetContext` prepends the clip onto the Reel feed.

### Local Explore search

- Persistent search bar on Local (`🔍` + `TextInput` + `✕`) sits above hub pills. Light `impactAsync` on focus and throttled typing.
- Queries longer than 1 character slide up `SearchResultsOverlay` with All / Athletes / Schools / Boosters chips, AsyncStorage recents, and live `search_local_entities` hits (`useLocalSearch`, table SELECT fallback).
- Athlete rows open `/athlete/[id]`. Booster rows switch to School Polls and jade-highlight the sponsor rail. School rows filter rivalry polls for that high school. Incremental SQL: `supabase/legacy/search_local_entities.sql`.

### Local Discovery button audit

- Hub / region `FilterPills` slide the jade indicator with `withSpring`. Selected pills are transparent so only the indicator paints; hub panes stay mounted (`display: 'none'`) so Live Matches / School Polls / Top Boosters swap without shifting the bar.
- `CheerPollCard` fires Medium `impactAsync`, recalculates % immediately, springs bars from 0% to the new share, and floats **+1 Vote ⚡** from the press point 60px up.
- **+ Become a Team Sponsor** opens `SponsorshipModal` with an `expo-blur` backdrop. Silver / Gold / Platinum cards highlight on Light haptic. **Complete Sponsorship** calls `useTipCheckout` PaymentSheet; success uses `notificationAsync(Success)`.

### Reel feed button audit

- `Gesture.Exclusive(doubleTap, singleTap)` keeps single-tap mute off the double-tap Aura ⚡ burst (`maxDistance` / `maxDeltaY` so paging still wins). Double-tap fires Medium `impactAsync`, optimistic `aura_count`, background `increment_reel_hype`, and `add_user_aura(+1)` for the signed-in fan.
- Seki / Aura / Flex chips stay on `AnimatedPressable` (0.88 → 1.15 → 1.0) and increment local counters immediately.
- **Mālo ⚡** opens `MaloTipModal` (blurred backdrop). **Share** uses Expo `Share.share` with `alasports://athlete/{id}?reel=`. **Save** syncs `public.saved_reels` via `useSavedReel`. Incremental SQL: `supabase/legacy/saved_reels.sql`.
- `SwipeableBannerWrapper` pan activates only on swipe-up so vertical Reel scroll is not captured; ✕ / swipe-up still set `isDismissed` with Light haptics.

### Reel Realtime channel collision

- `useLiveGame` / discovery / cheer poll topics go through `nextRealtimeTopic` so two hooks in the same tick never call `.on('postgres_changes')` after `subscribe()`. The Reel feed passes its live snapshot into `LiveMatchBanner` (`live={liveGame}`) so the banner does not open a second `live_game_*` socket. `useGameEventBroadcast` fans share one `game_events_{id}` channel.

### Profile tagged-clip pager

- Profile and `/athlete/[id]` 3×3 grids sort `reels.created_at` **newest → oldest**. Tapping a tile opens `ReelViewModal` as a vertical pager of `ReelCard` (same Exclusive mute / double-tap Aura ⚡, chips, Mālo, Share, Save as the hub feed). Swipe up for older clips.

### Client telemetry (video + sockets)

- `TelemetryManager` (`src/frontend/services/TelemetryManager.ts`) batches events in memory and flushes to `public.telemetry_logs` every 10s or at 15 items. `ReelCard` logs time-to-first-frame and mid-reel stalls. `useLiveGame` logs Realtime `CHANNEL_ERROR` / `CLOSED` reconnect attempts. `useTipCheckout` logs PaymentSheet step latency. Incremental SQL: `supabase/legacy/telemetry_logs.sql`.

### Local booster sponsorship tiers

- School Polls shows a **Local Team Boosters & Sponsors 🏆** rail (Obsidian cards + Silver / Gold ⚡ / Platinum 💎 badges). **+ Become a Team Sponsor** fires Light `impactAsync` and opens `SponsorshipModal`. First month is Stripe PaymentSheet via `useTipCheckout` (`skipBacker`); success inserts `public.sponsorships` and grants 500 / 2,000 / 10,000 Aura. Incremental SQL: `supabase/legacy/sponsorships.sql`.

### Fan Tip History & Receipts

- Profile **Account Settings** adds **Tip History & Receipts 🧾** (Light `impactAsync` → `/receipts`). The screen is a hidden fan tab so the bar stays. Header metrics: Total Tipped, Athletes Supported, Total Aura Earned. Cards (`ReceiptCard`) use Polynesian Obsidian, `$10.00 Mālo ⚡`, Neon Jade `+100 Aura`, and **View Reel** → `/athlete/[id]`.
- `public.tips` now stores `fan_id`, `reel_id`, and `aura_points`. `useTipCheckout` inserts a ledger row on successful Mālo. RPC `get_fan_tip_history(fan_user_id)` joins `players` for name + school. Incremental SQL: `supabase/legacy/get_fan_tip_history.sql` (creates `public.tips` if this project never ran full `schema.sql`).

### Account Capability switcher

- Profile **Account Settings** shows an Account Capability row (`[ Fan ⚡ ]` or `[ Fan ⚡ | Athlete 🏆 ]`). The sheet (`RoleSwitcherModal`) explains Fan vs Athlete. Fan-only accounts get **Apply for Athlete Verification 🏆**, which calls `add_user_role` and unlocks payouts / Vault immediately. Dual accounts get a Fan View / Athlete Management toggle (`profiles.active_role`) with Medium `impactAsync`. Incremental SQL: `supabase/legacy/add_user_role.sql`.

### Fan bar on athlete profiles

- `/athlete/[id]` lives under `(tabs)` as a hidden tab (`href: null`) so Reel / Local / Upload / Drip / Profile stay on screen when opening an athlete from a Reel or Profile.

### Swipe-dismiss live banners

- `SwipeableBannerWrapper` (`Gesture.Pan`) lets fans swipe a top-floating banner up. Past `-30` `translationY` it times off to `-120` and calls `onDismiss`; otherwise it springs back to `0`. Opacity interpolates with the drag. A semi-transparent ✕ in the corner dismisses the same way. Light `impactAsync` on swipe or tap.
- Reel `LiveMatchBanner` stays dismissed for that game after swipe/✕ (survives Reel paging). It returns only for a new match or a score change; `ReelCard` play callouts and `/game/[id]` play toasts are separate new notifications.

### Stripe Connect Express

- Athlete Profile **Account Settings** (`PayoutSetupCard`) when `roles` includes `athlete`. Incomplete: **Set Up Payouts ⚡** + Neon Jade **Connect Bank Account**. Complete: **Payouts Active ✅** + **Manage Bank Account / View Express Dashboard**.
- `useStripeConnect.createStripeExpressAccount()` calls `POST /api/create-stripe-account` (Stripe Accounts **v2** Express + Account Link or login link), then `WebBrowser.openAuthSessionAsync`. Return syncs `stripe_onboarding_complete` and `payouts_enabled` onto `profiles` (and local cache). Button fires Medium `impactAsync` and shows a spinner while the link is generated.
- Incremental SQL: `supabase/legacy/stripe_connect.sql`. Deep-link return: `/stripe-connect` (`alasports://stripe-connect`).

### Dual Fan / Athlete

- `AuthContext` exposes `roles` (e.g. `['fan', 'athlete']`), `isAthlete`, `canReceiveTips`, and `isVerified`. Athletes keep Fan capability and stay on the fan hub when the Dev switcher selects Athlete (`ROLE_HOME.athlete = '/'`).
- Profile `AuraTradingCard` renders **[ Fan ⚡ ]** and **[ Athlete 🏆 ]** side-by-side when both are active. The flip back-face shows Total Tips Dropped + Poll Votes (Fan) and Season Points + Reels Uploaded (Athlete).
- Mālo via `useTipCheckout` is open to any authenticated user, including verified athletes. Success calls `add_user_aura` for the tipper and the reel athlete (skip the second call when the ids match). Drip / exclusive still grant only the payer. Incremental SQL: `supabase/legacy/profile_roles.sql`.

### Documentation

- Cursor rule `.cursor/rules/documentation.mdc`: JSDoc on new/changed functions; keep `docs/engineering/SYSTEM_OVERVIEW.md`, `docs/engineering/SCHEMA.md`, and `docs/ONBOARDING.md` in sync with code.
- System overview, schema, and onboarding rewritten for Phase 1 complete / Phase 2 staged / Phase 3 active engine.
- Product aliases: `video_tips` → `public.tips`; `add_user_aura(user_id, points)` → Postgres `target_user_id` / `points_to_add`.
- `AGENTS.md` and `docs/engineering/TROUBLESHOOTING.md` aligned with the live tree.

### Cheer polls

- `cast_cheer_vote` now takes optional `home_name` / `away_name` (re-run `supabase/legacy/cheer_polls.sql`; `DROP FUNCTION` of the 3-arg form first). Insert-on-miss starts at 0–0 with those labels. Featured `westlake-lone-peak` seed stays 124 / 98. Votes write `cheer_polls`, not `games`.

### Aura palette

- Tier 1 **Slate Silver** `#94A3B8` → Tier 2 **Island Cyan** `#00E5FF` → Tier 3 **Neon Jade** `#00E676` → Tier 4 **Electric Violet** `#B388FF` → Tier 5 **Crimson Ember** `#FF1744` → Tier 6 **Polished Gold** `#FFD700` → Tier 7 **Celestial Prism** `#00E676` / `#00E5FF`. Point bands unchanged. Re-run `supabase/legacy/add_user_aura.sql` (includes `DROP FUNCTION`) so `get_aura_tier` matches.

### Fan hub (Phase 1)

- Five-item bar: Reel, Local, Upload FAB, Drip, Profile.
- `expo-video` reel feed, tagged athlete clips, cheer poll, Top Aura Boosters.
- Reel feed micro-interactions: double-tap Neon Jade Aura ⚡ at the touch point (`bumpReelHype` + Medium haptic), Seki/Aura/Flex chips bounce 0.88→1.15→1.0 with a floating +1, single-tap mute badge.
- Profile 3D Aura trading card: `AuraTradingCard` replaces the static hub header. Front is identity + Aura progress; back is season stats, bio, and earned badges. Flip via **Flip Card 🔄** or double-tap; Medium haptic fires at 90°.
- Drip marketplace: `app/(tabs)/drip.tsx` with All Drip / Team Apparel / Custom Aura Cards / Athlete Merch pills (sliding jade indicator), `GearCard` 0.96 press + Light haptic, Reanimated `ProductSheet` (sizes, qty, Aura banner), Stripe **Buy Now**. Success runs `add_user_aura` (`dollars × 10`), success haptics, and toast **Drip secured ⚡**. `/shop` redirects to `/drip`.
- Local hub: **Live Matches / School Polls / Top Boosters** pills with the same sliding jade indicator. `CheerPollCard` (`src/frontend/components/Local/CheerPollCard.tsx`) springs the vote bar from 0% to the live share, fires Medium haptics, floats **+1 Vote ⚡**, and increments `cheer_polls` via `cast_cheer_vote` (not `games`). Top Aura Boosters cards scale 0.96 and open a 7-tier profile peek.
- Interaction audit: every product button fires `Haptics.impactAsync(Light)` via `HapticPressable` / `AnimatedButton`; pending disables on upload, PaymentSheet, reactions, operator GPS, and role-dashboard writes. See [AUDIT_REPORT.md](docs/engineering/AUDIT_REPORT.md).

### Operator (Phase 2)

- PIN keypad sheet (`Operator/PINClaimModal`) with Light `impactAsync` per digit; valid `1234` writes `games.claimed_by` and opens `/operator/[gameId]`. `/operator/console/[gameId]` redirects there.
- Scorekeeper: Home/Away **+1 / +3 / +6** spring the digits and call `update_game_score`. **Start / Pause Clock** toggles `is_clock_running` and ticks once per second.
- Callouts **⚡ Big Play / 🏆 Touchdown / 🤙 Big Hit / 🛑 Turnover** Broadcast on `game_events_${gameId}` with `{ type, timestamp, team }` (`Haptics.notificationAsync` on the operator). Focused `ReelCard` springs **⚡ BIG PLAY: Westlake Thunder!** for 3s (`useGameEventBroadcast`). Optional `game_events` INSERT still feeds `/game/[id]` history.
- Fan live overlay: `useLiveGame` subscribes to `games` / `game_events` Realtime; `Reels/LiveMatchBanner` shows home vs away, live score with `withSpring` on increments, quarter + pulse. `Operator/LiveScoreHeader` re-exports the banner.
- Incremental SQL: `supabase/legacy/games_operator.sql` (re-run to add `claimed_by`, `is_clock_running`, and the RPC).
- PIN + GPS check-in, game console (clock/score/events), scorer screen. Demo-open RLS remains.

### Monetization (Phase 3)

- Mālo presets `$5` / `$10` / `$25` / Custom; Aura `tipAmount * 10`.
- Athlete exclusive paywall: `$4.99/mo` Stripe PaymentSheet on `/athlete/[id]`; locked tiles blur with **Subscriber Exclusive 🔒**; success inserts `subscriptions` (`subscriber_id`, `athlete_id`), grants **+100 Aura**, success haptics, unlock toast, and unblurs immediately. `supabase/legacy/subscriptions.sql` reshapes stub tables and renames `user_id` → `subscriber_id`.
- Upload Seki Play: **Subscriber Exclusive 🔒** toggle persists `reels.is_exclusive`; athlete 3×3 grid refreshes from `UploadSheetContext` and shows the lock badge for non-subscribers.
- Subscriber Vault on `/athlete/[id]`: **All Highlights / Vault 🔒** pills; Vault filters `is_exclusive` clips; non-subscribers see the $4.99/mo callout; subscribers get Direct Request Q&A (`subscriber_requests`) and a Neon Jade crest on their Profile avatar and Q&A rows.
- RPC `add_user_aura` + `get_aura_tier`; 7-tier Aura card borders.
- **Known gap:** checkout does not insert `public.tips` rows (backer count, reel cents, and Aura still update).

## STATE §4 archive (moved 2026-10-12)

Engineering log entries rolled out of `docs/STATE.md` §4 so that section stays at about 15 entries. They are copied word for word, newest first; a § number in them means a section of `docs/STATE.md`. The dated sections above are the user-visible record.

- **2026-10-12 — ADM-01 keyboard focus follow-up (Codex).** `PortalShell` no longer pins the desktop header over page content; its comments now explain the keyboard constraint. In a synthetic-data browser check, Shift+Tab focused a Data control at y=10–34 behind the old header ending at y=75. The patched portal built in `.smoke/uiux-portal` and a browser read confirmed a static header. A post-fix focus screenshot showed the wrong page, and the requested viewport changed during later checks; those captures were rejected, so responsive/zoom and keyboard re-review remain open. Node v24.21.0: `pnpm check` passed (78 suites / 443 tests), and the separate portal runner passed 69/69. JEV assistance was attempted with a short non-sensitive brief, but external internet is disabled and no response was obtained. No hosted data, SQL, deployment or payment change.

- **2026-10-11 — Preview queued.** Profile `preview`. Android `fe188b8e-2a66-486f-a24e-9085dd6f7676`: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/fe188b8e-2a66-486f-a24e-9085dd6f7676. iOS `b16cc2cb-fb2c-4acf-9de1-430f82f53d9e`: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/b16cc2cb-fb2c-4acf-9de1-430f82f53d9e. This archive includes guest looking. iOS still installs only on the one registered iPad. The 2026-10-10 builds `196a7acf` and `9dad0fa8` do not. No SQL applied.

- **2026-10-11 — Guest looking.** A guest can watch the Highlight in front of them, including one someone sent, and two more swipes. The next swipe opens the account sheet and returns them to that Highlight. Upload opens the same sheet instead of the composer, so a guest no longer finishes the form and lands on a blank page. The test account `demo@tapuai.app` stays on the sheet with its password until `EXPO_PUBLIC_APP_ENV=production`. No SQL applied.

- **2026-10-10 — Google stays in the sheet.** Owner saved redirect `alasports://auth/callback`. Continue with Google still cannot create an account: the Google provider is off on development (`ulfapgtabidorgwfjvwz`) and staging (`tucioqipfejqqqtuakdi`). The authorize URL answers `provider is not enabled`, and the app now shows that in the sign-in sheet instead of opening the dead page. Email still creates the account. No SQL applied.

- **2026-10-10 — Aura card wears the tier.** The profile card edge, the “Community profile” / “Athlete profile” line, and the Aura card control use the color of the tier already earned. The bar names the next tier, so a rank that just started does not look empty. The label on the filled control stays dark so it stays readable. No SQL applied.

- **2026-10-10 — Exclusive stays in the Vault.** The profile row under the athlete card is Donate and Share. The same one-time $4.99 Exclusive purchase starts from the Vault tab and from a locked Highlight. No SQL applied.

- **2026-10-10 — Profile counts in the card.** Seki, Riding, Crew, and Squad are separate counts inside the athlete profile card. Crew is people who joined. Squad is mutual follows. The join icon sits under the Crew number only. Donate and Share sit under the card. No SQL applied.

- **2026-10-10 — Seki and Flex stories.** On a Highlight the story pops in above the caption, then tucks into icons so the clip stays visible. An arrow brings the line back. On the swipe-in athlete card and under the profile photo the line stays open. Three Seki, or a clip already marked for the Seki pill, reads “Seki play.” If you gave that Seki, it reads “You called it.” A Flex you give reads “Riding with” that athlete. Three Flex from the crowd reads how many people are on their side. Aura stays the burst, the count, and the tier. No SQL applied.

- **2026-10-10 — Latest preview uploaded.** Profile `preview`. Android `196a7acf-b18f-4af0-a4c8-85d7e9ab6afc`: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/196a7acf-b18f-4af0-a4c8-85d7e9ab6afc. iOS `9dad0fa8-1902-448f-82e7-03a9b4a869b5`: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/9dad0fa8-1902-448f-82e7-03a9b4a869b5. This archive includes the scoreboard name fix and the hype-button glow. iOS still installs only on the one registered iPad. The morning builds `6febe2bb` and `af6a7e72` finished earlier and do not contain those two fixes. No SQL applied.

- **2026-10-10 — Hype button glow.** A selected Seki, Aura, or Flex no longer draws its glow as a shadow on the bordered circle. The glow is a soft ring behind the button, and the border comes off while it is selected. The rail is wide enough to hold that ring. No SQL applied.

- **2026-10-10 — Live scoreboard names.** The Highlights score card was shrink-wrapping, so "Westlake Thunder" broke mid-word beside the score. The card now uses the chrome width. Each school is one line, and the score keeps a fixed column. No SQL applied.

- **2026-10-10 — Role screens use shared clients.** Athlete HQ saves a display name through `updateOwnDisplayName`. Parent HQ saves consent through `setParentPlayerConsent`. Profile loads its donation list through `fetchRecentTips`. The public athlete sheet loads the roster row and `profiles_public` through `lib/roster`. Direct route calls fell from 12 across 6 files to 7 across the two operator screens. Operator games and the scorer were left in place. No SQL applied.

- **2026-10-10 — One hype each on a live play, and smoother menus.** A live play accepts one Seki, one Aura, and one Flex. Another tap clears it. The count on the button stays 0 or 1, and the first select is the only one that calls `increment_player_hype`. Selecting fills the button and springs it. Clearing dips it. Highlights chips do the same dip when a vote comes off. Home / All / Seki, the fan bar, and the popup sheets use a settled rise (`SPRING_SHEET`) instead of a bounce. Jev chose `rise` at 0.86 and `dip` at 0.82 (528 input tokens, 59 output). No SQL applied.

- **2026-10-10 — Exclusive and booster labels match the one-time charge.** VOICE, after COMMERCE and BILLING confirmed checkout is a PaymentIntent. Jev chose `once` at confidence 0.94 (736 input tokens, 31 output). Exclusive buttons, including the profile Subscribe control, say “One-time Exclusive · $4.99”. Vault sentences say one-time Exclusive access and name the price with no `/mo`. Booster prices render as `$50` with no period, and the sponsor sheet no longer says “first month.” Dollar amounts and `EXCLUSIVE_MONTHLY_DOLLARS` are unchanged. Auto-renewal disclosure stays off. No SQL applied.
- **2026-10-10 — Local moderation queue columns.** Trust and Safety (`MODERATION`, Expo `/admin` desk). Open flags still shows the clip in Target and the reporter count. Reason and Athlete or guardian are columns on that same table. Reason uses the hide reasons already in the product, otherwise the first stored reason. A failed `reel_reports` read says "Not on this database" and leaves the athlete check "Not checked". A failed profile, player, or custodial-account read keeps the reason and shows "Not checked". A guardian on `players.guardian_id` or `custodial_accounts` counts as Yes. Telemetry rows say "Bug report" and an em dash. Strikes and appeals are still unbuilt. No SQL was written or applied. The hosted database was not queried. Jev chose `extend` at confidence 0.98 (466 input tokens).
- **2026-10-10 — Jev full helper pass.** CTO assigned ENGINEERING, who assigned FULLSTACK. Jev 1.13 compared 12 within-file simplifications (7,255 input tokens). It preferred replace on each one, with confidence 0.42–0.54, under the 0.90 bar, so no function was changed. Money, payout, auth, and legal paths were not sent. QA, reporting to the CTO, ran the mobile suite: 74 suites, 416 tests, pass.
- **2026-10-10 — Jev functions rechecked.** The reviewed functions now have a passing test run together: photo-story probes, report hide, Aura tiers, filmer tier and stats, dollar input, revenue basis points, and sport scoring/callouts. New cases cover `platformBpsForSource` and `parseSportConfig`.
- **2026-10-10 — Jev simplification pass, second batch.** Jev 1.13 compared four more snippets (1,309 input tokens). `parseFilmerStats` now uses one count helper. Sport scoring and callouts share `labeledEntry` for the label and id. The filmer tier loop stayed (confidence 0.18). `parseDollarInput` stayed, because the shorter version drops the dollar-sign strip and the zero rejection.
- **2026-10-10 — Jev simplification pass.** Jev 1.13 compared four current-versus-simpler snippets (1,209 input tokens). It kept `reportHidesNow` (an athlete or guardian report still hides immediately) and was unsure about the Aura tier loop and the revenue basis-point lookup, so those stayed. Photo-story missing-table, missing-function, and transport checks now share `errorMatches` in `lib/photoStories.ts`. The regexes are unchanged.
- **2026-10-10 — Compliance routing.** Legal recorded what the app already does and which team may do the next product step in `docs/legal/LEGAL_BRIEFING.md` ("Compliance routing — 2026-10-10"), with the same list in `docs/agents/DEPARTMENT_PLANS.md` and a pointer in `docs/agents/WORK_QUEUE.md`. The privacy inventory now names Apple and Google sign-in. Exclusive remains a one-time charge while some labels still say `/mo`. No Privacy Policy, Terms, or parental consent was drafted. The app is not public-ready.
- **2026-10-09 — Agents trained and connected to models.** Each callable agent now reads `docs/agents/EXPERT_STANDARDS.md` and has a Cursor model pinned with `force-default-model`. `pnpm agents:check` requires the registry model to match the file. No app code, SQL, or live keys changed.
- **2026-10-10 — iOS preview sent to EAS.** Profile `preview`. Build `af6a7e72-4203-4922-b0d7-590798e86576`: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/af6a7e72-4203-4922-b0d7-590798e86576. The provisioning profile still has one iPad (`00008101-001E5C840C47001E`). A phone added later needs a new iOS build.
- **2026-10-10 — Android preview sent to EAS.** Profile `preview`, platform Android. Build `6febe2bb-cc1e-4759-b216-7c02d078249e`: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/6febe2bb-cc1e-4759-b216-7c02d078249e. It uses the preview environment variables already on EAS. The 2026-10-01 installs remain the ones a tester can open until this build finishes.
- **2026-10-10 — Phase 2 local gate.** `pnpm check` passed: both typechecks, 72 suites / 414 tests, and the docs, copy, boundary, comments, agent, and client-key guards. Phase 2's exit still needs an installed build to sign in, upload, and take one test-card donation. The dry run can start on the 2026-10-01 Android and iPad installs. Those builds do not contain the October 7–9 app changes. A new preview was not started.
- **2026-10-09 — Teams continued until an owner gate.** Every agent is pinned to `grok-4.7-medium` (Cursor Models pool). Quality checked the photo-story counter and five dots in a browser fixture at 320 and 375, including doubled CSS text; Next moves `1 / 5` to `2 / 5`. The photo bitmap did not paint. Upload steps, tagline placements, a live feed, and device paging stay open. Database, Security, Finance, Legal, Product's public criteria, IT's next preview, Marketing, Partnerships, and Support are stopped until the owner approves the next step. No SQL applied, no live keys.
- **2026-10-09 — Department leads trained on their models.** Each lead researched its field and the results were written into `docs/agents/EXPERT_STANDARDS.md`. Corrections that were checked here: `useVideoPlayer` releases on unmount and `createVideoPlayer` does not; WCAG 2.5.8 is 24×24 CSS pixels and the 44 pt target is Apple's; the donation PaymentIntent is a platform charge, with destination charges still the planned shape; photo-story Jest is 6 suites / 60 tests. No SQL applied, no live keys, no legal text drafted.
- **2026-10-09 — Teams worked the department plans.** Quality re-ran the photo-story and owner-peek tests (5 suites, 55 passed). Product wrote the STATE §6 decision list into `docs/agents/DEPARTMENT_PLANS.md`. Legal confirmed the privacy inventory already names photo stories. Database and Security are holding the unapplied October SQL. The live photo-story browser check stays blocked until that SQL is applied. No SQL applied, no live keys.
- **2026-10-09 — Department plans.** `docs/agents/DEPARTMENT_PLANS.md` records, for every department, what is in the app (local, staging, written-only, device, public) and what that team will do next. Legal's public list is the existing counsel gaps (terms, privacy, export/deletion, association position, fee and minor-payee questions). No SQL applied, no live keys, no new legal conclusion.
- **2026-10-08 — Hierarchy grouped by lead.** The org chart and the agent index in `docs/agents/TEAM_HIERARCHY.md` list every agent under the lead it reports to. IT infrastructure specialists (CI, release, reliability, recovery, cost, telemetry, operator) use that department name. Database migrations and storage sit with the database team.
- **2026-10-08 — VP of Operations.** `VP_OPERATIONS` reports to the CTO. The CTO still assigns app fixes. The VP updates agent roles, protocols, and the work queue in the same turn they change, and checks that each team is doing the job its definition names. This is separate from `OPERATIONS`, which remains IT infrastructure. Registry is 90 agents.
- **2026-10-08 — CTO assigns app fixes.** `CTO` sits under the owner and above every department lead. Dev is `ENGINEERING`, product is `PRODUCT`, security is `SECURITY` (`RLS_SECURITY`, `SESSION_SECURITY`), IT infrastructure is `OPERATIONS`, and the database team is `BACKEND` (`DATABASE_MIGRATIONS`, `STORAGE`). A specialist reports to their lead. The lead reports to the CTO. `QA` can still reject. The owner still decides SQL, merge, live money, prices, and counsel. Registry is 89 agents.
- **2026-10-08 — Highlights owner peek card (Design, owner screenshot).** `ReelOwnerPeek` is rebuilt as an Island Daylight card instead of the heavy dark panel: `ReelPage` panel is now a fully opaque light surface with `MENU_METRICS.sheetRadius`, and the peek draws a header washed in the athlete's Aura tier (`tier.face`, tier pill/ring, quiet glow orb). Fixes: (1) Join Crew / Donate now fill the row as equal halves; cause was `AnimatedPressable.style` (outer touch target) vs `contentStyle` (inner scaled box) — `flex: 1` was on the inner box only, so the outer `Pressable` hugged content; width now goes on `style`, and the prop docs in `UI/AnimatedPressable.tsx` say so. (2) Stats are a fixed 2 x 2 grid (two rows of two, `numberOfLines={1}` + shrink), not a wrapping row. (3) The clip tag lives in an "On this clip" row with a video/photo icon and kind line ("Video highlight" / "Photo story · n photos"); no tag shows just the kind. (4) One primary action: Donate (filled jade) when the athlete is confirmed on the clip; when the tag is pending (button reads "Tag", outlined gold) or there is no donate handler, Open full profile takes the filled style. (5) `@handle` is now the account's real `profiles_public.username` (lookup by `player_id`, lazy once open, no new SQL); with no linked account no handle shows. The "Posted by" line no longer falls back to a name-derived handle: it shows the real `@username` or the plain name. (6) Video and photo-story clips share one code path (`ReelPage` wraps either); the row and a "Photo story" kind line tell them apart. (7) Close X is a 44-point target around a 34-point disc. Props, telemetry events, `AccessibilityViewIsModal` and hidden-when-closed behavior unchanged. New `Reels/__tests__/ReelOwnerPeek.test.tsx` (11 tests: labelled actions, Donate vs Tag, tag/no tag, photo vs video, no player, real vs missing handle, poster name, close/modal).  **ACCESSIBILITY pass (same day):** modal flag, focus moved to the athlete's name on open (delayed past the slide), spoken labels without bullets ("Tier 3, Neon Jade"; "Join Crew, follow ..."; "Tag: confirm ..."), name as a heading, hidden-from-readers clip behind the open card, one Close for assistive tech (the scrim is touch-only), reduced motion skips the entering animations, font-fit props on stats and Donate, and the handle in plain ink for contrast. **Browser-render defects fixed (VISUAL_QA, AUDIT_REPORT 2026-10-08):** (a) Join Crew / Donate and Open full profile are a pinned footer outside the scroll area (unpinned into the scroll only when `fontScale >= 1.3`, so huge text cannot let the footer swallow the card); the tier pill + Close (44 pt) are a pinned header; the modal flag moved to the card shell so the pinned parts stay reachable. (b) Phones under 380 pt get a slim header (62 pt ring, smaller name/stat/padding); order is identity, Posted by, 2 x 2 stats, then "On this clip". (c) `VarsityBadge` is shrink-safe and has an `iconOnly` mode; under 380 pt the verified check sits on the avatar ring (spoken label "Verified Varsity"). (d) Panel surface fully opaque; body top-aligned (no centred dead space). (e) Open full profile has a 1.5 pt jade-ink outline when it is not the filled primary. (f) `FOCAL.cyanInk` darkened `#007A8A` to `#00707E` (5.08:1 on `mistCyan`, was 4.43:1); it also drives the Local accent, the Island Cyan Aura tier ink, `MenuChrome` cyan and `CheerPollCard` fills (all darker by a hair; no test pins the old value; SCHEMA.md Aura palette row updated). **Re-rendered in Chrome (Playwright harness `.smoke/peek-ui`, cases a-f, 320 / 375 / 430, plus 320 at CSS 200% text):** panel 372 / 471 / 656 pt tall; Donate (or Tag) fully inside the panel in all 30 captures (Donate bottom 421 of 480 at 320, 520 of 579 at 375); Close 44 x 44 and never inside the scroll; no horizontal overflow or text outside the card; content overflow at 320 for cases a, b, c, e is 60 / 24 / 40 / 60 pt (only the "On this clip" row scrolls), d 110, f 146; at 375 a, b, c, e fit with 0 overflow (d 11, f 47); at 430 every case fits with 0. **Verified:** mobile typecheck, full Jest **72 suites / 414 tests**, `copy:check`, `comments:check`, `docs:check`. **Not verified:** native Dynamic Type / Android font scale (the harness cannot set `fontScale`, so the large-text unpinning and `adjustsFontSizeToFit` shrink are covered by unit tests and reasoning only; at CSS 200% on web Donate wraps mid-word and the stat label ellipsises because React Native Web ignores the shrink props), VoiceOver/TalkBack, the real swipe on a device, and the photo-story horizontal paging vs peek swipe conflict (PhotoStoryMedia's pager and the peek pan both claim horizontal drags; DEVICE_QA decides). The Local tab look with the darker cyan was not re-rendered. No SQL, payment, gesture-math or dependency changes.
- **2026-10-07 — Photo story prefetch.** The Highlights pager and the profile clip viewer load the photo story immediately above and below the focused page into the session cache. The next swipe does not start another video player to fetch those photos. SQL is still unapplied.
- **2026-10-07 — Photo stories, the message, Game Day, MCP tooling and four new agents (owner request).** Dispatched to specialists by slice (WORK_QUEUE UX-05a–e, BRAND-01, TOOL-01) against the contract in `docs/engineering/design/PHOTO_STORIES_DESIGN.md`. **Schema (UX-05a):** `20261007230000_photo_stories.sql` adds `reels.media_type` / `photo_count` (count zeroed on insert by trigger, set only by RPC), `reel_photos` (RLS: uploader/admin read; no client writes), `set_reel_photos` (owner, 1–10, anchored own-folder Storage **paths** — never URLs, publish-once, ≤200-char descriptions), `reel_photos_feed` and `reels_feed.media_type/photo_count/cover_path` with the same vault gate as `video_url`; adds `image/jpeg` to the `reels` bucket allow-list (it only accepted video). Copied onto `schema.sql`; **never parsed by Postgres; not applied.** **Upload (UX-05b):** Media step `Video | Photos` (Photos only when the SQL exists), up to 10 photos with Move earlier/later/Remove, optional per-photo descriptions, photo rights wording (`PHOTO_RIGHTS_CHECKS`, version `2026-10-07`), Vault hidden, nothing published unless every photo uploads and the RPC succeeds; `stripJpegMetadata` removes EXIF/GPS/XMP/IPTC/comments before upload and non-JPEGs are refused; shared `insertReelRow` keeps video inserts unchanged. **Feed (UX-05c):** `PhotoStoryMedia` pager with `2 / 5` chip and dots, description via `ReelActionOverlay` `storyNote`, `useStoryPhotos`, `📷 n` grid badge, 3-second views; `isListableReel` hides 0-photo stories and removed clips everywhere `lib/reels` lists them; `ReelCard` keeps expo-video in a local `ReelVideoLayer` and fixes `loadedUriRef` so the first clip's source loads (test fails on the old line; device check pending). **Label:** "Game Play" → **Game Day** in app copy, admin hints and docs; stored value `game_play` unchanged. **Message (BRAND-01):** "Donate. Elevate. Celebrate." + "Support their journey. Elevate their opportunities. Celebrate their story." in the welcome overlay, the donate popup's Amount step, and under an athlete's Donate button (not owner or community profiles); VOICE rules, STORY, PUBLIC, draft `docs/product/STORE_LISTING.md`; LEGAL rows U (photos of minors/bystanders), V (metadata), W (no outcome promises). **Tooling (TOOL-01):** `.mcp.json` with `playwright` (cached `@playwright/mcp@0.0.83`, Chrome), `expo`, `canva`, `supabase-dev` (read-only, development project); `docs/engineering/TOOLING.md`. **Org:** new `PHOTO_STORIES`, `DESIGN_TOOLING`, `VISUAL_QA`, `BRAND` (87 agents), leads' definitions, TEAMS, TEAM_HIERARCHY and WORK_QUEUE aligned; photo-story IDs moved to UX-05 because Codex's profile work holds UX-04. **QA review (independent) found and the owners fixed:** a URL rule that let a story point viewers at an outside server (now Storage paths only), photos swappable after publishing (now publish-once), Spotlight featuring a story with a stock demo video (Spotlight is videos-only; no demo fallback for real reels), unpublished stories in tag prompts and filmer rewards (filtered), Vault toggle on stories (constraint + hidden option), lost photo orientation (Orientation tag kept, GPS still removed), retries creating extra rows (retry reuses the reel), views counted before photos load, and web counter sync. A second QA pass confirmed every fix and found two more, also fixed: a lost reply after a successful publish now reads the row and succeeds instead of trapping the user in "already published" retries, and a refused Vault toggle now shows an error instead of a silent no-op. Known trade-offs: an empty-bodied probe error hides Photos until the app restarts; the stories beside the focused page are prefetched, and photos still load only for the current card's player. Separate migration `20261007231000_reels_storage_owner_folder.sql` limits `reels` writes to the caller's own folder for both path layouts (not applied). **Verified:** `pnpm check` (both typechecks, **71 suites / 396 tests**, all guards). **Not verified:** any SQL execution or RLS negative test, device orientation/gestures/memory, VoiceOver/TalkBack, Expo Go vs dev-client compression, and the MCP servers inside a session (they load on the next start in the repo).
- **2026-10-07 — Profile sports and navigation (owner request):** One selected sport feeds hero, Stats and Aura: exact linked owner's chosen sport, public view sport when available, stored career sport, then unique catalog position. Unknown/ambiguous positions no longer default Football. Missing real totals/measurables/logs remain unreported; mismatched stored sport totals/logs are excluded instead of relabeled. Demo numbers are restricted to explicit demo/dev ids. Published playbook labels shape both Stats and Aura; Aura points are separate from sports stats. Compact athlete hero, 44-point actions and wrapping Highlights / Stats / Goals / Vault / Team / owner Manage controls replace the long action stack. Goals opens wishlist first and Rally second; Team opens teammates; owner thank-yous and Vault tools move to Manage. Exact profile links govern owner controls; rapid public navigation rejects stale loads and hidden schools suppress roster/crest fallback. **Database:** `20261007211500_public_profile_sport.sql` appends nullable selected sport to the existing privacy-filtered public view, mirrored in canonical SQL; prepared only, no PostgreSQL replay or hosted application. Older databases fall back to career/unique position. **Design:** editable Figma and Canva artifacts linked in ARCHITECTURE; rendered public concept verified, final owner/Aura Figma renders blocked by seat limit. **Verification:** regression tests failed before fixes; `pnpm check` passes both typechecks, **60 suites / 311 tests** and all guards; fresh Expo web export passes (52 static / 3 API bundles). Browser scope/evidence is in AUDIT_REPORT. Native text/readers/gestures remain pending.

- **2026-10-07 — UX-03 browser verification follow-up:** Browser Bridge reached the local Expo app; controlled real-component fixtures cover long team/school/athlete/position labels, jersey zero, scheduled/final/missing scores and untimed volleyball. Fixed same-name public-athlete credential borrowing with an exact player link, community school-confirmation leakage, spoken Local school identities and the scoreboard dismissal button/44-point target. Browser 320-pixel / 200% text checks exposed cramped Local identity and Highlight overlap; team scores now wrap, the feed passes measured header clearance, and bounded copy/rail scrolling retains access to controls. Aura burst renders outside the clipped rail. **Verified:** full `pnpm check`, both typechecks, **55 suites / 261 tests** and all guards; new regressions failed before their fixes. Final narrow browser checks retain screen width and reach Local/Profile/Highlight callbacks and scoreboard dismissal. Fresh Expo web export passed (52 static routes / 3 API bundles; dotenv disabled, one worker), output `/tmp/ala-sports-ux03-web`. Browser screenshots/geometry and scope are recorded in `docs/engineering/AUDIT_REPORT.md`; scratch evidence is `/tmp/ala-sports-ux03`. Browser text scaling is a CSS stress test, not native Dynamic Type. **Pending:** VoiceOver/TalkBack, native text scaling, playback/paging gestures with nested scroll, camera/haptics and test PaymentSheet. No hosted SQL/configuration or payment changes.

- **2026-10-07 — UX-03 sports identity (owner request):** Local GameCard now pairs each school/team with its own score, sport, recorded status and venue; neutral letter tiles replace crest-like decoration. Shared `Local/gamePresentation.ts` keeps scheduled/final states authoritative, omits unavailable clocks and displays unreported scores as a dash while retaining recorded zeroes. Profile hero emphasizes the athlete name/photo and known sport, position and class; community profiles hide athlete credentials, public athletes do not inherit the signed-in viewer’s metadata, and school crests retain their existing confirmation rule. Highlight overlays add real roster jersey/position, allow longer athlete/school labels and retain the existing profile, reaction and donation actions; the match banner shares the honest scoreboard rules. **Verified:** `pnpm check` passes both app typechecks, full Jest **53 suites / 256 tests** and docs/links/copy/data-boundaries/comments/agents/client-credential guards. Targeted coverage totals **17 tests** (6 Local, 3 Profile, 4 Reel, 4 banner). QA found and verified fixes for a three-digit clock fallback and a missing class-year sentinel; raw long clocks are preserved and missing class values omitted, with boundary regressions. Expo web export passed (52 static routes / 3 API bundles; `EXPO_NO_DOTENV=1 CI=1`, one worker, output `/tmp/ala-sports-sports-ui-web`); this confirms bundling only. **Unverified:** rendered layout/screenshots and native narrow-screen, large-text, screen-reader and long-caption/overlay fit. Browser/browser-bridge tools were unavailable and no CDP session was available. No dependencies, backend, schema, payment or generated product-fact changes. Next: DEVICE_QA/QA run the UX-03 checks in TESTER_SCRIPT.

- **2026-10-07 — Organization verification and phase preparation:** Reviewed Claude's committed docs/archive layout and current imports. Active local Markdown file destinations resolve; added `docs:links` to prevent future move regressions and a shared `security:client-keys` check that reports locations without printing credentials. `pnpm check` and CI now share those checks; CI uses Node 24 to match Expo SDK 57 requirements and local setup. Corrected Next Profile's misleading edit/publish copy and onboarding's root config/native-build guidance. Reconciled six saved staging migration dates, clarified baseline replay strategy and Supabase dependencies, and made R1–R4 current evidence/next actions explicit. **Verified:** both typechecks, full Jest 50 suites / 242 tests, existing project guards; both new guards accept the current tree and reject intentional invalid fixtures. Expo web export passed (52 static routes / 3 API bundles; dotenv disabled); Next optimized build passed. Combined iOS/Android export initially reached Hermes then received SIGKILL; isolated `--max-workers 1` exports passed with Hermes bytecode (iOS 8.2 MB; Android 8.4 MB). No quarantine changes were needed; the compiler probe also passed. Final `pnpm check`, including both new guards, passed. Native interaction/Stripe and hosted SQL replay remain unverified; production is not created. No external deployment, SQL application, merge or push.


- **2026-10-07 — Readiness R1: repo and docs organized for outside engineers (owner request).** Committed the day's work as five topic commits, then: `my-app/` → `archive/my-app/` (with `archive/README.md`); `.tmp/` and `.smoke/` untracked and ignored, files kept; docs moved into `docs/engineering/` (+ `design/`), `docs/product/`, `docs/legal/`, `docs/company/`, `docs/agents/`, with root `TROUBLESHOOTING.md` moved in and root `DOCUMENTATION.md` renamed `docs/engineering/SYSTEM_OVERVIEW.md`. A script rewrote every relative link and repo path in docs, agent definitions, registry, scripts, rules, CI, PR template and SQL comments (0 broken links before and after); `sync-front-docs.mjs` emits the new relative links. New: root `README.md` rewrite, `docs/README.md` index, `docs/GLOSSARY.md` (names checked against the code), ONBOARDING "Start here", `pnpm test` and `pnpm check` (runs every CI check). `CODE_ORGANIZATION_PLAN.md` now carries readiness phases R1–R4 (distinct from ROADMAP Phases 0–5); ROADMAP Wave 1 checklist item 9 requires R3; WORK_QUEUE has R1-01 … R4-03. **Verified:** `pnpm check` passes (both typechecks, 50 suites / 242 tests, all guards). **Not done:** merge/push/branch protection (owner approval), moving legal/company docs private, root `app.json` and the empty `apps/mobile/apps/` folder left in place. No app behaviour changed.
- **2026-10-07 — UX-02 integration recovered after the session disconnect:** Fixed payment startup during the close animation with a synchronous host interaction guard. Stripe success now enters a terminal paid state even if donation recording or counters fail; post-payment errors explicitly say the payment went through. Recipient generations prevent an old inline payment from updating a replacement athlete or its parent callbacks. Optional card-fee screen-reader labels include the exact charge and unchanged family share. Repaired the filmer test fixture with a safe-area provider. Independent QA reviewed and rechecked all four findings. **Verified:** both app typechecks; full Jest **50 suites / 242 tests pass**, followed by the latest checkout callback regression (**8 tests pass**); docs/copy/comments/data-boundaries/agents and whitespace guards pass. Two existing SoftWall test act warnings remain non-failing. **Pending:** native small-screen/keyboard/text-scale/screen-reader and Stripe-device evidence, plus hosted configuration/SQL checks. Payment still uses the existing client `tips` insert after Stripe; this UI guard does not establish authoritative crediting or reconciliation. No build, SQL application, deployment, push or live payment in this recovery pass. Next: WORK_QUEUE W0-05 staging sign-in/test checkout and UX-02 native smoke using TESTER_SCRIPT.


Keep ~15. Older entries live in `CHANGELOG.md`.

- **2026-10-07 — Stripe secret out of the repo (owner request).** `STRIPE_SECRET_KEY` (test key) sat in `apps/mobile/.env.local` and root `.env.local`, and Expo had logged it in plain text to `apps/mobile/.expo/dev/logs/start.log` 104 times. Moved the value to `~/.config/ala-sports/stripe-secret.env` (600), replaced both lines with a pointer, redacted the log in place (nothing deleted). Checkout and Connect are unaffected: `create-payment-intent` and `create-stripe-account` are deployed on the development project (probed 2026-10-07: 401 without auth vs 404 for a missing function), so the client never reaches the Metro fallback. Without the key, `POST /api/create-payout` returns `queued` (it already refused real transfers). `apps/mobile/.env.example`, ONBOARDING, TROUBLESHOOTING, README and ARCHITECTURE now say the secret belongs in Supabase secrets, never `.env.local`. **Not verified:** that the development project's Edge Functions have their own `STRIPE_SECRET_KEY` secret set (no Supabase CLI token here), and no test donation was run. **Owner:** rotate this test key in the Stripe dashboard, since it sat in world-readable files and logs, then update Supabase secrets on staging and development and the private file. No code changed.
- **2026-10-07 — Native modules unblocked (environment, no repo change).** Cleared macOS quarantine on the seven native binaries and restored the lightningcss 1.33.0 binary that a "Move to Trash" click had removed (see §3). All load in Node; lightningcss 1.33.0 transforms CSS. Expo web export and `pnpm admin` were not re-run.
- **2026-10-07 — UX-02 (owner request):** Donate now uses Amount → Options → Review in one popup with fixed navigation; Back retains amount/extras and only the final reviewed Donate action starts payment. Pending payment locks navigation, exit and duplicate submissions. Upload and shared fan sheets/pages use playful Island Daylight chrome, accent washes and shared rounded geometry. MENU_STYLE_MAP inventories all modal-bearing components and visual exceptions. Added DOCUMENTATION under ENGINEERING (83 callable agents); all 82 existing definitions now hand off synchronization evidence. Teams/hierarchy/registry, architecture, conventions, voice/legal implementation notes, tester journeys and press staleness updated. Local integration is now verified above; native layout/keyboard/screen-reader/Stripe-device verification remains pending. No hosted changes in this UX-02 pass.


- **2026-10-07 — UX-01 (owner request):** Rebuild the long uploader as Video → Details → Review, with fixed Back/Next/Publish, optional settings and searchable athlete/game screens. Draft state stays in the controller; selecting another clip resets rights; no implicit demo game. Mandatory athlete/caption/category-specific rights and the published-clip/unsaved-mentions warning remain. Implemented: controller 386 lines plus composer 271 replace the 1,238-line form; optional account targets have 44-point minimums. Seven upload scenarios cover validation, draft/back/reset, optional choices, rights resets, duplicate/exit locking, failed-upload retry and partial mention failure. Full Jest **47 suites / 228 tests pass**; mobile typecheck and project guards pass. Independent design/code review passed. Native layout, keyboard, screen readers and picker checks not run; short-page scrolling may remain on smaller phones or larger text. Existing library picker still has its own selection screen.

- **2026-10-07** — Expanded from 18 to **82 callable agents** with specialist ownership for media, money, identity, privacy, safety, runtime/admin, operations, quality, partnerships and product/support. Updated all existing definitions, TEAMS and hierarchy; registry validates files, leads, paths and documentation through `pnpm agents:check` in CI. WORK_QUEUE assigns acceptance criteria and release gates. Definitions are available roles, not continuously running workers.
- **2026-10-07** — Guest match queries and Realtime moved to `lib/guestGames.ts`; guest athlete lookup moved to `lib/roster.ts`. Route data debt fell **8 → 6 files, 17 → 12 direct calls**. Late subscription callbacks and asynchronous play joins are silenced after cleanup; request generations also prevent an older overview response from replacing the current match. Five data-layer regression checks cover match/feed failures, roster fallback, event filtering, cleanup and unconfigured access; two route scenarios prove older overview success/failure cannot replace the current match. Initial integration: both app typechecks and 44 suites / 204 tests pass. Final verification covers 47 suites / 222 tests: the full run passed 46 suites / 221 tests and the new upload fixture initially failed on missing safe-area context; after fixing only its fixture, its targeted suite / test passed. Both app typechecks, docs/copy/comments/boundaries/agents checks and diff whitespace pass. Live database, native device and Stripe checks not run.
- **2026-10-07** — Account-tag hardening: serialize additions on the owned reel before enforcing max 3; only an owned pending confirmation reports success. Genuine attachment failures reach an accurate published-clip warning; failed inbox decisions remain visible. Updated still-unapplied `20261002160000` and canonical schema together; no SQL applied. Helper and component tests verify rejected confirmations and published-upload failure messaging. Database concurrency/RLS execution remains unverified without Postgres. Staging/build/branch claims reconciled to dated records and cached Git refs; no remote refresh. Privacy map now lists the existing custodial DOB exception, verification contacts, account mentions, reports and Rally/thanks records.

- **2026-10-07** — Org chart for the whole roster: `docs/agents/TEAM_HIERARCHY.md` (Facilitator → departments → agents, Engineering/Legal/QA zoom-ins, A–Z index). Call detail stays in `docs/agents/TEAMS.md`.
- **2026-10-07** — Agent roster: Engineering lead + **Database** (`BACKEND`) + **Full-stack** (`FULLSTACK`) with an explicit no-shortcuts / industry-practice bar; **COMPLIANCE** owns the privacy/ToS checklist (export/deletion, processors, no false SOC 2, no fake SLA, trackers before consent); **QA** is the testing ship gate. Call sheet: `docs/agents/TEAMS.md`.
- **2026-10-02** — Review hand-off in §0 matches the branch on GitHub and the local work that is not pushed yet. Highlight account tags are in the app (`reel_account_tags`, up to three, confirm before the name shows). SQL `20261002160000` is written and not applied. A fan digital signature on the Aura card is later only.
- **2026-10-02** — Support received shows **$0.00** and "No donations yet" when nobody has donated, and also when `get_received_malo` is missing or the call fails. That database message stays off the profile and Athlete HQ.
- **2026-10-02** — Highlights: Rivalry week dismisses with a swipe left or right and stays gone for the visit. The donate sheet opens at the top of the form, stays inside the screen, and scrolls when the phone is short.
- **2026-10-02** — Privacy work re-landed and telemetry conflict closed. A parallel session had deleted
  this session's uncommitted data-privacy docs and the `operator_checkins` RLS fix (no git history held them);
  they were restored from the session transcript. `docs/engineering/DATA_PRIVACY_MAP.md` (data inventory, gaps, recommended
  structure, keep-current rule) is back, linked from COMPANY_PHASES S2 item 6 / L4, LEGAL_BRIEFING and
  DOCUMENTATION; ROADMAP Round 35 restated. The `operator_checkins` fix is now a proper migration,
  `20261002120000_operator_checkins_role_check.sql` (anon demo-PIN, operator, admin — parity with
  `operator_gigs`), copied onto `schema.sql`, **not applied anywhere**. Telemetry: the competing authenticated-only
  insert policy and `insert_guard` migration were removed in `6742a35`, so guest inserts stay; staging's CHECKs
  were read back and match `20260929190000_telemetry_logs_bounds.sql`. Stale "not applied" wording corrected in
  the migration header, README and SCHEMA.md. Not verified: no Postgres here, so the new policy is unparsed.
- **2026-10-02** — Comment standard (owner: make the code easy to follow for outside reviewers). Every
  source file under `apps/mobile/app` and `apps/mobile/src` now opens with a short header saying what it
  is, where it fits and what it touches (about 120 files that had none: lib, hooks, contexts, services,
  data, route layouts, large components, the Stripe API handlers). New rules in `docs/engineering/CONVENTIONS.md` §5
  (file header, doc block on hooks / RPC helpers / complex components, inline comments explain *why*, SQL and
  folder READMEs, keep comments true when you edit) mirrored in `.cursor/rules/documentation.mdc`,
  `AGENTS.md` and the PR template. New guard `scripts/check-comments.mjs` (`pnpm comments:check`, CI step)
  fails a file with no comment before its first exported function or in its first 60 lines; tests, `.d.ts`
  and the generated `types/database.ts` are exempt. Comments only — no behaviour changed; tsc, jest
  (41 suites / 194 tests), `copy:check`, `docs:check`, `app:data-boundaries` pass. Not covered: the guard
  checks that a comment exists, not that it is accurate or good; Edge Functions, `supabase/*.sql` and
  `apps/admin-portal` are not scanned. Header text was checked against the code it describes, but a
  reviewer should still treat any header as a map, not a spec.
- **2026-10-02** — Drip is off. `tabs.drip` defaults to false, and the published flag is false on staging and the development project. The screen and `/admin/drip` stay. Wave 1 is when the marketplace comes back (`docs/product/ROADMAP.md`). Finance (`COMMERCE`) still owns the code. A preview already installed picks this up on the next open; no new build.
- **2026-10-01** — Callable department agents. `CALL: DESIGN` (`.claude/agents/design.md`) produces the screen. `CALL: ENGINEERING` (`.claude/agents/engineering.md`) produces the code and routes to the squad that owns the files. Legal, Brand (`VOICE`), and Quality (`QA`) were already callable. Marketing and Support still have no agent.
- **2026-10-01** — Upload and report safeguards. The upload sheet will not publish until the person
  confirms they filmed the clip or have permission, the sound is the original recording or music
  they have the right to use, and they are not treating a school logo, team mark, or TV broadcast
  as theirs. Game play also requires a real-footage confirmation. Reports pick a reason.
  Fake footage, impersonation, and music/logo/broadcast leave the public feed for review; other
  reasons wait for the tagged athlete, their guardian, or three accounts. Migration
  `20261001180000_content_rights_reports.sql` is applied on staging, not the development project.
  Those preview builds finished the same day (Android
  `061946c8-a25d-4a32-b5be-bab316819c1d`, iOS `a93f562d-d122-48a4-a20f-3e466368aa4a`).
  iOS still installs only on the registered iPad. The 2026-09-30 installs do not ask the questions.
- **2026-09-30** — September SQL is on staging (`ala-sports-staging`), not on the development
  project. Applied `tip_origin.sql` first (staging had no donation-channel columns), then
  `clear_reel_hype`, custodial money, leaderboards, and migrations `20260929120000` through
  `20260929190000`. Rally, custodial accounts, filmer rewards, and view counting now exist there.
  Preview env now points at staging. Android and iOS preview builds both finished
  (`25203aff-a4bb-41fa-90aa-88c4f6cd1441`, `22ce0d45-10b2-43fb-ace6-bfc3816b4814`).
  The test Stripe secret is on staging.
  `stripe-webhook` stays off.
- **2026-09-29** — Cross-surface engineering pass. Highlights shows an active rivalry banner and
  opens Local on School Polls; Activity thank-yous open the athlete; Drip now has pull-to-refresh
  and separates loading, failure and a genuinely empty rack. Donation panels, Athlete HQ, Parent
  HQ, Booster HQ and Sponsor HQ show Retry instead of false empty copy. Operator scorer has Retry;
  GPS check-in reports success only after `operator_checkins` saves. Sponsor, Booster and check-in
  writes moved from routes to `lib/` (route Supabase debt 11 → 8). Reviewability: PR template,
  CODEOWNERS, components/hooks/lib/Supabase READMEs, and `pnpm app:data-boundaries` in CI. Focused
  tests cover rivalry navigation, Activity thank-you ids, Drip retry/empty, Spotlight retry/profile,
  Rally clip navigation, role helpers, donation errors and operator check-in. No SQL applied; not
  device-tested.
- **2026-09-29** — Telemetry row bounds, not applied
  (`20260929190000_telemetry_logs_bounds.sql`). Guest inserts stay (browse-first). A row must use a
  real event type, including `flash_unlock` and `stripe_webhook_payment_succeeded`. Scroll depth
  caps at 100, a tab visit at 12 hours, other durations at 10 minutes, text fields and payload are
  capped. One fake row can no longer wreck a Reports average. Many small valid-looking rows still
  can — that waits on §6 item 1. Not parsed by Postgres. Safe to re-run if an earlier draft of this
  file was applied (that draft omitted Flash Unlock and the webhook event, and capped every
  duration at 10 minutes, which would drop a real long visit).
- **2026-09-29** — Rally on Highlights (ROADMAP M2 / M8, no new SQL). A compact Rally meter sits on
  the current clip and opens the donate sheet for that goal. When a Rally fills, a full-screen
  moment replaces the small confetti burst. "Watch what it paid for" opens that clip in the
  profile pager (and jumps the Highlights feed when the clip is loaded).
- **2026-09-29** — Full audit (owner: no contradictions between policy docs and the app; every
  button works). Five read-only auditors covered Highlights, auth / roles, profile / money, Activity /
  Spotlight / Drip / Local, admin desks + portal, and policy vs code; every claim was checked against
  the code before changing anything. Fixed: `SoftWallModal` `run` has a ref guard so two taps in one
  frame can't start two sign-ins (test proves it fails without the guard); Admin → Money "Mark paid" /
  "Failed" now confirm, show a busy state and surface a failed write (they were fire-and-forget with no
  catch); Admin → People Verify / Unverify and Grant / Revoke admin confirm first, like Freeze. Retired
  "Chip In" wording removed from SoftWallModal / SoftWallContext comments. Also checked by script:
  every literal route resolves, every `.rpc()` / `.from()` name exists in `schema.sql`. Left on
  purpose: Receipts "Back to Profile" pushes the Profile tab (right for a tab route, safe on deep
  links); Highlights / Moderation Remove, Vault lock, Drip and Wishlist hide stay one tap (each has a
  Restore / toggle back); screens still calling `supabase` directly are the known CODE_ORGANIZATION
  Step 3 debt; LEGAL_BRIEFING still says Mālo for money in prose (LEGAL owns it, already noted there).
- **2026-09-29** — Hand-off docs (owner: make sure the next AI can pick up and keep the docs
  current). New §0 here: branch, SQL apply order with dependencies and a pre-flight query, next
  steps, what not to build without the owner, green-tree commands, and a doc checklist. §2 page
  count fixed (7), §5 push row, §7 lists VOICE / LEGAL / PUBLIC / INVESTOR / COMPANY_PHASES /
  CONVENTIONS. Stale money words fixed in DOCUMENTATION (executive summary said "Mālo micro-tipping"),
  README, ARCHITECTURE, ONBOARDING, ALA_TEAM_BRIEF, COMPANY_PHASES (still said no fee in fan UI), and
  the COMMERCE / AUTH / PROFILE / QA agents (QA now checks the split disclosure, No-tip default and
  presets-only thanks). `sync-front-docs.mjs` "Admin donation rake … control plane only" → "Donation
  split … disclosed". `supabase/migrations/README.md` points at §0 for apply order. Docs only.
- **2026-09-29** — M2 Rally goals, Say thanks, fee model (owner: keep the 10% and disclose it on the
  sheet, GoFundMe-style optional tip for Tapua'i at checkout; athletes are encouraged to thank donors).
  Migration `20260929180000_rally_goals_thanks_platform_tip.sql` (not applied; needs
  `custodial_money.sql`, `company_revenue.sql`, `tip_origin.sql`): `rallies` (one open per athlete;
  guardian's Rally live at once, athlete's waits for guardian approval — an adult athlete without a
  birthdate on file also waits), `create_rally` / `approve_rally` / `close_rally` / `thank_rally`
  (needs donations + a non-Vault clip) / `get_active_rally` / `get_player_rallies`; `donation_thanks`
  (preset keys only) with `thank_donation` / `get_donations_to_thank` / `get_my_donation_thanks`;
  `tips.platform_tip_cents` / `rally_id` / origin `rally`; `company_revenue_logs` source `tip`.
  Client: `lib/rallies.ts`, `useRally` (`available` is false until the SQL exists, so the "Start a
  Rally" invite hides), `components/Rally/RallyCard` + `CreateRallySheet` (athlete profile and Parent
  HQ), `lib/donationThanks.ts`, `useDonationThanks`, `components/Thanks/ThanksPicker`, Say thanks in
  `ReceivedMaloPanel`; donate sheet shows the 90 / 10 split (`MALO_DISCLAIMER`, now a literal checked
  against the BPS constants), optional tip for Tapua'i (default No tip) and a total breakdown; the fee
  box now defaults off. `copy:check` allows "tip" only on a line naming Tapua'i. Not built: filmer tip
  jar (LEGAL row P), Rally meter on Highlights, full-screen fill celebration; "Watch what it paid for"
  only switches to the Highlights tab. `tips` inserts are still client-side and not checked against
  Stripe, so Rally totals can be inflated until Phase 1a. LEGAL rows L, R, S, T; App Store 3.2.1(vii)
  risk on the 10% is with counsel (fallback: `MALO_PLATFORM_CUT_BPS` = 0 plus the tip). tsc clean,
  jest 172/172, `copy:check` + `docs:check` ok.
- **2026-09-29** — Donation language (owner: make it obvious Tapua'i is a donation app, a GoFundMe
  replacement for families; plain words so people keep donating). All on-screen money copy (fan,
  Expo admin, Next portal, `shared-types` hints) now says **Donate / donation / donors / gear goal**;
  "Mālo!" only as a thank-you. Retired: Mālo-as-money, tip, backing, Chip In, fund. New
  `DONATE_LABEL` / `DONATION_MISSION` / `donationWhereItGoes` in `data/malo.ts` (donate sheet header,
  first-open `WelcomeOverlay` — which used to say "send a Mālo when a play hits home", a performance
  tie). Rules `docs/product/VOICE.md`; `scripts/check-copy.mjs` (`pnpm copy:check`, new CI step); VOICE agent
  `.claude/agents/voice.md`; TEAMS/AGENTS updated; LEGAL row Q. Code names (`malo*`, `tips`,
  `buttons.malo`) unchanged. Published `app_runtime_config` copy overrides defaults — re-publish from
  `/admin/look` if an old Mālo line is live. (The 100%-vs-10% gap noted here was closed by the
  Rally / fee-model entry above: the sheet now discloses 90 / 10.)
- **2026-09-29** — Filmers: tiers, Top Filmers, Aura and Props (owner: build filmer stats + Aura for
  filmers; pave a quiet future path for Tapua'i to pay filmers out of the app, never from the athlete's
  cut). Migration `20260929170000_filmer_rewards.sql` (not applied; needs `20260929160000`):
  `filmer_rewards` ledger (idempotent `source_key`; `cash_cents` always 0; `funded_by` CHECK
  `= 'tapuai'` so gifts can never fund it — not shown anywhere in the UI), `filmer_props`, trigger
  `reels_filmer_rewards` (+10 on tag confirm; +10 / +50 / +200 at 100 / 1K / 10K views),
  `give_filmer_props` (+1 Aura, 50/day), `get_top_filmers`, `filmer_stats` v2. Client: `lib/filmers.ts`
  (tiers Rookie / Sideline / Pro / Legend), `useFilmerStats`, `components/Filmers/FilmerCard` (own
  profile: stats or a "Film a teammate's play" invite; other profiles once they have a clip) and
  `FilmerSheet` (tap "🎥 Filmed by" → stats, Give Props, how filmers earn Aura), Spotlight Boards
  "Top Filmers 🎥" tab. No cash tip jar for filmers (money between users, minors — LEGAL row P).
- **2026-09-29** — Views + filmer credit (owner: per-clip likes from other accounts, views on the
  profile "like other social platforms", reward the athlete in the video, encourage fan uploads).
  View rule moved from "2 s on screen in Home" to **3 s of actual playback** (or 90% of a shorter
  clip) in every `ReelCard` feed: `VIEW_PLAY_MS` / `viewThresholdMs` (`lib/leaderboards.ts`),
  `useReelViewTracker(reelId, signedIn, playing, thresholdMs)` accumulates play time across pauses;
  Home no longer calls it. Migration `20260929160000_reel_views_and_filmer_credit.sql` (not applied;
  needs `supabase/legacy/leaderboards.sql`): `reels_feed` + `view_count` / `uploader_name` (null when the
  athlete posted it) / `uploader_avatar_url`; `athlete_highlight_views`; `filmer_stats` (no client
  caller yet — for a filmer profile / Top Filmers board if the owner picks that). Client: new top
  feed tier in `lib/reels.ts` (falls back to the tag tier), `HighlightClip.viewCount` / `filmedBy`,
  "🎥 Filmed by" in `ReelActionOverlay`, ▶ count on `TaggedReelGrid` posters, profile views from
  `fetchAthleteHighlightViews` (fallback `players.view_count`). Fixes: `ReelOwnerPeek` matched
  `uploaded_by` (a `profiles.id`) against `user_id`, so the poster never showed; `UploadVideoModal`
  preselected a demo athlete ("marcus" / first player), which could send Mālo to the wrong kid —
  now it preselects only the uploader's own linked player. Fan cash share **not** built (owner +
  LEGAL decision). Tests: `useReelViewTracker`, `leaderboards`, new `reelCredit`, overlay credit.
  tsc clean, jest 140/140, `docs:check` ok.

- **2026-09-29** — Highlights Seki / Aura / Flex glitch. Root cause of the flicker and the
  "can't un-tap" feel: Home ranking (`rankHomeFeed`) and the Seki pill (`isSekiHighlight`) read hype
  counts and re-ran on every tap, so un-hyping moved the clip and slid another video under the
  finger. `app/(tabs)/index.tsx` now ranks only when the clip set / pill / context / pull-to-refresh
  changes and re-applies that order with `pinFeedOrder` (`data/highlights.ts`). `ReelCard`: a tap
  made before the clip's saved votes load is no longer overwritten when they land. `lib/reelVotes.ts`:
  AsyncStorage read-modify-writes queued per key (a quick Seki + Aura kept only one). Effects
  (`ReelActionOverlay`): only Aura keeps the burst + shout; Seki's 🤙 turns into a 🏈 for ~0.6 s;
  Flex just lights up; removing a vote never animates. Tests: `data/__tests__/highlights`,
  `lib/__tests__/reelVotes`, `Reels/__tests__/ReelActionOverlay`.

- **2026-09-29** — Payout gate, school crest, Aura flip fix. (1) Migration
  `20260929130000_payout_gate_without_school.sql` (not applied): `athlete_payout_status` (school →
  no cap; else one undisputed claim + guardian/claimant Stripe `payouts_enabled` → $250 cap until
  3 vouches), `athlete_vouches`, `get_teammates_to_vouch`, `vouch_for_teammate`,
  `get_my_payout_status`; `athlete_payout_allowed` now granted to anon; `athlete_is_varsity_verified`
  = school confirmed only. Client `lib/payoutGate.ts`, `Verification/TeammateVouchCard` on Activity,
  `AthleteVerificationCard` shows unlocked/cap/setup states, held copy changed (LEGAL row M).
  (2) Migration `20260929140000_school_badge.sql` (not applied): `schools_and_teams.logo_url` /
  `color_primary` / `color_secondary`, `admin_set_school_branding`, `athlete_school_badge`, names
  can't contain ✓. Client `lib/schoolBadge.ts`, `useSchoolBadge`, `Verification/SchoolCrest`
  (crest + proof sheet + hero band) in `ProfileHeroAvatar` and `AuraTradingCard`; Edit Profile
  blocks ✓ in names. (3) Aura card flip: the Modal had no `GestureHandlerRootView` (taps never
  reached the card), the "flip" chip sat on the tier badge, and a spin lock only released on the
  spring's finish callback so an interrupted flip froze the card. Now an Identity / Season stats
  toggle under the card, retargetable flip, pill "Flip Aura card" button. Design §9–§10.

- **2026-09-29** — Growth pass (owner: slow sign-up loses users; verification must not hinder
  growth). `SoftWallModal`: Apple / Google now sit above the email form (divider "or use email");
  the age checkbox still gates only the email paths. `RoleSwitcherModal` athlete claim: only team +
  sport are required; roster number, position and graduation class are optional (saved as `null`
  when blank in `lib/teams.ts` / `AuthContext`). Proposal (not built, needs owner OK because it
  changes a money rule): school confirmation becomes an optional badge and payouts gate on guardian
  Stripe KYC + no dispute + a cap — `ATHLETE_VERIFICATION_DESIGN.md` §9. tsc clean, jest 110/110.
- **2026-09-29** — Athlete verification ladder (owner decisions: gifts **held** until verified and
  the athlete sees that in the app; the school's athletic director or coach confirms each student
  **in person**). First real migration:
  `supabase/migrations/20260929120000_athlete_verification_ladder.sql` (+ `README.md`; copied onto
  `schema.sql`). **Not applied, never parsed by Postgres.** SQL: `verification_requests` gains
  sport / class year / jersey / hashed 6-digit meet code / confirmer / decision; new
  `school_confirmers` (per-staff link token, stored hashed); trigger `guard_profiles_verification`
  makes `is_verified` / `verification_status` / `player_id` server-only; `claim_athlete`,
  `start_school_check`, `get_my_verification`, `get_school_confirmation_queue`,
  `school_confirm_athlete` (anon; token + live code + signature), `admin_add_school_confirmer`,
  `admin_revoke_school_confirmer`, `admin_decide_verification`, `admin_revoke_verification`,
  `athlete_payout_allowed`. `redeem_team_code` now returns **pending**. `athlete_is_varsity_verified`,
  `can_confirm_player_tag`, `confirm_reel_player_tag` lose their name matching. A data step sends
  accounts verified only by team code back to pending and unlinks unverified `player_id`s.
  Client: `lib/verification.ts` (`claimAthlete`, `fetchMyVerification`, `startSchoolCheck`,
  `fetchPlayerVerified`; direct-write fallback removed; a name match can no longer show "verified"
  or borrow an avatar), new `lib/schoolConfirm.ts`, `useMyVerification`,
  `components/Verification/AthleteVerificationCard` (Activity, above the money card) and
  `SchoolConfirmRow`, route `app/school-confirm.tsx` (`alasports://school-confirm?t=…`), tip sheet
  "held" notice, `lib/teams.ts` → `claim_athlete`, `adminCatalog.setVerificationStatus` →
  `admin_decide_verification` (no more name stamping). `supabase/legacy/athlete_verification.sql` and
  `spotlight_auto.sql` marked superseded — do not re-run them after the migration. Tests: 3 new
  suites (110 total pass), tsc clean, `docs:check` ok.
- **2026-09-29** — Custodial money rules (owner decision; `PARENT_PAYEE_CONNECT_DESIGN.md` §7).
  New `supabase/legacy/custodial_money.sql` (also appended to `schema.sql`): `custodial_accounts` (one per
  athlete, so a guardian's account holds only that athlete's money; `bank_in_athlete_name`;
  `handover_age` 18–21), `athlete_birthdates` (guardian enters once at setup; admin corrects),
  `custodial_withdrawals`, and RPCs `guardian_setup_custodial`, `request_custodial_withdrawal`,
  `decide_custodial_withdrawal`, `cancel_custodial_withdrawal`, `get_custodial_summary`,
  `admin_set_custodial_terms`. A guardian withdrawal waits on the athlete's approval; from the
  handover date (birth date + age, computed on every call) only the athlete can withdraw. The
  athlete side requires `verification_status = 'verified'` because of the self-link hole in §5.
  Client: `lib/custodial.ts`, `useCustodial`, `components/Custodial/` — `AthleteMoneyCard` at the
  top of Activity (who holds the money, until when, approve / decline), `GuardianCustodialCard` per
  linked athlete in Parent HQ (birth date, bank-in-athlete's-name question, request, handover).
  Parent HQ now lists only athletes whose `guardian_id` is the caller, and the misleading "Set up
  Stripe custodial payout" button (a hardcoded $25 `requestPayout`) is gone. **Records only — no
  money moves;** payouts stay 503. Cards hide themselves until the SQL is applied. Tests:
  `custodial.test.ts`, `Custodial/__tests__/AthleteMoneyCard.test.tsx`. Copy needs LEGAL review.
- **2026-09-29** — M1 leaderboards (Release Wave 0). `supabase/legacy/leaderboards.sql` (appended to
  `schema.sql`): `reels.view_count`, `reel_views` daily throttle, `record_reel_view`,
  `get_leaderboards` (hype / views / Highlights / schools / fans — no money fields). Client:
  `lib/leaderboards.ts`, `useLeaderboards`, `useReelViewTracker` (Home, 2 s on screen, signed-in
  only), `Spotlight/LeaderboardsBoard` behind new flag `layouts.leaderboards` (default on; hides
  itself until the SQL is applied). Coverage map entry added. Tests: `leaderboards.test.ts`,
  `useReelViewTracker.test.tsx`. SQL not parsed or applied — no Postgres on this Mac.
- **2026-09-29** — Apple Pay / Google Pay in the PaymentSheet (Wave 0). `lib/walletPay.ts`
  (merchant ID `merchant.com.alasports.tapuai`; Google Pay test mode unless the key is `pk_live_`),
  `StripeProvider merchantIdentifier`, `app.json` Stripe plugin `enableGooglePay`. Needs a new dev
  build, not Expo Go. Apple Pay also needs the merchant ID registered with Apple and a Stripe Apple
  Pay certificate (owner). Test: `walletPay.test.ts`.

- **2026-09-29** — Tester-build prep. Installed builds could not check out: `stripeIntent.ts`
  fetched the relative `/api/create-payment-intent`, which only Metro answers, and no Expo server
  is hosted (EAS Hosting is blocked by the web-bundling break in §5). Checkout now calls Edge
  Function `create-payment-intent` first (already at parity with the Metro route, Round 10) and
  falls back to Metro only when it is not deployed — same pattern as Connect, shared via
  `lib/edgeFunction.ts`. New `lib/apiUrl.ts` prefixes `EXPO_PUBLIC_API_ORIGIN` for the Metro
  fallbacks and payouts, and a release build with no origin now throws a readable error instead
  of a JSON parse failure. Tests: `apiUrl.test.ts`, `stripeIntent.test.ts`. Admin-portal
  `.env.example` said `where id =` for the admin grant (the Round 21 bug); now `where user_id =`.
  New `docs/engineering/STAGING_RUNBOOK.md`. **Not verified on a device**; the Edge Function is not yet
  deployed on any project. Preview builds only get keys from EAS env (`.env.local` is gitignored).
- **2026-09-29** — Pre-merge review fixes. `ReelCard`'s memo comparator skipped function props,
  so a card could keep a stale `onTip` whose `requireAuth` still saw auth `loading` (Tip was a
  no-op on the first clip after cold start); a thin exported wrapper now passes identity-stable
  callbacks and the comparator checks them. Activity filters pending tags to the viewer's own
  `player_id` (admins were seeing every tag as "tagged you") and shows a Retry state on load
  failure (`useReceivedMalo` / `useFanTipHistory` now return `error`). `tabs.local` enforced
  again (Home pill + `RuntimePaused` on `/local`); `tabs.activity` added to the shared flag
  catalog and coverage map; `firstEnabledFanHref` falls back to Activity, not Local. Chip burst
  no longer plays on un-vote. Hype counts that land mid-flight are adopted once it settles.
  `state-doc-guard.sh` ignores mode-bit-only changes. **Not verified on a device** — tests and
  typecheck only. Guard still checks the whole working tree, not just this session.


Final phone review also caught and fixed Lab editor/feedback overlap. Column editors
now keep their natural height; desktop keeps equal columns. The direct geometry
regression and full gate pass. Evidence: ADMIN_DATA_CONSOLIDATION / MAIN_ADMIN_PORTAL
and `.smoke/main-admin/consolidate-lab-layout-final.json`.


Final local total: **60 responsive/geometry checks** (56 broad reads + four Lab
sibling-geometry checks), **19 interactions**, and **32 stable reviewed source hashes**.
Ordinary sample Home is restored with its heading at y=162 and no test iframe. Aggregate
evidence: `.smoke/main-admin/consolidate-acceptance.json`; reviewed captures are in
MAIN_ADMIN_PORTAL. This acceptance covers local source and fixtures.

## 2026-10-13 — Engineering Support main-admin tool (DETECT-02)

Added the Issues/Team flow/Change history/Recovery desk, actual generated source ownership,
protected false-positive review, restricted server-attributed signals, atomic selected-source audit,
cybersecurity role and dependency-locked source capsules with verified isolated restores.
Local implementation and review; hosted migration/application and release switching remain gated.

App/runtime observation, feature containment, one safe Highlights read retry and distinct donation
failure/cancellation reporting are wired after the admin-ready checkpoint. The local gate passes
115 suites /827 tests and Next 86/86; SQL replay passes 144/144. Activation remains pending.
