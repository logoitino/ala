<!-- Engineering/Recovery/Security operator handoff; no approval to restore a hosted database or running release. -->
# Code and database recovery

## Source versions

1. Create `pnpm recovery:package --verify-code` after edits settle. It runs the complete local gate,
   rejects source changes during verification, then records source/dependency/schema/migration hashes.
2. Retain the private `.tapuai.gz` and matching `.metadata.json` together. Register only metadata at
   `/admin/support` → Recovery. The server records the reporting admin and time; local packaging
   provenance is hashed, and uncommitted authorship remains unknown.
3. `pnpm recovery:verify PACKAGE` validates all file/provenance hashes, sizes and paths.
4. `pnpm recovery:restore PACKAGE` creates a new private `.smoke/recovery/restores/RELEASE` preview.
   Existing previews are refused. The working project, deployed app and database stay intact.
5. In that preview install locked dependencies and run the code tests. Compare its schema/migration
   hashes against the actual deployed migration inventory; old code must tolerate the current schema.
   QA checks affected features, access and money flow. SECURITY checks package provenance and release
   authority. RELEASE obtains owner approval before switching the running version.

Hashes prove integrity against a recorded digest. Production distribution needs trusted signing or
an externally protected manifest store; a database owner or attacker able to replace all unsigned
artifacts can recompute hashes. Git records committed authors; timestamps alone do not identify a
person who edited uncommitted code. Versioned dependency patches are part of the package.

## Database backups

RECOVERY and DATABASE_MIGRATIONS own hosted backup/PITR enrollment, retention, encryption and access;
PRIVACY_ENGINEERING reviews personal-data handling. Keep database artifacts outside source packages
and this repository. Record protected backup reference, provider timestamp, DB/schema version,
encryption/access owner, retention expiry and restore-rehearsal evidence in the operator record.
Credentials never go into admin notes, signals, screenshots or source.

Before approving use of a backup, restore it into a separate isolated project/database with outgoing
payments, email and public access disabled. Check schema, row counts, RLS/auth boundaries and the
chosen source version. Reconcile the financial journal with the payment provider and identify every
transaction after the snapshot. A successful source-package restore is not a database-backup rehearsal.

An old database snapshot must never silently become the live money ledger: it can lose recent
transactions while the external payment provider still has them. Prefer compatible code rollback
against the current database, or a reviewed forward database repair. Any actual hosted restore or
PITR cutover needs the owner, finance controller, security lead, backup rehearsal and transaction
reconciliation. Preserve original audit/incident records and the current backup before cutover.

## Feature containment and recovery

Features remain ordinary in-process modules. Screen/feature boundaries and fixed source scopes make
failures attributable without creating a service/process per feature. Async/global failures retain
normal platform handling and produce bounded signals when capture is activated. A known transient
Highlights read can retry once; authorization, money, publication, delete and other writes never
repeat automatically. Expected cancellation/session expiry stays distinguishable from attacks.

SUPPORT routes evidence to the source owner through Team flow; SECURITY validates suspected attacks
and false positives; the developer repairs; independent QA verifies; RECOVERY/RELEASE package and
rehearse; TELEMETRY/RELIABILITY observe after release. A fresh occurrence reopens review.
