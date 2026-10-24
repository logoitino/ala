<!-- ENGINEERING implementation checklist: proposed operational checkpoints require actual local and hosted receipts. -->
# Redundancy implementation plan — REDUNDANCY-01

**Prepared:** 2026-10-19. **Architecture:** [REDUNDANCY_PLAN](../REDUNDANCY_PLAN.md). **Execution record:** [REDUNDANCY-01](../../../agents/REDUNDANCY-01.md). **Operator workflow:** [CLOUD_MIGRATION_RUNBOOK](../CLOUD_MIGRATION_RUNBOOK.md).

## 1. Baseline and alternatives

The observed gap is a source-only recovery workflow plus an unperformed full cloud exit drill. The current app relies on Supabase database, Auth, REST API, Realtime, Storage and Edge Functions; changing the database host alone does not restore a working service. Managed-project configuration, credentials, Stripe account data and installed mobile builds are outside database backup scope.

The selected local approach prepares encrypted full database/file/source archives and the same Supabase service interfaces on owned AWS/Azure servers. Alternatives are a second managed Supabase recovery project or a different managed PostgreSQL/provider stack. The latter requires a separate replacement-service and application-adapter project. Cost savings and recovery time are unknown until measured.

**Bounded experiment:** produce an archive from synthetic source services, verify its encryption/path/hash behavior, create a private restore stage, inspect a reviewed database TOC, and prepare a synthetic compatible target. Success means complete discovered-file accounting, fail-closed restore selection and measured functional recovery. Stop if secrets escape private custody, source/target identity cannot be proved, writes are not isolated, finance consistency fails, or a provisioned drill exceeds approved cost.

## 2. Ownership and review

| Area | Accountable owner | Required evidence / reviewer |
| --- | --- | --- |
| Backup exports / Storage inventory | RECOVERY / STORAGE | DATA_GOVERNANCE + PRIVACY_ENGINEERING scope/retention review; complete bucket/object accounting |
| Database dump / restore compatibility | DATABASE_MIGRATIONS | BACKEND + RLS_SECURITY inspect versions, roles, TOC, ACLs, triggers and negative access readback |
| Secrets / archive / permissions | SECURITY | Encrypted archives, private staging, protected age key, archive path rejection and sensitive-log review |
| AWS / Azure / containers | INFRASTRUCTURE | RELIABILITY / COST_OPERATIONS local validation, version pin, explicit state/cost/region ownership |
| Money after snapshot | COMMERCE / FINANCE_DATA | INTERNAL_CONTROLS reconciles provider events, ledgers and current crediting/payout gates |
| Installed app / service move | RELEASE / AUTH / STORAGE | QA sign-in/session/offline behavior, old builds, media, API and Realtime against target |
| Documentation / integration | DOCUMENTATION function performed by named Codex session | Root integrates indexes/STATE/history/governance; actual check results in task record |

No new fan/admin product capability or database table is introduced by this infrastructure preparation. A future recovery dashboard, hosted scheduler control or automatic repair capability needs its own admin-first enrollment and operational-source review.

## 3. Local implementation checklist

Checked items below are local implementation and synthetic-test receipts only. Unchecked items require the real database, Docker, cloud or operational rehearsal; a checked item is not hosted readiness. The task tracker records exact checks and gaps.

### A. Structured deployment source

- [x] Keep mobile/admin/shared packages in place; add a dedicated `infrastructure/` entry point with backup, app container, Supabase and cloud directories.
- [x] Provide reviewed non-secret examples, explicit secret paths and required pin inputs; the real upstream/image pins remain unverified and launch has no mutable default. Services enter the infrastructure registry.
- [x] Include the new infrastructure source and templates in the existing recovery capsule's reviewed source policy. Test that generated credentials, `.env`, state, archives, keys and upstream runtime contents stay excluded.
- [x] Keep generated indexes synchronized: docs index, infrastructure register, data ownership / master map and relevant state/history.

### B. Full backup tool

- [x] Use PostgreSQL standard credential providers (`PGPASSFILE`, `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPORT`, `PGSSLMODE`); no plaintext password arguments or source-tree credentials.
- [ ] Produce a full custom-format database archive with TOC/version/catalog evidence; abort on failed or partial export.
- [ ] Discover every Storage bucket and recursively paginate all object prefixes. Copy bytes through private service-authorized API access; record keys, size, content type and SHA-256.
- [ ] Treat listing/download errors as backup failure; do not substitute empty/zero for unread source. Test pagination, nested names, Unicode, private buckets and failures.
- [ ] Create and validate the existing source capsule plus metadata; include schema/migration hashes and dependency locks. Concurrent source changes must invalidate proof when full code verification is requested.
- [ ] Optionally include operator-supplied recovery custody material only inside encrypted output. Record missing secrets/provider-config evidence explicitly.
- [ ] Encrypt with age public recipients; retain archive checksum and bounded metadata; remove temporary plaintext on failure/completion.
- [x] Record `online` observation windows or explicit `quiesced` operator evidence. Do not advertise an atomic DB/file snapshot from API scans.

### C. Verification and safe restore

- [ ] Decrypt using an independently held identity file; require a new private destination; reject corrupt, unexpected, duplicate, traversing or link archive entries.
- [ ] Verify full manifest/size/hash/object accounting and the source capsule before admitting a restore stage.
- [x] Require explicit source-versus-target URL and database connection-tuple distinction, target-host acknowledgement, and `--execute` for mutations. Reject libpq connection strings and routing overrides.
- [x] Require a selected reviewed `pg_restore` TOC. Refuse modified/unknown list entries; operator selection defines the reviewed schemas. Actual target function/ACL/default-privilege acceptance remains an operational gate.
- [x] Ensure actual selected tables, dependent functions and constraints are present in the compatible target; no silent owner/role/extension suppression. Local: `infrastructure/migration/toc_review.py` drafts the reviewed list from the real TOC and refuses one missing any source table/rows or Auth rows that public foreign keys need; `parity.py compare` blocks any structural, security, sequence, realtime, migration-history or row-hash difference. Real `pg_dump`/`pg_restore`/`psql` 18.6 drill against PGlite servers: 12/12 (no hosted target).
- [x] Close the default-privilege gap after restore: a Supabase stack's default privileges re-grant what the source revoked (2,059 anon/authenticated/PUBLIC rights in the local drill). `parity.py grant-sync` writes reviewable privilege-only SQL; parity PASS required afterwards.
- [ ] Require independent review before importing Auth data/service metadata; preserve profile UUIDs and inspect signup triggers and FK ordering.
- [ ] Restore file bytes through Storage APIs with original paths and content types; handle retry/upsert as an explicit isolated-target operation; verify target manifests and access policies.
- [ ] Restore into an isolated target with outgoing email, public traffic and real payments disabled. A successful DB import must not be described as a completed functional restore.

### D. App and Supabase deployment

- [x] Build the Next standalone portal and Expo web/Node API locally with synthetic public configuration. Expected standalone path exists; actual Expo adapter serves HTML and refuses unauthenticated checkout. Docker image builds remain unrun.
- [x] Preserve the Next portal's read-only oversight and Expo `/admin` write ownership.
- [ ] Fetch an exact pinned upstream Supabase commit/version into a separate runtime destination; refuse mutable/latest references and unexpected existing contents.
- [ ] Version and inventory PostgreSQL, Auth, REST, Realtime, Storage, gateway and Edge runtime images; test Docker Compose configuration with placeholder secrets.
- [x] Provide Linux AWS/Azure Terraform foundations: bounded inbound network, durable disks and encrypted backup object storage; explain private state and credential provisioning.
- [ ] Keep Studio/admin/database ports private. Set TLS, allowed origins, OAuth and mail before any public target use.
- [ ] Copy/bind the repo's real Edge Functions and shared money core; declare any manual compatibility/deployment steps and dependencies.

### E. Unified operations and evidence

Local implementation provides `job.py`, strict private config, status and retrieval tools. Check actual
test receipts before marking the following accepted; hosted installation/identity/alerts remain separate.

- [x] Provide an operator-installable schedule template and bounded logs; installation is explicit. No scheduler is claimed active from source alone.
- [ ] Check local freshness/accounting with `status.py` exits 0 healthy / 2 unhealthy / 3 invalid setup; default original capture age seven hours and running-attempt limit two hours. Fail closed on stale/missing/insecure/malformed/changed-config/failing evidence.
- [ ] Install/test alert delivery and named response owners for monitor/job failures; local status does not contact providers or activate delivery. Review disk/restore-age signals separately.
- [ ] Publish completed encrypted archives plus checksums to another cloud/account. Configure lifecycle/immutability where approved; retain independent identities, age-key custody and independently protected original digest.
- [ ] Fetch with a separate reader and mandatory protected original SHA-256; reject replacing original provenance with a fetched sidecar. Follow ciphertext retrieval with decryption and isolated functional restore.
- [x] Document cleanup of private plaintext restore stages and VM/disks after drills; do not run deletion on live resources.
- [x] Execute `pnpm check`,13source recovery tests,18backup tests,14deployment tests,7Expo host checks and a full1,419-file source restore. Record missing real Docker/Terraform/provider checks and unverified upstream pins.

## 4. Isolated hosted rehearsal — separate execution

1. Inventory the actual source project's deployed migration list and versions. Resolve E1 baseline/history differences through DATABASE_MIGRATIONS before treating repo migrations as its full hosted history.
2. Owner approves an isolated AWS/Azure target, region, cost and whether real data is permitted. [EXIT_DRILL](../EXIT_DRILL.md) remains synthetic-only; handling real sensitive backup data is a distinct reviewed restore exercise.
3. Freeze only the synthetic source for the first consistency drill; produce an archive and protected config custody inventory.
4. Retrieve independently stored archive/identity, verify into private stage and inspect source versus deployed hashes.
5. Start pinned target Supabase; select a version/ownership-compatible reviewed TOC; import data and file contents.
6. Restore required providers/secrets from approved custody; test email/OAuth/MFA/session and private-media flows without external side effects.
7. Run `parity.py grant-sync` then `parity.py compare` (must PASS) and compare file inventory; run RLS denial, auth trigger, API, upload/private fetch and Realtime smoke checks. Validate finance against synthetic provider fixtures first.
8. Build app services against target; test an installed supported client and an old client; record rebuild/update and logout decisions.
9. Record complete elapsed time, payload sizes, throughput, failures, operator hours and actual cloud bill. Accept or revise RPO/RTO; remove drill resources through the approved cleanup procedure.

## 5. Production decision checkpoint

Do not label the system “full recovery ready” until the actual project backup has completed, two protected copies can be restored, compatible target services work, restore permissions are reviewed and RPO/RTO is measured. The later migration packet must include final write-freeze and provider-event reconciliation, DNS/client releases, old-install/session/offline handling, support staffing, monitoring, rollback point and owner approval.

**Adopt / revise / stop record:** the initial architecture is prepared for local implementation. Adopted operational readiness, cloud/provider selection and production migration decisions remain pending measured rehearsal and domain review. Known gaps are explicit in [REDUNDANCY-01](../../../agents/REDUNDANCY-01.md).
