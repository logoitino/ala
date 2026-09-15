# Expo HAS CHANGED

Read the exact versioned docs at [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/) before writing any code.

Engineer onboarding: [DOCUMENTATION.md](DOCUMENTATION.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ONBOARDING.md](docs/ONBOARDING.md) · [docs/SCHEMA.md](docs/SCHEMA.md)

## Tapua'i Sports — Project Architecture & Conventions

This repo is a **pnpm monorepo**.

| Package | Path |
| --- | --- |
| `@tapuai/mobile` | `apps/mobile/` — Expo Router SDK 57 fan app + Expo `/admin` |
| `@tapuai/admin-portal` | `apps/admin-portal/` — Next Soft-Wall control plane (Overview / Soft-Wall / Features / People); full desks still in Expo `/admin` |
| `@tapuai/shared-types` | `packages/shared-types/` — Profile / ActionStats / Spotlight / RPC shapes |

Root keeps `supabase/`, `docs/`, `scripts/`, `AGENTS.md`, `DOCUMENTATION.md`. Playground `my-app/` is outside the workspace.

### Directory Hierarchy Rules (`apps/mobile/`)

- `apps/mobile/app/` → **Expo Router only.** Layouts (`_layout.tsx`), tab routes `(tabs)` (`index` Home / Highlights ⚡ with Home · All · Seki + search, `local` nested stack (`index` + `game/[id]`), `spotlight`, `drip`, `profile`, hidden `user/[id]` + `athlete/[id]` redirect + `receipts`; `/shop` redirects), role groups (`(admin)/admin` production control plane: Marketing / Owner / Engineer / All lens; pinned Home plus Operations (games / sports / polls / boosters / publish) / Content / Commerce / Audience / Growth (reports / feedback / coverage) / System (features / look / catalogs / studio; lab / qa are hidden deep links); Back / Home trail on every desk), and `+api.ts` server routes.
- `apps/mobile/src/frontend/components/` → Reusable UI (`PlayCard`, `AuraCard`, `AuraTradingCard`, `Profile/GlowingCardWrapper`, `Effects/GlowingNeonBorder`, `Effects/HypeBurst`, `AthleteProfileView`, `AthleteStatsTab`, `Profile/LockerRoomWishlist`, `VaultLockCard`, `PayoutSetupCard`, `ReceiptCard`, `RoleSwitcherModal`, `TeamSearchField`, `AthleteReelManager`, `SwipeableBannerWrapper`, `GearCard`, `ProductSheet`, `TipSheetModal` / `MaloTipModal`, `EmptyState`, `FanTabBar`, `ReelCard`, `Reels/ReelViewModal`, `Reels/LiveMatchBanner`, `Reels/ReportContentModal`, `Reels/ReelMoreSheet`, `Reels/HomeSearchOverlay`, `TaggedReelGrid`, `Local/CheerPollCard`, `Local/SearchResultsOverlay`, `Local/SponsorshipModal`, `TopAuraBoosters`, `Operator/PINClaimModal`, `Operator/LiveScoreHeader`, `Spotlight/SpotlightModal`, `Spotlight/SpotlightAwardCard`, `Spotlight/TagConfirmList`, `Admin/AdminShell`, `Admin/AdminOverview`, `Admin/AdminChrome`, `Admin/StudioTool`, `Admin/PublishTool`, `Admin/QaTool`, `Admin/FeaturesTool`, `Admin/LookTool`, `Admin/CatalogTool`, `Admin/LabTool`, `Admin/FeedbackTool`, `Admin/ReportsTool`, `Admin/CoverageTool`, `Admin/SportsTool`, `Admin/MoneyTool`, `Feedback/SuggestionSheet`, `RuntimePaused`).
- `apps/mobile/src/frontend/context/` → React context (`AuthContext`, `SoftWallContext`, `CelebrationContext`, `RoleGate`, `UploadSheetContext`, `AppRuntimeContext`, `AdminLensContext`). There is **no** `GameContext`. Auth helpers live in `lib/auth.ts` (guest markers, Apple / Google / Magic Link). Soft wall UI: `components/Auth/SoftWallModal`, first-open `components/Onboarding/WelcomeOverlay`.
- `apps/mobile/src/frontend/hooks/` → Data hooks (`useLiveScores`, `useLiveGame`, `useGameEventBroadcast`, `useTipCheckout`, `useStripeConnect`, `useRoster`, `useReels`, `useSavedReel`, `useAuraBoosters`, `useCheerPoll`, `useFanTipHistory`, `useSponsorships`, `useLocalSearch`, `useTeamSearch`, `useAthleteStats`, `useActiveSpotlight`, `useSpotlightBoard`, `usePendingPlayerTags`, `useCrew`, `useAdminDashboard`, `useDripCatalog`, `useSurfaceUsage`, `useSportConfigs`, `usePalette`). There is **no** `useLiveFeed` / `useStripePayment`.
- `apps/mobile/src/frontend/lib/` → Client SDKs (`supabase.ts`, `stripe.native.ts` / `stripe.web.ts`, `aura.ts`, `reels.ts`, `reelVotes.ts`, `athleteStats.ts`, `teams.ts`, `vault.ts`, `spotlight.ts`, `tags.ts`, `crew.ts`, `finance.ts`, `admin.ts`, `adminCoverage.ts`, `runtime.ts`, `feedback.ts`, `wishlist.ts`, `sports.ts`).
- `apps/mobile/src/frontend/theme/` → Motion tokens (`motion.ts`: `SPRING_CARD` / `SPRING_BOUNCE` / `SPRING_FLIP`, Island Daylight `FOCAL` + `TAB_ACCENTS` — Home jade / Local cyan / Spotlight gold / Drip ember / Profile violet plus `mist*` washes; `hypeFx.ts` Seki / Aura / Flex burst colors).
- `apps/mobile/src/frontend/services/` → Process-wide clients (`TelemetryManager` singleton → `telemetry_logs`; `OfflineQueue` singleton → AsyncStorage + NetInfo flush of Aura / cheer / bookmark / report).
- `apps/mobile/src/backend/api/` → Stripe handlers imported by `apps/mobile/app/api/*+api.ts` (`createPaymentIntent.ts`, `createPayout.ts`, `createStripeAccount.ts`) plus JWT `session.ts`. PaymentIntent and payouts require a Bearer session; payout destination is `profiles.stripe_connect_id` for `auth.uid()`.
- `apps/mobile/src/backend/db/` → Canonical SQL (`schema.sql`). RLS lives **in that file**, not `rls_policies.sql`.
- `scripts/` (repo root) → Node generators (`sync-front-docs.mjs` writes `docs/PRODUCT_FACTS.md` and `product-facts` blocks in PUBLIC / INVESTOR / LEGAL). Run `pnpm docs:sync` after price / PIN / Aura / Connect / athlete-sport / class-year / team-catalog / Highlight-label changes; CI runs `pnpm docs:check` (also fails if `SCHEMA.md` omits a `schema.sql` table or RPC).

Path aliases (mobile): `@/*` → `apps/mobile/src/frontend/*`, `@backend/*` → `apps/mobile/src/backend/*`, `@shared/*` → `packages/shared-types/*`. Prefer `@tapuai/shared-types` for package imports.

### Tech Stack & Guardrails

1. **Frontend:** React Native (Expo Router SDK 57), TypeScript, StyleSheet + `apps/mobile/src/frontend/constants/theme.ts` (Daylight default; focal hexes from `apps/mobile/src/frontend/theme/motion.ts`). Skia glow via `@shopify/react-native-skia` (`Effects/GlowingNeonBorder`). **Not NativeWind/Tailwind** in mobile. Admin portal stub uses Tailwind.
2. **Video:** `expo-video` only. Do not use `expo-av` for the reel player (it is still in `package.json` but must not be wired). Do not set `useCaching: true`.
3. **Backend & Realtime:** Supabase PostgreSQL, Auth, Realtime WebSockets, Storage bucket `game_highlights`.
4. **Payments:** Stripe PaymentSheet (`@stripe/stripe-react-native`) + Expo API routes. PaymentIntent and payouts require a session JWT (`STRIPE_SECRET_KEY` only — never `EXPO_PUBLIC_STRIPE_SECRET_KEY`). Payout destination is `profiles.stripe_connect_id` for `auth.uid()`. Connect Express Account Links are minted only by Edge Function `create-stripe-account` with the session JWT (`sk_` never in `apps/mobile/src/frontend/`). Native vs web PaymentSheet is split by Metro platform files.
5. **Environment:** Mobile client keys must start with `EXPO_PUBLIC_` in `apps/mobile/.env.local`. Admin portal uses `NEXT_PUBLIC_*` in `apps/admin-portal/.env.local`. Never `aladb.env` or secrets under `src/frontend/`.
6. **Product copy:** UI **Mālo** / **Seki** / **Highlights ⚡**. Persistence still uses `tips` / `reels` / `useTipCheckout`.
7. **Package manager:** `pnpm` at the repo root (`pnpm-workspace.yaml`). Day-to-day: `pnpm install`, `pnpm mobile`, `pnpm admin`.
