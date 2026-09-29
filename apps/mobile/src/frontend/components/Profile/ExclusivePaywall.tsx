import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { exclusiveSubscribeLabel, exclusiveVaultCallout } from '@/data/exclusive';
import { displayValue } from '@/data/players';
import { FOCAL } from '@/theme/motion';

type ExclusivePaywallProps = {
  athleteName?: string | null;
  busy?: boolean;
  onUnlock: () => void;
};

/**
 * @purpose Prominent subscribe banner on public athlete tagged-clip profiles. Price comes from Catalogs after Publish to app.
 * @param athleteName Display name in the supporting copy.
 * @param busy Disables the banner while Stripe PaymentSheet is open.
 * @param onUnlock Starts exclusive checkout via `useTipCheckout`.
 * @returns Jade action banner with the live exclusive dollars.
 */
export function ExclusivePaywall({ athleteName, busy = false, onUnlock }: ExclusivePaywallProps) {
  const name = displayValue(athleteName, 'this athlete');
  const { live } = useAppRuntime();
  const subscribeLabel = exclusiveSubscribeLabel(live.catalog.exclusiveDollars);
  const aura = live.catalog.exclusiveAura;

  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.kicker}>Subscriber Exclusive 🔒</Text>
      <Text style={styles.body}>
        Unlock {name}'s private clips. Successful checkout grants +{aura} Aura Points and unblurs exclusive
        film immediately.
      </Text>
      <AnimatedButton
        accessibilityLabel={subscribeLabel}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        haptic="medium"
        onPress={onUnlock}
        style={styles.buttonWrap}
        contentStyle={styles.button}
      >
        <Text style={styles.buttonLabel}>
          {busy ? 'Opening PaymentSheet…' : subscribeLabel}
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
 * @purpose Vault-tab callout for fans who have not purchased the exclusive pass. Price comes from Catalogs.
 * @param busy Disables the CTA while PaymentSheet is open.
 * @param onUnlock Starts exclusive checkout.
 * @returns Callout with the live exclusive dollars.
 */
export function VaultLockedCard({ busy = false, onUnlock }: VaultLockedCardProps) {
  const { live } = useAppRuntime();
  const subscribeLabel = exclusiveSubscribeLabel(live.catalog.exclusiveDollars);
  const callout = exclusiveVaultCallout(live.catalog.exclusiveDollars);
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <Text style={styles.kicker}>Vault 🔒</Text>
      <Text style={styles.body}>{callout}</Text>
      <AnimatedButton
        accessibilityLabel={subscribeLabel}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        haptic="medium"
        onPress={onUnlock}
        style={styles.buttonWrap}
        contentStyle={styles.button}
      >
        <Text style={styles.buttonLabel}>
          {busy ? 'Opening PaymentSheet…' : subscribeLabel}
        </Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: FOCAL.mistJade,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.jadeInk,
    padding: 16,
    gap: 8,
  },
  kicker: {
    color: FOCAL.jadeInk,
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
    backgroundColor: FOCAL.jadeInk,
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
