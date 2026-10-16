# Fresh questions: self-healing trivia, Know your athlete and refills (QUIZ-05)

**Owner request (2026-10-15):** keep questions good, consistent and creative as they shuffle through many players.
The game should heal and adjust itself over time. Keep it fresh with a fast, efficient refill, sometimes from the
internet. Let athletes consent to share fun facts about themselves when they set up their account; those become a small
share of the pool. The owner said "let's do it" to the recommended plan; the defaults below are the lead's
recommendations and stay adjustable in admin.

Builds on QUIZ-02/03/04 and keeps their rules:
- no repeats per account;
- one-admin approval, simple facts (owner, 2026-10-15);
- equal private rewards;
- aggregate-only stats;
- paused / testing-only / empty cohort until release.

Chain: owner → CTO → ENGINEERING → `POLLS` with `ADMIN`, Content, `PROFILE` / `ONBOARDING` (athlete prompts) and
`CUSTODIAL` (under-16 approvals). Reviews: `MINOR_SAFETY`, `PRIVACY_ENGINEERING`, `RLS_SECURITY`, `VOICE`,
`DATA_GOVERNANCE`, the infrastructure seat.

**The one rule:** nothing reaches players without an admin approving it. Spotting, pausing, drafting and alerting can be
automatic; publishing never is.

## 1. Self-healing

- **Signals per question** come from existing play records and stay aggregate only: answers, % right, time-outs and
  reports.
- **Report a problem.** After the reveal, players can tap "Report a problem with this question" and pick one reason:
  wrong answer, confusing, or not appropriate. There is no free text. Limits: one report per account per question, and
  10 per account per day.
- **Auto-pause.** A question reported by 3 different accounts, or by 1 for "not appropriate", stops being drawn at once.
  It appears in the admin's **Needs a look** list with the reasons, where an admin can Restore, Edit (atomic) or
  Archive. A paused question that was already issued finishes normally.
- **Quality flags** need at least 30 answers. They are flags only, never an automatic retirement; each goes to Needs a
  look:
  - "too easy": 95% or more right;
  - "confusing": 15% or fewer right;
  - "too long": 40% or more time-outs.
- **Difficulty** becomes easy / medium / hard from % right once a question has 30 answers. A round never holds more than
  two hard questions.
- **Feels new.** Answer order is shuffled for each player for each item. The server records the shown order, so answers
  map back exactly and the answer is still never sent before the commit. An admin can add **another phrasing** of the
  same fact (same family), and an account never sees two phrasings of the same family.
- **Running low.** The Trivia status card shows weeks left per topic and chapter. Under 4 weeks shows "Refill needed".

## 2. Know your athlete (see §6 for the adopted changes)

- **Opt-in for athletes.** In profile settings, and as an optional skippable step at the end of athlete sign-up:
  "Want fans to learn something fun about you?" Sign-up is never slowed or blocked (growth-first rule).
- **Preset prompts only**, at most 3 answered at a time:
  - favourite pre-game meal;
  - hype song;
  - favourite pro athlete;
  - pre-game ritual;
  - hidden talent;
  - favourite movie;
  - other sport you love;
  - jersey number story.
- **Never asked:** hometown, school schedule, birthday, family or pet names, first school, or anything that works as an
  account-security answer or helps someone find the athlete.
- **Answers** are short (40 characters or fewer). Automatic rules refuse links, handles, emails, phone numbers,
  addresses, profanity and Tapua'i money words. Wrong choices come from a curated list per prompt (for example, common
  pre-game meals), never from other athletes' answers.
- **Consent and safety.**
  - An admin approves every athlete question.
  - Under-16 athletes need guardian approval through MINOR-01's under-16 approvals.
  - The athlete can withdraw any question at any time; it stops being drawn immediately.
  - Account closure, unlinking the athlete or a block removes it.
  - It is only shown where the athlete's privacy settings allow their profile to be seen.
- **Who sees it (this build):** fans who follow the athlete (Crew), and anyone who starts trivia from that athlete's
  "Learn {sport} with {name}" card.
- **A small share:** at most one athlete question per round, and only in about 1 of 3 rounds per player (under 10% of
  questions). Admins can set 0–10%. It appears as a **"Bonus: Know your athlete"** moment, with the athlete's card after
  the reveal.
- **For the athlete:** a private monthly line, "Last month, 10+ fans learned your hype song." (§6.7), in buckets (1–4, 5+, 10+,
  25+). It never shows who.

## 3. Refills (fast, reviewed)

- **This build:** an admin **bulk import**. Paste or upload rows (topic / sport or chapter, type, question, answers,
  correct, explanation). Every row runs the same rules plus a **duplicate check** (same or near-same question text in
  that topic) and lands in Drafts to review. There is no AI and no internet.
- **Later, each a separate owner decision:**
  - AI drafting from our own list of simple facts when a topic runs low (a small AI spend);
  - pulling from openly licensed trivia sources (needs internet, a scheduled job, and attribution rules).

  Both would only ever create drafts.

## 4. Admin (built first, in the Trivia control tower)

- **Needs a look:** auto-paused, flagged and reported questions with their reasons.
- **Athlete questions:** a queue to approve or decline, showing guardian-approval status for under-16s and withdrawn
  questions.
- **Settings:** the athlete-question share (0–10%) and the self-heal thresholds.
- **Bulk import** with a dry-run preview of the rule and duplicate results.
- **Status card:** weeks left, Refill needed, and the Needs a look count.

## 5. Not in this build

AI drafting, internet pulls, fan-submitted questions, athlete free-form questions, and athlete questions for
non-followers when a profile is public.

## 6. Design review (2026-10-15) — changes adopted (override §1–§5 where they differ)

Panel: MINOR_SAFETY (lead), PRIVACY_ENGINEERING, RLS_SECURITY, VOICE, DATA_GOVERNANCE, PROFILE / ONBOARDING, and the
infrastructure seat (as COST_OPERATIONS / RELIABILITY). All seats returned CHANGES NEEDED; every change below is adopted,
plus the three optional suggestions.

### Athlete fun facts

1. **Audience (P0).**
   - A new per-item audience `fun_facts` (PRIV-01 `privacy_default_audience`) defaults to `friends`. For 13–15 accounts
     it is capped at `friends` even when the profile is public.
   - A fun fact is drawn only when the athlete's `fun_facts` audience allows this viewer, the viewer follows the athlete
     or started from that athlete's Learn card, and neither has blocked the other (`is_blocked_between`).
   - The server checks this when the item is issued and again at the reveal, using an athlete id it validates itself.
     If any check fails, the player gets an ordinary question instead.
2. **Erasure (P0).**
   - Answer text lives in `quiz_athlete_facts` and is filled into the question at read time; question rows never hold
     the athlete's answer.
   - Withdrawal, account closure, unlinking or an under-13 block clears the text in the same transaction. It also voids
     the question and any issued, unrevealed item.
   - History shows "Removed by the athlete". The audit log never stores the text.
3. **Under-16 approval (P0).**
   - MINOR-01 approvals gain the type `fun_fact`, with the fact id in `change_key`.
   - Order: athlete, then guardian (under 16), then admin. The guardian can only approve or decline, never write, edit
     or withdraw. The teen can withdraw alone.
   - A 13–15 without a linked guardian can save facts as drafts marked "waiting for a guardian"; nothing pushes them to
     invite one.
   - No recorded age (`unknown` / `not_given`) means no submissions.
   - Facts are drawn only for verified athletes.
4. **Prompts (P1).**
   - Six prompts: pre-game meal (chosen from the curated list), hype song, favourite pro athlete, pre-game ritual,
     hidden talent, other sport you love.
   - Favourite movie and jersey number story are removed.
   - An answer may not match or nearly match any of the wrong options.
5. **Answer filter (P1).**
   - A server-side database check reuses the Life text cleanup and brand list.
   - It refuses links, handles, emails, phone numbers, addresses, digits, weekdays and times, the athlete's own school or
     city, emoji, non-Latin letters, profanity and Tapua'i money words.
   - A pair of capitalised words is sent to the admin for a look.
   - Admin checklist: no sponsor or business, no place, no schedule.
6. **Where fun facts appear (P1).** Personal rounds only, never group sets or Life. At most one fun fact per round, and
   in about 1 of 3 rounds. At most one per athlete per viewer per month.
7. **Athlete counts (P1).**
   - Nothing is shown under 5 different fans; above that, the buckets are 5+, 10+ and 25+.
   - The athlete, their guardians, admins and the testing group are not counted. Completed months only.
   - Counts never appear in public, on leaderboards or in Aura.
   - An athlete may see a "paused for a check" state on their own fact, with no counts or reporter.
   - Fix the Learn card text that says the athlete "doesn't see it".

### Self-healing

8. **Answer shuffle (P0).**
   - The server generates the shown order for each round item when the item is issued and stores it; it is identical on
     every re-read and replay.
   - The client sends the position it showed. The server maps it back to the stored answer index and records both in
     the receipt check.
   - Stats, voids and history use the stored index. True/false is not shuffled.
   - The stored option order is also shuffled on import and approval, so no path shows "correct answer first".
9. **Reports (P1).**
   - The reporter must have a closed round item for that question. Limits: one report per account per question, and 10
     per day.
   - Reports count toward auto-pause only from accounts at least 7 days old with at least one completed round.
   - Pausing: 2 different accounts for an ordinary question; 1 "Not okay" or "Shares something private" report for a fun
     fact.
   - At most 10 auto-pauses per topic per day; after that, reports queue for an admin and raise an alert.
   - A restored question needs 3 new reporters to pause again.
   - Reports where either side has blocked the other are recorded but never count.
   - Pausing a fun fact voids any issued item.
10. **Quality flags (P2).**
    - Flags need 30 different accounts on the current version, not counting admins or the author.
    - "Confusing" depends on the type: 15% or fewer right for four choices, 35% or fewer for true/false.
    - Group sets apply the two-hard cap without reading members' history (QUIZ-03 rule 11).
    - Per-question counters update when each answer is committed (no scheduler).

### Admin, data and copy

11. **Bulk import (P2).**
    - An admin-only database function takes at most 200 rows or 64 KB and re-checks everything on the server; the dry
      run is a preview only.
    - It refuses athlete rows, image rows and cells starting with `= + - @`, and it respects the version caps.
    - The duplicate check covers all statuses, versions, families and topics, plus rows inside the batch. An exact match
      after cleanup blocks the row; a near match warns.
    - There is no "approve all".
12. **Data, retention and erasure (P2).**
    - The fun facts, reports, stats and import tables and the new columns go in `data-ownership.json` and
      DATA_PRIVACY_MAP (minors' personal data).
    - Withdrawn text is purged at once. Reporter ids are cleared at 90 days and reports deleted at 180.
    - `quiz_erase_history` also removes reports. The athlete's export includes their facts and decisions.
    - The supervision summary adds "fun facts shared: n", the same for teen and guardian.
    - Answer audit rows for fun facts carry no question id. New audit actions are added.
13. **Copy (P3).**
    - The round moment is named "Fun fact: {first name}" (not "Bonus", which reads as pay).
    - Report reasons: Wrong answer / Confusing / Not okay, plus "Shares something private" on fun facts. After a report:
      "Thanks. We'll take a look."
    - Opt-in: "Share a fun fact? Pick up to 3. An admin checks each one, and a parent or guardian approves if you're
      under 16. Only people your privacy settings allow will see it. Remove one any time."
    - The athlete card shown after the reveal has no Donate button or money words.
14. **Operations (P3).** A `trivia.athlete_questions` switch (off); the share defaults to 0. Report intake can be
    paused.
