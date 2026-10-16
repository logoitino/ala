/** QUIZ-01 accessible shared invitation/view action; no navigation or data side effects of its own.
 * QUIZ-03 adds a big variant (True / False) and a selected state for one-of-many choices (group names, themes).
 * QUIZ-04 fun presentation (2026-10-15): a springy squish on press and a bounce on release (Reanimated, UI thread).
 * With Reduce Motion, or outside the trivia screen's effects provider, the button keeps the plain dimmed press.
 * The animation is presentation only: `onPress` fires on the normal press, never after an animation.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radii } from '@/constants/theme';
import { SPRING_BOUNCE } from '@/theme/motion';
import { useQuizFx } from './QuizFx';

/** @purpose A 44-point action with an explicit disabled state and readable Daylight colours. */
export function QuizButton({ label, onPress, disabled = false, quiet = false, big = false, selected, hint }: {
  label: string; onPress: () => void; disabled?: boolean; quiet?: boolean; big?: boolean; selected?: boolean; hint?: string;
}) {
  const { reduceMotion } = useQuizFx();
  const scale = useSharedValue(1);
  const squish = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressIn = () => { if (!reduceMotion && !disabled) scale.value = withSpring(big ? 0.94 : 0.96, SPRING_BOUNCE); };
  const pressOut = () => { if (!reduceMotion) scale.value = withSpring(1, SPRING_BOUNCE); };
  return <Animated.View style={squish}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      accessibilityState={selected === undefined ? { disabled } : { disabled, selected }} disabled={disabled} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
      style={({ pressed }) => [styles.button, quiet && styles.quiet, selected && styles.selected, big && styles.big, (pressed || disabled) && styles.dim]}>
      <Text style={[styles.label, quiet && styles.quietLabel, selected && styles.selectedLabel, big && styles.bigLabel]}>{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  button: { minHeight: 44, padding: 12, borderRadius: radii.md, backgroundColor: colors.primary, justifyContent: 'center' },
  quiet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  selected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.accentSoft },
  big: { minHeight: 72, alignItems: 'center' },
  label: { color: colors.onAccent, fontSize: 16, fontWeight: '600' }, quietLabel: { color: colors.text }, selectedLabel: { color: colors.text },
  bigLabel: { fontSize: 22, fontWeight: '700' }, dim: { opacity: 0.55 },
});
