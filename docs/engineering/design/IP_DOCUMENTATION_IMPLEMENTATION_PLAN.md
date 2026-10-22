<!-- Local repository documentation implementation; actual tests and pending counsel work are retained in IP-01. -->
# IP documentation implementation plan

**Goal:** maintain a complete internal counsel-intake document as source evolves.
**Architecture:** manual factual register and operating plan; deterministic source-bound packet;
existing DOCUMENTATION upkeep and LEGAL counsel coordination. **Stack:** Node 24 built-ins,
Git source inventory, Markdown/JSON, pnpm and existing Claude/CI hooks; no provider dependency.
**Design:** [IP protection plan](../../legal/IP_PROTECTION_PLAN.md), especially §§8–9.

## Constraints

Keep existing concurrent Security changes; claims and actual receipts live in [IP-01](../../agents/IP-01.md).
No Expo/mobile code, database resource, hosted operation, disclosure, filing or paid worker.
Preserve pinned agent models and approved legal text. New documents enter the docs index.

## Task 1 — Source-bound packet

- [x] Add `docs/legal/ip-register.json`: three candidate disclosures, rights checklist,
  owner-reported disclosure baseline, counsel questions and empty review/decision/filing records.
- [x] Add behavioral tests in `scripts/__tests__/ip-docs.test.mjs`, using isolated real Git
  repositories: source drift produces stale evidence, decisions survive sync, credentials/runtime
  inputs stay excluded, symlinks/traversal/missing references fail before writes, check is read-only.
- [x] Run `node --test scripts/__tests__/ip-docs.test.mjs` and record expected missing-tool failures.
- [x] Implement `scripts/ip-docs.mjs`: exported `buildPacket(root)` returns Markdown;
  `run(root, check)` writes only the fixed packet or fails a read-only currency check.
  Inventory uses Git paths with safe extension/path restrictions. Validate supplied references
  and review digests; never infer legal decisions or copy source into the packet.
- [x] Run tests and generate `docs/legal/IP_COUNSEL_PACKET.md`; inspect the actual disclosures/gaps.

## Task 2 — Continuing upkeep and accurate team routing

Integration finding: private source capture rejects unknown JSON by design. Add the exact
`docs/legal/ip-register.json` policy in `scripts/recovery-capsule.mjs` and a regression in
`scripts/__tests__/recovery-capsule.test.mjs`; preserve neighboring data-file rejection.
The factual register is internal source documentation, not runtime customer data or correspondence.

- [x] Add `ip:sync`, `ip:check`, `ip:test` scripts. Put local sync/check/test in `pnpm check`;
  add read-only check/test in `.github/workflows/ci-checks.yml`.
- [x] Add `scripts/ip-docs-guard.sh` and a Claude Stop hook; no autonomous paid agent.
- [x] Reconcile DOCUMENTATION and LEGAL duties in role files, registry, TEAMS, hierarchy and queue.
  Add AGENTS/Cursor same-turn instructions; preserve existing reporting and current duties.
- [x] Link the process from company patent triage and add all document/register navigation rows.
- [x] Run focused checks, full `pnpm check`, `pnpm detection:scan` and whitespace checks.
- [x] Record exact results/limits in IP-01, STATE and CHANGELOG; release shared-file claims.

Stop on invalid/unavailable source or unsafe inputs; preserve the previous generated packet and
report the repair owner. Source freshness proves neither semantic accuracy nor patentability.

## Execution result

All listed local implementation/integration steps were performed. Focused IP8/8 and Recovery15/15
regressions plus document/registry/currency checks pass. Final commit revalidation now passes
full `pnpm check` and portal106/106 through the retained detection scan at2026-10-22T14:31:55Z;
private source refresh is synced/current. Earlier failures are preserved in
[IP-01](../../agents/IP-01.md). Checked steps establish local tooling completion, not counsel
acceptance or permission to present. Owner authorized the local commit; no outside publication.
