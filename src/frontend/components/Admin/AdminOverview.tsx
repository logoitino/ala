import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AdminEmpty, AdminPage } from '@/components/Admin/AdminChrome';
import { TelemetryCards } from '@/components/Admin/TelemetryCards';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { ADMIN_NAV_GROUPS, fetchAdminPlatformMetrics, type AdminPlatformMetrics } from '@/lib/admin';
import { fetchAdminOpsInbox, type AdminOpsInbox } from '@/lib/adminCatalog';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { FOCAL } from '@/theme/motion';

const EMPTY_INBOX: AdminOpsInbox = {
  flags: 0,
  pendingVerify: 0,
  pendingTags: 0,
  liveGames: 0,
  parkedGames: 0,
  hiddenDrip: 0,
  lowStock: 0,
  queuedPayouts: 0,
  items: [],
};

/**
 * @purpose Admin home: live metrics plus an inbox of production work (flags, verify, payouts, stock, live board).
 * @sideEffects `get_admin_platform_metrics` plus `fetchAdminOpsInbox`.
 */
export function AdminOverview() {
  const router = useRouter();
  const { dirty, pendingCount } = useAppRuntime();
  const [metrics, setMetrics] = useState<AdminPlatformMetrics>({
    highlightCount: 0,
    engagementCount: 0,
    maloCents: 0,
    openFlags: 0,
    telemetryEvents24h: 0,
  });
  const [inbox, setInbox] = useState<AdminOpsInbox>(EMPTY_INBOX);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMetrics, nextInbox] = await Promise.all([fetchAdminPlatformMetrics(), fetchAdminOpsInbox()]);
      setMetrics(nextMetrics);
      setInbox(nextInbox);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <AdminPage
      title="Overview"
      lede="Needs attention, unpublished chrome, then every categorized desk."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <TelemetryCards metrics={metrics} />
      {dirty ? (
        <AnimatedButton
          haptic="medium"
          accessibilityLabel="Unpublished chrome"
          contentStyle={styles.alert}
          onPress={() => router.push('/admin/features')}
        >
          <Text style={styles.alertCount}>{pendingCount}</Text>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>Unpublished chrome</Text>
            <Text style={styles.alertHint}>Tab or button drafts waiting on Publish to app</Text>
          </View>
        </AnimatedButton>
      ) : null}
      <Text style={styles.section}>Needs attention</Text>
      {inbox.items.length === 0 ? (
        <AdminEmpty text="Queue is clear. Live games, Drip, and flags look healthy." />
      ) : (
        inbox.items.map((item) => (
          <AnimatedButton
            key={item.href + item.label}
            haptic="medium"
            accessibilityLabel={item.label}
            contentStyle={styles.alert}
            onPress={() => router.push(item.href)}
          >
            <Text style={styles.alertCount}>{item.count}</Text>
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitle}>{item.label}</Text>
              <Text style={styles.alertHint}>{item.hint}</Text>
            </View>
          </AnimatedButton>
        ))
      )}
      <View style={styles.board}>
        <Text style={styles.boardLine}>Live on Local · {inbox.liveGames}</Text>
        <Text style={styles.boardLine}>Parked matches · {inbox.parkedGames}</Text>
        <Text style={styles.boardLine}>Hidden Drip · {inbox.hiddenDrip}</Text>
      </View>
      {ADMIN_NAV_GROUPS.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.section}>{group.label}</Text>
          <View style={styles.grid}>
            {group.items
              .filter((item) => item.href !== '/admin')
              .map((item) => (
                <AnimatedButton
                  key={item.href}
                  haptic="selection"
                  accessibilityLabel={item.label}
                  contentStyle={styles.card}
                  onPress={() => router.push(item.href)}
                >
                  <Text style={styles.cardTitle}>{item.label}</Text>
                  <Text style={styles.cardHint}>{item.hint}</Text>
                </AnimatedButton>
              ))}
          </View>
        </View>
      ))}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  section: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  group: {
    gap: 10,
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 14,
  },
  alertCount: {
    color: colors.danger,
    fontSize: 28,
    fontWeight: '800',
    minWidth: 36,
  },
  alertCopy: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  alertHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  board: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  boardLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    minWidth: 160,
    flexGrow: 1,
    flexBasis: 160,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'flex-start',
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
