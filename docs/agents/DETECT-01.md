<!-- Owner-requested engineering support setup; local evidence is recorded after execution. -->
# DETECT-01 — Engineering Support and detection

Owner request, 2026-10-13: reuse existing roles to detect issues across the app, both admin
surfaces, backend, finance, data and development tooling, and help Dev build fixes.

## Design and execution plan

Reuse `SUPPORT` as Engineering Support lead under `ENGINEERING`. Its specialists are
`INCIDENT_TRIAGE`, `TELEMETRY`, `RELIABILITY`; the last two move from Operations. Keep
independent QA and financial/security/data policy owners in their existing reporting lines.
Roles remain callable instructions; this change does not start continuously running agents.

1. Claim the role definitions, registry and shared team docs for this local change.
2. Inventory actual detection paths and record missing coverage with responsible owners.
3. Build a local scan wrapping existing quality gates plus the separate Next portal tests.
   Save bounded, redacted check results; retain previous runs; show failures and skipped checks.
4. Test failure capture, partial scans, timeouts, redaction, coverage validation and history.
5. Synchronize reporting lines, detection/fix handoffs and future feature requirements.
6. Run the scan and required `pnpm check`; record exact results and remaining gaps.

No app, financial, database or deployed service behavior changes are part of this setup.
The catalog verifies declared local evidence paths; it cannot prove comprehensive runtime coverage.

## Shared-file claim

| Session / responsibility | Files | Status |
| --- | --- | --- |
| Owner-run Codex, DETECT-01 | support, incident-triage, telemetry, reliability, engineering and operations definitions; registry; TEAMS, TEAM_HIERARCHY, EXPERT_STANDARDS, DEPARTMENT_PLANS, WORK_QUEUE; AGENTS; feature admin workflow/template; package.json; CI; docs index, STATE, CHANGELOG; new detection files | Released after local setup verification. Read current contents before each edit and preserve other sessions' changes. App, SQL, Finance and PLAY-01 files are outside this claim. PORTAL definition: remove the verified stale ColumnChart ownership reference. |

## Verification

Local setup verified after review corrections. See [ENGINEERING_SUPPORT.md](../engineering/ENGINEERING_SUPPORT.md) for the
operating contract and [detection-sensors.json](../engineering/detection-sensors.json) for coverage.

## Assigned follow-up

The six DETECT-01-G1 through G6 tasks and required pairs are in
[WORK_QUEUE.md](WORK_QUEUE.md#detect-01--engineering-support-under-dev-owner-request-2026-10-13).
Crash/server capture, telemetry self-health, settlement alerts, reusable UI checks and
linked user-report intake remain explicitly open. No runtime monitoring was deployed.

Initial roster scan caught PORTAL ownership of the absent `ColumnChart.tsx`; the existing
`components/charts` ownership covers the current kit. Removed only the stale registry/definition
reference. No source was deleted or restored.

The first full scan captured stale removed-helper imports during concurrent code cleanup.
Those tests were updated by that active session while inspected, not restored by DETECT-01.
The next scan passed mobile typechecking and 100 suites / 681 tests, plus 86 Next tests, then
flagged eight stale data-map triage entries during that same cleanup. Those findings remain
in the retained scan; final verification follows once current metadata is consistent.

Read-only Codex review found a timeout escalation bug, quoted-JSON credential redaction gap
and two stale hierarchy representations. Synthetic regression tests reproduced both scanner
failures before fixes. Process-group escalation now completes after parent exit; quoted
credential fields are redacted; Mermaid/table grouping and historic ENV-01 routing are aligned.

## Final local verification (2026-10-13)

- Read-only review: all three Important findings resolved; 10/10 scanner tests passed,
  including quoted JSON secrets and a descendant ignoring SIGTERM. No remaining Important
  tooling issue. Historical ENV-01 wording also corrected.
- `detection:check`: 14 sensors across eight areas; 12 partial/gap declarations.
- `agents:check`: 105 roles, ownership paths and reporting graph pass.
- Earlier complete scan passed `pnpm check` (100 app suites / 681 tests, 13 feature-workflow
  tests and eight pre-review scanner tests) and 86 Next tests. Previous failed runs remain.
- Latest full scan after review fixes: app/portal typechecking, 100 app suites / 681 tests,
  docs/copy/comments/boundaries and 13 feature-workflow tests passed; 86 Next tests passed.
  Root gate then failed at the data map because the concurrent new `adminControls.ts`
  exports have no consumers yet (11 findings). The root subchecks after this failure did
  not run in that scan; independent post-review scanner/roster checks passed.
- These current data-map findings link DATA-01-F1/F3/F4 and their ADMIN/DATA_GOVERNANCE
  integration; DETECT-01 does not delete or register exceptions for unfinished code.
- Six runtime gaps remain assigned, not implemented. No hosted monitoring, schema or
  release was changed. CI configuration is local and has not been executed remotely.

Private evidence: `.smoke/detection/latest.json` and timestamped prior runs. The latest
scan is explicitly failed; local detector/team completion does not certify the moving
workspace as release-ready.
