/** Shared fan scroll reveals retain UI-thread effects and the existing400ms usage telemetry cadence.
 * Bounded80ms dock direction samples change only local backdrop presentation.
 */
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
  type ScrollViewInstance,
  type ViewInstance,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { SCROLL_FX, SPRING_CARD } from '@/theme/motion';
import { useFanNavigation } from '@/context/FanNavigationContext';
import { useFocusEffect } from 'expo-router';

type ScrollFxValue = {
  scrollY: SharedValue<number>;
  viewportH: SharedValue<number>;
  frameTop: SharedValue<number>;
};

const ScrollFxContext = createContext<ScrollFxValue | null>(null);

const JS_SCROLL_THROTTLE_MS = 400;

type ScrollFxScrollViewProps = Omit<ScrollViewProps, 'onScroll'> & {
  children?: ReactNode;
  /** JS-thread listener (e.g. `useSurfaceUsage().onScroll`). Throttled to ~400ms like the old `scrollEventThrottle`. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/**
 * @purpose Drop-in `ScrollView` for the light fan tabs (Local / Spotlight / Drip / Profile) that shares its
 * scroll offset with `ScrollFxItem` reveal cards and `ScrollFxParallax` headers on the UI thread.
 * @param onScroll Optional JS listener, forwarded at most every 400ms so usage telemetry keeps working.
 * @returns Reanimated `ScrollView` inside a measuring frame; all other `ScrollView` props pass through.
 * @sideEffects `measureInWindow` on layout so child items can convert window coords to content offsets.
 */
export const ScrollFxScrollView = forwardRef<ScrollViewInstance, ScrollFxScrollViewProps>(function ScrollFxScrollView(
  { children, onScroll, scrollEventThrottle: _throttle, ...rest },
  ref,
) {
  const scrollY = useSharedValue(0);
  const viewportH = useSharedValue(0);
  const frameTop = useSharedValue(0);
  const lastJs = useSharedValue(0);
  const lastDock = useSharedValue(0);
  const { sample } = useFanNavigation();
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));
  // Queued UI-thread callbacks can arrive after an inactive mounted route has lost focus.
  const sampleNavigation = useCallback((y: number) => { if (focused.current) sample(y); }, [sample]);
  const frameRef = useRef<ViewInstance>(null);
  const jsListener = useRef(onScroll);
  jsListener.current = onScroll;

  const forward = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    jsListener.current?.(event);
  }, []);

  const handler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      viewportH.value = event.layoutMeasurement.height;
      const now = Date.now();
      if (now - lastDock.value >= 80) {
        lastDock.value = now;
        runOnJS(sampleNavigation)(event.contentOffset.y);
      }
      if (now - lastJs.value < JS_SCROLL_THROTTLE_MS) return;
      lastJs.value = now;
      runOnJS(forward)({
        nativeEvent: {
          contentOffset: event.contentOffset,
          contentSize: event.contentSize,
          layoutMeasurement: event.layoutMeasurement,
        },
      } as NativeSyntheticEvent<NativeScrollEvent>);
    },
  });

  const onFrameLayout = (event: LayoutChangeEvent) => {
    viewportH.value = event.nativeEvent.layout.height;
    frameRef.current?.measureInWindow((_x, y) => {
      frameTop.value = y;
    });
  };

  const value = useRef<ScrollFxValue>({ scrollY, viewportH, frameTop }).current;

  return (
    <ScrollFxContext.Provider value={value}>
      <View ref={frameRef} style={styles.frame} onLayout={onFrameLayout} collapsable={false}>
        <Animated.ScrollView ref={ref} onScroll={handler} scrollEventThrottle={16} {...rest}>
          {children}
        </Animated.ScrollView>
      </View>
    </ScrollFxContext.Provider>
  );
});

export type ScrollFxVariant = 'rise' | 'tilt' | 'slide-left' | 'slide-right' | 'zoom';

type ScrollFxItemProps = {
  children: ReactNode;
  /** Position in its list for the mount stagger; alternate `slide-left` / `slide-right` for a zig-zag feel. */
  index?: number;
  variant?: ScrollFxVariant;
  /** When false the item keeps full opacity as it leaves the top of the viewport. */
  exitFade?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * @purpose Fun scroll reveal for one card: rises / tilts / slides into place as it enters from the bottom,
 * staggers on first mount, and gently shrinks + dims as it leaves the top. No-op outside `ScrollFxScrollView`
 * or when the OS asks for reduced motion.
 * @param variant `rise` (default), `tilt` (3D rotateX), `slide-left`, `slide-right`, `zoom`.
 * @param index Stagger slot (capped at `SCROLL_FX.maxStagger`).
 * @returns The child wrapped in a Reanimated view.
 * @sideEffects `measureInWindow` on layout to find the item's content offset.
 */
export function ScrollFxItem({ children, index = 0, variant = 'rise', exitFade = true, style }: ScrollFxItemProps) {
  const fx = useContext(ScrollFxContext);
  const reduceMotion = useReducedMotion();
  const ref = useRef<ViewInstance>(null);
  const top = useSharedValue(-1);
  const height = useSharedValue(0);
  const enter = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    const slot = Math.min(Math.max(0, index), SCROLL_FX.maxStagger);
    enter.value = withDelay(slot * SCROLL_FX.staggerMs, withSpring(1, SPRING_CARD));
  }, [enter, index, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    height.value = event.nativeEvent.layout.height;
    if (!fx) return;
    ref.current?.measureInWindow((_x, y) => {
      top.value = y - fx.frameTop.value + fx.scrollY.value;
    });
  };

  const animated = useAnimatedStyle(() => {
    if (!fx) return {};
    const viewport = fx.viewportH.value;
    const measured = top.value >= 0 && viewport > 0;
    const reveal = measured
      ? interpolate(fx.scrollY.value + viewport - top.value, [0, SCROLL_FX.revealDistance], [0, 1], Extrapolation.CLAMP)
      : 1;
    const exit =
      measured && exitFade
        ? interpolate(fx.scrollY.value - top.value, [0, Math.max(height.value, 1)], [0, 1], Extrapolation.CLAMP)
        : 0;
    const p = Math.min(reveal, enter.value);
    const inv = 1 - p;
    const opacity = p * (1 - SCROLL_FX.exitFade * exit);
    const exitScale = 1 - SCROLL_FX.exitScale * exit;

    switch (variant) {
      case 'tilt':
        return {
          opacity,
          transform: [
            { perspective: 800 },
            { translateY: inv * SCROLL_FX.riseY * 0.8 },
            { rotateX: `${inv * SCROLL_FX.tiltDeg}deg` },
            { scale: (0.97 + 0.03 * p) * exitScale },
          ],
        };
      case 'slide-left':
      case 'slide-right': {
        const dir = variant === 'slide-left' ? -1 : 1;
        return {
          opacity,
          transform: [
            { translateX: dir * inv * SCROLL_FX.slideX },
            { rotateZ: `${dir * inv * 2}deg` },
            { scale: (0.97 + 0.03 * p) * exitScale },
          ],
        };
      }
      case 'zoom':
        return {
          opacity,
          transform: [{ scale: (0.9 + 0.1 * p) * exitScale }],
        };
      case 'rise':
      default:
        return {
          opacity,
          transform: [{ translateY: inv * SCROLL_FX.riseY }, { scale: (0.96 + 0.04 * p) * exitScale }],
        };
    }
  });

  if (!fx || reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View ref={ref} onLayout={onLayout} style={[style, animated]} collapsable={false}>
      {children}
    </Animated.View>
  );
}

type ScrollFxParallaxProps = {
  children: ReactNode;
  /** 0 = pinned to content, 1 = pinned to the viewport. Default 0.4 makes the header drift slower than the list. */
  factor?: number;
  /** Fade the header out over this many px of scroll. 0 disables. */
  fadeOver?: number;
  /** Pull-to-stretch on iOS overscroll. */
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * @purpose Header parallax for `ScreenHeading` and hero blocks: drifts at `factor` of scroll speed, fades over
 * `fadeOver` px, and stretches from the top when the fan pulls past zero.
 * @returns Reanimated wrapper; plain `View` when reduced motion is on or no `ScrollFxScrollView` is above.
 */
export function ScrollFxParallax({ children, factor = 0.4, fadeOver = 160, stretch = true, style }: ScrollFxParallaxProps) {
  const fx = useContext(ScrollFxContext);
  const reduceMotion = useReducedMotion();

  const animated = useAnimatedStyle(() => {
    if (!fx) return {};
    const y = fx.scrollY.value;
    const pulled = stretch && y < 0 ? -y : 0;
    const opacity = fadeOver > 0 ? interpolate(y, [0, fadeOver], [1, 0], Extrapolation.CLAMP) : 1;
    return {
      opacity,
      transform: [
        { translateY: y > 0 ? y * factor : y * 0.5 },
        { scale: 1 + Math.min(pulled, 160) / 900 },
      ],
    };
  });

  if (!fx || reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[style, styles.parallax, animated]}>{children}</Animated.View>;
}

const styles = {
  frame: { flex: 1 } as ViewStyle,
  parallax: { transformOrigin: 'top center' } as ViewStyle,
};
