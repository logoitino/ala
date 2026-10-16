// ARCHIVED 2026-10-13 · DATA-01-F6 · owner approved · whole file apps/mobile/src/frontend/components/Admin/TelemetryCards.tsx (TelemetryCards).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it.
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import type { AdminPlatformMetrics } from '@/lib/admin';
import { formatTipDollars } from '@/lib/reels';
import { FOCAL } from '@/theme/motion';

type TelemetryCardsProps = {
  metrics: AdminPlatformMetrics;
};

/**
 * @purpose Metric summary cards for Highlights volume, hype engagement, and Mālo totals.
 */
export function TelemetryCards({ metrics }: TelemetryCardsProps) {
  const cards = [
    {
      id: 'highlights',
      kicker: 'Highlights ⚡',
      value: metrics.highlightCount.toLocaleString(),
      hint: 'Live clips on the platform',
    },
    {
      id: 'engagement',
      kicker: 'Active engagement',
      value: metrics.engagementCount.toLocaleString(),
      hint: 'Seki + Aura + Flex on live clips',
    },
    {
      id: 'malo',
      kicker: 'Donations',
      value: formatTipDollars(metrics.maloCents),
      hint: 'All donations made on the platform',
    },
  ];

  return (
    <View style={styles.wrap}>
      {cards.map((card) => (
        <View key={card.id} style={styles.card} accessibilityRole="summary" accessibilityLabel={`${card.kicker} ${card.value}`}>
          <Text style={styles.kicker}>{card.kicker}</Text>
          <Text style={styles.value}>{card.value}</Text>
          <Text style={styles.hint}>{card.hint}</Text>
        </View>
      ))}
      <View style={styles.meta}>
        <Text style={styles.metaLine}>Open flags · {metrics.openFlags}</Text>
        <Text style={styles.metaLine}>Telemetry events (24h) · {metrics.telemetryEvents24h}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  kicker: {
    color: FOCAL.jadeInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  meta: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: 'center',
    gap: 6,
  },
  metaLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
