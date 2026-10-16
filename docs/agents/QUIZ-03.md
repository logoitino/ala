# QUIZ-03 — Trivia, play together

**Owner request (2026-10-14):** keep building Codex's trivia and make it fun for fans and families of student athletes.
The owner picked all four upgrades, playing with each other, a weekly round of five, and image / other question types
for the future. **Primary owner:** POLLS (Engineering) with ADMIN, AURA, Content; reviews MINOR_SAFETY,
PRIVACY_ENGINEERING, RLS_SECURITY, CONTENT_RIGHTS, SUPPORT, QA, DATA_GOVERNANCE, VOICE; INFRASTRUCTURE seat for capacity.
Executor: Claude session and its subagents in the `codex/fan-zone` worktree (Codex's QUIZ-02 handoff was closed). Not
committed.

[Design](../engineering/design/TRIVIA_PLAY_TOGETHER_DESIGN.md) (review §9 adopted) · [Feature contract](feature-admin.json) ·
[Prior ledger](QUIZ-02.md).

| Stage | Status |
| --- | --- |
| Enrollment | Planned 2026-10-14T19:44:21Z, before new source |
| Design review | Seven-seat panel: CHANGES NEEDED → 17 changes adopted (design §9) |
| Starter bank | 60 draft questions (12 sports × 4; science / geography / fun 4 each; 45 four-choice, 15 true / false) in `supabase/content/trivia_starter_bank.json`, generator `scripts/trivia-bank-sql.mjs`, migration `20261014170000_trivia_starter_bank.sql`; facts flagged for Content in the migration header |
| Backend / admin | `20261014160000_trivia_play_together.sql`: round items with per-item deadlines and exact Next recovery, question types, challenge groups under MINOR-01 rules, badges, recap, guardian group count, audited admin case view; admin desk round size, type editor, forecast, groups, switches. Replays after the security fixes: play-together 59/59, timed with QUIZ-03 51/51, schema 105/105; full `pnpm check` 153 suites / 1,255 tests (implementer run) |
| Security review | RLS_SECURITY + MINOR_SAFETY + PRIVACY: CHANGES NEEDED (1 P1, 2 P2, 4 P3) → fixed → **APPROVED**; last P3 (QUIZ-02 re-run) fixed with `NOT VALID`; open P3: `quiz_groups_mine` can show a drifted member until that page opens |
| Admin-ready | 2026-10-14T21:12:19Z — [evidence](../engineering/evidence/QUIZ-03-admin.md) |
| Participant app | Built after admin-ready; VOICE + ACCESSIBILITY changes applied; **app-ready 2026-10-14T21:43:11Z** — [evidence](../engineering/evidence/QUIZ-03-app.md); `pnpm check` 156 suites / 1,286 tests |

**Open decisions noted by the implementer** (for the owner / counsel): removed-member records survive history erasure
as the rejoin bar; the group case log has no automatic purge (counsel sets retention); supervision events are not erased
with trivia history. Teen rules are now re-checked after joins (age, setting, friendship, guardian, closure, birthdays). Image delivery (private bucket, signed URLs)
is deferred. Delivery stays paused / testing-only / empty cohort; hosted SQL, devices, counsel and release remain separate.
