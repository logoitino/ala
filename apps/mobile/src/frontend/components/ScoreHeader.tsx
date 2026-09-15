import { StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { cardShadow, colors, radii } from '@/constants/theme';
import {
  displayValue,
  formatQuarterClock,
  isGameClockLive,
  parseClockToSeconds,
} from '@/data/players';
import { isSupabaseConfigured, nextRealtimeTopic, supabase } from '@/lib/supabase';
import { FOCAL } from '@/theme/motion';
import type { Game } from '@/types/database';
import { useEffect, useRef, useState } from 'react';

type ScoreHeaderProps = {
  gameId?: string;
  game?: Game | null;
  onPress?: () => void;
};

const DEFAULT_CLOCK = 4 * 60 + 15;

/**
 * @purpose Local / game scoreboard chrome on gold mist with Ember LIVE and gold score — matches Spotlight award energy.
 */
export function ScoreHeader({ gameId, game: seed, onPress }: ScoreHeaderProps) {
  const [game, setGame] = useState<Game | null>(seed ?? null);
  const [remaining, setRemaining] = useState(() =>
    parseClockToSeconds(seed?.clock) ?? DEFAULT_CLOCK,
  );
  const liveRef = useRef(isGameClockLive(seed ?? { status: 'live' }));

  useEffect(() => {
    if (seed) {
      setGame(seed);
      setRemaining(parseClockToSeconds(seed.clock) ?? DEFAULT_CLOCK);
      liveRef.current = isGameClockLive(seed);
    }
  }, [seed]);

  useEffect(() => {
    const id = gameId ?? seed?.id;
    if (!id || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(nextRealtimeTopic(`score_header_${id}`))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `id=eq.${id}` },
        (payload) => {
          if (!payload.new) return;
          const next = payload.new as Game;
          setGame(next);
          liveRef.current = isGameClockLive(next);
          const clock = parseClockToSeconds(next.clock);
          if (clock != null) setRemaining(clock);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, seed?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!liveRef.current) return;
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!game) return null;

  const clockLabel = formatQuarterClock(game, remaining);
  const live = isGameClockLive(game);
  const Shell = onPress ? Pressable : View;

  return (
    <Shell
      {...(onPress
        ? {
            accessibilityRole: 'button' as const,
            onPress,
          }
        : {})}
      style={styles.banner}
    >
      <View style={styles.topRow}>
        <View style={[styles.livePill, live ? styles.livePillOn : styles.livePillIdle]}>
          <View style={[styles.dot, !live && styles.dotIdle]} />
          <Text style={[styles.liveText, live && styles.liveTextOn]}>{clockLabel}</Text>
        </View>
        <Text style={styles.venue} numberOfLines={1}>
          {displayValue(game.venue)}
        </Text>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.team}>
          <Text style={styles.teamLabel}>HOME</Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {displayValue(game.home_team)}
          </Text>
        </View>
        <Text style={styles.score}>
          {displayValue(game.home_score, '0')}
          <Text style={styles.scoreDash}>  –  </Text>
          {displayValue(game.away_score, '0')}
        </Text>
        <View style={[styles.team, styles.teamRight]}>
          <Text style={styles.teamLabel}>AWAY</Text>
          <Text style={styles.teamName} numberOfLines={1}>
            {displayValue(game.away_team)}
          </Text>
        </View>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  livePillOn: {
    backgroundColor: FOCAL.mistEmber,
    borderColor: FOCAL.ember,
  },
  livePillIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FOCAL.ember,
  },
  dotIdle: {
    backgroundColor: colors.textMuted,
  },
  liveText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  liveTextOn: {
    color: FOCAL.emberInk,
  },
  venue: {
    flex: 1,
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  team: {
    flex: 1,
    gap: 2,
  },
  teamRight: {
    alignItems: 'flex-end',
  },
  teamLabel: {
    color: FOCAL.goldInk,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  teamName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  score: {
    color: FOCAL.goldInk,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  scoreDash: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
