/** QUIZ-01 accessible shared invitation/view action; no navigation or data side effects of its own.
 * QUIZ-03 adds a big variant (True / False) and a selected state for one-of-many choices (group names, themes).
 * QUIZ-04 fun presentation (2026-10-15): a springy squish on press and a bounce on release (Reanimated, UI thread).
 * With Reduce Motion, or outside the trivia screen's effects provider, the button keeps the plain dimmed press.
 * The animation is presentation only: `onPress` fires on the normal press, never after an animation.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, KIT } from '@/constants/theme';
import { SPRING_BOUNCE } from '@/theme/motion';
import { useQuizFx } from './QuizFx';

/** @purpose A 44-point action with an explicit disabled state and readable Daylight colours. */
export function QuizButton({ label, onPress, disabled = false, quiet = false, big = false, selected, hint, fill = false, onVideo = false }: {
  label: string; onPress: () => void; disabled?: boolean; quiet?: boolean; big?: boolean; selected?: boolean; hint?: string;
  /** Share a row with a sibling action so a discovery card stays short. */
  fill?: boolean;
  /** Quiet actions on the Highlight scrim, where a white slab would glare. */
  onVideo?: boolean;
}) {
  const { reduceMotion } = useQuizFx();
  const scale = useSharedValue(1);
  const squish = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pressIn = () => { if (!reduceMotion && !disabled) scale.value = withSpring(big ? 0.94 : 0.96, SPRING_BOUNCE); };
  const pressOut = () => { if (!reduceMotion) scale.value = withSpring(1, SPRING_BOUNCE); };
  return <Animated.View style={[squish, fill && styles.fill]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      accessibilityState={selected === undefined ? { disabled } : { disabled, selected }} disabled={disabled} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
      style={({ pressed }) => [styles.button, quiet && styles.quiet, onVideo && quiet && styles.videoQuiet, selected && styles.selected, big && styles.big, fill && styles.fillBtn, (pressed || disabled) && styles.dim]}>
      <Text style={[styles.label, quiet && styles.quietLabel, onVideo && quiet && styles.videoQuietLabel, selected && styles.selectedLabel, big && styles.bigLabel, fill && styles.fillLabel]}>{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  button: { minHeight: 48, padding: 12, borderRadius: KIT.controlRadius, backgroundColor: colors.primary, justifyContent: 'center', ...KIT.shadowSoft },
  quiet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowOpacity: 0, elevation: 0, boxShadow: 'none' },
  videoQuiet: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(247,246,242,0.32)' },
  selected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.accentSoft },
  big: { minHeight: 72, alignItems: 'center' },
  fillBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  label: { color: colors.onAccent, fontSize: 16, fontWeight: '800', textAlign: 'center' }, quietLabel: { color: colors.text }, videoQuietLabel: { color: '#F7F6F2' }, selectedLabel: { color: colors.text },
  fillLabel: { textAlign: 'center', fontSize: 13, lineHeight: 16 },
  bigLabel: { fontSize: 22, fontWeight: '700' }, dim: { opacity: 0.55 },
});
