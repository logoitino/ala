<!-- REDUNDANCY-07 adds accountable security review and local drift detection; original operational evidence remains separate. -->
# Infrastructure security implementation plan

**Goal:** involve the Security team in every infrastructure and exit change, with current local reports and explicit unresolved operational work.
**Authorization:** owner2026-10-20 requests additional security roles/agents and implementation; preserve one app, local preparation and existing external-operation boundaries.
**Architecture:** extend the existing Security reporting tree and exit notices. A deterministic source report joins the complete safe exit inventory, infrastructure registry, exit component mapping and Security ownership. Its structural checks cannot confer operational security acceptance.
**Stack:** existing Node24, Python3 and pnpm; no dependency installation or provider access.

## Responsibilities and interfaces

| Executor | Owned deliverable | Acceptance |
| --- | --- | --- |
| `/root/cloud_deployment`, actual outside Codex runtime, Security/VP reconciliation function | Three role files; registry; scoped Security/Engineering lead definitions; team roster/hierarchy/plans/standards | INFRA_SECURITY, SUPPLY_CHAIN_SECURITY and RECOVERY_SECURITY report to SECURITY -> CTO; all source ownership paths exist; model pins preserved; actual reconciliation recorded. |
| `/root/recovery_review`, actual outside Codex Security review function | Dated findings guide, scoped Terraform IPv4 SSH-range repair and network regression | Source-backed observations, known reviewed paths, no live claims; original broad-CIDR bypass covered locally; independently review report boundaries. |
| `/root/redundancy_documentation`, actual outside Codex DOCUMENTATION function | Infrastructure security guide and redundancy charter | Actual CLI/report/routing contracts, meaningful reporting cadence, no standing unattended reviewers or implied deployment acceptance. |
| Root, integration | `infrastructure/security/controls.json`, `report.mjs`, `routing.mjs`, report tests, generated security report; exit notice/sync integration; package/CI/source allowlist; registers/STATE/index/tracker | Every registered service and exit component has Security reviewers; missing or stale mappings fail; exact safe source hashes invalidate report; private inputs never read or reflected; full check and current verified source copy. |

## Ordered implementation

- [x] Establish role and report contracts above; dispatch actual owners and preserve shared edits.
- [x] Write adversarial report tests before implementation: unowned new service/component, stale source body, invalid Security reporting, missing evidence/guard, private env exclusion, link/path refusal, atomic no-op output, report refresh without review acceptance, source-notice routing.
- [x] Implement `inspectSecurity(root)` returning deterministic scope/hashes, source-linked local guards, required manual checks with `not-verified`, responsible reviewers and fixed issue codes. Implement `renderSecurityReport(report)` and `updateSecurityReport(root,{check})`. JSON is read-only; Markdown write is atomic through the existing reviewed derived-output helper.
- [x] Add exhaustive `controls.json` service/component reviews and13 operational requirement reviewer groups; require nine existing regression/governance commands rather than inferring test success from file existence.
- [x] Route new Security partners through the actual exit-map notices; refresh the source report in the existing bounded source sweep. No acknowledgement, reviewer approval or live acceptance is written automatically.
- [x] Apply validated Terraform IPv4 wildcard fix and exercise adversarial local regressions; actual Terraform/provider plans remain untested here.
- [x] Integrate tests/check in full project check and existing CI; register the public source report as an operational export and partial detection sensor. Regenerate Data/Infrastructure records.
- [x] Obtain independent report/source and actual Documentation/VP reviews, freeze docs, announce current source, pause watcher and run `pnpm exit:sync sync --verify-code`; restart watcher regardless of check outcome. Keep original final receipts privately outside source.

## Evidence and rollback

Report currentness is derived from safe source content plus exact reviewed local configuration, not timestamps. Generated reports carry no automatic human review or proof that tests were run. Required actual acceptance spans IAM/firewall/TLS, patching, CI and images, independent keys, Auth/session, RLS/Storage, offsite restore/isolation, incident delivery, payment boundaries and retention/privacy. Open observations belong in the dated findings guide; a source-local fix stays separate from deployed remediation.

Changes are additive and reversible by reverting only this task's paths/patches and command integrations after review; preserve other ongoing app work and prior private source/backup artifacts. Do not relax previous source, identity, restore or payment gates to make this report pass. No commit, push, cloud operation, live SQL, provider messaging or external credentials are required for this work.

Final integrated execution and task completion are governed by the original external receipt referenced in [REDUNDANCY-07](../../../agents/REDUNDANCY-07.md); this planned gate does not predeclare its result.

## Focused readability and correctness continuation (2026-10-20)

**Observed baseline:** every local guard was labelled `source-linked`, including guards missing their
own configuration, command, full-check membership or evidence. Overall structural failure already
worked; the individual JSON/Markdown claim was misleading. Dense inline checks and an escaped
Markdown template obscured the relationship.

**Bounded experiment:** preserve one report module and its five existing exports; give input,
ownership, evidence and metadata checks clear private helpers and a readable multiline renderer.
Use each guard's own issue delta to select `source-linked` or `needs-attention` and expose that
status in the table. A separate framework or app rewrite adds no value to this repair.

**Interfaces and limits:** `inspectSecurity(root)` stays synchronous and read-only;
`renderSecurityReport(report)` remains pure; `updateSecurityReport(root,{check})` retains atomic
writes/no-op behavior and rendered currentness independent of structural acceptance. JSON schema1,
fixed issue codes, deterministic source/metadata binding and CLI exits0/1/2 remain. The exact
`--write` semantic-failure marker still lets source sync retain only an unverified draft; unsafe
inputs remain hard refusals. No dependencies, provider contact or new data/control point is added.

**Success and actual evidence:** root reproduced four targeted failures before repair, then passed
`pnpm security:infra:test`22 tests including four guard-specific regressions and the actual CLI
relocated to synthetic inputs using the real inventory/writer. Existing privacy, source drift,
routing, atomic output and unaccepted source-refresh tests pass. Stop/revise if any private input
is exposed, unaffected guard becomes invalid, public contract drifts or full source verification
fails. Independent Security and DOCUMENTATION execution, adoption decision and new complete gate
are recorded in [REDUNDANCY-07](../../../agents/REDUNDANCY-07.md); original final evidence stays external.
