# WEB-DESKTOP — Phase 0 audit

**Date:** 2026-11-15 (America/Denver)  
**Checkout:** `cursor/web-desktop-layout-9a86` at `origin/main` (`0e510fa`)  
**Environment:** Cursor cloud agent (Linux). Mac copy at `~/Desktop/Tap/ala-sports` was **not** re-read in this session — file evidence below is from this checkout / `origin/main`.  
**Spend:** Audit only — **$0**. Wave 0 budget unchanged (Apple Developer $99/yr enrolled; Expo/Supabase/Stripe test free).

Owner prompt asked for measure-first evidence before any Facebook-style three-panel design or Lovable prototype. This file is that evidence. Opinions are limited to one gap sentence at the end.

---

## 0. §0 prompt vs live files

| Prompt claim | Live finding | Action |
| --- | --- | --- |
| No separate fan web app; Expo mobile also runs on web | Confirmed. `apps/` has `mobile` + `admin-portal` only. | Keep |
| Root `_layout.tsx` has no `Platform.OS === 'web'` branch | True of the root file itself; it always mounts the same Stack. Web layout is inside `WebAppShell` (`Platform.OS !== 'web'` early return). | Keep; nuance recorded |
| Screens use phone SafeArea shell | Confirmed: `ScreenShell.tsx` SafeArea + `SCREEN_BOTTOM_GAP` | Keep |
| “Desktop shell” from Nov 14 may be missing on Mac | **Present on `origin/main`:** `apps/mobile/src/frontend/components/Common/WebAppShell.tsx`. Landed in `6130775` (“Ship Expo web Phase 1: Stripe.js checkout and desktop shell”); hydration fix PR #50 / `7fdddda`. | Extend this shell — do not invent a second one |
| What “desktop shell” means today | **Phone column**, not a multi-panel desktop. `WEB_PHONE_WIDTH = 430`, breakpoint `900`. Admin coverage label: “Web phone column”. Design note: [WEB_APP_PARITY.md](../engineering/design/WEB_APP_PARITY.md). | Correct §0 language: shell exists; it wastes wide viewports on purpose |
| Lovable zip `lovable/99b55089-….zip` | **Not in this git tree** (`origin/main` has no `lovable/` path; only `docs/engineering/design/LOVABLE_UI_UX_PLAN.md`). Guardrails path `~/workspace/your_files/ala-lovable-guardrails.md` also absent here. | Owner: place zip or point to Mac-only path before Phase 2 claims “opened the zip” |
| FEED-01 Phase 1 on main; Phase 2 flag OFF | Matches STATE / WORK_QUEUE | Keep |
| Brand + density settled | Matches Lovable plan + PR #34 density | Keep |

If the Mac copy still lacks `WebAppShell.tsx`, it is behind `origin/main` — pull/merge before designing a parallel shell.

---

## 1. Existing desktop shell + Stripe.js checkout

### Shell

| Item | Value |
| --- | --- |
| File | `apps/mobile/src/frontend/components/Common/WebAppShell.tsx` |
| Mount | `apps/mobile/app/_layout.tsx` wraps `RuntimeApp` Stack |
| Clamp helper | `apps/mobile/src/frontend/hooks/useAppViewport.ts` (`WEB_PHONE_BREAKPOINT=900`, `WEB_PHONE_WIDTH=430`) |
| Second clamp | `apps/mobile/app/(tabs)/_layout.tsx` — `Platform.select({ web: { maxWidth: 430, alignSelf: 'center' } })` even when shell is off |
| Tests | `WebAppShell.test.tsx`, `useAppViewport.test.ts` |
| First ship commit | `6130775` (2026-11-13 era Phase 1) |
| Hydration fix | PR #50 / `7fdddda` — desktop branch waits until after mount |

**Behavior today:** viewport ≥ 900 → centered 430px column + jade mist canvas. Viewport &lt; 900 → full-bleed wrapper, but fan tabs still max at 430 on web.

### Stripe.js web checkout

| Piece | Path | Role |
| --- | --- | --- |
| Web Stripe entry | `apps/mobile/src/frontend/lib/stripe.web.ts` | `loadStripe` + mounts host |
| Payment Element host | `apps/mobile/src/frontend/components/Checkout/WebPaymentSheetHost.tsx` | Modal Payment Element; dismiss locked while confirm runs |
| Bridge | `apps/mobile/src/frontend/lib/webPaymentSheetBridge.ts` | Imperative PaymentSheet-shaped API for web |
| Gift path | `hooks/useTipCheckout.ts` → web Stripe | Athlete gifts (0% platform cut in tip model) |
| Exclusive | `data/storeCommerce.ts`, `lib/exclusiveCheckout.ts` | Web Stripe Exclusive; books 20/80 |
| Coverage rows | `lib/adminCoverage.ts` `web.shell` / `web.gift_checkout` / `web.exclusive_checkout` | Product Control map |

Routes covered: same Expo screens as native — gift sheet / Exclusive / Drip / booster flows that call PaymentSheet helpers. No separate checkout URL. Admin portal is **not** this surface.

---

## 2. Width used vs wasted (measured)

Method: Expo web on `http://127.0.0.1:8081` (guest Highlights). Playwright viewport resize; measure `[aria-label="Tapua'i web app"]` when present, else tallest content column. Screenshots under `docs/agents/web-desktop-audit/`.

| Viewport width (px) | Interactive content width (px) | Wasted (viewport − content) | % wasted | Shell label present? | Screenshot |
| --- | --- | --- | --- | --- | --- |
| **1920** | **430** | **1490** | **77.6%** | yes (`left: 745`) | [before-1920.png](web-desktop-audit/before-1920.png) |
| **1440** | **430** | **1010** | **70.1%** | yes (`left: 505`) | [before-1440.png](web-desktop-audit/before-1440.png) |
| **1280** | **430** | **850** | **66.4%** | yes (`left: 425`) | [before-1280.png](web-desktop-audit/before-1280.png) |
| **820** | **430** | **390** | **47.6%** | no (breakpoint &lt; 900) — tabs `maxWidth: 430` still centers | [before-820.png](web-desktop-audit/before-820.png) |
| **390** | **390** | **0** | **0%** | n/a | [before-390.png](web-desktop-audit/before-390.png) |

Code constants match the desktop rows (`WEB_PHONE_WIDTH = 430`). Tablet (820) waste is from the **tabs** clamp, not `WebAppShell`.

**Phase 3 acceptance:** any approved three-panel layout must beat the desktop rows above (higher used px / lower % wasted) without shrinking type or touch targets below current density rules.

---

## 3. Panel inventory (surfaces that could fill a desktop)

| Surface | Primary path(s) | Renders on Expo web today? | Width behavior today |
| --- | --- | --- | --- |
| Highlights feed + picks | `app/(tabs)/index.tsx` (~34 KB) | Yes (guest browse observed) | Phone column / 430 clamp |
| Local (live, polls, boosters) | `app/(tabs)/local/**`, Local components | Yes (routable; off bottom bar) | Phone column |
| Activity | `app/(tabs)/activity.tsx` | Yes | Phone column |
| Spotlight | `app/(tabs)/spotlight.tsx` | Yes | Phone column |
| Drip | `app/(tabs)/drip.tsx` (shop stub `shop.tsx` 195 B redirect) | Yes when flag on | Phone column + ProductSheet web root |
| Profile | `app/(tabs)/profile.tsx` | Yes | Phone column |
| Athlete public sheet | `app/(tabs)/user/[id]`, `athlete/` | Yes | Phone column |
| Receipts | `app/(tabs)/receipts.tsx` | Yes | Phone column |
| Beyond | `app/(tabs)/beyond.tsx` | Yes (discovery) | Phone column |
| Vault Exclusive | Profile / user + `ExclusivePaywall`, `storeCommerce` | Yes on web Stripe rail | Overlays inside phone column |
| Crew | Profile / crew hooks + lib | Yes (in-app) | Phone column |
| Gift / Share link | `app/gift/[handle].tsx` + TipSheet | Yes (Stripe.js) | Phone column / modal |
| Soft-Wall / Welcome | Auth components in root | Yes | Overlay |
| Athlete HQ | `app/(athlete)/athlete/index.tsx` | Yes (role gate) | `ScreenShell` phone |
| Parent HQ | `app/(parent)/parent/index.tsx` | Yes | `ScreenShell` phone |
| Booster HQ | `app/(booster)/booster/index.tsx` | Yes | `ScreenShell` phone |
| Sponsor | `app/(sponsor)/**` | Yes | `ScreenShell` phone |
| Operator console | `app/operator/**` | Yes | Phone / console chrome |
| Expo `/admin` desks | `app/(admin)/admin/**` | Yes | Admin report pages already widen some metrics on web — **not** the fan desktop target |
| Next admin-portal | `apps/admin-portal/**` | Separate product | Read-only oversight — **do not** rebuild as fan web |

Bottom bar today: `FanTabBar` — Home / Activity / Upload / Spotlight / Profile (Local & Beyond from Home pills). Phone pattern.

---

## 4. Lovable zip

**Result:** cannot open — file not present in this repository checkout or on `origin/main`.

- Expected: `lovable/99b55089-c2b2-4609-a647-bd877e62ffa4.zip` (owner prompt, ~1.3 MB, 2026-11-05)
- Searched: workspace tree, `git ls-tree origin/main`, filesystem name match — none
- Related in-repo: [LOVABLE_UI_UX_PLAN.md](../engineering/design/LOVABLE_UI_UX_PLAN.md) (brand standard), community-preview desktop PNGs under `docs/engineering/design/community-preview/` (admin/community format previews — not the fan three-panel shell)

**Phase 2 blocker until owner supplies the zip or confirms Mac-only path.** Brand tokens for a new Lovable prototype can still follow the UI/UX plan without the old zip.

---

## 5. Single sharpest gap

**On every desktop width we measured, Tapua'i still renders the phone app in a 430px column and leaves most of the browser empty — there is no left nav or right “live & close” rail, so the wide viewport cannot show more than one surface at a time.**

---

## 6. Hard stops confirmed by audit

- Mobile native layout is unchanged by this audit (docs + screenshots only).
- Money rails (Stripe.js host, gift / Exclusive / booster) must stay intact when the shell is extended.
- Next `admin-portal` is not the fan desktop.
- FEED-01 Phase 2 implicit signals stay OFF until counsel.

## 7. Next document

Design proposal (owner decisions W1–W4): [WEB-DESKTOP-01.md](WEB-DESKTOP-01.md). **No repo build until FACILITATOR records those decisions.**
