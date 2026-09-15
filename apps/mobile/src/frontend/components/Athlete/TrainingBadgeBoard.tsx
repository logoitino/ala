import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii, space } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { FOCAL } from '@/theme/motion';
import type { TrainingBadgeView } from '@tapuai/shared-types';

type TrainingBadgeBoardProps = {
  badges: TrainingBadgeView[];
  rosterClaimed: boolean;
  loading?: boolean;
};

/**
 * @purpose Athlete HQ training-badge board: locked vs unlocked chips with earn rules and Expo `/admin` desk links.
 * @param badges Catalog rows from `useAthleteTrainingBadges`.
 * @param rosterClaimed `profiles.player_id` is linked — Friday Night Lights live predicate.
 * @returns Daylight cards; operators see the matching Spotlight / Money / Athletes desk CTA.
 * @sideEffects `expo-router` push for Profile and Expo `/admin` desks.
 */
export function TrainingBadgeBoard({ badges, rosterClaimed, loading }: TrainingBadgeBoardProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();

  return (
    <View style={styles.wrap}>
      {!rosterClaimed && !loading ? (
        <EmptyState
          kicker="Training badges"
          title="Claim your roster first"
          lede="Friday Night Lights unlocks when you claim your roster from Profile → Account Capability. Film Room and Community Backer Magnet need That's me and Mālo on that same athlete."
          actionLabel="Edit roster on Profile"
          onAction={() => router.push('/profile' as Href)}
          adminHref="/admin/athletes"
          adminLabel="Open Athletes desk"
        />
      ) : null}
      {badges.map((badge) => (
        <View
          key={badge.id}
          style={[styles.chip, badge.earned ? styles.chipOn : styles.chipOff]}
          accessibilityRole="summary"
          accessibilityLabel={`${badge.label}, ${badge.earned ? 'unlocked' : 'locked'}. ${badge.rule}`}
        >
          <View style={styles.chipHead}>
            <Text style={styles.emoji}>{badge.emoji}</Text>
            <View style={styles.chipCopy}>
              <Text style={[styles.label, badge.earned ? styles.labelOn : styles.labelOff]}>
                {badge.earned ? badge.label : `${badge.label} · Locked`}
              </Text>
              <Text style={styles.rule}>
                {badge.earned
                  ? badge.unlockedAt
                    ? `Unlocked ${new Date(badge.unlockedAt).toLocaleDateString()}`
                    : 'Unlocked'
                  : badge.rule}
              </Text>
            </View>
          </View>
          {!badge.earned && badge.fanLabel && badge.fanHref ? (
            <AnimatedButton
              accessibilityLabel={badge.fanLabel}
              haptic="light"
              onPress={() => router.push(badge.fanHref as Href)}
              contentStyle={styles.fanBtn}
            >
              <Text style={styles.fanLabel}>{badge.fanLabel}</Text>
            </AnimatedButton>
          ) : null}
          {isAdmin ? (
            <AnimatedButton
              accessibilityLabel={badge.adminLabel}
              haptic="light"
              onPress={() => router.push(badge.adminDesk as Href)}
              contentStyle={styles.adminBtn}
            >
              <Text style={styles.adminLabel}>{badge.adminLabel}</Text>
            </AnimatedButton>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  chip: {
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: space.sm,
    gap: 8,
  },
  chipOn: {
    backgroundColor: FOCAL.mistJade,
    borderColor: FOCAL.jadeInk,
  },
  chipOff: {
    backgroundColor: FOCAL.mistSlate,
    borderColor: colors.border,
  },
  chipHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  chipCopy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
  },
  labelOn: {
    color: FOCAL.jadeInk,
  },
  labelOff: {
    color: colors.textMuted,
  },
  rule: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  fanBtn: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  fanLabel: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '800',
  },
  adminBtn: {
    minHeight: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  adminLabel: {
    color: FOCAL.goldInk,
    fontSize: 13,
    fontWeight: '800',
  },
});
