/** Gift receipts show read failures and Retry before any totals so an unavailable ledger never appears empty. */
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ReceiptCard } from '@/components/Profile/ReceiptCard';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii, SCOREBOARD_DIGITS, space } from '@/constants/theme';
import { TYPE } from '@/theme/fonts';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
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
  const { requireAuth } = useSoftWall();
  const { receipts, summary, loading, signedIn, error, refresh } = useFanTipHistory();

  if (!live.layouts.receipts) {
    return (
      <RuntimePaused
        title="Receipts are paused"
        lede="Turn Gift History back on in Admin → Features, then Publish to app."
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
              title="Gift History & Receipts"
            />
          </View>
        </View>

        {signedIn && !loading && !error ? <View style={styles.metrics} accessibilityRole="summary" accessibilityLabel="Gift history totals">
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDollars(summary.totalTippedCents)}</Text>
            <Text style={styles.metricLabel}>Total Given ($)</Text>
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
        </View> : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : !signedIn ? (
          <EmptyState
            kicker="Receipts"
            title="Sign in to see your gift receipts"
            lede="Guest browse stays open. Sign in to keep a record of every gift."
            actionLabel="Sign in"
            onAction={() =>
              requireAuth({
                kind: 'signin',
                resume: () => undefined,
              })
            }
            adminHref="/admin/money"
            adminLabel="Open Money"
          />
        ) : error ? (
          <EmptyState
            kicker="Receipts"
            title="Could not load gift receipts"
            lede={error}
            actionLabel="Retry"
            onAction={() => void refresh()}
          />
        ) : receipts.length === 0 ? (
          <EmptyState
            kicker="Receipts"
            title="No gift receipts yet"
            lede="Send a gift from a Highlights ⚡ clip and your receipts show up here."
            actionLabel="Watch Highlights ⚡"
            onAction={() => router.push('/' as Href)}
            adminHref="/admin/money"
            adminLabel="Open Money"
          />
        ) : (
          receipts.map((receipt, index) => (
            <ReceiptCard key={receipt.id} receipt={receipt} onViewReel={onViewReel} index={index} />
          ))
        )}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.md,
    paddingTop: 4,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
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
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
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
    ...SCOREBOARD_DIGITS,
    color: colors.primary,
    ...TYPE.section,
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
    marginTop: space.xl,
  },
});
