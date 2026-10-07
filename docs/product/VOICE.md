# VOICE — how Tapua'i talks about money

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
