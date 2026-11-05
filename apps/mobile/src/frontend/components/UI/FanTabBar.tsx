/** Floating fan dock overlays full-height Highlights while every label/control stays opaque.
 * Report the complete wrap height so captions and normal fan screens clear safe foot and enlarged labels.
 * 2026-11 Lovable standard: same floating shape and translucent backdrop; tabs read like the sample —
 * larger icons that fill when active, jade active ink, Figtree labels, no tinted box behind the active tab.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { colors } from '@/constants/theme';
import { HIGHLIGHT_NAV_LABEL, SPOTLIGHT_NAV_LABEL } from '@/data/highlights';
import { useUploadSheet } from '@/context/UploadSheetContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useFanDockSoftened, useFanNavigation, useMeasureFanDock } from '@/context/FanNavigationContext';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { impactPress } from '@/lib/haptics';
import { figtree } from '@/theme/fonts';
import { FOCAL, SPRING_BOUNCE, SPRING_SHEET, TAB_ACCENTS } from '@/theme/motion';

const TAB_META: Record<string, { label: string; accessibilityLabel?: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> =
  {
    index: { label: HIGHLIGHT_NAV_LABEL, icon: 'home-outline', activeIcon: 'home' },
    activity: { label: 'Activity', icon: 'notifications-outline', activeIcon: 'notifications' },
    spotlight: { label: SPOTLIGHT_NAV_LABEL, icon: 'trophy-outline', activeIcon: 'trophy' },
    profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
  };

type TabButtonProps = {
  focused: boolean;
  label: string;
  accessibilityLabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  onPress: () => void;
  onInteract: () => void;
};

/**
 * @purpose One fan-bar destination. Owns its own Reanimated values so the icon can pop
 * and the active mist background can fade in the moment `focused` flips true, instead of
 * snapping — a real React component (not an inline render function) so hooks stay legal
 * even though the route list length can change under runtime feature flags.
 * @sideEffects Reanimated `withSequence`/`withSpring` icon bounce + `withTiming` mist fade on focus change.
 */
function TabButton({ focused, label, accessibilityLabel, icon, activeIcon, accentColor, onPress, onInteract }: TabButtonProps) {
  const reduceMotion = useReduceMotion();
  const iconScale = useSharedValue(1);
  const color = focused ? accentColor : colors.textMuted;

  useEffect(() => {
    if (reduceMotion || !focused) {
      iconScale.value = 1;
    } else {
      iconScale.value = withSequence(withSpring(1.18, SPRING_BOUNCE), withSpring(1.08, SPRING_BOUNCE));
    }
  }, [focused, iconScale, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: focused }}
      style={[styles.tabHit, styles.tabInner]}
      onFocus={onInteract}
      onPressIn={onInteract}
      onPress={() => { impactPress('selection'); onPress(); }}
    >
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? activeIcon : icon} size={22} color={color} />
      </Animated.View>
      <Text style={[styles.tabLabel, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * @purpose Fan bar: Home / Activity / Upload / Spotlight / Profile over the screen, with each destination's sport accent. Upload stays jade; Beyond and Local open from the Highlights pill row and Drip from Profile.
 * @param state React Navigation tab state.
 * @param emitter Tab event emitter; a second tap on the focused tab lets that tab’s stack pop to its `index` (SDK 58).
 * @param navigateToTab Switches to an unfocused tab by route key.
 * @param insets Bottom safe-area for the bar padding.
 * @returns Custom tab bar with an in-slot Upload plus.
 * @sideEffects Opens `UploadSheetContext` on plus press; Reanimated spring on the indicator when focus changes.
 */
export function FanTabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const measureDock = useMeasureFanDock();
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const softened = useFanDockSoftened();
  const { restore } = useFanNavigation();
  const solid = reduceTransparency || (Platform.OS !== 'ios' && Platform.OS !== 'web');
  const backdropOpacity = solid ? 1 : softened ? 0.46 : 0.94;
  const { openUpload } = useUploadSheet();
  const { live } = useAppRuntime();
  const slots = useRef<Record<string, { x: number; width: number }>>({});
  const placed = useRef(false);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const indicatorOp = useSharedValue(0);
  const focusedKey = state.routes[state.index]?.key ?? '';
  // Lovable standard: one jade active colour on every tab (per-tab accents retired from the bar).
  const barAccent = TAB_ACCENTS.index;
  useEffect(() => { restore(); }, [focusedKey, restore]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? backdropOpacity : withTiming(backdropOpacity, { duration: 160 }) }), [backdropOpacity, reduceMotion]);

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
      indicatorOp.value = 0;
      return;
    }
    const width = Math.max(24, box.width * 0.5);
    const x = box.x + (box.width - width) / 2;
    if (reduceMotion || !animate || !placed.current) {
      indicatorX.value = x;
      indicatorW.value = width;
      indicatorOp.value = 1;
      placed.current = true;
      return;
    }
    indicatorX.value = withSpring(x, SPRING_SHEET);
    indicatorW.value = withSpring(width, SPRING_SHEET);
    indicatorOp.value = 1;
  };

  useEffect(() => {
    placeIndicator(focusedKey, true);
    // `slots` is a ref filled by onLayout; focus and the visible route set are the reactive inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedKey, routes.length, reduceMotion]);

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
          accentColor={TAB_ACCENTS.index.color}
          onInteract={restore}
          onPress={() => {
            restore();
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
    <View testID="fan-dock-wrap" pointerEvents="box-none" onLayout={({ nativeEvent }) => measureDock(nativeEvent.layout.height)} style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.bar}>
        {/* Web uses the current React value: installed Reanimated web timing can retain the initial shared opacity. */}
        <Animated.View testID="fan-dock-backdrop" pointerEvents="none" style={[styles.backdrop, backdropStyle, Platform.OS === 'web' && { opacity: backdropOpacity }]}>
          {!solid ? <BlurView tint="light" intensity={32} style={StyleSheet.absoluteFill} /> : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: live.theme.surface, opacity: solid ? 1 : 0.82 }]} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: barAccent.color, shadowColor: barAccent.glow },
            indicatorStyle,
          ]}
        />
        {left.map((route) => renderTab(route))}
        {live.tabs.upload ? (
        <View style={styles.fabSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload"
            style={[styles.tabHit, styles.tabInner]}
            onFocus={restore}
            onPressIn={restore}
            onPress={() => { restore(); impactPress('medium'); openUpload(); }}
          >
            <View style={styles.fab}><Ionicons name="add" size={20} color="#FFFFFF" /></View>
            <Text style={[styles.tabLabel, { color: FOCAL.jadeInk }]}>Upload</Text>
          </Pressable>
        </View>
        ) : null}
        {right.map((route) => renderTab(route))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // SDK58 renders custom bars directly: screenOptions.tabBarStyle does not position this wrapper.
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    width: '100%',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 56,
    paddingHorizontal: 2,
    borderRadius: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabSlot: {
    flex: 1,
    minWidth: 0,
  },
  tabHit: {
    flex: 1,
    minWidth: 0,
    opacity: 1,
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
    // Opaque control faces retain text contrast when the softened backdrop sits over dark artwork.
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 24,
    marginHorizontal: 2,
    marginVertical: 2,
    overflow: 'visible',
  },
  tabLabel: {
    ...figtree('600'),
    fontSize: 11,
    letterSpacing: -0.1,
    textAlign: 'center',
    flexShrink: 1,
    maxWidth: '100%',
  },
  fabSlot: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  fab: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
