# Trivia, play together: rounds of five, family challenges, sport cards, badges and new question types (QUIZ-03)

**Owner request (2026-10-14):** keep building Codex's trivia (QUIZ-02) and make it fun for fans and the families of student
athletes. Owner choices the same day:

| Question | Decision |
| --- | --- |
| What to build | **All four:** starter question bank, **Learn your athlete's sport** card, **Family challenge**, **Badge shelf and season recap** — plus "others can play trivia with each other" |
| Pace | **A weekly round of five** (still one weekly opportunity; each round has five timed questions with the same 30 / 90-second choice) |
| Future | Questions beyond text: **images** and **different question types** to increase engagement |

Builds on QUIZ-02 ([proposal](TIMED_TRIVIA_PROPOSAL.md), [ledger](../../agents/QUIZ-02.md)); keeps its rules: invitations
default off, explicit Start, server clock and deadline, leaving ends the round, no repeat for the same account, equal
private badges right or wrong, no money / Aura / speed ranking, paused / testing-only / empty cohort until the owner
releases it. Chain: owner → CTO → ENGINEERING → `POLLS` (owner of QUIZ-03) with `ADMIN`, `AURA` (badges), Content
(question review), `INFRASTRUCTURE` (capacity / integration); reviews `MINOR_SAFETY`, `PRIVACY_ENGINEERING`,
`RLS_SECURITY`, `SUPPORT`, `QA`, `DATA_GOVERNANCE`, `VOICE`.

## 1. A weekly round of five

- One weekly opportunity per account (UTC week), as before. Start issues **question 1 of 5**; each question gets its own
  server deadline (30 or 90 seconds, chosen once before Start); answering (or the deadline passing) reveals the
  explanation, then **Next** issues the following question. No question is issued before the previous one is
  answered or expired.
- Leaving the trivia page, backgrounding, switching account or End round ends the **whole round**; questions not yet
  issued are not counted as seen (they stay in the pool). Issued questions count as seen, as today.
- Result: "You learned 4 new facts" — every answered question counts as learning; correctness is shown privately per
  question, never as a score, rank or speed. One Trivia Explorer badge per completed round (unchanged limit: one per week).
- If the pool has fewer than five unseen questions in the chosen topic, the round is shorter and says so; it never
  repeats a question.

## 2. Question types (built for the future, safely)

| Type | Now | Notes |
| --- | --- | --- |
| `choice4` | Yes (existing) | Four choices |
| `true_false` | **Yes** | Two choices: True / False |
| `image_choice` | **Ready, switched off** | A question shows one reviewed image (`media_ref` = `sb:quiz_media/<path>`, resolved through `lib/media.ts`). Images are limited to **non-person** pictures (equipment, fields, courts, diagrams, landmarks) with recorded rights until Content Rights and Minor Safety approve people images; the admin switch `trivia.images` stays off until then |
| Ordering, matching, "who said it", short video | Later | Each needs its own review; noted for the roadmap |

The answer stays an index into the options; the server still never sends the answer before the commit.

## 3. Learn your athlete's sport

A card on an athlete's profile: **"Learn {sport} with {first name}"** → opens trivia preparation with that sport preselected
(sports topic, sport filter). Shown only when trivia is available to the viewer and the sport has approved questions.
It uses the viewer's own weekly round — no extra opportunity, no link between the athlete and the viewer's answers, and
nothing about the viewer is shown to the athlete.

## 4. Family challenge (play together)

- Any eligible account can **create a group** (a family, friends, a team's fans) and gets a one-time-style **group code**
  (8 characters, valid 7 days, renewable by the creator). Others join by entering the code; **max 12 members**. There is
  no search for groups and no way to list members of a group you are not in.
- Each week the group shares a **theme** (a sport or topic the creator picks; default "all sports"). Members play their
  own weekly round in that theme; questions are drawn so members **share the same questions where each member has not
  seen them** (a group question set of five, filled from the bank; members who have seen one get a replacement).
- The **group page** shows each member's first name (or username), whether they played this week, facts learned this
  week and season, and their visible badges — **never answers, correctness, speed or ranking**. A gentle "Everyone
  played!" moment when all members finished.
- Safety: no messaging; leave any time; the creator can remove a member; **a block between two accounts keeps them out
  of the same group** (joining is refused with the ordinary message; an existing shared group removes the newer member);
  teen accounts can join groups, but only by code, and their name shows as first name only. Group codes are
  rate-limited like guardian codes. Adults cannot find teens through groups.
- Live head-to-head play (everyone answering at the same moment) is a later capability (needs Realtime capacity review
  by `INFRASTRUCTURE` and `REALTIME`).

## 5. Badge shelf and season recap

- **Badge shelf:** your private badges — Trivia Explorer (weekly), **sport explorer badges** (e.g. "Basketball Explorer"
  after learning 5 facts in that sport), **Family Challenger** (played a group week), **Season Learner** (10 rounds in a
  season). You choose which badges are visible to your groups; nothing is public by default.
- **Season recap:** "This season you learned 23 facts across 4 sports" with per-sport counts. Private; a season is a
  calendar quarter until the product defines sport seasons.
- Badges remain noncash recognition: no Aura, money, votes or reach.

## 6. Starter question bank

About 60 draft questions across the supported sports (rules and terminology, low risk of factual drift) plus a small
science / geography / fun set, as `choice4` and `true_false`, each with source notes. They are inserted as **drafts**;
Content approves each in the admin desk before anyone can be asked it. The 100-version cap is raised to **300** with a
recorded capacity note (`INFRASTRUCTURE`: text rows are tiny; review effort is the real cost).

## 7. Admin handling (built first)

Sport-quiz desk additions: question type and image fields (images refused while `trivia.images` is off); round
settings (questions per round, default 5, range 1–5); group overview (counts only: groups, members, active this week,
codes made — **never member names or answers**); group removal for a safety case (by group id from a report, SQL Editor
style like `admin_end_friendship`); badge and recap totals. Switches: `trivia.groups` pauses new groups and joins
without touching existing data; `trivia.images` gates image questions. Retention: group membership ends when a member
leaves; empty groups and expired codes are purged by the desk's retention action.

## 8. Not in this build

Live synchronous play; people images; ordering / matching / video questions; public leaderboards (never planned);
push notifications (SCALE-07); any reward of value.

## 9. Design review (2026-10-14) — changes adopted (these override §1–§7 where they differ)

Panel: POLLS, MINOR_SAFETY, PRIVACY_ENGINEERING, RLS_SECURITY, CONTENT_RIGHTS, INFRASTRUCTURE seat (reviewed as
COST_OPERATIONS / RELIABILITY in this worktree — the `INFRASTRUCTURE` role and `lib/media.ts` exist in the main tree's
uncommitted work and arrive at the coordinated merge), SUPPORT. All CHANGES NEEDED → adopted:

1. **Round items.** The attempt stays the round; new `sport_quiz_round_items(attempt_id, position 1–5, question_id,
   issued_at, expires_at, answered_option, answered_at, status)`. Round states add `between` with a `next_by` deadline
   (about 2 minutes after an item closes) so the read-only snapshot can compute effective expiry. Each item's deadline is
   checked under `quiz_lock`.
2. **Next has exact recovery**: request UUID + expected position + the round's session secret; a replay returns the same
   item only before its deadline.
3. **Week boundary:** Start is refused unless five items × duration + gaps fit before the UTC week ends; Next re-checks.
4. **Per-item void and badges:** a correction voids one item, not the round; a completed round = at least one committed
   answer, so a round ended early keeps its badge. Badges become `unique(profile_id, label, period)` with new labels.
5. **Question types:** `question_type` (`choice4` | `true_false` | `image_choice`), 2–4 options, the answer index bounded
   by the option count; type and media fields join the immutability trigger.
6. **Group themes are sport filters only** (the 4-sport / 1-fun slot rule stays for personal rounds); one completed round
   in a week marks the member "played" in every group they belong to; a member plays the group's shared set only by
   starting from that group's page.
7. **Joins follow MINOR-01's teen rules both ways:** for every teen in the group (and a teen joining), each other member
   must be acceptable under that teen's friend-request setting — `teens`: other teens, a linked guardian or an accepted
   friend; `nobody`: a linked guardian or accepted friend; `everyone`: anyone eligible. No block between the joiner and any
   member. Otherwise the ordinary "That code didn't work" message.
8. **Codes like guardian codes:** stored hashed; 10 wrong tries / day / account, 5 joins / day; an account creates at most
   3 groups and belongs to at most 5; the code stops working when the group is full and rotates when a member is removed;
   a removed member cannot rejoin that group. **Preset group names only** (no free text).
9. **Guardian view:** MINOR-01's supervision summary adds "trivia groups: n" and joined / left events — counts only, the
   same for teen and guardian; no group pages.
10. **No household leaderboard:** the group page shows a played-this-week mark per member (no times) and group totals
    only; per-member visible badges stay opt-in.
11. **Shared set without leaking history:** each group-week set is drawn at random without reading members' exposures; a
    member who has seen one of them gets a private replacement; replacements and overlap are never shown.
12. **Erasure / export / retention:** `quiz_erase_history` also removes group participation, group-week sets and visible
    badges; the group page is built from live rows; new tables go to `data-ownership.json` and `DATA_PRIVACY_MAP`; group-week
    sets purge at week end + 35 days; code hashes purge on expiry; a deleted creator hands the group to the oldest member,
    or it dissolves.
13. **Blocks remove the blocked party** (with the creator-removal message); `is_blocked_between` is part of every group
    read and join.
14. **RPC-only access** (no table grants); lock order settings → group → account → attempt; an advisory lock per group
    stops two shared sets being created at once.
15. **Images deferred in delivery:** schema and admin validation only, switch off; a private `quiz_media` bucket with
    admin-only writes and short-lived signed URLs inside the active-item response is a separate later step. Required rights
    record: licence type, source, attribution shown to players, reviewer; no school / league marks; no identifiable person
    anywhere in the frame; EXIF stripped; admin uploads only; alt text required and must not reveal the answer; ≤ 300 KB; a
    rights complaint voids the version per item.
16. **Bank capacity:** the 300 cap counts only draft and approved versions; the admin desk forecasts weeks until each sport
    runs out at the current pace.
17. **Support:** say before Start and in "Round ended" that leaving during an explanation ends the round; a **Report group**
    action carries the group id; an audited admin case view shows member ids, age bands and join-refusal reasons (admins
    only); TROUBLESHOOTING entries for lost Next, short rounds, expired / full / refused codes, removal, voided items, erasure
    and guardians asking about a teen's groups.
