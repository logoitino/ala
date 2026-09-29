# Tapua'i — Legal and liability briefing

**Status:** Internal draft for counsel, investors, and (in excerpt) public affairs.  
**Date:** 13 September 2026  
**This is not legal advice.** It is a map of issues a licensed attorney in the relevant states — and, where money moves, payments counsel — must actually opine on. Nothing here is a promise that Tapua'i is lawful to operate with live money.

Read with [INVESTOR.md](INVESTOR.md) and [PUBLIC.md](PUBLIC.md). The order for formation, trademark, patent triage, billing, and security is [COMPANY_PHASES.md](COMPANY_PHASES.md). Engineer source of truth: [DOCUMENTATION.md](../DOCUMENTATION.md), [SCHEMA.md](SCHEMA.md).

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
| Mālo amounts | $5 / $10 / $25 + custom (`TIP_AMOUNTS`) |
| In-app claim | 100% of your backing (minus standard payment processing unless covered) goes directly to the athlete's custodial account — not the person who uploaded the clip. |
| Admin Mālo rake | 10% platform / 90% athlete (`MALO_PLATFORM_CUT_BPS`) — control plane only |
| Exclusive | $4.99; +100 Aura (`EXCLUSIVE_MONTHLY_DOLLARS`) |
| Boosters | Silver $50 / Gold $150 / Platinum $500 (`SPONSOR_TIERS`) |
| Stripe Express | US individual (`createStripeAccount.ts`) |
| Payout without destination | queued for admin disbursement |
| Operator PIN | `1234` |
| Athlete catalog | HS + NCAA `schools_and_teams`; `profiles.school_id` / `athlete_division` |
| Athlete profile tabs | Highlights ⚡ / Stats 📊 / Vault 🔒 |
| Athlete Vault | Lock Vault 🔒 default on; fans subscribe to watch (`players.vault_locked`) |
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
| Exclusive access is a **one-time PaymentIntent**, not a Stripe Subscription | `docs/SCHEMA.md` |
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
| E | **UGC of minors + school footage** | Likeness, copyright (school / broadcast), takedown volume | High operationally; can become legal |
| F | **COPPA / under-13** | FTC; app store removal | High if the app is used by children under 13 |
| G | **Gambling optics (polls)** | App store / state gaming if anyone can read it as a wager | Medium if product stays vote-only |
| H | **Aura as value / “trading card”** | Securities or money-service confusion if points become transferable cash | Medium if we never sell or cash out Aura |
| I | **Sponsorships on school property / marks** | School IP, booster-club rules, advertising to students | Medium |
| J | **Tax (1099, backup withholding)** | IRS / state | Expected cost of a real payouts business |
| K | **Demo security / open RLS** | Data incident before launch | High reputational; fixable in engineering |
| L | **Misleading “100% to athlete”** | Consumer-protection / advertising law if fees or delays differ | Medium |

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
   handover age per state (Utah's UTMA transfer age is 21) and whether these rules make the
   guardian's account a UTMA custodianship with its own disclosures.

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
7. **Representations.** The “100% to custodial account” sentence is marketing until the actual Stripe application fee, delays, and chargebacks match it.
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
