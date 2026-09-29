import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { displayValue, getPlayerFirstName, type Player } from '@/data/players';

type FanBackerBadgeProps = {
  player: Player;
};

export function FanBackerBadge({ player }: FanBackerBadgeProps) {
  const firstName = getPlayerFirstName(displayValue(player.name, 'Athlete'));
  const backerCount = displayValue(player.backer_count, '0');

  return (
    <View style={styles.badge} accessibilityRole="text">
      <Text style={styles.badgeLabel}>Fan Donor</Text>
      <Text style={styles.badgeText}>
        {backerCount} Fans Backed {firstName} Tonight
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'stretch',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 4,
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
});
