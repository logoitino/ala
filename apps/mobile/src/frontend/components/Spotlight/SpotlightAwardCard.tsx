import { Platform, StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { auraBadgeLabel, auraTierForPoints, resolveAuraPoints } from '@/lib/aura';
import { spotlightBadgeLabel, spotlightWindowLabel } from '@/lib/spotlight';
import { FOCAL } from '@/theme/motion';
import type { SpotlightAward } from '@/types/database';

type SpotlightAwardCardProps = {
  award: SpotlightAward;
  featured?: boolean;
  onPress: () => void;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Spotlight tab row on a gold mist face with Ember / Electric Gold accents. Featured cards glow gold.
 * @param award Normalized Player of the Week/Month payload.
 * @param featured Larger This-week card at the top of the board.
 * @param onPress Reopens `SpotlightModal` (does not depend on the launch dismiss key).
 */
export function SpotlightAwardCard({ award, featured = false, onPress }: SpotlightAwardCardProps) {
  const name = displayValue(award.player?.name, 'Spotlight athlete');
  const tier = auraTierForPoints(award.player ? resolveAuraPoints(award.player) : 0);
  const label = featured ? spotlightBadgeLabel(award) : spotlightWindowLabel(award);

  return (
    <AnimatedButton
      accessibilityLabel={`${label}. ${name}. ${award.headline}. Open Spotlight.`}
      haptic="medium"
      style={styles.hit}
      contentStyle={[styles.card, featured && styles.featured]}
      onPress={onPress}
    >
      <View style={[styles.portrait, { borderColor: featured ? FOCAL.electricGold : tier.color }]}>
        <Text style={[styles.initials, { color: featured ? FOCAL.goldInk : tier.ink }]}>{initialsFor(name)}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.kicker, featured && styles.kickerFeatured]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.headline} numberOfLines={2}>
          {award.headline}
        </Text>
        <Text style={[styles.tier, { color: tier.ink }]}>{auraBadgeLabel(tier)}</Text>
      </View>
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: '100%',
  },
  card: {
    minHeight: 96,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    backgroundColor: FOCAL.mistGold,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featured: {
    borderColor: FOCAL.electricGold,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.electricGold,
        shadowOpacity: 0.4,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
      default: { boxShadow: `0px 0px 18px ${FOCAL.electricGold}` },
    }),
  },
  portrait: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  kicker: {
    color: FOCAL.goldInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kickerFeatured: {
    color: FOCAL.emberInk,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headline: {
    color: FOCAL.goldInk,
    fontSize: 14,
    fontWeight: '700',
  },
  tier: {
    fontSize: 11,
    fontWeight: '800',
  },
});
