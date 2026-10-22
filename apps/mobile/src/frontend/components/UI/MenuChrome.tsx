/**
 * Shared quiet sheet wash and compact progress chips for fan menus. Pages carry no decoration (Calm Island,
 * owner 2026-10-15); sheets keep one soft accent wash. It cannot intercept touches; progress describes the current page.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, MENU_METRICS } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

const accents = {
  jade: { ink: FOCAL.jadeInk, wash: FOCAL.mistJade },
  gold: { ink: FOCAL.goldInk, wash: FOCAL.mistGold },
  violet: { ink: FOCAL.violetInk, wash: FOCAL.mistViolet },
  cyan: { ink: FOCAL.cyanInk, wash: FOCAL.mistCyan },
  ember: { ink: FOCAL.emberInk, wash: FOCAL.mistEmber },
} as const;
export type MenuAccent = keyof typeof accents;

/** @purpose Add a quiet accent wash behind menu content without hiding text or blocking gestures. */
export function MenuBackdrop({ accent = 'jade' }: { accent?: MenuAccent }) {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
    <View style={[styles.orb, { backgroundColor: accents[accent].wash }]} />
  </View>;
}

/** @purpose Show short named stages; completed stages use a check and the current stage remains readable. */
export function MenuStepIndicator({ labels, current }: { labels: string[]; current: number }) {
  return <View accessible accessibilityRole="text" accessibilityLabel={`Step ${current} of ${labels.length}: ${labels[current - 1] ?? ''}`} style={styles.steps}>
    {labels.map((label, index) => {
      const active = index + 1 === current;
      const complete = index + 1 < current;
      return <View key={label} style={[styles.step, active && styles.stepActive]}>
        <Text style={[styles.number, (active || complete) && styles.numberActive]}>{complete ? '✓' : index + 1}</Text>
        <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  art: { position: 'absolute', top: 0, right: 0, width: 160, height: 110, overflow: 'hidden' },
  orb: { position: 'absolute', width: 150, height: 150, borderRadius: 75, top: -60, right: -38 },
  steps: { flexDirection: 'row', gap: 6, paddingBottom: 8 },
  step: { flex: 1, minHeight: 32, paddingHorizontal: 6, paddingVertical: 5, borderRadius: MENU_METRICS.controlRadius, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stepActive: { backgroundColor: colors.accentSoft, borderColor: colors.primary },
  number: { fontSize: 11, fontWeight: '800', color: colors.textMuted },
  numberActive: { color: colors.primary },
  stepLabel: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: colors.textMuted },
  stepLabelActive: { color: colors.primary },
});
