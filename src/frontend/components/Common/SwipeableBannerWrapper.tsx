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
const DISMISS_MS = 160;

type SwipeableBannerWrapperProps = {
  children: ReactNode;
  onDismiss: () => void;
  onPress?: () => void;
  accessibilityLabel?: string;
};

function fireLightHaptic() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Swipe-up / tap-✕ dismiss for top-floating live scoreboards and play-by-play toasts.
 * @param children Banner body (score chip or callout card).
 * @param onDismiss Fired after the banner animates off-screen (`translateY: -120`).
 * @param onPress Optional tap on the banner body (live scoreboard → Local game). ✕ still dismisses.
 * @returns Reanimated `Gesture.Pan` container with a semi-transparent ✕.
 * @sideEffects `Haptics.impactAsync(Light)` on swipe or tap dismiss. Pan activates only on upward travel so vertical Reel paging is not captured.
 */
export function SwipeableBannerWrapper({
  children,
  onDismiss,
  onPress,
  accessibilityLabel = 'Dismiss banner',
}: SwipeableBannerWrapperProps) {
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
    .activeOffsetY([-16, 1_000_000])
    .failOffsetY([-1_000_000, 18])
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      translateY.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY < DISMISS_Y) {
        translateY.value = withTiming(OFFSCREEN_Y, { duration: DISMISS_MS });
        runOnJS(scheduleFinish)();
        return;
      }
      translateY.value = withSpring(0, SPRING_CARD);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(translateY.value, [OFFSCREEN_Y, 0], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View collapsable={false} style={[styles.frame, style]}>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open live match"
            haptic="selection"
            onPress={onPress}
          >
            {children}
          </Pressable>
        ) : (
          children
        )}
        <Pressable
          accessibilityLabel={accessibilityLabel}
          haptic="none"
          hitSlop={8}
          onPress={slideAway}
          style={styles.close}
        >
          <Text style={styles.closeLabel}>✕</Text>
        </Pressable>
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
