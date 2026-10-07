# Documentation index

Every document in the repo, grouped by who it is for. New here? Read the four entry points in
order, then dip into the folders as you need them.

## Entry points (read in this order)

| Document | What it answers |
| --- | --- |
| [../README.md](../README.md) | What this is, the repo map, how to run it, how we work. |
| [ONBOARDING.md](ONBOARDING.md) | Full setup (env, auth providers, simulator), your first day, where things are. |
| [GLOSSARY.md](GLOSSARY.md) | Code names vs. product words (`tips` = donations, `reels` = Highlights, …). |
| [STATE.md](STATE.md) | Where the project is **right now**: recent changes, known breakage, open decisions, next steps. The living log; update it with every code change. |

## engineering/ — how the system is built

| Document | What it answers |
| --- | --- |
| [ARCHITECTURE.md](engineering/ARCHITECTURE.md) | How the apps, Supabase, Stripe and Edge Functions fit together. |
| [SYSTEM_OVERVIEW.md](engineering/SYSTEM_OVERVIEW.md) | Executive summary, tech stack, directory map, feature tracker. |
| [CONVENTIONS.md](engineering/CONVENTIONS.md) | Folder rules, file naming, where code goes, the comment standard (§5). |
| [SCHEMA.md](engineering/SCHEMA.md) | Every table, RPC, policy and storage bucket. Checked by `pnpm docs:check`. |
| [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md) | The engineering readiness plan: readiness phases R1–R4, from dev-only to a separate production environment. |
| [STAGING_RUNBOOK.md](engineering/STAGING_RUNBOOK.md) | Standing up the staging project and a tester build. |
| [TROUBLESHOOTING.md](engineering/TROUBLESHOOTING.md) | Metro, Expo, env and payment failures and their fixes. |
| [TESTER_SCRIPT.md](engineering/TESTER_SCRIPT.md) | What testers do per role, and what to ask them. |
| [DATA_PRIVACY_MAP.md](engineering/DATA_PRIVACY_MAP.md) | What personal data is collected, where it lives, and the gaps. |
| [MENU_STYLE_MAP.md](engineering/MENU_STYLE_MAP.md) | Shared sheet/menu components and which screens use them. |
| [AUDIT_REPORT.md](engineering/AUDIT_REPORT.md) | Interaction audits (newest at the top; older sections are history). |
| [design/ATHLETE_VERIFICATION_DESIGN.md](engineering/design/ATHLETE_VERIFICATION_DESIGN.md) | Athlete verification ladder, open sign-up, fake-highlight takedown. |
| [design/PARENT_PAYEE_CONNECT_DESIGN.md](engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md) | Guardian-as-payee and custodial money rules. |

Also: [`supabase/migrations/README.md`](../supabase/migrations/README.md) for how database changes are made.

## product/ — what we are building and how it talks

| Document | What it answers |
| --- | --- |
| [ROADMAP.md](product/ROADMAP.md) | North Star, release waves, phases and mission track. |
| [STORY.md](product/STORY.md) | The mission in plain words and the guardrails that keep athletes eligible. |
| [VOICE.md](product/VOICE.md) | Money wording rules (Donate / donation). Enforced by `pnpm copy:check`. |
| [PUBLIC.md](product/PUBLIC.md) | Public one-pager. |
| [PRODUCT_FACTS.md](product/PRODUCT_FACTS.md) | Prices, splits, tiers. **Generated** by `pnpm docs:sync`; do not hand-edit. |

## legal/ — risk and compliance

| Document | What it answers |
| --- | --- |
| [LEGAL_BRIEFING.md](legal/LEGAL_BRIEFING.md) | Every legal and money-copy risk as a lettered row. Owned by Legal. |

## company/ — business context

| Document | What it answers |
| --- | --- |
| [COMPANY_PHASES.md](company/COMPANY_PHASES.md) | Company phases and the billing plan (when money becomes real). |
| [INVESTOR.md](company/INVESTOR.md) | Investor briefing. |
| [ALA_TEAM_BRIEF.md](company/ALA_TEAM_BRIEF.md) | Team brief for the ALA assistant bot. |
| [press/](company/press/README.md) | Press stills. |

`legal/` and `company/` hold material that outside contractors usually should not see. Before
giving someone outside the company access to the repo, move these two folders to a private
location (tracked in [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md), R1).

## agents/ — the AI specialist roster

| Document | What it answers |
| --- | --- |
| [TEAMS.md](agents/TEAMS.md) | Department call sheet: who owns which screens and files, now / next / later. |
| [TEAM_HIERARCHY.md](agents/TEAM_HIERARCHY.md) | Org chart of departments and agents. |
| [WORK_QUEUE.md](agents/WORK_QUEUE.md) | Ordered tasks with acceptance criteria and owners. |

The agent definitions themselves are in `.claude/agents/`; `pnpm agents:check` keeps them in step
with these files.

## Rules for docs

- One topic, one home. Link to it instead of repeating it.
- Paths in docs are repo-relative in backticks (`docs/engineering/SCHEMA.md`) or relative links.
- A doc that describes the past belongs in `CHANGELOG.md`; a doc that describes the present is
  updated in the same PR as the code.
