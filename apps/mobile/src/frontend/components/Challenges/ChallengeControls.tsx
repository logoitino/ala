/** Shared local controls for CHAL-01 participant panels; no data access or persistence. */
import { Text, StyleSheet } from 'react-native';
import { HapticPressable } from '@/components/UI/HapticPressable';
import { FOCAL } from '@/theme/motion';

/** @purpose Accessible challenge action with the same disabled rule on the real native press boundary. */
export function ChallengeButton({ label, onPress, disabled = false, selected = false }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </HapticPressable>
  );
}

/** @purpose Truthful loading/error/action notice; unavailable is not a healthy empty source. */
export function ChallengeFeedback({ error, notice, reading }: { error: string | null; notice: string | null; reading: boolean }) {
  return (
    <>
      {reading ? <Text style={styles.reading}>Loading challenges…</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[styles.feedback, styles.error]}>{error}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, styles.notice]}>{notice}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D7E5DC',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    justifyContent: 'center',
    marginVertical: 3,
    flexShrink: 1,
  },
  label: { color: FOCAL.ink, fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  selected: { backgroundColor: FOCAL.mistJade, borderColor: FOCAL.jadeInk },
  selectedLabel: { color: FOCAL.jadeInk },
  disabled: { opacity: 0.5 },
  reading: { color: '#4A5560', fontSize: 14, lineHeight: 20, marginVertical: 8 },
  feedback: { fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 12, marginVertical: 6 },
  error: { color: FOCAL.emberInk, backgroundColor: FOCAL.mistEmber },
  notice: { color: FOCAL.jadeInk, backgroundColor: FOCAL.mistJade },
});
