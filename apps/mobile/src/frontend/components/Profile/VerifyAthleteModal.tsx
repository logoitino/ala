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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalAckToggle, LegalModal } from '@/components/Legal/LegalModal';
import { VarsityBadge } from '@/components/Profile/VarsityBadge';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useCelebration } from '@/context/CelebrationContext';
import { useLegalAck } from '@/hooks/useLegalAck';
import {
  CLAIM_VERIFY_CTA,
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
import { FOCAL } from '@/theme/motion';

type VerifyAthleteModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * @purpose Team-code Varsity bottom sheet — claim school freely, glow only after code or coach/parent approval.
 * @param visible Opens from Profile settings or the 3D trading card CTA.
 * @returns Daylight sheet: team code field, Submit Code & Claim Badge, coach/parent request link.
 * @sideEffects `redeem_team_code` / `request_athlete_verification`; legal ack; telemetry `athlete_verify`; Aura toast.
 */
export function VerifyAthleteModal({ visible, onClose }: VerifyAthleteModalProps) {
  const insets = useSafeAreaInsets();
  const { profile, isAthlete, refreshProfile } = useAuth();
  const { showToast } = useCelebration();
  const { accepted: legalAccepted, accept: acceptLegal } = useLegalAck();
  const [open, setOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'redeem' | 'request' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = resolveVerificationStatus(profile);
  const schoolClaimed = Boolean(profile?.school_id || profile?.team);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setError(null);
      telemetry.trackFeature('athlete_verify', 'profile');
    }
  }, [visible]);

  if (!open && !visible) return null;

  const dismiss = () => {
    setOpen(false);
    setBusy(null);
    onClose();
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
      showToast(`⚡ VERIFIED VARSITY · ${result.school_name ?? 'badge claimed'}`);
      dismiss();
    });

  const onRequest = () =>
    void run('request', async () => {
      const result = await requestAthleteVerification();
      telemetry.trackFeature('athlete_verify.request', 'profile');
      if (result.already || result.verification_status === 'verified') {
        showToast('Already Varsity verified ⚡');
      } else {
        showToast('Request sent — keep posting while you wait ⚡');
      }
      dismiss();
    });

  return (
    <>
      <Modal transparent animationType="fade" visible={visible} onRequestClose={dismiss}>
        <View style={styles.root}>
          <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
            <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Pressable>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
              <View style={styles.handle} />
              <Text style={styles.kicker}>{VERIFY_SHEET_KICKER}</Text>
              <Text style={styles.title}>{VERIFY_SHEET_TITLE}</Text>
              <Text style={styles.lede}>
                Anyone can claim a school. Varsity is the fun extra — a team code or coach/parent approval. Highlights
                stay live while you wait.
              </Text>
              <VarsityBadge status={status} schoolClaimed={schoolClaimed} />
              {status === 'verified' ? (
                <Text style={styles.unlock}>{VERIFY_UNLOCK_COPY}</Text>
              ) : (
                <Text style={styles.wait}>{VERIFY_WAIT_COPY}</Text>
              )}
              {!isAthlete ? (
                <Text style={styles.hint}>
                  Claim your school in Account Capability first (or submit a team code here to jump straight to Varsity).
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
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
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
    borderRadius: radii.md,
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
    borderRadius: radii.md,
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
  requestHit: {
    alignItems: 'center',
    paddingVertical: 8,
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
