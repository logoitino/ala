/**
 * Profile identity hero shared by own and public sheets, with a compact sideline-style identity row.
 * Athlete details are optional; community profiles must never inherit a favorite player's credentials.
 * School crests remain server-confirmed and avatar editing stays controlled by the parent sheet.
 * The card edge, the Aura card control, and the next-tier line wear the earned tier color.
 * @sideEffects `ProfileAvatarPicker` can upload the owner's chosen photo to Storage `avatars`.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { SportField } from '@/components/Effects/SportField';
import { SportIcon } from '@/components/UI/SportIcon';
import { ProfileAvatarPicker } from '@/components/Profile/ProfileAvatarPicker';
import { SubscriberCrest } from '@/components/Profile/SubscriberCrest';
import { VarsityBadge } from '@/components/Profile/VarsityBadge';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { JerseyBadge } from '@/components/UI/JerseyBadge';
import { SchoolCrest, SchoolHeroBand } from '@/components/Verification/SchoolCrest';
import { colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { CLAIM_VERIFY_CTA, type VerificationStatus } from '@/data/verification';
import { classYearLabel } from '@/data/teams';
import { auraBadgeLabel, auraProgressTowardNext, auraTierForPoints } from '@/lib/aura';
import type { SchoolBadge } from '@/lib/schoolBadge';
import { FOCAL } from '@/theme/motion';

type ProfileHeroAvatarProps = {
  name: string;
  school?: string | null;
  jersey?: string | number | null;
  athlete?: boolean;
  /** Compact photo/name row and credential pills for the sports profile overview. */
  compact?: boolean;
  sport?: string | null;
  position?: string | null;
  classYear?: string | null;
  auraPoints: number;
  subscriberCrest?: boolean;
  showFlipControl?: boolean;
  onFlipAura?: () => void;
  verificationStatus?: VerificationStatus;
  schoolClaimed?: boolean;
  onClaimVerification?: () => void;
  /** Counts and the Crew join control, drawn inside the card under Aura. */
  footer?: ReactNode;
  avatarUrl?: string | null;
  canEditAvatar?: boolean;
  onAvatarUploaded?: (url: string) => void;
  /** Server-confirmed crest (`useSchoolBadge`). Never build this from editable profile fields. */
  schoolBadge?: SchoolBadge | null;
  /** Own-hub account menu (or similar) parked on the compact identity row, top-right. */
  headerAction?: ReactNode;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TF';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Sports identity header with photo, school and known credentials before Crew / Highlights.
 * @param name Display name under the circle.
 * @param auraPoints Drives tier ring color + slim progress.
 * @param onFlipAura Opens the Aura trading card sheet (menu or control).
 * @param verificationStatus Viewer-facing Varsity chip next to the name.
 * @param avatarUrl `profiles.avatar_url` when set (full URL or `sb:` reference; `ProfileAvatarPicker` resolves it).
 * @param canEditAvatar Own hub — opens `ProfileAvatarPicker` 1:1 crop.
 * @param athlete Community accounts hide jersey and athlete details even when a favorite roster is supplied.
 * @param compact Keeps identity, known credentials and Aura together without a tall centered hero.
 * @param sport / position / classYear Known athlete metadata; absent fields have no placeholder claims.
 * @param schoolBadge School-confirmed only: school-colour band behind the photo, and the crest pinned
 *   on the ring edge (outside the photo, so a logo pasted into a picture can't sit where it sits).
 * @param headerAction Optional control beside the name (own Profile hamburger).
 * @sideEffects `ProfileAvatarPicker` camera roll + Storage `avatars` when editable.
 */
export function ProfileHeroAvatar({
  name,
  school,
  jersey,
  athlete = true,
  compact = false,
  sport,
  position,
  classYear,
  auraPoints,
  subscriberCrest = false,
  showFlipControl = false,
  onFlipAura,
  verificationStatus = 'unverified',
  schoolClaimed = false,
  onClaimVerification,
  avatarUrl,
  footer,
  canEditAvatar = false,
  onAvatarUploaded,
  schoolBadge: suppliedSchoolBadge = null,
  headerAction,
}: ProfileHeroAvatarProps) {
  // A community sheet may carry a favorite roster row; its school proof belongs to that athlete.
  const schoolBadge = athlete ? suppliedSchoolBadge : null;
  const tier = auraTierForPoints(auraPoints);
  const progress = auraProgressTowardNext(auraPoints);
  const initials = initialsFromName(name);
  // Omit unknown fields rather than turning an inferred sport or missing year into a credential.
  const details = athlete ? [
    { label: 'Sport', value: sport?.trim() },
    { label: 'Position', value: position?.trim() },
    { label: 'Class', value: classYear?.trim() && classYear.trim() !== '—' ? classYearLabel(classYear.trim()) : null },
  ].filter((detail) => detail.value && detail.value !== '—') : [];

  const progressPct = Math.round(progress.ratio * 100);
  const progressLine = progress.next ? `${progressPct}% to ${progress.next.title}` : 'Max Aura band';

  if (compact) {
    return (
      <View style={[styles.wrap, styles.compactWrap, styles.fieldClip, { borderTopColor: tier.color }]}>
        {/* UX-08: an athlete's own playing surface; community profiles get the generic field. No yard numbers behind stats. */}
        <SportField sport={athlete ? sport : null} labels={false} opacity={0.09} />
        <View style={styles.compactIdentityRow}>
          <View style={styles.compactAvatarStage}>
            {schoolBadge ? <View style={styles.compactSchoolBand}><SchoolHeroBand badge={schoolBadge} /></View> : null}
            <View style={[styles.avatarRing, styles.compactAvatarRing, { borderColor: tier.color, backgroundColor: tier.face }]}>
              <ProfileAvatarPicker uri={avatarUrl} editable={canEditAvatar} size={64} onUploaded={onAvatarUploaded}>
                <Text style={[styles.initials, styles.compactInitials, { color: tier.ink }]}>{initials}</Text>
              </ProfileAvatarPicker>
              {subscriberCrest ? <View style={styles.crest}><SubscriberCrest /></View> : null}
              {athlete && jersey != null && String(jersey).trim() ? (
                <JerseyBadge number={jersey} color={tier.color} ink={tier.ink} style={styles.jerseyPatch} />
              ) : null}
              {schoolBadge ? (
                <View style={styles.compactSchoolCrest}><SchoolCrest badge={schoolBadge} athleteName={name} size={32} /></View>
              ) : null}
            </View>
          </View>
          <View style={styles.compactIdentity}>
            <Text style={[styles.kicker, styles.compactLeft, { color: tier.ink }]}>{athlete ? 'Athlete profile' : 'Community profile'}</Text>
            <Text accessibilityRole="header" style={[styles.name, styles.compactName]}>{name}</Text>
            <VarsityBadge compact status={verificationStatus} schoolClaimed={schoolClaimed} onPress={onClaimVerification} />
            {schoolBadge ? (
              <Text style={[styles.schoolConfirmed, styles.compactSchool]}>
                ✓ {schoolBadge.schoolName} athlete{schoolBadge.mascot ? ` · ${schoolBadge.mascot}` : ''}
              </Text>
            ) : school ? <Text style={[styles.school, styles.compactSchool]}>{school}</Text> : null}
          </View>
          {headerAction ? <View style={styles.compactHeaderAction}>{headerAction}</View> : null}
        </View>
        {details.length > 0 ? (
          <View style={styles.compactDetails}>
            {details.map((detail) => (
              <View key={detail.label} style={styles.compactDetail} accessible accessibilityLabel={`${detail.label}: ${detail.value}`}>
                {detail.label === 'Sport' ? <SportIcon sport={detail.value} size={15} color={colors.text} /> : null}
                <Text style={styles.compactDetailValue}>{detail.label === 'Class' ? `Class ${detail.value}` : detail.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.compactAuraRow}>
          <View style={styles.compactAura} accessible accessibilityRole="progressbar" accessibilityLabel="Aura progress"
            accessibilityValue={{ min: 0, max: 100, now: progressPct,
              text: `${Math.round(auraPoints)} Aura, ${auraBadgeLabel(tier)}. ${progress.next ? `${progressPct}% to ${progress.next.title}` : 'Max Aura band'}` }}>
            <Text style={[styles.tier, styles.compactAuraLabel, { color: tier.ink }]}><Text style={SCOREBOARD_DIGITS}>{Math.round(auraPoints)}</Text> Aura · {tier.title}</Text>
            <View style={[styles.progressTrack, styles.compactProgressTrack, { backgroundColor: tier.face }]}>
              <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: tier.color }]} />
            </View>
            <Text style={[styles.progressHint, styles.compactLeft, { color: tier.ink }]}>{progressLine}</Text>
          </View>
          {showFlipControl && onFlipAura ? (
            <AnimatedButton accessibilityLabel="Flip Aura card" haptic="selection" onPress={onFlipAura}
              contentStyle={[styles.flipHit, styles.compactFlip, { backgroundColor: tier.color, borderColor: tier.color }]}>
              <Ionicons name="sync" size={15} color={FOCAL.ink} />
              <Text style={[styles.flipLabel, { color: FOCAL.ink }]}>Aura card</Text>
            </AnimatedButton>
          ) : null}
        </View>
        {onClaimVerification && verificationStatus !== 'verified' ? (
          <AnimatedButton accessibilityLabel={CLAIM_VERIFY_CTA} haptic="selection" onPress={onClaimVerification}
            contentStyle={[styles.verifyHit, styles.compactVerify]}>
            <Text style={styles.verifyLabel}>{CLAIM_VERIFY_CTA}</Text>
          </AnimatedButton>
        ) : null}
        {footer}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.fieldClip, schoolBadge ? styles.wrapBanded : null]}>
      <SportField sport={athlete ? sport : null} labels={false} opacity={0.09} />
      <View style={[styles.identityRail, { backgroundColor: tier.color }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <Text style={[styles.kicker, { color: tier.ink }]}>{athlete ? 'Athlete profile' : 'Community profile'}</Text>
      <View style={[styles.avatarStage, schoolBadge ? styles.avatarStageBanded : null]}>
        {schoolBadge ? <View style={styles.schoolBand}><SchoolHeroBand badge={schoolBadge} /></View> : null}
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
          {athlete && jersey != null && String(jersey).trim() ? (
            <JerseyBadge number={jersey} color={tier.color} ink={tier.ink} style={styles.jerseyPatch} />
          ) : null}
          {schoolBadge ? (
            <View style={styles.schoolCrest}>
              <SchoolCrest badge={schoolBadge} athleteName={name} size={46} />
            </View>
          ) : null}
        </View>
      </View>
      <Text accessibilityRole="header" style={styles.name}>{name}</Text>
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
      {details.length > 0 ? (
        <View style={styles.details}>
          {details.map((detail) => (
            <View key={detail.label} style={styles.detail} accessible accessibilityLabel={`${detail.label}: ${detail.value}`}>
              <Text style={styles.detailLabel}>{detail.label}</Text>
              <Text style={styles.detailValue}>{detail.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.tier, { color: tier.ink }]}>
        {auraBadgeLabel(tier)} · {Math.round(auraPoints)} Aura
      </Text>
      <View style={[styles.progressTrack, { backgroundColor: tier.face }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: tier.color },
          ]}
        />
      </View>
      <Text style={[styles.progressHint, { color: tier.ink }]}>{progressLine}</Text>
      {showFlipControl && onFlipAura ? (
        <AnimatedButton
          accessibilityLabel="Flip Aura card"
          haptic="selection"
          onPress={onFlipAura}
          contentStyle={[styles.flipHit, { backgroundColor: tier.color, borderColor: tier.color }]}
        >
          <Ionicons name="sync" size={15} color={FOCAL.ink} />
          <Text style={[styles.flipLabel, { color: FOCAL.ink }]}>Flip Aura card</Text>
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
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    alignItems: 'stretch',
    padding: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
    borderTopWidth: 3,
    borderTopColor: colors.border,
  },
  // The identity can take a second line at large text sizes instead of shrinking the athlete's name.
  compactIdentityRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  compactAvatarStage: { width: 72, paddingTop: 2, paddingBottom: 8 },
  compactAvatarRing: { width: 72, height: 72, borderRadius: 36 },
  compactInitials: { fontSize: 24 },
  compactSchoolBand: { position: 'absolute', top: 8, left: 0, right: 0, height: 52, borderRadius: radii.sm, overflow: 'hidden' },
  compactSchoolCrest: { position: 'absolute', right: -8, bottom: 2 },
  compactIdentity: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0, gap: 3 },
  // Own-hub menu sits on the identity row so Profile does not spend a whole nav bar on the hamburger.
  compactHeaderAction: { alignSelf: 'flex-start', marginLeft: 'auto' },
  compactLeft: { textAlign: 'left', letterSpacing: 0.9 },
  compactName: { marginTop: 0, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, textAlign: 'left' },
  compactSchool: { fontSize: 12, textAlign: 'left' },
  compactDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compactDetail: { maxWidth: '100%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: FOCAL.mistJade },
  compactDetailValue: { color: colors.text, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  compactAuraRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  compactAura: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 5 },
  compactAuraLabel: { textAlign: 'left', fontWeight: '900' },
  compactProgressTrack: { width: '100%', maxWidth: undefined, marginTop: 0, height: 6 },
  compactFlip: { marginTop: 0, paddingHorizontal: 12, paddingVertical: 6, flexShrink: 1 },
  compactVerify: { alignSelf: 'flex-start', marginTop: 0 },
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  identityRail: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: colors.text,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginVertical: 6,
  },
  detail: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 90,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.sm,
    backgroundColor: FOCAL.mistJade,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.text,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  wrapBanded: {
    alignSelf: 'stretch',
  },
  schoolBand: {
    position: 'absolute',
    top: 0,
    left: -16,
    right: -16,
    height: 104,
  },
  avatarStage: {
    paddingVertical: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
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
  jerseyPatch: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
  },
  fieldClip: {
    overflow: 'hidden',
  },
  name: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
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
    minHeight: 44,
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  flipLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  verifyHit: {
    marginTop: 2,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verifyLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: FOCAL.goldInk,
  },
});
