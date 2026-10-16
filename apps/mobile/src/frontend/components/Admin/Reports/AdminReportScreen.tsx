/** Main-admin report routes share one responsive scroll surface with the navigation header.
 * Page-specific slices preserve the existing session and expose loading, missing and failed reads. */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { utcStamp } from '@tapuai/shared-types/admin';
import { AdminReportHeader } from '@/components/Admin/AdminChrome';
import { useAdminReports } from '@/hooks/useAdminReports';
import type { AdminReportSections } from '@/lib/adminReports';
import { AdminReportAnalytics } from './AdminReportAnalytics';
import { AdminReportHealth } from './AdminReportHealth';
import { AdminReportCoverage } from './AdminReportCoverage';
import { AdminReportLink, AdminReportSection } from './AdminReportSection';
import { AdminReportHomeBody, AdminReportHomeHero } from './AdminReportHome';
import { PAGE_TITLES, PAGE_LEDES, reportPageSections, type AdminReportPage } from './reportPages';
import { reportProductSections } from './reportProductPages';
import { REPORT_INK as c, reportStyles as s } from './reportStyles';

const SLICES: Record<AdminReportPage, (keyof AdminReportSections)[]> = { home: ['reports', 'revenue'], trends: ['reports'], audience: ['reports'], revenue: ['reports', 'revenue', 'breakdown'],
  health: ['reports', 'revenue', 'runtime', 'stock'], product: ['runtime'], analytics: ['reports', 'revenue'], departments: ['reports', 'revenue'], features: ['runtime'], profile: ['profile', 'runtime'], 'sign-in': ['softWall'], people: ['softWall', 'people'], coverage: ['reports', 'runtime'] };
const SOURCE_NAMES = { reports: 'get_admin_reports', revenue: 'get_company_revenue_summary', breakdown: 'get_admin_malo_breakdown', runtime: 'Published runtime switches', profile: 'Profile oversight', softWall: 'Sign-in oversight', people: 'Profiles', stock: 'Drip inventory' };
export function reportSectionsFor(page: AdminReportPage): AdminReportSections {
  const sections: AdminReportSections = { reports: false, revenue: false, breakdown: false, runtime: false, profile: false, softWall: false, people: false, stock: false };
  for (const key of SLICES[page]) sections[key] = true;
  return sections;
}

/** @purpose Render a complete report destination under the existing admin authorization gate. */
export function AdminReportScreen({ page }: { page: AdminReportPage }) {
  // Report routes retain distinct browser titles even when the surrounding Expo layout is shared.
  useEffect(() => { if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = `${page === 'home' ? 'Home' : PAGE_TITLES[page]} · Tapua’i Admin`; }, [page]);
  const data = useAdminReports(reportSectionsFor(page));
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const bodyOffset = useRef(0);
  const register = (id: string, event: LayoutChangeEvent) => { positions.current[id] = event.nativeEvent.layout.y; };
  const jump = (id: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Expo retains earlier stack screens in the DOM; only this report's scroll owner may receive focus.
      const root = scroll.current?.getScrollableNode();
      const section = root instanceof HTMLElement ? root.querySelector<HTMLElement>(`[id="report-${id}"]`) : null;
      section?.scrollIntoView({ behavior: 'auto', block: 'start' });
      const heading = section?.querySelector<HTMLElement>('[role="heading"]'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    } else scroll.current?.scrollTo({ y: bodyOffset.current + (positions.current[id] ?? 0), animated: false });
  };
  const pad = width < 640 ? 16 : width < 1024 ? 24 : 40;
  const product = ['product', 'features', 'profile', 'sign-in', 'people', 'coverage'].includes(page);
  const sections = product ? reportProductSections(page, data) : reportPageSections(page, data);
  const sectionShortcuts = page !== 'home' && page !== 'health' && page !== 'analytics' && sections.length > 1;
  const refresh = <AdminReportLink label={data.loading ? 'Refreshing…' : 'Refresh report'} disabled={!data.enabled || data.loading} onPress={() => { void data.refresh(); }} />;
  return <ScrollView ref={scroll} style={s.root} contentContainerStyle={{ paddingBottom: insets.bottom }}
    refreshControl={<RefreshControl refreshing={data.loading} onRefresh={() => { void data.refresh(); }} tintColor={c.jade} />}>
    <AdminReportHeader />
    <View style={[s.content, { paddingHorizontal: pad }]}>
      <View style={s.header}>
        {page === 'home' ? <>
          <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.kicker}>Community report · Last 7 days</Text>
            <View style={s.row}><Text style={s.small}>{data.reports.generatedAt ? `Read ${utcStamp(data.reports.generatedAt) ?? 'time unavailable'}` : 'Waiting on a read'}</Text>{refresh}</View></View>
          <AdminReportHomeHero data={data} />
        </> : <>
          <Text style={s.kicker}>Main Admin · Reports</Text><Text accessibilityRole="header" aria-level={1} style={[s.h1, { fontSize: width < 600 ? 30 : 36 }]}>{PAGE_TITLES[page]}</Text>
          <Text style={s.sentence}>{PAGE_LEDES[page]}</Text>
          <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.small}>{data.reports.generatedAt && SLICES[page].includes('reports') ? `Read ${utcStamp(data.reports.generatedAt) ?? 'time unavailable'}` : 'Recorded snapshots · UTC'}</Text>
            {refresh}</View>
        </>}
      </View>
      {!data.enabled && data.disabledReason ? <View style={s.notice}><Text style={s.sentence}>{data.disabledReason}</Text></View> : null}
      {data.loading ? <View style={s.row}><ActivityIndicator color={c.jade} accessibilityLabel="Loading report" /><Text style={s.small}>Loading recorded snapshots…</Text></View> : null}
      {data.enabled && !data.loading ? SLICES[page].map(key => { const snapshot = data[key]; return snapshot.error
        ? <View key={key} accessibilityRole="alert" style={[s.notice, s.error]}><Text style={[s.strong, { color: c.bad }]}>{SOURCE_NAMES[key]} could not be read</Text><Text style={s.sentence}>{snapshot.error}</Text></View>
        : !snapshot.configured ? <View key={key} style={s.notice}><Text style={s.sentence}>{SOURCE_NAMES[key]} is not configured. Its values are not in this read.</Text></View> : null; }) : null}
      {data.enabled ? <>
        {sectionShortcuts ? <View style={{ gap: 4 }} accessibilityLabel="In this report">
          <Text style={s.kicker}>In this report</Text>
          <View style={s.row}>{sections.map(section => <AdminReportLink key={section.id} label={section.title} onPress={() => jump(section.id)} />)}</View>
        </View> : null}
        <View style={{ gap: 28 }} onLayout={event => { bodyOffset.current = event.nativeEvent.layout.y; }}>
          {page === 'home' ? <AdminReportHomeBody data={data} /> : page === 'coverage' ? <AdminReportCoverage data={data} /> : page === 'analytics' ? <AdminReportAnalytics data={data} jump={jump} register={register} /> : page === 'health' ? <AdminReportHealth data={data} />
            : sections.map(section => <AdminReportSection key={section.id} section={section} onLayout={event => register(section.id, event)} />)}
        </View>
      </> : null}
    </View>
  </ScrollView>;
}
