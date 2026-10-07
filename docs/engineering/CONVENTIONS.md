# Conventions — folders, file names, and where code goes

Companion to [AGENTS.md](../../AGENTS.md) (which owns the directory *law*) and
[docs/STATE.md](../STATE.md) (current state). This file writes down the naming and placement rules
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
- `pnpm app:data-boundaries` prevents new direct Supabase calls in Expo routes. Existing route debt
  is counted in `scripts/app-data-boundary-baseline.json`; moving a query into `lib/` or a hook must
  lower that baseline in the same change.

**Review size:** when a module grows beyond roughly 500 lines, split it by responsibility before
adding another substantial concern. Keep the public component/helper stable and prove a
behavior-preserving split with the existing tests. Known large-file work is tracked in
`docs/engineering/CODE_ORGANIZATION_PLAN.md` Step 3.

**Path aliases:** `@/*` → `apps/mobile/src/frontend/*`, `@backend/*` → `apps/mobile/src/backend/*`,
`@shared/*` → `packages/shared-types/*`. Use `@tapuai/shared-types` for the package import.

---

## 4. Barrel files

**Not used.** `index.ts` appears only where Expo Router requires an `index.tsx` for a route
segment, plus the one package entry point (`packages/shared-types/index.ts`). Import the specific
file directly. Do not add barrels to `components/`, `hooks/`, or `lib/` — and do not add
re-export shims: three dead ones were deleted on 2026-09-28.

---

## 5. Comments — every file explains itself

Goal: someone outside the team (a reviewer, a volunteer, a new engineer) can open any file and learn,
in under a minute, **what it is for, where it sits, and what it touches** — without running the app.
`pnpm comments:check` (CI) fails when a source file under `apps/mobile/app` or `apps/mobile/src` has no
comment at all.

**Three levels, from most to least required:**

1. **File header — every file.** First thing in the file, before the imports. Two to six lines of plain
   product language: what this file is, which screen / feature / table it belongs to, and the one rule a
   reader must not break. Name the neighbours when it matters ("the web twin of `share.ts`", "wrapper
   that keeps `ReelCardImpl` memoised"). Add `@sideEffects` when it reads or writes Supabase, Realtime,
   Stripe, Storage, AsyncStorage, or the device (haptics, camera).
2. **Doc block on each exported hook, network / RPC helper, and complex component.** The
   `@purpose` / `@param` / `@returns` / `@sideEffects` block below. Skip one-line formatters unless they
   encode a business rule (Aura maths, the 90 / 10 split, view thresholds).
3. **Inline comments — the *why*, never the *what*.** Explain a constraint, a bug the line prevents,
   an order that matters, or a decision the owner made (with the date). Do not narrate code that reads
   clearly. A good comment answers "why is it done this odd way?"; delete one that only restates the line.

```ts
/**
 * Highlights data layer: fetch the feed, hype votes, reports.   <- file header (level 1)
 * Screens call this, not Supabase.
 * @sideEffects `reels` and related RPCs; AsyncStorage for local hides.
 */

/**
 * @purpose What this does in product language (Donate, Seki, Aura, operator clock).
 * @param name What each input is for.
 * @returns What comes back, or what renders.
 * @sideEffects Supabase, Realtime, Stripe, Storage, AsyncStorage, haptics. Omit if none.
 */
```

**Also comment:**

- **SQL:** every file in `supabase/migrations/` starts with what it changes, why, what it depends on, and a
  `Rollback:` block (see `supabase/migrations/README.md`). Policies and RPCs get a one-line comment saying
  who may call them.
- **Folder README:** a folder with more than a handful of files gets a `README.md` saying what belongs
  there and what does not (see `components/`, `hooks/`, `lib/`, `supabase/`).
- **Tests:** the test file names the behaviour under test; a test for a bug says which bug.
- **Money, privacy, and safety code:** state the rule being enforced and where the owner or counsel decided
  it (`docs/STATE.md` §6, `docs/legal/LEGAL_BRIEFING.md` row). These are the places outside reviewers look first.

**When you change a file, keep its comments true.** A stale comment is worse than none. If a header still
describes the old behaviour after your edit, fix it in the same commit.

On-screen words follow `docs/product/VOICE.md`: money is **Donate / donation**; "Mālo!" is only a thank-you;
**Seki** / **Highlights ⚡** are the product names. Persistence keeps the old code names (`tips`, `reels`,
`useTipCheckout`, `malo*`) — do not rename them to match the UI; say "code name `tip` = donation" in a
comment where it would confuse a reader.

---

## 6. Before you finish

Update [docs/STATE.md](../STATE.md) §4 and its `Last updated` header. CI fails a pull request that
changes `apps/`, `packages/` or `supabase/` without it.


## 7. Compact menus and the Daylight visual system

Use the shared menu chrome in `components/UI/MenuChrome.tsx` and metrics from
`constants/theme.ts`; use `useSheetFrame` for safe-area sheet geometry. Shared page headings
and shells keep fan pages aligned with the same palette. See [MENU_STYLE_MAP.md](MENU_STYLE_MAP.md)
for coverage and deliberate exceptions; avoid copying a one-off palette into a feature.

For composition or payment, split lengthy forms into short steps within one popup and place
Back/Next/final action outside the scroll area. Preserve drafts on Back. Show rights or financial
review before the final action; lock dismissal/submission during upload or payment. Small screens,
large text and keyboard layouts can still need a short scroll. Check those on real devices.
Pair every owner with `DOCUMENTATION` for accurate team/docs and code-comment handoff.
