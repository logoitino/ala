import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ProfileAvatarPicker } from '@/components/Profile/ProfileAvatarPicker';
import { SubscriberCrest } from '@/components/Profile/SubscriberCrest';
import { VarsityBadge } from '@/components/Profile/VarsityBadge';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { SchoolCrest, SchoolHeroBand } from '@/components/Verification/SchoolCrest';
import { colors, radii } from '@/constants/theme';
import { CLAIM_VERIFY_CTA, type VerificationStatus } from '@/data/verification';
import { auraBadgeLabel, auraProgressTowardNext, auraTierForPoints } from '@/lib/aura';
import type { SchoolBadge } from '@/lib/schoolBadge';
import { FOCAL } from '@/theme/motion';

type ProfileHeroAvatarProps = {
  name: string;
  school?: string | null;
  jersey?: string | number | null;
  auraPoints: number;
  subscriberCrest?: boolean;
  showFlipControl?: boolean;
  onFlipAura?: () => void;
  verificationStatus?: VerificationStatus;
  schoolClaimed?: boolean;
  onClaimVerification?: () => void;
  avatarUrl?: string | null;
  canEditAvatar?: boolean;
  onAvatarUploaded?: (url: string) => void;
  /** Server-confirmed crest (`useSchoolBadge`). Never build this from editable profile fields. */
  schoolBadge?: SchoolBadge | null;
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
 * @param verificationStatus Viewer-facing Varsity chip next to the name.
 * @param avatarUrl `profiles.avatar_url` when set.
 * @param canEditAvatar Own hub — opens `ProfileAvatarPicker` 1:1 crop.
 * @param schoolBadge School-confirmed only: school-colour band behind the photo, and the crest pinned
 *   on the ring edge (outside the photo, so a logo pasted into a picture can't sit where it sits).
 * @sideEffects `ProfileAvatarPicker` camera roll + Storage `avatars` when editable.
 */
export function ProfileHeroAvatar({
  name,
  school,
  jersey,
  auraPoints,
  subscriberCrest = false,
  showFlipControl = false,
  onFlipAura,
  verificationStatus = 'unverified',
  schoolClaimed = false,
  onClaimVerification,
  avatarUrl,
  canEditAvatar = false,
  onAvatarUploaded,
  schoolBadge = null,
}: ProfileHeroAvatarProps) {
  const tier = auraTierForPoints(auraPoints);
  const progress = auraProgressTowardNext(auraPoints);
  const initials = initialsFromName(name);

  return (
    <View style={[styles.wrap, schoolBadge ? styles.wrapBanded : null]}>
      {schoolBadge ? <SchoolHeroBand badge={schoolBadge} /> : null}
      <View style={[styles.avatarStage, schoolBadge ? styles.avatarStageBanded : null]}>
        <View style={[styles.avatarRing, { borderColor: tier.color, backgroundColor: tier.face }]}>
          <ProfileAvatarPicker
            uri={avatarUrl}
            editable={canEditAvatar}
            size={124}
            onUploaded={onAvatarUploaded}
          >
            <Text style={[styles.initials, { color: tier.ink }]}>{initials}</Text>
          </ProfileAvatarPicker>
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
          {schoolBadge ? (
            <View style={styles.schoolCrest}>
              <SchoolCrest badge={schoolBadge} athleteName={name} size={46} />
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.name}>{name}</Text>
      <VarsityBadge
        compact
        status={verificationStatus}
        schoolClaimed={schoolClaimed}
        onPress={onClaimVerification}
      />
      {schoolBadge ? (
        <Text style={styles.schoolConfirmed}>
          ✓ {schoolBadge.schoolName} athlete{schoolBadge.mascot ? ` · ${schoolBadge.mascot}` : ''}
        </Text>
      ) : school ? (
        <Text style={styles.school}>{school}</Text>
      ) : null}
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
          contentStyle={[styles.flipHit, { borderColor: tier.color, backgroundColor: tier.face }]}
        >
          <Ionicons name="sync" size={15} color={tier.ink} />
          <Text style={[styles.flipLabel, { color: tier.ink }]}>Flip Aura card</Text>
        </AnimatedButton>
      ) : null}
      {onClaimVerification && verificationStatus !== 'verified' ? (
        <AnimatedButton
          accessibilityLabel={CLAIM_VERIFY_CTA}
          haptic="selection"
          onPress={onClaimVerification}
          contentStyle={styles.verifyHit}
        >
          <Text style={styles.verifyLabel}>{CLAIM_VERIFY_CTA}</Text>
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
  wrapBanded: {
    alignSelf: 'stretch',
  },
  avatarStage: {
    paddingVertical: 8,
  },
  avatarStageBanded: {
    paddingTop: 40,
  },
  schoolCrest: {
    position: 'absolute',
    right: -14,
    bottom: 0,
  },
  schoolConfirmed: {
    fontSize: 14,
    fontWeight: '800',
    color: FOCAL.jadeInk,
    textAlign: 'center',
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
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  flipLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  verifyHit: {
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verifyLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: FOCAL.goldInk,
  },
});
