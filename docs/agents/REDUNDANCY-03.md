<!-- Actual Codex source/runtime/Storage/evidence implementation handoff; distinguish local checks from observed hosted recovery. -->
# REDUNDANCY-03 — continuously current exit release

**Owner request:**2026-10-19, exact current migration version of the app and all Supabase
functionality, continuously updated, with a future2–3hour cloud switch.
**Lead/executor:** Codex `/root`, acting as REDUNDANCY_LEAD/RECOVERY/EXIT_SYNC integration.
**Status:** local implementation and independent source review; final project verification
and current-source export governed by the verification receipts below. Hosted readiness remains NO-GO.

## Decision and baseline

Adopt the compatible exit A: run the same app and self-hosted Supabase service interfaces
on owned AWS/Azure servers. No duplicate rewrite. Cloud-native replacement (exit B) remains
a separate compatibility implementation. Baseline drift tracking detected names but missed
unchanged-name function bodies; generic database-first Storage restoration could reject
historic approved/expired files and lose logical owner semantics.

Alternatives considered: duplicate whole app (independent drift), replace every SDK/service
now (larger compatibility project), or package the exact source and prepare same-interface
services with measured proof. Adopt the last with explicit content/evidence invalidation.
Stop the cutover on any parity, private-access, financial-writer or time-budget failure.

## Actual assignments and results

All agents below ran as Codex sessions in this shared checkout, following AGENTS specialist
coordination. Repository role model pins were not changed. No outside message was sent.

| Runtime / responsibility | Owned source and observed work |
| --- | --- |
| `/root/recovery_review` — EXIT_SYNC + independent review | `exit-inventory.mjs`, `exit-map.mjs`,13focused tests; exact source fingerprints, SDK aliases/dynamic targets, shadowing review and strong cutover preflight. Independent release/runtime/Storage/readiness review. |
| `/root/cloud_deployment` — EXIT_CLOUD/EXIT_SERVICES | Immutable Docker-loadable runtime archives and guarded load plans;25mocked tests. Stable API gateway template. Exact service/Auth catalog comparison extension and52scoped tests. |
| `/root/redundancy_documentation` — Storage/RECOVERY/DOCUMENTATION | Source Storage catalog in encryption, isolated bytes-before-guards restoration, generated owner-only SQL and original logical parity;16Storage tests plus14Auth-TOC tests; combined82migration and52backup tests passed. Migration/failure/backup/runbook docs reconciled. |
| `/root` — integration/Data/Infrastructure coordination | Exact expanded release/capsule verifier6tests; strict readiness15tests; source-only CI workflow, governance registries/generated maps, folder index/runbook and current export. |

No assigned work reverts unrelated app/MFA/livescore edits in this dirty shared checkout.
An independent Claude session's newer exit status/map modes and database grant drill were
preserved. Root records actual review receipts; a local notice does not imply every defined
specialist runs continuously.

## Findings fixed and evidence limits

- Content hashes now change for application/function/policy/configuration bodies even if
  names stay unchanged. Every inventoried file must be included in the verified capsule;
  expanded missing/extra/tampered/link files fail. Private data/runtime files are excluded.
- Ambiguous SDK origins, dynamic arguments and shadowed identifiers remain explicit review
  candidates rather than falsely resolved literals. Static analysis is not live coverage.
- Stored pass notes cannot bypass readiness. Current source/target/image/backup artifacts,
  original attachment hashes, complete database/Storage comparisons and all12accepted gates
  are required. API/DB identities must match independently protected configuration.
- Reviewer reproduced stale400-day drills with fresh checkedAt, zero stage time and boolean
  call counts; all now fail. Stage times must be finite, positive, complete and sum to actual
  elapsed≤180minutes. Final parity/Storage/Finance acceptance binds final backup and freeze.
- Historical Storage bytes preload before application guard installation; owner/owner_id
  reconciliation keeps target backend IDs/version/metadata. Auth FKs can require reviewed
  Auth data preload. No live guard is disabled. Guard/function/access tests remain required.
- SQL dollar-delimiter collision and actual owner-FK selection bugs fixed. Both-sided missing
  logical fields, malformed UUIDs, unknown MIME and bool/nonfinite/negative size now fail.
- Auth/Storage/Realtime service function names alone and equal Auth row counts were insufficient.
  New coverage fingerprints carry exact service definitions/security/settings/grants and
  Auth hashes. Legacy partial fingerprints cannot authorize the strict gate.
- Actual runtime/gateway behavior, upstream commit/image compatibility and full service
  deployment are untested. Docker/Caddy/Terraform/PostgreSQL clients absent on PATH. A bounded
  fetch of the existing CI-pinned PGlite archive failed; new catalog SQL execution remains
  pending. The prior unmodified PG18.6/PGlite synthetic grant drill is historical evidence,
  not proof of these new SQL additions or actual Supabase services.
- Research uses official incident pointers with retrieval limits: search returned references,
  page-body tool access was denied. No company-specific migration durations are claimed.


+ Fresh isolated production export: Next standalone build and Expo web/API export both
  returned0 using synthetic public settings and a complete local dependency copy. Actual
  local HTTP smoke passed: portal login200, Expo health200, fan HTML200 and unauthenticated
  payment401. No provider data/financial action was used. Initial outside-preview dependency
  symlinks caused tracing/Metro failures; cloning the locked installed layout into the
  isolated preview fixed the test setup. Images still require the target Linux build.
+ Full Auth TOC mode preserves already-identical target seed records and rejects conflicts;
  Auth sequence definitions/state/SET coverage prevent next-ID collisions. Preimport allows
  only the explicitly restored migration-history namespace difference; final parity remains
  exact. Source/target endpoint and original-TOC coverage remain required.

## Verification and artifacts

Final inventory:1,111safe source/configuration fingerprints,1,067SDK callsites,66explicit
review candidates,39checked-in migrations,563canonical database functions. These counts are
source observations, not a live Supabase census.

Current source release path: `/Users/seiuliian/Downloads/ala-sports-exit-release-20261019`.
Capture uses `--verify-code`; its verified `manifest.json` records the actual full-check
result and exact source hashes. Independent build/log receipts are kept separately at
`/Users/seiuliian/Downloads/ala-sports-exit-verification-20261019`. Local checks verify file integrity and detect simulated failures; they do not
prove hosted behavior, independently delivered alerts or a real timed move.

## Next owners before readiness

EXIT_CLOUD/INFRASTRUCTURE: select/prepare cloud, verify upstream/image pins and complete image
cache/load/host/TLS drill. RECOVERY: activate approved offsite jobs, independent key custody,
reader retrieval/decrypt and alert delivery. EXIT_DATABASE/Data/RLS: actual source/target
catalog execution, reviewed TOC/owner/privilege restore and parity. EXIT_SERVICES/Auth/API/
Storage/Realtime: restored sign-in/MFA/REST/RPC/Edge/files/private access. RELEASE/DEVICE_QA:
owned stable origin deployed to supported installed clients and session/media/offline tests.
Finance/QA: one writer, provider reconciliation and complete timed rehearsal/rollback.

Read [EXIT_READY_RUNBOOK](../engineering/EXIT_READY_RUNBOOK.md) for commands, required original
evidence and180-minute planning budgets. Owner decisions remain required for provider/spend,
live-data rehearsal, deployed-client release and cutover. No new live resource or data movement
was performed by these sessions.
