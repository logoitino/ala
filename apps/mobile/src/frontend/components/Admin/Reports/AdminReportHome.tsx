/** Home follows the owner-selected portal hero and compact comparison layout. Every count and
 * change comes from the shared dashboard input; a zero prior week has no invented percent. */
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { formatCount, formatUsd, homeKpis, isMeasured, weekChange, type HomeKpi } from '@tapuai/shared-types/admin';
import type { AdminReportData } from '@/lib/adminReports';
 * change comes from the shared dashboard input; a zero prior week has no invented percent.
 * Desk status cards from the Home route (Trivia, 2026-10-15) sit after the weekly summary. */
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { formatCount, formatUsd, homeKpis, isMeasured, weekChange, type HomeKpi } from '@tapuai/shared-types/admin';
import type { AdminReportData } from '@/lib/adminReports';
import { AdminHomeCards } from '@/components/Admin/AdminHomeCards';
import { AdminReportFigure } from './AdminReportFigure';
import { AdminReportLink, AdminReportSection } from './AdminReportSection';
import { homeInput, PAGE_TITLES, reportPageSections } from './reportPages';
import { REPORT_INK as c, reportStyles as s } from './reportStyles';

function weeklyChange(card: HomeKpi, compact = false): string {
  if (!card.delta) return 'Comparison not in this read';
  const change = weekChange(card.delta.current, card.delta.previous);
  if (change.percent == null) return 'Prior week was zero; no percent comparison';
  if (!change.percent) return compact ? 'Flat' : 'Flat versus the prior week';
  return `${change.percent > 0 ? '+' : '−'}${Math.abs(change.percent)}%${compact ? '' : ' versus the prior week'}`;
}
const clipsSentence = (label: string, value: number | null) => isMeasured(value) ? `${label}: ${formatCount(value)} ${value === 1 ? 'clip' : 'clips'}.` : `${label}: not in this read.`;

/** @purpose Home's h1, donation amount/count/change, three overview measures and primary Trends link. */
export function AdminReportHomeHero({ data }: { data: AdminReportData }) {
  const { width, fontScale } = useWindowDimensions();
  const input = homeInput(data); const cards = homeKpis(input, formatUsd); const donation = cards.find(card => card.id === 'donations')!;
  const wide = width >= 1280 && fontScale <= 1.3; const paired = width >= 1024 && fontScale <= 1.3;
  return <View style={[s.grid, { gap: 24, alignItems: 'center', paddingVertical: 10 }]}>
    <View style={{ minWidth: 0, flexBasis: wide ? '40%' : paired ? '47%' : '100%', gap: 10 }}>
      <Text accessibilityRole="header" aria-level={1} style={[s.h1, { fontSize: width < 640 ? 30 : 36 }]}>{PAGE_TITLES.home}</Text>
      {/* Font fitting is native only; on web the full amount must wrap rather than ellipsize. */}
      <Text style={[s.heroValue, { fontSize: width < 640 ? 48 : 60, minWidth: 0, maxWidth: '100%', flexShrink: 1 }]} numberOfLines={Platform.OS === 'web' ? undefined : 1} adjustsFontSizeToFit={Platform.OS !== 'web'} minimumFontScale={0.6} accessibilityLabel={`Donations this week: ${donation.missing ? 'Not in this read' : donation.value}`}>{donation.value}</Text>
      <View style={[s.row, { gap: 6 }]}><Text style={s.strong}>{isMeasured(input.donationCount7d) ? `${formatCount(input.donationCount7d)} ${input.donationCount7d === 1 ? 'donation' : 'donations'} recorded` : 'Donation count not in this read'}</Text>
        <Text style={[s.small, { color: c.jade }]}>{weeklyChange(donation)}</Text></View>
    </View>
    <View style={[s.grid, { flexBasis: wide ? '38%' : paired ? '47%' : '100%', minWidth: 0, gap: 16 }]}>
      {cards.filter(card => ['avgDonation', 'clips', 'opens'].includes(card.id)).map(card => <View key={card.id} style={{ flexGrow: 1, flexBasis: '28%', minWidth: 144, borderLeftWidth: 1, borderLeftColor: c.border, paddingLeft: 16, gap: 8 }}>
        <Text style={s.small}>{card.label}</Text><Text style={[s.metricValue, { fontSize: 24, color: card.id === 'clips' ? c.cyan : c.ink, minWidth: 0, maxWidth: '100%', flexShrink: 1 }]} numberOfLines={Platform.OS === 'web' ? undefined : 1} adjustsFontSizeToFit={Platform.OS !== 'web'} minimumFontScale={0.6} accessibilityLabel={`${card.label}: ${card.missing ? 'Not in this read' : card.value}`}>{card.value}</Text>
        <Text style={s.small}>{card.id === 'clips' ? weeklyChange(card) : card.hint}</Text>
      </View>)}
    </View>
    <View style={{ flexBasis: wide ? '16%' : '100%', minWidth: 0, gap: 12, alignItems: 'flex-start' }}>
      <AdminReportLink label="View Trends" href="/admin/trends" primary /><Text style={s.small}>Follow the week in detail.</Text>
    </View>
  </View>;
}

/** @purpose Home charts with the compact clip comparison and the recorded weekly support sentence. */
export function AdminReportHomeBody({ data }: { data: AdminReportData }) {
  const { width, fontScale } = useWindowDimensions(); const paired = width >= 1024 && fontScale <= 1.3;
  const input = homeInput(data); const clips = homeKpis(input, formatUsd).find(card => card.id === 'clips')!;
  const percent = clips.delta ? weekChange(clips.delta.current, clips.delta.previous).percent : null;
  const sections = reportPageSections('home', data);
  return <View style={{ gap: 24 }}>
    <AdminReportFigure chart={sections[0].charts![0]} plotHeight={144} />
    <View style={[s.grid, { gap: 24 }]}>
      <View style={{ flexBasis: paired ? '73%' : '100%', minWidth: 0, flexGrow: 1 }}><AdminReportFigure chart={sections[1].charts![0]} plotHeight={80} /></View>
      <View style={{ flexBasis: paired ? '21%' : '100%', minWidth: 0, flexGrow: 1, borderLeftWidth: 1, borderLeftColor: c.border, paddingLeft: 20, marginTop: paired ? 24 : 0, gap: 6 }}>
        <Text style={[s.metricValue, { color: c.cyan }]} accessibilityLabel={percent == null ? 'No percent change' : `Clip change: ${weeklyChange(clips, true)}`}>{percent == null ? '—' : weeklyChange(clips, true)}</Text>
        <Text style={s.strong}>{percent == null ? weeklyChange(clips) : 'versus the prior week'}</Text>
        <Text style={[s.small, { marginTop: 8 }]}>{clipsSentence('Prior 7 days', input.clipsPrev7d)}</Text>
        <Text style={s.small}>{clipsSentence('Last 7 days', input.clips7d)}</Text>
      </View>
    </View>
    <View style={[s.row, { borderLeftWidth: 2, borderLeftColor: c.jade, paddingLeft: 16, alignItems: 'flex-start', gap: 24 }]}>
      <Text style={s.kicker}>At a glance</Text><Text style={s.sentence}>{isMeasured(input.donations7dCents) && isMeasured(input.clips7d) ? `${formatUsd(input.donations7dCents)} in recorded donations and ${formatCount(input.clips7d)} ${input.clips7d === 1 ? 'clip' : 'clips'} uploaded over the last 7 days.` : 'One or more weekly totals were not in this read.'}</Text>
    </View>
    <AdminHomeCards />
    {sections.slice(2).map(section => <AdminReportSection key={section.id} section={section} />)}
  </View>;
}
