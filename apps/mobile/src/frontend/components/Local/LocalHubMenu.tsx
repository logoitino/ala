/** Sticky Local destinations keep short visible names and icons, including at larger text sizes.
 * Published layout flags still decide which of the existing hubs can appear.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { impactPress } from '@/lib/haptics';
import { TAB_ACCENTS } from '@/theme/motion';

type HubId = 'matches' | 'polls' | 'boosters';
const META = {
  matches: { label: 'Games', icon: 'basketball-outline' },
  polls: { label: 'Polls', icon: 'stats-chart-outline' },
  boosters: { label: 'Boosters', icon: 'sparkles-outline' },
} as const;

/** @purpose Compact Games/Polls/Boosters navigation, independent of the scrolling content below. */
export function LocalHubMenu({ items, value, onChange }: { items: { id: HubId; label?: string }[]; value: HubId; onChange: (id: HubId) => void }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Local hub" style={styles.row}>
      {items.map(({ id, label }) => {
        const selected = id === value;
        const meta = META[id];
        const name = label?.trim() || meta.label;
        const color = selected ? TAB_ACCENTS.local.color : colors.textMuted;
        return (
          <Pressable key={id} accessibilityRole="tab" accessibilityLabel={name}
            accessibilityState={{ selected }} aria-selected={selected}
            onPress={() => { impactPress('selection'); onChange(id); }}
            style={[styles.tab, selected && styles.selected]}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name={meta.icon} size={17} color={color} />
            </View>
            <Text style={[styles.label, { color }]}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  tab: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  selected: { backgroundColor: TAB_ACCENTS.local.mist, borderColor: TAB_ACCENTS.local.color },
  label: { fontSize: 12, fontWeight: '800', flexShrink: 1, maxWidth: '100%', textAlign: 'center' },
});
