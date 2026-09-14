import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccessRestricted } from '@/components/Admin/AccessRestricted';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  ADMIN_NAV_GROUPS,
  isAdminNavActive,
  type AdminNavGroupId,
  type AdminNavHref,
} from '@/lib/admin';
import { FOCAL } from '@/theme/motion';

type AdminShellProps = {
  children: ReactNode;
};

/**
 * @purpose Production control-plane chrome: grouped nav, Access Restricted, and Publish to app when chrome is drafted.
 * @sideEffects `publish_app_runtime` from the sidebar CTA.
 */
export function AdminShell({ children }: AdminShellProps) {
  const { isAdmin, loading } = useAuth();
  const { dirty, pendingCount, publishLive } = useAppRuntime();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;
  const [groupId, setGroupId] = useState<AdminNavGroupId>('ship');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const hit = ADMIN_NAV_GROUPS.find((group) => group.items.some((item) => isAdminNavActive(item.href, pathname)));
    if (hit) setGroupId(hit.id);
  }, [pathname]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={FOCAL.neonJade} />
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

  const publishCta = dirty ? (
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
  ) : null;

  const navFor = (items: (typeof ADMIN_NAV_GROUPS)[number]['items']) =>
    items.map((item) => {
      const on = isAdminNavActive(item.href, pathname);
      return (
        <AnimatedButton
          key={item.href}
          haptic="selection"
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: on }}
          contentStyle={[wide ? styles.sideItem : styles.chip, on && (wide ? styles.sideItemOn : styles.chipOn)]}
          onPress={() => router.push(item.href as AdminNavHref)}
        >
          <Text style={[wide ? styles.sideLabel : styles.chipLabel, on && (wide ? styles.sideLabelOn : styles.chipLabelOn)]}>
            {item.label}
          </Text>
          {wide ? <Text style={[styles.sideHint, on && styles.sideHintOn]}>{item.hint}</Text> : null}
        </AnimatedButton>
      );
    });

  const mobileGroup = ADMIN_NAV_GROUPS.find((group) => group.id === groupId) ?? ADMIN_NAV_GROUPS[0];

  return (
    <View style={[styles.root, wide && styles.rootWide]}>
      {wide ? (
        <View style={[styles.sidebar, { paddingTop: Math.max(insets.top, 20) }]}>
          <Text style={styles.brandKicker}>Tapua'i</Text>
          <Text style={styles.brand}>Admin portal</Text>
          <Text style={styles.brandLede}>Catalog saves instantly. Tabs, colors, and Highlights layout wait on Publish to app.</Text>
          {publishCta}
          <ScrollView contentContainerStyle={styles.sideList} showsVerticalScrollIndicator={false}>
            {ADMIN_NAV_GROUPS.map((group) => (
              <View key={group.id} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {navFor(group.items)}
              </View>
            ))}
          </ScrollView>
          <AnimatedButton
            haptic="selection"
            accessibilityLabel="Open production app"
            contentStyle={styles.homeHit}
            onPress={() => router.push('/')}
          >
            <Text style={styles.homeLabel}>Open production app</Text>
          </AnimatedButton>
        </View>
      ) : (
        <View style={[styles.top, { paddingTop: Math.max(insets.top, 10) }]}>
          <View style={styles.mobileHead}>
            <Text style={styles.mobileTitle}>Admin portal</Text>
            <AnimatedButton
              haptic="selection"
              accessibilityLabel="Open production app"
              contentStyle={styles.homeHit}
              onPress={() => router.push('/')}
            >
              <Text style={styles.homeLabel}>Open production</Text>
            </AnimatedButton>
          </View>
          {publishCta}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {ADMIN_NAV_GROUPS.map((group) => {
              const on = group.id === groupId;
              return (
                <AnimatedButton
                  key={group.id}
                  haptic="selection"
                  accessibilityRole="tab"
                  accessibilityLabel={group.label}
                  accessibilityState={{ selected: on }}
                  contentStyle={[styles.groupChip, on && styles.groupChipOn]}
                  onPress={() => setGroupId(group.id)}
                >
                  <Text style={[styles.groupChipLabel, on && styles.groupChipLabelOn]}>{group.label}</Text>
                </AnimatedButton>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {navFor(mobileGroup.items)}
          </ScrollView>
        </View>
      )}
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
  rootWide: {
    flexDirection: 'row',
  },
  sidebar: {
    width: 248,
    backgroundColor: FOCAL.backgroundBase,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 8,
  },
  brandKicker: {
    color: FOCAL.neonJade,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  brand: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandLede: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 8,
  },
  group: {
    gap: 6,
    marginBottom: 10,
  },
  groupLabel: {
    color: FOCAL.electricGold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  sideList: {
    gap: 4,
    paddingVertical: 8,
  },
  sideItem: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    alignItems: 'flex-start',
  },
  sideItemOn: {
    backgroundColor: FOCAL.neonJade,
  },
  sideLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sideLabelOn: {
    color: FOCAL.backgroundBase,
  },
  sideHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sideHintOn: {
    color: '#083322',
  },
  homeHit: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  homeLabel: {
    color: FOCAL.neonJade,
    fontSize: 13,
    fontWeight: '800',
  },
  publishHit: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  publishLabel: {
    color: FOCAL.backgroundBase,
    fontSize: 13,
    fontWeight: '800',
  },
  top: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mobileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mobileTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  chips: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 12,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  chipLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  chipLabelOn: {
    color: FOCAL.backgroundBase,
  },
  groupChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupChipOn: {
    backgroundColor: FOCAL.electricGold,
  },
  groupChipLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  groupChipLabelOn: {
    color: FOCAL.backgroundBase,
  },
  stage: {
    flex: 1,
    minWidth: 0,
  },
});
