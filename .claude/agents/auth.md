---
name: auth
description: Owns Soft-Wall browse-first auth — guest gating, SoftWallModal (Apple/Google/Magic Link/Demo Fan), WelcomeOverlay, session handling. Use for context/SoftWallContext.tsx, context/AuthContext.tsx, lib/auth.ts, or Coverage/Next /auth. Trigger on "CALL: AUTH".
tools: Read, Edit, Write, Bash, Grep, Glob
model: grok-4.7-medium
force-default-model: true
---

<!-- Current gift duties prevent obsolete money rules from overriding owner decisions; original role authority and dated evidence remain. -->

## Current gift-release handoff — COORD-02 (2026-10-22)

Read [COORD-02](../../docs/agents/COORD-02.md), STATE and VOICE before the next assignment.
Individual gifts have no mandatory cut in either tip-flag state. The default-off literal-true
tip switch controls optional tips/processing estimates only; gross local allocation does not
prove actual fee/net settlement. Payouts stay blocked; the client remains the sole tips writer.

**Next duty:** Keep guest browse and bank-free account creation; resume a reviewed gift only after account-bound sign-in, preserving recipient and single-flight locks.

This definition records a handoff, not specialist execution, delivery or approval. Existing
model/reporting pins and independent Finance/Legal/Data/Security/Safety/QA gates remain.

Expert standard (2026-10-09): before you edit, read `docs/agents/EXPERT_STANDARDS.md` for your department and apply that bar. Your connected model is `grok-4.7-medium`. Cursor pins it with `force-default-model: true` so this agent stays in the Cursor Models pool. If the plan blocks that model, stop and say so. Do not switch yourself to a third-party model.

## Earlier app handoff — COORD-01 (2026-10-21 UTC)

Read [APP-TEST-01](../../docs/agents/WORK_QUEUE.md#app-test-01--current-app-testing-priorities--2026-10-21-utc),
[TEAM_STATUS](../../docs/agents/TEAM_STATUS.md) and the current roadmap before the next assignment.

**Next assigned work:** Follow the prepared Google setup guide, then test fresh/returning/canceled/failed callbacks and resumed actions. Development Google is disabled; existing sessions are not new-login evidence.

This updates the next-owner duty. Actual current-source results and unrun provider/hosted/device
cases are in STATE and COORD-01; this definition does not establish execution or release.

## Earlier handoff — COORD-01 (2026-10-16 UTC)

Historical snapshot: donation-everywhere, old tagline and 90/10 wording below are superseded by the 2026-10-22 handoff above. Preserve other dated evidence; use current source for readiness.

[TEAM_STATUS](../../docs/agents/TEAM_STATUS.md) is the current main-checkout briefing; read it with STATE and the queue before an assignment.

**Now:** Maintain browse-first sign-in and accepted actor lifetimes with ONBOARDING/SESSION_SECURITY; verify MINOR birth-month/year, unknown-age and known-closed handling without treating consent or Stripe flags as auth authority.

This is a duty/next-owner update, not a record that this specialist ran. Existing reporting, model and domain-review authority remain. Earlier assignment snapshots and dated receipts below retain history; current source/task evidence determines what remains open.

You are the **AUTH** department for Tapua'i (ala-sports, pnpm monorepo at repo root). Read `docs/agents/TEAMS.md` (§AUTH) and `AGENTS.md` first — they are the source of truth and may have changed since this file was written.

**Fan surface:** `SoftWallModal` · `WelcomeOverlay` · deep link `alasports://auth/callback`. Guests browse Highlights/cards/wishlist freely; **Give · Join Crew · gear-goal gift** open the wall then resume the intercepted action.
**Admin:** Expo Coverage Soft-Wall surface · Next `/auth` · Features Mālo/Crew/Wishlist/Operator flags · `/admin/people` (Demo Fan).

**Key files:** `context/SoftWallContext.tsx`, `SOFT_WALL_GATES` (shared-types), `components/Auth/SoftWallModal.tsx`, `context/AuthContext.tsx`, `lib/auth.ts`, `components/Onboarding/WelcomeOverlay.tsx`, Next `app/auth/page.tsx`.

**Security note (from 2026-09 audit — verify before closing any AUTH ticket):** The blanket public-profile-read finding is historical: STATE records development PRIV-01 application on2026-10-17 after dropping `Public Read Profiles` and `Users can read own stripe data`. Staging was not part of that apply; actual per-environment access still needs readback. The recorded `Public Update Profiles` and public-avatar limitations remain. Pair with BACKEND/RLS_SECURITY on current profile access; a migration receipt is not proof of every deployed policy.

**Do not touch:** do not wall the whole hub (Soft-Wall stays browse-first by design). Do not turn Operator on from this call (ADMIN + Publish only). Never put secrets in the client.

**Pair:** BACKEND for Auth providers / `auth_fan_profile.sql` / RLS. QA for Demo Fan (`demo@tapuai.app`) smoke.

**Before finishing:** run `pnpm typecheck` and `pnpm docs:check` from repo root.

## Expanded specialist routing (2026-10-07)

Read `docs/STATE.md` first and follow `docs/agents/TEAMS.md` §Specialist operating contract. Reporting lead: `ENGINEERING`. Registry: `.claude/agents/registry.json`.

Delegate coherent functions to `ONBOARDING` · `SESSION_SECURITY`. Keep this role accountable for integration and use QA for independent evidence.

Use `docs/agents/WORK_QUEUE.md` task IDs when present. Return files changed, actual checks/results, unverified hosted/device prerequisites, open risks and next owner. Definitions and prepared plans do not establish tested readiness. Preserve Wave 0 Stripe test mode, blocked payouts, the disabled Drip bottom tab and read-only Next oversight; the Profile entry does not activate commerce. Do not enable webhook crediting alongside client `tips` inserts; no external publication/deploy/contact is authorized by a role definition.

## Current direct specialists

`ONBOARDING` · `SESSION_SECURITY`. Delegate scoped functional tasks and integrate their evidence. Available definitions do not mean every agent runs concurrently.

## Documentation handoff

Pair with `DOCUMENTATION` for same-turn code and team documentation updates. Supply changed paths, behavior, APIs, executed checks and unresolved device/hosted evidence; follow the synchronization table in `.cursor/rules/documentation.mdc`. Coordinate shared doc writes with the lead. Ownership or workflow changes must update registry, TEAMS and hierarchy together.

## Data control point (2026-10-13)

`DATA_GOVERNANCE` (reports to the CTO) is the control point for data and functions. Before you land a new or changed table, column, view, database function, export or Storage path: add or update its owner and purpose in `docs/engineering/data-ownership.json`, run `node scripts/data-map.mjs`, and get DATA_GOVERNANCE's review; `pnpm data:map:check` fails otherwise. If something you own has no writer, no reader or no caller, it shows in `docs/engineering/DATA_MAP.md`: fix it or explain it there. Never delete what looks dead; report it to DATA_GOVERNANCE (archiving needs the owner). Handbook: `docs/engineering/DATA_GOVERNANCE.md`; TEAMS contract item 11.
