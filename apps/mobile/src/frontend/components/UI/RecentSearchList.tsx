/** One vertical recent search layout keeps the icon and text columns aligned on both surfaces. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { TYPE, figtree } from '@/theme/fonts';

type Props = { items: string[]; onSelect: (query: string) => void; onClear: () => void };

export function RecentSearchList({ items, onSelect, onClear }: Props) {
  if (!items.length) return null;
  return (
    <View>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>Recent searches</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear recent searches" style={styles.clear} onPress={onClear}>
          <Text style={styles.clearText}>Clear all</Text>
        </Pressable>
      </View>
      {items.map(item => (
        <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Search ${item}`}
          onPress={() => onSelect(item)} style={styles.row}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} accessible={false} />
          <Text style={styles.label}>{item}</Text>
          <Ionicons name="arrow-up-outline" size={15} color={colors.textMuted} style={styles.arrow} accessible={false} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 8 },
  heading: { flex: 1, minWidth: 0, ...TYPE.button, ...figtree('800'), color: colors.text },
  clear: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  clearText: { ...TYPE.caption, ...figtree('800'), color: colors.primary },
  row: { minHeight: 44, paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center',
    gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  label: { flex: 1, minWidth: 0, ...TYPE.body, ...figtree('600'), color: colors.text },
  arrow: { transform: [{ rotate: '-45deg' }] },
});
