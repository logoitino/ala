<!-- Future feature contracts keep operational ownership ahead of app implementation.
     This workflow is scoped to enrolled records and never certifies a release. -->
# Admin-first feature workflow

## Implementation claim

| Session | Owned new files | Status |
| --- | --- | --- |
| Outside-session Codex, 2026-10-12 | `scripts/check-feature-admin.mjs`, `scripts/__tests__/check-feature-admin.test.mjs`, `docs/agents/feature-admin.json`, `docs/agents/FEATURE_ADMIN_TEMPLATE.md`, this document | Claim released to root integration; local implementation complete. 13 focused tests, real empty-registry CLI and docs destinations pass. Root owns shared docs and final project gates. |

## Implementation plan

1. Write failing Node tests for malformed records, future paths, real readiness evidence,
   traversal and symlink escape, lifecycle ordering, and presentation-only exemptions.
2. Add a pure validator plus a local-file CLI. A selected feature can require a minimum state;
   a normal registry check validates declared states and accepts an empty registry.
3. Document mandatory enrollment, admin-first implementation, every record field, and exact
   commands. Run focused tests and the real registry CLI; record only observed evidence.

## Required order for future features

Every agent or outside session adding an app feature **must enroll it before app feature
implementation** in [feature-admin.json](../agents/feature-admin.json), using
[FEATURE_ADMIN_TEMPLATE.md](../agents/FEATURE_ADMIN_TEMPLATE.md). The accountable owner and
responsible lead review the contract. Existing role/model pins and specialist reviews stay
governed by [TEAMS](../agents/TEAMS.md) and [EXPERT_STANDARDS](../agents/EXPERT_STANDARDS.md).
This separate feature registry is not the callable-agent registry.

The initial feature registry is deliberately empty. Existing features do not gain a new
readiness claim because this tooling was introduced. A new capability added to an existing
feature still needs enrollment. Ordinary bug repairs may follow the existing fix process;
if a repair introduces a new capability or operational duty, enroll that capability.

| State | Required work and evidence |
| --- | --- |
| `planned` | Assign one owner. Define canonical source, Expo admin handling, primary report, disable/repair strategy, access/privacy policy and planned app surface. Use concrete descriptions; future file paths are allowed. Both readiness checkpoints are `null`. |
| `admin-ready` | Implement and verify the source, admin controls, reporting, disabling/repair and access handling first. All declared operational files and nonempty evidence files must exist locally. Record the actual admin check date, exact command/procedure and observed result. App files may still be future work. Pass the selected admin gate before starting the app experience. |
| `app-ready` | Build the app experience against the verified admin contract. Verify app behavior, denied access, missing/error states and disable/fallback behavior. Preserve the earlier admin checkpoint/evidence and add later app evidence. All declared app files must now exist. Pass the selected app gate. |

Use actual full UTC timestamps (`2026-10-12T09:00:00Z`, or with milliseconds). Both checkpoints
must follow enrollment; app readiness must be strictly later than admin readiness. Save
admin evidence when that stage passes and preserve it when adding app evidence. If an admin
contract changes during app work, reverify it before advancing and record the changed scope.

The normal sequence is:

1. Enroll the planned record and coordinate shared-file ownership with the session lead.
2. Define/build the operational contracts before the fan/athlete experience. Backend/shared
   source implementation needed for those contracts is part of this admin stage.
3. Run relevant focused and existing gates. Record actual output/observations, tested
   environment, dependency status and checks not run in a nonempty local evidence file.
   Financial/security work still requires its existing independent reviewers.
4. Set `admin-ready`, save its checkpoint, and pass the selected admin gate. For qualifying
   presentation-only work, perform and record the exemption review at this step instead.
5. Implement and verify the app experience. Add its later checkpoint, set `app-ready`, and
   pass the selected app gate before handing off the completed feature to the lead.

## Operational contract rules

- **Source:** name the canonical table/RPC/config owner and its files. Preserve unknown values,
  separate source errors, bounded reads, population definitions and reporting windows.
- **Admin:** put all writes in Expo `/admin`; the Next portal stays read-only. Build the actions
  an operator needs to review, publish, correct and repair the capability, with clear feedback.
- **Report:** choose the existing primary report and record metric definitions, periods,
  population, privacy scope and the complete accessible Data alternative. Keep links to the
  corrective admin actions. Explain why no new metric is needed when that is the right choice.
- **Control map:** new fan controls must add/update the existing `COVERAGE_CONTROLS` mapping
  in `apps/mobile/src/frontend/lib/adminCoverage.ts` with the admin owner, app surface,
  runtime switch (or its deliberate absence) and telemetry key (or its deliberate absence).
  Reuse a shared key only when its counts cannot be mistaken for per-control/surface counts.
- **Data map:** every new table, view, database function or export the feature adds is recorded in
  `docs/engineering/data-ownership.json` with its owner and purpose, and `docs/engineering/DATA_MAP.md`
  is regenerated in the same change; `DATA_GOVERNANCE` reviews the data paths before admin readiness.
- **Disable:** define the actual pause/unpublish/rollback path and app fallback, including a
  deliberate absence of a runtime switch. This contract does not authorize publishing a flag.
- **Access:** name allowed roles, denied behavior, privacy obligations and server/RLS enforcement
  files. Client UI hiding alone does not prove denial.
- **Evidence:** record commands or reproducible manual procedures and concrete outcomes, such
  as counts and observed interactions. Include environment and limitations in the result/file;
  list unapplied migrations or untested hosted/device behavior plainly.

Reuse existing implementation files when they genuinely fulfill multiple contracts. Avoid
creating another dashboard solely to satisfy a registry field. The reviewer checks the
contracts' meaning and the actual behavior; the CLI checks their declared structure.

## Presentation-only exemption

An explicit `{ "kind": "presentation-only", "reason": "...", "reviewedBy": "..." }` may exempt
a visual/copy/layout change that adds no data, business behavior, writes, permissions,
collection or reporting duty. The reason must describe the specific change and the reviewer
must be named. Operational contracts may then be `null`; the app contract remains required.
Exemption review evidence still occupies the admin checkpoint before app implementation.
This exemption never substitutes for a money/security/privacy review that already applies.

## Commands

Run these from the repository root. `EVENTS-01` is an example; use the enrolled feature ID.

```sh
# Validate all enrolled records at their declared states.
node scripts/check-feature-admin.mjs

# Optional after planning; confirms the named feature is enrolled.
node scripts/check-feature-admin.mjs --feature EVENTS-01 --require planned

# Required before implementing the app experience.
node scripts/check-feature-admin.mjs --feature EVENTS-01 --require admin-ready

# Required after app verification and before completion handoff.
node scripts/check-feature-admin.mjs --feature EVENTS-01 --require app-ready

# Focused workflow regression tests; Node 24, no packages required.
node --test scripts/__tests__/check-feature-admin.test.mjs
```

`--require` needs a selected `--feature`; an unknown ID fails even if the registry is empty.
The selected command validates the entire registry too. `--registry repo/path.json` selects
an alternate local registry; `--repo-root directory` supports controlled local fixtures.
Validation failures return exit 1. The CLI reads local files only and never updates the
registry, runs the evidence commands, applies SQL, publishes configuration or dispatches agents.

## Scope and limits of the gate

The default check accepts zero records and says how many records it checked. **It only checks
registered records. It does not infer unregistered feature intent from changed app files.**
Mandatory enrollment is an agent/lead review obligation; the current registry gate cannot
automatically discover that someone skipped it. A green empty-registry run certifies no feature.

The validator checks required fields, unique IDs, declared lifecycle states, nonplaceholder
evidence summaries, UTC date ordering and safe local file existence. It rejects absolute,
traversal, ambiguous and external-symlink paths, including future children of external links.
It does not verify that a file implements the claimed contract, that an evidence summary is
accurate, or that the developer actually worked in the stated order. It does not inspect git
history or authenticate timestamps. Leads/reviewers must review the saved admin checkpoint
before app work and inspect real evidence. A written migration is not applied SQL.

Readiness is scoped to the recorded environment. Local fixtures can establish local readiness;
hosted/device/policy/release checks still need their own evidence and approval under the
existing project rules. `app-ready` is **not release certification**.

## Local implementation evidence and handoff

- Red phase: initial missing export failed, then 11 behavioral checks failed against a minimal
  validator/CLI. A follow-up regression exposed overbroad placeholder rejection and generic
  `passed` evidence; both failures were observed before their fixes.
- Green phase: `node --test scripts/__tests__/check-feature-admin.test.mjs` — 13 passed,
  0 failed, 0 skipped on Node 24.21.0. Uses real temporary files and subprocess CLI runs.
- Real registry: `node scripts/check-feature-admin.mjs` — exit 0, **0 registered features**,
  with explicit enrollment and release-scope limitations in its output.
- Documentation destinations: `node scripts/check-doc-links.mjs` — exit 0, 150 active
  Markdown files checked at handoff. `git diff --check` also returned exit 0.
- No packages, SQL, commits, staging, hosted writes or publication were performed for this
  workflow. Root integrates package/check commands, the docs index and shared agent entry
  points, then runs the complete project gates. This document is this session's only tracker.

## Detection and repair handoff (2026-10-13)

Before admin-ready, pair with SUPPORT under ENGINEERING. Within the existing `report.metrics`
and `disable.strategy` contracts, name the failure signals, safe log/event codes, collection
and delivery limits, unread/stale behavior, escalation owner, synthetic reproduction, repair
and regression checks. Add implemented sensors or explicit gaps to `detection-sensors.json`.
SUPPORT reviews meaning and actual evidence; the metadata validator cannot infer missing
instrumentation from prose. Do not add another desk merely to display the same incident data.
Keep existing sources, link user reports and route money/security/safety to their domain owners.
See [ENGINEERING_SUPPORT.md](ENGINEERING_SUPPORT.md).

## Innovation and outside handoff

Apply [INNOVATION_AND_HANDOFF](INNOVATION_AND_HANDOFF.md) within the existing feature record.
Link its problem/experiment/decision document from checkpoint evidence; describe the baseline,
options, actual outcome, module contracts, diagrams and remaining gaps. A short existing task
record is enough for a small repair. Leads review the meaning and approved audience handoff;
the current metadata CLI does not validate innovation quality or certify outside review.
