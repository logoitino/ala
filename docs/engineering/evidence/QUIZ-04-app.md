# QUIZ-04 app-ready evidence (2026-10-15)

Admin checkpoint: [QUIZ-04-admin.md](QUIZ-04-admin.md) (2026-10-15T01:29:17Z). Design:
[LIFE_PLAYBOOK_DESIGN.md](../design/LIFE_PLAYBOOK_DESIGN.md) (§7 overrides earlier sections). Ledger:
[QUIZ-04](../../agents/QUIZ-04.md).

## What the app does

- **"This week" strip** (`SportQuizAllowances`). One row each for your round, the group round and, only once Life is
  turned on, the Life Playbook round. Each row says in words whether it's ready, played, skipped, out of new questions
  or not available right now; the state never relies on colour. The strip says group play never uses up your own round
  and that missing a week never costs you anything. It has no streaks or week counts. It shows only on servers that send
  separate weekly spots (`week_spent_by_kind`); a QUIZ-03 server still has one round a week, so the strip stays hidden there.
- **Your level** (`SportQuizLevel`, `useTriviaLevel`).
  - Shows one level (Rookie → Varsity → All-Star → Pro → Hall of Fame) from the server's highest-reached value, the
    facts learned, and an accessible progress bar with "N more facts to <next level>".
  - The top level says so instead.
  - Says "Levels never go down" and "Only you see your level", with no ranks or comparisons.
- **Life Playbook opt-in** (`LifePlaybookCard`).
  - "Life Playbook: real-life skills, sports style." with the §4 notice text, including the trusted-adult line.
  - The card has separate Turn on and Not now buttons and no checkbox or switch. Not now writes nothing and leaves a
    quiet "About Life Playbook" button.
  - Turn on sends `life-playbook-v1-testing` with the opt-in's CAS version. The card is offered only when the server
    sends that same notice version.
  - Shown only when the Life snapshot reads `not_opted_in`, so nothing appears while `trivia.life` is off.
  - A polite live region (plus an iOS announcement) confirms "Life Playbook is on." / "Life Playbook is off."
- **Life Playbook home** (`LifePlaybookHome`, `useLifePlaybook`).
  - Lists only the chapters `quiz_life_chapters` returns, with their sports framing and "Open" or "Coming soon".
    Progress rows show only for returned chapters, so a 16+ chapter never appears for a 13–15 account even if a
    progress read carried it. Nothing mentions age, unlocking or adding an age.
  - Chapter progress reads "Seen N of M questions", plus the chapter level and a private "<Chapter> Playbook badge
    earned" at Varsity. Life badges on the shelf have no "Show to my groups" switch.
  - Shows the trusted-adult line.
  - The Life round preparation offers "Any open chapter" or one open chapter, 90 seconds (the default) or 30 seconds,
    and the unchecked trivia-notice checkbox, then "Start Life Playbook round".
  - Turn off is always there and says turning it off ends any open Life round. If Life is turned on but the server
    can't serve it right now, only a plain line and Turn off show.
  - Admin-facing chapter notes from the server are never shown to participants.
- **Life rounds.** Start goes through `quiz_life_start` only (Life notice, chapter, duration). After that, the round uses
  the existing `SportQuizRound` / `SportQuizRoundSummary`, Next, answer and End. End sends `p_round_kind: 'life'`.
  A first-time account saves the trivia notice first, because the server needs both. A Life round:
  - survives the personal topic pools running out;
  - ends when Life is switched off, the account opts out or trivia pauses;
  - is not ended by another kind's closed attempt on the snapshot.
- **Separate rounds in the hook** (`useTimedSportQuizRound`).
  - Each Start carries its kind: the personal round checks the personal spot, the group round only the group spot, and
    Life the Life snapshot.
  - After any round, "Back to this week's rounds" (`dismiss()`) clears the finished round without sending another End,
    so another kind can start on the same page.
  - The group round preparation now says "This uses this week's group round. Group play never uses up your own round."
- **History, erasure, group pages.**
  - Life and group rounds appear in the same private history, labelled "Life Playbook round" / "Group round".
  - A corrected item shows "Correction: …", with fallback wording if no reason was sent.
  - Clear-history copy names your level, and names Life Playbook chapter levels and the Life setting only when Life is
    visible to the account.
  - While a group page is open, every Life piece is hidden.
- **Unknown states.** A missing Life or level RPC (`NOT_SWITCHED_ON`) hides those pieces quietly and stops asking. A
  failed read shows "Part of this page didn't load. Check your connection and tap Refresh quiz to try again.", which
  never names Life.

## Checks (Node 24.21.0, this Mac, 2026-10-15 ≈02:00 UTC)

| Command | Result |
| --- | --- |
| `cd apps/mobile && ../../node_modules/.bin/tsc --noEmit -p .` | exit 0 |
| Quiz suites (screen, play-together, Life, round hooks, account hook, Learn card, profile placement, adapters, admin) | 19 suites / 258 tests pass |
| New: `SportQuizLifePlaybook.test.tsx` (19), `useTimedSportQuizRound.life.test.tsx` (7), `useLifePlaybook.test.tsx` (5) | pass; all QUIZ-02 / QUIZ-03 tests unchanged |
| `pnpm copy:check` | ok, with no allowlist needed: Life screen code carries no content words, which come from the server |
| `pnpm comments:check` · `node scripts/check-unused.mjs` | ok · ok |
| `node scripts/data-map.mjs --check` | ok after removing seven exports-triage entries that are now used (`fetchLifeSnapshot`, `fetchLifeChapters`, `fetchLifeProgress`, `fetchTriviaLevel`, `saveLifePreferences`, `startLifeRound`, `LIFE_DEFAULT_DURATION`) |
| `pnpm check` (worktree root) | exit 0: 161 suites / 1,333 tests and every guard |

Tests cover:

- no age or unlock text for a 13–15 chapter list;
- no 16+ chapter when it isn't returned;
- the opt-in flow and its notice version;
- Not now and Turn off;
- the strip states;
- the level display and the top level;
- the Life round start with the life kind, chapter and 90 / 30 seconds;
- the trivia notice saved before the Life Start;
- the not-switched-on state, the `trivia.life` off state with no teaser, and the network error;
- no Donate, checkout or amounts on Life screens or during a Life round;
- the history label and correction note;
- the erase copy;
- group pages without Life;
- dismiss.

## Review (VOICE lead, ACCESSIBILITY, MINOR_SAFETY) — all APPROVED

- **VOICE: APPROVED** after fixes.
  - The §4 notice matches word for word; there is no pressure, streak or guilt wording; Life chrome has no retired
    money words and no Donate, checkout or amounts.
  - Skip reads "Skip my round this week", with the confirmation "You skipped your round this week. Your other rounds
    aren't affected." Older single-round servers keep "Skip this week".
  - Preparation names "your round" or "the group round" instead of "this week's opportunity".
- **MINOR_SAFETY: APPROVED.**
  - Turn off stays reachable for an opted-in account while Life is off, paused or not enrolled. The server accepts it
    in every state and ends an open Life round; tests cover all three states.
  - No age or unlock text anywhere, including error paths. No 16+ leak. The trusted-adult line is on the card and the
    home. Life never appears on group pages. Life badges are private. There is no free-text input.
- **ACCESSIBILITY: APPROVED.**
  - Focus moves after Back, after Skip and after "About Life Playbook" (`focusSoon`).
  - The opt-in live region stays mounted so Android reads it.
  - The Life checkbox has its own accessible name.
  - Strip rows wrap at large text sizes.
- **Lead decisions:**
  - Turn off is always reachable once opted in.
  - BACKEND dropped the admin `note` from the participant chapter read; the parser keeps only the six participant
    fields and a replay check proves it.
- **Follow-ups (non-blocking):**
  - "Skip this week" wording remains in the home invitation, Family Fun discovery and admin coverage labels.
  - `QuizButton` cannot take a ref, so focus does not move after Not now or Turn on / off; the announcement plays.
  - The erase confirmation is accurate but uses jargon ("exposure history", "account/week guard"). It needs a plain
    rewrite with PRIVACY_ENGINEERING.
  - Turn off is hidden during an open round (End round is shown), on a group page, or when the trivia read fails.

## Checks after the review (lead run, 2026-10-15)

| Command | Result |
| --- | --- |
| Mobile jest (whole app) | 160 of 162 suites, 1,340 of 1,343 tests pass. The 2 failing suites / 3 tests are `components/Admin/Reports/AdminReportScreen*`, in another session's uncommitted admin analysis-export work in this worktree (`packages/shared-types/admin/analysisExport.ts` and related) — not QUIZ-04 |
| `tsc --noEmit` | 1 error, `Admin/Reports/reportPages.ts:84`, from that same in-progress work; no error in QUIZ-04 files |
| `copy:check`, `comments:check`, `docs:check`, `data:map:check`, `agents:check`, `life:bank:check`, `security:no-ssn`, `app:data-boundaries` | all ok |
| `node scripts/replay/life-playbook-replay.mjs …` | 36/36 |
| Full `pnpm check` | not green while that other work is mid-change; the last full pass was exit 0 at 161 suites / 1,333 tests (implementer, before the review fixes). Re-run once the admin export work settles |

## Not verified

- **Devices and screen readers:** VoiceOver / TalkBack reading of the strip rows, the progress bar, the opt-in live
  region and the question announcement in Life rounds; Android live regions; layout at large text sizes.
- **Hosted:** no hosted database. Both QUIZ-04 migrations remain unapplied, so on any real server the Life pieces and the
  level stay hidden ("not switched on"). Delivery stays paused / testing-only / empty cohort, `trivia.life` is off and
  every chapter is closed until 20 approved items (plus CPA sign-off for Credit Clock and Tax Timeout).
- **Content:** the 56 Life drafts, their sources and the 11 CFO / TAX-flagged facts still need review and approval.
- **Gate:** app-ready recorded by the lead; the full `pnpm check` re-run is pending the other session's admin export work (above).

## Owner simplification (2026-10-15) — supersedes the review machinery above

Owner: "keep the trivia simple and fun, we really don't need complex questions that need verification." Chosen: normal
trivia approval and four simple chapters. Design §8 overrides §2–§7.

- **Removed (archived in `archive/superseded-2026-10-15/`, nothing deleted):**
  - CPA sign-offs and named finance / tax reviewers (2 tables, 17 functions);
  - required source URLs, the tax year, the January withdrawal, re-review and the age bands;
  - Bank Basics, Paycheck Playbook, Credit Clock, Tax Timeout and Life Needs;
  - the admin panels and client wrappers for all of these.
- **Now:**
  - Four 13+ chapters: Money Huddle, Savings Season, Scam Defense, Smart Plays; a chapter opens at 5 approved questions.
  - One admin approves a Life question, the same as other trivia.
  - Copy rules v4: no advice, brands, Tapua'i money words, NIL, tax / loan / credit, money figures or years; scam
    explanations end "Tell a trusted adult and use Report."; prompt ≤ 120 and explanation ≤ 200 characters.
  - 40 simple-fact drafts. The sports starter bank was also simplified (18 of 60 replaced).
- **Kept:** separate weekly rounds, levels that never drop, opt-in and switch, privacy thresholds, group rules, erasure and
  the QUIZ-03 re-run stop.
- **Checks (lead run):** Life replay 31/31, schema 105/105, QUIZ-03 59/59, `pnpm check` exit 0 (166 suites / 1,372
  tests).
- **Review status:** the earlier SQL / VOICE / ACCESSIBILITY / MINOR_SAFETY approvals covered the larger build. This
  change only removes features and tightens the content rules. The replay proves the removed tables, columns and
  functions are gone and every access check still holds. No separate re-review was run.

## Fun presentation (2026-10-15)

Owner: "make sure that the trivia is presented in a fun trivia way. add effects and good playful sound if needed."
POLLS with MOTION. Presentation only: no server, deadline, data or wording of the plain verdicts changed.

- **See:** the question card pops in and answers cascade; jersey-number dots fill per question (progress only, never
  right / wrong); a shot-clock bar drains and turns warm gold with a gentle pulse in the last 10 seconds (the
  "N seconds left" text and milestone announcements are unchanged); buttons squish on press. Right answer: a rotating
  sport cheer with confetti clipped inside its banner and a glowing "✓ Answer" chip. Not quite: an encouraging line and
  a soft wiggle; the right answer is highlighted. Time up: "Whistle!". The explanation slides in and Next bounces
  gently. Summary: anyone who answered at least one question gets the same celebration (cheer, confetti, a counting
  medal, a shining Trivia Explorer badge card); zero facts gets a friendly line. A higher level after a round shows
  "Level up: <level>!" once. Life chapter cards get an emoji accent, cascade in and bounce on press.
- **Hear / feel:** `lib/quizSound.web.ts` synthesizes soft Web Audio cues (tap click, C–E–G chime, low "boop-bop",
  whistle toot, mini and bigger fanfares; master gain 0.16, cues ≤ 0.6 s, fanfares ≈ 1.2 s), only after a page gesture
  and only while Sound is on; a missing or blocked AudioContext is silent. Phones (`lib/quizSound.ts`) use haptics
  only, with one commented plug-in point for `expo-audio`. "Sound on / Sound off" (`Trivia sound` switch) is saved
  in AsyncStorage, default on; Sound off also silences quiz haptics; haptics follow the OS setting.
- **Safety:** Reduce Motion (`hooks/useReduceMotion.ts`, live listener) removes confetti, wiggles and bounces (fades
  only); decorations are hidden from screen readers and take no touches; no flashing; colour is never the only signal;
  the answer is sent before the tap cue, and Next / End are never held by an effect. No speed, score or streak shown.
- **Copy:** every cheer lives in `components/SportQuiz/quizCheers.ts` for VOICE review (not yet reviewed).
- **Checks (2026-10-15, Node 24.21.0):** `tsc` clean; new `SportQuizFun.test.tsx` 12/12 and `quizSound.test.ts` 6/6;
  quiz suites pass; full mobile jest 175 suites / 1,462 tests; copy / comments / docs / links / data-map / unused /
  agents / security checks pass; `feature-admin:check --feature QUIZ-04 --require app-ready` passes. The Product
  inventory source hash was regenerated (hash-only change). Expo web export could not run in this worktree (Metro cannot
  resolve the symlinked `expo-router/entry`).
- **Demo preview (owner request, same day):** dev-only route `/dev/trivia-preview` (`app/dev/trivia-preview.tsx` →
  `components/SportQuiz/TriviaPreview.tsx`) plays a scripted 5-question demo (2 sports, 1 science, 2 Life samples copied
  from the banks) with a real 30-second clock, plus buttons for each moment; banner "Demo only: nothing is saved."; no
  database or network; redirects to Home in production (`TriviaPreview.test.tsx` covers the gate and a one-question
  smoke run). `metro.config.js` now adds the real folders behind a worktree's symlinked `node_modules` to
  `watchFolders` / `nodeModulesPaths` (nothing added in the main checkout), so `expo export --platform web` passes in
  this worktree: 71 static routes including `/dev/trivia-preview`.
- **Not verified:** real devices, a browser run of the sounds, contrast of the warm timer on hardware, VOICE review.

- **Owner check (2026-10-15):** the owner opened `/dev/trivia-preview` on the local web preview and reported "The demo looks good." This covers web rendering only; it is not a device, screen-reader or hosted check.
