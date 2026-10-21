# Exit drill runbook (E3): prove we can leave managed Supabase

**Owner:** `INFRASTRUCTURE` keeps this runbook ready. The drill itself is run by `BACKEND`, `RELIABILITY` and
`COST_OPERATIONS` ([ENVIRONMENTS_AND_HOSTING](ENVIRONMENTS_AND_HOSTING.md) E3). Owner decision 2026-10-14: stay on
managed Supabase, with self-hosted Supabase as the rehearsed exit ([PORTABILITY](PORTABILITY.md) exit A).
**Status: ready to rehearse locally (step 0). The full drill waits for the E1 baseline.** A machine with Docker and an
approved temporary cloud VM are also needed. Synthetic data only, ever.

## Why

The exit is only real once it has been done. The drill measures how long a move takes, which steps break, and what is
missing from the repo. Each run updates this page and the [infrastructure register](INFRASTRUCTURE_REGISTER.md).

## Step 0 — local rehearsal (works today, no cloud)

1. `pnpm check` is green, including `pnpm infra:register:check` and `pnpm app:data-boundaries`.
2. `node scripts/replay/schema-replay.mjs <pglite dist>`. The whole database rebuilds from the repo on a plain
   PostgreSQL and passes every check (currently 111).
3. `node scripts/gen-db-types.mjs <pglite dist> --check`. The generated database types match the schema.
4. Read the register's "How deeply we are integrated" table and note any increase since the last drill.

Record the date, executor, results and gaps in §5.

## Step 1–6 — full drill (after E1; quarterly)

The [cloud migration runbook](CLOUD_MIGRATION_RUNBOOK.md) and
[infrastructure folder](../../infrastructure/README.md) now provide executable preparation for
these steps. Their local synthetic tests do not replace this drill; the operator must supply a
reviewed upstream commit/checksum/image inventory and compatible isolated PostgreSQL target.

| Step | Do | Pass when | Who |
| --- | --- | --- | --- |
| 1. Prepare | Approve a temporary VM: owner approval for its cost (a few dollars), US region, synthetic data only. Install Docker and the self-hosted Supabase stack (current upstream instructions; verify the version) | Stack starts; Studio reachable only from the drill machine | `RELIABILITY`, `COST_OPERATIONS` |
| 2. Database | Apply the E1 baseline and the migrations after it in order, never by hand-pasting. Then load the synthetic seed | Same objects as `schema.sql`; the replay checks pass against it (point the replay or `psql` at the VM) | `BACKEND`, `DATABASE_MIGRATIONS` |
| 3. Config and secrets | Set the auth providers (email only for the drill), the JWT keys, Storage buckets from `infrastructure.json`, the Edge Function secrets by name (from the register; test-mode values only) | Every env var name in the register has a value or is marked not needed | `INFRASTRUCTURE`, `SECURITY` |
| 4. Server functions | Deploy the Edge Functions from `supabase/functions` (shared core in `_shared/`) | `create-payment-intent` returns a test-mode intent; `create-stripe-account` refuses an unauthenticated call | `COMMERCE`, `API` |
| 5. App against it | Point a development build (or Expo web) at the VM: `EXPO_PUBLIC_SUPABASE_URL` / anon key | Sign up, sign in, browse Highlights, upload one photo, cast a cheer vote, see a live score update | `QA`, `RELIABILITY` |
| 6. Tear down and record | Destroy the VM and its disks; confirm nothing billable remains | Cost recorded; §5 updated; gaps filed in WORK_QUEUE | `COST_OPERATIONS`, `INFRASTRUCTURE` |

**Time target:** the first drill measures the time; later drills aim to shorten it. **Stop if** real data appears
anywhere, a secret would leave the approved store, or the cost goes beyond what was approved.

## What the drill does not prove

A drill does not prove that live data and files can be moved without downtime. That needs a planned migration window,
a file copy, user export, and DNS / app config changes. It also does not prove that a different provider (exit B)
works. Those are planned when a trigger fires (PORTABILITY §6).

## Record

| Date | Executor | Steps run | Result | Time | Gaps filed |
| --- | --- | --- | --- | --- | --- |
| 2026-10-14 | Claude session (root) | Step 0 items 1–4 | `pnpm check` green (135 suites / 1,076 tests); replay 111/111; `gen-db-types --check` ok (66 tables, 3 views, 238 functions); register: 48 direct Supabase calls outside `lib/`, 0 in routes | — | Full drill blocked on the E1 baseline, Docker and VM approval |
