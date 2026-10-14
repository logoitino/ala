# Fan Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the approved first Fan Zone as a safe, free-voted, locally testable family pilot.
**Architecture:** Narrow SQL state/consent/ballot RPCs and a private revocable media API support one Expo admin desk, then a small fan screen. Existing payments and public reel flows remain separate.
**Tech Stack:** Expo 57 / React Native / TypeScript / Supabase PostgreSQL / expo-video 57.0.5 / PGlite local replay.
**Spec:** [FAN_ZONE_DESIGN.md](FAN_ZONE_DESIGN.md).

## Global Constraints

Follow every scope/constraint in the spec. Work only in `/Users/seiuliian/Downloads/ala-sports/.claude/worktrees/fan-zone`.
No SQL application, hosted deployment, purchases, merge or push. You are not alone; preserve others' edits.
Root owns registry, documentation index, STATE, CHANGELOG, AGENTS and final integration. Source files need purpose/side-effect headers.
No new dependency, client secrets, video caching, public Fan Zone storage or donations influencing votes.
Read STATE then AGENTS and applicable role standards. Cached official Expo 57 docs `/tmp/ala-expo57-reference.html.txt` and `/tmp/ala-expo57-video-doc.html.txt` have been verified as version 57; use these while network is blocked.
Shared DTO/RPC contracts are owned by Task 1. Admin readiness must actually pass before Task 4 source begins.
Workers do not spawn reviewers. Commit only owned files; report exact tests/results/red phase, changed files, limitations and self-review.

### Task 1: Backend, shared contracts and real actor replay

**Owned files:** new `supabase/migrations/20261014130000_fan_zone.sql`, append to `apps/mobile/src/backend/db/schema.sql`, new `packages/shared-types/fanZone.ts`, shared package export, new `scripts/replay/fan-zone-replay.mjs`.
**Interfaces:** Produces spec RPCs and shared DTOs/actions for Tasks 2–4. No direct table writes/read or storage reads for clients.

- [x] Write runnable real-actor failing replay scenarios using existing cached PGlite stubs; prove missing RPC red failure.
- [x] Implement bounded campaign/private entry/exact permission/ballot/case/reflection state machines and private bucket policies. Server roles, age, canonical profile IDs, all deadlines and idempotency apply.
- [x] Test bad actors, unknown/closed/teen/guardian cases, late/stale/duplicate ballots, ties/recount and private media boundaries with actual SQL and grants.
- [x] Append migration to canonical schema, expose strongly typed JSON DTOs, document any interface adjustment for consumers.
- [x] Run targeted replay and mobile typecheck; self-review grants/data minimization and commit owned paths. Root handles schema/data registry docs.

### Task 2: Private media validation and API

**Owned files:** new backend `services/fanZoneMedia.ts` and focused MP4 validator, API `fanZoneMedia.ts`/`fanZoneUpload.ts`/`fanZoneRemove.ts`, thin matching `app/api/*+api.ts`, backend Jest tests.
**Interfaces:** Consumes Task 1 `fun_media_access`, `fun_verify_media`, `fun_complete_removal`; publishes media GET, upload verify POST and remove POST with explicit JSON result/error and authenticated bearer contract. Return bytes/secret-free errors; no signed URL.

- [x] Write failing duration/container/metadata corruption/authorization/no-cache/range and remove failure tests.
- [x] Implement bounded MP4 metadata sanitization with preserved offsets, SHA-256 and real server-only storage calls; verify caller before service access and after upload before commit.
- [x] Implement revocable media serving and tracked removal; no public fallback or result completion before actual storage deletion.
- [x] Document exact API request/query/response contracts for Task 4, run tests/typecheck and commit owned files.

### Task 3: Admin desk and client adapter

**Owned files:** new frontend `lib/fanZone.ts`, admin `components/Admin/FanZone/` files/tests, `app/(admin)/admin/fan-zone.tsx`, existing `lib/admin.ts` navigation entries and relevant adminNavigation test changes.
**Interfaces:** Consumes Task 1 DTO/RPCs; produces bound typed SDK used by Task 4. Supports Task 2 API verification/removal without client service key. Root owns coverage map additions after desk exists.

- [ ] Write failing SDK exact-binding and admin visible unavailable/actions/status tests.
- [ ] Build admin-only campaign configuration/operation, entry review/consent status, valid ballot/result/case/removal controls and complete bounded Data view with source status and Analytics/Health/Support links.
- [ ] Use AdminShell, AdminChrome and single-flight action handling. Check errors/empty selection/paused state; counts are not fictitious healthy data.
- [ ] Test gate/navigation/real SDK calls and visible review feedback; run typecheck and commit owned files.
- [ ] Root runs independent admin/Data/Safety/SUPPORT review, generates governance docs and preserves admin-ready evidence/gate before fan work.

### Task 4: Fan discovery, private entry, guardian consent and free ballot journey

**Owned files:** new frontend `components/FanZone/` files/tests, `hooks/useFanZone.ts`/tests, route `app/fan-zone.tsx`; shared Home/profile/HQ discovery is delegated to Task8. Root owns coverage/index/state integration.
**Interfaces:** Consumes shared DTOs and `lib/fanZone.ts`, Task 2 media API. Existing public free reel and profile navigation supply curated stories; no new payment code.

- [ ] Write failing visible flow tests for private upload/permission/review, guardian exact revision, free ballot retry/refetch, optional reflection/report/withdraw/deletion, in-screen Help & Safety/contact/status and unavailable states.
- [ ] Build one welcoming Fan Zone screen with three paths, concise testing notices, explicit dates/rules and a preserved upload draft. No mandatory money, athlete tagging or service.
- [ ] Use private reserved paths; verified MP4 only; exact permission read/review, candidate video playback with headers/no cache, ballot version/request receipt/single-flight and fresh state after retry.
- [ ] Render current authorized stories/results, optional private service receipts and distinct withdrawal/removal/case status. Guest browsing remains read-only and joining uses existing account flow.
- [ ] Run focused UI/hook/API tests/typecheck; commit owned files; independent task review before final completion.

#### Task4 contract clarifications from producer and discovery preparation

Source starts only after root records the actual Fan admin gate. Shared discovery remains Task8-owned.
The stable hook exposes snapshot/null, loading, error, busy and readonly refresh, with identity/read epochs.
The root route validates optional canonical campaign ID; permissions section is presentation only.
Guardians revoke exact permission or request removal; owner withdrawal is a different action.
Actual video readiness, caption and exact scope review precede consent. Uncertain ballots retain exact
request/candidate/version and require an authoritative current-ballot read after the receipt.
Private uploads use reserved paths/compression/byte verification, without public upload fallback.
Help & Safety contains real concern/status controls and selectable authorized configured contact;
policy information receives no report. Guest missing contact and a staffed public fallback remain explicit.
All tracked revisions must be absent before showing completed removal. Optional service stays private
and has no money, Aura, voting or public badge effect. Preserve concurrent work and request a serialized
commit window for owned files only.

## Task 5: Data, documentation, coordination and final verification

**Owned files:** root integrates governed data-ownership/DATA_MAP/SCHEMA/migration README, detection sensors and adminCoverage. DOCUMENTATION reviews affected feature/product/legal/growth docs; VP_OPERATIONS reconciles existing roles/queue/plan tasks with actual executors, preserving model pins.
**Interfaces:** Consumes prior task reports/commits and exact tests; no invented hosted/legal readiness.

- [ ] Reconcile all new tables/functions/storage/source/export ownership, migration dependencies, support sensor gaps, entry controls and readable module map.
- [ ] Complete independent broad code/Safety/Data review, correct concrete failures and run covered checks.
- [ ] Run `pnpm check`, local SQL replay, declared admin/app feature gates and source diff checks; record actual outputs and untested hosted/device/policy paths.
- [ ] Preserve final evidence and update STATE/CHANGELOG/task progress. Keep build in isolated checkout for concrete review; no merge/push/deployment.

### Task 6: Sport Pop Quiz operational backend/admin

**Spec:** [SPORT_POP_QUIZ_DESIGN.md](SPORT_POP_QUIZ_DESIGN.md), newly requested by owner during FUN-01 implementation.
**Owned files:** new quiz migration, shared sportQuiz types, client lib, replay, Admin/SportQuiz components/tests and route. Root serializes schema append/shared export/admin nav/governance.
- [x] TDD real actor weekly assignment, no answer leak, exact retry, skip, void/correction and noncash badge constraints.
- [x] Build approved versioned bank, default paused settings, admin Data/actions/audit and client adapter; no fan source yet.
- [x] Run replay/admin tests/typecheck, commit only owned paths; independent review and root admin-ready gate.

### Task 7: Sport Pop Quiz fan card/view

**Owned files:** new SportQuiz components/tests, hook/tests, route. Root serializes Home discovery/card integration.
- [ ] After QUIZ-01 admin-ready, build dismissible Home learning invitation, sport choice, weekly question/answer/explanation, private badge collection and skip.
- [ ] Test visible unavailable/skip/incorrect/correct/completed/retry and no money/vote influence; no push or interrupting modal.
- [ ] Independent review and final gates/docs integrated with Task 5 after both features.


### Task 8: Shared discovery and control-map integration

**Ownership delegated by root:** new frontend `components/FamilyFun/FamilyFunDiscovery.tsx` and meaningful tests; root `app/_layout.tsx` navigation registration, existing Home `app/(tabs)/index.tsx`, profile menu in `app/(tabs)/profile.tsx`, role home routes `app/(parent)/parent/index.tsx`, `(booster)/booster/index.tsx`, `(sponsor)/sponsor/index.tsx`, `operator/index.tsx`; `lib/adminCoverage.ts` and relevant existing/new control-map tests. Root retains docs/schema/registry/data map/final gates. Preserve all concurrent source.

- [ ] Quiz integration starts only after Task7 independent review PASS and actual QUIZ admin-ready; reuse its typed hook/invitation. Fan discovery extension starts only after Task4 review PASS and actual FUN admin-ready.
- [ ] Place dismissible optional invitation inside Home's measured top chrome and role-HQ scroll content; no modal/new bottom tab/payment/upload interruption. Keep root account links accessible to every eligible role, private history and guardian review through appropriate server snapshots.
- [ ] Refresh reads on return/focus and week changes without assigning automatically; local Not now state scoped to current identity/week, distinct from server-confirmed Skip. Ignore stale identity data and keep unavailable honest.
- [ ] Add authenticated profile menu links for quiz/private badges and Fan Zone, direct root paths. Existing account/role/payments/roster actions preserved.
- [ ] Map every new visible control to the actual admin desk; no fabricated runtime flag or passive telemetry. SQL campaign/settings are the authoritative stop controls.
- [ ] Meaningful consumer tests for role discovery, eligibility/private history/guardian queue, local dismissal versus failed/durable Skip, focus/week refresh and source absence. Run typecheck/relevant tests and self-review; commit only owned paths in root's serialized window, independent review before final gates.
