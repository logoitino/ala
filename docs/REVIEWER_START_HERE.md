<!-- Outside-engineer entry: map, checks, money/minors locations, scope freeze. No release authority. -->
# Reviewer start here

One page for an outside engineer reviewing Tapua'i. **Wave 0 / Stripe test mode.** This doc does not approve merge, SQL apply, counsel, or live money.

Owner Wave 0 leftovers (artifact prune, staging smoke, Android EAS, counsel/SQL, branch
protection / private legal): [engineering/OWNER_ACTIONS_1_5.md](engineering/OWNER_ACTIONS_1_5.md).

## Repo map

| Path | Role |
| --- | --- |
| `apps/mobile/` | Expo Router SDK 58 fan app + Expo `/admin` (the only write control plane) |
| `apps/admin-portal/` | Next.js read-only oversight (`:3001`) |
| `packages/shared-types/` | Shared TypeScript shapes |
| `supabase/migrations/` | Append-only SQL history (apply = owner decision) |
| `supabase/legacy/` | Pre-migration incremental `.sql` — **reference only** |
| `supabase/functions/` | Edge Functions (Stripe checkout, Connect, webhook) |
| `supabase/functions/_shared/money/` | Runtime-neutral money core (Node API + Edge) |
| `apps/mobile/src/backend/api/` | Node adapters for Expo `app/api/*+api.ts` |
| `docs/` | All documentation — index: [README.md](README.md) |
| `AGENTS.md` | Folder law and path aliases |

Mobile layout: `app/` = routes only; UI in `src/frontend/components/<Feature>/`; hooks in `hooks/`; network in `lib/`. Secrets never under `src/frontend/`.

## Read order (about an hour)

1. This page  
2. [STATE.md](STATE.md) §0 (current), then §5 / §6 (broken + owner decisions)  
3. [AGENTS.md](../AGENTS.md) · [CONVENTIONS.md](engineering/CONVENTIONS.md)  
4. [ARCHITECTURE.md](engineering/ARCHITECTURE.md) · [VOICE.md](product/VOICE.md) (money **words**; do not rename identifiers)  
5. [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md) (R1–R4) · [GLOSSARY.md](GLOSSARY.md)

## How to run checks

```bash
# Node 24 + pnpm (Corepack). Clean checkout:
pnpm install
pnpm check
```

`pnpm check` is what local agents and CI treat as the full gate. Useful slices: `pnpm typecheck`, `pnpm test`, `pnpm docs:check`, `pnpm copy:check`, `pnpm app:data-boundaries`, `pnpm comments:check`, `pnpm agents:check`, `pnpm security:client-keys`.

### Merge gates vs reports

| Kind | Examples | On fail |
| --- | --- | --- |
| **Merge gate** (must pass) | `typecheck`, mobile Jest, `docs:check`, `docs:links`, `copy:check`, `comments:check`, `agents:check`, `app:data-boundaries`, `security:client-keys`, `security:no-ssn`, feature-admin / data-map / IP / exit-map checks wired into `pnpm check` | Fix or stop — do not weaken the guard |
| **Report / scan** (informative) | `pnpm detection:scan`, Security infra JSON reports, exit inventory status | Record findings; not a silent skip of a failing gate |

GitHub workflow **Tapuai Team Quality Checks** (`.github/workflows/ci-checks.yml`) runs the same family of gates on PRs / `main`. Scheduled **Portable Exit Source Release** is a separate pipeline.

## Where money code lives (both serving paths)

1. **Shared core:** `supabase/functions/_shared/money/`  
2. **Expo / Metro path:** `apps/mobile/app/api/*+api.ts` → `apps/mobile/src/backend/api/` (PaymentIntent, payout, Connect)  
3. **Edge path:** `supabase/functions/create-payment-intent`, `create-stripe-account`, `stripe-webhook`, …  
4. **Client checkout:** `hooks/useTipCheckout.ts`, `TipCheckout` / `TipSheetModal` (identifiers stay `tips` / `malo*`)

Today the client still inserts `tips` after PaymentSheet. Webhook **crediting** must stay off until that insert is retired (double-credit). Payouts are hard-blocked (503).

## Where minors / RLS live

| Concern | Primary locations |
| --- | --- |
| Age / guardian / consent | `lib/minors.ts`, Custodial UI, migrations `MINOR-01` / related |
| Privacy / friends / blocks | `lib/privacy.ts`, PRIV-01 migrations |
| RLS + security-definer RPCs | Canonical `apps/mobile/src/backend/db/schema.sql`; history in `supabase/migrations/`; narrative in [SCHEMA.md](engineering/SCHEMA.md) |
| Payee / KYC flags | `lib/payeeVerification.ts`, Connect Edge + VERIFY-02 SQL |

Do **not** show draft guardian consent to real families. Do **not** apply SQL yourself.

## Staging + test accounts

- Staging project: `ala-sports-staging` (see [STAGING_RUNBOOK.md](engineering/STAGING_RUNBOOK.md)).  
- Preview builds via EAS; confirm the build’s Supabase project before judging a missing feature.  
- Test card: `4242 4242 4242 4242`.  
- Soft-Wall account sheet includes Demo Fan (`demo@tapuai.app`) until `EXPO_PUBLIC_APP_ENV=production`. Google may still be off — email signup works.  
- Human script: [TESTER_SCRIPT.md](engineering/TESTER_SCRIPT.md).

## Out of scope (owner scope freeze)

Hard stops for reviewers and agents — **stop and list**, do not decide:

- Apply or repair hosted SQL / migration history  
- Merge to `main`, branch protection, production project  
- Live Stripe keys, real payouts, Wave 1 spend (LLC, counsel, Play $25, Supabase Pro, …)  
- Counsel Terms / guardian consent / gift-linked Aura / store submission  
- Showing draft minor consent to real families  
- Renaming identifiers (`tips`, `reels`, `malo*`) to match UI words  
- Weakening a failing check to make CI green  

## Who decides what

| Decision | Owner |
| --- | --- |
| Prices, merge, SQL apply, live money, spend | Product owner (`FACILITATOR`) |
| Terms, association letter, tax/eligibility copy | Counsel (+ LEGAL coordinates) |
| Assign app fixes | CTO → department lead → specialist |
| Folder law / conventions | ENGINEERING + DOCUMENTATION (same-turn docs) |
| Security acceptance of a change | SECURITY (independent of “it passes Jest”) |

Current hand-off and known holes: [STATE.md](STATE.md) §0 · §5 · §6.
