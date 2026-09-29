# Athlete verification, open sign-up, and fake highlights — design

**Status:** 2026-09-29. §2–§4 are **built** (migration
`supabase/migrations/20260929120000_athlete_verification_ladder.sql`, not applied yet) — see §8.
§3's cap and refunds, §5 and §6 are still proposals. Companions: [PARENT_PAYEE_CONNECT_DESIGN.md](PARENT_PAYEE_CONNECT_DESIGN.md)
(who gets paid), [STORY.md](STORY.md) guardrails, [ROADMAP.md](ROADMAP.md) Wave 1 checklist.

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
  adult's identity (free KYC). A fake parent cannot pass it.
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

**Policy (Terms + upload screen):** a "Game play" Highlight must be real footage from a real game.
Train Like Me / Serve Like Me and other videos may be edited, but showing a real person doing
something they did not do (AI-generated or face-swapped) is banned in every category.

**Prevent:**

- **Upload statement for game play:** *"This is real footage from a real game. I filmed it or
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
4. Report reasons, weighted hiding, the upload statement for game play, and strikes.
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
the app; an admin screen to issue confirmer links (SQL Editor for now); parent-registers-kid; §6.
