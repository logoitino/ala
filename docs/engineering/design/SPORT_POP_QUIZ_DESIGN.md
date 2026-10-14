# Sport Pop Quiz — QUIZ-01

Owner asks for simple, randomly appearing weekly sport questions and quiz badges.
Build a dismissible Home discovery card and a small quiz view, alongside FUN-01.
This is a locally testable learning feature; all content/settings start testing-only and paused.

## Accepted build direction

- Home offers **Sport Pop Quiz** once per UTC Monday–Sunday account week. It never opens a
  blocking modal, interrupts a payment/upload, sends a push notification or requires a response.
- The account chooses an available sport and starts a quiz. Server randomly assigns one
  approved question for that week; refresh/sport changes cannot farm more badge opportunities.
- Four simple answer buttons and a clear explanation. Example: **In American football,
  how many points is a touchdown before any extra point or conversion?** Correct answer: 6.
- Completing the question earns one private **Sport Learner** badge for the week. Wrong answers
  still get the explanation and completion badge. No streak penalties, cash value, Aura, votes,
  cash prizes, donation advantage or learning proficiency claims. Sharing/public badges are later.
- Use the canonical account/week only; no device/browser fingerprinting, identity enrichment or new Growth tracking.
- Users may always ignore the invitation or leave the page; a local Not now action dismisses the card without claiming a server write. Persisting Skip for the week requires an active authorized backend, with an honest failure state. Existing private
  badges remain accessible. Eligible adults/teens may participate without athlete/Stripe/school
  verification. Unknown/closed/blocked/under-13 accounts cannot start/answer; no extra birth data.
- A paused or missing backend/question bank shows unavailable, never a made-up question or badge.

## Admin before app

Expo `/admin/sport-quiz` owns approved question bank/versioning, pause/enable for testing,
review rationale, archive/void erroneous questions and a bounded complete Data alternative.
Seed examples are draft, not automatically approved. Distinguish American football from rugby;
questions name league/rule context when answers differ. Editing an issued question creates a
new version. Issued answer/wording stay stable; voiding an erroneous question prevents new
answers and hides invalid badges with a clear correction. Admin cannot change a user's answer.
Record question version and authoritative actor/time audit. Next remains read-only.

Counts: active/draft/archived/void questions, current UTC-week issued/completed/skipped quizzes,
issued/void noncash badges; no unrestricted account identities or answers in Growth reports.
Question limit 100, admin complete Data list; audit cursor paging. No separate analytics dashboard.
Link existing Analytics/Health/Support. Server settings default paused with an empty canonical-profile tester list (maximum 100); all quiz participation and prompt reads require eligible enrolled testers. Enabling requires a nonempty list; testing_only is constrained true and production enable is rejected. Opening only local testing
does not authorize a hosted release. No remotely published runtime flag in this task.

## Data and interfaces

QUIZ-01 owns separate migration `20261014140000_sport_pop_quiz.sql` after FUN-01 and separate
tables `sport_quiz_settings`, `sport_quiz_questions`, `sport_quiz_attempts`, `sport_quiz_badges`,
`sport_quiz_audit`. POLLS owns questions/settings/attempts, AURA owns noncash badge data,
RLS_SECURITY owns audit. Data governance reviews explicit functions/bucket-free exports. Closed-account
restrictive policies and no direct client writes/read leakage; all uses narrow definer RPCs.
Canonical profile IDs must not be assumed equal to auth.uid(). SQL protects the correct answer
until the account's committed attempt returns its explanation; no public correct-answer column.

Shared types in `packages/shared-types/sportQuiz.ts` (root adds explicit package export).
Client adapter `lib/sportQuiz.ts` binds actual RPC; hook/UI belongs to later app stage.

| RPC | Arguments | Contract |
| --- | --- | --- |
| `quiz_snapshot` | none | own UTC-week prompt/status/available sports, issued question without answer, completed explanation, private badge list; paused/error distinct |
| `quiz_start` | `p_sport text` | atomic one random approved version per profile/week; existing issued choice reused |
| `quiz_answer` | `p_attempt_id uuid`, `p_option integer`, `p_request_id uuid` | bounded option, caller ownership, eligible account/current week/not paused/not void, exactly one durable completion/badge, safe exact retry, differing retry rejects |
| `quiz_skip` | none | own current week dismissed; no reward or capability loss |
| `quiz_admin_snapshot` | `p_before bigint default null` | admin full question bank <=100, population/window counts and bounded audit |
| `quiz_admin_question` | `p_id uuid`, `p_action text`, `p_payload jsonb` | create/edit as new version/review approve/archive/void with reasons and audit |
| `quiz_admin_settings` | `p_payload jsonb`, `p_reason text` | local-testing paused state, no live launch authority |

Backend worker may refine DTO fields; notify root before consumers start. Every write server
validates settings/age/owner/week and replay tests retries/deadlines/voids/role denial. Badge
records remain nontransferable noncash completion records, not money-looking wallet amounts.

## Verification and gaps

Order: planned enrollment → SQL/shared adapter/admin tests and actual actor replay → independent
Data/Safety/QA/SUPPORT review and admin-ready gate → Home/quiz UI → app-ready and full checks.
App tests prove skip, explanations/badge states, unavailable source and duplicate-submit handling.
SUPPORT records safe fixed-code quiz read/write errors and local test sensors, with no account
answers/identity in raw telemetry. Hosted metrics/rate limits/retention/recovery and browser/device
interaction are separate verified release work. Counsel/privacy approves noncash reward/age/
retention/terms, content owner verifies sport facts and Growth measures optional completion and
return against actual support costs before expansion. No invented engagement or safety outcomes.

Legacy malformed option versions remain visible in admin with a correction notice so Pause/archive/void stay operable. They cannot be assigned, approved or completed; an already-issued malformed attempt shows unavailable_reason without exposing a question or fabricating a void event. New answer-option inserts normalize ECMAScript whitespace; other stored text uses PostgreSQL ASCII-space btrim and Unicode character counts. Metadata edits preserve issued option bytes.
