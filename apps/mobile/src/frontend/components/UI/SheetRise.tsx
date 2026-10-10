/**
 * Short rise for a fan popup card. The card settles in its dock without bouncing past it.
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

import { SPRING_SHEET } from '@/theme/motion';

type SheetRiseProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * @purpose Fade and lift a popup card about 28px into place.
 * @param children The sheet card.
 * @returns An animated wrapper. Reduced motion fades only.
 */
export function SheetRise({ children, style }: SheetRiseProps) {
  const reduce = useReducedMotion();
  const y = useSharedValue(reduce ? 0 : 28);
  const opacity = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    y.value = reduce ? 0 : withSpring(0, SPRING_SHEET);
    opacity.value = withTiming(1, { duration: reduce ? 80 : 180 });
  }, [opacity, reduce, y]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
