# Workout challenges: preset responses, "I did it" replies and friendly challenges (CHAL-01)

**Owner request (2026-10-15):** when athletes post workouts, fans can respond in the same spirit — "challenge
accepted", "I love this workout" — tag their own video doing it, and run friendly challenges with each other. It starts
on public posts, and the same features carry into the Vault for subscribers later. The owner approved the recommended
order and said "go": (1) public workout challenges, (2) Vault lock-down, (3) a season pass and subscriber-only posts,
(4) digital perks, (5) adult public-event posts after counsel. This document covers step 1 only.

Chain: owner → CTO → ENGINEERING → `HIGHLIGHTS` (owner) with `UPLOAD`, `PROFILE`, `ADMIN`.
Reviews: `MINOR_SAFETY`, `PRIVACY_ENGINEERING`, `RLS_SECURITY`, `CONTENT_RIGHTS`, `MODERATION`, `VOICE`, `SUPPORT`,
`DATA_GOVERNANCE` and the infrastructure seat.

**Shared files.** PLAY-01 holds `components/Reels/ReelCard.tsx`, `lib/reels.ts` and the scoped Reels helpers. Challenge
pieces live in new files (`components/Challenges/`, `lib/challenges.ts`). The accepted current mount is the dedicated Beyond legacy workout list; existing ReelCard and player/controller remain untouched.

## 1. Preset responses

- **Where:** any public Highlight in the `train_like_me` category.
- **Presets:** "Challenge accepted!", "Love this workout", "I'm in" and "Done it! 💪". There is no free text: the
  standing rule of no athlete↔fan messaging (LEGAL row S) stays.
- **Who can respond:** signed-in, trivia-style eligible accounts (13+, not closed). Each account can hold one response
  per post, which it can change or remove. Limit: 50 responses per account per day.
- **What people see:** counts per preset ("Accepted by 24"). Never a list of who responded. The athlete sees the same
  counts.

## 2. "I did it" reply videos

- **Posting:** from the workout post, "Post your try" opens the existing upload composer in **reply mode**. The clip is
  stored as a Highlight with `reply_to_reel_id` and category `train_like_me`. The uploader is the person in the video
  ("This is me"); the athlete is not tagged.
- **Captions:** preset only — "Challenge accepted!", "Done it!", "My version", "Round two". A free-text caption on a
  reply would become a message to the athlete.
- **Unchanged upload rules:** the footage / sound / marks confirmation, size limits, and the report reasons with
  immediate hide for inappropriate footage.
- **Visibility:** governed by the uploader's PRIV-01 Highlights audience, with blocks respected both ways. For 13–15
  accounts, replies are visible to friends at most.
- **Where replies appear:** under the workout post ("24 tries") and on the uploader's profile, only for viewers who are
  allowed to see them. Never in the main feed, Spotlight, leaderboards or Aura boards.
- **No Donate, no ranking:** replies show no Donate button. There is no ranking of tries, by speed, form or likes.
- **Control:** the athlete can **hide** any reply from their post (it stays on the uploader's own profile). The uploader
  can delete theirs. Admins moderate through the existing review desk.
- **Reward:** posting a try earns a private, noncash **Challenge finisher** badge, the same for everyone.

## 3. Friendly challenges between fans

- **"Challenge a friend"** sends a preset activity nudge — "{name} challenged you to {athlete}'s workout" — to one
  accepted friend (PRIV-01 two-way friends). Blocks are respected.
- **Limits:** 5 nudges per day, and 1 per friend per post. The recipient can mute nudges.
- **No free text, no chat.** MINOR-01 teen friend rules already govern who can be friends.

## 4. Admin (built first)

The Highlights / review desk gets:
- a `challenges.enabled` switch (off);
- counts per workout post (responses by preset, tries, nudges) — aggregate only;
- a replies moderation view (hidden by athlete, reported, removed), with restore and remove actions that need a reason;
- the preset lists, fixed in code and SQL;
- retention: nudges deleted after 30 days.

## 5. Later steps (not in this build)

- Subscriber-only workouts and replies inside the Vault. This needs the Vault lock-down (private storage, short-lived
  links) and the season pass first.
- Digital perks for subscribers.
- Adult-only public-event posts, after counsel.
- **Announcements guardrail (owner-approved):** athletes under 18 never post in-person times or places, including in the
  Vault. Adults may post public events at public venues only, with admin review.

## 6. Design review (2026-10-15) and owner decisions — adopted (overrides §1–§5 where they differ)

Panel: MINOR_SAFETY (lead), PRIVACY_ENGINEERING, RLS_SECURITY, CONTENT_RIGHTS, MODERATION, VOICE, SUPPORT,
DATA_GOVERNANCE, HIGHLIGHTS / UPLOAD and the infrastructure seat. All seats returned CHANGES NEEDED.

**Owner decisions (2026-10-15):**
- **Split.** CHAL-01 is **1a**: preset responses, friend nudges, badges and the admin desk. "I did it" try videos become
  **CHAL-01b**, built only after the Vault lock-down (private storage, short-lived links).
- **Teens.** When tries open, 13–17s may post them: friends-only (13–15 can't loosen it) and pre-checked by an admin
  before anyone except the teen and their guardian sees them.

### 1a — built now

1. **Dependencies.** The server refuses to switch on `challenges.enabled` unless PRIV-01 (friends, blocks) and MINOR-01
   (age bands) are present. Eligibility is an exact SQL check: signed in, not closed, age band known. `unknown` and
   `not_given` count as 13–15.
2. **Responses.**
   - Allowed only on listable, non-Vault, non-Exclusive `train_like_me` Highlights.
   - Presets: "Challenge accepted!", "Love this workout", "I'm in", "Did it! 💪". One per account per post,
     changeable. 50 distinct workouts per rolling24hours; removing a response or deleting a reel does not refund quota.
   - Counts are hidden below 5.
   - On a minor athlete's post, only the athlete and their guardian see counts.
   - Responses from blocked or closed accounts don't count.
   - Never a list of who responded.
3. **Nudges.**
   - Text: "{name} invited you to try {athlete}'s workout". Sent only to accepted two-way friends, shown in Activity
     only, never as a push.
   - Limits: 5 per day, and at most 1 per pair per day across all posts. Counters live on the server and are
     race-safe.
   - The recipient can mute everyone or one sender; a block also mutes. The sender never learns about a mute or block.
   - Nudges are deleted after 30 days.
4. **Per-athlete switch.** "Allow challenges on my workouts" is off by default for minor athletes. Changing it logs a
   guardian supervision event. The guardian summary shows counts only (nudges received in the last 7 days).
5. **Badge.** "Challenge finisher" is earned in 1a by responding "Did it! 💪" on 3 different workouts. It is private and
   noncash. (In 1b, posting a try also earns it.)
6. **Data and access.**
   - New tables `challenge_responses`, `challenge_nudges`, `challenge_mutes`, `challenge_badges` and a per-athlete
     setting, durable response quota and restricted admin event/hold data.
   - RPC-only; no direct client writes. The "Closed accounts" policy, revokes and pinned `search_path`.
   - Entries in `data-ownership.json`, DATA_MAP and DATA_PRIVACY_MAP; included in export and erasure.
7. **Admin (built first).**
   - The `challenges.enabled` switch (off; refused while dependencies are missing).
   - Per-post aggregate counts: responses by preset, nudges.
   - A nudge-abuse view: counts per sender, with a mute or suspend action that needs a reason.
   - Retention action.
8. **App.** A `components/Challenges/ChallengeBar` with the preset chips, counts and "Invite a friend". The dedicated Beyond legacy workout card mounts it and links viewing/support to the established athlete profile. Nothing in PLAY-01's claimed files is changed.
9. **Copy.** As above. "Done it!" is renamed "Did it! 💪". Run `copy:check`.

### 1b — after the Vault lock-down (recorded now so nothing is lost)

- **Writing tries.** Only through a SECURITY DEFINER `post_challenge_try`. It forces no athlete, game or tags; Vault and
  Exclusive off; category `train_like_me`; no replies to replies. The parent post must be a listable, public workout.
- **Storage and serving.** Private storage, with short-lived links from `get_challenge_tries(parent)`, which applies
  audience, blocks and the parent post's visibility.
- **Kept out everywhere else.** `reels_feed` excludes tries (`reply_to_reel_id is null`), and so do Spotlight,
  leaderboards, the Aura and filmer boards, hype, views and search.
- **Fast hide.** "Inappropriate" hides a try at once. So does a report from the parent post's athlete or guardian, or
  from the uploader's guardian.
- **Minors.**
  - 13–17 friends-only, and pre-moderated with a 24-hour target until the CSAM pipeline exists (LEGAL row E).
  - Accounts hidden from search never appear to non-friends.
  - The guardian summary shows tries posted, hidden and reported.
- **Video handling.** Strip location metadata from video before upload. Refuse a reply-mode upload when the compressor
  is unavailable. Device QA on real phones.
- **Rights.** A people line ("Only I'm in this video, or everyone in it said yes."), the sound line, and a Terms line
  that Train Like Me posts invite tries. Original audio muted by default (optional suggestion, adopted).
- **Takedown and support.** A takedown path for parents without an account (LEGAL row U); neutral wording when an
  athlete hides a try; reasons on every restore or remove; a runbook.
- **Composer.** Reply mode in the composer through `lib/challenges.ts`, not `uploadSekiPlay`.
- **Limits.** A per-post cap on tries, and accounts must be 24 hours old (optional suggestions, adopted).
- **Cost.** The storage cost is assessed with the video host decision (STATE §6 item 2).
