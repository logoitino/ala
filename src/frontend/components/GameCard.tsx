import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, formatQuarterClock } from '@/data/players';
import type { Game } from '@/types/database';

type GameCardProps = {
  game: Game;
  onPress: () => void;
};

export function GameCard({ game, onPress }: GameCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.statusTag}>
          <Text style={styles.statusText}>{formatQuarterClock(game)}</Text>
        </View>
        <Text style={styles.venue} numberOfLines={1}>
          {displayValue(game.venue)}
        </Text>
      </View>

      <Text style={styles.matchup}>
        {displayValue(game.home_team)} vs {displayValue(game.away_team)}
      </Text>
      <Text style={styles.schools} numberOfLines={1}>
        {displayValue(game.home_school)} · {displayValue(game.away_school)}
      </Text>
      <Text style={styles.score}>
        {displayValue(game.home_team)} {displayValue(game.home_score, '0')} -{' '}
        {displayValue(game.away_team)} {displayValue(game.away_score, '0')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    ...cardShadow,
  },
  pressed: {
    opacity: 0.92,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusTag: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  venue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  matchup: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  schools: {
    fontSize: 13,
    color: colors.textMuted,
  },
  score: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
