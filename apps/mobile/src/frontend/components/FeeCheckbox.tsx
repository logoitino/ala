/**
 * Donate sheet checkbox that lets a donor cover the optional processing fee. Amount comes from
 * `live.catalog.maloFeeDollars` (runtime config). Defaults to off.
 */

import { Checkbox } from 'expo-checkbox';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';

type FeeCheckboxProps = {
  playerName: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function FeeCheckbox({ playerName, checked, disabled = false, onChange }: FeeCheckboxProps) {
  const { live } = useAppRuntime();
  const fee = live.catalog.maloFeeDollars;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`Cover card fees (optional): add $${fee.toFixed(2)}. ${playerName}'s share stays the same; this helps Tapua'i pay the card company.`}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.row, disabled && { opacity: 0.45 }]}
    >
      <Checkbox
        pointerEvents="none"
        value={checked}
        disabled={disabled}
        color={checked ? colors.deepGreen : undefined}
        style={styles.checkbox}
      />
      <View style={styles.copy}>
        <Text style={styles.label}>
          Add ${fee.toFixed(2)} to cover card fees. {playerName}&apos;s share stays the same — this
          helps Tapua&apos;i pay the card company.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    padding: 14,
  },
  checkbox: {
    marginTop: 2,
  },
  copy: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
