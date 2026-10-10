# Tapua'i — Investor briefing (front of house)

**Product:** Tapua'i (“Back Every Athlete.”)  
**Stage:** Working Expo prototype (Fan hub complete, operator portal staged, payments in **Stripe test mode**).  
**Date:** 13 September 2026  
**Companions:** [Public one-pager](../product/PUBLIC.md) · [Legal briefing (not legal advice)](../legal/LEGAL_BRIEFING.md) · Engineer architecture in [SYSTEM_OVERVIEW.md](../engineering/SYSTEM_OVERVIEW.md)

This memo is for fundraising conversations. It describes what is built. It does not forecast revenue.

---

## 1. The problem

Friday-night high school sports already have the crowd. What they do not have is a clean, phone-native way to:

- Watch the play you just missed
- Cheer the school without opening a betting product
- Send a small, attributable gift to a named athlete
- Let a local business show up next to that school

And the money that does reach young athletes is badly concentrated: NIL deals, in college and now in high school, go to the one or two most famous players. Everyone else on the roster — often the families who need it most — gets nothing. The mission is that **money is never the reason a young athlete stops**, and that support reaches **every athlete, not just the star** ([STORY.md](../product/STORY.md)).

College NIL marketplaces do not fit. High-school athletes are usually minors, amateur rules are stricter, and the “platform” is still Instagram plus a booster’s Venmo.

## 2. The product (three loops)

| Loop | Fan action | Persistence |
| --- | --- | --- |
| Watch & react | TikTok-style Reels. Seki / Aura / Flex. Live score overlay. | `reels`, `games`, Realtime |
| Support | **Donations** via Stripe PaymentSheet | `tips` (amount, athlete, fan, and where the gift started), Stripe PaymentIntent (test) |
| Rank | Aura card + points per tip dollar | `add_user_aura`, profile / player points |

**Surfaces today**

- **Reel** — full-screen video, athlete + school top-left, Aura rank top-right, Donate on the rail, Report / Hide
- **Local** — search, live matches, school cheer polls, booster rail (first-month dollars in product facts)
- **Upload** — camera FAB, optional Subscriber Exclusive lock
- **Drip** — merch checkout (same PaymentSheet engine)
- **Profile** — large avatar hero + hamburger settings; Flip Aura trading card secondary; slim Crew · Squad; Highlights collage + Active Team Roster; dual Fan / Athlete; receipts; Connect Bank (Stripe Express, JWT Edge Function)
- **Operator** — PIN claim, live clock, score, play callouts to the fan feed
- **Parent** — consent toggle + custodial payout stub

Copy in the UI is Donate / donation (docs/product/VOICE.md) and Seki. Ledgers stay `tips`.

## 3. Why this can work (thesis, not proof)

1. **Capture is already happening** — parents and students film. The missing piece is identity (tagged athlete), liveness (score + callouts), and a legal money path.
2. **A donation is a gift, not a wager** — no odds, no prize pool, no “pay this player if they score.” That distinction has to stay true in product and in counsel’s paper.
3. **Local money already exists** — booster clubs and Friday-night sponsors. The app gives them a tiered, receipted one-time sponsorship instead of a handshake ad.
4. **Distribution is the school night, not the algorithm** — operator console + live banner is a sideline wedge Instagram cannot copy without being in the gym.

## 4. Business model (designed, not live)

**Decided 2026-09-29 (owner):** Tapua'i keeps **10% of each donation** (which also covers card processing) and says so on the donate sheet; 90% goes to the athlete's family account. Donors can add an **optional tip for Tapua'i** at checkout (GoFundMe model; default No tip), booked as its own revenue stream. Counsel still has to confirm the 10% works with App Store rules for gifts (ROADMAP Wave 1 checklist item 4); the fallback is 0% plus the tip.

Prices below are generated from source (`pnpm docs:sync`). Do not edit inside the markers.

<!-- product-facts:start -->
| Line | Price (as coded) | Notes |
| --- | --- | --- |
| Donations | $5 / $10 / $25 + custom | 90% of your donation goes to the athlete's family account. Tapua'i keeps 10% to run the app, including card processing. Nothing goes to the person who uploaded the clip. |
| Admin splits | Donations 10%/90% athlete · Boosters 15%/85% operator · Vault 20%/80% athlete · Drip 100% platform | Control plane on `/admin/money`. The 90 / 10 donation split is disclosed on the donate sheet (owner, 2026-09-29). Optional tips to Tapua'i at checkout are 100% platform. |
| Exclusive | $4.99 one-time PaymentIntent stored as a `subscriptions` row | +100 Aura to the payer. Not Stripe Billing yet. |
| Boosters | Silver $50 / Gold $150 / Platinum $500 | Silver / Gold / Platinum. One-time price, no billing period. |
| Aura | 10 points per donated dollar | 7-tier card (Slate Silver → Celestial Prism). Double-tap 1; Serve Like Me ×2. Not cash. |
| Operator PIN | `1234` | Prototype. Demo RLS: tighten before production. |
| Athlete roster | Same flow for HS + NCAA | Sports Football / Basketball / Rugby / Volleyball / Soccer / Baseball / Softball / Wrestling / Track & Field / Lacrosse / Ice Hockey / Tennis. Class '26 / '27 / '28. `profiles.school_id` + `athlete_division`. |
| Athlete profile | Unified sheet | Tabs Highlights ⚡ / Stats 📊 / Vault 🔒. Fan bar Home / Spotlight. Vault Lock Vault 🔒 (default locked). Crew The Crew ⚡ / Your Squad 🛡️. Flash Unlock 2h. |
<!-- product-facts:end -->

Drip SKUs stay in `apps/mobile/src/frontend/data/shop.ts` (payer Aura only). **Not a model:** selling Aura, listing athletes as securities, ranking athletes by money, or charging families to start a Rally.

Payments are **test mode**. There is no live GMV.

## 5. What is actually built vs still prototype

**Built enough to demo on Expo Go**

- Fan 5-tab hub, Reels (`expo-video`), Local search + polls + boosters, Drip sheet, Profile trading card, Report / Hide, offline queue, JWT Stripe Connect onboarding path

**Staged / demo-grade (do not pitch as production)**

- Operator PIN (product facts), demo-open Row Level Security on several tables
- Parent consent is a boolean on `players`, not identity KYC
- Exclusive “subscribe” can mirror in AsyncStorage if SQL is missing
- Stripe Connect Edge Function must be deployed with a dashboard login
- Web bundler does not run native PaymentSheet

## 6. Go-to-market sketch

1. One association / one metro (Utah high-school demo data already in the app: Westlake, Lone Peak, ALA).
2. Sideline operator in the press box before a consumer ad campaign.
3. Booster club as the first paying customer (sponsorship), not the 16-year-old as the first payee.
4. Pause donations to a given athlete if the school or association objects — product must support a kill switch before live money.

## 7. Ask (conversation, not a priced round)

Use this briefing to walk:

1. The three loops (demo on device, not web).
2. The legal memo — especially **high-school amateurism** and **minors + money**.
3. What “production” means: live Stripe, tightened RLS, real operator auth, custodial structure, association letters.

Screenshots: Expo web stills from 13 September 2026 live in [`docs/company/press/`](../press/) (Reel, Local, Profile). Recapture from **Expo Go on a phone** for a deck — the web preview shows a DEV ROLE bar and unused desktop canvas.
