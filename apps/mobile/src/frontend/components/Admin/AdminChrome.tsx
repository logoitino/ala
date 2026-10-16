/**
 * Shared Expo admin report header and editor primitives. The header scrolls inside each page; open panels,
 * readable report inks and 44-point controls carry the approved report design into existing write desks.
 * The desk directory opens only on request, keeping its selected tool out of the editor canvas until needed.
 * Link children use flat styles because Expo Router's Slot merges them as plain objects.
 * @sideEffects Existing route, editor, sign-in/sign-out and draft/publish callbacks; the header persists the existing lens.
 */
import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardTypeOptions } from 'react-native';
import { Link, type Href, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeatureBoundary } from '@/components/Common/FeatureBoundary';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { radii } from '@/constants/theme';
import { useAdminLens } from '@/context/AdminLensContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  ADMIN_LENSES, ADMIN_PRODUCT_NAV, ADMIN_REPORT_NAV, ADMIN_REPORT_UTILITIES, ADMIN_MANAGE_UTILITIES,
  adminTrailForPath, adminWorkspaceForPath, adminAnalysisForPath, isAdminNavActive, navGroupsForLens,
  type AdminNavGroupId, type AdminNavHref, type AdminNavItem,
} from '@/lib/admin';
import { FOCAL } from '@/theme/motion';
import { impactPress } from '@/lib/haptics';

/** Same Daylight report palette as the approved Next portal, independent of editable fan chrome. */
export const ADMIN_REPORT_COLORS = {
  background: '#f6f8f7', surface: '#ffffff', border: '#e4e9e6', text: '#10161a',
  textSoft: '#4a5560', textMuted: '#5b6670', jade: '#00733c', danger: '#b3202f', electricGold: '#8a6400',
};
const colors = ADMIN_REPORT_COLORS;

const REPORT_NAV_ICONS: Partial<Record<AdminNavHref, keyof typeof Ionicons.glyphMap>> = {
  '/admin': 'home-outline', '/admin/trends': 'trending-up-outline', '/admin/audience': 'people-outline',
  '/admin/revenue': 'cash-outline', '/admin/health': 'pulse-outline', '/admin/product': 'layers-outline',
};

function AdminHeaderLink({ item, selected, detail = false, onNavigate }: { item: AdminNavItem; selected: boolean; detail?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/$/, '');
  const { width } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const icon = !detail && width >= 1536 ? REPORT_NAV_ICONS[item.href] : undefined;
  return (
    <Link href={item.href} asChild onPress={() => impactPress('selection')}>
      <Pressable accessibilityRole="link" accessibilityLabel={item.label} accessibilityHint={detail ? item.hint : undefined} onPress={onNavigate}
        aria-current={selected ? pathname === item.href ? 'page' : true : undefined}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={StyleSheet.flatten([styles.headerLinkWrap, width >= 1280 && styles.headerLinkWide, styles.headerLink,
          detail && styles.deskLink, detail && { flexBasis: width < 640 ? '100%' : '47%' },
          selected && styles.headerLinkOn, focused && styles.headerFocus])}>
        {icon ? <Ionicons name={icon} size={16} color={selected ? colors.jade : colors.textSoft} aria-hidden accessible={false} /> : null}
        <View style={detail ? styles.deskCopy : undefined}>
          <Text style={[styles.headerLinkLabel, detail && styles.deskTitle, selected && styles.headerLinkLabelOn]}>{item.label}</Text>
          {detail && item.hint ? <Text style={styles.deskHint}>{item.hint}</Text> : null}
        </View>
        {detail ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} aria-hidden accessible={false} /> : null}
      </Pressable>
    </Link>
  );
}

function AdminHeaderButton({ label, selected, expanded, onPress }: {
  label: string; selected?: boolean; expanded?: boolean; onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} aria-pressed={selected}
    // RN-web does not forward native expansion state; provide both for the same menu state.
    aria-expanded={expanded}
    accessibilityState={expanded === undefined ? undefined : { expanded }}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onPress={() => { impactPress('selection'); onPress(); }}
    style={[styles.headerLink, selected && styles.headerLinkOn, focused && styles.headerFocus]}>
    <Text style={[styles.headerLinkLabel, selected && styles.headerLinkLabelOn]}>{label}</Text>
  </Pressable>;
}

/**
 * @purpose Main report navigation plus the complete existing editor menu. Render inside a page's ScrollView,
 *   never in AdminShell, so enlarged text and keyboard focus can move the whole header into view.
 * @sideEffects Expo Router navigation, existing lens persistence, explicit Publish and existing account actions.
 */
export function AdminReportHeader() {
  const pathname = usePathname();
  const selectedWorkspace = adminWorkspaceForPath(pathname);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { lens, setLens } = useAdminLens();
  const { user, signOut } = useAuth();
  const { requireAuth } = useSoftWall();
  const { dirty, pendingCount, publishLive, saveError } = useAppRuntime();
  const groups = useMemo(() => [...navGroupsForLens(lens), { id: 'utilities' as const, label: 'Tools', items: ADMIN_MANAGE_UTILITIES }], [lens]);
  const activeGroup = groups.find((group) => group.items.some(item => isAdminNavActive(item.href, pathname) || adminWorkspaceForPath(item.href)?.items.some(member => isAdminNavActive(member.href, pathname))));
  const [manageOpen, setManageOpen] = useState(false);
  const [groupId, setGroupId] = useState<AdminNavGroupId | 'utilities' | null>(activeGroup?.id ?? null);
  const [deskQuery, setDeskQuery] = useState('');
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const productOpen = isAdminNavActive('/admin/product', pathname);
  // Draft editors already render the full Publish / Discard bar; keep one publication control per page.
  const pageHasPublishBar = ['/admin/features', '/admin/look', '/admin/catalog', '/admin/lab']
    .some((path) => isAdminNavActive(path as AdminNavHref, pathname));
  const paddingHorizontal = width >= 1024 ? 40 : width >= 640 ? 24 : 16;
  const currentGroup = groups.find((group) => group.id === groupId) ?? groups[0];
  const query = deskQuery.trim().toLocaleLowerCase();
  // Search uses the existing lens directory; finding a desk never changes authorization or routes.
  const searchGroups = groups
    .map(group => ({ ...group, items: group.items.flatMap(item => item.members && !item.label.toLocaleLowerCase().includes(query) ? item.members : [item]).filter(item => `${group.label} ${item.label} ${item.hint ?? ''} ${item.searchTerms ?? ''}`.toLocaleLowerCase().includes(query)) }))
    .filter(group => group.items.length > 0);
  const matches = searchGroups.reduce((count, group) => count + group.items.length, 0);

  useEffect(() => {
    setGroupId(activeGroup?.id ?? null);
  }, [activeGroup?.id, pathname]);

  // Choosing a desk leaves its page ready to use instead of repeating the expanded directory above it.
  useEffect(() => { setManageOpen(false); setDeskQuery(''); }, [pathname]);

  const ship = async () => {
    if (publishingRef.current || !dirty) return;
    publishingRef.current = true;
    setPublishing(true); setPublishError(null);
    try { await publishLive(); }
    catch (caught) { setPublishError(caught instanceof Error ? caught.message : 'Could not publish.'); }
    finally { publishingRef.current = false; setPublishing(false); }
  };

  const leave = async () => {
    if (signingOutRef.current || !user) return;
    signingOutRef.current = true;
    setSigningOut(true); setSignOutError(null);
    try { await signOut(); router.replace('/'); }
    catch (caught) { setSignOutError(caught instanceof Error ? caught.message : 'Could not sign out.'); }
    finally { signingOutRef.current = false; setSigningOut(false); }
  };

  return (
    <View style={styles.reportHeader}>
      <View style={[styles.headerContent, { paddingHorizontal }]}>
        <View style={styles.headerBrandRow}>
          <Link href="/admin" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Admin home" style={StyleSheet.flatten(styles.headerBrandHit)}>
              <View aria-hidden style={styles.headerBrandMark}><Text style={styles.headerBrandMarkText}>T</Text></View>
              <View><Text style={styles.headerBrand}>Tapua&apos;i</Text><Text style={styles.headerBrandSoft}>Main Admin</Text></View>
            </Pressable>
          </Link>
          <View style={[styles.mainReportNav, width >= 1280 ? styles.mainReportNavWide : styles.mainReportNavPhone]}
            role="navigation" accessibilityLabel="Admin reports">
            {ADMIN_REPORT_NAV.map((item) => <AdminHeaderLink key={item.href} item={item}
              selected={isAdminNavActive(item.href, pathname)} />)}
          </View>
          <View style={styles.headerActions}>
            {ADMIN_REPORT_UTILITIES.map((item) => <AdminHeaderLink key={item.href} item={item}
              selected={isAdminNavActive(item.href, pathname)} />)}
            <AdminHeaderButton label="Manage desks" expanded={manageOpen} onPress={() => setManageOpen((open) => !open)} />
            <Link href="/" asChild><Pressable accessibilityRole="link" accessibilityLabel="Open production app" style={StyleSheet.flatten(styles.headerLink)}>
              <Text style={styles.headerLinkLabel}>Open production app</Text>
            </Pressable></Link>
            {dirty && !pageHasPublishBar ? <AdminBtn label={publishing ? 'Publishing…' : 'Publish to app'}
              kind="primary" disabled={publishing} onPress={() => void ship()} /> : null}
            {user ? <AdminBtn label={signingOut ? 'Signing out…' : 'Sign out'} disabled={signingOut}
              onPress={() => void leave()} /> : <AdminBtn label="Sign in"
              onPress={() => requireAuth({ kind: 'signin', resume: () => router.replace('/admin') })} />}
          </View>
        </View>
        {dirty ? <Text style={styles.headerDraft}>{pendingCount} unpublished change{pendingCount === 1 ? '' : 's'}</Text> : null}
        {signOutError || publishError || saveError ? <Text accessibilityRole="alert" style={styles.error}>
          {signOutError || publishError || saveError}
        </Text> : null}
        {productOpen ? <View style={styles.headerSubNav} role="navigation" accessibilityLabel="Product reports">
          {ADMIN_PRODUCT_NAV.map((item) => <AdminHeaderLink key={item.href} item={item}
            selected={item.href === '/admin/product' ? pathname.replace(/\/$/, '') === item.href : isAdminNavActive(item.href, pathname)} />)}
        </View> : null}
        {manageOpen ? <View style={styles.manageMenu}>
          <View style={styles.manageHeading}>
            <Text style={styles.deskHint}>Choose what to manage.</Text>
            <View style={styles.deskSearchRow}>
              <TextInput accessibilityLabel="Find an admin desk" placeholder="Find a desk…" value={deskQuery} onChangeText={setDeskQuery}
                autoCorrect={false} autoCapitalize="none" clearButtonMode="never" style={styles.deskSearch} placeholderTextColor={colors.textMuted} />
              {deskQuery ? <AdminHeaderButton label="Clear search" onPress={() => setDeskQuery('')} /> : null}
            </View>
          </View>
          <View style={styles.deskFilters}>
            <View style={[styles.deskFilter, width < 1024 && styles.deskFilterStack]}>
              <Text style={styles.deskFilterLabel}>View</Text>
              <View style={[styles.headerSubNav, styles.deskFilterControls]} accessibilityLabel="Desk lens">
                {ADMIN_LENSES.map((item) => <AdminHeaderButton key={item.id} label={item.label} selected={lens === item.id}
                  onPress={() => setLens(item.id)} />)}
              </View>
            </View>
            <View style={[styles.deskFilter, width < 1024 && styles.deskFilterStack]}>
              <Text style={styles.deskFilterLabel}>Group</Text>
              <View style={[styles.headerSubNav, styles.deskFilterControls]} accessibilityLabel="Desk groups">
                {groups.map((group) => <AdminHeaderButton key={group.id} label={group.label} selected={!query && currentGroup?.id === group.id}
                  onPress={() => { setGroupId(group.id); setDeskQuery(''); }} />)}
              </View>
            </View>
          </View>
          <View role="navigation" accessibilityLabel="Production desks" style={{ gap: 12 }}>
            {query ? <>
              <Text accessibilityLiveRegion="polite" style={styles.deskHint}>{matches} {matches === 1 ? 'desk' : 'desks'} found</Text>
              {searchGroups.map(group => <View key={group.id} style={{ gap: 4 }}>
                <Text style={styles.menuLabel}>{group.label}</Text>
                <View style={styles.deskGrid}>{group.items.map(item => <AdminHeaderLink key={item.href} item={item} detail onNavigate={() => setManageOpen(false)} selected={isAdminNavActive(item.href, pathname) || selectedWorkspace === adminWorkspaceForPath(item.href) && selectedWorkspace != null} />)}</View>
              </View>)}
              {!matches ? <Text style={styles.deskHint}>No desks match this search. Try another name or clear the search.</Text> : null}
            </> : <>
              <View style={styles.deskGrid}>{currentGroup?.items.map(item => <AdminHeaderLink key={item.href} item={item} detail onNavigate={() => setManageOpen(false)} selected={isAdminNavActive(item.href, pathname) || selectedWorkspace === adminWorkspaceForPath(item.href) && selectedWorkspace != null} />)}</View>
            </>}
          </View>

        </View> : null}
      </View>
    </View>
  );
}

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
        <Text accessibilityRole="header" style={styles.pageTitle}>{title}</Text>
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

type AdminFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  /** false shows the field read-only (for example a feature behind a switch that is off); default editable. */
  editable?: boolean;
};

export function AdminField({
  label,
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  keyboardType,
  multiline,
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
}: AdminFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        accessibilityState={editable ? undefined : { disabled: true }}
        style={[styles.field, multiline && styles.fieldMulti, !editable && { opacity: 0.55 }]}
      />
    </View>
  );
}

/**
 * @purpose Lay related fields (Home school / Away school, Home name / Away name, …) side by side on
 *   wide screens instead of forcing every field into one full-width stacked column. Each child is
 *   wrapped in its own `flex: 1, minWidth: 200` box rather than touching `AdminField`'s own style, so
 *   plain (non-row) `AdminField` usage elsewhere is completely unaffected — wraps to a single column
 *   automatically on narrow viewports once two 200px-minimum boxes no longer fit side by side.
 */
export function AdminFieldRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      {Children.map(children, (child) => (child ? <View style={styles.fieldRowItem}>{child}</View> : child))}
    </View>
  );
}

type AdminRowProps = {
  title: string;
  meta?: string;
  children?: ReactNode;
  onPress?: () => void;
};

export function AdminRow({ title, meta, children, onPress }: AdminRowProps) {
  const Inner = (
    <>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      </View>
      {children ? <View style={styles.rowActions}>{children}</View> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{Inner}</View>;
  }
  return (
    <AnimatedButton haptic="selection" accessibilityLabel={title} contentStyle={styles.row} onPress={onPress}>
      {Inner}
    </AnimatedButton>
  );
}

type AdminBtnProps = {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
};

export function AdminBtn({ label, onPress, kind = 'ghost', disabled }: AdminBtnProps) {
  return (
    <AnimatedButton
      haptic="medium"
      disabled={disabled}
      accessibilityLabel={label}
      contentStyle={[
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'danger' && styles.btnDanger,
        kind !== 'primary' && styles.btnInline,
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.btnLabel,
          kind === 'primary' && styles.btnLabelPrimary,
          kind === 'danger' && styles.btnLabelDanger,
        ]}
      >
        {label}
      </Text>
    </AnimatedButton>
  );
}

export function AdminPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      {title ? <Text style={styles.panelTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function AdminNotice({ text, tone = 'ok' }: { text: string | null; tone?: 'ok' | 'warn' | 'danger' }) {
  if (!text) return null;
  return (
    <Text
      style={[
        styles.notice,
        tone === 'danger' && styles.noticeDanger,
        tone === 'warn' && styles.noticeWarn,
      ]}
    >
      {text}
    </Text>
  );
}

export function AdminEmpty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

type AdminPillsProps<T extends string> = {
  label?: string;
  items: { id: T; label: string }[];
  value: T | string;
  onChange: (id: T) => void;
};

/**
 * @purpose Wrap-friendly choice chips for admin forms (category, quarter, tier, filters).
 */
export function AdminPills<T extends string>({ label, items, value, onChange }: AdminPillsProps<T>) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.pills} accessibilityRole="tablist">
        {items.map((item) => {
          const on = item.id === value;
          return (
            <AnimatedButton
              key={item.id}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: on }}
              contentStyle={[styles.pill, on && styles.pillOn]}
              onPress={() => onChange(item.id)}
            >
              <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>{item.label}</Text>
            </AnimatedButton>
          );
        })}
      </View>
    </View>
  );
}

/**
 * @purpose Uppercase jade divider used by every desk that stacks more than one list.
 */
export function AdminSectionTitle({ children }: { children: string }) {
  return <Text style={styles.section}>{children}</Text>;
}

/**
 * @purpose Shared metric grid for operational desks so their own numbers are styled once.
 * @param items Big value, uppercase caption, and an optional line of context under it.
 */
export function AdminMetrics({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return (
    <View style={styles.metrics} accessibilityRole="summary">
      {items.map((item) => (
        <View key={item.label} style={styles.metric} accessibilityRole="summary" accessibilityLabel={`${item.label} ${item.value}`}>
          <Text style={styles.metricLabel}>{item.label}</Text>
          <Text style={styles.metricValue}>{item.value}</Text>
          {item.hint ? <Text style={styles.metricHint}>{item.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * @purpose Hand a queue item to the desk that owns it instead of repeating that desk's controls.
 */
export function AdminDeskLink({
  title,
  meta,
  href,
  label = 'Open desk',
  kind = 'primary',
}: {
  title: string;
  meta?: string;
  href: AdminNavHref;
  label?: string;
  kind?: 'primary' | 'ghost' | 'danger';
}) {
  const router = useRouter();
  return (
    <AdminRow title={title} meta={meta}>
      <AdminBtn label={label} kind={kind} onPress={() => router.push(href)} />
    </AdminRow>
  );
}

/**
 * @purpose The one Publish to app / Discard draft control, for any desk that writes the runtime draft.
 * @param note Extra line explaining what stays hidden from fans until the ship.
 * @sideEffects `publish_app_runtime` / `patch_app_runtime_draft` through AppRuntimeContext.
 */
export function AdminPublishBar({ note }: { note?: string }) {
  const { dirty, pendingCount, publishedAt, publishLive, discardDraft, saveError } = useAppRuntime();
  const [publishing, setPublishing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const ship = async () => {
    setPublishing(true);
    setLocalError(null);
    try {
      await publishLive();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Could not publish.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AdminPanel title={dirty ? `${pendingCount} unpublished change${pendingCount === 1 ? '' : 's'}` : 'Live with the fan app'}>
      <Text style={styles.publishBody}>
        {publishedAt
          ? `Last published ${publishedAt.replace('T', ' ').slice(0, 16)} UTC.`
          : 'No publication timestamp is available. Check the published controls.'}
      </Text>
      <AdminBtn
        label={publishing ? 'Publishing…' : dirty ? 'Publish to app' : 'Already live'}
        kind="primary"
        disabled={!dirty || publishing}
        onPress={() => void ship()}
      />
      {dirty ? (
        <AdminBtn
          label="Discard draft"
          kind="danger"
          onPress={() =>
            void discardDraft().catch((caught) =>
              setLocalError(caught instanceof Error ? caught.message : 'Could not discard.'),
            )
          }
        />
      ) : null}
      <AdminNotice text={localError || saveError} tone="warn" />
      <AdminNotice text={dirty ? note ?? 'Fans still see the previous chrome until you publish.' : null} tone="warn" />
    </AdminPanel>
  );
}

type SuggestOption = { id: string; title: string; meta?: string };

type AdminSuggestProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  options: SuggestOption[];
  placeholder?: string;
  onPick?: (option: SuggestOption) => void;
};

/**
 * @purpose Typeahead over a catalog (schools, athletes) so admins never paste ids.
 */
export function AdminSuggest({ label, value, onChangeText, options, placeholder, onPick }: AdminSuggestProps) {
  const needle = value.trim().toLowerCase();
  const hits =
    needle.length < 1
      ? []
      : options
          .filter((row) => `${row.title} ${row.meta ?? ''}`.toLowerCase().includes(needle))
          .slice(0, 6);
  return (
    <View style={styles.fieldWrap}>
      <AdminField label={label} value={value} onChangeText={onChangeText} placeholder={placeholder} />
      {hits.map((row) => (
        <AnimatedButton
          key={row.id}
          haptic="selection"
          accessibilityLabel={`Use ${row.title}`}
          contentStyle={styles.suggest}
          onPress={() => {
            onChangeText(row.title);
            onPick?.(row);
          }}
        >
          <Text style={styles.suggestTitle}>{row.title}</Text>
          {row.meta ? <Text style={styles.suggestMeta}>{row.meta}</Text> : null}
        </AnimatedButton>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  reportHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingVertical: 12, gap: 8 },
  headerBrandRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  headerBrandHit: { minHeight: 44, minWidth: 142, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBrandMark: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.jade, alignItems: 'center', justifyContent: 'center' },
  headerBrandMarkText: { color: colors.surface, fontSize: 22, fontWeight: '800' },
  headerBrand: { color: colors.text, fontSize: 18, fontWeight: '800' },
  headerBrandSoft: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 1 },
  headerDraft: { color: colors.electricGold, fontSize: 13, fontWeight: '600' },
  mainReportNav: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, borderBottomColor: colors.border },
  mainReportNavWide: { flexGrow: 1, flexBasis: 600, minWidth: 480 },
  mainReportNavPhone: { width: '100%', flexBasis: '100%' },
  headerSubNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  headerLinkWrap: { flexGrow: 1, flexBasis: 'auto', minWidth: 80 },
  headerLinkWide: { flexBasis: 0 },
  headerLink: {
    minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 10,
    flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  headerLinkOn: { borderBottomColor: colors.jade },
  headerFocus: { borderColor: colors.jade, borderRadius: 4 },
  headerLinkLabel: { color: colors.textSoft, fontSize: 14, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  headerLinkLabelOn: { color: colors.jade, fontWeight: '800' },
  manageMenu: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  manageHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  deskFilters: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: 4 },
  // A nested flex row needs an explicit width/shrink boundary; the page can fit while its controls are clipped.
  deskFilter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%', flexShrink: 1 },
  deskFilterStack: { width: '100%' },
  deskFilterControls: { minWidth: 0, flexShrink: 1 },
  deskFilterLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', paddingRight: 8 },
  deskCopy: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4 },
  deskTitle: { textAlign: 'left' },
  deskHint: { color: colors.textMuted, fontSize: 12, lineHeight: 19, flexShrink: 1 },
  deskSearchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexGrow: 1, flexBasis: 320, minWidth: 0, maxWidth: 520 },
  deskSearch: { minHeight: 44, minWidth: 0, flexGrow: 1, flexBasis: 180, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.background, fontSize: 14 },
  menuLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 8 },
  deskGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  deskLink: { minWidth: 0, minHeight: 64, flexGrow: 1, justifyContent: 'space-between', borderBottomColor: colors.border, borderBottomWidth: 1 },
  pageHeading: { gap: 8, paddingVertical: 8 },
  pageKicker: { color: colors.jade, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  pageTitle: { color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -0.6 },
  pageLede: { color: colors.textSoft, fontSize: 15, lineHeight: 23 },
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
    fontSize: 12,
    fontWeight: '800',
  },
  trailHitLabelOn: {
    color: '#FFFFFF',
  },
  trailCrumb: {
    flexGrow: 1,
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  saveCue: {
    color: colors.jade,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  saveCuePublish: {
    color: colors.electricGold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldRowItem: {
    flexGrow: 1,
    minWidth: 200,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  field: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  fieldMulti: {
    minHeight: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    minWidth: 44,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  rowCopy: {
    flex: 1,
    minWidth: 160,
    gap: 4,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.jade,
    borderColor: colors.jade,
  },
  btnDanger: {
    borderColor: colors.danger,
  },
  btnInline: {
    alignSelf: 'flex-start',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  btnLabelPrimary: {
    color: '#FFFFFF',
  },
  btnLabelDanger: {
    color: colors.danger,
  },
  panel: {
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    gap: 12,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  busy: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  notice: {
    color: colors.jade,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeDanger: {
    color: colors.danger,
  },
  noticeWarn: {
    color: colors.electricGold,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: {
    borderBottomColor: colors.jade,
  },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  pillLabelOn: {
    color: colors.jade,
  },
  section: {
    color: colors.jade,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    flexGrow: 1,
    minWidth: 88,
    borderBottomWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  metricValue: {
    color: colors.jade,
    fontSize: 28,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  publishBody: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  suggest: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-start',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  suggestTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  suggestMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
