<!-- 2026-11-08 UI density pass — measure → tighten Lovable Nov 5, do not restyle. -->
# UI density audit — Tapua'i mobile

**Branch tip snapshot:** `6f82649` (before this pass).  
**Goal:** ~10–15% denser type/padding; same jade brand, same layout, same 44pt touch targets; body ≥13pt.

## 1. Reference comparison (honesty note)

This cloud agent cannot open Instagram or another social app on a physical phone to measure pixels side by side. Numbers below are **from Tapua'i source styles** (Phase 1). The owner’s ~10–15% oversize estimate is treated as the target reduction and matches common Instagram ranges (feed body ~13–14pt, compact dock ~49pt). Do **not** treat the “reference” column as measured Instagram pixels.

| Element | Tapua'i before | Target after (~12%) | Notes |
| --- | --- | --- | --- |
| Fan title | 30 / 34 | 26 / 30 | `TYPE.display` |
| Sheet title | 24 | 20 | `TYPE.title` |
| Body | 14 / 20 | 13 / 18 | floor |
| Button label | 15–16 | 14 | `TYPE.button` |
| Card padding | 16 | 12–14 | `space.md` |
| Sheet radius | 24 | 20 | `MENU_METRICS` |
| Fan dock min height | 56 | 50 | hit area still ≥44 |
| Upload chooser maxHeight | 90% | 72% (hugs content) | |
| Upload option row | minH 76 | ~64 | still >44 |

## 2. Token before → after

| Token | Before | After |
| --- | --- | --- |
| `space` | 8 / 12 / 16 / 20 / 24 | 6 / 10 / 14 / 16 / 20 |
| `radii` sm–xl | 10 / 12 / 16 / 20 | 8 / 10 / 14 / 16 |
| `MENU_METRICS` sheet/card/control | 24 / 16 / 14 | 20 / 14 / 12 |
| `touchTarget` | 44 | **44 (unchanged)** |
| `SCREEN_BOTTOM_GAP` | 52 | 48 |
| `KIT` radii | 14 / 16 / 24 / 24 | 12 / 14 / 20 / 20 |
| `TYPE` | (none — hardcoded) | display/title/section/body/caption/button |

## 3. Local tab + upload (Phase 2 report)

### Local (`app/(tabs)/local/index.tsx` + `GameCard`)

| Surface | Before | After |
| --- | --- | --- |
| Content pad / gap | 12 / 8 | 10 / 6 |
| Section title | 16/22 | 15/20 |
| Game card pad / gap | 16 / 10 | 12 / 8 |
| Score digits | 34 | 28 |
| Team name | 14 | 13 |
| Sponsor CTA card | 144×124, pad 12 | 132×108, pad 10 |
| Cards above fold (390×844 est.) | ~2.2 live cards | ~2.6–2.8 |

### Upload chooser (`UploadChoiceSheet`)

| Surface | Before | After |
| --- | --- | --- |
| maxHeight | 90% | 72% |
| Title | 24/800 | 20 (`TYPE.title`) |
| Intro | 14/20 | 13/18 |
| Option minHeight | 76 | 64 |
| Option title / body | 16 / 13 | 15 / 13 |
| Icon tile | 44 | 40 (row still ≥44) |
| Cancel | 44 / 15 | 44 / 14 |

### Upload flow (`UploadVideoComposer`)

| Surface | Before | After |
| --- | --- | --- |
| Sheet side pad | 20 | 14 |
| Hero title / badge | 24 / 64 | 20 / 52 |
| Source tiles minH | 112 | 88 |
| Body gap | 14 | 10 |
| Submit minH / label | 52 / 16 | 48 / 15 |
| Details step | caption + athlete + sport + category | caption + athlete + category; **sport moved to More options** |
| Review summary | 4 meta lines | 2 compact meta lines |
| Athlete tag | still mandatory path on details / select | **unchanged rule** |

Progressive disclosure: sport + game + mentions + Exclusive stay one tap away under **More options** (details + review). Compliance / rights checkbox stays on review.

## 4. Surfaces covered by shared tokens (Phase 3)

| Surface | Change |
| --- | --- |
| Activity / NotificationInbox | denser row pad, `TYPE.section` / body |
| Beyond (`BeyondGameStyles`) | `TYPE.display` title, denser cards/inputs |
| Drip / GearCard / ProductSheet | tighter catalog pad; product title 22→18 (no checkout math) |
| Spotlight tab + SpotlightModal | section/body tokens; modal name 28→24, CTAs 48 |
| Profile / receipts / user | content pad 16→14 |
| SoftWall / AgeConfirm | `TYPE.display`; CTA minH 48 |
| MySportsModal / LegalModal | maxHeight 78% / 82% (was 90%) |
| ScreenHeading / Kit / FanTabBar / DashboardPanel | shared cascade |

Gift/checkout sheets intentionally left out of content triage (hard stop).

## 5. Hard stops respected

- Brand faces and jade palette unchanged.
- No gift amounts, tip math, Aura, RLS, Stripe, or athlete-tag rule changes.
- Touch targets remain ≥44 where they were required.
- Body copy ≥13pt.

## 6. Verify

Record `pnpm check` result on the density branch in `docs/STATE.md` §4 when green. Screenshot evidence for Local + upload steps belongs on a device/simulator with the same content; this agent environment cannot drive a tappable iOS Simulator (STATE §3).
