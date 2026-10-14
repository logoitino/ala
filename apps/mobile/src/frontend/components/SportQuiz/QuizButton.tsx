/** QUIZ-01 accessible shared invitation/view action; no navigation or data side effects of its own. */
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii } from '@/constants/theme';

/** @purpose A 44-point action with an explicit disabled state and readable Daylight colours. */
export function QuizButton({ label, onPress, disabled = false, quiet = false }: { label: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, quiet && styles.quiet, (pressed || disabled) && styles.dim]}>
    <Text style={[styles.label, quiet && styles.quietLabel]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 44, padding: 12, borderRadius: radii.md, backgroundColor: colors.primary, justifyContent: 'center' },
  quiet: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.onAccent, fontSize: 16, fontWeight: '600' }, quietLabel: { color: colors.text }, dim: { opacity: 0.55 },
});
