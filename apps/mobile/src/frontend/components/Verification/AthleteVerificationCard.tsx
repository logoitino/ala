/** UX-13 AthleteVerificationCard.tsx preserves existing actions with readable spacing/type. */
import { StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { PAYOUT_BIRTH_MONTH_COPY, PAYOUT_GUARDIAN_CONSENT_COPY, PAYOUT_PAYEE_VERIFICATION_COPY, PAYOUT_SETUP_COPY, VERIFY_HELD_COPY, payoutUnlockedCopy } from '@/data/verification';
import { useMyVerification } from '@/hooks/useMyVerification';
import type { MyPayoutStatus } from '@/lib/payoutGate';
import type { MyVerification, SchoolCheckCode } from '@/lib/verification';
import { TYPE, figtree } from '@/theme/fonts';

/** "3:42 PM" in the viewer's locale. */
function clockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type CardState = 'hidden' | 'unclaimed' | 'pending' | 'disputed' | 'declined';

/**
 * @purpose Which state the card shows. Verified accounts and fans with no claim see nothing.
 */
export function verificationCardState(v: MyVerification | null, isAthlete: boolean): CardState {
  if (!v || v.status === 'verified') return 'hidden';
  if (v.requestStatus === 'disputed') return 'disputed';
  if (v.requestStatus === 'rejected' || v.requestStatus === 'revoked') return 'declined';
  if (v.status === 'pending' || v.requestStatus === 'pending') return 'pending';
  return isAthlete ? 'unclaimed' : 'hidden';
}

/**
 * @purpose The athlete's own verification status on Activity: "pending" badge, the held-gifts
 * message, the in-person steps, and the 6-digit code they show their athletic director or coach.
 * @param isAthlete From `useAuth().isAthlete`; fans with no claim see nothing.
 * @sideEffects `useMyVerification` (status on focus; `start_school_check`; `claim_athlete`).
 */
export function AthleteVerificationCard({ isAthlete }: { isAthlete: boolean }) {
  const my = useMyVerification(true);
  const state = verificationCardState(my.verification, isAthlete);
  if (state === 'hidden' || !my.verification) return null;
  return (
    <AthleteVerificationCardView
      state={state}
      verification={my.verification}
      payout={my.payout}
      code={my.code}
      error={my.error}
      busy={my.busy}
      onShowCode={() => void my.showCode()}
      onClaim={() => void my.claim()}
    />
  );
}

/**
 * @purpose Pure view of the card, so each state can be tested without the network.
 */
export function AthleteVerificationCardView({
  state,
  verification: v,
  payout = null,
  code,
  error,
  busy,
  onShowCode,
  onClaim,
}: {
  state: Exclude<CardState, 'hidden'>;
  verification: MyVerification;
  /** Payout gate (design §9). Null = unknown / SQL not applied: fall back to the held message. */
  payout?: MyPayoutStatus | null;
  code: SchoolCheckCode | null;
  error: string | null;
  busy: boolean;
  onShowCode: () => void;
  onClaim: () => void;
}) {
  const school = v.schoolName ?? 'your school';
  const liveCode = code && Date.parse(code.expiresAt) > Date.now() ? code : null;

  return (
    <View style={styles.card} accessibilityLabel="Athlete verification">
      <View style={styles.badgeRow}>
        <Text style={[styles.badge, state === 'pending' ? styles.badgePending : styles.badgeGrey]}>
          {state === 'pending' ? '⏳ Verification pending' : state === 'disputed' ? 'Under review' : 'Not verified'}
        </Text>
        {v.schoolName ? <Text style={styles.school}>{v.schoolName}</Text> : null}
      </View>

      {payout?.allowed ? (
        <Text style={[styles.held, styles.unlocked]}>{payoutUnlockedCopy(payout.capCents, payout.vouches)}</Text>
      ) : (
        <>
          <Text style={styles.held}>{VERIFY_HELD_COPY}</Text>
          {state === 'pending' && payout?.reason === 'needs_payout_setup' ? (
            <Text style={styles.body}>{PAYOUT_SETUP_COPY}</Text>
          ) : null}
          {payout?.reason === 'needs_guardian_consent' ? <Text style={styles.body}>{PAYOUT_GUARDIAN_CONSENT_COPY}</Text> : null}
          {payout?.reason === 'needs_birth_month' ? <Text style={styles.body}>{PAYOUT_BIRTH_MONTH_COPY}</Text> : null}
          {payout?.reason === 'needs_payee_verification' ? <Text style={styles.body}>{PAYOUT_PAYEE_VERIFICATION_COPY}</Text> : null}
        </>
      )}

      {state === 'pending' ? (
        v.hasSchool ? (
          <>
            <Text style={styles.stepsTitle}>Get your ✓ school badge</Text>
            <Text style={styles.step}>1. Find your athletic director or coach at {school}.</Text>
            <Text style={styles.step}>2. Tap “Show my school code” and read them the 6 digits.</Text>
            <Text style={styles.step}>3. They confirm you on the Tapua’i school form. Your school crest shows on your profile.</Text>
            {liveCode ? (
              <View style={styles.codeBox} accessibilityLabel={`School code ${liveCode.code.split('').join(' ')}`}>
                <Text style={styles.code}>{liveCode.code}</Text>
                <Text style={styles.codeHint}>Valid until {clockTime(liveCode.expiresAt)} · show it in person only</Text>
              </View>
            ) : v.codeExpiresAt ? (
              <Text style={styles.body}>
                A code is live until {clockTime(v.codeExpiresAt)}. Lost it? Make a new one — the old one stops working.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onShowCode}
              style={[styles.button, busy && styles.dim]}
            >
              <Text style={styles.buttonLabel}>{liveCode ? 'Make a new code' : 'Show my school code'}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.body}>Add your school in Profile → Account Capability so it knows to confirm you.</Text>
        )
      ) : null}

      {state === 'disputed' ? (
        <Text style={styles.body}>
          Another account also says it is this athlete. Tapua’i is checking with {school}. Nobody is paid while we
          check.
        </Text>
      ) : null}

      {state === 'declined' ? (
        <>
          <Text style={styles.body}>
            {school === 'your school' ? 'Your school' : school} didn’t confirm you
            {v.decisionNote ? `: “${v.decisionNote}”` : '.'} Gifts sent to you stay held until you are verified.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onClaim}
            style={[styles.button, busy && styles.dim]}
          >
            <Text style={styles.buttonLabel}>Ask again</Text>
          </Pressable>
        </>
      ) : null}

      {state === 'unclaimed' ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onClaim}
          style={[styles.button, busy && styles.dim]}
        >
          <Text style={styles.buttonLabel}>Start verification</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  badgePending: {
    backgroundColor: colors.goldSoft,
    color: colors.gold,
  },
  badgeGrey: {
    backgroundColor: colors.background,
    color: colors.textMuted,
  },
  school: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('700'),
  },
  held: {
    color: colors.text,
    ...TYPE.section,

    ...figtree('600'),
  },
  unlocked: {
    color: colors.deepGreen,
  },
  stepsTitle: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  step: { ...figtree('400'),
    color: colors.text,
    ...TYPE.body,

  },
  body: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,

  },
  codeBox: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.deepGreen,
    paddingVertical: 14,
    gap: 4,
  },
  code: {
    color: colors.text,
    ...TYPE.display,
    ...figtree('800'),
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
  codeHint: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,
  },
  button: {
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.deepGreen,
  },
  buttonLabel: {
    color: colors.onAccent,
    ...figtree('800'),
  },
  dim: {
    opacity: 0.5,
  },
  error: { ...figtree('400'),
    color: colors.danger,
    ...TYPE.body,
  },
});
