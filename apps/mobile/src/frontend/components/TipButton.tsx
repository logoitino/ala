import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import { auraPointsForTip } from '@/data/players';
import { SPRING_BOUNCE } from '@/theme/motion';

type TipButtonProps = {
  amount?: number;
  label?: string;
  sublabel?: string;
  disabled?: boolean;
  selected?: boolean;
  wide?: boolean;
  onPress: () => void;
};

export function TipButton({
  amount,
  label,
  sublabel,
  disabled = false,
  selected = false,
  wide = false,
  onPress,
}: TipButtonProps) {
  const title = label ?? `Donate $${amount}`;
  const detail = sublabel ?? (amount != null ? `+${auraPointsForTip(amount)} Aura Points ⚡` : undefined);

  const selectProgress = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    selectProgress.value = withTiming(selected ? 1 : 0, { duration: 180 });
    if (selected) {
      pop.value = withSequence(withSpring(1.07, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE));
    }
  }, [selected, selectProgress, pop]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    backgroundColor: interpolateColor(selectProgress.value, [0, 1], [colors.deepGreen, colors.accentSoft]),
    borderColor: interpolateColor(selectProgress.value, [0, 1], [colors.deepGreen, colors.primary]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selectProgress.value, [0, 1], [colors.onAccent, colors.primary]),
  }));

  const sublabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selectProgress.value, [0, 1], [colors.onAccent, colors.textMuted]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.hit,
        wide && styles.hitWide,
        pressed && styles.hitPressed,
        disabled && styles.hitDisabled,
      ]}
    >
      <Animated.View style={[styles.button, boxStyle]}>
        <View style={styles.copy}>
          <Animated.Text style={[styles.label, labelStyle]}>{title}</Animated.Text>
          {detail ? <Animated.Text style={[styles.sublabel, sublabelStyle]}>{detail}</Animated.Text> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 88,
  },
  hitWide: {
    flexBasis: '100%',
    alignSelf: 'stretch',
  },
  hitPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  hitDisabled: {
    opacity: 0.45,
  },
  button: {
    minHeight: 64,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  copy: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
