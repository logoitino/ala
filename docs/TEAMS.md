# Tapua'i department call sheet

Use this when you **call a team** to fix or update one area. Command staff stays four people (Facilitator · Mobile · Backend · Ship QA). Product work is split into **departments** so a call has one owner, one fan surface, and a hard “do not touch” list.

**Repo:** `~/Desktop/ala-sports` · GitHub `logoitino/ala` · pnpm monorepo.  
**Copy:** money on screen is **Donate / donation** ([VOICE.md](VOICE.md)). "Mālo!" is only a thank-you. **Seki** / **Highlights ⚡**. Persistence still `tips` / `reels` / `useTipCheckout`.  
**Facts:** [DOCUMENTATION.md](../DOCUMENTATION.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [SCHEMA.md](SCHEMA.md) · [ALA_TEAM_BRIEF.md](ALA_TEAM_BRIEF.md) · [CHANGELOG.md](../CHANGELOG.md). Do not invent prices, Aura math, or legal conclusions — run `pnpm docs:sync` or read [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md).

---

## How to call a team

Paste this at the top of the chat (Grok ALA, Cursor, or Slack):

```text
CALL: <DEPARTMENT>
Symptom: <what is broken or what to add>
Fan surface: <tab or route>
Admin desk: <Expo /admin/... or Next /...>
Do not: <other departments>
Read first: docs/TEAMS.md#<anchor>
Gate: pnpm typecheck && pnpm docs:check
```

Say the department in plain words. These calls have an agent that does the work:

`CALL: DESIGN` · `CALL: ENGINEERING` · `CALL: LEGAL` · `CALL: VOICE` · `CALL: QA`

`CALL: COMMERCE` is Finance. `CALL: ROLE_HQ` is Partnerships. `CALL: HIGHLIGHTS` is the Home squad inside Engineering. `FACILITATOR` is you. Marketing and Support have no agent yet.

Screen squads, when the change is only in one place: `HIGHLIGHTS` · `LOCAL` · `SPOTLIGHT` · `PROFILE` · `AUTH` · `COMMERCE` · `AURA` · `ADMIN` · `BACKEND` · `OPERATOR` · `ROLE_HQ`.

If the bug spans two departments, **Facilitator** names a lead and a pair. Schema / RLS / RPC / Storage / Stripe secrets always pull **Backend**. Publish-to-app and docs honesty always pull **QA**.

### Dispatching in Claude Code

Every department except `FACILITATOR` (that's whoever is driving the session — human or the top-level Claude Code assistant, reading this file to route) is a real subagent at `.claude/agents/<code>.md` (lowercase, `ROLE_HQ` → `role-hq.md`). Ask Claude Code to dispatch one directly — "CALL: BACKEND, fix the anon RLS grants" works, or explicitly say "use the backend subagent." Each subagent's file already embeds its fan surface, admin desk, key files, do-not-touch list, and pairing rules from this page, plus any currently-open backlog items relevant to that department, so a call does not need to re-explain context. Subagents run with `Read, Edit, Write, Bash, Grep, Glob` (LEGAL and QA are more restricted — see their files) and are expected to self-gate with `pnpm typecheck` / `pnpm docs:check` before reporting done. Keep this file and the `.claude/agents/*.md` files in sync when a department's surface changes — the agent files are the executable copy, this file is the readable one.

Cursor works in this same tree alongside Claude Code. Claude owns the security sweeps and `docs/ROADMAP.md`; Cursor should extend that work, not replace it or revive a closed audit item. Claude should keep Cursor's later fixes: Account Settings waits for the hamburger modal to dismiss before Soft-Wall opens, and profile photos plus booster logos upload as image bytes to `avatars` (`sponsors/` for logos), not as a `text/plain` blob and not into the video-only `game_highlights` bucket. New Vault / Exclusive videos upload to the private `reel_vault` bucket as `reelvault:{path}` and play through `resolvePlaybackUrl`; free Highlights stay on the public `reels` bucket. That bucket is a bridge only. The video host is still Cloudflare Stream or Mux — pick the cheaper one that still plays well — and neither tool should build transcoding, a CDN, or analytics on Supabase Storage while that choice is open. When either tool lands a schema or copy change, the other treats `docs/SCHEMA.md` and `docs/ROADMAP.md` as the current story.

---

## Business departments

These are the departments a company actually has. The names under **Builds it** are the engineering agents that do the work today. Claude Code reads `.claude/agents/<file>.md`. Cursor uses the same name (`ROLE_HQ` → `role-hq`). A business department can have more than one agent. A new feature does not get a new department or a new agent if one of these already owns it.

**Now** is Wave 0: internal test, Stripe test cards, staging. **Next** has to exist before a public build or live money, and it is not this week's build. **Later** is named so it is not forgotten. Do not start it because it is listed.

| Department | What the business owns | Builds it | Now | Next | Later |
| --- | --- | --- | --- | --- | --- |
| **Product** | What ships, for whom, and in what order. Roadmap and the one next move. | `FACILITATOR` (the person driving the session, not a code agent) | Test wave: uploads, donations, Rally, on the staging preview | Owner decisions in STATE §6 before live money | Company formation stays with the founder |
| **Design (UX/UI)** | How every screen looks, moves, and reads. | `DESIGN` (`.claude/agents/design.md`). `AURA` keeps tier math | Daylight canvas, tab colors, springs, one primary action per sheet, empty vs error | Feel check on a real phone with Quality (M9) | Share card, backer wall, badges, a bigger rivalry takeover (M8). Fan digital signature on the Aura card |
| **Engineering** | The app, the database, and the admin tools. | `ENGINEERING` (`.claude/agents/engineering.md`) leads the squads | Home, Activity, Local, Spotlight, Profile, sign-in, sideline scorer, Expo admin. Account tags on a Highlight (SQL not applied). Staging has the September SQL and the content-rights SQL. Drip tab is off | Magic-link redirect on staging. `reel_vault` so Vault video plays. Apply account-tag SQL when the owner asks. Real admin and operator sessions. Pick Cloudflare Stream or Mux; do not build a video platform on Storage | Drip marketplace (Wave 1). Fan digital signature on the Aura card. Low-view lane (M3). Train Like Me / Ask an athlete (M4). Showcase link (M6). Game-day gigs (M5, Wave 3). No licensed music picker |
| **Finance** | Money in, the split, receipts, and money out. | `COMMERCE`, with `BACKEND` on the ledger | Donate sheet (90 / 10, optional tip for Tapua'i starts at No tip), gear goals, Rally, receipts. Payouts stay blocked. Drip is off | One credit path: the webhook writes the donation, then the app stops inserting it. Parent is the payee. A server balance before any payout | Drip marketplace (Wave 1). Team gift and booster match (counsel first). Pathway labels only, no fund held here (M7). Filmer cash from Tapua'i's own budget (M11) — nothing in the UI mentions cash |
| **Legal & Compliance** | What the company is allowed to say and do. Counsel decides. The agent only places approved words in the app. | `LEGAL` | Terms and ack toggles. Conclusions stay in `LEGAL_BRIEFING.md` | Counsel reviews the 90 / 10 line and App Store gift rules before live money | Formation, trademark, association letter (company phases L0–L4). The agent does not write those |
| **Brand** | The words a parent reads. Donate / donation. No money tied to a play. | `VOICE` | `pnpm copy:check` on every money screen | Run again before a release | Every new money screen, including ones listed as Later |
| **Trust & Safety** | Who may post, what may be reported, and what leaves the public feed. | `HIGHLIGHTS` for the report flow, `LEGAL` for the rules, `ADMIN` when a person has to review | Upload confirms permission, sound, and marks. Reports name a reason. Some reasons hide the clip immediately | A human moderation queue before public video of minors | Strikes, appeals, and a filmed-at-the-game badge. Not built |
| **Partnerships** | Schools, families, booster clubs, and sponsors. | `ROLE_HQ`, with `LOCAL` for game-day boosters and `PROFILE` for the athlete | Parent, Booster, and Sponsor portals. A guardian approves an athlete's Rally | The parent stays the payee on paper. The payout button stays a stub | Real custodial payout only after Finance has a ledger. Written school permission before a commercial build shows a school mark |
| **Operations** | Running a game day and the control plane. | `OPERATOR` and `ADMIN` | Sideline PIN, GPS check-in, score and clock. Expo `/admin` is where staff edit. The Next portal is read-only oversight | The operator PIN is for internal test only. It is not a public login | Paid game-day coverage and a light game line (M5). Billing and marketing desks were scoped, not started |
| **Quality** | Whether a change is safe to hand to a tester. | `QA` | Typecheck, docs, copy, tests, sign-in, Profile, payments | Feel check on the preview installs | A full pass by each department, then the public-beta gate |
| **Marketing** | How families hear about Tapua'i. | Nobody yet. Product and Brand hold the words until a desk exists | Not staffed. Do not invent campaigns | — | Rally stories from real families, with consent (M10) |
| **Support** | Helping a parent or athlete when something breaks. | Nobody yet | Not staffed. Testers use the people already on the project | — | A help desk, after there are users outside the test group |

A business call uses the agent named above. A screen call uses the squad (`CALL: HIGHLIGHTS`). Schema, RLS, Storage, and Stripe secrets always include `BACKEND`. Publish-to-app always includes Quality. Money words always include Brand. Anything a parent, a school, or a regulator could read as a promise includes Legal.

### Design team

**Department:** Design (UX/UI). **Agent:** `DESIGN` (`.claude/agents/design.md`). **Call:** `CALL: DESIGN`.

Design produces the screen. The call names the surface. The agent edits that surface in the app, using the tokens that already exist.

| Job | What Design does |
| --- | --- |
| **Visual system** | Daylight canvas, tab colors, and the springs in `theme/motion.ts`. One palette. |
| **Hierarchy** | One primary action on a sheet. A parent can see what to tap. Loading, empty, and error look different. |
| **Motion** | Uses `SPRING_CARD`, `SPRING_BOUNCE`, `SPRING_FLIP`, `SPRING_PEEK`. No one-off bounce on a button. |
| **Look desk** | Expo `/admin/look`. A draft waits on Publish to app. |
| **Hand-off** | The squad that owns the file keeps the data and the payments. Design does not rewrite those. Aura point math stays with `AURA`. Words stay with Brand. |

**Do not:** start the Later list (share card, backer wall, badges) unless that item was asked for.

### Engineering team

**Department:** Engineering. **Agent:** `ENGINEERING` (`.claude/agents/engineering.md`). **Call:** `CALL: ENGINEERING`.

Engineering produces the code. The lead reads `docs/STATE.md`, then either does the change or uses the squad that owns the files: `HIGHLIGHTS`, `LOCAL`, `SPOTLIGHT`, `PROFILE`, `AUTH`, `ADMIN`, `BACKEND`, `OPERATOR`. `AURA` is tier math when Design is not leading the screen.

**Do not:** start a Later item unless it was asked for. Put a Stripe secret in the client. Deploy the webhook. Apply SQL to the development project unless asked.

### Legal team

**Department:** Legal & Compliance. **Agent:** `LEGAL` (`.claude/agents/legal.md`). **Call:** `CALL: LEGAL`.

Legal does not decide the law. A licensed attorney does. This team puts the approved words into the app and keeps the issue map honest. The map is [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md). The order of company paper is [COMPANY_PHASES.md](COMPANY_PHASES.md) (L0–L4). Do not write a new legal conclusion in either file.

| Job | Now | Next | Later |
| --- | --- | --- | --- |
| **Terms in the app** | `LegalModal` and the ack on Varsity apply and Connect Bank. The version the app asks people to accept is `LEGAL_TERMS_VERSION`. | Counsel drafts terms, privacy, and parental consent. The app only stores the version they approve. | — |
| **Money words** | The donate sheet states the 90 / 10 split. Brand (`VOICE`) checks the wording. Legal does not invent the split. | Counsel reviews that line and the App Store gift rule before live money. | Tax reporting is a CPA and payments counsel question (company phase B6). |
| **Minors** | New sign-up confirms 13+. Thank-yous are presets, with no free-text reply to a donor. A Rally an athlete starts waits for a guardian. | A minor does not get their own payout account. The parent is the payee, on paper, until counsel signs the design. | 1-on-1 video with minors stays off until the safety rules in the roadmap are signed. |
| **Footage, sound, and marks** | Upload confirms permission, original or licensed sound, and that a school logo, team mark, or TV broadcast is not treated as ours. Game play also confirms real footage. | Counsel still decides whether a school mark may appear at all. | Strikes, appeals, and a filmed-at-the-game badge are not built. A licensed music catalog is not priced and is not this wave. |
| **Schools and associations** | Demo rosters are not a license to use a school's name or film. | — | A written association or district position before one metro is talked to as a launch (company phase, before live money). |
| **Company paper** | Not started. Stripe stays in test mode. | Counsel retained before filings. | LLC, trademark, and patent triage. The founder does this with counsel. The agent does not file anything. |

**Pairs:** Brand for words on screen. Finance for prices and the split. Trust & Safety for reports and hiding a clip. Partnerships for a school or guardian. Product when counsel has to decide before anyone builds.

**Do not:** Rewrite conclusions outside the `<!-- product-facts -->` markers. Put `sk_` in the app. Turn on live Stripe keys. Describe the app as patented, tax-deductible, or licensed by a school.

### Keep the roster current

When the app or the code changes who owns a screen, what a department does now, or what is next or later, update this file in the same turn:

1. The row in **Business departments** for the department that owns the outcome.
2. The engineering squad section if the fan surface, admin desk, or do-not-touch list moved.
3. `.claude/agents/<file>.md` if that agent's description no longer matches the code.
4. The Legal team table above if the change touches terms, minors, money wording, footage, school marks, or company paper.

A feature that ships with a stale department row is not done. This is the same turn as `docs/STATE.md` §4. The rule lives in `.cursor/rules/documentation.mdc`.

---

## Command staff (Grok ALA channel)

These four roles already exist. They do not own a tab by themselves — they staff a department call.

| Role | Call as | Owns | Does not |
| --- | --- | --- | --- |
| **Ala Facilitator** | `FACILITATOR` | One next ship move. Who is on the call. Product copy (Mālo / Seki / Highlights ⚡). Roadmap. Investor / public memos via `pnpm docs:sync`. | Implement UI. Invent prices, Aura math, or legal conclusions. |
| **Mobile Eng** | Staff for any fan/admin UI department | `apps/mobile` Expo SDK 57. Next portal UI only when `ADMIN` is on the call. | Stripe `sk_` in frontend. `expo-av` for the reel player. NativeWind in mobile. |
| **Backend Eng** | Staff whenever data moves | `schema.sql`, `supabase/*.sql`, RLS, RPCs, Edge Functions, Storage buckets. Keep [SCHEMA.md](SCHEMA.md) in the same turn. | Fan chrome, Look copy, Catalog dollar amounts (those are Catalogs + `pnpm docs:sync`). |
| **Ship QA** | `QA` | `pnpm typecheck` · `pnpm docs:check`. Soft-Wall / Profile / Publish-to-app pitfalls. Pass/fail notes. Recapture `docs/press/*.png` or mark STALE. | Silent “looks fine”. Shipping a dirty Features draft. |

---

## Engineering squads (call these)

These are not extra companies. They are the Dev team, split by the part of the app they build. The business department that owns the outcome is in the table above.

### HIGHLIGHTS — Highlights ⚡ / Home

**Call:** `HIGHLIGHTS`  
**Fan:** `/` (Home · All · Seki, clip search, live banner, slang line, Player of the Week popup)  
**Admin:** Expo `/admin/highlights` · `/admin/moderation` · `/admin/features` (hype + Home search) · `/admin/look` (Home copy / banner) · `/admin/catalog` (clip category labels)  
**What it does:** TikTok-style `expo-video` pager. Seki 🤙 / Aura ⚡ / Flex 💪 rail + double-tap Aura. More sheet (Share / Save / Report). Athlete name opens `/user/[id]`. Upload can also mention up to three accounts; they confirm on their own profile before "With …" shows. Donations stay on the athlete tag. Offline queue for hype / bookmark / report.

| Function | Where |
| --- | --- |
| Feed mix pills Home / All / Seki | `app/(tabs)/index.tsx` · `useReels` |
| Reel player + hype | `components/ReelCard.tsx` · `lib/reelVotes.ts` · `theme/hypeFx.ts` |
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

**Note:** `profiles_public` is scoped to `bio`/`social_links`/`school_visible` only — it does not close the still-open `docs/ROADMAP.md` Phase 0 item 4 concern about the base `profiles` table's public grant exposing `stripe_connect_id` and other status columns.

**Do not:** Change tip amounts or Connect onboarding (`COMMERCE`). Do not auto-set Varsity on school claim. Do not split own Profile into a second layout. Do not build the fan digital signature on the Aura card — that is a later phase (`docs/ROADMAP.md` M8).

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
| Checkout | `hooks/useTipCheckout.ts` · `MaloTipModal` / `TipSheetModal` |
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

**Next `pnpm admin` (`http://localhost:3001`):** **Read-only oversight, no edit affordance anywhere.** Overview · **Reports** (`get_admin_reports`) · **Money** (`get_company_revenue_summary`) · Soft-Wall · Profile · Features · People. All seven desks display live Supabase state; Features/Profile show `app_runtime_config` via `FlagStatusList` (plain badges, no toggle). Every write — flags, Games, Drip, Catalogs, People verify/grant-admin, everything — happens only in Expo `/admin`.

| Function | Where |
| --- | --- |
| Expo shell | `app/(admin)/admin/*` · `AdminShell` · `AdminLensContext` |
| Features flags | `FeaturesTool.tsx` · `lib/runtime.ts` · `APP_RUNTIME_FLAG_GROUPS` |
| Coverage map | `lib/adminCoverage.ts` (source of fan-control inventory) |
| Next portal (read-only) | `apps/admin-portal/` · `components/PortalShell.tsx`'s `FlagStatusList` |

**Do not:** Publish a dirty draft "to see if it works" on a live project. Add any write path (toggle, form, RPC call) to the Next portal — it is deliberately read-only; if a desk needs editing, that happens in Expo `/admin`, not by porting it onto Next.

**Pair:** Department that owns the fan surface. `QA` after Publish.

---

### BACKEND — Data, Auth, Storage, RPCs

**Call:** `BACKEND`  
**Fan:** all (invisible)  
**Admin:** n/a (SQL editor / MCP)  
**What it does:** Canonical `apps/mobile/src/backend/db/schema.sql`. Incremental `supabase/*.sql`. RLS in schema.sql. Storage `reels` / `game_highlights` / `avatars`. Realtime `games`, `game_events`, `cheer_polls`, `app_runtime_config`. Edge JWT functions.

**Same-turn docs:** [SCHEMA.md](SCHEMA.md) · [DOCUMENTATION.md](../DOCUMENTATION.md) if tables/RPCs/architecture move. `pnpm docs:check` must name every public table and `create or replace function`.

**Do not:** Change UI copy. Skip SCHEMA.md. Add `is_verified` writes that the hosted DB cannot accept without a fallback.

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
**Source:** [VOICE.md](VOICE.md). CI gate: `pnpm copy:check` (`scripts/check-copy.mjs`).  
**Pair:** LEGAL for terms, tax and fee wording; COMMERCE for prices and splits. Run after any copy change and before every release.

---

### LEGAL — Legal team (implementation only)

The business write-up is [Legal team](#legal-team) above. This squad only places approved words.

**Call:** `LEGAL` (`.claude/agents/legal.md`)  
**Fan:** `LegalModal` · `LegalAckToggle` on Varsity apply + Connect Bank  
**Source of conclusions:** [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) `<!-- product-facts -->` blocks. Do **not** rewrite legal conclusions outside those markers. Price/PIN/Aura changes: `pnpm docs:sync`.  
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
9. Device smoke: run the relevant role slice (fan/athlete/parent/operator/booster) from `docs/AUDIT_REPORT.md`'s "Device smoke" checklist on a real device — the web preview can't test PaymentSheet, camera upload, or haptics.

Full detail and rationale: `.claude/agents/qa.md` (the executable copy of this checklist) and [ROADMAP.md](ROADMAP.md) (the phased roadmap this checklist tracks).

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

Next desks: `/` Overview · `/reports` behavior (`ADMIN`) · `/money` ledger (`COMMERCE`) · `/auth` Soft-Wall (`AUTH`) · `/profile` Profile chrome (`PROFILE`) · `/features` full flag board (`ADMIN`) · `/people` roster oversight (`AUTH` / `PROFILE`).

---

## Shared rules for every call

1. Expo SDK **57** docs before new APIs.
2. JSDoc on new hooks, network helpers, and complex components (`@purpose` / `@param` / `@returns` / `@sideEffects`).
3. Schema or architecture in the same turn: `DOCUMENTATION.md` · `docs/SCHEMA.md` · `CHANGELOG.md` as required by `.cursor/rules/documentation.mdc`.
4. Folder law: routes only in `apps/mobile/app/`; UI in `src/frontend/components/`; no new `GameContext`.
5. Never commit `.env.local`.
6. One department per call unless Facilitator names a pair.
7. If the change moves a screen, a department's Now / Next / Later, or a legal surface, update **Business departments** and the matching squad in this file, and the agent file, in the same turn. See [Keep the roster current](#keep-the-roster-current).
