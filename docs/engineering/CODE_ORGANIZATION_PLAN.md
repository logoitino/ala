# Code organization plan — from dev-only to a separate production environment

**Owner goal (2026-10-07):** organise the code, folders, docs and data to the level where outside
engineers can read the comments and the structure and help straight away, and so Tapua'i can run a
real **production** environment separate from development and staging.

**Owner clarification (2026-09-29): we are not moving hosts.** The goal is to keep the code
organised so that *if* Tapua'i ever has to move (another Postgres host, another auth or payments
provider), the move is easy to read, plan and do. Production in R3 is a new Supabase project
on the same host. See "Staying portable" below.

## The four readiness phases (R1–R4)

These are **engineering readiness** phases. They are not the product phases 0–5 in
[ROADMAP.md](../product/ROADMAP.md); ROADMAP's Wave 1 checklist links here.

Each phase leaves the app working and can stop at any point. R3 depends on R2: a
production database is only safe once the schema can be rebuilt from migrations.

| Phase | Goal | Detailed steps | Status |
| --- | --- | --- | --- |
| **R1. Tidy and make it readable** | An outsider can clone, run, find things and review a PR. No behaviour change. | Step 0, Step 4, repo/docs layout below | **Mostly done 2026-10-07** — merge/push and private docs pending |
| **R2. Rebuildable database** | The schema is rebuilt from `supabase/migrations/` alone; types and `schema.sql` are generated. | Step 1, Step 2 | Incremental migrations exist; clean rebuild not verified and baseline not dumped |
| **R3. Production environment** | Dev, staging and production are separate projects, builds and keys; changes flow dev → staging → prod through CI. | "R3" section below | Not started; gated on R2 and the Wave 1 owner decisions |
| **R4. Easier to change** | One backend, enforced style, smaller files, real test coverage, monitoring. | Step 3, "R4" section below | Not started (route data debt already falling: 17 → 12 calls) |

### Current verification and next actions (2026-10-07)

- Expo web export passed locally with `EXPO_NO_DOTENV=1`: **52 static routes and 3 API routes**.
  This verifies bundling without loading local env files; it does not verify hosted API secrets,
  authenticated data, native modules or test payments.
- Separate iOS and Android exports with `--max-workers 1` passed, including Hermes bytecode
  (8.2 MB / 8.4 MB). A combined export initially received SIGKILL. These exports verify native
  JavaScript/assets compilation, not signed binaries, native linking or device interaction.
- Next optimized production build passed locally for all routes. No hosted deployment or
  real-account browser acceptance was performed.
- The final `pnpm check` passed: both app typechecks, 50 suites / 242 tests and all guards,
  including `docs:links` and `security:client-keys`. Both new guards also rejected intentional
  invalid fixtures. Native interaction and hosted database replay remain pending.
- R1 next: review the local changes, then the owner selects the private documentation home and
  approves branch integration/protection. R2 next: prepare a Supabase baseline/replay plan from
  recorded staging state and obtain authorized database access before capturing it.
- R3 waits on R2 and Wave 1 decisions. R4 file splits and tests may proceed alongside R2;
  retiring API routes waits on verified Edge Function deployments.

### R1 checklist — tidy and make it readable

- [x] Commit the 2026-10-07 work as topic commits (agents roster, guest routes, account tags,
      UX-01/UX-02, docs) on `wave0-custodial-verification`. Step 0 was first done 2026-09-29.
- [x] Archive clutter without deleting it: `my-app/` → `archive/my-app/` (see `archive/README.md`);
      `.tmp/` and `.smoke/` untracked and ignored (files stay on disk).
- [x] Docs into folders: entry points (`README`, `STATE`, `ONBOARDING`, `GLOSSARY`) at `docs/`;
      `engineering/` (with `design/`), `product/`, `legal/`, `company/`, `agents/`. Relative file links and repo
      paths rewritten; the current tracked Markdown relative file-link audit found 0 broken links. Root `TROUBLESHOOTING.md` moved in;
      root `DOCUMENTATION.md` became `docs/engineering/SYSTEM_OVERVIEW.md`.
- [x] Front door for humans: root `README.md` rewritten (repo map, run, check, how we work),
      `docs/README.md` index, `docs/GLOSSARY.md` (code names ↔ product words, verified against the
      code), `docs/ONBOARDING.md` "Start here" reading order and first-day checklist.
- [x] One command for every CI check: `pnpm check` (plus `pnpm test`).
- [x] PR template, CODEOWNERS, folder READMEs, header comment on every file with a CI guard
      (Step 4, done 2026-09-29 – 2026-10-02).
- [ ] **Owner:** merge the branch into `main`, push, and turn on branch protection for `main`
      (pull request + passing CI required). Needs GitHub access and owner approval.
- [ ] **Owner:** before giving anyone outside the company repo access, move `docs/legal/` and
      `docs/company/` to a private location (private repo or shared drive) and leave a pointer.
- [ ] Confirm whether the root `app.json` (`{"expo": {}}`, added 2026-10-01) is still needed; the real
      config is `apps/mobile/app.json`. An empty `apps/mobile/apps/` folder is left in place (owner:
      do not delete); git ignores it.

### R2 checklist — rebuildable database

- [ ] `supabase/config.toml` and a `seed.sql` with fake athletes, games and clips (never real people);
      move the Demo Fan account and demo PIN into seed data.
- [ ] Baseline migration dumped from staging (Step 1.1), compared with `schema.sql` (Step 1.2).
- [ ] The 52 loose `supabase/*.sql` files moved to `supabase/legacy/` with a README (Step 1.4).
- [ ] `schema.sql` and `types/database.ts` generated, with CI checks that the committed copies match (Step 2).
- [ ] CI applies every migration to a throwaway Postgres from zero (Step 1.5).
- [ ] No more SQL Editor pastes: migrations apply with `supabase db push` from CI.

### R3 — production environment

Hosting options (stay on Supabase, self-host on AWS / Azure, or managed cloud services), the environment table
and the merge-to-deploy pipeline are in [ENVIRONMENTS_AND_HOSTING.md](ENVIRONMENTS_AND_HOSTING.md) (2026-10-13);
its phases E0–E3 implement R2's CI replay and the R3 checklist below.

The table describes the **target**, not the current deployment. Development and staging
projects exist, but `app.json` is still static, automatic database deployment is not configured,
production is not created and side-by-side installation is not verified. All R3 checkboxes
below remain open.

| | Development | Staging | Production |
| --- | --- | --- | --- |
| Supabase project | `ulfapgtabidorgwfjvwz` (exists) | `ala-sports-staging` (exists) | **new** project (Supabase Pro, about $25/mo) |
| Stripe | test keys | test keys | live keys — only after STATE §6 items 8 and 9 are decided |
| App build (EAS) | `development` profile, "Tapua'i Dev", own bundle ID | `preview` channel, "Tapua'i Beta" | `production` channel, "Tapua'i" |
| Database changes | `supabase db push` locally | automatically when `main` changes | when a release is tagged |
| Who has dashboard access | engineers | engineers | owner + named on-call only |

- [ ] Replace `apps/mobile/app.json` with `app.config.ts` that reads `APP_ENV` (already set per
      profile in `eas.json` but read by nothing today) and sets name, bundle ID, icon and scheme per
      environment, so the three builds install side by side.
- [ ] Client keys per environment in EAS environment variables; secrets only in Supabase secrets per
      project. No secret in any `.env.local` (Stripe secret moved out 2026-10-07; rotate it).
- [ ] CI pipeline: PR → checks; merge to `main` → migrations + Edge Functions to staging and a
      preview build; release tag → the same to production.
- [ ] Production hardening before real users (from STATE §5): private storage buckets, no
      `auth.role() = 'anon'` bypasses, no demo PIN, webhook-based crediting instead of the client
      `tips` insert (ROADMAP Phase 1a ledger), telemetry identity decision.
- [ ] Backups (point-in-time recovery) and a tested restore drill; error monitoring (e.g. Sentry)
      on all three environments.

### R4 — easier to change

- [ ] One backend: retire the Expo API routes in `apps/mobile/src/backend/api/` once the Edge
      Functions are confirmed deployed with secrets on every project; `src/backend/db/schema.sql`
      moves to `supabase/` when it becomes generated.
- [ ] ESLint + Prettier enforced in CI (needs registry access; set up from CI or a machine where
      npm works — not the owner's Mac).
- [ ] Split the 900+ line files (Step 3), one PR each, no behaviour change.
- [ ] Route data-boundary debt to zero (6 files / 12 calls left).
- [ ] Screen tests for donate, upload and sign-in; first admin-portal tests; an end-to-end smoke
      test on a device build.
- [ ] Rename code names toward product words only where it is cheap (new code uses product words;
      old tables keep their names — the glossary covers the gap).

---

The sections below retain the 2026-09-29 problem inventory and update the implementation
steps where needed. Counts and uncommitted-work claims in "Why" are **historical**, not the
current working tree; use STATE §0/§4 and the work queue for current completion evidence.

## Why — historical inventory, 2026-09-29

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
    <cutoff>_baseline.sql              ← authorized staging snapshot at an agreed cutoff
    <later>_new_change.sql              ← only changes after that cutoff
    ...
  seed.sql                              ← demo data only, never real people
  functions/                            ← Edge Functions (already here)
```

1. **Agree a baseline cutoff from staging.** First inventory recorded/applied migrations and
   compare the authorized staging snapshot with the repo. A current snapshot already contains
   older applied changes: do not put it before those files and replay them as new work. Prepare
   a reviewed squash/reconciliation plan that preserves original applied files for reference,
   includes only post-cutoff changes in the fresh replay path and reconciles hosted migration
   history. Any migration-history repair is a hosted write requiring its own authorization.
   `supabase db dump --schema public` is the public-schema input, not the whole Supabase setup:
   explicitly capture/recreate Storage bucket configuration and policies, required auth roles,
   extensions and grants, Realtime setup and synthetic seed prerequisites. No user records or
   secrets belong in the committed baseline.
2. **Compare the snapshot with `schema.sql` and migration history.** Classify every difference:
   unapplied work, hosted-only changes, obsolete definitions, seed/configuration data or dump
   representation differences. Resolve or document each item before selecting the baseline;
   do not automatically delete or apply a difference. Record STATE §5's unapplied rows separately.
3. **Every later change is a new timestamped migration file**, reviewed in a PR and applied with
   `supabase db push`, staging first and then production. Never edit an applied migration.
4. **Retire the copies.** `schema.sql` becomes generated (`supabase db dump` into it, marked
   "generated — do not edit"). The 52 standalone files move to `supabase/legacy/` with a README,
   then get deleted once the baseline covers them.
5. **CI:** start an isolated local Supabase stack with `supabase start`, then run
   `supabase db reset` to apply the agreed baseline, later migrations and synthetic seed from
   zero. Exercise auth/role and private Storage policy checks as well as SQL replay. A plain
   Postgres container alone lacks Supabase auth/storage schemas, roles and functions; it is
   insufficient unless equivalent prerequisites are explicitly provisioned and verified.

Moving to another Supabase project later uses the verified baseline and later migrations.
Another Postgres host needs an explicit auth, Storage, Realtime, role and extension adapter
plan; running SQL files alone does not reproduce the full application backend.

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
| `UploadVideoModal.tsx` | UX-01 splits draft/picker/upload controller from `UploadVideoComposer.tsx` (short steps, selection screens, fixed footer); compression stays in existing picker/service |
| `lib/adminCatalog.ts` | one file per catalog under `lib/admin/catalogs/` |
| `lib/admin.ts` | `lib/admin/{games,people,content,money}.ts`; update consumers to direct imports, without a barrel or re-export shim |
| `app/operator/[gameId].tsx` | move sections into `components/Operator/` |

[CONVENTIONS.md](CONVENTIONS.md) §4 prohibits barrels/re-export shims in `lib/`, `hooks/`
and `components/`. Update direct imports in the same split.

Rule of thumb in CONVENTIONS.md: over ~500 lines, split by responsibility, and keep existing
tests passing unchanged. They are the proof that nothing moved.

## Step 4 — notes that reviewers actually read

- **`.github/pull_request_template.md`:** what changed and why; screens touched; SQL migration
  (yes/no, file name); tests added; STATE §4 line; what was *not* verified.
- **`CODEOWNERS`** from `docs/agents/TEAMS.md`, so the right department is asked to review each path:
  money files, `supabase/migrations/`, `components/Reels/`, and so on.
- **A short README per top-level folder** (`src/frontend/lib`, `hooks`, `components`,
  `supabase`): what belongs there and the one rule people break.
- **A header comment on every migration**: purpose, a link to the design doc, and how to roll
  back.
- Keep the existing habits: `@purpose` on exported functions, STATE §4 for each change,
  CHANGELOG for anything users see.

## Staying portable (so a future move is cheap)

Where Supabase is baked in today, measured 2026-09-29:

| Coupling | Size | Keep it movable by |
| --- | --- | --- |
| Postgres tables, RLS, RPCs | most of `schema.sql` | Keep new changes in `supabase/migrations/`. Their auth roles/functions, extensions and Storage references need a verified adapter on another host. |
| `auth.uid()` / `auth.role()` in SQL | 105 / 61 uses (historical) | On another host, verify JWT validation, request identity, grants and RLS semantics before providing compatible functions. Document additional Supabase-specific dependencies. |
| `storage.*` policies | 25 lines | Storage buckets are Supabase-specific; client code goes through `services/MediaUploadService`, so a move touches that one file plus these policies. |
| Realtime | 4 publication lines (historical) | Keep subscriptions in hooks/lib; inventory current channels, private Broadcast authorization and publication settings before moving providers. |
| Edge Functions | 3 (`create-payment-intent`, `create-stripe-account`, `stripe-webhook`; historical count) | Deno HTTP handlers need runtime, secrets and authorization verified on another host. Keep Stripe logic in handlers, not SQL. |
| Client calls | `lib/supabase.ts` imported in 65 files | **Rule:** screens and components call `lib/*` or `hooks/*`, never `supabase.from/rpc` directly. Then a move rewrites `lib/`, not the UI. **2 Expo route files still break this as of 2026-10-10:** `app/operator/scorer.tsx` and `app/operator/[gameId].tsx` (7 direct calls). Athlete HQ, Parent HQ, Profile, and the public athlete sheet moved into `lib/` on 2026-10-10. `components/Reels/UploadVideoModal.tsx` is the component exception. Sponsor, Booster and operator check-in moved into `lib/` on 2026-09-29. Guest match queries/Realtime moved to `lib/guestGames.ts` and guest player lookup to `lib/roster.ts` on 2026-10-07; the baseline fell from 17 to 12 direct calls, then to 7. `pnpm app:data-boundaries` records exact route call counts and fails if debt grows. Move the operator queries into `lib/` when those files are next touched and lower the baseline in the same change. |

Habits that keep this true: every table and RPC documented in `docs/engineering/SCHEMA.md` (CI enforces);
every SQL change a dated file with a header; secrets only in env / the SQL Editor; no vendor SDK
imported outside `lib/` and `services/`.

## Order

R1 (Step 0 + Step 4 + layout) → R2 (Step 1 baseline → Step 2) → R3 (production) → R4 (Step 3
splits and the rest) in quiet weeks. R4 items that need no database change (splits, tests,
data-boundary debt) can run alongside R2 and R3.
