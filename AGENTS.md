# Expo HAS CHANGED

Read the exact versioned docs at [https://docs.expo.dev/versions/v57.0.0/](https://docs.expo.dev/versions/v57.0.0/) before writing any code.

Engineer onboarding: [DOCUMENTATION.md](DOCUMENTATION.md) · [docs/ONBOARDING.md](docs/ONBOARDING.md) · [docs/SCHEMA.md](docs/SCHEMA.md)

## Tapua'i Sports — Project Architecture & Conventions

### Directory Hierarchy Rules

- `app/` → **Expo Router only.** Layouts (`_layout.tsx`), tab routes `(tabs)` (`index` Home / Highlights ⚡ with Home · All · Seki + search, `local` nested stack (`index` + `game/[id]`), `spotlight`, `drip`, `profile`, hidden `user/[id]` + `athlete/[id]` redirect + `receipts`; `/shop` redirects), role groups (`(admin)/admin` production control plane: Marketing / Owner / Engineer / All lens; pinned Home plus Operations (games / sports / polls / boosters / publish) / Content / Commerce / Audience / Growth (reports / feedback / coverage) / System (features / look / catalogs / studio; lab / qa are hidden deep links); Back / Home trail on every desk), and `+api.ts` server routes.
- `src/frontend/components/` → Reusable UI (`PlayCard`, `AuraCard`, `AuraTradingCard`, `Profile/GlowingCardWrapper`, `Effects/GlowingNeonBorder`, `Effects/HypeBurst`, `AthleteProfileView`, `AthleteStatsTab`, `Profile/LockerRoomWishlist`, `VaultLockCard`, `PayoutSetupCard`, `ReceiptCard`, `RoleSwitcherModal`, `TeamSearchField`, `AthleteReelManager`, `SwipeableBannerWrapper`, `GearCard`, `ProductSheet`, `TipSheetModal` / `MaloTipModal`, `FanTabBar`, `ReelCard`, `Reels/ReelViewModal`, `Reels/LiveMatchBanner`, `Reels/ReportContentModal`, `Reels/ReelMoreSheet`, `Reels/HomeSearchOverlay`, `TaggedReelGrid`, `Local/CheerPollCard`, `Local/SearchResultsOverlay`, `Local/SponsorshipModal`, `TopAuraBoosters`, `Operator/PINClaimModal`, `Operator/LiveScoreHeader`, `Spotlight/SpotlightModal`, `Spotlight/SpotlightAwardCard`, `Spotlight/TagConfirmList`, `Admin/AdminShell`, `Admin/AdminOverview`, `Admin/AdminChrome`, `Admin/StudioTool`, `Admin/PublishTool`, `Admin/QaTool`, `Admin/FeaturesTool`, `Admin/LookTool`, `Admin/CatalogTool`, `Admin/LabTool`, `Admin/FeedbackTool`, `Admin/ReportsTool`, `Admin/CoverageTool`, `Admin/SportsTool`, `Admin/MoneyTool`, `Feedback/SuggestionSheet`, `RuntimePaused`).
- `src/frontend/context/` → React context (`AuthContext`, `CelebrationContext`, `RoleGate`, `UploadSheetContext`, `AppRuntimeContext`, `AdminLensContext`). There is **no** `GameContext`.
- `src/frontend/hooks/` → Data hooks (`useLiveScores`, `useLiveGame`, `useGameEventBroadcast`, `useTipCheckout`, `useStripeConnect`, `useRoster`, `useReels`, `useSavedReel`, `useAuraBoosters`, `useCheerPoll`, `useFanTipHistory`, `useSponsorships`, `useLocalSearch`, `useTeamSearch`, `useAthleteStats`, `useActiveSpotlight`, `useSpotlightBoard`, `usePendingPlayerTags`, `useCrew`, `useAdminDashboard`, `useDripCatalog`, `useSurfaceUsage`, `useSportConfigs`, `usePalette`). There is **no** `useLiveFeed` / `useStripePayment`.
- `src/frontend/lib/` → Client SDKs (`supabase.ts`, `stripe.native.ts` / `stripe.web.ts`, `aura.ts`, `reels.ts`, `reelVotes.ts`, `athleteStats.ts`, `teams.ts`, `vault.ts`, `spotlight.ts`, `tags.ts`, `crew.ts`, `finance.ts`, `admin.ts`, `adminCoverage.ts`, `runtime.ts`, `feedback.ts`, `wishlist.ts`, `sports.ts`).
- `src/frontend/theme/` → Motion tokens (`motion.ts`: `SPRING_CARD` / `SPRING_BOUNCE` / `SPRING_FLIP`, focal Neon Jade / Electric Gold / Electric Violet; `hypeFx.ts` Seki / Aura / Flex burst colors).
- `src/frontend/services/` → Process-wide clients (`TelemetryManager` singleton → `telemetry_logs`; `OfflineQueue` singleton → AsyncStorage + NetInfo flush of Aura / cheer / bookmark / report).
- `src/backend/api/` → Stripe handlers imported by `app/api/*+api.ts` (`createPaymentIntent.ts`, `createPayout.ts`, `createStripeAccount.ts`).
- `src/backend/db/` → Canonical SQL (`schema.sql`). RLS lives **in that file**, not `rls_policies.sql`.
- `scripts/` → Node generators (`sync-front-docs.mjs` writes `docs/PRODUCT_FACTS.md` and `product-facts` blocks in PUBLIC / INVESTOR / LEGAL). Run `npm run docs:sync` after price / PIN / Aura / Connect / athlete-sport / class-year / team-catalog / Highlight-label changes; CI runs `npm run docs:check` (also fails if `SCHEMA.md` omits a `schema.sql` table or RPC).

Path aliases: `@/*` → `src/frontend/*`, `@backend/*` → `src/backend/*`.

### Tech Stack & Guardrails

1. **Frontend:** React Native (Expo Router SDK 57), TypeScript, StyleSheet + `src/frontend/constants/theme.ts` (Daylight default; focal hexes from `src/frontend/theme/motion.ts`). Skia glow via `@shopify/react-native-skia` (`Effects/GlowingNeonBorder`). **Not NativeWind/Tailwind.**
2. **Video:** `expo-video` only. Do not use `expo-av` for the reel player (it is still in `package.json` but must not be wired). Do not set `useCaching: true`.
3. **Backend & Realtime:** Supabase PostgreSQL, Auth, Realtime WebSockets, Storage bucket `game_highlights`.
4. **Payments:** Stripe PaymentSheet (`@stripe/stripe-react-native`) + Expo API routes. Connect Express Account Links are minted only by Edge Function `create-stripe-account` with the session JWT (`sk_` never in `src/frontend/`). Native vs web PaymentSheet is split by Metro platform files.
5. **Environment:** Client keys must start with `EXPO_PUBLIC_`. Put secrets in `.env.local`, never `aladb.env` or `src/frontend/`.
6. **Product copy:** UI **Mālo** / **Seki** / **Highlights ⚡**. Persistence still uses `tips` / `reels` / `useTipCheckout`.
