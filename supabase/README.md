<!-- Supabase home: migrations are history; legacy is reference; seed is fake-only. -->
# Supabase

Database migrations, Edge Functions, local CLI layout, and legacy incremental SQL.

## What belongs here

| Path | Role |
| --- | --- |
| `migrations/` | Append-only dated SQL. Never edit after apply. |
| `functions/` | Deno Edge handlers (Stripe, Connect, webhook). |
| `functions/_shared/` | Shared with Node API adapters (money core). |
| `config.toml` | Standard Supabase CLI layout for local tooling. |
| `seed.sql` | **Fake** local seed only — never real people. |
| `legacy/` | Pre-migration `*.sql` scripts — **reference only**. |
| `content/` | Trivia / bank JSON consumed by generators. |

## What does not

- Secrets (`sk_`, service role) in this tree or in mobile `.env.local`
- Hand-editing hosted migration history
- Applying SQL without owner approval

## The rule people break

Dropping a new `.sql` at `supabase/*.sql` next to `config.toml`. **New changes go in
`migrations/YYYYMMDDHHMMSS_name.sql`**, then copy onto `apps/mobile/src/backend/db/schema.sql`.
Old stand-alone files already moved to `legacy/` (inventory in `legacy/README.md`).

Same-turn docs: `migrations/README.md`, `docs/engineering/SCHEMA.md`, `docs/STATE.md` §4,
`CHANGELOG.md`, data map when tables/RPCs move.
