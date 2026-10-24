<!-- REDUNDANCY-02 records the standing Redundancy & Exit team setup and its actual verification. -->
# REDUNDANCY-02 — Redundancy & Exit team and the self-updating exit plan

**Opened:** 2026-10-19. **Requested by:** owner. **Accountable lead:** `REDUNDANCY_LEAD` (new), reporting to `ENGINEERING` → `CTO`.
**Actual executor:** Claude Code session run by the owner (documentation, team-coordination and EXIT_SYNC functions performed in
this session; no repository role was dispatched). **Status:** local setup complete; hosted actions unchanged and owner-gated.

## Request

> Have the team set an agent where any changes on the app automatically update the backup version with the redundant database
> plan, in case we need to move from Supabase to a different database. Add a redundant team working on the different database
> with a full infrastructure map of how to build the whole infrastructure when it moves to a cloud base. Full documents of the
> infrastructure and all the teams and agents that take care of it, and the one that updates the rest of the team when changes
> are made on the current version.

## What was set up

| Ask | Delivered |
| --- | --- |
| A redundant team working on the different database | Five new registry agents (Engineering): `REDUNDANCY_LEAD` → `EXIT_SYNC`, `EXIT_DATABASE`, `EXIT_SERVICES`, `EXIT_CLOUD`; roster 107 → 112. Partners keep their reporting lines |
| The one that updates the rest of the team | `EXIT_SYNC`: owns the generator, baseline, Stop-hook guard and [EXIT_CHANGE_LOG](EXIT_CHANGE_LOG.md); routed notices per area |
| App changes automatically update the plan / backup version | `scripts/exit-map.mjs` regenerates the map and plan version from the code; Stop hook (`scripts/exit-map-guard.sh`) in every Claude session; `pnpm exit:map:check` in `pnpm check` and CI fails on stale map, coverage gaps or unannounced changes; the recovery source capsule now carries the map, `exit-map.json` and baseline |
| Full infrastructure map to build everything on a cloud base | Generated [EXIT_INFRASTRUCTURE_MAP](../engineering/exit/EXIT_INFRASTRUCTURE_MAP.md): 12 components × exit A/B × AWS/Azure, owners, detected inventory, 11-step build order |
| Full documents of the infrastructure, teams and agents | [REDUNDANCY_TEAM](../engineering/exit/REDUNDANCY_TEAM.md) charter (documents, responsibilities, change protocol diagram, cadence); TEAMS contract item 13, hierarchy, expert standards, department plans, AGENTS.md, queue |

## Status and file claims

| Executor | Claimed files | Claimed | Status |
| --- | --- | --- | --- |
| Claude Code session (owner-run) | New: five `.claude/agents/*.md`, `scripts/exit-map.mjs`, `scripts/exit-map-guard.sh`, `docs/engineering/{REDUNDANCY_TEAM.md,exit-map.json,exit-map.baseline.json,EXIT_INFRASTRUCTURE_MAP.md}`, `docs/agents/{REDUNDANCY-02.md,EXIT_CHANGE_LOG.md}`. Shared edits: registry, TEAMS, TEAM_HIERARCHY, EXPERT_STANDARDS, DEPARTMENT_PLANS, WORK_QUEUE, AGENTS.md, docs/README, STATE, package.json, CI, `.claude/settings.json`, `scripts/recovery-capsule.mjs` (two JSON allowlist entries), INFRASTRUCTURE / RECOVERY definitions | 2026-10-19 | Complete locally; claims released |

## Verification receipts

| Date / executor | Check | Actual result |
| --- | --- | --- |
| 2026-10-19 / Claude Code session | `node scripts/exit-map.mjs` then `--acknowledge` | Map generated, plan `6f6ff010e985`: 12 components, 111 tables, 3 views, 563 functions, 30 app policies/triggers on Supabase tables, 6 buckets, 39 migrations, 3 Edge Functions (2 allowlisted, `stripe-webhook` excluded), 6 API routes, 17 Auth methods (all mapped), apple/google OAuth; baseline created and first notice written |
| 2026-10-19 / Claude Code session | Change simulation: temporary Edge Function `zz-exit-probe` and table `public.zz_exit_probe`, then reverted | `exit:map:check` exit 1 with three findings (function outside the self-host allowlist, stale map, unannounced Tables + Edge Functions); Stop-hook guard exit 2 with the announcement instruction, second pass exit 0; after revert the plan returned to `6f6ff010e985` and the check passed |
| 2026-10-19 / Claude Code session | `.claude/settings.json` Stop hook | `jq` validation lists both Stop commands; pipe test of the hook command exits 0 with nothing pending. A live Stop event is only proven when a session ends (may need `/hooks` or a restart to load) |
| 2026-10-19 / Claude Code session | `node scripts/data-map.mjs` (support Team flow topology regenerated for the new agents) and `pnpm check` | Exit 0: 205 suites / 1,805 tests; backup 52, migration 27, Supabase deployment 14; `agents:check` 112 agents; `infra:register` ok; `exit:map:check` ok |

## Open and owner-gated

- Hosted backup scheduling, cloud accounts, isolated hosted drill and cutover remain owner decisions (REDUNDANCY-01 gates unchanged).
- Agent definitions do not run by themselves; the Stop hook and CI are the automation. Reviews are recorded when a session performs them.
- Exit B (cloud-native) mappings are design notes; no Cognito / Entra / AppSync / Web PubSub prototype exists.

## Follow-up 2026-10-19 evening — version tracking, same-data proof, production infrastructure (Claude Code session)

Owner asked: the team must know where the current version is; the exit plan must be on the current app version before execution;
the app must work the same and pull the same data; plan cache, load balancer and everything needed to protect and run the migration.

| Delivered (local) | Evidence |
| --- | --- |
| Access parity (`infrastructure/migration/access.sql`, wired into `parity.py fingerprint/compare`): every application table read as anon, three auth users and an admin through RLS; counts + row hashes compared | Unit 29/29; PGlite 14/14 incl. **auth.uid() drift caught only by access parity**; PostgreSQL 18.6 client drill 12/12, 82 identity reads PASS after grant-sync |
| Fingerprints pin `search_path = ''` and `row_security = on` (session state left by pg_restore broke both) | Drill reproductions recorded above |
| `exit-map.json`: 24 tiered components (added network, load balancer, CDN, WAF/DDoS, cache, pooler, DB HA/replicas/PITR, migration replication, DNS/endpoint indirection, operator access, CI/CD, cost guard), production topology, two migration strategies, cutover phases T-30…T+7 with rollback triggers, 11 protection controls, 12-step build order | Generated map plan `14b092e40835`, announced in EXIT_CHANGE_LOG |
| `scripts/exit-map.mjs`: §1 "Where the current version is", app data-surface coverage (178 RPCs, 33 tables, 3 buckets, channels, invokes all exist in schema), `--status` (live commit/source hash/notices/GO-NO-GO), `--record-readiness`, `--preflight` execution gate; `pnpm exit:status`, `pnpm exit:preflight` | Status shows `main @ 2f26caaf1c23` +48 uncommitted, source `99b03be48749814f`, NO-GO with reasons; local-drill readiness recorded |
| **App finding:** guests cannot read `public.rallies` — policy calls `rally_manager_role()`, which anon may not execute after function-access hardening (42501). Development has that hardening since 2026-10-17. Not fixed (SQL is owner-applied); route to RALLY / RLS_SECURITY | Reproduced on canonical schema in PGlite |

**Concurrency stop (22:38 MDT):** Codex session (REDUNDANCY-03, `EXIT_READY_IMPLEMENTATION_PLAN.md`) began editing `scripts/exit-map.mjs`
and `docs/engineering/exit/exit-map.json` and added `scripts/exit-inventory.mjs` (imports `typescript`) while this session was working. Per TEAMS
contract item 10 this session stopped editing those files and asked the owner how to coordinate. Not yet done by this session: GO-path gate
test (blocked by the new import in a node_modules-free copy), runbook §8 step 0 (preflight), charter / agent-duty wording for status and
preflight, STATE §4 line, final `pnpm check`. Claude's claim on `exit-map.mjs` / `exit-map.json` is released to the owner's decision.

## Hierarchy sync receipt — exit reading home (2026-10-23)

**Task:** CTO hierarchy sync for the move of Redundancy & Exit reading documents into `docs/engineering/exit/` (plans under `docs/engineering/exit/plans/`). **Executor:** VP_OPERATIONS, this Cursor session (coordination only; no new role; no claim that EXIT_* or Security specialists ran or approved a release).

**Reporting checked, unchanged:** `ENGINEERING` → `REDUNDANCY_LEAD` → `EXIT_SYNC`, `EXIT_DATABASE`, `EXIT_SERVICES`, `EXIT_CLOUD`. `INFRA_SECURITY`, `SUPPLY_CHAIN_SECURITY`, and `RECOVERY_SECURITY` still report to `SECURITY` (with `RLS_SECURITY`, `SESSION_SECURITY`, `THREAT_DETECTION`). Registry leads match `TEAM_HIERARCHY` and `TEAMS`. Model pins unchanged.

**Files:** reading-home links corrected in `TEAMS.md` (alignment stamp; contract item 13 already pointed at `exit/README`), `TEAM_HIERARCHY.md`, `BACKUP_OPERATIONS.md`, `ENVIRONMENTS_AND_HOSTING.md`, `PORTABILITY.md`, `PORTABLE_INTEGRATIONS.md`, `design/MEDIA_SERVICE_PLAN.md`, and the exit runbooks/charter/plan. Generators `scripts/exit-map.mjs` and `infrastructure/security/report.mjs` now emit links from `docs/engineering/exit/`. Regenerated `EXIT_INFRASTRUCTURE_MAP.md` and `INFRASTRUCTURE_SECURITY_REPORT.md`. Announced content-fingerprint plan `e9e50cf56b87` → `40003df5cd08` in `EXIT_CHANGE_LOG.md` (notice only; named reviewers have not recorded results). `WORK_QUEUE.md`, `EXPERT_STANDARDS.md`, and registry reporting lines needed no lead or path correction. No `docs/engineering/EXIT_*` or `docs/engineering/REDUNDANCY_TEAM.md` paths remain outside the new home.

**Check (2026-10-23):** `pnpm agents:check` — ok, 115 agents; files, ownership paths, reporting graph, and team docs agree. `node scripts/exit-map.mjs --check` — ok, plan `40003df5cd08`. `node infrastructure/security/report.mjs --check` — ok; operational acceptance not established.

**Gaps:** hosted restore and cutover remain unclaimed. The 2026-10-23 exit-map notice is not a review. No provider account, hosted drill, or cutover is authorized by this receipt.

**Next owner:** named reviewers on the 2026-10-23 notice record their own results; `REDUNDANCY_LEAD` keeps hosted drill/cutover with the owner. `CTO` integrates this receipt.

## Documentation execution receipt — exit reading home (2026-10-23)

**Task:** DOCUMENTATION acceptance for the exit reading-home consolidation on `cursor/exit-docs-home-9a86` (VP_OPERATIONS commit `8465db6`). **Executor:** DOCUMENTATION, this Cursor session (`grok-4.7-medium`). This receipt records documentation synchronization only. It does not claim that EXIT_* or Security specialists ran, and it does not claim a hosted restore, drill, or cutover.

**Confirmed:** `docs/README.md` points at `docs/engineering/exit/README.md` as the one exit section (engineering index, two rows, same target). `AGENTS.md`, `docs/agents/TEAMS.md` (contract item 13), and `docs/agents/TEAM_HIERARCHY.md` name that reading home. Generators `scripts/exit-map.mjs` and `infrastructure/security/report.mjs` write `docs/engineering/exit/EXIT_INFRASTRUCTURE_MAP.md` and `docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md`. Runnable `infrastructure/*` trees stayed put, as the reading-home README states.

**Files this pass:** `docs/STATE.md` (Last updated header set to 2026-10-23; new §4 heading, newest first) and `docs/agents/REDUNDANCY-02.md` (this receipt). README, hierarchy, TEAMS, and AGENTS were already updated in `8465db6` and were checked, not rewritten.

**Check (2026-10-23):** `pnpm docs:links` — exit 0. `docs:links ok (326 active Markdown files; local file destinations only)`.

**Gaps:** §4 still holds more than ~15 dated headings; older workstream history was left in place. Link check does not prove exit-map freshness, a hosted drill, or release approval. Hosted restore and cutover remain unclaimed. The 2026-10-23 exit-map notice is still not a review.

**Next owner:** `CTO` integrates this receipt. Named reviewers on the 2026-10-23 notice record their own results. `REDUNDANCY_LEAD` keeps hosted drill/cutover with the owner.

## EXIT_SYNC / INFRA_SECURITY receipt — inventory CI parity (2026-10-23)

**Task:** CI `security:infra report is stale` on the exit reading-home branch while the same commit checked clean locally. **Executor:** this Cursor session (EXIT_SYNC inventory fix + security test path; not a hosted acceptance).

**Cause:** `apps/mobile/expo-env.d.ts` is gitignored and created by local Expo; it was hashed into the exit inventory. GitHub Actions install+typecheck never writes that file, so the committed Infrastructure Security report binding did not match CI. The security CLI fixture still expected the pre-move report path under `docs/engineering/`.

**Fix:** `scripts/exit-inventory.mjs` ignores `expo-env.d.ts` and `coverage/`, and sorts inventory paths with binary order. `infrastructure/security/tests/report.test.mjs` expects `docs/engineering/exit/INFRASTRUCTURE_SECURITY_REPORT.md`. Regenerated map/report; announced plan `52c793b873a3` → `5ca7ffc4ae64`.

**Check (2026-10-23, America/Denver):** `pnpm security:infra:check` ok; `pnpm exit:map:check` ok (plan `5ca7ffc4ae64`); `pnpm security:infra:test` 22/22; setup tests under `umask 077` 12/12. Operational acceptance not established.

**Gaps:** other open PR heads that refreshed the report while `expo-env.d.ts` was present still need the same inventory exclusion (or a regenerate after this fix). Hosted restore/cutover unclaimed.

**Next owner:** `CTO` / PR merge; named reviewers on the new notice.
