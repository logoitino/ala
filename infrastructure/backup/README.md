<!-- Operator entry point for portable full backups; examples contain no live credentials. -->
# Supabase backup and restore

These tools capture a full logical database dump (including Auth and Storage metadata), every
Storage bucket and file, encrypted full Storage catalog rows, source/dependency/migration evidence and optional configuration custody.
They encrypt the package with **age** before publishing it. A database dump does not contain file
bytes, cluster-role passwords, dashboard provider settings or external Stripe/EAS accounts.

## Requirements

Python 3.10+, Node 24, age, `psql`, `pg_dump` and `pg_restore`. Match the PostgreSQL tools' major
version to the source server, or use a supported newer version; check target compatibility before
restoring. AWS CLI or Azure CLI is needed for the corresponding configured publication or retrieval. Keep artifacts and credentials
outside this repository on an encrypted disk. Private config files use mode `600`, directories `700`.

```sh
python3 infrastructure/backup/doctor.py
python3 -m unittest discover -s infrastructure/backup/tests -v
```

## Prepare

1. Create an age identity on the **separate recovery machine** (`age-keygen -o /secure/age.key`).
   Put only its public recipient in `/etc/tapuai/recipients.txt` on the backup runner. Protect both
   files with `chmod 600`. Do not keep the private identity alongside the backup archive.
2. Copy [backup.env.example](backup.env.example) to `/etc/tapuai/backup.env`; replace placeholders.
   Create the private PostgreSQL password file named by `PGPASSFILE`. Remote connections require
   `PGSSLMODE=verify-full` and a trusted source CA. Supabase service-role keys stay server-only.
3. Put operator-maintained settings in `/etc/tapuai/recovery-custody.json`: provider/SMTP/Auth/JWT
   key restoration references, redirect allowlists, source service versions, Edge Function secrets,
   application runtime config and the approved recovery procedure. Secrets may be included only in
   this private input because the resulting package is encrypted. Update custody whenever settings
   change; the tool cannot prove it is complete or current. External account recovery stays separate.
4. Freeze app/database/Storage writes for a cutover backup. An online backup detects Storage changes
   and reconciles API coverage to `storage.objects`, but is **not an atomic cross-store snapshot**.

## Run capture and all configured destinations

Copy [job.config.example.json](job.config.example.json) to private `/etc/tapuai/backup-job.json`,
replace reviewed paths/destinations/KMS ARN, and provision separate mode-700 archive/status directories.
Configure one to sixteen destinations; unattended jobs use online consistency. Config is strict JSON
and credentials remain in protected referenced files/provider identities.

```sh
python3 infrastructure/backup/job.py --config-file /etc/tapuai/backup-job.json
python3 infrastructure/backup/status.py --config-file /etc/tapuai/backup-job.json
```

One job captures once and attempts every configured destination. Any required upload failure fails
the overall attempt; prior complete success remains recorded. A config fingerprint, exclusive OS
lock and atomic private run/latest-attempt/latest-success records support safe accounting. The
monitor defaults to original capture age at most seven hours and running attempt at most two hours;
exit `0` means freshness/accounting healthy, `2` unhealthy, `3` invalid monitor/config setup.
Local metadata does not prove remote integrity or recoverability.

If capture succeeded but publication needs retry:

```sh
python3 infrastructure/backup/job.py --config-file /etc/tapuai/backup-job.json \
  --archive /var/lib/tapuai/backups/tapuai-TIMESTAMP-ID.tar.age
```

Use the actual generated archive. Retry validates envelope/checksum, retains original capture time,
and accounts for all active destinations. A protected exact matching prior successful receipt can
support upload reuse; an existing Azure blob alone is not evidence. If the archive blob succeeded but
checksum/receipt creation failed, same-filename retry can still conflict. Create a fresh snapshot or
use an approved independent-reader verification/repair procedure; do not blindly overwrite or suppress
conflicts. Read the complete private-config,
identity, retry, monitor, retrieval and installation procedure in
[BACKUP_OPERATIONS](../../docs/engineering/BACKUP_OPERATIONS.md).

## Standalone capture / final write freeze

```sh
python3 infrastructure/backup/backup.py \
  --env-file /etc/tapuai/backup.env \
  --output-dir /var/lib/tapuai/backups \
  --recipients-file /etc/tapuai/recipients.txt \
  --custody-file /etc/tapuai/recovery-custody.json
```

For an actual write freeze, add `--consistency quiesced --quiescence-reference RECORD_ID`.
That records the operator assertion; it does not pause the app. Any failed file download,
changed inventory, missing database permission, source-policy rejection or encryption failure
fails the job. No successful artifact is claimed from a partial capture. Interrupted/failed runs
can leave private staging on disk after power loss; purge it under the operator retention policy.

## Standalone publication

Use the archive filename returned by backup.py. These commands perform real uploads when executed:

```sh
python3 infrastructure/backup/publish.py /var/lib/tapuai/backups/tapuai-TIMESTAMP-ID.tar.age \
  --provider aws --destination s3://YOUR_PRIVATE_BACKUP_BUCKET/backups/ \
  --kms-key-id YOUR_REVIEWED_BACKUP_KMS_KEY_ARN
python3 infrastructure/backup/publish.py /var/lib/tapuai/backups/tapuai-TIMESTAMP-ID.tar.age \
  --provider azure --account-name YOUR_STORAGE_ACCOUNT --container backups
```

The CLI accepts the actual generated timestamp/ID pattern, not the example literal. AWS uses SSE-S3
by default; add `--kms-key-id KEY_ARN` for a KMS-enforced bucket. Azure uses logged-in identity access.
Use a dedicated writer with no deletion right, versioning and retention. Keep a second copy in a
different cloud/account from the running app. Upload receipts indicate command success; download
and verify a remote copy during the drill before accepting remote recoverability.

## Retrieve through a separate reader

Keep the original archive SHA-256 in independently protected custody. On the recovery machine,
authenticate the separate reader, then use the actual filename and original digest:

```sh
python3 infrastructure/backup/fetch.py --provider aws \
  --destination s3://YOUR_PRIVATE_BACKUP_BUCKET/backups/ \
  --filename tapuai-TIMESTAMP-ID.tar.age \
  --expected-sha256 PROTECTED_ORIGINAL_64_HEX_SHA256 \
  --destination-dir /secure/downloads/aws-run-001
```

For Azure use `--provider azure --account-name YOUR_STORAGE_ACCOUNT --container backups` instead
of the AWS destination. Fetch validates ciphertext/sidecar against the protected original hash into
a new private directory; the cloud sidecar alone is not trusted original provenance. A fetch receipt
does not decrypt or restore data. Follow verification and isolated restore separately.

## Verify and prepare a restore

```sh
python3 infrastructure/backup/verify.py /secure/backup.tar.age \
  --identity-file /secure/age.key --destination /secure/drills/run-001
cp /secure/drills/run-001/database.toc /secure/reviewed.list
```

The checksum sidecar must be beside the downloaded archive. Verification refuses an existing stage,
unsafe tar paths/links, corrupt hashes, missing Storage bytes and invalid source capsules. The stage
is **plaintext personal data**. Restore source with `node scripts/recovery-capsule.mjs restore
/secure/drills/run-001/source.tapuai.gz` into a separate preview; this does not restore data.

Provision the same compatible Supabase service schemas/roles and an empty isolated app database.
Review `/secure/reviewed.list` with Database/Security: **comment out incompatible service-owned DDL,
roles, settings and already-provisioned objects**, retain approved app grants/RLS/functions/data,
and choose Auth data entries compatible with the target version. Storage bucket/object data entries remain
excluded: the API creates target backend rows, and the reviewed owner-only plan below restores logical ownership.
Ordering, sign-up triggers,
Auth MFA factors/key custody and profile foreign keys need review. A full managed dump is not an
unmodified one-command import onto a self-hosted stack. Never run canonical schema plus historical
migrations blindly; the managed migration baseline remains incomplete.

For the full compatible exit, use `toc_review.py --include-all-auth-data` with complete source and bare-target
fingerprints as shown in the [migration tooling guide](../migration/README.md). This separate opt-in covers all
detected Auth TABLE DATA, including sessions/tokens/flows/MFA/service migration rows, and compatible detected
Auth SEQUENCE SET, after strict compatible
schema/function and table-set checks. Existing exact target Auth rows are retained with their original TOC
data entries commented; conflicting rows block without clearing data. Default and `--include-auth-data`
remain narrow diagnostic choices and do not establish full Auth parity. Version/signing/encryption/session
compatibility still needs independent review; no Auth schema overwrite or key restoration is automated.
Exact sequence definitions/grants plus read-only captured last_value/is_called are required; unknown/missing
SET coverage blocks and already-ahead target counters are preserved. Final sequence parity must prevent future
Auth inserts from reusing IDs. Pre-import schema comparison permits only source-restored `supabase_migrations`
history to be missing from the bare target, with original history TOC entries required and final exact parity.

```sh
python3 infrastructure/backup/restore.py /secure/drills/run-001 \
  --env-file /etc/tapuai/restore.env --use-list /secure/reviewed.list \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1
```

The command above prints a plan. It refuses the source URL/database connection and modified/unknown TOC
entries. **Historical Beyond/Fan Zone files require the following order**, because their application guards
reject uploads and owner changes after application SQL is restored. A DB-then-Storage command is refused for
these archived objects before SQL runs. Do not disable guards on a live or restored app.

### A. Decide preliminary Auth import and freeze the final list

Inspect the bare compatible target's Storage owner columns/FKs with `storage_reconcile.py snapshot` below.
If ownership has actual `auth.users` FKs, review a preliminary Auth-only TOC import into that isolated stack
before ownership changes. Keep app/signup guards absent; preserve original user UUIDs. Use `restore.py --execute`
without `--storage` and with that separate exact reviewed Auth list. The **final main list** must exclude any
Auth data entries already imported, and retain approved application data/DDL/guards/policies/grants. Record
both decisions, freeze the final list before the byte phase, and never reimport duplicate Auth rows. Unexpected
or incompatible ownership FKs require a targeted reviewed procedure; no universal Auth preload is automated.

### B. Load and verify bytes before application SQL

```sh
python3 infrastructure/backup/restore.py /secure/drills/run-001 \
  --env-file /etc/tapuai/restore.env --use-list /secure/reviewed.list \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --execute --storage --storage-before-database
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore.env \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --out /secure/target-storage-pre-app.jsonl
python3 infrastructure/migration/storage_reconcile.py plan \
  --stage /secure/drills/run-001 --target-catalog /secure/target-storage-pre-app.jsonl \
  --out /secure/storage-owners.sql --report /secure/storage-owners-plan.json
```

Use a different new snapshot path for the preliminary inspection in step A. All catalogs/plans/reports are
private external files. Preloading performs no DB restore; it verifies source catalog identity/key coverage,
requires absent app guards, creates compatible buckets, uploads files and reads back every byte hash and exact
key coverage. Success writes `restore-storage-preload-ID.json` beside the stage, with ownership pending.
Partial upload is not accepted as success; retain isolation and use a fresh reviewed target on failure.

### C. Review/apply owner-only SQL, then restore the database

The plan updates only compatible `owner` / `owner_id`, preserving target IDs, physical versions, timestamps
and backend metadata. It refuses unknown MIME/size, missing declared owner values, mismatched keys, unsupported
owner columns/FKs and present app guards. Review the target/database assertion and each Auth-FK requirement.
The generator never executes SQL. Applying accepted SQL is a separate attended operator action using the
isolated target's protected PostgreSQL environment and session `tapuai.restore_target` assertion; see
[CLOUD_MIGRATION_RUNBOOK section 6](../../docs/engineering/CLOUD_MIGRATION_RUNBOOK.md).

After that accepted ownership application, continue with the actual preload receipt filename:

```sh
python3 infrastructure/backup/restore.py /secure/drills/run-001 \
  --env-file /etc/tapuai/restore.env --use-list /secure/reviewed.list \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --execute --storage-preload-receipt /secure/drills/restore-storage-preload-ID.json
```

This phase uploads no files. It binds the source manifest hash, target URL, DB host/port/name and exact final
TOC hash to the receipt, then restores reviewed SQL with `--no-owner`, preserved ACLs and one transaction.
It writes a private DB-committed receipt immediately after commit and a final receipt. Those unsigned receipts
record execution/lineage; `metadataReconciliation` still requires independent acceptance. Do not rerun SQL onto
populated tables. Receipt validation does not attest current DB contents or apply source/provider custody.

### D. Independently accept Storage and database behavior

```sh
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore.env \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --out /secure/target-storage-final.jsonl
python3 infrastructure/migration/storage_reconcile.py compare \
  --source /secure/drills/run-001/storage-catalog.jsonl --target /secure/target-storage-final.jsonl \
  --report /secure/storage-logical-parity.json
```

Logical compare checks exact keys, declared owner values, MIME and numeric size; exit 0 PASS / 2 blocked /
1 invalid. New API IDs/versions/timestamps are reported without copying source backend identifiers. Missing
values on both sides do not establish parity. Independent DB grant/RLS/policy/guard parity, actual-user
historical private-media access/denial, reservation/finalization functions and Auth smoke are required.
All detected Auth data uses exact row hashes; strict readiness also requires complete service-definition/schema
and Auth inventory evidence. Storage row counts do not replace this separate logical-owner/byte gate.
The preloaded byte hashes and logical comparison serve different gates. No real compatible target execution
or end-to-end functional recovery is proven by local mocked tests.

For archives without guarded historical objects, the original reviewed DB-then-Storage mode remains available.
A file failure can follow a committed DB transaction; only that mode can resume file uploads with
`--execute --storage --storage-only --database-receipt ACTUAL_PRIVATE_DB_RECEIPT`. The receipt must match
source manifest, final TOC and target. It cannot resume historical guarded files after app guards are installed.

## Schedule and evidence

The optional [service](tapuai-backup.service) executes the unified `job.py` capture/all-destination
workflow; the [timer](tapuai-backup.timer) proposes a six-hour Linux schedule. They are **not enabled**
by this repository. Install only after an attended full job, remote retrieval from every destination,
decryption and a compatible isolated restore, using the operator procedure in
[BACKUP_OPERATIONS](../../docs/engineering/BACKUP_OPERATIONS.md).

`ProtectHome=true` prevents reliance on a developer's home-directory login cache. Prefer managed
identity; otherwise prepare the optional private `/etc/tapuai/cloud-cli.env` with `AWS_CONFIG_FILE`,
`AWS_SHARED_CREDENTIALS_FILE` and/or `AZURE_CONFIG_DIR` pointing outside home. Authenticate the
actual service user, protect files/directories and retain tested sandbox identity evidence.

Connect `status.py` and service failures to a separately installed alert-delivery/response path.
No alert delivery is activated here. Default thresholds are seven hours from original capture and
two hours for an in-progress job, with failed latest attempts unhealthy immediately. RPO includes
capture/upload lag. Local/cloud retention and private plaintext cleanup remain operator duties.

Record snapshot window, source/target service versions, schema/row/RLS/Auth/MFA checks, object hashes,
remote retrieval, elapsed time, financial reconciliation, next owner and cleanup in
[REDUNDANCY-01](../../docs/agents/REDUNDANCY-01.md). Current RPO/RTO are unmeasured. See the
[migration runbook](../../docs/engineering/CLOUD_MIGRATION_RUNBOOK.md) for final cutover/rollback.
Use [EXIT_READY_RUNBOOK](../../docs/engineering/EXIT_READY_RUNBOOK.md) and the [exit toolkit](../exit/README.md)
for a release-bound warm-target readiness packet; a backup receipt alone does not establish the three-hour target.
