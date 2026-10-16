# STATE — read this first

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

## 0. Pick up here (current hand-off 2026-10-13; historical setup 2026-10-07)

**Current hand-off.** Branch `wave0-custodial-verification` is at
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
development project does not have the staging SQL.

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
   `canva`, `expo` and `supabase-dev` from `/mcp` (`docs/engineering/TOOLING.md`).

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

- `apps/mobile` — Expo Router SDK 57 app (Highlights ⚡ / Activity / Spotlight / Drip / Profile)
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
| `clear_reel_hype` is on staging, not the development project | On the development database, un-voting a Seki/Aura/Flex no longer flickers, but the count **returns on refresh**. |
| `telemetry_logs` INSERT policy is `with check (true)` for `anon` | **Shape-bounded on staging, not on the development project** (`20260929190000_telemetry_logs_bounds.sql`; the five CHECKs on staging were read back 2026-10-02 and match the file). Guest inserts stay on purpose. On the development project one row can still report a nonsense event or an 11-day stall and skew Reports / Coverage / Money; on staging a single row cannot. Still open: many small valid-looking rows. Closing that needs §6 item 1, not a silent drop of guest telemetry. |
| `telemetry_logs` has no `user_id` / `session_id` | No funnels, retention, or per-user behaviour is possible. Owner chose "session + user id" but it is **not built** — it is a privacy change needing policy copy first (§6). |
| Expo web bundle | Historical Lightning CSS loader failures; fresh web/server and iOS development bundles passed 2026-10-12 after a narrow quarantine cleanup and Metro restart. Browser Home/feed shell rendered. Historical first loader error not reproduced; playback/native/device and hosted photo SQL are not accepted by this launch check. Diagnosis in TROUBLESHOOTING §0b. |
| Storage buckets `reels` / `game_highlights` / `avatars` are public | Vault-locked video is directly downloadable, bypassing entitlement. Accepted for internal testing only — ROADMAP Phase 5 hard blocker. |
| `auth.role() = 'anon'` bypass on 8+ tables | Studio Unlock and Operator PIN have no real session. Accepted for internal testing, **not** for public beta. |
| Staging has the September SQL; the development project does not | Applied 2026-09-30 to `ala-sports-staging` only. The 2026-10-01 preview builds are recorded as pointing at staging (§0); older installed builds may still use development. Confirm the installed build before device testing. No remote re-verification this session. |
| Branch integration pending | **Owner, 2026-10-13: commit in one coordinated pass once DETECT-02 and PLAY-01 release their claims** — nothing has been committed since 10/12, and Books / DATA-01 build on uncommitted ADM-02 and admin-consolidation work, so a partial commit would not build. Order: admin (ADM-02 + consolidation), Books (BOOKS-01/02), data governance (DATA-01), engineering support (DETECT-01/02), playback (PLAY-01), each by path with the full gate green; archives stage as renames. At local review, `wave0-custodial-verification` matches its cached origin ref and is 33 commits ahead of cached `origin/main`. This session's changes are uncommitted. No push or merge performed; remote freshness unverified. |
| Self-verify holes — fixed on staging, still open on the development project | On the development database: `profiles.player_id`, `is_verified` and `verification_status` are client-writable (no column guard on "Users update own profile"), so any signed-in user can mark themselves verified and self-link to any athlete; a shared team code verifies instantly; admin approval stamps every profile with the same name. The client no longer does any of this, but the database still allows it until `supabase/migrations/20260929120000_athlete_verification_ladder.sql` is applied. ROADMAP Wave 1 blocker. |
| Held gifts have no cap or refund yet | Gifts to an unverified athlete are "held" only because payouts are 503. The design's ~$250 cap and 30-day refunds need the Phase 1a ledger. Future payout code must call `athlete_payout_allowed`. |
| School confirm link needs the app | `alasports://school-confirm` opens only where Tapua'i is installed (Edge Functions can't serve HTML on the default domain). A web page for staff without the app is not built. Schools desk confirmer management is built locally in DATA-01; the closures migration remains unapplied, so hosted staff setup still uses the SQL Editor. |
| Report reasons built; strikes and appeals unbuilt | `20261001180000_content_rights_reports.sql` stores a reason and hides on athlete/guardian reports, high-risk reasons, or three distinct reporters. One ordinary rival report no longer hides a clip. Staging application is recorded in TEAMS; not re-queried here. Local Open flags columns show the reason, the clip, the reporter count, and whether an athlete or guardian reported it. Strikes and appeals remain unbuilt. This session did not query the hosted database. |
| Storage write policies on `reels` do not check the folder owner | Found 2026-10-07 during the photo-story review: the bucket's INSERT/UPDATE policies only check `bucket_id = 'reels'` and an authenticated session, and uploads use `upsert: true`, so any signed-in user could overwrite another user's video or story photo by path. Pre-existing for videos. Fix written, **not applied**: `20261007231000_reels_storage_owner_folder.sql` limits INSERT/UPDATE to the caller's own folder for both layouts in use (videos `reels/<uid>/…`, stories `<uid>/stories/…`). Needs STORAGE + RLS_SECURITY review and a hosted check before staging testers post photos of minors. The `game_highlights` fallback bucket keeps bucket-only policies. **Wave 1 blocker until applied.** |
| Failed photo-story attempts leave hidden rows | `createPhotoStory` inserts the reel first; if a photo or `set_reel_photos` fails, the row stays at `photo_count = 0` (hidden everywhere by `isListableReel`; clients have no delete grant). Uploaded Storage objects from a failed attempt also remain. Needs a cleanup job or an owner-delete RPC. |
| Guest vote / hype stuffing (public beta blocker) | `cast_cheer_vote` and `increment_player_hype` stay guest-callable with no limit (by design for Wave 0); a guest can stuff poll votes and inflate hype counts that feed Spotlight. Needs a per-device / per-account limit or signed-in-only before public beta (WORK_QUEUE DATA-01-F11). |
| Minor accounts not applied (MINOR-01) | `20261014110000_minor_accounts.sql` after the two PRIV-01 files (written, reviewed, replayed 100/100). Until applied: sign-up sends birth month and year but the database keeps only the 13+ confirmation; Apple / Google keep the old 13+ card; the guardian panel and teen pieces stay hidden ("not switched on"). The consent form is a **draft** for counsel (LEGAL row AA) — do not show it to real families. Under-13 sign-ins listed on the admin desk must be deleted by hand in Supabase. Future RLS tables must add the "Closed accounts" policy. |
| Profile privacy not applied (PRIV-01) | `20261014090000_profile_privacy.sql` then `20261014100000_tag_approval.sql` (written, reviewed, replayed). Until applied, `profiles` stays readable by anyone and the old hide switches are cosmetic; the new Privacy screens say "not switched on" and Edit profile keeps the old switches. The stage 1 file stops on purpose if staging has extra hand-made read policies on `profiles` or `crew_follows`. Avatar files stay public (follow-up). |
| Profile photo overwrite (security) | Until `20261013230000_avatars_owner_folder.sql` is applied, any signed-in user can overwrite any profile photo (often a minor's). Written and replayed, not applied. Whether minors' photos should be visible to guests at all is open (WORK_QUEUE P1-02). |
| Withdrawal requests not capped | `request_custodial_withdrawal` does not check the amount against what is recorded for the family. Payouts are blocked today; the cap depends on how money reaches families (§6 item 8). LEGAL row X. |
| **Function access hardening not applied (security)** | `20261013210000_function_access_hardening.sql` (written, RLS_SECURITY approved, schema replay 35/35). Until applied on staging, anyone with the public key can write revenue rows into `company_revenue_logs`, raise donation totals and Aura, and change sport settings / triage feedback. Apply before the other October files. |
| DATA-01 closures migration not applied | `20261013120000_data_governance_closures.sql` (written, replayed 46/46). Until applied: Athletes desk Stats and custodial terms, Schools desk branding/confirmers, Live games check-ins and Activity Crew alert clearing show "not switched on"; `get_aura_tier` still exists on hosted databases. |
| Parent role can update any payout row | Pre-existing: the "Admin write disbursements" policy grants `parent` UPDATE / INSERT on every `disbursements` row, not only their own child's. BOOKS-01 stops `paid_at` backdating, but amounts and status remain editable by any parent account. Found by RLS_SECURITY 2026-10-13. **Fix written 2026-10-13, not applied:** `20261013220000_disbursements_guardian_scope.sql` (admin-only writes; reads for admins and the athlete's custodial parties), via owner → CTO → SECURITY → RLS_SECURITY, reviewed by CUSTODIAL and INTERNAL_CONTROLS; schema replay 35/35; a paid payout is now final (amount / athlete locked). Before live payouts (WORK_QUEUE DATA-01-F10a, with §6 item 8): link payouts to approved withdrawals, two-person approval, guardian access ending at handover. Wave 1 blocker until applied. |
| Books migration not applied | `20261012210000_bookkeeping_ledger.sql` is written only. Until it is applied, `/admin/books` shows income and payouts but cannot record expenses, Stripe fees or month closes, and every donation insert makes one extra attempt without `cover_fee_cents` / `stripe_payment_intent_id`. Stripe fees, refunds and disputes are not recorded per charge until the webhook path (§6 item 3) exists. |
| September SQL is on staging only | The development project still hides Rally, Say thanks, custodial cards, Spotlight Boards, and view counting. Testers see those only after a build points at `ala-sports-staging`. Telemetry shape bounds are on staging; guest inserts stay. |

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

12. **Hosting and environments (owner request 2026-10-13).** Recommendation: stay on managed Supabase (dev / staging / prod) for Wave 0–1, with self-hosted Supabase on AWS as a quarterly-tested exit; AWS over Azure unless a partner requires Microsoft. Owner decisions listed in [ENVIRONMENTS_AND_HOSTING.md](engineering/ENVIRONMENTS_AND_HOSTING.md) §9. Every engineer's view (49 roles, unanimous for staying), cost with our time and the CTO's three yes/no questions: [HOSTING_DECISION_BRIEF.md](engineering/HOSTING_DECISION_BRIEF.md) §9. Prices unverified until internet mode is on. Supersedes nothing yet; the 2026-09-29 "not moving hosts" note stands until the owner confirms.

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
