# Expo HAS CHANGED

> **Read [docs/STATE.md](docs/STATE.md) before touching anything.** It carries the current
> state of the project, what changed most recently, the environment gotchas that will cost you
> an hour (blocked npm registry, Metro flags, untappable simulator), and the list of things that
> are *knowingly* broken so you do not re-diagnose them.
>
> **When you finish, update it.** Any change under `apps/`, `packages/` or `supabase/` must add a
> line to `docs/STATE.md` §4 and bump its `Last updated` header, in the same turn as the code.
> CI enforces this on pull requests.


Read the exact versioned docs at [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/) before writing any code.

Engineer onboarding: [docs/CONVENTIONS.md](docs/CONVENTIONS.md) (naming + placement) · [DOCUMENTATION.md](DOCUMENTATION.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ONBOARDING.md](docs/ONBOARDING.md) · [docs/SCHEMA.md](docs/SCHEMA.md) · [docs/TEAMS.md](docs/TEAMS.md) (department call sheet)

## Tapua'i Sports — Project Architecture & Conventions

This repo is a **pnpm monorepo**.

| Package | Path |
| --- | --- |
| `@tapuai/mobile` | `apps/mobile/` — Expo Router SDK 57 fan app + Expo `/admin` |
| `@tapuai/admin-portal` | `apps/admin-portal/` — Next web admin, **read-only oversight** (Overview / Reports / Money / Soft-Wall / Profile / Features / People); every write — Features/Look flags, Games, Drip, Catalogs, everything — happens only in Expo `/admin`, which this portal reads from (including `app_runtime_config`) |
| `@tapuai/shared-types` | `packages/shared-types/` — Profile / ActionStats / Spotlight / Soft-Wall + Profile chrome / RPC shapes |

Root keeps `supabase/`, `docs/`, `scripts/`, `AGENTS.md`, `DOCUMENTATION.md`. Playground `my-app/` is outside the workspace.

### Directory Hierarchy Rules (`apps/mobile/`)

- `apps/mobile/app/` → **Expo Router only.** Layouts (`_layout.tsx`), tab routes `(tabs)` (`index` Home / Highlights ⚡ with Home · All · Seki pills carrying live counts, a search control, and a **Local** pill that navigates rather than filters; `activity` Activity — the fan-bar slot Local used to hold; `local` nested stack (`index` + `game/[id]`) still routable but **not** a bar item; `spotlight`, `drip`, `profile`, hidden `user/[id]` + `athlete/[id]` redirect + `receipts`; `/shop` redirects), role groups (`(admin)/admin` production control plane: Marketing / Owner / Engineer / All lens; pinned Home plus Operations (games / sports / polls / boosters / publish) / Content / Commerce / Audience / Growth (reports / feedback / coverage) / System (features / look / catalogs / studio; lab / qa are hidden deep links); Back / Home trail on every desk), the fan/role groups `(athlete)` / `(booster)` / `(fan)` / `(guest)` / `(parent)` / `(sponsor)`, the `operator/` console (`index`, `[gameId]`, `console/[gameId]`, `scorer`), `auth/callback`, `gift/[handle]`, `school-confirm` (school AD/coach confirmation form, `?t=` link token), `stripe-connect`, and `+api.ts` server routes.
- `apps/mobile/src/frontend/components/` → Reusable UI, grouped **by consuming feature**; see [docs/CONVENTIONS.md](docs/CONVENTIONS.md) §2 for the placement rule. Subfolders: `Admin/`, `Auth/`, `Common/`, `Custodial/`, `Drip/`, `Effects/`, `Feedback/`, `Filmers/`, `Legal/`, `Local/`, `Onboarding/`, `Operator/`, `Profile/`, `Reels/`, `Spotlight/`, `UI/`, `Verification/`. Flat is reserved for genuinely cross-cutting pieces (`ScreenShell`, `ScreenHeading`, `TabScreen`, `RuntimePaused`, `TipSheetModal`, `AuraToast`, `BackedCelebration`, `DashboardPanel`, `TipCheckout`, `PlayCard`, `TipButton`, `FeeCheckbox`) — anything with a single consumer belongs in that consumer's subfolder.
- `apps/mobile/src/frontend/context/` → React context (`AuthContext`, `SoftWallContext`, `CelebrationContext`, `RoleGate`, `UploadSheetContext`, `AppRuntimeContext`, `AdminLensContext`). There is **no** `GameContext`. Auth helpers live in `lib/auth.ts` (guest markers, Apple / Google / Magic Link). Soft wall UI: `components/Auth/SoftWallModal`, first-open `components/Onboarding/WelcomeOverlay`.
- `apps/mobile/src/frontend/hooks/` → Data hooks (`useLiveScores`, `useLiveGame`, `useGameEventBroadcast`, `useTipCheckout`, `useStripeConnect`, `useLegalAck`, `useAthleteSubscription`, `useRoster`, `useReels`, `useSavedReel`, `useAuraBoosters`, `useCheerPoll`, `useFanTipHistory`, `useReceivedMalo`, `useSponsorships`, `useLocalSearch`, `useTeamSearch`, `useAthleteStats`, `useActiveSpotlight`, `useSpotlightBoard`, `usePendingPlayerTags`, `useCrew`, `useAdminDashboard`, `useDripCatalog`, `useSurfaceUsage`, `useSportConfigs`, `useSheetFrame` (also exports `SHEET_BLUR_INTENSITY`), `useActivityFeed`, `useCustodial`, `useLeaderboards`, `useReelViewTracker`, `useMyVerification`, `useSchoolBadge`, `useFilmerStats`). There is **no** `useLiveFeed` / `useStripePayment`.
- `apps/mobile/src/frontend/lib/` → Client SDKs (`supabase.ts`, `stripe.native.ts` / `stripe.web.ts`, `aura.ts`, `reels.ts`, `reelVotes.ts`, `athleteStats.ts`, `teams.ts`, `roster.ts`, `vault.ts`, `spotlight.ts`, `tags.ts`, `crew.ts`, `finance.ts`, `legal.ts`, `verification.ts`, `share.ts`, `admin.ts`, `adminCoverage.ts`, `runtime.ts`, `feedback.ts`, `wishlist.ts`, `sports.ts`, `socialLinks.ts`, `custodial.ts`, `leaderboards.ts`, `walletPay.ts`, `schoolConfirm.ts`, `payoutGate.ts`, `schoolBadge.ts`, `filmers.ts`).
- `apps/mobile/src/frontend/theme/` → Motion tokens (`motion.ts`: `SPRING_CARD` / `SPRING_BOUNCE` / `SPRING_FLIP`, Island Daylight `FOCAL` + `TAB_ACCENTS` — Home jade / Local cyan / Activity violet / Spotlight gold / Drip ember / Profile violet plus `mist*` washes; `hypeFx.ts` Seki / Aura / Flex burst colors).
- `apps/mobile/src/frontend/services/` → Process-wide clients (`TelemetryManager` singleton → `telemetry_logs`; `OfflineQueue` singleton → AsyncStorage + NetInfo flush of Aura / cheer / bookmark / report; `MediaUploadService` → `react-native-compressor` + Storage `reels` / `avatars`).
- `apps/mobile/src/backend/api/` → Stripe handlers imported by `apps/mobile/app/api/*+api.ts` (`createPaymentIntent.ts`, `createPayout.ts`, `createStripeAccount.ts`, `session.ts`).
- `apps/mobile/src/backend/services/` → Server-side domain logic behind those handlers (`payouts.ts`).
- `apps/mobile/src/backend/db/` → Canonical SQL (`schema.sql`). RLS lives **in that file**, not `rls_policies.sql`.
- `supabase/migrations/` → New database changes, one timestamped file each, never edited once applied; copy each onto `schema.sql`. Read `supabase/migrations/README.md`.
- `scripts/` (repo root) → Node generators (`sync-front-docs.mjs` writes `docs/PRODUCT_FACTS.md` and `product-facts` blocks in PUBLIC / INVESTOR / LEGAL). Run `pnpm docs:sync` after price / PIN / Aura / Connect / athlete-sport / class-year / team-catalog / Highlight-label changes; CI runs `pnpm docs:check` (also fails if `SCHEMA.md` omits a `schema.sql` table or RPC).

Path aliases (mobile): `@/*` → `apps/mobile/src/frontend/*`, `@backend/*` → `apps/mobile/src/backend/*`, `@shared/*` → `packages/shared-types/*`. Prefer `@tapuai/shared-types` for package imports.

### Tech Stack & Guardrails

1. **Frontend:** React Native (Expo Router SDK 57), TypeScript, StyleSheet + `apps/mobile/src/frontend/constants/theme.ts` (Daylight default; focal hexes from `apps/mobile/src/frontend/theme/motion.ts`). Skia glow via `@shopify/react-native-skia` (`Effects/GlowingNeonBorder`). **Not NativeWind/Tailwind** in mobile. Admin portal stub uses Tailwind.
2. **Video:** `expo-video` only. Do not use `expo-av` for the reel player (it is still in `package.json` but must not be wired). Do not set `useCaching: true`.
3. **Backend & Realtime:** Supabase PostgreSQL, Auth, Realtime WebSockets, Storage buckets `game_highlights`, `reels`, `avatars`.
4. **Payments:** Stripe PaymentSheet (`@stripe/stripe-react-native`) + Expo API routes. Connect Express Account Links are minted only by Edge Function `create-stripe-account` with the session JWT (`sk_` never in `apps/mobile/src/frontend/`). Native vs web PaymentSheet is split by Metro platform files.
5. **Environment:** Mobile client keys must start with `EXPO_PUBLIC_` in `apps/mobile/.env.local`. Admin portal uses `NEXT_PUBLIC_*` in `apps/admin-portal/.env.local`. Never `aladb.env` or secrets under `src/frontend/`.
6. **Product copy:** UI **Mālo** / **Seki** / **Highlights ⚡**. Persistence still uses `tips` / `reels` / `useTipCheckout`.
7. **Package manager:** `pnpm` at the repo root (`pnpm-workspace.yaml`). Day-to-day: `pnpm install`, `pnpm mobile`, `pnpm admin`.
