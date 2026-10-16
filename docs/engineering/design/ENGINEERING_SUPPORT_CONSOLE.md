<!-- DETECT-02: main-admin support/security/recovery implementation contract. -->
# Engineering Support console — design and implementation

Owner request, 2026-10-13: a real main-admin tool for Dev support, dynamic team/data flow,
false-positive handling, attributed change history, cybersecurity collaboration, controlled
self-healing and reliable code backup/restore with efficient feature boundaries.

## Outcome

`/admin/support`, integrated into the existing main Expo admin format, has Issues, Team flow,
Change history and Recovery tabs. Reuse Health, Books and feedback source records and link
their details; do not recreate their analytical dashboards. Unknown/unavailable sources stay
explicit. ADMIN integrates the surface; SUPPORT leads detection/repair with Dev; SECURITY,
RLS_SECURITY and SESSION_SECURITY review trust, grants and audit integrity. Expand SECURITY
with THREAT_DETECTION for suspicious-pattern review and false positives. RECOVERY/RELIABILITY
own verified restoration and bounded recovery; financial policy and independent QA stay separate.

## Contracts

- Restricted support signal store: client reports are marked untrusted, server/security signals
  require server credentials. Fixed feature/code/category bounds, payload limits, sampling/rate
  limits and server timestamps; no raw stack, request body, token, payment detail, GPS or private
  media. Repeated signals group by feature/code/release/environment; no inferred foreign origin.
- Reviews append rather than erase. Include rationale, reviewer, time and reviewed-through
  occurrence. New occurrences reopen review. Security/finance dispositions require a second,
  distinct reviewer; no false-positive disposition enables automatic money/access repair.
- Audit selected actual privileged/admin/money writes atomically. Store DB actor/time, operation,
  opaque entity reference and changed field names; no full before/after row values. Append-only
  grants/RLS and per-entity integrity chain; privileged DB operators remain a documented trust
  boundary. Source-level changes also appear in local recovery manifests with Git identity/hash.
- Snapshot RPC returns bounded signals/reviews/audit/release metadata; every missing source is
  visible. The frontend cannot execute arbitrary commands or migrations.
- Team-flow diagram uses actual registered roles/reporting lines and data ownership metadata.
  Filter by feature/team, show source → owning team → consumer/reviewer → repair → QA, and
  provide a readable text alternative. Generated metadata has a stale-input check.
- Recovery capsules include source, assets, lockfile, patches and migrations with SHA-256
  manifest. Exclude credentials, runtime/customer data, dependencies and scratch artifacts.
  Verification rejects tampering/traversal/symlinks; restore to a new isolated preview directory.
  Code restore never replays old SQL or reverts financial transactions. Record package metadata
  in admin with actor/time; integrity verification does not imply a trusted signer or deployment.
- Feature boundaries contain render failures; normal navigation remains light. Retry reads
  once only for transient failures and report recovery. Never automatically retry payment,
  ledger, refund, payout, authorization, publish or destructive operations. Capture app failures
  only after the admin-ready checkpoint; preserve original fatal-error handling.

## Shared wire contract

RPC `get_engineering_support_snapshot()` returns `{version:1, read_at, signals, reviews,
audit, releases, limits}`. Signal rows: `id,fingerprint,feature,code,category,severity,source,
environment,release,occurred_at,actor_id`. Categories: ui/runtime/network/data/finance/security/
syntax/user_report; sources client/server/security/check. Reviews: id/fingerprint/disposition/
rationale/reviewed_through/actor_id/created_at/decision/parent_review_id. Audit: id/actor_id/
actor_role/occurred_at/operation/table_name/record_id/changed_fields/previous_hash/event_hash.
Release metadata uses the manifest defined by the recovery worker (version 1, releaseId,
createdAt, gitCommit, treeHash, filesCount, byteCount, capsule hash and verification state).
Coordinate schema/type changes in this document before changing consumers.

## Implementation sequence and ownership

1. Domain/runtime worker: shared support types, classification/dedup/review applicability,
   false-positive safeguards, feature map, safe bounded signal client, feature boundary and
   regression tests. New components remain unwired to the fan app until admin-ready.
2. Backend worker: migration/canonical SQL, trusted capture, audit triggers, review/release RPCs,
   negative/atomicity/integrity replay tests; local replay only, no hosted application.
3. Recovery worker: capsule package/verify/restore tools and tests; isolated local artifacts.
4. Root: admin UI/adapters/focus/auth-safe hook, generated team-flow metadata, navigation,
   role/protocol/data registry synchronization and feature enrollment. Verify admin first.
5. Integrate app capture/boundaries only after recorded admin-ready evidence; independently
   review Security/Recovery boundaries, exercise synthetic browser flows and run required gates.

## Acceptance

Guest/non-admin denial; race-safe account changes; absent migration/read errors; no false zero;
untrusted security events cannot become confirmed attacks; expected cancellations/sign-in are
classified; duplicate/recent occurrences retain evidence; finance/security review requires
distinct reviewers; audit actor/time and atomic append-only writes; no secret payloads; bounded
read/queue recovery; capsule tamper/path rejection and verified restore; responsive diagram/text
alternative and keyboard/large-text checks; fresh app/Next/generator/docs/roster gates.

Hosted activation remains owner-applied migration/release work. Evidence distinguishes built,
tested locally, registered metadata and actually deployed/observed behavior.
