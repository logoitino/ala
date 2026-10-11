# STATE — read this first

**Last updated:** 2026-10-10 · Redirect `alasports://auth/callback` is saved. Google sign-in stays in the sheet because the Google provider is still off. · A profile card edge and the next-tier line wear the earned Aura color. The Aura card control is filled with that same color. · One-time Exclusive is bought from the Vault tab and a locked Highlight. The profile row under the card is Donate and Share. · Profile counts sit inside the athlete card like a social profile: Seki, Riding, and Crew. Join is an icon under the Crew number. The story pills under the card are gone. Jev chose that three-count row (probability 0.70, confidence 0.40, 527 input tokens). · Seki and Flex now tell a story on a Highlight and on a profile. A play that makes the Seki pill says so, and “You called it” when you gave that Seki. Flex says you are riding with the athlete. Aura stays a count and a tier. No SQL applied. · Latest local app uploaded to EAS preview. Android `196a7acf-b18f-4af0-a4c8-85d7e9ab6afc` and iOS `9dad0fa8-1902-448f-82e7-03a9b4a869b5` are queued. They include the scoreboard and hype-glow fixes. The iOS profile still has one iPad. · Selected Seki, Aura, and Flex glow is painted behind the circle so the rail no longer clips it. Local Open flags shows the report reason and whether an athlete or guardian reported the clip. Strikes and appeals are unbuilt. The hosted database was not queried. · Jev walked the lib, data, and hook helpers. No replacement cleared confidence 0.90. QA accepted the mobile suite: 74 suites, 416 tests. Compliance gaps routed in `docs/legal/LEGAL_BRIEFING.md`. iOS preview `af6a7e72` installs on the registered iPad only. Android preview `6febe2bb` still in progress · Department plans: where each team is, and what public still requires · 2026-10-08 · Hierarchy grouped by reporting lead (90 agents) · VP of Operations (`VP_OPERATIONS`) keeps roles, protocols, and priorities current under the CTO · CTO assigns app fixes; leads report to `CTO` (90 agents) · Owner peek card redesigned (light Daylight card, 2 x 2 stats, equal-width Donate / Join Crew) · 2026-10-07 · Highlights prefetch the next and previous photo story · Photo stories in Highlights built locally (UX-05; SQL unapplied) · "Donate. Elevate. Celebrate." in four placements · Game Play → Game Day label · MCP servers (Playwright, Expo, Canva, Supabase dev) · 87 agents · Compact sports profiles (60 suites / 311 tests) / direct Goals and Team navigation; sport-matched Stats/Aura, missing data unreported; public sport migration prepared, unapplied · Sports UI browser verification and fixes (UX-03): 55 suites / 261 tests; identity/accessibility and narrow large-text fixes; native verification pending · Readiness R1 organization audited: web builds and 50 suites / 242 tests pass; CI Node 24 and persistent docs/credential guards; R2–R4 next actions clarified · Stripe secret moved out of `.env.local` (Edge Functions hold it); native-module quarantine cleared · Compact donation/menu integration verified locally (UX-02; 50 suites / 242 tests) · Compact staged video upload complete locally (UX-01) · 83 callable agents with functional ownership and CI registry validation · Specialist work queue in WORK_QUEUE.md · Guest route data boundaries reduced to 6 routes / 12 calls · Account-tag write/confirmation fixes prepared; SQL remains unapplied · Staging/build readiness and custodial DOB inventory corrected from local evidence · Wave 0 test mode; device and hosted SQL verification remain pending.

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
1. Preview builds uploaded 2026-10-10 with the local app, including the scoreboard and hype-glow fixes. Android (any phone):
   https://expo.dev/accounts/logoitino/projects/ala-sports/builds/196a7acf-b18f-4af0-a4c8-85d7e9ab6afc
   iOS (registered iPad only — the iPhone is not on the profile yet):
   https://expo.dev/accounts/logoitino/projects/ala-sports/builds/9dad0fa8-1902-448f-82e7-03a9b4a869b5
   `create-payment-intent` and the test Stripe secret are on staging. Do not deploy
   `stripe-webhook`. Owner added redirect `alasports://auth/callback` on 2026-10-10. Google is still
   off on development and staging, so Continue with Google stays in the sign-in sheet until that
   provider is enabled. Email still creates the account. See STAGING_RUNBOOK §3. Upload buckets: `reels`, `avatars`, `game_highlights`. `reel_vault` is not
   on staging yet.
2. Owner + counsel: the open items in §6 — especially 8 (how money reaches families) and the App
   Store question in 9. They gate Wave 1 live money.
3. Engineering, no owner call needed: **done 2026-09-29** — the telemetry anon-insert hole in §5
   (shape-bounded, not identity-fixed; see §5). Rally meter on Highlights, the full-screen fill
   moment, and "Watch what it paid for" opening that clip also landed 2026-09-29 — see §4.
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
  7 real pages (Overview / Reports / Money / Soft-Wall / Profile / Features / People). This is
  a standing decision, not an unfinished state. Reconfirmed 2026-09-28.
- `packages/shared-types` — `@tapuai/shared-types`.
- `supabase/` — SQL applied by hand to the live project. `apps/mobile/src/backend/db/schema.sql`
  is the canonical copy.

Stripe is in **test mode**. Staging was created and the September SQL applied there on 2026-09-30 (§0). Development remains separate and lacks those changes. Remote state was not re-queried during the 2026-10-07 local review.

---

## 3. Running it on this machine

Verified 2026-09-28 on the `seiuliian` Mac. These are real constraints, not preferences.

- **Node** is at `~/.local/node` (v24.21.0), already on `PATH` via `~/.zshrc`.
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
  needs `supabase/leaderboards.sql`): `reels_feed` + `view_count` / `uploader_name` (null when the
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
  `admin_decide_verification` (no more name stamping). `supabase/athlete_verification.sql` and
  `spotlight_auto.sql` marked superseded — do not re-run them after the migration. Tests: 3 new
  suites (110 total pass), tsc clean, `docs:check` ok.
- **2026-09-29** — Custodial money rules (owner decision; `PARENT_PAYEE_CONNECT_DESIGN.md` §7).
  New `supabase/custodial_money.sql` (also appended to `schema.sql`): `custodial_accounts` (one per
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
- **2026-09-29** — M1 leaderboards (Release Wave 0). `supabase/leaderboards.sql` (appended to
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

## 5. Known broken / not yet applied

Do not re-diagnose these. Fix them or leave them.

| Thing | State |
| --- | --- |
| `clear_reel_hype` is on staging, not the development project | On the development database, un-voting a Seki/Aura/Flex no longer flickers, but the count **returns on refresh**. |
| `telemetry_logs` INSERT policy is `with check (true)` for `anon` | **Shape-bounded on staging, not on the development project** (`20260929190000_telemetry_logs_bounds.sql`; the five CHECKs on staging were read back 2026-10-02 and match the file). Guest inserts stay on purpose. On the development project one row can still report a nonsense event or an 11-day stall and skew Reports / Coverage / Money; on staging a single row cannot. Still open: many small valid-looking rows. Closing that needs §6 item 1, not a silent drop of guest telemetry. |
| `telemetry_logs` has no `user_id` / `session_id` | No funnels, retention, or per-user behaviour is possible. Owner chose "session + user id" but it is **not built** — it is a privacy change needing policy copy first (§6). |
| Expo web bundle | Was failing on `lightningcss` native binaries (1.33.0 trashed, 1.32.0 quarantined). Resolved locally: web export passed 2026-10-07 with 52 static routes and three API bundles (§3), dotenv disabled. Hosted deployment and configured backend behavior remain unverified. |
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
