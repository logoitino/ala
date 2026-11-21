/**
 * One athlete row in Local lists: jersey number, name, team, and a favorite star. Tapping opens the athlete.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, type Player } from '@/data/players';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

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
          <Text style={styles.backersLabel}>Supporters</Text>
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
            size={18}
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
    ...cardShadow,
  },
  main: {
    flexWrap: 'wrap',
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.92,
  },
  jerseyBadge: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: FOCAL.goldInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  jerseyNumber: {
    ...TYPE.title,
    ...figtree('800'),
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  name: {
    ...TYPE.section,
    ...figtree('700'),
    color: colors.text,
  },
  position: { ...figtree('400'),
    ...TYPE.body,
    color: colors.textMuted,
  },
  views: {
    ...TYPE.caption,
    ...figtree('700'),
    color: FOCAL.goldInk,
  },
  backers: {
    flexShrink: 1,
    maxWidth: '100%',
    alignItems: 'flex-end',
    gap: 2,
  },
  backersCount: {
    ...TYPE.title,
    ...figtree('800'),
    color: FOCAL.emberInk,
  },
  backersLabel: {
    ...TYPE.caption,
    ...figtree('600'),
    color: colors.textMuted,
  },
  favoriteButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
