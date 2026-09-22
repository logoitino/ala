import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { LegalAckToggle } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

const AGE_GATE_LABEL = 'I confirm I am 13 years of age or older.';

/**
 * @purpose One-time COPPA age gate for accounts created via Apple / Google, which skip the Soft-Wall
 * sign-up form entirely (that form collects the same confirmation as a checkbox before submit).
 * @remarks Shown only when `useAuth().needsAgeConfirmation` is true — a brand-new account's very
 * first sign-in with no confirmation on file yet. Never appears for a returning user, and does not
 * block or sign out any existing account that has `age_confirmed_13_plus = null`.
 * @sideEffects `AuthContext.confirmAge13Plus` → `profiles` UPDATE.
 */
export function AgeConfirmModal() {
  const insets = useSafeAreaInsets();
  const { needsAgeConfirmation, confirmAge13Plus } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Centered-card scale-in (not a slide-up sheet) — same intro spring SpotlightModal uses for
  // its `sheetStyle`, since this is a full-screen takeover card rather than a bottom sheet.
  const intro = useSharedValue(0.92);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (needsAgeConfirmation) {
      intro.value = 0.92;
      intro.value = withSpring(1, SPRING_CARD);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      intro.value = 0.92;
      backdropOpacity.value = 0;
    }
  }, [backdropOpacity, intro, needsAgeConfirmation]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: intro.value }],
    opacity: 0.55 + intro.value * 0.45,
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

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
      visible={needsAgeConfirmation}
      onRequestClose={() => undefined}
    >
      <Animated.View
        style={[styles.backdrop, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }, backdropStyle]}
      >
        <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.kicker}>Tapua&apos;i</Text>
          <Text style={styles.title}>Quick confirmation</Text>
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
    paddingHorizontal: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
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
    backgroundColor: FOCAL.jadeInk,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaOff: {
    opacity: 0.5,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
