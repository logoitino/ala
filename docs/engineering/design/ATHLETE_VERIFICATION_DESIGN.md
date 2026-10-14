# Athlete verification, open sign-up, and fake highlights — design

**Status:** 2026-09-29. §2–§4 are **built** (migration
`supabase/migrations/20260929120000_athlete_verification_ladder.sql`, not applied yet) — see §8.
§9 (payout gate without the school, teammate vouches) and §10 (school crest) are **built**
(migrations `20260929130000_payout_gate_without_school.sql`, `20260929140000_school_badge.sql`, not applied).
§3's refunds, §5 and §6 are still proposals. Companions: [PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md)
(who gets paid), [STORY.md](../../product/STORY.md) guardrails, [ROADMAP.md](../../product/ROADMAP.md) Wave 1 checklist.

## 0. Owner direction (2026-09-29)

- Anyone can create an account. Do not make families wait to register their kids.
- There is one kind of account. Fans and athletes use the same app, and the app clearly shows
  who is a fan, who has **claimed** to be an athlete and is waiting, and who is a **verified**
  athlete.
- A school confirms that the kid is an athlete at that school.
- Nobody should be able to falsely claim to be an athlete and collect money.
- Workouts and other videos may be edited. A **game highlight must be real** — take down
  AI-generated fakes.
- **Decided (second message, 2026-09-29):** gifts to a pending athlete are **held until verified**,
  and the athlete can see that message in the app.
- **Decided:** the school confirms from its end. The **athletic director or coach** talks to the
  student in person and fills in a Tapua'i form that only they can use. That proves the kid attends
  that school and is on the team.
- **Growth rule (third message, 2026-09-29):** if creating an account takes too long, people stop
  using the app. Verification must never slow sign-up or depend on schools to grow. See §9.

## 1. What the code does today (read before changing it)

- **One account type already.** `profiles.roles` holds `['fan']` or `['fan', 'athlete']`, and
  `active_role` switches the view. `verification_status` is `unverified` / `pending` / `verified`.
- **Verification is one shared code per school and sport.** `redeem_team_code` sets
  `verification_status = 'verified'` for whoever types a school's team code. The code is shared
  by the whole team, so a screenshot in a group chat verifies anyone. It proves "had the code",
  not "is this athlete".
- **The link to an athlete is self-declared.** `profiles.player_id` is client-writable, and
  `lib/teams.ts` links by name match, so a "verified" account can point itself at any athlete
  (STATE §5). Put together, the two holes let a stranger become a verified copy of a real kid.
- **Reports have no reason, and one report hides a clip.** `report_reel` sets `is_flagged = true`
  on the first report. A rival fan can hide any clip, and moderators cannot tell a fake from a
  complaint.
- **Upload defaults to "game play"** with no statement that the footage is real.

## 2. Recommended account ladder

| Level | How you get there | Badge others see | What you can do |
| --- | --- | --- | --- |
| **Fan** | Sign up | none | Watch, hype, tag, upload, give |
| **Athlete — claimed** | "I'm an athlete" (or a parent registers their kid): school, sport, class year, jersey | "Not yet verified" (neutral grey) | Everything a fan can do, plus an athlete profile, Train / Serve Like Me posts, tags on their clips wait for review. **Can receive gifts, which are held** (§3) |
| **Athlete — school code OK** | Enters the school/team code | "Verification pending — {School}" | Same as claimed. The code narrows the school; it no longer verifies on its own |
| **Verified athlete ✓** | School confirmation (§4) **and**, for a minor, a linked guardian | "✓ Verified · {School} {Sport}" | Payouts (through the guardian until handover), rankings on the boards as an athlete, public Ask-an-athlete |

Rules that make the ladder safe:

1. The link to a specific `players` row is created **only** by verification. Clients cannot
   write `profiles.player_id`. The claim picks a row, but the link stays pending.
2. **One active claim per athlete.** A second claim on the same `players` row freezes both
   claims and goes to admin review. Nobody earns while it is disputed.
3. The badge is shown everywhere a fan can give money: profile, Highlight, checkout.
4. Verification can be revoked. Revoking removes the badge, freezes payouts, and refunds any
   held gifts (§3).

## 3. Money while waiting — "earn now, paid out when verified"

The owner wants families to be able to start right away. Recommendation:

- Fans **can** give to a claimed athlete. Checkout says plainly: *"{Name} isn't verified by their
  school yet. Your gift is held and only paid out after verification. If they aren't verified
  within 30 days, you get it back."*
- Held means held in the guardian's Stripe account on a manual payout schedule (the custodial
  design already needs this), **not** in Tapua'i's balance. No guardian yet → gifts wait until
  the guardian finishes setup, or are capped.
- **Cap while pending**, e.g. $250 total, so a fake claim cannot turn into a large fraud.
- Not verified within 30 days, or verification rejected → **automatic refunds** to the fans.
- Aura, hype, tags and boards work from the first minute. Only money is held.

**Owner decided: held while pending**, and the athlete is told so on Activity. Built: the message on Activity and the gift sheet. Not built: the cap and automatic refunds (need the Phase 1a ledger). "Held" is true today only because payouts are off (503); any payout code must call `athlete_payout_allowed`.

## 4. How the school confirms — options (pick one or combine)

"No coaches" was decided for **stats**. This is a one-time yes/no per athlete, which most
athletic directors will do if it takes one minute.

1. **Roster approval link (recommended).** The athletic director or head coach gets a magic
   link on their **school email domain** and ticks the athletes on a roster page: all 30 kids in
   one sitting, no app install needed. Per athlete, not per team.
2. **Single-use athlete codes.** The school or booster club hands out one code per athlete, so
   a code used twice is detected. The shared team code stays only as the "school code OK" step.
3. **Admin roster match.** A Tapua'i admin matches the claim against the school's public roster
   and calls the school for edge cases. Works for the first metro, but does not scale.

Layers that help with any of the options:

- **The guardian's Stripe identity check.** When a parent sets up payouts, Stripe verifies the
  adult's identity (free KYC). That proves a real adult is who they say they are; it does **not**
  prove they are the athlete's parent (corrected 2026-10-14 by the verification panel — relationship
  evidence is a separate step, see `docs/engineering/design/PAYEE_VERIFICATION_PLAN.md`).
- **Guardian confirms the kid** in Parent HQ, and the athlete confirms the guardian. Two people
  lying is much harder.
- **Duplicate and anomaly checks:** the same device or payout bank on several athletes, or a
  claim far from the school.

**Owner chose an in-person version of option 1** — built as below (§8).

## 5. Growing users without false athletes

1. **Parent-first sign-up.** A parent registers their athlete in under a minute from the game-day
   QR flyer. The kid is invited to their own login later (COPPA: 13+ only).
2. **Unclaimed profiles from fan tags.** When a fan tags a kid who isn't on the app yet, the
   athlete gets a shell profile with hype but **no money**, plus an "Invite the family" share
   link. Claiming goes through the ladder.
3. **Teammate invites.** A verified athlete's profile shows "Your teammates on Tapua'i" and
   shares invite links. Each teammate still verifies on their own.
4. **Booster clubs as ambassadors.** The booster club distributes the per-athlete codes (§4 option
   2). They want this because they sponsor and match Rallies.
5. **School rivalry boards** (M1, built). A school with more verified athletes and fans climbs
   the board, which pulls the rival school in.
6. **Aura for referrals, never money.** A fan who brings in a family that becomes verified earns
   Aura.

## 6. Fake and AI-generated game highlights

**Policy (Terms + upload screen):** a Game Day (formerly "Game play") Highlight must be real footage from a real game.
Train Like Me / Serve Like Me and other videos may be edited, but showing a real person doing
something they did not do (AI-generated or face-swapped) is banned in every category.

**Prevent:**

- **Upload statement for Game Day:** *"This is real footage from a real game. I filmed it or
  have permission."* Record who confirmed it and when (`reels.attested_at`).
- **"Filmed at the game" badge** for clips recorded in the app, or linked to a scheduled game
  (date and place match). Prefer these on the Most-viewed Highlight board.
- **Tag confirmation** (built): the athlete or their guardian confirms "that's me". Only
  confirmed clips reach the boards.
- **Content Credentials (C2PA):** read them when present. Many AI tools now label their output.

**Detect:**

- **Report reasons:** "Fake or AI-made game footage", "That's not this athlete", "Impersonation",
  "Inappropriate", "Other".
- **Weighted hiding instead of one-report hiding:** a report from the tagged athlete or their
  guardian hides the clip at once; otherwise, hide after about 3 reports from separate accounts.
  This stops rival fans hiding real clips.
- **Optional third-party AI-video detection** (e.g. Hive, Reality Defender) on game-play uploads,
  used as a flag for review, never as automatic removal. Costs money per video, so Wave 2.

**Take down:**

1. Hidden pending review. An admin decides within 24 hours on `/admin/highlights` (the desk and
   `moderate_flagged_reel` exist; add the reason and a note).
2. On removal: drop the clip from boards and Spotlight, reverse its hype and Aura, and notify the
   uploader with the reason.
3. **Strikes:** three upheld fake-footage removals suspends uploads. Faking a minor is removed on
   the first strike.
4. **Appeal** once, reviewed by a different admin.
5. An athlete or parent can always ask for any clip of them to come down (STORY guardrail).
   Deepfake and intimate-image laws may require removal within 48 hours in some cases; counsel
   sets the clock.

## 7. Build order (cheap first)

1. Close the self-link hole: link to a player row only through verification.
   **Blocks Wave 1.**
2. The shared team code moves an account to "pending", not "verified". Add per-athlete approval
   (§4 option 1 or 2) and the duplicate-claim freeze.
3. Badges everywhere money appears, plus the "held until verified" checkout line.
4. Report reasons, weighted hiding, the upload statement for Game Day, and strikes.
5. Held-gift cap and automatic refunds (needs destination charges and a manual payout schedule).
6. "Filmed at the game" badge, C2PA read, and optional AI detection (Wave 2).

## 8. What was built (2026-09-29)

**In-person school confirmation.**

1. Tapua'i issues each athletic director or coach their own link
   (`admin_add_school_confirmer` → `alasports://school-confirm?t=TOKEN`), sent to their school
   email. The token is shown once and stored hashed. A coach link can be limited to one sport.
2. The athlete claims (onboarding, "Claim", or a school code) → **pending**. Activity shows the
   pending badge, the held-gifts message and the steps.
3. At school, the athlete taps **Show my school code**: 6 digits, valid 30 minutes, stored hashed.
4. The staff member opens their link, sees only their school's (and sport's) pending students —
   name, sport, class year, jersey, whether a code is live — types the code, ticks *"I met this
   student in person and they are on my roster"*, signs with their name, and taps **Confirm**. Or
   **Not on my roster**.
5. Confirm → the account is verified and linked to the roster row. Five wrong codes void the code.
   The signature and time are kept on the request.

**Safety rules in the database.** Only the server can set `is_verified`, `verification_status` or
`profiles.player_id` (trigger). One open claim per account; a second claim on the same athlete
freezes both (`disputed`) for admin review. Admin approval stamps only the requester. Tag
confirmation and the public "verified" check no longer match by name. On apply, accounts verified
only by a shared team code go back to pending.

**Not built yet:** held-gift cap and refunds; a web version of the school form for staff without
the app; an admin screen to issue confirmer links (SQL Editor for now); parent-registers-kid.
§6 report reasons, the upload confirmation, and weighted hiding landed 2026-10-01
(`20261001180000_content_rights_reports.sql`). Still open in §6: strikes, appeals, the filmed-at-the-game
badge, and C2PA.

## 9. Growth first — school confirmation as a badge, not a gate (built 2026-09-29, owner OK)

**Rule:** nothing about verification may slow sign-up, watching, hyping, tagging, uploading or
giving. The only thing verification may hold is **money leaving Tapua'i** (a payout).

Done 2026-09-29 (no money rules changed):

- Guests already browse and watch with no account; the soft wall appears only on give / join a
  Crew / chip in, and resumes that action after sign-in.
- Sign-up sheet leads with one-tap Apple / Google; email is below "or use email".
- Athlete claim needs only team + sport (+ the NIL acknowledgement LEGAL requires). Number,
  position and class year are optional.

Approved by the owner 2026-09-29 ("yes") and built — see "As built" below. Original proposal:

1. **School confirmation becomes optional** — a "✓ School confirmed" trust badge that ranks
   higher on boards, not the only road to payouts. Schools that never engage don't block their
   athletes.
2. **Payout gate without the school:** guardian (or 18+ athlete) passes **Stripe Connect KYC**
   (already required, free; a fake parent can't pass it) **+** no open duplicate claim **+** a
   running cap (e.g. $250) until one extra signal arrives.
3. **Extra signals that lift the cap** (any one): school confirmation; 3 vouches from teammates who
   are themselves past the gate; the athlete or guardian confirming tags on real game highlights
   that other fans uploaded; guardian ↔ athlete mutual confirmation in Parent HQ.
4. **Held-gift copy** (`GIFT_HELD_NOTICE`, `VERIFY_HELD_COPY`) would change from "after your school
   confirms you" to "after payout setup" — LEGAL owns this copy; flag for counsel.
5. **Growth levers to build next** (from §5, none need a school): parent-first QR sign-up on
   game-day flyers; shell profiles from fan tags with "Invite the family"; teammate invite links;
   booster clubs as ambassadors; rivalry boards (built); Aura for referrals.

Build cost if approved: one migration updating `athlete_payout_allowed` (KYC + no dispute + cap),
a vouch table/RPC, and copy changes. The school form stays as the badge path.

**As built** (`supabase/migrations/20260929130000_payout_gate_without_school.sql`, not applied):

- `athlete_payout_status(player)` is the one question. School confirmed → allowed, no cap. Else
  held if any claim on that athlete is disputed, or there isn't exactly one pending claim. Else
  allowed once Stripe's ID check passed — the linked guardian's `custodial_accounts.payouts_enabled`
  (with `players.guardian_id` matching), or the claimant's own `profiles.payouts_enabled` when no
  guardian holds the money. Both flags are server-written only.
- Cap `athlete_pending_payout_cap_cents()` = $250 until **3 teammate vouches** or school
  confirmation. Payouts are still off everywhere; the Phase 1a ledger must read this and honour
  `cap_cents`.
- Vouchers must be school confirmed, or past the gate themselves, at the **same school**; no
  self-vouch; 10 a day. Activity shows "Vouch for teammates" only to people who can vouch.
- `athlete_is_varsity_verified` now means school confirmed only (the public badge).
- Held copy now says "until a parent finishes payout setup (or your school confirms you)" —
  LEGAL row M.
- **Deferred:** tag-confirmation and guardian ↔ athlete mutual signals (item 3) — build with the
  ledger.
- **Bottleneck:** `players.guardian_id` is still set only by a Tapua'i admin
  (`admin_set_player_guardian`), so the guardian path waits on us. Next: a self-serve "invite your
  parent" link from the athlete, accepted in Parent HQ, that sets the link server-side.

## 10. School crest — the visible badge, hard to fake (built 2026-09-29)

Owner: show the school's badge or logo after verification, somewhere noticeable, so a fan profile
can't imitate it.

- **Data is server-only.** `athlete_school_badge(player)` returns crest data only when a
  school-confirmed account is linked. Logo and colours live on `schools_and_teams` and only an
  admin sets them (`admin_set_school_branding`, https logos, `#RRGGBB` colours). No logo → a
  monogram shield in the school colours (fallback palette hashed from the school id).
- **Placement no fan can copy:** a school-colour band behind the profile photo (fans have no
  banner or cover at all), the crest pinned to the ring edge **outside** the photo (so it can't be
  baked into an avatar), a small crest by the team line on the Aura card, and the school line
  reading "✓ {School} athlete · {Mascot}".
- **Motion:** crest and band carry a moving shine; a screenshot pasted into a photo is static.
- **Proof on tap:** the crest opens a sheet — "Confirmed in person by the athletic director on
  {date}" (role only, never the staff member's name) and "A school logo inside a profile photo is
  not a confirmation."
- **No look-alike marks in names:** ✓ ✔ ☑ ✅ are blocked in `full_name` / `username`
  (constraint `profiles_name_no_check_marks`, NOT VALID for old rows; Edit Profile shows why).
