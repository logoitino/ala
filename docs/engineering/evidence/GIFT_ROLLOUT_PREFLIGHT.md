<!-- Actual gift/tip preflight observations; catalog presence and local fixtures never certify provider settlement or release. -->
# Gift rollout preflight — 2026-10-22

Last updated: 2026-10-22. Packet executor: outside-session Codex; hosted observations supplied
by the coordinating Codex root. Accountable lead COMMERCE; DATABASE_MIGRATIONS owns the apply
plan through its lead, RECONCILIATION owns matching provider/source/Books evidence. This is
technical preparation, not pinned-domain/counsel acceptance or a release decision.

Use the [staged runbook](../GIFT_TIP_ROLLOUT.md) and [model report](TIP_MODEL_REPORT.md).
Private receipts: `.smoke/gift-release/rollout-packet-results.json`,
`rollout-replay-run.json`, `rollout-sql-results.json`, `rollout-sql.log` and
`hosted-preflight.json`. No credentials, customer rows or provider payloads are copied here.

## 1. Actual hosted metadata observations

Root performed authenticated **read-only Supabase catalog/deployment/migration metadata**
reads at **2026-10-22 15:45:35 UTC**. This subagent made no hosted call. The exact corrected
prepare-function signature is `uuid,uuid,bigint,boolean,numeric`; it replaces an initial
integer-based probe. A fresh corrected trigger query checks the exact name
`tips_payment_context_guard_bi` on `public.tips` and confirms absence on both projects;
it replaces the earlier function-name trigger probe. No write-performing revenue summary
or catch-up RPC was invoked.

| Observation | Development `ulfapgtabidorgwfjvwz` | Staging `tucioqipfejqqqtuakdi` |
| --- | --- | --- |
| Recorded migrations | 74 | 27 |
| Latest recorded version/name | `20261022140000 record_stripe_kyc_dedupe` | Same |
| `20261022152000` record | Absent | Absent |
| `notification_payment_contexts` | Absent | Absent |
| `app_runtime_config` | Present | Present |
| `monetization_tips_enabled()` | Absent | Absent |
| Exact `prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric)` | Absent | Absent |
| `tips_payment_context_guard_bi` | Absent | Absent |
| Named prerequisite function count | 3/4; `record_notification_payment_context` absent | Same |
| `company_revenue_bps` definition MD5 | `24f7e5008e2ac832bbda5561b1214b31` | Same |
| `create-payment-intent` metadata | ACTIVE, v1, `verify_jwt=true` | ACTIVE, v2, `verify_jwt=true` |
| Other returned Edge metadata | `create-stripe-account` v1 | No other function in returned list |

Both reported payment bundles have metadata SHA-256
`944d7502bd23ce469ab0632cb4376dc933bbca2b2ebfb62b59652e942adddee3`.
Actual deployed handler contents, server credential configuration and behavior remain **unread /
unverified**. A bundle metadata hash is not comparable to a single local source-file hash and
is not evidence the new quote adapter is deployed. Catalog definition MD5 is a comparison
fingerprint, not a numeric rate assertion or security acceptance.

A later source-only rate-definition inspection was blocked by the coordinating session's
PreToolUse data-exfiltration hook; no result was obtained. That blocked inspection does not
change the earlier catalog receipts and supplies no evidence of the actual hosted 0/1000 rate.

The environments contain different historical migration names/versions and staging baseline
chunks. The private packet retains version mapping/unmapped records for DATABASE_MIGRATIONS
review. Do not infer all old staging catch-up remains unapplied from an old document, or
infer source parity from today's count/latest version. Reconcile definitions, constraints,
columns, grants and provenance before presenting an exact owner-reviewed apply list.

**Current staged release gate: STOP before SQL application or payment deployment.** Both
lack the context prerequisite and new quote/guard helpers. The live published flag value,
actual fees/capture/refunds/net settlement, concurrent sessions and installed-client compatibility
were not verified by these catalog reads.

Connector/access observations supplied by root: Supabase authenticated and completed these
reads; Stripe MCP requires reauthentication; GitHub identity worked but the requested
`logoitino/ala` repository GET returned 404. No repository write occurred. Public GETs for
Expo58/Supabase changelog failed with curl7; Supabase MCP search returned a backup/restore guide.
Those retrieval results do not establish product, migration or provider acceptance.

## 2. Source inventory

SHA-256 values below bind this packet to the local working tree, including the corrected
unapplied migration containment comment and identical canonical append. A file hash does not
establish its applied state. The private `sourceHashes` inventory additionally binds the payment
core/context/Edge/Node/client/flag/bookkeeping/registry source. Verify every hash again before
any review acceptance or deployment; source changes invalidate affected evidence.

| Inventory path | Exact SHA-256 |
| --- | --- |
| `supabase/legacy/admin_dashboard.sql` | `5cccb1caf09de52bb298f1b2fd953632637d42f1782bc395b37aa6181e889d08` |
| `supabase/legacy/app_runtime.sql` | `ba5091571a2fd096cdeeeba30ea0d0c436afae5035c7819b12318a3130ada605` |
| `supabase/legacy/company_revenue.sql` | `3ce1a237a99f028114b1ea68fe388c2a6ea2116c663d2ce2b1249537dea2c510` |
| `supabase/legacy/tip_origin.sql` | `bf47c711f058386ec588ede95fd1f09115f75483973358a98690cf9396252f8a` |
| `supabase/migrations/20260929180000_rally_goals_thanks_platform_tip.sql` | `62e1d520a1f22ff4763a8a8ea630271126cd2f50843133e0a393406ae7274e23` |
| `supabase/migrations/20261012210000_bookkeeping_ledger.sql` | `d338b79e84a5c93da05403fa7c4dcd41e445d44f7f9543ef5372875d1ec65038` |
| `supabase/migrations/20261013210000_function_access_hardening.sql` | `8e40f4fe775e1c67c75254bc1dcc959b8362bbb06fbd759d51175fed425ff81c` |
| `supabase/migrations/20261013231000_family_share_in_received.sql` | `c5d307d4fc2e25d1fb05c008bae677ccfe278c867bd6aee2b2b148697614d58b` |
| `supabase/migrations/20261014110000_minor_accounts.sql` | `ab95be4280bf79968ec4c4ffb7ec395f998ed07e44ac10db94f38b67d5c9a778` |
| `supabase/migrations/20261021150000_notification_payment_context.sql` | `68ca9a81a900fa436f4ab3d6758148f645b764c1c2786ed0d9fac6cc2bca5979` |
| `supabase/migrations/20261022152000_no_cut_gifts_optional_tips.sql` | `f46a7d2aeba23cc50150cdf99c3f04d2bbf76ccbf745b4400f123ab3d55cdee9` |
| `apps/mobile/src/backend/db/schema.sql` | `ec4b0fbe6834a868a1a96603988f1191169baec2255144c2715619b7bc26ac7f` |
| `pnpm-lock.yaml` | `36be82a6d4f3aa16d19c262d38b27f3894b59b3512cd320377587aeadf421208` |
| `scripts/replay/tip-model-replay.mjs` | `b9be977d3d187e3cd60af0dbf05903f6a34759e6b85a9ea13598d3387bca02cd` |

`20261022152000` defines eight functions and the `tips_payment_context_guard_bi` trigger;
its context tables are a prerequisite from `20261021150000`, not new tables in this file.
Runtime, Revenue/Books, minor/recipient/freeze and notification-context dependencies are
listed in runbook §2. Historical standalone files are inventory/provenance inputs; this list
is **not** an instruction to reapply old definitions onto an existing database.

## 3. Actual local packet checks

The fresh private run at **2026-10-22 15:50:07–15:50:09 UTC** used installed Node24 and cached
PostgreSQL18.6/PGlite0.5.9. It preserved the existing `.smoke/gift-copy` evidence by copying
the current `scripts/replay/tip-model-replay.mjs` test logic, resolving its unchanged stubs
from the new location, and redirecting output to this packet directory. It additionally ran
the runbook's three read-only SQL blocks against those synthetic fixtures, replacing the
intentionally invalid cutover placeholder only with the fixture UTC. Exact source/private
runner hashes and command are retained in `rollout-replay-run.json`.

| Executed check | Actual result | Limit |
| --- | --- | --- |
| Current private no-cut PostgreSQL replay | **22/22 pass**, exit0; prior canonical builds and new migration reapplies twice | Synthetic, isolated PostgreSQL; not replay of either current hosted baseline |
| Three runbook read-only SQL blocks | **3/3 execute**, exit0 | SQL syntax/catalog compatibility on this fixture; no hosted results or production data |
| Source inventory existence/hashing | All listed inputs exist; exact SHA-256 stored | Does not prove deployment, keys, migration provenance or runtime health |

Replay verifies OFF/ON zero gift cut, separate tip/estimated coverage, first draft held OFF,
service-only quote ACL, malformed flags/fees, wrong actors/allocations, provisional/duplicate
reference denial, issued quote admitted after OFF, historical-row preservation, missing
closed-month repair gaps, frozen/closed-age/absent target refusal, pre-charge gift/cover bounds,
and maximum authenticated-row/Aura bounds. Sequential duplicates do not prove concurrent
hosted sessions. Any future unrelated whole-canonical reapply failure stays a separate finding.

The earlier [admin](MONEY-TIPS-01-admin.md) and [checkout](MONEY-TIPS-01-app.md) evidence records
backend208, independent checkout71, family-history21, mobile266 suites/2576 tests, portal117 and
retained full detection scan PASS. These are prior receipts, not tests re-executed by this
packet author. Root owns the final integrated `pnpm check` / retained scan after this turn's
documentation changes. No full project test, browser/device test, Stripe test charge, hosted
write, flag publication, SQL application, Edge/Node deploy or build was performed here.

## 4. Concrete unrun gates and decisions

| Gate | Next accountable reviewers / required result |
| --- | --- |
| Migration provenance and target replay | DATABASE_MIGRATIONS + BACKEND + Data/Security; map all missing/compatible objects and historical versions, rehearse exact approved dependencies, then owner applies |
| Upgrade admission / old clients / in-flight extras | COMMERCE + API/CHECKOUT + SUPPORT + QA; prove a server admission stop, test old binaries, retain paid allocation and prevent charging an unsupported client |
| One writer and paid-but-unrecorded repair | RECONCILIATION + FINANCE_DATA + INTERNAL_CONTROLS + SUPPORT; provider-backed matching and approved idempotent audited repair; no second webhook business writer |
| Historical refund / missing closed-row repair | CFO + CONTROLLER; use recorded allocations and references, reviewed reversal/reopen/manual evidence, preserve posted and closed records |
| Retention / erasure / abuse / quotas | DATA_GOVERNANCE + PRIVACY_ENGINEERING + SECURITY + COMMERCE + GROWTH_ANALYTICS/INFRASTRUCTURE; governed unpaid/paid/hold lifecycle, approved rights/retention, limits and measured capacity; no new deletion worker |
| Actual processing / net settlement / Connect | COMMERCE/CONNECT + CFO + owner/counsel; reauthenticate provider, actual fee/net/refund receipts, reviewed item8 movement/guardian mechanics; application rail remains test-mode platform balance with blocked payouts |
| Aura / signed consent / Terms / store | LEGAL + owner + VOICE; classify unchanged gift-linked digital Aura, retain old signatures, accept versioned terms/tax/processing/store wording |
| Actual deployment/device/containment | Operations/RELEASE + DEVICE_QA + SUPPORT; exact SQL/Edge/Node/client hashes/project/runtime, fresh negative/concurrency/native/browser cases and zero-cut-compatible recovery rehearsal |
| Release source acceptance | CTO/COMMERCE/domain reviewers then owner; complete runbook §8 with dated actual receipts and explicit scope; no live-money authorization given |

Local source preparation is complete enough to review these concrete gates. The packet does
not supply a governed retention/deletion implementation, operational provider repair, hosted
compatibility proof, bank settlement or a release approval. The lead records adopt/revise/stop
and preserves observed failures and missing sensors in the existing MONEY-TIPS-01/coordination
record rather than inventing another dashboard, background worker or external delivery.
