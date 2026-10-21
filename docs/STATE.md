<!-- Current local implementation and observed readiness; hosted activation requires original evidence. -->
# STATE — read this first

**Last updated:** 2026-10-21 · Full `pnpm check` run after NOTIFY-01: typecheck and 233 suites / 2,287 tests PASS; three stale gates repaired (infra register counts regenerated, exit plan announced twice, reviewed `test-server.env.example` allowed in source packages); whole chain now exits 0; exit scanner now sees media-adapter bucket calls (§4). · NOTIFY-01 local Profile notification settings, Activity inbox, staff controls and server contracts implemented:233 suites/2,287 tests and both app/shared typechecks PASS; optional email paused, SQL25 plus1 concurrency cases prepared/0 executed, payment authority false (§4). · APP-TEST-01 execution: three anonymous local money routes independently return401; Connect SQL replay exits2 with no engine/zero cases; owner confirms Google setup pending; callback Router-history cleanup repaired and browser-verified; final226suites/2,196tests and both app typechecks PASS (§4). · Roadmap/team refresh: current app testing lanes,115roles/17departments and aligned next-owner duties (§4). · Current app testing: explicit picker duration units and service revalidation; offline synthetic media fixtures; 226 suites / 2,193 tests and both app typechecks PASS. Google setup guide prepared; development Google disabled, local bank service key missing (§4). · Media transport/readers implemented locally: replaceable upload/sign/list/remove, public references/legacy playback and private Vault isolation; 225 suites / 2,154 tests, both app typechecks and scoped guards PASS; independent Security accepted; long videos off until costs are measured and live deferred (§4). · Account-to-bank local preparation reviewed: guardian per-athlete setup and confirmed current client Terms; final 223 suites / 2,103 tests, both app typechecks and 12 scoped checks PASS; SQL/provider execution remains unverified (§4). · Google account creation and callback reliability repaired locally; 217 suites / 1,986 tests, both app typechecks and scoped checks PASS; independent source and documentation reviews accepted (§4). · Connect client and shared profile freshness repaired locally: owner-bound status, guarded async work, early single-flight lock and memory-only auth lifetime guard; 215 suites / 1,947 tests, both app typechecks and scoped guards PASS (§4). · Web first-tab compilation repair: supported Expo Router development sync imports; production web splitting and lazy screen mounting retained; local import-mode/typecheck/guard checks and scoped browser tab verification PASS (§4). · Connect persistence repaired locally: server-only conditional account saves before links; database failures visible, KYC evidence gap explicit; 213 suites / 1,899 mobile tests, both app typechecks and scoped guards PASS; source review accepted (§4). · Failed photo-story cleanup implemented locally: owner-only SQL (unapplied), fresh retries, durable owner/reel removal intent and committed-story recovery; 213 suites / 1,877 mobile tests, both app typechecks and scoped guards pass; independent source/docs reviews accepted (§4). · UX-07 story/tab presentation implemented: existing public Story section, clearer screen/empty hierarchy, wrapping controls/rows, 44-point targets and Reduce Motion; scoped source review and final full check passed (212 suites / 1,849 tests); current-component browser review has bounded native/hosted coverage, source refresh deferred on concurrent capture lock; evidence in [tracker](agents/UX-07.md). · Funnel top: `trivia.view_prep`/`press_start` events + `prep_views_7d`/`start_presses_7d` RPC counts (migration written, not applied); 411 mobile + 106 portal tests pass. · Health surfacing (Step 3): `get_admin_reports` trivia + smoothness keys (migration written, not applied), portal Health tiles conditional, 106/106 portal + 159 Expo report tests pass. · Smoothness signals (Step 2): `screen_mount` + `app_start` migration (written, not applied), `layouts.telemetrySmoothness` flag off, Home/quiz/donate mounts + cold start wired. · Trivia funnel + error telemetry (behavior-logging Step 1): start/answer/next/complete/abandon/unavailable as `feature_tap` + `ui_issue`, zero SQL; 29 suites / 380 tests pass; Health surfacing is Step 3. · REDUNDANCY-07 report cleanup: readable helpers and accurate per-guard missing-prerequisite statuses;22 local Security tests pass, concurrent screen-mount test scheduling repaired with targeted3PASS/both-app typecheckPASS; full project checks210suites/1825tests passed; exact latest-source verification deferred per owner while concurrent work continues (tracker receipts). · REDUNDANCY-07 Security expanded to six specialists under SECURITY -> CTO; local registered-source security report/routing plus SSH-range, Compose environment and Docker credential-context source repairs. Actual scoped/current final evidence in [tracker](agents/REDUNDANCY-07.md); hosted security remains unverified. · REDUNDANCY-06 shared portable client connection, matching target profiles and local installed-SDK protocol tests; original verification custody in [tracker](agents/REDUNDANCY-06.md). · REDUNDANCY-05 private setup and source-bound backup/read-only health implemented; current execution receipts in [tracker](agents/REDUNDANCY-05.md); live backup config incomplete. · Guest Rally reads fixed locally (`20261020090000`, not applied). · REDUNDANCY-04 current-source automatic watcher/CI implementation; actual activation/check receipts in [tracker](agents/REDUNDANCY-04.md) · REDUNDANCY-03 exact source release, content-aware exit inventory, runtime image archives, historical Storage owner reconciliation and strict180-minute warm-cutover evidence checks implemented locally; no hosted readiness claim. · Redundancy & Exit team (REDUNDANCY-02): five agents, a generated exit infrastructure map that updates with every app change (Stop hook + `pnpm exit:map:check`), and routed change notices from `EXIT_SYNC`. · REDUNDANCY-01 database migration checks (`infrastructure/migration/`): restore-list proposal, source/target parity and privilege reconciliation; real pg_dump/pg_restore/psql 18.6 drill 12/12 found that a restore onto a Supabase stack reopens 2,059 revoked anon/authenticated rights. · REDUNDANCY-01 continuation: complete offsite backup jobs, guarded retries, snapshot-age health checks and protected-checksum retrieval built locally; service not activated. · Full check green again after the SDK 58 upgrade (205 suites / 1,805 tests): 18 Jest suites had been failing since 2026-10-16 (icon fonts, stale mocks, the poster neighbor); the trivia demo can no longer award Aura. Five hooks moved their database calls into `lib/` (48 → 39). · 2026-10-18 · SCALE-01 admin two-step sign-in (TOTP, `aal2`) built locally for the portal and Expo `/admin`, switch off; MFA not enabled on any hosted project. · SCALE-03 live scores over per-game Broadcast built locally behind a default-off switch; migration written, not applied. · Environments page records the testing app: development catch-up is on, staging was not moved, production and a cache server are not created. The video ladder stays Mux, Bunny, or Cloudflare Stream, none selected. · Home pages uploaded Highlights once a clip has a file. Empty sample cards stay only while nothing uploaded can play. · Home keeps one decoded Highlight. A mounted neighbor is a poster. Uploads stop at 8 MB. Profile stats and the trivia notice wait until that part is open. The trivia database was not changed. · 2026-10-17 · Workout challenges moved from the profile scroll into Account settings. · Fan Zone and Beyond are on development. The extra storage indexes were skipped because postgres cannot own `storage.objects`; the write guards are triggers. Coach-level SQL stays unapplied. Home highlights share one surviving video. · Health lists syntax, logic, and glitches · Search filters stay one quoted value · Highlights profiles and Local stay open; trivia awards 5 Aura and can include an IQ question · Missing database updates stay on admin Home and portal Health, off the fan screen · Coach-level and Rally share handoff recorded (HIGHLIGHTS → ENGINEERING → CTO; docs synced; counsel and SQL still open) · Coach-level workout label and Rally / board share cards are local (SQL written, not applied; counsel still open) · Trivia names this week’s subject and sends one fact to dinner · Trivia teaches history, trades, and practice fuel · Highlight trivia invites a play · Trivia and Fan Zone keep the fan bar pinned · Trivia results sit on one phone screen · Trivia and Fan Zone play fit a phone width · Highlights trivia is a bright side notice; Fan Zone lives on Beyond · Live-match plays celebrate with Seki, Aura and Flex first; Donate opens the donation · Combined-branch check is green (196 suites / 1,744 tests) · Combined-branch Jest repair: fun-fact activity wording, operator live-game mock, one payout-flag catalog row, and Fan Zone windows that stay open on the clock · Fan Zone and trivia merged onto main (`de2d70d`); mobile typecheck repaired after the merge · PLAY-01 locally verified and closed (tag chip wired, claim released; browser/device/hosted/clean-install stay owner-gated) · Docs pass for Beyond follow-up: development catch-up runbook (not run), SAFETY-01 Coach-level label enrolled as planned, Beyond phrase test (Seki Set / Extra Rep / OT / Two-a-Day), legal row AC, tester steps; owner chose to commit everything now. · Beyond moved to the Highlights pill row (owner): Beyond switch plays workout/service Highlights, Beyond page keeps fan posts, Upload ＋ asks Highlight or Beyond moment while contributions are on; bottom bar Home · Activity · ＋ · Spotlight · Profile; `pnpm check` 150 suites / 1,197 tests. · Whole-team updates applied:107 role handoffs across17 department labels, current roadmap and generated Team flow reconciled. Full detection scan passes148 mobile suites/1,188 tests plus86 portal tests; independent prepared-source/Documentation reviews accepted. The owner approved keeping the Stripe-only Finance Operations §7 clarification; team records and final local checks are complete, with claims released in [TEAM_STATUS](agents/TEAM_STATUS.md); hosted/legal/device gates remain separate. · Calm Island colour refresh (owner chose direction A from the Figma comparison): one deep-jade brand colour, warm sand-white canvas, gold for awards, red for LIVE; unified chips, no page corner decoration, guest-hidden refresh buttons; `pnpm check` 148 suites / 1,188 tests; the published runtime theme still overrides five colours until Look → Daylight is republished. · UX-06 local first polish pass complete: compact Beyond categories, grouped consent composer, token-based workout controls and factual admin publication fallback. Full detection scan passes 148 mobile suites / 1,188 tests + 86 portal tests; visible category switches and 320/390 layout fit checked. Independent source/Documentation reviews and selected app-ready gate pass; claims released. Configured-state/native/accessibility and broader app/Figma polish remain open in [UX-06](agents/UX-06.md). · BEYOND-01 local implementation complete: dedicated tab, four categories, reviewed fan video/JPEG contributions and Drip Profile entry; CHAL-01a preset responses/friend invites/private badge/settings/export. Preserved admin-first checkpoints; independent source/Data/SUPPORT reviews and full detection scan pass148mobile suites/1,188tests +86portaltests. Both selected app-ready gates and independent Documentation/VP handoff pass; scoped claims released in [BEYOND-01](agents/BEYOND-01.md); migrations unapplied, server contribution/challenge switches off, hosted/device/Utah legal release pending. · PORT-01 follow-through: media references (expand, writer off), one shared money core for Node + Edge with a local JWKS token check (SECURITY approved), generated database types + drift test, exit drill runbook; `pnpm check` 135 suites / 1,076 tests · Infrastructure awareness (INFRA-01): new `INFRASTRUCTURE` agent (Engineering) is the scalability team's standing dev member; generated `INFRASTRUCTURE_REGISTER.md` + `pnpm infra:register:check` (CI) keep it aware of every hosting / service / integration change; direct Supabase calls moved into `lib/` (routes 16 → 0, rest 78 → 48); `pnpm check` 132 suites / 925 tests, 107 roles · Portability (PORT-01): owner accepts the hosting recommendation (stay on managed Supabase, self-hosted Supabase as the drilled exit); single source `docs/engineering/PORTABILITY.md`; boundary guard widened to the whole app and admin portal (78 + 16 direct Supabase uses recorded, may only shrink); `lib/media.ts` provider-neutral media refs · Payee verification (VERIFY-02): owner decided SSNs go to Stripe only (never stored), guardians need Stripe identity + the school's parent confirmation (two admins), Stripe Identity only for disputes, payout flags only by two admins with a reason; fourth migration written (not applied); replay 111/111; `pnpm check` 129 suites / 914 tests incl. new `security:no-ssn` · Minor accounts (MINOR-01): birth month and year replace the 13+ checkbox, teen-safe defaults, guardian link from a teen's code with teen confirmation, signed draft consent (public profile / payouts from the guardian on record), supervision and under-16 approvals, under-13 closure; replaces the PRIV-01 guardian lock; third migration written (not applied); schema replay 100/100; PRIV-01 and MINOR-01 app-ready; `pnpm check` 126 suites / 905 tests · Profile privacy (PRIV-01): public/private accounts, per-item audiences, two-way friends, blocking, hide from search, tag approval · Actual video scalability reviews recommend Mux as the provisional first technical experiment, with Bunny/Cloudflare in the initial equivalent quote/capability comparison; no selected provider or verified dollar winner. Documentation accepted; earlier recorded local gate passed 118 suites/867 tests, 186 docs and 106 roles. Owner-reported AI spending and separate infrastructure ceiling remain in Finance §6.1; actual video rates/usage/capacity and cash runway unknown. SCALE-02/admin-first integration, hosted/device/access/deletion/recovery and release remain pending. Next Growth review October 20; no new spending/hosted change/scheduler. Receipts: §4 and [video review](engineering/HOSTING_DECISION_BRIEF.md#11-video-scalability-team-review--2026-10-13). · Verification/consent/safe-growth source review and joint checkpoint established; proposed owner decisions and actual review/check receipts in GROWTH-01. Earlier safe-growth review checks failed on 28 MINOR type diagnostics and schema-doc drift; the newer user-growth run passes after concurrent integration. Fan/filmer follow-up: per-user growth plans and charter §10 added; mitigation proposals and current checks in GROWTH-01. Latest user-growth local check: exit 0, 126 suites/905 tests,191 doc destinations,106 roles; no hosted/counsel/financial release evidence from this pass.

**Current fun follow-up:** the owner clarified fan-video Game/Week/Month/Year recognition,
awesome-fan badges and optional service with separate badge/Aura and money paths, then asked
to continue brainstorming. [FAMILY_FUN_PLAYBOOK](product/FAMILY_FUN_PLAYBOOK.md) and Growth
charter §11 contain proposals and existing capability gaps. Actual review/coordination/check
evidence belongs in GROWTH-01; no generic fan award/voting/badge, service program or paid earning model is built by those proposals. The local CHAL private self-report badge and Beyond contributions are separate, later capabilities.
**Last updated:** 2026-10-15 · Life Playbook and personal progress (QUIZ-04): three separate weekly rounds (personal / group / life), levels that never drop, opt-in Life Playbook simplified by the owner to simple fun facts (four 13+ chapters, one-admin approval, automatic copy rules); admin-ready then app-ready; `pnpm check` 166 suites / 1,372 tests; migrations `20261014180000` / `20261014190000` written, not applied · Trivia, play together (QUIZ-03): weekly rounds of five, true / false, Learn your athlete's sport, family challenge groups under MINOR-01 teen rules, badge shelf and season recap, 60-question draft bank; admin-ready then app-ready; SQL review approved; `pnpm check` 156 suites / 1,286 tests; migrations `20261014160000` / `20261014170000` written, not applied · 2026-10-14 · Timed trivia source53a6104 passes final independent review; FINAL-I1 is addressed. Root full check passes150 suites/1,219 tests and all guards. Selected local QUIZ-02 app-ready passes at recorded date18:23:47Z, after admin16:53:17Z. Actual final Documentation/VP continuation PASS; local handoff complete. Pilots remain paused/empty; no hosted SQL, spending, merge or push.

**Prior Fan Zone / untimed Sport Quiz implementation (historical full-check evidence; current QUIZ-02 full check passes150suites/1,219tests):** owner approved the family-fun build and added optional weekly quizzes. Actual Fan admin checkpoint is 2026-10-14T13:42:36Z; Quiz is 2026-10-14T06:09:57Z. Fan participant `bcb898c` plus `070a58b` independently passes scoped review (35 focused checks), as does private video `a4f4acd` (13). Shared integration `8179b7b` includes Home, four HQs, profile and real control-map/stop paths; current guardian recovery survives participation dismissal. Independent shared consumer acceptance passes at 8179b7b; full pnpm check passes 148 suites/1,146 assertions and all guards; independent whole-branch and selected local Fan app-ready pass; actual Documentation/VP scope reviews pass and final status continuation is retained. Per-user growth and joint Legal/Dev/capacity plans retain the October 20 packet. No live measures or launch readiness are inferred.

**Earlier fun refinement (before implementation):** the owner clarified fan-video Game/Week/Month/Year recognition,
awesome-fan badges and optional service with separate badge/Aura and money paths, then asked
to continue brainstorming. [FAMILY_FUN_PLAYBOOK](product/FAMILY_FUN_PLAYBOOK.md) and Growth
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

If you are an AI agent or a new engineer: read this file, then [AGENTS.md](../AGENTS.md) for
folder law. Do not skip to the code.

---

## 0. Pick up here (current hand-off 2026-10-16; historical setup 2026-10-07)

**Current whole-team handoff.** Read [TEAM_STATUS](agents/TEAM_STATUS.md) for all107 role
assignments, seventeen department updates, requested job-function coverage, current gaps
and next owners; [COORD-01](agents/COORD-01.md) records actual review/check execution. Beyond,
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
passes completed in [COORD-01](agents/COORD-01.md), with check results, released claims and next
owners. [HEALTH-01](agents/HEALTH-01.md) evaluated 62 current task IDs, repaired the existing logger/QA
desk and passed the current local scan and frozen SQL verification. Hosted SQL/delivery, durable
crash intake, database-backup/compatibility, devices,
counsel and owner release gates remain explicit in the task records and §§5–6.
[GROWTH-01](agents/GROWTH-01.md) now assigns one Growth and Capacity Review packet and
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
| 1 | `supabase/clear_reel_hype.sql` | — (un-vote persists) |
| 2 | `supabase/custodial_money.sql` | — |
| 3 | `supabase/leaderboards.sql` | — |
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

**Specialist execution:** [WORK_QUEUE.md](agents/WORK_QUEUE.md) assigns the Wave 0 sequence,
acceptance criteria and dependent decisions. Use the registry and hierarchy to dispatch its
primary owner and required reviewer. Local code completion is separate from hosted/device evidence.

**Next up, in order.**
1. Preview builds queued 2026-10-11 night with the local app, including the popup swipe and the upload black-screen fix. Android (any phone):
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
5. Account tags on a Highlight are in the app. SQL `20261002160000_reel_account_tags.sql` is
   **not applied** anywhere. Its cap/confirmation behavior was hardened locally on 2026-10-07.
   Before staging application, run concurrent cap, pending privacy and wrong-actor checks (WORK_QUEUE W0-08).
   Until it is applied, the picker stays empty and a publish still succeeds.
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
8. **Security fix to apply first (found 2026-10-13 by the full schema replay).** `20261013210000_function_access_hardening.sql`: today anyone with the public app key can write revenue rows into the books (`record_company_revenue` keeps EXECUTE through PUBLIC — that function is on staging), raise donation totals and Aura, and change sport settings. Paste it into the staging SQL Editor before the other October files, then `20261013220000_disbursements_guardian_scope.sql` (parents could edit any family's payout rows). RLS_SECURITY approved; replay 35/35.
9. **Books for go-live (owner 2026-10-12: must be there at launch, especially bookkeeping).** Rehearse on staging during testing (WORK_QUEUE W0-10): apply `20261012210000_bookkeeping_ledger.sql`, close one test month, import into a QuickBooks sandbox. It is a live-money gate (ROADMAP Wave 1 checklist item 10, WORK_QUEUE P1-08).
10. **Environments (owner 2026-10-13).** Decide the nine items in [ENVIRONMENTS_AND_HOSTING.md](engineering/ENVIRONMENTS_AND_HOSTING.md) §9 (stay on Supabase, Free vs Pro org for dev/staging, GitHub plan, bundle IDs, store accounts, region). Do not run `supabase db push` against staging before the E1 baseline and `migration repair`. The EAS production environment needs `EXPO_PUBLIC_APP_ENV=production` for OTA updates.
11. **MCP tooling.** Start Claude Code inside the repo, approve the project servers, then sign in to
   `canva`, `expo` and `supabase-dev` from `/mcp` (`docs/engineering/TOOLING.md`). Signed in 2026-10-15: `canva`, `figma`, `supabase-dev` (read-only, development); `expo` still needs sign-in. Playwright MCP cannot launch Chrome here (§3); use Browser Bridge.
12. **Beyond posting on development (owner 2026-10-16).** Run [DEV_DATABASE_CATCHUP.md](engineering/DEV_DATABASE_CATCHUP.md) in the development SQL Editor (4 standalone files + all 27 migrations, in order, with record lines), then sign in to Expo `/admin` as an **admin** (not `rain`), switch Beyond contributions on from Highlights & review, and publish Look → "Daylight (default)". Add 2–3 real Train Like Me / Serve Like Me clips. Staging follows separately.

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

## 1. Working agreement — every agent must follow this

**Before you start:** read this file. Check §5 (Known broken) so you do not "fix" something
already known, and §6 (Open decisions) so you do not silently decide something that is the
owner's call.

**Before you finish, in the same turn as your code:**

| If you… | Then you must also… |
| --- | --- |
| Change anything under `apps/`, `packages/`, or `supabase/` | Add a line to §4 **Recent changes** and bump **Last updated** at the top |
| Land a user-visible feature or schema shift | Add a `CHANGELOG.md` entry too |
| Move a phase forward, or find a new blocker | Update `docs/product/ROADMAP.md` status and §5/§6 here |
| Discover an environment gotcha that cost you time | Add it to §3 so the next agent does not rediscover it |
| Change tables, RLS, RPCs, routing, env vars, payments, Realtime | Follow the full sync table in `.cursor/rules/documentation.mdc` §2 |

**Keep §4 short.** It is a rolling log, newest first — roughly the last 15 entries. Anything
older belongs in `CHANGELOG.md`, which is the permanent record. Prune as you add.

Say plainly what you did **not** verify. An unverified claim in this file is worse than a gap,
because the next agent will trust it.

---

## 2. What this is

Polynesian-inspired fan and athlete hub. pnpm monorepo:

- `apps/mobile` — Expo Router SDK 58 app (Highlights ⚡ / Activity / Spotlight / Drip / Profile)
  plus the production Expo `/admin` control plane. **All admin writes happen here.**
- `apps/admin-portal` — Next.js 15 oversight desk on `:3001`. **Deliberately read-only** —
  six tabs (Home / Trends / Audience / Revenue / Health / Product) plus the Analytics and
  Departments links; Product holds Features / Profile / Sign-in / People. Charts are inline SVG
  from `components/charts/`. Read-only is a standing decision, not an unfinished state.
  Reconfirmed 2026-09-28.
- `packages/shared-types` — `@tapuai/shared-types`.
- `supabase/` — SQL applied by hand to the live project. `apps/mobile/src/backend/db/schema.sql`
  is the canonical copy.

Stripe is in **test mode**. Staging was created and the September SQL applied there on 2026-09-30 (§0). Development remains separate and lacks those changes. Remote state was not re-queried during the 2026-10-07 local review.

---

## 3. Running it on this machine

Verified 2026-09-28 on the `seiuliian` Mac. These are real constraints, not preferences.

- **Node** is at `~/.local/node/bin` (v24.21.0), with `pnpm`, `npx` and `corepack` beside it, and
  is on `PATH` via `~/.zshrc`. Rechecked 2026-10-12: the folder exists and `pnpm check` runs from
  the root. An earlier 2026-10-12 note that `~/.local/node` was missing was wrong. A shell that does
  not load `~/.zshrc` (agent sandboxes) picks up Homebrew's Node v25.4.0 at `/opt/homebrew/bin/node`
  instead, so start with `export PATH=~/.local/node/bin:$PATH` and check `node --version`.
- **Admin portal unit tests** use Node's own runner, not Jest:
  `cd apps/admin-portal && node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts`.
  No pnpm script runs them, so `pnpm check` does not cover them. 86 tests as of 2026-10-12 (ADM-02 shared-model compatibility).
- **Headless Playwright Chrome cannot launch on this Mac** (macOS Mach-port permission; a Launch
  Services attempt returned -54). Browser checks use Browser Bridge on the owner's Chrome. ADM-02 verified trusted
  Space activation on Data and arrow navigation; native Data Enter did not activate,
  and the Home/End commands are unreliable. Keep those remaining keys unverified.
- **The Codex CLI cannot be launched from Claude's sandbox.** Codex sessions are owner-run; share
  files with them through the tracker Status table (`docs/agents/TEAMS.md` contract item 10).
- **Jev works from Claude** through `~/bin/jev-ask spec.json` (runs the repo's `jev/` SDK with this
  Mac's Python 3.12 and the key in `jev/.env`). The Codex session could not reach Jev.
- **`registry.npmjs.org` is blocked** by the corporate egress proxy (503 on CONNECT).
  `pnpm install` and `corepack` cannot fetch anything. `nodejs.org` *is* reachable.
  Work with the committed `node_modules`; **you cannot add a dependency.** Anything new must be
  hand-rolled (this is why charts in the admin portal must be inline SVG, not Recharts).
- Run scripts directly, not through pnpm:
  - typecheck — `cd apps/mobile && ../../node_modules/.bin/tsc --noEmit` (same for `apps/admin-portal`)
  - tests — `cd apps/mobile && ../../node_modules/.bin/jest --watchman=false`
    (**`--watchman=false` is required** — `watchman` is on `PATH` with no running daemon and Jest crashes on it)
  - docs — `node scripts/sync-front-docs.mjs --check`
- **Metro:** `cd apps/mobile && ./node_modules/.bin/expo start --port 8081`.
  Do **not** pass `--ios` (it shells out to AppleScript for a Simulator.app that is not installed)
  and do **not** pass `--localhost` (binds IPv6 `[::1]` only, which a device cannot reach).
  Open on a device with `exp://<LAN-IP>:8081`.
- **iOS Simulator can run but cannot be tapped.** This Xcode is a trimmed install with no
  `Contents/Developer/Applications`, so no Simulator.app and no GUI; `idb_companion` is a dead
  wrapper. `simctl` can boot, install, `openurl` and screenshot only. Interaction has to be
  covered by component tests instead.
- **macOS quarantine on native modules.** The project came out of a Firefox-downloaded zip, so
  every file carries `com.apple.quarantine` and macOS refuses to `dlopen` ad-hoc-signed `.node` /
  `.dylib` files ("Apple could not verify … is free of malware"). Clicking **Move to Trash** on
  that popup deletes the binary (that is how lightningcss 1.33.0 went missing). Fixed 2026-10-07:
  quarantine removed from the seven native files (fsevents, lightningcss 1.32/1.33, next-swc,
  tailwind oxide, sharp + its `libvips-cpp` dylib) and the 1.33.0 binary restored from Trash; all
  load in Node. If a fresh copy of the zip is unpacked, check with
  `find node_modules/.pnpm \( -name '*.node' -o -name '*.dylib' \) -xattrname com.apple.quarantine`.
- **2026-10-12 native dependency recurrence:** replacement/downloaded files can regain Firefox quarantine after the earlier cleanup. The two Lightning CSS bindings and worker transforms passed in this shell even before removal, so quarantine presence alone is not proof of the reported failure. The wrapper masks its first error with a missing fallback; use the direct probe in TROUBLESHOOTING §0b. Seven native-file flags were removed narrowly and a fresh configured Metro served web/iOS bundles.
- **2026-10-12 Hermes export:** macOS killed the installed Hermes compiler during an offline iOS export. The known Firefox quarantine flag was present on that exact binary; removing only its `com.apple.quarantine` flag restored `hermesc -version` and a complete HBC export. No package/source replacement was required.
- **Expo web bundling** was blocked by the lightningcss binaries above. Both now load; a local
  `expo export --platform web` passed 2026-10-07 (52 static routes / 3 API bundles) with dotenv
  disabled. Separate iOS and Android exports with `--max-workers 1` also passed, including
  Hermes bytecode; a combined export initially received SIGKILL. This confirms bundling;
  native linking, configured backend and device behavior need separate checks.
- **Expo writes loaded env values to `apps/mobile/.expo/dev/logs/start.log`.** Never keep
  `STRIPE_SECRET_KEY` (or any secret) in `.env.local`. On this Mac it lives in
  `~/.config/ala-sports/stripe-secret.env` (mode 600); load it into the shell only when the
  local Metro `/api/*` fallback is needed: `set -a; source ~/.config/ala-sports/stripe-secret.env; set +a`.
- **`node_modules` is a hybrid** of a stale npm install and the pnpm install. Duplicate `react`
  broke Jest (null hook dispatcher) until `node_modules/react` was repointed at the pnpm copy.
  Other stale duplicates remain and may bite the same way.
- **2026-10-13 pnpm store mismatch:** `.modules.yaml` still names the former `/Users/ian`
  store. `pnpm patch-commit` asks to rebuild all modules; offline resolution lacks cached
  registry metadata. PLAY-01 preserved existing modules, registered the versioned Expo
  Video patch, validated frozen lock metadata with a temporary modules directory and
  applied the tracked patch narrowly to the installed SDK. A complete clean install
  still needs a working registry or complete store. See [PLAY-01](agents/PLAY-01.md).
- **Historical NAS mode flips:** older sessions saw ~500 `100644 → 100755` changes. The
  2026-10-07 starting tree contains only `docs/STATE.md`, `docs/agents/TEAMS.md`, and the new hierarchy
  document; that old count is not the current status. Preserve user edits and stage by path.
  **Never `git add -A`.**

---

## 4. Recent changes (rolling — newest first)

### 2026-10-21 — Full check after NOTIFY-01 (Claude Code catch-up)

The broad `pnpm check` the NOTIFY-01 session left unrun was run. Typecheck and mobile
233 suites / 2,287 tests passed; three later gates had gone stale and were repaired.
`infra:register:check`: register regenerated (SQL `auth.uid()` 267→275, `auth.role()` 114→117,
grants 371→378 from the notification migrations; no new services). `exit:map:check`: 10 areas
announced in [EXIT_CHANGE_LOG](agents/EXIT_CHANGE_LOG.md) with a note that the `reel_vault` and
`stripe_webhook_events` "removals" are false (bucket passed via the media adapter, which the scanner
does not resolve; webhook table now behind `apply_notification_payment_event`). `exit:sync ensure`:
the empty template `apps/mobile/src/backend/api/test-server.env.example` added to the reviewed
example list in `scripts/recovery-capsule.mjs` (recovery tests 14/14). Every step after the tests
then passed individually; `RECOVERY_SECURITY` and `EXIT_SERVICES` own the follow-up review.
Scanner gap closed the same day: `scripts/exit-inventory.mjs` now records calls through the imported
`mediaStorage` or a `MediaStorageAdapter`-typed parameter as `storage.from` with `via`, so `reel_vault`
and `reels` are listed again; three variable-bucket calls (avatar/highlight upload) stay review
candidates. New regression test in `scripts/__tests__/exit-map.test.mjs` (15/15).

### 2026-10-21 — NOTIFY-01 local notification controls and inbox

Built Profile Account notification preferences, Activity read/unread and archive/restore inbox,
shared safe templates, source/RPC/durable worker contracts and Expo staff controls/Health.
All optional emails start off; security verification/reset remains separate. Unsupported sources
show unavailable; production starts paused. Preference/config saves compare revision and captured
actor to Auth. Complete Auth/view/effect lifetimes prevent stale data or follow-up work. Mark-all
uses an account-bound active-inbox snapshot; Archived hides it and both callbacks refuse it.
Existing donation history and Crew/workout queues retain their independent factual controls.

Independent source reviews drove strict worker confirmations/provider-ID limits, delivery-first
expiry/completion locks, NULL-role thank-you denial, current actor checks, Health population/
unknown-provider wording, effect-generation recovery and Archived bulk-read correction. Seven
payment-proof fields are in Finance catalog as controls/references, never journal postings;
retained legacy webhook claims are explicitly not completed-processing proof. Canonical SQL and
migrations match; actual SQL25 plus1 concurrency cases remain unexecuted because no engine exists.

Final mobile233 suites/2,287 tests PASS; both app and shared typechecks PASS; worker/template21,
hook19, fan UI15 and SDK/admin30 fixture tests pass. Local admin checkpoint preceded fan work
at15:31:03UTC. Current local app evidence and gate are in [NOTIFY-01](engineering/evidence/NOTIFY-01-app.md).
No hosted SQL, optional email send, provider/bank/payment or release acceptance is claimed.
Email still needs unsubscribe/transport/deployed scheduler and reviewed retention/activation;
donation notification authority remains false pending atomic canonical business/outbox wiring.
Updated data/privacy/control/sensor maps, tester instructions,115-role/17-department handoff and
[execution ledger](agents/COORD-01.md). Broad pnpm check remains unrun; scoped checks replace it.

### 2026-10-21 — Email/inbox/preferences architectural draft (enrollment checkpoint)

Owner requested account-creation and donation emails, notification review and Profile controls.
Read-only source maps found no unified preferences/unread inbox; existing Activity is derived,
game controls are local filters and Crew queue storage does not prove push delivery. The draft
proposes server-authoritative events, recipient-only inbox/preferences, durable email delivery
and Expo admin controls before fan UI. Donation intent/webhook attribution and commit gaps,
plus a source-level NULL-role thank-you authorization gap, must be repaired before affected
notification producers can send. No SQL exploit was run. Owner confirmed receipt email on with
opt-out, social/game email and push off until opt-in, and verification/reset always available.
The owner's later architecture answer approved building with **only security emails on by
default**, superseding receipt-email-on: all optional category emails start off. NOTIFY-01 is
enrolled `planned`; local backend/admin implementation is in progress. No migration application,
provider setup or sends have occurred at this checkpoint.
Design: [email and notification controls](engineering/design/EMAIL_NOTIFICATIONS_DESIGN.md).
Actual read-only executor/review and documentation evidence: [COORD-01](agents/COORD-01.md).

### 2026-10-21 — APP-TEST-01 operational execution

Owner confirmed Google OAuth setup is not completed. Root exercised the current local HTTP
routes for Connect, payment creation and payouts with POST `{}` and no Authorization: all three
returned401 JSON with safe sign-in copy. Independent Security/Finance/QA reproduced all three
at04:15:21UTC. These are anonymous-gate results, not signed-in ownership or provider acceptance.
The actual offline Connect replay exited2 because its external PGlite engine was unavailable:
35 prepared checks, zero executed SQL cases; no SQL or concurrency/locking acceptance.
Browser testing found initial Router history replay could restore a failed return's query after
the component cleared browser history. Recovery now also replaces the Router-owned path with
the clean callback route. A clean-route guard retains failure without retrying the consumed
return; when route inputs change, new query/fragment details still take the normal completion path. Native
behavior remains unchanged. Three regression failures preceded the repair; a further fresh-
fragment failure preceded narrowing the guard. Final root mobile226suites/2,196tests PASS
(151.564s), both app typechecks and9scoped app/source guards PASS. Independent56focusedtests
and data-map4regressions/0failures PASS; source accepted04:26:52UTC. The previous2,193-test
baseline is dated earlier. Existing test-account normal email sign-in resumed the Highlight
draft; guest Upload correctly opened sign-in. No account was created, birth data saved, fixture
selected, upload performed or content published. Media picker boundary cases remain unrun.
Actual synthetic failed-return browser testing now settles on a clean callback address with
visible recovery, no diagnostic body, working Back to app, and clean browser Back/Forward.
Google's additional public authorize probe was automatically rejected as sensitive auth traffic;
it did not execute. File-input automation received a caution, executed, and was cleaned up;
that was not a tool rejection. A blank private bank template was created outside the repo with
mode600; credentials and activation remain pending. Restricted history/navigation APIs still
permit only best-effort cleanup with recovery; this is not a provider/native acceptance.
Google, configured test-bank/SQL/Edge, real upload, cleanup and native acceptance remain open.
Claims and final test receipts are in
[APP-TEST-01 execution](agents/COORD-01.md#app-test-01-execution--2026-10-21-utc).
Final Documentation/VP accepted04:31:40UTC; independent final scope accepted04:32:29UTC and
cleanup delta04:33:58UTC. Root verified frozen source/document bindings and released local claims.

### 2026-10-21 — Roadmap and whole-team current-app handoff

Owner requested a roadmap check and whole-team update. APP-TEST-01 now sequences Google test
account setup, optional later adult/guardian test-bank attachment, actual short-video/photo
rehearsals, independent public-beta security/minor/money gates, Legal-first telemetry IDs and
athlete-story/usability checks. ROADMAP, queue, team briefing, department plans, call sheet and
hierarchy use current implementation evidence and retain dated older checks as history.
The registry contains115 definitions/17departments;51 affected app/testing specialist definitions
and registry tasks received current next-owner instructions. Reporting leads, model pins and
ownership paths are preserved. All-role assignments do not establish115 agent executions or
messages delivered to human staff. Actual review/checks/claims are in
[COORD-01](agents/COORD-01.md#current-app-roadmap-and-whole-team-refresh--2026-10-21-utc).
Google remains disabled; prepared bank/cleanup code still needs approved configuration, SQL/Edge
execution/readback and real provider/upload/device walkthroughs. Longer videos stay off until
costs are measured; live streaming remains deferred. Corrected the legacy-public-Vault wording
and historical blanket-profile-read claim without treating public free media as private or
re-querying hosted policies. No new feature or hosted/provider change was performed.
Latest app baseline remains226suites/2,193tests PASS; no app suites rerun for prose-only updates.
Final Documentation/VP accepted03:27:47UTC; independent Security/Finance/QA accepted03:28:14UTC
and bounded final roadmap revalidation03:29:21UTC. All115 assignment rows/17department totals
and51 matched role/registry duties pass reconciliation. Scoped docs,links(289),agents(115),copy,
comments,data-map(0failures) and whitespace checks PASS; local documentation claims are released.

### 2026-10-21 — Current-app media and provider testing preparation

Highlight pickers now normalize web seconds/native milliseconds once, reject unreadable or
nonpositive duration before compression, and keep duration through draft submission. The service
revalidates normalized metadata before progress/compression/Auth/file reads/Storage writes;
exactly45seconds is accepted, over45seconds rejected. Client metadata cannot establish server
media validation. Long videos remain off until costs are measured; live streaming stays deferred.
Root full mobile226suites/2,193tests PASS(138.861s), both app typechecks and13scoped app/source
guards PASS. Root focused10suites/177tests PASS; meaningful picker/payload16failed21passed and
service13failed32passed preceded repairs. Independent Security/Data/QA accepted at03:06:27UTC
with exact7suites/153tests plus2fixture safety tests PASS. Actual executors/source hashes:
Final independent Documentation/Data and priority review accepted at03:09:54UTC;
local documentation links(289activefiles),copy and scoped whitespace checks PASS.
[media plan §6](engineering/design/MEDIA_SERVICE_PLAN.md#6-current-app-testing-preparation--2026-10-21-utc).
Offline synthetic fixtures contain ten JPEGs,8s/46s H.264 videos and a valid oversized8s MP4;
actual native decode/type/duration/frame checks passed before the complete manifest. Both
reviewers independently matched all13filehashes/sizes. Use the complete -002 output; -001 records
a failed compiler run. New `app:test:media` generates outside the repo without overwriting;
`app:test:assets` runs its two safety regressions. Data map regenerated with0rulefailures.
Read-only development Auth settings HTTP200 around03:00UTC confirmed Google disabled,Email
enabled,signup not disabled. Requested [Google setup guide](ONBOARDING.md#prepare-google-sign-in-for-development--2026-10-21)
is prepared; no provider/allowlist changes were made. Local bank fallback still lacks a service-role
key; hosted SQL/Edge state and real Google/bank walkthrough remain unverified.
Browser navigation atlocalhost8086 exercised Home,Activity,Spotlight,Profile,Upload and library
cancel at390×844 in an existing signed-in browser context; Activity/Spotlight fit390px without
horizontal document overflow. This does not verify fresh guest gates or successful sign-in,
picker-file metadata, upload/publication, native app playback or bank onboarding. No account
sign-out, media publication or provider configuration was performed.

### 2026-10-20 — Portable current-app media service (local implementation)

Existing video/photo upload and Expo playback now use a bound storage transport for upload,
public URL construction, authorized signing, list and removal. Video readers accept `sb:` and
legacy public URLs; private Vault upload never requires a public URL. Public readers allow only
canonical public buckets and reject unsafe/unsupported references. Existing photo sanitization,
owner/rights/row writes, private feature permissions and claimed cleanup stay in their feature.
The same app remains on Supabase; no new host/credentials, writer switch or URL backfill is enabled.
The owner chose short Highlights for everyone otherwise eligible; longer videos stay off until
costs are measured and live streaming belongs in a later phase. Current 45-second/8-MiB Highlight client limits remain;
server public-media quota gaps and future long-video requirements are explicit. Root owns integration;
actual Codex worker/review ownership, tests and remaining host/device gates:
[MEDIA_SERVICE_PLAN](engineering/design/MEDIA_SERVICE_PLAN.md). Final root mobile 225 suites / 2,154 tests PASS (129.383s), both app typechecks and14scoped
app/source guards PASS; independent Security/Data/QA accepted02:45:56UTC with102focused tests.
Media Documentation/Data reconciliation completed at02:50:27UTC; four lineage regressions,
current data-map,289local documentation destinations, copy and scoped whitespace checks PASS.
Hosted upload/decoder/access/removal/restore remain unverified.


### 2026-10-20 — Google account to Stripe test bank preparation (local implementation)

The owner chose the existing development project with Stripe test mode. The server derives the
adult/self or guardian/per-athlete context from live Auth, saves through service-only SQL with
current eligibility/binding checks before links, and never borrows a guardian own-profile account.
New migration `20261021120000_connect_account_context.sql` is written, not applied; PostgreSQL
execution remains unverified because local engine startup and engine download are blocked.
Custodial and Terms hooks reject stale/invalid work; configured signed-in Terms writes require
confirmed server persistence, and device-only acceptance cannot waive the current client Terms.
Root focused server/hooks 5 suites / 214 tests PASS; final full mobile 223 suites / 2,103 tests
PASS (114.837s), both app typechecks and 12 scoped app checks PASS. Final independent Security/Finance/Data
source review accepted 2026-10-21 02:33:54 UTC with 8 client/custodial/Terms suites / 130 tests PASS;
Documentation/Data accepted onboarding/tester scope at02:30:31UTC. Provider checks hit OS network EPERM; current Google/provider/redirect and deployed
SQL/function state remain unverified. Local server service key is not available yet; the credential-free
[private server template](../apps/mobile/src/backend/api/test-server.env.example) is prepared.
[Plan §10](engineering/design/PAYEE_VERIFICATION_PLAN.md#10-google-account-to-stripe-test-bank-preparation--2026-10-21-in-progress)
tracks actual ownership, evidence and remaining gates. Payouts remain503 and KYC evidence stays open.


### 2026-10-20 — Google account creation and sign-in return (app repair)

Google is offered in Sign in and Create an account; Apple only on supported iOS. Profile creation
requires no bank details, and existing post-auth age/athlete/guardian rules remain. Web avoids the
network authorize probe before opening its popup; native probing remains. Callback completion
checks the generated return origin/scheme/path, rejects repeated credentials, shares simultaneous
same-return work and masks provider diagnostics. Current route/browser inputs replace stale launch
links; failed/empty returns show recovery and attempt to remove browser address query/fragment
data when history access permits.
Root focused 78 and full 217 / 1,986 PASS; both app typechecks and 12 scoped checks PASS.
Independent Session Security/QA accepted 2026-10-21 01:39:30 UTC (46 independent tests).
Independent Documentation/Data accepted 2026-10-21 01:45:08 UTC (read-only, no tests rerun).
Actual executor/claims, source hashes, receipts and limits
are in the [existing onboarding checkpoint](ONBOARDING.md#google-account-creation-and-later-bank-setup--local-repair-2026-10-20).
Hosted Google configuration/real return remain unverified; web disabled-provider error pages,
different concurrent sign-ins and separate-runtime races remain. Stripe stays test-only with payouts
blocked; guardian setup has no Stripe launcher and current profile binding is not custodial routing.



### 2026-10-20 — Connect client and shared profile freshness (app repair)

Connect now locks before Terms lookup, requires matching user/session/profile ownership, masks
outgoing status and rejects stale cache/API replies, including batched A → B → A transitions.
An explicit profile false overrides cached true; cached status additionally needs the current Stripe
binding and cannot waive first-onboarding Terms. Fresh API status may fill a missing profile only
within that request's current account lifetime. Successful Edge/HTTP replies require boolean flags
and reject an explicit error; malformed successful Edge replies are not retried through HTTP.
Cache read/write and profile-refresh failures do not falsely report a confirmed server link as failed.
The shared AuthContext masks old profiles, orders concurrent loads and guards query/team/local/
bootstrap/sign-in/redirect completion. Its optional internal `isSessionCurrent` callback checks a
memory-only account epoch immediately at auth events, while same-owner token refresh preserves the
Stripe browser journey. Studio settings remain intentional local preview settings. No new telemetry,
SQL, identity collection or payout enabling. Existing global onboarding-team cache is not owner-bound;
other async profile/role/birth mutations remain separate. Final focused root suite 48 PASS; final mobile suite 215 / 1,947 PASS (81.253s), both app typechecks
and 12 scoped app guards PASS. Independent Security/Finance/Data source acceptance at
2026-10-20 21:32:12 UTC: client`14b036035ec2`, tests`7883f5d15c12`,
AuthContext`462ea66370fa`, provider tests`3d945ed1407c` (SHA256 prefixes). Its independent narrow 47
PASS preceded the small HTTP correction; root owns final 48 verification. Pending Connect flights
are not canceled on same-owner binding replacement; local status rendering still checks current
profile binding. Final independent Documentation/Data handoff accepted at 2026-10-20 21:35:48 UTC
(actual Codex reviewer; read-only, no tests). Practical limits and receipts are in the [app repair contract](engineering/design/PAYEE_VERIFICATION_PLAN.md#9-connect-client-and-profile-freshness-repair--2026-10-20-local-app).



### 2026-10-20 — First-visit web tab bundling (app repair)

Owner reports a brief side spinner with build text on each tab's first visit after loading the
web app. Installed SDK 58 Expo Router defaults web routes to asynchronous imports; its development
Suspense fallback replaces the route with a bottom-left “Bundling...” toast and spinner during the
first import. `apps/mobile/app.json` now sets the supported router option
`asyncRoutes: { web: "production" }`: development web imports become synchronous, production web
keeps splitting, and native defaults remain synchronous. Navigator lazy mounting and data fetching
are unchanged. Tradeoff: development compiles more route code on startup. Restart Metro with
`cd apps/mobile && ./node_modules/.bin/expo start --clear` and reload the browser; a running server
will not reliably pick up changed plugin configuration. Root owns the config/docs; independent
Expo source review accepted the actual config → CLI → Babel evaluation: web development `sync`,
web production `lazy`, iOS/Android `sync` in both modes. Root independently reproduced all six
import modes; mobile typecheck and docs/comments/client-key/whitespace guards PASS. Documentation
source review accepted at 2026-10-20 20:57:21 UTC (actual Codex reviewer; no tests). Browser Bridge checked the fresh, unconfigured local Expo app on port 8084: actual Home →
Activity → Spotlight → Profile → Home clicks, selected-tab/route DOM and screenshots confirmed
rendered destinations; the mutation observer recorded no build/bundling toast, browser console
errors were empty, and the selected page's bundle-resource snapshot contained only the startup entry bundle. Tab-control
height remained 62px; viewport emulation reset during the browser tooling loop, so absolute-position
samples across the whole loop do not prove uninterrupted layout stability. An initial malformed
probe and a background animation-frame await timeout were harness failures; direct clicks/DOM/
screenshot checks completed afterward. Source and Documentation acceptance are local only. Router
error handling is retained. Original reported preview identity, live data loading and every-route/
native/production visual behavior remain unconfirmed; no hosted deployment performed.


### 2026-10-20 — Connect persistence (app repair)

Existing Edge/Node Connect now requires trusted server database credentials, checks profile read/save
errors and unmatched updates, and saves its account/flags before issuing links. Conditional updates
match the original exact binding as well as own profile/session ids; competing/delayed requests cannot
overwrite a newer account binding. Link failure after save now resumes that account on retry. No SQL
change, new identity collection, live Stripe operation or payout enabling. Current focused dual-runtime handler suite 127 PASS (also independently executed). Final both-app
typechecks PASS; full mobile suite PASS: 213 suites / 1,899 tests (103.824s); 12 scoped app guards PASS.
Independent Security/Finance/Data source review accepted on 2026-10-20: core`83f0e7ecb9f0`,
Node`8a9e19226a0c`, Edge`f7e60bf9b0af`, tests`7338ee58d189` (SHA256 prefixes).
The mobile public template documents private server-role credential loading; client-key guard PASS.
Independent Documentation/Data source review accepted at 2026-10-20 20:42:40 UTC; reviewer ran
no tests. Hosted provider/deployed grants and full KYC evidence remain unverified. The
[payee plan §8](engineering/design/PAYEE_VERIFICATION_PLAN.md#8-connect-persistence-repair--2026-10-20-local-app)
records observed defects, actual RED/GREEN and provider/grants/unknown-save/status-order limitations.
Installed Accounts v2 types expose no affirmative identity/TIN results. Inferred flags would be
incorrect; calling the current `record_stripe_kyc` with unknown false values would supersede genuine
verification and accumulate pending history. Authoritative evidence/snapshot preservation remains open.


### 2026-10-20 — Failed photo-story cleanup (app repair)

The existing upload flow retires failed row/files before fresh retry/retarget; Close saves minimal
owner/reel intent before dismissing and the same account retries on Upload open. Stored committed
stories/cover are recovered without attaching new draft mentions. Account/visibility epochs isolate
callbacks; monotonic per-key intent revisions and late-hydration skip preserve explicit Retry.
SQL source, canonical append, schema/functions ownership and local privacy inventory are synchronized.
Independent Security/Backend/Data source review accepted the final client at 2026-10-20 18:52 UTC
(queue`31a333129fc7`, data`f75a40ff7336`, modal`28a1906663dd`, SQL`37b0dfcf0dfc`),
with SQL provisional only. Focused 3 suites / 62 tests PASS, both app typechecks PASS and 12 scoped app
guards PASS (documentation, copy, data boundaries/map, comments, feature metadata, unused code and
client-key/no-SSN checks). Full mobile suite PASS: 213 suites / 1,877 tests (105.399s).
Independent Documentation/Data review accepted at 2026-10-20 18:54:08 UTC after verification
wording/retention corrections; reviewers ran no tests. Exact canonical append and scoped whitespace
checks PASS, replay Python syntax PASS. SQL replay has not run because PostgreSQL startup/network acquisition were blocked by local OS permissions.
Migration is written, not applied; real Storage content/bookkeeping/deletion and races remain unverified.
Known unknown-id/process-loss/abandoned/closed-account/historical-path gaps are in the
[repair contract](engineering/design/PHOTO_STORIES_DESIGN.md#failed-upload-cleanup-repair--2026-10-20).


### 2026-10-20 — Athlete Story and primary-tab clarity (UX-07)

Shared headings, action feedback and fan navigation now support readable wrapping, header semantics,
44-point existing targets and OS Reduce Motion. The existing Highlights pane names only the caller-visible
authored biography/social fields as Story; its media empty copy describes public Highlights. Activity keeps
full actor/body text and exact amounts; Spotlight separates initial loading from empty; Drip explains empty
categories using published labels; Local/Beyond retain existing destinations and safeguards; Upload keeps
both existing composers with clear story/review copy. No new data, business action or reporting contract.
The original presentation exemption preceded implementation and the selected admin gate passed; the later selected local app-ready gate passed at its recorded UTC checkpoint.
Actual scoped source/privacy/accessibility review and local test receipts are in [UX-07](agents/UX-07.md).
Final post-Upload-scroll `pnpm check` passed: both app typechecks, 212 mobile suites / 1,849 tests and all included guards. Browser review uses current real components and synthetic subject data: Story wraps at390/320 CSS enlarged text; Upload choices and Cancel work with a44-point pinned Close and bounded scroll at320x640. A subsequent optional page open failed, with later DOM read successful; native/hosted, every-route visual coverage and engagement outcomes remain unverified.
Concurrent telemetry changes in Home are separate from this presentation review. The owner continues
other edits. The final source ensure and retry deferred on another capture lock (`sourceCurrent: null`, `readyToCutOver: false`); current-source backup verification retains the existing concurrency limits.

- 2026-10-20 · **Trivia funnel top.** `SportQuizPreparation` emits `trivia.view_prep` (mount, kind only) and `trivia.press_start` (Start tap, kind + topic; group theme never logged) via two new `trackTriviaStep` actions — existing event types, no client migration needed; demo never mounts preparation. Migration `20261020174500_reports_trivia_funnel_top.sql` (written, not applied) adds `prep_views_7d` + `start_presses_7d` atop the trivia key (full-body rewrite incl. 20261020180000, byte-verified: only 2 comment + 2 count lines differ; inline `schema.sql` edit, README + `SCHEMA.md`; apply after/instead of 20261020180000, rollback re-applies it). Portal Buttons tab gains viewed/presses tiles + labels + parsers. Viewed-but-never-pressed reads as friction, pressed-but-never-confirmed as technical. Tests: manager +1, screen journeys updated +1 (6), portal assertions; 35 suites / 411 tests mobile + 106/106 portal pass, typechecks + docs/data-map/comments/copy green. Not verified: hosted DB, devices.
- 2026-10-20 · **Health surfacing (behavior-logging Step 3).** Migration `20261020180000_reports_trivia_smoothness.sql` (written, not applied) adds `trivia` (7-day funnel counts, answers per question with a digit-guarded cast, starts per kind) and `smoothness` (mount/start counts, averages, avg mount per surface) keys to `get_admin_reports` — full-body rewrite including the 20261012180000 casts+bands (byte-verified: only the scroll comma + 53 new lines differ), inline `schema.sql` edit (no second copy, mirroring 20261012180000), README + `SCHEMA.md` updated; apply after/instead of 20261012180000, rollback re-applies it. Portal Health shows trivia funnel tiles on Buttons and smoothness tiles on Errors via conditional shared-model lenses (old callers byte-identical: 13 Expo suites / 159 tests pass unchanged), trivia key labels, and null-vs-zero parsers; 106/106 portal tests (7 new). Trivia keys fill on any DB; smoothness keys need 20261020173000 + the layouts flag. No data-map regen (same function/owner). Not verified: hosted DB, devices.
- 2026-10-20 · **Smoothness signals (behavior-logging Step 2).** Migration `20261020173000_telemetry_smoothness_events.sql` (written, not applied) whitelists `screen_mount` + `app_start` in `telemetry_logs` (copied onto `schema.sql`, README + `SCHEMA.md` updated; value list mechanically verified: all 10 old values kept, exactly 2 added; PGlite replay unavailable on this Mac, runs in CI). Client emits only while new `layouts.telemetrySmoothness` (default off; admin flips in Features after applying, so pre-apply batches never die on the CHECK) — `useScreenMountTime` on Home / Sport Pop Quiz / donate sheet plus a root cold-start effect, all async-flag-safe and silent when layouts are missing. New suites: manager smoothness (4), hook (3); touched areas 42 suites / 462 tests + portal 99/99 pass, both typechecks + docs/data-map/comments/copy/agents guards green. No funnel surfacing yet (Step 3); no UX copy changed.
### 2026-10-20 — Clearer Security report and accurate guard statuses (REDUNDANCY-07 continuation)

The report now uses readable helpers for input validation, ownership, guard evidence, source binding
and rendering while preserving its public functions and command contracts. A guard missing its
configuration, command, full-check inclusion or evidence now reports `needs-attention` in JSON and
Markdown; unrelated guards remain `source-linked`, all have `executed: false`. Four regressions
reproduced the old failure before repair. Actual local22 Security tests pass, including the real CLI
on synthetic inputs, private-input refusal and atomic/currentness checks. The report continues to
refresh through source sweeps and fails project/CI checks on missing coverage or drift. Independent
Security/Documentation review and new final full-project/source receipts are tracked in
[REDUNDANCY-07](agents/REDUNDANCY-07.md); no operational acceptance follows this cleanup.

The first complete gate failed at typecheck on a concurrent new screen-mount timing test using
async React Native Testing Library helpers synchronously. The concurrent owner had already awaited
renderHook/unmount before root read; root awaited only its two remaining rerenders. Actual targeted
3tests and both-app typecheck pass, with independent source/API review. Runtime timing code was
not changed by this repair. Original failure and new final retry receipts remain in the tracker;
Watchman-dependent ad hoc execution did not supply a test receipt, so the explicit no-Watchman
rerun above governs the scoped result.

Complete `pnpm check` subsequently passed210mobile suites/1825tests and all infrastructure gates.
Exact full-source capture refused the concurrent STATE change; the following attempt failed its
Security report drift gate after another session added a Reports migration. Those original failures
remain external. The owner chose to keep other edits running and report limits: local cleanup and
independent reviews are complete, exact latest-source verification is deferred, and automatic raw
source maintenance continues without inheriting the earlier successful code check. The watcher
was explicitly restored after one failed immediate restart; final read-only source/watcher/report
observations are governed by the tracker receipt, with missing/stale states kept explicit.

- 2026-10-20 · **Trivia funnel + error telemetry (behavior-logging Step 1).** New `telemetry.trackTriviaStep`: start/answer/next/complete/abandon/unavailable stored as `feature_tap` (`trivia.*`, surface `sport-quiz`, kind/mode/position/counts in payload; no question text, options, athlete/group or account identity) so existing Reports features/issues lists pick it up with zero SQL changes; start/answer/next/explanation failures go to `ui_issue`. Wired into `useTimedSportQuizRound` (incl. receipt-recovery answers and a start→unavailable order for missing content) and a result-keyed `SportQuizScreen` summary effect (the dev-only demo never mounts it, so it stays silent). New suites: manager unit (6), hook timer paths (2), screen journeys (5); 29 suites / 380 tests pass alongside all existing trivia/telemetry suites, typecheck clean. A concurrent session repaired two expectations in the new screen test (chapter DTO, exact retry) and logged it under REDUNDANCY-07. Not verified: hosted DB, devices; funnel surfacing on Health is Step 3.
### 2026-10-20 — Infrastructure Security ownership and current source report (REDUNDANCY-07)

Three Security specialists join the existing team: infrastructure/IAM/network/TLS, supply chain/CI/images,
and recovery/custody. All report to SECURITY -> CTO and coordinate with the existing Engineering owners.
A deterministic report maps every registered service and exit component to reviewers, hashes current
safe source/config, and keeps operational requirements unverified. Actual source notices carry Security
partners; source sweeps refresh awareness without completing review. Full project/CI gates include the
new local regressions and report drift/coverage check. Independent source review repaired host-bit IPv4
wildcard range checks, bound effective Compose credential settings to reviewed private inputs, and kept
nested registry credential config out of Docker source contexts. Actual local17 Security checks/115-role
structure checks pass. First full gate exposed two stale concurrent Trivia funnel expectations;
root repaired only the test to enforce the current chapter DTO and exact original uncertain-answer retry.
Targeted5tests pass; failed/retry receipt custody remains in the tracker. Final full source verification uses original external receipts in
[REDUNDANCY-07](agents/REDUNDANCY-07.md). No Terraform/Docker/provider execution, delivered incidents,
live security acceptance or unattended Security specialist is established.

### 2026-10-20 — Portable app connections and local contracts (REDUNDANCY-06)

Both Expo and Next use one pure public connection validator at the current client boundaries;
missing/unsafe config stays unconfigured, existing auth/session/cookie/MFA controls remain. A fresh
private profile emits matching client/server origins and public keys without copying source secrets
or installing configuration. Actual installed SDK protocol tests run entirely on synthetic loopback;
full `pnpm check` now includes `pnpm portability:test`. Original source/export/watch/CI carries the
new code and regression tests. Guide: [PORTABLE_INTEGRATIONS](engineering/PORTABLE_INTEGRATIONS.md).
Actual local24 scoped tests and both app typechecks pass; build/full verification is governed by
[REDUNDANCY-06](agents/REDUNDANCY-06.md) external receipts. Real SQL/RLS/Auth/OAuth/MFA/Realtime/Edge/
provider interoperability and measured migration readiness remain separately unproven.


### 2026-10-20 — Private backup setup and operational exit health (REDUNDANCY-05)

Prepared a fresh private external setup at `/Users/seiuliian/Downloads/ala-sports-backup-setup-20261020`:
organized config/credentials/state/data placeholders, exact initial template hashes and700/600 modes;
no secrets or live source data copied. `pnpm exit:health` reads exact source/code/map/process/original
sweep clocks, original-source-bound backup age and strict prepared evidence. Default/no private
configuration stays NO-GO; reports always keep `readyToCutOver:false`. Backup jobs/status now reject
same-path origin/PG routing drift and unbound/other-source retry proof. Actual code/full-check/review
receipts in [REDUNDANCY-05](agents/REDUNDANCY-05.md). This machine lacks pg_dump/pg_restore/psql/age/Docker;
backup credentials/encryption recipients/destinations/readiness and hosted rehearsal remain pending.


- 2026-10-20 · **R4-03 first file split: ReelCard.** The video player (`components/Reels/ReelVideoLayer.tsx`) and the live play callout (`PlayBroadcastBanner.tsx`) moved out of `ReelCard.tsx` unchanged (1,341 → 1,124 lines); unused imports removed. Typecheck, `code:unused`, Reels 90/90 pass. Not verified: devices / browser playback (no behaviour change intended).
- 2026-10-20 · **Guests can read live Rallies again (local, SQL not applied).** The rallies read policy called `rally_manager_role()`, which guests may not execute (revoked since the original Rally migration), so every guest read failed with 42501 and guests saw no Rally meter. `supabase/migrations/20261020090000_rallies_guest_read.sql` splits it into "Read public rallies" (anon + authenticated, live / filled / closed) and "Managers read own rallies" (authenticated); signed-in visibility is unchanged and the function stays closed to anon. Copied onto `schema.sql`; replay adds guest / fan / admin checks (123/123; the guest check failed before the fix). Found by the exit plan's access parity. Not verified: hosted databases, devices.
- 2026-10-20 · **Exit plan: version tracking, same-data proof, production infrastructure (REDUNDANCY-02 follow-up, Claude).** `infrastructure/migration/access.sql` + `parity.py`: access parity reads every app table as guest / three users / admin through RLS and blocks any difference (PGlite 14/14 incl. an `auth.uid()` drift caught only by access parity; real PostgreSQL 18.6 client drill 12/12, re-run 2026-10-20 against Codex's REDUNDANCY-03 catalog, PASS with 82 identity reads). Fingerprints pin `search_path` and `row_security`. `exit-map.json`: 24 tiered components (load balancer, cache, CDN, WAF/DDoS, pooler, network, DB HA/PITR, replication, DNS indirection, CI/CD, cost guard), topology, migration strategies, T-30…T+7 cutover with rollback, protection controls. `pnpm exit:status` / `exit:preflight` (gate later hardened by Codex). Coordinated with Codex REDUNDANCY-03/04 after a concurrent-edit stop (owner chose: Codex finishes, Claude verifies); `pnpm check` exit 0 after both.
**2026-10-20 — REDUNDANCY-04 final local source handoff:** direct `pnpm check` PASS205mobile suites/1,805tests and91exit checks; independent crash/process/retention/privacy review and Documentation handoff accepted. Current-login watcher restart/status and private latest source pointer recorded in [REDUNDANCY-04](agents/REDUNDANCY-04.md). OS login autostart remains blocked; live backup/cloud/runtime/timed readiness unproved.

**2026-10-19 — REDUNDANCY-04 (Codex):** initial/restart+30s content source sweeps, exact external source snapshots, private latest/attempt/catalog, OS crash-safe lock and journaled keep3 retention; all-branch/PR/manual/default-daily CI preserves modes and run provenance. Raw source copies do not grant code/data/service readiness; actual activation/full checks in [REDUNDANCY-04](agents/REDUNDANCY-04.md).


**2026-10-19 — REDUNDANCY-03 (Codex):** exact expanded source/capsule export and unchanged-name content drift, immutable runtime archives and optional stable API gateway, historical Storage bytes-before-guards/owner reconciliation, exact service/Auth parity coverage and strict original-evidence readiness. Same app/self-hosted Supabase exit A;180minutes unproved. [EXIT_READY_RUNBOOK](engineering/EXIT_READY_RUNBOOK.md), [actual assignments/reviews](agents/REDUNDANCY-03.md). No cloud/provider/live SQL or hosted restore run. Final local verification recorded in tracker.

- 2026-10-19 · **Redundancy & Exit team and the self-updating exit plan (REDUNDANCY-02, owner request).** New registry agents (Engineering): `REDUNDANCY_LEAD` → `EXIT_SYNC` (keeps the backup version and exit plan current with every app change and tells the team), `EXIT_DATABASE` (the different database), `EXIT_SERVICES` (Auth / Storage / Realtime / functions replacements), `EXIT_CLOUD` (AWS / Azure build); roster 107 → 112, registry / TEAMS (contract item 13) / hierarchy / expert standards / department plans / AGENTS.md / queue updated, support Team flow topology regenerated. `scripts/exit-map.mjs` + hand-kept `docs/engineering/exit-map.json` generate [EXIT_INFRASTRUCTURE_MAP](engineering/EXIT_INFRASTRUCTURE_MAP.md): 12 components × exit A (self-hosted Supabase) / exit B (cloud-native) × AWS / Azure, owners, detected inventory, 11-step build order, plan version `6f6ff010e985`. Automation: a second project Stop hook (`scripts/exit-map-guard.sh`) regenerates the map at the end of every Claude session and asks once for an announcement; `pnpm exit:map:check` (in `pnpm check` and CI) fails on a stale map, an Edge Function outside the self-host allowlist, an unmapped Auth method or an unannounced change; `pnpm exit:map --acknowledge --by "<session>"` writes the routed notice to [EXIT_CHANGE_LOG](agents/EXIT_CHANGE_LOG.md). The recovery source capsule now carries `exit-map.json` and the baseline. Charter: [REDUNDANCY_TEAM](engineering/REDUNDANCY_TEAM.md). Change simulation proved detection and revert; `pnpm check` exit 0. Not done: hosted backups, cloud accounts, a hosted drill (owner gates unchanged); agents run only when a session performs them.
- 2026-10-19 · **Database migration checks for the AWS / Azure exit (REDUNDANCY-01, local).** New `infrastructure/migration/`: `toc_review.py` drafts the reviewed `pg_restore` list `restore.py` requires (keeps application objects in every app schema, migration history and the app's policies/triggers on Supabase tables that the bare target lacks; comments out managed objects, Storage rows, Auth sessions and unknowns; refuses a list missing a source table or the Auth rows public foreign keys need). `parity.py fingerprint` reads one read-only snapshot (`catalog.sql`); `compare` blocks any structural, security, sequence, realtime, migration-history or row-hash difference; `grant-sync` writes privilege-only SQL. **Finding:** a restore onto a Supabase stack hands back what the source revoked, because `pg_dump` records privileges relative to PostgreSQL's default while the stack's default privileges grant everything (2,059 rights in the drill, e.g. anon DELETE on `athlete_birthdates`); the runbook now requires `grant-sync` and a parity PASS. Proofs: 27 unit tests (in `pnpm redundancy:test`), PGlite parity 13/13 (added to CI), real PostgreSQL 18.6 client drill 12/12 against PGlite servers (native PostgreSQL cannot start on this Mac: System V shared memory is blocked by policy). Runbook, implementation plan, `infrastructure/README` and [REDUNDANCY-01](agents/REDUNDANCY-01.md) updated; `pnpm check` exit 0. Not verified: a hosted source, the pinned Supabase images as target, Auth sign-in with restored users, a timed RTO.
### 2026-10-19 — Backup job operations (REDUNDANCY-01 continuation)

Continued the approved recovery build with one private-config capture/publication job, exclusive locking, atomic attempt/success records and all-destination completion. Added capture-time freshness monitoring, complete-record consistency checks and separate cloud-reader retrieval against a protected original checksum. Independent review found false healthy records and the Azure partial retry trap; fixes and fresh evidence are recorded in [REDUNDANCY-01](agents/REDUNDANCY-01.md). Registered bounded job/retrieval exports and a partial recovery sensor; operator setup is [BACKUP_OPERATIONS](engineering/BACKUP_OPERATIONS.md). Verification: fresh `pnpm check` passes205mobile suites/1,805tests,52backup/14deployment/7host checks and13source tests; private synthetic monitor CLI exercises exits0/2/3; full1,429-file source capture/verify/isolated restore includes all operational files. Independent operations/source review has no remaining concrete finding. No hosted backup, scheduler/alert activation, cloud resources or database movement ran.

### 2026-10-19 — Supabase recovery and AWS/Azure migration preparation (REDUNDANCY-01)

Owner confirmed backup **of** Supabase for restoration on owned AWS/Azure servers. New `infrastructure/` separates backup/verification/reviewed restore, web/API and standalone portal containers, upstream Supabase preparation and per-cloud Terraform. Source capsules now include reviewed infrastructure, dependency-layout config and required JSON while rejecting credentials/state. Full-data tools reconcile all Storage paths to database inventory and encrypt archives with age; restore records a committed-database receipt for guarded Storage-only retries. New operational exports are owned in the master data map; infrastructure register and recovery/portability/runbooks are linked. Current Supabase projects and existing unrelated dirty changes are preserved. Verification: `pnpm check` passes205mobile suites/1,805tests,13source recovery tests and39backup/deployment checks; full1,419-file source restore passes. Next standalone build and Expo production web/API export pass with synthetic public configuration; actual Expo host serves fan HTML and denies unauthenticated checkout. Hosted backup/restore, upstream version/image verification, Docker/Terraform validation, monitored scheduling and measured RPO/RTO remain pending; see [REDUNDANCY-01](agents/REDUNDANCY-01.md).


- 2026-10-19 · **Full check green again; five hooks off the database (R4-03).** `pnpm check` had been red since the SDK 58 upgrade (`ccf2516`, 2026-10-16). Later sessions ran only targeted suites, so the 196 / 1,744 count above went stale. Found: a typecheck error in `highlights.test.ts` and 18 failing Jest suites (113 tests). Fixes, all test-side unless noted: `jest.setup.js` counts icon fonts as loaded (SDK 58 `expo-asset` threw "Module 1 is missing from the asset registry" on the first Ionicons mount, about half the failures); runtime mocks gained `layouts`, router mocks `useIsFocused`; the ReelCard test now expects an inactive neighbor to have no `VideoView`, and the photo-tier test expects the coach-label tier; the gesture handler 3 `FlatList` is mocked in `PhotoStoryMedia`; FamilyFun tests clear the saved Not now week between tests; the web report test mocks `expo/src/winter/fetch/fetch`. **App fix:** `SportQuizRound` called `useAuth` and awarded 5 Aura on a right answer, so the dev-only trivia demo ("nothing is saved") would add real Aura for a signed-in tester and crashed without an auth provider. The round now takes `auraUserId` from `SportQuizScreen`; the demo passes none (2 new tests). R4-03: `useFanTipHistory`, `useReceivedMalo`, `useRoster`, `useAthleteSubscription` and `useSubscriberRequests` now call `lib/donationHistory.ts`, `lib/subscriptions.ts` and `lib/roster.ts` (behaviour unchanged; `hookLibMoves.test.ts`, 10 tests). Direct calls outside `lib/` 48 → 39; register and data map regenerated. Final `pnpm check` exit 0 (205 suites / 1,805 tests, every guard) with another session's REDUNDANCY-01 files present and untouched; portal tests 99/99. Not verified: devices, browser.
- 2026-10-18 · **Admin two-step sign-in (SCALE-01, switch off).** Owner approved the start. With `NEXT_PUBLIC_ADMIN_REQUIRE_MFA` on, portal `middleware.ts` (every request, decoding the `aal` of the token `getUser()` validated) and `(protected)/layout.tsx` (server re-check through `mfa.getAuthenticatorAssuranceLevel(jwt)`) send a non-`aal2` admin to new `/login/mfa`: set up an authenticator app (QR + setup key) or enter the code. With `EXPO_PUBLIC_ADMIN_REQUIRE_MFA` on, Expo `AdminShell` holds desks behind `Admin/AdminMfaGate` (Studio unlock without an account no longer opens desks). Shared rule `packages/shared-types/admin/adminMfa.ts`; Supabase calls in `lib/`. Off (default) = unchanged; an offline smoke of a built copy showed the same Auth / profile calls. Portal tests 99/99, new Jest suites pass. Not verified: TOTP is not on any hosted project, so enroll / verify never ran against Supabase; browser / device. RLS still accepts `aal1`; the off-host audit log and account MFA stay open. [ADMIN_MFA](engineering/ADMIN_MFA.md).
- 2026-10-18 · **SCALE-03: live scores without the refetch storm (local, switch off).** `useLiveScores` now runs through `lib/liveScoreSync.ts`. With `EXPO_PUBLIC_LIVE_SCORES_BROADCAST=true` it joins private Broadcast `game_scores_index` plus `game_scores_{id}` per listed game (40 max, the rest poll once a minute) and merges each change by the new server-owned `games.live_seq`: duplicates and older messages are dropped, a gap, an unknown game, a membership notice or a reconnect schedules one jittered reread. Switch off (default), or a refused private topic, keeps the old `postgres_changes` → full reread. Migration `20261018120000_live_score_broadcast.sql` (BEFORE/AFTER triggers on `games`, receive-only `realtime.messages` policy, no client send) is written and copied onto `schema.sql`, **not applied**. RLS review written in [SCALE-03](agents/SCALE-03.md); hosted negative tests and the game-night load test still need hosted access. Not verified: any hosted Realtime behaviour, devices.
- 2026-10-18 · **Environments plan matches the testing app.** [ENVIRONMENTS_AND_HOSTING](engineering/ENVIRONMENTS_AND_HOSTING.md) no longer says development lacks the September SQL. Development has the catch-up; staging does not. There is no production project and no cache server. The scalability ladder names the laptop, development, staging, production, a managed video host, and the AWS exit, with the role that tends each rung. `INFRASTRUCTURE` updates those facts when the testing app’s host or caps move. The capacity packet stays with `GROWTH_ANALYTICS` (next review 2026-10-20). Nothing was bought.
- 2026-10-18 · **Home stops paging empty sample cards once a real clip exists.** The five built-in names stay for the spotlight fallback and for a feed that has no file yet. A photo story still needs at least one photo. Development rows still share one surviving video file.
- 2026-10-18 · **Home plays one Highlight at a time.** The card on screen keeps the decoded video. A mounted neighbor drops that file and shows a poster. A new upload still stops at 45 seconds, and now also at 8 MB, with the compressor at about 1.2 Mbps so a full-length clip fits. On the web, the server and the first browser paint share a shell, then the feed mounts. Trivia on Home and profile stats, donations, and the Aura subscription wait until that screen is open. Activity already waited for its tab. No quiz SQL and no server Aura trigger. Not measured: real-device memory or frame time.
- 2026-10-17 · **Workout challenges left the profile scroll.** Mute, private badges, and the data export open from Account settings → Workout challenges. The profile keeps the Filmer card. The paused notice and the private-badge wording stay in that sheet.
- 2026-10-17 · **Fan Zone and Beyond are on development.** The first apply stopped because postgres cannot create an index on `storage.objects`. A probe showed postgres can create a trigger there, so those two index lines were removed from the unapplied files and from `schema.sql`. `(bucket_id, name, version)` is already unique. Both files then applied: private buckets `fan_zone` and `beyond_game`, plus `fan_zone_storage_guard` and `beyond_storage_guard`. Switches stay off until an admin turns them on. Coach-level `20261017090000` was not run.
- 2026-10-17 · **Development catch-up applied through trivia and IQ.** This Cursor session ran the written files on development `ulfapgtabidorgwfjvwz` with `supabase db query` (not `db push`) and recorded each success. Privacy, minors, payee checks, sport quiz, timed trivia, play-together, both banks, Life Playbook, fresh questions, workout challenges, life-lesson questions, and the IQ file are on development. The question bank has 123 rows and 198 `quiz%` functions. `guardian_links` exists. Two files stopped and rolled back: Fan Zone (`20261014130000`) and Beyond (`20261016120000`), both because the `postgres` login cannot own `storage.objects` (index and trigger). Coach-level `20261017090000` was not run. Before timed trivia, `public.digest` was pointed at `extensions.digest` because pgcrypto lives in `extensions`. Privacy re-ran after `Public Read Profiles` and `Users can read own stripe data` were dropped. Home highlight rows now play the one surviving guest file; the missing originals are still 14-byte placeholders. Quizzes stay paused until an admin turns a round on. Look → Daylight is still a separate admin step. Staging was not touched. Receipt: [DEV_DATABASE_CATCHUP](engineering/DEV_DATABASE_CATCHUP.md).
- 2026-10-17 · **Health names syntax, logic, and glitches.** The portal Health page reads Engineering Support and counts open failures in those three groups, plus everything else. Fan Zone and Engineering Support join the waiting-database list. Trivia’s row notes the IQ file and the 5 Aura award. Product lists the Expo desks this portal does not host. Review stays in Expo `/admin/support`.
- 2026-10-17 · **Search text stays inside one filter.** Local search, team autocomplete, and live-match channels no longer paste typed text into a PostgREST filter string. A period or comma cannot open a second clause. Database functions still receive the text as a bound argument. Jev is not on this path.
- 2026-10-17 · **Highlights profiles and Local open again.** SDK 58 was sending hidden tabs back to Home, so the athlete name and the Local pill never stayed. Those routes keep a real address and stay off the bar. The trivia side notice appears only when a round can start. A right answer adds 5 Aura to the card. Six IQ questions are written for the weekly mix (`20261017110000`); that file is not applied.
- 2026-10-17 · **Missing database updates leave the fan screen.** Activity no longer shows the red “not switched on” line for challenge invites. The same sentence stays off workout challenges and challenge settings. Expo admin Home and the portal Health page (`/operations`) list the waiting control, the migration file, and the Expo desk. Real errors, such as a failed inbox read, still show. SQL stays unapplied.
- 2026-10-17 · **Coach-level and Rally share handoff.** The owner asked for the chain of command. HIGHLIGHTS owns the local badge, switch, report and share sheet, reporting through ENGINEERING to the CTO. Design, Trust & Safety, Legal, Rally and Spotlight duties now match that. The share sheet is no longer on the Later list. Counsel, an independent safety review, and migration `20261017090000` stay open. Receipt: [COORD-01](agents/COORD-01.md).
- 2026-10-16 · **Coach-level label and Rally share (local).** A Train Like Me upload or Beyond workout can be marked “Advanced move: needs a coach or spotter.” The badge “Coach-level move” stays visible, including for guests. “Risky without a coach” goes to reviewers and does not hide the clip. The Highlights desk adds or removes the label with a reason; a missing migration shows unknown, never zero. `layouts.coachLevel` hides the switch and that report reason. Migration `20261017090000` is written, not applied. A filled Rally offers “Share this Rally” (gift link when the athlete has a handle). A board with a leader offers “Share the leader.” No donation amounts. Counsel has not approved the wording. Labelled workouts still allow “I’m in” and invites, and show the notice. Teen pre-publish review is not built.
- 2026-10-16 · **Trivia names the week.** The Highlight card says sports or off the field from the subject the server already scheduled. A finished mix-mode round says whether next week is sports or off the field. A round with a new fact says “Take one fact to dinner.” No streak. Hosted SQL stays unapplied.
- 2026-10-16 · **Trivia teaches life lessons.** The Highlight card says “This week’s five.” Play and Not now clear it until the next week. A finished round says the next subject unlocks then. Fifteen draft questions cover American history, electrician and construction facts, and practice fuel (general facts, not a meal or training plan). Migration `20261016220000` is written, not applied. Donate. Elevate. Celebrate. stays the brand line.
- 2026-10-16 · **Highlight trivia invites a play.** The side card asks “Play this week’s round?” with Yes, let’s play. A failed availability read retries on its own. The card no longer asks the player to refresh.
- 2026-10-16 · **Trivia and Fan Zone keep the fan bar.** Sport Pop Quiz, Fan Zone, and the trivia preview pin Home, Activity, Upload, Spotlight, and Profile to the bottom. Leaving from the bar still ends an open trivia round. Account Home stays at the top for a parent, operator, booster, or sponsor.
- 2026-10-16 · **Trivia results sit on one phone screen.** The cheer and the facts medal share a row with the “you learned” line. Each question is a short jade, gold, cyan, or violet card with a bright result chip. Demo controls stay on one row.

- 2026-10-16 · **Trivia and Fan Zone play fit a phone.** Both pages stay within a phone width. A live trivia round fills that stage: gold question, large answers, violet progress. Fan Zone paths stack, and a ballot is the bright button.

- 2026-10-16 · **Trivia hangs on the Highlight; Fan Zone sits on Beyond.** Home no longer stacks Fan Zone and Sport Pop Quiz over the clip. Trivia shows as a bright gold and violet notice for a few seconds, then tucks to a tab on the left. Play opens the quiz and starts the round when the trivia notice is already saved. Fan Zone discovery is on the Beyond page.

- 2026-10-16 · **Live-match plays celebrate first.** Opening a play on a live match shows Seki, Aura and Flex. Donate is a button on that card. The amount, options and review pages open only after that tap. Back to celebrating returns to the reactions.

- 2026-10-16 · **Highlight family notices fit the clip.** Fan Zone and Sport Pop Quiz on Home sit in a short dark card under the pills. Refresh stays the main button. Open and Not now share one row, so the two notices no longer cover the Highlight. Parent, booster, sponsor and operator homes keep the light card, with the same shorter row.

- 2026-10-16 · **Combined-branch tests repaired.** The merge left eleven Jest failures. Guardian activity now describes a fun-fact approval instead of a public-profile change. The Family Fun operator test stubs live game updates. The finance catalog lists the two-admin payout flag once. Fan Zone fixtures keep the vote window open relative to the clock, so opening a campaign and casting a ballot still run after 2026-10-16. The private video upload now goes through `lib/fanZone.ts`. The investor memo links to `docs/company/press/`. The data map now includes `fan_zone_private.upload_allowed`, and test-only fixtures are recorded as kept. Duplicate agent rows in the registry were folded back to one row each, keeping the longer task list. The infrastructure register now claims the private `fan_zone` bucket and the three Fan Zone media routes. `pnpm check` exit 0 (196 suites / 1,744 tests). Hosted SQL stays unapplied.

- 2026-10-16 · **Fan Zone and trivia joined the main line.** `codex/fan-zone` is merged into `main` (GitHub `de2d70d`, then this repair). Home shows Fan Zone discovery beside the Beyond switch. Guardian supervision keeps workout-invite counts and fun-fact approval. Schema replay source includes the quiz tail, and the guardian summary counts both. The three older Cursor branches were not merged: they restore docs and payment files this line already replaced. Mobile `tsc --noEmit` passes after the repair. Not done: hosted SQL, a full `pnpm check`, and deleting the old GitHub branches.

- 2026-10-16 · **PLAY-01 locally verified and closed.** Re-verified every locally checkable claim on the current tree: PLAY-01 marker confirmed in the installed expo-video 57.0.5 build that the app resolves to, offline frozen-lockfile validation re-passed, Reels 9 suites / 89 tests, full `pnpm check` exit 0 (150 suites / 1,197 tests), portal 86/86, web + iOS (9.4 MB `.hbc`) + Android (9.5 MB `.hbc`) exports pass separately, `git diff --check` clean. PRIV-01 tagState handoff done (one prop; approved/pending tag chip now shows on Highlights; typecheck + 89/89 re-pass). PLAY-01 releases `ReelCard.tsx` / `reelPlayback.ts` / `lib/reels.ts`; the coordinated commit pass may treat it as released alongside DETECT-02. Still open, all owner-gated: final browser interaction, device playback, clean install, ENV-02 hosted media probe. Evidence in [PLAY-01](agents/PLAY-01.md).
- 2026-10-16 · **Beyond follow-up: development catch-up, safety label, phrase test, docs (owner choices, local).** Owner chose development first for Beyond posting, committing everything now, testing all four phrase candidates and starting the safety-label design. Read-only checks of development found its migration history ends 2026-09-23 and only `custodial_money.sql`, `leaderboards.sql`, `tip_origin.sql` and `clear_reel_hype.sql` are missing among the prerequisites the 27 migrations reference (every other referenced object exists). New [DEV_DATABASE_CATCHUP.md](engineering/DEV_DATABASE_CATCHUP.md): 31 ordered steps with record lines and after-checks — **not run** (read-only access; owner runs it). SAFETY-01 "Coach-level move" enrolled in `feature-admin.json` as planned with [design](engineering/design/COACH_LEVEL_LABEL_DESIGN.md) (wording options for Legal, uploader switch, reviewer add/remove, report reason that never hides, label always visible); LEGAL row AC; phrase test in FAMILY_FUN_PLAYBOOK; GLOSSARY, TESTER_SCRIPT, ROADMAP, WORK_QUEUE, MENU_STYLE_MAP, docs index, BEYOND-01 and §0 / §5 / §6 updated. No app source, schema or hosted change in this pass. Not done: running the SQL, uploading real workout clips (needs a truthful rights confirmation), device checks.

- 2026-10-16 · **Beyond moves to the Highlights pill row (owner decision, local).** Owner: Beyond media is like Highlights, put it next to Home and Local, keep fan posts that are not athlete Highlights on the Beyond page, offer both kinds on Upload ＋, keep uploading simple for every user. Home bar is `Home | Beyond | Local →`; Beyond plays Train Like Me + Serve Like Me Highlights in the same pager (Donate/hype/Spotlight unchanged) with a link to the Beyond the Game page and a Share / Open Beyond empty state. Beyond left the bottom bar (now Home · Activity · ＋ · Spotlight · Profile; FAB label `Upload`). New `Reels/UploadChoiceSheet` asks Highlight or Beyond moment only while `tabs.beyond` and the Beyond contribution switch are on; Beyond moment opens `/beyond?compose=1`, which starts the composer only after the server allows submitting. Beyond page has a back button. Supersedes the 2026-10-15 bottom-tab placement (design doc and [BEYOND-01](agents/BEYOND-01.md) updated). No schema / RPC / money change. `pnpm check` exit 0 (150 suites / 1,197 tests; DATA_MAP regenerated). Browser Bridge 390×844 checked on development (evidence `.smoke/beyond-move/`); the chooser shows only where contributions are on, so it is test-verified only. Not verified: native devices. Known: development has no workout/service clips, so the Beyond switch shows only the built-in samples; follow-up the same day: the TRAIN LIKE ME / SERVE LIKE ME badge now sits below Home's banners and pill row (owner-approved one-line `ReelCard` edit, logged in [PLAY-01](agents/PLAY-01.md); Reels tests 89/89). Turning on Beyond posting on development needs all 27 September–October migrations (none are applied there; read-only check 2026-10-16), so it waits on an owner decision.

- 2026-10-16 · Whole-team source/documentation updates applied:107 role definitions now carry current handoffs;33 registry task descriptions and four shared team documents corrected with identities/tools/models/reporting/ownership preserved. Documentation/roadmap/Calm-versus-UX06 and dated legal annotations accepted; Team flow/DATA_MAP regenerated (83 tables/views,325 functions,0 rules). Retained scan 2026-10-16T13-54-21-798Z-49865227-final EXIT0:148 mobile suites/1,188 tests plus86 portal tests,213 docs,107 roles. The owner explicitly approved keeping the applied Stripe-only Finance Operations §7 paragraph; final local checks passed and scoped claims are released; [TEAM_STATUS](agents/TEAM_STATUS.md) records the exact state. No hosted change or external/staff acknowledgment is claimed.

- 2026-10-15 · **Calm Island colour refresh (owner choice, local).** Owner asked to use Figma and Playwright to improve the look. Playwright cannot launch Chrome on this Mac (§3), so screens were captured with Browser Bridge (before/after: `.smoke/redesign/`). Figma file [Tapua'i — Look & colour refresh](https://www.figma.com/design/cDRhK3YezniS4ODfrA8bVl) holds one phone screen bound to a four-mode colour collection (current, A Calm Island, B Ocean Night, C Tapa Sunset; all text pairs WCAG AA ≥ 4.5:1). Owner chose **A** plus three fixes. Code: `theme/motion.ts` FOCAL (canvas #F7F6F2, ink #14191B, deep jade #0B6E4F, glow #2EE59D, gold ink #7F5A00, LIVE ember #C8102E/#E5213F, video #0E1315); `TAB_ACCENTS` all jade except Spotlight gold; `hypeFx` glows; `constants/theme.ts` roles and `DAYLIGHT_THEME`; the Look desk Daylight preset now spreads `DAYLIGHT_THEME`. Fan bar: one jade accent on every tab, white surface, deep-jade Upload with a white plus. Removed the page corner decoration (`MenuBackdrop` no longer in `TabScreen` / `ScreenShell`; sheets keep one wash without the gold/violet dots). One chip look: `FilterPills` (ink selected / white outlined idle, per-screen `accent`/`mist` props removed), Beyond chips and game alert chips. Beyond discovery/legacy and ChallengeInbox/Settings hide unavailable refresh controls; ChallengeBar and the contribution composer retain their existing disabled/read notices. `PRODUCT_FACTS.md` regenerated; MENU_STYLE_MAP updated. Aura tier colours, admin desks / report palette and the Next portal are unchanged. `pnpm check` exit 0 (148 suites / 1,188 tests and all guards). **Still needed:** the development database's published runtime theme (read-only check 2026-10-15: background #F4F7F5, jade #00733C, gold #8A6400, text #0F1416) overrides those five colours, so publish Look → "Daylight (default)" from Expo `/admin/look` on each environment to finish the switch; staging was not checked. Not verified: native devices, iOS/Android rendering, a design review by DESIGN / ACCESSIBILITY on real screens.

- UX-06 local first polish pass accepted: compact Beyond category controls, grouped caption/media/audience/full-consent form, token-based buttons and legacy workout cards; shared Challenge controls restyled and absent-publication copy corrected. Retained detection scan EXIT0 (148 mobile suites / 1,188 tests + 86 portal tests); visible Learning & STEM → Workouts switches and 320/390 category layout fit verified. Independent legal/content source and Documentation reviews accepted six frozen files; selected app-ready gate passes, all scoped claims released. Existing actor/permission/consent/retry/media/export logic retained. Screenshots differ in source state; configured composer/content, native/accessibility, hosted release, remaining app/admin/Figma polish stay open. [Tracker](agents/UX-06.md).

- BEYOND-01 / CHAL-01 final local handoff: both selected app-ready gates and current admin rechecks EXIT0; independent Documentation/VP/Data/SUPPORT accepted the final status/source scope. Post-status docs210/DataMapcheck/23sourcehashes pass; all scoped claims released. Local plan complete. Hosted SQL/device/media/Utah legal launch, continuous sensors and later Vault work remain explicit next-owner gates.


- BEYOND-01 / CHAL-01a final local source accepted and full retained detection scan EXIT0 (148suites/1,188mobiletests +86portaltests; alltypes/guards,7features/107roles). Actual57Beyond/46CHAL canonicalreplays, generatedData/DB exact, source frozen. App evidence timestamps later than preserved admin checkpoints; selected gates and Documentation/VP closeout follow in task ledger. No hosted/native/currentlaw/providerdeletion/launch claim.


- BEYOND-01 canonical exact final source and generated database types refreshed (80tables/3views/295names296signatures); Data map325functions/0rulefailures. Root real canonical/reapply Beyond57/57 and CHAL46/46 pass. Navigation retained regression fixture initially lacked a host press handler; real fiber callback exposed1failed/3passed, restored lifetime guard. Final full checks/independent handoff follow.


- BEYOND-01 final legacy integration fixes actual retained-profile and Unicode RED2failed/5passed; actor/focus/background read lifetime rejects old navigation, codepoint caps match PostgreSQL. Independently accepted new legacy SQL57/57 mirrored exactly, Data ownership registered. Final root consumer/whole-project checks pending.


- BEYOND-01 independent review repaired fan-layout reach for parent/operator/booster/sponsor roles: actual RoleGate RED4failed/5passed before expanding only the fan layout to supported roles. Protected role-group gates unchanged. Legacy SDK/card tests GREEN5/5; schema/source/privacy acceptance pending.


- BEYOND-01 root participant integration: dedicated route plus bounded minimal actor-bound legacy cards/profile support links and CHAL-01 workout bar. New SDK/UI missing-module RED retained before implementation; narrow SQL read contract is being verified. Actual FanTabBar UI GREEN2/2 after awaiting RNTL async events; no browser/device certification.


- BEYOND-01 navigation implementation follows the actual FanTabBar RED (2 failures): five destinations, full accessible Beyond name, existing Upload slot, runtime disable, and Drip Profile entry. Local UI verification pending; no hosted change.


- BEYOND-01 actual local admin-ready checkpoint and selected gate PASS0: frozen source25coveringtests, real canonical/reapply46/46, independent Data/Engineering/SUPPORT/Infrastructure acceptance, catalogue80tables/3views/294functionnames295signatures. Participant tab/composer now authorized; hosted/provider/native/counsel limits remain open.


- CHAL-01 participant source review identified legacy unbound accepted-friend read. Root adds strict bounded expected-actor SDK fetchChallengeFriends (RED1failed/11passed then GREEN12/12); Engineering adds matching16thRPC/server probes; Growth switches picker and fixes synchronous background invalidation after actual lifecycleRED. Existingadmin checkpoint preserved; this sourceextension is reverified before app-ready.


- CHAL-01 participant integration after selected admin gate: root mounts actor-isolated ChallengeInbox on Activity and ChallengeSettings on own Profile. Growth owns newcomponent/hooks/tests; publicprofile/heldplayers untouched. Participant verification stillpending. Beyond discovery/participation waits its separate admin gate.


- CHAL-01 actual local admin-ready:42SQL probes, final2suites31tests/mobiletypes0, independent Data/Development PASS; selected admin-ready metadata gate0 after normalizing actual UTC timestamps to registryformat. Participant production now authorized. Beyond remains separately planned.


- BEYOND-01 frozen new migration/replay43/43 on real local PGlite; root appended exact canonical block after unchanged CHAL block and registered6tables/private bucket/RPC/export/erasure ownership plus privacy/schema/migration notes. Maps/types refresh and independent source/admin acceptance follow. No hosted SQL or participantstart.


- BEYOND-01 admin integration: new protected BeyondGamePanel mounted beside WorkoutChallengesPanel in existing Highlights desk; operational source/admin verification remains pending. No participant tab/source started yet.


- Independent CHAL review reopened known-closed admin UI and null/malformed successful SDK source findings. Growth fixes closed/reopen lifetimes; root adds strict15-endpoint source validation, observed RED5failed/6passed then GREEN11/11. No healthy zero/saved acknowledgment from unavailable JSON. Private quota/expiry/audit erasure boundaries added to DATA_PRIVACY_MAP. Admin acceptance still pending actual re-review.


- BEYOND-01 control map enrolled: Beyond filters/contribution/reports/own data, CHAL response/inbox/settings linked to existing Highlights desk with explicit no new telemetry. Root regenerated local CHAL catalogue types;42/42 backend replay and3suites/29tests covering SDK/runtime/admin PASS. Pending Beyond source remains outside current acceptance.


- BEYOND-01 root integration: required caller-captured canonical profile IDs on all CHAL SDK reads/writes; authenticated server actor binding rejects late JWT/account switches. SDK payload RED observed2failed/4passed; GREEN and independent review follow. Runtime Beyond discovery/default-off contribution flag tests4/4 PASS. No participant implementation before admin-ready.


- 2026-10-15 Denver / October16UTC: BEYOND-01 enrolled before source; dedicated tab/private reviewed fan media enrolled; source/admin Beyond runtime flag and navigation fallback implemented after actual three-test RED. Exact producers/claims and CHAL repair gates recorded; participant gates pending. [BEYOND-01](agents/BEYOND-01.md).
- 2026-10-15 · **QUIZ-05 Fresh questions (local; admin-ready then app-ready).** Owner: keep trivia fresh, self-healing and creative; athletes can consent to share fun facts as a small share of the pool. Migration `20261015210000_trivia_fresh_questions.sql` (not applied):
  - Self-healing: report a problem with anti-brigading rules and auto-pause; fun-fact safety reports always pause; quality flags with type-aware thresholds; difficulty bands; server-stored answer shuffle; weeks-left / Refill needed.
  - Know your athlete fun facts: their own `fun_facts` audience (friends default, 13–15 capped); separate text with real erasure; under-16 guardian approve / decline via MINOR-01 type `fun_fact`; verified athletes only; followers or Learn-card starters; at most 1 per round, about 1 round in 3; server word filter; athlete counts hidden under 5.
  - Admin: bulk import (drafts only, duplicate check), Needs a look, fun-fact queue, settings; `trivia.athlete_questions` off.
  - MINOR-01 (unapplied) edited to refuse unknown approval keys and stop a lone re-run after QUIZ-05; the main tree needs the same file at merge ([QUIZ-05](agents/QUIZ-05.md)).
  - App: Report a problem, "Fun fact: {first name}" moment, athlete Share a fun fact (Edit profile plus a skippable step after a first claim), Privacy fun-facts row, guardian approve / decline, Learn card wired to `quiz_learn_start`.
  - Reviews: design panel and four security rounds, then VOICE / ACCESSIBILITY / MINOR_SAFETY / PRIVACY pass. Fresh replay 46/46; `pnpm check` 1,579 tests (lead run). LEGAL row AC.
  - Not verified: hosted database, devices, screen readers. AI drafting and internet pulls remain owner decisions.
- 2026-10-15 · **Trivia demo preview (dev only).** `/dev/trivia-preview` plays a scripted round with the real effects, timer and web sound; no database, nothing saved; redirects to Home in production; not linked from menus. `metro.config.js` also watches the real folders behind a worktree's symlinked `node_modules`, so web builds work in worktrees (main unchanged). Web export 71 routes; `pnpm check` 176 / 1,464. Owner viewed it in the browser: "The demo looks good." ([QUIZ-04](agents/QUIZ-04.md)).
- 2026-10-15 · **Fun trivia presentation (QUIZ-04 follow-up, participant only).** Owner: present trivia in a fun way with effects and playful sound. Pop-in questions, cascading answers, jersey-number progress dots, gold shot-clock bar in the last 10 s, squish buttons, rotating sport cheers with contained confetti on a right answer, encouraging line + soft wiggle on not quite, "Whistle!" on time up, equal round celebration for anyone who answered (medal count-up, badge shine), one-time level-up celebration, Life chapter emoji accents. Sound: Web Audio synth on web, haptics on phones (native audio needs `expo-audio`, not installable while the registry is blocked); Sound on/off switch. Reduce Motion followed; effects hidden from screen readers and never delay Answer / Next / End. `pnpm check` 175 / 1,462 (lead run). Not verified in a browser or on devices. Details in [QUIZ-04](agents/QUIZ-04.md).
- 2026-10-15 · **Trivia in the admin control tower (QUIZ-04 follow-up, admin only, no SQL).** Owner: make sure trivia is in the main admin's control tower with easy customization and adding of questions. Menu item renamed Trivia (searchable by trivia / quiz / questions / Life Playbook); Home status card (state, switches, drafts waiting, chapters open, running low); Control map rows for This week / level / Life Playbook; simple Add a question form with live word-rule / length checks and a player preview; Drafts to review queue (Approve / Edit / Archive / Next, chapter progress); one Settings panel. Word rules now one shared module (`packages/shared-types/lifeCopyRules.ts`) over the one rule file. `pnpm check` 171 / 1,418 (lead run). QUIZ-04 added three lines to `Admin/Reports/AdminReportHome.tsx` for the card (hand-off in [QUIZ-04](agents/QUIZ-04.md)). Follow-up (owner approved): whole-bank draft counts (`bank_counts`) and an atomic `edit_replace`, both in the unapplied `20261014180000` file; Life replay 38/38, `pnpm check` 171 / 1,428.
- 2026-10-15 · **QUIZ-04 owner simplification.** Owner: keep trivia simple and fun — simple facts, nothing needing verification. Chose normal trivia approval and four chapters. Removed and archived (`archive/superseded-2026-10-15/`): CPA sign-offs, named finance / tax reviewers, source URLs, tax year, January withdrawal, re-review, age bands, and the Bank Basics / Paycheck / Credit / Tax / Life Needs chapters. Now: Money Huddle, Savings Season, Scam Defense, Smart Plays (13+, open at 5 approved), copy rules v4 (no advice, brands, Tapua'i money words, NIL, tax / loan / credit, money figures, years), 40 simple-fact drafts; sports starter bank simplified (18 of 60 replaced). Life replay 31/31, schema 105/105, QUIZ-03 59/59, `pnpm check` 166 / 1,372 (lead run). Design §8; evidence and ledger updated.
- 2026-10-15 · **QUIZ-04 Life Playbook and personal progress (Claude session in this worktree).** Owner: fun trivia must never hold an individual back; add an opt-in "advanced" track teaching life skills (money, taxes, loans, smart decisions, life needs) in sports terms, safely, finance first. Choices: separate weekly allowances, the name Life Playbook, everyone 13+ tuned by age. Design [LIFE_PLAYBOOK_DESIGN.md](engineering/design/LIFE_PLAYBOOK_DESIGN.md): an eight-seat panel (incl. CFO + TAX, LEGAL, MINOR_SAFETY, VOICE) required 13 change groups (§7, intentional choices §7.14). Backend `20261014180000_life_playbook.sql`: round kinds with per-kind guards / budgets / recovery; `quiz_life_start`; group played / Family Challenger count group rounds only and need two members; `quiz_content_reviewers` (second-admin confirm, author exclusion across versions, immutable review fields); chapters open only with 20 current approved items and, for Credit Clock / Tax Timeout, a second-admin-confirmed CPA sign-off covering those versions (tax expires each January); age band at Start and every Next; dated items adult-only and withdrawn after 31 January; levels keep the highest value; aggregate-only stats; Life out of trivia counts and audit feed; one copy ruleset (`supabase/content/life_copy_rules.json`, embedded in SQL, checked by `pnpm life:bank:check`); QUIZ-03 file refuses a lone re-run after QUIZ-04; `trivia.life` off. Bank `20261014190000_life_playbook_bank.sql`: 56 drafts, all chapters closed. Admin desk `SportQuizLife` / `SportQuizLifeQuestion`. App: This week strip, level, opt-in card, Life home, round kinds. Reviews: SQL (RLS_SECURITY + MINOR_SAFETY + PRIVACY + CFO / TAX) CHANGES NEEDED ×2 → APPROVED; VOICE / ACCESSIBILITY / MINOR_SAFETY APPROVED with fixes. Life replay 36/36, schema 105/105, QUIZ-03 59/59, timed + QUIZ-03 51/51; last full `pnpm check` exit 0 (161 / 1,333, before review fixes); after the fixes all QUIZ checks pass, and the only failures are another session's in-progress Admin/Reports export (`reportPages.ts:84`, `AdminReportScreen*`). LEGAL row AB. Feature-admin QUIZ-04 app-ready ([admin](engineering/evidence/QUIZ-04-admin.md), [app](engineering/evidence/QUIZ-04-app.md), ledger [QUIZ-04](agents/QUIZ-04.md)). Open: owner confirm admin + second admin standing in for owner grants; named reviewers; CPA sign-off; source verification and 11 CFO / TAX facts; 12+ more approved items per chapter. Not verified: hosted database, devices / screen readers.
- 2026-10-14 · **QUIZ-03 trivia, play together (Claude session in this worktree, after Codex's QUIZ-02 handoff closed).** Owner: keep building trivia and make it fun for fans and families; chose all four upgrades plus playing together, a weekly round of five, and images / other question types later. Design [TRIVIA_PLAY_TOGETHER_DESIGN.md](engineering/design/TRIVIA_PLAY_TOGETHER_DESIGN.md): a seven-seat panel required 17 changes (adopted §9). Backend `20261014160000_trivia_play_together.sql`: round items with per-item deadlines and exact Next recovery, `true_false` (and `image_choice` schema behind an off switch with a two-admin rights review), challenge groups (preset names, hashed codes, limits, no rejoin after removal, block removes the blocked party, MINOR-01 teen rules checked at join and re-checked on age / setting / friendship / guardian / closure changes and birthdays), played marks and rounded totals only, opaque member references, badges and season recap, guardian group count, audited admin case view; erasure keeps rate-limit evidence. Starter bank `20261014170000_trivia_starter_bank.sql`: 60 drafts (facts flagged for Content). Admin desk round size, type editor, forecast, groups, switches. App: rounds of five, True / False, LearnSportCard on athlete profiles, group create / join / page / group round, badge shelf + recap. Reviews: SQL (RLS_SECURITY + MINOR_SAFETY + PRIVACY) CHANGES NEEDED → fixed → approved; VOICE + ACCESSIBILITY changes applied. Replays: play-together 59/59, timed with and without QUIZ-03 pass, schema 105/105. Feature-admin QUIZ-03 app-ready ([admin](engineering/evidence/QUIZ-03-admin.md), [app](engineering/evidence/QUIZ-03-app.md), ledger [QUIZ-03](agents/QUIZ-03.md)). Not verified: hosted database, devices / screen readers; delivery stays paused / testing-only / empty cohort.

- 2026-10-14 · Actual final Documentation continuation PASS (ebcc2023) and VP coordination PASS (9a7efec0) at reviewed handoffd9533c1 plus the factual STATE count correction. Root read both complete receipts and verified SHA256. All106 role/model pins and six prior feature records are preserved; no local source, documentation or coordination finding remains. Final integration records only these verdicts and completion metadata. The current full150-suite/1,219-test check and selected local app-ready pass; codex/fan-zone and both review ledgers are retained. Content, legal/age-region/retention, device/accessibility, hosted/staffing and October20 Growth decisions remain assigned release work.

- 2026-10-14 · Final scope correction53a6104 changes only the round hook/test: initial reads cannot borrow a newly loaded attempt, explicit End and original pending/live departure remain intact. Independent scoped reviewa4acbde9 addresses FINAL-I1 and accepts combined whole-phase source/specification/quality/Data/Privacy/Safety/SUPPORT, with no open Important/Critical findings. Root full round4 exits0:150 suites/1,219tests, both app types and all guards. Actual selected QUIZ-02 app-ready exits0 at metadata18:23:47Z after preserved admin16:53:17Z. Documentation/VP final continuation remains pending; isolated branch and both ledgers are retained.

- 2026-10-14 · Final independent source review confirms FINAL-I1 via actual focused synthetic probe: mounting with snapshot=null then receiving ordinary issued-status snapshot sends unintended quiz_end identity_change despite no departure/Start/End. Expected0/observed1, exit1. Final receipt/complete findings and one combined original-consumer correction wave pending; full150/1210 remains test evidence, final app acceptance unset.

- 2026-10-14 · Root full round3 exits0 after reviewed import-only4a1a1f9:150suites/1,210tests, bothmobile/Next types,13feature/6map/10recovery/10detectiontests and every guard. Map83tables/3views/331functions/20baseline exports;106roles;19sensors with16explicitpartial/gaps. Earlier failed logs retained. Immutable21commit timed package34b5403..dfc1194 dispatched for final independent review; source frozen. Selected app-ready/Documentation/VP pending.

- 2026-10-14 · Independent scoped Task3 fix review876e2336 accepts all3 corrections and participant Data/Privacy/Safety/SUPPORT, with no new Important/Critical findings. Root full round2 passes150/150suites and1,210/1,210tests; later code:unused fails only unused waitFor test import. Original consumer owns import-only repair; complete full rerun and whole-phase/Documentation/VP/app gates remain pending. Five archived untimed wrappers now have actual Data retirement acceptance.

- 2026-10-14 · Owned Task3 correction5bb7a2d across5paths passes9suites165tests/mobile/sharedtypes0: pre-Start intent invalidated on all leaving boundaries; known refusals/authoritative Refresh allow new Off while exact unknown retry is preserved; visible server issuance/delivery/lost-week notice beforeStart. SDK/round/Fan/admin/shared/SQL unchanged. Root verified all5hashes/regeneratedmap0rules; scoped re-review and finalfull/app/Documentation/VP pending.

- 2026-10-14 · Root fullcheck round1 exits1 with only4stale actualHQ quiz fixtures,149/150suites and1178/1182tests; Growth owns v2 fixture/opt-in migration while preservingHQduties/Fan guardians. Archive missing required ARCHIVED header fixeda239d739 without changing historical excerpt. Independent Task3 probes reproduce queued consent Start after blur, stale preference pending blocking Off and incomplete beforeStart delay/lost-response disclosure; formalreview/scoped fixes pending. No app-ready or full pass claimed.

- 2026-10-14 · Timed player55123f80 adds explicit30/90/notice, default-off/manual/weekly invitations, ephemeral original-deadline round, End-before-Start/lifecycle/account isolation, exact terminal answer recovery and private history/CAS erase without preliminary-End race. Worker8suites129tests/mobile/sharedtypes0; original FanDiscovery body unchanged. Five old RPC wrappers preserved in authorized archive;11temporary SDK triages removed after real consumers. Independent Task3 Data/Safety/SUPPORT/source review and root fullcheck pending.

- 2026-10-14 · Timed Backendf785e695 and SDK9d34abd corrections independently PASS: material-history CAS, repeat-safe canonical state and strict private projections. Root actual canonical105/Fan154/historical34/timed50 all exit0; exact canonical62ff4e50 and regenerated map0rules. QUIZ-02 admin evidence16:53:17Z recorded; selected gate must pass before timed participant source. Full current check/player still pending.

- 2026-10-14 · Timed Backendd2d0af2+3f5902c and SDKa369d93 committed, root exact canonical append/mastermap0rulefail. Root Fan154/historical34/timed44 pass; canonical first build passes but reapply fails at duplicate column, leaving that test DB in partial reapply state50/105. Independent review requires monotonic history revisions, safe canonical repeats and stricter SDK private-field rejection. First owned fix wave underway; no admin/participant readiness claimed.

- 2026-10-14 · Timed SDK/admin source passes3focused suites50tests and mobile TypeScript. New server actor proof/source in finalization; independent preflight spec/Data/Safety/SUPPORT PASS with identity, active/terminal learning and CAS erasure clarified. Updated private ownership/schema/retention/support sensor mapping; player source remains behind new actual admin checkpoint. No new full-check or hosted claim.

- 2026-10-14 · Owner approved timed trivia30/90 and continued local implementation. QUIZ-02 enrolled at16:15:21Z before source, approved spec/plan0c31081; Backend/admin owners dispatched, independent Data/Safety/SUPPORT preflight assigned. Player source waits for new actual admin-ready. Per-user learning/story/activity growth paths documented; old Fan/untimed evidence retained. Pilots paused/empty; no hosted/spending/merge/push.

- 2026-10-14 · Actual final Documentation and VP continuation reviews PASS at60bc284; root fully read/hash verified both receipts. Local Fan evidence/task bookkeeping complete; source preserved in isolated codex/fan-zone. No product runtime changed after root full148/1,146/all-guards. Timed Quiz remains a reviewed proposal awaiting owner design approval and new admin-first work; current Quiz is untimed/app unset. No hosted launch or merge.

- 2026-10-14 · Final independent 133-path source/coherence/Data/Safety/SUPPORT review PASS; root fully read/hash verified receipt. Actual Documentation and VP scope reviews PASS, all106 role metadata/pins preserved. Selected local Fan app-ready exits0 at metadata date2026-10-14T14:49:04Z, after actual admin13:42:36Z and full root148/1,146/all-guards plus105/154/34 replays. Final delta changes only documentation/local feature metadata. Revised timed Quiz app unset; owner design/new admin-first work pending. Pilots inactive.

- 2026-10-14 · Root complete pnpm check exits0 after import-only b7fd0c correction:148 suites/1,146 assertions and all guards. Fresh required canonical105/Fan154/Quiz34 actor checks pass. New timed-trivia draft reviewed by actual Growth and independent Data/Privacy/Safety/Support executors; owner design review pending, untimed Quiz app readiness unset. Whole-branch/Fan app-ready and actual Documentation/VP handoff remain pending.

- 2026-10-14 · Fan consumer receipt read/hash verified, independent PASS. Jest fixture helper moved byte-identically to __fixtures__ with import-only consumers. Full check round2 passes 148 suites/1,146 assertions and prior guards then finds one unused test import; its source-only correction and full rerun required. Timed trivia proposal records owner 30-second/longer choice, opt-in, reviewed bank and no-repeat history; current untimed Quiz does not satisfy the new request and app-ready stays unset. New admin-first verification precedes timed code. No hosted activity.

- 2026-10-14 · Fan stale-permission correction 070a58b independently passes scoped specification/quality/Data/Safety/SUPPORT; 35 focused tests and mobile typecheck. Shared Fan discovery 8179b7b adds read-only Home/HQ/profile access, exact campaign context and real admin coverage; private guardian shortcut survives participation dismissal. Final affected 53 tests plus coverage test/typecheck pass. Map regenerated: 82 tables/views, 308 functions, 20 baseline triaged exports, zero rule failures. Independent final reviews/full check/app-ready/Documentation/VP closure remain pending.


- 2026-10-14 · Fan participant source `bcb898c` passes 29 focused hook/screen tests and mobile typecheck; separate `a4f4acd` private video producer passes 13 tests and independent technical review. Full caller review identified stale-permission refresh/reset recovery requiring correction before shared discovery. All new SDK exports are now consumed; regenerated map validates 79 tables, 3 views, 5 buckets, 308 functions and 20 baseline triaged exports. Final full check/app-ready/Documentation/VP receipts remain pending. Both pilots remain inactive local source.


- 2026-10-14 · FUN-01 corrected exact-scope admin review and composite recovery cursors pass 154 actor and 45 SDK/admin checks, root canonical replay105 and actual independent specification/quality/Data/Safety/SUPPORT acceptance. Selected admin-ready gate passes at 2026-10-14T13:42:36Z before Task4 source release. Quiz participant/shared discovery reviews PASS. Fan journey building, full combined checks/app-ready pending; no hosted activation.

- 2026-10-14 · Weekly Sport Quiz participant page passes23local checks and independent spec/quality review; optional Home/four HQ/profile discovery passes44local checks and mobile typecheck at96e4c3d. Shared consumer review and full gates pending. Fan admin source passes59local checks; independent operational review requires exact stale-revision acceptance guards before admin-ready or fan source. Existing timestamp guards protect normal paging; composite cursor adds recovery robustness. Bounded Help & Safety/contact decision recorded; no hosted changes.

- 2026-10-14 · QUIZ-01 corrected sourceac509948 independently passes specification/quality and local Data/Safety/SUPPORT admin review. Root canonical105/105, workerQuiz34/34actor and2suites30tests, root14nav/3map tests. Actual admin-ready feature gate passed2026-10-14T06:09:57Z before participant source release. Private weekly question/explanation/Skip/badge page now building. New normalizer governed; no hosted activation or counsel approval.

- 2026-10-14 · FUN-01 source fixes at766e0ff independently pass scoped specification/quality review:135 actor,14API and105 canonical checks. Report/deletion quotas, blocked-owner admin intake, campaign→entry lock order, private Storage write fence, verified upload retry and explicit guardian-grant binding corrected. Task3 admin source released after producer review; no fan UI/admin-ready yet. Quiz admin navigation passes14/14; F1–F3 addressed, F4 Unicode/whitespace correction pending. Governed private helper parser passes3/3, baseline role sources verified identical14/14. No hosted application.

- 2026-10-14 · FUN-01/QUIZ-01 enrolled before source in isolated codex/fan-zone checkout. Owner authorizes first fan-voted journey and adds weekly sport quiz/private noncash completion badges. Exact scope/test audience revisions accepted by actual outside-session Codex Safety design review. FUN-01 private media API/MP4/client paths locally implemented: 3 focused suites/17 tests and mobile typecheck pass; backend/admin checkpoints pending. Existing Finance payout override flag catalog omission corrected (15/15 focused); full baseline reached documentation links, missing snapshot role sources copied, docs links now201 pass. No SQL applied or hosted release. Actual progress in FUN-01/QUIZ-01.

- 2026-10-13 · Family-fun refinement: playbook §12 proposes one weekly Fan Zone with Join the fun/Meet an athlete/Serve together, private entry/review/status, separate acknowledgment and awards, newcomer/accessibility/group-credit safeguards, voluntary service/support and cooperative school recaps. Owner selects fan voting chooses the winner: staff eligibility/rights/safety review, valid free ballots, proposed server windows/retries/ties/corrections, permission and abuse controls. Charter §11/per-user plans/current team duties reflect that choice; not a staff-selected replacement award. Actual scoped reviews/checks are in GROWTH-01. No app, schema, enrollment, voting, award, service campaign or money behavior is implemented.

- 2026-10-13 · Family fun brainstorming: owner clarifies fan-video recognition for eligible account holders (Game/Week/Month/Year), awesome-fan badges and both badge/Aura and money paths with voluntary service/posting. Actual Codex Growth/Legal/source reviewers exchanged findings. New [FAMILY_FUN_PLAYBOOK](product/FAMILY_FUN_PLAYBOOK.md) proposes Fan Moment, Behind the Jersey, Serve Together, weekly activities, newcomer-friendly reviewed recognition and future fair school participation. Existing poll closure/vote and generic fan-award/admin gaps are explicit; current controls do not establish fair winners. Charter §11, user plans and standing team duties integrate fun/return/capacity into the joint packet. No new app UI, award, badge, contest, service campaign or payment model is implemented. Actual coordination/documentation/check results are recorded in [GROWTH-01](agents/GROWTH-01.md); counsel/hosted/device/money gates remain separate.

- 2026-10-13 · Fan/filmer and every-user growth follow-up: actual Codex Legal/Dev/Growth source reviews exchanged findings. New [USER_GROWTH_PLANS](product/USER_GROWTH_PLANS.md) covers guests, fans/young fans, casual uploaders, repeat filmers, donors, athletes, guardians, schools, boosters, sponsors and gated operator/internal capacity. Includes current Tag later videos vs athlete-selected photos, missing later tagging/share/recovery, publication/removal and eligible-credit safeguards; per-segment value/acquisition/use/return/outcomes, mitigation owners and proposed 30/60/90 stages. Growth charter §10 requires plan cards within the one packet and next Oct20 review. Product options remain proposed; existing authority, hosted/device/counsel/money gates apply. Actual role-coordination/Documentation functions and current check results are in [GROWTH-01](agents/GROWTH-01.md). No runtime feature, outreach/campaign, hosted change or cash reward added by this plan.


- 2026-10-13 · Verification, consent and safe growth: actual Codex Legal/Growth/Dev reviews exchanged source findings and root integrated the new [review/decision packet](legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md). Growth charter §9 establishes standing joint review of mandatory rules vs company choices, lawful alternatives, permitted engagement, safety and loaded review costs through GROWTH_ANALYTICS → MARKETING → CTO → owner. Proposed guardianship/payee/publicity/school/consent decisions are not approved policy. Current external policy bodies unavailable; comparisons unverified. MINOR-01 source changed concurrently and ongoing age/integration, Connect, settlement, privacy/media and safety-operation gaps are assigned to existing owners. Actual VP/Documentation coordination and fresh local results are recorded in [GROWTH-01](agents/GROWTH-01.md); no app controls, hosted SQL, live money or release approval added by this review.


- 2026-10-13 · Video scalability review: actual Codex media/reliability and cost/FPA/VP functions reviewed current source and budgets; independent Documentation accepted 2026-10-14T02:34:43Z, no Important contradiction. [Hosting brief §11](engineering/HOSTING_DECISION_BRIEF.md#11-video-scalability-team-review--2026-10-13) integrates Mux as a provisional first managed-video experiment and Bunny/Cloudflare as initial equal-workload/quality/full-cost candidates. Replaces earlier defer-Bunny/automatic-fallback sequencing; actual rates/free eligibility/traffic/capacity and financial winner unknown. Proposed video $10–15 sits within infrastructure $50, separate from existing AI; no allocation/purchase/provider selection approved. Current mixed public/private media, whole-byte/MP4 upload, unbuilt provider-ready/idempotency/batched signer, lock/removal/public-URL/deletion and web-format gaps become future admin-first/domain acceptance. No hosted exploit/security fix or native/browser/provider test is claimed. Existing focused unit tests three suites/48 passed; root full `pnpm check` passed 118 suites/867 tests, 186 doc destinations, 106 roles and all included gates (17 declared sensors/14 gaps; runtime not verified). Root checked 24 current source/role/SDK hashes; all matched the technical capture. Updated FPA current baseline, TEAMS candidate prose, queue/ledger and history; registry/reporting/model pins unchanged, no data-map change needed for factual prose. [GROWTH-01 follow-up](agents/GROWTH-01.md#video-scalability-recommendation-follow-up--2026-10-13) records actual reports, checked sources/results, next quote/experiment/security/privacy/recovery/decision owners and released claims; private final receipt `.smoke/support/video-scalability-closeout.json`. SCALE-02 implementation remains not started. No application runtime/test/schema/collector/UI, account/purchase/cancellation, hosted action or rollout by this review. Existing financial/public/device/recovery gates remain open; test-count changes reflect concurrent shared-tree work.

- 2026-10-13 · Owner-reported financial baseline: [Finance operations §6.1](company/FINANCE_OPERATIONS.md#61-owner-reported-monthly-expense-baseline--2026-10-13) records approximately $200/month AI, Free Supabase/$0 current base and undecided video hosting. These are owner reports, not reconciled invoices or verified provider usage/limits. Existing infrastructure ceiling stays $50/month and includes video if selected; AI is separate. Known reported recurring subtotal $200/month/$2,400 annual; using the whole infrastructure allowance gives $250/month/$3,000 annual planning cost before other expenses. Cash available, complete expenses, video quotes and runway remain unknown. Growth first packet and hosting §10.4 link the Finance source; FPA/COST_OPERATIONS obtain actuals/allocation/quotes, TREASURY cash/obligations, Growth integrates one CTO/owner packet. Retain current Free backend while testing fits, review AI tool usage/useful work and measure video before purchase. Actual Codex Documentation semantic review accepted 2026-10-14T02:17:15Z, arithmetic/anchors/source limits passed; root full `pnpm check` passed 118 suites/861 tests, 186 doc destinations, 106 agents and all included gates. Final metadata check/receipt: `.smoke/support/finance-cost-baseline-closeout.json`; private review and gate logs sit alongside it. Claims released after integration. No runtime/schema/role change, real journal entry, cancellation, purchase, hosted action or commit. Prior Growth/hosting/health verification remains dated; no financial launch or cash runway is certified.

- 2026-10-13 · GROWTH-01 operating setup: existing GROWTH_ANALYTICS owns one Growth and Capacity Review packet through MARKETING → CTO → owner. [Charter](engineering/GROWTH_CAPACITY_REVIEW.md) defines department outcomes, source/environment/window/denominator quality, accepted targets, per-service forecasts/options, provider price/limit/approval baselines and false-positive checks. Initial $50 ceiling: $40 watch/$50 review; verified quotas 70% watch/85% confirmed review; 100/1,000/10,000 verified MAU are proposed planning checkpoints, not capacity or accepted success goals. Actual first review records internal testing; live MAU/retention/conversion, invoices/limits/prices and production headroom remain unknown/unread. Updated five role files, ten registry rows, team/hierarchy/plans/queue; all 106 role/reporting/model pins preserved. Regenerated DATA_MAP and existing main-admin Team flow responsibility metadata; no runtime source/schema/collector/UI change. Fresh full `pnpm check` passed 118 suites/861 tests, 186 Markdown destinations, 106 agents and all included gates (17 declared sensors/14 partial-gaps; runtime not verified). Actual Codex VP coordination and independent Documentation review accepted with no Important contradiction; [GROWTH-01](agents/GROWTH-01.md) has supplied checks, source hash, released claims and six next evidence/decision lanes. Next standing packet October 20, America/Denver; cadence is an assignment, not an installed scheduler. CTO recommends and owner decides; no purchased plan/provider migration, hosted reading/writing, external messages or commit. Admin-first measurement work, real source/billing/load/recovery evidence and existing Finance/Security/device/counsel release gates remain assigned.

- 2026-10-13 · Hosting cost/expansion follow-up: owner selected an initial infrastructure ceiling of $50/month or less. Existing [HOSTING_DECISION_BRIEF §10](engineering/HOSTING_DECISION_BRIEF.md#10-owner-budget-follow-up--50month-and-phased-expansion) now compares managed Supabase, own hardware/VPS, AWS/Azure managed stacks and other PostgreSQL options; inexpensive dev/staging, a limited pilot, separately approved financial recovery, measured media/compute growth and optional migration phases. Includes all-in vendor/operations/migration costs, example video workload and payback, a proposed unrun synthetic self-host experiment after R2, and a phase diagram. Full `pnpm check` passed 118 app suites/861 tests, 184 active Markdown destinations and 106 roles; Documentation review accepted the additions and root integrated its quote-completeness feedback. Fresh Claude launcher failed sandbox_apply exit 71 even after escalation; a read-only follow-up request is prepared, not executed by a model. External price-page bodies were denied by input filtering; all prices/limits remain unverified assumptions. The existing 49-role/CTO report is prior context. Environment plan, index/changelog and receipt synchronized; claims released. No code/role/policy change, provisioned server, purchased plan, hosted/data migration or new automatic scaling was performed. Current quotes, Claude reply, R2 reset, server trial and production/recovery/budget gates remain assigned.

- 2026-10-13 · HEALTH-01: evaluated 62 current task IDs, every queue section, 10 backlog functions and 8 owner decisions; nine ranked lanes/next owners reconciled. Existing TelemetryManager now bounds 120 queued/unresolved rows, batch 15 and caller wait 10s, records safe status/loss and never replays an attempted uncertain INSERT; stalled transport retains capacity, disposed singleton stays inert. QA independently reads digest/device queue with one actual pending read per source, generation/unmount guards, accurate Clear/Unsave, unconfirmed write notices and sampled process-local delivery/history. Valid regressions failed before repair; final logger 21/21, QA 11/11 and independent review accepted. Fresh `pnpm detection:scan` passed 2026-10-14T00:56:43.573Z–00:58:02.345Z (2026-10-13 local): full `pnpm check`, 117 app suites/859 tests and separate Next 86/86; no failed/skipped checks. Current frozen schema 35/35 and all five exact cap boundaries/client-vs-trusted expressions passed; actual tip INSERT/UPDATE state and helper grants checked, hashes recorded. Root tested concurrent SQL without authoring/applying it; earlier NULL probe and corrected RLS test assumption retained. Actual Documentation/VP execution integrated; current final docs links 183, 106 roles and 17 sensors/14 partial-gaps pass. Claims released; [HEALTH-01](agents/HEALTH-01.md) has receipts, source hashes, scope and next owners. Hosted/JWT/delivery, browser/native/device, durable intake, Supabase reset/history, DB backup/compatibility and finance/counsel/release remain open. No hosted application, deployment, live money, scheduler, new recovery capsule or commit.

- 2026-10-13 · COORD-01: actual Codex Documentation and VP Operations passes completed and root accepted/integrated both. Updated affected evidence, duties, reporting metadata, current priorities and shared helper/admin references; historical checkpoints remain dated. Regenerated master data map and main-admin Team flow from current ownership. Future feature/fix handoffs require Documentation execution; role/protocol/priority changes require VP reconciliation, each with actual executor, paths, dated checks, gaps and next owner. Fresh `pnpm check` passes after final registry/topology updates (115 suites /827 tests, 181 Markdown destinations, 106 roles and 2 feature contracts). Claims released; [COORD-01](agents/COORD-01.md) contains actual receipts and remaining owners. Duties are task-triggered; no unattended scheduler configured. No hosted SQL, deployment, live-money action or commit.

- 2026-10-13 · STANDARD-01: documented innovation and outside handoff in `docs/engineering/INNOVATION_AND_HANDOFF.md`; observed/hypothesized struggles, baseline/options, bounded experiments, success/stop criteria, actual results and adopt/revise/stop decisions reuse the task/design/incident record. Shared module contracts, versioned diagrams and evidence connect the admin-first workflow to authorized engineer/legal/investor reading paths. Agent instructions, conventions, onboarding, feature template/workflow, Support handbook and docs index link the standard; stale repeated model labels removed from department lead prose while role pins/table remain intact. Documentation/navigation/registry checks pass; full gate and review results live in the standard's verification record. No runtime/schema change, external sharing or outside-company walkthrough.

  STANDARD-01 close-out: documentation review accepts with no Important finding; full `pnpm check` passes (115 suites /827 tests, 180 Markdown destinations, 106 roles and 2 feature contracts). Shared-file claims released; the standard is a future-work requirement, not completed outside or legal/investment certification.

- 2026-10-13 · DETECT-02: main-admin `/admin/support` Issues/Team flow/Change history/Recovery; generated ownership topology from the master data map; restricted fixed-code support model/RPCs and append-only atomic selected-source audit; independent protected reviews; Security adds THREAT_DETECTION alongside Engineering Support; dependency-locked source packages with hashes/provenance and isolated preview restore. Admin-first checkpoint passed; app-side runtime observation, feature containment, safe read recovery and distinct donation failure capture wired; 17 declared sensors (14 partial/gaps). App-ready checkpoint and full local gate pass (115 suites/827 tests, Next 86/86); SDK offline/abort exclusions independently reviewed; the 997-file /26,480,216-byte source capsule captured at 2026-10-13T19:41:40.423Z passed its full gate, verification and isolated restore (before STANDARD-01 documentation edits; unsigned, hosted compatibility not verified). Migration not applied, live code/money untouched.

- **2026-10-14 — PORT-01 next steps (local; coordinated by INFRASTRUCTURE).** Owner: "let's do it". (1) **SCALE-02 expand** (STORAGE with UPLOAD / PROFILE): avatar and booster-logo displays resolve stored values through `lib/media.ts` (`mediaUri`: legacy full URLs and `sb:` references); `MEDIA_WRITE_REFERENCES` writer switch added and **off**, so uploads still store full URLs; contract steps owner-gated (tester build with readers → flip → PLAY-01 releases `lib/reels.ts` for videos → backfill migration, not written). (2) **SCALE-04** (COMMERCE with API / CONNECT / SESSION_SECURITY): runtime-neutral money core `supabase/functions/_shared/money/` (validation, quote math, freeze check, Connect gates, payout decision, session decision, response shapes) used by the Node handlers and both Edge Functions; 96 characterization tests written against the old code pass before and after. (3) **Local token verification**: ES256 / RS256 access tokens checked against the project JWKS with WebCrypto, checkout only; Connect and payouts always confirm the live session with `getUser`; HS256 / unknown key / unreachable JWKS / issuer mismatch fall back to `getUser`. SECURITY + SESSION_SECURITY + API review: **approved**; applied its P2 (issuer mismatch → fallback, so a self-hosted stack or custom domain does not break checkout) and P3 (both runtimes refuse an `sk_live_` / `rk_live_` key while Wave 0 is test mode). Recorded for the webhook work: when crediting is enabled it must check the user is active, not trust token-stamped metadata. (4) **Generated database types** (DATABASE_MIGRATIONS): `scripts/gen-db-types.mjs <pglite dist> [--check]` → `types/database.generated.ts` (66 tables, 3 views, 238 functions; CI checks it is current; `pnpm db:types`); `types/__tests__/databaseDrift.test.ts` (8 drifts: `Profile.current_tier` removed, 7 allow-listed with reasons); Supabase stubs moved to `scripts/replay/supabase-stubs.mjs`. (5) **Exit drill runbook** [EXIT_DRILL.md](engineering/EXIT_DRILL.md) (local step 0 today; full drill after E1). Register: `_`-prefixed function folders are shared code, not functions. `pnpm check` 135 suites / 1,076 tests; replay 111/111. Not verified: Deno execution, Supabase deploy bundling of `_shared`, a real JWKS, devices.

- **2026-10-14 — Infrastructure awareness (INFRA-01) and PORT-01 follow-through (local).** Owner: move forward with the recommended decisions, and always have a dev team member and agent on the scalability team who knows what infrastructure and hosting we use and how much it is integrated, coordinating with other agents. Added role `INFRASTRUCTURE` (Engineering → ENGINEERING → CTO; 107 roles; registry, TEAMS, hierarchy, expert standards, department plans; noted in CTO, ENGINEERING, GROWTH_ANALYTICS and COST_OPERATIONS definitions) as the standing dev member of the Growth and Capacity Review. Awareness mechanism: `docs/engineering/infrastructure.json` (services, status, environments, plan, decision, and which dependencies / env var names / functions / API routes / buckets / extensions / workflows each accounts for) + `scripts/infra-register.mjs` → generated [INFRASTRUCTURE_REGISTER.md](engineering/INFRASTRUCTURE_REGISTER.md) with integration depth; `pnpm infra:register:check` (in `pnpm check` and CI) fails on unclaimed or stale usage or a stale register, so every infrastructure change is a diff INFRASTRUCTURE reviews (TEAMS contract item 12). PORT-01 next step done (CODE_HYGIENE with BACKEND): operator routes, offline queue and seven hooks now reach Supabase through `lib/` (`operator.ts`, `reelVotes.ts`, `cheerPoll.ts`, `aura.ts`, new `savedReels.ts`, `liveGames.ts`, `localSearch.ts`, `sponsorships.ts`); route direct calls 16 → 0, elsewhere 78 → 48; 6 new tests. Remaining PORT-01 steps (SCALE-02 references, SCALE-04, local token check, generated types, E3 after E1) are tracked by INFRASTRUCTURE. No hosted change.

- **2026-10-14 — Portability (PORT-01, local).** Owner accepted the hosting recommendation and asked whether the database can be wrapped so a future move is not a trap. Answer (CTO with BACKEND, DATABASE_MIGRATIONS, OPERATIONS, STORAGE; review changes needed → applied): do not wrap the database — it is plain Postgres and already rebuilds from the repo on a non-Supabase Postgres (schema replay, 111 checks); the ties are the services around it (PostgREST, GoTrue sign-in, Realtime, Storage, three Deno functions) and app code that calls them directly. Two exits recorded: self-hosted Supabase (weeks of plumbing) or another provider (a `lib/`-centred project). Built: [PORTABILITY.md](engineering/PORTABILITY.md) as the single source (CODE_ORGANIZATION_PLAN now links to it; brief §4.2 corrected — avatars and booster logos also store full URLs); `pnpm app:data-boundaries` widened from two operator routes to every route, hook, component, context, service and the admin portal's pages, counting database / auth / storage / realtime / server-function calls and direct `@supabase/*` imports (78 in 27 files + 16 in 3 routes, may only shrink); `lib/media.ts` (provider-neutral `sb:` / `reelvault:` references, one public-URL builder, legacy URLs rebuilt for the current host) used by uploads, booster logos and story photos; the duplicated `cast_cheer_vote` call moved to `lib/cheerPoll.ts`. Not done: writing references instead of URLs (SCALE-02), `lib/reels.ts` (PLAY-01 claim), the exit drill (E3), generated types. No hosted change.

- **2026-10-14 — Payee verification (VERIFY-02, local).** Owner asked how to legally verify parents and athletes and wanted every earner's SSN. Panel (CONNECT, COMMERCE, CUSTODIAL, SECURITY, PRIVACY_ENGINEERING, LEGAL, INFO_RETURNS, TAX, ATHLETE_VERIFICATION) found: no SSN collected anywhere; `payouts_enabled` ("transfers active") was being read as identity; custodial payee account never written; Stripe status never refreshed; admins could set payout flags with no record; a design line claimed Stripe KYC stops a fake parent (corrected). Owner decided (all recommended): SSN to Stripe only, never stored by Tapua'i; guardian money authority = Stripe identity + TIN plus the school's in-person parent confirmation (document review fallback, not kept); Stripe Identity only for disputes; payout flags by hand only with a reason and a second admin. `20261014120000_payee_verification.sql` (not applied): append-only `payee_verifications` (no delete / truncate; `looks_like_ssn()` CHECKs), `payout_flag_overrides`, payout gate on the actual payee and the exact Stripe account being paid (`needs_payee_verification`), relationship checks confirmed by an independent second admin, payout-flag guard, re-verification on guardian / account change, admin overview / report. RLS_SECURITY review: changes needed (3 P1 — one admin could make themselves guardian and unlock a payout; revoke failed; the verified person was not tied to the paid account — 2 P2, 3 P3) → applied, replayed. Also `pnpm security:no-ssn` (`pnpm check` + CI) and SSN redaction in telemetry (`lib/redact.ts`). Admin desk: People → Privacy & safety → Payee verification. Plan: [PAYEE_VERIFICATION_PLAN.md](engineering/design/PAYEE_VERIFICATION_PLAN.md); evidence `docs/engineering/evidence/VERIFY-02-admin.md`; VERIFY-02 app-ready. Also (owner): the superseded guardian-lock code is archived in `archive/superseded-2026-10-14/`, and older accounts are re-asked for their birth month every three days. Not verified: hosted database, Stripe (webhook not wired: `create-stripe-account` must call `record_stripe_kyc`; `createPayout.ts` must pay `payee_for_player`'s account before payouts open), devices.

- **2026-10-14 — Minor accounts (MINOR-01, local) and PRIV-01 close-out.** Owner: a guardian is linked and signs a consent but is not "total dictatorship"; teens go solo within the law; easy sign-up. Decisions: consent unlocks money and going public; guardian supervises and approves a few (under-16 only); birth month and year replace the 13+ checkbox; keep under-13s out. Chain owner → CTO → ENGINEERING → PROFILE with AUTH, ONBOARDING, CUSTODIAL; design panel MINOR_SAFETY / CUSTODIAL / PRIVACY_ENGINEERING / LEGAL (changes needed → applied; a 72-hour guardian wait and 7-day guardian account age declined for growth, recorded as options); SQL review RLS_SECURITY + MINOR_SAFETY (1 P0 — "off"/"no" made a teen public — 4 P1, 2 P2, 5 P3 → applied → confirmed; its last P2/P3 fixed and replayed). `20261014110000_minor_accounts.sql` (not applied): birth columns, `not_given` for new accounts without an age, teen defaults (`teens` requests), guardian links from a teen's 48-hour code that the teen confirms, append-only consent with the text's SHA-256 (payouts only from the guardian on record), shared supervision summary (counts, never who; guardians see events after linking only), under-16 approvals, block ends links, under-13 closure with a restrictive "Closed accounts" policy on every RLS table and Storage, payouts need positive adult evidence (`needs_guardian_consent` / `needs_birth_month`), admin case file / report / retention. The PRIV-01 guardian lock was removed from stage 1 before anything was applied. App: birth month field in sign-up (neutral under-13 refusal, 24-hour device pause), one-time age card, Privacy sheet teen pieces, guardian panel in Parent HQ and Privacy, draft consent form with a testing-only banner. Stage 2 re-review fixes: blocking someone with pending tags failed (tag guard) — fixed; declines and a block's quiet decline name nobody even on the uploader's own row and stay undoable by admins. Replay 100/100; `pnpm check` 126 suites / 905 tests; PRIV-01 and MINOR-01 app-ready (evidence `docs/engineering/evidence/`). LEGAL row AA new, F and Z updated. The superseded lock card draft (`GuardianPrivacyCard.tsx`, never committed) was set aside to `/tmp/minor01/superseded/`. Not verified: hosted database, devices / browser, Stripe birth-date checks, the consent text (counsel).

- **2026-10-14 — Profile privacy, friends, blocking and tag approval (PRIV-01, local).** Owner decisions: two-way friends; a private athlete keeps name, approved-tagged Highlights, Donate, Rally / gear goals and Join Crew public; new accounts private; plus blocking, guardian lock, hide from search and tag approval with a visible approved-vs-pending difference that costs athletes no credit. Design [PROFILE_PRIVACY_DESIGN.md](engineering/design/PROFILE_PRIVACY_DESIGN.md), chain owner → CTO → ENGINEERING → PROFILE with reviews by RLS_SECURITY, PRIVACY_ENGINEERING, MINOR_SAFETY, CUSTODIAL, HIGHLIGHTS, SPOTLIGHT, ACCOUNT_TAGS. **Stage 1** `20261014090000_profile_privacy.sql`: `profiles` was readable by everyone (the old hide switches were cosmetic) — now own row or admin; other people's profiles only through `get_public_profiles` (named accounts, so no directory); `profiles_public` rebuilt on `viewer_relationship` / `audience_allows`; friends (20 requests a day, 3 per person a week via a log, "who can send me requests", silent 30-day decline cooldown), blocks (end friendship, requests, Crew follows and pending tags; the blocked person sees a guest's view and is not told), hide from search (the guardian lock in this draft was later replaced by MINOR-01) (local search, tag search, Aura / fan / filmer boards); `crew_follows` reads close and its writes refuse blocked followers; photos and full names stopped leaking through `reels_feed`, boards, Spotlight, donor and tag lists. Review: changes needed (11) → applied → approved. **Stage 2** `20261014100000_tag_approval.sql`: decisions only from pending, rejections remembered and untag the clip, 3 declines bar an uploader, 5 pending per uploader per athlete, blocked uploaders rejected quietly, auto-approve friends, operators only for athletes without a verified account, a pending tag's athlete hidden from non-parties, Spotlight / leaderboards credit pre-approval engagement on the approval date. **Admin first** (feature-admin PRIV-01 admin-ready): People desk → Privacy & safety report and per-person panel (counts, never who; reset, release lock, hide from search). **App:** Profile → Privacy sheet (Edit profile keeps the old switches on databases without the update), Add friend / Accept / Unfriend / Block on athlete profiles with the private note, Activity friend requests, Parent HQ lock card, approved / pending tag chip in the clip overlay (wiring in ReelCard waits for PLAY-01's claim — hand-off in PLAY-01.md). Found and fixed on the way: the shared RPC helper called `supabase.rpc` detached, which throws on every call with the real client (now `untypedRpc`, bound, with a regression test); the data-map generator now counts `callRpc` users. Schema replay 74/74; `pnpm check` 121 suites / 875 tests + the privacy screen tests. LEGAL row Z (friend connections between minors and adults) for counsel. Not verified: hosted database, browser / device rendering, the ReelCard chip wiring.

- **2026-10-13 — Profile photo overwrite and family totals (owner: fix the two bugs found in the app-struggles review, local).** (1) Any signed-in user could overwrite any profile photo: `20261013230000_avatars_owner_folder.sql` limits avatar writes to the caller's folder, lets users delete their own photos, and keeps older builds' booster-logo uploads working; booster logos now upload to `sponsors/{user id}/`; the legacy `supabase/media_upload.sql` (which app error messages tell people to run) carried the old open policies and now matches the migrations for reels and avatars. (2) The athlete's "Support received" list and the custodial cards showed the donated total as received, though the family account gets 90%: `20261013231000_family_share_in_received.sql` adds `family_cents` from the books to `get_received_malo` and `get_custodial_summary`; the screens now say "$45.00 recorded for your family account so far · Fans donated $50.00. Tapua'i kept $5.00 to run the app, including card processing", and state the split (never a guess) on databases without it. Chain: owner → CTO → BACKEND/STORAGE and COMMERCE/LEDGER/CUSTODIAL; RLS_SECURITY (changes needed → applied) and VOICE + LEGAL (changes needed → applied). LEGAL rows L and X flag for counsel that older custodial lines still say "held"/"yours to move" and that withdrawal requests are not capped against the family share — both depend on STATE §6 item 8. Schema replay 43/43 (the four relevant checks fail without the files). Not verified: hosted Storage behaviour, device rendering.

- **2026-10-13 — Hosting decision brief (owner request, docs only).** [HOSTING_DECISION_BRIEF.md](engineering/HOSTING_DECISION_BRIEF.md): 49 engineering roles in five panels plus COST_OPERATIONS research. Unanimous: option A (managed Supabase) with video on a dedicated streaming host (Mux Basic for Wave 1, re-price at S2) and self-hosted Supabase on AWS as the drilled exit; nobody backs self-hosting as the operating mode or a managed-cloud rewrite now. With our time at $100/h, S2 costs ≈$1k/mo on A vs ≈$3k (C) and ≈$4k (B); leaving pays only around a sustained $10–15k/mo Supabase bill. Code findings recorded as SCALE-01…08 in WORK_QUEUE: no admin MFA; `useLiveScores` refetches every game per fan per score change; `expo-notifications` not installed (Crew alerts never sent); whole-file uploads; full host URLs in `reels.video_url`. **All outside prices unverified** (internet mode off). CTO final review done (fidelity issues corrected): stay on Supabase, Mux for Wave 1, three owner decisions in the brief §9.

- **2026-10-13 — Environments and hosting plan (owner request, local).** [ENVIRONMENTS_AND_HOSTING.md](engineering/ENVIRONMENTS_AND_HOSTING.md): dev / staging / prod; options A (stay on managed Supabase — recommended for Wave 0–1), B (self-host Supabase on AWS EC2 / Azure — the tested exit, quarterly drill on synthetic data), C (AWS / Azure managed services — a rewrite, not justified); costs to verify; the merge-to-deploy pipeline (owner approves staging and prod in GitHub); phases E0–E3 and nine owner decisions. Reviewed by CTO + BACKEND / DATABASE_MIGRATIONS and by OPERATIONS + CI / RELEASE / COST_OPERATIONS + SECURITY + PRIVACY_ENGINEERING (both CHANGES NEEDED, applied). Found and fixed on the way: **a production store build would have shown the demo sign-in** (`eas.json` set only `APP_ENV`; `lib/auth.ts` reads `EXPO_PUBLIC_APP_ENV`) — every profile now sets both, test `appEnv.test.ts`. CI now runs the whole-schema and three migration replays (hash-pinned PGlite 0.5.9; first GitHub run will confirm the download hash) and has read-only permissions. Key E1 risk recorded: `supabase db push` would re-run hand-pasted SQL until staging gets a baseline and `migration repair`. Not verified: any hosted setting, the GitHub plan, prices.

- **2026-10-13 — Whole-schema replay and function access hardening (DATA-01, local).** `scripts/replay/schema-replay.mjs` rebuilds all of `schema.sql` on an empty Postgres 18.6 (PGlite, Supabase schemas stubbed), applies it twice and checks rules for every table and function — the first local proof the database can be rebuilt from the repo (readiness R2). Every table has RLS and every security definer function pins `search_path`, but it found: `record_company_revenue` / `sync_company_revenue_logs` executable through PUBLIC (guests **and signed-in fans wrote revenue rows into the books** in the replay), `increment_reel_tips` / `add_user_aura` open to guests, `triage_app_feedback` / `upsert_sport_config` / `delete_sport_config` granted to guests with no check, four ladder admin functions anon-executable, and `is_admin_or_db()` treating a claimless request as the SQL Editor. Fix `supabase/migrations/20261013210000_function_access_hardening.sql` (copied onto `schema.sql`): new `is_trusted_server()` as the one server test, admin checks on the three desk functions, PUBLIC/anon EXECUTE removed, caps no longer skip on NULL. RLS_SECURITY approved (its P2 on `is_admin_or_db` grants applied; the five NULL-passing CHECKs were an earlier follow-up, subsequently fixed and verified against current source in HEALTH-01). Replay 35/35 with the fixes, 13/35 without; a real donation still reaches the books. Also: `code:unused` read FORCE_COLOR's pretty output as "nothing unused" — now `--pretty false` and fails closed; `detection:scan` passes end to end. Other replays still pass (Books 72/72, closures 46/46, support 144/144). Not verified: hosted grants (no database access from this Mac), browser rendering (no browser driver available).

- **2026-10-13 — Archive naming, merges and check-in retention (DATA-01, local).** Owner: name archives properly, do what's left, merge similar functions. Every archived file is now `<name>.archived.<ext>` under its pass folder (the SQL moved from `archive/sql/` into `dead-code-2026-10-13/sql/`), starts with an ARCHIVED header saying whole file or excerpt, and has a registry entry with a `kind` (84 entries, 47 files); `data:map:check` fails on a file that breaks the rule or on live code importing `archive/` (archive/README.md). Merged: twelve missing-function checks into `lib/dbErrors.ts` (the old "schema cache" match also caught missing columns), four desks' busy/notice code into `hooks/useAdminAction.ts` (People now guards double taps and shows errors in red), the two game-log mappers into `mapGameLogs`. PRIVACY_ENGINEERING set operator check-in retention to **30 days, automatic**, rounded on the phone and by a server trigger that also sets the time (a client-sent 2099 date could have dodged expiry); one SQL function `expire_operator_checkins` serves the trigger, the admin list and the purge; LEGAL row Y opened. Replay 46/46. At that earlier pass, DETECT-02 support suites and registry entries were still unfinished. Those failures are now resolved: the later full gate passes 115 suites /827 tests and the data/106-role checks. Not done: PLAY-01 cleanup (claim still open), staging SQL (owner).

- **2026-10-13 — Data governance closure pass (DATA-01, local).** The owner approved archiving and asked for nothing left hanging. **Archived** (nothing deleted): 47 approved exports, plus everything that only they used (62 entries after the second pass), moved to `archive/dead-code-2026-10-13/` with their test cases. That includes the old admin overview, the old admin charts, TelemetryCards and the portal ColumnChart; the list with reasons is in `data-ownership.json` → `archived`. **Findings closed:**
  - F1: Athletes desk Stats panel writes career stats and game logs.
  - F2: Activity shows Crew alerts and clears them.
  - F3: Live games desk reads operator check-ins. PRIVACY_ENGINEERING decision (same day): the database stores them rounded to ~1 km with the server's time and deletes them after 30 days automatically (`expire_operator_checkins`, insert trigger `operator_checkins_minimize`); the phone rounds before sending.
  - F4: Schools desk branding and staff confirmers (link shown once); People "Revoke and unlink" uses `admin_revoke_verification` (Unverify stays badge-only); Athletes desk custodial terms.
  - F5: `get_aura_tier` archived by migration.
  - F7: the Look desk "Actions on top" switch now moves Donate / Share.

  **QA follow-up (same day):** review found one security blocker (exact operator GPS still readable straight from `operator_checkins`; the migration now revokes table reads and keeps insert-only) and four P2s, all fixed with tests: panels keyed per record and drop late responses; branding prefills from the database and Save waits for it; People Unverify is badge-only again and "Revoke and unlink" is a separate warned action; the dead-export rule no longer counts comments or import paths, which led to a second archive pass (62 entries in total, 19 kept). New `pnpm code:unused` (`scripts/check-unused.mjs`, in `pnpm check` and CI) fails on unused locals outside a two-item baseline under PLAY-01's claim. `pnpm check` 103 suites / 700 tests and every guard; Next portal 86/86. **Commit hazard:** whole-file archives stage as renames; commit by path including every importer.

  Migration `20261013120000_data_governance_closures.sql` is **written, not applied**; replayed 46/46 on PGlite (`scripts/replay/data01-closures-replay.mjs`), and the controls say "not switched on" until it is applied. The data map now also covers Storage buckets (4, all owned, uploaded to and read) and feature switches (38 of 38 read), and it fails on a dead switch. 0 rule failures; the only exceptions left are parked `operator_gigs` (Wave 3) and the seeded `ledger_accounts`.

- **2026-10-13 — DETECT-01 Engineering Support:** reused SUPPORT under ENGINEERING with INCIDENT_TRIAGE, TELEMETRY and RELIABILITY (last two moved from Operations). Added `detection:scan`, retained redacted local check logs, a 14-sensor catalog with 12 partial/gap declarations, incident/repair lifecycle and six named gap owners. Future-feature admin-ready review includes detection/repair ownership. QA, finance/security/data review authority stays independent. Scanner/review tests passed 10/10, roster 105 passes. Earlier full scan passed; latest scan passed 681 app tests and 86 Next tests but root gate caught 11 new adminControls exports awaiting consumers in concurrent DATA-01/Admin work. All failed/recovery scans are retained; runtime coverage remains partial. Independent review corrected timeout child cleanup, JSON secret redaction and hierarchy representations. Removed the stale PORTAL ColumnChart ownership reference; no source restored or deleted by DETECT-01. Handbook: `docs/engineering/ENGINEERING_SUPPORT.md`; tracker: `docs/agents/DETECT-01.md`. Runtime monitoring is not deployed.


- **2026-10-13 — Data governance team and the master data map (DATA-01, local).** The owner asked for a team that knows where every piece of data goes, keeps it connected to the right teams and functions, and stops dead data and code from piling up. New roles: `DATA_GOVERNANCE` reports to the CTO and is the data control point; `DATA_LINEAGE` keeps the map and `CODE_HYGIENE` handles dead code. Every one of the 105 agent definitions now names the control point (TEAMS contract item 11). `scripts/data-map.mjs` reads `schema.sql`, all app, portal and Edge Function code and `docs/engineering/data-ownership.json`, and generates [DATA_MAP.md](engineering/DATA_MAP.md): every table and view → owner, purpose, writers, readers, database functions, triggers and screens (traced per exported symbol through imports); every database function → callers. 50 tables, 3 views and 142 functions, 0 rule failures. `pnpm data:map:check` is in `pnpm check` and CI, and it fails on an unowned item, write-only or never-written data, an uncalled function or an untriaged unused export. Findings routed: F1 stats tables with no writer, F2 Crew notifications never sent, F3 operator GPS never read (privacy), F4 two admin functions with no control, F5 `get_aura_tier` unused. 64 unused exports triaged: 47 proposed for archive, 17 kept. **Nothing moved or deleted;** archiving waits on the owner. Three unused exports added earlier today by BOOKS-02 were removed. Handbook: [DATA_GOVERNANCE.md](engineering/DATA_GOVERNANCE.md); tracker [DATA-01.md](agents/DATA-01.md).

- **2026-10-13 — Office of the CFO and the Finance & Books hub (BOOKS-02, local).** Owner asked for a structured accounting and tax team that sees every expense and revenue dollar, works with Finance, owns taxes, and has a dev-team member building its data. New roles (registry, TEAMS, hierarchy, standards, plans): `CFO` reporting to the owner; `CONTROLLER` (`BOOKKEEPER`, `INTERNAL_CONTROLS`); `TAX` (`INFO_RETURNS`, `SALES_TAX`); `TREASURY`; `FPA`; and `FINANCE_DATA` in Engineering, assigned by the CTO. Chain of command, data requests and calendars: [FINANCE_OPERATIONS.md](company/FINANCE_OPERATIONS.md). `/admin/books` is now **Finance & Books** with Overview, Transactions (filters by date, kind, stream, channel, account, athlete, side, amount and text, plus a CSV of exactly the filtered rows), Statements, Taxes (pack, readiness, federal calendar with holiday rule, close steps), Reconcile (every source row matched to the revenue log), Data (finance data catalog and who owns what), Record & close (refunds of a whole charge by athlete) and Export. There is a **Finance** admin lens. Every money column is catalogued and `financeData.test.ts` fails on an unclassified one. Three independent reviews (RLS_SECURITY, CONTROLLER + TAX, QA) found 0 security blockers, 2 accounting blockers and a QA P1; all fixed. The migration replays 72/72 on PGlite (Postgres 18.6) with `scripts/replay/books01-ledger-replay.mjs`. `pnpm check`: 100 suites / 683 tests and all guards. `BOOKS-02` is admin-ready in feature-admin.json. Staging packet: [BOOKS01_STAGING_REHEARSAL.md](engineering/BOOKS01_STAGING_REHEARSAL.md). **Not verified:** staging application, hosted admin read, browser or device rendering, a QuickBooks import. No SQL applied, no money moved. Detail: [BOOKS-01.md](agents/BOOKS-01.md).

- **2026-10-13 — Browser playback error repair (PLAY-01, in progress).** Owner screenshots
  show aborted/unsuitable media at ReelCard play calls. Actual Expo video 57.0.5 web
  paths discard DOM play promises; a versioned web patch and current-source/focus/lock
  lifecycle repair are in progress. Current Lightning CSS direct and worker transforms
  pass without installation or quarantine changes. Baseline: 96 suites / 611 tests.
  [Claims and evidence](agents/PLAY-01.md); hosted metadata probe was blocked by automatic
  approval review, so current remote media contents remain unverified.

### Admin data consolidation — accepted locally (2026-10-12)

Source cross-check covers every editing desk, Books and twelve prior reports. App setup
joins Features/Look/Catalogs/Lab; Highlights & review joins content editing/moderation;
QA/Studio share Tools. Coverage opens Product Control map. Original editor routes survive.
Trends keeps unique comparisons; Analytics selects complete boards and preserves all 64
known measures plus returned additions; Revenue consolidates streams; Profile merges six
repeated settings. Health restores thirteen nullable operational checks and exact stock
count. Lab/QA remove secondary dashboards and keep draft/repair actions. Future feature
registration and admin-before-app checkpoints are wired into agent instructions and
`pnpm check`; empty registry validates no feature. Implementation plan/data map:
[ADMIN_DATA_CONSOLIDATION](engineering/design/ADMIN_DATA_CONSOLIDATION.md). Manage has 18
entries rather than 23; all 24 saved routes, including concurrent Books and the two redirects,
remain supported. Fresh `pnpm check`: 96 suites / 611 mobile tests, 13 workflow tests and all
guards; compatible Next models: 86 tests. Browser: 56 responsive reads and 19 interactions
passed. All eight Analytics boards, 13 expanded Health checks, 129 Control map rows / 33
Profile rows, original-editor search, saved redirects, invalid JSON and QA controls verified.
Web report fonts and Lab status contrast were corrected during the eye test. Browser Bridge
reused-marker clicks were inconsistent; a direct scoped trusted Profile click passed, and
remaining targets use unique markers. Source hashes and paired captures are recorded in
MAIN_ADMIN_PORTAL. This is a source-contract / synthetic local data cross-check; no hosted
data/write, SQL, publication or release acceptance. Concurrent BOOKS-01 work is preserved.


- **2026-10-12 — Books desk: bookkeeping, tax pack and QuickBooks export (BOOKS-01, local).** New Commerce desk `/admin/books` builds a double-entry journal from `company_revenue_logs` and paid `disbursements` against a fixed chart of accounts (`packages/shared-types/admin/bookkeeping.ts`). The family's 90%, the athlete's Vault 80% and the booster operator's 85% are liabilities held for them, not Tapua'i income. The desk shows the profit and loss, a roll-forward of money held plus a per-athlete subledger, the trial balance, the journal, and a tax-year pack: gross receipts, quarterly net with estimated-tax dates, pass-through money to reconcile a Stripe 1099-K, payees to review for 1099s, and Drip sales by month. It lists data problems worst first, including Suspense, a held account below zero, a missing Stripe-fee entry and a closed month that changed later. Exports: QuickBooks Online journal CSV (daily summary with no athlete names or ids, or one journal per record), general ledger, chart of accounts and tax pack. Exported cells are defused against spreadsheet formulas. Migration `20261012210000_bookkeeping_ledger.sql` (**written, not applied**) adds the seeded `ledger_accounts`, recorded entries that are voided by reversal and never edited, month closes with per-account totals, `tips.cover_fee_cents` (logged as `card_fee` revenue), `tips.stripe_payment_intent_id` and `disbursements.paid_at`. The checkout now sends the covered card fee and the PaymentIntent id. If those columns are missing it retries without only them, so channel, Rally and tip-to-Tapua'i data are kept. Copied onto `schema.sql`; SCHEMA.md, migrations README, AGENTS, LEGAL row X, docs index and [BOOKKEEPING.md](engineering/design/BOOKKEEPING.md) updated; tracker [BOOKS-01](agents/BOOKS-01.md). Tests: 23 engine, 5 desk, 1 checkout narrow-retry, finance and nav suites updated; `pnpm check` 92 suites / 574 tests and all guards; Next portal 86/86; the web bundle compiles with the desk. **Not verified:** Postgres replay of the migration, a hosted admin read, a browser or device render of `/admin/books`, and a real QuickBooks import. No SQL applied, no money moved.


- **2026-10-12 — Manage desks without a second dashboard (ADM-02 continuation, accepted locally).** The directory opens on request and closes on desk arrival. View and Group filters replace repeated headings; QA/Lab appear once in Tools. Twenty-two editing/utility desks remain discoverable; the saved `/admin/reports` address opens Analytics. Money now reads only disbursements and keeps its existing queue/status confirmations, with links to Revenue and Catalogs. Ledger totals, streams, origins and donation history remain in Revenue. Focused regressions: 40 tests passed. Full `pnpm check`: 90 suites / 544 tests and all guards; ten browser behavior checks passed, including physical Tab from search to the desk filter. Eight responsive checks passed at 1728/768/320px, including doubled phone text. Screenshot review caught and corrected nested filter clipping; final checks measure each filter button as well as page width. Hosted/native follow-ups remain open.

- **2026-10-12 — Main admin navigation polish (ADM-02 continuation).** Group controls browse desks without leaving the current report. Search matches existing desk labels/descriptions across the chosen lens and QA/Lab; results retain the original routes and controls. Open divider rows show desk descriptions. Longer reports offer section shortcuts scoped to their own scroll owner, so Expo’s retained stack screens cannot receive a jump. Home exposes the same Refresh action as other reports; it is disabled while loading or without report access. Revenue ring rotation no longer forwards an invalid `transform-origin` DOM attribute. Local acceptance: `pnpm check` 89 suites / 535 tests; 29 responsive reads and 11 mouse/focus checks passed; iOS/Android HBC exports passed. Hosted and native device follow-ups remain open. Evidence is recorded in [MAIN_ADMIN_PORTAL.md](engineering/design/MAIN_ADMIN_PORTAL.md). No data contract, SQL, money policy or hosted write changed.


- **2026-10-12 — Main admin combined (ADM-02, complete locally).** The owner selected the
  report design at local `:3033` and requested all administration in that experience.
  Main `http://localhost:8081/admin` now includes all twelve reporting views and all
  23 existing editing/utility desks. Shared platform-neutral report models live in
  `packages/shared-types/admin/`; Next remains a compatible reporting client. Home
  retains the donation count/change, View Trends and community support summary.
  Guest sign-in, the fan welcome exception, Expo 57 Slot style merging, SVG web props,
  enlarged money values and Manage expanded semantics were corrected during review.
  `pnpm check`: 89 suites / 529 tests and all guards; Next: 86 tests and optimized
  build; iOS/Android exports passed. All twelve reports fit 1440/320px; four tablet
  views and final Home/Revenue enlarged-text checks passed with synthetic data.
  Physical arrows/Data Space pass; physical Home/End and Data Enter remain limited
  by the browser tool. Hosted admin acceptance and native interaction remain pending.
  Ownership, released claims and exact evidence: [ADM-02.md](agents/ADM-02.md).
  No hosted SQL, role grants, publication or live-money changes were made.

- **2026-10-12 — Owner decisions applied: reports overflow fix and donation bands (written, not applied).** Migration `supabase/migrations/20261012180000_admin_reports_bigint_and_donation_bands.sql` casts every ms/cents sum in `get_admin_reports` to `bigint` (13 casts; a week past ~596 hours of tab time no longer fails every portal page), adds `donation_bands` (`under_50` / `50_to_250` / `250_plus` — counts of athletes by all-time donations, no names), and revokes anon execute. Copied onto `schema.sql`; migrations README and SCHEMA.md updated. RLS_SECURITY approved it by reading; no Postgres replay here. **Not applied anywhere** — the owner pastes it into the staging SQL Editor (no database credentials on this Mac). Trends and Analytics now show “Athletes by all-time donations” as three bands instead of the named top-5 list; until the migration is applied they show the missing state with a note, never zero. Portal tests 86/86. Not browser-checked (the mock has no `donation_bands`). Expo `/admin` Reports still lists donation totals by name (open follow-up). Vault money: owner chose direction A (credit it to the family account like donations), built after counsel with §6 item 8.

- **2026-10-12 — Local Expo launch recovery (ENV-01):** The owner's Lightning CSS screenshot names the loader's missing fallback, which can hide the first native loading error. Both installed ARM64 bindings and CSS transforms passed before repair; the historical failure was not reproduced. Seven native files had regained Firefox quarantine; removed that attribute from those files only, then restarted Metro with the current Expo dependency tree and the existing public client configuration. Fresh web/server and iOS development bundles passed; browser rendered the Home/feed shell, and Metro remains on port 8081. `pnpm check` passed **78 suites / 443 tests** and all guards. Browser playback remains unverified: a failed legacy MP4 responds 200 with `text/plain` (ENV-02); interrupted `play()` requests alone do not prove a player race. This launch check does not accept playback, device behavior or hosted photo SQL. TROUBLESHOOTING now explains the direct native probe and narrow repair. Codex reviewers reconciled stale photo-story/tester/metadata documentation; current registry ownership remains in place. No dependency version, app source, SQL, payment, model pin or deployment change.

- **2026-10-12 — ADM-01 fix waves 1–3, event labels and the report format everywhere (local, uncommitted).** Fix waves 1–3 (`PORTAL`, `ADMIN`, `ANALYST`, `COMMERCE`) closed the Phase C findings in `apps/admin-portal`. New `lib/measureColors.ts` gives each measure one colour on every page, including the hype and schools keys. `lib/reports.ts` exports `streamName` / `streamSplitText`, so no page shows a raw split. The VOICE round reworded money lines; the Vault split now reads “Vault: 80% recorded for the athlete, 20% to Tapua'i · Drip: 100% to Tapua'i”. Heading levels are fixed, every signed-in page has a “<Page> · Tapua'i Admin” title, LoginForm has always-mounted live regions, `formatMinutes` follows one rule everywhere (`<1 min`, whole minutes), and Analytics’ “Around the game” chart is gone. New `lib/eventLabels.ts` replaces raw telemetry keys (`reel.seki`, `upload.retry · upload`) with readable labels on Trends, Analytics, Health and Departments, and `/login` has the title “Sign in”. **Owner decision:** Codex’s report format (wide header, underline tabs, open panels, report charts; entry below) is the default look on every page, and Codex’s static header (WCAG 2.4.11) replaces the sticky one. `PORTAL` then fixed defects inside that look without reverting it: numbers no longer split mid-value (the `main` wrap rule is `overflow-wrap: break-word`, values are `whitespace-nowrap`), peak labels anchor at the first and last day (`peakLabelAnchor` in `lib/chartScale.ts`), `plotHeight` is in CSS pixels, dead `.community-*` CSS is removed, the active tab measures 5.97:1, chart props have JSDoc, and Home video stalls show red. **Verified:** `pnpm check` (both typechecks, 78 suites / 443 tests, docs/links/copy/boundaries/comments/agents/client-keys guards) and portal unit tests 80/80 on Node v24.21.0. The earlier VISUAL_QA + QA browser pass on waves 1–3 (before the report format) rejected only the raw event keys, now fixed; it found the header static on every page and Shift+Tab never left focus under it at 1280px. **Final review:** VISUAL_QA + ACCESSIBILITY reviewed every page at 1440/768/375, plus 320 for Home, Analytics and Health (58 width-verified DOM captures): no overflow, titles correct, event labels read as words, one h1 per page, the peak label inside its chart, header static, keyboard focus visible and never covered. ACCESSIBILITY PASS. The one P2 (Health Errors “Every row” count `22` splitting at 320px) is fixed: the `OperationsBoard.tsx` value cell is `shrink-0 whitespace-nowrap`, SplitBar totals are nowrap, the Product tab uses `aria-current="true"` on its sub-desks, and Home’s “Data sources” summary shows its disclosure marker. Recheck: VISUAL_QA ACCEPT (`.smoke/admin-portal-mock/shots-recheck/`, `shots-final/`). **Not verified:** Enter on a Data `<summary>` (Browser Bridge cannot send that keypress; Space works), native devices, hosted data. P3s open: source/config keys visible outside Data disclosures (worst on Sign-in, `auth/page.tsx`); `LedgerTables.tsx:87` detail values share the old wrap pattern but did not split. This entry replaces Codex’s separate keyboard-focus entry. Detail: [ADM-01.md](agents/ADM-01.md). No SQL, deploy, hosted data or commit. Owner decisions of 2026-10-12: Vault money takes direction A (credited to the custodial family account like donations), pending payments counsel with §6 item 8 and not built; the `get_admin_reports` `bigint` overflow migration (`20261012180000_admin_reports_bigint_and_donation_bands.sql`) is approved for staging, written, and not yet applied (the owner pastes it into the SQL Editor); and counts by donation band, with no names, replace the all-time donation-total list (VOICE #26).

- **2026-10-12 — Portal report format (Codex, locally verified).** Trends, Audience, Revenue, Health, Product, Analytics and Departments now follow Home’s wider frame, bold type, underline navigation and open chart/KPI/panel/ledger surfaces; Product subpages match. Home keeps its unique community overview. Fixed enlarged-text wrapping in legends, metric/provider rows and status actions; phone KPI type retains whole figures. Verification: 22 desktop/phone captures, all eleven pages at 320px with normal/doubled text, 11 focused captures and six final combined-source views. Native Health tabs, Data values/source, keyboard focus and section links pass. `pnpm check`: 78 suites / 443 tests and all guards; portal tests 80/80; final isolated build passes; 17 touched source files match the copy. Data math, sources, legal notes and write boundaries are preserved for this rollout. Preview restored to ordinary Home with synthetic data and no console errors. Enter/Space remains unverified; the separate full-portal specialist review is done and accepted (VISUAL_QA ACCEPT, ACCESSIBILITY PASS, 2026-10-12). [QA](engineering/design/COMMUNITY_DASHBOARD_QA.md) · [plan](engineering/design/COMMUNITY_DASHBOARD.md).

- **2026-10-12 — Community support Home (Codex, locally verified).** The owner selected Canva media `MAHX0lvDx3I` (“A week of community support.”). Home uses an open donation overview, a wide jade area chart and compact cyan clip chart; all eight KPI meanings and the remaining operational sections stay available. Optional shell/chart report props preserve other consumers’ defaults. The combined source/render comparison, 1728/768/390/320px layouts, 320px/200% text, missing-key and RPC-failure states pass locally with synthetic data. Native Data mouse activation and Trends navigation pass; desktop Shift+Tab leaves Data at y=9.95–33.95 with an unobscured focus ring, while the static header ends at y=-507. Enter activation through Bridge remains unverified; macOS blocks Playwright Chrome launch (also Launch Services -54). `pnpm check`: 78 suites / 443 tests and both typechecks/guards; portal tests 72/72; isolated Next build passes and all five source hashes match. [Plan](engineering/design/COMMUNITY_DASHBOARD.md) · [Design QA](engineering/design/COMMUNITY_DASHBOARD_QA.md). Preview `localhost:3032` / owned synthetic mock `:54398`; normal data restored. No new data keys, routes, dependencies or hosted changes.

- **2026-10-12 — Admin portal charts (ADM-01).** Every portal page now draws its numbers with one inline-SVG chart kit in `apps/admin-portal/components/charts/` and `lib/chartScale.ts`. Each chart has a written summary and a Data table with every value. Muted text is darker so it passes contrast. Home, Audience, Health, Departments, Product, Trends, Revenue, and the eight Analytics dashboards were rebuilt on it. Health tabs move with the arrow keys. A number the read did not return shows “—”, not $0.00. Revenue keeps the test-mode banner, splits donations by `platform_bps`, and says so when it falls back to the last 200 donation rows. Labels now say QR donation link, Gear goal, and Game Day. Time on tabs shows minutes and scroll depth shows a percent. ACCESSIBILITY signed off after six fixes. The 48 portal unit tests pass. No hosted data was read, no signed-in render was checked, and the Phase C review is still open. No SQL applied.

- **2026-10-11 — Poll, upload menu, and Highlight bar.** A chosen cheer is a white button with a jade or cyan edge, so it does not turn into the same green as the share bar. The upload sheet keeps the choices and Next together in a centered menu. The Highlight bar is Home, search, and Local. All and Seki are off that bar. No SQL applied.

- **2026-10-11 — Analytics dashboards.** The admin portal header opens Analytics. Eight dashboards (Highlights, Donations, Audience, Attention, Trust, Game day, Playback, Ledger) read `get_admin_reports` and `get_company_revenue_summary`. Each number is a named measure. A missing key stays blank. Daily people, retention, and donation conversion stay listed as not measured. `ANALYST` reports to `ADMIN`. Roster is 92 agents. No SQL applied.

- **2026-10-11 — Upload without a blank screen.** Choosing the athlete in a Highlight no longer mounts a video view inside the sheet, which is what covered the phone. A video needs a clip, a caption, and one permission line. Tag later posts it with no athlete, and Home says “Not tagged yet.” Donate stays off until someone is tagged. If the signed-in account is that athlete, This is me is the first choice. Photo stories still need an athlete. The permission line is the same footage, sound, and marks sentences, stored as rights version `2026-10-11`. No SQL applied. The night preview (`5cca4a55` / `c5255651`) does not include this.

- **2026-10-11 — Preview queued again.** Android `5cca4a55-cfc3-4c58-9346-34b9e0433b27` and iOS `c5255651-06e3-4f46-9861-5a47ad1b434a`. The archive includes the popup swipe and the upload black-screen fix. iOS still installs only on the one registered iPad. These builds were queued, not confirmed finished. The evening builds `04244951` and `12d017d4` do not include that fix. The web admin portal is not in them. No SQL applied.

- **2026-10-11 — Popup swipe and upload black screen.** A downward swipe on the top of a popup now uses the system touch path, so it works inside a phone menu. After a Highlight publishes, the clip preview is removed before the sheet closes, and the feed updates after that. Closing with the preview still attached left a black screen and no buttons. The installed preview does not include this until the next build. No SQL applied.

- **2026-10-11 — Preview queued again.** Android `04244951-ae6a-4816-9590-5bcde4b527fb` and iOS `12d017d4-5227-4093-a649-74212332fe88`. The archive is the local app, including guest looking, the sign-in sheet, swipe-to-close, and the owner-card fix. iOS still installs only on the one registered iPad. These builds were queued, not confirmed finished. The web admin portal is not in them. No SQL applied.

- **2026-10-11 — Admin portal home.** After sign-in, Home shows eight measured numbers and four 7-day charts (donations, clips, time on tabs, video stalls). The bar is six equal tabs: Home, Trends, Audience, Revenue, Health, Product. Departments is a link, not a tab. Daily people, retention, donation conversion, acquisition cost, and how long a family stays are listed as not measured. Jev preferred the equal bar (`bar`, probability 0.66, confidence 0.32, 657 input tokens). No SQL applied.

- **2026-10-11 — Owner card on the web.** Swiping a Highlight sideways to see who owns it crashed the browser: the card asked the web page for a native focus handle. That focus move now runs on the phone only. The card still opens in the browser. No SQL applied.

- **2026-10-11 — Swipe to close, and Operations tabs.** A downward swipe on a popup menu’s grab bar closes that menu. The age confirmation stays up. The upload composer stays a full sheet so a swipe does not throw away a draft. Admin Operations (`/operations`) has four tabs: Where, Buttons, Errors, and Menus. Each tab leads with one sentence, then the ranking, then every smaller row. Portal load failures sit above app errors. Menus show what is on. Switches stay in Expo `/admin`. Jev preferred four tabs (`lenses`, probability 0.64, confidence 0.28, 466 input tokens). No SQL applied.

- **2026-10-11 — Management desk.** ADMIN owns the admin portal. The Next portal at `/manage` is one page for Billing, Marketing, Support, API, and IT. A failed read is red. An empty window is gold. Charts use the reports and revenue the portal already loads. Analysts and a partner read that page after an admin signs them in. There is no public data key. `PORTAL` reports to `ADMIN`. Roster is 91 agents. Jev chose the single page (`board`, confidence 0.90, probability 0.95, 466 input tokens). No SQL applied.

- **2026-10-11 — Test account on the preview server.** `demo@tapuai.app` was missing on staging, so Sign in and Use test account both returned invalid credentials. The confirmed test account is there now, with the password the sheet shows. The sign-in sheet is Apple, Google, email, and password, plus a Create an account link. The 13+ confirmation, the prototype terms line, and the email link are only on that create step. No new SQL migration. The current preview install can sign in with the test account before the next build.

## 5. Known broken / not yet applied

Do not re-diagnose these. Fix them or leave them.

| Thing | State |
| --- | --- |
| `clear_reel_hype` is on development and staging | Applied on development 2026-10-17. Un-voting a Seki/Aura/Flex should keep the lower count after refresh. |
| `telemetry_logs` INSERT policy is `with check (true)` for `anon` | **Shape-bounded on staging and, as of 2026-10-17, on development** (`20260929190000_telemetry_logs_bounds.sql`). Guest inserts stay on purpose. Still open: many small valid-looking rows. Closing that needs §6 item 1, not a silent drop of guest telemetry. |
| `telemetry_logs` has no `user_id` / `session_id` | No funnels, retention, or per-user behaviour is possible. Owner chose "session + user id" but it is **not built** — it is a privacy change needing policy copy first (§6). |
| Expo web bundle | Historical Lightning CSS loader failures; fresh web/server and iOS development bundles passed 2026-10-12 after a narrow quarantine cleanup and Metro restart. Browser Home/feed shell rendered. Historical first loader error not reproduced; playback/native/device and hosted photo SQL are not accepted by this launch check. Diagnosis in TROUBLESHOOTING §0b. |
| Legacy Vault objects in public Storage | `reels` / `game_highlights` / `avatars` are public buckets. Older Vault-locked video stored there remains directly downloadable, bypassing entitlement. New Vault uploads use private `reel_vault` with authorized signing and no public fallback; that does not remove legacy bytes. Legacy private-content exposure remains an internal-only ROADMAP Phase5 hard blocker. |
| `auth.role() = 'anon'` bypass on 8+ tables | Studio Unlock and Operator PIN have no real session. Accepted for internal testing, **not** for public beta. |
| Staging and development both have the September SQL | Staging received it on 2026-09-30. Development received the same chain on 2026-10-17, plus the October trivia files. Preview builds may still point at either project. Confirm the installed build before device testing. |
| Branch integration pending | **Committed locally 2026-10-16 as `5efdf57`** (owner chose one commit of all 688 changed files now, §6 item 15): admin, Books, data governance, support/detection, privacy/minors/payee, portability, Beyond/challenges, Calm Island and PLAY-01's in-progress patch. Not pushed or merged; `wave0-custodial-verification` is 63 commits ahead of the cached `origin/main` (remote freshness unverified). Still open: merging into `main`, pushing and branch protection (R1-02, owner). The root `screenshot.png` was left out on purpose (stray, unreferenced). |
| Self-verify holes — fixed on staging and development | `20260929120000_athlete_verification_ladder.sql` is on development as of 2026-10-17. Production still does not exist. |
| Held gifts have no cap or refund yet | Gifts to an unverified athlete are "held" only because payouts are 503. The design's ~$250 cap and 30-day refunds need the Phase 1a ledger. Future payout code must call `athlete_payout_allowed`. |
| School confirm link needs the app | `alasports://school-confirm` opens only where Tapua'i is installed (Edge Functions can't serve HTML on the default domain). A web page for staff without the app is not built. Schools desk confirmer management is built locally in DATA-01; the closures migration remains unapplied, so hosted staff setup still uses the SQL Editor. |
| Report reasons built; strikes and appeals unbuilt | `20261001180000_content_rights_reports.sql` stores a reason and hides on athlete/guardian reports, high-risk reasons, or three distinct reporters. One ordinary rival report no longer hides a clip. Staging application is recorded in TEAMS; not re-queried here. Local Open flags columns show the reason, the clip, the reporter count, and whether an athlete or guardian reported it. Strikes and appeals remain unbuilt. This session did not query the hosted database. |
| Storage write policies on `reels` check the folder owner on development | `20261007231000_reels_storage_owner_folder.sql` applied on development 2026-10-17. Confirm staging separately before testers post photos of minors. The `game_highlights` fallback bucket keeps bucket-only policies. |
| Failed photo-story cleanup — local repair, SQL not applied | Owner cleanup RPCs, terminal write guards, fresh retries and minimal owner/reel local removal intent are implemented. Same account resumes on Upload open; unexpected paths fail closed, committed stories are preserved. Migration `20261020190000` has not been applied; actual PostgreSQL replay/hosted Storage deletion and concurrency are unverified. Unknown-id/historical/abandoned/closed-account cleanup remains separate; [contract](engineering/design/PHOTO_STORIES_DESIGN.md#failed-upload-cleanup-repair--2026-10-20). |
| Guest vote / hype stuffing (public beta blocker) | `cast_cheer_vote` and `increment_player_hype` stay guest-callable with no limit (by design for Wave 0); a guest can stuff poll votes and inflate hype counts that feed Spotlight. Needs a per-device / per-account limit or signed-in-only before public beta (WORK_QUEUE DATA-01-F11). |
| Payee verification is on development (VERIFY-02) | SQL applied on development 2026-10-17 per existing record; not re-queried. Connect persistence repaired locally (server credentials, confirmed conditional save before links). `record_stripe_kyc` automatic identity/TIN evidence remains unwired: Accounts v2 capabilities are insufficient, and unknown snapshots must not overwrite genuine checks. Guardians still need school confirmation by a second admin. Payouts remain503; staging/deployed Connect/Stripe behavior not verified here. [Plan §8](engineering/design/PAYEE_VERIFICATION_PLAN.md#8-connect-persistence-repair--2026-10-20-local-app). |
| Minor accounts are on development (MINOR-01) | `20261014110000_minor_accounts.sql` applied on development 2026-10-17. The consent form is a **draft** for counsel (LEGAL row AA) — do not show it to real families. Future RLS tables must add the "Closed accounts" policy. Staging was not part of this apply. |
| Profile privacy is on development (PRIV-01) | `20261014090000_profile_privacy.sql` and `20261014100000_tag_approval.sql` applied on development 2026-10-17 after `Public Read Profiles` and `Users can read own stripe data` were dropped. `Public Update Profiles` (UPDATE for everyone) was left in place. Avatar files stay public. Staging was not part of this apply. |
| Profile photo overwrite closed on development | `20261013230000_avatars_owner_folder.sql` applied on development 2026-10-17. Whether minors' photos should be visible to guests at all is open (WORK_QUEUE P1-02). Confirm staging separately. |
| Withdrawal requests not capped | `request_custodial_withdrawal` does not check the amount against what is recorded for the family. Payouts are blocked today; the cap depends on how money reaches families (§6 item 8). LEGAL row X. |
| Function access hardening is on development | `20261013210000_function_access_hardening.sql` applied on development 2026-10-17. Confirm staging separately before treating the public key as closed there. |
| DATA-01 closures are on development | `20261013120000_data_governance_closures.sql` applied on development 2026-10-17. Confirm staging separately. |
| Parent payout writes are closed on development | `20261013220000_disbursements_guardian_scope.sql` applied on development 2026-10-17 (admin-only writes; a paid payout stays final). Before live payouts (WORK_QUEUE DATA-01-F10a, with §6 item 8): link payouts to approved withdrawals, two-person approval, guardian access ending at handover. Confirm staging separately. |
| Books migration is on development | `20261012210000_bookkeeping_ledger.sql` applied on development 2026-10-17. Stripe fees, refunds and disputes are still not recorded per charge until the webhook path (§6 item 3) exists. Confirm staging separately. |
| Fan Zone and Beyond are on development without a partial storage index | Applied 2026-10-17 after the `create unique index` lines were removed. postgres cannot own `storage.objects`. Triggers `fan_zone_storage_guard` and `beyond_storage_guard` are in place. Buckets are private. Switches stay off until an admin turns them on. Coach-level `20261017090000` was not run. |
| Guests cannot read Rallies once function-access hardening is applied | Found 2026-10-20 by access parity: the `Read public or own rallies` policy calls `rally_manager_role()`, which `anon` may not execute, so a guest read of `public.rallies` fails with 42501 instead of returning live rallies. Development has the hardening since 2026-10-17. Fix written 2026-10-20: `20261020090000_rallies_guest_read.sql` splits the policy (replay 123/123, guest/fan/admin checks); **not applied anywhere** — apply on staging and development, then confirm a guest sees a live Rally meter. |
| Home highlights share one file | On 2026-10-17 the eight development highlight rows were pointed at `reels/guest/1790555709423.mp4` because the other objects are 14-byte “File not found” placeholders (one leftover QuickTime still served as text). The placeholders remain in the bucket. |

---

## 6. Open decisions (owner's call — do not default these)

1. **Telemetry identity.** Owner selected session ID + user ID. Blocked on privacy work: the
   Terms copy does not yet disclose per-account behavioural logging, and `telemetry_logs` SELECT
   is currently open to any authenticated user — that must become admin-only in the same change.
2. **Video host** — Cloudflare Stream vs Mux (ROADMAP Phase 5). `reel_vault` signing is a bridge.
3. **Stripe webhook crediting + payout ledger** — ROADMAP Phase 1a. Do not enable the webhook's
   crediting branch without retiring the client-side `tips` insert, or every tip double-credits.
4. **Parent-as-payee Connect** — *partly decided 2026-09-29* (design doc §7): guardian holds one
   custodial account per athlete; athlete sees every gift and must approve every guardian
   withdrawal; control passes to the athlete automatically at 18 (or the state's age); a bank
   account in the athlete's name is strongly encouraged. Still open: counsel on the handover age
   per state (Utah UTMA is 21), the Stripe mechanics in §7 (manual payouts gated on approval,
   moving the balance to the athlete's own account at handover), and the remaining sign-offs.
5. **Stats** — *decided 2026-09-29:* a light game line from the game-day gig (ROADMAP Mission M5),
   rolled up from the per-player `game_events` the scorer screen already writes. Not scraping, not
   coach entry, not full Hudl. Still open: the operator fee, who counts as an authorized game
   manager (background check), and how ratings work.
6. **1-on-1 safety rules** (Mission M4, Train Like Me / Serve Like Me) — adult hosts first, parent
   books and can join for minor fans, in-app and recorded, no DMs with minors. Owner + counsel sign-off
   before any 1-on-1 ships; paid sessions are NIL for the host.
7. **Pathway savings structure** (Mission M7) — how "College-ready" / "Beyond the game" money is
   held for minors (UTMA, 529, licensed partner). Counsel's call; build no fund-holding until then.
   Story and marketing guardrails: `docs/product/STORY.md`.
8. **How money reaches families (Wave 1 gate).** Recommended: Stripe Connect destination charges
   to the guardian's account, so gifts never sit in the platform balance and no payout ledger is
   needed. The alternative is today's platform-balance model plus the Phase 1a ledger (B3). Owner +
   payments counsel.
   - **Direction chosen, pending counsel (2026-10-12, ADM-01 VOICE re-review): Vault money and the
     family account.** The ledger records the Vault 80% for the athlete (`company_revenue.sql`,
     payee_kind `athlete`), but `get_custodial_summary` sums only `tips`, so Exclusive money is not
     credited to, or shown in, the custodial family account. **Owner, 2026-10-12: direction A.**
     Vault/Exclusive money is to be treated like donations, credited to the same custodial family
     account under the same guardian rules. Nothing is built now (Wave 0 is test mode); it is
     finalised together with this item when the owner meets payments counsel, and portal copy keeps
     "recorded for the athlete" until then. Owner + `COMMERCE`; see `docs/agents/ADM-01.md` owner
     decision 3.
9. **Fee model** — *decided 2026-09-29:* keep the 10% platform share, disclosed on the donate sheet
   (90% to the family account; card processing comes out of Tapua'i's 10%), plus a GoFundMe-style
   optional tip for Tapua'i at checkout (default No tip, never pre-selected). Built; SQL recorded applied to staging on 2026-09-30, not development.
   Still open: counsel on App Store 3.2.1(vii), which appears to require 100% for non-IAP gifts —
   fallback is `MALO_PLATFORM_CUT_BPS` = 0 with the tip kept (LEGAL row L).

10. **Athlete verification and fake highlights** — `docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md`.
    **Decided 2026-09-29:** gifts are held until verified and the athlete sees that in the app; the
    athletic director or coach confirms each student in person on a Tapua'i form. Built; verification SQL recorded applied to staging, not development. Still open: the pending-gift cap amount and refund window (need the ledger), and
    counsel on the "held" copy.

11. **Fan digital signature on the Aura card** — *later, not this wave (owner 2026-10-02).* A fan
    can earn a signature and place it on their Aura card, alongside other card extras in a later
    phase. Do not build the capture, storage, or card slot now.

13. **Beyond phrase (owner 2026-10-16, open).** Test all four candidates — Seki Set, Extra Rep, OT, Two-a-Day — with users before choosing (FAMILY_FUN_PLAYBOOK "Beyond phrase test"; LEGAL row AC for trademark and cultural review). Do not put one in app copy before the owner picks.

14. **Workout safety label (owner 2026-10-16, built locally).** SAFETY-01 uses the proposed option A wording in the app. Counsel has not approved it (LEGAL row AC). Whether labelled workouts must leave friend challenges, and teen-upload review, stay open. Invites still work and show the notice. Migration `20261017090000` is written, not applied. [Design](engineering/design/COACH_LEVEL_LABEL_DESIGN.md).

15. **Commit (owner 2026-10-16).** Owner chose to commit all uncommitted work now (527 entries across sessions, by path, no push) instead of waiting for PLAY-01 / DETECT-02 to release claims; this supersedes the 2026-10-13 "one coordinated pass once claims are released" note in §5 for this commit.

12. **Hosting and environments (owner request 2026-10-13).** **Owner 2026-10-14: takes the recommendation** — stay on managed Supabase with self-hosted Supabase as the drilled exit; portability plan in [PORTABILITY.md](engineering/PORTABILITY.md). Video provider and the remaining §9 sub-decisions stay as listed in the brief. Recommendation: stay on managed Supabase (dev / staging / prod) for Wave 0–1, with self-hosted Supabase on AWS as a quarterly-tested exit; AWS over Azure unless a partner requires Microsoft. Owner decisions listed in [ENVIRONMENTS_AND_HOSTING.md](engineering/ENVIRONMENTS_AND_HOSTING.md) §9. Every engineer's view (49 roles, unanimous for staying), cost with our time and the CTO's three yes/no questions: [HOSTING_DECISION_BRIEF.md](engineering/HOSTING_DECISION_BRIEF.md) §9. Prices unverified until internet mode is on. Supersedes nothing yet; the 2026-09-29 "not moving hosts" note stands until the owner confirms.

---

## 7. Where everything lives

| Document | Purpose |
| --- | --- |
| **`docs/STATE.md`** | **This file.** Current state, recent work, known breakage. |
| `docs/agents/TEAM_HIERARCHY.md` | Org chart: departments → agents → `.claude/agents` files. Easy lookup. |
| `docs/agents/WORK_QUEUE.md` | Ordered specialist assignments, acceptance criteria, current evidence and owner gates. |
| `docs/agents/DEPARTMENT_PLANS.md` | Each department's current level and its next plan, including Legal's public-launch list. |
| `docs/agents/EXPERT_STANDARDS.md` | Department expert bar and the model connected to each agent. |
| `docs/engineering/MENU_STYLE_MAP.md` | Shared menu/page APIs, modal consumer coverage, intentional visual exceptions and device verification gaps. |
| `docs/agents/TEAMS.md` | Call sheet: Now / Next / Later, surfaces, do-not-touch. |
| `AGENTS.md` | Folder law, path aliases, tech-stack guardrails. `CLAUDE.md` imports it. |
| `docs/README.md` | Index of every document, by folder. |
| `docs/ONBOARDING.md` · `docs/GLOSSARY.md` | Human entry point (reading order, setup, first day) · code names ↔ product words. |
| `docs/engineering/SYSTEM_OVERVIEW.md` | System overview and directory map (was root `DOCUMENTATION.md`). |
| `archive/README.md` | Reference-only code (old `my-app/` playground). Never built or imported. |
| `docs/product/ROADMAP.md` | North Star (Watch & compete / Rally / Pass it on / Rise), Release waves 0-3 (cheapest first), Phases 0-5, Mission track M1-M10. |
| `docs/product/STORY.md` | Mission narrative, marketing lines, and the guardrails that keep athletes eligible. |
| `docs/engineering/design/ATHLETE_VERIFICATION_DESIGN.md` | Open sign-up, the athlete verification ladder, gifts while pending, safe growth, fake-highlight takedown. Ladder + in-person school confirmation built; §6 (fakes) still a proposal. |
| `docs/engineering/CODE_ORGANIZATION_PLAN.md` | **Readiness phases R1–R4** (tidy → rebuildable database → production environment → easier to change) with checklists; R1 done locally 2026-10-07. Also keeps the code cheap to move hosts later (we are **not** moving now): commit hygiene, dated SQL files, generated types, big-file splits, a Supabase-coupling map, and the rule that screens call `lib/`, never Supabase directly (6 Expo route files / 12 calls still break it as of 2026-10-07; CI blocks growth). Step 0 + reviewer notes/guard done. |
| `supabase/migrations/README.md` | How migrations work here, how to apply without the CLI, the baseline steps, adding a school confirmer. |
| `docs/engineering/STAGING_RUNBOOK.md` | Step-by-step staging project + tester build. |
| `docs/engineering/TESTER_SCRIPT.md` | Phase 3 tasks per role, organised by pillar, plus feel questions. |
| `CHANGELOG.md` | Permanent dated record of product and schema shifts. |
| `docs/engineering/SCHEMA.md` | Tables, RPCs, RLS, Aura palette. `docs:check` fails if it omits a table. |
| `docs/engineering/ARCHITECTURE.md` · `docs/ONBOARDING.md` | Monorepo map · clone-and-run. |
| `docs/engineering/AUDIT_REPORT.md` | Interaction audits. §1-7 are the 2026-09-14 snapshot; newest pass is at the top. |
| `docs/agents/TEAMS.md` · `.claude/agents/*.md` | Department ownership and dispatch. |
| `.cursor/rules/documentation.mdc` | The full doc-sync obligation table. |
| `docs/engineering/TROUBLESHOOTING.md` | Metro / Expo / env failures. |
| `docs/product/VOICE.md` · `.claude/agents/voice.md` | Donation language rules (Donate / donation; "tip" only for the tip for Tapua'i). `copy:check` enforces the retired words. |
| `docs/legal/LEGAL_BRIEFING.md` | Every legal / money-copy risk as a lettered row (L = the 90 / 10 disclosure, P = filmer cash, R = optional tip, S = preset thank-yous, T = Rally). LEGAL owns money copy. |
| `docs/product/PUBLIC.md` · `docs/company/INVESTOR.md` · `docs/product/PRODUCT_FACTS.md` | Public / investor story. `PRODUCT_FACTS.md` and the `product-facts` blocks are **generated** by `scripts/sync-front-docs.mjs` — do not hand-edit them. |
| `docs/company/COMPANY_PHASES.md` | Company phases, billing plan B0–B7 (when money becomes real). |
| `docs/engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md` | Guardian-as-payee and custodial money rules (§7). |
| `docs/engineering/CONVENTIONS.md` | Naming and where files go. |


Final phone review also caught and fixed Lab editor/feedback overlap. Column editors
now keep their natural height; desktop keeps equal columns. The direct geometry
regression and full gate pass. Evidence: ADMIN_DATA_CONSOLIDATION / MAIN_ADMIN_PORTAL
and `.smoke/main-admin/consolidate-lab-layout-final.json`.


Final local total: **60 responsive/geometry checks** (56 broad reads + four Lab
sibling-geometry checks), **19 interactions**, and **32 stable reviewed source hashes**.
Ordinary sample Home is restored with its heading at y=162 and no test iframe. Aggregate
evidence: `.smoke/main-admin/consolidate-acceptance.json`; reviewed captures are in
MAIN_ADMIN_PORTAL. This acceptance covers local source and fixtures.
