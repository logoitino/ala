# QUIZ-05 app evidence (2026-10-15)

Admin checkpoint: [QUIZ-05-admin.md](QUIZ-05-admin.md) (2026-10-15T21:11:39Z). Design:
[TRIVIA_FRESH_QUESTIONS_DESIGN.md](../design/TRIVIA_FRESH_QUESTIONS_DESIGN.md) (§6 overrides §1–§5; copy in §6.13).
Ledger: [QUIZ-05](../../agents/QUIZ-05.md). POLLS with PROFILE, ONBOARDING and CUSTODIAL. App-ready is for the lead to
record; this file is the implementer's evidence.

## What the app does

- **Report a problem** (`components/SportQuiz/QuestionReport.tsx`).
  - After a reveal (the explanation step, and each question in the round summary, so the last question is covered),
    a quiet "Report a problem with this question" link opens a sheet.
  - Reasons: Wrong answer / Confusing / Not okay, plus "Shares something private" on fun facts only. No free text.
  - Afterwards "Thanks. We’ll take a look." The link then reads "Reported. Thanks."
  - Other replies, said plainly and never claiming a report counted or paused anything:
    - already reported: "You already reported this question. Thanks, we have it.";
    - the daily limit: "You’ve sent the most reports for today. You can report again tomorrow.";
    - intake paused: "We’re not taking reports right now. Please try again later.";
    - before the answer: "You can report a question once its answer is shown.";
    - not available: "Reporting isn’t available right now.";
    - failed send: "Your report didn’t send. Check your connection and try again."
  - The outcome sits in a polite live region that stays mounted, plus an iOS announcement.
  - Next is never disabled or held. A report can finish after the round moves on.
  - Offered only for questions from a QUIZ-05 server (they carry `shuffled`), only with a signed-in account, and never
    on a corrected or unavailable item.
  - One report state per account is shared by the reveal and the summary (`useQuestionReports`).
- **"Fun fact: {first name}"** (`components/SportQuiz/FunFactMoment.tsx`, used by `SportQuizRound`).
  - A server-marked fun fact (topic `athlete`) shows the header in place of the sport line, on the live question and
    at the reveal.
  - After the reveal, the athlete card shows first name, sport and photo. The photo and sport come through
    `getPublicProfiles`, the privacy-aware read the profile sheets use, with initials when there is no photo. The card
    has no Donate, money words, follow or profile link. It shows only when the server sends the card.
  - `fact_unavailable` shows "This fun fact isn’t available anymore." with no answer, explanation, cheer, cue, card or
    report. The summary marks it "not available" and does not count it as a fact learned.
  - History labels fun facts "(Fun fact)". It shows the server’s "Removed by the athlete" (or "No longer available")
    once, without the answer, explanation or correction line, and the unavailable line for `fact_unavailable` items.
  - Effects reuse QuizFx `PopIn`; Reduce Motion gives fades only and no confetti.
- **Athlete "Share a fun fact"** (`components/Profile/FunFactShare.tsx`).
  - Where: in Edit profile for athletes, and as an optional last step after a first athlete roster claim
    (`RoleSwitcherModal`). The claim has already saved and the toast shown before the step appears. "Not now" is
    there from the first frame and writes nothing. The step closes itself when the server says sharing isn’t open.
  - Shows the §6.13 opt-in copy word for word, with the six server prompts. The pre-game meal is a picker from the
    server’s curated list; the others take a 40-character answer.
  - Text refusals show the server’s codes in plain words (`FUN_FACT_TEXT_WORDS`), plus plain lines for the limit, a
    prompt already used, paused, and identity changed.
  - Status per fact: Waiting for a guardian (draft or guardian review) / Waiting for review / Live / Paused for a
    check / Declined. Remove asks to confirm. Status changes go to a polite live region.
  - The private line "Last month, 10+ fans learned your hype song." shows only when the server sends a bucket for last
    month, and never on a paused fact.
  - Hidden for non-athletes (`can_submit` false), no recorded age (`needs_birth`), a failed read, and when fun facts
    are off.
  - A 13–15 without a guardian just sees "Waiting for a guardian". Nothing asks them to invite one.
  - Also says plainly when the Fun facts audience is Only me, and that live facts reach fans once the account is
    verified.
- **Privacy sheet.**
  - A "Fun facts" audience row uses the existing `Choices` pattern. It shows for athletes when the server returns the
    `fun_facts` item.
  - For 13–15, "Everyone" is disabled with the line "Under 16, fun facts go to friends at most.", and a stored
    Everyone reads as Friends.
  - `lib/privacy` reads and sends `fun_facts` only when the server returned it, because older databases refuse unknown
    items.
- **Guardian** (`GuardianSupervisionPanel`, `SupervisionSummary`, `lib/minors`).
  - The linked teen’s card lists fun facts waiting for the guardian: prompt, answer, and Approve / Decline only. There
    is no edit, text field or withdraw.
  - The decision sends the guardian’s profile id from the server read. The list reloads, and refusals are said
    plainly. Nothing shows on a server without QUIZ-05.
  - The summary shows "Fun facts shared: n" (from `fun_facts_shared`; absent when not sent) and the fun facts audience.
  - Fun-fact approval events now read "A fun fact was approved." (or "declined") Before, they fell back to "Make the profile public".
- **Learn-card Start** (follow-up, design §6.1).
  - `LearnSportCard` passes the athlete’s player id as `?athlete=` alongside `?sport=` (`AthleteProfileView` supplies
    `player.id`). The route accepts only a UUID-shaped id and only together with a sport.
  - `SportQuizScreen` hands it to `useTimedSportQuizRound.start(…, learnAthlete)` only for a personal sport round in
    the Learn card’s own sport (case-insensitive). Group, Life, other topics and other sports never carry it.
  - The hook sends that Start through `quiz_learn_start` (`startTriviaFromLearnCard`). The same request UUID, secret
    and deadline serve every retry, and the personal guard, round kind and exact recovery are unchanged.
  - A server without the function ("not switched on", so nothing was written) falls back once, silently, to the
    ordinary Start with the same request; later retries stay ordinary. Any other failure never falls back.
  - The id is only a hint the server validates. The screen never names the athlete unless the server returns a fun
    fact.
- **Learn card copy.** "Your answers are just for you. {name} never sees who played, only a rough monthly count if
  one of their fun facts comes up." This replaces "doesn’t see it" (§6.7).
- **Accessibility.** Headers on the sheet, fun-fact header and share card. Every new control is 44 points or more:
  the Privacy choices and guardian chips went from 36 to 44. Live regions cover the report outcome and fact status
  changes. Status is always words.
- **Product inventory.** Additive: four `adminCoverage` controls (`quiz.page.report`, `quiz.profile.funfacts`,
  `quiz.profile.funfacts.audience`, `quiz.parent.funfacts`) were mapped under the trivia family in
  `product-inventory.json`, and the inventory was regenerated.
- **Data map.** Eleven `exportsTriage` entries for QUIZ-05 participant wrappers, now used, were removed, and
  `DATA_MAP.md` was regenerated.
- **AGENTS.md.** The QUIZ-05 row lists the new participant files.

## Checks (Node 24.21.0, this Mac, 2026-10-15)

| Command | Result |
| --- | --- |
| New suites: `SportQuizFreshQuestions` (16), `FunFactShare` (14), `PrivacyFunFacts` (5), `GuardianFunFacts` (7), `useTimedSportQuizRound.learn` (4), `SportQuizLearnStart` (4), `RoleSwitcherFunFactStep` (4); `LearnSportCard` +1 | pass |
| Quiz / profile / custodial / auth / onboarding suites and the round hook suites (follow-up re-run) | 29 suites / 245 tests pass |
| Admin suites + `adminCoverage` (coverage rows) | 319 tests pass |
| Mobile jest (whole app, follow-up re-run) | 188 suites / 1,579 tests pass. The earlier `app/(tabs)` Highlight failures from another session have since cleared |
| `tsc --noEmit` (mobile, follow-up re-run) | exit 0; no errors anywhere. Admin portal tsc exit 0 |
| `copy:check` · `comments:check` · `docs:check` · `docs:links` · `data:map:check` · `agents:check` · `code:unused` | all ok |
| `product:inventory:check` / `:test` | ok after regeneration (237 controls) / 18 pass |
| `pnpm feature-admin:check --feature QUIZ-05 --require admin-ready` | ok |
| Full `pnpm check` (worktree root, follow-up re-run) | exit 0: every typecheck, the mobile jest and every guard |

Tests cover:

- the report reasons, with the private reason on fun facts only and no free text;
- the confirmation, already reported, the limit, intake paused and a failed send, each in a polite live region;
- Next still working while a report is sending;
- the report hidden on older servers, corrected items and without an account, and offered in the summary;
- the fun-fact header on the live question; the card with photo, sport and initials and no money words; no card when
  the server sends none;
- Reduce Motion;
- `fact_unavailable` at the reveal and in the summary, and history’s "Removed by the athlete" and unavailable lines;
- sharing: the copy, the six prompts, a trimmed free-text submit, the meal picker, the refusal words, every status,
  confirmed Remove, the bucket line (shown, null, paused);
- no guardian-invite push; hidden for non-athletes, no age, off and a failed read; the off-with-facts list;
- the sign-up step: Not now before the read answers, self-closing, and Done;
- the Privacy row for adults, the 13–15 cap, and hidden for non-athletes and old servers; the `lib/privacy`
  parse / payload rule;
- guardian Approve / Decline only, other teens’ facts excluded, the refusal, the old server, the summary count and
  the event wording;
- the Learn card copy, and the athlete id it passes;
- the Learn entry using `quiz_learn_start` with the athlete id (hook and screen); the silent fallback on an older
  server with the same request; no fallback on other errors, with an exact retry; no athlete information without a
  returned fun fact; a normal entry, another sport or a non-sport topic using the ordinary Start; the route’s
  UUID-only check;
- `RoleSwitcherModal`: the step appears after a first claim (claim and toast first), Not now closes the sheet and
  writes nothing, it works while the read is pending, it closes itself for an account that can’t share, and an
  existing athlete never sees it. The test pins Reanimated shared values and runs the close callback, because the
  shared mock does neither.

## Decisions

- **Off but facts still kept.** When the server says fun facts are off, sharing hides. If the athlete still has facts
  stored, the list with Remove stays visible so "Remove one any time" holds. This follows the QUIZ-04 precedent that
  Turn off is always reachable.
- **Report entry points.** The report link is in the summary too, because the last question’s reveal is the summary.
  It is not offered on an unavailable fun fact, because nothing was revealed.
- **Card data.** The card’s photo and sport come from the public profile read, so they follow the athlete’s privacy.
  The first name and player id come only from the server’s card.
- **Touch targets.** The Privacy `Choices` and guardian chips went from 36 to 44 points, for every row in those
  sheets.

## Not verified

- **Devices and screen readers:** VoiceOver / TalkBack on the report sheet and its live region, the share card
  statuses, the meal picker radio group, the Privacy row and the guardian list; layout at large text; the athlete
  card photo on hardware.
- **Sign-up on a real server:** whether a fresh claim links `player_id` quickly enough for `can_submit` is a server
  question; if not, the step closes itself.
- **Learn-card Start on a real server:** `quiz_learn_start`’s validation of the athlete id and its fun-fact preference
  were checked by the admin-stage replay, not against a hosted database.
- **Hosted:** no hosted database. The QUIZ-05 migration is unapplied, so on any real server every piece above stays
  hidden or quiet. `trivia.athlete_questions` is off and the share is 0.
- **VOICE review** of the copy listed in this file has not run.

## Review and app-ready (2026-10-15)

- **VOICE / ACCESSIBILITY / MINOR_SAFETY / PRIVACY_ENGINEERING: all pass.** Fixes applied:
  - the report link's spoken name after reporting;
  - the fun-fact header announced with the question number;
  - meal and prompt choices report `checked`;
  - "Last month, 10+ fans learned your hype song.";
  - the Learn card says "a rough monthly count";
  - the guardian line names the athlete;
  - "A fun fact was approved / declined.";
  - the sign-up sheet scrolls to the fun-fact step.
- **Lead checks:** `pnpm check` exit 0 with 1,579 tests; fresh-questions replay 46/46.
- **Follow-ups (non-blocking):**
  - Focus should move to the confirm line after Remove / Keep, and to the fun-fact step header when it appears.
  - The shared Privacy `Choices` radios set only `selected` (owner: PROFILE).
  - Device and screen-reader checks.

