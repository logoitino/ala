/**
 * UX-19: shadow instead of border (live keeps its ember outline), HOME/AWAY on the team line, venue + boosters on one row.
 * Compact Local discovery scoreboard: the entire card opens the game; a small arrow marks that action.
 * UX-12: readable name/body hierarchy with smaller decorative tiles and the same content-led card.
 * Neutral letter tiles identify teams without pretending to be approved school crests.
 * Booster logos display through `mediaUri` (legacy full URL or `sb:` reference, SCALE-02); no logo shows initials.
 * Live and scheduled share the same Daylight surface; live only adds an ember LIVE pill (no night card).
 * @sideEffects Light haptic through AnimatedPressable; parent owns match navigation.
 */
import { Image, StyleSheet, Text, View } from 'react-native';

import { SportIcon } from '@/components/UI/SportIcon';
import { SportField } from '@/components/Effects/SportField';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { gameScore, gameScoreboardStatus, gameTeamName } from '@/components/Local/gamePresentation';
import { cardShadow, colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { initialsForBusiness } from '@/data/sponsorships';
import { mediaUri } from '@/lib/media';
import { FOCAL } from '@/theme/motion';
import { figtree, TYPE } from '@/theme/fonts';
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
        <View style={styles.nameRow}>
          <Text style={styles.side}>{side}</Text>
          <Text style={styles.teamName}>{name}</Text>
        </View>
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
 * @returns A Daylight card with jade primary and an ember LIVE pill when the match is live.
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
  const live = status.isLive;
  // The card is one accessible button, so its label must include schools shown in its children.
  const accessibleScore = (name: string, school: string, score: string) => {
    const schoolName = school?.trim();
    const identity = schoolName && schoolName.toLowerCase() !== name.toLowerCase() ? `${name}, ${schoolName}` : name;
    return `${identity} ${score === '—' ? 'score not reported' : score}`;
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${sport ? `${sport}. ` : ''}${status.label}${status.detail ? `, ${status.detail}` : ''}. ${accessibleScore(home, game.home_school, homeScore)} against ${accessibleScore(away, game.away_school, awayScore)}. ${game.venue?.trim() || 'Venue TBA'}. View game, roster and give.${sponsors.length ? ` Boosted by ${sponsors.slice(0, 4).map((sponsor) => sponsor.business_name).join(', ')}.` : ''}`}
      haptic="light"
      overshoot={false}
      scaleTo={0.97}
      onPress={onPress}
      contentStyle={[styles.card, live && styles.cardLive]}
    >
      {/* UX-08: the game's surface, clipped in its own layer so the card keeps its iOS shadow. */}
      <View pointerEvents="none" style={styles.fieldLayer}>
        <SportField sport={sport} opacity={0.08} />
      </View>
      <View style={styles.topRow}>
        <View style={styles.sportBadge}>
          <SportIcon sport={sport} size={16} color={colors.primary} />
          <Text style={styles.sport}>{sport || 'Game day'}</Text>
        </View>
        <View style={[styles.statusTag, live && styles.statusLive]}>
          {live ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.statusText, live && styles.statusLiveText]}>{status.label}</Text>
        </View>
      </View>
      {status.detail ? <Text style={styles.gameDetail}>{status.detail}</Text> : null}
      <View style={styles.scoreboard}>
        <TeamScoreRow name={home} school={game.home_school} side="Home" score={homeScore} />
        <View style={styles.scoreDivider} />
        <TeamScoreRow name={away} school={game.away_school} side="Away" score={awayScore} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.venue}>{game.venue?.trim() || 'Venue TBA'}</Text>
      {sponsors.length > 0 ? (
        <View style={styles.sponsorRow}>
          <Text style={styles.sponsorCaption}>Boosted by</Text>
          {sponsors.slice(0, 4).map((sponsor) => {
            const logo = mediaUri(sponsor.logo_url);
            return (
              <View key={sponsor.id} style={styles.sponsorLogo}>
                {logo ? (
                  <Image source={{ uri: logo }} style={styles.sponsorImage} />
                ) : (
                  <Text style={styles.sponsorInitials}>{initialsForBusiness(sponsor.business_name)}</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
        <Text style={styles.ctaArrow} accessibilityElementsHidden importantForAccessibility="no">↗</Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    minHeight: 44,
    padding: 12,
    gap: 6,
    ...cardShadow,
  },
  /** Live stays on Daylight; only the status pill flips to ember. */
  cardLive: { borderColor: FOCAL.ember, borderWidth: 1.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  sportBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, maxWidth: '100%' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sport: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('900'),
    letterSpacing: 1,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: FOCAL.mistSlate,
  },
  statusLive: { backgroundColor: FOCAL.ember },
  statusText: { color: colors.textMuted, ...TYPE.caption, ...figtree('800') },
  statusLiveText: { color: '#FFFFFF', letterSpacing: 0.4 },
  gameDetail: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('700'),
    fontVariant: ['tabular-nums'],
  },
  scoreboard: { gap: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  monogram: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: FOCAL.mistSlate,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLabel: { color: colors.textMuted, ...TYPE.body, ...figtree('900') },
  // Large scores must wrap before they squeeze the team name into single-letter lines.
  teamIdentity: { flex: 1, minWidth: 100, gap: 2 },
  // UX-19: HOME/AWAY rides on the team line, saving a row per team.
  nameRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  // UX-19: venue, boosters and the open arrow share one row.
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  side: { color: colors.textMuted, ...TYPE.caption, ...figtree('700'), textTransform: 'uppercase', letterSpacing: 0.4 },
  teamName: { color: colors.text, ...TYPE.section, ...figtree('900'), flexShrink: 1 },
  school: { color: colors.textMuted, ...TYPE.caption, ...figtree('400') },
  score: { ...SCOREBOARD_DIGITS, color: colors.text, fontSize: 28, textAlign: 'right', marginLeft: 'auto', maxWidth: '100%' },
  fieldLayer: { ...StyleSheet.absoluteFill, borderRadius: radii.lg, overflow: 'hidden' },
  scoreDivider: { height: 1, backgroundColor: colors.border },
  // Review I3: a real basis lets boosters wrap below instead of squeezing the venue into a letter column.
  venue: { color: colors.textMuted, ...TYPE.caption, ...figtree('500'), flexGrow: 1, flexShrink: 1, flexBasis: 140 },
  ctaArrow: { color: FOCAL.jadeInk, fontSize: 17, ...figtree('800'), marginLeft: 'auto' },
  sponsorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sponsorCaption: { color: colors.textMuted, ...TYPE.caption, ...figtree('700'), marginRight: 2 },
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
  sponsorInitials: { color: FOCAL.goldInk, fontSize: 9, ...figtree('800') },
});
