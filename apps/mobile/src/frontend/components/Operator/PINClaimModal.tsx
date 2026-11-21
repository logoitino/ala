/** UX-13 readable type/bounded presentation preserves synchronous flight guards and initiating lifetime checks. */
/** Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership. */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { displayValue } from '@/data/players';
import { isOperatorPin, OPERATOR_TEST_PIN } from '@/lib/operator';
import { SPRING_BOUNCE, SPRING_CARD } from '@/theme/motion';
import type { Game } from '@/types/database';
import { TYPE, figtree } from '@/theme/fonts';

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
  const lifetime = useRef({ gameId: game?.id, epoch: 0, mounted: true });
  const flight = useRef<object | null>(null);
  if (lifetime.current.gameId !== game?.id) {
    lifetime.current = { ...lifetime.current, gameId: game?.id, epoch: lifetime.current.epoch + 1 };
    flight.current = null;
  }
  const epoch = lifetime.current.epoch;
  const current = () => lifetime.current.mounted && lifetime.current.epoch === epoch;
  useEffect(() => { lifetime.current.mounted = true; return () => { lifetime.current.mounted = false; flight.current = null; }; }, []);
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const shake = useSharedValue(0);
  const successPulse = useSharedValue(1);
  const successFlash = useSharedValue(0);

  useEffect(() => {
    {
      setPin('');
      setError(null);
      setSuccess(false);
      shake.value = 0;
      successPulse.value = 1;
      successFlash.value = 0;
    }
  }, [game?.id]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: successPulse.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: successFlash.value,
  }));

  const tapDigit = (key: (typeof PIN_KEYS)[number]) => {
    if (!key || claiming || success || flight.current) return;
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
    if (!current() || claiming || flight.current) return;
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
    const operation = {}; flight.current = operation;
    setSuccess(true);
    successPulse.value = withSequence(withSpring(1.16, SPRING_BOUNCE), withSpring(1, SPRING_CARD));
    successFlash.value = withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 220 }));
    try {
      await new Promise((resolve) => setTimeout(resolve, SUCCESS_HOLD_MS));
      if (!current() || flight.current !== operation) return;
      await onUnlock();
    } catch (caught) {
      if (current() && flight.current === operation) { setSuccess(false); reject(caught instanceof Error ? caught.message : 'Scoring rights were not claimed. Try again.'); }
    } finally { if (flight.current === operation) flight.current = null; }
  };
  const dismiss = () => { if (!claiming && !flight.current) onClose(); };

  return (
    <Modal transparent animationType="fade" visible={Boolean(game)} onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable haptic="none" accessibilityLabel="Dismiss PIN sheet" onPress={dismiss} style={styles.backdrop} />
        <View pointerEvents="box-none" style={frame.dock}>
        <View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]} accessibilityRole="summary" accessibilityLabel="Operator PIN keypad">
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={claiming || success ? undefined : dismiss} />
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
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
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
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
          </ScrollView>
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
  bodyScroll: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: 10 },
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
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  matchup: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  hint: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
  },
  dotsWrap: {
    overflow: 'hidden',
    borderRadius: MENU_METRICS.controlRadius,
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
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  muted: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),
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
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
});
