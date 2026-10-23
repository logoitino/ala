<!-- REDUNDANCY-07: scoped source coverage and independent Security review; local checks do not certify operational security. -->
# Infrastructure security — roles, source report and review

**Task:** [REDUNDANCY-07](../../agents/REDUNDANCY-07.md). `SECURITY` owns independent review; Engineering
component owners implement the assigned corrections.

**Scope:** current registered services and exit components, including app/backend connections, SQL/access,
runtime/container/cloud templates, CI/dependencies and recovery tools. The report keeps source coverage and
review responsibilities current. Deployed configuration, provider accounts and unregistered resources need
separate observation; repository coverage is not a complete live asset census or proof that a system is secure.

Read [INFRASTRUCTURE_REGISTER](../INFRASTRUCTURE_REGISTER.md),
[EXIT_INFRASTRUCTURE_MAP](EXIT_INFRASTRUCTURE_MAP.md) and [REDUNDANCY_TEAM](REDUNDANCY_TEAM.md) together.
The existing [ENGINEERING_SUPPORT](../ENGINEERING_SUPPORT.md) process holds investigation/repair work;
[EXIT_READY_RUNBOOK](EXIT_READY_RUNBOOK.md) holds original recovery and cutover evidence.

## 1. Security ownership

| Security role | Responsibility | Engineering partners |
| --- | --- | --- |
| `INFRA_SECURITY` | Network exposure, IAM, TLS, host hardening and complete scoped control/report coverage; surface missing evidence. | `INFRASTRUCTURE`, `EXIT_CLOUD`, `API`, `RELIABILITY` |
| `SUPPLY_CHAIN_SECURITY` | Lockfile/dependency trust, upstream image provenance, CI trust and offline installation materials. | `CI`, `RELEASE`, `EXIT_CLOUD`, `CODE_HYGIENE` |
| `RECOVERY_SECURITY` | Backup isolation, integrity, restore safety, key rotation and independently held custody evidence. | `RECOVERY`, `EXIT_DATABASE`, `EXIT_SERVICES`, `EXIT_CLOUD` |
| `RLS_SECURITY` | SQL grants, RLS, security-definer functions and Storage authorization policies. | `BACKEND`, `DATABASE_MIGRATIONS`, `STORAGE` |
| `SESSION_SECURITY` | JWT, OAuth, identity boundaries, session/refresh and server actor verification. | `AUTH`, `BACKEND`, `EXIT_SERVICES` |
| `THREAT_DETECTION` | Trusted signals, false positives, audit integrity and incident/security-recovery judgments. | `SUPPORT`, `INCIDENT_TRIAGE`, `TELEMETRY`, `RELIABILITY` |

All six Security specialists report to **`SECURITY` → `CTO`**. `REDUNDANCY_LEAD` remains the Engineering
migration coordinator, reporting through `ENGINEERING`; `INFRASTRUCTURE` supplies current hosting context.
Joint work does not create a second reporting line or grant access. Engineering owners implement changes;
the assigned Security specialist independently reviews the applicable boundaries and reports to `SECURITY`.
Data/Finance/QA authority and owner decisions remain in their existing paths.

Role definitions establish duties. They do not start background reviewers, a security daemon, hosted monitors
or alert delivery. Record each actual dispatch, executor/model/tools, review date, source/release version,
environment, changed paths, commands/results, limits, findings and next owner. Weekly assigned reviews and
predeployment/cutover review are work to perform and record, not an installed scheduler.

## 2. Run the source checks and report

Run from the repository root using its existing Node/pnpm installation:

```sh
pnpm security:infra
pnpm security:infra:check
pnpm security:infra:test
pnpm security:infra:report
```

| Command | Meaning |
| --- | --- |
| `security:infra` | Regenerate the deterministic public source report from registered components, controls and governed source fingerprints. |
| `security:infra:check` | Check source drift, declared coverage and the generated report; missing/broken coverage must be investigated. |
| `security:infra:test` | Exercise the local report/coverage gate's tests; no provider investigation. |
| `security:infra:report` | Produce read-only local JSON observations without installing or changing provider configuration. |

Read the generated [INFRASTRUCTURE_SECURITY_REPORT](INFRASTRUCTURE_SECURITY_REPORT.md).
[controls.json](../../../infrastructure/security/controls.json) declares the control mappings;
[report.mjs](../../../infrastructure/security/report.mjs) derives the report. The `security:infra:report` alias
already supplies `--json`; do not append another flag.
Services name `INFRASTRUCTURE` as their Engineering coordinator; exit components name their declared
implementation owner. Both require mapped Security reviewers and
applicable controls. Complete governed source fingerprints make changed bodies/configuration invalidate old
source observations even when filenames and service names stay the same. Unmapped/new components cannot
inherit another component's coverage. Review unusual or unresolved dependencies explicitly.

The generated public report contains safe source metadata and bounded results, not credentials, private env
contents, customer rows or raw provider diagnostics. Keep original sensitive observations in protected external
custody; include only their sanitized reference in task/incident records. Do not paste secret values into a
finding, command argument or generated report.

Full checks integrate the report tests and drift/coverage check. The source updater's refresh step runs
`node infrastructure/security/report.mjs --write` after exit-map generation as bounded bookkeeping.
Semantic coverage gaps can retain a raw draft with failed validation; privacy/write failures refuse capture.
A running process that loaded older code needs the planned stop/restart before this behavior is active;
record the actual restart/source receipt in the task. Regeneration does not dispatch reviewers, acknowledge findings, complete
independent review, run live security tests or grant deployment/cutover readiness. Source tests and hashes
verify only their stated local scope; unsigned report integrity does not authenticate an operational observation.

### Interpret the result

`structuralStatus: current` means this invocation found no declared source-governance problems. Each local
guard reports `needs-attention` when its control entry, command, full-check inclusion or required source
evidence is missing; unaffected guards remain `source-linked`. Both retain `executed: false`: the report
links commands without running them. Operational
requirements remain `not-verified`; `securityStatus` is `not-established`, `operationalAcceptance` is `false`
and `readyToCutOver` is `false`. Preserve actual command and independent review receipts separately.

The focused REDUNDANCY-07 cleanup corrects an observed reporting defect: individual guards previously
remained `source-linked` even when their missing prerequisites produced an aggregate issue. Review the
affected guard's status and the aggregate issues together; unaffected links do not establish execution.
Helper/rendering cleanup changes source readability and reporting, with no new operational capability or role.
Root reproduced four failing prerequisite regressions before the fix; the cleanup's 22 scoped Security tests
then passed, and independent source/guide review accepted affected/unaffected status behavior and preserved
flags. These are local results; the new cleanup full-source receipts remain separately required.

Report CLI exits `0` for accepted local structure (and current Markdown when using `--check`), `1` for
structural issues or a stale checked report, and `2` for refused invalid/unsafe/changed inputs. JSON mode
recomputes local observations without checking rendered Markdown freshness; run `security:infra:check` too.
Operational requirements do not turn green merely because the structural command exits `0`.

**Observed local implementation (2026-10-20):** the generated report covered ten services and 24 exit
components, with nine guards `source-linked` and all 13 operational requirements `not-verified`.
The scoped Security tests passed 17 checks, including two Docker-context source-policy tests; no Docker
image/context execution was performed. The agent registry check passed 115 roles. These receipts
precede the integrated full check and the planned watcher restart; use the task's final receipts for those
separate results. No deployed control, background Security reviewer or alert delivery was validated here.

## 3. Review source and operational proof separately

| Area | Source to review | Independent operational evidence still needed |
| --- | --- | --- |
| Network / host / TLS | Terraform, container/gateway/service settings, declared exposure, runtime paths and sandbox. | Actual firewall/IAM/SSH/admin exposure, certificate/domain ownership, patching, volumes and process isolation on the selected host. |
| IAM / secrets | Public-client boundaries, server inputs, routing/source binding and private-path safeguards. | Effective least-privilege identities, verified TLS, custody/access/rotation and credential revocation under the actual service user. |
| Supply chain / CI | Lockfile/patches, verified upstream locks, immutable image references, architecture and artifact transport/provenance. | Trusted original pins/signatures where required, vulnerability/upgrade review and an offline image/dependency load/start on the target. Unsigned source checksums are not publisher signatures. |
| Auth / SQL / Storage | Caller/session checks, SQL grants/RLS/definers, restore TOC, guard order, object ownership and metadata/byte comparisons. | Real negative-access tests, Auth/OAuth/MFA/session/key compatibility, exact restored permissions, historical media access and accepted user/function tests. Synthetic HTTP fixtures do not supply these. |
| Recovery | Encrypted capture, source identity, original digest, all-destination receipts, isolated restore and private staging. | Independent reader fetch/decrypt, external key custody, key-rotation/revocation procedure, restored functionality and measured failure recovery. A fresh local record is not remote integrity. |
| Detection / response | Bounded error signals, protected audit references, monitoring thresholds and review/repair paths. | Real alert receipt, staffed responder, incident exercise, access-controlled logs and confirmed repair/revalidation; local source reports do not install any of these. |

These are review obligations; the local report does not automatically prove every row. Each reviewer must
name what was inspected, the exact target/source binding and what could not be observed. Missing operational
proof stays unverified. Do not convert a source check or current timestamp into a claim of secure deployment,
complete incident visibility or a passing cutover.

## 4. Change, route, independently review and repair

1. **Change/source binding:** update registered infrastructure/exit/control mappings and regenerate the report
   with the implementation. Keep the exit map and existing source-change notices current too. Retain exact
   changed paths and source hashes; a later change requires revalidation of affected evidence.
2. **Route:** the Engineering lead supplies the changed area, environment and evidence to `SECURITY`.
   `SECURITY` dispatches the applicable specialist(s), with RLS/Session/Threat authorities retained.
   `EXIT_SYNC` routes the exit notice; report regeneration alone is not delivery or review.
3. **Review:** specialists record independent findings, checked controls, failures/missing observations,
   commands/results and limitations. Send the same source-bound packet to the Engineering component owner
   and `REDUNDANCY_LEAD` for implementation coordination; Security findings still report through `SECURITY`.
4. **Lead/CTO decision:** `SECURITY` reports its recommendation to the CTO. Engineering reports the repair
   plan/result through its lead. The CTO coordinates the next authorized work and owner/domain decisions.
   Closing an exit notice does not close a Security finding or authorize access, deployment or traffic changes.
5. **Repair/revalidate:** the implementation owner supplies the fix and meaningful regression evidence.
   The assigned independent reviewer checks the exact changed source/target and records accepted, failed or
   unverified results. Preserve original occurrences; new occurrences or changed source reopen affected review.

Use the existing task/incident record, with protected original evidence where necessary. A useful finding has:

- A stable ID, confirmed finding versus unverified hypothesis, severity and concrete affected boundary/path.
- Source/release hash, observed date/time, environment and sanitized reproduction/command result.
- Actual impact, evidence gaps, responsible implementation owner, Security reviewer and next action/owner.
- Fix reference, independent revalidation result and remaining deployment/operational limitations.

Assign severity from observed exposure and impact through `SECURITY`: confirmed privileged/money/access
exposure needs urgent escalation; an incomplete operational test is an evidence gap until its impact is
established. Do not downgrade a failed authorization test to documentation debt or invent an incident from
an untrusted client signal. Keep private tokens, passwords and customer data out of the public packet.

## 5. Cadence and completion evidence

| When | Required work |
| --- | --- |
| Each related source/control/service change | Regenerate/check coverage, route affected reviews and retain the same source version in Engineering/Security records. |
| Weekly assigned Security review | Review open findings, missing operational proof, source drift and owner follow-through; record the actual executor/date/results. |
| Before deployment or cutover | Review current target-specific IAM/network/TLS/Auth/RLS/Storage/supply-chain/recovery evidence with component owners and QA; no inference from local tests. |
| After a fix, new occurrence, credential rotation or service upgrade | Independently revalidate affected boundaries and update the exact source/target/custody references. |

Completion of this local work needs passing scoped report tests/checks, current role/control mappings,
independent documentation/source review and the integrated full-check receipt. Operational security requires
the separate original deployed evidence above. Keep both results explicit; no live provider operation,
background reviewer or cutover is performed by creating these roles and source reports.
