<!-- Current money vocabulary separates individual gifts, program donations and optional platform tips. -->
# VOICE — money language (owner, 2026-10-22)

This naming map supersedes the September donation-everywhere framing below. It changes words,
not payment authority, tax status, eligibility, consent or the current test-mode allocation.
The checkout sweep follows the separate tip-model implementation; see the
[copy report](../engineering/evidence/GIFT_LANGUAGE_REPORT.md).

| Recipient / transaction | Required words | Example |
| --- | --- | --- |
| Individual athlete / family | **Gift**, **Give**, **Send a gift** | Support her season; gifts received |
| Booster club / school program | **Donation**, **Donate to the program** | Program donation; club's own status governs deductibility |
| Optional money to Tapua'i | **Tip Tapua'i (optional)** | Separate voluntary tip; never a fee or donation |
| Optional Stripe-cost coverage | **Cover the processing fee** | Separate from the gift and the optional tip |
| Athlete premium | **Subscription** | Subscription; not a gift benefit |
| Paid digital extra | **Purchase** | One-time Exclusive purchase; never bundled with giving |

Athlete gifts never use donation, donate, donor, fundraiser or charitable. Program donations
never use gift. A sponsorship or booster pass is not automatically a charitable donation;
ambiguous flows stay unchanged for owner classification. Internal names (`tips`, `donation_*`,
`malo`, routes, API fields) stay unchanged; report any visible raw identifiers.

Required athlete-page and gift-receipt line:

> Gifts to individual athletes are personal gifts and are not tax-deductible.

Required tip-step copy, held until the matching implementation and flag land:

> 100% of your gift goes to the athlete's family. Tips go to Tapua'i and keep the platform free for families.

`MONETIZATION_TIPS_ENABLED` must default OFF in the separate tip model. Tip and processing-fee
copy belong behind that flag. No copied statement may conceal a processor deduction or promise
settlement that has not occurred. Review the exact 100% line against net processing before release.

Keep optional choices unselected, final payment deliberate, recipient/held/error notices honest,
athlete thanks preset-only and Aura distinct from money. No pay for a play, recruiting promise,
tax-deduction implication for individuals or digital entitlement from giving.

Counsel owns final Terms and tax/eligibility review. The source guard checks wording; it does not
approve App Store compliance, charitable status, hosted config or delivery. Published Look copy,
signed consent and server-generated text require their own reviewed updates.

## Superseded history — September/October donation framing

The original text below is retained as a dated record. Its donation-everywhere terminology,
90/10 policy and old tagline are superseded by the owner's October22 naming/no-cut decisions.
It does not instruct new copy or certify the new model is implemented.

# Historical VOICE — how Tapua'i talked about money

**Owner decision (2026-09-29):** Tapua'i is a **donation app**. Families put their young athlete
somewhere their community can see the highlights and donate toward the athlete's sports costs — a
simpler way than running a GoFundMe. Every word about money should make that obvious, so a parent or
fan never has to guess what they are paying for, and donating stays easy enough that they do it again.

Checked two ways:

- **`pnpm copy:check`** (`scripts/check-copy.mjs`, runs in CI) — fails on the retired words below in
  on-screen copy in `apps/` and `packages/shared-types`.
- **VOICE agent** (`.claude/agents/voice.md`, call `VOICE`) — reads new or changed copy for what a regex
  can't catch: tone, money tied to performance, a missing "where does it go" line, confusing flows.

## The words we use

| Say | For | Example |
| --- | --- | --- |
| **Donate** | the button and the verb | "Donate", "Donate to Kaleo", "Donate $10" |
| **donation** | the money | "Your donation goes to Kaleo's family account" |
| **donors** | people who donated | "12 donors tonight" |
| **gear goal** | a Locker wishlist item | "Donate $5 to this goal", "Goal reached" |
| **Mālo!** | *thank you* — only as a thank-you | "Mālo! Your donation to Kaleo is on its way" |
| **family account** | where a minor's donations go | "held in the family account for Kaleo" |
| **Rally** | a named goal for a real sports cost | "New cleats — $140 of $250", "Share the Rally" |
| **Say thanks** | the athlete thanking a donor | "Say thanks 🙏", "Thanked ✓" |
| **tip for Tapua'i** | *only* the optional tip to the app at checkout | "Add a tip for Tapua'i (optional)" |

## Retired words (fan and admin UI)

| Don't say | Why | Say instead |
| --- | --- | --- |
| Mālo (as the money) | Nobody outside the islands knows it means money; it means *thank you* | Donate / donation |
| tip, tipped, tipping | Sounds like paying for a service — or for a play | donate / donation. **One exception:** the optional tip *to Tapua'i* at checkout — the line must name Tapua'i (`copy:check` allows "tip" only on a line that says Tapua'i) |
| backing, backed, backers | Vague about whether money moved | donated / donors |
| Chip In | Hides that it's a donation | Donate $5 to this goal |
| fund, funded, funding | Reads like an investment (STORY.md guardrails) | donate / goal reached |
| invest, investment | Securities language — banned for athletes | donate |
| earn / paid per touchdown, play, stat | Money tied to performance can cost a kid eligibility | donations for sports costs |
| "tax-deductible" (without "not") | Donations to individuals are not tax-deductible | "not tax-deductible" |

Code, tables and telemetry keep their names (`malo`, `tips`, `useTipCheckout`, `buttons.malo`) —
renaming them would break the database and live config. Only what people read changes.

## The message (owner-approved 2026-10-07)

> **Donate. Elevate. Celebrate.**
> *Support their journey. Elevate their opportunities. Celebrate their story.*

Code: `TAGLINE_HEADLINE` and `TAGLINE_LINE` in `data/malo.ts` — use the constants, never retype the
words. Where it appears:

| Place | What shows | Component |
| --- | --- | --- |
| First open | Headline + line, under the mission | `Onboarding/WelcomeOverlay` |
| Donate sheet | Headline only, one small line at the top of the **Amount** page; Options and Review stay plain | `TipCheckout` (inside `TipSheetModal`, and inline athlete cards) |
| Athlete profile | Headline only, a small line under **Donate** — only when this athlete can be donated to (not your own profile, not a community profile) | `Profile/AthleteProfileView` |
| Public docs and store copy | Headline + line | [PUBLIC.md](PUBLIC.md), [STORY.md](STORY.md), [STORE_LISTING.md](STORE_LISTING.md) (draft) |

Rules:

- **Donate stays the money verb.** The message sits beside the Donate button and the 90 / 10 line;
  it never replaces them. "Elevate" and "Celebrate" are never button labels for paying.
- **Elevate is about support, never an outcome.** It means the community helps with real sports
  costs so an athlete can keep going. Never write or imply that a donation, a Highlight or Tapua'i
  gets an athlete recruited, signed, a scholarship, "exposure" to coaches, a roster spot or an NIL deal.
  Say "elevate their opportunities", never "elevate their recruiting", "get them seen by
  coaches" or "boost their ranking" (LEGAL_BRIEFING row W; counsel open).
- **Plain text, not a heading.** On screen it is ordinary text under the screen title, so screen
  readers keep one title per screen.
- **No money tied to performance** applies here too — "Celebrate their story", not "celebrate the
  touchdown with a donation".
- The older lines in [STORY.md](STORY.md) ("Back every athlete." and the rest) stay usable; this is the lead message.

## Photo stories (Highlights)

Photo stories are one photo or a swipeable story of up to 10, posted to Highlights next to clips
([design](../engineering/design/PHOTO_STORIES_DESIGN.md)). They use the same words as clips:

- **Categories:** **Game Day**, **Train Like Me**, **Serve Like Me** — for photos and videos alike.
  ("Game Play" was renamed **Game Day** on 2026-10-07; the stored value stays `game_play`.)
- **Caption** (required) says what is happening; each photo can have an optional **description**
  (up to 200 characters). Write about the moment and the people, not money.
  - Serve Like Me: *"Our team helped clean the neighborhood park this Saturday."*
  - Train Like Me: *"5 a.m. footwork before school — week three."*
  - Game Day: *"Senior night with the whole family in the stands."*
- **Donate** on a photo story works exactly like a clip: the donation goes to the **tagged athlete's
  family account**, never to the person who posted the photos.
- **Never** in a caption or description: asking for money for a play, a stat or a win; naming or
  rating other people's children who did not agree to be shown; a home address, a school schedule or
  anything that says where a minor will be. Photo uploads remove location data, but captions can still
  give it away.
- Rights confirmation wording for photos: *"I took these photos or have permission from the people in them."*

## Every donate screen must answer three questions

1. **Who gets it?** The athlete named on the screen — through their family account — never the
   person who posted the clip. (`donationWhereItGoes` in `data/malo.ts`.)
2. **What is it for?** Their sports costs — fees, gear, travel. Never a play, a stat, a win or a rank.
3. **Is anything taken out?** Say it plainly, before the donor pays. **Decided 2026-09-29:** Tapua'i
   keeps 10% (which also covers card processing) and 90% goes to the family account —
   `donationSplitLine` at the top of the sheet, `MALO_DISCLAIMER` at the bottom, and a breakdown line
   ("On a $10.00 donation: $9.00 to Kaleo's family, $1.00 to Tapua'i. You pay $10.00.") that updates
   with the optional tip and the card-fee box (LEGAL rows L, Q, R).

**No pre-checked add-ons.** The optional tip to Tapua'i starts at "No tip" and the "cover card fees"
box starts unchecked. A donor opts in; we never make them opt out.

## Keep people donating (without pressure)

- Thank every donor right away ("Mālo!"), name the athlete, and show the running total or goal.
- **Athletes say thank you.** Every donation shows a "Say thanks 🙏" button to the athlete and their
  guardian; a filled Rally asks them to thank everyone, optionally with a clip of what it paid for.
  Thank-yous are five preset messages (`THANKS_MESSAGES` in `lib/donationThanks.ts`) — no free text, no
  replies — because many athletes are minors (LEGAL row S).
- Show progress toward a goal ("$140 of $250 — new cleats"), not rankings by dollars. Boards rank
  hype and views, never money.
- Make the next donation one tap, but never guilt ("Don't let Kaleo down") or fake urgency.
- Talk about the community ("the town showed up"), not what the donor gets back. Aura is
  reputation, never cash.

## Checkout failure copy

A failure after payment completes must say payment completed and identify the failed
recording/update. It must not imply no charge occurred or invite another payment. The optional
card-fee control announces its exact fee and the unchanged family share; the existing split and
No tip default remain. These messages do not promise settled credit or automatic reconciliation.

## Where the mission is said

- First open: `WelcomeOverlay` — `DONATION_MISSION`, then `TAGLINE_HEADLINE` + `TAGLINE_LINE`.
- Donate sheet: `TipCheckout` Amount page — `TAGLINE_HEADLINE` (small line), then `donationSplitLine(name)`;
  Review carries `donationWhereItGoes(name)` and `MALO_DISCLAIMER`.
- Athlete profile: `TAGLINE_HEADLINE` under the Donate button (donatable athletes only).
- Rally card and `CreateRallySheet`: "Raise money for a real sports cost" — never for a play, a stat or a win.
- Received-donations panel: "Saying thanks keeps people cheering you on."

- Home slang line default: "Donations go to the athlete's family • Seki = Awesome Play".
- `docs/product/PUBLIC.md` opening line.

**Live config note:** `app_runtime_config` copy published from `/admin/look` overrides the defaults
(`slangLine`, `activityLede`, `receiptsKicker`, …). If an old "Mālo" line was published, re-publish from
the Look desk after this change. `pnpm copy:check` only sees the code defaults.

**Older internal docs** (CHANGELOG history, AUDIT_REPORT, SCHEMA, ROADMAP) still say "Mālo" for the
money. Read it as "donation"; fix it when you touch the section.

**Legal:** LEGAL_BRIEFING row Q covers the switch to "donate". Counsel owns the final wording of the
tax line and anything about fees.


## Compact Donate review (2026-10-07)

Amount / Options / Review may use warm, sports-inspired presentation. Financial review remains
plain: donation, optional **tip for Tapua'i**, optional card-fee coverage, total and the 90 / 10
split. Start optional choices at No tip / unchecked; do not imply that Next charges the card.
Donation recipients and held-gift notices remain explicit. Layout changes do not approve new
money rules or legal claims.
