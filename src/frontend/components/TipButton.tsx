import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

type TipButtonProps = {
  amount: number;
  disabled?: boolean;
  onPress: (amount: number) => void;
};

export function TipButton({ amount, disabled = false, onPress }: TipButtonProps) {
  const dollars = amount.toFixed(2);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`$${amount} Mālo, $${dollars} support`}
      disabled={disabled}
      onPress={() => onPress(amount)}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>${amount} Mālo</Text>
        <Text style={styles.sublabel}>(${dollars} Support)</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: 64,
    minWidth: 88,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buttonPressed: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primaryMuted,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  copy: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  sublabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
