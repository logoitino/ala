<!-- Actual local automatic-source implementation and service evidence; runtime/data migration readiness stays separate. -->
# REDUNDANCY-04 — automatically current exit source

**Request/date:** owner2026-10-19: continue building and keep the exit version updated with the current app.
**Executor:** Codex `/root`, acting REDUNDANCY_LEAD/EXIT_SYNC with Data/Infrastructure integration.
**Status:** implemented locally; activation and final verification receipts below govern actual claims.

## Baseline, decision and bounded experiment

REDUNDANCY-03 captures exact source and enforces map drift, but had no installed current-source watcher,
restart catch-up, current pointer or generated-cache retention. Adopt one exact-source copy of the
same app and self-hosted Supabase interfaces. Avoid maintaining another app implementation.

Use initial capture plus30s content sweeps and stable before/after hashes, private external releases,
OS advisory locking, atomic pointer/attempt records and an explicit catalog deletion journal.
Raw local copies preserve uncommitted current source; explicit code verification runs `pnpm check`.
Keep3 generated copies by default. CI covers all branch pushes/PRs/manual and daily default branch;
original event/ref/commit/run/attempt and source hashes accompany a mode-preserving source-only tar.
CI artifacts expire after30days. This source cache is not independent durable database backup.

Success: fixture edits including unchanged-size/restored-mtime edits advance exact copies, restarts catch
missed changes, failures do not promote partial source, code failure never promotes verification,
concurrent processes cannot own the lock, and interrupted pruning resumes without deleting unrelated files.
Stop capture on private/ambiguous source formats, links, wrong ownership or unstable content.
Generated maps with semantic mapping problems can travel as a raw draft with failed mapValidation;
explicit full checks must fix the mapping. No automated acknowledgement, review, Git-index change,
commit, live SQL, Storage access, credentials export or cloud execution occurs.

## Actual assignments

All executions are Codex sessions in the shared checkout; repository role model pins are unchanged.

| Runtime | Responsibility and owned files |
| --- | --- |
| `/root` | `sync.mjs`, `sync_lock.py`, sync tests, shared capsule hash and atomic map writer, package commands, governance registries/generated maps and STATE/CHANGELOG/index/tracker |
| `/root/cloud_deployment` | All-branch source workflow and executable provenance/tar regression tests |
| `/root/recovery_review` | Independent read-only review of concurrency, crash pruning, integrity, privacy, map semantics, status and CI |
| `/root/redundancy_documentation` | Exit README, current-source runbook and team charter reconciliation |

## Findings fixed and local checks

- Independent review reproduced competing PID-lock reclaimers; replaced PID reclamation with an owned
  private OS flock held by a Python child until the parent pipe closes. Kernel crash release needs no stale PID rewrite.
- Interrupted deletion previously left missing retained entries. Catalog now records pendingDeletes before
  removal and resumes exact journaled entries after restart; changed keep policy also applies on reuse.
- Malformed/latest-attempt metadata fails closed; status rechecks exact pointer, package integrity and source bytes.
- Automatic map writer refuses final/ancestor links, atomically replaces changed content, preserves existing mode
  and leaves unchanged output mtime alone. Automated source maintenance does not acknowledge author notices.
- GitHub artifact ZIP normalizes permissions. CI wraps only private state and run provenance in tar+SHA256;
  tests verify executable/private modes and refuse links/unrelated runner data or existing output replacement.
- Pending-promotion transactions now recover crashes before/after latest publication; current pointer is always retained independently of catalog order. Regression injects actual latest rename failure then source reversion under keep1.
- Focused sync and workflow9 tests passed locally; final integrated counts/checks below.

## Service activation and final handoff

Actual current-login process started2026-10-20T05:29:15.995Z (October19Denver), initial PID29080,
`runtime: detached-process`,30s sweeps, `loginAutoStart:false`. Node process identity was observed.
`pnpm exit:sync start`/`stop` manage only exact bound source/state/target commands; scopes tested.
Normal `install` failed EPERM writing the user LaunchAgents plist in default and elevated tool calls.
A valid private session-only plist passed `plutil -lint`, but `launchctl bootstrap gui/501` failed5
Input/output error in default/elevated calls; no LaunchAgent loaded. These were OS errors, not an
automatic approval rejection. Login/reboot startup remains blocked; use start again after it stops
until authorized OS access permits normal install. No root/system service is attempted.

Successful `pnpm check` ends with exact-source ensure; the Claude Stop guard also invokes ensure.
Only an existing valid source-capture lock defers with `sourceCurrent:null`; other capture errors
fail the project check or produce first-stop correction. No hook auto-acknowledges source notices.
Prepared persistent command after OS access is resolved: `pnpm exit:sync install`.
Default private state: `~/Library/Application Support/Tapuai/exit-source`.
Source-only status: `pnpm exit:sync:status`; exit0 current,2 stale/failed,1 invalid CLI.
The prepared user LaunchAgent would start at login/restart after successful installation; no source process can sweep while this machine is asleep/off.
Installation and snapshot/source checks do not prove deployed service readiness or data freshness.

Database backup schedule/offsite custody, runtime images, deployed stable-origin clients, hosted Auth/MFA/
Storage/Realtime/finance acceptance, protected final freeze/restore and a timed2–3hour rehearsal remain pending.
Next owners: EXIT_DATABASE/EXIT_SERVICES/EXIT_CLOUD with independent QA/Data/Auth/Finance and owner activation.

## Independent review and final verification receipts

Codex `/root/recovery_review` reproduced and closed concurrency/pruning/promotion/status findings;
original latest-rename failure + source-revert keep1 now retains the current intact copy. Final
process manager explicitly binds root/state/target/arguments and cleans up newly spawned children
on errors; updated fixture captures the fixture rather than the tool checkout. Source-only review
accepts privacy/Git/owner/readiness boundaries. Documentation executor reconciled the three entry
points and ran local274-document link checks. Workflow executor passed9 transport/provenance tests.
Final full project check and current-source status are recorded after execution below. No hosted
service, browser/device, live database or remote GitHub run is inferred.

First integrated verification executed all project tests successfully, including51Node exit tests
and40Python exit tests, but final map gate rejected the final Documentation README update that
landed after acknowledgement. Shared code was not reverted. The reviewed README version is
now announced and the frozen-source integrated verification is rerun; failed attempt retained
in the private verification directory. No source verification was promoted on that failed run.

### Final local project verification — 2026-10-20

Fresh direct `pnpm check` PASS:205mobile suites/1,805tests;51Node exit tests (22updater,
14inventory/map,6release,9workflow) plus40Python exit tests,52backup/82migration/14deployment
checks and all project guards. Both retention operations were repeated independently and passed
in2.75seconds total. Independent reviewer also verified postspawn failure cleanup and exact
foreign-process/root ownership rejection. All scoped assignments/reviews and documentation are complete.

An earlier wrapped `sync --verify-code` run passed every project guard but hit its10minute
verification timeout after two file cleanup tests took about17minutes each. It did not promote
code verification. That failed log remains alongside the passing direct project-check log;
raw snapshots retain `codeVerification:not-run` unless a full wrapped verification actually passes.
No timeout pass, host health, data freshness or service acceptance is inferred from the source copy.

Verification logs and final source/process/hash receipt:
`/Users/seiuliian/Downloads/ala-sports-exit-verification-20261019/` (private, outside source).
Current source pointer:
`/Users/seiuliian/Library/Application Support/Tapuai/exit-source/latest.json`.
Restart command after this machine's process/login ends: `pnpm exit:sync start`.
Status command: `pnpm exit:sync:status`. Login autostart remains OS-blocked.

**Lead decision:** adopt automatic exact-source maintenance and finite reviewed CI artifacts.
Local source implementation/handoff complete; permanent login startup and live data/runtime/
cloud/timed rehearsal are the explicit next-owner gaps, not a2–3hour migration promise.

### Sleep diagnosis and bounded verification correction

Observed macOS power log: verified command started07:50Denver; IdleSleep07:51:01 lasted693seconds,
waking08:02:34. This explains the expired600s wrapper with successful test output; the slower
cleanup observations were suspended-computer wall time, not evidence of a deterministic pruning bug.
A separate awake direct check passed in115seconds. Mac verified checks now use
`/usr/bin/caffeinate -i pnpm check` inside the same600s timeout. The scoped assertion ends with the
utility; normal raw source sweeps permit sleep and cannot run while the machine is asleep.
A meaningful local regression observed the check utility's own PreventUserIdleSystemSleep assertion
and its release afterward (PASS0.54s). Forced sleep/power loss still stops verified promotion.
Final protected capture outcome is recorded in the private release manifest/verification receipt.
