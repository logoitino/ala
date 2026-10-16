import { useEffect } from 'react';
import { StyleSheet,  View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { PlayReactionId } from '@/data/players';
import { HYPE_FX } from '@/theme/hypeFx';
import { SPRING_BOUNCE } from '@/theme/motion';

// Ten sparks on a rough ring so the pop reads as a burst rather than a few stray emoji.
const SPARKS = [
  { dx: -46, dy: -54, delay: 0 },
  { dx: 42, dy: -58, delay: 30 },
  { dx: -56, dy: 6, delay: 60 },
  { dx: 52, dy: 12, delay: 80 },
  { dx: 6, dy: -72, delay: 15 },
  { dx: -12, dy: 48, delay: 100 },
  { dx: -70, dy: -24, delay: 45 },
  { dx: 66, dy: -20, delay: 55 },
  { dx: 30, dy: 46, delay: 120 },
  { dx: -34, dy: 40, delay: 130 },
] as const;

type HypeBurstProps = {
  kind: PlayReactionId;
  /** Serve Like Me double-tap — bigger ring and ⚡2×. */
  boosted?: boolean;
  /** Multiplies the whole burst. The chip rail passes >1 so the pop clears the 48pt button. */
  scale?: number;
  onDone: () => void;
};

/**
 * @purpose Fun particle pop for Seki 🤙 / Aura ⚡ / Flex 💪 — flying emoji, a shout label, and a
 * double shockwave ring. Sized to read clearly over full-screen video.
 * @param kind Which Highlights hype kind was tapped or double-tapped.
 * @param boosted Serve Like Me 2× Aura burst.
 * @param scale Overall multiplier; the chip rail uses 1.35 so the burst escapes the button.
 * @returns Overlay centered in its parent; parent must be `pointerEvents="none"`.
 * @sideEffects Reanimated springs/timings only. Parent removes the node via `onDone` (~860ms).
 * Reduced Motion collapses this to a single quick fade so the tap still confirms itself.
 */
export function HypeBurst({ kind, boosted = false, scale = 1, onDone }: HypeBurstProps) {
  const fx = HYPE_FX[kind];
  const reduceMotion = useReducedMotion();
  const ring = useSharedValue(0.4);
  const ringOp = useSharedValue(0.95);
  const wave = useSharedValue(0.3);
  const waveOp = useSharedValue(0.7);
  const shout = useSharedValue(0.35);
  const shoutOp = useSharedValue(1);

  useEffect(() => {
    const life = reduceMotion ? 420 : boosted ? 960 : 860;

    if (reduceMotion) {
      ringOp.value = withTiming(0, { duration: 360 });
      waveOp.value = 0;
      shout.value = 1;
      shoutOp.value = withDelay(140, withTiming(0, { duration: 260 }));
    } else {
      ring.value = withSpring(boosted ? 2.1 : 1.7, SPRING_BOUNCE);
      ringOp.value = withTiming(0, { duration: 700 });
      // Second, slower ripple chasing the first — this is what makes the hit land.
      wave.value = withDelay(90, withSpring(boosted ? 2.9 : 2.35, SPRING_BOUNCE));
      waveOp.value = withDelay(90, withTiming(0, { duration: 720 }));
      shout.value = withSequence(withSpring(1.3, SPRING_BOUNCE), withTiming(1.08, { duration: 200 }));
      shoutOp.value = withDelay(360, withTiming(0, { duration: 400 }));
    }

    const timer = setTimeout(onDone, life);
    return () => clearTimeout(timer);
    // Mount-only; `onDone` unmounts this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOp.value,
    transform: [{ scale: ring.value }],
    borderColor: fx.color,
    shadowColor: fx.color,
  }));

  const waveStyle = useAnimatedStyle(() => ({
    opacity: waveOp.value,
    transform: [{ scale: wave.value }],
    borderColor: fx.glow,
  }));

  const shoutStyle = useAnimatedStyle(() => ({
    opacity: shoutOp.value,
    transform: [{ scale: shout.value }, { translateY: (1 - shout.value) * -16 }],
  }));

  const sizeScale = scale * (boosted ? 1.15 : 1);

  return (
    <View pointerEvents="none" style={[styles.box, { transform: [{ scale: sizeScale }] }]}>
      <Animated.View style={[styles.wave, waveStyle]} />
      <Animated.View style={[styles.ring, boosted && styles.ringBoost, ringStyle]} />
      {!reduceMotion
        ? SPARKS.map((spark, index) => (
            <HypeSpark
              key={index}
              dx={spark.dx * (boosted ? 1.2 : 1)}
              dy={spark.dy * (boosted ? 1.15 : 1)}
              delay={spark.delay}
              emoji={fx.emojis[index % fx.emojis.length]}
              color={fx.color}
            />
          ))
        : null}
      <Animated.Text style={[styles.shout, { color: fx.color }, shoutStyle]}>
        {boosted && kind === 'aura' ? '⚡2×' : fx.shout}
      </Animated.Text>
    </View>
  );
}

function HypeSpark({
  dx,
  dy,
  delay,
  emoji,
  color,
}: {
  dx: number;
  dy: number;
  delay: number;
  emoji: string;
  color: string;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const op = useSharedValue(0);
  const scale = useSharedValue(0.3);
  const spin = useSharedValue(0);

  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 70 }));
    x.value = withDelay(delay, withSpring(dx, SPRING_BOUNCE));
    y.value = withDelay(delay, withTiming(dy, { duration: 620 }));
    spin.value = withDelay(delay, withTiming(dx > 0 ? 26 : -26, { duration: 620 }));
    scale.value = withDelay(
      delay,
      withSequence(withSpring(1.5, SPRING_BOUNCE), withTiming(0.6, { duration: 300 })),
    );
    op.value = withDelay(delay + 470, withTiming(0, { duration: 240 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
      { rotate: `${spin.value}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.spark, { textShadowColor: color }, style]}>{emoji}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 22,
    elevation: 10,
  },
  ringBoost: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  wave: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
  },
  shout: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
  },
  spark: {
    position: 'absolute',
    fontSize: 24,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
