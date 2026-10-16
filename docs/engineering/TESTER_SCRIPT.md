# Tester script — Phase 3 internal wave

For the trusted first group (team, family, friendly coaches and boosters). Stripe is in **test
mode**: no real money moves. Use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

Setup for whoever runs the wave: [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). Why we are building
this: [STORY.md](../product/STORY.md). Game-day gigs (the operator console) are an upcoming feature and are not part of this wave. Every task below checks one of the four pillars in
[ROADMAP.md](../product/ROADMAP.md) — **Watch & compete** (TikTok), **Rally** (GoFundMe, but better), **Pass it
on** (Train Like Me / Serve Like Me), **Rise** (a touch of Hudl).

**Report everything through the app** (Profile → menu → Send a suggestion). Make sure `buttons.suggest` is on and published before the wave. A screenshot plus one sentence is
perfect. "This felt slow" counts as a bug.

---

## Before you start (2 minutes)

1. Install from the link you were sent (iPhone needs your device registered first).
2. Check the installed build against STATE §0. The current internal preview offers the
   test account `demo@tapuai.app`; use its account-sheet action or create your own account.
3. Confirm you are 13 or older when creating an account; sign-in does not ask again.

## Everyone — Watch (does it feel like TikTok?)

1. Open the app and scroll Highlights for two minutes without stopping.
2. Double-tap to drop Aura. Try Seki and Flex. Tap again to take one back.
3. Tap an athlete's name to open their profile, then come back.
4. Hide one clip. Report one clip (pick any reason — it is a test).
5. Post a clip of a teammate and choose that athlete. Then find it on their profile — it should say
   "🎥 Filmed by" you, and after a few friends each watch it for 3+ seconds the ▶ count on the poster goes up.
   On a build with the current upload flow, also try **Tag later** on a video: it can publish without an
   athlete, shows "Not tagged yet", and Donate stays off until an athlete is tagged. Photo stories still
   require an athlete before publishing. Check STATE §0: the October 11 night previews lack Tag later.
6. Tap "🎥 Filmed by" on a friend's clip: send Props (once — the button should lock), and check the
   filmer card on your own Profile (tier, clips, views, Aura from filming). Look for your friend on
   Spotlight → Boards → Top Filmers 🎥.

Tell us: *How long before the first video played? Did anything stutter, go black, or jump? Did the
hype taps feel satisfying? Would you keep scrolling?*

## Browser playback repair follow-up (PLAY-01)

Use a build containing PLAY-01; the older queued previews do not contain this repair.

1. Play a known valid video. Scroll away/back quickly, open/close its profile, and
   toggle sound. Repeat while a clip is loading: no red error overlay should appear
   from an interrupted play request, and an offscreen or locked clip stays paused.
2. Use an existing known failed clip or an approved local invalid-media fixture.
   It shows **This Highlight couldn't play.** and **Retry**, rather than an uncaught
   exception. Retry starts one attempt; leaving the clip still works. A bad hosted
   file can fail again—Retry does not repair its contents or format.
3. Verify keyboard and screen-reader access to **Retry this Highlight**, a minimum
   44-point touch target, and readable text at narrow/large native text sizes.
4. A failed/loading/paused clip contributes no playback time to the view threshold.
   A valid focused unlocked clip still counts after real playback, using the existing
   threshold. Photo stories retain their photo-loaded rule and horizontal paging.
5. On iOS and Android, verify slow replacement, rapid focus changes, lock/unlock and
   returning from the background. Successful bundle exports alone do not accept
   native decoder readiness, VoiceOver/TalkBack or device gestures.

## Profile sport and navigation follow-up (2026-10-07)

1. Use Football, Volleyball, Basketball, and unknown/ambiguous position profiles. Hero, Stats and
   Aura card must share sport. Volleyball uses Matches/Kills/Digs and its measurables; no football
   yards or 40-yard tile. Recorded zeroes remain zero, absent totals are dashes. Change an owner's
   chosen sport: old totals/logs from another sport must not be relabeled.
2. Open Goals directly: wishlist is first, Rally follows; donation review and locks still operate.
   Open Stats: no wishlist below it. Open Team, choose another athlete, and return with Back.
3. Open your exact linked athlete: Manage has inbox/thank-yous/Vault tools. A same-name public
   athlete retains Donate/Join but no owner tools. Community profile shows no borrowed stats.
4. Rapidly switch profiles while requests are slow; old identity/totals must not flash or overwrite
   the new athlete. Hide school: hero/Aura/Team must not restore school/crest from the roster.
5. Check compact hero, wrapping navigation and 44-point controls at narrow/large native text;
   readers announce selected tabs, Aura progress and subscription's one-time price. Check Aura
   identity/stats flip, avatars, payment and native navigation on devices.
6. After approved staging application of `20261007211500_public_profile_sport.sql`, confirm public
   selected sport while private bio/social/stats remain hidden; older DBs must remain usable.
   SQL is prepared locally; this is an unrun hosted acceptance check.

## Sports identity — Local, Profile and Highlights (UX-03)

Current local verification passes `pnpm check` (both typechecks, 55 suites / 261 tests and all guards).
Browser Bridge checks and controlled 320/390-pixel fixtures are recorded in [AUDIT_REPORT.md](AUDIT_REPORT.md).
CSS 200% text checks do not certify native font scaling; native checks below remain pending.
Record build, device/viewport, text scale and reader
used; use existing recorded test data or controlled fixtures for missing/scheduled/final states.

1. Open Local with long team and school names. Each score must sit beside its own team, names
   and venue must remain readable, and View game & roster must open the existing game route.
   Letter tiles are neutral identifiers, not confirmed school crests.
2. Check scheduled, live, halftime, final and unavailable data. Scheduled/final must override
   stale running clocks; scheduled scores are dashes, missing live/final scores are unreported,
   recorded zeroes stay zero, and untimed sports do not acquire a clock.
3. Open your athlete profile and another athlete’s profile, including a different athlete with the same name. Check supplied sport/position/class
   only; the other athlete must not inherit your sport/class. Open a community profile: it must
   hide athlete credentials and a favorite athlete’s school-confirmation crest. Test jersey zero, a long name/position, Aura flip and avatar editing;
   school crests must still require the existing confirmation.
4. On Highlights, check actual jersey/position when present and no invented roster details when
   absent. Tap the athlete name, react and open Donate. With a long name, school, caption, account
   mentions and filmer credit, check that the live banner and action rail do not overlap or hide
   necessary controls. Enlarged copy and the rail scroll below the measured header; reach More/Donate
   after scrolling and verify video paging/owner peek still work outside those scroll columns.
   Test narrow screens and large text while playing/paging clips.
5. With VoiceOver/TalkBack, check athlete heading/details, scoreboard status and each team’s
   score, unavailable score wording, profile action disabled state and scoreboard dismissal.

## Upload composer — phone layout and keyboard

1. Tap Upload. The first screen has only video selection. Pick a clip; Details opens with a preview.
2. Add a caption and select the athlete/category. Next stays visible above the home indicator;
   on a short phone with the keyboard open, only this page may need a short scroll.
3. Next opens Review. Open More options to add accounts, a game or Vault access. Tap Done: all choices remain.
4. On Review, each rights confirmation is initially unchecked; Publish requires every
   confirmation applicable to the selected category. Back returns to the same caption and athlete.
5. Replace the clip and return to Review. Rights must be checked again for the new footage.
6. Try a game/athlete search and cancel the library picker. The draft should remain intact.
7. Double-tap Publish: there should be only one upload. If optional mentions fail after upload,
   the clip stays published and the warning identifies the unsaved mentions.
8. Close/reopen the composer. It starts at video selection with the old draft cleared. Check
   screen reader labels, larger text and Android Back on each subpage; no essential action is
   hidden in a long scroll.

Record phone/window size, keyboard state and screenshots. These are device checks; mocked
component tests do not establish visual fit or native picker behavior.

## Beyond on the Highlights bar and the Upload chooser (2026-10-16)

1. On Highlights, the top bar reads **Home | Beyond | Local**. Tap **Beyond**: only workout (💪 Train Like Me) and service (🤝 Serve Like Me) clips play, full screen, with Seki / Aura / Flex and Donate. The clip's badge sits below the banners, not under them.
2. Tap **Fan workouts, service, learning and stories ›** under the bar: the Beyond the Game page opens with **‹ Highlights** at the top. Back returns to Highlights.
3. If there are no workout or service clips, Beyond says so and offers **Share a clip** and **Open Beyond the Game**.
4. The bottom bar is Home · Activity · ＋ · Spotlight · Profile (no Beyond tab).
5. Tap ＋. Where Beyond posting is switched on, a sheet asks **What are you sharing?** — **Highlight** opens the clip composer, **Beyond moment** opens the Beyond composer. Where it is off, ＋ opens the clip composer straight away. Feel question: was it obvious which one to pick?
6. Which of these would you actually say about your workout: "Seki Set", "Extra Rep", "OT" or "Two-a-Day"? Write down the one you remember tomorrow.

## Photo stories in Highlights (UX-05)

Needs `20261007230000_photo_stories.sql` applied to the project the build points at (approved
staging application only). Without it the Upload sheet hides **Photos** and the feed shows
videos only — that is the expected fallback, not a bug. Use photos of yourself, of adults who agree,
or of a teammate whose parent agreed; this is a real public bucket.

1. **Post.** Upload → Media → **Photos**. Pick 5 photos (try 11: the picker should stop at 10).
   Use **Move earlier / Move later** to reorder and **Remove** one. Screen readers should announce
   each button with the photo number.
2. **Describe.** On Details add a caption, tag the athlete, choose **Serve Like Me**, and give two
   photos a description — e.g. *"Our team helped clean the neighborhood park this Saturday."* Try a
   description over 200 characters: it should stop at the limit. Categories read **Game Day**,
   Train Like Me, Serve Like Me (no "Game Play" anywhere — videos too).
3. **Confirm and publish.** Review shows the photo wording *"I took these photos or have permission
   from the people in them."* — unchecked until you tick it. There is no Vault option for photos.
   Publish shows "Uploading photo 2 of 4…". Go Back mid-draft first: the photos and order stay.
   Turn on airplane mode during upload once: nothing should publish half-done, and Retry keeps the draft.
4. **View and swipe.** Find the story in Highlights. Swipe left/right through the photos inside the
   card while up/down still moves between Highlights. The `2 / 4` chip and dots follow you; each
   description shows above the caption. VoiceOver/TalkBack: each photo reads its description (or
   "Photo 2 of 4") and swipe up/down moves between photos. On the athlete's profile grid the poster
   shows the first photo and `📷 4`.
5. **Donate from it.** Tap **Donate** on the photo story: the popup names the **tagged athlete** (not
   you, the poster) and runs the same Amount → Options → Review steps with the 90 / 10 line. Hype,
   save, report and "🎥 Filmed by" work like a clip. Report it once (any reason) and check it leaves
   your feed.
6. **Location check (device).** Post a photo taken with location on. Ask whoever runs the wave to
   download the uploaded file and confirm it has no GPS/EXIF and is not rotated sideways. Record
   phone model and OS — this is the device gate unit tests cannot close.

Tell us: *Was it easy to pick, order and describe photos? Did swiping a story ever fight the feed?
Would you post a Serve Like Me story?*

## The message — Donate. Elevate. Celebrate. (BRAND-01)

1. **Welcome.** Fresh install (or clear app data): the first-open card shows the mission, then
   **Donate. Elevate. Celebrate.** and *Support their journey. Elevate their opportunities.
   Celebrate their story.* The big title above it is still the screen's title.
2. **Donate sheet.** Open Donate anywhere: a small **Donate. Elevate. Celebrate.** line sits at the top
   of the Amount page, above "Choose your donation" and the 90 / 10 line. It is gone on Options and
   Review, which stay plain.
3. **Profile.** Open another athlete's profile: the small line sits under **Donate**. It must not show
   on your own profile, on a community (fan) profile, or when Donate is switched off.
4. With a screen reader the line reads as plain text, not a heading. At large text it wraps and
   never covers Donate or Share.

Tell us: *Did the line make it clearer what Tapua'i is for? Did "Elevate their opportunities" sound
like a promise? (If yes, tell us — that matters.)*

## Donate popup — short steps and review

1. Open Donate from a Highlight, profile, gear goal, Rally and QR link. Confirm the recipient
   and source remain correct while moving through Amount → Options → Review in one popup.
2. Choose a preset, then Custom. Reject blank, zero, negative and malformed amounts. Back/Next
   remains reachable with the keyboard open on a small phone; Back preserves the amount.
3. Options starts at **No tip** for Tapua'i and unchecked card-fee coverage. Choose optional
   amounts, go Back, then forward again: the choices and calculated total remain consistent.
4. Review shows donation, optional tip, optional card-fee amount, total and the 90 / 10 split.
   The gift-held notice remains present when applicable. No payment starts on Next.
5. Tap the final Donate action twice: start one payment. While payment is preparing, Back,
   close and Android Back must not discard checkout. Cancel Stripe: selections remain and
   another attempt is possible. Check failure messaging, retry and one recorded test donation.
6. Close/reopen after cancellation; a new popup starts on Amount with default optional choices.
   Check screen-reader labels and 200% text scaling. Record device/build/window and screenshots.
7. On Review, tap Close and immediately tap Donate while the card slides away. No payment
   should start. Check Android Back and backdrop dismissal as well.
8. With synthetic test data, simulate a recording/counter failure after Stripe succeeds.
   The popup says payment was received and removes Donate; it must not invite another charge.
9. Change the recipient during an inline checkout and let the old test payment finish.
   The new recipient must not show the old thank-you or inherit its donation/count callbacks.
10. Use a screen reader on card-fee coverage: it announces the exact added fee and that
    the family's share stays the same. Record device evidence rather than inferring it from Jest.

## Shared menus and page energy

Use [MENU_STYLE_MAP.md](MENU_STYLE_MAP.md) to cover every modal family and page shell. Check
rounded cards, jade/cyan/gold/violet accents, readable labels, close controls and visible focus
with reduced motion and larger text. Include Profile menu/edit/Aura, search/report, sign-in,
Rally/thanks, legal/verification, Drip and enabled role HQ menus. Video player and operator/admin
workspaces retain their functional contrast and density. Verify no sheet overlaps the keyboard
or home indicator. A shared token update does not establish device fit for every consumer.

## Fan — Compete (is it fun to root for your school?)

1. Open Spotlight and find this week's standings. Is your school's athlete on it?
2. Home → Local pill: vote in a cheer poll if one is open.
3. Upload a clip from a game (any sport) and tag the athlete in it.

Tell us: *Did you feel like you were competing with the other school's fans? What would make you
check the standings every week? (Most-viewed Highlight and school-vs-school boards are coming —
tell us what you'd want on them.)*

## Fan — Rally (is giving effortless?)

1. From a Highlight, tap **Donate** and donate to that athlete with the test card. Check the sheet says where the donation goes.
2. From an athlete's **profile** (no clip open), donate again.
3. Find an athlete with a Locker goal and donate toward it.
4. Open Profile → Receipts and find all three gifts.
5. Open Activity and check what you see.
6. **Check the sheet.** Before you pay, it should say 90% goes to the athlete's family and 10% to
   Tapua'i. The **tip for Tapua'i** should start at **No tip** and the card-fee box unchecked. Pick 10%
   and tick the box — the breakdown line should add both and show the new total.
7. **Rally.** Find an athlete with a Rally card on their profile. Donate to it — the bar should move
   after the sheet closes. If your donation fills it, you should see confetti.
8. After the athlete thanks you (see Athlete step 7), open Activity: you should see "{athlete} said
   thanks" with their message.

Tell us: *How many taps from "I want to support this kid" to done? Where did you hesitate? Did it
feel like a gift to the athlete, or like paying for a clip? Did it feel exciting when it went
through?*

## Parent (or someone standing in for one)

1. Find your linked athlete and try the consent toggle. You should see **only** athletes linked to
   you, never the whole roster. (We link you after checking who you are.)
2. On your athlete's card, enter their date of birth and answer "Is the payout bank account in the
   athlete's name?" (We strongly encourage yes.)
3. Ask your athlete to approve a small withdrawal, with a note ("cleats"). Then check it says it
   is waiting on them. Try cancelling one too. (Nothing is paid out in this build — it records
   the request only.)
4. **Rally.** On your athlete's Rally card, tap **Start a Rally**, pick "Gear", name it "New cleats",
   goal $30, and start it — it should go live at once. (If your athlete started one, you should see
   **Approve this Rally**.) Share it, then have two test fans fill it.
5. When it fills, tap **Say thanks to everyone 🙏**, pick a clip and a message. Fans should see it on
   the card. Under "Support received", thank one donor with **Say thanks 🙏**.

Tell us: *Would you trust this with your kid's money? What would you need to see first? What would
make you share your kid's page with family?*

## Athlete — Rise (does it make you look recruitable?)

1. Claim your profile and enter your school code (we will give you one directly). Your profile
   should say **Verification pending**, and Activity should tell you gifts are held until your
   school confirms you.
2. **Get confirmed.** On Activity tap **Show my school code**. Show the 6 digits to whoever is
   playing your athletic director or coach; they type it into the school form link we sent them,
   tick "met in person", sign, and tap **Confirm**. Pull to refresh Activity — the card should go
   away and your ⚡ badge turn on. (Confirmers: also try a wrong code and "Not on my roster".)
   Your profile should now show your school's colours behind your photo and the school crest on
   the edge of the ring. Tap the crest — it should say who confirmed you and when.
   (Whoever runs the wave sets the crest first:
   `select public.admin_set_school_branding('<school id>','https://…/logo.png','#1D3F8F','#FFFFFF');`)
2b. **Vouch.** As a confirmed athlete, open Activity: pending teammates at your school appear
   under "Vouch for teammates". Tap **They're on my team** — the count goes up by one.
2c. **Aura card.** On your profile tap **Flip Aura card**, then use **Identity / Stats**
   under the card and swipe the card itself. It should flip every time and nothing should overlap.
3. Upload a Highlight tagged to yourself.
4. Look at your profile's Highlights, Stats and Vault tabs. Lock and unlock a Vault clip.
5. Start Stripe Connect onboarding (test mode — use Stripe's test data, not your real details).
6. Open **Activity**. The card at the top should say who holds your donations and until when. When your
   parent sends a withdrawal request, approve one and decline one. (Needs a verified athlete
   account and a linked parent.)

7. **Say thanks.** On your profile, under "Support received", tap **Say thanks 🙏** on a donation and
   pick a message. It should change to "Thanked ✓". There is no way to type your own message — on
   purpose. Try **Start a Rally** too: it should say it is waiting for your parent or guardian.

Tell us: *Did the money card make it clear the money is yours and nobody can take it without
you? Would you send this profile to a college coach? What is missing? What would make you
proud to share it?*

## Proven athlete — Pass it on (Train Like Me / Serve Like Me)

For an older athlete (college or senior) the younger ones look up to.

1. Upload (+) and pick the **Train Like Me** category: a drill, a workout, a routine.
2. Upload one **Serve Like Me** clip or photo story (it earns double Aura): how you give back (family, church, school, community).
3. Have a younger tester find both clips in the feed.

Tell us: *Would you keep posting these? What would you want fans to be able to ask you? Would you
do a 1-on-1 with a young athlete if the app kept it safe and a parent was there?* Younger testers:
*What would you ask?*

## Booster

1. Home → Local pill → Top Boosters: pick a sponsorship tier and check out with the test card.
2. Find where your business appears afterward.

Tell us: *Would a local business pay for this? What would make matching an athlete's goal
appealing?*

---

## Main admin — ADM-02 hosted and device follow-up

The main application is Expo `/admin`; the local `:3033` report preview supplied the
design. [ADM-02](../agents/ADM-02.md) records local synthetic-data evidence.

1. With a staging admin account, open Home, Trends, Audience, Revenue, Health,
   Product, Analytics and Departments, then all four Product oversight pages.
   Check real source permissions, missing donation-band notices and the ledger's
   test-mode/partial-read notices against the staging data.
2. Use Manage desks and each lens to reach the owning editor. Confirm draft changes
   remain drafts until the reviewed Publish action; perform writes only as part of
   an authorized staging test. Check Back/Home trails and sign-out.
3. Repeat access with a guest, signed-in non-admin and revoked admin. Guests should
   reach the existing sign-in sheet; report data must never cross account changes.
4. On an installed iOS/Android build, check large text, screen-reader summaries,
   complete Data values and native navigation. Bundling alone does not accept this.
5. On the browser, check keyboard Health tabs and Data disclosure, enlarged text,
   full money values and unobscured focus. Record browser-tool limitations separately
   from application failures.

## Engineer/admin telemetry delivery follow-up (HEALTH-01 / DETECT-01-G3)

Use a build containing HEALTH-01. This is the existing QA repair tool under `/admin/qa`,
alongside the aggregate analysis in Health. Run failure injections only in a controlled local
transport fixture or an explicitly authorized test environment; never put real private payloads
into an error probe. Local regression results are in [HEALTH-01](../agents/HEALTH-01.md); the
hosted/device walkthrough below remains unrun until its build/environment evidence is recorded.

1. Open QA on the test device and record the sample time, build and device. A process-local
   delivery view must identify its scope: no previous confirmed delivery is unknown, not proof
   of fleet health. Health remains the source for aggregate periods and operational thresholds.
   An older development singleton without `getHealth` must request a full app reload without
   displaying invented zero counts.
2. Generate one existing synthetic event and flush in the controlled fixture. Confirm successful
   delivery increments only the local delivered count and its timestamp. No new event field,
   personal identifier or raw backend diagnostic should appear in the delivery-health sample.
3. Probe unconfigured, missing-table (`42P01` / `PGRST205`), denied and ordinary failed writes.
   They must remain distinct; a message merely naming `telemetry_logs`, a missing column or
   relationship must not read as a missing table. Rejected rows count loss and are not replayed.
4. Simulate a response lost after a server INSERT and a hung request. The attempted batch must
   never replay; uncertainty is part of dropped, not a separate population to add to it. The
   caller returns after ten seconds and requests abort. If the fixture ignores abort, its
   reservation remains in flight and blocks new sends until it settles; later normal triggers
   can send fresh rows only. Confirm no batch exceeds 15 and queued plus in-flight never exceeds
   120. Overflow increments loss; dropped may exceed accepted because refusal is not admission.
5. Keep one QA source pending or failed while the other completes: the telemetry digest and
   device OfflineQueue must render their own available/unread states independently. Refresh
   repeatedly, change focus and remount during a delayed source read: at most one actual read
   per source may remain pending, including development reload. The UI stops waiting after ten
   seconds but does not cancel transport/release the slot; overlapping requests explain the
   existing pending read. Only real settlement allows a fresh read. No old response may be
   cached/reused or replace the latest sample, including after navigating away.
6. After a later successful delivery, historical failure/time must remain visible. Dispose the
   test logger during a write: buffered rows count loss, unconfirmed attempted rows count
   uncertainty, listeners stop and late success cannot claim delivery. A new process/singleton
   starts fresh counts only after a fresh process/test reset; `getInstance()` retains a disposed
   logger without starting a replacement writer. Neither restores a lost batch or proves
   durable crash intake.
7. Use controlled queued Clear/Unsave actions: labels must describe removal accurately. Keep a
   repair write unresolved: the notice must say its result is unconfirmed and its action lock
   must remain held until real settlement. A read/UI timeout must not unlock or replay it.
   Navigate away before completion: no late follow-up read or success state may appear in a
   newer generation. Replay completion reports the actual remaining count; local labels and
   notices do not change existing offline action semantics or permissions.

Record actual checks/results/date and any unresolved reservation or unavailable source. Route
local failures to TELEMETRY + ADMIN/QA; hosted ingestion/retention to BACKEND + TELEMETRY with
PRIVACY_ENGINEERING, and durable crash intake to RELIABILITY. A successful local sample does
not close those hosted/fleet/device/retention gaps.

## After the session — five questions for everyone

1. In one sentence, what is this app for?
2. What was the best moment?
3. Where did you get stuck or confused?
4. Would you give real money through this to an athlete you know? Why or why not?
5. Who is the first person you would show it to?

## For whoever runs the wave

- Log each P0 (crash, lost money, wrong person charged, data shown to the wrong person) and P1
  (a role can't finish its tasks) from the Admin → Feedback desk.
- **Exit (ROADMAP Phase 3):** every role finishes its tasks with no P0/P1, on a real installed
  build, on staging.
- Ask 3–5 families if they would run a real Rally in the next wave — those become the consented
  stories STORY.md calls for.


## Family activity release rehearsal — FUN-01 / QUIZ-01

These are new required manual checks, not an execution receipt. Local source in codex/fan-zone
is newer than the earlier preview builds. Both pilots start inactive with empty tester cohorts.
Owner-approved hosted SQL/API setup, bounded approved accounts, facts/terms, staffed contact
and school/subject permissions must be ready before an authorized hosted rehearsal. Do not
interpret missing campaigns/questions or an unavailable API as a healthy zero.

1. Check Home, parent/booster/sponsor/operator HQ and profile from each eligible role. Open
   the root activities, use Back and account Home, and check small screens, keyboard and
   screen readers. A guest or unlisted account must not acquire private campaign access.
2. Quiz: choose a sport explicitly; answer one question, including an incorrect answer.
   Check the explanation and private Sport Learner completion badge. Retry a lost answer
   response with the same request/choice; another sport must not issue a second question
   that week. No money, Aura, fan vote or public school points change.
3. Compare local Not now with server-confirmed Skip this week. Simulate a failed Skip/read:
   do not claim it saved. Refresh and check private prior badges/corrections while paused.
   Verify the canonical UTC Monday boundary on the server; device clock is not authority.
4. Fan entry: reserve a private clip revision, check compression/sanitization/verification,
   and interrupt the response. Retry without overwriting the reserved object. Review the
   exact video/caption/scope. Change that scope from another authorized session; the old
   grant must be refused and fresh playback plus confirmation required. Test unavailable
   refresh and ensure an old grant-capable permission panel cannot remain.
5. Teen/guardian: keep assent and grant separate. An active linked guardian can review the
   selected campaign privately even when not enrolled to participate. End/revoke the link
   or change the media revision; subsequent reads/exposure must fail. A different historic
   grant must not silently replace the explicitly relied-on grant.
6. Free ballot: test one account ballot, replacement version, lost response and a second
   device change. The final current ballot comes from a fresh server read, not the replay
   receipt. Check close deadlines, self-vote refusal, invalidated votes, ties, zero votes
   and reviewed recount. Donations must not buy entries, ballots or award advantage.
7. Help & Safety: submit a real bounded concern and save receipt/secret. Check expiry,
   authorized contact and explicit missing guest fallback. Withdraw separately from
   requesting removal; remove every tracked historical revision and confirm actual Storage
   absence before declaring completion. Exercise partial removal and provider failures.
8. Curated story navigation must open the same authorized athlete profile/Donate path.
   Optional private service reflections can be deleted and must add no money, Aura, votes
   or public badge. Change accounts during reads/actions and ensure no old private state,
   draft or late media bytes attach to the new identity.

ADMIN/SUPPORT and independent QA record actual dates, actors, platform, source/deployment
hashes, failures and repair evidence. Legal/Privacy/Minor Safety/Content/Rights/School review
release terms and permissions; Growth checks accepted return/participation/support/cost
measures in the October 20 packet. These source checks do not certify real-world guardianship,
moderation capacity, hosted deletion or growth uplift.
