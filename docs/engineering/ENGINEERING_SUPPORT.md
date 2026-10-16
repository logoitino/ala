<!-- Engineering Support owns detection and repair coordination; domain owners own their changes. -->
# Engineering Support — sensors, incidents and fixes

## Team and reporting

The owner asked to reuse existing roles (2026-10-13). `SUPPORT` is now **Engineering Support**,
reporting to `ENGINEERING`, which reports to `CTO`. Three existing specialists report to SUPPORT:

| Role | Responsibility |
| --- | --- |
| `SUPPORT` | Accountable for cross-system detection coverage, the incident queue, repair coordination and help/runbooks. Reports failures, gaps, fixes and remaining evidence to Dev. |
| `INCIDENT_TRIAGE` | Joins automated signals and user reports, classifies severity, groups duplicates, reproduces symptoms and assigns one owning developer through Dev. |
| `TELEMETRY` | Builds safe runtime sensors, event delivery checks, bounded logs, correlation and source freshness. Makes broken sensors visible. |
| `RELIABILITY` | Builds the scan, failure/recovery tests and operational runbooks; pairs with developers on root cause, fixes and recurrence checks. |

These are repository agent instructions. They run when dispatched; creating the team does not
start a daemon, staff a human help desk or create hosted monitoring. Call `SUPPORT` with a surface,
symptom/task and desired evidence. It routes one primary specialist and the relevant code owner.

## Apply the sensor analogy

| Sensor part | Code equivalent | Existing sources / responsibility |
| --- | --- | --- |
| Detect activity or failure | Runtime events, failed requests, invariant failures, compiler/tests, UI/browser checks, user reports | TELEMETRY, CI, finance checks, QA and feedback |
| Keep a log | Timestamped, bounded, restricted evidence; release/surface/code and safe fingerprint | Restricted support signal/review/audit/release tables; existing telemetry/feedback/ledger records; private scan files |
| Notice a broken sensor | Failed delivery, unavailable source, dropped queue, missing/stale evidence | TELEMETRY + RELIABILITY; quiet or unread never means healthy |
| Route a finding | One incident with linked duplicate reports and a severity | INCIDENT_TRIAGE → SUPPORT → ENGINEERING |
| Repair and prove recovery | Reproduction, owner patch, meaningful regression test, independent QA, recurrence check | SUPPORT specialists pair with the functional developer; QA can reject |

Coverage is [detection-sensors.json](detection-sensors.json). `implemented` means a local mechanism
exists, `partial` means limited coverage and `gap` means the mechanism must be built. Those labels
are source inventory, never current live health. The scan lists **all partial/gap declarations**.
Source observations are dated 2026-10-13; recheck them as work lands.

## Existing telemetry delivery repair (HEALTH-01 / DETECT-01-G3)

`apps/mobile/src/frontend/services/TelemetryManager.ts` keeps its existing event/`track*` API
and `telemetry_logs` destination. Delivery is best effort: buffered rows plus one active request
reservation cannot exceed 120 rows; each INSERT attempts at most 15, with SDK retries disabled.
Flush is triggered every ten seconds, at 15 queued rows, or on background/inactive app state.
An attempt returns to its caller after a ten-second timeout and requests abort. If the transport
ignores abort, the request retains its reservation and prevents new sends until it settles;
later normal flush triggers can then send fresh queued rows. Attempted failed/uncertain rows
are discarded, never replayed: a lost response can follow a successful server INSERT.

Missing configuration, overflow and disposed-instance calls count explicit loss. Only exact
table-absence codes `42P01` / `PGRST205` mean `migration_missing`; table-named permission,
column, relationship and constraint errors remain denied/failed delivery. Transport failures,
HTTP status 0/408/5xx and timeouts leave the commit outcome uncertain. `dispose()` stops this
instance's listeners, discards its queue, aborts a pending request and accounts uncertainty;
late outcomes cannot claim delivery. `getInstance()` retains a disposed singleton and does not
start a replacement writer. Only a fresh process/test reset starts a new instance and counters.

`getHealth(): TelemetryHealthSnapshot` returns a frozen, readonly sample with no queued rows,
event payload, user identity, token or raw error. Interpret its fields as follows:

| Fields | Meaning |
| --- | --- |
| `phase` | Last/current attempt state: `unknown`, `sending`, `delivered`, `not_configured`, `migration_missing`, `permission_denied`, `delivery_failed`, `delivery_uncertain` or `disposed`. A delivered batch is not continuous sensor/fleet health. |
| `queued`, `inFlight`, `capacity`, `batchSize`, `timeoutMs` | Buffered count, active request reservation and fixed bounds (120 /15 /10,000 ms). An unresolved reservation can remain after its rows were counted lost. |
| `accepted`, `delivered`, `dropped`, `uncertain` | Admitted rows, confirmed successful rows, all refused/discarded rows and uncertain outcomes. Uncertainty is a subset of dropped; dropped can exceed accepted because refused rows were never admitted. These are not disjoint totals. |
| `lastFailure`, `lastFailureAt`, `lastDeliveredAt` | Fixed historical reason and local timestamps. Failure reasons include `transport_error`, `timeout`, `queue_full` and `disposed`; a later success retains the previous failure/time. |

The worker's local regression command on 2026-10-13,
`pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand TelemetryManager`, passed
one suite /21 tests after reproducing duplicate INSERTs, oversized batches, missing bounds and
replacement writes after disposal.
Actual executor, integration checks and remaining owners are in [HEALTH-01](../agents/HEALTH-01.md).
This repairs bounded loss/self-observation locally; hosted ingestion/retention, alert routing,
fleet freshness, durable crash intake and native-device verification remain open. A row-count
cap is not a byte cap or payload sanitization. No new event fields/table/permissions or scheduled
runner are introduced. See [DATA_PRIVACY_MAP](DATA_PRIVACY_MAP.md#telemetry-delivery-and-local-health-health-01).

The existing `components/Admin/QaTool.tsx` samples `getHealth()` on mount/focus and refresh,
with a visible local sample time; it also samples after offline replay is checked. Its delivery
panel is device/process-local and Health retains aggregate periods/thresholds. The telemetry
digest and OfflineQueue reads settle independently, each with its own unread/error state. Fixed
global source slots admit at most one actual pending read per source across refresh, focus,
remount and development reload. A ten-second UI timeout releases its caller, not the underlying
transport or reservation; only real settlement releases that source slot. No response/actor data
is cached or reused. Refresh/focus generations reject stale/unmounted results. If an older
development singleton lacks `getHealth`, QA requests a full app reload and invents no counts.

Repair write locks remain held until the operation settles; pending notices explain that its
result is unconfirmed. There is no timeout unlock or automatic replay. A late completion cannot
trigger a follow-up read after leaving that generation. Replay notices report actual remaining
actions, and queue labels distinguish Clear from Aura addition and Unsave from Save. Historical
delivery failure/time remains visible after later success. Root's focused QA command on
2026-10-13, `pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand src/frontend/components/Admin/__tests__/QaTool.test.tsx`,
passed one suite /11 tests; independent re-review accepted these exact changes at
2026-10-14T00:54:59Z. An underlying read/write that never settles can remain unavailable/pending.
Native focus/device behavior and broader OfflineQueue lifecycle remain unverified by these local
checks. These controls do not prove fleet delivery or hosted repair.

## Run and retain local checks

```sh
pnpm detection:check
pnpm detection:test
pnpm detection:scan
# A subset remains explicitly incomplete:
pnpm detection:scan --only portal-tests
```

The scan runs `pnpm check` and the separate Next `lib/*.test.ts` suite, sequentially. A failure in
one does not suppress the other. `pnpm check` itself stops at its first failed subcheck; its
remaining subchecks are unverified in that failed run. Scan completeness means the two outer
commands were attempted, and never turns a failed quality gate into verified coverage. Each command has a ten-minute timeout; errors and timeouts exit
nonzero. It retains a starting checkpoint, each completed check and final JSON per run in `.smoke/detection/`, plus
`latest.json`; if interrupted, the starting checkpoint shows missing checks. Each output is
limited to 64,000 characters with explicit truncation. Existing `.smoke/` ignore rules keep it local.
No raw command output is printed by the scanner. Logs have restrictive file permissions and basic
redaction for credentials, tokens, email, card-like numbers and URL queries. Redaction is defense
in depth: use synthetic data and review logs before sharing; do not feed production request bodies
or customer feedback into this runner. Older runs are retained; RELIABILITY owns local rotation.

A passing full scan verifies the commands actually run. It does not verify browser layout, native
devices, hosted SQL, payment settlement, continuously running sensors or alerts. A partial scan
lists skipped checks even when its command passes. Syntax errors belong to compilation/CI; a runtime
event cannot replace typechecking. CI validates the catalog and its regression tests in this change;
existing CI step logs remain its check evidence. Remote CI execution has not been witnessed here.

## Incident lifecycle and fix ownership

Use [INCIDENT_TEMPLATE.md](../agents/INCIDENT_TEMPLATE.md) for reproducible local records. Reuse
existing feedback and domain incident records; link them rather than copying their data into a new
database. Automated check failures use a stable `check:<id>` fingerprint; one check can contain
multiple defects, so triage splits it when the reproduction/root cause differs.

1. **Detected:** record source, environment, build/commit, first/last seen, safe code/fingerprint,
   count, impact and evidence. Unread/stale/missing evidence is explicit.
2. **Triaged:** deduplicate; assign severity and one domain owner. P0: suspected money corruption,
   account exposure or safety incident; P1: critical journey blocked; P2: degraded function or UI;
   P3: cosmetic/low impact. Use actual impact; a raw event count is not severity.
3. **Reproduced / investigating:** keep minimal synthetic steps; if not reproduced, retain the
   report and name the missing evidence. Do not dismiss the user's report as healthy.
4. **Fixing:** ENGINEERING routes to the functional developer; SUPPORT's specialists help build
   instrumentation, reproduce root cause and implement the repair together. BACKEND owns SQL/RPC/RLS;
   Operations owns deployments/CI infrastructure; Data Governance owns lineage/archives.
5. **Verification pending:** record failed-before/passed-after evidence and the regression check.
   QA/TEST_AUTOMATION/VISUAL_QA/ACCESSIBILITY/DEVICE_QA independently review their relevant boundary.
6. **Monitoring:** recheck the same signal in the affected environment and time window. If it has
   not been deployed, mark **verified locally; hosted recovery pending**. Absence of telemetry alone
   is never closure proof.
7. **Closed / reopened:** close only after recovery evidence, required reviewer acceptance and
   documented residual risk. Reopen on recurrence; retain previous evidence.

SUPPORT reports to Dev: new/reopened incidents by severity, age/owner, affected journeys, missing
coverage, failed sensors, verified local fixes, hosted recovery pending and next action. Start with
each scan/release handoff and each new user report; schedules and notification destinations require
an explicit implementation, so no automatic delivery is claimed.

## Pairing and safe logs

Finance findings pair with COMMERCE/RECONCILIATION, FINANCE_DATA and INTERNAL_CONTROLS/CONTROLLER;
CFO accepts accounting treatment. Financial audit entries remain immutable: reverse under approved
rules, never rewrite history. Security/safety findings route immediately to SECURITY/SESSION_SECURITY,
TRUST_SAFETY and relevant legal/privacy owners. Independent QA remains outside this team.

Use an opaque incident/request identifier, release, environment, route or named surface, event code,
duration and count. Never log JWTs, secrets, payment client secrets, card details, signed media URLs,
raw request/response bodies, names, DOB, GPS, private media or financial export contents. Do not
log every tap as an error. Define sampling, queue limits, retry/loss behavior, retention, access and
sensor-health checks before new collection. DATA_GOVERNANCE and PRIVACY_ENGINEERING review new
tables/fields/exports/retention; BACKEND and SECURITY review enforcement. DETECT-02 prepares restricted support evidence tables in the unapplied migration. Activation,
retention and hosted delivery require the documented deployment/operator checks.

## Future features and known gaps

The [admin-first workflow](FEATURE_ADMIN_WORKFLOW.md) now requires a detection/repair handoff within
the existing report and disable contracts: named sensors, safe failures/logs, responsible owner,
reproduction/repair and regression evidence. SUPPORT reviews that handoff before admin-ready;
the registry checker still validates declared structure rather than the meaning of prose.

The six initial gap tasks, with current partial implementations recorded in the coverage catalog, are in [DETECT-01](../agents/DETECT-01.md) and WORK_QUEUE. They cover crash
capture, backend failure alerts, telemetry delivery/loss, Stripe settlement, reusable visual
checks and linking user reports. Continue these with their domain owners. The local scan verifies executed gates; the coverage
catalog identifies runtime limits and the remaining durable/hosted detection work.

## Main-admin operating tool

Engineering Support is implemented at `/admin/support`: Issues, Team flow, Change history and
Recovery. SUPPORT reports under Development; SECURITY's THREAT_DETECTION joins investigation
with SESSION_SECURITY/RLS_SECURITY. The diagram derives source writers/readers and registered
reporting chains from `supportTopology.json`, generated together with DATA_MAP.md. It is static
lineage, not evidence of hosted delivery. Health, Feedback and Finance & Books retain their full
analysis and controls and are linked from the support desk.

Review expected events and false positives without erasing their evidence. Protected feature and
finance/security terminal dispositions need two distinct admins; a new occurrence reopens review.
Server identities/times are authoritative. The selected-source audit is atomic with the mutation,
keeps field names rather than row values and uses scoped hash chains. Privileged DB operators
remain a trust boundary. Read/render recovery is bounded; money/access/publish/destructive writes
never self-heal automatically. Source capsule verification and isolated previews are implemented;
hosted monitors, scheduled attack analysis, approved database backup rehearsal and release switching
require separate operational activation. See [DETECT-02 design](design/ENGINEERING_SUPPORT_CONSOLE.md).

## Learn from actual and potential struggles

At existing planning/triage reviews, apply [INNOVATION_AND_HANDOFF](INNOVATION_AND_HANDOFF.md).
Use the original incident/task to identify recurring pain or a hypothesized failure, measure a
baseline, test a small safe improvement and retain its decision/results. Track useful outcomes
such as repair time, failed reads or false positives with defined populations/windows. Pair the
feature owner with the existing domain reviewers, and promote accepted techniques into shared
contracts and documentation. Preserve failed-experiment learning and explicit monitoring gaps.
