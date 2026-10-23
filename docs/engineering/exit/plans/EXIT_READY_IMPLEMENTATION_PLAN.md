<!-- REDUNDANCY-03 implementation plan: build a current portable release and test the conditions for a 180-minute warm cutover. -->
# Continuously current exit release — implementation plan

**Goal:** preserve the exact current application/database service implementation in a portable release and detect anything that invalidates a prepared 2–3 hour migration.
**Architecture:** exit A runs the same app source and Supabase service interfaces on owned AWS/Azure servers. Content hashes bind source, SQL, service images, configuration and rehearsal evidence. A prepared target and compatible installed clients are prerequisites; a cold install is outside the timed switch.
**Tech stack:** Node24/TypeScript AST, Python3.10+, existing PostgreSQL backup/parity tools, Docker-loadable image archives and Caddy.
**Spec:** owner request2026-10-19; [REDUNDANCY_PLAN](../REDUNDANCY_PLAN.md), [REDUNDANCY_TEAM](../REDUNDANCY_TEAM.md), [CLOUD_MIGRATION_RUNBOOK](../CLOUD_MIGRATION_RUNBOOK.md).

## Constraints and decision

- Keep one implementation of every app/SQL function. A second rewritten app would drift; the portable package carries exact reviewed source instead.
- Keep source in the existing monorepo. Generated metadata and operational source live under `infrastructure/exit/`; private artifacts/runtime secrets remain outside Git.
- Retain owner decisions for live data, cloud provisioning/spend and cutover. Local automation and synthetic tests run now.
- Static source inventory is not live database truth. Dynamic call targets are explicit review items; read-only catalog/row parity remains required.
- No claim of180-minute readiness without fresh evidence for the current source, exact prepared target and all acceptance stages.
- The stable owned endpoint must be deployed to installed clients in advance. Existing Supabase-project-domain binaries cannot be redirected by our DNS.
- Restore historical file bytes without weakening live app guards; reconcile logical ownership and preserve target physical backend version IDs.

## Task1 — content drift and exact call locations

**Owner:** Codex `/root/recovery_review` acting as EXIT_SYNC; files `scripts/exit-inventory.mjs`, `scripts/exit-map.mjs`, `scripts/__tests__/exit-map.test.mjs` and generated map.

- [x] Capture source paths/SHA256/size for app modules, SQL/migrations, dependency locks, mapping config and infrastructure implementation.
- [x] Detect function-body/column/policy/migration/Edge/route changes even when names are unchanged; route changed files by ownership.
- [x] Export `collectExitInventory(root)` with `contentHash`, `planVersion`, `sourceFiles`, callsites and explicit unresolved calls.
- [x] Test unchanged-name edits, aliases/literal/dynamic targets, configuration drift and private/symlink exclusions.

## Task2 — portable release and readiness

**Owner:** Codex root; files `infrastructure/exit/release.mjs`, `readiness.py`, strict example configuration, tests and shared integration.

- [x] Package the existing verified source capsule, expanded application source and inventory into a new private external release directory.
- [x] Verify every included artifact and expanded source file; reject extra/missing/changed/link paths and refuse existing destinations.
- [x] Tie readiness evidence to current content hash/target and reject stale/partial/future evidence.
- [x] Require preprovisioned target, complete runtime image archive, current backup, schema/row/ACL/file/service/Auth/MFA/clients/finance/rollback/monitoring proofs and a measured cutover rehearsal no longer than180minutes.
- [x] Produce a deterministic step schedule and report all missing evidence; never execute arbitrary shell from configuration or switch live traffic automatically.
- [x] Test source drift/tampering, partial/future evidence, target mismatches, snapshot-age accounting and the180-minute budget.

## Task3 — service/runtime preparation

**Owner:** Codex `/root/cloud_deployment` acting as EXIT_CLOUD/EXIT_SERVICES; `infrastructure/exit/runtime_images.py`, its tests and a stable API gateway template.

- [x] Export exact inspected Supabase/proxy image digests and app image content IDs as Docker-loadable archives for the target architecture.
- [x] Verify archive hashes offline; missing/different services or mutable images fail.
- [x] Prepare an owned stable API gateway routing allowed Supabase endpoints to one reviewed backend with WebSocket support and no fallback writes.
- [x] Test platform/service/hash drift and gateway boundaries; label actual Docker/network/native deployment unperformed.

## Task4 — historical Storage restore and failure controls

**Owner:** Codex `/root/redundancy_documentation` acting as Storage/Recovery and DOCUMENTATION; narrowly owned backup catalog/restore and `infrastructure/migration/storage_reconcile.py`, its tests and migration-failure guide.

- [x] Export required source Storage ownership/catalog information inside encrypted backups.
- [x] Preload historical bytes and reconcile logical owners on an explicitly isolated target before application guards are installed; require final guard/function acceptance.
- [x] Reconcile logical metadata needed by app rules while retaining target backend version/physical object identity.
- [x] Test historical entries, source/target refusal, application guard refusal, owner/FK/SQL delimiter validation, metadata completeness and owner mismatch.
- [x] Record named company incident sources only at actually retrieved confidence; map failure patterns to implemented controls and outstanding drills.

## Integration and acceptance

- [x] Independent source/data/service review; fix findings.
- [x] Update governed operational exports, sensor declaration, infrastructure register, indexes, STATE and tracker.
- [x] Regenerate/acknowledge content-aware exit map and retain actual routed review results.
- [x] Run the complete `pnpm check`, focused CLI tests and an actual current-source release capture/verify; final receipts pending below.
- [x] Leave actual Supabase/container/cloud/Auth/Storage/provider rehearsal and180-minute readiness explicitly pending until observed.

Execution/review receipts and pending hosted gates: [REDUNDANCY-03](../../../agents/REDUNDANCY-03.md).
