<!-- Troubleshooting follows observed SDK sources; stale processes need restart after dependency repairs. -->
# Tapua'i Diagnostic & Troubleshooting Playbook

Pair with [docs/ONBOARDING.md](../ONBOARDING.md). Prefer running [`apps/mobile/src/backend/db/schema.sql`](../../apps/mobile/src/backend/db/schema.sql) over one-off policies when the project is empty. This is a **pnpm monorepo** — run Expo from the repo root with `pnpm mobile`.

---

## 0a. Metro: `This operation was aborted` at `http.js:105`

An unfinished browser response closing cancels Expo's server-render request. SDK58's
Router Server previously let the pre-shell cancellation reach Metro's error logger/overlay.
[METRO-01](evidence/METRO-01.md) patches that exact request-correlated cancellation;
genuine errors and static export failures remain visible. The versioned dependency patch
ships through root pnpm configuration; no app exception filter is needed.

Stop the old Metro terminal with Ctrl+C, then run `pnpm mobile` from the root on Node24
and reload the app/browser. Existing processes keep the old module in memory. Run
`pnpm metro:test` to check installed patch behavior. If it recurs, retain the redacted
full stack/platform/navigation steps for SUPPORT; a different AbortError needs its own trace.

---

## 0. Unable to resolve `../../App` from `expo/AppEntry.js`

**Cause:** Metro was started from the **repo root** (`npx expo start`) after the monorepo move. Root has no Expo Router `main`; Expo falls back to `AppEntry` looking for a root `App` file.

**Fix:** Stop that Metro process (Ctrl+C). From the repo root:

```bash
cp -n .env.local apps/mobile/.env.local   # once, if you still have a root env
pnpm mobile
```

Or `cd apps/mobile && pnpm start`. Reload Expo Go. Do not use `npx expo start` at the workspace root.

---

## 0b. Expo CSS error: `Cannot find module '../lightningcss.darwin-arm64.node'`

Lightning CSS first loads its platform package. Its loader catches **any** error from
that load and then tries a fallback file; the fallback error can hide a macOS `dlopen`
or quarantine problem. Diagnose the platform package from Expo's dependency context,
not an unrelated copy at the workspace root:

```bash
node - <<'NODE'
const { createRequire } = require('node:module');
const path = require('node:path');
const app = createRequire(path.resolve('apps/mobile/package.json'));
const metro = createRequire(app.resolve('@expo/metro-config'));
const css = createRequire(metro.resolve('lightningcss'));
const binding = css.resolve(`lightningcss-${process.platform}-${process.arch}`);
console.log(process.version, process.platform, process.arch, binding);
require(binding); // Exposes the original native loading error.
console.log(metro('lightningcss').transform({
  filename: 'launch-check.css', code: Buffer.from('.card { display: flex; }'),
}).code.toString());
NODE
```

If the resolved file has `com.apple.quarantine`, inspect it with `xattr -l` and remove
that attribute from the specific trusted installed file with
`xattr -d com.apple.quarantine <resolved-file>`. Do not clear attributes across the
workspace or replace a binary with a different package version. A genuinely absent
binding needs the matching platform package; a successful transform needs a fresh
Metro process rather than an unproven reinstall.

Stop the old Metro process, then run from the repo root:

```bash
pnpm --filter @tapuai/mobile start --clear
```

**2026-10-12 evidence:** both installed Lightning CSS versions loaded and transformed
CSS before repair, so the historical first error was not reproduced. Seven installed
native files had regained Firefox quarantine, which was removed narrowly. Fresh
Metro with the current packages served web and iOS bundles and the browser rendered
the app shell. Restart after replacing `node_modules`; an earlier cleanup does not
survive replacement files. See [AUDIT_REPORT.md](AUDIT_REPORT.md) for verification limits.

**2026-10-13 recheck:** the current Expo/Metro dependency-context transform and fresh
Metro worker transforms for global CSS and CSS modules pass. The matching 1.33.0
ARM64 binding has a valid signature and no quarantine attribute. No package reinstall
or attribute removal was needed for PLAY-01; do not infer a missing binary from an old
screenshot when the current binding works.

---

## 1. Empty roster / “No player found”

**Cause:** RLS without a public `SELECT` on `players`, missing seed rows, or the wrong athlete route (`/player/:id` vs `/athlete/:id`).

**Fix (players read):**

```sql
alter table public.players enable row level security;

drop policy if exists "Public read players" on public.players;
create policy "Public read players" on public.players
  for select using (true);
```

Then confirm rows exist (`select id, name from public.players limit 5`).

---

## 2. Empty Local games

**Cause:** Missing `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env.local`, `games` not seeded, or `is_active = false`.

**Fix:** Restart Expo after `.env.local` edits. Seed from `schema.sql` or `supabase/games.sql`. Realtime: add `public.games` to `supabase_realtime`.

---

## 3. Metro `transformFile` undefined

**Cause:** Babel cannot resolve `babel-preset-expo` from `apps/mobile/`.

**Fix:** Confirm `apps/mobile/babel.config.js` has `presets: ['babel-preset-expo']`, run `pnpm install` at the repo root, then `pnpm mobile` (or `pnpm --filter @tapuai/mobile start -- --clear`).

---

## 4. Reel crash / black video

**Cause:** `expo-av` player or `useCaching: true` on `expo-video`.

**Fix:** Playback through `expo-video` only. The app already calls `clearVideoCacheAsync` on the Reel tab. `expo-av` may remain in `package.json` — do not import it for the feed.

---

## 4a. Browsing errors: aborted play / unsuitable media

**Two separate failures:** Expo Video 57.0.5 web discards the promise from DOM
`video.play()`, including replacement/replay/follower calls. Rapid pause/replacement
can reject that promise with AbortError; unsupported media can reject it with
NotSupportedError and emit media error 4. A caller's try/catch around public
`player.play(): void` cannot catch a discarded asynchronous rejection.

PLAY-01 registers a versioned web-only dependency patch through root pnpm
`patchedDependencies`. `pnpm install --frozen-lockfile` reapplies it; do not remove
the patch or copy arbitrary binaries over installed packages. Reassess the patch on
an Expo Video upgrade. The app serializes replacement and checks current-source
readiness/focus before playback; failures show **This Highlight couldn't play.**
and **Retry**. Expected pause/replace aborts and browser autoplay refusal are
nonfatal; actual source failures remain visible. There is no global error suppression.

Use a valid local video to distinguish lifecycle failure from invalid hosted media.
Retry cannot fix a missing, corrupt or unsupported file. The existing hosted legacy
clip emitted browser media error 4 in this pass; its current response metadata and
codec were not inspected because automatic approval review blocked that separate
probe. Route hosted file validation/replacement to STORAGE without claiming that
the player patch repairs the object. Evidence: [PLAY-01](../agents/PLAY-01.md).

---

## 4b. Expo Go SIGABRT on iOS Simulator (`UIImagePickerController setMediaTypes:`)

**Cause:** Upload **Record** opens the legacy camera picker with `mediaTypes: videos`. The Simulator has no `public.movie` camera types, so UIKit aborts the whole Expo Go process.

**Fix:** Reloaded Metro with the current `UploadVideoModal` — Record shows an alert on Simulator. Use **Library**, or Expo Go on a phone. Do not tap Record on Simulator with an older JS bundle.

---

## 5. Upload fails

**Cause:** Missing Storage bucket `reels` (or fallback `game_highlights`), or upload without a tagged player / caption. Tagging a game is optional (no longer required).

**Fix:** Run the canonical `apps/mobile/src/backend/db/schema.sql` (2026-09 — it now creates the `reels` / `game_highlights` / `avatars` buckets and their policies itself; `supabase/reels.sql` / `supabase/media_upload.sql` are still safe to run afterward on an already-hosted project, just no longer required on a fresh one). Confirm buckets `reels` and `game_highlights` are public and policies allow SELECT + INSERT on `storage.objects`. Profile photos need bucket `avatars` and `profiles.avatar_url`.

---

## 6. PaymentSheet never opens / payment 500

**Cause:** Web stub (`stripe.web.ts`); `STRIPE_SECRET_KEY` not set as a Supabase secret for the `create-payment-intent` Edge Function (or, for the Metro fallback only, not loaded into the shell); amount &lt; 50 cents; missing or expired session JWT (401).

**Fix:** Expo Go on iOS/Android. Sign in (Soft-Wall). Set the secret with `supabase secrets set STRIPE_SECRET_KEY=...`; never in `.env.local` (Expo logs loaded env values), never as `EXPO_PUBLIC_STRIPE_SECRET_KEY`, never under `apps/mobile/src/frontend/`. The client calls Edge `create-payment-intent` first; JWT `POST /api/create-payment-intent` is the Metro fallback and needs the key loaded into the shell (`set -a; source ~/.config/ala-sports/stripe-secret.env; set +a`).

---

## 6b. Connect Bank Account does not open / flags stay false

**Cause:** Missing `STRIPE_SECRET_KEY`; `profiles.stripe_onboarding_complete` column not applied; web popup blocked (`ERR_WEB_BROWSER_BLOCKED`); Express onboarding left unfinished (`details_submitted` is still false).

**Fix:** Re-run `supabase/stripe_connect.sql`. Restart Metro after env changes. Use Expo Go so `openAuthSessionAsync` can return to `alasports://stripe-connect`. Complete the Stripe Express form; dismiss still re-fetches account status.

---

## 7. Aura / leaderboard does not move after Mālo

**Cause:** Guest session (no `user.id` → RPC skipped); `add_user_aura` not applied; covering the $0.50 fee does not add Aura.

**Fix:** Run `supabase/add_user_aura.sql`. Sign in. Leaderboard reads `profiles.aura_points` — incremental SQL does not create `profiles` (use canonical `schema.sql`). Empty `profiles` falls back to dev personas in the UI.

---

## 8. Athlete HQ Mālo list stays empty

**Cause:** `useTipCheckout` never inserts `public.tips`. Profile/HQ `select * from tips` will not grow.

**Workaround:** Treat `players.backer_count` and `reels.total_tips_cents` as the live counters until a ledger insert is added.

---

## 9. Cheer poll does not save

**Cause:** Table is SELECT-only. Votes must go through `cast_cheer_vote`. Missing execute grant or Realtime publication.

**Fix:** Run `supabase/cheer_polls.sql`. Add `cheer_polls` to `supabase_realtime`.

---

## 10. Operator cannot save score / clock

**Cause:** RLS blocking `games` UPDATE, or not on `/operator/console/[gameId]`.

**Fix:** Demo policies allow `anon` updates (see `schema.sql`). Confirm `EXPO_PUBLIC_SUPABASE_*` and that the claimed game `id` matches. PIN is `OPERATOR_TEST_PIN` in `apps/mobile/src/frontend/lib/operator.ts`.

---

## 11. Workout challenges say "not switched on" (CHAL-01)

**Cause, in order:** (1) `supabase/migrations/20261016100000_workout_challenges.sql` is not applied, so the Highlights desk → Workout challenges panel and every challenge call say "not switched on"; (2) it is applied but the admin switch `challenges.enabled` is off (the default; counts return `enabled: false`, Activity shows no invites); (3) the switch is refused: the panel lists what is missing — PRIV-01 (`20261014090000`) and MINOR-01 (`20261014110000`) objects, the guardian summary count or the "Closed accounts" policy on the challenge tables.

**Fix:** Apply PRIV-01 and MINOR-01 first. If the challenges file went in before them, run it again (it is safe to re-run) so it adds the guardian summary count and the "Closed accounts" policy; the switch then accepts. Switch on from Highlights → Workout challenges with a reason. A post still shows no chips when it is Vault, Exclusive, not Train Like Me, removed, its tag is not approved, the athlete has no verified account, or the athlete has challenges off (off by default for minors) — `challenge_counts` returns that reason. An invite that "sent" but never arrived was dropped on purpose (the friend muted the sender, a block, or an admin hold); the sender is never told. Replay: `node scripts/replay/workout-challenges-replay.mjs <pglite dist>`.
## 11. Trivia rounds and family groups (QUIZ-03)

Migration `20261014160000_trivia_play_together.sql` (not applied anywhere yet). Admin desk: `/admin/sport-quiz`.

- **Lost Next (spinner, then nothing).** Next is safe to retry with the *same* request: the server returns the same
  question only before its deadline. A new Next request cannot fetch it (`quiz_next_not_ready`). If the question's
  time ran out, the round waits 2 minutes for Next and then closes; answered questions keep their badge.
- **"Your round was shorter" / fewer than five questions.** The round only uses questions the account has not seen
  in that topic or sport, and never repeats. Check the desk's *Bank forecast by sport*; approve more questions there.
  The admin may also have set fewer questions per round (*Rounds and switches*).
- **"Round ended" after leaving during an explanation.** Leaving the trivia page, backgrounding the app, switching
  account or End round ends the whole round, including while an explanation shows. Unissued questions stay unseen;
  the weekly opportunity is used. A round with at least one answer still counts as completed.
- **Start refused near the end of the week (`quiz_week_closing`).** The whole round (questions plus Next windows)
  must finish before the UTC week ends; try 30 seconds or wait for the new week.
- **"That code didn't work."** The same message covers a wrong, expired or rotated code, a full group (12), a
  removed member, a block with someone in the group and the teen friend-request rule. Admins can see the exact
  reason in the audited group case (*Group case* on the desk, with a reason). 10 wrong tries a day, then the
  account waits; 5 joins a day; at most 3 groups created and 5 belonged to.
- **Removed from a group.** The member sees the ordinary removal message whether the creator removed them, a block
  did, or an admin did; they cannot rejoin that group. Blocking someone removes the blocked person from shared groups.
- **A question was voided.** A correction voids one question in each round, not the whole round. The round (and its
  badge) is voided only when no answered question remains. History shows the correction reason privately.
- **Clear history and groups.** Clearing trivia history leaves every group (the oldest member becomes creator, or
  the group closes), removes every badge and ends this week's opportunity. Join attempts stay for their 35 days, so
  clearing history does not reset the 10-tries / 5-joins limits. A removal record stays, so a removed member still
  cannot rejoin.
- **Removed after an age, setting or friendship change.** Teen rules are re-checked when an account corrects its
  birth month, a teen changes who can send friend requests, a friendship ends, a guardian link ends, or someone has a
  birthday (checked when the group page opens or a group round starts). The account that no longer fits gets the
  ordinary removal message (reason `teen_rule` in the case view); it can rejoin later only if the rules allow. A closed
  (under-13) account leaves every group and never shows.
- **Group facts show "—".** Group fact totals appear once 3 members have played this week and are rounded down to 5s,
  so nobody can work out one member's count.
- **Image question cannot be approved.** A different admin must record the rights review (marks, EXIF, licence)
  first, and `trivia.images` must be on.
- **A guardian asks about a teen's groups.** The guardian view (Parent HQ / supervision) shows only a count of the
  teen's trivia groups and joined / left events, the same as the teen sees. Support never shares group names, members
  or pages; a safety concern goes through *Report group* and the admin case view.
- **Groups switched off.** `trivia.groups` off pauses new groups, joins and group rounds; existing groups stay
  readable and members can still leave and report.

## 12. Life Playbook and round kinds (QUIZ-04)

Migrations `20261014180000_life_playbook.sql` and `20261014190000_life_playbook_bank.sql` (not applied anywhere yet). Admin
desk: `/admin/sport-quiz` → *Life Playbook* panels. Before the migration is applied the desk says "not switched on".

- **"Week spent" after playing a group round.** Each week has three separate opportunities: personal, group (one across
  all groups) and Life. Only one round can be open at a time (`quiz_round_active`); finish or leave it first.
- **`quiz_end_invalid` from End.** End now takes the round kind (`p_round_kind`); it must match the round being ended.
- **Group round refused (`quiz_group_too_small`).** A group round needs at least two active members.
- **A member played but the group page says not played.** Only group rounds count on group pages and for Family
  Challenger; personal and Life rounds never do.
- **Life Start refused.** `quiz_life_paused` = `trivia.life` is off; `quiz_life_not_opted_in` = the player has not opted
  in; `quiz_notice_required` = the Life notice (or the trivia notice) is not accepted; `quiz_no_question` = no unseen
  question in an open chapter.
- **A chapter will not open ("needs N more approved questions").** Since the owner simplification (2026-10-15) a
  chapter opens once it has 5 approved questions (one round). Approve more drafts in that chapter, then open it.
- **Approval refused.** One admin approves a Life question the same way as sports trivia (no reviewer grant, CPA
  sign-off, source link or tax year any more). `quiz_life_attestation_required` = tick the education-only attestation
  in a new version; `quiz_life_copy: …` = the Life copy rules in `supabase/content/life_copy_rules.json` (version 4).
  Rule names: `non_latin_text` (lookalike letters such as Cyrillic), `advice_you_should`, `brand_name`,
  `tapuai_money_word`, `nil_eligibility`, `tax_loan_credit` (tax, loan, credit score, APR), `money_figure` (any amount,
  price, percentage, rate, "k" / "grand" / "million" figure — there is no illustrative exception), `year`,
  `scam_missing_report_line` (Scam Defense explanations end "Tell a trusted adult and use Report."), `prompt_too_long`
  (over 120 characters), `explanation_too_long` (over 200). Macrons are ignored when matching ("dōnation" is a money
  word); spelled-out or glued figures count. Rewrite the item as a simple fact without numbers.
- **`quiz_rerun_after_quiz04` while applying SQL.** `20261014160000_trivia_play_together.sql` must not be re-run alone
  after QUIZ-04 (it would replace QUIZ-04 functions). Re-apply `schema.sql` (it re-runs the QUIZ blocks together in one
  transaction; a failed paste rolls back) or write a forward migration.
- **`quiz_request_limit`.** Each week has 20 round requests per kind (Start, Next, answer, End) and 111 ordinary saves
  (preferences, invitation, skip); a flood of saves cannot block a Start. Past a budget only one reserved answer and one
  End per kind remain. A cancel of a kind the account could not start (Life without access, group without a group)
  returns `quiz_round_closed` and writes nothing.
- **Intentional (design §7 item 14).** Clearing history spends all three weekly opportunities and keeps the Life
  opt-in; Trivia Explorer and Season Learner count Life rounds (personal rounds earn them too).
- **Level did not drop after a correction.** Levels keep the highest value reached; only clearing history removes them.
- **A 13+ account without a birth month cannot play sport trivia but can play Life.** By design: `not_given` / `unknown`
  accounts can play Life (every chapter is 13+); sport and group trivia keep the QUIZ-02 age bands.
- **Drafts to review counts say "(loaded so far)".** The database does not send `bank_counts` in `quiz_admin_snapshot`
  yet (the control tower edit of `20261014180000_life_playbook.sql` is not applied), so the filter counts and "drafts in
  this view" cover only the loaded pages; press *Load more questions to review*. With `bank_counts` they cover the whole
  bank and the line reads "in the whole bank". Chapter progress always uses the Life read's server counts.
- **Drafts to review Edit.** One atomic write (`quiz_admin_question` action `edit_replace`): the new version and the
  archive of the old draft save together or not at all. `quiz_replace_draft_only` = someone approved, archived or voided
  that draft meanwhile; nothing was saved and the list refreshes. `quiz_life_copy: …` / `quiz_life_attestation_required`
  = a Life edit must pass the word rules and attestation at save; nothing was saved. On a database without
  `edit_replace` the desk falls back to two audited steps; if the second fails it says "New version saved, but the
  earlier draft was not archived" — archive that draft by hand.

## 12b. Fresh questions: fun facts, reports, Needs a look and import (QUIZ-05)

- **Fun facts, Needs a look or Bulk import say "not switched on".** `20261015210000_trivia_fresh_questions.sql` is not
  applied (written 2026-10-15, local only). Each panel reads separately, so the rest of the desk keeps working.
- **`quiz_facts_paused` on submit.** `trivia.athlete_questions` is off (the default). Turn it on in Trivia → Settings →
  Fun facts; the share can stay 0 so nothing is drawn while the queues are tested.
- **`quiz_fact_text: …`.** The server filter refused the answer; the codes name why (`digits`, `link`,
  `handle_or_email`, `address`, `weekday_or_time`, `school_or_city`, `emoji_or_non_latin`, `not_okay_word`,
  `money_word`, `brand`, `not_on_list` for the pre-game meal, `matches_wrong_option` when it is close to a curated wrong
  choice). Plain words: `FUN_FACT_TEXT_WORDS` in `lib/freshQuestions.ts`.
- **`quiz_fact_age_needed` / `quiz_fact_athlete_only`.** No recorded birth month and year, or the account is not linked
  to a roster athlete. By design: no submissions without a recorded 13+ age.
- **A 13–15 fact stays "waiting for a guardian".** No guardian is linked (nothing asks the teen to invite one), or the
  guardian request lapsed after MINOR-01's 14 days; submitting the same prompt again resends it.
  `quiz_fact_guardian_first` = an admin tried to approve before the guardian; `quiz_fact_guardian_only` = someone other
  than the supervising guardian (including an admin through `guardian_decide_approval`) tried to decide.
- **A fun fact is never drawn.** Check: switch on and share above 0; the athlete is verified with a recorded 13+ age;
  the viewer follows the athlete (Crew) or started from the Learn card; the `fun_facts` audience allows (default friends;
  13–15 capped at friends); no block; the round is personal (never group or Life) with 2+ questions; the player-week falls
  in the share (about 1 in 3 at most, deterministic); one per athlete per viewer per month; the question is not paused.
- **Answer outcome `fact_unavailable`.** The fun fact failed the reveal re-check (audience, follow, block, switch or
  withdrawal changed after it was shown); the item is voided and the round moves on. Intentional.
- **Answers look shuffled / `answered_option` differs from what was tapped.** `quiz_answer` takes the shown position;
  the stored index is kept in `answered_option` and `stored_answered_option` on the client. Use `correct_position` (or
  the adapter's mapped `correct_option`) to highlight the shown option.
- **Approving moved the correct answer.** Approval shuffles a choice question's stored order (never true / false), so
  no path shows "correct answer first". Texts and the correct text are unchanged.
- **A question disappeared from rounds.** It was auto-paused by reports (Needs a look). Restore it there; three new
  counted reporters pause it again. After 10 auto-pauses in a topic in one UTC day, reports queue and the desk shows an
  alert instead.
- **Report outcome `paused`.** Report intake is paused in Settings; nothing was recorded. `quiz_report_not_allowed` =
  the reporter has no closed round item for that question; `quiz_report_limit` = 10 reports in 24 hours.
- **Bulk import refused rows.** `duplicate` (already in the bank, any status), `duplicate_in_batch`, `formula_cell`
  (a cell starts with `= + - @`), `athlete_row`, `image_row`, `bank_full`, `life_copy:<rule>`. `quiz_import_too_large` =
  more than 200 rows or 64 KB. Edit the paste and preview again; Import needs a fresh preview of exactly those rows.
- **`quiz_rerun_after_quiz05` / `minor01_rerun_after_quiz05` while applying SQL.** `20261014180000_life_playbook.sql`
  and `20261014110000_minor_accounts.sql` must not be re-run alone after QUIZ-05 (they would replace its fun-fact
  routing and supervision count). Re-apply `schema.sql` or write a forward migration.
- **"This request cannot be decided here."** `guardian_decide_approval` was asked to decide an approval type it does not
  know (fail closed; nothing changed). Fun-fact requests are decided by the supervising guardian through QUIZ-05.
- **`quiz_fact_admin_path` from the question bank.** Fun-fact questions are never archived or voided in the bank; use
  Needs a look → Archive (declines the fact and voids its question) or the fun-fact queue.
- **A result says `fact_unavailable`.** A fun fact timed out or was never answered and no longer passes the check (audience,
  follow, block, switch); nothing about it is shown.
