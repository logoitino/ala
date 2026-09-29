# Conventions — folders, file names, and where code goes

Companion to [AGENTS.md](../AGENTS.md) (which owns the directory *law*) and
[docs/STATE.md](STATE.md) (current state). This file writes down the naming and placement rules
the codebase already follows, so they stop being tribal knowledge.

**These are descriptive, not aspirational.** Every rule below was verified against the tree on
2026-09-28. Where a rule has exceptions, the exceptions are listed — do not silently add more.

---

## 1. Naming by directory

| Location | Case | Example | Notes |
| --- | --- | --- | --- |
| `src/frontend/components/**` | **PascalCase** | `ReelCard.tsx`, `Profile/AuraTradingCard.tsx` | One component per file, filename === exported component |
| …co-located token/helper modules | camelCase | `Effects/glowTokens.ts`, `Profile/glowingCardChrome.ts` | Not components, so not PascalCase |
| `src/frontend/hooks/` | camelCase, `use` prefix | `useReels.ts`, `useActivityFeed.ts` | No exceptions |
| `src/frontend/lib/` | camelCase | `aura.ts`, `reelVotes.ts` | Client SDKs and pure helpers |
| `src/frontend/context/` | PascalCase, `…Context` suffix | `AuthContext.tsx` | One exception: `RoleGate.tsx` — a gate, not a provider |
| `src/frontend/services/` | **PascalCase** | `TelemetryManager.ts`, `OfflineQueue.ts` | Deliberately unlike `lib/`: these are process-wide singletons |
| `src/frontend/data/`, `theme/`, `constants/`, `types/` | camelCase | `highlights.ts`, `motion.ts` | |
| `app/**` | Expo Router convention | `_layout.tsx`, `[id].tsx`, `(tabs)/`, `create-payment-intent+api.ts` | lowercase segments, `[dynamic]`, `(group)`, `+api.ts` |
| `supabase/*.sql` | snake_case | `clear_reel_hype.sql` | ~50 files, zero exceptions |
| `scripts/` | kebab-case | `sync-front-docs.mjs` | |
| Tests | mirror the module under test | `SoftWallModal.test.tsx`, `aura.test.ts` | Scenario tests may be kebab-case: `highlights-jump.test.tsx` |

**Directories:** `src/frontend/` top-level folders are lowercase single words
(`components`, `hooks`, `lib`, …). `components/` subfolders are **PascalCase**
(`Profile`, `Reels`, `Local`, `Admin`, `UI`, …). No exceptions in either.

**Platform splits** (`stripe.native.ts` / `stripe.web.ts` / `ShareQrModal.web.tsx`) are Metro
resolution, not naming drift. Leave them.

---

## 2. Where a component goes

`components/` subfolders are grouped **by the feature that consumes them**, not by widget type.

- **One consumer, or one feature area** → that feature's subfolder
  (`Profile/`, `Reels/`, `Local/`, `Operator/`, `Drip/`, `Spotlight/`, `Admin/`, `Auth/`, `Legal/`, `Feedback/`, `Onboarding/`, `Custodial/` — the athlete and guardian money cards, shared by Activity and Parent HQ; `Verification/` — the athlete verification card on Activity and the school confirmation form rows).
- **Generic, reusable primitive** → `UI/` (`AnimatedButton`, `EmptyState`, `HapticPressable`, `SheetHandle`, `FanTabBar`).
- **Genuinely cross-cutting, used by many unrelated routes** → flat at the top of `components/`.

Flat is the exception and must be earned. As of 2026-09-28 the legitimate flat set is:
`ScreenShell`, `ScreenHeading`, `TabScreen`, `RuntimePaused`, `TipSheetModal`, `AuraToast`,
`BackedCelebration`, `DashboardPanel`, `TipCheckout`, `PlayCard`, `TipButton`, `FeeCheckbox`,
`Common/SwipeableBannerWrapper`.

> If you add a component with a single consumer, put it in that consumer's subfolder. Thirteen
> components were moved out of flat on 2026-09-28 for exactly this reason.

---

## 3. Layering — what may import what

```
app/            Expo Router only: routes, layouts, +api handlers.
  ↓ imports
src/frontend/   components · hooks · context · lib · services · data · theme · types
  ↓ imports
packages/shared-types
```

- `app/` should hold **routing and composition**, not data access. Prefer a hook in
  `src/frontend/hooks/` or a helper in `src/frontend/lib/` over calling `supabase` from a route.
  *Known debt:* several route files still query Supabase directly — see STATE.md.
- `src/frontend/**` must **never** import `@backend/*`. Only `app/api/*+api.ts` may.
- Server-only secrets (`sk_`, `service_role`) never appear under `src/frontend/`. CI greps for this.

**Path aliases:** `@/*` → `apps/mobile/src/frontend/*`, `@backend/*` → `apps/mobile/src/backend/*`,
`@shared/*` → `packages/shared-types/*`. Use `@tapuai/shared-types` for the package import.

---

## 4. Barrel files

**Not used.** `index.ts` appears only where Expo Router requires an `index.tsx` for a route
segment, plus the one package entry point (`packages/shared-types/index.ts`). Import the specific
file directly. Do not add barrels to `components/`, `hooks/`, or `lib/` — and do not add
re-export shims: three dead ones were deleted on 2026-09-28.

---

## 5. Every module carries a doc header

Required on hooks, network/RPC helpers, and complex components — enforced by
`.cursor/rules/documentation.mdc`:

```ts
/**
 * @purpose What this does in product language (Mālo, Seki, Aura, operator clock).
 * @param name What each input is for.
 * @returns What comes back, or what renders.
 * @sideEffects Supabase, Realtime, Stripe, Storage, AsyncStorage, haptics. Omit if none.
 */
```

Product copy is **Mālo** / **Seki** / **Highlights ⚡**. Persistence keeps the old names
(`tips`, `reels`, `useTipCheckout`) — do not rename them to match the UI.

---

## 6. Before you finish

Update [docs/STATE.md](STATE.md) §4 and its `Last updated` header. CI fails a pull request that
changes `apps/`, `packages/` or `supabase/` without it.
