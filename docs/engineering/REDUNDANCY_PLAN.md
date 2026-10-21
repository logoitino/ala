<!-- INFRASTRUCTURE / RECOVERY architecture: distinguish executable local preparation from a proven hosted recovery service. -->
# Supabase redundancy and owned-server plan

**Task:** [REDUNDANCY-01](../agents/REDUNDANCY-01.md). **Prepared:** 2026-10-19. **Owners:** INFRASTRUCTURE, RECOVERY and DATABASE_MIGRATIONS, reporting to ENGINEERING. **Status:** local backup/deployment implementation; no cloud provisioning, hosted backup or database cutover has run.

## 1. The outcome

Keep managed Supabase as the current primary, retain encrypted independent recovery copies, and prepare an isolated self-hosted Supabase installation on AWS or Azure. The app retains PostgreSQL, PostgREST, Auth, Realtime, Storage and Edge Function interfaces. PostgreSQL plus a VM does not replace those services by itself.

The owner confirmed on 2026-10-19 that the requirement is a backup **of** Supabase: application data, Auth data, Storage metadata and file contents, versioned source, dependency locks and migration inventory. Another managed Supabase project is an optional recovery destination; it needs its own service-schema restore review and project configuration.

This implements the existing exit A decision in [PORTABILITY](PORTABILITY.md). Current development and staging project differences remain in [ENVIRONMENTS_AND_HOSTING](ENVIRONMENTS_AND_HOSTING.md); production has not been created. This work does not make the current testing app a production service.

## 2. Deployment options

| Option | What runs | Operational effect | Decision |
| --- | --- | --- | --- |
| Managed primary + independent encrypted backups | Current Supabase; encrypted recovery archives copied into separately protected object stores | Smallest immediate change; recoverability depends on successful restore drills and available key custody | Start here |
| Self-hosted Supabase on AWS | Full pinned Supabase service stack on EC2; containers for Next admin and Expo web/API; durable disks; encrypted backup copy outside the VM | Same app service interfaces; our team owns upgrades, patches, TLS, monitoring, disaster recovery and capacity | Recommended compatible AWS exit |
| Self-hosted Supabase on Azure | Same stack on a Linux VM; same app containers and recovery tools; Azure disk and object storage equivalents | Same responsibilities and application interfaces as AWS | Equivalent Azure exit |
| AWS RDS / Aurora or Azure Database for PostgreSQL plus replacement services | Managed Postgres with independently operated Auth/API/Realtime/Storage/functions | New compatibility project: extensions, roles, triggers, token claims, service schemas and the app adapters require review | Later exit B; these templates do not provision this system |
| Second managed Supabase project | Separate service-managed target restored from reviewed compatible data and independent files | Same provider dependence; cannot treat project IDs, signing keys or service schemas as interchangeable | Optional destination; not active replication |

No upstream Supabase commit or container pin was fabricated: `infrastructure/supabase/upstream.lock.json` records an unresolved offline pin. An operator must provide an independently verified upstream commit/archive SHA-256 and reviewed versioned images before bootstrap/startup.

The initial owned-server design is **one VM**. It provides an executable deployment starting point and a recovery target, not high availability. A later availability project must design database replication/promotion, redundant gateways, service state, object storage, backups and failure tests across zones. Running AWS and Azure copies concurrently does not establish safe active-active writes.

## 3. Recovery components and boundaries

| Component | In encrypted archive | Restore / remaining obligation |
| --- | --- | --- |
| PostgreSQL | Full custom-format `pg_dump` archive, including application data and accessible `auth` / `storage` metadata; TOC, PostgreSQL version and catalog evidence | Full dump creation requires a role allowed to read the required schemas. Target import uses a reviewed TOC; roles, service versions, extensions and managed ownership require separate compatibility work |
| Storage | Every bucket discovered through the Storage API; recursively paginated object bytes and SHA-256 manifest | Copy original keys/content types into the target through Storage APIs; verify private access rules and metadata. DB dump alone does not contain file bytes |
| Source / runtime code | Existing source recovery capsule with metadata, locks, schema and migration hashes; deployment/backup source belongs in its reviewed source policy | Verify and restore into a separate source preview, build locked dependencies, inspect uncommitted provenance and compare actual deployed migration inventory |
| Provider configuration / secrets | Optional operator-supplied `custody.json` inside encryption | Inventory required values and evidence before backup. Database exports do not export project API keys, signing keys, SMTP, OAuth providers/redirects, Edge secrets, webhooks or DNS |
| Auth users / passwords / MFA | Accessible Auth database rows may carry credentials and identity metadata | Same GoTrue schema/version, encryption keys, provider config and Auth triggers must be reviewed; restoring users is not proof existing tokens or refresh sessions remain valid |
| Independent custody | Encrypted archive and adjacent checksum copied to at least two protected locations | Age private key must remain outside those archive stores; retain an independently trusted manifest/reference. A checksum is integrity evidence, not signer identity |
| Stripe / Expo / Apple / Google / external video | Repository integration source and optional configuration inventory only | Provider accounts, money records, issued binaries, signing identities, EAS updates and provider-hosted media stay external; arrange separate access, retention and provider-specific exports |

Auth records, Storage bytes, financial and minor/guardian records are sensitive. Keep plaintext staging private, encrypt before publishing an archive, exclude all archives and credentials from Git, and log only bounded outcome metadata. Register the backup export's owner and purpose under [DATA_GOVERNANCE](DATA_GOVERNANCE.md). Retention and regional copies need PRIVACY_ENGINEERING review; stale snapshots can reintroduce deletions and consent state.

## 4. Proposed recovery targets

These are **unmeasured proposals**, subject to the first complete timed drill and owner acceptance.

| Measure | Initial proposal | How to prove it |
| --- | --- | --- |
| RPO — acceptable data loss | Six-hour schedule plus capture/upload lag | Observe jobs at 00:00 / 06:00 / 12:00 / 18:00 UTC (up to five minutes jitter), completion/copy lag and independent receipts; finance reconciles transactions after the snapshot |
| RTO — prepared owned-cloud switch | Owner target2–3hours; unproved | Full warm-target rehearsal≤180minutes with final capture, restore, service/Auth/client/finance acceptance and rollback; [EXIT_READY_RUNBOOK](EXIT_READY_RUNBOOK.md) |
| Cold recovery | Earlier8-hour proposal; unproved | Includes infrastructure/image/source preparation; measure separately, never infer the warm-switch target from this estimate |
| Retention | 14 daily + 8 weekly + 12 monthly archives | Storage lifecycle and manual expiry evidence; legal/privacy retention decision needed |
| Drill cadence | Monthly archive/decrypt/integrity; quarterly isolated full restore | Record actual duration, source/target versions, object counts, Auth/RLS checks and remediation owner |
| Copies | Working recovery copy plus an independent encrypted copy in another cloud/account | Read and decrypt a sampled archive from each copy; independence includes admin credentials and encryption-key custody |

A six-hour dump schedule is not point-in-time recovery. Supabase PITR, or a later self-hosted WAL archive plus tested base-backup restore, is a separate mechanism. No six-hour RPO claim is valid until the unified capture/all-destination job and timer are installed and observed. The local status command checks original capture age (default seven hours), incomplete/failed accounting and overdue runs (default two hours). Local command-success records are not proof of remote integrity; retrieval/decryption/restore and installed alert delivery remain separate. See [BACKUP_OPERATIONS](BACKUP_OPERATIONS.md).

## 5. Database and file consistency

`pg_dump` takes a consistent PostgreSQL snapshot. Storage bytes are fetched over time. An `online` backup therefore has separate DB and file observation windows: uploads/deletions/overwrites can make those sets disagree. Counts and hashes prove copied bytes, not atomic correspondence with the dump.

For a cutover snapshot use a staffed write-freeze: stop app/admin/worker writes, uploads/deletions, money intake and any external webhook or scheduled writer; wait for in-flight activity to drain; record the last provider event/transaction cursor. Then create a `quiesced` backup with an operator evidence reference. The tool records that reference; it cannot prove a global freeze. Only reopen after consistency, finance and access review. Do not disable webhook intake in a way that loses provider events; queue/reconcile them through the approved provider procedure.

Scheduled online snapshots improve recovery coverage. They do not replace the final freeze and file-to-row reconciliation needed for migration. If a consistent recovery point cannot be proved, record the missing objects/transactions and stop the cutover.

## 6. Folder organization

Keep app source in its existing monorepo folders; deployment belongs in `infrastructure/` so engineers can build either cloud without moving app files.

```text
apps/mobile/                         Expo app and its Node API routes
apps/admin-portal/                   Next read-only admin portal
packages/shared-types/               Shared contracts
supabase/                            Canonical migrations, SQL, functions
infrastructure/
  backup/                            Capture/publish job, status, fetch, restore, config and units
  exit/                              Exact source release, image archives and readiness evidence gate
  migration/                         TOC, database/access parity and historical Storage ownership plan
  containers/                        App container builds and Compose configuration
  supabase/                          Reviewed upstream bootstrap/configuration and lock
  terraform/aws/                     AWS VM/network/disk/backup-store templates
  terraform/azure/                   Azure equivalents

docs/engineering/REDUNDANCY_PLAN.md   This architecture and limits
docs/engineering/design/
  REDUNDANCY_IMPLEMENTATION_PLAN.md   Ordered implementation and acceptance
docs/engineering/
  CLOUD_MIGRATION_RUNBOOK.md          Commands, rehearsal and cutover procedure
```

Private runtime material belongs outside the checkout: `/etc/tapuai/` for operator config/keys, `/var/lib/tapuai/backups/` for encrypted archives, `/var/lib/tapuai/restore-drills/` for private decrypted rehearsal stages, and `/opt/tapuai/supabase/` for downloaded pinned upstream deployment files. Terraform state is private and remote before shared operation; never put credentials into `.tfvars` or checked-in Compose files.

## 7. Recovery versus cutover

The unified job captures once and attempts all private configured destinations, with fingerprinted config, a process lock and atomic records. Retrying an existing archive preserves original capture age and may safely reuse an exactly matching protected success receipt. `status.py` reports local freshness/accounting (exit 0/2/3); `fetch.py` verifies retrieved ciphertext against an independently protected original digest. None of those local records replace a remote readback or restore drill.

Backup verification confirms archive integrity and source inclusion. Target restoration additionally needs a compatible Supabase stack, reviewed database selection and restored Storage. A safe service move additionally needs:

- Actual source and target versions, migrations, extensions, roles, functions, triggers, ACL/default-privilege and Realtime publication review. Never blindly overwrite Supabase's internal service schemas or bypass warnings.
- OAuth callback/redirects, SMTP, keys/JWKS, API routing, webhook settings, object access and private-media policy tests.
- Rebuilt app/API and Next services with target environment; old installed mobile builds retain compiled URLs/keys. Existing sessions/offline queues must be addressed, and incompatible builds must be blocked by a reviewed release plan.
- Provider-neutral media reader completion and tests for legacy Supabase URLs, avatars, logos, stories, Vault/private clips and current uploads. Reference-writing remains under the existing expand/contract gate in PORTABILITY.
- Financial snapshot-gap reconciliation and one authoritative payment/writer path. Existing testing/webhook/payout gates remain in force.
- Measured recovery time, independent QA approval, operational ownership and owner-authorized production window.

The exact operator workflow is [CLOUD_MIGRATION_RUNBOOK](CLOUD_MIGRATION_RUNBOOK.md); the synthetic cloud drill remains aligned with [EXIT_DRILL](EXIT_DRILL.md). The original [RECOVERY_RUNBOOK](RECOVERY_RUNBOOK.md) retains source rollback and live-ledger safeguards.

The latest owner request is implemented in [EXIT_READY_RUNBOOK](EXIT_READY_RUNBOOK.md): exact
expanded source copies, content-sensitive changes, immutable runtime archives, original
database/Storage evidence and release-bound acceptance. A new source version invalidates
old evidence; hosted changes also require fresh read-only capture and custody review.
