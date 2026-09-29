# Database migrations

Started 2026-09-29 (docs/CODE_ORGANIZATION_PLAN.md step 1). Every database change from now on is a
new timestamped file in this folder, applied in filename order.

We are **not** moving hosts. This folder exists so the database history is plain, ordered SQL that
anyone can read — and, if Tapua'i ever has to move to another Postgres host, can replay in order.

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

## Baseline — optional, not done (needs live database access)

Only needed before a clean rebuild or a move. It needs the project's database password. The owner, once:

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
| `20260929130000_payout_gate_without_school.sql` | Payouts unlock with Stripe ID check + one undisputed claim, $250 cap until 3 teammate vouches or school confirmation; `athlete_vouches` + vouch RPCs. [Design §9](../../docs/ATHLETE_VERIFICATION_DESIGN.md) | **No.** Needs `20260929120000` and `supabase/custodial_money.sql` (`custodial_accounts`, `athlete_controls_money`) first |
| `20260929140000_school_badge.sql` | School logo / colours, `athlete_school_badge`, `admin_set_school_branding`, no ✓ in names. [Design §10](../../docs/ATHLETE_VERIFICATION_DESIGN.md) | **No.** Needs `20260929120000` first |
| `20260929160000_reel_views_and_filmer_credit.sql` | `reels_feed` gains `view_count` / `uploader_name` / `uploader_avatar_url`; `athlete_highlight_views`, `filmer_stats` | **No.** Needs `supabase/leaderboards.sql` (`reels.view_count`) first |
| `20260929170000_filmer_rewards.sql` | Filmer Aura (tag confirmed, view milestones, Props), `filmer_rewards` ledger, `filmer_props`, `give_filmer_props`, `get_top_filmers`, `filmer_stats` v2 | **No.** Needs `20260929160000` first |

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

## Setting a school's crest (after the school badge migration)

```sql
select public.admin_set_school_branding(
  '<schools_and_teams.id>', 'https://example.org/crest.png', '#1D3F8F', '#FFFFFF');
-- logo must be https (or null for a monogram shield); colours #RRGGBB
```
