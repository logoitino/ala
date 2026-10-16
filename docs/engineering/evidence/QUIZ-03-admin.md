# QUIZ-03 admin-ready evidence (2026-10-14)

Feature: trivia, play together. Covers weekly rounds of five, true / false (images deferred), challenge groups, badges and
recap, and the starter bank. Design: [TRIVIA_PLAY_TOGETHER_DESIGN.md](../design/TRIVIA_PLAY_TOGETHER_DESIGN.md) (review §9
adopted). Ledger: [QUIZ-03](../../agents/QUIZ-03.md).

## What was built for the admin stage

- **Source.** Two migrations, both written and **not applied anywhere**, copied onto `schema.sql`:
  - `20261014160000_trivia_play_together.sql`;
  - `20261014170000_trivia_starter_bank.sql` (60 drafts).
- **Data model and rules.**
  - Rounds: round items with per-item deadlines; `between` / `next_by`; exact Next recovery; week-boundary check;
    per-item void.
  - Question types: `true_false`; `image_choice` fields with a two-admin rights review, approval refused while
    `trivia.images` is off.
  - Badges: per period, and the recap.
  - Groups:
    - joined by hashed codes under MINOR-01 teen rules both ways;
    - re-checked whenever an age, setting, friendship, guardian link or closure changes, and lazily on page read and
      group Start;
    - a block removes the blocked party;
    - the group page shows a played mark and rounded totals (hidden below three players);
    - opaque member references;
    - an audited admin case view;
    - guardian count only.
  - Erasure keeps rate-limit and refusal evidence.
- **Admin desk** (`/admin/sport-quiz`):
  - round size, `trivia.groups` and `trivia.images` switches;
  - type editor and rights attestations;
  - active-version cap (300) and per-sport exhaustion forecast;
  - round and badge metrics;
  - group counts, reports and case view with removal or closure (reason required);
  - retention.
- **Disable.** Inherits QUIZ-02's pause and empty cohort; the switches never loosen a rule.

## Checks (Node 24.21.0, this Mac, 2026-10-14)

| Command | Result |
| --- | --- |
| `node scripts/replay/trivia-play-together-replay.mjs /tmp/books01-pg/pkg/package/dist` | 59/59: real-actor checks for rounds, Next recovery, deadlines, week end, void, true / false, image refusal, cap, every group join and refusal rule, re-checks after age / setting / friendship / guardian / closure / birthday changes, blocks, no history leak, rounded totals, opaque refs, closed groups, code entropy, erasure, guardian count, admin-only views, direct-table denial, starter bank drafts, re-running QUIZ-02 + QUIZ-03 over live data |
| `node scripts/replay/timed-trivia-replay.mjs … --with-quiz03` / without the flag | all pass / all pass (QUIZ-02 unchanged without QUIZ-03) |
| `node scripts/replay/schema-replay.mjs …` | 105/105 |
| `pnpm check` (implementer, after the security fixes) | exit 0, 153 suites / 1,255 tests |

## Reviews

- **Design panel** (POLLS, MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, CONTENT_RIGHTS, the INFRASTRUCTURE seat,
  SUPPORT): changes needed → 17 adopted.
- **SQL review** (RLS_SECURITY with MINOR_SAFETY and PRIVACY_ENGINEERING): changes needed (1 P1, 2 P2, 4 P3) → fixed →
  **APPROVED**.
  - Its last P3 is applied: QUIZ-02's re-added label and audit checks are `NOT VALID`, so a re-run over QUIZ-03 rows does
    not fail.
  - Its other P3 is open: `quiz_groups_mine` can show a drifted member until that group's page is opened.

## Not verified

- Any hosted database.
- The admin desk in a browser or on a device.
- The starter bank's facts: Content verifies the sources before approving.
- Image delivery: no bucket or signed URLs yet.
