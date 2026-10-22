<!-- COMMERCE's staged gift/tip release packet; only dated environment receipts establish deployment or money readiness. -->
# Gift and optional tip rollout

Last updated: 2026-10-22. Feature: `MONEY-TIPS-01`. Accountable lead: **COMMERCE**, reporting
to CTO; CFO accepts accounting treatment. Actual packet executor: outside-session Codex,
not a pinned specialist or counsel. This packet prepares owner review; no SQL application,
flag publication, payment deployment, build, external delivery or live-money action is authorized by it.

Read [STATE §§0/6](../STATE.md), [model report](evidence/TIP_MODEL_REPORT.md),
[baseline](evidence/TIP_MODEL_BASELINE.md), [admin evidence](evidence/MONEY-TIPS-01-admin.md),
[checkout evidence](evidence/MONEY-TIPS-01-app.md) and
[current preflight](evidence/GIFT_ROLLOUT_PREFLIGHT.md). Source-bound local receipts live in
`.smoke/gift-release/rollout-packet-results.json`; hosted catalog observations are separately
retained in `.smoke/gift-release/hosted-preflight.json`. These private files are not a public release packet.

## 1. Contract and decision boundary

| Fact or decision | Required treatment |
| --- | --- |
| Owner's no-cut direction | New individual gifts allocate **0% platform / 100% family gross** with optional extras OFF or ON. Disabling tips cannot restore the former 10% cut. |
| Optional extras | `buttons.MONETIZATION_TIPS_ENABLED` defaults OFF in mobile, shared catalog, portal and SQL. Only published JSON `true` admits new extras. Draft/missing/malformed/unread authority cannot activate them. No tip and unchecked fee coverage remain defaults. |
| Processing coverage | Published `catalog.maloFeeDollars` is a configurable estimate/contribution, currently default $0.50. It is not an observed Stripe balance-transaction fee. Record gift, optional tip and coverage separately. |
| Payment ownership | The authenticated client still inserts the one complete `tips` row and owns subsequent gift/Aura effects. Contexts are service-only attribution, constrained test mode with `notification_authority=false`. |
| Webhook | `stripe-webhook` observes verified provider events. Do not deploy a second business credit writer or turn notification authority on while the client writes gifts. P1-05 is a separate design/acceptance gate. |
| Historical accounting | Preserve every posted allocation, paid quote and closed-period record. Historical refunds use the original recorded share and reference. Missing allocations require Finance review; today's zero rate cannot establish their original treatment. |
| Application rail | Stripe **test mode**, platform-balance charge, blocked payouts. Source has no destination transfer, `transfer_data`, `application_fee_amount` or `on_behalf_of`. |
| Live settlement | STATE §6 item8 movement/Connect, guardian/payee requirements, actual provider fees and bank settlement are separate owner/counsel/provider gates. Local no-cut arithmetic does not wait for item8; live money does. |
| Product boundaries | Personal athlete/family Gift; program Donation only for a separately classified program capability; optional Tip Tapua'i. Vault/Exclusive, booster placement and Drip remain distinct purchases/sponsorships. No charitable receipt or deductibility claim is created. |

Current Aura awards remain **10 points per $1 gifted** and can affect digital profile/card borders.
Owner + counsel must decide whether gift-linked Aura is digital consideration and whether to
retain, separate or change it before relying on a person-to-person gift exception or submitting
the store listing. This packet does not change Aura or infer a store classification. Frozen
guardian consent, final Terms/tax wording and gift/processing disclosures require versioned
counsel acceptance; old signed text is retained as evidence.

## 2. Source and database inventory

The new local migration is
[`20261022152000_no_cut_gifts_optional_tips.sql`](../../supabase/migrations/20261022152000_no_cut_gifts_optional_tips.sql).
Its exact SHA-256 is recorded in [preflight §2](evidence/GIFT_ROLLOUT_PREFLIGHT.md#2-source-inventory).
It is appended verbatim to canonical `apps/mobile/src/backend/db/schema.sql`. Never edit
applied historical migrations or replay the whole canonical schema against an existing hosted database.

### Prerequisites to resolve by objects and definitions

| Source dependency | Why it matters / ordering |
| --- | --- |
| Existing canonical core; `supabase/admin_dashboard.sql`, `supabase/app_runtime.sql` | `profiles`, `players`, `tips`, `current_user_role`, `app_runtime_config`, protected publish/role paths. Confirm hosted definitions and RLS, rather than assuming a similarly named migration matches. |
| `supabase/company_revenue.sql`, `supabase/tip_origin.sql` | Revenue source/cents columns, unique `(source,source_id)`, source triggers and origin/entry labels. Their old standalone definitions must not overwrite the new gift catch-up after cutover. |
| `20260929180000_rally_goals_thanks_platform_tip.sql` | `tips.platform_tip_cents`, separate tip trigger, Rally/custodial/source dependencies. Its historical 10% definition is superseded only after the new override. |
| `20261012210000_bookkeeping_ledger.sql` | `tips.cover_fee_cents`, payment reference uniqueness, separate fee trigger, ledger period locks/closes and report dependencies. Apply its own reviewed prerequisites first. |
| `20261013210000_function_access_hardening.sql` | Restricted revenue writers, trusted role checks, caps/admin controls. Security must verify effective grants, including PUBLIC inheritance. |
| `20261014110000_minor_accounts.sql` | `profiles.age_blocked_at` and current minor/guardian protections used by quote admission. Retain payee/privacy prerequisites already present in canonical source. |
| `20261021150000_notification_payment_context.sql` | Creates private context and observation tables plus observation/binding functions. **Absent on both environments in current catalog reads.** Apply only after its Data/Security/NOTIFY review; the migration itself needs existing Auth/players. It does not require activating notification delivery. |
| `20261013231000_family_share_in_received.sql` | Family/received reporting compatibility; stored family shares are needed for truthful history. Verify installed builds' legacy `received_cents` compatibility. |
| `20261022152000_no_cut_gifts_optional_tips.sql` | Apply last among these authorities; overrides no-cut catch-up/report, draft-first publication, service quote/binding and insert guard. Local only. |

`minor_accounts.sql` above is the repository's exact filename. The hosted name at the same
version can differ; version identity alone does not prove identical applied SQL. Inventory all
transitive requirements from the dependency headers and the target catalog before making an
owner-reviewed apply list. In particular, source `malo_target_frozen`, `require_admin_guard`,
`ledger_lock_period(text)`, `ledger_period_is_closed(date)`, the extra-revenue triggers and
the exact private context row shape must exist. An absent or incompatible prerequisite stops the rollout.

The new migration defines eight functions:

```text
company_revenue_bps(text)
sync_company_revenue_logs()
get_company_revenue_summary()
patch_app_runtime_draft(jsonb)
monetization_tips_enabled()
prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric)
record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean)
tips_payment_context_guard()
```

It replaces `tips_payment_context_guard_bi` on `tips`; it creates no new table/column in this
file, but **uses the private tables introduced by its notification-context prerequisite**.
Data ownership, finance catalog, schema/types, privacy/retention map and exit infrastructure
map must remain current across both migrations. Existing source/admin registry checkpoints
do not certify these dependencies as deployed.

## 3. Ordered staging procedure

Every stage records exact source hashes, project ref, executor, UTC start/end, commands,
results, limits and reviewers. Maintain separate development and staging apply ledgers.
The current reads find development 74 migration records and staging 27, with different legacy
baselines; counts do not prove complete parity. Do not reuse an old “all staging catch-up
missing” statement or run unreviewed `db push`/`migration repair` from those counts.

| Stage | Prerequisites and action | Exit evidence / stop rule |
| --- | --- | --- |
| 0. Freeze packet | CTO/COMMERCE choose one exact reviewed source and target project; hash source, lockfile and migrations. CFO/Data/Security/Support/QA review the relevant contracts. | Versioned signed review table in §8. Any source change invalidates affected receipts. |
| 1. Rehearse locally | Execute current no-cut SQL replay, focused checkout/backend/history/Books tests, full gate and retained detection scan under Node24. Rehearse target-derived schema compatibility in an isolated, approved environment. | Local tests pass; existing unrelated canonical reapply failure remains explicit. A fresh canonical replay is not a replay of today's hosted baseline. |
| 2. Read-only target preflight | Requery exact objects/signatures, grants/RLS, migration provenance, runtime types, tip columns/triggers/unique constraints and period gaps using §4. Finance securely reconciles provider pending/paid/refund state. | Every dependency mapped to verified target objects/applied SQL. Stripe reauthentication and unread deployed bundles must be resolved. No summary RPC that performs catch-up is used as a read-only check. |
| 3. Contain checkout and settle upgrade boundary | Owner-authorized operator stops **new** gift admission for the rollout window using a tested server/ingress procedure. `buttons.malo=false` can hide current UI but is not an old-client/server admission guarantee. Reconcile pending contexts/PaymentIntents, active sessions and paid-but-unrecorded gifts; define treatment of old clients. | Proven admission stop, bounded pending inventory and Finance-approved repair/cancellation procedure. If there is no tested server admission control or old-client handling, stop here. Do not cancel/reprice an already paid gift. |
| 4. Apply approved prerequisites, then no-cut override | Owner applies only the exact reviewed missing/compatible SQL files in dependency order, recording SQL hashes and migration provenance. Preserve current rows and flag OFF. Verify catalog and allocations before allowing new charges. | Exact new signatures, private ACL, insert guard and zero-rate function verified; authenticated/guest negative tests on synthetic staging fixtures. No blind whole-schema replay; no paid-history mutation. |
| 5. Deploy coordinated payment source | Owner-authorized Operations deploys `create-payment-intent` **with its shared money core/context adapter** to the selected project; deploy the matching Node `/api/create-payment-intent` server when that fallback exists. Service credentials are server-only; require the quote adapter on both paths. | Deployment build/bundle receipt tied to reviewed source; inspect/test actual handler. SQL/Edge versions, correct target, JWT enforcement and server-key configuration verified without printing keys. Missing quote authority refuses before Stripe creation. |
| 6. Distribute matching client/admin | Build/update the exact reviewed mobile/client/admin source with the correct EAS project/runtime/channel. Installed apps use Edge first and have no Metro fallback server. Keep extras OFF; use the read-only portal to observe the same published state. | Native/browser journey receipt names binary/update/commit/runtime/project/device. Old clients cannot silently lose extras after a successful charge. Do not resume until the admitted client versions and repair path are proven. |
| 7. Test-mode staged acceptance | Restore only the reviewed test admission, initially OFF. Run §5 cases; inspect reconciled source/Books totals and actual Stripe test outcomes. ON testing requires a separate explicit owner Publish and specialist acceptance of extras/retention/Aura/disclosures. | Zero gift cut OFF/ON; no duplicate credits, missing paid allocations or unresolved test-intent bindings; all relevant provider/device cases pass. A failure triggers §7 containment. |
| 8. Separate live-money decision | CTO provides the versioned packet to owner; counsel/CFO accept settlement, Connect/guardian controls, disclosures, fees, retention and store treatment. | Explicit live release authorization and provider/native evidence. Test-mode acceptance never substitutes for this gate. |

No deployment command or SQL apply command is preauthorized here. Follow the existing
[environment/runbook controls](ENVIRONMENTS_AND_HOSTING.md) and
[migration registry](../../supabase/migrations/README.md), including the linked-project
baseline rules; do not relink the development CLI to another project as a shortcut.

## 4. Read-only SQL checks

Run each block only after catalog checks establish its referenced tables/columns/functions.
Use an authorized protected operator read; retain counts, definitions/hashes and fixed codes,
not donor/athlete identifiers, names, metadata, client secrets or raw provider bodies.
These are review queries, **not application or repair SQL**. `get_company_revenue_summary()`
calls `sync_company_revenue_logs()` and is excluded from the read-only preflight.

```sql
-- Catalog only: exact signatures, with bigint/numeric rather than integer probes.
select to_regclass('public.notification_payment_contexts') is not null as contexts_present,
       to_regclass('public.notification_payment_observations') is not null as observations_present,
       to_regclass('public.app_runtime_config') is not null as runtime_present,
       to_regprocedure('public.prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric)') is not null as prepare_present,
       to_regprocedure('public.record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean)') is not null as bind_present,
       to_regprocedure('public.ledger_lock_period(text)') is not null as period_lock_present,
       to_regprocedure('public.ledger_period_is_closed(date)') is not null as period_closed_present;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       md5(pg_get_functiondef(p.oid)) as definition_md5,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('company_revenue_bps','sync_company_revenue_logs','get_company_revenue_summary',
  'patch_app_runtime_draft','monetization_tips_enabled','prepare_tip_payment_context',
  'record_notification_payment_context','tips_payment_context_guard');

select count(*) as guard_count
from pg_trigger t where t.tgrelid=to_regclass('public.tips')
  and t.tgname='tips_payment_context_guard_bi' and not t.tgisinternal and t.tgenabled<>'D';

select count(*) as expected_tip_columns
from information_schema.columns where table_schema='public' and table_name='tips'
  and column_name in ('amount_cents','platform_tip_cents','cover_fee_cents','stripe_payment_intent_id',
                      'fan_id','player_id','origin','entry','source_label','rally_id','wishlist_item_id');
```

Expected columns: 11. Review `pg_constraint`/`pg_indexes` definitions for both revenue
source uniqueness and tip payment-reference uniqueness, and `pg_policies`/RLS on each
private table. A disabled trigger or similarly named ineffective constraint is a failure.

```sql
-- Run only once both exact service RPCs exist. PUBLIC privilege is checked separately below.
select role_name,
 has_function_privilege(role_name,
 'public.prepare_tip_payment_context(uuid,uuid,bigint,boolean,numeric)','EXECUTE') as prepare_execute,
 has_function_privilege(role_name,
 'public.record_notification_payment_context(uuid,text,uuid,uuid,bigint,bigint,bigint,text,boolean)','EXECUTE') as bind_execute,
 has_table_privilege(role_name,'public.notification_payment_contexts','SELECT') as direct_context_read,
 has_table_privilege(role_name,'public.notification_payment_contexts','INSERT') as direct_context_insert
from (values ('anon'),('authenticated'),('service_role')) roles(role_name);

select p.proname, count(*) filter (where acl.grantee=0 and acl.privilege_type='EXECUTE') as public_execute_grants
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
left join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl on true
where n.nspname='public' and p.proname in
 ('prepare_tip_payment_context','record_notification_payment_context','monetization_tips_enabled','tips_payment_context_guard')
group by p.proname;

select count(*) as runtime_rows,
 count(*) filter (where published #> '{buttons,MONETIZATION_TIPS_ENABLED}'='true'::jsonb) as extras_published_on,
 count(*) filter (where draft #> '{buttons,MONETIZATION_TIPS_ENABLED}'='true'::jsonb) as extras_draft_on,
 count(*) filter (where jsonb_typeof(published #> '{catalog,maloFeeDollars}')='number') as numeric_fee_rows
from public.app_runtime_config where id='default';

-- Pure function: no report catch-up or write.
select public.company_revenue_bps('malo') as gift_platform_bps;
```

Expected: only service_role executes quote/bind, all direct context reads/inserts above false,
PUBLIC execute counts zero, `gift_platform_bps=0`, and published extras ON count zero at cutover.
Protected database operators remain a trust boundary. Runtime JSON counts alone do not prove
server authorization or client presentation; retain synthetic negative tests too.

```sql
-- Aggregates only; Finance controls the reviewed cutover UTC timestamp.
-- Replace the intentionally invalid timestamp before running this block.
with boundary as (select 'REPLACE_WITH_APPROVED_RELEASE_UTC'::timestamptz as at)
select count(*) as new_gift_logs,
 count(*) filter (where l.platform_cents<>0 or l.payout_cents<>l.gross_cents) as no_cut_failures,
 count(*) filter (where l.gross_cents<>t.amount_cents) as source_amount_failures
from public.company_revenue_logs l join public.tips t on l.source_id=t.id::text
cross join boundary b where l.source='malo' and t.created_at>=b.at;

select count(*) as missing_gift_logs,
 count(*) filter (where public.ledger_period_is_closed(t.created_at::date)) as missing_closed_gift_logs
from public.tips t where not exists
 (select 1 from public.company_revenue_logs l where l.source='malo' and l.source_id=t.id::text);

select count(*) as duplicate_payment_reference_groups from
 (select stripe_payment_intent_id from public.tips
  where nullif(stripe_payment_intent_id,'') is not null
  group by stripe_payment_intent_id having count(*)>1) duplicates;

select count(*) as contexts,
 count(*) filter (where payment_intent_id like 'pi_quote_%') as provisional,
 count(*) filter (where livemode is distinct from false or notification_authority is distinct from false) as authority_failures,
 count(*) filter (where total_cents<>gift_cents+cover_fee_cents+platform_tip_cents) as allocation_failures
from public.notification_payment_contexts;
```

Zero no-cut/duplicate/authority/allocation failures are necessary, not sufficient. A closed
missing row can remain historical without proving today's payments are complete. Bound contexts
without gift rows include unpaid attempts; only provider-backed reconciliation can distinguish
paid-but-unrecorded gifts. Historical accounting fingerprints/totals and close/reopen audits
must match the protected pre-apply snapshot; do not publish personal rows to prove that match.

## 5. Synthetic cases and required receipts

Local fixtures use synthetic UUIDs and fake provider references. Staging test cases need
explicitly admitted test users/athletes, Stripe test mode, protected fixture cleanup policy and
actual device/provider receipts. Do not insert production data, payment histories or signed consent
into an ad hoc harness. Approved cleanup cannot delete paid accounting or quote evidence.

| Case | Required observed result |
| --- | --- |
| OFF / ON base $50 gift | Gift source $50, family gross liability $50, platform gift $0; extras remain zero by default. |
| ON $50 + 10% tip + $0.50 cover | Total $55.50; `malo` $50/$0/$50, `tip` $5/$5/$0, `card_fee` $0.50/$0.50/$0 separately. Provider actual fee remains separately unread until fetched. |
| First draft ON / missing / malformed flag | Publish stays OFF until deliberate admin Publish; malformed/missing authority denies new extras; non-admin draft/publish denied. |
| Missing context table/service credential/quote RPC | Current declared gifts fail before Stripe creation/client-secret exposure; no automatic Node bypass of a denied/unavailable deployed Edge. |
| Issued quote then OFF/fee change | Original actor/athlete/allocation persists exactly; new extras denied. Paid lock prevents another charge and preserves recording after config change. |
| Tamper / provisional / duplicate reference | Wrong donor/athlete/cents, `pi_quote_*`, rebinding and duplicate gifts rejected. Test simultaneous independent connections on staging; sequential local tests do not prove hosted concurrency. |
| Old client without quote, zero extras | Compatibility admits only reviewed zero-extra legacy allocation; still zero gift cut. Test real old installed binaries against the staged server/schema. |
| Old client or pending old intent with extras, no context | Guard refuses it; prevent new unsafe charge before admission resumes. Existing paid attempt is reconciled/held for manual Finance repair, never retried as a new charge or downgraded to zero extras. |
| Cancellation / timeout / app killed after charge | Unpaid cancellation returns to current review; provider uncertainty stays unresolved until read. Paid-but-unrecorded state remains locked, traceable and repairable without another charge. |
| Bounds / frozen / closed-age / missing target | Gift above 100000 cents, excessive cover, invalid percent/Aura/attribution and unavailable/frozen/blocked recipient are denied before charge. Client $1 minimum and server 50-cent minimum remain documented distinct bounds. |
| History / refunds / month close | New refund uses original zero gift share; historical refund uses stored original share. Report catch-up cannot reprice historical rows. Closed missing logs surface a repair count; close/catch-up concurrency preserves period lock. |
| Gift effects / webhook repeats | Highlight/backer totals receive gift cents only; one complete `tips` insert. Repeated/out-of-order success/refund/dispute observations never create a second gift, Aura award or authoritative receipt. |
| Native/browser checkout | Amount → Options → Review, no defaults, explicit final Pay action, current tax/test/held/processing notices, accessible controls, same-render duplicate taps, cancellation and background/restore verified on named platforms. |

## 6. Repair, retention and service capacity

**Paid-but-unrecorded or missing payment reference:** SUPPORT pairs with COMMERCE,
RECONCILIATION, FINANCE_DATA and INTERNAL_CONTROLS. Use protected provider evidence to match
actor/athlete/cents/reference and the exact original quote. Stop new unsafe admission if the
recording path is incompatible. Retain payment/quote evidence and the failed recording reason.
The current hook has no legacy allocation-dropping retry; never add one as a rollout fix.
This packet supplies no manual gift-write RPC: an approved idempotent repair with explicit
actor/time, audit and reconciliation is an **unbuilt release gate** where current tools cannot repair.

**Missing closed-period logs:** Revenue owns `gift_repair_gap_count` and links existing Books.
CFO/CONTROLLER decide whether a source was missing, a posted allocation needs reversal or an
approved reopen is needed. Use the original source/settlement facts and existing audited
close/reopen/manual-entry controls; record old/new totals and Finance acceptance. No automatic
zero-rate backfill into a closed month or rewriting a posted 90/10 row.

**Abandoned contexts:** provisional/bound attempts retain actor, athlete and cents; existing
source adds no expiry, retention worker, erasure policy or abuse rate limit. DATA_GOVERNANCE,
PRIVACY_ENGINEERING, SECURITY, COMMERCE and Support must approve a governed design before
resuming broadly admitted checkout: distinguish abandoned/unpaid, pending, paid, refunded,
disputed and financially retained evidence; define retention windows, erasure/access rights,
provider cancellation checks, audit/legal holds and safe quota/error behavior. Owner/counsel
accept policy and deletion authority. Do not implement deletion or treat an old timestamp as
proof a provider intent was abandoned. Paid quotes/history remain preserved.

**Capacity:** GROWTH_ANALYTICS + INFRASTRUCTURE/COST_OPERATIONS measure aggregate creation
rate/backlog/age, failed binding/recording counts and actual provider/database quotas, with a
time window and threshold owner. SECURITY reviews authenticated abuse limits and service-role
scope. Unknown quotas/costs and missing sensors remain gaps; this packet creates no monitor,
paid worker, plan purchase or automatic purge. Route fixed codes through existing Support and
Revenue/Books; keep JWTs, secrets, names, DOB and raw payment/metadata out of logs.

**Actual processing and net settlement:** provider receipts must identify the actual test
charge, balance transaction, fee/currency/net, refund/fee treatment and reconciled Books entry,
with safe protected references. A supplied local fixture fee is not provider evidence. The
fee-cover contribution must be compared separately against provider cost; do not equate its
100% platform revenue classification with a gift cut. Approved destination/guardian settlement
must establish how liabilities reach the family and how refunds/disputes are funded before live
money or an exact “100% minus processing” settlement claim.

## 7. Containment and rollback

1. Pause new gift admission using the verified server/ingress procedure; publish extras OFF
   through the existing admin desk only when authorized. UI hiding alone cannot contain old clients.
2. Keep the migrated **zero gift cut**, historical allocations, private contexts, unique
   payment references, existing paid locks and one-writer contract. OFF does not discard an issued quote.
3. Reconcile every uncertain/pending/paid test intent, failed bind and missing gift with protected
   provider facts. Do not initiate a replacement charge, cancel a paid intent or erase its quote.
4. Roll payment/client source back only to a reviewed **zero-cut-compatible** release that
   understands the current schema and admitted allocations. Otherwise keep checkout contained
   and apply a reviewed forward repair. Never restore the historical 10% functions/constants.
5. Re-run the affected fixtures and target aggregates; compare immutable history/closed totals.
   Finance/Security/Support/QA accept recovery before the owner resumes admission.

The unapplied migration header now explicitly requires containment and a forward repair that
preserves zero-cut allocations and original history. If any proposed rollback would reintroduce
10%, lose extras, allow a second writer or delete paid
history, reject that rollback and keep containment. Preserve failed runs and source versions.

## 8. Commands and acceptance record

From the repository root, use installed Node24/dependencies. `caffeinate` prevents this Mac
from sleeping during the bounded check; it is not a background service. The cached PGlite
path is machine-local; verify its package/integrity before reuse or record **unavailable**.

```sh
export PATH="$HOME/.local/node/bin:$PATH"
node --version
git rev-parse HEAD
git status --short
git diff --check
node scripts/replay/tip-model-replay.mjs .claude/worktrees/fan-zone/.smoke/runtime/pglite-cache/package/dist
pnpm feature-admin:check --feature MONEY-TIPS-01 --require app-ready
/usr/bin/caffeinate -i pnpm detection:scan
```

`detection:scan` runs `pnpm check` and the separate portal Node tests. Record outer failures,
skipped checks and partial sensors even when another command passes. Its latest receipt is
not inherently the reviewed source: bind source hashes and the UTC run to the release packet.
The existing replay writes `.smoke/gift-copy/tip-source-sql-results.json`; preserve the prior
receipt before future execution. This packet's fresh replay instead copied the unchanged test
logic to a private runner, changing only import/output paths; its receipt documents those changes.

Before acceptance, verify the private packet's SHA-256 inventory against current files:

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const packet=JSON.parse(fs.readFileSync('.smoke/gift-release/rollout-packet-results.json','utf8'));
let changed=0;
for(const [path,expected] of Object.entries(packet.sourceHashes)) {
  const actual=createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  if(actual!==expected){ console.error('CHANGED '+path); changed++; }
}
if(changed) process.exit(1);
console.log('PASS source hashes match packet');
JS
```

| Gate / accountable reviewer | Current acceptance | Required dated receipt |
| --- | --- | --- |
| CTO + COMMERCE source/version and ordered apply plan | Pending | Exact commit/worktree hashes, target, reviewed dependencies and local evidence; executor/model disclosed. |
| CFO + CONTROLLER / INTERNAL_CONTROLS | Pending | Historical/refund/closed-gap treatment, paid-record repair, source/provider/Books reconciliation. |
| DATA_GOVERNANCE + PRIVACY_ENGINEERING | Pending | Master/finance/privacy lineage, retained-context policy, erasure/legal holds, retention/deletion design. |
| SECURITY + RLS_SECURITY | Pending | Target grants/RLS, trusted actor checks, hosted concurrency, old-client/abuse admission and secret handling. |
| SUPPORT + RELIABILITY | Pending | Tested admission containment, fixed-code failure/repair receipts, sensor gaps/thresholds and rollback rehearsal. |
| Operations / RELEASE + QA / DEVICE_QA | Pending | Actual SQL/Edge/Node/client deployment hashes, compatibility, installed-device/browser and recovery receipts. |
| COMMERCE / CONNECT + CFO + owner/counsel | Pending | Actual fees/net settlement, item8 movement, guardian/payee/Connect and refund/dispute mechanics before live money. |
| LEGAL + owner / VOICE | Pending | Versioned signed consent/Terms/tax/store language, Aura classification, product boundaries and processing claims. |
| Owner release decision | **Not given** | Explicit target/stage/scope/UTC decision after reviewing all applicable receipts and open gates. |

The lead records **adopt/revise/stop** per [innovation/handoff](INNOVATION_AND_HANDOFF.md),
linking the observed baseline (unapplied quote schema and unsafe old-client extras), alternatives
(uncoordinated upgrade / contained coordinated upgrade), this bounded synthetic rehearsal and
actual results. Current packet decision: **prepared for review; stop before hosted application**.
No pinned-domain, counsel, hosted recovery, store or live settlement acceptance is inferred.
