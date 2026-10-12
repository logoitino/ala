/**
 * Grab bar for fan popup menus. A phone menu is a native modal, and the gesture library does not
 * receive swipes there, so this bar uses the system responder instead.
 */
import { useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { SPRING_SHEET } from '@/theme/motion';

const DISMISS_Y = 56;

/**
 * @purpose The grab bar on a popup menu. A downward swipe from the top of the menu, or a tap, closes it.
 * @param onDismiss Close handler already used by the backdrop. Omit only when the menu must stay up.
 * @returns The bar. With onDismiss it is a button named Close.
 * @sideEffects Calls onDismiss after a downward swipe past the threshold, or on tap.
 */
export function SheetHandle({ onDismiss }: { onDismiss?: () => void }) {
  const drag = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Boolean(onDismissRef.current) && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        drag.value = Math.max(0, gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const dismiss = onDismissRef.current;
        if (dismiss && (gesture.dy > DISMISS_Y || gesture.vy > 0.8)) dismiss();
        drag.value = withSpring(0, SPRING_SHEET);
      },
      onPanResponderTerminate: () => {
        drag.value = withSpring(0, SPRING_SHEET);
      },
    }),
  ).current;

  if (!onDismiss) {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hit}>
        <View style={styles.handle} />
      </View>
    );
  }

  return (
    <Animated.View {...responder.panHandlers} style={[styles.hit, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        accessibilityHint="Swipe down to close"
        onPress={onDismiss}
        style={styles.press}
      >
        <View style={styles.handle} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'stretch',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  press: {
    alignSelf: 'stretch',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    opacity: 0.9,
  },
});
