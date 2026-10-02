# STATE — read this first

**Last updated:** 2026-10-02 · Review hand-off refreshed · Account tags written, SQL not applied · Fan signature is later · Support received shows $0 when the ledger is empty or unavailable · Rivalry week swipes away; donate sheet stays on screen · Drip tab is off until Wave 1 · 2026-10-01 · Business departments (Product, Design, Engineering, Finance, and the rest) are in docs/TEAMS.md · Rights-check preview builds finished (iOS still the registered iPad only) · Upload confirms permission, sound, and marks; reports name fake footage, music, logos, and broadcasts · 2026-09-30 · September SQL applied to staging only · Wave 0 spend reminder: $99/yr Apple already enrolled; SQL, preview build, and test-card donate are $0 · Cross-surface reliability + reviewability: rivalry banner links Highlights to Local polls, Activity thanks opens the athlete, Drip and role HQ failures retry honestly, operator check-in confirms the write, PR/CODEOWNERS/folder guides and route-data CI guard added · Telemetry row bounds written, not applied (guest inserts stay; one fake row can no longer wreck a Reports average) · Rally meter on Highlights, full-screen fill moment, thank-you clip opens in the pager · full button + policy audit: payout Mark paid / Failed and People Verify / Admin now confirm first, sign-in sheet ignores a same-frame double tap · M2 Rally goals + preset "Say thanks" + fee model decided (90 / 10 disclosed on the donate sheet, optional tip for Tapua'i, default No tip) — migration not applied · Wave 0 build: Apple Pay / Google Pay, M1 leaderboards, custodial money rules (athlete approves, auto handover at 18) — SQL written, not applied; release waves in ROADMAP · athlete verification ladder built (school AD/coach confirms in person; gifts held until verified) · filmer tiers, Props, Aura and Top Filmers (SQL not applied) · money copy is now Donate / donation everywhere (`pnpm copy:check`, VOICE agent) — first migration in `supabase/migrations/`, not applied · growth pass: one-tap sign-in first, athlete claim needs only team + sport · payouts no longer need the school (Stripe ID check + $250 cap until 3 teammate vouches) · school crest on confirmed athletes · Aura card flip fixed — two migrations, not applied · Highlights hype chips: Home feed no longer reorders on a tap (the flicker), only Aura bursts, Seki 🤙 → 🏈 · views = 3 s of playback, ▶ counts on profile grids, "Filmed by" credit, upload must tag who's in the clip — migration not applied

This is the living state of `ala-sports` (Tapua'i Sports). Every other document describes how
things *should* work; this one describes **where the project actually is right now** — what
just changed, what is knowingly broken, and what will bite you in the first ten minutes.

If you are an AI agent or a new engineer: read this file, then [AGENTS.md](../AGENTS.md) for
folder law. Do not skip to the code.

---

## 0. Pick up here (hand-off, 2026-10-02)

**Where the code is.** Branch `wave0-custodial-verification` is on GitHub (`origin/wave0-custodial-verification`).
`origin/main` is behind it and can fast-forward; it has not been merged. Work after the last push
(content-rights upload, departments, Drip off, Highlights sheet, Support received, account tags)
is in the working tree until the review pull request. Do not `git add -A` — about 500 mode-flip
files from the NAS are noise (§3).

**Outside review.** Read this file, then `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/ARCHITECTURE.md`,
`docs/SCHEMA.md`, `docs/ROADMAP.md` (Wave 0 is test mode), `docs/LEGAL_BRIEFING.md`,
`docs/DATA_PRIVACY_MAP.md`, and `docs/VOICE.md`. `docs/PUBLIC.md` and `docs/INVESTOR.md` are not
the security packet. `docs/AUDIT_REPORT.md` older sections are history. Open on purpose, do not
treat as surprises: the app still writes `tips` after PaymentSheet (do not turn on `stripe-webhook`
crediting), payouts stay blocked and do not check the amount owed, Stripe is test mode, and the
development project does not have the staging SQL.

**The mission — judge every change against it.** Make donations and highlights easy for families,
so they can promote their kid and hopefully get them recruited; kids encourage good workouts with
fans and serve like their favorite player; Tapua'i is the avenue that makes the donating possible.
It replaces GoFundMe for families. Full text: `docs/ROADMAP.md` North Star, `docs/STORY.md`
"The mission, in one breath". Money words: `docs/VOICE.md`.

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
points at staging, run `docs/TESTER_SCRIPT.md`.

**Spend, every time.** Wave 0 (this test) costs Apple Developer **$99/yr** — already enrolled — and
Supabase, Expo, and Stripe test mode are free. Nothing comes in. SQL on staging is done ($0). Still **$0**: a
new preview build and a `4242` test donation, unless the free Expo build quota runs out or
a free Supabase project pauses (then Pro, about **$25/mo**). Wave 1 is later and is the first real
spend: LLC, counsel, an association letter, Google Play **$25**, Supabase Pro, video bandwidth, and
Stripe’s fees. Do not start those for this test. Full table: `docs/ROADMAP.md` release waves.

**Next up, in order.**
1. Preview builds with the upload confirmations finished 2026-10-01 and point at staging. Android (any phone):
   https://expo.dev/accounts/logoitino/projects/ala-sports/builds/061946c8-a25d-4a32-b5be-bab316819c1d
   iOS (registered iPad only — the iPhone is not on the profile yet):
   https://expo.dev/accounts/logoitino/projects/ala-sports/builds/a93f562d-d122-48a4-a20f-3e466368aa4a
   `create-payment-intent` and the test Stripe secret are on staging. Do not deploy
   `stripe-webhook`. Before the first sign-in, add redirect `alasports://auth/callback` on staging
   (STAGING_RUNBOOK §3). Upload buckets: `reels`, `avatars`, `game_highlights`. `reel_vault` is not
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
   **not applied** anywhere. Until it is, the picker stays empty and a publish still succeeds.

**Prove the tree is green before you change anything:**
`pnpm typecheck` · `pnpm --filter @tapuai/mobile test -- --watchman=false` ·
from the root: `pnpm copy:check`, `pnpm docs:check`, `pnpm app:data-boundaries`, and `pnpm comments:check`
(Node is `~/.local/node/bin`).

**When you finish — the doc checklist.** Code under `apps/` / `packages/` / `supabase/` → a §4
line here + bump **Last updated**. User-visible → `CHANGELOG.md`. New table / RPC / column →
migration file + copy onto `schema.sql` + a row in `supabase/migrations/README.md` + `docs/SCHEMA.md`
(`docs:check` fails otherwise). New folder / hook / lib file → `AGENTS.md` lists. Any on-screen
money words → `docs/VOICE.md` rules, `copy:check`, and flag it in `docs/LEGAL_BRIEFING.md` (LEGAL
owns money copy). Price / split / Aura / Connect changes → `node scripts/sync-front-docs.mjs`
(regenerates `PRODUCT_FACTS.md` and blocks in PUBLIC / INVESTOR / LEGAL). Roadmap status →
`docs/ROADMAP.md`. Owner decisions → §6 here, plus ROADMAP / STORY if they change the plan or the story. New tester
steps → `docs/TESTER_SCRIPT.md`. Commit by path (never `git add -A`); do not push.

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
| Move a phase forward, or find a new blocker | Update `docs/ROADMAP.md` status and §5/§6 here |
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

Stripe is in **test mode**. There is no staging database yet (ROADMAP Phase 2 item 4).

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
- **Expo web does not bundle.** `lightningcss` is missing its native binary for 1.33.0, and the
  1.32.0 copy is blocked by macOS code-signing policy. Unfixed — see §5.
- **`node_modules` is a hybrid** of a stale npm install and the pnpm install. Duplicate `react`
  broke Jest (null hook dispatcher) until `node_modules/react` was repointed at the pnpm copy.
  Other stale duplicates remain and may bite the same way.
- **`git status` shows ~500 modified files that are pure mode flips** (`100644 → 100755`) from a
  NAS round trip. Filter with `git diff --numstat | awk '$1!="0" || $2!="0"'`. **Never `git add -A`.**

---

## 4. Recent changes (rolling — newest first)

Keep ~15. Older entries live in `CHANGELOG.md`.

- **2026-10-02** — Review hand-off in §0 matches the branch on GitHub and the local work that is not pushed yet. Highlight account tags are in the app (`reel_account_tags`, up to three, confirm before the name shows). SQL `20261002160000` is written and not applied. A fan digital signature on the Aura card is later only.
- **2026-10-02** — Support received shows **$0.00** and "No donations yet" when nobody has donated, and also when `get_received_malo` is missing or the call fails. That database message stays off the profile and Athlete HQ.
- **2026-10-02** — Highlights: Rivalry week dismisses with a swipe left or right and stays gone for the visit. The donate sheet opens at the top of the form, stays inside the screen, and scrolls when the phone is short.
- **2026-10-02** — Privacy work re-landed and telemetry conflict closed. A parallel session had deleted
  this session's uncommitted data-privacy docs and the `operator_checkins` RLS fix (no git history held them);
  they were restored from the session transcript. `docs/DATA_PRIVACY_MAP.md` (data inventory, gaps, recommended
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
  data, route layouts, large components, the Stripe API handlers). New rules in `docs/CONVENTIONS.md` §5
  (file header, doc block on hooks / RPC helpers / complex components, inline comments explain *why*, SQL and
  folder READMEs, keep comments true when you edit) mirrored in `.cursor/rules/documentation.mdc`,
  `AGENTS.md` and the PR template. New guard `scripts/check-comments.mjs` (`pnpm comments:check`, CI step)
  fails a file with no comment before its first exported function or in its first 60 lines; tests, `.d.ts`
  and the generated `types/database.ts` are exempt. Comments only — no behaviour changed; tsc, jest
  (41 suites / 194 tests), `copy:check`, `docs:check`, `app:data-boundaries` pass. Not covered: the guard
  checks that a comment exists, not that it is accurate or good; Edge Functions, `supabase/*.sql` and
  `apps/admin-portal` are not scanned. Header text was checked against the code it describes, but a
  reviewer should still treat any header as a map, not a spec.
- **2026-10-02** — Drip is off. `tabs.drip` defaults to false, and the published flag is false on staging and the development project. The screen and `/admin/drip` stay. Wave 1 is when the marketplace comes back (`docs/ROADMAP.md`). Finance (`COMMERCE`) still owns the code. A preview already installed picks this up on the next open; no new build.
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
  tie). Rules `docs/VOICE.md`; `scripts/check-copy.mjs` (`pnpm copy:check`, new CI step); VOICE agent
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
  New `docs/STAGING_RUNBOOK.md`. **Not verified on a device**; the Edge Function is not yet
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
| Expo web bundle | Fails on `lightningcss` native binary (missing for 1.33.0; 1.32.0 blocked by macOS code signing). Mobile is unaffected. |
| Storage buckets `reels` / `game_highlights` / `avatars` are public | Vault-locked video is directly downloadable, bypassing entitlement. Accepted for internal testing only — ROADMAP Phase 5 hard blocker. |
| `auth.role() = 'anon'` bypass on 8+ tables | Studio Unlock and Operator PIN have no real session. Accepted for internal testing, **not** for public beta. |
| Staging has the September SQL; the development project does not | Applied 2026-09-30 to `ala-sports-staging` only. Preview builds still talk to the development project, which does not have Rallies, view counts, or the verification ladder. |
| Nothing pushed | `wave0-custodial-verification` is well ahead of `origin/main` (local `main` is also ahead). Pushing needs owner approval and interactive GitHub auth. |
| Self-verify holes — fixed on staging, still open on the development project | On the development database: `profiles.player_id`, `is_verified` and `verification_status` are client-writable (no column guard on "Users update own profile"), so any signed-in user can mark themselves verified and self-link to any athlete; a shared team code verifies instantly; admin approval stamps every profile with the same name. The client no longer does any of this, but the database still allows it until `supabase/migrations/20260929120000_athlete_verification_ladder.sql` is applied. ROADMAP Wave 1 blocker. |
| Held gifts have no cap or refund yet | Gifts to an unverified athlete are "held" only because payouts are 503. The design's ~$250 cap and 30-day refunds need the Phase 1a ledger. Future payout code must call `athlete_payout_allowed`. |
| School confirm link needs the app | `alasports://school-confirm` opens only where Tapua'i is installed (Edge Functions can't serve HTML on the default domain). A web page for staff without the app is not built. Confirmers are added from the SQL Editor — no admin UI yet. |
| One report hides a clip, with no reason | `report_reel` sets `is_flagged` on the first report and records no reason, so rival fans can hide real clips and moderators can't spot AI fakes. Plan: design doc §6. |
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
   Story and marketing guardrails: `docs/STORY.md`.
8. **How money reaches families (Wave 1 gate).** Recommended: Stripe Connect destination charges
   to the guardian's account, so gifts never sit in the platform balance and no payout ledger is
   needed. The alternative is today's platform-balance model plus the Phase 1a ledger (B3). Owner +
   payments counsel.
9. **Fee model** — *decided 2026-09-29:* keep the 10% platform share, disclosed on the donate sheet
   (90% to the family account; card processing comes out of Tapua'i's 10%), plus a GoFundMe-style
   optional tip for Tapua'i at checkout (default No tip, never pre-selected). Built, SQL not applied.
   Still open: counsel on App Store 3.2.1(vii), which appears to require 100% for non-IAP gifts —
   fallback is `MALO_PLATFORM_CUT_BPS` = 0 with the tip kept (LEGAL row L).

10. **Athlete verification and fake highlights** — `docs/ATHLETE_VERIFICATION_DESIGN.md`.
    **Decided 2026-09-29:** gifts are held until verified and the athlete sees that in the app; the
    athletic director or coach confirms each student in person on a Tapua'i form. Built (not
    applied). Still open: the pending-gift cap amount and refund window (need the ledger), and
    counsel on the "held" copy.

11. **Fan digital signature on the Aura card** — *later, not this wave (owner 2026-10-02).* A fan
    can earn a signature and place it on their Aura card, alongside other card extras in a later
    phase. Do not build the capture, storage, or card slot now.

---

## 7. Where everything lives

| Document | Purpose |
| --- | --- |
| **`docs/STATE.md`** | **This file.** Current state, recent work, known breakage. |
| `AGENTS.md` | Folder law, path aliases, tech-stack guardrails. `CLAUDE.md` imports it. |
| `DOCUMENTATION.md` | Engineer onboarding and directory map. |
| `docs/ROADMAP.md` | North Star (Watch & compete / Rally / Pass it on / Rise), Release waves 0-3 (cheapest first), Phases 0-5, Mission track M1-M10. |
| `docs/STORY.md` | Mission narrative, marketing lines, and the guardrails that keep athletes eligible. |
| `docs/ATHLETE_VERIFICATION_DESIGN.md` | Open sign-up, the athlete verification ladder, gifts while pending, safe growth, fake-highlight takedown. Ladder + in-person school confirmation built; §6 (fakes) still a proposal. |
| `docs/CODE_ORGANIZATION_PLAN.md` | Keep the code easy to review and cheap to move hosts later (we are **not** moving now): commit hygiene, dated SQL files, generated types, big-file splits, a Supabase-coupling map, and the rule that screens call `lib/`, never Supabase directly (8 Expo route files still break it; CI blocks growth). Step 0 + reviewer notes/guard done. |
| `supabase/migrations/README.md` | How migrations work here, how to apply without the CLI, the baseline steps, adding a school confirmer. |
| `docs/STAGING_RUNBOOK.md` | Step-by-step staging project + tester build. |
| `docs/TESTER_SCRIPT.md` | Phase 3 tasks per role, organised by pillar, plus feel questions. |
| `CHANGELOG.md` | Permanent dated record of product and schema shifts. |
| `docs/SCHEMA.md` | Tables, RPCs, RLS, Aura palette. `docs:check` fails if it omits a table. |
| `docs/ARCHITECTURE.md` · `docs/ONBOARDING.md` | Monorepo map · clone-and-run. |
| `docs/AUDIT_REPORT.md` | Interaction audits. §1-7 are the 2026-09-14 snapshot; newest pass is at the top. |
| `docs/TEAMS.md` · `.claude/agents/*.md` | Department ownership and dispatch. |
| `.cursor/rules/documentation.mdc` | The full doc-sync obligation table. |
| `TROUBLESHOOTING.md` | Metro / Expo / env failures. |
| `docs/VOICE.md` · `.claude/agents/voice.md` | Donation language rules (Donate / donation; "tip" only for the tip for Tapua'i). `copy:check` enforces the retired words. |
| `docs/LEGAL_BRIEFING.md` | Every legal / money-copy risk as a lettered row (L = the 90 / 10 disclosure, P = filmer cash, R = optional tip, S = preset thank-yous, T = Rally). LEGAL owns money copy. |
| `docs/PUBLIC.md` · `docs/INVESTOR.md` · `docs/PRODUCT_FACTS.md` | Public / investor story. `PRODUCT_FACTS.md` and the `product-facts` blocks are **generated** by `scripts/sync-front-docs.mjs` — do not hand-edit them. |
| `docs/COMPANY_PHASES.md` | Company phases, billing plan B0–B7 (when money becomes real). |
| `docs/PARENT_PAYEE_CONNECT_DESIGN.md` | Guardian-as-payee and custodial money rules (§7). |
| `docs/CONVENTIONS.md` | Naming and where files go. |
