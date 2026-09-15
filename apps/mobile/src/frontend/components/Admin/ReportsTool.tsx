import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

import { AdminBarChart, AdminMixChart } from '@/components/Admin/AdminCharts';
import {
  AdminBtn,
  AdminEmpty,
  AdminNotice,
  AdminPage,
  AdminPills,
  AdminRow,
} from '@/components/Admin/AdminChrome';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  buildAdminHealth,
  fetchAdminReports,
  type AdminHealthCheck,
  type AdminHealthStatus,
  type AdminReportLeader,
  type AdminReportSection,
  type AdminReports,
} from '@/lib/admin';
import { fetchAdminOpsInbox } from '@/lib/adminCatalog';
import { formatTipDollars } from '@/lib/reels';
import { FOCAL } from '@/theme/motion';

type ReportId = 'health' | 'usage' | 'engagement' | 'money' | 'content' | 'audience' | 'live' | 'reliability' | 'leaders';

const EMPTY: AdminReports = {
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

const SECTIONS: { id: ReportId; label: string; hint: string; href?: Href }[] = [
  { id: 'health', label: 'Health', hint: 'Pass / warn / fail across the stack' },
  { id: 'usage', label: 'Usage', hint: 'Where fans scroll, stay, tap, and report' },
  { id: 'engagement', label: 'Engagement', hint: 'How Highlights ⚡ and Crew are used', href: '/admin/highlights' },
  { id: 'money', label: 'Money', hint: 'Mālo windows, payouts, subscribe', href: '/admin/money' },
  { id: 'content', label: 'Content', hint: 'Vault, flags, Flash Unlock, mix', href: '/admin/moderation' },
  { id: 'audience', label: 'Audience', hint: 'People and schools', href: '/admin/people' },
  { id: 'live', label: 'Live ops', hint: 'Games, polls, Drip, boosters', href: '/admin/games' },
  { id: 'reliability', label: 'Reliability', hint: 'Stalls and checkout', href: '/admin/qa' },
  { id: 'leaders', label: 'Leaders', hint: 'Who the app is rewarding' },
];

const LABELS: Record<string, string> = {
  clips_live: 'Live clips',
  clips_24h: 'Clips uploaded (24h)',
  clips_7d: 'Clips uploaded (7d)',
  clips_prev_7d: 'Clips previous 7d',
  seki: 'Seki',
  aura: 'Aura',
  flex: 'Flex',
  hype_votes: 'Hype votes',
  saves: 'Saves',
  crew_follows: 'Crew follows',
  malo_cents_all: 'Mālo all-time',
  malo_count_all: 'Mālo count',
  malo_cents_24h: 'Mālo (24h)',
  malo_count_24h: 'Mālo count (24h)',
  malo_cents_7d: 'Mālo (7d)',
  malo_count_7d: 'Mālo count (7d)',
  malo_cents_prev_7d: 'Mālo previous 7d',
  avg_tip_cents_7d: 'Avg Mālo (7d)',
  queued_payouts: 'Queued payouts',
  paid_payouts_cents: 'Paid out',
  active_subs: 'Active subscribe',
  flagged: 'Open flags',
  removed: 'Removed clips',
  vault: 'Vault clips',
  exclusive_clips: 'Exclusive clips',
  flash_live: 'Flash Unlock live',
  spotlight_live: 'Live Spotlight awards',
  qna: 'Subscriber Q&A',
  game_play: 'Game Play',
  train_like_me: 'Train Like Me',
  serve_like_me: 'Serve Like Me',
  profiles: 'Profiles',
  athletes: 'Athletes',
  verified: 'Verified athletes',
  admins: 'Admins',
  schools: 'Schools',
  pending_verify: 'Verify queue',
  live_games: 'Live games',
  parked_games: 'Parked games',
  poll_votes: 'Poll votes',
  active_polls: 'Active polls',
  active_boosters: 'Active boosters',
  drip_skus: 'Drip SKUs on rack',
  stalls_24h: 'Stalls (24h)',
  reconnects_24h: 'Reconnects (24h)',
  checkouts_24h: 'Checkout events (24h)',
  avg_checkout_ms_24h: 'Avg Mālo checkout ms',
  events_24h: 'Telemetry events (24h)',
  sessions_24h: 'Tab sessions (24h)',
  dwell_ms_24h: 'Time on tabs (24h)',
  dwell_ms_7d: 'Time on tabs (7d)',
  taps_24h: 'Feature taps (24h)',
  taps_7d: 'Feature taps (7d)',
  issues_24h: 'Control issues (24h)',
  issues_7d: 'Control issues (7d)',
  feedback_bugs_open: 'Open bug reports',
  avg_scroll_pct_7d: 'Avg scroll depth (7d)',
};

const STATUS_RANK: Record<AdminHealthStatus, number> = { fail: 0, warn: 1, ok: 2 };

function formatDwell(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return rem ? `${min}m ${rem}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function formatValue(key: string, value: number): string {
  if (key.includes('cents')) return formatTipDollars(value);
  if (key.includes('dwell_ms')) return formatDwell(value);
  if (key.includes('scroll_pct')) return `${value}%`;
  return value.toLocaleString();
}

function cardsFor(section: AdminReportSection) {
  return Object.entries(section).map(([key, value]) => ({
    key,
    label: LABELS[key] ?? key.replace(/_/g, ' '),
    value: formatValue(key, value),
  }));
}

function LeaderList({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: AdminReportLeader[];
  kind?: 'cents' | 'dwell' | 'pct';
}) {
  const meta = (value: number) => {
    if (kind === 'cents') return formatTipDollars(value);
    if (kind === 'dwell') return formatDwell(value);
    if (kind === 'pct') return `${value}%`;
    return value.toLocaleString();
  };
  return (
    <View style={styles.leaderBlock}>
      <Text style={styles.section}>{title}</Text>
      {rows.length === 0 ? (
        <AdminEmpty text="No rows yet." />
      ) : (
        rows.map((row, index) => (
          <AdminRow key={`${title}-${row.label}-${index}`} title={`${index + 1}. ${row.label}`} meta={meta(row.value)} />
        ))
      )}
    </View>
  );
}

function HealthRow({ check, onOpen }: { check: AdminHealthCheck; onOpen: () => void }) {
  return (
    <View style={styles.healthRow} accessibilityRole="summary" accessibilityLabel={`${check.label} ${check.status}`}>
      <View style={[styles.healthDot, check.status === 'ok' && styles.dotOk, check.status === 'warn' && styles.dotWarn, check.status === 'fail' && styles.dotFail]} />
      <View style={styles.healthCopy}>
        <Text style={styles.healthTitle}>{check.label}</Text>
        <Text style={styles.healthMeta}>
          {check.category} · {check.detail}
        </Text>
      </View>
      {check.href ? <AdminBtn label="Open" onPress={onOpen} /> : null}
    </View>
  );
}

/**
 * @purpose Usage graphs, health checks, money, content, audience, live ops, reliability, and leaders.
 * @sideEffects `get_admin_reports` + `fetchAdminOpsInbox`.
 */
export function ReportsTool() {
  const router = useRouter();
  const { dirty, pendingCount } = useAppRuntime();
  const [reports, setReports] = useState<AdminReports>(EMPTY);
  const [lowStock, setLowStock] = useState(0);
  const [tab, setTab] = useState<ReportId>('health');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextReports, inbox] = await Promise.all([fetchAdminReports(), fetchAdminOpsInbox()]);
      setReports(nextReports);
      setLowStock(inbox.lowStock);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const health = useMemo(
    () =>
      buildAdminHealth(reports, { dirty, pendingCount, lowStock }).sort(
        (left, right) => STATUS_RANK[left.status] - STATUS_RANK[right.status],
      ),
    [dirty, lowStock, pendingCount, reports],
  );
  const failing = health.filter((item) => item.status !== 'ok').length;
  const meta = SECTIONS.find((item) => item.id === tab)!;
  const metricTab = tab === 'health' || tab === 'leaders' ? null : tab;
  const cards = metricTab ? cardsFor(reports[metricTab]) : [];

  return (
    <AdminPage
      title="Reports"
      lede="Health first, then where fans scroll, which tabs they stay on, what they tap, and which controls fail."
      refreshing={loading}
      onRefresh={() => void refresh()}
      error={error}
    >
      <AdminNotice
        text={
          failing === 0
            ? 'Every health check is green.'
            : `${failing} categor${failing === 1 ? 'y needs' : 'ies need'} a look.`
        }
        tone={failing === 0 ? 'ok' : 'warn'}
      />
      <AdminPills
        label="Desk"
        items={SECTIONS.map((item) => ({ id: item.id, label: item.label }))}
        value={tab}
        onChange={setTab}
      />
      <Text style={styles.hint}>
        {meta.hint}
        {reports.generatedAt ? ` · ${reports.generatedAt.replace('T', ' ').slice(0, 16)} UTC` : ''}
      </Text>

      {tab === 'health' ? (
        <>
          <AdminBarChart title="Clips · 7 days" points={reports.series.clips} />
          <AdminBarChart title="Mālo · 7 days" points={reports.series.malo} formatValue={formatTipDollars} accent={FOCAL.electricGold} />
          {health.map((check) => (
            <HealthRow
              key={check.id}
              check={check}
              onOpen={() => {
                if (check.href) router.push(check.href);
              }}
            />
          ))}
        </>
      ) : null}

      {tab === 'usage' ? (
        <>
          <AdminBarChart title="Time on tabs · 7 days" points={reports.series.dwell} formatValue={formatDwell} />
          <AdminBarChart
            title="Where they stay"
            points={reports.tabs.map((row) => ({ day: row.label.slice(0, 10), value: row.value }))}
            formatValue={formatDwell}
          />
          <LeaderList title="Time on tabs (7d)" rows={reports.tabs} kind="dwell" />
          <LeaderList title="Features they use" rows={reports.features} />
          <LeaderList title="Hottest issues" rows={reports.issues} />
          <LeaderList title="Scroll depth" rows={reports.scroll} kind="pct" />
        </>
      ) : null}

      {tab === 'engagement' ? (
        <>
          <AdminBarChart title="Uploads · 7 days" points={reports.series.clips} />
          <AdminMixChart
            title="Hype mix"
            slices={[
              { label: 'Seki', value: reports.engagement.seki ?? 0, color: FOCAL.jadeInk },
              { label: 'Aura', value: reports.engagement.aura ?? 0, color: '#B388FF' },
              { label: 'Flex', value: reports.engagement.flex ?? 0, color: FOCAL.electricGold },
            ]}
          />
        </>
      ) : null}

      {tab === 'money' ? <AdminBarChart title="Mālo · 7 days" points={reports.series.malo} formatValue={formatTipDollars} accent={FOCAL.electricGold} /> : null}

      {tab === 'content' ? (
        <AdminMixChart
          title="Clip mix"
          slices={[
            { label: 'Game Play', value: reports.content.game_play ?? 0, color: FOCAL.jadeInk },
            { label: 'Train Like Me', value: reports.content.train_like_me ?? 0, color: '#00E5FF' },
            { label: 'Serve Like Me', value: reports.content.serve_like_me ?? 0, color: FOCAL.electricGold },
          ]}
        />
      ) : null}

      {tab === 'reliability' ? (
        <AdminBarChart title="Stalls · 7 days" points={reports.series.stalls} accent="#FF6B6B" />
      ) : null}

      {tab === 'leaders' ? (
        <>
          <AdminBarChart
            title="Mālo received"
            points={reports.leaders.malo.map((row) => ({ day: row.label.slice(0, 8), value: row.value }))}
            formatValue={formatTipDollars}
            accent={FOCAL.electricGold}
          />
          <LeaderList title="Mālo received" rows={reports.leaders.malo} kind="cents" />
          <LeaderList title="Hottest clips" rows={reports.leaders.hype} />
          <LeaderList title="Athletes by school" rows={reports.leaders.schools} />
        </>
      ) : null}

      {cards.length > 0 ? (
        <View style={styles.grid}>
          {cards.map((card) => (
            <View key={card.key} style={styles.card} accessibilityRole="summary" accessibilityLabel={`${card.label} ${card.value}`}>
              <Text style={styles.kicker}>{card.label}</Text>
              <Text style={styles.value}>{card.value}</Text>
            </View>
          ))}
        </View>
      ) : tab !== 'health' && tab !== 'leaders' && tab !== 'usage' && cards.length === 0 ? (
        <AdminEmpty text="No rows in this report yet." />
      ) : null}

      {meta.href ? <AdminBtn label={`Open ${meta.label} tools`} kind="primary" onPress={() => router.push(meta.href!)} /> : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  kicker: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  section: {
    color: FOCAL.jadeInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  leaderBlock: {
    gap: 8,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  healthDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotOk: {
    backgroundColor: FOCAL.neonJade,
  },
  dotWarn: {
    backgroundColor: FOCAL.electricGold,
  },
  dotFail: {
    backgroundColor: '#FF6B6B',
  },
  healthCopy: {
    flex: 1,
    gap: 2,
  },
  healthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  healthMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
