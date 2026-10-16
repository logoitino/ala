/** Open report sections, KPI grids and editing-desk links. The layout stacks at large native text
 * sizes so the reader retains whole figures and every description without a fixed-height card. */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Link } from 'expo-router';
import { weekChange } from '@tapuai/shared-types/admin';
import { AdminReportFigure } from './AdminReportFigure';
import { AdminReportData } from './AdminReportData';
import { AdminReportSpark } from './AdminReportSpark';
import { type ReportKpi, type ReportSection } from './reportPages';
import { REPORT_INK as c, reportStyles as s } from './reportStyles';

/** @purpose A report-sized navigation/action target with visible keyboard focus. */
export function AdminReportLink({ label, onPress, selected = false, tab = false, href, id, primary = false, disabled = false }: { label: string; onPress?: () => void; selected?: boolean; tab?: boolean; href?: string; id?: string; primary?: boolean; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  const control = <Pressable nativeID={id} accessibilityRole={tab ? 'tab' : href ? 'link' : 'button'} accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled, ...(tab ? { selected } : {}) }}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    // Expo 57 Slot merges object styles; an array on its child crashes development navigation.
    style={StyleSheet.flatten([s.button, disabled && { opacity: 0.6 }, (selected || focused) && s.buttonOn, primary && { backgroundColor: c.jade, paddingHorizontal: 24, borderRadius: 999, borderBottomWidth: 0 }, focused && (primary ? { borderWidth: 2, borderColor: c.ink } : { backgroundColor: c.jadeWash })])}>
    <Text style={[s.buttonText, selected && s.buttonTextOn, primary && { color: '#ffffff' }]}>{label}</Text>
  </Pressable>;
  return href ? <Link href={href as Parameters<typeof Link>[0]['href']} asChild>{control}</Link> : control;
}

export function AdminReportKpi({ item }: { item: ReportKpi }) {
  const delta = !item.missing && item.delta ? weekChange(item.delta.current, item.delta.previous) : null;
  const deltaColor = !delta || !delta.percent || item.goodDirection === 'none' ? c.muted : (delta.percent > 0) === (item.goodDirection !== 'down') ? c.jade : c.bad;
  return <View style={s.metric}>
    <Text style={[s.chartTitle, { color: c.muted }]}>{item.tone === 'danger' || item.tone === 'warn' ? '⚠ ' : ''}{item.label}</Text>
    {/* Web has no native font fitting; wrapping preserves the complete figure at enlarged text. */}
    <Text style={[s.metricValue, { minWidth: 0, maxWidth: '100%', flexShrink: 1 }, item.missing && { color: c.muted }]} numberOfLines={Platform.OS === 'web' ? undefined : 1} adjustsFontSizeToFit={Platform.OS !== 'web'} minimumFontScale={0.6} accessibilityLabel={`${item.label}: ${item.missing ? 'Not in this read' : item.value}`}>{item.missing ? '—' : item.value}</Text>
    {delta ? <Text style={[s.small, { color: deltaColor, fontWeight: '700' }]}>{delta.percent == null ? 'New versus the prior week' : delta.percent === 0 ? 'Flat versus the prior week' : `${delta.percent > 0 ? '+' : ''}${delta.percent}% versus the prior week`}</Text> : null}
    <Text style={s.small}>{item.missing ? 'Not in this read' : item.hint ?? ''}</Text>
    {!item.missing && item.spark ? <AdminReportSpark item={item} /> : null}
  </View>;
}

/** @purpose Responsive KPI rows keep numeric values together at phone widths and large text. */
export function AdminReportKpis({ items }: { items: ReportKpi[] }) {
  const { width, fontScale } = useWindowDimensions();
  const cols = fontScale > 1.3 || width < 600 ? 1 : width < 1100 ? 2 : items.length === 3 ? 3 : 4;
  return <View style={s.grid}>{items.map((item, i) => <View key={`${item.label}-${i}`} style={{ flexGrow: 1, flexBasis: cols === 1 ? '100%' : cols === 2 ? '47%' : cols === 3 ? '30%' : '22%', minWidth: 0 }}><AdminReportKpi item={item} /></View>)}</View>;
}

/** @purpose Render the complete contents of a named report section; no data reads or writes. */
export function AdminReportSection({ section, onLayout }: { section: ReportSection; onLayout?: (event: LayoutChangeEvent) => void }) {
  const { width, fontScale } = useWindowDimensions();
  const paired = width >= 1024 && fontScale <= 1.3 && (section.charts?.length ?? 0) > 1;
  return <View style={s.section} onLayout={onLayout} nativeID={`report-${section.id}`}>
    <View style={s.row}><Text accessibilityRole="header" aria-level={2} style={s.h2}>{section.title}</Text>{section.hint ? <Text style={s.small}>{section.hint}</Text> : null}</View>
    {section.sentences?.map((sentence, i) => <Text key={i} style={s.sentence}>{sentence}</Text>)}
    {section.kpis?.length ? <AdminReportKpis items={section.kpis} /> : null}
    {section.charts?.length ? <View style={s.grid}>{section.charts.map((chart, i) => <View key={chart.id} style={{ minWidth: 0, flexGrow: 1, flexBasis: paired && !(i === section.charts!.length - 1 && section.charts!.length % 2 === 1) ? '47%' : '100%' }}>
      <AdminReportFigure chart={chart} plotHeight={section.id === 'clips' ? 80 : undefined} />
    </View>)}</View> : null}
    {section.tables?.map((table, i) => <AdminReportData key={`${table.title}-${i}`} {...table} />)}
    {section.links?.length ? <View style={s.row}>{section.links.map(link => <AdminReportLink key={link.href} label={link.label} href={link.href} />)}</View> : null}
  </View>;
}
