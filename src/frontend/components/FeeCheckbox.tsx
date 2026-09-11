import { Checkbox } from 'expo-checkbox';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { FEE_AMOUNT } from '@/data/players';

type FeeCheckboxProps = {
  playerName: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function FeeCheckbox({ playerName, checked, onChange }: FeeCheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <Checkbox
        value={checked}
        onValueChange={onChange}
        color={checked ? colors.primary : undefined}
        style={styles.checkbox}
      />
      <View style={styles.copy}>
        <Text style={styles.label}>
          Add ${FEE_AMOUNT.toFixed(2)} to cover transaction fees so {playerName} gets 100% of your
          support.
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
