/** UX-13 readable shared type preserves every action and required notice.
 * Gift checkout's optional Stripe processing coverage uses the configured estimate, never a Tapua'i fee.
 * The monetization flag must be literal true; turning it off removes this control, and selections default off.
 */

import { Checkbox } from 'expo-checkbox';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { TYPE, figtree } from '@/theme/fonts';

type FeeCheckboxProps = {
  playerName: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function FeeCheckbox({ playerName, checked, disabled = false, onChange }: FeeCheckboxProps) {
  const { live } = useAppRuntime();
  const fee = live.catalog.maloFeeDollars;
  const enabled = live.buttons?.MONETIZATION_TIPS_ENABLED === true;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  if (!enabled) return null;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`Cover the processing fee: add $${fee.toFixed(2)} toward estimated Stripe processing for ${playerName}'s gift. Optional; actual costs may vary.`}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => { if (enabledRef.current && !disabled) onChange(!checked); }}
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
        <Text style={styles.label}>Cover the processing fee</Text>
        <Text style={styles.label}>Optional: add ${fee.toFixed(2)} toward estimated Stripe processing for {playerName}&apos;s gift. Actual costs may vary.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44,
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
  label: { ...figtree('400'),
    ...TYPE.body,

    color: colors.text,
  },
});
