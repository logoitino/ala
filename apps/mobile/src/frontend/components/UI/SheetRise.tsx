/**
 * Short rise for a fan popup card. The card settles in its dock without bouncing past it.
 * Pass `active` (usually the Modal `visible`) so every re-open plays the rise again.
 * @sideEffects None. Reanimated only.
 */

import { useEffect, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SHEET_REDUCED_MS, SPRING_SHEET } from '@/theme/motion';

type SheetRiseProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When true, play the enter animation. Defaults to true for one-shot mounts. */
  active?: boolean;
};

/**
 * @purpose Fade and lift a popup card about 28px into place.
 * @param children The sheet card.
 * @param active Re-runs the rise whenever this flips true (Upload / Reel more sheets).
 * @returns An animated wrapper. Reduced motion fades only.
 */
export function SheetRise({ children, style, active = true }: SheetRiseProps) {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? 0 : 28);
  const opacity = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!active) {
      y.value = reduce ? 0 : 28;
      opacity.value = reduce ? 1 : 0;
      return;
    }
    if (reduce) {
      y.value = 0;
      opacity.value = withTiming(1, { duration: SHEET_REDUCED_MS });
      return;
    }
    y.value = 28;
    opacity.value = 0;
    const frame = requestAnimationFrame(() => {
      y.value = withSpring(0, SPRING_SHEET);
      opacity.value = withTiming(1, { duration: 180 });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, opacity, reduce, y]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
