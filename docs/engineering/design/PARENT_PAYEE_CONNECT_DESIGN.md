# Parent-Payee Stripe Connect — Design (Phase 1 item 3)

Companion to [ROADMAP.md](../../product/ROADMAP.md#phase-1--compliance-driven-product-changes) and [LEGAL_BRIEFING.md](../../legal/LEGAL_BRIEFING.md) §8 item 3: *"Parent-of-record as the Connect account, athlete as beneficiary in metadata only, if counsel agrees."* Flagged in the roadmap as **"the largest single item — treat as its own sub-project, not a quick fix."** This document is the design pass. It does not change the Stripe API calls, `PayoutSetupCard`, or the account-creation flow — those changes are gated on the sign-offs below.

Status: **design only** + narrow, non-behavioral schema groundwork (see §5). No Connect code paths changed. **2026-09 update:** the interim `admin_set_player_guardian` RLS/RPC fix (§0) left the Parent screen's first-time link with no caller anywhere — ADMIN closed that gap with a manual "Link guardian" action on Expo `/admin/athletes` (`AthletesTool.tsx` → `adminSetPlayerGuardian` in `lib/adminCatalog.ts`), so an admin can now complete a first-time athlete↔parent link and unblock the Parent screen's existing consent toggle. This is a manual stopgap, not the self-service linking mechanism — §1's decision is still open.

---

## 0. How the flow works today (read before proposing changes)

Traced end to end from `apps/mobile/src/backend/api/createStripeAccount.ts`, the Edge Function twin `supabase/functions/create-stripe-account/index.ts`, `hooks/useStripeConnect.ts`, `components/Profile/PayoutSetupCard.tsx`, and `app/(parent)/parent/index.tsx`:

1. **Who triggers it:** the *signed-in user viewing their own Profile tab* taps `PayoutSetupCard` → `useStripeConnect().createStripeExpressAccount()`. There is no role check — whoever is signed in and hits the card mints/resumes an account for themselves. In practice this is the athlete, because that's the only place the card is mounted.
2. **What goes to Stripe:** `runStripeConnectForUser` (mirrored in the Edge Function) calls `stripe.v2.core.accounts.create()` with:
   - `contact_email`: the signed-in user's Supabase auth email (`authData.user.email`).
   - `identity.entity_type: 'individual'`, `country: 'us'` — a bare US individual, no minor/custodial structure.
   - `metadata: { tapuai_user_id: input.userId }` — the **auth user id of whoever is signed in**, i.e. today that's the athlete's own `auth.users.id`.
   - `display_name: "Tapua'i Athlete"` (hardcoded, not personalized).
3. **What gets stored where:** the resulting `acct_…` id and onboarding/payout flags are written back to **that same signed-in user's** `profiles` row (`stripe_connect_id`, `stripe_onboarding_complete`, `payouts_enabled`), keyed by `profiles.user_id = auth.uid()`. `useStripeConnect` also caches a copy in `AsyncStorage` per `user.id` as an optimistic fallback.
4. **Gate:** first onboarding requires `profiles.legal_terms_accepted_at` (the *signed-in user's* ToS ack, via `hasLegalAck`/`LegalAckToggle`) — again, today that's the athlete's own acceptance, with no parent involved anywhere in the call graph.
5. **Payout destination:** `POST /api/create-payout` (`createPayoutHandler`) resolves the Stripe destination as `profiles.stripe_connect_id` for `auth.uid()` — always the *caller's own* profile, never a client-supplied account id. This is correct and stays true under the new model; only *whose* profile that is changes.
6. **The existing Parent screen is a stub, not a working custodial flow.** `app/(parent)/parent/index.tsx` already has:
   - A consent toggle (`toggleConsent`) that `UPDATE`s `players.parental_consent_approved` and sets `players.guardian_id = profile.id` (the parent's own `profiles.id`) when approving.
   - A "Set up Stripe custodial payout" button — but it calls `requestPayout()` → `lib/payouts.ts` → `POST /api/create-payout`, i.e. it tries to *request a payout* ($25 test amount, hardcoded), not to run Connect *onboarding*. Since the signed-in parent's own `profiles.stripe_connect_id` was never set (nothing ever mints a Connect account for a parent-role profile), this button is a no-op/error today, not a working custodial setup path. This is the gap item 3 needs to close — the button's label promises something the current code cannot do.

**Existing data model already has the guardian link — it just isn't wired to Stripe.** `apps/mobile/src/backend/db/schema.sql`:
- `players.guardian_id uuid references public.profiles(id) on delete set null` — a roster row (`players`, the canonical "this kid" identity, independent of whether anyone has claimed a login for them yet) points at the guardian's `profiles.id`.
- `players.parental_consent_approved boolean not null default false` — set by the Parent screen above.
- `profiles.player_id uuid references public.players(id)` — the *athlete's own* claimed login points back at the same roster row (used today for tag auto-confirm: `docs/engineering/SCHEMA.md` §`reels`, "a fan tag is a claim... until the tagged athlete, their parent (`players.guardian_id`), a school operator, or admin confirms").

So `players` is already the join point between an athlete's roster identity, their own claimed profile (`profiles.player_id`), and their guardian's profile (`players.guardian_id`). No new linking table is required for the 1-parent-manages-1-or-more-kids case (see open question in §1 for multi-guardian).

**Security gap discovered during this research (existing code, not introduced here):** `players` RLS ("Staff write players", schema.sql ~2752) allows **any** authenticated `parent`-role profile to `UPDATE` **any** row in `players` — `guardian_id`/`parental_consent_approved` are not scoped to `guardian_id = auth-resolved-actor-id`. Concretely: any account that sets its role to `parent` can currently open Parent HQ and self-assign as the guardian of *any* athlete's roster row and flip `parental_consent_approved` to `true`, with zero verification that they are that athlete's actual parent. This is load-bearing the moment guardian identity gates real money movement, and is **not fixed in this pass** — tightening it is entangled with the guardian-linking judgment call in §1 (an RLS fix that just checks `guardian_id = actor` doesn't help if any stranger can still be the *first* claimant). Flagged here so it isn't lost; recommend BACKEND take it as an explicit, separate item once §1 is decided.

> **STATUS UPDATE (2026-09, BACKEND):** this specific self-claim RLS hole is now **closed**, as an interim conservative fix separate from the §1 linking-mechanism decision (which is still open — this fix does not decide it). `parent` was dropped from the "Staff write players" blanket policy; `guardian_id` can now only be set by an admin via a new narrow `SECURITY DEFINER` RPC, `admin_set_player_guardian(target_player_id, new_guardian_id)`; a new "Parents update own linked player" policy lets an already-linked parent (`guardian_id = auth-resolved actor`) keep toggling `parental_consent_approved` for their own athlete only — they can no longer change `guardian_id` at all (not to an unowned row, not to another guardian, not to null). This deliberately does **not** build a self-service "request guardian link" flow, because the design decision in §1 below (invite code vs. roster-seed import vs. scoped self-declare) determines the right shape for that and is still unresolved — building one now risked prescribing the wrong mechanism. Consequence: the Parent screen's existing consent-approve tap, which also self-assigned `guardian_id` on first use, now gets rejected by RLS until an admin links the row first; that UI was intentionally left untouched (out of scope for this pass) since fixing it product-side is exactly what §1's sign-off is for. See `apps/mobile/src/backend/db/schema.sql` (search `admin_set_player_guardian`) and `docs/engineering/SCHEMA.md`'s `players` guardian section for the full change.
>
> **STATUS UPDATE (2026-09, ADMIN):** that fix left a real hole of its own — nothing in the app called `admin_set_player_guardian`, so the Parent screen's first-time link was simply broken for any new parent/athlete pair. Closed with a manual admin tool: Expo `/admin/athletes` (`AthletesTool.tsx`) now has a per-row "Link guardian" action — pick a `players` row, pick a `parent`-role `profiles` row via typeahead, confirm, and it calls the RPC (`adminSetPlayerGuardian` in `lib/adminCatalog.ts`). Once linked, the Parent screen's existing `toggleConsent` revoke/re-approve toggle works normally for that pair. This does not touch the Stripe Connect flow, `PayoutSetupCard`, or decide any of §1's open sign-offs — it is scoped purely to unblocking the manual admin side of first-time linking.

---

## 1. Account relationship model — how a parent gets linked to a specific athlete

**Recommendation: reuse `players.guardian_id` + `players.parental_consent_approved`. Do not add a new `profiles.guardian_user_id` column.**

Reasoning:
- `players` (the roster row), not `profiles` (a claimed login), is the correct anchor. A roster row can exist before any athlete has signed up/claimed it (seeded by admin/coach), and the parent-consent relationship is conceptually "who is responsible for *this kid*," which should not depend on the kid having created an account yet.
- A `profiles.guardian_user_id` column would create a second, parallel source of truth for the exact same fact `players.guardian_id` already encodes, with no way to keep them in sync without picking one as canonical anyway — and the tag-confirmation feature already depends on `players.guardian_id` being that canonical column.
- The full chain for "which Stripe account should this athlete's Mālo money go to" becomes: signed-in athlete → `profiles.player_id` → `players.id` → `players.guardian_id` → guardian's `profiles.id` → guardian's `profiles.stripe_connect_id`. Every link in that chain already exists in the schema today, except the last one isn't wired into the Connect call (that's §2).

Proposed groundwork (implemented in this pass, see §5): a `players.guardian_consent_at timestamptz` column recording *when* consent was granted, alongside the existing boolean — the same pattern already used for `profiles.legal_terms_accepted_at`. A boolean alone is a weak record to point to if a payment dispute or association ever asks "when and how was consent given"; a timestamp costs nothing and matches an existing convention. This is additive and not wired into the Parent screen UI in this pass — it exists as a column, ready for whichever consent flow is chosen in the sign-offs below.

Open questions — **NEEDS SIGN-OFF:**

- **NEEDS SIGN-OFF: does a guardian need to exist *before* an athlete can claim their roster spot at all, or only before Connect/payout onboarding specifically?** Today an athlete can claim `profiles.player_id` and use every feature (Highlights, Aura, Spotlight, Vault) with `guardian_id` null. The cheapest-to-build option is "guardian only required at the Connect step" (matches Stripe's own minor-onboarding pattern — a parent completes onboarding, not sign-up). The stricter option (guardian required at claim time) is a bigger product/legal call about whether a minor can use the app *at all* unsupervised, which is outside engineering's call to make.
- **NEEDS SIGN-OFF: how does the parent-athlete link get *established* (not just recorded)?** Three real options, each with different fraud/UX tradeoffs, none decided here:
  1. **Athlete-initiated invite code/link** (athlete generates a code from their Profile, parent redeems it during Parent HQ sign-up) — closes the "any parent can self-claim any athlete" hole in §0, but is more onboarding friction and a new code-generation surface.
  2. **Roster-seed data** (school/admin pre-populates `guardian_id` from an existing enrollment record at team-catalog import time) — no invite friction, but assumes the school already has verified guardian contact info wired into the import, which is a data-sourcing question for FACILITATOR/ADMIN, not engineering.
  3. **Keep today's self-declared toggle** but scope the RLS so only the *first* claimant can set `guardian_id` (subsequent claims by a different profile are rejected, not silently overwritten) — cheapest fix, but still trusts the first person who gets there, which is weak if two strangers race to claim the same popular athlete.
- **NEEDS SIGN-OFF: one guardian or many per athlete?** The current schema is 1:1 (`players.guardian_id`, a single FK). Split-custody / two-parent households may need to see both a consent record and (potentially) a payout-visibility view without both needing individual Connect accounts. If multiple guardians must be supported, that's a new join table (`player_guardians`), not a column tweak — deliberately not built here since single-guardian may be sufficient for a first launch state and a table with no product consumer yet is speculative schema.
- **NEEDS SIGN-OFF: does the athlete need to be 18 to skip the guardian requirement entirely, and if so, how do we know?** `profiles.age_confirmed_13_plus` is a deliberate COPPA data-minimization choice (self-attested 13+, no birthdate — see `docs/engineering/SCHEMA.md`). That column cannot distinguish a 14-year-old from a 24-year-old, so it cannot answer "is a guardian required for this Connect onboarding." Either (a) every athlete Connect onboarding routes through a guardian regardless of age (simplest, most protective, but adult college athletes would need a "guardian" too, which is awkward framing), or (b) a new, narrower age/adult-status signal is collected at the Connect step specifically (not at sign-up, preserving the COPPA minimization elsewhere) — e.g., a self-attestation "I am 18+" at the moment Connect is first opened. This is a real product/legal call, not an engineering default, and directly determines whether `PayoutSetupCard` needs a branch at all for "adult athlete, no guardian" vs. always routing through the parent surface.
- ~~**NEEDS SIGN-OFF (carried from §0):** the RLS hole letting any `parent`-role account self-assign as guardian of any athlete needs a fix~~ — **CLOSED (2026-09, interim fix, see status note in §0 above).** The shape landed is the roster-seed-compatible one from this bullet's second option: `guardian_id` is now admin-set only (via `admin_set_player_guardian`), and `parent` can only flip `parental_consent_approved`, never `guardian_id`, on a row where `guardian_id` already equals them. If the invite-code model is chosen instead, `admin_set_player_guardian` (or an equivalent RPC with the same admin/authorized-caller shape) is the natural place to call from that code-redemption path — the RLS shape does not need rewriting, only a new caller.

---

## 2. Stripe Connect Express account-creation call — what changes

Both `runStripeConnectForUser` (Expo API fallback) and the Edge Function `create-stripe-account/index.ts` currently contain the account-creation logic *twice* (already a known duplication, not introduced by this design). Whatever changes here needs to land in both, or the Edge Function twin should become the only implementation and the Expo route reduced to a thin proxy — worth doing regardless of which model below is chosen, to stop the duplication from drifting further.

Proposed shape once a linking model from §1 is chosen:

- **Whose email/identity goes to Stripe:** the **guardian's** `auth.users.email` and identity (`contact_email`, `identity.entity_type: 'individual'`), resolved server-side from `players.guardian_id → profiles.user_id`, not the athlete's. The account-creation call would need to accept "on behalf of which athlete" as an input (today it implicitly means "the caller"), resolved from `players.id` looked up via the athlete's `profiles.player_id` — never a client-supplied `playerId`/`accountId`, matching the existing "never trust a client-supplied `destinationAccountId`" rule from `.claude/agents/commerce.md`.
- **How the athlete is referenced in Stripe metadata:** `metadata` gains the athlete's roster id, e.g. `{ tapuai_guardian_user_id: <guardian auth uid>, tapuai_athlete_player_id: <players.id>, tapuai_relationship: 'parent_of_record' }`, so the Connect account is unambiguously traceable to which athlete it was opened for even though the account *holder* is the parent. `display_name` should likely become something like `"{guardian_full_name} (parent of {athlete_full_name})"` rather than the current hardcoded `"Tapua'i Athlete"` — **NEEDS SIGN-OFF**: exact copy/format is a product/legal-copy call (LEGAL owns copy per `.claude/agents/commerce.md`'s "do not change legal copy" boundary), not an engineering default.
- **Who is gated by ToS:** `legal_terms_accepted_at` should almost certainly move to being checked (and stamped) on the **guardian's** profile for the Connect step, since the guardian is the one entering into the Stripe agreement. **NEEDS SIGN-OFF:** does the athlete still need their *own* separate ToS ack for using the app's non-money features, in addition to the guardian's Connect-specific ack? Likely yes (two different agreements, two different signers) but that's a legal-copy/consent-flow decision, not something to default silently.
- **What does NOT change:** `createPayoutHandler`'s core rule — "destination is resolved server-side from the signed-in row's `stripe_connect_id`, a client `destinationAccountId` is ignored" — stays exactly true. The only change is that for an athlete-linked Connect flow, the "signed-in row" whose `stripe_connect_id` matters for *payout* is the guardian's, and the code path that currently assumes "signed-in user == account owner" everywhere needs one indirection hop added (through `players.guardian_id`) specifically for the minor/custodial case. An adult athlete with no guardian (pending the §1 age sign-off) would keep today's direct self-onboarding path.

None of this is implemented in this pass — it depends on the §1 sign-offs (there's no single "guardian's profile" to resolve until the linking mechanism is chosen, and no way to know when to route through a guardian at all until the age/adult sign-off lands).

---

## 3. UI changes needed

Not implemented in this pass (`PayoutSetupCard.tsx` and the Parent screen are read-only for this work). Once §1/§2 are decided:

- **NEEDS SIGN-OFF: does the athlete still initiate Connect (with a required parent co-sign step first), or does the parent initiate it directly from Parent HQ ("Connect bank account for [athlete name]")?** Both are legitimate UX shapes and Stripe supports either:
  - *Athlete-initiates, parent-co-signs*: keeps `PayoutSetupCard` on the athlete's Profile as the entry point, but it becomes disabled/pending until `players.parental_consent_approved` is true for that athlete's roster row, with copy like "Waiting on your parent to approve" — mirrors how the card already gates on `legal_terms_accepted_at` today, just adds a second precondition.
  - *Parent-initiates*: `PayoutSetupCard` (or an equivalent component) needs to move into/be duplicated on the Parent HQ screen, scoped per linked athlete (`players` rows where `guardian_id = actor`), with copy like "Connect bank account for {athlete.name}" per the task's own framing. This likely also means the *Parent* screen's current "Set up Stripe custodial payout" button (which today wrongly calls the payout-request endpoint, see §0) gets replaced with a real per-athlete Connect card, not just a relabeled button.
  - A hybrid (athlete sees a disabled card pointing them to "ask your parent," parent sees the actionable card) is also plausible and may be the best of both, but is extra surface area to build and test.
- Regardless of which shape wins, the Parent HQ roster list (`useRoster()` inside `app/(parent)/parent/index.tsx`) currently fetches **every** player in the database (`supabase.from('players').select('*')` with no filter) and relies on the caller only rendering rows relevant to them — it is not scoped to `guardian_id = actor` at the query level. That's a pre-existing gap (not introduced here, and `useRoster.ts` is outside this pass's read-only file list) worth a BACKEND/COMMERCE follow-up once real payout amounts are visible on that screen, since an unscoped fetch is a bigger problem once it's rendering financial state per athlete rather than just consent toggles.
- Whatever UI ships needs a clear, athlete-visible statement of §4's invariant ("the money you see credited to you in the app doesn't change — only where it physically deposits changes") so athletes don't read "parent connects the bank account" as "parent gets the Mālo."

---

## 4. What stays exactly the same

This is the one section with no open judgment calls — restating it explicitly so it's not lost in the surrounding uncertainty:

- The athlete is still who **earns** Mālo/Aura in the app's own ledger. `tips`, `subscriptions`, `add_user_aura`, `players.aura_points`, Spotlight standings, receipts (`useFanTipHistory`) all continue to attribute to the athlete (`players.id` / the athlete's `profiles.id`) exactly as today. Nothing about the earning/ledger/attribution side of Mālo changes.
- Only the **bank-account/payout plumbing** changes: which Stripe Connect Express account is the destination when Mālo revenue is actually transferred out of the platform. The athlete's in-app numbers (Aura points, Mālo totals shown on their profile, receipts) are computed from `tips`/`subscriptions`/`players.aura_points` and are entirely independent of whose name is on the Connect account — this is already true today since `createPayoutHandler` is a separate code path from the Aura/ledger RPCs, and stays true under the parent-payee model.
- `useTipCheckout.ts`, the `tips`/`subscriptions` RLS policies, and the Mālo freeze-switch (`malo_frozen`, `set_malo_freeze`) are untouched by this design and out of scope for this pass per the task boundaries — freeze-switch enforcement continues to apply the same way regardless of who the eventual payout destination is, since it blocks at the `tips`/`subscriptions` INSERT layer, upstream of payout entirely.

---

## 5. Groundwork implemented in this pass

Schema-only, additive, non-breaking, no UI/API wiring, no judgment call attached:

1. `players.guardian_consent_at timestamptz` (nullable) — records *when* `parental_consent_approved` was last set to true, mirroring the existing `profiles.legal_terms_accepted_at` pattern. Not yet written by any code path (the Parent screen isn't touched in this pass); exists so the eventual consent-flow implementation has a dated record to write to instead of inventing one under time pressure later.
2. `create index if not exists players_guardian_id_idx on public.players (guardian_id);` — supports the "list an athlete's guardian" / "list a guardian's linked athletes" lookups the eventual Connect flow needs in both directions; no such index existed despite `guardian_id` already being used in the tag-confirmation RPC (`schema.sql` ~1212).
3. `docs/engineering/SCHEMA.md` updated to document both of the above plus a pointer to this design doc from the `players` section, so the next engineer touching Connect/guardian code finds this document instead of re-deriving the model.

Explicitly **not** implemented (each depends on a §1/§2/§3 sign-off): any new `profiles.guardian_user_id`-style column (design rejects it, see §1), any RLS change to `players` (the hijack fix in §0 depends on which linking mechanism is chosen), any change to `createStripeAccount.ts` / the Edge Function twin, any change to `useStripeConnect.ts`, any change to `PayoutSetupCard.tsx` or the Parent screen, any age/adult-status data collection.

---

## 6. Sign-off checklist (copy of every flagged item above, for whoever reviews this)

- [ ] Guardian required before roster-claim, or only before Connect onboarding? (§1)
- [ ] Parent-athlete link mechanism: invite code, roster-seed import, or scoped self-declare? (§1)
- [x] Single guardian per athlete, or multi-guardian join table? (§1) — **owner 2026-09-29: single guardian of record per athlete** (`custodial_accounts.player_id` is the PK; §7)
- [x] How do we know an athlete is an adult (skip guardian) given deliberate no-birthdate COPPA design? (§1) — **birth date collected from the guardian at custodial setup only**, stored in `athlete_birthdates`, never readable by clients; handover computed from it (§7). Still open: athletes who are already 18 at sign-up with no guardian.
- [x] `players` RLS fix for the self-claim-any-athlete hole — **closed 2026-09** via admin-only `guardian_id` (new `admin_set_player_guardian` RPC) + a narrower parent-update-own-linked-row policy; the *linking mechanism* sign-off itself (§1) is still open (§0, §1)
- [ ] Connect `display_name` / metadata copy for the parent-of-record account (§2, LEGAL copy)
- [ ] Does the athlete keep a separate ToS ack in addition to the guardian's Connect-specific ack? (§2)
- [x] Athlete-initiates-with-co-sign vs. parent-initiates-directly UI shape (§3) — **parent initiates per athlete in Parent HQ; the athlete co-signs every withdrawal in Activity** (§7)
- [ ] `useRoster()` unscoped-fetch follow-up once Parent HQ shows real financial state (§3, non-blocking) — Parent HQ now **filters** to `guardian_id` = caller (2026-09-29); the fetch itself is still unscoped

---

## 7. Owner rules (2026-09-29)

The owner set these rules for money held for a minor athlete:

1. **The athlete is told.** Every gift appears in the athlete's Activity, and a card at the top
   says whose custodial account holds it and until when.
2. **No withdrawal without the athlete.** The guardian asks; the athlete approves or declines in
   the app. Nothing leaves the account on the guardian's say alone.
3. **Automatic handover.** At 18, or the state's age of majority / UTMA transfer age, control
   passes to the athlete. From that day the athlete can move the money to their own account and
   the guardian can no longer ask.
4. **One athlete per custodial account.** The guardian's payout account holds only that athlete's
   money; a guardian with two athletes has two accounts.
5. **A bank account in the athlete's name is strongly encouraged.** The guardian oversees
   everything until the handover age.

**What is built (records only — no money moves).** `supabase/legacy/custodial_money.sql`, mirrored in
`schema.sql`, documented in `SCHEMA.md`: `custodial_accounts`, `athlete_birthdates`,
`custodial_withdrawals` and the RPCs that enforce rules 1–4 on the server. The athlete side
requires `verification_status = 'verified'` because `profiles.player_id` is still client-writable
(STATE §5). Client: `components/Custodial/` in Activity (athlete) and Parent HQ (guardian).
`handover_age` defaults to 18 and an admin can set 18–21 per athlete (`admin_set_custodial_terms`).
Payouts still return 503.

**Stripe mechanics to verify before live money** (payments counsel + Stripe support):

- [ ] Set the guardian's Connect account to a **manual payout schedule**, and create a payout only
      after the athlete approves the matching `custodial_withdrawals` row (status `approved` → `paid`).
- [ ] At handover, move the remaining balance to the **athlete's own Express account** — a transfer
      reversal from the guardian's account plus a new transfer, or re-pointing future destination
      charges. Confirm which Stripe allows and what it costs.
- [ ] How long funds may sit in a connected account before Stripe pays them out automatically or
      asks questions.
- [ ] Whether the guardian's Express account can pay out to a bank account titled in the athlete's
      name (or a UTMA custodial account), and what KYC that needs.
- [ ] **Handover age per state** — counsel confirms. Utah's UTMA transfer age is 21, not 18; some
      states let the custodian choose. Set `handover_age` per athlete from counsel's table.
- [ ] Whether holding gifts under these rules makes the guardian's account a UTMA custodianship
      in law, and what disclosures that requires (LEGAL copy).
