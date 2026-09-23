# Tapua'i department call sheet

Use this when you **call a team** to fix or update one area. Command staff stays four people (Facilitator · Mobile · Backend · Ship QA). Product work is split into **departments** so a call has one owner, one fan surface, and a hard “do not touch” list.

**Repo:** `~/Desktop/ala-sports` · GitHub `logoitino/ala` · pnpm monorepo.  
**Copy:** UI **Mālo** / **Seki** / **Highlights ⚡**. Persistence still `tips` / `reels` / `useTipCheckout`.  
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

Department codes: `FACILITATOR` · `HIGHLIGHTS` · `LOCAL` · `SPOTLIGHT` · `PROFILE` · `AUTH` · `COMMERCE` · `AURA` · `ADMIN` · `BACKEND` · `OPERATOR` · `ROLE_HQ` · `QA` · `LEGAL`.

If the bug spans two departments, **Facilitator** names a lead and a pair. Schema / RLS / RPC / Storage / Stripe secrets always pull **Backend**. Publish-to-app and docs honesty always pull **QA**.

### Dispatching in Claude Code

Every department except `FACILITATOR` (that's whoever is driving the session — human or the top-level Claude Code assistant, reading this file to route) is a real subagent at `.claude/agents/<code>.md` (lowercase, `ROLE_HQ` → `role-hq.md`). Ask Claude Code to dispatch one directly — "CALL: BACKEND, fix the anon RLS grants" works, or explicitly say "use the backend subagent." Each subagent's file already embeds its fan surface, admin desk, key files, do-not-touch list, and pairing rules from this page, plus any currently-open backlog items relevant to that department, so a call does not need to re-explain context. Subagents run with `Read, Edit, Write, Bash, Grep, Glob` (LEGAL and QA are more restricted — see their files) and are expected to self-gate with `pnpm typecheck` / `pnpm docs:check` before reporting done. Keep this file and the `.claude/agents/*.md` files in sync when a department's surface changes — the agent files are the executable copy, this file is the readable one.

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

## Product departments (call these)

### HIGHLIGHTS — Highlights ⚡ / Home

**Call:** `HIGHLIGHTS`  
**Fan:** `/` (Home · All · Seki, clip search, live banner, slang line, Player of the Week popup)  
**Admin:** Expo `/admin/highlights` · `/admin/moderation` · `/admin/features` (hype + Home search) · `/admin/look` (Home copy / banner) · `/admin/catalog` (clip category labels)  
**What it does:** TikTok-style `expo-video` pager. Seki 🤙 / Aura ⚡ / Flex 💪 rail + double-tap Aura. More sheet (Share / Save / Report). Athlete name opens `/user/[id]`. Offline queue for hype / bookmark / report.

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
**What it does:** One `AthleteProfileView` for own and tapped athletes. Hero avatar + picker. Slim Crew. Share & Fund QR (`tapuai.app/gift/{handle}`). Highlights / Stats / Vault pills. Active Team Roster (Claimed = `profiles.player_id`). Join Crew / Drop Mālo / Subscribe hide on your own claimed row. Flip Aura card from hamburger (`profile.showCard`). Varsity ⚡ badge (team code or staff). Legal modal + ack. Role switcher (claim athlete ≠ Varsity).

| Function | Where |
| --- | --- |
| Shared sheet | `components/Profile/AthleteProfileView.tsx` |
| Own vs public | `app/(tabs)/profile.tsx` · `user/[id].tsx` · `lib/roster.ts` `isOwnAthleteSheet` |
| Hamburger | `ProfileMenuSheet.tsx` |
| Avatar | `ProfileAvatarPicker.tsx` · Storage `avatars` |
| Crew | `useCrew` · `lib/crew.ts` |
| Stats | `AthleteStatsTab.tsx` · `useAthleteStats` |
| Vault | `VaultLockCard.tsx` · `lib/vault.ts` |
| Wishlist | `LockerRoomWishlist.tsx` (Chip In = `COMMERCE` + `AUTH`) |
| Varsity | `VerifyAthleteModal.tsx` · `lib/verification.ts` · `VarsityBadge.tsx` |
| QR | `ShareQrModal.tsx` · `/gift/[handle]` |
| Legal | `Legal/LegalModal.tsx` · `lib/legal.ts` |
| Chrome flags | `PROFILE_CHROME_FLAGS` · Look / Next Profile |

**Do not:** Change tip amounts or Connect onboarding (`COMMERCE`). Do not auto-set Varsity on school claim. Do not split own Profile into a second layout.

**Pair:** `AUTH` for Soft-Wall on Crew / Mālo / Chip In. `AURA` for the flip card. `HIGHLIGHTS` for collage / own-clip manager.

---

### AUTH — Soft-Wall / browse-first

**Call:** `AUTH`  
**Fan:** `SoftWallModal` · `WelcomeOverlay` · `alasports://auth/callback`  
**Admin:** Expo Coverage Soft-Wall surface · Next `/auth` · Features Mālo / Crew / Wishlist / Operator flags · `/admin/people` (Demo Fan)  
**What it does:** Guests browse Highlights, cards, wishlist. **Mālo · Join Crew · Chip In** open the wall (email+password, Demo Fan, Apple, Google, Magic Link) then resume. First-open overlay is not an account wall. Fan row via `handle_new_auth_user` + `ensureFanProfile`.

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

### COMMERCE — Mālo, Drip, Wishlist, Connect, receipts

**Call:** `COMMERCE`  
**Fan:** Mālo sheets · `/drip` · Wishlist Chip In · `/receipts` · `/gift/[handle]` · `PayoutSetupCard`  
**Admin:** `/admin/money` · `/admin/drip` · `/admin/wishlist` · `/admin/catalog` (dollars) · `/admin/boosters` (sponsor tiers)  
**What it does:** Stripe **test** PaymentSheet. Mālo $5 / $10 / $25 / Custom → `tips` + 10 Aura per tip dollar. Exclusive subscribe +100 Aura. Drip Buy Now. Wishlist Chip In. Connect Express (JWT Edge `create-stripe-account` only). Custodial payout from `profiles.stripe_connect_id`. Legal ack required before Connect and Varsity apply.

| Function | Where |
| --- | --- |
| Checkout | `hooks/useTipCheckout.ts` · `MaloTipModal` / `TipSheetModal` |
| Connect | `hooks/useStripeConnect.ts` · Edge `create-stripe-account` |
| Payout | `app/api/create-payout+api.ts` · `PayoutSetupCard` |
| Drip | `app/(tabs)/drip.tsx` · `GearCard` · `ProductSheet` · `useDripCatalog` |
| Receipts | `app/(tabs)/receipts.tsx` · `useFanTipHistory` |
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

### LEGAL — Terms / NIL (Facilitator + briefing only)

**Call:** `LEGAL` (Facilitator leads; engineers implement copy hooks only)  
**Fan:** `LegalModal` · `LegalAckToggle` on Varsity apply + Connect Bank  
**Source of conclusions:** [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) `<!-- product-facts -->` blocks. Do **not** rewrite legal conclusions outside those markers. Price/PIN/Aura changes: `pnpm docs:sync`.

---

### QA — Ship gate

**Call:** `QA` after every department that touched schema, runtime flags, Soft-Wall, Profile, or payments.

Checklist:

1. `pnpm typecheck`
2. `pnpm docs:check`
3. `pnpm --filter @tapuai/mobile test` (Jest — add a test alongside any new money/Aura/eligibility pure-logic file)
4. Soft-Wall: guest can browse; Mālo/Crew/Chip In resume after sign-in
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
| Local | `/local` | `LOCAL` | `tabs.local` |
| Match | `/local/game/[id]` | `LOCAL` | `layouts.liveMatches` |
| Spotlight | `/spotlight` | `SPOTLIGHT` | `tabs.spotlight` |
| Drip | `/drip` | `COMMERCE` | `tabs.drip` |
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
