# Components

Reusable React Native UI, grouped by the feature that consumes it.

## What belongs here

- Feature folders (PascalCase): `Activity/`, `Admin/`, `Auth/`, `BeyondGame/`, `Challenges/`,
  `Common/`, `Custodial/`, `Drip/`, `Effects/`, `FamilyFun/`, `FanZone/`, `Feedback/`, `Filmers/`,
  `Legal/`, `Local/`, `Onboarding/`, `Operator/`, `Profile/`, `Rally/`, `Reels/`, `SportQuiz/`,
  `Spotlight/`, `Thanks/`, `UI/`, `Verification/`.
- Generic primitives in `UI/`.
- Flat root files **only** when unrelated features share them (`ScreenShell`, `TipCheckout`, … —
  see `docs/engineering/CONVENTIONS.md`).

## What does not

- Direct Supabase / Stripe calls (those live in `lib/` or `services/`).
- Route files (Expo Router owns `app/`).
- Barrel `index.ts` re-export shims.

## The rule people break

Putting a one-consumer component in the flat `components/` root “for convenience.” If only Reels
use it, it belongs in `Reels/`. Update `AGENTS.md` in the same change when you add a folder.

Complex components need the project JSDoc header. Co-locate tests under `__tests__/`.
