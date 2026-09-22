# Tapua'i — Fix → Test-Prep → Advance → Team-Test Roadmap

Companion to [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md), [AUDIT_REPORT.md](AUDIT_REPORT.md), and [TEAMS.md](TEAMS.md#qa--ship-gate). This is the live tracker for closing the pre-launch security/compliance gaps, standing up real testing infrastructure, and running an internal test wave before any public beta. Update the status line under each phase as work lands — do not let this drift into a one-time snapshot.

## Context

Two audits found: (1) money/Aura/admin-data can currently be fabricated because RLS trusts the client instead of a verified payment; fixes are drafted but not yet applied to a live Supabase project. (2) The single biggest go-to-market risk is high-school NIL "pay-for-play" optics — Mālo is wired to a specific highlight clip (`reel_id` on `tips`), closer to "paying for a play" than the "gift to an athlete" framing the product needs. Separately, the repo had zero automated tests, no staging build pipeline, and no deployment target before this roadmap started.

Internal dogfooding runs now, in Stripe test mode, in parallel with Phase 1 — it is **not** gated on legal/compliance work. Only a public beta with real money is gated on Phase 1 + a written association position.

---

## Phase 0 — Land the security fixes that already exist

*Status: fixes coded and typechecked this session; not yet applied to a live Supabase project (needs the team's own credentials).*

1. Apply `apps/mobile/src/backend/db/schema.sql`'s RLS/grant changes to the actual Supabase project.
2. Deploy the admin portal's auth gate (`apps/admin-portal/middleware.ts`, `app/(protected)/layout.tsx`, `lib/authz.ts`) to a real hosting target.
3. Deploy `supabase/functions/stripe-webhook`, set `STRIPE_WEBHOOK_SECRET` + `SUPABASE_SERVICE_ROLE_KEY`, add the Stripe dashboard endpoint for `payment_intent.succeeded`.
4. Two open decisions (flagged, not defaulted): a `profiles_public` view/column-allowlist to stop full PII being publicly SELECT-able; and replacing Studio Unlock / the operator demo-PIN's anon-write policies with real authenticated sessions — this turned out to be broader than just Operator once swept (see the Phase 5 "Hard blocker" note below for the full 8+ table list).
5. **Security sweep, round 2 (2026-09-22):** a broader grep for the same "fabricatable financial row" pattern found and closed three more gaps beyond the original tips/subscriptions/profiles/admin-portal pass: `reels` INSERT/UPDATE was wide open (fixed — uploader/admin-only ownership + column-level grants so a raw update can't touch counters or moderation flags); `toggle_reel_vault_status` and `set_reel_flash_unlock` RPCs had **zero ownership checks at all** (any signed-in user could lock/unlock or flash-unlock any athlete's Vault clips — fixed); `sponsorships` and `shop_orders` INSERT were wide open the same way `tips` used to be (fixed — `auth.uid()` ownership, admin bypass on `sponsorships` for the legitimate manual-entry admin path). **Still open, not yet fixed:** `sponsorships`'s separate `"Admin write sponsorships"` policy still has an `auth.role() = 'anon' or ...` bypass on UPDATE/DELETE (lower severity than the INSERT gap that's now closed, but the same pattern — worth a future pass). This kind of sweep is worth repeating periodically rather than assuming the original audit was exhaustive.

**Round 3 (2026-09-22, critical — found by a QA rotation, fixed same day):** `add_user_role` had **no role check at all** — any signed-in fan account (no anon key needed) could call it directly to set `is_admin = true` on their own profile, a full self-service privilege escalation that retroactively defeated every `current_user_role() = 'admin'` gate built this session. This is strictly worse than the Phase 5 "Hard blocker" above, since it doesn't need the anon key. Fixed: the RPC now only allows self-service `fan`/`athlete`; any other role (including `admin`) requires the caller to already be admin. Also closed a deeper hole the RPC fix alone wouldn't have caught — a raw `profiles` UPDATE could set `is_admin`/`role`/`roles` directly, bypassing the RPC entirely — via a new `before update` trigger (`guard_profiles_admin_escalation`) rejecting any admin-flag write from a non-admin session, as defense-in-depth alongside the RPC. Same pass also closed a related gap on `players`: `booster`/`operator` roles could still write `guardian_id` directly (bypassing `admin_set_player_guardian`, contradicting that fix's own documentation) — now column-grant-restricted, with two new narrow RPCs (`parent_set_player_consent`, `admin_approve_player_consent`) replacing the two legitimate direct-write call sites that would otherwise have broken.

**Round 4 (2026-09-22): systematic sweep of every `SECURITY DEFINER` function taking a `target_*` parameter, same day as round 3.** Confirmed real: `get_fan_tip_history` fell back to trusting a client-supplied `fan_user_id` whenever there was no session (`coalesce(auth.uid(), fan_user_id)`) and was anon-executable — anyone with the public anon key could read any fan's complete Mālo tipping history with no login, by guessing an id (easy, since `profiles` is already publicly readable — a separate, already-deferred gap). Fixed: always requires a real session, `authenticated`-only now. Confirmed this exact `coalesce(auth.uid(), ...)` shape does not appear anywhere else in the schema. Also found and fixed: `can_confirm_player_tag` had an explicit `auth.role() = 'anon' or ...` bypass, meaning anyone with the anon key — no session — could confirm or reject the athlete tag on any Highlight, which feeds directly into Player-of-the-Week/Spotlight scoring (a competition-fairness issue, not just data exposure); and `set_player_vault_locked` had no ownership check at all, letting any signed-in fan lock or unlock any athlete's Vault. Both fixed with proper role/ownership checks. Full one-line-per-function inventory of ~20 functions is in that task's transcript — two more zero-check functions were found (`delete_sport_config`, `triage_app_feedback`) but both are masked by, and deferred alongside, the Phase 5 "Hard blocker" above (same root cause: no real session backing Studio Unlock).

**Owner:** BACKEND (#1, #3, #5), ADMIN (#2). **Exit criterion:** a fresh Supabase project seeded from the updated schema, webhook live, before any tester touches anything but Stripe test mode against a throwaway project.

---

## Phase 1 — Compliance-driven product changes

*Status: items 1 and 2 were already shipped by prior work before this roadmap started (verified, not assumed). Item 4 (age gate + freeze switch) landed, then a QA rotation caught two real gaps in it and both are now fixed: (a) the freeze switch originally only blocked the `tips` ledger row while backer count, Aura, and the Stripe charge itself all still went through for a frozen athlete — now closed at three independent layers (pre-charge check in `createPaymentIntent.ts`, RLS on `tips`/`subscriptions`, and inside `add_user_aura`/`increment_backer_count`/`increment_reel_tips`/`chip_in_wishlist_item`); (b) the age-gate modal could be raced by Soft-Wall's resume logic firing a stashed Mālo checkout before confirmation completed — `SoftWallContext` now waits on `needsAgeConfirmation` before resuming. Item 3 (parent-payee Connect) has a design doc (`docs/PARENT_PAYEE_CONNECT_DESIGN.md`) with 6 explicit sign-off-needed decisions and additive schema groundwork only (`players.guardian_consent_at` + a missing index on the existing `players.guardian_id`) — the design reuses the guardian-link model that already partially existed rather than adding a new column. Two new gaps surfaced during that design pass. One is fixed: `players` RLS letting any `parent`-role account self-assign as guardian of any athlete with zero verification is closed (2026-09) — `guardian_id` is now admin-only (`admin_set_player_guardian` RPC), a parent can only toggle `parental_consent_approved` on a row it's already linked to, and the full linking-mechanism decision remains open per the design doc §1 (see `docs/PARENT_PAYEE_CONNECT_DESIGN.md` §0 status note). The other remains open: the Parent screen's Stripe payout button is currently a non-functional stub. One older follow-up still open: `useAthleteSubscription.ts`'s `grant()` optimistically unlocks exclusive content on-device before the insert resolves, so a frozen athlete's content could briefly appear unlocked locally even though the DB now rejects the row.*

`reel_id` on `tips` is already nullable and `useTipCheckout`'s `startCheckout` already accepts an optional `reelId` — decoupling Mālo from a single play is a wiring + framing problem, not a schema migration.

1. **Wire the profile-level Mālo entry point.** `AthleteProfileView.tsx`'s `onDropMalo` prop existed but had zero callers — connect it to `startCheckout` with no `reelId` so fans can support an athlete generally, not only mid-clip.
2. **Reframe money surfaces away from per-clip leaderboards.** Anywhere Mālo dollars are ranked per-clip for a fan/press audience, show athlete/season totals instead. Keep `reel_id` on the row for internal attribution and fan receipts.
3. **Parent-as-payee custodial Stripe Connect.** Replace the bare US-individual Express account with the parent/guardian as the Connect account holder, athlete as beneficiary in metadata — per `LEGAL_BRIEFING.md` §8.
4. **Age gate + freeze switch.** Block under-13 signup (COPPA) with a self-attestation confirmation, not birthdate collection. Add a per-athlete/per-school freeze flag enforced at the RLS layer that blocks Mālo + exclusive checkout within hours if a school/association objects.
5. **Outside the repo:** retain sports+payments counsel in the first launch state (Utah), get one association/district position in writing before *public* Mālo goes live.

**Owner:** COMMERCE (#1, #2), BACKEND (#3, #4), paired per `.claude/agents/`. **Exit criterion:** a full Mālo flow works from a profile (not just a clip) in test mode, and a freeze flag demonstrably blocks checkout for a flagged athlete/school.

---

## Phase 2 — Testing infrastructure

*Status: Jest + `@testing-library/react-native` added this session (`pnpm --filter @tapuai/mobile test`, first suites on `lib/aura.ts` and `data/malo.ts`); CI extended to run it; `apps/mobile/eas.json` added with development/preview/production build profiles. Still needed: an actual EAS project (`eas login` + `eas init`, needs the team's Expo account), a second throwaway Supabase project for staging, and folding the AUDIT_REPORT.md smoke checklist fully into `.claude/agents/qa.md` (done) and keeping it current.*

1. Automated tests, narrow and money-adjacent first — tier math, eligibility gating, fee/split calculations — not full Detox/Maestro e2e yet.
2. CI (`.github/workflows/ci-checks.yml`) runs typecheck, docs:check, the test suite, and a secret-leak grep (now covering `service_role` too, not just `sk_test_`).
3. `eas.json` build profiles exist; connecting a real Expo account and running `eas init`/`eas build` is a manual step for the team.
4. A second, throwaway Supabase project for staging — not yet created (needs account access).
5. QA's standing checklist (`.claude/agents/qa.md`, mirrored in `TEAMS.md#qa--ship-gate`) now includes the automated test run and the Phase 1 compliance flows.

**Exit criterion:** `pnpm test` passes in CI (done), a tester can install a real build from a link with no dev-machine dependency (pending EAS account setup).

---

## Phase 3 — Team testing, before real (external) people

Two layers, both starting once Phase 2's build pipeline exists:

**Layer A — AI department QA rotation.** Each department in `.claude/agents/` self-tests its owned surface against the QA checklist, using the staging Supabase project. Dispatch pattern: `CALL: <DEPARTMENT>` → fix/verify + `pnpm typecheck` → `CALL: QA` for the full gate. Lesson from this session's UI-polish pass (one Metro crash, one hooks-order bug from concurrent edits): **batch 3-4 departments at a time, not all 13 at once**, and always close a wave with one QA pass across everything touched.

**Layer B — Real human internal testers, segmented by role.** A small internal group (team, family, friendly coaches/boosters — not the public), split by role:
- **Fan:** browse → Soft-Wall sign-in → Mālo (test card) from both a reel and the profile-level button → Aura tier change → Spotlight.
- **Athlete** (or a parent standing in): claim profile → Varsity verification → Connect onboarding (once Phase 1 item 3 lands) → Vault lock/unlock.
- **Parent:** consent toggle, custodial payout visibility.
- **Operator:** PIN claim → live scoring → sideline callouts, on a real device (the iOS Simulator can't test this flow).
- **Booster:** sponsorship tier checkout.

Feedback funnels through the existing `app_feedback` table / Admin Feedback desk.

**Exit criterion:** every role completes its slice with no P0/P1 bug, on a real installed build, on staging.

---

## Phase 4 — Keep advancing existing features (parallel, not blocked on 0-3)

Runs continuously via the same department-dispatch pattern, on work unrelated to security/compliance/testing: Operator "v2" (real auth, GPS check-in), Sports builder refinements, Drip catalog depth, remaining UI/motion polish (Role HQ portals, Admin desks). Keep `TEAMS.md`'s "Dispatching in Claude Code" section current so parallel work stays coordinated and batched.

---

## Phase 5 — Public beta (real, external people)

Gated on: Phase 0 fully closed, Phase 1 items 1/2/4 done at minimum (item 3 is the hard requirement before any *minor* can cash out — a Mālo-disabled or booster-only beta could launch without it), Phase 3 exit criterion met, and one written association/district position obtained. Sequence per `docs/INVESTOR.md`'s existing GTM sketch: one metro (Utah), sideline operator before consumer ad spend, booster club as the first paying customer rather than the athlete as first payee.

**Hard blocker found 2026-09-22, explicitly accepted as an internal-testing-only risk, NOT to ship publicly with:** `current_user_role()` only resolves to `'admin'` for a real Supabase-authenticated session — but the Expo `/admin` app's "Studio Unlock" is a purely client-side cosmetic gate with no server-side session behind it, and the Operator PIN-claim flow has the same shape (no real Supabase session). Because of this, 8+ tables' "admin-only" or "operator-only" RLS policies actually read `auth.role() = 'anon' or current_user_role() = 'admin'` — which is satisfied by *anyone* holding the public anon key, not just a Studio-unlocked admin or PIN-claimed operator: `operator_gigs`, `operator_checkins` (this one has no role check at all — `using (true)`), `shop_products`, `schools_and_teams`, `cheer_polls`, `sponsorships` (UPDATE/DELETE only — INSERT already fixed), `app_feedback` (read AND write — any fan's feedback is readable/editable by anyone), `wishlist_items`, `sport_configs`. The anon key ships inside the app bundle, so this is invisible risk today (small trusted internal testers) and a real one the moment the app is public. **Real fix (not yet built, a product decision, explicitly not defaulted on):** Studio Unlock and/or the Operator PIN flow need to establish a real Supabase session (or an equivalent server-verifiable credential) so `current_user_role()` can actually distinguish an admin/operator from anyone else — only after that can the `auth.role() = 'anon' or ...` bypass be safely dropped from all of these policies. Do not close Phase 5 without resolving this.

---

## Verification

- Phase 0/1: `pnpm typecheck && pnpm docs:check` clean; manual confirmation against the staging Supabase project that the fabricated-tip/anon-grant exploits are actually closed.
- Phase 2: `pnpm test` runs in CI; a teammate installs a build from an EAS internal link with no dev-machine dependency.
- Phase 3: QA checklist fully green from both the AI rotation and the human role-based pass, tracked via `app_feedback`/Admin Feedback desk.
- Ongoing: `TEAMS.md` and `.claude/agents/*.md` stay in sync as departments' owned surfaces evolve.
