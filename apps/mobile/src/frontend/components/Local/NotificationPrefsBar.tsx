/** Game-day alert preference chips; UX-12 keeps labels readable and every target44pt; uses the shared Calm Island chip look (ink when selected, red stays for LIVE only). */
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import { NOTIFICATION_PREFS, type NotificationPref } from '@/data/players';
import { FOCAL } from '@/theme/motion';
import { figtree, TYPE } from '@/theme/fonts';

type NotificationPrefsBarProps = {
  value: NotificationPref;
  onChange: (value: NotificationPref) => void;
};

/**
 * @purpose Game alert chips with Ember selected state on a gold mist card.
 */
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
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    padding: 10,
    gap: 6,
  },
  title: {
    ...TYPE.caption,
    ...figtree('800'),
    color: FOCAL.goldInk,
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
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
    maxWidth: '100%',
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: FOCAL.ink,
    borderColor: FOCAL.ink,
  },
  chipLabel: {
    ...TYPE.button,
    ...figtree('700'),
    color: colors.text,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
});
