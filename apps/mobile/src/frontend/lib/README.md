# Client libraries

Typed product and data-access helpers used by hooks and components.

- Keep files camelCase and organize by domain (`rallies.ts`, `operator.ts`, `donationThanks.ts`).
- Supabase, Stripe, Storage, and other vendor calls terminate here or in `services/`.
- Routes under `app/` compose UI and navigation; they do not add new `.from()` or `.rpc()` calls.
- Normalize database rows into stable app types here so UI code does not depend on PostgREST shapes.
- Network/RPC helpers require the project JSDoc header with inputs, outputs, and side effects.
- Preserve useful “feature unavailable” fallbacks for migrations that have not reached every project.

Run `pnpm app:data-boundaries` when moving route queries here, and reduce
`scripts/app-data-boundary-baseline.json` in the same change.
