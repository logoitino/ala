/**
 * Local discovery scoreboard: recorded teams, sport and game state above the roster action.
 * Neutral letter tiles identify teams without pretending to be approved school crests.
 * @sideEffects Light haptic through AnimatedPressable; parent owns match navigation.
 */
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { gameScore, gameScoreboardStatus, gameTeamName } from '@/components/Local/gamePresentation';
import { cardShadow, colors, radii } from '@/constants/theme';
import { initialsForBusiness } from '@/data/sponsorships';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';
import type { Game, Sponsorship } from '@/types/database';

type GameCardProps = {
  game: Game;
  onPress: () => void;
  /** Silver+ booster logos tagged to this matchup's schools. */
  sponsors?: Sponsorship[];
};

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (name === 'Team TBA') return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Keep a team's full identity beside its own score on narrow game cards.
 * @returns A wrapping name and school with a separate, tabular score column.
 */
function TeamScoreRow({ name, school, side, score }: { name: string; school: string; side: string; score: string }) {
  const schoolName = school?.trim() ?? '';
  return (
    <View style={styles.teamRow}>
      <View style={styles.monogram} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.monogramLabel} maxFontSizeMultiplier={1.5}>{teamInitials(name)}</Text>
      </View>
      <View style={styles.teamIdentity}>
        <Text style={styles.side}>{side}</Text>
        <Text style={styles.teamName}>{name}</Text>
        {schoolName && schoolName.toLowerCase() !== name.toLowerCase() ? (
          <Text style={styles.school}>{schoolName}</Text>
        ) : null}
      </View>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

/**
 * @purpose Local matchup card with real game state and a scoreboard tied to each school.
 * @param game Recorded games row; missing scores stay unreported.
 * @param onPress Opens the in-tab match feed and rosters.
 * @param sponsors Silver+ booster logos tagged to this matchup.
 * @returns A Daylight card using Local's cyan accent and a jade roster action.
 * @sideEffects Light haptic via AnimatedPressable.
 */
export function GameCard({ game, onPress, sponsors = [] }: GameCardProps) {
  const home = gameTeamName(game.home_team, game.home_school);
  const away = gameTeamName(game.away_team, game.away_school);
  const status = gameScoreboardStatus(game);
  // Scheduled operator rows often contain default zeroes; those are not a game result.
  const homeScore = status.isScheduled ? '—' : gameScore(game.home_score);
  const awayScore = status.isScheduled ? '—' : gameScore(game.away_score);
  const sport = game.sport?.trim();
  // The card is one accessible button, so its label must include schools shown in its children.
  const accessibleScore = (name: string, school: string, score: string) => {
    const schoolName = school?.trim();
    const identity = schoolName && schoolName.toLowerCase() !== name.toLowerCase() ? `${name}, ${schoolName}` : name;
    return `${identity} ${score === '—' ? 'score not reported' : score}`;
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${sport ? `${sport}. ` : ''}${status.label}${status.detail ? `, ${status.detail}` : ''}. ${accessibleScore(home, game.home_school, homeScore)} against ${accessibleScore(away, game.away_school, awayScore)}. ${game.venue?.trim() || 'Venue TBA'}. View game, roster and donate.${sponsors.length ? ` Boosted by ${sponsors.slice(0, 4).map((sponsor) => sponsor.business_name).join(', ')}.` : ''}`}
      haptic="light"
      overshoot={false}
      scaleTo={0.97}
      onPress={onPress}
      contentStyle={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.sport}>{sport || 'Game day'}</Text>
        <View style={[styles.statusTag, status.isLive && styles.statusLive]}>
          <Text style={[styles.statusText, status.isLive && styles.statusLiveText]}>{status.label}</Text>
        </View>
      </View>
      {status.detail ? <Text style={styles.gameDetail}>{status.detail}</Text> : null}
      <View style={styles.scoreboard}>
        <TeamScoreRow name={home} school={game.home_school} side="Home" score={homeScore} />
        <View style={styles.scoreDivider} />
        <TeamScoreRow name={away} school={game.away_school} side="Away" score={awayScore} />
      </View>
      <Text style={styles.venue}>{game.venue?.trim() || 'Venue TBA'}</Text>
      <View style={styles.cta}>
        <Text style={styles.ctaLabel}>View game & roster</Text>
        <Text style={styles.ctaArrow} accessibilityElementsHidden importantForAccessibility="no">↗</Text>
      </View>
      {sponsors.length > 0 ? (
        <View style={styles.sponsorRow}>
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: TAB_ACCENTS.local.color,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sport: {
    color: TAB_ACCENTS.local.color,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  statusTag: {
    borderRadius: radii.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: FOCAL.mistSlate,
  },
  statusLive: { backgroundColor: FOCAL.mistEmber },
  statusText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  statusLiveText: { color: FOCAL.emberInk },
  gameDetail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scoreboard: { gap: 12 },
  teamRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  monogram: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: FOCAL.mistSlate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '900' },
  // Large scores must wrap before they squeeze the team name into single-letter lines.
  teamIdentity: { flex: 1, minWidth: 100, gap: 3 },
  side: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  teamName: { color: colors.text, fontSize: 17, fontWeight: '900', flexShrink: 1 },
  school: { color: colors.textMuted, fontSize: 12 },
  score: { color: colors.text, fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'], textAlign: 'right', marginLeft: 'auto', maxWidth: '100%' },
  scoreDivider: { height: 1, backgroundColor: colors.border },
  venue: { color: colors.textMuted, fontSize: 12 },
  cta: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.mistJade,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ctaLabel: { color: FOCAL.jadeInk, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  ctaArrow: { color: FOCAL.jadeInk, fontSize: 19, fontWeight: '800' },
  sponsorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sponsorCaption: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginRight: 2 },
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
  sponsorImage: { width: 28, height: 28 },
  sponsorInitials: { color: FOCAL.goldInk, fontSize: 9, fontWeight: '800' },
});
