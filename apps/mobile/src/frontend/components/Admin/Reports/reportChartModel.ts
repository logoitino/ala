/** Complete chart text/data alternatives. A missing list, empty window and recorded zero have
 * separate states; failed reads never expose stale plot values in a summary or disclosure. */
import { formatChartValue, type AnalyticsChart, type AnalyticsPoint, type ChartAccent, type MeasureUnit } from '@tapuai/shared-types/admin';

export type HeatChart = { id: string; kind: 'heat'; title: string; caption: string; source: string; error: string | null;
  rows: { title: string; points: AnalyticsPoint[] | null; format: MeasureUnit; accent: ChartAccent }[] };
export type MeterChart = { id: string; kind: 'meter'; title: string; caption: string; source: string; error: string | null; part: number | null; whole: number | null };
export type ReportChart = AnalyticsChart | HeatChart | MeterChart;
export type ReportTable = { columns: string[]; rows: string[][] };
export type FigureModel = { state: 'ready' | 'missing' | 'empty' | 'error'; summary: string; table: ReportTable };
export const chartValue = (value: number | null, format: MeasureUnit): string => value == null ? '—' : formatChartValue(format, value);
/** Date labels are joined across rows so a partial series cannot relabel another row's values. */
export const heatLabels = (chart: HeatChart): string[] => [...new Set(chart.rows.flatMap(row => row.points?.map(point => point.label) ?? []))];

/** @purpose Produce a complete text alternative and table from the same chart descriptor as the SVG. */
export function reportFigureModel(chart: ReportChart): FigureModel {
  const empty = { columns: ['Label', 'Value'], rows: [] as string[][] };
  if (chart.error) return { state: 'error', summary: `${chart.title}: the read failed, so no values are shown.`, table: empty };
  if (chart.kind === 'heat') {
    const labels = heatLabels(chart);
    const rows = chart.rows.map(row => [row.title, ...labels.map(label => chartValue(row.points?.find(point => point.label === label)?.value ?? null, row.format))]);
    return { state: chart.rows.every(row => row.points == null) ? 'missing' : labels.length ? 'ready' : 'empty',
      summary: 'Each row is shaded against its own busiest day. The outlined cell is the peak.', table: { columns: ['Measure', ...labels], rows } };
  }
  if (chart.kind === 'meter') {
    const missing = chart.part == null || chart.whole == null;
    const percent = !missing && chart.whole! > 0 ? Math.round(chart.part! / chart.whole! * 100) : null;
    return { state: missing ? 'missing' : 'ready', summary: missing ? `${chart.title}: not in this read.` : chart.whole === 0 ? `${chart.title}: no total to compute a share.` : `${chart.title}: ${percent}% (${chart.part} of ${chart.whole}).`,
      table: { columns: ['Measure', 'Value'], rows: [['Part', chartValue(chart.part, 'count')], ['Whole', chartValue(chart.whole, 'count')], ['Share', percent == null ? '—' : `${percent}%`]] } };
  }
  if (chart.kind === 'split' || chart.kind === 'ring') {
    const missing = chart.parts.some(p => p.value == null);
    const total = chart.parts.reduce((sum, p) => sum + (p.value ?? 0), 0);
    return { state: missing ? 'missing' : chart.parts.length ? 'ready' : 'empty', summary: `${chart.title}: ${chart.parts.map(p => `${p.label} ${chartValue(p.value, chart.format)}`).join('; ')}.`,
      table: { columns: ['Part', 'Value', 'Share'], rows: chart.parts.map(p => [p.label, chartValue(p.value, chart.format), !missing && total > 0 ? `${(p.value! / total * 100).toFixed(1)}%` : '—']) } };
  }
  if (chart.kind === 'compare') return { state: chart.current.value == null || chart.previous.value == null ? 'missing' : 'ready', summary: chart.sentence,
    table: { columns: ['Window', 'Value'], rows: [chart.current, chart.previous].map(p => [p.label, chartValue(p.value, chart.format)]) } };
  if (chart.kind === 'stack') return { state: chart.rows == null ? 'missing' : chart.rows.length ? 'ready' : 'empty',
    summary: `${chart.title}: ${chart.rows?.length ?? 0} rows, split into ${chart.series.map(s => s.label).join(', ')}.`,
    table: { columns: ['Label', ...chart.series.map(s => s.label), 'Total'], rows: (chart.rows ?? []).map(row => [row.label, ...chart.series.map(s => chartValue(row.segments[s.key] ?? null, chart.format)), chartValue(row.total, chart.format)]) } };
  const points = chart.points;
  if (points == null) return { state: 'missing', summary: chart.kind === 'bars' && chart.summary ? chart.summary : `${chart.title}: not in this read.`, table: empty };
  if (!points.length) return { state: 'empty', summary: `${chart.title}: nothing in this window.`, table: empty };
  const measured = points.filter(p => p.value != null);
  const peak = measured.reduce<AnalyticsPoint | null>((best, p) => !best || p.value! > best.value! ? p : best, null);
  const last = points[points.length - 1];
  if (chart.kind === 'bars') return { state: measured.length ? 'ready' : 'missing', summary: chart.summary ?? `${chart.title}: ${peak ? `${peak.label} has the highest value at ${chartValue(peak.value, chart.format)} across ${points.length} recorded categories.` : 'Not in this read.'}`,
    table: { columns: ['Label', 'Value'], rows: points.map(point => [point.label, chartValue(point.value, chart.format)]) } };
  return { state: measured.length ? 'ready' : 'missing', summary: `${chart.title}${'windowLabel' in chart ? `, ${chart.windowLabel}` : ''}. ${peak ? `Highest on ${peak.label} at ${chartValue(peak.value, chart.format)}; latest ${last.label} at ${chartValue(last.value, chart.format)}.` : 'Not in this read.'}`,
    table: { columns: ['Label', 'Value'], rows: points.map(p => [p.label, chartValue(p.value, chart.format)]) } };
}
