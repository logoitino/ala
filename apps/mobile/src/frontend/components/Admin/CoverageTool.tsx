import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';

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
import { fetchAdminReports, type AdminReports } from '@/lib/admin';
import { COVERAGE_CONTROLS, COVERAGE_SURFACES, type CoverageSurface } from '@/lib/adminCoverage';
import { getRuntimeFlag } from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

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

/**
 * @purpose Production coverage board: every fan-visible control mapped to a desk, live flag, and usage/issue counts.
 * @sideEffects `get_admin_reports` on focus.
 */
export function CoverageTool() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const [surface, setSurface] = useState<CoverageSurface | 'all'>('all');
  const [reports, setReports] = useState<AdminReports>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await fetchAdminReports());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const tapMap = useMemo(() => {
    const next = new Map<string, number>();
    for (const row of reports.features) next.set(row.label, row.value);
    return next;
  }, [reports.features]);

  const issueMap = useMemo(() => {
    const next = new Map<string, number>();
    for (const row of reports.issues) {
      const key = row.label.split(' · ')[0]?.trim() ?? row.label;
      next.set(key, (next.get(key) ?? 0) + row.value);
    }
    return next;
  }, [reports.issues]);

  const rows = surface === 'all' ? COVERAGE_CONTROLS : COVERAGE_CONTROLS.filter((item) => item.surface === surface);
  const codeOwned = COVERAGE_CONTROLS.filter((item) => item.owner === 'code').length;
  const liveCount = COVERAGE_CONTROLS.filter((item) => !item.flag || getRuntimeFlag(live, item.flag)).length;
  const flaggedOff = COVERAGE_CONTROLS.filter((item) => item.flag && !getRuntimeFlag(live, item.flag)).length;
  const hottest = [...issueMap.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <AdminPage
      title="Coverage"
      lede="If a fan can tap it, this desk names who owns it, whether it is live, and whether Reports is seeing taps or failures."
      refreshing={loading}
      onRefresh={() => void refresh()}
    >
      <AdminNotice
        text={`${liveCount} of ${COVERAGE_CONTROLS.length} controls live · ${flaggedOff} paused in Features · ${reports.usage.issues_24h ?? 0} issues in 24h`}
        tone={flaggedOff > 0 || (reports.usage.issues_24h ?? 0) > 0 ? 'warn' : 'ok'}
      />
      <AdminNotice
        text={
          codeOwned === 0
            ? 'Every control on this board is desk-editable.'
            : `${codeOwned} control${codeOwned === 1 ? '' : 's'} still ship values in code — the desk shows them, a release changes them.`
        }
        tone={codeOwned === 0 ? 'ok' : 'warn'}
      />
      {hottest ? (
        <AdminNotice text={`Hottest issue: ${hottest[0]} (${hottest[1]})`} tone="warn" />
      ) : (
        <AdminNotice text="No control issues in the 7-day window yet." tone="ok" />
      )}

      <AdminPills
        label="Surface"
        items={[{ id: 'all', label: 'All' }, ...COVERAGE_SURFACES.map((item) => ({ id: item.id, label: item.label.split(' · ')[0] ?? item.label }))]}
        value={surface}
        onChange={setSurface}
      />

      {rows.length === 0 ? (
        <AdminEmpty text="No controls on this surface." />
      ) : (
        rows.map((item) => {
          const on = item.flag ? getRuntimeFlag(live, item.flag) : true;
          const taps = item.telemetry ? tapMap.get(item.telemetry) ?? 0 : 0;
          const issues = item.telemetry ? issueMap.get(item.telemetry) ?? 0 : 0;
          return (
            <AdminRow
              key={item.id}
              title={item.label}
              meta={`${item.hint} · ${on ? 'live' : 'paused'}${item.owner === 'code' ? ' · ships in code' : ''}${item.telemetry ? ` · ${taps} taps / ${issues} issues (7d)` : ''}`}
            >
              <View style={styles.actions}>
                <View style={[styles.dot, on ? styles.dotOn : styles.dotOff]} />
                <AdminBtn label="Manage" kind="primary" onPress={() => router.push(item.adminHref)} />
                <AdminBtn label="Open" onPress={() => router.push(item.fanHref as Href)} />
              </View>
            </AdminRow>
          );
        })
      )}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOn: {
    backgroundColor: FOCAL.neonJade,
  },
  dotOff: {
    backgroundColor: colors.danger,
  },
});
