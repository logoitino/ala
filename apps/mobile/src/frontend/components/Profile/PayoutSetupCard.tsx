/** UX-13 readable shared type preserves every action and required notice. Test-bank setup is optional and separate from account creation, identity checks and real payouts. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { LegalAckToggle, LegalModal } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, radii } from '@/constants/theme';
import { COMPLIANCE_PAYOUT } from '@/data/legal';
import { useLegalAck } from '@/hooks/useLegalAck';
import { useStripeConnect } from '@/hooks/useStripeConnect';
import { TYPE, figtree } from '@/theme/fonts';

/**
 * @purpose Server-authorized test-bank onboarding for an adult athlete or one guardian/athlete target.
 * @sideEffects JWT Connect request and Stripe browser navigation; Terms acknowledgement through useLegalAck.
 */
export function PayoutSetupCard({ playerId, athleteName, disabled = false }: { playerId?: string; athleteName?: string; disabled?: boolean } = {}) {
  const { createStripeExpressAccount, busy, stripeOnboardingComplete, payoutsEnabled, statusLoading, statusReady, error, refresh } = useStripeConnect(playerId !== undefined ? { playerId } : undefined);
  const { accepted, accept, ready, busy: legalBusy, error: legalError, refresh: refreshLegal } = useLegalAck();
  const [legalOpen, setLegalOpen] = useState(false);
  const guardian = playerId !== undefined;
  const waiting = disabled || busy || legalBusy || !ready || Boolean(playerId && (statusLoading || !statusReady));
  const blocked = waiting || !!error || ((guardian || !stripeOnboardingComplete) && !accepted);

  const onPress = () => {
    if (blocked) return;
    // The visible test disclosure and named final action work on web, where native alert buttons are unavailable.
    void createStripeExpressAccount();
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>{stripeOnboardingComplete ? 'Stripe test setup submitted' : 'Test bank setup'}</Text>
      <Text style={styles.lede}>{playerId ? `Optional Stripe test setup for ${athleteName || 'this athlete'}.` : 'Optional Stripe test setup. Creating your account never requires a bank.'}</Text>
      <Text style={styles.warn}>{COMPLIANCE_PAYOUT}</Text>
      <Text style={styles.lede}>Use synthetic test information only. Enter bank and identity details on Stripe, never in Tapua'i.</Text>
      {stripeOnboardingComplete ? (
        <Text style={styles.lede}>{payoutsEnabled ? 'Stripe reports test transfers enabled.' : 'Stripe still needs to finish enabling test transfers.'} Stripe setup does not establish identity, tax or relationship verification. Real payouts remain disabled.</Text>
      ) : null}
      {!stripeOnboardingComplete || (guardian && !accepted) ? <LegalAckToggle
        checked={accepted}
        disabled={accepted || waiting}
        onCheckedChange={(next) => {
          if (next) void accept().catch(() => undefined); // The hook supplies the fixed visible error.
        }}
        onOpenTerms={() => setLegalOpen(true)}
      /> : null}
      {legalBusy ? <Text style={styles.lede}>Saving Terms acknowledgement…</Text> : null}
      {legalError ? <Text style={styles.warn} accessibilityRole="alert">{legalError}</Text> : null}
      {legalError ? <AnimatedButton accessibilityLabel="Retry Terms status" onPress={() => void refreshLegal()} disabled={legalBusy || disabled} contentStyle={styles.manageBtn}><Text style={styles.manageLabel}>Retry Terms</Text></AnimatedButton> : null}
      {playerId && statusLoading ? <Text style={styles.lede}>Checking test bank status…</Text> : null}
      {error ? <Text style={styles.warn} accessibilityRole="alert">{error}</Text> : null}
      {error ? <AnimatedButton accessibilityLabel="Retry bank status" onPress={() => void refresh()} disabled={busy || disabled} contentStyle={styles.manageBtn}><Text style={styles.manageLabel}>Retry bank status</Text></AnimatedButton> : null}
      <AnimatedButton
        accessibilityLabel={stripeOnboardingComplete ? 'Manage test bank account' : 'Connect test bank account'}
        disabled={blocked}
        haptic="none"
        onPress={onPress}
        contentStyle={[styles.connectBtn, blocked && styles.busy]}
      >
        {busy || legalBusy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.connectLabel}>{stripeOnboardingComplete ? 'Manage test bank' : 'Continue to Stripe test bank setup'}</Text>
        )}
      </AnimatedButton>
      <LegalModal visible={legalOpen} onClose={() => setLegalOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    gap: 10,
    ...cardShadow,
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  lede: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),

  },
  warn: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('700'),

  },
  connectBtn: {
    minHeight: 52,
    borderRadius: radii.md,
        backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  connectLabel: {
    color: colors.onAccent,
    ...TYPE.body,
    ...figtree('800'),
  },
  manageBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  manageLabel: {
    color: colors.primary,
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  busy: { minHeight: 44,
    opacity: 0.7,
  },
});
