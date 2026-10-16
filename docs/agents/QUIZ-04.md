# QUIZ-04 — Life Playbook and personal progress

**Owner request (2026-10-14):** fun trivia must never hold an individual back from progressing, and trivia becomes an
opt-in avenue for teaching life skills — money, taxes, loans, smart decisions, life needs — in sports terms, simple and
safe; finance first. Owner choices: separate weekly allowances (personal, group, life), the name **Life Playbook**
(Rookie → Varsity → All-Star → Pro), everyone 13+ tuned by age (credit / loans / taxes 16+). **Primary owner:** POLLS
(Engineering) with ADMIN, AURA, Content; domain review Office of the CFO (CFO, TAX, CONTROLLER), LEGAL, MINOR_SAFETY,
PRIVACY_ENGINEERING, RLS_SECURITY, VOICE, ACCESSIBILITY, QA; infrastructure seat for capacity. Executor: Claude session
and its subagents in the `codex/fan-zone` worktree. Not committed.

[Design](../engineering/design/LIFE_PLAYBOOK_DESIGN.md) (review §7 adopted) · [Feature contract](feature-admin.json) ·
[Prior ledger](QUIZ-03.md).

| Stage | Status |
| --- | --- |
| Enrollment | Planned 2026-10-14T21:53:41Z, before new source |
| Design review | Eight-seat panel: CHANGES NEEDED → 13 change groups adopted (design §7): per-kind rounds, named finance / tax reviewers, no Tapua'i money in lessons, CPA sign-off before Credit Clock / Tax Timeout, scam wording that fits Donate, health dropped, privacy thresholds, levels never drop |
| Content | Revised to the §7 ruleset: 56 drafts (8 per chapter; 36 four-choice, 20 true / false) in `supabase/content/life_playbook_bank.json`; `scripts/life-bank-sql.mjs --check` enforces Life copy rules, scam ending, Credit / Tax disclaimer, NIL line, no health items, allow-listed sources. Every source URL still to verify; 11 facts flagged for CFO / TAX (deposit insurance limit, FICA, W-2 / W-4 / 1099, income without a form, state sales tax, cosigners, own credit check, student-loan repayment, renters insurance, credit unions, teen work rules). Chapters open only at 20 approved items each |
| Backend / admin | `20261014180000_life_playbook.sql` (round kinds, explicit fun topics, group-only played / Family Challenger, ≥ 2-member group rounds, named reviewers with author exclusion and immutable review fields, chapters + CPA sign-offs, age gating at Start and every Next, January withdrawal, never-drop levels, aggregate-only stats, SQL copy ruleset, `trivia.life` off) and generated `20261014190000_life_playbook_bank.sql` (56 drafts, all chapters closed); admin `SportQuizLife` / `SportQuizLifeQuestion`; client `lib/lifePlaybook.ts` + shared types; `pnpm life:bank:check` in `pnpm check`. Life replay 33/33 (re-run by the lead), schema 105/105, QUIZ-03 59/59, timed 50/50 and 51/51; `pnpm check` 158 suites / 1,301 tests (implementer run). Ten intentional behaviour changes listed in the implementer report (e.g. `quiz_end` takes the round kind; weekly request cap 171; Life cap 200 separate from 300) |
| Security review | RLS_SECURITY + MINOR_SAFETY + PRIVACY_ENGINEERING + CFO / TAX: **CHANGES NEEDED** (1 P1, 5 P2, 7 P3; probe `/tmp/q4probe/probe.mjs`). P1: chapter content rules (scam ending, no "stranger", NIL, disclaimer, no health) only in the CI script, not at desk approval. P2: copy rules bypassable (spelled numbers, Unicode, "not illustrative"), SQL / JS lists differ; trivia snapshot shows Life counts below thresholds; one admin can record a CPA sign-off or grant; far-future tax year escapes January; re-running the QUIZ-03 file alone undoes QUIZ-04. → all fixed (chapter rules at approval and re-review; one shared rule file `supabase/content/life_copy_rules.json` with normalized SQL matching; Life removed from trivia snapshot counts; second-admin confirmation for reviewer grants and CPA sign-offs, sign-offs cover named versions and expire; tax-year window; QUIZ-03 re-run stops after QUIZ-04; per-kind play budget; audit keeps chapter / position only). Life replay 35/35 (re-run by the lead); `pnpm check` 158 suites / 1,302 tests (implementer run). Re-review round 2: 2 P2 (macron / spacing copy bypasses, Life rows in the trivia audit feed), 2 P3 → fixed; round 3 **APPROVED** ; its two non-blocking P3 copy gaps closed after admin-ready (amounts like "1k" / "two grand" / "half a million" count as figures; the illustrative marker covers only the field it opens, a prompt marker also covering options; rule file v3; Life replay 36/36, schema 105/105, QUIZ-03 59/59, `pnpm check` 158 / 1,302) |
| Admin-ready | **2026-10-15T01:29:17Z** — [evidence](../engineering/evidence/QUIZ-04-admin.md); lead-run Life replay 36/36, schema 105/105, QUIZ-03 59/59, timed + QUIZ-03 51/51, `pnpm check` 158 suites / 1,302 tests |
| Participant app | Built: "This week" strip (`SportQuizAllowances`), personal level (`SportQuizLevel`, `useTriviaLevel`), opt-in card (`LifePlaybookCard`, notice `life-playbook-v1-testing`), Life home (`LifePlaybookHome`, `useLifePlaybook`; server-returned chapters only, no age / unlock text), round kinds in `useTimedSportQuizRound`, Life labels / corrections / erase copy in history, private Life badges. 31 new tests; `pnpm check` 161 suites / 1,333 tests (implementer run). Lead decisions: Turn off stays reachable after opting in; admin chapter notes dropped from the participant read; "Skip this week" relabelled for the personal round. VOICE / ACCESSIBILITY / MINOR_SAFETY **APPROVED** with fixes (Skip label, focus moves, mounted live region, distinct checkbox name, wrapping). **App-ready 2026-10-15T02:21:32Z** — [evidence](../engineering/evidence/QUIZ-04-app.md). Full `pnpm check` re-run pending another session's in-progress Admin/Reports export work in this worktree (its 1 tsc error / 3 tests are not QUIZ-04) |

**Open for the owner / counsel:** a CPA must sign off Credit Clock and Tax Timeout before they open; a new LEGAL_BRIEFING
row AB covers financial education for minors; hosted has no owner role, so an admin (never for themselves) grants reviewers and records CPA sign-offs with an audited reason — owner to confirm; every bank draft needs a verified new version (sources checked, retrieval date) before approval; whether donations count as income stays with the CPA and is never taught.

**Follow-ups (non-blocking):** "Skip this week" wording in the home invitation / Family Fun / admin coverage; `QuizButton`
ref for focus after Not now / Turn on; plain rewrite of the erase confirmation with PRIVACY_ENGINEERING; Turn off hidden
during an open round, on a group page or when the trivia read fails; device / screen-reader checks.

**Owner simplification (2026-10-15):** trivia stays simple and fun — well-known facts, nothing needing expert
verification. Life Playbook is now four 13+ chapters (Money Huddle, Savings Season, Scam Defense, Smart Plays) with
one-admin approval and a chapter opening at 5 approved questions. The CPA sign-off, named reviewers, source links,
yearly expiry and the credit / tax / life-needs chapters are removed and archived (`archive/superseded-2026-10-15/`).
There are 40 simple-fact drafts, and the sports bank is simplified (18 replaced). Design §8. Admin-ready and app-ready
re-recorded at 2026-10-15T03:15:48Z: Life replay 31/31, schema 105/105, QUIZ-03 59/59, `pnpm check` 166 / 1,372 (lead run).
The owner / counsel items above about the CPA, reviewers and sources no longer apply; content approval in the admin desk
remains.

**Control tower and simple question flow (2026-10-15, admin only, no SQL):**
- The menu item is now **Trivia**, with search on trivia / quiz / questions / Life Playbook.
- A Home status card (`SportQuiz/TriviaStatusCard.tsx` via `components/Admin/AdminHomeCards.tsx`) shows: state; groups / Life / images switches; drafts waiting; chapters open; what is running low.
- Control map rows were added for This week, level and the Life Playbook. The page Skip now reads "Skip my round this week".
- The bank opens on a simple **Add a question** form (`SportQuizAddQuestion.tsx`). It has live length / word-rule checks and a player preview (`SportQuizPreview.tsx`); the advanced fields sit under More options.
- **Drafts to review** (`SportQuizReview.tsx`) walks drafts with Approve / Edit / Archive / Next and per-chapter progress to opening.
- One **Settings** panel (`SportQuizSettings.tsx`); images stay locked off.
- The word rules have one code module, `packages/shared-types/lifeCopyRules.ts`, used by the app and `scripts/life-bank-sql.mjs`. `supabase/content/life_copy_rules.json` stays the only rule file.
- Checks: `pnpm check` exit 0, 171 suites / 1,418 tests (lead run); Life replay 31/31.
- **Hand-off to the Reports session (ADM-03/04/05):** Home lives in `components/Admin/Reports/AdminReportHome.tsx`. To place the card, QUIZ-04 added one import, one `<AdminHomeCards />` line and one header-comment line there. Please keep them when integrating; nothing else in that file was changed by QUIZ-04.
- **Owner approved both recommended SQL changes; built in the unapplied `20261014180000` file:**
  - `quiz_admin_snapshot.bank_counts` (admin-only content counts by topic / sport / chapter) drives the review counters and the Home card. An older server falls back to "(loaded so far)".
  - `quiz_admin_question` action `edit_replace` creates the new draft and archives the old one in one transaction, with both audit rows; any refusal changes nothing.
  - Life replay 38/38, schema 105/105, QUIZ-03 59/59, `pnpm check` 171 / 1,428 (lead run).
- Not verified: browser / device rendering, screen reader, hosted read.

**Fun presentation (2026-10-15, participant, presentation only):**
- Effects: the question pops in, answers cascade, jersey-number progress dots fill, a shot-clock bar turns gold in the last 10 seconds, buttons squish.
- Right answer: a rotating sport cheer, confetti contained in its banner, and the answer glow. Not quite: an encouraging line and a soft wiggle. Time up: "Whistle!".
- Round summary: the same celebration for anyone who answered, plus a medal count-up and badge shine. Level up: a one-time celebration. Life chapter cards get emoji accents.
- Sound: synthesized soft sounds on web (Web Audio, after the first interaction); haptics on phones. Native audio waits for `expo-audio`, which can't be installed while the registry is blocked; the plug-in point is commented in `lib/quizSound.ts`. The "Sound on / off" switch is saved on the device, and Sound off also silences quiz haptics.
- Reduce Motion is followed live (fades only). Effects are hidden from screen readers and never tappable. Answer, Next and End are sent before any effect.
- Cheers live in `components/SportQuiz/quizCheers.ts`; the lead did the VOICE read (no money words, no pressure).
- Files: `lib/quizSound*.ts`, `hooks/useReduceMotion.ts`, `useQuizSound.ts`, `components/SportQuiz/QuizFx.tsx`, `QuizProgress.tsx`, `quizCheers.ts`; 18 new tests.
- Checks: `pnpm check` exit 0, 175 suites / 1,462 tests (lead run).
- Note for the Reports / product-inventory session: the implementer regenerated their untracked generated `packages/shared-types/admin/productInventoryData.json` (only its source hash changed) because it was stale and failing `pnpm check`.
- Not verified: browser / device feel and sound. The Expo web export can't resolve the symlinked `expo-router/entry` in this worktree.

**Demo preview (2026-10-15):** dev-only route `/dev/trivia-preview` (`app/dev/trivia-preview.tsx`, `components/SportQuiz/TriviaPreview.tsx`).
- It plays a scripted round of 5 bank questions with the real effects, timer and web sound, plus buttons for each moment. There is no database or network, and a "Demo only: nothing is saved." banner.
- It redirects to Home when `EXPO_PUBLIC_APP_ENV=production`, and is not linked from any menu.
- `metro.config.js` now also watches the real folders behind the worktree's symlinked `node_modules`, so web builds work in worktrees; the main tree is unchanged.
- Checks: web export 71 routes including the demo; `pnpm check` 176 / 1,464.
- Lead: the Expo web dev server on :8082 serves the page (HTTP 200), and the dev bundle compiles with the demo included. Headless Chrome can't launch on this Mac, so on-screen rendering is for the owner to check.
- **Owner viewed the demo in a browser, 2026-10-15: "The demo looks good."** This is owner-reported web rendering of the fun presentation. Native devices and screen readers are still not verified.
