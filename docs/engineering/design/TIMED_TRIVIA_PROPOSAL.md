# Timed trivia proposal

**Status:** proposed replacement for the untimed QUIZ-01 experience, awaiting owner design review. No timed runtime, consent control, expiry or no-repeat ledger is implemented. The owner chose a Ready invitation, explicit Start, 30 seconds and a longer accessible option. Existing QUIZ-01 admin evidence covers its earlier untimed contract only.

[Current source ledger](../../agents/QUIZ-01.md) · [Earlier quiz design](SPORT_POP_QUIZ_DESIGN.md) · [Family activities](../../product/FAMILY_FUN_PLAYBOOK.md).

## 1. Recommended experience

Everyone with an eligible account can enjoy trivia without athlete, school or Stripe verification. Existing account age restrictions apply; this does not extend under-13 access. Invitations start **off**. A clear optional setting offers manual-only trivia or one in-app invitation per UTC week, with invitations Off always reachable. Manual participation requires the same preparation notice and explicit Start; default-off invitations do not silently assign questions. No push notification permission is implied.

Sports-only is the default, covering all supported sports. Users can optionally add a reviewed mix of science, geography and fun general knowledge; at least four of every five scheduled topic opportunities remain sports when sufficient unseen content exists. No automatic topic substitution when the chosen pool is exhausted. This mix is a product proposal, not an inference about a student's interests.

A settled Home/HQ card says **Ready for trivia?** Seeing it or tapping Not now reveals no question and starts no clock. Inside preparation, users choose **30 seconds** or the proposed **90 seconds** longer option before Start. Everyone can choose either without explaining why. Equal rewards; no speed ranking. Do not describe 90 seconds as universally accessible before screen-reader and device review.

Start explicitly requests one approved unseen question. Four plain answer choices appear only after a successful response. The server starts the clock when it issues the prompt and returns its deadline; the remaining timer reflects network delivery time. State this plainly before Start. A receipt lost in transit may consume that week's opportunity. Never silently issue a second question or reset the clock.

An answer committed by the server before expiry gives a short explanation and the same private **Trivia Explorer** participation badge whether right or wrong. Earlier Sport Learner badges keep their historical names. The proposed badge acknowledges learning participation, not mastery. Limit one new completion badge per week. No money, Aura, paid entry, donation prompt, school score or ballot advantage.

A round ends when the user leaves the trivia page, backgrounds the phone app, hides the web page, switches account or reaches the deadline. Close the question immediately locally and send a best-effort terminal request. Returning does not resume it. Calls and accidental interruptions produce calm **Round ended** wording, with no lost existing badges, public failure count or streak penalty. Terminal own history can show the explanation without restarting the exposed question.

## 2. Invitation wording and choice

Proposed notice:

> Want optional trivia? Choose sports or add fun topics. We save your preference, questions issued to your account and round results so we can avoid repeats and show private badges. Choose 30 seconds or a longer option before Start. Leaving the trivia page or app ends that round. You can turn invitations off anytime. Turning invitations off does not end a round already started; use End round to stop it.

Use separate **Manual only**, **Weekly invitations**, **Not now**, **Invitations off** and **End round** controls; no preselected consent checkbox. Invitations off disables scheduled offers immediately locally and saves the preference when confirmed; manual Start remains available with the notice. A failed preference save shows an honest retry notice; other devices cannot be promised updated until server confirmation. Off does not cancel an already started round. End round and lifecycle abandonment are separate terminal actions; platform pause prevents new starts and new answer commits. Already committed own receipts remain readable.

This is an optional participation choice. Legal/Privacy still determine the lawful processing basis, child/guardian requirements and jurisdiction-specific notices. Do not treat tapping Start as blanket consent to marketing, public recognition, profiling or school disclosure. Do not collect a disability reason, device fingerprint or additional birth information for timing.

## 3. Questions and storage

**Recommend a reviewed server bank.** Human authors or an optional offline script create drafts with fact sources, sport/league context, four choices and a short explanation. Content approves accuracy, age suitability, wording and duplicate families before publication. Scripts never send a generated question directly to users. No model call runs during a round; selecting a vendor or spending would require a separate decision.

A baked client bank is useful later for distinct private offline practice, but shipping answers and requiring releases for corrections does not solve authoritative account history. Live generation adds latency, provider costs and fact errors. Bank text is small; attempt/history indexes, audit growth and human review dominate the scaling decision. Measure those costs before choosing capacity.

Use the existing stable question_key as an initial question-family identifier: one approved version per family, reviewed paraphrases and corrections attached to that family. At the first authoritative prompt issuance, atomically record account, family, immutable question version and server time. Every issued family counts as seen, including expired, abandoned or void rounds. An invitation alone does not count. Unique account/family history and an account lock prevent concurrent duplicate assignment; a text hash alone cannot detect rewordings.

If simultaneous translations or variants are later needed, define a shared family_id and explicit editorial grouping before that extension. Current source does not provide semantic grouping or history exclusion. Erasing history can permit repeats for the same surviving account; deleting/recreating an account can also reset history. Disclose that limitation and review whether any separately justified minimal exposure record may lawfully remain. Do not promise permanent no-repeat for a human across accounts or override erasure to protect a game mechanic.

The current 100-version cap includes archived/void questions. Before changing it, build complete paged admin inventory, totals, unseen-pool availability by topic and correction handling. Preserve historical versions. An exhausted pool says **You have seen the available questions. Check later or turn invitations off.** and issues no repeat. No fallback to unchecked or stale bundled content.

## 4. Authority and recovery

Keep one started opportunity per canonical account/UTC week and at most one active round. A declined invitation consumes neither a family nor an attempt. A confirmed Skip closes that week without a prompt. Duration and selected topic are fixed before issuance. Enforce age/account/cohort/settings/permission on the server for every operation.

Add reviewed preference, exposure and lifecycle contracts with exact Start/answer/closure request receipts. Assignment reserves an unseen family and sets started_at/expires_at atomically. Answer, closure, pause and void serialize under the account/attempt/settings locks. The answer deadline is checked at the locked server mutation. A previously committed exact answer remains recoverable after expiry; an uncommitted answer cannot be accepted late. No offline answer queue or automatic fresh draw. Invitation Off affects presentation/scheduling, not an active round; explicit End round or platform pause follows the terminal/authorization rules above.

Keep the existing STABLE snapshot read-only: return an explicitly effective-expired state when server time exceeds expires_at, and persist terminal expiry under the next lifecycle mutation. Admin counts use the same effective rule. Distinguish an effective timeout from a saved closure receipt. Old untimed attempts are historical and cannot become active timed rounds; migrate compatibility explicitly before enabling any cohort.

Lifecycle events are best effort. The operating system can kill the app or lose connectivity before abandonment reaches the server; server expiry still closes the opportunity. The UI can prevent resuming on return, but cannot reliably detect every exit, a second device or external help. Present this as friendly guessing and learning, with no cheating accusation, surveillance or valuable stakes.

## 5. Joint operating contract before participant changes

POLLS/Engineering owns lifecycle and UI; Content owns facts/family grouping; Admin owns pause, correction and complete inventory. Data/Privacy reviews purpose, minimal records, own reads/deletion and documented retention. Safety/Legal reviews notices, child access, rewards and interruptions. Support rehearses lost-response, closure, Off and correction recovery. Growth combines optional opt-ins/starts/completions, interruption burden, pool exhaustion and editorial/provider costs through the existing Marketing → CTO → owner decision route. These are assigned responsibilities, not evidence of hired counsel or background monitoring.

Update enrollment and the QUIZ-01 admin contract for the new capability. Verify settings/consent, expiry, history, correction, access and stop controls with independent reviewers and an actual new admin-ready checkpoint **before** timed participant implementation. Preserve prior checkpoints as historical evidence. Launch remains paused/testing-only with an empty cohort until separately authorized.

## 6. Acceptance and review

Required proof: default-off and easy withdrawal; 30/90 choice before reveal; cross-device and edited-family no-repeat; one weekly draw; no clock reset; exact lost-response recovery; pre/after-deadline answer boundaries; background/route/identity closure and missed-event expiry; exhausted bank; wrong-answer learning; no answer leakage; pause/void/Off; complete admin paging; own deletion; and truthful unknown/network states. Add meaningful actor and UI tests, then full pnpm check and updated feature gates. Native/web interruption and screen-reader behavior require actual device/browser review.

Owner review covers recommended server bank, sports-first optional topic mix, weekly opt-in invitations, 30/90 timing, interruption closure and equal private participation badges. This draft records recommendations for a concrete decision. Approval starts the implementation-plan and admin-first work; it does not authorize hosted SQL, launch, provider spending, merge or push.
