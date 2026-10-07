# Supabase

Database migrations, Edge Functions, and legacy incremental SQL.

- New database changes go in `migrations/YYYYMMDDHHMMSS_name.sql`.
- Never edit a migration after it is applied. Fix forward with a later migration.
- Every migration header states purpose, design/doc context, dependencies, applied state, and rollback.
- Copy new SQL into `apps/mobile/src/backend/db/schema.sql` until that canonical file becomes generated.
- Update `migrations/README.md`, `docs/engineering/SCHEMA.md`, `docs/STATE.md`, and `CHANGELOG.md` in the same change.
- Apply to staging first, then production only with owner approval. Record what was actually applied.
- `functions/` holds server-side Deno handlers. Secrets stay in Supabase/Stripe configuration, never mobile code.

The root `*.sql` files predate the migration history. Treat them as legacy incrementals and follow
the apply order in `docs/STATE.md` until a live baseline migration is captured.
