import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors, radii } from '@/constants/theme';
import { ROLE_LABELS, USER_ROLES } from '@/lib/roles';

export function RoleSwitcher() {
  const { role, switchRole } = useAuth();

  return (
    <View style={styles.bar}>
      <Text style={styles.caption}>Dev role</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {USER_ROLES.map((item) => {
          const selected = item === role;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => void switchRole(item)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                {ROLE_LABELS[item]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 6,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    gap: 8,
    paddingRight: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
});
