# Tester script — Phase 3 internal wave

For the trusted first group (team, family, friendly coaches and boosters). Stripe is in **test
mode**: no real money moves. Use card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

Setup for whoever runs the wave: [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). Why we are building
this: [STORY.md](STORY.md). Game-day gigs (the operator console) are an upcoming feature and are not part of this wave. Every task below checks one of the four pillars in
[ROADMAP.md](ROADMAP.md) — **Watch & compete** (TikTok), **Rally** (GoFundMe, but better), **Pass it
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

Tell us: *How long before the first video played? Did anything stutter, go black, or jump? Did the
hype taps feel satisfying? Would you keep scrolling?*

## Fan — Compete (is it fun to root for your school?)

1. Open Spotlight and find this week's standings. Is your school's athlete on it?
2. Home → Local pill: vote in a cheer poll if one is open.
3. Upload a clip from a game (any sport) and tag the athlete in it.

Tell us: *Did you feel like you were competing with the other school's fans? What would make you
check the standings every week? (Most-viewed Highlight and school-vs-school boards are coming —
tell us what you'd want on them.)*

## Fan — Rally (is giving effortless?)

1. From a Highlight, send Mālo to that athlete with the test card.
2. From an athlete's **profile** (no clip open), send Mālo again.
3. Find an athlete with a Locker goal and Chip In toward it.
4. Open Profile → Receipts and find all three gifts.
5. Open Activity and check what you see.

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

Tell us: *Would you trust this with your kid's money? What would you need to see first? What would
make you share your kid's page with family?*

## Athlete — Rise (does it make you look recruitable?)

1. Claim your profile and enter your team code (we will give you one directly).
2. Upload a Highlight tagged to yourself.
3. Look at your profile's Highlights, Stats and Vault tabs. Lock and unlock a Vault clip.
4. Start Stripe Connect onboarding (test mode — use Stripe's test data, not your real details).
5. Open **Activity**. The card at the top should say who holds your Mālo and until when. When your
   parent sends a withdrawal request, approve one and decline one. (Needs a verified athlete
   account and a linked parent.)

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
