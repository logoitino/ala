import { useState } from 'react';
import { View } from 'react-native';

import { GlowingNeonBorder } from '@/components/Effects/GlowingNeonBorder';
import { radii } from '@/constants/theme';

import {
  GLOW_PAD,
  glowingCardStyles as styles,
  type GlowingCardWrapperProps,
} from '@/components/Profile/glowingCardChrome';

/**
 * @purpose Sit a Skia neon sweep behind the 3D Aura trading card when Celestial Prism is unlocked or Locker Room gear is funded.
 * @param children The flippable `AuraTradingCard` (or a Studio persona card).
 * @param isWishlistFulfilled At least one wishlist item is fully funded / equipped.
 * @param isAuraMaxed Aura tier 7 — Celestial Prism.
 * @returns Centered wrap; glow canvas is 32px larger than the measured card (16px per side) and does not steal taps.
 * @sideEffects Native Skia GPU canvas. Expo web uses `GlowingCardWrapper.web.tsx` so CanvasKit WASM is never pulled into iOS/Android.
 */
export function GlowingCardWrapper({
  children,
  isWishlistFulfilled = false,
  isAuraMaxed = false,
}: GlowingCardWrapperProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const glow = isWishlistFulfilled || isAuraMaxed;
  const ready = glow && box.width > 0 && box.height > 0;

  return (
    <View style={[styles.container, glow ? styles.glowPad : null]}>
      {ready ? (
        <View
          style={[
            styles.glow,
            {
              width: box.width + GLOW_PAD,
              height: box.height + GLOW_PAD,
              pointerEvents: 'none',
            },
          ]}
        >
          <GlowingNeonBorder
            width={box.width + GLOW_PAD}
            height={box.height + GLOW_PAD}
            borderRadius={radii.lg + 4}
            isAuraMaxed={isAuraMaxed || isWishlistFulfilled}
            wishlistFulfilled={isWishlistFulfilled}
          />
        </View>
      ) : null}
      <View
        style={styles.card}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setBox((current) =>
            current.width === Math.round(width) && current.height === Math.round(height)
              ? current
              : { width: Math.round(width), height: Math.round(height) },
          );
        }}
      >
        {children}
      </View>
    </View>
  );
}
