/**
 * Birth month and year (MINOR-01): twelve month buttons and a four-digit year, no day. Used by the sign-up step, the
 * one-time age card and Profile → Privacy. Neutral on purpose: nothing hints at the age that would work, the year starts
 * blank, and the value never goes to telemetry.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { MONTHS } from '@/lib/minors';
import { FOCAL } from '@/theme/motion';

export type BirthDraft = { year: number | null; month: number | null };

/**
 * @purpose The month grid and year box; reports a complete year only when all four digits are entered.
 * @remarks Partial year digits stay visible in local state — mapping incomplete input to `year: null` must not wipe the TextInput.
 * @param value Parent draft (month + complete year only).
 * @param onChange Called on every month tap and year digit change.
 */
export function BirthMonthField({ value, onChange, disabled }: { value: BirthDraft; onChange: (next: BirthDraft) => void; disabled?: boolean }) {
  // Keep typed digits while year is still incomplete; parent only stores a finished YYYY.
  const [yearText, setYearText] = useState(value.year != null ? String(value.year) : '');

  useEffect(() => {
    if (value.year != null) {
      setYearText(String(value.year));
      return;
    }
    // Full reset after save (`{ year: null, month: null }`) — clear the box without fighting mid-typing.
    if (value.month == null) setYearText('');
  }, [value.month, value.year]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Birth month and year</Text>
      <View style={styles.months} accessibilityRole="radiogroup" accessibilityLabel="Birth month">
        {MONTHS.map((name, index) => {
          const month = index + 1;
          const on = value.month === month;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityLabel={`Birth month: ${name}`}
              accessibilityState={{ selected: on, disabled: Boolean(disabled) }}
              disabled={disabled}
              haptic="selection"
              onPress={() => onChange({ ...value, month })}
              style={[styles.month, on && styles.monthOn]}
            >
              <Text style={[styles.monthLabel, on && styles.monthLabelOn]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        accessibilityLabel="Birth year"
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="Year (YYYY)"
        placeholderTextColor={colors.textMuted}
        style={styles.year}
        value={yearText}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, 4);
          setYearText(digits);
          onChange({ ...value, year: digits.length === 4 ? Number(digits) : null });
        }}
      />
      <Text style={styles.hint}>We ask for month and year only. It sets the right safety settings and is never shown to others.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontWeight: '800', color: colors.text },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  month: { minWidth: 52, minHeight: 36, paddingHorizontal: 8, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  monthOn: { backgroundColor: FOCAL.jadeInk, borderColor: FOCAL.jadeInk },
  monthLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  monthLabelOn: { color: '#FFFFFF' },
  year: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  hint: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
