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
2. Sign up with your own email. There is no demo account on this build.
3. Confirm you are 13 or older when asked.

## Everyone — Watch (does it feel like TikTok?)

1. Open the app and scroll Highlights for two minutes without stopping.
2. Double-tap to drop Aura. Try Seki and Flex. Tap again to take one back.
3. Tap an athlete's name to open their profile, then come back.
4. Hide one clip. Report one clip (pick any reason — it is a test).
5. Post a clip of a teammate: you must pick who is in it. Then find it on their profile — it should say
   "🎥 Filmed by" you, and after a few friends each watch it for 3+ seconds the ▶ count on the poster goes up.
6. Tap "🎥 Filmed by" on a friend's clip: send Props (once — the button should lock), and check the
   filmer card on your own Profile (tier, clips, views, Aura from filming). Look for your friend on
   Spotlight → Boards → Top Filmers 🎥.

Tell us: *How long before the first video played? Did anything stutter, go black, or jump? Did the
hype taps feel satisfying? Would you keep scrolling?*

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
2c. **Aura card.** On your profile tap **Flip Aura card**, then use **Identity / Season stats**
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
2. Upload one **Serve Like Me** clip (it earns double Aura): how you give back (family, church, school, community).
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
