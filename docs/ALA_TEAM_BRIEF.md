# ALA Grok Bot team brief

Canonical briefing for the Grok Bot **ALA** channel. **Who owns which tab:** [TEAMS.md](TEAMS.md) (call codes `HIGHLIGHTS` · `LOCAL` · `PROFILE` · …). Re-read both when starting a Tapua'i turn — do not invent product facts.

**Repo:** `~/Desktop/ala-sports` · GitHub `logoitino/ala` · pnpm monorepo.

## Stack (current)

| Package | Path | Role |
| --- | --- | --- |
| `@tapuai/mobile` | `apps/mobile/` | Expo Router SDK 57 fan app + Expo `/admin` production desks |
| `@tapuai/admin-portal` | `apps/admin-portal/` | **Web** Next admin, **read-only oversight**: Overview / **Reports** / **Money** / Soft-Wall / Profile / Features / People at `http://localhost:3001`. All edits happen in Expo `/admin`. |
| `@tapuai/shared-types` | `packages/shared-types/` | Soft-Wall gates (`SOFT_WALL_GATES`) + Profile chrome (`PROFILE_CHROME_FLAGS`) |

Commands: `pnpm mobile` · `pnpm admin` · `pnpm typecheck` · `pnpm docs:check` · `pnpm docs:sync` (prices / Aura / catalogs only).

## Soft-Wall (browse-first)

Guests browse Highlights / cards / wishlist. **Donate · Join Crew · gear-goal donate** → `SoftWallModal` (email+password Sign in, Demo Fan, Apple, Google, Magic Link) → resume. Operator stays Features-gated (`layouts.operatorConsole` default off). Oversight: Expo Coverage Soft-Wall surface + Next `/auth` + Features Soft-Wall group. Department: `AUTH`.

## Clean Profile hierarchy (2026-09-15)

1. **Hamburger** `ProfileMenuSheet` — Sign in/out, Account Capability, Suggest, Receipts, Admin, Flip Aura card, Payouts (own Profile only).
2. **Hero** — large circular avatar (tier ring + jersey); Flip Aura card is secondary (menu / Flip control), gated by `profile.showCard`.
3. **Slim Crew · Squad** strip (`profile.showCrew`).
4. Drop Donate / Subscribe row.
5. **Highlights collage** first (default tab); Stats / Vault pills under collage + roster.
6. **Active Team Roster** — schoolmates; athletes see Claimed / Unclaimed via `profiles.player_id`.

**Varsity:** Claim school freely. `is_verified` is the fun ⚡ VERIFIED VARSITY badge (team code or coach/parent), not a wall. Unverified profiles stay public; Player of the Week needs Varsity.

**Share & Fund:** Profile + Wishlist **Share & Fund ⚡** → Obsidian QR (`tapuai.app/gift/{handle}`), save to Camera Roll, copy link, native share.

**Admin oversight:** Next `/profile` + Features · Profile chrome + Expo Look · Profile. Shared map: `PROFILE_CHROME_FLAGS`. Claimed count = `profiles.player_id IS NOT NULL`. Department: `PROFILE`.

## Docs of record

Pull facts from: `AGENTS.md` · `DOCUMENTATION.md` · `CHANGELOG.md` · `docs/ARCHITECTURE.md` · `docs/ONBOARDING.md` · `docs/SCHEMA.md` · `docs/TEAMS.md` · `docs/AUDIT_REPORT.md` · `docs/ROADMAP.md` · `docs/COMPANY_PHASES.md`. Product copy: **Mālo** / **Seki** / **Highlights ⚡**. Canvas: Daylight.

## Role reminders (command staff)

Staff a **department call** from [TEAMS.md](TEAMS.md). Do not hand a tab to “Mobile” without a code (`PROFILE`, `HIGHLIGHTS`, …).

- **Ala Facilitator** (`FACILITATOR`) — one next ship move; coordinate teammates; never invent prices or legal conclusions.
- **Mobile Eng** — `apps/mobile` only; Expo v57 docs; no Stripe secrets in frontend; implement the named department.
- **Backend Eng** (`BACKEND`) — schema / RLS / RPCs / Edge Functions; keep `docs/SCHEMA.md` honest.
- **Ship QA** (`QA`) — gate with `pnpm typecheck` + `pnpm docs:check`; Soft-Wall / Profile / Publish-to-app pitfalls; pass/fail notes.

Paste:

```text
CALL: <DEPARTMENT>
Symptom: …
Fan surface: …
Admin desk: …
Do not: …
Read first: docs/TEAMS.md
Gate: pnpm typecheck && pnpm docs:check
```
