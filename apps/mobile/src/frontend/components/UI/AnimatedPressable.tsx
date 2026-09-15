import { type ReactNode } from 'react';
import {
  Pressable,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { impactPress, type PressHaptic } from '@/lib/haptics';
import { SPRING_BOUNCE, SPRING_CARD } from '@/theme/motion';

type AnimatedPressableProps = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  haptic?: PressHaptic;
  /** Press-in scale. Defaults to 0.88 for reaction chips; Drip cards use 0.96. */
  scaleTo?: number;
  /** When true, springs to 1.15 then 1.0. Drip cards skip the overshoot. */
  overshoot?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};

const PRESS_IN = { duration: 70 };

/**
 * @purpose Press scale wrapper. Chips bounce 0.88→1.15→1.0; Drip / booster cards use 0.96 without overshoot.
 * @param haptic Defaults to Light via `impactPress`.
 * @param scaleTo Press-in scale (0.88 chips, 0.96 GearCard / booster, 0.94 cheer options).
 * @returns Animated press wrapper.
 * @sideEffects Native haptics on a successful press when not disabled.
 */
export function AnimatedPressable({
  children,
  onPress,
  disabled = false,
  haptic = 'light',
  scaleTo = 0.88,
  overshoot = true,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        scale.value = withTiming(scaleTo, PRESS_IN);
      }}
      onPressOut={() => {
        scale.value = overshoot
          ? withSequence(withSpring(1.15, SPRING_BOUNCE), withSpring(1, SPRING_CARD))
          : withSpring(1, SPRING_CARD);
      }}
      onPress={(event) => {
        if (disabled) return;
        impactPress(haptic);
        onPress?.(event);
      }}
      style={style}
    >
      <Animated.View style={[contentStyle, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
