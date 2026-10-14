/** One open report figure: title, plain-language summary, native SVG plot and complete Data disclosure.
 * Failed reads hide stale values in every representation; missing and empty data remain distinct. */
import { Text, View } from 'react-native';
import { AdminReportCharts } from './AdminReportCharts';
import { AdminReportData } from './AdminReportData';
import { reportFigureModel, type ReportChart } from './reportChartModel';
import { REPORT_INK as c, reportStyles as s } from './reportStyles';

/** @purpose Display one chart with a complete text alternative and a source/value disclosure. */
export function AdminReportFigure({ chart, plotHeight }: { chart: ReportChart; plotHeight?: number }) {
  const model = reportFigureModel(chart);
  return <View style={s.section} testID={`report-figure-${chart.id}`}>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.chartTitle}>{chart.title}</Text><Text style={s.small}>{chart.caption}</Text></View>
    <Text style={s.sentence}>{model.summary}</Text>
    {model.state === 'error' ? <View accessibilityRole="alert" style={[s.notice, s.error]}><Text style={[s.sentence, { color: c.bad }]}>{chart.error}</Text></View>
      : model.state === 'missing' ? <Text style={s.small}>Not in this read</Text>
      : model.state === 'empty' ? <Text style={s.small}>Nothing to show in this window</Text>
      : <View aria-hidden={true} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><AdminReportCharts chart={chart} plotHeight={plotHeight} /></View>}
    {chart.source || model.table.rows.length ? <AdminReportData title={chart.title} table={model.table} source={chart.source} /> : null}
  </View>;
}
