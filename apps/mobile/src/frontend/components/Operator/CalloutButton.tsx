/**
 * Sideline callout button on the operator console (split out of app/operator/[gameId].tsx for R4-03;
 * behaviour unchanged). Flashes before the Broadcast round-trip; the screen owns the send behind `onPress`.
 */
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { colors, radii } from '@/constants/theme';

/**
 * @purpose One sideline callout button (⚡ Big Play, 🏆 Touchdown, …). Flashes jade the instant it's tapped,
 * ahead of the Broadcast round-trip, so the operator sees confirmation before `flashToast` lands.
 */
export function CalloutButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <AnimatedPressable
      haptic="none"
      scaleTo={0.94}
      disabled={disabled}
      accessibilityLabel={label}
      onPress={() => {
        flash.value = withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 260 }));
        onPress();
      }}
      style={styles.calloutFlex}
      contentStyle={[styles.callout, disabled && styles.disabled]}
    >
      <Animated.View pointerEvents="none" style={[styles.calloutFlash, flashStyle]} />
      <Text style={styles.calloutLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  calloutFlex: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 148,
  },
  callout: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calloutFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.primary,
  },
  calloutLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
});
