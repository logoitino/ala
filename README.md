# Tapua'i Sports

Polynesian-inspired fan & athlete hub. **pnpm monorepo.**

| Package | What it is |
| --- | --- |
| [`apps/mobile`](apps/mobile) | Expo Router SDK 57 app (Highlights ⚡, Local, Spotlight, Drip, Profile) + production Expo Admin |
| [`apps/admin-portal`](apps/admin-portal) | Next.js App Router **scaffold** (Tailwind + Supabase). Live desks still in Expo `/admin` |
| [`packages/shared-types`](packages/shared-types) | `@tapuai/shared-types` — Profile, ActionStats, Spotlight, RPC shapes |

Docs: [ARCHITECTURE](docs/ARCHITECTURE.md) · [ONBOARDING](docs/ONBOARDING.md) · [SCHEMA](docs/SCHEMA.md) · [DOCUMENTATION](DOCUMENTATION.md)

## Quick start

```bash
corepack enable
pnpm install

cp apps/mobile/.env.example apps/mobile/.env.local
# fill EXPO_PUBLIC_SUPABASE_* and Stripe test keys

pnpm mobile          # Expo
pnpm admin           # Next stub on :3001
pnpm docs:check      # front-of-house facts vs code
```

## Environment

Never commit `.env`, `.env.local`, or `.env.production`.

- **Mobile:** `apps/mobile/.env.local` — `EXPO_PUBLIC_*`, `STRIPE_SECRET_KEY` for API routes
- **Admin portal:** `apps/admin-portal/.env.local` — `NEXT_PUBLIC_SUPABASE_*`

## Workspace scripts

| Command | Action |
| --- | --- |
| `pnpm mobile` | Expo start |
| `pnpm mobile:ios` / `mobile:web` | Platform targets |
| `pnpm admin` | Next.js admin stub |
| `pnpm docs:sync` / `docs:check` | Product facts |
| `pnpm typecheck` | Mobile + admin `tsc` |

## Architecture note

Backend SQL stays at repo-root [`supabase/`](supabase/). Canonical app schema copy: `apps/mobile/src/backend/db/schema.sql`. Stripe stays in test mode until production keys + legal sign-off.
