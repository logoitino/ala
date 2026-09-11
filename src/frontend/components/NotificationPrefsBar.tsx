import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { NOTIFICATION_PREFS, type NotificationPref } from '@/data/players';

type NotificationPrefsBarProps = {
  value: NotificationPref;
  onChange: (value: NotificationPref) => void;
};

export function NotificationPrefsBar({ value, onChange }: NotificationPrefsBarProps) {
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>Alerts</Text>
      <View style={styles.row}>
        {NOTIFICATION_PREFS.map((pref) => {
          const selected = pref.id === value;
          return (
            <Pressable
              key={pref.id}
              accessibilityRole="button"
              onPress={() => onChange(pref.id)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {pref.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
});
