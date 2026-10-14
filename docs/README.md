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
| [INNOVATION_AND_HANDOFF.md](engineering/INNOVATION_AND_HANDOFF.md) | Test new solutions, retain decisions and evidence, and prepare understandable engineering/legal/investor handoffs. |
| [SCHEMA.md](engineering/SCHEMA.md) | Every table, RPC, policy and storage bucket. Checked by `pnpm docs:check`. |
| [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md) | The engineering readiness plan: readiness phases R1–R4, from dev-only to a separate production environment. |
| [ENVIRONMENTS_AND_HOSTING.md](engineering/ENVIRONMENTS_AND_HOSTING.md) | Dev / staging / prod, stay on Supabase or move to AWS / Azure (options, cost, exit drill), and the merge-to-deploy pipeline (phases E0–E3). |
| [HOSTING_DECISION_BRIEF.md](engineering/HOSTING_DECISION_BRIEF.md) | Prior engineering recommendations plus the owner's $50/month follow-up (§10): phased costs, Supabase/AWS/Azure/own-server options, video workload, operating effort and a prepared Claude review. Prices unverified. |
| [GROWTH_CAPACITY_REVIEW.md](engineering/GROWTH_CAPACITY_REVIEW.md) | One accountable growth/capacity team, accepted measurement sources, per-service review triggers and CTO/owner decisions. |
| [STAGING_RUNBOOK.md](engineering/STAGING_RUNBOOK.md) | Standing up the staging project and a tester build. |
| [TOOLING.md](engineering/TOOLING.md) | MCP servers for assistants (Playwright, Expo, Canva, Supabase dev, Figma): what each is for, sign-in, safety limits. |
| [TROUBLESHOOTING.md](engineering/TROUBLESHOOTING.md) | Metro, Expo, env and payment failures and their fixes. |
| [TESTER_SCRIPT.md](engineering/TESTER_SCRIPT.md) | What testers do per role, and what to ask them. |
| [DATA_PRIVACY_MAP.md](engineering/DATA_PRIVACY_MAP.md) | What personal data is collected, where it lives, and the gaps. |
| [MENU_STYLE_MAP.md](engineering/MENU_STYLE_MAP.md) | Shared sheet/menu components and which screens use them. |
| [AUDIT_REPORT.md](engineering/AUDIT_REPORT.md) | Interaction audits (newest at the top; older sections are history). |
| [design/ATHLETE_VERIFICATION_DESIGN.md](engineering/design/ATHLETE_VERIFICATION_DESIGN.md) | Athlete verification ladder, open sign-up, fake-highlight takedown. |
| [design/PHOTO_STORIES_DESIGN.md](engineering/design/PHOTO_STORIES_DESIGN.md) | Photo stories in Highlights: data model, RPC, screens, privacy rules and build ownership. |
| [design/PROFILE_PRIVACY_DESIGN.md](engineering/design/PROFILE_PRIVACY_DESIGN.md) | Profile privacy (PRIV-01): public / private accounts, per-item audiences, friends, blocking, hide from search, tag approval. |
| [design/PAYEE_VERIFICATION_PLAN.md](engineering/design/PAYEE_VERIFICATION_PLAN.md) | Verifying people who receive donations (VERIFY-02): SSN to Stripe only, guardian proof (Stripe + school), two-admin payout override. |
| [design/MINOR_ACCOUNTS_DESIGN.md](engineering/design/MINOR_ACCOUNTS_DESIGN.md) | Minor accounts (MINOR-01): birth month and year, teen defaults, guardian link and signed consent, supervision, under-16 approvals, under-13 closure. |
| [design/PARENT_PAYEE_CONNECT_DESIGN.md](engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md) | Guardian-as-payee and custodial money rules. |
| [design/COMMUNITY_DASHBOARD.md](engineering/design/COMMUNITY_DASHBOARD.md) | Selected Community Impact dashboard, scoped implementation plan and verification requirements. |
| [ENGINEERING_SUPPORT.md](engineering/ENGINEERING_SUPPORT.md) | Engineering Support under Dev: cross-system detection, retained scans, safe logs, incidents and verified repairs. |
| [detection-sensors.json](engineering/detection-sensors.json) | Declared app/admin/backend/finance/data/UI/feedback/tooling coverage, limits and gap owners. |
| [DATA_GOVERNANCE.md](engineering/DATA_GOVERNANCE.md) | DATA-01: the data control point, the rule (owner, writer, reader, purpose), how to change data, open findings. |
| [DATA_MAP.md](engineering/DATA_MAP.md) | Generated master data map: every table, view and database function with owner, writers, readers, triggers and screens; dead-code triage. |
| [BOOKS01_STAGING_REHEARSAL.md](engineering/BOOKS01_STAGING_REHEARSAL.md) | W0-10: apply the bookkeeping migration on staging, read-only checks, a practice month and a QuickBooks sandbox import. |
| [design/BOOKKEEPING.md](engineering/design/BOOKKEEPING.md) | BOOKS-01/02: Finance & Books hub, double-entry journal from the money tables, QuickBooks export, monthly routine and tax questions for the CPA. |
| [FEATURE_ADMIN_WORKFLOW.md](engineering/FEATURE_ADMIN_WORKFLOW.md) | Future features: admin contracts, implementation/evidence before app work, and registered lifecycle gates. |
| [evidence/FAMILY_FUN_BUILD_DECISIONS.md](engineering/evidence/FAMILY_FUN_BUILD_DECISIONS.md) | Concrete Fan Zone and quiz build decisions, reasons and cost of changing them. |
| [evidence/QUIZ-01-app.md](engineering/evidence/QUIZ-01-app.md) | Actual local quiz participant/integration checks and remaining final gates. |
| [design/ADMIN_DATA_CONSOLIDATION.md](engineering/design/ADMIN_DATA_CONSOLIDATION.md) | All desk/report data ownership, safe menu merges and analysis preservation evidence. |
| [design/MAIN_ADMIN_PORTAL.md](engineering/design/MAIN_ADMIN_PORTAL.md) | ADM-02: selected report design and all administration controls in one main Expo portal. |
| [design/COMMUNITY_DASHBOARD_QA.md](engineering/design/COMMUNITY_DASHBOARD_QA.md) | Community Home and report-format design QA: source/render comparison and local browser checks (screenshots in `design/community-preview/`). |

Also: [`supabase/migrations/README.md`](../supabase/migrations/README.md) for how database changes are made.

## product/ — what we are building and how it talks

| Document | What it answers |
| --- | --- |
| [ROADMAP.md](product/ROADMAP.md) | North Star, release waves, phases and mission track. |
| [STORY.md](product/STORY.md) | The mission in plain words and the guardrails that keep athletes eligible. |
| [VOICE.md](product/VOICE.md) | Money wording rules (Donate / donation). Enforced by `pnpm copy:check`. |
| [USER_GROWTH_PLANS.md](product/USER_GROWTH_PLANS.md) | Growth and mitigation plans for guests, fans, uploaders/filmers, donors, athletes, guardians and partner users; proposed 30/60/90-day sequence. |
| [FAMILY_FUN_PLAYBOOK.md](product/FAMILY_FUN_PLAYBOOK.md) | Brainstorming draft: fan-video Game/Week/Month/Year recognition, family activities, badges, voluntary service, school spirit and separate money paths. |
| [PUBLIC.md](product/PUBLIC.md) | Public one-pager. |
| [STORE_LISTING.md](product/STORE_LISTING.md) | **Draft** App Store / Google Play copy using the approved message. Not submitted; LEGAL review required. |
| [PRODUCT_FACTS.md](product/PRODUCT_FACTS.md) | Prices, splits, tiers. **Generated** by `pnpm docs:sync`; do not hand-edit. |

## legal/ — risk and compliance

| Document | What it answers |
| --- | --- |
| [LEGAL_BRIEFING.md](legal/LEGAL_BRIEFING.md) | Every legal and money-copy risk as a lettered row. Owned by Legal. |
| [VERIFICATION_AND_SAFE_GROWTH_REVIEW.md](legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md) | Joint Legal/Growth/Dev source review, guardian/Stripe/school checks, consent gaps and proposed owner decisions. |

## company/ — business context

| Document | What it answers |
| --- | --- |
| [FINANCE_OPERATIONS.md](company/FINANCE_OPERATIONS.md) | Office of the CFO: finance team, chain of command, how Finance requests data, monthly close and tax calendars, owner-only actions. |
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
| [DETECT-01.md](agents/DETECT-01.md) | Engineering Support setup, file claims, detection gaps and actual verification. |
| [COORD-01.md](agents/COORD-01.md) | Actual Documentation and team-coordination assignments, checks, results and continuity limits. |
| [HEALTH-01.md](agents/HEALTH-01.md) | Current-task evaluation, bounded telemetry and QA repairs, local health checks and remaining owners. |
| [GROWTH-01.md](agents/GROWTH-01.md) | Growth and Capacity Review setup, actual coordination/documentation checks, first measurement-gap baseline and next owners. |
| [INCIDENT_TEMPLATE.md](agents/INCIDENT_TEMPLATE.md) | Minimal incident evidence, owner, reproduction, repair and recovery handoff. |
| [FEATURE_ADMIN_TEMPLATE.md](agents/FEATURE_ADMIN_TEMPLATE.md) | Future feature registration and readiness checkpoint template. |
| [feature-admin.json](agents/feature-admin.json) | Enrolled future feature contracts checked by `pnpm feature-admin:check`. |
| [WORK_QUEUE.md](agents/WORK_QUEUE.md) | Ordered tasks with acceptance criteria and owners. |
| [DEPARTMENT_PLANS.md](agents/DEPARTMENT_PLANS.md) | Each department: what is in the app today, and what that team will do before a public release. |
| [EXPERT_STANDARDS.md](agents/EXPERT_STANDARDS.md) | The expert bar for each department, and which model is connected to each agent. |
| [ADM-01.md](agents/ADM-01.md) | Live tracker for the admin portal charts work (ADM-01): status, owner decisions, how to resume. Brief: [ADM-01_ASSIGNMENT.md](agents/ADM-01_ASSIGNMENT.md); fix list: [ADM-01_FIXES.md](agents/ADM-01_FIXES.md). |
| [ADM-02.md](agents/ADM-02.md) | Unified main admin: implementation claims, report/tool coverage and actual verification evidence. |
| [PLAY-01.md](agents/PLAY-01.md) | Browser media errors: scoped playback/dependency repair, ownership and actual verification evidence. |

The agent definitions themselves are in `.claude/agents/`; `pnpm agents:check` keeps them in step
with these files.

## Rules for docs

- One topic, one home. Link to it instead of repeating it.
- Paths in docs are repo-relative in backticks (`docs/engineering/SCHEMA.md`) or relative links.
- A doc that describes the past belongs in `CHANGELOG.md`; a doc that describes the present is
  updated in the same PR as the code.

### Engineering Support console

| Document | Purpose |
| --- | --- |
| [Engineering Support console](engineering/design/ENGINEERING_SUPPORT_CONSOLE.md) | Main-admin design and safety contract |
| [DETECT-02 ledger](agents/DETECT-02.md) | Implementation claims, verification and admin-first checkpoint |

| [DETECT-02 admin evidence](engineering/evidence/DETECT-02-admin.md) | Local checks and review limits |
| [DETECT-02 app evidence](engineering/evidence/DETECT-02-app.md) | Runtime integration, bounded recovery and final local checks |

| [Recovery runbook](engineering/RECOVERY_RUNBOOK.md) | Source version previews and approved database backup rehearsal |

## Fan Zone pilot

| Document | Purpose |
| --- | --- |
| [FUN-01](agents/FUN-01.md) | Actual build/review/evidence and release gaps. |
| [Fan Zone design](engineering/design/FAN_ZONE_DESIGN.md) | Private entry, exact permission, free ballots, media and admin contracts. |
| [Fan Zone plan](engineering/design/FAN_ZONE_IMPLEMENTATION_PLAN.md) | Owned implementation stages, admin before fan. |

## Weekly Sport Pop Quiz

| Document | Purpose |
| --- | --- |
| [QUIZ-01](agents/QUIZ-01.md) | Actual weekly pop quiz implementation/evidence. |
| [Sport Pop Quiz design](engineering/design/SPORT_POP_QUIZ_DESIGN.md) | Optional weekly questions, noncash badge and correction contracts. |

| [QUIZ-01 admin evidence](engineering/evidence/QUIZ-01-admin.md) | Local weekly quiz admin source, independent acceptance and actual checks; no hosted release. |
