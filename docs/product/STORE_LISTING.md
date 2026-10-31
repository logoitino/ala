<!-- Historical store draft retained so superseded fee/language choices stay reviewable. -->
> **Superseded 2026-10-22:** the draft below used donation language for individuals and the old
> 10% share. Use [the current gift listing/review draft](APP_STORE_GIFT_DRAFT.md), subject to
> the tip-model, processing disclosure and counsel gates. Neither draft is submitted.

# Store listing — App Store and Google Play (DRAFT)

**Status: DRAFT — not submitted.** Written 2026-10-07 by VOICE + MARKETING (WORK_QUEUE BRAND-01).
**LEGAL review required before any submission**, and counsel sign-off on LEGAL_BRIEFING rows L
(90 / 10 split and App Store 3.2.1(vii)), Q ("donate" language), U (photo stories of minors) and
W (the "Elevate their opportunities" line). Nothing here is published or authorized for publication.

Sources this copy must agree with: [PRODUCT_FACTS.md](PRODUCT_FACTS.md) (generated numbers),
[VOICE.md](VOICE.md) (money words), [STORY.md](STORY.md) (message and guardrails),
[PUBLIC.md](PUBLIC.md). If a fact changes there, change it here. No prices are quoted in the listing
on purpose: store pages are hard to update and the live amounts come from app config.

---

## Before this can be submitted

1. **Live money.** Stripe is in test mode (PRODUCT_FACTS). A public listing that invites donations
   waits for production keys and the Wave 1 legal gates ([ROADMAP.md](ROADMAP.md) release waves).
2. **App Store 3.2.1(vii).** As LEGAL row L records, a gift may skip in-app purchase only if 100% goes
   to the receiver; the 10% Tapua'i share may push iOS donations into IAP. The description below
   discloses the 10%; counsel decides whether iOS can ship it that way.
3. **Store name.** `apps/mobile/app.json` still says `ala-sports`. The owner picks the display name;
   "Tapua'i Sports" below is a proposal.
4. **Age rating and audience.** Accounts are 13+ (self-attested). The rating questionnaire,
   user-generated content answers and the "made for kids" choice are counsel's call (rows E, F, U).
5. **Feature truth on submission day.** Only list what the submitted build does. Photo stories are
   marked *(if live)* — drop that line if the database change is not applied to production.
   Drip (merch) is off for Wave 0 and is not mentioned.
6. **Screenshots.** Use real, consented athletes only (STORY guardrails), or clearly fictional demo
   data. Press images in `docs/company/press/` may be stale.

---

## Fields

### App name (≤ 30 characters)

**Tapua'i Sports** (14) — proposal, owner to confirm.

### Subtitle — App Store (≤ 30 characters)

**Donate. Elevate. Celebrate.** (27)

### Short description — Google Play (≤ 80 characters)

**Support their journey. Elevate their opportunities. Celebrate their story.** (74)

### Promotional text — App Store (≤ 170 characters)

> Watch young athletes' highlights, cheer your school, and donate toward real sports costs — fees,
> gear, travel. Support their journey. Celebrate their story.

(156 characters.)

### Description (both stores, ≤ 4,000 characters)

> **Donate. Elevate. Celebrate.**
> Support their journey. Elevate their opportunities. Celebrate their story.
>
> Tapua'i helps families cover their young athlete's sports costs — fees, gear, travel — with
> donations from their community. Watch highlights, cheer your school, and donate to an athlete in a
> few taps.
>
> **Watch**
> Full-screen Highlights of real athletes, tagged to the player and their school: Game Day, Train
> Like Me and Serve Like Me. Drop Aura, Seki and Flex on the moments you love.
> *(if live)* Photo stories — one photo or a swipeable set — show the whole journey: practice,
> service, team and family.
>
> **Donate**
> Donate right from a Highlight or an athlete's profile. Your donation goes to the athlete's family
> account for their sports costs — never to the person who posted the clip, and never for a play or
> a stat. Before you pay, the app shows the split plainly: 90% goes to the athlete's family account
> and Tapua'i keeps 10% to run the app, including card processing. You can add an optional tip for
> Tapua'i; it starts at No tip and never comes out of your donation. Donations to individuals are
> not tax-deductible.
>
> **Rally**
> Families can start a Rally for a real sports cost — season fees, gear, travel, camps — and share
> it. Everyone can watch the progress bar fill.
>
> **Celebrate**
> Athletes say thank you to every donor with a tap. Aura points and tiers show who keeps showing up
> for the community. Aura is reputation in the app — not money.
>
> **Built for students first**
> High-school athletes are mostly minors. Money for a minor goes to a guardian-held family account
> that the athlete can see. Report any clip or photo that should not be public. Athletic association
> rules on gifts vary by state; an athlete's school or association can say no, and we will follow it.
>
> Tapua'i does not promise recruiting, scholarships, exposure to coaches or NIL deals. Donations
> help with costs; the athlete's story is theirs.

(About 1,900 characters with formatting removed — well under the limit.)

### Keywords — App Store (≤ 100 characters, comma-separated, no spaces after commas)

`gift,highlights,athlete,high school,college,team,school spirit,family,game day,rally`

(88 characters. Leaves out words already in the name and subtitle, which Apple indexes anyway.
Historical draft — current gift listing: [APP_STORE_GIFT_DRAFT.md](APP_STORE_GIFT_DRAFT.md).)

### Category

Primary: **Sports**. Secondary (App Store, optional): **Social Networking** — counsel to confirm it
does not change age-rating or UGC obligations.

---

## Copy rules this listing follows

- **Donate / donation** is the only money verb ([VOICE.md](VOICE.md)). "Tip" appears only as the
  optional **tip for Tapua'i**. No "fund", "invest", "backing" or "Chip In".
- **Three answers** are in the description: who gets it (the athlete's family account, not the
  uploader), what for (sports costs), anything taken out (Tapua'i keeps 10%, shown before paying).
- **"Elevate" is never an outcome.** No recruiting, scholarship, exposure, ranking or NIL promises;
  the description says so in its last paragraph (LEGAL row W).
- **No money tied to performance** and no ranking of kids by dollars.
- Keep the store copy and in-app tagline identical: `TAGLINE_HEADLINE` / `TAGLINE_LINE` in
  `apps/mobile/src/frontend/data/malo.ts`.

## Open for LEGAL / counsel

- Rows L, Q, U, W in [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) — wording, IAP treatment of the
  10%, charitable-solicitation questions for "donate", photo consent and takedown, the tagline.
- Whether the "does not promise recruiting…" sentence is enough, or needs different wording.
- Whether the store description must repeat the held-gift notice (row M) or the payout caps (row O).
- Privacy "nutrition label" / Data safety form answers, built from
  [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md) — not drafted here.
