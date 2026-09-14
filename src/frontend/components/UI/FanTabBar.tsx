import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors } from '@/constants/theme';
import { HIGHLIGHT_NAV_LABEL, SPOTLIGHT_NAV_LABEL } from '@/data/highlights';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';

const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> =
  {
    index: { label: HIGHLIGHT_NAV_LABEL, icon: 'home-outline', activeIcon: 'home' },
    local: { label: 'Local', icon: 'location-outline', activeIcon: 'location' },
    spotlight: { label: SPOTLIGHT_NAV_LABEL, icon: 'trophy-outline', activeIcon: 'trophy' },
    shop: { label: 'Drip', icon: 'shirt-outline', activeIcon: 'shirt' },
    drip: { label: 'Drip', icon: 'shirt-outline', activeIcon: 'shirt' },
    profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  };

/**
 * @purpose Fan bar: Home / Local / Upload / Spotlight / Drip / Profile. Upload lives in its own slot between Local and Spotlight so the plus never covers a tab.
 * @param state React Navigation tab state.
 * @param navigation Tab navigator; a second tap on the focused tab pops to that tab’s `index`.
 * @param insets Bottom safe-area for the bar padding.
 * @returns Custom tab bar with an in-slot Upload plus.
 * @sideEffects Opens `UploadSheetContext` on plus press.
 */
export function FanTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { openUpload } = useUploadSheet();
  const { live } = useAppRuntime();
  const routes = state.routes.filter((route) => {
    if (!TAB_META[route.name] || route.name === 'shop') return false;
    if (route.name === 'index') return live.tabs.home;
    if (route.name === 'local') return live.tabs.local;
    if (route.name === 'spotlight') return live.tabs.spotlight;
    if (route.name === 'drip') return live.tabs.drip;
    if (route.name === 'profile') return live.tabs.profile;
    return true;
  });
  const leftCount = Math.min(2, routes.length);
  const left = routes.slice(0, leftCount);
  const right = routes.slice(leftCount);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.findIndex((item) => item.key === route.key);
    const focused = state.index === index;
    const meta = TAB_META[route.name] ?? { label: route.name, icon: 'ellipse-outline' as const, activeIcon: 'ellipse' as const };
    const color = focused ? live.theme.jade : colors.textMuted;

    return (
      <AnimatedButton
        key={route.key}
        haptic="selection"
        accessibilityRole="tab"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        style={styles.tabHit}
        contentStyle={styles.tabInner}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (event.defaultPrevented) return;
          if (focused) {
            navigation.navigate(route.name, { screen: 'index' });
            return;
          }
          navigation.navigate(route.name);
        }}
      >
        <Ionicons name={focused ? meta.activeIcon : meta.icon} size={20} color={color} />
        <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
          {meta.label}
        </Text>
      </AnimatedButton>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6), backgroundColor: live.theme.background }]}>
      <View style={styles.bar}>
        {left.map((route) => renderTab(route))}
        {live.tabs.upload ? (
        <View style={styles.fabSlot}>
          <AnimatedButton
            haptic="medium"
            scaleTo={0.92}
            accessibilityLabel="Upload Highlight"
            contentStyle={[styles.fab, { backgroundColor: live.theme.jade, shadowColor: live.theme.jade }]}
            onPress={openUpload}
          >
            <Ionicons name="add" size={22} color={live.theme.background} />
          </AnimatedButton>
        </View>
        ) : null}
        {right.map((route) => renderTab(route))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
    minHeight: 56,
    paddingHorizontal: 2,
  },
  tabHit: {
    flex: 1,
    minWidth: 0,
  },
  tabInner: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 6,
    paddingHorizontal: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  fabSlot: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#00E676',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: '0px 4px 10px rgba(0, 230, 118, 0.4)',
      },
    }),
  },
});
