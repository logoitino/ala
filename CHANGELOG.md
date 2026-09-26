# Changelog

All notable product and schema shifts for Tapua'i (`ala-sports`). Keep this file current when landing features.

## 2026-09-25

### Compliance warnings on user actions

- Mālo, bank connect, parent consent, cheer polls, highlight upload, and account creation now say where the product is still a prototype: test payments, no live custodial payout, cheers are not a prize, and uploads need rights to the clip. These notices do not claim the app is legally approved.

### Sign-in and account creation

- Google’s `400 validation_failed` is the Auth server saying the Google provider is not enabled. The sheet now says that in words when Auth returns it.
- Email **Create account** requires the 13+ confirmation and an 8-character password. The new row is always a fan. The client does not send a role.

## 2026-09-24

### Company phases

- `docs/COMPANY_PHASES.md` is the operating order for security, billing, and legal work (LLC, trademark, patent triage, counsel paper). It points at the roadmap and the legal briefing. It does not clear live Stripe.

## 2026-09-23

### Vault video playback

- Highlight upload in Expo Go skips `react-native-compressor`. That package needs NitroModules, which Expo Go does not ship, and importing it was the redbox on pick. The original clip still uploads.
- New Vault / Exclusive uploads go to a private `reel_vault` bucket. The row stores `reelvault:{path}` instead of a public URL. Entitled playback uses a one-hour signed URL, gated by `can_read_reel_vault`. Free Highlights stay on the public `reels` bucket. Older Vault files that were uploaded as public URLs are unchanged.

### Profile photo and sign-in sheet

- Account Settings → Sign in waits until the hamburger sheet’s native modal has dismissed before opening Soft-Wall, so iOS no longer drops the sign-in sheet while the app still treats it as open.
- Profile photos and booster logos upload as raw bytes with `image/jpeg`, `image/png`, or `image/webp`. A React Native blob’s `text/plain` type was rejected by the `avatars` bucket. Booster logos go to `avatars/sponsors/`, not the video-only `game_highlights` bucket.

## 2026-09-16

### Highlights Mālo goes to the athlete in the play

- Rail CTA and tip sheet name the tagged athlete (`Drop Mālo · [Name]`). Copy says the gift is for the performer, not whoever uploaded the clip (`MALO_DISCLAIMER` + sheet subtitle).
- PaymentSheet opens only when the clip has a roster athlete and a non-pending / non-rejected tag. Pending or untagged clips toast and route to profile (or Alert) instead of checkout. Profile CTA reads `Drop $N Mālo · [Name]`.

### Expo web no longer dies on Profile SSR

- `http://localhost:8081` crashed with `Class extends value undefined is not a constructor or null` while SSR-loading Profile (`react-native-qrcode-svg` + `expo-file-system` `File` on Node). Web now uses `ShareQrModal.web.tsx` / `share.web.ts` and loads Skia `WithSkiaWeb` only in the browser.

### Web Reports + Money on the Next portal

- `pnpm admin` → `http://localhost:3001/reports` (behavior: sessions, taps, dwell, Mālo windows, leaders) and `/money` (gross / net / payouts / streams). Same RPCs as Expo `/admin/reports` and `/admin/money`.

### Department call sheet

- New [TEAMS.md](docs/TEAMS.md): command staff (Facilitator / Mobile / Backend / QA) plus product departments (`HIGHLIGHTS` · `LOCAL` · `SPOTLIGHT` · `PROFILE` · `AUTH` · `COMMERCE` · `AURA` · `ADMIN` · `BACKEND` · `OPERATOR` · `ROLE_HQ` · `QA` · `LEGAL`). Each section lists fan route, Expo/Next desk, functions, and do-not-touch. Grok [ALA_TEAM_BRIEF.md](docs/ALA_TEAM_BRIEF.md) points at the call template.

### Admin portal wired to the fan app

- Next Features (`pnpm admin`) now toggles the **same flag catalog** as Expo `/admin/features` + Look · Profile (`APP_RUNTIME_FLAG_GROUPS` in shared-types): fan bar, hype, boards, Profile chrome. Draft merge keeps Look copy / catalogs when you flip one switch. **Publish to app** / **Discard draft** hit `patch_app_runtime_draft` + `publish_app_runtime` — Expo fans pick up `published` over Realtime.
- Profile desk can draft chrome (Flip card, Crew, tabs, Actions on top, Open on Stats) instead of read-only badges. **Actions on top** actually moves Mālo / Subscribe in `AthleteProfileView`.
- People list shows Claimed roster + Varsity status from live `is_verified_athlete` / `verification_status` (hosted DBs that never got `profiles.is_verified`). Expo `/admin/people` list + Verify/Approve use the same fallback. Incremental: `supabase/profiles_verified_compat.sql`. Coverage: match roster taps open `/user/[id]`.

### Profile tab matches a tapped athlete

- Own Profile and `/user/[id]` share one `AthleteProfileView`: hero, Crew, Share & Fund, Highlights / Stats / Vault, roster. **YOUR HUB** heading is gone; hamburger overlays the own sheet, back overlays a public sheet (stack title hidden).
- Join Crew, Drop Mālo, and Subscribe hide when `profiles.player_id` (or name) matches the roster row (`isOwnAthleteSheet`). Public sheets run PaymentSheet + `useAthleteSubscription.grant` instead of a fake AsyncStorage tick. Live-game roster and play-card names open `/user/[id]` instead of a tip sheet.

### Highlight picker + compression + avatars

- Camera Roll Highlights go through `HighlightPickerModal` (`expo-image-picker` videos, 45s cap, trim UI). Longer clips alert **Highlight clips must be 45 seconds or less to showcase your best plays!**
- `MediaUploadService` compresses with `react-native-compressor` (1080p vertical, ~2.5 Mbps) under **Optimizing highlight quality...**, uploads `reels/{user_id}/{timestamp}.mp4` to Storage `reels` (fallback `game_highlights`), then inserts `public.reels`. Expo Go skips native compress and still publishes.
- Own Profile hero `ProfileAvatarPicker` 1:1 crop → `avatars` bucket → `profiles.avatar_url`. Incremental: `supabase/media_upload.sql`.

### Spotlight Watch no longer 400s athlete sheet

- Seeded `spotlight_awards` rows can have a null `player_id`. The parser used to invent `spotlight-{award.id}` and **Watch Full Highlight** on the Spotlight tab pushed `/user/{that string}`. Postgres then returned `invalid input syntax for type uuid`. Watch now opens the clip; `/user/[id]` only queries real `players.id` UUIDs.

### Share & Fund ⚡ QR flyer

- Athlete Profile and Locker Room Wishlist cards open `ShareQrModal`: Obsidian canvas, neon-jade QR for `https://tapuai.app/gift/{handle}` (`react-native-qrcode-svg`).
- **Save QR Image to Camera Roll** (`expo-media-library` `Asset.create`), **Copy Web Tipping Link** (`expo-clipboard` + Success haptic), **Share via SMS / Social** (`Share.share`).
- Expo route `/gift/[handle]` is the in-app landing for that URL.

### Team Code Athlete Verification (Varsity)

- Claiming athlete + school stays easy (`RoleSwitcherModal` **Claim athlete profile**). `add_user_role('athlete')` no longer sets `is_verified`.
- **Claim School Verification ⚡** (`VerifyAthleteModal`): team code (`WSTLK-RUG-2026`) or coach/parent request. `profiles.verification_status` = `unverified` \| `pending` \| `verified`.
- Viewers see neon jade **⚡ VERIFIED VARSITY** (`VarsityBadge`) on the hero name and 3D trading card; otherwise SCHOOL CLAIMED / Not verified yet or ⏳ VARSITY PENDING. Highlights stay public while waiting.
- Player of the Week / Spotlight auto-elect requires Varsity (`athlete_is_varsity_verified`). Incremental: `supabase/athlete_verification.sql`.

### Legal Terms & NIL Compliance sheet

- Profile Settings → **Terms of Service & NIL Compliance 📜** (`LegalModal`): ToS/Privacy summary, High School NIL disclaimer (Mālo independent of performance; no school-trademark license), Minor Safety & Parental Authorization.
- Mandatory `LegalAckToggle` on **Apply for Athlete Verification** and **Connect Bank Account**. Stamps `profiles.legal_terms_accepted_at` (`supabase/legal_terms_ack.sql`). Connect onboarding returns 403 without it.

## 2026-09-15

### Expo Go iOS Simulator — Record no longer aborts

- Upload **Record** skipped `launchCameraAsync` on iOS Simulator (`UIImagePickerController setMediaTypes:` abort in Expo Go 57). Use **Library** (PHPicker) or a physical device.

### Clean Profile hierarchy

- Profile hero is a large avatar (tier ring + jersey); Flip Aura card opens from the hamburger or a slim control — not a full-width card blocking the scroll.
- Account Settings (Sign in/out, Capability, Receipts, Suggest, Admin, Flip, Payouts) move into a **menu-outline** `ProfileMenuSheet`.
- Crew / Squad slim into one compact strip with a small Join CTA. Highlights collage stays the next big beat; **Active Team Roster** lists school teammates (tap to open). Athletes see Claimed / Unclaimed via `profiles.player_id`. Hub athlete pick prefers `profile.player_id`.
- **Admin portal Profile desk:** Next `/profile` + Features · Profile chrome flags (`PROFILE_CHROME_FLAGS` in shared-types); Overview shows claimed-athlete count. Expo Look · Profile copy matches hamburger / collage-first hierarchy. Coverage maps hamburger + Flip card to Look (`profile.showCard`).
- Grok Bot ALA team brief: [`docs/ALA_TEAM_BRIEF.md`](docs/ALA_TEAM_BRIEF.md) (Facilitator / Mobile / Backend / Ship QA).

### Soft-Wall admin oversight (Expo + Next portal)

- Expo Coverage adds Soft-Wall auth surface (`soft_wall.*`, providers, welcome overlay, guest browse). Features desk documents Soft-Wall gates + Operator pause; People adds Fans filter and Soft-Wall signup counts; Overview Soft-Wall strip.
- Next `@tapuai/admin-portal` is dynamic: Overview / Soft-Wall / Features / People read `app_runtime_config` + fan `profiles`. Features toggles Soft-Wall related flags via `patch_app_runtime_draft` + Publish. Shared gate map in `@tapuai/shared-types` (`SOFT_WALL_GATES`).
- Soft-Wall telemetry: `soft_wall.malo|crew|wishlist`, `auth.password|apple|google|magic_link|demo`.
- **Demo Fan:** SoftWall / Profile **Continue as Demo Fan** → `demo@tapuai.app` / `TapuaiDemoFan1!` (env override). Creates the Auth user on first tap when Confirm email is off. SoftWall also has email + password **Sign in**.

### Browse-first Soft-Wall auth

- Guests browse Highlights, trading cards, and Locker Room without an account. **Mālo**, **Join Crew**, and **Chip In** open `SoftWallModal` (Continue with Apple / Google + Magic Link email), then resume the intercepted action after `SIGNED_IN`.
- `AuthContext` exposes `isGuest`, Apple / Google / Magic Link helpers, sign-out, guest AsyncStorage markers, and fan profile bootstrap (`ensureFanProfile` + SQL trigger `handle_new_auth_user`). Deep link: `alasports://auth/callback`.
- First-open `WelcomeOverlay` (no account wall). Operator console stays shipped but paused: `layouts.operatorConsole` defaults to **false** until Features + Publish.

### Admin Look + People desks

- Look: serialize `app_runtime_config` draft writes so copy/hex typing cannot race; surface draft/publish errors on the Look desk and Publish bar; drop duplicate Daylight preset row.
- People: Approve verifies matching `profiles` (by `player_id` and name); grant/revoke admin keeps `roles` in sync with `is_admin`; pending queue errors and busy-state buttons.

### Monorepo audit + path retarget

- Re-verified `pnpm typecheck`, `pnpm docs:check`, shared-types imports, and zero Stripe secrets under `apps/mobile/src/frontend/`. Updated [AUDIT_REPORT](docs/AUDIT_REPORT.md) §0, [TROUBLESHOOTING](TROUBLESHOOTING.md), SCHEMA body paths, INVESTOR / LEGAL `pnpm docs:sync` wording.

### A + Full monorepo (pnpm)

- Repo root is workspace orchestration: `pnpm-workspace.yaml`, root scripts (`pnpm mobile`, `pnpm admin`, `pnpm docs:sync`). Expo app moved to `apps/mobile/` (`@tapuai/mobile`). Next.js App Router **stub** at `apps/admin-portal/` (`@tapuai/admin-portal`) with Tailwind + Supabase JS — Expo `/admin` desks stay in mobile. Shared contracts in `packages/shared-types` (`@tapuai/shared-types`).
- Docs: new [ARCHITECTURE](docs/ARCHITECTURE.md), rewritten [ONBOARDING](docs/ONBOARDING.md) + root [README](README.md); `AGENTS.md` / `DOCUMENTATION.md` / `SCHEMA.md` / `docs:sync` paths retargeted to `apps/mobile/…`. Env: `apps/mobile/.env.local` (`EXPO_PUBLIC_*`) and `apps/admin-portal/.env.local` (`NEXT_PUBLIC_*`).

### Island Daylight tab scheme (gold + ember)

- Shared scheme: Jade · Cyan · Gold · Ember · Violet. `ScreenHeading` kickers/underlines use gold; fan bar paints each tab its own accent (`TAB_ACCENTS`). LIVE chips and cheer LIVE pills are Ember red; Spotlight award cards sit on gold mist; Drip tiles pick up ember mist with gold price badges; Local section titles get a gold rule and sponsor Gold/Platinum cards sit on gold mist.
- Deeper pass: Highlights chrome (Home / All / Seki, search, campaign) uses gold + ember; Local hubs / Game / Play / Cheer / ScoreHeader / alerts match Spotlight gold-mist cards; Profile Crew, Flip Card, Vault lock, settings rows, and roster jersey chips pick up gold / ember. Guest `/game/[id]` Realtime uses `nextRealtimeTopic` so `postgres_changes` is never attached after `subscribe()`.

### Island Daylight card palette

- Aura collectibles (`AuraTradingCard`, `AuraCard`, `TopAuraBoosters`) sit on per-tier light `face` washes with readable `ink` instead of charcoal `#161D20`. Local Game / Play / Cheer cards, Drip Gear, and Locker Room tiles share jade mist; away / Seki sides pick up Island Cyan. Highlights ⚡ overlays stay Obsidian.

### Fun hype bursts — Seki / Aura / Flex

- Highlights rail chips each have their own color (Seki cyan, Aura jade, Flex gold) and fire `Effects/HypeBurst`: flying emoji, a shout (`SEKI!` / `AURA!` / `FLEX!`), and a spring ring. Double-tap Aura on the clip uses the same burst (2× on Serve Like Me). Local play cards use the same palette. Fan bar active tab gets a per-tab mist wash + glow dot; Aura toasts pick up a gold rim.

### Skia neon sweep on the Aura trading card

- New `Effects/GlowingNeonBorder`: Skia `SweepGradient` (Neon Jade → Cyber Gold → Electric Violet → Jade) with a solid `BlurMask` (12) behind a crisp stroke. Reanimated spins the sweep 0→2π every 3s (`withRepeat` + linear `withTiming`). Celestial Prism or a funded Locker Room item pulses stroke thickness 3↔7 (`withSequence`).
- `Profile/GlowingCardWrapper` measures the 3D card and sits the canvas 16px outside each edge so the blur is not clipped. `AuraTradingCard` wraps the flip stage in it; Flip Card 🔄 stays outside the glow. Studio **aura_legend** (Celestial Prism) is the preview; Profile lights it from tier 7 or `get_wishlist_items` when any gear is equipped. Native uses `GlowingCardWrapper.tsx` (Skia in the binary). Expo web uses `GlowingCardWrapper.web.tsx` so CanvasKit (`public/canvaskit.wasm`, `npm run skia:web`) is never pulled into the iOS/Android bundle.

### Admin audit — Catalogs, Daylight default, one builder per category

- System sidebar is Features / Look / **Catalogs** / Studio. Lab and QA stay as hidden deep links (Feedback **Open in Lab**, Reports Reliability) so they are not a second Features or Reports desk.
- New `/admin/catalog` (`Admin/CatalogTool`) drafts Mālo presets, cover-fee dollars, exclusive pass dollars + Aura, class years, Local region chips, booster tier prices, and upload category labels until **Publish to app**. Coverage maps every former `owner: code` list to this desk. Money, Boosters, and Feedback link here instead of duplicating the editors.
- The fan app reads `live.catalog` for tip chips, exclusive copy, onboarding years, Local filters, sponsor checkout, Chip In, and upload / Highlights category labels. Sports playbooks, Drip SKUs, schools, games, and wishlist gear stay on their own instant-save desks.
- **Daylight is the shipping canvas** (`LIGHT_COLORS`, `DAYLIGHT_THEME`, Look **Reset to default**). Status bar, tab shells, and payout chrome follow the published theme. Highlights ⚡ (and other video surfaces) stay Obsidian.

### Sports builder — every sport, scored and shown its own way

- New **`/admin/sports`** desk (`Admin/SportsTool`, Operations group) defines one playbook per sport: emoji, segment name (Quarter / Half / Set / Inning / Flight), period chips, clock on/off + minutes, score buttons (label / points / feed play type), sideline callouts, which **Stats 📊** career rows and combine tiles fans see, and roster position pills. Add, edit, pause, or delete any sport, with a live preview of the console and Stats table before saving.
- Each row shows what rides on it — score buttons, periods, clock, positions, athletes, and games — so a change is never blind. **Install starter playbooks** writes the twelve seeded sports (Football, Basketball, Rugby, Volleyball, Soccer, Baseball, Softball, Wrestling, Track & Field, Lacrosse, Ice Hockey, Tennis) into Supabase; playbooks not yet saved are marked `starter`.
- The operator console (`/operator/[gameId]`) and sideline scorer now build their score pad, period chips, clock, callouts, and player-tag macros from the match's playbook (`games.sport`). Untimed sports hide the clock entirely; unknown sports inherit `GENERIC_SPORT_CONFIG` instead of football.
- Fan surfaces follow the same rows: the athlete **Stats 📊** pane renders the playbook's combine tiles and career labels (Kills / Digs, Tries / Tackles, Goals / Assists…), and live play toasts resolve their emoji from that sport's callouts.
- `/admin/games` gains a sport picker that swaps its period chips and clock field to match; `/admin/athletes` shows position pills for the selected sport instead of football-only QB…K. Athlete onboarding offers every active sport.
- New `public.sport_configs` + `get_sport_configs` / `upsert_sport_config` / `delete_sport_config`, plus `games.sport`. Incremental: `supabase/sport_configs.sql`. Expo Go without the table falls back to `SPORT_CONFIG_SEEDS`.
- Coverage tracks the score buttons, period chips, callouts, and Stats rows against the Sports desk.

### Locker Room Wishlist — crowd-funded gear

- Athlete **Stats 📊** tab gains **👟 Locker Room Wishlist**: a horizontal rack of gear cards with item photo, title, money line, and a spring-animated Neon Jade funding bar. **🎁 Gift Item Directly** opens the retailer link in `expo-web-browser`; **⚡ Chip In $5** opens the Mālo sheet and credits whatever the fan pays toward the goal.
- Crossing 100% fires full-screen confetti + a **Gear Unlocked!** notification, stamps a glowing **EQUIPPED ⚡** badge on the card, and pays the athlete a one-time **+500 Aura** (`chip_in_wishlist_item` → `add_user_aura`, guarded by `aura_awarded`).
- New `public.wishlist_items` + `get_wishlist_items` / `chip_in_wishlist_item`. Incremental: `supabase/locker_room_wishlist.sql`. Expo Go without the table falls back to `WISHLIST_DEMO_ITEMS`.
- Managed from admin: `layouts.wishlist` pauses the whole rack (Features), and Coverage tracks `wishlist` / `wishlist_gift` / `wishlist_chip_in` taps against the Drip and Money desks.

### Admin portal — business nav, trail, Coverage

- `/admin` is organized like a production ops portal: pinned **Home**, then Operations / Content / Commerce / Audience / Growth / System. Every desk has **Back** (stack or Home), **Home**, a crumb, and **Open in app** when the desk maps to a fan surface.
- `/admin/coverage` lists every fan-visible control (tabs, Highlights rail, Local boards, Drip, Profile, receipts, Upload, Operator / Parent / Booster / Sponsor actions), who manages it, live vs paused, and 7-day taps / issues. Overview shows live/paused coverage counts.
- Features / Look can pause or rewrite slang guide, suggestions, receipts, and role-HQ ledes (`buttons.suggest`, `layouts.slangGuide`, `layouts.receipts`, copy keys). Missing JSON keys stay on.

### Usage reports + live scoreboard tap

- `/admin/reports` **Usage** desk: time on tabs, deepest scroll, features fans tap (Seki / Mālo / polls / Drip), hottest control issues (failed checkout, Report, upload, open bugs). Still one Expo `/admin` — no second admin app.
- Fan surfaces write `tab_dwell` / `surface_scroll` / `feature_tap` / `ui_issue` into `telemetry_logs` via `useSurfaceUsage`. Home live scoreboard taps through to the Local game. Incremental: `supabase/usage_reports.sql` (adds `duration_ms` / `channel` / `step` on remotes that still used `metric_value`, then `get_admin_reports` usage keys).

### Admin control plane — Marketing / Owner / Engineer

- One `/admin` portal. Sidebar **All desks / Marketing / Owner / Engineer** pills filter the same routes (`tapuai.adminLens`). Marketing lands on Look / copy / Features; Owner on Overview / Money / Reports; Engineer on Lab / QA / flags.
- Fans send app-level suggestions from Profile **Send a suggestion** and Highlights ⋯ **Suggest an improvement** (`submit_app_feedback`). That is not clip Report (`report_reel`). `/admin/feedback` triages `new → reviewing → planned → shipping → shipped | declined` and can pin a `runtime_path`.
- Look gains a **Copy** tab (`app_runtime_config.copy`: Home / Local / Spotlight / Drip kickers, ledes, empty lines, optional Home campaign banner). Still draft until **Publish to app**.
- `/admin/lab` edits the runtime **draft JSON** (unknown keys / invalid hex rejected), applies a triaged suggestion onto the draft, and uses the same Publish path. No in-app TypeScript, `eval`, or git.
- Overview always shows Gross / net / payouts, Reports health fail-warn count, and new feedback. Incremental: `supabase/app_feedback.sql`.

### Admin Money — financial control plane

- `/admin/money` is the revenue desk (Expo Router, not `app/finance/page.tsx`): Gross Platform Volume, Company Net Revenue, Athlete & Operator Payouts, plus a split table for Mālo (10/90), district boosters (15/85), and merch + Vault. Totals come from `get_company_revenue_summary`; the log list reads `company_revenue_logs`. Incremental: `supabase/company_revenue.sql`. Fan Mālo copy is still 100% to custodial until counsel updates `MALO_DISCLAIMER`.

### Auto Spotlight + tag verification

- Player of the Week / Month / Year is elected from **confirmed** Game Play hype (Seki + Aura + Flex). The award is the tagged athlete; the hottest clip is the tape; a fan uploader gets **Clip by**, not the crown.
- Fan tags start `pending`. The athlete, their parent, a school operator, or admin taps **That's them** / **Not them**. Computer vision is out of scope — we verify the confirmer, not the pixels.
- `/admin/spotlight` shows the live race, pending tags, Crown from hype, and a locked manual override. Incremental: `supabase/spotlight_auto.sql`.

## 2026-09-13

### Admin Look + Reports graphs

- `/admin/look` drafts brand colors (Obsidian / jade / gold presets + hex), Profile chrome (card / Crew / Stats / Vault / action placement), and Highlights ⚡ overlay (rail left/right, name top/bottom, school/caption, button order). Same **Publish to app** gate as Features.
- Reports open on **Health** (pass / warn / fail for stalls, flags, checkout, payouts, live board, Drip stock, Spotlight, unpublished chrome) plus 7-day bar charts for clips, Mālo, and stalls. Incremental: `get_admin_reports` `series`.

### Admin Features + Publish to app + Reports

- Fan-bar tabs, Upload +, Seki / Aura / Flex / Mālo / More, Subscribe / Crew / Vault / Flash Unlock, Local boards, search, Spotlight modal, and role HQs are flags on `app_runtime_config`. Toggles stay **draft** until **Publish to app** (sidebar gold button). School names, player stats, captions, Drip prices, scores, and verify stay **instant**.
- `/admin` nav is grouped: Ship / Content / Catalog / People & money / Insights. New desks: **Features** (`/admin/features`) and **Reports** (`/admin/reports` — usage windows, Mālo, leaders, reliability). Incremental: `supabase/app_runtime.sql` + `supabase/admin_reports.sql` (`patch_app_runtime_draft`, `publish_app_runtime`, `get_admin_reports`).

### Admin Studio / Publish / QA

- The fan app no longer shows a Dev role bar or Aura persona chips. Guest / Fan / Athlete / Operator preview lives only in `/admin/studio`. Expo Go **Unlock Studio** (Access Restricted) or `profiles.is_admin` opens the portal; Profile shows **Admin portal** for those sessions. Operator / Parent / Booster / Sponsor previews keep a one-line hatch back to `/admin`.
- New desks: **Publish** (go-live parked games, restore clips, activate Drip/polls, Spotlight status) and **QA** (24h stalls, offline queue flush, empty-state checklist, walk production). Games / Highlights / Drip / Polls / Boosters / Spotlight link out to the matching fan surface or operator console.

### Admin portal desks

- Admin tools are ops desks, not raw CRUD: dollars instead of cents, school/athlete pickers, live/parked/on-Drip filters, score +1 on live games, Highlight retitle/retag, Mālo payout mark-paid, vote share bars, and an Overview inbox for flags / verify / payouts / low stock / empty live board.

### Admin portal (production control plane)

- `/admin` is the **admin portal** that writes the same tables the fan app reads. Nested routes + Obsidian sidebar: Overview, Spotlight, Moderation, Athletes, Schools, Live games, Highlights, People, Drip, Boosters, Money, Polls. Non-admins still see **Access Restricted**. Incremental: `supabase/admin_portal.sql` (`shop_products`, admin writes on `schools_and_teams` / `cheer_polls` / `games` INSERT / `sponsorships`, `upsert_cheer_poll`). Drip tab loads `shop_products` (`useDripCatalog`) with `DRIP_ITEMS` fallback. Local School Polls prefer published `cheer_polls` labels.

### Web Admin Dashboard

- `/admin` is the Obsidian / Neon Jade **Web Admin Dashboard** (Expo Router, not Next.js). Non-admins see **Access Restricted**. Admins get Spotlight Manager (publish Player of the Week), Moderation & Reports (Dismiss / Remove Content on flagged Highlights), and Platform Telemetry (Highlights count, Seki+Aura+Flex, Mālo ledger). `profiles.is_admin` plus Studio unlock. Incremental: `supabase/admin_dashboard.sql` (`publish_spotlight_award`, `moderate_flagged_reel`, `get_admin_platform_metrics`, `reels.is_removed`).

### Home feed + one hype / Mālo state

- Fan bar first tab is **Home**. Highlights ⚡ still lives on Profile. Top chrome is search + **Home / All / Seki**. Home ranks Crew you follow, your school, Serve Like Me, Flash Unlock, energy, and freshness. Search looks up clip titles and athlete profiles (`search_local_entities` + the live feed) in the same dark jade sheet as Local Explore.
- Name + Seki / Aura / Flex / Mālo / ⋯ sit on the clip, just above the fan bar. The video fills the scene from the status area to the nav. iOS Live Text / frame analysis is off (`allowsVideoFrameAnalysis={false}`) so the blue gear does not sit on the clip.
- One Seki, one Aura, and one Flex per fan per clip (`reel_hype_votes` + local `tapuai.reelVotes.*`). Double-tap Aura is that one Aura. After a Mālo, the button fills jade and reads **Mālo'd**. Incremental: `supabase/reel_hype_votes.sql`.

### Highlights chrome + fan bar

- Highlights ⚡ no longer shows the pulsing Aura rank chip. The athlete name wears a 7-tier color border (full **Tier n • title** stays on Profile). Fan bar sits in a phone-width row around a centered Upload plus so Spotlight does not squeeze Drip / Profile. Upload sheet: Library / Record tiles, stacked category rows with a check, phone-width column on web.
- Highlights overlay is TikTok-style: name (tier color) + school + caption bottom-left; right rail is Seki / Aura / Flex / Mālo / ⋯. Share, Save, and Report live in `ReelMoreSheet`. Views leave the feed and show on the Profile trading card. **SEKI PLAY** badge is gone; **All / Seki** switch at the top of Highlights filters `sekiPlay` clips. Upload plus sits in its own slot between Local and Spotlight so it does not cover a tab.

### Crew / Squad + Vault Flash Unlock

- Profile counters are **The Crew ⚡** (followers) and **Your Squad 🛡️** (following). Visitors tap **Join Crew ⚡** (Neon Jade). Mutual follows show a glowing **Teammates 🤝** badge. Persistence: `crew_follows` + `get_crew_graph` / `toggle_crew_follow`.
- Athletes long-press a Vault clip and tap **🔓 Flash Unlock (2 Hours)**. `set_reel_flash_unlock` writes `reels.flash_unlock_until` and queues a `crew_push_queue` row for every Crew member. Highlights ⚡ shows **⚡ FLASH UNLOCK • Locks in 1h 45m** and plays the clip without Subscribe for that window. Incremental: `supabase/crew_and_flash_unlock.sql`.

### Serve Like Me / Train Like Me

- Upload pills tag a Highlight as **⚡ Game Play**, **💪 Train Like Me**, or **🤝 Serve Like Me (2x Aura Boost)**. Serve shows a Neon Jade **Community Impact Boost ⚡** chip. Persists `reels.category` (`game_play` / `train_like_me` / `serve_like_me`). Incremental: `supabase/reel_category.sql`.
- Feed cards float **🤝 SERVE LIKE ME • 2x AURA** or **💪 TRAIN LIKE ME** top-left. Double-tapping Serve Like Me grants 2 Aura (vs 1) and a jade particle burst. OfflineQueue flushes the same point count.

### Player of the Week spotlight

- Highlights launch queries `get_active_spotlight_award(viewer_user_id)` and, if the current week/month award is unviewed, opens `SpotlightModal` over the feed: looped winning Highlight, Neon Jade badge, 7-tier Aura portrait, **Support & Tip Athlete ⚡** (Mālo sheet) and **Watch Full Highlight 🎥**. **Dismiss (seen)** stores AsyncStorage `tapuai.spotlightSeen.{awardId}` so it pops once per period. Incremental: `supabase/spotlight_awards.sql`.
- Spotlight video never calls `pause()` on unmount (expo-video already released the native player; that crash blocked every CTA). Support / Watch wait for the modal fade, then open Mālo or scroll the Highlights ⚡ feed.
- **Spotlight** fan-bar tab (`/spotlight`) lists current and recent Player of the Week/Month cards so a dismissed launch popup is still reachable. Tap a card to replay the modal (Close does not re-arm the popup).

### Athlete Vault lock

- Athletes **Lock Vault 🔒** so fans must subscribe ($4.99/mo) to watch Vault Highlights ⚡, or **Open Vault 🌐** for a public preview. Default is locked (`players.vault_locked`). Clip placement (Highlights vs Vault) is still long-press. Incremental: `supabase/player_vault_lock.sql`. RPC `set_player_vault_locked`.

### Unified athlete profile + Highlights ⚡

- User-facing **Reel / Reels** copy is **Highlight / Highlights ⚡** (fan bar, publish, receipts, trading card). Persistence stays `reels`.
- `AthleteProfileView` is the shared sheet for own Profile and `/user/[id]` (name taps). Tabs: **Highlights ⚡**, **Stats 📊**, **Vault 🔒**. Legacy `/athlete/[id]` redirects. Fan bar stays mounted.
- Stats engine: combine measurables on `players` plus `athlete_career_stats` / `athlete_game_logs`. Trading-card back face shows Games / scoring / volume. Incremental: `supabase/athlete_stats.sql`.

### Local match stays in the fan bar

- Tapping a live game on Local pushes `/local/game/[id]` inside the Local nested stack, so `FanTabBar` stays visible. Public `/game/[id]` in `(guest)` is unchanged for deep links. Tapping Local again pops back to the hub.

### Universal team search (HS + NCAA)

- Athlete onboarding in `RoleSwitcherModal` uses one `schools_and_teams` autocomplete (`ILIKE %query%`) with `[ High School • UT ]` / `[ NCAA D1 • Big 12 ]` badges. HS and college share sport, roster number, position, and class year. Saves `profiles.school_id` + `athlete_division`. Aura trading card shows team name, mascot, and division on both faces. Incremental: `supabase/schools_and_teams.sql`. `docs:check` now fails if SCHEMA omits a `schema.sql` table or RPC.

### Fan-first Open Vault

- Reels default to the free public feed (`reels.is_vault_only` / `is_exclusive` false). Vault clips on `ReelCard` show a semi-transparent **Subscriber Vault 🔒** badge and **Unlock Vault ($4.99/mo)** PaymentSheet; subscribers and public clips play full-resolution with no overlay.
- Athlete Management Profile grid (`AthleteReelManager`) long-presses a thumbnail to **Move to Subscriber Vault 🔒** / **Move to Free Public Feed 🌐**. Medium haptic, optimistic chip, `toggle_reel_vault_status` RPC. Incremental: `supabase/toggle_reel_vault_status.sql`.

### Front-of-house docs sync

- `npm run docs:sync` (`scripts/sync-front-docs.mjs`) reads Mālo / exclusive / booster / Aura / PIN / Connect constants and writes `docs/PRODUCT_FACTS.md` plus marked blocks in PUBLIC / INVESTOR / LEGAL. CI runs `npm run docs:check`. Legal analysis outside the markers stays human-written.

### Front-of-house briefing pack

- Public one-pager, investor memo, and legal/liability briefing (not legal advice) in `docs/PUBLIC.md`, `docs/INVESTOR.md`, `docs/LEGAL_BRIEFING.md`. Prototype stills in `docs/press/`.

## 2026-09-12

### Unified motion + Reel / trading-card focal chrome

- `src/frontend/theme/motion.ts` is the spring and focal-color source: `SPRING_CARD` (sheets / pills), `SPRING_BOUNCE` (reaction chips / score pops), `SPRING_FLIP` (Aura trading card). Neon Jade `#00E676` is reserved for tips, Aura gains, and active roles. Electric Gold `#FFD700` is reserved for Gold / Platinum boosters and top ranks.
- Reel feed: tagged athlete name sits top-left in a 7-tier Aura color border (full rank lives on Profile). School roster + category / Flash Unlock chips stay under the name. Mālo ⚡ keeps a persistent Neon Jade border glow.
- `AuraTradingCard` flips with `SPRING_FLIP`. Back-face Season Points and Total Tipped land in Neon Jade with a staggered `withDelay` fade.

### Phase B production readiness

- `OfflineQueue` (`src/frontend/services/OfflineQueue.ts`) persists Aura taps, cheer votes, bookmarks, and reports in AsyncStorage while `NetInfo.isConnected === false`, then flushes `increment_reel_hype` / `add_user_aura` / `cast_cheer_vote` / `saved_reels` / `report_reel` on reconnect. Root layout starts the singleton at boot.
- Reel rail **Report / Hide Highlight 🚩** opens `ReportContentModal`. Confirm appends the fan onto `reels.reported_by`, sets `is_flagged`, hides the clip on this account (`tapuai.hiddenReels` + toast). Incremental SQL: `supabase/report_reel.sql`.
- Stripe Express Account Links are minted only server-side. `useStripeConnect` / `PayoutSetupCard` call Edge Function `create-stripe-account` with `Authorization: Bearer` session JWT. The handler binds the Express account to `auth.uid()` (ignores client `accountId` / `profileId`) and writes `stripe_connect_id` / `stripe_onboarding_complete` / `payouts_enabled`. Metro `POST /api/create-stripe-account` is a JWT-gated local fallback only.

### Profile trading card + Account Settings audit

- `AuraTradingCard` flips with Reanimated `withTiming` (`rotateY` 0°↔180°, `perspective: 1000`). Tap the card or **Flip Card 🔄**. Medium `impactAsync` fires when rotation crosses 90°. Front keeps the live 7-tier Aura border; back shows Season Points, Reels Posted, and Tips Received.
- **Account Capability** opens `RoleSwitcherModal` over `expo-blur`. Dual Fan + Athlete accounts get a jade segmented Fan View / Athlete Management toggle that writes `profiles.active_role` with Medium haptic. Fan-only **Apply for Athlete Verification 🏆** calls `add_user_role`, updates `roles` immediately, and unlocks `PayoutSetupCard`.
- **Connect Bank Account** launches Stripe Express via JWT Edge Function `create-stripe-account` (`WebBrowser.openAuthSessionAsync`). The server writes `stripe_onboarding_complete` on return. **Tip History & Receipts 🧾** fires Light `impactAsync` and pushes `/receipts` (hidden fan tab).

### Drip + Upload button audit

- Drip `GearCard` scales to 0.96 and opens `ProductSheet` over an `expo-blur` backdrop. Size pills (S–2XL) slide a jade indicator with `withSpring` and Light `impactAsync`. Quantity + / − clamps 1…`inventory` and updates total + Aura live. **Buy Now** runs `useTipCheckout` PaymentSheet (`skipBacker`); success grants order dollars × 10 Aura to the payer.
- Center tab **+** (`accessibilityLabel="Upload video"`) opens `UploadVideoModal`. ImagePicker stores the video URI; a paused `expo-video` `VideoView` is the thumbnail. **Subscriber Exclusive 🔒** paints a `#00E676` border and sets `is_exclusive: true`. **Publish Reel** shows the Storage progress bar, fires `notificationAsync(Success)`, and `UploadSheetContext` prepends the clip onto the Reel feed.

### Local Explore search

- Persistent search bar on Local (`🔍` + `TextInput` + `✕`) sits above hub pills. Light `impactAsync` on focus and throttled typing.
- Queries longer than 1 character slide up `SearchResultsOverlay` with All / Athletes / Schools / Boosters chips, AsyncStorage recents, and live `search_local_entities` hits (`useLocalSearch`, table SELECT fallback).
- Athlete rows open `/athlete/[id]`. Booster rows switch to School Polls and jade-highlight the sponsor rail. School rows filter rivalry polls for that high school. Incremental SQL: `supabase/search_local_entities.sql`.

### Local Discovery button audit

- Hub / region `FilterPills` slide the jade indicator with `withSpring`. Selected pills are transparent so only the indicator paints; hub panes stay mounted (`display: 'none'`) so Live Matches / School Polls / Top Boosters swap without shifting the bar.
- `CheerPollCard` fires Medium `impactAsync`, recalculates % immediately, springs bars from 0% to the new share, and floats **+1 Vote ⚡** from the press point 60px up.
- **+ Become a Team Sponsor** opens `SponsorshipModal` with an `expo-blur` backdrop. Silver / Gold / Platinum cards highlight on Light haptic. **Complete Sponsorship** calls `useTipCheckout` PaymentSheet; success uses `notificationAsync(Success)`.

### Reel feed button audit

- `Gesture.Exclusive(doubleTap, singleTap)` keeps single-tap mute off the double-tap Aura ⚡ burst (`maxDistance` / `maxDeltaY` so paging still wins). Double-tap fires Medium `impactAsync`, optimistic `aura_count`, background `increment_reel_hype`, and `add_user_aura(+1)` for the signed-in fan.
- Seki / Aura / Flex chips stay on `AnimatedPressable` (0.88 → 1.15 → 1.0) and increment local counters immediately.
- **Mālo ⚡** opens `MaloTipModal` (blurred backdrop). **Share** uses Expo `Share.share` with `alasports://athlete/{id}?reel=`. **Save** syncs `public.saved_reels` via `useSavedReel`. Incremental SQL: `supabase/saved_reels.sql`.
- `SwipeableBannerWrapper` pan activates only on swipe-up so vertical Reel scroll is not captured; ✕ / swipe-up still set `isDismissed` with Light haptics.

### Reel Realtime channel collision

- `useLiveGame` / discovery / cheer poll topics go through `nextRealtimeTopic` so two hooks in the same tick never call `.on('postgres_changes')` after `subscribe()`. The Reel feed passes its live snapshot into `LiveMatchBanner` (`live={liveGame}`) so the banner does not open a second `live_game_*` socket. `useGameEventBroadcast` fans share one `game_events_{id}` channel.

### Profile tagged-clip pager

- Profile and `/athlete/[id]` 3×3 grids sort `reels.created_at` **newest → oldest**. Tapping a tile opens `ReelViewModal` as a vertical pager of `ReelCard` (same Exclusive mute / double-tap Aura ⚡, chips, Mālo, Share, Save as the hub feed). Swipe up for older clips.

### Client telemetry (video + sockets)

- `TelemetryManager` (`src/frontend/services/TelemetryManager.ts`) batches events in memory and flushes to `public.telemetry_logs` every 10s or at 15 items. `ReelCard` logs time-to-first-frame and mid-reel stalls. `useLiveGame` logs Realtime `CHANNEL_ERROR` / `CLOSED` reconnect attempts. `useTipCheckout` logs PaymentSheet step latency. Incremental SQL: `supabase/telemetry_logs.sql`.

### Local booster sponsorship tiers

- School Polls shows a **Local Team Boosters & Sponsors 🏆** rail (Obsidian cards + Silver / Gold ⚡ / Platinum 💎 badges). **+ Become a Team Sponsor** fires Light `impactAsync` and opens `SponsorshipModal`. First month is Stripe PaymentSheet via `useTipCheckout` (`skipBacker`); success inserts `public.sponsorships` and grants 500 / 2,000 / 10,000 Aura. Incremental SQL: `supabase/sponsorships.sql`.

### Fan Tip History & Receipts

- Profile **Account Settings** adds **Tip History & Receipts 🧾** (Light `impactAsync` → `/receipts`). The screen is a hidden fan tab so the bar stays. Header metrics: Total Tipped, Athletes Supported, Total Aura Earned. Cards (`ReceiptCard`) use Polynesian Obsidian, `$10.00 Mālo ⚡`, Neon Jade `+100 Aura`, and **View Reel** → `/athlete/[id]`.
- `public.tips` now stores `fan_id`, `reel_id`, and `aura_points`. `useTipCheckout` inserts a ledger row on successful Mālo. RPC `get_fan_tip_history(fan_user_id)` joins `players` for name + school. Incremental SQL: `supabase/get_fan_tip_history.sql` (creates `public.tips` if this project never ran full `schema.sql`).

### Account Capability switcher

- Profile **Account Settings** shows an Account Capability row (`[ Fan ⚡ ]` or `[ Fan ⚡ | Athlete 🏆 ]`). The sheet (`RoleSwitcherModal`) explains Fan vs Athlete. Fan-only accounts get **Apply for Athlete Verification 🏆**, which calls `add_user_role` and unlocks payouts / Vault immediately. Dual accounts get a Fan View / Athlete Management toggle (`profiles.active_role`) with Medium `impactAsync`. Incremental SQL: `supabase/add_user_role.sql`.

### Fan bar on athlete profiles

- `/athlete/[id]` lives under `(tabs)` as a hidden tab (`href: null`) so Reel / Local / Upload / Drip / Profile stay on screen when opening an athlete from a Reel or Profile.

### Swipe-dismiss live banners

- `SwipeableBannerWrapper` (`Gesture.Pan`) lets fans swipe a top-floating banner up. Past `-30` `translationY` it times off to `-120` and calls `onDismiss`; otherwise it springs back to `0`. Opacity interpolates with the drag. A semi-transparent ✕ in the corner dismisses the same way. Light `impactAsync` on swipe or tap.
- Reel `LiveMatchBanner` stays dismissed for that game after swipe/✕ (survives Reel paging). It returns only for a new match or a score change; `ReelCard` play callouts and `/game/[id]` play toasts are separate new notifications.

### Stripe Connect Express

- Athlete Profile **Account Settings** (`PayoutSetupCard`) when `roles` includes `athlete`. Incomplete: **Set Up Payouts ⚡** + Neon Jade **Connect Bank Account**. Complete: **Payouts Active ✅** + **Manage Bank Account / View Express Dashboard**.
- `useStripeConnect.createStripeExpressAccount()` calls `POST /api/create-stripe-account` (Stripe Accounts **v2** Express + Account Link or login link), then `WebBrowser.openAuthSessionAsync`. Return syncs `stripe_onboarding_complete` and `payouts_enabled` onto `profiles` (and local cache). Button fires Medium `impactAsync` and shows a spinner while the link is generated.
- Incremental SQL: `supabase/stripe_connect.sql`. Deep-link return: `/stripe-connect` (`alasports://stripe-connect`).

### Dual Fan / Athlete

- `AuthContext` exposes `roles` (e.g. `['fan', 'athlete']`), `isAthlete`, `canReceiveTips`, and `isVerified`. Athletes keep Fan capability and stay on the fan hub when the Dev switcher selects Athlete (`ROLE_HOME.athlete = '/'`).
- Profile `AuraTradingCard` renders **[ Fan ⚡ ]** and **[ Athlete 🏆 ]** side-by-side when both are active. The flip back-face shows Total Tips Dropped + Poll Votes (Fan) and Season Points + Reels Uploaded (Athlete).
- Mālo via `useTipCheckout` is open to any authenticated user, including verified athletes. Success calls `add_user_aura` for the tipper and the reel athlete (skip the second call when the ids match). Drip / exclusive still grant only the payer. Incremental SQL: `supabase/profile_roles.sql`.

### Documentation

- Cursor rule `.cursor/rules/documentation.mdc`: JSDoc on new/changed functions; keep `DOCUMENTATION.md`, `docs/SCHEMA.md`, and `docs/ONBOARDING.md` in sync with code.
- System overview, schema, and onboarding rewritten for Phase 1 complete / Phase 2 staged / Phase 3 active engine.
- Product aliases: `video_tips` → `public.tips`; `add_user_aura(user_id, points)` → Postgres `target_user_id` / `points_to_add`.
- `AGENTS.md` and `TROUBLESHOOTING.md` aligned with the live tree.

### Cheer polls

- `cast_cheer_vote` now takes optional `home_name` / `away_name` (re-run `supabase/cheer_polls.sql`; `DROP FUNCTION` of the 3-arg form first). Insert-on-miss starts at 0–0 with those labels. Featured `westlake-lone-peak` seed stays 124 / 98. Votes write `cheer_polls`, not `games`.

### Aura palette

- Tier 1 **Slate Silver** `#94A3B8` → Tier 2 **Island Cyan** `#00E5FF` → Tier 3 **Neon Jade** `#00E676` → Tier 4 **Electric Violet** `#B388FF` → Tier 5 **Crimson Ember** `#FF1744` → Tier 6 **Polished Gold** `#FFD700` → Tier 7 **Celestial Prism** `#00E676` / `#00E5FF`. Point bands unchanged. Re-run `supabase/add_user_aura.sql` (includes `DROP FUNCTION`) so `get_aura_tier` matches.

### Fan hub (Phase 1)

- Five-item bar: Reel, Local, Upload FAB, Drip, Profile.
- `expo-video` reel feed, tagged athlete clips, cheer poll, Top Aura Boosters.
- Reel feed micro-interactions: double-tap Neon Jade Aura ⚡ at the touch point (`bumpReelHype` + Medium haptic), Seki/Aura/Flex chips bounce 0.88→1.15→1.0 with a floating +1, single-tap mute badge.
- Profile 3D Aura trading card: `AuraTradingCard` replaces the static hub header. Front is identity + Aura progress; back is season stats, bio, and earned badges. Flip via **Flip Card 🔄** or double-tap; Medium haptic fires at 90°.
- Drip marketplace: `app/(tabs)/drip.tsx` with All Drip / Team Apparel / Custom Aura Cards / Athlete Merch pills (sliding jade indicator), `GearCard` 0.96 press + Light haptic, Reanimated `ProductSheet` (sizes, qty, Aura banner), Stripe **Buy Now**. Success runs `add_user_aura` (`dollars × 10`), success haptics, and toast **Drip secured ⚡**. `/shop` redirects to `/drip`.
- Local hub: **Live Matches / School Polls / Top Boosters** pills with the same sliding jade indicator. `CheerPollCard` (`src/frontend/components/Local/CheerPollCard.tsx`) springs the vote bar from 0% to the live share, fires Medium haptics, floats **+1 Vote ⚡**, and increments `cheer_polls` via `cast_cheer_vote` (not `games`). Top Aura Boosters cards scale 0.96 and open a 7-tier profile peek.
- Interaction audit: every product button fires `Haptics.impactAsync(Light)` via `HapticPressable` / `AnimatedButton`; pending disables on upload, PaymentSheet, reactions, operator GPS, and role-dashboard writes. See [AUDIT_REPORT.md](docs/AUDIT_REPORT.md).

### Operator (Phase 2)

- PIN keypad sheet (`Operator/PINClaimModal`) with Light `impactAsync` per digit; valid `1234` writes `games.claimed_by` and opens `/operator/[gameId]`. `/operator/console/[gameId]` redirects there.
- Scorekeeper: Home/Away **+1 / +3 / +6** spring the digits and call `update_game_score`. **Start / Pause Clock** toggles `is_clock_running` and ticks once per second.
- Callouts **⚡ Big Play / 🏆 Touchdown / 🤙 Big Hit / 🛑 Turnover** Broadcast on `game_events_${gameId}` with `{ type, timestamp, team }` (`Haptics.notificationAsync` on the operator). Focused `ReelCard` springs **⚡ BIG PLAY: Westlake Thunder!** for 3s (`useGameEventBroadcast`). Optional `game_events` INSERT still feeds `/game/[id]` history.
- Fan live overlay: `useLiveGame` subscribes to `games` / `game_events` Realtime; `Reels/LiveMatchBanner` shows home vs away, live score with `withSpring` on increments, quarter + pulse. `Operator/LiveScoreHeader` re-exports the banner.
- Incremental SQL: `supabase/games_operator.sql` (re-run to add `claimed_by`, `is_clock_running`, and the RPC).
- PIN + GPS check-in, game console (clock/score/events), scorer screen. Demo-open RLS remains.

### Monetization (Phase 3)

- Mālo presets `$5` / `$10` / `$25` / Custom; Aura `tipAmount * 10`.
- Athlete exclusive paywall: `$4.99/mo` Stripe PaymentSheet on `/athlete/[id]`; locked tiles blur with **Subscriber Exclusive 🔒**; success inserts `subscriptions` (`subscriber_id`, `athlete_id`), grants **+100 Aura**, success haptics, unlock toast, and unblurs immediately. `supabase/subscriptions.sql` reshapes stub tables and renames `user_id` → `subscriber_id`.
- Upload Seki Play: **Subscriber Exclusive 🔒** toggle persists `reels.is_exclusive`; athlete 3×3 grid refreshes from `UploadSheetContext` and shows the lock badge for non-subscribers.
- Subscriber Vault on `/athlete/[id]`: **All Highlights / Vault 🔒** pills; Vault filters `is_exclusive` clips; non-subscribers see the $4.99/mo callout; subscribers get Direct Request Q&A (`subscriber_requests`) and a Neon Jade crest on their Profile avatar and Q&A rows.
- RPC `add_user_aura` + `get_aura_tier`; 7-tier Aura card borders.
- **Known gap:** checkout does not insert `public.tips` rows (backer count, reel cents, and Aura still update).
