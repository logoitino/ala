import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { displayValue, formatQuarterClock, isGameClockLive } from '@/data/players';
import { FOCAL } from '@/theme/motion';
import { initialsForBusiness } from '@/data/sponsorships';
import type { Game, Sponsorship } from '@/types/database';

type GameCardProps = {
  game: Game;
  onPress: () => void;
  /** Silver+ booster logos tagged to this matchup's schools. */
  sponsors?: Sponsorship[];
};

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase();
}

/**
 * @purpose Local matchup card: live chip, score, school names, Mālo CTA. Press opens `/local/game/[id]`.
 * @param game Live `games` row.
 * @param onPress Opens the in-tab match sheet.
 * @param sponsors Silver+ booster logos tagged to this matchup.
 * @returns Gold-mist scoreboard with a jade roster CTA.
 * @sideEffects Light haptic via `AnimatedPressable`.
 */
export function GameCard({ game, onPress, sponsors = [] }: GameCardProps) {
  const home = displayValue(game.home_team);
  const away = displayValue(game.away_team);
  const homeScore = displayValue(game.home_score, '0');
  const awayScore = displayValue(game.away_score, '0');
  const live = isGameClockLive(game);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${home} ${homeScore} against ${away} ${awayScore}. View roster and drop a Mālo.`}
      haptic="light"
      overshoot={false}
      scaleTo={0.97}
      onPress={onPress}
      contentStyle={styles.card}
    >
      <View style={styles.topRow}>
        <View style={[styles.statusTag, live ? styles.statusLive : styles.statusIdle]}>
          <Text style={styles.statusText}>{formatQuarterClock(game)}</Text>
        </View>
        <Text style={styles.venue} numberOfLines={1}>
          {displayValue(game.venue, 'Stadium TBA')}
        </Text>
      </View>

      <View style={styles.scoreboard}>
        <View style={styles.teamCol}>
          <View style={[styles.logo, styles.homeLogo]}>
            <Text style={[styles.logoLabel, styles.homeLogoLabel]}>{teamInitials(home)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {home}
          </Text>
          <Text style={styles.school} numberOfLines={1}>
            {displayValue(game.home_school)}
          </Text>
        </View>

        <View style={styles.scoreCol}>
          <Text style={styles.scoreLine}>
            {homeScore} – {awayScore}
          </Text>
        </View>

        <View style={styles.teamCol}>
          <View style={[styles.logo, styles.awayLogo]}>
            <Text style={styles.logoLabel}>{teamInitials(away)}</Text>
          </View>
          <Text style={styles.teamName} numberOfLines={2}>
            {away}
          </Text>
          <Text style={styles.school} numberOfLines={1}>
            {displayValue(game.away_school)}
          </Text>
        </View>
      </View>

      <Text style={styles.scoreCaption}>
        {home} {homeScore} - {away} {awayScore}
      </Text>

      <View style={styles.cta}>
        <Text style={styles.ctaLabel}>View Roster & Drop Mālo</Text>
      </View>
      {sponsors.length > 0 ? (
        <View style={styles.sponsorRow} accessibilityRole="summary">
          <Text style={styles.sponsorCaption}>Boosted by</Text>
          {sponsors.slice(0, 4).map((sponsor) => (
            <View key={sponsor.id} style={styles.sponsorLogo}>
              {sponsor.logo_url ? (
                <Image source={{ uri: sponsor.logo_url }} style={styles.sponsorImage} />
              ) : (
                <Text style={styles.sponsorInitials}>{initialsForBusiness(sponsor.business_name)}</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    padding: 16,
    gap: 14,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusLive: {
    backgroundColor: FOCAL.ember,
  },
  statusIdle: {
    backgroundColor: FOCAL.jadeInk,
  },
  statusText: {
    color: colors.onAccent,
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
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeLogo: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: FOCAL.jadeInk,
  },
  awayLogo: {
    backgroundColor: FOCAL.mistCyan,
    borderWidth: 2,
    borderColor: FOCAL.cyanInk,
  },
  logoLabel: {
    color: FOCAL.cyanInk,
    fontSize: 18,
    fontWeight: '800',
  },
  homeLogoLabel: {
    color: FOCAL.jadeInk,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  school: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  scoreCol: {
    minWidth: 88,
    alignItems: 'center',
    gap: 4,
  },
  scoreLine: {
    fontSize: 22,
    fontWeight: '800',
    color: FOCAL.goldInk,
    letterSpacing: -0.4,
  },
  scoreCaption: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  cta: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sponsorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sponsorCaption: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 2,
  },
  sponsorLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    backgroundColor: FOCAL.mistGold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sponsorImage: {
    width: 28,
    height: 28,
  },
  sponsorInitials: {
    color: FOCAL.goldInk,
    fontSize: 9,
    fontWeight: '800',
  },
});
