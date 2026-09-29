# Code organization plan — reviewable, migratable, well-noted

**Status:** proposal, 2026-09-29. Nothing below has been done. Steps 0 and 1 need the owner:
step 0 is a commit, and step 1 reads the live database.

## Why

- **Nothing is committed since 2026-09-27.** There are 549 changed files. About 500 are mode-bit
  flips from a NAS copy (STATE §3), and they bury the roughly 50 real changes. No reviewer can
  review this.
- **The database has no migration history.** `apps/mobile/src/backend/db/schema.sql` (7,044 lines)
  is the canonical copy, and 52 files in `supabase/*.sql` repeat parts of it, kept in sync by hand.
  Nobody can say which of them the live database has. STATE §5 already lists three files
  "not applied". A new engineer cannot rebuild the database from the repo with confidence, and
  moving to staging or another host means re-applying files by hand in the order in SCHEMA.md.
- **Database types are written by hand.** `types/database.ts` (1,163 lines) drifts from the real
  schema every time an RPC is added.
- **A few files are too big to review:** `lib/adminCatalog.ts` 1,193 lines, `types/database.ts`
  1,163, `components/Reels/ReelCard.tsx` 1,160, `UploadVideoModal.tsx` 1,148, `lib/admin.ts` 922,
  `app/operator/[gameId].tsx` 914.

Already good, keep it: folder law in AGENTS.md, CONVENTIONS.md, STATE.md, CI (typecheck,
`docs:check`, jest, leaked-key check, STATE guard), and the `@purpose` comments on library functions.

## Step 0 — make the current work reviewable (owner OK needed)

1. `git config core.fileMode false`. This is a local setting. It hides the ~500 mode flips
   without changing any file.
2. Commit what is there in topic commits, so each can be reviewed on its own: review fixes and
   tester prep; the structure pass; Activity and hype; wallet pay; leaderboards; custodial; docs.
   Stage by path. Never `git add -A`.
3. From then on, one topic per branch and pull request, using the template in step 4.

## Step 1 — real database migrations (Supabase CLI)

The target is the standard Supabase layout:

```
supabase/
  config.toml
  migrations/
    20260929000000_baseline.sql        ← dumped from the live database, not written by hand
    20260930120000_verification_ladder.sql
    ...
  seed.sql                              ← demo data only, never real people
  functions/                            ← Edge Functions (already here)
```

1. **Baseline from what is actually live.** `supabase db dump --schema public` against the live
   project → `migrations/<timestamp>_baseline.sql`. Then `supabase migration repair <timestamp>
   --status applied`, so the live database records that it already has the baseline. Read-only
   plus one history row; the owner runs it or approves it.
2. **Compare the baseline with `schema.sql`.** Every difference is either a file that was never
   applied (apply it as a new migration) or dead SQL (delete it). This one pass settles STATE §5's
   "not applied" rows.
3. **Every later change is a new timestamped migration file**, reviewed in a PR and applied with
   `supabase db push`, staging first and then production. Never edit an applied migration.
4. **Retire the copies.** `schema.sql` becomes generated (`supabase db dump` into it, marked
   "generated — do not edit"). The 52 standalone files move to `supabase/legacy/` with a README,
   then get deleted once the baseline covers them.
5. **CI:** start a throwaway local Postgres (`supabase db start` or a `postgres` service
   container), apply every migration from zero, and fail if any breaks. This is the "no Postgres
   on this Mac" gap from STATE §4 closed for good.

Moving hosts later is then `supabase db push` against the new project, or plain `psql -f` over
the migrations folder in order. It is ordinary SQL, so there is no lock-in.

Caveat for this Mac: the Supabase CLI comes from npm or Homebrew. npmjs.org is blocked (STATE §3).
Try Homebrew or the GitHub release binary; failing that, CI runs it.

## Step 2 — generated types

`supabase gen types typescript --project-id <id> > apps/mobile/src/frontend/types/database.ts`
after every migration, with a CI check that the committed file matches. Hand edits to that file
stop.

## Step 3 — split the big files (one PR each, no behaviour change)

| File | Split into |
| --- | --- |
| `ReelCard.tsx` | `ReelVideo`, `ReelActionRail`, `ReelCaption`, `ReelCard` (composition + memo) |
| `UploadVideoModal.tsx` | `usePickAndCompress` hook, `UploadDetailsForm` (category, tags, attestation), modal shell |
| `lib/adminCatalog.ts` | one file per catalog under `lib/admin/catalogs/` |
| `lib/admin.ts` | `lib/admin/{games,people,content,money}.ts` + an index re-export |
| `app/operator/[gameId].tsx` | move sections into `components/Operator/` |

Rule of thumb in CONVENTIONS.md: over ~500 lines, split by responsibility, and keep existing
tests passing unchanged. They are the proof that nothing moved.

## Step 4 — notes that reviewers actually read

- **`.github/pull_request_template.md`:** what changed and why; screens touched; SQL migration
  (yes/no, file name); tests added; STATE §4 line; what was *not* verified.
- **`CODEOWNERS`** from `docs/TEAMS.md`, so the right department is asked to review each path:
  money files, `supabase/migrations/`, `components/Reels/`, and so on.
- **A short README per top-level folder** (`src/frontend/lib`, `hooks`, `components`,
  `supabase`): what belongs there and the one rule people break.
- **A header comment on every migration**: purpose, a link to the design doc, and how to roll
  back.
- Keep the existing habits: `@purpose` on exported functions, STATE §4 for each change,
  CHANGELOG for anything users see.

## Order

Step 0 → Step 1 (baseline) → Step 2 → the verification-ladder SQL
(`ATHLETE_VERIFICATION_DESIGN.md` §7) as the **first real migration** → Step 3 splits in quiet
weeks → Step 4 alongside.
