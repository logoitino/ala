# MINOR-01 app-ready evidence (2026-10-14)

Admin checkpoint: [MINOR-01-admin.md](MINOR-01-admin.md). Design: [MINOR_ACCOUNTS_DESIGN.md](../design/MINOR_ACCOUNTS_DESIGN.md).

## What the app does

- **Sign-up** (`components/Auth/SoftWallModal.tsx`, `BirthMonthField.tsx`, `lib/auth.ts`):
  - The create step asks for birth month and year; there is no 13+ checkbox any more.
  - An under-13 date gets one neutral line ("We can't create your account right now."). It creates nothing, and the
    device pauses account creation for 24 hours (only the time is stored).
  - Sign-in is never age-gated.
  - The metadata still sends the 13+ confirmation for databases without the update.
- **One-time age card** (`components/Auth/AgeConfirmModal.tsx`, `context/AuthContext.tsx`):
  - Required for accounts made after the update (Apple and Google skip the form).
  - Skippable, once per app session, for older accounts.
  - The 13+ checkbox stays on databases without the update.
  - An under-13 entry closes the account and signs out.
- **Profile → Privacy** (`components/Profile/PrivacySettingsSheet.tsx`):
  - Asks for the birth month and year when it is missing.
  - For a teen:
    - Public is disabled until a guardian signs the consent.
    - For under-16s, going public or accepting requests from anyone shows "sent to {guardian} to approve".
    - Friend request options are "Only other teens", "Anyone" and "Nobody".
    - The "Parent or guardian" box can invite (code plus Share), confirm or decline a waiting link, unlink, cancel
      requests and show "What your guardian sees".
  - For adults: "Parent or guardian? Link a teen" opens the guardian panel.
- **Guardian panel** (`components/Custodial/GuardianSupervisionPanel.tsx`, `GuardianConsentForm.tsx`,
  `SupervisionSummary.tsx`), in Parent HQ and from Privacy:
  - Enter a code, then read the draft form (a "testing only" banner shows) and sign it with a typed name.
  - The link waits for the teen's confirmation.
  - Once linked, the guardian sees the shared summary and can approve or decline, change permissions, withdraw or
    unlink.
  - There is no way to change the teen's settings.
  - Payouts can only be allowed by the guardian on record.
  - The panel shows nothing on databases without the update.
- **Payout hold copy** (`components/Verification/AthleteVerificationCard.tsx`, `lib/payoutGate.ts`): new copy for the
  reasons `needs_guardian_consent` and `needs_birth_month`.

## Checks run (Node 24.21.0, this Mac, 2026-10-14 ≈04:50 UTC)

| Command | Result |
| --- | --- |
| `pnpm check` | exit 0: 126 suites / 905 tests and every guard (typecheck, docs, copy, comments, code:unused, data map 0 rule failures, agents, detection, feature-admin) |
| Focused app tests: `PrivacyScreens` (7), `GuardianSupervision` (5), `SoftWallModal` (7), `auth`, `minors`, `guardianConsent`, `privacy` | passed inside the gate above |
| `node scripts/replay/schema-replay.mjs /tmp/books01-pg/pkg/package/dist` | 100/100 |

## Not verified

- Any device or browser rendering: the simulator can't be tapped, and Browser Bridge was not used for this pass.
- Any hosted database.
- Share-sheet behaviour on a phone.
- Under-13 timing tells (the immediate refusal).
- The consent text is a draft for counsel (LEGAL row AA) and must not reach real families.
