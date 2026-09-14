import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, palette, radii } from '@/constants/theme';
import type { FanTipReceipt } from '@/types/database';

type ReceiptCardProps = {
  receipt: FanTipReceipt;
  onViewReel?: (receipt: FanTipReceipt) => void;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function formatMaloAmount(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)} Mālo ⚡`;
}

function formatReceiptDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * @purpose Obsidian Mālo receipt row: athlete identity, tip dollars, Neon Jade Aura badge, View Reel shortcut.
 * @param receipt `get_fan_tip_history` row (athlete name, school, cents, Aura, timestamp).
 * @param onViewReel Opens the athlete's Highlights ⚡ (`/user/[id]`) when the fan taps View Highlight.
 * @returns Polynesian Obsidian transaction card.
 */
export function ReceiptCard({ receipt, onViewReel }: ReceiptCardProps) {
  const name = receipt.athlete_name.trim() || 'Athlete';
  const school = receipt.school_name.trim();
  const stamped = formatReceiptDate(receipt.created_at);
  const auraGained = Math.max(0, receipt.aura_points);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${name}, ${formatMaloAmount(receipt.amount_cents)}, plus ${auraGained} Aura`}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initialsFor(name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{name}</Text>
          {school ? <Text style={styles.school}>{school}</Text> : null}
          {stamped ? <Text style={styles.stamp}>{stamped}</Text> : null}
        </View>
      </View>

      <View style={styles.ledgerRow}>
        <Text style={styles.malo}>{formatMaloAmount(receipt.amount_cents)}</Text>
        <View style={styles.auraBadge}>
          <Text style={styles.auraBadgeLabel}>{`+${auraGained} Aura`}</Text>
        </View>
      </View>

      {onViewReel ? (
        <AnimatedButton
          accessibilityLabel={`View highlight for ${name}`}
          onPress={() => onViewReel(receipt)}
          contentStyle={styles.viewReel}
        >
          <Text style={styles.viewReelLabel}>View Highlight ⚡</Text>
        </AnimatedButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.midnightObsidian,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.photoPlaceholder,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  school: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  stamp: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  malo: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  auraBadge: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  auraBadgeLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  viewReel: {
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewReelLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});
