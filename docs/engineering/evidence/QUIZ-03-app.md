# QUIZ-03 app-ready evidence (2026-10-14)

Admin checkpoint: [QUIZ-03-admin.md](QUIZ-03-admin.md) (2026-10-14T21:12:19Z). Design:
[TRIVIA_PLAY_TOGETHER_DESIGN.md](../design/TRIVIA_PLAY_TOGETHER_DESIGN.md).

## What the app does

- **Rounds of five.**
  - Before Start, the screen says "up to N questions" and that leaving during an explanation ends the round. The 30 / 90
    choice stays.
  - Each question shows "Question N of M", and screen readers are told when it changes. Each question keeps its own
    server deadline.
  - After the explanation, Next calls `quiz_next` with exact recovery: the same request, position and secret.
  - Leaving, backgrounding, switching account, End round or waiting past the explanation window ends the round.
  - The summary says "You learned N new facts", with private right / wrong per question. No score, speed or rank.
- **True / false:** two large True / False buttons announced with their selected state. An image question is never shown;
  if one arrives, the round ends safely.
- **Learn your athlete's sport:** a card on another person's athlete profile. It appears only when trivia is available
  to the viewer, this week's round is unused, and the sport has unseen approved questions. It opens trivia with that sport
  chosen.
- **Family challenge.**
  - Create a group with a preset name. The code is shown once, with Share and a safety line.
  - Join by code; every refusal gives the same single message.
  - The group page shows played marks, totals only when the server returns them, opt-in badges and the theme (the owner
    can change it), plus "Everyone played!".
  - "Play this week's group round" uses the group's shared set.
  - The owner can Remove members (by opaque reference) and Renew the code; anyone can Leave or Report.
- **Badge shelf and season recap:** a "Show to my groups" switch per badge, and a private recap with counts per sport.

## Checks (Node 24.21.0, 2026-10-14 ≈21:43 UTC)

| Command | Result |
| --- | --- |
| `pnpm check` (worktree root) | exit 0: 156 suites / 1,286 tests and every guard |
| Focused suites: round hook (9 new), play-together screens (11 new), `LearnSportCard` (8 new), `AthleteProfileView` placement (3 new); all QUIZ-02 tests unchanged | pass |
| Replays: play-together 59/59; timed trivia with and without QUIZ-03; schema 105/105 | pass |

## Reviews

- **SQL:** RLS_SECURITY with MINOR_SAFETY and PRIVACY_ENGINEERING: approved.
- **VOICE and ACCESSIBILITY:** changes applied, covering:
  - warmer, plainer copy with no blame wording;
  - selected state on answers;
  - the Share hint;
  - a question announcement after Next;
  - no duplicated timer text.

## Not verified and follow-ups

- **Devices and screen readers:** VoiceOver / TalkBack focus after Next, live regions on Android, the Share sheet and the
  spelled-out code are untested on real hardware.
- **Notice copy:** the accepted notice (`timed-trivia-v1-testing`) still uses words like "opportunity", "server" and
  "UTC". Rewording it means a new notice version (Legal / Privacy).
- **History erase:** its copy needs PRIVACY's rewording.
- **Hosted / release:** no hosted database; delivery stays paused / testing-only / empty cohort.
- **Content:** must verify and approve the 60 drafts before any round can be offered.
