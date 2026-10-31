# Hooks

Feature-facing state and lifecycle orchestration.

## What belongs here

- Hook names start with `use`; files are camelCase (`useTipCheckout.ts`).
- Compose `lib/` network helpers with loading, error, refresh, Realtime, and optimistic state.
- JSDoc on every custom hook (`@purpose`, `@sideEffects`).

## What does not

- Raw `supabase.from` / `.rpc` that should live in `lib/` (PORT-01 / data-boundary rule).
- UI components or StyleSheets.
- Importing `@backend/` from hooks.

## The rule people break

Putting vendor calls in the hook “just this once.” Move the call to `lib/`, keep the hook thin,
and shrink `scripts/app-data-boundary-baseline.json` if you cleared a route debt.

Return errors explicitly (failed ≠ empty). Clean up channels/timers. Tests cover load / fail /
cleanup / unapplied-SQL fallback.
