# Glossary — product words vs. code names

The product and the code use different words for the same things. The code kept its early names
(`tips`, `malo`, `reels`) so the database and live config did not have to be migrated; the app and
the docs moved to plainer words. **Users never see the code names. Engineers see both.** Use this
table to translate. Rules for on-screen money wording: [product/VOICE.md](product/VOICE.md)
(enforced by `pnpm copy:check`).

Prices, splits and tier numbers live in the generated [product/PRODUCT_FACTS.md](product/PRODUCT_FACTS.md);
what is applied where lives in [STATE.md](STATE.md). This file only maps names.

Paths below are relative to `apps/mobile/src/frontend/` unless they start with `supabase/` or `app/`
(`app/` = `apps/mobile/app/`).

## Money

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Donate / donation** | table `tips`; `useTipCheckout`, `TipCheckout`, `TipSheetModal`, `TipButton`; `malo*` identifiers in `data/malo.ts`, `data/finance.ts` | A fan gives money toward an athlete's sports costs. The biggest naming trap in the repo. |
| **Donors** | rows in `tips` | People who donated. |
| **Tip for Tapua'i** | `platformTipCents`, `PLATFORM_TIP_PERCENTS` (`data/malo.ts`), `tips.platform_tip_cents` | Optional extra for the platform at checkout. Defaults to "No tip". The only place the word "tip" may appear on screen. |
| **90 / 10 split** | `MALO_PLATFORM_CUT_BPS`, `MALO_DISCLAIMER` (`data/finance.ts`, `data/malo.ts`) | Basis points: 90% to the family account, 10% to Tapua'i. Disclosed on the donate sheet. |
| **Mālo!** | `MALO_*` constants (historical) | A thank-you **only**. Never a word for money on screen. |
| **Support received / donations received** | RPC `get_received_malo`, `useReceivedMalo`, `Profile/ReceivedMaloPanel` | What an athlete or family has collected. |
| **Say thanks** | table `donation_thanks`, `lib/donationThanks.ts`, `useDonationThanks`, `Thanks/ThanksPicker` | Athlete thanks a donor with a preset message (no free text). |
| **Rally** | table `rallies`, `lib/rallies.ts`, `useRally`, `Rally/RallyCard`, `Rally/CreateRallySheet` | A named goal for a real sports cost (cleats, travel, camp). |
| **Family account / custodial account** | table `custodial_accounts` (`supabase/custodial_money.sql`), `lib/custodial.ts`, `useCustodial`, `components/Custodial/` | The guardian holds money for one minor athlete; control passes to the athlete at the handover age. |
| **Held gifts** | `lib/payoutGate.ts`, held-notice copy in the donate sheet | Donations to an athlete who is not verified yet. Payouts wait. |
| **Payout setup / Stripe Connect** | `profiles.stripe_connect_id`, `payouts_enabled`; Edge Function `create-stripe-account`; `useStripeConnect` | The Stripe Express account money is paid out to. |

## Video, photos and hype

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Beyond switch / Beyond page** | feed filter `'beyond'`, `isBeyondHighlight` (`data/highlights.ts`), `app/(tabs)/beyond.tsx`, `components/BeyondGame/`, flag `tabs.beyond` | On the Highlights bar, **Beyond** plays athletes' Train Like Me and Serve Like Me clips. The Beyond the Game page holds fans' own workouts, service, learning and stories (reviewed, no athlete). Not a bottom tab since 2026-10-16. |
| **Upload chooser** | `components/Reels/UploadChoiceSheet.tsx`, `UploadSheetContext` (`openUpload`, `openHighlightUpload`, `openBeyondComposer`) | ＋ asks "Highlight or Beyond moment?" while Beyond posting is on; otherwise it opens the Highlight composer. |
| **Coach-level move** (planned) | SAFETY-01, [design](engineering/design/COACH_LEVEL_LABEL_DESIGN.md) | Proposed safety label for risky workouts. Not built; wording is Legal's call. |
| **Seki Set / Extra Rep / OT / Two-a-Day** (candidates) | none yet | Phrases being tested with users for "my Beyond workout for the day" (FAMILY_FUN_PLAYBOOK, Beyond phrase test). Not app copy yet. |
| **Highlights ⚡** | table `reels`, `lib/reels.ts`, `useReels`, `components/Reels/`, `HIGHLIGHT_TAB_LABEL` | Short clips and photo stories of athletes. "Reel" is the code word. |
| **Seki 🤙 / Aura ⚡ / Flex 💪** | table `reel_hype_votes` (`kind`), `lib/reelVotes.ts`, `isSekiHighlight` (`data/highlights.ts`), RPC `increment_reel_hype` | The three hype reactions on a clip. |
| **Aura (points)** | `profiles.aura_points`, `lib/aura.ts` (tiers), `AURA_PER_DOLLAR` (`data/players.ts`) | Reputation points and tiers. Not money. |
| **Game Day / Train Like Me / Serve Like Me** | `reels.category` (`game_play`, `train_like_me`, `serve_like_me`), `REEL_CATEGORY_*` and labels in `data/highlights.ts`, `SERVE_LIKE_ME_AURA_MULTIPLIER` | Highlight categories for clips and photo stories. Serve Like Me earns extra Aura. The label "Game Play" became **Game Day** on 2026-10-07; the stored value stays `game_play` (no data migration). |
| **Photo story** | `reels.media_type = 'photo_story'` (default `'video'`), `reels.photo_count`, `reels_feed.cover_path`; table `reel_photos` (one row per photo, `position` 0–9, optional `description`); RPC `set_reel_photos` (the only writer); view `reel_photos_feed` (public read); `lib/photoStories.ts`, `hooks/useStoryPhotos.ts`, `Reels/PhotoStoryMedia` (feed pager); `isPhotoStory` (`data/highlights.ts`); `stripJpegMetadata` / `uploadStoryPhoto` (`services/MediaUploadService.ts`) | One photo or a swipeable set of up to 10 in Highlights, tagged to an athlete, with a caption and optional per-photo descriptions. Public only in v1; location data removed before upload. Migration `20261007230000_photo_stories.sql` is not applied anywhere yet. [Design](engineering/design/PHOTO_STORIES_DESIGN.md). |
| **Donate. Elevate. Celebrate.** | `TAGLINE_HEADLINE`, `TAGLINE_LINE` (`data/malo.ts`) | The owner-approved brand message (2026-10-07). Plain text on the welcome overlay, the donate sheet's Amount page and under a profile's Donate button. Rules: [product/VOICE.md](product/VOICE.md). |
| **Filmed by / filmer** | `reels.uploaded_by`, `uploader_name` in `reels_feed`, `lib/filmers.ts`, `Filmers/FilmerSheet` | The fan who filmed someone else's clip. |
| **Props** | table `filmer_props`, RPC `give_filmer_props` | Aura a fan gives a filmer. Not cash. |
| **Account tags (mentions)** | table `reel_account_tags`, `lib/accountTags.ts`, `Reels/AccountTagField`, `Profile/AccountTagInbox` | Up to three accounts named on a clip; they confirm before the name shows. |
| **Saved** | table `saved_reels`, `useSavedReel` | Bookmarked clips. |
| **Report** | RPC `report_reel`, table `reel_reports`, `Reels/ReportContentModal`, `data/contentRights.ts` | Flag a clip with a reason (fake footage, impersonation, rights…). |
| **Vault 🔒 / Exclusive** | `reels.is_vault_only` (kept in step with legacy `is_exclusive`), `players.vault_locked`, `lib/vault.ts`, `data/exclusive.ts` | Clips only subscribers can watch. Pricing copy is being reconciled (see [agents/WORK_QUEUE.md](agents/WORK_QUEUE.md)). |
| **Flash Unlock** | `reels.flash_unlock_until`, `FLASH_UNLOCK_HOURS` (`data/exclusive.ts`) | A Vault clip opened to everyone for a short window. |

## People and roles

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Fan / Athlete / Parent / Booster / Sponsor / Operator / Admin** | `profiles.role` (active) and `profiles.roles` (all held); route groups `app/(fan)`, `(athlete)`, `(parent)`, `(booster)`, `(sponsor)`, `app/operator/`, `(admin)` | Roles. Everyone starts as a fan; one account can hold several. |
| **Guardian** | `players.guardian_id` | The adult linked to a minor athlete. |
| **Verified / Pending / Not verified yet** | `profiles.verification_status`, `is_verified`, `lib/verification.ts`, `useMyVerification`, `components/Verification/` | Athlete verification ladder. |
| **School confirmer** | table `school_confirmers`, route `app/school-confirm.tsx`, `lib/schoolConfirm.ts` | Athletic director or coach who confirms a student in person. |
| **Vouch** | table `athlete_vouches`, RPC `vouch_for_teammate`, `Verification/TeammateVouchCard` | Teammates confirming an athlete when there is no school confirmation. |
| **School crest** | `schools_and_teams.logo_url` / colours, `lib/schoolBadge.ts`, `Verification/SchoolCrest` | School branding on a profile. |
| **The Crew / Squad** | table `crew_follows`, `lib/crew.ts`, `useCrew`, `SQUAD_COUNTER_LABEL` | Follows; Squad is mutual follows. |
| **Athlete HQ / Parent HQ / Booster HQ / Sponsor HQ** | `app/(athlete)/`, `app/(parent)/`, `app/(booster)/`, `app/(sponsor)/` | Each role's home screen. |

## Games and game-day

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Game / match** | table `games`, `lib/guestGames.ts`, `useLiveGame`, `useLiveScores` | A scheduled or live game with a scoreboard. |
| **Play / game event** | table `game_events`, `useGameEventBroadcast` | A scoring action entered on game day. |
| **Game-day gig / operator** | table `operator_gigs`, `operator_checkins`, routes `app/operator/` | A person scoring a game from the sideline. |
| **Demo PIN** | `OPERATOR_TEST_PIN` (`lib/operator.ts`) | Prototype operator access. Internal testing only. |
| **Local** | `app/(tabs)/local/`, `useLocalSearch` | Games and schools near you. Reached from a pill on Home. |

## App surfaces and admin

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Home** | `app/(tabs)/index.tsx` | The Highlights feed with Home, search, and Local. |
| **Activity / Spotlight / Drip / Profile / Receipts** | `app/(tabs)/activity.tsx`, `spotlight.tsx`, `drip.tsx`, `profile.tsx`, `receipts.tsx` | Fan tabs. Drip (merch) is switched off for Wave 0. |
| **Spotlight / Boards** | table `spotlight_awards`, `useActiveSpotlight`, `Spotlight/LeaderboardsBoard`, `lib/leaderboards.ts` | Player of the week/month and leaderboards. Never shows money. |
| **Soft-Wall** | `Auth/SoftWallModal`, `SoftWallContext`, `lib/auth.ts` | Sign-in prompt shown only when a guest tries something that needs an account. |
| **Age confirmation** | `profiles.age_confirmed_13_plus`, `Auth/AgeConfirmModal` | Self-attested 13+ checkbox at email sign-up. |
| **Features / Look / Publish** | table `app_runtime_config`, `lib/runtime.ts`, `AppRuntimeContext`, Expo `/admin/features`, `/admin/look`, `/admin/publish` | Live feature flags and copy overrides, edited in the Expo admin. |
| **Main admin / reporting client** | `app/(admin)/admin` (reports and all administration controls); `apps/admin-portal` (compatible read-only client) | Main Expo admin combines the owner-selected report design and analytics with editing desks. The separate Next client never writes. |
| **Telemetry** | table `telemetry_logs`, `services/TelemetryManager` | Usage events. |

## Retired words (never on screen)

`pnpm copy:check` fails a build that uses these in UI copy. Code names stay.

| Do not say | Say instead | Why |
| --- | --- | --- |
| Mālo (as money) | donate / donation | Not understood outside the islands; Mālo is a thank-you. |
| tip (to an athlete) | donate / donation | Sounds like paying for a play. Only "tip for Tapua'i" is allowed. |
| backing / backers / Chip In | donated / donors / Donate | Vague about where money goes. |
| fund / funded / invest | donate / goal reached | Investment language; eligibility risk for student-athletes. |
| earn / paid per play or stat | donations for sports costs | Money tied to performance can cost athletes eligibility. |

Full list and reasons: [product/VOICE.md](product/VOICE.md) and `scripts/check-copy.mjs`.

## Data governance

| Word | In code / docs | Meaning |
| --- | --- | --- |
| **Data control point** | `DATA_GOVERNANCE` (reports to the CTO) | The role that approves every new data path and owns the master data map. |
| **Data map** | `docs/engineering/DATA_MAP.md` (generated by `scripts/data-map.mjs`) | For every table and view: owner, purpose, writers, readers, database functions, triggers and screens; for every database function: its callers. |
| **Ownership registry** | `docs/engineering/data-ownership.json` | Owner and purpose of every table and view, hand-run functions, deliberate exceptions and the keep / archive decision for every unused export. |
| **Dead data / dead code** | DATA_MAP.md rule failures and triage | A table nothing reads or writes, a function nothing calls, or an export nothing imports. Archived with the owner's approval, never deleted. |

