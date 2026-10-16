/** Product owns the complete fan-control map; missing telemetry is never an invented zero. */
import type { AdminReportData } from '@/lib/adminReports';
import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { COVERAGE_CONTROLS, COVERAGE_SURFACES, type CoverageSurface } from '@/lib/adminCoverage';
import { AdminReportTabs } from './AdminReportTabs';
import { AdminReportLink } from './AdminReportSection';
import { AdminReportData as DataDisclosure } from './AdminReportData';
import { reportStyles as s } from './reportStyles';

/** Every static mapping survives failed reads; only directly returned readings are displayed. */
export function AdminReportCoverage({ data }: { data: AdminReportData }) {
  const [surface, select] = useState<CoverageSurface | 'all'>('all');
  const { width, fontScale } = useWindowDimensions();
  const reportsOk = data.reports.configured && !data.reports.error;
  const taps = new Map(reportsOk ? (data.reports.features ?? []).map(row => [row.label, row.value]) : []);
  const issues = new Map<string, number>();
  if (reportsOk) for (const row of data.reports.issues ?? []) {
    const key = row.label.split(' · ')[0].trim(); issues.set(key, (issues.get(key) ?? 0) + row.value);
  }
  const rows = surface === 'all' ? COVERAGE_CONTROLS : COVERAGE_CONTROLS.filter(row => row.surface === surface);
  const keys = [...new Set(rows.map(row => row.telemetry).filter((key): key is string => Boolean(key)))];
  const published = (path: string) => {
    if (!data.runtime.configured || data.runtime.error) return null;
    const value = path.split('.').reduce<unknown>((bag, key) => bag && typeof bag === 'object' ? (bag as Record<string, unknown>)[key] : null, data.runtime.published);
    return typeof value === 'boolean' ? value : null;
  };
  return <View style={{ gap: 24 }}>
    <Text style={s.sentence}>The complete control registry, with links to its existing editor and app surface. The report returns the top eight tap keys and issue step/channel rows. Issue sums may be partial; omitted keys do not prove zero activity. Shared telemetry keys have one reading and cannot distinguish the controls or surfaces that use them.</Text>
    <AdminReportTabs scope="coverage" tabs={[{ id: 'all', label: 'All controls' }, ...COVERAGE_SURFACES.map(row => ({ id: row.id, label: row.label.split(' · ')[0] }))]} selected={surface} onSelect={id => select(id as typeof surface)} />
    <View nativeID="coverage-panel" role="tabpanel" aria-labelledby={`coverage-tab-${surface}`} style={{ gap: 16 }}>
      <Text style={s.small}>{rows.length} of {COVERAGE_CONTROLS.length} controls · {COVERAGE_CONTROLS.filter(row => row.owner === 'code').length} require a code release to change</Text>
      <DataDisclosure title="Returned control telemetry" source="get_admin_reports.features; get_admin_reports.issues · top eight returned keys/step-channel rows, 7d" table={{ columns: ['Telemetry key', 'Controls sharing key', 'Returned taps · 7d', 'Returned issue sum · 7d (partial)'], rows: keys.map(key => [key, COVERAGE_CONTROLS.filter(row => row.telemetry === key).map(row => `${row.label} (${row.surface})`).join(', '), taps.has(key) ? `${taps.get(key)!.toLocaleString('en-US')} taps` : 'Not in this read', issues.has(key) ? `${issues.get(key)!.toLocaleString('en-US')} issues` : 'Not in this read']) }} />
      <View style={s.grid}>{rows.map(row => {
        const flag = row.flag ? published(row.flag) : null;
        return <View key={row.id} style={{ minWidth: 0, flexGrow: 1, flexBasis: width >= 900 && fontScale <= 1.3 ? '47%' : '100%', gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#e4e9e6' }}>
          <Text accessibilityRole="header" aria-level={2} style={s.strong}>{row.label}</Text><Text style={s.sentence}>{row.hint}</Text>
          <Text style={s.small}>{row.surface} · {row.owner === 'code' ? 'Values change in code' : 'Values change in the desk'} · Published: {row.flag ? flag == null ? '—' : flag ? 'On' : 'Off' : 'No runtime switch'}</Text>
          {row.flag ? <Text selectable style={s.small}>Flag: {row.flag}</Text> : null}
          {row.telemetry ? <Text selectable style={s.small}>Telemetry: {row.telemetry} · readings in Data above</Text> : <Text style={s.small}>No telemetry key registered</Text>}
          <View style={s.row}><AdminReportLink label={`Manage ${row.label}`} href={row.adminHref} /><AdminReportLink label={`Open ${row.label}`} href={row.fanHref} /></View>
        </View>;
      })}</View>
    </View>
  </View>;
}
