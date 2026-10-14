<!-- Owner-requested growth plans and mitigation proposals, grounded in existing fan/filmer paths. -->
# Growth plans for every user type

**Owner follow-up:** 2026-10-13, America/Denver. **Accountable:** GROWTH_ANALYTICS through
MARKETING → CTO → owner. Actual exchanged reviews and checks: [GROWTH-01](../agents/GROWTH-01.md).
Standing duties: [Growth charter](../engineering/GROWTH_CAPACITY_REVIEW.md).
These are growth plans and implementation recommendations, not completed features, approved
campaigns, current-law conclusions or permission to move live money.

## 1. Direction

Make being an awesome fan valuable on its own: discover local sport, watch, cheer, save,
follow a Crew, share a clip and contribute original footage. Donations are one optional way
to help. Fans should understand the first useful action and have a reason to return even
when they never donate or upload.

Treat **roles as overlapping capabilities**. A parent can also be a fan and filmer; an athlete
can support another family. Becoming a donor or uploading a clip should not automatically
require an athlete claim, school badge, guardian-payee setup or recipient Stripe onboarding.
Age, content rights, privacy, abuse prevention and payment controls apply to the specific
person/action. Young fans need appropriate safety protections even when they are not athletes.

Recommended approach: strengthen the existing fan experience and casual uploads first,
then develop repeat creators and safe family-support loops. An athlete-only entry funnel
would miss watchers and contributors. A general-purpose video network would add content and
moderation obligations beyond the current sports mission. Revisit broader categories only
after an explicit Product/Legal/Safety decision with operating capacity.

## 2. What already exists and where fans encounter gaps

Engineering source review confirms signed-in fans can upload **videos** with **“Tag later”**;
they do not need a professional filmer role or athlete claim. Existing upload composer,
credit/stats and Crew/share/hype surfaces can support growth. Photo stories still require
athlete selection; video and photo capabilities must be explained accurately.

Observed references: `apps/mobile/src/frontend/components/Reels/UploadVideoModal.tsx`, lines
164–166 and 370–375; `UploadVideoComposer.tsx`, lines 161–164. Source observations are local;
hosted policies, native behavior and the actively changing shared tree need separate evidence.

Additional observed source gaps:

- Untagged videos are publicly playable even when tag state is pending; no later athlete-tag
  journey was found. See tag migration `20261014100000_tag_approval.sql`, lines 198–200,
  377–425 and 733–739. Pending attribution is not a moderation or safe-publication hold.
- Current upload/UI and ownership policies do not establish universal age/publication denial.
  See `UploadVideoModal.tsx`, lines 370–375, and canonical SQL, lines 4086–4091. Private
  profiles do not automatically make all uploaded files private.
- `MediaUploadService.ts`, lines 241–247 and 316–340, uploads public bytes before the row and
  can omit attestation fields on compatibility retry. Publication/review controls must protect
  the file itself, not only the feed row; upload retries also need durable operation identity.
- Existing filmer stats/Props require confirmed, nonremoved clips and exclude self-awards/the
  athlete's own clips; see filmer rewards migration, lines 183–190 and 222–229. Posting an
  untagged clip does not automatically earn these rewards. The service mechanically credits
  the uploader, which must not falsely identify a licensed reposter as the camera operator.
- Clip sharing lacks a found consumer for its untagged reel query (`lib/reels.ts`, lines
  301–305); gift links open a profile (`app/gift/[handle].tsx`, lines 62–70), and web PaymentSheet
  is unavailable (`useTipCheckout.ts`, lines 121–123). Browser-to-app acquisition and donation
  handoff need explicit tested destinations before promising those channels.
- Owner withdrawal and non-user subject reporting lack a complete verified route. See
  `ReelMoreSheet.tsx`, lines 97–104, and `ReelCard.tsx`, lines 472–485. Local Hide is not a
  received moderation report or deletion of a public file.

| Gap | Bridge to recommend | Mitigation/acceptance and responsible owners |
| --- | --- | --- |
| “Tag later” without an identified self-service later-tag route | Keep untagged sports videos valid. Clarify the label/help now; separately propose a request-and-confirm tagging workflow | UPLOAD/PROFILE/Backend/Security/QA: no raw reassignment of player/recipient; athlete/guardian approval where required, attribution history and decline/removal/retry states |
| Different photo/video requirements | Clearly show what each format supports. Decide whether team/event-only photo stories belong in the mission | PHOTO_STORIES/Upload/Product/Content Rights: expand-only reviewed schema/rights/audience design if approved; no workaround that tags an unrelated athlete |
| A fan cannot see a simple contribution path | Present watch/cheer/share/upload as understandable actions; let the user choose interests/actions without mandatory role switching | Product/Onboarding/Design: reuse existing surfaces first; preserve guest access and drafts; new UI requires its own admin-first plan |
| Upload succeeds but the contributor does not know what happens next | Show uploaded/processing/pending-review/published/failed status, uploader credit and next permitted action | Upload/Storage/Moderation/Support/QA: verified state source, safe retry, rights/attribution review and clear correction/removal route |
| Shared links lose the clip or donor intent | Propose an approved browser clip landing and resumable recipient-specific app donation handoff | Sharing/Playback/Checkout/Product/QA: exact clip/recipient, privacy/removed/unknown states, supported device route and verified settlement; web checkout remains unbuilt |
| New creators struggle to be discovered | Compare modest, reviewed discovery opportunities for eligible original content and community curation | Discovery/Highlights/Moderation/Growth: no guaranteed reach or donor-funded priority; anti-spam/duplicate/restricted-content controls and measured quality |
| Recognition is confused with cash or athletic popularity | Use approved contributor credit and noncash recognition; explain what counts and what does not | Filmer Rewards/Leaderboards/Voice/Legal: verify originality/eligibility, manipulation/reversal/appeal rules and privacy. Existing future cash programs stay gated |
| Posting is confused with filming; untagged videos lack reward eligibility | Distinguish posted-by and filmed-by attribution. Show publication credit without promising Aura/Props before eligible confirmation; separately review recognition for untagged community content | Filmer Rewards/Content Rights/Voice/Legal/QA: authorized attribution and public alias choice, original/licensed distinction, reward eligibility and error/unread states; no invented rewards |
| A fan wants to donate but recipient eligibility/money flows are incomplete | Make recipient, purpose, split, total and pending/refund status clear; complete family eligibility before charging unless the held-money model is approved | Commerce/Connect/Custodial/Ledger/Finance/Legal/QA: correct payee, one settled credit, available balance, caps/refunds/disputes; test-mode donations remain test-only |
| Youth or non-user subjects remain publicly identifiable | Explain actual public exceptions and provide a subject/guardian reporting and removal process | Legal/Privacy/Minor Safety/Content Rights/Storage/Support: age/rights/consent decisions, public media access/deletion and staffed escalation verified before expansion |
| A review hold or retry does not protect public bytes | Use reviewed private staging and an authorized publish transition, durable upload IDs/status and bounded processing | SCALE-02/Upload/Storage/Security/Recovery/QA: denied raw media access, no dropped rights version, orphan cleanup, restart/uncertain-success reconciliation and metadata/size limits |

The earlier [verification/safe-growth packet](../legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md)
also identifies guardian proof, draft consent/public exceptions, school-independent minor
verification, Connect readiness, settlement and ongoing age/schema-doc integration gaps.
Closing those enables the affected public/money capabilities; it should not make every fan
complete athlete/payee onboarding to use unrelated permitted features.

## 3. Plan by user segment

Acquisition channels are **proposals for authorized activity**. No invites, campaigns,
messages, school outreach or sponsor offers are sent by this plan. The owner approves an
external pilot/campaign after applicable privacy/safety, release and partner gates.

| Segment / job | Acquisition and first useful action | Repeat/value loop | Qualifying outcome and lead |
| --- | --- | --- | --- |
| Guest: see what local sport offers | Approved clip/profile/game links or QR; watch a permitted clip or find a game before signup | Related local content → useful sign-in reason when saving/following/contributing needs an account | Guest action completion and permitted signup completion; PRODUCT/ONBOARDING/SHARING |
| Fan: belong and support | Family/player shares and approved local community links; find a sport/team/athlete, watch and cheer/save/follow | New relevant clips or activity → cheer/share/save → return for the next game; participation remains free of donation pressure | First meaningful fan action, returning active fans and approved share-to-visit outcomes; GROWTH_ANALYTICS/DISCOVERY/CREW/ACTIVITY |
| Young fan: participate safely | Age-appropriate account path and interests; complete a permitted watch/cheer/save/create action | Relevant sport/training/service content and protected participation, with transparent supervision when required | Permitted activation/return, rejected unsafe actions, adult-contact/exposure incidents; ONBOARDING/MINOR_SAFETY/PRIVACY |
| Casual uploader: share a moment | Clear upload entry from existing fan surfaces; original permitted sports clip, with athlete tagging optional for supported videos | Publish status and credit → feedback through allowed hype/activity → next original contribution | First eligible published upload, completion/failure/review time and repeat original contributors; UPLOAD/HIGHLIGHTS/SUPPORT |
| Repeat filmer: help the community see more athletes | Invite existing contributors into approved recognition and practical filming guidance | Quality original footage → confirmed eligible credit/Props/Aura → return for the next game; current rewards exclude unconfirmed and self-awarded clips | Returning original creators, eligible published clips, diverse athlete coverage and abuse/reversal rates; FILMER_REWARDS/LEADERBOARDS/HIGHLIGHTS |
| Donor: help with a real sports cost | Clear family goal from an approved clip/profile/share link; review recipient/purpose/total and complete an eligible donation | Accurate receipt + preset thanks/approved goal update → optional future support, sharing or continued fan activity | Settled donations to the intended family, checkout completion and refund/dispute rates; COMMERCE/LEDGER/RECEIPTS/FINANCE |
| Athlete: tell a story and build community support | Family/approved partner discovery; claim identity through an accepted route and contribute/approve a legitimate highlight | Safe showcase and clips → community support → presets/approved progress → next story | Legitimate activated athletes, approved footage and sustained community participation; PROFILE/ATHLETE_VERIFICATION/HIGHLIGHTS |
| Parent/guardian: promote and protect the athlete | Athlete/family invitation; confirm the relationship and understand separate supervision/public/money permissions | Help publish permitted footage and goals → see family activity/records → support the next milestone | Completed effective permissions, verified family readiness and resolved disputes; CUSTODIAL/PRIVACY/ROLE_HQ |
| School/authorized staff: support trustworthy local coverage | PARTNERSHIPS prepares authorized contact; validate staff authority and confirm the roster/claim through an accessible workflow | Accurate affiliations → approved event/community coverage → periodic correction/permission review | Authorized confirmations, time/rework and accuracy; SCHOOL_PARTNERS/ATHLETE_VERIFICATION |
| Booster/community organization: support families fairly | Approved organization relationship and representative; understand allowed support/goal options | Community updates and verified support → another approved event/campaign | Active authorized organizations, family coverage and reconciled support; PARTNERSHIPS/ROLE_HQ/FINANCE |
| Sponsor: support a local community transparently | Approved business outreach and offering; verify business authority and permitted placement | Disclosed approved placement → aggregate outcome report → renewal decision | Active approved sponsors, delivered placements, accepted aggregate reporting and reconciled revenue; SPONSOR_ADS/PARTNERSHIPS/COMMERCE |
| Operator/game-day contributor: future reliable coverage | Keep the existing gated game-day route; later approved staffing/onboarding | Authorized coverage → verified game records → reviewed next assignment | Coverage accuracy, incident/recovery and loaded cost; OPERATIONS/OPERATOR/QA, existing later-wave gates |

GROWTH_ANALYTICS owns the single integrated plan; rows naming “Growth” use that existing role.
These segments are not new account types or a promise every listed surface is deployed.
School confirmations are partnership/trust operations, not a new coach/team-management product.
Paid sessions, pooled team donations/matches, recurring donations, cash filmer rewards and
game-day gigs are not enabled by this plan; use their existing owner/counsel/feature gates.

Internal admin, support and moderator users need a **capacity plan**: clear queues, permitted
tools, training, independent review, safe logs, repair/rollback and shift coverage. Growth
forecasts their workload instead of treating more public accounts as cost-free growth.

Donor card-use authority and teen-spending rules need a separate Legal/Commerce decision
from recipient guardian/payee consent. Keep donor names, amounts and contact records restricted
unless a separately approved recognition choice applies. Donations must not buy contact with
or privileged access to a minor. Before charging, review fraud controls, trusted recipient and
freeze/unavailable checks, refunds/disputes and the existing settlement/held-money gates.

## 4. Fan growth loop to test first

1. A fan arrives through an approved local clip or community link and watches useful content.
2. They choose a relevant follow/save/cheer action with a clear account prompt only when needed.
3. They return for meaningful new local activity and optionally share or upload original footage.
4. Eligible footage receives accurate contributor credit and safe athlete attribution when agreed.
5. Interested fans can review an approved family goal and donate; everyone can continue supporting
   through attention, original footage and sharing regardless of ability to pay.

This is a proposed use of existing strengths. Measure each transition; the loop has not been
proven. Do not equate autoplay views, profile records or donations with engaged unique fans.
Avoid manufactured urgency, excessive notifications, public donor spending ranks or making
a young athlete's reach depend on money. Broader discovery/features need a reviewed experiment.

## 5. Bridges for the safety and money gaps

| Priority | Bridge / safer interim scope | Evidence needed to advance |
| --- | --- | --- |
| 1. Restore coherent age/privacy integration | Existing owners reconcile client/context/server/docs first; keep unverified/restricted capabilities limited | Current source checks, complete age/OAuth/returning-account paths, approved hosted policies and negative access/media tests |
| 2. Rights and understandable public visibility | Separate uploader permission, subject/guardian permission, school marks and commercial reuse; make exceptions visible and support non-user takedowns | Counsel decisions, actual consent/exposure behavior, removal/revocation and staffed moderation/deletion evidence |
| 3. Guardian proof and school-independent identity | Separate teen supervision from verified financial guardian authority; propose a reviewed identity/relationship route with disputes/appeals | Acceptable proof, trusted review/audit, consent eligibility and correct separate badge/payee state |
| 4. Safe recipient payments | Complete payee/provider/settlement/refund design; continue test money or approved nonfinancial engagement while real payments remain gated | Exact Stripe configuration, current terms/counsel, one credit path, reserved balance, payout readiness and Finance/QA acceptance |
| 5. Fan/filmer clarity and recovery | Preserve permitted video upload without athlete claim; clarify “Tag later,” photos, credit, status and safe retry | UX/source evidence plus actor/rights/tag authorization; no claimed retag/reward/recovery capability until verified |
| 6. Affordable growth | Small authorized cohorts, accepted queue/cost limits, reliable video/upload/access service and a stop/revise path | Real original-upload rates, storage/encoding/delivery use, review share/minutes/backlog and loaded 30/90-day costs |

## 6. Proposed 30/60/90-day sequence

Windows start from the owner's approved work/pilot start, not from this document's date.
They are planning stages; unmet safety/financial dependencies delay the affected capability.

| Stage | Work and decision | Exit evidence |
| --- | --- | --- |
| Days 0–30: make the fan path understandable and dependable | Resolve known integration/permission gaps; verify existing guest/fan/video/photo/credit flows; prepare filming guidance and consent explanations; define segment baselines and one small internal fan/creator test | Required controls accepted for the tested scope; accurate states/notices; measured completion/recovery and source coverage; Product/Legal/Dev/Growth recommendation |
| Days 31–60: approved local fan/creator pilot | If authorized, seed original permitted sports content, test existing sharing/Crew/watch/upload loops and noncash recognition; pilot eligible family support only after financial gates | Real fan/creator return and eligible originals, denied-path safety evidence, review/backlog/support cost and reliable measurements |
| Days 61–90: retain and expand selectively | Improve the observed weakest transition; compare approved discovery/creator/partner alternatives; expand one demonstrated segment/community at a time | Accepted outcomes and targets, legal/partner scope, cost/capacity/headroom and recovery evidence; owner expand/revise/stop decision |

Campaign setup, new UI, instrumentation and payment changes each need an assigned implementation
and the existing admin-first workflow. A document or scheduled review date does not run a campaign.

## 7. What Growth/scalability must bring to every review

Maintain a plan card for **every segment**: job/value, existing capability, acquisition channel,
first useful action, repeat loop, activation/retention definitions, baseline/window/coverage,
accepted goal/date, current barrier, legal/safety dependencies, capacity/cost, next experiment,
owner and next review. Distinguish **proposed, ready for scoped test, tested, expand, revise**
and **blocked on a named dependency**. No plan is missing merely because its metrics are unknown.

Use one packet. Show segment-level numerator/denominator and overlap so a parent who uploads
and donates is not counted as three unique new people. Donor is an activity segment, not a
required fan identity. Proposed useful measures include first/repeat meaningful fan actions,
eligible original uploads, published-to-reviewed ratios, repeat creators, confirmed consent
and attribution, settled optional support, appeal outcomes and revocation/removal effectiveness.

Current segment conversion, retention, acquisition cost, moderation throughput and service
headroom are **unknown**. GROWTH_ANALYTICS/ANALYST/Data/Privacy agree lawful measurement before collecting
identity; pseudonymous IDs are still personal data. Prefer existing restricted sources,
fixed codes, minimal data, retention/access controls and suppression of identifying small cohorts.
Collect no birth details, signatures, invite codes or relationship graphs in Growth reporting.

Forecast original uploads and retries, clips/minutes/storage/egress, review/appeal arrivals,
handling/rework/backlog, provider charges and loaded labor at 30/90 days. The $50 infrastructure
ceiling does not cover or certify legal, moderation or support capacity. Thresholds trigger
diagnosis and a recommendation; they do not automatically buy services or weaken safeguards.

Legal/Privacy/Safety review permitted alternatives; Dev/Support confirm feasibility; Growth
checks user benefit; Finance accepts economics; QA independently verifies relevant evidence.
Contributors exchange findings, record disagreements and present two viable options to the
CTO and owner. Experiments stop/revise for unauthorized exposure, wrong recipient, ineffective
withdrawal, reward manipulation, unsafe contact, excessive review backlog or unreliable evidence.
Targets and stop limits must be accepted before execution, never invented from missing data.

The [family fun playbook](FAMILY_FUN_PLAYBOOK.md) extends these plans with the owner's fan-video
recognition concept: Game/Week/Month/Year, awesome-fan badges, voluntary service and distinct
noncash recognition/money paths. It is a brainstorming draft; new awards, scoring, badges,
service formats and creator earnings need focused design and their own admin/domain gates.
The latest owner choice is fan voting selects the winner: staff review eligibility/rights/
safety, and valid free award ballots select the result. Playbook §12 refines private entry,
public candidate permission, acknowledgment, ballot rules, newcomer discovery and corrections.
Ordinary fans should have fun and contribute without donating or adopting athlete/payee roles.

The next existing Growth packet is **October 20, 2026**. Include every segment's plan status,
five prior safety/payment decisions and the fan/video/photo/retag/recognition proposals. Actual
review execution and checks belong in GROWTH-01; counsel, hosted/device and release acceptance
remain separate from this planning work.


## Weekly learning alongside each account path — QUIZ-01

Owner-authorized local build adds optional sport learning, following the account’s usual
journey. [Playbook §13](FAMILY_FUN_PLAYBOOK.md#13-earlier-untimed-sport-pop-quiz-source)
defines one weekly approved random question, explanation, private Sport Learner completion
badge, local Not now and persisted Skip when the active quiz can save it. No perfection or
streak pressure, money/Aura/ballot weight, institutional privilege or compulsory service.

| Segment | Growth opportunity | Decision evidence to gather after approved pilot |
| --- | --- | --- |
| Casual fan, family or friend | Learn a rule, recognize a moment at the game, come back for another simple question | Voluntary completion/return and support burden; do not assume this increases donations. |
| Filmer | Learn context for a clip without athlete or payee setup | Whether clear rules help participation/upload confidence; no extra badge for publishing a child’s video. |
| Athlete | Welcome other-sport curiosity alongside their own story | Untimed comprehension feedback; avoid public proficiency/performance ranks. |
| Guardian or parent | Understand the sport together while keeping each account’s answer private | Consent/friction feedback and usable corrections; no access to a child’s answer through a new report. |
| Donor, booster or sponsor | Learn personally before choosing optional existing support actions | Return/correction feedback; purchases and donations never improve quiz or voting standing. |
| Operator, staff or admin account | Optional personal learning alongside operational work | Whether discovery interferes with work; keep it dismissible and nonblocking. |
| New or accessibility user | Four plain options and an explanation after any answer | Accessible controls, easy leave/Skip and consented feedback; never claim mastery from participation. |

Growth proposes measures, Content/VOICE approves rule context, Legal/Safety reviews age/privacy
and recognition wording, Dev builds weekly/retry/skip/correction controls, and Support tracks
pause/errors/correction workload. Current source status and actual local gates are in
[QUIZ-01](../agents/QUIZ-01.md). Real completion/return/donation/capacity measures remain
unknown; no new tracking collector or live experiment is introduced. The October20 joint
packet brings evidence and feasible options to the owner before expansion.

## Local implementation continuation — FUN-01 / QUIZ-01

The first Game/Week Fan Zone and weekly private learning prototype are built in the isolated
checkout; actual source/check/review status is in [FUN-01](../agents/FUN-01.md) and
[QUIZ-01](../agents/QUIZ-01.md). This does not mean every proposed segment experiment or
future reward is built. Friendly school scoring, Month/Year awards, persistent fan badges,
creator earnings and expanded service posts retain focused design/domain gates.

The October 20 joint packet uses each segment's permitted first action and return plan, plus
actual correction/support capacity and provider costs when available. Fan private entry and
guardian review, free ballots, optional stories/service and Quiz explanations/Skip now have
local operating controls. Content/Legal/Safety confirms facts, rights, age and terms; Dev/Data/
Support verifies hosted stop/removal/access and failure recovery; Growth compares lawful
engagement options and Finance verifies loaded costs. Contributors bring disagreements and
feasible options to the CTO/owner. Real uplift, review throughput and cost remain unknown;
no automatic outreach, telemetry collection, spending or hosted pilot starts from these plans.


The Sport Quiz rows above describe earlier untimed source. The owner approved
[optional timed trivia](../engineering/design/TIMED_TRIVIA_PROPOSAL.md): default-off weekly
invitations, sports-first topics and30/90 seconds available to everyone. [QUIZ-02](../agents/QUIZ-02.md)
backend/admin has independent acceptance and actual local admin-ready16:53:17Z plus selected
gate exit0 before participant work. Timed participant and final independent source review plus root full150suites/1,219tests/all guards pass. Selected local app-ready passes after admin; final Documentation/VP continuation remains pending.
[Family playbook §§14–15](FAMILY_FUN_PLAYBOOK.md) supplies per-account voluntary learning/story/
activity return plans for the October20 joint Growth/Legal/Dev/capacity packet; no live uplift
or additional rewards are inferred.
