import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { colors, radii } from '@/constants/theme';
import {
  SCORER_ACTIONS,
  displayValue,
  type Player,
  type ScorerAction,
} from '@/data/players';

type ScorerControlsProps = {
  players: Player[];
  selectedPlayerId: string;
  sending?: boolean;
  onSelectPlayer: (playerId: string) => void;
  onAction: (action: ScorerAction, player: Player) => void;
  onPushLiveAlert: (player: Player) => void;
};

export function ScorerControls({
  players,
  selectedPlayerId,
  sending = false,
  onSelectPlayer,
  onAction,
  onPushLiveAlert,
}: ScorerControlsProps) {
  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ?? players[0] ?? null;

  if (!selectedPlayer) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No players available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Player #</Text>
      <View style={styles.choiceList}>
        {players.map((player) => {
          const selected = player.id === selectedPlayer.id;
          return (
            <Pressable
              key={player.id}
              accessibilityRole="button"
              onPress={() => onSelectPlayer(player.id)}
              style={[styles.choice, selected && styles.choiceActive]}
            >
              <Text style={[styles.choiceLabel, selected && styles.choiceLabelActive]}>
                #{displayValue(player.jersey_number)} — {displayValue(player.name)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Actions</Text>
      <View style={styles.actionGrid}>
        {SCORER_ACTIONS.map((action) => (
          <Pressable
            key={action}
            accessibilityRole="button"
            disabled={sending}
            onPress={() => onAction(action, selectedPlayer)}
            style={({ pressed }) => [
              styles.actionButton,
              (pressed || sending) && styles.pressed,
            ]}
          >
            <Text style={styles.actionLabel}>{action}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={sending}
        onPress={() => onPushLiveAlert(selectedPlayer)}
        style={({ pressed }) => [
          styles.alertButton,
          (pressed || sending) && styles.pressed,
        ]}
      >
        <Text style={styles.alertLabel}>Push Live Alert</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  choiceList: {
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
  },
  choiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  choiceLabelActive: {
    color: colors.onAccent,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    minWidth: 140,
    flexGrow: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  actionLabel: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '700',
  },
  alertButton: {
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  alertLabel: {
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
  },
});
