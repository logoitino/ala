<!-- Current-task evaluation and bounded repair receipts; hosted and device evidence remain separate. -->
# HEALTH-01 — Evaluate current tasks and improve detection

Owner direction: 2026-10-13, continue current tasks through evaluation and improvement.
This is owner-authorized outside-session Codex execution; repository role model pins remain unchanged.

## Shared-file claims

| Executor / function | Owned paths | Status |
| --- | --- | --- |
| Codex telemetry repair / TELEMETRY with SUPPORT | `apps/mobile/src/frontend/services/TelemetryManager.ts`, its new `services/__tests__/TelemetryManager.test.ts` | Accepted and integrated; claim released |
| Codex team_coordination / VP Operations | WORK_QUEUE, DEPARTMENT_PLANS; private `.smoke/support/health-task-evaluation.md` | 62 current task IDs evaluated, integrated; claim released |
| Codex documentation_sync / Documentation | `docs/engineering/ENGINEERING_SUPPORT.md`, `docs/engineering/detection-sensors.json`, `docs/engineering/DATA_PRIVACY_MAP.md`, `docs/engineering/TESTER_SCRIPT.md`; private `.smoke/support/health-documentation-review.md` | Documentation corrected, checked and integrated; claim released |
| Root integration / ADMIN, security evaluation and session lead | This ledger, QA tool/component tests, index/STATE/CHANGELOG, generated map/topology and ownership metadata if needed; private security review/probes | Locally accepted; final documentation checks passed, claim released |

Claim checkpoint observed at 2026-10-14T00:34:15Z (2026-10-13 local date).

Read current contents and modification times before editing. Do not overwrite another session's
work. No commits, hosted SQL, deployment, live money, external messages or role/model changes.

## Bounded repair and acceptance

- Evaluate every current queue section against its dated evidence and distinguish local completion
  from remaining hosted/device/security/finance/counsel dependencies.
- Repair the existing DETECT-01-G3 logger: hard queue/batch bounds, finite delivery timeout,
  safe status/loss counters and strict missing-source classification. Keep the existing event API.
- Uncertain INSERT results must not cause automatic replay that can duplicate analytics.
  Record loss/uncertainty explicitly; no financial/access mutations or new telemetry collection.
- The existing QA desk exposes a sampled, device/process-local delivery snapshot; Health retains
  aggregate analysis. A quiet logger or no successful delivery never implies fleet health.
- Meaningful failure-before/fix-after tests cover failed/missing/denied/hung delivery, queue
  bounds, uncertainty, dispose/late responses and QA source independence.
- Security evaluates the recorded NULL-check follow-up with exact source and synthetic impact
  evidence; speculative vulnerabilities remain hypotheses and do not authorize hosted actions.
- Documentation/coordination receipts include actual executor, paths, checks/date/results,
  open issues and next owner; root integrates and releases claims after verification.

This repairs existing detection responsibilities and the existing QA repair desk. DETECT-02's
admin-first Support handling remains the operational contract; no new app feature, data set,
role, hosted sensor or scheduled runner is introduced by this repair.

## Evaluation, results and disposition

### Queue evaluation

Codex `/root/team_coordination` evaluated **62 current task IDs**, every current section,
10 specialist backlog functions and 8 owner decisions. The nine ranked lanes and accountable
next checks are in [WORK_QUEUE](WORK_QUEUE.md#ranked-remaining-work); department alignment is
in [DEPARTMENT_PLANS](DEPARTMENT_PLANS.md#current-evaluation--health-01-2026-10-13).
The full row-by-row evaluation is private: `.smoke/support/health-task-evaluation.md`.

Existing admin, Finance & Books, Data and Support implementations remain locally complete
within their original evidence. Playback final acceptance, hosted activation, installed devices,
R2 Supabase reset/history, durable crash intake, database backups and CPA/counsel/release decisions
remain open. Concurrent DATA-01-F8/F9/F10 source fixes and F10a live-payout requirements are preserved.
This evaluation improves the existing queue; it does not complete all 62 tasks.

### Implemented repairs and experiment result

- **Existing logger/G3:** admitted plus unresolved transport rows stay within 120, batches within
  15 and caller delivery wait within 10 seconds. Explicitly disabled SDK retries and removed
  attempted-batch replay. An uncertain acknowledgement records loss/uncertainty instead of
  duplicating analytics. Exact relation-missing and permission failures use fixed safe codes.
- **Lifecycle:** ignored aborts retain the actual transport reservation until settlement;
  late acknowledgement cannot claim confirmed delivery. Disposal accounts rows once and keeps
  the singleton inert, preventing replacement instances from accumulating stalled requests.
- **Existing QA desk:** independently readable client digest and device queue, one actual pending
  read per source across refresh/focus/remount/development reload. A 10-second UI read timeout
  retains the transport reservation; no old response is cached/reused. Late/unmounted responses
  cannot populate newer views. An indefinitely stalled source remains unavailable until it settles.
- **Honest controls:** Clear/Unsave labels match the queued action. Replay reports actions still
  on this device. Unconfirmed write notices explain locks retained until real settlement;
  no timeout unlock or automatic uncertain-write replay was added.
- **Local delivery panel:** sampled process/device status, queued/in-flight reservations,
  confirmed delivery, discarded/uncertain counts and dated historical issues. Missing monitoring
  after an older development singleton requires reload and displays unknown. Aggregate Health
  analysis remains in Health. No new telemetry payload, identity or persisted collection was added.

The chosen bounded approach uses reservations rather than abandoning stalled work and retrying
writes. The before/after evidence supports adopting these existing-system repairs locally.
An ignored abort can stop subsequent delivery; bounded loss is explicit rather than hidden.
Raw event payloads remain unchanged with no per-row byte bound or new redaction guarantee.
Counters are volatile process totals; uncertainty is a subset of dropped, and an unresolved
reservation can overlap already-recorded loss. No delivery rate, fleet health or durability claim.

### Executed verification

All UTC checks below fell on **2026-10-13 in America/Denver**. Actual executor is outside-session
Codex, including the named child sessions; repository specialist model pins were not changed.

| Check / executor | Actual result and retained evidence |
| --- | --- |
| TELEMETRY failure-before and repair | Initial valid regression: 16 failed /1 passed; repeated lost acknowledgement committed the same event five times and batches reached 200. Two later disposal regressions also failed before repair. Final focused `pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand TelemetryManager`: **21/21 passed**, exit 0; source API/status and scoped whitespace reviewed. |
| Root QA failure-before and repair | Original independent-source/render tests: 7/7 failed before repair. Review regressions: 2 failed /9 passed, including two actual pending reads and incorrect action labels. Final `pnpm --filter @tapuai/mobile test -- --watchman=false --runInBand src/frontend/components/Admin/__tests__/QaTool.test.tsx`: **11/11 passed**, exit 0; `.smoke/support/health-qa-before.log`, `health-qa-review-before.log`, `health-qa-after.log`. |
| Independent review | Codex `/root/telemetry_delivery_repair` accepted core delivery and root QA follow-up at **2026-10-14T00:54:59Z**, with no remaining Important defect in those precise changes. `.smoke/support/health-integration-review.md` records hashes, earlier findings and their repair. Final bounded SQL evidence independently accepted on 2026-10-14 UTC (2026-10-13 local); review does not prove native focus or hosted behavior. |
| Root full local health scan | `pnpm detection:scan` passed **2026-10-14T00:56:43.573Z–00:58:02.345Z**, exit 0: full mandatory `pnpm check`, **117 app suites /859 tests**, separate Next **86/86**, 182 active Markdown destinations, 106 roles, 2 feature contracts, 13 workflow tests, 10 recovery and 10 detector tests; no failed/skipped checks. Retained `.smoke/detection/2026-10-14T00-56-43-571Z-b4a892b8-final.json` and `.smoke/support/health-01-final-scan.log`. |
| Data topology | Root regenerated the master map/Team flow; gate passed **54 tables, 3 views, 4 buckets, 38 switches, 161 functions, 19 triaged exports**; all owned/connected, no rule failures. Unused-locals guard passed with its two named baseline items. |
| Documentation execution | Codex `/root/documentation_sync` corrected Support handbook, sensor catalog, privacy map and tester script. At **2026-10-14T00:57:41Z**, docs sync/links, sensor catalog, 106 roles, owned links/anchors/JSON/source constants and whitespace passed; private `health-documentation-review.md`. Current catalog: **17 sensors, 14 partial/gaps**, runtime unverified. |
| Team coordination execution | Codex `/root/team_coordination` updated WORK_QUEUE and DEPARTMENT_PLANS from all 62 IDs and backlog/decisions. At **2026-10-14T00:52:27Z**, 106-role check, 182 Markdown destinations and scoped whitespace passed; private row-by-row receipt. Root integrates final gate and Security results below. |
| Current canonical SQL replay / root | Frozen current schema/replay captured **2026-10-14T00:57:30.124820Z**. `node .smoke/support/health-schema-replay-tested.mjs /tmp/books01-pg/pkg/package/dist .smoke/support/health-schema-tested.sql`: **35/35 passed**, exit 0, Postgres 18.6; 54 tables, 199 public functions and 85 policies. Captured sources matched the shared files at final comparison. `.smoke/support/health-schema-final.log`, `health-sql-source-receipt.json`. |
| Five cap boundaries / root | At **2026-10-14T00:58:22.504Z**, `node .smoke/support/health-security-probe.mjs .smoke/support/health-schema-tested.sql` passed, exit 0. All five actual CHECK expressions accept the exact limit and deny limit+1 in normal/roleless clients; service role and SQL Editor preserve trusted allowance. Actual tip INSERT denied with 23514; client UPDATE affected 0 rows through RLS and actual values stayed unchanged; trusted INSERT/UPDATE affected 1 row with verified values. Required helper EXECUTE grants passed. Sponsorship/shop coverage evaluates actual expressions; actual mutation coverage is tips. `.smoke/support/health-security-final.log`. |

### Security evidence and concurrent source handoff

Root reviewed/tested SQL and did not author or apply the concurrent security/payout migrations.
The saved failure-before probe demonstrated NULL-passing CHECKs only in a synthetic local
roleless authenticated database context. The current five-cap source replaces these with
`is_trusted_server()`. The earlier accepted oversized row is historical, not an active finding
against the repaired source. A later private probe initially expected client UPDATE to raise 23514;
RLS actually changed zero rows. Its failed assumption is retained in
`health-security-probe-assumption-before.log`; the corrected check verifies affected rows and
actual values, without treating denied updates as a cap bypass.

Exact tested SHA256 values (private source receipt includes the replay script):

| Source | SHA256 |
| --- | --- |
| `apps/mobile/src/backend/db/schema.sql` | `ae8b01443fa7ce9c6d1f44f414de77dbb5d9290b4294e6eb42231e2dfc246090` |
| `supabase/migrations/20261013210000_function_access_hardening.sql` | `8e40f4fe775e1c67c75254bc1dcc959b8362bbb06fbd759d51175fed425ff81c` |
| `supabase/migrations/20261013220000_disbursements_guardian_scope.sql` | `afc81fff13f0464ab6a325ae94b31c55e45501a2a90ce5a14c7e5c7b3cba5441` |

The local schema replay includes Supabase-like auth/Storage/Realtime/default-grant stubs,
not an actual Supabase stack or hosted JWT gateway. Tests demonstrate row-integrity/access
rules, not a Stripe charge, cash transfer or signed-token exploit. NOT VALID cap constraints
enforce new/changed rows without installation-time scanning of legacy oversized rows.
Owner/BACKEND/RLS_SECURITY apply reviewed function hardening first and verify legitimate
server/admin paths and wrong-role denial on the actual project; other October migrations
and guardian-payout activation follow approved order. F10a withdrawal linkage, independent
payout approvals, post-handover visibility and richer audit remain live-payout/counsel gates.

### Next assigned work and limits

1. **Owner, BACKEND, RLS_SECURITY:** reviewed hosted security application/readback before other
   pending SQL; migration and deployed JWT behavior remain unapplied/unverified here.
2. **PLAYBACK, QA, RELEASE, DEVICE_QA:** finish local-media browser/clean-install acceptance
   and actual installed-build sign-in, picker, playback and single test-donation checks.
3. **DATABASE_MIGRATIONS, BACKEND, SHARED_CONTRACTS, CI, RECOVERY:** actual synthetic Supabase
   reset, agreed migration history, database-backup restore and deployed compatibility.
4. **CFO, CONTROLLER, FINANCE_DATA, QA:** real-admin Books reads, one practice close and sandbox
   import after approved SQL. Owner/CPA/counsel retain business/retention/live-money decisions.
5. **SUPPORT and domain owners:** one assigned remaining sensor/intake/settlement/visual-harness
   repair at a time, with failure-before evidence, independent review and dated doc receipt.

These duties execute when assigned. No unattended monitoring/agent scheduler or new source
capsule was created. The prior capsule predates HEALTH and current SQL; it does not package
this working tree. Local source/UI-state verification passed; current browser/native appearance,
transport delivery, crash durability, hosted audits and backups were not verified.

### Root close-out and claim release

Final Documentation and coordination corrections are integrated. Root observed close-out at
2026-10-14T01:01:59.747806+00:00 (2026-10-13 America/Denver): `pnpm docs:links` passed
**183 active Markdown files**, `pnpm detection:check` passed **17 sensors /14 partial-gaps**,
scoped `git diff --check` and tracked/new-file whitespace/conflict checks passed, all exit 0.
Verified code and SQL hashes still match the dated source receipts. The full gate's 182-document
count remains its earlier captured result; 183 is the subsequent current link check.

Disposition: **HEALTH-01 locally accepted**. All listed claims are released after actual source,
review, documentation and coordination integration. Failures-before remain retained with their
fixes and limits; assigned hosted/device/durable/finance/counsel/release work remains open.
STATE receives the final dated handoff after this ledger and the changelog.
