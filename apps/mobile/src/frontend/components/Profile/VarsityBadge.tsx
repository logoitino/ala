import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import {
  NOT_VERIFIED_LABEL,
  SCHOOL_CLAIMED_LABEL,
  VARSITY_PENDING_LABEL,
  VARSITY_VERIFIED_LABEL,
  type VerificationStatus,
} from '@/data/verification';
import { FOCAL } from '@/theme/motion';

type VarsityBadgeProps = {
  status: VerificationStatus;
  /** True when the athlete already picked a school (claim ≠ Varsity). */
  schoolClaimed?: boolean;
  compact?: boolean;
  onPress?: () => void;
};

/**
 * @purpose Viewer-facing Varsity chip: neon jade when verified, amber while pending, claimed-but-not-verified otherwise.
 * @param status `profiles.verification_status` / `is_verified`.
 * @param schoolClaimed Shows SCHOOL CLAIMED + Not verified yet so fans can tell the difference.
 * @returns Glowing jade check for verified; pending / claimed chips stay obvious without blocking the profile.
 */
export function VarsityBadge({ status, schoolClaimed = false, compact = false, onPress }: VarsityBadgeProps) {
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    if (status !== 'verified') {
      cancelAnimation(pulse);
      pulse.value = 0.55;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, status]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  if (status === 'verified') {
    const inner = (
      <View style={[styles.verifiedWrap, compact && styles.compact]}>
        <Animated.View pointerEvents="none" style={[styles.verifiedGlow, glowStyle]} />
        <Text style={styles.check}>✓</Text>
        <Text style={styles.verifiedLabel}>{VARSITY_VERIFIED_LABEL}</Text>
      </View>
    );
    if (!onPress) return inner;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={VARSITY_VERIFIED_LABEL} haptic="selection" onPress={onPress}>
        {inner}
      </Pressable>
    );
  }

  if (status === 'pending') {
    const inner = (
      <View style={[styles.pendingWrap, compact && styles.compact]}>
        <Text style={styles.pendingLabel}>{VARSITY_PENDING_LABEL}</Text>
        {schoolClaimed ? <Text style={styles.sub}>{SCHOOL_CLAIMED_LABEL}</Text> : null}
      </View>
    );
    if (!onPress) return inner;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={VARSITY_PENDING_LABEL} haptic="selection" onPress={onPress}>
        {inner}
      </Pressable>
    );
  }

  if (!schoolClaimed && !onPress) return null;

  const inner = (
    <View style={[styles.claimedWrap, compact && styles.compact]}>
      {schoolClaimed ? <Text style={styles.claimedLabel}>{SCHOOL_CLAIMED_LABEL}</Text> : null}
      <Text style={styles.notVerified}>{NOT_VERIFIED_LABEL}</Text>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={NOT_VERIFIED_LABEL} haptic="selection" onPress={onPress}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compact: {
    alignSelf: 'center',
  },
  verifiedWrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    backgroundColor: FOCAL.mistJade,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.neonJade,
        shadowOpacity: 0.85,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  verifiedGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FOCAL.neonJade,
    opacity: 0.18,
  },
  check: {
    fontSize: 13,
    fontWeight: '900',
    color: FOCAL.jadeInk,
  },
  verifiedLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: FOCAL.jadeInk,
  },
  pendingWrap: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(138,100,0,0.35)',
    backgroundColor: FOCAL.mistGold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 1,
  },
  pendingLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: FOCAL.goldInk,
  },
  claimedWrap: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 1,
  },
  claimedLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: FOCAL.jadeInk,
  },
  notVerified: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  sub: {
    fontSize: 10,
    fontWeight: '700',
    color: FOCAL.goldInk,
  },
});
