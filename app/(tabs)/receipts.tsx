import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ReceiptCard } from '@/components/Profile/ReceiptCard';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useFanTipHistory } from '@/hooks/useFanTipHistory';
import { userProfileHref } from '@/lib/navigation';
import type { FanTipReceipt } from '@/types/database';

function formatDollars(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

/**
 * @purpose Fan Tip History & Receipts: Mālo ledger summary plus per-transaction Obsidian cards.
 * @sideEffects `useFanTipHistory` → `get_fan_tip_history` RPC. View Highlight ⚡ pushes `/user/[id]`.
 */
export default function ReceiptsScreen() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { receipts, summary, loading, signedIn } = useFanTipHistory();

  if (!live.layouts.receipts) {
    return (
      <RuntimePaused
        title="Receipts are paused"
        lede="Turn Tip History back on in Admin → Features, then Publish to app."
      />
    );
  }

  const goBack = () => {
    router.push('/profile' as Href);
  };

  const onViewReel = (receipt: FanTipReceipt) => {
    if (!receipt.player_id) return;
    router.push(userProfileHref(receipt.player_id));
  };

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AnimatedButton
            accessibilityLabel="Back to Profile"
            onPress={goBack}
            contentStyle={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </AnimatedButton>
          <View style={styles.headingWrap}>
            <ScreenHeading
              compact
              kicker={live.copy.receiptsKicker}
              title="Tip History & Receipts"
            />
          </View>
        </View>

        <View style={styles.metrics} accessibilityRole="summary" accessibilityLabel="Tip history totals">
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDollars(summary.totalTippedCents)}</Text>
            <Text style={styles.metricLabel}>Total Tipped ($)</Text>
          </View>
          <View style={styles.metricRule} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{summary.athletesSupported}</Text>
            <Text style={styles.metricLabel}>Athletes Supported</Text>
          </View>
          <View style={styles.metricRule} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{summary.totalAuraEarned}</Text>
            <Text style={styles.metricLabel}>Total Aura Earned ⚡</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : !signedIn ? (
          <Text style={styles.empty}>Sign in to see your Mālo receipts.</Text>
        ) : receipts.length === 0 ? (
          <Text style={styles.empty}>No Mālo receipts yet. Drop a tip on a Reel to build your ledger.</Text>
        ) : (
          receipts.map((receipt) => (
            <ReceiptCard key={receipt.id} receipt={receipt} onViewReel={onViewReel} />
          ))
        )}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingWrap: {
    flex: 1,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  metricRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  metricValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  spinner: {
    marginTop: 24,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingTop: 16,
  },
});
