/**
 * Birth month and year (MINOR-01): compact dropdown scroll menus (no day). Used by the sign-up step, the one-time age
 * card and Profile → Privacy. Neutral on purpose: nothing hints at the age that would work, values never go to
 * telemetry. Lovable density: one row of two triggers with an inline scroll list — avoids a nested Modal inside SoftWall.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, KIT, MENU_METRICS } from '@/constants/theme';
import { MONTHS } from '@/lib/minors';
import { FOCAL } from '@/theme/motion';

export type BirthDraft = { year: number | null; month: number | null };

const ROW = 40;
const LIST_MAX = ROW * 5;

type OpenPicker = 'month' | 'year' | null;

function yearOptions(now: Date = new Date()): number[] {
  const newest = now.getFullYear();
  const years: number[] = [];
  for (let y = newest; y >= 1900; y -= 1) years.push(y);
  return years;
}

/**
 * @purpose Compact month + year dropdown scroll menus; reports the chosen values to the parent draft.
 * @param value Parent draft (month + year).
 * @param onChange Called when a month or year row is tapped.
 */
export function BirthMonthField({
  value,
  onChange,
  disabled,
}: {
  value: BirthDraft;
  onChange: (next: BirthDraft) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<OpenPicker>(null);
  const years = useMemo(() => yearOptions(), []);
  const monthLabel = value.month ? MONTHS[value.month - 1] : 'Month';
  const yearLabel = value.year != null ? String(value.year) : 'Year';

  const toggle = (next: OpenPicker) => {
    if (disabled) return;
    setOpen((current) => (current === next ? null : next));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Birth month and year</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value.month ? `Birth month: ${monthLabel}` : 'Choose birth month'}
          accessibilityState={{ disabled: Boolean(disabled), expanded: open === 'month' }}
          disabled={disabled}
          haptic="selection"
          onPress={() => toggle('month')}
          style={[styles.trigger, value.month != null && styles.triggerOn, open === 'month' && styles.triggerOpen, disabled && styles.triggerOff]}
        >
          <Text style={[styles.triggerLabel, value.month == null && styles.triggerPlaceholder]} numberOfLines={1}>
            {monthLabel}
          </Text>
          <Ionicons name={open === 'month' ? 'chevron-up' : 'chevron-down'} size={16} color={value.month != null ? FOCAL.jadeInk : colors.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value.year != null ? `Birth year: ${yearLabel}` : 'Choose birth year'}
          accessibilityState={{ disabled: Boolean(disabled), expanded: open === 'year' }}
          disabled={disabled}
          haptic="selection"
          onPress={() => toggle('year')}
          style={[styles.trigger, value.year != null && styles.triggerOn, open === 'year' && styles.triggerOpen, disabled && styles.triggerOff]}
        >
          <Text style={[styles.triggerLabel, value.year == null && styles.triggerPlaceholder]} numberOfLines={1}>
            {yearLabel}
          </Text>
          <Ionicons name={open === 'year' ? 'chevron-up' : 'chevron-down'} size={16} color={value.year != null ? FOCAL.jadeInk : colors.textMuted} />
        </Pressable>
      </View>

      {open === 'month' ? (
        <ScrollView
          style={styles.list}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          accessibilityLabel="Birth month list"
        >
          {MONTHS.map((name, index) => {
            const month = index + 1;
            const on = value.month === month;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={name}
                accessibilityState={{ selected: on }}
                haptic="selection"
                onPress={() => {
                  onChange({ ...value, month });
                  setOpen(null);
                }}
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {open === 'year' ? (
        <ScrollView
          style={styles.list}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          accessibilityLabel="Birth year list"
        >
          {years.map((year) => {
            const on = value.year === year;
            return (
              <Pressable
                key={year}
                accessibilityRole="button"
                accessibilityLabel={String(year)}
                accessibilityState={{ selected: on }}
                haptic="selection"
                onPress={() => {
                  onChange({ ...value, year });
                  setOpen(null);
                }}
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{year}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={styles.hint}>Month and year only. Sets safety settings and is never shown to others.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  trigger: {
    flex: 1,
    minHeight: MENU_METRICS.touchTarget,
    borderRadius: KIT.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerOn: { borderColor: FOCAL.jadeInk, backgroundColor: colors.accentSoft },
  triggerOpen: { borderColor: FOCAL.jadeInk },
  triggerOff: { opacity: 0.55 },
  triggerLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text },
  triggerPlaceholder: { color: colors.textMuted, fontWeight: '700' },
  list: {
    maxHeight: LIST_MAX,
    borderRadius: KIT.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  option: {
    minHeight: ROW,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionOn: { backgroundColor: colors.accentSoft },
  optionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  optionLabelOn: { color: FOCAL.jadeInk, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
});
