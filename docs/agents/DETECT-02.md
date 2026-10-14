<!-- Execution ledger for the owner-requested main-admin engineering support capability. -->
# DETECT-02 — Support, cybersecurity and recovery in main admin

Plan: [ENGINEERING_SUPPORT_CONSOLE.md](../engineering/design/ENGINEERING_SUPPORT_CONSOLE.md).
Started 2026-10-13. Owner authorized building the tool and team cooperation; hosted deployment,
SQL application, financial mutations and replacement of a running release remain gated.

## Shared-file claims / progress

| Responsibility | Claimed paths | Status |
| --- | --- | --- |
| Domain/runtime Codex worker | new shared support modules; new SupportSignalManager/FeatureBoundary and tests; TelemetryManager bounded delivery if needed | Complete: 86 tests; root wired after admin-ready |
| Backend Codex worker | new support migration; schema.sql appended support section; server support capture/session integration and tests; local support SQL replay | Complete: 144 SQL replay / 14 auth tests; no hosted SQL |
| Root recovery implementation | new recovery capsule scripts/tests, manifest contract | Complete: 10 recovery tests and real source package; local previews only |
| Root integration | new main-admin Support components, adapter/hook/route; generated team-flow metadata; admin navigation; role/registry/team/docs/feature/data ownership synchronization, STATE/CHANGELOG/CI/package integration | Complete locally: app-ready/full gate, independent review and browser acceptance; no hosted activation |

No commits, deployments or live-money actions. Workers are outside-session Codex execution;
repository Cursor model pins remain unchanged. Check this ledger before reassigning work.

## Verification and handoffs

Admin checkpoint evidence is in [DETECT-02-admin](../engineering/evidence/DETECT-02-admin.md). All core fixes from independent review applied; admin-ready and browser acceptance passed before fan integration. Runtime acceptance is in [DETECT-02-app](../engineering/evidence/DETECT-02-app.md).

Admin-ready was recorded at 2026-10-13T19:25:14Z after local access/SQL/recovery/review and
browser acceptance. Its required gate passed before fan wiring; app-ready was recorded at
2026-10-13T19:36:59Z. Both checkpoints remain in `feature-admin.json`.

## App integration after admin-ready

Root mounted opt-in auth-scoped runtime observation, ScreenShell/TabScreen and admin child
boundaries; connected successful bug reports and separate donation cancellation/payment/record
failure codes without changing monetary calls. Highlights reads disable underlying SDK retries,
stop network/auth legacy fallback cascades and retry only one accepted/reportable transient read.
Service recovery also requires unchanged capture generation and accepted failure evidence; 33
service tests and 86 owned core tests pass. Focused integration 4 suites/42 tests passes; mobile
TypeScript, unused-local and generated data-map checks pass. Final offline/cancellation review
passes 38/38 tests; the completed full gate and package verification are recorded below.

Local close-out: full gate passes 115 suites /827 tests and separate Next 86/86. The app-ready gate
passes after the preserved admin-ready checkpoint. The earlier 988-file package verified and
restored into a private preview. Browser metadata/phone/enlarged text/keyboard checks pass 6/6.
Final source capture and isolated restore completed at 2026-10-13T19:41:43.502100Z: 997 files,
26,480,216 bytes, code verification and integrity passed. Exact release/version/results are in
the [app evidence](../engineering/evidence/DETECT-02-app.md#final-source-capture) and retained
`.smoke/support/final-recovery.json`. The capsule is unsigned, hosted compatibility is unverified,
and its source predates STANDARD-01 and COORD-01 documentation edits. It does not certify the
current source tree or restore a database.

## Documentation reconciliation (COORD-01, 2026-10-13)

Actual executor: outside-session Codex `documentation_sync`, assigned in
[COORD-01](COORD-01.md); no pinned Cursor specialist model was dispatched for this pass.
Owned changes: `.claude/agents/documentation.md`, this ledger, and both DETECT-02 evidence files.
Supplied/read evidence: preserved feature checkpoints, `.smoke/support/final-check.log`,
`final-next-tests.log`, `backend-postgres.json`, final package/verify/restore logs and
`final-recovery.json`, plus STANDARD-01's local verification record. Stale pending completion
language is reconciled with those results; earlier checkpoints and their limits remain intact.
Documentation checks and claim close-out belong in COORD-01 after integration. Next owner:
root/session lead for shared status and final gates; BACKEND/OPERATIONS + QA for approved hosted
activation and compatibility, RECOVERY for an approved database-backup rehearsal, DEVICE_QA for
native behavior, and owner/counsel for policy/release decisions. Durable crash intake remains open.
