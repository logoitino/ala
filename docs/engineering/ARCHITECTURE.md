# Tapua'i architecture

Current state and hand-off: [STATE.md](../STATE.md) (read first). System overview for the pnpm monorepo. Schema detail: [SCHEMA.md](SCHEMA.md). Product numbers: [PRODUCT_FACTS.md](../product/PRODUCT_FACTS.md). Engineer map: [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md). Who owns each tab: [TEAMS.md](../agents/TEAMS.md).

## Monorepo map

| Package | Path | Role |
| --- | --- | --- |
| `@tapuai/mobile` | `apps/mobile/` | Expo Router SDK 57 fan app + production Expo `/admin` control plane |
| `@tapuai/admin-portal` | `apps/admin-portal/` | Next.js web admin, **read-only oversight** (Home / Trends / Audience / Revenue / Health / Product, plus Analytics and Departments). Analytics is eight dashboards from `get_admin_reports` and `get_company_revenue_summary`. Features/Profile display `app_runtime_config` with no toggle. Every write happens only in Expo `/admin` |
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

- **Mobile (Expo):** Highlights ⚡, Activity, Spotlight, Drip, Profile (same `AthleteProfileView` as `/user/[id]`; hamburger on own hub; Local is a pill on Highlights), Donate PaymentSheet (code name Mālo; discloses 90 / 10, optional tip for Tapua'i), Rally goals and preset Say thanks (`components/Rally/`, `components/Thanks/`), custodial money cards (`components/Custodial/`), athlete verification (`components/Verification/`), Soft-Wall auth (browse-first guests), operator console (Features-gated), and the live **Admin** desks under `app/(admin)/admin` (Coverage Soft-Wall + Profile surfaces, Features Soft-Wall board, Look Profile chrome, People Fans filter).
- **Admin portal (Next):** Web app at `pnpm admin` → `http://localhost:3001`. **Analytics** (`/analytics`) is eight dashboards and a measure catalog from the same reads. **Trends** (`/reports`, `get_admin_reports`) and **Revenue** (`/money`, `get_company_revenue_summary` and `get_admin_malo_breakdown`) are the browser desks for behavior, the company ledger, and each donation by surface. **Health** is `/operations` and **Departments** is `/manage`. Product's Features / Profile / Sign-in / People display live status on this read-only plane. Every chart comes from the inline-SVG kit in `apps/admin-portal/components/charts/` (scales in `lib/chartScale.ts`) and carries a written summary and a Data table. Expo `/admin/features` and `/admin/look` publish changes into `app_runtime_config.published`. Edit games, Drip SKUs, sports, and catalogs in Expo `/admin`.
- **Departments and specialists:** Resolve the primary functional owner in [TEAM_HIERARCHY.md](../agents/TEAM_HIERARCHY.md) and [TEAMS.md](../agents/TEAMS.md); dispatch a bounded task from [WORK_QUEUE.md](../agents/WORK_QUEUE.md). The registry in `.claude/agents/registry.json` and `agents:check` keep files, reporting relationships and documentation aligned. Leads integrate shared changes; QA independently gates release.
- **Shared types:** Import `@tapuai/shared-types` (or `@shared/*`) for cross-app domain types, including `SOFT_WALL_GATES` / `SoftWallOversight`. Mobile keeps the manually maintained `Database` helpers in `apps/mobile/src/frontend/types/database.ts`.
- **Auth:** Supabase session + `alasports://auth/callback`. Soft wall on Donate / Crew / gear-goal donate only; fan profile via `handle_new_auth_user` + `ensureFanProfile`.

## Data model (ERD pointer)

Canonical tables and RPCs live in `apps/mobile/src/backend/db/schema.sql` and are documented in [SCHEMA.md](SCHEMA.md). Core loops:

1. `reels` + Storage `reels` (fallback `game_highlights`) → Highlights feed.
2. `tips` + JWT-gated Stripe PaymentIntent → donation → `add_user_aura`. Each `tips` row names where the donation started (`origin`: highlight, qr, wishlist item, profile, live or rally; `entry`: in_app or qr_link), and carries `platform_tip_cents` (optional tip for Tapua'i) and `rally_id`. `rallies` totals move from those rows; `donation_thanks` holds preset thank-yous (migration `20260929180000`, recorded applied to staging on 2026-09-30; not to development, with no fresh hosted verification).
3. `profiles.aura_points` → 7-tier Aura card + Top Boosters.
4. `games` / `game_events` Realtime → Local live scores.
5. `spotlight_awards` → Spotlight tab / launch modal.

## Env boundaries

| App | File | Prefix |
| --- | --- | --- |
| Mobile | `apps/mobile/.env.local` | `EXPO_PUBLIC_*` only. `STRIPE_SECRET_KEY` is a Supabase secret; the local Expo API routes read it from the shell, loaded from a private file outside the repo (Expo logs `.env.local` values). Never `EXPO_PUBLIC_STRIPE_SECRET_KEY` |
| Admin portal | `apps/admin-portal/.env.local` | `NEXT_PUBLIC_SUPABASE_*` |

Never commit `.env`, `.env.local`, or `.env.production`.

## Upload interaction

The composer keeps the draft and upload in `UploadVideoModal` and renders short pages in
`UploadVideoComposer`: clip selection, required details, then review/rights. Searchable athlete/game
choices and optional game/account/Vault settings replace inline expanded lists. Header and footer
stay outside the active page scroll. This changes interaction only; storage, tagging and payment
contracts stay in their existing services.


## Donation and menu presentation

The Donate modal hosts short Amount / Options / Review pages with persistent footer navigation.
`TipSheetModal` owns the popup frame; `TipCheckout` owns selection/review and checkout state;
`useTipCheckout` retains payment execution. Only the final reviewed action starts payment.
Back preserves selections, and an in-flight payment locks dismissal and duplicate submits.
The popup’s synchronous closing guard blocks payment during its exit animation. Once PaymentSheet
reports success, checkout remains terminal even if donation recording or counter updates fail;
`useTipCheckout` reports a post-payment failure separately from payment failure. A recipient
generation prevents an older inline checkout from updating a replacement recipient or firing
`onBacked` / `onTipped` for it. These UI guards retain the existing client-written `tips` credit
path; they do not provide authoritative server crediting or reconciliation.

Shared Daylight menu chrome and page headings provide app-wide visual consistency. Inventory,
APIs and exceptions: [MENU_STYLE_MAP.md](MENU_STYLE_MAP.md). This presentation change introduces
no tables, RPCs, payment credit path, fees, consent policy, runtime flags or new navigation routes.
`DOCUMENTATION` coordinates same-turn changes across every affected department.

## Sports identity presentation

Local scoreboards share recorded-state rules; missing scores remain unreported and scheduled/final
states override clocks. Profile credentials use the viewer’s exact linked player ID, and community
heroes suppress athlete confirmation. Highlights passes measured feed header clearance into
`ReelCard.overlayInsetTop`; copy and action columns can scroll within the remaining clip area.
Aura bursts remain outside scroll clipping. Native paging/owner-peek gesture checks are still pending.


## Profile sports and section navigation

`useAthleteStats(playerId, player?, targetSport?)` and `fetchAthleteStats` accept the athlete's explicit
selected sport. Own profiles supply it only from an exact linked player; public profiles use nullable
`profiles_public.athlete_sport` after migration `20261007211500`. Until applied, stored career sport
then unique exact catalog positions resolve identity; unknown or shared positions stay unknown.
Missing real values are `null` displayed as `—`; physicals remain recorded-only and logs stay empty.
Cross-sport career rows/logs are excluded. Only explicit demo/dev ids generate demo stats.
Playing stat tiles lead Stats; recorded sport measurables and logs follow.
`applyAthleteStatsPlaybook` supplies the same published labels/visible fields to Stats and Aura.
Aura points remain a reward metric, independent of playing stats. Hooks and public route loads
reject late responses after identity changes; hero/card state resets per profile.

One `AthleteProfileView` serves owner/public: compact known identity, 44-point actions, wrapping
Highlights / Stats / Goals / Vault / Team / Manage sections. Goals opens wishlist then Rally;
Team opens roster navigation; Manage contains owner actions, tag inbox, thank-yous and Vault lock.
School visibility gates roster fallbacks, crest and Team navigation. Exact links govern athlete
management. Community accounts keep account tools without borrowing favorite-athlete stats.
The shared full-size `ProfileHeroAvatar` remains available via `compact=false`.

Editable design references (2026-10-07): [Figma profiles and Aura](https://www.figma.com/design/SbcfpnmwNYtMOr3Ne6YUk0?node-id=2-36),
[Canva sports direction](https://canva.link/a7meiu3xkad3e9u). Figma public screen rendered; final
owner/Aura render requests reached the seat limit. Canva is art direction, not an exact UI spec.
Design stats show missing values; no fabricated stats, school proof, or fee changes.
