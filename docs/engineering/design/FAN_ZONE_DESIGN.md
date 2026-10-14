# Fan Zone — FUN-01 implementation spec

Owner authorized the recommended first build after selecting **fan voting chooses the winner**.
This specification builds a locally testable pilot. It is not a live contest, approved consent
form, new earning program or legal opinion. [FAMILY_FUN_PLAYBOOK](../../product/FAMILY_FUN_PLAYBOOK.md)
§12 supplies the product direction. Actual progress and evidence live in [FUN-01](../../agents/FUN-01.md).

## Scope and constraints

- One Fan Zone route and Home discovery card: **Join the fun / Meet an athlete / Serve together**.
- Game or week campaign windows; later Month/Year awards require their own rules and capacity review.
- Free ballots determine winners. Donations, Aura, service, purchases and watch counts never add votes.
- Private submission receipt and public candidacy are separate. No new wallet credit, cash prize,
  persistent badge ledger or creator payout. Approved results provide a fan recognition recap.
- Service and sharing are optional and never required to release money. Serve together offers
  accessible preset ideas and private, deletable reflection receipts; no beneficiary photos or addresses.
- Expo SDK 57, expo-video 57.0.5, no video caching; no dependency or hosting purchases.
- New Fan Zone media stays in a private bucket, separate from public reels and paid Vault content.
- Campaigns start in draft, testing-only. No SQL application, hosted deployment or live publication.
- Unknown ages, blocked/closed accounts and under-13 accounts cannot enter, consent or vote.
  Adults and eligible teens need no athlete, school, Stripe or payee status for these fan actions.
- Client hiding is insufficient: every read/write/media authorization applies server rules.
- All admin writes remain in Expo /admin. Next remains read-only. Missing data reads as unavailable.

## Journey

An eligible user sees a theme, deadlines and plain rules. They reserve a private entry, upload an
MP4 of 1–30 seconds (at most 20 MiB), supply a short fan alias and caption and confirm filming rights.
No real name, school ID, athlete tagging or payout onboarding is required. The submission remains
private during review. Staff accept it, request changes or reject it with a private reason.

Public voting requires explicit permission for the exact entry revision, sanitized media digest,
alias/caption, campaign, public audience and consent form version. Adults assent for themselves.
Teens assent and a confirmed, active linked guardian grants separate permission for that entry.
The link is a supervision link, not independently verified proof of legal guardianship. Consent
copy remains a marked testing draft for counsel. An edit invalidates review and permission;
revocation, ended links and withdrawal deny subsequent media authorization/public listing.

The guardian reviews the exact private video and caption before deciding. No automatic substitution
by a different guardian, generic public-profile consent or payment consent. Entrants can withdraw
without the campaign being open. A withdrawal immediately excludes the entry from candidates
and results; media deletion is a distinct tracked request with a completion receipt.

Fans can watch eligible candidates and cast one free ballot per account and campaign. They may
replace it before the deadline. No self-votes. The server records account, version and request
receipt atomically. Repeating the same request is safe; a reused identifier with different
arguments is rejected; a stale queued replacement cannot overwrite a newer ballot. The client
refetches the current ballot after a retry. No public running totals or automatic offline queue.

After the deadline staff freeze valid totals. The maximum valid count wins; ties share recognition;
zero valid ballots means no award. Staff cannot select a preferred winner. Proven invalid ballots
can be voided with reasons and an audit record, followed by recount. An entrant is not guilty
because a supporter cheated. Withdrawal/revoked permission hides affected results until recount.

Meet an athlete uses an explicitly curated, currently public approved free reel. If it cannot be
authorized/read, show unavailable rather than another athlete. Stories lead to the existing
athlete profile and its current Donate flow; no new payment behavior or free-text donor contact.

## Operational handling

Expo **/admin/fan-zone**, owned by POLLS under ENGINEERING with ADMIN and UPLOAD, has campaign
creation, schedule/theme/story selection, open/pause/close, entry review, consent status, ballot
invalidation, result finalization/recount, case handling and media removal. A selected campaign
is capped at 100 entries; its complete Data list supplies all rows, status counts and deadlines.
Cases and audit use cursor paging; counts have explicit populations. Unknown/failed reads never
become zero. Restricted identity/permission/reason/media stay on the corrective desk, not public
leaderboards or unrestricted Growth reports. Existing Analytics/Health/Support links remain.

Every mutation returns an explicit result and has single-flight UI handling. SQL checks admin
role independently. Paused campaigns deny new submissions/ballots; private withdrawal, consent
revocation and reports remain available. Report/appeal intake supports an entrant/guardian and
a non-account person concerned about an entry; public intake has bounded text/rate/queue limits
and an unguessable receipt secret for status. A report does not itself hide an innocent candidate.
Staff can suspend/remove an entry, resolve a case with a reason and finalize again under the
published rules. A support contact must be configured before a campaign opens for testing.

## Data and stable interfaces

Tables: `fan_zone_campaigns`, `fan_zone_entries`, `fan_zone_consents`, `fan_zone_ballots`,
`fan_zone_requests`, `fan_zone_cases`, `fan_zone_audit`, `fan_zone_reflections`.
POLLS owns campaign/ballot data; UPLOAD owns media entries; MINOR_SAFETY owns consent;
MODERATION owns cases; AUDIT owns trace records. DATA_GOVERNANCE accepts all paths.
No direct client table mutation/read grants; narrow definer RPCs supply redacted DTOs.
The storage bucket `fan_zone` is private. Only a server-reserved path is insertable, while the
owner has an editable draft in an open entry window. Overwrites and direct client reads denied.
Each new table also has an explicit closed-account restrictive policy.

Shared package export `@tapuai/shared-types/fan-zone` owns DTOs and action types. All RPCs
return JSON envelopes and use the canonical profile ID, not an assumed auth.uid() match:

| RPC | Arguments | Output/contract |
| --- | --- | --- |
| `fun_snapshot` | `p_campaign_id uuid default null` | latest visible campaign or selected campaign; public candidates/results, own entry/ballot/reflections, own guardian permission queue; no other voter identity/private text |
| `fun_admin_snapshot` | `p_campaign_id uuid default null`, `p_before timestamptz default null` | admin campaign list and complete selected entries, bounded case/audit pages, counts and next cursor |
| `fun_admin_campaign` | `p_id uuid`, `p_action text`, `p_payload jsonb` | create/configure/open/pause/close/finalize/recount; actor/time audit; immutable opened rules |
| `fun_entry` | `p_campaign_id uuid`, `p_entry_id uuid`, `p_action text`, `p_payload jsonb` | reserve/edit/submit/withdraw; path/revision/digest receipt; rights/verified media needed to submit |
| `fun_permission` | `p_entry_id uuid`, `p_revision integer`, `p_action text` | adult assent / teen assent / guardian grant / revoke; exact revision/digest and active guardian link |
| `fun_vote` | `p_campaign_id uuid`, `p_entry_id uuid`, `p_request_id uuid`, `p_expected_version integer` | atomic idempotent ballot receipt with version; rejects self, stale, paused, closed, ineligible |
| `fun_admin_entry` | `p_entry_id uuid`, `p_action text`, `p_reason text` | accept/changes/reject/suspend; no staff winner selection |
| `fun_admin_ballot` | `p_ballot_id uuid`, `p_reason text` | invalidation and recount-required audit |
| `fun_case` | `p_entry_id uuid`, `p_kind text`, `p_details text`, `p_secret uuid` | report/appeal/deletion request with bounded durable secret receipt; auth/guardian checks for private entries and deletion |
| `fun_case_status` | `p_case_id uuid`, `p_secret uuid` | minimal reporter receipt/status, no other case text |
| `fun_admin_case` | `p_case_id uuid`, `p_action text`, `p_reason text` | resolve/escalate, audit; deletion completion only after server object removal |
| `fun_reflection` | `p_campaign_id uuid`, `p_id uuid`, `p_idea text`, `p_action text` | create/delete own private preset reflection; no free-text proof required |
| `fun_media_access` | `p_entry_id uuid`, `p_revision integer`, `p_intent text` | authorized path/revision for read, verify or remove; private auth or current public permission checks |
| `fun_verify_media` | `p_entry_id uuid`, `p_revision integer`, `p_digest text`, `p_bytes integer`, `p_duration_ms integer` | service-role only, commits sanitized verified immutable draft media |
| `fun_complete_removal` | `p_entry_id uuid`, `p_revision integer` | service-role only marks media removed and matching deletion cases complete |

Backend owns final additional helper names and DTO fields, documents any justified change before
consumers start. Helper privileges are revoked from clients; PUBLIC default execute is revoked
on all functions before narrow grants. Fan reads may be anonymous only for public DTO/media.

## Revocable media serving

API `/api/fan-zone-media` authenticates optional bearer and calls `fun_media_access` for each
request, then streams private storage bytes with `Cache-Control: no-store`; range requests are
validated. Storage signed URLs are never handed to clients. A previously delivered/buffered copy
cannot be retracted; revocation denies subsequent requests, not already saved copies.

`/api/fan-zone-upload` verifies a reserved uploaded object using caller authorization and a
server-only service key. A bounded MP4 parser rejects corrupt/unsupported files, derives
duration, removes metadata containers while preserving offsets and calculates SHA-256. It
replaces only the authorized immutable draft and calls service-only `fun_verify_media`; no
fallback to original unsanitized media. This is file validation/metadata removal, not transcoding
or a new CDN. `/api/fan-zone-remove` removes an authorized object and records actual completion.
Missing API origin/service key is unavailable; no public storage fallback. Hosted API, secrets,
native bearer video headers/ranges and browser playback need separate release verification.
Client reuses `compressHighlight`/`bytesFromUri` without writing ordinary reels. No thumbnail
or duplicated media path. One explicitly started video player; pause on leaving the screen.

## Detection, review and release

SUPPORT reviews safe fixed-code unavailable/upload/ballot/removal signals, deadlines and stale
data notices. No raw tokens, aliases, captions, guardian identities or media in telemetry.
Local sensors are gate/replay tests; hosted delivery/abuse/backlog/retention sensors remain gaps.
QA tests real SQL/RLS actors (profile ID different from auth ID), guest/closed/unknown/teen
boundaries, consent revision/revocation/ended link, media overwrite/read denial, deadline/pause,
idempotency/stale replacement, invalid ballots/ties/zero totals/recounts and deletion receipts.
UI tests cover visible success/error/permissions and retry refetch, not only mocked callback calls.

Order: planned enrollment → backend/media/admin → independent Data/Safety/QA/SUPPORT evidence
→ admin-ready gate → fan UI → app-ready gate → complete local handoff. Migrations are written
and replayed only; actual countries/ages, counsel-approved terms/consent/retention/contest rules,
moderator staffing, school permissions, verification assurance, provider/deployment/cost limits,
hosted access/removal/recovery and device/accessibility checks remain release decisions.

Growth measures the pilot's actual free-entry completion, permission wait, candidate exposure,
repeat visitors, ballot errors, reports/removal time and review effort separately from donation
conversion. No invented baseline or claim that voting represents equal exposure; random/rotating
candidate order and newcomer discovery should be tested before a wider launch. Stop opening new
windows if review/safety/removal capacity or ballot integrity cannot be supported.
