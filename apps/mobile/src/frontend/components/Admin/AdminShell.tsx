import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccessRestricted } from '@/components/Admin/AccessRestricted';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, isLightCanvas } from '@/constants/theme';
import { AdminLensProvider, useAdminLens } from '@/context/AdminLensContext';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  ADMIN_LENSES,
  isAdminNavActive,
  navGroupsForLens,
  type AdminNavGroupId,
  type AdminNavHref,
} from '@/lib/admin';
import { FOCAL } from '@/theme/motion';

type AdminShellProps = {
  children: ReactNode;
};

/**
 * @purpose Production control-plane chrome: Marketing / Owner / Engineer lens, top nav (category tabs +
 *   the active category's desks), and Publish to app. 2026-09: collapsed from a two-layout system
 *   (tall left sidebar on web / chip rows on mobile) to one top-nav layout used everywhere — the sidebar's
 *   own vertical scroll area could get clipped by the surrounding viewport with no way to reach the
 *   groups below the fold. A horizontal-scrolling top nav has no such failure mode.
 * @sideEffects AsyncStorage `tapuai.adminLens`; `publish_app_runtime` from the header CTA.
 */
export function AdminShell({ children }: AdminShellProps) {
  return (
    <AdminLensProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminLensProvider>
  );
}

function AdminShellInner({ children }: AdminShellProps) {
  const { isAdmin, loading } = useAuth();
  const { dirty, pendingCount, publishLive, live } = useAppRuntime();
  const { lens, setLens } = useAdminLens();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [publishing, setPublishing] = useState(false);
  const navGroups = useMemo(() => navGroupsForLens(lens), [lens]);
  const isHome = isAdminNavActive('/admin', pathname);
  const [groupId, setGroupId] = useState<AdminNavGroupId | null>(null);

  useEffect(() => {
    if (isHome) {
      setGroupId(null);
      return;
    }
    const hit = navGroups.find((group) => group.items.some((item) => isAdminNavActive(item.href, pathname)));
    setGroupId(hit ? hit.id : null);
  }, [pathname, navGroups, isHome]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={FOCAL.jadeInk} />
      </View>
    );
  }

  if (!isAdmin) return <AccessRestricted />;

  const ship = async () => {
    setPublishing(true);
    try {
      await publishLive();
    } finally {
      setPublishing(false);
    }
  };

  const jadeOn = isLightCanvas(live.theme.jade) ? FOCAL.ink : '#FFFFFF';
  const activeGroup = navGroups.find((group) => group.id === groupId) ?? null;

  return (
    <View style={[styles.root, { backgroundColor: live.theme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12), backgroundColor: live.theme.background }]}>
        <View style={styles.brandRow}>
          <AnimatedButton
            haptic="selection"
            accessibilityLabel="Admin home"
            contentStyle={styles.brandHit}
            onPress={() => router.push('/admin')}
          >
            <Text style={styles.brandKicker}>Tapua&apos;i</Text>
            <Text style={styles.brand}>Admin Portal</Text>
          </AnimatedButton>
          <View style={styles.brandActions}>
            {dirty ? (
              <AnimatedButton
                haptic="medium"
                accessibilityLabel="Publish to app"
                contentStyle={styles.publishHit}
                disabled={publishing}
                onPress={() => void ship()}
              >
                <Text style={styles.publishLabel}>
                  {publishing ? 'Publishing…' : `Publish to app · ${pendingCount}`}
                </Text>
              </AnimatedButton>
            ) : null}
            <AnimatedButton
              haptic="selection"
              accessibilityLabel="Open production app"
              contentStyle={styles.homeHit}
              onPress={() => router.push('/')}
            >
              <Text style={styles.homeLabel}>Open production app</Text>
            </AnimatedButton>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ADMIN_LENSES.map((item) => {
            const on = item.id === lens;
            return (
              <AnimatedButton
                key={item.id}
                haptic="selection"
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: on }}
                contentStyle={[styles.lensChip, on && styles.lensChipOn]}
                onPress={() => setLens(item.id)}
              >
                <Text style={[styles.lensLabel, on && styles.lensLabelOn]}>{item.label}</Text>
              </AnimatedButton>
            );
          })}
        </ScrollView>

        <View style={styles.divider} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <AnimatedButton
            haptic="selection"
            accessibilityRole="tab"
            accessibilityLabel="Home"
            accessibilityState={{ selected: isHome }}
            contentStyle={[
              styles.groupTab,
              isHome && styles.groupTabOn,
              isHome && { backgroundColor: live.theme.jade, borderColor: live.theme.jade },
            ]}
            onPress={() => router.push('/admin')}
          >
            <Text style={[styles.groupTabLabel, isHome && styles.groupTabLabelOn, isHome && { color: jadeOn }]}>
              Home
            </Text>
          </AnimatedButton>
          {navGroups.map((group) => {
            const on = group.id === groupId;
            return (
              <AnimatedButton
                key={group.id}
                haptic="selection"
                accessibilityRole="tab"
                accessibilityLabel={group.label}
                accessibilityState={{ selected: on }}
                contentStyle={[
                  styles.groupTab,
                  on && styles.groupTabOn,
                  on && { backgroundColor: live.theme.jade, borderColor: live.theme.jade },
                ]}
                onPress={() => {
                  setGroupId(group.id);
                  const first = group.items[0];
                  if (first) router.push(first.href as AdminNavHref);
                }}
              >
                <Text style={[styles.groupTabLabel, on && styles.groupTabLabelOn, on && { color: jadeOn }]}>
                  {group.label}
                </Text>
              </AnimatedButton>
            );
          })}
        </ScrollView>

        {activeGroup ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {activeGroup.items.map((item) => {
              const on = isAdminNavActive(item.href, pathname);
              return (
                <AnimatedButton
                  key={item.href}
                  haptic="selection"
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: on }}
                  contentStyle={[styles.deskChip, on && styles.deskChipOn]}
                  onPress={() => router.push(item.href as AdminNavHref)}
                >
                  <Text style={[styles.deskChipLabel, on && styles.deskChipLabelOn]}>{item.label}</Text>
                </AnimatedButton>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.stage}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.backgroundBase,
  },
  root: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
  },
  header: {
    flexShrink: 0,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  brandHit: {
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  brandKicker: {
    color: FOCAL.jadeInk,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  brand: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  homeHit: {
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  homeLabel: {
    color: FOCAL.jadeInk,
    fontSize: 13,
    fontWeight: '800',
  },
  publishHit: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  publishLabel: {
    color: FOCAL.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  chips: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 12,
    alignItems: 'center',
  },
  lensChip: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lensChipOn: {
    backgroundColor: FOCAL.electricGold,
    borderColor: FOCAL.electricGold,
  },
  lensLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  lensLabelOn: {
    color: FOCAL.ink,
  },
  groupTab: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTabOn: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.jadeInk,
  },
  groupTabLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  groupTabLabelOn: {
    color: FOCAL.ink,
  },
  deskChip: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deskChipOn: {
    borderColor: FOCAL.electricGold,
  },
  deskChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  deskChipLabelOn: {
    color: FOCAL.electricGold,
  },
  stage: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
});
