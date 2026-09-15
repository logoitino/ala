import { StyleSheet, Text, View } from 'react-native';

import { SubscriberCrest } from '@/components/Profile/SubscriberCrest';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { auraBadgeLabel, auraProgressTowardNext, auraTierForPoints } from '@/lib/aura';
import { FOCAL } from '@/theme/motion';

type ProfileHeroAvatarProps = {
  name: string;
  school?: string | null;
  jersey?: string | number | null;
  auraPoints: number;
  subscriberCrest?: boolean;
  showFlipControl?: boolean;
  onFlipAura?: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TF';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Large profile-photo hero so the avatar dominates before Crew / Highlights collage.
 * @param name Display name under the circle.
 * @param auraPoints Drives tier ring color + slim progress.
 * @param onFlipAura Opens the Aura trading card sheet (menu or control).
 */
export function ProfileHeroAvatar({
  name,
  school,
  jersey,
  auraPoints,
  subscriberCrest = false,
  showFlipControl = false,
  onFlipAura,
}: ProfileHeroAvatarProps) {
  const tier = auraTierForPoints(auraPoints);
  const progress = auraProgressTowardNext(auraPoints);
  const initials = initialsFromName(name);

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarStage}>
        <View style={[styles.avatarRing, { borderColor: tier.color, backgroundColor: tier.face }]}>
          <Text style={[styles.initials, { color: tier.ink }]}>{initials}</Text>
          {subscriberCrest ? (
            <View style={styles.crest}>
              <SubscriberCrest />
            </View>
          ) : null}
          {jersey != null && String(jersey).trim() ? (
            <View style={[styles.jerseyChip, { borderColor: tier.color }]}>
              <Text style={[styles.jerseyLabel, { color: tier.ink }]}>#{jersey}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.name}>{name}</Text>
      {school ? <Text style={styles.school}>{school}</Text> : null}
      <Text style={[styles.tier, { color: tier.ink }]}>
        {auraBadgeLabel(tier)} · {Math.round(auraPoints)} Aura
      </Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: tier.color },
          ]}
        />
      </View>
      {progress.next ? (
        <Text style={styles.progressHint}>
          {Math.round(progress.ratio * 100)}% to {progress.next.title}
        </Text>
      ) : (
        <Text style={styles.progressHint}>Max Aura band</Text>
      )}
      {showFlipControl && onFlipAura ? (
        <AnimatedButton
          accessibilityLabel="Flip Aura card"
          haptic="selection"
          onPress={onFlipAura}
          contentStyle={styles.flipHit}
        >
          <Text style={styles.flipLabel}>Flip Aura card</Text>
        </AnimatedButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  avatarStage: {
    paddingVertical: 8,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 1,
  },
  crest: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  jerseyChip: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  jerseyLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  name: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  school: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  tier: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 4,
    width: '72%',
    maxWidth: 240,
    height: 6,
    borderRadius: 999,
    backgroundColor: FOCAL.mistSlate,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressHint: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  flipHit: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  flipLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: FOCAL.jadeInk,
  },
});
