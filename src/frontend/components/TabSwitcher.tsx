import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

type TabId = 'feed' | 'rosters';

type TabSwitcherProps = {
  value: TabId;
  onChange: (value: TabId) => void;
};

export function TabSwitcher({ value, onChange }: TabSwitcherProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange('feed')}
        style={[styles.tab, value === 'feed' && styles.tabActive]}
      >
        <Text style={[styles.label, value === 'feed' && styles.labelActive]}>Live Play Feed</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onChange('rosters')}
        style={[styles.tab, value === 'rosters' && styles.tabActive]}
      >
        <Text style={[styles.label, value === 'rosters' && styles.labelActive]}>Team Rosters</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
