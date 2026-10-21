import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, radii, space, SCOREBOARD_DIGITS } from '@/constants/theme';
import { filmerTier, nextFilmerTierHint, type FilmerStats } from '@/lib/filmers';
import { formatCompactCount } from '@/lib/hype';
import { FOCAL } from '@/theme/motion';

type FilmerCardProps = {
  stats: FilmerStats | null;
  /** The signed-in fan's own card: shows the "film a play" invite before their first clip. */
  own?: boolean;
  onFilm?: () => void;
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{formatCompactCount(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * @purpose "🎥 Filmer" card: tier, clips the athletes confirmed, their views / hype / Props, and Aura
 *   earned from filming. Credit only — filmers never get a share of an athlete's Mālo.
 * @param stats `filmer_stats`; the card renders nothing when null, or when zero clips and not `own`.
 */
export function FilmerCard({ stats, own = false, onFilm }: FilmerCardProps) {
  if (!stats) return null;
  const tier = filmerTier(stats);

  if (!tier) {
    if (!own) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>🎥 Filmer</Text>
        <Text style={styles.title}>Film a teammate’s play</Text>
        <Text style={styles.lede}>
          Every clip you post helps a family’s athlete get seen and supported. Tag who’s in it — when they confirm,
          you earn Aura and a Filmer badge.
        </Text>
        {onFilm ? (
          <AnimatedButton haptic="selection" onPress={onFilm} style={styles.cta} accessibilityLabel="Post a highlight">
            <Text style={styles.ctaLabel}>Post a highlight</Text>
          </AnimatedButton>
        ) : null}
      </View>
    );
  }

  const hint = nextFilmerTierHint(stats);
  return (
    <View style={styles.card} accessibilityLabel={`${tier.label}. ${stats.clips} clips, ${stats.views} views`}>
      <View style={styles.header}>
        <Text style={styles.kicker}>🎥 Filmer</Text>
        <View style={styles.tierChip}>
          <Text style={styles.tierLabel}>{tier.label}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Stat value={stats.clips} label={stats.clips === 1 ? 'clip' : 'clips'} />
        <Stat value={stats.views} label="views" />
        <Stat value={stats.hype} label="hype" />
        <Stat value={stats.props} label="Props" />
      </View>
      {stats.auraEarned > 0 ? (
        <Text style={styles.aura}>+{stats.auraEarned.toLocaleString()} Aura earned from filming</Text>
      ) : null}
      {own && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: space.md,
    gap: 10,
    ...cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  tierChip: {
    backgroundColor: FOCAL.jadeInk,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...SCOREBOARD_DIGITS,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  aura: {
    color: FOCAL.jadeInk,
    fontSize: 13,
    fontWeight: '800',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  cta: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: FOCAL.jadeInk,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
