# Beyond the Game Implementation Plan

> Execution: scoped producers below, then independent cross-review and root integration. Use the established subagent-driven workflow. Preserve Claude's existing changes; workers are not alone and must not revert others. No helpers, commits, merges, installs, deployments, hosted SQL or spending.

**Goal:** Build the approved dedicated tab and reviewed fan photo/video path, and complete safe CHAL-01a participation.
**Architecture:** Existing reels supply workout/service discovery; a private moderated contribution contract supplies any-user media without athlete association. Existing Highlights admin owns both operational desks; gates precede participant integration.
**Tech Stack:** Installed Expo SDK 57 / React Native, Node 24, existing Supabase and PGlite tooling; no dependencies.
**Spec:** [BEYOND_GAME_DESIGN.md](BEYOND_GAME_DESIGN.md).

## Global constraints

Follow design age/audience, private-media, default-off, no-money/no-chat rules exactly. Core Highlights stays the opening route. Root integrates generated type/data maps and current docs. Public Expo 57 docs fetch was unavailable in this internet-disabled session; inspect installed SDK and existing project API usage, introduce no new Expo API/dependency.

## Task 1 — workout server repairs

Producer engineering_review: exact existing unapplied `supabase/migrations/20261016100000_workout_challenges.sql`, its matching canonical block, and `scripts/replay/workout-challenges-replay.mjs`. No other schema blocks or metadata/docs.

- [x] Add actual failing probes: deleting audit-referenced admin/target profiles succeeds with audit action/time retained; audit arbitrary update denied; response remove/repost cannot exceed 50 distinct workout responses per 24 hours; late athlete block hides counts/inbox; closed admin read/mutation denied.
- [x] Run replay against actual PGlite, retain RED, then implement narrow repairs and repeat to GREEN. New quota data gets explicit owner/export/erasure/retention semantics supplied to root.
- [x] Capture exact scoped source/diff/check evidence and release claims for independent Data/RLS review.

## Task 2 — workout protected controls and participant components

Producer growth_review: `components/Admin/WorkoutChallengesPanel.tsx`, its tests, new `components/Challenges/*`, new challenge hook and their tests. Root adds required actor binding to existing wrappers/tests; shared DTO remains stable; root owns mounts.

- [x] Write failing retained/deferred admin actor/request/action tests. Clear protected data on error or outgoing actor; show error/retry and disable stale actions. Keep reason controls/audit semantics.
- [x] Verify GREEN and freeze admin source for independent review. Do not implement participant code until root gives actual CHAL-01 admin-ready evidence.
- [x] After that gate, build `ChallengeBar({reelId, active})`, `ChallengeInbox`, and `ChallengeSettings` using existing lib/challenges and actor-bound minimal accepted-friend RPC. Bind reads/actions to actor, target and focus; counts null stay hidden; invite acknowledgment never promises delivery. Settings include own mutes/athlete switch/private noncash badge/export.
- [x] Actual tests cover account transition, stale completion/action, errors/disable, removed post, friend permission and private badge. Root mounts on Beyond existing workouts, Activity and own Profile; held ReelCard/controller remains intact; root adapters link to the established athlete profile for viewing/support.

## Task 3 — Beyond source/admin, then participant

Producer legal_review: new `supabase/migrations/20261016120000_beyond_game.sql`, new `scripts/replay/beyond-game-replay.mjs`, `packages/shared-types/beyondGame.ts`, `lib/beyondGame.ts`, `services/BeyondGameMediaService.ts`, new `components/Admin/BeyondGamePanel.tsx`, and their tests. Root integrates schema and metadata. This executor is a producer, not its independent reviewer.

- [x] Publish exact DTO/RPC contract to root before implementation: categories workout/service/learning/story; `fetchBeyondPosts(category, limit)`, own status, reserve/finalize/cancel/report, admin status/switch/list/review/cleanup. DTO carries post/creator/category/caption/audience/review state and exact scoped media references. Unknown/malformed values fail conservatively.
- [x] Write RED SQL probes for default-off/dependencies, wrong actor/object/audience, teen audience, private pending/removed files, block/closed changes, quota removal churn, direct grants, report hide, reasoned admin review and deletion cleanup. Implement source/admin only; source mirror is root integration.
- [x] Build protected admin queue, preview, reason actions, error/retry and cleanup. Private uploads use no public URL/upsert fallback; bounded signed URLs, truthful failures and orphan controls. Tests exercise SDK payloads and protected actor/request/action behavior.
- [x] Independent Engineering and Data/Privacy review; root records actual admin-ready and selected gate before participant UI.
- [x] Then build `BeyondGameScreen` and `BeyondGameComposer` with staged category/media/details/review, required rights/safety consent, teen-safe audience, pending/removed status, own cancel and report/retry. Keep draft on Back, prevent duplicate upload, clear outgoing actors/media, reject retained actions. No athlete selector/money/chat. Reuse bounded actor-bound workout/service profile-link cards through root-supplied adapter.
- [x] Verify meaningful UI/parser/media-boundary regressions, and release exact source claims.

## Task 4 — integration and acceptance

Root: enroll BEYOND-01 before source, update CHAL-01 contract; new design/ledger, existing feature metadata/STATE/index/queue/changelog/privacy/schema/migration docs/data ownership/sensors; schema append; generated types/maps; nav/runtime/coverage/shared flags; `(tabs)/beyond.tsx`, layout, Profile/Activity/HighlightsTool mounts and scoped integration tests.

- [x] Freeze baseline and run pre-change full check. Adopt actual review findings/owner scope in ledger. Do not modify previously applied migrations or unrelated worktrees.
- [x] Integrate backend/admin and generated maps, get independent reviews, resolve findings, record actual CHAL/BEYOND admin-ready timestamps/evidence and selected gates.
- [x] Integrate dedicated nav with Drip Profile link, runtime disable control and four filters, then participant mounts. Preserve Highlights route/feed/optional support; verify Drip remains reachable and hidden tab behavior is consistent.
- [x] Run covering tests, both types, actual SQL replay, retained `pnpm detection:scan` full gate and browser/device-capability checks available locally. No skipped gates silently count as PASS.
- [x] Actual Documentation/VP handoff; status/claims release and final metadata checks. App-ready means local source evidence; hosted migration/media/device/legal/launch limits remain explicit.
