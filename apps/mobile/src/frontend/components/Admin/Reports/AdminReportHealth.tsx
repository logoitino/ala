/** Health owns actionable triage and telemetry. Published menus have one home in Product. */
import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { buildOperations, formatOperationsValue, type OperationsKind, type MeasureUnit, type OperationsTabId } from '@tapuai/shared-types/admin';
import type { AdminReportData } from '@/lib/adminReports';
import { AdminReportTabs } from './AdminReportTabs';
import { AdminReportLink, AdminReportSection } from './AdminReportSection';
import { buildReportHealthChecks } from './reportHealthChecks';
import { ranking, trend, type ReportSection } from './reportPages';
import { reportStyles as s } from './reportStyles';

const format = (kind: OperationsKind): MeasureUnit => kind === 'ms' ? 'milliseconds' : kind === 'ratio' ? 'count' : kind;
/** @purpose Render the selected operations lens with every row retained in a Data disclosure. */
export function AdminReportHealth({ data }: { data: AdminReportData }) {
  const [selected, select] = useState<OperationsTabId | 'overview'>('overview');
  const [showPassed, setShowPassed] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const ok = data.reports.configured && !data.reports.error;
  const lenses = buildOperations({ tabs: data.reports.tabs, buttons: data.reports.features, appErrors: data.reports.issues, scroll: data.reports.scroll,
    dwellSeries: data.reports.series.dwell, stallSeries: data.reports.series.stalls, portalErrors: [data.reports.error, data.revenue.error, data.runtime.error].filter((value): value is string => Boolean(value)),
    usage: data.reports.usage, reliability: data.reports.reliability, published: data.runtime.published, reportsOk: ok, runtimeOk: data.runtime.configured && !data.runtime.error });
  const tabs = [{ id: 'overview', label: 'Overview' }, ...lenses.filter(lens => lens.id !== 'menus')];
  const lens = lenses.find(item => item.id === selected) ?? lenses[0];
  const error = data.reports.error;
  const section: ReportSection = { id: `health-${lens.id}`, title: lens.label, sentences: [lens.summary],
    kpis: lens.stats.map(stat => ({ ...stat, value: stat.value == null ? '—' : formatOperationsValue(stat.kind, stat.value), missing: stat.value == null, spark: stat.spark ? { ...stat.spark, format: format(stat.kind) } : null })),
    charts: [...lens.series.map(series => trend(series.title, series.points, format(series.kind), series.accent, series.source, error, series.variant)),
      ...lens.rankings.map(rows => ranking(rows.title, rows.rows, format(rows.kind), rows.accent, rows.source, error, rows.summary)),
      ...lens.splits.map(split => ({ id: split.id, title: split.title, caption: split.caption, kind: 'split' as const, source: `app_runtime_config.published.${split.id}`, keys: [split.id], error,
        format: 'count' as const, accent: 'jade' as const, totalLabel: 'Menus', parts: [{ key: 'on', label: 'On', value: split.on, color: 'jade' as const }, { key: 'off', label: 'Off', value: split.off, color: 'muted' as const }] }))],
  };
  const duplicateLabels = new Set([...lens.stats.map(row => row.label), ...lens.rankings.flatMap(list => (list.rows ?? []).map(row => row.label))]);
  const details = selected === 'buttons' ? [] : lens.details.filter(row => row.label !== 'Portal' && !duplicateLabels.has(row.label));
  const checks = buildReportHealthChecks(data);
  const shown = showPassed ? checks : checks.filter(check => check.status !== 'ok');
  const status = { fail: 'Failed', warn: 'Check', unknown: 'Not read', ok: 'Pass' };
  return <View style={{ gap: 24 }}><View style={s.row}><AdminReportTabs tabs={tabs} selected={selected} onSelect={id => select(id as typeof selected)} />
    <AdminReportLink label="Published menus in Product" href="/admin/product" /></View>
    <View nativeID="health-panel" role="tabpanel" aria-labelledby={`health-tab-${selected}`} style={s.section}>
      {selected === 'overview' ? <>
        <Text accessibilityRole="header" aria-level={2} style={s.h2}>Operational checks</Text>
        <Text style={s.sentence}>{checks.filter(c => c.status === 'fail').length} failed · {checks.filter(c => c.status === 'warn').length} need a check · {checks.filter(c => c.status === 'unknown').length} not read · {checks.filter(c => c.status === 'ok').length} pass</Text>
        <Text style={s.small}>Current counts and rolling 24-hour checks. A quiet window may need review; these rules do not certify a release.</Text>
        <View style={s.grid}>{shown.map(check => <View key={check.id} style={{ flexGrow: 1, flexBasis: width >= 900 && fontScale <= 1.3 ? '47%' : '100%', minWidth: 0, paddingVertical: 12, gap: 6, borderBottomWidth: 1, borderColor: '#e4e9e6' }}>
          <View style={s.row}><Text style={s.strong}>{check.label}</Text><Text style={s.small}>{status[check.status]}</Text></View>
          <Text style={s.sentence}>{check.detail}</Text><Text style={s.small}>{check.rule}</Text>
          <AdminReportLink label={`Open ${check.label} tools`} href={check.href} />
        </View>)}</View>
        {!shown.length ? <Text style={s.sentence}>All thirteen measured checks pass.</Text> : null}
        <View style={s.row}><AdminReportLink label={showPassed ? 'Hide passing checks' : 'Show all 13 checks'} onPress={() => setShowPassed(!showPassed)} />
          <AdminReportLink label="QA repair tools" href="/admin/qa" /><AdminReportLink label="Control map" href="/admin/product/coverage" /></View>
      </> : <><AdminReportSection section={section} />
      {details.length ? <AdminReportSection section={{ id: 'health-details', title: 'Additional measures', tables: [{ title: 'Additional measures', source: 'get_admin_reports', table: { columns: ['Measure', 'Value'], rows: details.map(row => [row.label, row.value]) } }] }} /> : null}
      </>}
    </View>
  </View>;
}
