/** Decorative KPI sparkline uses the same complete points disclosed below it; nulls break the
 * line rather than dropping to zero. It contributes no duplicate screen-reader content. */
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { linePath, niceMax } from '@tapuai/shared-types/admin';
import { AdminReportData } from './AdminReportData';
import { chartValue } from './reportChartModel';
import type { ReportKpi } from './reportPages';
import { reportColor } from './reportStyles';
/** @purpose Draw a small KPI trend and retain every point in the accessible Data table. */
export function AdminReportSpark({ item }: { item: ReportKpi }) {
  const spark = item.spark; if (!spark) return null;
  const values = spark.points.map(point => point.value);
  return <View style={{ gap: 4 }}>
    <View aria-hidden={true} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Svg width="100%" height={28} viewBox="0 0 280 28" preserveAspectRatio="none"><Path d={linePath(values, 280, 24, niceMax(values))} fill="none" stroke={reportColor(spark.accent)} strokeWidth={2} /></Svg></View>
    <AdminReportData title={`${item.label} trend`} source={item.source} table={{ columns: ['Day', 'Value'], rows: spark.points.map(point => [point.label, chartValue(point.value, spark.format)]) }} />
  </View>;
}
