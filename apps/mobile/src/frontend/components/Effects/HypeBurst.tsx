import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { PlayReactionId } from '@/data/players';
import { HYPE_FX } from '@/theme/hypeFx';
import { SPRING_BOUNCE } from '@/theme/motion';

const SPARKS = [
  { dx: -34, dy: -42, delay: 0 },
  { dx: 30, dy: -46, delay: 40 },
  { dx: -40, dy: 8, delay: 70 },
  { dx: 38, dy: 12, delay: 90 },
  { dx: 4, dy: -56, delay: 20 },
  { dx: -8, dy: 36, delay: 110 },
] as const;

type HypeBurstProps = {
  kind: PlayReactionId;
  /** Serve Like Me double-tap — bigger ring and ⚡2×. */
  boosted?: boolean;
  onDone: () => void;
};

/**
 * @purpose Fun particle pop for Seki 🤙 / Aura ⚡ / Flex 💪 — flying emoji, shout label, and a colored ring.
 * @param kind Which Highlights hype kind was tapped or double-tapped.
 * @param boosted Serve Like Me 2× Aura burst.
 * @returns Overlay centered in its parent; parent must be `pointerEvents="none"`.
 * @sideEffects Reanimated springs/timings only. Parent removes the node via `onDone` (~720ms).
 */
export function HypeBurst({ kind, boosted = false, onDone }: HypeBurstProps) {
  const fx = HYPE_FX[kind];
  const ring = useSharedValue(0.45);
  const ringOp = useSharedValue(0.9);
  const shout = useSharedValue(0.4);
  const shoutOp = useSharedValue(1);

  useEffect(() => {
    ring.value = withSpring(boosted ? 1.7 : 1.35, SPRING_BOUNCE);
    ringOp.value = withTiming(0, { duration: 640 });
    shout.value = withSequence(withSpring(1.18, SPRING_BOUNCE), withTiming(1, { duration: 180 }));
    shoutOp.value = withDelay(280, withTiming(0, { duration: 360 }));
    const timer = setTimeout(onDone, boosted ? 820 : 720);
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

  const shoutStyle = useAnimatedStyle(() => ({
    opacity: shoutOp.value,
    transform: [{ scale: shout.value }, { translateY: (1 - shout.value) * -12 }],
  }));

  return (
    <View pointerEvents="none" style={styles.box}>
      <Animated.View style={[styles.ring, boosted && styles.ringBoost, ringStyle]} />
      {SPARKS.map((spark, index) => (
        <HypeSpark
          key={index}
          dx={spark.dx * (boosted ? 1.25 : 1)}
          dy={spark.dy * (boosted ? 1.2 : 1)}
          delay={spark.delay}
          emoji={fx.emojis[index % fx.emojis.length]}
          color={fx.color}
        />
      ))}
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
  const scale = useSharedValue(0.35);

  useEffect(() => {
    op.value = withDelay(delay, withTiming(1, { duration: 70 }));
    x.value = withDelay(delay, withSpring(dx, SPRING_BOUNCE));
    y.value = withDelay(delay, withTiming(dy, { duration: 540 }));
    scale.value = withDelay(
      delay,
      withSequence(withSpring(1.28, SPRING_BOUNCE), withTiming(0.55, { duration: 260 })),
    );
    op.value = withDelay(delay + 400, withTiming(0, { duration: 200 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
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
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 16,
    elevation: 8,
  },
  ringBoost: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  shout: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    textShadowColor: 'rgba(0,0,0,0.55)',
  },
  spark: {
    position: 'absolute',
    fontSize: 18,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
