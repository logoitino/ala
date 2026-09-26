# Tapua'i — Company phases

**Status:** Internal operating plan. **This is not legal advice, a filing, or a promise that any step makes the company lawful.**  
**Date:** 24 September 2026

Counsel still owns the legal calls. Those issues are mapped in [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md). Engineering security and the test-to-beta sequence stay in [ROADMAP.md](ROADMAP.md). Prices and the Mālo disclaimer stay in the generated product-facts blocks. This file is the phase order for three plans that have to move together: **security**, **billing**, and **legal** (company formation, trademark, patent triage, and the paper around minors and money).

Stripe stays in **test mode** until the live-keys gate at the bottom is actually met.

---

## How the three plans line up

| Stage | Security | Billing | Legal |
| --- | --- | --- | --- |
| Now — prototype, internal testers | [ROADMAP.md](ROADMAP.md) Phase 0 is landed. Public-beta holes stay open on purpose. | Test-mode PaymentSheet. Client still writes `tips`. Payouts are a stub. | No formation, no filings, no association letter in this repo. |
| Company exists | Staging Supabase. Secrets off laptops and out of git. | Still test mode. One ledger path designed, not doubled. | LLC formed. EIN. Bank. Counsel retained. |
| Name is reserved | Same | Same | Trademark application filed on the name and mark you will actually use. Patent triage done; file only if counsel says a claim is worth it. |
| One metro can be talked to | Studio Unlock and operator PIN are real sessions. Vault files are not on a public URL. | Webhook credits a tip once. Parent-payee design signed off. | Written association / district position. Terms, privacy, parental consent, athlete agreement, booster insertion order drafted by counsel. |
| Live money | Production RLS. Incident owner. Moderation queue beyond a flag. | Live Stripe keys. Payouts only up to a server balance. Fee copy matches the waterfall counsel approved. | Payments counsel sign-off. Money-transmitter question answered. Tax reporting designed. Insurance quoted. |

Internal dogfooding in test mode does **not** wait on the LLC or a trademark. Live keys do.

---

## Security plan

Engineering detail and the 2026-09 sweep log live in [ROADMAP.md](ROADMAP.md). This is the company sequence.

### S0 — Landed for internal testing

Treat [ROADMAP.md](ROADMAP.md) Phase 0 as done for a small trusted group: schema applied, admin sign-in works, the fabrication bugs from that sweep are closed. Testers may use Stripe **test** cards. They are not a public launch.

### S1 — Close before any public build

These are already written as public-beta blockers. Do not re-decide them here.

1. Studio Unlock and the operator PIN become real Supabase sessions. Drop the `auth.role() = 'anon' or …` bypass on the tables listed in Roadmap Phase 5.
2. `profiles` stops exposing a public dump of PII (`profiles_public` or a column allow-list).
3. Vault and Exclusive video is not fetchable from a public Storage URL. `reel_vault` is the bridge. The lasting host is still **Cloudflare Stream or Mux**, chosen for price and reliable signed playback. New uploads follow one `video_url` token (`reelvault:`, `mux:`, or `cf:`). `resolvePlaybackUrl` is the only player path.
4. `sponsorships` UPDATE/DELETE loses the anon bypass.
5. Varsity team codes stay out of git and out of the app bundle. High-entropy codes, handed to a coach out of band, with the existing lockout.

### S2 — Production posture

1. A second Supabase project for staging. Production keys are not the ones in a developer `.env.local`.
2. EAS preview and production env hold only `EXPO_PUBLIC_*` client keys. `STRIPE_SECRET_KEY` and the service role stay on the server.
3. A named person owns an incident: who gets called, how a school or parent reports a clip, how fast Mālo can be frozen for one athlete or one school (the freeze flags already exist).
4. Moderation is a queue with a human, not only `is_flagged`. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) already says there is no CSAM pipeline in this codebase. That pipeline is a vendor plus a policy, bought before public video of minors.
5. Repeat the Roadmap security sweep when a new table, RPC, Storage bucket, or Realtime channel lands.

**Exit:** a stranger with the app binary cannot write money, grant admin, read a Vault file, or confirm a Varsity tag.

---

## Billing plan

Prices in the app are the ones `pnpm docs:sync` writes. This plan is when money is allowed to be real. Fan-facing Mālo copy stays “gift to the athlete, not the uploader” until counsel replaces the fee sentence. Do not turn on a platform rake in the fan UI from the admin split table.

### B0 — Test mode (now)

PaymentSheet uses test keys. Exclusive is a one-time PaymentIntent stored as a `subscriptions` row, not Stripe Billing. Boosters and Drip are the same test-mode family. Payouts return a stub. No live GMV.

### B1 — One credit path

[ROADMAP.md](ROADMAP.md) Phase 1a item 1. The Stripe webhook verifies `payment_intent.succeeded` and inserts the `tips` row. The client stops inserting that row. Shipping both at once double-credits. Same shape later for sponsorships and Vault unlocks. Idempotency is the `stripe_webhook_events` row, not a “did we already read it?” check.

### B2 — Parent is the payee

[PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md) and [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) §8. The Connect account holder is the parent or guardian. The athlete is the beneficiary in metadata. A minor does not get a US individual Express account. Guardian link stays admin-set until the linking decision in that design doc is signed. The Parent HQ payout button stays a stub until B3.

### B3 — Balance, then payout

A payout is allowed only up to a balance the server computed: credited tips, minus the fee waterfall counsel actually approved, minus payouts already sent. Record every payout. `POST /api/create-payout` stays blocked until that ledger exists. Money does not sit in an admin wallet. Destination is the Connect account, or a licensed disbursement partner. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) calls an in-house wallet the money-transmitter trap.

### B4 — Say the fee you charge

Admin splits (Mālo, boosters, Vault, Drip) are control-plane numbers. The sentence fans read has to match Stripe fees, chargebacks, and any platform cut counsel allows. Until that paper exists, the in-app claim does not change.

### B5 — Live keys

Flip Stripe to live only at the gate below. Production webhook endpoint, live Connect review, and a kill switch drilled on one test athlete first.

### B6 — Tax

1099 / information reporting for payees is an expected cost of real payouts, designed with a CPA and payments counsel. Not a schema guess.

### B7 — Video as a cost, not a product rake

Cloudflare Stream or Mux is an operating bill (storage minutes plus minutes watched). It is not a new charge to fans by itself. Pick the host when a Vault clip already plays on `reel_vault`. The token prefix lets the library be mixed while you switch.

**Exit:** one test-mode tip becomes one webhook-backed `tips` row, and a payout request above the server balance fails.

---

## Legal plan

Work for the founder and a licensed attorney. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) is the issue map (amateurism, minors as payees, money transmitter, school footage, COPPA, school marks). This section is the order in which that map gets done. Nothing here clears Tapua'i to take live money.

Launch conversations are **Utah** high schools, per [INVESTOR.md](INVESTOR.md). The state where the LLC is formed is a separate question for the business attorney. Do not treat “Delaware” or “Utah” as decided in this repo.

### L0 — Counsel, before filings

1. Retain a business attorney plus someone who will actually opine on high-school amateurism and payments. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) §8.
2. Hand them that briefing, the investor memo, and this phase doc.
3. Keep Stripe in test mode while they work.

### L1 — Form the company (LLC)

Do this before a bank account, a live Stripe application, a trademark filed in a person’s own name, or anyone other than the founder touching production money.

Checklist to walk through with the business attorney:

1. Confirm the name is available in the formation state (state records) and worth filing as a mark (L2). “Tapua'i” in the app is not a reservation at the state or the USPTO.
2. Choose the formation state and member structure. Write an operating agreement (who owns what, who can sign, what happens if someone leaves) before friends or family put money in.
3. File the articles / certificate with that state’s filing office. Appoint a registered agent.
4. Get an EIN from the IRS. Open a business bank account in the LLC’s name. Personal cards stop being the company.
5. Operating resolutions: who can sign the Stripe contract, the Expo/Apple account, and counsel’s engagement.
6. Foreign qualification if you operate in a state other than the formation state and that state requires it. The attorney decides. Utah is the first launch state either way.
7. City or state business licenses the attorney lists. Sales-tax registration only if a taxable good (Drip) is actually sold.
8. Booster clubs and schools are customers or partners later. They are not members of the LLC by default.

### L2 — Trademark

File on the name and logo you will ship, in the classes counsel picks (downloadable software, entertainment services, and financial services are the conversation — counsel picks the class, not this file).

1. Knockout search: USPTO, state marks, app stores, domains, and handles. A clean state-LLC name is not a trademark clearance.
2. Decide use-based vs intent-to-use with counsel. Intent-to-use holds a slot; you still have to prove use.
3. File the word mark for the company name. File the logo only if the logo is stable.
4. Watch the application. Respond to office actions through counsel.
5. After registration, use the mark the way the registration describes. School names, mascots, and district logos are **their** marks. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) §4.4. Using “Westlake” in a demo roster is not a license. Get written permission before a commercial build shows a school’s mark or game film.
6. Domain and social handles in the LLC’s name, after the search, not before.

### L3 — Patent triage

A patent is not part of forming the company, and filing one is not assumed.

1. Counsel (patent attorney, not only the LLC lawyer) reads the product: tagged Highlights, Mālo as a gift to the athlete rather than the uploader, Vault entitlement, sideline scoring.
2. They say whether anything is worth a filing, and whether a provisional is useful or just a date you will have to follow with a real application.
3. If they say no, record that and move on. If they say yes, file in the LLC’s name after L1, with inventors named correctly.
4. Do not put source code, schema, or a pitch deck in a public “patent pending” post. Do not describe the app as patented anywhere in product copy.
5. Third-party sample clips in the demo are not company IP. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) §5.8. Real game film needs a license.

### L4 — Paper the product

Counsel drafts, the repo only stores the version the app asks users to accept (`LEGAL_TERMS_VERSION`, `LegalModal`).

1. Terms of Use.
2. Privacy policy (video of minors, school, location for operator check-in, Stripe).
3. Parental consent, separate from a boolean on `players`.
4. Athlete / creator agreement. Parent signs if the athlete is a minor.
5. Booster insertion order (what a Silver / Gold / Platinum buy actually is).
6. School or district addendum: footage, marks, sideline operators, and the Mālo freeze.

### L5 — Association and district

[LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) §4 is the cover-letter outline. Do not send that memo raw.

1. One written position from the state association in the first launch state.
2. One written position from a district you will actually stand up a sideline in.
3. Honor a freeze if they object. The product flag has to exist before you ask (it does).

### L6 — Payments and tax counsel

1. Stripe production review, including minors and Connect.
2. Written answer on money transmitter: Connect destination or a licensed partner, never an admin balance people can treat as a wallet.
3. CPA: 1099s and who is the payee of record (the parent, per B2, if counsel agrees).

### L7 — Insurance

Media, cyber, and E&O after the payee model is sketched. [LEGAL_BRIEFING.md](LEGAL_BRIEFING.md) §7. A broker quotes it. This file does not pick a carrier.

**Exit:** counsel has a signed engagement, the LLC exists, the trademark is at least filed, patent triage is a written yes or no, and the L4 documents exist as drafts they will stand behind.

---

## Live-keys gate

All of these, together:

- Security S1 closed, and S2 items 1–4 in place.
- Billing B1, B2, and B3 working in test mode on staging.
- Legal L0 through L6 done far enough that counsel will put their name on a live Stripe application.
- One association or district letter, or a conscious written decision to launch Mālo-off (boosters only) in that metro.
- Fee sentence in the app matches B4.

Until then the app can be installed, demoed, and tested. It does not take live money.
