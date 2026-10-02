import { type ReactNode, useCallback, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { SPRING_CARD } from '@/theme/motion';

const DISMISS_Y = -30;
const OFFSCREEN_Y = -120;
const DISMISS_X = 72;
const OFFSCREEN_X = 420;
const DISMISS_MS = 160;

type SwipeableBannerWrapperProps = {
  children: ReactNode;
  onDismiss: () => void;
  onPress?: () => void;
  /** Spoken name for the tap that opens the destination. Defaults to the live-score banner. */
  pressAccessibilityLabel?: string;
  accessibilityLabel?: string;
  /** Compact bars (Rivalry week) dismiss by swipe only, so the chevron stays clear. */
  showClose?: boolean;
};

function fireLightHaptic() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Swipe up, left, or right — or tap ✕ — to dismiss a top banner or toast.
 * @param children Banner body (score chip, callout, or Aura toast).
 * @param onDismiss Fired after the banner animates off-screen.
 * @param onPress Optional tap on the banner body (live scoreboard → Local game). ✕ still dismisses when shown.
 * @param pressAccessibilityLabel Spoken name for that tap.
 * @param showClose When false, swipe left or right (or up) is the only dismiss. Defaults to showing ✕.
 * @returns Reanimated `Gesture.Pan` container. Swipe left or right slides it off.
 * @sideEffects `Haptics.impactAsync(Light)` on swipe or tap dismiss.
 */
export function SwipeableBannerWrapper({
  children,
  onDismiss,
  onPress,
  pressAccessibilityLabel = 'Open live match',
  accessibilityLabel = 'Dismiss banner',
  showClose = true,
}: SwipeableBannerWrapperProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const settled = useRef(false);

  const finish = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    fireLightHaptic();
    onDismiss();
  }, [onDismiss]);

  const scheduleFinish = useCallback(() => {
    setTimeout(finish, DISMISS_MS + 10);
  }, [finish]);

  const slideAway = useCallback(() => {
    translateY.value = withTiming(OFFSCREEN_Y, { duration: DISMISS_MS });
    scheduleFinish();
  }, [scheduleFinish, translateY]);

  const pan = Gesture.Pan()
    .minDistance(14)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      const sideways = Math.abs(event.translationX) > DISMISS_X || Math.abs(event.velocityX) > 700;
      if (sideways) {
        const dir = event.translationX >= 0 ? 1 : -1;
        translateX.value = withTiming(dir * OFFSCREEN_X, { duration: DISMISS_MS });
        runOnJS(scheduleFinish)();
        return;
      }
      if (event.translationY < DISMISS_Y || event.velocityY < -700) {
        translateY.value = withTiming(OFFSCREEN_Y, { duration: DISMISS_MS });
        runOnJS(scheduleFinish)();
        return;
      }
      translateX.value = withSpring(0, SPRING_CARD);
      translateY.value = withSpring(0, SPRING_CARD);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    opacity: Math.min(
      interpolate(Math.abs(translateX.value), [0, 180], [1, 0], Extrapolation.CLAMP),
      interpolate(translateY.value, [OFFSCREEN_Y, 0], [0, 1], Extrapolation.CLAMP),
    ),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View collapsable={false} style={[styles.frame, style]}>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pressAccessibilityLabel}
            haptic="selection"
            onPress={onPress}
          >
            {children}
          </Pressable>
        ) : (
          children
        )}
        {showClose ? (
          <Pressable
            accessibilityLabel={accessibilityLabel}
            haptic="none"
            hitSlop={8}
            onPress={slideAway}
            style={styles.close}
          >
            <Text style={styles.closeLabel}>✕</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
  },
  close: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.videoScrimSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeLabel: {
    color: colors.onVideo,
    fontSize: 13,
    fontWeight: '800',
    opacity: 0.85,
    lineHeight: 16,
  },
});
