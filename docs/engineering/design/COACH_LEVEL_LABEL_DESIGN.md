# Coach-level move label — safety notice for risky workouts (SAFETY-01)

**Status:** built locally 2026-10-16, commit `1231af8`. The app uses option A wording. Counsel has not
approved it. Migration `20261017090000` is written, not applied. Owner HIGHLIGHTS (content), reviews
TRUST_SAFETY, MINOR_SAFETY, LEGAL (owns the wording), MODERATION, RLS_SECURITY, DATA_GOVERNANCE, VOICE.
The local build shows the notice on “I’m in” and invites. It does not block them. Teen pre-publish
review is not built. Schools and coaches cannot set the label.

## Why

The owner wants Beyond and Train Like Me to grow into "good workouts with good ideas for student
athletes", and asked for a "don't try this at home" style notice when a workout is too risky for app
users to copy alone. Many users are minors. Today nothing marks a clip as risky: a back flip, heavy
lift or plyometric jump looks the same as a stretch, and workout challenges (CHAL-01) invite friends
to "try" any public Train Like Me workout.

## Wording (LEGAL decides)

"Don't try this at home" fits badly: most workouts happen at home or a gym. Options for counsel:

| Option | Label | Sheet text |
| --- | --- | --- |
| **A (recommended)** | ⚠️ Coach-level move | Try this only with a coach or spotter. Workout ideas, not medical advice. Warm up and know your limits. |
| B | ⚠️ Pro move — don't try this solo | Get a coach or spotter first. Workout ideas, not medical advice. |
| C | ⚠️ Don't try this at home | Ask a coach before trying this. Workout ideas, not medical advice. |

A standing line on workout content (Beyond switch, Beyond page Workouts, Train Like Me clips):
"Workout ideas, not medical advice. Warm up and know your limits." LEGAL row AC tracks the copy.

## How it works (proposal)

1. **Uploader** — one optional switch in the Highlight composer when the category is Train Like Me,
   and in the Beyond composer when the category is Workouts: "Advanced move: needs a coach or
   spotter". Off by default; one tap, no extra step (the owner's "easy to upload" rule).
2. **Reviewers** — on the existing Highlights desk (Beyond queue and Highlight moderation), an admin
   adds or removes the label with a reason. Every change is recorded (who, when, reason).
3. **Fans** — a new report reason "Risky without a coach" never hides the clip; it puts the clip in
   the reviewers' label queue.
4. **Display** — labelled clips show the badge in the clip's badge row (below the Home chrome, as
   fixed 2026-10-16) and, on tap, a short sheet with the agreed text. The label always shows for
   every viewer, including minors and guests.
5. **Challenges** — a labelled workout does not offer "Challenge accepted!" / "I'm in" invites, or
   shows the label on the invite (owner + MINOR_SAFETY choose). It never earns extra Aura.

## Data and admin contract (planned)

- `reels.safety_label` and `beyond_posts.safety_label`: `none` | `coach_level`, default `none`.
  Uploaders set it only on their own new upload; changes after publish go through an admin RPC.
- `safety_label_events`: append-only audit (target, old/new, actor, reason, time); RPC-only, RLS
  on, "Closed accounts" policy, admin read.
- Admin: `/admin/highlights` label queue (suggested by reports), add/remove with reason, counts.
- Report: labelled clips, open suggestions and median time to review on the Highlights desk; a
  source error shows unknown, never zero. No behavioural tracking.
- Disable/repair: the uploader switch and report reason sit behind a runtime flag; an existing
  label keeps showing (a safety notice is never switched off silently). Admins remove a wrong label.
- Migration `20261017090000_coach_level_label.sql`, `lib/safetyLabels.ts`, `SafetyLabelPanel.tsx` and
  `CoachLevelBadge.tsx` exist locally. The selected gates passed on 2026-10-17. They check local
  files and evidence. They are not a counsel sign-off or a hosted apply.

## Not decided (owner / counsel)

Final wording; whether labelled workouts block challenges or only warn; whether a teen uploader's
"advanced" clip needs review before it is public; Terms language about exercise risk; whether
schools or coaches can label their athletes' clips.

## Admin-first order

Enroll (done) → design review (TRUST_SAFETY, MINOR_SAFETY, LEGAL) → migration + admin desk +
report → `pnpm feature-admin:check --feature SAFETY-01 --require admin-ready` → app badge,
composer switches and sheet → `--require app-ready`.
