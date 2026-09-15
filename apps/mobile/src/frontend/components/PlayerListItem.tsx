import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, type Player } from '@/data/players';
import { FOCAL } from '@/theme/motion';

type PlayerListItemProps = {
  player: Player;
  onPress: () => void;
  favorited?: boolean;
  onToggleFavorite?: () => void;
};

export function PlayerListItem({
  player,
  onPress,
  favorited = false,
  onToggleFavorite,
}: PlayerListItemProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.cardPressed]}
      >
        <View style={styles.jerseyBadge}>
          <Text style={styles.jerseyNumber}>#{displayValue(player.jersey_number)}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{displayValue(player.name, 'Unknown player')}</Text>
          <Text style={styles.position}>{displayValue(player.position)}</Text>
          <Text style={styles.views}>
            {displayValue(player.view_count, '0')} highlight views
          </Text>
        </View>

        <View style={styles.backers}>
          <Text style={styles.backersCount}>{displayValue(player.backer_count, '0')}</Text>
          <Text style={styles.backersLabel}>Backers</Text>
        </View>
      </Pressable>
      {onToggleFavorite ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
          hitSlop={8}
          onPress={onToggleFavorite}
          style={styles.favoriteButton}
        >
          <Ionicons
            name={favorited ? 'star' : 'star-outline'}
            size={22}
            color={favorited ? FOCAL.ember : colors.textMuted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    ...cardShadow,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.92,
  },
  jerseyBadge: {
    minWidth: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: FOCAL.goldInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  jerseyNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  position: {
    fontSize: 14,
    color: colors.textMuted,
  },
  views: {
    fontSize: 12,
    fontWeight: '700',
    color: FOCAL.goldInk,
  },
  backers: {
    alignItems: 'flex-end',
    gap: 2,
  },
  backersCount: {
    fontSize: 18,
    fontWeight: '800',
    color: FOCAL.emberInk,
  },
  backersLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  favoriteButton: {
    paddingLeft: 4,
  },
});
