/**
 * One-time age card. With the minor-accounts update (MINOR-01) it asks for birth month and year: required for an account
 * made after the update (Apple / Google skip the sign-up form), skippable (asked again every three days) for an older account.
 * An under-13 entry closes the account and signs out with the neutral line. Without the update it keeps the 13+ checkbox.
 * Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership.
 */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { BirthMonthField, type BirthDraft } from '@/components/Auth/BirthMonthField';
import { LegalAckToggle } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, KIT } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useAuth } from '@/context/AuthContext';
import { AGE_GATE_REFUSAL, birthInputError, pauseAgeGate } from '@/lib/minors';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

const AGE_GATE_LABEL = 'I confirm I am 13 years of age or older.';

/**
 * @purpose One-time age card (birth month and year with MINOR-01; the 13+ checkbox on older databases) for accounts
 * created via Apple / Google, which skip the Soft-Wall sign-up form, and the optional ask for older accounts.
 * @remarks `birthPrompt` 'required' only for accounts made after MINOR-01 with no age yet; an older account gets
 * 'optional' with Not now, asked again every three days until an age is added (never blocked or signed out for skipping). Without MINOR-01, the 13+ card shows only on a
 * brand-new account's first sign-in, as before.
 * @sideEffects `AuthContext.recordBirthMonth` → `set_my_birth_month`, or `confirmAge13Plus` → `profiles` UPDATE.
 */
export function AgeConfirmModal() {
  const insets = useSafeAreaInsets();
  const frame = useSheetFrame();
  const { needsAgeConfirmation, confirmAge13Plus, birthPrompt, recordBirthMonth, dismissBirthPrompt } = useAuth();
  const [checked, setChecked] = useState(false);
  const [birth, setBirth] = useState<BirthDraft>({ year: null, month: null });
  const visible = birthPrompt !== null || needsAgeConfirmation;
  const asksBirth = birthPrompt !== null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Centered-card scale-in (not a slide-up sheet) — same intro spring SpotlightModal uses for
  // its `sheetStyle`, since this is a full-screen takeover card rather than a bottom sheet.
  const intro = useSharedValue(0.92);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      intro.value = 0.92;
      intro.value = withSpring(1, SPRING_CARD);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      intro.value = 0.92;
      backdropOpacity.value = 0;
    }
  }, [backdropOpacity, intro, visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: intro.value }],
    opacity: 0.55 + intro.value * 0.45,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const birthProblem = birthInputError(birth.year, birth.month);
  const onSaveBirth = async () => {
    if (birthProblem || busy || !birth.year || !birth.month) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await recordBirthMonth(birth.year, birth.month);
      if (outcome === 'blocked') await pauseAgeGate();
      setBirth({ year: null, month: null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't go through — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmAge13Plus();
      setChecked(false);
    } catch {
      // Leave `checked` on so the fan can retry with one tap instead of re-checking the box —
      // without this they'd have no feedback and no easy way out of a failed RPC.
      setError("That didn't go through — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={() => undefined}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            paddingHorizontal: frame.dock.paddingHorizontal,
          },
          backdropStyle,
        ]}
      >
        <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.card, frame.card, cardStyle]}>
          <MenuBackdrop accent="jade" />
          <View style={styles.iconTile} accessible={false} importantForAccessibility="no-hide-descendants">
            <Ionicons name={asksBirth ? 'calendar-outline' : 'shield-checkmark-outline'} size={26} color={colors.gold} />
          </View>
          <Text style={styles.kicker}>Tapua&apos;i</Text>
          <Text style={styles.title}>{asksBirth ? 'One quick question' : 'Quick confirmation'}</Text>
          {asksBirth ? (
            <>
              <Text style={styles.body}>
                {birthPrompt === 'required'
                  ? 'Add your birth month and year to finish setting up your account.'
                  : 'Add your birth month and year so your account gets the right safety settings.'}
              </Text>
              <BirthMonthField value={birth} onChange={setBirth} disabled={busy} />
              {error ? <Text style={styles.error}>{error === AGE_GATE_REFUSAL ? AGE_GATE_REFUSAL : error}</Text> : null}
              <AnimatedButton
                accessibilityLabel="Save birth month and year"
                disabled={Boolean(birthProblem) || busy}
                haptic="medium"
                onPress={() => void onSaveBirth()}
                contentStyle={[styles.cta, (Boolean(birthProblem) || busy) && styles.ctaOff]}
              >
                <Text style={styles.ctaLabel}>Continue</Text>
              </AnimatedButton>
              {birthPrompt === 'optional' ? (
                <AnimatedButton accessibilityLabel="Not now" haptic="selection" onPress={dismissBirthPrompt} contentStyle={styles.later}>
                  <Text style={styles.laterLabel}>Not now</Text>
                </AnimatedButton>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Before you continue, we need to confirm your age. Tapua&apos;i is not for kids under 13.
              </Text>
              <LegalAckToggle checked={checked} onCheckedChange={setChecked} label={AGE_GATE_LABEL} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AnimatedButton
                accessibilityLabel="Confirm and continue"
                disabled={!checked || busy}
                haptic="medium"
                onPress={() => void onConfirm()}
                contentStyle={[styles.cta, (!checked || busy) && styles.ctaOff]}
              >
                <Text style={styles.ctaLabel}>Confirm & Continue</Text>
              </AnimatedButton>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,20,22,0.72)',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: KIT.sheetRadius,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.6,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textMuted,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.danger,
  },
  cta: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: KIT.controlRadius,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...KIT.shadowSoft,
  },
  ctaOff: {
    opacity: 0.45,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  later: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
  },
  laterLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
