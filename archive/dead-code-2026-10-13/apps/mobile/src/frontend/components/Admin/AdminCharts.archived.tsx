// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · whole file apps/mobile/src/frontend/components/Admin/AdminCharts.tsx (AdminBarChart, AdminMixChart).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * Hand-drawn bar and mix charts for the admin desks (plain Views, because the npm registry is blocked on this
 * machine and Recharts cannot be added). Used by the Reports and Money desks.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

export type AdminChartPoint = {
  day: string;
  value: number;
};

/**
 * @purpose Horizontal bar chart for report series (clips, Mālo, stalls) without a charting library.
 */
export function AdminBarChart({
  title,
  points,
  formatValue,
  accent = FOCAL.neonJade,
}: {
  title: string;
  points: AdminChartPoint[];
  formatValue?: (value: number) => string;
  accent?: string;
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel={title}>
      <Text style={styles.title}>{title}</Text>
      {points.length === 0 ? (
        <Text style={styles.empty}>No series yet.</Text>
      ) : (
        points.map((point) => (
          <View key={point.day} style={styles.row}>
            <Text style={styles.label}>{point.day}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(4, (point.value / max) * 100)}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.value}>{formatValue ? formatValue(point.value) : point.value.toLocaleString()}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/**
 * @purpose Compact stacked bars for mix reports (Seki / Aura / Flex or category split).
 */
export function AdminMixChart({
  title,
  slices,
}: {
  title: string;
  slices: { label: string; value: number; color: string }[];
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.mixTrack}>
        {total === 0 ? (
          <View style={[styles.mixSlice, { flex: 1, backgroundColor: colors.border }]} />
        ) : (
          slices.map((slice) =>
            slice.value > 0 ? (
              <View
                key={slice.label}
                style={[styles.mixSlice, { flex: slice.value, backgroundColor: slice.color }]}
                accessibilityLabel={`${slice.label} ${slice.value}`}
              />
            ) : null,
          )
        )}
      </View>
      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendLabel}>
              {slice.label} · {slice.value.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  title: {
    color: FOCAL.jadeInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    width: 36,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 5,
  },
  value: {
    width: 52,
    textAlign: 'right',
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  mixTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  mixSlice: {
    height: 12,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
});
