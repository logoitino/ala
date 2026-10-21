import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import type { Player } from '@/data/players';
import { fetchClaimedPlayerIds } from '@/lib/roster';
import { FOCAL } from '@/theme/motion';
import { JerseyBadge } from '@/components/UI/JerseyBadge';

type TeamRosterStripProps = {
  schoolName: string;
  players: Player[];
  activePlayerId: string;
  /** Athletes see Claimed / Unclaimed; fans only see the list. */
  showClaimBadges?: boolean;
  onOpenPlayer: (playerId: string) => void;
};

/**
 * @purpose Active Team Roster under Highlights — school teammates; athletes see Claimed vs Unclaimed.
 * @param schoolName Filter `players.school_name`.
 * @param showClaimBadges When true (`isAthlete`), load `profiles.player_id` claim map.
 * @sideEffects Optional `fetchClaimedPlayerIds`.
 */
export function TeamRosterStrip({
  schoolName,
  players,
  activePlayerId,
  showClaimBadges = false,
  onOpenPlayer,
}: TeamRosterStripProps) {
  const { isAthlete } = useAuth();
  const showBadges = showClaimBadges && isAthlete;
  const [claimed, setClaimed] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const school = schoolName.trim().toLowerCase();
    if (!school) return [];
    const filtered = players.filter((player) => player.school_name.trim().toLowerCase() === school);
    return [...filtered].sort((left, right) => {
      if (left.id === activePlayerId) return -1;
      if (right.id === activePlayerId) return 1;
      return (left.jersey_number ?? 0) - (right.jersey_number ?? 0) || left.name.localeCompare(right.name);
    });
  }, [activePlayerId, players, schoolName]);

  useEffect(() => {
    if (!showBadges || rows.length === 0) {
      setClaimed(new Set());
      return;
    }
    let active = true;
    void fetchClaimedPlayerIds(rows.map((row) => row.id)).then((next) => {
      if (active) setClaimed(next);
    });
    return () => {
      active = false;
    };
  }, [rows, showBadges]);

  if (rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Active Team Roster</Text>
      <Text style={styles.lede}>{schoolName}</Text>
      <View style={styles.list}>
        {rows.map((player) => {
          const isSelf = player.id === activePlayerId;
          const isClaimed = claimed.has(player.id);
          return (
            <AnimatedButton
              key={player.id}
              accessibilityLabel={`${player.name} jersey ${player.jersey_number ?? ''}`}
              haptic="selection"
              onPress={() => onOpenPlayer(player.id)}
              contentStyle={[styles.row, isSelf && styles.rowSelf]}
            >
              <View style={styles.jersey}>
                <JerseyBadge number={player.jersey_number ?? '—'} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>
                  {player.name}
                  {isSelf ? ' · you' : ''}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {player.position || 'Athlete'}
                </Text>
              </View>
              {showBadges ? (
                <View style={[styles.badge, isClaimed ? styles.badgeClaimed : styles.badgeOpen]}>
                  <Text style={[styles.badgeLabel, isClaimed ? styles.badgeClaimedLabel : styles.badgeOpenLabel]}>
                    {isClaimed ? 'Claimed' : 'Unclaimed'}
                  </Text>
                </View>
              ) : null}
            </AnimatedButton>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  lede: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: -4,
  },
  list: {
    gap: 6,
  },
  row: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowSelf: {
    borderColor: FOCAL.jadeInk,
    backgroundColor: FOCAL.mistJade,
  },
  jersey: {
    minWidth: 44,
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeClaimed: {
    backgroundColor: FOCAL.mistJade,
  },
  badgeOpen: {
    backgroundColor: FOCAL.mistSlate,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeClaimedLabel: {
    color: FOCAL.jadeInk,
  },
  badgeOpenLabel: {
    color: colors.textMuted,
  },
});
