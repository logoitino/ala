# STATE — read this first

**Last updated:** 2026-10-12 · Local Expo launch recovered: native quarantine cleared, fresh web/iOS bundles and browser shell verified (78 suites / 443 tests); original historical loader error not reproduced · ADM-01 fix waves 1–3, readable event labels and the owner-chosen report format on every admin portal page are in place locally (uncommitted); `pnpm check` and portal tests 80/80 pass, and the final browser review is accepted (VISUAL_QA ACCEPT, ACCESSIBILITY PASS). The owner commits and merges. · All admin desks now follow Home’s report format; desktop/phone layouts, enlarged text, mouse controls and focus are verified locally. · The admin portal header now scrolls with the page to address hidden keyboard focus (ADM-01 follow-up; local keyboard focus verified, full portal re-review done and accepted: VISUAL_QA ACCEPT, ACCESSIBILITY PASS, 2026-10-12). · Every admin portal page now draws its numbers as charts with a written summary and a Data table. A missing number shows “—”, not $0.00. · A chosen cheer stays a white button with a colored edge, so it does not blend into the poll bar. The upload menu sits centered with Next under the choices. The Highlight bar is Home, search, and Local. · Analytics is eight dashboards and a measure catalog at `/analytics`, owned by `ANALYST`. · A video Highlight can post with Tag later and one permission line. Choosing an athlete no longer plays the clip inside the sheet. Donate stays off until an athlete is tagged. Photo stories still need an athlete. The night preview does not include this. · A downward swipe on a popup’s top bar closes it on a phone, and a finished upload drops the clip preview before the sheet closes. · The admin portal home is a measured dashboard, and the tabs are Home, Trends, Audience, Revenue, Health, and Product. · Swiping open the Highlight owner card no longer crashes the browser. · Popup menus close with a downward swipe. The admin portal Operations page tabs are Where, Buttons, Errors, and Menus. · The admin portal Departments page shows Billing, Marketing, Support, API, and IT on one read-only screen. `PORTAL` reports to `ADMIN`. · The preview server now has the confirmed test account `demo@tapuai.app`. Sign-in is Apple, Google, email, and password. The 13+ confirmation is only on Create an account. · Preview queued 2026-10-11 night. Android `5cca4a55-cfc3-4c58-9346-34b9e0433b27` and iOS `c5255651-06e3-4f46-9861-5a47ad1b434a`. They include the popup swipe and the upload black-screen fix. iOS still installs only on the one registered iPad. The evening builds `04244951` and `12d017d4` do not. · Guests can watch a shared Highlight and two more swipes, then the account sheet. Upload asks for an account before the composer. The test account stays on that sheet until a production build. · Redirect `alasports://auth/callback` is saved. Google sign-in stays in the sheet because the Google provider is still off. · A profile card edge and the next-tier line wear the earned Aura color. The Aura card control is filled with that same color. · One-time Exclusive is bought from the Vault tab and a locked Highlight. The profile row under the card is Donate and Share. · Profile counts sit inside the athlete card like a social profile: Seki, Riding, and Crew. Join is an icon under the Crew number. The story pills under the card are gone. Jev chose that three-count row (probability 0.70, confidence 0.40, 527 input tokens). · Seki and Flex now tell a story on a Highlight and on a profile. A play that makes the Seki pill says so, and “You called it” when you gave that Seki. Flex says you are riding with the athlete. Aura stays a count and a tier. No SQL applied. · Latest local app uploaded to EAS preview. Android `196a7acf-b18f-4af0-a4c8-85d7e9ab6afc` and iOS `9dad0fa8-1902-448f-82e7-03a9b4a869b5` are queued. They include the scoreboard and hype-glow fixes. The iOS profile still has one iPad. · Selected Seki, Aura, and Flex glow is painted behind the circle so the rail no longer clips it. Local Open flags shows the report reason and whether an athlete or guardian reported the clip. Strikes and appeals are unbuilt. The hosted database was not queried. · Jev walked the lib, data, and hook helpers. No replacement cleared confidence 0.90. QA accepted the mobile suite: 74 suites, 416 tests. Compliance gaps routed in `docs/legal/LEGAL_BRIEFING.md`. iOS preview `af6a7e72` installs on the registered iPad only. Android preview `6febe2bb` still in progress · Department plans: where each team is, and what public still requires · 2026-10-08 · Hierarchy grouped by reporting lead (90 agents) · VP of Operations (`VP_OPERATIONS`) keeps roles, protocols, and priorities current under the CTO · CTO assigns app fixes; leads report to `CTO` (90 agents) · Owner peek card redesigned (light Daylight card, 2 x 2 stats, equal-width Donate / Join Crew) · 2026-10-07 · Highlights prefetch the next and previous photo story · Photo stories in Highlights built locally (UX-05; SQL unapplied) · "Donate. Elevate. Celebrate." in four placements · Game Play → Game Day label · MCP servers (Playwright, Expo, Canva, Supabase dev) · 87 agents · Compact sports profiles (60 suites / 311 tests) / direct Goals and Team navigation; sport-matched Stats/Aura, missing data unreported; public sport migration prepared, unapplied · Sports UI browser verification and fixes (UX-03): 55 suites / 261 tests; identity/accessibility and narrow large-text fixes; native verification pending · Readiness R1 organization audited: web builds and 50 suites / 242 tests pass; CI Node 24 and persistent docs/credential guards; R2–R4 next actions clarified · Stripe secret moved out of `.env.local` (Edge Functions hold it); native-module quarantine cleared · Compact donation/menu integration verified locally (UX-02; 50 suites / 242 tests) · Compact staged video upload complete locally (UX-01) · 83 callable agents with functional ownership and CI registry validation · Specialist work queue in WORK_QUEUE.md · Guest route data boundaries reduced to 6 routes / 12 calls · Account-tag write/confirmation fixes prepared; SQL remains unapplied · Staging/build readiness and custodial DOB inventory corrected from local evidence · Wave 0 test mode; device and hosted SQL verification remain pending.

This is the living state of `ala-sports` (Tapua'i Sports). Every other document describes how
things *should* work; this one describes **where the project actually is right now** — what
just changed, what is knowingly broken, and what will bite you in the first ten minutes.

If you are an AI agent or a new engineer: read this file, then [AGENTS.md](../AGENTS.md) for
folder law. Do not skip to the code.

---

## 0. Pick up here (hand-off, 2026-10-07)

**Where the code is.** Branch `wave0-custodial-verification` is at `fd6b0b1` before this
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
8. **MCP tooling.** Start Claude Code inside the repo, approve the project servers, then sign in to
   `canva`, `expo` and `supabase-dev` from `/mcp` (`docs/engineering/TOOLING.md`).

**Prove the tree is green before you change anything:**
`pnpm typecheck` · `pnpm --filter @tapuai/mobile test -- --watchman=false` ·
from the root: `pnpm copy:check`, `pnpm docs:check`, `pnpm app:data-boundaries`, `pnpm comments:check`, and `pnpm agents:check`
(Node is `~/.local/node/bin`). `pnpm check` also runs `pnpm docs:links` and
`pnpm security:client-keys`, shared with CI (Node 24).

**When you finish — the doc checklist.** Code under `apps/` / `packages/` / `supabase/` → a §4
line here + bump **Last updated**. User-visible → `CHANGELOG.md`. New table / RPC / column →
migration file + copy onto `schema.sql` + a row in `supabase/migrations/README.md` + `docs/engineering/SCHEMA.md`
(`docs:check` fails otherwise). New folder / hook / lib file → `AGENTS.md` lists. Any on-screen
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
  No pnpm script runs them, so `pnpm check` does not cover them. 80 tests as of 2026-10-12 (ADM-01).
- **Headless Playwright Chrome cannot launch on this Mac** (macOS Mach-port permission; a Launch
  Services attempt returned -54). Browser checks use Browser Bridge on the owner's Chrome, which
  sends no trusted keypress, so Enter/Space on a native control stays unverified.
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
- **Historical NAS mode flips:** older sessions saw ~500 `100644 → 100755` changes. The
  2026-10-07 starting tree contains only `docs/STATE.md`, `docs/agents/TEAMS.md`, and the new hierarchy
  document; that old count is not the current status. Preserve user edits and stage by path.
  **Never `git add -A`.**

---

## 4. Recent changes (rolling — newest first)

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
| Branch integration pending | At local review, `wave0-custodial-verification` matches its cached origin ref and is 33 commits ahead of cached `origin/main`. This session's changes are uncommitted. No push or merge performed; remote freshness unverified. |
| Self-verify holes — fixed on staging, still open on the development project | On the development database: `profiles.player_id`, `is_verified` and `verification_status` are client-writable (no column guard on "Users update own profile"), so any signed-in user can mark themselves verified and self-link to any athlete; a shared team code verifies instantly; admin approval stamps every profile with the same name. The client no longer does any of this, but the database still allows it until `supabase/migrations/20260929120000_athlete_verification_ladder.sql` is applied. ROADMAP Wave 1 blocker. |
| Held gifts have no cap or refund yet | Gifts to an unverified athlete are "held" only because payouts are 503. The design's ~$250 cap and 30-day refunds need the Phase 1a ledger. Future payout code must call `athlete_payout_allowed`. |
| School confirm link needs the app | `alasports://school-confirm` opens only where Tapua'i is installed (Edge Functions can't serve HTML on the default domain). A web page for staff without the app is not built. Confirmers are added from the SQL Editor — no admin UI yet. |
| Report reasons built; strikes and appeals unbuilt | `20261001180000_content_rights_reports.sql` stores a reason and hides on athlete/guardian reports, high-risk reasons, or three distinct reporters. One ordinary rival report no longer hides a clip. Staging application is recorded in TEAMS; not re-queried here. Local Open flags columns show the reason, the clip, the reporter count, and whether an athlete or guardian reported it. Strikes and appeals remain unbuilt. This session did not query the hosted database. |
| Storage write policies on `reels` do not check the folder owner | Found 2026-10-07 during the photo-story review: the bucket's INSERT/UPDATE policies only check `bucket_id = 'reels'` and an authenticated session, and uploads use `upsert: true`, so any signed-in user could overwrite another user's video or story photo by path. Pre-existing for videos. Fix written, **not applied**: `20261007231000_reels_storage_owner_folder.sql` limits INSERT/UPDATE to the caller's own folder for both layouts in use (videos `reels/<uid>/…`, stories `<uid>/stories/…`). Needs STORAGE + RLS_SECURITY review and a hosted check before staging testers post photos of minors. The `game_highlights` fallback bucket keeps bucket-only policies. **Wave 1 blocker until applied.** |
| Failed photo-story attempts leave hidden rows | `createPhotoStory` inserts the reel first; if a photo or `set_reel_photos` fails, the row stays at `photo_count = 0` (hidden everywhere by `isListableReel`; clients have no delete grant). Uploaded Storage objects from a failed attempt also remain. Needs a cleanup job or an owner-delete RPC. |
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
