/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

type TabId = 'feed' | 'rosters';

type TabSwitcherProps = {
  value: TabId;
  onChange: (value: TabId) => void;
};

/**
 * @purpose Game detail Feed / Rosters switcher on gold mist with gold active fill.
 */
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
        <Text style={[styles.label, value === 'rosters' && styles.labelActive]}>Rosters & Give</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    padding: 4,
    gap: 4,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: FOCAL.goldInk,
  },
  label: {
    textAlign: 'center',
    ...TYPE.button,
    ...figtree('700'),
    color: FOCAL.goldInk,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
