# Timed Trivia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace untimed Quiz with optional, private, sports-first timed learning and reviewed admin operations.

**Architecture:** A new append-only SQL migration owns assignment, deadline, repeat history and exact recovery. An admin desk verifies operations before a sanitized account hook and ephemeral round hook expose the player flow. Only the original mounted round holds the prompt capability.

**Tech Stack:** Node 24, Expo 57, React Native, TypeScript, Supabase PostgreSQL, existing Expo Crypto, cached PGlite actor replay and Jest. No new dependency.

**Spec:** [TIMED_TRIVIA_PROPOSAL.md](TIMED_TRIVIA_PROPOSAL.md), including accepted implementation boundaries in §7.

## Global Constraints

- Work only in `/Users/seiuliian/Downloads/ala-sports/.claude/worktrees/fan-zone`; preserve unrelated work. Commit by owned path.
- Local implementation authorized. No hosted SQL, launch, provider spending, merge or push. Default paused/testing-only/empty cohort, cap 100.
- Read STATE, AGENTS, role standards and cached official Expo 57 docs `/tmp/ala-expo57-reference.html.txt` before source. Read versioned Crypto documentation before its use.
- No public trivia badges, cash, Aura, donation prompts, paid entry or vote/school advantage. Right and wrong committed answers get the same private Trivia Explorer badge.
- 30/90 seconds selected before explicit Start. No reason for choosing longer timing. No popup that starts a timer without Start.
- All participant mutations include `p_expected_profile_id uuid`; reject a JWT/profile mismatch before writing. Known-age/account restrictions remain.
- Every issued family counts as seen until history erasure; no automatic topic substitution. Account/week serialization and unique family exposure enforce this.
- Prompt capability is 32 random bytes encoded as 64 hex characters; hash only in SQL, plaintext memory only. No ACTIVE prompt on ordinary snapshot/history/quiz_receipt; own terminal learning may show question/result/explanation. Active prompt only on authorized original Start. No queued offline answers.
- Admin settings/question/retention mutations require `p_expected_actor_id uuid` equal to the initiating canonical admin and current authorized JWT. Erasure retains disclosed preferences/notices/monotonic revision and minimal35-day quota; it uses CAS rather than UUID receipts, with Refresh/reconfirm after unknown response.
- Root owns canonical schema append, registry, generated map and project documentation. Backend owns migration/types/replays. Consumer owner owns SDK/admin, then participant UI only after actual QUIZ-02 admin-ready.
- Independent Data/Safety/Support, source, Documentation and VP reviews use actual source/evidence; role definitions are not proof of deployed teams or counsel.

## File and interface map

| Owner | Files | Responsibility |
| --- | --- | --- |
| Backend | `supabase/migrations/20261014150000_timed_sport_trivia.sql`; `packages/shared-types/timedSportQuiz.ts`; shared export in `packages/shared-types/index.ts`; `scripts/replay/timed-trivia-replay.mjs`; existing `scripts/replay/sport-quiz-replay.mjs` | Timed contracts, upgrade, real actors; old replay explicitly targets historical untimed schema. |
| Consumer | `apps/mobile/src/frontend/lib/sportQuiz.ts`; SDK tests; existing `components/Admin/SportQuiz/SportQuizTool.tsx`; new `SportQuizBank.tsx`; admin tests | Strict v2 adapter, complete inventory, stop/correction/retention and safe errors. |
| Consumer after admin gate | Existing `hooks/useSportQuiz.ts`, `components/SportQuiz/SportQuizScreen.tsx`, `SportQuizInvitation.tsx`, `components/FamilyFun/FamilyFunDiscovery.tsx`; new `hooks/useTimedSportQuizRound.ts`, `SportQuizPreparation.tsx`, `SportQuizPreferences.tsx`, `SportQuizHistory.tsx`; matching tests | Account status/preferences/history, mounted round lifecycle, invitation claims and player UI. Preserve FanDiscovery and guardian recovery. |
| Root | Canonical schema, SCHEMA, data ownership/map, sensors, enrollment/evidence, STATE, CHANGELOG, docs index, AGENTS and team status docs | Same-turn governance and actual readiness checkpoints. |

### Task 1: Timed authority, private tables, shared contract and actor replay

**Interfaces produced:** Types in `timedSportQuiz.ts` use `contract_version: 2`, `profile_id`, `server_now`, `week_start`, preferences, prompt-free attempt summary, exact unseen topic pools, history revision/counts. `TimedQuizStartReceipt` contains either active question with original `started_at`/`expires_at` or prompt-free terminal metadata. `TimedQuizHistoryPage` contains only terminal immutable question/result records, private badges/corrections and an opaque cursor. Backend publishes exact field definitions before Consumer source.

```sql
quiz_snapshot()
quiz_preferences(p_payload jsonb,p_expected_version bigint,p_request_id uuid,p_expected_profile_id uuid)
quiz_invitation(p_expected_week date,p_request_id uuid,p_expected_profile_id uuid)
quiz_start(p_topic_category text,p_sport text,p_duration_seconds integer,p_expected_week date,
           p_notice_version text,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
quiz_answer(p_attempt_id uuid,p_option integer,p_request_id uuid,p_session_secret text,p_expected_profile_id uuid)
quiz_end(p_attempt_id uuid,p_start_request_id uuid,p_expected_week date,p_reason text,p_request_id uuid,p_expected_profile_id uuid)
quiz_skip(p_expected_week date,p_request_id uuid,p_expected_profile_id uuid)
quiz_receipt(p_request_id uuid)
quiz_history(p_before text default null)
quiz_erase_history(p_expected_history_version bigint,p_expected_profile_id uuid)
quiz_admin_snapshot(p_question_cursor text default null,p_audit_before bigint default null)
quiz_admin_settings(p_payload jsonb,p_reason text,p_expected_actor_id uuid)
quiz_admin_question(p_id uuid,p_action text,p_payload jsonb,p_expected_actor_id uuid)
quiz_admin_retention(p_reason text,p_expected_actor_id uuid)
```

- [x] Write the new runnable actor replay against historical canonical schema; first assertion calls missing timed RPC and fails red. Preserve the old 34-case replay as historical evidence rather than reapplying old functions after the new canonical schema.

```js
const snapshot = await rpc('fan', 'quiz_snapshot()');
assert.equal(snapshot.contract_version, 2);
assert.equal(snapshot.preferences.invitation_mode, 'off');
assert.equal('question' in (snapshot.attempt ?? {}), false);
```

- [x] Run `node scripts/replay/timed-trivia-replay.mjs .smoke/runtime/pglite-cache/package/dist`; retain the expected red result in the task report.
- [x] Add the four private tables and existing question/attempt/badge extensions specified in spec §7. Bind requests with normalized input digests, expected week and canonical actor. Limit/reap receipts with explicit bounded retention; preserve 35-day guards. Helpers and direct private tables are revoked from PUBLIC/anon/authenticated/service clients; narrow RPCs only.

```sql
create table public.sport_quiz_week_guards (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  spent_at timestamptz not null,
  prune_after timestamptz not null,
  primary key(profile_id,week_start),
  check(prune_after = spent_at + interval '35 days')
);
-- After settings/account locks, use clock_timestamp() for deadline decisions.
-- Ordinary reads use one statement_timestamp() and never mutate expiry.
```

- [x] Implement exact Start/answer/End/Skip/preference/invitation receipts. End accepts exactly one attempt or Start UUID and no secret. A pre-Start End saves cancellation. Erasure CAS inserts this week's minimal guard before deleting requests, terminalizes active/pending round and increments retained monotonic revision; preferences/notice remain. Purge own participant learning audit associations under a private protected context, report `removed_audit`, keep editorial/admin audit immutable and redact participant actor/question/attempt associations from admin export. Erasure deliberately has no UUID receipt: stale CAS cannot remove later history, unknown response requires Refresh and review/reconfirm rather than a new automatic deletion.
- [x] Migrate issued old attempts to closed legacy history, preserve completed/void labels, backfill old exposures/recent guards; drop superseded untimed overloads so old clients fail closed.
- [x] Run real actor cases: canonical IDs; denied actors/grants; no prompt leakage; exact/changed recovery; concurrent draws; seen edited family; deadline and server clock after locks; End before Start; answer vs End/pause/void; effective expiry; Off separate from End; mix schedule; exhaustion; erasure/stale retries/retention; legacy; 51 tied inventory rows plus independent audit paging. Snapshot table row counts must remain unchanged.
- [x] Typecheck shared package/mobile, self-review and commit only owned paths. Publish DTO and migration hash to Root. Do not edit canonical or project docs.

### Task 2: Strict SDK and admin operations before participant source

**Interfaces consumed:** Task 1 exact RPCs/DTOs. Existing content normalization helpers remain. Old participant wrappers may remain temporarily to compile but their dropped server signatures must fail closed; retire obsolete runtime exports after participant migration with POLLS/Data approval, preserving historical evidence.

**Interfaces produced:** `fetchTimedSportQuiz`, `saveTimedSportQuizPreferences`, `claimTimedSportQuizInvitation`, `startTimedSportQuiz`, `answerTimedSportQuiz`, `endTimedSportQuiz`, `skipTimedSportQuiz`, `fetchTimedSportQuizReceipt`, `fetchTimedSportQuizHistory`, `eraseTimedSportQuizHistory`, `fetchTimedSportQuizAdmin`, existing question/settings save wrappers, `pruneTimedSportQuizHistory`. SDK input names map exactly to the SQL signatures above.

- [x] Add failing SDK test for v2 and prompt rejection, exact binding/cursor preservation; admin test for complete inventory versus unavailable page.

```ts
rpc.mockResolvedValue({ contract_version: 2, attempt: { question: { prompt: 'leak' } } });
await expect(fetchTimedSportQuiz()).rejects.toThrow();
await fetchTimedSportQuizAdmin({ question_cursor: exactCursor, audit_before: '51' });
expect(rpc).toHaveBeenLastCalledWith('quiz_admin_snapshot', {
  p_question_cursor: exactCursor, p_audit_before: '51',
});
```

- [x] Run focused SDK/admin Jest files and retain red evidence.
- [x] Implement strict adapter and gated single-flight admin desk. All three writes pass captured canonical admin ID; identity generation discards stale reads/results. Load question pages independently of audit; show loaded/full inventory, full totals, effective expiry, cohort/pause and source-missing states. Draft create requires explicit new/existing family; approve requires bounded sources. Pause remains usable despite malformed local cohort edits. Retention report states removed records and preserved unexpired guards; no raw participant answers or token values.
- [x] Run focused tests/typecheck; self-review and commit. Independent source plus Data/Safety/Support review must pass. Root appends canonical and same-turn schema/map/sensor/docs, records actual admin evidence/date and runs `pnpm feature-admin:check --feature QUIZ-02 --require admin-ready`. Participant code waits for its actual exit 0.

### Task 3: Optional player experience and ephemeral round lifecycle

**Interfaces consumed:** Task 2 SDK and Task 1 DTOs; existing Auth canonical profile ID, Expo Router focus, AppState, web visibility and installed Expo Crypto.

**Interfaces produced:** Account `useSportQuiz` owns sanitized snapshot/preferences/Skip/paged history/CAS erasure only. `useTimedSportQuizRound` owns prompt, capability, pending exact Start/answer, original deadline and calm terminal receipt. Route/screen remains `/sport-quiz`. Every read/write is identity/source-generation guarded.

- [x] Write failing hook tests for late Start after blur/background/identity change and original-deadline retry; screen tests for 30/90 before reveal, optional notice/manual start and equal right/wrong badge.

```ts
act(() => round.current.leave('background'));
await act(async () => pendingStart.resolve(activeReceipt));
expect(round.current.live).toBeNull();
expect(endTimedSportQuiz).toHaveBeenCalledWith(expect.objectContaining({
  start_request_id: originalStartId, expected_profile_id: originalProfile,
}));
```

- [x] Run focused hook/screen/FamilyFun tests and retain red evidence.
- [x] Generate 32 cryptographically secure bytes per Start using Expo57 getRandomValues (getRandomBytes has a development Math.random fallback); fail closed when unavailable; retain exact UUID/input until resolved while original view active. Leave synchronously clears token/prompt and invalidates generation; best-effort End by Start UUID closes late issuance. Never use new-account identity for old calls. Back/Home usable while requests pending. Timer uses returned server deadline and elapsed monotonic time; no client acceptance guarantee. A lost answer retries only its same option/UUID.

```ts
const secret = Array.from(Crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const deadlineRemaining = Math.max(0, Date.parse(receipt.expires_at) - Date.parse(receipt.server_now));
// Store secret in a mounted ref only; teardown clears it before any async closure.
// Decrease deadlineRemaining by monotonic elapsed time; SQL owns answer acceptance.
```

- [x] Preparation shows explicit notice, 30/90 choice, sports/topic pool and Start. Manual-only works while invitations off. Save Off suppresses invitations locally immediately, confirmed/unconfirmed states honest. Once-weekly claim only settled Home/HQ, no push or timed popup. Skip consumes this week explicitly; Not now does not consume question/quota. Preserve FanDiscovery body and private guardian queue/errors.
- [x] Show private terminal history/badges and correction; explicit confirmation “Clear history and end this week” explains retained preferences/notices/revision,35-day quota and future repeats. Erasure unknown-response path refreshes/reviews/reconfirms; never retries with a fresh CAS revision automatically. Expired/interrupted rounds are calm; no public failure/streak penalty. Old active summary offers End without prompt/recovery. Retire obsolete untimed runtime wrappers/types only where superseded, with ownership record.
- [x] Run focused player/SDK/admin/shared tests and both TypeScript checks; independent task review; commit owned paths. Root records same-turn docs/map and actual evidence.

### Task 4: Complete local verification, ownership and handoff

**Interfaces consumed:** Committed timed source, task reports/reviews, original QUIZ-01/FUN-01 evidence. Root owns integration and actual dates, reviewers own independent receipts.

- [x] Run current canonical actor replay, unchanged Fan actor replay, explicit historical Quiz replay and current timed actor replay. Retain commands, exit codes and hashes; no hosted execution.
- [ ] Run `pnpm check`; verify both TypeScript checks, full Jest, schema/copy/map/docs/feature/roles/security/detection/recovery gates. Fix only concrete failures through owning worker and scoped review.
- [ ] Produce whole-phase review package from `34b540361b96e3357cf604f0fc274eeb03aab217` to final source commit. Independent reviewer checks source/spec/acceptance and any task findings. Actual Documentation and VP coordination reviews reconcile all 106 preserved roles and team responsibilities.
- [ ] Record QUIZ-02 app evidence after original admin date; run `pnpm feature-admin:check --feature QUIZ-02 --require app-ready`. Update STATE §4/header, CHANGELOG, index, legal/growth/engineering status and per-user growth recommendations with precise local/hosted distinction. Preserve prior readiness dates unchanged.
- [ ] Keep isolated branch/workspace while merge/push remain unapproved. Final report explains installed local behavior, tests and device/hosted gaps; retained ledger contains every controller ruling with cost if wrong.

## Controller self-review

Spec §§1–4 and §7 map to Tasks 1–3; joint operations §5 to admin gate/Task 4; acceptance §6 to actor/SDK/hook/admin/full gates. The exact RPC names, topic values and input identity are shared across all tasks. Invites default off, manual Start and End remain separate. No generation vendor or new money behavior. Current work starts from clean tracked `34b5403`; old Fan plan tasks stay completed.
