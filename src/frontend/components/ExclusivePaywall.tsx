import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { EXCLUSIVE_SUBSCRIBE_LABEL, EXCLUSIVE_VAULT_CALLOUT } from '@/data/exclusive';
import { displayValue } from '@/data/players';

const NEON_JADE = '#00E676';

type ExclusivePaywallProps = {
  athleteName?: string | null;
  busy?: boolean;
  onUnlock: () => void;
};

/**
 * @purpose Prominent $4.99/mo subscribe banner on public athlete tagged-clip profiles.
 * @param athleteName Display name in the supporting copy.
 * @param busy Disables the banner while Stripe PaymentSheet is open.
 * @param onUnlock Starts exclusive checkout via `useTipCheckout`.
 * @returns Neon Jade action banner: "Subscribe for $4.99/mo — Unlock Exclusive Clips ⚡".
 */
export function ExclusivePaywall({ athleteName, busy = false, onUnlock }: ExclusivePaywallProps) {
  const name = displayValue(athleteName, 'this athlete');

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.kicker}>Subscriber Exclusive 🔒</Text>
      <Text style={styles.body}>
        Unlock {name}'s private clips. Successful checkout grants +100 Aura Points and unblurs exclusive
        film immediately.
      </Text>
      <AnimatedButton
        accessibilityLabel={EXCLUSIVE_SUBSCRIBE_LABEL}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        haptic="medium"
        onPress={onUnlock}
        style={styles.buttonWrap}
        contentStyle={styles.button}
      >
        <Text style={styles.buttonLabel}>
          {busy ? 'Opening PaymentSheet…' : EXCLUSIVE_SUBSCRIBE_LABEL}
        </Text>
      </AnimatedButton>
    </View>
  );
}

type VaultLockedCardProps = {
  busy?: boolean;
  onUnlock: () => void;
};

/**
 * @purpose Vault-tab callout for fans who have not purchased the $4.99/mo pass.
 * @param busy Disables the CTA while PaymentSheet is open.
 * @param onUnlock Starts exclusive checkout.
 * @returns Callout: "Unlock the Vault for $4.99/mo to see full game breakdowns and raw practice film."
 */
export function VaultLockedCard({ busy = false, onUnlock }: VaultLockedCardProps) {
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.kicker}>Vault 🔒</Text>
      <Text style={styles.body}>{EXCLUSIVE_VAULT_CALLOUT}</Text>
      <AnimatedButton
        accessibilityLabel={EXCLUSIVE_SUBSCRIBE_LABEL}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        haptic="medium"
        onPress={onUnlock}
        style={styles.buttonWrap}
        contentStyle={styles.button}
      >
        <Text style={styles.buttonLabel}>
          {busy ? 'Opening PaymentSheet…' : EXCLUSIVE_SUBSCRIBE_LABEL}
        </Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: NEON_JADE,
    padding: 16,
    gap: 8,
  },
  kicker: {
    color: NEON_JADE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  buttonWrap: {
    marginTop: 6,
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: NEON_JADE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
