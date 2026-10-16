/** Analytics selects one complete board to keep the canvas focused; all boards and source catalogs remain available. */
import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { buildAnalytics } from '@tapuai/shared-types/admin';
import type { AdminReportData } from '@/lib/adminReports';
import { AdminReportLink, AdminReportSection } from './AdminReportSection';
import { AdminReportTabs } from './AdminReportTabs';
import { additionalReportSections, unmeasuredSection, type ReportSection } from './reportPages';
import { reportStyles as s } from './reportStyles';

/** @purpose Render all eight analytics boards and the complete measure/list catalogs. */
export function AdminReportAnalytics({ data, jump, register }: { data: AdminReportData; jump: (id: string) => void; register: (id: string, event: LayoutChangeEvent) => void }) {
  const model = buildAnalytics(data.reports, data.revenue);
  const [selected, select] = useState(model.boards[0].id);
  const board = model.boards.find(item => item.id === selected) ?? model.boards[0];
  const catalogs: ReportSection[] = [
    { id: 'catalog', title: 'Measure catalog', hint: 'Every measure, its grain, unit and read', tables: [{ title: 'Measure catalog', source: 'get_admin_reports; get_company_revenue_summary', table: {
      columns: ['Measure', 'Value', 'Dashboard', 'Grain', 'Unit', 'Source', 'Meaning'], rows: model.catalog.map(row => [row.label, row.missing ? 'Not in this read' : row.value, row.board, row.grain, row.unit, row.source, row.note]),
    } }] },
    { id: 'lists', title: 'List catalog', hint: 'Every series, ranking and stream list', tables: [{ title: 'List catalog', source: 'get_admin_reports; get_company_revenue_summary', table: {
      columns: ['List', 'Size', 'Dashboard', 'Kind', 'Unit', 'Source', 'Meaning'], rows: model.lists.map(row => [row.title, row.missing ? 'Not in this read' : row.value, row.board, row.kind, row.unit, row.source, row.note]),
    } }] }, ...additionalReportSections(data), unmeasuredSection(),
  ];
  return <View style={{ gap: 28 }}>
    <View style={{ gap: 4 }} accessibilityLabel="In this report"><Text style={s.kicker}>In this report</Text>
      <View style={s.row}>{[{ id: 'week', title: 'Week at a glance' }, ...catalogs.map(section => ({ id: section.id, title: section.title }))].map(item =>
        <AdminReportLink key={item.id} label={item.title} onPress={() => jump(item.id)} />)}</View>
    </View>
    <AdminReportTabs scope="analytics" tabs={model.boards.map(item => ({ id: item.id, label: item.title }))} selected={selected} onSelect={id => select(id as typeof selected)} />
    <View nativeID="analytics-panel" role="tabpanel" aria-labelledby={`analytics-tab-${selected}`}>
    <AdminReportSection key={board.id} onLayout={event => register(board.id, event)} section={{
      id: board.id, title: board.title, hint: board.question, kpis: board.tiles,
      charts: [...board.meters.map(meter => ({ id: meter.source + meter.label, title: meter.label, kind: 'meter' as const, caption: meter.hint, source: meter.source, error: board.error, part: meter.part, whole: meter.whole })), ...board.charts],
      tables: [{ title: `${board.title} measures`, source: board.rpc, table: { columns: ['Measure', 'Value', 'Meaning', 'Source'], rows: board.measures.map(row => [row.label, row.missing ? 'Not in this read' : row.display, row.note, row.source]) } }],
    }} />
    </View>
    <AdminReportSection onLayout={event => register('week', event)} section={{ id: 'week', title: 'Week at a glance', charts: [{ id: 'analytics-heat', kind: 'heat', title: 'Week at a glance', caption: 'Last 7 days, UTC', source: 'get_admin_reports.series', error: data.reports.error, rows: model.week.map(row => ({ title: row.title, points: row.points, format: row.format, accent: row.accent })) }] }} />
    {catalogs.map(section => <AdminReportSection key={section.id} section={section} onLayout={event => register(section.id, event)} />)}
  </View>;
}
