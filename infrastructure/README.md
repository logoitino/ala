<!-- Recovery operator folder map; distinguish built tools from activated hosted operations. -->
# Tapua'i independent recovery and server migration

This folder contains locally implemented recovery/deployment tools. No cloud account, VM,
bucket, scheduler or production backup was created. A single VM is a single point of failure.
Cloud redundancy here is an independent encrypted recovery copy and a prepared replacement
host; automatic failover, database replication and WAL/PITR are separate work.

| Folder | Purpose | First command |
| --- | --- | --- |
| `backup/` | Export Supabase database and every accessible Storage file; encrypt, publish every configured copy, monitor, retrieve, verify and restore | Read [backup/README.md](backup/README.md) |
| `migration/` | Propose the reviewed restore list from the dump TOC; fingerprint source and target; reconcile privileges after restore; block cutover on any database difference | Read [migration/README.md](migration/README.md) |
| `exit/` | Exact expanded source release, content inventory, runtime image archives and current evidence gate | Read [exit/README.md](exit/README.md) |
| `containers/` | Expo SDK 58 fan web/API, standalone Next oversight portal, Caddy TLS | Read [containers/README.md](containers/README.md) |
| `supabase/` | Verified exact upstream bootstrap; private ports; allowlisted Edge adapters | Read [supabase/README.md](supabase/README.md) |
| `terraform/aws/` | Independent private S3/KMS/IAM; optional dedicated Linux VM | Read [terraform/README.md](terraform/README.md) |
| `terraform/azure/` | Independent private versioned Blob/RBAC/firewall; optional Linux VM | Read [terraform/README.md](terraform/README.md) |

Operational setup: [BACKUP_OPERATIONS](../docs/engineering/BACKUP_OPERATIONS.md) covers the private
job config, all-destination completion, snapshot-age health checks and reader-only retrieval.
The service and six-hour timer are prepared; neither is installed or activated.

Current source preparation and the unproven180-minute warm cutover target:
[EXIT_READY_RUNBOOK](../docs/engineering/EXIT_READY_RUNBOOK.md). Source-only CI release artifacts
are prepared; current data, image cache, supported installed clients and timed hosted evidence
remain independent requirements.

Local verification: `pnpm check` passes; Next standalone and Expo production exports pass with
synthetic public settings; the actual Expo host serves fan HTML and refuses an unauthenticated
checkout. Docker images, Terraform provider validation and live Supabase restore remain untested.

Keep deployment source under this folder. Keep runtime credentials, private database/media
exports, age identities, cloud var files/state and fetched Supabase trees **outside the
checkout**, for example `/etc/tapuai`, `/var/lib/tapuai`, and `/opt/tapuai` on the operator host.
A reviewed source recovery capsule and the data backup are both needed after a complete loss.
Cloud IAM encryption is additional protection; the separate age identity remains necessary.

Before a cutover, verify source/target PostgreSQL and extension compatibility, migration
history, auth/OAuth/SMTP settings, object counts/hashes, payment settings, callback URLs and
client builds. Existing native EAS builds and OTA updates remain their own release process;
these containers host web/API only. Keep historical native builds compatible through the
cutover and plan their API-origin and Supabase public-variable rebuild/update.

See [portability](../docs/engineering/PORTABILITY.md) and
[environment decisions](../docs/engineering/ENVIRONMENTS_AND_HOSTING.md) for existing gates.
