<!-- REDUNDANCY_LEAD / EXIT_DATABASE / EXIT_SERVICES design review: distinguish observed local failures, external pointers and unmeasured RTO proposals. -->
# Migration failures, controls and a three-hour exit target

**Prepared:** 2026-10-19. **Owners:** REDUNDANCY_LEAD with EXIT_DATABASE / EXIT_SERVICES / EXIT_CLOUD; RECOVERY, SECURITY, RELEASE and QA retain their domain gates. **Status:** local evidence and design requirements; no complete hosted migration or 180-minute recovery has been demonstrated.

## 1. Scope and reading path

This page explains why provider moves fail and connects each failure to an existing safeguard or a specific remaining test. It extends the [Redundancy & Exit charter](REDUNDANCY_TEAM.md), [generated exit map](EXIT_INFRASTRUCTURE_MAP.md) and [PORTABILITY](PORTABILITY.md); it does not create another component inventory. Commands remain in [CLOUD_MIGRATION_RUNBOOK](CLOUD_MIGRATION_RUNBOOK.md), [BACKUP_OPERATIONS](BACKUP_OPERATIONS.md) and [migration tooling](../../infrastructure/migration/README.md). Release-bound warm-target acceptance is coordinated by [EXIT_READY_RUNBOOK](EXIT_READY_RUNBOOK.md) and the [exit toolkit](../../infrastructure/exit/README.md).

The owner's target is a continuously current full-app exit and a **two-to-three-hour switch**. The bounded planning ceiling here is **180 minutes** for a preprovisioned, configured, rehearsed target with previously built images and retrieved data. It is a target to test. A fresh cloud account, cold machine, full dependency/image download, first Auth/service configuration and new mobile-store release form a different critical path; no three-hour promise is established for that path.

## 2. External company references and research limits

External search on 2026-10-19 returned URL/title pointers for the following reports. The content-loading tool explicitly denied the official GitHub and Cloudflare page bodies because external webpage access is disallowed in the current security mode. No alternate route was used to bypass that restriction. Search results supply references, not reviewed facts, quotations or outage figures.

| Company / report pointer | Reference status in this session | Historical pattern to investigate, not a newly verified finding |
| --- | --- | --- |
| GitHub — [October 21 post-incident analysis](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/) | Official URL/title discovered; page load denied | Network-partition/failover decisions, database divergence, restore/reconciliation time and the choice to preserve data integrity |
| Cloudflare — [Cloudflare service outage June 12, 2025](https://blog.cloudflare.com/cloudflare-service-outage-june-12-2025/) | Official URL/title discovered; page load denied | A storage/control dependency can affect many otherwise separate services; investigate real independence of providers and recovery controls |
| GitLab — [Postmortem of GitLab Database Outage of January 31](https://www.linux.com/news/postmortem-gitlab-database-outage-january-31/) | Secondary URL/title discovered; official postmortem not located/read through available tools | Wrong-target operator actions and unusable/unrehearsed backup paths are well-known historical discussion points; recheck the primary report before assigning exact causes or timelines |

These are outage/failover/recovery references relevant to migration design, not proof that those companies attempted Tapua'i's proposed cloud migration. The pattern descriptions draw on prior historical knowledge and remain **unverified against report text in this session**. Do not publish numeric comparisons or attributed conclusions from them yet.

On an authorized internet-enabled research session, the reviewer should read the primary reports, preserve report date/URL and bounded excerpts, distinguish confirmed root causes from contributing conditions, and record which proposed controls actually apply. Meanwhile, the concrete requirements below come from Tapua'i's inspected source and local drill evidence; external reading is not needed to establish the observed local defect.

## 3. Observed local failure: a valid restore reopened revoked grants

[REDUNDANCY-01](../agents/REDUNDANCY-01.md) records the 2026-10-19 synthetic custom-dump drill using actual PostgreSQL 18.6 client binaries against two PGlite servers. The raw restore reopened **2,059 `anon` / `authenticated` / `PUBLIC` rights** that the source had revoked, because target stack default privileges differed. It was correctly blocked by parity. The reviewed `grant-sync` repair generated 2,599 statements, after which parity passed; a deliberately dropped policy then blocked again.

The server in that drill was PGlite with Supabase stubs, not a real pinned Supabase service stack. The dump used `--inserts` because that socket adapter could not stream COPY. Preserve those limitations when reporting the result.

This demonstrates why matching table rows and `pg_restore` exit status are insufficient. A target can contain the right data and still grant guests access the source denied. [parity.py](../../infrastructure/migration/parity.py) compares grants, RLS, policy/trigger/function definitions, access results, sequences, publication membership, migration history and row hashes; its `grant-sync` generates reviewed privilege reconciliation. A hosted target still needs real-user negative tests and independent acceptance before reopening.

This grant finding is separate from expiring/revoked **business permissions**. Old snapshots can also reintroduce removed content, guardian-consent state, expired tokens or deleted accounts even when PostgreSQL grants match. That needs temporal/domain tests as described below.

## 4. Failure-to-control matrix

“Existing” means inspected local code/procedure, not a hosted guarantee. The final column is required work/evidence before the exit is called ready.

| Failure pattern / local exposure | Existing control and source | Remaining build or test / owner |
| --- | --- | --- |
| Target defaults reopen revoked rights | [parity.py](../../infrastructure/migration/parity.py) compares exposed grants and generates `grant-sync`; local drill caught 2,059 reopened rights | Real target grant/default-ACL reconciliation; anonymous, signed-in, admin and guardian denial/readback against the actual compatible stack. EXIT_DATABASE / RLS_SECURITY / QA |
| Database structure or migration history drifts while app changes | [exit-map.mjs](../../scripts/exit-map.mjs), routed [EXIT_CHANGE_LOG](../agents/EXIT_CHANGE_LOG.md), [toc_review.py](../../infrastructure/migration/toc_review.py), catalog/row/access parity | Bind source release, deployed migration inventory and reviewed target to one dated proof; rehearse additive and permission-changing migrations. Map notices need actual owner review, not just acknowledgement. EXIT_SYNC / DATABASE_MIGRATIONS |
| DB snapshot and Storage bytes describe different moments | [backup.py](../../infrastructure/backup/backup.py) performs full dump, API discovery/reconciliation and before/after inventory checks; quiesced mode records operator freeze evidence | Freeze/drain every writer, capture source fingerprint at that same boundary, reconcile files to rows and prove uploads/deletes stopped. Online checks are not atomic cross-store proof. RECOVERY / STORAGE |
| Historical files fail to upload after application guards are restored | Beyond and Fan Zone guards reject historical replay; [restore.py](../../infrastructure/backup/restore.py) supplies an explicit bytes-before-DB phase and refuses guarded uploads after DB restore. [storage_reconcile.py](../../infrastructure/migration/storage_reconcile.py) generates owner-only plans and validates logical parity while retaining target backend IDs | Inspect actual owner FKs and preload required Auth owners through a separate reviewed list; exclude duplicate Auth data from the final main list before its hash is bound to the byte receipt. Preload bytes, review/apply owners before app guards, then continue DB-only using the bound receipt. Independently verify logical catalog parity, bytes, restored guards, historical private access and reservation/finalization functions. No live guard disable or whole-catalog override. RECOVERY / EXIT_DATABASE / STORAGE |
| Backup path works only on the primary's credentials/control plane | Unified [job.py](../../infrastructure/backup/job.py) accounts for all destinations; [fetch.py](../../infrastructure/backup/fetch.py) uses a separate reader and protected original ciphertext digest | Prove archive, checksum, age key, cloud identity, secrets/custody, image registry and DNS access survive primary/provider loss; retrieve/decrypt from every destination. RECOVERY / SECURITY / EXIT_CLOUD |
| Old installed clients still use the managed endpoint | [mobile Supabase client](../../apps/mobile/src/frontend/lib/supabase.ts) reads build-time `EXPO_PUBLIC_*`; Next and Expo container builds also compile public URLs | Preinstall/release a supported endpoint strategy and test old/current builds, session reset and offline queues. A target env change cannot rewrite shipped binaries. RELEASE / AUTH / EXIT_SERVICES |
| Full media URLs keep loading from the old provider, or private media becomes public | [media.ts](../../apps/mobile/src/frontend/lib/media.ts) can resolve legacy public URLs and `sb:` refs; Vault remains a separate authorized path | Finish/audit every reel, avatar, logo, photo-story and private-media reader; test old hostname removal, target key resolution, signed/private revocation and expiring links. Preserve expand/contract writer gates. STORAGE / PLAYBACK / UPLOAD |
| Auth rows restore but sign-in, JWT, MFA or OAuth fails | Explicit `toc_review.py --include-all-auth-data` requires complete source/bare-target Auth/service evidence and matching detected tables; all Auth row hashes include sessions/tokens/flows/MFA. Exact existing target Auth rows are preserved; conflicting rows block without deletion. Optional encrypted custody and runtime-neutral [token checks](../../supabase/functions/_shared/money/accessToken.ts) | Test matching GoTrue schema/encryption/signing mode, issuer/JWKS, Apple/Google redirects, password/refresh/logout, MFA auxiliary state and profile UUID/signup triggers. Narrow Auth mode cannot stand in for full parity. Preserve live session checks for payouts/Connect. AUTH / SESSION_SECURITY |
| Both old and new sites write money or accept queued stale writes | [migration runbook](CLOUD_MIGRATION_RUNBOOK.md) requires one authority, freeze and provider-event reconciliation; shared money core and existing crediting/payout gates | Demonstrate old writer fencing, offline-queue behavior, webhook/provider-event preservation and finance reconciliation before reopening. Do not replay an old ledger over later Stripe activity. COMMERCE / FINANCE_DATA / INTERNAL_CONTROLS |
| Restored clock/retention state reactivates expired, deleted or revoked business access | Timestamp-aware [status.py](../../infrastructure/backup/status.py) retains original capture age; SQL parity compares stored rows/definitions | Check UTC/clock sync, token deadlines, guardian/consent revocation, removed/private content and post-snapshot deletions. Reapply approved corrections before public access; preserve audit evidence. AUTH / PRIVACY_ENGINEERING / domain owners |
| Realtime, functions or server routes are missing despite a healthy database | Generated exit map tracks services/API/functions; [configure.py](../../infrastructure/supabase/configure.py) stages allowlisted adapters and shared core; private publication/policy parity | Run actual private Broadcast/changes, subscription-denial, Node route and Edge handler tests on target; verify provider-specific secrets. Current webhook exclusion/credit gates remain intentional. REALTIME / API / EXIT_SERVICES |
| Downloads, builds and restore throughput exceed the switch window | Locked Dockerfiles; [runtime_images.py](../../infrastructure/exit/runtime_images.py) prepares/checks Docker-loadable image archives and load receipts; [release.mjs](../../infrastructure/exit/release.mjs) / [readiness.py](../../infrastructure/exit/readiness.py) bind release/rehearsal evidence | Prebuild/cache immutable images, resolve trusted service pins, stage data artifacts and benchmark full DB/file transfer. Runtime image archives are not the required private env/Edge mounts or a functional smoke proof. First dependency/image downloads and store review cannot fit an unmeasured three-hour claim. EXIT_CLOUD / RELEASE / RECOVERY |
| Retry, time skew or stale success falsely reports recovery healthy | Job lock/config fingerprint/atomic records, protected exact receipt reuse, status 0/2/3 and original capture age; incomplete Azure publication remains a failure | Test actual timer/service identity, provider failure/partial object conflicts, clock anomalies, monitoring and delivered alert. Local job health is not remote integrity or functional recovery. RELIABILITY / RECOVERY |

The matrix is a required-control checklist. It does not turn unimplemented provider adapters, old-client handling, a continuously synchronized target or hosted alarms into current features.

The historical Storage sequence is now expressed by executable local interfaces in
[CLOUD_MIGRATION_RUNBOOK sections 6A–6E](CLOUD_MIGRATION_RUNBOOK.md): conditional Auth-owner preload →
`restore.py --storage --storage-before-database` → read-only target catalog → generated owner-only plan and
separate reviewed operator application → `restore.py --storage-preload-receipt` DB-only continuation → final
`storage_reconcile.py compare`. The byte receipt binds source manifest, final reviewed TOC and target URL/DB
tuple. The final database receipt still requires independent metadata acceptance. Local tests cover missing
owner/MIME/size data, SQL delimiter/object-name collisions, actual ownership-FK checks and receipt mismatches;
the ownership SQL has not been executed against the real compatible target stack in this session.

Database parity now hashes **all detected Auth data tables** and records exact service schema/function/security
metadata, with strict `coverageComplete` required. Storage service-table **counts** do not prove exact ownership
or file contents. The source/target logical catalog comparison and full byte SHA-256 readback are separate gates;
their success does not replace restored guard/policy and real-user function/access tests.

Full Auth opt-in also requires detected sequence definitions/grants and read-only last_value/is_called evidence.
Original detected Auth SET entries are selected exactly once, with already-ahead target counters preserved;
missing/unknown state blocks. This prevents restored refresh-token rows from outpacing their next generated ID.
The pre-import schema gate permits only source-restored `supabase_migrations` history to be absent on a bare
target, with original schema/table/data coverage required and exact post-restore history parity unchanged.

## 5. What “continuously current” must prove

A source/map hash detects a change. It does not synchronize live rows, rebuild/deploy the target or prove every feature works there. A current full-app exit needs a versioned packet tying together:

- Reviewed source release and dependency/image digests, the exit-map version and open routed owner reviews.
- Actual primary migration/schema/config/service version inventory, not just canonical source SQL or a CLI-linked project name.
- Last successful encrypted capture, original capture time, every destination receipt and independently protected original digest; actual retrieval/decryption/restore evidence.
- Target baseline/version, applied compatible migration/config inventory and service/data/access parity for the release being accepted; original source/final target Storage catalogs, bound byte receipt and independently accepted owner reconciliation/guard/function evidence.
- Auth/media/API/Realtime/finance smoke receipts, supported installed-client versions, old-writer fencing and accepted session/logout/offline behavior.
- Cloud/storage/identity/DNS/key-custody independence, alert response and measured stage durations/data volumes.

Whenever those inputs change, the previous proof becomes historical for the affected scope. EXIT_SYNC routes the change, component owners update/rehearse their affected controls, and REDUNDANCY_LEAD accepts the new packet. Backup capture includes current accessible data/source each run; that alone does not prove a currently deployed standby.

## 6. Proposed 180-minute warm-target exercise

**Prerequisites before starting the clock:** approved reachable target cloud/region; compatible pinned Supabase stack already configured and rehearsed; app/API/admin images already built and available independently; secret/provider/DNS access tested; recent encrypted archive/file base already staged; installed supported clients; reviewed restore/ACL/migration plan; staffed finance/security/QA operators; measured data volumes/throughput. Confirm whether disaster access to the source still exists; source-outage recovery has a different loss/reconciliation boundary from a planned migration.

| Elapsed target window | Action / accepted evidence | Stop condition |
| --- | --- | --- |
| 0–15 min | Declare one incident/change owner, inspect packet/source/target identity, confirm operator/key access and fence old writes | Identity, key custody or single-writer authority cannot be proved |
| 15–35 min | Planned move: drain/freeze, preserve external events, record provider cursor and final consistent capture; disaster: identify newest independently recoverable boundary | Missing freeze, unavailable restore point or unaccounted provider events |
| 35–95 min | Verify original archive/hash; conditionally preload Auth owners, load/verify bytes, review/apply owner metadata before app guards, then continue final DB using the bound receipt | Corruption, partial restore, incompatible service schema/ownership FK or transfer cannot fit measured budget |
| 95–120 min | Reconcile reviewed grants/default privileges, fingerprint target, compare schema/rows/access/publications and apply accepted privacy/deletion corrections | Any blocking parity/access/temporal finding |
| 120–150 min | Confirm Auth/MFA/session/media/API/Realtime and financial reconciliation; check prebuilt service and installed client against target | Any failed required feature, unexplained money row, wrong provider or old writer still active |
| 150–165 min | Owner-authorized endpoint/DNS/client transition, one writer enabled, controlled reopening | Unsupported installed-client path or missing release/QA/finance acceptance |
| 165–180 min | Observe new writes/access/payment/file signals; confirm target backup/independent-copy monitoring and record outcome | New safety/finance inconsistency; use the reviewed post-write repair plan |

These numbers allocate a proposed exercise budget; no stage duration has been measured against the actual hosted project. A full final capture and every object restore may exceed 60 minutes for larger datasets. If the measured critical path cannot fit, pre-stage/version unchanged objects through a reviewed incremental design, revise the target or keep the exit blocked. Do not silently omit data/tests or claim success by stopping the clock before clients/finance/access work.

Before target writes, rollback may return to the preserved compatible source after inspection. After target writes or payment events, changing DNS back alone loses new state; freeze/reconcile/forward-repair before selecting one authority. A timer, source capsule, green parity result or successful HTTP health endpoint does not settle that boundary.

## 7. Acceptance and next evidence

Accept the 180-minute target only after a complete timed rehearsal of the actual service stack with supported installed clients and the representative full data/file payload, including failure/rollback boundaries and the ordered historical Storage/Auth/owner phases. Also rehearse the primary unavailable, an independent cloud copy unavailable, expired keys/tokens, old clients and lost operator workstation.

Record actual date/executor, source/target versions, data size, per-stage elapsed time, optional/failed checks, reviewer decisions and next owner in the existing redundancy task record. Keep external incident reading marked unverified until an authorized researcher reads the reports. Local checks and a proposed timeline establish reviewable preparation; a continuously current working exit and two-to-three-hour switch remain unproved until those receipts exist.

## Additional local preparation findings

The REDUNDANCY-03 review found that full Auth rows without their original sequence values
can collide on the next refresh/sign-in; the complete Auth restore proposal requires detected
sequence state/SET coverage and final parity. It also keeps already-identical target Auth
seed records and permits only the explicitly restored application migration-history namespace
to differ before import. Actual compatible-stack execution remains pending.

A fresh isolated build initially used dependency symlinks outside its source tree; Next tracing
and Expo Metro failed. Cloning the complete installed dependency layout into that private
preview allowed both exports and local HTTP smoke to pass. This supports preparing complete
Linux image archives before an outage; a source archive alone cannot build when dependency
access/layout is unavailable. Target images, service behavior and elapsed cutover are separate gates.
