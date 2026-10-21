<!-- RECOVERY / INFRASTRUCTURE operator runbook: commands are prepared procedures, not executed hosted evidence. -->
# Backup, restore and AWS / Azure migration runbook

**Prepared:** 2026-10-19. **Status:** local tools/templates; no hosted commands below have been executed by this documentation task. **Architecture:** [REDUNDANCY_PLAN](REDUNDANCY_PLAN.md). **Checklist:** [implementation plan](design/REDUNDANCY_IMPLEMENTATION_PLAN.md). **Evidence:** [REDUNDANCY-01](../agents/REDUNDANCY-01.md). **Full-app warm-target packet:** [EXIT_READY_RUNBOOK](EXIT_READY_RUNBOOK.md) and [exit toolkit](../../infrastructure/exit/README.md).

## 1. Before the first archive

Run from the repository root. Use Python 3.10+ for backup tools (Python 3.11+ for the upstream bootstrap), Node 24, a `pg_dump` client compatible with the source server and `pg_restore` compatible with the dump, and age. Deployment additionally needs Docker Compose and the chosen cloud's Terraform/provider credentials. CLI help establishes supported arguments; real credentials are supplied by protected files, not pasted into commands or this guide.

```sh
python3 infrastructure/backup/doctor.py
python3 infrastructure/backup/backup.py --help
python3 infrastructure/backup/verify.py --help
python3 infrastructure/backup/restore.py --help
```

RECOVERY/SECURITY prepares private directories outside the checkout. `/etc/tapuai/backup.env` contains the PostgreSQL connection settings and `SUPABASE_SOURCE_URL` / `SUPABASE_SOURCE_SERVICE_ROLE_KEY`. Use `PGPASSFILE` for the database password, a direct/session connection compatible with `pg_dump`, TLS appropriate for the actual host, and a role allowed to read every required schema. A masked service key or insufficient DB role must fail the backup.

`/etc/tapuai/recipients.txt` holds age public recipients. `/etc/tapuai/age.key` is private decryption custody, held separately from the backup store and available through a tested break-glass procedure. Protect environment, password, identity and optional custody files with least-privilege filesystem access. Terraform state and target runtime secrets also belong outside Git.

Prepare an inventory of configuration the database cannot export:

| Required custody item | Evidence before recovery |
| --- | --- |
| Auth issuer/JWKS/signing and encryption keys, API/anon/service keys | Identify original key mode and target compatibility; decide which sessions must sign in again |
| Auth site URL/redirect allowlist, Apple/Google credentials, SMTP/MFA settings | Protected config values or documented recovery access, target callback test and mail isolation |
| Edge Function secrets and Stripe test/live mode, webhook endpoint/signing secret | Protected provider access; current money gates and authoritative credit path recorded |
| DNS/TLS, cloud credentials/state, upstream version pins, durable-storage settings | Named owner, recovery access and bounded isolation/provisioning plan |
| Native release/EAS/store signing and provider-hosted media | Provider-specific recovery access and exports; these are not recovered by PostgreSQL |

Optionally put approved operator-provided config/credentials into `/etc/tapuai/recovery-custody.json` for inclusion **inside the encrypted archive**. The backup cannot discover missing external settings or certify those values are current. Never put secrets into `/admin/support` notes or the task tracker.

## 2. Create a backup

### Routine online snapshot

```sh
python3 infrastructure/backup/backup.py \
  --env-file /etc/tapuai/backup.env \
  --output-dir /var/lib/tapuai/backups \
  --recipients-file /etc/tapuai/recipients.txt \
  --consistency online \
  --custody-file /etc/tapuai/recovery-custody.json
```

Omit `--custody-file` if no reviewed custody payload is prepared; record the missing config/key inventory. The tool captures a full custom database archive, restore TOC/catalog/version evidence, all discovered Storage buckets/objects, source capsule/metadata and a manifest, then produces an age-encrypted `.tar.age` archive and checksum outside the repository. Retain the output names reported by the tool and its bounded success/error metadata.

An online database dump and a file scan have different observation windows. File copies may not correspond atomically to DB rows during concurrent uploads/deletes/overwrites. Record those windows; do not call the archive a verified cutover point.

### Final consistent migration snapshot

A responsible operator first freezes all relevant writers, drains in-flight work, preserves webhook/provider event handling and records financial and upload boundaries. The reference below is an example record ID, not proof a freeze happened.

```sh
python3 infrastructure/backup/backup.py \
  --env-file /etc/tapuai/backup.env \
  --output-dir /var/lib/tapuai/backups \
  --recipients-file /etc/tapuai/recipients.txt \
  --consistency quiesced \
  --quiescence-reference REDUNDANCY-01-FREEZE-RECORD \
  --custody-file /etc/tapuai/recovery-custody.json
```

The tool requires and retains the operator reference. It cannot freeze clients, APIs, SQL sessions, Storage jobs, payment providers or webhooks. An incomplete freeze is a stop item for cutover.

While the freeze holds, also fingerprint the source for the later parity check (read-only, one snapshot; run as a role with BYPASSRLS such as Supabase `postgres`). See [infrastructure/migration](../../infrastructure/migration/README.md).

```sh
python3 infrastructure/migration/parity.py fingerprint \
  --env-file /etc/tapuai/backup.env \
  --out /var/lib/tapuai/restore-drills/source.json
```

### One capture and all independent publications

For recurring operation, use the unified job and private reviewed config instead of coordinating
capture/upload commands manually. [BACKUP_OPERATIONS](BACKUP_OPERATIONS.md) owns installation,
cloud identity, retries, monitoring and independent retrieval.

```sh
python3 infrastructure/backup/job.py \
  --config-file /etc/tapuai/backup-job.json
python3 infrastructure/backup/status.py \
  --config-file /etc/tapuai/backup-job.json
```

The job captures once, attempts every required configured destination and atomically retains private
run/latest-attempt/latest-success records with a config fingerprint and exclusive lock. Any required
publication failure fails the overall attempt. Retry `job.py --archive ACTUAL_ENCRYPTED_ARCHIVE`
without taking another capture; original capture time is retained and only exact matching protected
successful publication receipts can authorize reuse. A pre-existing Azure blob alone is insufficient.
An archive upload followed by checksum/receipt failure has no complete publication evidence and may
still conflict on retry; use a fresh snapshot or an approved independently verified repair procedure,
never automatic conflict suppression/overwrite.

AWS config uses `s3://BUCKET/backups[/prefix]` plus the reviewed `backup_kms_key_arn` Terraform output;
Azure uses account/container and logged-in service identity. Keep the original archive hash in
independently protected custody. Do not publish plaintext stages or age private identities.

The optional service now runs the entire configured job. Its timer proposes 00:00 / 06:00 / 12:00 /
18:00 UTC with up to five minutes jitter; it has not been installed or enabled by this work. With
`ProtectHome=true`, managed identity is preferred; optional `/etc/tapuai/cloud-cli.env` supplies external
AWS file paths / Azure state outside home. Authenticate and test the actual `tapuai-backup` user.

`status.py` checks local original-capture age (default seven hours), running-attempt duration (default
two hours) and complete current-config accounting; exit 0 healthy / 2 unhealthy / 3 invalid setup.
Provider command-success evidence does not establish remote integrity. Connect monitor/service failures
to a separately installed and tested alert-delivery/on-call path; no delivery is active from these files.

## 3. Verify an archive into a private new stage

Use a separate recovery reader and `fetch.py` to retrieve ciphertext from each required cloud. Supply
the **protected original** SHA-256 from independent custody; a fetched adjacent sidecar alone is not
original provenance. Replace placeholders with actual reviewed values. The destination must be new.

```sh
python3 infrastructure/backup/fetch.py \
  --provider aws \
  --destination s3://YOUR_PRIVATE_BACKUP_BUCKET/backups/ \
  --filename tapuai-TIMESTAMP-ID.tar.age \
  --expected-sha256 PROTECTED_ORIGINAL_64_HEX_SHA256 \
  --destination-dir /var/lib/tapuai/recovery-downloads/aws-run1
```

Azure retrieval uses the corresponding `--provider azure --account-name ... --container ...` settings
in [BACKUP_OPERATIONS](BACKUP_OPERATIONS.md). Fetch checks ciphertext/sidecar against the original hash;
it does not decrypt or restore. Use the fetched archive and its adjacent `.sha256` sidecar below,
with a new private decryption destination:

```sh
python3 infrastructure/backup/verify.py \
  /var/lib/tapuai/recovery-downloads/aws-run1/tapuai-TIMESTAMP-ID.tar.age \
  --identity-file /etc/tapuai/age.key \
  --destination /var/lib/tapuai/restore-drills/run1
```

Verification decrypts into private staging and checks archive structure, paths, manifest/hash/size/object accounting and source capsule integrity. A successful result proves integrity against the supplied manifest/reference. It does not independently sign authorship, prove source/file snapshot consistency or test target services.

Plaintext restored DB/Auth/media/custody files are sensitive. Keep the stage inaccessible to public services, disable cloud indexing/sharing and record its expiry. Preserve a failed stage only when needed under the reviewed incident-retention procedure; cleanup follows explicit operator approval for that private stage.

To inspect the bundled source independently, use the existing source recovery workflow against the capsule in the verified stage:

```sh
pnpm recovery:verify /var/lib/tapuai/restore-drills/run1/source.tapuai.gz
pnpm recovery:restore /var/lib/tapuai/restore-drills/run1/source.tapuai.gz
```

The source preview is separate from the live repository. Install locks and run tests there, then compare schema/migration hashes against the actual source project's deployed inventory. Restoring source does not restore database rows or external provider configuration.

## 4. Prepare the isolated cloud target

Select AWS or Azure, an approved region/budget and a fresh isolated target. Real sensitive backup data creates a cloud processor/data-governance obligation; the existing [EXIT_DRILL](EXIT_DRILL.md) is synthetic-only. Read the provider folder and container README before filling non-secret variables or using protected credentials.

```sh
terraform -chdir=infrastructure/terraform/aws init
terraform -chdir=infrastructure/terraform/aws validate
terraform -chdir=infrastructure/terraform/aws plan
```

Use `infrastructure/terraform/azure` for Azure. These prepare/inspect configuration; cloud resource creation is the later approved `apply` step. The initial design is one Linux VM with durable storage and a protected backup destination, not replicated PostgreSQL or multi-zone availability. Configure a private remote Terraform backend and avoid committing state/plan files.

The checked-in upstream lock has no verified commit/hash because official source/documentation could not be fetched in this session. On an internet-enabled operator machine, independently review the exact upstream commit/archive and image versions, then supply those values. Placeholder values below deliberately cannot pass bootstrap validation. Stage the reviewed bundle outside the checkout:

```sh
python3 infrastructure/supabase/bootstrap.py \
  --destination /opt/tapuai/supabase \
  --upstream-commit REVIEWED_40_HEX_COMMIT \
  --archive-sha256 REVIEWED_64_HEX_SHA256
```

The bootstrap verifies the supplied archive hash and explicit upstream image versions before staging configuration; follow its README for reviewed secret generation, database passwords, Auth keys, URLs, SMTP, Storage persistence, TLS, network exposure and container startup. Confirm the upstream versions against the source; managed Supabase can differ from the pinned self-hosted service schemas. An upstream Compose download is not an applied database migration or working deployment.

Keep PostgreSQL, Studio and admin interfaces private. Disable outbound real payments/email and external schedules; keep the target absent from public DNS and app releases. The configuration renderer stages only `create-payment-intent`, `create-stripe-account` and their shared core; it excludes `stripe-webhook` while the client remains the donation credit path. It removes upstream host-port exposure and writes private rendered configuration without printing its secrets:

```sh
python3 infrastructure/supabase/configure.py \
  --deployment-dir /opt/tapuai/supabase \
  --env-file /etc/tapuai/supabase.env \
  --functions-source /opt/tapuai/ala-sports/supabase/functions \
  --output /opt/tapuai/supabase/compose.private.json
```

Review renderer output privately, start the private `tapuai-backend` network and approved stack using the infrastructure README, then build the app/API and Next containers from locked source for target URLs. Public client environment is compiled at build/export time; server credentials belong only in runtime files.

## 5. Review the database selection

DATABASE_MIGRATIONS and RLS_SECURITY inspect the staged `database.dump`, its TOC and target catalogs. A full dump preserves source evidence; importing it wholesale into a different Supabase service installation can overwrite incompatible managed schemas, role grants or service migrations.

1. Compare PostgreSQL, Auth/GoTrue, Storage, Realtime and extension versions; source schemas, role names/owners and target equivalents; actual hosted migration rows; app RLS/functions/default privileges and Realtime publications.
2. Start from the archived TOC, preserve exact record text/order and comment out excluded records with `;`. Save a reviewed list outside the repository, for example `/etc/tapuai/restore-reviewed.list`. A list is required; the restore tool does not decide which managed service objects are safe.
3. Inspect every selected record's schema and dependencies. Review application `ACL` and `DEFAULT ACL` records explicitly; policies and grants determine whether public/anon/authenticated/service roles gain access. Do not repair incompatibility by silently skipping arbitrary errors.
4. Review Auth-data FK order and signup triggers, including profile-creation triggers; prevent duplicate/generated application profiles while preserving original user/profile UUIDs. Importing `auth.users` alone does not prove login/MFA/session recovery.
5. Treat Storage bucket/object metadata and bytes as one coordinated target plan. Keep Storage bucket/object data entries excluded from the main list: APIs create target backend rows, and a separately reviewed owner-only plan reconciles source ownership. Inspect the bare target's actual ownership FKs; if matching Auth owners must be preloaded, review that preliminary Auth-only list and omit those duplicate data entries from the final main list **before** its hash is bound to byte-preload evidence. Historical Beyond/Fan Zone bytes and owner changes must precede application guards; never disable live guards or replace backend IDs/versions wholesale.
6. If the allowlisted restore tool cannot express the reviewed compatible import, stop and assign a targeted DATABASE_MIGRATIONS procedure. No automatic managed-to-self-hosted service-schema migration is claimed.

**Proposal tooling.** Fingerprint the started bare target stack, then let `toc_review.py` draft the list from the archived TOC. It keeps every application object (all application schemas, today `public` and `fan_zone_private`), migration history and what the app attached to Supabase tables that the bare stack lacks (Storage policies, the `on_auth_user_created` signup trigger, realtime policies); it comments out Supabase-managed DDL and Storage rows (the pre-DB byte phase creates target backend rows). For full compatible exit, explicitly use `--include-all-auth-data` below: default/narrow `--include-auth-data` excludes sessions/tokens/flows and cannot satisfy all-Auth exact parity when those rows exist. Unknown entries remain commented/reviewed. If a preliminary Auth preload is required, reviewers document that dependency fulfillment and remove only the already-loaded Auth data entries from the final list. Exit 2 means entries still need a reviewer; steps 1–5 still apply to the result.

```sh
python3 infrastructure/migration/parity.py fingerprint \
  --env-file /etc/tapuai/restore-target.env \
  --out /var/lib/tapuai/restore-drills/target-bare.json
python3 infrastructure/migration/toc_review.py \
  --toc /var/lib/tapuai/restore-drills/run1/database.toc \
  --source-fingerprint /var/lib/tapuai/restore-drills/source.json \
  --target-fingerprint /var/lib/tapuai/restore-drills/target-bare.json \
  --include-all-auth-data \
  --out /etc/tapuai/restore-reviewed.list \
  --report /var/lib/tapuai/restore-drills/review.md
```

Full Auth opt-in requires complete exact source/bare-target fingerprints with distinct database identities,
unfiltered reads, matching detected Auth table sets and exact service schema/function/security/grant
compatibility. It includes only detected original Auth TABLE DATA and compatible detected Auth SEQUENCE SET,
with each table/state present exactly once in the TOC; it does not overwrite service/sequence DDL.
Sessions, refresh tokens, flows, MFA auxiliary state and Auth
migration tables are included when detected. Nonempty target rows are preserved/commented out only when
source count and exact row digest already match (`preservedAuthTables` in the report). Conflicting target data
blocks without automatic deletion; separately review isolated target preparation and recapture its complete
fingerprint. Do not clear identical seeded service migration rows.

Complete Auth sequence evidence includes declared keys/count, definitions/owners/grants and direct read-only
`last_value` / `is_called`; no `nextval` is used for capture. Unknown/missing/duplicate Auth SET entries or
incompatible definitions/state block. Preserve/comment already-ahead target counters instead of replaying
lower source SET (`preservedAuthSequences` in the report). Final sequence parity must prove future Auth inserts
will not reuse token IDs. Pre-import service schema matching permits only source-restored `supabase_migrations`
history to be absent on the bare target; original history schema/table/data TOC coverage is required and final
history/service schema parity remains exact. Auth/Storage/Realtime compatibility is not exempted.

AUTH / DATABASE_MIGRATIONS / SECURITY still accept GoTrue version, actual table constraints/import order,
JWT/encryption/issuer keys and session/MFA/signup behavior. Full row hash coverage does not prove tokens work.
Fence Auth token/session writers while final source and target snapshots are captured; do not weaken parity
to accommodate unaccounted mutations or incompatible service versions.

## 6. Restore only to the acknowledged isolated target

`/etc/tapuai/restore-target.env` contains target PostgreSQL variables and `SUPABASE_TARGET_URL` / `SUPABASE_TARGET_SERVICE_ROLE_KEY`, using protected credential providers. Target URL and the PostgreSQL host/port/database connection tuple must differ from recorded source identity; the supplied confirmation host must match target `PGHOST`. Replace the example target URL/host with the exact inspected isolated target. URL/host comparison is a safety check; the operator must verify actual project/server identity and routing.

```sh
python3 infrastructure/backup/restore.py \
  /var/lib/tapuai/restore-drills/run1 \
  --env-file /etc/tapuai/restore-target.env \
  --use-list /etc/tapuai/restore-reviewed.list \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1
```

The preparation invocation validates the stage/target/list without executing the import. Target routing and
credentials are operator assertions, not proof that the URL/API and SQL host are the same private stack.
Independently inspect both. Historical Beyond/Fan Zone objects use the following phase sequence; ordinary
DB-then-Storage restoration is refused for those objects before SQL runs.

### 6A. Inspect owner FKs and accept the final main list

Before application SQL is installed, capture the bare target's Storage schema/FKs as a new private file:

```sh
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore-target.env \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1 \
  --out /var/lib/tapuai/restore-drills/target-storage-bare.jsonl
```

The capture is a read-only transaction streamed to JSONL. Actual owner/owner_id FKs referencing `auth.users`
require matching Auth users before owner reconciliation. If needed, DATABASE_MIGRATIONS reviews a preliminary
Auth-only TOC against the same compatible target and source. It contains only accepted original dump entries,
omits application/signup/Storage guards, and loads required compatible Auth data without generating duplicate
profiles. Use the same guarded restore interface with the preliminary list and no Storage flag:

```sh
python3 infrastructure/backup/restore.py /var/lib/tapuai/restore-drills/run1 \
  --env-file /etc/tapuai/restore-target.env \
  --use-list /etc/tapuai/restore-auth-preload-reviewed.list \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1 --execute
```

This is an attended conditional procedure, not an automatic Auth migration. Version/key incompatibility,
unsupported ownership FK or unexpected existing app guards is a stop item. Exclude already-preloaded Auth
data records from `/etc/tapuai/restore-reviewed.list`, record their separate accepted import, and freeze this
**final main list before the next phase**. Include the app guards/policies in that final list. Changing its
selected entries afterward invalidates the byte-preload receipt and needs a fresh reviewed target/sequence.

### 6B. Preload byte objects before application guards

```sh
python3 infrastructure/backup/restore.py \
  /var/lib/tapuai/restore-drills/run1 \
  --env-file /etc/tapuai/restore-target.env \
  --use-list /etc/tapuai/restore-reviewed.list \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1 \
  --execute \
  --storage --storage-before-database
```

This command executes **no `pg_restore`**. It validates encrypted-source catalog/byte key identity and absent
application guards, creates compatible buckets, uploads files, re-downloads every byte for SHA-256 and checks
exact path coverage. Guard absence includes disabled app guards; bypassing them is not a recovery procedure.
It writes a private `restore-storage-preload-ID.json` beside the stage, phase `storage-bytes-preloaded`, with
`storageOwnership: pending-reviewed-reconciliation`. Keep its actual filename. Partial uploads are not accepted;
keep isolation and use a fresh reviewed target/sequence on failure.

### 6C. Generate, review and separately apply owner-only reconciliation

```sh
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore-target.env \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1 \
  --out /var/lib/tapuai/restore-drills/target-storage-pre-app.jsonl
python3 infrastructure/migration/storage_reconcile.py plan \
  --stage /var/lib/tapuai/restore-drills/run1 \
  --target-catalog /var/lib/tapuai/restore-drills/target-storage-pre-app.jsonl \
  --out /var/lib/tapuai/restore-drills/storage-owners.sql \
  --report /var/lib/tapuai/restore-drills/storage-owners-plan.json
```

The source's complete `storage-catalog.jsonl` travels inside archive encryption for evidence; it is not a
whole-catalog restore command. The generator accepts exact key coverage, declared compatible nullable owner
fields, known MIME and finite nonnegative size. It writes only `owner` / `owner_id` updates and retains target
backend IDs, physical versions, metadata and timestamps. Source identity, application guards, incomplete
owner/MIME/size data or unsupported FKs cause refusal. Its report is `sqlExecuted: false`.

DATABASE_MIGRATIONS / RLS_SECURITY independently review the plan, actual target version/identity, Auth-FK
preload and byte evidence. Establish the **target** protected PostgreSQL environment, including `PGPASSFILE`
and TLS settings, on the isolated operator machine; `psql` does not load `restore-target.env` by itself.
Then separately apply the accepted file. The non-secret host/port/database/user below must match the inspected
target and its private env; replace them if that target differs:

```sh
psql --no-psqlrc --no-password --host 127.0.0.1 --port 5432 --dbname postgres --username postgres \
  --set ON_ERROR_STOP=1 \
  --command "SET tapuai.restore_target = 'https://restore.example.com'" \
  --file /var/lib/tapuai/restore-drills/storage-owners.sql
```

The separate session assertion must name the inspected isolated URL. The generated transaction asserts that
URL/database name, unchanged target object identities/key coverage, absent app guards and all actual Auth
ownership FK values before updating owners. No tool applies this SQL automatically, relaxes a live guard or
replaces source backend physical keys. Record independent review/application evidence and any refusal; local
SQL generation/mock tests have not demonstrated execution on the compatible real Supabase stack.

### 6D. Continue database-only with the bound byte receipt

After accepted ownership application, use the **actual** preload receipt path:

```sh
python3 infrastructure/backup/restore.py /var/lib/tapuai/restore-drills/run1 \
  --env-file /etc/tapuai/restore-target.env \
  --use-list /etc/tapuai/restore-reviewed.list \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1 \
  --storage-preload-receipt /var/lib/tapuai/restore-drills/restore-storage-preload-ID.json \
  --execute
```

This phase uploads no files. It requires the original source-manifest SHA-256, target URL, DB host/port/name
and exact selected TOC hash to match the preload receipt, then imports the final reviewed list with
`--single-transaction --exit-on-error --no-owner` and preserved reviewed ACLs. Application guards/policies are
restored normally. A private DB-committed receipt is written immediately after commit, followed by the final
receipt; `metadataReconciliation` remains `requires-independent-acceptance`, and the receipts retain preload
lineage. They are unsigned execution records, not attestation of current data or successful functions/access.
Do not reapply SQL to populated tables or upload historical objects after the guards are installed.

Archives without guarded historical objects can still use the original reviewed DB-then-Storage mode. A file
failure after DB commit can resume only through `--execute --storage --storage-only --database-receipt
ACTUAL_PRIVATE_DB_RECEIPT`, with matching manifest/list/target. That path cannot resume Beyond/Fan Zone history
after application guards are installed. Never route traffic based only on a restore command's exit status.

### 6E. Compare logical Storage and accept restored guards/functions

```sh
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore-target.env \
  --confirm-isolated-target https://restore.example.com \
  --confirm-database-host 127.0.0.1 \
  --out /var/lib/tapuai/restore-drills/target-storage-final.jsonl
python3 infrastructure/migration/storage_reconcile.py compare \
  --source /var/lib/tapuai/restore-drills/run1/storage-catalog.jsonl \
  --target /var/lib/tapuai/restore-drills/target-storage-final.jsonl \
  --report /var/lib/tapuai/restore-drills/storage-logical-parity.json
```

Exit 0 means exact key/owner/MIME/size parity, 2 means blocked, 1 invalid input. Missing fields on both sides
cannot pass. Newly generated target backend IDs/versions/timestamps are intentionally retained and differences
reported. This comparison does not verify byte hashes or accept restored application guards; preserve byte
readback evidence and require database parity plus actual-user historical private-media/reservation-function
and denial tests. Ownership and service behavior remain blocked until independently accepted.

### Reconcile privileges, then prove database parity

A restore onto a Supabase stack **reopens access the source had revoked**: `pg_dump` records privileges as changes from PostgreSQL's built-in default, while the stack's default privileges grant `anon` / `authenticated` / `service_role` everything on each new table, sequence and function. The local drill measured 2,059 such rights on the canonical schema (for example `anon` DELETE on `athlete_birthdates`). Keep the target isolated until this is closed:

```sh
python3 infrastructure/migration/parity.py fingerprint --env-file /etc/tapuai/restore-target.env \
  --out /var/lib/tapuai/restore-drills/target-restored.json
python3 infrastructure/migration/parity.py grant-sync /var/lib/tapuai/restore-drills/source.json \
  /var/lib/tapuai/restore-drills/target-restored.json --out /var/lib/tapuai/restore-drills/grants.sql
# RLS_SECURITY reviews grants.sql (privileges only, one transaction), then apply it with the target's PG* variables:
psql --no-psqlrc -v ON_ERROR_STOP=1 --file /var/lib/tapuai/restore-drills/grants.sql
python3 infrastructure/migration/parity.py fingerprint --env-file /etc/tapuai/restore-target.env \
  --out /var/lib/tapuai/restore-drills/target.json
python3 infrastructure/migration/parity.py compare /var/lib/tapuai/restore-drills/source.json \
  /var/lib/tapuai/restore-drills/target.json --report /var/lib/tapuai/restore-drills/parity.md
```

Each fingerprint also runs **access parity** (`infrastructure/migration/access.sql`, in a rolled-back transaction): every application table read as a guest, three signed-in users and an admin through RLS, so the app is proven to see the same rows on the target. `compare` exits 1 on anything that blocks: missing or extra policies, RLS off, changed exposed grants, definer functions without their `search_path`, sequences behind the source, realtime tables unpublished, row count or row hash differences, missing migration history, or missing app attachments on Supabase tables. A PASS is required evidence for the **DB data** and part of the **Access denial** rows below; it is not proof of Auth, Storage bytes or client behaviour.

Capture exact Auth parity while source/target Auth writers are fenced, **before** functional login/refresh/logout
tests create or mutate session/token rows. Preserve that accepted restored baseline. Record subsequent authorized
smoke-test mutations and cleanup separately; comparing to the old frozen source after those tests cannot
establish unchanged Auth data. Do not suppress genuine restore drift as an assumed test side effect.

## 7. Functional recovery acceptance

Record actual checks against the target, source versions and payload identity. Do not substitute the repository's PGlite schema replay for live-service compatibility.

| Check | Required evidence |
| --- | --- |
| DB data | `parity.py compare` PASS with `compared.coverageComplete: true` after `grant-sync` (application and every detected Auth table row counts/hashes, exact service schema/functions/security/grants, Storage service-table counts, sequences, migration history, realtime publication); documented preserved Auth rows/preliminary import from `review.md` |
| Storage completeness | Bound pre-DB byte receipt and SHA-256/key readback; reviewed owner-only application evidence; original source/final target catalog logical PASS (keys, owner/owner_id, MIME, size); restored guards/policies and historical private-media/reservation/finalization functions independently accepted; absent/deleted objects handled explicitly |
| Access denial | Anonymous/private-profile/private-media/guardian/admin restrictions; service-only RPCs denied; RLS/ACL/default privileges reviewed |
| Auth | Existing test user login/password or OAuth, refresh/logout/session decision, MFA/issuer/JWKS callbacks and profile IDs; no duplicate signup profile |
| App / API | Guest browse, supported account sign-in, Highlight/avatars/logos/story/private clips, photo upload and server API routes |
| Realtime | Authorized live score/cheer/private channels work; unauthorized subscriptions fail |
| Finance | Snapshot transactions, retained journal/audits and every provider event after the snapshot reconciled; single credit/writer path; payouts remain gated |
| Operations | Backups continue on target; alert and independent restore-copy readback tested; complete restore duration measured |

## 8. Later production cutover

The owner approves a concrete migration packet after the preceding evidence. The packet names the cloud/provider/region, versions, reviewer decisions, tested client release/update plan, freeze window, endpoint/DNS plan, complete financial reconciliation, rollback boundary and staffed response.

0. `pnpm exit:status` shows the release commit, app source hash and plan version; `pnpm exit:preflight --evidence-config <private readiness>` must say **GO** on that exact version ([EXIT_READY_RUNBOOK](EXIT_READY_RUNBOOK.md)). Anything else stops the cutover.
1. Verify last known working backups and source/deployed compatibility. Lower DNS TTL only through the approved operator change.
2. Freeze all old-primary writers and preserve/reconcile external events. Record final cursors and produce the final quiesced archive.
3. Restore/verify the final compatible target; preserve the old primary and original evidence. Never run both as authoritative writers.
4. Restore protected provider config, set routing/TLS/OAuth/webhooks and build/update clients. Existing installed mobile builds have compiled endpoints/keys; plan store/EAS compatibility, required updates, old-client blocks and session/offline-queue handling.
5. Validate target private media and every URL reader. Legacy Supabase URLs and `sb:` references must both resolve through approved reader code; do not flip reference-writing/backfill outside PORTABILITY's release sequence.
6. Finance approves snapshot-gap reconciliation; QA/SECURITY/RELEASE accept negative access, service and installed-client checks before controlled reopening.
7. Observe error/latency/payment/file signals and backup/copy success through the staffed window. Record actual outage, data-loss gap, client reach and loaded costs.

**Rollback boundary:** before target writes, routing can return to the preserved compatible source after inspection. After target writes/payment events, reverting DNS alone loses new state. Freeze both sides and reconcile/forward-repair through Finance and DATABASE_MIGRATIONS before selecting one writer; never auto-import an older money ledger into live service.

Retain the former primary read-only for the approved audit/recovery window. Decommissioning, archive expiry and sensitive-stage cleanup are separately reviewed operator actions. Update the task record, STATE, infrastructure register and [EXIT_DRILL](EXIT_DRILL.md) with actual results and unresolved owners.
