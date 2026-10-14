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

- [ ] Write runnable real-actor failing replay scenarios using existing cached PGlite stubs; prove missing RPC red failure.
- [ ] Implement bounded campaign/private entry/exact permission/ballot/case/reflection state machines and private bucket policies. Server roles, age, canonical profile IDs, all deadlines and idempotency apply.
- [ ] Test bad actors, unknown/closed/teen/guardian cases, late/stale/duplicate ballots, ties/recount and private media boundaries with actual SQL and grants.
- [ ] Append migration to canonical schema, expose strongly typed JSON DTOs, document any interface adjustment for consumers.
- [ ] Run targeted replay and mobile typecheck; self-review grants/data minimization and commit owned paths. Root handles schema/data registry docs.

### Task 2: Private media validation and API

**Owned files:** new backend `services/fanZoneMedia.ts` and focused MP4 validator, API `fanZoneMedia.ts`/`fanZoneUpload.ts`/`fanZoneRemove.ts`, thin matching `app/api/*+api.ts`, backend Jest tests.
**Interfaces:** Consumes Task 1 `fun_media_access`, `fun_verify_media`, `fun_complete_removal`; publishes media GET, upload verify POST and remove POST with explicit JSON result/error and authenticated bearer contract. Return bytes/secret-free errors; no signed URL.

- [ ] Write failing duration/container/metadata corruption/authorization/no-cache/range and remove failure tests.
- [ ] Implement bounded MP4 metadata sanitization with preserved offsets, SHA-256 and real server-only storage calls; verify caller before service access and after upload before commit.
- [ ] Implement revocable media serving and tracked removal; no public fallback or result completion before actual storage deletion.
- [ ] Document exact API request/query/response contracts for Task 4, run tests/typecheck and commit owned files.

### Task 3: Admin desk and client adapter

**Owned files:** new frontend `lib/fanZone.ts`, admin `components/Admin/FanZone/` files/tests, `app/(admin)/admin/fan-zone.tsx`, existing `lib/admin.ts` navigation entries and relevant adminNavigation test changes.
**Interfaces:** Consumes Task 1 DTO/RPCs; produces bound typed SDK used by Task 4. Supports Task 2 API verification/removal without client service key. Root owns coverage map additions after desk exists.

- [ ] Write failing SDK exact-binding and admin visible unavailable/actions/status tests.
- [ ] Build admin-only campaign configuration/operation, entry review/consent status, valid ballot/result/case/removal controls and complete bounded Data view with source status and Analytics/Health/Support links.
- [ ] Use AdminShell, AdminChrome and single-flight action handling. Check errors/empty selection/paused state; counts are not fictitious healthy data.
- [ ] Test gate/navigation/real SDK calls and visible review feedback; run typecheck and commit owned files.
- [ ] Root runs independent admin/Data/Safety/SUPPORT review, generates governance docs and preserves admin-ready evidence/gate before fan work.

### Task 4: Fan discovery, private entry, guardian consent and free ballot journey

**Owned files:** new frontend `components/FanZone/` files/tests, `hooks/useFanZone.ts`/tests, route `app/(tabs)/fan-zone.tsx`, Home discovery card in its existing consuming component. Root owns coverage/index/state integration.
**Interfaces:** Consumes shared DTOs and `lib/fanZone.ts`, Task 2 media API. Existing public free reel and profile navigation supply curated stories; no new payment code.

- [ ] Write failing visible flow tests for private upload/permission/review, guardian exact revision, free ballot retry/refetch, optional reflection/report/withdraw/deletion and unavailable states.
- [ ] Build one welcoming Fan Zone screen with three paths, concise testing notices, explicit dates/rules and a preserved upload draft. No mandatory money, athlete tagging or service.
- [ ] Use private reserved paths; verified MP4 only; exact permission read/review, candidate video playback with headers/no cache, ballot version/request receipt/single-flight and fresh state after retry.
- [ ] Render current authorized stories/results, optional private service receipts and distinct withdrawal/removal/case status. Guest browsing remains read-only and joining uses existing account flow.
- [ ] Run focused UI/hook/API tests/typecheck; commit owned files; independent task review before final completion.

### Task 5: Data, documentation, coordination and final verification

**Owned files:** root integrates governed data-ownership/DATA_MAP/SCHEMA/migration README, detection sensors and adminCoverage. DOCUMENTATION reviews affected feature/product/legal/growth docs; VP_OPERATIONS reconciles existing roles/queue/plan tasks with actual executors, preserving model pins.
**Interfaces:** Consumes prior task reports/commits and exact tests; no invented hosted/legal readiness.

- [ ] Reconcile all new tables/functions/storage/source/export ownership, migration dependencies, support sensor gaps, entry controls and readable module map.
- [ ] Complete independent broad code/Safety/Data review, correct concrete failures and run covered checks.
- [ ] Run `pnpm check`, local SQL replay, declared admin/app feature gates and source diff checks; record actual outputs and untested hosted/device/policy paths.
- [ ] Preserve final evidence and update STATE/CHANGELOG/task progress. Keep build in isolated checkout for concrete review; no merge/push/deployment.
