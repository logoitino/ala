/** Compact Spotlight award rows keep readable names, award-gold field lines and jersey patches.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { CardShine } from '@/components/Effects/CardShine';
import { SportField } from '@/components/Effects/SportField';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { JerseyBadge } from '@/components/UI/JerseyBadge';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { auraBadgeLabel, auraTierForPoints, resolveAuraPoints } from '@/lib/aura';
import { spotlightBadgeLabel, spotlightWindowLabel } from '@/lib/spotlight';
import { FOCAL } from '@/theme/motion';
import type { SpotlightAward } from '@/types/database';
import { TYPE, figtree } from '@/theme/fonts';

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
  const jersey = featured ? award.player?.jersey_number : null;

  return (
    <AnimatedButton
      accessibilityLabel={`${label}. ${name}. ${award.headline}. Open Spotlight.`}
      haptic="medium"
      style={styles.hit}
      contentStyle={[styles.card, featured && styles.featured]}
      onPress={onPress}
    >
      {/* UX-08: awards carry no sport, so the featured card gets the generic field, in award gold. */}
      {featured ? <SportField color={FOCAL.goldInk} opacity={0.1} /> : null}
      {featured ? <CardShine loopMs={3400} width={60} tint={`${FOCAL.electricGold}80`} /> : null}
      {/* Only the featured card with a jersey number makes room for the patch; other rows keep their spacing. */}
      <View style={jersey != null && styles.portraitStage}>
        <View
          style={[
            styles.portrait,
            { borderColor: featured ? FOCAL.electricGold : tier.color, backgroundColor: featured ? FOCAL.mistGold : `${tier.color}1A` },
          ]}
        >
          <View pointerEvents="none" style={styles.portraitGloss} />
          <Text style={[styles.initials, { color: featured ? FOCAL.goldInk : tier.ink }]}>{initialsFor(name)}</Text>
        </View>
        {jersey != null ? (
          <JerseyBadge number={jersey} color={FOCAL.electricGold} ink={FOCAL.goldInk} style={styles.jerseyPatch} />
        ) : null}
      </View>
      {featured ? (
        <View style={styles.crown}>
          <Ionicons name="trophy" size={14} color={FOCAL.goldInk} accessible={false} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.kicker, featured && styles.kickerFeatured]}>
          {label}
        </Text>
        <Text style={styles.name}>
          {name}
        </Text>
        <Text style={styles.headline}>
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
    minHeight: 80,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    backgroundColor: FOCAL.mistGold,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
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
  portraitStage: {
    paddingBottom: 12,
  },
  jerseyPatch: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
  },
  portrait: {
    minWidth: 40,
    minHeight: 40,
    padding: 4,
    borderRadius: 20,
    borderWidth: 2.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  portraitGloss: {
    position: 'absolute',
    top: -16,
    left: -12,
    width: 54,
    height: 36,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-18deg' }],
  },
  crown: {
    position: 'absolute',
    top: -6,
    left: 38,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: FOCAL.mistGold,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.electricGold,
        shadowOpacity: 0.5,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 4 },
      default: { boxShadow: `0px 0px 6px ${FOCAL.electricGold}` },
    }),
  },
  initials: {
    ...TYPE.title,
    ...figtree('800'),
    letterSpacing: 0.6,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  kicker: {
    color: FOCAL.goldInk,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.5,
  },
  kickerFeatured: {
    color: FOCAL.emberInk,
  },
  name: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  headline: {
    color: FOCAL.goldInk,
    ...TYPE.body,
    ...figtree('700'),
  },
  tier: {
    ...TYPE.caption,
    ...figtree('800'),
  },
});
