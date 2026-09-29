import { StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { THANKS_MESSAGES, type ThanksKey } from '@/lib/donationThanks';

type ThanksPickerProps = {
  busy?: boolean;
  onPick: (key: ThanksKey) => void;
  onCancel?: () => void;
};

/**
 * @purpose The preset thank-you messages, one tap each. Presets only — no free text, no replies —
 *   because many athletes are minors (LEGAL row S).
 */
export function ThanksPicker({ busy = false, onPick, onCancel }: ThanksPickerProps) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Pick a thank-you message">
      {THANKS_MESSAGES.map((message) => (
        <Pressable
          key={message.key}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => onPick(message.key)}
          style={[styles.option, busy && styles.dim]}
        >
          <Text style={styles.optionText}>{message.text}</Text>
        </Pressable>
      ))}
      {onCancel ? (
        <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  option: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dim: {
    opacity: 0.5,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
