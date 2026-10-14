# Minor accounts: age, guardian link, signed consent and supervision (MINOR-01)

**Owner request (2026-10-14):** a legal guardian can be linked to an underage athlete's account, but must not be
"total dictatorship" over it. Athletes can go solo when they follow the law and our standards. A guardian signs a
consent form. Getting on the app must stay easy while the safeguards hold. Owner decisions the same day:

| Question | Decision |
| --- | --- |
| What the signed consent unlocks | **Money and going public.** A solo teen gets teen-safe defaults and uses the app (Highlights, tags, Crew, friends among teens). A guardian's signed consent unlocks donations being paid out for them and making their profile public. |
| What a linked guardian can do | **Supervise and approve a few.** The guardian sees the teen's settings and a safety summary and is told about changes. For **under-16s only**, going public or opening friend requests to adults sends the guardian an approve / decline request. The teen sees exactly what the guardian sees. This **replaces the PRIV-01 guardian lock** (removed from stage 1 before anything was applied). |
| Age signal | **Birth month and year** at sign-up, replacing the 13+ checkbox. |
| Under 13 | **Keep them out.** |

Chain of command: owner → `CTO` → `ENGINEERING` → `PROFILE` (owner of MINOR-01) with `AUTH`, `ONBOARDING`,
`CUSTODIAL`; `ADMIN` for the desk. Reviews: `MINOR_SAFETY` (via `TRUST_SAFETY`), `PRIVACY_ENGINEERING`,
`RLS_SECURITY` (via `SECURITY`), `CUSTODIAL`, `LEGAL` (consent form and rows F / Z / AA), `VOICE`, `QA`,
`DATA_GOVERNANCE` for the new tables.

What other apps do, as background (from memory; internet mode is off, so **unverified**): Instagram / TikTok /
YouTube ask for a birth date with a neutral screen that does not hint the right answer, make teen accounts private by
default, stop unknown adults from contacting teens, and offer opt-in parent "supervision" that shows settings and
lets a parent approve loosening for younger teens — the parent does not run the account. Under-13s are kept out
(COPPA) unless a separate kids product with verifiable parental consent exists. Several US states have passed
minor social-media laws (parental consent, age checks); many are enjoined or in flux. **Counsel confirms what
applies to us** (LEGAL rows F, Z, AA).

## 1. Age

- **Sign-up asks for birth month and year** (no day, data minimisation). Email sign-up asks on the create step;
  Apple / Google sign-up asks once after the first sign-in (the existing one-time card, now with month and year).
- We count a person as reaching an age at the start of the month **after** their birth month (up to a month late,
  never early), so the under-13 and 18+ lines are conservative.
- Bands: `under_13`, `teen_13_15`, `teen_16_17`, `adult`, and `unknown` (accounts made before this change).
- **Under 13:** the client refuses neutrally ("We can't create your account right now.") and remembers that on the
  device for 24 hours so the year cannot simply be changed and retried. The database refuses too: an email sign-up
  with an under-13 date fails, and a later under-13 entry marks the account `age_blocked_at`, makes it private and
  hidden, stops `my_profile_id()` resolving (every privacy, friend and guardian function then treats it as signed
  out) and lists it on the admin desk for deletion. The app signs out.
- **Corrections:** a person can correct their own birth month and year only to a *younger* age (safer). Older
  corrections go through support (admin, with a reason, logged). This stops a teen typing 18 later to escape the
  teen rules.
- **Who sees it:** the person and admins see the month and year; a guardian sees only the band ("13–15"). Nobody
  else, and it is never in `profiles_public` or any public function.
- **Existing accounts** (`unknown`) keep today's privacy behaviour and are asked for it (skippable; asked again every three days until added — owner 2026-10-14);
  payouts wait until an age is known, and they cannot friend teens. **New accounts with no age yet** (`not_given`,
  e.g. Apple / Google before the one-time card) must add it: until then they take no friend requests and cannot friend
  teens or link guardians. Linking a guardian, or being a guardian, needs a recorded age.

## 2. Teen-safe defaults (13–17)

Applied when a teen's age is recorded (at sign-up, or when an existing teen adds it):

| Setting | Teen default | Who can loosen it |
| --- | --- | --- |
| Account | Private (already every new account's default) | Public needs a guardian's signed consent; under-16 also needs the guardian's approval for that change |
| Friend requests | **Only other teens** (new value `teens`: accounts aged 13–17, plus their linked guardian) | 16–17: the teen. Under-16: guardian approval |
| Social links | Only me (already the default) | Teen (on a private account non-friends never see them) |
| Tag review | Review every tag (default) | Teen |
| Hide from search | Off (athletes are found to be donated to and recruited) | Teen |

Adults cannot send a friend request to a teen whose setting is "Only other teens". A teen may send a request to an
adult (a coach, a relative); the adult's setting applies. No messaging exists (by design).

## 3. Guardian link (teen invites)

- **The teen starts it:** Profile → Privacy → "Parent or guardian" → **Invite** creates a one-time 8-character code
  (valid 48 hours, 5 a day, only the newest works; stored hashed; 10 wrong tries a day per adult). The teen shares it
  however they like.
- **The guardian** (signed in, recorded age 18+) opens Parent HQ or Profile → Privacy → **Link a teen** → enters the
  code → sees the teen's first name and username → reads and **signs the consent form**. The link then waits for the
  teen to confirm "Is {name} (@username) your parent or guardian?" (7 days); until then the adult learns nothing about
  the teen.
- No adult can find a teen by username and ask to be their guardian (that would be a new contact path to minors).
- An admin-set athlete guardian (`players.guardian_id`, the custodial money guardian, "guardian on record") can sign
  from Parent HQ without a code; that link counts at once, unless the teen ended or blocked an earlier one (then the
  teen confirms again). After an admin ends a link, only support can reinstate it.
- At most **two** active guardians per teen. Either side can end the link at any time (no dictatorship); the
  other side is told. **Blocking** a guardian ends the link too. Ending the link withdraws that guardian's consent
  (below). Supervision ends automatically at 18; the record stays for history.
- A code-linked guardian is **not** the PRIV-01 `guardian` viewer: on the teen's profile they see what a stranger sees;
  supervision is only the summary in §5.

## 4. Signed consent

`guardian_consents` keeps: form version and the SHA-256 of the exact text, the typed full name as the signature,
relationship (parent / legal guardian), the two permissions (**donations paid out for the teen**, **public profile**),
time signed, and revocation (who, when). Records are append-only and are kept when accounts are deleted (ids become
null) for the period counsel sets. Only the **guardian on record** can allow payouts. Re-signing (to change permissions) revokes the old record and adds a new one, so history is
kept. The form text is versioned in `data/guardianConsent.ts` (`2026-10-14-draft`), marked a **draft for counsel**
(LEGAL row AA); the server refuses any other version.

Effects:

- **Public profile:** a teen can switch to Public only while an active consent with that permission exists (and an
  under-16 also needs the guardian's approval for the switch). If the consent is withdrawn or the link ends, a
  public teen account goes back to private and the teen is told why.
- **Donations:** fans can still donate (Donate stays public); money for a teen is recorded for the family account and
  is not paid out until the guardian on record allows payouts — `athlete_payout_status` adds `needs_guardian_consent`.
  Payouts need **positive adult evidence** otherwise: the custodial birth date, or a typed adult age on an account
  whose own Stripe payouts are on (Stripe checks the birth date — unverified); an unknown age gives
  `needs_birth_month`. When signals disagree the protective one wins. Payouts are blocked today anyway (503); this is
  the gate future payout code must pass, re-checked at transfer time. Money copy stays "recorded for your family
  account" (LEGAL row X).

## 5. Supervision (what the guardian and the teen both see)

`get_my_supervision()` (teen) and `guardian_get_supervision(teen)` return the same thing: the teen's privacy
settings, band, linked guardians (first names), consent (permissions, signed date, version), pending approval
requests, a safety summary (friend count, incoming friend requests waiting, accounts blocked, tags waiting for
approval, hidden from search — **counts, never who**) and the last 30 supervision events.

Events (`supervision_events`, kept 365 days, trimmed on insert): settings changed (which keys), guardian linked /
unlinked, consent signed / withdrawn, approval requested / decided, age corrected. Delivered in Parent HQ and the
teen's Privacy sheet (push waits for notifications, SCALE-07).

## 6. Approvals (under-16 only)

When a 13–15 teen saves **Public** or **friend requests from Anyone**, those two keys are held back, a request goes
to the guardian (one pending per change, expires after 14 days), and the rest of the save applies. The guardian
approves or declines in Parent HQ; approval re-checks the rules (consent still active, still under 18) and applies
the change. With no guardian linked, the teen is told to invite one first. The teen can cancel a request. At 16 the
teen changes these freely.

## 7. Admin handling (built first)

People desk → Privacy & safety panel adds **Age & guardians**: band and birth month / year, age-blocked state,
guardian links (names, since this is a safety case file), active consent (version, signer, relationship,
permissions, date), pending approvals. Actions: correct birth month and year (with a reason, logged as an event),
end a guardian link (with a reason). Report adds: accounts by band, teens with a guardian, teens with each consent
permission, pending approvals, under-13 accounts awaiting deletion, invites in the last 7 days. Switch:
`minors.guardian_links` (published config) pauses new invites and links without touching existing links, consent
or the teen rules (turning it off never loosens anything).

## 8. Reviews (2026-10-14)

- **Design panel** (MINOR_SAFETY, CUSTODIAL, PRIVACY_ENGINEERING, LEGAL): changes needed → applied — code-linked
  guardians get only the summary, teen confirmation, block ends the link, 48-hour codes, `not_given` for new accounts,
  positive adult evidence for payouts, payouts only from the guardian on record, append-only consent with a text
  hash, events only after linking for the guardian, retention, under-13 clips hidden at once, the form clauses. **Not
  adopted (growth first, owner may switch on):** a 72-hour wait before a new guardian can approve or sign, and a
  7-day minimum guardian account age.
- **SQL review** (RLS_SECURITY + MINOR_SAFETY): changes needed → applied → re-check confirmed; its last P2 / P3
  (re-link after an admin ends a link; Storage writes by a closed account) fixed and covered by replay checks.
- Growth / Legal / Engineering checkpoint: `docs/legal/VERIFICATION_AND_SAFE_GROWTH_REVIEW.md` (a separate session)
  reaches the same structure: teen-approved supervision, separately verified money authority.

## 9. Out of scope / follow-ups

Verifying that the guardian really is the parent (self-attested, typed signature; counsel row AA); deleting
under-13 auth users (admin desk lists them; deletion needs the service role / dashboard); push notifications; teen time
limits; under-13 kids' accounts (none); school-run teams of under-13s (none); the final consent text (counsel); a
delay before the immediate quiet decline / refusal (timing tells).
