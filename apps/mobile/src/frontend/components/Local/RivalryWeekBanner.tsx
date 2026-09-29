import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { radii } from '@/constants/theme';
import { featuredRivalryGame } from '@/data/regions';
import { FOCAL } from '@/theme/motion';
import type { Game } from '@/types/database';

function teamName(team: string, school: string): string {
  return team.trim() || school.trim() || 'Local school';
}

/**
 * @purpose Home takeover for an active local rivalry, carrying fans from Highlights into the school poll.
 * @returns A compact rivalry CTA, or nothing when no active rivalry is available.
 * @param game Home's existing live-game snapshot; no second Realtime subscription is opened.
 * @param onOpen Optional Home telemetry callback.
 * @sideEffects Navigation to Local polls.
 */
export function RivalryWeekBanner({ game, onOpen }: { game: Game | null; onOpen?: () => void }) {
  const router = useRouter();
  const rivalry = featuredRivalryGame(game ? [game] : []);

  if (!rivalry) return null;

  const home = teamName(rivalry.home_team, rivalry.home_school);
  const away = teamName(rivalry.away_team, rivalry.away_school);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rivalry week, ${home} versus ${away}. Open school poll.`}
      onPress={() => {
        onOpen?.();
        router.push('/local?hub=polls');
      }}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
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
    </Pressable>
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
  pressed: {
    opacity: 0.84,
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  matchup: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cta: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
