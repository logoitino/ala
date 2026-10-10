# Department plans — where we are, and what each team will do

**Date:** 2026-10-09. **Assigned by:** CTO. **Kept current by:** `VP_OPERATIONS`.
**Sources:** [STATE.md](../STATE.md), [ROADMAP.md](../product/ROADMAP.md), [WORK_QUEUE.md](WORK_QUEUE.md), [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md), [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md).

This is a plan, not a launch approval. Stripe stays in test mode. No team applies hosted SQL, merges, or turns on live money unless the owner asks.

## How far along the app is

Use these five levels. A feature can be at more than one level at once (in the app, and also written as SQL that no database has yet).

| Level | Meaning today |
| --- | --- |
| **In the app** | The screen or rule exists in this branch. Local checks have passed for many of these. That is not a phone test. |
| **On staging** | The September SQL and the content-rights SQL are on `ala-sports-staging`. Testers only see Rally, thanks, custodial cards, Spotlight boards, and view counts on a build that points there. |
| **Written only** | The migration file is in the repo. Development does not have it. Staging does not have the October files. |
| **On a device** | Almost none of the October work has been exercised on the installed preview. The 2026-10-01 preview builds do not contain later JavaScript (Drip off, donate sheet, account tags, photo stories). |
| **Public** | Not started. No production Supabase project, no live Stripe keys, no store submission. |

**About to spend.** This plan does not start a purchase. Wave 0 (now): Apple Developer **$99/yr** is already enrolled. Supabase, Expo, and Stripe test mode are **free**. Nothing comes in. Wave 1 (public, later): LLC, counsel, association letter, Google Play **$25**, Supabase Pro **about $25/mo**, video bandwidth, Stripe’s per-payment fee, Connect per-account fees. Those prices are the release-wave table in [ROADMAP.md](../product/ROADMAP.md). Do not pull Wave 1 spend into the test wave.

## What the app already contains

Fans can browse Highlights, Activity, Spotlight, and Profile. Local (games, polls, boosters) opens from a pill on Home, not from the bottom bar. Drip is off. The operator console is flag-off.

| Surface | In the app | On staging | Written only | Still open before public |
| --- | --- | --- | --- | --- |
| Highlights | Reel pager, hype, search, report/hide, owner peek card, photo-story player, neighbor prefetch | View counts and filmer credit from the September SQL | Photo-story tables and storage owner-folder rule | Device paging; photo SQL not applied; one ordinary report does not hide a clip |
| Upload | Compact video steps; photo steps hidden until the SQL exists; account-tag field | Rights-report reasons | Account-tag SQL; photo-story SQL | Device picker; failed photo attempts leave hidden rows |
| Donate | Amount → Options → Review, 90/10 disclosed, tip for Tapua'i starts at No tip | Rally, platform tip, and origin tags from the September SQL | — | Client still inserts `tips` after payment; webhook crediting stays off; payouts return 503 |
| Profile | Sport-matched stats, Goals/Team, Vault lock, Crew, verification UI | Verification ladder and school badge | Public sport column on the privacy view | Development database still allows self-verify |
| Local | Game cards, polls, boosters, match detail | Leaderboards SQL | — | Native layout not rechecked |
| Spotlight | Week/month/year board | Boards from the September SQL | — | Stories are not Spotlight features |
| Admin | Expo `/admin` writes; Next portal reads | Runtime config on both projects; Drip tab false | — | Real staff sessions still share the anon demo path |
| Operator | PIN, GPS check-in, score, clock | Gig tables, with the accepted anon demo path | GPS policy file | Not a public login |

## Public gate (every team)

Going public means Wave 1 in the roadmap: one metro, live donations, a production project, and a store listing. Internal testing can continue without that. These items block public, and they are already written down. This plan does not add new ones.

1. Owner decisions in STATE §6, especially how money reaches families, the App Store fee question, parent-as-payee, and the video host.
2. One donation credit path. Retire the client `tips` insert in the same change as webhook crediting.
3. Close public-build holes: anon demo policies, real operator and Studio sessions, Vault video off public URLs, profile fields that are still publicly readable (`stripe_connect_id` and similar).
4. Athlete self-verify closed on every database testers and the public use.
5. Counsel's pack in [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) §8: counsel retained, association position, Terms, Privacy Policy, parental consent, and tax reporting design.
6. Account export and deletion designed with counsel before it is built ([DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md) §3.4).
7. A production environment (readiness R3), which waits on a database that can be rebuilt from migrations (R2).

## Status — 2026-10-10

Each team worked its current plan item. Nobody applied SQL, started a public release, or drafted counsel's documents.

On 2026-10-10, Legal routed the open compliance gaps. The other rows below stay as last written. The app is not public-ready.

Later the same day, every agent was connected to a model, and each department lead ran on that model. Their research is now the department sections of [EXPERT_STANDARDS.md](EXPERT_STANDARDS.md). The app status in the table did not change except the photo-story test count, which is 6 suites and 60 tests.

| Team | Status | This pass |
| --- | --- | --- |
| Office of the CTO | Continued | Every agent is pinned to `grok-4.7-medium` so later runs stay in the included Cursor pool. |
| Product | Stopped for you | The decision list is written. Public acceptance criteria wait on the open STATE §6 rows. |
| Dev | Continued | Photo-story pager fixture: counter and five dots at 320 and 375, and Next moves `1 / 5` to `2 / 5`. The photo bitmap did not paint. |
| Database | Stopped for you | October SQL stays written until you ask to apply it. |
| Security | Stopped for you | The gaps stay named. Closing them on a database, or rewriting function search paths, waits on you. |
| IT infrastructure | In progress | Android `6febe2bb` and iOS `af6a7e72` are on EAS. iOS installs on the one registered iPad. |
| Design | Continued | The pager check above is the open visual pass. Upload steps and tagline placements are still open. Native Dynamic Type is not this check. |
| Finance | Stopped for you | The donate sheet stays as it is. Destination charges and webhook crediting need you and counsel. |
| Legal and Compliance | Stopped for you | 2026-10-10: inventory routed in LEGAL_BRIEFING "Compliance routing — 2026-10-10". Counsel documents still stopped. The app is not public-ready. |
| Brand | Stopped for you | The four placements stand. The store listing stays a draft until you and counsel say to submit it. |
| Trust and Safety | Continued | Local Open flags columns show the report reason and whether an athlete or guardian reported the clip. Strikes and appeals are still unbuilt. No one was contacted. |
| Partnerships | Stopped for you | No school, family, booster, or sponsor is contacted unless you ask. |
| Quality | Continued | 2026-10-10: `pnpm check` passed, 72 suites / 414 tests. Device sign-in, upload, and a test donation are still the Phase 2 exit. |
| Marketing | Stopped for you | No campaign. |
| Support | Stopped for you | Tester-script intake only. No one outside the test was contacted. |

---

## Office of the CTO

**Lead:** `CTO`. **Also:** `VP_OPERATIONS`.

**Where we are.** The CTO assigns every app fix. The VP of Operations keeps roles, protocols, and this plan current. Ninety agents are registered. The current assignment is still Wave 0 local work, not a new feature.

**What we have.** The hierarchy, the call sheet, and the work queue. QA can reject a fix. The owner still decides SQL, merge, prices, counsel, and live money.

**What we will do.**

1. Keep this file as the priority board. When a department finishes or a gate moves, the VP updates this plan, the queue, and the role files in the same turn.
2. Assign the next test-wave checks only: QA's photo-story browser and device evidence, and any owner-asked SQL.
3. Refuse a public date until the public gate above is actually done.

**What we will not do.** Start Drip, the Aura-card signature, a Hudl file import, or live Stripe because a plan mentions them.

## Product

**Lead:** `PRODUCT`. **Specialist:** `RESEARCH`.

**Where we are.** Wave 0 is the current product: internal test, test cards, staging. The mission is family donations and highlights, with Donate / donation as the money words.

**What we have.** Roadmap waves 0–3. Tester script. Owner decisions recorded in STATE §6. The list the owner can answer:

| # | Decision | Where it stands |
| --- | --- | --- |
| 1 | Telemetry identity | Owner chose session id plus user id. Not built. Privacy copy has to come first. |
| 2 | Video host | Open. Cloudflare Stream or Mux. |
| 3 | Webhook crediting and the ledger | Open. Do not turn crediting on while the app still inserts the donation row. |
| 4 | Parent as payee | Partly decided. Counsel still has the handover age and the Stripe mechanics. |
| 5 | Stats | Decided: a light line from the scorer. The operator fee and who may score are still open. |
| 6 | 1-on-1 | Later. Counsel before any build. |
| 7 | Pathway savings | Counsel. Do not hold that money in the app. |
| 8 | How money reaches families | Open. Owner and payments counsel. |
| 9 | Fee model | Decided: 90/10 plus an optional tip for Tapua'i. App Store gift rule is still open. |
| 10 | Verification | Decided: gifts wait until a school adult confirms. The held-gift cap and refund window are still open. |
| 11 | Fan signature on the Aura card | Later. Do not build it. |

**What we will do.**

1. Keep Wave 0 acceptance as "a tester can complete the script on staging," not "the app is public."
2. Turn STATE §6 into a decision list the owner can answer before any public plan starts.
3. After those answers, write the public-beta acceptance criteria with Legal and QA. Do not write them early.

**What we will not do.** Company formation. That stays with the founder. Pull Wave 2 or Wave 3 features into the test wave.

## Dev

**Lead:** `ENGINEERING`. **With:** `FULLSTACK`, `DOCUMENTATION`, and the screen squads.

**Where we are.** The fan app and Expo admin are in the branch and have passed local typecheck and Jest on the landed slices (owner peek: 72 suites / 414 tests; photo stories: 71 suites / 396 tests). Device passes for those slices are still open. Guest and role screens call shared clients. Two operator screens still call the database directly (7 calls).

**What we have.** Highlights (including photo stories and the owner card), Activity, Local, Spotlight, Profile, sign-in, upload, donate sheet, and Expo admin. Magic-link and Apple/Google sign-in exist in code. Drip's fan tab is off in code and in the published flags.

**What we will do.**

1. Finish local verification that does not need SQL: photo-story browser evidence with QA.
2. When the owner asks, point a tester build at staging and fix only what that script breaks.
3. Keep screens on `lib/` clients. Do not add new direct database calls from routes.
4. Prepare the video-host choice as a recommendation. Do not build transcoding on Storage.

**What we will not do.** Apply October SQL unless the owner asks. Enable webhook crediting. Ship the Later list (Drip marketplace, signature, low-view lane, Train Like Me, showcase link, game-day gigs, music picker).

### Highlights — `HIGHLIGHTS`

**Have:** pager, hype, search, reports, "Filmed by," photo-story pager, prefetch, owner peek card. **Will do:** device check of photo paging versus the peek swipe. **Will not do:** Hudl file import.

### Local — `LOCAL`

**Have:** search, live-match cards, polls, boosters, roster on the match. **Will do:** keep missing scores and clocks honest. **Will not do:** invent stats.

### Spotlight — `SPOTLIGHT`

**Have:** week, month, and year boards, and the Home launch card. **Will do:** keep Spotlight on videos. **Will not do:** feature a photo story with a stand-in clip.

### Profile — `PROFILE`

**Have:** own hub, public athlete sheet, Crew, Vault lock, sport-matched Stats and Aura, Goals and Team. **Will do:** keep missing stats unreported. **Will not do:** show a school mark as permission we do not have.

### Auth — `AUTH`

**Have:** guest browse, Apple, Google, magic link, demo fan, welcome overlay. **Will do:** confirm the staging email callback on a device (queue W0-05). **Will not do:** turn the operator PIN into a public login.

### Admin — `ADMIN`

**Have:** Expo desks for games, content, commerce, flags, and look. Next portal is read-only. **Will do:** keep writes in Expo admin. **Will not do:** give the Next portal a save button.

### Aura — `AURA`

**Have:** seven tiers, the trading card, Look tokens. **Will do:** keep point math in this team. **Will not do:** build the fan signature slot.

### API — `API` and `FULLSTACK`

**Have:** PaymentSheet routes and the Connect account link minted with the session JWT. The Stripe secret is in Edge Functions, not in the app. **Will do:** keep that split. **Will not do:** retire the Expo API routes (readiness R4) until Edge Function secrets are confirmed on each project.

## Database

**Lead:** `BACKEND`. **With:** `DATABASE_MIGRATIONS`, `STORAGE`.

**Where we are.** `schema.sql` is the canonical database. Staging has the September set and content-rights reports. Development does not. `reel_vault` is missing on staging.

**What we have, written only.** Photo stories (`20261007230000`), reels owner-folder (`20261007231000`), account tags (`20261002160000`), public profile sport (`20261007211500`), operator check-in role policy (`20261002120000`).

**What we will do.**

1. Leave those files unapplied until the owner asks. Say so in every status.
2. When asked, apply on staging first, with Security's negative tests, and copy nothing onto an already-applied file.
3. Design export and deletion only after Product, Legal, and counsel agree what must be kept (donations, other people's clips).

**What we will not do.** Open RLS to "make photos work." Edit a migration after it has been applied.

## Security

**Lead:** `SECURITY`. **With:** `RLS_SECURITY`, `SESSION_SECURITY`.

**Where we are.** Known public-beta holes are named and still open on purpose for internal test. They are not fixed by hiding a button.

**What we have.** Session JWT on the Connect link. Admin escalation guard from the earlier sweep. Content-rights report storage on staging. A written GPS policy and a written storage owner-folder rule, neither applied.

**What we will do.**

1. Keep this list visible until each item is closed on the database the public app will use: client `tips` insert, public profile columns, anon demo policies, public Vault files, unapplied operator GPS policy, unapplied storage owner-folder rule.
2. Review any SQL the owner asks to apply, including a test that the wrong user is denied.
3. Before public: real operator and Studio sessions, and admin-only telemetry reads if user or session ids are added.

**What we will not do.** Claim the internal-test exceptions are safe for the store. Add a tracker. Put a Stripe secret in the client.

## IT infrastructure

**Lead:** `OPERATIONS`. **With:** `CI`, `RELEASE`, `RELIABILITY`, `RECOVERY`, `COST_OPERATIONS`, `TELEMETRY`, `OPERATOR`.

**Where we are.** Staging exists. Preview builds from 2026-10-01 exist (Android, and iOS for one iPad). CI runs the local gates on Node 24. There is no production project and no measured uptime.

**What we have.** Staging runbook, tester script, EAS preview profile, operator console in the app with the flag off. Cost notes in the roadmap wave table. Telemetry that does not store a user id.

**What we will do.**

1. Keep Wave 0 on the free tier. Call out the only ways it stops being free: Expo's free build quota, or a paused Supabase project (Pro is about $25/mo).
2. Do not start a new iOS preview until a second device is registered. The install URL is in STATE.
3. Prepare a restore drill on synthetic data. Publish no uptime number.
4. After R2, plan the production project as R3. Do not create it in this wave.

**What we will not do.** A public operator login. A paid game-day program (Wave 3).

## Design

**Lead:** `DESIGN`. **With:** `ACCESSIBILITY`, `MOTION`, `DESIGN_TOOLING`.

**Where we are.** Daylight is the visual system. The donate sheet and upload are compact stepped flows. The owner peek card was rebuilt and checked in a browser harness on 2026-10-08. Native Dynamic Type and VoiceOver are not verified.

**What we have.** Shared menu chrome, motion tokens, the Look desk, and MCP notes for Figma, Canva, Playwright, and Expo. OAuth for Canva, Expo, and Supabase is still waiting on the owner.

**What we will do.**

1. Review only the screens the CTO assigns. Photo-story feed and upload are the open visual check with QA.
2. Keep one primary action on a sheet, and keep empty, loading, and error visually distinct.
3. Hold the Later visuals (share card, backer wall, badges, signature on the Aura card).

**What we will not do.** Restyle a payment or rights rule while changing how a card looks.

## Finance

**Lead:** `COMMERCE`.

**Where we are.** Donations work in test mode as a client-written `tips` row after PaymentSheet. Payouts are hard-blocked. Exclusive is a one-time PaymentIntent, not a subscription. Drip is off.

**What we have.**

| Piece | Have | Public plan |
| --- | --- | --- |
| Checkout | Amount, options, review, 90/10, optional tip for Tapua'i, optional card-fee line | Counsel on App Store 3.2.1(vii) before any 10% share ships on iOS |
| Ledger | One `tips` row is the record | Webhook credits once; the app stops inserting. Not both |
| Connect | Express link from the Edge Function | Parent is the payee, after counsel. Athlete is not the minor's bank account |
| Custodial | Records and parent cards in the app; SQL on staging | Nothing moves money until the ledger and counsel sign-off |
| Rally and thanks | Goals and preset thanks | Staging only until a tester build points there. Preset thanks only |
| Receipts | Donor history | Must keep working when the credit path changes |
| Wishlist | Gear goals | Same donation row. Do not insert a second ledger row |
| Billing | One-time Exclusive | No auto-renew disclosure until a real subscription exists |
| Refunds | Not a product flow | Design with the ledger, before live money |
| Drip | Off | Wave 1 marketplace only after the owner turns the tab on |

**What we will do.** Keep the donate sheet's disclosures. Prepare the single credit path as a design. Leave payouts at 503.

**What we will not do.** Live keys. Destination charges or a platform ledger until the owner and payments counsel pick one. Filmer cash. Holding Pathway savings.

## Legal and Compliance — what public requires

**Leads:** `LEGAL`, `COMPLIANCE`. **With:** `CONTENT_RIGHTS`, `PRIVACY_ENGINEERING`.

Counsel decides the law. This team does not draft a Privacy Policy, a liability cap, or a new legal conclusion. The issue map is [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md). The data inventory is [DATA_PRIVACY_MAP.md](../engineering/DATA_PRIVACY_MAP.md).

### What we have

| Item | Status |
| --- | --- |
| Terms acknowledgement | In the app on Varsity apply and Connect Bank (`LEGAL_TERMS_VERSION`). Not a counsel-approved Terms of Use |
| Privacy Policy | Not published. Inventory only |
| Account export and deletion | Not built (privacy map §3.4) |
| Auto-renewal disclosure | Not required today. Exclusive is one-time |
| Donation words | 90/10, No tip default, and held-gift notice are on the review step. Brand checks the words |
| Footage and marks | Uploader confirms permission, sound, and marks. Game Day confirms real footage. Photo stories add a photo-permission line (LEGAL rows U and V). Counsel has not decided whether school marks may appear |
| Reports | A reason is required. Some reasons hide the clip. A human queue, strikes, and appeals are not built |
| Age | Sign-up confirms 13+. Under-13 is not a product |
| Processors named in the inventory | Stripe and Supabase. No analytics SDK found that runs before consent |
| SOC 2 and uptime | Not claimed |
| Cookie wall | None |
| ToS tickbox on every sign-up | Not required by counsel yet. Ack exists on Varsity and Connect |
| DPA for schools, boosters, sponsors | Not started |
| Liability cap in Terms | Not drafted. Counsel's job |
| Company paper | Not filed by this team. Stripe stays in test mode |

### What we need before the app is public

These are the gaps already listed for counsel in LEGAL_BRIEFING §8 and the privacy map. They are not new legal advice.

1. **Counsel retained** in the first launch state, sports and payments. Agents do not hire counsel.
2. **Documents counsel writes,** which the app then links and versions: Terms of Use (including whatever liability language counsel chooses), Privacy Policy, parental consent, athlete/creator agreement. Booster or school paper only if those customers are real.
3. **Written association and district position** before a commercial build shows a school mark or game film.
4. **Privacy product path:** export, and a deletion design that says what is kept (donation records, other people's clips) and why. Product, Database, and Security build it only after that disclosure is agreed.
5. **Fee and minor-payee questions** counsel still has open: App Store gift rules versus the 10% share, guardian handover age by state, whether a named Rally cost creates a duty to spend it that way, and tax reporting.
6. **Photo stories (rows U and V):** counsel reviews photos of minors and bystanders, and whether JPEG stripping is enough. Video metadata is still not stripped.
7. **Trackers:** any future analytics stays off until a person opts in. No "accept all or leave" wall.
8. **Auto-renewal:** write the disclosure and cancel path only if Exclusive becomes a subscription. It is not one today.
9. **A real uptime number** only after it is measured. Do not publish one for the public launch.
10. **DPA** when a school, booster, or sponsor is a business customer. Not for the first fan launch unless counsel says that customer exists.

**What we will do now.** Keep the inventory honest when tables change. Refuse SOC 2, a fake SLA, and trackers before consent. Review copy that could sound like a scholarship, a school license, or a promise that a donation buys a play.

**What we will not do.** Write the Privacy Policy ourselves. File an LLC. Turn on live keys to "see if counsel is fine with it."

### Routed 2026-10-10

Same gaps as [LEGAL_BRIEFING.md](../legal/LEGAL_BRIEFING.md) "Compliance routing — 2026-10-10". Counsel still writes the documents. The app is not public-ready.

- `PRIVACY_ENGINEERING`, `BACKEND`, `PRODUCT`: export and deletion stay unbuilt until the owner and counsel agree what is kept.
- `MINOR_SAFETY`: keep the 13+ confirmation. No under-13 product and no parental-consent document from this team.
- `COMMERCE`, `VOICE`, `BILLING`: keep the donation review lines. Exclusive stays a PaymentIntent. Fan labels now match the one-time charge. Do not turn Exclusive or boosters into a subscription.
- `CONTENT_RIGHTS`: keep upload confirmations. No school contact.
- `TRUST_SAFETY`, `MODERATION`: keep report reasons. Human review, strikes, and appeals stay unbuilt.
- `CONNECT`, `CUSTODIAL`: payouts stay blocked. No live transfer and no new payee design.
- `MARKETING`: the store listing stays a draft.
- `QA`, `OPERATIONS`: no public release and no Wave 1 spend.

## Brand

**Lead:** `VOICE`. **Message:** `BRAND` under Marketing.

**Where we are.** Money language is Donate / donation. "Mālo!" is only a thank-you. The approved line "Donate. Elevate. Celebrate." is in the welcome overlay, the donate Amount step, and under an athlete's Donate button.

**What we will do.** Run the copy check on every money-screen change. Review store listing text with Legal before anyone submits it.

**What we will not do.** Tie a donation to a stat, a win, or a recruiting outcome. Publish the store listing.

## Trust and Safety

**Lead:** `TRUST_SAFETY`. **With:** `MODERATION`, `ATHLETE_VERIFICATION`, `MINOR_SAFETY`.

**Where we are.** Upload confirms permission. Reports store a reason. Athlete or guardian reports, high-risk reasons, or three reporters hide a clip. School confirmation is a form with a token. Gifts to an unverified athlete do not pay out, because payouts are blocked.

**What we have.** The verification ladder on staging. The design for fake-highlight takedown is still a proposal. 1-on-1 with minors is off.

**What we will do.**

1. Keep minor contact restricted: no free-text DMs, preset thanks only, Rally for a minor waits for the guardian.
2. The local review queue columns exist on Open flags: a reviewer sees the report reason, the clip (Target), the reporter count, and whether an athlete or guardian reported it. The same reasons that hide a clip today are the ones that enter the queue. Strikes and appeals are still unbuilt. No vendor is chosen.
3. Leave strikes, appeals, and a filmed-at-the-game badge unbuilt. The local queue columns do not authorize them.

**What we will not do.** Ship Train Like Me or paid sessions. Treat a team code as proof of identity on a public database.

## Partnerships

**Lead:** `PARTNERSHIPS`. **With:** `ROLE_HQ`, `SCHOOL_PARTNERS`, `SPONSOR_ADS`.

**Where we are.** Parent, booster, and sponsor portals exist. A guardian can approve a minor's Rally. The parent-as-payee design is written. The payout button does not move money. School confirmation is a link that needs the app installed.

**What we will do.** Keep the parent as the payee on paper. Ask Legal before any screen implies a school has licensed its name or film.

**What we will not do.** Contact a school or district. Sign a booster deal. Turn sponsor placements into ads the owner has not approved.

## Quality

**Lead:** `QA`. **With:** `TEST_AUTOMATION`, `VISUAL_QA`, `DEVICE_QA`.

**Where we are.** Local gates exist: typecheck, docs, copy, comments, data-boundary, agent roster, client-key check, and Jest. Photo-story browser evidence at narrow width and large text is still open (UX-05e). Device smoke for the installed build is still open (W0-09). The installed preview is older than the October code.

**What we will do.**

1. Record the photo-story browser check when Expo web is up. Leave device paging as not run until a device is used.
2. Fail any public recommendation that skips the public gate, invents SOC 2, or quotes an uptime number.
3. Re-run the tester script on a staging build after the owner asks for that build. The script is the acceptance test, not a green Jest run.

**What we will not do.** Mark a written migration as applied. Mark a browser shot as a VoiceOver pass.

## Marketing

**Lead:** `MARKETING`. **With:** `GROWTH_ANALYTICS`, `BRAND`.

**Where we are.** The approved message is in the product. There is a draft store listing. There is no external campaign. Measurement definitions exist. Telemetry cannot yet identify a person, and Legal has not approved that.

**What we will do.** Stay inside the test wave. Use consented family stories only after a real test, not the composite in the story doc.

**What we will not do.** Announce a public launch, a scholarship result, or a school partnership.

## Support

**Lead:** `SUPPORT`. **With:** `INCIDENT_TRIAGE`.

**Where we are.** Internal tester triage is the whole support desk. There is no help center and no external contact path.

**What we will do.** Use the tester script's journeys (upload, donate, profile, Rally) as the intake list. Escalate money and security incidents to Finance, Security, and the CTO with what was observed, not a guessed cause.

**What we will not do.** Email families or schools. Promise a refund the product cannot perform.

---

## Order of work

The CTO's order until the owner says otherwise. Status as of 2026-10-10 is in the board above.

1. **Quality** checked the photo-story counter and five dots in a browser fixture (320, 375, and 320 at 200% CSS text). Next moves `1 / 5` to `2 / 5`. The photo bitmap did not paint. Upload steps, tagline placements, a live feed, and device paging stay open.
2. **Database and Security** hold the written SQL until the owner asks to apply it on staging.
3. **Product** wrote the STATE §6 decision list into this file. Public acceptance criteria wait on the open rows and on counsel.
4. **Legal** routed the 2026-10-10 compliance gaps in LEGAL_BRIEFING. Counsel's documents stay with counsel. The app is not public-ready.
5. **Every other team** stays inside its "will do" list. Later items stay later.
