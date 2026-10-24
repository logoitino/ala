<!-- One reading home for Redundancy & Exit (REDUNDANCY-02). Runnable code stays under infrastructure/. -->
# Redundancy & Exit — reading home

**Lead:** `REDUNDANCY_LEAD` → `ENGINEERING` → `CTO`. **Task receipts:** [REDUNDANCY-02](../../agents/REDUNDANCY-02.md).
**Change notices:** [EXIT_CHANGE_LOG](../../agents/EXIT_CHANGE_LOG.md) (stays under `docs/agents/`).

This folder is the **single place to read** the move-off-Supabase plan, migration runbooks, and
Infrastructure Security reports. App changes keep the generated map and security report current
through `pnpm exit:map` / `pnpm security:infra` (Stop hook, `pnpm check`, CI). Runnable trees did
**not** move: `infrastructure/exit/`, `infrastructure/migration/`, `infrastructure/security/`,
`infrastructure/backup/`, `infrastructure/supabase/`, `infrastructure/terraform/`,
`infrastructure/containers/`.

## Start here

| Read | What it is |
| --- | --- |
| [REDUNDANCY_TEAM.md](REDUNDANCY_TEAM.md) | Charter, agents, change protocol (how every app change reaches the plan) |
| [EXIT_INFRASTRUCTURE_MAP.md](EXIT_INFRASTRUCTURE_MAP.md) | **Generated** build map: inventory → AWS / Azure (exit A / B), owners, plan version |
| [EXIT_CHANGE_LOG.md](../../agents/EXIT_CHANGE_LOG.md) | Routed notices + review results (`EXIT_SYNC`) |
| [INFRASTRUCTURE_SECURITY_REPORT.md](INFRASTRUCTURE_SECURITY_REPORT.md) | **Generated** Security partners report (safe source binding) |

## Plan, runbooks, controls

| Document | Owner focus |
| --- | --- |
| [REDUNDANCY_PLAN.md](REDUNDANCY_PLAN.md) | Architecture, proposed RPO/RTO |
| [CLOUD_MIGRATION_RUNBOOK.md](CLOUD_MIGRATION_RUNBOOK.md) | Backup → restore → grant-sync → parity → cutover commands |
| [EXIT_READY_RUNBOOK.md](EXIT_READY_RUNBOOK.md) | Warm-target packet / original evidence requirements |
| [EXIT_DRILL.md](EXIT_DRILL.md) | Drill rehearsal record |
| [MIGRATION_FAILURES_AND_CONTROLS.md](MIGRATION_FAILURES_AND_CONTROLS.md) | Local failures and controls |
| [INFRASTRUCTURE_SECURITY.md](INFRASTRUCTURE_SECURITY.md) | Security role ownership and review protocol |
| [INFRASTRUCTURE_SECURITY_FINDINGS.md](INFRASTRUCTURE_SECURITY_FINDINGS.md) | Dated source findings |

## Hand-kept inputs (generators read these)

| File | Purpose |
| --- | --- |
| [exit-map.json](exit-map.json) | Component → AWS / Azure mapping, Auth capabilities, exclusions, build order |
| [exit-map.baseline.json](exit-map.baseline.json) | Last announced plan version (tool-written on `--acknowledge`) |
| [exit-readiness.json](exit-readiness.json) | Planning note only — not cutover GO |

## Implementation plans

| Plan | Task |
| --- | --- |
| [plans/REDUNDANCY_IMPLEMENTATION_PLAN.md](plans/REDUNDANCY_IMPLEMENTATION_PLAN.md) | REDUNDANCY-01 local kit |
| [plans/EXIT_READY_IMPLEMENTATION_PLAN.md](plans/EXIT_READY_IMPLEMENTATION_PLAN.md) | REDUNDANCY-03 warm-target |
| [plans/INFRASTRUCTURE_SECURITY_IMPLEMENTATION_PLAN.md](plans/INFRASTRUCTURE_SECURITY_IMPLEMENTATION_PLAN.md) | REDUNDANCY-07 Security partners |

## Runnable code (unchanged location)

| Tree | Role |
| --- | --- |
| [`infrastructure/exit/`](../../../infrastructure/exit/) | Source updater, release, readiness, health |
| [`infrastructure/migration/`](../../../infrastructure/migration/) | Parity, TOC, storage reconcile, local drill |
| [`infrastructure/security/`](../../../infrastructure/security/) | Controls, report generator, routing |
| [`infrastructure/backup/`](../../../infrastructure/backup/) | Encrypted archive tools |
| [`scripts/exit-map.mjs`](../../../scripts/exit-map.mjs) | Regenerates this folder’s map from the current app |

## How app changes reach the exit build

1. Edit the app (`apps/`, `packages/`, `supabase/`, …).
2. `scripts/exit-map.mjs` re-reads schema, migrations, functions, buckets, Auth, routes, env names → new **plan version** under this folder.
3. `pnpm exit:map:check` / CI fail until the change is announced: `pnpm exit:map --acknowledge --by "<session>"`.
4. Notice lands in `docs/agents/EXIT_CHANGE_LOG.md`; `EXIT_DATABASE` / `EXIT_SERVICES` / `EXIT_CLOUD` and partners review.
5. `pnpm security:infra` refreshes [INFRASTRUCTURE_SECURITY_REPORT.md](INFRASTRUCTURE_SECURITY_REPORT.md) from the same inventory.

Today’s stack (not exit): [PORTABILITY](../PORTABILITY.md) · [INFRASTRUCTURE_REGISTER](../INFRASTRUCTURE_REGISTER.md) · [BACKUP_OPERATIONS](../BACKUP_OPERATIONS.md).
