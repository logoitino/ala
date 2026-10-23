<!-- REDUNDANCY-01 records actual outside-session work and unverified deployment gates. -->
# REDUNDANCY-01 — Supabase backup and AWS / Azure exit

**Opened:** 2026-10-19. **Accountable lead:** ENGINEERING, with INFRASTRUCTURE / RECOVERY / DATABASE_MIGRATIONS ownership. **Actual executor:** outside-session Codex root and delegated Codex sessions; repository specialist model pins are unchanged. **Status:** local implementation and verification complete; hosted backup, target restore, provisioning and cutover have not run.

## Request and scope

The owner requests an organized executable redundancy plan for `Downloads/ala-sports`, with a full Supabase backup and the ability to move the app onto servers in AWS or Azure. On2026-10-19 the owner explicitly confirmed a backup **of** the existing Supabase project for AWS/Azure restoration. Cloud spend, scheduled hosted jobs and production movement remain concrete operator actions.

Current managed Supabase remains the primary. The recommended exit preserves the Supabase service interfaces by running its compatibility stack on owned cloud infrastructure. Targets, restore compatibility, ongoing operations and native-client cutover must be measured before readiness can be claimed.

## Status and file claims

| Executor | Claimed files / responsibility | Claimed | Status |
| --- | --- | --- | --- |
| Codex documentation session `/root/redundancy_documentation` | This tracker; `docs/engineering/exit/REDUNDANCY_PLAN.md`, `docs/engineering/exit/plans/REDUNDANCY_IMPLEMENTATION_PLAN.md`, `docs/engineering/exit/CLOUD_MIGRATION_RUNBOOK.md` | 2026-10-19 | Documentation complete locally; claims released to root for integration |
| Codex root session | Backup / verify / restore tools and integration; shared README, STATE, CHANGELOG, governance and infrastructure indexes | 2026-10-19 | Local code/docs integration complete; claims released after checks |
| Codex cloud infrastructure session | Container deployment, pinned upstream Supabase bootstrap, AWS and Azure templates | 2026-10-19 | Local implementation and checks complete; claims released |
| Codex independent review `/root/recovery_review` | Read-only QA/Security/Data review of backup, restore, source policy, deployment and documentation | 2026-10-19 | Five concrete findings delivered, fixed and covered by local regression checks; review complete |
| Claude Code session (owner-run, 2026-10-19 evening) | **New files only:** `infrastructure/migration/**` (TOC review proposal + source/target database parity check), plus the `redundancy:test` addition in `package.json`, one CI line, a row in `infrastructure/README.md`, runbook §§ snapshot / 5 / 6–7 additions and two checklist items in the implementation plan. Did not edit `infrastructure/backup/**` | 2026-10-19 | Local implementation and checks complete; claims released |

Do not overwrite another session's dirty edits. This record does not dispatch repository roles or establish continuous paid/background agents.

## Documentation obligation

| Contract | Supplied / reviewed evidence | Next owner |
| --- | --- | --- |
| Portability architecture | Existing managed-primary / self-hosted exit A decision; PostgreSQL alone is insufficient for Auth, API, Storage, Realtime and functions | INFRASTRUCTURE / BACKEND |
| Recovery and data control | Private encrypted DB + Storage + source archive; sensitive Auth/minor/finance data; original audits and retention preserved | RECOVERY / DATA_GOVERNANCE / PRIVACY_ENGINEERING |
| Restore safety | Isolated explicit target; reviewed `pg_restore` TOC; managed service schemas, owner roles and ACLs require compatibility review | DATABASE_MIGRATIONS / RLS_SECURITY |
| Money and external providers | Stripe account state remains external; reconcile snapshot-to-cutover gap; single authoritative payment processor path | COMMERCE / FINANCE_DATA / INTERNAL_CONTROLS |
| Deployment and client move | Same service interfaces; compile-time client URL/key, old installs, sessions and private media are cutover gates | RELEASE / QA / AUTH / STORAGE |
| Operations | Backup schedule and alarms are templates/proposals until installed and observed; one VM is not high availability | RELIABILITY / SUPPORT / COST_OPERATIONS |

## Verification receipts

| Date / executor | Check | Actual result |
| --- | --- | --- |
| 2026-10-19 / Codex documentation session | Read STATE, AGENTS, specialist operating contract, conventions, documentation definition/rule, PORTABILITY, EXIT_DRILL, RECOVERY_RUNBOOK, ENVIRONMENTS_AND_HOSTING and DATA_GOVERNANCE | Reviewed current repository documents; existing full cloud drill remains unperformed |
| 2026-10-19 / Codex documentation session | `node scripts/check-doc-links.mjs`; `check-copy.mjs`; `check-comments.mjs`; `check-agents.mjs`; `sync-front-docs.mjs --check`; `git diff --check` | All exit 0; latest link pass 253 active Markdown files; agents check 107 definitions. Reviewed docs against written CLI/env/timer/bootstrap interfaces |
| 2026-10-19 / Codex documentation session | `python3 infrastructure/backup/doctor.py` | Exit 1: age, pg_dump, pg_restore and psql unavailable; optional Docker, Terraform, AWS/Azure CLIs unavailable. No credentials or providers contacted |
| 2026-10-19 / Codex root | `pnpm check` | Exit0; both typechecks;205mobile suites/1,805tests;13source-capsule tests;18backup tests;14Supabase deployment tests;7Expo host checks; all documentation/governance/infrastructure/security gates pass. Log `/tmp/ala-redundancy-pnpm-check.log` |
| 2026-10-19 / Codex root | Full working-tree source capsule capture, verify and isolated restore | Passed:1,419files,33,707,505bytes,43infrastructure files; temporary preview removed. Source only; no database restore |
| 2026-10-19 / Codex root | Next standalone production build with synthetic public configuration | Exit0; expected `apps/admin-portal/.next/standalone/apps/admin-portal/server.js` exists; no provider data used. Log `/tmp/ala-redundancy-admin-build.log` |
| 2026-10-19 / Codex root | Expo SDK58 production web/API export with synthetic public configuration and actual adapter smoke | Exit0; exported client/server exist; actual host health and fan HTML return200, unauthenticated checkout returns401; host terminated. No provider call. Log `/tmp/ala-redundancy-expo-build.log` |
| 2026-10-19 / independent Codex review + root fixes | Source routing bypass, private-output ancestry, pnpm config recovery, encrypted-file framing, committed-SQL retry | All five local findings fixed: conninfo/PGHOSTADDR rejected; resolved external output ancestry; reviewed npm settings included; age envelope/private inputs enforced; matching commit receipt permits Storage-only resume |
| 2026-10-19 / Claude Code session | `python3 -m unittest discover -s infrastructure/migration/tests` (now in `pnpm redundancy:test`) | 27/27: restore-list rules incl. PG18 `CHECK CONSTRAINT`, second app schema, app attachments on Supabase tables, Auth FK refusal, and the proposed list accepted by `restore.py`'s own `reviewed_list`; compare rules; re-parse normalization; `grant-sync`; outputs refused inside the checkout |
| 2026-10-19 / Claude Code session | `node infrastructure/migration/pglite-parity.mjs` (PGlite 0.5.9, the CI-pinned version; added to the CI replay step) | 13/13: real `schema.sql`, record-text copy passes with zero blocking findings; RLS off, missing/extra policy, new anon grant, lost row, changed row, sequence behind, table dropped from realtime, definer `search_path` reset, disabled trigger and missing migration history each blocked |
| 2026-10-19 / Claude Code session | `node infrastructure/migration/local-drill.mjs` with PostgreSQL 18.6 `psql`/`pg_dump`/`pg_restore` built from the checksum-verified ftp.postgresql.org source, against two PGlite servers via pglite-socket 0.2.13 | 12/12: psql fingerprints (one read-only snapshot) of source, bare target and restored target; custom dump (2,469 TOC entries); proposal refused without Auth rows; list 2,430 kept / 36 excluded / 3 review (`DEFAULT ACL`); `pg_restore` with `restore.py`'s exact flags; raw restore **blocked**: 2,059 anon/authenticated/PUBLIC rights reopened by the stack's default privileges; `grant-sync` (2,599 statements) applied; parity **PASS** 0 blocking / 0 warnings over 114 tables/views, 564 functions, 115 row counts with hashes; one dropped policy blocked. Deviations: native PostgreSQL could not start (System V shared memory blocked by machine policy, also outside the sandbox), so servers are PGlite; the drill dump adds `--inserts` because pglite-socket cannot stream COPY |
| 2026-10-19 / Claude Code session | Findings the real TOC exposed and the tools now handle | PG18 `CHECK CONSTRAINT` entries (21) were unknown and failed closed; `fan_zone_private` is a second application schema (auto-detected now, default scope was `public`); 24 Storage policies, the `on_auth_user_created` signup trigger, two `storage.objects` guards and 3 realtime policies live in Supabase schemas and would have been dropped; `pg_get_expr` output depends on the session `search_path` (fingerprints now pin it empty); dump/restore flattens nested AND chains (compared after same-operator flattening only) |
| 2026-10-19 / Claude Code session | `pnpm check` | Exit 0: 205 mobile suites / 1,805 tests; backup 52, migration 27, Supabase deployment 14, Expo host checks; all documentation/governance/infrastructure/security gates |
| 2026-10-19 / operator | Live backup, decrypt, restore, Auth / RLS / Storage / finance validation, timed AWS or Azure rehearsal | Not run |
| 2026-10-19 / independent Codex review `/root/recovery_review` | Final source review of all five fixes and seven independent PostgreSQL input checks | All five findings closed; no remaining concrete finding in reviewed scope. Live encryption, database restore and cloud interoperability remain unverified |

## Acceptance and unresolved gates

Local handoff requires the runnable tools, cloud/container structure, operator commands, safety boundaries, generated indexes and actual test receipts. Operational readiness additionally requires independently stored encrypted backup copies, protected key custody, a monitored six-hour schedule with completed independent copies, a successful isolated restore with the actual deployed versions, accepted RPO/RTO, and an approved migration-window/client plan.

The upstream lock remains unresolved (offline verification gap); bootstrap requires an independently reviewed actual commit/archive SHA-256 and explicit images. RPO is a proposed six-hour interval plus capture/upload lag; RTO is a proposed eight hours, both unmeasured. The optional timer is not installed. Its service now invokes the full capture/all-destination upload job; alert delivery must be wired separately and remote retrieval/restore remains independent proof.

Next accountable owners: INFRASTRUCTURE and RECOVERY prepare the isolated drill; DATABASE_MIGRATIONS and RLS_SECURITY accept the target schema/ACL list; Finance reconciles real transactions; QA / RELEASE validate the installed-client and endpoint move. The owner decides cloud/provider/region, spend, actual hosted data movement and cutover after that reviewable evidence.

## Continuation — executable backup operations (2026-10-19)

Owner asked to continue the build. Adopted one strict private-config job that captures once, attempts every configured destination and advances success only after complete publication. Config fingerprints bind target accounting; exclusive locks and atomic files retain prior success through partial failures. Guarded archive retries keep original capture time and can reuse exact protected matching publication receipts. Added a no-provider-contact health CLI and protected-original-checksum AWS/Azure retrieval into a new private directory. Source examples, bounded evidence exports, partial detection declaration and generated indexes are updated.

| Actual executor | Ownership / result |
| --- | --- |
| Codex root `/root` | `status.py`, `fetch.py`, unique publication receipt filenames, source policy/tests, governance/sensor inventory, package commands and shared indexes/status. Local full gate passes; monitor CLI and isolated source restore pass; claims released. |
| Codex worker `/root/cloud_deployment` | `job.py`, strict example config, job regression tests and service. Publication retry correction complete;18job tests pass; claims released. No provider commands or service activation. |
| Codex documentation `/root/redundancy_documentation` | Backup operations guide and matching architecture/runbook/checklist interfaces. Docs/link/copy/whitespace checks pass; independent semantic review accepted; claims released. |
| Independent Codex reviewer `/root/recovery_review` | Found inconsistent terminal monitor records, insecure evidence directory and Azure same-archive retry trap. All three operations findings closed after fixes; narrow source-guide inclusion exception also independently accepted; review claims released. |

| Continuation verification / actual executor | Result |
| --- | --- |
| Codex root — `pnpm check` | Exit0;205mobile suites/1,805tests;13source recovery tests;52backup tests (18original +18job +16operations);14Supabase deployment tests;7Expo host checks; all typecheck/documentation/governance/security/infrastructure gates. Log `/tmp/ala-redundancy-operations-check.log`. Cloud responses/capture in regression tests are synthetic. |
| Codex root — actual monitor CLI with private synthetic config/state | Fresh complete state exit0; old snapshot uploaded recently, missing success and public state directory exit2; public config exit3. No provider calls/credential files opened; temporary records removed. |
| Codex root — actual source capsule capture, verify and isolated restore | Passed1,429files/33,846,961bytes/52infrastructure files at capture; explicitly confirmed job/monitor/fetch/config/service and operations guide in restored source. Temporary package/preview removed. Source-only restore. |
| Independent Codex reviewer — operations and source policy | Three operations findings closed; exact guide-only policy exception preserves private archive/export/credential exclusions; no remaining concrete finding in reviewed scope. |
| Codex documentation session — own final checks | Docs/link/copy/whitespace checks exit0;258active Markdown files; guide/README interfaces independently accepted. |

The actual source probe first caught the operations guide being excluded by the backup-filename filter. A reviewed exact-path terminal-segment exception and regression fixture now include that guide while private backup/export formats remain excluded. Final gate was repeated after this source-policy correction.

Live encryption/export/upload, remote fetch/decrypt, isolated database/Auth/MFA/Storage/finance restore, actual provider validation, upstream pins, scheduler/incident delivery and measured RPO/RTO remain unperformed. Next owners and activation gates above still apply.
