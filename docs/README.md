<!-- Index current engineering and execution receipts without implying hosted readiness. -->
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
| [PORTABLE_INTEGRATIONS](engineering/PORTABLE_INTEGRATIONS.md) | Shared app connection contract, matching target profiles and local installed-SDK compatibility tests. |
| [Infrastructure Security](engineering/INFRASTRUCTURE_SECURITY.md) | Security roles, current registered-source coverage and independent operational review workflow. |
| [Infrastructure Security report](engineering/INFRASTRUCTURE_SECURITY_REPORT.md) | Generated safe source binding, Security reviewers and unverified operational requirements. |
| [Infrastructure Security findings](engineering/INFRASTRUCTURE_SECURITY_FINDINGS.md) | Dated scoped source observations, local repairs and remaining review boundaries. |
| [Portable connection plan](engineering/design/PORTABLE_CONNECTION_IMPLEMENTATION_PLAN.md) | REDUNDANCY-06 executable local portability plan and scoped specialist assignments. |
| [Infrastructure Security plan](engineering/design/INFRASTRUCTURE_SECURITY_IMPLEMENTATION_PLAN.md) | REDUNDANCY-07 role/report/routing and local security repair assignments. |
| [REDUNDANCY-06](agents/REDUNDANCY-06.md) | Actual local portability/client/profile/test execution and final verification custody. |
| [REDUNDANCY-07](agents/REDUNDANCY-07.md) | Actual Security/VP/Documentation execution, source fixes and final verification custody. |

| Document | What it answers |
| --- | --- |
| [Media service plan](engineering/design/MEDIA_SERVICE_PLAN.md) | Current video/photo upload and player contracts, replaceable storage and migration tests; long videos off until measured costs, live deferred. |
| [Athlete story UI plan](engineering/design/ATHLETE_STORY_UX_IMPROVEMENT_PLAN.md) | Existing Calm Island story/tab scope, accessibility criteria and verification boundaries. |
| [UX-07](agents/UX-07.md) | Actual presentation exemption, source reviews, implementation and local UI verification receipts. |
| [ARCHITECTURE.md](engineering/ARCHITECTURE.md) | How the apps, Supabase, Stripe and Edge Functions fit together. |
| [SYSTEM_OVERVIEW.md](engineering/SYSTEM_OVERVIEW.md) | Executive summary, tech stack, directory map, feature tracker. |
| [CONVENTIONS.md](engineering/CONVENTIONS.md) | Folder rules, file naming, where code goes, the comment standard (§5). |
| [INNOVATION_AND_HANDOFF.md](engineering/INNOVATION_AND_HANDOFF.md) | Test new solutions, retain decisions and evidence, and prepare understandable engineering/legal/investor handoffs. |
| [IP documentation implementation plan](engineering/design/IP_DOCUMENTATION_IMPLEMENTATION_PLAN.md) | Source-bound packet, safe update triggers and verification steps. |
| [Historical Recovery screenshot](engineering/evidence/recovery-reference-2026-10-13.png) | Local 2026-10-13 reference with synthetic identifiers/source hashes; not current hosted or IP verification. |
| [LOCAL-02](agents/LOCAL-02.md) | Game venue details and directions: approved scope, admin-first implementation and verification. |
| [SCHEMA.md](engineering/SCHEMA.md) | Every table, RPC, policy and storage bucket. Checked by `pnpm docs:check`. |
| [Timed trivia plan](engineering/design/TIMED_TRIVIA_IMPLEMENTATION_PLAN.md) | Approved 30/90-second server/admin/player work and local verification. |
| [QUIZ-02](agents/QUIZ-02.md) | New timed trivia enrollment and actual readiness; QUIZ-01 remains historical. |
| [CODE_ORGANIZATION_PLAN.md](engineering/CODE_ORGANIZATION_PLAN.md) | The engineering readiness plan: readiness phases R1–R4, from dev-only to a separate production environment. |
| [ENVIRONMENTS_AND_HOSTING.md](engineering/ENVIRONMENTS_AND_HOSTING.md) | Laptop, development, staging, and production; the scalability ladder (no cache server we run; video host not selected); stay on Supabase or move to AWS / Azure; phases E0–E3. |
| [HOSTING_DECISION_BRIEF.md](engineering/HOSTING_DECISION_BRIEF.md) | Prior engineering recommendations plus the owner's $50/month follow-up (§10): phased costs, Supabase/AWS/Azure/own-server options, video workload, operating effort and a prepared Claude review. Prices unverified. |
| [GROWTH_CAPACITY_REVIEW.md](engineering/GROWTH_CAPACITY_REVIEW.md) | One accountable growth/capacity team, accepted measurement sources, per-service review triggers and CTO/owner decisions. |
| [STAGING_RUNBOOK.md](engineering/STAGING_RUNBOOK.md) | Standing up the staging project and a tester build. |
| [DEV_DATABASE_CATCHUP.md](engineering/DEV_DATABASE_CATCHUP.md) | Ordered SQL checklist to bring the development database up to date and switch Beyond posting on (owner decision 2026-10-16; not run). |
| [STAGING_DATABASE_CATCHUP.md](engineering/STAGING_DATABASE_CATCHUP.md) | Ordered SQL checklist to bring staging up to date (41 files since 2026-10-01, security fix first); prepared 2026-10-21, not run. |
| [TOOLING.md](engineering/TOOLING.md) | MCP servers for assistants (Playwright, Expo, Canva, Supabase dev, Figma): what each is for, sign-in, safety limits. |
| [TROUBLESHOOTING.md](engineering/TROUBLESHOOTING.md) | Metro, Expo, env and payment failures and their fixes. |
| [TESTER_SCRIPT.md](engineering/TESTER_SCRIPT.md) | What testers do per role, and what to ask them. |
| [DATA_PRIVACY_MAP.md](engineering/DATA_PRIVACY_MAP.md) | What personal data is collected, where it lives, and the gaps. |
| [MENU_STYLE_MAP.md](engineering/MENU_STYLE_MAP.md) | Shared sheet/menu components and which screens use them. |
| [AUDIT_REPORT.md](engineering/AUDIT_REPORT.md) | Interaction audits (newest at the top; older sections are history). |
| [design/ATHLETE_VERIFICATION_DESIGN.md](engineering/design/ATHLETE_VERIFICATION_DESIGN.md) | Athlete verification ladder, open sign-up, fake-highlight takedown. |
| [design/PHOTO_STORIES_DESIGN.md](engineering/design/PHOTO_STORIES_DESIGN.md) | Photo stories in Highlights: data model, RPC, screens, privacy rules and build ownership. |
| [design/PROFILE_PRIVACY_DESIGN.md](engineering/design/PROFILE_PRIVACY_DESIGN.md) | Profile privacy (PRIV-01): public / private accounts, per-item audiences, friends, blocking, hide from search, tag approval. |
| [ADMIN_MFA.md](engineering/ADMIN_MFA.md) | SCALE-01 admin two-step sign-in (TOTP, `aal2`) for the portal and Expo `/admin`: switches (default off), how the owner turns it on, what it does not cover. |
| [EXIT_DRILL.md](engineering/EXIT_DRILL.md) | Exit drill runbook (E3): local rehearsal today, full self-hosted Supabase drill after E1; record of runs. |
| [INFRASTRUCTURE_REGISTER.md](engineering/INFRASTRUCTURE_REGISTER.md) | Generated list of what Tapua'i runs on and how deeply the app is integrated (INFRA-01); owner `INFRASTRUCTURE`; source `infrastructure.json`. |
| [PORTABILITY.md](engineering/PORTABILITY.md) | Staying free to move hosts (PORT-01): what is portable, the Supabase ties, the two exits, the boundary guard and next steps. |
| [REDUNDANCY_TEAM.md](engineering/REDUNDANCY_TEAM.md) | Redundancy & Exit team charter (REDUNDANCY-02): documents, agents, change protocol and cadence that keep the move-off-Supabase plan current with every app change. |
| [EXIT_INFRASTRUCTURE_MAP.md](engineering/EXIT_INFRASTRUCTURE_MAP.md) | Generated build map for moving off Supabase: each component → AWS / Azure (exit A self-hosted, exit B cloud-native), owners, detected inventory, build order, plan version and unannounced changes; source `exit-map.json`. |
| [EXIT_CHANGE_LOG.md](agents/EXIT_CHANGE_LOG.md) | Routed notices of app changes the exit plan depends on, with each agent's review result (`EXIT_SYNC`). |
| [EXIT_READY_RUNBOOK.md](engineering/EXIT_READY_RUNBOOK.md) | Exact current source/image preparation, complete acceptance evidence and an unproven180-minute warm cutover target. |
| [MIGRATION_FAILURES_AND_CONTROLS.md](engineering/MIGRATION_FAILURES_AND_CONTROLS.md) | Local migration failures, implemented controls, historical reference limits and outstanding hosted drills. |
| [Exit implementation plan](engineering/design/EXIT_READY_IMPLEMENTATION_PLAN.md) | Owned REDUNDANCY-03 source/runtime/Storage/readiness implementation and acceptance. |
| [REDUNDANCY_PLAN.md](engineering/REDUNDANCY_PLAN.md) | Full Supabase backup scope, independent recovery copies, proposed schedule and AWS/Azure exit architecture. |
| [BACKUP_OPERATIONS.md](engineering/BACKUP_OPERATIONS.md) | Private backup job configuration, complete offsite upload accounting, freshness checks, guarded retries and independent-copy retrieval. |
| [CLOUD_MIGRATION_RUNBOOK.md](engineering/CLOUD_MIGRATION_RUNBOOK.md) | Backup, decrypt, reviewed restore, own-server deployment, cutover and rollback commands. |
| [Redundancy implementation checklist](engineering/design/REDUNDANCY_IMPLEMENTATION_PLAN.md) | Local tooling and separate operational acceptance work, with recorded verification gaps. |
| [Infrastructure operator entry point](../infrastructure/README.md) | Executable backup tools, application containers, upstream Supabase setup and AWS/Azure Terraform folders. |
| [design/PAYEE_VERIFICATION_PLAN.md](engineering/design/PAYEE_VERIFICATION_PLAN.md) | Verifying people who receive donations (VERIFY-02): SSN to Stripe only, guardian proof (Stripe + school), two-admin payout override. |
| [design/MINOR_ACCOUNTS_DESIGN.md](engineering/design/MINOR_ACCOUNTS_DESIGN.md) | Minor accounts (MINOR-01): birth month and year, teen defaults, guardian link and signed consent, supervision, under-16 approvals, under-13 closure. |
| [design/PARENT_PAYEE_CONNECT_DESIGN.md](engineering/design/PARENT_PAYEE_CONNECT_DESIGN.md) | Guardian-as-payee and custodial money rules. |
| [design/COMMUNITY_DASHBOARD.md](engineering/design/COMMUNITY_DASHBOARD.md) | Selected Community Impact dashboard, scoped implementation plan and verification requirements. |
| [ENGINEERING_SUPPORT.md](engineering/ENGINEERING_SUPPORT.md) | Engineering Support under Dev: cross-system detection, retained scans, safe logs, incidents and verified repairs. |
| [detection-sensors.json](engineering/detection-sensors.json) | Declared app/admin/backend/finance/data/UI/feedback/tooling coverage, limits and gap owners. |
| [DATA_GOVERNANCE.md](engineering/DATA_GOVERNANCE.md) | DATA-01: the data control point, the rule (owner, writer, reader, purpose), how to change data, open findings. |
| [DATA_MAP.md](engineering/DATA_MAP.md) | Generated master data map: every table, view and database function with owner, writers, readers, triggers and screens; dead-code triage. |
| [BOOKS01_STAGING_REHEARSAL.md](engineering/BOOKS01_STAGING_REHEARSAL.md) | W0-10: apply the bookkeeping migration on staging, read-only checks, a practice month and a QuickBooks sandbox import. |
| [TRIVIA_STAGING_APPLY.md](engineering/TRIVIA_STAGING_APPLY.md) | Apply trivia (QUIZ-01 to QUIZ-04) and its prerequisites on staging by hand: 16 files in order, a read-only check after each, rollback notes, then the in-app tester steps. |
| [design/BOOKKEEPING.md](engineering/design/BOOKKEEPING.md) | BOOKS-01/02: Finance & Books hub, double-entry journal from the money tables, QuickBooks export, monthly routine and tax questions for the CPA. |
| [FEATURE_ADMIN_WORKFLOW.md](engineering/FEATURE_ADMIN_WORKFLOW.md) | Future features: admin contracts, implementation/evidence before app work, and registered lifecycle gates. |
| [design/EMAIL_NOTIFICATIONS_DESIGN.md](engineering/design/EMAIL_NOTIFICATIONS_DESIGN.md) | Approved account/donation email, Activity inbox and Profile preferences architecture; optional emails off by default; local implementation/delivery gates. |
| [design/EMAIL_NOTIFICATIONS_IMPLEMENTATION_PLAN.md](engineering/design/EMAIL_NOTIFICATIONS_IMPLEMENTATION_PLAN.md) | Notification backend, money source, staff-before-app controls and verification tasks with file ownership. |
| [Notification admin evidence](engineering/evidence/NOTIFY-01-admin.md) | Actual local staff/source review and checks, with SQL/provider and payment-authority limits. |
| [Notification app evidence](engineering/evidence/NOTIFY-01-app.md) | Profile/Activity implementation, final regression and local readiness with delivery limits. |
| [evidence/FAMILY_FUN_BUILD_DECISIONS.md](engineering/evidence/FAMILY_FUN_BUILD_DECISIONS.md) | Concrete Fan Zone and quiz build decisions, reasons and cost of changing them. |
| [evidence/QUIZ-01-app.md](engineering/evidence/QUIZ-01-app.md) | Actual local quiz participant/integration checks and remaining final gates. |
| [evidence/FUN-01-admin.md](engineering/evidence/FUN-01-admin.md) | Local Fan admin source/checks and independent gate recording. |
| [evidence/FUN-01-app.md](engineering/evidence/FUN-01-app.md) | Fan account journey, accepted local source checks and separate release work. |
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
| [IP protection plan](legal/IP_PROTECTION_PLAN.md) | Confidential copyright/patent/trademark/secret preparation, upkeep and presentation checklist. |
| [IP counsel packet](legal/IP_COUNSEL_PACKET.md) | Generated source-bound disclosures, rights gaps and supplied decisions/receipts; intake draft, not a filing. |
| [IP register](legal/ip-register.json) | Factual input, contribution/license gaps and preserved review/decision/filing records. |

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
| [TEAM_STATUS.md](agents/TEAM_STATUS.md) | Current whole-team briefing, complete role coverage, gaps and next owners. |
| [HEALTH-01.md](agents/HEALTH-01.md) | Current-task evaluation, bounded telemetry and QA repairs, local health checks and remaining owners. |
| [GROWTH-01.md](agents/GROWTH-01.md) | Growth and Capacity Review setup, actual coordination/documentation checks, first measurement-gap baseline and next owners. |
| [INCIDENT_TEMPLATE.md](agents/INCIDENT_TEMPLATE.md) | Minimal incident evidence, owner, reproduction, repair and recovery handoff. |
| [FEATURE_ADMIN_TEMPLATE.md](agents/FEATURE_ADMIN_TEMPLATE.md) | Future feature registration and readiness checkpoint template. |
| [feature-admin.json](agents/feature-admin.json) | Enrolled future feature contracts checked by `pnpm feature-admin:check`. |
| [WORK_QUEUE.md](agents/WORK_QUEUE.md) | Ordered tasks with acceptance criteria and owners. |
| [IP-01](agents/IP-01.md) | Actual documentation/tooling execution, local checks and pending counsel work. |
| [REDUNDANCY-03.md](agents/REDUNDANCY-03.md) | Current exact-source release, Storage/runtime/evidence safeguards, actual independent reviews and pending cloud drill. |
| [REDUNDANCY-04.md](agents/REDUNDANCY-04.md) | Automatic current-source watcher, all-branch CI, actual activation and crash/failure/retention evidence. |
| [REDUNDANCY-01.md](agents/REDUNDANCY-01.md) | Actual backup/migration implementation receipts, independent review findings and pending operational rehearsal. |
| [DEPARTMENT_PLANS.md](agents/DEPARTMENT_PLANS.md) | Each department: what is in the app today, and what that team will do before a public release. |
| [EXPERT_STANDARDS.md](agents/EXPERT_STANDARDS.md) | The expert bar for each department, and which model is connected to each agent. |
| [ADM-01.md](agents/ADM-01.md) | Live tracker for the admin portal charts work (ADM-01): status, owner decisions, how to resume. Brief: [ADM-01_ASSIGNMENT.md](agents/ADM-01_ASSIGNMENT.md); fix list: [ADM-01_FIXES.md](agents/ADM-01_FIXES.md). |
| [ADM-02.md](agents/ADM-02.md) | Unified main admin: implementation claims, report/tool coverage and actual verification evidence. |
| [PLAY-01.md](agents/PLAY-01.md) | Browser media errors: scoped playback/dependency repair, ownership and actual verification evidence. |
| [SCALE-03.md](agents/SCALE-03.md) | Live scores over per-game Broadcast: topic/payload design, switch and fallback, RLS_SECURITY review, checks and unverified hosted work. |

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

## Beyond the Game continuation

| Document | Purpose |
| --- | --- |
| [BEYOND-01](agents/BEYOND-01.md) | Actual scoped implementation and review ledger |
| [Beyond the Game design](engineering/design/BEYOND_GAME_DESIGN.md) | Beyond switch on the Highlights bar and Beyond page (owner 2026-10-16; was a bottom tab), reviewed media and workout/Vault boundaries |
| [Coach-level move label design](engineering/design/COACH_LEVEL_LABEL_DESIGN.md) | SAFETY-01: local coach-level badge, switch and Highlights desk. SQL written, not applied. Counsel still open |
| [Figma UI/UX polish](engineering/design/UI_UX_FIGMA_POLISH.md) | Actual draft/plugin quota checkpoint, approved mock font, source reviews and proposed polish. |
| [UX-06](agents/UX-06.md) | Local Beyond/workout polish ownership, presentation exemption and actual verification. |
| [Implementation plan](engineering/design/BEYOND_GAME_IMPLEMENTATION_PLAN.md) | Ownership, admin-first gates and verification sequence |
| [CHAL-01 admin evidence](engineering/evidence/CHAL-01-admin.md) | Actual local operational checks and remaining acceptance scope. |
| [BEYOND-01 admin evidence](engineering/evidence/BEYOND-01-admin.md) | Actual private contribution/moderation checks, source limits and checkpoint. |
| [CHAL-01 app evidence](engineering/evidence/CHAL-01-app.md) | Actual local workout participant verification and release limits. |
| [BEYOND-01 app evidence](engineering/evidence/BEYOND-01-app.md) | Actual local dedicated-tab/contribution verification and release limits. |
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

| [QUIZ-02 admin evidence](engineering/evidence/QUIZ-02-admin.md) | Timed authority/admin local acceptance, actor checks and actual checkpoint; participant follows selected gate. |
| [QUIZ-02 app evidence](engineering/evidence/QUIZ-02-app.md) | Actual timed account/full-check verification, review handoff and explicit release gaps. |
| [QUIZ-01 admin evidence](engineering/evidence/QUIZ-01-admin.md) | Local weekly quiz admin source, independent acceptance and actual checks; no hosted release. |

| [Timed trivia proposal](engineering/design/TIMED_TRIVIA_PROPOSAL.md) | Owner-approved design: opt-in, sports-first topics, 30/90 timing, question history and admin-first requirements. |

## Exit preparation continuation

| Document | Purpose |
| --- | --- |
| [REDUNDANCY-05](agents/REDUNDANCY-05.md) | Private backup setup and operational health execution. |

## Manual sport identity and compact fan UI (2026-10-21)

| Document | Purpose |
| --- | --- |
| [MULTISPORT-01](agents/MULTISPORT-01.md) | Current source/admin/app evidence and remaining activation gates. |
| [UX-09](agents/UX-09.md) | Compact Local/floating dock exemption and actual verification. |
| [Multiple sport design](engineering/design/MULTISPORT_PROFILE_DESIGN.md) | Approved manual primary, per-sport records and privacy. |
| [Multiple sport plan](engineering/design/MULTISPORT_PROFILE_PLAN.md) | Backend/admin-first and athlete/public profile execution. |
| [Compact fan design](engineering/design/COMPACT_FAN_UI_DESIGN.md) | Compact labeled menus, Local hierarchy and dock behavior. |
| [Compact fan plan](engineering/design/COMPACT_FAN_UI_PLAN.md) | Exemption, geometry, scroll state and verification tasks. |
| [UX-10](agents/UX-10.md) | Sport accents, compact fan tabs and video behind the floating dock; ownership and actual local/native evidence. |
