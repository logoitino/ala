import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { displayValue } from '@/data/players';
import { isOperatorPin, OPERATOR_TEST_PIN } from '@/lib/operator';
import { SPRING_BOUNCE, SPRING_CARD } from '@/theme/motion';
import type { Game } from '@/types/database';

/** How long the success pulse/flash plays before `onUnlock` fires, so the operator sees it land. */
const SUCCESS_HOLD_MS = 260;

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

type PINClaimModalProps = {
  game: Game | null;
  claiming?: boolean;
  onClose: () => void;
  onUnlock: () => void | Promise<void>;
};

/**
 * @purpose 4-digit operator PIN sheet. Valid PIN ('1234') claims scoring rights for the selected game.
 * @param game Live game being claimed, or `null` to hide.
 * @param claiming Disables the pad while `claimed_by` writes.
 * @param onUnlock Fires after a valid PIN so the portal can persist the claim and open the control center.
 * @returns Modal numerical keypad.
 * @sideEffects `Haptics.impactAsync` on each digit; Success/Error notification on submit.
 */
export function PINClaimModal({ game, claiming = false, onClose, onUnlock }: PINClaimModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const frame = useSheetFrame();
  const shake = useSharedValue(0);
  const successPulse = useSharedValue(1);
  const successFlash = useSharedValue(0);

  useEffect(() => {
    if (!game) {
      setPin('');
      setError(null);
      setSuccess(false);
      shake.value = 0;
      successPulse.value = 1;
      successFlash.value = 0;
    }
  }, [game, shake, successFlash, successPulse]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: successPulse.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: successFlash.value,
  }));

  const tapDigit = (key: (typeof PIN_KEYS)[number]) => {
    if (!key || claiming || success) return;
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Web / simulator may not expose a haptics engine.
    }

    setError(null);
    if (key === 'del') {
      setPin((current) => current.slice(0, -1));
      return;
    }

    const next = pin.length >= 4 ? pin : `${pin}${key}`;
    setPin(next);
    if (next.length === 4) {
      void submit(next);
    }
  };

  const reject = (message: string) => {
    setError(message);
    setPin('');
    shake.value = withSequence(
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 40 }),
      withTiming(-8, { duration: 40 }),
      withSpring(0, SPRING_BOUNCE),
    );
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // no-op
    }
  };

  const submit = async (value: string) => {
    if (!game) {
      reject('Select an active game first.');
      return;
    }
    if (!isOperatorPin(value)) {
      reject('Incorrect PIN. Scoring rights were not claimed.');
      return;
    }
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // no-op
    }
    setSuccess(true);
    successPulse.value = withSequence(withSpring(1.16, SPRING_BOUNCE), withSpring(1, SPRING_CARD));
    successFlash.value = withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 220 }));
    await new Promise((resolve) => setTimeout(resolve, SUCCESS_HOLD_MS));
    await onUnlock();
  };

  return (
    <Modal transparent animationType="fade" visible={Boolean(game)} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable haptic="none" accessibilityLabel="Dismiss PIN sheet" onPress={onClose} style={styles.backdrop} />
        <View pointerEvents="box-none" style={frame.dock}>
        <View style={[styles.sheet, frame.card]} accessibilityRole="summary" accessibilityLabel="Operator PIN keypad">
          <Text style={styles.kicker}>Operator PIN</Text>
          <Text style={styles.title}>Unlock control center</Text>
          <Text style={styles.matchup}>
            {game ? `${displayValue(game.home_team)} vs ${displayValue(game.away_team)}` : 'Select a game'}
          </Text>
          <Text style={styles.hint}>4-digit sideline PIN · test {OPERATOR_TEST_PIN}</Text>

          <View style={styles.dotsWrap}>
            <Animated.View pointerEvents="none" style={[styles.dotsFlash, flashStyle]} />
            <Animated.View style={[styles.dots, shakeStyle]} accessibilityLabel={`PIN entered, ${pin.length} of 4 digits`}>
              {[0, 1, 2, 3].map((index) => (
                <PinDot key={index} active={pin.length > index} />
              ))}
            </Animated.View>
          </View>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : (
            <Text style={styles.muted}>
              {success ? 'PIN accepted!' : claiming ? 'Claiming scoring rights…' : 'Enter PIN to claim this game'}
            </Text>
          )}

          <View style={styles.pad}>
            {PIN_KEYS.map((key, index) => {
              if (!key) return <View key={`spacer-${index}`} style={styles.key} />;
              return (
                <AnimatedPressable
                  key={key}
                  haptic="none"
                  scaleTo={0.92}
                  overshoot={false}
                  disabled={claiming || success}
                  accessibilityLabel={key === 'del' ? 'Delete' : `Digit ${key}`}
                  onPress={() => tapDigit(key)}
                  style={styles.key}
                  contentStyle={styles.keyFace}
                >
                  <Text style={styles.keyLabel}>{key === 'del' ? '⌫' : key}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * @purpose One PIN dot. Pops with a spring bounce the instant it lights up so each digit tap reads as registered.
 */
function PinDot({ active }: { active: boolean }) {
  const scale = useSharedValue(1);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      scale.value = withSequence(withSpring(1.45, SPRING_BOUNCE), withSpring(1, SPRING_CARD));
    }
    wasActive.current = active;
  }, [active, scale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[styles.dot, active && styles.dotOn, dotStyle]} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100%',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 12, 14, 0.88)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    zIndex: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  matchup: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  dotsWrap: {
    overflow: 'hidden',
    borderRadius: radii.md,
    marginTop: 4,
  },
  dotsFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.success,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  dotOn: {
    backgroundColor: colors.primary,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 18,
  },
  key: {
    width: '31%',
    minHeight: 58,
  },
  keyFace: {
    flex: 1,
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
});
