# STATE — read this first

**Last updated:** 2026-09-29 · Wave 0 build: Apple Pay / Google Pay, M1 leaderboards, custodial money rules (athlete approves, auto handover at 18) — SQL written, not applied; release waves in ROADMAP · athlete verification ladder built (school AD/coach confirms in person; gifts held until verified) — first migration in `supabase/migrations/`, not applied · growth pass: one-tap sign-in first, athlete claim needs only team + sport · payouts no longer need the school (Stripe ID check + $250 cap until 3 teammate vouches) · school crest on confirmed athletes · Aura card flip fixed — two migrations, not applied

This is the living state of `ala-sports` (Tapua'i Sports). Every other document describes how
things *should* work; this one describes **where the project actually is right now** — what
just changed, what is knowingly broken, and what will bite you in the first ten minutes.

If you are an AI agent or a new engineer: read this file, then [AGENTS.md](../AGENTS.md) for
folder law. Do not skip to the code.

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
  8 real pages (Overview / Reports / Money / Soft-Wall / Profile / Features / People). This is
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
- **2026-09-28** — Structure pass. 13 single-consumer components moved out of flat
  `components/` into their owner subfolder (`Operator/`, `Profile/`, `Local/`); 3 orphans deleted
  (`components/CheerPollCard.tsx` and `Operator/LiveScoreHeader.tsx` were dead re-export shims,
  `hooks/usePalette.ts` had no callers). New `docs/CONVENTIONS.md` writes down naming + placement.
  `AGENTS.md` corrected — it listed 13 components at paths they had already moved away from, named
  a `MaloTipModal` that does not exist, and omitted the six role-group route trees,
  `src/backend/services/`, and `api/session.ts`.
- **2026-09-28** — `docs/STATE.md` created as the read-first entry point. `CLAUDE.md` imports it,
  `AGENTS.md`/`README.md`/`.cursor/rules` point at it, CI fails a PR that changes
  `apps/`/`packages/`/`supabase/` without updating it, and `scripts/state-doc-guard.sh` is a
  Claude Code Stop hook covering local agents that never open a PR.

- **2026-09-28** — Activity tab added (`app/(tabs)/activity.tsx`, `hooks/useActivityFeed.ts`),
  taking Local's slot in the fan bar. Derived from existing sources (`get_received_malo`,
  `get_fan_tip_history`, pending tags) — **no notifications table, so no unread state and no push.**
- **2026-09-28** — Local moved out of the fan bar into a navigating pill on the Highlights row;
  still routable at `/local`. Home/All/Seki pills now carry live clip counts.
- **2026-09-28** — `ReelCard` wrapped in `React.memo` with an explicit comparator (callbacks made stable 2026-09-29). One hype tap
  used to re-render every mounted card (video chrome, blur, Skia, action rail) — that cascade,
  not the counter, was the chip jank.
- **2026-09-28** — Hype counter races fixed: per-kind generation token discards superseded server
  responses; an in-flight counter stops the feed's echo overwriting the optimistic value; neither
  handler adopts a server row that did not move the count.
- **2026-09-28** — Local tab retinted to its own `TAB_ACCENTS.local` cyan (it was wearing
  Spotlight's gold). Sponsor rail got elevation + scroll reveal; boosters pane got a reveal;
  poll heading laid out on one line.
- **2026-09-28** — Eight bottom sheets unified on a shared `SheetHandle` and
  `SHEET_BLUR_INTENSITY` (handles had drifted; blur was 40 on some sheets and 48 on others).
- **2026-09-28** — Aura trading card flips on body tap only; standalone "Flip Card 🔄" button and
  the duplicate hamburger menu entry both removed.
- **2026-09-28** — Four 2026-09-25 audit defects fixed (Highlights search jump, Spotlight
  "Watch Full Highlight" fallback, Soft-Wall age gate blocking *sign in*, seven dead components
  deleted). Regression tests added and each confirmed to fail when the fix is reverted.
- **2026-09-28** — Test suite 41 → 54. First component tests in the repo
  (`SoftWallModal`, `highlights-jump`); Reanimated 4 stubbed in `jest.setup.js`.

---

## 5. Known broken / not yet applied

Do not re-diagnose these. Fix them or leave them.

| Thing | State |
| --- | --- |
| `supabase/clear_reel_hype.sql` not applied on the live DB | Un-voting a Seki/Aura/Flex no longer flickers, but the count **returns on refresh**. Client keeps the optimistic value deliberately. |
| `telemetry_logs` INSERT policy is `with check (true)` for `anon` | The anon key ships in the app bundle, so **anyone can inject fake analytics events**. Poisons every Reports / Coverage / Money number. Unpatched. |
| `telemetry_logs` has no `user_id` / `session_id` | No funnels, retention, or per-user behaviour is possible. Owner chose "session + user id" but it is **not built** — it is a privacy change needing policy copy first (§6). |
| Expo web bundle | Fails on `lightningcss` native binary (missing for 1.33.0; 1.32.0 blocked by macOS code signing). Mobile is unaffected. |
| Storage buckets `reels` / `game_highlights` / `avatars` are public | Vault-locked video is directly downloadable, bypassing entitlement. Accepted for internal testing only — ROADMAP Phase 5 hard blocker. |
| `auth.role() = 'anon'` bypass on 8+ tables | Studio Unlock and Operator PIN have no real session. Accepted for internal testing, **not** for public beta. |
| No staging Supabase project | ROADMAP Phase 2 item 4 — the remaining blocker before tester rollout. |
| `main` is ahead of `origin/main` | Pushing needs interactive GitHub auth. |
| Self-verify holes — **fixed in SQL, not applied** | On the live DB today: `profiles.player_id`, `is_verified` and `verification_status` are client-writable (no column guard on "Users update own profile"), so any signed-in user can mark themselves verified and self-link to any athlete; a shared team code verifies instantly; admin approval stamps every profile with the same name. The client no longer does any of this, but the database still allows it until `supabase/migrations/20260929120000_athlete_verification_ladder.sql` is applied. ROADMAP Wave 1 blocker. |
| Held gifts have no cap or refund yet | Gifts to an unverified athlete are "held" only because payouts are 503. The design's ~$250 cap and 30-day refunds need the Phase 1a ledger. Future payout code must call `athlete_payout_allowed`. |
| School confirm link needs the app | `alasports://school-confirm` opens only where Tapua'i is installed (Edge Functions can't serve HTML on the default domain). A web page for staff without the app is not built. Confirmers are added from the SQL Editor — no admin UI yet. |
| One report hides a clip, with no reason | `report_reel` sets `is_flagged` on the first report and records no reason, so rival fans can hide real clips and moderators can't spot AI fakes. Plan: design doc §6. |
| `supabase/custodial_money.sql`, `supabase/leaderboards.sql` and `supabase/migrations/20260929120000_athlete_verification_ladder.sql` not applied on the live DB | Written 2026-09-29, never parsed by Postgres. The verification card and school form hide/fail gracefully until the migration is applied. Until applied, the custodial cards and Spotlight Boards hide themselves and view counting no-ops. Apply by hand after review (staging first). |

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
9. **Fee model.** Fan copy promises 100% to the athlete; the admin split table says 10% platform;
   App Store 3.2.1(vii) appears to require 100% for non-IAP gifts. Recommended: 0% from gifts plus
   an optional "tip Tapua'i" at checkout. Owner + counsel. Do not turn on a rake in fan UI until
   decided.

10. **Athlete verification and fake highlights** — `docs/ATHLETE_VERIFICATION_DESIGN.md`.
    **Decided 2026-09-29:** gifts are held until verified and the athlete sees that in the app; the
    athletic director or coach confirms each student in person on a Tapua'i form. Built (not
    applied). Still open: the pending-gift cap amount and refund window (need the ledger), and
    counsel on the "held" copy.

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
| `docs/CODE_ORGANIZATION_PLAN.md` | Keep the code easy to review and cheap to move hosts later (we are **not** moving now): commit hygiene, dated SQL files, generated types, big-file splits, a Supabase-coupling map, and the rule that screens call `lib/`, never Supabase directly (10 files break it). Step 0 done. |
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
