/**
 * Shared Expo admin page canvas: `AdminPage` (report header, Back / Home trail, heading, workspace and
 * related-analysis rows, save cue, error line, feature boundary) and `AdminTrail`. The header lives in
 * `AdminReportHeader.tsx`, editor primitives in `AdminControls.tsx` and the palette in `adminReportColors.ts`
 * (split for R4-03); current shared typefaces and proportional headings keep narrow desks readable.
 * This file re-exports primitives so desks and test mocks keep one import path.
 * @sideEffects Expo Router navigation (Back / Home / Open in app) and pull-to-refresh callbacks.
 */
import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { type Href, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeatureBoundary } from '@/components/Common/FeatureBoundary';
import * as controls from '@/components/Admin/AdminControls';
import * as header from '@/components/Admin/AdminReportHeader';
import { ADMIN_REPORT_COLORS as REPORT_COLORS } from '@/components/Admin/adminReportColors';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { adminTrailForPath, adminWorkspaceForPath, adminAnalysisForPath, isAdminNavActive } from '@/lib/admin';
import { FOCAL } from '@/theme/motion';
import { FONT, TYPE, figtree } from '@/theme/fonts';

// One import path for every desk and for the jest.mock factories that replace this module. Plain bindings,
// not `export … from`: they stay writable like the original exports, so `jest.spyOn(AdminChrome, 'AdminBtn')`
// (WorkoutChallengesPanel.test) still works; a re-export getter cannot be redefined.
export const ADMIN_REPORT_COLORS = REPORT_COLORS;
export const AdminReportHeader = header.AdminReportHeader;
export const AdminField = controls.AdminField;
export const AdminFieldRow = controls.AdminFieldRow;
export const AdminRow = controls.AdminRow;
export const AdminBtn = controls.AdminBtn;
export const AdminPanel = controls.AdminPanel;
export const AdminNotice = controls.AdminNotice;
export const AdminEmpty = controls.AdminEmpty;
export const AdminPills = controls.AdminPills;
export const AdminSectionTitle = controls.AdminSectionTitle;
export const AdminMetrics = controls.AdminMetrics;
export const AdminDeskLink = controls.AdminDeskLink;
export const AdminPublishBar = controls.AdminPublishBar;
export const AdminSuggest = controls.AdminSuggest;
const AdminHeaderLink = header.AdminHeaderLink;

const colors = ADMIN_REPORT_COLORS;

type AdminPageProps = {
  title: string;
  lede: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  /** Instant catalog edits vs chrome that waits for Publish to app. */
  saveMode?: 'instant' | 'publish';
};

/**
 * @purpose Back / Home crumb plus optional Open in app so every desk can return to the portal home or the fan surface it manages.
 */
export function AdminTrail() {
  const pathname = usePathname();
  const router = useRouter();
  const trail = adminTrailForPath(pathname);
  const crumb = trail.isHome
    ? 'Home'
    : ['Home', trail.group?.label, trail.desk.label].filter(Boolean).join(' / ');

  return (
    <View style={styles.trail} accessibilityRole="toolbar" accessibilityLabel={crumb}>
      {trail.isHome ? null : (
        <AnimatedButton
          haptic="selection"
          accessibilityLabel="Back"
          contentStyle={styles.trailHit}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/admin');
          }}
        >
          <Text style={styles.trailHitLabel}>Back</Text>
        </AnimatedButton>
      )}
      <AnimatedButton
        haptic="selection"
        accessibilityLabel="Admin home"
        contentStyle={[styles.trailHit, trail.isHome && styles.trailHitOn]}
        onPress={() => router.push('/admin')}
      >
        <Text style={[styles.trailHitLabel, trail.isHome && styles.trailHitLabelOn]}>Home</Text>
      </AnimatedButton>
      <Text style={styles.trailCrumb}>
        {crumb}
      </Text>
      {trail.fanHref ? (
        <AnimatedButton
          haptic="selection"
          accessibilityLabel="Open in app"
          contentStyle={styles.trailHit}
          onPress={() => router.push(trail.fanHref as Href)}
        >
          <Text style={styles.trailHitLabel}>Open in app</Text>
        </AnimatedButton>
      ) : null}
    </View>
  );
}

/**
 * @purpose Shared scroll canvas for every `/admin` tool (heading, pull-to-refresh, error line).
 */
export function AdminPage({
  title,
  lede,
  children,
  refreshing = false,
  onRefresh,
  error,
  saveMode,
}: AdminPageProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const workspace = adminWorkspaceForPath(pathname);
  const analysis = adminAnalysisForPath(pathname);
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 28) }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={FOCAL.neonJade}
            colors={[FOCAL.neonJade]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      <AdminReportHeader />
      <View style={[styles.content, { paddingHorizontal: width >= 1024 ? 40 : width >= 640 ? 24 : 16 }]}>
      <AdminTrail />
      <View style={styles.pageHeading}>
        <Text style={styles.pageKicker}>Tapua&apos;i admin</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, width >= 640 && { fontSize: 32, lineHeight: 38 }]}>{title}</Text>
        <Text style={styles.pageLede}>{lede}</Text>
      </View>
      {workspace ? <View style={{ gap: 4 }} accessibilityLabel={`${workspace.label} workspace`} role="navigation">
        <Text style={styles.pageKicker}>{workspace.label}</Text>
        <View style={styles.headerSubNav}>{workspace.items.map(item => <AdminHeaderLink key={item.href} item={item} selected={isAdminNavActive(item.href, pathname)} />)}</View>
      </View> : null}
      {analysis.length ? <View style={styles.headerSubNav} role="navigation" accessibilityLabel="Related analysis">
        {analysis.map(item => <AdminHeaderLink key={item.href} item={item} selected={false} />)}
      </View> : null}
      {saveMode === 'instant' ? (
        <Text style={styles.saveCue}>Saves instantly — spelling, stats, scores, and prices hit the fan app on Save.</Text>
      ) : null}
      {saveMode === 'publish' ? (
        <Text style={styles.saveCuePublish}>
          Draft only. Hit Publish to app when you want fans to see tab, Daylight color, copy, catalog, Profile, and Highlights layout changes.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FeatureBoundary feature={pathname.startsWith('/admin/support') ? 'support' : 'admin'} resetKey={pathname}>{children}</FeatureBoundary>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerSubNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pageHeading: { gap: 8, paddingVertical: 8 },
  pageKicker: { color: colors.jade, ...TYPE.caption, ...figtree('800'), letterSpacing: 0.8, textTransform: 'uppercase' },
  pageTitle: { color: colors.text, ...TYPE.display, fontFamily: FONT.display, fontWeight: 'normal', letterSpacing: -0.6 },
  pageLede: { color: colors.textSoft, ...TYPE.body, ...figtree('400') },
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 1680,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 14,
  },
  trail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  trailHit: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailHitOn: {
    backgroundColor: colors.jade,
    borderColor: colors.jade,
  },
  trailHitLabel: {
    color: colors.text,
    ...TYPE.button,
    ...figtree('800'),
  },
  trailHitLabelOn: {
    color: '#FFFFFF',
  },
  trailCrumb: {
    flexGrow: 1,
    flexShrink: 1,
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('700'),
  },
  error: {
    color: colors.danger,
    ...TYPE.body,
    ...figtree('700'),
  },
  saveCue: {
    color: colors.jade,
    ...TYPE.body,
    ...figtree('700'),
  },
  saveCuePublish: {
    color: colors.electricGold,
    ...TYPE.body,
    ...figtree('700'),
  },
});
