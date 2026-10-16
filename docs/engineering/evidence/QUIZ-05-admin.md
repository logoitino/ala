# QUIZ-05 admin-ready evidence (2026-10-15)

Feature: Fresh questions — self-healing trivia, Know your athlete fun facts, and admin bulk import. Design:
[TRIVIA_FRESH_QUESTIONS_DESIGN.md](../design/TRIVIA_FRESH_QUESTIONS_DESIGN.md) (review §6 adopted). Ledger:
[QUIZ-05](../../agents/QUIZ-05.md).

## What was built for the admin stage

- **Source.** `supabase/migrations/20261015210000_trivia_fresh_questions.sql`, written and **not applied anywhere**,
  copied onto `schema.sql` inside the QUIZ transaction.
  - MINOR-01 (`20261014110000`, unapplied) was edited in place: it refuses unknown approval keys and stops a lone re-run
    after QUIZ-05. The main tree needs the same file at merge (QUIZ-05 ledger).
  - QUIZ-04 stops a lone re-run after QUIZ-05.
- **Fun facts.**
  - Their own `fun_facts` audience (default friends; 13–15 capped at friends).
  - Text kept in `quiz_athlete_facts` and filled in at read time.
  - Six preset prompts with curated wrong options.
  - The server word filter (`quiz_fact_word_scan`): links / handles / contacts / digits / schedules / addresses / school,
    team and town words / profanity / lookalikes. Clear cases are refused; borderline ones become look reasons.
  - Approval order: athlete, then guardian for under-16s (MINOR-01 type `fun_fact`; the guardian can only approve or
    decline), then admin.
  - Withdrawal, closure, unlinking or an under-13 block erases the text in the same transaction.
  - Verified athletes only. Drawn for followers or Learn-card starters where the audience allows, blocks excluded, with
    a re-check at issue and at reveal.
  - At most one per round, about 1 round in 3, at most one per athlete per viewer per month.
  - Athlete counts: hidden under 5, then buckets.
  - `trivia.athlete_questions` is off and the share is 0.
- **Self-healing.**
  - The server shuffles answer order and stores it per item (exact mapping; true/false unchanged).
  - Reports follow the eligibility, account-age, blocked-pair and threshold rules. Fun-fact safety reports always pause.
    The daily cap is 10 per topic, with an alert.
  - Quality flags need 30 accounts, with type-aware thresholds. Difficulty bands; at most two hard per round.
  - Retention: reporter id cleared at 90 days, reports deleted at 180, declined fact text after 30.
- **Admin desk** (Trivia control tower):
  - Needs a look (Restore / Edit / Archive);
  - the fun-fact queue (guardian status; the checklist resets per decision);
  - settings: athlete switch and share, report intake, thresholds;
  - bulk import (200 rows / 64 KB, dry run, formula-cell, non-Latin and duplicate checks, drafts only);
  - the status card: weeks left, Refill needed, Needs a look.

## Checks (lead run, Node 24.21.0, this Mac, 2026-10-15)

| Command | Result |
| --- | --- |
| `node scripts/replay/fresh-questions-replay.mjs /tmp/books01-pg/pkg/package/dist` | 46/46, including every review probe, the 13 false-positive answers and the evasion cases |
| Life / QUIZ-03 / schema replays | 39/39 · 59/59 · 105/105 |
| `pnpm check` | exit 0: 1,482 tests and every guard (incl. `product:inventory:check`, `life:bank:check`, data map) |

## Reviews

- **Design panel** (seven seats): CHANGES NEEDED → all adopted, plus the three optional suggestions (design §6).
- **Security review** (RLS_SECURITY with MINOR_SAFETY, PRIVACY_ENGINEERING, DATA_GOVERNANCE, VOICE). Four rounds:
  - Round 1: 1 P1, 2 P2, ~12 P3 → fixed.
  - Round 2: P2 false positives → fixed.
  - Round 3: P2 hyphenated spelled digits and P3 stretched profanity.
  - These last items were fixed and verified by replay (lead). All earlier fixes were re-probed and hold.

## Not verified

- Any hosted database or concurrency under load.
- The 30-day purge running on a schedule; it runs through the retention action.
- Counsel on LEGAL row AC.
- Participant screens (next stage).
