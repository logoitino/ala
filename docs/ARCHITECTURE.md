# Tapua'i architecture

System overview for the pnpm monorepo. Schema detail: [SCHEMA.md](SCHEMA.md). Product numbers: [PRODUCT_FACTS.md](PRODUCT_FACTS.md). Engineer map: [../DOCUMENTATION.md](../DOCUMENTATION.md). Who owns each tab: [TEAMS.md](TEAMS.md).

## Monorepo map

| Package | Path | Role |
| --- | --- | --- |
| `@tapuai/mobile` | `apps/mobile/` | Expo Router SDK 57 fan app + production Expo `/admin` control plane |
| `@tapuai/admin-portal` | `apps/admin-portal/` | Next.js web admin (Overview / Reports / Money / Soft-Wall / Profile / Features / People). Reports + Money use the same RPCs as Expo. Features flags publish `app_runtime_config`. Games, Drip SKUs, catalogs still edit in Expo `/admin` |
| `@tapuai/shared-types` | `packages/shared-types/` | Shared TypeScript contracts (Profile / Soft-Wall gates / Profile chrome / Spotlight / RPC shapes) |
| SQL / Edge | `supabase/` | Migrations, Edge Functions, seed SQL (shared backend) |

```text
apps/mobile  ──┐
               ├── @tapuai/shared-types
apps/admin-portal ─┘
        │
        ▼
   Supabase (Auth, Postgres, Realtime, Storage)
        │
   Stripe (PaymentSheet + Connect Express)
```

## Runtime responsibilities

- **Mobile (Expo):** Highlights ⚡, Local, Spotlight, Drip, Profile (same `AthleteProfileView` as `/user/[id]`; hamburger on own hub), Mālo PaymentSheet, Soft-Wall auth (browse-first guests), operator console (Features-gated), and the live **Admin** desks under `app/(admin)/admin` (Coverage Soft-Wall + Profile surfaces, Features Soft-Wall board, Look Profile chrome, People Fans filter).
- **Admin portal (Next):** Web app at `pnpm admin` → `http://localhost:3001`. **Reports** (`/reports`, `get_admin_reports`) and **Money** (`/money`, `get_company_revenue_summary`) are the browser desks for behavior and ledger. Soft-Wall / Profile / Features / People stay on this plane; Features Publish copies onto `published`. Edit games, Drip SKUs, sports, and catalogs in Expo `/admin`.
- **Departments:** Call a named owner from [TEAMS.md](TEAMS.md) (`HIGHLIGHTS`, `PROFILE`, `COMMERCE`, …) instead of handing a tab to “Mobile” in the abstract.
- **Shared types:** Import `@tapuai/shared-types` (or `@shared/*`) for cross-app domain types, including `SOFT_WALL_GATES` / `SoftWallOversight`. Mobile keeps the full generated `Database` helpers in `apps/mobile/src/frontend/types/database.ts`.
- **Auth:** Supabase session + `alasports://auth/callback`. Soft wall on Mālo / Crew / Chip In only; fan profile via `handle_new_auth_user` + `ensureFanProfile`.

## Data model (ERD pointer)

Canonical tables and RPCs live in `apps/mobile/src/backend/db/schema.sql` and are documented in [SCHEMA.md](SCHEMA.md). Core loops:

1. `reels` + Storage `reels` (fallback `game_highlights`) → Highlights feed.
2. `tips` + JWT-gated Stripe PaymentIntent → Mālo → `add_user_aura`.
3. `profiles.aura_points` → 7-tier Aura card + Top Boosters.
4. `games` / `game_events` Realtime → Local live scores.
5. `spotlight_awards` → Spotlight tab / launch modal.

## Env boundaries

| App | File | Prefix |
| --- | --- | --- |
| Mobile | `apps/mobile/.env.local` | `EXPO_PUBLIC_*` (+ server `STRIPE_SECRET_KEY` for JWT-gated Expo API routes; never `EXPO_PUBLIC_STRIPE_SECRET_KEY`) |
| Admin portal | `apps/admin-portal/.env.local` | `NEXT_PUBLIC_SUPABASE_*` |

Never commit `.env`, `.env.local`, or `.env.production`.
