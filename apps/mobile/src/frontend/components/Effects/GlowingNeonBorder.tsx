import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurMask, Canvas, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GLOW_BASE_STROKE, GLOW_BLUR, GLOW_INSET, GLOW_PULSE_STROKE, GLOW_SPIN_MS } from '@/components/Effects/glowTokens';
import { FOCAL } from '@/theme/motion';

const SWEEP = [FOCAL.neonJade, FOCAL.electricGold, FOCAL.electricViolet, FOCAL.neonJade] as const;
const TWO_PI = Math.PI * 2;

export type GlowingNeonBorderProps = {
  width: number;
  height: number;
  borderRadius: number;
  isAuraMaxed: boolean;
  /** Same pulse as `isAuraMaxed` — Locker Room gear fully funded / equipped. */
  wishlistFulfilled?: boolean;
  children?: ReactNode;
};

/**
 * @purpose Skia sweep-gradient stroke that orbits Neon Jade → Cyber Gold → Electric Violet around a rounded card, with a solid BlurMask aura. Celestial Prism or a fulfilled wishlist pulses the stroke.
 * @param width Canvas width in px.
 * @param height Canvas height in px.
 * @param borderRadius Outer rounded-rect radius.
 * @param isAuraMaxed True at Aura tier 7 (Celestial Prism) — starts the thickness pulse.
 * @param wishlistFulfilled True when a Locker Room item is fully funded; same pulse as max Aura.
 * @param children Optional card (or any face) drawn under the overlay stroke.
 * @returns Sized wrap with a pointer-events-none `Canvas` stroke over children.
 * @sideEffects Reanimated `withRepeat` / `withTiming` (3s linear 0→2π) plus `withSequence` stroke pulse. Skia GPU canvas.
 */
export function GlowingNeonBorder({
  width,
  height,
  borderRadius,
  isAuraMaxed,
  wishlistFulfilled = false,
  children,
}: GlowingNeonBorderProps) {
  const spin = useSharedValue(0);
  const stroke = useSharedValue(GLOW_BASE_STROKE);
  const pulse = isAuraMaxed || wishlistFulfilled;
  const cx = width / 2;
  const cy = height / 2;
  const x = GLOW_INSET;
  const y = GLOW_INSET;
  const rw = Math.max(0, width - GLOW_INSET * 2);
  const rh = Math.max(0, height - GLOW_INSET * 2);
  const radius = Math.max(0, borderRadius);

  useEffect(() => {
    spin.value = withRepeat(withTiming(TWO_PI, { duration: GLOW_SPIN_MS, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(spin);
    };
  }, [spin]);

  useEffect(() => {
    cancelAnimation(stroke);
    if (pulse) {
      stroke.value = withRepeat(
        withSequence(
          withTiming(GLOW_PULSE_STROKE, { duration: 520, easing: Easing.inOut(Easing.quad) }),
          withTiming(GLOW_BASE_STROKE, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      stroke.value = withTiming(GLOW_BASE_STROKE, { duration: 220 });
    }
    return () => {
      cancelAnimation(stroke);
    };
  }, [pulse, stroke]);

  if (width < 8 || height < 8) return children ? <View>{children}</View> : null;

  const glow = (
    <Canvas style={styles.canvas}>
      <RoundedRect x={x} y={y} width={rw} height={rh} r={radius} style="stroke" strokeWidth={stroke}>
        <SweepGradient c={vec(cx, cy)} colors={[...SWEEP]} start={spin} />
        <BlurMask blur={GLOW_BLUR} style="solid" />
      </RoundedRect>
      <RoundedRect x={x} y={y} width={rw} height={rh} r={radius} style="stroke" strokeWidth={stroke}>
        <SweepGradient c={vec(cx, cy)} colors={[...SWEEP]} start={spin} />
      </RoundedRect>
    </Canvas>
  );

  return (
    <View style={[styles.box, { width, height, pointerEvents: children ? 'box-none' : 'none' }]}>
      {glow}
      {children ? (
        <View style={[styles.slot, { borderRadius: radius }]}>{children}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'relative',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  slot: {
    flex: 1,
    margin: GLOW_INSET,
    overflow: 'hidden',
  },
});

export default GlowingNeonBorder;

