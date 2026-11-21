/** UX-13 existing RivalryWeekBanner.tsx presentation keeps all actions/notices while aligning readable type. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SwipeableBannerWrapper } from '@/components/Common/SwipeableBannerWrapper';
import { radii } from '@/constants/theme';
import { featuredRivalryGame } from '@/data/regions';
import { FOCAL } from '@/theme/motion';
import type { Game } from '@/types/database';
import { TYPE, figtree } from '@/theme/fonts';

/** Stays dismissed for this app session, including after Highlights remounts. */
const dismissedRivalryIds = new Set<string>();

function teamName(team: string, school: string): string {
  return team.trim() || school.trim() || 'Local school';
}

/**
 * @purpose Home takeover for an active local rivalry, carrying fans from Highlights into the school poll.
 *   Swipe left or right to put it away for the rest of this visit.
 * @returns A compact rivalry CTA, or nothing when no active rivalry is available or the fan dismissed it.
 * @param game Home's existing live-game snapshot; no second Realtime subscription is opened.
 * @param onOpen Optional Home telemetry callback.
 * @sideEffects Navigation to Local polls. Light haptic on dismiss via `SwipeableBannerWrapper`.
 */
export function RivalryWeekBanner({ game, onOpen }: { game: Game | null; onOpen?: () => void }) {
  const router = useRouter();
  const rivalry = featuredRivalryGame(game ? [game] : []);
  const [hidden, setHidden] = useState(false);
  const rivalryId = rivalry?.id ?? null;

  if (!rivalry || !rivalryId || hidden || dismissedRivalryIds.has(rivalryId)) return null;

  const home = teamName(rivalry.home_team, rivalry.home_school);
  const away = teamName(rivalry.away_team, rivalry.away_school);

  return (
    <SwipeableBannerWrapper
      showClose={false}
      accessibilityLabel="Dismiss rivalry week"
      pressAccessibilityLabel={`Rivalry week, ${home} versus ${away}. Open school poll.`}
      onDismiss={() => {
        dismissedRivalryIds.add(rivalryId);
        setHidden(true);
      }}
      onPress={() => {
        onOpen?.();
        router.push('/local?hub=polls');
      }}
    >
      <View style={styles.root}>
        <View style={styles.icon}>
          <Ionicons name="flash" size={15} color={FOCAL.electricGold} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>Rivalry week</Text>
          <Text style={styles.matchup} numberOfLines={1}>
            {home} vs {away}
          </Text>
        </View>
        <Text style={styles.cta}>Cheer now</Text>
        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
      </View>
    </SwipeableBannerWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
    backgroundColor: 'rgba(8, 18, 14, 0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 208, 71, 0.16)',
  },
  copy: {
    flex: 1,
  },
  kicker: {
    color: FOCAL.electricGold,
    ...TYPE.caption,
    ...figtree('900'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  matchup: {
    color: '#FFFFFF',
    ...TYPE.body,
    ...figtree('800'),
  },
  cta: {
    color: '#FFFFFF',
    ...TYPE.caption,
    ...figtree('800'),
  },
});
