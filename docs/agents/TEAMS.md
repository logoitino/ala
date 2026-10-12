# Tapua'i department call sheet

**Org chart (who reports where):** [TEAM_HIERARCHY.md](TEAM_HIERARCHY.md) — open that first if you only need the hierarchy and agent list. **Each department's plan:** [DEPARTMENT_PLANS.md](DEPARTMENT_PLANS.md).

Use this when you **call a team** to fix or update one area. An app fix is assigned by the **CTO** (`CALL: CTO`). The **VP of Operations** (`CALL: VP_OPERATIONS`) reports to the CTO and updates roles, protocols, and priorities in the same turn they change. The CTO gives the fix to one department lead. That lead gives it to a specialist. The specialist reports to the lead. The lead reports the fix to the CTO and reports role or protocol drift to the VP of Operations. The owner (`FACILITATOR`) still decides prices, counsel, applying SQL, merging, and live money.

**Repo:** `/Users/seiuliian/Downloads/ala-sports` · GitHub `logoitino/ala` · pnpm monorepo.
**Copy:** money on screen is **Donate / donation** ([VOICE.md](../product/VOICE.md)). "Mālo!" is only a thank-you. **Seki** / **Highlights ⚡**. Persistence still `tips` / `reels` / `useTipCheckout`.
**Facts:** [SYSTEM_OVERVIEW.md](../engineering/SYSTEM_OVERVIEW.md) · [ARCHITECTURE.md](../engineering/ARCHITECTURE.md) · [SCHEMA.md](../engineering/SCHEMA.md) · [ALA_TEAM_BRIEF.md](../company/ALA_TEAM_BRIEF.md) · [CHANGELOG.md](../../CHANGELOG.md). Do not invent prices, Aura math, or legal conclusions — run `pnpm docs:sync` or read [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md).

---

## How to call a team

Paste this at the top of the chat (Grok ALA, Cursor, or Slack):

```text
CALL: <DEPARTMENT>
Symptom: <what is broken or what to add>
Fan surface: <tab or route>
Admin desk: <Expo /admin/... or Next /...>
Do not: <other departments>
Read first: docs/agents/TEAMS.md#<anchor>
Gate: pnpm typecheck && pnpm docs:check
```

Say the department in plain words. These calls have an agent that does the work:

`CALL: DESIGN` · `CALL: ENGINEERING` · `CALL: FULLSTACK` · `CALL: BACKEND` · `CALL: LEGAL` · `CALL: COMPLIANCE` · `CALL: VOICE` · `CALL: QA`

`CALL: CTO` assigns the fix. `CALL: VP_OPERATIONS` keeps roles, protocols, and priorities current. `CALL: ENGINEERING` is the dev team. `CALL: BACKEND` is the database team. `CALL: SECURITY` is the security team. `CALL: OPERATIONS` is IT infrastructure. `CALL: PRODUCT` is product. `FACILITATOR` is the owner.

**Engineering roles:** `ENGINEERING` (lead) · `BACKEND` (database engineer) · `FULLSTACK` (full-stack developer). Screen squads when the change is only in one place: `HIGHLIGHTS` · `LOCAL` · `SPOTLIGHT` · `PROFILE` · `AUTH` · `COMMERCE` · `AURA` · `ADMIN` · `OPERATOR` · `ROLE_HQ`.

If the bug spans two departments, the **CTO** names one lead and the required pair. Schema / RLS / RPC / Storage / Stripe secrets always pull **Backend** and **Security**. Cross-cutting app + API work pulls **Fullstack** under the dev lead. Publish-to-app and docs honesty always pull **QA**. Privacy / ToS / processor / claim hygiene pulls **Compliance**.

### Dispatching in Claude Code

Every department except `FACILITATOR` (that's whoever is driving the session — human or the top-level Claude Code assistant, reading this file to route) is a real subagent at `.claude/agents/<code>.md` (lowercase, `ROLE_HQ` → `role-hq.md`). Ask Claude Code to dispatch one directly — "CALL: BACKEND, fix the anon RLS grants" works, or explicitly say "use the backend subagent." Each subagent's file already embeds its fan surface, admin desk, key files, do-not-touch list, and pairing rules from this page, plus any currently-open backlog items relevant to that department, so a call does not need to re-explain context. Subagents run with `Read, Edit, Write, Bash, Grep, Glob` (LEGAL and QA are more restricted — see their files) and are expected to self-gate with `pnpm typecheck` / `pnpm docs:check` before reporting done. Keep this file and the `.claude/agents/*.md` files in sync when a department's surface changes — the agent files are the executable copy, this file is the readable one.

Cursor works in this same tree alongside Claude Code. Claude owns the security sweeps and `docs/product/ROADMAP.md`; Cursor should extend that work, not replace it or revive a closed audit item. Claude should keep Cursor's later fixes: Account Settings waits for the hamburger modal to dismiss before Soft-Wall opens, and profile photos plus booster logos upload as image bytes to `avatars` (`sponsors/` for logos), not as a `text/plain` blob and not into the video-only `game_highlights` bucket. New Vault / Exclusive videos upload to the private `reel_vault` bucket as `reelvault:{path}` and play through `resolvePlaybackUrl`; free Highlights stay on the public `reels` bucket. That bucket is a bridge only. The video host is still Cloudflare Stream or Mux — pick the cheaper one that still plays well — and neither tool should build transcoding, a CDN, or analytics on Supabase Storage while that choice is open. When either tool lands a schema or copy change, the other treats `docs/engineering/SCHEMA.md` and `docs/product/ROADMAP.md` as the current story.

---

## Business departments

These are the departments a company actually has. The names under **Builds it** are the engineering agents that do the work today. Claude Code reads `.claude/agents/<file>.md`. Cursor uses the same name (`ROLE_HQ` → `role-hq`). A business department can have more than one agent. Use the existing functional specialist when a responsibility already has an owner; add a specialist only for a distinct function or required independent gate.

**Now** is Wave 0: internal test, Stripe test cards, staging. **Next** has to exist before a public build or live money, and it is not this week's build. **Later** is named so it is not forgotten. Do not start it because it is listed.

| Department | What the business owns | Builds it | Now | Next | Later |
| --- | --- | --- | --- | --- | --- |
| **VP of Operations** | Whether every team is on its role, on the current protocol, and on the current priority. | `VP_OPERATIONS`, reporting to `CTO` | Update agent definitions, TEAMS, the hierarchy, and the queue in the same turn a role or protocol changes. Tell each lead what is actually next. | Keep the same check as the roster grows | A staffed human operations desk is not this role |
| **Product** | What ships, for whom, and in what order. Acceptance for an app fix comes from the CTO. | `PRODUCT` · `RESEARCH`, reporting to `CTO` | Test wave: compact uploads/donations and shared menu energy; staged device acceptance in TESTER_SCRIPT | Owner decisions in STATE §6 before live money | Company formation stays with the founder |
| **Design (UX/UI)** | How every screen looks, moves, and reads. | `DESIGN` · `ACCESSIBILITY` · `MOTION` · `DESIGN_TOOLING`; `AURA` keeps tier math | Daylight canvas, tab colors, springs, one primary action per sheet, empty vs error. UX-05 photo story screens via Figma/Canva MCP handoff; TOOL-01 MCP tooling (`.mcp.json`, [TOOLING.md](../engineering/TOOLING.md)) | Feel check on a real phone with Quality (M9) | Share card, backer wall, badges, a bigger rivalry takeover (M8). Fan digital signature on the Aura card |
| **Engineering** | The app and the admin tools — industry practice, no shortcuts. The database is its own team. | `ENGINEERING` lead (reports to `CTO`) · `FULLSTACK` · `DOCUMENTATION` · screen squads (incl. `PHOTO_STORIES` under `HIGHLIGHTS`). Database: `BACKEND` | UX-05 photo stories in Highlights ⚡ ([design](../engineering/design/PHOTO_STORIES_DESIGN.md); migration `20261007230000` written, not applied). Shared Daylight sheets/pages and code/doc handoffs. Home, Activity, Local, Spotlight, Profile, sign-in, sideline scorer, Expo admin. Account tags on a Highlight (SQL not applied). Staging has the September SQL and the content-rights SQL. Drip tab is off | Magic-link redirect on staging. `reel_vault` so Vault video plays. Apply account-tag SQL when the owner asks. Real admin and operator sessions. Pick Cloudflare Stream or Mux; do not build a video platform on Storage | Drip marketplace (Wave 1). Fan digital signature on the Aura card. Low-view lane (M3). Train Like Me / Ask an athlete (M4). Showcase link (M6). Game-day gigs (M5, Wave 3). No licensed music picker |
| **Database** | Schema, migrations, RPCs, Storage layout. | `BACKEND` (reports to `CTO`) · `DATABASE_MIGRATIONS` · `STORAGE`. `SECURITY` reviews RLS | Canonical `schema.sql`. Photo-story and account-tag SQL written, not applied | Hosted replay only when the owner asks | Export/deletion SQL after counsel and Product agree |
| **Security** | Authorization, sessions, secrets. Critical review, no open policies for convenience. | `SECURITY` (reports to `CTO`) · `RLS_SECURITY` · `SESSION_SECURITY` | Named gaps stay open until fixed: client `tips` insert, public profile fields, operator GPS policy not applied | Negative authorization tests before public beta | Repeat when a new sensitive table lands |
| **IT infrastructure** | Staging, CI, releases, reliability, recovery, cost, game day. | `OPERATIONS` (reports to `CTO`) · `OPERATOR` · `RELEASE` · `CI` · `RELIABILITY` · `TELEMETRY` · `RECOVERY` · `COST_OPERATIONS` | Sideline PIN, GPS check-in, score and clock. Expo `/admin` is where staff edit. The Next portal is read-only oversight | The operator PIN is for internal test only. It is not a public login | Paid game-day coverage and a light game line (M5). No published uptime SLA |
| **Finance** | Money in, the split, receipts, and money out. | `COMMERCE` lead · `CHECKOUT` · `LEDGER` · `RECONCILIATION` · `REFUNDS` · `CONNECT` · `CUSTODIAL` · `RALLY` · `DONATION_THANKS` · `BILLING` · `DRIP` · `WISHLIST` · `RECEIPTS`, with `BACKEND` | Staged Amount → Options → Review Donate popup (90 / 10, optional tip for Tapua'i starts at No tip), gear goals, Rally, receipts. Payouts stay blocked. Drip is off | One credit path: the webhook writes the donation, then the app stops inserting it. Parent is the payee. A server balance before any payout | Drip marketplace (Wave 1). Team gift and booster match (counsel first). Pathway labels only, no fund held here (M7). Filmer cash from Tapua'i's own budget (M11) — nothing in the UI mentions cash |
| **Legal & Compliance** | What the company is allowed to say and do. Counsel decides. Agents place approved words and refuse false claims. | `LEGAL` · `COMPLIANCE` · `PRIVACY_ENGINEERING` · `CONTENT_RIGHTS` | Terms and ack toggles. `DATA_PRIVACY_MAP.md` inventory. No invented SOC 2 or uptime SLA. Conclusions stay in `LEGAL_BRIEFING.md` | Counsel: Privacy Policy, ToS liability, parental consent. Export / deletion product path. Processor list stays honest. Auto-renewal only if Billing lands | Formation, trademark, association letter (L0–L4). DPA for booster/sponsor/school B2B. Measured uptime SLO only after Ops exists. Agents do not file or draft counsel paper |
| **Brand** | The words a parent reads. Donate / donation. No money tied to a play. | `VOICE`, with `BRAND` (Marketing) for the approved message | `pnpm copy:check` on every money screen; review the BRAND-01 tagline "Donate. Elevate. Celebrate." | Run again before a release | Every new money screen, including ones listed as Later |
| **Trust & Safety** | Who may post, what may be reported, and what leaves the public feed. | `TRUST_SAFETY` · `MODERATION` · `ATHLETE_VERIFICATION` · `MINOR_SAFETY`, paired with `CONTENT_RIGHTS`, `LEGAL` and `ADMIN` | Upload confirms permission, sound, and marks. Reports name a reason. Some reasons hide the clip immediately | A human moderation queue before public video of minors | Strikes, appeals, and a filmed-at-the-game badge. Not built |
| **Partnerships** | Schools, families, booster clubs, and sponsors. | `PARTNERSHIPS` · `ROLE_HQ` · `SCHOOL_PARTNERS` · `SPONSOR_ADS`, paired with `LOCAL` and `PROFILE` | Parent, Booster, and Sponsor portals. A guardian approves an athlete's Rally | The parent stays the payee on paper. The payout button stays a stub | Real custodial payout only after Finance has a ledger. Written school permission before a commercial build shows a school mark |
| **Operations** | Game day on the field, under IT infrastructure. | See **IT infrastructure** above | Sideline PIN, GPS check-in, score and clock | The operator PIN is for internal test only | Paid game-day coverage (M5) |
| **Quality** | Whether a change is safe to hand to a tester — automated + product + compliance hygiene. | `QA` · `TEST_AUTOMATION` · `DEVICE_QA` · `VISUAL_QA` | UX-05e photo story + tagline browser evidence (VISUAL_QA, Playwright on Expo web) and native checks (DEVICE_QA). UX-02 small-phone/keyboard/review checks in TESTER_SCRIPT; typecheck, docs, copy, boundaries, comments, Jest, Soft-Wall, Profile, payments, no fake SOC 2 / SLA / trackers-before-consent | Feel check on the preview installs. Export/deletion path once built | A full pass by each department, then the public-beta gate |
| **Marketing** | How families hear about Tapua'i. | `MARKETING` · `GROWTH_ANALYTICS` · `BRAND`, with `PRODUCT` and `VOICE` | Internal messaging and measurement definitions; BRAND-01 approved message "Donate. Elevate. Celebrate." in its approved placements; no external campaigns | Reviewed launch plan after Product/Legal gates | Rally stories from real families, with consent (M10) |
| **Support** | Helping a parent or athlete when something breaks. | `SUPPORT` · `INCIDENT_TRIAGE` | Internal tester triage, compact Donate/upload journeys and menu evidence from TESTER_SCRIPT | Minimal-data support escalation before external users | A help desk after approved launch |

A business call uses the agent named above. A screen call uses the squad (`CALL: HIGHLIGHTS`). Schema, RLS, Storage, and Stripe secrets always include `BACKEND`. Publish-to-app always includes Quality. Money words always include Brand. Anything a parent, a school, or a regulator could read as a promise includes Legal.

See **Functional specialist roster** below for the complete accountable owner map. Existing squad sections remain the detailed surface inventory.

### Design team

**Department:** Design (UX/UI). **Agent:** `DESIGN` (`.claude/agents/design.md`). **Call:** `CALL: DESIGN`.

Design produces the screen. The call names the surface. The agent edits that surface in the app, using the tokens that already exist.

| Job | What Design does |
| --- | --- |
| **Visual system** | Daylight canvas, tab colors, and the springs in `theme/motion.ts`. One palette; shared Daylight menu/page chrome and compact step navigation. |
| **Hierarchy** | One primary action on a sheet. A parent can see what to tap. Loading, empty, and error look different. |
| **Motion** | Uses `SPRING_CARD`, `SPRING_BOUNCE`, `SPRING_FLIP`, `SPRING_PEEK`. No one-off bounce on a button. |
| **Look desk** | Expo `/admin/look`. A draft waits on Publish to app. |
| **Hand-off** | The squad that owns the file keeps the data and the payments. Design does not rewrite those. Aura point math stays with `AURA`. Words stay with Brand. |

**Do not:** start the Later list (share card, backer wall, badges) unless that item was asked for.

**Tooling (2026-10-07):** `DESIGN_TOOLING` (`.claude/agents/design-tooling.md`) owns the MCP workflows in [TOOLING.md](../engineering/TOOLING.md): Figma (user-level) and Canva handoff, Playwright screenshots for `VISUAL_QA`, Expo MCP build status. No production connection or write access without owner approval.

**Owner peek (2026-10-08):** the card behind a sideways swipe on a Highlight (`ReelOwnerPeek`, shell in `ReelPage`) uses the Daylight card geometry and a tier-colored header, with one primary action (Donate when confirmed, else Open full profile) pinned in a footer outside the scroll area, a pinned Close, and a slim header under 380 pt wide. `FOCAL.cyanInk` was darkened to `#00707E` for AA contrast. `HIGHLIGHTS` keeps the swipe gesture math and data; Design owns the card's look.

**UX-02 coverage:** Shared menu/page primitives align rounded cards, accent washes and step indicators. `CHECKOUT` owns donation review/payment; `UPLOAD` owns drafts/rights; `DESIGN` owns appearance; `ACCESSIBILITY` / `DEVICE_QA` verify actual device behavior. `DOCUMENTATION` maintains [MENU_STYLE_MAP.md](../engineering/MENU_STYLE_MAP.md) and synchronizes all team handoffs.

### Engineering team

**Department:** Engineering (dev team). **Lead:** `ENGINEERING` (`.claude/agents/engineering.md`). **Reports to:** `CTO`. **Call:** `CALL: ENGINEERING`.

The dev team produces the app to an industry bar: typed boundaries, least-privilege data access, tests on money/eligibility math, docs in the same turn. **No shortcuts.** The CTO assigns the fix. This lead assigns a specialist on this team. Database changes are assigned by the CTO to `BACKEND`. Security review is `SECURITY`.

| Role | Agent | Call | What they do |
| --- | --- | --- | --- |
| **Engineering lead** | `ENGINEERING` | `CALL: ENGINEERING` | Takes the CTO's assignment and routes it to a specialist on this team. |
| **Database team** | `BACKEND` | `CALL: BACKEND` | Reports to the CTO. Postgres, RLS files, RPCs, migrations, Storage, Realtime, Edge Functions, server Stripe secrets. |
| **Security team** | `SECURITY` | `CALL: SECURITY` | Reports to the CTO. Assigns `RLS_SECURITY` and `SESSION_SECURITY`. |
| **Full-stack developer** | `FULLSTACK` | `CALL: FULLSTACK` | Expo screens, hooks, lib clients, and Expo API routes end to end — without leaking secrets or inventing a second architecture. |
| **Documentation specialist** | `DOCUMENTATION` | `CALL: DOCUMENTATION` | Synchronize affected system docs, all team contracts and code-documentation evidence in the same turn. |
| **Screen squads** | `HIGHLIGHTS` · `LOCAL` · `SPOTLIGHT` · `PROFILE` · `AUTH` · `ADMIN` · `OPERATOR` · `AURA` | `CALL: <SQUAD>` | One surface when the change stays there. |

**Do not:** start a Later item unless it was asked for. Put a Stripe secret in the client. Deploy webhook crediting while the client still inserts `tips`. Apply SQL to the development project unless asked. Claim SOC 2 or publish a fake uptime SLA.

### Legal team

**Department:** Legal & Compliance. **Agents:** `LEGAL` (`.claude/agents/legal.md`) · `COMPLIANCE` (`.claude/agents/compliance.md`). **Calls:** `CALL: LEGAL` · `CALL: COMPLIANCE`.

Legal does not decide the law. A licensed attorney does. This team puts approved words into the app, keeps the issue map honest, and **refuses false claims**. The map is [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md). Privacy inventory is [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md). The public-launch list for this team is [DEPARTMENT_PLANS.md](DEPARTMENT_PLANS.md) (Legal and Compliance). Company paper order is [COMPANY_PHASES.md](../company/COMPANY_PHASES.md) (L0–L4). Do not write a new legal conclusion in those files.

| Job | Now | Next | Later |
| --- | --- | --- | --- |
| **Terms in the app** | `LegalModal` and the ack on Varsity apply and Connect Bank. Version: `LEGAL_TERMS_VERSION`. | Counsel drafts terms, privacy, and parental consent. The app only stores the version they approve. | — |
| **Privacy Policy** | Inventory only (`DATA_PRIVACY_MAP.md`). Not a published Privacy Policy. | Counsel drafts. App links the approved version. | Keep inventory current when tables change. |
| **Data export & deletion** | Not built (`DATA_PRIVACY_MAP` §3.4). | Product + BACKEND + FULLSTACK scope soft-delete / export; COMPLIANCE tracks disclosure of what is kept. | Hard deletes only if counsel and ledger rules allow. |
| **Auto-renewal disclosure** | Checkout creates a one-time PaymentIntent (`createPaymentIntent.ts`). No Stripe Billing renewal or cancel path. Exclusive labels on the Vault and a locked Highlight say one-time Exclusive and name the price with no `/mo` (`data/exclusive.ts`). Booster prices have no period (`formatSponsorDollars`). The profile row does not sell Exclusive. | If Stripe Billing lands, clear pre-buy disclosure and a cancel path before launch. | — |
| **No false SOC 2** | Agents and QA reject invented "SOC 2" / "certified" claims. | Same. | Real audit only if the company buys one. |
| **Cookie / tracker posture** | No analytics/ad SDK found that phones home on first open. Prefer none. | Any tracker stays off until affirmative consent. Reject "accept all or leave" cookie walls. | — |
| **Cap liability in ToS** | Not drafted by agents. | Counsel ToS. | Wire ack to the approved version only. |
| **DPA for business users** | Not started (no school/booster B2B contract desk). | — | When sponsors/schools are real customers, counsel DPA. |
| **Publish processors** | `DATA_PRIVACY_MAP` §2 names Stripe, Supabase, Apple (Sign in with Apple), and Google (OAuth). No analytics or ad SDK in the app dependency lists. | Keep the list honest when a vendor is added. Counsel decides how the Privacy Policy classifies Apple and Google. | Show in Privacy Policy counsel drafts. |
| **ToS tickbox** | Ack on Varsity apply, Connect Bank, and Claim athlete (`RoleSwitcherModal`). Version `LEGAL_TERMS_VERSION` `2026-09-27`. The in-app text is a prototype summary. | Counsel may require ack on sign-up too. | — |
| **Real uptime SLA** | Do not publish 99.x% while Wave 0 hosting is best-effort. | — | Measured SLO only after Ops + paid hosting exist. |
| **Money words** | Compact Donate review retains 90 / 10, No tip default, optional fees, total and held-gift notice. Brand (`VOICE`) checks wording. | Counsel reviews that line and App Store gift rules before live money. | Tax reporting is CPA / payments counsel (B6). |
| **Minors** | Sign-up confirms 13+. Sign in for an existing account is not blocked by that box. Thank-yous presets only. Athlete Rally waits for guardian. | Parent is the payee until counsel signs the design. | 1-on-1 with minors stays off until safety rules are signed. |
| **Footage, sound, and marks** | Upload confirms permission, sound, and marks. Game Day confirms real footage. Photo stories use a photo-permission line (`PHOTO_RIGHTS_VERSION` `2026-10-07`). | Counsel decides whether school marks may appear at all. | Strikes, appeals, filmed-at-the-game badge — not this wave. |
| **Schools and associations** | Demo rosters are not a license to use a school's name or film. | — | Written association / district position before a metro launch. |
| **Company paper** | Stripe stays in test mode. | Counsel retained before filings. | LLC, trademark, patent triage — founder + counsel. Agents do not file. |

**Pairs:** Brand for words on screen. Finance for prices and the split. Trust & Safety for reports. Partnerships for a school or guardian. Engineering (BACKEND / FULLSTACK) for export, deletion, and processors. Quality fails false SOC 2 / fake SLA / trackers-before-consent. Product when counsel must decide before anyone builds. Who may do the next product step, and what stays stopped, is in [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) under "Compliance routing — 2026-10-10".

**Do not:** Rewrite conclusions outside the `<!-- product-facts -->` markers. Put `sk_` in the app. Turn on live Stripe keys. Describe the app as patented, tax-deductible, SOC 2 certified, covered by a fake SLA, or licensed by a school.

### Keep the roster current

When the app or the code changes who owns a screen, what a department does now, or what is next or later, update this file in the same turn:

1. The row in **Business departments** for the department that owns the outcome.
2. The engineering squad section if the fan surface, admin desk, or do-not-touch list moved.
3. `.claude/agents/<file>.md` if that agent's description no longer matches the code.
4. The Legal team table above if the change touches terms, minors, money wording, footage, school marks, company paper, privacy export/deletion, processors, SOC 2 / SLA claims, or trackers.

A feature that ships with a stale department row is not done. This is the same turn as `docs/STATE.md` §4. The rule lives in `.cursor/rules/documentation.mdc`.

---

## Command staff (Grok ALA channel)

These four historical command roles remain a compatibility view of integration responsibilities. Department leads and the specialist roster below are the current dispatch hierarchy.

| Role | Call as | Owns | Does not |
| --- | --- | --- | --- |
| **Ala Facilitator** | `FACILITATOR` | One next ship move. Who is on the call. Product copy (Mālo / Seki / Highlights ⚡). Roadmap. Investor / public memos via `pnpm docs:sync`. | Implement UI. Invent prices, Aura math, or legal conclusions. |
| **Mobile Eng** | Staff for any fan/admin UI department | `apps/mobile` Expo SDK 57. Next portal UI only when `ADMIN` is on the call. | Stripe `sk_` in frontend. `expo-av` for the reel player. NativeWind in mobile. |
| **Backend Eng** | Staff whenever data moves | `schema.sql`, `supabase/*.sql`, RLS, RPCs, Edge Functions, Storage buckets. Keep [SCHEMA.md](../engineering/SCHEMA.md) in the same turn. | Fan chrome, Look copy, Catalog dollar amounts (those are Catalogs + `pnpm docs:sync`). |
| **Ship QA** | `QA` | `pnpm typecheck` · `pnpm docs:check`. Soft-Wall / Profile / Publish-to-app pitfalls. Pass/fail notes. Recapture `docs/company/press/*.png` or mark STALE. | Silent “looks fine”. Shipping a dirty Features draft. |

---

## Engineering squads (call these)

These are not extra companies. They are the Dev team, split by the part of the app they build. The business department that owns the outcome is in the table above.

### HIGHLIGHTS — Highlights ⚡ / Home

**Call:** `HIGHLIGHTS`
**Fan:** `/` (Home, clip search, Local jump, live banner, slang line, Player of the Week popup)
**Admin:** Expo `/admin/highlights` · `/admin/moderation` · `/admin/features` (hype + Home search) · `/admin/look` (Home copy / banner) · `/admin/catalog` (clip category labels)
**Upload UX (owner 2026-10-07):** `UPLOAD` + `DESIGN` own the compact Clip → Details → Review composer; game/account/Vault settings open separately, searchable athlete/game selection replaces expanded lists, and Back keeps the draft. Rights still require explicit confirmation before publishing.
**Photo stories (owner 2026-10-07, UX-05):** `PHOTO_STORIES` (`.claude/agents/photo-stories.md`) owns the photo upload/data flow (`lib/photoStories.ts`) with `UPLOAD`; `PLAYBACK` owns the swipeable feed (`PhotoStoryMedia.tsx`, `useStoryPhotos.ts`); the category label is **Game Day** (stored `game_play`). Contract: [PHOTO_STORIES_DESIGN.md](../engineering/design/PHOTO_STORIES_DESIGN.md).

**What it does:** TikTok-style `expo-video` pager. Seki 🤙 / Aura ⚡ / Flex 💪 rail + double-tap Aura. More sheet (Share / Save / Report). Athlete name opens `/user/[id]`. Upload can also mention up to three accounts; they confirm on their own profile before "With …" shows. Donations stay on the athlete tag. Offline queue for hype / bookmark / report.

| Function | Where |
| --- | --- |
| Feed bar Home, search, and Local | `app/(tabs)/index.tsx` · `useReels` |
| Reel player + hype | `components/Reels/ReelCard.tsx` · `lib/reelVotes.ts` · `theme/hypeFx.ts` |
| Search overlay | `components/Reels/HomeSearchOverlay.tsx` |
| Live scoreboard banner | `components/Reels/LiveMatchBanner.tsx` (pair `LOCAL`) |
| Report / hide | `components/Reels/ReportContentModal.tsx` · `/admin/moderation` |
| Category badges | Catalogs `reelCategories` |

**Do not:** Change Mālo PaymentSheet (`COMMERCE`), match scoring (`LOCAL` / `OPERATOR`), or Profile collage layout (`PROFILE`).

**Pair:** `BACKEND` for `reels` / `saved_reels` / `report_reel`. `QA` after player or telemetry changes.

---

### LOCAL — Game day (matches, polls, boosters)

**Call:** `LOCAL`
**Fan:** `/local` · `/local/game/[id]` · public `/game/[id]`
**Admin:** `/admin/games` · `/admin/polls` · `/admin/boosters` · `/admin/sports` · `/admin/catalog` (region chips + sponsor dollars)
**What it does:** Explore search. Boards: Live Matches, School Polls (`cast_cheer_vote`), Top Boosters (Silver / Gold / Platinum PaymentSheet). Match sheet: feed + roster. Roster name opens `/user/[id]`. Play-card compact Mālo.

| Function | Where |
| --- | --- |
| Hub + Explore | `app/(tabs)/local/index.tsx` · `useLocalSearch` · `search_local_entities` |
| Cheer polls | `components/Local/CheerPollCard.tsx` · `useCheerPoll` |
| Boosters rail | `components/TopAuraBoosters.tsx` · `SponsorshipModal` |
| Match + roster | `app/(tabs)/local/game/[id].tsx` · `useLiveGame` · `useRoster` |
| Scores Realtime | `useLiveScores` · `games` / `game_events` |

**Do not:** Edit Highlight pager (`HIGHLIGHTS`), Spotlight awards (`SPOTLIGHT`), or Drip SKUs (`COMMERCE` / `/admin/drip`).

**Pair:** `OPERATOR` if the scoreboard is wrong on the sideline. `COMMERCE` if PaymentSheet for boosters fails. `PROFILE` if roster → athlete sheet is wrong.

---

### SPOTLIGHT — Player of the Week

**Call:** `SPOTLIGHT`
**Fan:** `/spotlight` · Home launch modal
**Admin:** `/admin/spotlight`
**What it does:** Week / Month / Year board. Watch Full Highlight opens the clip. Athlete sheet only when `player_id` is a real UUID (null seed ids must not invent `spotlight-{id}`). Auto-elect needs Varsity (`athlete_is_varsity_verified`). That's them / Not them tag queue.

| Function | Where |
| --- | --- |
| Tab board | `app/(tabs)/spotlight.tsx` · `useSpotlightBoard` |
| Home popup | `components/Spotlight/SpotlightModal.tsx` · `useActiveSpotlight` |
| Awards + tags | `lib/spotlight.ts` · `lib/tags.ts` · `spotlight_awards` |

**Do not:** Change Varsity rules without `PROFILE` + `BACKEND`. Do not route Watch to a fake user id.

---

### PROFILE — Identity, Crew, Vault, roster

**Call:** `PROFILE`
**Fan:** `/profile` (own hub, hamburger) · `/user/[id]` (public, back) · `/athlete/[id]` redirect
**Admin:** Expo Look · Profile · `/admin/athletes` · `/admin/people` · `/admin/sports` (Stats) · `/admin/wishlist` · Next `/profile`
**What it does:** One `AthleteProfileView` for own and tapped athletes. Hero avatar + picker. Slim Crew. Share & Fund QR (`tapuai.app/gift/{handle}`). Highlights / Stats / Vault pills. Active Team Roster (Claimed = `profiles.player_id`). Join Crew / Drop Mālo / Subscribe hide on your own claimed row. Flip Aura card from hamburger (`profile.showCard`). Varsity ⚡ badge (team code or staff). Legal modal + ack. Role switcher (claim athlete ≠ Varsity). **Edit Profile** (hamburger): bio, social links, display name/username, and per-field Bio / School / Stats / Social-links visibility toggles — hiding is enforced server-side for other users via `profiles_public` (`reels_feed`-style conditional-null view) and `athlete_stats_visible()`, not just a client-side flag.

| Function | Where |
| --- | --- |
| Shared sheet | `components/Profile/AthleteProfileView.tsx` |
| Own vs public | `app/(tabs)/profile.tsx` · `user/[id].tsx` · `lib/roster.ts` `isOwnAthleteSheet` |
| Hamburger | `ProfileMenuSheet.tsx` |
| Edit Profile | `Profile/EditProfileModal.tsx` · `AuthContext.updateProfile` · `lib/socialLinks.ts` |
| Avatar | `ProfileAvatarPicker.tsx` · Storage `avatars` |
| Crew | `useCrew` · `lib/crew.ts` |
| Stats | `AthleteStatsTab.tsx` · `useAthleteStats` (visibility: `athlete_stats_visible()` RLS gate) |
| Vault | `VaultLockCard.tsx` · `lib/vault.ts` |
| Wishlist | `LockerRoomWishlist.tsx` (Chip In = `COMMERCE` + `AUTH`) |
| Varsity | `VerifyAthleteModal.tsx` · `lib/verification.ts` · `VarsityBadge.tsx` |
| QR | `ShareQrModal.tsx` · `/gift/[handle]` |
| Legal | `Legal/LegalModal.tsx` · `lib/legal.ts` |
| Chrome flags | `PROFILE_CHROME_FLAGS` · Look / Next Profile |

**Note:** `profiles_public` is scoped to `bio`/`social_links`/`school_visible` only — it does not close the still-open `docs/product/ROADMAP.md` Phase 0 item 4 concern about the base `profiles` table's public grant exposing `stripe_connect_id` and other status columns.

**Do not:** Change tip amounts or Connect onboarding (`COMMERCE`). Do not auto-set Varsity on school claim. Do not split own Profile into a second layout. Do not build the fan digital signature on the Aura card — that is a later phase (`docs/product/ROADMAP.md` M8).

**Pair:** `AUTH` for Soft-Wall on Crew / Donate / gear-goal donate. `AURA` for the flip card. `HIGHLIGHTS` for collage / own-clip manager.

---

### AUTH — Soft-Wall / browse-first

**Call:** `AUTH`
**Fan:** `SoftWallModal` · `WelcomeOverlay` · `alasports://auth/callback`
**Admin:** Expo Coverage Soft-Wall surface · Next `/auth` · Features Mālo / Crew / Wishlist / Operator flags · `/admin/people` (Demo Fan)
**What it does:** Guests browse Highlights, cards, wishlist. **Donate · Join Crew · gear-goal donate** open the wall (email+password, Demo Fan, Apple, Google, Magic Link) then resume. First-open overlay is not an account wall. Fan row via `handle_new_auth_user` + `ensureFanProfile`.

| Function | Where |
| --- | --- |
| Gate + resume | `context/SoftWallContext.tsx` · `SOFT_WALL_GATES` |
| Modal | `components/Auth/SoftWallModal.tsx` |
| Session | `context/AuthContext.tsx` · `lib/auth.ts` |
| Welcome | `components/Onboarding/WelcomeOverlay.tsx` |
| Oversight | Next `app/auth/page.tsx` · Coverage `soft_wall.*` |

**Do not:** Wall the whole hub. Turn Operator on from this call (`ADMIN` + Publish). Put secrets in the client.

**Pair:** `BACKEND` for Auth providers / `auth_fan_profile.sql`. `QA` for Demo Fan (`demo@tapuai.app`).

---

### COMMERCE — Donations, Drip, Wishlist, Connect, receipts

**Call:** `COMMERCE`
**Fan:** Donate sheet (90 / 10 split line, optional tip for Tapua'i, card-fee box) · Rally card · Say thanks · `/drip` · gear goals · `/receipts` · `/gift/[handle]` · `PayoutSetupCard`
**Admin:** `/admin/money` · `/admin/drip` · `/admin/wishlist` · `/admin/catalog` (dollars) · `/admin/boosters` (sponsor tiers)
**What it does:** Stripe **test** PaymentSheet. Mālo $5 / $10 / $25 / Custom → one `tips` row (where it started: Highlight, QR link, wishlist item, profile, or live play) + 10 Aura per tip dollar. Exclusive subscribe +100 Aura. Drip Buy Now. Wishlist Chip In writes that same `tips` row, then `chip_in_wishlist_item` only moves the item total. Connect Express (JWT Edge `create-stripe-account` only). Custodial payout from `profiles.stripe_connect_id`. Legal ack required before Connect and Varsity apply. The prototype terms (`LEGAL_TERMS_VERSION`) and the Mālo sheet say we keep that gift record and use it for receipts, athlete accounting, and to see which parts of the app bring in support.

| Function | Where |
| --- | --- |
| Checkout | `TipSheetModal` Amount / Options / Review frame · `TipCheckout` state/selection · `hooks/useTipCheckout.ts` payment execution |
| Connect | `hooks/useStripeConnect.ts` · Edge `create-stripe-account` |
| Payout | `app/api/create-payout+api.ts` · `PayoutSetupCard` |
| Drip | `app/(tabs)/drip.tsx` · `GearCard` · `ProductSheet` · `useDripCatalog` |
| Receipts | `app/(tabs)/receipts.tsx` · `useFanTipHistory` |
| Rally goals | `components/Rally/` (`RallyCard`, `CreateRallySheet`) · `useRally` · `lib/rallies.ts` (with `PROFILE`; guardian approval with `ROLE_HQ`) |
| Say thanks | `components/Thanks/ThanksPicker` · `Profile/ReceivedMaloPanel` · `useDonationThanks` · `lib/donationThanks.ts` (presets only — `LEGAL` row S) |
| Optional tip | `TipCheckout` chips · `data/malo.ts` `PLATFORM_TIP_*` · `tips.platform_tip_cents` · revenue source `tip` |
| Catalogs | `/admin/catalog` then `pnpm docs:sync` |

**Do not:** Put `sk_` or `EXPO_PUBLIC_STRIPE_SECRET_KEY` under `src/frontend/`. Trust a client `destinationAccountId`. Change legal copy (`LEGAL`).

**Pair:** `BACKEND` for PaymentIntent / Connect. `AUTH` if guests cannot resume checkout. `FACILITATOR` if prices change (`pnpm docs:sync`).

---

### AURA — Tiers, trading card, Look canvas

**Call:** `AURA`
**Fan:** Flip Aura card · Top Boosters peek · hype bursts
**Admin:** `/admin/look` (theme + Profile chrome + copy) · `/admin/features` (hype buttons)
**What it does:** 7-tier palette (Slate Silver → Celestial Prism). `add_user_aura`. Skia `GlowingNeonBorder` on the card. Daylight canvas + `TAB_ACCENTS`. Look drafts wait on **Publish to app**.

| Function | Where |
| --- | --- |
| Math / tiers | `lib/aura.ts` · RPC `add_user_aura` / `get_aura_tier` |
| Card | `AuraTradingCard.tsx` · `Effects/GlowingNeonBorder.tsx` |
| Motion / focals | `theme/motion.ts` · `constants/theme.ts` |
| Look desk | `components/Admin/LookTool.tsx` |

**Do not:** Change Aura-per-dollar without Facilitator + `pnpm docs:sync`. Restyle Highlights video chrome away from Midnight Obsidian without Look review.

---

### ADMIN — Control plane (Expo desks + Next portal)

**Call:** `ADMIN`
**Fan:** none (operators with `profiles.is_admin` or Studio unlock)
**Expo `/admin` groups:**

| Group | Desks | Saves |
| --- | --- | --- |
| Operations | games, sports, polls, boosters, **publish** | Instant except Publish-to-app |
| Content | highlights, spotlight, moderation | Instant |
| Commerce | drip, wishlist, money | Instant |
| Audience | athletes, schools, people | Instant |
| Growth | reports, feedback, **coverage** | Instant |
| System | features, look, **catalogs**, studio | Features / Look / catalogs wait on **Publish** |
| Hidden | lab (JSON), qa | Deep links |

**Next `pnpm admin` (`http://localhost:3001`):** **Read-only oversight, no edit affordance anywhere.** Home · Trends · Audience · Revenue · Health · Product (`PORTAL`). Departments (`/manage`) and Analytics (`/analytics`, `ANALYST`) are header links, not extra tabs. Analytics is eight dashboards built from a measure catalog on `get_admin_reports` and `get_company_revenue_summary`. Home charts the 7-day series from `get_admin_reports`. Revenue uses `get_company_revenue_summary`. Features and Profile show `app_runtime_config` via `FlagStatusList` (plain badges, no toggle). Every write — flags, Games, Drip, Catalogs, People verify/grant-admin, everything — happens only in Expo `/admin`.

| Function | Where |
| --- | --- |
| Expo shell | `app/(admin)/admin/*` · `AdminShell` · `AdminLensContext` |
| Features flags | `FeaturesTool.tsx` · `lib/runtime.ts` · `APP_RUNTIME_FLAG_GROUPS` |
| Coverage map | `lib/adminCoverage.ts` (source of fan-control inventory) |
| Next portal (read-only) | `apps/admin-portal/` · `components/PortalShell.tsx`'s `FlagStatusList` |

**Do not:** Publish a dirty draft "to see if it works" on a live project. Add any write path (toggle, form, RPC call) to the Next portal — it is deliberately read-only; if a desk needs editing, that happens in Expo `/admin`, not by porting it onto Next.

**Pair:** Department that owns the fan surface. `QA` after Publish.

---

### BACKEND — Database engineer

**Call:** `BACKEND` (`.claude/agents/backend.md`)
**Fan:** all (invisible)
**Admin:** n/a (SQL editor / MCP)
**What it does:** Database engineer for Tapua'i. Canonical `apps/mobile/src/backend/db/schema.sql`. Migrations under `supabase/migrations/`, then copied onto schema. RLS in schema.sql — least privilege, no convenience `using (true)` on money or PII. Storage `reels` / `reel_vault` / `game_highlights` / `avatars`. Realtime publications. Edge JWT functions. Personal-data columns stay listed in [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md).

**Same-turn docs:** [SCHEMA.md](../engineering/SCHEMA.md) · [SYSTEM_OVERVIEW.md](../engineering/SYSTEM_OVERVIEW.md) if tables/RPCs/architecture move. `pnpm docs:check` must name every public table and `create or replace function`.

**Do not:** Change UI copy. Skip SCHEMA.md. Apply SQL to development unless asked. Enable webhook ledger crediting while the client still inserts `tips`. Add `is_verified` writes the hosted DB cannot accept without a fallback.

### FULLSTACK — Full-stack developer

**Call:** `FULLSTACK` (`.claude/agents/fullstack.md`)
**Fan:** whatever surface the feature needs
**Admin:** Expo desks when the feature has one
**What it does:** End-to-end features across Expo routes, components, hooks, lib clients, and Expo API routes. Industry practice: typed RPC boundaries, no secret leakage, empty vs error UI, JSDoc on hooks/network helpers. Pairs BACKEND when data moves.

**Do not:** Client-only "fixes" for RLS holes. Credit money from PaymentSheet alone when Phase 1a says webhook-or-server. Add trackers before consent. Claim SOC 2 or invent an uptime SLA.

### COMPLIANCE — Privacy & commercial controls

**Call:** `COMPLIANCE` (`.claude/agents/compliance.md`)
**Fan:** Terms / privacy / consent surfaces
**Admin:** none (issue map + gates)
**What it does:** Tracks Privacy Policy wiring, export/deletion scope, auto-renewal disclosure, no false SOC 2, cookie/tracker posture, ToS liability and DPA needs, processor list, ToS tickbox, honest uptime claims. Does not draft counsel paper.

**Do not:** Invent Privacy Policy / ToS / DPA / SLA text. Soften a real gap without naming it in LEGAL_BRIEFING or DATA_PRIVACY_MAP.

---

### OPERATOR — Sideline console

**Call:** `OPERATOR`
**Fan:** `/operator` · `/operator/[gameId]` · `/operator/scorer`
**Admin:** `/admin/games` · `/admin/sports` (points, periods, callouts) · Features `layouts.operatorConsole` (default **off** until Publish)
**What it does:** PIN claim, GPS check-in, live score buttons, clock, sideline callouts fans see on Local.

**Do not:** Enable Operator from AUTH. Change sport point math without Sports desk + SCHEMA if RPCs move.

---

### ROLE_HQ — Parent / Booster / Sponsor portals

**Call:** `ROLE_HQ`
**Fan:** `/parent` · `/booster` · `/sponsor`
**Admin:** `/admin/people` (consent, verify) · `/admin/athletes` (CSV) · `/admin/boosters` (ads) · `/admin/money` (custodial)
**What it does:** Parent consent + custodial payout. Booster roster CSV + verify. Sponsor sideline / rivalry boards.

**Do not:** Mix with fan Profile chrome. Features flags `layouts.parentHq` / `boosterHq` / `sponsorHq`.

---

### VOICE — Donation language

**Call:** `VOICE` (`.claude/agents/voice.md`)
**Owns:** every word about money on screen and in public docs — Donate / donation, the "who gets it, what for, anything taken out" answers, no performance ties, warm thank-yous that keep people donating.
**Source:** [VOICE.md](../product/VOICE.md). CI gate: `pnpm copy:check` (`scripts/check-copy.mjs`).
**Pair:** LEGAL for terms, tax and fee wording; COMMERCE for prices and splits; `BRAND` for the approved message "Donate. Elevate. Celebrate." (BRAND-01). Run after any copy change and before every release.

---

### LEGAL — Legal team (implementation only)

The business write-up is [Legal team](#legal-team) above. This squad only places approved words.

**Call:** `LEGAL` (`.claude/agents/legal.md`)
**Fan:** `LegalModal` · `LegalAckToggle` on Varsity apply + Connect Bank
**Source of conclusions:** [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) `<!-- product-facts -->` blocks. Do **not** rewrite legal conclusions outside those markers. Price/PIN/Aura changes: `pnpm docs:sync`.
**Same turn:** if terms, minors, the split, footage, or school marks moved, update the Legal team table above.

---

### QA — Ship gate

**Call:** `QA` after every department that touched schema, runtime flags, Soft-Wall, Profile, or payments.

Checklist:

1. `pnpm typecheck`
2. `pnpm docs:check`
3. `pnpm --filter @tapuai/mobile test` (Jest — add a test alongside any new money/Aura/eligibility pure-logic file)
4. Soft-Wall: guest can browse; Donate / Join Crew / gear-goal donate resume after sign-in
5. Profile: own hub hamburger; `/user/[id]` back; no self Mālo
6. Features: draft vs published; did anyone hit **Publish to app** on purpose?
7. Press screenshots STALE if Reel / Local / Profile chrome moved
8. Compliance flows (see the fix/testing roadmap): Mālo works from a Profile with no clip open; a frozen athlete/school rejects Mālo and exclusive checkout at the database level; new sign-up requires the 13+ confirmation and existing accounts are never retroactively blocked by it.
9. Device smoke: run the relevant role slice (fan/athlete/parent/operator/booster) from `docs/engineering/AUDIT_REPORT.md`'s "Device smoke" checklist on a real device — the web preview can't test PaymentSheet, camera upload, or haptics.

Full detail and rationale: `.claude/agents/qa.md` (the executable copy of this checklist) and [ROADMAP.md](../product/ROADMAP.md) (the phased roadmap this checklist tracks).

---

## Fan sections → department

| Fan section | Route | Department | Features flag (if any) |
| --- | --- | --- | --- |
| Home · Highlights ⚡ | `/` | `HIGHLIGHTS` | `tabs.home` |
| Activity | `/activity` | `HIGHLIGHTS` (thank-you rows pair `COMMERCE`) | `tabs.activity` |
| Local | `/local` | `LOCAL` | `tabs.local` |
| Match | `/local/game/[id]` | `LOCAL` | `layouts.liveMatches` |
| Spotlight | `/spotlight` | `SPOTLIGHT` | `tabs.spotlight` |
| Drip | `/drip` | `COMMERCE` (tab off until Wave 1) | `tabs.drip` (default false) |
| Profile (own) | `/profile` | `PROFILE` | `tabs.profile` |
| Public athlete | `/user/[id]` | `PROFILE` | — |
| Gift flyer | `/gift/[handle]` | `PROFILE` + `COMMERCE` | — |
| Receipts | `/receipts` | `COMMERCE` | `layouts.receipts` |
| Upload + | FAB | `HIGHLIGHTS` | `tabs.upload` |
| Soft-Wall | modal | `AUTH` | `buttons.malo` / `crew` / `layouts.wishlist` |
| Operator | `/operator` | `OPERATOR` | `layouts.operatorConsole` |
| Parent HQ | `/parent` | `ROLE_HQ` | `layouts.parentHq` |
| Booster HQ | `/booster` | `ROLE_HQ` | `layouts.boosterHq` |
| Sponsor HQ | `/sponsor` | `ROLE_HQ` | `layouts.sponsorHq` |
| Expo Admin | `/admin/*` | `ADMIN` + owning department | — |
| Next portal | `localhost:3001` | `ADMIN` | same `app_runtime_config` |

---

## Expo admin desks → department

| Desk | Path | Department |
| --- | --- | --- |
| Home / Overview | `/admin` | `ADMIN` |
| Games | `/admin/games` | `LOCAL` + `OPERATOR` |
| Sports | `/admin/sports` | `LOCAL` + `OPERATOR` + `PROFILE` (Stats) |
| Polls | `/admin/polls` | `LOCAL` |
| Boosters | `/admin/boosters` | `LOCAL` + `ROLE_HQ` |
| Publish | `/admin/publish` | `ADMIN` + `QA` |
| Highlights | `/admin/highlights` | `HIGHLIGHTS` |
| Spotlight | `/admin/spotlight` | `SPOTLIGHT` |
| Moderation | `/admin/moderation` | `HIGHLIGHTS` |
| Drip | `/admin/drip` | `COMMERCE` |
| Wishlist | `/admin/wishlist` | `PROFILE` + `COMMERCE` |
| Money | `/admin/money` | `COMMERCE` |
| Athletes | `/admin/athletes` | `PROFILE` |
| Schools | `/admin/schools` | `PROFILE` + `LOCAL` |
| People | `/admin/people` | `AUTH` + `PROFILE` (Varsity / admin grant) |
| Reports | `/admin/reports` | `ADMIN` |
| Feedback | `/admin/feedback` | `ADMIN` |
| Coverage | `/admin/coverage` | `ADMIN` (inventory for all departments) |
| Features | `/admin/features` | `ADMIN` (flags for every department) |
| Look | `/admin/look` | `AURA` + `PROFILE` chrome |
| Catalogs | `/admin/catalog` | `COMMERCE` + `FACILITATOR` (`docs:sync`) |
| Studio | `/admin/studio` | `ADMIN` |
| Lab / QA | `/admin/lab` · `/admin/qa` | `ADMIN` + `QA` (hidden) |

Next desks: `/` Home (`PORTAL`) · `/analytics` Analytics (`ANALYST`) · `/reports` Trends (`ADMIN`) · `/audience` Audience (`PORTAL`) · `/money` Revenue (`COMMERCE`) · `/operations` Health (`PORTAL`) · `/product` Product (`PORTAL`) · `/manage` Departments (`PORTAL`) · `/auth` Sign-in (`AUTH`) · `/profile` Profile chrome (`PROFILE`) · `/features` flag board (`ADMIN`) · `/people` roster oversight (`AUTH` / `PROFILE`).

---

## Shared rules for every call

1. Expo SDK **57** docs before new APIs.
2. JSDoc on new hooks, network helpers, and complex components (`@purpose` / `@param` / `@returns` / `@sideEffects`).
3. Schema or architecture in the same turn: `docs/engineering/SYSTEM_OVERVIEW.md` · `docs/engineering/SCHEMA.md` · `CHANGELOG.md` as required by `.cursor/rules/documentation.mdc`.
4. Folder law: routes only in `apps/mobile/app/`; UI in `src/frontend/components/`; no new `GameContext`.
5. Never commit `.env.local`.
6. One primary owner per task; name dependency specialists and an independent reviewer for cross-functional work.
7. If the change moves a screen, a department's Now / Next / Later, or a legal surface, update **Business departments** and the matching squad in this file, and the agent file, in the same turn. See [Keep the roster current](#keep-the-roster-current).


---

## Specialist operating contract

**Aligned:** 2026-10-09. **Registry:** `.claude/agents/registry.json`. Agent definitions describe available roles; they are not evidence that agents have run or features are complete. This roster does not hire people or staff a live moderation desk. The hierarchy is responsibility and escalation routing. Which model runs an agent is a separate field in that agent's file and in the registry. The bar for each department is [EXPERT_STANDARDS.md](EXPERT_STANDARDS.md).

1. Read STATE before work, then AGENTS, CONVENTIONS and the relevant schema/privacy/voice/architecture docs. Use repo-root paths. Verify stale statements against current evidence; distinguish written, applied to staging, applied to development and tested.
2. One app fix is assigned by `CTO` to one lead. That lead assigns one accountable specialist, with explicit acceptance criteria, exact files, dependency owners and an independent reviewer where financial or security behavior changes. The specialist reports to the lead. The lead reports the fix to the CTO. Role drift, protocol conflicts, and priority questions go to `VP_OPERATIONS`. When a role, protocol, or priority changes, `VP_OPERATIONS` updates the agent definition, the registry, TEAMS, the hierarchy, and the queue in the same turn. Each lead is the expert for that team and rejects untested, undocumented, or overly broad work. A local test pass is not hosted proof. A written migration is not applied SQL. `QA` can reject the result. Leads and reviewers may overlap path ownership; each functional task has one primary specialist.
3. Coordinate shared-file edits before writing. Never overwrite existing work. Root/session integration owns STATE/ROADMAP/queue aggregation unless explicitly assigned. Schema changes still require migration, canonical schema, SCHEMA, migration README and privacy inventory updates in the same change.
4. **Wave 0 gates:** Stripe test mode; payouts blocked; no parallel webhook/client donation crediting; Drip fan tab off; guest browsing remains; Next portal remains read-only and Expo admin owns writes. A Next or Later assignment is preparation until dependencies and owner/legal/release gates are met.
5. No role authorizes applying hosted SQL, deploying functions, publishing runtime flags/builds/campaigns, contacting others, enabling live money, buying services or making legal decisions. Continue local reviewable work; escalate concrete dependent action to the session lead under current authorization.
6. For changed behavior run relevant existing gates and focused tests. Known machine limits stay explicit: blocked registry, Expo web native binary, untappable simulator and staging-only migrations. Use STATE §3 direct-node/local-bin commands when pnpm fails. Device, hosted SQL and counsel checks remain **not run** until evidence exists.
7. Report task ID, changed files, behavior/why, exact executed checks and results, unverified dependencies, remaining risks, next owner and completion status. QA owns the final gate and can reject; a prepared checklist is not a test pass.
8. Update the registry, call sheet, hierarchy and agent definition together for role changes. Keep practical functions split; do not create an agent for every helper or hook. CI's `agents:check` validates unique calls, definition files, parent graph, existing ownership paths and document entries. Leads review semantic ownership; the structural guard cannot prove a task description is correct.

9. Pair every active specialist with `DOCUMENTATION` for same-turn documentation synchronization. Feature owners supply exact behavior, changed APIs and verification evidence; DOCUMENTATION updates affected team/agent definitions, architecture, tester journeys, STATE and CHANGELOG. Preserve generated facts and approved legal conclusions.

## Functional specialist roster

**91 callable agents**, coordinated by the CTO, who reports to the Facilitator. `VP_OPERATIONS` (VP of Operations) reports to the CTO and keeps roles, protocols, and priorities current. All rows map to actionable definitions; exact Now/Next/Later tasks live in each definition. Existing product surface sections above remain the route inventory.

| Call | Department | Reports to | Owns / primary function | Definition |
| --- | --- | --- | --- | --- |
| `ACCESSIBILITY` | Design | `DESIGN` | Audit screen-reader labels, focus order, touch targets, contrast, text scaling and reduced motion. | [accessibility.md](../../.claude/agents/accessibility.md) |
| `ACCOUNT_TAGS` | Engineering | `UPLOAD` | Account mention request/confirm/hide lifecycle, honest RPC errors and concurrent three-tag limit | [account-tags.md](../../.claude/agents/account-tags.md) |
| `ACTIVITY` | Engineering | `HIGHLIGHTS` | Own activity rows, pagination, actor navigation and empty/error states. | [activity.md](../../.claude/agents/activity.md) |
| `ADMIN` | Engineering | `ENGINEERING` | Expo write control plane and read-only Next oversight | [admin.md](../../.claude/agents/admin.md) |
| `ANALYST` | Engineering | `ADMIN` | Read-only measure catalog and eight analytics dashboards. | [analyst.md](../../.claude/agents/analyst.md) |
| `API` | Engineering | `ENGINEERING` | Own request validation, JWT verification, authorization, typed responses and server error boundaries. | [api.md](../../.claude/agents/api.md) |
| `ATHLETE_STATS` | Engineering | `PROFILE` | Own athlete bio/stat/social visibility and sport-specific stat shapes. | [athlete-stats.md](../../.claude/agents/athlete-stats.md) |
| `ATHLETE_VERIFICATION` | Trust and Safety | `TRUST_SAFETY` | Own claim/vouch/school confirmation ladder, token validity and verified badge semantics. | [athlete-verification.md](../../.claude/agents/athlete-verification.md) |
| `AURA` | Engineering | `ENGINEERING` | Aura tiers and card reward math | [aura.md](../../.claude/agents/aura.md) |
| `AUTH` | Engineering | `ENGINEERING` | Guest browse, sign-in and role flow integration | [auth.md](../../.claude/agents/auth.md) |
| `BACKEND` | Database | `CTO` | Database architecture and migration/security integration | [backend.md](../../.claude/agents/backend.md) |
| `BILLING` | Finance | `COMMERCE` | Own current one-time Exclusive purchase semantics and future recurring billing design. | [billing.md](../../.claude/agents/billing.md) |
| `BRAND` | Marketing | `MARKETING` | Own the approved message "Donate. Elevate. Celebrate." and its consistent use in the approved placements; VOICE reviews money words, LEGAL reviews claims. | [brand.md](../../.claude/agents/brand.md) |
| `CATALOGS` | Engineering | `ADMIN` | Own sport/region/category/price catalog consistency and generated product facts. | [catalogs.md](../../.claude/agents/catalogs.md) |
| `CHECKOUT` | Finance | `COMMERCE` | Own staged Amount / Options / Review donation UI, PaymentSheet/native-web differences, quote arithmetic, fees and payment failure handling. | [checkout.md](../../.claude/agents/checkout.md) |
| `CI` | IT infrastructure | `OPERATIONS` | Own reproducible local/CI gates, workspace dependency consistency and agent/doc validation. | [ci.md](../../.claude/agents/ci.md) |
| `COMMERCE` | Finance | `CTO` | Financial design and payment specialist integration | [commerce.md](../../.claude/agents/commerce.md) |
| `COMPLIANCE` | Legal and Compliance | `CTO` | Privacy, commercial disclosures and evidence-backed claims | [compliance.md](../../.claude/agents/compliance.md) |
| `CONNECT` | Finance | `COMMERCE` | Own JWT-gated Express links, bank onboarding state and verification/payout readiness. | [connect.md](../../.claude/agents/connect.md) |
| `CONTENT_RIGHTS` | Legal and Compliance | `LEGAL` | Own implementation of approved filming, audio, mark permissions and rights-report language. | [content-rights.md](../../.claude/agents/content-rights.md) |
| `COST_OPERATIONS` | IT infrastructure | `OPERATIONS` | Wave budgets, free quotas, media bandwidth and vendor cost evidence | [cost-operations.md](../../.claude/agents/cost-operations.md) |
| `CTO` | Office of the CTO | `FACILITATOR` | Assign every app fix to one department lead, review the evidence, and reject shortcuts. | [cto.md](../../.claude/agents/cto.md) |
| `CREW` | Engineering | `PROFILE` | Own Join Crew, follow counts, self-action restrictions and sign-in resume. | [crew.md](../../.claude/agents/crew.md) |
| `CUSTODIAL` | Finance | `COMMERCE` | Own guardian approval, payee relationship, age handover and server payout policy invariants. | [custodial.md](../../.claude/agents/custodial.md) |
| `DATABASE_MIGRATIONS` | Database | `BACKEND` | Keep canonical schema, append-only migration order, rollback notes and schema documentation consistent. | [database-migrations.md](../../.claude/agents/database-migrations.md) |
| `DESIGN` | Design | `CTO` | Visual design and interaction integration | [design.md](../../.claude/agents/design.md) |
| `DESIGN_TOOLING` | Design | `DESIGN` | Own MCP/design-tool workflows (`.mcp.json`, TOOLING.md): Figma/Canva handoff, Playwright screenshot setup, Expo MCP build tooling; no production or write access without owner approval. | [design-tooling.md](../../.claude/agents/design-tooling.md) |
| `DEVICE_QA` | Quality | `QA` | Own real-device fan/athlete/guardian/operator/booster journey evidence. | [device-qa.md](../../.claude/agents/device-qa.md) |
| `DISCOVERY` | Engineering | `LOCAL` | Local, team and Highlight search, pagination and eligibility-filtered discovery | [discovery.md](../../.claude/agents/discovery.md) |
| `DOCUMENTATION` | Engineering | `ENGINEERING` | Synchronize code comments, system docs, team ownership and verified handoff evidence across departments. | [documentation.md](../../.claude/agents/documentation.md) |
| `DONATION_THANKS` | Finance | `COMMERCE` | Own preset-only thanks, donor/athlete linkage and optional thank-you clip references. | [donation-thanks.md](../../.claude/agents/donation-thanks.md) |
| `DRIP` | Finance | `COMMERCE` | Own marketplace catalog, order lifecycle and unavailable/retry presentation. | [drip.md](../../.claude/agents/drip.md) |
| `ENGINEERING` | Engineering | `CTO` | Technical architecture, typed contracts and specialist integration | [engineering.md](../../.claude/agents/engineering.md) |
| `FILMER_REWARDS` | Engineering | `HIGHLIGHTS` | Own Filmed by credit, Props/Aura noncash rewards and Top Filmers eligibility. | [filmer-rewards.md](../../.claude/agents/filmer-rewards.md) |
| `FULLSTACK` | Engineering | `ENGINEERING` | Cross-feature implementation and end-to-end integration | [fullstack.md](../../.claude/agents/fullstack.md) |
| `GROWTH_ANALYTICS` | Marketing | `MARKETING` | Own measurement definitions for browsing, claim, upload and donation conversion. | [growth-analytics.md](../../.claude/agents/growth-analytics.md) |
| `HIGHLIGHTS` | Engineering | `ENGINEERING` | Highlights feed and media specialist integration | [highlights.md](../../.claude/agents/highlights.md) |
| `INCIDENT_TRIAGE` | Support | `SUPPORT` | Own severity classification, reproduction evidence and financial/security escalation routing. | [incident-triage.md](../../.claude/agents/incident-triage.md) |
| `LEADERBOARDS` | Engineering | `AURA` | Own donor/filmer ranking aggregation, windows, ties and privacy-safe display. | [leaderboards.md](../../.claude/agents/leaderboards.md) |
| `LEDGER` | Finance | `COMMERCE` | Own immutable financial events, exactly-once credits, revenue/owed balances and lifecycle invariants. | [ledger.md](../../.claude/agents/ledger.md) |
| `LEGAL` | Legal and Compliance | `CTO` | Approved legal wording and counsel decision tracking | [legal.md](../../.claude/agents/legal.md) |
| `LOCAL` | Engineering | `ENGINEERING` | Game-day fan surfaces and live engagement integration | [local.md](../../.claude/agents/local.md) |
| `MARKETING` | Marketing | `CTO` | Own consented family-story positioning and accurate release communications. | [marketing.md](../../.claude/agents/marketing.md) |
| `MINOR_SAFETY` | Trust and Safety | `TRUST_SAFETY` | Own age gates, guardian consent evidence, restricted communication and safety acceptance criteria. | [minor-safety.md](../../.claude/agents/minor-safety.md) |
| `MOBILE_PERFORMANCE` | Engineering | `ENGINEERING` | Feed rendering, media memory, startup and measured interaction performance | [mobile-performance.md](../../.claude/agents/mobile-performance.md) |
| `MODERATION` | Trust and Safety | `TRUST_SAFETY` | Own report reasons, immediate-hide versus review threshold, review evidence and appeals design. | [moderation.md](../../.claude/agents/moderation.md) |
| `MOTION` | Design | `DESIGN` | Maintain motion tokens, haptics, sheet geometry and reduced-motion behavior. | [motion.md](../../.claude/agents/motion.md) |
| `NOTIFICATIONS` | Engineering | `CREW` | crew_push_queue privacy, deduplication and authorized delivery design | [notifications.md](../../.claude/agents/notifications.md) |
| `OFFLINE` | Engineering | `ENGINEERING` | Own durable action queue, retry policy, duplicate prevention and logout boundary behavior. | [offline.md](../../.claude/agents/offline.md) |
| `ONBOARDING` | Engineering | `AUTH` | Own first-open onboarding, 13+ acknowledgement, athlete claim and pending action resume. | [onboarding.md](../../.claude/agents/onboarding.md) |
| `OPERATIONS` | IT infrastructure | `CTO` | Coordinate staging readiness, releases, reliability, observability and game-day operations. | [operations.md](../../.claude/agents/operations.md) |
| `OPERATOR` | IT infrastructure | `OPERATIONS` | Sideline PIN/check-in/score/clock console | [operator.md](../../.claude/agents/operator.md) |
| `PARTNERSHIPS` | Partnerships | `CTO` | Coordinate guardian, school, booster and sponsor requirements without inventing permissions. | [partnerships.md](../../.claude/agents/partnerships.md) |
| `PHOTO_STORIES` | Engineering | `HIGHLIGHTS` | Own photo story upload and data flow: 1–10 photos, reorder, per-photo descriptions, `set_reel_photos` client and story photo reads. | [photo-stories.md](../../.claude/agents/photo-stories.md) |
| `PLAYBACK` | Engineering | `HIGHLIGHTS` | Own expo-video playback lifecycle, pager resource use, signed URL resolution and 3-second view counting. | [playback.md](../../.claude/agents/playback.md) |
| `POLLS` | Engineering | `LOCAL` | Own cheer eligibility, vote math, poll lifecycle and offline vote semantics. | [polls.md](../../.claude/agents/polls.md) |
| `PORTAL` | Engineering | `ADMIN` | Read-only home dashboard and the six portal tabs. | [portal.md](../../.claude/agents/portal.md) |
| `PRIVACY_ENGINEERING` | Legal and Compliance | `COMPLIANCE` | Own privacy data flow inventory, visibility, export/deletion design and processor mapping implementation. | [privacy-engineering.md](../../.claude/agents/privacy-engineering.md) |
| `PRODUCT` | Product | `CTO` | Translate the family donation and recruitment mission into acceptance criteria and dependencies. | [product.md](../../.claude/agents/product.md) |
| `PROFILE` | Engineering | `ENGINEERING` | Own/public athlete identity and feature integration | [profile.md](../../.claude/agents/profile.md) |
| `QA` | Quality | `CTO` | Independent final verification gate | [qa.md](../../.claude/agents/qa.md) |
| `RALLY` | Finance | `COMMERCE` | Own guardian-approved donation goals, progress aggregation and fill celebration. | [rally.md](../../.claude/agents/rally.md) |
| `REALTIME` | Engineering | `ENGINEERING` | Own subscription lifecycle, live score/event consistency and reconnect behavior. | [realtime.md](../../.claude/agents/realtime.md) |
| `RECEIPTS` | Finance | `COMMERCE` | Donor receipt/history access, payment status and fee/split disclosure | [receipts.md](../../.claude/agents/receipts.md) |
| `RECONCILIATION` | Finance | `COMMERCE` | Own Stripe-event versus ledger reconciliation, discrepancies, receipts and revenue reporting evidence. | [reconciliation.md](../../.claude/agents/reconciliation.md) |
| `RECOVERY` | IT infrastructure | `OPERATIONS` | Migration rollback, backup/restore evidence and data recovery runbooks | [recovery.md](../../.claude/agents/recovery.md) |
| `REFUNDS` | Finance | `COMMERCE` | Own refund/dispute lifecycle design and reversal effects on revenue, entitlements and owed funds. | [refunds.md](../../.claude/agents/refunds.md) |
| `RELEASE` | IT infrastructure | `OPERATIONS` | Own preview profiles, environment binding, signing/device eligibility and rollback artifact evidence. | [release.md](../../.claude/agents/release.md) |
| `RELIABILITY` | IT infrastructure | `OPERATIONS` | Own failure recovery, incident runbooks, dependency availability and measured service objectives. | [reliability.md](../../.claude/agents/reliability.md) |
| `RESEARCH` | Product | `PRODUCT` | Test family, athlete, guardian, filmer and operator journeys using consented feedback. | [research.md](../../.claude/agents/research.md) |
| `RLS_SECURITY` | Security | `SECURITY` | Audit grants, RLS, security-definer RPCs, storage policies and ownership boundaries. | [rls-security.md](../../.claude/agents/rls-security.md) |
| `ROLE_HQ` | Partnerships | `PARTNERSHIPS` | Parent, booster and sponsor role portal integration | [role-hq.md](../../.claude/agents/role-hq.md) |
| `ROSTERS` | Engineering | `LOCAL` | Own roster claim identity, team search, CSV import validation and athlete navigation. | [rosters.md](../../.claude/agents/rosters.md) |
| `RUNTIME_CONFIG` | Engineering | `ADMIN` | Own draft/published flag states, pause behavior, role lenses and fan control coverage. | [runtime-config.md](../../.claude/agents/runtime-config.md) |
| `SCHOOL_PARTNERS` | Partnerships | `PARTNERSHIPS` | Own school onboarding requirements, AD/coach confirmation workflow and marks permission records design. | [school-partners.md](../../.claude/agents/school-partners.md) |
| `SECURITY` | Security | `CTO` | Critical review of RLS, sessions, secrets and storage authorization. Assigns `RLS_SECURITY` and `SESSION_SECURITY`. | [security.md](../../.claude/agents/security.md) |
| `SESSION_SECURITY` | Security | `SECURITY` | Own JWT/session handling, role boundaries, OAuth redirect integrity and server identity checks. | [session-security.md](../../.claude/agents/session-security.md) |
| `SHARED_CONTRACTS` | Engineering | `ENGINEERING` | Shared RPC/domain types, generated database type provenance and mobile/admin contract parity | [shared-contracts.md](../../.claude/agents/shared-contracts.md) |
| `SHARING` | Engineering | `PROFILE` | Own public athlete QR, share links, deep links and safe preview content. | [sharing.md](../../.claude/agents/sharing.md) |
| `SPONSOR_ADS` | Partnerships | `PARTNERSHIPS` | Own approved sponsor placement, booster tier display and role portal consistency. | [sponsor-ads.md](../../.claude/agents/sponsor-ads.md) |
| `SPOTLIGHT` | Engineering | `ENGINEERING` | Awards board, real athlete IDs and tag queue | [spotlight.md](../../.claude/agents/spotlight.md) |
| `STORAGE` | Database | `BACKEND` | Public versus private bucket policies, MIME/size controls, signed URLs and deletion lifecycle | [storage.md](../../.claude/agents/storage.md) |
| `SUPPORT` | Support | `CTO` | Own help/runbook content, tester intake taxonomy and guardian-safe issue handling. | [support.md](../../.claude/agents/support.md) |
| `TELEMETRY` | IT infrastructure | `OPERATIONS` | Own bounded telemetry payloads, data minimization, dashboard interpretation and logging failure behavior. | [telemetry.md](../../.claude/agents/telemetry.md) |
| `TEST_AUTOMATION` | Quality | `QA` | Own meaningful regression, boundary/security and finance invariant checks. | [test-automation.md](../../.claude/agents/test-automation.md) |
| `TRUST_SAFETY` | Trust and Safety | `CTO` | Coordinate moderation, identity, minor safety and rights safeguards as independent release gates. | [trust-safety.md](../../.claude/agents/trust-safety.md) |
| `UPLOAD` | Engineering | `HIGHLIGHTS` | Own compact Clip → Details → Review composer, optional settings, draft navigation, compression, upload progress and athlete/account consent. | [upload.md](../../.claude/agents/upload.md) |
| `VAULT` | Engineering | `PROFILE` | Own private video entitlements, signed playback URLs and subscription-request access. | [vault.md](../../.claude/agents/vault.md) |
| `VISUAL_QA` | Quality | `QA` | Record browser/visual regression evidence with the Playwright MCP on Expo web (narrow widths, large text, screenshots) in AUDIT_REPORT; complements DEVICE_QA and ACCESSIBILITY. | [visual-qa.md](../../.claude/agents/visual-qa.md) |
| `VOICE` | Brand | `CTO` | Donation language and honest product copy | [voice.md](../../.claude/agents/voice.md) |
| `VP_OPERATIONS` | Office of the CTO | `CTO` | Keep every role, protocol, and priority current in the same turn. Check that each team is doing the job its definition names. Report drift to the CTO. | [vp-operations.md](../../.claude/agents/vp-operations.md) |
| `WISHLIST` | Finance | `COMMERCE` | Gear-goal configuration, donation allocation and confirmed progress | [wishlist.md](../../.claude/agents/wishlist.md) |

### Critical task routing

| Work | Primary owner | Required pair / independent gate |
| --- | --- | --- |
| Roadmap / Wave 0 acceptance | PRODUCT | RESEARCH, department lead, QA |
| Donation quote and native wallet | CHECKOUT | API, LEDGER, VOICE; QA |
| Authoritative credit path | LEDGER | API, BACKEND, CHECKOUT, RECONCILIATION; RLS_SECURITY + QA |
| Refund/dispute reversal | REFUNDS | LEDGER, RECONCILIATION, LEGAL; QA |
| Account links / payout readiness | CONNECT | SESSION_SECURITY, CUSTODIAL; RLS_SECURITY + QA |
| Parent payee / handover / amount owed | CUSTODIAL | MINOR_SAFETY, LEDGER, BACKEND, LEGAL; QA |
| Account-tag / operator SQL preparation | DATABASE_MIGRATIONS | UPLOAD or OPERATOR, RLS_SECURITY; QA |
| Player / upload / private entitlement | PLAYBACK / UPLOAD / VAULT respectively | BACKEND, CONTENT_RIGHTS, BILLING; DEVICE_QA |
| Feed / thank-you / Rally | ACTIVITY / DONATION_THANKS / RALLY respectively | HIGHLIGHTS, LEDGER, MINOR_SAFETY; QA |
| Offline actions / live scores | OFFLINE / REALTIME respectively | LOCAL, OPERATOR, AUTH; TEST_AUTOMATION |
| Privacy export / deletion | PRIVACY_ENGINEERING | PRODUCT, BACKEND, LEGAL, COMPLIANCE; RLS_SECURITY + QA |
| School confirm / public moderation | ATHLETE_VERIFICATION / MODERATION respectively | SCHOOL_PARTNERS, CONTENT_RIGHTS, MINOR_SAFETY; QA |
| Flags / catalogs / admin oversight | RUNTIME_CONFIG / CATALOGS respectively; ADMIN integrates | Owning surface, BACKEND, VOICE; QA |
| Build / CI / service failure / metrics | RELEASE / CI / RELIABILITY / TELEMETRY respectively | OPERATIONS, SUPPORT; QA |
| Accessibility / animation | ACCESSIBILITY / MOTION respectively | DESIGN, surface owner; DEVICE_QA |
| Photo story upload / feed (UX-05) | PHOTO_STORIES + UPLOAD / HIGHLIGHTS + PLAYBACK respectively | DATABASE_MIGRATIONS, CONTENT_RIGHTS, MINOR_SAFETY, DESIGN, ACCESSIBILITY; QA + VISUAL_QA + DEVICE_QA |
| Approved message / MCP tooling | BRAND / DESIGN_TOOLING respectively | VOICE, LEGAL / ENGINEERING; no publication or production access without owner approval |
| Partner / launch / support plans | PARTNERSHIPS / MARKETING / SUPPORT respectively | PRODUCT, LEGAL, VOICE; no external contact without authorization |

### Dispatch next work

Use [WORK_QUEUE.md](WORK_QUEUE.md) for evidence, dependencies and assigned execution tasks when available. A roster assignment means ownership; queue status identifies what actually ran. The immediate sequence is baseline verification, current staging/device blockers, security and money architecture preparation, then public-launch prerequisites. Current code and hosted status remain in [STATE.md](../STATE.md).
