# QUIZ-05 — Fresh questions

**Owner request (2026-10-15):** keep questions good, consistent and creative as they shuffle through many players.
Trivia should heal and adjust itself over time and refill quickly, sometimes from the internet. Athletes can consent to
share fun facts about themselves at account setup; those become a small share of the pool. The owner said "let's do it"
to the recommended plan.

**Primary owner:** POLLS (Engineering) with ADMIN, Content, PROFILE / ONBOARDING and CUSTODIAL. **Reviews:**
MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, VOICE, DATA_GOVERNANCE and the infrastructure seat. **Executor:** Claude
session and its subagents in the `codex/fan-zone` worktree. Not committed.

[Design](../engineering/design/TRIVIA_FRESH_QUESTIONS_DESIGN.md) (review §6 adopted) ·
[Feature contract](feature-admin.json) · [Prior ledger](QUIZ-04.md).

| Stage | Status |
| --- | --- |
| Enrollment | Planned 2026-10-15T17:11:33Z, before new source |
| Design review | Seven-seat panel: CHANGES NEEDED → all adopted, plus the three optional suggestions (design §6) |
| Backend / admin | `20261015210000_trivia_fresh_questions.sql` (fun facts with their own `fun_facts` audience, guardian `fun_fact` approvals, separate text with erasure, server answer shuffle, reports + auto-pause, quality flags / difficulty, bulk import with duplicate check, Needs a look, weeks left); admin panels for Needs a look, fun-fact queue, settings and bulk import; `lib/freshQuestions.ts`. The implementer's in-place MINOR-01 edit was reverted by the lead (QUIZ-05 redefines `guardian_decide_approval` itself), so MINOR-01 stays identical to main. QUIZ-05 was mapped in the Reports session's `product-inventory.json` (records + source; regenerated) so `product:inventory:check` passes. Lead runs: fresh questions 34/34, Life 39/39, QUIZ-03 59/59, schema 105/105, `pnpm check` 1,481 tests |
| Security review | RLS_SECURITY + MINOR_SAFETY + PRIVACY_ENGINEERING + DATA_GOVERNANCE + VOICE: **CHANGES NEEDED** (1 P1, 2 P2, ~12 P3; probes `/tmp/q5probe/`). P1: re-pasting MINOR-01 after QUIZ-05 undoes the guardian fix, so MINOR-01 itself must fail closed (the lead's earlier revert was wrong). P2: the daily pause cap delayed safety reports on fun facts; school / team / city detection missed single words. → all fixed (MINOR-01 now refuses unknown approval keys and stops a lone re-run after QUIZ-05; safety reports on fun facts always pause; school / team / town words refused; tougher text filter; timed-out fun facts re-checked; fun-fact archive goes through the fact queue; declined text purged after 30 days). Lead runs: fresh questions 45/45, Life 39/39, QUIZ-03 59/59, schema 105/105. Round 2: word-rule false positives ("Crush it", "Court vision", "Varsity spirit", "Oh oh oh") → fixed. Round 3: hyphenated spelled digits and stretched profanity → fixed and replay-verified (lead). All earlier fixes re-probed and hold |
| Admin-ready | **2026-10-15T21:11:39Z** — [evidence](../engineering/evidence/QUIZ-05-admin.md); lead runs: fresh questions 46/46, Life 39/39, QUIZ-03 59/59, schema 105/105, `pnpm check` 1,482 tests |
| Participant app | Built:
- Report a problem (`QuestionReport`).
- "Fun fact: {first name}" moment (`FunFactMoment`).
- Athlete "Share a fun fact" (`FunFactShare`, in Edit profile plus a skippable step after a first roster claim).
- Privacy fun-facts row (13–15 capped).
- Guardian approve / decline (also fixed fun-fact events showing as "Make the profile public").
- Learn card copy; Learn-card Start wired to `quiz_learn_start` with silent fallback.

Checks: full jest 188 suites / 1,579 tests; `pnpm check` exit 0 (implementer run). VOICE / ACCESSIBILITY / MINOR_SAFETY / PRIVACY_ENGINEERING **pass** with fixes. **App-ready 2026-10-15T21:52:58Z** — [evidence](../engineering/evidence/QUIZ-05-app.md); `pnpm check` 1,579 tests (lead run) |

**Design review highlights:**
- Fun facts get their own privacy setting, defaulting to friends; 13–15 accounts are capped at friends.
- Fun-fact text lives apart from the question, so withdrawal or closure erases it everywhere.
- Under-16 facts need guardian approval (the guardian can only approve or decline).
- Only verified athletes' facts are drawn.
- The server shuffles answer order and stores it.
- Report rules resist brigading.
- Athlete counts are hidden under 5 fans.
- The round moment is named "Fun fact: {first name}".

**Not in this build (each a separate owner decision):** AI drafting (a small AI spend) and internet pulls from openly
licensed sources (needs internet and a scheduled job). Both would only ever create drafts.

**Merge hand-off (main tree):** the main checkout's `supabase/migrations/20261014110000_minor_accounts.sql` is byte-identical to this branch's HEAD copy before the QUIZ-05 fix. At the coordinated merge, take this branch's MINOR-01 file: it adds the re-run stop after QUIZ-05, which is a no-op without trivia, refuses unknown approval keys, and uses `elsif` for `friend_requests_everyone`. Update main's `schema.sql` MINOR-01 block to match, including the transaction wrapper.

**Follow-ups (non-blocking):**
- Focus after Remove / Keep and on the fun-fact sign-up step.
- `checked` on the shared Privacy radios (PROFILE).
- Devices and screen readers.
- Counsel on LEGAL row AC.
- Owner decisions still open for later: AI drafting (spend) and openly licensed internet pulls.
