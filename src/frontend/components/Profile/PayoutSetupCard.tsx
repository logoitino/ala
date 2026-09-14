import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useStripeConnect } from '@/hooks/useStripeConnect';

/**
 * @purpose Athlete payout callout: Connect Express bank onboarding or Express dashboard.
 * @returns Setup card when onboarding is incomplete; **Payouts Active ✅** plus manage action when complete.
 * @sideEffects `useStripeConnect` → JWT Edge Function `create-stripe-account` (never mint Account Links or `sk_` in `src/frontend/`), `WebBrowser.openAuthSessionAsync`. Medium haptic on press.
 */
export function PayoutSetupCard() {
  const { createStripeExpressAccount, busy, stripeOnboardingComplete, payoutsEnabled } = useStripeConnect();

  const onPress = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Simulator / web may not expose haptics.
    }
    void createStripeExpressAccount();
  };

  if (stripeOnboardingComplete) {
    return (
      <View style={styles.card} accessibilityRole="summary">
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Payouts Active ✅</Text>
        </View>
        {payoutsEnabled ? (
          <Text style={styles.lede}>Mālo and subscription deposits can land in your connected bank.</Text>
        ) : (
          <Text style={styles.lede}>
            Express onboarding is in. Stripe still has to finish enabling transfers — open the dashboard if a
            requirement is listed.
          </Text>
        )}
        <AnimatedButton
          accessibilityLabel="Manage bank account or view Express dashboard"
          disabled={busy}
          haptic="none"
          onPress={onPress}
          contentStyle={[styles.manageBtn, busy && styles.busy]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.manageLabel}>Manage Bank Account / View Express Dashboard</Text>
          )}
        </AnimatedButton>
      </View>
    );
  }

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>Set Up Payouts ⚡</Text>
      <Text style={styles.lede}>Receive Mālo Tips & Subscription Direct Deposits</Text>
      <AnimatedButton
        accessibilityLabel="Connect bank account"
        disabled={busy}
        haptic="none"
        onPress={onPress}
        contentStyle={[styles.connectBtn, busy && styles.busy]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.connectLabel}>Connect Bank Account</Text>
        )}
      </AnimatedButton>
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
    fontSize: 18,
    fontWeight: '800',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    fontSize: 15,
    fontWeight: '800',
  },
  manageBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  manageLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  busy: {
    opacity: 0.7,
  },
});
