/** Native/Expo-web SVG plots for the main admin report. Geometry is decorative: the figure's visible
 * sentence and complete Data table carry its meaning. Zero is a baseline, never a fabricated sliver.
 * The outer figure hides plots on both platforms; native `accessible` must not reach web SVG DOM. */
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { areaPath, linePath, niceScale, formatTick, tickUnitFor, type AnalyticsPoint } from '@tapuai/shared-types/admin';
import { chartValue, heatLabels, type ReportChart } from './reportChartModel';
import { REPORT_INK as c, reportColor, reportStyles as s } from './reportStyles';

const WIDTH = 700;
const HEIGHT = 144;
function bars(points: AnalyticsPoint[], accent: string, format: Parameters<typeof chartValue>[1]) {
  const max = Math.max(0, ...points.map(p => p.value ?? 0));
  return <View style={{ gap: 12 }}>{points.map((p, i) => <View key={i} style={{ gap: 6 }}>
    <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.sentence}>{i + 1}　{p.label}</Text><Text style={s.strong}>{chartValue(p.value, format)}</Text></View>
    <Svg width="100%" height={9} viewBox={`0 0 ${WIDTH} 9`} preserveAspectRatio="none"><Rect width={WIDTH} height={9} fill={c.mutedSurface} rx={4} /><Rect width={max > 0 && p.value != null ? Math.max(0, p.value) / max * WIDTH : 0} height={9} rx={4} fill={reportColor(accent)} /></Svg>
  </View>)}</View>;
}

/** @purpose Draw every chart variant using installed react-native-svg and the shared chart math. */
export function AdminReportCharts({ chart, plotHeight }: { chart: ReportChart; plotHeight?: number }) {
  if (chart.kind === 'heat') return <View style={{ gap: 10 }}>{chart.rows.map((row, at) => {
    const points = heatLabels(chart).map(label => ({ label, value: row.points?.find(point => point.label === label)?.value ?? null })); const max = Math.max(0, ...points.map(p => p.value ?? 0));
    return <View key={at} style={{ gap: 6 }}><Text style={s.strong}>{row.title}</Text><View style={{ flexDirection: 'row', gap: 4 }}>{points.map((p, i) => <View key={i} style={{ flex: 1, gap: 3, alignItems: 'center' }}>
      <Text style={s.small}>{p.label}</Text><Svg width="100%" height={30} viewBox="0 0 80 30" preserveAspectRatio="none">
        <Rect x={1} y={1} width={78} height={28} rx={3} fill={reportColor(row.accent)} opacity={p.value == null ? 0.04 : max > 0 ? 0.12 + 0.76 * p.value / max : 0.12} stroke={max > 0 && p.value === max ? c.ink : 'none'} strokeWidth={2} />
      </Svg><Text style={[s.small, { fontSize: 10 }]}>{chartValue(p.value, row.format)}</Text>
    </View>)}</View></View>;
  })}</View>;
  if (chart.kind === 'meter') {
    const share = chart.part != null && chart.whole! > 0 ? Math.max(0, Math.min(1, chart.part / chart.whole!)) : 0;
    return <View style={{ gap: 12 }}><Text style={[s.metricValue, { color: c.jade }]}>{chart.whole! > 0 ? `${Math.round(share * 100)}%` : '—'}</Text>
      <Svg width="100%" height={12} viewBox={`0 0 ${WIDTH} 12`} preserveAspectRatio="none"><Rect width={WIDTH} height={12} fill={c.mutedSurface} rx={6} /><Rect width={WIDTH * share} height={12} fill={c.jade} rx={6} /></Svg></View>;
  }
  if (chart.kind === 'bars') return bars(chart.points ?? [], chart.accent, chart.format);
  if (chart.kind === 'compare') return bars([chart.current, chart.previous], chart.accent, chart.format);
  if (chart.kind === 'split' || chart.kind === 'ring') {
    const total = chart.parts.reduce((sum, p) => sum + (p.value ?? 0), 0);
    let offset = 0;
    const legend = <View style={[s.row, { gap: 16 }]}>{chart.parts.map(p => <View key={p.key} style={{ gap: 4 }}><Text style={[s.strong, { color: reportColor(p.color) }]}>{p.label}</Text><Text style={s.small}>{chartValue(p.value, chart.format)}{total > 0 ? ` · ${(p.value! / total * 100).toFixed(1)}%` : ''}</Text></View>)}</View>;
    if (chart.kind === 'ring') {
      const circumference = 2 * Math.PI * 66;
      return <View style={[s.row, { justifyContent: 'center', gap: 24 }]}><View style={{ width: 180, height: 180, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={180} height={180} viewBox="0 0 180 180" style={{ position: 'absolute' }}><Circle cx={90} cy={90} r={66} fill="none" stroke={c.mutedSurface} strokeWidth={24} />
          {/* The SVG transform preserves native geometry without forwarding an invalid transform-origin DOM prop. */}
          {chart.parts.map(p => { const length = total > 0 ? p.value! / total * circumference : 0; const start = offset; offset += length; return <Circle key={p.key} cx={90} cy={90} r={66} fill="none" stroke={reportColor(p.color)} strokeWidth={24} strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`} strokeDashoffset={-start} transform="rotate(-90 90 90)" />; })}
        </Svg><Text style={[s.metricValue, { fontSize: 20 }]}>{chart.centerValue}</Text><Text style={s.small}>{chart.centerLabel}</Text></View>{legend}</View>;
    }
    return <View style={{ gap: 14 }}><Svg width="100%" height={28} viewBox={`0 0 ${WIDTH} 28`} preserveAspectRatio="none"><Rect width={WIDTH} height={28} fill={c.mutedSurface} />
      {chart.parts.map(p => { const width = total > 0 ? p.value! / total * WIDTH : 0; const start = offset; offset += width; return <Rect key={p.key} x={start} width={width} height={28} fill={reportColor(p.color)} stroke={c.canvas} strokeWidth={2} />; })}
    </Svg>{legend}</View>;
  }
  if (chart.kind === 'stack') {
    const max = Math.max(0, ...(chart.rows ?? []).map(row => row.total ?? 0));
    return <View style={{ gap: 16 }}>{(chart.rows ?? []).map((row, at) => {
      let offset = 0;
      return <View key={at} style={{ gap: 6 }}><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.strong}>{row.label}</Text><Text style={s.strong}>{chartValue(row.total, chart.format)}</Text></View>
        <Svg width="100%" height={22} viewBox={`0 0 ${WIDTH} 22`} preserveAspectRatio="none"><Rect width={WIDTH} height={22} fill={c.mutedSurface} />{chart.series.map(series => { const width = max > 0 ? Math.max(0, row.segments[series.key] ?? 0) / max * WIDTH : 0; const start = offset; offset += width; return <Rect key={series.key} x={start} width={width} height={22} fill={reportColor(series.color)} stroke={c.canvas} strokeWidth={2} />; })}</Svg>
      </View>;
    })}<View style={s.row}>{chart.series.map(series => <Text key={series.key} style={[s.small, { color: reportColor(series.color) }]}>{series.label}</Text>)}</View></View>;
  }
  const points = chart.points ?? [];
  const values = points.map(p => p.value);
  const unit = tickUnitFor(chart.format);
  const scaled = niceScale(values.map(value => value == null ? null : value / unit));
  const scale = { max: scaled.max * unit, ticks: scaled.ticks.map(tick => tick * unit) };
  const height = plotHeight ?? HEIGHT;
  const tint = reportColor(chart.accent);
  const peak = Math.max(0, ...values.map(v => v ?? 0));
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ width: 65, height, justifyContent: 'space-between' }}>{[...scale.ticks].reverse().filter((_, i, a) => a.length <= 5 || i % Math.ceil(a.length / 5) === 0).map(tick => <Text key={tick} style={[s.small, { fontSize: 10, textAlign: 'right' }]}>{formatTick(chart.format, tick)}</Text>)}</View>
      <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" style={{ flex: 1 }}>
        {scale.ticks.map(tick => <Line key={tick} x1={0} x2={WIDTH} y1={scale.max > 0 ? height - tick / scale.max * height : height} y2={scale.max > 0 ? height - tick / scale.max * height : height} stroke={c.border} strokeDasharray={tick ? '3 5' : undefined} />)}
        {chart.kind === 'columns' ? points.map((p, i) => { const barHeight = scale.max > 0 ? Math.max(0, p.value ?? 0) / scale.max * height : 0; return <Rect key={i} x={(i + 0.15) / points.length * WIDTH} width={WIDTH / points.length * 0.7} y={height - barHeight} height={barHeight} fill={tint} opacity={peak > 0 && p.value === peak ? 1 : 0.65} />; }) : <>
          {chart.kind === 'area' ? <Path d={areaPath(values, WIDTH, height, scale.max)} fill={tint} opacity={0.14} /> : null}
          <Path d={linePath(values, WIDTH, height, scale.max)} fill="none" stroke={tint} strokeWidth={2.5} />
          {points.map((p, i) => p.value == null ? null : <Circle key={i} cx={(i + 0.5) / points.length * WIDTH} cy={scale.max > 0 ? height - p.value / scale.max * height : height} r={3.5} fill={tint} stroke={c.canvas} strokeWidth={1.5} />)}
        </>}
      </Svg>
    </View>
    <View style={{ flexDirection: 'row', marginLeft: 73 }}>{points.map((p, i) => <View key={i} style={{ flex: 1, alignItems: 'center', minWidth: 0, gap: 3 }}><Text style={[s.small, { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }]}>{p.label}</Text><Text style={[s.strong, { fontSize: 10 }]}>{chartValue(p.value, chart.format)}</Text></View>)}</View>
  </View>;
}
