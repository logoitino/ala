# Tapua'i architecture

System overview for the pnpm monorepo. Schema detail: [SCHEMA.md](SCHEMA.md). Product numbers: [PRODUCT_FACTS.md](PRODUCT_FACTS.md). Engineer map: [../DOCUMENTATION.md](../DOCUMENTATION.md).

## Monorepo map

| Package | Path | Role |
| --- | --- | --- |
| `@tapuai/mobile` | `apps/mobile/` | Expo Router SDK 57 fan app + production Expo `/admin` control plane |
| `@tapuai/admin-portal` | `apps/admin-portal/` | Next.js App Router **stub** (Tailwind + Supabase JS). Desks not ported yet |
| `@tapuai/shared-types` | `packages/shared-types/` | Shared TypeScript contracts (Profile / ActionStats / Spotlight / RPC shapes) |
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

- **Mobile (Expo):** Highlights ⚡, Local, Spotlight, Drip, Profile, Mālo PaymentSheet, operator console, and the live **Admin** desks under `app/(admin)/admin`.
- **Admin portal (Next):** Scaffold only. Use Expo `/admin` until desks move here.
- **Shared types:** Import `@tapuai/shared-types` (or `@shared/*`) for cross-app domain types. Mobile keeps the full generated `Database` helpers in `apps/mobile/src/frontend/types/database.ts`.

## Data model (ERD pointer)

Canonical tables and RPCs live in `apps/mobile/src/backend/db/schema.sql` and are documented in [SCHEMA.md](SCHEMA.md). Core loops:

1. `reels` + `game_highlights` Storage → Highlights feed.
2. `tips` + Stripe PaymentIntent → Mālo → `add_user_aura`.
3. `profiles.aura_points` → 7-tier Aura card + Top Boosters.
4. `games` / `game_events` Realtime → Local live scores.
5. `spotlight_awards` → Spotlight tab / launch modal.

## Env boundaries

| App | File | Prefix |
| --- | --- | --- |
| Mobile | `apps/mobile/.env.local` | `EXPO_PUBLIC_*` (+ server `STRIPE_SECRET_KEY` for Expo API routes) |
| Admin portal | `apps/admin-portal/.env.local` | `NEXT_PUBLIC_SUPABASE_*` |

Never commit `.env`, `.env.local`, or `.env.production`.
