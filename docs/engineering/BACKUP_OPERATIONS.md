<!-- RECOVERY / RELIABILITY operator procedure: installing jobs, identities and alert delivery remains an explicit hosted action. -->
# Backup operations — capture, publish, monitor and retrieve

**Prepared:** 2026-10-19. **Task:** [REDUNDANCY-01](../agents/REDUNDANCY-01.md). **Owners:** RECOVERY / RELIABILITY / INFRASTRUCTURE; SECURITY protects key and identity custody. **Status:** local implementation and operator procedure. No scheduler, credentials, cloud job or alert delivery has been activated by this documentation task.

The operations layer runs **one encrypted capture and every configured destination** in one job. Its private records support a local freshness check. Cloud retrieval, decryption, database/file restore and functional acceptance remain separate measured operations; provider-command success or a green freshness check is not remote integrity or recovery proof.

## 1. Install private operator configuration

Install reviewed source under `/opt/tapuai/ala-sports`, with Python 3.10+, Node 24, age, PostgreSQL tools matching the source, and the AWS/Azure CLIs needed by configured destinations. Run the credential-free prerequisite report first:

```sh
python3 infrastructure/backup/doctor.py
```

Provision a dedicated `tapuai-backup` OS user/group. The operator creates private directories and files accessible to that account; the procedure below is prepared guidance, not an executed installation.

| Path | Contents / access |
| --- | --- |
| `/etc/tapuai/backup-job.json` | Private job config copied from [job.config.example.json](../../infrastructure/backup/job.config.example.json); mode 600, owned/readable by the service user |
| `/etc/tapuai/backup.env` | Source DB fields and Storage service-role credentials; mode 600; `PGPASSFILE` points at a private password file |
| `/etc/tapuai/recipients.txt` | Age public recipients; mode 600; private age identity is held on the separate recovery machine |
| `/etc/tapuai/recovery-custody.json` | Optional reviewed provider/config/secret custody to include inside archive encryption; mode 600 |
| `/var/lib/tapuai/backups/` | Encrypted archives, checksum sidecars and publication receipts; mode 700 |
| `/var/lib/tapuai/backup-status/` | Lock, run records, latest attempt and latest complete success; mode 700, separate from archives |
| `/var/lib/tapuai/cloud-cli/` | Optional private CLI credential/token/config state outside home; mode 700, owned by the service user |

The config is strict JSON data, not shell commands. Version must be `1`; unattended consistency must be `online`; paths must be absolute and outside the checkout; config/input files must be private regular files. Replace every example destination, key ARN and path with reviewed values. Remove `custody_file` if optional custody is not prepared.

Configure one to sixteen destinations with unique lowercase IDs. AWS destinations use `s3://BUCKET/backups[/prefix]` and an explicit reviewed KMS key ARN; Azure destinations use the reviewed account/container. Exact duplicate targets are rejected. Distinct config entries do not prove different clouds/accounts, credential isolation or storage retention: INFRASTRUCTURE/SECURITY reviews that independence.

Obtain AWS's KMS ARN from the reviewed infrastructure output, and grant the service identity only the required upload/KMS use. Use dedicated writers without deletion access, approved versioning/retention, and a separate recovery reader with required read/decrypt access. Cloud identity and age decryption custody have different purposes.

### Prepare private local templates and inspect health

The optional `pnpm exit:setup` helper creates a **new** private external configuration folder, rather than
installing the server paths above. Use an existing owned private source cache and set `TAPUAI_SOURCE_ORIGIN`
to the reviewed public Supabase HTTPS origin:

```sh
TAPUAI_BACKUP_SETUP=/private/operator/new-backup-setup
pnpm exit:setup --output-dir "$TAPUAI_BACKUP_SETUP" --source-url "$TAPUAI_SOURCE_ORIGIN" \
  --source-state-dir "$TAPUAI_EXIT_STATE" --source-target-id local-source
pnpm exit:health --config-file "$TAPUAI_BACKUP_SETUP/config/health.json"
```

Define `TAPUAI_EXIT_STATE` as the existing cache's absolute path before running. The helper creates private
`config/backup.env`, `config/backup-job.json`, `config/health.json`, empty `credentials/recipients.txt`,
`credentials/source.pgpass.example`, instructions and an original setup manifest. Backup/status folders start
empty. Credentials and recipients are blank, destinations are `[]`, and readiness is `null`. The actual
password file/private age identity are not generated; no tools are installed and no job/provider is started.
Original template integrity does not establish credential correctness or backup freshness. Complete reviewed
private credentials, source TLS, independently held age custody and provider destinations before running `job.py`.

`exit:health` is read-only: it combines separate source/map/code/watcher/scan observations, backup records
and source binding, local tool presence and the strict prepared-evidence gate. Default source scan age is
120 seconds; future times fail. Backup defaults remain seven-hour capture/two-hour running attempt.
The configured backup API origin must match `source.expectedSupabaseUrl`. Health also compares only
`EXPO_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` and any declared server `SUPABASE_URL` override
from both apps' standard `.env` / `.env.local` /
development / production / test files and their `.local` variants, plus process inputs; optional `export KEY=`
syntax is accepted. Both apps require observed origins, and every declaration must match; missing, conflicting,
duplicate, linked or invalid inputs fail without exposing keys, expanding dotenv or copying private files.
Prepared evidence must also bind the same source version/target and carry validated original `sourceBinding`:
its Supabase URL must match the expected origin, and `PGHOST` / `PGPORT` / `PGDATABASE` must match the
current backup source. Without a config, backup and
prepared evidence report not configured. Exit `0` means accepted preparation observations, `2` means NO-GO
missing/stale/incomplete observations, and `3` means invalid private health config. The report always retains
`readyToCutOver: false`; it neither fetches remote data nor proves restore/cutover acceptance. See
[EXIT_READY_RUNBOOK](exit/EXIT_READY_RUNBOOK.md) for source and final readiness steps.

**Observed setup (2026-10-20):** the private folder
`/Users/seiuliian/Downloads/ala-sports-backup-setup-20261020` was created and template integrity passed.
No live capture, provider upload or service activation occurred. Its health command exited `2` / NO-GO:
backup settings are intentionally incomplete, prepared evidence is absent, and `pg_dump`, `pg_restore`,
`psql`, `age` and Docker are missing. Active local source-watcher liveness does not complete these gates.

### Cloud identities and the service sandbox

Prefer cloud managed/workload identity where available. The service runs as `tapuai-backup` with `ProtectHome=true`; a developer's interactive login/cache under their home is not the service's identity. The operator must authenticate the actual service user and test each destination under the same service environment.

If external CLI files/token state are required, prepare optional `/etc/tapuai/cloud-cli.env` as private configuration data. Example **path names only**:

```dotenv
AWS_CONFIG_FILE=/etc/tapuai/aws-config
AWS_SHARED_CREDENTIALS_FILE=/etc/tapuai/aws-credentials
AZURE_CONFIG_DIR=/var/lib/tapuai/cloud-cli/azure
```

Keep credentials in the protected files or managed identity system, never in Git or job/status output. Protect the AWS files with mode 600 and the Azure state directory with mode 700; give access only to the correct service account. The optional environment file is loaded by the service; required CLI state must fit its configured writable paths. Do not weaken `ProtectHome` to reuse an engineer's cache. A config file or role grant is not evidence of a successful unattended authentication test.

## 2. Run one capture and all publications

After credential/custody/destination review, the operator runs:

```sh
python3 infrastructure/backup/job.py \
  --config-file /etc/tapuai/backup-job.json
```

The job validates config, takes a nonblocking exclusive lock, creates a new encrypted backup and attempts **every** destination. A destination failure does not suppress attempts to the remaining destinations. Overall success requires successful publication accounting for all required entries. Backup failure stops before publication; partial cloud publication remains a failed overall attempt.

The lock uses OS `flock`; concurrent runs fail with a bounded error. Closing the process releases the lock, so leftover lock/PID text does not require deletion. Avoid overlapping manual/timer jobs and investigate `job-lock-busy` before retrying.

The job fingerprints canonical raw config so an old success cannot silently cover changed destinations/settings.
It also records a canonical nonsecret source binding: Supabase API origin and explicit database host, port,
database and user, plus its hash. The monitor rereads the active private environment as data: changing the
source at the same environment-file path cannot reuse the old success. Legacy records without original
source-binding evidence are unhealthy and require a new actual capture; credentials are not copied or hashed
into this binding. Alternate libpq routing overrides are refused because they could change the effective target.
The job atomically writes private `runs/ID.json`, `latest-attempt.json` and, only after all required publications
succeed, `latest-success.json`. Readers see complete JSON files; separate files can briefly represent different
moments, which the monitor treats conservatively. A failure does not erase the previous successful record.

Record fields include config fingerprint, run ID, start/finish, original archive capture time/name/hash, required destination accounting and bounded error codes. Detailed records remain private. Console output uses bounded status/error fields and does not dump credential config or provider diagnostics. Protect these files against modification; hashes and local state do not provide signed provenance.

## 3. Retry publication without another capture

If capture succeeded and one destination failed, use the exact already-created archive from the private run record:

```sh
python3 infrastructure/backup/job.py \
  --config-file /etc/tapuai/backup-job.json \
  --archive /var/lib/tapuai/backups/tapuai-TIMESTAMP-ID.tar.age
```

Replace the filename with the actual generated timestamp/ID. The job validates the encrypted age envelope and matching original checksum, then retries the required publications. It preserves **original capture time**: re-uploading old data cannot refresh its recovery age. A changed active config requires accounting for the new destination set.

Retry also requires the protected original **job-created capture record** matching the exact archive path,
bytes/hash and current source binding. A standalone/legacy archive or a record for another API/database cannot
be assigned today's source identity; missing original proof fails with `archive-source-unproven`.

A matching private prior publication receipt can support safe reuse of a completed upload during retry. Reuse must bind the exact archive/hash/provider/destination/encryption context and successful command result; missing, malformed, insecure or mismatched receipts cannot authorize it. This prevents treating an existing immutable Azure blob as a fresh upload success merely because it has the same name. Reused command evidence still does not prove the remote object remains present or decryptable; perform separate retrieval.

Reuse covers **completed destination publications**. If an Azure archive upload succeeds but its
checksum upload or private receipt write fails, no complete protected publication receipt exists;
retrying the same filename can still conflict. This job does not automatically repair every partial
provider upload. Create a fresh snapshot with a new filename, or follow an approved independent-reader
verification/repair procedure. Never blindly overwrite blobs or swallow a conflict as success.

Do not rename/copy a plaintext file to `.tar.age`, edit checksum/receipt data to force a retry, or reset record timestamps. If the encrypted capture is stale or cannot be checked, create a new archive after repairing the underlying failure.

## 4. Check local freshness and failure state

```sh
python3 infrastructure/backup/status.py \
  --config-file /etc/tapuai/backup-job.json
```

| Exit | Meaning | Operator / monitor action |
| --- | --- | --- |
| `0` | Freshness/accounting healthy under the active config and thresholds | Retain bounded result; remote retrieval/restore evidence is still separate |
| `2` | Missing, stale, insecure, malformed, failed or inconsistent job evidence; overdue run | Raise the configured alert and assign RECOVERY / RELIABILITY investigation |
| `3` | Invalid monitor/config/threshold setup | Treat monitor as failed; fix config/permissions before trusting health |

Defaults are **seven hours from original capture** and **two hours for a running attempt**. Override with positive finite `--max-age-hours` / `--max-run-hours` only after accepted recovery/capacity review. The latest failed attempt is unhealthy even if an earlier success is still fresh. Missing or changed-config success, incomplete destinations, impossible timestamps and inconsistent latest-attempt/success records do not report healthy.

The monitor reads protected local records/configuration and the active private environment as data; it does
not contact providers. `0` means the recorded required commands completed recently enough for the current
source binding; it does not prove cloud availability, archive integrity at the destination, current data
consistency, age-key availability or a functioning restore.

## 5. Install scheduling and connect alerts

The optional [service](../../infrastructure/backup/tapuai-backup.service) now executes `job.py`, which captures and attempts all configured destinations. The [timer](../../infrastructure/backup/tapuai-backup.timer) proposes 00:00 / 06:00 / 12:00 / 18:00 UTC with up to five minutes jitter. `Persistent=true` can trigger a missed calendar run when the timer activates or restarts (for example, after boot); monitor the actual elapsed capture/upload time.

Before enabling it, complete a manual full job, validate cloud identity under the service sandbox, retrieve from every required destination, and decrypt/restore a reviewed isolated sample. The operator then installs the units using the reviewed paths, reloads systemd and enables the timer. Source files alone do not install or enable units.

A separately configured monitor invokes `status.py`, records its bounded JSON/exit code and delivers failures to the named on-call destination. Service exit errors also need alert routing. This source does **not** activate email/Slack/page delivery or assign a staffed responder. Test a synthetic missing/stale/failure alert and record receipt, response owner and repair evidence before claiming monitoring coverage.

Proposed recovery interval is six hours plus capture/upload lag; the seven-hour stale threshold is an alert policy, not a guaranteed RPO. RTO remains unmeasured. Review local/cloud disk usage, archive/receipt lifecycle and plaintext-stage cleanup under retention and privacy rules; a bucket lifecycle does not clean local files.

## 6. Retrieve through a separate recovery identity

Maintain the **original archive SHA-256** in independently protected custody when capture completes. Do not derive trusted `--expected-sha256` solely from the fetched cloud sidecar: an attacker able to replace both files can recompute a checksum. Protect the original digest/reference independently from both the backup writer and its destinations.

On the recovery machine, authenticate the separate reader identity. Replace filename/hash/account/bucket placeholders with the protected record's reviewed values; the destination must be new and outside the checkout.

```sh
python3 infrastructure/backup/fetch.py \
  --provider aws \
  --destination s3://YOUR_PRIVATE_BACKUP_BUCKET/backups/ \
  --filename tapuai-TIMESTAMP-ID.tar.age \
  --expected-sha256 PROTECTED_ORIGINAL_64_HEX_SHA256 \
  --destination-dir /var/lib/tapuai/recovery-downloads/aws-run1
```

```sh
python3 infrastructure/backup/fetch.py \
  --provider azure \
  --account-name YOUR_STORAGE_ACCOUNT \
  --container backups \
  --filename tapuai-TIMESTAMP-ID.tar.age \
  --expected-sha256 PROTECTED_ORIGINAL_64_HEX_SHA256 \
  --destination-dir /var/lib/tapuai/recovery-downloads/azure-run1
```

Fetch downloads the ciphertext and sidecar into private temporary staging, verifies the age envelope/name/checksum and equality to the protected original digest, then publishes a new private destination with a fetch receipt. Failure does not publish a successful final destination. A completed fetch proves checked ciphertext retrieval for that object; decryption and restore remain unperformed.

Use the independently held age identity with `verify.py` against the fetched archive, then follow the reviewed TOC/isolated target/Storage/finance/access workflow in [CLOUD_MIGRATION_RUNBOOK](exit/CLOUD_MIGRATION_RUNBOOK.md). Keep fetched ciphertext and decrypted private stages separately identified. Repeat for every required cloud and record duration, result, gaps and cleanup.

## 7. Required operational evidence

Before calling the backup service active, [REDUNDANCY-01](../agents/REDUNDANCY-01.md) needs: installed unit/config fingerprint, service-user identity tests, successful capture and all-destination accounting, independently protected original digest, remote fetch from each destination, age decryption, isolated compatible DB/file recovery, RLS/Auth/finance review, actual schedule timestamps and alert-delivery/response receipt. Record real measured RPO/RTO and missing evidence plainly.
