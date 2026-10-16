# Profile privacy, friends, blocking and tag approval (PRIV-01)

**Owner request (2026-10-13):** let users make their profile public or private, choose what non-friends can see,
and build the whole set of controls around it. Owner decisions the same day:

| Question | Decision |
| --- | --- |
| Who is a friend | **Two-way friends**: any two users send and accept a request. Separate from Crew (Crew stays "a fan follows an athlete"). |
| A private athlete | **Highlights and Donate stay public**: non-friends still see the athlete's name, the clips they are tagged in and the Donate button; everything else follows their choices. |
| Default for a new account | **Private for everyone** (we do not know ages; the 13+ checkbox is the only signal). |
| First-build extras | **Block specific users**, **guardian lock for minors** (replaced 2026-10-14 by supervision and approvals, see [MINOR_ACCOUNTS_DESIGN.md](MINOR_ACCOUNTS_DESIGN.md)), **hide from search**, **tag approval** — with a clear visual difference between an approved and an unapproved tag, designed so pending tags do not cost athletes highlights, Spotlight credit or donations. |

Chain of command: owner → `CTO` → `ENGINEERING` → `PROFILE` (owner of PRIV-01) with `AUTH`, `CREW`; `HIGHLIGHTS` →
`ACCOUNT_TAGS`, `UPLOAD` for tags; `LOCAL` → `DISCOVERY` for search; `SPOTLIGHT` / `LEADERBOARDS` for credit;
`ADMIN` for the admin desk. Reviews: `RLS_SECURITY` (via `SECURITY`), `PRIVACY_ENGINEERING`, `MINOR_SAFETY`
(via `TRUST_SAFETY`), `CUSTODIAL` (guardian lock), `VOICE`, `QA`, and `DATA_GOVERNANCE` for the new tables.

## 1. Why this must be enforced in the database

Today `profiles` is readable by everyone, guests included (`"Public read profiles" … using (true)`), so the existing
hide switches (bio, school, social links, stats) only hide things from the app's own screens; anyone using the API
reads them anyway. PRIV-01 therefore starts by **closing direct reads of other people's `profiles` rows** (WORK_QUEUE
P1-02): a client reads its own row; other people's profiles come only through `profiles_public` and RPCs that apply
the rules below. Every screen that reads another user's profile moves to those reads in the same change.

## 2. The rules

**Viewer relationship** (computed in SQL from the signed-in user): `self`, `admin`, `guardian` (of the athlete the
profile is linked to), `friend`, `blocked` (either side blocked the other), `stranger` (signed in, not a friend),
`guest` (signed out).

**Account setting:** `public` or `private` (new accounts: private).

**Per-item audience:** each item is `everyone`, `friends` or `only_me`.

| Item | Default (new account) | Notes |
| --- | --- | --- |
| Profile photo | friends | |
| Bio | friends | |
| School | friends | Athletes' school also appears on their clips (public by design, below). |
| Social links | only_me | Off-platform contact is the main path from an adult to a minor. |
| Stats | friends | |
| Aura and points | friends | |
| Crew and Riding lists | friends | Who is in them follows this audience; the **counts stay public**, because Join Crew is always public and the count is the athlete's social proof for donations (stage 1 review note 9). |
| Friends list | only_me | |

**Effective audience:** on a private account, `everyone` behaves as `friends` for non-friends. `only_me` is always
only the owner (plus admins and the athlete's guardian). A **blocked** viewer is treated as a guest and also cannot
send a friend request, join the Crew or tag the blocker; the blocked user is not told.

**Always visible, even on a private account** (so tags, highlights, donations and recruiting keep working): display
name, username (an athlete's username is reachable from their public roster id), verified / school-confirmed badges, the athlete's sport, the Highlights they are **approved-tagged**
in, and the Donate button. A private profile shows non-friends a "This profile is private" card around those pieces.

**Hide from search:** when on, non-friends do not find the profile in search (it stays reachable from a clip tag).

**Guardian lock (minors): replaced before anything was applied.** The owner (2026-10-14) does not want the guardian to
be "total dictatorship": a linked guardian supervises (settings, safety counts, changes) and, for under-16s, approves or
declines going public and opening friend requests; a signed consent unlocks a public profile and payouts. Full design:
[MINOR_ACCOUNTS_DESIGN.md](MINOR_ACCOUNTS_DESIGN.md) (MINOR-01).

## 3. Tag approval

Two tag kinds exist today: the athlete tag on a clip (`reels.player_id` + `tag_status`: pending / confirmed /
rejected; the confirmed athlete receives donations) and people tags (`reel_account_tags`, written, not applied).

| | Pending (not approved) | Approved |
| --- | --- | --- |
| Look on the clip | Grey dashed chip "Tag pending · {name}" | Solid chip in the school colour "✓ {name}" |
| In the feed | **Still plays** (no lost reach) | Plays |
| On the athlete's profile | Only the athlete (and guardian) see it, in a "Waiting for your approval" row | In the Highlights grid |
| Spotlight and leaderboards | Views and hype keep accruing on the clip and **count once approved** | Counted |
| Donate | Shows "Waiting for {name} to approve" (money cannot go to an unconfirmed athlete) | Open |
| Rejected | Athlete removed; the clip stays the uploader's, untagged | — |

**Settings for the tagged person:** `Review every tag` (default) or `Auto-approve tags from friends`. Tags from a
blocked user are rejected automatically. Approval nudges go to Activity (and push once notifications are installed,
SCALE-07), saying approval unlocks donations and Spotlight credit.

## 4. Admin handling (built first)

People desk → **Privacy & safety** panel for the selected person: account public/private, each item's audience,
hide from search, tag review, friend count, number of blocks made and received (never who),
pending requests; the MINOR-01 case file underneath. Actions: reset to private defaults, hide
from search (ending a specific friendship for a safety case is an SQL Editor tool, `admin_end_friendship`, because the desk never shows who is friends with whom). Report: counts of private vs public accounts, friend requests and blocks per week (an abuse signal),
the MINOR-01 minor accounts counts. Disable / repair: the feature switch `privacy.friends` turns friend requests off without
touching existing settings; settings and blocks keep working.

## 5. App surfaces

- **Profile → Privacy** (replaces the four switches in Edit profile): Public / Private, per-item audience, hide from
  search, tag review, blocked accounts, and the MINOR-01 age and parent or guardian pieces.
- **Another user's profile:** Add friend / Requested / Friends ✓; ⋯ → Block.
- **Activity:** friend requests (Accept / Decline) and tags waiting for approval.
- **Parent HQ:** teen supervision (MINOR-01), not a lock.
- **Clips:** pending vs approved tag chips; Donate message on pending.

## 6. Out of scope for PRIV-01

Messaging of any kind (none exists, by design); what a school sees; changing existing accounts' settings without the
owner's call (existing accounts keep today's behaviour: everything they had visible maps to `everyone`, hidden items to
`only_me`, account public — owner decision to flip them later).
