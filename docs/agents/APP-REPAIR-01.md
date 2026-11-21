<!-- Outside-session repair evidence; current-source checks do not establish device or hosted acceptance. -->
# APP-REPAIR-01 — native readiness and offline action preservation

**Status:** local repair verified; device/hosted/registered owner acceptance pending. Overall feature-improvement work continues through APP-TEST.
**User scope:** improvements to existing app features; Expo Go and installed phone builds. Website hosting deferred.
**Responsibility route:** CTO → ENGINEERING → FULLSTACK, paired with SUPPORT and QA. Registry roles/model pins are unchanged; no registry agent execution or acceptance is claimed.
**Actual implementation:** Codex outside root session. Independent outside Codex reviewer: `/root/offline_queue_review`; registered owner/release acceptance remains separate.

## Status and shared claims

| Session | Responsibility and files | Started | Status |
| --- | --- | --- | --- |
| Codex root | `OfflineQueue.ts` and tests; `AuthContext.tsx`, queue callers including QA and tests, existing domain helpers; native NetInfo Jest fixture; Stripe adapter guidance; root integration owns this record, STATE, CHANGELOG, docs indexes, ROADMAP, privacy/architecture/infrastructure, TEAMS SDK-doc correction and generated currency/exit notice | 2026-11-20T11:32:57.549379-07:00 | released after integration/verification 2026-11-20 |
| Codex offline_queue_review | Read-only queue/caller/regression review | 2026-11-20T11:32:57.549379-07:00 | completed; no edits; released 2026-11-20 |
| Codex actor_transport | New `src/frontend/lib/offlineActor.ts` and colocated transport regression test; `offlineActions.test.ts` integration tests only | 2026-11-20 | completed; released after integration 2026-11-20 |

## Observed problem and baseline

During reconnect replay, `flush()` snapshotted pending actions and later replaced the live queue with leftovers from that snapshot. Five deferred-request regressions reproduced lost new actions, overwritten replacements, resurrected discarded actions and dispatch of an undone pending hype. Live-queue reconciliation now removes only completed/refused IDs, skips removed pending IDs and retains the current queue on retryable failure. Finite initial-batch behavior is preserved.

Baseline `b7479ce`: both typechecks passed; all 281 mobile suites / 2638 tests passed. Full app/source checks ran and passed until the final default source-cache binding rejected the removed `Downloads/ala-sports` checkout. A separate private cache bound to `Documents/ala` synchronized successfully without changing old snapshots. Public preview config was recovered from the linked EAS project; server secrets were excluded. Official SDK 58 reference fetched/read locally. Android and iOS baseline source exports passed; repair-source exports and device checks were pending.

## Repair acceptance

- Reproduce a newly enqueued action disappearing while an earlier dispatch awaits completion.
- Preserve new or replacement actions through success and network-failure replay; cancelled/cleared actions stay removed.
- Drain only the completed actions still relevant to the current queue; retain retryable actions in order.
- Preserve existing remote helpers, queue payloads, account/permission rules, fees and source/runtime flags. No new capability/admin enrollment or data/schema change is intended.
- Run focused regressions and full existing gates with the explicitly bound private cache; preserve fresh native export and independent review evidence.
- Same-turn state/history/index and generated source currency; report hosted/device/registry owner checks accurately.

## Decision record

Alternatives: replace queue from a replay snapshot, or reconcile completed IDs against the live queue. Prefer live-queue reconciliation so concurrent additions/removals remain authoritative. This is a bounded ordinary repair, not a new product feature. Jev not reached: repository key file absent and this session internet disabled; no score is claimed. Root will validate the smallest change against failing behavior before implementation.

## Verification and handoff

- Actual Codex root reproduction: focused Jest, 1 suite / 5 tests failed for the expected lost/resurrected/dispatched actions before implementation.
- Actual Codex root verification: expanded focused Jest, 1 suite / 11 tests passed; mobile `tsc --noEmit` passed. New tests also verify replacement before dispatch, terminal refusals, discard followed by a new action, persisted state and simultaneous-flush exclusion.
- Independent outside Codex `/root/offline_queue_review` inspected the current diff/callers and independently ran the 11-test suite successfully; no blocking scoped reconciliation findings. This is not registry-owner, device or hosted acceptance.
- Native Stripe/stub fallback copy now directs testers to a development client or preview build. Checkout methods, fees and capability flags are unchanged.
- Final full gate and source-bound native exports remain pending. Owner retains publish/merge/hosted SQL/function/store authority. Claims remain active until integration and actual results are recorded.

## Initial separate findings (repaired by the follow-up below)

1. **Already-issued hype undo:** `ReelCard.tsx` treats `dropPendingHype()` returning true as completed undo even if that request is already in flight. Removing the queued row cannot cancel the issued request. Next responsibility: ENGINEERING → FULLSTACK with HIGHLIGHTS/SUPPORT/QA; requires a separate deferred-request compensation test and repair.
2. **Originating-account attribution:** the singleton persisted queue has no origin actor on cheer, hype-clear or report actions; their RPCs use the current Supabase session. AUTH does not clear/filter the queue on an owner transition. An A-enqueued action can therefore replay as B. No cross-account RLS bypass is claimed. Next responsibility: AUTH/SESSION_SECURITY with FULLSTACK/Data and independent review; lifecycle, restart/hydration and in-flight transitions need explicit tests.

The first reconnect-only checkpoint did not resolve these findings; the integrated follow-up below repairs them locally. The overall feature/device improvement audit remains incomplete.

## Follow-up acceptance and handoffs

ENGINEERING → FULLSTACK remains the accountable responsibility for the related queue repairs, paired with AUTH/SESSION_SECURITY for actor lifetimes and DATA_GOVERNANCE/PRIVACY_ENGINEERING for the existing unencrypted local queue. Outside Codex `actor_transport` prepares the transport and tests; root integrates account-bound queue/callers and documentation; `offline_queue_review` independently reviews security-sensitive integration. DOCUMENTATION handoff is root integration with exact source/check evidence below. No registry-model execution or owner approval is inferred.

- Preserve structured network error messages so SDK-shaped failures remain retryable.
- Persist an actor-owned compensating clear before waiting for an already-issued queued hype; the queue owns that undo across account switches/restarts.
- Capture the originating signed-in actor before asynchronous work; queue metadata must distinguish actor from Aura award target. Hold inactive-owner and legacy unattributed rows, and preserve guest local behavior.
- Resolve Auth before automatic replay; account transitions invalidate captured actor lifetimes while same-user token refresh remains usable.
- Use an ephemeral client with a captured matching session token, checking actor lifetime before transport; never persist tokens or allow a delayed request/fallback to borrow another account's JWT.
- Regress account switching, restart/hydration, delayed work, owner-scoped replacement/undo, guest/legacy rows and actual transport headers. Existing RLS remains authoritative; no hosted permission/schema changes.

Decision: pausing/filtering alone leaves an asynchronous SDK token-read race. A captured-token client plus account-lifetime check closes that client-side attribution gap with existing public configuration and no new provider. Jev not reached in the earlier offline session; no score or counsel/privacy approval is claimed.

### Integrated follow-up source and evidence (2026-11-20)

Root's three structured-error/issued-undo regressions failed before the first follow-up, then passed. Independent review required durable undo across account switch, coalesced incoming-owner replay, and a post-hydration flush lock; each was reproduced before repair. Final queue contract retains ordinary finite batches and terminal-refusal behavior; only explicit issued undo and genuine owner transitions request a follow-up batch. Auth installs/suspends actor ownership at its event boundary. `offlineActions` calls existing helpers with an ephemeral matching-token client. No stored token or new backend table/RPC/permission/provider is introduced.

The current queue uses `actorUserId` distinct from an Aura award target, scopes replacement/undo/replay to the active actor and rejects stale enqueue handles. Legacy rows lacking ownership are retained without adopting the next login. QA shows current-account rows and count-only held diagnostics; old-account frames and responses are masked/rejected. Existing explicit device-wide discard remains available for held-only data and clears all pending rows. Unencrypted local retention has no new timed expiry or automatic erasure integration.

Bookmark reads/toggle corrections are view-generation guarded; local mutation revisions reject reads overtaken by a tap. Cheer choice now uses `tapuai.cheerVote.{auth-user-id}.{slug}` and skips unattributed legacy keys. Authorized Soft-Wall resume captures its resolved actor before awaits; guest hype/bookmarks stay local. Six hook regressions reproduced stale publication/local ownership behavior before their fixes; expanded hook suite passes.

Actual independent outside Codex core review: 4 suites / 56 tests passed, including the actual SDK/HTTP-boundary tests. Transport worker: 13 helper + 15 dispatch integration tests passed; isolated source comparison with only the Aura refusal guard removed reproduced that swallowed-refusal failure. This comparison did not revert the working checkout. Issued requests may finish as their original actor. Aura's two RPCs remain non-atomic; unknown network/partial-commit outcomes and historical ordinary award fallback remain, so no exactly-once award/hosted permission claim is made.

Local data/function review preparation: DATA_GOVERNANCE/PRIVACY_ENGINEERING and INFRASTRUCTURE responsibilities remain unchanged; root reconciles the local privacy inventory and infrastructure decision/architecture notes. The generated SQL data map does not inventory AsyncStorage, and passing it does not prove account attribution. No counsel/registry owner acceptance is claimed. Final full gate, repair-source native exports, final caller review and device journeys are recorded when actually executed.

Full-gate iterations: first integration run failed at the missing native NetInfo Jest bridge fixture; the package's own fixture repaired that test environment without relaxing assertions. The next run passed 286 suites/2705 tests but found an unused test import. Root used it in an additional previous-reel refusal regression (8 hook tests pass). The following run passed 286 suites/2706 tests and later stopped at stale generated infrastructure Security output. Source maps and Security report are regenerated through their supported commands; written output still does not establish registered/operational Security acceptance.

Payment capability correction: the earlier claim that Expo Go lacks Stripe was not established by the cached SDK index. The native adapter's SDK availability depends on its host; this pass preserves the runtime exports/flags and recommends development/preview testing. Expo Go payment behavior remains unverified. A public official-doc GET sent no app data/credentials and failed because session internet is disabled; no bypass was attempted.

### Final local receipt and next work

- **Full quality gate PASS**, 2026-11-20: `bash ../ala-check.sh`, forwarding the existing supported checkout-specific `--state-dir`. Both app typechecks passed; **286 mobile suites / 2706 tests** and **121 portal tests** passed, plus all root IP/media/Metro/docs/copy/data-boundary/comment/feature-admin/ownership/unused/recovery/redundancy/detection/agent/security/infrastructure/layer/exit/portability gates. Plain default `pnpm check` still uses the old removed-checkout source-cache binding; that old cache was preserved.
- Fresh repair-source **Android and iOS Hermes exports PASS** using `expo export --platform android|ios --max-workers 1`, run separately. These are bundles, not installed builds, store submissions or physical-device proof.
- Independent outside Codex final core/caller review passed **7 suites / 94 tests**, all blocking findings corrected. Root additionally covered previous-reel bookmark refusal; the full gate includes 68 added tests versus the baseline. Desktop's authorized guest-resume local-cache owner was corrected to the captured actor after its nonblocking review note.
- Generated source/security notices are current and explicitly retain unaccepted registered/operational reviews. `exit:sync ensure` passed with `sourceCurrent: true`, `codeVerification: not-run`, `readyToCutOver: false`. No cutover readiness is claimed.
- Logs, two bundle hashes and the 28-feature source inventory are in `/Users/seiuliian/Documents/ala-audit-2026-11-20-jf2qqv3f`. Inventory statuses (24 app-ready, 2 admin-ready, 2 planned) are source declarations, not hosted or device acceptance. Metro `/status` confirmed running locally on port8081.
- **Next responsibility:** SUPPORT/QA/DEVICE_QA with HIGHLIGHTS/AUTH/FULLSTACK run physical reconnect/issued undo; A→B→A and token refresh; restart/legacy held queue; guest Soft-Wall resume; bookmark/cheer navigation and account switch; QA held-only explicit reset. CHECKOUT verifies native payments in development/preview and actual Expo Go behavior. Registered DATA_GOVERNANCE/PRIVACY_ENGINEERING/INFRASTRUCTURE/Security owners retain review of local metadata/token-bound routing. No SQL, cloud build, OTA, push, merge, hosted grant or live money was executed.

DOCUMENTATION handoff completed locally: source/behavior contracts, privacy inventory, infrastructure decision, current SDK reminder, STATE/history/roadmap/index and generated currency reconciled. No roles/model pins/priorities changed, so no roster reassignment was made. Claims released; phone/provider and registry-owner work stays explicit.
