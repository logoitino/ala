import { type ReactNode } from 'react';
import {
  Pressable,
  type AccessibilityRole,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { impactPress, type PressHaptic } from '@/lib/haptics';
import { SPRING_BOUNCE } from '@/theme/motion';

type AnimatedButtonProps = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  haptic?: PressHaptic;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean; disabled?: boolean };
};


function fireHaptic(kind: PressHaptic) {
  impactPress(kind);
}

/**
 * @purpose Spring-scale press wrapper with shared `impactPress` haptics for primary chrome (tabs, pills, FAB).
 */
export function AnimatedButton({
  children,
  onPress,
  disabled = false,
  haptic = 'light',
  scaleTo = 0.95,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityState,
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ ...accessibilityState, disabled }}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, SPRING_BOUNCE);
        opacity.value = withSpring(0.82, SPRING_BOUNCE);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING_BOUNCE);
        opacity.value = withSpring(1, SPRING_BOUNCE);
      }}
      onPress={(event) => {
        if (disabled) return;
        fireHaptic(haptic);
        onPress?.(event);
      }}
      style={style}
    >
      <Animated.View style={[contentStyle, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
