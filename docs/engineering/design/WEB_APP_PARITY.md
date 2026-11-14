# Expo web app parity — design note

**Status:** Phase 1 shipping (web Stripe checkout + desktop shell). Not a separate product fork.  
**Owner direction (2026-11-13):** Fans on website / Android / iOS should reach the same product; money rails follow store rules (see `storeCommerce.ts`).  
**Spend:** Wave 0 **$0** (Stripe test + Expo web). Hosting `tapuai.app` later is owner/ops.

## Product shape

| Surface | What it is |
| --- | --- |
| **Web app** | The same Expo Router fan app (`apps/mobile`) via `pnpm mobile` → web / `expo start --web` |
| **Website origin** | `EXPO_PUBLIC_WEB_ORIGIN` (default `https://tapuai.app`) for gift QR links |
| **Not this work** | Separate marketing CMS, Next fan rewrite, or Lovable fork of the product |

Admin stays Expo `/admin` (writes) + Next `admin-portal` (read-only).

## Phase 1 (this change)

1. **Web Stripe checkout** — Payment Element modal matching `initPaymentSheet` / `presentPaymentSheet` so gifts, Exclusive, Drip, and booster paths work in the browser (test card `4242`).
2. **Desktop shell** — Wide viewports get a phone-width column so Home / dock / sheets stay usable.
3. **Exclusive rails** — Web may use Stripe Exclusive with books 20/80 once Payment Element is live; production native store apps still require IAP / Play Billing (not built).

## Later phases (not claimed done)

| Phase | Scope |
| --- | --- |
| 2 | Auth polish on web (Google when owner enables; magic link return URLs) |
| 3 | Upload / compress path honesty on web; Highlights playback QA |
| 4 | Operator / Connect KYC browser journeys |
| 5 | Hosted deploy of Expo web to `EXPO_PUBLIC_WEB_ORIGIN` + CDN |
| 6 | Optional lightweight marketing landing — only if owner wants it **outside** the app shell |

## Verification

- Local: open Expo web, Soft-Wall sign-in, Exclusive or gift with `4242` in test mode.
- CI: unit tests for web payment bridge + storeCommerce web allow.
- Hosted production web checkout: blocked on owner deploy + counsel / live keys.
