<!-- Local runtime integration evidence, recorded after the preserved admin-ready checkpoint. -->
# DETECT-02 app integration evidence

Admin readiness was recorded at 2026-10-13T19:25:14Z and its required gate passed before fan wiring.
App readiness was recorded at 2026-10-13T19:36:59Z; both timestamps remain in `feature-admin.json`.
No hosted SQL, activation, release switching or live money was authorized or performed.

## Implemented after that checkpoint

- Opt-in, signed-in runtime observer with account/token cleanup and fixed route scopes. Web defaults
  and prior native fatal handlers remain intact. The token stays outside captured payloads.
- Feature boundaries in shared screen shells and admin children contain render failures without
  adding layout wrappers while healthy. Admin headings and navigation remain outside the boundary.
  General render recovery requires one explicit user retry; protected features cannot auto-remount.
- Successful bug reports add a fixed user-report observation while Feedback retains the report body.
- Donation checkout distinguishes cancellation, payment failure and post-payment recording failure.
  Instrumentation adds no monetary calls, automatic retries or altered accounting rules.
- Highlights disables SDK retries and stops network/authorization errors from cascading through
  legacy column fallbacks. Safe transient reads can retry once only after accepted failure evidence
  and within unchanged capture context. Ordinary SDK status-zero/empty-code offline failures recover;
  SDK-flattened AbortError, auth codes and 401/403 remain excluded. Money/writes never auto-retry.

## Executed verification

- Focused integration: four suites /42 tests passed before the final offline fix.
- Independent final integration review: five suites /55 tests passed and found one status-zero gap.
  Fixed and reviewed again: two suites /38 tests pass; no remaining Important finding in those changes.
- Domain-owned total: 86 tests (42 model, 33 manager, 11 boundary). Mobile typecheck passes.
- Current backend migration hash matches the executed 144/144 local Postgres replay and its exact
  canonical SQL section. Separate Next library suite passes 86/86. No hosted database was touched.
- Actual earlier source capsule (988 files, 26,409,316 bytes, verification not-run) verified and
  restored into a new private preview. Its code/schema version is retained honestly; no active code
  or database restoration occurred. Browser acceptance is recorded below; each fresh package retains
  its own verification metadata outside source in the private recovery directory.

## Remaining activation and coverage work

Approved hosted migration and explicit public sensor config are required before capture activates.
Client reports are untrusted; suspicious activity alone cannot confirm an attack. In-memory fatal
capture can be lost on process termination, and durable crash intake remains a gap. Team diagrams
show registered static ownership/references rather than proven hosted traffic. Audits cover selected
16 source tables and are unsigned; privileged DB operators can change/recompute them. Capsules do
not contain database backups or certify compatibility. See [Recovery runbook](../RECOVERY_RUNBOOK.md).

## App checkpoint

The complete local `pnpm check` passed: 115 app suites /827 tests, both TypeScript projects,
13 admin-first workflow tests, 10 recovery tests, 10 detection tests, docs/links/copy/boundaries,
unused-code/data ownership, 106-role consistency and client-key checks. Separate Next library
command `node --import ./lib/analytics-resolver.mjs --test lib/*.test.ts` passed 86/86.
Paired Chrome loaded the actual integrated root/source in the synthetic harness; the disabled
runtime status is explicit, Open excludes expected expiry, and Expected retains that record.
Post-wiring Chrome checks pass 6/6: runtime disabled state and expected-event filtering, actual
generated package metadata registration with actor/time, Recovery at 1440 and 320 with no overflow,
enlarged text at 320, and keyboard focus advancing from the metadata field to its action. The long
CLI typing attempt timed out; partial field state was inspected and replaced through a normal input
event. No duplicate registration occurred. Viewport and inline font overrides were reset. Results:
`.smoke/support/browser-runtime-results.json`; screenshot `.smoke/support/recovery-metadata.png`.

## Final source capture

The final capture, integrity verification and isolated restore completed locally at
2026-10-13T19:41:43.502100Z. `pnpm recovery:package --verify-code` reran the full code gate and
recorded `verification: passed`; `pnpm recovery:verify PACKAGE` recorded `integrity: passed`;
`pnpm recovery:restore PACKAGE` created a new private preview. Retained command output:
`.smoke/support/final-package.log`, `final-verify.log` and `final-restore.log`; combined result:
`.smoke/support/final-recovery.json`.

| Captured source | Result |
| --- | --- |
| Release ID / created at | `code-2026-10-13t19-41-40-423z-f40b2d95` / `2026-10-13T19:41:40.423Z` |
| Files / source bytes | 997 /26,480,216 |
| Recorded Git base | `4b7a729cafe67b2f7d316b3ebb3663ecbfb7c6e1` (dirty source is identified by the manifest/tree hash) |
| Tree hash | `b40dd32e980ac1c28da88ba655c351c00b3279efbea8075d9bb901cff24ff6c9` |
| Restore | Separate `.smoke/recovery/restores/code-2026-10-13t19-41-40-423z-f40b2d95` preview; `activeCodeChanged: false`, `databaseRestored: false` |
| Signer / deployment compatibility | `unsigned` / `not verified` |

This capsule predates STANDARD-01's innovation/handoff documentation and this COORD-01
reconciliation. It verifies the recorded captured source, not subsequent edits or the current
working tree. STANDARD-01's later local full-gate/review evidence is in
[its verification record](../INNOVATION_AND_HANDOFF.md#implementation-and-verification-record).
The earlier 988-file capture/restore remains historical evidence of a different source version.
No hosted deployment/SQL, database-backup restoration, native-device behavior, counsel review
or outside-company walkthrough was certified by these local results. Actual documentation
executor, owned changes, supplied evidence and next owners are in
[DETECT-02](../../agents/DETECT-02.md#documentation-reconciliation-coord-01-2026-10-13).
