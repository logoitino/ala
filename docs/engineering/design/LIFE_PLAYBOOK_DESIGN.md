# Life Playbook and personal progress (QUIZ-04)

> **2026-10-15:** the owner simplified the track (simple facts, one-admin approval, four 13+ chapters, no money figures); [§8](#8-owner-simplification-2026-10-15--overrides-27-where-they-differ) overrides §2–§7 where they differ.

**Owner request (2026-10-14):** fun trivia must never hold an individual back from progressing, and trivia should become
an avenue for teaching student athletes and everyone in the app useful life skills — money, taxes, loans, smart
financial decisions, life needs — as an opt-in "advanced" track, worded in sports terms, simple and creative, and wrapped
so the app stays safe on these topics; finance first, more topics later. Owner choices the same day:

| Question | Decision |
| --- | --- |
| Weekly play | **Separate allowances:** each week 1 personal round, 1 group round (any one group) and 1 Life Playbook round if opted in. Every round counts toward the player's own badges, level and recap; group play never uses up personal play |
| Name | **Life Playbook** — levels Rookie → Varsity → All-Star → Pro; chapters such as Money Huddle, Credit Clock, Tax Timeout *(chapters superseded by §8)* |
| Ages | **Everyone 13+, tuned by age:** 13–15 get money basics, saving, scams and paychecks; loans, credit and taxes unlock at 16+ (education, never offers); adults get everything *(superseded by §8: every chapter is 13+; no loans, credit or taxes)* |

Builds on QUIZ-02 / QUIZ-03 (rounds of five, server deadlines, leaving ends a round, no repeats, equal private badges,
paused / testing-only / empty cohort until release). Chain: owner → CTO → ENGINEERING → `POLLS` (owner) with Content,
`AURA` (levels and badges), `ADMIN`; domain review by the **Office of the CFO** (`CFO`, `TAX`, `CONTROLLER` for accuracy of
money and tax facts), `LEGAL` (education-not-advice framing), `MINOR_SAFETY`, `PRIVACY_ENGINEERING`, `RLS_SECURITY`,
`VOICE`, `ACCESSIBILITY`, `QA`; the infrastructure seat for capacity.

## 1. Never held back: separate allowances and personal progress

- Three independent weekly opportunities: **personal**, **group** (one per week across all groups) and **life** (if
  opted in). Each has its own weekly guard; using one never consumes another. A group round counts for every group the
  player belongs to (QUIZ-03 rule) and also for the player's own progress.
- **Personal level** (one ladder for all trivia): based on facts learned (answered, uncorrected questions) across every
  round kind, never on being right, speed or other people. Levels only go up; a missed week, a wrong answer or leaving a
  group never lowers anything. Proposed thresholds: Rookie 0, Varsity 15, All-Star 40, Pro 80, Hall of Fame 150.
- **Never blocked by others:** a group's theme, an inactive group, a removal or a group being closed never stops personal
  or life rounds. Exhausting one topic's pool shows a friendly message and suggests another topic; it never ends progress.

## 2. Life Playbook — the track

Opt-in from the trivia screen: **"Life Playbook: real-life skills, sports style."** Its own notice (§4) and switch; off by
default. Chapters (each a reviewed set of questions; more chapters later):

| Chapter | Sports framing | Topics | Ages |
| --- | --- | --- | --- |
| Money Huddle | Calling the play before you spend | Needs vs wants, budgeting, saving goals, comparing prices | 13+ |
| Bank Basics *(superseded by §8)* | Your home field | Checking vs savings, interest earned, debit cards, keeping accounts safe | 13+ |
| Paycheck Playbook *(superseded by §8)* | Reading the scoreboard | Gross vs net pay, what withholding is, first jobs | 13+ |
| Scam Defense | Defense wins | Phishing, too-good-to-be-true offers, protecting personal information, "never send money to strangers" | 13+ |
| Credit Clock *(superseded by §8)* | Managing the game clock | Credit scores, interest and APR concepts, paying on time, what a loan is, student-loan basics | 16+ |
| Tax Timeout *(superseded by §8)* | The rulebook | What taxes pay for, W-2 vs 1099, what filing means, why NIL or gig income can be taxable (general only) | 16+ |
| Life Needs *(superseded by §8)* | Training for the long season | Renting basics, insurance concepts, emergency funds, health and wellness basics | 16+ |

Rounds: up to five questions from the player's opted-in, age-allowed chapters (age bands superseded by §8), same 30 / 90-second choice, same rules.
Levels within the Playbook use the same ladder (Rookie → Pro) per chapter so a player can see chapter progress, plus one
**Life Playbook** badge per chapter at Varsity.

## 3. Keeping it safe (the wrapper)

- **Education, not advice.** Every Life Playbook question and explanation teaches a general concept. No recommendations
  for a specific person ("you should…"), no product, bank, lender, card, app or brand names, no current rates, limits or
  dollar thresholds that change year to year (use concepts or clearly dated examples only *(superseded by §8)*: no money figures at all), no investment picks.
- **Trusted-adult nudge** for teens: the notice and chapter screens say "For real decisions, talk with a parent,
  guardian, school counselor or another trusted adult."
- **No personal data.** Questions never ask about the player's own money, income, debts, family situation or taxes;
  answers are stored exactly like other trivia (no extra fields). No financial profiling, no segmentation by answers.
- **No offers, ever.** No loans, credit cards, sponsors, ads or links to financial products inside the Playbook; no
  partner may pay to place content. Donations and payouts stay separate (VOICE money words apply to app copy).
- **Student-athlete eligibility care.** *(superseded by §8: NIL, eligibility and tax content are refused outright)* NIL and taxes stay general ("income can be taxable; ask a qualified professional
  and your school's compliance office"); never state eligibility rules, which vary by state and association.
- **Content review is stricter:** *(superseded by §8)* each Life Playbook question needs a source (government or nonprofit education sources,
  e.g. CFPB, IRS, FTC, FDIC — to verify), an `education_only` attestation, a finance / tax domain reviewer (a second admin
  acting for CFO / TAX) different from the author, and age band. The server refuses approval otherwise.
- **Age gating on the server:** *(superseded by §8: all chapters are 13+)* chapters carry a minimum age band; a 13–15 account is never issued a 16+ chapter
  question; an account with no recorded age (`not_given` / `unknown`) gets only 13+ chapters.
- **Corrections:** a wrong or outdated money fact is voided per item (QUIZ-03), and the admin desk shows each
  question's review date so finance reviewers re-check yearly *(superseded by §8)*.

## 4. Notice (draft for LEGAL)

> Life Playbook is optional trivia about everyday money and life skills. It teaches general ideas, not advice for your
> situation, and never recommends products. For real decisions, talk with a parent, guardian, school counselor or another
> trusted adult. We save your rounds the same way as other trivia so we can avoid repeats and show your private badges.

## 5. Admin handling (built first)

Life Playbook switch (`trivia.life`, off); chapter list with minimum age band *(superseded by §8)*; question fields chapter, age band,
education-only attestation, finance / tax reviewer (second admin) and review date *(superseded by §8)*; approval refused without them;
counts by chapter and level distribution (aggregate only); yearly re-review list (questions older than 12 months) *(superseded by §8)*.

## 6. Not in this build

Personalized coaching, calculators, real-money simulations, partner content, certificates for schools, other topic
tracks (health, careers, study skills) — later, each with its own review.

## 7. Design review (2026-10-14) — changes adopted (override §1–§6 where they differ)

Panel: POLLS, CFO + TAX, LEGAL (unverified, from memory), MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, VOICE, the
infrastructure seat (as COST_OPERATIONS). All CHANGES NEEDED → adopted:

1. **Round kinds.** `round_kind` (`personal` | `group` | `life`) on attempts, week guards and the Start digest;
   uniqueness per (account, week, kind); `quiz_end` takes the kind and spends only that guard; still one active round at
   a time; request-slot reservations per (week, kind) with the weekly request cap raised about 3×.
2. **Topic lists are explicit.** The fun-slot test names its categories (`science`, `geography`, `general`); `life` is
   issued only through `quiz_life_start`.
3. **Group "played" and Family Challenger count group rounds only;** Life never appears on group pages or totals; a group
   round needs at least two members; Trivia Explorer re-points to the round that qualifies when an earlier one is voided.
4. **Named content reviewers.** *(superseded by §8)* New `quiz_content_reviewers(profile_id, domain, qualification, granted_by, expires_at,
   revoked_at)`; only the owner grants (audited). A Life question is approved only by an active reviewer for its domain
   (`finance` or `tax`) who differs from every author since the last approved version. Reviewer, grant, source URL
   (allow-listed `.gov` or nonprofit), retrieval date, attestation, chapter and age band are immutable on the version.
5. **No Tapua'i money in lessons.** *(kept; the NIL line is superseded by §8, which refuses NIL)* No item may mention Tapua'i, donations, Rally, family accounts, payouts, Aura or
   whether gifts are income (that treatment is open with the CPA, LEGAL row X). NIL wording only: "rules vary by state and
   school; ask your compliance office." Never eligibility rules.
6. **Numbers that change.** *(superseded by §8: no money figures or years at all, so nothing is withdrawn)* Concepts only for 13–17; an adult item with a figure carries `as_of_tax_year` and is
   withdrawn every 31 January; tax items are re-reviewed each January, others yearly.
7. **Tax Timeout and Credit Clock open only after a recorded CPA sign-off** *(superseded by §8)* (an owner-entered sign-off record per chapter).
8. **LEGAL:** a new LEGAL_BRIEFING row for counsel; the Life notice has its own version; Credit and Tax explanations carry
   "General education, not financial or tax advice." *(superseded by §8)*; chapters align to a national personal-finance standard (to verify).
9. **MINOR_SAFETY:** scam wording becomes "never send money to someone who contacts you first or pressures you"; every
   scam item ends with "tell a trusted adult; use Report"; never prompt "add your age to unlock"; `not_given` / `unknown`
   accounts get 13+ chapters silently; the age band is re-checked at every Next *(superseded by §8)*; **Life Needs drops health and wellness** *(superseded by §8)*
   in this build (renting, insurance concepts, emergency savings stay).
10. **Privacy:** no question ids or correctness in telemetry; per-question statistics only with ≥ 20 responders; age-band
    × chapter cells under 10 hidden; no per-user drill-down; opt-in status and Life badges private; erasure covers Life.
11. **VOICE scope rule.** Retired money words govern Tapua'i's own money (donations, checkout, Rally, payouts, Aura). Life
    content has its own ruleset, run in CI over `supabase/content/life_*.json` and in SQL at approval: it allows fund, tip,
    invest (as a concept) and deductible; it bans "you should", brand names, Tapua'i money words, and amounts / percentages
    without a year or an "illustrative" marker *(simplified by §8: any figure or year is refused; no marker)*. Life screens get a path-scoped copy allowlist and never show Donate.
12. **Capacity:** a separate Life version cap; run-out forecast per chapter and age band; a chapter opens only with at
    least 20 approved items *(superseded by §8: 5)* (the 42-question starter set therefore needs more questions before any chapter opens).
13. **Progress:** levels keep the highest value reached (cleared only by history erasure); chapter progress is the share of
    the chapter's questions seen; admins set level thresholds; Life rounds default to 90 seconds; a voided Life item shows
    a correction note in history.
14. **Security review (2026-10-14) — kept as intentional.** Clearing trivia history spends all three weekly
    opportunities (so erasing cannot buy a replay) and keeps the private Life opt-in, which is a setting. Trivia
    Explorer and Season Learner count Life rounds; they do not reveal Life because personal rounds earn them too (Life
    badges, levels and the opt-in stay private). The January withdrawal *(superseded by §8)* uses the UTC calendar, so it withdraws before
    any US time zone reaches 1 February. The 13+ Paycheck Playbook pay example *(superseded by §8)* stays, marked "Illustrative example
    with made-up numbers", and is flagged for CFO review. Changes adopted from the same review: the content rules
    (Scam Defense line, no "stranger", NIL / eligibility, disclaimers, Life Needs without health, teen figures only
    with the fixed marker; simplified by §8) run in SQL at approval and re-review from one shared rule file
    (`supabase/content/life_copy_rules.json`); CPA sign-offs and reviewer grants need a second admin; sign-offs
    expire and cover only the versions they list; `as_of_tax_year` is limited to the previous, current or next year *(superseded by §8)*.

## 8. Owner simplification (2026-10-15) — overrides §2–§7 where they differ

**Owner direction:** keep trivia simple and fun — simple facts only, no complex questions that need expert
verification. Of the options offered the owner chose **(A) normal trivia approval**. Both QUIZ-04 migrations were
written but never applied anywhere, so `20261014180000_life_playbook.sql` was edited in place (with `schema.sql` kept
identical) and the bank `20261014190000` regenerated. Nothing was deleted: removed SQL is kept as excerpts in
`archive/superseded-2026-10-15/sql/life_playbook_review.archived.sql` and removed app / admin code and tests under
`archive/superseded-2026-10-15/apps/…`, each with an entry in `docs/engineering/data-ownership.json` → `archived`.

**Approval.** One admin approves a Life question the same way as sports trivia. The server still requires the
education-only attestation and runs the automatic word rules below at approval.

**Removed:** the CPA sign-off (record, second-admin confirm, coverage, expiry); named finance / tax reviewers (grants,
confirm, revoke, domain matching, Life-specific author exclusion); required allow-listed source URLs, retrieval date,
`as_of_tax_year` and review date; the re-review action and list; the January withdrawal; the 16+ and adult-only bands;
the illustrative-figure marker, the disclaimers, the health rule and the "stranger" rule. No money numbers are allowed
in Life content, so nothing goes stale.

**Kept:** education only; the `trivia.life` switch (off) and the private opt-in with its own notice; round kinds with
per-kind guards, budgets and exact recovery, and `quiz_life_start`; group-only "played" and the 2-member rule; levels
that never drop; aggregate-only statistics with thresholds (≥ 20 responders per question, cells under 10 hidden); Life
left out of trivia counts and the audit feed, with no question ids in Life audit rows; erasure; the QUIZ-03 lone re-run
stop; the "Closed accounts" policies, RPC-only access, explicit revokes and pinned `search_path`. The trusted-adult line
stays in the notice and on the Life screens.

**Chapters (all 13+).** Life is limited to accounts eligible for trivia, plus 13+ accounts without a recorded age
(`not_given` / `unknown`) as before. A chapter opens with **5** approved questions (one round), not 20.

| id | Chapter | Sports framing |
| --- | --- | --- |
| `money_huddle` | Money Huddle | Calling the play before you spend |
| `savings_season` | Savings Season | Building your bench |
| `scam_defense` | Scam Defense | Defense wins |
| `smart_plays` | Smart Plays | Good calls every day |

Bank Basics, Paycheck Playbook, Credit Clock, Tax Timeout and Life Needs are removed. The starter bank is 40 drafts,
10 per chapter, each with a short source note.

**Word rules (`supabase/content/life_copy_rules.json`, version 4).** One rule file, embedded in SQL
(`quiz_life_copy_rules()`) and checked against the JS in `scripts/life-bank-sql.mjs` (`pnpm life:bank:check` fails on
drift). Normalization stays: NFKC, zero-width characters removed, macron-stripped matching, non-Latin letters refused.
Refused: advice ("you should / shouldn't / must / need to"); brand names; Tapua'i money words (including the variants,
donor and Mālo); NIL and eligibility; tax, loan, credit score and APR; any money amount, price, percentage, rate or
"k / grand / million" figure; years. Required: Scam Defense explanations end "Tell a trusted adult and use Report.";
prompt at most 120 characters; explanation at most 200. Rule names: `non_latin_text`, `advice_you_should`,
`brand_name`, `tapuai_money_word`, `nil_eligibility`, `tax_loan_credit`, `money_figure`, `year`,
`scam_missing_report_line`, `prompt_too_long`, `explanation_too_long`.

**Admin desk.** Keeps the switch, level thresholds, chapters with "needs N more approved questions" and aggregate
statistics; the reviewer grants, CPA sign-off, re-review list and the domain / source URL / tax-year fields are gone.
