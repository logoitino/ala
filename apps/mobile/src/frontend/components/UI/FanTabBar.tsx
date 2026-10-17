/** Four fan destinations around the Upload slot. Beyond moved to the Highlights pill row (owner 2026-10-16). */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { HIGHLIGHT_NAV_LABEL, SPOTLIGHT_NAV_LABEL } from '@/data/highlights';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { FOCAL, SPRING_BOUNCE, SPRING_SHEET, TAB_ACCENTS } from '@/theme/motion';

const TAB_META: Record<string, { label: string; accessibilityLabel?: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> =
  {
    index: { label: HIGHLIGHT_NAV_LABEL, icon: 'home-outline', activeIcon: 'home' },
    activity: { label: 'Activity', icon: 'notifications-outline', activeIcon: 'notifications' },
    spotlight: { label: SPOTLIGHT_NAV_LABEL, icon: 'trophy-outline', activeIcon: 'trophy' },
    profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  };

/** Calm Island: one brand accent for the active tab, indicator and Upload on every destination. */
const BAR_ACCENT = TAB_ACCENTS.index;

type TabButtonProps = {
  focused: boolean;
  label: string;
  accessibilityLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  accentMist: string;
  onPress: () => void;
};

/**
 * @purpose One fan-bar destination. Owns its own Reanimated values so the icon can pop
 * and the active mist background can fade in the moment `focused` flips true, instead of
 * snapping — a real React component (not an inline render function) so hooks stay legal
 * even though the route list length can change under runtime feature flags.
 * @sideEffects Reanimated `withSequence`/`withSpring` icon bounce + `withTiming` mist fade on focus change.
 */
function TabButton({ focused, label, accessibilityLabel, icon, activeIcon, accentColor, accentMist, onPress }: TabButtonProps) {
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
      accessibilityLabel={accessibilityLabel ?? label}
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
      <View style={styles.tabDotSpacer} />
    </AnimatedButton>
  );
}

/**
 * @purpose Fan bar: Highlights / Activity / Upload / Spotlight / Profile. Upload sits in the middle; Beyond and Local open from the Highlights pill row and Drip from Profile. A jade accent bar springs along the top edge to whichever tab is focused; every destination shares the one brand accent.
 * @param state React Navigation tab state.
 * @param emitter Tab event emitter; a second tap on the focused tab lets that tab’s stack pop to its `index` (SDK 58).
 * @param navigateToTab Switches to an unfocused tab by route key.
 * @param insets Bottom safe-area for the bar padding.
 * @returns Custom tab bar with an in-slot Upload plus.
 * @sideEffects Opens `UploadSheetContext` on plus press; Reanimated spring on the indicator when focus changes.
 */
export function FanTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { openUpload } = useUploadSheet();
  const { live } = useAppRuntime();
  const slots = useRef<Record<string, { x: number; width: number }>>({});
  const placed = useRef(false);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const indicatorOp = useSharedValue(0);
  const focusedKey = state.routes[state.index]?.key ?? '';

  const routes = state.routes.filter((route) => {
    if (!TAB_META[route.name] || (route.name === 'shop' || route.name === 'drip')) return false;
    if (route.name === 'index') return live.tabs.home;
    if (route.name === 'activity') return live.tabs.activity;
    if (route.name === 'spotlight') return live.tabs.spotlight;
    if (route.name === 'profile') return live.tabs.profile;
    return true;
  });
  const visibleKeys = new Set(routes.map((route) => route.key));

  const placeIndicator = (key: string, animate: boolean) => {
    const box = slots.current[key];
    if (!box || box.width <= 0 || !visibleKeys.has(key)) {
      indicatorOp.value = withTiming(0, { duration: 120 });
      return;
    }
    const width = Math.max(24, box.width * 0.5);
    const x = box.x + (box.width - width) / 2;
    if (!animate || !placed.current) {
      indicatorX.value = x;
      indicatorW.value = width;
      indicatorOp.value = 1;
      placed.current = true;
      return;
    }
    indicatorX.value = withSpring(x, SPRING_SHEET);
    indicatorW.value = withSpring(width, SPRING_SHEET);
    indicatorOp.value = withTiming(1, { duration: 180 });
  };

  useEffect(() => {
    placeIndicator(focusedKey, true);
    // `slots` is a ref filled by onLayout; focus and the visible route set are the reactive inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedKey, routes.length]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOp.value,
    width: indicatorW.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  const onSlotLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    slots.current[key] = { x, width };
    if (key === focusedKey) placeIndicator(key, placed.current);
  };
  const leftCount = Math.min(2, routes.length);
  const left = routes.slice(0, leftCount);
  const right = routes.slice(leftCount);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.findIndex((item) => item.key === route.key);
    const focused = state.index === index;
    const meta = TAB_META[route.name] ?? { label: route.name, icon: 'ellipse-outline' as const, activeIcon: 'ellipse' as const };

    return (
      <View key={route.key} style={styles.tabSlot} onLayout={onSlotLayout(route.key)}>
        <TabButton
          focused={focused}
          label={meta.label}
          accessibilityLabel={meta.accessibilityLabel}
          icon={meta.icon}
          activeIcon={meta.activeIcon}
          accentColor={BAR_ACCENT.color}
          accentMist={BAR_ACCENT.mist}
          onPress={() => {
            // SDK 58: the nested stack hears this tabPress and pops to `index` when the tab is already focused.
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          }}
        />
      </View>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6), backgroundColor: live.theme.surface }]}>
      <View style={styles.bar}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: BAR_ACCENT.color, shadowColor: BAR_ACCENT.glow },
            indicatorStyle,
          ]}
        />
        {left.map((route) => renderTab(route))}
        {live.tabs.upload ? (
        <View style={styles.fabSlot}>
          <AnimatedButton
            haptic="medium"
            scaleTo={0.92}
            accessibilityLabel="Upload"
            contentStyle={styles.fab}
            onPress={openUpload}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
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
    backgroundColor: colors.surface,
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
  tabSlot: {
    flex: 1,
    minWidth: 0,
  },
  tabHit: {
    flex: 1,
    minWidth: 0,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 3,
    borderRadius: 2,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.9,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: {},
    }),
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
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.jadeInk,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: `0px 4px 10px ${FOCAL.jadeInk}4D`,
      },
    }),
  },
});
