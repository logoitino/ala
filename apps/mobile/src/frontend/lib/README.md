# Client libraries

Typed product and data-access helpers used by hooks and components.

## What belongs here

- CamelCase domain files (`rallies.ts`, `minors.ts`, `donationThanks.ts`).
- Supabase / Stripe / Storage calls (or `services/` for process-wide clients).
- Row → app-type normalization; “migration not applied” fallbacks via `dbErrors.ts`.
- JSDoc on network/RPC helpers.

## What does not

- React components or hooks.
- Server secrets (`sk_`, service role).
- Imports of `@backend/` from frontend `lib/` (layering: frontend never imports backend).

## The rule people break

Calling Supabase from an Expo route under `app/`. Routes compose UI only; move `.from()` /
`.rpc()` here and shrink `scripts/app-data-boundary-baseline.json` in the same PR.

Run `pnpm app:data-boundaries` after moves.
