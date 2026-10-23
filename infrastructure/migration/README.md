<!-- REDUNDANCY-01 database migration checks: what the restore list and parity tools prove, and what they do not. -->
# Database migration checks — restore list and parity

Part of [REDUNDANCY-01](../../docs/agents/REDUNDANCY-01.md). These tools sit between `backup/verify.py` and a cutover
decision. They answer two questions the backup tools leave to a person:

1. **Which entries of the dump do we restore into a fresh Supabase stack?** `toc_review.py` proposes the reviewed
   list that `backup/restore.py --use-list` requires.
2. **Did the restore preserve database behavior and data?** `parity.py` compares application and all detected
   Auth row hashes, service schema/functions/security, Storage counts, sequences and realtime.
3. **Did Storage preserve logical ownership without overwriting backend identifiers?** `storage_reconcile.py`
   captures private catalogs, generates reviewed owner-only SQL and compares keys, owners, MIME and size.

Connections require explicit operator commands and private credentials. SQL plans are never applied by these
tools. Fingerprints and lists describe
the source schema, row counts and migration history: the tools write them owner-only (mode 600), as new files,
and refuse paths inside the checkout.

## Where it fits in the restore

| Step | Command | Result |
| --- | --- | --- |
| Freeze writes (cutover only) | [CLOUD_MIGRATION_RUNBOOK](../../docs/engineering/exit/CLOUD_MIGRATION_RUNBOOK.md) | Quiesced backup evidence |
| Fingerprint the source **at the backup moment** | `python3 infrastructure/migration/parity.py fingerprint --env-file /etc/tapuai/source-readonly.env --out /var/lib/tapuai/restore-drills/source.json` | One read-only snapshot |
| Back up, decrypt, verify | `backup.py`, `verify.py` (see [backup/README](../backup/README.md)) | Private stage with `database.toc` |
| Propose the complete compatible exit list | `python3 infrastructure/migration/toc_review.py --toc STAGE/database.toc --out /var/lib/tapuai/restore-drills/reviewed.list --report /var/lib/tapuai/restore-drills/review.md --include-all-auth-data --source-fingerprint /var/lib/tapuai/restore-drills/source.json --target-fingerprint /var/lib/tapuai/restore-drills/target-bare.json` | Explicit full Auth opt-in; exit 0 = no undecided entries; 2 = entries need a person; 1 = refused |
| DATABASE_MIGRATIONS + RLS_SECURITY review | Read `review.md`; uncomment only what you accept | Reviewed list |
| Restore historical Storage, then database | Follow the phase order below | Bound byte-preload and DB receipts |
| Fingerprint the target | `parity.py fingerprint --env-file /etc/tapuai/target.env --out /var/lib/tapuai/restore-drills/target.json` | |
| Compare | `parity.py compare source.json target.json --report /var/lib/tapuai/restore-drills/parity.md` | Exit 0 = PASS, 1 = BLOCKED |

Run the source fingerprint as a role that bypasses row level security (Supabase `postgres`), otherwise counts are
filtered and the compare refuses. Use `--no-row-hash` on very large databases to compare counts only; the report
says so.

## What the restore list keeps and leaves out

| Kept | Left out (commented with the reason) | Needs a person |
| --- | --- | --- |
| Every application object in the source fingerprint's schemas, currently `public` and `fan_zone_private` (tables, rows, functions, policies, RLS switches, grants, triggers, sequences and their values, views, types); realtime table membership; migration history (`supabase_migrations`); explicitly accepted Auth data scope below | Supabase-managed DDL (auth, storage, realtime, extensions, vault, graphql, …), `CREATE SCHEMA public` and its comment/grants, extensions (the target installs them; parity checks they exist), event triggers, the publication itself, Auth data outside the selected opt-in scope or already exact on target, Storage bucket/object rows (the pre-DB API byte phase creates target backend rows; reviewed owner SQL follows) | Default privileges (`DEFAULT ACL`), anything unrecognised, objects outside the named schemas |

The legacy `--include-auth-data` proposes only users, identities and MFA factors. Default/narrow modes still
exclude sessions, refresh tokens, flows and other Auth data; they cannot satisfy the new full Auth parity gate
when those rows are present. Credential-bearing rows need the same compatible Auth version and keys.
With the source fingerprint, the tool **refuses** a list that
leaves Auth rows out while public tables reference `auth.users` (that restore would fail on the foreign key), and
refuses a list missing any source table or its rows. If a separately reviewed preliminary Auth import is required
for Storage ownership FKs, reviewers omit those already-loaded Auth data entries from the **final** main list;
the preliminary import and exclusion are recorded together. Do this before the byte-preload receipt binds the
final list. Do not repeat Auth data imports or install signup/app guards during that preliminary phase.

### Explicit full Auth state

`--include-all-auth-data` is separate from the narrow flag; they cannot be combined. It requires complete
source and bare-target fingerprints with distinct recorded database identities, unfiltered reads, matching
detected Auth table sets and exact service function/schema compatibility. It proposes only original detected
Auth `TABLE DATA` and compatible detected `SEQUENCE SET`, never source Auth schema/sequence DDL overwrites.
Every detected table and sequence state must occur exactly once in the original TOC.
Unknown/missing/duplicate data entries or incomplete fingerprints block the output file.

The detected set includes sessions, refresh tokens, flow state, MFA auxiliary tables and Auth migration rows
when they exist. Nonempty target Auth data is preserved only if source/target count and exact digest already
match; the corresponding original TOC entry is commented to avoid duplicate import, and the report lists
`preservedAuthTables`. Conflicting existing rows block without automatic clearing/deletion. If a service
baseline or dataset needs targeted preparation, independently review the isolated procedure and recapture
before proposing the list; do not erase seeded migration rows merely to pass the gate.

`coverage.authSequenceDefinitions`, declared sequence keys/count, exact definition/ownership/grants and captured
`last_value` / `is_called` are required, including an explicit empty inventory when no Auth sequences exist.
The proposal keeps only detected original Auth `SEQUENCE SET` entries; unknown/missing/duplicate entries or
incompatible sequence state block. Already-ahead target counters are preserved/commented instead of replaying
a lower source state (`preservedAuthSequences`); final parity rejects a counter behind the source. Capture is
read-only and never calls `nextval`. This protects future refresh-token IDs; restored token rows alone do not.

Pre-import schema matching makes one exception: source-restored `supabase_migrations` history may be absent on
the bare stack. The original history schema/table/data TOC entries are still required; post-restore service
schema and migration-history parity remain exact. This does not waive an Auth/Storage/Realtime version mismatch.

This is a reviewed data proposal. Compatible GoTrue version, table constraints/restore order, JWT/encryption
keys, issuer, live-session/MFA behavior and signup triggers still need independent acceptance. Full Auth hashes
are always captured, even when application `--no-row-hash` is chosen. Source/target Auth services must be fenced
from token/session mutations during final capture and acceptance. A narrow diagnostic restore is not a full
exit proof.

Accept the exact restored Auth baseline before login/refresh/logout smoke tests mutate sessions/tokens.
Preserve that evidence and record later authorized test mutations/cleanup separately.

## Historical Storage: bytes before application guards

Beyond and Fan Zone guards reject historical uploads/owner changes once application SQL is present. The safe
sequence is a fresh isolated compatible Supabase stack, optional reviewed Auth-owner preload, Storage bytes,
reviewed owner reconciliation, then application database restoration. No live guard is disabled.

Use the detailed commands in [CLOUD_MIGRATION_RUNBOOK section 6](../../docs/engineering/exit/CLOUD_MIGRATION_RUNBOOK.md)
and [backup/README](../backup/README.md). Exact interfaces are:

```sh
python3 infrastructure/backup/restore.py /secure/drills/run-001 \
  --env-file /etc/tapuai/restore.env --use-list /secure/reviewed.list \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --storage --storage-before-database --execute
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore.env \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --out /secure/target-storage-pre-app.jsonl
python3 infrastructure/migration/storage_reconcile.py plan \
  --stage /secure/drills/run-001 --target-catalog /secure/target-storage-pre-app.jsonl \
  --out /secure/storage-owners.sql --report /secure/storage-owners-plan.json
```

The first command restores **no database SQL** and writes `restore-storage-preload-ID.json`, with ownership
pending. Capture includes encrypted `storage-catalog.jsonl`; the plan restores only declared compatible
`owner` / `owner_id` fields. It refuses incomplete/duplicate object coverage, unknown MIME/size, missing declared
owners, source identity, incompatible owner columns and application guards. New target IDs, physical versions,
timestamps and backend metadata are retained. Actual target ownership FKs determine whether matching Auth users
must already exist; unsupported FKs require a separate reviewed procedure.

DATABASE_MIGRATIONS / RLS_SECURITY review the private SQL and establish target PG connection variables on the
isolated operator machine. Applying the plan is a separate attended `psql` action: set session
`tapuai.restore_target` to the inspected target URL before loading the file. The generated transaction checks
that assertion/database name, unchanged target object IDs/coverage, absence of app guards and each actual Auth
ownership FK. The generator does not connect or execute the write plan. Preserve independent review/application
evidence; a generated report has `sqlExecuted: false`.

Continue using the **actual** preload receipt filename and the unchanged final main list:

```sh
python3 infrastructure/backup/restore.py /secure/drills/run-001 \
  --env-file /etc/tapuai/restore.env --use-list /secure/reviewed.list \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --storage-preload-receipt /secure/drills/restore-storage-preload-ID.json --execute
python3 infrastructure/migration/storage_reconcile.py snapshot \
  --env-file /etc/tapuai/restore.env \
  --confirm-isolated-target http://127.0.0.1:8000 --confirm-database-host 127.0.0.1 \
  --out /secure/target-storage-final.jsonl
python3 infrastructure/migration/storage_reconcile.py compare \
  --source /secure/drills/run-001/storage-catalog.jsonl --target /secure/target-storage-final.jsonl \
  --report /secure/storage-logical-parity.json
```

The continuation uploads no bytes. It requires the preload receipt's source-manifest hash, target URL,
database host/port/name and reviewed TOC hash to match, then creates a committed DB receipt. Metadata remains
`requires-independent-acceptance`. Logical compare exits 0 for PASS, 2 for blockers, 1 for invalid input;
physical ID/version/timestamp differences are reported without copying source backend fields. Missing values
on both sides never establish parity. File SHA-256 readback, restored app guards/policies and real-user
historical private-media/reservation-function tests remain separate required evidence.

## Access parity — the app sees the same rows

`access.sql` reads every application table as `anon`, the three lowest `auth.users` ids and the lowest-id admin, through row level
security, and records counts and row hashes (errors by SQLSTATE). `compare` blocks any table a given identity sees differently on the
target. It catches an Auth layer that evaluates `auth.uid()` or claims differently even when the schema is identical (PGlite proof),
and found that guests cannot read `public.rallies` once function-access hardening is applied (see STATE §5). Skip with `--no-access`.

## What parity blocks

Missing or changed table/column/constraint/trigger/policy/function/enum; any **extra** policy (permissive policies
OR together and can widen access); row level security switched off; a changed `anon` / `authenticated` / `PUBLIC`
grant or function execute right; a security definer function that lost its `search_path` or runs as another owner;
a sequence behind the source (the next insert collides); a table missing from `supabase_realtime`; a different row
count or row hash in an application table or any detected Auth table, or row-count differences in selected
Storage service tables; exact captured service schema/function/security/grant drift;
migration versions the target lacks; a side
fingerprinted without row level security bypass. Application table owners, extension/server version drift,
missing application indexes and extra application objects can be warnings. Exact captured service owners,
schemas, indexes, function behavior and grants remain blocking compatibility checks.

Row hashes compare each row's text form under fixed session settings (UTC, ISO dates, full float digits, hex bytea),
order-independently. They are exact: a copy that turns `numeric 25.00` into `25` is a different row — which is what
a lossy copy really did, and why the local proof copies rows as record text, like `pg_restore` does.

A PASS proves the recorded database scope only. It does not compare full Storage service rows by digest.
`compared.coverageComplete` must also be true for strict readiness: legacy function-name lists, missing exact
service definitions/grants or partial Auth inventories cannot become full-exit evidence.
Storage logical owner/MIME/size comparison above, bytes (`restore.py` re-downloads and hashes every object), Auth sign-in
with the target keys, provider settings, RLS denial smoke tests, finance reconciliation and installed clients are
separate gates in the runbook.

## Local proof (synthetic data, no hosted database)

```text
pnpm redundancy:test                                   # 20 unit tests: list rules, restore.py accepts the list, compare rules
node infrastructure/migration/pglite-parity.mjs <pglite dist>
node infrastructure/migration/local-drill.mjs <postgres 18 client bin> <pglite dist> <pglite-socket dist>
```

- `pglite-parity.mjs` builds the real `schema.sql` twice (source with `fixtures/synthetic-seed.sql`, target filled
  by a record-text copy) and checks that a faithful copy passes and eleven kinds of bad restore are blocked.
- `local-drill.mjs` runs the unmodified `psql`, `pg_dump` and `pg_restore` binaries against two PGlite servers
  (pglite-socket on 127.0.0.1): fingerprint → custom-format dump → proposed list → `pg_restore` with `restore.py`'s
  exact flags → parity PASS → one dropped policy BLOCKED. A native PostgreSQL server could not start on the owner's
  Mac (System V shared memory is blocked by machine policy), hence PGlite as the server.

PGlite 0.5.9 is the version CI pins by hash; pglite-socket and the PostgreSQL client tools are fetched or built
outside the repo. None of them is a project dependency. Results and dates are recorded in REDUNDANCY-01.

## Not proven here

The target in both proofs is PostgreSQL with Supabase stubs, not the pinned Supabase images. A real drill still has
to show the restore against the actual GoTrue/Storage/Realtime versions, Auth sign-in with restored users, and the
timed end-to-end RTO. `pg_dump` must be at least the source server's major version.

Full-app release and warm-target acceptance are coordinated by [EXIT_READY_RUNBOOK](../../docs/engineering/exit/EXIT_READY_RUNBOOK.md)
and the [exit toolkit](../exit/README.md). The ownership plan has local generation/mock coverage; execution against
the actual compatible Supabase target and functional Storage/Auth acceptance remain unproved.
