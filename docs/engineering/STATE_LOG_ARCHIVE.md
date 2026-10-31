<!-- Historical STATE §0 running log. Do not treat as current hand-off. -->
# STATE log archive

Moved from `docs/STATE.md` §0 on **2026-10-28** so §0 can stay one page for outside reviewers.
Current hand-off: [`docs/STATE.md`](../STATE.md) §0. Known broken / owner decisions remain in STATE §5 / §6.

Nothing below was deleted; it is reference history only. Newest dated instruction in live STATE wins on conflict.

---

## Archived preamble (Last-updated chains + dated banners)

<!-- Current local implementation and observed readiness; hosted activation requires original evidence. -->
# STATE — read this first

**Last updated:** 2026-10-23 · Soft-Wall: Vault unlock on Highlights gated (`kind: 'exclusive'`); `useTipCheckout` / `useAthleteSubscription.grant` read live session after Soft-Wall resume so `tips.fan_id`, payer Aura and the exclusive pass still write (§4). Device smoke and gift counsel/hosted gates remain open. Previous update: 2026-10-23 · Exit inventory ignores local `expo-env.d.ts` / `coverage` so CI `security:infra` matches developer machines; security report path assertion follows `docs/engineering/exit/`. No hosted restore or cutover (§4). Previous update: 2026-10-23 · Exit reading home is `docs/engineering/exit/` (index `README.md`); generators write the map and security report there; runnable `infrastructure/*` did not move; hierarchy, TEAMS, and AGENTS updated. Previous update: 2026-10-22 · Workstream 4: coach-level `20261017090000` reviewed, fixed (every Highlight report would have failed; labelled uploads refused) and applied to development; replay 17/17; staging waits for Beyond. Account tags: staging catch-up + blocked-tag fix `20261022150000` replayed 14/14, hosted apply waiting on owner (§4, §5). · METRO-01 narrow SDK58 streaming-request cancellation repair; exact http.js:105 reproduction/11 regressions, independent source review and full check266suites/2576tests pass; fresh Metro Home200. Old Metro processes need restart. Previous update: 2026-10-22 · Claude entry point refreshed with current reading paths and publication evidence rules; see §4. Whole-team gift release handoff and hosted/provider/counsel gaps remain in COORD-02.

**Last updated:** 2026-10-22 · MONEY-TIPS-01 no-cut gifts and gated checkout wording on codex/tip-model; independent source/admin/app review and full local check/detection scan PASS (266 suites/2576 tests, portal117); hosted/provider/counsel release gates open. Previous update: 2026-10-22 · Gift-language sweep outside checkout; exact tax notices and counsel/store drafts; separate no-cut tip model requested, checkout held (see §4). Previous update: 2026-10-22 · Workstream 3: VERIFY-02 wired: `create-stripe-account` records Stripe's own identity/TIN answer through `record_stripe_kyc` (v1 view of the account; nothing recorded until Stripe answers); `20261022140000` makes a repeated answer a no-op; replay 8/8; migration applied to development and staging, Edge Function not redeployed (§4, §5). · IP-01 evolving IP counsel plan/register/packet and safe automatic source refresh implemented locally; focused IP8/8 + Recovery15/15 and doc/registry/currency PASS; full local check and retained detection scan PASS (2026-10-22T14:31:55Z), portal106/106 and private source refresh PASS; rights/counsel/filings remain open (§4). · 2026-10-22 · Workstream 2: four internal-testing holes closed on staging + development (public-bucket listing, anon policy branch, open profile UPDATE, guest vote/hype stuffing), each with a replay and a hosted wrong-actor check (§4, §5). · Workstream 1 staging parity: 12 development migrations applied to staging in dev order (guest revenue/Aura writes now 42501), Rallies guest-read fix on both, orphan RLS-off tables closed on development (`20261022090000`, replay 7/7) (§4, §5). · 2026-10-21 America/Denver · UX-10 sporty fan theme: compact panels/type across all seven destinations, vibrant sport icons/accents and full-height Highlights video behind the measured floating dock; independent source review and full local check/detection scan PASS; native/configured Drip checks pending (§4). · MULTISPORT-01 security-review fixes (unapplied migration): catalog school fixes the team name; athlete sports read is athlete-only for the public and hides the edit revision; replay 61/61 (§4). · Screen-test gaps closed: sign-in hold-and-resume (new SoftWallContext tests), held-donation notice, failed sign-in; QR subtitle no longer promises an instant, app-free donation; variable-bucket upload calls reviewed bounded (§4). · MULTISPORT-01 and UX-09 implemented locally: manual primary/multiple sports, independent credentials/stats/media tags, compact labeled Local and visible floating dock; independent source review ACCEPT, final full check/detection scan PASS; SQL unapplied/native checks pending (§4). · UX-08 app-wide: field lines on every tab/role-home heading, Beyond, empty states and all profile heroes; scoreboard digits and jersey patches across the app · **Athlete profiles load again**: `lib/reels.ts` no longer embeds `players` on `reels_feed` (tag-privacy CASE column sent PostgREST through the locked `reel_tag_rejections` junction → 42501) (§4). · UX-08 sport field lines and scoreboard digits (athlete hero, QR donate page, Spotlight featured card, Local game cards) plus the swipe-hint overlap fix; independent review ACCEPT WITH FIXES, all seven fixed (incl. QR page now honours hidden school); found: athlete profiles fail on development (`reels_feed` players embed 42501) and fresh web loads of tab routes land on Home (§4). · LOCAL-02 game venue school/address/arrival notes and Apple/Google directions implemented locally after admin-ready; PostgreSQL replay68/68, focused admin/fan regressions and final full pnpm check/detection scan pass; migration unapplied, physical map launch unverified ([tracker](../agents/LOCAL-02.md)). · Share & Donate QR build-out: Donate on the `/gift/[handle]` landing (QR-tagged), not-found/retry states, Parent HQ share per athlete, athlete-id links when there is no username, `EXPO_PUBLIC_WEB_ORIGIN`; the QR origin tapuai.app is still not hosted (§4). · R4-03 splits: AdminChrome 1,033→239, `lib/admin.ts` 1,005→629, `adminCatalog.ts` 982→756, operator `[gameId]` 901→704; round 2 `AthleteProfileView` 1,104→719, Home route 990→782, shared `analytics.ts` 1,020→718; round 3 `ReelCard.tsx` 1,119→845, Local 900→657 — no source file over 900 lines remains; behaviour-free (§4). · Batch committed as `6a3f0bf`. · Full `pnpm check` run after NOTIFY-01: typecheck and 233 suites / 2,287 tests PASS; three stale gates repaired (infra register counts regenerated, exit plan announced twice, reviewed `test-server.env.example` allowed in source packages); whole chain now exits 0; exit scanner now sees media-adapter bucket calls (§4). · NOTIFY-01 local Profile notification settings, Activity inbox, staff controls and server contracts implemented:233 suites/2,287 tests and both app/shared typechecks PASS; optional email paused, SQL25 plus1 concurrency cases prepared/0 executed, payment authority false (§4). · APP-TEST-01 execution: three anonymous local money routes independently return401; Connect SQL replay exits2 with no engine/zero cases; owner confirms Google setup pending; callback Router-history cleanup repaired and browser-verified; final226suites/2,196tests and both app typechecks PASS (§4). · Roadmap/team refresh: current app testing lanes,115roles/17departments and aligned next-owner duties (§4). · Current app testing: explicit picker duration units and service revalidation; offline synthetic media fixtures; 226 suites / 2,193 tests and both app typechecks PASS. Google setup guide prepared; development Google disabled, local bank service key missing (§4). · Media transport/readers implemented locally: replaceable upload/sign/list/remove, public references/legacy playback and private Vault isolation; 225 suites / 2,154 tests, both app typechecks and scoped guards PASS; independent Security accepted; long videos off until costs are measured and live deferred (§4). · Account-to-bank local preparation reviewed: guardian per-athlete setup and confirmed current client Terms; final 223 suites / 2,103 tests, both app typechecks and 12 scoped checks PASS; SQL/provider execution remains unverified (§4). · Google account creation and callback reliability repaired locally; 217 suites / 1,986 tests, both app typechecks and scoped checks PASS; independent source and documentation reviews accepted (§4). · Connect client and shared profile freshness repaired locally: owner-bound status, guarded async work, early single-flight lock and memory-only auth lifetime guard; 215 suites / 1,947 tests, both app typechecks and scoped guards PASS (§4). · Web first-tab compilation repair: supported Expo Router development sync imports; production web splitting and lazy screen mounting retained; local import-mode/typecheck/guard checks and scoped browser tab verification PASS (§4). · Connect persistence repaired locally: server-only conditional account saves before links; database failures visible, KYC evidence gap explicit; 213 suites / 1,899 mobile tests, both app typechecks and scoped guards PASS; source review accepted (§4). · Failed photo-story cleanup implemented locally: owner-only SQL (unapplied), fresh retries, durable owner/reel removal intent and committed-story recovery; 213 suites / 1,877 mobile tests, both app typechecks and scoped guards pass; independent source/docs reviews accepted (§4). · UX-07 story/tab presentation implemented: existing public Story section, clearer screen/empty hierarchy, wrapping controls/rows, 44-point targets and Reduce Motion; scoped source review and final full check passed (212 suites / 1,849 tests); current-component browser review has bounded native/hosted coverage, source refresh deferred on concurrent capture lock; evidence in [tracker](../agents/UX-07.md). · Funnel top: `trivia.view_prep`/`press_start` events + `prep_views_7d`/`start_presses_7d` RPC counts (migration written, not applied); 411 mobile + 106 portal tests pass. · Health surfacing (Step 3): `get_admin_reports` trivia + smoothness keys (migration written, not applied), portal Health tiles conditional, 106/106 portal + 159 Expo report tests pass. · Smoothness signals (Step 2): `screen_mount` + `app_start` migration (written, not applied), `layouts.telemetrySmoothness` flag off, Home/quiz/donate mounts + cold start wired. · Trivia funnel + error telemetry (behavior-logging Step 1): start/answer/next/complete/abandon/unavailable as `feature_tap` + `ui_issue`, zero SQL; 29 suites / 380 tests pass; Health surfacing is Step 3. · REDUNDANCY-07 report cleanup: readable helpers and accurate per-guard missing-prerequisite statuses;22 local Security tests pass, concurrent screen-mount test scheduling repaired with targeted3PASS/both-app typecheckPASS; full project checks210suites/1825tests passed; exact latest-source verification deferred per owner while concurrent work continues (tracker receipts). · REDUNDANCY-07 Security expanded to six specialists under SECURITY -> CTO; local registered-source security report/routing plus SSH-range, Compose environment and Docker credential-context source repairs. Actual scoped/current final evidence in [tracker](../agents/REDUNDANCY-07.md); hosted security remains unverified. · REDUNDANCY-06 shared portable client connection, matching target profiles and local installed-SDK protocol tests; original verification custody in [tracker](../agents/REDUNDANCY-06.md). · REDUNDANCY-05 private setup and source-bound backup/read-only health implemented; current execution receipts in [tracker](../agents/REDUNDANCY-05.md); live backup config incomplete. · Guest Rally reads fixed locally (`20261020090000`, not applied). · REDUNDANCY-04 current-source automatic watcher/CI implementation; actual activation/check receipts in [tracker](../agents/REDUNDANCY-04.md) · REDUNDANCY-03 exact source release, content-aware exit inventory, runtime image archives, historical Storage owner reconciliation and strict180-minute warm-cutover evidence checks implemented locally; no hosted readiness claim. · Redundancy & Exit team (REDUNDANCY-02): five agents, a generated exit infrastructure map that updates with every app change (Stop hook + `pnpm exit:map:check`), and routed change notices from `EXIT_SYNC`. · REDUNDANCY-01 database migration checks (`infrastructure/migration/`): restore-list proposal, source/target parity and privilege reconciliation; real pg_dump/pg_restore/psql 18.6 drill 12/12 found that a restore onto a Supabase stack reopens 2,059 revoked anon/authenticated rights. · REDUNDANCY-01 continuation: complete offsite backup jobs, guarded retries, snapshot-age health checks and protected-checksum retrieval built locally; service not activated. · Full check green again after the SDK 58 upgrade (205 suites / 1,805 tests): 18 Jest suites had been failing since 2026-10-16 (icon fonts, stale mocks, the poster neighbor); the trivia demo can no longer award Aura. Five hooks moved their database calls into `lib/` (48 → 39). · 2026-10-18 · SCALE-01 admin two-step sign-in (TOTP, `aal2`) built locally for the portal and Expo `/admin`, switch off; MFA not enabled on any hosted project. · SCALE-03 live scores over per-game Broadcast built locally behind a default-off switch; migration written, not applied. · Environments page records the testing app: development catch-up is on, staging was not moved, production and a cache server are not created. The video ladder stays Mux, Bunny, or Cloudflare Stream, none selected. · Home pages uploaded Highlights once a clip has a file. Empty sample cards stay only while nothing uploaded can play. · Home keeps one decoded Highlight. A mounted neighbor is a poster. Uploads stop at 8 MB. Profile stats and the trivia notice wait until that part is open. The trivia database was not changed. · 2026-10-17 · Workout challenges moved from the profile scroll into Account settings. · Fan Zone and Beyond are on development. The extra storage indexes were skipped because postgres cannot own `storage.objects`; the write guards are triggers. Coach-level SQL stays unapplied. Home highlights share one surviving video. · Health lists syntax, logic, and glitches · Search filters stay one quoted value · Highlights profiles and Local stay open; trivia awards 5 Aura and can include an IQ question · Missing database updates stay on admin Home and portal Health, off the fan screen · Coach-level and Rally share handoff recorded (HIGHLIGHTS → ENGINEERING → CTO; docs synced; counsel and SQL still open) · Coach-level workout label and Rally / board share cards are local (SQL written, not applied; counsel still open) · Trivia names this week’s subject and sends one fact to dinner · Trivia teaches history, trades, and practice fuel · Highlight trivia invites a play · Trivia and Fan Zone keep the fan bar pinned · Trivia results sit on one phone screen · Trivia and Fan Zone play fit a phone width · Highlights trivia is a bright side notice; Fan Zone lives on Beyond · Live-match plays celebrate with Seki, Aura and Flex first; Donate opens the donation · Combined-branch check is green (196 suites / 1,744 tests) · Combined-branch Jest repair: fun-fact activity wording, operator live-game mock, one payout-flag catalog row, and Fan Zone windows that stay open on the clock · Fan Zone and trivia merged onto main (`de2d70d`); mobile typecheck repaired after the merge · PLAY-01 locally verified and closed (tag chip wired, claim released; browser/device/hosted/clean-install stay owner-gated) · Docs pass for Beyond follow-up: development catch-up runbook (not run), SAFETY-01 Coach-level label enrolled as planned, Beyond phrase test (Seki Set / Extra Rep / OT / Two-a-Day), legal row AC, tester steps; owner chose to commit everything now. · Beyond moved to the Highlights pill row (owner): Beyond switch plays workout/service Highlights, Beyond page keeps fan posts, Upload ＋ asks Highlight or Beyond moment while contributions are on; bottom bar Home · Activity · ＋ · Spotlight · Profile; `pnpm check` 150 suites / 1,197 tests. · Whole-team updates applied:107 role handoffs across17 department labels, current roadmap and generated Team flow reconciled. Full detection scan passes148 mobile suites/1,188 tests plus86 portal tests; independent prepared-source/Documentation reviews accepted. The owner approved keeping the Stripe-only Finance Operations §7 clarification; team records and final local checks are complete, with claims released in [TEAM_STATUS](../agents/TEAM_STATUS.md); hosted/legal/device gates remain separate. · Calm Island colour refresh (owner chose direction A from the Figma comparison): one deep-jade brand colour, warm sand-white canvas, gold for awards, red for LIVE; unified chips, no page corner decoration, guest-hidden refresh buttons; `pnpm check` 148 suites / 1,188 tests; the published runtime theme still overrides five colours until Look → Daylight is republished. · UX-06 local first polish pass complete: compact Beyond categories, grouped consent composer, token-based workout controls and factual admin publication fallback. Full detection scan passes 148 mobile suites / 1,188 tests + 86 portal tests; visible category switches and 320/390 layout fit checked. Independent source/Documentation reviews and selected app-ready gate pass; claims released. Configured-state/native/accessibility and broader app/Figma polish remain open in [UX-06](../agents/UX-06.md). · BEYOND-01 local implementation complete: dedicated tab, four categories, reviewed fan video/JPEG contributions and Drip Profile entry; CHAL-01a preset responses/friend invites/private badge/settings/export. Preserved admin-first checkpoints; independent source/Data/SUPPORT reviews and full detection scan pass148mobile suites/1,188tests +86portaltests. Both selected app-ready gates and independent Documentation/VP handoff pass; scoped claims released in [BEYOND-01](../agents/BEYOND-01.md); migrations unapplied, server contribution/challenge switches off, hosted/device/Utah legal release pending. · PORT-01 follow-through: media references (expand, writer off), one shared money core for Node + Edge with a local JWKS token check (SECURITY approved), generated database types + drift test, exit drill runbook; `pnpm check` 135 suites / 1,076 tests · Infrastructure awareness (INFRA-01): new `INFRASTRUCTURE` agent (Engineering) is the scalability team's standing dev member; generated `INFRASTRUCTURE_REGISTER.md` + `pnpm infra:register:check` (CI) keep it aware of every hosting / service / integration change; direct Supabase calls moved into `lib/` (routes 16 → 0, rest 78 → 48); `pnpm check` 132 suites / 925 tests, 107 roles · Portability (PORT-01): owner accepts the hosting recommendation (stay on managed Supabase, self-hosted Supabase as the drilled exit); single source `docs/engineering/PORTABILITY.md`; boundary guard widened to the whole app and admin portal (78 + 16 direct Supabase uses recorded, may only shrink); `lib/media.ts` provider-neutral media refs · Payee verification (VERIFY-02): owner decided SSNs go to Stripe only (never stored), guardians need Stripe identity + the school's parent confirmation (two admins), Stripe Identity only for disputes, payout flags only by two admins with a reason; fourth migration written (not applied); replay 111/111; `pnpm check` 129 suites / 914 tests incl. new `security:no-ssn` · Minor accounts (MINOR-01): birth month and year replace the 13+ checkbox, teen-safe defaults, guardian link from a teen's code with teen confirmation, signed draft consent (public profile / payouts from the guardian on record), supervision and under-16 approvals, under-13 closure; replaces the PRIV-01 guardian lock; third migration written (not applied); schema replay 100/100; PRIV-01 and MINOR-01 app-ready; `pnpm check` 126 suites / 905 tests · Profile privacy (PRIV-01): public/private accounts, per-item audiences, two-way friends, blocking, hide from search, tag approval · Actual video scalability reviews recommend Mux as the provisional first technical experiment, with Bunny/Cloudflare in the initial equivalent quote/capability comparison; no selected provider or verified dollar winner. Documentation accepted; earlier recorded local gate passed 118 suites/867 tests, 186 docs and 106 roles. Owner-reported AI spending and separate infrastructure ceiling remain in Finance §6.1; actual video rates/usage/capacity and cash runway unknown. SCALE-02/admin-first integration, hosted/device/access/deletion/recovery and release remain pending. Next Growth review October 20; no new spending/hosted change/scheduler. Receipts: §4 and [video review](./HOSTING_DECISION_BRIEF.md#11-video-scalability-team-review--2026-10-13). · Verification/consent/safe-growth source review and joint checkpoint established; proposed owner decisions and actual review/check receipts in GROWTH-01. Earlier safe-growth review checks failed on 28 MINOR type diagnostics and schema-doc drift; the newer user-growth run passes after concurrent integration. Fan/filmer follow-up: per-user growth plans and charter §10 added; mitigation proposals and current checks in GROWTH-01. Latest user-growth local check: exit 0, 126 suites/905 tests,191 doc destinations,106 roles; no hosted/counsel/financial release evidence from this pass.

**Current fun follow-up:** the owner clarified fan-video Game/Week/Month/Year recognition,
awesome-fan badges and optional service with separate badge/Aura and money paths, then asked
to continue brainstorming. [FAMILY_FUN_PLAYBOOK](../product/FAMILY_FUN_PLAYBOOK.md) and Growth
charter §11 contain proposals and existing capability gaps. Actual review/coordination/check
evidence belongs in GROWTH-01; no generic fan award/voting/badge, service program or paid earning model is built by those proposals. The local CHAL private self-report badge and Beyond contributions are separate, later capabilities.
**Last updated:** 2026-10-15 · Life Playbook and personal progress (QUIZ-04): three separate weekly rounds (personal / group / life), levels that never drop, opt-in Life Playbook simplified by the owner to simple fun facts (four 13+ chapters, one-admin approval, automatic copy rules); admin-ready then app-ready; `pnpm check` 166 suites / 1,372 tests; migrations `20261014180000` / `20261014190000` written, not applied · Trivia, play together (QUIZ-03): weekly rounds of five, true / false, Learn your athlete's sport, family challenge groups under MINOR-01 teen rules, badge shelf and season recap, 60-question draft bank; admin-ready then app-ready; SQL review approved; `pnpm check` 156 suites / 1,286 tests; migrations `20261014160000` / `20261014170000` written, not applied · 2026-10-14 · Timed trivia source53a6104 passes final independent review; FINAL-I1 is addressed. Root full check passes150 suites/1,219 tests and all guards. Selected local QUIZ-02 app-ready passes at recorded date18:23:47Z, after admin16:53:17Z. Actual final Documentation/VP continuation PASS; local handoff complete. Pilots remain paused/empty; no hosted SQL, spending, merge or push.

**Prior Fan Zone / untimed Sport Quiz implementation (historical full-check evidence; current QUIZ-02 full check passes150suites/1,219tests):** owner approved the family-fun build and added optional weekly quizzes. Actual Fan admin checkpoint is 2026-10-14T13:42:36Z; Quiz is 2026-10-14T06:09:57Z. Fan participant `bcb898c` plus `070a58b` independently passes scoped review (35 focused checks), as does private video `a4f4acd` (13). Shared integration `8179b7b` includes Home, four HQs, profile and real control-map/stop paths; current guardian recovery survives participation dismissal. Independent shared consumer acceptance passes at 8179b7b; full pnpm check passes 148 suites/1,146 assertions and all guards; independent whole-branch and selected local Fan app-ready pass; actual Documentation/VP scope reviews pass and final status continuation is retained. Per-user growth and joint Legal/Dev/capacity plans retain the October 20 packet. No live measures or launch readiness are inferred.

**Earlier fun refinement (before implementation):** the owner clarified fan-video Game/Week/Month/Year recognition,
awesome-fan badges and optional service with separate badge/Aura and money paths, then asked
to continue brainstorming. [FAMILY_FUN_PLAYBOOK](../product/FAMILY_FUN_PLAYBOOK.md) and Growth
charter §11 contain proposals and existing capability gaps. Actual review/coordination/check
evidence belongs in GROWTH-01; no new activity, award, badge, service or earning behavior is built.
Fresh family-fun local `pnpm check` passed:126 mobile suites/905 tests,195 Markdown destinations,
106 roles and4 registered features. Counts include concurrent shared work; no hosted/counsel/
financial release follows from this check.
The newer perfecting pass adds playbook §12: one weekly Fan Zone journey, private entry/status,
acknowledgment versus award, selection alternatives and accessible optional service/support.
The owner selected **fan voting chooses the winner**. Staff review eligibility/rights/safety;
valid free ballots select the award. Proposed ballot windows, revisions, tie/correction,
candidate permission and abuse rules are in §12; current counters do not implement them.
Its review/check results are recorded separately in GROWTH-01; no new behavior is implemented.
Latest refinement local `pnpm check` passed:126 mobile suites/905 tests,196 Markdown
destinations,106 roles and4 registered features. Proposed ballots and activities remain unbuilt.

This is the living state of `ala-sports` (Tapua'i Sports). Every other document describes how
things *should* work; this one describes **where the project actually is right now** — what
just changed, what is knowingly broken, and what will bite you in the first ten minutes.

If you are an AI agent or a new engineer: read this file, then [AGENTS.md](../../AGENTS.md) for
folder law. Do not skip to the code.

---

---

## Archived §0 — Pick up here (as of move)

## 0. Pick up here (current hand-off 2026-10-22; historical setup below)

**Current development repair:** [METRO-01](./evidence/METRO-01.md) fixes
SDK58's disconnected pre-shell streaming request reaching Metro error handling. Local
main contains the versioned Router Server patch; restart old Metro terminals to load it.
Gift-release/provider/counsel gates below remain their own workstreams.

**Current gift-release handoff.** Branch `codex/tip-model`, source base `4c54606`.
[COORD-02](../agents/COORD-02.md) joins the115-role/17-department duties, source/copy evidence,
[counsel packet](../legal/GIFT_RELEASE_COUNSEL_PACKET.md), [guardian draft](../legal/GIFT_GUARDIAN_CONSENT_DRAFT.md)
and [rollout runbook](./GIFT_TIP_ROLLOUT.md). Athlete/family support is Gift/Give;
program support Donation; optional Tapua'i support Tip. New local-source gifts have no platform
cut with extras OFF or ON. Older mission/Donate/90/10 instructions below are superseded history.
Fresh Supabase catalog reads find both test projects missing notification payment contexts and
tip authority; checkout alone must not be deployed. Stripe reauthentication, actual fees/net
settlement, signed consent, gift-linked Aura and counsel/store decisions remain open.
No role-definition update establishes specialist execution, delivery or release approval.

### Historical setup and coordination receipts

**Historical whole-team handoff (2026-10-16).** Read [TEAM_STATUS](../agents/TEAM_STATUS.md) for all107 role
assignments, seventeen department updates, requested job-function coverage, current gaps
and next owners; [COORD-01](../agents/COORD-01.md) records actual review/check execution. Beyond,
CHAL-01a and the first UI polish are locally accepted; newer Calm Island source changes have
their own dated evidence and stored runtime-theme follow-through. Utah is first, with national
planning in parallel and further activation under state/domain/release reviews. Generic fan
awards/voting/trivia remain proposals. The earlier admin exports/date/Product worktree remains
unintegrated; finance exports already in MAIN are separate. The retained local coordination checks pass. The owner approved retaining the Stripe-only
Finance Operations §7 paragraph and finalizing the team records. Final local checks passed and
scoped coordination claims are released; next-owner gates remain in WORK_QUEUE.

**Established branch hand-off.** Branch `wave0-custodial-verification` is at
`4b7a729cafe67b2f7d316b3ebb3663ecbfb7c6e1` with shared, uncommitted local work.
Admin consolidation, Finance & Books, data closures and Engineering Support are implemented
locally; innovation/handoff standards are documented. Actual Documentation and team-coordination
passes completed in [COORD-01](../agents/COORD-01.md), with check results, released claims and next
owners. [HEALTH-01](../agents/HEALTH-01.md) evaluated 62 current task IDs, repaired the existing logger/QA
desk and passed the current local scan and frozen SQL verification. Hosted SQL/delivery, durable
crash intake, database-backup/compatibility, devices,
counsel and owner release gates remain explicit in the task records and §§5–6.
[GROWTH-01](../agents/GROWTH-01.md) now assigns one Growth and Capacity Review packet and
provider-selection baseline; current live measures and source/target definitions remain open.
Its video follow-up completed media/reliability and cost/operations review plus independent
Documentation acceptance; all-three quotes and SCALE-02 implementation remain pending.

**Historical code checkpoint (2026-10-07).** Branch `wave0-custodial-verification` was at `fd6b0b1` before this
verification pass, with Claude's organization and readiness work committed. It is 42 commits
ahead of cached `origin/main` (local tracking refs, no fetch). This pass adds local verification,
check scripts and documentation corrections in the working tree. No merge or push performed.

**Outside review.** Read this file, then `AGENTS.md`, `docs/engineering/CONVENTIONS.md`, `docs/engineering/ARCHITECTURE.md`,
`docs/engineering/SCHEMA.md`, `docs/product/ROADMAP.md` (Wave 0 is test mode), `docs/legal/LEGAL_BRIEFING.md`,
`docs/engineering/DATA_PRIVACY_MAP.md`, and `docs/product/VOICE.md`. `docs/product/PUBLIC.md` and `docs/company/INVESTOR.md` are not
the security packet. `docs/engineering/AUDIT_REPORT.md` older sections are history. Open on purpose, do not
treat as surprises: the app still writes `tips` after PaymentSheet (do not turn on `stripe-webhook`
crediting), payouts stay blocked and do not check the amount owed, Stripe is test mode, and the
development project now has the catch-up through trivia, IQ, Fan Zone, and Beyond. The coach-level file is still absent there. Staging was not changed by that apply.

**The mission — judge every change against it.** Make donations and highlights easy for families,
so they can promote their kid and hopefully get them recruited; kids encourage good workouts with
fans and serve like their favorite player; Tapua'i is the avenue that makes the donating possible.
It replaces GoFundMe for families. Full text: `docs/product/ROADMAP.md` North Star, `docs/product/STORY.md`
"The mission, in one breath". Money words: `docs/product/VOICE.md`.

**Applied to staging on 2026-09-30** (`ala-sports-staging`, `tucioqipfejqqqtuakdi`). Not applied
to the development project (`ulfapgtabidorgwfjvwz`). Staging was also missing `tip_origin.sql`
(donation channel tags); that ran first. Each file's header lists its rollback. Order used:

| # | File | Needs |
| --- | --- | --- |
| 1 | `supabase/legacy/clear_reel_hype.sql` | — (un-vote persists) |
| 2 | `supabase/legacy/custodial_money.sql` | — |
| 3 | `supabase/legacy/leaderboards.sql` | — |
| 4 | `supabase/migrations/20260929120000_athlete_verification_ladder.sql` | — (closes the self-verify holes in §5) |
| 5 | `supabase/migrations/20260929130000_payout_gate_without_school.sql` | 2, 4 |
| 6 | `supabase/migrations/20260929140000_school_badge.sql` | 4 |
| 7 | `supabase/migrations/20260929160000_reel_views_and_filmer_credit.sql` | 3 |
| 8 | `supabase/migrations/20260929170000_filmer_rewards.sql` | 7 |
| 9 | `supabase/migrations/20260929180000_rally_goals_thanks_platform_tip.sql` | 2, `company_revenue.sql`, `tip_origin.sql` |
| 10 | `supabase/migrations/20260929190000_telemetry_logs_bounds.sql` | — (independent; guest inserts stay; apply any time) |
| 11 | `supabase/migrations/20261002120000_operator_checkins_role_check.sql` | — (written 2026-10-02, **not applied anywhere**; the demo-PIN console keeps working because `anon` stays allowed) |

On staging, `company_revenue.sql` was already present and `tip_origin.sql` was not, so the channel
tags were applied before the table above. The development project was not touched. After a build
points at staging, run `docs/engineering/TESTER_SCRIPT.md`.

**Spend, every time.** Wave 0 (this test) costs Apple Developer **$99/yr** — already enrolled — and
Supabase, Expo, and Stripe test mode are free. Nothing comes in. SQL on staging is done ($0). Still **$0**: a
new preview build and a `4242` test donation, unless the free Expo build quota runs out or
a free Supabase project pauses (then Pro, about **$25/mo**). Wave 1 is later and is the first real
spend: LLC, counsel, an association letter, Google Play **$25**, Supabase Pro, video bandwidth, and
Stripe’s fees. Do not start those for this test. Full table: `docs/product/ROADMAP.md` release waves.

**Specialist execution:** [WORK_QUEUE.md](../agents/WORK_QUEUE.md) assigns the Wave 0 sequence,
acceptance criteria and dependent decisions. Use the registry and hierarchy to dispatch its
primary owner and required reviewer. Local code completion is separate from hosted/device evidence.

**Next up, in order.**
1. **New preview builds queued 2026-10-21 (commit `fb16f40`: sport theme, QR Donate, notifications, compact UX-09–11).**
   Android: https://expo.dev/accounts/logoitino/projects/ala-sports/builds/ca07b666-e187-43d3-af11-e89ba1b59193
   iOS (registered iPad only): https://expo.dev/accounts/logoitino/projects/ala-sports/builds/4f568cdb-d440-4e7a-acad-a72b554b23b3
   They use the preview EAS environment (staging), which lacks the 41 migrations in STAGING_DATABASE_CATCHUP, so features
   needing that SQL show as unavailable until it is applied. Older builds below.
   Previous: preview builds queued 2026-10-11 night with the local app, including the popup swipe and the upload black-screen fix. Android (any phone):
   https://expo.dev/accounts/logoitino/projects/ala-sports/builds/5cca4a55-cfc3-4c58-9346-34b9e0433b27
   iOS (registered iPad only — the iPhone is not on the profile yet):
   https://expo.dev/accounts/logoitino/projects/ala-sports/builds/c5255651-06e3-4f46-9861-5a47ad1b434a
   The evening builds `04244951` and `12d017d4` do not include that fix. The web admin portal is not in these builds.
   `create-payment-intent` and the test Stripe secret are on staging. Do not deploy
   `stripe-webhook`. Owner added redirect `alasports://auth/callback` on 2026-10-10. Google is still
   off on development and staging, so Continue with Google stays in the sign-in sheet until that
   provider is enabled. Email still creates the account. See STAGING_RUNBOOK §3. Upload buckets: `reels`, `avatars`, `game_highlights`. `reel_vault` is not
   on staging yet.
2. Owner + counsel: the open items in §6 — especially 8 (how money reaches families) and the App
   Store question in 9. They gate Wave 1 live money.
3. Engineering, no owner call needed: **done 2026-09-29** — the telemetry anon-insert hole in §5
   (shape-bounded, not identity-fixed; see §5). Rally meter on Highlights, the full-screen fill
   moment, and "Watch what it paid for" opening that clip also landed 2026-09-29 — see the
   STATE §4 archive at the end of `CHANGELOG.md`.
4. Do **not** build without an owner decision: a filmer cash tip jar (LEGAL row P), free-text
   thank-yous or any athlete ↔ fan messaging (LEGAL row S), a Rally tied to a play or stat,
   a fan digital signature on the Aura card (named for a later wave — see §6).
5. Account tags on a Highlight are in the app. SQL `20261002160000_reel_account_tags.sql` is on development
   (2026-10-17), not staging. Workstream 4 (2026-10-22) replayed the staging catch-up (that file, then privacy's
   search and the Closed accounts policy) to match development exactly, plus `20261022150000` (blocked accounts
   cannot be tagged): `account-tags-replay.mjs` 14/14. Hosted apply is waiting on the owner (§5). Until staging has
   it, the picker stays empty there and a publish still succeeds.
6. **Engineering readiness R1–R4** (owner, 2026-10-07: organise for outside engineers and a
   separate production environment). Plan and checklists: `docs/engineering/CODE_ORGANIZATION_PLAN.md`;
   tasks R1-01 … R4-03 in `docs/agents/WORK_QUEUE.md`. R1 is done locally. **Owner next:** approve
   merging this branch into `main`, pushing, and protecting `main` (R1-02), and pick a private home
   for `docs/legal/` and `docs/company/` (R1-03). Then R2 (rebuildable database) before R3 (production).
7. **Photo stories (UX-05, owner 2026-10-07).** Built locally per
   `docs/engineering/design/PHOTO_STORIES_DESIGN.md`; migration `20261007230000_photo_stories.sql` is
   **not applied anywhere**, so the Photos option stays hidden and the feed treats everything as video
   until it is. Before staging: RLS_SECURITY + STORAGE review of the migration, a Postgres replay, and the
   storage overwrite decision in §5. Then DEVICE_QA: photo orientation after metadata stripping, swipe vs
   feed gestures, memory with 10-photo stories, and whether the first Home clip now plays (ReelCard fix).
8. **Security fix — applied to staging 2026-10-22** (`20261013210000`, with `20261013220000` and the rest of the parity set; development since 2026-10-17). Guest calls to `record_company_revenue` / `add_user_aura` now fail with 42501 on both.
9. **Books for go-live (owner 2026-10-12: must be there at launch, especially bookkeeping).** Rehearse on staging during testing (WORK_QUEUE W0-10): apply `20261012210000_bookkeeping_ledger.sql`, close one test month, import into a QuickBooks sandbox. It is a live-money gate (ROADMAP Wave 1 checklist item 10, WORK_QUEUE P1-08).
10. **Environments (owner 2026-10-13).** Decide the nine items in [ENVIRONMENTS_AND_HOSTING.md](./ENVIRONMENTS_AND_HOSTING.md) §9 (stay on Supabase, Free vs Pro org for dev/staging, GitHub plan, bundle IDs, store accounts, region). Do not run `supabase db push` against staging before the E1 baseline and `migration repair`. The EAS production environment needs `EXPO_PUBLIC_APP_ENV=production` for OTA updates.
11. **MCP tooling.** Start Claude Code inside the repo, approve the project servers, then sign in to
   `canva`, `expo` and `supabase-dev` from `/mcp` (`docs/engineering/TOOLING.md`). Signed in 2026-10-15: `canva`, `figma`, `supabase-dev` (read-only, development); `expo` still needs sign-in. Playwright MCP cannot launch Chrome here (§3); use Browser Bridge.
12. **Beyond posting on development (owner 2026-10-16).** Run [DEV_DATABASE_CATCHUP.md](./DEV_DATABASE_CATCHUP.md) in the development SQL Editor (4 standalone files + all 27 migrations, in order, with record lines), then sign in to Expo `/admin` as an **admin** (not `rain`), switch Beyond contributions on from Highlights & review, and publish Look → "Daylight (default)". Add 2–3 real Train Like Me / Serve Like Me clips. Staging follows separately.

**Prove the tree is green before you change anything:**
`pnpm typecheck` · `pnpm --filter @tapuai/mobile test -- --watchman=false` ·
from the root: `pnpm copy:check`, `pnpm docs:check`, `pnpm app:data-boundaries`, `pnpm comments:check`, and `pnpm agents:check`
(Node is `~/.local/node/bin`). `pnpm check` also runs `pnpm docs:links` and
`pnpm security:client-keys`, shared with CI (Node 24).

**When you finish — the doc checklist.** Code under `apps/` / `packages/` / `supabase/` → a §4
line here + bump **Last updated**. User-visible → `CHANGELOG.md`. New table / RPC / column →
migration file + copy onto `schema.sql` + a row in `supabase/migrations/README.md` + `docs/engineering/SCHEMA.md`
(`docs:check` fails otherwise) + its owner in `docs/engineering/data-ownership.json` and a regenerated
`docs/engineering/DATA_MAP.md` (`data:map:check` fails otherwise; `DATA_GOVERNANCE` reviews). New folder / hook / lib file → `AGENTS.md` lists. Any on-screen
money words → `docs/product/VOICE.md` rules, `copy:check`, and flag it in `docs/legal/LEGAL_BRIEFING.md` (LEGAL
owns money copy). Price / split / Aura / Connect changes → `node scripts/sync-front-docs.mjs`
(regenerates `PRODUCT_FACTS.md` and blocks in PUBLIC / INVESTOR / LEGAL). Roadmap status →
`docs/product/ROADMAP.md`. Owner decisions → §6 here, plus ROADMAP / STORY if they change the plan or the story. New tester
steps → `docs/engineering/TESTER_SCRIPT.md`. Commit by path (never `git add -A`); do not push.

---
