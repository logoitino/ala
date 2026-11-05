/**
 * Row of an athlete's Seki / Aura / Flex / view counts. `interactive` turns the counts into tap-to-bump buttons
 * (local-first via `lib/hype.ts`).
 */

import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import {  type PlayReactionId } from '@/data/players';
import { formatCompactCount, type PlayerHype } from '@/lib/hype';

type HypeBoardProps = {
  hype: PlayerHype;
  interactive?: boolean;
  onBump?: (kind: PlayReactionId) => void;
};

const METERS: { id: PlayReactionId | 'view'; emoji: string; label: string; hint?: string }[] = [
  { id: 'view', emoji: '👁', label: 'Views' },
  { id: 'aura', emoji: '⚡', label: 'Aura' },
  { id: 'flex', emoji: '💪', label: 'Flex' },
  { id: 'seki', emoji: '🤙', label: 'Seki', hint: 'Awesome' },
];

function valueFor(hype: PlayerHype, id: (typeof METERS)[number]['id']): number {
  if (id === 'view') return hype.view_count;
  if (id === 'aura') return hype.aura_count;
  if (id === 'flex') return hype.flex_count;
  return hype.seki_count;
}

export function HypeBoard({ hype, interactive = false, onBump }: HypeBoardProps) {
  const peak = Math.max(hype.aura_count, hype.flex_count, hype.seki_count, 1);

  return (
    <View style={styles.board}>
      <Text style={styles.kicker}>Jumbotron</Text>
      <Text style={styles.title}>Crowd meter — everyone can see this</Text>
      <View style={styles.row}>
        {METERS.map((meter) => {
          const value = valueFor(hype, meter.id);
          const fill = meter.id === 'view' ? 1 : Math.max(0.08, value / peak);
          const canTap = interactive && meter.id !== 'view';
          const body = (
            <View style={[styles.cell, meter.id === 'seki' && styles.sekiCell]}>
              <Text style={styles.emoji}>{meter.emoji}</Text>
              <Text style={styles.value}>{formatCompactCount(value)}</Text>
              <Text style={styles.label}>{meter.label}</Text>
              {meter.hint ? <Text style={styles.hint}>{meter.hint}</Text> : null}
              {meter.id !== 'view' ? (
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }]} />
                </View>
              ) : null}
            </View>
          );

          if (!canTap) {
            return (
              <View key={meter.id} style={styles.cellWrap}>
                {body}
              </View>
            );
          }

          return (
            <Pressable
              key={meter.id}
              accessibilityRole="button"
              accessibilityLabel={`${meter.label}, ${value}`}
              accessibilityHint={meter.hint}
              onPress={() => {
                if (meter.id === 'view') return;
                onBump?.(meter.id);
              }}
              style={({ pressed }) => [styles.cellWrap, pressed && styles.pressed]}
            >
              {body}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: 14,
    gap: 10,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cellWrap: {
    flex: 1,
  },
  cell: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
    minHeight: 92,
  },
  sekiCell: {
    borderWidth: 1,
    borderColor: colors.gold,
  },
  emoji: {
    fontSize: 18,
  },
  value: {
    ...SCOREBOARD_DIGITS,
    color: colors.text,
    fontSize: 18,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  hint: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  track: {
    marginTop: 6,
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: colors.gold,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
});
