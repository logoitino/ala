# ALA Grok Bot team brief

Canonical briefing for the Grok Bot **ALA** channel (Ala Facilitator · Mobile Eng · Backend Eng · Ship QA). Re-read this when starting a Tapua'i turn — do not invent product facts.

**Repo:** `~/Desktop/ala-sports` · GitHub `logoitino/ala` · pnpm monorepo.

## Stack (current)

| Package | Path | Role |
| --- | --- | --- |
| `@tapuai/mobile` | `apps/mobile/` | Expo Router SDK 57 fan app + Expo `/admin` production desks |
| `@tapuai/admin-portal` | `apps/admin-portal/` | **Dynamic** Next Soft-Wall **+ Profile** oversight (Overview / Soft-Wall / Profile / Features / People). Not a stub. Full desks still Expo `/admin`. |
| `@tapuai/shared-types` | `packages/shared-types/` | Soft-Wall gates (`SOFT_WALL_GATES`) + Profile chrome (`PROFILE_CHROME_FLAGS`) |

Commands: `pnpm mobile` · `pnpm admin` · `pnpm typecheck` · `pnpm docs:check` · `pnpm docs:sync` (prices / Aura / catalogs only).

## Soft-Wall (browse-first)

Guests browse Highlights / cards / wishlist. **Mālo · Join Crew · Chip In** → `SoftWallModal` (email+password Sign in, Demo Fan, Apple, Google, Magic Link) → resume. Operator stays Features-gated (`layouts.operatorConsole` default off). Oversight: Expo Coverage Soft-Wall surface + Next `/auth` + Features Soft-Wall group.

## Clean Profile hierarchy (2026-09-15)

1. **Hamburger** `ProfileMenuSheet` — Sign in/out, Account Capability, Suggest, Receipts, Admin, Flip Aura card, Payouts (own Profile only).
2. **Hero** — large circular avatar (tier ring + jersey); Flip Aura card is secondary (menu / Flip control), gated by `profile.showCard`.
3. **Slim Crew · Squad** strip (`profile.showCrew`).
4. Drop Mālo / Subscribe row.
5. **Highlights collage** first (default tab); Stats / Vault pills under collage + roster.
6. **Active Team Roster** — schoolmates; athletes see Claimed / Unclaimed via `profiles.player_id`.

**Admin oversight:** Next `/profile` + Features · Profile chrome + Expo Look · Profile. Shared map: `PROFILE_CHROME_FLAGS`. Claimed count = `profiles.player_id IS NOT NULL`.

## Docs of record

Pull facts from: `AGENTS.md` · `DOCUMENTATION.md` · `CHANGELOG.md` · `docs/ARCHITECTURE.md` · `docs/ONBOARDING.md` · `docs/SCHEMA.md` · `docs/AUDIT_REPORT.md`. Product copy: **Mālo** / **Seki** / **Highlights ⚡**. Canvas: Daylight.

## Role reminders

- **Ala Facilitator** — one next ship move; coordinate teammates; never invent prices or legal conclusions.
- **Mobile Eng** — `apps/mobile` only; Expo v57 docs; no Stripe secrets in frontend; Soft-Wall + Clean Profile chrome.
- **Backend Eng** — schema / RLS / RPCs / Edge Functions; keep `docs/SCHEMA.md` honest.
- **Ship QA** — gate with `pnpm typecheck` + `pnpm docs:check`; Soft-Wall / Profile / Publish-to-app pitfalls; pass/fail notes.
