<!-- Current app/source/role guardrails; Security source reporting is independent of hosted acceptance. -->
# Expo HAS CHANGED

> **Read [docs/STATE.md](docs/STATE.md) before touching anything.** It carries the current
> state of the project, what changed most recently, the environment gotchas that will cost you
> an hour (blocked npm registry, Metro flags, untappable simulator), and the list of things that
> are *knowingly* broken so you do not re-diagnose them.
>
> **When you finish, update it.** Any change under `apps/`, `packages/` or `supabase/` must add a
> line to `docs/STATE.md` §4 and bump its `Last updated` header, in the same turn as the code.
> CI enforces this on pull requests.


Read the exact versioned docs at [https://docs.expo.dev/versions/v58.0.0/](https://docs.expo.dev/versions/v58.0.0/) before writing any code.

Docs layout (2026-10-07): entry points at `docs/` ([README](docs/README.md) index · STATE · [ONBOARDING](docs/ONBOARDING.md) · [GLOSSARY](docs/GLOSSARY.md) code names ↔ product words); `docs/engineering/` (with `design/`), `docs/product/`, `docs/legal/`, `docs/company/`, `docs/agents/`. New docs go in the matching folder and get a row in `docs/README.md`. Readiness plan R1–R4 (dev → production): [CODE_ORGANIZATION_PLAN.md](docs/engineering/CODE_ORGANIZATION_PLAN.md). Run `pnpm check` before finishing; it includes local documentation destinations (`docs:links`), client credential markers (`security:client-keys`) and the master data map (`data:map:check`). **Data control point:** `DATA_GOVERNANCE` reviews every new or changed table, column, view, database function, export or Storage path; record it in `docs/engineering/data-ownership.json` and regenerate `docs/engineering/DATA_MAP.md` (`node scripts/data-map.mjs`) in the same change ([DATA_GOVERNANCE.md](docs/engineering/DATA_GOVERNANCE.md)). Never delete what looks dead; archive with the owner's approval. Local setup and CI use Node 24.

Engineer onboarding: [docs/engineering/CONVENTIONS.md](docs/engineering/CONVENTIONS.md) (naming + placement) · [SYSTEM_OVERVIEW.md](docs/engineering/SYSTEM_OVERVIEW.md) · [docs/engineering/ARCHITECTURE.md](docs/engineering/ARCHITECTURE.md) · [docs/ONBOARDING.md](docs/ONBOARDING.md) · [docs/engineering/SCHEMA.md](docs/engineering/SCHEMA.md) · [docs/agents/TEAMS.md](docs/agents/TEAMS.md) (department call sheet) · [docs/product/VOICE.md](docs/product/VOICE.md) (donation language) · [docs/engineering/CONVENTIONS.md](docs/engineering/CONVENTIONS.md) §5 (**comment every file you touch** — header on every file, *why* not *what* inline; CI runs `pnpm comments:check`)

## Tapua'i Sports — Project Architecture & Conventions

This repo is a **pnpm monorepo**.

| Package | Path |
| --- | --- |
| `@tapuai/mobile` | `apps/mobile/` — Expo Router SDK 58 fan app + Expo `/admin` |
| `@tapuai/admin-portal` | `apps/admin-portal/` — Next web admin, **read-only oversight** (Home / Trends / Audience / Revenue / Health / Product, plus Analytics and Departments; inline-SVG charts in `components/charts/`; the report format — wide header, underline tabs, open panels — is the default look on every page, owner decision 2026-10-12); every write — Features/Look flags, Games, Drip, Catalogs, everything — happens only in Expo `/admin`, which this portal reads from (including `app_runtime_config`) |
| `@tapuai/shared-types` | `packages/shared-types/` — Profile / ActionStats / Spotlight / Soft-Wall + Profile chrome / RPC shapes |

Root keeps `supabase/`, `docs/`, `scripts/`, `patches/`, `archive/`, `AGENTS.md`, `CLAUDE.md`. Versioned dependency fixes belong in `patches/` and the root pnpm manifest/lockfile; do not rely on an untracked `node_modules` edit. The old Expo playground is in `archive/my-app/` (reference only, outside the workspace; see `archive/README.md`). The root `app.json` (`{"expo": {}}`) is intentional; the real app config is `apps/mobile/app.json`.

### Directory Hierarchy Rules (`apps/mobile/`)

- `apps/mobile/app/` → **Expo Router only.** Layouts (`_layout.tsx`), tab routes `(tabs)` (`beyond` Beyond the Game page — fan workouts, service, learning and stories plus own posts; routable, **not** a bar item, opened from the Home bar and Upload ＋ (`?compose=1`); Drip reached from Profile; `index` Home / Highlights ⚡ with a Home pill, a **Beyond** pill that filters to Train Like Me / Serve Like Me Highlights and links to the Beyond page, a search control, and a **Local** pill that navigates rather than filters (All and Seki are off the bar for now); Upload ＋ asks Highlight or Beyond moment (`Reels/UploadChoiceSheet`) only while Beyond contributions are on; `activity` Activity — the fan-bar slot Local used to hold; `local` nested stack (`index` + `game/[id]`) still routable but **not** a bar item; `spotlight`, `drip`, `profile`, hidden `user/[id]` + `athlete/[id]` redirect + `receipts`; `/shop` redirects), role groups (`(admin)/admin` production control plane: Marketing / Owner / Engineer / All lens; pinned Home plus Operations (games / sports / polls / boosters / publish) / Content (Highlights & review joins moderation) / Commerce / Audience / Growth (feedback; saved reports links open Analytics) / System (App setup joins features / look / catalogs / lab; QA / Studio share Tools; Coverage opens Product Control map); Back / Home trail on every desk), the fan/role groups `(athlete)` / `(booster)` / `(fan)` / `(guest)` / `(parent)` / `(sponsor)`, the `operator/` console (`index`, `[gameId]`, `console/[gameId]`, `scorer`), `auth/callback`, `gift/[handle]`, `school-confirm` (school AD/coach confirmation form, `?t=` link token), `stripe-connect`, and `+api.ts` server routes.
- `apps/mobile/src/frontend/components/` → Reusable UI, grouped **by consuming feature**; see [docs/engineering/CONVENTIONS.md](docs/engineering/CONVENTIONS.md) §2 for the placement rule. Subfolders: `Activity/`, `Admin/`, `Auth/`, `BeyondGame/`, `Challenges/`, `Common/`, `Custodial/`, `Drip/`, `Effects/`, `Feedback/`, `Filmers/`, `Legal/`, `Local/`, `Onboarding/`, `Operator/`, `Profile/`, `Rally/`, `Reels/`, `Spotlight/`, `Thanks/`, `UI/`, `Verification/`. Flat is reserved for genuinely cross-cutting pieces (`ScreenShell`, `ScreenHeading`, `TabScreen`, `RuntimePaused`, `TipSheetModal`, `AuraToast`, `BackedCelebration`, `DashboardPanel`, `TipCheckout`, `PlayCard`, `TipButton`, `FeeCheckbox`) — anything with a single consumer belongs in that consumer's subfolder.
- `apps/mobile/src/frontend/context/` → React context (`AuthContext`, `SoftWallContext`, `CelebrationContext`, `RoleGate`, `UploadSheetContext`, `AppRuntimeContext`, `AdminLensContext`). There is **no** `GameContext`. Auth helpers live in `lib/auth.ts` (guest markers, Apple / Google / Magic Link). Soft wall UI: `components/Auth/SoftWallModal`, first-open `components/Onboarding/WelcomeOverlay`.
- `apps/mobile/src/frontend/hooks/` → Data hooks (`useLiveScores`, `useLiveGame`, `useGameEventBroadcast`, `useTipCheckout`, `useStripeConnect`, `useLegalAck`, `useAthleteSubscription`, `useRoster`, `useReels`, `useSavedReel`, `useAuraBoosters`, `useCheerPoll`, `useFanTipHistory`, `useReceivedMalo`, `useSponsorships`, `useLocalSearch`, `useTeamSearch`, `useAthleteStats`, `useActiveSpotlight`, `useSpotlightBoard`, `useBeyondLegacyClips` (bounded Beyond legacy cards), `useChallenges` (current participant lifecycle), `usePendingPlayerTags`, `useCrew`, `useAdminDashboard`, `useDripCatalog`, `useSurfaceUsage`, `useSportConfigs`, `useSheetFrame` (also exports `SHEET_BLUR_INTENSITY`), `useActivityFeed`, `useCustodial`, `useLeaderboards`, `useReelViewTracker`, `useMyVerification`, `useSchoolBadge`, `useFilmerStats`, `useRally`, `useDonationThanks`, `useStoryPhotos`, `useBooks`, `useAdminAction` (one busy / single-tap / notice runner for admin writes), `useScreenMountTime` (smoothness mount timing), `useViewerSport` (UX-08: the viewer's sport for decorative field lines; generic for non-athletes)). There is **no** `useLiveFeed` / `useStripePayment`.
- `apps/mobile/src/frontend/lib/` → Client SDKs (`supabase.ts`, `stripe.native.ts` / `stripe.web.ts`, `aura.ts`, `reels.ts`, `reelVotes.ts`, `athleteStats.ts`, `teams.ts`, `roster.ts`, `guestGames.ts`, `vault.ts`, `spotlight.ts`, `tags.ts`, `crew.ts`, `finance.ts`, `legal.ts`, `verification.ts`, `share.ts`, `giftLink.ts` (Share & Donate QR link — username or athlete id — and `/gift/[handle]` lookup, shared by native and web), `admin.ts` (re-exports desk navigation from `adminNav.ts`, R4-03), `adminCatalog.ts` (re-exports Drip / wishlist racks from `adminShop.ts`, R4-03), `adminCoverage.ts`, `runtime.ts`, `feedback.ts`, `wishlist.ts`, `sports.ts`, `socialLinks.ts`, `custodial.ts`, `leaderboards.ts`, `walletPay.ts`, `schoolConfirm.ts`, `payoutGate.ts`, `schoolBadge.ts`, `filmers.ts`, `rallies.ts`, `donationThanks.ts`, `photoStories.ts`, `boosterPortal.ts`, `sponsorAds.ts`, `bookkeeping.ts`, `csvExport.ts` / `csvExport.web.ts`, `adminControls.ts`, `rpc.ts` (`callRpc` / `untypedRpc`: the one bound way to call a database function), `privacy.ts` (PRIV-01 privacy, friends, blocks), `minors.ts` (MINOR-01 age, guardian link, consent, supervision), `payeeVerification.ts` (VERIFY-02 admin payee checks and two-admin override), `redact.ts` (strips SSN-shaped text from telemetry), `media.ts` (provider-neutral media references and the one public-URL builder — PORT-01), `cheerPoll.ts` (cheer poll row, Realtime and `cast_cheer_vote`), `savedReels.ts`, `liveGames.ts`, `localSearch.ts`, `sponsorships.ts` (PORT-01: calls moved out of hooks / routes), `donationHistory.ts` / `subscriptions.ts` (R4-03: donation receipts and received donations; exclusive passes and subscriber requests, moved out of their hooks), `liveScoreSync.ts` (SCALE-03: per-game Broadcast merge and refetch decisions for `useLiveScores`; switch `EXPO_PUBLIC_LIVE_SCORES_BROADCAST`, default off), `adminMfa.ts` (SCALE-01: Expo `/admin` TOTP two-step sign-in for `AdminShell` / `Admin/AdminMfaGate`; switch `EXPO_PUBLIC_ADMIN_REQUIRE_MFA`, default off; rule shared with the portal in `packages/shared-types/admin/adminMfa.ts`), `dbErrors.ts` (the one "migration not applied yet" check: `isMissingFunction` / `isMissingColumn` / `isMissingRelation` — use it, do not write another)).
- `apps/mobile/app/` → **Expo Router only.** Layouts (`_layout.tsx`), tab routes `(tabs)` (`index` Home / Highlights ⚡ with a Home pill, a search control, and a **Local** pill that navigates rather than filters (All and Seki are off the bar for now); `activity` Activity — the fan-bar slot Local used to hold; `local` nested stack (`index` + `game/[id]`) still routable but **not** a bar item; `spotlight`, `drip`, `profile`, hidden `user/[id]` + `athlete/[id]` redirect + `receipts`; `/shop` redirects), role groups (`(admin)/admin` production control plane: Marketing / Owner / Engineer / All lens; pinned Home plus Operations (games / sports / polls / boosters / publish) / Content (Highlights & review joins moderation) / Commerce / Audience / Growth (feedback; saved reports links open Analytics) / System (App setup joins features / look / catalogs / lab; QA / Studio share Tools; Coverage opens Product Control map); Back / Home trail on every desk), the fan/role groups `(athlete)` / `(booster)` / `(fan)` / `(guest)` / `(parent)` / `(sponsor)`, the `operator/` console (`index`, `[gameId]`, `console/[gameId]`, `scorer`), `auth/callback`, `gift/[handle]`, `school-confirm` (school AD/coach confirmation form, `?t=` link token), `stripe-connect`, `dev/trivia-preview` (dev-only QUIZ-04 trivia effects demo with scripted sample questions; nothing saved or fetched; redirects to Home when `EXPO_PUBLIC_APP_ENV=production`; not linked from any menu), and `+api.ts` server routes.
- `apps/mobile/src/frontend/components/` → Reusable UI, grouped **by consuming feature**; see [docs/engineering/CONVENTIONS.md](docs/engineering/CONVENTIONS.md) §2 for the placement rule. Subfolders: `Activity/`, `Admin/`, `Auth/`, `Common/`, `Custodial/`, `Drip/`, `Effects/`, `Feedback/`, `Filmers/`, `Legal/`, `Local/`, `Onboarding/`, `Operator/`, `Profile/`, `Rally/`, `Reels/`, `Spotlight/`, `Thanks/`, `UI/`, `Verification/`. Flat is reserved for genuinely cross-cutting pieces (`ScreenShell`, `ScreenHeading`, `TabScreen`, `RuntimePaused`, `TipSheetModal`, `AuraToast`, `BackedCelebration`, `DashboardPanel`, `TipCheckout`, `PlayCard`, `TipButton`, `FeeCheckbox`) — anything with a single consumer belongs in that consumer's subfolder.
- `apps/mobile/src/frontend/context/` → React context (`AuthContext`, `SoftWallContext`, `CelebrationContext`, `RoleGate`, `UploadSheetContext`, `AppRuntimeContext`, `AdminLensContext`). There is **no** `GameContext`. Auth helpers live in `lib/auth.ts` (guest markers, Apple / Google / Magic Link). Soft wall UI: `components/Auth/SoftWallModal`, first-open `components/Onboarding/WelcomeOverlay`.
- `apps/mobile/src/frontend/hooks/` → Data hooks (`useLiveScores`, `useLiveGame`, `useGameEventBroadcast`, `useTipCheckout`, `useStripeConnect`, `useLegalAck`, `useAthleteSubscription`, `useRoster`, `useReels`, `useSavedReel`, `useAuraBoosters`, `useCheerPoll`, `useFanTipHistory`, `useReceivedMalo`, `useSponsorships`, `useLocalSearch`, `useTeamSearch`, `useAthleteStats`, `useActiveSpotlight`, `useSpotlightBoard`, `usePendingPlayerTags`, `useCrew`, `useAdminDashboard`, `useDripCatalog`, `useSurfaceUsage`, `useSportConfigs`, `useSheetFrame` (also exports `SHEET_BLUR_INTENSITY`), `useActivityFeed`, `useCustodial`, `useLeaderboards`, `useReelViewTracker`, `useMyVerification`, `useSchoolBadge`, `useFilmerStats`, `useRally`, `useDonationThanks`, `useStoryPhotos`, `useBooks`, `useAdminAction` (one busy / single-tap / notice runner for admin writes), `useReduceMotion` (live Reduce Motion setting), `useQuizSound` (QUIZ-04 saved Sound on / off and the trivia cue player), `useScreenMountTime` (smoothness mount timing), `useViewerSport` (UX-08: the viewer's sport for decorative field lines; generic for non-athletes)). There is **no** `useLiveFeed` / `useStripePayment`.
- `apps/mobile/src/frontend/lib/` → Client SDKs (`supabase.ts`, `stripe.native.ts` / `stripe.web.ts`, `aura.ts`, `reels.ts`, `reelVotes.ts`, `athleteStats.ts`, `teams.ts`, `roster.ts`, `guestGames.ts`, `vault.ts`, `spotlight.ts`, `tags.ts`, `crew.ts`, `finance.ts`, `legal.ts`, `verification.ts`, `share.ts`, `giftLink.ts` (Share & Donate QR link — username or athlete id — and `/gift/[handle]` lookup, shared by native and web), `admin.ts` (re-exports desk navigation from `adminNav.ts`, R4-03), `adminCatalog.ts` (re-exports Drip / wishlist racks from `adminShop.ts`, R4-03), `adminCoverage.ts`, `runtime.ts`, `feedback.ts`, `wishlist.ts`, `sports.ts`, `socialLinks.ts`, `custodial.ts`, `leaderboards.ts`, `walletPay.ts`, `schoolConfirm.ts`, `payoutGate.ts`, `schoolBadge.ts`, `filmers.ts`, `rallies.ts`, `donationThanks.ts`, `photoStories.ts`, `boosterPortal.ts`, `sponsorAds.ts`, `bookkeeping.ts`, `csvExport.ts` / `csvExport.web.ts`, `quizSound.ts` / `quizSound.web.ts` / `quizSound.types.ts` (QUIZ-04 trivia cues: phone haptics with the one native-audio plug-in point, browser Web Audio synth), `adminControls.ts`, `rpc.ts` (`callRpc` / `untypedRpc`: the one bound way to call a database function), `privacy.ts` (PRIV-01 privacy, friends, blocks), `minors.ts` (MINOR-01 age, guardian link, consent, supervision), `payeeVerification.ts` (VERIFY-02 admin payee checks and two-admin override), `lifePlaybook.ts` (QUIZ-04 Life Playbook: Life Start, private opt-in, chapters, progress, level and the admin Life desk), `freshQuestions.ts` (QUIZ-05: fun facts for athletes / guardians / admins, question reports, Learn-card Start, Needs a look, bulk import and its paste parser, fresh-question settings), `donationHistory.ts` / `subscriptions.ts` (R4-03: donation receipts and received donations; exclusive passes and subscriber requests, moved out of their hooks), `redact.ts` (strips SSN-shaped text from telemetry), `dbErrors.ts` (the one "migration not applied yet" check: `isMissingFunction` / `isMissingColumn` / `isMissingRelation` — use it, do not write another)).
- `apps/mobile/src/frontend/theme/` → Motion tokens (`motion.ts`: `SPRING_CARD` / `SPRING_BOUNCE` / `SPRING_FLIP`, Island Daylight `FOCAL` + `TAB_ACCENTS` — Home jade / Local cyan / Activity violet / Spotlight gold / Drip ember / Profile violet plus `mist*` washes; `hypeFx.ts` Seki / Aura / Flex burst colors).
- `apps/mobile/src/frontend/services/` → Process-wide clients (`TelemetryManager` singleton → `telemetry_logs`; `OfflineQueue` singleton → AsyncStorage + NetInfo flush of Aura / cheer / bookmark / report; `MediaUploadService` → `react-native-compressor` + Storage `reels` / `avatars`).
- `apps/mobile/src/backend/api/` → Node adapters for the Stripe handlers imported by `apps/mobile/app/api/*+api.ts` (`createPaymentIntent.ts`, `createPayout.ts`, `createStripeAccount.ts`, `session.ts`). The money logic itself is the runtime-neutral core in `supabase/functions/_shared/money/` (SCALE-04), shared with the Edge Functions; change it there, not in an adapter. Money-moving routes (payouts, Connect) confirm the session with `getUser`; only checkout may use the local token check.
- `supabase/functions/_shared/` → Code shared by the Edge Functions and the Node routes (no `Deno` / `process` globals, `.ts` import extensions). Not a deployable function.
- `apps/mobile/src/backend/services/` → Server-side domain logic behind those handlers (`payouts.ts`).
- `apps/mobile/src/backend/db/` → Canonical SQL (`schema.sql`). RLS lives **in that file**, not `rls_policies.sql`.
- `supabase/migrations/` → New database changes, one timestamped file each, never edited once applied; copy each onto `schema.sql`. Read `supabase/migrations/README.md`.
- `scripts/` (repo root) → Node generators (`sync-front-docs.mjs` writes `docs/product/PRODUCT_FACTS.md` and `product-facts` blocks in PUBLIC / INVESTOR / LEGAL). Run `pnpm docs:sync` after price / PIN / Aura / Connect / athlete-sport / class-year / team-catalog / Highlight-label changes; CI runs `pnpm docs:check` (also fails if `SCHEMA.md` omits a `schema.sql` table or RPC).

Path aliases (mobile): `@/*` → `apps/mobile/src/frontend/*`, `@backend/*` → `apps/mobile/src/backend/*`, `@shared/*` → `packages/shared-types/*`. Prefer `@tapuai/shared-types` for package imports.

### Tech Stack & Guardrails

1. **Frontend:** React Native (Expo Router SDK 58), TypeScript, StyleSheet + `apps/mobile/src/frontend/constants/theme.ts` (Daylight default; focal hexes from `apps/mobile/src/frontend/theme/motion.ts`). Skia glow via `@shopify/react-native-skia` (`Effects/GlowingNeonBorder`). **Not NativeWind/Tailwind** in mobile. Admin portal stub uses Tailwind.
2. **Video:** `expo-video` only. Do not use `expo-av` for the reel player (it is still in `package.json` but must not be wired). Do not set `useCaching: true`. PLAY-01 patches Expo Video's web play promises and pause intent (ported from 57.0.5 to 58.0.11 with SDK 58); pnpm applies the versioned patch during install. Review/remove or port it when upgrading Expo Video; app try/catch cannot catch a discarded DOM play promise. See [PLAY-01](docs/agents/PLAY-01.md). `patches/expo@58.0.14.patch` removes web-only style declarations that clash with React Native 0.88's own types; drop it once Expo fixes them.
3. **Backend & Realtime:** Supabase PostgreSQL, Auth, Realtime WebSockets, Storage buckets `game_highlights`, `reels`, `avatars`.
4. **Payments:** Stripe PaymentSheet (`@stripe/stripe-react-native`) + Expo API routes. Connect Express Account Links are minted only by Edge Function `create-stripe-account` with the session JWT (`sk_` never in `apps/mobile/src/frontend/`). Native vs web PaymentSheet is split by Metro platform files.
5. **Environment:** Mobile client keys must start with `EXPO_PUBLIC_` in `apps/mobile/.env.local`. Admin portal uses `NEXT_PUBLIC_*` in `apps/admin-portal/.env.local`. Never `aladb.env` or secrets under `src/frontend/`.
6. **Product copy (owner, 2026-10-22):** individual athlete/family money is **Gift / Give / Send a gift**; program/club money is **Donation / Donate to the program**; platform support is **Tip Tapua'i (optional)**; Stripe-cost coverage is **Cover the processing fee**; premium is **Subscription**, digital extras **Purchase**. Never bundle giving and digital access. The old 2026-09-29 donation-everywhere/10% framing is superseded history in [VOICE](docs/product/VOICE.md). Preserve actual money math until its separate reviewed change; checkout copy follows the tip model and default-OFF `MONETIZATION_TIPS_ENABLED`. Athletes use preset thanks; "Mālo!" is only a thank-you. `pnpm copy:check` checks source words; counsel owns final Terms. Keep all identifiers (`tips`, `reels`, `useTipCheckout`, `malo*`) unchanged.
7. **Package manager:** `pnpm` at the repo root (`pnpm-workspace.yaml`). Day-to-day: `pnpm install`, `pnpm mobile`, `pnpm admin`.


### Future features: admin handling before app implementation

Every future feature agent/session must follow [FEATURE_ADMIN_WORKFLOW](docs/engineering/FEATURE_ADMIN_WORKFLOW.md).
Enroll the feature in `docs/agents/feature-admin.json` with the linked template before app implementation.
The responsible lead assigns one owner, reuses existing admin desks/reports, and reviews source,
actions, reporting, access/privacy, disable/repair behavior and actual verification evidence.
Build and verify the admin handling first; pass `pnpm feature-admin:check --feature ID --require admin-ready`
before starting the app experience. Preserve that checkpoint, build/verify the app, then pass
`pnpm feature-admin:check --feature ID --require app-ready` before completed-feature handoff.
Presentation-only work uses the documented reason/reviewer/evidence exemption. Ordinary repairs
follow the existing fix process unless they introduce a capability or operational responsibility.
The gate validates registered metadata, local files and evidence; it cannot infer omitted features,
authenticate work order, apply migrations or certify hosted/device/release readiness. Lead review
must check enrollment and the actual evidence. `pnpm check` includes its tests and registry validation.

### Engineering Support: detection and repair

`SUPPORT` reports to `ENGINEERING`; INCIDENT_TRIAGE, TELEMETRY and RELIABILITY report to SUPPORT.
Read [ENGINEERING_SUPPORT](docs/engineering/ENGINEERING_SUPPORT.md). Every feature/fix owner pairs
with this team on error signals, safe logs, reproduction and repair/regression evidence.
Run `pnpm detection:scan` for retained local gate + Next-test results; missing sensors and skipped
checks remain explicit. Register new sensors or gaps in `docs/engineering/detection-sensors.json`;
SUPPORT reviews detection/repair coverage within report/disable contracts before admin-ready.
The team assists domain developers; independent QA and finance/security/data authority remain.
Definitions do not start background agents or hosted monitors.

### Specialist dispatch and ownership

Use [docs/agents/TEAM_HIERARCHY.md](docs/agents/TEAM_HIERARCHY.md) to find a specialist and
[docs/agents/WORK_QUEUE.md](docs/agents/WORK_QUEUE.md) for ordered tasks and acceptance criteria.
`.claude/agents/registry.json` maps callable roles to definitions, reporting leads, paths and
functional responsibilities; `pnpm agents:check` validates it against the files and team docs.
Read the specialist operating contract in `docs/agents/TEAMS.md` before dispatching. Assign one primary
owner and the required reviewers, agree shared-file ownership, and integrate status updates.
Specialists are instruction files, not evidence that a feature exists or a release is approved.
Keep registry, definitions, TEAMS and hierarchy synchronized in the same turn as ownership changes.

Upload composition stays under `components/Reels/`: `UploadVideoModal.tsx` owns draft/picker/upload;
`UploadVideoComposer.tsx` owns short steps and fixed navigation. Preserve required athlete/caption/rights
checks and never lose draft state on Back.

`DOCUMENTATION` reports to `ENGINEERING` and synchronizes same-turn docs across all departments.
App fixes are assigned by `CTO` (`.claude/agents/cto.md`). The CTO gives the fix to one lead. The lead assigns a specialist. Specialists report to their lead, and leads report the fix to the CTO. `VP_OPERATIONS` reports to the CTO and updates roles, protocols, and priorities in the same turn they change. Each agent reads `docs/agents/EXPERT_STANDARDS.md` and runs on the model pinned in its file. The owner (`FACILITATOR`) still decides prices, counsel, applying SQL, merging, and live money.
Every specialist supplies behavior/API changes and actual verification evidence. Shared menu/page
coverage and exceptions are tracked in `docs/engineering/MENU_STYLE_MAP.md`; preserve approved legal and generated facts.

Donate composition stays in `TipSheetModal` / `TipCheckout`: Amount → Options → Review inside
one popup, fixed navigation, final reviewed action only starts payment. Preserve quote/recipient,
No tip defaults, rights/held notices and checkout locks. Generic menu chrome stays in `UI/MenuChrome.tsx`.

### Main-admin support, security and recovery contract

`/admin/support` joins Engineering Support and cybersecurity with the feature developer.
Use fixed-code observations, preserve client/trusted source separation and original occurrences,
retain independent protected review and server actor/time. Register owned data/roles so the
Team flow diagram regenerates from the master map. Add bounded detection and repair evidence
to every future feature's admin-first contract; a missing sensor is explicit, never healthy.
`pnpm recovery:package --verify-code` creates a private source package and manifest;
`pnpm recovery:verify PACKAGE` verifies integrity; `pnpm recovery:restore PACKAGE` creates
a separate preview. Packages exclude recognized credentials/runtime paths and accept only
reviewed source formats; ambiguous data formats fail closed. Locked dependencies and
schema/migration hashes travel with source. QA/Recovery must check deployed compatibility
and rehearse an approved database backup before release; restoring source does not restore data.

### Innovation and outside handoff

**Continuing IP preparation (IP-01):** Read [IP_PROTECTION_PLAN](docs/legal/IP_PROTECTION_PLAN.md).
DOCUMENTATION → ENGINEERING maintains factual candidates/rights gaps in `docs/legal/ip-register.json`
on source/dependency/asset/contributor/disclosure changes; run `pnpm ip:sync` / `pnpm ip:check`
in the same turn. Local full checks/Claude Stop refresh facts; CI checks committed currency.
Source owners review technical/human-AI evidence; LEGAL coordinates supplied counsel decisions.
Preserve reviews/decisions/receipts and revalidate stale evidence. No inferred novelty/ownership/
legal status, idle paid worker, filing or external delivery. Owner/counsel retain sharing/spend/
filing authority; actual receipts: [IP-01](docs/agents/IP-01.md).

Follow [INNOVATION_AND_HANDOFF](docs/engineering/INNOVATION_AND_HANDOFF.md) for new work.
Record observed struggles or explicit potential failures, a baseline, alternatives, a bounded
experiment, success/stop criteria and actual results in the existing task/design/incident record.
The lead records adopt/revise/stop decisions and the domain reviews. Successful approaches use
the shared naming/interface/documentation standards and the existing admin-first workflow.
Handoffs provide versioned source/data-flow/ownership evidence and clear reading paths for
engineers, legal reviewers and investors, scoped to their authorized access. Label proposals,
local implementation, hosted/device verification and gaps. Lead review checks meaning; these
documentation requirements are not automatically enforced by the feature metadata validator.

### Growth, capacity and service recommendations

`GROWTH_ANALYTICS` is the accountable agent for the Growth and Capacity Review working group.
Read [GROWTH_CAPACITY_REVIEW](docs/engineering/GROWTH_CAPACITY_REVIEW.md). One packet joins
existing Analytics/Audience measurements, Health/Support evidence and Books/provider costs,
with ANALYST, COST_OPERATIONS, RELIABILITY, Data and Finance review. The routing stays
GROWTH_ANALYTICS → MARKETING → CTO → owner. `INFRASTRUCTURE` is the standing dev member, always aware of hosting, services and how deeply the app is integrated (`docs/engineering/INFRASTRUCTURE_REGISTER.md`, generated and checked by `pnpm infra:register:check`; `PORTABILITY.md`); any infrastructure change updates `docs/engineering/infrastructure.json` and the register in the same change. Weekly/monthly and confirmed-threshold reviews
are standing assignments; record actual execution and missing/stale evidence. Each packet
compares observations, accepted targets, verified service quotas and loaded options per service.
Account counts/tab events are not MAU; unknown capacity/cost never means healthy or cheap.
A threshold triggers diagnosis/recommendation, not an automatic purchase, plan/host change,
data migration, financial action or release. CTO recommends; owner decides; domain/QA gates
and the admin-first workflow apply to any resulting implementation. No background collector
or unattended agent is established by a role definition. Actual setup: [GROWTH-01](docs/agents/GROWTH-01.md).

The Growth packet includes the standing Legal/Growth/Engineering verification, consent and
safe-engagement checkpoint in charter §9. Classify mandatory rules and company choices,
exchange findings, compare lawful alternatives with growth/support costs, and record domain
reviews, CTO recommendation and owner decisions before implementation. The initial source
review is [VERIFICATION_AND_SAFE_GROWTH_REVIEW](docs/legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md).

Growth charter §10 and [USER_GROWTH_PLANS](docs/product/USER_GROWTH_PLANS.md) require a plan
for each user segment, including non-donating fans and casual uploaders/filmers. Record useful
first actions, repeat loops, capability/source gaps, action-based safeguards, accepted metrics,
support/service costs and next decisions in the one Growth packet. Segments overlap; do not
sum them into unique users or force athlete/payee setup on unrelated permitted fan actions.

Charter §11 and [FAMILY_FUN_PLAYBOOK](docs/product/FAMILY_FUN_PLAYBOOK.md) cover the owner's
fan-video recognition, family activities, optional service and separate badge/Aura/money
paths. Bring fun/return ideas, fair newcomer inclusion, actual content/control gaps, review
capacity and permissions to the same joint packet. These remain brainstorming proposals;
new fan awards, badges, school scoring and paid creator work require their focused design,
admin-first and domain decisions before implementation or launch.
Latest owner choice: fans' valid free ballots select the fan award winner; staff review
eligibility/rights/safety and enforce published correction rules. Playbook §12 refines the
weekly entry/review/vote/recap journey. Keep private acknowledgment distinct from consented
public candidates; current poll counters do not implement this voting capability.

### Redundancy & Exit: keep the move-off-Supabase plan current (REDUNDANCY-02)

`REDUNDANCY_LEAD` (Engineering → `ENGINEERING`) leads `EXIT_SYNC`, `EXIT_DATABASE`, `EXIT_SERVICES` and `EXIT_CLOUD`. Read
[REDUNDANCY_TEAM](docs/engineering/REDUNDANCY_TEAM.md). Every app change updates the exit plan automatically:
`scripts/exit-map.mjs` regenerates `docs/engineering/EXIT_INFRASTRUCTURE_MAP.md` (Stop hook in Claude sessions; `pnpm exit:map:check`
in `pnpm check` and CI). When the plan changed, announce it in the same change with `pnpm exit:map --acknowledge --by "<session>"`;
the routed notice in `docs/agents/EXIT_CHANGE_LOG.md` tells the team who must review. A new Edge Function needs the self-host
allowlist (`infrastructure/supabase/configure.py`) or an excluded reason in `docs/engineering/exit-map.json`; a new Auth method needs
an `authCapabilities` entry. Restores onto a Supabase stack need `parity.py grant-sync` and a parity PASS (runbook §6).

Current source maintenance (REDUNDANCY-04): `pnpm exit:sync start` runs the scoped local
content watcher (initial scan +30s sweeps); `stop` verifies the owned process and preserves copies.
`pnpm check` ends with `exit:sync ensure`; the Claude Stop guard also refreshes the exact private
source copy. A concurrent capture can defer ensure with unknown freshness; other failures are
explicit. Raw source copies never grant code/data/service readiness or acknowledge author notices.
The macOS `install` command prepares user login startup, but actual activation and OS permission
limits belong in [REDUNDANCY-04](docs/agents/REDUNDANCY-04.md). CI snapshots all branches/PRs and
the default branch daily, with finite30day source retention. Live Supabase/database/Storage/provider
changes and secrets still need their separate governed captures. Keep this source automation and
its source/privacy/ownership tests aligned when the app or exit tooling changes.

### Infrastructure Security partners (REDUNDANCY-07)

`INFRA_SECURITY`, `SUPPLY_CHAIN_SECURITY` and `RECOVERY_SECURITY` join the existing
`RLS_SECURITY`, `SESSION_SECURITY` and `THREAT_DETECTION` team under `SECURITY` -> `CTO`.
Engineering implementation/reporting stays with `REDUNDANCY_LEAD` / `INFRASTRUCTURE` and the
existing component owner. Read [INFRASTRUCTURE_SECURITY](docs/engineering/INFRASTRUCTURE_SECURITY.md)
and the generated [source report](docs/engineering/INFRASTRUCTURE_SECURITY_REPORT.md).
`infrastructure/security/` owns reviewed coverage, local report/routing and adversarial tests.

`pnpm security:infra` regenerates awareness; `security:infra:report` prints read-only JSON;
`security:infra:check` checks current coverage/Markdown; `security:infra:test` runs local regressions.
Tests/check run in full check and CI; source sweeps refresh the report after the exit map.
Every routed source notice includes Security partners. The report links guards without executing
or accepting them; operational requirements stay unverified and never grant readiness.
Record actual Security/domain review, environment, source binding, dated findings/revalidation
and next owner. Role definitions/report refresh do not start unattended agents or deliver alerts.

### Documentation and team coordination must execute

For each feature/fix handoff, the lead assigns DOCUMENTATION the affected documentation and
actual owner evidence. For role, protocol or priority changes, assign VP_OPERATIONS the roster,
reporting and plan reconciliation in the same turn. Record actual executor/session, changed or
checked files, check date/result, unresolved gaps and next owner in the existing task tracker.
Root integrates shared STATE/CHANGELOG/queue updates and releases claims after verification.
Do not close a handoff while its required documentation or coordination correction is open.
An authorized outside session can perform the function and must name its actual runtime;
repository model pins remain governed by their role files. CI checks structure and drift; a
role definition, dispatch or passing CI does not prove semantic review or continuous activity.
See [COORD-01](docs/agents/COORD-01.md) for actual assignments and the current checkpoint.

### Beyond the Game implementation boundary

`components/BeyondGame/` owns discovery/composer/explicit media and legacy profile-link cards. `components/Challenges/` owns self-report workout controls/inbox/settings. `hooks/useBeyondLegacyClips.ts` and `hooks/useChallenges.ts` bind current resources/lifetimes; `lib/beyondLegacy.ts`, `lib/beyondGame.ts` and `lib/challenges.ts` own Supabase calls. Root route/navigation and generated metadata remain coordinated. Discovery (`tabs.beyond`: Home-bar Beyond switch and page) defaults on; server contribution/challenge switches default off until hosted/source/release gates. Legacy ReelCard/reels remain PLAY-01 owned.

## Family activities source map — FUN-01 / QUIZ-01 / QUIZ-02 (2026-10-14)

| Responsibility | Source / owner boundary |
| --- | --- |
| Private fan campaign, entry scope, free ballot, concern/removal state | `supabase/migrations/20261014130000_fan_zone.sql`, canonical backend schema, shared `fanZone.ts`; POLLS/UPLOAD/MINOR_SAFETY with BACKEND/RLS_SECURITY. |
| Private MP4 validation and revocable media | backend `services/fanZoneMedia.ts`, `fanZoneMp4.ts`, API `fanZoneMedia.ts`, thin `app/api/fan-zone-*+api.ts`; server-only service key, no public/signed fallback. |
| Fan client and correction desk | frontend `lib/fanZone.ts`, `components/Admin/FanZone/`, `/admin/fan-zone`; ADMIN mounts behind AdminShell, SDK excludes service-only commits. |
| Synthetic timed trivia test inputs | frontend `lib/__fixtures__/timedSportQuizFixtures.ts`; shared synthetic wire fixtures only, excluded from runtime/export graph. |
| Synthetic Fan SDK test inputs | frontend `lib/__fixtures__/fanZoneFixtures.ts`; shared DTO fixtures used by tests, excluded from Jest suite discovery and the product export graph; no runtime account data. |
| Account fan journey | root `/fan-zone`, frontend `components/FanZone/` and `hooks/useFanZone.ts`; participant source follows its actual admin-ready gate. |
| Weekly private trivia authority | new QUIZ-02 timed migration, shared `timedSportQuiz.ts` with reusable earlier `sportQuiz.ts`, frontend `lib/sportQuiz.ts`, Admin/SportQuiz tool and paged `SportQuizBank.tsx`; POLLS with Content/VOICE fact review, AURA owns noncash private badges. Prior QUIZ-01 source/checkpoint is historical. |
| Quiz account journey | root `/sport-quiz`, frontend `components/SportQuiz/` and `hooks/useSportQuiz.ts`; QUIZ-02 participant replacement released after actual selected admin-ready16:53:17Z/exit0. New `useTimedSportQuizRound.ts` owns ephemeral prompt/capability; account hook owns sanitized status/preferences/history only. |
| Trivia, play together (QUIZ-03) | migrations `20261014160000_trivia_play_together.sql` (rounds of five, question types, challenge groups, badges, recap) and `20261014170000_trivia_starter_bank.sql` (60 drafts from `supabase/content/trivia_starter_bank.json` via `scripts/trivia-bank-sql.mjs`); shared `triviaPlayTogether.ts`; frontend `components/SportQuiz/` (`SportQuizRound`, `SportQuizGroups`, `SportQuizGroupPage`, `SportQuizBadgeShelf`, `LearnSportCard`) and hooks `useTriviaGroups.ts`, `useTriviaBadges.ts`, `useTriviaAvailability.ts`; admin `SportQuizPlay` / `SportQuizGroups`; POLLS with AURA, Content, MINOR_SAFETY. Design: `docs/engineering/design/TRIVIA_PLAY_TOGETHER_DESIGN.md`. |
| Life Playbook and personal progress (QUIZ-04) | migrations `20261014180000_life_playbook.sql` and `20261014190000_life_playbook_bank.sql` (written, not applied); shared `lifePlaybook.ts`; frontend `lib/lifePlaybook.ts`; participant `components/SportQuiz/` (`SportQuizAllowances` "This week" strip, `SportQuizLevel`, `LifePlaybookCard` opt-in, `LifePlaybookHome`; fun presentation 2026-10-15: `QuizFx` effects kit, `QuizProgress` dots / shot clock / count-up, `quizCheers` the one cheer list for VOICE) and hooks `useLifePlaybook.ts`, `useTriviaLevel.ts`; `useTimedSportQuizRound.ts` owns round kinds (`startLife`, `dismiss`); admin `SportQuizLife` / `SportQuizLifeQuestion`; POLLS with AURA, Content, MINOR_SAFETY, VOICE. Four 13+ chapters, simple facts, one-admin approval (owner simplification 2026-10-15). Design: `docs/engineering/design/LIFE_PLAYBOOK_DESIGN.md` (§8 overrides §2–§7). |
| Fresh questions (QUIZ-05) | migration `20261015210000_trivia_fresh_questions.sql` (written, not applied); shared `freshQuestions.ts`; frontend `lib/freshQuestions.ts` (participant, guardian and admin wrappers, paste parser) and the shown-position mapping in `lib/sportQuiz.ts`; admin `SportQuizNeedsLook`, `SportQuizFacts`, `SportQuizFreshSettings`, `SportQuizImport`; participant `components/SportQuiz/` `QuestionReport` (Report a problem sheet, `useQuestionReports`) and `FunFactMoment` ("Fun fact: {first name}", athlete card, unavailable / removed lines), athlete `components/Profile/FunFactShare` (Edit profile and the optional sign-up step), the Privacy fun facts audience and the guardian fun-fact Approve / Decline in `Custodial/GuardianSupervisionPanel`; replay `scripts/replay/fresh-questions-replay.mjs`; POLLS with ADMIN, PROFILE, CUSTODIAL, MINOR_SAFETY, VOICE. Fun facts are off (`trivia.athlete_questions`, share 0). Design: `docs/engineering/design/TRIVIA_FRESH_QUESTIONS_DESIGN.md` (§6 overrides §1–§5). |
| Shared activity discovery | frontend `components/FamilyFun/FamilyFunDiscovery.tsx`, Home measured chrome, four role HQs and profile activity links; per-source errors remain independent, private guardian discovery is distinct from participation. |

Root account routes stay outside the fan-only `(tabs)` role gate so eligible enrolled parent,
operator, booster, sponsor and other account roles can participate. No new bottom tabs.
Default empty tester cohorts/testing-only source are authoritative; migrations are written,
not applied. `FUN-01.md`/`QUIZ-01.md`/`QUIZ-02.md` and feature-admin.json preserve actual local checkpoints.
Data/Safety/SUPPORT reviews operational privacy, corrections/stop and source maps;
DOCUMENTATION/VP_OPERATIONS records actual execution and per-user Growth handoff.
Private historical Sport Learner and new Trivia Explorer acknowledgments do not credit Aura, cash, ballots or school rankings.

QUIZ-02's approved design/plan lives in `docs/engineering/design/TIMED_TRIVIA_*`; source and
actual checkpoints live in `docs/agents/QUIZ-02.md`. The admin desk owns complete50-row question
and independent50-row audit paging, fact/family/source review, effective expiry, pause/correction
and35-day quota/receipt retention. Expected canonical participant/admin actor prevents delayed
cross-account writes. Ordinary reads are active-prompt-free; original Start alone has the live
question,30/90deadline and memory-only256-bit capability. Clear history retains disclosed
preferences/notice/revision and minimal35-day quota, removes learning/participant audit links,
and requires Refresh/reconfirm after unknown CAS outcome. No hosted enablement follows local tests.
