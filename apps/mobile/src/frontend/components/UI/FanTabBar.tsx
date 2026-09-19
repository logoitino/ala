import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { SPRING_BOUNCE } from '@/theme/motion';
import { HIGHLIGHT_NAV_LABEL, SPOTLIGHT_NAV_LABEL } from '@/data/highlights';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { FOCAL, TAB_ACCENTS, type FanTabAccentId } from '@/theme/motion';

const TAB_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> =
  {
    index: { label: HIGHLIGHT_NAV_LABEL, icon: 'home-outline', activeIcon: 'home' },
    local: { label: 'Local', icon: 'location-outline', activeIcon: 'location' },
    spotlight: { label: SPOTLIGHT_NAV_LABEL, icon: 'trophy-outline', activeIcon: 'trophy' },
    shop: { label: 'Drip', icon: 'shirt-outline', activeIcon: 'shirt' },
    drip: { label: 'Drip', icon: 'shirt-outline', activeIcon: 'shirt' },
    profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  };

function accentForRoute(name: string) {
  const key = (name === 'shop' ? 'drip' : name) as FanTabAccentId;
  return TAB_ACCENTS[key] ?? TAB_ACCENTS.index;
}

type TabButtonProps = {
  focused: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  accentMist: string;
  accentGlow: string;
  onPress: () => void;
};

/**
 * @purpose One fan-bar destination. Owns its own Reanimated values so the icon can pop
 * and the active mist background can fade in the moment `focused` flips true, instead of
 * snapping — a real React component (not an inline render function) so hooks stay legal
 * even though the route list length can change under runtime feature flags.
 * @sideEffects Reanimated `withSequence`/`withSpring` icon bounce + `withTiming` mist fade on focus change.
 */
function TabButton({ focused, label, icon, activeIcon, accentColor, accentMist, accentGlow, onPress }: TabButtonProps) {
  const iconScale = useSharedValue(1);
  const mist = useSharedValue(focused ? 1 : 0);
  const color = focused ? accentColor : colors.textMuted;

  useEffect(() => {
    mist.value = withTiming(focused ? 1 : 0, { duration: 180 });
    if (focused) {
      iconScale.value = withSequence(withSpring(1.22, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE));
    }
  }, [focused, iconScale, mist]);

  const mistStyle = useAnimatedStyle(() => ({ opacity: mist.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <AnimatedButton
      haptic="selection"
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={styles.tabHit}
      contentStyle={styles.tabInner}
      onPress={onPress}
    >
      <Animated.View pointerEvents="none" style={[styles.tabMist, { backgroundColor: accentMist }, mistStyle]} />
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? activeIcon : icon} size={20} color={color} />
      </Animated.View>
      <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {focused ? <View style={[styles.tabDot, { backgroundColor: accentGlow }]} /> : <View style={styles.tabDotSpacer} />}
    </AnimatedButton>
  );
}

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
    const accent = accentForRoute(route.name);

    return (
      <TabButton
        key={route.key}
        focused={focused}
        label={meta.label}
        icon={meta.icon}
        activeIcon={meta.activeIcon}
        accentColor={accent.color}
        accentMist={accent.mist}
        accentGlow={accent.glow}
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
      />
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
            contentStyle={[styles.fab, { backgroundColor: FOCAL.neonJade, shadowColor: FOCAL.neonJade }]}
            onPress={openUpload}
          >
            <Ionicons name="add" size={24} color={FOCAL.ink} />
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
    minHeight: 58,
    paddingHorizontal: 4,
    paddingTop: 4,
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
    paddingHorizontal: 2,
    borderRadius: radii.md,
    marginHorizontal: 2,
    marginVertical: 2,
    overflow: 'hidden',
  },
  tabMist: {
    ...StyleSheet.absoluteFill,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 1,
  },
  tabDotSpacer: {
    width: 5,
    height: 5,
    marginTop: 1,
  },
  fabSlot: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.neonJade,
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: `0px 4px 10px ${FOCAL.neonJade}66`,
      },
    }),
  },
});
