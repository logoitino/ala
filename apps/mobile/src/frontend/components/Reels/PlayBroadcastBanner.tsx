/**
 * Live "big play" callout over the focused Highlight (split out of ReelCard.tsx for R4-03; behaviour unchanged).
 * Springs in, holds 3 s, fades; swipe up or tap the close control to dismiss early.
 * @sideEffects Light haptic via `SwipeableBannerWrapper` on dismiss.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { SwipeableBannerWrapper } from '@/components/Common/SwipeableBannerWrapper';
import { palette, radii } from '@/constants/theme';
import { FOCAL, SPRING_BOUNCE, SPRING_CARD } from '@/theme/motion';

const BANNER_HOLD_MS = 3000;
const BANNER_FADE_MS = 280;

/**
 * @purpose Spring-in live callout over the focused Reel; swipe up or tap ✕ to dismiss, else fades after 3s.
 * @param headline Copy such as "⚡ BIG PLAY: Westlake Thunder!".
 * @param top Offset under the live score overlay.
 * @param onDone Clears hook state after the fade or a manual dismiss.
 * @sideEffects Light `impactAsync` via `SwipeableBannerWrapper` on swipe/tap dismiss.
 */
export function PlayBroadcastBanner({
  headline,
  top,
  onDone,
}: {
  headline: string;
  top: number;
  onDone: () => void;
}) {
  const opacity = useSharedValue(0);
  const rise = useSharedValue(-18);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    opacity.value = withSpring(1, SPRING_CARD);
    rise.value = withSpring(0, SPRING_CARD);
    scale.value = withSpring(1, SPRING_BOUNCE);
    const fade = setTimeout(() => {
      opacity.value = withTiming(0, { duration: BANNER_FADE_MS });
      rise.value = withTiming(-8, { duration: BANNER_FADE_MS });
    }, BANNER_HOLD_MS);
    const done = setTimeout(onDone, BANNER_HOLD_MS + BANNER_FADE_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [onDone, opacity, rise, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }, { scale: scale.value }],
  }));

  return (
    <View pointerEvents="box-none" style={[styles.playBannerSlot, { top }]}>
      <SwipeableBannerWrapper accessibilityLabel="Dismiss play callout" onDismiss={onDone}>
        <Reanimated.View
          style={[styles.playBanner, style]}
          accessibilityLiveRegion="assertive"
          accessibilityLabel={headline}
        >
          <Text style={styles.playBannerLabel}>{headline}</Text>
        </Reanimated.View>
      </SwipeableBannerWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  playBannerSlot: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 12,
  },
  playBanner: {
    alignItems: 'center',
    backgroundColor: palette.midnightObsidian,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    paddingHorizontal: 14,
    paddingRight: 36,
    paddingVertical: 12,
  },
  playBannerLabel: {
    color: FOCAL.electricGold,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
