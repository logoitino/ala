import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AdminEmpty, AdminPage } from '@/components/Admin/AdminChrome';
import { TelemetryCards } from '@/components/Admin/TelemetryCards';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAdminLens } from '@/context/AdminLensContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  buildAdminHealth,
  fetchAdminPlatformMetrics,
  fetchAdminReports,
  navGroupsForLens,
  overviewLedeForLens,
  type AdminPlatformMetrics,
  type AdminReports,
} from '@/lib/admin';
import { coverageHealth } from '@/lib/adminCoverage';
import { fetchAdminOpsInbox, type AdminOpsInbox } from '@/lib/adminCatalog';
import { EMPTY_COMPANY_REVENUE, fetchCompanyRevenueSummary, type CompanyRevenueSummary } from '@/lib/finance';
import { formatTipDollars } from '@/lib/reels';
import { SOFT_WALL_GATES } from '@tapuai/shared-types';
import { FOCAL } from '@/theme/motion';
import { getRuntimeFlag } from '@/lib/runtime';

const EMPTY_INBOX: AdminOpsInbox = {
  flags: 0,
  pendingVerify: 0,
  pendingTags: 0,
  liveGames: 0,
  parkedGames: 0,
  hiddenDrip: 0,
  lowStock: 0,
  queuedPayouts: 0,
  newFeedback: 0,
  items: [],
};

const EMPTY_REPORTS: AdminReports = {
  generatedAt: null,
  engagement: {},
  money: {},
  content: {},
  audience: {},
  live: {},
  reliability: {},
  usage: {},
  tabs: [],
  features: [],
  issues: [],
  scroll: [],
  leaders: { malo: [], hype: [], schools: [] },
  series: { clips: [], malo: [], stalls: [], dwell: [] },
};

/**
 * @purpose Admin home: live metrics, owner revenue/health strip, inbox, and desks filtered by Marketing / Owner / Engineer lens.
 * @sideEffects `get_admin_platform_metrics`, `get_company_revenue_summary`, `get_admin_reports`, `fetchAdminOpsInbox`.
 */
export function AdminOverview() {
  const router = useRouter();
  const { lens } = useAdminLens();
  const { dirty, pendingCount, live } = useAppRuntime();
  const [metrics, setMetrics] = useState<AdminPlatformMetrics>({
    highlightCount: 0,
    engagementCount: 0,
    maloCents: 0,
    openFlags: 0,
    telemetryEvents24h: 0,
  });
  const [inbox, setInbox] = useState<AdminOpsInbox>(EMPTY_INBOX);
  const [revenue, setRevenue] = useState<CompanyRevenueSummary>(EMPTY_COMPANY_REVENUE);
  const [reports, setReports] = useState<AdminReports>(EMPTY_REPORTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMetrics, nextInbox, nextRevenue, nextReports] = await Promise.all([
        fetchAdminPlatformMetrics(),
        fetchAdminOpsInbox(),
        fetchCompanyRevenueSummary(),
        fetchAdminReports(),
      ]);
      setMetrics(nextMetrics);
      setInbox(nextInbox);
      setRevenue(nextRevenue);
      setReports(nextReports);
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

  const coverage = useMemo(() => coverageHealth(live), [live]);
  const navGroups = useMemo(() => navGroupsForLens(lens), [lens]);
  const healthIssues = useMemo(() => {
    return buildAdminHealth(reports, { dirty, pendingCount, lowStock: inbox.lowStock }).filter(
      (check) => check.status !== 'ok',
    ).length;
  }, [dirty, inbox.lowStock, pendingCount, reports]);

  return (
    <AdminPage
      title="Overview"
      lede={overviewLedeForLens(lens)}
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <View style={styles.ownerStrip}>
        <Text style={styles.section}>Owner numbers</Text>
        <View style={styles.grid}>
          <OwnerStat
            label="Gross volume"
            value={formatTipDollars(revenue.gross_volume_cents)}
            hint="Money desk"
            onPress={() => router.push('/admin/money')}
          />
          <OwnerStat
            label="Company net"
            value={formatTipDollars(revenue.company_net_cents)}
            hint="Keep after payouts"
            onPress={() => router.push('/admin/money')}
          />
          <OwnerStat
            label="Athlete & operator payouts"
            value={formatTipDollars(revenue.payouts_cents)}
            hint="Queued + booked"
            onPress={() => router.push('/admin/money')}
          />
          <OwnerStat
            label="Health issues"
            value={String(healthIssues)}
            hint="Reports fail / warn"
            onPress={() => router.push('/admin/reports')}
          />
          <OwnerStat
            label="New suggestions"
            value={String(inbox.newFeedback)}
            hint="Feedback inbox"
            onPress={() => router.push('/admin/feedback')}
          />
          <OwnerStat
            label="Coverage"
            value={`${coverage.liveCount}/${coverage.total}`}
            hint={coverage.paused ? `${coverage.paused} paused` : 'All fan controls live'}
            onPress={() => router.push('/admin/coverage')}
          />
        </View>
      </View>
      <TelemetryCards metrics={metrics} />
      <View style={styles.ownerStrip}>
        <Text style={styles.section}>Soft-Wall auth</Text>
        <View style={styles.grid}>
          <OwnerStat
            label="Browse-first gates"
            value={String(SOFT_WALL_GATES.length)}
            hint="Donations · Crew · Gear goals"
            onPress={() => router.push('/admin/coverage')}
          />
          <OwnerStat
            label="Operator console"
            value={getRuntimeFlag(live, 'layouts.operatorConsole') ? 'Live' : 'Paused'}
            hint="Features → Publish"
            onPress={() => router.push('/admin/features')}
          />
          <OwnerStat
            label="Donation control"
            value={getRuntimeFlag(live, 'buttons.malo') ? 'On' : 'Off'}
            hint="Soft wall when On"
            onPress={() => router.push('/admin/features')}
          />
          <OwnerStat
            label="People / fans"
            value={String(inbox.pendingVerify)}
            hint="Verify queue · Soft-Wall fans"
            onPress={() => router.push('/admin/people')}
          />
        </View>
      </View>
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
            <Text style={styles.alertHint}>Tab, copy, or look drafts waiting on Publish to app</Text>
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
      {navGroups.map((group) => (
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

function OwnerStat({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <AnimatedButton haptic="selection" accessibilityLabel={label} contentStyle={styles.card} onPress={onPress}>
      <Text style={styles.cardHint}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.cardHint}>{hint}</Text>
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  section: {
    color: FOCAL.jadeInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  group: {
    gap: 10,
  },
  ownerStrip: {
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
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
});
