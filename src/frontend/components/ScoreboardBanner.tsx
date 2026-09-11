import { StyleSheet, Text, View } from 'react-native';

import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, formatGameStatus } from '@/data/players';
import type { Game } from '@/types/database';

type ScoreboardBannerProps = {
  game: Game;
};

export function ScoreboardBanner({ game }: ScoreboardBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.statusTag}>
        <Text style={styles.statusText}>{formatGameStatus(game)}</Text>
      </View>
      <View style={styles.scoreRow}>
        <View style={styles.teamCol}>
          <Text style={styles.teamName}>{displayValue(game.home_team)}</Text>
          <Text style={styles.school}>{displayValue(game.home_school)}</Text>
        </View>
        <Text style={styles.score}>
          {displayValue(game.home_score, '0')}
          <Text style={styles.scoreDivider}> - </Text>
          {displayValue(game.away_score, '0')}
        </Text>
        <View style={[styles.teamCol, styles.teamRight]}>
          <Text style={styles.teamName}>{displayValue(game.away_team)}</Text>
          <Text style={styles.school}>{displayValue(game.away_school)}</Text>
        </View>
      </View>
      <Text style={styles.venue}>{displayValue(game.venue)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  statusTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamCol: {
    flex: 1,
    gap: 2,
  },
  teamRight: {
    alignItems: 'flex-end',
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  school: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  score: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  scoreDivider: {
    fontSize: 22,
    fontWeight: '600',
  },
  venue: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
