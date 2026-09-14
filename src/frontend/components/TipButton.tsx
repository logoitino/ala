import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import { auraPointsForTip } from '@/data/players';

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
  const title = label ?? `$${amount} Mālo`;
  const detail = sublabel ?? (amount != null ? `+${auraPointsForTip(amount)} Aura Points ⚡` : undefined);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        wide && styles.buttonWide,
        selected && styles.buttonSelected,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{title}</Text>
        {detail ? (
          <Text style={[styles.sublabel, selected && styles.sublabelSelected]}>{detail}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 64,
    minWidth: 88,
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.deepGreen,
  },
  buttonWide: {
    flexBasis: '100%',
    alignSelf: 'stretch',
  },
  buttonSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.primary,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  copy: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  labelSelected: {
    color: colors.primary,
  },
  sublabel: {
    color: 'rgba(15,20,22,0.72)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  sublabelSelected: {
    color: colors.textMuted,
  },
});
