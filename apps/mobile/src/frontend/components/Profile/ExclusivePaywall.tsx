/** UX-13 readable shared type preserves every action and required notice. Public Profile Vault callout retains the one-time access-pass terms supplied by the published catalog.
 * Opening checkout still uses the parent's existing purchase flow and reviewed payment sheet.
 * 2026-11 refresh: dark locked-vault card with a lock tile and the gold unlock action. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, KIT } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { exclusiveSubscribeLabel, exclusiveVaultCallout } from '@/data/exclusive';
import { decideExclusiveCheckout } from '@/data/storeCommerce';
import { TYPE, figtree } from '@/theme/fonts';

type VaultLockedCardProps = {
  busy?: boolean;
  onUnlock: () => void;
};

/**
 * @purpose Vault-tab callout for fans who have not purchased the exclusive pass. Price comes from Catalogs.
 * Shows the books 20/80 Exclusive split and honest store-rail copy (web Stripe vs App Store / Play).
 * @param busy Disables the CTA while PaymentSheet is open.
 * @param onUnlock Starts exclusive checkout (or the store-rail redirect when Stripe is blocked).
 * @returns Callout with the live exclusive dollars and platform rail note.
 */
export function VaultLockedCard({ busy = false, onUnlock }: VaultLockedCardProps) {
  const { live } = useAppRuntime();
  const decision = decideExclusiveCheckout();
  const subscribeLabel = decision.allowStripe
    ? exclusiveSubscribeLabel(live.catalog.exclusiveDollars)
    : 'Exclusive unavailable';
  const callout = exclusiveVaultCallout(live.catalog.exclusiveDollars);
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.lockTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="lock-closed" size={24} color={colors.onVideo} />
      </View>
      <Text style={styles.kicker}>Vault 🔒</Text>
      <Text style={styles.body}>{callout}</Text>
      <Text style={styles.split}>{decision.fanBody}</Text>
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
          {busy ? (decision.allowStripe ? 'Opening checkout…' : 'Opening…') : subscribeLabel}
        </Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.videoSurface,
    borderRadius: KIT.heroRadius,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  lockTile: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: KIT.onVideoLine,
    backgroundColor: 'rgba(244,247,245,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kicker: {
    color: colors.onVideo,
    ...TYPE.title,
    ...figtree('900'),
    letterSpacing: -0.3,
  },
  body: {
    color: colors.onVideoMuted,
    ...TYPE.body,

    ...figtree('600'),
    textAlign: 'center',
  },
  split: {
    color: colors.onVideoMuted,
    ...TYPE.caption,

    ...figtree('500'),
    textAlign: 'center',
    opacity: 0.92,
  },
  buttonWrap: {
    marginTop: 8,
    alignSelf: 'stretch',
  },
  button: {
    minHeight: 52,
    borderRadius: KIT.controlRadius,
    backgroundColor: colors.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...KIT.shadowSoft,
  },
  buttonLabel: {
    color: colors.night,
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
});
