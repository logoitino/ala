/** UX-13 readable shared type preserves every action and required notice. Personal-gift receipt, including the tax notice; legacy receipt fields keep their API names. */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { tipChannelLabel } from '@/lib/finance';
import { SPRING_CARD } from '@/theme/motion';
import type { FanTipReceipt } from '@/types/database';
import { TYPE, figtree } from '@/theme/fonts';

type ReceiptCardProps = {
  receipt: FanTipReceipt;
  onViewReel?: (receipt: FanTipReceipt) => void;
  /** Position in the ledger list — staggers the mount-in so a scan down the list feels alive, not flat. */
  index?: number;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function formatMaloAmount(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)} gift ⚡`;
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
export function ReceiptCard({ receipt, onViewReel, index = 0 }: ReceiptCardProps) {
  const name = receipt.athlete_name.trim() || 'Athlete';
  const school = receipt.school_name.trim();
  const stamped = formatReceiptDate(receipt.created_at);
  const auraGained = Math.max(0, receipt.aura_points);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    const delay = Math.min(index, 6) * 50;
    opacity.value = withDelay(delay, withTiming(1, { duration: 240 }));
    translateY.value = withDelay(delay, withSpring(0, SPRING_CARD));
    // Runs once on mount to stagger the reveal; not meant to re-fire per re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      accessibilityRole="summary"
      accessibilityLabel={`${name}, ${formatMaloAmount(receipt.amount_cents)}, ${tipChannelLabel(receipt.origin, receipt.entry, receipt.source_label)}, plus ${auraGained} Aura`}
      style={[styles.card, enterStyle]}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <View pointerEvents="none" style={styles.avatarGloss} />
          <Text style={styles.initials}>{initialsFor(name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{name}</Text>
          {school ? <Text style={styles.school}>{school}</Text> : null}
          <Text style={styles.school}>{tipChannelLabel(receipt.origin, receipt.entry, receipt.source_label)}</Text>
          {stamped ? <Text style={styles.stamp}>{stamped}</Text> : null}
        </View>
      </View>

      <View style={styles.ledgerRow}>
        <Text style={styles.malo}>{formatMaloAmount(receipt.amount_cents)}</Text>
        <View style={styles.auraBadge}>
          <Text style={styles.auraBadgeLabel}>{`+${auraGained} Aura`}</Text>
        </View>
      </View>

      <Text style={styles.school}>Gifts to individual athletes are personal gifts and are not tax-deductible.</Text>

      {onViewReel ? (
        <AnimatedButton
          accessibilityLabel={`View highlight for ${name}`}
          onPress={() => onViewReel(receipt)}
          contentStyle={styles.viewReel}
        >
          <Text style={styles.viewReelLabel}>View Highlight ⚡</Text>
        </AnimatedButton>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
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
    overflow: 'hidden',
  },
  avatarGloss: {
    position: 'absolute',
    top: -12,
    left: -9,
    width: 38,
    height: 25,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-18deg' }],
  },
  initials: {
    color: colors.primary,
    ...TYPE.body,
    ...figtree('800'),
    letterSpacing: 0.4,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  school: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('700'),
  },
  stamp: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('600'),
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  malo: { ...figtree('400'),
    ...SCOREBOARD_DIGITS,
    flex: 1,
    color: colors.text,
    ...TYPE.title,
  },
  auraBadge: {
    backgroundColor: colors.accentSoft,
    borderWidth: 0,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  auraBadgeLabel: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
  },
  viewReel: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 0,
    borderColor: colors.primary,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewReelLabel: {
    color: colors.primary,
    ...TYPE.body,
    ...figtree('800'),
  },
});
