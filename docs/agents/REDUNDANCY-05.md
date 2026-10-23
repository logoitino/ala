<!-- Actual private backup setup and read-only operational status handoff; no live service readiness implied. -->
# REDUNDANCY-05 — private setup and operational readiness

**Request/date:** owner2026-10-20: continue exit preparation; selected “Prepare a private setup template first”.
**Executor:** Codex `/root`, REDUNDANCY_LEAD/EXIT_SYNC with EXIT_CLOUD/RECOVERY/DOCUMENTATION.
**Status:** implemented locally; actual final verification is governed by the protected external receipt below, never by template presence.

## Baseline and decision

The current-login source watcher captured a newer app version automatically. A raw source copy
is current but its newer code was not yet verified. This machine lacks pg_dump/pg_restore/psql/age,
Docker and provider/infra CLIs; there is no private full-source backup connection configuration.
No live database/Storage backup, cloud destination, source backup timer or hosted rehearsal exists.

Prepare one fresh private external setup folder with deliberately incomplete credentials/encryption/
destination inputs. Add one read-only health command that keeps content, code, exact process
liveness and original scan age distinct, then checks source-bound backup age and original prepared
acceptance with existing strict validators. Always report readyToCutOver:false. No source secrets,
provider probes, key generation, job installation or traffic changes are authorized by this step.

Success: setup cannot overwrite any existing destination or follow links; six payload files are
private and hash-accounted. Empty templates cannot pass backup readiness. Manual status reads
cannot refresh original scan/capture clocks. Database source changes inside the same private file
invalidate old upload receipts. Retry cannot relabel an unbound or other-source encrypted archive.
Missing tools/configuration/evidence produce explicit NO-GO and fixed reason codes.

## Actual assignments

All actors are Codex sessions in the shared checkout; repository role/model configuration is unchanged.

| Runtime | Owned responsibility |
| --- | --- |
| `/root` | `health.py`, `health_source.mjs`, read-only `watcherStatus`, health/sync tests, package aliases, Data/Infrastructure/sensor registries and generated maps, tracker/index/STATE/CHANGELOG integration |
| `/root/cloud_deployment` | `setup.mjs`, `setup.test.mjs`: private fresh template layout, native exclusive atomic publication, exact payload/mode manifest and safety tests |
| `/root/recovery_review` | `job.py`, `status.py`, minimal `backup.py` actual-used-source binding plus scoped tests; independent health/setup read-only review |
| `/root/redundancy_documentation` | Exit README, EXIT_READY_RUNBOOK and BACKUP_OPERATIONS reconciliation and actual Documentation checks |

## Interfaces and planned custody

`pnpm exit:setup --output-dir NEW_EXTERNAL --source-url PUBLIC_ORIGIN --source-state-dir EXISTING_PRIVATE`
creates config/{backup.env,backup-job.json,health.json}, credentials/{source.pgpass.example,recipients.txt},
state/backup-status/, data/backups/, README.md and SETUP_MANIFEST.json. Directories700/files600.
Actual source passfile, CA trust material, encryption identities, service key and cloud destinations
must be supplied separately in private custody. Placeholder generation is not runtime activation.

`pnpm exit:health [--config-file PRIVATE_EXTERNAL]`: exit0 accepts preparation observations;
exit2 NO-GO incomplete/missing/stale; exit3 invalid private health config. No config observes
source/tools but leaves backup/prepared evidence unconfigured. Config uses source scan120s,
backup capture7h/run2h defaults, explicit expected source origin and an optional existing
strict prepared-readiness config. Matching code/release/target/current source is required.

Planned fresh operator folder: `/Users/seiuliian/Downloads/ala-sports-backup-setup-20261020`.
No real runtime readiness is inferred from placeholder files or synthetic tests.

## Verification and handoff

Actual commands/results and independent review receipts will be appended after execution.

### Executed private setup and focused checks

Actual fresh setup creation PASS at the planned private path. Original manifest verification PASS:
`b33b75058f05c97dd0049be973d24045ba6a248ae46210ac493956d87caf6115`.
Generator explicitly reports incomplete:true, readyToCutOver:false, backupCreated:false and
servicesActivated:false. Original templates remain unchanged; future filled configuration is
validated by runtime tools, not by pretending the original template hash still applies.

Actual configured health exit2 NO-GO: backup config is intentionally incomplete, prepared evidence
is not configured and pg_dump/pg_restore/psql/age/Docker are missing. Existing exact watcher
PID22734 was active, loginAutoStart:false; source changes were still underway during this observation.

Focused setup+sync35 tests PASS; public-origin3 tests and health16 tests PASS. Health now also
checks current app configured public URLs against the expected source project; only targeted
public URL fields are parsed as data, no private key values are returned or expanded. This closes
the gap where a private app environment change was excluded from the safe source archive.
Documentation executor reconciled three entry points and passed275-document local links.
Full integrated verification and independent review are recorded next after execution.

### Independent review and final verification custody

RECOVERY independently reproduced and closed three concrete health findings: missing per-app and
production dotenv coverage, optional server SUPABASE_URL divergence, and prepared proof describing
another source despite matching app code/target. Both client origins and any server override must
agree across standard dotenv modes/process inputs. Prepared source URL and PG host/port/database
now match the current original-source-bound backup; backup binding additionally includes PGUSER.
Prepared evidence remains independently accepted unsigned operator evidence and is not a
same-login guarantee for shared poolers. Root reviewed the actual capture/manifest identity and
protected retry implementation. Scoped final gates:60backup,17health,15readiness,5origin tests PASS.
Documentation executor actually reconciled the three entry points and passed275-document links.

Final wrapped full-code verification command:
`pnpm exit:sync sync --verify-code` (runs complete `pnpm check` while holding the source lock).
Scoped macOS idle-sleep inhibition protects only this bounded check; earlier OS autostart blockers
remain unchanged. The watcher is paused for the verified promotion and restarted immediately
after it. No live backup or provider is executed by this verification.

Protected external result custody:
`/Users/seiuliian/Downloads/ala-sports-exit-verification-20261019/redundancy-05-final-verification.json`
and companion `redundancy-05-full-check.log`. The receipt records actual exit status, verified
source/current watcher observations, original setup integrity and configured NO-GO health.
Only the executed receipt supports final pass/runtime claims; absent/failed/stale receipts do not.
Keeping final receipts outside the checkout avoids changing the source after its verification.

Pending operational work remains explicit: install PostgreSQL/age/Docker tools; privately supply
verified source connection, Storage service key, trusted CA/passfile, independently held encryption
custody and reviewed cloud destinations; configure/rehearse the backup timer, actual remote
retrieval/decrypt/isolated restore; prepare accepted target/images/Auth/Storage/Realtime/finance/
client-switch/rollback/alert evidence and measure a complete warm2–3hour rehearsal.
This private template turn activates no live jobs/providers or cloud resources.

### 2026-10-23 · EXIT_SYNC source-release umask fixture

Receipt: `infrastructure/exit/tests/setup.test.mjs` pins the empty existing destination to mode 0755 with `chmod` after `mkdir`. Under umask 077, `mkdir` mode 0755 is masked to 0700, so the refusal assertion saw 448 instead of 493 before `createSetup` ran. `createSetup` still rejects through `absent()` and does not chmod an existing destination. Workflow `umask 077` in `.github/workflows/exit-release.yml` stays. This receipt is a local test fix, not backup activation, hosted readiness, or a review of the 61 open exit notices.
