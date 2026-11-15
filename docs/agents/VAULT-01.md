<!-- VAULT-01: the Vault value ladder, its wording and the money-back arithmetic. The owner approved decisions V1–V6 on 2026-11-15; nothing is built yet. -->
# VAULT-01 — Vault value ladder

**Status:** owner approved V1–V6 as recommended on 2026-11-15. Nothing is built yet; the build starts after APP-TEST lanes A–C. **Evidence:** [VAULT-AUDIT](VAULT-AUDIT.md).
**Owner:** COMMERCE (extends feature `VAULT-RAILS-01`), with VAULT, BILLING, VOICE, LEGAL, MINOR_SAFETY and CFO.
Reviews by those roles are pending. If the CHECK-01 protocol (PR #52) merges, its Money, Minors/privacy and Copy rows apply.

## What must be true first

These come before any tier and are not optional:

1. **Tie the pass to the payment.** The server grants the pass after it confirms the charge; the app stops inserting it. Today any signed-in account can grant itself a pass and book a sale that never happened.
2. **Record the real price.** The books write $4.99 whatever the Catalogs desk says.
3. **Say what is inside.** Show the clip count on the locked Vault. Remove "full game breakdowns and raw practice film" until athletes can label clips that way.
4. **Let the athlete see Vault earnings.** No athlete or guardian screen shows them today.
5. **Decide the store rule** (V1 and V4). At Apple's 30%, a $4.99 pass that still records $3.99 for the athlete loses Tapua'i $0.50 a sale.

## The ladder

| Tier | Who pays | What they get | Price | Athlete side | Tapua'i keeps | Ready? |
| --- | --- | --- | --- | --- | --- | --- |
| 0. Free public feed | Nobody | Highlights, tagging, gifts at 100% | Free | 100% of gifts | Optional tips only | Exists. Unchanged. |
| 1. One-time Exclusive pass | Fan | That athlete's Vault clips, shoutout / Q&A requests, Flash Unlock windows | $4.99 today (Catalogs desk) | 80% of proceeds after the store or processor fee | 20% of the same proceeds | Exists on web and test builds. Needs the five fixes above. |
| 2. Athlete subscription | Athlete or guardian | Vault tools: scheduled Flash Unlock, Vault view counts, pinned Vault intro | Owner decides; the model says $5–10 a month | Does not apply (they are the buyer) | Price less store fee | **Held** (V1). Not built. |
| 3. Fan subscription | Fan | Vault access across followed athletes | Not proposed | Would need a sharing rule | Not proposed | **Held** (V1). Not built. |

**One honest line per tier, written from what exists:**
- **Tier 0:** "Watch, tag and give. Free, always."
- **Tier 1:** "Unlock the clips {first name} keeps for their Crew."
- **Tier 2:** No line can be written yet. No Vault tool exists that an athlete would miss, so by the prompt's own test the tier is not ready.
- **Tier 3:** No line can be written. Staging has 0 Vault clips, so there is nothing to bundle.

**Rules that hold on every tier:**
- A locked Vault never hides public Highlights or the Give button.
- A Vault screen never carries a Give button, and a gift screen never carries a Vault offer.
- A lapse or refund never deletes an athlete's Vault or clips.
- No tier ranks athletes or fans by dollars.

**Recommendations:**
- **Tier 1:** keep it and make it sound.
- **Tier 2:** hold until pilot athletes are actually using the Vault. Three cautions:
  - Never gate today's free controls (lock/open, per-clip Vault, Flash Unlock).
  - Never invent "slots". There is no clip limit today, and adding one to sell it back is false scarcity.
  - The earnings view stays free, because it is the athlete's own money.
- **Tier 3:** stay with the one-time pass until one school shows repeat Vault buyers. A fan subscription needs a rule for splitting one payment across athletes, and any such rule ranks athletes by money.

## Athlete earnings view (free, proposal)

- **Where it sits:** on the athlete's Manage tab and in Parent HQ.
- **What it shows:** "Your Vault: {n} passes this season. ${x} recorded for you." The 20% and any store fee are stated beside it.
- **Wording until money moves:** it says **recorded**, not paid. Payouts are blocked and STATE §6 item 8 is open.
- **What it never says:** donation, gift, tax treatment or eligibility. Those are counsel's calls.
- **Cost goals:** progress toward a cost ("$40 of $120, travel fees") needs the athlete to name a cost. That reuses the Rally pattern and would be a new input, so it is listed under V5, not assumed.

## Wording (proposal for VOICE and LEGAL; no constants changed)

Principles and their source in [VOICE](../product/VOICE.md) "Keep people donating (without pressure)":

| Principle | Line a person reads |
| --- | --- |
| Identity, not transaction | "Unlock the work behind the highlights." |
| Autonomy | Locked preview: "{n} clips in {first name}'s Vault. One-time purchase. Yours to keep." Athlete side: "You choose what goes in your Vault. Open or lock it any time." |
| Progress, not rank | Athlete: "{n} passes this season. ${x} recorded for you." No leaderboard and no "top supporter". |
| Community | "{first name}'s Crew, family and school, a little closer in." |
| Reciprocity, preset only | The five `THANKS_MESSAGES`, no free text. Requests: "{first name} answers when they can." No timer. |

**Before anyone pays, the screen says:**
- **What it is:** "A one-time Exclusive purchase."
- **Who gets it:** "After payment fees, 80% is recorded for {first name} and Tapua'i keeps 20% to run the platform." This follows V1: the split is taken from what is left after the store or processor fee. Today's copy and books split the full price, so both change in build step 1.
- **What it is not:** "This is a purchase, not a gift. It is not tax-deductible and does not affect recruiting or eligibility."
- **Flash Unlock:** "{first name} opened this clip for 2 hours." It is the athlete's own choice and a real window.
- **Guardians:** the same split in the same words, plus lock/open.

**Changes to existing copy:**
- **Retire the callout** "…to see full game breakdowns and raw practice film" until it is true.
- **Replace the purchase toast** "Exclusive clips unlocked ⚡ +100 Aura Points earned!", pending V3.

**Never write:** guilt, countdowns to nothing, "only N left", pay-for-play, recruiting, scholarship, exposure, roster
or NIL promises, "invest", or any gift-for-perk line.

## Money-back arithmetic

**Baseline:** $25–50 a month running cost plus $99 a year Apple, which is **$33.25–$58.25 a month**.
This is arithmetic only. It predicts no sales, conversion rate or date.

**Passes a month that cover the baseline at $4.99.** The Stripe rate (2.9% + $0.30) and the Apple
rates are outside facts to verify.

| Rail and rule | Tapua'i nets per pass | Passes a month to cover |
| --- | --- | --- |
| Web Stripe, fee out of the 20% | $0.56 | 60–105 |
| Web Stripe, 20/80 after the fee | $0.91 | 37–65 |
| Apple IAP 30%, 20/80 of proceeds | $0.70 | 48–84 |
| Apple IAP 15%, 20/80 of proceeds | $0.85 | 40–69 |
| Apple IAP 15%, athlete keeps $3.99 | $0.25 | 133–233 |
| Apple IAP 30%, athlete keeps $3.99 | −$0.50 | Never. Each sale loses money. |

**Athlete subscription, if the owner approves Tier 2** (Apple IAP, the model's range):

| Price a month | After Apple 30% | Subscribers to cover | After Apple 15% | Subscribers to cover |
| --- | --- | --- | --- | --- |
| $5 | $3.50 | 10–17 | $4.25 | 8–14 |
| $10 | $7.00 | 5–9 | $8.50 | 4–7 |

**What the arithmetic shows:**
- A handful of athlete subscriptions covers the pilot, where passes need dozens of sales a month.
- That is the business case for Tier 2. It is also the reason to be careful: the buyer is a family, often a minor's.

## Owner decisions (decided 2026-11-15, all as recommended)

| # | Decision | Owner's answer |
| --- | --- | --- |
| V1 | Tiers, prices and the store rule | **Approved.** The one-time pass stays at $4.99. The split is 20/80 of proceeds **after** the store or processor fee. Tiers 2 and 3 are held and not built. |
| V2 | What is in each tier | **Approved.** Tier 1 stays clips, shoutout / Q&A requests and Flash Unlock. The locked preview gains the clip count. |
| V3 | The +100 Aura on purchase | **Approved.** Remove it from the purchase, or reframe it as a thank-you with no number. Counsel decides which. It is not extended to anything else. |
| V4 | In-app payment path | **Approved.** Web stays Stripe. Store builds wait for StoreKit and Play Billing, and sell no pass until then. |
| V5 | Earnings view and custodial direction | **Approved.** Build the free "recorded for you" view for the athlete and guardian. Finalise direction A with counsel before any "paid" wording or cost goals. |
| V6 | Wording | **Approved.** The wording table goes to VOICE and LEGAL review. |

**Athlete share on a $4.99 pass under V1** (rates to confirm):

| Rail | Fee | Recorded for the athlete | Tapua'i |
| --- | --- | --- | --- |
| Web Stripe | $0.44 | $3.64 | $0.91 |
| Apple IAP at 30% | $1.50 | $2.79 | $0.70 |
| Apple IAP at 15% | $0.75 | $3.39 | $0.85 |

**Still open, not decided:**
- Whether Apple's rate is 15% or 30% for this account.
- The store classification of the pass.
- The counsel items below.

**Counsel-open (do not design around):**
- The final form of V3 (remove the Aura grant, or reframe it).
- Custodial direction A.
- A minor fan buying a pass.
- A minor athlete earning commercial income.
- Store classification of the pass.
- Aura tied to a purchase.
- Tax and eligibility statements.

## Build order (owner-approved; starts after APP-TEST lanes A–C)

1. **Server-granted pass:**
   - A payment purpose on the PaymentIntent.
   - The webhook or a confirm call inserts the pass.
   - Remove the client insert grant.
   - Record the real price and the real fee, and split 20/80 of the proceeds (V1).
   - Handle refunds.

   This crosses the Money and Schema ◆ rows; the owner applies the SQL.
2. **Rename `EXCLUSIVE_MONTHLY_DOLLARS`** to say one-time. No behavior change.
3. **Locked preview and callout:** clip count, corrected callout and the new copy constants.
4. **Free earnings view** for the athlete and guardian.
5. **StoreKit and Play Billing** for the pass, then Tier 2 only if approved.

**Not touched by any step:** the gift flow, the tip model, feed ranking, Aura balances and tagging.
