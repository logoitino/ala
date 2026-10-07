## What changed and why

<!-- One product or engineering outcome. Link the issue/design doc when one exists. -->

## Surfaces touched

<!-- Home / Activity / Spotlight / Drip / Profile / Local / Role HQ / Operator / Expo admin / Next oversight / backend -->

- [ ] User-visible behavior
- [ ] Payments, identity, permissions, or legal copy
- [ ] Runtime flag or Publish-to-app behavior

## Data and migrations

- [ ] No schema/RLS/RPC change
- [ ] Migration: `supabase/migrations/...`
- [ ] Copied into `apps/mobile/src/backend/db/schema.sql`
- [ ] `docs/engineering/SCHEMA.md` and `supabase/migrations/README.md` updated
- [ ] Applied to staging
- [ ] Applied to production

## Verification

- [ ] Mobile typecheck
- [ ] Admin portal typecheck
- [ ] Mobile Jest
- [ ] `pnpm docs:check`
- [ ] `pnpm copy:check`
- [ ] `pnpm app:data-boundaries`
- [ ] `pnpm comments:check` (new or changed files explain themselves; stale comments fixed)
- [ ] Real-device or installed-build check

Tests added or changed:

<!-- Name the suites and the behavior they prove. -->

## Continuity

- [ ] `docs/STATE.md` Last updated + §4 entry
- [ ] `CHANGELOG.md` for user-visible or schema changes
- [ ] `docs/product/ROADMAP.md` when status/blockers moved
- [ ] JSDoc/TSDoc is current on hooks, network helpers, and complex components

## Not verified / intentionally deferred

<!-- State this plainly. “None” is acceptable only when every relevant path was exercised. -->
