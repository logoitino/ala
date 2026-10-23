<!-- Exact source releases and independent readiness evidence keep the existing app portable without a second implementation. -->
# Current exit release

Start with [EXIT_READY_RUNBOOK](../../docs/engineering/exit/EXIT_READY_RUNBOOK.md).
The source release carries the same app, SQL, migrations, Edge adapters and infrastructure
code used by this checkout. Running self-hosted Supabase preserves its interfaces. Moving
to a different Auth/API implementation is a separate exit B project.

| File | Responsibility |
| --- | --- |
| [release.mjs](release.mjs) | Capture and verify the exact source capsule, expanded app and content inventory. |
| [sync.mjs](sync.mjs) | Refresh the derived map, keep private current-source cache/status and manage the optional local watcher. |
| [watcher.mjs](watcher.mjs) | Start/stop the owned detached watcher for the current login and retain its process receipt. |
| [setup.mjs](setup.mjs) | Create a fresh private external folder of incomplete backup/health templates; no credentials, capture or services. |
| [health.py](health.py) | Combine read-only source, backup records, tool availability and prepared-evidence checks; never authorize a cutover. |
| [readiness.py](readiness.py) | Read current release, image archives, protected backup and original accepted evidence; return NO-GO on incomplete or stale proof. |
| [runtime_images.py](runtime_images.py) | Prepare immutable Docker-loadable service/app images; check hashes and target architecture; plan or explicitly load them. |
| [readiness.config.example.json](readiness.config.example.json) | Invalid placeholder to copy into a private external configuration; never proof of readiness. |

## Automatic local source snapshots

Run from the repository root with Node 24, pnpm and Python 3 (the Unix kernel-lock helper).
Automatic service installation supports macOS; elsewhere run `watch` under an independently reviewed service manager.

`pnpm exit:sync` keeps a private source cache outside the checkout. It copies the full governed safe source,
including uncommitted app/SQL/infrastructure/docs changes, into an integrity-checked expanded exit release.
The updater refreshes the generated exit map; acknowledgements, routed notices and partner reviews remain
separate. The default local watcher does **not** run full code verification. Its snapshot is source preparation, with
`codeVerification` retained as actually observed; it cannot grant release approval, database protection or GO.

```sh
TAPUAI_EXIT_STATE="${HOME}/Library/Application Support/Tapuai/exit-source"
pnpm exit:sync sync --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3
pnpm exit:sync status --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source
pnpm exit:sync watch --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
```

Use private external directories on encrypted storage; the local macOS default is shown above. `sync` captures
once when content needs a new capture. `watch` performs an initial sync on every restart and sweeps source content every 30 seconds by default, plus
capture latency. It checks source stability before accepting a new package. This is polling, not a promise to
capture every save event. An unchanged package is verified/reused without resetting its original capture time.
Continuous edits or hard capture failures leave the prior snapshot historical.

`latest.json` records the actual accepted capture's original time, path, content version and code verification.
`status` checks current full safe-source content, package integrity and the last failed attempt; a previous
capture or a timestamp alone cannot establish current source. Failed capture retains the old pointer and
reports failure. Status exits 0 for current source and 2 for stale/failed/invalid state; CLI argument/command
errors exit 1. Source current does not attest watcher process liveness or code/map correctness. A completed
derived-map generation with semantic validation findings may retain a raw draft with
`mapValidation.outcome: failed` and unverified code; the explicit full check still fails. Privacy, symlink,
ambiguous-format or write errors block capture. Three updater-owned cache releases are retained by default
(`--keep 3`), including when unchanged content is reused; retention never
removes arbitrary manual exports, encrypted backups or another operator's artifacts.

### Observed current-login watcher

The managed detached watcher was observed running on 2026-10-20 at `05:29:15.995Z` (still 2026-10-19 in
America/Denver), initial PID `29080`, runtime `detached-process`, 30-second interval and
`loginAutoStart: false`. The original/current process receipts and later observations are retained in
[REDUNDANCY-04](../../docs/agents/REDUNDANCY-04.md); a PID is an observation, not a permanent identifier.
Use the current-login commands:

```sh
pnpm exit:sync start --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
pnpm exit:sync stop --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
```

Start manages the detached source-only process. Stop checks the captured exact process identity/command and
preserves snapshots; do not substitute an arbitrary `kill PID`. Source/failure status is separate from process
liveness. Repeat start after logout, restart or process loss until normal OS startup installation is available.
This does not activate a database/cloud watcher.

### Catch up at checks and session end

`pnpm check` calls `exit:sync ensure` after all quality/map guards pass. The Claude Stop guard also calls
`ensure` after its derived-map refresh on every stop pass. These entry points capture current source even
when the watcher has stopped or login startup is unavailable:

```sh
pnpm exit:sync ensure --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3
```

Ensure performs an exact capture/reuse, or reports `outcome: deferred`, `sourceCurrent: null` when another
capture holds the valid OS lock. Deferred means no new success was claimed. Other errors fail `pnpm check`;
the Stop guard warns and pushes back once, then allows the active stop cycle to exit. It never acknowledges
notices, completes reviews, writes the Git index or grants readiness.

### Optional macOS login startup

Normal installation is a separate local action for login startup:

```sh
pnpm exit:sync install --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
pnpm exit:sync uninstall --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000
```

The installer manages its owned `com.tapuai.exit-source` LaunchAgent in `~/Library/LaunchAgents` after checking
ownership. Uninstall requires the exact original settings; use it before changing the installed configuration.
It stops/removes that service and leaves snapshots retained. Cache ownership binds repository root and target;
do not reuse another checkout's state. These are prepared instructions;
installation and observed running/current status must be recorded separately in
[REDUNDANCY-04](../../docs/agents/REDUNDANCY-04.md). They do not activate cloud jobs.

**Observed installation limit (2026-10-19):** this session's tools received OS `EPERM` while writing the normal
`~/Library/LaunchAgents/com.tapuai.exit-source.plist`, including the elevated attempt. Persistent login startup
was not installed by those attempts. This was an OS permission failure, not an automatic approval rejection.
The additional `--session-only` LaunchAgent attempt used an owned private `stateDir/launch-agent.plist`:

```sh
pnpm exit:sync install --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000 --session-only
pnpm exit:sync uninstall --state-dir "$TAPUAI_EXIT_STATE" --target-id local-source --keep 3 --interval-ms 30000 --session-only
```

That valid external-plist bootstrap also failed with launchctl error 5 (`EIO`), including the elevated attempt;
**no LaunchAgent was loaded**. `--session-only` has `loginAutoStart: false` and would not promise restart/login
persistence even if accepted. Use `start` for the observed current-login fallback above. Prefer normal
installation once authorized Terminal/OS access permits it; stop the detached instance before changing runtime
mode, and uninstall any actually installed session-only service with its original settings first.

For an explicitly checked source capture, run `sync` with `--verify-code`, which runs `pnpm check`; use separate
manual release directories for durable reviewed releases. Kernel locking serializes captures, while an owned
deletion journal resumes interrupted retention work without selecting unrelated artifacts. The updater performs
no automatic map acknowledgement, partner review, Git index/commit write, hosted SQL/Storage operation,
secret/provider/image backup or cloud deployment.
Secrets/configuration custody, real data, runtime archives and independent cloud copies use their own workflows.

On macOS, verified capture now runs `/usr/bin/caffeinate -i pnpm check` with the same 600-second deadline;
Linux still runs `pnpm check` directly. A prior laptop idle-sleep interval lasted 693 seconds and caused the
wrapper deadline to fail despite passing test output; a separate awake check passed in 115 seconds.
The idle-sleep assertion lasts only for the verification command. Forced lid sleep or power loss still fails
closed. The ordinary raw source watcher does not prevent sleep or promise sweeps while the laptop sleeps.

## Private backup setup and unified health

Use a new absolute external output directory, an existing owned private source-cache directory and the
reviewed public Supabase HTTPS origin. Set `TAPUAI_SOURCE_ORIGIN` to that actual origin; it is public metadata,
not a credential. The generator refuses existing destinations and does not change the source cache:

```sh
TAPUAI_BACKUP_SETUP=/private/operator/new-backup-setup
pnpm exit:setup --output-dir "$TAPUAI_BACKUP_SETUP" --source-url "$TAPUAI_SOURCE_ORIGIN" \
  --source-state-dir "$TAPUAI_EXIT_STATE" --source-target-id local-source
pnpm exit:health --config-file "$TAPUAI_BACKUP_SETUP/config/health.json"
```

Generated mode-700 directories contain mode-600 `config/backup.env`, `config/backup-job.json`,
`config/health.json`, empty public `credentials/recipients.txt`, `credentials/source.pgpass.example`,
`README.md` and `SETUP_MANIFEST.json`. `data/backups/` and `state/backup-status/` start empty.
Database/service-role credentials are blank; the real `source.pgpass` and private age identity do not exist.
Destinations are `[]` and readiness is `null`: the packet deliberately reports incomplete preparation.
The setup manifest proves original template hashes/modes, not valid credentials or backup readiness;
editing templates changes those original hashes. Follow [BACKUP_OPERATIONS](../../docs/engineering/BACKUP_OPERATIONS.md)
to configure and independently test the real job, custody and recovery evidence. Setup starts no job or service.

`pnpm exit:health` without a config observes the default local source cache/tools and reports backup and
prepared evidence as not configured. With the strict private config, source health requires exact current
content, passed code verification, valid map, the exact owned watcher alive and an actual scan no older than
120 seconds; future scan times fail. Backup health checks the current source identity against protected job
records and the expected Supabase origin, with seven-hour capture/two-hour running-attempt thresholds.
Tool presence is reported locally; no provider is contacted. Prepared evidence is evaluated by the existing
`readiness.py --phase prepared` gate and must bind this source version and target.

Health exits `0` when all preparation observations are accepted, `2` for missing/stale/incomplete observations,
or `3` for invalid private health configuration. Its output always has `readyToCutOver: false`.
A passing preparation check does not authorize traffic changes or replace the independent cutover gate.

**Observed setup (2026-10-20):** `/Users/seiuliian/Downloads/ala-sports-backup-setup-20261020` was created
and original template integrity passed. The generator reported `incomplete: true`, `backupCreated: false`
and `servicesActivated: false`. Its actual health invocation exited `2` / NO-GO: backup configuration is
intentionally incomplete, prepared evidence is not configured, and `pg_dump`, `pg_restore`, `psql`, `age`
and Docker are missing. The owned detached watcher was observed active (PID `22734`, no login autostart);
that observation does not establish current code verification while source edits continue.

## Verified release and readiness

```sh
pnpm exit:inventory > /private/operator/exit-inventory.json
pnpm exit:release create --output-dir /private/operator/releases/new-release --target-id aws-rehearsal --verify-code
pnpm exit:release verify /private/operator/releases/new-release --current
pnpm exit:readiness --config-file /private/operator/readiness.json --phase prepared
pnpm exit:preflight --evidence-config /private/operator/readiness.json
```

Use a new output directory, private parent directories and `umask 077`. Example paths require
operator setup. Source release verification does not restore data or prove service behavior.
Readiness returns0 for accepted evidence,2 for NO-GO,3 for invalid configuration/artifacts.
It never contacts a provider or changes traffic. Acceptance records are unsigned private
operator evidence: their hashes detect changed files, not fabricated observations.

The source-only [CI workflow](../../.github/workflows/exit-release.yml) is prepared for all branch pushes,
all PR targets, manual dispatch and a daily default-branch safety sweep, with 30-day artifact retention.
It first captures raw current source, then attempts `--verify-code`. Failed checks retain the bounded raw
source artifact with failed job/status evidence; artifact availability does not mean verification passed.
Separate provenance binds the actual checkout/input commit, PR head/base when applicable, workflow run/attempt,
latest pointer and manifest/source hashes. This unsigned metadata records the observed scope, not readiness.
CI transports the source state/provenance as `tapuai-exit-source-bundle.tar.gz` plus its `.sha256` sidecar inside the downloaded artifact;
the tar envelope preserves private directories/files and executable source modes that artifact ZIP transport
otherwise normalizes. Check the unsigned archive checksum, inspect the expected relative members, then unpack
into a new private external directory while preserving modes. Its members are
`tapuai-exit-source-state/` and `tapuai-exit-source-provenance.json`. From extracted
`tapuai-exit-source-state/latest.json`, identify the actual `releases/UUID` path and verify that **release**:

```sh
pnpm exit:release verify /private/operator/retrieved/tapuai-exit-source-state/releases/ACTUAL_POINTER_UUID
pnpm exit:release verify /private/operator/retrieved/tapuai-exit-source-state/releases/ACTUAL_POINTER_UUID --current
```

Use `--current` only to compare against this checkout's exact current source. CI cache state records its
ephemeral runner repository path; it is not adopted as this machine's `exit:sync status` state. The release
verifier is portable. Checksum/provenance are unsigned integrity/context evidence, not a signature or checked
code result. Thirty-day CI retention is finite and does not replace a durable independent source backup.
No actual GitHub run/push happened in this session. Runtime images, database backups, credentials and rehearsal
acceptance require separate operator jobs. See [BACKUP_OPERATIONS](../../docs/engineering/BACKUP_OPERATIONS.md).
