<!-- Current product terms preserve internal money identifiers and distinguish source allocation from settlement. -->
# Glossary — product words vs. code names

The product and the code use different words for the same things. The code kept its early names
(`tips`, `malo`, `reels`) so the database and live config did not have to be migrated; the app and
the docs moved to plainer words. **Engineers see both. Known staff-facing key leaks are listed in the current copy audit.** Use this
table to translate. Rules for on-screen money wording: [product/VOICE.md](product/VOICE.md)
(enforced by `pnpm copy:check`).

Prices, splits and tier numbers live in the generated [product/PRODUCT_FACTS.md](product/PRODUCT_FACTS.md);
what is applied where lives in [STATE.md](STATE.md). This file only maps names.

Paths below are relative to `apps/mobile/src/frontend/` unless they start with `supabase/` or `app/`
(`app/` = `apps/mobile/app/`).

## Money

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Gift / Give / Send a gift** | table `tips`; `useTipCheckout`, `TipCheckout`, `TipSheetModal`, `TipButton`; `malo*` identifiers in `data/malo.ts`, `data/finance.ts` | A fan gives money toward an athlete's sports costs. The biggest naming trap in the repo. |
| **Gift senders** | rows in `tips` | People who sent personal gifts to athletes or families. |
| **Tip Tapua'i (optional)** | `platformTipCents`, `PLATFORM_TIP_PERCENTS` (`data/malo.ts`), `tips.platform_tip_cents` | Optional extra for the platform at checkout. Defaults to "No tip"; the optional controls/copy require the literal published `MONETIZATION_TIPS_ENABLED` flag, default OFF. |
| **No platform gift cut** | `MALO_PLATFORM_CUT_BPS`, `MALO_DISCLAIMER` (`data/finance.ts`, `data/malo.ts`) | New local-source gifts allocate 100% gross to family liability in both flag states. Processing, hosted rollout and bank settlement remain separate gates. |
| **Donation / Donate to the program** | Future program web checkout; current `sponsorships` are paid placement | A contribution to a club/school program. Club status controls its own deductibility wording; Tapua'i promises no deduction. |
| **Cover the processing fee** | `coverFees`, `tips.cover_fee_cents` | Optional separate coverage contribution, flag-gated; configured estimate is not actual Stripe cost. |
| **Subscription / Purchase** | Existing premium/Exclusive identifiers | Recurring premium versus one-time digital extras, separate from giving; current Vault is a one-time Purchase. |
| **Mālo!** | `MALO_*` constants (historical) | A thank-you **only**. Never a word for money on screen. |
| **Gifts received** | RPC `get_received_malo`, `useReceivedMalo`, `Profile/ReceivedMaloPanel` | Gift amounts recorded for the athlete/family; actual settlement remains unverified. |
| **Say thanks** | table `donation_thanks`, `lib/donationThanks.ts`, `useDonationThanks`, `Thanks/ThanksPicker` | Athlete thanks a gift sender with a preset message (no free text). |
| **Rally** | table `rallies`, `lib/rallies.ts`, `useRally`, `Rally/RallyCard`, `Rally/CreateRallySheet` | A named goal for a real sports cost (cleats, travel, camp). |
| **Family account / custodial account** | table `custodial_accounts` (`supabase/custodial_money.sql`), `lib/custodial.ts`, `useCustodial`, `components/Custodial/` | Intended guardian arrangement for one minor athlete. Current entries record family liability; actual custody, handover age/transfer and payout rail remain unresolved. |
| **Held gifts** | `lib/payoutGate.ts`, held-notice copy in the gift sheet | Gifts to an athlete who is not verified yet. Payouts wait. |
| **Payout setup / Stripe Connect** | `profiles.stripe_connect_id`, `payouts_enabled`; Edge Function `create-stripe-account`; `useStripeConnect` | Linked Stripe Express setup/readiness account. Payouts stay blocked; actual family transfer/settlement is unverified. |

## Video, photos and hype

| Product word | Code / database names | Meaning |
| --- | --- | --- |
| **Beyond switch / Beyond page** | feed filter `'beyond'`, `isBeyondHighlight` (`data/highlights.ts`), `app/(tabs)/beyond.tsx`, `components/BeyondGame/`, flag `tabs.beyond` | On the Highlights bar, **Beyond** plays athletes' Train Like Me and Serve Like Me clips. The Beyond the Game page holds fans' own workouts, service, learning and stories (reviewed, no athlete). Not a bottom tab since 2026-10-16. |
| **Upload chooser** | `components/Reels/UploadChoiceSheet.tsx`, `UploadSheetContext` (`openUpload`, `openHighlightUpload`, `openBeyondComposer`) | ＋ asks "Highlight or Beyond moment?" while Beyond posting is on; otherwise it opens the Highlight composer. |
| **Coach-level move** | `reels.safety_label` / `beyond_posts.safety_label` (`none` or `coach_level`), `safety_label_events`, `layouts.coachLevel`, [design](engineering/design/COACH_LEVEL_LABEL_DESIGN.md) | Badge on a workout that needs a coach or spotter. Local app uses the proposed option A wording. Counsel has not approved it. Migration `20261017090000` is written, not applied. |
| **Seki Set / Extra Rep / OT / Two-a-Day** (candidates) | none yet | Phrases being tested with users for "my Beyond workout for the day" (FAMILY_FUN_PLAYBOOK, Beyond phrase test). Not app copy yet. |
| **Highlights ⚡** | table `reels`, `lib/reels.ts`, `useReels`, `components/Reels/`, `HIGHLIGHT_TAB_LABEL` | Short clips and photo stories of athletes. "Reel" is the code word. |
| **Seki 🤙 / Aura ⚡ / Flex 💪** | table `reel_hype_votes` (`kind`), `lib/reelVotes.ts`, `isSekiHighlight` (`data/highlights.ts`), RPC `increment_reel_hype` | The three hype reactions on a clip. |
| **Aura (points)** | `profiles.aura_points`, `lib/aura.ts` (tiers), `AURA_PER_DOLLAR` (`data/players.ts`) | Reputation points and tiers. Not money. |
| **Game Day / Train Like Me / Serve Like Me** | `reels.category` (`game_play`, `train_like_me`, `serve_like_me`), `REEL_CATEGORY_*` and labels in `data/highlights.ts`, `SERVE_LIKE_ME_AURA_MULTIPLIER` | Highlight categories for clips and photo stories. Serve Like Me earns extra Aura. The label "Game Play" became **Game Day** on 2026-10-07; the stored value stays `game_play` (no data migration). |
| **Photo story** | `reels.media_type = 'photo_story'` (default `'video'`), `reels.photo_count`, `reels_feed.cover_path`; table `reel_photos` (one row per photo, `position` 0–9, optional `description`); RPC `set_reel_photos` (the only writer); view `reel_photos_feed` (public read); `lib/photoStories.ts`, `hooks/useStoryPhotos.ts`, `Reels/PhotoStoryMedia` (feed pager); `isPhotoStory` (`data/highlights.ts`); `stripJpegMetadata` / `uploadStoryPhoto` (`services/MediaUploadService.ts`) | One photo or a swipeable set of up to 10 in Highlights, tagged to an athlete, with a caption and optional per-photo descriptions. Public only in v1; location data removed before upload. Migration `20261007230000_photo_stories.sql` is not applied anywhere yet. [Design](engineering/design/PHOTO_STORIES_DESIGN.md). |
| **Give. Elevate. Celebrate.** | `TAGLINE_HEADLINE`, `TAGLINE_LINE` (`data/malo.ts`) | Current October22 gift wording. The former September/October Donate tagline is superseded history. Appears on the welcome overlay, gift sheet and profile Give action. Rules: [product/VOICE.md](product/VOICE.md). |
| **Filmed by / filmer** | `reels.uploaded_by`, `uploader_name` in `reels_feed`, `lib/filmers.ts`, `Filmers/FilmerSheet` | The fan who filmed someone else's clip. |
| **Props** | table `filmer_props`, RPC `give_filmer_props` | Aura a fan gives a filmer. Not cash. |
| **Account tags (mentions)** | table `reel_account_tags`, `lib/accountTags.ts`, `Reels/AccountTagField`, `Profile/AccountTagInbox` | Up to three accounts named on a clip; they confirm before the name shows. |
| **Saved** | table `saved_reels`, `useSavedReel` | Bookmarked clips. |
| **Report** | RPC `report_reel`, table `reel_reports`, `Reels/ReportContentModal`, `data/contentRights.ts` | Flag a clip with a reason (fake footage, impersonation, rights…). |
| **Vault 🔒 / Exclusive** | `reels.is_vault_only` (kept in step with legacy `is_exclusive`), `players.vault_locked`, `lib/vault.ts`, `data/exclusive.ts` | Restricted digital clips with one-time Purchase access. Store/payment rules remain under review (see [agents/WORK_QUEUE.md](agents/WORK_QUEUE.md)). |
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
| **Age and guardian setup** | `profiles.age_confirmed_13_plus` (legacy), MINOR-01 birth/guardian sources | Birth month/year and teen guardian rules replaced the older signup checkbox; signed consent remains versioned. |
| **Features / Look / Publish** | table `app_runtime_config`, `lib/runtime.ts`, `AppRuntimeContext`, Expo `/admin/features`, `/admin/look`, `/admin/publish` | Live feature flags and copy overrides, edited in the Expo admin. |
| **Main admin / reporting client** | `app/(admin)/admin` (reports and all administration controls); `apps/admin-portal` (compatible read-only client) | Main Expo admin combines the owner-selected report design and analytics with editing desks. The separate Next client never writes. |
| **Telemetry** | table `telemetry_logs`, `services/TelemetryManager` | Usage events. |

## Retired words (never on screen)

`pnpm copy:check` fails a build that uses these in UI copy. Code names stay.

| Do not say | Say instead | Why |
| --- | --- | --- |
| Mālo (as money) | gift / Give | Not understood outside the islands; Mālo is a thank-you. |
| tip (to an athlete) | gift / Give | Sounds like paying for a play. Only an optional tip naming Tapua'i is platform support. |
| backing / backers / Chip In | gave / gift senders / Give | Vague about where money goes. |
| fund / funded / invest | Give / goal reached | Investment language; eligibility risk for student-athletes. |
| earn / paid per play or stat | gifts for sports costs | Money tied to performance can cost athletes eligibility. |

Full list and reasons: [product/VOICE.md](product/VOICE.md) and `scripts/check-copy.mjs`.

## Data governance

| Word | In code / docs | Meaning |
| --- | --- | --- |
| **Data control point** | `DATA_GOVERNANCE` (reports to the CTO) | The role that approves every new data path and owns the master data map. |
| **Data map** | `docs/engineering/DATA_MAP.md` (generated by `scripts/data-map.mjs`) | For every table and view: owner, purpose, writers, readers, database functions, triggers and screens; for every database function: its callers. |
| **Ownership registry** | `docs/engineering/data-ownership.json` | Owner and purpose of every table and view, hand-run functions, deliberate exceptions and the keep / archive decision for every unused export. |
| **Dead data / dead code** | DATA_MAP.md rule failures and triage | A table nothing reads or writes, a function nothing calls, or an export nothing imports. Archived with the owner's approval, never deleted. |


## Superseded money wording — retained history

The September29/October7 map used **Donate / donation**, **Donors**, **donations received**
and **Donate. Elevate. Celebrate.** for individual support. Its **90 / 10 split** meant
90% family /10% Tapua'i, including processing. These are superseded instructions; posted
financial rows and frozen signed consent preserve their actual original values/versions.
Current source/report/rollout: [COORD-02](agents/COORD-02.md).
