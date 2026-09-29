# Database migrations

Started 2026-09-29 (docs/CODE_ORGANIZATION_PLAN.md step 1). Every database change from now on is a
new timestamped file in this folder, applied in filename order.

## Rules

1. **One change per file**, named `YYYYMMDDHHMMSS_short_name.sql` (UTC). Supabase CLI layout, so
   `supabase db push` and `supabase migration list` work once the CLI is available.
2. **Header on every file:** purpose, link to the design doc, and how to roll back.
3. **Never edit a file that has been applied** to staging or production. Fix forward with a new file.
4. **Idempotent where cheap** (`create or replace`, `if not exists`, `drop trigger if exists`), so a
   re-run on staging is harmless.
5. **Copy the file onto the end of `apps/mobile/src/backend/db/schema.sql`** under a header, until
   that file becomes generated (plan step 1.4). `pnpm docs:check` reads `schema.sql`, so new tables
   and RPCs must also go into `docs/SCHEMA.md`.
6. Secrets (team codes, confirmer tokens) never go in a migration. Create them at run time — see
   "Adding a school confirmer" below.

## Applying (owner or approved engineer)

Staging first, then production.

- **With the Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`.
- **Without the CLI:** open the SQL Editor, paste the file, run it once. Then record it:
  `insert into supabase_migrations.schema_migrations (version, name) values ('20260929120000', 'athlete_verification_ladder');`
  (skip this line if the `supabase_migrations` schema does not exist yet — the baseline step creates it).

## Baseline — not done yet (needs live database access)

This folder has no baseline, because the live schema can only be read with the project's database
password. The owner, once:

1. `supabase db dump --schema public -f supabase/migrations/20260928000000_baseline.sql` against production.
2. `supabase migration repair 20260928000000 --status applied` so production knows it has the baseline.
3. Diff the baseline with `schema.sql`. Each difference is either a standalone `supabase/*.sql` file
   that was never applied (turn it into a migration) or dead SQL (delete it).
4. Move the standalone `supabase/*.sql` files to `supabase/legacy/`.

The baseline's timestamp must sort **before** `20260929120000`.

## Files

| File | What | Applied? |
| --- | --- | --- |
| `20260929120000_athlete_verification_ladder.sql` | School-confirmed athlete verification: claims go to "pending", the athletic director or coach confirms in person with a 6-digit code; closes the self-verify and name-match holes. [Design](../../docs/ATHLETE_VERIFICATION_DESIGN.md) | **No.** Staging first. No dependency on the other unapplied files |

## Adding a school confirmer (after the verification migration)

In the SQL Editor (a direct session counts as admin):

```sql
select public.admin_add_school_confirmer(
  '<schools_and_teams.id>', 'Ana Tui', 'ana.tui@school.org', 'athletic_director', null);
-- or 'coach' with a sport, e.g. 'Rugby', to limit the link to that team
```

It returns `{id, token, link}` once. Send the `link` (`alasports://school-confirm?t=…`) to that
staff member's **school email** only. The token is stored hashed and cannot be shown again; to
replace a lost link, `select public.admin_revoke_school_confirmer('<id>');` and add a new one.
