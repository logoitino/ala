<!-- REDUNDANCY-03: executable preparation, original evidence and a measured warm cutover; hosted readiness is not inferred from source tests. -->
# Keep the app ready to move to AWS or Azure

**Local implementation:** automatic source snapshot interface, exact source exports, content drift checks, runtime image preparation,
database/access comparison, historical Storage reconciliation and strict readiness checks.
**Operational status:** no owned cloud target, live backup, Supabase service drill or timed
cutover has been completed by this session. Two to three hours is a target awaiting evidence.
**Local source automation:** an owned detached watcher was observed running for the current login;
automatic startup after logout/restart remains unavailable because LaunchAgent installation failed.

## 1. Use the same application

Exit A runs our current app against self-hosted Supabase on owned servers. PostgreSQL, Auth,
PostgREST, Realtime, Storage and the allowlisted Edge adapters keep the interfaces our code
uses. Exact app/SQL source has one implementation. There is no second rewritten app to drift.
Exit B replacing these services with cloud-native interfaces needs its own implementation
and compatibility proof; the two-hour path does not currently implement exit B.

[EXIT_INFRASTRUCTURE_MAP](EXIT_INFRASTRUCTURE_MAP.md) maps components, dependencies, owners
and AWS/Azure options. `pnpm exit:inventory` exports every inventoried safe source file's
SHA256/size and SDK call location. It resolves literal targets and marks dynamic or uncertain
calls for review. Static analysis cannot discover live dashboard changes; catalog capture,
encrypted configuration custody and service tests are required too.

### Prepare the shared connection settings

[PORTABLE_INTEGRATIONS](../PORTABLE_INTEGRATIONS.md) describes the shared resolver and matching target
profiles for the same app. Use `pnpm portability:profile --config-file PRIVATE --output-dir NEW` with reviewed
private external JSON; no privileged key belongs in the public profile. `pnpm portability:test` exercises the
installed SDK against synthetic loopback REST/RPC/Auth/Storage/Functions fixtures. Fixture results do not
prove real RLS, OAuth/MFA, WebSockets or provider parity. A plain AWS/Azure SQL database still needs the
compatible backend protocols and security semantics. Source releases and automatic cache updates carry
these tools/tests/docs, while offline dependencies/images and current data/custody remain separately prepared.
Public settings still compile into Expo/Next: rebuild/install the preparatory client before switching.

## 2. Folder structure

| Location | Contains |
| --- | --- |
| `apps/`, `packages/`, `supabase/` | One current application, shared types, canonical SQL, every checked-in migration and Edge source. |
| `infrastructure/backup/` | Full logical database/Auth dump, all accessible Storage bytes/catalog, source/config custody, encryption, offsite jobs, retrieval and isolated restore. |
| `infrastructure/migration/` | Reviewed TOC proposals, exact catalog/row/access comparisons, privilege reconciliation and Storage ownership plans. |
| `infrastructure/containers/`, `supabase/` | Fan web/API, portal and TLS containers; reviewed pinned Supabase stack and optional stable API gateway. |
| `infrastructure/terraform/` | AWS/Azure recovery storage and optional single-server templates. One server is not high availability. |
| `infrastructure/exit/` | Automatic local source cache, verified source release, image archives and evidence gate automation. |
| Private external operator directory | Expanded releases, image archives, encrypted backups, original reports, target settings and accepted evidence; never Git. |

The exported release contains `application/` with exact source paths, `inventory.json`,
original source capsule/provenance, and `manifest.json` with hashes, target and release version.
No customer database rows, Storage bytes, dependencies or runtime credentials are in this
source package. Those are independently retained encrypted backups and runtime archives.

## 3. Automatic source updates and reviewed releases

The local updater captures governed safe source changes, including uncommitted edits and documentation,
without maintaining a second implementation. It refreshes the derived map but does not acknowledge routed
notices, complete reviews, write the Git index/commits, synchronize hosted data or deploy the target.
Ordinary watcher snapshots are **locally unverified code**;
package integrity and current-source status do not satisfy the checked-release or readiness gates.

### Local source cache

```sh
TAPUAI_EXIT_STATE="${HOME}/Library/Application Support/Tapuai/exit-source"
pnpm exit:sync sync --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3
pnpm exit:sync status --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source
pnpm exit:sync watch --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
```

The private external macOS default is shown; use encrypted local storage. A single `sync` captures changed
content once. `watch` performs an initial sync on every restart, then checks complete safe source content every 30 seconds
by default, plus capture latency. It accepts only a stable package; polling does not guarantee each individual
save was captured. Unchanged source is verified/reused without refreshing its original capture time.
Active edits/hard capture failures keep the previous accepted snapshot historical.

`latest.json` retains the accepted package's original capture time, path, version and actual code-verification
result. `status` checks current source, package integrity and last failed attempt. Failed capture retains the
prior pointer and reports failure. Status exits 0 current-source / 2 not-current (including stale, malformed or
failed state), with CLI argument/command errors exit 1. It does not certify daemon liveness or code verification.
A completed map generation with semantic findings can retain current raw source with
`mapValidation.outcome: failed`; the full check still fails, and readiness remains false. Privacy, symlink,
ambiguous-format and write failures remain hard failures. Default retention is three updater-owned
source-cache releases and is applied even on reuse; manual
exports, encrypted backups and unrelated artifacts are not pruned.

### Observed current-login automation

The managed detached source watcher was observed running with initial PID `29080`, started at
`2026-10-20T05:29:15.995Z` (2026-10-19 in America/Denver), runtime `detached-process`, interval 30 seconds
and `loginAutoStart: false`. Later actual source-sweep/runtime evidence belongs in
[REDUNDANCY-04](../../agents/REDUNDANCY-04.md). Use:

```sh
pnpm exit:sync start --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
pnpm exit:sync stop --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
```

Stop verifies the captured exact process identity/command and preserves snapshots; use it rather than killing
an arbitrary PID. Runtime liveness and current-source/failure status are separate. Repeat start after logout,
restart or process loss until normal OS login-start installation is available. This watches source only.

### Catch up without a running watcher

`pnpm check` ends with `exit:sync ensure` after all quality/map guards pass. The Claude Stop guard calls
`ensure` after derived-map refresh on each stop pass. Both provide source catch-up when the detached watcher
is absent or automatic login startup is blocked. Explicit invocation is:

```sh
pnpm exit:sync ensure --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3
```

It captures/reuses exact current source. A valid OS lock held by another capture returns `outcome: deferred`,
`sourceCurrent: null` and readiness false; this is not successful-capture evidence. Other errors fail the
check or cause the Stop guard's first pushback/warning; an already active stop cycle is allowed to exit.
The entry points do not acknowledge notices, approve partner reviews or write the Git index.

### Optional macOS login startup

For the preferred normal macOS login-start service:

```sh
pnpm exit:sync install --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
pnpm exit:sync uninstall --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
```

Installation manages the owned `com.tapuai.exit-source` LaunchAgent under `~/Library/LaunchAgents`.
Uninstall uses the exact original settings and leaves retained snapshots; review/uninstall before changing
configuration. State is bound to its repository root/target, and kernel locking/owned deletion journaling
protect capture and retention. This LaunchAgent interface remains prepared; its installation was unsuccessful
as recorded below. Keep actual runtime/current-source evidence in [REDUNDANCY-04](../../agents/REDUNDANCY-04.md).
Source-cache status never establishes cloud availability or a three-hour switch.

**Actual OS limit (2026-10-19):** writing the normal LaunchAgents plist failed with `EPERM` through both this
session's default and elevated tools. Persistent login startup is therefore not installed by those attempts;
this is an OS write failure, not an automatic approval rejection. An additional attempt stored an owned
plist inside private state and requested current-login LaunchAgent installation:

```sh
pnpm exit:sync install --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000 --session-only
pnpm exit:sync uninstall --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000 --session-only
```

That valid external-plist bootstrap also failed with launchctl error 5 (`EIO`), including the elevated attempt;
**no LaunchAgent was loaded**. Session-only LaunchAgent mode would record `loginAutoStart: false` even if
accepted. Use the observed managed `start` fallback above for this login. When authorized Terminal/OS access
permits normal installation, stop the detached instance and uninstall any actually installed session-only
service with its exact settings before changing modes. Record observed scope/failures in REDUNDANCY-04.

`pnpm exit:sync sync --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --verify-code`
explicitly runs `pnpm check`. Actually verified CI/manual releases are independently identified; a later unverified
watcher capture does not inherit an earlier check. Retain durable accepted releases separately from this cache.

**Verified-capture sleep behavior:** macOS runs `/usr/bin/caffeinate -i pnpm check`; Linux keeps direct
`pnpm check`. Both retain the 600-second verification deadline. A recorded 693-second laptop idle sleep
expired a wrapped capture despite passing test output; a separate awake check passed in 115 seconds.
The assertion inhibits idle sleep only for that command's lifetime. Forced lid sleep/power loss still fails
closed, and raw watcher operation neither prevents sleep nor guarantees asleep-time sweeps.

### Review changes and refresh operational proof

1. Update app source, SQL/migrations, infrastructure and governed mappings together. New
   Auth methods need capability entries; new Edge Functions need the allowlist or a reason
   for exclusion. `stripe-webhook` stays excluded until one financial credit path is approved.
2. Run `pnpm exit:map --acknowledge --by "executor/session"` after source changes settle.
   Retain actual partner review results in [EXIT_CHANGE_LOG](../../agents/EXIT_CHANGE_LOG.md).
   CI/`pnpm check` reject stale maps and unannounced content changes, including function-body
   changes with unchanged names. A routed local notice is not evidence a team ran a drill.
3. Use the watcher for automatic local source upkeep, then export a new verified source release using the commands in
   [infrastructure/exit/README](../../../infrastructure/exit/README.md). Full check runs with
   `--verify-code`. Prepared source-only CI runs on all branch pushes, all PR targets, manual dispatch and a
   daily default-branch sweep, retaining source artifacts for 30 days. It captures raw source before the full
   check; a failed check may still retain that raw artifact with failed job/status evidence. Inspect its actual
   verification/provenance before accepting it as checked. No real GitHub run/push has occurred in this session.
   Operational source retention needs an independent protected copy. Local watcher snapshots do not replace checked
   releases, live data backups or independent cloud copies.
4. Rebuild changed app images and prepare all exact service image archives for the target
   architecture. Source changes invalidate old release-bound evidence, even if images did
   not change. Rebind unchanged content only after reviewed capture/inspection.
5. Capture current data/custody through the approved backup runner, publish all configured
   copies and test independent reader retrieval. Install timers and deliver alerts before
   claiming continuous protection. Repeat affected tests and a full measured rehearsal.

### Retrieve a CI source artifact

The downloaded artifact carries `tapuai-exit-source-bundle.tar.gz` and its `.sha256` sidecar so ZIP
transport does not normalize private/executable modes. Verify the unsigned checksum and expected relative
archive members, then unpack into a **new private external directory**, preserving modes. Read extracted
`tapuai-exit-source-state/latest.json` and run the portable verifier against its actual `releases/UUID`.
From the private download directory, verify the checksum and inspect the expected members:

```sh
shasum -a 256 -c tapuai-exit-source-bundle.tar.gz.sha256
tar -tzf tapuai-exit-source-bundle.tar.gz
```

Expected roots are `tapuai-exit-source-state/` and `tapuai-exit-source-provenance.json`. Prepare a new mode-700
destination and preserve modes while extracting. Then run the verifier from the repository root:

```sh
mkdir -m 700 /private/operator/retrieved-source-run001
tar -xpzf /private/operator/ci-download/tapuai-exit-source-bundle.tar.gz -C /private/operator/retrieved-source-run001
pnpm exit:release verify /private/operator/retrieved-source-run001/tapuai-exit-source-state/releases/ACTUAL_POINTER_UUID
```

Add `--current` only when checking that release against this checkout's current source. CI sync state is bound
to its original ephemeral runner repository path and must not be adopted through local `exit:sync status`.
Unsigned checksum/provenance demonstrate integrity/context, not successful tests or readiness. Inspect original
code-verification/job status; a failed CI run can retain raw source. Keep durable independent source custody
beyond the finite 30-day CI retention window.

## 4. Prepare before starting the three-hour clock

### Create private settings and inspect preparation health

With `TAPUAI_EXIT_STATE` pointing to the existing owned private cache, set `TAPUAI_SOURCE_ORIGIN` to the
reviewed actual public Supabase HTTPS origin. Use a new absolute output directory outside the checkout:

```sh
TAPUAI_BACKUP_SETUP=/private/operator/new-backup-setup
pnpm exit:setup --output-dir "$TAPUAI_BACKUP_SETUP" --source-url "$TAPUAI_SOURCE_ORIGIN" \
  --source-state-dir "$TAPUAI_EXIT_STATE" --source-target-id local-source
pnpm exit:health --config-file "$TAPUAI_BACKUP_SETUP/config/health.json"
```

Setup creates mode-700 folders/mode-600 templates, empty backup/status folders, an empty public age
recipients list and a password-file example. Credentials, actual password file, private decryption identity,
cloud destinations and readiness evidence remain unconfigured. It refuses an existing output directory;
it starts no backup, watcher or provider operation. The original setup manifest verifies template integrity
and remains marked incomplete. Complete private inputs using [BACKUP_OPERATIONS](../BACKUP_OPERATIONS.md).

Health without a config reports default source/tool observations plus backup/prepared evidence not configured.
Configured health separately checks exact current source, code verification, map validity, exact owned watcher
liveness and scan age (default 120 seconds; future times fail). It checks backup records against current API/DB
source identity and the expected Supabase origin, with seven-hour capture/two-hour running-attempt defaults.
With an expected origin configured, health compares only `EXPO_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_URL` and any declared server `SUPABASE_URL` override from both apps' standard
`.env` / `.env.local` / development / production /
test files and their `.local` variants, plus process inputs (optional `export KEY=` declarations are accepted).
Both apps need observed origins; every declared origin must match. Missing, conflicting, duplicate, linked or
invalid inputs fail without exposing keys, expanding dotenv or copying private files.
It also inspects local tools and runs the strict existing prepared-evidence gate: the same source version/target
must carry a validated original `sourceBinding` whose Supabase URL matches the expected origin and whose
`PGHOST` / `PGPORT` / `PGDATABASE` match the current backup source.
No provider is contacted, traffic changed or state written. Exit `0` accepts preparation observations;
`2` means NO-GO because observations are missing/stale/incomplete; `3` means invalid private health configuration.
`readyToCutOver` is always `false`. Successful preparation still requires the independently accepted cutover gate.

**Observed on 2026-10-20:** the private folder
`/Users/seiuliian/Downloads/ala-sports-backup-setup-20261020` was created with original template integrity
accepted. No backup or service was activated. Health exited `2` / NO-GO because backup settings remain
incomplete, prepared evidence is absent, and `pg_dump`, `pg_restore`, `psql`, `age` and Docker are missing.
It observed the existing owned watcher active (PID `22734`, `loginAutoStart: false`); current source/code
verification awaits the settled-source receipt. This observation is not cloud or cutover readiness.

### Provision and rehearse the target

- Provision the selected cloud host, persistent encrypted volumes, independent backup store,
  network rules and TLS. Review current PostgreSQL/extension/service versions and image pins.
  The upstream lock presently marked offline/unverified cannot authorize image preparation.
- Build fan/API and portal images using the release source and cache all platform images.
  `runtime_images.py prepare --help` explains the exact image map, verified upstream lock and
  configure inventory. `check` verifies archives offline. `load` produces a plan by default;
  `--execute --overrides-dir NEW_PRIVATE_DIR` loads into Docker and emits reviewed overrides
  using exact content IDs and `pull_policy: never`.
- Deploy a preparatory app build using an owned stable API domain to supported clients.
  The optional `compose.gateway.yml` routes only allowed Supabase endpoints to one backend;
  review Host/SNI, TLS and Realtime WebSocket behavior. Existing binaries compiled with
  `PROJECT.supabase.co` cannot be redirected through our DNS. Existing media URLs, offline
  queues, auth callbacks and supported old clients need explicit transition tests.
- Keep configuration and decryption custody independently available: signing keys/JWKS,
  Auth configuration/MFA compatibility, SMTP, OAuth redirect/provider secrets, Edge settings,
  database extensions/jobs/network functions, and Stripe callbacks/test mode.
- Restore a recent encrypted backup on an isolated compatible stack and stage bulk files.
  Historic approved/expired Beyond and Fan Zone objects require **bytes before application
  guards**, reviewed Storage owner reconciliation, then database guard restoration. If owner
  FKs require Auth UUIDs, preload only the independently reviewed Auth TOC selection first.
  Follow the exact guarded sequence in [migration/README](../../../infrastructure/migration/README.md)
  and [CLOUD_MIGRATION_RUNBOOK](CLOUD_MIGRATION_RUNBOOK.md).
- Capture source and target catalog/actor-access evidence; restore source revocations with
  reviewed `parity.py grant-sync` SQL. A prior synthetic restore reopened2,059 privileges.
  Full Supabase container/Auth/Storage behavior is still unproved by that synthetic drill.

## 5. Original evidence required

Copy the strict readiness configuration outside Git with mode600. Set actual target,
current release directory, explicit source/target API origins and database host/port/name,
image receipt, evidence directory and encrypted backup with its
**separately protected original SHA256**. Default backup freshness is7hours, evidence168hours.
Database fingerprints include the sanitized connection identity used by the capture CLI;
Storage catalogs contain their inspected origin/connection. Both must exactly match the
protected configuration. The operator independently verifies those configured endpoints;
the gate does not discover live network ownership from a hostname.
Every gate is a private `GATE.json` with exactly:

```json
{
  "schemaVersion": 1,
  "gate": "database-parity",
  "releaseVersion": "64-lowercase-hex-content-hash",
  "targetId": "aws-rehearsal",
  "checkedAt": "2026-10-19T12:00:00Z",
  "result": "passed",
  "acceptedBy": "actual-independent-reviewer",
  "attachments": [{"id": "source-fingerprint", "path": "/private/operator/source.json", "sha256": "original-file-sha256"}],
  "details": {"backupSha256": "protected-final-backup-sha256"}
}
```

This incomplete illustration cannot pass. Include all original reports and the exact detail
fields in [readiness.py](../../../infrastructure/exit/readiness.py), not free-text pass notes.

| Gate | Required observed acceptance |
| --- | --- |
| `target-ready` | Prepared isolated host, loaded images, durable volumes and TLS. |
| `source-deployed` | Target build and smoke from this exact checked release. |
| `database-parity` | Original `source-fingerprint` + `target-fingerprint`; checker reruns schema/functions/policies/grants/triggers/rows/actor-access comparison. Complete service/Auth coverage required. |
| `storage-bytes-and-ownership` | Original `source-storage-catalog` + `target-storage-catalog`; checker compares keys/owners/MIME/size. Separate full object hash readback, restored historical guards and cross-user private denial. |
| `auth-sessions-mfa` | Restored sign-in, same UUIDs, session/refresh transition, OAuth callbacks, MFA enrollment/challenge/aal2 and encryption compatibility. |
| `service-contracts` | Every inventoried call reviewed/tested, all dynamic sites reviewed, REST/RPC, Realtime, Storage and allowlisted Edge functions. |
| `installed-clients` | Owned stable origin installed; supported old versions, sessions, historical media and offline writes tested. |
| `configuration-custody` | Current independently recoverable keys/configuration; isolated SMTP and provider callbacks reviewed. |
| `financial-writer-control` | One writer, provider event reconciliation, no duplicate credits and preserved payout gates. |
| `rollback` | Measured rollback, post-switch writes reconciled and old-client policy tested. |
| `monitoring` | Backup/job/service alerts actually delivered with a named response owner. |
| `timed-rehearsal` | Full warm-target run including rollback; original observations, aware start/finish timestamps, complete positive stage times summing to observed duration≤180minutes. |

Hashes detect changed reports; unsigned operator records do not authenticate a real observation.
Independent QA/Data/Auth/Finance/Infrastructure acceptance remains necessary. Placeholder,
stale, future, counts-only, missing owner data and partial evidence result in NO-GO.

## 6. Rehearse the warm cutover

These are planning budgets, not measured results. Measure every stage and total elapsed time.
The final source must stay frozen or a new release and affected evidence are required.

| Stage key | Minutes | Work |
| --- | ---: | --- |
| `freeze-final-capture` | 30 | Quiesce app/provider writers; capture final consistent data and configuration. |
| `transfer-and-restore` | 55 | Retrieve/verify/decrypt final copy; reconcile file delta and run reviewed restore. |
| `reconcile-grants-ownership` | 20 | Accept owner plan, complete historical guard state and reconcile revoked grants. |
| `database-parity` | 25 | Compare complete source/target fingerprint, data, owners and actor access. |
| `service-auth-smoke` | 20 | REST/RPC/Auth/MFA/Realtime/Storage/Edge and financial contract checks. |
| `route-clients` | 10 | Switch one reviewed gateway backend; verify supported clients and media. |
| `finance-and-reopen` | 10 | Reconcile provider events and restore one authoritative writer. |
| `rollback-margin` | 10 | Exercise planned rollback and account for any new writes. |
| **Total** | **180** | Prepared target and bulk preparation required. |

The final fingerprint, Storage and Finance records must bind the final backup SHA and postdate
its capture. Finance must assert writers remain quiesced before `--phase cutover` acceptance.
`pnpm exit:preflight --evidence-config /private/operator/readiness.json` uses this final phase.
An accepted check reads evidence only; the authorized operator performs the reviewed routing
and reopen steps. Source changes/failed tests/late stages stop the switch and invoke rollback.

Storage snapshots use a separate transaction from `pg_dump`. A live backup detects listed
object/owner changes but cannot guarantee database/media consistency while writers run.
Quiescing all relevant writers or an independently proven delta strategy is required during
final capture. Large data volume can exceed these budgets; rehearsal determines feasibility.
Sequence values are not MVCC snapshots. The final freeze must also stop Auth and other
sequence-consuming writers while capturing and reconciling their counters. All-Auth TOC
selection includes detected original sequence SET entries; an already-ahead target can be
preserved only under the explicit checked plan and independently accepted parity warning.

## 7. Remaining operational work and migration failures

[MIGRATION_FAILURES_AND_CONTROLS](MIGRATION_FAILURES_AND_CONTROLS.md) records local failures,
controls and historical references with their retrieval limits. Cloud selection/provisioning,
actual independently retained data, service-version compatibility, installed-client release,
alert delivery and full timed rehearsal remain assigned work before claiming readiness.
Local executor/review/check evidence is recorded in [REDUNDANCY-03](../../agents/REDUNDANCY-03.md).
