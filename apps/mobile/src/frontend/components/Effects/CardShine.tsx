import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type CardShineProps = {
  /** Streak tilt, degrees. */
  angle?: number;
  /** One full pass end-to-end-and-reset, ms. Most of this is the streak sitting off-screen — that gap reads as the "pause" between sweeps. */
  loopMs?: number;
  /** Bright core tint (a near-white highlight). */
  color?: string;
  /** Wider tinted glow around the core — pass the tier/brand color so the sweep has contrast on light card faces, not just on dark ones. */
  tint?: string;
  /** Core streak width in px before feathering. */
  width?: number;
};

/**
 * @purpose Reusable "foil card" light sweep — a soft diagonal streak that glides across
 * whatever it is absolutely positioned inside (parent needs `overflow: 'hidden'`).
 * Combines a bright white core with a wider tier-colored glow so it reads on both the
 * dark Highlights ⚡ chrome and the pale Daylight card faces. Gives flat / low-tier
 * surfaces (Aura card at Tier 1, Spotlight portraits) a premium, alive feel on first
 * run, without depending on Skia or a gradient library.
 * @sideEffects A single continuous Reanimated `withRepeat(withTiming(...))` loop — most
 * of the travel distance is off-screen, so the streak only crosses the visible box for a
 * fraction of each loop, reading as a periodic sweep rather than a constant scroll.
 * Measures its own box via `onLayout`. `pointerEvents="none"` throughout.
 */
export function CardShine({
  angle = 18,
  loopMs = 3400,
  color = 'rgba(255,255,255,0.95)',
  tint = 'rgba(255,255,255,0.5)',
  width = 46,
}: CardShineProps) {
  const [box, setBox] = useState({ width: 240, height: 160 });
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: loopMs, easing: Easing.linear }), -1, false);
  }, [loopMs, progress]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setBox((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  }, []);

  // Off-screen padding on each side makes the streak spend most of the loop hidden,
  // which reads as a pause between sweeps without any extra timing logic.
  const pad = Math.max(box.width * 2.2, 260);
  const groupWidth = width * 2.4;
  const travelStart = -groupWidth - pad;
  const travelEnd = box.width + pad;
  const groupStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [travelStart, travelEnd]) },
      { rotate: `${angle}deg` },
    ],
  }));

  const groupHeight = box.height * 1.8;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout}>
      <Animated.View
        style={[styles.group, { width: groupWidth, height: groupHeight, top: -box.height * 0.4 }, groupStyle]}
      >
        <View style={[styles.layer, { left: 0, width: groupWidth, backgroundColor: tint, opacity: 0.55 }]} />
        <View
          style={[
            styles.layer,
            { left: (groupWidth - width * 1.3) / 2, width: width * 1.3, backgroundColor: color, opacity: 0.65 },
          ]}
        />
        <View
          style={[
            styles.layer,
            { left: (groupWidth - width * 0.45) / 2, width: width * 0.45, backgroundColor: color, opacity: 0.95 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    position: 'absolute',
  },
  layer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
});

export default CardShine;
