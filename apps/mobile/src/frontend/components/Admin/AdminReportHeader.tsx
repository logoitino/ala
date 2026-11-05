/**
 * Expo admin report header: brand, main report tabs, Manage desks directory with lens / group filters and
 * desk search, Publish to app and account actions (split out of AdminChrome.tsx for R4-03; behaviour unchanged).
 * Render it inside a page's ScrollView (`AdminPage` does), never in AdminShell, so enlarged text and focus can scroll it.
 * Link children use flat styles because Expo Router's Slot merges them as plain objects.
 * @sideEffects Expo Router navigation, admin lens persistence, explicit Publish and sign-in / sign-out.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Link, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AdminBtn } from '@/components/Admin/AdminControls';
import { ADMIN_REPORT_COLORS } from '@/components/Admin/adminReportColors';
import { BrandMark } from '@/components/UI/BrandMark';
import { useAdminLens } from '@/context/AdminLensContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  ADMIN_LENSES, ADMIN_PRODUCT_NAV, ADMIN_REPORT_NAV, ADMIN_REPORT_UTILITIES, ADMIN_MANAGE_UTILITIES,
  adminWorkspaceForPath, isAdminNavActive, navGroupsForLens,
  type AdminNavGroupId, type AdminNavHref, type AdminNavItem,
} from '@/lib/admin';
import { impactPress } from '@/lib/haptics';

const colors = ADMIN_REPORT_COLORS;

const REPORT_NAV_ICONS: Partial<Record<AdminNavHref, keyof typeof Ionicons.glyphMap>> = {
  '/admin': 'home-outline', '/admin/trends': 'trending-up-outline', '/admin/audience': 'people-outline',
  '/admin/revenue': 'cash-outline', '/admin/health': 'pulse-outline', '/admin/product': 'layers-outline',
};

/** One report / desk link; `detail` renders the Manage desks card with its hint. Also used by `AdminPage` workspace rows. */
export function AdminHeaderLink({ item, selected, detail = false, onNavigate }: { item: AdminNavItem; selected: boolean; detail?: boolean; onNavigate?: () => void }) {
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
              <BrandMark size={40} showWordmark={false} />
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

const styles = StyleSheet.create({
  reportHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingVertical: 12, gap: 8 },
  headerBrandRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  headerBrandHit: { minHeight: 44, minWidth: 142, flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
