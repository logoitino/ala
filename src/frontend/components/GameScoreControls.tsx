import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import { GAME_STATUSES, SCORE_MACROS, displayValue } from '@/data/players';
import type { Game } from '@/types/database';

type ScoreSide = 'home' | 'away';

type GameScoreControlsProps = {
  game: Game;
  side: ScoreSide;
  disabled?: boolean;
  onSelectSide: (side: ScoreSide) => void;
  onAddPoints: (points: number) => void;
  onSetStatus: (status: (typeof GAME_STATUSES)[number]) => void;
};

export function GameScoreControls({
  game,
  side,
  disabled = false,
  onSelectSide,
  onAddPoints,
  onSetStatus,
}: GameScoreControlsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Scoring team</Text>
      <View style={styles.sideRow}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelectSide('home')}
          style={[styles.sideChip, side === 'home' && styles.sideChipActive]}
        >
          <Text style={[styles.sideLabel, side === 'home' && styles.sideLabelActive]}>
            Home · {displayValue(game.home_team)} ({displayValue(game.home_score, '0')})
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={() => onSelectSide('away')}
          style={[styles.sideChip, side === 'away' && styles.sideChipActive]}
        >
          <Text style={[styles.sideLabel, side === 'away' && styles.sideLabelActive]}>
            Away · {displayValue(game.away_team)} ({displayValue(game.away_score, '0')})
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Score macros</Text>
      <View style={styles.grid}>
        {SCORE_MACROS.map((macro) => (
          <Pressable
            key={macro.label}
            accessibilityRole="button"
            disabled={disabled}
            onPress={() => onAddPoints(macro.points)}
            style={({ pressed }) => [styles.scoreButton, (pressed || disabled) && styles.pressed]}
          >
            <Text style={styles.scoreLabel}>{macro.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Quarter / status</Text>
      <View style={styles.grid}>
        {GAME_STATUSES.map((status) => {
          const selected = (game.quarter ?? game.status) === status;
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              disabled={disabled}
              onPress={() => onSetStatus(status)}
              style={({ pressed }) => [
                styles.statusButton,
                selected && styles.statusButtonActive,
                (pressed || disabled) && styles.pressed,
              ]}
            >
              <Text style={[styles.statusLabel, selected && styles.statusLabelActive]}>
                {status}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sideRow: {
    gap: 8,
  },
  sideChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  sideChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sideLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  sideLabelActive: {
    color: colors.onAccent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scoreButton: {
    minWidth: 100,
    flexGrow: 1,
    paddingVertical: 16,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  scoreLabel: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  statusButton: {
    minWidth: 90,
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  statusLabelActive: {
    color: colors.onAccent,
  },
  pressed: {
    opacity: 0.88,
  },
});
