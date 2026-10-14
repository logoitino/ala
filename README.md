# Tapua'i Sports

A fan and athlete app for high-school sports: families post highlights of their kid, fans hype
and share them, and anyone can donate toward real sports costs (cleats, travel, camps). Tapua'i
replaces the GoFundMe link families pass around today. Built as a **pnpm monorepo**: an Expo
(React Native) app, a read-only Next.js admin portal, and a Supabase (Postgres) backend.

> **Status:** Wave 0, an internal test. Stripe is in test mode and no real money moves.
> What is done, what is broken and what is next: [docs/STATE.md](docs/STATE.md).

## Repository map

| Path | What lives there |
| --- | --- |
| [`apps/mobile/`](apps/mobile) | Expo Router app (SDK 57): fan tabs, role HQs, operator console, and main `/admin` with reports, analytics and all administration controls. |
| [`apps/admin-portal/`](apps/admin-portal) | Next.js oversight desk on port 3001. **Read-only by design.** |
| [`packages/shared-types/`](packages/shared-types) | `@tapuai/shared-types`, TypeScript shapes shared by both apps. |
| [`supabase/`](supabase) | Database SQL, timestamped [`migrations/`](supabase/migrations), and Edge Functions (Stripe checkout, Connect, webhook). |
| [`scripts/`](scripts) | Repo checks (`pnpm check`) and the generator for product-facts docs. |
| [`docs/`](docs) | All documentation. Start at the [docs index](docs/README.md). |
| [`archive/`](archive) | Old code kept for reference only. Not built or deployed. |
| `.claude/`, `.cursor/`, `AGENTS.md`, `CLAUDE.md` | Instructions for AI coding assistants. Humans can skip these. |

Inside `apps/mobile/`: `app/` holds routes only; reusable UI is in `src/frontend/components/<Feature>/`,
data hooks in `src/frontend/hooks/`, Supabase and Stripe clients in `src/frontend/lib/`. Full
folder rules: [docs/engineering/CONVENTIONS.md](docs/engineering/CONVENTIONS.md).

## Get running

You need Node 24, pnpm (via Corepack) and a Supabase project URL plus anon key from the team.
For full native testing, use a development client or the staging preview build. Native Stripe
and video compression require those native modules; Expo Go is limited to supported browsing
and upload fallback checks.

```bash
git clone <this-repo> ala-sports && cd ala-sports
corepack enable
pnpm install

cp apps/mobile/.env.example apps/mobile/.env.local
# fill in EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

pnpm mobile          # Expo dev server; connect a matching development client
pnpm admin           # admin portal on http://localhost:3001 (needs apps/admin-portal/.env.local)
```

Never put a secret key (Stripe `sk_…`, Supabase service role) in any `.env.local`: the Stripe
secret belongs in Supabase secrets. Details, auth provider setup and simulator notes:
[docs/ONBOARDING.md](docs/ONBOARDING.md). If something fails:
[docs/engineering/TROUBLESHOOTING.md](docs/engineering/TROUBLESHOOTING.md).

## Check your work

```bash
pnpm check
```

It runs everything CI runs: both typechecks, the mobile tests, and the repo guards (product facts
in sync, relative documentation file links, donation wording, route data-access debt, mobile
source headers, the agent registry and client credential markers). Single pieces:
`pnpm typecheck`, `pnpm test`, `pnpm docs:check`, `pnpm docs:links`, `pnpm copy:check`,
`pnpm app:data-boundaries`, `pnpm comments:check`, `pnpm agents:check`,
`pnpm security:client-keys`. Link checks cover file destinations, not anchors or external URLs.

## How we work

1. Check [STATE §0](docs/STATE.md) for the active branch before creating a branch. The current
   integration branch awaits merge into `main`; after that merge, branch from `main`. Open a pull
   request and require passing CI; do not push straight to `main`.
2. Every file starts with a header comment saying what it is and why it exists; comments explain
   *why*, not *what* ([CONVENTIONS §5](docs/engineering/CONVENTIONS.md)).
3. A change under `apps/`, `packages/` or `supabase/` adds a line to
   [docs/STATE.md](docs/STATE.md) §4 in the same PR (CI checks this).
4. Database changes are new files in `supabase/migrations/`, never edits to applied ones
   ([migrations README](supabase/migrations/README.md)).
5. On-screen money words follow [docs/product/VOICE.md](docs/product/VOICE.md): **Donate /
   donation**. The code still says `tips` and `malo`; the [glossary](docs/GLOSSARY.md) maps them.
6. Stage files by path. Never `git add -A`.

## Where to read next

| If you want to… | Read |
| --- | --- |
| Get set up and understand how we work | [docs/ONBOARDING.md](docs/ONBOARDING.md) |
| Translate code names to product words | [docs/GLOSSARY.md](docs/GLOSSARY.md) |
| See how the pieces fit | [docs/engineering/ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md) |
| Find a table, RPC or policy | [docs/engineering/SCHEMA.md](docs/engineering/SCHEMA.md) |
| Know what is happening right now | [docs/STATE.md](docs/STATE.md) |
| Understand the product direction | [docs/product/ROADMAP.md](docs/product/ROADMAP.md) |
| See every document | [docs/README.md](docs/README.md) |

## License

See [LICENSE](LICENSE).
