# Tapua'i — Legal and liability briefing

## Current local timed trivia review — QUIZ-02

The owner approved optional30/90-second sports-first trivia; [QUIZ-02](../agents/QUIZ-02.md)
records its new admin-first work. Default-off weekly invitations/manual play, private equal
participation badges and no valuable stakes limit the proposed exposure. Existing known-age
restrictions remain; athlete/school/Stripe verification is not required for trivia.

Invitation/topic preferences and notice choices are separate from public recognition,
marketing, school disclosure or payout consent. Clearing learning history preserves disclosed
preferences/notice/revision and a minimal35-day weekly guard, while removing issued-family
history/results/badges/receipts; future repeats can occur. Privacy/counsel must review lawful
basis, age/region scope, notices and retention before hosted use. Native/web interruptions
and accessibility require real device review; local source/actor tests are not legal approval.

Admin correction/pause/retention and protected source are verified before the participant
flow. See the [approved design](../engineering/design/TIMED_TRIVIA_PROPOSAL.md) for exact
boundaries. Current implementation evidence belongs in QUIZ-02, not earlier QUIZ-01 receipts.

**Status:** Internal draft for counsel, investors, and (in excerpt) public affairs.  
**Date:** 13 September 2026  
**This is not legal advice.** It is a map of issues a licensed attorney in the relevant states — and, where money moves, payments counsel — must actually opine on. Nothing here is a promise that Tapua'i is lawful to operate with live money.

Read with [INVESTOR.md](../company/INVESTOR.md) and [PUBLIC.md](../product/PUBLIC.md). The order for formation, trademark, patent triage, billing, and security is [COMPANY_PHASES.md](../company/COMPANY_PHASES.md). [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md) is the current inventory of what the product actually collects — a starting point for the Privacy Policy counsel drafts (§8), not a substitute for it. Engineer source of truth: [SYSTEM_OVERVIEW.md](../engineering/SYSTEM_OVERVIEW.md), [SCHEMA.md](../engineering/SCHEMA.md).

---

## 1. Why this memo exists

Tapua'i lets fans send **cash tips (Mālo)** to **named high-school athletes**, store **video of minors**, sell **local sponsorships**, and run **school cheer polls**. Those four facts trigger amateur-sports rules, youth-privacy law, payments law, and advertising law. Any one of them can stop a live launch even if the app works.

The honest investor question is not “is there a lawsuit someday?” It is: **can we turn on live Stripe without the athletic association, a school district, or a payments partner shutting us down?**

---

## 2. Facts counsel should treat as true (from the product, not a pitch)

Prices, PIN, Connect identity, RLS, and the Mālo disclaimer are generated from source (`pnpm docs:sync`). Do not edit inside the markers. Do not auto-generate legal conclusions.

<!-- product-facts:start -->
| Fact | Where it lives |
| --- | --- |
| Donation amounts | $5 / $10 / $25 + custom (`TIP_AMOUNTS`) |
| In-app claim | 90% of your donation goes to the athlete's family account. Tapua'i keeps 10% to run the app, including card processing. Nothing goes to the person who uploaded the clip. |
| Donation split | 10% platform / 90% athlete's family account (`MALO_PLATFORM_CUT_BPS`), disclosed on the donate sheet; the optional tip for Tapua'i is separate and 100% platform (rows L, R) |
| Exclusive | $4.99; +100 Aura (`EXCLUSIVE_MONTHLY_DOLLARS`) |
| Boosters | Silver $50 / Gold $150 / Platinum $500 (`SPONSOR_TIERS`) |
| Stripe Express | US individual (`createStripeAccount.ts`) |
| Payout without destination | queued for admin disbursement |
| Operator PIN | `1234` |
| Athlete catalog | HS + NCAA `schools_and_teams`; `profiles.school_id` / `athlete_division` |
| Athlete profile tabs | Highlights ⚡ / Stats 📊 / Vault 🔒 |
| Athlete Vault | Lock Vault 🔒 default on; fans need one-time Exclusive access to watch (`players.vault_locked`) |
| Crew / Squad | The Crew ⚡ / Your Squad 🛡️ (`Join Crew ⚡`) |
| Vault Flash Unlock | 2 hours (`FLASH_UNLOCK_HOURS`) |
| Serve Like Me Aura | Double-tap 1 ×2 (`SERVE_LIKE_ME_AURA_MULTIPLIER`) |
| RLS | demo-open — tighten before production |
<!-- product-facts:end -->

Still true, maintained by hand when those flows change:

| Fact | Where it lives |
| --- | --- |
| Target users include high-school athletes and fans | Product copy, roster, Local schools |
| Mālo is a JWT-gated PaymentIntent (test mode today) | `useTipCheckout`, Stripe PaymentSheet |
| Parent screen toggles `parental_consent_approved` on `players` | `app/(parent)/parent/index.tsx` |
| Athletes can open Stripe Express (JWT Edge Function) | `PayoutSetupCard` / `create-stripe-account` — gated on `legal_terms_accepted_at` |
| In-app Terms / NIL / minor-safety sheet | `LegalModal` + `LEGAL_TERMS_VERSION` (`2026-09-27`); Profile hamburger |
| Custodial payouts require JWT; destination is `profiles.stripe_connect_id` | `createPayout.ts` |
| Exclusive access is a **one-time PaymentIntent**, not a Stripe Subscription | `docs/engineering/SCHEMA.md` |
| Cheer polls are vote counts only — no stake, no payout | `cast_cheer_vote` |
| Aura is a points / card cosmetic system | `aura.ts` |
| Reels are user- or demo-uploaded video; Report hides for that user and sets `is_flagged` | `report_reel` — not a full moderation desk |
| Each Mālo row stores amount, athlete, fan account, time, where it started (`highlight` / `qr` / `wishlist` item / `profile` / `live`), and whether arrival was a QR link | `tips.origin`, `tips.entry`, `tips.wishlist_item_id`, `tips.source_label`. Prototype terms and the Mālo sheet say we use that record for receipts, athlete accounting, and to see which parts of the app bring in support. Counsel still replaces this summary before live money. |

Counsel should assume **live money is off** until RLS and operator auth in the generated table change.

---

## 3. Risk register (will this fail because of the law?)

Severity is a product judgment for fundraising, not a court ranking.

| ID | Topic | If ignored | Can it kill the company? |
| --- | --- | --- | --- |
| A | **High-school amateurism / extra benefits** | Association or school bars athletes from the app; injunction-style letters; athletes lose eligibility | **Yes — this is the primary existential risk** |
| B | **Minors as payees** | Stripe / bank rejects accounts; parents sue; state AG child-privacy action | **Yes, if live payouts go to 16-year-olds without a lawful custodial design** |
| C | **Holding customer funds** | Money-transmitter licensing (state-by-state) | **Yes, if we wallet funds instead of Stripe Connect / licensed partner** |
| D | **Pay-for-play appearance** | Same as A, plus consumer-protection claims | High |
| E | **UGC of minors + school footage** | Likeness, copyright (school / broadcast), takedown volume. As of 2026-10-01 the upload screen requires the uploader to confirm they filmed the clip or have permission, that the sound is the original recording or music they have the right to use, and that they are not treating a school logo, team mark, or TV broadcast as theirs. Game Day (stored as `game_play`; label renamed from "Game play" 2026-10-07) also requires a real-footage confirmation. Reports can name fake footage, impersonation, or music/logo/broadcast, and those leave the public feed for review. Counsel still decides whether school marks may appear at all. | High operationally; can become legal |
| F | **COPPA / under-13** | FTC; app store removal. **2026-10-14 (MINOR-01, written, not applied):** sign-up now asks birth month and year (no day) instead of a 13+ checkbox, behind a neutral screen; an under-13 date creates no account and pauses the device for 24 hours; an under-13 entry later (actual knowledge) closes the account at once (every table refuses it, its clips are hidden, its friendships and guardian links end) and lists it on the admin desk for deletion of the sign-in, which is done by hand in Supabase. Counsel: is a neutral month/year screen enough, the deletion deadline, roster `players` rows for under-13s, and whether middle-school teams make us a mixed-audience service (row AA). | High if the app is used by children under 13 |
| G | **Gambling optics (polls)** | App store / state gaming if anyone can read it as a wager | Medium if product stays vote-only |
| H | **Aura as value / “trading card”** | Securities or money-service confusion if points become transferable cash | Medium if we never sell or cash out Aura |
| I | **Sponsorships on school property / marks** | School IP, booster-club rules, advertising to students | Medium |
| J | **Tax (1099, backup withholding)** | IRS / state | Expected cost of a real payouts business |
| K | **Demo security / open RLS** | Data incident before launch | High reputational; fixable in engineering |
| L | **Misleading “100% to athlete”** — *changed 2026-09-29* | Owner decided to **keep the 10% and disclose it**. The donate sheet now says "90% of your donation goes to the athlete's family account. Tapua'i keeps 10% to run the app, including card processing." plus a per-amount breakdown line. The old "100%" copy is gone. Counsel: the disclosure wording, and **App Store 3.2.1(vii)**, which as we read it lets a gift skip in-app purchase only if 100% goes to the receiver — a 10% share may push iOS donations into IAP (ROADMAP Wave 1 checklist item 4). Copy: `data/players.ts` (`MALO_DISCLAIMER`), `data/malo.ts` (`donationSplitLine`, `donationBreakdownLine`) **2026-10-13:** family-facing totals (athlete profile, Parent HQ, custodial cards) now lead with the amount recorded for the family account and state the amount Tapua'i kept from the books, instead of showing the donated total as received (`20261013231000`, not applied). | Medium–High (App Store) |
| M | **"Held until verified" gifts (new 2026-09-29, needs review)** | Fans are told a gift to an unverified athlete is "held and only paid out after their school confirms them"; the athlete is told the same. Today it is true only because payouts are off. Counsel to review the wording, whether a cap and refund promise must appear at checkout, how long a gift may be held, and whether holding touches money-transmission (C). Copy lives in `data/verification.ts` (`GIFT_HELD_NOTICE`, `VERIFY_HELD_COPY`) | Medium |
| O | **Payouts without school confirmation (new 2026-09-29, needs review)** | Payouts can unlock after a guardian (or 18+ athlete) passes Stripe's ID check, capped at $250 until 3 teammates vouch or the school confirms. Held copy changed to "held until a parent finishes payout setup (or your school confirms you)" / "until their family finishes payout setup". Also: confirmed athletes see the names, sport, class year and jersey of pending teammates at their school so they can vouch. Counsel: the wording, whether the cap must be disclosed to fans, and whether showing a minor's pending claim to schoolmates is acceptable | Medium |
| P | **Filmer rewards and a future filmer cash programme (new 2026-09-29, needs review)** | Fans who film and post a clip of an athlete earn Aura (points, no cash value) and "Props" from other fans. We record every reward in a ledger that has a cash column (always 0 today) which only Tapua'i can fund — never athlete gifts. Counsel before any cash: filmers may be minors; whether paying filmers is employment / contractor work (1099, row J), prize or sweepstakes rules if it is a "top filmer" award, NIL interaction when the clip shows a student-athlete, and whether Aura must say "no cash value" | Low today (no cash); Medium once paid |
| Q | **"Donate" language (new 2026-09-29, needs review)** | The app now says **Donate / donation** everywhere instead of Mālo / tip / backing (owner: be clear it is a donation app, a GoFundMe replacement for families). The donate sheet says: "Your donation goes to {athlete}'s family account for their sports costs — not to whoever posted the clip, and never for a play or a stat. Donations to individuals are not tax-deductible." Counsel: whether "donate" to an individual raises charitable-solicitation registration questions in any state (Tapua'i is not a charity), the tax line wording, and how to disclose the Tapua'i share (row L — now disclosed as 90 / 10 on the sheet). Copy: `data/malo.ts` (`donationWhereItGoes`, `DONATION_MISSION`), `docs/product/VOICE.md` | Medium |
| R | **Optional tip to Tapua'i at checkout (new 2026-09-29, needs review)** | GoFundMe-style: under the amounts, "Add a tip for Tapua'i (optional)" with chips No tip / 5% / 10% / 15%. **Defaults to No tip** — we do not pre-select a platform add-on (dark-pattern / FTC "negative option" risk). The tip is charged in the same payment, logged as its own revenue row (`source = 'tip'`), and never comes out of the donation. The "cover card fees" box is now **off by default** too, and says it helps Tapua'i pay the card company (processing comes out of Tapua'i's 10%). Counsel: the wording, whether the tip must be shown as a separate line on the receipt, and sales-tax treatment of a tip to a platform. Copy: `data/malo.ts` (`PLATFORM_TIP_*`), `components/FeeCheckbox.tsx` | Medium |
| S | **Athletes thanking donors (new 2026-09-29)** | Athletes (often minors) and their guardians can thank each donor and thank everyone on a filled Rally. **Presets only** — five fixed messages, no free text, no replies, no donor contact details shown — so it can never become a private channel between a minor and an adult. Donors see the thank-you in Activity. Counsel: confirm presets are enough, and that showing the donor's display name to the athlete is fine | Low |
| T | **Rally goals (new 2026-09-29, needs review)** | A family names a real sports cost (season fees, gear, travel, camps, college prep), a goal ($5–$25,000), an optional story and end date; fans donate toward it. A Rally started by a minor waits for the guardian's approval; an adult athlete who controls their own money can start one directly. The sheet tells families to ask for real costs only, never for a play, a stat or a win (eligibility). Counsel: whether naming a cost creates a duty to spend it on that cost (and refunds if not), charitable-solicitation questions for a public fundraising page, and association rules per sport | Medium |
| U | **Photo stories of minors and bystanders (new 2026-10-07, open for counsel)** | Highlights can now carry **photo stories**: one photo or up to 10 in a swipeable set, public only (no Vault), athlete tag and caption required, an optional description per photo (≤ 200 characters). Photos routinely show people who are not the tagged athlete — teammates, siblings, other people's children, crowds. Today's controls: the uploader must confirm *"I took these photos or have permission from the people in them"* plus the existing marks line, and Game Day adds a real-photos line; reports use the existing reasons and hide thresholds (fake footage / impersonation / rights leave the feed for review; athlete or guardian reports hide); admin removal takes the story out of `reel_photos_feed`. **Not built:** per-photo tagging or consent from people shown, face blurring, a takedown request path for parents who have no account, a CSAM vendor pipeline (row E, §5.5), and deletion of the stored image files when a story is removed (the database rows cascade; Storage objects are not part of the design). Counsel: whether uploader attestation is enough when other minors appear; whether a guardian's consent is needed for an untagged minor; a takedown channel and response time for non-users; COPPA and state age-appropriate-design exposure if under-13 bystanders appear; school photo policies; how long removed images may be kept. Design: `docs/engineering/design/PHOTO_STORIES_DESIGN.md`; copy: `data/contentRights.ts`, `docs/product/VOICE.md` §Photo stories | Medium–High (minors) |
| V | **Photo metadata and GPS removal (new 2026-10-07, open for counsel)** | Photos of minors must not carry location. The picker asks for no EXIF and re-encodes, then `stripJpegMetadata` (`services/MediaUploadService.ts`) removes APP1–APP13, APP15, comment segments and anything after the image end (EXIF/GPS, XMP, IPTC, ICC, maker notes), keeping only the image data, APP0 and APP14 (colour). A photo that is not a well-formed JPEG is **refused, never uploaded uncleaned**. Unit tests prove the segments are removed; **not yet verified on real iPhones and Android phones** (orientation after stripping, HEIC conversion, whether anything survives) — DEVICE_QA gate. Images go to the **public** `reels` bucket (anyone with the URL can view). Still open elsewhere: **video uploads are not stripped** ([DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md) §3.3), and a caption or description can still reveal where a child lives or will be. Counsel: whether this meets data-minimization / reasonable-security expectations for minors' images, what the Privacy Policy must say, whether public URLs for minors' photos are acceptable before signed URLs exist | Medium |
| W | **Tagline "Elevate their opportunities" (new 2026-10-07, open for counsel)** | Owner-approved message **"Donate. Elevate. Celebrate."** with *"Support their journey. Elevate their opportunities. Celebrate their story."* appears on the first-open welcome, at the top of the donate sheet's Amount page, under an athlete's profile Donate button, in PUBLIC/STORY and the draft store listing (`docs/product/STORE_LISTING.md`, not submitted). Risk: "elevate their opportunities" could be read as a promise of recruiting, scholarships, exposure to coaches or NIL value — deceptive-advertising exposure (FTC / state consumer law) and, for high-school athletes, an association reading donations as a recruiting inducement or extra benefit (rows A, D). Mitigations in place: Donate stays the only money verb; the 90 / 10 disclosure and "never for a play or a stat" line are unchanged; the line is plain text, not a button; VOICE forbids outcome wording ("get recruited", "get seen by coaches"); the store draft says Tapua'i does not promise recruiting, scholarships, exposure or NIL deals. Counsel: approve the wording for app and store, whether a visible qualifier is required next to the tagline, and whether any association objects to "opportunities". Copy: `data/malo.ts` (`TAGLINE_HEADLINE`, `TAGLINE_LINE`), `docs/product/VOICE.md` §The message | Medium |
| X | **Books desk tax wording and pass-through money (new 2026-10-12, open for CPA + counsel)** | The admin-only Books desk (`/admin/books`, BOOKS-01) treats the family's 90% of each donation, the athlete's 80% of a Vault sale and an operator's 85% of a booster sponsorship as money **held for others** (liabilities), not Tapua'i income, and says so on screen and in the tax pack. It also says donations to individuals are not tax-deductible and that Tapua'i does not issue donation receipts for tax purposes, flags payees at or above $2,000 a year for 1099 review (threshold to confirm each January), lists Drip sales by month because sales tax may apply, and shows quarterly net with federal estimated-tax dates. Admin copy only; no fan-facing change. CPA: entity and return lines, 1099-K reconciliation while money sits in Tapua'i's Stripe balance, W-9 collection and 1099s for athletes (minors through guardians), operators and future filmers, sales tax nexus for Drip and Vault. Counsel: money transmission while holding family money (STATE §6 item 8 recommends Connect destination charges). Design: `docs/engineering/design/BOOKKEEPING.md` §8 **2026-10-13 (for the Facilitator + counsel):** screens minors see say money is "recorded for your family account", not received or held, because payouts are not live and money sits in Tapua'i's Stripe balance. Older custodial lines still say "held for you in … custodial account", "yours to move" and "You hold this for {name}"; whether "held" is accurate depends on STATE §6 item 8 (how money reaches families / money transmission). Withdrawal requests are not capped against the family share either (same decision). | Medium |
| Y | **Operator location (new 2026-10-13, open for counsel before Wave 3)** | The sideline console records where an operator checked in. It is stored only to about 1 km, kept 30 days and then deleted automatically, read only by admins (DATA-01-F3, PRIVACY_ENGINEERING). Operators' age is not checked yet (the demo PIN has no account), so a check-in can place a minor at a game. Counsel to confirm the notice and consent wording before paid game-day gigs (Wave 3), and whether a yes/no "at the venue" replaces coordinates. | No, while it stays rounded, short-lived and admin-only. |
| Z | **Friend connections between minors and adults (new 2026-10-14, open for counsel)** | PRIV-01 adds two-way friends (still no messaging). An adult can send a minor a friend request, and friends see more of each other's profile. Controls built: new accounts private, social links only-me by default, 20 requests a day, "who can send me requests", blocking. **2026-10-14 (MINOR-01):** the guardian lock was replaced by supervision; teens default to requests from other teens only (adults are refused with the ordinary message, so teens are not revealed); 16–17 may open requests to anyone themselves; under-16s need their linked guardian's approval. Counsel to confirm whether minors should be able to receive requests from adults at all, or only with guardian approval, and the COPPA / state minor-account implications (row F). | Medium until counsel confirms. |
| AA | **Minor accounts: guardian consent, supervision and teen autonomy (new 2026-10-14, open for counsel; MINOR-01, written, not applied)** | Owner direction: a guardian is linked and signs a consent but is not "total dictatorship"; teens can go solo within the law; sign-up stays fast. Built: birth month and year; teen defaults (private, requests from teens only); a teen shares a one-time code, the adult (self-declared 18+) signs a **draft** consent form with a typed name (version and SHA-256 of the text stored; append-only, kept after account deletion), and the link counts once the teen confirms; either side unlinks; a guardian sees settings, counts (never who) and changes after linking, and for under-16s approves going public or open friend requests. Consent unlocks a public profile and payouts; **payouts only from the guardian on record** for the family account (admin-set custodial guardian); a typed adult age releases payouts only with the account's own Stripe payouts on (assumes Stripe checks the birth date — unverified). The form text (`data/guardianConsent.ts`) is a draft written by engineering for testing; counsel writes the real one. Counsel (all unverified, from memory): state minor social-media laws (consent / age-check laws, many enjoined) and whether "teens solo" is allowed; app-store age laws and the store's age signal; whether a typed name satisfies E-SIGN/UETA for each permission and whether the guardian's identity or relationship must be verified; how long consent records are kept (claims by minors may toll until 18); custody conflicts and two guardians disagreeing; holding donations for a teen without consent (rows M, X); the handover age. See also `docs/legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md`. **2026-10-14 (VERIFY-02, owner decisions):** an earner's SSN goes to Stripe only and Tapua'i never stores it; a guardian receives a minor's money only after Stripe verifies their identity and tax ID and the school confirms in person they are the parent on record (fallback: support views a birth certificate or court order and keeps no copy); Stripe Identity (ID + selfie, biometric laws) only for disputes; payout flags change by hand only with a reason and a second admin. Counsel / CPA: whose TIN is on the 1099-K, gifts vs income, document-review handling, retention of verification records, Stripe's minor / account-holder age rules. Plan: `docs/engineering/design/PAYEE_VERIFICATION_PLAN.md`. | Medium until counsel confirms; the draft form must not reach real families. |
| AB | **Workout challenges between minors and adults: presets and invites (new 2026-10-16, open for counsel; CHAL-01 part 1a, written, not applied)** | On a public Train Like Me workout, a signed-in account (13+) can tap one fixed response — "Challenge accepted!", "Love this workout", "I'm in", "Did it! 💪" — and invite an accepted friend: "{name} invited you to try {athlete}'s workout", in Activity only, never a push. There is **no free text and no messaging** (row S stands), no list of who responded, and no money, ranking or prize; the only reward is a private, noncash "Challenge finisher" badge after "Did it!" on 3 different workouts. Controls built: counts hidden below 5; on a **minor athlete's** post only the athlete and their guardian see counts; "Allow challenges on my workouts" is **off by default for minors** (and unknown ages) and a change shows in the guardian's supervision summary, which also counts invites received in 7 days (never who); invites only between accepted two-way friends (MINOR-01 teen friend rules apply, row Z), 5 a day and 1 per pair per day; a recipient can mute one person or everyone, and a mute or block drops invites silently; admins can mute or suspend a sender with a recorded reason; invites deleted after 30 days; switch off by default and refused until PRIV-01 / MINOR-01 are applied. Adults and minors can still exchange presets and invites when they are friends. Counsel: whether preset reactions and friend invites between adults and minors need guardian approval or should be teen-to-teen only; whether "Did it!" self-reports around physical exercise need a safety line (injury, supervision) or Terms language; state age-appropriate-design and minor social-media rules for engagement features and badges; whether showing a minor athlete's counts to the guardian (not the public) is enough. Try videos (1b) are separate and wait for the Vault lock-down and a pre-moderation pipeline (row E). Design: `docs/engineering/design/WORKOUT_CHALLENGES_DESIGN.md` §6. | Medium until counsel confirms. |
| AC | **Workout safety notice and Beyond phrase (new 2026-10-16, open for counsel; SAFETY-01 built locally with the proposed option A wording; SQL written, not applied)** | Owner asked for a "don't try this at home" notice on workouts too risky to copy alone, and for a catchy phrase kids will use for their daily Beyond workout. Proposed label "⚠️ Coach-level move" with sheet text "Try this only with a coach or spotter. Workout ideas, not medical advice. Warm up and know your limits." (alternatives "Pro move — don't try this solo", "Don't try this at home"); a standing line on workout content; uploader switch, reviewer add/remove, report reason that never hides. Counsel: final wording; whether a notice helps or hurts on liability; Terms language about exercise risk and minors; whether labelled workouts must be excluded from friend challenges (row AB). Phrase candidates Seki Set, Extra Rep, OT, Two-a-Day: trademark / common-use search before adoption, and a cultural review for any island word (avoid sacred terms such as tapu or mana). Design: `docs/engineering/design/COACH_LEVEL_LABEL_DESIGN.md`. The proposed badge, sheet and switch are in the local app. Counsel has not approved that wording. Labelled workouts still allow “I’m in” and invites, and the notice is shown. Teen pre-publish review is not built. | Medium until counsel confirms. |
| AB | **Life Playbook: financial education for minors (new 2026-10-14, simplified 2026-10-15, open for counsel; QUIZ-04, written, not applied)** | Optional trivia that teaches simple everyday money and life facts (planning before spending, saving, spotting scams, good everyday choices) to accounts 13 and older, framed as education, not advice, with a trusted-adult line ("For real decisions, talk with a parent, guardian, school counselor or another trusted adult."). **Owner 2026-10-15:** keep trivia simple and fun — simple facts only, no complex questions that need expert verification; four chapters, all 13+ (Money Huddle, Savings Season, Scam Defense, Smart Plays); **no credit, tax or loan content**, no money amounts, prices, percentages, rates or years, so nothing goes out of date; **no CPA gate** and no named finance / tax reviewer — one admin approves each question as for sports trivia. Built controls: off by default (`trivia.life`) and opt-in per account with its own notice (draft `life-playbook-v1-testing`); accounts eligible for trivia (and 13+ accounts without a recorded age) only; no questions about the player's own money or family; automatic copy rules refuse advice ("you should …"), brands, Tapua'i money words (donations, Rally, family accounts, payouts, Aura, gifts, Mālo), NIL and eligibility, tax / loan / credit score / APR, money figures and years; Scam Defense explanations end "Tell a trusted adult and use Report."; private badges and levels; admin statistics aggregate only. Counsel (unverified, from memory, nothing checked): the notice wording; whether education of this kind for minors creates any adviser or state financial-literacy rule exposure; COPPA / state minor rules for 13–15 content and the opt-in; gifts and NIL stay out of the content (row X). | Low–medium until counsel reviews the notice; switched off and testing-only. |
| AC | **Athlete fun facts from minors (new 2026-10-15, open for counsel; QUIZ-05, written, not applied)** | Athletes (13+) can share up to three short preset fun facts (pre-game meal from a list, hype song, favorite pro athlete, pre-game ritual, hidden talent, other sport they love) that become a small share of trivia questions. Built controls: off by default (`trivia.athlete_questions`, share 0); no submissions without a recorded 13+ age; under 16 a linked parent or guardian approves first through MINOR-01 (approve or decline only), then one admin approves with a checklist (no sponsor or business, no place, no schedule); a server filter refuses links, handles, numbers, addresses, days and times, the athlete's own school or town, emoji, not-okay words, brands and Tapua'i money words; never asked: hometown, schedule, birthday, family or pet names, first school; shown only where the athlete's `fun_facts` audience allows (default friends, 13–15 capped at friends), only to followers or people who started from the athlete's card, never across a block; drawn only for verified athletes; the athlete can remove a fact at any time and the text is deleted at once (also on account deletion, unlinking, or an under-13 block); the athlete's card after the reveal has no Donate button or money words; monthly counts only as buckets (5+ / 10+ / 25+) and never who. Counsel (unverified, from memory): whether the opt-in copy ("Share a fun fact? … a parent or guardian approves if you're under 16 …") is sufficient consent for minors' personal information shown to other users (COPPA does not apply at 13+, but state minor-privacy and social-media laws may); whether a guardian approval recorded in-app is enough; **NIL-adjacent content**: a favorite pro athlete, song or meal could read as an endorsement, so the checklist refuses sponsors and businesses and no fact may be tied to a donation, Rally or reward; whether naming real pro athletes in curated wrong answers needs care; declined text is purged 30 days after the decision (security review 2026-10-15); counsel to confirm the period. | Medium until counsel reviews the opt-in and NIL framing; switched off and testing-only. |
| N | **School staff confirming students** | An athletic director or coach confirms a student is on their roster by signing a Tapua'i form. Counsel: FERPA (roster status is directory information in most districts, but check), whether the school must consent before staff act, and the record we keep (staff name, signature, time) | Medium |

**Short answer for investors:** The app does not automatically fail because “NIL exists.” It **can** fail if high-school associations treat Mālo as an extra benefit or pay-for-play, or if payouts to minors are not structured as parent-controlled custodial funds through a licensed processor. Those are counsel-and-association problems, not code problems.

College NIL (NCAA) is the **wrong** analogy. High school is usually **stricter**, and it is **state association + school district**, not one national NIL statute.

---

## 4. Pack A — Legal authorities (schools, associations, AG, payments)

Use this as a **cover letter outline** for UHSAA (or the relevant state association), a district athletic director, and payments counsel. Do not send this file raw.

### 4.1 What we would tell them we are

- A media and community app for game-day highlights and school identity.
- Mālo is a **voluntary gift of support**, not compensation for a statistic, a win, or a ranking.
- Cheer polls have **no entry fee and no prize**.
- Aura points **cannot be bought as a security and cannot be withdrawn as cash** (must remain true).
- We will **honor a written direction** to freeze Mālo for a named athlete, team, or school.

### 4.2 What we would ask them to confirm in writing

1. Whether a student-athlete in that association may **receive a cash gift** from fans via a third-party platform if it is not tied to performance.
2. Whether **school names, logos, and game footage** may appear in a commercial app.
3. Whether **sideline operators** (scorekeepers) may use a third-party console.
4. Age: whether any user under 18 may have an account; whether any user under 13 is prohibited.
5. Whether a **parent-owned Stripe / custodial** account is an acceptable payee.
6. The owner's custodial rules (2026-09-29, `PARENT_PAYEE_CONNECT_DESIGN.md` §7): the athlete sees
   every gift, approves every guardian withdrawal, and takes control at 18. Counsel to confirm the
   handover age, account form and applicable state rules, and whether these rules make the
   guardian's account a UTMA custodianship with its own disclosures. The earlier draft used
   Utah age 21 as an example; that assertion has not been validated for this account model
   in the current review and must not be treated as a settled statewide handover rule.

### 4.3 What we would not claim

- That Tapua'i is “approved NIL.”
- That demo PIN scoring is an official book.
- That flagged Reels are a complete child-safety program.

### 4.4 Likely statutes / regimes to put on counsel’s checklist (US)

Names only — counsel fills the analysis:

- State high-school athletic association bylaws (amateurism, awards, extra benefits)
- State NIL or publicity-rights statutes **as applied to minors / high school** (often narrower than college)
- COPPA (under 13) and state child-privacy laws (e.g. age-appropriate design)
- Stripe Connected Account / TOS (typically **18+** for Express)
- Uniform Transfers to Minors Act / custodial accounts
- State money-transmitter statutes
- Copyright (game film), right of publicity, and school trademark
- FTC endorsement / advertising if boosters pay for placement
- IRS information reporting for payees

---

## 5. Pack B — Investors (diligence questions we should answer, not dodge)

1. **Association letters.** Do we have a written position from even one state association? (Today: no, unless obtained outside this repo.)
2. **Payee of record.** Who is the Stripe account holder — the minor, the parent, a trust, or Tapua'i? The Connect flow is built as a US **individual** Express account. That likely **does not fit a 16-year-old**.
3. **Fund flow.** Does money ever sit in an operational account? `queueCustodialPayout` can **queue for admin disbursement**. That is the money-transmitter trap if it goes live as a wallet.
4. **Kill switch.** Can we stop Mālo per athlete / school in hours? Report / Hide is per-user, not a compliance freeze.
5. **Moderation.** `is_flagged` is a boolean plus `reported_by`. There is no CSAM pipeline, no human queue SLA, no school-takedown portal in this codebase.
6. **Security.** Demo RLS is documented as open. A diligence memo should treat production security as **unfinished**.
7. **Representations.** The fan copy now discloses 90% to the family account and 10% to Tapua'i (2026-09-29, row L). It stays a representation to keep true once real Stripe application fees, delays and chargebacks exist. Since 2026-10-13 the family side shows the same split back to families (amount recorded for the family account and the amount Tapua'i kept, from the books), so both sides must stay true together.
8. **IP.** Sample videos in the demo are third-party sample files. Production needs licenses for real game film.

A round can still be raised as a **prototype + legal workstream** company. It should not be raised as “NIL for high school, already cleared.”

---

## 6. Pack C — Public (parents, athletes, press)

Safe public lines (must stay consistent with the product):

- Watch highlights, cheer your school, support athletes.
- Mālo is optional and is a gift, not a bet.
- Polls are cheers, not gambling.
- Parents should expect a real consent and custodial design before any live payout. The Parent screen now records custodial set-up and withdrawal requests the athlete must approve, but **no money moves yet**, and the copy is pending counsel review.
- Schools and associations may restrict participation; we will comply.

Avoid:

- “Get paid for that touchdown.”
- “Invest in this athlete.”
- “Aura is worth money.”
- “We replaced the booster club.”
- “Elevate their recruiting.” / “Get seen by coaches.” — the tagline is “Elevate their opportunities”, never an outcome (row W).

---

## 7. Liabilities to budget (non-exhaustive)

| Liability | Typical shape |
| --- | --- |
| Eligibility harm | Athlete / parent claim if using the app costs a season |
| Unlawful payment to a minor | Contract void / restitution / AG |
| Copyright / likeness | Takedown + damages on a viral clip |
| Data incident | Open RLS + video of minors is a worst-case mix |
| Consumer advertising | Fee disclosure vs “100%” |
| Chargebacks on Mālo | Platform eats them unless terms say otherwise |
| Operator error | Wrong score on a “live” banner |

Insurance (media / cyber / E&O) is a **broker** conversation after counsel sketches the payee model.

---

## 8. Recommended work before live keys

Engineering (this repo already points here):

1. Tighten RLS; authenticated operators; kill demo PIN.
2. Age gate; block under-13; do not mint Express accounts for minors.
3. Parent-of-record as the Connect account; athlete as beneficiary in metadata only, if counsel agrees.
4. Never queue Mālo in an admin wallet — Connect destination or licensed disbursement partner only.
5. School / athlete freeze flags that disable Mālo and exclusive checkout.
6. Moderation queue beyond `is_flagged`.
7. Replace the disclaimer with whatever counsel’s fee waterfall actually is.

Legal / BD (outside this repo):

1. Retain sports + payments counsel in the first launch state.
2. Written association and district positions.
3. Stripe production + Connect compliance review (including **minors**).
4. Terms of Use, Privacy Policy, Parental Consent, Creator / athlete agreement, Booster insertion order.
5. Tax reporting design.

Until those exist, **keep Stripe in test mode.** That is a control, not a footnote.


## UX-02 implementation evidence — 2026-10-07

The Donate popup is reorganized into Amount / Options / Review with financial disclosure
on Review. This changes presentation: the 90 / 10 split, optional tip for Tapua'i starting at
No tip, unchecked card-fee coverage, totals and applicable held-gift notice retain their existing
rules. No approved legal conclusion, fee model or payout decision is revised. Brand copy and
payment/device verification remain subject to the existing recorded gates. Checkout now blocks
a new charge after reported payment success even if recording or counters fail, and labels that
failure separately. These local UI guards leave client-written `tips` and the authoritative-credit
work in ROADMAP Phase 1a unresolved; they make no settlement or reconciliation guarantee.
The card-fee accessible label includes the exact optional fee and unchanged family share.
Source/evidence map:
[MENU_STYLE_MAP.md](../engineering/MENU_STYLE_MAP.md), [WORK_QUEUE.md](../agents/WORK_QUEUE.md) UX-02.


### Profile navigation and copy follow-up — 2026-10-07

Compact Profile actions keep the named athlete's Donate entry, direct Goals/wishlist access, and
existing checkout disclosures/locks. Subscribe shows the unchanged price and announces one-time
exclusive access, matching the existing non-renewing checkout. Share remains Share & Donate in
accessibility wording. Aura points are labeled separately from career stats; donations are not tied
to a play/stat. This records UI wording/navigation only; no fee, legal conclusion or payment-flow
change, and native PaymentSheet verification remains pending.

## Compliance routing — 2026-10-10

**Historical source/routing snapshot, not current implementation instructions.** The
2026-10-15 whole-team reconciliation supersedes the older checkbox/incomplete-source
instructions below with the local MINOR-01 birth-month/year and capability gates,
VERIFY-02 provider-only SSN/guardian review decisions, and BEYOND-01/CHAL-01 contribution,
moderation and private-history/export controls. Those controls do not close legacy
account-wide export/deletion, staffed appeals, hosted/private-media or public-release gaps.
Use [STATE](../STATE.md), [TEAM_STATUS](../agents/TEAM_STATUS.md),
[minor-account design](../engineering/design/MINOR_ACCOUNTS_DESIGN.md),
[payee-verification plan](../engineering/design/PAYEE_VERIFICATION_PLAN.md) and
[BEYOND-01](../agents/BEYOND-01.md) for current assignments. The owner selected US-only,
Utah-first planning; subsequent states and all public/live-money gates remain under
counsel, school/payment, independent domain and owner review. No current-law conclusion,
finished policy or launch approval is issued by this annotation.

This section records product controls checked in the repo on 2026-10-10 and names who may do the next product work. It does not decide what the law requires. It does not draft a Privacy Policy, Terms of Use, DPA, SLA, parental consent, liability cap, or athlete agreement. Company paper stays in the existing order in [COMPANY_PHASES.md](../company/COMPANY_PHASES.md) (L0 counsel, then L1 LLC, L2 trademark, L3 patent triage, L4 product paper). Counsel is still the owner's step. This pass does not hire counsel, form an LLC, or send an association letter.

### Already in the product (checked this pass)

- **Terms acknowledgement.** `LEGAL_TERMS_VERSION` is `2026-09-27` in `apps/mobile/src/frontend/data/legal.ts`. `LegalAckToggle` is on Apply for Athlete Verification (`VerifyAthleteModal`) and Connect Bank Account (`PayoutSetupCard`). The modal text calls itself a prototype summary, not a finished Terms of Service or Privacy Policy. `RoleSwitcherModal` also renders `LegalAckToggle` when `needsRoster`; that branch was not fully traced this pass.
- **13+ gate.** Create account and magic link stay off until "I confirm I am 13 years of age or older." (`SoftWallModal`, `softWallEmailGates`). Sign in for an existing email account is not blocked by that box. `AgeConfirmModal` can record `profiles.age_confirmed_13_plus` for a signed-in user who does not yet have it. This is a confirmation checkbox, not a checked date of birth.
- **Donation disclosure.** The donate sheet is Amount → Options → Review. The 90 / 10 line is on Amount (`donationSplitLine`). Options start at "No tip" (`tipPercent` 0) and the card-fee box starts unchecked. Review shows where the donation goes, `MALO_DISCLAIMER`, the test-payment line (`COMPLIANCE_PAYMENT`), and the gift-record notice. When the athlete is not verified, `TipSheetModal` shows `GIFT_HELD_NOTICE` ("Payouts aren't set up for this athlete yet — your donation is held until their family finishes payout setup.").
- **Footage confirmations.** Video checks are permission, sound, and marks, plus a real-footage line for Game Day (`RIGHTS_VERSION` `2026-10-01`). Photo stories use a photo-permission line, marks, and a real-photos line for Game Day (`PHOTO_RIGHTS_VERSION` `2026-10-07`).
- **Reports.** `REPORT_REASONS` requires a named reason (fake or AI-made footage, wrong athlete, impersonation, music/logo/broadcast, inappropriate, other). The database (`report_reel`) hides a clip immediately for an athlete or guardian report or for fake footage, impersonation, or rights. A human review queue, strikes, and appeals are still described as not built in [STATE.md](../STATE.md) §5 and [DEPARTMENT_PLANS.md](../agents/DEPARTMENT_PLANS.md).
- **No published Privacy Policy.** The only privacy inventory in `docs/` is [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md). In-app copy says the summary is not a Privacy Policy.
- **Export and deletion.** Still not built. Re-checked the same day: no account-export or account-deletion screen or RPC (`DATA_PRIVACY_MAP` §3.4, WORK_QUEUE P1-01).
- **Exclusive.** Checkout mints a Stripe PaymentIntent (`createPaymentIntent.ts`), not a renewing Stripe subscription. Fan labels in `exclusive.ts`, upload, and Vault sentences say one-time Exclusive access and name the price without `/mo`. Booster prices in `formatSponsorDollars` have no period. The athlete profile button's accessibility label says "one-time exclusive access." Auto-renewal disclosure stays off while the charge is a PaymentIntent.
- **Stripe test mode.** The donate review line says "Test payment only. This does not send live money." The PaymentIntent handler comment says test mode. The key file was not opened this pass.
- **Payouts blocked.** When `STRIPE_SECRET_KEY` is set and the profile has a linked account with payouts enabled, `createPayout.ts` returns 503 and does not transfer. If that key is missing, the same route still calls `queueCustodialPayout`. That call is not the 503 path.
- **Client still inserts `tips`.** After PaymentSheet success, `useTipCheckout` inserts into `tips`. STATE §6 item 3 still says not to turn on webhook crediting beside that insert.

Tracker inventory, hosted SQL, and a device pass were not re-checked this pass.

### Who does the next product work

No row below assigns anyone to draft legal text. "Stopped" means the owner and counsel have not authorized that step. Wave 0 does not include hiring counsel, an LLC, or an association letter.

| Gap | Already documented where | Team to do the next product work | What they may do now | What stays stopped until the owner and counsel |
| --- | --- | --- | --- | --- |
| No published Privacy Policy, Terms of Use, parental consent, or athlete agreement | LEGAL_BRIEFING §8; COMPANY_PHASES L0 and L4; DEPARTMENT_PLANS Legal "What we need" | None. Do not assign a drafting team | Keep the in-app summary labeled as a prototype at `LEGAL_TERMS_VERSION` `2026-09-27` | Counsel writing those documents; retaining counsel; LLC; association or district letter |
| Account export and deletion not built | DATA_PRIVACY_MAP §3.4; WORK_QUEUE P1-01; DEPARTMENT_PLANS Legal item 4 | `PRIVACY_ENGINEERING`, `BACKEND`, `PRODUCT` | Leave the gap named. Do not build a delete or export path in this wave | Agree what must be kept (donation records, other people's clips) before any build |
| 13+ confirmation is a checkbox | `SoftWallModal`, `AgeConfirmModal`, `lib/auth.ts`; DEPARTMENT_PLANS Age row | `MINOR_SAFETY` | Keep Create account and magic link behind the checkbox. Keep Sign in available for an existing account. Keep under-13 out of the product | A counsel parental-consent document; any under-13 experience |
| Donation review lines and the held-gift sentence | TipCheckout; `GIFT_HELD_NOTICE`; product-facts block; UX-02 evidence above; STATE §6 items 9 and 10 | `COMMERCE`, `VOICE` | Keep 90 / 10, No tip as the default, the fee box unchecked, the test-payment line, and the current held sentence | Live Stripe keys; changing the fee split; treating the held sentence as a finished legal notice |
| Footage and school-mark confirmations | `data/contentRights.ts`; DEPARTMENT_PLANS Footage row; LEGAL rows U and V (photo stories) | `CONTENT_RIGHTS` | Keep the video and photo confirmation checkboxes required | A counsel decision on school marks or photos of minors; contacting a school |
| Reports without a human queue | `REPORT_REASONS`; STATE §5; DEPARTMENT_PLANS Trust and Safety | `TRUST_SAFETY`, `MODERATION` | Keep a reason required and the current hide rules | Building the review queue, strikes, or appeals; contacting a family |
| Exclusive PaymentIntent; fan labels match the one-time charge | `createPaymentIntent.ts`; `AthleteProfileView` accessibility label; `exclusive.ts`; `data/sponsorships.ts`; WORK_QUEUE Vault disclosure | `VOICE`, `COMMERCE`, `BILLING` | Leave auto-renewal disclosure off. Fan labels name one-time Exclusive access and the price without `/mo` | Turning Exclusive into a renewing subscription |
| Test mode, blocked payouts, and the client `tips` insert | `COMPLIANCE_PAYMENT`; `createPayout.ts`; `useTipCheckout`; STATE §6 item 3; WORK_QUEUE P1-05 | `COMMERCE`, `CONNECT`, `CUSTODIAL` | Leave the test-payment line, the 503 payout response, and the single client insert | Webhook crediting, live keys, destination charges, and a guardian payee design |
| Store listing and any public campaign | DEPARTMENT_PLANS Marketing; WORK_QUEUE BRAND-01 | `MARKETING` | Keep the store listing a draft | Submitting the listing or contacting a family |
| Calling the app public-ready | DEPARTMENT_PLANS public gate; STATE §5 and §6 | `QA`, `OPERATIONS` | Re-run local checks when asked. Say the app is not public-ready | A public release, applying SQL, and any Wave 1 spend |
