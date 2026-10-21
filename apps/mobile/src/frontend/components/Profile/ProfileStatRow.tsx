/**
 * The count row under the athlete hero: Seki, Riding, Crew and Squad, with the Join control under Crew
 * and the pulsing Teammates badge for a mutual follow (split out of AthleteProfileView.tsx for R4-03; behaviour unchanged).
 * The parent passes peak Seki / Flex; Crew and Squad come from `useCrew`, and Join goes through the soft wall.
 * @sideEffects `useCrew` RPC and toggle; SoftWall on Join.
 */
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import {
  CREW_COUNTER_LABEL,
  IN_CREW_LABEL,
  JOIN_CREW_LABEL,
  SQUAD_COUNTER_LABEL,
  TEAMMATES_BADGE,
} from '@/data/crew';
import { useCrew } from '@/hooks/useCrew';
import { formatCompactCount } from '@/lib/hype';
import type { Player } from '@/types/database';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Seki, Riding, Crew, and Squad as separate counts. Join sits under Crew only.
 * @param player Athlete whose Crew graph we load.
 * @param sekiCount Peak Seki on this athlete.
 * @param flexCount Peak Flex on this athlete.
 * @param showCrew When false, the Crew column is omitted.
 * @sideEffects `useCrew` RPC; SoftWall on Join.
 */
export function ProfileStatRow({
  player,
  sekiCount,
  flexCount,
  showCrew,
}: {
  player: Player;
  sekiCount: number;
  flexCount: number;
  showCrew: boolean;
}) {
  const { profile } = useAuth();
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const crew = useCrew(player.id);
  const isOwn = Boolean(profile?.player_id && profile.player_id === player.id);

  const onJoin = () => {
    requireAuth({
      kind: 'crew',
      athleteName: player.name,
      athleteId: player.id,
      resume: () => {
        void crew.toggle();
      },
    });
  };

  const showJoin = showCrew && live.buttons.crew && !isOwn;

  const join = showJoin ? (
    crew.mutual ? (
      <TeammatesBadge onPress={onJoin} disabled={crew.busy} compact />
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={crew.following ? IN_CREW_LABEL : JOIN_CREW_LABEL}
        accessibilityState={{ disabled: crew.busy, selected: crew.following }}
        disabled={crew.busy}
        haptic="medium"
        hitSlop={6}
        onPress={onJoin}
        style={[styles.joinIcon, crew.following && styles.joinIconOn]}
      >
        <Ionicons
          name={crew.following ? 'checkmark' : 'flash'}
          size={18}
          color={crew.following ? FOCAL.jadeInk : '#FFFFFF'}
        />
      </Pressable>
    )
  ) : null;

  return (
    <View style={styles.statRow}>
      <ProfileCount value={sekiCount} label="Seki" color={FOCAL.cyanInk} accessibilityLabel={`${formatCompactCount(sekiCount)} Seki`} reserveAction={showJoin} />
      <ProfileCount value={flexCount} label="Riding" color={FOCAL.goldInk} accessibilityLabel={`${formatCompactCount(flexCount)} riding with ${player.name}`} reserveAction={showJoin} />
      {showCrew ? (
        <>
          <ProfileCount
            value={crew.crew_count}
            label="Crew"
            color={FOCAL.jadeInk}
            accessibilityLabel={`${CREW_COUNTER_LABEL} ${crew.crew_count}`}
            action={join}
          />
          <ProfileCount
            value={crew.squad_count}
            label="Squad"
            color={FOCAL.violetInk}
            accessibilityLabel={`${SQUAD_COUNTER_LABEL} ${crew.squad_count}`}
            reserveAction={showJoin}
          />
        </>
      ) : null}
    </View>
  );
}

function ProfileCount({
  value,
  label,
  color,
  accessibilityLabel,
  action,
  reserveAction = false,
}: {
  value: number;
  label: string;
  color: string;
  accessibilityLabel: string;
  action?: ReactNode;
  reserveAction?: boolean;
}) {
  return (
    <View style={styles.stat} accessibilityRole={action ? undefined : 'text'} accessibilityLabel={action ? undefined : accessibilityLabel}>
      <Text style={[styles.statValue, { color }]} accessibilityLabel={action ? accessibilityLabel : undefined}>
        {formatCompactCount(value)}
      </Text>
      {action ?? (reserveAction ? <View style={styles.joinSlot} /> : null)}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TeammatesBadge({
  onPress,
  disabled,
  compact = false,
}: {
  onPress: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const pulse = useSharedValue(0.42);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  return (
    <AnimatedButton
      accessibilityRole="button"
      accessibilityLabel={TEAMMATES_BADGE}
      disabled={disabled}
      haptic="light"
      onPress={onPress}
      style={styles.teammatesWrap}
      contentStyle={[styles.teammatesHit, compact && styles.teammatesHitCompact]}
    >
      {compact ? (
        <View style={styles.joinIcon}>
          <Ionicons name="people" size={18} color="#FFFFFF" />
        </View>
      ) : (
        <>
          <Reanimated.View pointerEvents="none" style={[styles.teammatesGlow, glowStyle]} />
          <View style={styles.teammatesBadge}>
            <Text style={styles.teammatesLabel} numberOfLines={1}>
              {TEAMMATES_BADGE}
            </Text>
          </View>
        </>
      )}
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,20,22,0.08)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  joinSlot: {
    width: 36,
    height: 36,
  },
  joinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.jadeInk,
  },
  joinIconOn: {
    backgroundColor: FOCAL.mistJade,
    borderWidth: 1.5,
    borderColor: FOCAL.jadeInk,
  },
  squadHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  crewBlock: {
    gap: 0,
  },
  crewCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(138,100,0,0.22)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  crewStat: {
    flexShrink: 0,
    minWidth: 64,
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 4,
  },
  crewValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  crewLabel: {
    color: FOCAL.goldInk,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  crewDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(138,100,0,0.22)',
  },
  crewCta: {
    flex: 1,
    marginLeft: 4,
  },
  joinCrew: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  joinCrewLabel: {
    color: FOCAL.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  inCrew: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: FOCAL.goldInk,
  },
  inCrewLabel: {
    color: FOCAL.goldInk,
  },
  teammatesWrap: {
    alignSelf: 'stretch',
  },
  teammatesHit: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teammatesHitCompact: {
    minHeight: 44,
  },
  teammatesGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,215,0,0.28)',
  },
  teammatesBadge: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: FOCAL.ember,
    backgroundColor: FOCAL.mistEmber,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  teammatesBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teammatesLabel: {
    color: FOCAL.emberInk,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  teammatesLabelCompact: {
    fontSize: 12,
  },
});
