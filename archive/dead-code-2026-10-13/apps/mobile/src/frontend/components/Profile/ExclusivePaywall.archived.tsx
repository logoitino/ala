// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · excerpt from apps/mobile/src/frontend/components/Profile/ExclusivePaywall.tsx: ExclusivePaywall (with their private helpers).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

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

// Private helpers used only by the code archived above (second pass).
type ExclusivePaywallProps = {
  athleteName?: string | null;
  busy?: boolean;
  onUnlock: () => void;
};
