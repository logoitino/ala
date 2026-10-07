# Tapua'i Sports

Polynesian-inspired fan & athlete hub — the GoFundMe replacement for families: highlights plus easy donations so a family can promote their kid and hopefully get them recruited. **pnpm monorepo.**

| Package | What it is |
| --- | --- |
| [`apps/mobile`](apps/mobile) | Expo Router SDK 57 app (Highlights ⚡, Activity, Spotlight, Drip, Profile) + production Expo Admin |
| [`apps/admin-portal`](apps/admin-portal) | Next.js **read-only** oversight (Overview / Reports / Money / Soft-Wall / Profile / Features / People). Every write happens in Expo `/admin` |
| [`packages/shared-types`](packages/shared-types) | `@tapuai/shared-types` — Profile, ActionStats, Spotlight, RPC shapes |

**Start with [docs/STATE.md](docs/STATE.md)** — current state, what changed last, environment
gotchas, and what is knowingly broken; §0 is the hand-off for the next person or AI. Update it whenever you change code.

Docs: [STATE](docs/STATE.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [ONBOARDING](docs/ONBOARDING.md) · [SCHEMA](docs/SCHEMA.md) · [DOCUMENTATION](DOCUMENTATION.md)

## Quick start

```bash
corepack enable
pnpm install

cp apps/mobile/.env.example apps/mobile/.env.local
# or: cp -n .env.local apps/mobile/.env.local  if you still have a pre-monorepo root env
# fill EXPO_PUBLIC_SUPABASE_* and Stripe test keys

pnpm mobile          # Expo — NOT `npx expo start` from repo root
pnpm admin           # Next stub on :3001
pnpm docs:check      # front-of-house facts vs code
```

## Environment

Never commit `.env`, `.env.local`, or `.env.production`.

- **Mobile:** `apps/mobile/.env.local` — `EXPO_PUBLIC_*` only; `STRIPE_SECRET_KEY` lives in Supabase secrets (and, for local Metro API routes, a private file outside the repo — see `docs/ONBOARDING.md`)
- **Admin portal:** `apps/admin-portal/.env.local` — `NEXT_PUBLIC_SUPABASE_*`

## Workspace scripts

| Command | Action |
| --- | --- |
| `pnpm mobile` | Expo start |
| `pnpm mobile:ios` / `mobile:web` | Platform targets |
| `pnpm admin` | Next.js admin stub |
| `pnpm docs:sync` / `docs:check` | Product facts |
| `pnpm typecheck` | Mobile + admin `tsc` |
| `pnpm agents:check` | Specialist files, ownership and hierarchy consistency |

## Architecture note

Backend SQL stays at repo-root [`supabase/`](supabase/). Canonical app schema copy: `apps/mobile/src/backend/db/schema.sql`. Stripe stays in test mode until production keys + legal sign-off.

Specialist roster: [TEAM_HIERARCHY](docs/TEAM_HIERARCHY.md) · [TEAMS](docs/TEAMS.md) · [WORK_QUEUE](docs/WORK_QUEUE.md).
