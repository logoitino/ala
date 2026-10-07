/** Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership. */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { LegalAckToggle, LegalModal } from '@/components/Legal/LegalModal';
import { VarsityBadge } from '@/components/Profile/VarsityBadge';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useAuth } from '@/context/AuthContext';
import { useCelebration } from '@/context/CelebrationContext';
import { useLegalAck } from '@/hooks/useLegalAck';
import {
  CLAIM_VERIFY_CTA,
  SCHOOL_CODE_ACCEPTED,
  VERIFY_INPUT_LABEL,
  VERIFY_INPUT_PLACEHOLDER,
  VERIFY_REQUEST_LINK,
  VERIFY_SHEET_KICKER,
  VERIFY_SHEET_TITLE,
  VERIFY_SUBMIT_LABEL,
  VERIFY_UNLOCK_COPY,
  VERIFY_WAIT_COPY,
  resolveVerificationStatus,
} from '@/data/verification';
import { redeemTeamCode, requestAthleteVerification } from '@/lib/verification';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

const SHEET_TRAVEL = 460;

type VerifyAthleteModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * @purpose Athlete-claim bottom sheet — school code or plain claim both lead to "pending"; the ⚡ badge
 *   turns on only after the athletic director or coach confirms the student in person.
 * @param visible Opens from Profile settings or the 3D trading card CTA.
 * @returns Daylight sheet: team code field, Submit Code & Claim Badge, coach/parent request link.
 * @sideEffects `redeem_team_code` / `request_athlete_verification`; legal ack; telemetry `athlete_verify`; Aura toast.
 */
export function VerifyAthleteModal({ visible, onClose }: VerifyAthleteModalProps) {
  const frame = useSheetFrame();
  const { profile, isAthlete, refreshProfile } = useAuth();
  const { showToast } = useCelebration();
  const { accepted: legalAccepted, accept: acceptLegal } = useLegalAck();
  const [open, setOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'redeem' | 'request' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);

  const status = resolveVerificationStatus(profile);
  const schoolClaimed = Boolean(profile?.school_id || profile?.team);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setError(null);
      telemetry.trackFeature('athlete_verify', 'profile');
      translateY.value = withSpring(0, SPRING_CARD);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [backdropOpacity, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!open && !visible) return null;

  const dismiss = () => {
    translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
    backdropOpacity.value = withTiming(0, { duration: 160 });
    setBusy(null);
    setTimeout(() => {
      setOpen(false);
      onClose();
    }, 180);
  };

  const run = async (kind: 'redeem' | 'request', work: () => Promise<void>) => {
    if (!legalAccepted) {
      setError('Agree to Terms of Service & NIL Compliance first.');
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      await work();
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update verification.');
    } finally {
      setBusy(null);
    }
  };

  const onRedeem = () =>
    void run('redeem', async () => {
      const result = await redeemTeamCode(code);
      telemetry.trackFeature('athlete_verify.redeem', 'profile');
      showToast(
        result.already || result.verification_status === 'verified'
          ? 'Already Varsity verified ⚡'
          : `${SCHOOL_CODE_ACCEPTED}${result.school_name ? ` · ${result.school_name}` : ''}`,
      );
      dismiss();
    });

  const onRequest = () =>
    void run('request', async () => {
      const result = await requestAthleteVerification();
      telemetry.trackFeature('athlete_verify.request', 'profile');
      if (result.already || result.verification_status === 'verified') {
        showToast('Already Varsity verified ⚡');
      } else {
        showToast('Claim sent — your school confirms you next ⚡');
      }
      dismiss();
    });

  return (
    <>
      <Modal
        transparent
        animationType="none"
        visible={visible}
        onRequestClose={dismiss}
        onDismiss={() => setOpen(false)}
      >
        <View style={styles.root}>
          <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
            <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
              <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Pressable>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View pointerEvents="box-none" style={frame.dock}>
            <Animated.View style={[styles.sheet, frame.card, sheetStyle]}>
          <MenuBackdrop accent="violet" />
              <View style={styles.handle} />
              <Text style={styles.kicker}>{VERIFY_SHEET_KICKER}</Text>
              <Text style={styles.title}>{VERIFY_SHEET_TITLE}</Text>
              <Text style={styles.lede}>
                Anyone can claim to be an athlete. Your athletic director or coach confirms you in person, then the
                ⚡ badge turns on. Highlights stay live while you wait.
              </Text>
              <VarsityBadge status={status} schoolClaimed={schoolClaimed} />
              {status === 'verified' ? (
                <Text style={styles.unlock}>{VERIFY_UNLOCK_COPY}</Text>
              ) : (
                <Text style={styles.wait}>{VERIFY_WAIT_COPY}</Text>
              )}
              {!isAthlete ? (
                <Text style={styles.hint}>
                  Claim your school in Account Capability first, or enter your school code here.
                </Text>
              ) : null}

              {status !== 'verified' ? (
                <>
                  <Text style={styles.fieldLabel}>{VERIFY_INPUT_LABEL}</Text>
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!busy}
                    placeholder={VERIFY_INPUT_PLACEHOLDER}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    value={code}
                    onChangeText={setCode}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (code.trim() && legalAccepted) void onRedeem();
                    }}
                  />
                  <LegalAckToggle
                    checked={legalAccepted}
                    disabled={legalAccepted}
                    onCheckedChange={(next) => {
                      if (next) void acceptLegal();
                    }}
                    onOpenTerms={() => setLegalOpen(true)}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <AnimatedButton
                    accessibilityLabel={VERIFY_SUBMIT_LABEL}
                    disabled={Boolean(busy) || !code.trim() || !legalAccepted}
                    haptic="medium"
                    onPress={onRedeem}
                    contentStyle={[
                      styles.submit,
                      (busy || !code.trim() || !legalAccepted) && styles.submitOff,
                    ]}
                  >
                    {busy === 'redeem' ? (
                      <ActivityIndicator color={colors.onAccent} />
                    ) : (
                      <Text style={styles.submitLabel}>{VERIFY_SUBMIT_LABEL}</Text>
                    )}
                  </AnimatedButton>
                  <View style={styles.orDivider} accessibilityElementsHidden importantForAccessibility="no">
                    <View style={styles.orLine} />
                    <Text style={styles.orLabel}>or</Text>
                    <View style={styles.orLine} />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={VERIFY_REQUEST_LINK}
                    disabled={Boolean(busy) || !legalAccepted}
                    haptic="selection"
                    onPress={onRequest}
                    style={styles.requestHit}
                  >
                    {busy === 'request' ? (
                      <ActivityIndicator color={FOCAL.jadeInk} />
                    ) : (
                      <Text style={[styles.requestLabel, !legalAccepted && styles.requestOff]}>
                        {VERIFY_REQUEST_LINK}
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <AnimatedButton accessibilityLabel="Close verified sheet" haptic="selection" onPress={dismiss} contentStyle={styles.submit}>
                  <Text style={styles.submitLabel}>Done</Text>
                </AnimatedButton>
              )}
              <Pressable accessibilityRole="button" onPress={dismiss} style={styles.close}>
                <Text style={styles.closeLabel}>Close</Text>
              </Pressable>
            </Animated.View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <LegalModal visible={legalOpen} requireAck onClose={() => setLegalOpen(false)} />
    </>
  );
}

/** Menu / card label — keep product copy in one place. */
export { CLAIM_VERIFY_CTA };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: colors.surface,
    gap: 10,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  lede: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 20,
  },
  unlock: {
    fontSize: 13,
    fontWeight: '700',
    color: FOCAL.jadeInk,
  },
  wait: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    lineHeight: 18,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: FOCAL.goldInk,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.text,
  },
  error: {
    fontSize: 13,
    fontWeight: '700',
    color: FOCAL.emberInk,
  },
  submit: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOff: {
    opacity: 0.45,
  },
  submitLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  orLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  requestHit: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  requestLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: FOCAL.jadeInk,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  requestOff: {
    color: colors.textMuted,
    textDecorationLine: 'none',
  },
  close: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
